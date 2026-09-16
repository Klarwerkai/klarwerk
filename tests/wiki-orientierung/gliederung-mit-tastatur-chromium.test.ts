// ================================================================================================
// JOB 4145 R2 · DIE GLIEDERUNG AN DER ECHTEN, GEBAUTEN SEITE — NUR MIT DER TASTATUR.
// ================================================================================================
//
// WARUM DIESE DATEI NEBEN DER GEMOUNTETEN STEHT. BEN hat an Runde 1 zwei Prüflücken benannt
// (BEN-PRUEFUNG-JOB-4145-D1, Punkt 2 und 6):
//
//   · „O5 prüft programmatischen Fokus und Klick, keine tatsächliche Tab-/Enter-Folge."
//   · „Zusätzlich Chromium-Test mit echtem Tab, Enter, Fokusprüfung und sichtbarem Sprungziel
//      vorsehen."
//
// Beides fällt nur hier: jsdom führt für einen nativen `<button>` KEINE Vorgabehandlung auf
// `keydown` aus und rechnet kein Layout. `page.keyboard.press` ist dagegen eine echte Tasteneingabe
// an Chromium, und `getBoundingClientRect` misst echte Pixel. Ein `dispatchEvent('keydown')` aus
// `evaluate` wäre KEINE Tastaturmessung — der Browser macht daraus keine Aktivierung.
//
// DER PRÜFGEGENSTAND IST BENS GEGENBEISPIEL, und es geht den ECHTEN Weg: der Haken `vorbereiten`
// schreibt den Fließtext über den ECHTEN Dienst (`services.ko.revise`, derselbe Aufruf wie
// `PUT /api/kos/:id` mit `action: "revise"`), also durch den ECHTEN Server-Sanitizer. Was die
// Seite lädt, ist damit genau das, was ein Betrieb gespeichert bekäme — keine Testvorlage, die am
// Server vorbeigeht.
//
// VORRICHTUNG: `tests/design/h4-harness.ts`, unverändert (gebautes `apps/web/dist`, echte
// Fastify-App, Chromium). Die Tastatur steht seit JOB 3564 in der Vorrichtung selbst — hier wird
// nichts nachtypisiert.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DIST, type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";

/**
 * BENs ZWEITES Gegenbeispiel (R2), auf mehrere Bildschirmhöhen gestreckt — der härtere der beiden.
 *
 * `<h2>Eins<strong><h2>Zwei</h2></strong></h2>`: der Server-Sanitizer lässt es stehen (gemessen in
 * `gliederung-in-der-lesespalte.test.tsx`, W0), und anders als bei der direkten Schachtelung löst
 * der Browser sie NICHT auf — er schliesst eine offene Überschrift nur, wenn sie das AKTUELLE
 * Element ist, und hier steht `<strong>` dazwischen. Im Baum bleiben also DREI Überschriften,
 * ineinander. Genau daran ist Runde 2 gescheitert. Die Länge ist kein Beiwerk: ohne sie läge
 * „Drei" schon im Bild, und C1 prüfte einen Sprung, der nichts bewirken müsste.
 */
const VERSCHACHTELT_LANG = [
  "<h2>Eins<strong><h2>Zwei</h2></strong></h2>",
  "<p>Halterungen und Profile sind ohne waagerechte Oberseiten auszuführen. Offene, ablaufende Profile sind zu bevorzugen, damit Flüssigkeit nicht stehen bleibt.</p>".repeat(
    40,
  ),
  "<h2>Drei</h2>",
  "<p>Vollverschweißte Hohlprofile sind in Lebensmittel- und Spritzzonen zu vermeiden, weil ihre Dichtheit langfristig nicht garantiert werden kann.</p>".repeat(
    40,
  ),
].join("");

/** In der Seite: Leiste, Überschriften, Fokus und Pixel in EINEM Zug — sonst zwei Stände. */
const MESSEN = `() => {
  const lage = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
  const leiste = document.querySelector('[data-testid="bib-gliederung"]');
  const flaeche = document.querySelector('[data-testid="bib-text"]');
  const ueber = flaeche ? [].slice.call(flaeche.querySelectorAll('h1, h2, h3, h4, h5, h6')) : [];
  const aktiv = document.activeElement;
  return {
    fenster: window.innerHeight,
    leisteDa: !!leiste,
    leisteName: leiste ? (leiste.getAttribute('aria-label') || '') : '',
    titel: document.querySelector('[data-testid="bib-titel"]')
      ? (document.querySelector('[data-testid="bib-titel"]').textContent || '').trim()
      : '(kein Titel)',
    eintraege: leiste
      ? [].slice.call(leiste.querySelectorAll('button')).map((b) => (b.textContent || '').trim())
      : [],
    ueberschriften: ueber.map((h) => (h.textContent || '').trim()),
    verschachtelt: !!(ueber[0] && ueber[1] && ueber[0].contains(ueber[1])),
    aktivTag: aktiv ? aktiv.tagName : '(keins)',
    aktivText: aktiv ? (aktiv.textContent || '').trim() : '',
    aktivIstDritte: !!(ueber[2] && aktiv === ueber[2]),
    aktivIstEintragDrei: !!(leiste && aktiv && leiste.contains(aktiv) && (aktiv.textContent || '').trim() === 'Drei'),
    dritteLage: ueber[2] ? lage(ueber[2]) : null,
    leisteLage: leiste ? lage(leiste) : null,
  };
}`;

interface Lage {
  top: number;
  bottom: number;
}
interface Messung {
  fenster: number;
  leisteDa: boolean;
  leisteName: string;
  titel: string;
  eintraege: string[];
  ueberschriften: string[];
  verschachtelt: boolean;
  aktivTag: string;
  aktivText: string;
  aktivIstDritte: boolean;
  aktivIstEintragDrei: boolean;
  dritteLage: Lage | null;
  leisteLage: Lage | null;
}

let stand: H4Stand | null = null;
let fehler: string | null = null;

const messen = async (): Promise<Messung> =>
  (await (stand as H4Stand).seite.evaluate<Messung>(fn(MESSEN))) as Messung;

/**
 * R5 · WARTEN, BIS DIE LEISTE IM BAUM STEHT — UND BEI ABLAUF SAGEN, WAS STATTDESSEN DASTAND.
 *
 * Der Torlauf vom 15.09. 23:05 ist genau hier stehen geblieben, und die Meldung lautete nackt
 * „page.waitForFunction: Timeout 30000ms exceeded". Sie nennt weder die Wartezeile noch den Zustand
 * der Seite; die Ursache (die Leiste war NICHT DA, der Klick also nie an der Reihe) liess sich nur
 * an der Frist ablesen — 30 000 ms gehoeren dieser Zeile, die Wartezeilen des Klicks haben 20 000.
 * Die Frist bleibt, wie sie ist; lesbar wird der BEFUND. Bauform wie im Haus ueblich („letzter
 * sichtbarer Zustand", vgl. die Gegenproben in `tests/bibliothek-verlauf`).
 */
const ZUSTAND = `() => {
  const flaeche = document.querySelector('[data-testid="bib-text"]');
  return {
    url: location.href,
    titel: document.querySelector('[data-testid="bib-titel"]')
      ? (document.querySelector('[data-testid="bib-titel"]').textContent || '').trim()
      : '(kein Titel)',
    leiste: !!document.querySelector('[data-testid="bib-gliederung"]'),
    text: !!flaeche,
    ueberschriften: flaeche ? flaeche.querySelectorAll('h1, h2, h3, h4, h5, h6').length : -1,
    kopfspruenge: !!document.querySelector('[data-testid="bib-kopf-spruenge"]'),
  };
}`;

async function warteAufLeiste(wo: string): Promise<void> {
  const s = (stand as H4Stand).seite;
  try {
    await s.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="bib-gliederung"]')`),
      undefined,
      { timeout: 30_000 },
    );
  } catch (e) {
    const zustand = await s.evaluate(fn(ZUSTAND)).catch(() => null);
    throw new Error(
      `${wo}: die Gliederung stand nach 30 s nicht im Baum · letzter sichtbarer Zustand: ${JSON.stringify(zustand)} · ${String(e).split("\n")[0]}`,
    );
  }
}

/** Die Seite von vorn laden — jeder Fall beginnt oben, ohne Fokus und ohne gerollten Text. */
async function frisch(): Promise<void> {
  const s = (stand as H4Stand).seite;
  await s.goto(`${ORIGIN}/wissen/${(stand as H4Stand).koId}`, {
    waitUntil: "load",
    timeout: 60_000,
  });
  await warteAufLeiste("frisch geladen · /wissen/:id");
}

/**
 * R4 · Dieselbe Fläche über die BIBLIOTHEK — nur dort trägt die Lesespalte die übersetzte Lesart
 * selbst (auf `/wissen/:id` setzt `BibliothekFlaeche.tsx:1930` `lesevarianteSchonGesagt`).
 * Gewartet wird auf den Umschalter: er steht erst, wenn die Übersetzung wirklich geholt ist.
 */
async function frischInBibliothek(): Promise<void> {
  const s = (stand as H4Stand).seite;
  await s.goto(`${ORIGIN}/bibliothek?eintrag=${(stand as H4Stand).koOffenId}`, {
    waitUntil: "load",
    timeout: 60_000,
  });
  await s.waitForFunction(
    fn(`() => !!document.querySelector('[data-testid="lesevariante-umschalter"]')`),
    undefined,
    { timeout: 30_000 },
  );
  await warteAufLeiste("frisch geladen · /bibliothek");
}

describe("JOB 4145 R2 · die Gliederung in Chromium: echte Tastatur, echte Pixel", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/wissen/:frei", "pedi@job4145.test", async (z) => {
        // Über den ECHTEN Dienst: derselbe Aufruf, den `PUT /api/kos/:id` mit `action: "revise"`
        // fährt (`ko-routes.ts`). Damit läuft BENs Eingang durch den echten Server-Sanitizer.
        await z.services.ko.revise(z.freiId, { bodyHtml: VERSCHACHTELT_LANG }, z.autorId);
        // R4 · DERSELBE TEXT AM ZWEITEN EINTRAG — UND DORT EINE ÜBERSETZUNG MIT GENAU DIESEM TEXT.
        //
        // WARUM AM ZWEITEN UND NICHT AM ERSTEN (gemessen, Torlauf bd19fabf): auf `/wissen/:id`
        // zeichnet `KnowledgeDetail` über der Lesefläche die Übersetzungskarte aus JOB 3326 — mit
        // dem VOLLSTÄNDIGEN übersetzten Fließtext. Lag die Übersetzung am ersten Eintrag, schob sie
        // die Gliederung dort auf 2686 px hinunter und machte C0s Kalibrierung („die Leiste steht
        // ohne Rollvorgang im Bild") gegenstandslos. Die beiden Wege bleiben deshalb getrennt:
        // C0–C2 messen den ERSTEN Eintrag auf `/wissen/:id` ohne Übersetzung, C4/C5 den ZWEITEN auf
        // `/bibliothek` mit ihr.
        //
        // `bodyHtml` der Variante ist DER GESPEICHERTE Text, nicht die Vorlage: nur dann ist der
        // HTML-String vor und nach dem Umschalten Zeichen für Zeichen derselbe, und nur dann misst
        // C4/C5 die Lage, an der Runde 3 scheiterte. Abgelegt wird über die ECHTE Ablage
        // (`AppServices.lesevarianten`, `build-app.ts:309`) — kein Nachbau, keine zweite Quelle.
        const gespeichert = await z.services.ko.revise(
          z.offenId,
          { bodyHtml: VERSCHACHTELT_LANG },
          z.autorId,
        );
        await z.services.lesevarianten.upsert({
          koId: z.offenId,
          lang: "de",
          originalLanguage: "en",
          title: "Uebersetzter Titel",
          statement: "Uebersetzte Kernaussage.",
          bodyHtml: gespeichert.bodyHtml ?? "",
          herkunft: "manuell",
          status: "draft_translation_not_business_approval",
          sourceBodySha256: null,
          originalSha256: "a".repeat(64),
          uebersetzungSha256: "b".repeat(64),
          quellabgleich: "bestaetigt",
          updatedAt: "2026-09-15T21:00:00.000Z",
        });
      });
      await warteAufLeiste("erster Aufbau der Vorrichtung");
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 5).join(" | ");
    }
  }, 240_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("C0 · KALIBRIERUNG: drei Überschriften im Baum, drei Einträge — und „Drei“ liegt UNTER dem Bild", async () => {
    expect(fehler).toBeNull();
    const m = await messen();
    console.info(`JOB 4145 R2 · C0 · ${JSON.stringify(m)}`);
    // Der Server hat die verschachtelte Fassung gespeichert, und Chromium hat sie BEHALTEN — das
    // zweite Element steckt wirklich im ersten. Ohne diese Zeile misst C1 nicht BENs Lage.
    expect(m.ueberschriften).toEqual(["EinsZwei", "Zwei", "Drei"]);
    expect(m.verschachtelt, "Chromium hat flachgeklopft — dann trifft dieser Fall nichts").toBe(
      true,
    );
    // Und die Leiste zeigt drei Einträge. In Runde 2 standen hier zwei („EinsZwei", „Drei").
    expect(m.leisteDa, "die Gliederung fehlt").toBe(true);
    expect(m.eintraege).toEqual(["EinsZwei", "Zwei", "Drei"]);
    expect(m.leisteName.length, "der Bereich hat keinen zugänglichen Namen").toBeGreaterThan(0);
    // Ohne diese Zeile wäre C1 eine Aussage über einen Sprung, der gar nichts zu tun hat.
    expect(
      (m.dritteLage as Lage).top,
      `„Drei“ top=${(m.dritteLage as Lage).top}, Fenster=${m.fenster} — der Text ist zu kurz`,
    ).toBeGreaterThan(m.fenster);
    // Die Leiste selbst steht dagegen ohne einen Rollvorgang im Bild.
    expect((m.leisteLage as Lage).top).toBeLessThan(m.fenster);
    expect((m.leisteLage as Lage).bottom).toBeGreaterThan(0);
  }, 90_000);

  it("C1 · NUR TASTATUR: mit Tab bis „Drei“, Enter — Fokus auf der DRITTEN Überschrift, im Bild", async () => {
    expect(fehler).toBeNull();
    await frisch();
    const s = (stand as H4Stand).seite;
    // Startpunkt ist der letzte Kopfsprung. Ab hier wird NUR getippt — keine `click()`, kein `focus()`
    // auf das Ziel, kein `scrollIntoView` von Hand.
    await s.evaluate(
      fn(`() => document.querySelector('[data-testid="bib-sprung-anhaenge"]').focus()`),
    );
    let schritte = 0;
    let erreicht = false;
    for (let i = 0; i < 12 && !erreicht; i++) {
      await s.keyboard.press("Tab");
      schritte = i + 1;
      // Gesucht wird der Knopf, auf dem „Drei“ STEHT — so wählt ein Mensch, nicht über eine Position.
      erreicht = (await messen()).aktivIstEintragDrei;
    }
    expect(erreicht, "der Eintrag „Drei“ war in 12 Tabulatorschritten nicht erreichbar").toBe(true);
    console.info(`JOB 4145 R2 · C1 · Eintrag „Drei“ nach ${schritte} Tabulatorschritten erreicht`);

    await s.keyboard.press("Enter");
    await s.waitForFunction(
      fn(
        `() => { const f = document.querySelector('[data-testid="bib-text"]'); if (!f) return false; const u = f.querySelectorAll('h1, h2, h3, h4, h5, h6'); return !!u[2] && document.activeElement === u[2]; }`,
      ),
      undefined,
      { timeout: 20_000 },
    );
    const m = await messen();
    console.info(`JOB 4145 R2 · C1 · ${JSON.stringify(m)}`);
    // Der Fokus liegt auf der DRITTEN Überschrift — nicht auf der zweiten (Runde 1) und nicht oben.
    expect(m.aktivIstDritte, "der Fokus liegt nicht auf der dritten Überschrift").toBe(true);
    expect(m.aktivTag).toBe("H2");
    expect(m.aktivText).toBe("Drei");
    // Und sie ist wirklich SICHTBAR geworden — in echten Pixeln, nicht über die DOM-Reihenfolge.
    const lage = m.dritteLage as Lage;
    expect(lage.top, `„Drei“ top=${lage.top}, Fenster=${m.fenster}`).toBeLessThan(m.fenster);
    expect(lage.bottom, "„Drei“ liegt über dem Bild").toBeGreaterThan(0);
  }, 120_000);

  it("C2 · derselbe Weg mit der Maus trifft dieselbe Überschrift", async () => {
    expect(fehler).toBeNull();
    await frisch();
    const s = (stand as H4Stand).seite;
    // Ein echter Klick auf den Knopf mit der Beschriftung „Drei“ — ohne seine Position zu kennen.
    await s.evaluate(
      fn(`() => {
        const leiste = document.querySelector('[data-testid="bib-gliederung"]');
        const knopf = [].slice.call(leiste.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Drei');
        knopf.click();
      }`),
    );
    await s.waitForFunction(
      fn(
        `() => { const f = document.querySelector('[data-testid="bib-text"]'); if (!f) return false; const u = f.querySelectorAll('h1, h2, h3, h4, h5, h6'); return !!u[2] && document.activeElement === u[2]; }`,
      ),
      undefined,
      { timeout: 20_000 },
    );
    const m = await messen();
    console.info(`JOB 4145 R2 · C2 · ${JSON.stringify(m)}`);
    expect(m.aktivIstDritte).toBe(true);
    expect(m.aktivText).toBe("Drei");
    expect((m.dritteLage as Lage).top).toBeLessThan(m.fenster);
    expect((m.dritteLage as Lage).bottom).toBeGreaterThan(0);
  }, 120_000);

  it("C4 · R4 · NACH DEM UMSCHALTEN Übersetzung → Original: mit Tab und Enter trifft „Drei“ weiter", async () => {
    expect(fehler).toBeNull();
    await frischInBibliothek();
    const s = (stand as H4Stand).seite;
    // Vorbedingung: die ÜBERSETZUNG steht im Bild — und sie trägt denselben Fließtext.
    const vorher = await messen();
    console.info(`JOB 4145 R4 · C4 · vor dem Umschalten · ${JSON.stringify(vorher.titel)}`);
    expect(vorher.titel).toBe("Uebersetzter Titel");
    expect(vorher.eintraege).toEqual(["EinsZwei", "Zwei", "Drei"]);

    // UMSCHALTEN mit einem echten Klick auf den Umschalter — derselbe HTML-String, neuer Baum.
    await s.evaluate(
      fn(`() => document.querySelector('[data-testid="lesevariante-umschalter"]').click()`),
    );
    await s.waitForFunction(
      fn(
        `() => (document.querySelector('[data-testid="bib-titel"]').textContent || '').trim() !== 'Uebersetzter Titel'`,
      ),
      undefined,
      { timeout: 20_000 },
    );
    const nachWechsel = await messen();
    console.info(`JOB 4145 R4 · C4 · nach dem Umschalten · ${JSON.stringify(nachWechsel)}`);
    expect(nachWechsel.eintraege, "die Leiste ist nach dem Umschalten leer").toEqual([
      "EinsZwei",
      "Zwei",
      "Drei",
    ]);
    // Und „Drei" liegt wieder weit unter dem Bild — sonst misst der Sprung gleich nichts.
    expect((nachWechsel.dritteLage as Lage).top).toBeGreaterThan(nachWechsel.fenster);

    // JETZT NUR TASTATUR. In Runde 3 tat der Knopf hier NICHTS.
    await s.evaluate(
      fn(`() => document.querySelector('[data-testid="bib-sprung-anhaenge"]').focus()`),
    );
    let schritte = 0;
    let erreicht = false;
    for (let i = 0; i < 12 && !erreicht; i++) {
      await s.keyboard.press("Tab");
      schritte = i + 1;
      erreicht = (await messen()).aktivIstEintragDrei;
    }
    expect(erreicht, "der Eintrag „Drei“ war in 12 Tabulatorschritten nicht erreichbar").toBe(true);
    console.info(`JOB 4145 R4 · C4 · „Drei“ nach ${schritte} Tabulatorschritten erreicht`);

    await s.keyboard.press("Enter");
    await s.waitForFunction(
      fn(
        `() => { const f = document.querySelector('[data-testid="bib-text"]'); if (!f) return false; const u = f.querySelectorAll('h1, h2, h3, h4, h5, h6'); return !!u[2] && document.activeElement === u[2]; }`,
      ),
      undefined,
      { timeout: 20_000 },
    );
    const m = await messen();
    console.info(`JOB 4145 R4 · C4 · nach Enter · ${JSON.stringify(m)}`);
    expect(m.aktivIstDritte, "der Fokus liegt nicht auf der dritten Überschrift").toBe(true);
    expect(m.aktivText).toBe("Drei");
    const lage = m.dritteLage as Lage;
    expect(lage.top, `„Drei“ top=${lage.top}, Fenster=${m.fenster}`).toBeLessThan(m.fenster);
    expect(lage.bottom, "„Drei“ liegt über dem Bild").toBeGreaterThan(0);
  }, 150_000);

  it("C5 · R4 · und auf dem RÜCKWEG Original → Übersetzung genauso", async () => {
    expect(fehler).toBeNull();
    await frischInBibliothek();
    const s = (stand as H4Stand).seite;
    const umschalten = async (): Promise<void> => {
      const vorTitel = (await messen()).titel;
      await s.evaluate(
        fn(`() => document.querySelector('[data-testid="lesevariante-umschalter"]').click()`),
      );
      await s.waitForFunction(
        fn(
          `(alt) => (document.querySelector('[data-testid="bib-titel"]').textContent || '').trim() !== alt`,
        ),
        vorTitel,
        { timeout: 20_000 },
      );
    };
    // Hin (Übersetzung → Original) und zurück (Original → Übersetzung): beide Richtungen tauschen
    // den Teilbaum, und nach beiden muss die Leiste treffen.
    await umschalten();
    await umschalten();
    const zurueck = await messen();
    console.info(`JOB 4145 R4 · C5 · ${JSON.stringify(zurueck.titel)}`);
    expect(zurueck.titel, "der Rückweg führte nicht zur Übersetzung").toBe("Uebersetzter Titel");
    expect(zurueck.eintraege).toEqual(["EinsZwei", "Zwei", "Drei"]);

    await s.evaluate(
      fn(`() => {
        const leiste = document.querySelector('[data-testid="bib-gliederung"]');
        const knopf = [].slice.call(leiste.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Drei');
        knopf.click();
      }`),
    );
    await s.waitForFunction(
      fn(
        `() => { const f = document.querySelector('[data-testid="bib-text"]'); if (!f) return false; const u = f.querySelectorAll('h1, h2, h3, h4, h5, h6'); return !!u[2] && document.activeElement === u[2]; }`,
      ),
      undefined,
      { timeout: 20_000 },
    );
    const m = await messen();
    console.info(`JOB 4145 R4 · C5 · nach dem Sprung · ${JSON.stringify(m)}`);
    expect(m.aktivIstDritte).toBe(true);
    expect(m.aktivText).toBe("Drei");
    expect((m.dritteLage as Lage).top).toBeLessThan(m.fenster);
    expect((m.dritteLage as Lage).bottom).toBeGreaterThan(0);
  }, 150_000);

  it("C3 · Chromium meldete keinen Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect((stand as H4Stand).seitenfehler).toEqual([]);
  });
});

describe.runIf(!existsSync(join(DIST, "index.html")))(
  "JOB 4145 R2 · Chromium-Fall übersprungen",
  () => {
    it("meldet das fehlende dist, statt eine Prüfung vorzutäuschen", () => {
      expect(existsSync(join(DIST, "index.html")), `dist fehlt: ${DIST}`).toBe(false);
    });
  },
);

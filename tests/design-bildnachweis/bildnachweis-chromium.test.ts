// ================================================================================================
// R-1399 · SICHTNACHWEIS DER GESTALTUNGSÄNDERUNGEN DIESES AUFTRAGS — BILD UND ZAHL, AN DER ECHTEN APP.
// ================================================================================================
//
// Zu jeder Gestaltungsänderung soll belegt sein, wie die Fläche danach WIRKLICH aussieht. Diese Datei
// ist das Vergleichsmaterial samt Startbefehl: sie lädt die GEBAUTE Anwendung (`apps/web/dist`) in
// Chromium über die H4-Bühne (`tests/design/h4-harness.ts`: echte Fastify-App, echter Bestand, echte
// Anmeldung als erstes Konto = Admin) und legt je Zustand ein PNG ab:
//
//   test-results/bildnachweis/b1-bibliothek-exportumfang.png      — Menü „…" → „Export" (K19)
//   test-results/bildnachweis/b2-kenntnisnahme-zu.png             — Lesefläche, Aufklapper zu (K25/K8)
//   test-results/bildnachweis/b2-kenntnisnahme-offen.png          — derselbe Aufklapper geöffnet
//   test-results/bildnachweis/b3-werksreset-rueckfrage.png        — Werksreset Stufe 2 (K2)
//   test-results/bildnachweis/b4-ui-kit-1.png, -2.png, …          — Bausteinkatalog, in Bildschirm-
//                                                                   höhen durchlaufen (K5/K7/K4)
//
// Startbefehl (wie jede Datei der Browsergruppe, nach `./tools/build`):
//   npx vitest run --config vitest.browser.config.ts tests/design-bildnachweis/bildnachweis-chromium.test.ts
//
// Neben jedem Bild steht die ZAHL, die das Bild trägt (Werkzeug-Hälfte von R-1399): sichtbar ja/nein,
// Reihenfolge, offen/zu, berechnete Farben — gemessen per `getComputedStyle`, nicht behauptet.
//
// EINE EHRLICHE GRENZE, BENANNT: der Werksreset ist auf dieser Bühne nicht verfügbar (kein Journal,
// `factoryResetUnavailable`). Damit Stufe 2 überhaupt erscheint, wird NUR die Antwort des Statusabrufs
// `GET /api/admin/factory-reset` auf `{ available: true }` gestellt (`antworten.vorAuslieferung` der
// Bühne). „Zurücksetzen & beenden" wird NICHT gedrückt — es wird nichts ausgeführt.
import { mkdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";
import { repoPfad } from "../support/repoPfad";

const ORDNER = repoPfad("test-results/bildnachweis");
const bild = (name: string): string => `${ORDNER}/${name}.png`;

interface Rechteck {
  x: number;
  y: number;
  width: number;
  height: number;
}

// In der Seite: das Rechteck eines Elements, mit 12 px Rand — der Ausschnitt fürs Bild.
const RECHTECK = `(sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const x = Math.max(0, r.left - 12);
  const y = Math.max(0, r.top - 12);
  return { x, y, width: r.width + 24, height: r.height + 24 };
}`;

// In der Seite: die berechnete Hintergrundfarbe einer Token-Klasse, an einem Prüfling gemessen.
const TOKENFARBE = `(klasse) => {
  const p = document.createElement('div');
  p.className = klasse;
  document.body.appendChild(p);
  const f = getComputedStyle(p).backgroundColor;
  p.remove();
  return f;
}`;

let stand: H4Stand | null = null;
let fehler: string | null = null;

async function warte(selektor: string): Promise<void> {
  await (stand as H4Stand).seite.waitForFunction(
    fn("(sel) => !!document.querySelector(sel)"),
    selektor,
    { timeout: 30_000 },
  );
}

// Der Hinweis „Kurz zur Kenntnis" (`legal/NoticeBanner.tsx`) liegt unten über jeder Fläche, bis er
// quittiert ist. Er wird über seinen vorgesehenen Bedienweg geschlossen — „Verstanden — weiter" —,
// nicht weggeblendet; die Quittung landet am Server dieser Bühne.
async function hinweisQuittieren(): Promise<void> {
  const s = (stand as H4Stand).seite;
  const da = await s.evaluate<boolean>(
    fn(`() => !!document.querySelector('[data-testid="notice-ack"]')`),
  );
  if (!da) return;
  await s.click('[data-testid="notice-ack"]');
  await s.waitForFunction(
    fn(`() => !document.querySelector('[data-testid="notice-banner"]')`),
    undefined,
    { timeout: 15_000 },
  );
}

async function ausschnitt(selektor: string, name: string): Promise<void> {
  const s = (stand as H4Stand).seite;
  const clip = await s.evaluate<Rechteck | null>(fn(RECHTECK), selektor);
  expect(clip, `${selektor} nicht gefunden`).not.toBeNull();
  await s.screenshot({ path: bild(name), clip });
  console.info(`R-1399 · Bild ${bild(name)} · Ausschnitt ${JSON.stringify(clip)}`);
}

describe("R-1399 · Sichtnachweis: Exportumfang, Kenntnisnahme, Werksreset-Rückfrage, Katalog", () => {
  beforeAll(async () => {
    mkdirSync(ORDNER, { recursive: true });
    try {
      stand = await h4Stand("/bibliothek", "bild@design-bildnachweis.test");
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("B1 · Bibliothek, Menü „…“ → „Export“: der Umfang steht vor den Formaten", async () => {
    expect(fehler).toBeNull();
    const s = (stand as H4Stand).seite;
    await hinweisQuittieren();
    await s.click('[data-testid="bib-liste-menue"]');
    await warte('[role="menu"]');
    await s.evaluate(
      fn(`() => {
        const m = document.querySelector('[data-testid="bib-liste-menue"]').parentElement.querySelector('[role="menu"]');
        const d = [...m.querySelectorAll('details')].find((x) => (x.querySelector('summary').textContent || '').includes('Export'));
        d.open = true;
        d.scrollIntoView({ block: 'center' });
      }`),
    );
    const m = await s.evaluate<{ sichtbar: boolean; text: string; vorLink: boolean }>(
      fn(`() => {
        const u = document.querySelector('[data-testid="bib-export-umfang"]');
        const l = document.querySelector('[data-testid="bib-export-json"]');
        const r = u.getBoundingClientRect();
        return {
          sichtbar: r.width > 0 && r.height > 0,
          text: (u.innerText || '').trim(),
          vorLink: r.top < l.getBoundingClientRect().top,
        };
      }`),
    );
    console.info(`R-1399 · B1 · ${JSON.stringify(m)}`);
    expect(m.sichtbar).toBe(true);
    expect(m.text).toContain("alle validierten Einträge");
    expect(m.text).toContain("Suche und Filter gelten für den Export nicht");
    expect(m.vorLink, "der Umfang steht nicht über den Formaten").toBe(true);
    await ausschnitt('[role="menu"]', "b1-bibliothek-exportumfang");
    await s.keyboard.press("Escape");
  }, 60_000);

  it("B2 · Lesefläche: Kenntnisnahme steht zu da — nur die Beschriftung; geöffnet die Verneinung", async () => {
    expect(fehler).toBeNull();
    const s = (stand as H4Stand).seite;
    await warte('[data-testid="kenntnisnahme-aufklapper"]');
    const zu = await s.evaluate<{ offen: boolean; text: string }>(
      fn(`() => {
        const d = document.querySelector('[data-testid="kenntnisnahme-aufklapper"]');
        d.scrollIntoView({ block: 'center' });
        return { offen: d.open, text: (document.querySelector('[data-testid="kenntnisnahme-bereich"]').innerText || '').trim() };
      }`),
    );
    console.info(`R-1399 · B2 zu · ${JSON.stringify(zu)}`);
    expect(zu.offen).toBe(false);
    expect(zu.text.toLowerCase()).toBe("kenntnisnahme");
    await ausschnitt('[data-testid="kenntnisnahme-bereich"]', "b2-kenntnisnahme-zu");

    await s.click('[data-testid="kenntnisnahme-aufklapper"] > summary');
    const auf = await s.evaluate<{ offen: boolean; text: string }>(
      fn(`() => {
        const d = document.querySelector('[data-testid="kenntnisnahme-aufklapper"]');
        return { offen: d.open, text: (d.innerText || '').trim() };
      }`),
    );
    console.info(`R-1399 · B2 offen · ${auf.text.length} Zeichen`);
    expect(auf.offen).toBe(true);
    expect(auf.text).toContain("keine elektronische Signatur");
    await ausschnitt('[data-testid="kenntnisnahme-bereich"]', "b2-kenntnisnahme-offen");
  }, 60_000);

  it("B3 · Werksreset Stufe 2: neutrale Fläche, Rot nur am Knopf — gemessene Farben", async () => {
    expect(fehler).toBeNull();
    const st = stand as H4Stand;
    const s = st.seite;
    // NUR der Statusabruf wird verstellt (s. Kopf) — sonst bliebe die Karte bei „nicht verfügbar".
    st.antworten.vorAuslieferung = async (url, body) =>
      url.pathname === "/api/admin/factory-reset" ? JSON.stringify({ available: true }) : body;
    try {
      await s.goto(`${ORIGIN}/admin?detail=werk`, { waitUntil: "load", timeout: 60_000 });
      const karte = '[data-testid="detail-werkseinstellungen"]';
      await warte(`${karte} button`);
      await s.click(`${karte} button:has-text("Auf Werkseinstellungen zurücksetzen")`);
      await s.click(`${karte} input[type="password"]`);
      await s.keyboard.type("geheim12345");
      await s.click(`${karte} button:has-text("Weiter")`);
      await warte('[data-testid="adm-factory-rueckfrage"]');
      const f = await s.evaluate<{ flaeche: string; knopf: string; titel: string }>(
        fn(`() => {
          const k = document.querySelector('[data-testid="adm-factory-rueckfrage"]');
          k.scrollIntoView({ block: 'center' });
          const knoepfe = [...k.querySelectorAll('button')];
          const los = knoepfe[knoepfe.length - 1];
          return {
            flaeche: getComputedStyle(k).backgroundColor,
            knopf: getComputedStyle(los).backgroundColor,
            titel: getComputedStyle(k.querySelector('span')).color,
          };
        }`),
      );
      const neutral = await s.evaluate<string>(fn(TOKENFARBE), "bg-page");
      const rotFlaeche = await s.evaluate<string>(fn(TOKENFARBE), "bg-trust-crit-bg");
      const rotKnopf = await s.evaluate<string>(fn(TOKENFARBE), "bg-trust-crit-text");
      console.info(
        `R-1399 · B3 · Fläche ${f.flaeche} (bg-page ${neutral}, crit-bg ${rotFlaeche}) · Knopf ${f.knopf} (crit ${rotKnopf}) · Titel ${f.titel}`,
      );
      expect(f.flaeche).toBe(neutral);
      expect(f.flaeche).not.toBe(rotFlaeche);
      expect(f.knopf).toBe(rotKnopf);
      await ausschnitt('[data-testid="adm-factory-rueckfrage"]', "b3-werksreset-rueckfrage");
    } finally {
      delete st.antworten.vorAuslieferung;
    }
  }, 90_000);

  it("B4 · Bausteinkatalog /ui-kit: Farbbedeutung, Schriftskala, Radien, Rückfrage — jeder Abschnitt im Bild", async () => {
    expect(fehler).toBeNull();
    const s = (stand as H4Stand).seite;
    await s.goto(`${ORIGIN}/ui-kit`, { waitUntil: "load", timeout: 60_000 });
    await warte('[data-testid="bausteine-rueckfrage"]');
    const z = await s.evaluate<{ farben: number; stufen: number; klein: string; zaehler: string }>(
      fn(`() => {
        const groesse = (k) => {
          const p = document.createElement('span');
          p.className = k;
          document.body.appendChild(p);
          const g = getComputedStyle(p).fontSize;
          p.remove();
          return g;
        };
        return {
          farben: document.querySelectorAll('[data-testid^="bausteine-farbe-"]').length,
          stufen: document.querySelectorAll('[data-testid="bausteine-stufe"]').length,
          klein: groesse('text-klein'),
          zaehler: groesse('text-zaehler'),
        };
      }`),
    );
    console.info(`R-1399 · B4 · ${JSON.stringify(z)}`);
    expect(z.farben).toBe(6);
    expect(z.stufen).toBe(4);
    // Die Skala ist im GEBAUTEN Bündel angekommen, nicht nur im Quelltext.
    expect(z.klein).toBe("11px");
    expect(z.zaehler).toBe("10.5px");

    // Ben, Nacharbeit 7: das frühere „fullPage"-Bild zeigte nur den oberen Ausschnitt — die App
    // scrollt in `<main>` (`shell/AppShell.tsx`), nicht im Dokument, und der Hinweis „Kurz zur
    // Kenntnis" lag über dem unteren Rand. Deshalb: (1) den Hinweis über seinen vorgesehenen
    // Bedienweg quittieren („Verstanden — weiter", `legal/NoticeBanner.tsx`), (2) `<main>` in
    // Bildschirmhöhen durchlaufen, je Stand ein Bild, (3) belegen, dass JEDER Katalogabschnitt in
    // mindestens einem Bild VOLLSTÄNDIG im sichtbaren Bereich stand.
    await hinweisQuittieren();
    const ABSCHNITTE = [
      "farben",
      "schrift",
      "radien",
      "rueckfrage",
      "status",
      "konfidenz",
      "wissensarten",
      "ki",
      "herkunft",
    ];
    const hoehe = await s.evaluate<{ scroll: number; sicht: number }>(
      fn(`() => {
        const m = document.querySelector('main');
        m.scrollTop = 0;
        return { scroll: m.scrollHeight, sicht: m.clientHeight };
      }`),
    );
    // KALIBRIERUNG: der Katalog ist höher als ein Bildschirm — sonst bewiese das Durchlaufen nichts.
    expect(hoehe.scroll).toBeGreaterThan(hoehe.sicht);
    const schritt = Math.max(200, hoehe.sicht - 80);
    const gesehen = new Set<string>();
    const bilder: string[] = [];
    let oben = 0;
    let nr = 1;
    let ende = false;
    while (!ende) {
      const lage = await s.evaluate<{ voll: string[]; ende: boolean; ueberdeckt: boolean }>(
        fn(`([oben, kennungen]) => {
          const m = document.querySelector('main');
          m.scrollTop = oben;
          const r = m.getBoundingClientRect();
          const voll = kennungen.filter((k) => {
            const e = document.querySelector('[data-testid="bausteine-abschnitt-' + k + '"]');
            if (!e) return false;
            const b = e.getBoundingClientRect();
            return b.top >= r.top - 1 && b.bottom <= r.bottom + 1;
          });
          return {
            voll,
            ende: m.scrollTop + m.clientHeight >= m.scrollHeight - 1,
            ueberdeckt: !!document.querySelector('[data-testid="notice-banner"]'),
          };
        }`),
        [oben, ABSCHNITTE],
      );
      expect(lage.ueberdeckt, "der Hinweis liegt noch über dem Katalog").toBe(false);
      const name = `b4-ui-kit-${nr}`;
      await s.screenshot({ path: bild(name) });
      bilder.push(bild(name));
      for (const k of lage.voll) gesehen.add(k);
      console.info(
        `R-1399 · Bild ${bild(name)} · scrollTop ${oben} · vollständig: ${lage.voll.join(", ")}`,
      );
      ende = lage.ende || nr >= 12;
      oben += schritt;
      nr += 1;
    }
    expect(
      ABSCHNITTE.filter((k) => !gesehen.has(k)),
      "Katalogabschnitt in keinem Bild vollständig sichtbar",
    ).toEqual([]);
    console.info(`R-1399 · B4 · ${bilder.length} Bilder: ${bilder.join(", ")}`);
    expect((stand as H4Stand).seitenfehler).toEqual([]);
  }, 120_000);
});

// ================================================================================================
// JOB 3068 (N5) — DER BEFUND UND SEIN DECKUNGSSATZ STEHEN DA. OHNE EINEN KLICK. IN CHROMIUM.
// ================================================================================================
//
// PEDIS ZEILE N5: „Der Autor sieht DAUERHAFT, dass sein Beitrag kollidiert, ohne fremden Inhalt zu
// sehen, mit ehrlichem Satz, gegen wie viel geprüft wurde."
//
// WAS DIESE DATEI MISST — und warum genau das:
//   · Die Anwesenheit eines Elements beweist hier nichts. Bis zu diesem Auftrag WAR die Auskunft
//     gebaut — sie lag im Abschnitt „Konflikt" hinter der zugeklappten Zeile „Mehr". Gemessen wird
//     deshalb, dass sie dasteht, OHNE dass „Mehr" betätigt wurde (`aria-expanded` wird mitgelesen).
//   · Der Fall ist eine ÜBERSCHNEIDUNG, kein Konflikt. Das ist Absicht: `/api/conflicts` trägt dann
//     kein Paar, und `conflictNotice` — die einzige Kollisionsauskunft, die die Lesefläche vor
//     diesem Auftrag hatte — schweigt. Genau diese Autorin sah bis heute NICHTS.
//   · Gemessen wird an der ECHTEN, gebauten Anwendung (`apps/web/dist`) gegen die ECHTE Fastify-App
//     mit echtem Bestand — dieselbe Vorrichtung wie JOB 3063 H4 (`tests/design/h4-harness.ts`).
//     Überschneidung und Abdeckungsprotokoll entstehen im Betrieb aus dem Erkennungslauf und haben
//     keinen Weg über die Oberfläche; sie werden deshalb über die ECHTEN Dienste hergestellt.
//
// DIE ZAHLEN SIND VERSCHIEDEN GEWÄHLT (12 von 40 am einen, 9 von 9 am anderen Eintrag). Damit misst
// das Blättern zwischen den Einträgen mehr als „irgendein Satz steht da": es misst, dass die Zahl
// zum GEÖFFNETEN Eintrag gehört (Generationsdrift, LEHREN.md JOB 3056 R5).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { type H4Stand, TITEL_FREI, TITEL_OFFEN, fn, h4Stand } from "../design/h4-harness";

// ---- Der Bestand, den diese Messung braucht -----------------------------------------------------

/** Das fremde Gegenüber. Sein Titel und sein Zitat dürfen auf der Lesefläche NIE erscheinen (A28). */
const FREMD_TITEL = "GEHEIM Fremdes Wissen zur Spritzzone";
const FREMD_ZITAT = "Der Kessel läuft mit 6 bar.";

/** 12 von 40, und der Lauf ist gedeckelt — also `unvollstaendig` (conflicts/src/coverage.ts:203). */
const DECKUNG_FREI = {
  available: 40,
  selected: 12,
  alreadyOpen: 0,
  attempted: 12,
  completed: 12,
  skipped: 0,
  capped: true,
  aborted: false,
};

/**
 * JOB 3068 R2 (bens Korrekturpflicht 1): der dritte eigene Eintrag — ein Lauf, der GESCHEITERT ist.
 *
 * `recordAiCheckOutcome({ ok: false })` schreibt `status: "failed"` OHNE Abdeckungsprotokoll. Der
 * Server liefert dafür `lage: "unvollstaendig"` mit `geprueft: null, bestand: null` — der gültige
 * Zustand, an dem Runde 1 fiel („Gegen  von  Einträgen im Bestand geprüft").
 */
const TITEL_GESCHEITERT = "Dichtungswechsel Pumpe P-14";

/** 9 von 9, nichts ausgelassen, nichts gedeckelt — also `vollstaendig`. */
const DECKUNG_OFFEN = {
  available: 9,
  selected: 9,
  alreadyOpen: 0,
  attempted: 9,
  completed: 9,
  skipped: 0,
  capped: false,
  aborted: false,
};

let stand: H4Stand | null = null;
let fehler: string | null = null;

/**
 * Eine echte Route abfragen — AUS DER SEITE HERAUS, mit ihrer Anmeldung.
 *
 * Nicht über `app.inject`: der Bearer liegt in der Vorrichtung, und ein Aufruf ohne ihn antwortet
 * `UNAUTHENTICATED` — er misst dann die Anmeldung statt des Bestands. Der Weg durch die Seite ist
 * derselbe, den die Oberfläche geht (`h4-harness.ts`, Routen-Umleitung).
 */
const route = async <T,>(pfad: string): Promise<T> =>
  (await (stand as H4Stand).seite.evaluate<T>(
    fn(`async (p) => (await fetch(p, { headers: { accept: 'application/json' } })).json()`),
    pfad,
  )) as T;

// In der Seite: alles, was diese Messung braucht, in EINEM Zug — sonst könnte zwischen zwei
// Auslesungen ein Rücklauf eintreffen und die Aussagen stammten aus zwei Ständen.
const MESSEN = `() => {
  const lesen = document.querySelector('[data-testid="bib-lesen"]');
  const mehr = document.querySelector('[data-testid="bib-mehr"]');
  const zeile = document.querySelector('[data-testid="job3025-kollision"]');
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  return {
    titel: norm(document.querySelector('[data-testid="bib-titel"]') ? document.querySelector('[data-testid="bib-titel"]').textContent : ''),
    zeileDa: !!zeile,
    zeileText: norm(zeile ? zeile.textContent : ''),
    zeileTag: zeile ? zeile.tagName : '(keine Zeile)',
    zeileInP: !!(zeile && zeile.closest('p')),
    deckungAnzahl: document.querySelectorAll('[data-testid="bib-deckungssatz"]').length,
    deckungText: norm(document.querySelector('[data-testid="bib-deckungssatz"]') ? document.querySelector('[data-testid="bib-deckungssatz"]').textContent : ''),
    mehrOffen: mehr ? mehr.getAttribute('aria-expanded') : '(kein Mehr-Knopf)',
    konfliktsatzAnzahl: document.querySelectorAll('[data-testid="bib-konfliktsatz"]').length,
    lesenText: norm(lesen ? lesen.innerText : ''),
    kollisionImMehr: document.querySelectorAll('[data-bib-abschnitt="konflikt"] [data-testid="job3025-kollision"]').length,
  };
}`;

interface Messung {
  titel: string;
  zeileDa: boolean;
  zeileText: string;
  zeileTag: string;
  zeileInP: boolean;
  deckungAnzahl: number;
  deckungText: string;
  mehrOffen: string;
  konfliktsatzAnzahl: number;
  lesenText: string;
  kollisionImMehr: number;
}

const messen = async (): Promise<Messung> =>
  (await (stand as H4Stand).seite.evaluate<Messung>(fn(MESSEN))) as Messung;

describe("JOB 3068 · N5 — der Deckungssatz steht ohne einen Klick auf der Lesefläche", () => {
  beforeAll(async () => {
    try {
      await i18n.changeLanguage("de");
      stand = await h4Stand("/wissen/:frei", "pedi@job3068.test", async (z) => {
        // Zwei fremde Gegenstücke — je eines je eigenem Eintrag. Ihr Autor ist NICHT der Betrachter;
        // damit entsteht das Signal nur an MEINER Seite (duplicate-signal.ts, Grenze 2).
        const fremd1 = (await z.services.ko.create({
          title: FREMD_TITEL,
          statement: FREMD_ZITAT,
          type: "best_practice",
          category: "Produktion",
          author: "u-fremd-9",
        } as never)) as { id: string };
        const fremd2 = (await z.services.ko.create({
          title: `${FREMD_TITEL} II`,
          statement: FREMD_ZITAT,
          type: "best_practice",
          category: "Produktion",
          author: "u-fremd-9",
        } as never)) as { id: string };
        const fremd3 = (await z.services.ko.create({
          title: `${FREMD_TITEL} III`,
          statement: FREMD_ZITAT,
          type: "best_practice",
          category: "Produktion",
          author: "u-fremd-9",
        } as never)) as { id: string };

        // JOB 3068 R2: der dritte EIGENE Eintrag, dessen Prüflauf gescheitert ist.
        const gescheitert = (await z.services.ko.create({
          title: TITEL_GESCHEITERT,
          statement: "Die Dichtung wird bei jedem Lagerwechsel getauscht.",
          type: "best_practice",
          category: "Instandhaltung",
          author: z.autorId,
        } as never)) as { id: string };

        // Je eine OFFENE Überschneidung. Bewusst kein Konflikt: dann bleibt `/api/conflicts` leer,
        // und die Messung trifft genau die Autorin, die vor diesem Auftrag nichts sah.
        for (const [meins, fremdes] of [
          [z.freiId, fremd1.id],
          [z.offenId, fremd2.id],
          [gescheitert.id, fremd3.id],
        ] as const) {
          await z.services.overlaps.createAuto(
            {
              koA: meins,
              koB: fremdes,
              relation: "teilweise",
              aspects: [
                {
                  beschreibung: "Reinigung der Spritzzone",
                  zitatA: "nass gereinigt",
                  zitatB: FREMD_ZITAT,
                },
              ],
              eigenanteilA: "Frequenz je Schicht",
              eigenanteilB: FREMD_ZITAT,
              recommendation: "zusammenfuehren_pruefen",
            },
            { trigger: "background", method: "deterministic", lexicalScore: 0.71 },
          );
        }

        // Und die Laufausgänge — drei verschiedene Lagen, zwei davon mit Zahlen, eine ohne.
        await z.services.ko.recordAiCheckOutcome(z.freiId, { ok: true, coverage: DECKUNG_FREI });
        await z.services.ko.recordAiCheckOutcome(z.offenId, { ok: true, coverage: DECKUNG_OFFEN });
        // `ok: false` OHNE Protokoll: `status: "failed"` → `unvollstaendig` mit `null`/`null`.
        await z.services.ko.recordAiCheckOutcome(gescheitert.id, {
          ok: false,
          fallbackReason: "no-model",
        });
      });
      // Die Kollisionszeile braucht drei Antworten (Signal, Konflikte, Liste) — hier wird auf sie
      // gewartet, statt eine feste Zeit zu raten.
      await stand.seite.waitForFunction(
        fn(`() => !!document.querySelector('[data-testid="job3025-kollision"]')`),
        undefined,
        { timeout: 30_000 },
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 5).join(" | ");
    }
  }, 240_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("N-0 · die Vorrichtung steht: gebautes dist, echte App, Chromium", () => {
    expect(fehler).toBeNull();
    expect((stand as H4Stand).version.length).toBeGreaterThan(0);
    expect((stand as H4Stand).seitenfehler, "Chromium meldete Seitenfehler").toEqual([]);
  });

  it("N-1 · POSITIV: Befundzeile UND Deckungssatz stehen da, ohne dass „Mehr“ betätigt wurde", async () => {
    expect(fehler).toBeNull();
    const m = await messen();
    console.info(`JOB 3068 N5 · Lesefläche: ${JSON.stringify(m)}`);
    expect(m.titel).toBe(TITEL_FREI);
    // Der Beweis, dass nichts aufgeklappt wurde: der Knopf steht auf `false`.
    expect(m.mehrOffen, "die Zeile „Mehr“ war aufgeklappt — dann misst dieser Fall nichts").toBe(
      "false",
    );
    expect(m.zeileDa).toBe(true);
    expect(m.zeileText).toContain(i18n.t("kollision.detail.dublette"));
    expect(m.deckungAnzahl, "genau EIN Deckungssatz auf der Fläche").toBe(1);
    expect(m.deckungText).toBe(
      i18n.t("kollision.deckung.unvollstaendig", { geprueft: 12, bestand: 40 }),
    );
    expect(m.deckungText).toContain("12");
    expect(m.deckungText).toContain("40");
  }, 60_000);

  it("N-2 · GEGENPROBE „dauerhaft“: `/api/conflicts` trägt kein Paar — der Befund steht trotzdem", async () => {
    expect(fehler).toBeNull();
    // Kalibrierung an der ECHTEN Route: ohne sie wäre der Fall vakuös (er wäre auch grün, wenn ein
    // sichtbarer Konflikt existierte und `conflictNotice` die Auskunft trüge).
    const konflikte = await route<unknown[]>("/api/conflicts");
    expect(Array.isArray(konflikte) ? konflikte.length : -1).toBe(0);
    // …und das Signal spricht trotzdem, MIT den Zahlen: genau die Auskunft, die `/api/conflicts`
    // hier nicht geben kann.
    const signal =
      await route<{ koId: string; dublette: boolean; deckung: unknown }[]>("/api/duplicate-signal");
    expect(signal.find((b) => b.koId === (stand as H4Stand).koId)).toEqual({
      koId: (stand as H4Stand).koId,
      dublette: true,
      konflikt: false,
      deckung: { lage: "unvollstaendig", geprueft: 12, bestand: 40 },
    });
    const m = await messen();
    expect(m.konfliktsatzAnzahl, "der alte `conflictNotice`-Satz kann hier nichts sagen").toBe(0);
    expect(m.zeileDa, "…und trotzdem steht der Befund da").toBe(true);
  }, 60_000);

  it("N-3 · NICHTS über die Gegenseite: kein Titel, kein Zitat, keine Kennung (A28)", async () => {
    expect(fehler).toBeNull();
    const m = await messen();
    expect(m.lesenText).not.toContain(FREMD_TITEL);
    expect(m.lesenText).not.toContain(FREMD_ZITAT);
    expect(m.lesenText).not.toContain("u-fremd-9");
    // Kalibrierung: der fremde Inhalt liegt wirklich im Bestand — sonst prüfte N-3 nichts.
    const bestand = await route<unknown>("/api/kos");
    expect(JSON.stringify(bestand)).toContain(FREMD_TITEL);
  }, 60_000);

  it("N-4 · ABLÖSUNG: hinter „Mehr“ steht die Auskunft nicht mehr", async () => {
    expect(fehler).toBeNull();
    const s = (stand as H4Stand).seite;
    await s.evaluate(
      fn(`() => {
        const mehr = document.querySelector('[data-testid="bib-mehr"]');
        if (mehr && mehr.getAttribute('aria-expanded') !== 'true') mehr.click();
        const konflikt = document.querySelector('[data-bib-abschnitt="konflikt"]');
        if (konflikt && !konflikt.open) { konflikt.open = true; konflikt.dispatchEvent(new Event('toggle')); }
      }`),
    );
    await s.waitForFunction(
      fn(`() => !!document.querySelector('[data-bib-abschnitt="konflikt"]')`),
      undefined,
      { timeout: 20_000 },
    );
    const m = await messen();
    expect(m.kollisionImMehr, "die Auskunft steht wieder an zwei Stellen").toBe(0);
    // Und die eine Stelle trägt weiter genau einen Deckungssatz — auch aufgeklappt.
    expect(m.deckungAnzahl).toBe(1);
  }, 60_000);

  it("N-5 · BLÄTTERN: die Zahl gehört zum geöffneten Eintrag, nicht zum vorigen", async () => {
    expect(fehler).toBeNull();
    const s = (stand as H4Stand).seite;
    await s.evaluate(
      fn(`(titel) => {
        const zeilen = [...document.querySelectorAll('[data-testid="bib-zeile"]')];
        const z = zeilen.find((e) => (e.textContent || '').includes(titel));
        if (z) z.click();
      }`),
      TITEL_OFFEN,
    );
    await s.waitForFunction(
      fn(
        `(titel) => { const el = document.querySelector('[data-testid="bib-titel"]'); return !!el && el.textContent.trim() === titel; }`,
      ),
      TITEL_OFFEN,
      { timeout: 20_000 },
    );
    await s.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="bib-deckungssatz"]')`),
      undefined,
      { timeout: 20_000 },
    );
    const m = await messen();
    console.info(`JOB 3068 N5 · nach dem Blättern: ${JSON.stringify(m)}`);
    expect(m.titel).toBe(TITEL_OFFEN);
    expect(m.deckungAnzahl).toBe(1);
    expect(m.deckungText).toBe(
      i18n.t("kollision.deckung.vollstaendig", { geprueft: 9, bestand: 9 }),
    );
    // Der Kern der Gegenprobe: die Zahlen des vorigen Eintrags sind fort.
    expect(m.deckungText).not.toContain("12");
    expect(m.deckungText).not.toContain("40");
    expect(m.mehrOffen, "der neue Eintrag beginnt wieder zugeklappt").toBe("false");
  }, 60_000);

  it("N-6 · GESCHEITERTER Lauf: der Satz sagt es aus, statt zwei Löcher zu lassen", async () => {
    // JOB 3068 R2, bens Korrekturpflicht 1 — an der gebauten Fläche gemessen, nicht nur am Schlüssel.
    // Vor der Korrektur stand hier „Gegen  von  Einträgen im Bestand geprüft — der Lauf ist nicht
    // als vollständig belegt." (zwei leere Interpolationen).
    expect(fehler).toBeNull();
    const s = (stand as H4Stand).seite;
    await s.evaluate(
      fn(`(titel) => {
        const zeilen = [...document.querySelectorAll('[data-testid="bib-zeile"]')];
        const z = zeilen.find((e) => (e.textContent || '').includes(titel));
        if (z) z.click();
      }`),
      TITEL_GESCHEITERT,
    );
    await s.waitForFunction(
      fn(
        `(titel) => { const el = document.querySelector('[data-testid="bib-titel"]'); return !!el && el.textContent.trim() === titel; }`,
      ),
      TITEL_GESCHEITERT,
      { timeout: 20_000 },
    );
    await s.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="bib-deckungssatz"]')`),
      undefined,
      { timeout: 20_000 },
    );

    // Kalibrierung an der ECHTEN Route: der Server liefert hier wirklich `unvollstaendig` mit zwei
    // `null` — ohne diesen Beleg misst der Fall unten einen anderen Zustand, als er behauptet.
    const signal = await route<{ koId: string; deckung: unknown }[]>("/api/duplicate-signal");
    const koIdGescheitert = await s.evaluate<string>(
      fn(`() => location.pathname.replace('/wissen/', '')`),
    );
    expect(signal.find((b) => b.koId === koIdGescheitert)?.deckung).toEqual({
      lage: "unvollstaendig",
      geprueft: null,
      bestand: null,
    });

    const m = await messen();
    console.info(`JOB 3068 R2 · gescheiterter Lauf: ${JSON.stringify(m)}`);
    expect(m.titel).toBe(TITEL_GESCHEITERT);
    expect(m.deckungAnzahl).toBe(1);
    expect(m.deckungText).toBe(i18n.t("kollision.deckung.unvollstaendigOhneZahlen"));
    // Die drei Zusagen der Korrekturpflicht, an der gerenderten Fläche:
    expect(/\d/.test(m.deckungText), `keine Ziffer: „${m.deckungText}"`).toBe(false);
    expect(m.deckungText.includes("  "), `keine leere Stelle: „${m.deckungText}"`).toBe(false);
    expect(m.deckungText).toContain("Bestand");
    // Und es ist NICHT der Satz einer anderen Lage.
    expect(m.deckungText).not.toBe(
      i18n.t("kollision.deckung.unvollstaendig", { geprueft: 12, bestand: 40 }),
    );
    expect(m.deckungText).not.toBe(i18n.t("kollision.deckung.ohneProtokoll"));
    expect(m.deckungText).not.toBe(i18n.t("kollision.deckung.keinLauf"));
  }, 60_000);

  it("N-7 · die Zeile ist gültiges HTML — kein `<div>` in einem `<p>`", async () => {
    // bens Hinweis aus Runde 1: die gesperrte Fassung von `RoleLink` ist ein `<div>`
    // (`RoleLink.tsx:91-103`), und die Zeile stand in einem `<p>`. Der Browser schließt einen
    // Absatz vor einem `<div>` vorzeitig — die Zeile wäre auseinandergerissen worden, ohne dass
    // irgendein Fehler auffiele. Gemessen wird deshalb am gebauten DOM.
    expect(fehler).toBeNull();
    const m = await messen();
    expect(m.zeileTag).not.toBe("P");
    expect(m.zeileInP, "die Kollisionszeile steckt in einem Absatz").toBe(false);
    expect((stand as H4Stand).seitenfehler).toEqual([]);
  }, 60_000);
});

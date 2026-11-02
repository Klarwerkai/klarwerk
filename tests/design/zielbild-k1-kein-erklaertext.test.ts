// ================================================================================================
// JOB 3056 · K1 — KEIN ERKLAERTEXT IM SICHTFELD (Pedi 04.09.: „Text über Text über Text").
// ================================================================================================
//
// Der Textmesser: in Ruhe und Antwort ist die Summe aller SICHTBAREN Textknoten ausserhalb von
// Frage, Antwort, Quellen-Chips und Knopfbeschriftungen hoechstens 60 Zeichen — der eine Ruhe-
// Satz („Stell eine Frage oder markiere Text in Word.", 44 Zeichen) und der Titel „Klara".
// Gemessen wird der innerText der gebauten Flaeche (apps/web/dist/word-addin/taskpane.html) in
// Chromium (k1-messung.ts, ERKLAERTEXT_FN), nicht das Markup: ein per `hidden` versteckter Absatz
// zaehlt nicht, ein sichtbarer sehr wohl.
//
// RED-FIRST (§6): vor dem Umbau war dieser Test rot (Vertrauenskopf, Regelsatz, Anmeldezeile,
// Pruefhinweis, Hilfe-Karte: weit ueber 60 Zeichen). Gegenprobe: ein Hinweissatz in der Ruhe
// eingefuegt → rot (Rueckgabe).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ERKLAERTEXT_FN, type Flaeche, fn, frageStellen, leser, starteFlaeche } from "./k1-messung";

/** Was KEIN Erklaertext ist: Knopfbeschriftungen, das Frage-Feld, die Frage, die Antwort samt
 *  ihren Fussnotenziffern (Runde 4: <sup> am Textende, Main.dc.html Z.28), die Quellen-Chips, die
 *  Vorlese-Ueberschrift der Karte (1px, nur fuer Hilfstechnik). */
const AUSNAHMEN = [
  "button",
  "#ask-input",
  "#ask-frage-zeile-btn",
  "#ask-answer-edit",
  "#ask-fussnoten",
  "#ask-sources",
  ".nur-vorlesen",
  // JOB 3092 S6 (W5): die Herkunftszeilen („Quelle: Titel · Pruefstand · Version", je tragender
  // Quelle) und der Ungeprueft-Satz sind BELEGE zur Antwort wie die Chips — Pedis Vertrauensbotschaft
  // (M2), kein Erklaertext. Sie stehen nur im Antwortzustand und nur mit Datengrundlage.
  "#ask-herkunft",
  "#ask-ungeprueft",
];
const HOECHSTENS = 60;

interface Messung {
  text: string;
  zeichen: number;
  teile: string[];
}

let flaeche: Flaeche | null = null;
let fehler: string | null = null;
let ruhe: Messung | null = null;
let antwort: Messung | null = null;

describe("JOB 3056 · K1 · kein Erklaertext — innerText der gebauten Flaeche in Chromium", () => {
  beforeAll(async () => {
    try {
      flaeche = await starteFlaeche({ mitWissen: true });
      const l = leser(
        () => flaeche?.seite ?? null,
        () => null,
      );
      ruhe = await l.eval<Messung>(ERKLAERTEXT_FN, AUSNAHMEN);
      await frageStellen(flaeche.seite);
      antwort = await l.eval<Messung>(ERKLAERTEXT_FN, AUSNAHMEN);
      console.info(
        `JOB 3056 K1 Erklaertext · Ruhe ${ruhe.zeichen} Zeichen: „${ruhe.text}“ · Antwort ${antwort.zeichen} Zeichen: „${antwort.text}“`,
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 120_000);

  afterAll(async () => {
    await flaeche?.schliessen();
  }, 60_000);

  it("R · RUHE: hoechstens 60 Zeichen sichtbarer Text ausserhalb der Ausnahmen — der eine Satz und der Titel", () => {
    expect(fehler).toBeNull();
    expect(ruhe).not.toBeNull();
    const m = ruhe as Messung;
    expect(m.zeichen, `Sichtbarer Text in der Ruhe: „${m.text}“`).toBeLessThanOrEqual(HOECHSTENS);
    expect(m.teile).toContain("Stell eine Frage oder markiere Text in Word.");
    expect(m.teile).toContain("Klara");
    expect(flaeche?.seitenfehler).toEqual([]);
  });

  it("A · ANTWORT: hoechstens 60 Zeichen sichtbarer Text ausserhalb von Frage, Antwort, Chips und Knoepfen", () => {
    expect(fehler).toBeNull();
    expect(antwort).not.toBeNull();
    const m = antwort as Messung;
    expect(m.zeichen, `Sichtbarer Text in der Antwort: „${m.text}“`).toBeLessThanOrEqual(
      HOECHSTENS,
    );
    // Der Ruhe-Satz steht in der Antwort NICHT mehr; was bleibt, ist der Titel — und, NUR wenn der
    // Fall eintritt, der eine lagebezogene Satz unter der Karte (Lieferung 5).
    expect(m.teile).not.toContain("Stell eine Frage oder markiere Text in Word.");
    expect(m.teile).toContain("Klara");
  });

  it("K · KALIBRIERUNG: der Messer sieht sichtbaren Text wirklich — ein eingefuegter Hinweissatz in der Ruhe wuerde ihn ueber 60 heben", async () => {
    expect(fehler).toBeNull();
    const l = leser(
      () => flaeche?.seite ?? null,
      () => fehler,
    );
    // Zurueck in die Ruhe, dann einen Hinweissatz einhaengen (nur in dieser Seite, nicht im Produkt).
    const s = l.seite();
    const sichtbar = fn(`(selektor) => {
      const el = document.querySelector(selektor);
      if (!el || el.hidden) return false;
      const r = el.getBoundingClientRect();
      const stil = getComputedStyle(el);
      return stil.display !== 'none' && stil.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    }`);
    await s.waitForFunction(sichtbar, ".mini-menu-button", { timeout: 20_000 });
    await s.click(".mini-menu-button");
    await s.waitForFunction(sichtbar, "#mini-menu-new", { timeout: 20_000 });
    await s.click("#mini-menu-new");
    await s.waitForFunction(sichtbar, "#mini-page-new [data-mini-text=start]", { timeout: 20_000 });
    await s.click("#mini-page-new [data-mini-text=start]");
    await s.waitForFunction(
      fn(`() => {
        const neu = document.getElementById('mini-page-new');
        const home = document.querySelector('.mini-home');
        const input = document.getElementById('ask-input');
        const antwort = document.getElementById('ask-answer-block');
        const ruhe = document.getElementById('ask-ruhe');
        const sichtbar = (el) => {
          if (!el || el.hidden) return false;
          const r = el.getBoundingClientRect();
          const stil = getComputedStyle(el);
          return stil.display !== 'none' && stil.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        };
        return !!neu && neu.hidden && !sichtbar(neu) && sichtbar(home) && sichtbar(input) &&
          !!antwort && antwort.classList.contains('hidden') && !sichtbar(antwort) && sichtbar(ruhe);
      }`),
      undefined,
      { timeout: 30_000 },
    );
    const mit = await l.eval<Messung>(
      `(arg) => { const p = document.createElement('p'); p.id = 'sonde-hinweis'; p.textContent = 'Antworten kommen wörtlich aus validiertem KLARWERK-Wissen — bitte fachlich prüfen.'; document.getElementById('ask-ruhe').appendChild(p); const r = (${ERKLAERTEXT_FN})(arg); p.remove(); return r; }`,
      AUSNAHMEN,
    );
    expect(mit.zeichen).toBeGreaterThan(HOECHSTENS);
    const ohne = await l.eval<Messung>(ERKLAERTEXT_FN, AUSNAHMEN);
    expect(ohne.zeichen).toBeLessThanOrEqual(HOECHSTENS);
    // Und ein per `hidden` verborgener Satz zaehlt NICHT — der Messer misst Sichtbarkeit, nicht DOM.
    const versteckt = await l.eval<Messung>(
      `(arg) => { const p = document.createElement('p'); p.className = 'hidden'; p.textContent = 'Unsichtbarer Hinweis mit mehr als sechzig Zeichen Laenge, der nicht zaehlen darf.'; document.getElementById('ask-ruhe').appendChild(p); const r = (${ERKLAERTEXT_FN})(arg); p.remove(); return r; }`,
      AUSNAHMEN,
    );
    expect(versteckt.zeichen).toBe(ohne.zeichen);
  });
});

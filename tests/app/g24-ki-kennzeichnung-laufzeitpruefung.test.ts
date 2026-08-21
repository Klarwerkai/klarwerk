// G24 (OFFEN.md:159, mega83 B) — UNBEKANNT IST HIER NICHT FAIL-SAFE.
//
// DER BEFUND, woertlich aus OFFEN.md:159:
//   „Beide Clients normalisieren mit `Boolean(result.aiGenerated)` …, der echte Serververtrag ist
//    aber ein Objekt mit Aufgabe, Modus und Zeitpunkt (`model-runs/types.ts:69-87`). Fehlend und
//    `false` sind sicher — EIN UNERWARTETER WAHRER SKALAR ODER EIN BELIEBIGES OBJEKT SCHALTET DIE
//    KENNZEICHNUNG FAELSCHLICH EIN. Fix: eine gemeinsame reine Laufzeitpruefung, die nur ein Objekt
//    mit `aiGenerated === true` und gueltiger Aufgabe und gueltigem Modus anerkennt."
//
// Die Gefahr ist also EINSEITIG: nicht die verschwiegene, sondern die ERFUNDENE Behauptung. Ein
// Text, ueber den der Server nie gesagt hat, dass ein Modell ihn schrieb, traegt sonst den Satz
// „Von kuenstlicher Intelligenz erzeugt".
//
// DER ZWILLING IST DIE FALLE: dieselbe Normalisierung steht zweimal —
//   · `apps/web/src/lib/wordAddin.ts`            (importierbar)
//   · `apps/web/public/word-addin/taskpane.html` (buildlos, kann nicht importieren)
// Deshalb pruefen die Faelle unten BEIDE Fassungen gegen DIESELBE Tabelle, und die
// Fensterfassung wird nicht abgeschrieben, sondern aus der WIRKLICH AUSGELIEFERTEN Datei
// geschnitten und ausgefuehrt — dieselbe Bauform wie KW-KLARA-ASK-FETCH-* (mega79) und
// KW-KLARA-AI-NOTICE-* (mega81).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { istKiKennzeichnung } from "../../apps/web/src/lib/wordAddin";
import { KI_ERZEUGENDE_AUFGABEN, aiGeneratedMark } from "../../services/model-runs";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");

const M_START = "// KW-KLARA-AI-MARK-START";
const M_END = "// KW-KLARA-AI-MARK-END";

/** Die Fassung des Aufgabenfensters — geschnitten und ausgefuehrt, nicht gelesen. */
function fensterFassung(): (wert: unknown) => boolean {
  const start = HTML.indexOf(M_START);
  const end = HTML.indexOf(M_END);
  expect(
    start,
    `${TASKPANE}: ${M_START} fehlt — die Laufzeitpruefung ist nicht auffindbar`,
  ).toBeGreaterThan(0);
  expect(end, `${TASKPANE}: ${M_END} fehlt`).toBeGreaterThan(start);
  const block = HTML.slice(start, end);
  const factory = new Function(`${block} return istKiKennzeichnung;`);
  return factory() as (wert: unknown) => boolean;
}

// ------------------------------------------------------------------------------------------------
// DIE TABELLE. Links das, was der Server schicken koennte; rechts, ob die Kennzeichnung
// erscheinen DARF. Sie gilt fuer beide Fassungen — das ist der Sinn des Zwillings.
// ------------------------------------------------------------------------------------------------
const FAELLE: ReadonlyArray<{ was: string; wert: unknown; erwartet: boolean }> = [
  // --- die einzigen wahren Faelle: der echte Vertrag ------------------------------------------
  { was: "echte Marke, Modellweg", wert: aiGeneratedMark("answer", false), erwartet: true },
  { was: "echte Marke, det. Rueckfall", wert: aiGeneratedMark("answer", true), erwartet: true },
  { was: "echte Marke, describe", wert: aiGeneratedMark("describe", false), erwartet: true },
  { was: "echte Marke, interview", wert: aiGeneratedMark("interview", true), erwartet: true },

  // --- sicher schon vorher: fehlend und false --------------------------------------------------
  { was: "undefined", wert: undefined, erwartet: false },
  { was: "null", wert: null, erwartet: false },
  { was: "false", wert: false, erwartet: false },

  // --- DIE LUECKE AUS G24: alles hier war unter `Boolean(...)` WAHR ----------------------------
  { was: "leeres Objekt", wert: {}, erwartet: false },
  { was: "nackter Boolean true", wert: true, erwartet: false },
  { was: "Zahl 1", wert: 1, erwartet: false },
  { was: "Zeichenkette „nein“", wert: "nein", erwartet: false },
  { was: "Zeichenkette „false“", wert: "false", erwartet: false },
  { was: "leeres Feld", wert: [], erwartet: false },
  { was: "Objekt ohne aiGenerated", wert: { task: "answer", mode: "model" }, erwartet: false },
  {
    was: "aiGenerated nur wahrheitsaehnlich",
    wert: { aiGenerated: "ja", task: "answer", mode: "model" },
    erwartet: false,
  },
  {
    was: "unbekannte Aufgabe",
    wert: { aiGenerated: true, task: "uebersetzen", mode: "model" },
    erwartet: false,
  },
  {
    was: "unbekannter Modus",
    wert: { aiGenerated: true, task: "answer", mode: "cloud" },
    erwartet: false,
  },
  { was: "Aufgabe fehlt", wert: { aiGenerated: true, mode: "model" }, erwartet: false },
  { was: "Modus fehlt", wert: { aiGenerated: true, task: "answer" }, erwartet: false },
];

// ================================================================================================
describe("G24 · die KI-Kennzeichnung wird geprueft, nicht gecastet", () => {
  it("G24-1 · die Modulfassung erkennt genau den Serververtrag an", () => {
    for (const fall of FAELLE) {
      expect(istKiKennzeichnung(fall.wert), `wordAddin.ts · ${fall.was}`).toBe(fall.erwartet);
    }
  });

  it("G24-2 · die AUSGELIEFERTE Fensterfassung urteilt identisch", () => {
    const imFenster = fensterFassung();
    for (const fall of FAELLE) {
      expect(imFenster(fall.wert), `taskpane.html · ${fall.was}`).toBe(fall.erwartet);
    }
  });

  it("G24-3 · KALIBRIERUNG: `Boolean(...)` haette bei sieben dieser Faelle FAELSCHLICH wahr gesagt", () => {
    // Ohne diesen Fall waere das Gruen oben wertlos: es koennte auch davon kommen, dass die
    // Tabelle nur harmlose Faelle enthaelt. Hier steht, WIE VIELE davon die alte Fassung
    // wirklich falsch beantwortet haette — und welche.
    const alteFassung = (wert: unknown): boolean => Boolean(wert);
    const falschEin = FAELLE.filter((f) => !f.erwartet && alteFassung(f.wert)).map((f) => f.was);
    expect(falschEin).toEqual([
      "leeres Objekt",
      "nackter Boolean true",
      "Zahl 1",
      "Zeichenkette „nein“",
      "Zeichenkette „false“",
      "leeres Feld",
      "Objekt ohne aiGenerated",
      "aiGenerated nur wahrheitsaehnlich",
      "unbekannte Aufgabe",
      "unbekannter Modus",
      "Aufgabe fehlt",
      "Modus fehlt",
    ]);
    // Und die Gegenrichtung: die neue Fassung nimmt KEINEN Fall weg, den die alte richtig hatte.
    const verloren = FAELLE.filter((f) => f.erwartet && !alteFassung(f.wert));
    expect(verloren, "die Pruefung ist schwaecher geworden statt strenger").toEqual([]);
  });

  it("G24-4 · die gespiegelten Mengen stimmen mit dem Original ueberein", () => {
    // Die Oberflaeche importiert keine Services (Modulgrenze), also stehen die beiden Mengen
    // zweimal. Dieser Fall haelt die Spiegelung gegen das Original — driftet `KI_ERZEUGENDE_
    // AUFGABEN`, wird er rot statt still falsch.
    for (const aufgabe of KI_ERZEUGENDE_AUFGABEN) {
      expect(
        istKiKennzeichnung({ aiGenerated: true, task: aufgabe, mode: "model" }),
        `die Aufgabe „${aufgabe}“ steht im Original, wird von der Oberflaeche aber nicht anerkannt`,
      ).toBe(true);
    }
    // Beide Modi des Originals (`AiOutputMode`) werden anerkannt.
    for (const modus of ["model", "deterministic"]) {
      expect(istKiKennzeichnung({ aiGenerated: true, task: "answer", mode: modus })).toBe(true);
    }
  });

  it("G24-5 · beide Zwillingsstellen benutzen die Pruefung — `Boolean(` steht an keiner mehr", () => {
    const modul = readFileSync(resolve(process.cwd(), "apps/web/src/lib/wordAddin.ts"), "utf8");
    expect(modul).toContain("aiGenerated: istKiKennzeichnung(result.aiGenerated)");
    expect(modul, "die alte Castung steht noch im Modul").not.toContain(
      "aiGenerated: Boolean(result.aiGenerated)",
    );
    expect(HTML).toContain("aiGenerated: istKiKennzeichnung(result.aiGenerated)");
    expect(HTML, "die alte Castung steht noch im Aufgabenfenster").not.toContain(
      "aiGenerated: Boolean(result.aiGenerated)",
    );
  });
});

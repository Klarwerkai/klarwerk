// @vitest-environment jsdom
// ================================================================================================
// JOB 3281 · WORD-VERGLEICH — GLEICHER TEXT IST NICHT DERSELBE ABSATZ.
// ================================================================================================
//
// Bens Messung vom 08.09. (Runde 1, ROT) steht hier als Test. Vier Faelle, die der Text-Hash
// allein nicht traegt, plus die zwei Fehlerpfade, die niemand ausgefuehrt hatte:
//
//   E1  Zwei WOERTLICH GLEICHE Absaetze sind ZWEI Posten. Vorher wurden sie zu einem
//       zusammengefasst — nach „Markierungen entfernen" blieb der zweite gefaerbt zurueck.
//   E2  Traegt das ERSTE Vorkommen eine fremde Hervorhebung und das zweite nicht, gehoert Klaras
//       Farbe an das ZWEITE. Vorher lief der Farbauftrag auf das erstbeste Vorkommen — und
//       ueberschrieb genau die fremde Arbeit, die er schuetzen sollte.
//   E3  „Im Dokument zeigen" springt zum EIGENEN Vorkommen, nicht immer zum ersten.
//   E4  Faerbt ein MENSCH nach dem Lauf um, bleibt seine Farbe. Klara nimmt nur zurueck, was
//       nachweislich noch ihre eigene Farbe traegt.
//   E5  Dasselbe WAEHREND des Laufs (zwischen Lesen und Faerben): nicht ueberfaerbt, mit Hinweis.
//   E6  Scheitert der abschliessende Schreiblauf, wird NICHTS gemerkt — sonst boete das Panel eine
//       Ruecknahme fuer Farben an, die nie im Dokument standen.
//   E7  Verschwindet eines von zwei gleichen Vorkommen, wird das ueberlebende zurueckgestellt und
//       das andere als „veraendert" gemeldet — nichts wird doppelt entfaerbt.
//
// Gemessen wird am ausgelieferten Panel (`tests/word-vergleich/word-buehne.ts`), nicht an einer
// Attrappe: die Einstufung faellt im Panel, die Farben stehen im nachgebauten Word-Host.
import { afterEach, describe, expect, it } from "vitest";
import type { FakeReplyInit, KlaraPanel } from "../app/klara-panel-fixture";
import { reply } from "../app/klara-panel-fixture";
import { createWordBuehne, starteMitWord } from "./word-buehne";

/** Derselbe Wortlaut zweimal im Dokument — der Fall, um den es hier geht. */
const GLEICH =
  "Die neue Absauganlage an Linie 7 wird jeden Freitag von der Fruehschicht durchgesehen.";
const ANDERS =
  "Vor jeder Wartung an der Presse P2 ist der Hauptschalter abzuschliessen und der Druck " +
  "abzubauen.";

function leereAntwort(): Record<string, unknown> {
  return {
    duplicates: [],
    conflicts: [],
    konfliktpruefung: { gelaufen: false, grund: "nicht_angefordert" },
    answer: null,
    note: null,
    persisted: false,
    sourceHits: [],
    sourceHitsTruncated: false,
    quellenfund: { gelaufen: true, grund: null, geprueft: 2 },
  };
}

/** Jeder Absatz kommt als „kein Fund" zurueck — eine Farbe, an der die Zuordnung ablesbar ist. */
const ALLES_NEU: Record<string, FakeReplyInit> = {
  "/api/check-text": reply(200, leereAntwort()),
};

let panel: KlaraPanel | null = null;

afterEach(() => {
  panel?.restore();
  panel = null;
});

async function pruefe(p: KlaraPanel): Promise<void> {
  await p.flush();
  const knopf = p.q("#wv-btn");
  expect(knopf, "der Knopf „Dokument pruefen“ fehlt").not.toBeNull();
  (knopf as { click(): void }).click();
  for (let i = 0; i < 12; i += 1) {
    await p.flush();
  }
}

async function entferne(p: KlaraPanel): Promise<void> {
  const knopf = p.q("#wv-entfernen");
  expect(knopf, "der Knopf „Markierungen entfernen“ fehlt").not.toBeNull();
  (knopf as { click(): void }).click();
  for (let i = 0; i < 8; i += 1) {
    await p.flush();
  }
}

async function springe(p: KlaraPanel, nr: number): Promise<void> {
  const knopf = p.q(`[data-wv-sprung="${nr}"]`);
  expect(knopf, `der Sprungknopf zu Absatz ${nr} fehlt`).not.toBeNull();
  (knopf as { click(): void }).click();
  for (let i = 0; i < 6; i += 1) {
    await p.flush();
  }
}

describe("JOB 3281 · (e) Vorkommen statt Text-Hash, fremde Farben unangetastet", () => {
  it("E1 · zwei gleiche Absaetze sind zwei Posten — beide werden gefaerbt UND beide zurueckgenommen", async () => {
    const buehne = createWordBuehne([{ text: GLEICH }, { text: GLEICH }]);
    panel = starteMitWord(ALLES_NEU, buehne);
    await pruefe(panel);
    expect(buehne.farben()).toEqual(["Turquoise", "Turquoise"]);
    // Beide Vorkommen stehen einzeln in der Liste, mit eigener Absatznummer.
    expect(panel.text("#wv-liste")).toContain("Absatz 1");
    expect(panel.text("#wv-liste")).toContain("Absatz 2");

    await entferne(panel);
    // Der Fehler der Runde 1: hier blieb ["Turquoise"] am zweiten Vorkommen stehen.
    expect(buehne.farben()).toEqual([null, null]);
    expect(panel.text("#wv-stand")).toContain("2 Markierungen zurückgenommen");
  });

  it("E2 · traegt das erste Vorkommen eine fremde Farbe, faerbt Klara das ZWEITE", async () => {
    const buehne = createWordBuehne([{ text: GLEICH, highlightColor: "Pink" }, { text: GLEICH }]);
    panel = starteMitWord(ALLES_NEU, buehne);
    await pruefe(panel);
    // Der Fehler der Runde 1: ["Turquoise", null] — die fremde Hervorhebung war ueberschrieben.
    expect(buehne.farben()).toEqual(["Pink", "Turquoise"]);
    expect(panel.text("#wv-liste")).toContain(
      "Der Absatz trägt bereits eine eigene Hervorhebung — Klara hat sie nicht überschrieben.",
    );

    // Und die Ruecknahme fasst weiterhin nur das an, was Klara selbst gefaerbt hat.
    await entferne(panel);
    expect(buehne.farben()).toEqual(["Pink", null]);
  });

  it("E3 · „Im Dokument zeigen“ trifft das eigene Vorkommen, nicht immer das erste", async () => {
    const buehne = createWordBuehne([{ text: GLEICH }, { text: GLEICH }, { text: ANDERS }]);
    panel = starteMitWord(ALLES_NEU, buehne);
    await pruefe(panel);

    await springe(panel, 2);
    // Der Fehler der Runde 1: der Sprung landete auf Absatz 1 (Index 0).
    expect(buehne.mitschrift.gewaehlt).toEqual([1]);
    await springe(panel, 1);
    expect(buehne.mitschrift.gewaehlt).toEqual([1, 0]);
    await springe(panel, 3);
    expect(buehne.mitschrift.gewaehlt).toEqual([1, 0, 2]);
  });

  it("E4 · eine NACH dem Lauf von Hand gesetzte Farbe ueberlebt „Markierungen entfernen“", async () => {
    const buehne = createWordBuehne([{ text: GLEICH }, { text: ANDERS }]);
    panel = starteMitWord(ALLES_NEU, buehne);
    await pruefe(panel);
    expect(buehne.farben()).toEqual(["Turquoise", "Turquoise"]);

    // Der Mensch entscheidet anders und markiert den ersten Absatz selbst.
    buehne.faerbe(0, "Pink");
    await entferne(panel);
    // Der Fehler der Runde 1: [null] — Klara loeschte die Handarbeit des Menschen.
    expect(buehne.farben()).toEqual(["Pink", null]);
    expect(panel.text("#wv-stand")).toContain("1 Markierungen zurückgenommen");
    expect(panel.text("#wv-stand")).toContain(
      "1 Absätze tragen inzwischen eine andere Hervorhebung",
    );
  });

  it("E5 · eine WAEHREND des Laufs gesetzte Farbe wird nicht ueberfaerbt, sondern gemeldet", async () => {
    const buehne = createWordBuehne([{ text: GLEICH }, { text: ANDERS }]);
    let gefragt = 0;
    panel = starteMitWord(
      {
        "/api/check-text": (): FakeReplyInit => {
          gefragt += 1;
          // Zwischen Lesen und Faerben greift der Mensch ein.
          if (gefragt === 1) {
            buehne.faerbe(0, "Pink");
          }
          return reply(200, leereAntwort());
        },
      },
      buehne,
    );
    await pruefe(panel);
    expect(gefragt).toBe(2);
    expect(buehne.farben()).toEqual(["Pink", "Turquoise"]);
    expect(panel.text("#wv-liste")).toContain(
      "Der Absatz trägt bereits eine eigene Hervorhebung — Klara hat sie nicht überschrieben.",
    );

    // Nur der eine gefaerbte Absatz ist Klaras — die Ruecknahme laesst Rosa stehen.
    await entferne(panel);
    expect(buehne.farben()).toEqual(["Pink", null]);
  });

  it("E6 · scheitert der Schreiblauf, wird nichts gemerkt und nichts behauptet", async () => {
    // Lauf 1 liest die Absaetze, Lauf 2 soll faerben — und scheitert.
    const buehne = createWordBuehne([{ text: GLEICH }, { text: ANDERS }], { wirftAbLauf: 2 });
    panel = starteMitWord(ALLES_NEU, buehne);
    await pruefe(panel);
    expect(buehne.farben()).toEqual([null, null]);
    expect(panel.text("#wv-stand")).toContain(
      "Die Farben konnten nicht ins Dokument geschrieben werden",
    );
    // Kein Ruecknahmeknopf fuer Farben, die nie gesetzt wurden — und keine Legende dazu.
    expect(panel.q("#wv-entfernen")?.className.includes("hidden")).toBe(true);
    expect(panel.text("#wv-legende")).toBe("");
    // Der BEFUND steht trotzdem da — die Prüfung selbst ist gelaufen.
    expect(panel.text("#wv-liste")).toContain("Kein Fund im durchsuchten Bestand");
  });

  it("E7 · verschwindet eines von zwei gleichen Vorkommen, wird nur das ueberlebende zurueckgestellt", async () => {
    const buehne = createWordBuehne([{ text: GLEICH }, { text: GLEICH }]);
    panel = starteMitWord(ALLES_NEU, buehne);
    await pruefe(panel);
    expect(buehne.farben()).toEqual(["Turquoise", "Turquoise"]);

    buehne.entferne(1);
    await entferne(panel);
    expect(buehne.farben()).toEqual([null]);
    expect(panel.text("#wv-stand")).toContain("1 Markierungen zurückgenommen");
    expect(panel.text("#wv-stand")).toContain("1 Absätze haben sich seither verändert");
    // Der nicht wiedergefundene Posten bleibt stehen — seine Ursprungsfarbe geht nicht verloren.
    expect(panel.q("#wv-entfernen")?.className.includes("hidden")).toBe(false);
  });
});

// @vitest-environment jsdom
// ================================================================================================
// JOB 3281 · WORD-VERGLEICH — DIE MERKLISTE: KLARA NIMMT NUR IHRE EIGENEN FARBEN ZURUECK.
// ================================================================================================
//
// Codex' Nachfuehrung vom 08.09. (verbindlich) steht hier als Messung:
//   · Eine VORHANDENE Hervorhebung wird weder ueberschrieben noch verloren. Der Absatz wird
//     trotzdem im Panel eingestuft — mit Hinweis, nicht mit Farbe.
//   · „Markierungen entfernen" stellt die URSPRUNGSFARBE wieder her, nicht „keine Farbe".
//   · Die Merkliste haengt am TEXT-HASH, nicht an der Absatznummer: verschiebt sich ein Absatz,
//     findet die Ruecknahme ihn trotzdem; aendert sich sein Text, wird NICHTS blind entfaerbt —
//     der Posten wird als „veraendert" gemeldet.
import { afterEach, describe, expect, it } from "vitest";
import type { FakeReplyInit, KlaraPanel } from "../app/klara-panel-fixture";
import { reply } from "../app/klara-panel-fixture";
import { type WordBuehne, createWordBuehne, starteMitWord } from "./word-buehne";

const A =
  "Vor jeder Wartung an der Presse P2 ist der Hauptschalter abzuschliessen und der Druck " +
  "abzubauen.";
const B = "Die neue Absauganlage an Linie 7 wird jeden Freitag von der Fruehschicht durchgesehen.";
const C = "Der Gabelstapler wird vor Schichtbeginn auf Bremsen, Hupe und Hubkette angesehen.";

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

/** Jeder Absatz kommt als „kein Fund" zurueck — dann faerbt der Weg alles Tuerkis, und die
 *  Ruecknahme ist an EINER Farbe messbar. Um die Einstufung geht es hier nicht. */
const ALLES_NEU: Record<string, FakeReplyInit> = {
  "/api/check-text": reply(200, leereAntwort()),
};

let panel: KlaraPanel | null = null;

function starte(buehne: WordBuehne): KlaraPanel {
  panel = starteMitWord(ALLES_NEU, buehne);
  return panel;
}

async function pruefe(p: KlaraPanel): Promise<void> {
  await p.flush();
  const knopf = p.q("#wv-btn");
  expect(knopf, "der Knopf „Dokument pruefen“ fehlt").not.toBeNull();
  (knopf as { click(): void }).click();
  for (let i = 0; i < 10; i += 1) {
    await p.flush();
  }
}

async function entferne(p: KlaraPanel): Promise<void> {
  const knopf = p.q("#wv-entfernen");
  expect(knopf, "der Knopf „Markierungen entfernen“ fehlt").not.toBeNull();
  (knopf as { click(): void }).click();
  for (let i = 0; i < 6; i += 1) {
    await p.flush();
  }
}

afterEach(() => {
  panel?.restore();
  panel = null;
});

describe("JOB 3281 · (d) Ruecknahme nimmt nur Klaras eigene Farben", () => {
  it("D1 · eine FREMDE Hervorhebung wird nicht ueberfaerbt — der Absatz steht trotzdem in der Liste", async () => {
    const buehne = createWordBuehne([{ text: A, highlightColor: "Pink" }, { text: B }]);
    const p = starte(buehne);
    await pruefe(p);
    // Die fremde Farbe bleibt Ziffer fuer Ziffer stehen; nur der freie Absatz bekommt Klaras Farbe.
    expect(buehne.farben()).toEqual(["Pink", "Turquoise"]);
    expect(p.text("#wv-liste")).toContain(
      "Der Absatz trägt bereits eine eigene Hervorhebung — Klara hat sie nicht überschrieben.",
    );
    // Und er ist trotzdem eingestuft — der Hinweis ersetzt die Aussage nicht.
    expect(p.text("#wv-liste")).toContain("Kein Fund im durchsuchten Bestand");
  });

  it("D2 · „Markierungen entfernen“ stellt die URSPRUNGSFARBE wieder her, nicht „keine Farbe“", async () => {
    // Der zweite Absatz trug vor dem Lauf schon „Gray25" — aber von einem FRUEHEREN Klara-Lauf
    // weiss das Panel nichts; hier geht es um den Fall, den Codex benannt hat: ein Absatz OHNE
    // fremde Farbe wird gefaerbt und muss danach wieder farblos sein, waehrend ein Absatz MIT
    // fremder Farbe nie angefasst wurde und sie behaelt.
    const buehne = createWordBuehne([
      { text: A, highlightColor: "Gray25" },
      { text: B },
      { text: C },
    ]);
    const p = starte(buehne);
    await pruefe(p);
    expect(buehne.farben()).toEqual(["Gray25", "Turquoise", "Turquoise"]);

    // Vor der Ruecknahme erklaert die Legende die Farben, die WIRKLICH im Dokument stehen.
    expect(p.text("#wv-legende")).toContain("Türkis");

    await entferne(p);
    expect(buehne.farben()).toEqual(["Gray25", null, null]);
    expect(p.text("#wv-stand")).toContain("2 Markierungen zurückgenommen");
    // Danach steht keine Farbe von Klara mehr im Dokument — also erklaert die Legende nichts mehr,
    // und keine Zeile behauptet eine Farbe, die niemand sieht. Der BEFUND bleibt sichtbar.
    expect(p.text("#wv-legende")).toBe("");
    expect(p.text("#wv-liste")).not.toContain("Türkis");
    expect(p.text("#wv-liste")).toContain("Kein Fund im durchsuchten Bestand");
  });

  it("D3 · ohne eigenen Lauf gibt es nichts zurueckzunehmen — und Klara sagt genau das", async () => {
    const buehne = createWordBuehne([{ text: A, highlightColor: "Pink" }]);
    const p = starte(buehne);
    await p.flush();
    // Der Knopf steht erst da, wenn Klara wirklich etwas gefaerbt hat.
    expect(p.q("#wv-entfernen")?.className.includes("hidden")).toBe(true);
    await pruefe(p);
    // Nur der fremd markierte Absatz — Klara hat nichts gefaerbt, also bleibt der Knopf weg.
    expect(buehne.farben()).toEqual(["Pink"]);
    expect(p.q("#wv-entfernen")?.className.includes("hidden")).toBe(true);
  });

  it("D4 · ein VERSCHOBENER Absatz wird ueber den Text-Hash wiedergefunden", async () => {
    const buehne = createWordBuehne([{ text: A }, { text: B }, { text: C }]);
    const p = starte(buehne);
    await pruefe(p);
    expect(buehne.farben()).toEqual(["Turquoise", "Turquoise", "Turquoise"]);

    // Der Mensch loescht den ersten Absatz: alle Nummern verschieben sich um eins.
    buehne.entferne(0);
    await entferne(p);
    expect(buehne.farben()).toEqual([null, null]);
    expect(p.text("#wv-stand")).toContain("2 Markierungen zurückgenommen");
    expect(p.text("#wv-stand")).toContain("1 Absätze haben sich seither verändert");
  });

  it("D5 · ein GEAENDERTER Absatz wird NICHT blind entfaerbt, sondern gemeldet", async () => {
    const buehne = createWordBuehne([{ text: A }, { text: B }]);
    const p = starte(buehne);
    await pruefe(p);
    expect(buehne.farben()).toEqual(["Turquoise", "Turquoise"]);

    buehne.aendere(1, "Ein voellig anderer Satz steht jetzt an dieser Stelle im Dokument.");
    await entferne(p);
    // Der unveraenderte Absatz ist zurueckgesetzt, der veraenderte bleibt unangetastet.
    expect(buehne.farben()).toEqual([null, "Turquoise"]);
    expect(p.text("#wv-stand")).toContain("1 Markierungen zurückgenommen");
    expect(p.text("#wv-stand")).toContain("1 Absätze haben sich seither verändert");
    // Und der Posten bleibt in der Merkliste — der Knopf verschwindet nicht.
    expect(p.q("#wv-entfernen")?.className.includes("hidden")).toBe(false);
  });

  it("D6 · ein zweiter Lauf haelt die URSPRUNGSFARBE fest, nicht Klaras eigene vom ersten Lauf", async () => {
    const buehne = createWordBuehne([{ text: A, highlightColor: null }]);
    const p = starte(buehne);
    await pruefe(p);
    expect(buehne.farben()).toEqual(["Turquoise"]);
    // Zweiter Lauf: der Absatz traegt jetzt Klaras Farbe. Wuerde sie als „Ursprung" gemerkt,
    // liesse „entfernen" sie fuer immer stehen.
    await pruefe(p);
    expect(buehne.farben()).toEqual(["Turquoise"]);
    await entferne(p);
    expect(buehne.farben()).toEqual([null]);
  });
});

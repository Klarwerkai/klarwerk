// @vitest-environment jsdom
// ================================================================================================
// JOB 3064 · KORREKTURPFLICHT 2 (Ben, Runde 6) — DER VERTRAG ZWISCHEN REASONER UND FLAECHE.
// ================================================================================================
//
// BENS BEFUND an Runde 6:
//   „Der Reasoner erkennt `[1, 2]` ausdrücklich als Quellen 1 und 2 … In der Antwortkarte erreicht
//    diese gültige Ausgabe den Nutzer als unformatierter Klammertext."
// Und seine Korrekturpflicht 2:
//   „Eine Vertragsregression ergänzen, die dieselben Zitierbeispiele durch Reasoner-Erkennung und
//    UI-Rendering führt."
//
// ------------------------------------------------------------------------------------------------
// WAS HIER GEMESSEN WIRD — UND WARUM ES EIN EIGENER FALL IST.
// ------------------------------------------------------------------------------------------------
// Die zwei Seiten sind zwei Programme in zwei Welten: `citedSourceIds`
// (`services/reasoner/src/provider-model.ts`) entscheidet, WELCHE Quellen eine Antwort trägt;
// `markiereFussnoten` (`apps/web/src/lib/answerMarkdown.ts`) entscheidet, WELCHE Ziffern der Mensch
// hochgestellt sieht. Beide lesen denselben Antworttext, und bis Runde 6 lasen sie ihn
// VERSCHIEDEN. Genau diese Differenz war Bens Befund — und sie war unsichtbar, weil kein Fall
// beide Seiten am selben Beispiel geprüft hat.
//
// DIE BEISPIELE SIND NICHT ERFUNDEN: sie stammen aus dem Bestandstest des Reasoners
// (`tests/ask/mega52-tragende-quellen.test.ts`, „erfasst einzelne, mehrfache und kommagetrennte
// Marken" sowie „A5: eine Nummer ausserhalb der Liste wird VERWORFEN"). Wer dort eine Form
// hinzufügt, ohne sie hier einzutragen, wird von V3 unten rot gemacht.
//
// GEMESSEN WIRD DREIFACH, damit kein Glied der Kette fehlt:
//   V1  Reasoner-Erkennung  → welche Quellen bindet `citedSourceIds`?
//   V2  Zerlegung der Flaeche → welche Ziffern bindet `markiereFussnoten` als Marke?
//   V3  gerendertes DOM      → was sieht der Mensch wirklich in der echten Antwortkarte?
// Die Zusage ist die Gleichheit von V1 und V2 — und dass V3 sie zeigt. V3 ist dabei der HÄRTERE
// Fall, seit Runde 9: nur er läuft durch `parseAnswerMarkdown` und damit durch die Blockbildung,
// an der die Runde 8 gescheitert ist. V9 fährt denselben Weg mit einem generierten Korpus.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 8 — DIE GEMISCHTE GRUPPE (Bens Korrekturpflicht 1 und 2 an Runde 7).
// ------------------------------------------------------------------------------------------------
// Runde 7 prüfte neun SAUBERE Schreibweisen und übersah damit die ganze Fehlerklasse, die Ben dann
// von Hand fand: eine Gruppe aus gültigen UND ungültigen Teilen. `[1, 9]` band im Reasoner Quelle 1
// und erzeugte in der Fläche NULL Marken. Deshalb tragen die Formen jetzt zwei Felder statt einem:
//   `erwartet`    — die Quellenmenge, die BEIDE Seiten binden müssen.
//   `ohneMarken`  — der Text, der übrig bleibt, wenn man die Marken aus dem DOM herausnimmt.
// Das zweite Feld ist die eigentliche Neuerung: es misst, dass ein ungültiger Teil WÖRTLICH stehen
// bleibt („[, 9]." — die 9 ist noch da) statt still zu verschwinden. Eine Fläche, die eine Ziffer
// unterschlägt, um die Klammer loszuwerden, wird hier rot; eine, die eine gültige Ziffer nicht
// auszeichnet, wird von `erwartet` rot.
import { describe, expect, it } from "vitest";

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { AntwortText } from "../../apps/web/src/components/start/AntwortText";
import { markiereFussnoten, splitMarken } from "../../apps/web/src/lib/answerMarkdown";
import { citedSourceIds } from "../../services/reasoner/src/provider-model";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Die Zerlegung der Fläche, GENAU so zusammengesetzt wie im Renderer: erst die Marken binden, dann
 * die Platzhalter auflösen. Ein bequemes `splitFussnoten`, das beides in einem tat, gab es bis
 * Runde 8 — es ist entfernt, weil zwischen die beiden Schritte `parseAnswerMarkdown` gehört und ein
 * Test, der daran vorbeimisst, genau Bens Befund verdeckt hat.
 */
function zerlege(text: string, quellen: number = QUELLEN.length) {
  const { text: markiert, zeichen } = markiereFussnoten(text, quellen);
  return splitMarken(markiert, zeichen);
}

/** Drei Quellen — dieselbe Zahl wie im Bestandstest des Reasoners. */
const QUELLEN = [
  { id: "A", title: "Erste", statement: "Aussage A" },
  { id: "B", title: "Zweite", statement: "Aussage B" },
  { id: "C", title: "Dritte", statement: "Aussage C" },
] as const;

const NUMMER: Record<string, number> = { A: 1, B: 2, C: 3 };

/**
 * DIE ZITIERFORMEN. `erwartet` sind die Quellen-NUMMERN, die beide Seiten binden müssen —
 * hergeleitet aus der Regel des Reasoners, nicht aus dem heutigen Verhalten der Fläche.
 * `ohneMarken` ist der Text, der nach dem Entfernen aller Marken übrig bleibt: bei einer sauberen
 * Gruppe verschwindet die Klammer mitsamt Kommas, bei einer gemischten bleibt sie wörtlich stehen.
 */
const FORMEN: Array<{
  name: string;
  text: string;
  erwartet: number[];
  ohneMarken: string;
  /** Nur dort nötig, wo der Blockparser den Resttext anders formt als der rohe Text. */
  ohneMarkenDom?: string;
}> = [
  { name: "[1] — eine Quelle", text: "Das gilt [1].", erwartet: [1], ohneMarken: "Das gilt ." },
  {
    name: "[2][3] — zwei Gruppen",
    text: "Das gilt [2][3].",
    erwartet: [2, 3],
    ohneMarken: "Das gilt .",
  },
  {
    name: "[1, 2] — eine Gruppe, zwei Quellen",
    text: "Das gilt [1, 2].",
    erwartet: [1, 2],
    ohneMarken: "Das gilt .",
  },
  {
    name: "[ 1 , 2 ] — mit Leerraum",
    text: "Das gilt [ 1 , 2 ].",
    erwartet: [1, 2],
    ohneMarken: "Das gilt .",
  },
  {
    name: "**fett [1]** — in der Auszeichnung",
    text: "**Das gilt [1].**",
    erwartet: [1],
    ohneMarken: "Das gilt .",
  },
  {
    name: "*kursiv [2]* — in der Auszeichnung",
    text: "*Das gilt [2].*",
    erwartet: [2],
    ohneMarken: "Das gilt .",
  },
  {
    name: "ohne Marke",
    text: "Eine Antwort ganz ohne Verweis.",
    erwartet: [],
    ohneMarken: "Eine Antwort ganz ohne Verweis.",
  },
  {
    name: "[9] — ausserhalb der Liste",
    text: "Das gilt [9].",
    erwartet: [],
    ohneMarken: "Das gilt [9].",
  },
  {
    name: "[ohne Zahl]",
    text: "Klammern [ohne Zahl] zaehlen nicht.",
    erwartet: [],
    ohneMarken: "Klammern [ohne Zahl] zaehlen nicht.",
  },
  // ---- Bens Gegenbeispiele aus Runde 7: gültig UND ungültig in EINER Gruppe. ------------------
  {
    name: "[1, 9] — gemischt: 1 wird Marke, die 9 bleibt stehen",
    text: "Das gilt [1, 9].",
    erwartet: [1],
    ohneMarken: "Das gilt [, 9].",
  },
  {
    name: "[1,9] — gemischt ohne Leerzeichen",
    text: "Das gilt [1,9].",
    erwartet: [1],
    ohneMarken: "Das gilt [,9].",
  },
  {
    name: "[1,,2] — leerer Teil zwischen zwei Quellen",
    text: "Das gilt [1,,2].",
    erwartet: [1, 2],
    ohneMarken: "Das gilt .",
  },
  {
    name: "[1,] — nachgestelltes Komma",
    text: "Das gilt [1,].",
    erwartet: [1],
    ohneMarken: "Das gilt .",
  },
  {
    name: "[1 2] — zwei Zahlen ohne Komma (der Reasoner liest nur die erste)",
    text: "Das gilt [1 2].",
    erwartet: [1],
    ohneMarken: "Das gilt [ 2].",
  },
  {
    name: "[0, 2] — ungültige Null vor gültiger Quelle",
    text: "Das gilt [0, 2].",
    erwartet: [2],
    ohneMarken: "Das gilt [0, ].",
  },
  {
    name: "[9, 12] — nur ungültige Teile: die Gruppe bleibt ganz",
    text: "Das gilt [9, 12].",
    erwartet: [],
    ohneMarken: "Das gilt [9, 12].",
  },
  // ---- Bens Gegenbeispiele aus Runde 8: die Gruppe überschreitet eine BLOCKGRENZE. -------------
  // `\s` in der Reasoner-Regel ist auch Tabulator und Zeilenumbruch. Der Renderer bildet aber
  // Absätze, Überschriften und Listen — bis Runde 8 zerriss diese Blockbildung die Gruppe, bevor
  // die Marke gebunden war. `ohneMarkenDom` steht dort, wo der Blockparser den Resttext anders
  // formt als der rohe Text: er verbindet die Zeilen eines Absatzes mit einem Leerzeichen und
  // verzehrt die Blockzeichen („## ", „- ").
  {
    name: "[1,\\t2] — Tabulator in der Gruppe",
    text: "Das gilt [1,\t2].",
    erwartet: [1, 2],
    ohneMarken: "Das gilt .",
  },
  {
    name: "[1,\\n2] — Zeilenumbruch in der Gruppe",
    text: "Das gilt [1,\n2].",
    erwartet: [1, 2],
    ohneMarken: "Das gilt .",
  },
  {
    name: "[1,\\r\\n2] — CR/LF in der Gruppe",
    text: "Das gilt [1,\r\n2].",
    erwartet: [1, 2],
    ohneMarken: "Das gilt .",
  },
  {
    name: "[1,\\n\\n2] — LEERZEILE in der Gruppe (Absatzgrenze)",
    text: "Das gilt [1,\n\n2].",
    erwartet: [1, 2],
    ohneMarken: "Das gilt .",
  },
  {
    name: "## Überschrift mit [1,\\n2] — Überschriftengrenze",
    text: "## Hinweis [1,\n2].",
    erwartet: [1, 2],
    ohneMarken: "## Hinweis .",
    ohneMarkenDom: "Hinweis .",
  },
  {
    name: "- Listenpunkt mit [1,\\n2] — Listengrenze",
    text: "- Hinweis [1,\n2].",
    erwartet: [1, 2],
    ohneMarken: "- Hinweis .",
    ohneMarkenDom: "Hinweis .",
  },
  {
    name: "[1,\\n9] — gemischt ÜBER eine Zeile: 1 wird Marke, die 9 bleibt stehen",
    text: "Das gilt [1,\n9].",
    erwartet: [1],
    ohneMarken: "Das gilt [,\n9].",
    ohneMarkenDom: "Das gilt [, 9].",
  },
  {
    name: "[9,\\n\\n1] — gemischt über eine LEERZEILE: die Marke überlebt den Absatzwechsel",
    text: "Das gilt [9,\n\n1].",
    erwartet: [1],
    ohneMarken: "Das gilt [9,\n\n].",
    ohneMarkenDom: "Das gilt [9,].",
  },
];

function mount(text: string): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      createElement(AntwortText, { text, quellen: QUELLEN.length, className: "ask-answer-body" }),
    );
  });
  return container;
}

const markenIm = (c: HTMLElement): number[] =>
  [...c.querySelectorAll("sup[data-fussnote]")].map((e) => Number(e.getAttribute("data-fussnote")));

/**
 * Eine Messung am gerenderten DOM, die den Baum danach wieder abräumt — für den generierten Korpus,
 * der über tausend Mal rendert.
 */
function messeDom(text: string): { marken: number[]; text: string } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      createElement(AntwortText, { text, quellen: QUELLEN.length, className: "ask-answer-body" }),
    );
  });
  const messung = {
    marken: [...new Set(markenIm(container))].sort((a, b) => a - b),
    text: ohneMarkenIm(container),
  };
  act(() => {
    root.unmount();
  });
  container.remove();
  return messung;
}

/** Der sichtbare Text OHNE die Marken — hier zeigt sich, ob ein ungültiger Teil erhalten blieb. */
function ohneMarkenIm(c: HTMLElement): string {
  const klon = c.cloneNode(true) as HTMLElement;
  for (const marke of [...klon.querySelectorAll("sup[data-fussnote]")]) {
    marke.remove();
  }
  return klon.textContent ?? "";
}

describe("JOB 3064 · V · Reasoner und Fläche lesen dieselben Zitierformen gleich", () => {
  for (const form of FORMEN) {
    it(`V1+V2 · ${form.name}: Reasoner-Bindung und Marken der Fläche stimmen überein`, () => {
      // V1 — was der Reasoner bindet, als Nummern statt als Ids.
      const gebunden = citedSourceIds(form.text, QUELLEN as never)
        .map((id) => NUMMER[id] as number)
        .sort((a, b) => a - b);
      expect(gebunden, "die Vorgabe beschreibt den Reasoner nicht mehr").toEqual(form.erwartet);

      // V2 — was die Fläche zu Marken macht. Doppelnennungen fallen weg, die Reihenfolge wird
      // angeglichen: verglichen wird die MENGE der gebundenen Quellen, nicht ihre Stellung im Satz.
      const markiert = [
        ...new Set(
          zerlege(form.text)
            .filter((s) => s.art === "marke")
            .map((s) => (s as { ziffer: number }).ziffer),
        ),
      ].sort((a, b) => a - b);
      expect(markiert, `die Fläche liest „${form.text}" anders als der Reasoner`).toEqual(gebunden);

      // V2b — was NICHT Marke wird, bleibt Wort für Wort stehen. Die Stücke ohne die Marken
      // ergeben genau den Resttext; nichts wird still gelöscht, um die Klammer loszuwerden.
      // (Die Auszeichnungssterne entfernt hier der Test, weil die Zerlegung den ROHEN Text
      // bekommt — im DOM nimmt sie der Markdown-Parser weg, deshalb misst V3 dieselbe Zusage.)
      const rest = zerlege(form.text)
        .filter((s) => s.art === "text")
        .map((s) => (s as { text: string }).text)
        .join("");
      expect(rest.replace(/^\*+|\*+$/g, ""), `der Resttext von „${form.text}" stimmt nicht`).toBe(
        form.ohneMarken,
      );
    });

    it(`V3 · ${form.name}: das gerenderte DOM zeigt genau diese Marken`, () => {
      const c = mount(form.text);
      expect([...new Set(markenIm(c))].sort((a, b) => a - b)).toEqual(form.erwartet);
      // Und der Resttext im DOM ist derselbe: eine gültige Zahl steht als Marke da (sonst wäre sie
      // hier noch zu sehen), eine ungültige steht wörtlich da (sonst fehlte sie hier).
      expect(ohneMarkenIm(c), `der sichtbare Resttext von „${form.text}" stimmt nicht`).toBe(
        form.ohneMarkenDom ?? form.ohneMarken,
      );
    });
  }

  it("V4 · KALIBRIERUNG: die Vorgabe kann überhaupt scheitern", () => {
    // Ohne diesen Fall wäre die Reihe oben auch von zwei Seiten erfüllt, die BEIDE nichts tun.
    expect(citedSourceIds("Das gilt [1, 2].", QUELLEN as never)).toEqual(["A", "B"]);
    expect(zerlege("Das gilt [1, 2].").filter((s) => s.art === "marke")).toHaveLength(2);
    expect(zerlege("Das gilt [1, 2].", 0).filter((s) => s.art === "marke")).toHaveLength(0);
  });

  it("V5 · die Beispiele des Reasoner-Bestandstests sind hier vollständig vertreten", () => {
    // Der Wächter gegen ein stilles Auseinanderlaufen: wer in `citedSourceIds` eine Form ergänzt
    // und ihren Bestandstest erweitert, muss sie auch hier eintragen — sonst prüft diese Datei
    // eine Grammatik, die es nicht mehr gibt.
    const abgedeckt = FORMEN.map((f) => f.text);
    for (const beispiel of [
      "Das gilt [1].",
      "Das gilt [2][3].",
      "Das gilt [1, 2].",
      "Das gilt [9].",
      "Klammern [ohne Zahl] zaehlen nicht.",
    ]) {
      expect(abgedeckt, `Form aus mega52 fehlt hier: ${beispiel}`).toContain(beispiel);
    }
  });

  it("V6 · Bens Gegenbeispiele der Runde 7 sind vertreten und binden dieselbe Quellenmenge", () => {
    // Der Wächter gegen den Rückfall: genau die drei Texte, mit denen Ben die All-oder-nichts-Regel
    // widerlegt hat, samt der Quellenmenge, die er beim Reasoner gemessen hat.
    for (const [text, quellen] of [
      ["Das gilt [1, 9].", [1]],
      ["Das gilt [1,9].", [1]],
      ["Das gilt [1,,2].", [1, 2]],
      ["Das gilt [1,].", [1]],
    ] as Array<[string, number[]]>) {
      expect(
        FORMEN.map((f) => f.text),
        `Bens Gegenbeispiel fehlt: ${text}`,
      ).toContain(text);
      expect(
        citedSourceIds(text, QUELLEN as never).map((id) => NUMMER[id] as number),
        `der Reasoner bindet bei „${text}" etwas anderes als gemessen`,
      ).toEqual(quellen);
      expect(
        [
          ...new Set(
            zerlege(text)
              .filter((s) => s.art === "marke")
              .map((s) => (s as { ziffer: number }).ziffer),
          ),
        ].sort((a, b) => a - b),
        `die Fläche markiert bei „${text}" nicht dieselben Quellen`,
      ).toEqual(quellen);
      expect(
        [...new Set(markenIm(mount(text)))].sort((a, b) => a - b),
        `das DOM zeigt bei „${text}" nicht dieselben Marken`,
      ).toEqual(quellen);
    }
  });

  it("V8 · Bens Gegenbeispiele der Runde 8 (Blockgrenzen) binden und rendern die Marken 1 UND 2", () => {
    // Wörtlich die drei Texte aus Bens DOM-Gegenprobe: „bindet der Reasoner [1,2], das gerenderte
    // DOM enthält [] Marken". Hier stehen beide Seiten nebeneinander.
    for (const text of ["Das gilt [1,\n\n2].", "## Hinweis [1,\n2].", "- Hinweis [1,\n2]."]) {
      expect(
        citedSourceIds(text, QUELLEN as never).map((id) => NUMMER[id] as number),
        `der Reasoner bindet bei „${JSON.stringify(text)}" etwas anderes als gemessen`,
      ).toEqual([1, 2]);
      expect(
        [...new Set(markenIm(mount(text)))].sort((a, b) => a - b),
        `das DOM zeigt bei „${JSON.stringify(text)}" nicht die Marken 1 und 2`,
      ).toEqual([1, 2]);
    }
  });

  it("V9 · GENERIERTER KORPUS durch den vollen Renderer: Reasoner-Bindung = Marken im DOM", () => {
    // KORREKTURPFLICHT 3 (Ben, Runde 8): „Ein Fuzztest nur gegen `splitFussnoten` erfasst die
    // fehlerauslösende Blockzerlegung nicht." Deshalb läuft JEDER Fall hier durch `AntwortText` —
    // also durch `markiereFussnoten` UND `parseAnswerMarkdown` UND das Setzen der Marke.
    // Erzeugt wird aus drei Achsen: Trennzeichen (mit Tabulator, Zeilenumbruch, CR/LF, Leerzeile),
    // Teilen (gültig, ausserhalb der Liste, null, mehrstellig, leer) und dem BLOCK, in dem die
    // Gruppe steht (Absatz, Überschrift, Liste, Auszeichnung, zweiter Absatz).
    const TRENNER = [",", ", ", ",\t", ",\n", ",\r\n", ",\n\n", " , "];
    const TEILE = ["1", "2", "3", "9", "0", "12", ""];
    const RAHMEN: Array<{ name: string; bau: (gruppe: string) => string }> = [
      { name: "Absatz", bau: (g) => `Das gilt ${g}.` },
      { name: "Überschrift", bau: (g) => `## Hinweis ${g}` },
      { name: "Listenpunkt", bau: (g) => `- Punkt ${g}` },
      { name: "fett", bau: (g) => `**Das gilt ${g}**` },
      { name: "zweiter Absatz", bau: (g) => `Zeile eins.\n\nZeile zwei ${g}.` },
    ];
    const gueltig = (teil: string): boolean => /^\d+$/.test(teil) && Number(teil) <= QUELLEN.length;

    let faelle = 0;
    for (const links of TEILE) {
      for (const rechts of TEILE) {
        for (const trenner of TRENNER) {
          for (const rahmen of RAHMEN) {
            const text = rahmen.bau(`[${links}${trenner}${rechts}]`);
            const gebunden = citedSourceIds(text, QUELLEN as never)
              .map((id) => NUMMER[id] as number)
              .sort((a, b) => a - b);
            const dom = messeDom(text);
            expect(
              dom.marken,
              `${rahmen.name}: „${JSON.stringify(text)}" — Reasoner bindet ${JSON.stringify(gebunden)}, das DOM zeigt ${JSON.stringify(dom.marken)}`,
            ).toEqual(gebunden);
            // Und keine ungültige Zahl verschwindet dabei aus dem Satz.
            for (const teil of [links, rechts]) {
              if (teil.length > 0 && !gueltig(teil)) {
                expect(
                  dom.text,
                  `${rahmen.name}: „${JSON.stringify(text)}" — die ungültige ${teil} fehlt im sichtbaren Text`,
                ).toContain(teil);
              }
            }
            faelle += 1;
          }
        }
      }
    }
    expect(faelle, "der Korpus ist kleiner als angekündigt").toBe(
      TEILE.length * TEILE.length * TRENNER.length * RAHMEN.length,
    );
  });

  it("V10 · KALIBRIERUNG des Korpus: er trifft die Blockgrenze wirklich", () => {
    // Ohne diesen Fall könnte V9 grün sein, weil er die kritischen Formen gar nicht erzeugt.
    // Gemessen wird an der Zerlegung selbst: über eine Leerzeile hinweg entstehen zwei Marken,
    // und der Renderer bildet daraus WIRKLICH mehrere Blöcke.
    const c = mount("Zeile eins.\n\nZeile zwei [1,\n\n2].");
    expect(c.querySelectorAll("p").length, "der Text zerfällt nicht in mehrere Absätze").toBe(2);
    expect([...new Set(markenIm(c))].sort((a, b) => a - b)).toEqual([1, 2]);
    const liste = mount("- Punkt [1,\n2]");
    expect(liste.querySelectorAll("li").length, "der Text wird nicht zur Liste").toBe(1);
    expect(markenIm(liste)).toEqual([1, 2]);
  });

  it("V7 · die ungültige Zahl einer gemischten Gruppe bleibt sichtbar — sie verschwindet nicht", () => {
    // Die zweite Hälfte der Korrekturpflicht: nicht markieren heisst NICHT löschen. Gemessen am
    // DOM, weil genau dort der Mensch den Antworttext liest.
    const sichtbar = (mount("Das gilt [1, 9].").textContent ?? "").replace(/\s+/g, " ");
    expect(sichtbar, "die ungültige 9 fehlt im Antworttext").toContain("9");
    expect(sichtbar, "die Klammer der gemischten Gruppe wurde stillschweigend entfernt").toContain(
      "[",
    );
  });
});

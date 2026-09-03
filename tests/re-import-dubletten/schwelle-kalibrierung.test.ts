// ================================================================================================
// JOB 3023 — DIE SCHWELLE 0,85 IST GEMESSEN, NICHT BEHAUPTET.
// ================================================================================================
//
// Die Kompositionswurzel (`library-routes.ts`, RE_IMPORT_DUBLETTE_AB) schreibt eine Zahl aus und
// begruendet sie im Quelltext. Eine begruendete Zahl ist noch keine gemessene Zahl. Diese Datei
// nagelt fest, WAS diese Zahl im Produkt tatsaechlich trennt — mit denselben Bausteinen, die die
// Route verdrahtet (`coreText` + `trigramSimilarity` aus `services/conflicts`).
//
// WARUM DAS HIER STEHT UND NICHT NUR IM KOMMENTAR: der Auftrag verbietet ein zweites Gehirn. Also
// ist die Trennschaerfe KEINE Stellschraube, die man nachziehen kann, sondern eine EIGENSCHAFT der
// vorhandenen Kennzahl. Wer sie kennt, muss sie belegen koennen — und wer sie spaeter verschiebt
// (andere Schwelle, andere Kennzahl), wird hier rot und muss die Folgen ansehen.
//
// DER BEFUND MIT KANTE (K3): zwei Eintraege, die sich NUR IN EINER ZAHL unterscheiden, liegen ueber
// der Schwelle und gelten damit als dieselbe Sache. Das ist keine Panne dieser Umsetzung, sondern
// die bekannte Eigenschaft einer Zeichen-n-Gramm-Kennzahl, und es ist dieselbe Aussage, die das
// Produkt an seiner anderen deterministischen Stelle bereits trifft
// (`conflicts/src/duplicate-detect.ts`, DUP_DETERMINISTIC_THRESHOLD). Es steht hier ausdruecklich,
// damit es niemand spaeter entdecken muss: der Re-Import haelt solche Eintraege zurueck und weist
// sie in der Antwort mit `aehnlich`, getroffener koId und Wert aus — er verwirft sie nicht still.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { coreText, trigramSimilarity } from "../../services/conflicts";

/** Genau der Kerntext, den `pruefeReImportDublette` fuer ein `ImportItem` bildet. */
function importKerntext(title: string, statement: string): string {
  return coreText({ refId: "import", title, statement, conditions: [], measures: [], tags: [] });
}

function aehnlichkeit(a: [string, string], b: [string, string]): number {
  return trigramSimilarity(importKerntext(...a), importKerntext(...b));
}

// Dieselbe Zahl wie in `services/app/src/routes/library-routes.ts` (RE_IMPORT_DUBLETTE_AB).
// Bewusst hier NACHGESCHRIEBEN statt importiert: der Wert ist ein privates Detail der
// Kompositionswurzel, und ein Test, der die Konstante des Prueflings importiert, misst nichts.
//
// Eine nachgeschriebene Zahl kann aber DRIFTEN — dagegen steht K0: der Pin unten haelt die
// Schwelle des Produkts an dieser Messung fest. Wer sie verschiebt, wird dort rot und muss die
// vier gemessenen Faelle ansehen, statt sie stumm veralten zu lassen.
const SCHWELLE = 0.85;

describe("JOB 3023 · K — was die Schwelle 0,85 trennt", () => {
  it("K0 · DER PIN: das Produkt schreibt genau diese Schwelle aus, an genau einer Stelle", () => {
    const quelle = readFileSync(
      new URL("../../services/app/src/routes/library-routes.ts", import.meta.url),
      "utf8",
    );
    const treffer = [...quelle.matchAll(/^const RE_IMPORT_DUBLETTE_AB = ([\d.]+);$/gm)];
    expect(
      treffer,
      "Die Schwelle steht an GENAU EINER Stelle (Pflichtlieferung 2) — nicht null, nicht zwei.",
    ).toHaveLength(1);
    expect(
      Number(treffer[0]?.[1]),
      "Wer die Schwelle verschiebt, muss die vier Faelle unten neu messen.",
    ).toBe(SCHWELLE);
  });

  it("K1 · Satzpunkt und Gross-/Kleinschreibung: klar ueber der Schwelle", () => {
    const wert = aehnlichkeit(
      ["Ventil entlueften", "Bei Ueberdruck das Ventil X langsam entlueften."],
      ["VENTIL ENTLUEFTEN", "bei Ueberdruck das Ventil X langsam entlueften"],
    );
    expect(wert).toBeGreaterThanOrEqual(SCHWELLE);
  });

  it("K2 · ein fachlich anderer Eintrag derselben Kategorie: klar unter der Schwelle", () => {
    const wert = aehnlichkeit(
      ["Ventil entlueften", "Bei Ueberdruck das Ventil X langsam entlueften."],
      [
        "Notstromaggregat monatlich probelaufen lassen",
        "Das Notstromaggregat einmal im Monat fuenfzehn Minuten unter Last laufen lassen.",
      ],
    );
    expect(wert).toBeLessThan(SCHWELLE);
  });

  it("K3 · DIE KANTE: kurze Eintraege, die sich nur in einer Zahl unterscheiden, gelten als dieselbe Sache", () => {
    const wert = aehnlichkeit(
      ["Bulk-Objekt 3", "Aussage Nummer 3 mit eigenem Inhalt."],
      ["Bulk-Objekt 13", "Aussage Nummer 13 mit eigenem Inhalt."],
    );
    // Nicht „so soll es sein", sondern „so IST es": ein einziges geaendertes Zeichen in einem
    // sonst wortgleichen Kurztext bewegt eine Trigramm-Kennzahl kaum. Wer diese Grenze verschieben
    // will, braucht eine andere Kennzahl — und damit Pedis Wort, nicht einen stillen Zahlenwechsel.
    expect(wert).toBeGreaterThanOrEqual(SCHWELLE);
  });

  it("K4 · dieselbe Sachaussage mit unterschiedlicher Kennung, aber echtem eigenen Text: unter der Schwelle", () => {
    // Die Entwarnung zu K3: sobald ein Eintrag traegt, was ein gepflegtes Wissensobjekt traegt —
    // einen eigenen Satz statt eines Zaehlers —, trennt die Kennzahl wieder sauber.
    const wert = aehnlichkeit(
      ["Ventil V4 pruefen", "Das Ventil V4 vor jedem Anlauf auf Dichtheit pruefen."],
      ["Ventil V5 pruefen", "Das Ventil V5 nach jeder Wartung auf Leichtgaengigkeit pruefen."],
    );
    expect(wert).toBeLessThan(SCHWELLE);
  });
});

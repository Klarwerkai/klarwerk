// ================================================================================================
// AUFTRAG-mega32 BLOCK L (aus dem zurückgezogenen mega30, unverändert) — EIN KOMMENTAR DARF NICHT
// MEHR BEHAUPTEN, ALS DER CODE WEISS.
// ================================================================================================
//
// DER BEFUND. In `detection-cap.ts` begründete ein Spiegelstrich die Zwanzig damit, Rang 21 sei
// „lexikalisch bereits deutlich entfernt". Das ist eine MESSAUSSAGE. Gemessen haben wir sie nie —
// zwei Absätze weiter steht im selben Kommentar ehrlich „erprobt, nicht gemessen". Beides
// nebeneinander geht nicht.
//
// WARUM EIN TEST FÜR EINEN KOMMENTAR. Weil genau diese Klasse — ein Kommentar, der eine Rechnung
// oder Messung behauptet, ohne dass sie geprüft wird — uns in dieser Woche neunmal begegnet ist
// (bens GELB-2 zur Buchhaltungs-Gleichung ist derselbe Fall in Zahlen). Ein Wächter über die Quelle
// ist im Haus etabliert: Commit 1881211 hält mit demselben Muster künftige services-Importe unter
// apps/web/src auf.
//
// Der DECKELWERT selbst ist unverändert 20 und nicht Gegenstand — der Test pinnt ihn mit, damit
// diese Datei nicht versehentlich zur Erlaubnis wird, ihn zu bewegen.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DETECTION_CANDIDATE_CAP } from "../../services/app/src/detection-cap";

const QUELLE = readFileSync(join(process.cwd(), "services/app/src/detection-cap.ts"), "utf8");

describe("mega32 L · der Deckel-Kommentar behauptet keine ungemessene Entfernung mehr", () => {
  it("die Aussage über Rang 21 ist weg", () => {
    // Die konkrete Behauptung …
    expect(QUELLE).not.toMatch(/Rang 21 ist\s*\n?\s*\/\/\s*lexikalisch bereits deutlich entfernt/);
    // … und die Wortkombination, aus der sie bestand, in jeder Umbruch-Variante.
    const fliesstext = QUELLE.replace(/\n\s*\/\/\s*/g, " ");
    expect(fliesstext).not.toMatch(/Rang 21 ist lexikalisch bereits deutlich entfernt/);
  });

  it("was bleibt, ist die Sortierung — eine Aussage, die der Code trägt", () => {
    const fliesstext = QUELLE.replace(/\n\s*\/\/\s*/g, " ");
    // Der Kommentar sagt weiterhin, WONACH sortiert wird (das tut selectCandidates nachweislich,
    // s. detection-cap-honesty.test.ts „deterministisch gewählt").
    expect(fliesstext).toContain("sortiert nach demselben Deckungsmaß");
    // Die ehrliche Selbstauskunft zwei Absätze weiter steht unverändert daneben und widerspricht
    // jetzt nichts mehr.
    expect(fliesstext).toContain("erprobt");
  });

  it("der Deckelwert ist unverändert 20 (nicht Gegenstand dieses Blocks)", () => {
    expect(DETECTION_CANDIDATE_CAP).toBe(20);
  });
});

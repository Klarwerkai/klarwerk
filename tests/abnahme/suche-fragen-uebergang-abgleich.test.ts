// Auftrag „Aus Bibliothekstreffern quellengebundene Fragen stellen" (R-0429/R-0436), Kriterium 3.
//
// Der Bestandsabgleich `docs/abnahme/suche-fragen-uebergang.md` benennt einen Quellenwiderspruch
// mit Zeilenangaben. Dieser Fall prüft, dass die zitierten Zeilen wirklich sagen, was das Dokument
// ihnen zuschreibt — verschiebt jemand die Quelle, wird der Abgleich rot, statt still falsch zu
// zitieren. Und er hält fest, dass die „nicht-Boss-abhängig"-Aussage NICHT als Freigabe gilt.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

/** Zeile `nr` (1-basiert) einer Datei — genau so, wie das Dokument sie zitiert. */
function zeile(rel: string, nr: number): string {
  return read(rel).split("\n")[nr - 1] ?? "";
}

const ABGLEICH = "docs/abnahme/suche-fragen-uebergang.md";
const PAUL = "docs/boss-assistant/interviews/paul.md";
const ZWISCHENBERICHT = "PROJECT_CONTEXT/13_ASSISTENT_ZWISCHENBERICHT.md";

describe("Suche→Fragen-Abgleich · zitierte Fundstellen tragen die Aussage", () => {
  it("paul.md: Slice 2 Boss-abhängig (29, 53) und zugleich nicht-Boss-abhängig (49)", () => {
    expect(zeile(PAUL, 29)).toContain("Zurückgestellt (Boss)");
    expect(zeile(PAUL, 29)).toContain("Suche-Slice 2");
    expect(zeile(PAUL, 49)).toContain("nicht-Boss-abhängiger Kandidat");
    expect(zeile(PAUL, 49)).toContain("Suche-Slice 2");
    expect(zeile(PAUL, 53)).toContain("Suche-Slice-2-Design");
    expect(zeile(PAUL, 17)).toContain("Außerhalb Mandat");
    expect(zeile(PAUL, 17)).toContain("Produktrichtung");
  });

  it("Zwischenbericht 72–75: Slice 2 steht unter den offenen Boss-Entscheidungen", () => {
    expect(zeile(ZWISCHENBERICHT, 72)).toContain("Offene Produktrichtungs-Entscheidungen");
    expect(zeile(ZWISCHENBERICHT, 72)).toContain("warten auf Boss");
    expect(zeile(ZWISCHENBERICHT, 75)).toContain("Suche-Slice 2");
  });

  it("der Abgleich nennt beide Seiten mit Fundstelle und wertet Zeile 49 nicht als Freigabe", () => {
    const doc = read(ABGLEICH).replace(/\s+/g, " ");
    expect(doc).toContain("Quellenwiderspruch im Interview Paul");
    expect(doc).toContain("Zeile 29");
    expect(doc).toContain("Zeile 49");
    expect(doc).toContain("Zeile 53");
    expect(doc).toContain(`${ZWISCHENBERICHT}:72-75`);
    expect(doc).toContain("**keine Freigabe**");
    // Slice 2 bleibt im Abgleich offen — keine Erfüllungsbehauptung.
    expect(doc).toContain("Slice 2 (offen, nicht gebaut)");
  });
});

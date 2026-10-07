// ================================================================================================
// Aufnahme `gesamt-erfassung-einstieg:fehlerfaelle` — R-0101, der offene Rest: `capture.ocrRunning`
// und `capture.fAsset` sprechen in DE, EN und NL die Sprache des Anwenders, nicht die der Technik.
// ================================================================================================
//
// Vorher: „OCR läuft für … (Worker/Sprachdaten werden geladen)" und „Anlage / Asset" (EN „Asset /
// equipment", NL „Installatie / asset"). Beide stehen auf dem Erfassungsweg: der Lesehinweis beim
// Auslesen eines Bildes oder PDFs (`pages/Capture.tsx` Bild- und Dateiweg,
// `components/BodyExtractPanel.tsx`), die Feldbeschriftung im Arbeitsraum („Erweiterte Details").
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { repoPfad } from "../support/repoPfad";

const SPRACHEN = ["de", "en", "nl"] as const;

/** Die Fachwörter, die der alte Wortlaut trug — in keiner Sprache mehr erlaubt. */
const TECHNISCH = /\bOCR\b|worker|sprachdaten|language data|taaldata|asset/i;

function tIn(sprache: string) {
  return i18n.getFixedT(sprache);
}

describe("R-0101 · klare Worte für Lesehinweis und Anlagenfeld", () => {
  it("K0 · Kalibrierung: der alte Wortlaut wäre in allen drei Sprachen ein Befund", () => {
    for (const alt of [
      "OCR läuft für scan.png (Worker/Sprachdaten werden geladen) …",
      "Running OCR for scan.png (loading worker/language data) …",
      "OCR loopt voor scan.png (worker/taaldata worden geladen) …",
      "Anlage / Asset",
      "Asset / equipment",
      "Installatie / asset",
    ]) {
      expect(alt).toMatch(TECHNISCH);
    }
  });

  for (const sprache of SPRACHEN) {
    it(`K1 · ${sprache}: der Lesehinweis nennt die Datei und kein Fachwort`, () => {
      const satz = tIn(sprache)("capture.ocrRunning", { name: "scan.png" });
      expect(satz).not.toBe("capture.ocrRunning");
      expect(satz).toContain("scan.png");
      expect(satz).not.toContain("{{");
      expect(satz).not.toMatch(TECHNISCH);
    });

    it(`K2 · ${sprache}: die Feldbeschriftung ist kein Fachwort`, () => {
      const beschriftung = tIn(sprache)("capture.fAsset");
      expect(beschriftung).not.toBe("capture.fAsset");
      expect(beschriftung).not.toMatch(TECHNISCH);
    });
  }

  it("K3 · drei Sprachen, drei Fassungen — kein stiller deutscher Rückfall", () => {
    for (const schluessel of ["capture.ocrRunning", "capture.fAsset"]) {
      const fassungen = SPRACHEN.map((s) => tIn(s)(schluessel, { name: "scan.png" }));
      expect(new Set(fassungen).size, schluessel).toBe(3);
    }
  });

  it("K4 · beide Schlüssel stehen weiter auf dem Erfassungsweg (sonst prüfte K1/K2 Leerlauf)", () => {
    const capture = readFileSync(repoPfad("apps/web/src/pages/Capture.tsx"), "utf8");
    const panel = readFileSync(repoPfad("apps/web/src/components/BodyExtractPanel.tsx"), "utf8");
    expect(capture).toContain('t("capture.ocrRunning"');
    expect(capture).toContain('t("capture.fAsset")');
    expect(panel).toContain('t("capture.ocrRunning"');
  });
});

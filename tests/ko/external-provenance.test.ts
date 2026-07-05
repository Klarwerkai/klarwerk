import { describe, expect, it } from "vitest";
import { containsExternalUnchecked } from "../../apps/web/src/lib/externalProvenance";

// SCRUM-438: Erkennung „Enthält externes, ungeprüftes Wissen" fürs Herkunfts-Chip.
describe("SCRUM-438: containsExternalUnchecked", () => {
  it("erkennt die stabile, sprachunabhängige Marker-Klasse panel-external", () => {
    expect(containsExternalUnchecked('<div class="panel panel-external"><p>x</p></div>')).toBe(
      true,
    );
  });

  it("Übergangs-Fallback: erkennt Alt-Blöcke am sichtbaren Badge (beide Sprachen)", () => {
    expect(containsExternalUnchecked("<p><strong>[Extern · ungeprüft]</strong> x</p>")).toBe(true);
    expect(containsExternalUnchecked("<p><strong>[External · unverified]</strong> x</p>")).toBe(
      true,
    );
  });

  it("normaler Inhalt ohne externe Herkunft → false", () => {
    expect(containsExternalUnchecked("<p>Ganz normaler, selbst verfasster Text.</p>")).toBe(false);
  });

  it("leer/null/undefined → false", () => {
    expect(containsExternalUnchecked("")).toBe(false);
    expect(containsExternalUnchecked(null)).toBe(false);
    expect(containsExternalUnchecked(undefined)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { CAPTURE_EXAMPLE } from "../../apps/web/src/lib/captureExample";

// SCRUM-257: Der Capture-Beispielpfad lädt eine produktnahe industrielle Erfahrungsnotiz,
// die an die Stage-1-Story (Linie L4 / Dosierwert / Schichtwechsel) anschließt — kein Spielzeug.
describe("SCRUM-257: captureExample", () => {
  it("enthält produktnahen Industrieinhalt (Linie L4 / Dosierwert/Dosierung / Schichtwechsel)", () => {
    expect(CAPTURE_EXAMPLE.raw).toMatch(/Linie L4/);
    expect(CAPTURE_EXAMPLE.raw).toMatch(/Dosier(wert|ung)/);
    expect(CAPTURE_EXAMPLE.raw).toMatch(/Schichtwechsel/);
  });

  it("setzt Kategorie, Asset und Tags (keine leeren Felder)", () => {
    expect(CAPTURE_EXAMPLE.category.trim().length).toBeGreaterThan(0);
    expect(CAPTURE_EXAMPLE.asset.trim().length).toBeGreaterThan(0);
    expect(CAPTURE_EXAMPLE.tags.length).toBeGreaterThanOrEqual(3);
    expect(CAPTURE_EXAMPLE.tags.every((tag) => tag.trim().length > 0)).toBe(true);
    expect(CAPTURE_EXAMPLE.asset).toMatch(/Linie L4|DP-4/);
    expect(CAPTURE_EXAMPLE.tags).toContain("Linie L4");
  });

  it("enthält keine alten Frost/Pumpe-P12-Spielzeugdaten mehr", () => {
    const blob = `${CAPTURE_EXAMPLE.raw} ${CAPTURE_EXAMPLE.category} ${CAPTURE_EXAMPLE.asset} ${CAPTURE_EXAMPLE.tags.join(" ")}`;
    expect(blob).not.toMatch(/Frost/i);
    expect(blob).not.toMatch(/P-12|P-13/);
    expect(blob).not.toMatch(/Kavitation/i);
  });

  it("verweist auf einen Notice-Key für den nächsten Schritt", () => {
    expect(CAPTURE_EXAMPLE.noticeKey).toBe("capture.exampleLoaded");
  });
});

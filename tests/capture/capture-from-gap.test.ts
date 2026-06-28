import { describe, expect, it } from "vitest";
import { captureGapHref, readGapContext } from "../../apps/web/src/lib/captureFromGap";

// SCRUM-263: Übergang offene Wissenslücke → Erfassung (Frage als Startkontext, kein Auto-KO).
describe("SCRUM-263: captureFromGap", () => {
  it("baut einen /erfassen-Link mit URL-encodierter Gap-Frage", () => {
    const href = captureGapHref("Warum schwankt der Dosierwert an Linie L4?");
    expect(href.startsWith("/erfassen?gap=")).toBe(true);
    expect(href).toContain(encodeURIComponent("Warum schwankt der Dosierwert an Linie L4?"));
  });

  it("Round-Trip: readGapContext liest die übergebene Frage zurück", () => {
    const question = "Warum steigt die Ausschussquote nach dem Werkzeugwechsel?";
    const href = captureGapHref(question);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(readGapContext(params)).toBe(question);
  });

  it("trimmt die Frage im Link", () => {
    const href = captureGapHref("  Temperaturdrift an Linie L4?  ");
    const params = new URLSearchParams(href.split("?")[1]);
    expect(readGapContext(params)).toBe("Temperaturdrift an Linie L4?");
  });

  it("kein/leerer Parameter → kein Kontext (null)", () => {
    expect(readGapContext(new URLSearchParams(""))).toBeNull();
    expect(readGapContext(new URLSearchParams("gap=%20%20"))).toBeNull();
    expect(readGapContext(new URLSearchParams("other=x"))).toBeNull();
  });
});

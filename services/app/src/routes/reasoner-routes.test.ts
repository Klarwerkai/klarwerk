import { describe, expect, it } from "vitest";
import { classifyProvenanceConfidential } from "./reasoner-routes";

// SCRUM-502 Schicht 2 (Round 3): fail-safe Herkunftsvertrag. Der Client MUSS die Herkunft des
// Modell-Aktions-Textes deklarieren; im Zweifel gilt „vertraulich" (kein Cloud-Egress). Kein
// Client-Downgrade, keine stillschweigende false-Rückgabe bei fehlendem/unbekanntem Signal.
describe("SCRUM-502 Schicht 2: classifyProvenanceConfidential (fail-safe)", () => {
  const NOT_LOADED = { found: false } as const;

  it("source:ko + gespeichert intern → nicht vertraulich (Cloud erlaubt)", () => {
    expect(
      classifyProvenanceConfidential("ko", "ko-1", undefined, { found: true, level: "intern" }),
    ).toBe(false);
  });

  it("source:ko + gespeichert vertraulich/streng → vertraulich (autoritativ)", () => {
    expect(
      classifyProvenanceConfidential("ko", "ko-1", "intern", { found: true, level: "vertraulich" }),
    ).toBe(true); // Client sagt intern — die gespeicherte Stufe gewinnt
    expect(
      classifyProvenanceConfidential("ko", "ko-1", undefined, {
        found: true,
        level: "streng_vertraulich",
      }),
    ).toBe(true);
  });

  it("source:ko ohne koId → fail-safe vertraulich (nie false)", () => {
    expect(classifyProvenanceConfidential("ko", undefined, undefined, NOT_LOADED)).toBe(true);
    expect(classifyProvenanceConfidential("ko", "", undefined, NOT_LOADED)).toBe(true);
  });

  it("source:ko mit UNBEKANNTER koId (nicht gefunden) → fail-safe vertraulich", () => {
    // Der Resolver hat geladen, aber nichts gefunden → NIE stillschweigend Cloud.
    expect(classifyProvenanceConfidential("ko", "ko-weg", undefined, { found: false })).toBe(true);
  });

  it("source:draft + explizit intern → nicht vertraulich", () => {
    expect(classifyProvenanceConfidential("draft", undefined, "intern", NOT_LOADED)).toBe(false);
  });

  it("source:draft + vertraulich/streng → vertraulich", () => {
    expect(classifyProvenanceConfidential("draft", undefined, "vertraulich", NOT_LOADED)).toBe(
      true,
    );
    expect(
      classifyProvenanceConfidential("draft", undefined, "streng_vertraulich", NOT_LOADED),
    ).toBe(true);
  });

  it("source:draft ohne/ungültige Stufe → fail-safe vertraulich", () => {
    expect(classifyProvenanceConfidential("draft", undefined, undefined, NOT_LOADED)).toBe(true);
    expect(classifyProvenanceConfidential("draft", undefined, "quatsch", NOT_LOADED)).toBe(true);
    expect(classifyProvenanceConfidential("draft", undefined, 42, NOT_LOADED)).toBe(true);
  });

  it("source plain/fehlend/ungültig für einen KO-/Draft-Task → fail-safe vertraulich", () => {
    expect(classifyProvenanceConfidential("plain", undefined, undefined, NOT_LOADED)).toBe(true);
    expect(classifyProvenanceConfidential(undefined, undefined, undefined, NOT_LOADED)).toBe(true);
    expect(classifyProvenanceConfidential("bogus", "ko-1", "intern", NOT_LOADED)).toBe(true);
  });
});

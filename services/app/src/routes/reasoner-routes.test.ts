import { describe, expect, it } from "vitest";
import { classifyProvenanceConfidential } from "./reasoner-routes";

// SCRUM-502 Round 4: die Einstufung ist an den VERARBEITETEN TEXT gebunden, nicht an eine lose koId.
// Gültige Text-Quellen: "draft" (Editor) / "transient-document" (Upload) — beide mit AKTUELLER Stufe.
// Eine koId ist nur ein HEBENDER Backstop (nie senkend), source:"ko" wird nicht mehr geehrt.
describe("SCRUM-502 Round 4: classifyProvenanceConfidential (an den Text gebunden)", () => {
  const NONE = { found: false } as const;

  it("draft/transient-document + explizit intern → nicht vertraulich", () => {
    expect(classifyProvenanceConfidential("draft", "intern", NONE)).toBe(false);
    expect(classifyProvenanceConfidential("transient-document", "intern", NONE)).toBe(false);
  });

  it("draft/transient-document + vertraulich/streng → vertraulich", () => {
    expect(classifyProvenanceConfidential("draft", "vertraulich", NONE)).toBe(true);
    expect(classifyProvenanceConfidential("transient-document", "streng_vertraulich", NONE)).toBe(
      true,
    );
  });

  it("draft ohne/ungültige Stufe → fail-safe vertraulich", () => {
    expect(classifyProvenanceConfidential("draft", undefined, NONE)).toBe(true);
    expect(classifyProvenanceConfidential("draft", "quatsch", NONE)).toBe(true);
    expect(classifyProvenanceConfidential("transient-document", 42, NONE)).toBe(true);
  });

  it("koId-Backstop HEBT: intern deklariert + gespeichert-vertrauliches KO → vertraulich", () => {
    expect(
      classifyProvenanceConfidential("draft", "intern", { found: true, level: "vertraulich" }),
    ).toBe(true);
    expect(
      classifyProvenanceConfidential("transient-document", "intern", {
        found: true,
        level: "streng_vertraulich",
      }),
    ).toBe(true);
  });

  it("koId-Backstop SENKT NIE: vertraulich deklariert + internes/fremdes KO → bleibt vertraulich", () => {
    expect(
      classifyProvenanceConfidential("draft", "vertraulich", { found: true, level: "intern" }),
    ).toBe(true);
  });

  it("internes KO als Backstop hebt nichts (kein falscher Freigabe-Anker)", () => {
    // Ein internes/unbekanntes KO darf eine intern-Deklaration nicht verändern → bleibt intern.
    expect(
      classifyProvenanceConfidential("draft", "intern", { found: true, level: "intern" }),
    ).toBe(false);
    expect(classifyProvenanceConfidential("draft", "intern", { found: false })).toBe(false);
  });

  it('source:"ko" (loser Anker) wird NICHT mehr geehrt → fail-safe vertraulich', () => {
    // Genau die R4-Lücke: frei gelieferter Text unter source:"ko" darf NIE an die Cloud.
    expect(classifyProvenanceConfidential("ko", "intern", NONE)).toBe(true);
    expect(classifyProvenanceConfidential("ko", "intern", { found: true, level: "intern" })).toBe(
      true,
    );
  });

  it("fehlende/unbekannte Quelle → fail-safe vertraulich", () => {
    expect(classifyProvenanceConfidential(undefined, "intern", NONE)).toBe(true);
    expect(classifyProvenanceConfidential("plain", "intern", NONE)).toBe(true);
    expect(classifyProvenanceConfidential("bogus", "vertraulich", NONE)).toBe(true);
  });
});

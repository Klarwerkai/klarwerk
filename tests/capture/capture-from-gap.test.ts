import { describe, expect, it } from "vitest";
import {
  captureGapHref,
  gapContextDraft,
  readGapContext,
} from "../../apps/web/src/lib/captureFromGap";

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

// SCRUM-270: Gap-Frage wird als OFFENE Frage / Schreibvorlage übernommen, nicht als fertiges Wissen.
describe("SCRUM-270: gapContextDraft", () => {
  const labels = { question: "Offene Frage", experience: "Eigene Erfahrung/Beobachtung ergänzen" };

  it("kennzeichnet die Frage als offene Frage und lädt zur eigenen Erfahrung ein", () => {
    const draft = gapContextDraft("Warum schwankt der Dosierwert an Linie L4?", labels);
    expect(draft).toContain("Offene Frage: Warum schwankt der Dosierwert an Linie L4?");
    expect(draft).toContain("Eigene Erfahrung/Beobachtung ergänzen:");
    // Frage und Erfahrungsteil sind klar getrennt (Leerzeile), Vorlage endet offen für Eingabe.
    expect(draft).toContain("\n\n");
    expect(draft.endsWith(":\n")).toBe(true);
  });

  it("trimmt die Frage in der Vorlage", () => {
    const draft = gapContextDraft("  Temperaturdrift an Linie L4?  ", labels);
    expect(draft).toContain("Offene Frage: Temperaturdrift an Linie L4?");
    expect(draft).not.toContain("Frage:   ");
  });
});

import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  GAP_PRIVACY_NOTICE_KEY,
  MAX_GAP_CONTEXT_LENGTH,
  captureGapHref,
  gapContextDraft,
  gapPrivacyNoticeKey,
  normalizeGapContext,
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

// SCRUM-285: Gap-Startkontext auch bei Direkt-CTA / externen Links datensparsam begrenzen.
describe("SCRUM-285: normalizeGapContext + captureGapHref/readGapContext", () => {
  const longBlob = `Bitte beachte folgenden Kontext: ${"lorem ipsum dolor sit amet ".repeat(40)}`;

  it("lässt kurze, normale Fragen unverändert", () => {
    const q = "Warum schwankt der Dosierwert an Linie L4?";
    expect(normalizeGapContext(q)).toBe(q);
  });

  it("trimmt + zieht Whitespace/Zeilenumbrüche zusammen", () => {
    expect(normalizeGapContext("  Wann   schließt\n das  Ventil?  ")).toBe(
      "Wann schließt das Ventil?",
    );
  });

  it("begrenzt sehr lange Fragen deterministisch mit Ellipse", () => {
    const out = normalizeGapContext(longBlob);
    expect(out.length).toBeLessThanOrEqual(MAX_GAP_CONTEXT_LENGTH + 1);
    expect(out.endsWith("…")).toBe(true);
    expect(normalizeGapContext(longBlob)).toBe(out); // deterministisch
  });

  it("captureGapHref begrenzt den rohen Ask-CTA-Text (kein überlanger URL-Kontext)", () => {
    const href = captureGapHref(longBlob);
    const param = new URLSearchParams(href.split("?")[1]).get("gap") ?? "";
    expect(param.length).toBeLessThanOrEqual(MAX_GAP_CONTEXT_LENGTH + 1);
    expect(param.endsWith("…")).toBe(true);
  });

  it("readGapContext normalisiert auch externe/alte überlange Links", () => {
    const params = new URLSearchParams(`gap=${encodeURIComponent(longBlob)}`);
    const ctx = readGapContext(params) ?? "";
    expect(ctx.length).toBeLessThanOrEqual(MAX_GAP_CONTEXT_LENGTH + 1);
    expect(ctx.endsWith("…")).toBe(true);
  });

  it("Konsistenz: roher Text und gleich-normalisierter Text liefern denselben Link", () => {
    // normalize(asked) === gap.question (gleiche Regel) → CTA-Text deckt sich mit Persistenz.
    expect(captureGapHref(longBlob)).toBe(captureGapHref(normalizeGapContext(longBlob)));
  });
});

// SCRUM-283: datensparsamer, ehrlicher Hinweis zur gespeicherten Wissenslücke (Ask + Risk teilen
// denselben i18n-Schlüssel → einheitliche Aussage). Der Helper ist die einzige Quelle der Wahrheit.
describe("SCRUM-283: gapPrivacyNoticeKey", () => {
  it("liefert einen stabilen i18n-Schlüssel", () => {
    expect(gapPrivacyNoticeKey()).toBe(GAP_PRIVACY_NOTICE_KEY);
    expect(gapPrivacyNoticeKey()).toBe("gap.privacyNotice");
  });

  const text = (lng: string) =>
    String(i18n.getResource(lng, "translation", gapPrivacyNoticeKey()) ?? "");

  it("ist in DE vorhanden und benennt Lücke, fehlende Validierung und Datensparsamkeit", () => {
    const de = text("de").toLowerCase();
    expect(de.length).toBeGreaterThan(0);
    expect(de).toContain("wissenslücke");
    expect(de).toContain("sensibl"); // datensparsam: keine sensiblen Details
    expect(de).toContain("erfahrung"); // später geprüfte Erfahrung ergänzen
  });

  it("ist in EN vorhanden und transportiert dieselbe ehrliche Aussage", () => {
    const en = text("en").toLowerCase();
    expect(en.length).toBeGreaterThan(0);
    expect(en).toContain("gap");
    expect(en).toContain("sensitive");
  });
});

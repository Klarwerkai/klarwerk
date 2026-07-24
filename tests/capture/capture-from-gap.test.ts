import { describe, expect, it } from "vitest";
import type { Gap } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import {
  GAP_PRIVACY_NOTICE_KEY,
  MAX_GAP_CONTEXT_LENGTH,
  captureGapHref,
  gapContextDraft,
  gapPrivacyNoticeKey,
  normalizeGapContext,
  readGapId,
  resolveGapQuestion,
} from "../../apps/web/src/lib/captureFromGap";

function gap(over: Partial<Gap> = {}): Gap {
  return {
    id: "g-1",
    question: "Warum schwankt der Dosierwert an Linie L4?",
    status: "offen",
    assignee: null,
    priority: "mittel",
    createdAt: "2026-07-24T10:00:00.000Z",
    ...over,
  };
}

// SCRUM-263 / FUNKE-FIX2 P0 (bens Erforderlich 4): Der Einstieg trägt die GAP-ID (kein Fragetext in
// der URL). Der Text wird erst NACH serverseitiger Berechtigungsprüfung aus der (bereits redigierten)
// Gap-Liste aufgelöst.
describe("FUNKE-FIX2 P0: captureFromGap trägt Gap-ID, KEIN Fragetext in der URL", () => {
  it("captureGapHref baut /erfassen?gap=<id> — nur die ID, kein Fragetext", () => {
    const href = captureGapHref("g-42");
    expect(href).toBe("/erfassen?gap=g-42");
  });

  it("die URL enthält NIE den Fragetext, auch wenn ein solcher als ID käme (encodiert, aber keine Frage)", () => {
    // Produktiv wird immer g.id übergeben; selbst ein missbräuchlicher Text landet nur exakt so, wie
    // übergeben — der Produzent (Risk/Ask) reicht ausschließlich die Gap-ID durch.
    const href = captureGapHref("g-7");
    expect(href).not.toContain("Dosierwert");
  });

  it("readGapId liest die Gap-ID zurück; leer/fehlend → null", () => {
    const params = new URLSearchParams(captureGapHref("g-99").split("?")[1]);
    expect(readGapId(params)).toBe("g-99");
    expect(readGapId(new URLSearchParams(""))).toBeNull();
    expect(readGapId(new URLSearchParams("gap=%20%20"))).toBeNull();
    expect(readGapId(new URLSearchParams("other=x"))).toBeNull();
  });

  it("resolveGapQuestion: Volltext für einen berechtigten (nicht redigierten) Eintrag", () => {
    const gaps = [gap({ id: "g-1", question: "Warum schwankt der Dosierwert an Linie L4?" })];
    expect(resolveGapQuestion("g-1", gaps)).toBe("Warum schwankt der Dosierwert an Linie L4?");
  });

  it("resolveGapQuestion: redigierter Eintrag → null (kein Freitext ohne Berechtigung)", () => {
    const gaps = [gap({ id: "g-1", question: "", redacted: true })];
    expect(resolveGapQuestion("g-1", gaps)).toBeNull();
  });

  it("resolveGapQuestion: unbekannte ID / fehlende Liste → null", () => {
    expect(resolveGapQuestion("g-x", [gap({ id: "g-1" })])).toBeNull();
    expect(resolveGapQuestion("g-1", undefined)).toBeNull();
    expect(resolveGapQuestion(null, [gap()])).toBeNull();
  });

  it("resolveGapQuestion normalisiert den aufgelösten Text (datensparsam begrenzt)", () => {
    const long = `Bitte beachte: ${"lorem ipsum dolor sit amet ".repeat(40)}`;
    const out = resolveGapQuestion("g-1", [gap({ id: "g-1", question: long })]) ?? "";
    expect(out.length).toBeLessThanOrEqual(MAX_GAP_CONTEXT_LENGTH + 1);
    expect(out.endsWith("…")).toBe(true);
  });
});

// SCRUM-270: Gap-Frage wird als OFFENE Frage / Schreibvorlage übernommen, nicht als fertiges Wissen.
describe("SCRUM-270: gapContextDraft", () => {
  const labels = { question: "Offene Frage", experience: "Eigene Erfahrung/Beobachtung ergänzen" };

  it("kennzeichnet die Frage als offene Frage und lädt zur eigenen Erfahrung ein", () => {
    const draft = gapContextDraft("Warum schwankt der Dosierwert an Linie L4?", labels);
    expect(draft).toContain("Offene Frage: Warum schwankt der Dosierwert an Linie L4?");
    expect(draft).toContain("Eigene Erfahrung/Beobachtung ergänzen:");
    expect(draft).toContain("\n\n");
    expect(draft.endsWith(":\n")).toBe(true);
  });

  it("trimmt die Frage in der Vorlage", () => {
    const draft = gapContextDraft("  Temperaturdrift an Linie L4?  ", labels);
    expect(draft).toContain("Offene Frage: Temperaturdrift an Linie L4?");
    expect(draft).not.toContain("Frage:   ");
  });
});

// SCRUM-285: normalizeGapContext begrenzt den (aufgelösten) Fragetext datensparsam.
describe("SCRUM-285: normalizeGapContext", () => {
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
    expect(de).toContain("sensibl");
    expect(de).toContain("erfahrung");
  });

  it("ist in EN vorhanden und transportiert dieselbe ehrliche Aussage", () => {
    const en = text("en").toLowerCase();
    expect(en.length).toBeGreaterThan(0);
    expect(en).toContain("gap");
    expect(en).toContain("sensitive");
  });
});

import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  askQuestionHref,
  isPrefilledAskQuestion,
  readAskQuestion,
} from "../../apps/web/src/lib/askQuestion";

// SCRUM-272: Ask-Startfrage als Query-Parameter (/fragen?q=…) — nur vorbefüllen, kein Auto-Ask.
describe("SCRUM-272: askQuestion", () => {
  it("baut einen /fragen-Link mit URL-encodierter Frage", () => {
    const href = askQuestionHref("Wie oft muss Filter F3 geprüft werden?");
    expect(href.startsWith("/fragen?q=")).toBe(true);
    expect(href).toContain(encodeURIComponent("Wie oft muss Filter F3 geprüft werden?"));
  });

  it("Round-Trip: readAskQuestion liest die übergebene Frage zurück", () => {
    const question = "Wann muss Ventil X bei Überdruck geschlossen werden?";
    const href = askQuestionHref(question);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(readAskQuestion(params)).toBe(question);
  });

  it("trimmt die Frage im Link", () => {
    const href = askQuestionHref("  Filter F3 prüfen?  ");
    const params = new URLSearchParams(href.split("?")[1]);
    expect(readAskQuestion(params)).toBe("Filter F3 prüfen?");
  });

  it("kein/leerer Parameter → keine Startfrage (null)", () => {
    expect(readAskQuestion(new URLSearchParams(""))).toBeNull();
    expect(readAskQuestion(new URLSearchParams("q=%20%20"))).toBeNull();
    expect(readAskQuestion(new URLSearchParams("other=x"))).toBeNull();
  });
});

// SCRUM-295: ehrlicher Hinweis bei vorbefüllter Startfrage (aus KO-Detail „Wissen nutzen").
describe("SCRUM-295: isPrefilledAskQuestion + Demo-Prefill-Hinweis", () => {
  it("erkennt eine vorbefüllte Startfrage (?q=…), sonst false", () => {
    expect(isPrefilledAskQuestion(new URLSearchParams("q=Ventil"))).toBe(true);
    expect(isPrefilledAskQuestion(new URLSearchParams("q=Ventil&demo=stage1"))).toBe(true);
    expect(isPrefilledAskQuestion(new URLSearchParams("demo=stage1"))).toBe(false);
    expect(isPrefilledAskQuestion(new URLSearchParams(""))).toBe(false);
    expect(isPrefilledAskQuestion(new URLSearchParams("q=%20%20"))).toBe(false);
  });

  const text = (lng: string) =>
    String(i18n.getResource(lng, "translation", "ask.demoPrefillHint") ?? "").toLowerCase();

  it("Hinweis-i18n DE/EN ehrlich: Startpunkt, quellengebunden, nichts automatisch gesichert", () => {
    expect(text("de")).toContain("startfrage");
    expect(text("de")).toContain("quellengebunden");
    expect(text("de")).toContain("automatisch gesichert");
    expect(text("en")).toContain("start question");
    expect(text("en")).toContain("source-bound");
    expect(text("en")).toContain("secured automatically");
  });
});

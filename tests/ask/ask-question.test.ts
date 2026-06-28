import { describe, expect, it } from "vitest";
import { askQuestionHref, readAskQuestion } from "../../apps/web/src/lib/askQuestion";

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

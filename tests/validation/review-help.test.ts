import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { REVIEW_DECISIONS } from "../../apps/web/src/lib/reviewDecision";
import { REVIEW_HELP_IDS, REVIEW_HELP_TOPICS, reviewHelp } from "../../apps/web/src/lib/reviewHelp";
import { buildValidationFeedback } from "../../apps/web/src/lib/validationFeedback";

// SCRUM-406 (Pedi 03.07.): durchgängige, ausführliche ?-Hilfen im Prüfbereich.
// Getestet wird die zentrale Hilfe-Karte: eindeutige Themen, aufgelöste DE+EN-Texte,
// AUSFÜHRLICHE Texte (kein Ein-Satz-Alibi) — plus der B1-Angleich (Pflicht-Feedback).
describe("SCRUM-406: ?-Hilfen im Prüfbereich", () => {
  it("hat eindeutige Themen und ein stabiles Schlüssel-Schema", () => {
    expect(new Set(REVIEW_HELP_IDS).size).toBe(REVIEW_HELP_IDS.length);
    expect(REVIEW_HELP_TOPICS.length).toBe(REVIEW_HELP_IDS.length);
    expect(REVIEW_HELP_TOPICS.length).toBeGreaterThanOrEqual(25);
    const topic = reviewHelp("approve");
    expect(topic.titleKey).toBe("vhelp.approve.title");
    expect(topic.bodyKey).toBe("vhelp.approve.body");
  });

  it("löst jeden Titel und Text in DE und EN auf — ausführlich, nicht als Alibi", async () => {
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const topic of REVIEW_HELP_TOPICS) {
        const title = i18n.t(topic.titleKey);
        const body = i18n.t(topic.bodyKey);
        expect(title, `${lng}:${topic.titleKey}`).not.toBe(topic.titleKey);
        expect(body, `${lng}:${topic.bodyKey}`).not.toBe(topic.bodyKey);
        expect(title.length, `${lng}:${topic.titleKey}`).toBeGreaterThan(3);
        // Ticket-Vorgabe „AUSFÜHRLICH": jede Hilfe erklärt Was/Wann/Danach — das geht
        // nicht unter 120 Zeichen. Schützt vor stillem Eindampfen der Texte.
        expect(body.length, `${lng}:${topic.bodyKey}`).toBeGreaterThan(120);
      }
    }
  });

  it("deckt die drei Prüfentscheidungen des Boards ab (up/warn/down)", () => {
    const decisionTopics = ["approve", "query", "reject"] as const;
    for (const id of decisionTopics) {
      expect(REVIEW_HELP_IDS).toContain(id);
    }
    // B1-Angleich: Rückfrage/Ablehnen sind auch im KO-Detail nur mit Begründung möglich —
    // dieselbe Regel-Quelle wie auf dem Board (requiresFeedback) plus Pflicht-Text-Guard.
    const byVerdict = new Map(REVIEW_DECISIONS.map((d) => [d.verdict, d.requiresFeedback]));
    expect(byVerdict.get("up")).toBe(false);
    expect(byVerdict.get("warn")).toBe(true);
    expect(byVerdict.get("down")).toBe(true);
    expect(() => buildValidationFeedback("warn", "   ")).toThrow();
  });
});

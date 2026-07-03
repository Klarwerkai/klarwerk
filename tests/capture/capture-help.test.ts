import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  CAPTURE_HELP_IDS,
  CAPTURE_HELP_TOPICS,
  captureHelp,
} from "../../apps/web/src/lib/captureHelp";

// SCRUM-407 (Pedi 03.07.): durchgängige, ausführliche ?-Hilfen im Erfassen-Weg.
// Getestet wird die zentrale Hilfe-Karte (Gegenstück zu SCRUM-406 im Prüfbereich):
// eindeutige Themen, aufgelöste DE+EN-Texte, AUSFÜHRLICHE Texte (kein Ein-Satz-Alibi).
describe("SCRUM-407: ?-Hilfen im Erfassen-Weg", () => {
  it("hat eindeutige Themen und ein stabiles Schlüssel-Schema (chelp.*)", () => {
    expect(new Set(CAPTURE_HELP_IDS).size).toBe(CAPTURE_HELP_IDS.length);
    expect(CAPTURE_HELP_TOPICS.length).toBe(CAPTURE_HELP_IDS.length);
    expect(CAPTURE_HELP_TOPICS.length).toBeGreaterThanOrEqual(22);
    const topic = captureHelp("modes");
    expect(topic.titleKey).toBe("chelp.modes.title");
    expect(topic.bodyKey).toBe("chelp.modes.body");
  });

  it("löst jeden Titel und Text in DE und EN auf — ausführlich, nicht als Alibi", async () => {
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const topic of CAPTURE_HELP_TOPICS) {
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

  it("deckt die Kernstationen des Erfassen-Wegs ab (Modi → Erzählen → Wissensseite → Einreichen)", () => {
    const stations = [
      "modes",
      "tellRaw",
      "structureNow",
      "captureTitle",
      "saveDraftHelp",
      "submitReview",
      "readiness",
      "advancedDetails",
      "expertForm",
    ] as const;
    for (const id of stations) {
      expect(CAPTURE_HELP_IDS).toContain(id);
    }
  });
});

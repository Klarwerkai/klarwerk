import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { CARD_INTERACTIVE_SELECTOR, cardClickOpens } from "../../apps/web/src/lib/validationCard";

// SCRUM-416 (Pedi 03.07.): Board-Karte intuitiv öffnen — Klick auf freie Fläche navigiert,
// Klicks auf Bedienelemente (Entscheiden/Aufklappen/Links/Hilfen) navigieren NICHT mit.
describe("SCRUM-416: Flächen-Klick der Board-Karte", () => {
  const insideInteractive = { closest: (selector: string) => (selector ? {} : null) };
  const freeArea = { closest: () => null };

  it("freie Fläche öffnet, Bedienelemente öffnen nicht", () => {
    expect(cardClickOpens(freeArea)).toBe(true);
    expect(cardClickOpens(insideInteractive)).toBe(false);
  });

  it("der Selektor deckt alle Bedienelement-Arten der Karte ab", () => {
    for (const tag of [
      "a",
      "button",
      "summary",
      "details",
      "input",
      "textarea",
      "select",
      "label",
    ]) {
      expect(CARD_INTERACTIVE_SELECTOR.split(",")).toContain(tag);
    }
  });

  it("die Aufklapp- und Aktions-Beschriftungen lösen in DE und EN auf", async () => {
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const key of ["val.more", "val.editKo"]) {
        expect(i18n.t(key), `${lng}:${key}`).not.toBe(key);
      }
    }
  });
});

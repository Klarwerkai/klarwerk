// ================================================================================================
// AUFNAHME 20260922 · GESAMT-NAVIGATION · R-1023 / R-1813 — KEIN „MEINE AUFGABEN" MEHR AM WEG DORTHIN.
// ================================================================================================
//
// Anforderung (R-1023): „die Bezeichnung ‚Meine Aufgaben' sagt nicht, was gemeint ist. Sie ist
// Prüfersprache für jemanden, der gar nichts prüfen will." Den Menüpunkt selbst hat R-0962 schon
// umbenannt („Offene Aufgaben", gemessen in `tests/aufgaben-ansicht/gegenstand-statt-besitzer.test.tsx`).
// Stehen geblieben war der Verweis einer leeren Prüfliste auf dieselbe Fläche: DE „Zu meinen
// Aufgaben", EN „Go to my tasks", NL „Naar mijn taken".
//
//   A1 — die leere Prüfliste verweist über den neuen Schlüssel, nicht mehr über `empty.cta.tasks`
//   A2 — der Verweis verspricht in keiner Sprache persönliche Aufgaben und nennt den Menünamen
//   A3 — Gegenprobe: der alte Wert hätte A2 verletzt (sonst wäre A2 blind)
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { emptyStateActions } from "../../apps/web/src/lib/emptyStateActions";

const SPRACHEN = ["de", "en", "nl"] as const;

/** Besitzanzeigende Wörter je Sprache — dieselbe Liste wie im Menünamen-Test von R-0962. */
const BESITZ: Record<(typeof SPRACHEN)[number], RegExp> = {
  de: /\b(mein|meine|meinen|dein|deine|deinen|ihre)\b/i,
  en: /\b(my|your)\b/i,
  nl: /\b(mijn|jouw|je)\b/i,
};

describe("Gesamt-Navigation · der Verweis auf die offenen Aufgaben spricht wie der Menüpunkt", () => {
  it("A1 · die leere Prüfliste verweist über `aufgaben.zumBereich` auf /aufgaben", () => {
    const aktionen = emptyStateActions("validation", "experte", false);
    const aufgaben = aktionen.find((a) => a.to === "/aufgaben");
    expect(aufgaben?.labelKey).toBe("aufgaben.zumBereich");
    expect(aktionen.map((a) => a.labelKey)).not.toContain("empty.cta.tasks");
  });

  it("A2 · DE/EN/NL: kein Besitzversprechen, und der Menüname steht im Verweis", () => {
    for (const sprache of SPRACHEN) {
      const t = i18n.getFixedT(sprache);
      const verweis = t("aufgaben.zumBereich");
      expect(verweis, `${sprache}: Schlüssel fehlt`).not.toBe("aufgaben.zumBereich");
      expect(verweis, `${sprache}: „${verweis}"`).not.toMatch(BESITZ[sprache]);
      // Wortstämme statt Zeichengleichheit: DE beugt („Zu den offenen Aufgaben" ↔ „Offene Aufgaben").
      for (const wort of t("nav.tasks").toLowerCase().split(/\s+/)) {
        expect(
          verweis.toLowerCase(),
          `${sprache}: „${verweis}" nennt „${wort}" aus dem Menünamen nicht`,
        ).toContain(wort.slice(0, 4));
      }
    }
  });

  it("A3 · Gegenprobe: die alten Werte von `empty.cta.tasks` wären an A2 rot geworden", () => {
    for (const sprache of SPRACHEN) {
      const alt = i18n.getFixedT(sprache)("empty.cta.tasks");
      expect(alt, `${sprache}: „${alt}"`).toMatch(BESITZ[sprache]);
    }
  });
});

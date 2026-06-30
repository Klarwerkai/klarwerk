import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import type { KoUsability } from "../../apps/web/src/lib/koOverview";
import type { TrustBand } from "../../apps/web/src/lib/reviewSignals";
import { type TrustExplainTone, trustExplainer } from "../../apps/web/src/lib/trustExplainer";

// SCRUM-359 / AG-05 / PI-K2: DOM-freie Trust-Transparenz. Erklärt ruhig, WARUM Trust/Status so stehen,
// AUSSCHLIESSLICH aus bereits abgeleiteten Feldern (Trust-Band + Use-Nutzbarkeit). Kernaussage:
// Trust ist ein Review-/Evidenzsignal, KEINE Wahrheitsgarantie; Gelb/Rot/Konflikt = Review-/Nacharbeit.
describe("SCRUM-359: trustExplainer", () => {
  it("liefert immer Titel + Meta-Erklärung (PI-K2-Botschaft) als stabile i18n-Keys", () => {
    const ex = trustExplainer({ trustBand: "high", usability: "ready" });
    expect(ex.titleKey).toBe("trust.explain.title");
    expect(ex.metaKey).toBe("trust.explain.meta");
  });

  it("bildet das Trust-Band auf Erklärung + Ton ab (high = positiv, mid/low = warn)", () => {
    const cases: Array<{ band: TrustBand; key: string; tone: TrustExplainTone }> = [
      { band: "high", key: "trust.explain.band.high", tone: "pos" },
      { band: "mid", key: "trust.explain.band.mid", tone: "warn" },
      { band: "low", key: "trust.explain.band.low", tone: "warn" },
    ];
    for (const c of cases) {
      const ex = trustExplainer({ trustBand: c.band, usability: "ready" });
      expect(ex.bandKey).toBe(c.key);
      expect(ex.bandTone).toBe(c.tone);
    }
  });

  it("zeigt den Review-/Nacharbeitshinweis NUR, wenn das KO nicht uneingeschränkt nutzbar ist", () => {
    // ready → kein zusätzlicher Hinweis nötig (Meta-/Band-Erklärung reicht).
    expect(trustExplainer({ trustBand: "high", usability: "ready" }).reviewHintKey).toBeNull();
    // in-review / needs-work → klarer Hinweis auf Review/Nacharbeit (Amber ≠ Vollfreigabe).
    const limited: KoUsability[] = ["in-review", "needs-work"];
    for (const usability of limited) {
      expect(trustExplainer({ trustBand: "low", usability }).reviewHintKey).toBe(
        "trust.explain.review",
      );
    }
  });

  it("alle verwendeten i18n-Keys sind DE und EN vorhanden", () => {
    const keys = [
      "trust.explain.title",
      "trust.explain.meta",
      "trust.explain.band.high",
      "trust.explain.band.mid",
      "trust.explain.band.low",
      "trust.explain.review",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });
});

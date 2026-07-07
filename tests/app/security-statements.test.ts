import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { SECURITY_POINTS } from "../../apps/web/src/lib/securityStatements";

// SCRUM-432 (Pedi 03.07., VIP-Investor): Sicherheits-Aussagen — eindeutig + in DE und EN belegt.
describe("SCRUM-432: Vertrauen & Sicherheit", () => {
  it("hat mehrere eindeutige Aussagen", () => {
    expect(SECURITY_POINTS.length).toBeGreaterThanOrEqual(5);
    const ids = SECURITY_POINTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("deckt die erwarteten Sicherheits-Themen im Admin-Auszug ab", () => {
    expect(SECURITY_POINTS.map((p) => p.id)).toEqual([
      "keys",
      "localAi",
      "external",
      "audit",
      "trash",
      "roles",
      "noCustomerData",
    ]);
  });

  it("jede Aussage hat aufgelösten Titel + Text in DE und EN", async () => {
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const p of SECURITY_POINTS) {
        for (const key of [p.titleKey, p.bodyKey]) {
          const text = i18n.t(key);
          expect(text).not.toBe(key); // Schlüssel aufgelöst, nicht roh
          expect(text.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

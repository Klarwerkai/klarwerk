import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  ADMIN_SECTIONS,
  DEFAULT_ADMIN_SECTION,
  isAdminSectionId,
} from "../../apps/web/src/lib/adminSections";

// SCRUM-394 (Pedi): Admin in drei Bereiche — Zuordnung testbar, Labels in beiden Sprachen.
describe("SCRUM-394: Admin-Bereiche", () => {
  it("hat genau vier eindeutige Bereiche mit gültigem Default", () => {
    const ids = ADMIN_SECTIONS.map((s) => s.id);
    // SCRUM-432: vierter Bereich „Sicherheit" (Vertrauen & Sicherheit für Investoren).
    expect(ids).toEqual(["konten", "ki", "daten", "sicherheit"]);
    expect(new Set(ids).size).toBe(4);
    expect(isAdminSectionId(DEFAULT_ADMIN_SECTION)).toBe(true);
    expect(isAdminSectionId("unsinn")).toBe(false);
  });

  it("hat DE- und EN-Labels für jeden Bereich", async () => {
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const s of ADMIN_SECTIONS) {
        const label = i18n.t(s.labelKey);
        expect(label).not.toBe(s.labelKey); // Schlüssel aufgelöst, nicht roh
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });
});

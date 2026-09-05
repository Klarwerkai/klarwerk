import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  ADMIN_SECTIONS,
  DEFAULT_ADMIN_SECTION,
  isAdminSectionId,
} from "../../apps/web/src/lib/adminSections";

// SCRUM-394 (Pedi): Admin in Bereiche — Zuordnung testbar, Labels in beiden Sprachen.
//
// JOB 3065 H6 (Pedi 04.09., Zielbild `design/klarwerk/Admin.dc.html`): VIER Reiter statt fünf. Der
// frühere fünfte Bereich „Bereitschaft" ist keine eigene Welt, sondern eine Auskunft über den
// Zustand des Hauses — er lebt als Zeile unter „Sicherheit" weiter, mit derselben Checkliste und
// demselben Druckknopf in ihrer Detailkarte (Beleg: tests/design/h6-funktionsinventar.test.ts).
// Der Schlüssel `adm.sec.bereitschaft` bleibt deshalb in Gebrauch — als Beschriftung dieser Zeile.
describe("SCRUM-394: Admin-Bereiche", () => {
  it("hat genau vier eindeutige Bereiche mit gültigem Default", () => {
    const ids = ADMIN_SECTIONS.map((s) => s.id);
    // SCRUM-432: „Sicherheit" (Investoren) — Bereitschaft ist seit JOB 3065 eine Zeile darunter.
    expect(ids).toEqual(["konten", "ki", "daten", "sicherheit"]);
    expect(new Set(ids).size).toBe(4);
    expect(isAdminSectionId(DEFAULT_ADMIN_SECTION)).toBe(true);
    expect(isAdminSectionId("unsinn")).toBe(false);
    // Der abgelöste Bereich ist wirklich weg und nicht bloß versteckt.
    expect(isAdminSectionId("bereitschaft")).toBe(false);
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

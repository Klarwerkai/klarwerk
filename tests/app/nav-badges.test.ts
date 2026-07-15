import { describe, expect, it } from "vitest";
import { NAV_BADGE_LABEL_KEY, navBadgeLabelKey } from "../../apps/web/src/app/useNavBadges";

// SCRUM-486 E: Jeder Sidebar-Badge trägt seine Bedeutung — die Zahl allein ist mehrdeutig. navBadgeLabelKey
// bildet den Badge-Schlüssel auf einen i18n-Schlüssel mit {{count}} ab (→ title/aria-label in der Sidebar).
describe("SCRUM-486 E: navBadgeLabelKey", () => {
  it("bildet Konflikte/Duplikate/Aufgaben/Prüfung auf sprechende i18n-Schlüssel ab", () => {
    expect(navBadgeLabelKey("conflicts")).toBe("nav.badge.conflicts");
    expect(navBadgeLabelKey("duplicates")).toBe("nav.badge.duplicates");
    expect(navBadgeLabelKey("tasks")).toBe("nav.badge.tasks");
    expect(navBadgeLabelKey("validation")).toBe("nav.badge.validation");
  });

  it("liefert für Badges ohne Bedeutung undefined (nur Zahl, kein irreführendes Label)", () => {
    expect(navBadgeLabelKey("lifecycle")).toBeUndefined();
    expect(navBadgeLabelKey("unbekannt")).toBeUndefined();
  });

  it("Widersprüche und Dubletten sind getrennte, unterscheidbare Schlüssel", () => {
    expect(NAV_BADGE_LABEL_KEY.conflicts).not.toBe(NAV_BADGE_LABEL_KEY.duplicates);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";

// B1/B1b/B2 (Pedi-UX-Fixes): Source-Inspektion (Muster capture-from-file) + i18n-Vollständigkeit.
// Reine statische Belege — keine DOM-Render-Abhängigkeit.

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("B1: Topbar-Layout robust (keine Header-Überlappung)", () => {
  const src = read("apps/web/src/shell/Topbar.tsx");
  it("das Such-Formular hat min-w-0 (gibt bei Enge nach statt zu überlagern)", () => {
    expect(src).toMatch(/<form[\s\S]*?className="[^"]*\bmin-w-0\b/);
  });
  // WP-SAMMEL20-FIX (bens Fix 5, Viewport-Kante): der rechte Block ist nicht mehr starr shrink-0 —
  // bei SEHR schmalen Breiten darf er selbst schrumpfen (min-w-0, shrink) statt aus dem Header zu
  // laufen; overflow-hidden kappt sauber. Die Suche gibt weiterhin ZUERST nach (min-w-0 + flex-1).
  it("der rechte Button-Block läuft bei schmalen Breiten nicht über (min-w-0/shrink/overflow-hidden)", () => {
    expect(src).toContain(
      'className="ml-auto flex min-w-0 shrink items-center justify-end gap-2 overflow-hidden"',
    );
  });
});

describe("B1b: Mobile-Ansicht hat einen Rückweg zur Vollversion", () => {
  const src = read("apps/web/src/pages/Mobile.tsx");
  // WP-SAMMEL20-FIX (bens Fix 4): der Rückweg ist kein harter Link auf /start mehr — er läuft
  // durch den NavGuard und führt zur VORHERIGEN Route (state.from) zurück; HOME_ROUTE bleibt nur
  // der Fallback für den Direkteinstieg ohne Absprungpunkt.
  it("rendert den toDesktop-Rückweg über den NavGuard zur vorherigen Route (HOME_ROUTE nur Fallback)", () => {
    expect(src).toContain("guard(() => navigate(backTo))");
    expect(src).toContain("?? HOME_ROUTE");
    expect(src).toContain("topbar.toDesktop");
    expect(src).not.toContain("to={HOME_ROUTE}");
  });
  it("topbar.toDesktop ist in DE/EN/NL vorhanden", () => {
    for (const lng of ["de", "en", "nl"]) {
      expect(
        String(i18n.getResource(lng, "translation", "topbar.toDesktop") ?? "").length,
        lng,
      ).toBeGreaterThan(0);
    }
  });
});

describe("B2: KI-Badge zeigt den Modus, DSGVO/Land nur im Tooltip", () => {
  const src = read("apps/web/src/shell/Topbar.tsx");
  it("die Pille rendert KEINE grelle DSGVO-Zeile mehr (Land · DSGVO wandert in den Tooltip)", () => {
    // Das alte Pillen-Subtitle-Muster „· {t(status.countryKey)} · {t(status.dsgvoKey)}" ist entfernt.
    expect(src).not.toContain("· {t(status.countryKey)} · {t(status.dsgvoKey)}");
    // Der Tooltip wird aus hint + detail + Land/DSGVO zusammengesetzt.
    expect(src).toContain("title={tooltip}");
    expect(src).toContain("status.countryKey && status.dsgvoKey");
  });

  it("die sichtbaren Kurz-Labels sind sachliche Moduswahl (Cloud/Lokal), DE/EN/NL", () => {
    expect(String(i18n.getResource("de", "translation", "topbar.kiExternal"))).toBe(
      "KI-Modus: Cloud",
    );
    expect(String(i18n.getResource("de", "translation", "topbar.kiInternal"))).toBe(
      "KI-Modus: Lokal",
    );
    expect(String(i18n.getResource("en", "translation", "topbar.kiExternal"))).toBe(
      "AI mode: Cloud",
    );
    expect(String(i18n.getResource("nl", "translation", "topbar.kiInternal"))).toBe(
      "AI-modus: Lokaal",
    );
    // Kein grelles „Externe KI"/„DSGVO: nein" mehr im sichtbaren Label.
    expect(String(i18n.getResource("de", "translation", "topbar.kiExternal"))).not.toContain(
      "Externe",
    );
  });

  it("die EHRLICHKEIT bleibt: der Hinweistext nennt DSGVO weiterhin klar", () => {
    expect(String(i18n.getResource("de", "translation", "topbar.kiExternalHint"))).toMatch(/DSGVO/);
    expect(String(i18n.getResource("de", "translation", "topbar.kiDsgvoNo"))).toBe("DSGVO: nein");
  });
});

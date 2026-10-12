// ================================================================================================
// AUFNAHME gesamt-rollen-navigation · R-1027, R-0535, R-0516 — DIE ROLLENMATRIX IM KLARTEXT.
// ================================================================================================
//
// R-1027: „Experten sehen Erfassen und Aufgaben, Controller zusätzlich Validierung und Konflikte,
// Admins die Steuerung. Nicht erlaubte Bereiche erscheinen gar nicht erst."
// R-0535: vier Rollen; „jede höhere Rolle schließt die Rechte der niedrigeren ein".
//
// Dass die GEMOUNTETE Navigation genau die Einträge des Modells zeigt, belegt bereits
// `tests/fe002-kopfband/kopfband-fe002.test.tsx` (E4, je Rolle). Jener Fall vergleicht aber gegen
// das Modell selbst — hätte das Modell die falsche Schwelle, wären beide Seiten gleich falsch. Diese
// Datei hält deshalb den WORTLAUT der Anforderung gegen die produktive Tabelle `navigation.ts`.
import { describe, expect, it } from "vitest";
import {
  ALL_ITEMS,
  GUARDED_ITEMS,
  ROLES,
  ROLE_RANK,
  type Role,
  canSee,
} from "../../apps/web/src/app/navigation";

/** Was die Navigation einer Rolle (erweiterte Module aus) anbietet — als Pfadmenge. */
function sichtbar(rolle: Role): Set<string> {
  return new Set(ALL_ITEMS.filter((i) => canSee(i, rolle, false)).map((i) => i.path));
}

describe("R-0535 · vier Rollen, jede höhere schließt die niedrigeren ein", () => {
  it("genau vier Rollen in fester Rangfolge", () => {
    expect([...ROLES]).toEqual(["viewer", "experte", "controller", "admin"]);
    const raenge = ROLES.map((r) => ROLE_RANK[r]);
    expect(raenge).toEqual([...raenge].sort((a, b) => a - b));
    expect(new Set(raenge).size).toBe(4);
  });

  it("was eine Rolle sehen darf, darf jede höhere auch (an allen bewachten Routen)", () => {
    const verstoesse: string[] = [];
    for (const item of GUARDED_ITEMS) {
      for (const [i, niedriger] of ROLES.entries()) {
        for (const hoeher of ROLES.slice(i + 1)) {
          if (canSee(item, niedriger, true) && !canSee(item, hoeher, true)) {
            verstoesse.push(`${item.path}: ${niedriger} ja, ${hoeher} nein`);
          }
        }
      }
    }
    expect(verstoesse).toEqual([]);
  });
});

describe("R-1027 / R-0516 · die Seitenleiste zeigt nur, was zur Rolle passt", () => {
  const ERFASSEN = "/erfassen";
  const AUFGABEN = "/aufgaben";
  const VALIDIERUNG = "/validierung";
  const KONFLIKTE = "/konflikte";
  const STEUERUNG = "/admin";

  it("Betrachter: keiner der fünf Arbeitsbereiche erscheint", () => {
    const s = sichtbar("viewer");
    for (const p of [ERFASSEN, AUFGABEN, VALIDIERUNG, KONFLIKTE, STEUERUNG]) {
      expect(s.has(p), p).toBe(false);
    }
  });

  it("Experte: Erfassen und Aufgaben — Validierung, Konflikte, Steuerung erscheinen gar nicht", () => {
    const s = sichtbar("experte");
    expect(s.has(ERFASSEN)).toBe(true);
    expect(s.has(AUFGABEN)).toBe(true);
    expect(s.has(VALIDIERUNG)).toBe(false);
    expect(s.has(KONFLIKTE)).toBe(false);
    expect(s.has(STEUERUNG)).toBe(false);
  });

  it("Controller: zusätzlich Validierung und Konflikte — die Steuerung erscheint nicht", () => {
    const s = sichtbar("controller");
    for (const p of [ERFASSEN, AUFGABEN, VALIDIERUNG, KONFLIKTE]) {
      expect(s.has(p), p).toBe(true);
    }
    expect(s.has(STEUERUNG)).toBe(false);
  });

  it("Admin: zusätzlich die Steuerung", () => {
    const s = sichtbar("admin");
    for (const p of [ERFASSEN, AUFGABEN, VALIDIERUNG, KONFLIKTE, STEUERUNG]) {
      expect(s.has(p), p).toBe(true);
    }
  });
});

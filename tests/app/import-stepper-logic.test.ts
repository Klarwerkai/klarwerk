// WP-COCKPIT-LINIE: pure Logik der geführten Fünf-Schritte-Leiste — Zuordnung Stufe → Schritt-
// Zustand (erledigt/aktiv/kommend) und die Monotonie (einmal Erreichtes fällt nie zurück, auch
// wenn ein Baustein remountet, z. B. nach geänderter Eingrenzung).
import { describe, expect, it } from "vitest";
import {
  IMPORT_STEPS,
  IMPORT_STEP_TEXT,
  type ImportStage,
  importStepStatus,
  maxStage,
} from "../../apps/web/src/lib/importStepper";

function statuses(stage: ImportStage): string[] {
  return IMPORT_STEPS.map((step) => importStepStatus(stage, step));
}

describe("WP-COCKPIT-LINIE: importStepStatus", () => {
  it("vor der Erkundung ist Schritt 1 (Quelle) aktiv, alles Weitere kommend", () => {
    expect(statuses("start")).toEqual(["active", "upcoming", "upcoming", "upcoming", "upcoming"]);
  });

  it("Landkarte da (explored): Quelle + Erkunden erledigt, Eingrenzen aktiv", () => {
    expect(statuses("explored")).toEqual(["done", "done", "active", "upcoming", "upcoming"]);
  });

  it("nach der Vorschau (previewed) ist Schritt 3 erledigt und Schritt 4 aktiv", () => {
    expect(statuses("previewed")).toEqual(["done", "done", "done", "active", "upcoming"]);
  });

  it("Gruppen sichtbar (grouping): Schritt 4 bleibt aktiv", () => {
    expect(statuses("grouping")).toEqual(["done", "done", "done", "active", "upcoming"]);
  });

  it("Bilanz da (applied): alle fünf Schritte erledigt, keiner mehr aktiv", () => {
    expect(statuses("applied")).toEqual(["done", "done", "done", "done", "done"]);
  });
});

describe("WP-COCKPIT-LINIE: maxStage (Monotonie)", () => {
  it("eine höhere Stufe gewinnt, eine niedrigere fällt nie zurück", () => {
    expect(maxStage("start", "previewed")).toBe("previewed");
    expect(maxStage("previewed", "explored")).toBe("previewed");
    expect(maxStage("applied", "start")).toBe("applied");
    expect(maxStage("grouping", "grouping")).toBe("grouping");
  });
});

describe("WP-COCKPIT-LINIE: Copy-Schlüssel", () => {
  it("jeder Schritt hat Titel- und Hinweis-Schlüssel im imp.step-Namensraum", () => {
    for (const step of IMPORT_STEPS) {
      expect(IMPORT_STEP_TEXT[step].title).toMatch(/^imp\.step\./);
      expect(IMPORT_STEP_TEXT[step].hint).toMatch(/^imp\.step\..*Hint$/);
    }
  });
});

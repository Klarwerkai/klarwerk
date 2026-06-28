import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { DEMO_PILOT_PATH, demoPilotPath } from "../../apps/web/src/lib/demoPilotPath";

// SCRUM-290: kompakter Demo-/Pilotpfad Start → Ask → Library/KO-Detail → Validation.
describe("SCRUM-290: demoPilotPath", () => {
  it("führt in 3 Schritten Ask → Library → Validation (nur vorhandene Routen)", () => {
    const steps = demoPilotPath();
    expect(steps.map((s) => s.id)).toEqual(["ask", "library", "validation"]);
    expect(steps.map((s) => s.n)).toEqual([1, 2, 3]);
  });

  it("Schritt 1 (Ask) ist quellengebunden via demo-sicherer Startfrage (?q=, kein Auto-Submit)", () => {
    const ask = DEMO_PILOT_PATH[0];
    expect(ask?.id).toBe("ask");
    expect(ask?.to.startsWith("/fragen?q=")).toBe(true);
    // demo-sicher: trifft validiertes Seed-Wissen (Ventil X / Überdruck) → quellengebunden, keine Lücke.
    expect(decodeURIComponent(ask?.to ?? "")).toContain("Ventil X bei Überdruck");
  });

  it("Schritt 2/3 zeigen Wissensbestand und Validierung über vorhandene Routen", () => {
    expect(DEMO_PILOT_PATH[1]?.to).toBe("/bibliothek");
    expect(DEMO_PILOT_PATH[2]?.to).toBe("/validierung");
  });

  it("nutzt ausschließlich vorhandene Routen (keine neue Navigation)", () => {
    const allowed = new Set(["/bibliothek", "/validierung"]);
    for (const s of DEMO_PILOT_PATH) {
      const base = s.to.split("?")[0] ?? s.to;
      expect(base === "/fragen" || allowed.has(base)).toBe(true);
    }
  });

  const text = (lng: string, key: string) =>
    String(i18n.getResource(lng, "translation", key) ?? "").toLowerCase();

  it("i18n DE/EN: jeder Schritt hat nicht-leere Label/Beschreibung + Karten-Titel", () => {
    for (const lng of ["de", "en"]) {
      expect(text(lng, "demo.title").length).toBeGreaterThan(0);
      expect(text(lng, "demo.subtitle").length).toBeGreaterThan(0);
      for (const s of DEMO_PILOT_PATH) {
        expect(text(lng, s.labelKey).length).toBeGreaterThan(0);
        expect(text(lng, s.descKey).length).toBeGreaterThan(0);
      }
    }
  });

  it("i18n macht den Knowledge-OS-Kern sichtbar: quellengebunden, Status/Trust, Validierung", () => {
    expect(text("de", "demo.ask.desc")).toContain("quellengebunden");
    expect(text("de", "demo.library.desc")).toContain("status");
    expect(text("de", "demo.validation.desc")).toContain("validierung");
    expect(text("en", "demo.ask.desc")).toContain("source-bound");
    expect(text("en", "demo.validation.desc")).toContain("validation");
  });
});

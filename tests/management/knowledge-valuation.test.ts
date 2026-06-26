import { describe, expect, it } from "vitest";
import {
  DEFAULT_ASSUMPTIONS,
  estimateValuation,
  formatEur,
} from "../../apps/web/src/lib/knowledgeValuation";

const facts = (validatedKos: number, avgTrust = 100) => ({
  validatedKos,
  totalKos: validatedKos,
  avgTrust,
});

describe("FE-MGMT-04: estimateValuation", () => {
  it("rechnet Fakten × Annahmen (Default), Trust=100 → voller Wert", () => {
    const r = estimateValuation(facts(10, 100));
    // 10 × (60 × 2 × 3) × 1.0 = 3600
    expect(r.perKoEur).toBe(360);
    expect(r.estimateEur).toBe(3600);
    expect(r.formula).toContain("Wiederverwendung");
  });

  it("Ø-Trust dämpft den Wert (Qualitätsfaktor)", () => {
    expect(estimateValuation(facts(10, 50)).estimateEur).toBe(1800); // 3600 × 0.5
  });

  it("leerer Bestand → 0", () => {
    expect(estimateValuation(facts(0)).estimateEur).toBe(0);
  });

  it("geänderte Annahmen wirken transparent", () => {
    const r = estimateValuation(facts(5, 100), {
      hourlyRate: 100,
      hoursSavedPerValidatedKo: 1,
      reuseFactor: 1,
    });
    expect(r.perKoEur).toBe(100);
    expect(r.estimateEur).toBe(500);
  });

  it("mehr validierte Objekte → monoton höherer Wert", () => {
    const a = estimateValuation(facts(5, 80), DEFAULT_ASSUMPTIONS).estimateEur;
    const b = estimateValuation(facts(10, 80), DEFAULT_ASSUMPTIONS).estimateEur;
    expect(b).toBeGreaterThan(a);
  });

  it("formatEur formatiert mit €", () => {
    expect(formatEur(3600)).toContain("€");
  });
});

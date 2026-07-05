import { describe, expect, it } from "vitest";
import {
  DEFAULT_OVERLAP_SETTINGS,
  InMemoryOverlapSettingsRepo,
  normalizeOverlapSettings,
} from "./overlap-settings";
import { OverlapError } from "./overlap-types";

describe("Berater-Konzept Duplikate 04.07. (Pedi): einstellbare Anzeige-Schwelle", () => {
  it("Startwert 0,5", () => {
    expect(DEFAULT_OVERLAP_SETTINGS.minConfidence).toBe(0.5);
  });

  it("normalisiert gültige Werte und rundet prozentgenau", () => {
    expect(normalizeOverlapSettings({ minConfidence: 0.5 }).minConfidence).toBe(0.5);
    expect(normalizeOverlapSettings({ minConfidence: 0.734 }).minConfidence).toBe(0.73);
    expect(normalizeOverlapSettings({ minConfidence: 0.05 }).minConfidence).toBe(0.05);
    expect(normalizeOverlapSettings({ minConfidence: 0.99 }).minConfidence).toBe(0.99);
  });

  it("weist Werte außerhalb des Bandes und Nicht-Zahlen ab (Bedienfehler)", () => {
    expect(() => normalizeOverlapSettings({ minConfidence: 0 })).toThrow(OverlapError);
    expect(() => normalizeOverlapSettings({ minConfidence: 1 })).toThrow(OverlapError);
    expect(() => normalizeOverlapSettings({ minConfidence: -0.2 })).toThrow(OverlapError);
    expect(() => normalizeOverlapSettings({ minConfidence: "viel" })).toThrow(OverlapError);
    expect(() => normalizeOverlapSettings({})).toThrow(OverlapError);
  });

  it("InMemory-Repo: null bis gesetzt, danach der letzte Wert", async () => {
    const repo = new InMemoryOverlapSettingsRepo();
    expect(await repo.get()).toBeNull();
    await repo.set({ minConfidence: 0.42 });
    expect((await repo.get())?.minConfidence).toBe(0.42);
  });
});

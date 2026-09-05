// @vitest-environment jsdom
// ================================================================================================
// JOB 3060 · H1 — MODERN FÜR ALLE: die Vorgabe des Design-Schalters ist „modern“.
// ================================================================================================
//
// Bis H1 startete jeder Browser ohne gespeicherte Wahl in Klassisch (`initDesignTheme` fiel auf
// "classic" zurück, lib/designTheme.ts). Die Mockups sind die Werkbank-Palette; Pedi will sie ohne
// Klick sehen. Gepinnt wird die Logik der einen Wahrheit über den Schalter — DOM-frei, wie die
// Datei selbst: `initDesignTheme()` setzt `data-theme="modern"`, wenn nichts gespeichert ist, und
// achtet eine gespeicherte Wahl („classic“ = KEIN Attribut) weiterhin.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_DESIGN_THEME,
  DESIGN_THEME_ATTRIBUTE,
  DESIGN_THEME_STORAGE_KEY,
  initDesignTheme,
} from "../../apps/web/src/lib/designTheme";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute(DESIGN_THEME_ATTRIBUTE);
});

describe("JOB 3060 · H1 · die Vorgabe des Design-Schalters", () => {
  it("die Vorgabe heißt modern", () => {
    expect(DEFAULT_DESIGN_THEME).toBe("modern");
  });

  it("ohne gespeicherte Wahl setzt initDesignTheme data-theme=modern an <html>", () => {
    expect(localStorage.getItem(DESIGN_THEME_STORAGE_KEY)).toBeNull();
    initDesignTheme();
    expect(document.documentElement.getAttribute(DESIGN_THEME_ATTRIBUTE)).toBe("modern");
  });

  it("eine gespeicherte Wahl „classic“ gewinnt über die Vorgabe — Klassisch = kein Attribut", () => {
    localStorage.setItem(DESIGN_THEME_STORAGE_KEY, "classic");
    document.documentElement.setAttribute(DESIGN_THEME_ATTRIBUTE, "modern");
    initDesignTheme();
    expect(document.documentElement.hasAttribute(DESIGN_THEME_ATTRIBUTE)).toBe(false);
  });

  it("ein unbekannter gespeicherter Wert fällt auf die Vorgabe modern zurück", () => {
    localStorage.setItem(DESIGN_THEME_STORAGE_KEY, "neon");
    initDesignTheme();
    expect(document.documentElement.getAttribute(DESIGN_THEME_ATTRIBUTE)).toBe("modern");
  });

  it("main.tsx ruft initDesignTheme VOR dem ersten Render — die Vorgabe gilt vor dem ersten Bild", () => {
    // Quelltextpin an der Wurzel: der Aufruf steht vor createRoot(...).render(...).
    const main = readFileSync(join(process.cwd(), "apps/web/src/main.tsx"), "utf8");
    expect(main.indexOf("initDesignTheme();")).toBeGreaterThan(0);
    expect(main.indexOf("initDesignTheme();")).toBeLessThan(main.indexOf("createRoot("));
  });
});

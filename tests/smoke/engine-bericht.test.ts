// ================================================================================================
// AUFNAHME 20260922 · BROWSER-KERNPRÜFUNG — WÄCHTER ÜBER DEN ENGINE-BERICHT DES SMOKE-LAUFS.
// ================================================================================================
//
// R-1382 verlangt: „der Durchlauf sagt, welche Browser er wirklich gefahren hat". Der Bericht
// (`tests-smoke/support/engine-bericht.ts`) zählt aus Playwrights Ergebnissen, nicht aus der
// Konfiguration. Diese Datei sichert die Zählung in beide Richtungen ab — ein Bericht, der immer
// „drei Engines" sagt, wäre dieselbe leere Zusicherung wie der frühere `ask-answer`-Anker (R-1170).
//
// Sie startet keinen Browser: der Reporter wird mit nachgebauten Fall-/Ergebnisobjekten gefüttert.
// Ob er im echten Lauf ausgibt, zeigt das Protokoll eines `smoke:ui:gate`-Laufs.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import EngineBericht, {
  type Ergebnis,
  engineBerichtText,
  engineBilanz,
  engineVonProjekt,
} from "../../tests-smoke/support/engine-bericht";

const WURZEL = resolve(__dirname, "../..");

/** Ein Fall wie Playwright ihn reicht — nur die Teile, die der Bericht liest. */
function fall(id: string, projekt: string, geraet: "chromium" | "firefox" | "webkit") {
  return {
    id,
    parent: { project: () => ({ name: projekt, use: { defaultBrowserType: geraet } }) },
  };
}

const viele = (engine: string, status: Ergebnis["status"], n: number): Ergebnis[] =>
  Array.from({ length: n }, () => ({ engine, status }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Engine-Bericht · Bilanz", () => {
  it("E1 · ein Tor-Lauf nur in Chromium benennt Firefox und WebKit als NICHT gefahren", () => {
    const bilanz = engineBilanz([
      ...viele("chromium", "passed", 5),
      ...viele("chromium", "skipped", 2),
    ]);
    expect(bilanz.gefahren).toEqual([
      { engine: "chromium", bestanden: 5, uebersprungen: 2, rot: 0 },
    ]);
    expect(bilanz.nichtGefahren).toEqual(["firefox", "webkit"]);
    const text = engineBerichtText(bilanz);
    expect(text).toContain("nicht gefahren:       firefox, webkit");
    expect(text).toContain("belegt NICHT alle drei Engines");
    expect(text).not.toContain("Alle drei Engines");
  });

  it("E2 · nur wenn alle drei wirklich liefen, sagt der Bericht „alle drei“", () => {
    const bilanz = engineBilanz([
      ...viele("chromium", "passed", 3),
      ...viele("firefox", "passed", 3),
      ...viele("webkit", "failed", 1),
      ...viele("webkit", "passed", 2),
    ]);
    expect(bilanz.gefahren.map((z) => z.engine)).toEqual(["chromium", "firefox", "webkit"]);
    expect(bilanz.nichtGefahren).toEqual([]);
    // Ein roter Fall ist GEFAHREN — er wird gezählt, nicht verschluckt.
    expect(bilanz.gefahren[2]).toEqual({
      engine: "webkit",
      bestanden: 2,
      uebersprungen: 0,
      rot: 1,
    });
    expect(engineBerichtText(bilanz)).toContain("Alle drei Engines");
  });

  it("E3 · KALIBRIERUNG: nur übersprungene Fälle machen keine Engine gefahren", () => {
    const bilanz = engineBilanz([
      ...viele("chromium", "passed", 4),
      ...viele("firefox", "skipped", 4),
      ...viele("webkit", "passed", 1),
    ]);
    expect(bilanz.gefahren.map((z) => z.engine)).toEqual(["chromium", "webkit"]);
    expect(bilanz.nurUebersprungen).toEqual([
      { engine: "firefox", bestanden: 0, uebersprungen: 4, rot: 0 },
    ]);
    expect(engineBerichtText(bilanz)).toContain("belegt NICHT alle drei Engines");
  });

  it("E4 · timedOut und interrupted zählen als rot, nicht als bestanden", () => {
    const bilanz = engineBilanz([
      { engine: "chromium", status: "timedOut" },
      { engine: "chromium", status: "interrupted" },
    ]);
    expect(bilanz.gefahren).toEqual([
      { engine: "chromium", bestanden: 0, uebersprungen: 0, rot: 2 },
    ]);
  });
});

describe("Engine-Bericht · Reporter", () => {
  it("E5 · Setup-Projekte tragen keine Engine-Aussage; Gerät und browserName zählen", () => {
    const chromiumGeraet = { defaultBrowserType: "chromium" };
    expect(engineVonProjekt({ name: "setup", use: chromiumGeraet })).toBeUndefined();
    expect(engineVonProjekt({ name: "setup-zustand", use: chromiumGeraet })).toBeUndefined();
    expect(engineVonProjekt({ name: "chromium", use: chromiumGeraet })).toBe("chromium");
    const webkitGeraet = { defaultBrowserType: "webkit" };
    expect(engineVonProjekt({ name: "webkit", use: webkitGeraet })).toBe("webkit");
    const ausdruecklich = { browserName: "firefox", defaultBrowserType: "chromium" };
    expect(engineVonProjekt({ name: "x", use: ausdruecklich })).toBe("firefox");
    expect(engineVonProjekt(undefined)).toBeUndefined();
  });

  it("E6 · je Fall zählt das LETZTE Ergebnis; die Bilanz erscheint am Laufende", () => {
    const ausgabe = vi.spyOn(console, "log").mockImplementation(() => {});
    const bericht = new EngineBericht();
    // Ersteinrichtung — läuft in Chromium, ist aber kein Engine-Beleg.
    bericht.onTestEnd(fall("s1", "setup", "chromium"), { status: "passed" });
    // Ein Fall mit Wiederholung: erst rot, dann grün — er zählt EINMAL, als bestanden.
    bericht.onTestEnd(fall("t1", "chromium", "chromium"), { status: "failed" });
    bericht.onTestEnd(fall("t1", "chromium", "chromium"), { status: "passed" });
    bericht.onTestEnd(fall("t2", "chromium-zustand", "chromium"), { status: "passed" });
    bericht.onTestEnd(fall("t3", "chromium", "chromium"), { status: "skipped" });
    bericht.onEnd();

    expect(ausgabe).toHaveBeenCalledTimes(1);
    const text = String(ausgabe.mock.calls[0]?.[0]);
    expect(text).toContain("gefahren:             chromium (2 bestanden, 1 übersprungen, 0 rot)");
    expect(text).toContain("nicht gefahren:       firefox, webkit");
    expect(bericht.printsToStdio()).toBe(false);
  });

  it("E7 · die Smoke-Konfiguration meldet den Bericht an, die Datei existiert", () => {
    const konfig = readFileSync(resolve(WURZEL, "playwright.smoke.config.ts"), "utf8");
    const reporter = /^\s*reporter:\s*(\[.*\]),\s*$/m.exec(konfig)?.[1] ?? "";
    expect(reporter, "keine reporter-Zeile in playwright.smoke.config.ts").not.toBe("");
    expect(reporter).toContain('["list"]');
    expect(reporter).toContain('["./tests-smoke/support/engine-bericht.ts"]');
    expect(existsSync(resolve(WURZEL, "tests-smoke/support/engine-bericht.ts"))).toBe(true);
  });
});

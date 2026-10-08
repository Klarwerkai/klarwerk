// ================================================================================================
// AUFNAHME 20260922 · GESAMT-NAVIGATION — GEGENPROBE ZUM NACHGEFÜHRTEN SMOKE-MENGENMANIFEST.
// ================================================================================================
//
// Dieser Auftrag hat den U3-Fall (R-1813, OFFEN.md U3) aus `erstnutzer-u2-u3-browser.spec.ts` in
// `gesamt-navigation-u3-browser.spec.ts` verschoben, umbenannt und `tests/smoke/smoke-mengen-manifest.json`
// nachgeführt (Version 15, zusammengeführt mit den klara-vorschau-Fällen aus main).
//
// Der eigentliche Wächter des Manifests ist `tests/smoke/mengenpruefung.test.ts`. Er vergleicht mit
// `playwright --list` und trägt eine fremde, vorgefundene Drift (zwei Smoke-Dateien stehen nicht im
// Manifest). Diese Datei prüft deshalb ohne Playwright genau die Stellen, die dieser Auftrag
// geändert hat, gegen die Testdateien selbst:
//
//   M1 — der U3-Titel im Manifest ist wörtlich der `test(...)`-Titel der neuen Datei, je Projekt
//        chromium, firefox und webkit genau einmal
//   M2 — die alte Datei trägt keinen U3-Fall mehr, das Manifest keinen alten U3-Titel; ihre zwei
//        U2-Fälle stehen weiter in Datei und Manifest
//   M3 — die Form, die die Integration hätte brechen können: jede Titelliste sortiert wie `--list`
//        (`[...].sort()`), Sollzahl = Listenlänge, Summe = `gesamt_fallinstanzen`
//   M4 — die neun klara-vorschau-Einträge aus main sind bei der Konfliktauflösung erhalten geblieben
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

interface Manifest {
  version: number;
  gesamt_fallinstanzen: number;
  projekte: Record<string, { soll: number; titel: string[] }>;
}

const manifest = JSON.parse(
  readFileSync(repoPfad("tests/smoke/smoke-mengen-manifest.json"), "utf8"),
) as Manifest;

const NEU = "gesamt-navigation-u3-browser.spec.ts";
const ALT = "erstnutzer-u2-u3-browser.spec.ts";
const BROWSERPROJEKTE = ["chromium", "firefox", "webkit"] as const;
/** Der Titel von U3 vor dem Umzug — er darf im Manifest nicht mehr stehen. */
const ALTER_U3 = "Meine Aufgaben“ ist über das Zahnrad";
/** Die Datei, deren Fälle main beim Integrieren mitgebracht hat (Manifest Version 14). */
const MAIN_DATEI = "klara-vorschau-browser.spec.ts › ";

/** Die Titel aller `test("…", …)`-Aufrufe einer Smoke-Datei — gelesen, nicht abgeschrieben. */
function testTitel(datei: string): string[] {
  const quelle = readFileSync(repoPfad(`tests-smoke/${datei}`), "utf8");
  return [...quelle.matchAll(/^test\("([^"]+)"/gm)].map((m) => m[1] ?? "");
}

function projekt(name: string): { soll: number; titel: string[] } {
  const p = manifest.projekte[name];
  if (!p) {
    throw new Error(`Projekt ${name} fehlt im Manifest`);
  }
  return p;
}

describe("Gesamt-Navigation · das Smoke-Mengenmanifest trägt den umgezogenen U3-Fall", () => {
  it("M1 · der U3-Titel im Manifest ist der Titel der neuen Datei, je Browserprojekt genau einmal", () => {
    const titel = testTitel(NEU);
    expect(titel, `${NEU}: erwartet genau einen Fall`).toHaveLength(1);
    const eintrag = `${NEU} › ${titel[0]}`;
    expect(titel[0]).toContain("Offene Aufgaben");
    for (const name of BROWSERPROJEKTE) {
      const vorkommen = projekt(name).titel.filter((t) => t === eintrag).length;
      expect(vorkommen, `${name}: „${eintrag}“`).toBe(1);
    }
  });

  it("M2 · die alte Datei trägt nur noch U2 — in der Datei und im Manifest", () => {
    const alt = testTitel(ALT);
    expect(alt.filter((t) => t.startsWith("U3"))).toEqual([]);
    expect(alt.filter((t) => t.startsWith("U2"))).toHaveLength(2);
    for (const name of BROWSERPROJEKTE) {
      const eintraege = projekt(name).titel.filter((t) => t.startsWith(`${ALT} › `));
      expect(eintraege, name).toEqual(alt.map((t) => `${ALT} › ${t}`).sort());
      const altU3 = projekt(name).titel.filter((t) => t.includes(ALTER_U3));
      expect(altU3, `${name}: alter U3-Titel steht noch im Manifest`).toEqual([]);
    }
  });

  it("M3 · jede Titelliste ist sortiert, Sollzahl und Summe stimmen", () => {
    let summe = 0;
    for (const [name, p] of Object.entries(manifest.projekte)) {
      expect(p.titel, `${name}: nicht sortiert wie --list`).toEqual([...p.titel].sort());
      expect(p.titel.length, `${name}: Sollzahl ≠ Listenlänge`).toBe(p.soll);
      expect(new Set(p.titel).size, `${name}: doppelter Titel`).toBe(p.titel.length);
      summe += p.soll;
    }
    expect(summe).toBe(manifest.gesamt_fallinstanzen);
    expect(manifest.version).toBe(15);
  });

  it("M4 · die klara-vorschau-Fälle aus main sind erhalten — je Browserprojekt drei", () => {
    for (const name of BROWSERPROJEKTE) {
      const ausMain = projekt(name).titel.filter((t) => t.startsWith(MAIN_DATEI));
      expect(ausMain, name).toHaveLength(3);
    }
  });
});

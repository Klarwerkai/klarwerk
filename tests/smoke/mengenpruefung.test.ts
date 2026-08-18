import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

// ================================================================================================
// JOB 1050 / D2 — P0 ALS ECHTE MENGEN- UND UMFANGSPRUEFUNG (BEN3 Korrekturpflicht 1)
// ================================================================================================
//
// BEN3 woertlich: „P0 fuehrt nur Playwrights `--list` aus und enthaelt keinen Sollvergleich."
// Und: „`playwright test --list` zaehlt entdeckte Faelle, belegt aber weder Ausfuehrung noch
// Bestehen." Eine Aufzaehlung ohne SOLL ist keine Pruefung — sie meldet jede Zahl als richtig.
//
// HIER STEHT DER SOLLVERGLEICH. Das Manifest `smoke-mengen-manifest.json` ist versioniert und
// nennt je Projekt die Sollzahl UND die vollstaendigen Titel. Damit wird nicht nur Wachsen und
// Schrumpfen rot, sondern auch UMBENENNEN — was eine reine Zahl nie sehen wuerde.
//
// WARUM DIESE PRUEFUNG BROWSERLOS IST, und warum das kein Mangel ist: `--list` wertet die echte
// Konfiguration und die echte Filtersemantik aus, startet aber weder Webserver noch Engine. Sie
// laeuft deshalb im Schritt „test" von `tools/check`, VOR dem Smoke — und sie laeuft auch dort,
// wo gar kein Browser startbar ist. Was sie NICHT belegt, steht in `torlogik.test.ts`:
// Ausfuehrung, Bestehen und Skips sind eine andere Frage und haben eine andere Zusage.

interface Manifest {
  version: number;
  gesamt_fallinstanzen: number;
  projekte: Record<string, { soll: number; titel: string[] }>;
}

interface ListedSpec {
  file?: string;
  title?: string;
  tests?: { projectName?: string }[];
}
interface ListedSuite {
  specs?: ListedSpec[];
  suites?: ListedSuite[];
}

function flatten(suites: readonly ListedSuite[]): ListedSpec[] {
  const out: ListedSpec[] = [];
  for (const suite of suites) {
    out.push(...(suite.specs ?? []));
    out.push(...flatten(suite.suites ?? []));
  }
  return out;
}

const manifest = JSON.parse(
  readFileSync(new URL("./smoke-mengen-manifest.json", import.meta.url), "utf8"),
) as Manifest;

describe("JOB 1050 D2 · P0 — Mengen- und Umfangspruefung gegen das Sollmanifest", () => {
  let ist: Record<string, string[]> = {};

  beforeAll(() => {
    const roh = execFileSync(
      "npx",
      ["playwright", "test", "--config", "playwright.smoke.config.ts", "--list", "--reporter=json"],
      {
        encoding: "utf8",
        cwd: new URL("../..", import.meta.url).pathname,
        env: { ...process.env, KLARWERK_SMOKE_MODE: "gate" },
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    const specs = flatten((JSON.parse(roh) as { suites?: ListedSuite[] }).suites ?? []);
    const gesammelt: Record<string, Set<string>> = {};
    for (const spec of specs) {
      for (const t of spec.tests ?? []) {
        const p = t.projectName ?? "";
        const bisher = gesammelt[p] ?? new Set<string>();
        bisher.add(`${spec.file} › ${spec.title}`);
        gesammelt[p] = bisher;
      }
    }
    ist = Object.fromEntries(Object.entries(gesammelt).map(([p, s]) => [p, [...s].sort()]));
  });

  it("P0a · die PROJEKTMENGE stimmt — kein Projekt kommt hinzu oder faellt weg", () => {
    expect(Object.keys(ist).sort()).toEqual(Object.keys(manifest.projekte).sort());
  });

  it("P0b · je Projekt stimmt die SOLLZAHL", () => {
    const abweichungen = Object.entries(manifest.projekte)
      .map(([p, m]) => ({ projekt: p, soll: m.soll, ist: ist[p]?.length ?? 0 }))
      .filter((a) => a.soll !== a.ist);
    expect(
      abweichungen,
      "Mengendrift: ein Fall wurde hinzugefuegt oder entfernt. Manifest bewusst nachziehen.",
    ).toEqual([]);
  });

  it("P0c · je Projekt stimmen die vollstaendigen TITEL — Umbenennen wird sichtbar", () => {
    // Der Teil, den eine blosse Zahl nicht kann: Ein umbenannter Fall haelt die Summe konstant.
    for (const [projekt, m] of Object.entries(manifest.projekte)) {
      expect(ist[projekt] ?? [], `Titeldrift in Projekt ${projekt}`).toEqual(m.titel);
    }
  });

  it("P0d · die Gesamtzahl der Fallinstanzen stimmt", () => {
    const gesamt = Object.values(ist).reduce((a, v) => a + v.length, 0);
    expect(gesamt).toBe(manifest.gesamt_fallinstanzen);
  });

  it("P0e · das Manifest ist versioniert und vollstaendig", () => {
    expect(manifest.version, "ein unversioniertes Manifest ist kein Vertrag").toBeGreaterThan(0);
    for (const [projekt, m] of Object.entries(manifest.projekte)) {
      expect(m.titel.length, `Projekt ${projekt}: Titelliste und Sollzahl widersprechen sich`).toBe(
        m.soll,
      );
    }
  });

  it("P0f · `--list` belegt AUSDRUECKLICH kein Bestehen", () => {
    // Die Zusage, die BEN3 vermisst hat: Diese Datei zaehlt Entdecktes. Wer daraus ein `n/n`
    // machen will, braucht `bilanziere()` aus `smoke-torlogik.ts` und einen echten Lauf.
    const gesamt = Object.values(ist).reduce((a, v) => a + v.length, 0);
    expect(gesamt).toBeGreaterThan(0);
    expect(
      manifest.projekte.chromium?.soll,
      "Chromium traegt Faelle — dass sie BESTEHEN, sagt diese Datei nicht",
    ).toBeGreaterThan(0);
  });
});

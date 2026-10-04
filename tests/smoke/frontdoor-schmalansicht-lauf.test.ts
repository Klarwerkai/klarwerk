// ================================================================================================
// Aufnahme `gesamt-erfassung-einstieg:layout` (Nacharbeit 3) — DER SCHMALANSICHTS-SMOKE ALS
// KONKRETE PRÜFDATEI.
// ================================================================================================
//
// BENS BEFUND: Kriterium 2 verlangt den Lauf von `tests-smoke/demo-ux-v1-capture-frontdoor.spec.ts`
// (Schmalansicht, Fall 5: 390×844 und 768×1024) commitgebunden; ohne ihn bleiben 768 px für K1
// ungeprüft. Der Prüfauftrag nimmt aber nur konkrete Vitest-Testdateien an — eine Playwright-Spec
// wurde dort abgelehnt.
//
// DIESE DATEI IST KEIN NACHBAU DER FÄLLE. Sie startet die VORHANDENEN Fälle unverändert über den
// VORHANDENEN Torweg (`package.json` → `smoke:ui:gate`: Frischeprüfung von `dist`, Browserdeckel,
// hermetische Umgebung ohne Modell, `playwright.smoke.config.ts`, Projekt `chromium-zustand` mit
// eigener Ersteinrichtung) und liest das Ergebnis aus Playwrights eigenem JSON-Bericht. Das
// Originalprotokoll des Laufs (Reporter `list`) steht unverändert in der Ausgabe dieser Datei.
//
// KALIBRIERUNG: grün ist nur, wenn GENAU die zwei Schmalansichtsfälle im Projekt `chromium-zustand`
// gelaufen und bestanden sind. Ein Lauf, der nichts findet (falscher Filter, umbenannter Titel,
// fehlendes Projekt), ist rot und nicht still grün.
//
// WARUM DER TYP-IMPORT AUS `@playwright/test/reporter`: er ordnet die Datei über den Importgraphen
// (`tests/tor-inventar/browser-gruppe.ts`) der seriellen Browsergruppe zu — sie startet über den
// Kindprozess tatsächlich Chromium und zwei Smoke-Server und darf nicht parallel laufen.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { JSONReport, JSONReportSuite } from "@playwright/test/reporter";
import { describe, expect, it } from "vitest";

const WURZEL = resolve(__dirname, "../..");
const SPEC = "tests-smoke/demo-ux-v1-capture-frontdoor.spec.ts";
const PROJEKT = "chromium-zustand";

/** Die Titel aus der Spec (Fall 5) — wörtlich, damit eine Umbenennung hier rot wird. */
const ERWARTET = [
  "DEMO-UX-V1 · das Blatt läuft bei 390x844 (Telefon) nicht waagerecht über",
  "DEMO-UX-V1 · das Blatt läuft bei 768x1024 (Tablet) nicht waagerecht über",
];

interface Fall {
  titel: string;
  projekt: string;
  status: string;
  ergebnisse: string[];
}

function faelle(suiten: JSONReportSuite[] | undefined): Fall[] {
  const liste: Fall[] = [];
  for (const suite of suiten ?? []) {
    for (const spec of suite.specs) {
      for (const test of spec.tests) {
        liste.push({
          titel: spec.title,
          projekt: test.projectName,
          status: test.status,
          ergebnisse: test.results.map((r) => r.status),
        });
      }
    }
    liste.push(...faelle(suite.suites));
  }
  return liste;
}

describe("K2 · Schmalansichts-Smoke der Vordertür (390×844, 768×1024) über den Torweg", () => {
  it("S · beide vorhandenen Schmalansichtsfälle laufen in chromium-zustand und bestehen", () => {
    const ablage = mkdtempSync(join(tmpdir(), "schmal-smoke-"));
    const bericht = join(ablage, "bericht.json");
    try {
      const lauf = spawnSync(
        "npm",
        [
          "run",
          "--silent",
          "smoke:ui:gate",
          "--",
          SPEC,
          "--grep",
          "nicht waagerecht",
          "--reporter=list,json",
        ],
        {
          cwd: WURZEL,
          encoding: "utf8",
          env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: bericht },
          timeout: 540_000,
          maxBuffer: 32 * 1024 * 1024,
        },
      );
      // Das Originalprotokoll des Playwright-Laufs gehört in die Ausgabe dieser Prüfung.
      console.info(lauf.stdout);
      console.info(lauf.stderr);
      expect(lauf.error, "der Smoke-Lauf liess sich nicht starten").toBeUndefined();
      expect(lauf.status, "der Smoke-Lauf endete nicht mit 0").toBe(0);

      const json = JSON.parse(readFileSync(bericht, "utf8")) as JSONReport;
      const schmal = faelle(json.suites).filter((f) => f.titel.includes("nicht waagerecht"));
      expect(
        schmal.map((f) => `${f.projekt} · ${f.titel}`).sort(),
        "nicht genau die zwei Schmalansichtsfälle im Projekt chromium-zustand gelaufen",
      ).toEqual(ERWARTET.map((t) => `${PROJEKT} · ${t}`).sort());
      for (const fall of schmal) {
        expect(fall.status, fall.titel).toBe("expected");
        expect(fall.ergebnisse, fall.titel).toEqual(["passed"]);
      }
      expect(json.stats.unexpected, "ein Fall des Laufs ist rot").toBe(0);
    } finally {
      rmSync(ablage, { recursive: true, force: true });
    }
  }, 600_000);
});

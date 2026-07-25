// AUFTRAG-mega6 Block D: bens Auflage lautet „abgeleitet aus EINER gemeinsamen Quelle, damit Server
// und Oberfläche nicht auseinanderlaufen können".
//
// AUFTRAG-mega8 Block A: der Import über die Modulgrenze (apps/web → services/) ist entfallen — er
// brach den Produktions-Build, weil der webbuild-Stage im Dockerfile nur apps/web kopiert. Die
// Oberfläche hält die Werte jetzt selbst. Bens Anliegen bleibt bindend, dieser Test tritt an die
// Stelle des Imports: er vergleicht beide Objekte Schlüssel für Schlüssel und Wert für Wert und
// wird rot, sobald eine Seite geändert wird, ohne dass die andere nachgezogen wird.
// Ein Test DARF beide Seiten importieren — nur der Produktpfad von apps/web muss frei von
// services/-Importen sein; das prüft der zweite Block hier.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DRAFT_LIMITS as UI_LIMITS } from "../../apps/web/src/lib/draftLimits";
import { DRAFT_LIMITS as SERVER_LIMITS } from "../../services/capture/src/draft-limits";

describe("Block D: Oberfläche und Persistenzgrenze halten dieselben Grenzen", () => {
  it("beide Objekte tragen exakt dieselben Schlüssel", () => {
    expect(Object.keys(UI_LIMITS).sort()).toEqual(Object.keys(SERVER_LIMITS).sort());
  });

  it("jeder Schlüssel trägt beidseitig denselben Wert", () => {
    // Schlüssel für Schlüssel statt eines pauschalen toEqual: schlägt eine Zahl auseinander,
    // benennt die Fehlermeldung genau den betroffenen Schlüssel.
    for (const key of Object.keys(SERVER_LIMITS) as (keyof typeof SERVER_LIMITS)[]) {
      expect(`${key}=${UI_LIMITS[key]}`).toBe(`${key}=${SERVER_LIMITS[key]}`);
    }
  });

  it("die Werte entsprechen den von ben aufgezählten Caps", () => {
    expect(SERVER_LIMITS).toEqual({
      reviewers: 20,
      reviewerId: 128,
      sources: 25,
      sourceLabel: 300,
      sourceUrl: 2048,
      sourceExcerpt: 500,
      sourceProvider: 100,
      extQuery: 300,
      interviewAnswers: 50,
      interviewText: 4000,
      interviewQuestion: 2000,
    });
  });
});

describe("AUFTRAG-mega8 Block A: der Produktcode der Oberfläche kennt services/ nicht", () => {
  it("keine Datei unter apps/web/src importiert aus services/", () => {
    const root = join(__dirname, "../../apps/web/src");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(0);

    // Trifft die Modulspezifizierer selbst — `from "…services/…"` (deckt auch mehrzeilige
    // import-/export-Listen ab) und `import("…services/…")`. Genau diese Pfade kann rollup im
    // Container nicht auflösen. Bloße Erwähnungen in Kommentaren (wie in draftLimits.ts) sind
    // erlaubt und lösen hier nicht aus.
    const offenders = files.filter((file) =>
      /from\s*["'][^"']*services\/|import\(\s*["'][^"']*services\//.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// ================================================================================================
// JOB 3556 · TEIL A — F5: DER ABGELÖSTE WEG IST WEG, NICHT DANEBEN.
// ================================================================================================
// Der Auftrag verlangt beides in EINEM Zug: die Verdrahtung UND den Abbau dessen, was sie ersetzt.
// Ein zweiter Hook auf denselben Endpunkt und drei Texte, die niemand mehr erreichen kann, sind
// keine Reste — sie sind eine zweite Wahrheit, die beim nächsten Umbau wieder mitgepflegt wird.
//
// Gemessen wird am QUELLTEXT, nicht am Verhalten: Genau das ist hier die Aussage („es gibt die
// Stelle nicht mehr"). Ein Verhaltenstest könnte sie nicht treffen — unerreichbarer Code verhält
// sich nicht.

const wurzel = process.cwd();
const lies = (p: string): string => readFileSync(resolve(wurzel, p), "utf8");

function dateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  const gehe = (ort: string): void => {
    for (const eintrag of readdirSync(ort)) {
      const pfad = join(ort, eintrag);
      if (statSync(pfad).isDirectory()) {
        if (eintrag !== "node_modules") {
          gehe(pfad);
        }
      } else if (/\.(ts|tsx)$/.test(eintrag)) {
        gefunden.push(pfad);
      }
    }
  };
  gehe(resolve(wurzel, verzeichnis));
  return gefunden;
}

describe("JOB 3556 · F5 · der abgelöste Live-Check-Weg", () => {
  it("der alte Hook in components/capture/intake ist entfernt — mapKnowledgeCheck bleibt", () => {
    const quelle = lies("apps/web/src/components/capture/intake/useLiveKnowledgeCheck.ts");
    expect(quelle).not.toContain("export function useLiveKnowledgeCheck");
    // Die Abbildung selbst wird weiterverwendet und bleibt an genau EINEM Ort.
    expect(quelle).toContain("export function mapKnowledgeCheck");
  });

  it("es gibt genau EINEN Hook-Export dieses Namens im Web-Quellbaum", () => {
    const treffer = dateien("apps/web/src").filter((p) =>
      readFileSync(p, "utf8").includes("export function useLiveKnowledgeCheck"),
    );
    expect(treffer.map((p) => p.slice(wurzel.length + 1))).toEqual([
      "apps/web/src/hooks/useLiveKnowledgeCheck.ts",
    ]);
  });

  it("keine tote Fundstelle `intake.live.pending` mehr — weder Text noch Aufruf", () => {
    const treffer = dateien("apps/web/src")
      .filter((p) => readFileSync(p, "utf8").includes("intake.live.pending"))
      .map((p) => p.slice(wurzel.length + 1));
    expect(treffer).toEqual([]);
  });

  it("die Reaktionszone kennt die unerreichbaren Lagen pending/unavailable nicht mehr", () => {
    const zone = lies("apps/web/src/components/capture/intake/LiveReactionZone.tsx");
    expect(zone).not.toContain('verdict.status === "pending"');
    expect(zone).not.toContain('verdict.status === "unavailable"');
  });

  it("die Wächter-Ausnahme ERSETZT_JOB3427 ist gestrichen", () => {
    expect(lies("tests/capture/aufrufer-waechter.test.ts")).not.toContain("ERSETZT_JOB3427");
  });
});

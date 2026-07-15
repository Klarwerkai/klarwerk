import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// SCRUM-487 A2: Niederländisch (nl) als dritte Sprache über die GESAMTE t()-Fläche. Dieser Test
// sichert die Vollständigkeit unabhängig von tsc (`const nl: typeof de` erzwingt Parität ohnehin):
// jeder DE-Key existiert in NL mit nicht-leerem Wert, keine überzähligen NL-Keys, und alle
// {{Platzhalter}} bleiben je Key erhalten (sonst bräche die Interpolation in der NL-Oberfläche).
const src = readFileSync(
  fileURLToPath(new URL("../../apps/web/src/i18n.ts", import.meta.url)),
  "utf8",
);

function extractObject(startMarker: string): Record<string, string> {
  const start = src.indexOf(startMarker);
  if (start < 0) {
    throw new Error(`Marker nicht gefunden: ${startMarker}`);
  }
  const braceStart = src.indexOf("{", start);
  const end = src.indexOf("\n};", braceStart);
  const objText = src.slice(braceStart, end + 2);
  // Das Objektliteral ist reines JS (Strings mit erhaltenem Escaping) → sicher auswertbar.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(`return (${objText})`)() as Record<string, string>;
}

const de = extractObject("const de = {");
const nl = extractObject("const nl: typeof de = {");
const deKeys = Object.keys(de);
const nlKeys = Object.keys(nl);

function placeholders(value: string): string[] {
  return (value.match(/\{\{[^}]+\}\}/g) ?? []).sort();
}

describe("SCRUM-487 A2: NL-i18n-Vollständigkeit", () => {
  it("hat überhaupt eine substanzielle Key-Fläche (Regressionsschutz)", () => {
    expect(deKeys.length).toBeGreaterThan(2000);
  });

  it("kein fehlender NL-Key: jeder DE-Key existiert in NL mit nicht-leerem Wert", () => {
    const missing = deKeys.filter((k) => typeof nl[k] !== "string" || nl[k].length === 0);
    expect(missing).toEqual([]);
  });

  it("keine überzähligen NL-Keys (kein Drift gegenüber DE)", () => {
    const extra = nlKeys.filter((k) => !(k in de));
    expect(extra).toEqual([]);
  });

  it("Platzhalter-Parität je Key (Interpolation bleibt in NL erhalten)", () => {
    const mismatched = deKeys.filter(
      (k) =>
        JSON.stringify(placeholders(de[k] ?? "")) !== JSON.stringify(placeholders(nl[k] ?? "")),
    );
    expect(mismatched).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// SCRUM-527 (WP2, ben-Check V2): die externen Treffer-Listen in Capture und ExternalKnowledge dürfen die
// Provider-/Nutzer-URL NICHT roh in ein href geben — sie MÜSSEN über die defensive Grenze ExternalUrlText
// laufen (die javascript:/data:/vbscript:/relative-Schemata neutralisiert). Die Ergebnis-Liste dieser
// Seiten rendert nur unter asynchronem Mutations-Zustand (DOM-frei nicht erreichbar), daher pinnt dieser
// Quell-Guard strukturell, dass der rohe Sink `href={r.url}` verschwunden ist. Vor dem Fix enthielten
// beide Dateien genau diesen rohen Sink → real-failing.
const pageSource = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8");

describe("externe Treffer-href-Sinks laufen über ExternalUrlText", () => {
  for (const file of ["Capture.tsx", "ExternalKnowledge.tsx"]) {
    it(`${file}: kein roher href={r.url}, sondern ExternalUrlText`, () => {
      const src = pageSource(file);
      expect(src).not.toContain("href={r.url}"); // roher Sink entfernt
      expect(src).toContain("ExternalUrlText"); // über die defensive Grenze
    });
  }
});

// AUFNAHME 20260922 · VORSCHAU-REICHWEITE — die Rücknahme für K4-R bleibt ohne Git-Vorgeschichte
// herstellbar (Ben, Lauf 6 Runde 2, Befund P1). Hier ohne Bau und ohne Browser: nur, dass die
// Umkehrung auf den heutigen Stand passt und wirklich den alten Stand ergibt. Den Bau und die
// Messung macht die Integrationsdatei.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { bereiteAlteQuelle } from "./alte-flaeche";

describe("Vorschau-Reichweite · alte Fläche für die Rücknahme", () => {
  const ziel = mkdtempSync(join(tmpdir(), "klarwerk-vorschau-alt-quelle-"));
  afterAll(() => rmSync(ziel, { recursive: true, force: true }));

  it("die Umkehrung passt auf den aktuellen Stand und ergibt das alte Verhalten", () => {
    bereiteAlteQuelle(ziel);
    const blatt = readFileSync(join(ziel, "apps/web/src/components/erfassen/Blatt.tsx"), "utf8");
    expect(blatt).toContain('"erfassen.live.neu"');
    expect(blatt).not.toContain("vorschau.");
    // Nur diese Änderung ist zurückgenommen: der übrige heutige Stand des Blatts steht noch da.
    expect(blatt).toContain('data-testid="blatt-titel-voll"');
  }, 120_000);
});

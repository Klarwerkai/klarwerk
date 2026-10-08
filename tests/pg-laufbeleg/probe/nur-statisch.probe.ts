// R-1327 · Probe (Bens Befund, Nacharbeit 2): eine Datei, deren Fälle ALLE statisch abgeschaltet
// sind. Vitest setzt die ganze Datei auf `mode=skip` und fährt keinen ihrer Hooks. Nur
// `melder.test.ts` fährt diese Datei, über `probe.vitest.config.ts`.
import { describe, expect, it } from "vitest";

const pgVerfuegbar = false;

describe.skipIf(!pgVerfuegbar)("Probe-Statisch-Suite", () => {
  it("prüft die echte Datenbank", () => {
    expect(pgVerfuegbar).toBe(true);
  });

  it("prüft sie ein zweites Mal", () => {
    expect(pgVerfuegbar).toBe(true);
  });
});

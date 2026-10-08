// R-1327 · Probe: die Hausform einer Postgres-Integrationsdatei auf einer Maschine ohne Datenbank.
// Kein Fall läuft — der eine überspringt sich zur Laufzeit (`ctx.skip()` aus `requirePool`), die
// Gruppe darunter ist statisch abgeschaltet (`describe.skipIf`). Nur `melder.test.ts` fährt diese
// Datei, über `probe.vitest.config.ts`.
import { beforeAll, describe, expect, it } from "vitest";

describe("Probe-Pg-Suite", () => {
  let available = false;

  beforeAll(() => {
    available = false; // kein Docker/PG → skip statt Fehlschlag
  });

  it("schreibt eine Zeile in die echte Datenbank", (ctx) => {
    if (!available) {
      ctx.skip();
    }
    expect(available).toBe(true);
  });
});

describe.skipIf(true)("Probe-Pg-Gruppe ohne Container", () => {
  it("liest die Zeile wieder", () => {
    expect(true).toBe(true);
  });
});

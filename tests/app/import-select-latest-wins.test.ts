// WP-IC-PAKET-1b (bens ROT-3): latest-wins für die Live-Vorschau. Die debounced Filter-Änderungen
// können select-Requests überlappen lassen; die Antwort eines ÄLTEREN Requests darf die neuere
// Vorschau samt Auswahl-Zustand (checkedRows) NICHT mehr überschreiben. Getestet: die pure
// Request-ID-Logik (auch mit absichtlich UMGEKEHRTER Fertigstellungs-Reihenfolge) und die
// Verdrahtung in ImportSelect (Anwendung NUR über den Guard, Rendern nur aus dem Guard-Zustand).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createLatestWins } from "../../apps/web/src/lib/latestWins";

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("WP-IC-PAKET-1b ROT-3: createLatestWins (pure)", () => {
  it("nur die zuletzt gestartete Anfrage ist aktuell; IDs steigen monoton", () => {
    const lw = createLatestWins();
    const a = lw.begin();
    const b = lw.begin();
    expect(b).toBeGreaterThan(a);
    expect(lw.isCurrent(b)).toBe(true);
    expect(lw.isCurrent(a)).toBe(false);
  });

  it("UMGEKEHRTE Fertigstellung: die neuere Antwort gewinnt, die ältere wird verworfen", async () => {
    const lw = createLatestWins();
    const applied: string[] = [];
    const run = async (payload: string, gate: Promise<void>): Promise<void> => {
      const id = lw.begin(); // synchron beim Start gezogen (wie mutationFn)
      await gate; // simulierte Netz-Laufzeit
      if (lw.isCurrent(id)) {
        applied.push(payload); // wie onSuccess: nur der aktuelle Request wendet an
      }
    };
    const slowOld = deferred();
    const fastNew = deferred();
    const p1 = run("ALT", slowOld.promise); // zuerst gestartet …
    const p2 = run("NEU", fastNew.promise);
    // … aber absichtlich UMGEKEHRT fertig: erst die neue, dann die alte Antwort.
    fastNew.resolve();
    await p2;
    slowOld.resolve();
    await p1;
    expect(applied).toEqual(["NEU"]);
  });

  it("mehrere schnelle Filter-Änderungen → genau EIN wirksames Ergebnis (das letzte)", async () => {
    const lw = createLatestWins();
    const applied: number[] = [];
    const gates = [deferred(), deferred(), deferred(), deferred(), deferred()];
    const runs = gates.map((gate, i) => {
      const id = lw.begin();
      return gate.promise.then(() => {
        if (lw.isCurrent(id)) {
          applied.push(i);
        }
      });
    });
    // Feste, absichtlich durcheinandergewürfelte Fertigstellungs-Reihenfolge (deterministisch).
    for (const idx of [2, 0, 4, 1, 3]) {
      gates[idx]?.resolve();
    }
    await Promise.all(runs);
    expect(applied).toEqual([4]); // NUR der zuletzt gestartete Request wirkt
  });
});

describe("WP-IC-PAKET-1b ROT-3: Verdrahtung in ImportSelect", () => {
  it("mutationFn zieht die Request-ID, onSuccess wendet nur den aktuellen an, gerendert wird der Guard-Zustand", () => {
    const src = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/ImportSelect.tsx"),
      "utf8",
    );
    expect(src).toContain("createLatestWins()");
    expect(src).toContain("latestRef.current.begin()");
    expect(src).toContain("latestRef.current.isCurrent(requestId)");
    // Anzeige/Auswahl kommen AUSSCHLIESSLICH aus dem latest-wins-Zustand (preview), nie aus
    // select.data (das die letzte SETTLED — womöglich ältere — Mutation trägt).
    expect(src).toContain("setPreview(data)");
    expect(src).not.toContain("select.data.preview");
    expect(src).not.toContain("select.data?.");
  });
});

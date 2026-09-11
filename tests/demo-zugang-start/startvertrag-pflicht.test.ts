// ================================================================================================
// JOB 3655 · A — FEHLT EIN PFLICHTWERT, STARTET DIE ANWENDUNG NICHT. UND SIE NENNT ALLE.
// ================================================================================================
//
// Die Lücke, gegen die diese Datei steht (Auftrag §2): Es gab keine Stelle, die zusammengefasst
// sagt, was zum Start PFLICHT ist. Wer eine zweite Instanz aufsetzt, erfuhr einen fehlenden Wert
// erst, wenn er auf die Fläche klickte, die daran hängt.
//
// Die Zusicherung, die hier gemessen wird, hat zwei Hälften, und die zweite ist die wichtigere:
//   1. Ein fehlender Pflichtwert verhindert den Start.
//   2. Die Meldung nennt ALLE fehlenden Namen — nicht den ersten. Sonst startet der Betreiber
//      dreimal neu, um drei Namen zu erfahren.
import { describe, expect, it } from "vitest";
import {
  STARTVERTRAG,
  StartvertragError,
  fehlendePflichtwerte,
  pruefeStartvertrag,
} from "../../services/app/src/start-vertrag";
import { assertPersistentStore } from "../../services/app/src/storage-guard";

/** Eine vollständig ausgestattete Produktionsumgebung — Ausgangspunkt jeder Verstellprobe. */
function vollstaendigeProduktion(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { NODE_ENV: "production" };
  for (const wert of STARTVERTRAG) {
    if (wert.pflicht.art === "produktion") {
      env[wert.name] = `wert-fuer-${wert.name}`;
    }
  }
  return env;
}

/** Die Pflichtwerte laut Vertrag — die Prüfung wird gegen den Vertrag gefahren, nicht gegen eine Kopie. */
const PFLICHT_IN_PRODUKTION = STARTVERTRAG.filter((w) => w.pflicht.art === "produktion").map(
  (w) => w.name,
);

describe("JOB 3655 A · der Startvertrag verweigert den Start bei fehlenden Pflichtwerten", () => {
  it("A0 · der Vertrag führt überhaupt Pflichtwerte — und mehr als einen", () => {
    // Ein Vertrag ohne Pflichtwert wäre eine grüne Prüfung, die nichts prüft. Und mit nur EINEM
    // Pflichtwert liesse sich die Zusicherung „nennt ALLE" gar nicht messen.
    expect(PFLICHT_IN_PRODUKTION.length).toBeGreaterThanOrEqual(2);
    expect(PFLICHT_IN_PRODUKTION).toContain("DATABASE_URL");
    expect(PFLICHT_IN_PRODUKTION).toContain("APP_BASE_URL");
  });

  it("A1 · vollständig ausgestattete Produktion startet", () => {
    expect(fehlendePflichtwerte(vollstaendigeProduktion())).toEqual([]);
    expect(() => pruefeStartvertrag(vollstaendigeProduktion())).not.toThrow();
  });

  it("A2 · JEDER einzelne Pflichtwert verhindert für sich allein den Start", () => {
    // Kalibrierung: der Wächter darf nicht nur an EINEM Namen hängen. Fällt einer der Pflichtwerte
    // künftig still aus der Prüfung, wird genau diese Schleife rot.
    for (const name of PFLICHT_IN_PRODUKTION) {
      const env = vollstaendigeProduktion();
      delete env[name];
      expect(() => pruefeStartvertrag(env), `${name} fehlt und der Start gelingt trotzdem`).toThrow(
        StartvertragError,
      );
      expect(fehlendePflichtwerte(env)).toEqual([name]);
    }
  });

  it("A3 · fehlen mehrere, nennt EINE Meldung ALLE Namen — nicht den ersten", () => {
    const env: Record<string, string | undefined> = { NODE_ENV: "production" };
    let gefangen: unknown;
    try {
      pruefeStartvertrag(env);
    } catch (fehler) {
      gefangen = fehler;
    }
    expect(gefangen).toBeInstanceOf(StartvertragError);
    const fehler = gefangen as StartvertragError;
    // ALLE — als Liste am Fehler und wörtlich in der Meldung.
    expect([...fehler.fehlend].sort()).toEqual([...PFLICHT_IN_PRODUKTION].sort());
    for (const name of PFLICHT_IN_PRODUKTION) {
      expect(fehler.message, `${name} fehlt in der Meldung`).toContain(name);
    }
    // Und die Meldung sagt, wie viele es sind — damit niemand sie für vollständig hält, wenn sie
    // abgeschnitten ankommt.
    expect(fehler.message).toContain(`${PFLICHT_IN_PRODUKTION.length} Pflichtwert(e)`);
  });

  it("A4 · ein leerer oder nur aus Leerraum bestehender Wert gilt als nicht gesetzt", () => {
    for (const roh of ["", "   ", "\t\n"]) {
      const env = vollstaendigeProduktion();
      env.APP_BASE_URL = roh;
      expect(fehlendePflichtwerte(env), `"${roh}" wurde als gesetzt gewertet`).toEqual([
        "APP_BASE_URL",
      ]);
    }
  });

  it("A5 · ausserhalb der Produktion blockiert nichts", () => {
    // Entwicklung und Testläufe sollen ohne Ausstattung hochkommen — genau wie heute. Sonst wäre
    // dieser Vertrag eine neue Hürde statt einer Auskunft.
    for (const nodeEnv of [undefined, "development", "test"]) {
      expect(fehlendePflichtwerte({ NODE_ENV: nodeEnv })).toEqual([]);
    }
  });

  it("A6 · die benannte Ausnahme hebt genau ihre eine Pflicht auf — und nur bei exaktem Wert", () => {
    const mitAusnahme = STARTVERTRAG.filter(
      (w) => w.pflicht.art === "produktion" && w.pflicht.ausnahme,
    );
    expect(mitAusnahme.length).toBeGreaterThan(0);
    for (const wert of mitAusnahme) {
      const ausnahme = wert.pflicht.art === "produktion" ? wert.pflicht.ausnahme : undefined;
      if (!ausnahme) {
        throw new Error("unerreichbar");
      }
      const env = vollstaendigeProduktion();
      delete env[wert.name];
      env[ausnahme.name] = ausnahme.wert;
      expect(fehlendePflichtwerte(env)).toEqual([]);
      // Ein anderer Wert hebt nichts auf — die Ausnahme ist kein „irgendwas gesetzt".
      env[ausnahme.name] = "ja";
      expect(fehlendePflichtwerte(env)).toEqual([wert.name]);
    }
  });

  it("A7 · DATABASE_URL-Regel und der bestehende Speicherwächter sagen dasselbe", () => {
    // KEINE ZWEITE WAHRHEIT: `assertPersistentStore` (storage-guard.ts) ist die Stelle, die den
    // Start heute schon abbricht. Der Vertrag BESCHREIBT dieselbe Regel — und dieser Vergleich hält
    // fest, dass beide über dieselben vier Lagen gleich urteilen. Liefe eine auseinander, hätte der
    // Betreiber zwei widersprüchliche Auskünfte darüber, ob seine Instanz startet.
    const lagen = [
      { nodeEnv: "production", db: undefined, override: undefined },
      { nodeEnv: "production", db: "postgres://x@y/z", override: undefined },
      { nodeEnv: "production", db: undefined, override: "1" },
      { nodeEnv: "test", db: undefined, override: undefined },
    ] as const;
    for (const lage of lagen) {
      const waechterBricht = (() => {
        try {
          assertPersistentStore({
            databaseUrl: lage.db,
            nodeEnv: lage.nodeEnv,
            allowInMemoryProd: lage.override,
            journalActive: false,
          });
          return false;
        } catch {
          return true;
        }
      })();
      const vertragVermisst = fehlendePflichtwerte({
        NODE_ENV: lage.nodeEnv,
        DATABASE_URL: lage.db,
        KLARWERK_ALLOW_INMEMORY_PROD: lage.override,
        APP_BASE_URL: "https://demo.example",
      }).includes("DATABASE_URL");
      expect(vertragVermisst, `Lage ${JSON.stringify(lage)}`).toBe(waechterBricht);
    }
  });
});

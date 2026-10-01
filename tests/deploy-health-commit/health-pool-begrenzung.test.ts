// Ben B9 (deploy-health-commit, Runde 2): „Die Antwortfrist beendet keine Datenbankabfrage;
// wiederholte Health-Aufrufe können bei hängendem Laufprotokoll den gemeinsam verwendeten
// Verbindungspool vollständig belegen und Nachbarabfragen blockieren."
//
// SOLL: Die R-0794-Überwachung bleibt auch bei hängendem Laufprotokoll begrenzt und blockiert keine
// anderen Anwendungsfunktionen.
//
// VORRICHTUNG: der ECHTE `pg`-Pool (dieselbe Klasse wie `createPool`, Standardgröße 10), das echte
// `PgModelRunRepo` und der echte `ModelRunService`. Nur der Drahtclient ist ersetzt — ohne Socket,
// ohne Datenbank: Abfragen auf `model_runs` hält er zurück, bis der Test sie freigibt; jede andere
// Abfrage beantwortet er sofort. Das ist kein PostgreSQL- oder Live-Nachweis, sondern prüft genau
// die Poolbelegung, um die es in B9 geht.
import { EventEmitter } from "node:events";
import { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { kiLaeufeAuskunft } from "../../services/app/src/health-ki-laeufe";
import { type ModelRunRecord, ModelRunService, PgModelRunRepo } from "../../services/model-runs";

type Antwort = (err: Error | null, res?: { rows: unknown[] }) => void;

const LAUF: ModelRunRecord = {
  id: "run-1",
  task: "answer",
  provider: "deterministic",
  demo: true,
  fallback: false,
  startedAt: "2026-09-29T06:00:00.000Z",
  finishedAt: "2026-09-29T06:00:01.000Z",
  status: "success",
};

/** Zurückgehaltene `model_runs`-Antworten aller Drahtclients einer Vorrichtung. */
let zurueckgehalten: Antwort[] = [];
let laufprotokollAbfragen = 0;
/** Beim Aufräumen: auch später noch aus der Poolwarteschlange nachrückende Abfragen sofort beantworten. */
let sofortAntworten = false;

class DrahtclientOhneSocket extends EventEmitter {
  _queryable = true;
  _ending = false;

  connect(cb?: (err: Error | null) => void): Promise<void> | undefined {
    if (cb) {
      setImmediate(() => cb(null));
      return undefined;
    }
    return Promise.resolve();
  }

  query(text: unknown, _values: unknown, cb: Antwort): void {
    const sql = typeof text === "string" ? text : String((text as { text?: unknown }).text);
    if (sql.includes("model_runs")) {
      laufprotokollAbfragen += 1;
      if (sofortAntworten) {
        setImmediate(() => cb(null, { rows: [{ data: LAUF }] }));
        return;
      }
      zurueckgehalten.push(cb);
      return;
    }
    setImmediate(() => cb(null, { rows: [{ eins: 1 }] }));
  }

  end(cb?: () => void): Promise<void> | undefined {
    this._ending = true;
    if (cb) {
      setImmediate(cb);
      return undefined;
    }
    return Promise.resolve();
  }
}

function freigeben(): void {
  const alle = zurueckgehalten;
  zurueckgehalten = [];
  for (const cb of alle) {
    cb(null, { rows: [{ data: LAUF }] });
  }
}

const pools: Pool[] = [];

function echterPool(): Pool {
  const pool = new Pool({
    Client: DrahtclientOhneSocket as unknown as NonNullable<
      ConstructorParameters<typeof Pool>[0]
    >["Client"],
  });
  pools.push(pool);
  return pool;
}

async function nachbarabfrage(pool: Pool): Promise<"beantwortet" | "blockiert"> {
  const frist = new Promise<"blockiert">((fertig) => setTimeout(() => fertig("blockiert"), 500));
  return Promise.race([pool.query("SELECT 1").then(() => "beantwortet" as const), frist]);
}

afterEach(async () => {
  sofortAntworten = true;
  freigeben();
  try {
    await Promise.all(pools.splice(0).map((pool) => pool.end()));
  } finally {
    sofortAntworten = false;
    laufprotokollAbfragen = 0;
  }
});

describe("Ben B9 · Kalibrierung: die Vorrichtung erkennt den Fehler", () => {
  it("startet jeder Aufruf eine eigene Abfrage (Stand Runde 1), ist der Pool voll und der Nachbar blockiert", async () => {
    const pool = echterPool();
    const service = new ModelRunService({ repo: new PgModelRunRepo(pool) });

    // Eine frische Auskunft je Aufruf entspricht genau dem Verhalten vor der Korrektur.
    for (let i = 0; i < 11; i += 1) {
      expect(await kiLaeufeAuskunft(service, 20)()).toEqual({ available: false, recent: [] });
    }

    expect(pool.totalCount).toBe(10);
    expect(pool.idleCount).toBe(0);
    expect(await nachbarabfrage(pool)).toBe("blockiert");
  });
});

describe("Ben B9 · hängendes Laufprotokoll belegt höchstens einen Poolplatz", () => {
  it("elf wiederholte Zeitüberschreitungen: eine Abfrage im Flug, Nachbarabfrage läuft", async () => {
    const pool = echterPool();
    const auskunft = kiLaeufeAuskunft(new ModelRunService({ repo: new PgModelRunRepo(pool) }), 20);

    for (let i = 0; i < 11; i += 1) {
      expect(await auskunft()).toEqual({ available: false, recent: [] });
    }

    expect(laufprotokollAbfragen, "jeder Aufruf hat eine eigene Abfrage gestartet").toBe(1);
    expect(pool.totalCount).toBe(1);
    expect(pool.waitingCount).toBe(0);
    expect(await nachbarabfrage(pool)).toBe("beantwortet");
    expect(pool.waitingCount).toBe(0);
  });

  it("gleichzeitige Aufrufe teilen sich die eine Abfrage", async () => {
    const pool = echterPool();
    const auskunft = kiLaeufeAuskunft(new ModelRunService({ repo: new PgModelRunRepo(pool) }), 20);

    const ergebnisse = await Promise.all(Array.from({ length: 15 }, () => auskunft()));
    expect(ergebnisse.every((e) => e.available === false)).toBe(true);
    expect(laufprotokollAbfragen).toBe(1);
    expect(await nachbarabfrage(pool)).toBe("beantwortet");
  });

  it("kommt die hängende Abfrage zurück, startet der nächste Aufruf neu und liefert wieder", async () => {
    const pool = echterPool();
    const auskunft = kiLaeufeAuskunft(new ModelRunService({ repo: new PgModelRunRepo(pool) }), 200);

    expect((await auskunft()).available).toBe(false);
    freigeben();
    await new Promise((fertig) => setImmediate(fertig));

    const naechste = auskunft();
    // Die neue Abfrage ist gestartet und wartet — erst die Freigabe beantwortet sie.
    await new Promise((fertig) => setTimeout(fertig, 20));
    expect(laufprotokollAbfragen).toBe(2);
    freigeben();
    expect(await naechste).toEqual({
      available: true,
      recent: [
        {
          task: "answer",
          status: "success",
          mode: "deterministic",
          fallback: false,
          finishedAt: LAUF.finishedAt,
        },
      ],
    });
  });

  it("über die echte /health-Route mit ihrer echten Frist: Pool bleibt frei für Nachbarn", async () => {
    const pool = echterPool();
    const services = buildServices();
    (services as unknown as { modelRuns: ModelRunService }).modelRuns = new ModelRunService({
      repo: new PgModelRunRepo(pool),
    });
    const app = buildApp(services);
    try {
      for (let i = 0; i < 3; i += 1) {
        const res = await app.inject({ method: "GET", url: "/health" });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({
          status: "ok",
          aiRuns: { available: false, recent: [] },
        });
      }
      expect(laufprotokollAbfragen).toBe(1);
      expect(pool.totalCount).toBe(1);
      expect(await nachbarabfrage(pool)).toBe("beantwortet");
    } finally {
      await app.close();
    }
  }, 15_000);
});

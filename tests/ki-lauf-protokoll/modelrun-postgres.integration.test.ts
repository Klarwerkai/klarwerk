// ================================================================================================
// Aufnahme gesamt-ki-laufprotokoll · Ben Lauf 3 R2 (BEN-P1) — DAS LAUFPROTOKOLL GEGEN ECHTES POSTGRES.
// ================================================================================================
//
// Liefertor-Rest (b): Bis hierher stand die PostgreSQL-Persistenz des Laufprotokolls nur als
// „nicht gemessen“ da. `services/model-runs/src/repo.test.ts` prüft `PgModelRunRepo` mit einem
// gestellten Pool (`fakePool`) und nur `append`/`recent` — weder eine echte Datenbank noch
// `zwischen`. Diese Datei misst genau das, was dort fehlt:
//   PG1 — `append` über `ProtokollModelRunRepo` → `recent`: Der jsonb-Datensatz kommt vollständig
//         zurück (`versuche` samt `aufrufe`, `trace`, `verbrauch`, `kosten`, `erzeugt`, `error`).
//         Die Tabelle hat nur `id` und `data`; ein zweites `append` derselben ID ändert nichts.
//   PG2 — `zwischen`: `von` eingeschlossen, `bis` ausgeschlossen, neueste zuerst, Grenze wirkt.
//   PG3 — `ModelRunService.auswertung` über das echte Repo: Summe je Währung; ein Lauf mit
//         Teilverbrauch (Ben Lauf 3 R1 N1: 3 Aufrufe, 2 Meldungen) und ein Altlauf ohne `versuche`
//         tragen keine Kosten und werden unter `verbrauchOhneKosten` gezählt.
//
// NICHT GEMESSEN: der Weg vom Reasoner bis in die Datenbank (diese Datei schreibt Datensätze direkt
// über das Protokoll-Repo) und eine echte Anbieter-API. Die App-Verdrahtung `PgModelRunRepo` ↔
// `ProtokollModelRunRepo` steht in `services/app/src/build-app.ts` und ist hier nicht Gegenstand.
//
// Läuft NUR unter `test:integration` (Docker/Testcontainers oder eine per KLARWERK_PG_TEST_URL
// angebotene lokale Testinstanz). Ohne beides werden die Fälle übersprungen — ein übersprungener
// Fall ist KEIN Beleg. Dieselbe Bauform wie `tests/q2d-leere-kennung/pg-leere-kennung.integration.test.ts`.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  MODEL_RUNS_SCHEMA,
  type ModelRunRecord,
  ModelRunService,
  type ModelRunVersuch,
  PgModelRunRepo,
  ProtokollModelRunRepo,
  lesePreisliste,
} from "../../services/model-runs";

const PREISLISTE = lesePreisliste(
  JSON.stringify({
    waehrung: "EUR",
    preisstand: "pg-test",
    modelle: { "pg-modell": { eingabeJeMillion: 1, ausgabeJeMillion: 2 } },
  }),
).preisliste;

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";

function versuch(over: Partial<ModelRunVersuch> = {}): ModelRunVersuch {
  return {
    provider: "anthropic:pg-modell",
    model: "pg-modell",
    startedAt: "2026-09-20T10:00:00.000Z",
    dauerMs: 120,
    ausgang: "erfolg",
    verbrauch: { eingabeToken: 1000, ausgabeToken: 500, gemeldeteAufrufe: 1 },
    aufrufe: 1,
    spanId: "00f067aa0ba902b7",
    ...over,
  };
}

function lauf(id: string, startedAt: string, over: Partial<ModelRunRecord> = {}): ModelRunRecord {
  return {
    id,
    task: "assist",
    provider: "anthropic:pg-modell",
    model: "pg-modell",
    demo: false,
    fallback: false,
    locale: "de",
    startedAt,
    finishedAt: startedAt,
    status: "success",
    verbrauch: { eingabeToken: 1000, ausgabeToken: 500, gemeldeteAufrufe: 1 },
    versuche: [versuch({ startedAt })],
    ...over,
  };
}

describe("Laufprotokoll gegen echtes Postgres (Liefertor-Rest b)", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let available = false;

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = new Pool({ connectionString: localUrl });
        await pool.query("SELECT 1");
        available = true;
        return;
      } catch {
        process.stderr.write(
          "[KLARWERK] Laufprotokoll-Pg-Messung UEBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung moeglich.\n",
        );
        available = false;
        return;
      }
    }
    if (process.env.KLARWERK_PG_TEST_URL) {
      available = false;
      return;
    }
    try {
      container = await new GenericContainer("postgres:16-alpine")
        // Derselbe Wegwerfname wie alle Pg-Prüfungen (`tests/app/job2354-drei-datenbanknamen.test.ts`).
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      pool = new Pool({
        connectionString: `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`,
      });
      available = true;
    } catch {
      process.stderr.write(
        "[KLARWERK] Laufprotokoll-Pg-Messung UEBERSPRUNGEN: kein Docker/Testcontainer verfuegbar.\n",
      );
      available = false;
    }
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  function requirePool(ctx: { skip: () => void }): Pool {
    if (!available || !pool) {
      ctx.skip();
      throw new Error("unreachable");
    }
    return pool;
  }

  /** Frische Tabelle mit dem ECHTEN Schema — jeder Fall startet auf demselben Stand. */
  async function frisch(
    p: Pool,
  ): Promise<{ pg: PgModelRunRepo; protokoll: ProtokollModelRunRepo }> {
    await p.query("DROP TABLE IF EXISTS model_runs");
    await p.query(MODEL_RUNS_SCHEMA);
    const pg = new PgModelRunRepo(p);
    return { pg, protokoll: new ProtokollModelRunRepo(pg, PREISLISTE) };
  }

  it("PG1 · der jsonb-Datensatz kommt vollständig zurück — Versuche, Aufrufe, Trace, Kosten", async (ctx) => {
    const p = requirePool(ctx);
    const { pg, protokoll } = await frisch(p);
    const eingabe = lauf("pg1", "2026-09-20T10:00:00.000Z", {
      fallback: true,
      verbrauch: { eingabeToken: 3000, ausgabeToken: 500, gemeldeteAufrufe: 3 },
      versuche: [
        versuch({
          ausgang: "fehler",
          verbrauch: { eingabeToken: 1000, ausgabeToken: 0, gemeldeteAufrufe: 1 },
          spanId: "1111111111111111",
        }),
        versuch({
          verbrauch: { eingabeToken: 2000, ausgabeToken: 500, gemeldeteAufrufe: 2 },
          aufrufe: 2,
          spanId: "2222222222222222",
        }),
      ],
      trace: {
        traceId: TRACE_ID,
        spanId: "3333333333333333",
        parentSpanId: "4444444444444444",
        requestId: "req-7",
      },
      erzeugt: { art: "text", anzahl: 1 },
      error: "anthropic:pg-modell (pg-modell): Modell-API antwortete mit 500",
    });

    await protokoll.append(eingabe);
    // Ein zweites append derselben ID (ON CONFLICT DO NOTHING) ändert den Datensatz nicht.
    await pg.append({ ...eingabe, status: "error" });

    const zurueck = await pg.recent(10);
    expect(zurueck).toHaveLength(1);
    // Kosten beim Schreiben: 3000 × 1/1e6 + 500 × 2/1e6 = 0,004 EUR.
    expect(zurueck[0]).toEqual({
      ...eingabe,
      kosten: { betrag: 0.004, waehrung: "EUR", preisstand: "pg-test" },
    });
    // Die jsonb-Felder liegen als Struktur in der Datenbank, nicht als Text.
    const roh = await p.query<{ versuche: string; trace: string; aufrufe: string }>(
      "SELECT jsonb_typeof(data->'versuche') AS versuche, jsonb_typeof(data->'trace') AS trace, data->'versuche'->1->>'aufrufe' AS aufrufe FROM model_runs WHERE id='pg1'",
    );
    expect(roh.rows[0]).toEqual({ versuche: "array", trace: "object", aufrufe: "2" });
    // Die Tabelle hat keine Spalte, in der ein Frage- oder Antworttext stehen könnte.
    const spalten = await p.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name='model_runs' ORDER BY column_name",
    );
    expect(spalten.rows.map((r) => r.column_name)).toEqual(["data", "id"]);
  });

  it("PG2 · zwischen: von eingeschlossen, bis ausgeschlossen, neueste zuerst, Grenze wirkt", async (ctx) => {
    const p = requirePool(ctx);
    const { pg } = await frisch(p);
    for (const [id, zeit] of [
      ["vor", "2026-09-09T23:59:59.999Z"],
      ["anfang", "2026-09-10T00:00:00.000Z"],
      ["mitte", "2026-09-15T12:00:00.000Z"],
      ["spaet", "2026-09-19T23:59:59.999Z"],
      ["ende", "2026-09-20T00:00:00.000Z"],
    ] as const) {
      await pg.append(lauf(id, zeit));
    }

    const im = await pg.zwischen("2026-09-10T00:00:00.000Z", "2026-09-20T00:00:00.000Z", 100);
    expect(im.map((l) => l.id)).toEqual(["spaet", "mitte", "anfang"]);
    const begrenzt = await pg.zwischen("2026-09-10T00:00:00.000Z", "2026-09-20T00:00:00.000Z", 2);
    expect(begrenzt.map((l) => l.id)).toEqual(["spaet", "mitte"]);
    expect(await pg.zwischen("2026-10-01T00:00:00.000Z", "2026-10-02T00:00:00.000Z", 100)).toEqual(
      [],
    );
  });

  it("PG3 · Auswertung über das echte Repo: Summe je Währung, Teilverbrauch und Altlauf ohne Kosten", async (ctx) => {
    const p = requirePool(ctx);
    const { protokoll } = await frisch(p);
    // Zwei vollständig belegte Läufe: je 1000 × 1/1e6 + 500 × 2/1e6 = 0,002 EUR.
    await protokoll.append(lauf("a", "2026-09-15T10:00:00.000Z"));
    await protokoll.append(lauf("b", "2026-09-16T10:00:00.000Z"));
    // Ben Lauf 3 R1 N1: drei Aufrufe, zwei Meldungen — Teilverbrauch, keine Kosten.
    const zwei = { eingabeToken: 2000, ausgabeToken: 0, gemeldeteAufrufe: 2 };
    await protokoll.append(
      lauf("n1", "2026-09-17T10:00:00.000Z", {
        task: "extract",
        verbrauch: zwei,
        versuche: [versuch({ verbrauch: zwei, aufrufe: 3 })],
      }),
    );
    // Altlauf ohne `versuche`: wem welcher Verbrauch gehört, ist unbekannt — keine Kosten.
    const { versuche: _ohne, ...alt } = lauf("alt", "2026-09-18T10:00:00.000Z");
    await protokoll.append(alt);
    // Außerhalb des Zeitraums.
    await protokoll.append(lauf("draussen", "2026-08-01T10:00:00.000Z"));

    const gespeichert = await protokoll.recent(10);
    expect(gespeichert.filter((l) => l.kosten).map((l) => l.id)).toEqual(["b", "a", "draussen"]);

    const auswertung = await new ModelRunService({ repo: protokoll }).auswertung(
      "2026-09-01T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
    );
    expect(auswertung.laeufe).toBe(4);
    expect(auswertung.kosten).toEqual([{ waehrung: "EUR", betrag: 0.004, laeufe: 2 }]);
    expect(auswertung.verbrauchOhneKosten).toBe(2);
    expect(auswertung.eingabeToken).toBe(5000);
  });
});

// ================================================================================================
// AUFNAHME 20260922 · PAARPFLICHTEN-DAUERHAFT (G2) — DIESELBEN KRITERIEN GEGEN ECHTES POSTGRES.
// ================================================================================================
//
// Dauerhaft heißt: die Pflichten liegen in `conflict_pair_obligations` (CONFLICTS_SCHEMA) und
// überleben das Ende des Prozesses. Der „Neustart" ist hier ein NEUER Pool auf dieselbe Datenbank;
// der alte Pool ist beendet. Gleichzeitigkeit: zwei Dienste auf zwei Pools (SKIP LOCKED).
// Gating wie services/conflicts/src/repo-pg.integration.test.ts: lokale Test-URL über die Sicherung
// in pg-test-guard, sonst Testcontainers, sonst übersprungen — nie gefälscht.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { migrate } from "../../services/app/src/db";
import { PAARPFLICHT_PRUEFFASSUNG } from "../../services/app/src/paarpflicht-ausfuehrung";
import { paarpflichtAussagenLaden } from "../../services/app/src/paarpflicht-aussagen";
import {
  type Paarpflicht,
  type PaarpflichtAussage,
  type PaarpflichtErgebnis,
  type PaarpflichtKontext,
  type PaarpflichtPruefer,
  PaarpflichtService,
  PgPaarpflichtRepo,
} from "../../services/conflicts";
import { CONFLICTS_SCHEMA } from "../../services/conflicts/src/repo-pg";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import type { ConflictJudgeOutcome } from "../../services/reasoner";

const KONTEXT: PaarpflichtKontext = { bestand: "b".repeat(32), pruefFassung: "konflikt-v3" };
const URTEIL: PaarpflichtErgebnis = {
  art: "urteil",
  ergebnis: "kein_konflikt",
  modell: "lokal:test",
};

function aussage(refId: string): PaarpflichtAussage {
  return {
    refId,
    version: 2,
    quelle: `q-${refId}`,
    quellen: [`src-${refId}`],
    kontext: `k-${refId}`,
  };
}

const FUENF = ["e", "c", "a", "d", "b"].map(aussage);

const paarVon = (a: PaarpflichtAussage, b: PaarpflichtAussage) => `${a.refId}${b.refId}`;

// Der Prozess stirbt nach dem Modellaufruf, bevor das Urteil geschrieben ist.
class AbsturzRepo extends PgPaarpflichtRepo {
  private abschluesse = 0;

  constructor(
    pool: Pool,
    private readonly nachAbschluessen: number,
  ) {
    super(pool);
  }

  override abschliessen(id: string, token: string, neu: Paarpflicht): Promise<boolean> {
    this.abschluesse += 1;
    if (this.abschluesse > this.nachAbschluessen) {
      return Promise.reject(new Error("Prozess beendet"));
    }
    return super.abschliessen(id, token, neu);
  }
}

function uhr() {
  let jetzt = Date.parse("2026-10-08T10:00:00.000Z");
  return {
    jetzt: () => new Date(jetzt),
    weiter: (ms: number) => {
      jetzt += ms;
    },
  };
}

describe("Paarpflichten gegen echtes Postgres", () => {
  let container: StartedTestContainer | undefined;
  let verbindung: string | undefined;
  const pools: Pool[] = [];

  function neuerPool(): Pool {
    const pool = new Pool({ connectionString: verbindung });
    pools.push(pool);
    return pool;
  }

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        verbindung = localUrl;
        await neuerPool().query("SELECT 1");
      } catch {
        process.stderr.write(
          "[KLARWERK] Pg-Integrationssuite ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
        );
        verbindung = undefined;
      }
      return;
    }
    if (process.env.KLARWERK_PG_TEST_URL) {
      return;
    }
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      verbindung = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    } catch {
      verbindung = undefined; // kein Docker/PG → skip statt Fehlschlag
    }
  });

  afterAll(async () => {
    for (const pool of pools) {
      await pool.end().catch(() => undefined);
    }
    await container?.stop();
  });

  async function frischerPool(ctx: { skip: () => void }): Promise<Pool> {
    if (!verbindung) {
      ctx.skip();
      throw new Error("unreachable"); // ctx.skip() bricht ab; nur fürs Typing
    }
    const pool = neuerPool();
    await pool.query("DROP TABLE IF EXISTS conflict_pair_obligations CASCADE");
    await pool.query("DROP TABLE IF EXISTS conflict_pair_obligation_runs CASCADE");
    await pool.query(CONFLICTS_SCHEMA);
    return pool;
  }

  it("K1/K2: fünf Aussagen → zehn Zeilen mit beiden Ständen und Kontext; erneutes Planen legt nichts an", async (ctx) => {
    const pool = await frischerPool(ctx);
    const service = new PaarpflichtService({ repo: new PgPaarpflichtRepo(pool) });
    expect(await service.planen("lauf-1", FUENF, KONTEXT)).toEqual({ gesamt: 10, neu: 10 });
    expect(await service.planen("lauf-1", [...FUENF].reverse(), KONTEXT)).toEqual({
      gesamt: 10,
      neu: 0,
    });

    const zeilen = await pool.query<{ pair_key: string; lauf_id: string }>(
      "SELECT pair_key, lauf_id FROM conflict_pair_obligations",
    );
    expect(zeilen.rowCount).toBe(10);
    expect(new Set(zeilen.rows.map((z) => z.pair_key)).size).toBe(10);

    for (const p of await service.liste("lauf-1")) {
      expect(p.a).toEqual(aussage(p.a.refId));
      expect(p.b).toEqual(aussage(p.b.refId));
      expect(p.kontext).toEqual(KONTEXT);
      expect(p.zustand).toBe("offen");
    }
  });

  it("K3: Absturz nach dem Modellaufruf, Neustart mit neuem Pool — kein Verlust, kein Doppelurteil", async (ctx) => {
    const erster = await frischerPool(ctx);
    const zeit = uhr();
    const fn = vi.fn<PaarpflichtPruefer>(async () => URTEIL);

    const vorher = new PaarpflichtService({
      repo: new AbsturzRepo(erster, 3),
      jetzt: zeit.jetzt,
      fristMs: 60_000,
    });
    await vorher.planen("lauf-1", FUENF, KONTEXT);
    await expect(vorher.abarbeiten("lauf-1", fn)).rejects.toThrow("Prozess beendet");
    expect(fn).toHaveBeenCalledTimes(4);
    await erster.end();

    const zweiter = neuerPool();
    const nachher = new PaarpflichtService({
      repo: new PgPaarpflichtRepo(zweiter),
      jetzt: zeit.jetzt,
      fristMs: 60_000,
    });
    expect(await nachher.bilanz("lauf-1")).toMatchObject({ geurteilt: 3, inArbeit: 1, rest: 7 });

    expect((await nachher.abarbeiten("lauf-1", fn)).bilanz).toMatchObject({ rest: 1 });
    zeit.weiter(60_001);
    const fertig = await nachher.abarbeiten("lauf-1", fn);
    expect(fertig.bilanz).toMatchObject({ gesamt: 10, geurteilt: 10, rest: 0 });
    expect(fertig.bilanz.abgeschlossen).toBe(true);

    const gefragt = fn.mock.calls.map(([a, b]) => paarVon(a, b));
    expect(gefragt).toHaveLength(11);
    expect(new Set(gefragt).size).toBe(10);
  });

  it("K3: ein verspäteter Abschluss mit altem Token ändert das gespeicherte Urteil nicht", async (ctx) => {
    const pool = await frischerPool(ctx);
    const repo = new PgPaarpflichtRepo(pool);
    const zeit = uhr();
    const service = new PaarpflichtService({ repo, jetzt: zeit.jetzt, fristMs: 1_000 });
    await service.planen("lauf-1", FUENF.slice(0, 2), KONTEXT);

    const start = zeit.jetzt();
    const alt = await repo.beanspruchen("lauf-1", {
      token: "alt",
      jetzt: start.toISOString(),
      bis: new Date(start.getTime() + 1_000).toISOString(),
      maxFehlversuche: 3,
      ausser: [],
    });
    expect(alt?.zustand).toBe("in_arbeit");
    zeit.weiter(1_001);
    expect((await service.abarbeiten("lauf-1", async () => URTEIL)).geurteilt).toBe(1);

    const spaet = await repo.abschliessen(alt?.id ?? "", "alt", {
      ...(alt as Paarpflicht),
      zustand: "geurteilt",
      urteil: { ergebnis: "widerspruch", modell: "alt", at: start.toISOString() },
    });
    expect(spaet).toBe(false);
    const [gespeichert] = await service.liste("lauf-1");
    expect(gespeichert?.urteil).toMatchObject({ ergebnis: "kein_konflikt" });
  });

  it("K3: zwei gleichzeitige Dienste auf zwei Pools urteilen jedes Paar genau einmal", async (ctx) => {
    const pool = await frischerPool(ctx);
    const fn = vi.fn<PaarpflichtPruefer>(async () => URTEIL);
    const a = new PaarpflichtService({ repo: new PgPaarpflichtRepo(pool) });
    const b = new PaarpflichtService({ repo: new PgPaarpflichtRepo(neuerPool()) });
    await a.planen("lauf-1", FUENF, KONTEXT);

    const [x, y] = await Promise.all([a.abarbeiten("lauf-1", fn), b.abarbeiten("lauf-1", fn)]);
    expect(x.geurteilt + y.geurteilt).toBe(10);
    expect(x.verworfen + y.verworfen).toBe(0);
    expect(fn).toHaveBeenCalledTimes(10);
    expect(new Set(fn.mock.calls.map(([p, q]) => paarVon(p, q))).size).toBe(10);
  });

  it("K4: Fehler, unbestimmt, ohne Modell und Rest bleiben nach dem Neulesen unterscheidbar", async (ctx) => {
    const pool = await frischerPool(ctx);
    const service = new PaarpflichtService({ repo: new PgPaarpflichtRepo(pool) });
    await service.planen("lauf-1", FUENF, KONTEXT);
    const ausgang: Record<string, PaarpflichtErgebnis> = {
      ab: URTEIL,
      ac: { art: "unbestimmt", modell: "lokal:test" },
      ad: { art: "fehler", grund: "model-timeout" },
    };
    await service.abarbeiten("lauf-1", async (a, b) => {
      return ausgang[paarVon(a, b)] ?? { art: "kein_modell", grund: "no-model" };
    });

    const neuGelesen = new PaarpflichtService({ repo: new PgPaarpflichtRepo(neuerPool()) });
    expect(await neuGelesen.bilanz("lauf-1")).toEqual({
      gesamt: 10,
      offen: 7,
      inArbeit: 0,
      geurteilt: 1,
      unbestimmt: 1,
      fehler: 1,
      ohneModell: 7,
      rest: 7,
      abgeschlossen: false,
    });
    const offen = (await neuGelesen.liste("lauf-1")).filter((p) => p.zustand === "offen");
    expect(offen.every((p) => p.urteil === undefined && p.beansprucht === undefined)).toBe(true);
  });

  // Nacharbeit 1 (bens Befund zu cfc43d4a): Bindung prüfen und anlegen in EINER Transaktion.
  it("K1: eine abgewiesene Planung schreibt nichts; gleichzeitige Planungen ergeben keinen gemischten Lauf", async (ctx) => {
    const pool = await frischerPool(ctx);
    const service = new PaarpflichtService({ repo: new PgPaarpflichtRepo(pool) });
    await service.planen("lauf-1", [aussage("a"), aussage("b")], KONTEXT);
    const mitC = [aussage("a"), aussage("b"), aussage("c")];
    const anders = { ...KONTEXT, bestand: "anders" };
    await expect(service.planen("lauf-1", mitC, anders)).rejects.toMatchObject({
      code: "LAUF_STAND_ABWEICHUNG",
    });
    const zeilen = await pool.query<{ pair_key: string }>(
      "SELECT pair_key FROM conflict_pair_obligations WHERE lauf_id = 'lauf-1'",
    );
    expect(zeilen.rows.map((z) => z.pair_key)).toEqual(["ko:a|ko:b"]);

    const zweiterPool = neuerPool();
    const zweiter = new PaarpflichtService({ repo: new PgPaarpflichtRepo(zweiterPool) });
    const ergebnisse = await Promise.allSettled([
      service.planen("lauf-2", FUENF, KONTEXT),
      zweiter.planen("lauf-2", FUENF.slice(0, 3), anders),
    ]);
    expect(ergebnisse.map((e) => e.status).sort()).toEqual(["fulfilled", "rejected"]);
    const pflichten = await service.liste("lauf-2");
    const bestaende = new Set(pflichten.map((p) => p.kontext.bestand));
    expect(bestaende.size).toBe(1);
    expect(pflichten).toHaveLength(bestaende.has("anders") ? 3 : 10);
  });

  it("K3/K4: begrenzte Wiederaufnahme über einen neuen Pool ist fair — ohne Modell verdrängt nichts", async (ctx) => {
    const erster = await frischerPool(ctx);
    const ohneModell = new Set(["ab", "ac", "ad"]);
    const fn = vi.fn<PaarpflichtPruefer>(async (a, b) => {
      return ohneModell.has(paarVon(a, b)) ? { art: "kein_modell", grund: "no-model" } : URTEIL;
    });
    const vorher = new PaarpflichtService({ repo: new PgPaarpflichtRepo(erster) });
    await vorher.planen("lauf-1", FUENF, KONTEXT);
    await vorher.abarbeiten("lauf-1", fn, { limit: 3 });
    await erster.end();

    const nachher = new PaarpflichtService({ repo: new PgPaarpflichtRepo(neuerPool()) });
    for (let i = 0; i < 3; i += 1) {
      await nachher.abarbeiten("lauf-1", fn, { limit: 3 });
    }
    const gefragt = fn.mock.calls.map(([a, b]) => paarVon(a, b));
    expect(gefragt.slice(0, 6)).toEqual(["ab", "ac", "ad", "ae", "bc", "bd"]);
    expect(gefragt.slice(6)).toEqual(["be", "cd", "ce", "de", "ab", "ac"]);
    expect(await nachher.bilanz("lauf-1")).toMatchObject({ geurteilt: 7, ohneModell: 3, rest: 3 });
  });

  // Nacharbeit 1 (bens Befund zu cfc43d4a): der integrierte Produktweg. Zwei vollständig eigene
  // Anwendungen (eigener Pool, eigene Dienste, eigene Ausführung) über derselben Datenbank — im
  // selben Node-Prozess, also ein Instanzwechsel und KEIN echter Prozessneustart. Die erste bleibt
  // im fünften Modellaufruf hängen; die zweite nimmt den gespeicherten Lauf beim Bau der App auf.
  it("K3: Lauf über die Produktwurzel, Abbruch im Modellaufruf, neue Instanz nimmt ihn beim Start wieder auf", async (ctx) => {
    const erster = await frischerPool(ctx);
    await migrate(erster);
    const KEIN_KONFLIKT: ConflictJudgeOutcome = {
      verdict: {
        relation: "kein_konflikt",
        older: null,
        confidence: 0.9,
        begruendung: "Verschiedene Geltung.",
        zitat_a: "",
        zitat_b: "",
      },
    };

    const s1 = buildPgServices(erster);
    // Kurze Frist nur hier: sonst wartete die zweite Instanz fünf Minuten auf die hängende Pflicht.
    const ablage = new PgPaarpflichtRepo(erster);
    s1.paarpflichten = new PaarpflichtService({ repo: ablage, fristMs: 50 });
    let aufrufe = 0;
    const haengt = new Promise<never>(() => {});
    vi.spyOn(s1.reasoner, "judgeConflictOutcome").mockImplementation(async () => {
      aufrufe += 1;
      return aufrufe <= 4 ? KEIN_KONFLIKT : haengt;
    });
    buildApp(s1);
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const ko = await s1.ko.create({
        title: `Regel ${i}`,
        statement: `Aussage Nummer ${i} gilt im Betrieb.`,
        type: "best_practice",
        category: "Betrieb",
        author: "u1",
      });
      ids.push(ko.id);
    }
    const { aussagen, kontext } = await paarpflichtAussagenLaden(
      s1.ko,
      ids,
      PAARPFLICHT_PRUEFFASSUNG,
    );
    await s1.paarpflichten.planen("lauf-pg", aussagen, kontext);
    s1.paarpflichtAusfuehrung?.anstossen("lauf-pg");
    await vi.waitFor(() => expect(aufrufe).toBe(5), { timeout: 10_000 });
    const zwischen = new PaarpflichtService({ repo: new PgPaarpflichtRepo(erster) });
    expect(await zwischen.bilanz("lauf-pg")).toMatchObject({ geurteilt: 4, inArbeit: 1, rest: 6 });
    await new Promise((fertig) => setTimeout(fertig, 100));

    const s2 = buildPgServices(neuerPool());
    const judge = vi.spyOn(s2.reasoner, "judgeConflictOutcome").mockResolvedValue(KEIN_KONFLIKT);
    buildApp(s2);
    await s2.paarpflichtAusfuehrung?.leerlauf();

    expect(judge).toHaveBeenCalledTimes(6);
    const bilanz = await s2.paarpflichten.bilanz("lauf-pg");
    expect(bilanz).toMatchObject({ gesamt: 10, geurteilt: 10, rest: 0, abgeschlossen: true });
    const pflichten = await s2.paarpflichten.liste("lauf-pg");
    expect(pflichten.filter((p) => p.urteil)).toHaveLength(10);
    // Die Kennungen sind hier echte UUIDs, keine Buchstaben: Instanz 1 hat in Paarschlüssel-
    // Reihenfolge vier Paare geurteilt und hing am FÜNFTEN. Genau dieses wurde zweimal vorgelegt,
    // jedes andere genau einmal (`liste` ist nach Paarschlüssel geordnet).
    const haengendesPaar = pflichten[4]?.pairKey;
    const zweimal = pflichten.filter((p) => p.vorlagen === 2).map((p) => p.pairKey);
    expect(zweimal).toEqual([haengendesPaar]);
    expect(pflichten.filter((p) => p.vorlagen === 1)).toHaveLength(9);
  });
});

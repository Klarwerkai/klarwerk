// ================================================================================================
// LAUF gesamt-import-adoption:2 RUNDE 2 (Bens B2) — DIE ANNAHME-SPERRE GEGEN ECHTES POSTGRES.
// ================================================================================================
//
// `sperre-im-bestand.test.ts` prüft die Pg-Sperre nur über einen Pool-Ersatz (SQL-Folge,
// Fehlerabbildung). Was dort NICHT prüfbar ist, steht hier: die datenbankweite Wirkung zwischen
// ZWEI UNABHÄNGIGEN Pools — jeder mit eigenem `PgCandidateRepo` und damit eigener Prozess-Kette, so
// dass allein die Advisory-Sperre der Datenbank die Annahmen trennt. Beide teilen den
// Kandidatenbestand (dieselbe Tabelle) und den Wissensobjekt-Bestand (ein gemeinsamer KoService;
// Gegenstand ist die Sperre, nicht die KO-Persistenz).
//
//   S1 — Textweg, zwei Pools, identische Kandidaten gleichzeitig → ein Objekt.
//   S2 — Herkunftsanker, zwei Pools, zwei Fassungen derselben Quelle gleichzeitig → ein Objekt.
//   S3 — Bens B1: A hängt vor der Anlage, Lease-Ablauf, Recovery (über Pool B) gibt A frei, B
//        wird über Pool B angenommen und WARTET; A setzt fort → genau ein Objekt.
//   S4 — wie S3, aber B mit kurzer Wartezeit: `lock_timeout` → CONFLICT, Claim zurück, nichts angelegt.
//   S5 — eine für die Sitzung gesetzte `idle_in_transaction_session_timeout` beendet die
//        Sperrsitzung NICHT, solange der Halter arbeitet (sonst fiele die Sperre wie in B1).
//
// Läuft NUR unter `test:integration` (Docker/Testcontainers oder eine per KLARWERK_PG_TEST_URL
// angebotene lokale Testinstanz) — dieselbe Bauform wie `tests/q2d-leere-kennung/
// pg-leere-kennung.integration.test.ts`. Ohne beides wird EHRLICH übersprungen; ein Überspringen ist
// kein Prüfbeleg.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  type DublettenPruefung,
  IMPORT_CANDIDATES_SCHEMA,
  LibraryService,
  PgCandidateRepo,
  REVIEW_CLAIM_LEASE_MS,
} from "../../services/library-analytics";

const NIE_AEHNLICH: DublettenPruefung = () => ({ dublette: false });

const EINTRAG = {
  title: "Filterkerze wechseln",
  statement: "Die Filterkerze beim Oelwechsel tauschen",
  type: "best_practice" as const,
  category: "Wartung",
  confidentiality: "intern" as const,
};

describe("Bens B2 · Annahme-Sperre über zwei unabhängige Pools gegen echtes Postgres", () => {
  let container: StartedTestContainer | undefined;
  let url: string | undefined;
  let available = false;
  const pools: Pool[] = [];

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      url = localUrl;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      return;
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          // Name nicht frei gewählt: s. `tests/app/job2354-drei-datenbanknamen.test.ts` (E7).
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
      } catch {
        return;
      }
    }
    try {
      const probe = new Pool({ connectionString: url });
      await probe.query("SELECT 1");
      await probe.end();
      available = true;
    } catch {
      process.stderr.write(
        "[KLARWERK] Annahme-Sperre-Pg-Suite UEBERSPRUNGEN: keine Verbindung zur Testinstanz.\n",
      );
    }
  });

  afterAll(async () => {
    for (const p of pools) {
      await p.end().catch(() => undefined);
    }
    await container?.stop();
  });

  function neuerPool(ctx: { skip: () => void }, options?: string): Pool {
    if (!available || !url) {
      ctx.skip();
      throw new Error("unreachable");
    }
    const p = new Pool({ connectionString: url, ...(options ? { options } : {}) });
    pools.push(p);
    return p;
  }

  /** Zwei Dienstinstanzen auf frischer Tabelle, je ein eigener Pool, gemeinsamer KO-Bestand. */
  async function zweiInstanzen(
    ctx: { skip: () => void },
    opts: { anker?: boolean; wartezeitB?: number; optionsA?: string } = {},
  ) {
    const poolA = neuerPool(ctx, opts.optionsA);
    const poolB = neuerPool(ctx);
    await poolA.query("DROP TABLE IF EXISTS import_candidates");
    await poolA.query(IMPORT_CANDIDATES_SCHEMA);
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    await koService.activateSearchProjectionV2();
    const uhr = { ms: Date.parse("2026-10-01T08:00:00Z") };
    const repoA = new PgCandidateRepo(poolA);
    const repoB = new PgCandidateRepo(poolB);
    const links = new LibraryService({
      koService,
      candidates: repoA,
      externalUpsert: opts.anker ?? false,
      now: () => uhr.ms,
    });
    const rechts = new LibraryService({
      koService,
      candidates: repoB,
      externalUpsert: opts.anker ?? false,
      now: () => uhr.ms,
      ...(opts.wartezeitB === undefined ? {} : { annahmeWartezeitMs: opts.wartezeitB }),
    });
    return { koService, uhr, repoA, repoB, links, rechts, poolB };
  }

  /** Lässt die ERSTE echte Objektanlage vor `create` hängen, bis `loesen()` gerufen wird. */
  function torVorAnlage(koService: KoService) {
    const create = koService.create.bind(koService);
    let loesen: () => void = () => undefined;
    let betreten: () => void = () => undefined;
    const tor = new Promise<void>((r) => {
      loesen = r;
    });
    const bereit = new Promise<void>((r) => {
      betreten = r;
    });
    let erster = true;
    koService.create = async (input) => {
      if (erster) {
        erster = false;
        betreten();
        await tor;
      }
      return create(input);
    };
    return { bereit, loesen };
  }

  async function gehalteneAnnahmeSperren(p: Pool): Promise<number> {
    const res = await p.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM pg_locks WHERE locktype = 'advisory' AND granted",
    );
    return Number(res.rows[0]?.n ?? 0);
  }

  it("S1 · Textweg: identische Kandidaten über zwei Pools gleichzeitig angenommen → ein Objekt", async (ctx) => {
    const { koService, links, rechts } = await zweiInstanzen(ctx);
    const [a] = await links.createImportCandidates([EINTRAG], "imp", NIE_AEHNLICH);
    const [b] = await rechts.createImportCandidates([EINTRAG], "imp", NIE_AEHNLICH);
    const [ra, rb] = await Promise.all([
      links.reviewImportCandidate(a!.id, "accept", "rev", undefined, NIE_AEHNLICH),
      rechts.reviewImportCandidate(b!.id, "accept", "rev", undefined, NIE_AEHNLICH),
    ]);
    expect(await koService.list()).toHaveLength(1);
    expect([ra.koId, rb.koId].filter((id) => id !== null)).toHaveLength(1);
  });

  it("S2 · Herkunftsanker: zwei Fassungen derselben Quelle über zwei Pools → ein Objekt, Version 2", async (ctx) => {
    const { koService, links, rechts } = await zweiInstanzen(ctx, { anker: true });
    const quelle = { ...EINTRAG, provider: "wiki", externalId: "quelle-42" };
    const [v1] = await links.createImportCandidates([{ ...quelle, sourceVersion: 1 }], "imp");
    const [v2] = await rechts.createImportCandidates([{ ...quelle, sourceVersion: 2 }], "imp");
    const [r1, r2] = await Promise.all([
      links.reviewImportCandidate(v1!.id, "accept", "rev"),
      rechts.reviewImportCandidate(v2!.id, "accept", "rev"),
    ]);
    const kos = await koService.list();
    expect(kos).toHaveLength(1);
    expect(r1.koId).toBe(kos[0]?.id);
    expect(r2.koId).toBe(kos[0]?.id);
    expect(kos[0]?.sources.find((s) => s.externalId === "quelle-42")?.sourceVersion).toBe(2);
  });

  for (const anker of [false, true]) {
    const weg = anker ? "Herkunftsanker" : "Textweg";
    const quelle = anker ? { ...EINTRAG, provider: "wiki", externalId: "quelle-42" } : EINTRAG;

    it(`S3 · ${weg} (Bens B1): Recovery gibt den hängenden Halter frei, B wartet über die DB-Sperre → ein Objekt`, async (ctx) => {
      const inst = await zweiInstanzen(ctx, { anker });
      const [a] = await inst.links.createImportCandidates(
        [{ ...quelle, sourceVersion: 1 }],
        "imp",
        NIE_AEHNLICH,
      );
      const [b] = await inst.rechts.createImportCandidates(
        [{ ...quelle, sourceVersion: 2 }],
        "imp",
        NIE_AEHNLICH,
      );
      const { bereit, loesen } = torVorAnlage(inst.koService);
      const alterLauf = inst.links
        .reviewImportCandidate(a!.id, "accept", "rev-a", undefined, NIE_AEHNLICH)
        .then(
          () => "fulfilled",
          (e: { code?: string }) => e.code,
        );
      await bereit;
      expect(await gehalteneAnnahmeSperren(inst.poolB)).toBe(1);
      inst.uhr.ms += REVIEW_CLAIM_LEASE_MS + 1;
      expect(await inst.rechts.recoverStaleReviewClaims()).toEqual({ completed: 0, released: 1 });

      const bLauf = inst.rechts.reviewImportCandidate(
        b!.id,
        "accept",
        "rev-b",
        undefined,
        NIE_AEHNLICH,
      );
      await new Promise((r) => setTimeout(r, 300));
      expect(
        await inst.koService.list(),
        "B legt nicht neben dem lebenden Halter an.",
      ).toHaveLength(0);
      loesen();
      expect(await alterLauf).toBe("CONFLICT");
      const angenommen = await bLauf;
      expect(angenommen.status).toBe("angenommen");
      const kos = await inst.koService.list();
      expect(kos).toHaveLength(1);
      expect(kos[0]?.importCandidateId).toBe(a!.id);
      expect(await gehalteneAnnahmeSperren(inst.poolB)).toBe(0);
    });

    it(`S4 · ${weg}: B mit kurzer Wartezeit bekommt CONFLICT (lock_timeout), Claim zurück, nichts angelegt`, async (ctx) => {
      const inst = await zweiInstanzen(ctx, { anker, wartezeitB: 200 });
      const [a] = await inst.links.createImportCandidates(
        [{ ...quelle, sourceVersion: 1 }],
        "imp",
        NIE_AEHNLICH,
      );
      const [b] = await inst.rechts.createImportCandidates(
        [{ ...quelle, sourceVersion: 2 }],
        "imp",
        NIE_AEHNLICH,
      );
      const { bereit, loesen } = torVorAnlage(inst.koService);
      const alterLauf = inst.links
        .reviewImportCandidate(a!.id, "accept", "rev-a", undefined, NIE_AEHNLICH)
        .catch(() => undefined);
      await bereit;
      await expect(
        inst.rechts.reviewImportCandidate(b!.id, "accept", "rev-b", undefined, NIE_AEHNLICH),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await inst.koService.list()).toHaveLength(0);
      expect((await inst.repoB.findById(b!.id))?.status).toBe("neu");
      loesen();
      await alterLauf;
      expect(await inst.koService.list()).toHaveLength(1);
    });
  }

  it("S5 · eine Sitzungs-Leerlauffrist von 100 ms beendet die Sperrsitzung nicht, solange der Halter arbeitet", async (ctx) => {
    const inst = await zweiInstanzen(ctx, {
      optionsA: "-c idle_in_transaction_session_timeout=100",
    });
    const [a] = await inst.links.createImportCandidates([EINTRAG], "imp", NIE_AEHNLICH);
    const [b] = await inst.rechts.createImportCandidates([EINTRAG], "imp", NIE_AEHNLICH);
    const { bereit, loesen } = torVorAnlage(inst.koService);
    const aLauf = inst.links.reviewImportCandidate(
      a!.id,
      "accept",
      "rev-a",
      undefined,
      NIE_AEHNLICH,
    );
    await bereit;
    await new Promise((r) => setTimeout(r, 500));
    expect(await gehalteneAnnahmeSperren(inst.poolB), "Die Sperre steht nach 500 ms noch.").toBe(1);
    const bLauf = inst.rechts.reviewImportCandidate(
      b!.id,
      "accept",
      "rev-b",
      undefined,
      NIE_AEHNLICH,
    );
    await new Promise((r) => setTimeout(r, 200));
    expect(await inst.koService.list()).toHaveLength(0);
    loesen();
    const [ra, rb] = await Promise.all([aLauf, bLauf]);
    expect(ra.koId).toBeTruthy();
    expect(rb.koId).toBeNull();
    expect(await inst.koService.list()).toHaveLength(1);
  });
});

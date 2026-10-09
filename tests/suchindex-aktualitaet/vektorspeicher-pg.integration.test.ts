// ================================================================================================
// R-0470 (Ben, Nacharbeit 3) — DER VEKTORSPEICHER ÜBERLEBT DEN NEUSTART, GEGEN ECHTES POSTGRES.
// ================================================================================================
//
// „Warteschlange + dauerhaft + entfernen". Belegt wird hier, was nur ein echter Server belegen kann:
//   V1  `migrate()` legt `ko_embeddings` an; ein ZWEITER Pool und ein frischer Speicher finden nach
//       dem „Neustart" dieselben Vektoren samt Stand und dieselben Nachbarn.
//   V2  Eine Änderung, die vor dem Neustart keine Schlange mehr erreichte, wird beim Start erkannt
//       und von der Schlange nachgeführt — im dauerhaften Speicher, mit dem Bestand in Postgres.
//   V3  Entfernen wirkt dauerhaft, und B5 (keine fremde Version/Dimension) gilt auch hier.
//
// Läuft unter `npm run test:integration`. Die Datenbank kommt aus `tests/ko/pg-pruefplatz.ts`
// (isoliert über `KLARWERK_PG_TEST_URL`, sonst Testcontainer, sonst ROT).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import {
  indexKoForDuplicatePrefilter,
  nachfuehrungNachStart,
  reindexKoForDuplicatePrefilter,
} from "../../services/app/src/duplicate-detection";
import { createReindexQueue } from "../../services/app/src/reindex-queue";
import { PgEmbeddingStore, stubEmbeddingProvider } from "../../services/embedding";
import { KoService, PgKoRepo, PgKoSearchProjectionRepo } from "../../services/knowledge-object";
import { type IsoliertePg, oeffneIsoliertePg } from "../ko/pg-pruefplatz";

const EINGABE = {
  title: "Kompressor K9",
  statement: "Ölstand wöchentlich prüfen.",
  type: "best_practice" as const,
  category: "Wartung",
  author: "anna",
};

describe("R-0470 · dauerhafter Vektorspeicher gegen echtes PostgreSQL", () => {
  let pg: IsoliertePg | undefined;
  let url: string;

  beforeAll(async () => {
    pg = await oeffneIsoliertePg("vektoren");
    url = pg.url;
  }, 180_000);

  afterAll(async () => {
    await pg?.abraeumen();
  });

  async function frisch() {
    const pool = createPool(url);
    await migrate(pool);
    await pool.query("DELETE FROM ko_embeddings");
    await pool.query("DELETE FROM ko_search_projections");
    await pool.query("DELETE FROM ko_metadata_projections");
    await pool.query("DELETE FROM kos");
    await pool.query("DELETE FROM ko_projection_control");
    await pool.query(
      "INSERT INTO ko_projection_control(key, projection_state) VALUES ('singleton','UNINITIALIZED')",
    );
    return pool;
  }

  function dienst(pool: ReturnType<typeof createPool>) {
    return new KoService({
      repo: new PgKoRepo(pool),
      searchProjections: new PgKoSearchProjectionRepo(pool),
    });
  }

  it("V1 · nach dem Neustart: dieselben Vektoren, derselbe Stand, dieselben Nachbarn", async () => {
    const pool = await frisch();
    const embedder = stubEmbeddingProvider();
    try {
      const store = new PgEmbeddingStore(pool);
      const a = await embedder.embed(["Kompressor Ölstand"]);
      const b = await embedder.embed(["Turbine Lager"]);
      await store.upsert("ko-a", a.vectors[0] ?? [], a.embeddingVersion, "stand-a");
      await store.upsert("ko-b", b.vectors[0] ?? [], b.embeddingVersion, "stand-b");
      const vorher = await store.nearest(a.vectors[0] ?? [], a.embeddingVersion, 2);

      const zweiterPool = createPool(url);
      try {
        const nachNeustart = new PgEmbeddingStore(zweiterPool);
        expect(await nachNeustart.standVon("ko-a")).toBe("stand-a");
        expect([...(await nachNeustart.staende()).entries()].sort()).toEqual([
          ["ko-a", "stand-a"],
          ["ko-b", "stand-b"],
        ]);
        const nachher = await nachNeustart.nearest(a.vectors[0] ?? [], a.embeddingVersion, 2);
        expect(nachher.map((h) => h.id)).toEqual(vorher.map((h) => h.id));
        expect(nachher[0]?.id).toBe("ko-a");
        expect(nachher[0]?.score ?? 0).toBeCloseTo(vorher[0]?.score ?? -1, 9);
      } finally {
        await zweiterPool.end();
      }
    } finally {
      await pool.end();
    }
  });

  it("V2 · eine vor dem Neustart unterbrochene Änderung wird beim Start erkannt und nachgeführt", async () => {
    const pool = await frisch();
    try {
      const ko = dienst(pool);
      await ko.activateSearchProjectionV2();
      const semanticPrefilter = {
        embedder: stubEmbeddingProvider(),
        store: new PgEmbeddingStore(pool),
        topK: 25,
      };
      const passt = await ko.create({ ...EINGABE, title: "Unverändert" });
      const geaendert = await ko.create({ ...EINGABE, title: "Vor dem Neustart" });
      const hoch = await ko.create({ ...EINGABE, title: "Vor dem Neustart heraufgestuft" });
      // Erstablage über den Einreicheweg — wie nach einer regulären Einreichung.
      for (const k of [passt, geaendert, hoch]) {
        await indexKoForDuplicatePrefilter(k, semanticPrefilter);
      }
      const standVorher = await semanticPrefilter.store.standVon(geaendert.id);
      // Der Prozess stirbt, bevor die Schlange diese beiden Änderungen erreicht (kein Nachlauf).
      await ko.revise(geaendert.id, { statement: "Geändert vor dem Absturz." }, "anna");
      await ko.setConfidentiality(hoch.id, "vertraulich", "anna");

      // „Neustart": neuer Pool, neuer Dienst, neuer Speicher, neue Schlange.
      const zweiterPool = createPool(url);
      try {
        const ko2 = dienst(zweiterPool);
        const prefilter2 = { ...semanticPrefilter, store: new PgEmbeddingStore(zweiterPool) };
        const fehler: string[] = [];
        const queue = createReindexQueue({
          reindex: (id) =>
            reindexKoForDuplicatePrefilter(id, { ko: ko2, semanticPrefilter: prefilter2 }),
          onError: (id) => fehler.push(id),
        });
        const zahl = await nachfuehrungNachStart({
          ko: ko2,
          store: prefilter2.store,
          enqueue: (id) => queue.enqueue(id),
        });
        await queue.idle();

        expect(zahl).toBe(2);
        expect(fehler).toEqual([]);
        expect([...(await prefilter2.store.staende()).keys()].sort()).toEqual(
          [passt.id, geaendert.id].sort(),
        );
        const standNachher = await prefilter2.store.standVon(geaendert.id);
        expect(standNachher).toBeTruthy();
        expect(standNachher).not.toBe(standVorher);
      } finally {
        await zweiterPool.end();
      }
    } finally {
      await pool.end();
    }
  });

  it("V3 · Entfernen wirkt dauerhaft; fremde Version oder Dimension wird abgewiesen", async () => {
    const pool = await frisch();
    try {
      const store = new PgEmbeddingStore(pool);
      const v = await stubEmbeddingProvider().embed(["x"]);
      await store.upsert("ko-a", v.vectors[0] ?? [], v.embeddingVersion, "s");
      await store.upsert("ko-b", v.vectors[0] ?? [], v.embeddingVersion, "s");
      await store.delete("ko-a");
      expect(await new PgEmbeddingStore(pool).standVon("ko-a")).toBeUndefined();

      await expect(store.upsert("ko-c", v.vectors[0] ?? [], "fremd@1", "s")).rejects.toThrow(
        /embeddingVersion/,
      );
      await expect(store.upsert("ko-c", [1, 0], v.embeddingVersion, "s")).rejects.toThrow(
        /Dimension/,
      );
    } finally {
      await pool.end();
    }
  });
});

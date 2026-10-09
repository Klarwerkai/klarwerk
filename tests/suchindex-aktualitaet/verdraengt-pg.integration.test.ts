// ================================================================================================
// AUFNAHME 20260922 · GESAMT-SUCHINDEX-AKTUALITAET — VERDRÄNGT, NICHT ERGÄNZT, GEGEN ECHTES POSTGRES.
// ================================================================================================
//
// Das Gegenstück zu `verdraengt-nicht-ergaenzt.test.ts` am Pg-Adapter. Zwei Zusagen lassen sich nur
// hier belegen:
//   · die neue JOIN-Bedingung `K_NICHT_AUFGEGANGEN` (search-projection-repo-pg.ts) ist gültiges SQL
//     und hält einen aufgegangenen Artikel wirklich aus Treffer- und Kandidatenmenge (R-0483);
//   · nach einer Überarbeitung findet ein ZWEITER, frischer Dienst am selben Bestand — der
//     Neustart — den neuen Stand und nicht den alten (R-0470 „der Index überlebt einen Neustart").
//
// Läuft unter `npm run test:integration`. Die Datenbank kommt aus `tests/ko/pg-pruefplatz.ts`
// (isoliert über `KLARWERK_PG_TEST_URL`, sonst Testcontainer, sonst ROT).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { KoService, PgKoRepo, PgKoSearchProjectionRepo } from "../../services/knowledge-object";
import { type IsoliertePg, oeffneIsoliertePg } from "../ko/pg-pruefplatz";

const EINGABE = {
  title: "Kühlkreislauf KK3",
  statement: "Kurzfassung ohne die Prüfwörter.",
  type: "best_practice" as const,
  category: "Wartung",
  author: "anna",
};

describe("Suchindex-Aktualität · Pg-Adapter", () => {
  let pg: IsoliertePg | undefined;
  let url: string;

  beforeAll(async () => {
    pg = await oeffneIsoliertePg("aktualitaet");
    url = pg.url;
  }, 180_000);

  afterAll(async () => {
    await pg?.abraeumen();
  });

  async function frischerBestand() {
    const pool = createPool(url);
    await migrate(pool);
    await pool.query("DELETE FROM ko_search_projections");
    await pool.query("DELETE FROM ko_metadata_projections");
    await pool.query("DELETE FROM kos");
    await pool.query("DELETE FROM ko_projection_control");
    await pool.query(
      "INSERT INTO ko_projection_control(key, projection_state) VALUES ('singleton','UNINITIALIZED')",
    );
    const ko = new KoService({
      repo: new PgKoRepo(pool),
      searchProjections: new PgKoSearchProjectionRepo(pool),
    });
    const { readiness } = await ko.activateSearchProjectionV2();
    expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
    return { pool, ko };
  }

  async function beideFlaechen(ko: KoService, begriff: string) {
    return {
      bibliothek: (await ko.findSearchHits({ terms: [begriff] })).map((h) => h.koId),
      klara: (await ko.findCandidates({ terms: [begriff], limit: 50 })).map((k) => k.id),
    };
  }

  it("P1 · aufgegangen ⇒ weder Treffer noch Kandidat; der Inhalt bleibt über den Führungsartikel auffindbar", async () => {
    const { pool, ko } = await frischerBestand();
    try {
      const fuehrend = await ko.create({
        ...EINGABE,
        title: "Führend",
        bodyHtml: "<p>Fuehrwort</p>",
      });
      const aufgehend = await ko.create({
        ...EINGABE,
        title: "Aufgehend",
        bodyHtml: "<p>Totwortpg</p>",
      });
      expect(await beideFlaechen(ko, "totwortpg")).toEqual({
        bibliothek: [aufgehend.id],
        klara: [aufgehend.id],
      });

      const neu = await ko.revise(
        fuehrend.id,
        { bodyHtml: "<p>Fuehrwort</p><p>Totwortpg</p>" },
        "kurator",
      );
      await ko.markMergedInto(
        aufgehend.id,
        { koId: fuehrend.id, version: neu.version, overlapId: "ov-pg" },
        "kurator",
        aufgehend.version,
      );

      expect(await beideFlaechen(ko, "totwortpg")).toEqual({
        bibliothek: [fuehrend.id],
        klara: [fuehrend.id],
      });
    } finally {
      await pool.end();
    }
  });

  it("P2 · Papierkorb ⇒ kein Treffer; Wiederherstellen ⇒ wieder Treffer", async () => {
    const { pool, ko } = await frischerBestand();
    try {
      const a = await ko.create({ ...EINGABE, bodyHtml: "<p>Korbwortpg</p>" });
      await ko.delete(a.id, "anna");
      expect(await beideFlaechen(ko, "korbwortpg")).toEqual({ bibliothek: [], klara: [] });
      await ko.restore(a.id, "anna");
      expect(await beideFlaechen(ko, "korbwortpg")).toEqual({ bibliothek: [a.id], klara: [a.id] });
    } finally {
      await pool.end();
    }
  });

  it("P3 · nach Überarbeitung und Neustart findet ein frischer Dienst den neuen Stand, nicht den alten", async () => {
    const { pool, ko } = await frischerBestand();
    try {
      const a = await ko.create({ ...EINGABE, bodyHtml: "<p>Altwortpg</p>" });
      await ko.revise(a.id, { bodyHtml: "<p>Neuwortpg</p>" }, "anna");
      expect(await beideFlaechen(ko, "altwortpg")).toEqual({ bibliothek: [], klara: [] });

      // „Neustart": neuer Pool, neuer Adapter, neuer Dienst — derselbe Bestand.
      const zweiterPool = createPool(url);
      try {
        const zweiter = new KoService({
          repo: new PgKoRepo(zweiterPool),
          searchProjections: new PgKoSearchProjectionRepo(zweiterPool),
        });
        expect(await beideFlaechen(zweiter, "neuwortpg")).toEqual({
          bibliothek: [a.id],
          klara: [a.id],
        });
        expect(await beideFlaechen(zweiter, "altwortpg")).toEqual({ bibliothek: [], klara: [] });
      } finally {
        await zweiterPool.end();
      }
    } finally {
      await pool.end();
    }
  });
});

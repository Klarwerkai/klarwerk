// ================================================================================================
// SUCHPROJEKTION · R-1134 — DIE VORAUSWAHL IST EIN INDEXZUGRIFF, GEMESSEN AM ECHTEN PLANNER
// ================================================================================================
//
// DIE ZUSAGE (R-1134): „Die Datenbank bekommt passende Suchindizes, damit die Vorauswahl auch bei
// vielen Wissensobjekten schnell bleibt." Die Indizes lagen da (`idx_ko_search_projections_
// search_trgm`, die beiden Trigramm-Indizes der Metadatenprojektion) — aber die Suchanweisung
// verknüpfte `p.search_text` per ODER mit `COALESCE(md.…, '')` aus dem LEFT JOIN, und ein ODER über
// zwei Tabellen löst PostgreSQL nicht als Indexzugriff auf. Jede Suche las jede aktive Zeile.
//
// WAS DIESE DATEI MISST — und nur ein ausführender PostgreSQL kann es beantworten, kein Fake-Pool:
//
//   V1  DIESELBE TREFFERMENGE. Die erzeugte Anweisung und dieselbe Anweisung OHNE die Vorauswahl
//       (die Form vor dieser Änderung) liefern Zeile für Zeile dasselbe — Inhalt, Kategorie,
//       Schlagwort, ein Objekt ohne Metadatenzeile, und eine ältere Fassung, deren Text NICHT
//       treffen darf.
//   V2  DER PLAN NUTZT DIE TRIGRAMM-INDIZES. Mit `enable_seqscan = off` und `enable_indexscan =
//       off` sind die vollen Durchläufe (auch der über den Primärschlüssel mit Filter) gesperrt; im
//       Plan stehen dann alle drei Trigramm-Indizes als Bitmap-Zugriff.
//   K   KALIBRIERUNG: dieselbe Messung an der Form ohne Vorauswahl findet KEINEN der drei — sonst
//       wäre V2 auch ohne diese Änderung grün und bewiese nichts.
//
// WAS SIE NICHT MISST: Laufzeiten bei 10.000 oder 100.000 Objekten und die Verfügbarkeit von
// `pg_trgm` in einer Kundenumgebung. Beides bleibt eine offene Messung am Zielsystem.
//
// Läuft unter `vitest.integration.config.ts`. Die Datenbank kommt aus `../ko/pg-pruefplatz`
// (isoliert über `KLARWERK_PG_TEST_URL`, sonst Testcontainer, sonst ROT).
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import {
  type KnowledgeObject,
  KoService,
  PgKoRepo,
  PgKoSearchProjectionRepo,
  buildSearchProjection,
} from "../../services/knowledge-object";
import { type IsoliertePg, oeffneIsoliertePg } from "../ko/pg-pruefplatz";

const AT = "2026-10-08T09:00:00.000Z";
const FUELLBESTAND = 300;
const TRIGRAMM_INDIZES = [
  "idx_ko_search_projections_search_trgm",
  "idx_ko_metadata_projections_category_trgm",
  "idx_ko_metadata_projections_tag_trgm",
] as const;
const BEGRIFFE = ["zielinhalt", "zielkategorie", "zielschlagwort", "altfassungswort"];

interface Felder {
  title?: string;
  category?: string;
  tags?: string[];
  koerper?: string;
  version?: number;
}

function objekt(id: string, felder: Felder): KnowledgeObject {
  return {
    id,
    title: felder.title ?? `Objekt ${id}`,
    statement: "Aussage ohne Zielwort.",
    bodyHtml: `<p>${felder.koerper ?? "Fuellwort"}</p>`,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: felder.category ?? "Wartung",
    tags: felder.tags ?? [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: felder.version ?? 1,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 1,
    assignments: [],
    createdAt: AT,
    history: [],
  } as unknown as KnowledgeObject;
}

/** Die Anweisung, wie sie VOR der Vorauswahl lautete: das UND-Glied `(p.ko_id, p.ko_version) IN (…)` fällt weg. */
function ohneVorauswahl(sql: string): string {
  const ohne = sql.replace(/\(p\.ko_id, p\.ko_version\) IN \([\s\S]*?\) AND \(/, "(");
  expect(ohne, "die Vorauswahl stand nicht in der Anweisung").not.toBe(sql);
  return ohne;
}

describe("Suchprojektion · R-1134 — die Vorauswahl gegen echtes PostgreSQL", () => {
  let pg: IsoliertePg | undefined;
  let pool: Pool;
  let anweisung: { sql: string; params: unknown[] };
  let trefferIds: string[];

  beforeAll(async () => {
    pg = await oeffneIsoliertePg("vorauswahl");
    pool = createPool(pg.url);
    await migrate(pool);
    const repo = new PgKoRepo(pool);
    const projections = new PgKoSearchProjectionRepo(pool);
    const ko = new KoService({ repo, searchProjections: projections });

    for (let i = 0; i < FUELLBESTAND; i += 1) {
      await repo.insert(objekt(`fuell-${String(i).padStart(4, "0")}`, {}));
    }
    await repo.insert(objekt("inhalt", { koerper: "Der Zielinhalt steht nur im Fliesstext." }));
    await repo.insert(objekt("kategorie", { category: "Zielkategorie" }));
    await repo.insert(objekt("schlagwort", { tags: ["Zielschlagwort"] }));
    await repo.insert(objekt("ohne-meta", { title: "Zielinhalt im Titel" }));
    await repo.insert(objekt("versioniert", { version: 2 }));

    const { readiness } = await ko.activateSearchProjectionV2();
    expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);

    // Ein Objekt OHNE Metadatenzeile: es bleibt über seinen Inhalt auffindbar (LEFT JOIN).
    await pool.query("DELETE FROM ko_metadata_projections WHERE ko_id = 'ohne-meta'");
    // Eine ÄLTERE Fassung, deren Text trifft — die aktive Fassung 2 trägt das Wort nicht. Sie darf
    // über die Vorauswahl nicht in die Treffer rutschen.
    await projections.insert(
      buildSearchProjection(
        objekt("versioniert", { version: 1, koerper: "Altfassungswort der ersten Fassung." }),
        AT,
      ),
    );
    // Der Planner schätzt mit den Statistiken des tatsächlichen Bestands, nicht mit Vorgaben.
    await pool.query("ANALYZE kos, ko_search_projections, ko_metadata_projections");

    // Die Anweisung, die der Adapter WIRKLICH absetzt — aufgezeichnet, nicht nachgebaut.
    const abgesetzt: { sql: string; params: unknown[] }[] = [];
    const aufzeichnend = {
      query: (sql: string, params?: unknown[]) => {
        abgesetzt.push({ sql, params: params ?? [] });
        return pool.query(sql, params);
      },
    } as unknown as Pool;
    const treffer = await new PgKoSearchProjectionRepo(aufzeichnend).findActive({
      terms: BEGRIFFE,
    });
    trefferIds = treffer.map((t) => t.koId).sort();
    const suche = abgesetzt.find((a) => a.sql.includes("FROM ko_search_projections p"));
    expect(suche, "keine Suchanweisung abgesetzt").toBeDefined();
    anweisung = suche as { sql: string; params: unknown[] };
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await pg?.abraeumen();
  });

  // WAS DIE MESSUNG FRAGT: KANN die Anweisung die Trigramm-Indizes nutzen? Bei ~300 Zeilen hält der
  // Planner einen vollen Durchlauf für billiger — als Seq Scan oder, wenn der abgeschaltet ist, als
  // Index Scan über den Primärschlüssel MIT Filter (Nacharbeit 1: so lief der Metadaten-Arm). Beides
  // liest jede Zeile. Abgeschaltet bleibt deshalb genau dieser Vollweg; Bitmap-Zugriffe bleiben
  // erlaubt — und die gibt es nur dort, wo die Anweisung eine Indexbedingung hergibt. Die Kalibrierung
  // K misst unter denselben Schaltern, dass die alte Form keine hergab.
  async function plan(sql: string, params: unknown[]): Promise<string> {
    const client = await pool.connect();
    try {
      await client.query("SET enable_seqscan = off");
      await client.query("SET enable_indexscan = off");
      const res = await client.query<{ "QUERY PLAN": string }>(`EXPLAIN ${sql}`, params);
      return res.rows.map((r) => r["QUERY PLAN"]).join("\n");
    } finally {
      await client.query("RESET enable_seqscan");
      await client.query("RESET enable_indexscan");
      client.release();
    }
  }

  it("V1 · dieselbe Treffermenge wie ohne Vorauswahl — Zeile für Zeile, ältere Fassung bleibt draußen", async () => {
    expect(trefferIds).toEqual(["inhalt", "kategorie", "ohne-meta", "schlagwort"]);

    const mit = await pool.query(anweisung.sql, anweisung.params);
    const ohne = await pool.query(ohneVorauswahl(anweisung.sql), anweisung.params);
    expect(mit.rows.length).toBe(4);
    expect(mit.rows).toEqual(ohne.rows);
  });

  it("V2 · der Plan der erzeugten Anweisung nutzt alle drei Trigramm-Indizes", async () => {
    const text = await plan(anweisung.sql, anweisung.params);
    for (const index of TRIGRAMM_INDIZES) {
      expect(text, `${index} fehlt im Plan:\n${text}`).toContain(index);
    }
  });

  it("K · Kalibrierung: ohne Vorauswahl nutzt derselbe Planner keinen der drei", async () => {
    const text = await plan(ohneVorauswahl(anweisung.sql), anweisung.params);
    for (const index of TRIGRAMM_INDIZES) {
      expect(text, `${index} steht unerwartet im Plan:\n${text}`).not.toContain(index);
    }
  });
});

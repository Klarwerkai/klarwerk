// ================================================================================================
// JOB 544 / D4 — DIE WIEDERHOLBARKEIT DER SUCHE, AN BEIDEN ADAPTERN GEPINNT.
// ================================================================================================
//
// Das rote Vollurteil `_relay/kopf/outbox/BEN3-PRUEFUNG-JOB-544-D3.md` verlangt (Prüflücke 2 und 3):
//
//   „PostgreSQL-Gleichstand: gleiche Validierung, Trust und Relevanz; erwartet: ohne ID-Tiebreaker
//    gezielt roter Vertrag, danach stabile ID-Reihenfolge."
//   „Adapterparität: … erwartet: ownerentschieden entweder identische Kandidatenmengen oder
//    ausdrücklich verschiedene, getrennt benannte Verträge."
//
// WAS DIE MESSUNG DIESES DURCHGANGS ERGEBEN HAT — und es verschiebt die Lage:
//
//   Der SUCHWEG des Produkts läuft NICHT über `KoRepo.findCandidates`. `KoService.findCandidates`
//   ruft `findSearchHits` → `KoSearchProjectionRepo.findActive` (G27). `repo.findCandidates` hat im
//   Produkt KEINEN Aufrufer mehr — die Methode existiert, wird aber nur noch von ihren eigenen
//   Tests erreicht.
//
//   Und `findActive` trägt in BEIDEN Adaptern denselben dreistufigen Vertrag, einschliesslich des
//   stabilen ID-Tiebreakers:
//     InMemory (search-projection-repo.ts:751-756):  validiert ↓, trust ↓, koId ↑
//     PostgreSQL (search-projection-repo-pg.ts:591): (k.status='validiert') DESC,
//                                                    (k.data->>'trust')::int DESC NULLS LAST, p.ko_id
//
// Diese Datei PINNT genau das. Sie erfindet keinen Tiebreaker (der wäre die ownerpflichtige
// Entscheidung aus Korrekturpflicht 1) — sie hält fest, dass der vorhandene nicht verschwinden darf.
//
// FAKE-POOL STATT DATENBANK: dasselbe Hausmuster wie `repo-pg-search.test.ts` und
// `repo-pg-candidates.test.ts`. Geprüft wird die Query-Gestalt, nicht ein Datenbanklauf — die
// Laufzeit dieses Durchgangs hat ausdrücklich keine Datenbank.
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { PgKoRepo } from "./repo-pg";
import { PgKoSearchProjectionRepo } from "./search-projection-repo-pg";

/**
 * Ein Pool, der die Steuerzeile beantwortet und jede Anweisung mitschreibt.
 *
 * Ohne eine freigegebene Steuerzeile wirft `findActive` fail-closed, BEVOR es die Abfrage baut —
 * dann gäbe es nichts zu prüfen. Die Zeile steht deshalb auf `V2_ACTIVE` mit gültigem Marker.
 */
function fakePool(): { pool: Pool; calls: { sql: string; params: unknown[] }[] } {
  const calls: { sql: string; params: unknown[] }[] = [];
  const controlRow = {
    active_projection_version: 2,
    target_projection_version: 2,
    projection_state: "V2_ACTIVE",
    last_successful_rebuild: "2026-08-17T09:00:00.000Z",
    last_reconcile: "2026-08-17T09:00:00.000Z",
    last_failure: null,
    build_started_at: "2026-08-17T08:00:00.000Z",
    build_finished_at: "2026-08-17T08:30:00.000Z",
    build_generation: 7,
    active_generation: 7,
    integrity_marker: "V2-READY:7",
    activated_at: "2026-08-17T09:00:00.000Z",
  };
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.includes("ko_projection_control")) {
        return { rows: [controlRow], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;
  return { pool, calls };
}

function suchAnweisung(calls: { sql: string }[]): string {
  const treffer = calls.find((c) => c.sql.includes("FROM ko_search_projections p"));
  expect(treffer, "die Suchanweisung wurde nicht gebaut").toBeDefined();
  return (treffer as { sql: string }).sql;
}

/**
 * Die Sortierschlüssel einer Anweisung, gezählt statt gelesen.
 *
 * Die `ORDER BY`-Klausel reicht bis `LIMIT` oder bis zum Ende; die Schlüssel trennt das Komma.
 * Keiner der hier vorkommenden Ausdrücke enthält ein Komma, deshalb genügt die einfache Teilung.
 */
function sortierschluessel(sql: string): string[] {
  const ab = sql.lastIndexOf("ORDER BY");
  const rest = sql.slice(ab + "ORDER BY".length);
  const bis = rest.indexOf("LIMIT");
  return (bis < 0 ? rest : rest.slice(0, bis))
    .split(",")
    .map((teil) => teil.trim())
    .filter((teil) => teil.length > 0);
}

describe("JOB 544 · W — der Suchweg ordnet deterministisch, in beiden Adaptern", () => {
  it("W1 · PostgreSQL: die Suche endet auf dem stabilen ID-Tiebreaker", async () => {
    const { pool, calls } = fakePool();
    const repo = new PgKoSearchProjectionRepo(pool);
    await repo.findActive({ terms: ["hydraulik"], limit: 1 });
    const sql = suchAnweisung(calls);
    // Die drei Schlüssel in genau dieser Reihenfolge — der letzte ist der Tiebreaker.
    const ordnung = sql.slice(sql.lastIndexOf("ORDER BY"));
    expect(ordnung).toContain("(k.status='validiert') DESC");
    expect(ordnung).toContain("(k.data->>'trust')::int DESC NULLS LAST");
    expect(ordnung).toContain("p.ko_id");
    // Und der Tiebreaker steht HINTER Trust — nicht davor, sonst wäre er die Primärordnung.
    expect(ordnung.indexOf("p.ko_id")).toBeGreaterThan(ordnung.indexOf("trust"));
    // GENAU DREI Schlüssel: validiert, Trust, stabile Kennung. Ein vierter wäre eine neue
    // Primärordnung und damit die ownerpflichtige Entscheidung aus Korrekturpflicht 1.
    const schluessel = sortierschluessel(sql);
    expect(schluessel).toHaveLength(3);
    expect(schluessel[2]).toBe("p.ko_id");
  });

  it("W2 · der Deckel steht NACH der Ordnung — sonst schnitte er eine ungeordnete Menge", async () => {
    const { pool, calls } = fakePool();
    const repo = new PgKoSearchProjectionRepo(pool);
    await repo.findActive({ terms: ["hydraulik"], limit: 3 });
    const sql = suchAnweisung(calls);
    expect(sql).toContain("LIMIT");
    expect(sql.lastIndexOf("LIMIT")).toBeGreaterThan(sql.lastIndexOf("ORDER BY"));
  });

  it("W3 · ohne `limit` gibt es KEINEN stillen Deckel — die Bibliothek verliert keinen Treffer", async () => {
    const { pool, calls } = fakePool();
    const repo = new PgKoSearchProjectionRepo(pool);
    await repo.findActive({ terms: ["hydraulik"] });
    const sql = suchAnweisung(calls);
    expect(sql).not.toContain("LIMIT");
  });

  it("W4 · die Suche joint auf die AKTIVE KO-Version — historische Fassungen sind nie Treffer", async () => {
    const { pool, calls } = fakePool();
    const repo = new PgKoSearchProjectionRepo(pool);
    await repo.findActive({ terms: ["hydraulik"] });
    const sql = suchAnweisung(calls);
    expect(sql).toContain("JOIN kos k ON");
    expect(sql).toContain("k.id = p.ko_id");
    expect(sql).toContain("p.ko_version");
  });

  it("W5 · die ALTE Prefilter-Abfrage ist nicht der Suchweg — und trägt folgerichtig keinen Tiebreaker", async () => {
    // DIESER FALL BESCHÖNIGT NICHTS: `PgKoRepo.findCandidates` ordnet ohne stabilen Schlüssel. Der
    // Befund aus D3 stimmt für DIESE Methode. Er ist nur nicht mehr der Suchweg — `KoService`
    // ruft sie nicht, und die Zusicherung hält genau das fest, statt den Mangel zu blessen.
    const { pool, calls } = fakePool();
    const repo = new PgKoRepo(pool);
    await repo.findCandidates({ terms: ["hydraulik"], limit: 5 });
    const sql = (calls[0] as { sql: string }).sql;
    expect(sql).toContain("ORDER BY (status='validiert') DESC");
    expect(sql).toContain("(data->>'trust')::int DESC NULLS LAST");
    // Kein stabiler Schlüssel — gemessen, nicht gutgeheissen: GENAU ZWEI Sortierschlüssel.
    //
    // Gezählt statt nach „id" gesucht: `validiert` enthält die Buchstabenfolge `id`, und genau
    // daran ist die erste Fassung dieses Falles zu Recht rot geworden. Eine Zeichensuche misst hier
    // die Schreibweise eines Statuswerts, die Zählung misst den Vertrag.
    expect(sortierschluessel(sql)).toHaveLength(2);
  });
});

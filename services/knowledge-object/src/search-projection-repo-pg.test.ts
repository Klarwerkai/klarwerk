import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { SEARCH_PROJECTION_VERSION, buildSearchProjection } from "./search-projection";
import { integritaetsMarkerFuer } from "./search-projection-repo";
import {
  KO_PROJECTION_CONTROL_SCHEMA,
  KO_SEARCH_PROJECTION_SCHEMA,
  PgKoSearchProjectionRepo,
} from "./search-projection-repo-pg";
import type { KnowledgeObject } from "./types";

// G27: Query-Shape-Test des Postgres-Adapters — Fake-Pool zeichnet SQL + Parameter auf und liefert
// kontrollierte Zeilen. Dasselbe Muster wie repo-pg-candidates.test.ts (SCRUM-361): kein echtes
// Postgres nötig, aber die Zusagen des Adapters sind gemessen und nicht behauptet.
//
// WAS DIESER TEST NICHT ERSETZT, ausdrücklich: einen echten Pg-Lauf (Planner, Index-Nutzung,
// Verhalten des Primärschlüssels unter Nebenläufigkeit). Der gehört in den Testcontainers-Lauf
// (`npm run test:integration`) und ist als Restaufwand im Bericht benannt.
// G27 R1: der Fake-Pool muss jetzt ZWEI Fragen beantworten. `findActive` liest zuerst den
// Control-State — die einzige autoritative Auskunft darüber, welche Projektionsfassung freigegeben
// ist — und stellt danach erst die Suchabfrage. Ohne eine Antwort auf die Steuerzeile wäre der
// Adapter fail-closed und käme gar nicht bis zum Statement; genau das ist die neue Zusage.
// G27 R1 / Entscheidung 09 §3: freigegeben ist eine Fassung erst mit GENERATION und GÜLTIGEM
// MARKER. Die Steuerzeile trägt beides — und der Marker nennt genau die Generation, die aktiv ist.
// Stünde hier eine andere Zahl im Marker, wäre die Instanz nach Prüfung 4 nicht suchbereit; das ist
// keine Formalie, sondern die Stelle, an der eine nachträgliche Beschädigung sichtbar wird.
const AKTIVE_GENERATION = 7;
const FREIGEGEBEN_V2 = {
  active_projection_version: 2,
  target_projection_version: 2,
  projection_state: "V2_ACTIVE",
  last_successful_rebuild: "2026-08-01T00:00:00.000Z",
  last_reconcile: "2026-08-01T00:00:00.000Z",
  last_failure: null,
  build_started_at: "2026-08-01T00:00:00.000Z",
  build_finished_at: "2026-08-01T00:00:00.000Z",
  build_generation: AKTIVE_GENERATION,
  active_generation: AKTIVE_GENERATION,
  integrity_marker: integritaetsMarkerFuer(AKTIVE_GENERATION),
  activated_at: "2026-08-01T00:00:00.000Z",
};

function fakePool(
  rows: Record<string, unknown>[] = [],
  control: Record<string, unknown> | null = FREIGEGEBEN_V2,
  // Ob der BEDINGTE Zustandswechsel greift — das ist die Antwort der Datenbank auf
  // `WHERE ... AND projection_state = $10`, nicht eine Entscheidung des Anwendungscodes.
  casGreift = true,
) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes("ko_projection_control")) {
      if (/^\s*UPDATE/i.test(sql)) {
        return { rows: [], rowCount: casGreift ? 1 : 0 };
      }
      const steuer = control ? [control] : [];
      return { rows: steuer, rowCount: steuer.length };
    }
    return { rows, rowCount: rows.length };
  };
  const pool = {
    query,
    // G27 R1 / Entscheidung 09 §2: Schreibvorgänge und Freigabe laufen in einer Transaktion mit
    // gesperrter Steuerzeile und brauchen dafür eine ANGEHEFTETE Verbindung. `pool.query()` gibt
    // je Anweisung eine beliebige Verbindung — eine Transaktion darüber wäre keine. Der
    // Doppelgänger reicht deshalb denselben aufzeichnenden Ausführer durch.
    connect: async () => ({ query, release: () => undefined }),
  } as unknown as Pool;
  return { pool, calls };
}

// G27 R1 / Entscheidung 09 §2: Schreibvorgänge stehen jetzt in einer Transaktionsklammer —
// `BEGIN`, der Sperr-SELECT auf die Steuerzeile, die eigentliche Anweisung, `COMMIT`. Gesucht wird
// deshalb die ANWEISUNG und nicht mehr `calls[0]`; die Klammer selbst ist in ihren eigenen
// Zusicherungen belegt (s. „die Transaktionsklammer").
function anweisung(calls: { sql: string; params: unknown[] }[], teil: string) {
  return calls.find((c) => c.sql.includes(teil)) as { sql: string; params: unknown[] };
}

// Die Abfragen OHNE den vorangestellten Control-State-Lesevorgang — die Zusagen der Suche selbst.
function suchAbfragen(calls: { sql: string; params: unknown[] }[]) {
  return calls.filter((c) => !c.sql.includes("ko_projection_control"));
}

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "k1",
    title: "Ventil warten",
    statement: "Quartalsweise prüfen.",
    category: "Wartung",
    tags: [],
    version: 1,
    ...overrides,
  } as unknown as KnowledgeObject;
}

const AT = "2026-08-01T10:00:00.000Z";

// Der Zustandssatz, den `compareAndSetControlState` schreiben soll — vollständig, weil der Vertrag
// vollständig ist. Ein Teilsatz würde Generation und Marker still auf `undefined` setzen.
const NAECHSTER_V2_ACTIVE = {
  activeProjectionVersion: 2,
  targetProjectionVersion: 2,
  projectionState: "V2_ACTIVE" as const,
  lastSuccessfulRebuild: AT,
  lastReconcile: AT,
  lastFailure: null,
  buildStartedAt: AT,
  buildFinishedAt: AT,
  buildGeneration: AKTIVE_GENERATION,
  activeGeneration: AKTIVE_GENERATION,
  integrityMarker: integritaetsMarkerFuer(AKTIVE_GENERATION),
  activatedAt: AT,
};

describe("G27: PgKoSearchProjectionRepo — Schreibwege", () => {
  it("insert ist append-only (ON CONFLICT DO NOTHING) und vollständig parametrisiert", async () => {
    const { pool, calls } = fakePool([{ ko_id: "k1" }]);
    const repo = new PgKoSearchProjectionRepo(pool);
    const projektion = buildSearchProjection(ko(), AT);

    expect(await repo.insert(projektion)).toBe(true);
    const { sql, params } = anweisung(calls, "INSERT INTO ko_search_projections(");
    expect(sql).toContain("ON CONFLICT (ko_id, ko_version) DO NOTHING");
    expect(sql).not.toContain("DO UPDATE");
    // 17 Spalten = 17 Platzhalter, keine eingebetteten Werte (Fassung 2: + body_text,
    // + classification_snapshot; G27 R1: + generation; die beiden Legacy-Spalten bleiben physisch
    // bestehen und werden ausdrücklich leer geschrieben).
    expect(params).toHaveLength(17);
    expect(params[0]).toBe("k1");
    expect(params[1]).toBe(1);
    expect(sql).toContain("$17");
  });

  it("die Legacy-Spalten category_text/tag_text werden ausdrücklich LEER geschrieben", async () => {
    const { pool, calls } = fakePool([{ ko_id: "k1" }]);
    const repo = new PgKoSearchProjectionRepo(pool);
    await repo.insert(buildSearchProjection(ko({ category: "Wartung", tags: ["hydraulik"] }), AT));
    const { sql, params } = anweisung(calls, "INSERT INTO ko_search_projections(");
    const spalten = (sql.match(/ko_search_projections\(([^)]+)\)/)?.[1] ?? "").split(",");
    // Sie stehen weiter in der Tabelle (keine destruktive Migration) …
    expect(spalten).toContain("category_text");
    expect(spalten).toContain("tag_text");
    // … sind aber keine fachliche Quelle mehr: der geschriebene Wert ist der Leerwert, obwohl das
    // Objekt sehr wohl Kategorie und Schlagwort trägt. Diese wandern in die Metadatenprojektion.
    expect(params[spalten.indexOf("category_text")]).toBe("");
    expect(params[spalten.indexOf("tag_text")]).toBe("");
    expect(params).not.toContain("Wartung");
    expect(params).not.toContain("hydraulik");
  });

  it("replace ist der EINZIGE überschreibende Weg — und lässt created_at unangetastet", async () => {
    const { pool, calls } = fakePool();
    const repo = new PgKoSearchProjectionRepo(pool);
    await repo.replace(buildSearchProjection(ko(), AT));
    const { sql } = anweisung(calls, "INSERT INTO ko_search_projections(");
    expect(sql).toContain("ON CONFLICT (ko_id, ko_version) DO UPDATE SET");
    expect(sql).toContain("updated_at = EXCLUDED.updated_at");
    expect(sql).not.toContain("created_at = EXCLUDED.created_at");
  });

  it("removeByKo löscht GENAU ein Objekt, nicht mehr", async () => {
    const { pool, calls } = fakePool();
    const repo = new PgKoSearchProjectionRepo(pool);
    await repo.removeByKo("k1");
    expect(calls[0]?.sql).toBe("DELETE FROM ko_search_projections WHERE ko_id=$1");
    expect(calls[0]?.params).toEqual(["k1"]);
  });
});

describe("G27: PgKoSearchProjectionRepo — die Standardsuche", () => {
  it("joint auf die AKTIVE KO-Version, schließt Getrashtes aus und ist parametrisiert", async () => {
    const { pool, calls } = fakePool([
      {
        ko_id: "k1",
        ko_version: 3,
        projection_version: 1,
        content_hash: "abc",
        status: "vollstaendig",
        language: "und",
        m_title_text: false,
        m_statement_text: false,
        m_category_text: false,
        m_tag_text: false,
        m_caption_text: false,
      },
    ]);
    const repo = new PgKoSearchProjectionRepo(pool);
    const hits = await repo.findActive({ terms: ["ventil", "presse"], limit: 200 });

    // Der Control-State wird ZUERST gelesen — vor jeder Suchabfrage.
    expect(calls[0]?.sql).toContain("FROM ko_projection_control");
    const { sql, params } = suchAbfragen(calls)[0] as { sql: string; params: unknown[] };
    expect(sql).toContain("FROM ko_search_projections p");
    // Der aktive Datensatz: die Projektionszeile MUSS die aktuelle Version des Objekts tragen …
    expect(sql).toContain("COALESCE((k.data->>'version')::int, 1) = p.ko_version");
    expect(sql).toContain("NOT (k.data ? 'deletedAt')");
    // … UND die freigegebene Projektionsfassung (G27 R1). PARAMETRISIERT, nicht interpoliert: der
    // Wert stammt aus dem Control-State und darf nie als Literal im Statement stehen.
    expect(sql).toContain("p.projection_version = $1");
    expect(sql).not.toContain("p.projection_version = 2");
    // … UND die AKTIVE GENERATION (G27 R1, Entscheidung 09 §3). Ebenfalls parametrisiert und
    // ebenfalls aus dem Control-State: die Abfrage liest genau `projection_version = 2 AND
    // generation = active_generation` und sonst nichts. Eine Zeile, die seit der Freigabe
    // ausserhalb dieser Generation entstanden ist, ist damit gar nicht erst Kandidat.
    expect(sql).toContain("p.generation = $2");
    expect(sql).not.toContain(`p.generation = ${AKTIVE_GENERATION}`);
    expect(sql).toContain("p.search_text ILIKE");
    expect(sql).toContain("ORDER BY (k.status='validiert') DESC");
    // JOB 1531 D3 (S2): `$5` → `$6` und ein Term mehr. GRUND: Seit D2 ruft dieser Adapter
    // `expandSearchTerms` auf (`search-projection-repo-pg.ts:534`); die deklarierte Zuordnung
    // ergänzt zu „ventil" das Wort „klep" (`search-projection.ts:928`). Der Deckel rückt dadurch
    // um einen Platzhalter weiter. **Die Zusage dieses Falls ist unberührt** — geprüft bleibt,
    // dass das LIMIT parametrisiert ist und nicht als Literal im Statement steht.
    expect(sql).toContain("LIMIT $6");
    expect(params).toEqual([2, AKTIVE_GENERATION, "%ventil%", "%presse%", "%klep%", 200]);

    // Ein Treffer, der in KEINEM Kurzfeld steht, wird als Dokumenttext-Fund gemeldet.
    expect(hits[0]?.matched).toEqual({
      title: false,
      statement: false,
      category: false,
      tag: false,
      caption: false,
      body: true,
    });
  });

  it("ohne limit entfällt die LIMIT-Klausel (die Bibliothek verliert keinen Treffer still)", async () => {
    const { pool, calls } = fakePool();
    const repo = new PgKoSearchProjectionRepo(pool);
    await repo.findActive({ terms: ["ventil"] });
    const { sql, params } = suchAbfragen(calls)[0] as { sql: string; params: unknown[] };
    expect(sql).not.toContain("LIMIT");
    // JOB 1531 D3 (S2): ein Term mehr. GRUND: derselbe Aufruf wie oben — „ventil" bringt seit der
    // Zuordnung „klep" mit. **Die Zusage dieses Falls ist unberührt**: ohne `limit` entfällt die
    // LIMIT-Klausel weiterhin, und genau das prüft die Zeile darüber.
    expect(params).toEqual([2, AKTIVE_GENERATION, "%ventil%", "%klep%"]);
  });

  it("leere Terme → keine Suchabfrage (kein All-Pool-Scan)", async () => {
    const { pool, calls } = fakePool();
    const repo = new PgKoSearchProjectionRepo(pool);
    expect(await repo.findActive({ terms: [], limit: 10 })).toEqual([]);
    expect(await repo.findActive({ terms: ["", "  "], limit: 10 })).toEqual([]);
    // Die Zusage ist unverändert: kein Scan über die Projektionstabelle. Was hinzukommt, ist der
    // Blick auf die Steuerzeile — und der steht BEWUSST VOR der Leermengenentscheidung (04 §4):
    // sonst könnte eine nicht suchbereite Instanz bei leerer Anfrage ein ehrliches „nichts
    // gefunden" melden und damit über ihre Verfügbarkeit lügen.
    expect(suchAbfragen(calls)).toHaveLength(0);
    expect(calls.every((c) => c.sql.includes("ko_projection_control"))).toBe(true);
  });

  it("ohne freigegebene Fassung WIRFT die Suche — weder [] noch eine Teilmenge", async () => {
    // Genau der Vorzustand einer frischen Instanz: die Steuerzeile steht auf `UNINITIALIZED`.
    const { pool, calls } = fakePool([], {
      ...FREIGEGEBEN_V2,
      active_projection_version: null,
      target_projection_version: null,
      projection_state: "UNINITIALIZED",
    });
    const repo = new PgKoSearchProjectionRepo(pool);
    await expect(repo.findActive({ terms: ["ventil"] })).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
    expect(suchAbfragen(calls)).toHaveLength(0);
  });

  it("fehlt die Steuerzeile ganz, ist die Antwort fail-closed — nicht eine erfundene Freigabe", async () => {
    const { pool } = fakePool([], null);
    const repo = new PgKoSearchProjectionRepo(pool);
    expect(await repo.controlState()).toMatchObject({
      projectionState: "UNINITIALIZED",
      activeProjectionVersion: null,
    });
  });

  it("die Kategorie-/Schlagwortsuche läuft über die Metadatenprojektion — NIE über operative Felder", async () => {
    const { pool, calls } = fakePool();
    const repo = new PgKoSearchProjectionRepo(pool);
    await repo.findActive({ terms: ["wartung"] });
    const { sql } = suchAbfragen(calls)[0] as { sql: string };
    // Die zweite Hälfte des Effective Search Document — als LEFT JOIN, damit ein Objekt ohne
    // (noch nicht nachgezogene) Metadatenzeile über seinen Inhalt weiterhin auffindbar bleibt.
    expect(sql).toContain("LEFT JOIN ko_metadata_projections md ON md.ko_id = p.ko_id");
    expect(sql).toContain("COALESCE(md.category_text, '') ILIKE");
    expect(sql).toContain("COALESCE(md.tag_text, '') ILIKE");
    // VERBOTEN (Stop-Kriterium): kein Zumischen aus operativen KO-Tabellen, und die Legacy-Spalten
    // der Inhaltsprojektion sind keine Quelle mehr.
    expect(sql).not.toContain("k.data->>'category'");
    expect(sql).not.toContain("k.data->>'tags'");
    expect(sql).not.toContain("p.category_text");
    expect(sql).not.toContain("p.tag_text");
  });

  it("missingActive findet Objekte OHNE vollständiges Suchdokument (fehlend, veraltet, ohne Metadaten)", async () => {
    const { pool, calls } = fakePool([{ id: "alt-1" }]);
    const repo = new PgKoSearchProjectionRepo(pool);
    expect(await repo.missingActive(20)).toEqual(["alt-1"]);
    const { sql, params } = calls[0] as { sql: string; params: unknown[] };
    expect(sql).toContain("LEFT JOIN ko_search_projections p");
    expect(sql).toContain("LEFT JOIN ko_metadata_projections md ON md.ko_id = k.id");
    expect(sql).toContain("p.ko_id IS NULL");
    // Der V1/V2-Mischbestand ist Teil DERSELBEN Arbeitsliste — sonst bräuchte es einen zweiten
    // Lauf, der dieselben Objekte ein zweites Mal vollädt.
    expect(sql).toContain("p.projection_version <> $2");
    expect(sql).toContain("md.ko_id IS NULL");
    expect(sql).toContain("NOT (k.data ? 'deletedAt')");
    expect(params).toEqual([20, SEARCH_PROJECTION_VERSION]);
  });
});

describe("G27: KO_SEARCH_PROJECTION_SCHEMA — additiv und begründet", () => {
  it("legt die Tabelle mit dem geforderten Primärschlüssel an (idempotent)", () => {
    expect(KO_SEARCH_PROJECTION_SCHEMA).toContain(
      "CREATE TABLE IF NOT EXISTS ko_search_projections",
    );
    expect(KO_SEARCH_PROJECTION_SCHEMA).toContain("PRIMARY KEY (ko_id, ko_version)");
  });

  it("trägt alle kanonischen Spalten der Architekturentscheidung (Fassung 2)", () => {
    for (const spalte of [
      "ko_id",
      "ko_version",
      "projection_version",
      "search_text",
      "title_text",
      "statement_text",
      "caption_text",
      "body_text",
      "language",
      "content_hash",
      "status",
      "classification_snapshot",
      "created_at",
      "updated_at",
    ]) {
      expect(KO_SEARCH_PROJECTION_SCHEMA).toContain(spalte);
    }
  });

  it("behält die Legacy-Spalten physisch — mit Default, damit keine destruktive Migration nötig ist", () => {
    expect(KO_SEARCH_PROJECTION_SCHEMA).toContain("category_text text NOT NULL DEFAULT ''");
    expect(KO_SEARCH_PROJECTION_SCHEMA).toContain("tag_text text NOT NULL DEFAULT ''");
  });

  it("legt genau die vier begründeten Indizes an — jeder trägt eine benannte Abfrage", () => {
    expect(KO_SEARCH_PROJECTION_SCHEMA).toContain("USING gin (search_text gin_trgm_ops)");
    expect(KO_SEARCH_PROJECTION_SCHEMA).toContain("ko_search_projections(content_hash)");
    // Fassung 2: die Arbeitsliste des V1/V2-Mischbestands darf kein Voll-Scan sein.
    expect(KO_SEARCH_PROJECTION_SCHEMA).toContain("ko_search_projections(projection_version)");
    // G27 R1 / Entscheidung 09 §3: die Suche liest jetzt Fassung UND Generation. Ohne diesen
    // zusammengesetzten Index wäre die Generationsbedingung ein Nachfilter auf der Fassungsmenge —
    // und die Zusage „kein Vollscan pro Anfrage" stünde nur im Kommentar.
    expect(KO_SEARCH_PROJECTION_SCHEMA).toContain(
      "ko_search_projections(projection_version, generation)",
    );
    const indizes = KO_SEARCH_PROJECTION_SCHEMA.match(/CREATE INDEX/gi) ?? [];
    expect(indizes).toHaveLength(4);
  });

  it("ist nicht destruktiv und ausschließlich idempotent", () => {
    expect(KO_SEARCH_PROJECTION_SCHEMA).not.toMatch(/\bDROP\b/i);
    expect(KO_SEARCH_PROJECTION_SCHEMA).not.toMatch(/\bTRUNCATE\b/i);
    expect(KO_SEARCH_PROJECTION_SCHEMA).not.toMatch(/\bDELETE\b/i);
    const creates = KO_SEARCH_PROJECTION_SCHEMA.match(/CREATE (TABLE|INDEX)/gi) ?? [];
    const idempotent =
      KO_SEARCH_PROJECTION_SCHEMA.match(/CREATE (TABLE|INDEX) IF NOT EXISTS/gi) ?? [];
    expect(creates.length).toBeGreaterThan(0);
    expect(idempotent.length).toBe(creates.length);
  });

  // ----------------------------------------------------------------------------------------------
  // DIE V1→V2-STUFE (Detailentscheidung J)
  // ----------------------------------------------------------------------------------------------
  //
  // Der frühere Pin „kein ALTER" war die falsche Regel: er verbot genau die Anweisung, die eine
  // BESTEHENDE V1-Tabelle überhaupt erst V2-fähig macht, und ließ dafür die Annahme stehen, V1
  // existiere nirgends. Die Regel heißt jetzt präzise: ALTER ausschließlich als ADD COLUMN IF NOT
  // EXISTS — nie DROP COLUMN, nie ALTER COLUMN, nie RENAME.
  it("rüstet die gegenüber Fassung 1 NEUEN Spalten additiv nach — ADD COLUMN IF NOT EXISTS", () => {
    // `generation` ist die dritte Nachrüstung (G27 R1, Entscheidung 09 §2) — nullable und ohne
    // Default, damit eine Bestandszeile ehrlich „gehört zu keinem freigegebenen Zyklus" sagt.
    for (const spalte of ["body_text", "classification_snapshot", "generation"]) {
      expect(KO_SEARCH_PROJECTION_SCHEMA).toMatch(
        new RegExp(`ADD COLUMN IF NOT EXISTS\\s+${spalte}\\s`, "i"),
      );
    }
    // Genau diese drei — und keine weitere Spalte, die es in Fassung 1 schon gab.
    const adds = KO_SEARCH_PROJECTION_SCHEMA.match(/ADD COLUMN IF NOT EXISTS/gi) ?? [];
    expect(adds).toHaveLength(3);
  });

  it("jedes ALTER ist additiv: nur ADD COLUMN IF NOT EXISTS, kein DROP/ALTER/RENAME COLUMN", () => {
    const alters = KO_SEARCH_PROJECTION_SCHEMA.match(/\bALTER TABLE\b[\s\S]*?;/gi) ?? [];
    expect(alters.length).toBeGreaterThan(0);
    for (const stufe of alters) {
      expect(stufe).toMatch(/ADD COLUMN IF NOT EXISTS/i);
      expect(stufe).not.toMatch(/DROP COLUMN|ALTER COLUMN|RENAME/i);
    }
  });

  it("die Nachrüstung steht VOR den Indizes und VOR jedem Schreibweg (Reihenfolge im einen Block)", () => {
    const create = KO_SEARCH_PROJECTION_SCHEMA.indexOf("CREATE TABLE IF NOT EXISTS");
    const alter = KO_SEARCH_PROJECTION_SCHEMA.search(/\bALTER TABLE\b/i);
    const index = KO_SEARCH_PROJECTION_SCHEMA.indexOf("CREATE INDEX IF NOT EXISTS");
    expect(create).toBeGreaterThanOrEqual(0);
    expect(alter).toBeGreaterThan(create);
    expect(index).toBeGreaterThan(alter);
  });

  it("die nachgerüsteten Defaults behaupten KEINE historische Sicherheit", () => {
    // Der Leerwert ist die ehrliche Aussage „hier steht nichts" — `parseClassificationSnapshot("")`
    // macht daraus fail-safe `none`/`unknown`. Ein Default wie `intern` oder `verified` wäre eine
    // erfundene Vergangenheit (No-Go, Abschnitt J).
    const alters = KO_SEARCH_PROJECTION_SCHEMA.match(/\bALTER TABLE\b[\s\S]*?;/gi) ?? [];
    const snapshotStufe = alters.find((s) => s.includes("classification_snapshot"));
    expect(snapshotStufe).toMatch(/DEFAULT\s+''/);
    expect(snapshotStufe).not.toMatch(/verified|intern|vertraulich|public/i);
    // Und die Stufe rührt die Fassungsnummer nicht an: eine Bestandszeile bleibt Fassung 1, bis der
    // ausdrücklich benannte Nachzug sie neu ableitet.
    expect(KO_SEARCH_PROJECTION_SCHEMA).not.toMatch(/UPDATE\s+ko_search_projections/i);
    expect(KO_SEARCH_PROJECTION_SCHEMA).not.toMatch(/projection_version\s*=/i);
  });

  it("keine Vektorsuche, keine Embeddings, kein neuer externer Dienst", () => {
    expect(KO_SEARCH_PROJECTION_SCHEMA).not.toMatch(/vector|embedding|pgvector/i);
  });
});

// ================================================================================================
// G27 R1 — DIE INSTANZWEITE STEUERTABELLE (Entscheidung 04 §1, §6; 05 §1)
// ================================================================================================

describe("G27 R1: KO_PROJECTION_CONTROL_SCHEMA — instanzweit, additiv, fail-closed", () => {
  it("legt GENAU EINE autoritative Zeile an — der Primärschlüssel erzwingt „instanzweit“", () => {
    expect(KO_PROJECTION_CONTROL_SCHEMA).toContain(
      "CREATE TABLE IF NOT EXISTS ko_projection_control",
    );
    expect(KO_PROJECTION_CONTROL_SCHEMA).toContain("key text PRIMARY KEY");
  });

  it("trägt die fünf Pflichtfelder und die drei optionalen aus §6 — und nichts darüber hinaus", () => {
    for (const spalte of [
      "active_projection_version",
      "target_projection_version",
      "projection_state",
      "last_successful_rebuild",
      "last_reconcile",
      "last_failure",
      "build_started_at",
      "build_finished_at",
    ]) {
      expect(KO_PROJECTION_CONTROL_SCHEMA).toContain(spalte);
    }
  });

  it("ist additiv, wiederholbar und nicht destruktiv — eine bestehende Steuerzeile bleibt stehen", () => {
    expect(KO_PROJECTION_CONTROL_SCHEMA).toContain("ON CONFLICT (key) DO NOTHING");
    expect(KO_PROJECTION_CONTROL_SCHEMA).not.toMatch(/\bDROP\b/i);
    expect(KO_PROJECTION_CONTROL_SCHEMA).not.toMatch(/\bTRUNCATE\b/i);
    expect(KO_PROJECTION_CONTROL_SCHEMA).not.toMatch(/\bDELETE\b/i);
    expect(KO_PROJECTION_CONTROL_SCHEMA).not.toMatch(/DO UPDATE/i);
  });

  it("der Seed ist UNINITIALIZED und leitet NICHTS aus dem Bestand ab (05 §1)", () => {
    expect(KO_PROJECTION_CONTROL_SCHEMA).toMatch(/VALUES \('singleton', 'UNINITIALIZED'\)/);
    // Kein Blick auf die Projektionszeilen: weder „Tabelle leer ⇒ aktiv“ noch „V1 vorhanden ⇒ V1“.
    expect(KO_PROJECTION_CONTROL_SCHEMA).not.toMatch(/ko_search_projections/);
    expect(KO_PROJECTION_CONTROL_SCHEMA).not.toMatch(/\bSELECT\b/i);
    expect(KO_PROJECTION_CONTROL_SCHEMA).not.toMatch(/V2_ACTIVE|V1_ACTIVE/);
  });
});

describe("G27 R1: PgKoSearchProjectionRepo — der Control-State", () => {
  it("die Freigabe ist EIN bedingtes Statement — die Datenbank entscheidet, nicht der Code", async () => {
    const { pool, calls } = fakePool([{ key: "singleton" }]);
    const repo = new PgKoSearchProjectionRepo(pool);
    const geschrieben = await repo.compareAndSetControlState("V2_READY", NAECHSTER_V2_ACTIVE);
    expect(geschrieben).toBe(true);
    // GENAU EINE Anweisung — kein Lesen-dann-Schreiben, also kein Fenster für einen zweiten
    // Freigeber und keinen beobachtbaren Zwischenzustand.
    expect(calls).toHaveLength(1);
    const { sql, params } = calls[0] as { sql: string; params: unknown[] };
    expect(sql).toContain("UPDATE ko_projection_control SET");
    // $13/$14 seit Entscheidung 09: die Werteliste trägt jetzt zusätzlich Generation, aktive
    // Generation, Marker und Aktivierungszeitpunkt — die Bedingung bleibt dieselbe eine Bedingung.
    expect(sql).toContain("WHERE key=$13 AND projection_state=$14");
    // Der ERWARTETE Vorzustand steht in der Bedingung — nicht in einer vorherigen Prüfung.
    expect(params[13]).toBe("V2_READY");
    expect(params[2]).toBe("V2_ACTIVE");
    expect(params[0]).toBe(2);
  });

  it("greift die Bedingung nicht, meldet der Adapter ehrlich `false` statt zu schreiben", async () => {
    // rowCount 0 = kein Zeile traf die Bedingung, der Vorzustand passte also nicht.
    const { pool } = fakePool([], FREIGEGEBEN_V2, false);
    const repo = new PgKoSearchProjectionRepo(pool);
    expect(await repo.compareAndSetControlState("V2_READY", NAECHSTER_V2_ACTIVE)).toBe(false);
  });

  it("das Gate-Audit zählt nur AKTIVE Zeilen und transportiert keinen Inhalt", async () => {
    const { pool, calls } = fakePool([]);
    const repo = new PgKoSearchProjectionRepo(pool);
    await repo.activeProjectionAudit();
    const sql = calls.map((c) => c.sql).join("\n");
    expect(sql).toContain("COALESCE((k.data->>'version')::int, 1)");
    expect(sql).toContain("NOT (k.data ? 'deletedAt')");
    expect(sql).toContain("GROUP BY p.projection_version");
    // Zahlen, keine Texte: search_text/title_text/body_text verlassen die Datenbank hier nie.
    expect(sql).not.toContain("search_text,");
    expect(sql).not.toContain("body_text");
  });
});

// ================================================================================================
// G27 R1 · Entscheidung 09 — GENERATION, SPERRE UND MARKER IM ADAPTER (Repository-PG-Ebene)
// ================================================================================================
//
// Diese Beschreibung misst, was der PostgreSQL-Adapter WIRKLICH an die Datenbank schickt. Sie
// ersetzt keinen echten Lauf (der steht im Testcontainers-Tor), aber sie nagelt die vier Zusagen
// fest, die man einem Bericht sonst glauben müsste: dass gesperrt wird, dass in EINER Transaktion
// geschrieben wird, dass die Generation aus dem Control-State kommt und dass der Marker fällt.

describe("G27 R1 · der Adapter sperrt, stempelt und invalidiert", () => {
  it("die Freigabe hält eine EXKLUSIVE Sperre auf der Steuerzeile — FOR UPDATE, eine Transaktion", async () => {
    const { pool, calls } = fakePool([], FREIGEGEBEN_V2);
    const repo = new PgKoSearchProjectionRepo(pool);
    const gesehen = await repo.withExclusiveControlLock(async (sitzung) => {
      await sitzung.schreibe({ ...NAECHSTER_V2_ACTIVE, projectionState: "FAILED" });
      return sitzung.control.buildGeneration;
    });
    const folge = calls.map((c) => c.sql.trim().split("\n")[0]?.trim());
    expect(folge[0]).toBe("BEGIN");
    expect(calls[1]?.sql).toContain("FROM ko_projection_control WHERE key=$1 FOR UPDATE");
    expect(calls[2]?.sql).toContain("UPDATE ko_projection_control SET");
    expect(folge[folge.length - 1]).toBe("COMMIT");
    // Der Zustand, den die Sitzung sieht, ist der GESPERRTE — nicht ein zweiter, späterer Lesevorgang.
    expect(gesehen).toBe(AKTIVE_GENERATION);
  });

  it("eine Mutation nimmt die VERTRÄGLICHE Sperre — FOR SHARE, ebenfalls in einer Transaktion", async () => {
    const { pool, calls } = fakePool([{ ko_id: "k1" }], FREIGEGEBEN_V2);
    const repo = new PgKoSearchProjectionRepo(pool);
    await repo.insert(buildSearchProjection(ko(), AT));
    expect(calls[0]?.sql.trim()).toBe("BEGIN");
    expect(calls[1]?.sql).toContain("FOR SHARE");
    // FOR SHARE und nicht FOR UPDATE: zwei gleichzeitige Einpflegungen dürfen sich nicht
    // gegenseitig ausbremsen — aber KEINE von ihnen darf committen, während das Gate prüft.
    expect(calls[1]?.sql).not.toContain("FOR UPDATE");
    expect(calls[calls.length - 1]?.sql.trim()).toBe("COMMIT");
  });

  it("im Betrieb trägt die geschriebene Zeile die AKTIVE Generation — aus dem Control-State", async () => {
    const { pool, calls } = fakePool([{ ko_id: "k1" }], FREIGEGEBEN_V2);
    const repo = new PgKoSearchProjectionRepo(pool);
    await repo.insert(buildSearchProjection(ko(), AT));
    const { sql, params } = anweisung(calls, "INSERT INTO ko_search_projections(");
    const spalten = (sql.match(/ko_search_projections\(([^)]+)\)/)?.[1] ?? "").split(",");
    expect(params[spalten.indexOf("generation")]).toBe(AKTIVE_GENERATION);
    // KEINE Invalidierung: das ist der reguläre Produktivschreibweg (eine neue Wissenseinheit),
    // und er hält die Zusage ein, statt sie zu brechen.
    expect(calls.some((c) => c.sql.includes("integrity_marker=NULL"))).toBe(false);
  });

  it("im BAU trägt sie die Build-Generation — dieselbe Regel, anderer Zustand", async () => {
    const { pool, calls } = fakePool([{ ko_id: "k1" }], {
      ...FREIGEGEBEN_V2,
      projection_state: "V2_BUILDING",
      active_projection_version: null,
      active_generation: null,
      integrity_marker: null,
      build_generation: 12,
    });
    const repo = new PgKoSearchProjectionRepo(pool);
    await repo.replace(buildSearchProjection(ko(), AT));
    const { sql, params } = anweisung(calls, "INSERT INTO ko_search_projections(");
    const spalten = (sql.match(/ko_search_projections\(([^)]+)\)/)?.[1] ?? "").split(",");
    expect(params[spalten.indexOf("generation")]).toBe(12);
  });

  it("eine V1-RÜCKSCHREIBUNG im Betrieb fällt den Marker — in DERSELBEN Transaktion", async () => {
    const { pool, calls } = fakePool([{ ko_id: "k1" }], FREIGEGEBEN_V2);
    const repo = new PgKoSearchProjectionRepo(pool);
    // Genau BENs ROT-5-Eingriff: eine Zeile der Fassung 1 an einer aktiven Version, nachdem V2
    // freigegeben ist.
    await repo.replace({ ...buildSearchProjection(ko(), AT), projectionVersion: 1 });
    const { sql, params } = anweisung(calls, "INSERT INTO ko_search_projections(");
    const spalten = (sql.match(/ko_search_projections\(([^)]+)\)/)?.[1] ?? "").split(",");
    // Sie kann die aktive Generation nicht tragen …
    expect(params[spalten.indexOf("generation")]).toBeNull();
    // … und der Marker fällt, BEVOR die Transaktion committet. Getrennt geschrieben gäbe es einen
    // Moment, in dem die beschädigte Zeile schon steht und die Suche sie noch für geprüft hält.
    const invalidierung = calls.findIndex((c) => c.sql.includes("integrity_marker=NULL"));
    const commit = calls.findIndex((c) => c.sql.trim() === "COMMIT");
    expect(invalidierung).toBeGreaterThan(-1);
    expect(invalidierung).toBeLessThan(commit);
  });

  it("die Gate-Frage nach der Generation ist EIN Statement und liefert keinen Inhalt", async () => {
    const { pool, calls } = fakePool([]);
    const repo = new PgKoSearchProjectionRepo(pool);
    expect(await repo.activeRowsInGeneration(7)).toBe(true);
    const { sql, params } = calls[0] as { sql: string; params: unknown[] };
    // Fehlende Zeile UND fremde Fassung UND fremde Generation — dieselbe Bedingung, ein LEFT JOIN.
    expect(sql).toContain("p.ko_id IS NULL");
    expect(sql).toContain("p.projection_version <> $1");
    expect(sql).toContain("p.generation IS DISTINCT FROM $2");
    expect(sql).toContain("LIMIT 1");
    expect(params).toEqual([SEARCH_PROJECTION_VERSION, 7]);
    expect(sql).not.toContain("search_text");
  });

  it("ohne gültigen Marker beantwortet der Adapter GAR KEINE Suche — nicht `[]`", async () => {
    // Derselbe freigegebene Zustand, nur der Marker nennt eine ANDERE Generation. Genau so sieht
    // eine Instanz aus, an der nach der Freigabe etwas ausserhalb der Generation passiert ist.
    const { pool, calls } = fakePool([], {
      ...FREIGEGEBEN_V2,
      integrity_marker: integritaetsMarkerFuer(AKTIVE_GENERATION + 1),
    });
    const repo = new PgKoSearchProjectionRepo(pool);
    await expect(repo.findActive({ terms: ["ventil"] })).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
    // Und zwar VOR der Suchabfrage: es wird nicht erst gesucht und dann verworfen.
    expect(suchAbfragen(calls)).toHaveLength(0);
  });

  it("auch ein gefallener (leerer) Marker ist fail-closed", async () => {
    const { pool } = fakePool([], { ...FREIGEGEBEN_V2, integrity_marker: null });
    const repo = new PgKoSearchProjectionRepo(pool);
    await expect(repo.findActive({ terms: ["ventil"] })).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
  });
});

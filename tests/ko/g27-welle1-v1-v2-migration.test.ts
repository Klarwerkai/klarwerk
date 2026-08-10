// ================================================================================================
// G27 WELLE 1 — DIE ADDITIVE V1→V2-SCHEMAMIGRATION (Detailentscheidung J)
// ================================================================================================
//
// WAS HIER GEMESSEN WIRD UND WARUM ES DIESE DATEI BRAUCHT.
//
// Die Welle-1-Lieferung ging von einer Umgebung aus, in der die Projektionstabelle noch nicht
// existiert: `CREATE TABLE IF NOT EXISTS` legt sie in Fassung 2 an, fertig. Gegen eine Umgebung,
// die sie in FASSUNG 1 bereits trägt, ist genau dieselbe Anweisung ein No-op — die beiden neuen
// Spalten (`body_text`, `classification_snapshot`) fehlten dort weiter, und der erste V2-Insert
// bräche mit „column ... does not exist" ab. Abschnitt J nennt diese Annahme („V1 existiert
// nirgends") ausdrücklich ein No-Go und verlangt eine additive, wiederholbare Stufe.
//
// DIESE DATEI IST DAS SCHNELLE TOR: sie misst die Zusagen, die sich ohne Datenbank belegen lassen —
// die Vollständigkeit der Nachrüststufe gegenüber der Fassung 1, die Fail-safe-Lesart der
// nachgerüsteten Defaults und den ausdrücklich benannten Nachzugsweg von Fassung 1 auf Fassung 2.
//
// SIE ERSETZT DEN ECHTEN LAUF NICHT, und das steht hier, damit niemand sie dafür hält: ob eine
// bestehende V1-Tabelle tatsächlich migriert, ob der V2-Insert danach durchgeht und ob eine
// zweite Migration idempotent bleibt, entscheidet Postgres — nicht ein Textvergleich. Der Beleg
// dafür läuft gegen ein echtes Postgres in `services/app/src/db.migrate.integration.test.ts`
// („V1-Bestandstabelle → additive Migration → V2-Insert → deterministischer Nachzug").
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KO_SEARCH_PROJECTION_SCHEMA,
  type KnowledgeObject,
  type KoSearchProjection,
  KoService,
  PgKoSearchProjectionRepo,
  SEARCH_PROJECTION_VERSION,
  buildSearchProjection,
  parseClassificationSnapshot,
} from "../../services/knowledge-object";

// DIE SPALTEN DER FASSUNG 1 — Geschichte, deshalb wörtlich gepinnt und nicht ableitbar. Genau so
// sah die Tabelle vor dieser Welle aus: Kategorie und Schlagwörter noch im Inhalt, kein eigener
// Dokumenttext, keine historische Klassifizierungsreferenz.
const V1_SPALTEN = [
  "ko_id",
  "ko_version",
  "projection_version",
  "search_text",
  "title_text",
  "statement_text",
  "category_text",
  "tag_text",
  "caption_text",
  "language",
  "content_hash",
  "status",
  "created_at",
  "updated_at",
] as const;

// G27 R1 / Entscheidung 09 §2: der Adapter führt seine Schreibvorgänge seit der atomaren Freigabe
// in einer TRANSAKTION mit gesperrter Steuerzeile (`BEGIN` / `SELECT … FOR SHARE` / … / `COMMIT`).
// Dafür braucht er eine ANGEHEFTETE Verbindung — `pool.query()` gibt für jede Anweisung eine
// beliebige Verbindung aus dem Pool zurück, eine Transaktion darüber wäre keine. Der Doppelgänger
// bildet das ab: `connect()` liefert denselben aufzeichnenden Ausführer, `release()` ist ein No-op.
// Ohne diese drei Zeilen wäre der Doppelgänger kein `Pool` mehr, sondern nur noch ein `query`.
function fakePool(rows: Record<string, unknown>[] = []) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return { rows, rowCount: rows.length };
  };
  const pool = {
    query,
    connect: async () => ({ query, release: () => undefined }),
  } as unknown as Pool;
  return { pool, calls };
}

// Die Spalten, die der Adapter WIRKLICH schreibt — aus dem echten INSERT gelesen, nicht abgeschrieben.
// Gesucht wird ausdrücklich die INSERT-Anweisung und nicht `calls[0]`: seit der Transaktionsklammer
// stehen `BEGIN` und der Sperr-SELECT davor.
async function schreibSpalten(): Promise<string[]> {
  const { pool, calls } = fakePool();
  const repo = new PgKoSearchProjectionRepo(pool);
  await repo.insert(buildSearchProjection(ko(), AT));
  const sql = (
    calls.find((c) => c.sql.includes("INSERT INTO ko_search_projections")) as {
      sql: string;
    }
  ).sql;
  return (sql.match(/ko_search_projections\(([^)]+)\)/)?.[1] ?? "").split(",");
}

// Die Spalten, die die Nachrüststufe des Schemas ergänzt.
function nachgeruesteteSpalten(): string[] {
  return [...KO_SEARCH_PROJECTION_SCHEMA.matchAll(/ADD COLUMN IF NOT EXISTS\s+(\w+)/gi)].map(
    (treffer) => treffer[1] as string,
  );
}

const AT = "2026-08-02T09:00:00.000Z";
const KO_CREATED_AT = "2024-03-01T08:00:00.000Z";

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "alt-1",
    title: "Altbestand SPX9",
    statement: "Aussage.",
    bodyHtml: "<p>Altbestandswort</p>",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Altkategorie",
    tags: ["altschlagwort"],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 1,
    assignments: [],
    createdAt: KO_CREATED_AT,
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

// Eine Zeile, wie sie eine V1-Umgebung trägt: Fassung 1, kein Dokumenttext, leere
// Klassifizierungszelle (genau der Wert, den die nachgerüstete Spalte als Default setzt).
function v1Zeile(objekt: KnowledgeObject, at: string): KoSearchProjection {
  return {
    ...buildSearchProjection(objekt, at),
    projectionVersion: 1,
    bodyText: "",
    searchText: `${objekt.title}\n${objekt.statement}\n${objekt.category}`,
    contentHash: "v1-hash",
    classificationSnapshot: parseClassificationSnapshot("", objekt.version),
  };
}

function stack() {
  const repo = new InMemoryKoRepo();
  const projections = new InMemoryKoSearchProjectionRepo(repo);
  const versions = new InMemoryKoVersionRepo();
  const dienst = new KoService({ repo, versions, searchProjections: projections });
  return { repo, projections, versions, ko: dienst };
}

// ================================================================================================
// AK 4 — DAS V1-SCHEMA WIRD ADDITIV V2-FÄHIG GEMACHT
// ================================================================================================

describe("G27 Welle 1 · AK4 · die Nachrüststufe ist gegenüber Fassung 1 vollständig", () => {
  it("genau die gegenüber Fassung 1 NEUEN Spalten werden nachgerüstet — Delta berechnet, nicht behauptet", async () => {
    const geschrieben = await schreibSpalten();
    const alt = new Set<string>(V1_SPALTEN);
    // Das Delta ist das, was die Migration schuldig ist. Käme morgen eine vierte V2-Spalte dazu,
    // ohne dass jemand die Nachrüststufe erweitert, wird dieser Test rot — und nicht erst die
    // Beta beim ersten Insert.
    //
    // `generation` ist die dritte (G27 R1, Entscheidung 09 §2) — und dieser Test hat genau das
    // geleistet, wofür er gebaut wurde: er hat die neue Spalte selbst gemeldet, statt sie
    // durchrutschen zu lassen. Die Nachrüststufe trägt sie ebenfalls, sonst wäre die Zeile darunter
    // rot.
    const delta = geschrieben.filter((spalte) => !alt.has(spalte)).sort();
    expect(delta).toEqual(["body_text", "classification_snapshot", "generation"]);
    expect(nachgeruesteteSpalten().sort()).toEqual(delta);
  });

  it("keine Spalte der Fassung 1 wird entfernt — die Migration nimmt nichts weg", async () => {
    const geschrieben = new Set(await schreibSpalten());
    for (const spalte of V1_SPALTEN) {
      expect(geschrieben.has(spalte), `Fassung 1 kannte ${spalte}`).toBe(true);
    }
    expect(KO_SEARCH_PROJECTION_SCHEMA).not.toMatch(/DROP COLUMN|TRUNCATE|\bDROP TABLE\b/i);
  });

  it("die Stufe ist wiederholbar formuliert: jede Anweisung trägt ihr IF NOT EXISTS", () => {
    const anweisungen =
      KO_SEARCH_PROJECTION_SCHEMA.match(/(CREATE TABLE|CREATE INDEX|ADD COLUMN)/gi) ?? [];
    const idempotent =
      KO_SEARCH_PROJECTION_SCHEMA.match(/(CREATE TABLE|CREATE INDEX|ADD COLUMN) IF NOT EXISTS/gi) ??
      [];
    expect(anweisungen.length).toBeGreaterThan(0);
    expect(idempotent.length).toBe(anweisungen.length);
  });
});

// ================================================================================================
// AK 7 — KEIN DEFAULT BEHAUPTET EINE GEPRÜFTE VERGANGENHEIT
// ================================================================================================

describe("G27 Welle 1 · AK7 · die nachgerüsteten Defaults behaupten nichts", () => {
  it("der Default der Klassifizierungsspalte ist der Leerwert — nie eine Einstufung", () => {
    const stufe = (KO_SEARCH_PROJECTION_SCHEMA.match(/\bALTER TABLE\b[\s\S]*?;/gi) ?? []).find(
      (s) => s.includes("classification_snapshot"),
    );
    expect(stufe).toMatch(/DEFAULT\s+''/);
    expect(stufe).not.toMatch(/intern|vertraulich|public|verified/i);
  });

  it("die leere Zelle wird fail-safe gelesen: `none`, unbestätigt, als Rekonstruktion markiert", () => {
    for (const roh of ["", null, undefined, "kein json"]) {
      const snapshot = parseClassificationSnapshot(roh, 1);
      expect(snapshot.value).toBe("none");
      expect(snapshot.value).not.toBe("intern");
      expect(snapshot.historicalConfidence).toBe("unknown");
      expect(snapshot.historicalConfidence).not.toBe("verified");
      expect(snapshot.provenance).toBe("reconstructed_from_current_ko");
      expect(snapshot.capturedAt).toBeNull();
      expect(snapshot.capturedAtSource).toBe("unknown");
    }
  });

  it("eine migrierte V1-Zeile kommt durch den Postgres-Adapter als unbestätigt zurück", async () => {
    // Genau die Zeilenform nach der Schemamigration: alte Spalten gefüllt, die beiden neuen auf
    // ihrem Default. Der Adapter darf daraus NICHTS ableiten, was die Zeile nicht sagt.
    const { pool } = fakePool([
      {
        ko_id: "alt-1",
        ko_version: 1,
        projection_version: 1,
        search_text: "Altbestand SPX9",
        title_text: "Altbestand SPX9",
        statement_text: "Aussage.",
        caption_text: "",
        body_text: "",
        language: "und",
        content_hash: "v1-hash",
        status: "vollstaendig",
        classification_snapshot: "",
        created_at: KO_CREATED_AT,
        updated_at: KO_CREATED_AT,
      },
    ]);
    const gelesen = await new PgKoSearchProjectionRepo(pool).find("alt-1", 1);
    // Die Zeile ist weiterhin eindeutig Fassung 1 …
    expect(gelesen?.projectionVersion).toBe(1);
    expect(gelesen?.projectionVersion).not.toBe(SEARCH_PROJECTION_VERSION);
    // … und ihre Klassifizierung ist ausdrücklich keine Aussage.
    expect(gelesen?.classificationSnapshot.value).toBe("none");
    expect(gelesen?.classificationSnapshot.historicalConfidence).toBe("unknown");
    expect(gelesen?.bodyText).toBe("");
  });
});

// ================================================================================================
// AK 6 — ERST DER BENANNTE NACHZUG MACHT AUS V1 EIN V2
// ================================================================================================

describe("G27 Welle 1 · AK6 · Schemamigration und Fassungsnachzug sind zwei Dinge", () => {
  it("die Schemastufe fasst die Fassungsnummer NICHT an — kein stilles Hochsetzen auf 2", () => {
    // Der No-Go aus Abschnitt J: „Projection-Version still auf 2 setzen, bevor der V2-Rebuild
    // vollständig ist." Die Migration darf Zeilen nur nachrüsten, nicht umdeuten.
    expect(KO_SEARCH_PROJECTION_SCHEMA).not.toMatch(/\bUPDATE\b/i);
    expect(KO_SEARCH_PROJECTION_SCHEMA).not.toMatch(/projection_version\s*=/);
    expect(KO_SEARCH_PROJECTION_SCHEMA).not.toMatch(/SET\s+projection_version/i);
  });

  it("erst der ausdrückliche Nachzug leitet die Zeile deterministisch neu ab und markiert sie als Fassung 2", async () => {
    const { repo, projections, ko: dienst } = stack();
    const alt = ko();
    await repo.insert(alt);
    await projections.insert(v1Zeile(alt, KO_CREATED_AT));

    // Vor dem Nachzug: die Zeile ist da, aber ehrlich veraltet.
    const vorher = await dienst.searchProjectionVersions();
    expect(vorher.offenV1).toBe(1);
    expect((await dienst.searchProjectionOf("alt-1"))?.projectionVersion).toBe(1);

    const bilanz = await dienst.backfillSearchProjections({ limit: 10 });
    expect(bilanz.v2Migriert).toBe(1);

    const nach = await dienst.searchProjectionOf("alt-1");
    expect(nach?.projectionVersion).toBe(SEARCH_PROJECTION_VERSION);
    // Der Dokumenttext ist jetzt da (die neue Spalte trägt Inhalt statt Default) …
    expect(nach?.bodyText).toBe("Altbestandswort");
    // … und die Klassifizierung ist eine als solche gekennzeichnete Rekonstruktion, keine
    // erfundene bestätigte Geschichte.
    expect(nach?.classificationSnapshot.provenance).toBe("reconstructed_from_current_ko");
    expect(nach?.classificationSnapshot.historicalConfidence).toBe("unknown");
    expect(nach?.classificationSnapshot.capturedAt).toBe(KO_CREATED_AT);
    expect(nach?.classificationSnapshot.capturedAtSource).toBe("ko_created_at");
    // `created_at` der Zeile bleibt: neu abgeleitet, nicht neu geboren.
    expect(nach?.createdAt).toBe(KO_CREATED_AT);
    expect((await dienst.searchProjectionVersions()).offenV1).toBe(0);
  });

  it("der Nachzug ist wiederholbar: zweiter Lauf ist ein No-op, dritter Lauf ändert keinen Hash", async () => {
    const { repo, projections, ko: dienst } = stack();
    const alt = ko();
    await repo.insert(alt);
    await projections.insert(v1Zeile(alt, KO_CREATED_AT));

    await dienst.backfillSearchProjections({ limit: 10 });
    const nachErstem = await dienst.searchProjectionOf("alt-1");
    expect(await dienst.backfillSearchProjections({ limit: 10 })).toEqual({
      geprueft: 0,
      geschrieben: 0,
      v2Migriert: 0,
      gescheitert: 0,
    });
    await dienst.rebuildSearchProjections();
    const nachRebuild = await dienst.searchProjectionOf("alt-1");
    expect(nachRebuild?.contentHash).toBe(nachErstem?.contentHash);
    expect({ ...nachRebuild, updatedAt: "egal" }).toEqual({ ...nachErstem, updatedAt: "egal" });
  });
});

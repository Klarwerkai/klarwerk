// ================================================================================================
// Q2d / JOB 3424 — DIE BESTANDSMIGRATION VON `external_id` LÄUFT ÜBER ECHTEN ALTBESTAND.
// ================================================================================================
//
// Der offene Beleg (PRIORITAETEN.md:14311, Q2d): „ausdrücklich fehlender Beleg ist die reale
// Ausführung der Bestandsmigration in repo-pg.ts:116 gegen PostgreSQL". Welche Migration das ist,
// steht NICHT an der Zeilennummer fest, sondern an ihrem Inhalt — die Zuordnung prüft
// `zuordnung.test.ts` daneben: der DO-Block in `IMPORT_CANDIDATES_SCHEMA`, der eine
// `external_id`-Spalte OHNE `NULLIF` erkennt, sie samt abhängigem Index abwirft und mit
// `NULLIF(data->'item'->>'externalId', '')` neu aufbaut.
//
// ABGRENZUNG zu `tests/q2d-leere-kennung/pg-leere-kennung.integration.test.ts` (P5): dort läuft
// die Konstante allein über eine Tabelle, die NUR `external_id` trägt, mit EINER Zeile, und
// geprüft wird nur diese eine Spalte. Hier läuft:
//   · der ECHTE Startweg `migrate()` (`services/app/src/db.ts`), nicht die Konstante allein;
//   · über den VOLLEN Tabellenstand vor JOB 3424 (alle vier Generated-Spalten + Claim-Index);
//   · mit gemischtem Altbestand (leer, null, fehlend, gefüllt, zwei Anbieter, offen/geclaimt/
//     erledigt), dessen Inhalt UND Struktur vorher und nachher abgefragt werden;
//   · plus Neustart/Wiederholung und ein erzwungener Fehlerfall mit reproduzierbarem Befund.
//
// Läuft NUR unter `test:integration` (Docker/Testcontainers oder eine per KLARWERK_PG_TEST_URL
// angebotene Testinstanz). Ohne beides wird EHRLICH übersprungen — dieselbe Bauform wie
// `services/library-analytics/src/repo-pg.integration.test.ts`.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  type ImportCandidate,
  type ImportItem,
  PgCandidateRepo,
  type ReviewStatus,
} from "../../services/library-analytics";

/**
 * Der Tabellenstand einer laufenden Instanz VOR JOB 3424: alle Spalten und der Claim-Index wie
 * heute, NUR `external_id` bildet die leere Kennung unverändert als '' ab.
 */
const STAND_VOR_3424 = `
CREATE TABLE IF NOT EXISTS import_candidates (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS external_id text
  GENERATED ALWAYS AS (data->'item'->>'externalId') STORED;
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS provider text
  GENERATED ALWAYS AS (
    lower(COALESCE(NULLIF(btrim(data->'item'->>'provider'), ''), 'confluence'))
  ) STORED;
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS source_version integer
  GENERATED ALWAYS AS (
    CASE WHEN (data->'item'->>'sourceVersion') ~ '^[0-9]{1,9}$'
         THEN (data->'item'->>'sourceVersion')::int
         ELSE 1 END
  ) STORED;
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS review_status text
  GENERATED ALWAYS AS (data->>'status') STORED;
CREATE UNIQUE INDEX IF NOT EXISTS import_candidates_open_claim_external_uq
  ON import_candidates (provider, external_id, source_version)
  WHERE external_id IS NOT NULL AND review_status IN ('neu', 'in_bearbeitung');
`;

const INDEX = "import_candidates_open_claim_external_uq";
const HEILUNGSHINWEIS = /external_id bildete die LEERE Kennung.*JOB 3424 Q2d/;

function kandidat(
  id: string,
  over: Partial<ImportItem>,
  status: ReviewStatus = "neu",
): ImportCandidate {
  const item: ImportItem = {
    title: `Altbestand ${id}`,
    statement: "Bei Ueberdruck das Ventil X langsam entlueften",
    type: "best_practice",
    category: "Wartung",
    sourceVersion: 1,
    provider: "Confluence",
    ...over,
  };
  return {
    id,
    item,
    status,
    duplicate: false,
    note: null,
    koId: status === "angenommen" ? `ko-${id}` : null,
    createdAt: "2026-09-01T08:00:00.000Z",
  };
}

/** Der Altbestand: jede Form, die eine laufende Instanz vor JOB 3424 tragen konnte. */
function altbestand(): Array<{ id: string; data: unknown }> {
  const mitNull = kandidat("b-null", {});
  // Eine Zeile aus der Zeit vor der provider-Spalte: das Item trägt KEINEN provider.
  const p3 = kandidat("h-p3-ohne-provider", { externalId: "P3" });
  const ohneProvider = {
    ...p3,
    item: {
      title: p3.item.title,
      statement: p3.item.statement,
      type: p3.item.type,
      category: p3.item.category,
      externalId: "P3",
      sourceVersion: 1,
    },
  };
  return [
    kandidat("a-leer-offen", { externalId: "" }),
    { ...mitNull, item: { ...mitNull.item, externalId: null } },
    kandidat("c-ohne-kennung", {}),
    kandidat("d-p1-offen", { externalId: "P1" }),
    kandidat("e-p1-jira-offen", { externalId: "P1", provider: "Jira" }),
    kandidat("f-p1-angenommen", { externalId: "P1" }, "angenommen"),
    kandidat("g-p2-geclaimt", { externalId: "P2", sourceVersion: 3 }, "in_bearbeitung"),
    ohneProvider,
    kandidat("i-leer-abgelehnt", { externalId: "" }, "abgelehnt"),
  ].map((k) => ({ id: k.id, data: JSON.parse(JSON.stringify(k)) }));
}

interface Zeile {
  id: string;
  data: unknown;
  external_id: string | null;
  provider: string;
  source_version: number;
  review_status: string;
}

interface Ausgangslage {
  vorher: Zeile[];
  strukturVorher: Struktur;
}

interface Spalte {
  attname: string;
  typ: string;
  attgenerated: string;
  ausdruck: string | null;
}

interface Struktur {
  spalten: Spalte[];
  indizes: Array<{ indexname: string; indexdef: string }>;
}

async function zeilen(p: Pool): Promise<Zeile[]> {
  const res = await p.query<Omit<Zeile, "source_version"> & { source_version: number | string }>(
    `SELECT id, data, external_id, provider, source_version, review_status
       FROM import_candidates ORDER BY id`,
  );
  // R-1653: `migrate()` baut `source_version` als `bigint` neu auf (Neun-Stellen-Fassung → fünfzehn
  // Stellen); node-postgres liefert `bigint` als Zeichenkette. Verglichen wird der ZAHLENWERT —
  // er muss für jede Zeile derselbe bleiben.
  return res.rows.map((z) => ({ ...z, source_version: Number(z.source_version) }));
}

async function struktur(p: Pool): Promise<Struktur> {
  const spalten = await p.query<Spalte>(
    `SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS typ, a.attgenerated::text,
            pg_get_expr(d.adbin, d.adrelid) AS ausdruck
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'import_candidates'::regclass AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attname`,
  );
  const indizes = await p.query<{ indexname: string; indexdef: string }>(
    `SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename = 'import_candidates' ORDER BY indexname`,
  );
  return { spalten: spalten.rows, indizes: indizes.rows };
}

function spalte(s: Struktur, name: string): Spalte {
  const treffer = s.spalten.find((x) => x.attname === name);
  if (!treffer) {
    throw new Error(`Spalte ${name} fehlt in import_candidates.`);
  }
  return treffer;
}

/** Was die Migration an den Zeilen ändern darf: NUR '' in `external_id` wird NULL. */
function erwartetNachher(vorher: Zeile[]): Zeile[] {
  return vorher.map((z) => ({
    ...z,
    external_id: z.external_id === "" ? null : z.external_id,
  }));
}

/**
 * Struktur ohne `external_id` und `source_version` — alles andere muss die Migration unverändert
 * lassen. `source_version` heilt seit R-1653 ein eigener Block (Neun-Stellen-Fassung → `bigint`
 * mit fünfzehn Stellen); ihre Sollform prüft `sourceVersionGeheilt` ausdrücklich.
 */
function ohneExternalId(s: Struktur): Spalte[] {
  return s.spalten.filter((x) => x.attname !== "external_id" && x.attname !== "source_version");
}

/** Die Sollform von `source_version` nach `migrate()` (R-1653). */
function sourceVersionGeheilt(s: Struktur): void {
  const sv = spalte(s, "source_version");
  expect(sv.typ).toBe("bigint");
  expect(sv.attgenerated).toBe("s");
  expect(sv.ausdruck).toContain("{1,15}");
  expect(sv.ausdruck).not.toContain("{1,9}");
}

describe("Q2d · Bestandsmigration external_id (JOB 3424) über echten Altbestand", () => {
  let container: StartedTestContainer | undefined;
  let url: string | undefined;
  let pool: Pool | undefined;
  let available = false;
  const hinweise: string[] = [];

  /**
   * Ein Pool, dessen Verbindungen die Server-Hinweise (RAISE NOTICE) mitschreiben.
   *
   * `sitzung` sind Startparameter JEDER Verbindung (`options=-c …`). Ein `SET` über `pool.query`
   * reicht dafür nicht: pg-pool gibt den Client nach einem Abfragefehler mit `release(err)` zurück
   * und VERWIRFT ihn damit — die nächste Abfrage läuft auf einer frischen Verbindung ohne die
   * Einstellung (so hing B3 im ersten Lauf: zweiter Versuch ohne lock_timeout, endloses Warten).
   */
  function neuerPool(max?: number, sitzung?: string): Pool {
    if (!url) {
      throw new Error("Keine Testdatenbank-URL.");
    }
    const verbindung = new URL(url);
    if (sitzung) {
      verbindung.searchParams.set("options", sitzung);
    }
    const p = new Pool({ connectionString: verbindung.toString(), ...(max ? { max } : {}) });
    p.on("connect", (client) => {
      client.on("notice", (n) => hinweise.push(n.message ?? ""));
    });
    return p;
  }

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        url = localUrl;
        pool = neuerPool();
        await pool.query("SELECT 1");
        available = true;
        return;
      } catch {
        process.stderr.write(
          "[KLARWERK] Q2d-Bestandsmigration UEBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung moeglich.\n",
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
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
      pool = neuerPool();
      available = true;
    } catch {
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

  /** Legt den Altbestand an und belegt, dass er wirklich der Stand VOR der Heilung ist. */
  async function bestandAnlegen(p: Pool): Promise<Ausgangslage> {
    await p.query("DROP TABLE IF EXISTS import_candidates");
    await p.query(STAND_VOR_3424);
    for (const z of altbestand()) {
      await p.query("INSERT INTO import_candidates(id,data) VALUES($1,$2)", [
        z.id,
        JSON.stringify(z.data),
      ]);
    }
    const vorher = await zeilen(p);
    const strukturVorher = await struktur(p);
    expect(vorher, "Vorbedingung: der ganze Altbestand liegt ein.").toHaveLength(9);
    expect(
      vorher.filter((z) => z.external_id === "").map((z) => z.id),
      "Vorbedingung: die ALTE Spalte speichert die leere Kennung wirklich als ''.",
    ).toEqual(["a-leer-offen", "i-leer-abgelehnt"]);
    expect(spalte(strukturVorher, "external_id").ausdruck).not.toMatch(/NULLIF/i);
    expect(strukturVorher.indizes.map((i) => i.indexname)).toContain(INDEX);
    return { vorher, strukturVorher };
  }

  it("B1 · migrate() heilt den Altbestand: Inhalt erhalten, '' → NULL, Struktur wie gefordert", async (ctx) => {
    const p = requirePool(ctx);
    const { vorher, strukturVorher } = await bestandAnlegen(p);
    const repo = new PgCandidateRepo(p);

    // Der Befund VOR der Migration, konkret statt pauschal: der zweite Import mit leerer Kennung
    // scheitert an genau diesem Index mit unique_violation — nicht an „irgendeinem 500".
    await expect(repo.insert(kandidat("z-leer-zweiter", { externalId: "" }))).rejects.toMatchObject(
      { code: "23505", constraint: INDEX },
    );
    expect(await zeilen(p), "Der gescheiterte Insert hat nichts verändert.").toEqual(vorher);

    hinweise.length = 0;
    await expect(
      migrate(p),
      "Der echte Startweg läuft über den Altbestand.",
    ).resolves.toBeUndefined();
    expect(
      hinweise.filter((h) => HEILUNGSHINWEIS.test(h)),
      "Die Heilung hat wirklich gegriffen (genau ein Hinweis, mit dem abhängigen Index).",
    ).toEqual([expect.stringContaining(INDEX)]);

    // INHALT: jede Zeile ist noch da, `data` ist unverändert, nur '' in external_id ist NULL.
    const nachher = await zeilen(p);
    expect(nachher).toEqual(erwartetNachher(vorher));

    // STRUKTUR: external_id ist eine gespeicherte Generated-Spalte MIT NULLIF; alle übrigen
    // Spalten und der Claim-Index sind Zeichen für Zeichen wie vorher.
    const strukturNachher = await struktur(p);
    const ext = spalte(strukturNachher, "external_id");
    expect(ext.typ).toBe("text");
    expect(ext.attgenerated).toBe("s");
    expect(ext.ausdruck).toMatch(/^NULLIF\(.*'externalId'.*, ''::text\)$/);
    expect(ohneExternalId(strukturNachher)).toEqual(ohneExternalId(strukturVorher));
    sourceVersionGeheilt(strukturNachher);
    expect(strukturNachher.indizes).toEqual(strukturVorher.indizes);

    // WIRKUNG: der zweite Import mit leerer Kennung geht jetzt durch; eine echte Kennung bleibt
    // der idempotente Anker (je Anbieter ein offener Platz; jeder wird weiter abgewiesen).
    await expect(
      repo.insert(kandidat("z-leer-zweiter", { externalId: "" })),
    ).resolves.toBeUndefined();
    expect(await repo.insertIfAbsent(kandidat("z-p1-dublette", { externalId: "P1" }))).toBe(false);
    expect(
      await repo.insertIfAbsent(kandidat("z-p1-jira-neu", { externalId: "P1", provider: "Jira" })),
      "Der offene Jira-P1 belegt seinen eigenen Platz — auch er wird abgewiesen.",
    ).toBe(false);
    expect(
      await repo.insertIfAbsent(kandidat("z-p2-dublette", { externalId: "P2", sourceVersion: 3 })),
      "Ein geclaimter Kandidat behält seinen Idempotenzplatz auch nach der Heilung.",
    ).toBe(false);
  });

  it("B2 · Neustart und Wiederholung: weitere migrate()-Läufe erhalten Daten und Struktur", async (ctx) => {
    const p = requirePool(ctx);
    const { vorher } = await bestandAnlegen(p);
    await migrate(p);
    const nachErstemLauf = await zeilen(p);
    const strukturNachErstemLauf = await struktur(p);
    expect(nachErstemLauf).toEqual(erwartetNachher(vorher));

    // Ein NEUER Pool steht für einen neuen Prozessstart: eigene Verbindungen, derselbe Datenraum.
    const neustart = neuerPool();
    try {
      hinweise.length = 0;
      await expect(migrate(neustart)).resolves.toBeUndefined();
      await expect(migrate(neustart)).resolves.toBeUndefined();
      expect(
        hinweise.filter((h) => HEILUNGSHINWEIS.test(h)),
        "Nach der Heilung greift der Block kein zweites Mal (idempotent).",
      ).toEqual([]);
      expect(await zeilen(neustart)).toEqual(nachErstemLauf);
      expect(await struktur(neustart)).toEqual(strukturNachErstemLauf);
    } finally {
      await neustart.end();
    }
  });

  it("B3 · Fehlerfall: gesperrte Tabelle ergibt einen reproduzierbaren Befund, Bestand bleibt unberührt", async (ctx) => {
    const p = requirePool(ctx);
    const { vorher, strukturVorher } = await bestandAnlegen(p);

    // Ein laufender Leser hält die Tabelle (ACCESS SHARE in offener Transaktion) — die Migration
    // braucht ACCESS EXCLUSIVE. Mit begrenzter Wartezeit muss sie mit einem benannten Befund
    // abbrechen, statt zu hängen oder halb zu migrieren.
    const leser = await p.connect();
    const migrierer = neuerPool(1, "-c lock_timeout=500");
    try {
      await leser.query("BEGIN");
      await leser.query("SELECT count(*) FROM import_candidates");
      const zeitgrenze = await migrierer.query<{ lock_timeout: string }>("SHOW lock_timeout");
      expect(zeitgrenze.rows[0]?.lock_timeout, "Die Zeitgrenze gilt je Verbindung.").toBe("500ms");

      const befunde: Array<{ code: string | undefined; message: string | undefined }> = [];
      for (let versuch = 1; versuch <= 2; versuch++) {
        const fehler = await migrate(migrierer).then(
          () => undefined,
          (e: { code?: string; message?: string }) => e,
        );
        expect(fehler, `Versuch ${versuch}: die Migration darf nicht durchlaufen.`).toBeDefined();
        befunde.push({ code: fehler?.code, message: fehler?.message });
        expect(await zeilen(p), "Der Altbestand bleibt nach dem Abbruch unverändert.").toEqual(
          vorher,
        );
        expect(await struktur(p), "Die Struktur bleibt nach dem Abbruch unverändert.").toEqual(
          strukturVorher,
        );
      }
      // Derselbe Zustand, derselbe Befund: SQLSTATE 55P03 (lock_not_available), zweimal gleich.
      expect(befunde[0]).toMatchObject({
        code: "55P03",
        message: expect.stringMatching(/lock timeout/),
      });
      expect(befunde[1]).toEqual(befunde[0]);
    } finally {
      await leser.query("ROLLBACK");
      leser.release();
    }

    // Ursache weg → derselbe Startweg läuft durch, mit demselben Ergebnis wie in B1.
    try {
      await expect(migrate(migrierer)).resolves.toBeUndefined();
      expect(await zeilen(p)).toEqual(erwartetNachher(vorher));
      expect(spalte(await struktur(p), "external_id").ausdruck).toMatch(/NULLIF/);
    } finally {
      await migrierer.end();
    }
  });
});

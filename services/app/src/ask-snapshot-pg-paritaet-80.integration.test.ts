import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AnswerEvidenceSnapshot, hashAnswerSnapshot } from "../../ask";
import { guardedLocalPgTestUrl } from "../../db-tx";
import { buildPgServices } from "./build-app";
import { migrate } from "./db";

// ================================================================================================
// AUFTRAG 80 — DIE ECHTE POSTGRESQL-PARITAET DES W3-C1-SCHREIBWEGS
// ================================================================================================
//
// WAS IN RUECKGABE 76 OFFENBLIEB UND WARUM ES ZAEHLT. Der Beleg-Schreibweg wurde dort produktiv
// verdrahtet und mit InMemory belegt; die Zusage gegen einen echten Server fehlte ausdruecklich.
// Der Unterschied ist nicht Formsache: `buildPgServices` konstruiert ANDERE Adapter als
// `buildServices`, und ob die Antwort dort wirklich eine Zeile in `answer_records` und
// `answer_snapshots` hinterlaesst, hat bis hierher niemand gemessen.
//
// DIESE DATEI KENNT KEINEN SKIP. Auftrag 80 Akzeptanz 1 verlangt eine echte Verbindung ohne
// Ersatzablage und ohne InMemory-Rueckfall. Ist keine Datenbank erreichbar, SCHEITERT der Lauf
// laut — eine uebersprungene Paritaetsprobe waere genau die Art von gruener Zeile, die nichts
// belegt und trotzdem so aussieht.
//
// EIGENES SCHEMA STATT `public`: der Lauf legt seinen Datenraum selbst an, arbeitet ausschliesslich
// darin und raeumt ihn nachweislich wieder ab. So kann er weder fremde Testdaten sehen noch eigene
// hinterlassen.

const SCHEMA = `w3c1_80_${process.pid}`;

describe("Auftrag 80: buildPgServices schreibt den Answer-Beleg wirklich in PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let adminPool: Pool | undefined;
  let pool: Pool | undefined;
  let services: ReturnType<typeof buildPgServices> | undefined;
  let gehaltenesKo: { id: string; version: number } | undefined;
  let ersteAnswerId: string | undefined;
  let zweiteAnswerId: string | undefined;

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    let url = localUrl;
    if (!url) {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    }

    adminPool = new Pool({ connectionString: url });
    // KEIN Skip, KEIN Fallback: eine nicht erreichbare Datenbank ist ein Fehlschlag.
    await adminPool.query("SELECT 1");
    await adminPool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await adminPool.query(`CREATE SCHEMA ${SCHEMA}`);

    // ZWEI POOLS, UND DAS IST KEIN LUXUS. Ein `SET search_path` per `pool.query` gilt nur fuer die
    // EINE Verbindung, die der Pool gerade herausgibt — der naechste Aufruf kann eine andere
    // erwischen und steht wieder in `public`. Genau daran ist der erste Lauf dieser Datei
    // gescheitert (`relation "ko_projection_control" does not exist`). Der Suchpfad gehoert deshalb
    // in die VERBINDUNGSOPTIONEN, damit ausnahmslos jede Verbindung im eigenen Schema landet.
    pool = new Pool({ connectionString: url, options: `-c search_path=${SCHEMA}` });
    await migrate(pool);

    // Die produktive Pg-Komposition wird EINMAL gebaut und geteilt: die Suchprojektion kennt einen
    // Zustandsautomaten, der ein zweites `V2_BUILDING` aus `V2_READY` zu Recht verweigert.
    services = buildPgServices(pool);
    await services.ko.activateSearchProjectionV2();

    // ============================================================================================
    // AUFTRAG 89 — EIN ECHTER BESTAND, WEIL EINE ZUSICHERUNG OHNE EVIDENZ NICHTS ZUSICHERT.
    // ============================================================================================
    //
    // DER BEFUND, DER DIESE ZEILEN ERZWUNGEN HAT: bis Auftrag 89 fragte diese Datei gegen einen
    // LEEREN Wissensbestand. Die Antwort trug damit null Evidenzreferenzen, der Snapshot stand auf
    // PENDING_EVIDENCE — und jede Aussage ueber `knowledgeObjectVersion` waere ueber eine leere
    // Menge gelaufen, also immer wahr und immer wertlos. Die Luecke aus BEN 82 Befund 2 haette sich
    // hier nicht einmal ausdruecken lassen.
    //
    // Das gehaltene Fixture bindet Identitaet und positive Fassung der getragenen Evidence.
    // INCOMPLETE bleibt richtig: der tragenden Quelle fehlt die Validierungsentscheidung,
    // nicht ihre KO-Fassung. Der zweite Lauf fragt bewusst ohne passende Evidence.
    gehaltenesKo = await services.ko.create({
      title: "Wartungshinweis Portalanlage",
      statement: "Die Verschraubung der Grundplatte wird quartalsweise nachgezogen.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
    });
  }, 180_000);

  afterAll(async () => {
    // BELEGTES CLEANUP: erst abraeumen, dann nachsehen, dass wirklich nichts blieb.
    await pool?.end();
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
      const rest = await adminPool.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM information_schema.schemata WHERE schema_name = $1",
        [SCHEMA],
      );
      if (rest.rows[0]?.n !== "0") {
        throw new Error(`Cleanup unvollstaendig: Schema ${SCHEMA} existiert noch.`);
      }
    }
    await adminPool?.end();
    await container?.stop();
  }, 120_000);

  function db(): Pool {
    if (!pool) {
      throw new Error("keine PostgreSQL-Verbindung");
    }
    return pool;
  }

  function app(): ReturnType<typeof buildPgServices> {
    if (!services) {
      throw new Error("keine Pg-Komposition");
    }
    return services;
  }

  function fixture(): { id: string; version: number } {
    if (!gehaltenesKo) {
      throw new Error("kein gehaltenes KO-Fixture");
    }
    return gehaltenesKo;
  }

  function antwortId(wer: "anna" | "bea"): string {
    const id = wer === "anna" ? ersteAnswerId : zweiteAnswerId;
    if (!id) {
      throw new Error(`keine festgehaltene answerId fuer ${wer}`);
    }
    return id;
  }

  function pruefeAnnaEvidenz(evidenz: AnswerEvidenceSnapshot["evidence"]): void {
    const ko = fixture();
    expect(ko.version).toBeGreaterThan(0);
    expect(evidenz.length, "ohne Evidenz waere die Aussage leer").toBeGreaterThan(0);
    expect(evidenz.map((e) => e.knowledgeObjectId)).toEqual([ko.id]);
    for (const e of evidenz) {
      expect(e.knowledgeObjectVersion, "gebunden ist genau die gehaltene Fixture-Fassung").toBe(
        ko.version,
      );
      expect(e.knowledgeObjectVersion).not.toBeNull();
      expect(e.knowledgeObjectVersion).not.toBe(0);
      const hatRef = e.validationDecisionRef !== undefined;
      const hatGrund = e.validationReferenceAbsenceReason !== undefined;
      expect(hatRef !== hatGrund).toBe(true);
      expect(e.evidenceRole).toBe("carrying");
      expect(e.validationDecisionRef).toBeUndefined();
      expect(e.validationReferenceAbsenceReason).toBe("NOT_AVAILABLE_AT_EXECUTION");
    }
  }

  it("die Tabellen des Belegs stehen im eigenen Schema — migrate() hat sie angelegt", async () => {
    const res = await db().query<{ t: string }>(
      `SELECT c.relname AS t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relkind = 'r'
          AND c.relname IN ('answer_records','answer_snapshots')
        ORDER BY c.relname`,
      [SCHEMA],
    );
    expect(res.rows.map((r) => r.t)).toEqual(["answer_records", "answer_snapshots"]);
    // Ausgangslage: leer. Ohne diese Zeile koennte jeder spaetere Befund aus einem Vorlauf stammen.
    const leer = await db().query<{ n: string }>("SELECT count(*)::text AS n FROM answer_records");
    expect(leer.rows[0]?.n).toBe("0");
  });

  it("ein Antwortlauf ueber buildPgServices schreibt GENAU einen Record und Revision 1", async () => {
    // Die Frage trifft genau das gehaltene Fixture; die Kennung bleibt fuer alle Folgepruefungen.
    const out = await app().ask.ask(
      "Wie oft wird die Verschraubung der Grundplatte nachgezogen?",
      "anna",
      "de",
    );
    expect(out.answerId, "der produktive Pg-Aufbau muss einen Beleg schreiben").not.toBeNull();
    if (!out.answerId) {
      throw new Error("keine answerId");
    }
    ersteAnswerId = out.answerId;
    const answerId = antwortId("anna");

    // Eindeutige Identitaet in Rueckgabe, SQL-Spalte und JSON-Rumpf; keine zufaellige erste Zeile.
    const anzahl = await db().query<{ n: string }>(
      "SELECT count(*)::text AS n FROM answer_records",
    );
    expect(anzahl.rows[0]?.n).toBe("1");
    const records = await db().query<{ answer_id: string; im_rumpf: string }>(
      "SELECT answer_id, data->>'answerId' AS im_rumpf FROM answer_records WHERE answer_id = $1",
      [answerId],
    );
    expect(records.rows.map((r) => r.answer_id)).toEqual([answerId]);
    expect(records.rows[0]?.im_rumpf).toBe(out.answerId);

    const anzahlSnapshots = await db().query<{ n: string }>(
      "SELECT count(*)::text AS n FROM answer_snapshots",
    );
    expect(anzahlSnapshots.rows[0]?.n).toBe("1");
    const snaps = await db().query<{ answer_id: string; snapshot_revision_key: string }>(
      "SELECT answer_id, snapshot_revision_key FROM answer_snapshots WHERE answer_id = $1",
      [answerId],
    );
    expect(snaps.rows).toHaveLength(1);
    expect(snaps.rows[0]?.answer_id).toBe(out.answerId);
    expect(snaps.rows[0]?.snapshot_revision_key).toBe("1");
  });

  it("der persistierte Beleg bindet die Fixture-Fassung und benennt leere Zusatzfelder", async () => {
    const zeile = await db().query<{ data: AnswerEvidenceSnapshot }>(
      "SELECT data FROM answer_snapshots WHERE answer_id = $1 AND snapshot_revision_key = $2",
      [antwortId("anna"), "1"],
    );
    expect(zeile.rows).toHaveLength(1);
    const data = zeile.rows[0]?.data;
    expect(data).toBeDefined();
    if (!data) {
      throw new Error("kein Snapshot der ersten Antwort");
    }
    expect(data.answerId).toBe(antwortId("anna"));
    expect(data.snapshotRevision).toBe(1);
    expect(data.validationDecisionRef).toBeNull();
    expect(data.validationDecisionRefReason).toBe("w3_23_ref_liegt_je_evidence");
    expect(data.validationDecisionRefReason).not.toBe("w3b_findbyseq_missing");
    expect(data.resolutionId).toBeNull();
    expect(data.resolutionIdReason).toBe("w1_not_on_answer_path");

    // Heute kommt die positive KO-Fassung aus genau dem Objekt, das der Antwortlauf hielt.
    // Die noch fehlende Entscheidung an der tragenden Evidence verhindert COMPLETE.
    pruefeAnnaEvidenz(data.evidence);
    expect(data.citedSources).toEqual([fixture().id]);
    expect(data.status).toBe("INCOMPLETE");
    expect(data.status).not.toBe("COMPLETE");
    expect(data.integrityHash).toBe(hashAnswerSnapshot(data));
  });

  it("ein zweiter Antwortlauf ist eine ANDERE Antwort — auch in der Datenbank", async () => {
    const zweite = await app().ask.ask("Eine andere Frage", "bea", "de");
    if (!zweite.answerId) {
      throw new Error("keine answerId");
    }
    zweiteAnswerId = zweite.answerId;
    const anna = antwortId("anna");
    const bea = antwortId("bea");
    expect(bea).not.toBe(anna);

    const anzahl = await db().query<{ n: string }>(
      "SELECT count(*)::text AS n FROM answer_records",
    );
    expect(anzahl.rows[0]?.n).toBe("2");
    const records = await db().query<{ answer_id: string }>(
      "SELECT answer_id FROM answer_records WHERE answer_id = ANY($1::text[]) ORDER BY answer_id",
      [[anna, bea]],
    );
    expect(records.rows).toHaveLength(2);
    const ids = new Set(records.rows.map((r) => r.answer_id));
    expect(ids.size, "zwei Laeufe, zwei Identitaeten").toBe(2);
    expect(ids.has(anna)).toBe(true);
    expect(ids.has(zweite.answerId)).toBe(true);

    // Global weiterhin genau zwei Snapshots; beide gehaltenen Antworten haben je Revision 1.
    const anzahlSnapshots = await db().query<{ n: string }>(
      "SELECT count(*)::text AS n FROM answer_snapshots",
    );
    expect(anzahlSnapshots.rows[0]?.n).toBe("2");
    const je = await db().query<{ answer_id: string; n: string }>(
      `SELECT answer_id, count(*)::text AS n FROM answer_snapshots
        WHERE answer_id = ANY($1::text[]) GROUP BY answer_id ORDER BY answer_id`,
      [[anna, bea]],
    );
    expect(je.rows).toHaveLength(2);
    expect(new Set(je.rows.map((r) => r.answer_id))).toEqual(new Set([anna, bea]));
    for (const r of je.rows) {
      expect(r.n).toBe("1");
    }
  });

  it("die DB-seitige Revisionsidentitaet greift — ein zweiter Snapshot derselben Revision scheitert", async () => {
    const vorhanden = await db().query<{ answer_id: string }>(
      "SELECT answer_id FROM answer_snapshots WHERE answer_id = $1 AND snapshot_revision_key = $2",
      [antwortId("anna"), "1"],
    );
    expect(vorhanden.rows).toHaveLength(1);
    const answerId = vorhanden.rows[0]?.answer_id;
    expect(answerId).toBeDefined();
    expect(answerId).toBe(antwortId("anna"));
    // GEGENPROBE am rohen SQL, ohne Adapter: derselbe Unique-Index muss weiter greifen.
    await expect(
      db().query("INSERT INTO answer_snapshots(snapshot_key,data) VALUES($1,$2::jsonb)", [
        `${answerId}@1-zweit`,
        JSON.stringify({ answerId, snapshotRevision: 1 }),
      ]),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  // Der reale Pg-Weg bindet jede Eigentums-/Evidence-Aussage an die zugehoerige Antwort.
  // Anna hat genau das Fixture getragen; Beas zweite Antwort hat bewusst keine Evidence.
  it("JOB 541 D3: der Record traegt sein Eigentum in der DATENBANK — und `system` ist kein Konto", async () => {
    for (const wer of ["anna", "bea"] as const) {
      const answerId = antwortId(wer);
      const zeilen = await db().query<{
        answer_id: string;
        im_rumpf: string;
        kind: string | null;
        user_id: string | null;
      }>(
        `SELECT answer_id, data->>'answerId' AS im_rumpf,
                data->'owner'->>'kind' AS kind, data->'owner'->>'userId' AS user_id
           FROM answer_records WHERE answer_id = $1`,
        [answerId],
      );
      expect(zeilen.rows).toHaveLength(1);
      for (const r of zeilen.rows) {
        expect(r.answer_id).toBe(answerId);
        expect(r.im_rumpf).toBe(answerId);
        expect(r.kind).toBe("user");
        expect(r.user_id).toBe(wer);
        expect(r.user_id).not.toBe("system");
      }
    }
  });

  it("JOB 541 D3: die per-Evidence-Felder stehen in der DATENBANK, das top-level Feld bleibt leer", async () => {
    for (const wer of ["anna", "bea"] as const) {
      const zeilen = await db().query<{
        answer_id: string;
        oben: string | null;
        grund: string | null;
        evidenz: AnswerEvidenceSnapshot["evidence"];
      }>(
        `SELECT answer_id, data->>'validationDecisionRef' AS oben,
                data->>'validationDecisionRefReason' AS grund, data->'evidence' AS evidenz
           FROM answer_snapshots WHERE answer_id = $1 AND snapshot_revision_key = $2`,
        [antwortId(wer), "1"],
      );
      expect(zeilen.rows).toHaveLength(1);
      for (const r of zeilen.rows) {
        expect(r.answer_id).toBe(antwortId(wer));
        expect(r.oben).toBeNull();
        expect(r.grund).toBe("w3_23_ref_liegt_je_evidence");
        expect(Array.isArray(r.evidenz)).toBe(true);
        if (wer === "anna") {
          pruefeAnnaEvidenz(r.evidenz);
        } else {
          expect(r.evidenz).toEqual([]);
        }
      }
    }
  });

  it("JOB 541 D3: der Pg-Adapter LIEST die neue Form unveraendert zurueck", async () => {
    for (const wer of ["anna", "bea"] as const) {
      const answerId = antwortId(wer);
      const zeile = await db().query<{ answer_id: string; data: AnswerEvidenceSnapshot }>(
        `SELECT answer_id, data FROM answer_snapshots
          WHERE answer_id = $1 AND snapshot_revision_key = $2`,
        [answerId, "1"],
      );
      expect(zeile.rows).toHaveLength(1);
      expect(zeile.rows[0]?.answer_id).toBe(answerId);
      // Durch den Adapter zurueck und mit genau der SQL-Zeile derselben Antwort vergleichen.
      const record = await app().answerSnapshots.findRecord(answerId);
      expect(record?.answerId).toBe(answerId);
      expect(record?.owner).toEqual({ kind: "user", userId: wer });
      const snapshot = await app().answerSnapshots.latestSnapshot(answerId);
      expect(snapshot).toBeDefined();
      if (!snapshot) {
        throw new Error(`kein Snapshot fuer ${wer}`);
      }
      expect(snapshot).toEqual(zeile.rows[0]?.data);
      expect(snapshot.answerId).toBe(answerId);
      expect(snapshot.snapshotRevision).toBe(1);
      expect(snapshot.validationDecisionRef).toBeNull();
      expect(snapshot.validationDecisionRefReason).toBe("w3_23_ref_liegt_je_evidence");
      if (wer === "anna") {
        pruefeAnnaEvidenz(snapshot.evidence);
        expect(snapshot.status).toBe("INCOMPLETE");
      } else {
        expect(snapshot.evidence).toEqual([]);
        expect(snapshot.citedSources).toEqual([]);
        expect(snapshot.status).toBe("PENDING_EVIDENCE");
      }
      // Beide echten Antworten tragen einen nachgerechneten Integritaetshash.
      expect(snapshot.integrityHash).toBe(hashAnswerSnapshot(snapshot));
    }
  });
});

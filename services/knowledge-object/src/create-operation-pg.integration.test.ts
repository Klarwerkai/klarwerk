import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../db-tx";
import { KO_CREATE_OPERATION_SCHEMA, KO_SCHEMA, PgKoRepo } from "./repo-pg";
import { KoService } from "./service";
import type { KnowledgeObject } from "./types";

// ==============================================================================================
// AUFTRAG-mega21 Block D — DER POSTGRES-BEWEIS.
// ==============================================================================================
//
// ben nennt die gemounteten Läufe aus mega20 im Wesentlichen echt, mit einer Einschränkung, die
// trägt: die Persistenz ist In-Memory und beweist den Postgres-Unique-Index NICHT. Genau dieser
// Index (`kos_create_operation_uq`) ist aber das tragende Teil der ganzen Idempotenz — der
// In-Memory-Spiegel im Repo ist eine NACHBILDUNG, und eine Nachbildung beweist nichts über das
// Original.
//
// DREI FRAGEN, die nur eine echte Datenbank beantworten kann:
//
//   1. Greift der partielle Unique-Index wirklich, und meldet Postgres die Kollision so, wie der
//      Adoptionspfad sie erwartet (23505 → CREATE_ANCHOR_TAKEN)?
//   2. Findet die Adoption das materialisierte Objekt über die ECHTE Generated-Spalte?
//   3. Und der interessante Fall: zwei GLEICHZEITIGE Anfragen mit DERSELBEN Kennung. Genau eine
//      legt an, die andere adoptiert — und keine bekommt einen rohen Datenbankfehler zu sehen.
//
// DAS MUSTER IST DAS EINGEFÜHRTE, nicht ein zweites: lokale `KLARWERK_PG_TEST_URL` hat Vorrang
// (Docker-lose Läufe), sonst Testcontainers, sonst SICHTBARER Skip mit Klartext-Grund. Die lokale
// URL läuft durch dieselbe harte Sicherung wie alle Pg-Suiten (pg-test-guard.ts) — diese Suite
// DROPPT Tabellen und darf NIE eine echte Datenbank treffen.
//
// ES GIBT KEINEN SCHREIBZUGRIFF AUF DIE PRODUKTIONSDATENBANK, weder hier noch anderswo: die Suite
// kennt ausschliesslich `KLARWERK_PG_TEST_URL` und den selbst gestarteten Container.
//
// ==============================================================================================
// AUFTRAG-mega22 Block G — NACHGEZOGEN, MIT DERSELBEN SORGFALT WIE DER URSPRÜNGLICHE BEWEIS.
// ==============================================================================================
//
// Block G macht die Eindeutigkeit ACTOR-GEBUNDEN und berührt damit genau den Index, den diese
// Suite belegt. Der Beweis läuft deshalb nicht nur weiter, er wird erweitert — zwei Änderungen:
//
//   (1) DER NEUE VERTRAG. Belegt wird jetzt „höchstens EIN Objekt je (Vorgang, EIGENTÜMER)" statt
//       „je Vorgang, DB-weit". Dazu gehört BEIDES: dass derselbe Actor kollidiert, und dass ein
//       ANDERER Actor mit derselben Kennung NICHT blockiert wird (das war die Denial-Kante).
//
//   (2) ZWEI POOLS STATT EINES GETEILTEN — bens Belegauflage. Der bisherige Parallel-Fall gab
//       beiden `KoService`-Instanzen DASSELBE `PgKoRepo` und damit denselben Pool. ben nennt den
//       Beleg dennoch grün, und das trägt: die beiden Dienste haben unabhängige `withKoLock`-
//       Zustände, und das geteilte Repo hält weder Mutex noch Cache, sondern nur den Pool.
//       Trotzdem bleibt EINE Stelle, an der ein geteiltes Objekt die Serialisierung theoretisch
//       erklären könnte. Zwei getrennte Pools schliessen sie — es kostet wenig, und „billig und
//       vollständig" schlägt „billig und fast vollständig".

function ko(id: string, over: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id,
    title: `T-${id}`,
    statement: "s",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "K",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "a",
    author: "a",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: "2026-07-26T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...over,
  };
}

const AT = "2026-07-26T00:00:00.000Z";

const BÜNDEL = [
  {
    anchor: { objectId: "obj-1", name: "Pruefbericht.pdf", mime: "application/pdf" },
    sources: [{ label: "Pruefbericht.pdf", excerpt: "Dichtung nach 500 h tauschen." }],
  },
];

const INHALT = {
  title: "Dichtungswechsel L4",
  statement: "Dichtung vor jedem Anlauf prüfen.",
  type: "best_practice" as const,
  category: "Instandhaltung",
  author: "u1",
};

describe("mega21 Block D / mega22 Block G: kos_create_operation_owner_uq gegen echtes Postgres", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let available = false;
  // AUFTRAG-mega22 Block G: die Verbindungszeichenkette wird gemerkt, damit die Mehrprozess-Fälle
  // EIGENE Pools öffnen können statt den geteilten zu benutzen (bens Belegauflage).
  let verbindung = "";

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = new Pool({ connectionString: localUrl });
        await pool.query("SELECT 1");
        verbindung = localUrl;
        available = true;
        return;
      } catch {
        process.stderr.write(
          "[KLARWERK] mega21 Block D ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
        );
        available = false;
        return;
      }
    }
    if (process.env.KLARWERK_PG_TEST_URL) {
      // Die Sicherung hat die URL abgelehnt (Grund steht auf stderr) — KEIN Container-Rückfall:
      // wer ausdrücklich eine lokale Instanz wollte, bekommt keine stille zweite.
      available = false;
      return;
    }
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      verbindung = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
      pool = new Pool({ connectionString: verbindung });
      available = true;
    } catch {
      process.stderr.write(
        "[KLARWERK] mega21 Block D ÜBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar.\n",
      );
      available = false; // kein Docker/PG → sichtbarer Skip statt Fehlschlag
    }
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  function requirePool(ctx: { skip: () => void }): Pool {
    if (!available || !pool) {
      ctx.skip();
      throw new Error("unreachable"); // ctx.skip() bricht ab; nur fürs Typing
    }
    return pool;
  }

  async function frisch(p: Pool): Promise<PgKoRepo> {
    await p.query("DROP TABLE IF EXISTS kos CASCADE");
    await p.query(KO_SCHEMA);
    await p.query(KO_CREATE_OPERATION_SCHEMA);
    return new PgKoRepo(p);
  }

  it("BESTANDS-UPGRADE + INDEX: die Migration läuft additiv auf Altzeilen und ist im Re-Run idempotent", async (ctx) => {
    const pool = requirePool(ctx);
    await pool.query("DROP TABLE IF EXISTS kos CASCADE");
    await pool.query(KO_SCHEMA);
    const repo = new PgKoRepo(pool);
    // Eine Zeile aus der Zeit VOR mega20 — sie trägt keinen Vorgang und darf keinen bekommen.
    await repo.insert(ko("alt-1"));
    await expect(pool.query(KO_CREATE_OPERATION_SCHEMA)).resolves.toBeDefined();
    await expect(pool.query(KO_CREATE_OPERATION_SCHEMA)).resolves.toBeDefined();

    const alt = await pool.query("SELECT create_operation_id FROM kos WHERE id='alt-1'");
    expect(alt.rows[0].create_operation_id).toBeNull();
    const idx = await pool.query(
      "SELECT indexdef FROM pg_indexes WHERE indexname='kos_create_operation_owner_uq'",
    );
    expect(idx.rowCount).toBe(1);
    // PARTIELL (nur wo gesetzt) und OHNE deletedAt-Ausschluss — beides ist Absicht: sonst
    // erzeugte eine Wiederholung nach dem Löschen ein zweites Objekt.
    expect(String(idx.rows[0].indexdef)).toContain("IS NOT NULL");
    expect(String(idx.rows[0].indexdef)).not.toContain("deletedAt");
    // AUFTRAG-mega22 Block G: der Index trägt den EIGENTÜMER als zweite Spalte, und der alte,
    // DB-weite ist WEG. Bliebe er stehen, wiese er weiterhin über alle Actor hinweg ab und die
    // neue Regel wäre wirkungslos — die Denial-Kante wäre nur unsichtbar geworden.
    expect(String(idx.rows[0].indexdef)).toContain("create_operation_actor");
    const alterIndex = await pool.query(
      "SELECT indexdef FROM pg_indexes WHERE indexname='kos_create_operation_uq'",
    );
    expect(alterIndex.rowCount).toBe(0);
    // Die Altzeile hat auch KEINEN Eigentümer bekommen — die Migration erfindet nichts.
    const altActor = await pool.query("SELECT create_operation_actor FROM kos WHERE id='alt-1'");
    expect(altActor.rows[0].create_operation_actor).toBeNull();
  });

  it("UNIQUE-INDEX: der zweite Insert desselben Vorgangs DESSELBEN Eigentümers kollidiert hart (23505)", async (ctx) => {
    const pool = requirePool(ctx);
    const repo = await frisch(pool);
    const vorgang = (actor: string) => ({
      createOperationId: "vorgang-1",
      createOperation: { actor, fingerprint: "fp", state: "committed" as const, at: AT },
    });
    await repo.insert(ko("ko-a", vorgang("u1")));

    // (a) DIE ROHE DB-KANTE, am Repo vorbei: der Index selbst weist ab, nicht eine Prüfung in
    //     unserem Code. Genau das war die Lücke, die eine In-Memory-Suite nicht schliessen kann.
    await expect(
      pool.query(
        `INSERT INTO kos (id, type, status, category, data) VALUES ('roh-1','best_practice','offen','K', $1::jsonb)`,
        [
          JSON.stringify({
            id: "roh-1",
            createOperationId: "vorgang-1",
            createOperation: { actor: "u1", fingerprint: "fp", state: "committed", at: AT },
          }),
        ],
      ),
    ).rejects.toMatchObject({ code: "23505", constraint: "kos_create_operation_owner_uq" });

    // (b) UND die Übersetzung, auf die der Adoptionspfad baut: der rohe SQLSTATE erreicht den
    //     Aufrufer NIE als solcher, sondern als benannter Domänenfehler.
    await expect(repo.insert(ko("ko-b", vorgang("u1")))).rejects.toMatchObject({
      code: "CREATE_ANCHOR_TAKEN",
    });

    // (c) AUFTRAG-mega22 Block G — DIE EIGENTLICHE ÄNDERUNG: ein ANDERER Eigentümer mit DERSELBEN
    //     Kennung wird NICHT abgewiesen. Das war die Denial-Kante — ein Nutzer mit `ko.create`
    //     konnte vorhersehbare Kennungen besetzen und einen anderen dauerhaft aus seinem Vorgang
    //     drängen. Der Kennungsraum ist jetzt pro Anfragendem privat.
    await expect(repo.insert(ko("ko-c", vorgang("u2")))).resolves.toBeUndefined();

    // Ohne Vorgang bleibt der Index partiell: beliebig viele Objekte.
    await repo.insert(ko("frei-1"));
    await repo.insert(ko("frei-2"));
    const count = await pool.query("SELECT count(*)::int AS n FROM kos");
    expect(count.rows[0].n).toBe(4);
  });

  it("ALTZEILEN: eine Kennung OHNE Eigentümer bleibt für sich eindeutig — und verdeckt keinen neuen Vorgang", async (ctx) => {
    // Der Altbestand (mega20: Kennung ohne Vorgangs-Datensatz) trägt im Index den leeren String als
    // Eigentümer. Zwei Wirkungen, beide gewollt und beide hier belegt.
    const pool = requirePool(ctx);
    const repo = await frisch(pool);
    await repo.insert(ko("alt-a", { createOperationId: "alt-vorgang" }));

    // (1) Zwei ALTZEILEN derselben Kennung kollidieren weiterhin — die alte Zusage bleibt für sie.
    await expect(
      repo.insert(ko("alt-b", { createOperationId: "alt-vorgang" })),
    ).rejects.toMatchObject({ code: "CREATE_ANCHOR_TAKEN" });

    // (2) Und der NACHSCHLAG findet die Altzeile für JEDEN Anfragenden — sie darf nicht unsichtbar
    //     werden, sonst entstünde zu einem Altvorgang ein zweites Objekt. Der Adoptionspfad
    //     entscheidet dann über den alten `author`-Vergleich (adoptCreatedKo, Tor 1).
    expect((await repo.findByCreateOperation("alt-vorgang", "u1"))?.id).toBe("alt-a");
    expect((await repo.findByCreateOperation("alt-vorgang", "u2"))?.id).toBe("alt-a");

    // (3) Die EXAKTE Eigentümer-Übereinstimmung hat Vorrang vor der Altzeile.
    await repo.insert(
      ko("neu-a", {
        createOperationId: "alt-vorgang",
        createOperation: { actor: "u1", fingerprint: "fp", state: "committed", at: AT },
      }),
    );
    expect((await repo.findByCreateOperation("alt-vorgang", "u1"))?.id).toBe("neu-a");
    expect((await repo.findByCreateOperation("alt-vorgang", "u2"))?.id).toBe("alt-a");
  });

  it("ADOPTION: die Wiederholung findet das materialisierte Objekt über die echte Generated-Spalte", async (ctx) => {
    const pool = requirePool(ctx);
    const repo = await frisch(pool);
    const service = new KoService({ repo });
    const vorgang = { id: "vorgang-adopt-1", actor: "u1", fingerprint: "fp-adopt-1" };

    const erst = await service.createWithDocuments(INHALT, BÜNDEL, vorgang);
    const zweit = await service.createWithDocuments(INHALT, BÜNDEL, vorgang);
    expect(zweit.id).toBe(erst.id);

    const count = await pool.query("SELECT count(*)::int AS n FROM kos");
    expect(count.rows[0].n).toBe(1);
    // Und der Nachschlag der Route liefert dasselbe — gegen die echte Spalte, nicht gegen einen
    // Prozessspeicher.
    const nachschlag = await service.lookupDocumentCreate(vorgang.id, {
      actor: "u1",
      fingerprint: "fp-adopt-1",
    });
    expect(nachschlag?.id).toBe(erst.id);

    // AUFTRAG-mega21 Block A gegen echtes Postgres: der Vorgangs-Datensatz ist mitpersistiert.
    const zeile = await pool.query("SELECT data FROM kos WHERE id=$1", [erst.id]);
    expect(zeile.rows[0].data.createOperation).toMatchObject({
      actor: "u1",
      fingerprint: "fp-adopt-1",
      state: "committed",
    });
    // AUFTRAG-mega22 Block G — UMGEDREHTE ZUSICHERUNG, unveränderte Sicherheit. Bis mega21 stand
    // hier `rejects.toMatchObject({ code: "CREATE_ANCHOR_TAKEN" })`: ein Fremder bekam einen
    // Konflikt. Seit Block G ist der Kennungsraum pro Anfragendem privat — für u2 ist diese Kennung
    // schlicht UNBEKANNT, also `null`, und u2 fährt daraufhin seinen eigenen Vorgang.
    //
    // DIE ZUSAGE, die immer die eigentliche war, steht unverändert: u2 bekommt NIE das Objekt von
    // u1. Vorher als Konflikt, jetzt als „kenne ich nicht" — beides gibt nichts preis, das zweite
    // nimmt zusätzlich die Denial-Kante weg.
    await expect(
      service.lookupDocumentCreate(vorgang.id, { actor: "u2", fingerprint: "fp-adopt-1" }),
    ).resolves.toBeNull();
    // Und geänderter Inhalt unter demselben Schlüssel liefert nicht still das alte Objekt.
    await expect(
      service.lookupDocumentCreate(vorgang.id, { actor: "u1", fingerprint: "anderer-abdruck" }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_PAYLOAD_MISMATCH" });
  });

  it("PARALLELER WIEDERHOLVERSUCH mit ZWEI POOLS: genau EINE legt an, die andere adoptiert", async (ctx) => {
    // DER INTERESSANTE FALL. Der prozessinterne Vorgangs-Lock serialisiert nur innerhalb EINES
    // KoService; zwei getrennte Dienste auf DERSELBEN Datenbank sind das ehrliche Abbild zweier
    // Server-Prozesse hinter einem Loadbalancer. Was hier trägt, ist ausschliesslich der
    // Unique-Index — und die Kollisions-Adoption, die aus ihm ein Ergebnis statt eines Fehlers macht.
    //
    // AUFTRAG-mega22 Block G (bens Belegauflage): ZWEI `PgKoRepo`-Instanzen an ZWEI EIGENEN Pools.
    // Bis mega21 teilten sich beide Dienste ein Repo und damit einen Pool. Der Beleg war schon
    // richtig — das Repo hält weder Mutex noch Cache — aber ein geteiltes Objekt blieb die letzte
    // Stelle, an der jemand die Serialisierung anders erklären könnte. Sie ist jetzt zu.
    const pool = requirePool(ctx);
    await frisch(pool);
    const poolA = new Pool({ connectionString: verbindung, max: 2 });
    const poolB = new Pool({ connectionString: verbindung, max: 2 });
    try {
      const a = new KoService({ repo: new PgKoRepo(poolA) });
      const b = new KoService({ repo: new PgKoRepo(poolB) });
      const vorgang = { id: "vorgang-parallel-1", actor: "u1", fingerprint: "fp-parallel-1" };

      const [eins, zwei] = await Promise.all([
        a.createWithDocuments(INHALT, BÜNDEL, vorgang),
        b.createWithDocuments(INHALT, BÜNDEL, vorgang),
      ]);

      // KEINE der beiden hat einen rohen Datenbankfehler gesehen — beide haben ein Wissensobjekt.
      expect(eins.id).toBe(zwei.id);
      const count = await pool.query("SELECT count(*)::int AS n FROM kos");
      expect(count.rows[0].n).toBe(1);
    } finally {
      await poolA.end();
      await poolB.end();
    }
  });

  it("ZWEI ACTOR, ZWEI POOLS, DIESELBE KENNUNG: beide gelingen — keiner drängt den anderen heraus", async (ctx) => {
    // Die Gegenprobe zum Fall darüber und der eigentliche Punkt von Block G: dieselbe Kennung,
    // verschiedene Eigentümer, echte Nebenläufigkeit über getrennte Verbindungen. Vor Block G hätte
    // hier GENAU EINER gewonnen und der andere ein `CREATE_ANCHOR_TAKEN` bekommen, ohne je etwas
    // Falsches getan zu haben.
    const pool = requirePool(ctx);
    await frisch(pool);
    const poolA = new Pool({ connectionString: verbindung, max: 2 });
    const poolB = new Pool({ connectionString: verbindung, max: 2 });
    try {
      const a = new KoService({ repo: new PgKoRepo(poolA) });
      const b = new KoService({ repo: new PgKoRepo(poolB) });

      const [eins, zwei] = await Promise.all([
        a.createWithDocuments(INHALT, BÜNDEL, {
          id: "geteilte-kennung",
          actor: "u1",
          fingerprint: "fp",
        }),
        b.createWithDocuments({ ...INHALT, author: "u2" }, BÜNDEL, {
          id: "geteilte-kennung",
          actor: "u2",
          fingerprint: "fp",
        }),
      ]);

      expect(eins.id).not.toBe(zwei.id);
      const count = await pool.query("SELECT count(*)::int AS n FROM kos");
      expect(count.rows[0].n).toBe(2);
      // Und jeder findet weiterhin GENAU SEINEN Vorgang wieder.
      expect(
        (await a.lookupDocumentCreate("geteilte-kennung", { actor: "u1", fingerprint: "fp" }))?.id,
      ).toBe(eins.id);
      expect(
        (await b.lookupDocumentCreate("geteilte-kennung", { actor: "u2", fingerprint: "fp" }))?.id,
      ).toBe(zwei.id);
    } finally {
      await poolA.end();
      await poolB.end();
    }
  });

  it("PAPIERKORB: ein getrashtes Objekt HÄLT seinen Vorgang — die Wiederholung legt kein zweites an", async (ctx) => {
    const pool = requirePool(ctx);
    const repo = await frisch(pool);
    const service = new KoService({ repo });
    const vorgang = { id: "vorgang-trash-1", actor: "u1", fingerprint: "fp-trash-1" };
    const erst = await service.createWithDocuments(INHALT, BÜNDEL, vorgang);
    await pool.query(
      `UPDATE kos SET data = data || '{"deletedAt":"2026-07-26T12:00:00.000Z"}'::jsonb WHERE id=$1`,
      [erst.id],
    );
    // Der Vorgang IST gelungen — dass jemand das Ergebnis danach in den Papierkorb gelegt hat, ist
    // eine spätere Tatsache und kein Grund, ein zweites Objekt anzulegen.
    const wieder = await service.createWithDocuments(INHALT, BÜNDEL, vorgang);
    expect(wieder.id).toBe(erst.id);
    const count = await pool.query("SELECT count(*)::int AS n FROM kos");
    expect(count.rows[0].n).toBe(1);
  });
});

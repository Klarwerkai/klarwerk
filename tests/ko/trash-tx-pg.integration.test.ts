import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app";
import { AuditService, PgAuditRepo } from "../../services/audit";
import { guardedLocalPgTestUrl, withPgTx } from "../../services/db-tx";
import {
  type KnowledgeObject,
  type KoError,
  KoService,
  PgKoRepo,
} from "../../services/knowledge-object";
// JOB 4321 RUNDE 2: der EINE konkurrenzfeste Aufbau der Trigramm-Erweiterung, den sich diese Datei
// und die Word-Abnahme teilen. Zwei Abschriften wären zwei Fassungen, und die zurückgefallene wäre
// wieder die, die den gemeinsamen Lauf abbricht. `ohneGeheimnis` bleibt bewusst doppelt (s. u.):
// dort geht es um eine Textform ohne Zustand, hier um ein Verhalten gegen dieselbe Datenbank.
import { stelleTrigrammErweiterungSicher } from "../office-pg-abnahme/rueckweg-erwartung";

// SCRUM-523 P.3 (WP-A2): beweist die repo.delete+audit.record-Atomaritäts-Invariante GEGEN ECHTES
// Postgres (Testcontainers). Die Unit-Tests in tests/ko/trash-e2e.test.ts bilden withPgTx nur über eine
// In-Memory-Fake-Transaktion nach (Commit/Rollback per Puffer-Array) — das beweist die INTENTION der
// Verdrahtung, aber nicht, dass eine ECHTE Pg-Transaktionsgrenze (BEGIN…COMMIT/ROLLBACK, Sichtbarkeit für
// andere Verbindungen erst nach COMMIT, echter Constraint-Fehler statt simuliertem throw) tatsächlich
// hält. Dieser Test hier schließt genau diese Lücke.
// Lauf: `npm run test:integration`. Aus dem schnellen Gate ausgeschlossen (s. vitest.integration.config.ts,
// Include-Pattern "*.integration.test.ts").
//
// ================================================================================================
// JOB 4321 — DIESE DATEI STARTETE AUF DEM PRÜFPLATZ GAR NICHT ERST.
// ================================================================================================
//
// Bis hierher stand im `beforeAll` ohne jede Sicherung `new GenericContainer("postgres:16-alpine")
// … .start()`. Auf dem Cloud-Prüfplatz gibt es keine Container-Laufzeit, sondern einen lokalen
// Wegwerfcluster, dessen URL in `KLARWERK_PG_TEST_URL` steht: dort WARF diese Datei in `beforeAll`
// und riss den gemeinsamen Lauf `--config vitest.integration.config.ts` rot — aus einem Grund, der
// mit dem Produkt nichts zu tun hat. Ausgerechnet sie belegt die Atomarität von
// `repo.delete + audit.record`.
//
// Es gilt jetzt EINE Auswahlreihenfolge, wörtlich die des Hauses nach JOB 4299
// (`services/app/src/build-app.integration.test.ts:53-116`): lokale URL über die GELB-Sicherung mit
// Vorrang — wurde eine ausdrücklich genannte URL abgelehnt, gibt es KEINEN stillen Container-
// Rückfall —, sonst Testcontainers, sonst ein SICHTBARER Skip mit Grund. Der reine Containerweg
// verschwindet als eigener Startweg; ein zweiter bleibt nicht daneben stehen.
//
// UND DIE GRENZE DES SKIPS LIEGT AM VERBINDUNGSNACHWEIS. Übersprungen wird NUR die fehlende
// Voraussetzung „keine Datenbank erreichbar" — das ist eine Aussage über die Maschine. Erweiterung,
// Schema und `migrate()` laufen DANACH ungefangen: ein kaputter Aufbau ist eine Aussage über das
// PRODUKT und färbt rot, statt als „skipped" wie ein bestandener Lauf auszusehen (Lehre JOB 4299 R1,
// Korrekturpflicht 2).
//
// EINE EIGENE ECKE, AUS DEMSELBEN GRUND WIE DORT. Der Wegwerfcluster ist EINE Instanz für ALLE
// Dateien des Integrationslaufs, und die laufen parallel. Diese Datei liest `audit` vollständig
// (`auditRepo.all()`) und stützt Fall (b) auf `last().seq` — genau die Tabelle, die
// `services/audit/src/repo-pg.integration.test.ts` in `public` DROPPT. Gegen einen eigenen Container
// war das nie sichtbar; gegen den geteilten Cluster wäre es ein Wettlauf. Der eigene `search_path`
// gibt dieser Datei ihre Alleinlage zurück, ohne eine zweite Datenbank zu verlangen. Die fachlichen
// Zusicherungen der fünf Fälle bleiben dabei Zeichen für Zeichen, wie sie waren.
const EIGENES_SCHEMA = "job4321_trashtx";

/** GELAUFEN mit Quelle oder ÜBERSPRUNGEN mit Grund — `undefined` heißt: `beforeAll` lief nicht. */
type Laufzustand =
  | { readonly gelaufen: true; readonly quelle: string }
  | { readonly gelaufen: false; readonly grund: string };

/**
 * Die Quelle darf genannt werden, das Passwort nicht — dieselbe Regel und dieselbe Form wie in
 * `tests/office-pg-abnahme/rueckweg-pg.integration.test.ts:100-105`. Sie steht hier noch einmal,
 * weil jene Fassung in einer Testdatei liegt und nichts exportiert; ein Import quer durch die
 * Prüfordner wäre eine Kopplung, die dieser Datei nichts gibt.
 */
function ohneGeheimnis(url: string): string {
  return url.replace(/:\/\/([^/@]*)@/, (_treffer, anmeldedaten: string) => {
    const benutzer = anmeldedaten.split(":")[0] ?? "";
    return `://${benutzer}:***@`;
  });
}

describe("SCRUM-523 P.3 (WP-A2): repo.delete + audit.record — echte Pg-Transaktion", () => {
  let container: StartedTestContainer | undefined;
  /** Die blanke Verbindung — sie verwaltet nur das Schema. */
  let verwaltung: Pool | undefined;
  /** Der Pool der Fälle, fest an `EIGENES_SCHEMA` gehängt. */
  let pool: Pool | undefined;
  let laufzustand: Laufzustand | undefined;
  let gemeldet = false;

  /** Schreibt den Zustand genau einmal sichtbar auf stderr. */
  function meldeLaufzustand(): void {
    if (gemeldet) {
      return;
    }
    gemeldet = true;
    const z = laufzustand;
    if (!z) {
      process.stderr.write(
        "[KLARWERK][JOB 4321] Trash-Tx-Pg-Integrationstest: KEIN LAUFZUSTAND — beforeAll lief nicht durch.\n",
      );
    } else if (z.gelaufen) {
      process.stderr.write(
        `[KLARWERK][JOB 4321] Trash-Tx-Pg-Integrationstest GELAUFEN gegen ${z.quelle}.\n`,
      );
    } else {
      process.stderr.write(
        `[KLARWERK][JOB 4321] Trash-Tx-Pg-Integrationstest ÜBERSPRUNGEN — Grund: ${z.grund}. Die fünf Atomaritäts-Zusicherungen wurden NICHT geprüft.\n`,
      );
    }
  }

  beforeAll(async () => {
    let url = "";
    let quelle = "";
    let grund = "";
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      url = lokal;
      quelle = `lokale Testinstanz · ${ohneGeheimnis(lokal)}`;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      // Die Sicherung hat die URL abgelehnt (Grund steht auf stderr) — KEIN Container-Rückfall:
      // wer ausdrücklich eine lokale Instanz wollte, bekommt keine stille zweite.
      grund = "KLARWERK_PG_TEST_URL wurde von der Testdatenbank-Sicherung abgelehnt";
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
        quelle = `Testcontainer postgres:16-alpine · ${ohneGeheimnis(url)}`;
      } catch (fehler) {
        grund = `weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar: ${String(fehler)}`;
      }
    }
    if (url) {
      verwaltung = createPool(url);
      let erreichbar = false;
      try {
        await verwaltung.query("SELECT 1");
        erreichbar = true;
      } catch (fehler) {
        grund = `Datenbank unter der genannten URL nicht erreichbar: ${String(fehler)}`;
      }
      if (erreichbar) {
        // AB HIER WIRD NICHTS MEHR GEFANGEN: jeder Fehler fliegt aus `beforeAll` und färbt rot.
        //
        // Die Trigramm-Erweiterung gehört nach `public`: `KO_SCHEMA` legt sie mit `IF NOT EXISTS`
        // an, und das landet sonst im Wegwerfschema und verschwindet mit ihm.
        //
        // JOB 4321 RUNDE 2 — ÜBER DEN GEMEINSAMEN WEG, NICHT MIT EIGENER ANWEISUNG. Hier stand
        // `verwaltung.query("CREATE EXTENSION IF NOT EXISTS pg_trgm")`. Gegen eine Instanz, die die
        // Erweiterung noch nicht trug, lief das mit der gleichlautenden Zeile in
        // `tests/office-pg-abnahme/rueckweg-pg.integration.test.ts` um die Wette; die Verliererin
        // fiel mit `pg_extension_name_index` aus und riss ihre Suite ab (BEN Runde 1). Begründung
        // und Nachweis: `stelleTrigrammErweiterungSicher` bzw. Q7 der Word-Abnahme.
        await stelleTrigrammErweiterungSicher(verwaltung);
        await verwaltung.query(`DROP SCHEMA IF EXISTS ${EIGENES_SCHEMA} CASCADE`);
        await verwaltung.query(`CREATE SCHEMA ${EIGENES_SCHEMA}`);
        pool = new Pool({
          connectionString: url,
          options: `-c search_path=${EIGENES_SCHEMA},public`,
        });
        await migrate(pool);
        laufzustand = { gelaufen: true, quelle: `${quelle} (Schema ${EIGENES_SCHEMA})` };
      }
    }
    if (!pool) {
      laufzustand = { gelaufen: false, grund };
    }
    meldeLaufzustand();
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    // Aufräumen darf den Lauf nicht nachträglich rot färben: fällt der Cluster vorher weg, ist das
    // kein Befund über das Produkt.
    await verwaltung
      ?.query(`DROP SCHEMA IF EXISTS ${EIGENES_SCHEMA} CASCADE`)
      .catch(() => undefined);
    await verwaltung?.end();
    await container?.stop();
  });

  function requirePool(ctx: { skip: () => void }): Pool {
    if (!pool) {
      meldeLaufzustand(); // kein Skip mehr ohne sichtbaren Grund
      ctx.skip();
      throw new Error("unreachable"); // ctx.skip() bricht ab; nur fürs Typing
    }
    return pool;
  }

  // ----------------------------------------------------------------------------------------------
  // JOB 4321 · DER ZEUGE — er ruft NIE `requirePool` und macht in JEDEM Lauf eine Aussage.
  // ----------------------------------------------------------------------------------------------
  // Er färbt eine Maschine ohne Datenbank NICHT rot: beide Zustände sind erlaubt. Verlangt ist nur,
  // dass der Lauf sagt, welcher von beiden vorliegt — und dass die Behauptung zur Wirklichkeit passt.
  // Ohne ihn sind „fünf Zusicherungen geprüft" und „fünf Zusicherungen übersprungen" dasselbe Bild.
  it("JOB 4321 · der Lauf bezeugt seinen eigenen Zustand — übersprungen ist von gelaufen unterscheidbar", async () => {
    meldeLaufzustand();

    expect(
      laufzustand,
      "beforeAll hat keinen Laufzustand hinterlassen — ein Lauf ohne Zustandsaussage sieht aus wie " +
        "ein bestandener und darf nicht als Grün durchgehen.",
    ).toBeDefined();
    const zustand = laufzustand as Laufzustand;

    if (zustand.gelaufen) {
      expect(zustand.quelle.trim().length).toBeGreaterThan(0);
      expect(pool, "GELAUFEN ohne Pool wäre eine leere Behauptung").toBeDefined();
      // Und der Datenraum steht wirklich: eine Quelle ohne migrierte Tabellen hätte nichts gemessen.
      await expect(
        (pool as Pool).query("SELECT count(*)::int AS n FROM audit"),
      ).resolves.toBeDefined();
    } else {
      expect(pool).toBeUndefined();
      expect(
        zustand.grund.trim().length,
        "ÜBERSPRUNGEN ohne Grund ist wieder der stumme Lauf",
      ).toBeGreaterThan(0);
    }
  });

  async function seedKo(koRepo: PgKoRepo, audit: AuditService): Promise<KnowledgeObject> {
    const service = new KoService({ repo: koRepo, audit });
    return service.create({
      title: "Tx-Integrationstest",
      statement: "beweist echte Postgres-Transaktionsgrenzen",
      type: "best_practice",
      category: "A",
      author: "erik",
    });
  }

  it("Erfolgsfall: delete + audit.record committen gemeinsam sichtbar", async (ctx) => {
    const pool = requirePool(ctx);
    const koRepo = new PgKoRepo(pool);
    const auditRepo = new PgAuditRepo(pool);
    const audit = new AuditService({ repo: auditRepo });
    const ko = await seedKo(koRepo, audit);

    await withPgTx(pool, async (tx) => {
      await koRepo.delete(ko.id, tx);
      await audit.record(
        { actor: "admin", action: "ko.purged", target: ko.id, payload: { reason: "hard" } },
        tx,
      );
    });

    expect(await koRepo.findById(ko.id)).toBeUndefined();
    const entries = (await auditRepo.all()).filter(
      (e) => e.action === "ko.purged" && e.target === ko.id,
    );
    expect(entries).toHaveLength(1);
  });

  it("(a) scheitert die Transaktion NACH repo.delete + audit.record, VOR dem COMMIT: ECHTES ROLLBACK — KO bleibt, kein Audit-Eintrag", async (ctx) => {
    const pool = requirePool(ctx);
    const koRepo = new PgKoRepo(pool);
    const auditRepo = new PgAuditRepo(pool);
    const audit = new AuditService({ repo: auditRepo });
    const ko = await seedKo(koRepo, audit);

    await expect(
      withPgTx(pool, async (tx) => {
        // Beide Schreibungen laufen INNERHALB der noch offenen Transaktion (derselbe Pg-Client) —
        // der anschließende throw verhindert den COMMIT. Beweist: ein bereits AUSGEFÜHRTES Delete UND
        // ein bereits ausgeführter Audit-Insert werden gemeinsam zurückgerollt, sobald IRGENDETWAS in
        // derselben Transaktion danach scheitert (unabhängig vom Auslöser).
        await koRepo.delete(ko.id, tx);
        await audit.record({ actor: "admin", action: "ko.purged", target: ko.id, payload: {} }, tx);
        throw new Error("simulierter Absturz vor COMMIT");
      }),
    ).rejects.toThrow("simulierter Absturz vor COMMIT");

    expect(await koRepo.findById(ko.id)).toBeDefined();
    const entries = (await auditRepo.all()).filter(
      (e) => e.action === "ko.purged" && e.target === ko.id,
    );
    expect(entries).toHaveLength(0);
  });

  it("(b) scheitert audit.append INNERHALB der Transaktion an einem ECHTEN Pg-Constraint-Fehler: repo.delete bleibt unsichtbar (ROLLBACK) — genau die Richtung, die WP-A nicht bewies", async (ctx) => {
    const pool = requirePool(ctx);
    const koRepo = new PgKoRepo(pool);
    const auditRepo = new PgAuditRepo(pool);
    const audit = new AuditService({ repo: auditRepo });
    const ko = await seedKo(koRepo, audit);

    // seedKo hat bereits einen ko.created-Eintrag (seq=1) committet. Ein manueller INSERT mit
    // DEMSELBEN seq verletzt den Primärschlüssel — ein echter Datenbankfehler, kein simuliertes throw.
    const last = await auditRepo.last();
    const duplicateSeq = last?.seq ?? 1;

    await expect(
      withPgTx(pool, async (tx) => {
        await koRepo.delete(ko.id, tx);
        await auditRepo.append(
          {
            seq: duplicateSeq,
            at: new Date(0).toISOString(),
            actor: "admin",
            action: "ko.purged",
            target: ko.id,
            payload: {},
            prevHash: "x",
            hash: "y",
          },
          tx,
        );
      }),
    ).rejects.toThrow();

    // repo.delete lief im Code VOR dem gescheiterten audit.append, in DERSELBEN, noch offenen
    // Transaktion — Postgres rollt trotzdem BEIDE Schreibungen zurück. Das KO ist unverändert da.
    expect(await koRepo.findById(ko.id)).toBeDefined();
    const purged = (await auditRepo.all()).filter(
      (e) => e.action === "ko.purged" && e.target === ko.id,
    );
    expect(purged).toHaveLength(0);
  });

  // SCRUM-523 P.3 (WP-A3, externer Review "ben"): PgKoRepo.delete prüfte rowCount bislang NICHT — ein
  // wiederholter/konkurrierender Purge (0 gelöschte Zeilen) konnte trotzdem committen, WEIL delete()
  // stillschweigend erfolgreich zurückkehrte, obwohl es nichts gelöscht hat ("Audit ohne echtes
  // Delete"). Die beiden folgenden Tests beweisen GEGEN ECHTES Postgres, dass ein 0-Zeilen-Delete jetzt
  // NOT_FOUND wirft und (weil es INNERHALB derselben withPgTx-Klammer wie audit.record läuft) die ganze
  // Transaktion zurückrollt — es kann also kein zweiter/geisterhafter ko.purged-Beleg mehr entstehen.
  it("(d) wiederholter Purge desselben KO: zweiter Versuch scheitert kontrolliert (NOT_FOUND), kein zweiter ko.purged-Beleg", async (ctx) => {
    const pool = requirePool(ctx);
    const koRepo = new PgKoRepo(pool);
    const auditRepo = new PgAuditRepo(pool);
    const audit = new AuditService({ repo: auditRepo });
    const ko = await seedKo(koRepo, audit);

    // Erster Purge — gelingt, genau EIN Beleg.
    await withPgTx(pool, async (tx) => {
      await koRepo.delete(ko.id, tx);
      await audit.record({ actor: "admin", action: "ko.purged", target: ko.id, payload: {} }, tx);
    });
    expect(await koRepo.findById(ko.id)).toBeUndefined();
    expect(
      (await auditRepo.all()).filter((e) => e.action === "ko.purged" && e.target === ko.id),
    ).toHaveLength(1);

    // Zweiter Versuch auf DASSELBE (bereits gelöschte) KO — z. B. ein konkurrierender oder erneut
    // ausgelöster Purge-Chokepoint-Aufruf. Das DELETE trifft 0 Zeilen → PgKoRepo.delete wirft NOT_FOUND,
    // BEVOR audit.record überhaupt läuft (Reihenfolge im Chokepoint: delete zuerst, s. service.ts
    // purgeKo). Selbst wenn audit.record liefe, würde derselbe Rollback-Mechanismus greifen.
    await expect(
      withPgTx(pool, async (tx) => {
        await koRepo.delete(ko.id, tx);
        await audit.record({ actor: "admin", action: "ko.purged", target: ko.id, payload: {} }, tx);
      }),
    ).rejects.toMatchObject({ name: "KoError", code: "NOT_FOUND" } satisfies Partial<KoError>);

    // Kein zweiter Beleg — die zweite (Rollback-)Transaktion hat NICHTS committet.
    expect(await koRepo.findById(ko.id)).toBeUndefined();
    expect(
      (await auditRepo.all()).filter((e) => e.action === "ko.purged" && e.target === ko.id),
    ).toHaveLength(1);
  });

  it("(e) delete trifft 0 Zeilen (KO existiert nicht/nicht mehr): Transaktion rollt zurück, kein Audit-Eintrag entsteht", async (ctx) => {
    const pool = requirePool(ctx);
    const koRepo = new PgKoRepo(pool);
    const auditRepo = new PgAuditRepo(pool);
    const audit = new AuditService({ repo: auditRepo });

    // KEIN seedKo — die id existiert in `kos` nie. Bildet z. B. eine bereits abgeschlossene Endlöschung
    // (Sweep) nach, gegen die ein zweiter, zeitgleich gestarteter Aufrufer antritt.
    const ghostId = "ghost-nonexistent-ko";

    await expect(
      withPgTx(pool, async (tx) => {
        await koRepo.delete(ghostId, tx);
        await audit.record(
          { actor: "system", action: "ko.purged", target: ghostId, payload: {} },
          tx,
        );
      }),
    ).rejects.toMatchObject({ name: "KoError", code: "NOT_FOUND" } satisfies Partial<KoError>);

    expect(
      (await auditRepo.all()).filter((e) => e.action === "ko.purged" && e.target === ghostId),
    ).toHaveLength(0);
  });
});

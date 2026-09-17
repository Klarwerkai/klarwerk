// ==================================================================================================
// JOB 4085 · ABNAHME 2 — DERSELBE RÜCKWEG AUS WORD, GEGEN ECHTES POSTGRESQL.
// ==================================================================================================
//
// WARUM ES DIESE DATEI BRAUCHT: `tests/word-rueckweg/rumpf-erhalt.test.ts` misst die Übernahme eines
// Vorschlags an der echten Route — aber gegen die SPEICHERablage. Der Fließtext eines Vorschlags ist
// ein Feld im JSON-Dokument des Wissensobjekts (`data`-Spalte, `PgKoRepo`), und ein Vorschlag aus
// Word trägt seit JOB 4085 eingebettete Bilder als `data:image/...;base64,…`. Ob dieses Dokument die
// Runde durch PostgreSQL unversehrt übersteht — schreiben, übernehmen, und nach einem NEUEN
// Verbindungsaufbau wieder herauslesen —, sagt die Speicherablage nicht.
//
// DER PRÜFER ZU JOB 3667 R9 FÜHRT GENAU DAS ALS LÜCKE (`LEHREN.md`, 2026-09-15T02:37:51, Abschnitt
// NICHT GEPRÜFT: „keine reale Office- oder PostgreSQL-Abnahme"). Diese Datei schliesst die zweite
// Hälfte; die erste steht in `echte-worddatei-am-rueckweg.test.ts`.
//
// WAS HIER NICHT NOCH EINMAL STEHT: `services/knowledge-object/src/repo-pg.integration.test.ts`
// misst gegen dasselbe PostgreSQL den IMPORT-ANKER (`kos_import_candidate_uq`) — Bestands-Upgrade,
// Unique-Kollision, Trash. Über Vorschläge, ihren Fließtext und die Übernahme steht dort nichts.
// Eine zweite Fassung vorhandener Fälle wäre keine Abnahme; diese Datei fährt nur, was fehlt, und
// ändert `services/knowledge-object/src/**` nicht — sie importiert von dort.
//
// STATUS IN DIESER UMGEBUNG: s. RUECKGABE.md, Abschnitt PRUEFUNGEN. Ein übersprungener Lauf ist
// KEINE bestandene Abnahme — der Skip steht deshalb SICHTBAR auf stderr, mit Jobnummer und Grund.
// Ein stiller Skip sähe aus wie ein grüner Lauf.
//
// SIE IST STARTBAR, ohne dass eine Zeile geändert werden muss:
//
//     KLARWERK_PG_TEST_URL=postgres://user:pass@127.0.0.1:5432/klarwerk_test \
//       npx vitest run --config vitest.integration.config.ts \
//       tests/office-pg-abnahme/rueckweg-pg.integration.test.ts
//
// Der Datenbankname MUSS `test` enthalten — `guardedLocalPgTestUrl` weist sonst ab
// (`services/db-tx/src/pg-test-guard.ts`), weil diese Suite eine Tabelle anlegt und abräumt.
//
// DAS GERÜST IST DAS EINGEFÜHRTE, nicht ein zweites: lokale URL mit Vorrang, sonst Testcontainers,
// sonst sichtbarer Skip — wörtlich wie `tests/entwurfs-papierkorb/papierkorb-pg.integration.test.ts`.
//
// ================================================================================================
// JOB 4299 — DREI ERGÄNZUNGEN, UND JEDE SCHLIESST EINE GEMESSENE LÜCKE.
// ================================================================================================
//
// 1. DER ZEUGE (`Laufzustand`). Bis hierher schrieb diese Datei ihre Skip-Gründe zwar auf stderr,
//    aber KEIN Fall behauptete den Laufzustand. Wer nur stdout las, sah „3 skipped" und wusste
//    nicht, ob je eine Datenbank erreicht wurde — ein übersprungener Lauf war von einem echten
//    nicht zu unterscheiden. Das Haus hat die Antwort seit A-1303:
//    `services/audit/src/repo-pg.integration.test.ts:21-32,38-52`. Sie steht jetzt auch hier.
//
// 2. Q4 · RECHTE und 3. Q5 · KONFLIKT. In der ganzen Datei kam genau ein Handelnder vor
//    („admin-1"), und `expectedVersion: 1` stand dreimal ohne zweiten Entscheider. Rechte und
//    Konfliktverhalten waren gegen die echte Ablage damit unbelegt. Beide Fälle fahren die ECHTE
//    Route (`buildApp(buildPgServices(pool))`, echtes register/login) — eine Rechteprüfung sitzt in
//    `requirePermission` und nicht im Dienst; ein Dienstaufruf mit erfundener Kennung belegt
//    über Rechte nichts.
//
// WARUM Q4/Q5 EIN EIGENES DATENBANKSCHEMA NEHMEN. Sie brauchen eine LEERE Nutzerablage: nur das
// erste Konto wird Admin (FR-AUTH-01), und nur ein Admin darf heute entscheiden. Ein `DELETE FROM
// users` auf `public` träfe `services/app/src/build-app.integration.test.ts`, das im selben
// Integrationslauf gegen dieselbe Instanz arbeitet. Jeder der beiden Fälle legt sich deshalb ein
// eigenes, am Ende wieder abgeräumtes Schema an und hängt seinen Pool über `search_path` hinein —
// dieselbe Datenbank, derselbe Wächter, kein fremder Bestand.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { migrate } from "../../services/app/src/db";
import { type AuditEntry, GENESIS, PgAuditRepo, hashEntryFuerVersion } from "../../services/audit";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { KO_SCHEMA, PgKoRepo } from "../../services/knowledge-object/src/repo-pg";
import { KoService } from "../../services/knowledge-object/src/service";
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";
import { TRUST_MAX } from "../../services/validation/src/trust";
import { type WordAuswahl, echteWordAuswahl } from "./echte-word-auswahl";
import {
  BESTAND_RUMPF,
  BESTAND_SATZ,
  EINREICHER,
  ENTSCHEIDER,
  Q4,
  Q5,
  Q6,
  ZWEITER_EINREICHER,
  anmeldung,
  anmeldungMitKennung,
  bestandsObjekt,
  entscheide,
  istGleichzeitigeTrgmAnlage,
  reicheVorschlagEin,
  richteKontenEin,
  stelleTrigrammErweiterungSicher,
  vorschlagAus,
} from "./rueckweg-erwartung";

/** GELAUFEN mit Quelle oder ÜBERSPRUNGEN mit Grund — `undefined` heißt: `beforeAll` lief nicht. */
type Laufzustand =
  | { readonly gelaufen: true; readonly quelle: string }
  | { readonly gelaufen: false; readonly grund: string };

/**
 * Die Quelle darf genannt werden, das Passwort nicht.
 *
 * Die stderr-Zeile des Zeugen MUSS sagen, gegen welche Datenbank gemessen wurde — sonst ist sie
 * keine Auskunft. Ein Zugangswort gehört dabei in kein Protokoll, auch nicht das einer
 * Wegwerfinstanz.
 */
function ohneGeheimnis(url: string): string {
  return url.replace(/:\/\/([^/@]*)@/, (_treffer, anmeldedaten: string) => {
    const benutzer = anmeldedaten.split(":")[0] ?? "";
    return `://${benutzer}:***@`;
  });
}

/** Die eigene Ecke für Q1–Q3 (nur `kos`). */
const ABNAHME_SCHEMA = "job4299_abnahme";

describe("JOB 4085 · der Word-Rückweg gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  /** Die BLANKE Verbindung — sie verwaltet nur Schemata, sie hält keinen Prüfbestand. */
  let pool: Pool | undefined;
  /** Der Pool von Q1–Q3, fest an `ABNAHME_SCHEMA` gehängt. */
  let abnahme: Pool | undefined;
  let verbindung = "";
  let verfuegbar = false;
  let auswahl: WordAuswahl | undefined;
  let laufzustand: Laufzustand | undefined;
  let gemeldet = false;
  const eigeneSchemata: { name: string; pool: Pool }[] = [];

  /** Schreibt den Zustand genau einmal sichtbar auf stderr. */
  function meldeLaufzustand(): void {
    if (gemeldet) {
      return;
    }
    gemeldet = true;
    const z = laufzustand;
    if (!z) {
      process.stderr.write(
        "[KLARWERK][JOB 4299] Word-Rückweg-Pg-Abnahme: KEIN LAUFZUSTAND — beforeAll lief nicht durch.\n",
      );
    } else if (z.gelaufen) {
      process.stderr.write(
        `[KLARWERK][JOB 4299] Word-Rückweg-Pg-Abnahme GELAUFEN gegen ${z.quelle}.\n`,
      );
    } else {
      process.stderr.write(
        `[KLARWERK][JOB 4299] Word-Rückweg-Pg-Abnahme ÜBERSPRUNGEN — Grund: ${z.grund}. Q1–Q7 wurden NICHT geprüft.\n`,
      );
    }
  }

  // ----------------------------------------------------------------------------------------------
  // JOB 4299 · DIE EIGENE ECKE DERSELBEN DATENBANK.
  // ----------------------------------------------------------------------------------------------
  // `search_path=<schema>,public` hängt JEDE Verbindung des Pools in das Wegwerfschema; `public`
  // bleibt hinten dran, damit die dort angelegte Trigramm-Erweiterung gefunden wird. Diese Datei
  // fasst danach KEINE Tabelle in `public` mehr an — der frühere `DROP TABLE kos CASCADE` traf
  // dieselbe `kos`, mit der `services/app/src/build-app.integration.test.ts` und
  // `services/knowledge-object/src/repo-pg-kandidaten.integration.test.ts` im gemeinsamen
  // Integrationslauf arbeiten.
  function imSchema(name: string): { connectionString: string; options: string } {
    return { connectionString: verbindung, options: `-c search_path=${name},public` };
  }

  async function frischesSchema(name: string): Promise<Pool> {
    const basis = pool as Pool;
    await basis.query(`DROP SCHEMA IF EXISTS ${name} CASCADE`);
    await basis.query(`CREATE SCHEMA ${name}`);
    const eigen = new Pool(imSchema(name));
    eigeneSchemata.push({ name, pool: eigen });
    return eigen;
  }

  /** Wie oben, aber mit dem GANZEN Datenraum der App — Q4 und Q5 brauchen Nutzer und Sitzungen. */
  async function frischesAppSchema(name: string): Promise<Pool> {
    const eigen = await frischesSchema(name);
    await migrate(eigen);
    return eigen;
  }

  beforeAll(async () => {
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      try {
        verbindung = lokal;
        pool = new Pool({ connectionString: lokal });
        await pool.query("SELECT 1");
        verfuegbar = true;
        laufzustand = { gelaufen: true, quelle: ohneGeheimnis(lokal) };
      } catch {
        process.stderr.write(
          "[KLARWERK] JOB 4085 ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
        );
        verfuegbar = false;
        laufzustand = {
          gelaufen: false,
          grund: "KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich",
        };
      }
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      // Die Sicherung hat die URL abgelehnt (Grund steht auf stderr) — KEIN Container-Rückfall:
      // wer ausdrücklich eine lokale Instanz wollte, bekommt keine stille zweite.
      verfuegbar = false;
      laufzustand = {
        gelaufen: false,
        grund:
          "KLARWERK_PG_TEST_URL von der Testdatenbank-Sicherung abgelehnt (Grund steht auf stderr)",
      };
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        verbindung = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
        pool = new Pool({ connectionString: verbindung });
        verfuegbar = true;
        laufzustand = {
          gelaufen: true,
          quelle: `Testcontainer postgres:16-alpine · ${ohneGeheimnis(verbindung)}`,
        };
      } catch {
        process.stderr.write(
          "[KLARWERK] JOB 4085 ÜBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar.\n",
        );
        verfuegbar = false;
        laufzustand = {
          gelaufen: false,
          grund: "weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar",
        };
      }
    }
    if (verfuegbar && pool) {
      // Die Trigramm-Erweiterung gehört nach `public` und nirgendwo sonst: `KO_SCHEMA` legt sie mit
      // `IF NOT EXISTS` an, und das landet im ERSTEN Schema des `search_path`. Entstünde sie in
      // einem der Wegwerfschemata unten, verschwände sie mit ihm — und ein anderer Lauf derselben
      // Instanz fände `gin_trgm_ops` nicht mehr. Deshalb einmal hier, auf der blanken Verbindung.
      //
      // JOB 4321 RUNDE 2: und zwar über den gemeinsamen, konkurrenzfesten Weg. Hier stand
      // `pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm")`, und genau daran brach der gemeinsame
      // Lauf gegen eine frische Instanz ab, weil `tests/ko/trash-tx-pg.integration.test.ts` im selben
      // Augenblick dasselbe tat (BEN Runde 1). Der Grund und die beiden Schichten stehen bei
      // `stelleTrigrammErweiterungSicher`; Q7 unten misst beide Richtungen.
      await stelleTrigrammErweiterungSicher(pool);
      abnahme = await frischesSchema(ABNAHME_SCHEMA);
      await abnahme.query(KO_SCHEMA);
      // Dieselbe Word-Markierung wie ABNAHME 1 — echte `.docx`, produktiver Extraktor, echte Bilder.
      auswahl = await echteWordAuswahl();
    }
    meldeLaufzustand();
  }, 180_000);

  afterAll(async () => {
    for (const eigen of eigeneSchemata) {
      await eigen.pool.end();
      await pool?.query(`DROP SCHEMA IF EXISTS ${eigen.name} CASCADE`);
    }
    await pool?.end();
    await container?.stop();
  });

  // ----------------------------------------------------------------------------------------------
  // JOB 4299 · DER ZEUGE — er ruft NIE `ctx.skip()` und macht in JEDEM Lauf eine Aussage.
  // ----------------------------------------------------------------------------------------------
  // Er färbt eine Maschine ohne Datenbank NICHT rot: beide Zustände sind erlaubt. Verlangt ist nur,
  // dass der Lauf sagt, welcher vorliegt — und dass die Behauptung zur Wirklichkeit passt.
  it("JOB 4299 · der Lauf bezeugt seinen eigenen Zustand — übersprungen ist von gelaufen unterscheidbar", async () => {
    meldeLaufzustand();

    expect(
      laufzustand,
      "beforeAll hat keinen Laufzustand hinterlassen — ein Lauf ohne Zustandsaussage sieht aus wie " +
        "ein bestandener und darf nicht als Grün durchgehen.",
    ).toBeDefined();
    const zustand = laufzustand as Laufzustand;

    if (zustand.gelaufen) {
      expect(verfuegbar).toBe(true);
      expect(zustand.quelle.trim().length).toBeGreaterThan(0);
      expect(pool, "GELAUFEN ohne Pool wäre eine leere Behauptung").toBeDefined();
      await expect((pool as Pool).query("SELECT 1")).resolves.toBeDefined();
      // Und die Prüfecke steht wirklich: eine Quelle ohne Tabelle hätte nichts gemessen.
      expect(abnahme, "GELAUFEN ohne eigenes Prüfschema wäre eine leere Behauptung").toBeDefined();
      await expect(
        (abnahme as Pool).query("SELECT count(*)::int AS n FROM kos"),
      ).resolves.toBeDefined();
    } else {
      expect(verfuegbar).toBe(false);
      expect(
        zustand.grund.trim().length,
        "ÜBERSPRUNGEN ohne Grund ist wieder der stumme Lauf",
      ).toBeGreaterThan(0);
    }
  });

  /**
   * DAS ZURÜCKLESEN NACH NEUEM VERBINDUNGSAUFBAU — der Punkt dieser Abnahme.
   *
   * Ein Lesen über denselben Pool könnte einen Wert zeigen, der nie in der Datenbank ankam (Cache,
   * offene Transaktion, Zustand im Prozess). Eine FRISCHE Verbindung mit einem FRISCHEN Adapter
   * kennt nur, was wirklich gespeichert ist.
   */
  async function nachNeuerVerbindung(id: string): Promise<KnowledgeObject | undefined> {
    return nachNeuerVerbindungIm(ABNAHME_SCHEMA, id);
  }

  async function leeren(): Promise<void> {
    await (abnahme as Pool).query("DELETE FROM kos");
  }

  /** Dasselbe Zurücklesen, in der eigenen Ecke: FRISCHE Verbindung, frischer Adapter. */
  async function nachNeuerVerbindungIm(
    name: string,
    id: string,
  ): Promise<KnowledgeObject | undefined> {
    const zweiter = new Pool(imSchema(name));
    try {
      return await new PgKoRepo(zweiter).findById(id);
    } finally {
      await zweiter.end();
    }
  }

  it("Q1 · der Vorschlag AUS WORD trägt seine Bilder durch PostgreSQL — geschrieben, übernommen, neu gelesen", async (ctx) => {
    if (!verfuegbar || !auswahl) {
      ctx.skip();
      return;
    }
    await leeren();
    const repo = new PgKoRepo(abnahme as Pool);
    await repo.insert(bestandsObjekt("ko-word", BESTAND_RUMPF));
    const service = new KoService({ repo });

    // 1) EINREICHEN — genau die vier Felder, die das Aufgabenfenster seit JOB 4085 absetzt.
    const eingereicht = await service.addProposal("ko-word", "experte-1", {
      statement: "Bei Überdruck ist Ventil X unverzüglich von Hand zu schließen.",
      bodyHtml: auswahl.html,
      baseVersion: 1,
      origin: "word_addin",
    });
    expect(eingereicht.proposal.status).toBe("offen");

    // SOLANGE NIEMAND ENTSCHIEDEN HAT, ÄNDERT SICH NICHTS — auch nicht in der Datenbank.
    const waehrend = await nachNeuerVerbindung("ko-word");
    expect(waehrend?.version).toBe(1);
    expect(waehrend?.bodyHtml).toBe(BESTAND_RUMPF);
    // Der Vorschlag selbst steht aber gespeichert da, samt seinem Fließtext.
    const offen = (waehrend?.proposals ?? [])[0];
    expect(offen?.id).toBe(eingereicht.proposal.id);
    for (const quelle of auswahl.bildQuellen) {
      expect(
        offen?.bodyHtml ?? "",
        "ein Bild der echten Word-Datei hat den Weg in die Datenbank nicht überstanden",
      ).toContain(quelle);
    }

    // 2) DIE FREMDE PRÜFUNG — sie erst schreibt die Fassung.
    await service.decideProposal("ko-word", eingereicht.proposal.id, "admin-1", "uebernehmen", {
      trust: TRUST_MAX,
      expectedVersion: 1,
    });

    // 3) ZURÜCKLESEN ÜBER EINE NEUE VERBINDUNG.
    const nachher = await nachNeuerVerbindung("ko-word");
    expect(nachher?.version).toBe(2);
    const rumpf = nachher?.bodyHtml ?? "";
    for (const quelle of auswahl.bildQuellen) {
      expect(
        rumpf,
        "ein Bild der echten Word-Datei steht nach der Übernahme NICHT im gespeicherten Fließtext",
      ).toContain(quelle);
    }
    // Ersetzt, nicht danebengestellt — sonst wäre „übernommen" ein Wort für „ergänzt".
    expect(rumpf).not.toContain("Der freigegebene ausführliche Inhalt des Eintrags.");
    expect((nachher?.proposals ?? [])[0]?.status).toBe("uebernommen");
  });

  it("Q2 · ausgelassen ist auch in PostgreSQL nicht gelöscht — ein Vorschlag OHNE Rumpf lässt den Inhalt stehen", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    // DIE GEGENRICHTUNG, und sie gehört an dieselbe Ablage: die Regel des Dienstes
    // (`rumpfAusVorschlag`) entscheidet über einen Wert, der aus dem JSON-Dokument der Datenbank
    // kommt. Ein `bodyHtml`, das beim Lesen aus PostgreSQL zu `null` statt zu `undefined` würde,
    // hiesse dort „leeren" — und der Fall wäre im Speicher grün und in der Datenbank ein
    // Datenverlust. Ohne Q2 wäre Q1 auch dann grün, wenn die Übernahme IMMER ersetzte.
    await leeren();
    const repo = new PgKoRepo(abnahme as Pool);
    await repo.insert(bestandsObjekt("ko-nur-text", BESTAND_RUMPF));
    const service = new KoService({ repo });

    const eingereicht = await service.addProposal("ko-nur-text", "experte-1", {
      statement: "Nur die Aussage ändert sich.",
      baseVersion: 1,
      origin: "klarwerk_web",
    });
    await service.decideProposal("ko-nur-text", eingereicht.proposal.id, "admin-1", "uebernehmen", {
      trust: TRUST_MAX,
      expectedVersion: 1,
    });

    const nachher = await nachNeuerVerbindung("ko-nur-text");
    expect(nachher?.statement).toBe("Nur die Aussage ändert sich.");
    expect(nachher?.version).toBe(2);
    // Bytegleich, nicht „ähnlich" und nicht „auch vorhanden".
    expect(nachher?.bodyHtml).toBe(BESTAND_RUMPF);
  });

  it("Q3 · nur die AUSDRÜCKLICHE Löschung leert den Inhalt — auch hier", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    // Die dritte Lage derselben Regel. Ohne sie wäre Q2 auch dann grün, wenn die Übernahme den
    // Fließtext NIE ändern könnte — dann wäre „ersetzen" und „löschen" gleichermassen wirkungslos.
    await leeren();
    const repo = new PgKoRepo(abnahme as Pool);
    await repo.insert(bestandsObjekt("ko-leeren", BESTAND_RUMPF));
    const service = new KoService({ repo });

    const eingereicht = await service.addProposal("ko-leeren", "experte-1", {
      statement: "Der ausführliche Inhalt gehört hier nicht hin.",
      clearBody: true,
      baseVersion: 1,
      origin: "klarwerk_web",
    });
    await service.decideProposal("ko-leeren", eingereicht.proposal.id, "admin-1", "uebernehmen", {
      trust: TRUST_MAX,
      expectedVersion: 1,
    });

    const nachher = await nachNeuerVerbindung("ko-leeren");
    expect(nachher?.bodyHtml ?? null).toBeNull();
  });

  // ==============================================================================================
  // JOB 4299 · Q4 — WER NICHT FREIGEBEN DARF, ÄNDERT AUCH IN DER ECHTEN DATENBANK NICHTS.
  // ==============================================================================================
  //
  // Gemessen wird an der ECHTEN ROUTE, nicht am Dienst: die Rechteprüfung sitzt in
  // `requirePermission` (`services/app/src/http.ts`), und ein Aufruf von `KoService.decideProposal`
  // mit einer erfundenen Kennung liefe an ihr vorbei. Drei Konten ohne das Recht werden EINZELN
  // gemessen — der Einreicher selbst (sonst könnte auch `PROPOSAL_OWN` die Abweisung erklären), ein
  // FREMDER Experte und ein `controller`, der `ko.validate` trägt. Dass auch der Letzte heute
  // abgewiesen wird, ist die Matrix, wie sie steht (die Route verlangt `users.manage`); der Wechsel
  // ist Pedis Entscheidung und wird hier nicht vorweggenommen.
  it("Q4 · RECHTE an der echten Datenbank: ohne Entscheidungsrecht bleibt Fassung und Inhalt stehen", async (ctx) => {
    if (!verfuegbar || !auswahl) {
      ctx.skip();
      return;
    }
    const schema = "job4299_q4";
    const eigen = await frischesAppSchema(schema);
    await new PgKoRepo(eigen).insert(bestandsObjekt(Q4.kennung, BESTAND_RUMPF));
    const app = buildApp(buildPgServices(eigen));
    try {
      await richteKontenEin(app);
      const einreicher = await anmeldung(app, EINREICHER);
      const vorschlagId = await reicheVorschlagEin(app, einreicher, Q4.kennung, {
        statement: Q4.vorschlagStatement,
        bodyHtml: auswahl.html,
        baseVersion: Q4.ausgangsVersion,
        origin: Q4.herkunft,
      });

      for (const konto of Q4.ohneEntscheidungsrecht) {
        const kopf = await anmeldung(app, konto);
        const versuch = await entscheide(app, kopf, Q4.kennung, vorschlagId, Q4.ausgangsVersion);
        expect(versuch.statusCode, `${konto.email} (${konto.rolle}): ${versuch.body}`).toBe(
          Q4.abweisungHttp,
        );
        expect((versuch.json() as { error?: string }).error).toBe(Q4.abweisungCode);

        // NACH NEUEM VERBINDUNGSAUFBAU gelesen — die Datenbank hat sich nicht bewegt.
        const zwischenstand = await nachNeuerVerbindungIm(schema, Q4.kennung);
        expect(zwischenstand?.version).toBe(Q4.versionNachAbweisung);
        expect(zwischenstand?.bodyHtml).toBe(BESTAND_RUMPF);
        expect(vorschlagAus(zwischenstand, vorschlagId)?.status).toBe(Q4.statusNachAbweisung);
      }

      const entscheider = await anmeldung(app, ENTSCHEIDER);
      const uebernahme = await entscheide(
        app,
        entscheider,
        Q4.kennung,
        vorschlagId,
        Q4.ausgangsVersion,
      );
      expect(uebernahme.statusCode, uebernahme.body).toBe(Q4.uebernahmeHttp);

      const nachher = await nachNeuerVerbindungIm(schema, Q4.kennung);
      expect(nachher?.version).toBe(Q4.versionNachUebernahme);
      expect(nachher?.statement).toBe(Q4.vorschlagStatement);
      const rumpf = nachher?.bodyHtml ?? "";
      for (const quelle of auswahl.bildQuellen) {
        expect(
          rumpf,
          "ein Bild der echten Word-Datei steht nach der berechtigten Übernahme NICHT im gespeicherten Fließtext",
        ).toContain(quelle);
      }
      expect(rumpf).not.toContain(BESTAND_SATZ);
      expect(vorschlagAus(nachher, vorschlagId)?.status).toBe(Q4.statusNachUebernahme);
    } finally {
      await app.close();
    }
  });

  // ==============================================================================================
  // JOB 4299 · Q5 — ZWEI ENTSCHEIDUNGEN AUF DENSELBEN STAND ERZEUGEN KEINE ZWEITE WAHRHEIT.
  // ==============================================================================================
  //
  // Die Fehlerform ist NICHT erfunden, sondern am Quelltext nachgeschlagen:
  // `KoService.decideProposal` ruft `pruefeErwarteteVersion` (`services/knowledge-object/src/
  // service.ts`), das bei abweichender Fassung `KoError("KO_STALE", …)` wirft; die Route setzt das
  // in 409 mit `currentVersion` um (`services/app/src/routes/ko-routes.ts`, `rueckwegFehler`).
  it("Q5 · KONFLIKT an der echten Datenbank: die zweite Entscheidung auf denselben Stand wird abgewiesen", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    const schema = "job4299_q5";
    const eigen = await frischesAppSchema(schema);
    await new PgKoRepo(eigen).insert(bestandsObjekt(Q5.kennung, BESTAND_RUMPF));
    const app = buildApp(buildPgServices(eigen));
    try {
      await richteKontenEin(app);
      const einreicherA = await anmeldung(app, EINREICHER);
      const einreicherB = await anmeldung(app, ZWEITER_EINREICHER);
      const vorschlagA = await reicheVorschlagEin(app, einreicherA, Q5.kennung, {
        statement: Q5.statementA,
        bodyHtml: Q5.rumpfA,
        baseVersion: Q5.basisVersion,
        origin: Q4.herkunft,
      });
      const vorschlagB = await reicheVorschlagEin(app, einreicherB, Q5.kennung, {
        statement: Q5.statementB,
        bodyHtml: Q5.rumpfB,
        baseVersion: Q5.basisVersion,
        origin: Q4.herkunft,
      });

      const entscheider = await anmeldung(app, ENTSCHEIDER);
      const a = await entscheide(app, entscheider, Q5.kennung, vorschlagA, Q5.basisVersion);
      expect(a.statusCode, a.body).toBe(Q5.uebernahmeHttp);
      // NACH NEUEM VERBINDUNGSAUFBAU: Fassung UND Fließtext von A stehen wirklich in der Datenbank.
      const nachA = await nachNeuerVerbindungIm(schema, Q5.kennung);
      expect(nachA?.version).toBe(Q5.versionNachA);
      expect(nachA?.bodyHtml).toBe(Q5.erwarteterRumpfNachKonflikt);

      const b = await entscheide(app, entscheider, Q5.kennung, vorschlagB, Q5.basisVersion);
      expect(b.statusCode, b.body).toBe(Q5.konfliktHttp);
      const fehler = b.json() as { error?: string; currentVersion?: number };
      expect(fehler.error).toBe(Q5.konfliktCode);
      expect(fehler.currentVersion).toBe(Q5.konfliktNenntVersion);

      const nachher = await nachNeuerVerbindungIm(schema, Q5.kennung);
      // 2, NICHT 3 — und der gespeicherte Text ist der von A.
      expect(nachher?.version).toBe(Q5.erwarteteEndfassung);
      expect(nachher?.statement).toBe(Q5.statementA);
      // UND SEIN FLIESSTEXT. Runde 1 prüfte hier nur `statement`; BENs gezielte Löschung des
      // Fließtextes beim Übernehmen blieb deshalb unbemerkt. `toBe` fällt bei Verlust (null/leer)
      // wie bei Ersetzung durch B; die beiden Merkmalszeilen sagen zusätzlich, WELCHER Fall vorliegt.
      expect(nachher?.bodyHtml).toBe(Q5.erwarteterRumpfNachKonflikt);
      expect(nachher?.bodyHtml ?? "").toContain(Q5.merkmalA);
      expect(
        nachher?.bodyHtml ?? "",
        "der abgewiesene Vorschlag B hat trotzdem in den gespeicherten Fließtext geschrieben",
      ).not.toContain(Q5.merkmalB);
      expect(vorschlagAus(nachher, vorschlagA)?.status).toBe(Q5.statusA);
      // B ist nicht stumm verschwunden und nicht heimlich übernommen.
      expect(vorschlagAus(nachher, vorschlagB)).toBeDefined();
      expect(vorschlagAus(nachher, vorschlagB)?.status).toBe(Q5.statusB);
    } finally {
      await app.close();
    }
  });

  // ==============================================================================================
  // JOB 4321 · Q6 — WAS DER RÜCKWEG IM PRÜFPROTOKOLL HINTERLÄSST, STEHT VERKETTET IN DER DATENBANK.
  // ==============================================================================================
  //
  // Q1–Q5 messen den INHALT des Wissensobjekts. Das Prüfprotokoll ist aber das Mittel, mit dem sich
  // eine Fälschung überhaupt nachweisen lässt — und über es stand in dieser Datei nichts: Q1–Q3
  // bauen `new KoService({ repo })` OHNE `audit`, Q4/Q5 erzeugen über die echte Route zwar Einträge,
  // prüften davon aber keinen.
  //
  // GEMESSEN WIRD DER GANZE BESTAND DES SCHEMAS, nicht nur die drei Einträge des Rückwegs: `migrate`
  // legt `audit` mit an, und Registrierung, Kontenanlage und jede Anmeldung schreiben dort ebenfalls
  // hinein. Genau deshalb ist der ganze Bestand der richtige Gegenstand — eine Kette, die nur in
  // ihrem selbst geschriebenen Ausschnitt hält, hält nicht.
  //
  // UND ER WIRD ÜBER EINE FRISCHE VERBINDUNG GELESEN, wie in Q1–Q5: ein Wert aus Prozesszustand oder
  // offener Transaktion zählt nicht als gespeichert.
  async function auditbestandIm(name: string): Promise<AuditEntry[]> {
    const zweiter = new Pool(imSchema(name));
    try {
      return await new PgAuditRepo(zweiter).all();
    } finally {
      await zweiter.end();
    }
  }

  /** GENESIS am Anfang, Glied auf Glied, jeder Hash aus den GESPEICHERTEN Feldern nachgerechnet. */
  function pruefeKetteLueckenlos(eintraege: readonly AuditEntry[]): void {
    // „Nichts gefunden" ist hier ein Befund und kein Erfolg.
    expect(
      eintraege.length,
      "im Schema steht KEIN einziger Protokolleintrag — der Rückweg hat nichts hinterlassen",
    ).toBeGreaterThan(0);
    expect(
      (eintraege[0] as AuditEntry).prevHash,
      "der erste Eintrag beginnt nicht bei GENESIS",
    ).toBe(GENESIS);
    for (let i = 1; i < eintraege.length; i++) {
      const vorher = eintraege[i - 1] as AuditEntry;
      const jetzt = eintraege[i] as AuditEntry;
      expect(
        jetzt.prevHash,
        `die Kette ist gebrochen: Eintrag ${jetzt.seq} (${jetzt.action}) zeigt nicht auf Eintrag ${vorher.seq}`,
      ).toBe(vorher.hash);
    }
    for (const eintrag of eintraege) {
      expect(
        eintrag.prevHash,
        `Eintrag ${eintrag.seq} verweist auf sich selbst: prev_hash und hash sind vertauscht`,
      ).not.toBe(eintrag.hash);
      const nachgerechnet = hashEntryFuerVersion({
        seq: eintrag.seq,
        at: eintrag.at,
        actor: eintrag.actor,
        action: eintrag.action,
        target: eintrag.target,
        payload: eintrag.payload,
        prevHash: eintrag.prevHash,
        hashVersion: eintrag.hashVersion,
      });
      expect(
        nachgerechnet,
        `für Eintrag ${eintrag.seq} (${eintrag.action}) gibt es kein Hashmaterial — unbekannte Version`,
      ).toBeDefined();
      expect(
        eintrag.hash,
        `der gespeicherte Hash von Eintrag ${eintrag.seq} (${eintrag.action}) stimmt mit dem nachgerechneten nicht überein`,
      ).toBe(nachgerechnet);
    }
  }

  it("Q6 · PRÜFPROTOKOLL am echten Rückweg: Einreichung und Entscheidung stehen verkettet in der Datenbank", async (ctx) => {
    if (!verfuegbar || !auswahl) {
      ctx.skip();
      return;
    }
    const schema = "job4321_q6";
    const eigen = await frischesAppSchema(schema);
    await new PgKoRepo(eigen).insert(bestandsObjekt(Q6.kennung, BESTAND_RUMPF));
    const app = buildApp(buildPgServices(eigen));
    try {
      await richteKontenEin(app);
      const einreicher = await anmeldungMitKennung(app, EINREICHER);
      const vorschlagId = await reicheVorschlagEin(app, einreicher.kopf, Q6.kennung, {
        statement: Q6.vorschlagStatement,
        bodyHtml: auswahl.html,
        baseVersion: Q6.ausgangsVersion,
        origin: Q6.herkunft,
      });

      const entscheider = await anmeldungMitKennung(app, ENTSCHEIDER);
      const uebernahme = await entscheide(
        app,
        entscheider.kopf,
        Q6.kennung,
        vorschlagId,
        Q6.ausgangsVersion,
      );
      // Ohne eine WIRKLICH vollzogene Übernahme wäre jede Protokollaussage darunter gegenstandslos.
      expect(uebernahme.statusCode, uebernahme.body).toBe(Q6.uebernahmeHttp);
      const nachher = await nachNeuerVerbindungIm(schema, Q6.kennung);
      expect(nachher?.version).toBe(Q6.versionNachUebernahme);
      expect(vorschlagAus(nachher, vorschlagId)?.status).toBe(Q6.statusNachUebernahme);

      // (a) DIE EINTRÄGE, DIE DIESER WEG WIRKLICH ERZEUGT HAT — einzeln benannt, nicht gezählt.
      const bestand = await auditbestandIm(schema);
      const zumObjekt = bestand.filter((e) => e.target === Q6.kennung);
      const einreichung = zumObjekt.find((e) => e.action === Q6.einreichungAktion);
      const ueberarbeitung = zumObjekt.find((e) => e.action === Q6.ueberarbeitungAktion);
      const entscheidung = zumObjekt.find((e) => e.action === Q6.entscheidungsAktion);
      expect(
        einreichung,
        `kein ${Q6.einreichungAktion}-Eintrag zu ${Q6.kennung} — die Einreichung ist nicht protokolliert`,
      ).toBeDefined();
      expect(
        ueberarbeitung,
        `kein ${Q6.ueberarbeitungAktion}-Eintrag zu ${Q6.kennung} — die neue Fassung ist nicht protokolliert`,
      ).toBeDefined();
      expect(
        entscheidung,
        `kein ${Q6.entscheidungsAktion}-Eintrag zu ${Q6.kennung} — die Freigabe ist nicht protokolliert`,
      ).toBeDefined();
      // Und sie gehören zu DIESEM Vorschlag, nicht irgendeinem.
      expect((einreichung?.payload as { proposalId?: string })?.proposalId).toBe(vorschlagId);
      expect((ueberarbeitung?.payload as { proposalId?: string })?.proposalId).toBe(vorschlagId);
      expect((entscheidung?.payload as { proposalId?: string })?.proposalId).toBe(vorschlagId);
      expect((ueberarbeitung?.payload as { version?: number })?.version).toBe(
        Q6.versionNachUebernahme,
      );

      // (c) DER HANDELNDE IST DER ANGEMELDETE ENTSCHEIDER — die Kennung aus SEINER Anmeldung.
      expect(
        entscheidung?.actor,
        "der Entscheidungseintrag trägt nicht die Kennung des angemeldeten Entscheiders",
      ).toBe(entscheider.kennung);
      expect(
        entscheidung?.actor,
        "der Entscheidungseintrag trägt den Einreicher als Entscheider",
      ).not.toBe(einreicher.kennung);
      // Die Fassung schrieb der Einreicher — auch das steht so und nicht anders im Protokoll.
      expect(ueberarbeitung?.actor).toBe(einreicher.kennung);

      // (b) DIE KETTE ÜBER DEN GANZEN BESTAND DES SCHEMAS.
      pruefeKetteLueckenlos(bestand);
      expect(
        bestand.map((e) => e.seq),
        "die Sequenz hat Lücken oder Sprünge — das Protokoll ist nicht lückenlos",
      ).toEqual(bestand.map((_e, i) => i + 1));
    } finally {
      await app.close();
    }
  });

  // ==============================================================================================
  // JOB 4321 RUNDE 2 · Q7 — DER GEMEINSAME ERSTAUFBAU DER ERWEITERUNG, GEZIELT ÜBERLAPPT.
  // ==============================================================================================
  //
  // WARUM DIESE PRÜFUNG IN DIESER DATEI STEHT. Sie ist die Datei, die den Befund bezahlt hat: in
  // BENs Runde-1-Messung brach GENAU DIESE SUITE in `beforeAll` ab (`Tests 13 passed | 7 skipped`,
  // Exit 1), weil `tests/ko/trash-tx-pg.integration.test.ts` im selben Augenblick dieselbe
  // Erweiterung anlegte. Die Voraussetzung des eigenen Laufs ist damit ein Gegenstand des eigenen
  // Laufs — nicht eine Annahme, die man einmal von Hand geprüft hat.
  //
  // WARUM EINE EIGENE, WEGWERFBARE DATENBANK. Der Wettlauf entsteht NUR beim ERSTAUFBAU: trägt eine
  // Instanz `pg_trgm` bereits, ist `IF NOT EXISTS` ein folgenloser Griff ins Leere und es gibt nichts
  // zu messen. Die gemeinsame Prüfinstanz trägt sie nach dem ersten Lauf — `DROP EXTENSION` auf ihr
  // wäre zudem ein Angriff auf die GIN-Indizes der parallel laufenden Dateien. Eine eigene Datenbank
  // auf DERSELBEN Instanz gibt den Erstaufbau zurück, ohne irgendetwas Fremdes anzufassen; sie fällt
  // am Ende wieder weg. Advisory-Sperren sind je Datenbank getrennt, diese Probe hält also auch keine
  // andere Datei auf.
  //
  // UND SIE KALIBRIERT SICH SELBST. „Beide Sitzungen kamen durch" wäre für sich genommen wertlos —
  // vielleicht hat die Überlappung gar nicht stattgefunden. Deshalb wird ZUERST der ungesicherte Weg
  // in genau derselben Choreografie gefahren, und er MUSS scheitern; erst danach beweist derselbe
  // Ablauf über `stelleTrigrammErweiterungSicher`, dass die Reparatur trägt.
  //
  // DIE ÜBERLAPPUNG IST NICHT ZUFÄLLIG, SONDERN ERZWUNGEN. Sitzung A legt die Erweiterung in einer
  // OFFENEN Transaktion an und hält sie. Sitzung B startet dieselbe Anlage und läuft in die
  // Zeilensperre von A — gewartet wird nachweislich (`pg_stat_activity.wait_event_type = 'Lock'`),
  // nicht geraten. Erst wenn B wirklich wartet, schreibt A fest. Das ist die Choreografie, mit der
  // BEN den Fehler reproduziert hat („Konkurrenzprobe mit verlängertem Extension-Transaktionsfenster").
  const TRGM_PROBE_DB = "klarwerk_test_job4321_trgm";

  /**
   * Dieselbe Verbindungszeichenkette, nur mit einem anderen Datenbanknamen.
   *
   * Bewusst per Muster statt `new URL()`, aus demselben Grund wie in
   * `services/db-tx/src/pg-test-guard.ts:15-18`: WHATWG-URL lehnt Socket-Verbindungsstrings
   * (`postgres://user@/klarwerk_test?host=/run/pg` — leerer Host, Datenbankname im Pfad,
   * Socketpfad im Abfrageteil) ab, und genau die benutzen die Docker-losen Läufe. Ein angehängter
   * Abfrageteil bleibt erhalten.
   *
   * DER NAME IM BEISPIEL IST NICHT FREI: `tests/app/job2354-drei-datenbanknamen.test.ts` liest im
   * Fall N3 JEDE Verbindungszeichenkette dieser Datei — auch die in einem Kommentar — und verlangt
   * den Testdatenbanknamen. Ein Platzhalter wie `…/db` färbt das schnelle Tor rot (gemessen JOB
   * 4321 R2: `expected 'db' to be 'klarwerk_test'`), und zwar zu Recht: eine mehrdeutig benannte
   * Verbindungszeichenkette in einer Integrationsdatei ist genau der Befund E7.
   */
  function mitDatenbank(url: string, name: string): string {
    const treffer = /^([^:]+:\/\/[^/?#]*\/)([^/?#]*)(.*)$/.exec(url);
    if (!treffer) {
      throw new Error(
        "JOB 4321 Q7: die Verbindungszeichenkette trägt keinen lesbaren Datenbanknamen — ohne ihn gibt es keine Wegwerfdatenbank und keinen Erstaufbau zu messen.",
      );
    }
    return `${treffer[1]}${name}${treffer[3]}`;
  }

  async function amProbeort<T>(url: string, arbeit: (p: Pool) => Promise<T>): Promise<T> {
    const probe = new Pool({ connectionString: url, max: 1 });
    try {
      return await arbeit(probe);
    } finally {
      await probe.end();
    }
  }

  async function trgmVorhanden(url: string): Promise<boolean> {
    return amProbeort(url, async (p) => {
      const da = await p.query("SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'");
      return da.rowCount === 1;
    });
  }

  /** Wartet, bis in der Probedatenbank eine ANDERE Sitzung als `ausser` an einer Sperre hängt. */
  async function warteBisBlockiert(ausser: number): Promise<void> {
    const basis = pool as Pool;
    const frist = Date.now() + 20_000;
    while (Date.now() < frist) {
      const wartende = await basis.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = $1 AND pid <> $2 AND wait_event_type = 'Lock'",
        [TRGM_PROBE_DB, ausser],
      );
      if ((wartende.rows[0]?.n ?? 0) > 0) {
        return;
      }
      await new Promise((weiter) => setTimeout(weiter, 50));
    }
    throw new Error(
      "JOB 4321 Q7: die zweite Sitzung hat innerhalb von 20 s nie an einer Sperre gewartet — die Überlappung kam nicht zustande, und ohne sie sagt der Ausgang dieser Probe nichts.",
    );
  }

  /**
   * Die Choreografie: A hält die Anlage offen, B legt gleichzeitig an, A schreibt fest.
   *
   * Zurückgegeben wird der Fehler von B — oder `undefined`, wenn B durchkam.
   */
  async function ueberlappenderErstaufbau(
    url: string,
    art: "ungesichert" | "gesichert",
  ): Promise<unknown> {
    const haltend = new Pool({ connectionString: url, max: 1 });
    const zweite = new Pool({ connectionString: url, max: 1 });
    try {
      const a = await haltend.connect();
      try {
        const eigen = await a.query<{ pid: number }>("SELECT pg_backend_pid()::int AS pid");
        const pidA = eigen.rows[0]?.pid as number;
        await a.query("BEGIN");
        await a.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");

        // B startet JETZT — und die Fehlerbehandlung hängt sofort daran, damit kein unbehandelter
        // Abbruch den Lauf an anderer Stelle umwirft.
        const lauf =
          art === "gesichert"
            ? stelleTrigrammErweiterungSicher(zweite)
            : zweite.query("CREATE EXTENSION IF NOT EXISTS pg_trgm").then(() => undefined);
        const ausgang = lauf.then(
          () => undefined,
          (fehler: unknown) => fehler ?? new Error("Fehler ohne Inhalt"),
        );

        await warteBisBlockiert(pidA);
        await a.query("COMMIT");
        return await ausgang;
      } finally {
        a.release();
      }
    } finally {
      await haltend.end();
      await zweite.end();
    }
  }

  it("Q7 · zwei Sitzungen legen die Trigramm-Erweiterung gleichzeitig an: ungesichert bricht es ab, gesichert kommen beide durch", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    const basis = pool as Pool;
    await basis.query(`DROP DATABASE IF EXISTS ${TRGM_PROBE_DB}`);
    await basis.query(`CREATE DATABASE ${TRGM_PROBE_DB}`);
    const probeUrl = mitDatenbank(verbindung, TRGM_PROBE_DB);
    try {
      // (0) DER BODEN: eine frische Datenbank trägt die Erweiterung nicht. Ohne diesen Satz wäre
      //     jede Aussage unten über den ERSTAUFBAU haltlos.
      expect(
        await trgmVorhanden(probeUrl),
        "die Wegwerfdatenbank trägt pg_trgm bereits — dann gibt es keinen Erstaufbau und nichts zu messen",
      ).toBe(false);

      // (1) KALIBRIERUNG: derselbe Ablauf OHNE die Reparatur muss scheitern, und zwar mit genau
      //     dem Fehlerbild aus BENs Messung.
      const ungesichert = await ueberlappenderErstaufbau(probeUrl, "ungesichert");
      expect(
        ungesichert,
        "der ungesicherte Erstaufbau überstand die Überlappung — dann misst diese Probe den Wettlauf nicht, und ihr Grün unten wäre wertlos",
      ).toBeDefined();
      expect(
        istGleichzeitigeTrgmAnlage(ungesichert),
        `der ungesicherte Erstaufbau scheiterte an etwas anderem als der gleichzeitigen Anlage: ${String(ungesichert)}`,
      ).toBe(true);

      // Zurück auf Anfang: A hat festgeschrieben, die Erweiterung steht jetzt. Nur in DIESER
      // Wegwerfdatenbank wird sie wieder entfernt — die gemeinsame Prüfinstanz bleibt unberührt.
      await amProbeort(probeUrl, (p) => p.query("DROP EXTENSION IF EXISTS pg_trgm"));
      expect(
        await trgmVorhanden(probeUrl),
        "die Erweiterung liess sich nicht zurücknehmen — der zweite Durchgang wäre kein Erstaufbau mehr",
      ).toBe(false);

      // (2) DER NACHWEIS: derselbe Ablauf über den gemeinsamen Weg. Beide Sitzungen kommen durch.
      const gesichert = await ueberlappenderErstaufbau(probeUrl, "gesichert");
      expect(
        gesichert,
        `der gesicherte Erstaufbau ist an der Überlappung gescheitert: ${String(gesichert)}`,
      ).toBeUndefined();
      expect(
        await trgmVorhanden(probeUrl),
        "beide Sitzungen meldeten Erfolg, die Erweiterung steht aber nicht da — ein Erfolg ohne Wirkung",
      ).toBe(true);
    } finally {
      await basis.query(`DROP DATABASE IF EXISTS ${TRGM_PROBE_DB}`);
    }
  }, 120_000);
});

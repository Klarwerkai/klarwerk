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
  ZWEITER_EINREICHER,
  anmeldung,
  bestandsObjekt,
  entscheide,
  reicheVorschlagEin,
  richteKontenEin,
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
        `[KLARWERK][JOB 4299] Word-Rückweg-Pg-Abnahme ÜBERSPRUNGEN — Grund: ${z.grund}. Q1–Q5 wurden NICHT geprüft.\n`,
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
      await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
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
});

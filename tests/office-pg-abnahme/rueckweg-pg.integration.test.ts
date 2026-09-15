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
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { KO_SCHEMA, PgKoRepo } from "../../services/knowledge-object/src/repo-pg";
import { KoService } from "../../services/knowledge-object/src/service";
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";
import { TRUST_MAX } from "../../services/validation/src/trust";
import { type WordAuswahl, echteWordAuswahl } from "./echte-word-auswahl";

/** Der ausführliche Inhalt, den der Eintrag VOR dem Vorschlag trägt — das Vergleichsmass. */
const BESTAND_RUMPF = "<p>Der freigegebene ausführliche Inhalt des Eintrags.</p>";

/** Ein FREIGEGEBENES Objekt mit ausführlichem Inhalt — der Zustand, den Pedis Regel schützt. */
function ko(id: string, bodyHtml: string | null): KnowledgeObject {
  return {
    id,
    title: "Ventil X schließt bei Überdruck",
    statement: "Bei Überdruck Ventil X manuell schließen.",
    bodyHtml,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 99,
    trust: TRUST_MAX,
    status: "validiert",
    version: 1,
    originalAuthor: "admin-1",
    author: "admin-1",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
  } as KnowledgeObject;
}

describe("JOB 4085 · der Word-Rückweg gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let verbindung = "";
  let verfuegbar = false;
  let auswahl: WordAuswahl | undefined;

  beforeAll(async () => {
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      try {
        verbindung = lokal;
        pool = new Pool({ connectionString: lokal });
        await pool.query("SELECT 1");
        verfuegbar = true;
      } catch {
        process.stderr.write(
          "[KLARWERK] JOB 4085 ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
        );
        verfuegbar = false;
      }
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      // Die Sicherung hat die URL abgelehnt (Grund steht auf stderr) — KEIN Container-Rückfall:
      // wer ausdrücklich eine lokale Instanz wollte, bekommt keine stille zweite.
      verfuegbar = false;
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
      } catch {
        process.stderr.write(
          "[KLARWERK] JOB 4085 ÜBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar.\n",
        );
        verfuegbar = false;
      }
    }
    if (verfuegbar && pool) {
      await pool.query("DROP TABLE IF EXISTS kos CASCADE");
      await pool.query(KO_SCHEMA);
      // Dieselbe Word-Markierung wie ABNAHME 1 — echte `.docx`, produktiver Extraktor, echte Bilder.
      auswahl = await echteWordAuswahl();
    }
  }, 180_000);

  afterAll(async () => {
    if (verfuegbar && pool) {
      await pool.query("DROP TABLE IF EXISTS kos CASCADE");
    }
    await pool?.end();
    await container?.stop();
  });

  /**
   * DAS ZURÜCKLESEN NACH NEUEM VERBINDUNGSAUFBAU — der Punkt dieser Abnahme.
   *
   * Ein Lesen über denselben Pool könnte einen Wert zeigen, der nie in der Datenbank ankam (Cache,
   * offene Transaktion, Zustand im Prozess). Eine FRISCHE Verbindung mit einem FRISCHEN Adapter
   * kennt nur, was wirklich gespeichert ist.
   */
  async function nachNeuerVerbindung(id: string): Promise<KnowledgeObject | undefined> {
    const zweiter = new Pool({ connectionString: verbindung });
    try {
      return await new PgKoRepo(zweiter).findById(id);
    } finally {
      await zweiter.end();
    }
  }

  async function leeren(): Promise<void> {
    await (pool as Pool).query("DELETE FROM kos");
  }

  it("Q1 · der Vorschlag AUS WORD trägt seine Bilder durch PostgreSQL — geschrieben, übernommen, neu gelesen", async (ctx) => {
    if (!verfuegbar || !auswahl) {
      ctx.skip();
      return;
    }
    await leeren();
    const repo = new PgKoRepo(pool as Pool);
    await repo.insert(ko("ko-word", BESTAND_RUMPF));
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
    const repo = new PgKoRepo(pool as Pool);
    await repo.insert(ko("ko-nur-text", BESTAND_RUMPF));
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
    const repo = new PgKoRepo(pool as Pool);
    await repo.insert(ko("ko-leeren", BESTAND_RUMPF));
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
});

// ================================================================================================
// JOB 4151 · TEST 2 — DER BELEG GEGEN DEN INMEMORY-SCHEIN (G2): EINE ZWEITE REPO-INSTANZ.
// ================================================================================================
//
// DIE ENTSCHEIDENDE ZEILE DIESES AUFTRAGS stand in `kanten-repo.ts:20-24`, wörtlich: „Und kein
// Postgres — der Adapter braucht Migration und Modulexport … Dieser Bestand ist die Vorlage, die
// ein solcher Adapter zu übersetzen hätte, nicht sein Ersatz." Der Bestand war eine `Map` und beim
// Prozessende weg.
//
// WARUM EINE ZWEITE INSTANZ UND NICHT EIN ZWEITER LESEVORGANG. Ein Test, der über DIESELBE Instanz
// schreibt und liest, ist auch mit einer `Map` grün — er belegt nichts über Haltbarkeit. Die zweite
// Instanz auf DERSELBEN Datenbank, mit EIGENEM Verbindungspool, ist das nächstbeste an
// „Serverneustart", das ein Test herstellen kann: sie teilt mit der ersten nichts ausser der Ablage.
//
// AUSSERDEM fährt diese Datei den GEMEINSAMEN Fallsatz (`bestandsvertrag.ts`) gegen `PgKantenRepo`
// — dieselben Fälle, die `bestandsvertrag-beide-fassungen.test.ts` gegen den Speicherbestand fährt.
// Eine zweite, abgeschriebene Fassung der Regeln gäbe es damit nirgends.
//
// ------------------------------------------------------------------------------------------------
// STATUS IN DIESER UMGEBUNG: AUSGEFÜHRT — der Prüfplatz hat seit dem 15.09.2026 ein echtes Postgres.
// ------------------------------------------------------------------------------------------------
// Beim ersten Anlauf (Arbeitsprüfung `01b6eccf12db4b0b97e11b9845efd225`) meldete der Prüfplatz
// `Error: Could not find a working container runtime strategy`, und dieser Kopf sagte deshalb
// „NICHT GEMESSEN". Das gilt nicht mehr: die Cloud-Prüfplätze tragen PG 16 und setzen für Läufe mit
// `--config vitest.integration.config.ts` eine `KLARWERK_PG_TEST_URL` auf einen eigenen Cluster
// (Steuerung, Nachtrag 15.09. 21:47). Die Fälle dieser Datei laufen dort WIRKLICH; ein `skipped`
// zählt ab hier als ROT und nicht mehr als benannte Prüfgrenze. Die Rückgabe nennt Lauf und Exit.
//
// DER SKIP BLEIBT SICHTBAR (`ctx.skip()`, Grund auf stderr) — er ist jetzt die Meldung „dieser
// Prüfplatz taugt nicht", nicht mehr die Erklärung eines erwarteten Zustands. Ein STILLER Skip
// sähe aus wie ein bestandener Lauf, und das wäre hier die gefährlichste Antwort.
//
// SIE IST STARTBAR, ohne dass eine Zeile geändert werden muss — dasselbe Gerüst wie
// `tests/entwurfs-papierkorb/papierkorb-pg.integration.test.ts`: lokale URL mit Vorrang, sonst
// Testcontainers, sonst sichtbarer Skip.
//
//     KLARWERK_PG_TEST_URL=postgres://user:pass@127.0.0.1:5432/klarwerk_test \
//       npx vitest run --config vitest.integration.config.ts \
//       tests/wissensgraph-integration/bestand-postgres.integration.test.ts
//
// Der Datenbankname MUSS `test` enthalten — `guardedLocalPgTestUrl` weist sonst ab
// (`services/db-tx/src/pg-test-guard.ts`), weil diese Suite Zeilen löscht.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  KANTEN_SCHEMA,
  type KantenKoLeser,
  type KantenRepo,
  KantenSchreibService,
  type KnowledgeObject,
  PgKantenRepo,
} from "../../services/knowledge-object";
import { fuehreBestandsvertrag, kante } from "./bestandsvertrag";
import { mitTorwaerter } from "./torwaerter";

let container: StartedTestContainer | undefined;
let pool: Pool | undefined;
let url: string | undefined;
let verfuegbar = false;

const nichtVerfuegbar = () => !verfuegbar;

beforeAll(async () => {
  const lokal = guardedLocalPgTestUrl();
  if (lokal) {
    try {
      url = lokal;
      pool = new Pool({ connectionString: lokal });
      await pool.query("SELECT 1");
      verfuegbar = true;
    } catch {
      process.stderr.write(
        "[KLARWERK] JOB 4151 ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
      );
      verfuegbar = false;
    }
  } else if (process.env.KLARWERK_PG_TEST_URL) {
    // Die Sicherung hat die URL abgelehnt (Grund steht auf stderr) — KEIN Container-Rückfall: wer
    // ausdrücklich eine lokale Instanz wollte, bekommt keine stille zweite.
    verfuegbar = false;
  } else {
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
      pool = new Pool({ connectionString: url });
      verfuegbar = true;
    } catch {
      process.stderr.write(
        "[KLARWERK] JOB 4151 ÜBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar.\n",
      );
      verfuegbar = false;
    }
  }
  if (verfuegbar && pool) {
    // Die GANZE Migrationskette, nicht nur die neue Stufe: wäre `KANTEN_SCHEMA` nicht in `db.ts`
    // aufgenommen, fehlte die Tabelle hier — und genau das ist Lieferung 6.
    await migrate(pool);
  }
}, 180_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

/**
 * Ein frischer, leerer Bestand: dieselben Tabellen, vorher geleert.
 *
 * BEIDE Tabellen, und das ist kein Zusatz, sondern Bedingung (JOB 4151, BEN R3): die Bindung der
 * Wiederholschlüssel steht seit dieser Runde in `ko_kanten_beitrag`. Bliebe sie stehen, trüge jeder
 * Fall die Schlüssel des vorherigen — und ein späterer Fall bekäme eine Abweisung, die er sich
 * nicht verdient hat.
 */
async function frischerBestand(): Promise<PgKantenRepo> {
  await (pool as Pool).query("DELETE FROM ko_kanten_beitrag");
  await (pool as Pool).query("DELETE FROM ko_kanten");
  return new PgKantenRepo(pool as Pool);
}

describe("JOB 4151 · Bestandsvertrag · Fassung 2 (Postgres)", () => {
  fuehreBestandsvertrag("Postgres", frischerBestand, nichtVerfuegbar);
});

describe("JOB 4151 · P — die Beziehung überlebt die Repo-Instanz", () => {
  it("P1: eine zweite Instanz auf derselben Datenbank findet dieselbe Beziehung wieder", async (ctx) => {
    if (nichtVerfuegbar()) {
      ctx.skip();
      return;
    }
    const erste = await frischerBestand();
    await erste.setze(
      kante({
        quelleId: "ko-halle",
        zielId: "ko-filter",
        id: "k-haltbar",
        urheber: "controllerin-1",
        beitragSchluessel: ["b-haltbar"],
        beurteilt: {
          quelleVersion: 2,
          zielVersion: 5,
          quelleFassungAm: "2026-08-01T00:00:00.000Z",
          zielFassungAm: "2026-08-02T00:00:00.000Z",
        },
      }),
    );

    // Eine EIGENE Verbindung und eine EIGENE Instanz — sie teilt mit der ersten nur die Ablage.
    const zweiterPool = new Pool({ connectionString: url as string });
    try {
      const zweite = new PgKantenRepo(zweiterPool);
      const wieder = await zweite.hole("k-haltbar");
      // Kanonisch abgelegt: „ko-filter" ist lexikografisch kleiner und steht deshalb vorn.
      expect(wieder?.quelleId).toBe("ko-filter");
      expect(wieder?.zielId).toBe("ko-halle");
      expect(wieder?.urheber).toBe("controllerin-1");
      expect(wieder?.version).toBe(1);
      // Kanonisch gedreht (ko-filter wurde Quelle) — und der beurteilte Stand ist mitgedreht.
      expect(wieder?.beurteilt).toEqual({
        quelleVersion: 5,
        zielVersion: 2,
        quelleFassungAm: "2026-08-02T00:00:00.000Z",
        zielFassungAm: "2026-08-01T00:00:00.000Z",
      });
      expect(await zweite.fuerKo("ko-halle")).toHaveLength(1);
      // Auch der Wiederholschlüssel hat die Instanz überlebt — sonst wäre die Idempotenzzusage
      // nach einem Neustart weg, und genau dann wird sie gebraucht.
      expect((await zweite.holeNachBeitrag("b-haltbar"))?.id).toBe("k-haltbar");
    } finally {
      await zweiterPool.end();
    }
  });

  it("P2: die Eindeutigkeit hängt an der DATENBANK, nicht am Anwendungscode", async (ctx) => {
    if (nichtVerfuegbar()) {
      ctx.skip();
      return;
    }
    const repo = await frischerBestand();
    await repo.setze(kante({ quelleId: "ko-a", zielId: "ko-b", id: "k-1" }));
    // Ein zweiter Eintrag DERSELBEN fachlichen Beziehung, am Adapter vorbei direkt eingefügt:
    // der Unique-Index über dem Beziehungsschlüssel weist ihn ab.
    const doppelt = (pool as Pool).query(
      `INSERT INTO ko_kanten
         (id, quelle_id, ziel_id, art, richtung, urheber, gesetzt_am, geaendert_am, status, version, beziehungs_schluessel_hash, beurteilt, beitrag_schluessel)
       SELECT 'k-2', quelle_id, ziel_id, art, richtung, urheber, gesetzt_am, geaendert_am, status, version, beziehungs_schluessel_hash, beurteilt, beitrag_schluessel
         FROM ko_kanten WHERE id = 'k-1'`,
    );
    await expect(doppelt).rejects.toMatchObject({ code: "23505" });
    expect(await repo.fuerKo("ko-a")).toHaveLength(1);
  });

  it("P3: die DDL ist wiederholbar — ein zweiter Lauf ist folgenlos", async (ctx) => {
    if (nichtVerfuegbar()) {
      ctx.skip();
      return;
    }
    await expect((pool as Pool).query(KANTEN_SCHEMA)).resolves.toBeTruthy();
  });

  // ==============================================================================================
  // BEN R2, KORREKTURPFLICHT 3 — DER VERLANGTE BELEG, WÖRTLICH.
  // ==============================================================================================
  //
  // BENs Satz: „Controller setzt, Admin widerruft, neue Postgresinstanz findet beide
  // Verantwortlichkeiten." Der gemeinsame Fallsatz prüft die Regel; DIESER Fall prüft, dass sie die
  // Instanz überlebt — eine Spalte, die nur im Anwendungsspeicher existierte, wäre nach einem
  // Neustart eine Rücknahme ohne Urheber.
  it("P4: der Widerrufs-Urheber überlebt die Repo-Instanz — beide Verantwortlichkeiten stehen da", async (ctx) => {
    if (nichtVerfuegbar()) {
      ctx.skip();
      return;
    }
    const erste = await frischerBestand();
    await erste.setze(
      kante({ quelleId: "ko-halle", zielId: "ko-filter", id: "k-w", urheber: "controllerin-1" }),
    );
    await erste.setze(
      kante({
        quelleId: "ko-halle",
        zielId: "ko-filter",
        id: "k-w",
        urheber: "controllerin-1",
        status: "widerrufen",
        widerrufenVon: "admin-1",
        geaendertAm: "2026-09-03T10:00:00.000Z",
      }),
      { erwarteteVersion: 1 },
    );

    const zweiterPool = new Pool({ connectionString: url as string });
    try {
      const wieder = await new PgKantenRepo(zweiterPool).hole("k-w");
      expect(wieder?.status).toBe("widerrufen");
      expect(wieder?.urheber).toBe("controllerin-1");
      expect(wieder?.widerrufenVon).toBe("admin-1");
      expect(wieder?.geaendertAm).toBe("2026-09-03T10:00:00.000Z");
    } finally {
      await zweiterPool.end();
    }
  });

  // ==============================================================================================
  // BEN R2, PRÜFLÜCKE 6 — ZWEI GLEICHZEITIGE ERSTSETZUNGEN. GEGEN ECHTES POSTGRES, NICHT GEDACHT.
  // ==============================================================================================
  //
  // WARUM DIESER FALL NUR HIER STEHEN KANN: Der Wettlauf braucht ZWEI Datenbankverbindungen, die
  // wirklich nebeneinander laufen. Der Speicherbestand kann ihn baulich nicht herstellen — sein
  // `setze` hat zwischen Nachschlag und Ablage kein `await`. Ein Test gegen ihn wäre grün, ohne
  // irgendetwas über die Lücke zu sagen.
  //
  // DER FALLSTRICK, DEN DAS MISST: Nachschlag des Wiederholschlüssels und Schreiben sind zwei
  // Schritte. Beide Anfragen lesen „gibt es noch nicht", beide fügen ein — eine gewinnt, die andere
  // bekommt `23505`. Ohne Auflösung geht daraus ein 500 an den Menschen.
  //
  // JOB 4151 (BEN R3) — DIE VERSCHRÄNKUNG WIRD ERZWUNGEN, NICHT ERHOFFT. `torwaerter` hält den
  // Nachschlag des Wiederholschlüssels an, bis BEIDE Anfragen ihn als „fehlt" gelesen haben; erst
  // dann darf geschrieben werden. Ohne ihn hinge P5–P7 daran, wie die beiden Läufe an diesem Tag
  // zufällig verschränkt sind — BENs Einwand gegen das blosse `Promise.all`. Der Doppelgänger
  // steht in `torwaerter.ts` und ist derselbe, den der Speicherbestand fährt.
  const schreibdienst = (repo: KantenRepo, kos: readonly KnowledgeObject[]) => {
    const leser: KantenKoLeser = {
      get: async (id) => kos.find((k) => k.id === id),
    };
    return new KantenSchreibService({ repo, kos: leser });
  };

  /** Zwei Objekte mit genau den Feldern, die der Schreibdienst wirklich liest. */
  const zweiKos = (): readonly KnowledgeObject[] =>
    [
      { id: "ko-links", version: 1, history: [] },
      { id: "ko-rechts", version: 1, history: [] },
    ] as unknown as readonly KnowledgeObject[];

  const eingabe = (id: string, beitragSchluessel: string) => ({
    id,
    quelleId: "ko-links",
    zielId: "ko-rechts",
    art: "ergaenzt" as const,
    richtung: "ungerichtet" as const,
    urheber: "controllerin-1",
    jetzt: "2026-09-04T08:00:00.000Z",
    beitragSchluessel,
    gesehen: { quelleVersion: 1, zielVersion: 1 },
  });

  it("P5: derselbe Beitrag GLEICHZEITIG zweimal — eine Kante, Version 1, kein Infrastrukturfehler", async (ctx) => {
    if (nichtVerfuegbar()) {
      ctx.skip();
      return;
    }
    const repo = await frischerBestand();
    const dienst = schreibdienst(mitTorwaerter(repo, 2), zweiKos());
    const sichtbar = { sichtbar: () => true };

    const [a, b] = await Promise.all([
      dienst.setze(eingabe("k-p5-a", "s-parallel"), sichtbar),
      dienst.setze(eingabe("k-p5-b", "s-parallel"), sichtbar),
    ]);

    // GENAU EINE Kante, und ihre Version steht auf 1: der zweite Lauf hat NICHTS geschrieben.
    expect(await repo.fuerKo("ko-links")).toHaveLength(1);
    expect(a.kante.id).toBe(b.kante.id);
    expect(a.kante.version).toBe(1);
    expect(b.kante.version).toBe(1);
    // Genau einer hat angelegt, der andere hat wiederholt — und niemand hat fortgeschrieben.
    expect([a.ergebnis, b.ergebnis].sort()).toEqual(["angelegt", "wiederholt"]);
  });

  it("P6: ZWEI VERSCHIEDENE Beiträge gleichzeitig — eine Kante, Version 2, beide Schlüssel finden sie", async (ctx) => {
    if (nichtVerfuegbar()) {
      ctx.skip();
      return;
    }
    // Die Gegenrichtung zu P5: hier SOLL fortgeschrieben werden. Ohne diesen Fall wäre P5 auch mit
    // einem Server grün, der beim zweiten Schreiber grundsätzlich nichts tut — und dann könnte ein
    // Zweiter eine Beziehung nie mitbeurteilen.
    const repo = await frischerBestand();
    const dienst = schreibdienst(mitTorwaerter(repo, 2), zweiKos());
    const sichtbar = { sichtbar: () => true };

    const ergebnisse = await Promise.all([
      dienst.setze(eingabe("k-p6-a", "s-eins"), sichtbar),
      dienst.setze(eingabe("k-p6-b", "s-zwei"), sichtbar),
    ]);

    expect(await repo.fuerKo("ko-links")).toHaveLength(1);
    expect(ergebnisse.map((e) => e.ergebnis).sort()).toEqual(["angelegt", "fortgeschrieben"]);
    const [gefunden] = await repo.fuerKo("ko-links");
    expect(gefunden?.version).toBe(2);
    // Beide Wiederholschlüssel führen weiterhin zu DERSELBEN Beziehung.
    expect((await repo.holeNachBeitrag("s-eins"))?.id).toBe(gefunden?.id);
    expect((await repo.holeNachBeitrag("s-zwei"))?.id).toBe(gefunden?.id);
  });

  // ==============================================================================================
  // BEN R3, KORREKTURPFLICHT 1 — DERSELBE SCHLÜSSEL, VERSCHIEDENE BEZIEHUNGEN, GLEICHZEITIG.
  // ==============================================================================================
  //
  // WARUM P5 UND P6 DAFÜR NICHT GENÜGT HABEN: Beide messen den Wettlauf um die BEZIEHUNG, und den
  // fing der Unique-Index über dem Beziehungsschlüssel ab. Über den WIEDERHOLSCHLÜSSEL wachte
  // dagegen nichts — er stand in einem jsonb-Feld. Zwei gleichzeitige Anfragen mit demselben
  // Schlüssel auf VERSCHIEDENE Beziehungen widersprachen der Datenbank überhaupt nicht und wurden
  // beide gespeichert (BEN R3: „Zwei verschiedene Beziehungen mit demselben Schlüssel werden beide
  // gespeichert."). Seit dieser Runde trägt `ko_kanten_beitrag` einen Primärschlüssel darauf.
  it("P7: derselbe Schlüssel auf VERSCHIEDENE Beziehungen, gleichzeitig — eine gespeichert, eine abgewiesen", async (ctx) => {
    if (nichtVerfuegbar()) {
      ctx.skip();
      return;
    }
    const repo = await frischerBestand();
    const kos = [
      { id: "ko-links", version: 1, history: [] },
      { id: "ko-rechts", version: 1, history: [] },
      { id: "ko-drittes", version: 1, history: [] },
    ] as unknown as readonly KnowledgeObject[];
    const dienst = schreibdienst(mitTorwaerter(repo, 2), kos);
    const sichtbar = { sichtbar: () => true };

    const ergebnisse = await Promise.allSettled([
      dienst.setze(eingabe("k-p7-a", "s-geteilt"), sichtbar),
      dienst.setze({ ...eingabe("k-p7-b", "s-geteilt"), zielId: "ko-drittes" }, sichtbar),
    ]);

    // GENAU EINE Speicherung — der Bestand ist der Zeuge, nicht der Statuscode.
    const alle = await repo.alleAktiven();
    expect(alle).toHaveLength(1);
    const abgewiesen = ergebnisse.filter((e) => e.status === "rejected");
    expect(abgewiesen).toHaveLength(1);
    expect((abgewiesen[0] as PromiseRejectedResult).reason).toMatchObject({ code: "CONFLICT" });
    // Der Schlüssel gehört genau einer Beziehung — und zwar der, die gespeichert wurde.
    expect((await repo.holeNachBeitrag("s-geteilt"))?.id).toBe(alle[0]?.id);
  });

  it("P8: der Schlüssel bleibt gebunden, auch nachdem die Beziehung widerrufen wurde", async (ctx) => {
    if (nichtVerfuegbar()) {
      ctx.skip();
      return;
    }
    // Wäre die Bindung an den Status geknüpft, liesse sich die Abweisung aus P7 umgehen: erst
    // widerrufen, dann denselben Schlüssel für etwas anderes benutzen. Ein gesendeter Beitrag
    // bleibt gesendet — auch wenn seine Beziehung zurückgenommen wurde.
    const repo = await frischerBestand();
    const kos = [
      { id: "ko-links", version: 1, history: [] },
      { id: "ko-rechts", version: 1, history: [] },
      { id: "ko-drittes", version: 1, history: [] },
    ] as unknown as readonly KnowledgeObject[];
    const dienst = schreibdienst(repo, kos);
    const sichtbar = { sichtbar: () => true };

    const { kante: gesetzt } = await dienst.setze(eingabe("k-p8", "s-gebunden"), sichtbar);
    await dienst.widerrufe(
      gesetzt.id,
      { urheber: "admin-1", jetzt: "2026-09-16T09:00:00.000Z", erwarteteVersion: 1 },
      sichtbar,
    );

    await expect(
      dienst.setze({ ...eingabe("k-p8-fremd", "s-gebunden"), zielId: "ko-drittes" }, sichtbar),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await repo.fuerKo("ko-drittes")).toEqual([]);
  });

  it("P9: die Bindung hängt an der DATENBANK, nicht am Anwendungscode", async (ctx) => {
    if (nichtVerfuegbar()) {
      ctx.skip();
      return;
    }
    // Dasselbe Argument wie in P2, eine Ebene tiefer: am Adapter vorbei direkt eingefügt, weist
    // der Primärschlüssel der Bindungstabelle den zweiten Anspruch ab. Fiele er weg, wäre jeder
    // Schutz darüber nur noch eine Absprache zwischen zwei Anfragen, die einander nicht kennen.
    const repo = await frischerBestand();
    await repo.setzeMitBindung(kante({ quelleId: "ko-a", zielId: "ko-b", id: "k-1" }), "s-eins");
    const doppelt = (pool as Pool).query(
      "INSERT INTO ko_kanten_beitrag (beitrag_schluessel, kante_id) VALUES ('s-eins', 'k-fremd')",
    );
    await expect(doppelt).rejects.toMatchObject({ code: "23505" });
    expect((await repo.holeNachBeitrag("s-eins"))?.id).toBe("k-1");
  });
});

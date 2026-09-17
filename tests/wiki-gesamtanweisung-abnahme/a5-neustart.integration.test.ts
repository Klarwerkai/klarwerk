// ================================================================================================
// JOB 4156 · A5 — NACH DEM NEUSTART IST DIE ANWEISUNG NOCH DA. GEGEN ECHTES POSTGRES.
// ================================================================================================
//
// Lieferung 8 des Auftrags: „Nach Neustart des Serverprozesses ist eine angelegte Gesamtanweisung
// samt Reihenfolge und Entscheidung unverändert da — Bestand vorher und nachher verglichen."
//
// ------------------------------------------------------------------------------------------------
// WAS HIER „NEUSTART" HEISST — und warum das ehrlich ist
// ------------------------------------------------------------------------------------------------
// Ein echter Prozesswechsel lässt sich in vitest nicht herstellen. Nachgebildet wird deshalb GENAU
// das, was ein Neustart am Bestand ändert: JEDER prozessgebundene Zustand wird weggeworfen — die
// Verbindung (`pool.end()`), die Ablage (`PgAnweisungRepo`) und der Dienst. Danach entsteht alles
// NEU gegen dieselbe Datenbank. Was den Übergang übersteht, hat in der Datenbank gestanden und
// nirgendwo sonst; ein Speicherrest könnte ihn nicht überbrücken.
//
// DASS DAS DIE RICHTIGE FRAGE IST, zeigt die Gegenprobe (gefahren, siehe RUECKGABE): dieselben
// Schritte gegen den flüchtigen Rückfall der Kompositionswurzel — dort ist nach dem Wegwerfen
// nichts mehr da. Genau deshalb steht dieser Fall gegen Postgres und nicht gegen ein Double.
//
// ------------------------------------------------------------------------------------------------
// MIGRIERT WIRD ÜBER `repo.migriere()` — UND DAS IST EINE BENANNTE SCHWÄCHE DIESES FALLS
// ------------------------------------------------------------------------------------------------
// Der schärfere Weg wäre `migrate(pool)` aus `services/app/src/db.ts`, also der, den der Server
// wirklich geht. Er ist hier nicht möglich: die DDL steht modulintern in
// `services/knowledge-object/src/gesamtanweisung-repo-pg.ts` und ist nicht exportiert, also kennt
// `db.ts` sie nicht (Begründung ausgeschrieben dort am Ende der `schemas`-Liste und in
// `tests/wiki-gesamtanweisung/ddl-und-restarbeit.test.ts`).
//
// WAS DIESER FALL DAMIT BELEGT UND WAS NICHT: Er belegt, dass die Ablage einen Neustart übersteht —
// Bestand, Reihenfolge, Entscheidung und Prüfstände liegen wirklich in Postgres. Er belegt NICHT,
// dass eine frisch migrierte Anwendung diese Tabellen überhaupt hat; sie hat sie heute nicht.
// Genau diese Lücke hält `ddl-und-restarbeit.test.ts` als eigenen Fall fest.
//
// LAUF UND SKIP wie im eingeführten Muster (`postgres-atomar.integration.test.ts`):
// `*.integration.test.ts` ist aus dem Tor-Lauf ausgeschlossen (`vitest.config.ts`, `AUSSCHLUSS`).
// Lokale `KLARWERK_PG_TEST_URL` hat Vorrang und geht durch dieselbe harte Sicherung, sonst
// Testcontainers, sonst ein SICHTBARER Skip mit Klartext-Grund statt eines Fehlschlags.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { GesamtanweisungDienst, PgAnweisungRepo } from "../../services/knowledge-object";
import type {
  AnweisungFassungssatz,
  AnweisungKoFakten,
  AnweisungKoLeser,
} from "../../services/knowledge-object/src/gesamtanweisung-service";

/** Zwei Wissenseinträge, die es WIRKLICH gibt — sonst lehnt der Dienst die Aufnahme zu Recht ab. */
const FAKTEN: Record<string, AnweisungKoFakten> = {
  "ko-a": {
    id: "ko-a",
    title: "Ventil öffnen",
    status: "approved",
    version: 1,
    author: "anna",
    category: "Betrieb",
    bodyHtml: "<p>Ventil öffnen.</p>",
  },
  "ko-b": {
    id: "ko-b",
    title: "Druck prüfen",
    status: "approved",
    version: 1,
    author: "anna",
    category: "Betrieb",
    bodyHtml: "<p>Druck prüfen.</p>",
  },
};

const ko: AnweisungKoLeser = {
  async get(id) {
    return FAKTEN[id];
  },
  async versionsOf(id) {
    const fakten = FAKTEN[id];
    return fakten
      ? ([
          { version: 1, at: "2026-09-01T08:00:00.000Z", author: "anna", snapshot: fakten },
        ] as readonly AnweisungFassungssatz[])
      : [];
  },
};

let zaehler = 0;
function frischerDienst(pool: Pool): GesamtanweisungDienst {
  return new GesamtanweisungDienst({
    repo: new PgAnweisungRepo(pool),
    ko,
    jetzt: () => "2026-09-17T10:00:00.000Z",
    kennung: () => {
      zaehler += 1;
      return `b-${zaehler}`;
    },
  });
}

describe("A5 · eine Gesamtanweisung übersteht den Neustart des Serverprozesses", () => {
  let container: StartedTestContainer | undefined;
  let url: string | undefined;
  let pool: Pool | undefined;
  let available = false;

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = new Pool({ connectionString: localUrl });
        await pool.query("SELECT 1");
        url = localUrl;
        available = true;
        return;
      } catch {
        process.stderr.write(
          "[KLARWERK] JOB 4156 A5 ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
        );
        available = false;
        return;
      }
    }
    if (process.env.KLARWERK_PG_TEST_URL) {
      // Die Sicherung hat die URL abgelehnt (Grund steht auf stderr) — KEIN Container-Rückfall.
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
      pool = new Pool({ connectionString: url });
      available = true;
    } catch {
      process.stderr.write(
        "[KLARWERK] JOB 4156 A5 ÜBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar.\n",
      );
      available = false;
    }
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it("Bestand, Reihenfolge und Entscheidung sind nach dem Neustart unverändert", async (ctx) => {
    if (!available || !pool || !url) {
      ctx.skip();
      return;
    }
    const ersterPool = pool;
    for (const t of ["gesamtanweisung_staende", "gesamtanweisung_bausteine", "gesamtanweisungen"]) {
      await ersterPool.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
    }

    // ------------------------------------------------------------------------------------------
    // VOR DEM NEUSTART — über den ECHTEN Migrationsweg der Anwendung.
    // ------------------------------------------------------------------------------------------
    await new PgAnweisungRepo(ersterPool).migriere();

    const vorher = frischerDienst(ersterPool);
    const angelegt = await vorher.anlegen({ titel: "Anlage anfahren" }, "anna");
    const mitA = await vorher.bausteinAufnehmen(
      angelegt.id,
      angelegt.version,
      { koId: "ko-a", koVersion: 1, nachweisHash: "ha" },
      () => true,
    );
    const mitB = await vorher.bausteinAufnehmen(
      mitA.id,
      mitA.version,
      { koId: "ko-b", koVersion: 1, nachweisHash: "hb" },
      () => true,
    );
    // Die Reihenfolge UMDREHEN — sonst belegte der Fall nur, dass die Einfügereihenfolge hält.
    const umgedreht = [...mitB.bausteine].map((b) => b.id).reverse();
    const geordnet = await vorher.reihenfolgeSetzen(mitB.id, mitB.version, umgedreht, () => true);
    const vorgelegt = await vorher.vorlegen(geordnet.id, geordnet.version, () => true);
    const entschieden = await vorher.entscheiden(
      vorgelegt.id,
      vorgelegt.version,
      "angenommen",
      () => true,
    );
    expect(entschieden.stand).toBe("entschieden");

    /** Der BESTAND als Zahl — drei Tabellen, damit „unverändert" nicht nur den Kopf meint. */
    async function bestand(p: Pool): Promise<Record<string, number>> {
      const zeilen: Record<string, number> = {};
      for (const t of [
        "gesamtanweisungen",
        "gesamtanweisung_bausteine",
        "gesamtanweisung_staende",
      ]) {
        const ergebnis = await p.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${t}`);
        zeilen[t] = Number(ergebnis.rows[0]?.n ?? "0");
      }
      return zeilen;
    }

    const bestandVorher = await bestand(ersterPool);
    const gelesenVorher = await vorher.lesen(entschieden.id, () => true);
    // Belegt, dass überhaupt etwas da ist — ein Vergleich von 0 mit 0 wäre grün und wertlos.
    expect(bestandVorher.gesamtanweisungen).toBe(1);
    expect(bestandVorher.gesamtanweisung_bausteine).toBe(2);
    expect(bestandVorher.gesamtanweisung_staende).toBeGreaterThanOrEqual(5);

    // ------------------------------------------------------------------------------------------
    // DER NEUSTART: jeder prozessgebundene Zustand wird weggeworfen.
    // ------------------------------------------------------------------------------------------
    await ersterPool.end();
    pool = new Pool({ connectionString: url });
    const zweiterPool = pool;
    // Auch das gehört zum Neustart: die Anwendung migriert bei jedem Start erneut. Additiv und
    // wiederholbar heisst, dass das folgenlos bleibt — träfe es nicht zu, fiele der Bestand hier.
    await new PgAnweisungRepo(zweiterPool).migriere();

    const nachher = frischerDienst(zweiterPool);
    const bestandNachher = await bestand(zweiterPool);
    // DER VERGLEICH, um den es geht: dieselben Zahlen, nicht nur „nicht leer".
    expect(bestandNachher).toEqual(bestandVorher);

    const gelesenNachher = await nachher.lesen(entschieden.id, () => true);
    expect(gelesenNachher.titel).toBe("Anlage anfahren");
    expect(gelesenNachher.stand).toBe("entschieden");
    expect(gelesenNachher.version).toBe(entschieden.version);
    // Die umgedrehte Reihenfolge ist noch die umgedrehte.
    expect(gelesenNachher.bausteine.map((b) => b.koId)).toEqual(
      gelesenVorher.bausteine.map((b) => b.koId),
    );
    expect(gelesenNachher.bausteine.map((b) => b.koId)).toEqual(["ko-b", "ko-a"]);
    // Und der Lückenvermerk überlebt den Neustart ebenfalls — er ist keine Anzeigelaune.
    expect(gelesenNachher.pruefanbindung).toBe("nicht_angebunden");

    // Die festgehaltenen Prüfstände sind nach dem Neustart vollständig LESBAR und nicht nur
    // gezählt: die Liste muss genau so viele Nummern haben, wie Zeilen in der Tabelle stehen.
    const staende = await nachher.staende(entschieden.id, () => true);
    expect(staende.length).toBe(bestandNachher.gesamtanweisung_staende);
    expect(staende).toEqual([...staende].sort((a, b) => a - b));
  }, 180_000);
});

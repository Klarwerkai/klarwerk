// ================================================================================================
// QUELLENÄNDERUNGEN (aufnahme:20260928) · GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// Was nur eine echte Datenbank beantwortet:
//   K4  die bewusste Übernahme schreibt GENAU einen neuen Stand; die früheren Prüfstände stehen
//       danach unverändert in `gesamtanweisung_staende` — hier in der Tabelle nachgesehen;
//   K4  Lesen mit gefundener Änderung schreibt NICHTS (keine automatische Inhaltsänderung);
//   K6  die entschiedene Anleitung steht nach der Übernahme in der Tabelle als `entwurf`;
//   K7  die übernommenen Änderungen kommen nach einem Neuaufbau von Ablage und Dienst aus den
//       GESPEICHERTEN Ständen zurück, nicht aus einem Arbeitsspeicher.
//
// GRENZE, ausdrücklich: die WISSENSEINTRÄGE kommen hier — wie in den bestehenden Postgres-Fällen der
// Gesamtanweisung — aus dem Prüfstand-Leser (`koLeser`), nicht aus der KO-Tabelle. Gespeichert und
// gelesen wird in Postgres die ANLEITUNG samt Historie.
//
// LAUF UND SKIP wörtlich im eingeführten Muster (`tests/wiki-gesamtanweisung-fassungsbindung/
// postgres-fassungsbindung.integration.test.ts`): lokale `KLARWERK_PG_TEST_URL` mit harter
// Sicherung, sonst Testcontainers, sonst SICHTBARER Skip. Ein übersprungener Lauf ist nie ein
// bestandener.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { PgAnweisungRepo } from "../../services/knowledge-object/src/gesamtanweisung-repo-pg";
import {
  type AnweisungKoLeser,
  GesamtanweisungDienst,
} from "../../services/knowledge-object/src/gesamtanweisung-service";
import {
  type PruefEintrag,
  eintrag,
  kennungen,
  koLeser,
  sichtbarAls,
  uhr,
} from "../wiki-gesamtanweisung/pruefstand";

const TABELLEN = ["gesamtanweisung_staende", "gesamtanweisung_bausteine", "gesamtanweisungen"];
const ANNA = sichtbarAls({ id: "anna", darfPruefen: true });

const V1 = { version: 1, bodyHtml: "<p>Druck auf 4 bar.</p>" };
const V2 = { version: 2, bodyHtml: "<p>Druck auf 5 bar.</p>" };

describe("QUELLENÄNDERUNGEN · bewusste Übernahme gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let available = false;

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = new Pool({ connectionString: localUrl });
        await pool.query("SELECT 1");
        available = true;
        return;
      } catch {
        process.stderr.write(
          "[KLARWERK] QUELLENÄNDERUNGEN ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
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
      pool = new Pool({
        connectionString: `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`,
      });
      available = true;
    } catch {
      process.stderr.write(
        "[KLARWERK] QUELLENÄNDERUNGEN ÜBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar.\n",
      );
      available = false;
    }
  }, 180_000);

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

  /** Ein Eintragsbestand, an dem eine neuere Fassung veröffentlicht werden kann. */
  function quelle(start: readonly PruefEintrag[]) {
    const bestand = new Map(start.map((e) => [e.id, e]));
    const leser: AnweisungKoLeser = {
      get: (id) => koLeser([...bestand.values()]).get(id),
      versionsOf: (id) => koLeser([...bestand.values()]).versionsOf(id),
    };
    return { leser, veroeffentliche: (neu: PruefEintrag) => bestand.set(neu.id, neu) };
  }

  function dienstAuf(p: Pool, leser: AnweisungKoLeser): GesamtanweisungDienst {
    return new GesamtanweisungDienst({
      repo: new PgAnweisungRepo(p),
      ko: leser,
      jetzt: uhr(),
      kennung: kennungen("b"),
    });
  }

  async function frisch(p: Pool): Promise<void> {
    for (const t of TABELLEN) {
      await p.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
    }
    await new PgAnweisungRepo(p).migriere();
  }

  async function bild(p: Pool, id: string) {
    const kopf = await p.query<{ version: number; stand: string }>(
      "SELECT version,stand FROM gesamtanweisungen WHERE id=$1",
      [id],
    );
    const bausteine = await p.query<{ ko_id: string; ko_version: number }>(
      "SELECT ko_id,ko_version FROM gesamtanweisung_bausteine WHERE anweisung_id=$1 ORDER BY pos",
      [id],
    );
    const staende = await p.query<{ version: number; aufnahme: unknown }>(
      "SELECT version,aufnahme FROM gesamtanweisung_staende WHERE anweisung_id=$1 ORDER BY version",
      [id],
    );
    return {
      kopf: kopf.rows[0] ?? null,
      fassungen: bausteine.rows.map((r) => [r.ko_id, r.ko_version]),
      staende: staende.rows.map((r) => r.version),
      aufnahmen: staende.rows.map((r) => JSON.stringify(r.aufnahme)),
    };
  }

  it("Lesen mit gefundener Änderung schreibt nichts; die Übernahme schreibt genau einen Stand", async (ctx) => {
    const p = requirePool(ctx);
    await frisch(p);
    const q = quelle([
      eintrag({ id: "ko-a", title: "Druck einstellen", version: 1 }, [V1]),
      eintrag({ id: "ko-b", title: "Ventil", version: 1 }, [{ version: 1 }]),
    ]);
    const dienst = dienstAuf(p, q.leser);

    let a = await dienst.anlegen({ titel: "Anfahren" }, "anna");
    for (const koId of ["ko-a", "ko-b"]) {
      a = await dienst.bausteinAufnehmen(
        a.id,
        a.version,
        { koId, koVersion: 1, nachweisHash: null },
        ANNA,
      );
    }
    a = await dienst.vorlegen(a.id, a.version, ANNA);
    a = await dienst.entscheiden(a.id, a.version, "angenommen", ANNA);
    const entschiedeneVersion = a.version;

    q.veroeffentliche(eintrag({ id: "ko-a", title: "Druck einstellen", version: 2 }, [V1, V2]));

    // K2/K4: gefunden, aber nichts geschrieben — die Tabellen bleiben, wie sie waren.
    const vorher = await bild(p, a.id);
    const gelesen = await dienst.lesen(a.id, ANNA);
    expect(gelesen.aenderungspruefung.ergebnis).toBe("aenderungen_gefunden");
    expect(gelesen.bausteine.find((b) => b.koId === "ko-a")?.aktualisierungsvorschlag).toEqual({
      aufVersion: 2,
    });
    expect(await bild(p, a.id)).toEqual(vorher);
    expect(vorher.kopf).toEqual({ version: entschiedeneVersion, stand: "entschieden" });

    // K4/K6: die bewusste Übernahme.
    const bausteinA = a.bausteine.find((b) => b.koId === "ko-a")?.id ?? "";
    const neu = await dienst.fassungUebernehmen(a.id, a.version, bausteinA, 2, null, ANNA);
    const nachher = await bild(p, a.id);
    expect(nachher.kopf).toEqual({ version: entschiedeneVersion + 1, stand: "entwurf" });
    expect(nachher.fassungen).toEqual([
      ["ko-a", 2],
      ["ko-b", 1],
    ]);
    // Genau EIN Stand mehr, und jeder frühere steht zeichengleich wie vorher in der Tabelle.
    expect(nachher.staende).toEqual([...vorher.staende, neu.version]);
    expect(nachher.aufnahmen.slice(0, vorher.aufnahmen.length)).toEqual(vorher.aufnahmen);
  });

  it("nach Neuaufbau von Ablage und Dienst kommt die übernommene Änderung aus den Ständen", async (ctx) => {
    const p = requirePool(ctx);
    await frisch(p);
    const q = quelle([eintrag({ id: "ko-a", version: 1 }, [V1])]);
    const erster = dienstAuf(p, q.leser);
    let a = await erster.anlegen({ titel: "Anfahren" }, "anna");
    a = await erster.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-a", koVersion: 1, nachweisHash: "h-1" },
      ANNA,
    );
    q.veroeffentliche(eintrag({ id: "ko-a", version: 2 }, [V1, V2]));
    const bausteinId = a.bausteine[0]?.id ?? "";
    const neu = await erster.fassungUebernehmen(a.id, a.version, bausteinId, 2, null, ANNA);

    // Ein zweiter Dienst über einer NEUEN Ablage auf derselben Datenbank — kein geteilter Speicher.
    const zweiter = dienstAuf(p, q.leser);
    const stand = await zweiter.lesen(a.id, ANNA);
    expect(stand.version).toBe(neu.version);
    expect(stand.bausteine[0]?.koVersion).toBe(2);
    expect(stand.bausteine[0]?.rumpfHtml).toContain("5 bar");
    expect(stand.aenderungspruefung.ergebnis).toBe("aktuell");
    expect(stand.aenderungspruefung.gefundeneAenderungen).toBe(0);
    expect(stand.uebernommeneAenderungen).toEqual([
      {
        bausteinId,
        vonFassung: 1,
        aufFassung: 2,
        anweisungVersion: neu.version,
        uebernommenAm: expect.any(String),
      },
    ]);

    // Der frühere Stand mit Fassung 1 ist weiterhin lesbar und vergleichbar.
    const vergleich = await zweiter.vergleichen(a.id, a.version, neu.version, ANNA);
    expect(vergleich.gesamt).toBe("geaendert");
  });
});

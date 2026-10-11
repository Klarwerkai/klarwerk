// ================================================================================================
// STATUS-FREIGABE (produkt:20261007) · DIE FREIGABEANGABEN GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// Was nur eine echte Datenbank beantwortet:
//   K3  Person, Zeitpunkt und Fassung einer neuen Freigabe stehen in `gesamtanweisungen` und kommen
//       nach einem Neuaufbau von Ablage und Dienst („Reload") unverändert zurück — aus der Tabelle,
//       nicht aus einem Arbeitsspeicher.
//   K4  Eine Zeile aus der Zeit VOR diesem Auftrag (Tabelle ohne die neuen Spalten, Stand
//       `entschieden`) bekommt durch die Migration KEINE Person: die Spalten kommen leer hinzu,
//       der Lesestand trägt keine Angabe.
//
// LAUF UND SKIP wörtlich im eingeführten Muster (`tests/quellenaenderungen-bewusst-uebernehmen/
// postgres.integration.test.ts`): lokale `KLARWERK_PG_TEST_URL` mit harter Sicherung, sonst
// Testcontainers, sonst SICHTBARER Skip. Ein übersprungener Lauf ist nie ein bestandener.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { PgAnweisungRepo } from "../../services/knowledge-object/src/gesamtanweisung-repo-pg";
import { GesamtanweisungDienst } from "../../services/knowledge-object/src/gesamtanweisung-service";
import { eintrag, kennungen, koLeser, sichtbarAls, uhr } from "../wiki-gesamtanweisung/pruefstand";

const TABELLEN = ["gesamtanweisung_staende", "gesamtanweisung_bausteine", "gesamtanweisungen"];
const CARLA = sichtbarAls({ id: "carla", darfPruefen: true });
const LESER = koLeser([
  eintrag({ id: "ko-a", title: "Druck einstellen", version: 1 }, [{ version: 1 }]),
]);

/** Die Tabellenform VOR diesem Auftrag — wörtlich der frühere Kopf, ohne `entsch…`-Spalten. */
const ALTE_FORM = `
CREATE TABLE gesamtanweisungen (
  id text PRIMARY KEY,
  version int NOT NULL,
  stand text NOT NULL,
  titel text NOT NULL,
  zweck text NOT NULL,
  geltungsbereich text NOT NULL,
  voraussetzungen text NOT NULL,
  urheber text NOT NULL,
  erstellt_am text NOT NULL,
  geaendert_am text NOT NULL
);
`;

describe("STATUS-FREIGABE · Freigabeangaben der Anleitung gegen echtes PostgreSQL", () => {
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
          "[KLARWERK] STATUS-FREIGABE ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
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
        "[KLARWERK] STATUS-FREIGABE ÜBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar.\n",
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

  function dienstAuf(p: Pool): GesamtanweisungDienst {
    return new GesamtanweisungDienst({
      repo: new PgAnweisungRepo(p),
      ko: LESER,
      jetzt: uhr(),
      kennung: kennungen("b"),
    });
  }

  async function leer(p: Pool): Promise<void> {
    for (const t of TABELLEN) {
      await p.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
    }
  }

  it("K3 · Person, Zeitpunkt und Fassung stehen in der Tabelle und überstehen den Neuaufbau", async (ctx) => {
    const p = requirePool(ctx);
    await leer(p);
    await new PgAnweisungRepo(p).migriere();
    const dienst = dienstAuf(p);

    let a = await dienst.anlegen({ titel: "Anfahren" }, "anna");
    a = await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-a", koVersion: 1, nachweisHash: null },
      CARLA,
    );
    a = await dienst.vorlegen(a.id, a.version, CARLA);
    const entschieden = await dienst.entscheiden(a.id, a.version, "angenommen", CARLA, "carla");

    const zeile = await p.query<{
      stand: string;
      entscheidung: string | null;
      entschieden_von: string | null;
      entschieden_am: string | null;
      entschieden_version: number | null;
    }>(
      "SELECT stand,entscheidung,entschieden_von,entschieden_am,entschieden_version FROM gesamtanweisungen WHERE id=$1",
      [a.id],
    );
    expect(zeile.rows[0]).toEqual({
      stand: "entschieden",
      entscheidung: "angenommen",
      entschieden_von: "carla",
      entschieden_am: entschieden.geaendertAm,
      entschieden_version: entschieden.version,
    });

    // „Reload": neue Ablage, neuer Dienst, derselbe Pool — gelesen wird aus der Tabelle.
    const neu = dienstAuf(p);
    const stand = await neu.lesen(a.id, CARLA);
    expect(stand.entscheidung).toEqual({
      ergebnis: "angenommen",
      von: "carla",
      am: entschieden.geaendertAm,
      version: entschieden.version,
    });
    const liste = await neu.auflisten(CARLA);
    expect(liste.eintraege.find((e) => e.id === a.id)?.entscheidung).toEqual(stand.entscheidung);
  });

  it("K4 · eine ältere Freigabe ohne Person bleibt nach der Migration ohne Person", async (ctx) => {
    const p = requirePool(ctx);
    await leer(p);
    // Der Bestand VOR diesem Auftrag: die alte Kopftabelle mit einer entschiedenen Anleitung.
    await p.query(ALTE_FORM);
    await p.query(
      `INSERT INTO gesamtanweisungen(id,version,stand,titel,zweck,geltungsbereich,voraussetzungen,urheber,erstellt_am,geaendert_am)
       VALUES('a-alt',5,'entschieden','Altanleitung','','','','anna','2026-09-01T08:00:00.000Z','2026-09-20T08:00:00.000Z')`,
    );
    // Die Migration läuft über den bestehenden Bestand — dieselbe Konstante wie `migrate()`.
    await new PgAnweisungRepo(p).migriere();

    const roh = await p.query<{ entschieden_von: string | null; entscheidung: string | null }>(
      "SELECT entschieden_von,entscheidung FROM gesamtanweisungen WHERE id='a-alt'",
    );
    expect(roh.rows[0]).toEqual({ entschieden_von: null, entscheidung: null });

    const stand = await dienstAuf(p).lesen("a-alt", CARLA);
    expect(stand.stand).toBe("entschieden");
    expect(stand.version).toBe(5);
    expect(stand.entscheidung).toBeUndefined();
    // Weder die Urheberin noch sonst jemand wird als freigebende Person eingesetzt.
    expect(JSON.stringify(stand)).not.toContain('"von"');
  });
});

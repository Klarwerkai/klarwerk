// ================================================================================================
// JOB 4265 · V — DER NACHWEIS DES VERBINDUNGSENDES, UND DIE KALIBRIERUNG SEINES WERKZEUGS.
// ================================================================================================
//
// WARUM DIESE DATEI NEBEN DEN BEIDEN GASTWEG-LÄUFEN STEHT. Der Abbruchfehler aus JOB 4223 Runde 3
// („terminating connection due to administrator command") ist ein WETTLAUF: er erscheint unter
// Last und bleibt auf einem freien Rechner aus. Ein Nachweis, der nur im Gastweg-Lauf mitliefe,
// wäre deshalb an guten Tagen stumm — er sähe nichts und behauptete, es sei nichts da.
//
// Diese Datei macht dieselbe fehlende Zusage SICHTBAR, ohne sie zu erfinden: sie entleiht dem Pool
// so viele Verbindungen, wie er führen darf, gibt sie ordnungsgemäss zurück und beendet ihn dann.
// Zehn gleichzeitig abgebaute Verbindungen brauchen messbar länger, als eine einzige Abfrage über
// die Schleife dauert — was im Gastweg-Lauf ein Zufallstreffer ist, ist hier die Regel.
//
// K1 KALIBRIERT DAS WERKZEUG, AUF DEM DER NACHWEIS STEHT. Ein `offeneVerbindungen`, das immer eine
// leere Liste zurückgäbe (falscher Datenbankname, fehlende Rechte, vertippte Spalte), machte V1
// und die beiden `afterAll`-Zusicherungen der Gastwegläufe in einem Zug stumm — und zwar GRÜN.
// Dieselbe Bauform wie W0.* in `tests/q9-oidc-literalquelle/…`: erst das Messgerät prüfen, dann
// mit ihm messen.
//
// PRÜFGRENZE, LAUT GEMELDET: Ohne echte PostgreSQL wird der Grund SICHTBAR auf stderr gemeldet und
// übersprungen. KEINE PRODUKTIVDATEN: ausschliesslich eine Wegwerf-Datenbank mit „test" im Namen.
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { alsBefund, offeneVerbindungen, warteAufVerbindungsende } from "./verbindungsende";

const JOB = "[KLARWERK] JOB 4265";

/** Zusammengesetzt statt ausgeschrieben — s. `durchgehender-gastweg.integration.test.ts`. */
const PG_SCHEMA = "postgresql:";

/** So viele Verbindungen führt ein `pg`-Pool nach Vorgabe. Alle zugleich, damit der Abbau zählt. */
const GLEICHZEITIG = 10;

/**
 * Auf ein Ereignis WARTEN statt annehmen, es sei schon da.
 *
 * Runde 1 dieses Auftrags hatte hier eine Zeitannahme stehen („nach einer Serverabfrage wird die
 * Meldung schon angekommen sein") — und sie war falsch, gemessen in Arbeitsprüfung
 * `5e0901cf39f24ebd8a3f3a045e6308d8`: `expected 0 to be greater than 0`. Eine Zusicherung, die von
 * der Geschwindigkeit des Rechners abhängt, misst den Rechner und nicht den Gegenstand.
 */
async function warteBis(bedingung: () => boolean, was: string, frist = 10_000): Promise<void> {
  const begonnen = Date.now();
  while (!bedingung()) {
    if (Date.now() - begonnen >= frist) {
      throw new Error(`${JOB}: ${was} (${frist} ms gewartet).`);
    }
    await new Promise((weiter) => setTimeout(weiter, 5));
  }
}

interface Verbindung {
  host: string;
  port: string;
  user: string;
  passwort: string;
}

function zerlege(url: string): Verbindung | undefined {
  try {
    const u = new URL(url.replace(/^postgres(ql)?:/, "http:"));
    if (!u.hostname) {
      return undefined;
    }
    return {
      host: u.hostname,
      port: u.port || "5432",
      user: decodeURIComponent(u.username) || "postgres",
      passwort: decodeURIComponent(u.password),
    };
  } catch {
    return undefined;
  }
}

function pgUrl(v: Verbindung, datenbank: string): string {
  if (!datenbank.toLowerCase().includes("test")) {
    throw new Error(
      `${JOB}: „${datenbank}" trägt kein „test" im Namen — diese Suite fasst ausschliesslich Wegwerf-Datenbanken an.`,
    );
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

describe("JOB 4265 V · das Verbindungsende der Wegwerf-Datenbank", () => {
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let verfuegbar = false;
  const wegwerfDb = `klarwerk_verbindungsende_test_${`${Date.now()}`.slice(-9)}`;

  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      process.stderr.write(
        `${JOB} V UEBERSPRUNGEN: keine gesicherte KLARWERK_PG_TEST_URL — das Verbindungsende ist damit nicht messbar.\n`,
      );
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(
        `${JOB} V UEBERSPRUNGEN: KLARWERK_PG_TEST_URL nennt keinen Rechnernamen.\n`,
      );
      return;
    }
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${wegwerfDb}`);
    verfuegbar = true;
  }, 240_000);

  afterAll(async () => {
    if (adminPool) {
      await adminPool
        .query(`DROP DATABASE IF EXISTS ${wegwerfDb} WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end();
    }
  }, 120_000);

  it("K1 — `offeneVerbindungen` sieht eine offene Verbindung und sieht sie nach dem Schliessen nicht mehr", async (ctx) => {
    if (!verfuegbar || !verbindung || !adminPool) {
      ctx.skip();
      return;
    }
    // Die Kalibrierung braucht EINE Verbindung, über die alles bekannt ist: sie wird hier von Hand
    // geöffnet, benannt und wieder geschlossen. Ohne diesen Fall könnte das Werkzeug blind sein und
    // jede darauf gestützte Zusicherung bliebe trotzdem grün.
    const einzeln = new Pool({
      connectionString: pgUrl(verbindung, wegwerfDb),
      application_name: "klarwerk-kalibrierung-4265",
    });
    try {
      await einzeln.query("SELECT 1");
      const gesehen = await offeneVerbindungen(adminPool, wegwerfDb);
      expect(
        gesehen.length,
        `die offene Kalibrierverbindung wird nicht gesehen — das Werkzeug ist blind:\n  ${alsBefund(gesehen)}`,
      ).toBeGreaterThan(0);
      expect(
        gesehen.map((z) => z.anwendung),
        "die gesehene Verbindung ist nicht die, die hier geöffnet wurde",
      ).toContain("klarwerk-kalibrierung-4265");
    } finally {
      await einzeln.end();
    }
    // Und die Gegenrichtung: nach dem Verbindungsende ist die Liste wirklich leer. Ein Werkzeug,
    // das immer etwas meldet, wäre genauso unbrauchbar wie eines, das nie etwas meldet.
    const danach = await warteAufVerbindungsende(adminPool, wegwerfDb);
    expect(
      danach.rest,
      `nach dem Schliessen hängt noch etwas an ${wegwerfDb}:\n  ${alsBefund(danach.rest)}`,
    ).toEqual([]);
  }, 120_000);

  it("V0 — `await pool.end()` kehrt zurück, BEVOR eine Verbindung wirklich beendet ist — die Ursache selbst", async (ctx) => {
    if (!verfuegbar || !verbindung || !adminPool) {
      ctx.skip();
      return;
    }
    // ============================================================================================
    // DIESER FALL HÄLT DEN GRUND FEST, AUS DEM ES DEN NACHWEIS ÜBERHAUPT GIBT.
    // ============================================================================================
    //
    // Der Abbruchfehler selbst ist ein Wettlauf und auf einem freien Rechner nicht auslösbar (drei
    // eigene Läufe am unveränderten Stand: Exit 0). Seine URSACHE ist dagegen keine Frage des
    // Zeitpunkts, sondern steht im Quelltext — und genau sie wird hier gemessen:
    //
    //   · `Client.end(cb)` hängt `cb` an das `end`-Ereignis der Verbindung
    //     (`node_modules/pg/lib/client.js:755-761`) — es kommt erst, wenn der Socket wirklich zu ist.
    //   · `Pool._remove` reicht genau diesen Weg weiter und meldet dort `remove`
    //     (`node_modules/pg-pool/index.js:181-187`).
    //   · `Pool._pulseQueue` löst das End-Callback aber schon aus, sobald `_clients` leer ist
    //     (`:140-143`) — und leer ist die Liste seit der SYNCHRONEN Zeile `:179`.
    //
    // `await pool.end()` heisst deshalb „der Pool führt keine Clients mehr", nicht „die Backends
    // sind weg". Ohne diesen Fall stünde diese Begründung nur in einem Kommentar.
    //
    // WIRD `pool.end()` EINES TAGES AUF DAS VERBINDUNGSENDE WARTEN, wird dieser Fall rot. Das ist
    // beabsichtigt und die richtige Meldung: dann ist die Ursache fort, und der Nachweis in den
    // beiden Gastwegläufen darf vereinfacht werden. Ein Fall, der beide Welten grün fände, sagte
    // über keine etwas.
    const pool = createPool(pgUrl(verbindung, wegwerfDb));
    await pool.query("SELECT 1");
    let wirklichBeendet = 0;
    pool.on("remove", () => {
      wirklichBeendet += 1;
    });

    await pool.end();

    expect(
      wirklichBeendet,
      "`pool.end()` hat auf das Verbindungsende gewartet — dann ist die Ursache des Abbruchfehlers fort",
    ).toBe(0);
    // DIE GEGENPROBE ZUR NULL: Ohne sie bewiese sie nichts — ein Horcher, der nie anspricht, zählt
    // ebenfalls bis null. Also wird auf die Meldung GEWARTET, statt sie zu unterstellen. Sie kommt;
    // nur eben nach dem Ende von `pool.end()` und nicht davor, und genau das ist der Befund.
    await warteBis(
      () => wirklichBeendet > 0,
      "der Pool meldet den Abbau seiner Verbindung überhaupt nicht (`remove`) — dann zählt die Null oben nur einen tauben Horcher",
    );
    const nachgereicht = await warteAufVerbindungsende(adminPool, wegwerfDb);
    expect(
      nachgereicht.rest,
      `nach dem Warten hängt noch etwas:\n  ${alsBefund(nachgereicht.rest)}`,
    ).toEqual([]);
  }, 120_000);

  it("V1 — nach dem Nachweis hängt keine Verbindung mehr an der Wegwerf-Datenbank, auch nach zehn gleichzeitigen", async (ctx) => {
    if (!verfuegbar || !verbindung || !adminPool) {
      ctx.skip();
      return;
    }
    const pool = createPool(pgUrl(verbindung, wegwerfDb));
    // Alle Verbindungen ZUGLEICH entleihen: ein Pool baut sie erst auf, wenn sie gebraucht werden,
    // und ein einziger `query`-Aufruf hinterliesse genau eine. Der Abbau von zehn ist das, was im
    // Gastweg-Lauf unter Last geschieht.
    const entliehen = await Promise.all(Array.from({ length: GLEICHZEITIG }, () => pool.connect()));
    await Promise.all(entliehen.map((c) => c.query("SELECT 1")));
    const waehrenddessen = await offeneVerbindungen(adminPool, wegwerfDb);
    expect(
      waehrenddessen.length,
      "der Pool hat nicht wirklich zehn Verbindungen geöffnet — dann misst V1 den Abbau nicht",
    ).toBe(GLEICHZEITIG);
    for (const client of entliehen) {
      client.release();
    }

    // DAS IST DIE STELLE, AN DER DER LAUF AUS JOB 4223 WEITERGEFAHREN IST.
    await pool.end();
    const befund = await warteAufVerbindungsende(adminPool, wegwerfDb);
    process.stderr.write(
      `${JOB} V1 · unmittelbar nach pool.end() hingen noch ${befund.zuBeginn.length} von ${GLEICHZEITIG} Verbindungen · ${befund.abfragen} Abfrage(n) · ${befund.wartezeitMs} ms bis zum vollständigen Ende\n`,
    );
    expect(
      befund.rest,
      `zum Zeitpunkt eines DROP DATABASE hinge noch etwas an ${wegwerfDb} — genau darauf schiesst WITH (FORCE):\n  ${alsBefund(befund.rest)}`,
    ).toEqual([]);
  }, 120_000);
});

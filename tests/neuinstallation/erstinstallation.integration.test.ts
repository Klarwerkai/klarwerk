import { type ChildProcessWithoutNullStreams, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

// ==================================================================================================
// JOB 4201 — DIE LEERE KUNDENINSTANZ: AUFSETZEN, BEFUELLEN, NEU STARTEN, WIEDERFINDEN.
// ==================================================================================================
//
// DIE FRAGE, DIE HIER BEANTWORTET WIRD, ist die des Betreibers am ersten Tag: *Ich habe eine leere
// Maschine. Komme ich nach der Anleitung an — und ist morgen noch da, was ich heute eingegeben
// habe?* Bis JOB 4201 gab es dafuer keinen einzigen Lauf: `tests/insel-update/**` misst Update und
// Rueckfall auf dem Mac Studio, `tests/backup-drill/**` misst Sicherung und Wiederherstellung.
// Eine ERSTinstallation ist keines von beidem.
//
// DIE STRECKE IST DER ERSTE TAG EINER KUNDENINSTANZ, mit den ECHTEN Bausteinen an jeder Stelle:
//   1. eine LEERE Datenbank — keine Migration von Hand, keine vorgesetzten Zeilen;
//   2. die Anwendung meldet „Ersteinrichtung noetig" und laesst genau EINEN Administrator entstehen
//      (`POST /api/auth/setup`); der zweite Versuch bekommt 409;
//   3. der oeffentliche Registrierweg ist dabei ZU — das ist der gemessene Gegensatz zu
//      `docs/operations/deploy-hetzner.md:18` (Stand 05.07.2026);
//   4. ein synthetisches Wissensobjekt mit Quelle und einem hochgeladenen Anhang mit BEKANNTEM
//      Inhalt, dazu ein zweites Konto mit eingeschraenktem Recht;
//   5. der Wiederanlauf;
//   6. DER BELEG: Inhalt, Quelle, Anhangszuordnung, Rechte und die Datei kommen BYTE FUER BYTE
//      zurueck — ueber die echte Route `/api/objects/:id/raw`, mit derselben Sitzung wie vorher.
//
// ================================================================================================
// RUNDE 2 — „WIEDERANLAUF" IST DREIERLEI, UND DIESE DATEI SAGT JETZT, WELCHES SIE MISST.
// ================================================================================================
//
// BEN hat Runde 1 zu Recht beanstandet: dort stand EIN Fall, der „Neustart von Anwendung UND
// Datenbank" hiess und in Wahrheit den Verbindungspool schloss und eine zweite `buildApp`-Instanz
// im selben Prozess aufbaute. Drei verschiedene Dinge waren zu einem Wort verschmolzen:
//
//   (a) NEU AUFGEBAUTE ANWENDUNG (API-Ebene, selber Prozess)  → N1
//       Zeigt: Bestand, Rechte und Sitzungen liegen in der Datenhaltung, nicht im Arbeitsspeicher.
//   (b) ECHTER PROZESSNEUSTART (`server.ts` als eigener Prozess, echter Socket, SIGTERM)  → N3
//       Zeigt zusaetzlich: der PRODUKTIONSEINSTIEG faehrt gegen diesen Bestand wieder hoch —
//       Startvertrag, Migration auf vorhandenem Schema, Auslieferung, alles aus einem kalten Start.
//   (c) NEUSTART DES DATENBANKDIENSTES  → nur in N1, und nur wo die Suite den Dienst SELBST besitzt
//       (Testcontainer). Gehoert die PostgreSQL dem Pruefstand, wird sie nicht angefasst.
//
// Was WEITERHIN nicht gemessen wird und deshalb nirgends behauptet werden darf: der Aufbau ueber
// `docker compose` selbst, das gebaute Abbild, ein Browser und TLS. Dafuer ist N2 da, soweit das
// Werkzeug vorhanden ist — und sonst steht dort ein sichtbarer Uebersprung.
//
// PRUEFGRENZE, EHRLICH GEMELDET (Lehre 12.09., JOB 3668): Diese Suite braucht eine echte
// PostgreSQL. Fehlt sie, wird der Grund SICHTBAR auf stderr gemeldet und uebersprungen. Ein stiller
// Skip saehe aus wie ein bestandener Lauf. Was dann traegt, ist `pflichtkonfiguration.test.ts` —
// der dockerfreie Dauerbeleg.
//
// SIE IST STARTBAR, ohne dass eine Zeile geaendert werden muss:
//
//     KLARWERK_PG_TEST_URL=postgres://user:pass@127.0.0.1:5432/klarwerk_test \
//       npx vitest run --config vitest.integration.config.ts \
//       tests/neuinstallation/erstinstallation.integration.test.ts
//
// KEINE PRODUKTIVDATEN, KEIN SERVER, KEIN DNS: Es wird ausschliesslich eine Wegwerf-Datenbank mit
// `test` im Namen angelegt und am Ende wieder entfernt (`guardedLocalPgTestUrl`-Regel). Die
// produktive Umgebung wird nicht beruehrt (Auftrag §10).
const WURZEL = resolve(import.meta.dirname, "../..");
const JOB = "[KLARWERK] JOB 4201";

const ADMIN_EMAIL = "erstinstallation-admin@example.test";
const ADMIN_PASSWORT = "erstinstallation-geheim-123";
const GAST_EMAIL = "erstinstallation-gast@example.test";
const GAST_PASSWORT = "erstinstallation-gast-456";
/** Der Titel der angehaengten Quelle — er muss den Wiederanlauf woertlich ueberstehen. */
const QUELLENTITEL = "Abnahmeprotokoll der Erstinstallation";

// Deterministische Nutzlast mit Nullbytes und hohen Bytes — daran faellt jede Umkodierung auf.
const QUELLBYTES = Buffer.concat(
  Array.from({ length: 8 }, (_, i) => createHash("sha256").update(`JOB4201-${i}`).digest()),
);

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

// Zusammengesetzt statt ausgeschrieben, aus demselben Grund wie in
// `tests/backup-drill/echter-wiederanlauf.integration.test.ts:84-106`: Fall N3 von
// `tests/app/job2354-drei-datenbanknamen.test.ts` liest jede ausgeschriebene Verbindungszeichenkette
// per Muster. Die Zusicherung geht dabei nicht verloren, sie wird strenger und zur LAUFZEIT
// geprueft: verbunden wird mit keinem Namen ohne `test`.
const PG_SCHEMA = "postgresql:";

// ------------------------------------------------------------------------------------------------
// RUNDE 2 · DAS WERKZEUG FUER DEN ECHTEN PROZESSNEUSTART (N3)
// ------------------------------------------------------------------------------------------------

/** Ein Port, auf dem gerade nichts horcht — vom Betriebssystem vergeben, nicht geraten. */
async function freierPort(): Promise<number> {
  return await new Promise<number>((fertig, scheitere) => {
    const horcher = createServer();
    horcher.once("error", scheitere);
    horcher.listen(0, "127.0.0.1", () => {
      const adresse = horcher.address();
      if (adresse === null || typeof adresse === "string") {
        horcher.close(() => scheitere(new Error(`${JOB}: kein Port zu bekommen.`)));
        return;
      }
      const port = adresse.port;
      horcher.close(() => fertig(port));
    });
  });
}

/**
 * Wartet, bis `/health` antwortet — und meldet SICHTBAR, woran es lag, wenn nicht.
 *
 * Kein stilles Weiterlaufen: Kaeme der Prozess nicht hoch und der Test maesse trotzdem weiter,
 * liefe er gegen den ALTEN Prozess oder gegen gar nichts, und beides saehe je nach Zeitpunkt wie
 * ein Ergebnis aus. Der mitgeschnittene Prozesstext steht deshalb in der Fehlermeldung.
 */
async function warteAufGesund(
  basis: string,
  prozess: ChildProcessWithoutNullStreams,
  protokoll: string[],
  was: string,
): Promise<void> {
  const frist = Date.now() + 120_000;
  while (Date.now() < frist) {
    if (prozess.exitCode !== null || prozess.signalCode !== null) {
      throw new Error(
        `${JOB} (${was}): der Serverprozess ist beendet (Code ${prozess.exitCode}, Signal ${prozess.signalCode}), bevor er antwortete.\n${protokoll.join("")}`,
      );
    }
    try {
      const antwort = await fetch(`${basis}/health`);
      if (antwort.ok) {
        return;
      }
    } catch {
      // noch nicht am Socket — weiter warten.
    }
    await new Promise((weiter) => setTimeout(weiter, 250));
  }
  throw new Error(
    `${JOB} (${was}): der Serverprozess antwortete in 120 s nicht auf /health.\n${protokoll.join("")}`,
  );
}

/** Ein HTTP-Aufruf ueber den echten Socket — Status, Rohtext und, wenn moeglich, JSON. */
async function sende(
  basis: string,
  verfahren: string,
  pfad: string,
  token?: string,
  rumpf?: unknown,
): Promise<{ status: number; text: string; json: unknown }> {
  const kopf: Record<string, string> = {};
  if (token) {
    kopf.authorization = `Bearer ${token}`;
  }
  if (rumpf !== undefined) {
    kopf["content-type"] = "application/json";
  }
  // `exactOptionalPropertyTypes` ist an: ein Feld `body: undefined` ist NICHT dasselbe wie ein
  // fehlendes Feld. Der Rumpf wird deshalb nur dann ins Objekt gelegt, wenn es einen gibt.
  const anfrage: RequestInit = { method: verfahren, headers: kopf };
  if (rumpf !== undefined) {
    anfrage.body = JSON.stringify(rumpf);
  }
  const antwort = await fetch(`${basis}${pfad}`, anfrage);
  const text = await antwort.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: antwort.status, text, json };
}

function pgUrl(v: Verbindung, datenbank: string): string {
  if (!datenbank.toLowerCase().includes("test")) {
    throw new Error(
      `${JOB}: „${datenbank}“ traegt kein „test“ im Namen — diese Suite fasst ausschliesslich Wegwerf-Datenbanken an und verbindet sich deshalb nicht.`,
    );
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

describe("JOB 4201 · eine leere Kundeninstanz aufsetzen, befuellen und neu starten", () => {
  let container: StartedTestContainer | undefined;
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let verfuegbar = false;

  const kennung = `${Date.now()}`.slice(-9);
  const kundeDb = `klarwerk_kunde_test_${kennung}`;
  // RUNDE 2: N3 braucht eine EIGENE leere Datenbank. N1 verfaelscht am Ende bewusst eine Zeile
  // (Gegenprobe); liefe N3 gegen denselben Bestand, maesse es einen praeparierten Schaden.
  const prozessDb = `klarwerk_prozess_test_${kennung}`;

  /** Die Kennungen, die ueber den Neustart hinweg wiedergefunden werden muessen. */
  let koId = "";
  let objektId = "";
  let adminToken = "";
  let gastToken = "";

  beforeAll(async () => {
    let url = guardedLocalPgTestUrl();
    if (!url && process.env.KLARWERK_PG_TEST_URL) {
      // Die Sicherung hat die URL abgelehnt (Grund steht auf stderr) — KEIN Container-Rueckfall:
      // wer ausdruecklich eine lokale Instanz wollte, bekommt keine stille zweite.
      return;
    }
    if (!url) {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
      } catch {
        process.stderr.write(
          `${JOB} UEBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfuegbar — eine Erstinstallation ist ohne echte PostgreSQL nicht messbar.\n`,
        );
        return;
      }
    }

    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(
        `${JOB} UEBERSPRUNGEN: KLARWERK_PG_TEST_URL nennt keinen Rechnernamen.\n`,
      );
      return;
    }

    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    // Die LEEREN Wegwerf-Datenbanken. Nichts darin — das ist der Ausgangspunkt dieses Auftrags.
    await adminPool.query(`CREATE DATABASE ${kundeDb}`);
    await adminPool.query(`CREATE DATABASE ${prozessDb}`);
    verfuegbar = true;
  }, 240_000);

  afterAll(async () => {
    if (adminPool) {
      for (const db of [kundeDb, prozessDb]) {
        await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      }
      await adminPool.end();
    }
    await container?.stop();
  }, 120_000);

  // ================================================================================================
  // N1 — DIE STRECKE AN DER API. RUNDE 2: WAS HIER GEMESSEN WIRD, HEISST JETZT SO, WIE ES IST.
  // ================================================================================================
  //
  // BENs BEFUND ZU RUNDE 1 (Prüfpunkt 3, Korrekturpflicht 3), und er trifft zu: Dieser Fall
  // startet KEINEN Anwendungsprozess neu. Er beendet den Verbindungspool und baut mit `buildApp`
  // eine ZWEITE Anwendung im SELBEN Prozess auf. Das ist eine ehrliche und nicht wertlose Messung —
  // sie zeigt, dass Bestand, Rechte und Sitzungen in der DATENHALTUNG liegen und nicht im
  // Arbeitsspeicher der ersten Anwendung —, aber sie ist kein Prozessneustart, und Runde 1 hat sie
  // als einen ausgegeben.
  //
  // DER ECHTE PROZESSNEUSTART steht seit Runde 2 daneben als N3: `server.ts` als eigener Prozess,
  // ueber einen echten Socket bedient, mit SIGTERM beendet und neu gestartet. Beide Faelle bleiben
  // — sie messen Verschiedenes, und keiner ersetzt den anderen.
  //
  // WAS DIESER FALL ZUSAETZLICH KANN: Nur er fasst die DATENBANK an (Container-Neustart, wo die
  // Suite den Dienst selbst besitzt). N3 kann das nicht, ohne fremde Infrastruktur anzufassen.
  it("N1 · leer → erster Admin → erfasst → neu aufgebaute Anwendung (API-Ebene) → alles wieder da", async (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    const v = verbindung;
    const kundenUrl = pgUrl(v, kundeDb);

    // ---------------------------------------------------------------------------------------------
    // 1. DIE LEERE INSTANZ — und die Ersteinrichtung, die sie kontrolliert verlaesst.
    // ---------------------------------------------------------------------------------------------
    let pool = createPool(kundenUrl);
    try {
      await migrate(pool);
      const app = buildApp(buildPgServices(pool));

      const leer = await app.inject({ url: "/api/auth/status" });
      expect(leer.statusCode, leer.body).toBe(200);
      expect(leer.json().needsSetup, "Eine frische Instanz meldet keine Ersteinrichtung").toBe(
        true,
      );

      // DER GEMESSENE GEGENSATZ ZU `deploy-hetzner.md:18`. Der oeffentliche Registrierweg ist per
      // Vorgabe ZU; `tests/setup-env.ts:6` schaltet ihn fuer die Suite frei, weil hunderte
      // Bestandstests ihn brauchen. Hier wird der PRODUKTIONSZUSTAND gemessen, also wird die
      // Variable lokal entfernt und danach wiederhergestellt — dieselbe Regel, die setup-env.ts
      // selbst in Zeile 5 aufstellt.
      // `delete` und nicht `= undefined`: der Unterschied zwischen „nicht gesetzt" und „leer" ist
      // hier genau der Gegenstand — `selfRegistrationEnabled` prueft auf die Zeichenketten
      // „1"/„true", und eine Variable mit dem Wert `undefined` waere in `process.env` die
      // Zeichenkette „undefined".
      const vorgefunden = process.env.KLARWERK_SELF_REGISTRATION;
      delete process.env.KLARWERK_SELF_REGISTRATION;
      try {
        const zu = await app.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: { name: "Fremder", email: "fremder@example.test", password: "fremd-123456" },
        });
        expect(
          zu.statusCode,
          "Der oeffentliche Registrierweg steht offen — dann kann sich der erste Beliebige zum Administrator machen.",
        ).toBe(403);
        expect(zu.json().error).toBe("REGISTRATION_DISABLED");
      } finally {
        if (vorgefunden !== undefined) {
          process.env.KLARWERK_SELF_REGISTRATION = vorgefunden;
        }
      }

      const einrichtung = await app.inject({
        method: "POST",
        url: "/api/auth/setup",
        payload: { name: "Kunden Admin", email: ADMIN_EMAIL, password: ADMIN_PASSWORT },
      });
      expect(einrichtung.statusCode, einrichtung.body).toBe(201);
      expect(einrichtung.json().user.role).toBe("admin");

      // DAS FENSTER SCHLIESST SICH VON SELBST — das ist die Zusage, auf der die Anleitung steht.
      const zweiter = await app.inject({
        method: "POST",
        url: "/api/auth/setup",
        payload: { name: "Zweiter", email: "zweiter@example.test", password: "zweiter-123456" },
      });
      expect(
        zweiter.statusCode,
        "Die Ersteinrichtung liesse sich ein zweites Mal ausfuehren — dann waere sie keine.",
      ).toBe(409);
      expect(zweiter.json().error).toBe("ALREADY_SETUP");

      const anmeldung = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORT },
      });
      expect(anmeldung.statusCode, anmeldung.body).toBe(200);
      adminToken = anmeldung.json().token as string;
      const adminKopf = { authorization: `Bearer ${adminToken}` };

      // ---------------------------------------------------------------------------------------------
      // 2. DER BESTAND — ueber die echte Anwendung, nicht per SQL-Handstreich.
      // ---------------------------------------------------------------------------------------------
      const ko = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers: adminKopf,
        payload: {
          confidentiality: "intern",
          title: "Erstinstallation abnehmen",
          statement: "Nach der Einrichtung Health, Anmeldung und eine Erfassung pruefen.",
          type: "best_practice",
          category: "Betrieb",
        },
      });
      expect(ko.statusCode, ko.body).toBe(201);
      koId = ko.json().id as string;
      expect(koId).toBeTruthy();
      // RUNDE 2, KORREKTURPFLICHT 3 (BENs Prueflücke 6): Runde 1 reichte hier ein Feld `source` im
      // Anlegerumpf mit — und der oeffentliche Schreibweg VERWIRFT es (`ko-routes.ts:1179`,
      // `sources: _ignoredSources`). Das Wissensobjekt hatte also nie eine Quelle, und „mit Quelle"
      // war eine Behauptung ueber eine leere Liste. Die Quelle entsteht jetzt ueber den Weg, den es
      // wirklich gibt (`action: "add-source"`), und zwar UNTEN, nach dem Anhang: auf der
      // Vorgabestufe `search_on_click` braucht eine adresslose Quelle einen Anker in der eigenen
      // Anhangsliste (`decideExternalAttach`, attach-policy.ts:197-211).

      const hochgeladen = await app.inject({
        method: "POST",
        url: "/api/objects",
        headers: adminKopf,
        payload: {
          name: "abnahmebeleg.png",
          mime: "image/png",
          data: `data:image/png;base64,${QUELLBYTES.toString("base64")}`,
        },
      });
      expect(hochgeladen.statusCode, hochgeladen.body).toBe(201);
      objektId = hochgeladen.json().id as string;
      expect(objektId).toBeTruthy();

      const gebunden = await app.inject({
        method: "PUT",
        url: `/api/kos/${koId}`,
        headers: adminKopf,
        payload: {
          action: "attach",
          attachment: { name: "abnahmebeleg.png", mime: "image/png", objectId: objektId },
        },
      });
      expect(gebunden.statusCode, gebunden.body).toBe(200);

      // DIE QUELLE, verankert am eben gebundenen Anhang (s. Begruendung oben am Anlegeaufruf).
      const quelle = await app.inject({
        method: "PUT",
        url: `/api/kos/${koId}`,
        headers: adminKopf,
        payload: {
          action: "add-source",
          source: { label: QUELLENTITEL, objectId: objektId },
        },
      });
      expect(quelle.statusCode, quelle.body).toBe(200);
      // Gemessen statt angenommen: die Quelle steht wirklich am Objekt, BEVOR irgendetwas neu
      // startet. Ohne diese Zeile waere der Vergleich nach dem Wiederanlauf „leer gegen leer".
      const vorher = await app.inject({ url: `/api/kos/${koId}`, headers: adminKopf });
      expect(vorher.statusCode, vorher.body).toBe(200);
      expect((vorher.json().sources as { label: string }[]).map((q) => q.label)).toContain(
        QUELLENTITEL,
      );
      expect(
        (vorher.json().attachments as { objectId?: string }[]).map((a) => a.objectId),
      ).toContain(objektId);

      // Ein zweites Konto mit EINGESCHRAENKTEM Recht — sonst waere „Rechte unveraendert" eine
      // Aussage ueber ein einziges Allmachtskonto und damit keine.
      const gast = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: adminKopf,
        payload: {
          name: "Kunden Gast",
          email: GAST_EMAIL,
          password: GAST_PASSWORT,
          role: "viewer",
        },
      });
      expect(gast.statusCode, gast.body).toBe(201);

      const gastAnmeldung = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: GAST_EMAIL, password: GAST_PASSWORT },
      });
      expect(gastAnmeldung.statusCode, gastAnmeldung.body).toBe(200);
      gastToken = gastAnmeldung.json().token as string;

      // Die Rechtelage VOR dem Neustart, gemessen statt angenommen: der Gast kommt nicht an die
      // Nutzerverwaltung.
      const gastVorher = await app.inject({
        url: "/api/users",
        headers: { authorization: `Bearer ${gastToken}` },
      });
      expect(gastVorher.statusCode, gastVorher.body).toBe(403);
    } finally {
      await pool.end();
    }

    // ---------------------------------------------------------------------------------------------
    // 3. DER WIEDERANLAUF — und was daran gemessen ist.
    // ---------------------------------------------------------------------------------------------
    //
    // Die erste Anwendung ist mit `pool.end()` oben weg; unten entsteht eine ZWEITE im selben
    // Prozess. Das ist AUSDRUECKLICH kein Prozessneustart (dafuer ist N3 da) — es ist die Messung,
    // dass nichts von dem, was gleich zurueckkommt, im Arbeitsspeicher der ersten Anwendung lag.
    //
    // Die DATENBANK dagegen wird hier wirklich neu gestartet, sofern diese Suite ihren Dienst
    // selbst besitzt. Gehoert die PostgreSQL dem Pruefstand (`KLARWERK_PG_TEST_URL`), wird sie
    // NICHT angefasst, und das wird sichtbar gemeldet statt stillschweigend mitgezaehlt.
    if (container) {
      await container.restart({ timeout: 60_000 });
      // Der veroeffentlichte Port kann sich am Wirt neu ergeben — er wird deshalb NEU gelesen und
      // nicht angenommen.
      v.port = String(container.getMappedPort(5432));
    } else {
      process.stderr.write(
        `${JOB} TEILMESSUNG: gegen eine vorgegebene PostgreSQL (KLARWERK_PG_TEST_URL) wird NUR die Anwendung neu gestartet — der Datenbankdienst gehoert dann nicht dieser Suite und wird nicht angefasst.\n`,
      );
    }

    // ---------------------------------------------------------------------------------------------
    // 4. DER BELEG — dieselbe Sitzung, derselbe Inhalt, dieselbe Datei.
    // ---------------------------------------------------------------------------------------------
    pool = createPool(pgUrl(v, kundeDb));
    try {
      // KEINE zweite Migration und KEINE zweite Ersteinrichtung: was jetzt kommt, kommt aus der
      // Datenhaltung.
      const neu = buildApp(buildPgServices(pool));

      const status = await neu.inject({ url: "/api/auth/status" });
      expect(status.statusCode, status.body).toBe(200);
      expect(
        status.json().needsSetup,
        "Nach dem Neustart verlangt die Instanz erneut eine Ersteinrichtung — der Kontenbestand ist weg.",
      ).toBe(false);

      // DIE SITZUNG selbst hat den Neustart ueberstanden (sie liegt in der Datenbank, nicht im
      // Prozess). Deshalb wird hier NICHT neu angemeldet — das waere die schwaechere Messung.
      const adminKopf = { authorization: `Bearer ${adminToken}` };

      const wieder = await neu.inject({ url: `/api/kos/${koId}`, headers: adminKopf });
      expect(wieder.statusCode, wieder.body).toBe(200);
      expect(wieder.json().title).toBe("Erstinstallation abnehmen");
      expect(wieder.json().statement).toContain("Health, Anmeldung und eine Erfassung");
      // RUNDE 2 (BENs Prueflücke 6): QUELLE UND ANHANGSZUORDNUNG, nicht nur der Fliesstext. Beide
      // liegen im Voll-JSONB des Objekts und koennten bei einem Serialisierungsfehler still
      // verschwinden, ohne dass Titel oder Aussage etwas merkten.
      expect(
        (wieder.json().sources as { label: string }[]).map((q) => q.label),
        "Die Quelle des Wissensobjekts hat den Wiederanlauf nicht ueberstanden.",
      ).toContain(QUELLENTITEL);
      expect(
        (wieder.json().attachments as { objectId?: string }[]).map((a) => a.objectId),
        "Die Zuordnung Datei→Wissensobjekt hat den Wiederanlauf nicht ueberstanden — die Datei laege dann ohne Zugehoerigkeit da.",
      ).toContain(objektId);

      // DIE RECHTE: der Gast ist noch Gast, der Administrator noch Administrator.
      const gastNachher = await neu.inject({
        url: "/api/users",
        headers: { authorization: `Bearer ${gastToken}` },
      });
      expect(
        gastNachher.statusCode,
        "Der eingeschraenkte Zugang kommt nach dem Neustart an die Nutzerverwaltung.",
      ).toBe(403);
      const adminNachher = await neu.inject({ url: "/api/users", headers: adminKopf });
      expect(adminNachher.statusCode, adminNachher.body).toBe(200);
      expect((adminNachher.json() as unknown[]).length).toBe(2);

      // DER INHALTSBELEG, byteweise. Eine gleiche Dateigroesse ist kein Inhaltsbeleg.
      const roh = await neu.inject({ url: `/api/objects/${objektId}/raw`, headers: adminKopf });
      expect(roh.statusCode, roh.body).toBe(200);
      expect(Buffer.from(roh.rawPayload).equals(QUELLBYTES)).toBe(true);

      // GEGENPROBE ZUR AUSSAGEKRAFT (Auftrag §8.2): Eine einzige veraenderte Zeile in
      // `objects.data` — Zeilenzahl und Rechte bleiben gleich, alle Zusicherungen oben ausser dem
      // Byte-Vergleich blieben gruen. Ohne diesen Abschnitt waere nicht zu unterscheiden, ob
      // wirklich verglichen oder nur etwas Wahres behauptet wird.
      const verfaelscht = Buffer.from(QUELLBYTES);
      verfaelscht.writeUInt8(verfaelscht.readUInt8(0) ^ 0xff, 0);
      await pool.query("UPDATE objects SET data=$1 WHERE id=$2", [
        `data:image/png;base64,${verfaelscht.toString("base64")}`,
        objektId,
      ]);
      const rohVerfaelscht = await neu.inject({
        url: `/api/objects/${objektId}/raw`,
        headers: adminKopf,
      });
      expect(rohVerfaelscht.statusCode).toBe(200);
      expect(Buffer.from(rohVerfaelscht.rawPayload).equals(QUELLBYTES)).toBe(false);
      const zeilen = await pool.query("SELECT count(*)::int AS n FROM objects");
      expect(zeilen.rows[0].n).toBe(1);
    } finally {
      await pool.end();
    }
  }, 900_000);

  // ================================================================================================
  // N2 — DER FEHLFALL AUS LIEFERUNG 1, AM ECHTEN WERKZEUG.
  // ================================================================================================
  //
  // WARUM DIESER FALL HIER UND NICHT IM DOCKERFREIEN TEIL: Dass `pruefeStartvertrag` den PROZESS
  // abbricht, ist seit JOB 3655/3776 belegt (`tests/demo-zugang-start/echter-serverstart.test.ts`
  // F1/F2) und wird hier NICHT wiederholt. Neu ist die Ebene davor: bis zu diesem Auftrag konnte
  // der Vertrag auf dem Ein-Befehl-Weg gar nicht greifen, weil `${APP_BASE_URL:-…}` die Variable
  // immer fuellte. Gemessen wird deshalb, was `docker compose` selbst tut.
  it("N2 · ohne APP_BASE_URL bricht der Ein-Befehl-Weg ab und nennt den fehlenden Wert", (ctx) => {
    const vorhanden = spawnSync("docker", ["compose", "version"], { encoding: "utf8" });
    if (vorhanden.status !== 0) {
      process.stderr.write(
        `${JOB} UEBERSPRUNGEN (N2): „docker compose" ist auf diesem Rechner nicht verfuegbar — der Abbruch des Ein-Befehl-Weges ist ohne das Werkzeug nicht messbar.\n`,
      );
      ctx.skip();
      return;
    }
    // `config` wertet Interpolation und Pflichtmarken aus, OHNE irgendetwas zu starten: kein
    // Container, kein Netz, kein Build. Die Umgebung wird vollstaendig neu gebaut und NICHT geerbt
    // — sonst braechte ein lokal gesetztes APP_BASE_URL den Fall still zum Schweigen.
    const lauf = spawnSync("docker", ["compose", "-f", "docker-compose.prod.yml", "config"], {
      cwd: WURZEL,
      encoding: "utf8",
      timeout: 120_000,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        TMPDIR: process.env.TMPDIR ?? "/tmp",
        POSTGRES_PASSWORD: "nur-fuer-diese-messung",
      },
    });
    const ausgabe = `${lauf.stdout ?? ""}${lauf.stderr ?? ""}`;
    expect(
      lauf.status,
      `Der Ein-Befehl-Weg kommt OHNE APP_BASE_URL durch. Die Instanz startet dann und zeigt auf eine fremde Adresse — ein falscher Erfolg.\n${ausgabe}`,
    ).not.toBe(0);
    expect(
      ausgabe,
      "Der Abbruch nennt den fehlenden Wert nicht beim Namen — dann weiss der Betreiber nicht, was er nachtragen soll.",
    ).toContain("APP_BASE_URL");

    // DIE GEGENPROBE IM SELBEN FALL: mit gesetztem Wert geht derselbe Befehl durch. Ohne sie waere
    // „bricht ab" auch dann wahr, wenn die Datei schlicht kaputt waere.
    const mitWert = spawnSync("docker", ["compose", "-f", "docker-compose.prod.yml", "config"], {
      cwd: WURZEL,
      encoding: "utf8",
      timeout: 120_000,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        TMPDIR: process.env.TMPDIR ?? "/tmp",
        POSTGRES_PASSWORD: "nur-fuer-diese-messung",
        APP_BASE_URL: "https://wissen.kunde.test",
      },
    });
    const gute = `${mitWert.stdout ?? ""}${mitWert.stderr ?? ""}`;
    expect(mitWert.status, gute).toBe(0);
    expect(gute).toContain("https://wissen.kunde.test");
    // Und die Vorfuehr-Domain steht nirgends mehr als Startwert dieser Instanz.
    expect(gute).not.toContain("app.klarwerk.ai");
  }, 300_000);

  // ================================================================================================
  // N3 · RUNDE 2 — DER ECHTE PROZESSNEUSTART. KEIN `buildApp`, SONDERN `server.ts`.
  // ================================================================================================
  //
  // DIE LUECKE, GEGEN DIE DIESER FALL STEHT (BEN, Runde 1, Korrekturpflicht 3): N1 misst die
  // API-Ebene und baut die zweite Anwendung IM SELBEN PROZESS auf. Damit bleibt ungemessen, ob der
  // PRODUKTIONSEINSTIEG gegen einen VORHANDENEN Bestand ueberhaupt wieder hochkommt — der
  // Startvertrag, die Migration auf schon bestehendem Schema, das Horchen am Socket. Genau das ist
  // der Schritt, den ein Betreiber mit `docker compose restart` ausloest.
  //
  // DESHALB LAEUFT HIER `node --import tsx services/app/src/server.ts` als EIGENER Prozess, bedient
  // ueber einen echten Socket, mit `NODE_ENV=production` — und wird mit SIGTERM beendet und neu
  // gestartet. Die Umgebung wird vollstaendig NEU gebaut und nicht geerbt (dieselbe Regel wie in
  // `tests/demo-zugang-start/echter-serverstart.test.ts:16-17`): sonst brächte eine geerbte
  // `KLARWERK_SELF_REGISTRATION` aus `tests/setup-env.ts` die Messung still zum Schweigen.
  //
  // WAS AUCH DIESER FALL NICHT MISST und was deshalb nirgends behauptet wird: den Aufbau ueber
  // `docker compose`, das gebaute Abbild, einen Browser, TLS. Der Datenbankdienst bleibt hier
  // ebenfalls unberuehrt — er gehoert N1 (und dort nur im Containerbetrieb).
  it("N3 · echter Prozessneustart: server.ts faehrt gegen den vorhandenen Bestand wieder hoch", async (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    const v = verbindung;
    const url = pgUrl(v, prozessDb);
    const port = await freierPort();
    const basis = `http://127.0.0.1:${port}`;

    /** Ein Serverprozess mit GENAU dieser Umgebung — nichts geerbt ausser dem Noetigsten. */
    const starte = (): ChildProcessWithoutNullStreams =>
      spawn("node", ["--import", "tsx", "services/app/src/server.ts"], {
        cwd: WURZEL,
        env: {
          PATH: process.env.PATH ?? "",
          HOME: process.env.HOME ?? "",
          TMPDIR: process.env.TMPDIR ?? "/tmp",
          KLARWERK_SKIP_KEYCHAIN: "1",
          KLARWERK_LOG_LEVEL: "warn",
          // Die Produktionslage, in der die Kundeninstanz wirklich laeuft — samt beider
          // Pflichtwerte des Startvertrags. Fehlte einer, kaeme dieser Prozess gar nicht hoch,
          // und genau das ist anderswo schon belegt (echter-serverstart.test.ts F1/F2).
          NODE_ENV: "production",
          DATABASE_URL: url,
          APP_BASE_URL: "https://wissen.kunde.test",
          PORT: String(port),
        },
      });

    let prozess = starte();
    const protokoll: string[] = [];
    const mitschnitt = (p: ChildProcessWithoutNullStreams): void => {
      p.stdout.on("data", (d) => protokoll.push(String(d)));
      p.stderr.on("data", (d) => protokoll.push(String(d)));
    };
    mitschnitt(prozess);

    try {
      await warteAufGesund(basis, prozess, protokoll, "erster Start");

      // --------------------------------------------------------------------------------------- 1
      // Ersteinrichtung und Bestand — ueber HTTP, nicht ueber `inject`.
      const einrichtung = await sende(basis, "POST", "/api/auth/setup", undefined, {
        name: "Prozess Admin",
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORT,
      });
      expect(einrichtung.status, einrichtung.text).toBe(201);
      const token = (einrichtung.json as { token: string }).token;
      expect(token).toBeTruthy();

      const ko = await sende(basis, "POST", "/api/kos", token, {
        confidentiality: "intern",
        title: "Prozessneustart abnehmen",
        statement: "Der Serverprozess faehrt gegen vorhandene Daten wieder hoch.",
        type: "best_practice",
        category: "Betrieb",
      });
      expect(ko.status, ko.text).toBe(201);
      const koKennung = (ko.json as { id: string }).id;

      const objekt = await sende(basis, "POST", "/api/objects", token, {
        name: "prozessbeleg.png",
        mime: "image/png",
        data: `data:image/png;base64,${QUELLBYTES.toString("base64")}`,
      });
      expect(objekt.status, objekt.text).toBe(201);
      const objektKennung = (objekt.json as { id: string }).id;

      const anhang = await sende(basis, "PUT", `/api/kos/${koKennung}`, token, {
        action: "attach",
        attachment: { name: "prozessbeleg.png", mime: "image/png", objectId: objektKennung },
      });
      expect(anhang.status, anhang.text).toBe(200);

      const quelle = await sende(basis, "PUT", `/api/kos/${koKennung}`, token, {
        action: "add-source",
        source: { label: QUELLENTITEL, objectId: objektKennung },
      });
      expect(quelle.status, quelle.text).toBe(200);

      // --------------------------------------------------------------------------------------- 2
      // DER NEUSTART: der Prozess wird wirklich beendet.
      const beendet = new Promise<void>((fertig) => prozess.once("exit", () => fertig()));
      prozess.kill("SIGTERM");
      await beendet;
      expect(
        prozess.killed || prozess.exitCode !== null || prozess.signalCode !== null,
        "Der Serverprozess ist nicht wirklich beendet worden — dann waere der Neustart keiner.",
      ).toBe(true);
      // Und er antwortet auch wirklich nicht mehr: sonst maesse der Abruf unten noch den alten.
      await expect(fetch(`${basis}/health`)).rejects.toThrow();

      prozess = starte();
      protokoll.length = 0;
      mitschnitt(prozess);
      await warteAufGesund(basis, prozess, protokoll, "Neustart");

      // --------------------------------------------------------------------------------------- 3
      // DER BELEG — aus einem KALT gestarteten Prozess, mit der Sitzung von vorher.
      const status = await sende(basis, "GET", "/api/auth/status", undefined);
      expect(status.status, status.text).toBe(200);
      expect(
        (status.json as { needsSetup: boolean }).needsSetup,
        "Der neu gestartete Prozess verlangt wieder eine Ersteinrichtung — der Kontenbestand ist weg.",
      ).toBe(false);

      const wieder = await sende(basis, "GET", `/api/kos/${koKennung}`, token);
      expect(wieder.status, wieder.text).toBe(200);
      const objektNachher = wieder.json as {
        title: string;
        sources: { label: string }[];
        attachments: { objectId?: string }[];
      };
      expect(objektNachher.title).toBe("Prozessneustart abnehmen");
      expect(objektNachher.sources.map((q) => q.label)).toContain(QUELLENTITEL);
      expect(objektNachher.attachments.map((a) => a.objectId)).toContain(objektKennung);

      const roh = await fetch(`${basis}/api/objects/${objektKennung}/raw`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(roh.status).toBe(200);
      const zurueck = Buffer.from(await roh.arrayBuffer());
      expect(
        zurueck.equals(QUELLBYTES),
        `Die Datei kam nach dem Prozessneustart nicht byteweise zurueck (${zurueck.length} statt ${QUELLBYTES.length} Bytes).`,
      ).toBe(true);

      // GEGENPROBE ZUR AUSSAGEKRAFT: ein einziges verfaelschtes Byte in der Datenhaltung, und der
      // Vergleich oben MUSS rot werden. Ohne sie waere „byteweise gleich" auch dann wahr, wenn hier
      // gar nicht verglichen wuerde.
      const pruefPool = createPool(url);
      try {
        const verfaelscht = Buffer.from(QUELLBYTES);
        verfaelscht.writeUInt8(verfaelscht.readUInt8(0) ^ 0xff, 0);
        await pruefPool.query("UPDATE objects SET data=$1 WHERE id=$2", [
          `data:image/png;base64,${verfaelscht.toString("base64")}`,
          objektKennung,
        ]);
      } finally {
        await pruefPool.end();
      }
      const rohVerfaelscht = await fetch(`${basis}/api/objects/${objektKennung}/raw`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(rohVerfaelscht.status).toBe(200);
      expect(Buffer.from(await rohVerfaelscht.arrayBuffer()).equals(QUELLBYTES)).toBe(false);
    } finally {
      if (prozess.exitCode === null && prozess.signalCode === null) {
        const aus = new Promise<void>((fertig) => prozess.once("exit", () => fertig()));
        prozess.kill("SIGKILL");
        await aus;
      }
    }
  }, 900_000);
});

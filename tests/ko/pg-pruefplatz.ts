// ================================================================================================
// DER PG-PRÜFPLATZ DER DREI KO-INTEGRATIONSSUITEN — eine isolierte echte PostgreSQL, ohne Dockerpflicht.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT (Rest aus JOB 4275, Runde 3, Prüflücke 6): drei Suiten unter `tests/ko/`
// liefen auf dem Cloud-Prüfplatz nie. Der Platz stellt eine PostgreSQL über `KLARWERK_PG_TEST_URL`,
// aber keine Container-Laufzeit — und die Suiten kannten nur `new GenericContainer(…)`:
//
//   · `g27-welle1-single-active-projection.integration.test.ts` (22 Fälle)
//   · `job2685-anhang-traeger.integration.test.ts`              (6 Fälle)
//   · `trash-tx-pg.integration.test.ts`                         (5 Fälle + Zeuge)
//
// Alle 33 Fälle wurden als `skipped` gezählt (Lauf 5b0e1858f2f24448bb15b1e7ef7d64bc). Diese Datei
// gibt allen dreien DENSELBEN Weg, statt ihn dreimal auszuschreiben:
//
//   1. `KLARWERK_PG_TEST_URL` hat Vorrang und geht durch dieselbe Sicherung wie alle PG-Suiten
//      (`guardedLocalPgTestUrl`, Datenbankname mit „test"). Darauf wird je Suite eine EIGENE,
//      frische Datenbank angelegt und am Ende mit `DROP DATABASE … WITH (FORCE)` entfernt. Die
//      Suiten laufen parallel gegen EINEN Cluster und leeren Tabellen (`DELETE FROM kos`) — ohne
//      eigene Datenbank wäre das ein Wettlauf mit jeder anderen Datei des Integrationslaufs.
//   2. Nur ohne URL wird ein Testcontainer versucht — Docker ist erlaubt, aber keine Pflicht.
//   3. Gibt es keines von beiden, WIRFT `oeffneIsoliertePg`. Es gibt keinen Skip mehr: eine fehlende
//      Datenbank ist ein fehlender Nachweis, und ein fehlender Nachweis darf im Lauf nicht so
//      aussehen wie ein bestandener. Eine abgelehnte URL fällt ebenfalls NICHT still auf den
//      Container zurück — wer ausdrücklich eine Instanz nennt, bekommt keine stille zweite.
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { GenericContainer, Wait } from "testcontainers";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

export const FEHLENDER_NACHWEIS = "[KLARWERK] KO-PG-PRÜFPLATZ · FEHLENDER NACHWEIS";

export interface IsoliertePg {
  /** Verbindung zur isolierten Datenbank — nur diese Suite benutzt sie. */
  readonly url: string;
  /** Woher die Datenbank kommt, ohne Passwort — steht im Lauf auf stderr. */
  readonly herkunft: string;
  abraeumen(): Promise<void>;
}

type ContainerStarter = () => Promise<{ url: string; stoppen(): Promise<void> }>;

/** Das, was der Helfer vom Verwaltungspool braucht — in den Gegenproben ohne Datenbank ersetzbar. */
interface Verwaltung {
  query(sql: string): Promise<unknown>;
  end(): Promise<void>;
}

const oeffneVerwaltung = (url: string): Verwaltung =>
  new Pool({ connectionString: url, connectionTimeoutMillis: 15_000 });

/**
 * Ist dieser Abfrageschlüssel ein Passwortträger? `pg-connection-string` übernimmt JEDEN
 * Abfrageparameter in die Konfiguration — `?password=…` ist dort ein vollwertiges Passwort (BEN
 * Runde 1, B1). Geprüft wird der Schlüssel so, wie der Parser ihn liest (`URLSearchParams`: `+` ist
 * ein Leerzeichen, `%xx` wird entschlüsselt), und bewusst weit: alles mit „pass" gilt als geheim,
 * ein unlesbarer Schlüssel auch.
 */
function istPasswortSchluessel(roh: string): boolean {
  try {
    return /pass/i.test(decodeURIComponent(roh.replace(/\+/g, " ")));
  } catch {
    return true;
  }
}

/**
 * Die Quelle darf genannt werden, das Passwort nicht — in KEINER Form, die der installierte
 * PostgreSQL-Parser als Passwort liest:
 *   · Anmeldedaten vor dem LETZTEN `@` der Authority (ein unkodiertes `@` im Passwort gehört noch
 *     dazu — so trennt auch die WHATWG-URL, auf der `pg-connection-string` aufsetzt);
 *   · Abfrageparameter mit Passwortschlüssel (`?password=…`, auch kodiert oder in anderer Schreibung).
 * Eine Adresse ohne `schema://` wird gar nicht wiedergegeben — lieber keine Herkunft als ein Leck.
 */
export function ohneGeheimnis(url: string): string {
  const teile = /^([^:/?#]+:\/\/)([^/?#]*)([\s\S]*)$/.exec(url);
  if (!teile) {
    return "(Verbindungsadresse nicht darstellbar)";
  }
  const [, schema = "", autoritaet = "", rest = ""] = teile;
  const at = autoritaet.lastIndexOf("@");
  const ohneAnmeldung =
    at < 0
      ? autoritaet
      : `${autoritaet.slice(0, at).split(":")[0] ?? ""}:***@${autoritaet.slice(at + 1)}`;
  const ohneParameter = rest.replace(
    /([?&])([^&#=]*)=([^&#]*)/g,
    (treffer, trenner: string, schluessel: string) =>
      istPasswortSchluessel(schluessel) ? `${trenner}${schluessel}=***` : treffer,
  );
  return `${schema}${ohneAnmeldung}${ohneParameter}`;
}

/**
 * Die Passwortwerte einer Adresse, roh und entschlüsselt — damit auch eine fremde Fehlermeldung,
 * die einen davon wiederholt, geschwärzt werden kann.
 */
function passwoerterIn(url: string): string[] {
  const werte: string[] = [];
  const teile = /^[^:/?#]+:\/\/([^/?#]*)([\s\S]*)$/.exec(url);
  const autoritaet = teile?.[1] ?? "";
  const at = autoritaet.lastIndexOf("@");
  if (at >= 0) {
    const info = autoritaet.slice(0, at);
    const doppelpunkt = info.indexOf(":");
    if (doppelpunkt >= 0) {
      werte.push(info.slice(doppelpunkt + 1));
    }
  }
  for (const [, schluessel = "", wert = ""] of (teile?.[2] ?? "").matchAll(
    /[?&]([^&#=]*)=([^&#]*)/g,
  )) {
    if (istPasswortSchluessel(schluessel)) {
      werte.push(wert);
    }
  }
  const mitEntschluesselt = werte.flatMap((wert) => {
    try {
      return [wert, decodeURIComponent(wert.replace(/\+/g, " ")), decodeURIComponent(wert)];
    } catch {
      return [wert];
    }
  });
  // Längste zuerst: ein kürzerer Wert darf einen längeren nicht halb geschwärzt stehen lassen.
  return [...new Set(mitEntschluesselt.filter((w) => w.length > 0))].sort(
    (a, b) => b.length - a.length,
  );
}

/** Ein Fehlergrund, in dem kein Passwort der Adresse mehr steht. */
function geschwaerzt(text: string, url: string): string {
  let ergebnis = text;
  for (const passwort of passwoerterIn(url)) {
    ergebnis = ergebnis.split(passwort).join("***");
  }
  return ergebnis;
}

/**
 * Ein neuer, eindeutiger Datenbankname. `test` steht IMMER darin — dieselbe Regel wie in der
 * Sicherung, nur hier für den Namen, den diese Datei selbst bildet.
 */
export function isolierterName(marke: string): string {
  if (!/^[a-z0-9_]{1,24}$/.test(marke)) {
    throw new Error(`Marke „${marke}" ist kein zulässiger Namensteil (a-z, 0-9, _; höchstens 24).`);
  }
  return `klarwerk_ko_${marke}_test_${process.pid}_${randomBytes(4).toString("hex")}`;
}

/**
 * Dieselbe URL, nur mit anderem Datenbanknamen. BEWUSST per Muster statt `new URL()` — wie in
 * `guardedLocalPgTestUrl`: Socket-Verbindungen (`postgres://user@/db?host=/run/pg`) sind keine
 * gültige WHATWG-URL, ihre Abfrage muss aber erhalten bleiben.
 */
export function mitDatenbank(url: string, name: string): string {
  const treffer = /^([^:]+:\/\/[^/?#]*)(\/[^?#]*)?(.*)$/.exec(url);
  if (!treffer) {
    throw new Error(`Die URL ${ohneGeheimnis(url)} ist keine Verbindungsadresse.`);
  }
  return `${treffer[1]}/${name}${treffer[3] ?? ""}`;
}

function grundVon(fehler: unknown): string {
  return fehler instanceof Error ? fehler.message : String(fehler);
}

const startePgContainer: ContainerStarter = async () => {
  const container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  return {
    url: `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`,
    stoppen: async () => {
      await container.stop();
    },
  };
};

/**
 * Öffnet die isolierte Datenbank einer Suite — oder wirft mit `FEHLENDER_NACHWEIS`.
 * `marke` kennzeichnet die Suite im Datenbanknamen und in der Meldung.
 */
export async function oeffneIsoliertePg(
  marke: string,
  opts: {
    env?: NodeJS.ProcessEnv;
    containerStarten?: ContainerStarter;
    verwaltungOeffnen?: (url: string) => Verwaltung;
  } = {},
): Promise<IsoliertePg> {
  const env = opts.env ?? process.env;
  const name = isolierterName(marke);
  let pg: IsoliertePg;
  if (env.KLARWERK_PG_TEST_URL) {
    const url = guardedLocalPgTestUrl(env);
    if (!url) {
      throw new Error(
        `${FEHLENDER_NACHWEIS} (${marke}): KLARWERK_PG_TEST_URL wurde von der Testdatenbank-Sicherung abgelehnt — kein Container-Rückfall, nichts gemessen.`,
      );
    }
    const isoliert = mitDatenbank(url, name);
    const verwaltung = (opts.verwaltungOeffnen ?? oeffneVerwaltung)(url);
    try {
      await verwaltung.query("SELECT 1");
    } catch (fehler) {
      await verwaltung.end().catch(() => undefined);
      throw new Error(
        `${FEHLENDER_NACHWEIS} (${marke}): die Datenbank unter ${ohneGeheimnis(url)} ist nicht erreichbar — nichts gemessen: ${geschwaerzt(grundVon(fehler), url)}`,
      );
    }
    // Ab hier ist die Ressource DA: jeder weitere Fehler ist ein Befund und fliegt weiter.
    // Von `template0`, nicht von `template1`: die drei Suiten legen ihre Datenbanken gleichzeitig
    // an, und `template1` darf dabei keine fremde Sitzung tragen („source database is being
    // accessed by other users"). `template0` nimmt keine Verbindungen an und bringt keine
    // Erweiterung mit — `migrate()` legt `pg_trgm` in der frischen Datenbank selbst an, und weil
    // `pg_extension` je Datenbank gilt, ist das kein Wettlauf mit anderen Dateien des Laufs.
    //
    // Scheitert die Anlage, gibt es kein `abraeumen` — der Verwaltungspool wird deshalb HIER
    // geschlossen, und derselbe Fehler fliegt unverändert weiter (BEN Runde 1, B2).
    try {
      await verwaltung.query(`CREATE DATABASE ${name} TEMPLATE template0`);
    } catch (fehler) {
      await verwaltung.end().catch(() => undefined);
      throw fehler;
    }
    pg = {
      url: isoliert,
      herkunft: `KLARWERK_PG_TEST_URL · isolierte Datenbank ${name} auf ${ohneGeheimnis(url)}`,
      abraeumen: async () => {
        try {
          await verwaltung.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
        } finally {
          await verwaltung.end();
        }
      },
    };
  } else {
    let container: Awaited<ReturnType<ContainerStarter>>;
    try {
      container = await (opts.containerStarten ?? startePgContainer)();
    } catch (fehler) {
      throw new Error(
        `${FEHLENDER_NACHWEIS} (${marke}): weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit — nichts gemessen: ${grundVon(fehler)}`,
      );
    }
    pg = {
      url: container.url,
      herkunft: `Testcontainer postgres:16-alpine (eigene Instanz) · ${ohneGeheimnis(container.url)}`,
      abraeumen: container.stoppen,
    };
  }
  process.stderr.write(`[KLARWERK] KO-PG-Prüfplatz (${marke}): bereit — ${pg.herkunft}\n`);
  return pg;
}

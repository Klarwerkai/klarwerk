// ================================================================================================
// JOB 4275 · F-BEZIEHUNGEN-RESTORE — DIE BEZIEHUNGEN SIND NACH DEM ECHTEN PRODUKT-RESTORE WIRKLICH DA.
// ================================================================================================
//
// DIE FRAGE, DIE HIER BEANTWORTET WIRD, ist die eines Teams am Tag nach dem Datenverlust: *Ich habe
// die Sicherung zurueckgespielt — finde ich meine kuratierten Wissensbeziehungen wieder, in beiden
// Leserichtungen, mit Richtung, Art, Urheber und Herkunft? Sieht weiterhin niemand, was er vorher
// nicht sehen durfte? Und erzeugt derselbe Beitrag danach keine zweite Beziehung?*
//
// ------------------------------------------------------------------------------------------------
// WARUM DIESE DATEI NEBEN DREI BESTANDSNACHWEISEN STEHT — UND KEINEN VON IHNEN WIEDERHOLT
// ------------------------------------------------------------------------------------------------
//
// (a) `tests/wissensgraph-abnahme/neustart-und-restore.integration.test.ts` (JOB 4155, L7) hat den
//     Beziehungs-Restore, aber OHNE den Produktweg: es ruft `pg_dump --format=custom` und
//     `pg_restore` DIREKT (`:342-357`, Kommentar „wie das Sicherungsskript des Hauses ihn erzeugt"
//     — also nachgebaut, nicht das Skript selbst). Sein Kopf nennt die Grenze woertlich: `:31-33`
//     „Keine Produktionswiederherstellung"; `:22-24` „Beide Anwendungen laufen im SELBEN
//     Node-Prozess". Der Umfang ist EINE Kante, EIN Wiederholschluessel, EIN Nutzer; auf
//     `ko_kanten_beitrag` prueft es nur `> 0` (`:375-378`) — nicht, dass der Schluessel noch BINDET.
//
// (b) `tests/backup-drill/echter-wiederanlauf.integration.test.ts` (JOB 4010/4097) faehrt genau den
//     Produktweg — `sichere()` startet das UNVERAENDERTE `scripts/backup/backup.sh`, `fahreDrill()`
//     das UNVERAENDERTE `scripts/backup/restore-drill.sh` —, aber sein Inhaltsbeleg ist eine
//     hochgeladene DATEI ueber `/api/objects/:id/raw`. Kanten kommen darin nicht vor.
//
// (c) `tests/ko/kanten-lesekette-sichtbarkeit.test.ts` (JOB 1140) haelt die Rechteregel fest — eine
//     kuratierte Kante ist nur sichtbar, wenn BEIDE Endpunkte es sind —, aber am `InMemoryKantenRepo`.
//     Ueber `PgKantenRepo` NACH einem Restore ist sie nirgends gemessen.
//
// Diese Datei schliesst genau den Zwischenraum: der Dump kommt aus `backup.sh`, der Restore aus
// `restore-drill.sh`, die Zieldatenbank ist leer, der Server danach ist ein ANDERER
// Betriebssystemprozess, und verglichen wird ueber den HTTP-Leseweg JE ROLLE — Feld fuer Feld gegen
// den Vorzustand. Keine der drei Dateien oben wird angefasst oder ersetzt; sie messen weiter, was
// sie messen. Dieser Lauf ist ausdruecklich KEINER der bestehenden 27 PG-/Backupfaelle.
//
// ------------------------------------------------------------------------------------------------
// UND ER SCHLIESST DIE LETZTE OFFENE ABNAHME AUS JOB 4155 (G2) MIT
// ------------------------------------------------------------------------------------------------
// BEN hat sie in `archiv/4155/runde-3/ben.md:27` offen gelassen („Ein vollstaendiger
// G2-Prozessneustart … bleibt offen"; `:35` fuehrt ihn unter NICHT GEPRUEFT). Ein Instanzwechsel im
// selben Node-Prozess genuegt nicht, und die Browser-Abnahme kann es auch nicht liefern —
// `tests-smoke/wg-luecken-beziehungen-browser.spec.ts:24-27` sagt es selbst: „Der Smoke-Server
// faehrt im Speicher; ein ‚Neustart' waere hier ein leerer Bestand und kein Nachweis." Hier wird
// der erste Serverprozess WIRKLICH beendet (Beleg: `prozessLebt(pid) === false`), und der zweite
// hat eine andere PID. Beide PIDs stehen in der Rueckgabe.
//
// ------------------------------------------------------------------------------------------------
// DIE REIHENFOLGE IST DER RED-FIRST-VERTRAG (Auftrag §6)
// ------------------------------------------------------------------------------------------------
//   B1  Vorzustand ueber die laufende Anwendung · backup.sh · restore-drill.sh
//   B2  KALIBRIERUNG, und sie laeuft VOR dem gruenen Vergleich. Sie kalibriert ZWEI Richtungen,
//       weil ein Abnahmeweg beides sehen muss — dass die Sache kaputt ist UND dass sein eigenes
//       Beweismittel ausgefallen ist:
//         K1  in einer ISOLIERTEN Kopie fehlt eine Beziehung          → rot
//         K2  in einer zweiten Kopie fehlt ein Wiederholschluessel    → rot
//         K3  der LESEWEG faellt aus (Recht entzogen bzw. Route weg), vorher UND nachher mit
//             IDENTISCHER Fehlerantwort                               → rot
//         K4  der Leseweg antwortet mit HTTP 200, aber ohne tragenden Inhalt → rot
//       K3 und K4 sind die Korrektur aus Runde 1: dort blieb die Suite gruen, obwohl BEN alle
//       GET-Abfragen einer Rolle auf eine nicht vorhandene Route umgelenkt hatte.
//   B3  DIESELBE Funktion gegen die echte wiederhergestellte Datenbank — gruen.
//   B4  Rechteentzug wirkt auch nach dem Restore (samt Kalibrierung und Altbestandsprobe).
//   B5  Der Wiederholschluessel hat den Restore ueberlebt.
//
// ------------------------------------------------------------------------------------------------
// PRUEFGRENZE, SICHTBAR UND NIEMALS STILL (Auftrag §5.8)
// ------------------------------------------------------------------------------------------------
// Diese Suite braucht eine echte PostgreSQL UND `pg_dump`/`pg_restore`/`psql`/`createdb`/`ps` auf
// dem PATH. Fehlt etwas, wird der Grund SICHTBAR auf stderr gemeldet und der Fall UEBERSPRUNGEN —
// ein stiller Skip saehe aus wie ein bestandener Lauf (Lehre JOB 4127 R2), und die schaerfere Lehre
// JOB 4224 R4 gilt woertlich: „Scheingruene PG-Faelle verhindern. Fehlenden Aufbau als Fehler oder
// tatsaechlichen Skip ausweisen — ohne Datenbank keine bestandenen PG-Faelle." Kein Fall dieser
// Datei meldet ohne Datenbank `passed`. Auf dem Cloud-Pruefplatz zaehlt ein Skip als ROT.
//
//     KLARWERK_PG_TEST_URL=postgres://user:pass@127.0.0.1:5432/klarwerk_test \
//       npx vitest run --config vitest.integration.config.ts \
//       tests/beziehungs-restore-nutzerweg/
//
// KEINE PRODUKTIVDATEN: jede angelegte Datenbank traegt `test` im Namen (`guardedLocalPgTestUrl`-
// Regel, durchgesetzt in `pgUrl`) und wird in `afterAll` wieder entfernt; jeder Fall bekommt einen
// EIGENEN Dumpordner, damit ein zweiter Lauf nie den Dump des ersten mitliest.
//
// JOB 4305 · WOHER DIE ANLAGE KOMMT. Bis dahin standen Konten, Eintraege, Beziehungen, Sicherung
// und Drill als lokale Konstanten und Funktionen in DIESER Datei. Seit es einen zweiten Nachweis
// auf derselben Strecke gibt (`beziehungen-im-browser-nach-restore.integration.test.ts`), wohnen
// sie in `vorrichtung.ts` — EIN Ort, den beide rufen. Zwei ausgeschriebene Anlagen verglichen
// jeweils gegen ihren eigenen Vorzustand, und „derselbe Bestand" waere eine Behauptung ueber zwei
// Texte. Die Zusicherungen dieser Datei sind dabei unveraendert geblieben.
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  ADMIN,
  type Abdruck,
  BEZIEHUNGEN,
  type Bestand,
  CONTROLLER,
  ENTZOGEN,
  ERWARTETE_SICHT,
  EXPERTE,
  type Instanz,
  JOB,
  KOS,
  type Konto,
  PASSWORT,
  type Rollensicht,
  type Verbindung,
  baueBestandAuf,
  erhebeAbdruck,
  fahreDrill,
  kantenVon,
  pgUrl,
  prozessLebt,
  pruefeSicht,
  sende,
  sichere,
  stabil,
  starteKlarwerk,
  totalVon,
  vergleicheAbdruecke,
  werkzeugFehlt,
  zerlege,
} from "./vorrichtung";

describe("JOB 4275 · Wissensbeziehungen ueberleben den echten Produkt-Restore", () => {
  let container: StartedTestContainer | undefined;
  let adminPool: Pool | undefined;
  let quellPool: Pool | undefined;
  let zielPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let arbeitsordner = "";
  let verfuegbar = false;

  const kennung = `${Date.now()}`.slice(-9);
  const quellDb = `klarwerk_bz_quelle_test_${kennung}`;
  const zielDb = `klarwerk_bz_ziel_test_${kennung}`;
  // Zwei EIGENE Wegwerfkopien fuer die Kalibrierung (§5.6) — nie die Pruefstrecke selbst.
  const kopieKanteDb = `klarwerk_bz_kopie_k_test_${kennung}`;
  const kopieBindungDb = `klarwerk_bz_kopie_b_test_${kennung}`;

  /** Der Serverprozess NACH dem Restore. B3 startet ihn, B4/B5 messen an ihm weiter. */
  let nachInstanz: Instanz | undefined;
  /** Die beiden PIDs des Auftrags §5.3 — sie stehen am Ende auf stderr und in der Rueckgabe. */
  let pidVorher = 0;
  let pidNachher = 0;

  /** Der angelegte Bestand. `null` heisst: B1 ist nicht gelaufen. */
  let bestand: Bestand | null = null;
  /** Der Stand VOR der Sicherung. `null` heisst: B1 ist nicht gelaufen, es gibt nichts zu vergleichen. */
  let vorzustand: Abdruck | null = null;
  /** Belege fuer die Rueckgabe (§5.7). */
  let dumpName = "";
  let dumpHash = "";
  let dumpBytes = 0;

  const dieser = (): Bestand => {
    if (!bestand) {
      throw new Error(`${JOB}: B1 ist nicht gelaufen — es gibt keinen Bestand.`);
    }
    return bestand;
  };
  const koId = (kurz: string): string => dieser().koId(kurz);
  const kanteId = (kurz: string): string => dieser().kanteId(kurz);
  const koListe = (): string[] => dieser().koListe();
  const konten = (): readonly Konto[] => dieser().konten;

  const sicht = (abdruck: Abdruck, rolle: string, kurz: string): Rollensicht => {
    const treffer = abdruck.sichten.find((s) => s.rolle === rolle && s.koId === koId(kurz));
    if (!treffer) {
      throw new Error(`${JOB}: keine Sicht der Rolle ${rolle} auf ${kurz} im Abdruck.`);
    }
    return treffer;
  };

  beforeAll(async () => {
    const fehlend = ["pg_dump", "pg_restore", "psql", "createdb", "ps"].filter(werkzeugFehlt);
    if (fehlend.length > 0) {
      process.stderr.write(
        `${JOB} UEBERSPRUNGEN: Werkzeuge fehlen auf dem PATH: ${fehlend.join(", ")} — ohne sie laufen weder backup.sh noch restore-drill.sh.\n`,
      );
      return;
    }
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
          `${JOB} UEBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfuegbar.\n`,
        );
        return;
      }
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(`${JOB} UEBERSPRUNGEN: die Test-URL nennt keinen Rechnernamen.\n`);
      return;
    }
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    // Die eigene, LEERE Wegwerf-Quelldatenbank. Die angebotene Testdatenbank bleibt unberuehrt;
    // das Schema legt der Serverprozess selbst an (`migrate` beim Start) — keine Migration von Hand.
    await adminPool.query(`CREATE DATABASE ${quellDb}`);
    arbeitsordner = mkdtempSync(join(tmpdir(), "klarwerk-4275-"));
    verfuegbar = true;
  }, 240_000);

  afterAll(async () => {
    await nachInstanz?.beende();
    await quellPool?.end();
    await zielPool?.end();
    if (adminPool) {
      for (const db of [quellDb, zielDb, kopieKanteDb, kopieBindungDb]) {
        await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      }
      await adminPool.end();
    }
    await container?.stop();
    if (arbeitsordner) {
      rmSync(arbeitsordner, { recursive: true, force: true });
    }
    if (verfuegbar && vorzustand) {
      // Die Belege fuer die Rueckgabe (§5.7) — gemessen, nicht hergeleitet.
      process.stderr.write(
        `${JOB} BELEGE: Dump=${dumpName} sha256=${dumpHash} Bytes=${dumpBytes} Zieldatenbank=${zielDb} PID-vor=${pidVorher} PID-nach=${pidNachher}\n`,
      );
    }
  }, 180_000);

  // ==============================================================================================
  // B1 — DER BEFUELLTE VORZUSTAND, DIE SICHERUNG MIT `backup.sh`, DER WIEDERANLAUF MIT `restore-drill.sh`
  // ==============================================================================================
  it("B1 · befuellter Vorzustand ueber die laufende Anwendung, dann backup.sh und restore-drill.sh", async (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    const v = verbindung;
    const quellUrl = pgUrl(v, quellDb);

    // -------------------------------------------------------------------------------------- 1
    // DER ERSTE SERVERPROZESS. Ein echter Prozess mit eigener PID und eigenem Socket — nicht
    // `buildApp` im Testprozess, sonst waere der „Neustart" unten keiner.
    const vor = await starteKlarwerk({ datenbankUrl: quellUrl, was: "Vorzustand" });
    pidVorher = vor.pid;
    try {
      // -------------------------------------------------------------------------------------- 2-4
      // KONTEN, FUENF EINTRAEGE, FUENF BEZIEHUNGEN, RECHTEENTZUG — alles ueber HTTP, und alles an
      // EINEM Ort beschrieben (`vorrichtung.ts`, `baueBestandAuf`). Der Browsernachweis aus
      // JOB 4305 ruft dieselbe Funktion; deshalb ist sein Vorzustand wirklich DERSELBE Bestand und
      // nicht ein zweiter, der heute zufaellig gleich aussieht.
      bestand = await baueBestandAuf(vor.basis);

      // -------------------------------------------------------------------------------------- 5
      // DER VORZUSTAND — je Eintrag, je Richtung, je Schluessel und je Rolle. Nicht vorgezeigt:
      // FESTGEHALTEN, damit B3 bis B5 dagegen halten koennen (Lehre JOB 4141 R1).
      quellPool = new Pool({ connectionString: quellUrl });
      const erhoben = await erhebeAbdruck(quellPool, vor.basis, konten(), koListe());
      vorzustand = erhoben;
      expect(erhoben.kanten.length, "die Beziehungen sind gar nicht in der Ablage").toBe(
        BEZIEHUNGEN.length,
      );
      expect(
        erhoben.bindungen.length,
        "die Wiederholschluessel sind gar nicht gebunden — ko_kanten_beitrag ist leer",
      ).toBe(BEZIEHUNGEN.length);
      expect(new Set(erhoben.bindungen.map((b) => b.beitrag_schluessel))).toEqual(
        new Set(BEZIEHUNGEN.map((b) => b.schluessel)),
      );
      // Und der Vorzustand ist wirklich befuellt — sonst waere jeder Vergleich unten die
      // Uebereinstimmung zweier leerer Bestaende. Geprueft wird JEDE der zwanzig erhobenen Sichten
      // und nicht zwei ausgewaehlte (BEN R1, Substanzpunkt 4): erst der Erfolgs- und Strukturbeleg,
      // dann der Zaehler gegen die abgelesene Tabelle oben.
      expect(erhoben.sichten.length, "es wurden nicht alle Rolle/Eintrag-Paare erhoben").toBe(
        konten().length * KOS.length,
      );
      const gemessen: Record<string, Record<string, number>> = {};
      for (const konto of konten()) {
        const zeile: Record<string, number> = {};
        for (const k of KOS) {
          const s = sicht(erhoben, konto.rolle, k.kurz);
          expect(
            pruefeSicht(s),
            `${konto.rolle}/${k.kurz}: die Sicht ist kein gueltiger Bestand`,
          ).toEqual([]);
          zeile[k.kurz] = totalVon(s);
        }
        gemessen[konto.rolle] = zeile;
      }
      expect(gemessen, "der Vorzustand ist nicht der zugesagte").toEqual(ERWARTETE_SICHT);
    } finally {
      // -------------------------------------------------------------------------------------- 6
      // DER ERSTE PROZESS WIRD BEENDET — VOR der Sicherung und damit lange vor dem zweiten.
      await vor.beende();
    }
    expect(
      prozessLebt(pidVorher),
      "Der erste Serverprozess lebt noch — dann waere der Wiederanlauf unten kein Prozessneustart.",
    ).toBe(false);
    await quellPool?.end();
    quellPool = undefined;

    // -------------------------------------------------------------------------------------- 7
    // DIE SICHERUNG — mit dem UNVERAENDERTEN `scripts/backup/backup.sh`. Kein direkter `pg_dump`:
    // genau das ist der Unterschied zu (a) und der Kern dieses Auftrags.
    const beleg = sichere({ verbindung: v, datenbank: quellDb, ordner: join(arbeitsordner, "b1") });
    dumpName = beleg.name;
    dumpBytes = beleg.bytes;
    expect(dumpBytes).toBeGreaterThan(0);
    dumpHash = beleg.hash;
    expect(dumpHash, "der Sidecar traegt keine 64-Hex-Pruefsumme").toMatch(/^[0-9a-f]{64}$/);

    // -------------------------------------------------------------------------------------- 8
    // DER RESTORE — mit dem UNVERAENDERTEN `scripts/backup/restore-drill.sh`, in eine EIGENE,
    // LEERE Zieldatenbank. Keine SQL-Handkopie, kein Zurueckspielen in dieselbe Datenbank.
    const { status, ausgabe } = fahreDrill({
      verbindung: v,
      dump: beleg.dump,
      ziel: zielDb,
      port: "3275",
      loginEmail: ADMIN.email,
      loginPasswort: PASSWORT,
    });
    expect(status, ausgabe).toBe(0);
    for (const glied of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(ausgabe, `Gliedzeile ${glied} fehlt`).toContain(`Glied ${glied} —`);
    }
    expect(ausgabe).toContain("DRILL BESTANDEN");
    // Der Drill zaehlt die Beziehungstabellen aus dem Dump gegen die wiederhergestellte Datenbank.
    // Das ist eine MENGENAUSSAGE und ausdruecklich kein Inhaltsbeleg — den liefert erst B3.
    expect(ausgabe).toMatch(new RegExp(`ko_kanten: Dump=${BEZIEHUNGEN.length} Datenbank=`));
    expect(ausgabe).toMatch(new RegExp(`ko_kanten_beitrag: Dump=${BEZIEHUNGEN.length} Datenbank=`));
  }, 1_800_000);

  // ==============================================================================================
  // B2 — DIE KALIBRIERUNG, UND SIE LAEUFT VOR DEM GRUENEN VERGLEICH (Auftrag §5.6 und §6)
  // ==============================================================================================
  //
  // OHNE DIESEN FALL IST DIE GANZE STRECKE EINE VORFUEHRUNG. Ein Vergleich, der nur gruen war, sagt
  // nicht, ob er ueberhaupt etwas prueft. Hier wird er zweimal wirklich beschaedigt, und zwar mit
  // zwei Schaeden, die verschiedene Haelften treffen:
  //
  //   · eine entfernte BEZIEHUNG  → Bestand UND Leseweg muessen es melden,
  //   · ein entfernter WIEDERHOLSCHLUESSEL → nur die Bindungstabelle meldet es; am Leseweg ist
  //     dieser Schaden UNSICHTBAR, und genau deshalb steht `ko_kanten_beitrag` im Abdruck.
  //
  // Die Kopien entstehen mit `CREATE DATABASE … TEMPLATE`, also aus der wiederhergestellten
  // Datenbank selbst — die Pruefstrecke wird dabei nicht angefasst und nicht veraendert.
  it("B2 · KALIBRIERUNG: entfernte Beziehung und entfernter Wiederholschluessel machen den Vergleich ROT", async (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    expect(vorzustand, "B1 ist nicht gelaufen — B2 haette nichts zu vergleichen").not.toBeNull();
    const v = verbindung;
    const vorher = vorzustand as Abdruck;
    const pool = adminPool as Pool;

    /** Eine isolierte Kopie der wiederhergestellten Datenbank — eigene Wegwerfdatenbank. */
    const kopiere = async (nach: string): Promise<void> => {
      // `CREATE DATABASE … TEMPLATE` duldet keine offene Verbindung zur Vorlage. Der Drill hat
      // seinen Serverprozess abgeraeumt; ein Rest waere ein Aufbaufehler und kein Befund.
      await pool.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        [zielDb],
      );
      await pool.query(`CREATE DATABASE ${nach} TEMPLATE ${zielDb}`);
    };

    /** Ein eigener Serverprozess auf einer Kopie — und danach ist er wieder weg. */
    const mitInstanz = async <T>(
      db: string,
      was: string,
      tu: (basis: string, kopiePool: Pool) => Promise<T>,
    ): Promise<T> => {
      const instanz = await starteKlarwerk({ datenbankUrl: pgUrl(v, db), was });
      const kopiePool = new Pool({ connectionString: pgUrl(v, db) });
      try {
        return await tu(instanz.basis, kopiePool);
      } finally {
        await kopiePool.end();
        await instanz.beende();
      }
    };

    /** Erhebt den Abdruck einer Kopie ueber einen eigenen Serverprozess und vergleicht. */
    const messe = async (db: string, was: string): Promise<string[]> =>
      await mitInstanz(db, was, async (basis, kopiePool) =>
        vergleicheAbdruecke(vorher, await erhebeAbdruck(kopiePool, basis, konten(), koListe())),
      );

    // ------------------------------------------------------------------------------------ K1
    const opferKante = kanteId("alpha-beta");
    expect(opferKante, "B1 hat die Beziehung alpha-beta nicht angelegt").toBeTruthy();
    await kopiere(kopieKanteDb);
    const kantenPool = new Pool({ connectionString: pgUrl(v, kopieKanteDb) });
    try {
      const weg = await kantenPool.query("DELETE FROM ko_kanten WHERE id = $1", [opferKante]);
      expect(weg.rowCount, "in der Kopie stand die Beziehung gar nicht").toBe(1);
    } finally {
      await kantenPool.end();
    }
    const rotKante = await messe(kopieKanteDb, "Kalibrierung K1");
    expect(
      rotKante.length,
      "Eine ENTFERNTE Beziehung blieb unbemerkt — der Vergleich prueft nichts.",
    ).toBeGreaterThan(0);
    expect(rotKante.join("\n")).toContain(`ko_kanten: die Beziehung ${opferKante}`);
    expect(rotKante.join("\n")).toContain("FEHLT");
    // Und er sagt es auch am LESEWEG, nicht nur an der Tabelle — fuer jede Rolle, die sie sah.
    expect(rotKante.join("\n")).toContain("kommt nicht mehr an");
    process.stderr.write(`${JOB} KALIBRIERUNG K1 (rot, erwartet):\n${rotKante.join("\n")}\n`);

    // ------------------------------------------------------------------------------------ K2
    const opferSchluessel = BEZIEHUNGEN[1].schluessel;
    await kopiere(kopieBindungDb);
    const bindungsPool = new Pool({ connectionString: pgUrl(v, kopieBindungDb) });
    try {
      const weg = await bindungsPool.query(
        "DELETE FROM ko_kanten_beitrag WHERE beitrag_schluessel = $1",
        [opferSchluessel],
      );
      expect(weg.rowCount, "in der Kopie stand der Wiederholschluessel gar nicht").toBe(1);
    } finally {
      await bindungsPool.end();
    }
    // K2 UND K3 teilen sich EINEN Serverprozess: K3 braucht einen laufenden Server, und ein
    // zweiter Start kostete nur Zeit auf dem gemeinsamen Pruefplatz (Auftrag §8.6).
    const { rotBindung, strengerFehler, rohTokenA, rohTokenB, rohPfadA, rohPfadB } =
      await mitInstanz(kopieBindungDb, "Kalibrierung K2+K3", async (basis, kopiePool) => {
        const k2 = vergleicheAbdruecke(
          vorher,
          await erhebeAbdruck(kopiePool, basis, konten(), koListe()),
        );

        // ---------------------------------------------------------------------------------- K3
        // DAS BEWEISMITTEL FAELLT AUS — und der Nachweis muss das sehen.
        //
        // Das ist BENs Korrekturpflicht 2 aus Runde 1, woertlich: „identische Fehlerantworten fuer
        // einen sonst nicht einzeln abgesicherten KO muessen den Nachweis ROT machen." In Runde 1
        // taten sie es nicht: die Erhebung legte jede Fehlerantwort als `total: -1`/`kanten: []`
        // ab, der Vergleich sah zweimal denselben Ersatzwert und meldete Uebereinstimmung.
        //
        // Zwei Ausfaelle, weil sie verschiedene Haelften treffen:
        //   (a) das Recht faellt aus — dieselbe echte Route, aber mit unbrauchbarem Token. Der
        //       Server antwortet mit einem HTTP-Fehler auf `/api/kos/:id/beziehungen` selbst.
        //   (b) der Weg faellt aus — die Abfragen gehen auf eine nicht vorhandene Route. Das ist
        //       genau BENs eigene Gegenprobe, die Runde 1 gruen ueberstand.
        // Beide werden ZWEIMAL erhoben, damit vorher und nachher wirklich identisch sind.
        const blindeKonten: Konto[] = konten().map((k) => ({
          rolle: k.rolle,
          token: "kein-gueltiges-token-nach-dem-restore",
        }));
        const kaputterWeg = `${basis}/gibt-es-diese-route-nicht`;
        const ohne = { ohnePruefung: true } as const;

        // Die STRENGE Erhebung darf einen solchen Ausfall gar nicht erst zu einem Abdruck machen.
        let fehler = "";
        try {
          await erhebeAbdruck(kopiePool, basis, blindeKonten, koListe());
        } catch (ausfall) {
          fehler = ausfall instanceof Error ? ausfall.message : String(ausfall);
        }

        return {
          rotBindung: k2,
          strengerFehler: fehler,
          rohTokenA: await erhebeAbdruck(kopiePool, basis, blindeKonten, koListe(), ohne),
          rohTokenB: await erhebeAbdruck(kopiePool, basis, blindeKonten, koListe(), ohne),
          rohPfadA: await erhebeAbdruck(kopiePool, kaputterWeg, konten(), koListe(), ohne),
          rohPfadB: await erhebeAbdruck(kopiePool, kaputterWeg, konten(), koListe(), ohne),
        };
      });
    expect(
      rotBindung.length,
      "Ein ENTFERNTER Wiederholschluessel blieb unbemerkt — die Idempotenzzusage waere ungeprueft.",
    ).toBeGreaterThan(0);
    expect(rotBindung.join("\n")).toContain(
      `ko_kanten_beitrag: der Wiederholschluessel „${opferSchluessel}“`,
    );
    expect(rotBindung.join("\n")).toContain("FEHLT");
    // DIE SCHAERFE DES FALLS: die Beziehungen selbst sind hier ALLE da. Waere der Abdruck nur die
    // Kantentabelle und der Leseweg, waere dieser Schaden gruen durchgegangen.
    expect(rotBindung.filter((z) => z.startsWith("ko_kanten:"))).toEqual([]);
    expect(rotBindung.filter((z) => z.startsWith("Leseweg"))).toEqual([]);
    process.stderr.write(`${JOB} KALIBRIERUNG K2 (rot, erwartet):\n${rotBindung.join("\n")}\n`);

    // ------------------------------------------------------------------------------------ K3
    // 1. Die STRENGE Erhebung laesst einen ausgefallenen Leseweg gar nicht erst durch — und ihre
    //    Meldung nennt KO, Rolle und Status (BEN: „Ein Fehler nennt KO, Rolle und Status").
    expect(
      strengerFehler,
      "Die Erhebung hat einen ausgefallenen Leseweg zu einem Abdruck gemacht — Ersatzwerte gelten wieder als Bestand.",
    ).not.toBe("");
    for (const konto of konten()) {
      expect(strengerFehler, `die Rolle ${konto.rolle} wird nicht genannt`).toContain(
        `Rolle ${konto.rolle}`,
      );
    }
    for (const k of KOS) {
      expect(strengerFehler, `der Eintrag ${k.kurz} wird nicht genannt`).toContain(
        `KO ${koId(k.kurz)}`,
      );
    }
    expect(strengerFehler, "der Status fehlt in der Meldung").toMatch(/HTTP \d{3}/);

    // 2. Und der VERGLEICH sieht es auch dann, wenn beide Seiten denselben Ausfall zeigen. Das ist
    //    der Fall, den Runde 1 gruen bestehen liess.
    for (const [was, a, b] of [
      ["Recht entfallen (unbrauchbares Token)", rohTokenA, rohTokenB],
      ["Weg entfallen (nicht vorhandene Route)", rohPfadA, rohPfadB],
    ] as const) {
      // Erst der Beleg, dass die beiden Erhebungen wirklich IDENTISCH sind — sonst waere ein rotes
      // Ergebnis unten auch mit einem gewoehnlichen Unterschied erklaerbar.
      expect(stabil(a.sichten), `${was}: die beiden Erhebungen sind nicht identisch`).toBe(
        stabil(b.sichten),
      );
      expect(a.sichten.length).toBe(konten().length * KOS.length);
      for (const s of a.sichten) {
        expect(
          pruefeSicht(s).length,
          `${was}: ${s.rolle}/${s.koId} gilt trotz HTTP ${s.status} als gueltiger Bestand`,
        ).toBeGreaterThan(0);
      }
      const rot = vergleicheAbdruecke(a, b);
      expect(
        rot.length,
        `${was}: zwei identische Fehlerantworten blieben GRUEN — der Nachweis sieht seinen eigenen Ausfall nicht.`,
      ).toBeGreaterThan(0);
      // DIE SCHAERFE DES FALLS: die Tabellen sind auf beiden Seiten dieselben. Das Rot kommt
      // ausschliesslich vom Erfolgs- und Strukturbeleg des Lesewegs, nicht aus einem Nebeneffekt.
      expect(rot.filter((z) => z.startsWith("ko_kanten"))).toEqual([]);
      expect(
        rot.some((z) => z.includes("(vorher)")),
        `${was}: die Vorher-Seite fehlt`,
      ).toBe(true);
      expect(
        rot.some((z) => z.includes("(nachher)")),
        `${was}: die Nachher-Seite fehlt`,
      ).toBe(true);
      for (const konto of konten()) {
        expect(rot.join("\n"), `${was}: die Rolle ${konto.rolle} fehlt`).toContain(
          `Rolle ${konto.rolle}`,
        );
      }
      for (const k of KOS) {
        expect(rot.join("\n"), `${was}: der Eintrag ${k.kurz} fehlt`).toContain(
          `KO ${koId(k.kurz)}`,
        );
      }
      const statusse = [...new Set(a.sichten.map((s) => s.status))].sort();
      process.stderr.write(
        `${JOB} KALIBRIERUNG K3 · ${was} (rot, erwartet) · Statuscodes ${statusse.join("/")} · ${rot.length} Abweichungen:\n${rot.slice(0, 3).join("\n")}\n`,
      );
    }

    // ------------------------------------------------------------------------------------ K4
    // HTTP 200 IST NOCH KEIN BESTAND. K3 deckt den Fall „der Server antwortet nicht"; hier geht es
    // um den heimtueckischeren: er antwortet MIT 200, aber der Inhalt traegt die Zusage nicht
    // (BEN R1, Pruefluecke 6: „Zusaetzlich sollten HTTP 200 mit ungueltigem JSON oder fehlenden
    // Pflichtfeldern ausdruecklich scheitern").
    //
    // JOB 4305 · DER SYNTHETISCHE FALL IST ABGELOEST — die Antworten kommen jetzt ueber den DRAHT.
    //
    // BIS JOB 4305 stand hier eine Liste von Hand gebauter `Rollensicht`-Objekte: der Rumpf wurde im
    // Speicher verbogen und `vergleicheAbdruecke` direkt damit gefuettert. BENs Urteil zu 4275
    // Runde 3 (Punkt 6 PRUEFLUECKEN) hat das als offene Luecke benannt und den Ersatz gleich
    // mitgeliefert: „ungueltiges JSON ueber einen Test-HTTP-Server durch `sende` und
    // `erhebeAbdruck` fuehren." Genau das steht jetzt hier — der alte Weg ist ENTFERNT und laeuft
    // nicht daneben weiter.
    //
    // WAS DER UNTERSCHIED TRAEGT: `sende` parst den Rohtext selbst (`vorrichtung.ts:258-266`), und
    // `erhebeAbdruck` legt Status, Rumpf und Rohtext ab. Ein im Speicher gesetztes `rumpf: undefined`
    // umging beide Schritte. Jetzt geht jede dieser fuenf Antworten wirklich durch `fetch`, durch
    // `JSON.parse` und durch die Erhebung — gemessen wird der Weg und nicht mehr nur die Endstelle.
    //
    // KEINE PRODUKTAENDERUNG: der Server hier ist ein `node:http`-Server DIESES Tests, kein
    // Klarwerk-Prozess. Ein echter Klarwerk-Server, der 200 mit kaputtem Rumpf sendet, waere eine
    // Aenderung an `services/**`, und die verbietet der Auftrag (§4, §10).
    const halbeKante = {
      id: "irgendeine-kennung",
      art: "ergaenzt",
      richtung: "ungerichtet",
      urheber: "irgendwer",
      gesetztAm: "2026-09-17T00:00:00.000Z",
      status: "aktiv",
      herkunft: "kuratiert",
      version: 1,
    };
    /** Was der Test-HTTP-Server auf `/api/kos/:id/beziehungen` senden soll — je Fall eine Form. */
    const faelle = [
      {
        was: "HTTP 200, aber kein JSON",
        rumpf: () => "<html><body>502 Bad Gateway</body></html>",
        typ: "text/html",
        erwartet: "kein JSON-Objekt",
      },
      {
        was: "HTTP 200, aber „kanten“ fehlt",
        rumpf: (id: string) => JSON.stringify({ koId: id, total: 3 }),
        typ: "application/json",
        erwartet: "fehlt oder ist keine Liste",
      },
      {
        was: "HTTP 200, aber „total“ passt nicht zur Liste",
        rumpf: (id: string) => JSON.stringify({ koId: id, total: 3, kanten: [] }),
        typ: "application/json",
        erwartet: "passt nicht zu 0 gelieferten Beziehungen",
      },
      {
        was: "HTTP 200, aber die Antwort gehoert zu einem anderen Eintrag",
        rumpf: () => JSON.stringify({ koId: "ein-ganz-anderes-objekt", total: 0, kanten: [] }),
        typ: "application/json",
        erwartet: "nennt das Objekt",
      },
      {
        was: "HTTP 200, aber die Beziehung hat kein Gegenstueck",
        rumpf: (id: string) => JSON.stringify({ koId: id, total: 1, kanten: [halbeKante] }),
        typ: "application/json",
        erwartet: "hat kein Gegenstueck",
      },
    ] as const;

    // EIN Server fuer alle fuenf Faelle; `welcher` schaltet seine Antwortform um. Er horcht auf
    // 127.0.0.1 an einem vom Betriebssystem vergebenen Port und antwortet IMMER mit 200 — genau
    // das ist die Fehlerklasse: der Statuscode sagt „in Ordnung", der Inhalt traegt nichts.
    let welcher = 0;
    const kaputt = createServer((anfrage, antwort) => {
      const fall = faelle[welcher] ?? faelle[0];
      const id = /\/api\/kos\/([^/]+)\/beziehungen/.exec(anfrage.url ?? "")?.[1] ?? "";
      antwort.writeHead(200, { "content-type": fall.typ });
      antwort.end(fall.rumpf(decodeURIComponent(id)));
    });
    await new Promise<void>((fertig) => kaputt.listen(0, "127.0.0.1", () => fertig()));
    const kaputterPort = (kaputt.address() as AddressInfo).port;
    const kaputteBasis = `http://127.0.0.1:${kaputterPort}`;
    // Die Tabellenhaelfte des Abdrucks kommt aus einer der Wegwerfkopien — sie traegt das Schema
    // und ist auf beiden Seiten dieselbe. Das Rot unten stammt damit AUSSCHLIESSLICH vom Leseweg.
    const k4Pool = new Pool({ connectionString: pgUrl(v, kopieKanteDb) });
    try {
      for (const [nr, fall] of faelle.entries()) {
        welcher = nr;
        // 1. DIE STRENGE ERHEBUNG darf aus so einer Antwort gar keinen Abdruck machen.
        let strenger = "";
        try {
          await erhebeAbdruck(k4Pool, kaputteBasis, konten(), koListe());
        } catch (ausfall) {
          strenger = ausfall instanceof Error ? ausfall.message : String(ausfall);
        }
        expect(
          strenger,
          `${fall.was}: die Erhebung hat eine untragbare 200-Antwort zu einem Abdruck gemacht.`,
        ).not.toBe("");
        expect(strenger, fall.was).toContain(fall.erwartet);

        // 2. UND DER VERGLEICH sieht es auch, wenn BEIDE Seiten dieselbe 200-Antwort zeigen — der
        //    Fall, in dem ein reiner Vorher/Nachher-Vergleich gruen bliebe.
        const ohne = { ohnePruefung: true } as const;
        const a = await erhebeAbdruck(k4Pool, kaputteBasis, konten(), koListe(), ohne);
        const b = await erhebeAbdruck(k4Pool, kaputteBasis, konten(), koListe(), ohne);
        expect(stabil(a.sichten), `${fall.was}: die beiden Erhebungen sind nicht identisch`).toBe(
          stabil(b.sichten),
        );
        // Der Statuscode war wirklich 200 — sonst pruefte dieser Fall wieder nur K3.
        expect(
          [...new Set(a.sichten.map((s) => s.status))],
          `${fall.was}: der Test-HTTP-Server hat nicht mit 200 geantwortet`,
        ).toEqual([200]);
        const rot = vergleicheAbdruecke(a, b);
        expect(
          rot.length,
          `${fall.was}: blieb GRUEN — ein 200 ohne Inhalt gilt als Bestand.`,
        ).toBeGreaterThan(0);
        expect(rot.join("\n"), fall.was).toContain(fall.erwartet);
        const ersteSicht = a.sichten[0] as Rollensicht;
        expect(rot.join("\n"), `${fall.was}: die Rolle fehlt`).toContain(
          `Rolle ${ersteSicht.rolle}`,
        );
        expect(rot.join("\n"), `${fall.was}: der Eintrag fehlt`).toContain(`KO ${ersteSicht.koId}`);
      }
    } finally {
      await k4Pool.end();
      await new Promise<void>((fertig) => kaputt.close(() => fertig()));
    }
    process.stderr.write(
      `${JOB} KALIBRIERUNG K4 (rot, erwartet): ${faelle.length} Antwortformen mit HTTP 200 und untragbarem Rumpf, ueber einen Test-HTTP-Server auf Port ${kaputterPort} durch sende und erhebeAbdruck gefuehrt — alle rot.\n`,
    );
  }, 1_800_000);

  // ==============================================================================================
  // B3 — DERSELBE VERGLEICH GEGEN DIE WIEDERHERGESTELLTE DATENBANK, AUS EINEM NEUEN PROZESS: GRUEN
  // ==============================================================================================
  it("B3 · neuer Serverprozess auf der wiederhergestellten Datenbank — jede Beziehung Feld fuer Feld zurueck", async (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    expect(vorzustand, "B1 ist nicht gelaufen — B3 haette nichts zu vergleichen").not.toBeNull();
    const v = verbindung;
    const vorher = vorzustand as Abdruck;

    // DER PROZESSBELEG (G2 aus JOB 4155): der alte Prozess ist WIRKLICH weg, der neue ist ein
    // anderer. Kein Instanzwechsel im selben Node-Prozess.
    expect(prozessLebt(pidVorher), "der Serverprozess des Vorzustands lebt noch").toBe(false);
    nachInstanz = await starteKlarwerk({
      datenbankUrl: pgUrl(v, zielDb),
      was: "nach dem Restore",
    });
    pidNachher = nachInstanz.pid;
    expect(pidNachher).not.toBe(pidVorher);

    zielPool = new Pool({ connectionString: pgUrl(v, zielDb) });
    const nachher = await erhebeAbdruck(zielPool, nachInstanz.basis, konten(), koListe());

    // DER VERGLEICH — dieselbe Funktion, die in B2 zweimal rot war.
    const abweichungen = vergleicheAbdruecke(vorher, nachher);
    expect(
      abweichungen,
      `Der Wiederanlauf hat etwas verloren:\n${abweichungen.join("\n")}`,
    ).toEqual([]);

    // KALIBRIERUNG IM SELBEN FALL: der Vergleich oben waere auch bei zwei LEEREN Bestaenden gruen.
    // Er ist es nicht, weil hier wirklich etwas steht.
    expect(nachher.kanten.length).toBe(BEZIEHUNGEN.length);
    expect(nachher.bindungen.length).toBe(BEZIEHUNGEN.length);
    expect(nachher.kanten.every((k) => k.status === "aktiv")).toBe(true);

    // BEIDE LESERICHTUNGEN, ausdruecklich benannt statt nur mitverglichen: dieselbe gerichtete
    // Beziehung, von beiden Enden gelesen — gespiegelte Rolle, gespiegeltes Gegenstueck.
    const vonGamma = kantenVon(sicht(nachher, "admin", "gamma")).find(
      (k) => k.id === kanteId("gamma-alpha"),
    );
    const vonAlpha = kantenVon(sicht(nachher, "admin", "alpha")).find(
      (k) => k.id === kanteId("gamma-alpha"),
    );
    expect(vonGamma, "die gerichtete Beziehung fehlt an ihrer Quelle").toBeTruthy();
    expect(vonAlpha, "die gerichtete Beziehung fehlt an ihrem Ziel").toBeTruthy();
    expect(vonGamma?.rolle).toBe("quelle");
    expect(vonAlpha?.rolle).toBe("ziel");
    expect((vonGamma?.gegenstueck as { id: string }).id).toBe(koId("alpha"));
    expect((vonAlpha?.gegenstueck as { id: string }).id).toBe(koId("gamma"));
    expect(vonGamma?.art).toBe("ersetzt");
    expect(vonGamma?.richtung).toBe("gerichtet");
    expect(vonGamma?.urheber).toBe(dieser().adminId);
    expect(vonGamma?.herkunft).toBe("kuratiert");

    // Eine UNGERICHTETE Beziehung traegt nach dem Wiederanlauf weiterhin KEINE Rollenaussage — ein
    // erfundenes „quelle" waere eine Aussage, die niemand getroffen hat.
    const ungerichtet = kantenVon(sicht(nachher, "admin", "alpha")).find(
      (k) => k.id === kanteId("alpha-beta"),
    );
    expect(ungerichtet?.richtung).toBe("ungerichtet");
    expect(ungerichtet?.rolle).toBeUndefined();

    // Und der zweite Urheber ist auch zweiter geblieben — der Restore hat die Urheberschaft nicht
    // auf einen Namen zusammengezogen.
    const vonController = nachher.kanten.filter((k) => k.urheber === dieser().controllerId);
    expect(vonController.map((k) => k.id).sort()).toEqual(
      [kanteId("beta-gamma"), kanteId("alpha-geheim")].sort(),
    );
  }, 1_800_000);

  // ==============================================================================================
  // B4 — RECHTEENTZUG WIRKT AUCH NACH DEM RESTORE (Auftrag §5.4)
  // ==============================================================================================
  it("B4 · nach dem Restore sieht niemand, was er vorher nicht sehen durfte — und der Entzug gilt weiter", async (ctx) => {
    if (!verfuegbar || !nachInstanz) {
      ctx.skip();
      return;
    }
    const basis = nachInstanz.basis;

    /**
     * Eine Leseantwort, die VOR der Auswertung als gueltiger Bestand belegt ist.
     *
     * Ohne diesen Schritt haette auch dieser Fall die Luecke aus Runde 1: ein HTTP-Fehler hat keine
     * Kennung und keinen Titel im Text und bestuende jede „nicht enthalten"-Pruefung muehelos. Eine
     * verweigerte Antwort ist kein Beleg fuer Verschwiegenheit (Auftrag §9).
     */
    const liesGeprueft = async (
      rolle: string,
      kurz: string,
      token: string,
    ): Promise<Rollensicht> => {
      const antwort = await sende(basis, "GET", `/api/kos/${koId(kurz)}/beziehungen`, token);
      const s: Rollensicht = {
        rolle,
        koId: koId(kurz),
        status: antwort.status,
        rumpf: antwort.json,
        roh: antwort.text,
      };
      expect(pruefeSicht(s), `${rolle}/${kurz}: kein gueltiger Bestand`).toEqual([]);
      return s;
    };

    for (const [rolle, token] of konten()
      .filter((k) => k.rolle === EXPERTE.rolle || k.rolle === ENTZOGEN.rolle)
      .map((k) => [k.rolle, k.token] as const)) {
      const antwort = await liesGeprueft(rolle, "alpha", token);
      // WEDER KANTE NOCH KENNUNG NOCH TITEL NOCH ZAEHLER — geprueft an der SERIALISIERTEN Antwort,
      // wie es `tests/ko/kanten-lesekette-sichtbarkeit.test.ts:100-102` am InMemory-Weg tut.
      expect(kantenVon(antwort).map((k) => k.id)).not.toContain(kanteId("alpha-geheim"));
      expect(antwort.roh, `${rolle}: die Kennung des verborgenen Eintrags reist mit`).not.toContain(
        koId("geheim"),
      );
      expect(antwort.roh, `${rolle}: der Titel des verborgenen Eintrags reist mit`).not.toContain(
        "Lieferantenpreis",
      );
      // `total` zaehlt NACH dem Trimm — es gibt bewusst keinen Schnittzaehler der ausgefilterten
      // Kanten, der waere selbst die Existenzauskunft (JOB 1045 D3 §4.3 Nr. 3).
      expect(totalVon(antwort)).toBe(2);

      // Das verborgene Objekt SELBST ist fuer diese Rolle auch kein Einstieg: die Antwort ist ein
      // leeres Ergebnis und kein unterscheidbarer Fehler (`kanten-service.ts:659-667`). Auch das
      // ist eine GEPRUEFTE 200 und kein Fehlschlag, der zufaellig nichts enthaelt.
      const direkt = await liesGeprueft(rolle, "geheim", token);
      expect(totalVon(direkt)).toBe(0);
      expect(direkt.roh).not.toContain(koId("alpha"));
    }

    // KALIBRIERUNG IM SELBEN FALL: fuer die Rolle mit erweiterter Sichtbarkeit ist DIESELBE Kante
    // da. Ohne diesen Gegenfall waere der Negativtest oben auch mit einem Dienst gruen, der
    // schlicht nie etwas liefert.
    const controller = konten().find((k) => k.rolle === CONTROLLER.rolle);
    expect(
      controller,
      "das Controller-Konto fehlt — die Kalibrierung haette keinen Gegenfall",
    ).toBeTruthy();
    const weit = await liesGeprueft(CONTROLLER.rolle, "alpha", controller?.token ?? "");
    expect(totalVon(weit)).toBe(3);
    const verborgene = kantenVon(weit).find((k) => k.id === kanteId("alpha-geheim")) as
      | { gegenstueck: { id: string; title: string } }
      | undefined;
    expect(verborgene, "auch die erweiterte Sicht findet die Kante nicht mehr").toBeTruthy();
    expect(verborgene?.gegenstueck.id).toBe(koId("geheim"));
    expect(verborgene?.gegenstueck.title).toBe("Lieferantenpreis Ventile");

    // KEINE FREIGABE UEBER ALTBESTAND: die vor der Sicherung entzogene Rolle ist nach dem Restore
    // nicht wieder da — gelesen am wiederhergestellten Kontenbestand, nicht hergeleitet.
    const nutzer = await sende(basis, "GET", "/api/users", dieser().adminToken);
    expect(nutzer.status, nutzer.text).toBe(200);
    const liste = nutzer.json as { id: string; email: string; role: string }[];
    const wieder = liste.find((u) => u.id === dieser().entzogenId);
    expect(wieder, "das Konto mit dem entzogenen Recht fehlt nach dem Restore").toBeTruthy();
    expect(wieder?.role, "Der Restore hat die entzogene Controller-Rolle wieder hergestellt.").toBe(
      "experte",
    );
  }, 600_000);

  // ==============================================================================================
  // B5 — DER WIEDERHOLSCHLUESSEL HAT DEN RESTORE UEBERLEBT (Auftrag §5.5)
  // ==============================================================================================
  it("B5 · derselbe Beitrag erzeugt nach dem Restore keine zweite Beziehung — und ein fremder Inhalt wird abgewiesen", async (ctx) => {
    if (!verfuegbar || !nachInstanz || !zielPool) {
      ctx.skip();
      return;
    }
    const basis = nachInstanz.basis;
    const pool = zielPool;
    const adminToken = dieser().adminToken;
    const zaehle = async (): Promise<number> => {
      const a = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM ko_kanten");
      return Number(a.rows[0]?.n ?? "-1");
    };
    const vorherZahl = await zaehle();
    expect(vorherZahl).toBe(BEZIEHUNGEN.length);

    const quelle = await sende(basis, "GET", `/api/kos/${koId("alpha")}`, adminToken);
    const ziel = await sende(basis, "GET", `/api/kos/${koId("beta")}`, adminToken);
    expect(quelle.status, quelle.text).toBe(200);
    expect(ziel.status, ziel.text).toBe(200);
    const gesehen = {
      quelleVersion: (quelle.json as { version: number }).version,
      zielVersion: (ziel.json as { version: number }).version,
    };

    // ------------------------------------------------------------------------------------ (a)
    // DERSELBE BEITRAG, DERSELBE INHALT → 200 mit der BESTEHENDEN Kante, kein Versionsanstieg.
    // Der Bestand findet den Schluessel ueber `ko_kanten_beitrag` (`holeNachBeitrag`); ohne die
    // Tabelle im Dump entstuende hier eine ZWEITE Beziehung.
    const wiederholt = await sende(
      basis,
      "POST",
      `/api/kos/${koId("alpha")}/beziehungen`,
      adminToken,
      {
        zielId: koId("beta"),
        art: "ergaenzt",
        richtung: "ungerichtet",
        beitragSchluessel: BEZIEHUNGEN[0].schluessel,
        gesehen,
      },
    );
    expect(wiederholt.status, wiederholt.text).toBe(200);
    const bestehend = wiederholt.json as { id: string; version: number; urheber: string };
    expect(bestehend.id).toBe(kanteId("alpha-beta"));
    expect(bestehend.version).toBe(1);
    expect(bestehend.urheber).toBe(dieser().adminId);
    expect(await zaehle(), "die Wiederholung hat eine zweite Beziehung angelegt").toBe(vorherZahl);
    const nachWiederholung = await sende(
      basis,
      "GET",
      `/api/kos/${koId("alpha")}/beziehungen`,
      adminToken,
    );
    expect((nachWiederholung.json as { total: number }).total).toBe(3);

    // ------------------------------------------------------------------------------------ (b)
    // DERSELBE SCHLUESSEL, ANDERER INHALT → ABGEWIESEN, nach dem bestehenden Vertrag.
    //
    // DER CODE IST ABGELESEN, NICHT GERATEN: `pruefeSchluesselBindung`
    // (`services/knowledge-object/src/kanten-service.ts:265-275`) wirft
    // `new KantenError("CONFLICT", SCHLUESSEL_FREMD_MELDUNG)`, und `STATUS_BY_CODE`
    // (`services/app/src/http.ts:54`) bildet `CONFLICT` auf 409 ab. Die Meldung steht woertlich in
    // `kanten-service.ts:807-808` und nennt bewusst KEINE Endpunkte — der Aufrufer hat den fremden
    // Beitrag nicht gesehen. (Der Auftrag nennt die Routendatei `ko-routes.ts`; die drei
    // Beziehungswege liegen tatsaechlich in `services/app/src/routes/kanten-routes.ts`, und deren
    // Fehlerweg `sendeKantenfehler` reicht genau diesen Fehler an `sendError` weiter.)
    const fremd = await sende(basis, "POST", `/api/kos/${koId("alpha")}/beziehungen`, adminToken, {
      zielId: koId("gamma"),
      art: "ergaenzt",
      richtung: "ungerichtet",
      beitragSchluessel: BEZIEHUNGEN[0].schluessel,
      gesehen: {
        quelleVersion: gesehen.quelleVersion,
        zielVersion: (
          (await sende(basis, "GET", `/api/kos/${koId("gamma")}`, adminToken)).json as {
            version: number;
          }
        ).version,
      },
    });
    expect(fremd.status, fremd.text).toBe(409);
    const fehler = fremd.json as { error: string; message: string };
    expect(fehler.error).toBe("CONFLICT");
    expect(fehler.message).toContain("bereits für eine andere Verknüpfung verwendet");
    // Und die Meldung verraet den fremden Beitrag nicht.
    expect(fremd.text).not.toContain(koId("beta"));
    expect(await zaehle(), "die abgewiesene Anfrage hat trotzdem geschrieben").toBe(vorherZahl);
  }, 600_000);
});

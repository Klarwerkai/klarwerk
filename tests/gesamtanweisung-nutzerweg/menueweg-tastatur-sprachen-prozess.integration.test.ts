// ================================================================================================
// JOB 4323 · DER REST AUS JOB 4309 ALS EINE GEMESSENE STRECKE.
// ================================================================================================
//
// DIE FRAGE DIESER DATEI ist der Rest, den der Prüfer an JOB 4309 selbst benannt hat
// (`archiv/4309/runde-1/ben.md:27`): „NICHT GEPRÜFT: … echter Betriebssystem-Prozesswechsel,
// vollständiger Browserweg in Englisch/Niederländisch und Tastaturbedienung des neuen Menüwegs."
// Sie lautet:
//
//     Erreicht ein Mensch, der NUR die Tastatur benutzt, die Gesamtanweisung über das Menü —
//     auf Deutsch, auf Englisch und auf Niederländisch — und ist sein Bestand nach einem echten
//     Prozesswechsel des Servers noch da?
//
// ------------------------------------------------------------------------------------------------
// WAS HIER ECHT IST — und was diese Datei deshalb behaupten darf.
// ------------------------------------------------------------------------------------------------
//   · ECHTE POSTGRESQL: eine Wegwerf-Datenbank mit `test` im Namen, am Ende `DROP … WITH (FORCE)`.
//   · EIN ECHTER BETRIEBSSYSTEM-PROZESS: `node --import tsx services/app/src/server.ts`, eigene,
//     NICHT geerbte Umgebung, `NODE_ENV=production`, eigener Port. Das ist der Punkt, an dem diese
//     Datei über A8b hinausgeht: dort hiess „Neustart" `strecke.schliessen()` + `starteStrecke(…)`
//     im SELBEN Node-Prozess (`a8-menue-und-migration.integration.test.ts:658-668`), und
//     `a5-neustart.integration.test.ts:11` nennt einen echten Prozesswechsel „in vitest nicht
//     herstellbar". Das ist im Haus widerlegt — `tests/neuinstallation/erstinstallation.integration.test.ts`
//     (Fall N3) tut es seit JOB 4201, und diese Datei fährt dasselbe Muster mit einem Browser davor.
//   · DIE GEBAUTE FLÄCHE, ausgeliefert vom Serverprozess SELBST (`server.ts:60-66`). Kein
//     `mitFlaeche()`, keine Testhülle.
//   · ECHTE TASTENDRÜCKE. In dieser Datei kommt `.click(` NICHT vor — weder `seite.click` noch ein
//     `click()` aus `evaluate`. Das hält `zeuge-kein-klick-kein-stiller-skip.test.ts` im Tor fest.
//   · DER ECHTE SPRACHSCHALTER DER APP (`components/SprachSchalter.tsx`), bedient mit Tab und
//     Enter. Die Sprache wird NICHT über `localStorage` vorgesetzt — das ist der Unterschied
//     zwischen „die Fläche kann Englisch" und „ein Mensch stellt sie auf Englisch".
//
// WAS SIE NICHT MISST und was deshalb nirgends behauptet wird: andere Browser, den Word-Add-in-Host,
// Bildschirmleser, `docker compose`, TLS, die sechs Fälle (b)–(f) aus JOB 4309 in EN/NL. Und es gibt
// weiterhin KEINE Übersichtsseite (JOB 4309 §10, benannte Restarbeit): die angelegte Anweisung wird
// nach dem Prozesswechsel über IHRE ADRESSE geöffnet.
//
// PRÜFGRENZE, LAUT GEMELDET — ein Skip ist hier kein Grün. Ohne gesicherte `KLARWERK_PG_TEST_URL`
// und ohne Chromium steht der Grund SICHTBAR auf stderr (`befundsatz` aus
// `../wiki-gesamtanweisung-abnahme/laufzustand`), und der Zeugenfall ganz unten läuft IMMER und
// sagt ausdrücklich, dass dann nichts belegt ist.
//
// KEINE PRODUKTIVDATEN: ausschliesslich eine Wegwerf-Datenbank mit `test` im Namen.
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  type Browser,
  DIST,
  LIES_TEXT,
  type Seite,
  fn,
  starteChromium,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, Sitzung, mussGelingen, wissensobjektAnlegen } from "../gast-nutzerweg/strecke";
import { sprachbestand } from "../support/i18nBestand";
import {
  type Laufzustand,
  befundsatz,
  zaehltAlsBestanden,
} from "../wiki-gesamtanweisung-abnahme/laufzustand";
import { hatBrowser, starteBrowserOderBefund } from "./browserbefund";
import {
  MARKE,
  type Menuebefund,
  type Verbindung,
  WURZEL,
  anweisungAnlegen,
  bausteinAufnehmen,
  bausteineMuessenSichtbarSein,
  freierPort,
  frischesProfil,
  meldeAnMitTastatur,
  menuewegOhneMaus,
  mussSichtbarTragen,
  pgUrl,
  schneideMit,
  serverUmgebung,
  sichtbefund,
  spracheWechseln,
  stelleFlaecheBereit,
  warteAufGesund,
  zerlege,
} from "./weg";

const ADMIN = "menueweg-admin@gesamtanweisung-4323.test";
const KO_EINS = "Ventil oeffnen (JOB 4323)";
const KO_ZWEI = "Druck pruefen (JOB 4323)";
const ANWEISUNGSTITEL = "Anlage anfahren ohne Maus (JOB 4323)";
const NACHWEIS_EINS = "hash-eins-4323";
const NACHWEIS_ZWEI = "hash-zwei-4323";

/** Die drei Sprachen dieses Laufs, in der Reihenfolge, in der ein Mensch sie hier umstellt. */
const SPRACHEN = ["de", "en", "nl"] as const;

describe("JOB 4323 · der Menüweg zur Gesamtanweisung ohne Maus, in drei Sprachen, über einen echten Serverprozess", () => {
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let browser: Browser | undefined;
  let verfuegbar = false;
  let flaeche = "nicht hergestellt";
  let laufzustand: Laufzustand | undefined;
  const db = `klarwerk_ga4323_test_${`${Date.now()}`.slice(-9)}`;

  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      laufzustand = {
        gelaufen: false,
        grund:
          "keine gesicherte KLARWERK_PG_TEST_URL — Prozessneustart und Browserweg sind nicht messbar",
      };
      process.stderr.write(befundsatz(MARKE, laufzustand));
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      laufzustand = { gelaufen: false, grund: "KLARWERK_PG_TEST_URL nennt keinen Rechnernamen" };
      process.stderr.write(befundsatz(MARKE, laufzustand));
      return;
    }
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${db}`);
    // Ein fehlendes `apps/web/dist` ist ein AUFBAUFEHLER und wird hier geworfen, nicht übersprungen:
    // `stelleFlaecheBereit` baut die Fläche oder scheitert laut.
    flaeche = stelleFlaecheBereit();
    // ERST JETZT der Browser. Fehlt Chromium, entsteht ein BENANNTER Befund statt eines Wurfs —
    // und weil die Fläche oben nachweislich steht, kann dieser Befund nicht einen dist-Mangel
    // verdecken (`browserbefund.ts`, BENs Korrekturpflicht 2 zu Runde 1).
    const start = await starteBrowserOderBefund(starteChromium, () =>
      existsSync(join(DIST, "index.html")),
    );
    if (!hatBrowser(start)) {
      laufzustand = start.zustand;
      process.stderr.write(befundsatz(MARKE, laufzustand));
      return;
    }
    browser = start.browser;
    verfuegbar = true;
    laufzustand = { gelaufen: true, quelle: `${verbindung.host}:${verbindung.port}/${db}` };
    process.stderr.write(befundsatz(MARKE, laufzustand));
  }, 900_000);

  afterAll(async () => {
    await browser?.close();
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      await adminPool.end();
    }
  }, 120_000);

  // ==============================================================================================
  // DIE EINE STRECKE — (a) bis (e) in EINEM Lauf, in EINEM Chromium, gegen EINEN echten Prozess.
  // ==============================================================================================
  it("(a) Ersteinrichtung · (b) Menüweg DE ohne Maus · (c) anlegen und binden · (d) EN und NL über den echten Schalter · (e) echter Prozessneustart", async (ctx) => {
    if (!verfuegbar || !verbindung || !browser) {
      ctx.skip();
      return;
    }
    const echterBrowser = browser;
    const zugang = pgUrl(verbindung, db);
    const port = await freierPort();
    const basis = `http://127.0.0.1:${port}`;
    process.stderr.write(
      `${MARKE}: Strecke läuft · Fläche: ${flaeche} · Socket: 127.0.0.1:${port}\n`,
    );

    // ── DER SERVERPROZESS. Kein `buildApp`, kein `starteStrecke` — `server.ts` selbst. ───────────
    const starte = (): ChildProcessWithoutNullStreams =>
      spawn("node", ["--import", "tsx", "services/app/src/server.ts"], {
        cwd: WURZEL,
        env: serverUmgebung(zugang, port),
      });

    let prozess = starte();
    const protokoll: string[] = [];
    schneideMit(prozess, protokoll);
    const pool = new Pool({ connectionString: zugang });
    const tastatur: Record<string, number> = {};
    const menue: Record<string, Menuebefund> = {};

    try {
      await warteAufGesund(basis, prozess, protokoll, "erster Start");
      expect(prozess.pid, `${MARKE}: der erste Serverprozess hat keine PID`).toBeDefined();

      // Die Fassung der Datenhaltung, an der dieser Lauf gemessen wurde — kein geratener Wert.
      const pgFassung = (await pool.query<{ v: string }>("SELECT version() AS v")).rows[0]?.v ?? "";
      expect(pgFassung, `${MARKE}: PostgreSQL nennt seine Fassung nicht`).toContain("PostgreSQL");

      // ══ (a) ERSTEINRICHTUNG UND ZWEI WISSENSEINTRÄGE — am Draht, über den echten Socket. ══════
      //
      // Der Weg zu einem Wissenseintrag ist nicht der Gegenstand dieses Auftrags; der Weg zur
      // GESAMTANWEISUNG ist es. Die Fassungsnummern werden NACHGESEHEN, nicht geraten — eine
      // geratene Nummer liefe in „Diese Fassung gibt es nicht" und die Meldung zeigte auf die
      // falsche Stelle.
      const adminApi = new Sitzung(basis, "admin");
      mussGelingen(
        "POST /api/auth/setup",
        await adminApi.sende("POST", "/api/auth/setup", {
          name: "Admin",
          email: ADMIN,
          password: PASSWORT,
        }),
        201,
      );
      const koEins = await wissensobjektAnlegen(adminApi, KO_EINS);
      const koZwei = await wissensobjektAnlegen(adminApi, KO_ZWEI);
      const fassungVon = async (koId: string): Promise<number> => {
        const antwort = mussGelingen(
          `GET /api/kos/${koId}/versions`,
          await adminApi.sende("GET", `/api/kos/${koId}/versions`),
        );
        const saetze = (antwort.json as { version: number }[]) ?? [];
        expect(
          saetze.length,
          `${MARKE}: der Eintrag ${koId} hat keine belegte Fassung — dann ist er nicht bindbar`,
        ).toBeGreaterThan(0);
        return Math.max(...saetze.map((s) => s.version));
      };
      const fassungEins = await fassungVon(koEins);
      const fassungZwei = await fassungVon(koZwei);

      const erstes = await frischesProfil(echterBrowser);
      let folgeNachAufnahme: string[] = [];
      let anweisungId = "";
      let chromium = "";
      try {
        const seite: Seite = erstes.seite;
        const anmeldung = await meldeAnMitTastatur(seite, basis, ADMIN, PASSWORT);
        tastatur.anmeldung_email = anmeldung.email;
        tastatur.anmeldung_passwort = anmeldung.passwort;
        chromium =
          /Chrome\/[\d.]+/.exec(
            await seite.evaluate<string>(fn("() => navigator.userAgent")),
          )?.[0] ?? "(nicht lesbar)";

        // Die Fläche startet auf Deutsch, OHNE dass der Prüfstand etwas vorgesetzt hätte: das ist
        // die Vorgabe des Produkts (`lib/sprachwahl.ts:26`). Genau deshalb ist der Wechsel unten
        // eine Aussage über den Schalter und nicht über ein Init-Skript.
        await warte(
          seite,
          `() => document.documentElement.lang === "de"`,
          "die Fläche startet ohne vorgesetzte Wahl auf Deutsch",
          undefined,
          45_000,
        );
        expect(
          await seite.evaluate<string>(
            fn(
              `() => { try { return localStorage.getItem("kw.sprache") ?? "(nichts)"; } catch (e) { return "(Speicher gesperrt)"; } }`,
            ),
          ),
          `${MARKE}: im Speicher steht schon eine Sprachwahl — dann misst der Wechsel unten den Prüfstand`,
        ).toBe("(nichts)");

        // ══ (b) DER MENÜWEG AUF DEUTSCH, OHNE MAUS. ═════════════════════════════════════════════
        await seite.goto(`${basis}/start`, { waitUntil: "domcontentloaded" });
        menue.de = await menuewegOhneMaus(
          seite,
          sprachbestand("de")["menue.weitereBereiche"] ?? "",
          sprachbestand("de")["ga.bereich.titel"] ?? "",
          "de",
        );
        await mussSichtbarTragen(
          seite,
          '[data-testid="ga-bereich-anlegen"]',
          sprachbestand("de")["ga.bereich.anlegen"] ?? "",
          "der Einstieg zeigt den Anlegeknopf nicht sichtbar auf Deutsch",
        );

        // ══ (c) ANLEGEN UND ZWEI BAUSTEINE BINDEN — alles getippt und mit Enter ausgelöst. ══════
        anweisungId = await anweisungAnlegen(seite, ANWEISUNGSTITEL);
        await bausteinAufnehmen(seite, koEins, fassungEins, NACHWEIS_EINS, 1);
        await bausteinAufnehmen(seite, koZwei, fassungZwei, NACHWEIS_ZWEI, 2);
        // BEIDE Bausteine stehen SICHTBAR da — jeder einzeln, an seinem eigenen Text erkannt, in
        // dieser Reihenfolge. Nicht die DOM-Zahl und nicht `data-baustein`: BEN hat in Runde 1 beide
        // Bausteine unsichtbar gemacht und die Strecke blieb grün.
        const bausteineVorher = await bausteineMuessenSichtbarSein(
          seite,
          [KO_EINS, KO_ZWEI],
          "vor dem Prozessneustart",
        );
        folgeNachAufnahme = bausteineVorher.map((b) => b.kennung);

        // UND ES STEHT IN DER DATENBANK — nicht nur auf dem Bildschirm.
        const kopf = await pool.query<{ n: string }>(
          "SELECT count(*)::text AS n FROM gesamtanweisungen",
        );
        expect(
          kopf.rows[0]?.n,
          `${MARKE}: die angelegte Anweisung fehlt in gesamtanweisungen`,
        ).toBe("1");
        const bausteine = await pool.query<{ ko_id: string; ko_version: number }>(
          "SELECT ko_id, ko_version FROM gesamtanweisung_bausteine WHERE anweisung_id = $1 ORDER BY pos",
          [anweisungId],
        );
        expect(bausteine.rows.map((z) => z.ko_id)).toEqual([koEins, koZwei]);
        expect(bausteine.rows.map((z) => z.ko_version)).toEqual([fassungEins, fassungZwei]);

        // ══ (d) ENGLISCH UND NIEDERLÄNDISCH — über den ECHTEN Schalter, per Tastatur. ═══════════
        for (const sprache of SPRACHEN.filter((s) => s !== "de")) {
          const bestand = sprachbestand(sprache);
          const sollBereiche = bestand["menue.weitereBereiche"] ?? "";
          const sollTitel = bestand["ga.bereich.titel"] ?? "";
          const sollAnlegen = bestand["ga.bereich.anlegen"] ?? "";
          expect(
            [sollBereiche, sollTitel, sollAnlegen].every((w) => w.length > 0),
            `${MARKE}: der Sprachkatalog führt in „${sprache}" nicht alle drei Sollwerte — dann misst dieser Nachweis nichts`,
          ).toBe(true);

          const gewechselt = await spracheWechseln(seite, sprache);
          tastatur[`konto_${sprache}`] = gewechselt.konto;
          tastatur[`schalter_${sprache}`] = gewechselt.schalter;
          expect(gewechselt.htmlLang).toBe(sprache);
          expect(
            gewechselt.gespeichert,
            `${MARKE}: die Wahl „${sprache}" steht nicht in kw.sprache — sie überlebte kein Neuladen`,
          ).toBe(sprache);

          menue[sprache] = await menuewegOhneMaus(seite, sollBereiche, sollTitel, sprache);
          await mussSichtbarTragen(
            seite,
            '[data-testid="ga-bereich-anlegen"]',
            sollAnlegen,
            `der Einstieg zeigt den Anlegeknopf nicht sichtbar in „${sprache}"`,
          );
          // UND DER DEUTSCHE RÜCKFALL IST AUSGESCHLOSSEN: stünde der deutsche Name im Menü oder auf
          // der Seite, wäre der Nachweis oben auch mit einer nicht übersetzten Fläche grün.
          const deutscherTitel = sprachbestand("de")["ga.bereich.titel"] ?? "";
          const deutscherAnlegen = sprachbestand("de")["ga.bereich.anlegen"] ?? "";
          expect(
            menue[sprache]?.menuetext ?? "",
            `${MARKE}: im Menü steht in „${sprache}" der DEUTSCHE Name „${deutscherTitel}"`,
          ).not.toContain(deutscherTitel);
          expect(
            (await sichtbefund(seite, '[data-testid="ga-bereich"]')).text,
            `${MARKE}: auf dem Einstieg steht in „${sprache}" der DEUTSCHE Satz „${deutscherAnlegen}"`,
          ).not.toContain(deutscherAnlegen);

          // Die GEÖFFNETE Anweisung zeigt weiterhin ihren eigenen, unübersetzten Titel. Ein
          // Sprachwechsel fasst Inhalte nicht an (`SprachSchalter.tsx:32-34`) — und dass er es
          // wirklich nicht tut, steht hier und nicht nur dort.
          await seite.goto(`${basis}/gesamtanweisungen/${anweisungId}`, {
            waitUntil: "domcontentloaded",
          });
          await warte(
            seite,
            `(n) => document.querySelectorAll('[data-testid="ga-lesestand-baustein"]').length === n`,
            `die beiden Bausteine in „${sprache}"`,
            2,
            45_000,
          );
          await mussSichtbarTragen(
            seite,
            '[data-testid="ga-lesestand"]',
            ANWEISUNGSTITEL,
            `der Titel der Anweisung ist in „${sprache}" nicht mehr zu sehen`,
          );
          expect(
            await seite.evaluate<string>(fn("() => document.documentElement.lang")),
            `${MARKE}: nach dem Seitenaufbau steht die Fläche nicht mehr auf „${sprache}" — die Wahl hat das Laden nicht überlebt`,
          ).toBe(sprache);
        }

        // ── DAS NEULADEN IN NL: die Wahl liegt im Speicher, nicht im Arbeitsspeicher. ────────────
        await seite.reload({ waitUntil: "domcontentloaded" });
        await warte(
          seite,
          `() => document.documentElement.lang === "nl"`,
          "die Fläche steht nach dem Neuladen weiterhin auf „nl“",
          undefined,
          45_000,
        );
        expect(
          await seite.evaluate<string>(
            fn(
              `() => { try { return localStorage.getItem("kw.sprache") ?? "(nichts)"; } catch (e) { return "(Speicher gesperrt)"; } }`,
            ),
          ),
        ).toBe("nl");
      } finally {
        await erstes.kontext.close();
      }

      // ══ (e) DER ECHTE PROZESSNEUSTART. ════════════════════════════════════════════════════════
      //
      // Weggeworfen wird der PROZESS, nicht ein Objekt in ihm: SIGTERM, auf `exit` warten, und der
      // Beleg, dass der Socket wirklich tot ist. Ohne diesen Beleg könnte der Abruf unten noch den
      // alten Prozess treffen und der Nachweis bewiese nichts.
      const zeilenVorher = await zaehleBestand(pool, anweisungId);
      expect(zeilenVorher.anweisungen).toBe(1);
      expect(zeilenVorher.bausteine).toBe(2);

      const beendet = new Promise<void>((fertig) => prozess.once("exit", () => fertig()));
      prozess.kill("SIGTERM");
      await beendet;
      expect(
        prozess.killed || prozess.exitCode !== null || prozess.signalCode !== null,
        `${MARKE}: der Serverprozess ist nicht wirklich beendet worden — dann wäre der Neustart keiner`,
      ).toBe(true);
      await expect(fetch(`${basis}/health`)).rejects.toThrow();

      const pidVorher = prozess.pid;
      prozess = starte();
      protokoll.length = 0;
      schneideMit(prozess, protokoll);
      await warteAufGesund(basis, prozess, protokoll, "Neustart");
      expect(
        prozess.pid,
        `${MARKE}: der zweite Serverprozess trägt dieselbe PID (${String(pidVorher)}) — dann ist es derselbe`,
      ).not.toBe(pidVorher);

      // ── UND DER BESTAND IST DA. Neues Browserprofil, neue Anmeldung, dieselbe Anweisung. ──────
      const zweites = await frischesProfil(echterBrowser);
      try {
        const nachher = zweites.seite;
        await meldeAnMitTastatur(nachher, basis, ADMIN, PASSWORT);
        // Es gibt KEINE Übersichtsseite (JOB 4309 §10, benannte Restarbeit) — die Anweisung wird
        // über ihre Adresse geöffnet, und dieser Satz steht so auch in der Rückgabe.
        await nachher.goto(`${basis}/gesamtanweisungen/${anweisungId}`, {
          waitUntil: "domcontentloaded",
        });
        await warte(
          nachher,
          `(n) => document.querySelectorAll('[data-testid="ga-lesestand-baustein"]').length === n`,
          "die beiden Bausteine nach dem Prozessneustart",
          2,
          45_000,
        );
        await mussSichtbarTragen(
          nachher,
          '[data-testid="ga-lesestand"]',
          ANWEISUNGSTITEL,
          "der Titel ist nach dem Prozessneustart nicht mehr zu sehen",
        );
        // DIESELBE Fachprüfung wie vor dem Neustart: beide Bausteine SICHTBAR, an ihrem eigenen
        // Text erkannt, in derselben Reihenfolge. Erst danach der Abgleich der Kennungen — der sagt,
        // dass es dieselben ZEILEN sind, und nicht, dass ein Mensch sie sieht.
        const bausteineNachher = await bausteineMuessenSichtbarSein(
          nachher,
          [KO_EINS, KO_ZWEI],
          "nach dem Prozessneustart",
        );
        expect(
          bausteineNachher.map((b) => b.kennung),
          `${MARKE}: nach dem Prozessneustart stehen andere Bausteinzeilen da — der Bestand kam also nicht aus der Datenbank`,
        ).toEqual(folgeNachAufnahme);
        expect(
          await nachher.evaluate<string>(fn(LIES_TEXT)),
          `${MARKE}: der Lückenvermerk „Prüfanbindung“ überlebt den Prozessneustart nicht`,
        ).toContain("Prüfanbindung");
      } finally {
        await zweites.kontext.close();
      }

      const zeilenNachher = await zaehleBestand(pool, anweisungId);
      expect(
        zeilenNachher,
        `${MARKE}: die Zeilenzahlen haben sich über den Prozesswechsel verändert`,
      ).toEqual(zeilenVorher);
      // Und die zweite Migration im neuen Prozess (`server.ts:26`) hat nichts angerichtet.
      expect(zeilenNachher.anweisungen).toBe(1);
      expect(zeilenNachher.bausteine).toBe(2);

      process.stderr.write(
        `${MARKE} PROTOKOLL · Chromium ${chromium} · Socket 127.0.0.1:${port} · ${pgFassung.split(" ").slice(0, 2).join(" ")} · pid1=${String(pidVorher)} pid2=${String(prozess.pid)} · Tastenfolge je Sprache (Tab-Anschläge bis Zahnrad / bis „Bereiche“ / bis Menüpunkt, dann Enter): ${SPRACHEN.map(
          (s) => {
            const b = menue[s];
            return b ? `${s}=${b.zahnrad}/${b.bereiche}/${b.eintrag}` : `${s}=(nicht gefahren)`;
          },
        ).join(
          " · ",
        )} · Anmeldung=${tastatur.anmeldung_email}/${tastatur.anmeldung_passwort} · gesamtanweisungen ${zeilenVorher.anweisungen}→${zeilenNachher.anweisungen} · gesamtanweisung_bausteine ${zeilenVorher.bausteine}→${zeilenNachher.bausteine}\n`,
      );
    } finally {
      await pool.end();
      if (prozess.exitCode === null && prozess.signalCode === null) {
        const aus = new Promise<void>((fertig) => prozess.once("exit", () => fertig()));
        prozess.kill("SIGTERM");
        await aus;
      }
    }
  }, 1_200_000);

  // ==============================================================================================
  // 4323z · DER ZEUGE — er läuft IMMER und sagt, was dieser Lauf wirklich belegt hat.
  // ==============================================================================================
  //
  // Er fasst weder Datenbank noch Browser an und kann deshalb nicht selbst übersprungen werden. Ein
  // Lauf ohne Datenbank endet damit weiterhin nicht rot (das wäre eine Betriebsentscheidung und
  // nicht die dieses Auftrags) — aber er sagt es, und er sagt ausdrücklich, dass er nichts belegt.
  it("4323z — der Laufzustand ist entschieden, und ein Skip zählt nicht als bestanden", () => {
    process.stderr.write(befundsatz(MARKE, laufzustand));
    expect(
      laufzustand,
      "kein Laufzustand — beforeAll lief nicht durch, und dann sagt der Exitcode dieses Laufs nichts über die Sache",
    ).toBeDefined();
    if (!zaehltAlsBestanden(laufzustand)) {
      expect((laufzustand as { gelaufen: false; grund: string }).grund.length).toBeGreaterThan(0);
      return;
    }
    expect((laufzustand as { gelaufen: true; quelle: string }).quelle).toContain(db);
  });
});

/** Die Zeilenzahlen, an denen der Bestand hängt — vor und nach dem Prozesswechsel dieselben. */
async function zaehleBestand(
  pool: Pool,
  anweisungId: string,
): Promise<{ anweisungen: number; bausteine: number }> {
  const kopf = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM gesamtanweisungen");
  const teile = await pool.query<{ n: string }>(
    "SELECT count(*)::text AS n FROM gesamtanweisung_bausteine WHERE anweisung_id = $1",
    [anweisungId],
  );
  return {
    anweisungen: Number(kopf.rows[0]?.n ?? "-1"),
    bausteine: Number(teile.rows[0]?.n ?? "-1"),
  };
}

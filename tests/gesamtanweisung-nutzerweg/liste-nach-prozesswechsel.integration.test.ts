// ================================================================================================
// JOB 4357 · DER MENÜPUNKT FÜHRT AUF DEN BESTAND — NACH EINEM ECHTEN PROZESSWECHSEL, OHNE MAUS.
// ================================================================================================
//
// DIE FRAGE DIESER DATEI ist die des Auftrags, wörtlich:
//
//     Findet ein Mensch seine gespeicherte Gesamtanweisung am nächsten Tag über das MENÜ wieder —
//     ohne die Adresse mit Kennung notiert zu haben, ohne Maus, gegen einen SERVER, der in der
//     Zwischenzeit neu gestartet wurde?
//
// Bis JOB 4357 war die Antwort nein, und das stand in den Nachweisen dieses Ordners ausgeschrieben:
// „Es gibt KEINE Übersichtsseite (JOB 4309 §10, benannte Restarbeit) — die Anweisung wird über ihre
// Adresse geöffnet" (`menueweg-tastatur-sprachen-prozess.integration.test.ts:423`). Diese Datei
// misst genau den Weg, der dort fehlte. Der ältere Nachweis bleibt UNVERÄNDERT daneben stehen: er
// belegt den Menüweg zum Einstieg und die drei Sprachen, diese Datei den Weg vom Einstieg in den
// gespeicherten Bestand.
//
// ------------------------------------------------------------------------------------------------
// WAS HIER ECHT IST — und was diese Datei deshalb behaupten darf
// ------------------------------------------------------------------------------------------------
//   · ECHTE POSTGRESQL: eine Wegwerf-Datenbank mit `test` im Namen, am Ende `DROP … WITH (FORCE)`.
//   · EIN ECHTER BETRIEBSSYSTEM-PROZESS: `node --import tsx services/app/src/server.ts`, eigene,
//     NICHT geerbte Umgebung, `NODE_ENV=production`, eigener Port. Der Neustart ist SIGTERM, ein
//     toter Socket und eine NEUE PID — kein zweiter Anwendungsaufbau im selben Node-Prozess.
//   · DIE GEBAUTE FLÄCHE, ausgeliefert vom Serverprozess selbst — und FRISCH gebaut, wenn das
//     Bündel älter ist als der Quellstand (`stelleFrischeFlaecheBereit`, `./liste-weg.ts`). Ohne
//     diesen Schritt könnte ein altes `dist` die Bestandsliste gar nicht enthalten.
//   · ECHTE TASTENDRÜCKE. In dieser Datei kommt `.click(` NICHT vor — das hält
//     `zeuge-liste.test.ts` im Tor fest.
//   · EIN ZWEITES, FRISCHES BROWSERPROFIL nach dem Neustart: neue Anmeldung, leerer Speicher, KEINE
//     getippte Adresse. Der Weg geht über Zahnrad → Bereiche → Gesamtanweisungen → Eintrag.
//
// WAS SIE NICHT MISST und was deshalb nirgends behauptet wird: andere Browser, den Word-Add-in-Host,
// Bildschirmleser, `docker compose`, TLS, die Liste in Englisch oder Niederländisch, und die
// Rollenmatrix der neuen Tür (die misst `tests/wiki-gesamtanweisung-abnahme/a11-liste-rollenmatrix.test.ts`
// am Draht der gebauten App).
//
// PRÜFGRENZE, LAUT GEMELDET — ein Skip ist hier kein Grün. Ohne gesicherte `KLARWERK_PG_TEST_URL`
// und ohne Chromium steht der Grund SICHTBAR auf stderr (`befundsatz`), und der Zeugenfall ganz
// unten läuft IMMER und sagt ausdrücklich, dass dann nichts belegt ist.
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
  eintragOeffnenMitTastatur,
  stelleFrischeFlaecheBereit,
  zeileMussSichtbarSein,
} from "./liste-weg";
import {
  type Verbindung,
  WURZEL,
  anweisungAnlegen,
  bausteinAufnehmen,
  freierPort,
  frischesProfil,
  meldeAnMitTastatur,
  menuewegOhneMaus,
  pgUrl,
  schneideMit,
  serverUmgebung,
  warteAufGesund,
  zerlege,
} from "./weg";

const ADMIN = "liste-admin@gesamtanweisung-4357.test";
const KO_EINS = "Ventil oeffnen (JOB 4357)";
const ANWEISUNGSTITEL = "Anlage anfahren und wiederfinden (JOB 4357)";
const NACHWEIS = "hash-eins-4357";

describe("JOB 4357 · der Menüpunkt führt ohne getippte Adresse auf den gespeicherten Bestand", () => {
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let browser: Browser | undefined;
  let verfuegbar = false;
  let flaeche = "nicht hergestellt";
  let laufzustand: Laufzustand | undefined;
  const db = `klarwerk_ga4357_test_${`${Date.now()}`.slice(-9)}`;

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
    // Ein fehlendes ODER VERALTETES `apps/web/dist` ist ein AUFBAUFEHLER und wird hier behoben oder
    // laut geworfen — niemals übersprungen. Begründung in `./liste-weg.ts`.
    flaeche = stelleFrischeFlaecheBereit();
    // ERST JETZT der Browser. Fehlt Chromium, entsteht ein BENANNTER Befund statt eines Wurfs — und
    // weil die Fläche oben nachweislich steht, kann dieser Befund keinen dist-Mangel verdecken.
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

  it("(a) anlegen und binden · (b) echter Prozessneustart · (c) Menüweg auf die Liste · (d) per Tab und Enter in die Anweisung", async (ctx) => {
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

    const starte = (): ChildProcessWithoutNullStreams =>
      spawn("node", ["--import", "tsx", "services/app/src/server.ts"], {
        cwd: WURZEL,
        env: serverUmgebung(zugang, port),
      });

    let prozess = starte();
    const protokoll: string[] = [];
    schneideMit(prozess, protokoll);
    const pool = new Pool({ connectionString: zugang });

    try {
      await warteAufGesund(basis, prozess, protokoll, "erster Start");
      const pgFassung = (await pool.query<{ v: string }>("SELECT version() AS v")).rows[0]?.v ?? "";
      expect(pgFassung, `${MARKE}: PostgreSQL nennt seine Fassung nicht`).toContain("PostgreSQL");

      // ══ (a) EINRICHTUNG, EIN WISSENSEINTRAG, EINE ANWEISUNG MIT EINEM BAUSTEIN. ════════════════
      //
      // Der Weg zu einem Wissenseintrag ist nicht der Gegenstand dieses Auftrags; der Weg ZURÜCK zur
      // Anweisung ist es. Die Fassungsnummer wird NACHGESEHEN, nicht geraten.
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
      const fassungen = mussGelingen(
        `GET /api/kos/${koEins}/versions`,
        await adminApi.sende("GET", `/api/kos/${koEins}/versions`),
      );
      const saetze = (fassungen.json as { version: number }[]) ?? [];
      expect(
        saetze.length,
        `${MARKE}: der Eintrag ${koEins} hat keine belegte Fassung — dann ist er nicht bindbar`,
      ).toBeGreaterThan(0);
      const fassungEins = Math.max(...saetze.map((s) => s.version));

      let anweisungId = "";
      let chromium = "";
      const erstes = await frischesProfil(echterBrowser);
      try {
        const seite: Seite = erstes.seite;
        await meldeAnMitTastatur(seite, basis, ADMIN, PASSWORT);
        chromium =
          /Chrome\/[\d.]+/.exec(
            await seite.evaluate<string>(fn("() => navigator.userAgent")),
          )?.[0] ?? "(nicht lesbar)";
        await seite.goto(`${basis}/start`, { waitUntil: "domcontentloaded" });
        await menuewegOhneMaus(
          seite,
          sprachbestand("de")["menue.weitereBereiche"] ?? "",
          sprachbestand("de")["ga.bereich.titel"] ?? "",
          "de",
        );
        anweisungId = await anweisungAnlegen(seite, ANWEISUNGSTITEL);
        await bausteinAufnehmen(seite, koEins, fassungEins, NACHWEIS, 1);
      } finally {
        await erstes.kontext.close();
      }

      // UND SIE STEHT IN DER DATENBANK — nicht nur auf dem Bildschirm.
      const vorher = await zaehleBestand(pool);
      expect(
        vorher.anweisungen,
        `${MARKE}: die angelegte Anweisung fehlt in gesamtanweisungen`,
      ).toBe(1);
      expect(vorher.bausteine, `${MARKE}: der gebundene Baustein fehlt`).toBe(1);

      // ══ (b) DER ECHTE PROZESSNEUSTART. ════════════════════════════════════════════════════════
      //
      // Weggeworfen wird der PROZESS, nicht ein Objekt in ihm. Ohne den Beleg, dass der Socket
      // wirklich tot ist, könnte der Weg unten noch den alten Prozess treffen — und dann bewiese er
      // über die Haltbarkeit nichts.
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

      // ══ (c) + (d) DER WEG ZURÜCK — NEUES PROFIL, KEINE GETIPPTE ADRESSE. ══════════════════════
      const zweites = await frischesProfil(echterBrowser);
      let schritte = 0;
      let adresse = "";
      try {
        const nachher = zweites.seite;
        await meldeAnMitTastatur(nachher, basis, ADMIN, PASSWORT);
        await nachher.goto(`${basis}/start`, { waitUntil: "domcontentloaded" });

        // DER MENÜWEG IST DER EINZIGE WEG HIER. Die Kennung der Anweisung wird NIE in die Adresszeile
        // getippt — dass sie im Prüfstand bekannt ist, dient allein dem Nachsehen, ob die Liste die
        // RICHTIGE Zeile zeigt.
        await menuewegOhneMaus(
          nachher,
          sprachbestand("de")["menue.weitereBereiche"] ?? "",
          sprachbestand("de")["ga.bereich.titel"] ?? "",
          "de",
        );
        expect(
          await nachher.evaluate<string>(fn("() => window.location.pathname")),
          `${MARKE}: der Menüweg endet nicht auf /gesamtanweisungen`,
        ).toBe("/gesamtanweisungen");

        // DIE LISTE ZEIGT DIE ZUVOR GESPEICHERTE ANWEISUNG — Titel UND Stand, sichtbar gemessen.
        const standwort = sprachbestand("de")["ga.stand.entwurf"] ?? "";
        expect(
          standwort.length,
          `${MARKE}: der Sprachkatalog führt „ga.stand.entwurf" nicht — dann misst dieser Nachweis nichts`,
        ).toBeGreaterThan(0);
        const weg = await eintragOeffnenMitTastatur(
          nachher,
          anweisungId,
          ANWEISUNGSTITEL,
          standwort,
          "nach dem Prozessneustart",
        );
        schritte = weg.schritte;
        adresse = weg.adresseNachher;
        expect(
          adresse,
          `${MARKE}: Enter auf dem Eintrag führt nicht auf die Adresse dieser Anweisung (aktiv war: ${weg.aktivVorher.href})`,
        ).toContain(`/gesamtanweisungen/${anweisungId}`);

        // UND DIE GEÖFFNETE ANWEISUNG IST WIRKLICH DIESE: ihr Titel und ihr Baustein stehen da.
        await warte(
          nachher,
          `(n) => document.querySelectorAll('[data-testid="ga-lesestand-baustein"]').length === n`,
          "der gebundene Baustein nach dem Weg über die Liste",
          1,
          45_000,
        );
        // DER RÜCKWEG: über den Menüpunkt wieder auf die Liste, und die Zeile steht weiterhin da.
        // Ohne ihn wäre „man findet sie wieder" eine Aussage über genau einen Versuch.
        await nachher.goto(`${basis}/start`, { waitUntil: "domcontentloaded" });
        await menuewegOhneMaus(
          nachher,
          sprachbestand("de")["menue.weitereBereiche"] ?? "",
          sprachbestand("de")["ga.bereich.titel"] ?? "",
          "de",
        );
        await zeileMussSichtbarSein(
          nachher,
          anweisungId,
          ANWEISUNGSTITEL,
          standwort,
          "beim zweiten Gang über das Menü",
        );
      } finally {
        await zweites.kontext.close();
      }

      const nachherZeilen = await zaehleBestand(pool);
      expect(
        nachherZeilen,
        `${MARKE}: die Zeilenzahlen haben sich über den Prozesswechsel verändert`,
      ).toEqual(vorher);

      process.stderr.write(
        `${MARKE} PROTOKOLL · Chromium ${chromium} · Socket 127.0.0.1:${port} · ${pgFassung
          .split(" ")
          .slice(0, 2)
          .join(
            " ",
          )} · pid1=${String(pidVorher)} pid2=${String(prozess.pid)} · Tab-Anschläge bis zum Eintrag: ${schritte} · Adresse nach Enter: ${adresse} · gesamtanweisungen ${vorher.anweisungen}→${nachherZeilen.anweisungen} · gesamtanweisung_bausteine ${vorher.bausteine}→${nachherZeilen.bausteine}\n`,
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
  // 4357z · DER ZEUGE — er läuft IMMER und sagt, was dieser Lauf wirklich belegt hat.
  // ==============================================================================================
  //
  // Er fasst weder Datenbank noch Browser an und kann deshalb nicht selbst übersprungen werden.
  it("4357z — der Laufzustand ist entschieden, und ein Skip zählt nicht als bestanden", () => {
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
async function zaehleBestand(pool: Pool): Promise<{ anweisungen: number; bausteine: number }> {
  const kopf = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM gesamtanweisungen");
  const teile = await pool.query<{ n: string }>(
    "SELECT count(*)::text AS n FROM gesamtanweisung_bausteine",
  );
  return {
    anweisungen: Number(kopf.rows[0]?.n ?? "-1"),
    bausteine: Number(teile.rows[0]?.n ?? "-1"),
  };
}

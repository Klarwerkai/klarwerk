// ================================================================================================
// JOB 4271 · IM GROSSEN BESTAND WIRKLICH FINDEN — 10.000 EINTRÄGE, ECHTE POSTGRESQL, ECHTER BROWSER.
// ================================================================================================
//
// DIE KETTE, GLIED FÜR GLIED, OHNE EIN DOPPEL:
//
//     PostgreSQL-Zeile → PgKoRepo/PgKoSearchProjectionRepo → KoService.findSearchHits mit Deckel →
//     LibraryService.search → HTTP-Route über einen ECHTEN Socket → die GEBAUTE Fläche
//     (`apps/web/dist`) → Chromium, ECHTE Tastendrücke → sichtbare Trefferliste → geöffneter
//     Eintrag → und über eine unabhängige Lesung zurück in die Spalte.
//
// KEIN `page.goto` AUF DIE ZIEL-URL. Der Browser geht auf `/` (Anmeldung) und auf `/bibliothek` —
// beides Einstiege, die ein Mensch auch nimmt. Die Adresse des Zieldokuments wird NIE angesteuert;
// sie entsteht erst dadurch, dass der Treffer mit der Tastatur geöffnet wird.
//
// WARUM DIESE DATEI DIE FLÄCHE SELBST BAUT: derselbe Grund wie in
// `tests/gast-nutzerweg/gastweg-pg-im-browser.integration.test.ts:28-39` — der Torlauf hat `dist`,
// aber keine Datenbank; der Integrationslauf hat die Datenbank, aber kein `dist`. Liegt `dist`
// bereits vor, wird nichts gebaut.
//
// PRÜFGRENZE, LAUT GEMELDET: ohne echte PostgreSQL wird der Grund SICHTBAR auf stderr gemeldet und
// übersprungen. Ein stiller Skip sähe aus wie ein bestandener Lauf.
// KEINE PRODUKTIVDATEN: ausschliesslich eine Wegwerf-Datenbank mit `test` im Namen, am Ende entfernt.
//
// ================================================================================================
// WAS RUNDE 2 HIER GEÄNDERT HAT (BEN, Urteil zu Runde 1: PRODUKT ROT, FORM ROT)
// ================================================================================================
//
//   1 DIE PRÜFUNGEN STEHEN NICHT MEHR HIER, sondern in `zusagen.ts` — und die Kalibrierung ruft
//     GENAU DIESELBEN Funktionen unter einer Verstellung auf. Runde 1 hatte neben dem Hauptlauf
//     eine zweite, ähnliche Prüfung gestellt; ob DIESE Fälle rot werden, war damit nicht gezeigt.
//   2 DER INHALT WIRD VERGLICHEN, NICHT ABGETASTET. Sichtbarer Fliesstext, sichtbare Quellenliste
//     und sichtbare Fassung werden gegen die unabhängige Lesung aus der Spalte gehalten — „ist",
//     nicht „enthält". BENs Mutation (gegenteilige Anleitung bei erhaltenem Suchwort) wird dadurch
//     rot; die Begründung steht an `pruefeGegenDieSpalte`.
//   3 DAS SEEDMANIFEST UND DAS LAUFPROTOKOLL WERDEN GESCHRIEBEN, nicht nur zurückgegeben, und das
//     Protokoll entsteht NACH dem Aufräumen und nennt dessen Dauer.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppServices, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
// Der SERVERdeckel der Bibliothekssuche — importiert und nicht abgeschrieben: die Rechnung in G1a
// soll sich mit ihm bewegen, wenn das Haus ihn eines Tages ändert.
import { LIBRARY_SEARCH_HIT_LIMIT } from "../../services/library-analytics/src/service";
import { type Browser, DIST, mitFlaeche, starteChromium } from "../gast-nutzerweg/browserweg";
import {
  PASSWORT,
  type Sitzung,
  type Strecke,
  ersteinrichtung,
  gastAnlegen,
  mussGelingen,
  starteStrecke,
} from "../gast-nutzerweg/strecke";
import {
  ABLENKER,
  BERICHTORDNER,
  DECKEL_ABLENKUNG,
  FREMDE_VERTRAULICHE,
  GEHEIMWORT,
  GESAMT,
  HERKUNFT,
  MANIFEST_MARKE,
  type Seedergebnis,
  type Seedmanifest,
  VOLLTEXT_BEGRIFF,
  ZIEL_KENNUNG,
  ZIEL_QUELLE,
  ZIEL_TITEL,
  bauplan,
  kennungsHashAusGruppen,
  kennungsanzahl,
  manifestAusZeilen,
  manifestZeilen,
  schreibeBericht,
  seedeGrossbestand,
} from "./bestand";
import {
  JOB,
  type Tastaturbefund,
  frischerNutzerInDerBibliothek,
  sucheMitTastatur,
  warteAufBestand,
} from "./nutzerweg";
import {
  type FrischeSeite,
  type Zielbeleg,
  liesZielAusDerSpalte,
  zusage3FindetUndOeffnet,
  zusage4RichtigeQuelleFassungInhalt,
  zusage5FremdeBleibenDraussen,
  zusage6EntzugSperrt,
} from "./zusagen";

const ADMIN = "gross-admin@grossbestand-4271.test";
const NUTZER_NAME = "Neue Kollegin ohne Vorsortierung";
const NUTZER = "gross-neuling@grossbestand-4271.test";
const PG_SCHEMA = "postgresql:";

/** Wie viele Treffer die Suche nach dem Volltextbegriff haben MUSS — vorab gerechnet, nicht abgelesen. */
const TREFFER_BEGRIFF = 1 + DECKEL_ABLENKUNG;
/** Die Herkunftsgruppe: das Ziel und seine elf Nachbarn. */
const TREFFER_HERKUNFT = 12;

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
    throw new Error(`${JOB}: „${datenbank}" trägt kein „test" im Namen.`);
  }
  return `${PG_SCHEMA}//${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}@${v.host}:${v.port}/${datenbank}`;
}

function stelleFlaecheBereit(): string {
  if (existsSync(join(DIST, "index.html"))) {
    return "war schon da";
  }
  const begonnen = Date.now();
  execFileSync("npx", ["vite", "build"], {
    cwd: join(resolve(process.cwd()), "apps/web"),
    stdio: "pipe",
    timeout: 900_000,
  });
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error(`${JOB}: der Bau lief durch, aber ${DIST}/index.html fehlt weiterhin.`);
  }
  return `gebaut in ${Date.now() - begonnen} ms`;
}

// ------------------------------------------------------------------------------------------------
// DAS LAUFPROTOKOLL (Lieferung 8). KEINE LEISTUNGSZUSAGE — nur: „in diesem Lauf, an diesem
// Bestand, mit diesen Zeiten gemessen".
// ------------------------------------------------------------------------------------------------
const protokoll: Record<string, string | number> = {};
let rssSpitze = 0;

function merkeSpeicher(): void {
  rssSpitze = Math.max(rssSpitze, process.memoryUsage().rss);
}

function abschnitt(name: string, ms: number): void {
  protokoll[name] = `${ms} ms`;
  merkeSpeicher();
}

describe("JOB 4271 · der Großbestand-Nutzerweg gegen echte PostgreSQL im echten Browser", () => {
  let adminPool: Pool | undefined;
  let pool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let verfuegbar = false;
  let browser: Browser | undefined;
  let strecke: Strecke | undefined;
  let services: AppServices | undefined;
  let adminApi: Sitzung | undefined;
  let saat: Seedergebnis | undefined;
  let zeilenVorher = 0;
  /** Was G2 am Knopf „Mehr" gemessen hat. */
  let mehrBefund: Tastaturbefund | null = null;
  /** Was G1a gemessen hat — G1b bezieht sich darauf. */
  let sichtbareTreffer = -1;
  let zielInListe = false;
  const grossDb = `klarwerk_grossbestand_test_${`${Date.now()}`.slice(-9)}`;

  const zaehle = async (): Promise<number> => {
    const res = await (pool as Pool).query<{ n: string }>("SELECT count(*)::text AS n FROM kos");
    return Number(res.rows[0]?.n ?? "0");
  };

  /** Ein frisches, angemeldetes Profil in der Bibliothek — jede Zusage bekommt ihr eigenes. */
  const frischeSeite: FrischeSeite = () =>
    frischerNutzerInDerBibliothek(browser as Browser, (strecke as Strecke).basis, NUTZER, PASSWORT);

  beforeAll(async () => {
    const gestartet = Date.now();
    protokoll.startzeit = new Date().toISOString();
    // Der Commit der UNBERÜHRTEN Produktbasis (Lieferung 8). Liegt im Prüfcontainer kein
    // git-Verzeichnis, steht das so da — geraten wird nichts.
    try {
      protokoll.produktbasis = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      protokoll.produktbasis = "(kein git-Verzeichnis im Prüfcontainer)";
    }

    const url = guardedLocalPgTestUrl();
    if (!url) {
      process.stderr.write(
        `${JOB} UEBERSPRUNGEN: keine gesicherte KLARWERK_PG_TEST_URL — ohne echte PostgreSQL ist der Großbestand-Nutzerweg nicht messbar. Der Lauf gilt als ÜBERSPRUNGEN, nicht als bestanden.\n`,
      );
      return;
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
    await adminPool.query(`CREATE DATABASE ${grossDb}`);

    pool = createPool(pgUrl(verbindung, grossDb));
    const tMigrate = Date.now();
    await migrate(pool);
    abschnitt("migrate", Date.now() - tMigrate);

    zeilenVorher = await zaehle();

    // ── DER SEED: 10.000 Einträge über den PRODUKTWEG ────────────────────────────────────────
    services = buildPgServices(pool);
    const tSeed = Date.now();
    saat = await seedeGrossbestand(services.ko, zaehle, bauplan());
    abschnitt("seed", Date.now() - tSeed);
    // ══ DAS VOLLSTÄNDIGE MANIFEST GEHT AUF BEIDEN WEGEN HINAUS (Runde 3, BENs Korrekturpflicht) ══
    //
    // 1 · ARTEFAKTTRANSPORT: nach `<repo>/test-results/klarwerk-4271/`. Von dort packt der
    //     Prüfcontainer es in `test-artifacts.tar.gz` und der Läufer holt es samt sha256 herüber —
    //     nach dem Lauf ABRUFBAR, nicht nur während seiner Laufzeit.
    // 2 · GESICHERTES LOG: vollständig, in nummerierten Stücken mit Prüfsumme. NICHTS wird mehr
    //     herausgenommen; in Runde 2 stand hier `kennungenJeGruppe: undefined`, und genau das hat
    //     die Behauptung „vollständig auf stderr" zur Unwahrheit gemacht.
    protokoll.seedmanifestDatei = schreibeBericht(`seedmanifest-${grossDb}.json`, saat.manifest);
    const zeilen = manifestZeilen(saat.manifest);
    protokoll.seedmanifestLogzeilen = zeilen.length;
    process.stderr.write(`${zeilen.join("\n")}\n`);
    process.stderr.write(
      `${JOB} SEEDMANIFEST: vollständig als Artefakt unter ${protokoll.seedmanifestDatei} (Cloud: test-artifacts.tar.gz) UND vollständig in ${zeilen.length} Zeilen „${MANIFEST_MARKE}" oben — einschliesslich aller ${kennungsanzahl(saat.manifest.kennungenJeGruppe)} Kennungen je Gruppe.\n`,
    );
    process.stderr.write(
      `${JOB} Seed: ${saat.manifest.gespeicherteAnzahl} Zeilen · anlegen ${saat.manifest.dauerMs.anlegen} ms · validieren ${saat.manifest.dauerMs.validieren} ms · Kennungshash ${saat.manifest.kennungsHash}\n`,
    );

    // ── DIE FLÄCHE UND DER BROWSER ───────────────────────────────────────────────────────────
    const tBau = Date.now();
    protokoll.flaeche = stelleFlaecheBereit();
    abschnitt("flaeche", Date.now() - tBau);
    browser = await starteChromium();

    // ── WIE TEUER IST DIE INBETRIEBNAHME BEI 10.000 EINTRÄGEN? ───────────────────────────────
    //
    // Das wird hier GEMESSEN und nicht angenommen, weil daran der Start der ganzen Anwendung
    // hängt: `buildApp` bindet `stelleSuchprojektionBereit` in den `onReady`-Hook
    // (`services/app/src/build-app.ts:1874`) und setzt KEIN `pluginTimeout` (`:1847-1850`) —
    // es gilt also Fastifys Vorgabe von 10 Sekunden für genau diesen Schritt.
    const tAktiv = Date.now();
    const { readiness } = await (services as AppServices).ko.activateSearchProjectionV2();
    abschnitt("projektion-aktivieren", Date.now() - tAktiv);
    const tReif = Date.now();
    const zweiteReife = await (services as AppServices).ko.searchProjectionReadiness();
    abschnitt("projektion-readiness", Date.now() - tReif);
    process.stderr.write(
      `${JOB} Projektion: aktivieren ${protokoll["projektion-aktivieren"]} · readiness ${protokoll["projektion-readiness"]} · alle=${readiness.alle}/${zweiteReife.alle}\n`,
    );

    // ── DIE INSTANZ: erst JETZT horcht sie; ihr `onReady` prüft die Suchprojektion ────────────
    const tStart = Date.now();
    try {
      strecke = await starteStrecke({ pool, ...mitFlaeche() });
    } catch (fehler) {
      protokoll.startfehler = String(fehler).slice(0, 400);
      abschnitt("instanz-start", Date.now() - tStart);
      process.stderr.write(
        `${JOB} PRODUKTFEHLER: die Anwendung wird mit 10.000 Wissensobjekten NICHT bereit. Der Readiness-Schritt im onReady-Hook (services/app/src/build-app.ts:1874) überschreitet Fastifys Vorgabe-pluginTimeout (10 s; services/app/src/build-app.ts:1847-1850 setzt keinen eigenen Wert). Gemessen: aktivieren ${protokoll["projektion-aktivieren"]}, readiness ${protokoll["projektion-readiness"]}, Start ${protokoll["instanz-start"]}. Fehler: ${protokoll.startfehler}\n`,
      );
      return;
    }
    abschnitt("instanz-start", Date.now() - tStart);

    adminApi = (await ersteinrichtung(strecke, ADMIN)).sitzung;
    // Der Testnutzer wird ANGELEGT, nicht vorsortiert: keine gespeicherte Sicht, kein Filter,
    // keine Suchgeschichte. Die Rolle `viewer` hält KEIN `ko.validate` — genau deshalb ist er der
    // richtige Mensch für die Negativkontrolle aus Lieferung 5.
    mussGelingen(
      "Testnutzer anlegen",
      await gastAnlegen(adminApi, { name: NUTZER_NAME, email: NUTZER, role: "viewer" }),
      201,
    );
    abschnitt("vorbereitung-gesamt", Date.now() - gestartet);
    verfuegbar = true;
  }, 2_400_000);

  // DAS AUFRÄUMEN WIRD GEMESSEN UND ERST DANACH PROTOKOLLIERT (BEN, Korrekturpflicht 3): in
  // Runde 1 stand das Protokoll VOR dem Aufräumen und konnte dessen Dauer gar nicht kennen.
  afterAll(async () => {
    protokoll.rssSpitzeMb = `${(rssSpitze / 1024 / 1024).toFixed(1)} MB (Prüfprozess, NICHT Chromium/PostgreSQL)`;
    if (pool) {
      await pool
        .query<{ n: string }>("SELECT count(*)::text AS n FROM kos")
        .then((r) => {
          protokoll.zeilenNachher = Number(r.rows[0]?.n ?? "0");
        })
        .catch(() => undefined);
    }
    protokoll.zeilenVorher = zeilenVorher;

    const tAufraeumen = Date.now();
    await browser?.close();
    protokoll["aufraeumen-browser"] = `${Date.now() - tAufraeumen} ms`;
    const tInstanz = Date.now();
    try {
      await strecke?.schliessen();
    } finally {
      await pool?.end();
    }
    protokoll["aufraeumen-instanz-und-pool"] = `${Date.now() - tInstanz} ms`;
    const tDb = Date.now();
    if (adminPool) {
      await adminPool
        .query(`DROP DATABASE IF EXISTS ${grossDb} WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end();
    }
    protokoll["aufraeumen-datenbank"] = `${Date.now() - tDb} ms`;
    protokoll["aufraeumen-gesamt"] = `${Date.now() - tAufraeumen} ms`;
    protokoll.wegwerfdatenbank = `${grossDb} (entfernt)`;
    protokoll.berichtordner = BERICHTORDNER;

    const datei = schreibeBericht(`laufprotokoll-${grossDb}.json`, protokoll);
    process.stderr.write(
      `${JOB} LAUFPROTOKOLL (nur dieser Lauf, nur dieser Bestand; abgelegt unter ${datei}): ${JSON.stringify(protokoll, null, 1)}\n`,
    );
  }, 300_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // G0 — DAS SEEDMANIFEST: DIE ZAHLEN STAMMEN AUS DER DATENBANK, NICHT AUS DER ABSICHT.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("G0 · Seedmanifest: 10.000 gespeicherte Zeilen, Kennungshash, vorab festgelegte Zielkennung", async (ctx) => {
    if (!verfuegbarOderSkip(ctx)) {
      return;
    }
    const m = (saat as Seedergebnis).manifest;
    expect(m.erwartet.anzahl, "der Bauplan plant nicht 10.000 Einträge").toBe(GESAMT);
    expect(m.gespeicherteAnzahl, "in der Datenbank stehen nicht 10.000 Zeilen").toBe(GESAMT);
    expect(m.kennungsHash).toMatch(/^[0-9a-f]{64}$/);
    expect(m.erwartet.gruppen.ablenker).toBe(ABLENKER);
    expect(m.erwartet.gruppen.deckel).toBe(DECKEL_ABLENKUNG);
    expect(m.erwartet.gruppen["fremd-vertraulich"]).toBe(FREMDE_VERTRAULICHE);
    // Das geschriebene Manifest führt die Kennungen wirklich — sonst wäre die Datei ein Titelblatt.
    expect(m.gezaehlteGruppen, "die erzeugten Kennungen zählen anders als der Plan").toEqual(
      m.erwartet.gruppen,
    );

    // ══ DAS EXPORTIERTE MANIFEST WIRD GELESEN, NICHT NUR GEZÄHLT (Runde 3) ══════════════════════
    //
    // BENs Prüflücke 6 wörtlich: „G0 prüft lediglich die Dateiexistenz im laufenden Container …
    // Nach Cloudabschluss das tatsächlich exportierte Manifest einlesen, sämtliche Kennungen zählen
    // und seinen Hash nachrechnen." Genau das geschieht hier — an der DATEI, die gleich in
    // `test-artifacts.tar.gz` wandert, und nicht am Objekt im Speicher.
    const datei = String(protokoll.seedmanifestDatei);
    expect(existsSync(datei), `das Seedmanifest liegt nicht unter ${datei}`).toBe(true);
    const ausDerDatei = JSON.parse(readFileSync(datei, "utf8")) as Seedmanifest;
    expect(
      kennungsanzahl(ausDerDatei.kennungenJeGruppe),
      "das exportierte Manifest führt nicht 10.000 Kennungen",
    ).toBe(GESAMT);
    expect(
      kennungsHashAusGruppen(ausDerDatei.kennungenJeGruppe),
      "der Hash im exportierten Manifest lässt sich aus seinen eigenen Kennungen nicht nachrechnen",
    ).toBe(m.kennungsHash);
    expect(ausDerDatei.zielKoId, "das exportierte Manifest nennt eine andere Zielkennung").toBe(
      m.zielKoId,
    );
    expect(ausDerDatei.gespeicherteAnzahl).toBe(GESAMT);

    // UND DERSELBE RUNDWEG ÜBER DAS LOG: die Stücke, die eben nach stderr gegangen sind, ergeben
    // wieder genau dieses Manifest. Ginge unterwegs eine Zeile verloren, wirft `manifestAusZeilen`.
    const ausDemLog = manifestAusZeilen(manifestZeilen(m));
    expect(
      kennungsanzahl(ausDemLog.kennungenJeGruppe),
      `die ${MANIFEST_MARKE}-Zeilen ergeben nicht 10.000 Kennungen`,
    ).toBe(GESAMT);
    expect(kennungsHashAusGruppen(ausDemLog.kennungenJeGruppe)).toBe(m.kennungsHash);
    protokoll.seedmanifestGeprueft = `Datei ${datei} und ${MANIFEST_MARKE}-Zeilen: je ${GESAMT} Kennungen, Hash nachgerechnet`;

    // DIE UNABHÄNGIGE AUFLÖSUNG der technischen Kennung über die VORAB festgelegte fachliche
    // Kennung — nicht aus einem Suchergebnis (Auftrag §5.1).
    const ausDerSpalte = await (pool as Pool).query<{ id: string }>(
      "SELECT id FROM kos WHERE data->>'statement' LIKE $1",
      [`%${ZIEL_KENNUNG}%`],
    );
    expect(ausDerSpalte.rows.length, "die Zielkennung ist nicht eindeutig im Bestand").toBe(1);
    expect(ausDerSpalte.rows[0]?.id).toBe(m.zielKoId);
    protokoll.zielKoId = m.zielKoId;
    protokoll.kennungsHash = m.kennungsHash;

    // Und der Bestand ist wirklich so gebaut, wie der Plan es sagt — in der Datenbank nachgesehen.
    const mitBegriff = await (pool as Pool).query<{ n: string }>(
      "SELECT count(*)::text AS n FROM ko_search_projections WHERE search_text ILIKE $1",
      [`%${VOLLTEXT_BEGRIFF}%`],
    );
    expect(
      Number(mitBegriff.rows[0]?.n ?? "0"),
      "die Zahl der Einträge mit dem Volltextbegriff stimmt nicht mit dem Bauplan überein",
    ).toBe(TREFFER_BEGRIFF + FREMDE_VERTRAULICHE);
  }, 120_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // G1a — DIE REGRESSION: FREMDE VERTRAULICHE EINTRÄGE BELEGEN KEINEN DECKELPLATZ MEHR.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // WAS HIER BIS JOB 4303 STAND, UND WARUM ES WEG IST. Dieser Fall schrieb einen FEHLER fest:
  // `sichtbareTreffer === LIBRARY_SEARCH_HIT_LIMIT - FREMDE_VERTRAULICHE` (150). Die Rechnung war
  // richtig und die Ursache benannt — 50 vertrauliche Einträge eines anderen Menschen trugen den
  // höchsten Trust, besetzten 50 der 200 Deckelplätze und fielen erst an der Route wieder heraus,
  // weil der Deckel VOR dem Sichtbarkeitsfilter lag. JOB 4271 durfte das nur melden (dortiger
  // Auftrag §4), JOB 4303 hat es behoben: `opts.trim` reist jetzt durch `findSearchHits` bis in die
  // Datenquelle und wirkt dort auf der Grundmenge, vor dem Deckel
  // (`services/library-analytics/src/service.ts`, `services/knowledge-object/src/
  // search-projection-repo{,-pg}.ts`).
  //
  // DER ALTE ERWARTUNGSWERT IST DAMIT FALSCH GEWORDEN und wird ABGELÖST, nicht daneben gestellt.
  // Was dieser Fall jetzt festhält, ist die Zusage der Korrektur:
  //
  //   211 Einträge tragen den Begriff (161 sichtbare + 50 fremde vertrauliche; G0 zählt sie in der
  //       Projektionstabelle nach) — der Bestand ist UNVERÄNDERT, die 50 liegen weiter darin,
  //       tragen weiter den höchsten Trust und weiter den Begriff im Titel.
  //   161 sichtbare Anwärter passen unter die 200 Plätze, weil die 50 keinen mehr verbrauchen.
  //   161 Treffer nennt die Fläche deshalb — nicht 150, und nicht mehr als die Anwärter.
  //
  // DIE SCHÄRFE LIEGT IM „KEINER VON IHNEN": die Trefferzahl allein könnte auch aus einem erhöhten
  // Deckel stammen. Geprüft wird deshalb gegen die KENNUNGEN aus dem Seedmanifest, dass kein
  // einziger der 50 fremden Einträge in der sichtbaren Liste steht — und dass die Zahl exakt die
  // der sichtbaren Anwärter ist, nicht bloss grösser als vorher.
  it("G1a · REGRESSION: die 50 fremden vertraulichen Einträge verbrauchen keinen der 200 Deckelplätze", async (ctx) => {
    if (!verfuegbarOderSkip(ctx)) {
      return;
    }
    const t0 = Date.now();
    const m = (saat as Seedergebnis).manifest;
    const p = await frischeSeite();
    try {
      const ausgangslage = await warteAufBestand(p.seite, 1);
      expect(
        ausgangslage.zaehler,
        "die Bibliothek nennt keine Zahl — dann war der Abruf nicht frisch",
      ).not.toBeNull();
      process.stderr.write(`${JOB} G1 Ausgangslage: Fuss ${ausgangslage.fussText}\n`);

      const { stand } = await sucheMitTastatur(p.seite, VOLLTEXT_BEGRIFF, GESAMT);
      sichtbareTreffer = stand.zaehler ?? -1;
      zielInListe = stand.kennungen.includes(m.zielKoId);
      protokoll.g1SichtbareTreffer = sichtbareTreffer;
      protokoll.g1ZielInDerListe = String(zielInListe);
      process.stderr.write(
        `${JOB} G1a REGRESSION: ${TREFFER_BEGRIFF} sichtbare Anwärter + ${FREMDE_VERTRAULICHE} fremde vertrauliche = ${TREFFER_BEGRIFF + FREMDE_VERTRAULICHE} Begriffsträger auf ${LIBRARY_SEARCH_HIT_LIMIT} Deckelplätze; sichtbar sind ${sichtbareTreffer}. Ziel in der Liste: ${zielInListe}.\n`,
      );

      // DIE RECHNUNG, GLIED FÜR GLIED — unabhängig gerechnet, nicht vom Ergebnis abgeschrieben.
      // Erst die Voraussetzung: die Anwärter passen wirklich unter den Deckel. Täten sie es nicht,
      // sagte dieser Fall nichts über die Sichtbarkeit aus, sondern nur etwas über den Deckel.
      expect(
        TREFFER_BEGRIFF,
        "die sichtbaren Anwärter passen nicht unter den Deckel — dann misst dieser Fall den Deckel, nicht die Sichtbarkeit",
      ).toBeLessThanOrEqual(LIBRARY_SEARCH_HIT_LIMIT);
      expect(
        TREFFER_BEGRIFF + FREMDE_VERTRAULICHE,
        "der Bestand überfüllt den Deckel gar nicht mehr — dann ist die Regression nicht mehr messbar",
      ).toBeGreaterThan(LIBRARY_SEARCH_HIT_LIMIT);

      expect(
        sichtbareTreffer,
        "die sichtbare Trefferzahl ist nicht die Zahl der sichtbaren Anwärter — der Deckel greift weiterhin auf der ungefilterten Grundmenge",
      ).toBe(TREFFER_BEGRIFF);
      // UND AUSDRÜCKLICH NICHT MEHR der alte Fehlerwert. Er steht hier als das, was er ist: der
      // abgelöste Zustand, der nie wieder eintreten darf.
      expect(
        sichtbareTreffer,
        "die Fläche zeigt wieder Deckel minus fremde Einträge — der Fehler aus JOB 4271 ist zurück",
      ).not.toBe(LIBRARY_SEARCH_HIT_LIMIT - FREMDE_VERTRAULICHE);

      // DIE SCHÄRFE: keiner der 50 fremden Einträge steht in der Liste. Die Kennungen stammen aus
      // dem Seedmanifest, nicht aus der Antwort — sonst prüfte die Antwort sich selbst.
      const fremdeKennungen = m.kennungenJeGruppe["fremd-vertraulich"];
      expect(
        fremdeKennungen,
        "das Manifest führt die fremden Einträge nicht — dann ist die Abgrenzung nicht prüfbar",
      ).toHaveLength(FREMDE_VERTRAULICHE);
      const durchgerutscht = stand.kennungen.filter((id) => fremdeKennungen.includes(id));
      expect(
        durchgerutscht,
        "ein fremder vertraulicher Eintrag steht in der sichtbaren Liste — der Trim erweitert die Sichtbarkeit",
      ).toEqual([]);

      // UND DAS DOKUMENT LIEGT WIRKLICH IM BESTAND — dieselbe unabhängige Lesung wie bisher.
      const inDerSpalte = await (pool as Pool).query<{ n: string }>(
        "SELECT count(*)::text AS n FROM kos WHERE id = $1",
        [m.zielKoId],
      );
      expect(Number(inDerSpalte.rows[0]?.n ?? "0")).toBe(1);
    } finally {
      await p.kontext.close();
    }
    abschnitt("G1a-browserlauf", Date.now() - t0);
  }, 900_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // G1b — DIE ZUSAGE DES AUFTRAGS. SEIT JOB 4303 IST SIE EINGELÖST.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // JOB 4271 durfte diesen Fall nur ROT stehen lassen (dortiger Auftrag §4: melden, nicht
  // reparieren) — das Produkt lieferte das Dokument wirklich nicht. JOB 4303 hat die Ursache
  // behoben, und zwar an der Stelle, die G1a misst: der Deckel hat den Sichtbarkeitsfilter jetzt
  // VOR sich statt hinter sich.
  //
  // DER FALL SELBST IST UNVERÄNDERT. Weder Zielobjekt noch Suchbegriff noch Kriterium wurden
  // angefasst; er wird NICHT gelockert und NICHT übersprungen. Was sich geändert hat, steht im
  // Produkt, nicht hier.
  it("G1b · DIE ZUSAGE: das Zieldokument steht in der sichtbaren Trefferliste und wird per Tastatur geöffnet", async (ctx) => {
    if (!verfuegbarOderSkip(ctx)) {
      return;
    }
    const t0 = Date.now();
    const m = (saat as Seedergebnis).manifest;
    try {
      const befund = await zusage3FindetUndOeffnet(frischeSeite, {
        begriff: VOLLTEXT_BEGRIFF,
        zielKoId: m.zielKoId,
        zielTitel: ZIEL_TITEL,
        gesamtbestand: GESAMT,
        hinweis: `Fehlt das Ziel, greift der Deckel von ${LIBRARY_SEARCH_HIT_LIMIT} wieder auf der UNGEFILTERTEN Grundmenge: die ${FREMDE_VERTRAULICHE} fremden vertraulichen Einträge verbrauchen dann erneut Deckelplätze (JOB 4271, G1a). Seit JOB 4303 reicht services/library-analytics/src/service.ts den Trim an findSearchHits durch, und beide Suchprojektions-Adapter setzen ihn VOR dem Deckel auf der Grundmenge durch. G1a misst dieselbe Naht als Zahl.`,
      });
      protokoll.g1Tastaturschritte = befund.oeffnungsschritte;
    } finally {
      abschnitt("G1b-browserlauf", Date.now() - t0);
    }
  }, 900_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // G2 — DER ZWEITE FUND: ÜBER DIE KENNUNG. UND DIE RICHTIGE QUELLE, FASSUNG UND INHALT.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("G2 · über die Kennung gefunden — und gelesen wird die richtige Quelle, Fassung und derselbe Inhalt wie in der Spalte", async (ctx) => {
    if (!verfuegbarOderSkip(ctx)) {
      return;
    }
    const t0 = Date.now();
    const m = (saat as Seedergebnis).manifest;

    // Der Fund selbst — dieselbe Funktion wie G1b und G3, nur mit dem zweiten Suchweg.
    const fund = await zusage3FindetUndOeffnet(frischeSeite, {
      begriff: ZIEL_KENNUNG,
      zielKoId: m.zielKoId,
      zielTitel: ZIEL_TITEL,
      gesamtbestand: GESAMT,
      erwarteteTreffer: 1,
    });
    protokoll.g2Tastaturschritte = fund.oeffnungsschritte;

    // DIE UNABHÄNGIGE LESUNG ÜBER DEN POOL — sie ist der Massstab, nicht die Fläche.
    const beleg: Zielbeleg = await liesZielAusDerSpalte(pool as Pool, m.zielKoId);
    expect(
      beleg.quellen,
      "die Quelle in der Spalte ist eine andere als die vorab festgelegte",
    ).toEqual([ZIEL_QUELLE]);
    expect(beleg.fliesstext, "in der Spalte fehlt der Begriff im Fliesstext").toContain(
      VOLLTEXT_BEGRIFF,
    );
    protokoll.g2Fassung = `v${beleg.fassung}`;
    protokoll.g2FliesstextZeichen = beleg.fliesstext.length;

    // ── ERSTE LESUNG ────────────────────────────────────────────────────────────────────────────
    const erste = await zusage4RichtigeQuelleFassungInhalt(frischeSeite, beleg, {
      begriff: ZIEL_KENNUNG,
      gesamtbestand: GESAMT,
    });
    mehrBefund = erste.mehrBefund;

    // ── ZWEITE LESUNG MIT FRISCHEM KONTEXT: derselbe berechtigte Inhalt, dieselbe Fassung ──────
    // Ein neuer Browserkontext ist ein neues Profil und ein neuer Abruf; gelesen wird erst, wenn
    // die Auffrischung erfolgreich abgeschlossen ist (das erzwingt `sucheMitTastatur`).
    await zusage4RichtigeQuelleFassungInhalt(frischeSeite, beleg, {
      begriff: ZIEL_KENNUNG,
      gesamtbestand: GESAMT,
    });
    process.stderr.write(
      `${JOB} G2: sichtbarer Fliesstext (${beleg.fliesstext.length} Zeichen), Quelle „${beleg.quellen.join(", ")}" und Fassung v${beleg.fassung} stimmen in ZWEI frischen Kontexten mit der Spalte überein.\n`,
    );
    abschnitt("G2-browserlauf", Date.now() - t0);
  }, 900_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // G3 — DER DRITTE FUND: ÜBER DIE HERKUNFT.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("G3 · über die Herkunft gefunden — die Gruppe steht da, das Ziel ist darin", async (ctx) => {
    if (!verfuegbarOderSkip(ctx)) {
      return;
    }
    const t0 = Date.now();
    const m = (saat as Seedergebnis).manifest;
    const befund = await zusage3FindetUndOeffnet(frischeSeite, {
      begriff: HERKUNFT,
      zielKoId: m.zielKoId,
      zielTitel: ZIEL_TITEL,
      gesamtbestand: GESAMT,
      erwarteteTreffer: TREFFER_HERKUNFT,
    });
    protokoll.g3Tastaturschritte = befund.oeffnungsschritte;
    abschnitt("G3-browserlauf", Date.now() - t0);
  }, 900_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // G4 — FREMDE DATEN BLEIBEN DRAUSSEN: IN DER LISTE, IM TRANSPORT UND IN DER VORSCHAU.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("G4 · kein fremder vertraulicher Eintrag — nicht in der Liste, nicht im Rumpf, nicht in einer aufgeklappten Vorschau", async (ctx) => {
    if (!verfuegbarOderSkip(ctx)) {
      return;
    }
    const t0 = Date.now();
    const fremde = (saat as Seedergebnis).nachGruppe["fremd-vertraulich"];
    const befund = await zusage5FremdeBleibenDraussen(frischeSeite, {
      begriff: VOLLTEXT_BEGRIFF,
      gesamtbestand: GESAMT,
      fremde,
      geheimwort: GEHEIMWORT,
      vorschauen: 10,
    });
    protokoll.g4Vorschauen = befund.geoeffneteVorschauen;

    // UND DER BESTANDSNACHWEIS: derselbe Bestand, dieselbe Suche, aber mit dem Admin — der die
    // Stufe sehen DARF. Erschienen die Einträge auch dort nicht, sagte der Fall oben nur, dass der
    // Bestand leer ist. (Die eigentliche Kalibrierung der Abschirmung ist KZ5 — dort wird die
    // Stufe der fremden Einträge verstellt und DIESELBE Funktion muss rot werden.)
    const alsAdmin = await (adminApi as Sitzung).sende(
      "GET",
      `/api/library/search?q=${encodeURIComponent(VOLLTEXT_BEGRIFF)}`,
    );
    expect(alsAdmin.status).toBe(200);
    expect(
      alsAdmin.text,
      "auch der Berechtigte sieht das Geheimwort nicht — dann liegt es gar nicht im Bestand und die Aussage oben misst nichts",
    ).toContain(GEHEIMWORT);
    abschnitt("G4-browserlauf", Date.now() - t0);
  }, 900_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // G5 — RECHTEENTZUG SPERRT DENSELBEN WEG.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("G5 · nach dem Rechteentzug führt derselbe Bedienweg nicht mehr zum Dokument", async (ctx) => {
    if (!verfuegbarOderSkip(ctx)) {
      return;
    }
    const t0 = Date.now();
    const m = (saat as Seedergebnis).manifest;

    // DER ENTZUG über den Produktweg: die Stufe wandert auf `vertraulich`. Der Testnutzer ist
    // weder Autor noch Prüfer — `darfSehen` (services/app/src/sichtbarkeit.ts:66) schliesst ihn aus.
    await (services as AppServices).ko.setConfidentiality(m.zielKoId, "vertraulich", "admin-4271");

    // UNABHÄNGIG IN PG BESTÄTIGT — nicht an der Antwort des Aufrufs abgelesen.
    const spalte = await (pool as Pool).query<{ stufe: string | null }>(
      "SELECT data->>'confidentiality' AS stufe FROM kos WHERE id = $1",
      [m.zielKoId],
    );
    expect(spalte.rows[0]?.stufe, "in der Spalte steht die Stufe nicht").toBe("vertraulich");

    // WARUM NICHT ÜBER DEN VOLLTEXTBEGRIFF: dort war das Dokument schon VOR dem Entzug nicht in der
    // sichtbaren Liste (G1a). „Es ist jetzt weg" wäre an diesem Weg leer — man kann nicht verlieren,
    // was man nie hatte. Gemessen wird deshalb dort, wo der Weg vorher getragen hat: Kennung und
    // Herkunft.
    await zusage6EntzugSperrt(frischeSeite, {
      kennung: ZIEL_KENNUNG,
      herkunft: HERKUNFT,
      zielKoId: m.zielKoId,
      zielTitel: ZIEL_TITEL,
      gesamtbestand: GESAMT,
      herkunftsgruppeNachEntzug: TREFFER_HERKUNFT - 1,
    });
    abschnitt("G5-browserlauf", Date.now() - t0);
  }, 900_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // G6 — DER WEG ZU QUELLE UND FASSUNG IST EBENFALLS EIN TASTATURWEG.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // WAS HIER EINE RUNDE LANG FALSCH VERMUTET WURDE, und warum es jetzt anders dasteht: aus der
  // Klasse `outline-none` an `BibliothekLesen.tsx:3063` war geschlossen worden, der Knopf „Mehr"
  // zeige beim Tabben keinen Fokus. GEMESSEN (Cloud-Lauf 4576840db62b4cea9110403ade401609) ist das
  // Gegenteil: `outline=solid 2px` und ein zweifarbiger Ring am `boxShadow` — eine Fokusregel
  // weiter oben in der Kaskade greift. Die Vermutung war eine Lesart des Quelltexts, die Messung
  // ist der Befund; der Fall hält deshalb die MESSUNG fest und nicht die Vermutung.
  it("G6 · der Aufklapper zu Quelle und Fassung ist per Tastatur erreichbar UND zeigt sichtbaren Fokus", async (ctx) => {
    if (!verfuegbarOderSkip(ctx)) {
      return;
    }
    expect(
      mehrBefund,
      "G2 hat den Mehr-Knopf nie angesteuert — dann misst dieser Fall nichts",
    ).not.toBeNull();
    const befund = mehrBefund as Tastaturbefund;
    expect(befund.schritte, "der Knopf war gar nicht per Tab erreichbar").toBeGreaterThan(0);
    protokoll.g6MehrFokus = `${befund.fokusSichtbar} · ${befund.diagnose}`;
    process.stderr.write(`${JOB} G6 Fokus am Mehr-Knopf: ${protokoll.g6MehrFokus}\n`);
    expect(
      befund.fokusSichtbar,
      `der Knopf „Mehr" zeigt beim Tabben keinen sichtbaren Fokus — ${befund.diagnose}`,
    ).toBe(true);
  }, 120_000);

  /**
   * Übersprungen wird NUR wegen fehlendem Aufbau — nie wegen eines Produktfehlers.
   *
   * Startet die Anwendung mit 10.000 Einträgen nicht, dann ist das kein „nicht messbar", sondern
   * DAS ERGEBNIS. Es wird deshalb ROT gemeldet und nicht als Skip getarnt (Lieferung 10).
   */
  function verfuegbarOderSkip(ctx: { skip: () => void }): boolean {
    if (typeof protokoll.startfehler === "string") {
      throw new Error(
        `${JOB} PRODUKTFEHLER (nicht repariert): die Anwendung wird mit 10.000 Wissensobjekten nicht bereit. onReady → stelleSuchprojektionBereit (services/app/src/build-app.ts:1874) gegen Fastifys Vorgabe-pluginTimeout von 10 s (dort wird keiner gesetzt, :1847-1850). Gemessen in diesem Lauf: aktivieren ${protokoll["projektion-aktivieren"]}, readiness ${protokoll["projektion-readiness"]}. Ursprung: ${protokoll.startfehler}`,
      );
    }
    if (!verfuegbar || !browser || !strecke || !saat || !pool) {
      process.stderr.write(
        `${JOB} FALL UEBERSPRUNGEN: der Aufbau steht nicht (PostgreSQL, Chromium, gebaute Fläche). Der Fall gilt als ÜBERSPRUNGEN, nicht als bestanden.\n`,
      );
      ctx.skip();
      return false;
    }
    return true;
  }
});

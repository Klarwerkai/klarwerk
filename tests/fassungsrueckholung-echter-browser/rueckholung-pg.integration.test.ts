// ================================================================================================
// JOB 4263 · P — DERSELBE WEG, ABER GEGEN ECHTES POSTGRESQL, MIT NEUSTART UND EIGENER LESUNG.
// ================================================================================================
//
// DIE KETTE, die diese Datei schliesst und die sonst nirgends ganz gemessen ist:
//
//     PostgreSQL-Zeile (`kos.data`, `ko_versions.snapshot`) → PgKoRepo → KoService →
//     `PUT /api/kos/:id` (`restoredFromVersion`) über einen ECHTEN Socket → die gebaute Fläche →
//     Chromium, echte Tastendrücke → und über einen NEUSTART der Anwendung zurück in die Spalte.
//
// DER WEG IST NICHT ABGESCHRIEBEN. Er steht genau einmal in `weg.ts` und wird von dieser Datei mit
// `buildPgServices(pool)` gefahren und von `rueckholung-im-echten-browser.test.ts` mit
// Speicherablagen. Verschieden ist EIN Argument; alles andere ist Zeichen für Zeichen derselbe
// Ablauf. Was hier ZUSÄTZLICH gemessen wird, ist die Dauerhaftigkeit selbst:
//
//   (a) FRISCHER BROWSERKONTEXT — steckt im Weg selbst (`weg.ts`, Schritt 7): eigener Keksbeutel,
//       eigener Speicher, neue Anmeldung. Nichts wird aus dem Profil geerbt, das übernommen hat.
//   (b) APP-NEUSTART — die Instanz wird heruntergefahren und gegen DIESELBE Datenbank neu gestartet.
//       Ein Ergebnis, das nur im Prozessgedächtnis lebte, verschwindet hier.
//   (c) UNABHÄNGIGE LESUNG — direkt am Pool, mit ID- UND Versionsbezug, nicht über den Dienst, der
//       gerade geschrieben hat. Gelesen werden BEIDE Inhaltsfelder: die Kernaussage UND der Bericht,
//       letzterer zeichengenau gegen den Schnappschuss, der vor dem Weg in der Datenbank lag. Das
//       ist BENs Korrekturpflicht 1 aus Runde 1 — dort las diese Stelle nur Version und Kernaussage,
//       und ein verlorener Bericht fiel deshalb niemandem auf.
//
// PRÜFGRENZE, LAUT GEMELDET (Lehre 12.09., JOB 3668): Ohne echte PostgreSQL wird der Grund SICHTBAR
// auf stderr gemeldet und übersprungen. Ein stiller Skip sähe aus wie ein bestandener Lauf.
// KEINE PRODUKTIVDATEN: ausschliesslich eine Wegwerf-Datenbank mit `test` im Namen, am Ende entfernt.
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { type Browser, starteChromium } from "../gast-nutzerweg/browserweg";
import {
  PASSWORT,
  type Sitzung,
  type Strecke,
  ersteinrichtung,
  gastAnlegen,
  starteStrecke,
} from "../gast-nutzerweg/strecke";
import {
  BERICHT_ALT,
  BERICHT_FREMD,
  BERICHT_NEU,
  type Bremse,
  FASSUNG_ALT,
  FASSUNG_NEU,
  MARKE_ALT,
  MARKE_FREMD,
  MARKE_NEU,
  T,
  browserKennung,
  fahreAnhangkontrolle,
  fahreDieRueckholung,
  fahreRechtekontrolle,
  holeStand,
  ladeBildHoch,
  legeEintragAn,
  legeFassungenAn,
  liesImFrischenProfil,
  mitFlaecheBremseMutation,
  neueBremse,
  stelleFlaecheBereit,
  ueberarbeite,
} from "./weg";

const JOB = "[KLARWERK] JOB 4263";
const ADMIN = "pg-rueckholer@fassung-4263.test";
const FREMD = "pg-fremder@fassung-4263.test";
const LESER = "pg-leser@fassung-4263.test";
const TITEL = "Dichtungswechsel Presse 7 aus der Datenbank (JOB 4263)";
const ANHANG_TITEL = "Typenschild-Fall aus der Datenbank (JOB 4263)";

/** Zusammengesetzt statt ausgeschrieben — s. `tests/neuinstallation/…` (Fall N3 dort). */
const PG_SCHEMA = "postgresql:";

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

/**
 * Eine angemeldete API-Sitzung AN DIESEM Horchplatz.
 *
 * Sie hängt am Platz, nicht an der Person: nach dem Neustart horcht die Anwendung auf einem anderen
 * Port (`port: 0`), und eine Sitzung des alten Platzes liefe ins Leere. Gemessen, nicht vermutet —
 * der erste Lauf dieser Datei endete genau dort mit `ECONNREFUSED 127.0.0.1:41409` (Arbeitsprüfung
 * ceb08023c98f41dd88b49429138c4b82). Dass die ANMELDUNG danach wieder gelingt, ist dabei selbst ein
 * Beleg: die Konten stehen in derselben Datenbank und nicht im Prozessgedächtnis.
 */
async function anmeldeSitzung(strecke: Strecke, name: string, email: string): Promise<Sitzung> {
  const sitzung = strecke.profil(name);
  const an = await sitzung.sende("POST", "/api/auth/login", { email, password: PASSWORT });
  expect(an.status, `${email}: ${an.text}`).toBe(200);
  return sitzung;
}

/**
 * Welche Berichtsmarke trägt dieser Fließtext?
 *
 * Gefragt wird nach der MARKE und nicht nach dem ganzen HTML: welche Form der Sanitizer aus
 * `<p>…</p>` macht, ist nicht Gegenstand dieses Auftrags — WELCHER Bericht in welcher Fassung liegt,
 * schon. Die zeichengenaue Gleichheit steht daneben und vergleicht Gespeichertes mit Gespeichertem.
 */
function welcheBerichtsmarke(bericht: string | null): string {
  for (const [name, marke] of [
    ["ALT", BERICHT_ALT],
    ["NEU", BERICHT_NEU],
    ["FREMD", BERICHT_FREMD],
  ] as const) {
    if ((bericht ?? "").includes(marke)) {
      return name;
    }
  }
  return `(keine Berichtsmarke: ${JSON.stringify(bericht)})`;
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

describe("JOB 4263 P · die Rückholung im Browser, gegen echtes PostgreSQL", () => {
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let verfuegbar = false;
  let browser: Browser | undefined;
  let flaeche = "nicht hergestellt";
  const rueckholDb = `klarwerk_rueckholung_test_${`${Date.now()}`.slice(-9)}`;

  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      process.stderr.write(
        `${JOB} P ÜBERSPRUNGEN: keine gesicherte KLARWERK_PG_TEST_URL — die gemeinsame Kette aus Browser, echter PostgreSQL und Neustart ist damit nicht messbar.\n`,
      );
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(
        `${JOB} P ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL nennt keinen Rechnernamen.\n`,
      );
      return;
    }
    adminPool = new Pool({ connectionString: url });
    // DIE VERSIONEN WERDEN GELESEN, NICHT ABGESCHRIEBEN (Auftrag § 5, Lieferung 6): welche
    // PostgreSQL hier wirklich antwortet und welcher Chromium wirklich tippt.
    const wer = await adminPool.query<{ version: string }>("SELECT version() AS version");
    await adminPool.query(`CREATE DATABASE ${rueckholDb}`);
    flaeche = stelleFlaecheBereit();
    browser = await starteChromium();
    process.stderr.write(
      `${JOB} · Prüfstand: ${wer.rows[0]?.version ?? "(PostgreSQL-Version nicht lesbar)"} · Chromium ${browserKennung(browser)} · Fläche: ${flaeche}\n`,
    );
    verfuegbar = true;
  }, 1_200_000);

  afterAll(async () => {
    await browser?.close();
    if (adminPool) {
      await adminPool
        .query(`DROP DATABASE IF EXISTS ${rueckholDb} WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end();
    }
  }, 120_000);

  it("P1 — vergleichen, per Tastatur zurückholen, Konflikt, zweiter Griff — und der Inhalt überlebt frisches Profil, Neustart und eine eigene Lesung am Pool", async (ctx) => {
    if (!verfuegbar || !verbindung || !browser) {
      ctx.skip();
      return;
    }
    process.stderr.write(`${JOB} P1 läuft · Fläche: ${flaeche}\n`);
    const pool = createPool(pgUrl(verbindung, rueckholDb));
    const bremse: Bremse = neueBremse();
    let strecke: Strecke | undefined;
    let nachNeustart: Strecke | undefined;
    try {
      await migrate(pool);
      strecke = await starteStrecke({ pool, ...mitFlaecheBremseMutation(bremse) });
      const adminApi = (await ersteinrichtung(strecke, ADMIN)).sitzung;
      const fremd = await gastAnlegen(adminApi, {
        name: "Fremde Hand",
        email: FREMD,
        role: "admin",
      });
      expect(fremd.status, fremd.text).toBe(201);
      const leser = await gastAnlegen(adminApi, {
        name: "Nur Lesen",
        email: LESER,
        role: "viewer",
      });
      expect(leser.status, leser.text).toBe(201);
      const fremderApi = await anmeldeSitzung(strecke, "fremder", FREMD);

      // ── DIE AUSGANGSLAGE, in der Datenbank nachgesehen. ──────────────────────────────────────
      const koId = await legeFassungenAn(adminApi, TITEL, [FASSUNG_ALT, FASSUNG_NEU]);
      const vorher = await pool.query<{ version: string; statement: string; bericht: string }>(
        "SELECT data->>'version' AS version, data->>'statement' AS statement, data->>'bodyHtml' AS bericht FROM kos WHERE id = $1",
        [koId],
      );
      expect(vorher.rows[0]?.version, "der Ausgangsstand in der Spalte ist nicht v2").toBe("2");
      expect(vorher.rows[0]?.statement, "die Spalte trägt nicht die jüngere Marke").toBe(MARKE_NEU);
      expect(vorher.rows[0]?.bericht, "die Spalte trägt nicht den jüngeren Bericht").toContain(
        BERICHT_NEU,
      );
      const v1InDerAblage = await pool.query<{ statement: string; bericht: string }>(
        "SELECT snapshot->>'statement' AS statement, snapshot->>'bodyHtml' AS bericht FROM ko_versions WHERE ko_id = $1 AND version = 1",
        [koId],
      );
      expect(
        v1InDerAblage.rows[0]?.statement,
        "die Fassung, die zurückgeholt werden soll, liegt nicht als Schnappschuss in der Datenbank",
      ).toBe(MARKE_ALT);
      // ── DER AUSGANGS-SNAPSHOT DES BERICHTS, wörtlich aus der Datenbank. ──────────────────────
      //
      // Gegen IHN wird nach dem Neustart verglichen (BENs Korrekturpflicht 1) — nicht gegen eine
      // hier eingetippte Erwartung und nicht gegen das, was der Dienst gerade zurückgegeben hat.
      const berichtSnapshotV1 = v1InDerAblage.rows[0]?.bericht ?? "";
      expect(berichtSnapshotV1, "der Schnappschuss v1 trägt gar keinen Bericht").toContain(
        BERICHT_ALT,
      );

      // ── DER GANZE WEG — derselbe Ablauf wie im Tor, nur mit PostgreSQL darunter. ─────────────
      const befund = await fahreDieRueckholung({
        browser,
        strecke,
        bremse,
        eigeneApi: adminApi,
        eigeneEmail: ADMIN,
        koId,
        titel: TITEL,
        zielFassung: 1,
        markeZiel: MARKE_ALT,
        berichtZiel: BERICHT_ALT,
        standVorher: 2,
        fremderApi,
      });
      expect(befund.vergleichStatement).toContain(MARKE_ALT);
      expect(befund.vergleichStatement).toContain(MARKE_NEU);
      expect(befund.konfliktSatz).toContain(T("ko.snapshotRestoreStale"));
      expect(befund.erfolgSatz).toContain(T("ko.snapshotRestoreDone", { version: 1 }));
      expect(befund.standNachher.version).toBe(4);
      expect(befund.standNachher.statement).toBe(MARKE_ALT);
      expect(befund.standNachher.bodyHtml).toContain(BERICHT_ALT);
      // AUF DER SEITE STEHT DER BERICHT — die Kernaussage zeichnet die Leseansicht nur ersatzweise
      // (`weg.ts`, Schritt 7, dort gemessen). Sie wird deshalb am Datensatz geprüft, nicht am Text.
      expect(befund.textImFrischenProfil).toContain(BERICHT_ALT);
      expect(befund.textImFrischenProfil).not.toContain(MARKE_FREMD);
      expect(befund.textImFrischenProfil).not.toContain(BERICHT_FREMD);

      // ── (b) APP-NEUSTART: herunterfahren, neu starten, DIESELBE Datenbank. ───────────────────
      //
      // Ein Ergebnis, das nur im Prozessgedächtnis lebte, ist danach weg. Der neue Horchplatz hat
      // einen anderen Port (`port: 0`) — die Fläche wird also wirklich neu geladen, nicht aus einem
      // Zwischenspeicher gezogen.
      const alterPlatz = strecke.basis;
      await strecke.schliessen();
      strecke = undefined;
      nachNeustart = await starteStrecke({ pool, ...mitFlaecheBremseMutation(bremse) });
      expect(nachNeustart.basis, "der Neustart horcht am selben Platz wie vorher").not.toBe(
        alterPlatz,
      );
      const textNachNeustart = await liesImFrischenProfil(
        browser,
        nachNeustart.basis,
        ADMIN,
        koId,
        TITEL,
      );
      expect(
        textNachNeustart,
        "nach dem Neustart steht der zurückgeholte BERICHT nicht mehr auf der Seite",
      ).toContain(BERICHT_ALT);
      expect(
        textNachNeustart,
        "nach dem Neustart steht der jüngere Berichtstext wieder da",
      ).not.toContain(BERICHT_NEU);
      expect(
        textNachNeustart,
        "nach dem Neustart steht der fremde Berichtstext wieder da",
      ).not.toContain(BERICHT_FREMD);

      // ── (c) DIE UNABHÄNGIGE LESUNG: am Pool, mit ID UND Version. ────────────────────────────
      //
      // Nicht über den Dienst, der gerade geschrieben hat — und nicht über den, der gerade gelesen
      // hat. Verglichen wird gegen den Vorzustand oben: Kernaussage, Bericht UND Fassungsnummer.
      const spalte = await pool.query<{ version: string; statement: string; bericht: string }>(
        "SELECT data->>'version' AS version, data->>'statement' AS statement, data->>'bodyHtml' AS bericht FROM kos WHERE id = $1",
        [koId],
      );
      expect(spalte.rows[0]?.version, "die Spalte trägt nicht die vierte Fassung").toBe("4");
      expect(
        spalte.rows[0]?.version,
        "die Fassungsnummer hat sich gegenüber dem Vorzustand nicht bewegt",
      ).not.toBe(vorher.rows[0]?.version);
      expect(spalte.rows[0]?.statement, "in der Spalte steht nicht der Inhalt von v1").toBe(
        MARKE_ALT,
      );
      // ── UND DER BERICHT, GEGEN DEN AUSGANGS-SNAPSHOT — die Prüfung, die Runde 1 fehlte. ──────
      //
      // Verglichen wird ZEICHENGENAU mit dem, was vor dem ganzen Weg als Schnappschuss v1 in der
      // Datenbank lag: der zurückgeholte Fließtext IST dieser Text, nicht bloss einer, der dieselbe
      // Marke enthält. Und er ist nicht mehr der von v2 — sonst wäre nichts zurückgeholt worden.
      expect(
        spalte.rows[0]?.bericht,
        "in der Spalte steht nach dem Neustart nicht der Bericht des Schnappschusses v1",
      ).toBe(berichtSnapshotV1);
      expect(
        spalte.rows[0]?.bericht,
        "in der Spalte steht noch der Bericht des Vorzustandes — der Bericht wurde gar nicht zurückgeholt",
      ).not.toBe(vorher.rows[0]?.bericht);
      // Und die ALTE Fassung liegt unverändert daneben: die Ablage ist append-only, eine Übernahme
      // KOPIERT sie, sie bewegt sie nicht (`MehrAbschnitte.tsx:2230-2235`). Beide Inhaltsfelder
      // stehen in dieser Kette — mit ihren je eigenen Marken.
      const fassungen = await pool.query<{ version: number; statement: string; bericht: string }>(
        "SELECT version, snapshot->>'statement' AS statement, snapshot->>'bodyHtml' AS bericht FROM ko_versions WHERE ko_id = $1 ORDER BY version",
        [koId],
      );
      expect(fassungen.rows.map((z) => `${z.version}:${z.statement}`)).toEqual([
        `1:${MARKE_ALT}`,
        `2:${MARKE_NEU}`,
        `3:${MARKE_FREMD}`,
        `4:${MARKE_ALT}`,
      ]);
      expect(fassungen.rows.map((z) => `${z.version}:${welcheBerichtsmarke(z.bericht)}`)).toEqual([
        "1:ALT",
        "2:NEU",
        "3:FREMD",
        "4:ALT",
      ]);
      // Und die vierte ist nicht bloss markengleich, sondern ZEICHENGENAU der Schnappschuss v1.
      expect(
        fassungen.rows[3]?.bericht,
        "der abgelegte Bericht der neuen Fassung ist nicht Zeichen für Zeichen der von v1",
      ).toBe(berichtSnapshotV1);

      // ── DIE API-SITZUNGEN HÄNGEN AM HORCHPLATZ, nicht an der Person. ────────────────────────
      // Nach dem Neustart gilt ein anderer Port; die Sitzungen von vorhin liefen ins Leere. Dass
      // die erneute Anmeldung gelingt, ist selbst ein Beleg: die Konten stehen in der Datenbank.
      const adminNeu = await anmeldeSitzung(nachNeustart, "admin-neu", ADMIN);
      const fremderNeu = await anmeldeSitzung(nachNeustart, "fremder-neu", FREMD);
      const leserNeu = await anmeldeSitzung(nachNeustart, "leser-neu", LESER);

      // ── P2 · OHNE ÜBERNAHMERECHT — an derselben echten Datenbank. ────────────────────────────
      const standVorRechtekontrolle = await holeStand(adminNeu, koId);
      const rechte = await fahreRechtekontrolle(
        browser,
        nachNeustart,
        LESER,
        leserNeu,
        koId,
        TITEL,
        1,
      );
      expect(rechte.knopfDa, "der Leser bekommt einen Knopf, der ihm nichts nützt").toBe(false);
      expect(rechte.satzAmInhalt).toContain(T("ko.snapshotRestoreNoRight"));
      expect(
        [401, 403],
        `der direkte Griff des Lesers antwortete ${rechte.direkterGriff.status}: ${rechte.direkterGriff.rumpf}`,
      ).toContain(rechte.direkterGriff.status);
      const nachAbweisung = await pool.query<{ version: string }>(
        "SELECT data->>'version' AS version FROM kos WHERE id = $1",
        [koId],
      );
      expect(
        nachAbweisung.rows[0]?.version,
        "trotz Abweisung ist in der Datenbank eine Fassung entstanden",
      ).toBe(String(standVorRechtekontrolle.version));

      // ── P3 · DER ANHANG BLEIBT GESPERRT — ebenfalls an der echten Datenbank. ─────────────────
      const bildId = await ladeBildHoch(adminNeu, "typenschild-pg-4263.png");
      const anhangKoId = await legeEintragAn(
        fremderNeu,
        ANHANG_TITEL,
        "Mit Bild.",
        `<p>Typenschild: <img src="/api/objects/${bildId}/raw"></p>`,
      );
      const ohneBild = await ueberarbeite(fremderNeu, anhangKoId, {
        statement: "Ohne Bild.",
        bodyHtml: "<p>Ohne Bild.</p>",
      });
      expect(ohneBild.status, ohneBild.text).toBe(200);
      const anhang = await fahreAnhangkontrolle(
        browser,
        nachNeustart,
        ADMIN,
        adminNeu,
        leserNeu,
        anhangKoId,
        ANHANG_TITEL,
        bildId,
        1,
      );
      expect(
        anhang.bildVorher,
        "Vorbedingung verletzt: die Datei ist schon vor der Übernahme offen",
      ).toBe(404);
      expect(anhang.lageSatz, "die Absage nennt die Datei nicht").toContain(bildId);
      expect(anhang.standDanach.version, "trotz Abweisung ist eine Fassung entstanden").toBe(2);
      expect(anhang.bildNachher, "nach der Übernahme bekommt der Dritte die Rohbytes").toBe(404);
    } finally {
      // DER POOL WIRD IMMER BEENDET — auch wenn das Schliessen der Anwendung scheitert
      // (Lehre JOB 4223 R3: sonst schiesst der `DROP … WITH (FORCE)` die offene Verbindung ab und
      // die Meldung verdeckt die eigentliche Ursache). Kein `throw` im äusseren `finally`, das den
      // Fehler des `try`-Blocks überschriebe (biome `noUnsafeFinally`).
      try {
        await strecke?.schliessen();
        await nachNeustart?.schliessen();
      } finally {
        await pool.end();
      }
    }
  }, 1_800_000);
});

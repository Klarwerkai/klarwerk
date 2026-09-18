// ================================================================================================
// JOB 4337 · D3 KRITERIUM 3 — FREMDPRÜFUNG, FREIGABE UND SUCHE ALS EINE GEMESSENE STRECKE.
// ================================================================================================
//
// DIE LÜCKE, GEGEN DIE DIESE DATEI STEHT, hat der Prüfer selbst benannt (`archiv/3801/runde-2/
// ben.md:36`): „NICHT GEPRÜFT: … Postgres beziehungsweise Prozessneustart mit dauerhafter
// Datenhaltung, Browser, Office, … Mehrnutzerfälle." Die vorhandene Strecke
// `tests/demo-erster-nutzerweg/` fährt den Demo-Weg an der API IM SELBEN PROZESS und kennt weder
// Fremdprüfung noch Freigabe (`durchstich.test.ts:377-378`: leer → Konto → Quelle → Entwurf →
// auffindbar). Das Register sagt dasselbe: „Fremdprüfung, Freigabe und anschliessende Suche sind
// weiterhin als gesamter Nutzerweg nachzuweisen" (`register/planung/MEILENSTEINE.json`, D3/3).
//
// DIE KETTE, DIE HIER STEHT — eine Strecke, sieben Stationen, in der Reihenfolge eines Menschen:
//
//   echte PostgreSQL (Wegwerf-Datenbank)
//     → EIGENER OS-PROZESS `services/app/src/server.ts` (kein `buildApp` im Testprozess)
//       → echter Socket auf 127.0.0.1:<Port>
//         → die GEBAUTE Fläche (`apps/web/dist`, vom Prozess selbst ausgeliefert)
//           → Chromium, zwei getrennte Browserprofile (Admin und zweite Person)
//             → Import über den SICHTBAREN Dateiwähler · Einreichen · Prüfen · Freigeben · Suchen
//               → Prozessneustart (echtes SIGTERM, neue Prozessnummer) und eine NEUE Sitzung
//                 → und an jeder Station zurück in die Tabellen `users`, `drafts`, `kos`,
//                   `ratings`, `ko_evidence`, `audit`.
//
// WARUM JEDE STATION EIN EIGENER `it` IST (Lehre 4324 R2): stünde alles in einem Fall, wäre mit dem
// ersten Fehlschlag auch jede spätere Station UNGEMESSEN — der Prüfer könnte die belegten
// Teilstrecken nicht einzeln abnehmen. Was eine Station der nächsten weitergibt, steht in wenigen
// benannten Feldern; fehlt eines, scheitert die nächste LAUT (`brauche`) statt still zu überspringen.
//
// PRÜFGRENZE, LAUT GEMELDET: ohne echte PostgreSQL wird der Grund SICHTBAR auf stderr gemeldet und
// übersprungen — ein stiller Skip sähe aus wie ein bestandener Lauf (Lehre 12.09., JOB 3668).
// KEINE PRODUKTIVDATEN: ausschliesslich eine Wegwerf-Datenbank mit `test` im Namen, am Ende
// entfernt — und zwar erst NACH `warteAufVerbindungsende` (JOB 4265).
//
// „SICHTBAR" HEISST SICHTBAR (REGELN.md 9): jede Behauptung über etwas, das ein Mensch LIEST, geht
// durch `sichtbarZugesichert` (ganze Seite, JOB 4324) oder `feldSichtbarZugesichert` (feldweise,
// dieser Ordner). Beide kalibrieren sich bei JEDEM Aufruf durch gezieltes Ausblenden genau ihres
// Trägers. Kein `textContent`.
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import { createPool } from "../../services/app/src/db";
import type { Role } from "../../services/auth/src/types";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { TRUST_MAX } from "../../services/validation";
import {
  aufEingelesenWarten,
  dateiUeberSichtbareAuswahl,
  einreichenUndKennung,
  satz,
} from "../d3-dateien-durchgaengig/d3-buehne";
import { fn } from "../design/h3-blatt-buehne";
import type { Kontext } from "../gast-nutzerweg/browserweg";
import { profil, starteChromium } from "../gast-nutzerweg/browserweg";
import { PASSWORT, Sitzung, gastAnlegen, mussGelingen } from "../gast-nutzerweg/strecke";
import {
  type Verbindungszeile,
  alsBefund,
  warteAufVerbindungsende,
} from "../gast-nutzerweg/verbindungsende";
import {
  type BrowserMitVersion,
  SELEKTOR_DA,
  type SeiteMitDialogUndRoute,
  type Verbindung,
  aufSichtbarkeitWarten,
  aufZustandWarten,
  entwurfszahl,
  entwurfszeile,
  klickKnopf,
  persistierteQuellenzeile,
  pgUrl,
  sichtbarZugesichert,
  stelleFlaecheBereit,
  zerlege,
} from "../import-wiederoeffnen-nutzerweg/strecke";
import { anmeldenAnDerMaske } from "../rollen-sichtbar-nutzerweg/flaeche";
import {
  FALL_RAHMEN_MS,
  dateiwegOeffnen,
  flaechensatz,
  ganzdokumentWaehlen,
  kennungAusOeffnenLink,
  speichernDruecken,
  wartebudget,
} from "../ux19-speichern-oeffnen-reload/ux19-buehne";
import {
  DATEI_NAME,
  DOKUMENTSATZ,
  DOKUMENTWORT,
  ERSTER_SATZ,
  FREMDWORT,
  JOB,
  type Serverlauf,
  TABELLEN,
  abdruck,
  antwortetHealth,
  auditzeilenZuObjekt,
  ausblendregelEntfernen,
  ausblendregelSetzen,
  belegzeilen,
  bestandsabbild,
  bewertungszeile,
  brauche,
  demoAnlage,
  ersteinrichtungAmProzess,
  freierPort,
  gegenprobe,
  holeRohbytes,
  isolationsbefund,
  kalibrierungHerkunft,
  kalibrierungScharf,
  kontozeile,
  kozeile,
  pgKurzversion,
  pruefeAuditFassungen,
  pruefeBestandsumfang,
  pruefeBewertung,
  pruefeFreigabe,
  rohpfadAusRumpf,
  serverMussStehen,
  starteServerprozess,
  sucheEingeben,
  sucheUndPruefeTreffer,
  zeilenzahl,
} from "./strecke";

/** Die beiden Menschen dieser Demo — eine eigene Adresse je Rolle, nichts aus fremden Läufen. */
const ADMIN_MAIL = "betreiber@job4337.test";
const PRUEFER_MAIL = "pruefende@job4337.test";
/** Die Rolle der zweiten Person: `controller` — s. Begründung am Fall S1. */
const PRUEFER_ROLLE: Role = "controller";
/** Das Fenster: dasselbe Maß, unter dem die D3-Ketten den Dateiweg abgenommen haben (1280×800). */
const FENSTER = { width: 1280, height: 800 };

const BLATT = '[data-testid="blatt"]';
const PRUEFKARTE = '[data-testid="pruefen-karte"]';
const FREIGEBEN_KNOPF = '[data-testid="pruefen-entscheidung-up"]';
const KARTENMENUE = '[data-testid="pruefen-menue-karte"]';
const KARTENMENUE_BLATT = '[data-testid="pruefen-menue-panel-karte"]';

/** Der Schalter der Gegenproben (beide Formen s. `strecke.ts`). */
const KALIBRIERUNG = kalibrierungScharf();

/** Ist dieses Bedienelement BETÄTIGBAR? („da" allein sagt nichts — s. `ux19-buehne.ts:746`.) */
const KNOPF_BETAETIGBAR = `(sel) => {
  const b = document.querySelector(sel);
  return !!b && !b.disabled && b.getAttribute('aria-disabled') !== 'true';
}`;

/** Der Text, den ein Element in eigenen Textknoten trägt — für Meldungen, nicht für Zusagen. */
const EIGENTEXT = `(sel) => {
  const el = document.querySelector(sel);
  if (!el) { return '(kein Element)'; }
  return (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 300);
}`;

// ------------------------------------------------------------------------------------------------
// Der geteilte Aufbau. Was zwischen den Stationen weitergegeben wird, steht HIER und nirgends sonst.
// ------------------------------------------------------------------------------------------------

let adminPool: Pool | undefined;
let verbindung: Verbindung | undefined;
let verfuegbar = false;
let browser: BrowserMitVersion | undefined;
let flaeche = "nicht hergestellt";
let pool: Pool | undefined;
let port = 0;
let datenbankUrl = "";
let basis = "";
/** Jeder Serverprozess dieses Laufs — `afterAll` beendet sie ausnahmslos. */
const serverLaeufe: Serverlauf[] = [];
let server: Serverlauf | undefined;
const eigeneKontexte: Kontext[] = [];
let kontextAdmin: Kontext | undefined;
let kontextPruefer: Kontext | undefined;
const wegwerfDb = `klarwerk_demoweg_test_${`${Date.now()}`.slice(-9)}`;
let umgebungszeile = "";

/** Was die Stationen einander weitergeben. */
let adminId: string | undefined;
let prueferId: string | undefined;
let entwurfId: string | undefined;
let koId: string | undefined;
let titel: string | undefined;
let fassungVorBewertung: number | undefined;
let fassungVorFreigabe: number | undefined;
let abbildVorNeustart: string | undefined;
let pidErsterStart: number | undefined;

/** Die Befunde der Gegenproben; der Kalibrierungsfall am Ende macht den Lauf damit rot. */
const gegenproben: string[] = [];

/** Eine frische Seite DESSELBEN Profils — Begründung s. JOB 4324 (`useUnloadGuard`). */
async function frischeSeite(kontext: Kontext): Promise<SeiteMitDialogUndRoute> {
  return (await kontext.newPage()) as unknown as SeiteMitDialogUndRoute;
}

/** Eine Adresse anfahren und warten, bis die genannte Marke steht. */
async function gehe(
  s: SeiteMitDialogUndRoute,
  pfad: string,
  marke: string,
  was: string,
): Promise<void> {
  await s.goto(`${basis}${pfad}`, { waitUntil: "load", timeout: wartebudget("neuLadenAdresse") });
  await aufZustandWarten(s, SELEKTOR_DA, `${was} (${pfad})`, marke);
}

/** Die Sitzung des Admins am Draht — nur zum Nachsehen und Vorbereiten, nie als Abkürzung. */
function adminApi(): Sitzung {
  return new Sitzung(basis, "admin");
}

describe("JOB 4337 S · der erste Nutzerweg der Demo im Browser, gegen echtes PostgreSQL", () => {
  let adminSitzung: Sitzung | undefined;

  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      process.stderr.write(
        `${JOB} S UEBERSPRUNGEN: keine gesicherte KLARWERK_PG_TEST_URL — die Kette aus Browser, eigenem Serverprozess und echter PostgreSQL ist damit NICHT messbar (nicht etwa bestanden). Der Torlauf (./tools/check) hat bewusst keine Datenbank (vitest.config.ts:33).\n`,
      );
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(
        `${JOB} S UEBERSPRUNGEN: KLARWERK_PG_TEST_URL nennt keinen Rechnernamen — NICHT gemessen.\n`,
      );
      return;
    }
    await i18n.changeLanguage("de");
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${wegwerfDb}`);
    flaeche = stelleFlaecheBereit();
    browser = (await starteChromium()) as BrowserMitVersion;

    datenbankUrl = pgUrl(verbindung, wegwerfDb);
    port = await freierPort();
    // Der Prozess migriert die leere Datenbank selbst (`server.ts:26` → `migrate(pool)`) und macht
    // die Suchprojektion beim Bereitwerden betriebsbereit (`build-app.ts:2114`). Genau deshalb
    // wird hier NICHT von aussen migriert: der Start ist der Gegenstand, nicht ein Vorbau.
    server = starteServerprozess({ marke: "erster Start", port, datenbankUrl });
    serverLaeufe.push(server);
    basis = server.basis;
    pidErsterStart = server.pid;
    const gesundheit = await serverMussStehen(server, 300_000);

    pool = createPool(datenbankUrl);
    kontextAdmin = (await profil(browser, FENSTER)).kontext;
    kontextPruefer = (await profil(browser, FENSTER)).kontext;

    umgebungszeile = `Chromium ${browser.version()} · PostgreSQL „${await pgKurzversion(pool)}" · Serverprozess pid ${server.pid} auf Port ${port} (bereit nach ${gesundheit.wartezeitMs} ms) · Datei ${DATEI_NAME} · dist ${flaeche} · Gegenproben ${kalibrierungHerkunft()}`;
    process.stderr.write(`${JOB} BELEG · ${umgebungszeile}\n`);
    verfuegbar = true;
  }, 900_000);

  afterAll(async () => {
    for (const k of eigeneKontexte) {
      await k.close().catch(() => undefined);
    }
    await kontextPruefer?.close().catch(() => undefined);
    await kontextAdmin?.close().catch(() => undefined);
    await browser?.close();
    // ERST die Serverprozesse, DANN der eigene Pool, DANN der Nachweis, DANN der DROP: solange ein
    // Serverprozess lebt, hängt er mit seinem eigenen Pool an der Wegwerf-Datenbank.
    for (const lauf of serverLaeufe) {
      await lauf.beendeRegulaer(30_000);
      await lauf.abschiessen();
    }
    await pool?.end().catch(() => undefined);
    let rest: Verbindungszeile[] = [];
    if (adminPool) {
      const befund = await warteAufVerbindungsende(adminPool, wegwerfDb);
      rest = befund.rest;
      await adminPool
        .query(`DROP DATABASE IF EXISTS ${wegwerfDb} WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end();
    }
    expect(
      rest,
      `beim DROP DATABASE hingen noch Verbindungen an ${wegwerfDb} — genau auf sie schiesst WITH (FORCE):\n  ${alsBefund(rest)}`,
    ).toEqual([]);
  }, 180_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // S1 · ERSTEINRICHTUNG UND ZWEITES KONTO — und beide stehen in `users`.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // DIE ROLLE DER ZWEITEN PERSON IST `controller`, und sie ist abgeleitet statt geraten: bewerten
  // darf, wer `ko.validate` hat (`ko-routes.ts:2362`), und das haben `controller` und `admin`
  // (`services/rbac/src/policy.ts:33-41`). „Als wahr kennzeichnen" verlangt dagegen `users.manage`
  // (`ko-routes.ts:2385`) — das hat NUR der Admin. `controller` ist damit die einzige Rolle, die
  // fremdprüfen kann, ohne selbst freigeben zu können; erst dadurch sind S4 und S5 zwei
  // unterscheidbare Handlungen zweier Menschen und nicht zweimal derselbe Mensch. Die Prüffläche
  // selbst trägt dieselbe Schranke (`app/navigation.ts:264`, `minRole: "controller"`).
  it(
    "S1 — leere Instanz: der Betreiber richtet sich ein, legt die zweite Person an, und beide melden sich in EIGENEN Browserprofilen an",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      expect(
        await zeilenzahl(db, "users"),
        "die Instanz ist zu Beginn nicht leer — dann misst S1 nicht die Ersteinrichtung",
      ).toBe(0);

      adminSitzung = adminApi();
      const admin = await ersteinrichtungAmProzess(adminSitzung, ADMIN_MAIL, PASSWORT);
      adminId = admin.id;
      expect(admin.rolle, "der erste Anwender einer leeren Instanz ist nicht Administrator").toBe(
        "admin",
      );

      const angelegt = mussGelingen(
        `zweite Person anlegen (POST /api/users, Rolle ${PRUEFER_ROLLE})`,
        await gastAnlegen(adminSitzung, {
          name: "Prüfende Person",
          email: PRUEFER_MAIL,
          role: PRUEFER_ROLLE,
        }),
        201,
      );
      prueferId = String((angelegt.json as { id?: string }).id ?? "");
      expect(prueferId.length, "die zweite Person hat keine Kennung bekommen").toBeGreaterThan(0);

      // Die unabhängige Probe: nicht die Antwort von eben, sondern die Zeilen.
      expect(await zeilenzahl(db, "users"), "in `users` stehen nicht genau zwei Konten").toBe(2);
      const adminZeile = await kontozeile(db, ADMIN_MAIL);
      const prueferZeile = await kontozeile(db, PRUEFER_MAIL);
      expect(adminZeile.role, "die Rolle des Betreibers in `users`").toBe("admin");
      expect(adminZeile.approved, "der Betreiber ist nicht freigegeben").toBe(true);
      expect(prueferZeile.role, "die Rolle der zweiten Person in `users`").toBe(PRUEFER_ROLLE);
      expect(prueferZeile.approved, "die zweite Person ist nicht freigegeben").toBe(true);
      expect(adminZeile.id, "beide Konten tragen dieselbe Kennung").not.toBe(prueferZeile.id);
      expect(
        prueferZeile.id,
        "die Kennung der zweiten Person aus der Antwort und aus `users`",
      ).toBe(prueferId);

      // Und beide melden sich an IHRER Fläche an — zwei Profile, zwei Keksbeutel.
      const adminKontext = brauche(kontextAdmin, "das Browserprofil des Betreibers");
      const prueferKontext = brauche(kontextPruefer, "das Browserprofil der zweiten Person");
      expect(
        (await adminKontext.cookies()).filter((k) => k.name === "kw_session").length,
        "das Profil des Betreibers trägt schon vor der Anmeldung einen Sitzungskeks",
      ).toBe(0);
      const adminSeite = await frischeSeite(adminKontext);
      const prueferSeite = await frischeSeite(prueferKontext);
      try {
        await anmeldenAnDerMaske(adminSeite, basis, ADMIN_MAIL, PASSWORT);
        await anmeldenAnDerMaske(prueferSeite, basis, PRUEFER_MAIL, PASSWORT);
        expect(
          (await adminKontext.cookies()).some((k) => k.name === "kw_session"),
          "das Profil des Betreibers hat keinen eigenen Sitzungskeks bekommen",
        ).toBe(true);
        expect(
          (await prueferKontext.cookies()).some((k) => k.name === "kw_session"),
          "das Profil der zweiten Person hat keinen eigenen Sitzungskeks bekommen",
        ).toBe(true);
      } finally {
        await adminSeite.close({ runBeforeUnload: false }).catch(() => undefined);
        await prueferSeite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
      process.stderr.write(
        `${JOB} S1 GRÜN · Admin ${adminId} · zweite Person ${prueferId} (${PRUEFER_ROLLE})\n`,
      );
    },
    FALL_RAHMEN_MS * 2,
  );

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // S2 · IMPORT ÜBER DIE SICHTBARE DATEIAUSWAHL — und die Zeile in `drafts`.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it(
    "S2 — der Betreiber wählt eine echte .docx über den SICHTBAREN Dateiwähler und speichert den Entwurf: die Fläche quittiert es, und die Zeile steht in `drafts`",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const seite = await frischeSeite(brauche(kontextAdmin, "das Profil des Betreibers"));
      try {
        await gehe(seite, "/erfassen", BLATT, "das Blatt der Erfassung steht");
        await dateiwegOeffnen(seite);
        await ganzdokumentWaehlen(seite);
        // Der SICHTBARE Knopf `capture-file-pick` und das `filechooser`-Ereignis — kein
        // `setInputFiles` am versteckten Eingang (d3-buehne.ts:224-237).
        await dateiUeberSichtbareAuswahl(seite, await demoAnlage());
        await aufEingelesenWarten(seite, DATEI_NAME);
        await sichtbarZugesichert(
          seite,
          satz(CAPTURE_FILE_TEXT.wholeSourceNote, { name: DATEI_NAME }),
          "Einlese-Quittung mit Dateiname",
        );

        expect(await speichernDruecken(seite), "der Speichern-Knopf war nicht betätigbar").toBe(
          true,
        );
        await aufSichtbarkeitWarten(
          seite,
          flaechensatz(CAPTURE_FILE_TEXT.wholeSavedTitle),
          "Erfolgskasten des Ganzdokument-Wegs",
        );
        await sichtbarZugesichert(
          seite,
          satz(CAPTURE_FILE_TEXT.wholeSavedSource, { name: DATEI_NAME }),
          "Speicherquittung „Quelle: <Datei>, gesamtes Dokument.“",
        );

        const kennung = await kennungAusOeffnenLink(seite);
        if (kennung === null) {
          throw new Error(
            `${JOB} S2: nach dem Speichern steht kein Öffnen-Link mit Entwurfskennung auf der Fläche.`,
          );
        }

        // Die unabhängige Probe: nicht die Fläche, sondern die Zeile.
        expect(
          await entwurfszahl(db),
          "nach dem Import steht nicht genau EIN Entwurf in `drafts`",
        ).toBe(1);
        const zeile = await entwurfszeile(db, kennung);
        if (zeile === null) {
          throw new Error(`${JOB} S2: es gibt keine drafts-Zeile mit der Kennung ${kennung}.`);
        }
        expect(zeile, "der Beleg-Absatz der Prüfdatei steht nicht in der drafts-Zeile").toContain(
          DOKUMENTSATZ,
        );
        expect(zeile, "der erste Absatz der Prüfdatei steht nicht in der drafts-Zeile").toContain(
          ERSTER_SATZ,
        );
        expect(zeile, "die Herkunft (Dateiname) steht nicht in der drafts-Zeile").toContain(
          DATEI_NAME,
        );
        entwurfId = kennung;
        process.stderr.write(`${JOB} S2 GRÜN · Entwurf ${kennung} · drafts-Zeilen 1\n`);
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // S3 · EINREICHEN — aus dem Entwurf wird ein Wissensobjekt mit Belegstelle.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it(
    "S3 — der Betreiber reicht den Entwurf ein: es entsteht EIN Wissensobjekt zur Prüfung, mit Stufe, Fassung, Dokumentinhalt und Quellenzeile in `kos`",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const entwurf = brauche(entwurfId, "die Entwurfskennung aus S2");
      const sitzung = brauche(adminSitzung, "die API-Sitzung des Betreibers aus S1");
      const seite = await frischeSeite(brauche(kontextAdmin, "das Profil des Betreibers"));
      try {
        await gehe(
          seite,
          `/erfassen?draft=${encodeURIComponent(entwurf)}`,
          BLATT,
          "das Blatt mit dem fortgesetzten Entwurf steht",
        );
        await aufSichtbarkeitWarten(seite, DOKUMENTSATZ, "Dokumentinhalt im fortgesetzten Entwurf");
        const neueKennung = await einreichenUndKennung(seite);
        expect(
          neueKennung.length,
          "das Einreichen hat keinen Wissenseintrag gebracht",
        ).toBeGreaterThan(0);

        // ---- Die Datenbank, unabhängig gefragt --------------------------------------------------
        expect(await zeilenzahl(db, "kos"), "in `kos` steht nicht genau EIN Objekt").toBe(1);
        const zeile = await kozeile(db, neueKennung);
        expect(
          zeile.status,
          `das eingereichte Objekt steht auf „${zeile.status}" statt auf „offen" (zur Prüfung)`,
        ).toBe("offen");
        expect(
          zeile.data.status,
          "das Objekt selbst führt einen anderen Status als seine Spalte",
        ).toBe("offen");
        expect(
          zeile.data.confidentiality,
          "das eingereichte Objekt trägt nicht die gewählte Vertraulichkeitsstufe",
        ).toBe("intern");
        expect(
          typeof zeile.data.version,
          "das Objekt führt keine Fassungsnummer — dann ist jeder Fassungsbezug später unprüfbar",
        ).toBe("number");
        expect(
          JSON.stringify(zeile.data),
          "der Dokumentinhalt steht nicht am Wissensobjekt",
        ).toContain(DOKUMENTSATZ);

        // ---- DIE HERKUNFT, DIE DIESER WEG WIRKLICH TRÄGT ---------------------------------------
        // Sie steht als SATZ im Rumpf des Objekts, erzeugt vom echten Rumpfbauer
        // (`wholeDocumentBodyHtml`) — und nicht als Belegstelle; die Begründung dafür steht in S3b.
        expect(
          JSON.stringify(zeile.data),
          "die Quellenzeile des Ganzdokument-Wegs steht nicht am Wissensobjekt",
        ).toContain(persistierteQuellenzeile(DATEI_NAME));

        // ---- Die Voraussetzung jeder Aussage über die DOKUMENTSUCHE (JOB 3825) ------------------
        const antwort = await sitzung.sende("GET", `/api/kos/${neueKennung}`);
        expect(antwort.status, `GET /api/kos/${neueKennung}: ${antwort.text.slice(0, 300)}`).toBe(
          200,
        );
        const ko = antwort.json as {
          title?: string;
          statement?: string;
          category?: string;
          tags?: string[];
        };
        // Die Kernaussage muss dabei WIRKLICH etwas tragen: eine leere Kurzfassung erfüllte die
        // Isolation, ohne irgendetwas zu belegen (dieselbe Falle wie „0 Treffer heisst nicht leer").
        expect(
          String(ko.statement ?? "").length,
          "die Kernaussage des Objekts ist leer — dann ist die Isolation des Dokumentworts keine Aussage",
        ).toBeGreaterThan(100);
        expect(
          isolationsbefund(ko),
          `das Dokumentwort «${DOKUMENTWORT}» steht auch in Kurzfeldern des Objekts — ein Suchtreffer darauf wäre dann KEIN Beleg für den Dokumentinhalt (Titel «${ko.title}», Kernaussage «${ko.statement}»)`,
        ).toEqual([]);
        titel = String(ko.title ?? "");
        expect(
          titel.length,
          "das angelegte Objekt trägt keinen Titel — dann ist die Prüfkarte in S4 nicht zuzuordnen",
        ).toBeGreaterThan(0);
        koId = neueKennung;
        fassungVorBewertung = Number(zeile.data.version);
        process.stderr.write(
          `${JOB} S3 GRÜN · Wissensobjekt ${neueKennung} · Fassung ${fassungVorBewertung}\n`,
        );
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // S3b · WIE WEIT DIE HERKUNFT AUF DIESEM WEG REICHT — gemessen, nicht angenommen.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // DER AUFTRAG (§5.3) ERWARTETE EINE BELEGSTELLE IN `ko_evidence`. GEMESSEN (Cloud-Lauf
  // 83c02a941d51d570e3e5b78a, S3: „gelesen: []") ist sie leer. Das ist KEIN Produktfehler, sondern
  // der ausgeschriebene Vertrag des Hauses — und die Herkunft reist auf diesem Weg woanders:
  //
  //   · Der Weg „Ganzes Dokument übernehmen" legt die HERKUNFT als Satz in den Rumpf
  //     (`captureFromFile.ts:750`, `<blockquote><p>Quelle: …`) UND hängt die Originaldatei als
  //     Anhang mit ihrer Adresse an (`<div class="attachment"><a href="/api/objects/<id>/raw">`,
  //     gemessen im Rumpf des angelegten Objekts).
  //   · Es entsteht dabei aber keine `pendingSource` und damit kein `anchorDocument`
  //     (`Capture.tsx:1717-1734` verlangt beides), das Einreichen läuft deshalb über den Promote
  //     und nicht über `POST /api/kos/from-document` (`Capture.tsx:1863`).
  //   · Und der Promote erfindet dann ausdrücklich KEINE Belegstelle: „ein Entwurf OHNE
  //     Belegstellen bekommt keine erfundene Herkunft" (`tests/demo-erster-nutzerweg/
  //     promote-traegt-die-herkunft.test.ts:535`, H2) — sonst wäre „nie eine Quelle gehabt" nicht
  //     mehr von „Quelle verloren" zu unterscheiden.
  //
  // DIESER FALL HÄLT BEIDES FEST: die Grenze (keine Belegstelle, keine `sources`-Liste) UND den
  // Quellenwiederaufruf, der WIRKLICH trägt — die verlinkte Originaldatei kommt Byte für Byte
  // zurück. Er ist damit die ehrliche Fassung der Auftragszusage und keine Umdeutung: sichert der
  // Weg eines Tages zusätzlich eine Belegstelle, wird dieser Fall rot und ist NACHZUFÜHREN.
  it(
    "S3b — der Quellenwiederaufruf: der Rumpf verlinkt die Originaldatei, sie kommt Byte für Byte zurück — eine Belegstelle in `ko_evidence` entsteht auf diesem Weg NICHT, und es wird auch keine erfunden",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const objekt = brauche(koId, "die Objektkennung aus S3");
      const sitzung = brauche(adminSitzung, "die API-Sitzung des Betreibers aus S1");
      const belege = await belegzeilen(db, objekt);
      expect(
        belege,
        `\`ko_evidence\` trägt zu diesem Objekt Zeilen — dann bindet der Ganzdokument-Weg das Original inzwischen als Belegstelle, und dieser Fall ist NACHZUFÜHREN (sie gehört dann geprüft): ${JSON.stringify(belege)}`,
      ).toEqual([]);
      const antwort = await sitzung.sende("GET", `/api/kos/${objekt}`);
      expect(antwort.status, `GET /api/kos/${objekt}: ${antwort.text.slice(0, 300)}`).toBe(200);
      const ko = antwort.json as { sources?: unknown[]; bodyHtml?: string };
      expect(
        ko.sources ?? [],
        "das Objekt trägt eine Quellenliste, obwohl keine Belegstelle angelegt wurde — genau die erfundene Herkunft, die H2 ausschliesst",
      ).toEqual([]);
      const rumpf = ko.bodyHtml ?? "";
      expect(
        rumpf,
        "die Herkunft fehlt im Rumpf — dann trägt dieser Weg sie gar nicht mehr",
      ).toContain(persistierteQuellenzeile(DATEI_NAME));
      expect(rumpf, "der Rumpf nennt den Dateinamen der Quelle nicht").toContain(DATEI_NAME);

      // ---- UND DIE QUELLE LÄSST SICH WIRKLICH WIEDER AUFRUFEN --------------------------------
      // Nicht „ein Link steht da", sondern: er liefert DIE DATEI. Länge und SHA-256 gegen die
      // Bytes, die in S2 hineingegangen sind (Lehre JOB 3801 R2, Korrekturpflicht 2).
      const pfad = rohpfadAusRumpf(rumpf);
      if (pfad === null) {
        throw new Error(
          `${JOB} S3b: der Rumpf verlinkt keine Originaldatei (\`/api/objects/<id>/raw\`) — der Quellenwiederaufruf ist damit nicht möglich. Rumpf: ${rumpf.slice(0, 600)}`,
        );
      }
      const anlage = await demoAnlage();
      const roh = await holeRohbytes(basis, ADMIN_MAIL, PASSWORT, pfad);
      expect(roh.status, `${pfad} antwortet nicht mit 200`).toBe(200);
      expect(
        roh.laenge,
        `die zurückgelieferte Datei hat nicht die Länge der importierten (${anlage.buffer.length} Bytes)`,
      ).toBe(anlage.buffer.length);
      expect(
        roh.abdruck,
        `die zurückgelieferte Datei ist nicht Byte für Byte dieselbe wie die importierte (${roh.laenge} Bytes zurück, ${anlage.buffer.length} Bytes hinein)`,
      ).toBe(abdruck(anlage.buffer));
      process.stderr.write(
        `${JOB} S3b GRÜN · Quelle wieder aufrufbar (${pfad}, ${roh.laenge} Bytes, ${roh.typ || "ohne Typangabe"}) · ko_evidence 0 Zeilen (Vertrag H2)\n`,
      );
    },
    FALL_RAHMEN_MS,
  );

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // S4 · DIE FREMDPRÜFUNG — die zweite Person, in ihrer eigenen Sitzung.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it(
    "S4 — die zweite Person findet das Objekt auf „Prüfen“, gibt ihre Zustimmung und liest die Quittung: die Bewertung steht mit IHREM Namen und der gelesenen Fassung in `ratings`",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const objekt = brauche(koId, "die Objektkennung aus S3");
      const pruefer = brauche(prueferId, "die Kennung der zweiten Person aus S1");
      const seite = await frischeSeite(brauche(kontextPruefer, "das Profil der zweiten Person"));
      try {
        await gehe(seite, "/validierung", PRUEFKARTE, "die Prüffläche mit der Karte steht");
        // Die Prüfsperre der KI-Vorprüfung: solange sie läuft, ist die Karte reine ANZEIGE
        // (`lib/validationAiGate.ts:25-35`). Gewartet wird auf den ZUSTAND „betätigbar", nicht auf
        // eine Frist — ein Klick auf einen gesperrten Knopf täte nichts und bliebe unbemerkt.
        await aufZustandWarten(
          seite,
          KNOPF_BETAETIGBAR,
          "der Freigabeknopf der Prüfkarte ist betätigbar (die KI-Vorprüfung sperrt ihn nicht mehr)",
          FREIGEBEN_KNOPF,
          120_000,
        );
        // Die Karte muss DAS eingereichte Objekt sein und nicht irgendeine: gelesen wird ihr
        // gerenderter Text, verglichen wird mit dem Titel aus S3 (der aus dem Dateinamen entstand).
        const kartentext = await seite.evaluate<string>(fn(EIGENTEXT), PRUEFKARTE);
        expect(
          kartentext,
          `die Prüfkarte führt nicht das eingereichte Objekt «${brauche(titel, "der Titel aus S3")}» (gelesen: «${kartentext}»)`,
        ).toContain(brauche(titel, "der Titel aus S3"));

        const fassung = Number((await kozeile(db, objekt)).data.version ?? Number.NaN);
        expect(fassung, "die Fassung, die die Prüferin vor sich hat, ist nicht lesbar").toBe(
          brauche(fassungVorBewertung, "die Fassung aus S3"),
        );

        await seite.click(FREIGEBEN_KNOPF, { timeout: wartebudget("zeigerklick") });

        // Die sichtbare Quittung im Fussband — sie steht 3 000 ms (`Validation.tsx:191`), wird
        // deshalb sofort gelesen und sofort kalibriert.
        const quittung = `${satz("val.decisionSaved")} — ${satz("val.outcome.up")}`;
        await aufSichtbarkeitWarten(seite, quittung, "Quittung der Fremdprüfung");
        await sichtbarZugesichert(seite, quittung, "Quittung der Fremdprüfung");

        // ---- Die Datenbank: EINE Bewertung, mit DIESEM Akteur und DIESER Fassung ---------------
        await pruefeBewertung(db, {
          koId: objekt,
          akteur: pruefer,
          fassung,
          marke: "S4",
        });
        expect(
          await zeilenzahl(db, "ratings"),
          "in `ratings` steht nicht genau EINE Bewertung",
        ).toBe(1);
        // Und das Objekt ist damit NOCH NICHT freigegeben: eine Stimme von drei nötigen
        // (`FALLBACK_NEEDED_VALIDATIONS`) schliesst die Prüfung nicht ab. Genau deshalb hat S5
        // überhaupt etwas zu tun.
        const nachBewertung = await kozeile(db, objekt);
        expect(
          nachBewertung.status,
          "eine einzelne Fremdprüfung hat das Objekt bereits freigegeben — dann misst S5 nichts mehr",
        ).toBe("offen");
        fassungVorFreigabe = Number(nachBewertung.data.version);
        process.stderr.write(
          `${JOB} S4 GRÜN · Bewertung von ${pruefer} an Fassung ${fassung} · Status weiterhin „offen"\n`,
        );
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // S5 · DIE FREIGABE DURCH DEN ADMIN — „als wahr kennzeichnen", mit Rückfrage.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it(
    "S5 — der Betreiber kennzeichnet das geprüfte Objekt als wahr: die Fläche quittiert es, und `kos` führt es freigegeben, mit dem Admin als Akteur und der gelesenen Fassung",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const objekt = brauche(koId, "die Objektkennung aus S3");
      const admin = brauche(adminId, "die Kennung des Betreibers aus S1");
      const fassung = brauche(fassungVorFreigabe, "die Fassung nach der Fremdprüfung (S4)");
      const seite = await frischeSeite(brauche(kontextAdmin, "das Profil des Betreibers"));
      try {
        await gehe(seite, "/validierung", PRUEFKARTE, "die Prüffläche mit der Karte steht");
        await aufZustandWarten(
          seite,
          KNOPF_BETAETIGBAR,
          "die Karte ist bedienbar (die KI-Vorprüfung sperrt sie nicht)",
          FREIGEBEN_KNOPF,
          120_000,
        );
        // Der Weg des Admins: „···" → „Als wahr kennzeichnen" → Rückfrage → „Ja, validieren".
        await seite.click(KARTENMENUE, { timeout: wartebudget("zeigerklick") });
        await aufZustandWarten(
          seite,
          SELEKTOR_DA,
          "das Menüblatt der Prüfkarte steht offen",
          KARTENMENUE_BLATT,
        );
        expect(
          await klickKnopf(seite, satz("val.markTrue")),
          `der Menüeintrag «${satz("val.markTrue")}» war nicht betätigbar`,
        ).toBe(true);
        await aufSichtbarkeitWarten(
          seite,
          satz("val.markTrueConfirm"),
          "Rückfrage vor der Freigabe",
        );
        await sichtbarZugesichert(seite, satz("val.markTrueConfirm"), "Rückfrage vor der Freigabe");
        expect(
          await klickKnopf(seite, satz("val.markTrueYes")),
          `die Bestätigung «${satz("val.markTrueYes")}» war nicht betätigbar`,
        ).toBe(true);

        const quittung = satz("val.markTrueDone");
        await aufSichtbarkeitWarten(seite, quittung, "Quittung der Freigabe");
        await sichtbarZugesichert(seite, quittung, "Quittung der Freigabe");

        // ---- Die Datenbank: freigegeben, durch den Admin, an der gelesenen Fassung -------------
        await pruefeFreigabe(db, {
          koId: objekt,
          akteur: admin,
          fassung,
          trustMax: TRUST_MAX,
          marke: "S5",
        });
        process.stderr.write(
          `${JOB} S5 GRÜN · Freigabe durch ${admin} an Fassung ${fassung} · Vertrauen ${TRUST_MAX}\n`,
        );
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // S6 · DIE SUCHE — das Dokumentwort führt zum Objekt, mit Quelle und Freigabestatus.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it(
    "S6 — die Suche in der Bibliothek findet das freigegebene Objekt über ein Wort, das NUR im Dokument steht; Quelle und Freigabestatus sind sichtbar, und ein Wort, das nirgends steht, findet nichts",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const objekt = brauche(koId, "die Objektkennung aus S3");
      const seite = await frischeSeite(brauche(kontextAdmin, "das Profil des Betreibers"));
      try {
        await gehe(seite, "/bibliothek", '[data-testid="bib-liste"]', "die Bibliothek steht");
        await sucheUndPruefeTreffer(seite, {
          koId: objekt,
          statuswort: satz("status.validiert"),
          quellenzeile: persistierteQuellenzeile(DATEI_NAME),
          dokumentsatz: DOKUMENTSATZ,
          dateiname: DATEI_NAME,
          marke: "S6",
        });

        // ---- Die Gegenkontrolle: ein Wort, das NIRGENDS steht ----------------------------------
        // Ohne sie bewiese der Treffer nichts: eine Suche, die immer alles liefert, fände das
        // Objekt auch. Gemessen wird dabei die FORM (Liste steht, „Nichts gefunden" steht), nicht
        // bloss die Abwesenheit einer Zeile — eine Fehlerantwort sähe sonst aus wie „nichts da".
        const leer = await sucheEingeben(seite, FREMDWORT, { leer: true });
        expect(leer.da, "die Trefferliste steht bei der Gegenkontrolle gar nicht").toBe(true);
        expect(
          leer.zeilen,
          `die Suche nach «${FREMDWORT}» liefert Treffer, obwohl das Wort nirgends steht`,
        ).toEqual([]);
        expect(
          leer.leer,
          `die leere Suche sagt nicht «${satz("lib.liste.leerSuche")}» — eine schweigende Liste ist keine Auskunft`,
        ).toBe(true);
        process.stderr.write(`${JOB} S6 GRÜN · Treffer ${objekt} · Gegenkontrolle leer\n`);
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // S7 · PROZESSNEUSTART UND NEUE SITZUNG — echtes SIGTERM, neue Prozessnummer, leeres Profil.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it(
    "S7 — der Serverprozess wird beendet und NEU gestartet, ein frisches Browserprofil meldet sich neu an: dieselbe Suche findet dasselbe, Status und Quelle sind unverändert, und die Zeilen sind es auch",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const objekt = brauche(koId, "die Objektkennung aus S3");
      const alt = brauche(server, "der laufende Serverprozess");
      const abbildVorher = await bestandsabbild(db, objekt);
      abbildVorNeustart = abbildVorher;
      const auditVorher = await zeilenzahl(db, "audit");

      // ---- (a) Der Prozess geht REGULÄR — und er ist danach wirklich weg ----------------------
      const vonSelbst = await alt.beendeRegulaer(60_000);
      expect(
        vonSelbst,
        `der Serverprozess (pid ${alt.pid}) hat sich in 60 000 ms nicht von selbst beendet · Ausgabe:\n${alt.ausgabe().slice(-2000)}`,
      ).toBe(true);
      expect(alt.lebt(), `der Serverprozess (pid ${alt.pid}) läuft nach SIGTERM weiter`).toBe(
        false,
      );
      expect(
        await antwortetHealth(basis),
        `auf ${basis}/health antwortet nach dem Beenden weiter etwas — dann war der Neustart keiner`,
      ).toBe(false);

      // ---- (b) Ein NEUER Prozess, dieselbe Datenbank, derselbe Port ---------------------------
      const neuerLauf = starteServerprozess({ marke: "nach Neustart", port, datenbankUrl });
      serverLaeufe.push(neuerLauf);
      server = neuerLauf;
      expect(
        neuerLauf.pid,
        "der neue Serverprozess trägt dieselbe Prozessnummer wie der alte — dann ist es derselbe",
      ).not.toBe(alt.pid);
      expect(
        alt.pid,
        "der erste Start dieses Laufs ist nicht mehr derselbe Prozess wie im Aufbau",
      ).toBe(brauche(pidErsterStart, "die Prozessnummer des ersten Starts"));
      const gesundheit = await serverMussStehen(neuerLauf, 300_000);

      // ---- (c) Eine NEUE Sitzung: frisches Profil, echte Anmeldung ----------------------------
      const neu = await profil(brauche(browser, "der Browser"), FENSTER);
      eigeneKontexte.push(neu.kontext);
      expect(
        (await neu.kontext.cookies()).length,
        "das frische Profil bringt schon Kekse mit — dann ist es keine neue Sitzung",
      ).toBe(0);
      await anmeldenAnDerMaske(neu.seite, basis, ADMIN_MAIL, PASSWORT);
      const seite = neu.seite as unknown as SeiteMitDialogUndRoute;
      await gehe(
        seite,
        "/bibliothek",
        '[data-testid="bib-liste"]',
        "die Bibliothek der neuen Sitzung steht",
      );

      // ---- (d) DIESELBE Prüfung wie in S6 — Zeichen für Zeichen dieselbe Funktion -------------
      await sucheUndPruefeTreffer(seite, {
        koId: objekt,
        statuswort: satz("status.validiert"),
        quellenzeile: persistierteQuellenzeile(DATEI_NAME),
        dokumentsatz: DOKUMENTSATZ,
        dateiname: DATEI_NAME,
        marke: "S7 (nach Neustart)",
      });

      // ---- (e) Und die Zeilen sind dieselben --------------------------------------------------
      //
      // ZWEI PRÜFUNGEN NEBENEINANDER, weil sie zwei Fragen beantworten (Runde 2, BENs
      // Korrekturpflicht 1): das ABBILD sagt „irgendetwas hat sich geändert" und trägt seit dieser
      // Runde auch die LADUNG der Auditbelege; `pruefeAuditFassungen` sagt, WELCHER Beleg seinen
      // Fassungsbezug verloren hat — mit Nummer und Aktion. Ohne die zweite bliebe eine gelöschte
      // Ladung eine Meldung über zwei lange Zeichenketten; ohne die erste blieben Felder
      // ungeprüft, nach denen niemand namentlich fragt.
      await pruefeAuditFassungen(db, {
        koId: objekt,
        fassung: brauche(fassungVorFreigabe, "die Fassung nach der Fremdprüfung"),
        akteure: {
          "ko.rated": brauche(prueferId, "die Kennung der zweiten Person"),
          "ko.admin-validated": brauche(adminId, "die Kennung des Betreibers"),
        },
        marke: "S7 (nach Neustart)",
      });
      await pruefeBestandsumfang(db, "S7 (nach Neustart)");
      const abbildNachher = await bestandsabbild(db, objekt);
      expect(
        abbildNachher,
        "der Neustart hat den Bestand verändert (Zeilenzahlen, Objekt, Bewertung, Belege, Auditbelege dieses Objekts samt Ladung, oder Konten)",
      ).toBe(abbildVorher);
      // Die Auditkette ist APPEND-ONLY: sie darf wachsen (die neue Anmeldung schreibt ihren
      // eigenen Beleg), aber keine Zeile darf verschwinden. Die Zeilen DIESES Objekts stehen
      // vollständig im Abbild darüber und sind damit zeichengleich geprüft.
      const auditNachher = await zeilenzahl(db, "audit");
      expect(
        auditNachher,
        `die Auditkette ist kürzer als vor dem Neustart (${auditVorher} → ${auditNachher}) — sie ist append-only`,
      ).toBeGreaterThanOrEqual(auditVorher);
      process.stderr.write(
        `${JOB} S7 GRÜN · pid ${alt.pid} → ${neuerLauf.pid} (bereit nach ${gesundheit.wartezeitMs} ms) · Bestand unverändert (Auditladung inbegriffen) · Auditzeilen ${auditVorher} → ${auditNachher} (Zuwachs durch die neue Anmeldung)\n`,
      );
    },
    FALL_RAHMEN_MS * 4,
  );

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // K · DIE GEGENPROBEN — nur mit gesetztem Schalter, und dann ABSICHTLICH rot.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // Sie verstellen den GEGENSTAND und lassen die UNVERÄNDERTEN Zusicherungen des Normalwegs laufen —
  // jede Gegenprobe ruft GENAU die Prüfung, die eine Station fährt, und keine vorgeschaltete andere
  // (Runde 2, BENs Grundsatz). Jede Rücknahme wird nachgemessen: der Bestand ist danach
  // zeichengleich derselbe wie vorher, und der Normalweg ist wieder grün.
  it(
    "K — die Gegenproben: ohne Dokumentinhalt (K1), ohne Freigabe an Fläche (K2) und Bestand (K2b), mit vertauschtem Akteur (K3), mit ausgeblendeter Quelle (K4), mit einer Fremdzeile im Bestand (K5), mit geleerter Auditladung an Fassungsprüfung (K6) und Abbild (K6b)",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      if (!KALIBRIERUNG) {
        process.stderr.write(
          `${JOB} K OHNE SCHALTER: die Gegenproben sind AUS (${kalibrierungHerkunft()}). Sie sind ein eigener, absichtlich roter Lauf — im Regellauf bleibt deshalb kein roter Fall stehen. NICHT GELAUFEN heisst NICHT BESTANDEN.\n`,
        );
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const objekt = brauche(koId, "die Objektkennung aus S3");
      const admin = brauche(adminId, "die Kennung des Betreibers aus S1");
      const pruefer = brauche(prueferId, "die Kennung der zweiten Person aus S1");
      const fassung = brauche(fassungVorFreigabe, "die Fassung nach der Fremdprüfung");
      const abbildVorher = brauche(abbildVorNeustart, "das Bestandsabbild aus S7");
      const seite = await frischeSeite(brauche(kontextAdmin, "das Profil des Betreibers"));
      /** DIESELBEN Angaben wie in S6 und S7 — nur die Marke sagt, welche Gegenprobe gerade läuft. */
      const pruefungMit = (
        marke: string,
      ): {
        koId: string;
        statuswort: string;
        quellenzeile: string;
        dokumentsatz: string;
        dateiname: string;
        marke: string;
      } => ({
        koId: objekt,
        statuswort: satz("status.validiert"),
        quellenzeile: persistierteQuellenzeile(DATEI_NAME),
        dokumentsatz: DOKUMENTSATZ,
        dateiname: DATEI_NAME,
        marke,
      });
      const neuLaden = async (): Promise<void> => {
        await gehe(seite, "/bibliothek", '[data-testid="bib-liste"]', "die Bibliothek steht (K)");
      };
      try {
        await neuLaden();

        // ── K1 · OHNE DOKUMENTINHALT (D2-Prinzip) ───────────────────────────────────────────────
        // „Als wäre nie importiert worden": das Dokumentwort verschwindet aus der Suchprojektion,
        // aus der der gemeinsame Suchvertrag liest (`ko_search_projections`, `service.ts:1809`).
        // Bleibt S6 dann grün, kam der Treffer nicht aus dem Dokument.
        const projektion = async (): Promise<string> =>
          JSON.stringify(
            (
              await db.query<{ ko_version: number; search_text: string; body_text: string }>(
                "SELECT ko_version, search_text, body_text FROM ko_search_projections WHERE ko_id = $1 ORDER BY ko_version",
                [objekt],
              )
            ).rows,
          );
        const projektionVorher = await projektion();
        expect(
          projektionVorher,
          `das Objekt hat keine Suchprojektion mit dem Dokumentwort — dann misst K1 nichts (gelesen: ${projektionVorher.slice(0, 300)})`,
        ).toContain(DOKUMENTWORT);
        await gegenprobe(
          gegenproben,
          "K1 Dokumentinhalt aus der Suchprojektion entfernt (als wäre nie importiert worden)",
          async () => {
            await db.query(
              "UPDATE ko_search_projections SET search_text = replace(search_text, $2, 'ENTFERNT'), body_text = replace(body_text, $2, 'ENTFERNT') WHERE ko_id = $1",
              [objekt, DOKUMENTWORT],
            );
            await neuLaden();
          },
          async () => {
            await db.query(
              "UPDATE ko_search_projections SET search_text = replace(search_text, 'ENTFERNT', $2), body_text = replace(body_text, 'ENTFERNT', $2) WHERE ko_id = $1",
              [objekt, DOKUMENTWORT],
            );
            await neuLaden();
          },
          async () => {
            await sucheUndPruefeTreffer(seite, pruefungMit("K1"));
          },
        );

        expect(
          await projektion(),
          "K1: die Suchprojektion ist nach der Rücknahme nicht mehr zeichengleich die alte",
        ).toBe(projektionVorher);

        // ── K2 · FREIGABESTATUS ZURÜCKGESTELLT — ZUERST BIS AN DIE OBERFLÄCHE ──────────────────
        //
        // RUNDE 2, BENs KORREKTURPFLICHT 2: In Runde 1 rief diese Gegenprobe ZUERST `pruefeFreigabe`
        // (den Bestandsvergleich) und erst danach die Flächenprüfung. Der erwartete Fehler des
        // ersten Aufrufs verhinderte den zweiten — kalibriert war damit der PG-Vergleich, NICHT die
        // verlangte Wirkung an der Trefferzeile. BENs Grundsatz: „Jede Kalibrierung ruft die
        // unveränderte Stationsprüfung auf. Vorgeschaltete Fehler dürfen die zu kalibrierende
        // Prüfung nicht verhindern."
        //
        // ES SIND DESHALB ZWEI GEGENPROBEN AN DERSELBEN MUTATION: K2 fährt allein
        // `sucheUndPruefeTreffer` — die Stationsprüfung aus S6 und S7, Zeichen für Zeichen — und
        // muss am Freigabestatus der Trefferzeile scheitern. K2b fährt allein den Bestandsvergleich.
        const koVorher = await kozeile(db, objekt);
        const statusZurueckstellen = async (): Promise<void> => {
          await db.query(
            "UPDATE kos SET status = 'offen', data = jsonb_set(data, '{status}', '\"offen\"') WHERE id = $1",
            [objekt],
          );
          await neuLaden();
        };
        const statusWiederherstellen = async (): Promise<void> => {
          await db.query("UPDATE kos SET status = $2, data = $3 WHERE id = $1", [
            objekt,
            koVorher.status,
            JSON.stringify(koVorher.data),
          ]);
          await neuLaden();
        };
        await gegenprobe(
          gegenproben,
          "K2 Freigabestatus in `kos` auf «offen» zurückgestellt → die UNVERÄNDERTE Trefferprüfung aus S6/S7",
          statusZurueckstellen,
          statusWiederherstellen,
          async () => {
            await sucheUndPruefeTreffer(seite, pruefungMit("K2"));
          },
        );
        await gegenprobe(
          gegenproben,
          "K2b dieselbe Mutation → der UNVERÄNDERTE Bestandsvergleich der Freigabe",
          statusZurueckstellen,
          statusWiederherstellen,
          async () => {
            await pruefeFreigabe(db, {
              koId: objekt,
              akteur: admin,
              fassung,
              trustMax: TRUST_MAX,
              marke: "K2b",
            });
          },
        );

        // ── K3 · BEWERTUNGSAKTEUR VERTAUSCHT ───────────────────────────────────────────────────
        const bewertungVorher = await bewertungszeile(db, objekt);
        await gegenprobe(
          gegenproben,
          "K3 Akteur der Fremdprüfung in `ratings` auf den Admin vertauscht",
          async () => {
            await db.query(
              "UPDATE ratings SET user_id = $2, data = jsonb_set(data, '{userId}', to_jsonb($2::text)) WHERE ko_id = $1",
              [objekt, admin],
            );
          },
          async () => {
            await db.query("UPDATE ratings SET user_id = $2, data = $3 WHERE ko_id = $1", [
              objekt,
              bewertungVorher.user_id,
              JSON.stringify(bewertungVorher.data),
            ]);
          },
          async () => {
            await pruefeBewertung(db, {
              koId: objekt,
              akteur: pruefer,
              fassung: brauche(fassungVorBewertung, "die Fassung aus S3"),
              marke: "K3",
            });
          },
        );

        // ── K4 · QUELLENSATZ AUSGEBLENDET — ÜBER EINE REGEL, DIE DAS NEUZEICHNEN ÜBERSTEHT ─────
        //
        // RUNDE 2: bis hierher rief K4 nur die EINE Zusicherung (`sichtbarZugesichert`). Die
        // Stationsprüfung als Ganzes war nicht fahrbar, weil sie neu sucht und den Treffer neu
        // öffnet — ein am Knoten gesetzter Stilwert wäre dabei verschwunden. Die Dokumentregel
        // überlebt das Neuzeichnen (Begründung in `strecke.ts`, Abschnitt 5b), und damit fährt auch
        // K4 die unveränderte Prüfung aus S6/S7.
        // Der Träger der Quellenzeile auf der Lesefläche — der Quelle-Blockquote, den
        // `wholeDocumentBodyHtml` erzeugt. Der Dokumentsatz steht ausserhalb davon und bleibt
        // sichtbar; rot wird deshalb GENAU die Quellenanzeige und nicht der halbe Treffer.
        const QUELLTRAEGER = '[data-testid="bib-lesen"] blockquote p';
        // ERST DER VORZUSTAND, und er ist selbst ein Beleg: dieselbe Stationsprüfung OHNE Regel ist
        // grün. Sie öffnet dabei die Lesefläche — ohne sie gäbe es den Träger noch gar nicht, und
        // die Gegenprobe verstellte nichts (gemessen, Cloud-Lauf dc114df39aacdc8e15b771fc: „die
        // Regel … trifft auf dieser Seite kein Element"). Das ist KEINE vorgeschaltete Prüfung, die
        // den Fehler abfängt — sie muss grün sein, und sie läuft vor der Mutation.
        await sucheUndPruefeTreffer(seite, pruefungMit("K4 Vorzustand (ohne Regel)"));
        await gegenprobe(
          gegenproben,
          "K4 Quellenanzeige des Treffers per Regel `display:none` ausgeblendet → die UNVERÄNDERTE Trefferprüfung aus S6/S7",
          async () => {
            const getroffen = await ausblendregelSetzen(seite, QUELLTRAEGER, "display");
            expect(
              getroffen,
              `K4: die Regel «${QUELLTRAEGER}» trifft auf dieser Seite kein Element — dann verstellt die Gegenprobe nichts`,
            ).toBeGreaterThan(0);
          },
          async () => {
            await ausblendregelEntfernen(seite);
          },
          async () => {
            await sucheUndPruefeTreffer(seite, pruefungMit("K4"));
          },
        );

        // ── K5 · EINE ECHTE FREMDZEILE IM BESTAND ──────────────────────────────────────────────
        //
        // RUNDE 2, BENs KORREKTURPFLICHT 3: bis hierher verstellte K5 nur eine Sollzahl in der
        // Gegenprobe selbst und fasste die Datenbank nie an — kalibriert war damit die eigene
        // Erwartung, nicht die Zusicherung des Normalwegs. Jetzt kommt eine echte Zeile in `kos`,
        // und es läuft GENAU die Prüfung, die S7 fährt (`pruefeBestandsumfang`).
        const fremdeKennung = `k5-fremdzeile-${`${Date.now()}`.slice(-9)}`;
        await gegenprobe(
          gegenproben,
          "K5 eine zusätzliche Zeile in `kos` eingefügt → die UNVERÄNDERTE Umfangsprüfung aus S7",
          async () => {
            await db.query(
              "INSERT INTO kos (id, type, status, category, data) VALUES ($1, 'best_practice', 'offen', 'Allgemein', $2::jsonb)",
              [
                fremdeKennung,
                JSON.stringify({
                  id: fremdeKennung,
                  title: "K5 Fremdzeile (Gegenprobe, wird wieder entfernt)",
                  status: "offen",
                }),
              ],
            );
          },
          async () => {
            await db.query("DELETE FROM kos WHERE id = $1", [fremdeKennung]);
          },
          async () => {
            await pruefeBestandsumfang(db, "K5");
          },
        );
        // Die Rücknahme wird NACHGEMESSEN, nicht behauptet: dieselbe Prüfung, jetzt grün.
        await pruefeBestandsumfang(db, "K5 nach der Rücknahme");
        gegenproben.push(
          "K5 Rücknahme: die Fremdzeile ist entfernt, `pruefeBestandsumfang` ist wieder grün.",
        );

        // ── K6 · DIE LADUNG DER AUDITBELEGE — BENs EIGENE MUTATION, DAUERHAFT ──────────────────
        //
        // RUNDE 2, BENs KORREKTURPFLICHT 1 und seine Gegenprobe wörtlich:
        // `UPDATE audit SET payload = '{}'::jsonb WHERE target = $1`. In Runde 1 blieb das
        // Bestandsabbild dabei ZEICHENGLEICH — der Fassungsbezug jeder Entscheidung konnte
        // verschwinden, ohne dass der Neustartnachweis es sah. Beide Hälften werden jetzt einzeln
        // kalibriert: K6 die fachliche Prüfung (nennt Beleg und Aktion), K6b der Abbildvergleich.
        const belegeVorher = await auditzeilenZuObjekt(db, objekt);
        expect(
          belegeVorher.length,
          `K6: zu ${objekt} stehen keine Auditbelege — dann misst diese Gegenprobe nichts`,
        ).toBeGreaterThan(0);
        const ladungLoeschen = async (): Promise<void> => {
          await db.query("UPDATE audit SET payload = '{}'::jsonb WHERE target = $1", [objekt]);
        };
        const ladungZurueck = async (): Promise<void> => {
          for (const beleg of belegeVorher) {
            await db.query("UPDATE audit SET payload = $2::jsonb WHERE seq = $1", [
              beleg.seq,
              JSON.stringify(beleg.payload),
            ]);
          }
        };
        await gegenprobe(
          gegenproben,
          "K6 Ladung aller Auditbelege dieses Objekts geleert → die UNVERÄNDERTE Fassungsprüfung aus S7",
          ladungLoeschen,
          ladungZurueck,
          async () => {
            await pruefeAuditFassungen(db, {
              koId: objekt,
              fassung,
              akteure: { "ko.rated": pruefer, "ko.admin-validated": admin },
              marke: "K6",
            });
          },
        );
        await gegenprobe(
          gegenproben,
          "K6b dieselbe Mutation → der UNVERÄNDERTE Abbildvergleich aus S7 (in Runde 1 blieb er GRÜN)",
          ladungLoeschen,
          ladungZurueck,
          async () => {
            expect(
              await bestandsabbild(db, objekt),
              "der Bestand hat sich gegenüber S7 verändert (Auditladung)",
            ).toBe(abbildVorher);
          },
        );

        // ---- Die Rücknahmen werden nachgemessen, nicht behauptet ------------------------------
        // Erst die fachliche Prüfung, dann der Umfang, dann die Fläche, dann das ganze Abbild:
        // vier Zusicherungen des Normalwegs, jede unverändert.
        await pruefeAuditFassungen(db, {
          koId: objekt,
          fassung,
          akteure: { "ko.rated": pruefer, "ko.admin-validated": admin },
          marke: "K nach allen Rücknahmen",
        });
        await neuLaden();
        await sucheUndPruefeTreffer(seite, pruefungMit("K nach allen Rücknahmen"));
        const abbildNachher = await bestandsabbild(db, objekt);
        expect(
          abbildNachher,
          "nach den Gegenproben ist der Bestand nicht mehr derselbe — eine Rücknahme hat nicht getragen",
        ).toBe(abbildVorher);
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
      throw new Error(
        `${JOB} KALIBRIERUNG: dieser Fall ist ABSICHTLICH rot — er belegt, dass die Zusicherungen an ihrem Gegenstand hängen.\n${gegenproben.join("\n")}`,
      );
    },
    FALL_RAHMEN_MS * 4,
  );

  it("Z — die Laufumgebung dieses Nachweises, für die Rückgabe", (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    expect(umgebungszeile.length, "die Laufumgebung wurde nicht erhoben").toBeGreaterThan(0);
    expect(
      TABELLEN.length,
      "die Liste der geprüften Tabellen ist leer — dann misst keine Bestandsprobe etwas",
    ).toBe(6);
    process.stderr.write(`${JOB} Z · ${umgebungszeile}\n`);
  });
});

// ================================================================================================
// AUFNAHME erfassen-verwerfen · C — VOLLAUSFALL, VERWERFEN, SPEICHERN UND WIEDERÖFFNEN IM CHROMIUM.
// ================================================================================================
//
// DER REST AUS JOB 4231 (`archiv/4231/runde-2/ben.md:23`, `:28`): „den Moduswechsel über die echte
// Leiste und Wiederöffnen samt Originalquelle im Browser messen" — „NICHT GEPRÜFT: …
// Chromium-Dateiweg mit echter Persistenz und Wiederöffnen." JOB 4324 hat die Kette PostgreSQL →
// Socket → gebaute Fläche → Chromium aufgebaut und den IMPORT über den Speichern-Knopf der Karte
// (P1) wieder geöffnet (P3/P4). Was dort NICHT steht und hier steht:
//
//   C1  der VOLLSTÄNDIGE Übernahmefehler am Verlassen-Weg (der Server lehnt jede Anlage ab), die
//       bewahrte Eingabe nach „Hier bleiben" und danach das bewusste Verwerfen — ohne einen
//       Speichernachweis, weder auf der Fläche noch in `drafts`.
//   C2  der Entwurf, den der VERLASSEN-Weg gesichert hat (K2 aus P2 der Nachbarstrecke wurde nie
//       wieder geöffnet), in einer NEUEN Sitzung wieder geöffnet — samt Quellenzeile und der
//       Originaldatei, die aus dem Objektspeicher Byte für Byte wiederkommt (Vergleich mit der
//       hochgeladenen Datei; eine gleich lange Nullbyte-Antwort wird als Gegenprobe zurückgewiesen).
//   C3  N-0061 am echten Kopfband-Punkt „Erfassen": nach „Verwerfen und wechseln" steht der Editor
//       leer auf `/erfassen`, auch nach dem Neuladen; die Zeile ist unverändert.
//   C4  R-0075: ein ausdrücklich geleerter Text, gesichert, bleibt nach dem Neuladen geleert.
//
// JEDER MODUSWECHSEL GEHT ÜBER DAS MENÜ „Datei ▾" des Blatts — derselbe Griff wie
// `dateiwegOeffnen` (`ux19-buehne.ts`) und der Formularweg in P2 der Nachbarstrecke.
//
// DER FEHLER KOMMT AM NETZ, NICHT IM PRODUKT: eine Weiche vor `POST <basis>/api/drafts` antwortet 500
// im Fehlerschema von `services/app/src/http.ts` (dieselbe Bauform wie `entwurfsWeicheLegen` in
// `ux19-buehne.ts` und `leseweicheLegen` in `../import-wiederoeffnen-nutzerweg/strecke.ts`). Alles
// andere — auch das Hochladen des Originals — geht an die echte App.
//
// PRÜFGRENZE, LAUT GEMELDET: ohne gesicherte KLARWERK_PG_TEST_URL wird der Grund auf stderr
// geschrieben und übersprungen (Lehre 12.09., JOB 3668). Ausschliesslich eine Wegwerf-Datenbank mit
// `test` im Namen, entfernt erst NACH `warteAufVerbindungsende` (JOB 4265).
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  aufEingelesenWarten,
  dateiUeberSichtbareAuswahl,
  satz,
} from "../d3-dateien-durchgaengig/d3-buehne";
import { QUELLSATZ } from "../demo-erster-nutzerweg/strecke";
import { fn } from "../design/h3-blatt-buehne";
import type { Kontext, Seite } from "../gast-nutzerweg/browserweg";
import {
  mitFlaeche,
  profil,
  starteChromium,
  tippeMitTastatur,
  warte,
} from "../gast-nutzerweg/browserweg";
import {
  PASSWORT,
  type Sitzung,
  type Strecke,
  ersteinrichtung,
  starteStrecke,
} from "../gast-nutzerweg/strecke";
import {
  type Verbindungszeile,
  alsBefund,
  warteAufVerbindungsende,
} from "../gast-nutzerweg/verbindungsende";
import {
  type BrowserMitVersion,
  DATEI_NAME,
  SELEKTOR_DA,
  SICHTBARE_QUITTUNGEN,
  type SeiteMitDialogUndRoute,
  type Verbindung,
  aufSichtbarkeitWarten,
  aufZustandWarten,
  entwurfszahl,
  entwurfszeile,
  klickKnopf,
  nichtSichtbarZugesichert,
  persistierteQuellenzeile,
  pgUrl,
  pgVersion,
  quellAnlage,
  sichtbarZugesichert,
  stelleFlaecheBereit,
  zerlege,
} from "../import-wiederoeffnen-nutzerweg/strecke";
import {
  FALL_RAHMEN_MS,
  type Weiche,
  dateiwegOeffnen,
  ganzdokumentWaehlen,
  wartebudget,
} from "../ux19-speichern-oeffnen-reload/ux19-buehne";

const KENNUNG = "[KLARWERK] erfassen-verwerfen C";
const KONTO = "erfassen-verwerfen@aufnahme.test";
const FENSTER = { width: 1280, height: 800 };

const VERLASSEN_KNOPF = '[data-testid="capture-entwurf-verlassen"]';
const BLATT = '[data-testid="blatt"]';
const BLATT_TITEL = '[data-testid="blatt-titel"]';
const BLATT_EDITOR = '[data-testid="blatt-text"] [contenteditable="true"]';
const BLATT_SICHERN = '[data-testid="blatt-entwurf-sichern"]';
/** Der Punkt „Erfassen" im Kopfband (`shell/KopfbandPunkte.tsx`, `data-kopfband-punkt={item.id}`). */
const KOPFBAND_ERFASSEN = '[data-kopfband-punkt="erfassen"]';
const TITELMARKE = '[data-kwev="expertentitel"]';

/** Der Grund, den die gestellte 500-Antwort mitschickt — er MUSS beim Menschen ankommen. */
const ANLAGE_FEHLERCODE = "ERFASSEN_VERWERFEN_TESTFEHLER";
const ANLAGE_FEHLERSATZ =
  "Der Entwurf konnte nicht angelegt werden (gestellter Serverfehler erfassen-verwerfen).";

/** Der Wert des Blatt-Titels. */
const TITEL_WERT = `() => {
  const el = document.querySelector('[data-testid="blatt-titel"]');
  return el && 'value' in el ? String(el.value) : '(kein Titelfeld)';
}`;

/** Der SICHTBARE Text der Schreibfläche — `innerText`, nicht `textContent` (REGELN.md 9). */
const EDITOR_TEXT = `() => {
  const el = document.querySelector('[data-testid="blatt-text"] [contenteditable="true"]');
  return el ? (el.innerText || '').replace(/\\s+/g, ' ').trim() : '(keine Schreibfläche)';
}`;

/** Ist die Schreibfläche leer? */
const EDITOR_LEER = `() => {
  const el = document.querySelector('[data-testid="blatt-text"] [contenteditable="true"]');
  return !!el && (el.innerText || '').replace(/\\s+/g, ' ').trim() === '';
}`;

/** Pfad und Abfrageteil der Seite — getrennt. */
const ORT = "() => ({ pfad: location.pathname, abfrage: location.search })";

/**
 * Markiert das Titelfeld des Expertenformulars an seiner Beschriftung (Begründung: dieselbe Technik
 * wie `TITELFELD_MARKIEREN` in der Nachbarstrecke — das Feld trägt keine `data-testid`).
 */
const TITELFELD_MARKIEREN = `(beschriftung) => {
  const labels = document.querySelectorAll('label');
  for (let i = 0; i < labels.length; i += 1) {
    const span = labels[i].querySelector(':scope > span');
    if (!span || (span.textContent || '').replace(/\\s+/g, ' ').trim() !== beschriftung) { continue; }
    const feld = labels[i].querySelector('input');
    if (!feld) { continue; }
    feld.setAttribute('data-kwev', 'expertentitel');
    return true;
  }
  return false;
}`;

/**
 * Die Verweise auf Originaldateien im Objektspeicher (`lib/bodyFileLink.ts`, `objectRawHref`):
 * Adresse, Beschriftung und ob der Verweis für einen Menschen sichtbar ist.
 */
const ORIGINAL_VERWEISE = `() => {
  const aus = [];
  const alle = document.querySelectorAll('a[href^="/api/objects/"]');
  for (let i = 0; i < alle.length; i += 1) {
    const a = alle[i];
    let sichtbar = true;
    for (let e = a; e && e.nodeType === 1; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || Number.parseFloat(s.opacity || '1') === 0) { sichtbar = false; break; }
    }
    const r = a.getBoundingClientRect();
    aus.push({
      href: a.getAttribute('href') || '',
      text: (a.innerText || a.getAttribute('title') || '').replace(/\\s+/g, ' ').trim(),
      sichtbar: sichtbar && r.width > 0 && r.height > 0,
    });
  }
  return aus;
}`;

/**
 * Holt eine Adresse MIT der Sitzung dieser Seite und gibt Status und den GANZEN Inhalt zurück — als
 * Zahlenfeld, damit er unverfälscht aus dem Browser kommt. Runde 2 (BENs Befund): bis hierher kamen
 * nur Status und Bytezahl zurück, und 936 Nullbytes bestanden dieselbe Prüfung.
 */
const HOLE_BYTES = `(href) => fetch(href, { credentials: 'include' }).then((r) =>
  r.arrayBuffer().then((b) => ({ status: r.status, bytes: Array.from(new Uint8Array(b)) })))`;

type Abruf = { status: number; bytes: number[] };

const sha256 = (daten: Buffer): string => createHash("sha256").update(daten).digest("hex");

/**
 * DER VERGLEICH MIT DEM HOCHGELADENEN ORIGINAL — Byte für Byte, nicht über die Länge. Gibt `null`
 * zurück, wenn der Abruf genau die hochgeladene Datei ist, sonst den Befund. Dieselbe Funktion
 * prüft den echten Abruf UND die Gegenprobe; eine zweite, mildere Fassung gibt es nicht.
 */
function abweichungVomOriginal(abruf: Abruf): string | null {
  const erwartet = quellAnlage().buffer;
  const bekommen = Buffer.from(abruf.bytes);
  if (abruf.status !== 200) {
    return `Status ${abruf.status} statt 200`;
  }
  if (bekommen.equals(erwartet)) {
    return null;
  }
  const erste = [...erwartet].findIndex((b, i) => bekommen[i] !== b);
  return `Inhalt weicht ab: ${bekommen.length} statt ${erwartet.length} Bytes, erste Abweichung bei Byte ${erste}, SHA-256 ${sha256(bekommen)} statt ${sha256(erwartet)}`;
}

let adminPool: Pool | undefined;
let verbindung: Verbindung | undefined;
let verfuegbar = false;
let browser: BrowserMitVersion | undefined;
let pool: Pool | undefined;
let strecke: Strecke | undefined;
let adminApi: Sitzung | undefined;
let kontextA: Kontext | undefined;
const eigeneKontexte: Kontext[] = [];
const wegwerfDb = `klarwerk_erfverw_test_${`${Date.now()}`.slice(-9)}`;

/** Die Kennung des Entwurfs, den C2 über den Verlassen-Weg sichert — C3 und C4 bauen darauf. */
let k2: string | undefined;

function brauche<T>(wert: T | undefined, was: string): T {
  if (wert === undefined) {
    throw new Error(
      `${KENNUNG}: ${was} fehlt — der Fall, der es erarbeitet, ist nicht bis dahin gekommen. Dieser Fall ist damit NICHT gemessen (und nicht etwa bestanden).`,
    );
  }
  return wert;
}

/** Anmeldung über die ECHTE Maske, mit der Tastatur (dieselbe Form wie die Nachbarstrecke). */
async function anmelden(roh: Seite): Promise<void> {
  const basis = brauche(strecke, "die Messstrecke").basis;
  await roh.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(roh, `() => !!document.querySelector("#auth-email")`, "die Anmeldemaske steht");
  await tippeMitTastatur(roh, "#auth-email", KONTO, "E-Mail");
  await tippeMitTastatur(roh, "#auth-password", PASSWORT, "Passwort");
  await roh.keyboard.press("Enter");
  await warte(roh, `() => !document.querySelector("#auth-email")`, "die Anmeldung trägt");
}

async function gehe(s: SeiteMitDialogUndRoute, pfad: string): Promise<void> {
  const basis = brauche(strecke, "die Messstrecke").basis;
  await s.goto(`${basis}${pfad}`, { waitUntil: "load", timeout: wartebudget("neuLadenAdresse") });
  await aufZustandWarten(s, SELEKTOR_DA, `das Blatt steht nach dem Laden von ${pfad}`, BLATT);
}

async function frischeSeite(kontext: Kontext): Promise<SeiteMitDialogUndRoute> {
  return (await kontext.newPage()) as unknown as SeiteMitDialogUndRoute;
}

/** Ein Ausgangsentwurf über die echte Route — die Nutzlast, die `saveDraft` ohne Eingabe schreibt. */
async function entwurfAnlegen(titel: string): Promise<string> {
  const api = brauche(adminApi, "die API-Sitzung des Betreibers");
  const antwort = await api.sende("POST", "/api/drafts", {
    title: titel,
    statement: "",
    origin: "expert",
  });
  expect([200, 201], `${titel} anlegen: ${antwort.status} ${antwort.text.slice(0, 400)}`).toContain(
    antwort.status,
  );
  return (antwort.json as { id: string }).id;
}

/**
 * Der Weg bis zur geladenen Datei am GEÖFFNETEN Entwurf — jeder Moduswechsel über „Datei ▾":
 * Entwurf öffnen → Formular → Titel leeren (ab hier trägt allein der Dateizweig) → „Datei
 * importieren" → „Ganzes Dokument" → reale DOCX über den sichtbaren Dateiwähler.
 */
async function bisZurGeladenenDatei(s: SeiteMitDialogUndRoute, entwurfId: string): Promise<void> {
  await gehe(s, `/erfassen?draft=${encodeURIComponent(entwurfId)}`);
  expect(
    await klickKnopf(s, satz("erfassen.werkzeug.datei")),
    "das Menü „Datei ▾“ war nicht betätigbar",
  ).toBe(true);
  await aufSichtbarkeitWarten(s, satz("erfassen.weg.formular"), "Menüeintrag Formular");
  expect(await klickKnopf(s, satz("erfassen.weg.formular"))).toBe(true);
  await aufZustandWarten(
    s,
    SELEKTOR_DA,
    "der Verlassen-Knopf des geöffneten Entwurfs steht (der Entwurf ist im Formular offen)",
    VERLASSEN_KNOPF,
  );
  expect(
    await s.evaluate<boolean>(fn(TITELFELD_MARKIEREN), satz("capture.wizard.titleLabel")),
    "das Titelfeld des Expertenformulars war nicht auffindbar",
  ).toBe(true);
  await s.fill(TITELMARKE, "");

  await dateiwegOeffnen(s);
  await ganzdokumentWaehlen(s);
  await dateiUeberSichtbareAuswahl(s, quellAnlage());
  await aufEingelesenWarten(s, DATEI_NAME);
  await aufZustandWarten(
    s,
    SELEKTOR_DA,
    "der Verlassen-Knopf steht auch im Dateiweg",
    VERLASSEN_KNOPF,
  );
}

/** Legt die Weiche vor `POST <basis>/api/drafts`; `aktiv` schaltet den 500er. */
async function anlageweicheLegen(
  s: SeiteMitDialogUndRoute,
): Promise<{ aktiv: boolean; angekommen: number }> {
  const basis = brauche(strecke, "die Messstrecke").basis;
  const zustand = { aktiv: true, angekommen: 0 };
  await s.route(`${basis}/api/drafts`, async (route) => {
    const r = route as unknown as Weiche;
    if (r.request().method() !== "POST") {
      await r.fallback();
      return;
    }
    zustand.angekommen += 1;
    if (!zustand.aktiv) {
      await r.fallback();
      return;
    }
    await r.fulfill({
      status: 500,
      body: JSON.stringify({ error: ANLAGE_FEHLERCODE, message: ANLAGE_FEHLERSATZ }),
      headers: { "content-type": "application/json" },
    });
  });
  return zustand;
}

async function quittungen(s: SeiteMitDialogUndRoute): Promise<string> {
  return (await s.evaluate<string[]>(fn(SICHTBARE_QUITTUNGEN))).join(" | ");
}

describe("Aufnahme erfassen-verwerfen C · Vollausfall, Verwerfen, Wiederöffnen — Chromium gegen echtes PostgreSQL", () => {
  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      process.stderr.write(
        `${KENNUNG} UEBERSPRUNGEN: keine gesicherte KLARWERK_PG_TEST_URL — Browser, echter Socket und echte PostgreSQL sind damit nicht messbar.\n`,
      );
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(
        `${KENNUNG} UEBERSPRUNGEN: KLARWERK_PG_TEST_URL nennt keinen Rechnernamen.\n`,
      );
      return;
    }
    await i18n.changeLanguage("de");
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${wegwerfDb}`);
    const flaeche = stelleFlaecheBereit();
    browser = (await starteChromium()) as BrowserMitVersion;
    pool = createPool(pgUrl(verbindung, wegwerfDb));
    await migrate(pool);
    strecke = await starteStrecke({ pool, ...mitFlaeche() });
    adminApi = (await ersteinrichtung(strecke, KONTO)).sitzung;
    const p = await profil(browser, FENSTER);
    kontextA = p.kontext;
    await anmelden(p.seite);
    await (p.seite as unknown as SeiteMitDialogUndRoute).close({ runBeforeUnload: false });
    process.stderr.write(
      `${KENNUNG} BELEG · Chromium ${browser.version()} · Socket-Port ${new URL(strecke.basis).port} · PostgreSQL „${await pgVersion(pool)}" · Datei ${DATEI_NAME} · dist ${flaeche}\n`,
    );
    verfuegbar = true;
  }, 900_000);

  afterAll(async () => {
    for (const k of eigeneKontexte) {
      await k.close().catch(() => undefined);
    }
    await kontextA?.close().catch(() => undefined);
    await browser?.close();
    await strecke?.schliessen().catch(() => undefined);
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
      `beim DROP DATABASE hingen noch Verbindungen an ${wegwerfDb}:\n  ${alsBefund(rest)}`,
    ).toEqual([]);
  }, 120_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // C1 · VOLLSTÄNDIGER ÜBERNAHMEFEHLER — DIE EINGABE BLEIBT, BIS DER MENSCH ENTSCHEIDET.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it(
    "C1 — der Server lehnt die Anlage ab: Dialog bleibt mit Grund, „Hier bleiben“ bewahrt die Datei, „Verwerfen und wechseln“ quittiert „verworfen“ ohne jede neue Zeile",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const e1 = await entwurfAnlegen("Entwurf C1");
      const zeileE1 = await entwurfszeile(db, e1);
      const zeilenVorher = await entwurfszahl(db);
      const seite = await frischeSeite(brauche(kontextA, "die Sitzung aus dem Aufbau"));
      try {
        await bisZurGeladenenDatei(seite, e1);
        const weiche = await anlageweicheLegen(seite);

        await seite.click(VERLASSEN_KNOPF, { timeout: wartebudget("zeigerklick") });
        await aufSichtbarkeitWarten(seite, satz("nav.guard.stay"), "Dialog der Wache");
        expect(
          await klickKnopf(seite, satz("nav.guard.save")),
          "„Entwurf speichern und wechseln“ war nicht betätigbar",
        ).toBe(true);

        // Der Grund steht SICHTBAR da — der Satz, den der Server geschickt hat.
        await aufSichtbarkeitWarten(seite, ANLAGE_FEHLERSATZ, "Grund des Übernahmefehlers");
        await sichtbarZugesichert(seite, ANLAGE_FEHLERSATZ, "Grund des Übernahmefehlers im Dialog");
        expect(weiche.angekommen, "der Anlage-Aufruf war gar nicht unterwegs").toBeGreaterThan(0);
        expect((await seite.evaluate<{ pfad: string }>(fn(ORT))).pfad).toBe("/erfassen");
        const nachFehler = await quittungen(seite);
        expect(nachFehler, "ein Vollausfall meldet „gesichert“").not.toContain(
          satz("capture.leaveDraft.doneSaved"),
        );
        expect(await entwurfszahl(db), "der Vollausfall hat eine Zeile angelegt").toBe(
          zeilenVorher,
        );
        expect(await entwurfszeile(db, e1)).toBe(zeileE1);

        // ── „Hier bleiben": die geladene Datei steht weiter da. ──────────────────────────────
        expect(await klickKnopf(seite, satz("nav.guard.stay"))).toBe(true);
        await sichtbarZugesichert(
          seite,
          satz(CAPTURE_FILE_TEXT.wholeSourceNote, { name: DATEI_NAME }),
          "Einlese-Quittung nach „Hier bleiben“ (die Eingabe ist bewahrt)",
        );

        // ── Die bewusste Entscheidung: verwerfen. ────────────────────────────────────────────
        const vorVerwerfen = weiche.angekommen;
        await seite.click(VERLASSEN_KNOPF, { timeout: wartebudget("zeigerklick") });
        await aufSichtbarkeitWarten(seite, satz("nav.guard.discard"), "Dialog der Wache (2)");
        expect(await klickKnopf(seite, satz("nav.guard.discard"))).toBe(true);

        const verworfen = satz("capture.leaveDraft.done");
        await aufSichtbarkeitWarten(seite, verworfen, "Quittung „verworfen“");
        await sichtbarZugesichert(seite, verworfen, "Quittung „verworfen“");
        expect(
          await quittungen(seite),
          "nach dem Verwerfen steht ein Speichernachweis",
        ).not.toContain(satz("capture.leaveDraft.doneSaved"));
        expect((await seite.evaluate<{ pfad: string }>(fn(ORT))).pfad).toBe("/start");
        expect(weiche.angekommen, "das Verwerfen hat einen Anlageversuch ausgelöst").toBe(
          vorVerwerfen,
        );
        expect(await entwurfszahl(db), "nach dem Verwerfen liegt eine neue Zeile in `drafts`").toBe(
          zeilenVorher,
        );
        expect(await entwurfszeile(db, e1), "der gespeicherte Entwurf wurde verändert").toBe(
          zeileE1,
        );
        process.stderr.write(`${KENNUNG} C1 GRÜN · E1 ${e1} · drafts-Zeilen ${zeilenVorher}\n`);
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // C2 · GESICHERT ÜBER DEN VERLASSEN-WEG — UND IN EINER NEUEN SITZUNG SAMT ORIGINAL WIEDER DA.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it(
    "C2 — „Entwurf speichern und wechseln“ sichert die Datei als neuen Entwurf; in einer neuen Sitzung stehen Inhalt, Quellenzeile und die Originaldatei (Byte für Byte) wieder da",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const e2 = await entwurfAnlegen("Entwurf C2");
      const zeileE2 = await entwurfszeile(db, e2);
      const vorher = new Set(
        (await db.query<{ id: string }>("SELECT id FROM drafts")).rows.map((z) => z.id),
      );
      const seite = await frischeSeite(brauche(kontextA, "die Sitzung aus dem Aufbau"));
      try {
        await bisZurGeladenenDatei(seite, e2);
        await seite.click(VERLASSEN_KNOPF, { timeout: wartebudget("zeigerklick") });
        await aufSichtbarkeitWarten(seite, satz("nav.guard.save"), "Dialog der Wache");
        expect(await klickKnopf(seite, satz("nav.guard.save"))).toBe(true);
        const gespeichert = satz("capture.leaveDraft.doneSaved");
        await aufSichtbarkeitWarten(seite, gespeichert, "Quittung „gesichert“");
        expect(await quittungen(seite)).not.toContain(satz("capture.leaveDraft.done"));
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }

      const neu = (await db.query<{ id: string }>("SELECT id FROM drafts")).rows
        .map((z) => z.id)
        .filter((id) => !vorher.has(id));
      expect(neu, "der Verlassen-Weg hat nicht genau EINEN neuen Entwurf angelegt").toHaveLength(1);
      const kennung = neu[0] as string;
      const zeile = (await entwurfszeile(db, kennung)) ?? "";
      expect(zeile).toContain(QUELLSATZ);
      expect(zeile).toContain(DATEI_NAME);
      expect(await entwurfszeile(db, e2), "E2 wurde beim Verlassen verändert").toBe(zeileE2);

      // ── Wiederöffnen in einer NEUEN Sitzung: leeres Profil, echte Anmeldung. ────────────────
      const frisch = await profil(brauche(browser, "der Browser"), FENSTER);
      eigeneKontexte.push(frisch.kontext);
      expect((await frisch.kontext.cookies()).length, "das frische Profil bringt Kekse mit").toBe(
        0,
      );
      await anmelden(frisch.seite);
      const s = frisch.seite as unknown as SeiteMitDialogUndRoute;
      await gehe(s, `/erfassen?draft=${encodeURIComponent(kennung)}`);
      await aufSichtbarkeitWarten(s, QUELLSATZ, "Inhalt des wieder geöffneten Entwurfs");
      await sichtbarZugesichert(s, QUELLSATZ, "Inhalt aus sample.docx in der neuen Sitzung");
      await sichtbarZugesichert(
        s,
        persistierteQuellenzeile(DATEI_NAME),
        "Quellenzeile (Herkunft) in der neuen Sitzung",
      );

      // Die ORIGINALQUELLE: ein sichtbarer Verweis auf das Original im Objektspeicher, und hinter
      // ihm liegt genau die hochgeladene Datei.
      const verweise = await s.evaluate<{ href: string; text: string; sichtbar: boolean }[]>(
        fn(ORIGINAL_VERWEISE),
      );
      const original = verweise.find((v) => v.sichtbar && v.href.endsWith("/raw"));
      expect(
        original,
        `kein sichtbarer Verweis auf die Originaldatei — gefunden: ${JSON.stringify(verweise)}`,
      ).toBeDefined();
      const href = (original as { href: string }).href;
      const abruf = await s.evaluate<Abruf>(fn(HOLE_BYTES), href);
      expect(
        abweichungVomOriginal(abruf),
        "die Originaldatei kommt nicht Byte für Byte als die hochgeladene sample.docx zurück",
      ).toBeNull();

      // GEGENPROBE (Runde 2, BENs Befund): DIESELBE Adresse liefert per Weiche eine gleich lange,
      // falsche Antwort (lauter Nullbytes). Der unveränderte Vergleich MUSS sie zurückweisen —
      // sonst misst er die Länge und nicht den Inhalt. Die Weiche wird in `finally` abgeräumt.
      const basis = brauche(strecke, "die Messstrecke").basis;
      const falsch = Buffer.alloc(quellAnlage().buffer.length);
      await s.route(`${basis}${href}`, async (route) => {
        await (route as unknown as Weiche).fulfill({
          status: 200,
          body: falsch as unknown as string,
          headers: { "content-type": "application/octet-stream" },
        });
      });
      let gegenprobe: Abruf;
      try {
        gegenprobe = await s.evaluate<Abruf>(fn(HOLE_BYTES), href);
      } finally {
        await s.unroute(`${basis}${href}`);
      }
      expect(gegenprobe.bytes.length, "die Gegenprobe war nicht gleich lang").toBe(falsch.length);
      const befundGegenprobe = abweichungVomOriginal(gegenprobe);
      expect(
        befundGegenprobe,
        "der Vergleich hat 936 Nullbytes als Original angenommen — er misst den Inhalt nicht",
      ).not.toBeNull();

      k2 = kennung;
      process.stderr.write(
        `${KENNUNG} C2 GRÜN · K2 ${kennung} · Original ${href} ${abruf.bytes.length} Bytes, SHA-256 ${sha256(Buffer.from(abruf.bytes))} = hochgeladen · Gegenprobe Nullbytes zurückgewiesen: ${befundGegenprobe}\n`,
      );
    },
    FALL_RAHMEN_MS * 4,
  );

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // C3 · N-0061 — „ERFASSEN" IM KOPFBAND, VERWERFEN: DER EDITOR IST WIRKLICH LEER.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it(
    "C3 — N-0061: am geöffneten Entwurf den Titel ändern, „Erfassen“ im Kopfband, „Verwerfen und wechseln“: der Editor ist leer, auch nach dem Neuladen, und die Zeile ist unverändert",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const kennung = brauche(k2, "die Kennung K2 aus C2");
      const zeileVorher = await entwurfszeile(db, kennung);
      const marke = "MARKE-N0061-verworfen";
      const seite = await frischeSeite(brauche(kontextA, "die Sitzung aus dem Aufbau"));
      try {
        await gehe(seite, `/erfassen?draft=${encodeURIComponent(kennung)}`);
        await aufSichtbarkeitWarten(seite, QUELLSATZ, "Inhalt des geöffneten Entwurfs");
        await seite.click(BLATT_TITEL, { timeout: wartebudget("zeigerklick") });
        await seite.keyboard.press("End");
        // `Tastatur` der Bühne deklariert nur `press`; die Seite ist dieselbe Playwright-Seite.
        await (seite as unknown as Seite).keyboard.type(` ${marke}`);
        await aufZustandWarten(
          seite,
          `(m) => { const el = document.querySelector('[data-testid="blatt-titel"]'); return !!el && String(el.value).includes(m); }`,
          "die Marke steht im Titel",
          marke,
        );

        await seite.click(KOPFBAND_ERFASSEN, { timeout: wartebudget("zeigerklick") });
        await aufSichtbarkeitWarten(seite, satz("nav.guard.discard"), "Dialog der Wache");
        expect(await klickKnopf(seite, satz("nav.guard.discard"))).toBe(true);

        await aufZustandWarten(
          seite,
          `() => location.pathname === '/erfassen' && location.search === ''`,
          "die Adresse ist /erfassen ohne draft",
        );
        await aufZustandWarten(
          seite,
          `() => { const el = document.querySelector('[data-testid="blatt-titel"]'); return !!el && String(el.value) === ''; }`,
          `der verworfene Titel ist aus dem Editor (steht: «${await seite.evaluate<string>(fn(TITEL_WERT))}»)`,
        );
        await nichtSichtbarZugesichert(seite, QUELLSATZ, "Text des verlassenen Entwurfs");
        expect(await seite.evaluate<string>(fn(EDITOR_TEXT))).toBe("");

        // Und auch nach dem Neuladen taucht nichts wieder auf.
        await seite.reload({ waitUntil: "load", timeout: wartebudget("neuLadenAdresse") });
        await aufZustandWarten(seite, SELEKTOR_DA, "das Blatt steht nach dem Neuladen", BLATT);
        expect(await seite.evaluate<string>(fn(TITEL_WERT))).toBe("");
        await nichtSichtbarZugesichert(seite, QUELLSATZ, "Text nach dem Neuladen");
        expect(await entwurfszeile(db, kennung), "das Verwerfen hat K2 verändert").toBe(
          zeileVorher,
        );

        // Und der gespeicherte Stand ist unverändert wiederzufinden — ohne die verworfene Marke.
        await gehe(seite, `/erfassen?draft=${encodeURIComponent(kennung)}`);
        await aufSichtbarkeitWarten(seite, QUELLSATZ, "Inhalt des wieder geöffneten Entwurfs");
        expect(
          await seite.evaluate<string>(fn(TITEL_WERT)),
          "die verworfene Marke steht im wieder geöffneten Entwurf",
        ).not.toContain(marke);
        process.stderr.write(`${KENNUNG} C3 GRÜN · K2 ${kennung}\n`);
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // C4 · R-0075 — EIN GELEERTER TEXT BLEIBT GELEERT.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it(
    "C4 — R-0075: den Text des Entwurfs leeren und sichern: nach dem Neuladen bleibt er leer",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const kennung = brauche(k2, "die Kennung K2 aus C2");
      const seite = await frischeSeite(brauche(kontextA, "die Sitzung aus dem Aufbau"));
      try {
        await gehe(seite, `/erfassen?draft=${encodeURIComponent(kennung)}`);
        await aufSichtbarkeitWarten(seite, QUELLSATZ, "Inhalt des geöffneten Entwurfs");
        await seite.click(BLATT_EDITOR, { timeout: wartebudget("zeigerklick") });
        await seite.keyboard.press("ControlOrMeta+A");
        await seite.keyboard.press("Backspace");
        await aufZustandWarten(seite, EDITOR_LEER, "die Schreibfläche ist leer");
        await seite.click(BLATT_SICHERN, { timeout: wartebudget("zeigerklick") });
        await aufSichtbarkeitWarten(
          seite,
          satz("fd.toastSaved"),
          "Quittung „Entwurf gespeichert.“",
        );

        await seite.reload({ waitUntil: "load", timeout: wartebudget("neuLadenAdresse") });
        await aufZustandWarten(seite, SELEKTOR_DA, "das Blatt steht nach dem Neuladen", BLATT);
        await aufZustandWarten(
          seite,
          `() => { const el = document.querySelector('[data-testid="blatt-titel"]'); return !!el && String(el.value) !== ''; }`,
          "der Entwurf ist wieder geladen (Titel steht)",
        );
        await nichtSichtbarZugesichert(seite, QUELLSATZ, "der geleerte Text nach dem Neuladen");
        expect(
          await seite.evaluate<string>(fn(EDITOR_TEXT)),
          "der geleerte Text ist wieder aufgetaucht",
        ).toBe("");
        process.stderr.write(`${KENNUNG} C4 GRÜN · K2 ${kennung}\n`);
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );
});

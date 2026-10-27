// ================================================================================================
// JOB 4322 · OFFLINE-WIEDERHOLUNG UND BEWUSSTE ABMELDUNG — ZWEI AKTUELLE VERTRAGSGRENZEN.
// ================================================================================================
//
// O1 trägt EINEN Vorgang durch Offline-Erfassung, Neuladen ohne Netz, Wiederverbindung desselben
// angemeldeten Kontos, verlorene Antwort NACH SQL-Commit und manuellen Retry. Kein Abmelden in O1.
// O2 prüft die Löschgrenze: echte Abmeldung entfernt As lokale Arbeit samt Foto;
// weder Folgekonto B noch erneut angemeldetes A sehen, übertragen oder restaurieren diese Arbeit.
// W4.6 Punkt 2 ist jünger als die alte Erwartung, dass A nach Abmelden seine Queue wiederfindet.
// Beide Wege verwenden echte Masken, Socket/SQL, Browsernetz und öffentliche Speicherbeobachtung.
//
// Station (b) bleibt streng: nach Neuladen OHNE Netz muss „mob.queue · 1“ sichtbar sein.
// Gemessen wird hier; zugesichert wird im Hauptfall. Sichtbarkeit und zeitlich NEUE manuelle
// Rückmeldung bleiben Pflicht. Kein Consent-/Purge-/Produktpatch.
// Der optionale Kalibrierungs-Caller bleibt bytegleich. Seine überholten K1/K4-Anforderungen werden
// als nicht anwendbar abgewiesen; kein Kalibrierungs-Erfolg. K5/K6 greifen jetzt am Retry von A.
import type { Pool } from "pg";
import { expect } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  type Browser,
  type Kontext,
  SCHMAL,
  type Seite,
  fn,
  profil,
  tippeMitTastatur,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, type Sitzung, type Strecke, mussGelingen } from "../gast-nutzerweg/strecke";

const JOB = "[KLARWERK] JOB 4322";

/** Derselbe Schlüssel, unter dem `useOfflineQueue.ts:29` die Warteschlange persistiert. */
export const SCHLUESSEL = "kw.offlineQueue.v1";

/** Die Startseite der Anwendung (`app/navigation.ts:91`) — dort steht das Kopfband mit dem Menü. */
const STARTSEITE = "/start";

// ------------------------------------------------------------------------------------------------
// Die Playwright-Flächen, die `browserweg.ts` (noch) nicht führt. Sie stehen HIER und nicht dort,
// weil der Auftrag die dortige Hülle ausdrücklich auf EINE additive Methode begrenzt
// (`setOffline`); gebraucht werden sie ausschliesslich von dieser Strecke.
// ------------------------------------------------------------------------------------------------
export interface Antwortkopie {
  status(): number;
  text(): Promise<string>;
}
export interface Weiche {
  request(): { method(): string; url(): string; postData(): string | null };
  /** Die Anfrage WIRKLICH absenden — der Server sieht sie, die Antwort kommt hierher zurück. */
  fetch(): Promise<Antwortkopie>;
  /** Die Antwort auf dem Rückweg wegwerfen. Der Server hat geschrieben, der Client erfährt es nie. */
  abort(grund?: string): Promise<void>;
  fulfill(optionen: Record<string, unknown>): Promise<void>;
  continue(): Promise<void>;
}
export interface KontextMitNetz extends Kontext {
  route(muster: string, behandler: (weiche: Weiche) => Promise<void>): Promise<void>;
  unroute(muster: string): Promise<void>;
}
export interface BrowserMitFassung extends Browser {
  version(): string;
}

export interface Vorgang {
  id: string;
  kind: string;
  status: string;
  title: string;
  eigentuemer?: string;
  payload: { title?: string };
  offlineFotos?: Record<string, string>;
}

/**
 * Was der Meldungsbeobachter je Meldung (Toast) festgehalten hat — Text, Sichtbarkeit UND ZEIT.
 *
 * `zeit` ist seit R2 Pflichtangabe und kein Beiwerk: Sie ist die Hälfte des Nachweises, dass eine
 * Rückmeldung zu GENAU DIESEM Handgriff gehört und nicht von vorhin stammt (BEN, Korrekturpflicht 2
 * der Runde 1). Gemessen wird sie IM Browser, in dem Augenblick, in dem die Meldung erscheint —
 * dieselbe Uhr, die auch den Zeitpunkt des Klicks liefert, sonst verglichen sich zwei Uhren.
 */
export interface Meldung {
  text: string;
  sichtbar: boolean;
  grund: string;
  zeit: number;
}

export interface Sichtbefund {
  da: boolean;
  sichtbar: boolean;
  grund: string;
  text: string;
}

// ================================================================================================
// SICHTBARKEIT WIRD GEMESSEN, NICHT ANGENOMMEN (REGELN.md §9, Lehren 17.09. zu 4295 R1–R3).
// ================================================================================================
//
// `textContent` und „Element vorhanden" sind KEIN Nachweis. Geprüft wird der berechnete Stil — und
// zwar nicht nur am Container, sondern an JEDEM texttragenden Nachkommen: ein sichtbarer Kasten
// belegt nicht, dass sein Text sichtbar ist (BEN, 4295 R3: transparenter Fliesstext in einem
// sichtbaren Container). Vier Wege, einen Text unsichtbar zu machen, werden getrennt benannt,
// damit die Fehlermeldung auf den Schuldigen zeigt statt auf „expected true to be false".
const UNSICHTBAR_HELFER = `
  const alphaNull = (farbe) => {
    const t = String(farbe || "").trim();
    if (t === "transparent") { return true; }
    const auf = t.indexOf("(");
    if (auf < 0) { return false; }
    const teile = t.slice(auf + 1, t.lastIndexOf(")")).split(",");
    return teile.length > 3 && Number.parseFloat(teile[3]) === 0;
  };
  const unsichtbarWeil = (n) => {
    const s = getComputedStyle(n);
    if (s.display === "none") { return "display:none"; }
    if (s.visibility === "hidden" || s.visibility === "collapse") { return "visibility:" + s.visibility; }
    if (Number.parseFloat(s.opacity || "1") === 0) { return "opacity:0"; }
    const r = n.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) { return "Fläche 0x0"; }
    return "";
  };
  const textTraeger = (wurzel) => {
    const alle = [wurzel].concat(Array.prototype.slice.call(wurzel.querySelectorAll("*")));
    return alle.filter((n) => Array.prototype.some.call(n.childNodes, (k) => k.nodeType === 3 && String(k.textContent || "").trim() !== ""));
  };
  const textUnsichtbarWeil = (el) => {
    const eigen = unsichtbarWeil(el);
    if (eigen) { return "der Träger selbst: " + eigen; }
    const traeger = textTraeger(el);
    if (traeger.length === 0) { return "kein texttragender Knoten darin"; }
    for (const n of traeger) {
      const grund = unsichtbarWeil(n);
      if (grund) { return "texttragender Nachkomme <" + n.tagName.toLowerCase() + ">: " + grund; }
      if (alphaNull(getComputedStyle(n).color)) { return "texttragender Nachkomme <" + n.tagName.toLowerCase() + ">: color transparent"; }
    }
    return "";
  };
`;

const SICHTBEFUND = `(sel) => {
  ${UNSICHTBAR_HELFER}
  const el = document.querySelector(sel);
  if (!el) { return { da: false, sichtbar: false, grund: "kein Element zu " + sel, text: "" }; }
  const grund = textUnsichtbarWeil(el);
  return { da: true, sichtbar: grund === "", grund, text: grund === "" ? el.innerText : "" };
}`;

/**
 * Der Meldungsbeobachter. Meldungen (`shell/ToastViewport.tsx:22`, ein `<output>`) verschwinden nach
 * 4 s von selbst (`app/ToastContext.tsx:28`) — wer sie aus Node heraus abfragt, misst den Zufall
 * seiner Laufzeit. Er hält sie deshalb IM Browser fest, in dem Augenblick, in dem sie erscheinen,
 * und hält mit ihnen die gemessene SICHTBARKEIT fest. Ohne diese zweite Angabe wäre eine
 * ausgeblendete Meldung von einer gelesenen nicht zu unterscheiden.
 */
const MELDUNGSBEOBACHTER = `(() => {
  ${UNSICHTBAR_HELFER}
  // Ein Merker für die Diagnose des Dienstarbeiters: main.tsx:64 haengt seine Registrierung an das
  // Ereignis "load". Feuert es nie, gibt es keinen Arbeiter — und ohne diesen Merker saehe das
  // genauso aus wie eine gescheiterte Registrierung.
  window.__kwLoad = false;
  window.addEventListener("load", () => { window.__kwLoad = true; });
  const liste = [];
  Object.defineProperty(window, "__kwMeldungen", { value: liste, configurable: true });
  const erfassen = () => {
    const kaesten = document.querySelectorAll("output");
    for (const el of kaesten) {
      if (el.getAttribute("data-kw-erfasst") === "1") { continue; }
      el.setAttribute("data-kw-erfasst", "1");
      const grund = textUnsichtbarWeil(el);
      liste.push({ text: String(el.innerText || "").replace(/\\s+/g, " ").trim(), sichtbar: grund === "", grund, zeit: Date.now() });
    }
  };
  const start = () => {
    erfassen();
    new MutationObserver(erfassen).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.documentElement) { start(); } else { document.addEventListener("DOMContentLoaded", start); }
})()`;

export async function sichtbefund(seite: Seite, selektor: string): Promise<Sichtbefund> {
  return seite.evaluate<Sichtbefund>(fn(SICHTBEFUND), selektor);
}

/** Ein Text, den ein Mensch WIRKLICH sieht — sonst rot, mit dem Grund am konkreten Knoten. */
export async function mussSichtbarSein(
  seite: Seite,
  selektor: string,
  erwartet: string,
  was: string,
): Promise<string> {
  const befund = await sichtbefund(seite, selektor);
  expect(befund.da, `${was}: ${befund.grund}`).toBe(true);
  expect(
    befund.sichtbar,
    `${was} steht im DOM, ist aber NICHT sichtbar — ${befund.grund} (${selektor})`,
  ).toBe(true);
  expect(befund.text.replace(/\s+/g, " "), `${was} trägt nicht den erwarteten Text`).toContain(
    erwartet,
  );
  return befund.text;
}

async function warteschlange(seite: Seite): Promise<Vorgang[]> {
  const roh = await seite.evaluate<string | null>(
    fn(`() => localStorage.getItem(${JSON.stringify(SCHLUESSEL)})`),
  );
  return roh === null ? [] : (JSON.parse(roh) as Vorgang[]);
}

async function meldungen(seite: Seite): Promise<Meldung[]> {
  return seite.evaluate<Meldung[]>(
    fn(
      "() => (window.__kwMeldungen || []).map((m) => ({ text: m.text, sichtbar: m.sichtbar, grund: m.grund, zeit: m.zeit }))",
    ),
  );
}

/** Wie oft dieser Satz bisher gemeldet wurde — die Zählung VOR einem Handgriff. */
async function meldungszahl(seite: Seite, text: string): Promise<number> {
  return (await meldungen(seite)).filter((m) => m.text.includes(text)).length;
}

/** Auf eine Meldung warten und ihre gemessene Sichtbarkeit zusichern. */
async function meldungMussKommen(seite: Seite, text: string, was: string): Promise<Meldung> {
  await warte(
    seite,
    "(t) => (window.__kwMeldungen || []).some((m) => m.text.indexOf(t) >= 0)",
    `${was} („${text}")`,
    text,
    45_000,
  );
  const alle = await meldungen(seite);
  const treffer = alle.find((m) => m.text.includes(text));
  expect(treffer, `${was}: keine Meldung mit „${text}" festgehalten`).toBeTruthy();
  const meldung = treffer as Meldung;
  expect(
    meldung.sichtbar,
    `${was}: die Meldung „${meldung.text}" steht im DOM, ist aber NICHT sichtbar — ${meldung.grund}`,
  ).toBe(true);
  return meldung;
}

// ================================================================================================
// EIN HANDGRIFF IST ERST BELEGT, WENN ER EINE EIGENE, NEUE RÜCKMELDUNG HAT (R2, BEN-Pflicht 2).
// ================================================================================================
//
// RUNDE 1 FRAGTE NACH DEM KLICK NUR DEN BESTAND AB (`offlineweg.ts:754` der Runde 1). BEN hat den
// Klick daraufhin mit `preventDefault()` und `stopImmediatePropagation()` vollständig unterdrückt —
// und der Fall blieb GRÜN: Datenbank, Leseweg und Speicher standen ja schon vor dem Klick so da.
// Ein Nachweis, der den Ausfall dessen, was er misst, nicht bemerkt, misst nichts.
//
// ZWEI UNABHÄNGIGE MERKMALE, und beide müssen stimmen:
//   · die ZAHL der Rückmeldungen mit diesem Satz ist gestiegen (es ist eine NEUE, nicht die von
//     vorhin; auch eine Rückmeldung eines anderen Sendelaufs genügt nicht), und
//   · ihr Zeitstempel liegt NACH dem Klick (HINWEIS der Steuerung: „Zeitstempel > Klickzeit").
// Die Frist ist bewusst knapp (20 s): ein Handgriff, dessen Ergebnis erst eine Minute später
// eintrifft, ist für den Menschen am Gerät kein Ergebnis dieses Klicks mehr. Ein unterdrückter und
// ein verzögerter Handler laufen beide genau hier auf — gemessen in K5 und K6.
async function meldungMussNeuKommen(
  seite: Seite,
  text: string,
  vorher: number,
  klickZeit: number,
  was: string,
  frist = 20_000,
): Promise<Meldung> {
  await warte(
    seite,
    "([t, n]) => (window.__kwMeldungen || []).filter((m) => m.text.indexOf(t) >= 0).length > n",
    `${was}: nach dem Klick kam KEINE neue Rückmeldung „${text}" (vorher lagen ${vorher} davon vor) — der manuelle Lauf ist damit nicht belegt`,
    [text, vorher],
    frist,
  );
  const alle = (await meldungen(seite)).filter((m) => m.text.includes(text));
  expect(
    alle.length,
    `${was}: die Zahl der Rückmeldungen „${text}" ist nicht gestiegen (vorher ${vorher})`,
  ).toBeGreaterThan(vorher);
  const frisch = alle[alle.length - 1] as Meldung;
  expect(
    frisch.zeit,
    `${was}: die jüngste Rückmeldung „${frisch.text}" ist ÄLTER als der Klick (${frisch.zeit} < ${klickZeit}) — sie gehört zu einem früheren Lauf`,
  ).toBeGreaterThanOrEqual(klickZeit);
  expect(
    frisch.sichtbar,
    `${was}: die Rückmeldung „${frisch.text}" steht im DOM, ist aber NICHT sichtbar — ${frisch.grund}`,
  ).toBe(true);
  return frisch;
}

async function meldungDarfNichtKommen(seite: Seite, text: string, was: string): Promise<void> {
  const alle = await meldungen(seite);
  expect(
    alle.filter((m) => m.text.includes(text)).map((m) => m.text),
    was,
  ).toEqual([]);
}

/** Zeilen in der Tabelle `drafts` — die eine Zahl, an der dieser Auftrag hängt. */
export async function zeilen(pool: Pool): Promise<number> {
  const res = await pool.query<{ anzahl: string }>("SELECT count(*)::text AS anzahl FROM drafts");
  return Number(res.rows[0]?.anzahl ?? "-1");
}

/** Zeilen zu GENAU DIESEM Vorgangsschlüssel (`create_operation_id`, repo-pg.ts:53). */
export async function zeilenFuerVorgang(pool: Pool, vorgang: string): Promise<number> {
  const res = await pool.query<{ anzahl: string }>(
    "SELECT count(*)::text AS anzahl FROM drafts WHERE create_operation_id = $1",
    [vorgang],
  );
  return Number(res.rows[0]?.anzahl ?? "-1");
}

async function urheber(pool: Pool): Promise<string[]> {
  const res = await pool.query<{ wer: string | null }>(
    "SELECT data->>'originalAuthor' AS wer FROM drafts ORDER BY data->>'createdAt'",
  );
  return res.rows.map((r) => String(r.wer ?? "(keiner)"));
}

// ------------------------------------------------------------------------------------------------
// Die Handgriffe eines Menschen an dieser Fläche.
// ------------------------------------------------------------------------------------------------

/**
 * Anmelden über die ECHTE Maske. Getippt wird, nicht gesetzt — und das erste Feld wird per Tab
 * erreicht (`tippeMitTastatur`), nicht angeklickt: dieselbe Lehre wie in `browserweg.ts:291`.
 *
 * WARUM HIER UND NICHT AUS `browserweg.ts` GEHOLT: die dortige Fassung ist modulprivat, und der
 * Auftrag begrenzt die Änderung an jener Datei ausdrücklich auf EINE additive Methode. Sie in der
 * Rückgabe zu nennen ist ehrlicher, als eine zweite Änderung stillschweigend mitzunehmen.
 */
async function anmelden(seite: Seite, basis: string, email: string, marke: string): Promise<void> {
  await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(seite, `() => !!document.querySelector("#auth-email")`, `Anmeldemaske für ${marke}`);
  await tippeMitTastatur(seite, "#auth-email", email, `E-Mail (${marke})`);
  await tippeMitTastatur(seite, "#auth-password", PASSWORT, `Passwort (${marke})`);
  await seite.keyboard.press("Enter");
  await warte(
    seite,
    `() => !document.querySelector("#auth-email")`,
    `die Anmeldung von ${marke} trägt`,
    undefined,
    45_000,
  );
}

/**
 * Abmelden über den Weg, den ein Mensch am schmalen Gerät geht: Hamburger → Konto-Liste →
 * „Abmelden" (`shell/Kopfband.tsx:265`, `shell/KontoMenue.tsx:76`, im Schubfach über
 * `shell/DrawerMenue.tsx:32`).
 *
 * ER BEGINNT AUF DER STARTSEITE UND NICHT AUF `/mobile`, und das ist kein Umweg, sondern der
 * einzige Weg: `/mobile` rendert ohne Hülle (`shell/AppShell.tsx:65`) und hat deshalb kein
 * Kopfband. Nebenbei ist es genau die Reihenfolge, die dieser Fall braucht — solange `Mobile`
 * montiert ist, läuft der Sendeweg mit (`useOfflineQueue` wohnt allein dort).
 */
async function abmelden(seite: Seite, basis: string, marke: string): Promise<void> {
  await seite.goto(`${basis}${STARTSEITE}`, { waitUntil: "domcontentloaded" });
  await warte(
    seite,
    `() => !!document.querySelector('[data-testid="kopfband-menue"]')`,
    `das Kopfband von ${marke}`,
    undefined,
    45_000,
  );
  await seite.click('[data-testid="kopfband-menue"]');
  await warte(
    seite,
    `() => !!document.querySelector('[data-testid="konto-abmelden"]')`,
    `der Abmelde-Eintrag im Schubfach von ${marke}`,
  );
  await seite.click('[data-testid="konto-abmelden"]');
  await warte(
    seite,
    `() => !!document.querySelector("#auth-email")`,
    `${marke} steht nach dem Abmelden wieder vor der Anmeldemaske`,
    undefined,
    45_000,
  );
}

/** Auf die mobile Erfassungsfläche gehen und warten, bis sie WIRKLICH steht. */
async function zurMobilflaeche(seite: Seite, basis: string, marke: string): Promise<void> {
  await seite.goto(`${basis}/mobile`, { waitUntil: "domcontentloaded" });
  await warte(
    seite,
    `(p) => !!document.querySelector('input[placeholder="' + p + '"]') && !!document.querySelector('[data-testid="mob-statement"]')`,
    `die Erfassungsfläche für ${marke}`,
    i18n.t("mob.formTitle"),
    45_000,
  );
}

// ================================================================================================
// DER DIENSTARBEITER IST DIE VORBEDINGUNG VON STATION (b) — und er wird nachgemessen, nicht geglaubt.
// ================================================================================================
//
// Ohne ihn gibt es kein Neuladen ohne Netz: `apps/web/public/sw.js:45` beantwortet eine gescheiterte
// Navigation aus dem Zwischenspeicher. Registriert wird er in `main.tsx:63`, ausdrücklich NUR im
// PROD-Bündel — also genau in dem, das diese Strecke ausliefert.
//
// WARUM HIER EINE EIGENE DIAGNOSE STEHT: Ein blosses „nicht eingetreten in 45 s" sagt nicht, ob der
// Arbeiter fehlt, ob seine Installation gescheitert ist oder ob nur die Übernahme aussteht. Ein
// Prüfstand, der an seiner eigenen Vorrichtung scheitert und das nicht sagen kann, kostet eine ganze
// Runde (Lehre 4321 R1, 17.09.).
const DIENSTARBEITER_STAND = `() => {
  if (!navigator.serviceWorker) { return Promise.resolve({ moeglich: false }); }
  return navigator.serviceWorker.getRegistration("/")
    .then((r) => ({
      moeglich: true,
      registriert: !!r,
      installing: r && r.installing ? r.installing.state : null,
      waiting: r && r.waiting ? r.waiting.state : null,
      active: r && r.active ? r.active.state : null,
      steuert: !!navigator.serviceWorker.controller,
      bereit: !!r && !!r.active,
    }))
    .catch((e) => ({ moeglich: true, fehler: String(e) }));
}`;

interface Dienststand {
  moeglich: boolean;
  registriert?: boolean;
  installing?: string | null;
  waiting?: string | null;
  active?: string | null;
  steuert?: boolean;
  bereit?: boolean;
  fehler?: string;
}

async function warteAufDienstarbeiter(seite: Seite): Promise<Dienststand> {
  let stand: Dienststand = { moeglich: false };
  for (let versuch = 0; versuch < 90; versuch += 1) {
    stand = await seite.evaluate<Dienststand>(fn(DIENSTARBEITER_STAND));
    if (stand.steuert === true) {
      return stand;
    }
    await new Promise((weiter) => setTimeout(weiter, 500));
  }
  const rohSw = await seite.evaluate<{ status: number; anfang: string }>(
    fn(`() => fetch("/sw.js")
      .then((r) => r.text().then((t) => ({ status: r.status, anfang: t.slice(0, 120) })))
      .catch((e) => ({ status: -1, anfang: String(e) }))`),
  );
  const buendel = await seite.evaluate<unknown>(
    fn(`() => fetch("/index.html")
      .then((r) => r.text())
      .then((h) => {
        const treffer = /src="([^"]+\\.js)"/.exec(h);
        if (!treffer) { return { eintritt: null }; }
        return fetch(treffer[1]).then((r) => r.text()).then((t) => ({
          eintritt: treffer[1],
          laenge: t.length,
          nenntSw: t.indexOf("sw.js") >= 0,
          nenntRegister: t.indexOf("serviceWorker") >= 0,
        }));
      })
      .catch((e) => ({ fehler: String(e) }))`),
  );
  const laden = await seite.evaluate<unknown>(
    fn(
      "() => ({ readyState: document.readyState, ladeEreignis: !!window.__kwLoad, url: location.href })",
    ),
  );
  throw new Error(
    `${JOB}: der Dienstarbeiter (sw.js) steuert diese Seite auch nach 45 s nicht — ohne ihn ist Station (b) (Neuladen OHNE Netz) nicht fahrbar.\n` +
      `Stand: ${JSON.stringify(stand)}\nAuslieferung /sw.js: ${JSON.stringify(rohSw)}\n` +
      `Eintrittsbündel: ${JSON.stringify(buendel)}\nLadezustand: ${JSON.stringify(laden)}`,
  );
}

/** Die Verbindung dieses Browserprofils schalten — und warten, bis die SEITE es gemerkt hat. */
async function netz(kontext: KontextMitNetz, seite: Seite, an: boolean): Promise<void> {
  await kontext.setOffline(!an);
  await warte(
    seite,
    "(an) => navigator.onLine === an",
    `die Fläche merkt die Verbindung: ${an ? "an" : "aus"}`,
    an,
    45_000,
  );
}

/** Titel und Text tippen, speichern — der eine Erfassungsweg dieser Fläche. */
async function erfassen(seite: Seite, titel: string, text: string): Promise<void> {
  const titelfeld = `input[placeholder="${i18n.t("mob.formTitle")}"]`;
  await tippeMitTastatur(seite, titelfeld, titel, `Kernaussage („${titel}")`);
  await tippeMitTastatur(seite, '[data-testid="mob-statement"]', text, `Text („${titel}")`);
  await seite.click(`button:has-text("${i18n.t("mob.save")}")`);
}

/** Der eine Knopf, den ein Mensch für den manuellen Lauf drückt (`Mobile.tsx:987`). */
const SYNC_KNOPF = '[data-testid="mob-warteschlange"] button';

/**
 * KALIBRIERUNG K5: der Klick wird verschluckt, bevor React ihn sieht.
 *
 * Genau BENs Probe der Runde 1, als stehender Fall: ein Fänger in der Auffangphase am Knopf selbst
 * hält das Ereignis an (`stopImmediatePropagation`), sodass der Zuhörer an der React-Wurzel es nie
 * bekommt. Die Fläche tut daraufhin nichts — und der Nachweis MUSS daran scheitern.
 */
async function klickUnterdruecken(seite: Seite): Promise<void> {
  await seite.evaluate<boolean>(
    fn(`(sel) => {
      const k = document.querySelector(sel);
      if (!k) { throw new Error("Kalibrierung: der Synchronisierknopf ist nicht da"); }
      k.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        window.__kwKlickUnterdrueckt = (window.__kwKlickUnterdrueckt || 0) + 1;
      }, true);
      return true;
    }`),
    SYNC_KNOPF,
  );
}

/**
 * KALIBRIERUNG K6: der Klick kommt an — nur viel zu spät.
 *
 * Er wird in der Auffangphase angehalten und nach `ms` als eigener Klick erneut ausgelöst (der
 * Fänger lässt den zweiten am Merker vorbei). Die Fläche arbeitet also korrekt, nur eben nach der
 * Frist — und ein Nachweis, der den Bestand danach einfach länger abfragte, bliebe grün. Er darf es
 * nicht: `meldungMussNeuKommen` wartet 20 s, die Verzögerung ist länger.
 */
async function klickVerzoegern(seite: Seite, ms: number): Promise<void> {
  await seite.evaluate<boolean>(
    fn(`([sel, ms]) => {
      const k = document.querySelector(sel);
      if (!k) { throw new Error("Kalibrierung: der Synchronisierknopf ist nicht da"); }
      k.addEventListener("click", (ev) => {
        if (ev.__kwDurchgelassen) { return; }
        ev.preventDefault();
        ev.stopImmediatePropagation();
        window.setTimeout(() => {
          const spaet = new MouseEvent("click", { bubbles: true, cancelable: true });
          spaet.__kwDurchgelassen = true;
          k.dispatchEvent(spaet);
        }, ms);
      }, true);
      return true;
    }`),
    [SYNC_KNOPF, ms],
  );
}

/**
 * Den manuellen Lauf auslösen UND seinen Abschluss nachweisen.
 *
 * Erst wenn die NEUE Rückmeldung da ist, sagt eine Abfrage von Datenbank, Leseweg und Speicher
 * etwas über DIESEN Klick — vorher wäre sie die Auskunft von vorhin (BEN, Korrekturpflicht 2).
 */
async function manuellSynchronisieren(
  seite: Seite,
  erwartet: string,
  was: string,
  verstellen: Verstellung = {},
): Promise<Meldung> {
  await warte(
    seite,
    "(sel) => { const k = document.querySelector(sel); return !!k && !k.disabled; }",
    `${was}: der Synchronisierknopf steht bereit`,
    SYNC_KNOPF,
    45_000,
  );
  const vorher = await meldungszahl(seite, erwartet);
  if (verstellen.klickUnterdruecken) {
    await klickUnterdruecken(seite);
  }
  if (verstellen.klickVerzoegernMs) {
    await klickVerzoegern(seite, verstellen.klickVerzoegernMs);
  }
  // Die Klickzeit kommt aus der Uhr DES BROWSERS — dieselbe, die auch die Meldungen stempelt.
  const klickZeit = await seite.evaluate<number>(fn("() => Date.now()"));
  await seite.click(SYNC_KNOPF);
  return meldungMussNeuKommen(seite, erwartet, vorher, klickZeit, was);
}

/** Ein Stück CSS in die Seite legen — ausschliesslich für die Kalibrierungen (Lieferung 3). */
async function ausblenden(seite: Seite, selektor: string): Promise<void> {
  await seite.evaluate<boolean>(
    fn(`(sel) => {
      const s = document.createElement("style");
      s.setAttribute("data-kw-kalibrierung", "1");
      s.textContent = sel + " { display: none !important; }";
      document.head.appendChild(s);
      return true;
    }`),
    selektor,
  );
}

export interface Verstellung {
  /** Alt-K1 ist seit der bewussten W4.6-Löschgrenze hier nicht mehr anwendbar. */
  eigentuemerAufB?: boolean;
  /** Station (d) erwartet absichtlich eine falsche Zeilenzahl nach der belegten Anlage. */
  erwarteteZeilenNachAnlage?: number;
  /** Vor Station (a) ausgeblendet (CSS-Selektor) — prüft die Sichtbarkeitszusage selbst. */
  ausblendenVorA?: string;
  /** Alt-K4 über eine nach Abmelden erhaltene Fremdzeile ist nicht mehr anwendbar. */
  ausblendenVorC?: string;
  /** As manueller Retry wird verschluckt (K5); neue Rückmeldung bleibt Pflicht. */
  klickUnterdruecken?: boolean;
  /** As manueller Retry wirkt erst nach dieser Zeit (K6), weiterhin 20-s-Nachweisfrist. */
  klickVerzoegernMs?: number;
}

export interface OfflineWegAufbau {
  browser: BrowserMitFassung;
  strecke: Strecke;
  pool: Pool;
  aEmail: string;
  bEmail: string;
  aId: string;
  bId: string;
  titelA: string;
  verstellen?: Verstellung;
}

/**
 * Was an Station (b) WIRKLICH auf dem Bildschirm stand — gemessen, nicht ausgelegt.
 *
 * Die Zusicherung darüber steht im Hauptfall (s. Kopf dieser Datei); hier steht nur der Messwert,
 * und zwar mit seiner Diagnose: der Zähler, die Frage nach der Anmeldemaske und der Anfang des
 * Seitentextes. Ohne diese drei Angaben wäre die rote Meldung ein „expected false to be true" und
 * sagte nichts darüber, WAS der Mensch stattdessen sieht.
 */
export interface StationB {
  zaehler: Sichtbefund;
  sollText: string;
  anmeldemaske: boolean;
  seitentext: string;
}

export interface OfflineWegBefund {
  protokoll: string;
  vorgangA: string;
  zeilenAmEnde: number;
  versuche: Versuch[];
  stationB: StationB;
}

interface Versuch {
  operationId: string;
  expectedOwner: string;
  status: number;
  zeilenFuerVorgang: number;
  abgeworfen: boolean;
}

/**
 * A und B als echte Konten anlegen — über den Weg des Betreibers (`POST /api/users`), mit der
 * Rolle `experte`: sie brauchen `ko.create` und sehen nur ihre eigenen Entwürfe. Ein Administrator
 * sähe jeden Entwurf; die Prüfung des privaten Lesewegs wäre dann nicht aussagekräftig.
 */
export async function kontenAnlegen(
  chef: Sitzung,
  konten: { name: string; email: string }[],
): Promise<Record<string, string>> {
  for (const konto of konten) {
    mussGelingen(
      `POST /api/users (${konto.email})`,
      await chef.sende("POST", "/api/users", {
        name: konto.name,
        email: konto.email,
        password: PASSWORT,
        role: "experte",
      }),
      201,
    );
  }
  const liste = mussGelingen("GET /api/users", await chef.sende("GET", "/api/users")).json as {
    id: string;
    email: string;
  }[];
  const kennungen: Record<string, string> = {};
  for (const konto of konten) {
    const treffer = liste.find((u) => u.email === konto.email);
    if (!treffer) {
      throw new Error(`${JOB}: das angelegte Konto ${konto.email} fehlt im Bestand.`);
    }
    kennungen[konto.email] = treffer.id;
  }
  return kennungen;
}

/** Nach bewusster Abmeldung: SQL, bestätigtes Konto, eigener Leseweg, lokaler Bestand und Anzeige. */
async function abnahmeNachAbmeldung(
  seite: Seite,
  a: OfflineWegAufbau,
  vorgangA: string,
  konto: string,
  wann: string,
): Promise<void> {
  expect(await zeilen(a.pool), `${wann}: gelöschte Offlinearbeit wurde angelegt`).toBe(0);
  expect(await zeilenFuerVorgang(a.pool, vorgangA)).toBe(0);
  const wer = await seite.evaluate<{ id?: string }>(
    fn('() => fetch("/api/auth/me", { credentials: "include" }).then((r) => r.json())'),
  );
  expect(wer.id, `${wann}: das erwartete Konto ist nicht bestätigt`).toBe(konto);
  const sicht = await seite.evaluate<{ status: number; rumpf: string }>(
    fn(`() => fetch("/api/drafts", { credentials: "include" })
      .then((r) => r.text().then((t) => ({ status: r.status, rumpf: t })))
      .catch((e) => ({ status: -1, rumpf: String(e) }))`),
  );
  expect(sicht.status, `${wann}: GET /api/drafts: ${sicht.rumpf.slice(0, 300)}`).toBe(200);
  expect(JSON.parse(sicht.rumpf) as unknown[], `${wann}: unerwartete Entwürfe`).toEqual([]);
  expect(await warteschlange(seite), `${wann}: gelöschte Queue wurde wiederhergestellt`).toEqual(
    [],
  );
  expect(await offlineFotos(seite), `${wann}: gelöschte Fotos wurden wiederhergestellt`).toEqual(
    [],
  );
  const text = await seite.evaluate<string>(fn("() => document.body.innerText"));
  expect(text, `${wann}: der gelöschte Titel ist sichtbar`).not.toContain(a.titelA);
  await meldungDarfNichtKommen(
    seite,
    i18n.t("mob.syncOk"),
    `${wann}: gelöschte Arbeit wurde als erfolgreich übertragen gemeldet`,
  );
}

// ================================================================================================
// O1 — (a), (b), (d), (e): EIN Vorgang desselben angemeldeten A, ohne Abmeldung.
// ================================================================================================
export async function fahreDenOfflineWeg(a: OfflineWegAufbau): Promise<OfflineWegBefund> {
  const verstellen = a.verstellen ?? {};
  if (verstellen.eigentuemerAufB || verstellen.ausblendenVorC) {
    throw new Error(
      "Alt-K1/K4 sind seit W4.6 Punkt 2 nicht anwendbar: Abmelden löscht As Queue. Kein Kalibrierungsbefund.",
    );
  }
  const basis = a.strecke.basis;
  const { kontext: rohKontext, seite } = await profil(a.browser, SCHMAL, "de");
  const kontext = rohKontext as KontextMitNetz;
  await kontext.addInitScript(MELDUNGSBEOBACHTER);
  const versuche: Versuch[] = [];
  try {
    // ══ Vorbedingung: die Ausgangslage ist leer. ═══════════════════════════════════════════════
    expect(await zeilen(a.pool), "in `drafts` steht schon vor dem Weg etwas").toBe(0);

    // ══ (a) A meldet sich an, geht offline und erfasst. ════════════════════════════════════════
    await anmelden(seite, basis, a.aEmail, "A");
    await zurMobilflaeche(seite, basis, "A");
    await warteAufDienstarbeiter(seite);
    if (verstellen.ausblendenVorA) {
      await ausblenden(seite, verstellen.ausblendenVorA);
    }
    await netz(kontext, seite, false);
    await warte(
      seite,
      "(t) => document.body.innerText.indexOf(t) >= 0",
      "die Fläche sagt, dass ohne Netz lokal vorgemerkt wird",
      i18n.t("mob.offlineSaveHint"),
      45_000,
    );
    await erfassen(seite, a.titelA, "Unterwegs an der Anlage erfasst, ohne Netz.");
    await meldungMussKommen(seite, i18n.t("mob.queued"), "Station (a): der Offline-Satz");

    await warte(
      seite,
      `(k) => (JSON.parse(localStorage.getItem(k) || "[]")).length === 1`,
      "Station (a): der Vorgang liegt in der Warteschlange",
      SCHLUESSEL,
      15_000,
    );
    const nachA = await warteschlange(seite);
    expect(nachA, "Station (a): es liegt nicht genau ein Vorgang").toHaveLength(1);
    const vorgangA = String(nachA[0]?.id ?? "");
    expect(vorgangA, "Station (a): der Vorgang hat keine Kennung").not.toBe("");
    expect(nachA[0]?.kind, "Station (a): es ist kein Anlagevorgang").toBe("draft.create");
    expect(nachA[0]?.eigentuemer, "Station (a): der Vorgang trägt nicht As Kennung").toBe(a.aId);
    expect(nachA[0]?.payload.title, "Station (a): der getippte Titel fehlt").toBe(a.titelA);
    expect(await zeilen(a.pool), "Station (a): ohne Netz ist etwas in `drafts` gelandet").toBe(0);
    // Der Zähler der Warteschlange steht sichtbar auf 1 — SOLANGE die Sitzung feststeht.
    await mussSichtbarSein(
      seite,
      '[data-testid="mob-warteschlange"]',
      `${i18n.t("mob.queue")} · 1`,
      "Station (a): der Zähler der Warteschlange",
    );

    // ══ (b) Neuladen, noch immer ohne Netz. ════════════════════════════════════════════════════
    await seite.reload({ waitUntil: "domcontentloaded" });
    await warte(
      seite,
      `() => !!document.querySelector("#auth-email") || !!document.querySelector('[data-testid="mob-warteschlange"]')`,
      "Station (b): die Anwendung ist ohne Netz aus dem Zwischenspeicher wieder da",
      undefined,
      45_000,
    );
    // Der Vorgang ist VOLLZÄHLIG da — mit unveränderter Kennung, unverändertem Eigentümer und
    // unverändertem Titel. Drei Angaben in EINER Zusicherung: wer nur die Anzahl prüft, bliebe
    // grün, wenn der Eigentümer beim Neuladen verlorenginge.
    const nachNeuladen = await warteschlange(seite);
    expect(
      nachNeuladen.map((v) => ({ id: v.id, eigentuemer: v.eigentuemer, titel: v.payload.title })),
      "Station (b): der Vorgang hat das Neuladen ohne Netz nicht unverändert überlebt",
    ).toEqual([{ id: vorgangA, eigentuemer: a.aId, titel: a.titelA }]);
    expect(await zeilen(a.pool), "Station (b): das Neuladen hat etwas angelegt").toBe(0);
    // ────────────────────────────────────────────────────────────────────────────────────────────
    // DIE ZUSAGE DES AUFTRAGS (§5 Lieferung 2(b)): der Zähler „mob.queue · 1" ist SICHTBAR.
    //
    // Sie wird hier gemessen und im Hauptfall zugesichert (Begründung im Kopf dieser Datei). Auf
    // den Zähler wird GEWARTET — bis zu 20 s, denn die Anwendung baut sich nach dem Neuladen aus
    // dem Zwischenspeicher erst wieder auf; erst wenn er in dieser Zeit nicht sichtbar geworden
    // ist, steht der Messwert fest. Dazu die Diagnose, damit die rote Meldung sagt, was der Mensch
    // stattdessen sieht.
    // ────────────────────────────────────────────────────────────────────────────────────────────
    const sollZaehler = `${i18n.t("mob.queue")} · 1`;
    let zaehler = await sichtbefund(seite, '[data-testid="mob-warteschlange"]');
    for (let blick = 0; blick < 40 && !zaehler.sichtbar; blick += 1) {
      await new Promise((weiter) => setTimeout(weiter, 500));
      zaehler = await sichtbefund(seite, '[data-testid="mob-warteschlange"]');
    }
    const maske = await sichtbefund(seite, "#auth-email");
    const stationB: StationB = {
      zaehler,
      sollText: sollZaehler,
      anmeldemaske: maske.da,
      seitentext: (await seite.evaluate<string>(fn("() => document.body.innerText")))
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 300),
    };

    // ══ (d) Derselbe A kommt online; die erste Antwort geht NACH SQL-Commit verloren. ═
    // Die Weiche steht VOR der Wiederverbindung: der normale Online-Anlauf sendet selbst.
    // Keine Abmeldung und keine neue Erfassung zwischen (a) und dem Retry.
    let abwerfen = true;
    await kontext.route("**/api/drafts", async (weiche) => {
      if (weiche.request().method().toUpperCase() !== "POST") {
        await weiche.continue();
        return;
      }
      const rumpf = JSON.parse(weiche.request().postData() ?? "{}") as {
        operationId?: string;
        expectedOwner?: string;
      };
      const antwort = await weiche.fetch();
      const geschrieben = await zeilenFuerVorgang(a.pool, String(rumpf.operationId ?? ""));
      versuche.push({
        operationId: String(rumpf.operationId ?? ""),
        expectedOwner: String(rumpf.expectedOwner ?? ""),
        status: antwort.status(),
        zeilenFuerVorgang: geschrieben,
        abgeworfen: abwerfen,
      });
      if (abwerfen) {
        abwerfen = false;
        await weiche.abort("failed");
        return;
      }
      await weiche.fulfill({ response: antwort });
    });

    await netz(kontext, seite, true);

    // ── (d) DER ERSTE VERSUCH: der Server legt an, die Antwort geht auf dem Rückweg verloren. ────
    //
    // Die Reihenfolge ist die Zusage (Codex, 17.09. 17:07, von BEN als richtig bestätigt): Die
    // Anfrage ERREICHT den Server (`weiche.fetch()`), die Zeile wird in der Datenbank NACHGESEHEN,
    // und erst danach wird die Antwort weggeworfen. Ein vor dem Versand abgebrochener Aufruf bewiese
    // über Wiederholungssicherheit nichts.
    await meldungMussKommen(
      seite,
      `${i18n.t("mob.syncFail")} (1)`,
      "Station (d): der ehrliche Fehlervermerk nach der verlorenen Antwort",
    );
    expect(versuche, "Station (d): es ging kein Anlageversuch hinaus").toHaveLength(1);
    expect(versuche[0]?.abgeworfen, "Station (d): die erste Antwort wurde nicht abgeworfen").toBe(
      true,
    );
    expect(
      versuche[0]?.status,
      "Station (d): der Server hat den ersten Versuch nicht angelegt (201 erwartet)",
    ).toBe(201);
    expect(
      versuche[0]?.zeilenFuerVorgang,
      "Station (d): die Zeile war beim Abwurf der Antwort NICHT in der Datenbank — dann prüft die Wiederholung nichts",
    ).toBe(1);
    // DIE KLAMMER UM DEN GANZEN WEG: es ist der Vorgang aus (a), derselbe Schlüssel, der den
    // das Neuladen ohne Netz überstanden hat — und er trägt As Kennung als Voraussetzung mit.
    expect(
      versuche[0]?.operationId,
      "Station (d): der Anlageversuch trug NICHT den Vorgangsschlüssel aus (a)",
    ).toBe(vorgangA);
    expect(versuche[0]?.expectedOwner, "Station (d): der Versuch trug nicht As Kennung").toBe(
      a.aId,
    );
    // Die Anlage ist echt und einmalig — und der Vorgang bleibt trotzdem liegen, weil sein Ausgang
    // dem Client unbekannt ist. Beides zusammen ist die Lage, in der sich Wiederholung bewährt.
    expect(await zeilen(a.pool), "Station (d): in `drafts` steht nicht genau eine Zeile").toBe(
      verstellen.erwarteteZeilenNachAnlage ?? 1,
    );
    expect(await urheber(a.pool), "Station (d): der Entwurf trägt nicht As Konto").toEqual([a.aId]);
    expect(
      await zeilenFuerVorgang(a.pool, vorgangA),
      "Station (d): der Vorgangsschlüssel steht nicht genau einmal in der Tabelle",
    ).toBe(1);
    expect(
      (await warteschlange(seite)).map((v) => ({ id: v.id, eigentuemer: v.eigentuemer })),
      "Station (d): der Vorgang wurde trotz unbekanntem Ausgang entfernt oder umgehängt",
    ).toEqual([{ id: vorgangA, eigentuemer: a.aId }]);

    // ── (e) DIE WIEDERHOLUNG — derselbe Vorgangsschlüssel, über den Knopf, den ein Mensch drückt. ─
    const wiederholung = await manuellSynchronisieren(
      seite,
      `${i18n.t("mob.syncOk")} (1)`,
      "Station (e): die Wiederholung",
      verstellen,
    );
    expect(
      wiederholung.zeit,
      "Station (e): die Erfolgsmeldung trägt keinen Zeitstempel",
    ).toBeGreaterThan(0);
    await warte(
      seite,
      `(k) => (JSON.parse(localStorage.getItem(k) || "[]")).length === 0`,
      "Station (e): der wiederholte Vorgang verlässt die Warteschlange",
      SCHLUESSEL,
      45_000,
    );
    await kontext.unroute("**/api/drafts");
    expect(versuche, "Station (e): die Wiederholung ging nicht hinaus").toHaveLength(2);
    expect(versuche[1]?.operationId, "Station (e): die Wiederholung trug eine NEUE Kennung").toBe(
      vorgangA,
    );
    expect(versuche[1]?.abgeworfen, "Station (e): auch die zweite Antwort wurde abgeworfen").toBe(
      false,
    );
    expect(
      versuche[1]?.status,
      "Station (e): der Server hat den Vorgang nicht als Wiederholung erkannt (200 erwartet)",
    ).toBe(200);
    const zeilenAmEnde = await zeilen(a.pool);
    expect(zeilenAmEnde, "Station (e): die Wiederholung hat eine zweite Zeile angelegt").toBe(1);
    expect(
      await zeilenFuerVorgang(a.pool, vorgangA),
      "Station (e): der Vorgangsschlüssel steht nicht GENAU EINMAL in der Tabelle",
    ).toBe(1);
    expect(await urheber(a.pool), "Station (e): der Entwurf trägt das falsche Konto").toEqual([
      a.aId,
    ]);
    // Die Fläche zeigt den Erfolg SICHTBAR — das ist die Meldung, auf die `manuellSynchronisieren`
    // oben gewartet und deren Sichtbarkeit es nachgemessen hat. Und im ganzen Lauf gab es GENAU
    // EINEN Fehlervermerk: den, der hier absichtlich herbeigeführt wurde (Auftrag §5 Lieferung 2(d),
    // „kein mob.syncFail" — für den Abschluss, s. den Block oben). Ein zweiter wäre ein ungeklärter
    // Fehlversuch und kein Nachweis.
    expect(
      (await meldungen(seite))
        .filter((m) => m.text.includes(i18n.t("mob.syncFail")))
        .map((m) => m.text),
      "Station (e): in As wiederverbundener Sitzung gab es nicht genau den EINEN herbeigeführten Fehlervermerk",
    ).toEqual([`${i18n.t("mob.syncFail")} (1)`]);

    // ══ Die Protokollzeile (Lieferung 5) — alles, was diesen Lauf belegt, in EINER Zeile. ══════
    const pgFassung = (await a.pool.query<{ version: string }>("SELECT version() AS version"))
      .rows[0]?.version;
    const protokoll = [
      `${JOB} STRECKE GELAUFEN`,
      `Chromium ${a.browser.version()}`,
      `Socket ${basis}`,
      `PostgreSQL ${String(pgFassung ?? "(unbekannt)")
        .split(" ")
        .slice(0, 2)
        .join(" ")}`,
      `Vorgang ${vorgangA}`,
      `Anlageversuche ${versuche.length} (${versuche.map((v) => v.status).join("/")})`,
      `drafts-Zeilen ${zeilenAmEnde}`,
      `Station (b) Zähler sichtbar: ${stationB.zaehler.sichtbar ? "ja" : `nein — ${stationB.zaehler.grund}`}`,
    ].join(" · ");
    process.stderr.write(`${protokoll}\n`);

    return { protokoll, vorgangA, zeilenAmEnde, versuche, stationB };
  } finally {
    await kontext.unroute("**/api/drafts").catch(() => undefined);
    await kontext.close();
  }
}

interface SeiteMitFoto extends Seite {
  waitForEvent(
    name: "filechooser",
    opts: { timeout: number },
  ): Promise<{
    setFiles(dateien: { name: string; mimeType: string; buffer: Buffer }[]): Promise<void>;
  }>;
}

async function offlineFotos(seite: Seite): Promise<{ schluessel: string; bild: boolean }[]> {
  return seite.evaluate(
    fn(`() => Object.keys(localStorage).filter((k) => k.startsWith("kw.offlinePhoto.v1:"))
      .sort().map((k) => ({ schluessel: k, bild: (localStorage.getItem(k) || "").startsWith("data:image/") }))`),
  );
}

export interface AbmeldeBefund {
  vorgangA: string;
  fotosVorAbmeldung: number;
  anlageversuche: number;
  zeilenAmEnde: number;
}

/** O2: echte Offlineeingabe samt Foto und bewusste Abmeldung; B und erneut A bleiben leer. */
export async function fahreDenAbmeldeWeg(a: OfflineWegAufbau): Promise<AbmeldeBefund> {
  const basis = a.strecke.basis;
  const { kontext: rohKontext, seite } = await profil(a.browser, SCHMAL, "de");
  const kontext = rohKontext as KontextMitNetz;
  await kontext.addInitScript(MELDUNGSBEOBACHTER);
  let anlageversuche = 0;
  try {
    expect(await zeilen(a.pool)).toBe(0);
    await anmelden(seite, basis, a.aEmail, "A");
    await zurMobilflaeche(seite, basis, "A");
    await warteAufDienstarbeiter(seite);
    await netz(kontext, seite, false);
    const fotoSeite = seite as SeiteMitFoto;
    const [waehler] = await Promise.all([
      fotoSeite.waitForEvent("filechooser", { timeout: 45_000 }),
      seite.click(`[data-testid="mob-fotos"] button:has-text("${i18n.t("mob.foto.mediathek")}")`),
    ]);
    // Fiktives gültiges 1×1-RGBA-PNG über den echten Dateiwähler, keine Speicherinjektion.
    await waehler.setFiles([
      {
        name: "offline-a.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNQSDjwHwAEJAJA6qdhxgAAAABJRU5ErkJggg==",
          "base64",
        ),
      },
    ]);
    await warte(
      seite,
      `() => {
        const bild = document.querySelector('[data-testid="mob-fotos"] img');
        return !!bild && bild.complete && bild.naturalWidth > 0 &&
          bild.getBoundingClientRect().width > 0 &&
          !document.querySelector('[data-testid="mob-foto-in-arbeit"]');
      }`,
      "O2: das gewählte Offlinefoto steht bereit",
    );
    await erfassen(seite, a.titelA, "Offlinearbeit mit Foto vor bewusster Abmeldung.");
    await meldungMussKommen(seite, i18n.t("mob.queued"), "O2: offline vorgemerkt");
    const queue = await warteschlange(seite);
    expect(queue).toHaveLength(1);
    const vorgangA = String(queue[0]?.id ?? "");
    expect(vorgangA).not.toBe("");
    expect(queue[0]?.eigentuemer).toBe(a.aId);
    expect(queue[0]?.payload.title).toBe(a.titelA);
    const fotos = await offlineFotos(seite);
    expect(fotos).toHaveLength(1);
    expect(fotos[0]?.bild).toBe(true);
    expect(
      Object.values(queue[0]?.offlineFotos ?? {}).map((id) => `kw.offlinePhoto.v1:${id}`),
    ).toEqual(fotos.map((f) => f.schluessel));

    await kontext.route("**/api/drafts", async (weiche) => {
      if (weiche.request().method().toUpperCase() === "POST") anlageversuche += 1;
      await weiche.continue();
    });
    // Der Queue-Anlauf ist beim Verlassen von /mobile abgebaut, bevor Netz zum Abmelden nötig ist.
    await seite.goto(`${basis}${STARTSEITE}`, { waitUntil: "domcontentloaded" });
    await netz(kontext, seite, true);
    expect(await warteschlange(seite)).toEqual(queue);
    expect(await zeilen(a.pool)).toBe(0);
    await abmelden(seite, basis, "A");
    expect(await warteschlange(seite), "O2: Abmelden hat As Queue behalten").toEqual([]);
    expect(await offlineFotos(seite), "O2: Abmelden hat As Foto behalten").toEqual([]);

    await anmelden(seite, basis, a.bEmail, "B");
    await zurMobilflaeche(seite, basis, "B");
    await abnahmeNachAbmeldung(seite, a, vorgangA, a.bId, "O2: Folgekonto B");
    await abmelden(seite, basis, "B");
    await anmelden(seite, basis, a.aEmail, "A erneut");
    await zurMobilflaeche(seite, basis, "A erneut");
    await abnahmeNachAbmeldung(seite, a, vorgangA, a.aId, "O2: erneut angemeldetes A");
    expect(anlageversuche, "O2: gelöschte Offlinearbeit wurde übertragen").toBe(0);
    const zeilenAmEnde = await zeilen(a.pool);
    expect(zeilenAmEnde).toBe(0);
    process.stderr.write(
      `${JOB} O2 ABMELDEGRENZE · A-Foto vor Abmeldung1 · danach leer · B/erneut A leer · POST0 · SQL0\n`,
    );
    return { vorgangA, fotosVorAbmeldung: fotos.length, anlageversuche, zeilenAmEnde };
  } finally {
    await kontext.unroute("**/api/drafts").catch(() => undefined);
    await kontext.close();
  }
}

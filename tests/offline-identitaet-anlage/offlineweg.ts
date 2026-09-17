// ================================================================================================
// JOB 4322 · DER OFFLINE-WEG ALS EINE STRECKE — PostgreSQL → Socket → gebaute Fläche → Chromium.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. JOB 4249 hat die Zusage gebaut („offline erfassen, Konto wechseln,
// genau einmal anlegen") und sie auf ZWEI Ebenen gemessen: die Kette in jsdom mit einer
// Transportbrücke auf `app.inject` (`kontowechsel-und-anlage-mounted.test.tsx:1`, `:12-13`) und den
// Serverriegel über `app.inject`. Der Prüfer hat die verbleibende Lücke selbst benannt
// (`archiv/4249/runde-8/ben.md:25`): „Der vollständige Chromium-/PostgreSQL-/HTTP-Nutzerweg bleibt
// in der Rückgabe offen." Genau dieser Weg steht hier — EINMAL, damit der Hauptfall und die
// Kalibrierungen nicht zwei Abläufe messen, die nur heute übereinstimmen (dieselbe Begründung wie
// im Kopf von `tests/gast-nutzerweg/browserweg.ts`).
//
// WAS HIER NICHT MEHR NACHGEBILDET IST — die Liste der Annahmen, die JOB 4249 noch machen musste:
//   · KEIN `app.inject`. Jede Anfrage läuft über einen echten Socket (`starteStrecke`), mit echten
//     Keksen eines echten Browserprofils.
//   · KEINE Speicherablage. `buildPgServices(pool)` — die Entwürfe landen in der Tabelle `drafts`
//     einer echten PostgreSQL, und dort wird nachgezählt.
//   · KEIN gemountetes Bauteil. Gemessen wird das GEBAUTE Bündel (`apps/web/dist`), ausgeliefert
//     von derselben `registerWebStatic`, die auch `server.ts` benutzt — einschliesslich des
//     Dienstarbeiters `apps/web/public/sw.js`, ohne den es kein Neuladen ohne Netz gäbe.
//   · KEIN gefälschtes `fetch` und kein gestellter Verbindungsmerker. Die Verbindung wird am
//     BrowserContext geschaltet (`Kontext.setOffline`, JOB 4322 additiv in `browserweg.ts`).
//
// ================================================================================================
// STATION (b) STEHT SO DA, WIE DER AUFTRAG SIE VERLANGT — auch wenn sie daran rot wird (R2).
// ================================================================================================
//
// RUNDE 1 HAT HIER DEN FEHLER GEMACHT, den BEN wörtlich benannt hat: „Erwartungen dürfen nicht auf
// das beobachtete Fehlverhalten umgestellt werden." Sie mass an Station (b) die ABWESENHEIT des
// Zählers und war damit grün — der Auftrag (§5 Lieferung 2(b)) verlangt aber seine SICHTBARKEIT
// („mob.queue · 1" nach dem Neuladen ohne Netz). Die Zusage steht ab R2 unverändert da; scheitert
// sie am unveränderten Produkt, ist der Fall ROT. Das ist das gewollte Messergebnis (Auftrag §4,
// §9) und keine Reparaturaufforderung: an Produktdateien wird nichts angefasst.
//
// WO DIE ZUSICHERUNG STEHT UND WARUM NICHT HIER. Der Befund wird in dieser Strecke GEMESSEN
// (Zähler, Anmeldemaske, Seitentext) und im Ergebnis zurückgegeben; zugesichert wird er in
// `offline-weg-pg-im-browser.integration.test.ts`. Zwei Gründe, beide zwingend:
//   1. Würfe die Strecke hier, liefen die Stationen (c) bis (e) in KEINEM Lauf mehr — die drei
//      Korrekturpflichten der Runde 1 wären damit unmessbar geworden. So wird der ganze Weg
//      gefahren, und der Fall endet trotzdem rot an genau dieser Zusage.
//   2. Die Kalibrierungen (`offline-weg-kalibrierung.integration.test.ts`) fahren dieselbe Strecke
//      und müssen an IHRER verstellten Station scheitern. Ein Wurf an (b) brächte sie alle an
//      derselben Stelle zu Fall, und der Kalibrierungsbeleg wäre wertlos.
//
// WAS DAS PRODUKT AN DIESER STELLE TUT, gemessen und nicht vermutet: `App.tsx:85` zeigt ohne
// bestätigte Sitzung die ANMELDEMASKE, und ohne Netz kann `/api/auth/me` nicht beantwortet werden —
// der Dienstarbeiter reicht API-Wege ausdrücklich durch und legt sie nicht in den Zwischenspeicher
// (`apps/web/public/sw.js:36`, `isApi(url) → return`). Die jsdom-Kette konnte das nicht sehen, weil
// sie `Mobile` OHNE dieses Tor montiert (`kontowechsel-und-anlage-mounted.test.tsx:291-356`) — sie
// misst die Fläche, nicht die Anwendung.
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
//     vorhin — bei Station (c) lag der gleiche Satz aus dem automatischen Lauf schon da), und
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
  /** Der Eigentümer des liegenden Vorgangs wird vor Station (c) auf Bs Kennung gefälscht. */
  eigentuemerAufB?: boolean;
  /** Station (d) erwartet absichtlich eine falsche Zeilenzahl nach der belegten Anlage. */
  erwarteteZeilenNachAnlage?: number;
  /** Vor Station (a) ausgeblendet (CSS-Selektor) — prüft die Sichtbarkeitszusage selbst. */
  ausblendenVorA?: string;
  /** Vor Station (c) ausgeblendet (CSS-Selektor). */
  ausblendenVorC?: string;
  /** Bs manueller Klick wird verschluckt (K5, BENs eigene Probe der Runde 1). */
  klickUnterdruecken?: boolean;
  /** Bs manueller Klick wirkt erst nach dieser Zeit (K6). */
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
 * sähe jeden Entwurf, und Station (c) wäre aus dem falschen Grund grün.
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

/**
 * Die Abnahme der Station (c) — dreimal unabhängig, und einmal davon ohne jede Fläche.
 *
 * Sie steht in einer eigenen Funktion, weil sie ZWEIMAL gilt: nach dem automatischen Lauf und nach
 * dem manuellen. Zwei abgeschriebene Blöcke wären zwei Aussagen, von denen eines Tages nur eine
 * nachgeführt würde.
 */
async function abnahmeVonC(
  seite: Seite,
  a: OfflineWegAufbau,
  vorgangA: string,
  wann: string,
): Promise<void> {
  // 1. DIE TABELLE. Das ist die Zahl, an der dieser Auftrag hängt — sie kommt zuerst, damit eine
  //    verstellte Voraussetzung HIER scheitert und nicht erst an einer Anzeige.
  expect(await zeilen(a.pool), `Station (c) ${wann}: As Vorgang wurde als B angelegt`).toBe(0);
  // 2. DER EIGENE LESEWEG VON B, mit Bs echten Keksen, aus der Seite heraus — kein Blick des
  //    Prüfstands, sondern der Blick, den B selbst hat.
  const bSicht = await seite.evaluate<{ status: number; rumpf: string }>(
    fn(`() => fetch("/api/drafts", { credentials: "include" })
      .then((r) => r.text().then((t) => ({ status: r.status, rumpf: t })))
      .catch((e) => ({ status: -1, rumpf: String(e) }))`),
  );
  expect(
    bSicht.status,
    `Station (c) ${wann}: GET /api/drafts als B antwortete ${bSicht.rumpf.slice(0, 300)}`,
  ).toBe(200);
  expect(
    JSON.parse(bSicht.rumpf) as unknown[],
    `Station (c) ${wann}: B sieht Entwürfe, obwohl keiner angelegt sein darf`,
  ).toEqual([]);
  // 3. UND NICHTS WURDE STILL WEGGEWORFEN: As Vorgang liegt unverändert da, mit A als Eigentümer.
  const nachB = await warteschlange(seite);
  expect(
    nachB.map((v) => ({ id: v.id, eigentuemer: v.eigentuemer })),
    `Station (c) ${wann}: As Vorgang wurde gelöscht oder umgehängt`,
  ).toEqual([{ id: vorgangA, eigentuemer: a.aId }]);
  const bText = await seite.evaluate<string>(fn("() => document.body.innerText"));
  expect(bText, `Station (c) ${wann}: B sieht den Entwurfstitel von A`).not.toContain(a.titelA);
  // 4. UND NICHTS WURDE ALS ERFOLG GEMELDET. Ein „synchronisiert (1)" in Bs Sitzung hiesse, dass
  //    doch etwas hinausgegangen ist — die Zahlen oben sagten es dann zwar auch, aber der Mensch
  //    liest zuerst diesen Satz.
  await meldungDarfNichtKommen(
    seite,
    i18n.t("mob.syncOk"),
    `Station (c) ${wann}: B wurde ein erfolgreicher Versand gemeldet`,
  );
}

// ================================================================================================
// DER GANZE WEG — (a) bis (e), in EINEM Browserprofil, an EINER Instanz, gegen EINE Datenbank.
// ================================================================================================
export async function fahreDenOfflineWeg(a: OfflineWegAufbau): Promise<OfflineWegBefund> {
  const verstellen = a.verstellen ?? {};
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

    // ══ (c) A meldet sich ab, B meldet sich an — dasselbe Browserprofil, unveränderter Speicher. ═
    //
    // ZUERST WEG VON `/mobile`, DANN ERST DAS NETZ. Abmelden braucht eine Verbindung; käme sie,
    // während `Mobile` montiert ist, sendete A seinen eigenen Vorgang sofort selbst (F-0027), und
    // der ganze folgende Fall wäre aus dem falschen Grund grün. Der Weg ist deshalb genau der, den
    // der Fall beschreibt: A legt das Gerät aus der Hand, und erst danach ist wieder Netz da.
    await seite.goto(`${basis}${STARTSEITE}`, { waitUntil: "domcontentloaded" });
    await netz(kontext, seite, true);
    expect(
      (await warteschlange(seite)).length,
      "Station (c): der Vorgang ging schon vor dem Kontowechsel hinaus",
    ).toBe(1);
    expect(
      await zeilen(a.pool),
      "Station (c): vor dem Kontowechsel ist etwas angelegt worden",
    ).toBe(0);

    if (verstellen.eigentuemerAufB) {
      // KALIBRIERUNG (Lieferung 3): Hätte der liegende Vorgang Bs Kennung, hätte der Riegel nichts
      // mehr zu greifen — Station (c) MUSS daran scheitern.
      await seite.evaluate<boolean>(
        fn(`([k, b]) => {
          const liste = JSON.parse(localStorage.getItem(k) || "[]");
          for (const op of liste) { op.eigentuemer = b; }
          localStorage.setItem(k, JSON.stringify(liste));
          return true;
        }`),
        [SCHLUESSEL, a.bId],
      );
    }

    await abmelden(seite, basis, "A");
    await anmelden(seite, basis, a.bEmail, "B");
    await zurMobilflaeche(seite, basis, "B");
    if (verstellen.ausblendenVorC) {
      await ausblenden(seite, verstellen.ausblendenVorC);
    }
    // ── (c1) DER AUTOMATISCHE LAUF. ─────────────────────────────────────────────────────────────
    //
    // Er ist mit dem Aufbau dieser Fläche schon losgelaufen (Aufbau-Anlauf, F-0027). Gewartet wird
    // deshalb auf seine MELDUNG und nicht auf eine geratene Zeitspanne: erst wenn er sich geäussert
    // hat, sagt „null Zeilen" etwas — vorher wäre es nur die Ausgangslage.
    //
    // UND DIE SACHLICHE ABNAHME KOMMT VOR DER ANZEIGE. Sonst brächte eine verstellte Voraussetzung
    // den Fall an einem Knopf zu Fall („steht nicht bereit") statt an der Zusage („As Vorgang wurde
    // als B angelegt") — gemessen in Kalibrierung K1, Arbeitsprüfung 2f9229b3ab71.
    await warte(
      seite,
      "() => (window.__kwMeldungen || []).length > 0",
      "Station (c): der automatische Sendelauf hat sich gemeldet",
      undefined,
      45_000,
    );
    await abnahmeVonC(seite, a, vorgangA, "nach dem AUTOMATISCHEN Lauf");
    // Die Fläche sagt B, dass hier etwas Fremdes liegt — eine ZAHL, kein fremder Titel.
    await mussSichtbarSein(
      seite,
      '[data-testid="mob-fremde-vorgaenge"]',
      `${i18n.t("mob.konto.fremdeWarten")} (1)`,
      "Station (c): die Zeile über fremde Vorgänge",
    );
    await meldungMussKommen(
      seite,
      `${i18n.t("mob.konto.fremdeNichtGesendet")} (1)`,
      "Station (c): die Auskunft, warum nichts hinausging",
    );

    // ── (c2) UND DER MANUELLE LAUF — derselbe Knopf, den ein Mensch drückt. ──────────────────────
    //
    // ER IST ERST DANN GELAUFEN, WENN ER SICH NEU GEMELDET HAT. `syncNow().then(notifySync)`
    // (`Mobile.tsx:989`) meldet Bs Lauf mit demselben Satz wie der automatische — deshalb zählt
    // nicht sein Vorhandensein, sondern dass eine WEITERE Meldung dieses Satzes dazugekommen ist,
    // nach dem Zeitpunkt des Klicks. Erst danach sagen Tabelle, Leseweg und Speicher etwas über
    // DIESEN Lauf (BEN, Korrekturpflicht 2; K5/K6 belegen, dass ein ausgefallener oder verspäteter
    // Klick hier rot wird).
    const manuell = await manuellSynchronisieren(
      seite,
      `${i18n.t("mob.konto.fremdeNichtGesendet")} (1)`,
      "Station (c): Bs manueller Lauf",
      verstellen,
    );
    expect(
      manuell.zeit,
      "Station (c): die Rückmeldung des manuellen Laufs trägt keinen Zeitstempel",
    ).toBeGreaterThan(0);
    await abnahmeVonC(seite, a, vorgangA, "nach dem MANUELLEN Lauf");

    // ══ (d) + (e) B ab, A an, online — DERSELBE Vorgang aus (a) geht hinaus, genau einmal. ═════
    //
    // ================================================================================================
    // EIN VORGANG DURCH ALLE STATIONEN — die dritte Korrekturpflicht der Runde 1.
    // ================================================================================================
    //
    // RUNDE 1 HAT (e) AN EINEM ZWEITEN, NEU ERFASSTEN VORGANG GEMESSEN. BEN wörtlich: „Der Vorgang
    // mit Kontowechsel ist bereits erfolgreich abgeschlossen. Gemessen werden zwei Zeilen, statt
    // derselbe Vorgang durch Kontowechsel, Antwortverlust und Wiederholung mit insgesamt einer
    // Zeile." Damit war die Wiederholungssicherheit an einem Vorgang gemessen, der den Kontowechsel
    // nie gesehen hatte — also nicht an der Zusage des Auftrags (§1: „der Entwurf wird genau einmal
    // angelegt, auch wenn die erste Serverantwort verloren geht; in der Datenbank steht eine Zeile").
    //
    // AB R2 IST ES EIN EINZIGER VORGANGSSCHLÜSSEL, `vorgangA`, von (a) bis hierher: offline erfasst,
    // über das Neuladen getragen, durch den Kontowechsel liegen geblieben, jetzt angelegt — und die
    // Antwort darauf geht verloren, NACHDEM der Server geschrieben hat. Die Endzahl in `drafts` ist
    // 1 und nicht 2.
    //
    // DIE WEICHE STEHT VOR AS RÜCKKEHR, denn der Sendelauf beginnt mit dem Aufbau der Fläche
    // (F-0027). Sie greift nur an POST; Bs Leseweg und As Bestandsabfragen laufen durch.
    //
    // WAS DER AUFTRAG AN (d) WÖRTLICH NOCH VERLANGT — „die Fläche zeigt den Erfolg (kein
    // mob.syncFail)" — gilt hier für den ABSCHLUSS und nicht für den ersten Versuch: Eine Antwort,
    // die absichtlich weggeworfen wird, MUSS der Mensch als Fehlversuch angezeigt bekommen, sonst
    // verschwiege die Fläche einen unbekannten Ausgang. Gemessen wird deshalb beides: in As
    // zurückgekehrter Sitzung genau EIN Fehlervermerk — der herbeigeführte — und die sichtbare
    // Erfolgsmeldung am Ende. (Der Meldungsbeobachter beginnt mit jedem Dokument neu, die Zählung
    // gilt also für das Dokument, in dem beide Versuche stattfinden.)
    // Die Zusammenlegung ist die Anweisung der Steuerung (HINWEIS Punkt 3) und in der Rückgabe als
    // Abweichung vom Wortlaut des Auftrags benannt.
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

    await abmelden(seite, basis, "B");
    await anmelden(seite, basis, a.aEmail, "A");
    await zurMobilflaeche(seite, basis, "A");

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
    // Kontowechsel überstanden hat — und er trägt As Kennung als Voraussetzung mit.
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
      "Station (e): in As zurückgekehrter Sitzung gab es nicht genau den EINEN herbeigeführten Fehlervermerk",
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

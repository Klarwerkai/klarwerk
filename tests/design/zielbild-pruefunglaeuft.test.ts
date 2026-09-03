// ================================================================================================
// JOB 3016 · D3 „PRUEFUNG LAEUFT“ — DIE LADEKARTE, AM ECHTEN PANEL IN CHROMIUM GEMESSEN.
// ================================================================================================
//
// PEDIS FRAGE: „Sieht der Mensch in Word waehrend der Suche das, was ich gezeichnet habe — eine
// ruhige weisse Karte mit drei Balken und einem Satz darunter? Und stimmt der Satz?“
//
// WAS DIESE DATEI TUT:
//   · Sie laedt das AUSGELIEFERTE Aufgabenfenster (`apps/web/public/word-addin/taskpane.html`, die
//     buildlose Datei selbst — es gibt keinen zweiten Quelltext) in einem echten Chromium ueber
//     Playwright, unter `http://klarwerk.test/word-addin/taskpane.html`, im Viewport des Zielbilds
//     (360 px breit). Jeder `/api/*`-Abruf wird beantwortet wie in der Panel-Fixture; der EINE
//     `POST /api/ask` wird OFFEN GEHALTEN, bis die Messung fertig ist. Damit steht das Fenster genau
//     im Wartezustand — zwischen Absenden und Ergebnis.
//   · Sie vergleicht JE WERT aus `WERTE_FRAGEWEG_PRUEFUNG` (tools/design-vergleich/werte.ts) den
//     Sollwert aus `PruefungLaeuft.dc.html` mit dem WIRKSAMEN Wert am realen Element
//     (`getComputedStyle`). Der Selektor jedes Messpunkts wird zu einem CSS-Pfad aufgeloest und
//     rueckwaerts geprueft — der Pfad muss dasselbe Element liefern. Selektor, Pfad, Sollwert, Istwert
//     und Quelle stehen je Wert im Protokoll.
//   · Sie belegt die Sperre am Verhalten: waehrend der Suche nimmt das Eingabefeld keine Tastatur-
//     eingabe an (Chromium-Tastatur, nicht `dispatchEvent`), und nach dem Ende der Suche ist es
//     wieder frei (fail-open).
//   · Sie geht den WORD-Weg (Runde 4, BEN): ein Office-Stummel in der Form der Panel-Fixture
//     liefert `getSelectedDataAsync`; im Fall D wird der Rueckruf festgehalten und zweimal echt
//     geklickt — es darf genau ein Rueckruf und genau ein `POST /api/ask` entstehen, und kein
//     frueher Ausgang darf Karte oder Sperre aufheben, solange der Ask offen ist.
//
// DIE MESSSTRECKE (Auftrag §3): eine Chromium-Panelmessstrecke aus JOB 3004 liegt in `tests/design/`
// NICHT vor (die einzigen Playwright-Laeufe im Baum messen die Validierungsseite:
// `zielbild-validierung.test.ts`, `job2935-validierung-fussband.test.ts`). Gebaut ist deshalb — wie
// der Auftrag es fuer diesen Fall vorschreibt — die Strecke aus `zielbild-validierung.test.ts`:
// Playwright-Route statt Server, Sollwerte ohne Renderer kanonisiert (Hex → `rgb(r, g, b)`),
// Selektor als Beleg, ein Vergleich je Wert. Sie ist bewusst so geschnitten, dass D1/D2/D4
// dasselbe Panel damit messen koennen, statt eine zweite zu bauen.
//
// KEIN OFFENER WERT (Runde 2, BEN): jeder aus dem Zielbild gelesene Wert hat hier eine
// fehlschlagende Assertion — auch die Aussenabstaende von Karte und Satz (Z.26/Z.32) und
// `display: flex` der Karte. Ein Wert, der nur protokolliert wuerde, machte den Lauf nicht rot
// und waere damit keine Messung.
//
// KALIBRIERUNG GEGEN DEN STILLEN NULL-TREFFER (Auftrag §6): gemessen wird erst, wenn der Ask-Fetch
// WIRKLICH abgegangen und noch offen ist; die Messung muss innerhalb der Panel-Frist (15 000 ms)
// liegen; jeder Messpunkt muss ein Element treffen. Fehlt eines davon, ist der Lauf rot — kein
// „0 von 0 gruen“.
//
// SCHNITTPUNKT MIT DER jsdom-MESSUNG (`zielbild-pruefunglaeuft-messung.test.ts`, JOB 3012): dort
// werden Struktur, Text, Sperre und Uebergangskanten am laufenden Rumpf gemessen; reine
// Darstellungswerte tragen dort „nicht messbar in jsdom“ und werden HIER gemessen. Kein Wert steht
// in beiden Dateien als Vergleich — eine Wahrheit je Wert.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WERTE_FRAGEWEG_PRUEFUNG } from "../../tools/design-vergleich/werte";

const WURZEL = resolve(process.cwd());
const PANEL_DATEI = join(WURZEL, "apps/web/public/word-addin/taskpane.html");
const ZIELBILD =
  "/Users/peterkohnert/Documents/Projekt_klarwerk/DESIGN_ZIELBILD_20260827/PruefungLaeuft.dc.html";
const ORIGIN = "http://klarwerk.test";
const PANEL_URL = `${ORIGIN}/word-addin/taskpane.html`;
/** Die Frage aus dem Zielbild (Z.23) — dieselbe Frage geht hier durch das echte Panel. */
const FRAGE = "Welche Profile sind in Spritzzonen erlaubt?";
/** Die Panel-Frist (taskpane.html: WORD_ADDIN_ASK_TIMEOUT_MS) — die Messung muss davor liegen. */
const PANEL_FRIST_MS = 15_000;

// ---- Sollwerte: ohne Renderer kanonisiert (dieselbe Form wie zielbild-validierung.test.ts) ------
function hexZuRgb(hex: string): string {
  const h = hex.length === 4 ? hex.replace(/[0-9a-f]/gi, (c) => c + c) : hex;
  const r = Number.parseInt(h.slice(1, 3), 16);
  const g = Number.parseInt(h.slice(3, 5), 16);
  const b = Number.parseInt(h.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}
function kanon(wert: string | null): string | null {
  if (wert === null) {
    return null;
  }
  return (
    wert
      .replace(/\s+/g, " ")
      .trim()
      .replace(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi, (m) => hexZuRgb(m))
      // Eine nackte `0` in einer Kurzschreibweise (Zielbild `14px 16px 0`) serialisiert der
      // Browser als `0px` — dieselbe Laenge, eine Schreibweise.
      .replace(/(^|\s)0(?=\s|$)/g, "$10px")
      .toLowerCase()
  );
}
/** Innentext des ersten Elements, dessen style-Attribut `anker` enthaelt (Zielbild-Satz Z.32). */
function innentext(z: string, anker: string): string | null {
  const re = /<div style="([^"]*)">([^<]*)<\/div>/g;
  for (let m = re.exec(z); m !== null; m = re.exec(z)) {
    if ((m[1] ?? "").includes(anker)) {
      return (m[2] ?? "").trim();
    }
  }
  return null;
}

// ---- Playwright, schmal typisiert (der Gate-tsc hat keine DOM-lib) --------------------------------
type BrowserFn = (arg: unknown) => unknown;
const fn = (quelle: string): BrowserFn =>
  new Function("arg", `return (${quelle})(arg);`) as BrowserFn;

interface Route {
  request(): { url(): string; method(): string };
  fulfill(r: {
    status: number;
    body?: string | Buffer;
    contentType?: string;
    headers?: Record<string, string>;
  }): Promise<void>;
}
interface Seite {
  route(url: string, handler: (route: Route) => Promise<void>): Promise<void>;
  addInitScript(script: string): Promise<void>;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(fn: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: BrowserFn, arg?: unknown): Promise<T>;
  keyboard: { type(text: string): Promise<void> };
}
interface Browser {
  version(): string;
  newPage(opts: Record<string, unknown>): Promise<Seite>;
  close(): Promise<void>;
}

// ---- Die Messpunkte, aus der Werte-Tabelle gelesen ----------------------------------------------
interface Messpunkt {
  name: string;
  selektor: string;
  eigenschaft: string;
}
const MESSPUNKTE: Messpunkt[] = WERTE_FRAGEWEG_PRUEFUNG.map((w) => ({
  name: w.name,
  selektor: w.messpunkt?.selektor ?? "",
  eigenschaft: w.messpunkt?.eigenschaft ?? "",
}));

/** In der Seite: CSS-Pfad eines Elements (nth-child-Kette bis body) — der Selektor als Beleg. */
const PFAD_FN = `(el) => {
  const teile = [];
  let e = el;
  while (e && e.nodeType === 1 && e !== document.body) {
    const p = e.parentElement;
    const i = Array.prototype.indexOf.call(p.children, e) + 1;
    teile.unshift(e.tagName.toLowerCase() + ':nth-child(' + i + ')');
    e = p;
  }
  return 'body > ' + teile.join(' > ');
}`;

/**
 * In der Seite: je Messpunkt das reale Element, sein rueckwaerts gepruefter Pfad und der wirksame
 * Wert. Bei `width` zusaetzlich der Anteil an der Inhaltsbreite des Elternelements — ein Prozentwert
 * des Zielbilds loest der Browser zu Pixeln auf, verglichen wird deshalb der Anteil.
 */
const MESSEN = `([punkte, pfadFnSrc]) => {
  const pfad = eval('(' + pfadFnSrc + ')');
  return punkte.map((p) => {
    const el = p.selektor ? document.querySelector(p.selektor) : null;
    if (!el) return { name: p.name, fehlt: true, treffer: 0, pfad: null, aufgeloest: false, wert: null, prozent: null };
    const weg = pfad(el);
    const cs = getComputedStyle(el);
    let prozent = null;
    if (p.eigenschaft === 'width' && el.parentElement) {
      const eltern = el.parentElement;
      const ecs = getComputedStyle(eltern);
      const innen = eltern.clientWidth - parseFloat(ecs.paddingLeft) - parseFloat(ecs.paddingRight);
      prozent = innen > 0 ? (el.getBoundingClientRect().width / innen) * 100 : null;
    }
    return {
      name: p.name,
      fehlt: false,
      treffer: document.querySelectorAll(p.selektor).length,
      pfad: weg,
      aufgeloest: document.querySelector(weg) === el,
      wert: cs.getPropertyValue(p.eigenschaft),
      prozent,
    };
  });
}`;

/** In der Seite: der Zustand, den ein Mensch sieht — Karte, Satz, Status, Sperren, Frage. */
const ZUSTAND = `() => {
  const sichtbar = (sel) => {
    let e = document.querySelector(sel);
    if (!e) return null;
    while (e && e !== document.body) {
      if (getComputedStyle(e).display === 'none') return false;
      e = e.parentElement;
    }
    return true;
  };
  const text = (sel) => { const e = document.querySelector(sel); return e ? (e.textContent || '').trim() : null; };
  const disabled = (sel) => { const e = document.querySelector(sel); return e ? e.disabled === true : null; };
  const karte = document.querySelector('#ask-ladekarte');
  const satz = document.querySelector('#ask-ladekarte-satz');
  const kr = karte ? karte.getBoundingClientRect() : null;
  const sr = satz ? satz.getBoundingClientRect() : null;
  // Die Inhaltskante des Panels: Body-Rand plus Body-Polsterung — davon zaehlt das Zielbild die
  // 16px der Karte und des Satzes (Z.26/Z.32).
  const bcs = getComputedStyle(document.body);
  const br = document.body.getBoundingClientRect();
  const inhaltLinks = br.left + parseFloat(bcs.paddingLeft);
  const inhaltRechts = br.right - parseFloat(bcs.paddingRight);
  return {
    karteAbstandLinks: kr ? kr.left - inhaltLinks : null,
    karteAbstandRechts: kr ? inhaltRechts - kr.right : null,
    satzAbstandLinks: sr ? sr.left - inhaltLinks : null,
    satzAbstandRechts: sr ? inhaltRechts - sr.right : null,
    ladekarteSichtbar: sichtbar('#ask-ladekarte'),
    satzSichtbar: sichtbar('#ask-ladekarte-satz'),
    satzText: text('#ask-ladekarte-satz'),
    statusSichtbar: sichtbar('#ask-status'),
    statusText: text('#ask-status'),
    balken: document.querySelectorAll('#ask-ladekarte > .ladebalken').length,
    eingabeGesperrt: disabled('#ask-input'),
    knopfGesperrt: disabled('#ask-btn'),
    eingabeWert: (document.querySelector('#ask-input') || {}).value || '',
  };
}`;

interface Messwert {
  name: string;
  fehlt: boolean;
  treffer: number;
  pfad: string | null;
  aufgeloest: boolean;
  wert: string | null;
  prozent: number | null;
}
interface Zustand {
  ladekarteSichtbar: boolean | null;
  satzSichtbar: boolean | null;
  satzText: string | null;
  statusSichtbar: boolean | null;
  statusText: string | null;
  balken: number;
  eingabeGesperrt: boolean | null;
  knopfGesperrt: boolean | null;
  eingabeWert: string;
  karteAbstandLinks: number | null;
  karteAbstandRechts: number | null;
  satzAbstandLinks: number | null;
  satzAbstandRechts: number | null;
}

/**
 * Runde 4 (BEN): der WORD-WEG ist asynchron — zwischen Klick und Wartezustand liegt der
 * Auswahlrueckruf von `getSelectedDataAsync`. Dieser Office-Stummel hat die Form der Panel-Fixture
 * (onReady, CoercionType, AsyncResultStatus, context.document.getSelectedDataAsync) und antwortet
 * sofort leer — ausser `__kwHalten` steht: dann wird der Rueckruf festgehalten wie bei einem
 * langsamen Word, und der Test liefert ihn selbst nach. Er wird VOR dem ersten Skript der Seite
 * eingespielt (addInitScript); office.js selbst wird nicht geladen (leere Antwort in der Route).
 */
const OFFICE_STUMMEL = `
  window.__kwRueckrufe = [];
  window.__kwHalten = false;
  window.__kwWerfen = false;
  window.Office = {
    onReady: function (cb) { cb(); },
    CoercionType: { Html: "html", Text: "text" },
    AsyncResultStatus: { Succeeded: "succeeded", Failed: "failed" },
    context: { document: { getSelectedDataAsync: function (typ, cb) {
      if (window.__kwWerfen) { throw new Error("Office kaputt"); }
      if (window.__kwHalten) { window.__kwRueckrufe.push(cb); return; }
      cb({ status: "succeeded", value: "" });
    } } }
  };`;

/** Runde 5: der Auswahlrueckruf bleibt AUS — die Auswahlfrist des Panels muss freigeben. */
interface Auswahlkante {
  /** Zeit vom Klick bis zur Freigabe durch die Panel-Frist (echte Zeit, keine gefaelschte Uhr). */
  dauerMs: number;
  askWaehrend: number;
  nachFrist: Zustand;
  /** Der verspaetete Rueckruf, nach der Frist geliefert — er darf nichts mehr bewirken. */
  verspaetetGeliefert: number;
  askNachVerspaetet: number;
  nachVerspaetet: Zustand;
  /** Der naechste Klick: genau ein Ask. */
  askNachNeuklick: number;
  ausgang: Zustand;
}
/** Runde 5: getSelectedDataAsync wirft SYNCHRON. */
interface Werfen {
  sofort: Zustand;
  askWaehrend: number;
  askNachNeuklick: number;
  ausgang: Zustand;
}
/** Runde 6: die Gesamtfrist — Rueckruf spaet, Fetch offen; frei spaetestens 15 s nach dem Klick. */
interface Gesamtfrist {
  /** Wann (ms nach dem Klick) der Auswahlrueckruf geliefert wurde. */
  rueckrufNachMs: number;
  /** POSTs, die der spaete Rueckruf ausgeloest hat (soll 1). */
  askNachRueckruf: number;
  /** Zeit vom Klick bis zur Freigabe (echte Zeit). */
  freiNachMs: number;
  nachFrist: Zustand;
  askNachFrist: number;
  askNachNeuklick: number;
  ausgang: Zustand;
}

/** Was unmittelbar nach dem ersten und nach dem zweiten Klick steht — VOR jedem Auswahlrueckruf. */
interface Sofort {
  rueckrufe: number;
  knopfGesperrt: boolean;
  eingabeGesperrt: boolean;
  karteSichtbar: boolean;
  rueckrufeNachZweitem: number;
}
interface Doppelklick extends Sofort {
  geliefert: number;
  askAbgegangen: number;
  warten: Zustand;
  ausgang: Zustand;
}

// ---- Der Lauf --------------------------------------------------------------------------------------
let browser: Browser | null = null;
let seite: Seite | null = null;
let fehler: string | null = null;
let version = "";
let askAbgegangen = 0;
let askOffen = false;
let freigeben: () => void = () => undefined;
let gemessenNachMs = -1;
let messwerte: Messwert[] = [];
let warten: Zustand | null = null;
let tippversuchWert = "";
let ausgang: Zustand | null = null;
/** Wie viele Asks die ERSTE Phase (ein Klick) abgesetzt hat — die Doppelklick-Phase zaehlt eigen. */
let askErstePhase = 0;
let doppel: Doppelklick | null = null;
let kante: Auswahlkante | null = null;
let werfen: Werfen | null = null;
let gesamt: Gesamtfrist | null = null;

const zielbildDa = existsSync(ZIELBILD);
const ziel = zielbildDa ? readFileSync(ZIELBILD, "utf8") : "";

function json(
  status: number,
  body: unknown,
): { status: number; body: string; contentType: string } {
  return { status, body: JSON.stringify(body), contentType: "application/json" };
}

async function warteBis(bedingung: () => boolean, fristMs: number, was: string): Promise<void> {
  const start = Date.now();
  while (!bedingung()) {
    if (Date.now() - start > fristMs) {
      throw new Error(`Frist abgelaufen: ${was}`);
    }
    await new Promise<void>((r) => setTimeout(r, 25));
  }
}

describe.runIf(zielbildDa)(
  "JOB 3016 · D3 · PruefungLaeuft — die Ladekarte am echten Panel in Chromium, ein Vergleich je Wert",
  () => {
    beforeAll(async () => {
      try {
        const panelHtml = readFileSync(PANEL_DATEI);
        const require = createRequire(import.meta.url);
        const { chromium } = require("playwright") as {
          chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
        };
        browser = await chromium.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
        });
        version = browser.version();
        // Der Viewport des Zielbilds (PruefungLaeuft.dc.html Z.15: 360 x 720).
        seite = await browser.newPage({ viewport: { width: 360, height: 720 } });
        await seite.route("**/*", async (route) => {
          const req = route.request();
          const url = new URL(req.url());
          if (url.origin !== ORIGIN) {
            // office.js: nicht geladen — `window.Office` kommt aus OFFICE_STUMMEL (Runde 4), damit
            // das Panel den WORD-Weg geht (readAskSelection ueber getSelectedDataAsync).
            await route.fulfill({ status: 200, body: "", contentType: "application/javascript" });
            return;
          }
          if (url.pathname === "/word-addin/taskpane.html") {
            await route.fulfill({
              status: 200,
              body: req.method() === "HEAD" ? "" : panelHtml,
              contentType: "text/html; charset=utf-8",
            });
            return;
          }
          if (url.pathname === "/api/ask" && req.method() === "POST") {
            askAbgegangen += 1;
            askOffen = true;
            await new Promise<void>((r) => {
              freigeben = r;
            });
            askOffen = false;
            try {
              await route.fulfill(
                json(200, { result: { answered: false, answer: null, sources: [] } }),
              );
            } catch {
              // Die Seite hat den Abruf inzwischen abgebrochen (Frist) — dann gibt es nichts mehr
              // zu beantworten.
            }
            return;
          }
          if (url.pathname === "/api/auth/me") {
            await route.fulfill(json(200, { name: "Pedi" }));
            return;
          }
          if (url.pathname === "/api/reasoner/status") {
            await route.fulfill(
              json(200, { active: false, mode: "deterministic", reachable: "ok", tasks: {} }),
            );
            return;
          }
          await route.fulfill(json(404, {}));
        });
        await seite.addInitScript(OFFICE_STUMMEL);
        await seite.goto(PANEL_URL, { waitUntil: "load", timeout: 60_000 });
        // Angemeldet und fragbereit: der Knopf ist frei, sobald /api/auth/me beantwortet ist.
        await seite.waitForFunction(
          fn(
            `() => { const b = document.querySelector('#ask-btn'); return !!b && b.disabled === false; }`,
          ),
          undefined,
          { timeout: 30_000 },
        );
        // Die Frage des Zielbilds eintippen und absenden — ueber den echten Knopf.
        await seite.evaluate(
          fn(`(frage) => {
            const i = document.querySelector('#ask-input');
            i.value = frage;
            i.dispatchEvent(new Event('input'));
            document.querySelector('#ask-btn').click();
          }`),
          FRAGE,
        );
        const abgeschickt = Date.now();
        await warteBis(() => askAbgegangen === 1, 10_000, "POST /api/ask ist nicht abgegangen");
        // Jetzt steht das Fenster im Wartezustand. Alles Weitere wird in EINEM Zug gemessen.
        warten = await seite.evaluate<Zustand>(fn(ZUSTAND));
        messwerte = await seite.evaluate<Messwert[]>(fn(MESSEN), [MESSPUNKTE, PFAD_FN]);
        // Tastatur statt dispatchEvent: fokussieren (ein gesperrtes Feld nimmt keinen Fokus) und
        // tippen — nimmt das Feld die Zeichen an, ist die Sperre nur behauptet.
        await seite.evaluate(fn(`() => { document.querySelector('#ask-input').focus(); }`));
        await seite.keyboard.type(" Und in Trockenzonen?");
        tippversuchWert = await seite.evaluate<string>(
          fn(`() => document.querySelector('#ask-input').value`),
        );
        gemessenNachMs = Date.now() - abgeschickt;
        const nochOffen = askOffen && askAbgegangen === 1;
        if (!nochOffen) {
          throw new Error("der Ask-Fetch war waehrend der Messung nicht mehr offen");
        }
        // Der Ausgang: die Luecke kommt, die Karte geht, das Feld ist wieder frei (fail-open).
        freigeben();
        await seite.waitForFunction(
          fn(
            `() => { const k = document.querySelector('#ask-ladekarte'); const i = document.querySelector('#ask-input'); return (!k || getComputedStyle(k).display === 'none') && !!i && i.disabled === false; }`,
          ),
          undefined,
          { timeout: 10_000 },
        );
        ausgang = await seite.evaluate<Zustand>(fn(ZUSTAND));
        askErstePhase = askAbgegangen;
        console.info(
          `JOB 3016 D3 · Chromium ${version} · ${PANEL_URL} · Viewport 360x720 · Ask abgegangen ${askAbgegangen} · gemessen ${gemessenNachMs} ms nach dem Absenden (Frist ${PANEL_FRIST_MS} ms)`,
        );
        // ---- Runde 4 (BEN): der Word-Weg mit FESTGEHALTENEM Auswahlrueckruf und zwei echten
        //      Klicks. Bis Runde 3 startete der zweite Klick in dieser Luecke einen zweiten Lauf.
        const askVorher = askAbgegangen;
        const sofort = await seite.evaluate<Sofort>(
          fn(`() => {
            window.__kwHalten = true;
            const b = document.querySelector('#ask-btn');
            const i = document.querySelector('#ask-input');
            const k = document.querySelector('#ask-ladekarte');
            b.click();
            const nachErstem = {
              rueckrufe: window.__kwRueckrufe.length,
              knopfGesperrt: b.disabled,
              eingabeGesperrt: i.disabled,
              karteSichtbar: getComputedStyle(k).display !== 'none',
            };
            b.click();
            return Object.assign(nachErstem, { rueckrufeNachZweitem: window.__kwRueckrufe.length });
          }`),
        );
        await new Promise<void>((r) => setTimeout(r, 150));
        const geliefert = await seite.evaluate<number>(
          fn(
            `() => { window.__kwHalten = false; const r = window.__kwRueckrufe.splice(0); r.forEach((cb) => cb({ status: 'succeeded', value: '' })); return r.length; }`,
          ),
        );
        await warteBis(
          () => askAbgegangen >= askVorher + 1,
          10_000,
          "nach dem Doppelklick ist kein POST /api/ask abgegangen",
        );
        // Zeit fuer einen etwaigen zweiten Abruf — der darf nicht kommen.
        await new Promise<void>((r) => setTimeout(r, 300));
        const warten2 = await seite.evaluate<Zustand>(fn(ZUSTAND));
        const askDanach = askAbgegangen - askVorher;
        freigeben();
        await seite.waitForFunction(
          fn(
            `() => { const k = document.querySelector('#ask-ladekarte'); const i = document.querySelector('#ask-input'); return (!k || getComputedStyle(k).display === 'none') && !!i && i.disabled === false; }`,
          ),
          undefined,
          { timeout: 10_000 },
        );
        const ausgang2 = await seite.evaluate<Zustand>(fn(ZUSTAND));
        doppel = {
          ...sofort,
          geliefert,
          askAbgegangen: askDanach,
          warten: warten2,
          ausgang: ausgang2,
        };
        console.info(
          `JOB 3016 D3 · Runde 4 · Doppelklick im Word-Weg: Auswahlrueckrufe nach 1./2. Klick ${sofort.rueckrufe}/${sofort.rueckrufeNachZweitem} · sofort gesperrt Knopf ${sofort.knopfGesperrt} Feld ${sofort.eingabeGesperrt} Karte ${sofort.karteSichtbar} · geliefert ${geliefert} · POST /api/ask ${askDanach} · waehrend offen: Karte ${warten2.ladekarteSichtbar} Feld gesperrt ${warten2.eingabeGesperrt} · danach frei ${ausgang2.eingabeGesperrt === false}`,
        );
        const FREI = `() => { const k = document.querySelector('#ask-ladekarte'); const i = document.querySelector('#ask-input'); return (!k || getComputedStyle(k).display === 'none') && !!i && i.disabled === false; }`;
        const LIEFERN = `() => { const r = window.__kwRueckrufe.splice(0); r.forEach((cb) => cb({ status: 'succeeded', value: '' })); return r.length; }`;
        // ---- Runde 5 (BEN), Kante 1: der Auswahlrueckruf BLEIBT AUS. Die Auswahlfrist des Panels
        //      (WORD_ADDIN_ASK_TIMEOUT_MS) muss freigeben — in ECHTER Zeit gemessen, ohne Uhr-Fake.
        const kanteVorher = askAbgegangen;
        const klick = Date.now();
        await seite.evaluate(
          fn(`() => { window.__kwHalten = true; document.querySelector('#ask-btn').click(); }`),
        );
        await seite.waitForFunction(fn(FREI), undefined, { timeout: PANEL_FRIST_MS + 10_000 });
        const dauerMs = Date.now() - klick;
        const nachFrist = await seite.evaluate<Zustand>(fn(ZUSTAND));
        const askWaehrend = askAbgegangen - kanteVorher;
        // Der verspaetete Rueckruf — nach der Frist geliefert.
        const verspaetetGeliefert = await seite.evaluate<number>(fn(LIEFERN));
        await new Promise<void>((r) => setTimeout(r, 300));
        const askNachVerspaetet = askAbgegangen - kanteVorher;
        const nachVerspaetet = await seite.evaluate<Zustand>(fn(ZUSTAND));
        // Der naechste Klick — Word antwortet wieder sofort.
        await seite.evaluate(
          fn(`() => { window.__kwHalten = false; document.querySelector('#ask-btn').click(); }`),
        );
        await warteBis(
          () => askAbgegangen >= kanteVorher + 1,
          10_000,
          "nach der Auswahlfrist ist kein neuer Ask abgegangen",
        );
        await new Promise<void>((r) => setTimeout(r, 300));
        const askNachNeuklick = askAbgegangen - kanteVorher;
        freigeben();
        await seite.waitForFunction(fn(FREI), undefined, { timeout: 10_000 });
        kante = {
          dauerMs,
          askWaehrend,
          nachFrist,
          verspaetetGeliefert,
          askNachVerspaetet,
          nachVerspaetet,
          askNachNeuklick,
          ausgang: await seite.evaluate<Zustand>(fn(ZUSTAND)),
        };
        console.info(
          `JOB 3016 D3 · Runde 5 · Rueckruf bleibt aus: frei nach ${dauerMs} ms · Meldung „${nachFrist.statusText}“ · POST waehrend ${askWaehrend} · verspaetet geliefert ${verspaetetGeliefert} → POST ${askNachVerspaetet}, Feld gesperrt ${nachVerspaetet.eingabeGesperrt} · Neuklick → POST ${askNachNeuklick}`,
        );
        // ---- Runde 5 (BEN), Kante 2: getSelectedDataAsync WIRFT SYNCHRON.
        const werfenVorher = askAbgegangen;
        const sofortNachWurf = await seite.evaluate<Zustand>(
          fn(`() => {
            window.__kwWerfen = true;
            document.querySelector('#ask-btn').click();
            window.__kwWerfen = false;
            return (${ZUSTAND})();
          }`),
        );
        await new Promise<void>((r) => setTimeout(r, 300));
        const werfenWaehrend = askAbgegangen - werfenVorher;
        await seite.evaluate(fn(`() => { document.querySelector('#ask-btn').click(); }`));
        await warteBis(
          () => askAbgegangen >= werfenVorher + 1,
          10_000,
          "nach dem synchronen Office-Fehler ist kein neuer Ask abgegangen",
        );
        await new Promise<void>((r) => setTimeout(r, 300));
        const werfenNeuklick = askAbgegangen - werfenVorher;
        freigeben();
        await seite.waitForFunction(fn(FREI), undefined, { timeout: 10_000 });
        werfen = {
          sofort: sofortNachWurf,
          askWaehrend: werfenWaehrend,
          askNachNeuklick: werfenNeuklick,
          ausgang: await seite.evaluate<Zustand>(fn(ZUSTAND)),
        };
        console.info(
          `JOB 3016 D3 · Runde 5 · Office wirft synchron: sofort Feld gesperrt ${sofortNachWurf.eingabeGesperrt}, Karte ${sofortNachWurf.ladekarteSichtbar}, Meldung „${sofortNachWurf.statusText}“ · POST waehrend ${werfenWaehrend} · Neuklick → POST ${werfenNeuklick}`,
        );
        // ---- Runde 6 (BEN): EINE GESAMTFRIST. Word liefert den Rueckruf erst kurz vor Ablauf der
        //      15 s, der Server-Fetch bleibt offen — frei muss das Panel trotzdem bei 15 s ab Klick
        //      sein, nicht erst nach einer zweiten vollen Frist. Echte Zeit, keine gefaelschte Uhr.
        const gesamtVorher = askAbgegangen;
        const gesamtKlick = Date.now();
        await seite.evaluate(
          fn(`() => { window.__kwHalten = true; document.querySelector('#ask-btn').click(); }`),
        );
        await new Promise<void>((r) => setTimeout(r, PANEL_FRIST_MS - 800));
        await seite.evaluate(fn(LIEFERN));
        const rueckrufNachMs = Date.now() - gesamtKlick;
        await warteBis(
          () => askAbgegangen >= gesamtVorher + 1,
          5_000,
          "der spaete Rueckruf hat keinen Ask ausgeloest",
        );
        const askNachRueckruf = askAbgegangen - gesamtVorher;
        // Der Fetch bleibt offen (die Route haelt ihn) — die Restfrist des Panels muss freigeben.
        await seite.waitForFunction(fn(FREI), undefined, { timeout: 10_000 });
        const freiNachMs = Date.now() - gesamtKlick;
        const gesamtNachFrist = await seite.evaluate<Zustand>(fn(ZUSTAND));
        // Den gehaltenen Route-Handler loesen (die Seite hat den Abruf abgebrochen).
        freigeben();
        await new Promise<void>((r) => setTimeout(r, 300));
        const askNachFrist = askAbgegangen - gesamtVorher;
        // Der naechste Klick — Word antwortet sofort — genau ein Ask.
        await seite.evaluate(
          fn(`() => { window.__kwHalten = false; document.querySelector('#ask-btn').click(); }`),
        );
        await warteBis(
          () => askAbgegangen >= gesamtVorher + 2,
          10_000,
          "nach der Gesamtfrist ist kein neuer Ask abgegangen",
        );
        await new Promise<void>((r) => setTimeout(r, 300));
        const gesamtNeuklick = askAbgegangen - gesamtVorher;
        freigeben();
        await seite.waitForFunction(fn(FREI), undefined, { timeout: 10_000 });
        gesamt = {
          rueckrufNachMs,
          askNachRueckruf,
          freiNachMs,
          nachFrist: gesamtNachFrist,
          askNachFrist,
          askNachNeuklick: gesamtNeuklick,
          ausgang: await seite.evaluate<Zustand>(fn(ZUSTAND)),
        };
        console.info(
          `JOB 3016 D3 · Runde 6 · Gesamtfrist: Rueckruf bei ${rueckrufNachMs} ms → POST ${askNachRueckruf} · frei nach ${freiNachMs} ms ab Klick · Meldung „${gesamtNachFrist.statusText}“ · POST nach Frist ${askNachFrist} · Neuklick → POST gesamt ${gesamtNeuklick}`,
        );
      } catch (e) {
        fehler = String(e).split("\n").slice(0, 3).join(" | ");
      }
    }, 120_000);

    afterAll(async () => {
      freigeben();
      await browser?.close();
    }, 60_000);

    it("S · die Strecke steht: Chromium laeuft, das Panel ist geladen, der Ask-Fetch ging genau einmal ab und blieb waehrend der Messung offen", () => {
      expect(fehler).toBeNull();
      expect(version).not.toBe("");
      expect(askErstePhase).toBe(1);
      expect(gemessenNachMs).toBeGreaterThanOrEqual(0);
      expect(gemessenNachMs).toBeLessThan(PANEL_FRIST_MS);
      expect(warten?.eingabeWert).toBe(FRAGE);
    });

    it("W · der Wartezustand ist die Ladekarte: #ask-ladekarte sichtbar mit drei Balken, der Satz sichtbar, #ask-status verborgen", () => {
      expect(fehler).toBeNull();
      expect(warten?.ladekarteSichtbar, "#ask-ladekarte fehlt oder ist verborgen").toBe(true);
      expect(warten?.balken).toBe(3);
      expect(warten?.satzSichtbar).toBe(true);
      expect(warten?.statusSichtbar).toBe(false);
    });

    it("T · der Satz unter der Karte ist woertlich der des Zielbilds (Z.32)", () => {
      expect(fehler).toBeNull();
      const soll = innentext(ziel, "text-align: center");
      expect(soll).not.toBeNull();
      expect(warten?.satzText).toBe(soll);
    });

    it("E · die Zusage des Satzes ist wahr: #ask-input und #ask-btn sind gesperrt, und die Tastatur bringt keinen Buchstaben ins Feld", () => {
      expect(fehler).toBeNull();
      expect(warten?.eingabeGesperrt).toBe(true);
      expect(warten?.knopfGesperrt).toBe(true);
      expect(tippversuchWert).toBe(FRAGE);
    });

    it("A · der Ausgang ist fail-open: nach dem Ende der Suche ist die Karte weg und das Feld wieder frei", () => {
      expect(fehler).toBeNull();
      expect(ausgang?.ladekarteSichtbar).toBe(false);
      expect(ausgang?.satzSichtbar).toBe(false);
      expect(ausgang?.eingabeGesperrt).toBe(false);
      expect(ausgang?.knopfGesperrt).toBe(false);
    });

    it("D · SINGLE FLIGHT im Word-Weg (Runde 4): Auswahlrueckruf festgehalten, zwei echte Klicks → ein Rueckruf, ein POST /api/ask; Karte und Sperre stehen ab dem ersten Klick bis zum Ende, danach frei", () => {
      expect(fehler).toBeNull();
      const d = doppel as Doppelklick;
      expect(d, "Doppelklick-Phase nicht erreicht").not.toBeNull();
      // Sofort nach dem ERSTEN Klick, vor jedem Rueckruf: Tor zu, Karte da, Feld und Knopf gesperrt.
      expect(d.rueckrufe).toBe(1);
      expect(d.knopfGesperrt).toBe(true);
      expect(d.eingabeGesperrt).toBe(true);
      expect(d.karteSichtbar).toBe(true);
      // Der zweite Klick startet keinen zweiten Auswahlrueckruf.
      expect(d.rueckrufeNachZweitem).toBe(1);
      // Word liefert genau den einen Rueckruf; daraus wird genau ein Ask.
      expect(d.geliefert).toBe(1);
      expect(d.askAbgegangen).toBe(1);
      // Solange der Ask offen ist: Karte sichtbar, Feld und Knopf gesperrt, Warnkasten verborgen.
      expect(d.warten.ladekarteSichtbar).toBe(true);
      expect(d.warten.eingabeGesperrt).toBe(true);
      expect(d.warten.knopfGesperrt).toBe(true);
      expect(d.warten.statusSichtbar).toBe(false);
      // Danach: frei.
      expect(d.ausgang.ladekarteSichtbar).toBe(false);
      expect(d.ausgang.eingabeGesperrt).toBe(false);
      expect(d.ausgang.knopfGesperrt).toBe(false);
    });

    it("K1 · AUSWAHLRUECKRUF BLEIBT AUS (Runde 5): die Auswahlfrist gibt in echter Zeit frei (Karte weg, Feld frei, askSelectionTimeout, 0 POST); der verspaetete Rueckruf bewirkt nichts; der naechste Klick ergibt genau einen Ask", () => {
      expect(fehler).toBeNull();
      const k = kante as Auswahlkante;
      expect(k, "Kante nicht erreicht").not.toBeNull();
      // Freigabe durch die Frist des Panels — nicht frueher, nicht viel spaeter.
      expect(k.dauerMs).toBeGreaterThanOrEqual(PANEL_FRIST_MS - 500);
      expect(k.dauerMs).toBeLessThan(PANEL_FRIST_MS + 5_000);
      expect(k.askWaehrend).toBe(0);
      expect(k.nachFrist.ladekarteSichtbar).toBe(false);
      expect(k.nachFrist.eingabeGesperrt).toBe(false);
      expect(k.nachFrist.knopfGesperrt).toBe(false);
      expect(k.nachFrist.statusSichtbar).toBe(true);
      expect(k.nachFrist.statusText).toBe(
        "Word hat die Markierung nicht geliefert (Zeitüberschreitung). Bitte erneut versuchen.",
      );
      // Der verspaetete Rueckruf: geliefert, aber wirkungslos.
      expect(k.verspaetetGeliefert).toBe(1);
      expect(k.askNachVerspaetet).toBe(0);
      expect(k.nachVerspaetet.eingabeGesperrt).toBe(false);
      expect(k.nachVerspaetet.ladekarteSichtbar).toBe(false);
      // Danach ein sauberer Einzel-Ask.
      expect(k.askNachNeuklick).toBe(1);
      expect(k.ausgang.eingabeGesperrt).toBe(false);
      expect(k.ausgang.ladekarteSichtbar).toBe(false);
    });

    it("K2 · getSelectedDataAsync WIRFT SYNCHRON (Runde 5): sofort Feld frei, Karte weg, askError mit Grund, 0 POST; der naechste Klick ergibt genau einen Ask", () => {
      expect(fehler).toBeNull();
      const w = werfen as Werfen;
      expect(w, "Kante nicht erreicht").not.toBeNull();
      expect(w.sofort.eingabeGesperrt).toBe(false);
      expect(w.sofort.knopfGesperrt).toBe(false);
      expect(w.sofort.ladekarteSichtbar).toBe(false);
      expect(w.sofort.statusSichtbar).toBe(true);
      expect(w.sofort.statusText).toBe("Fragen fehlgeschlagen (Office kaputt).");
      expect(w.askWaehrend).toBe(0);
      expect(w.askNachNeuklick).toBe(1);
      expect(w.ausgang.eingabeGesperrt).toBe(false);
      expect(w.ausgang.ladekarteSichtbar).toBe(false);
    });

    it("K3 · GESAMTFRIST (Runde 6): Rueckruf kurz vor 15 s, Fetch offen → frei spaetestens 15 s nach dem Klick (askTimeout), genau ein POST, kein nachtraeglicher; der naechste Klick ergibt genau einen Ask", () => {
      expect(fehler).toBeNull();
      const g = gesamt as Gesamtfrist;
      expect(g, "Kante nicht erreicht").not.toBeNull();
      // Der Rueckruf kam wirklich spaet — innerhalb der letzten Sekunde der Gesamtfrist.
      expect(g.rueckrufNachMs).toBeGreaterThan(PANEL_FRIST_MS - 1_000);
      expect(g.rueckrufNachMs).toBeLessThan(PANEL_FRIST_MS);
      expect(g.askNachRueckruf).toBe(1);
      // Frei bei 15 s ab Klick — mit Toleranz fuer Playwright-Umlaufzeit, aber weit vor einer
      // zweiten vollen Frist (30 s).
      expect(g.freiNachMs).toBeGreaterThanOrEqual(PANEL_FRIST_MS - 100);
      expect(g.freiNachMs).toBeLessThan(PANEL_FRIST_MS + 1_500);
      expect(g.nachFrist.ladekarteSichtbar).toBe(false);
      expect(g.nachFrist.eingabeGesperrt).toBe(false);
      expect(g.nachFrist.knopfGesperrt).toBe(false);
      expect(g.nachFrist.statusText).toBe(
        "Keine Antwort vom Server (Zeitüberschreitung). Bitte erneut versuchen.",
      );
      expect(g.askNachFrist).toBe(1);
      expect(g.askNachNeuklick).toBe(2);
      expect(g.ausgang.eingabeGesperrt).toBe(false);
      expect(g.ausgang.ladekarteSichtbar).toBe(false);
    });

    it("M · jede Zeile der Werte-Tabelle traegt einen Messpunkt, und jeder Messpunkt trifft genau ein reales Element mit rueckwaerts aufloesbarem Pfad", () => {
      expect(fehler).toBeNull();
      expect(MESSPUNKTE.length).toBeGreaterThanOrEqual(6);
      for (const p of MESSPUNKTE) {
        expect(p.selektor, `${p.name}: Zeile ohne Messpunkt (Selektor)`).not.toBe("");
        expect(p.eigenschaft, `${p.name}: Zeile ohne Messpunkt (Eigenschaft)`).not.toBe("");
      }
      for (const m of messwerte) {
        expect(m.fehlt, `${m.name}: kein reales Element`).toBe(false);
        // Eine Kennung trifft genau ein Element; eine Klassenregel (`.ladebalken`) gilt fuer alle
        // drei Balken — gemessen wird dann am ersten, und der Pfad belegt, welcher das ist.
        const punkt = MESSPUNKTE.find((p) => p.name === m.name);
        if (punkt?.selektor.startsWith("#")) {
          expect(m.treffer, `${m.name}: Kennung trifft nicht genau ein Element`).toBe(1);
        } else {
          expect(m.treffer, `${m.name}: Selektor trifft kein Element`).toBeGreaterThanOrEqual(1);
        }
        expect(m.aufgeloest, `${m.name}: Pfad loest nicht auf dasselbe Element auf`).toBe(true);
        expect(m.pfad).toMatch(/^body > /);
      }
    });

    // ---- ein Vergleich je Wert, an den realen Elementen ------------------------------------------
    for (const w of WERTE_FRAGEWEG_PRUEFUNG) {
      it(`V · ${w.name} — ${w.messpunkt?.eigenschaft ?? "?"} an ${w.messpunkt?.selektor ?? "?"}`, () => {
        expect(fehler).toBeNull();
        const soll = kanon(w.ziel(ziel));
        expect(soll, "Sollwert im Zielbild nicht lesbar").not.toBeNull();
        const m = messwerte.find((x) => x.name === w.name);
        expect(m, "kein Messwert").toBeDefined();
        const mess = m as Messwert;
        expect(mess.fehlt, "kein reales Element").toBe(false);
        const quelle = `Zielbild ${w.messpunkt?.eigenschaft} · ${w.name}`;
        if ((soll as string).endsWith("%")) {
          // Ein Prozentwert loest sich im Browser zu Pixeln auf — verglichen wird der Anteil an der
          // Inhaltsbreite des Elternelements (halbes Prozent Toleranz fuer Subpixel).
          const sollProzent = Number.parseFloat(soll as string);
          expect(mess.prozent, "kein Anteil messbar").not.toBeNull();
          const ist = mess.prozent as number;
          console.info(
            `JOB 3016 D3 · ${w.name} · ${w.messpunkt?.selektor} → ${mess.pfad} · soll ${soll} · ist ${ist.toFixed(2)}% (${mess.wert}) · ${quelle}`,
          );
          expect(Math.abs(ist - sollProzent)).toBeLessThan(0.5);
          return;
        }
        const ist = kanon(mess.wert);
        console.info(
          `JOB 3016 D3 · ${w.name} · ${w.messpunkt?.selektor} → ${mess.pfad} · soll ${soll} · ist ${ist} · ${quelle}`,
        );
        expect(ist).toBe(soll);
      });
    }

    // ---- die gerenderte Folge der Aussenabstaende: Karte und Satz stehen 16px innerhalb der
    //      Inhaltskante des Panels (Zielbild Z.26/Z.32) — links wie rechts, als Pixelmass ----------
    it("R · Karte und Satz stehen links und rechts je 16px innerhalb der Inhaltskante des Panels (gerendert)", () => {
      expect(fehler).toBeNull();
      const w = warten as Zustand;
      const runde = (n: number | null): number | null =>
        n === null ? null : Math.round(n * 100) / 100;
      console.info(
        `JOB 3016 D3 · R · Karte links ${runde(w.karteAbstandLinks)}px, rechts ${runde(w.karteAbstandRechts)}px · Satz links ${runde(w.satzAbstandLinks)}px, rechts ${runde(w.satzAbstandRechts)}px · soll je 16px`,
      );
      expect(runde(w.karteAbstandLinks)).toBe(16);
      expect(runde(w.karteAbstandRechts)).toBe(16);
      expect(runde(w.satzAbstandLinks)).toBe(16);
      expect(runde(w.satzAbstandRechts)).toBe(16);
    });
  },
);

describe.runIf(!zielbildDa)("JOB 3016 · D3 · PruefungLaeuft-Vergleich uebersprungen", () => {
  it("meldet den fehlenden Kontrollordner statt eine Messung vorzutaeuschen", () => {
    expect(zielbildDa, `Zielbild nicht lesbar: ${ZIELBILD} — Abgleich hier nicht messbar.`).toBe(
      false,
    );
  });
});

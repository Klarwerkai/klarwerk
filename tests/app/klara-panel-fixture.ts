// ================================================================================================
// KLARA-PANEL-FIXTURE — DAS AUSGELIEFERTE AUFGABENFENSTER WIRKLICH LAUFEN LASSEN.
// ================================================================================================
//
// Das Word-Taskpane (apps/web/public/word-addin/taskpane.html) ist bewusst buildlos: eine statische
// Seite mit EINEM Inline-Skript, ohne Modulsystem und ohne Bundler. Die bisherigen Tests konnten
// deshalb nur zwei Dinge: den Marker-Block KW-WORDADDIN-HELPERS-* extrahieren und gegen das Modul
// vergleichen (Aequivalenz), oder Quelltext-Zeichenfolgen pinnen. Was WIRKLICH SICHTBAR wird — der
// Text in #send-status, ob #open-block aufgeht, ob ein Sprachwechsel die Meldung mitzieht —, stand
// in keinem ausgefuehrten Test.
//
// Diese Fixture schliesst genau diese Luecke. Sie baut den ausgelieferten Rumpf in das jsdom-DOM,
// fuehrt das VOLLSTAENDIGE Inline-Skript aus (nicht seinen TypeScript-Zwilling) und gibt die
// Bedienstellen des Panels als aufrufbare Funktionen zurueck.
//
// WARUM DIE DOM-TYPEN HIER VON HAND STEHEN: der Gate-tsc laeuft Node-rein, ohne DOM-lib
// (tsconfig.json, lib: ["ES2022"]). Dieselbe Loesung wie in word-addin.test.ts (XmlParser): schmale
// Struktur-Typen plus EIN geprueftes Abgreifen der Laufzeit-Globals. Kein `any`, keine DOM-lib.
//
// DIE RUECKSETZUNG IST TEIL DES VERTRAGS, nicht Kosmetik: das Panel startet beim Laden Fetches,
// Timer und (im Anmeldeweg) einen Poll-Lauf. Ohne feste Reihenfolge beim Aufraeumen traegt ein Test
// den Zustand des vorigen. `restore()` haelt deshalb die unten dokumentierte Reihenfolge ein und
// wird im `afterEach` UNBEDINGT gerufen — nicht „falls exportiert", nicht „wenn vorhanden".
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { KLARA_AUSFUEHRUNG, istFrageAufruf } from "../support/frageweg";
import { panelQuelleAus } from "../support/panelquelle";

export const TASKPANE_PATH = "apps/web/public/word-addin/taskpane.html";
/**
 * JOB 3667 (14.09.2026): das ausgelieferte Fenster besteht seit dem Schnitt aus ZWEI Skripten —
 * dem Inline-Skript und dieser Geschwisterdatei, die `taskpane.html` unmittelbar davor als
 * klassisches Skript laedt. Wer nur eines von beiden ausfuehrt, baut ein Fenster, das es so nicht
 * gibt: `setLang`, `renderCapture` und `checkSession` rufen `rwZeichnen`/`rwRolleMelden`
 * UNGESCHUETZT. `splitTaskpane` fuegt deshalb beide in der Reihenfolge der Auslieferung zusammen.
 */
export const RUECKWEG_PATH = "apps/web/public/word-addin/rueckweg.js";
/** Das Verweis-Tag, an dem der Rumpf endet — es steht im Markup, gehoert aber zum Skriptteil. */
const RUECKWEG_TAG = '<script src="rueckweg.js';

// ---- Schmale Struktur-Typen (Ersatz fuer die fehlende DOM-lib) ---------------------------------

export interface PanelElement {
  className: string;
  textContent: string | null;
  title: string;
  value: string;
  disabled: boolean;
  rows: number;
  href: string;
  getAttribute(name: string): string | null;
  /** JOB 3057 K2: Knoepfe und Textlinks der Erfassen-Flaeche werden wirklich geklickt. */
  click(): void;
  /** JOB 3057 K2: die Zeile „Titel" wird wie von Hand beschrieben (Ereignis `input`). */
  dispatchEvent(ereignis: { type: string }): boolean;
}

interface PanelDocument {
  body: { innerHTML: string };
  documentElement: { lang: string };
  querySelector(selector: string): PanelElement | null;
  getElementById(id: string): PanelElement | null;
}

type TimerId = ReturnType<typeof setTimeout>;
type TimerFn = (handler: () => void, timeout?: number) => TimerId;
type ClearFn = (id: TimerId) => void;

interface PanelGlobals {
  document: PanelDocument;
  window: Record<string, unknown>;
  fetch?: unknown;
  Office?: unknown;
  Word?: unknown;
  setTimeout: TimerFn;
  clearTimeout: ClearFn;
  setInterval: TimerFn;
  clearInterval: ClearFn;
}

// ---- Fake-Fetch ---------------------------------------------------------------------------------

export interface FakeReplyInit {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface FakeResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

export interface FetchCall {
  url: string;
  method: string;
  body: string | undefined;
}

export type FakeRoute = (url: string, init: Record<string, unknown> | undefined) => FakeReplyInit;

/** Antwort-Bausteine fuer Tests — bewusst klein, damit ein Testfall in einer Zeile lesbar bleibt. */
export function reply(
  status: number,
  body?: unknown,
  headers?: Record<string, string>,
): FakeReplyInit {
  const init: FakeReplyInit = { status };
  if (body !== undefined) {
    init.body = body;
  }
  if (headers !== undefined) {
    init.headers = headers;
  }
  return init;
}

function toResponse(init: FakeReplyInit): FakeResponse {
  const headers = init.headers ?? {};
  const body = init.body ?? {};
  return {
    ok: init.status >= 200 && init.status < 300,
    status: init.status,
    headers: {
      get(name: string): string | null {
        const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
        return key === undefined ? null : (headers[key] ?? null);
      },
    },
    json: async (): Promise<unknown> => body,
  };
}

// R-0700: Klaras eigener Ausführungszugang und die Frage-Erkennung leben in `support/frageweg.ts`
// (ohne Griff auf das Fenster); hier weitergereicht für Tests, die ohnehin an dieser Bühne hängen.
export { KLARA_AUSFUEHRUNG, istFrageAufruf };

// Die Grundversorgung: genau die Endpunkte, die das Panel beim Laden von selbst ruft. Ein Test
// ueberschreibt nur das, worum es ihm geht — alles andere bleibt ein ehrlicher, ruhiger Zustand.
const DEFAULT_ROUTES: Record<string, FakeReplyInit> = {
  "/api/auth/me": { status: 200, body: { name: "Testnutzer" } },
  "/api/reasoner/status": {
    status: 200,
    body: { active: false, mode: "deterministic", reachable: "ok", tasks: {} },
  },
  "/api/kos/": { status: 200, body: { title: "Wartungsplan V4", trust: 50, status: "validiert" } },
  "/api/drafts": { status: 201, body: { id: "draft-1" } },
  "/api/ask": { status: 200, body: { result: { answered: false, answer: null, sources: [] } } },
};

// ---- Fake-Office --------------------------------------------------------------------------------

interface FakeOfficeResult {
  status: string;
  value: string;
}

/**
 * JOB 3438: die `.docx`, die `Office.context.document.getFileAsync` herausgibt.
 *
 * NUR WENN DIESES FELD GESETZT IST, kennt der Office-Fake `getFileAsync` und `Office.FileType`
 * ueberhaupt. Ohne es fehlen beide — genau der Zustand, in dem `holeGanzeDatei`
 * (taskpane.html:5266-5275) sofort auf `beiFehlschlag()` faellt und der alte Weg
 * (`readWholeDocument`) uebernimmt. So verhaelt sich die Fixture ohne die Option unveraendert.
 */
export interface FakeDocxDatei {
  /**
   * Die Bytes der Datei. Ohne Angabe die vier Zip-Kopfbytes einer `.docx` — der INHALT ist fuer
   * den gemessenen Weg gleichgueltig, die Route ist ein Fake; die Bytes belegen nur, dass wirklich
   * etwas eingesammelt und base64-kodiert wurde.
   */
  bytes?: number[];
  /**
   * Bytes je Scheibe. Ohne Angabe gilt die `sliceSize`, die das Panel selbst mitgibt
   * (WORD_ADDIN_SLICE_BYTES, 1 MiB) — dann ist es EINE Scheibe. Ein kleiner Wert erzwingt das
   * mehrscheibige Einsammeln.
   */
  scheibenBytes?: number;
}

interface FakeDateiHandhabe {
  sliceCount: number;
  getSliceAsync(
    index: number,
    callback: (r: { status: string; value: { data: number[] } | null }) => void,
  ): void;
  closeAsync(callback: (r: { status: string }) => void): void;
}

/**
 * R-0169 (Nacharbeit 8): die Dokumenteinstellungen (`Office.context.document.settings`).
 *
 * NUR WENN DIESE OPTION GESETZT IST, kennt der Office-Fake `settings` — ohne sie fehlt die
 * Schnittstelle wie bisher, und kein bestehender Fall ändert sein Verhalten. `werte` ist der Stand,
 * den das Dokument beim ÖFFNEN mitbringt; `set` ändert nur die Arbeitskopie, erst ein erfolgreiches
 * `saveAsync` überträgt sie nach `gespeichert` (der Stand, den ein Wiederöffnen sähe). Dies bildet
 * den Office-Vertrag nach — es ist KEIN Nachweis, dass echtes Word die Einstellung im .docx behält.
 */
export interface FakeDokumentEinstellungen {
  werte?: Record<string, unknown>;
  speichernScheitert?: boolean;
  /** Vom Test übergebenes Ziel: hier landet, was `saveAsync` dauerhaft gemacht hat. */
  gespeichert?: Record<string, unknown>;
  /**
   * Word-Host-Gesamtweg (Realhostbeleg 06.10.2026): echtes Word antwortet auf `saveAsync` SPÄTER
   * als der Sendeweg endet. Gesetzt, ruft die Attrappe den Rückruf NICHT sofort, sondern legt ihn
   * in `ausstehend` ab; der Test löst ihn selbst aus. Ob Erfolg oder Fehler, entscheidet
   * `speichernScheitert` zum Zeitpunkt des Auslösens.
   */
  verzoegert?: boolean;
  /** Bei `verzoegert`: die noch nicht beantworteten `saveAsync`-Aufrufe, in Aufrufreihenfolge. */
  ausstehend?: Array<() => void>;
}

/**
 * Word-Host-Gesamtweg (Realhostbeleg 06.10.2026): `Word.run` → `getSelection().text`.
 *
 * NUR WENN DIESE OPTION GESETZT IST, gibt es `Word` — ohne sie bleibt es wie bisher ungesetzt.
 *   "sofort"     — die Auswahl antwortet mit `text`.
 *   "nie"        — `context.sync` antwortet nie (der Rückruf bleibt aus).
 *   "verzoegert" — die Antwort liegt in `ausstehend`; der Test löst sie selbst aus.
 *   "wirft"      — `Word.run` wirft synchron.
 * `laeufe` zählt die `Word.run`-Aufrufe (auch die des Panels beim Laden).
 */
export interface FakeWordAuswahl {
  lage: "sofort" | "nie" | "verzoegert" | "wirft";
  text: string;
  ausstehend?: Array<() => void>;
  laeufe?: number;
}

function buildFakeWord(wa: FakeWordAuswahl): Record<string, unknown> {
  return {
    run: (fn: (kontext: unknown) => unknown): Promise<unknown> => {
      wa.laeufe = (wa.laeufe ?? 0) + 1;
      if (wa.lage === "wirft") {
        throw new Error("Word.run nicht verfügbar");
      }
      const auswahl: { text?: string; load: (felder: string) => void } = {
        load: () => undefined,
      };
      // Nur ein Lauf, der die AUSWAHL liest, folgt der Lage; andere Lesungen antworten sofort.
      let auswahlGelesen = false;
      const sync = (): Promise<void> => {
        if (!auswahlGelesen) {
          return Promise.resolve();
        }
        if (wa.lage === "nie") {
          return new Promise<void>(() => undefined);
        }
        if (wa.lage === "verzoegert") {
          return new Promise<void>((fertig) => {
            wa.ausstehend ??= [];
            wa.ausstehend.push(() => {
              auswahl.text = wa.text;
              fertig();
            });
          });
        }
        auswahl.text = wa.text;
        return Promise.resolve();
      };
      // Ein leerer, lesbarer Dokumentkörper: das Panel liest ihn beim Laden (Begriffsbild) — wie
      // in den vorhandenen Word-Attrappen, ohne Schreibweg.
      const body = { text: "", load: () => undefined, getHtml: () => ({ value: "" }) };
      const getSelection = (): typeof auswahl => {
        auswahlGelesen = true;
        return auswahl;
      };
      const kontext = { document: { getSelection, body }, sync };
      return Promise.resolve().then(() => fn(kontext));
    },
  };
}

/**
 * WORD-WEB-RETURN-STRUCTURE (Nacharbeit 9): die STRUKTUR der Markierung, wie Word sie über
 * WordApi 1.1 hergibt — `getSelection().getHtml()`, `paragraphs` mit `text`/`style` und je Absatz
 * `inlinePictures` mit `getBase64ImageSrc()`. Nur gesetzt, wenn ein Test es ausdrücklich verlangt.
 *   "sofort" — jede Lesung antwortet.
 *   "nie"    — `context.sync` antwortet beim Lesen der Auswahl nie (Frist des Panels).
 *   "wirft"  — `Word.run` wirft synchron.
 */
export interface FakeWordMarkierung {
  lage: "sofort" | "nie" | "wirft";
  /** Was `Range.getHtml()` liefert (Vorgabe: leer). */
  html?: string;
  absaetze: { text: string; stil?: string; bilder?: string[] }[];
}

function buildFakeWordMarkierung(wm: FakeWordMarkierung): Record<string, unknown> {
  return {
    run: (fn: (kontext: unknown) => unknown): Promise<unknown> => {
      if (wm.lage === "wirft") {
        throw new Error("Word.run nicht verfügbar");
      }
      let auswahlGelesen = false;
      const sync = (): Promise<void> => {
        if (auswahlGelesen && wm.lage === "nie") {
          return new Promise<void>(() => undefined);
        }
        return Promise.resolve();
      };
      const absaetze = wm.absaetze.map((a) => ({
        text: a.text,
        style: a.stil ?? "Standard",
        inlinePictures: {
          items: (a.bilder ?? []).map((b) => ({ getBase64ImageSrc: () => ({ value: b }) })),
          load: () => undefined,
        },
      }));
      const auswahl = {
        text: wm.absaetze.map((a) => a.text).join("\r"),
        load: () => undefined,
        getHtml: () => ({ value: wm.html ?? "" }),
        paragraphs: { items: absaetze, load: () => undefined },
      };
      const body = { text: "", load: () => undefined, getHtml: () => ({ value: "" }) };
      const getSelection = (): typeof auswahl => {
        auswahlGelesen = true;
        return auswahl;
      };
      return Promise.resolve().then(() => fn({ document: { getSelection, body }, sync }));
    },
  };
}

function buildFakeOffice(
  selectionHtml: string,
  selectionText: string,
  docx: FakeDocxDatei | undefined,
  einstellungen?: FakeDokumentEinstellungen,
  auswahlHaengt?: boolean,
): Record<string, unknown> {
  const coercion = { Html: "html", Text: "text" };
  const asyncStatus = { Succeeded: "succeeded", Failed: "failed" };
  const dokument: Record<string, unknown> = {
    getSelectedDataAsync: (type: string, callback: (result: FakeOfficeResult) => void): void => {
      if (type === coercion.Html) {
        callback({ status: asyncStatus.Succeeded, value: selectionHtml });
        return;
      }
      // JOB 3057 K2: der TEXT-Zugriff speist die Markierungskarte (und die Frage-Herkunft).
      // Grundwert bleibt leer — bestehende Faelle stellen keine Textmarkierung und sollen
      // durch die Karte nicht ploetzlich eine bekommen.
      // Word-Host-Gesamtweg: `auswahlHaengt` bildet Word im Web nach — der Rückruf bleibt AUS.
      if (auswahlHaengt) {
        return;
      }
      callback({ status: asyncStatus.Succeeded, value: selectionText });
    },
  };
  const office: Record<string, unknown> = {
    CoercionType: coercion,
    AsyncResultStatus: asyncStatus,
    // Das Panel erkennt Office ueber `Office.onReady` MIT Frist; ein synchroner Rueckruf ist der
    // deterministische Fall „Office ist sofort bereit".
    onReady: (callback: () => void): void => {
      callback();
    },
    context: { document: dokument },
  };
  if (einstellungen !== undefined) {
    const arbeitskopie: Record<string, unknown> = { ...(einstellungen.werte ?? {}) };
    dokument.settings = {
      get: (name: string): unknown => arbeitskopie[name] ?? null,
      set: (name: string, wert: unknown): void => {
        arbeitskopie[name] = wert;
      },
      saveAsync: (callback: (r: { status: string; error?: { message: string } }) => void): void => {
        const antworten = (): void => {
          if (einstellungen.speichernScheitert) {
            callback({
              status: asyncStatus.Failed,
              error: { message: "Speichern fehlgeschlagen" },
            });
            return;
          }
          if (einstellungen.gespeichert) {
            Object.assign(einstellungen.gespeichert, arbeitskopie);
          }
          callback({ status: asyncStatus.Succeeded });
        };
        if (einstellungen.verzoegert) {
          einstellungen.ausstehend ??= [];
          einstellungen.ausstehend.push(antworten);
          return;
        }
        antworten();
      },
    };
  }
  if (docx !== undefined) {
    const bytes = docx.bytes ?? [0x50, 0x4b, 0x03, 0x04];
    const fileType = { Compressed: "compressed", Text: "text" };
    office.FileType = fileType;
    dokument.getFileAsync = (
      typ: string,
      optionen: { sliceSize?: number } | undefined,
      callback: (r: { status: string; value: FakeDateiHandhabe | null }) => void,
    ): void => {
      // Ein anderer Dateityp ist nicht der Weg dieses Panels — ehrlich fehlschlagen statt
      // stillschweigend dieselbe Datei liefern.
      if (typ !== fileType.Compressed) {
        callback({ status: asyncStatus.Failed, value: null });
        return;
      }
      const groesse = Math.max(1, docx.scheibenBytes ?? optionen?.sliceSize ?? bytes.length);
      const datei: FakeDateiHandhabe = {
        sliceCount: Math.max(1, Math.ceil(bytes.length / groesse)),
        getSliceAsync: (index, cb): void => {
          cb({
            status: asyncStatus.Succeeded,
            value: { data: bytes.slice(index * groesse, (index + 1) * groesse) },
          });
        },
        closeAsync: (cb): void => {
          cb({ status: asyncStatus.Succeeded });
        },
      };
      callback({ status: asyncStatus.Succeeded, value: datei });
    };
  }
  return office;
}

// ---- Die Fixture --------------------------------------------------------------------------------

export interface KlaraPanelOptions {
  /** Antworten je Pfad-Praefix; ueberschreibt die Grundversorgung. */
  routes?: Record<string, FakeReplyInit | FakeRoute>;
  /** Was Word als HTML der Markierung liefert (Grundlage von `sendSelection`). */
  selectionHtml?: string;
  /**
   * JOB 3057 K2: was Word als TEXT der Markierung liefert — die Markierungskarte der Erfassen-
   * Flaeche liest genau diesen Zugriff (Absaetze = Zeilen). Ohne Angabe leer (wie bisher).
   */
  selectionText?: string;
  /** false = Seite im normalen Browser (kein Office) — der ehrliche Nicht-Word-Zustand. */
  withOffice?: boolean;
  /**
   * JOB 3438: schaltet `getFileAsync`/`Office.FileType` im Office-Fake FREI (Vorgabe: aus). Erst
   * damit erreicht `sendDocument()` den `.docx`-Weg (`holeGanzeDatei` → `sendeDocxDatei` →
   * `POST /api/drafts/from-docx`); ohne die Option faellt das Panel wie bisher auf
   * `readWholeDocument` zurueck. Siehe `FakeDocxDatei`.
   */
  docxDatei?: FakeDocxDatei;
  /** R-0169 (Nacharbeit 8): schaltet `Office.context.document.settings` frei (Vorgabe: aus). */
  dokumentEinstellungen?: FakeDokumentEinstellungen;
  /** Word-Host-Gesamtweg: `getSelectedDataAsync(Text)` antwortet nie (Vorgabe: aus). */
  auswahlHaengt?: boolean;
  /** Word-Host-Gesamtweg: setzt ein `Word` mit steuerbarer Auswahl (Vorgabe: kein `Word`). */
  wordAuswahl?: FakeWordAuswahl;
  /** Nacharbeit 9: setzt ein `Word` mit der Struktur der Markierung (Vorgabe: kein `Word`). */
  wordMarkierung?: FakeWordMarkierung;
}

export interface KlaraPanel {
  /** Im dynamischen Skriptrumpf DEKLARIERT (s. `scriptSource`) — nicht von aussen hereingereicht. */
  q(selector: string): PanelElement | null;
  /** Sichtbarer Text einer Stelle; fehlt sie, ist das ein Testfehler und keine leere Zeichenkette. */
  text(selector: string): string;
  setLang(code: string): void;
  setTab(name: string): void;
  sendSelection(): void;
  /** JOB 3057 K2: der Dokument-Weg — was der Textlink „Ganzes Dokument uebernehmen" ausloest. */
  sendDocument(): void;
  stopLoginPolling(): void;
  askKlara(): void;
  t(key: string, vars?: Record<string, string>): string;
  /** Jeder Fetch des Panels, in Reihenfolge — die Grundlage der Create-0/Create-1-Zaehlung. */
  calls: FetchCall[];
  /** Wartet die Promise-Ketten des Panels ab (echte Timer, nicht gefakte Zeit). */
  flush(): Promise<void>;
  /** Der wirklich ausgefuehrte Skriptrumpf — Beleg, dass `q` DARIN deklariert ist. */
  scriptSource: string;
  restore(): void;
}

interface PanelExports {
  setLang(code: string): void;
  setTab(name: string): void;
  sendSelection(): void;
  sendDocument(): void;
  stopLoginPolling(): void;
  askKlara(): void;
  q(selector: string): PanelElement | null;
  t(key: string, vars?: Record<string, string>): string;
}

/**
 * Das Fenster als EIN Dokument. Seit dem Drei-Datei-Schnitt (R-1611) liegen Stil und Skript in
 * `taskpane.css`/`taskpane.js`; `panelQuelleAus` fügt sie an ihren Stellen wieder ein.
 */
function readTaskpane(): string {
  return panelQuelleAus(resolve(process.cwd(), TASKPANE_PATH));
}

export function readRueckweg(): string {
  return readFileSync(resolve(process.cwd(), RUECKWEG_PATH), "utf8");
}

/**
 * Rumpf und Skript aus der AUSGELIEFERTEN Seite schneiden (kein zweiter Quelltext).
 *
 * `script` ist das, was der Browser in dieser Reihenfolge ausfuehrt: erst `rueckweg.js`, dann das
 * Inline-Skript. Der Rumpf endet am Verweis-Tag, nicht erst am Inline-Skript — sonst stuende ein
 * `<script src>` im `innerHTML`, das im jsdom stumm bliebe und nur verwirrte.
 */
export function splitTaskpane(html: string): { markup: string; script: string } {
  const bodyOpen = html.indexOf("<body>");
  const tagOpen = html.indexOf(RUECKWEG_TAG, bodyOpen);
  const scriptOpen = html.indexOf("<script>", bodyOpen);
  const scriptClose = html.lastIndexOf("</script>");
  if (bodyOpen < 0 || scriptOpen < 0 || scriptClose < scriptOpen) {
    throw new Error("taskpane.html: Rumpf/Skript nicht auffindbar");
  }
  const rumpfBis = tagOpen >= 0 && tagOpen < scriptOpen ? tagOpen : scriptOpen;
  return {
    markup: html.slice(bodyOpen + "<body>".length, rumpfBis),
    script: `${readRueckweg()}\n${html.slice(scriptOpen + "<script>".length, scriptClose)}`,
  };
}

export function createKlaraPanel(options: KlaraPanelOptions = {}): KlaraPanel {
  const globals = globalThis as unknown as PanelGlobals;
  const { markup, script } = splitTaskpane(readTaskpane());

  // --- 1. Ausgangszustand merken (alles, was diese Fixture veraendert) -------------------------
  const hadFetch = "fetch" in globals;
  const originalFetch = globals.fetch;
  const hadOffice = "Office" in globals;
  const originalOffice = globals.Office;
  const hadWord = "Word" in globals;
  const originalWord = globals.Word;
  const originalSetTimeout = globals.setTimeout;
  const originalClearTimeout = globals.clearTimeout;
  const originalSetInterval = globals.setInterval;
  const originalClearInterval = globals.clearInterval;
  const originalLang = globals.document.documentElement.lang;
  const originalBody = globals.document.body.innerHTML;

  // --- 2. Timer nachhalten, damit `restore()` keinen laufen laesst ------------------------------
  const openTimeouts = new Set<TimerId>();
  const openIntervals = new Set<TimerId>();
  globals.setTimeout = ((handler: () => void, timeout?: number): TimerId => {
    const id = originalSetTimeout(() => {
      openTimeouts.delete(id);
      handler();
    }, timeout);
    openTimeouts.add(id);
    return id;
  }) as TimerFn;
  globals.clearTimeout = ((id: TimerId): void => {
    openTimeouts.delete(id);
    originalClearTimeout(id);
  }) as ClearFn;
  globals.setInterval = ((handler: () => void, timeout?: number): TimerId => {
    const id = originalSetInterval(handler, timeout);
    openIntervals.add(id);
    return id;
  }) as TimerFn;
  globals.clearInterval = ((id: TimerId): void => {
    openIntervals.delete(id);
    originalClearInterval(id);
  }) as ClearFn;

  // --- 3. Fetch faken und mitschreiben -----------------------------------------------------------
  const routes: Record<string, FakeReplyInit | FakeRoute> = {
    ...DEFAULT_ROUTES,
    ...(options.routes ?? {}),
  };
  const calls: FetchCall[] = [];
  const fakeFetch = async (url: string, init?: Record<string, unknown>): Promise<FakeResponse> => {
    const method = typeof init?.method === "string" ? init.method : "GET";
    const body = typeof init?.body === "string" ? init.body : undefined;
    calls.push({ url, method, body });
    // R-0700: Klaras EIGENER Ausführungszugang (`/api/klara/sessions/{id}/execute`) antwortet in
    // DERSELBEN Form wie der allgemeine Frageweg — beide laufen serverseitig durch denselben
    // `antwortLauf`. Hat ein Test keine eigene Route dafür, bedient ihn deshalb seine Ask-Route
    // (nicht die Sitzungsroute, die der Präfixvergleich sonst träfe). Mitgeschrieben bleibt die
    // WIRKLICHE URL — gezählt wird, was das Panel abgesetzt hat.
    const klaraAusfuehrung =
      KLARA_AUSFUEHRUNG.test(url) && !Object.keys(routes).some((k) => k.endsWith("/execute"));
    const suchUrl = klaraAusfuehrung ? "/api/ask" : url;
    const key = Object.keys(routes)
      .filter((candidate) => suchUrl.startsWith(candidate))
      .sort((a, b) => b.length - a.length)[0];
    if (key === undefined) {
      throw new Error(`Fake-Fetch: keine Route fuer ${url}`);
    }
    const route = routes[key];
    const resolved = typeof route === "function" ? route(url, init) : route;
    if (resolved === undefined) {
      throw new Error(`Fake-Fetch: leere Route fuer ${url}`);
    }
    return toResponse(resolved);
  };
  globals.fetch = fakeFetch;
  globals.window.fetch = fakeFetch;

  // --- 4. Office setzen (oder ehrlich weglassen) -------------------------------------------------
  // `Reflect.deleteProperty` statt des `delete`-Operators: Biome verbietet `delete` (performance/
  // noDelete), und die Eigenschaft soll wirklich VERSCHWINDEN — ein auf `undefined` gesetztes
  // `window.Office` waere fuer das Panel zwar gleich falsy, fuer einen `in`-Test aber vorhanden.
  const entfernen = (name: string): void => {
    Reflect.deleteProperty(globals, name);
    Reflect.deleteProperty(globals.window, name);
  };
  if (options.withOffice === false) {
    entfernen("Office");
  } else {
    const office = buildFakeOffice(
      options.selectionHtml ?? "<html><body><p>Ventil entlasten vor der Wartung</p></body></html>",
      options.selectionText ?? "",
      options.docxDatei,
      options.dokumentEinstellungen,
      options.auswahlHaengt,
    );
    globals.Office = office;
    globals.window.Office = office;
  }
  // `Word` bleibt bewusst ungesetzt: der Auswahl-Weg braucht es nicht, und ein halb gefaelschtes
  // Word.run wuerde einen Pfad vortaeuschen, den dieser Test nicht deckt. Ausnahme: `wordAuswahl`
  // setzt ausdrücklich den Lesezugriff `getSelection().text` — und nichts sonst.
  if (options.wordAuswahl !== undefined || options.wordMarkierung !== undefined) {
    const word =
      options.wordAuswahl !== undefined
        ? buildFakeWord(options.wordAuswahl)
        : buildFakeWordMarkierung(options.wordMarkierung as FakeWordMarkierung);
    globals.Word = word;
    globals.window.Word = word;
  } else {
    entfernen("Word");
  }

  // --- 5. DOM aufbauen und das AUSGELIEFERTE Skript ausfuehren -----------------------------------
  globals.document.body.innerHTML = markup;
  // `q` wird HIER deklariert — im dynamischen Skriptrumpf, gemeinsam mit dem Panelcode, damit es
  // dieselbe Sicht auf das DOM hat wie das Panel selbst.
  const scriptSource = `${script}
    function q(selector) { return document.querySelector(selector); }
    return {
      setLang: setLang,
      setTab: setTab,
      sendSelection: sendSelection,
      sendDocument: sendDocument,
      stopLoginPolling: stopLoginPolling,
      askKlara: askKlara,
      q: q,
      t: t
    };`;
  const exports = new Function(scriptSource)() as PanelExports;

  let restored = false;
  const flush = async (): Promise<void> => {
    for (let i = 0; i < 6; i += 1) {
      await new Promise<void>((done) => {
        originalSetTimeout(() => done(), 0);
      });
    }
  };

  return {
    q: exports.q,
    text(selector: string): string {
      const element = exports.q(selector);
      if (element === null) {
        throw new Error(`Panel: Stelle ${selector} existiert nicht`);
      }
      return element.textContent ?? "";
    },
    setLang: exports.setLang,
    setTab: exports.setTab,
    sendSelection: exports.sendSelection,
    sendDocument: exports.sendDocument,
    stopLoginPolling: exports.stopLoginPolling,
    askKlara: exports.askKlara,
    t: exports.t,
    calls,
    flush,
    scriptSource,
    // ============================================================================================
    // DIE RUECKSETZUNG — FESTE, DOKUMENTIERTE REIHENFOLGE.
    // ============================================================================================
    // 1. `stopLoginPolling()` UNBEDINGT zuerst: es erhoeht die Generation, raeumt Poll- und
    //    Deadline-Timer ab, bricht einen laufenden Fetch ab, schliesst ein Dialog-Handle und fasst
    //    dabei noch DOM-Stellen an — es MUSS also vor dem DOM-Abbau laufen.
    // 2. Verbliebene Timer dieses Laufs abraeumen (Office-Frist, Ask-Frist, AI-Status-Frist).
    // 3. Timer-Funktionen zuruecksetzen.
    // 4. `fetch` zuruecksetzen (oder entfernen, wenn es vorher keines gab).
    // 5. `Office`/`Word` zuruecksetzen (dito).
    // 6. DOM zuruecksetzen (Rumpf und Sprachattribut).
    // Danach ist das Panel unbenutzbar — ein zweiter Aufruf ist ein Testfehler, kein Rauschen.
    restore(): void {
      if (restored) {
        return;
      }
      restored = true;
      exports.stopLoginPolling();
      for (const id of openTimeouts) {
        originalClearTimeout(id);
      }
      openTimeouts.clear();
      for (const id of openIntervals) {
        originalClearInterval(id);
      }
      openIntervals.clear();
      globals.setTimeout = originalSetTimeout;
      globals.clearTimeout = originalClearTimeout;
      globals.setInterval = originalSetInterval;
      globals.clearInterval = originalClearInterval;
      if (hadFetch) {
        globals.fetch = originalFetch;
        globals.window.fetch = originalFetch;
      } else {
        entfernen("fetch");
      }
      if (hadOffice) {
        globals.Office = originalOffice;
        globals.window.Office = originalOffice;
      } else {
        entfernen("Office");
      }
      if (hadWord) {
        globals.Word = originalWord;
        globals.window.Word = originalWord;
      } else {
        entfernen("Word");
      }
      globals.document.body.innerHTML = originalBody;
      globals.document.documentElement.lang = originalLang;
    },
  };
}

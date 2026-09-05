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

export const TASKPANE_PATH = "apps/web/public/word-addin/taskpane.html";

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

function buildFakeOffice(selectionHtml: string, selectionText: string): Record<string, unknown> {
  const coercion = { Html: "html", Text: "text" };
  const asyncStatus = { Succeeded: "succeeded", Failed: "failed" };
  return {
    CoercionType: coercion,
    AsyncResultStatus: asyncStatus,
    // Das Panel erkennt Office ueber `Office.onReady` MIT Frist; ein synchroner Rueckruf ist der
    // deterministische Fall „Office ist sofort bereit".
    onReady: (callback: () => void): void => {
      callback();
    },
    context: {
      document: {
        getSelectedDataAsync: (
          type: string,
          callback: (result: FakeOfficeResult) => void,
        ): void => {
          if (type === coercion.Html) {
            callback({ status: asyncStatus.Succeeded, value: selectionHtml });
            return;
          }
          // JOB 3057 K2: der TEXT-Zugriff speist die Markierungskarte (und die Frage-Herkunft).
          // Grundwert bleibt leer — bestehende Faelle stellen keine Textmarkierung und sollen
          // durch die Karte nicht ploetzlich eine bekommen.
          callback({ status: asyncStatus.Succeeded, value: selectionText });
        },
      },
    },
  };
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

function readTaskpane(): string {
  return readFileSync(resolve(process.cwd(), TASKPANE_PATH), "utf8");
}

/** Rumpf und Inline-Skript aus der AUSGELIEFERTEN Seite schneiden (kein zweiter Quelltext). */
export function splitTaskpane(html: string): { markup: string; script: string } {
  const bodyOpen = html.indexOf("<body>");
  const scriptOpen = html.indexOf("<script>", bodyOpen);
  const scriptClose = html.lastIndexOf("</script>");
  if (bodyOpen < 0 || scriptOpen < 0 || scriptClose < scriptOpen) {
    throw new Error("taskpane.html: Rumpf/Skript nicht auffindbar");
  }
  return {
    markup: html.slice(bodyOpen + "<body>".length, scriptOpen),
    script: html.slice(scriptOpen + "<script>".length, scriptClose),
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
    const key = Object.keys(routes)
      .filter((candidate) => url.startsWith(candidate))
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
    );
    globals.Office = office;
    globals.window.Office = office;
  }
  // `Word` bleibt bewusst ungesetzt: der Auswahl-Weg braucht es nicht, und ein halb gefaelschtes
  // Word.run wuerde einen Pfad vortaeuschen, den dieser Test nicht deckt.
  entfernen("Word");

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

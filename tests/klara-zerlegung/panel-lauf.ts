// ================================================================================================
// JOB 3014 · RUNDE 2 — DAS AUFGABENFENSTER ALS ECHTES DOKUMENT LADEN, JE FASSUNG EIN EIGENES.
// ================================================================================================
//
// WOGEGEN DIESE DATEI STEHT — der tragende Befund der Prüfung von Runde 1 (BEN, Korrekturpflicht 1):
//
//     „Lieferung 4 lädt nicht Original und Probeschnitt als verschiedene Seiten. […] übergibt
//      beiden Fassungen denselben mechanisch extrahierten Skripttext."
//
// Das war ein Scheinvergleich: der Test setzte beide Seiten von Hand aus denselben zwei Bausteinen
// zusammen und verglich sie dann. Ein Unterschied, der genau AM SCHNITT entsteht — Inline-Skript
// gegen externe Datei —, konnte dabei gar nicht sichtbar werden; BENs Gegenprobe über
// `document.currentScript.src` lief grün durch, obwohl sie beide Fassungen wirklich unterscheidet.
//
// WAS HIER STATTDESSEN GESCHIEHT: Jede Fassung bekommt ein EIGENES jsdom-Fenster. Hineingegeben
// wird nur die vollständige HTML-Antwort, die der Server GESENDET hat. Alles Weitere holt sich das
// Dokument selbst über einen Ressourcenlader:
//   · `taskpane.js` und `taskpane.css` → über `app.inject` aus DERSELBEN Fastify-App, also über die
//     echte Auslieferung (`registerSecurityHeaders` + `registerWebStatic`).
//   · `office.js` → eine kontrollierte Attrappe, die jeden Office-Zugriff des Panels mitschreibt.
// Das Original fordert dabei WENIGER Ressourcen an als der Probeschnitt (es trägt Stil und Skript
// in sich) — genau diesen Unterschied hält das Protokoll fest, statt ihn wegzudefinieren.
//
// WAS NICHT GEMESSEN IST, und das gehört zur Aussage: jsdom ist kein Browser und kein Word-WebView.
// Gemessen sind Ressourcenanforderung, Skriptausführung, DOM-Zustand, wirksame Stilwerte, Office-
// Zugriffe, Netzaufrufe und Skriptfehler. Nicht gemessen sind Layout, Malzeitpunkt und das
// Verhalten des echten Office-Hosts.
//
// SCHMALE STRUKTUR-TYPEN STATT DOM-LIB: der Gate-tsc läuft Node-rein (`tsconfig.json`,
// `"lib": ["ES2022"]`), und `@types/jsdom` gibt es hier nicht. Deshalb `createRequire` plus
// Struktur-Typen — dieselbe Bauform wie `tests/app/job2551-bildverlust-satz-mounted.test.ts:56 ff.`
// (ein gewöhnliches `import { JSDOM } from "jsdom"` bricht das Tor mit TS7016).
import { createRequire } from "node:module";
import { join } from "node:path";
import { REPO_WURZEL } from "../support/repoPfad";

// ------------------------------------------------------------------------------------------------
// Struktur-Typen
// ------------------------------------------------------------------------------------------------

interface ElementLike {
  readonly id: string;
  readonly tagName: string;
  readonly className: string;
  readonly textContent: string | null;
  readonly disabled?: boolean;
}

interface StilLike {
  getPropertyValue(name: string): string;
}

interface ZielLike {
  addEventListener(typ: string, fn: unknown, opts?: unknown): void;
}

interface DokumentLike {
  title: string;
  readonly documentElement: { lang: string };
  getElementById(id: string): ElementLike | null;
  querySelector(auswahl: string): ElementLike | null;
  querySelectorAll(auswahl: string): ArrayLike<ElementLike> & Iterable<ElementLike>;
}

interface FensterLike {
  readonly document: DokumentLike;
  readonly EventTarget: { prototype: ZielLike };
  getComputedStyle(el: ElementLike): StilLike;
  addEventListener(typ: string, fn: () => void): void;
  close(): void;
}

interface DomLike {
  readonly window: FensterLike;
}

interface KonsoleLike {
  on(ereignis: string, rueckruf: (fehler: { message?: string }) => void): void;
}

interface JsdomOptionen {
  url: string;
  runScripts: "dangerously";
  /** Ein Objekt statt `"usable"` schaltet das Laden EIN und legt die Abfänger darüber. */
  resources: { interceptors: unknown[] };
  virtualConsole: KonsoleLike;
  beforeParse(fenster: FensterLike): void;
}

interface JsdomModul {
  JSDOM: new (html: string, optionen: JsdomOptionen) => DomLike;
  VirtualConsole: new () => KonsoleLike;
  /**
   * jsdom 29 hat den `ResourceLoader` durch undici-Abfänger ersetzt. `requestInterceptor` ist die
   * mitgelieferte Hilfe dafür: Rückgabe einer `Response` beantwortet die Anfrage synthetisch, und
   * die echte Anfrage wird nie gestellt. Genau das brauchen wir — der Prüfstand darf keine Steckdose
   * nach draußen haben (vgl. `tests/setup-env.ts`, Zusatzbefund mega25 A).
   */
  requestInterceptor: (
    fn: (anfrage: { url: string }, kontext: unknown) => Promise<unknown> | unknown,
  ) => unknown;
}

const jsdom = createRequire(join(REPO_WURZEL, "package.json"))("jsdom") as JsdomModul;

/**
 * `Response` ist eine Laufzeit-Globale von Node 20 — der Gate-tsc kennt sie ohne DOM-lib nicht.
 * Deshalb über einen schmalen Struktur-Typ von `globalThis`, dieselbe Bauform wie beim DOMParser in
 * `tests/app/word-addin-taskpane-version-contract.test.ts:92 ff.`
 */
const AntwortKlasse = (
  globalThis as unknown as {
    Response: new (
      koerper: string,
      init: { status: number; headers: Record<string, string> },
    ) => unknown;
  }
).Response;

function inhaltstypFuer(pfad: string): string {
  if (pfad.endsWith(".css")) {
    return "text/css";
  }
  if (pfad.endsWith(".js")) {
    return "text/javascript";
  }
  return "text/html";
}

// ------------------------------------------------------------------------------------------------
// Die kontrollierten Attrappen
// ------------------------------------------------------------------------------------------------

/** Der Ursprung, unter dem das Dokument im Prüfstand steht — Geschwisterdateien lösen relativ auf. */
export const PRUEFSTAND_URSPRUNG = "http://localhost";

/** Ein GESPEICHERTES Dokument mit fester Adresse: sonst hinge der Abdruck an einer Zufallskennung. */
export const OFFICE_DOKUMENT_URL = "https://pruefstand.invalid/Wartungsplan.docx";

/**
 * Die Office-Attrappe, ausgeliefert ANSTELLE von office.js — als echtes Skript, das der Ressourcen-
 * lader zurückgibt und das Dokument selbst ausführt. Sie schreibt JEDEN Office-Zugriff des Panels
 * mit; daraus wird die Office-Hälfte des Fingerabdrucks.
 *
 * `bereit`: `Office.onReady` läuft sofort — der Word-Zustand, den BEN in Korrekturpflicht 2 verlangt.
 * `ereignisTyp`: die von `Office.EventType.DocumentSelectionChanged` gemeldete Kennung. Sie ist
 * beweglich, damit ein Fall die Office-BINDUNG verändern und den Abdruck kalibrieren kann.
 */
export function officeAttrappe(
  optionen: { bereit?: boolean; ereignisTyp?: string | null } = {},
): string {
  const bereit = optionen.bereit !== false;
  const ereignisTyp =
    optionen.ereignisTyp === undefined ? "documentSelectionChanged" : optionen.ereignisTyp;
  return `(function () {
  window.__kwOfficeAufrufe = [];
  function merke(was) { window.__kwOfficeAufrufe.push(was); }
  var dokument = {
    get url() { merke("document.url"); return ${JSON.stringify(OFFICE_DOKUMENT_URL)}; },
    addHandlerAsync: function (typ, fn) {
      merke("addHandlerAsync:" + String(typ));
      if (typeof fn === "function") { /* der Host ruft ihn erst bei einer Auswahl */ }
    },
    getSelectedDataAsync: function (typ, rueckruf) {
      merke("getSelectedDataAsync:" + String(typ));
      if (typeof rueckruf === "function") { rueckruf({ status: "succeeded", value: "" }); }
    }
  };
  window.Office = {
    context: { document: dokument },
    EventType: ${ereignisTyp === null ? "{}" : `{ DocumentSelectionChanged: ${JSON.stringify(ereignisTyp)} }`},
    CoercionType: { Text: "text", Html: "html" },
    AsyncResultStatus: { Succeeded: "succeeded", Failed: "failed" },
    onReady: function (rueckruf) {
      merke("onReady");
      ${bereit ? 'if (typeof rueckruf === "function") { rueckruf({ host: "Word" }); }' : "/* der Host meldet sich nie */"}
    }
  };
})();`;
}

/** Kein office.js: der ehrliche „nicht in Word"-Zustand — die Kalibrierung gegen den Word-Zustand. */
export const OFFICE_FEHLT = 'window.__kwOfficeAufrufe = ["office.js geladen, aber ohne Office"];';

// ------------------------------------------------------------------------------------------------
// Der Fingerabdruck
// ------------------------------------------------------------------------------------------------

/** Der Startzustand, wie ein Mensch ihn im Panel sieht — als vergleichbarer Wert. */
export interface Fingerabdruck {
  titel: string;
  sprache: string;
  ueberschriften: string[];
  knoepfe: string[];
  askBtnDisabled: boolean;
  karten: string[];
  verborgen: string[];
  /** Wirksame Stilwerte — die Hälfte, die am Inline-`<style>` bzw. an `taskpane.css` hängt. */
  stile: string[];
  /** DOM-Ereignisbindungen, gemessen an `EventTarget.prototype.addEventListener` des Fensters. */
  bindungen: string[];
  /** Jeder Office-Zugriff des Panels, in Reihenfolge (Korrekturpflicht 2). */
  officeAufrufe: string[];
  /** Nur die Ereignisanmeldungen daraus — die Office-Bindungen im engeren Sinn. */
  officeBindungen: string[];
  netzaufrufe: string[];
  /** Skriptfehler und gescheiterte Ressourcen, die jsdom gemeldet hat. */
  fehler: string[];
}

/** Was das Dokument WIRKLICH angefordert hat — der Beleg, dass der Schnitt nachlädt. */
export interface Lauf {
  abdruck: Fingerabdruck;
  geholt: string[];
}

const STILPROBEN: Array<[string, string[]]> = [
  ["body", ["font-family", "background-color", "color"]],
  [".card", ["background-color", "border-radius", "padding"]],
  ["#ask-btn", ["background-color", "color", "border-radius"]],
  [".lang button.active", ["background-color", "color"]],
];

function saubererText(el: ElementLike): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

// ------------------------------------------------------------------------------------------------
// Der Lauf
// ------------------------------------------------------------------------------------------------

export interface LaufOptionen {
  /** Die vollständige HTML-Antwort, die der Server gesendet hat. */
  html: string;
  /** Holt eine Geschwisterdatei — üblicherweise `app.inject` derselben Auslieferung. */
  hole(pfad: string): Promise<{ status: number; koerper: string }>;
  /** Was unter der office.js-Adresse ausgeliefert wird. */
  officeQuelle: string;
}

/** Feste Uhr für beide Fassungen: eine laufende Uhr erzeugt Unterschiede, die nichts bedeuten. */
const FESTE_ZEIT = Date.parse("2026-09-03T08:00:00.000Z");

const OFFICE_CDN = "https://appsforoffice.microsoft.com/";

export async function panelLauf(optionen: LaufOptionen): Promise<Lauf> {
  const geholt: string[] = [];
  const fehler: string[] = [];
  const netzaufrufe: string[] = [];
  const bindungen: Array<{ ziel: unknown; typ: string }> = [];

  const abfaenger = jsdom.requestInterceptor(async (anfrage: { url: string }) => {
    const url = anfrage.url;
    geholt.push(url);
    if (url.startsWith(OFFICE_CDN)) {
      return new AntwortKlasse(optionen.officeQuelle, {
        status: 200,
        headers: { "content-type": "text/javascript" },
      });
    }
    if (url.startsWith(`${PRUEFSTAND_URSPRUNG}/`)) {
      const pfad = url.slice(PRUEFSTAND_URSPRUNG.length);
      const antwort = await optionen.hole(pfad);
      return new AntwortKlasse(antwort.koerper, {
        status: antwort.status,
        headers: { "content-type": inhaltstypFuer(pfad) },
      });
    }
    // Fail-closed: keine Anfrage verlässt den Prüfstand. Ein unerwartetes Ziel wird zum lauten 403,
    // nicht zu einer echten Verbindung.
    return new AntwortKlasse(`nicht erlaubte Quelle: ${url}`, {
      status: 403,
      headers: { "content-type": "text/plain" },
    });
  });

  const konsole = new jsdom.VirtualConsole();
  konsole.on("jsdomError", (e) => {
    fehler.push(String(e?.message ?? e));
  });

  let geladen = false;
  const dom = new jsdom.JSDOM(optionen.html, {
    url: `${PRUEFSTAND_URSPRUNG}/word-addin/taskpane.html`,
    runScripts: "dangerously",
    resources: { interceptors: [abfaenger] },
    virtualConsole: konsole,
    beforeParse(fenster) {
      const roh = fenster as unknown as Record<string, unknown>;
      // Feste Uhr und feste Zufallsquelle — beide Fassungen sehen dasselbe.
      (roh.Date as { now: () => number }).now = () => FESTE_ZEIT;
      (roh.Math as { random: () => number }).random = () => 0.4242;
      // Dieselben Serverantworten für BEIDE Fassungen; sonst verglichen wir zwei Serverstände.
      roh.fetch = (url: string, init?: { method?: string }) => {
        const methode = (init?.method ?? "GET").toUpperCase();
        netzaufrufe.push(`${methode} ${url}`);
        const ok = url === "/api/auth/me" || url === "/api/reasoner/status";
        const koerper: Record<string, unknown> =
          url === "/api/auth/me"
            ? { id: "u1", name: "Prüfer", email: "p@example.invalid" }
            : url === "/api/reasoner/status"
              ? { active: false, mode: "deterministic", reachable: "ok", tasks: {} }
              : {};
        return Promise.resolve({
          ok,
          status: ok ? 200 : 503,
          headers: { get: (): string | null => null },
          json: () => Promise.resolve(koerper),
          text: () => Promise.resolve(""),
        });
      };
      const prototyp = fenster.EventTarget.prototype;
      const urAdd = prototyp.addEventListener;
      prototyp.addEventListener = function (
        this: ZielLike,
        typ: string,
        fn: unknown,
        opts?: unknown,
      ): void {
        bindungen.push({ ziel: this, typ });
        urAdd.call(this, typ, fn, opts);
      };
      fenster.addEventListener("load", () => {
        geladen = true;
      });
    },
  });

  const fenster = dom.window;
  // Auf das Ladeereignis warten, dann die Zusagenketten des Panels auslaufen lassen. Beide Fassungen
  // bekommen dieselbe Zahl an Runden — der Vergleich hängt nicht an der Tagesform der Maschine.
  for (let i = 0; i < 60 && !geladen; i += 1) {
    await new Promise((r) => setTimeout(r, 5));
  }
  for (let i = 0; i < 12; i += 1) {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }

  const roh = fenster as unknown as Record<string, unknown>;
  const officeAufrufe = Array.isArray(roh.__kwOfficeAufrufe)
    ? (roh.__kwOfficeAufrufe as string[]).slice()
    : [];
  const dokument = fenster.document;
  const alle = (auswahl: string): ElementLike[] => Array.from(dokument.querySelectorAll(auswahl));
  const askBtn = dokument.getElementById("ask-btn");

  const kennung = (ziel: unknown): string => {
    if (ziel === fenster) {
      return "window";
    }
    if (ziel === dokument) {
      return "document";
    }
    const el = ziel as ElementLike;
    return el.id ? `#${el.id}` : `<${(el.tagName ?? "?").toLowerCase()}>`;
  };

  const stile: string[] = [];
  for (const [auswahl, eigenschaften] of STILPROBEN) {
    const el = dokument.querySelector(auswahl);
    if (el === null) {
      stile.push(`${auswahl}: fehlt`);
      continue;
    }
    const wirksam = fenster.getComputedStyle(el);
    stile.push(
      `${auswahl}: ${eigenschaften.map((n) => `${n}=${wirksam.getPropertyValue(n)}`).join(" ")}`,
    );
  }

  const abdruck: Fingerabdruck = {
    titel: dokument.title,
    sprache: `${dokument.documentElement.lang}|aktiv=${alle("[id^=lang-]")
      .filter((b) => b.className.includes("active"))
      .map((b) => b.id)
      .join(",")}`,
    ueberschriften: alle("h1, h2, h3").map(
      (el) => `${el.tagName.toLowerCase()}#${el.id}|${saubererText(el)}`,
    ),
    knoepfe: alle("button").map(
      (el) =>
        `#${el.id}|${saubererText(el)}|disabled=${el.disabled === true}|class=${el.className}`,
    ),
    askBtnDisabled: askBtn?.disabled === true,
    karten: alle(".card").map((el) => `#${el.id}|class=${el.className}`),
    verborgen: alle(".hidden").map((el) => (el.id ? `#${el.id}` : `<${el.tagName.toLowerCase()}>`)),
    stile,
    bindungen: bindungen.map((b) => `${kennung(b.ziel)}:${b.typ}`).sort(),
    officeAufrufe,
    officeBindungen: officeAufrufe.filter((a) => a.startsWith("addHandlerAsync:")),
    netzaufrufe: netzaufrufe.slice().sort(),
    fehler: fehler.slice().sort(),
  };

  fenster.close();
  return { abdruck, geholt: geholt.slice().sort() };
}

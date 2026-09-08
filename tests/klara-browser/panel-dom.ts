// JOB 3278: der EINE gemountete Prüfstand der Seitenleiste. Er stand bis hierher inline in
// `panel.test.tsx`; `seitenleiste.test.ts` braucht denselben Aufbau (echtes panel.html, echtes
// i18n.js, echtes panel.js, echter Worker dahinter). Zwei Kopien wären zwei Wahrheiten — deshalb
// ist er hierher gezogen und wird von beiden Dateien benutzt, nicht nachgebaut.
import { createRequire } from "node:module";
import { setImmediate } from "node:timers";
import { harness, read } from "./harness";

/**
 * DER KLEINE DOM-VERTRAG DIESES PRÜFSTANDS.
 *
 * Die Wurzel-`tsconfig.json` fährt `lib: ["ES2022"]` OHNE `dom` und schliesst ausserdem
 * `tests/**\/*.tsx` von der Prüfung aus — deshalb konnte der frühere INLINE-Prüfstand in
 * `panel.test.tsx` `HTMLInputElement` und `Window` benutzen, ohne dass es je jemand nachrechnete.
 * Diese Datei ist `.ts` und WIRD von `npx tsc --noEmit` geprüft. Sie borgt sich darum keinen Typ
 * aus einer Bibliothek, die das Projekt gar nicht lädt, sondern nennt genau die Eigenschaften, die
 * der Prüfstand wirklich anfasst. Braucht eine Prüfung mehr, wächst dieser Vertrag sichtbar mit —
 * statt still auf `any` auszuweichen.
 */
export interface Knoten {
  value: string;
  checked: boolean;
  disabled: boolean;
  hidden: boolean;
  className: string;
  textContent: string | null;
  parentElement: Knoten | null;
  // JOB 3279: `plain()` unten braucht den ungefärbten Knotenbaum — Texte laufen als eigener
  // Knotentyp (nodeType 3), ein `<br>` trägt den Zeilenumbruch, den `textContent` sonst schluckt.
  nodeType: number;
  nodeName: string;
  nodeValue: string | null;
  childNodes: Iterable<Knoten>;
  /** JOB 3279: der gezeichnete Vorschaubaum als Markup — der Vergleich gegen das Gespeicherte. */
  innerHTML: string;
  querySelector(auswahl: string): Knoten | null;
  closest(auswahl: string): Knoten | null;
  dispatchEvent(ereignis: unknown): boolean;
  click(): void;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
}

/** Nur das Stück Fenster, das der Prüfstand benutzt. */
export interface Fenster {
  document: {
    getElementById(id: string): Knoten | null;
    querySelectorAll(auswahl: string): Iterable<Knoten>;
    /** `lang` ist die Sprachumschaltung, `outerHTML` der Nachweis, dass kein Token im DOM steht. */
    documentElement: { lang: string; outerHTML: string };
    body: { textContent: string | null };
  };
  /**
   * JOB 3279: die Browsersprache. Sie entscheidet die Leiste NICHT mehr (Pedi 08.09.: Standard
   * Deutsch) — genau deshalb muss ein Fall lesen können, was jsdom hier meldet, sonst prüfte er
   * die Ablösung gegen eine Annahme statt gegen den gemessenen Wert.
   */
  navigator: { language: string };
  Event: new (typ: string, init?: { bubbles?: boolean; cancelable?: boolean }) => unknown;
  KeyboardEvent: new (
    typ: string,
    init?: { key?: string; bubbles?: boolean; cancelable?: boolean },
  ) => unknown;
  eval(quelle: string): unknown;
  close(): void;
}

const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (html: string, options: object) => { window: Fenster };
};

/**
 * Die Aufräumliste. Sie trägt NUR die Fähigkeit, die `schliesseFenster` benutzt — nicht den vollen
 * `Fenster`-Vertrag. Denn `panel.test.tsx` legt für die Inhaltsskript-Prüfungen eigene JSDOM-Fenster
 * mit den ECHTEN DOM-Typen an (`createRange`, `getSelection`); die sind mit dem verengten
 * `Knoten`-Vertrag dieses Prüfstands strukturell unvereinbar und waren als `Fenster[]` nicht
 * ablegbar. Sie sollen aber nach jedem Fall genauso geschlossen werden.
 */
export interface Schliessbar {
  close(): void;
}

export const windows: Schliessbar[] = [];
export function schliesseFenster(): void {
  for (const window of windows.splice(0)) window.close();
}

/**
 * @param optionen.auswahl `false` mountet die Leiste OHNE vorherige Übernahme — der Ruhezustand,
 * den Pflichtlieferung 4 auf eine Zeile begrenzt. Vorgabe ist die Übernahme (bisheriges Verhalten).
 */
export async function mount(
  optionen: {
    auswahl?: boolean;
    /** JOB 3279: eine BEREITS bestehende Bahn (echtes Fastify dahinter) statt der Attrappe hier. */
    an?: ReturnType<typeof harness>;
    /** JOB 3279: der gemerkte Sprachwunsch, über mehrere Mountvorgänge hinweg beobachtbar. */
    sprache?: { language?: string | null };
    /**
     * JOB 3279 R3 (Bens Korrekturpflicht 1): die ERSTE Antwort des Workers wird angehalten.
     *
     * Ohne das ist der gefährlichste Augenblick der Leiste gar nicht messbar: `mount()` wartet
     * selbst auf `settle()`, also ist die Aufbau-Abfrage IMMER schon beantwortet, bevor ein Fall
     * die erste Zeile schreibt. Der Worker beantwortet die Frage hier sofort — auf den LEEREN
     * Zustand —, aber die Leiste bekommt die Antwort erst, wenn der Fall `freigeben()` ruft.
     * Dazwischen darf er erfassen. `mount()` wartet dann NICHT selbst, sonst hinge es an der
     * eigenen Sperre.
     */
    haltErsteAntwort?: boolean;
  } = {},
) {
  let draft: Record<string, unknown> | null = null;
  const requests: string[] = [];
  const koerper: { url: string; body: Record<string, unknown> }[] = [];
  const h =
    optionen.an ??
    harness(async (url, options) => {
      requests.push(String(url));
      if (options?.body) koerper.push({ url: String(url), body: JSON.parse(String(options.body)) });
      if (String(url).endsWith("/login"))
        return Response.json({
          token: "fixture-session-secret",
          user: { id: "person-a", email: "a@example.test" },
        });
      if (options?.method === "POST")
        draft = {
          id: "draft-test",
          originalAuthor: "person-a",
          payload: JSON.parse(String(options.body)),
        };
      return Response.json(draft, { status: options?.method === "POST" ? 201 : 200 });
    });
  const gemerkt = optionen.sprache ?? {};
  if (optionen.auswahl !== false) await h.capture();
  const dom = new JSDOM(read("panel.html"), {
    url: "https://extension-view.invalid/panel.html",
    runScripts: "outside-only",
  });
  windows.push(dom.window);
  const win = dom.window;
  const pending: Promise<unknown>[] = [];
  const messages: unknown[] = [];
  let oeffne: (() => void) | null = null;
  const gehalten = optionen.haltErsteAntwort
    ? new Promise<void>((frei) => {
        oeffne = frei;
      })
    : null;
  let erste = true;
  Object.defineProperty(win, "chrome", {
    value: {
      runtime: {
        sendMessage: (message: unknown) => {
          messages.push(message);
          // Der Worker antwortet SOFORT — auf den Zustand von jetzt. Zugestellt wird die Antwort
          // aber erst nach `freigeben()`; genau so veraltet sie unterwegs.
          const roh = h.sendRaw(message);
          const halten = gehalten !== null && erste;
          erste = false;
          const job = halten ? gehalten.then(() => roh) : roh;
          pending.push(job);
          return job;
        },
      },
      storage: {
        // JOB 3279 R2 (bens Befund 1): die Speicherereignisse werden ZUGESTELLT, nicht verworfen.
        // Der echte Browser meldet sie an jede offene Erweiterungsansicht; wer sie im Prüfstand
        // wegwirft, kann die offene Seitenleiste gar nicht messen.
        onChanged: { addListener: h.subscribe },
        // Nur die Sprachwahl — echter, beobachtbarer Speicher, damit „beim nächsten Öffnen
        // benutzt" wirklich gemessen und nicht behauptet wird.
        local: {
          get: async (defaults: { language: string | null }) => ({
            language: gemerkt.language ?? defaults.language,
          }),
          set: async (values: { language: string }) => {
            gemerkt.language = values.language;
          },
        },
      },
    },
  });
  win.eval(read("i18n.js"));
  win.eval(read("panel.js"));
  // A real response and its render microtask, never an arbitrary sleep.
  const settle = async () => {
    await new Promise<void>((done) => setImmediate(done));
    while (pending.length) {
      await Promise.all(pending.splice(0));
      await new Promise<void>((done) => setImmediate(done));
    }
  };
  /**
   * Ein Durchlauf der Ereignisschleife, OHNE auf Antworten zu warten. `settle()` kann das nicht:
   * es wartet auf `pending`, und eine angehaltene Antwort kommt dort nie an. Der Worker soll seine
   * eigene Arbeit aber zu Ende bringen dürfen (er sperrt sich selbst, solange er an einer Frage
   * sitzt) — nur die ZUSTELLUNG an die Leiste bleibt hängen.
   */
  const tick = async () => {
    await new Promise<void>((done) => setImmediate(done));
  };
  // Wird die erste Antwort angehalten, wartet `mount()` NICHT: `settle()` hinge an ihr.
  if (!gehalten) await settle();
  /** Die angehaltene erste Antwort zustellen und die Leiste zu Ende arbeiten lassen. */
  const freigeben = async () => {
    if (!oeffne) throw new Error("freigeben() ohne haltErsteAntwort");
    oeffne();
    await settle();
  };
  const el = (id: string) => win.document.getElementById(id) as Knoten;
  const input = (id: string, value: string) => {
    el(id).value = value;
    el(id).dispatchEvent(new win.Event("input", { bubbles: true }));
  };
  const login = async () => {
    input("email", "a@example.test");
    input("password", "fixture-password");
    el("login-form").dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
    await settle();
  };
  /** Sprache umstellen und rendern lassen — beide Sprachen sind Pflicht (Vorführung 11.09.). */
  const sprache = (wert: string) => {
    el("language").value = wert;
    el("language").dispatchEvent(new win.Event("change"));
  };
  /**
   * JOB 3279: die Vorschau ist ein gebauter Baum (`panel.js` `paint()`), kein `<pre>` mehr — ein
   * `<br>` trägt den Zeilenumbruch, den `textContent` sonst verschluckt. Liest ohne zu verändern,
   * damit der lebende Vorschaubaum unter dem Test unangetastet bleibt.
   */
  const lies = (knoten: Knoten): string => {
    let aus = "";
    for (const kind of knoten.childNodes) {
      if (kind.nodeType === 3) aus += kind.nodeValue ?? "";
      else if (kind.nodeName === "BR") aus += "\n";
      else aus += lies(kind);
    }
    return aus;
  };
  const plain = (id: string) => lies(el(id));
  return {
    ...h,
    win,
    el,
    input,
    settle,
    tick,
    freigeben,
    login,
    sprache,
    plain,
    requests,
    koerper,
    messages,
    gemerkt,
  };
}

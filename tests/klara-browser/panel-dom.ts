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
export async function mount(optionen: { auswahl?: boolean } = {}) {
  let draft: Record<string, unknown> | null = null;
  const requests: string[] = [];
  const koerper: { url: string; body: Record<string, unknown> }[] = [];
  const h = harness(async (url, options) => {
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
  if (optionen.auswahl !== false) await h.capture();
  const dom = new JSDOM(read("panel.html"), {
    url: "https://extension-view.invalid/panel.html",
    runScripts: "outside-only",
  });
  windows.push(dom.window);
  const win = dom.window;
  const pending: Promise<unknown>[] = [];
  const messages: unknown[] = [];
  Object.defineProperty(win, "chrome", {
    value: {
      runtime: {
        sendMessage: (message: unknown) => {
          messages.push(message);
          const job = h.sendRaw(message);
          pending.push(job);
          return job;
        },
      },
      storage: { onChanged: { addListener: () => {} } },
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
  await settle();
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
  return { ...h, win, el, input, settle, login, sprache, requests, koerper, messages };
}

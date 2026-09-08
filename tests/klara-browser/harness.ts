import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { expect } from "vitest";
import type { Variants, View } from "../../extensions/klara-browser/types";
const root = resolve("extensions/klara-browser");
export const read = (file: string) => readFileSync(resolve(root, file), "utf8");
type Listener = (...args: unknown[]) => unknown;

/**
 * JOB 3279: Die Seite, nicht der Prüfling. Was `selection.js` für eine reine Textmarkierung
 * liefert (ein Absatz, keine Lücken, kein Bild) — hier als Doppel der SEITE, damit die
 * API-Fälle ohne DOM auskommen. Dass die echte Form wirklich so aussieht, misst
 * `artikel.test.ts` am echten Inhaltsskript in einem echten Dokument.
 */
export const plainVariants = (text: string): Variants => ({
  selection: text.trim()
    ? {
        available: true,
        text,
        nodes: [{ tag: "p", children: [{ tag: "#text", text }] }],
        gaps: [],
        images: 0,
      }
    : { available: false, text, nodes: [], gaps: [], images: 0 },
  article: { available: false, text: "", nodes: [], gaps: [], images: 0 },
  page: { available: false, text: "", nodes: [], gaps: [], images: 0 },
});

type Selected = { text: string; url: string; title: string; variants?: Variants };

export function harness(fetcher: typeof fetch, data: Record<string, unknown> = {}) {
  const listeners: Record<string, Listener> = {};
  const event = (key: string) => ({
    addListener: (fn: Listener) => {
      listeners[key] = fn;
    },
  });
  let selected: Selected = {
    text: `Größe äöü\n<script>alert('x')</script>\n${"Langer Originalsatz. ".repeat(100)}`,
    url: "https://www.perplexity.ai/search/test",
    title: "Testchat",
  };
  // JOB 3278 · CHR-02: die Leiste wird nicht mehr als Tab geöffnet, sondern über die Side-Panel-
  // API. `spuren` hält die REIHENFOLGE der Chrome-Aufrufe fest — daran hängt die Zusicherung, dass
  // `sidePanel.open` VOR dem ersten Speicherzugriff läuft und die Klickgeste damit nicht verwirkt.
  const panelOpens: number[] = [];
  const behaviors: unknown[] = [];
  const spuren: string[] = [];
  const menus: unknown[] = [];
  // JOB 3279 R2: `chrome.storage.session` MELDET seine Änderungen. Der echte Browser tut das
  // (`chrome.storage.onChanged`), dieser Prüfstand verwarf sie bisher — und genau deshalb konnte
  // niemand messen, dass die offene Seitenleiste eine neue Übernahme nicht bemerkt. Die Meldung
  // ist Browserverhalten, kein Prüflingsverhalten.
  type Aenderungen = Record<string, { oldValue?: unknown; newValue?: unknown }>;
  const hoerer: ((changes: Aenderungen, area: string) => void)[] = [];
  const melde = (changes: Aenderungen) => {
    for (const fn of [...hoerer]) fn(changes, "session");
  };
  const session = {
    get: async () => {
      spuren.push("storage.get");
      return structuredClone(data);
    },
    set: async (values: Record<string, unknown>) => {
      spuren.push("storage.set");
      const changes: Aenderungen = {};
      for (const [key, value] of Object.entries(values))
        changes[key] = { oldValue: data[key], newValue: structuredClone(value) };
      Object.assign(data, structuredClone(values));
      melde(changes);
    },
    clear: async () => {
      const changes: Aenderungen = {};
      for (const key of Object.keys(data)) changes[key] = { oldValue: data[key] };
      for (const key of Object.keys(data)) delete data[key];
      melde(changes);
    },
    setAccessLevel: async (level: unknown) => {
      expect(level).toEqual({ accessLevel: "TRUSTED_CONTEXTS" });
    },
  };
  const chrome = {
    runtime: {
      id: "test-extension",
      getURL: (p: string) => `chrome-extension://test-extension/${p}`,
      onMessage: event("message"),
      onInstalled: event("installed"),
    },
    storage: { session },
    contextMenus: {
      onClicked: event("menu"),
      create: (properties: unknown) => menus.push(properties),
      removeAll: async () => {},
    },
    action: { onClicked: event("action") },
    // Bewusst OHNE `setOptions`: eine tabgebundene Leiste würde die ursprüngliche Quelle beim
    // Tabwechsel verlieren. Ruft der Worker es doch, stirbt der Lauf hier statt still zu bestehen.
    sidePanel: {
      open: async ({ tabId }: { tabId: number }) => {
        spuren.push("sidePanel.open");
        panelOpens.push(tabId);
      },
      setPanelBehavior: async (options: unknown) => {
        behaviors.push(options);
      },
    },
    tabs: {
      onActivated: event("activated"),
      onUpdated: event("updated"),
    },
    scripting: {
      executeScript: async (options: unknown) => {
        spuren.push("scripting.executeScript");
        expect(options).toEqual({ target: { tabId: 7 }, files: ["selection.js"] });
        return [
          {
            result: structuredClone({
              ...selected,
              variants: selected.variants ?? plainVariants(selected.text),
            }),
          },
        ];
      },
    },
    i18n: { getMessage: () => "In Klarwerk übernehmen" },
  };
  const context = createContext({
    chrome,
    fetch: fetcher,
    URL,
    TextEncoder,
    AbortSignal,
    crypto: globalThis.crypto,
    setTimeout,
    clearTimeout,
  });
  const boot = () => runInContext(read("worker.js"), context);
  boot();
  const sender = { id: chrome.runtime.id, url: chrome.runtime.getURL("panel.html") };
  const sendRaw = (message: unknown, from: unknown = sender): Promise<View> =>
    new Promise((done) => {
      listeners.message?.(message, from, done);
    });
  const send = (message: unknown, from: unknown = sender): Promise<View> =>
    new Promise((done) => {
      listeners.message?.(
        typeof message === "object" && message !== null
          ? { captureId: (data.work as { id?: string } | undefined)?.id, ...message }
          : message,
        from,
        done,
      );
    });
  const capture = async () => {
    await listeners.action?.({ id: 7, url: selected.url, title: selected.title });
  };
  return {
    send,
    sendRaw,
    capture,
    data,
    panelOpens,
    behaviors,
    spuren,
    menus,
    listeners,
    selected,
    setSelected: (next: Selected) => {
      selected = next;
    },
    /** Der Zuhörer der Leiste an DIESEM Speicher — so meldet der Worker ihr seine Schreibvorgänge. */
    subscribe: (fn: (changes: Aenderungen, area: string) => void) => {
      hoerer.push(fn);
    },
    boot,
  };
}

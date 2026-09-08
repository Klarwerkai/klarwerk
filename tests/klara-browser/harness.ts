import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { expect } from "vitest";
import type { View } from "../../extensions/klara-browser/types";
const root = resolve("extensions/klara-browser");
export const read = (file: string) => readFileSync(resolve(root, file), "utf8");
type Listener = (...args: unknown[]) => unknown;
export function harness(fetcher: typeof fetch, data: Record<string, unknown> = {}) {
  const listeners: Record<string, Listener> = {};
  const event = (key: string) => ({
    addListener: (fn: Listener) => {
      listeners[key] = fn;
    },
  });
  let selected = {
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
  const session = {
    get: async () => {
      spuren.push("storage.get");
      return structuredClone(data);
    },
    set: async (values: Record<string, unknown>) => {
      spuren.push("storage.set");
      Object.assign(data, structuredClone(values));
    },
    clear: async () => {
      for (const key of Object.keys(data)) delete data[key];
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
        return [{ result: structuredClone(selected) }];
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
    setSelected: (next: typeof selected) => {
      selected = next;
    },
    boot,
  };
}

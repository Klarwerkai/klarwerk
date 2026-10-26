import { afterEach, beforeEach, expect, it, vi } from "vitest";
// @vitest-environment jsdom
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import App from "../../apps/web/src/App";
import { SITZUNGSENDE_KEY } from "../../apps/web/src/lib/lokaleSitzung";
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let qc: QueryClient | null = null;
let session = true;
let protectedCalls: string[] = [];
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
async function settle(ok: () => boolean) {
  for (let i = 0; i < 100 && !ok(); i++)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  expect(ok()).toBe(true);
}
beforeEach(() => {
  session = true;
  protectedCalls = [];
  localStorage.clear();
  onlineManager.setOnline(true);
  window.history.replaceState({}, "", "/mobile");
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  let tail = Promise.resolve();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (_n: string, job: () => unknown) => {
        const r = tail.then(job);
        tail = r.then(
          () => {},
          () => {},
        );
        return r;
      },
    },
  });
  Element.prototype.scrollIntoView = () => {};
  vi.stubGlobal("scrollTo", () => {});
  vi.stubGlobal("fetch", async (input: unknown) => {
    const url = String(input);
    if (url.includes("/auth/status"))
      return json({ needsSetup: false, passwordLoginEnabled: true });
    if (url.includes("/auth/me"))
      return session
        ? json({ id: "gate-konto", role: "experte", email: "gate@example.test", displayName: "A" })
        : json({ error: "INVALID_CREDENTIALS" }, 401);
    protectedCalls.push(url);
    if (url.includes("/features")) return json({ features: {} });
    if (url.includes("/api/drafts") || url.includes("/api/kos") || url.includes("/conflicts"))
      return json([]);
    return json({});
  });
});
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  qc?.clear();
  root = null;
  qc = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
async function mount() {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () =>
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc as QueryClient },
        createElement(MemoryRouter, { initialEntries: ["/mobile"] }, createElement(App)),
      ),
    ),
  );
  await settle(() => el.querySelector("textarea") !== null);
  return el;
}
async function fill(el: HTMLElement, text: string) {
  const field = el.querySelector("textarea");
  if (!field) throw new Error("Echte mobile Eingabe fehlt");
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (!setter) throw new Error("DOM-Wertport fehlt");
  await act(async () => {
    setter.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(field.value).toBe(text);
  return field;
}
it("echte schmutzige Mobile-Eingabe bleibt bei 401 gemountet; Wache und bewusster Weg zur Anmeldung, keine weiteren geschützten Requests", async () => {
  const el = await mount();
  const text = "UNGERETTETE-EINGABE-MIT-EIGENER-BEOBACHTUNG";
  const field = await fill(el, text);
  session = false;
  const before = protectedCalls.length;
  await act(async () => {
    await qc?.invalidateQueries({ queryKey: ["auth", "me"] });
  });
  await settle(() => document.querySelector("[data-navguard-dialog]") !== null);
  expect(field.isConnected).toBe(true);
  expect(field.value).toBe(text);
  expect(el.textContent).toContain("Sitzung ist beendet");
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  expect(protectedCalls).toHaveLength(before);
  const discard = Array.from(document.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Verwerfen"),
  );
  if (!discard) throw new Error("Bewusste Verwerfungsentscheidung fehlt");
  await act(async () => discard.click());
  await settle(() => el.querySelector('input[type="password"]') !== null);
  expect(field.isConnected).toBe(false);
});
it("Abmeldung in einem anderen Tab bewahrt die schmutzige Eingabe bis zur bewussten Entscheidung und sperrt geschützte HTTP-Aufrufe", async () => {
  const el = await mount();
  const field = await fill(el, "UNGESICHERTER-TEXT-AUS-DIESEM-TAB");
  const before = protectedCalls.length;
  await act(async () => {
    localStorage.setItem(SITZUNGSENDE_KEY, "anderer-tab");
    window.dispatchEvent(
      new StorageEvent("storage", { key: SITZUNGSENDE_KEY, newValue: "anderer-tab" }),
    );
  });
  await settle(() => document.querySelector("[data-navguard-dialog]") !== null);
  expect(field.isConnected).toBe(true);
  expect(field.value).toBe("UNGESICHERTER-TEXT-AUS-DIESEM-TAB");
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  expect(protectedCalls).toHaveLength(before);
});
it("der echte Mobile-Speicherknopf behält eine Eingabe bei dauerhaftem Speicherfehler", async () => {
  const el = await mount();
  const text = "Wartungsbeobachtung mit ausreichendem Inhalt";
  const field = await fill(el, text);
  const button = el.querySelector<HTMLButtonElement>('[data-testid="mob-primaer"]');
  await settle(() => Boolean(button && !button.disabled));
  const writes = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Kontingent voll", "QuotaExceededError");
  });
  await act(async () => button?.click());
  await settle(() => writes.mock.calls.length > 0);
  expect(field.value).toBe(text);
  expect(localStorage.getItem("kw.offlineQueue.v1")).toBeNull();
});

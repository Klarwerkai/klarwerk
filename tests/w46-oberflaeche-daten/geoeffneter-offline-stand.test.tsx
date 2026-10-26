// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { type OfflineQueueApi, useOfflineQueue } from "../../apps/web/src/app/useOfflineQueue";
import i18n from "../../apps/web/src/i18n";
import { offlineVorgangsStand } from "../../apps/web/src/lib/offlineQueue";
import { readOfflineQueue, writeOfflineQueue } from "../../apps/web/src/lib/offlineQueueStorage";
import { Mobile } from "../../apps/web/src/pages/Mobile";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const KONTO = "geoeffneter-stand-konto";
const DID = "server-draft";
const ZEIT = "2026-10-26T10:00:00.000Z";
const ALTER_TEXT = "Bs beim Öffnen vorhandener eigener Text";
const NEUER_TEXT = "A hat den lokalen Vorgang später geändert";
let online = false;
let authHaelt = false;
let writes: string[] = [];
let a: OfflineQueueApi | undefined;
const roots: { root: Root; qc: QueryClient }[] = [];
const authAntworten: (() => void)[] = [];
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json" } });
const user = {
  id: KONTO,
  role: "experte",
  email: "stand@example.test",
  displayName: "Eigene Person",
};
const draft = {
  id: DID,
  originalAuthor: KONTO,
  lastEditor: KONTO,
  createdAt: ZEIT,
  updatedAt: ZEIT,
  payload: { title: "Serverfassung", statement: "Abweichender Servertext" },
};
async function bis(test: () => boolean) {
  for (let i = 0; i < 200 && !test(); i++)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  expect(test()).toBe(true);
}
function A(): null {
  a = useOfflineQueue();
  return null;
}
function port() {
  if (!a) throw new Error("Echter A-Hookport fehlt");
  return a;
}
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  online = false;
  authHaelt = false;
  writes = [];
  a = undefined;
  onlineManager.setOnline(true);
  await i18n.changeLanguage("de");
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
  let tail = Promise.resolve();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (_name: string, job: () => unknown) => {
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
  vi.stubGlobal("fetch", async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method !== "GET") {
      writes.push(`${method} ${url}`);
      return json({ error: "Unerwarteter Schreibaufruf" }, 500);
    }
    if (url.endsWith("/auth/status")) return json({ needsSetup: false });
    if (url.endsWith("/auth/me")) {
      if (authHaelt) await new Promise<void>((resolve) => authAntworten.push(resolve));
      return json(user);
    }
    if (url.endsWith("/drafts")) return json([draft]);
    if (url.endsWith(`/drafts/${DID}`)) return json(draft);
    if (url.includes("/features")) return json({ features: {} });
    if (url.includes("/upload-limits"))
      return json({ maxAttachments: 10, maxAttachmentBytes: 20000000 });
    return json([]);
  });
  writeOfflineQueue([
    {
      id: "lokaler-vorgang",
      kind: "draft.update",
      draftId: DID,
      title: "Geöffnete lokale Fassung",
      payload: { title: "Geöffnete lokale Fassung", statement: ALTER_TEXT },
      eigentuemer: KONTO,
      createdAt: ZEIT,
      seenUpdatedAt: ZEIT,
      status: "queued",
      error: null,
    },
  ]);
});
afterEach(async () => {
  online = false;
  await act(async () => {
    window.dispatchEvent(new Event("offline"));
    for (const { root } of roots) root.unmount();
  });
  for (const { qc } of roots.splice(0)) qc.clear();
  for (const weiter of authAntworten.splice(0)) weiter();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
async function montiere(mobile: boolean) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  roots.push({ root, qc });
  const child = mobile
    ? createElement(NavGuardProvider, null, createElement(Mobile), createElement(ToastViewport))
    : createElement(A);
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          null,
          createElement(
            AuthProvider,
            null,
            createElement(RoleProvider, null, createElement(ToastProvider, null, child)),
          ),
        ),
      ),
    ),
  );
  await bis(() => qc.getQueryData<{ id: string }>(["auth", "me"])?.id === KONTO);
  return { el, qc };
}
async function setup() {
  const b = await montiere(true);
  const first = await montiere(false);
  await bis(
    () =>
      Boolean(b.el.querySelector('[data-testid="mobil-entwurf-fortsetzen"]')) &&
      port().queue.length === 1,
  );
  return { b, first };
}
async function oeffnen(el: HTMLElement) {
  const button = el.querySelector<HTMLButtonElement>('[data-testid="mobil-entwurf-fortsetzen"]');
  if (!button) throw new Error("Echter Fortsetzenknopf fehlt");
  await act(async () => button.click());
  await bis(() => el.querySelector<HTMLTextAreaElement>("textarea")?.value === ALTER_TEXT);
  const field = el.querySelector<HTMLTextAreaElement>("textarea");
  if (!field) throw new Error("Echte geöffnete Eingabe fehlt");
  return field;
}
async function aAendertUndBVerarbeitet(el: HTMLElement) {
  const opened = port().queue[0];
  if (!opened) throw new Error("Ausgangsvorgang fehlt");
  await act(async () => {
    expect(
      await port().replace(
        opened.id,
        { title: "A_NEUE_FASSUNG", statement: NEUER_TEXT },
        "A_NEUE_FASSUNG",
        offlineVorgangsStand(opened),
        ZEIT,
      ),
    ).toMatchObject({ id: opened.id });
  });
  await act(async () =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "kw.offlineQueue.v1",
        newValue: localStorage.getItem("kw.offlineQueue.v1"),
      }),
    ),
  );
  await bis(
    () =>
      el
        .querySelector('[data-testid="mob-warteschlange"]')
        ?.textContent?.includes("A_NEUE_FASSUNG") === true,
  );
}
function neuesteFassungBleibt() {
  const stored = readOfflineQueue<{ title: string; payload: { statement: string } }>();
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ title: "A_NEUE_FASSUNG", payload: { statement: NEUER_TEXT } });
  expect(writes).toEqual([]);
}
it("echtes Mobile: nach Wiederaufnahme und verarbeitetem fremden Queueereignis wird altes Formular über enqueue abgewiesen", async () => {
  const { b } = await setup();
  const field = await oeffnen(b.el);
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (!setter) throw new Error("Eingabeport fehlt");
  const eigenerText = "Bs danach bearbeiteter ungesicherter eigener Text";
  await act(async () => {
    setter.call(field, eigenerText);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await aAendertUndBVerarbeitet(b.el);
  expect(field.value).toBe(eigenerText);
  const save = b.el.querySelector<HTMLButtonElement>('[data-testid="mob-primaer"]');
  if (!save) throw new Error("Echter Speicherknopf fehlt");
  expect(save.disabled).toBe(false);
  await act(async () => save.click());
  await bis(() => b.el.textContent?.includes("nicht sicher gespeichert") === true);
  expect(field.isConnected).toBe(true);
  expect(field.value).toBe(eigenerText);
  neuesteFassungBleibt();
});
it("echtes Mobile: offener Standvergleich bindet replace vor dem Ereignis; Meine Fassung behalten überschreibt A danach nicht", async () => {
  const { b, first } = await setup();
  authHaelt = true;
  await act(async () => {
    void b.qc.invalidateQueries({ queryKey: ["auth", "me"] });
    void first.qc.invalidateQueries({ queryKey: ["auth", "me"] });
    await new Promise((r) => setTimeout(r, 5));
  });
  await bis(() => b.qc.getQueryState(["auth", "me"])?.fetchStatus === "fetching");
  online = true;
  await act(async () => window.dispatchEvent(new Event("online")));
  const field = await oeffnen(b.el);
  await bis(() => b.el.querySelector('[data-testid="mob-stand-felder"]') !== null);
  await aAendertUndBVerarbeitet(b.el);
  const keep = Array.from(b.el.querySelectorAll("button")).find(
    (x) => x.textContent?.trim() === i18n.t("mob.stand.behalten"),
  );
  if (!keep) throw new Error("Echte Auflösungsentscheidung fehlt");
  await act(async () => keep.click());
  await bis(() => b.el.textContent?.includes("nicht sicher gespeichert") === true);
  expect(field.isConnected).toBe(true);
  expect(field.value).toBe(ALTER_TEXT);
  expect(b.el.querySelector('[data-testid="mob-stand-felder"]')).not.toBeNull();
  neuesteFassungBleibt();
});

// @vitest-environment jsdom
// Echter Mobile-/NavGuard-/Unload-/Queue-Weg; nur die Serverantworten sind kontrolliert.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    drafts: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    ko: { list: vi.fn(async () => []) },
    conflicts: { list: vi.fn(async () => []) },
    library: { search: vi.fn(async () => []) },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { Draft } from "../../apps/web/src/api/types";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Mobile } from "../../apps/web/src/pages/Mobile";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TEXT = "Vor dem Start die Pumpe prüfen.";
const DRAFT: Draft = {
  id: "draft-review26-3463",
  payload: {
    title: "Schichtwechsel",
    statement: "Dosierwert kontrollieren.",
    bodyHtml: `<p>${TEXT}</p>`,
  },
  originalAuthor: "pedi",
  lastEditor: "pedi",
  createdAt: "2026-09-08T07:00:00.000Z",
  updatedAt: "2026-09-08T07:00:00.000Z",
};
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

beforeEach(() => {
  onlineManager.setOnline(true);
  localStorage.clear();
  vi.mocked(endpoints.drafts.list).mockReset();
  vi.mocked(endpoints.drafts.update).mockReset();
  vi.mocked(endpoints.drafts.create).mockReset();
  vi.mocked(endpoints.drafts.list).mockResolvedValue([DRAFT]);
  vi.mocked(endpoints.drafts.update).mockResolvedValue(DRAFT);
  vi.mocked(endpoints.drafts.create).mockResolvedValue(DRAFT);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  qc?.clear();
  onlineManager.setOnline(true);
  localStorage.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(
            NavGuardProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: [{ pathname: "/mobile", state: { from: "/bibliothek" } }] },
              createElement(
                Routes,
                null,
                createElement(Route, { path: "/mobile", element: createElement(Mobile) }),
                createElement(Route, {
                  path: "/bibliothek",
                  element: createElement("div", null, "BIBLIOTHEK-SEITE"),
                }),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

function button(key: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === i18n.t(key),
  );
  if (!found) throw new Error(`Knopf fehlt: ${key}`);
  return found;
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click();
  });
  await act(flush);
}

function textbox(): HTMLTextAreaElement {
  const box = container.querySelector("textarea");
  if (!box) throw new Error("Mobile-Textfeld fehlt");
  return box;
}

async function type(text: string): Promise<void> {
  await act(async () => {
    const box = textbox();
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(box, text);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function resume(): Promise<void> {
  const found = [...container.querySelectorAll("button")].find(
    (b) => b.title === i18n.t("mob.resume"),
  );
  if (!found) throw new Error("Fortsetzen-Knopf fehlt");
  await click(found);
  expect(textbox().value).toBe(TEXT);
  expect(container.querySelector("input")?.value).toBe(DRAFT.payload.title);
}

function unloadBlocked(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

function expectDialog(): void {
  expect(container.querySelector("[data-navguard-dialog]")).not.toBeNull();
  expect(container.textContent).toContain(i18n.t("nav.guard.title"));
  expect(container.textContent).not.toContain("BIBLIOTHEK-SEITE");
  for (const key of ["nav.guard.stay", "nav.guard.discard", "nav.guard.save"])
    expect(button(key)).toBeDefined();
}

function expectDesktop(): void {
  expect(container.querySelector("[data-navguard-dialog]")).toBeNull();
  expect(container.textContent).toContain("BIBLIOTHEK-SEITE");
}

describe("REVIEW26: fortgesetzter Mobilentwurf", () => {
  it("Fall A: unverändert fortsetzen und Zur Vollversion navigiert ohne Dialog", async () => {
    await mount();
    await resume();
    expect(button("mob.update").disabled).toBe(false);
    await click(button("topbar.toDesktop"));
    expectDesktop();
    expect(endpoints.drafts.update).not.toHaveBeenCalled();
    expect(endpoints.drafts.create).not.toHaveBeenCalled();
    expect(endpoints.drafts.remove).not.toHaveBeenCalled();
  });

  it("Fall B: ein Zeichen im fortgesetzten Text löst den Dialog aus", async () => {
    await mount();
    await resume();
    await type(`${TEXT}!`);
    await click(button("topbar.toDesktop"));
    expectDialog();
    expect(unloadBlocked()).toBe(true);
    await click(button("nav.guard.stay"));
    expect(textbox().value).toBe(`${TEXT}!`);
  });

  it("Fall C: unverändert fortsetzen blockiert beforeunload nicht", async () => {
    await mount();
    await resume();
    expect(unloadBlocked()).toBe(false);
  });

  it("Fall D: neu getippter Text löst den Dialog aus", async () => {
    await mount();
    await type("Neuer ungespeicherter Gedanke.");
    await click(button("topbar.toDesktop"));
    expectDialog();
    expect(unloadBlocked()).toBe(true);
  });

  it("Änderung rückgängig machen gibt beide Wächter frei", async () => {
    await mount();
    await resume();
    await type(`${TEXT}!`);
    expect(unloadBlocked()).toBe(true);
    await type(` ${TEXT}\n`);
    expect(unloadBlocked()).toBe(false);
    await click(button("topbar.toDesktop"));
    expectDesktop();
  });

  it("Fortsetzen ohne Body vergleicht die Kernaussage", async () => {
    vi.mocked(endpoints.drafts.list).mockResolvedValue([
      { ...DRAFT, payload: { title: "Schichtwechsel", statement: TEXT } },
    ]);
    await mount();
    await resume();
    expect(textbox().dataset.testid).toBe("mob-statement");
    expect(unloadBlocked()).toBe(false);
    await type(`${TEXT}!`);
    await click(button("topbar.toDesktop"));
    expectDialog();
  });

  it.each([false, true])(
    "Listenauffrischung verändert den Ausgangsstand nicht (bearbeitet: %s)",
    async (changed) => {
      await mount();
      await resume();
      if (changed) await type(`${TEXT}!`);
      let rejectRefresh: (error: Error) => void = () => {
        throw new Error("Refetch nicht gestartet");
      };
      vi.mocked(endpoints.drafts.list).mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectRefresh = reject;
          }),
      );
      await act(async () => {
        void qc.invalidateQueries({ queryKey: ["drafts"] });
      });
      expect(qc.getQueryState(["drafts"])?.fetchStatus).toBe("fetching");
      expect(unloadBlocked()).toBe(changed);
      await act(async () => {
        rejectRefresh(new Error("Auffrischung fehlgeschlagen"));
      });
      await act(flush);
      expect(qc.getQueryState(["drafts"])?.status).toBe("error");
      expect(textbox().value).toBe(changed ? `${TEXT}!` : TEXT);
      expect(unloadBlocked()).toBe(changed);
      await click(button("topbar.toDesktop"));
      if (changed) expectDialog();
      else expectDesktop();
    },
  );

  it("neuer Serverstand übernimmt keine ungespeicherte Änderung als Ausgangsstand", async () => {
    await mount();
    await resume();
    await type(`${TEXT}!`);
    vi.mocked(endpoints.drafts.list).mockResolvedValue([
      { ...DRAFT, payload: { ...DRAFT.payload, bodyHtml: `<p>${TEXT}!</p>` } },
    ]);
    await act(async () => {
      await qc.invalidateQueries({ queryKey: ["drafts"] });
    });
    await act(flush);
    expect(qc.getQueryData<Draft[]>(["drafts"])?.[0]?.payload.bodyHtml).toBe(`<p>${TEXT}!</p>`);
    expect(unloadBlocked()).toBe(true);
    await click(button("topbar.toDesktop"));
    expectDialog();
  });

  it.each(["online", "offline"] as const)(
    "Speichern %s leert Formular und Ausgangsstand",
    async (mode) => {
      await mount();
      await resume();
      await type(`${TEXT}!`);
      if (mode === "offline")
        await act(async () => {
          window.dispatchEvent(new Event("offline"));
        });
      await click(button("mob.update"));
      expect(textbox().value).toBe("");
      expect(unloadBlocked()).toBe(false);
      if (mode === "online") {
        expect(endpoints.drafts.update).toHaveBeenCalledTimes(1);
        expect(endpoints.drafts.update).toHaveBeenCalledWith(DRAFT.id, {
          title: "Schichtwechsel",
          bodyHtml: `<p>${TEXT}!</p>`,
        });
      } else {
        expect(endpoints.drafts.update).not.toHaveBeenCalled();
        expect(JSON.parse(localStorage.getItem("kw.offlineQueue.v1") ?? "[]")).toMatchObject([
          {
            kind: "draft.update",
            draftId: DRAFT.id,
            payload: { bodyHtml: `<p>${TEXT}!</p>` },
            status: "queued",
          },
        ]);
      }
      await click(button("topbar.toDesktop"));
      expectDesktop();
    },
  );

  it.each(["online", "offline"] as const)(
    "Dialogspeichern %s sichert und wechselt",
    async (mode) => {
      await mount();
      await resume();
      await type(`${TEXT}!`);
      if (mode === "offline")
        await act(async () => {
          window.dispatchEvent(new Event("offline"));
        });
      await click(button("topbar.toDesktop"));
      expectDialog();
      await click(button("nav.guard.save"));
      expectDesktop();
      expect(unloadBlocked()).toBe(false);
      if (mode === "online") {
        expect(endpoints.drafts.update).toHaveBeenCalledTimes(1);
        expect(endpoints.drafts.update).toHaveBeenCalledWith(DRAFT.id, {
          title: "Schichtwechsel",
          bodyHtml: `<p>${TEXT}!</p>`,
        });
      } else {
        expect(endpoints.drafts.update).not.toHaveBeenCalled();
        expect(JSON.parse(localStorage.getItem("kw.offlineQueue.v1") ?? "[]")).toMatchObject([
          { draftId: DRAFT.id, payload: { bodyHtml: `<p>${TEXT}!</p>` }, status: "queued" },
        ]);
      }
    },
  );

  it("gescheitertes Speichern erhält Eingabe und Schutz", async () => {
    vi.mocked(endpoints.drafts.update).mockRejectedValue(new Error("Speichern fehlgeschlagen"));
    await mount();
    await resume();
    await type(`${TEXT}!`);
    await click(button("mob.update"));
    expect(textbox().value).toBe(`${TEXT}!`);
    expect(unloadBlocked()).toBe(true);
    await click(button("topbar.toDesktop"));
    expectDialog();
  });

  it("Neues Formular setzt auch den Ausgangsstand zurück", async () => {
    await mount();
    await resume();
    await click(button("mob.new"));
    expect(textbox().value).toBe("");
    expect(unloadBlocked()).toBe(false);
    await type(TEXT);
    await click(button("topbar.toDesktop"));
    expectDialog();
  });
});

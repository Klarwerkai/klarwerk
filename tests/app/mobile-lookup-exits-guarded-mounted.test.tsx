// @vitest-environment jsdom
// AUFTRAG-mega12 Block C (ECHTER Treffer, gefunden beim Bauen der Architekturprüfung): Mobile.tsx
// meldet einen Ungespeichert-Wächter an (isDraftFormFillable), hatte aber DREI rohe <Link> —
// die Quellen-Verweise der Antwort, der Lücken-Verweis und die Treffer der Nachschlagen-Liste.
//
// Der Verlustpfad ist derselbe wie in bens SB-2-Befund, nur auf dem Telefon: Erfassen-Tab ausfüllen,
// auf „Nachschlagen" wechseln (das Formular lebt in DERSELBEN Komponente weiter, der Text bleibt),
// einen Treffer antippen — die Seite wechselt zu /wissen/:id und die Eingabe ist weg. Ohne Nachfrage.
//
// Dieser Test treibt genau diesen Weg über echte Klicks.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    drafts: {
      list: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: "d1" })),
      update: vi.fn(async () => ({})),
      remove: vi.fn(async () => ({})),
    },
    // Ein Treffer in der Nachschlagen-Liste — daran hängt der zu prüfende Ausgang.
    library: {
      search: vi.fn(async () => [
        { id: "k1", title: "Dichtungsnorm 4711", type: "best_practice", trust: 42, status: "live" },
      ]),
    },
    ask: { ask: vi.fn(async () => ({ answered: false })) },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "../../apps/web/node_modules/react-router-dom";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Mobile } from "../../apps/web/src/pages/Mobile";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function PathProbe(): JSX.Element {
  const loc = useLocation();
  return createElement("span", { "data-testid": "path" }, loc.pathname);
}

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
              { initialEntries: ["/mobile"] },
              createElement(PathProbe),
              createElement(
                Routes,
                null,
                createElement(Route, { path: "/mobile", element: createElement(Mobile) }),
                createElement(Route, {
                  path: "/wissen/:id",
                  element: createElement("div", null, "WISSEN-SEITE"),
                }),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

function path(): string {
  return container.querySelector<HTMLElement>("[data-testid=path]")?.textContent ?? "";
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}“ nicht gefunden`);
  }
  return btn;
}

async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

async function fillStatement(text: string): Promise<void> {
  const box = container.querySelector("textarea");
  if (!(box instanceof HTMLTextAreaElement)) {
    throw new Error("Eingabefeld nicht gefunden");
  }
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(box) as object,
    "value",
  )?.set;
  setter?.call(box, text);
  await act(async () => {
    box.dispatchEvent(new Event("input", { bubbles: true }));
    box.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

async function openLookupWithHit(): Promise<HTMLAnchorElement> {
  await click(buttonByText(i18n.t("mob.tabLookup")));
  const search = container.querySelector<HTMLInputElement>("input");
  if (!search) {
    throw new Error("Suchfeld nicht gefunden");
  }
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(search) as object,
    "value",
  )?.set;
  setter?.call(search, "Dichtung");
  await act(async () => {
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  // Die Suche ist entprellt — warten, bis der Treffer wirklich in der Liste steht.
  for (let i = 0; i < 40 && !pageText().includes("Dichtungsnorm 4711"); i++) {
    await act(flush);
  }
  const hit = [...container.querySelectorAll("a")].find((a) =>
    (a.textContent ?? "").includes("Dichtungsnorm 4711"),
  );
  if (!(hit instanceof HTMLAnchorElement)) {
    throw new Error("Treffer-Link nicht gefunden");
  }
  return hit;
}

describe("Block C: die Ausgänge von /mobile laufen durch den Wächter", () => {
  it("befuellte Eingabe + Tipp auf einen Treffer: Wächter fragt, Route bleibt, Eingabe bleibt", async () => {
    await mount();
    await fillStatement("Nach dem Schichtwechsel den Dosierwert kontrollieren.");
    const hit = await openLookupWithHit();
    expect(path()).toBe("/mobile");

    await click(hit);
    // Vor der Behebung wechselte die Seite hier ungefragt und die Eingabe war verloren.
    expect(pageText()).toContain(i18n.t("nav.guard.title"));
    expect(path()).toBe("/mobile");
    expect(pageText()).not.toContain("WISSEN-SEITE");

    await click(buttonByText(i18n.t("nav.guard.stay")));
    expect(path()).toBe("/mobile");
    // Zurück im Erfassen-Tab steht der Text noch.
    await click(buttonByText(i18n.t("mob.tabCapture")));
    expect(container.querySelector("textarea")?.value).toContain("Dosierwert");
  });

  it("bewusstes Verwerfen wechselt wirklich zum Wissensobjekt", async () => {
    await mount();
    await fillStatement("Ungespeicherte Zeile.");
    const hit = await openLookupWithHit();

    await click(hit);
    expect(pageText()).toContain(i18n.t("nav.guard.title"));
    await click(buttonByText(i18n.t("nav.guard.discard")));
    expect(path()).toBe("/wissen/k1");
    expect(pageText()).toContain("WISSEN-SEITE");
  });

  it("ohne Eingabe wechselt derselbe Treffer OHNE Dialog (keine Warnung ohne Verlust)", async () => {
    await mount();
    const hit = await openLookupWithHit();
    await click(hit);
    expect(pageText()).not.toContain(i18n.t("nav.guard.title"));
    expect(path()).toBe("/wissen/k1");
  });
});

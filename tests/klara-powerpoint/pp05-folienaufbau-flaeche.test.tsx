// @vitest-environment jsdom
// Montierte Produktfläche, echte PP02/03-/Office-Routen; nur fetch -> app.inject.
import { afterEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { FolienAufbau } from "../../apps/web/src/components/bibliothek/FolienAufbau";
import i18n from "../../apps/web/src/i18n";
import { welt } from "./pp05-welt";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const originalFetch = globalThis.fetch;
let w: Awaited<ReturnType<typeof welt>>;
let root: ReturnType<typeof createRoot> | undefined;
let container: HTMLDivElement;
afterEach(async () => {
  if (root) act(() => root?.unmount());
  container?.remove();
  await w?.app.close();
  globalThis.fetch = originalFetch;
});
async function warten() {
  for (let i = 0; i < 15; i++)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
}
async function start() {
  w = await welt();
  globalThis.fetch = async (input, init) => {
    const r = await w.app.inject({
      method: (init?.method ?? "GET") as "GET" | "POST",
      url: String(input),
      headers: { "content-type": "application/json" },
      ...(init?.body ? { payload: String(init.body) } : {}),
    });
    return new Response(r.body, { status: r.statusCode });
  };
  await i18n.changeLanguage("de");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root?.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(FolienAufbau, {
          koId: w.article.id,
          anhangId: w.anhangId,
          fassung: w.article.version,
          gespeichert: () => {},
        }),
      ),
    ),
  );
  await warten();
}
async function klick(e: HTMLElement | undefined | null) {
  expect(e).toBeTruthy();
  await act(async () => e?.click());
  await warten();
}
function button(name: string) {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === name,
  );
}
async function input(suffix: string, value: string) {
  const el = container.querySelector<HTMLInputElement>(`input[id$="-${suffix}"]`);
  expect(el).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, value);
    el?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function vorschauAbwarten() {
  for (let i = 0; i < 300 && !button("Neue Folien übernehmen"); i++)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  expect(button("Neue Folien übernehmen")).toBeTruthy();
}
async function ausfuellen() {
  await input("titel", "Vertrieb Q4");
  await input("ziel", "Quartal prüfen");
  await input("publikum", "Geschäftsführung");
  const checks = container.querySelectorAll<HTMLInputElement>(
    'fieldset fieldset input[type="checkbox"]',
  );
  await klick(checks[0]);
  await klick(checks[1]);
  await act(async () =>
    container
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  await vorschauAbwarten();
}
describe("PP05 montierte Kontextaktion", () => {
  it("Ziel/Publikum/Daten -> Vorschau mit Belegen -> Verwerfen ohne Speicherung -> bewusste Übernahme", async () => {
    await start();
    await ausfuellen();
    const preview = container.querySelector('section[aria-label="Vorschau erstellen"]');
    expect(preview?.textContent).toContain("400 T€");
    expect(preview?.textContent).toContain("Quelle");
    expect((await w.ko.get(w.article.id))?.version).toBe(w.article.version);
    await klick(button("Vorschau verwerfen"));
    expect(container.querySelector('section[aria-label="Vorschau erstellen"]')).toBeNull();
    await act(async () =>
      container
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    await vorschauAbwarten();
    await klick(button("Neue Folien übernehmen"));
    for (let i = 0; i < 150 && !container.querySelector("output"); i++)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });
    expect(container.querySelector("output")?.textContent).toContain("gespeichert");
    expect((await w.ko.get(w.article.id))?.version).toBe(w.article.version + 1);
  });
  it("Änderung am Ziel verwirft die alte Vorschau und verhindert Übernahme bis zur neuen Vorschau", async () => {
    await start();
    await ausfuellen();
    expect(button("Neue Folien übernehmen")).toBeTruthy();
    await input("ziel", "Andere Entscheidung");
    expect(button("Neue Folien übernehmen")).toBeUndefined();
    expect((await w.ko.get(w.article.id))?.version).toBe(w.article.version);
  });
});

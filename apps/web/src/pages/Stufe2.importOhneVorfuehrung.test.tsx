// @vitest-environment jsdom
// ================================================================================================
// ADMIN-16 · K2/K5 — DER PRODUKTIVE IMPORT OHNE DEMOPAKETE UND OHNE TESTDATEN-AUFRÄUMEN.
// ================================================================================================
//
// produkt:20261009:admin-demo-diagnose. VORHER standen auf `/import` unter der Prüfliste die Kästen
// „Beispielpakete", „Demopakete" und „Testdaten aufräumen". NACHHER zeigt die Seite nur noch ihren
// Arbeitsweg; die Werkzeuge wohnen in der Verwaltung unter „Vorführdaten". Die alten Direktlinks
// (`/import#beispielpakete`, `/import#demopakete`) bleiben wirksam und führen auf die neue Karte.
//
// Gemessen am GEMOUNTETEN `ImportReview` — derselbe Prüfstand wie `Stufe2.kopf.test.tsx`
// (referenzstabile Haken, Kalibrierung über den echten `h1`), damit eine Abwesenheit nicht auf
// einem leeren Baum beruht.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/hooks", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  const LADEND = Object.freeze({
    data: undefined,
    isLoading: true,
    isError: false,
    isSuccess: false,
    error: null,
  });
  const stabil = (): typeof LADEND => LADEND;
  const flaeche: Record<string, unknown> = {};
  for (const schluessel of Object.keys(original)) {
    flaeche[schluessel] = schluessel.startsWith("use") ? stabil : original[schluessel];
  }
  return flaeche;
});

vi.mock("../app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", name: "Pedi", role: "admin" } }),
}));
vi.mock("../app/RoleContext", () => ({
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }),
}));
vi.mock("../app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import i18n from "../i18n";
import { adminHref } from "../lib/adminSections";
import { ImportReview } from "./Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function Ort(): JSX.Element {
  const ort = useLocation();
  return createElement("div", { "data-testid": "ort" }, `${ort.pathname}${ort.search}`);
}

async function mount(adresse: string): Promise<void> {
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
          MemoryRouter,
          { initialEntries: [adresse] },
          createElement(
            Routes,
            null,
            createElement(Route, { path: "/import", element: createElement(ImportReview) }),
            createElement(Route, { path: "/admin", element: createElement(Ort) }),
          ),
        ),
      ),
    );
    await new Promise((r) => setTimeout(r, 0));
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

const de = (key: string): string => String(i18n.getResource("de", "translation", key));

describe("ADMIN-16 · K2 · /import zeigt den Arbeitsweg ohne Vorführ- und Aufräumwerkzeuge", () => {
  it("Kalibrierung: die Importseite steht wirklich da (echter h1)", async () => {
    await mount("/import");
    expect(container.querySelector("h1")?.textContent?.trim()).toBe(de("nav.import"));
  });

  it("kein Beispiel-/Demopaket-Kasten und kein Testdaten-Aufräumen auf der Importseite", async () => {
    await mount("/import");
    const text = container.textContent ?? "";
    for (const key of [
      "exp.title",
      "exp.hint",
      "dpk.title",
      "dpk.hint",
      "imp.cleanup.title",
      "imp.cleanup.desc",
    ]) {
      expect(de(key), `${key} ist nicht aufgelöst`).not.toBe(key);
      expect(text, `„${de(key)}“ steht noch auf /import`).not.toContain(de(key));
    }
    expect(container.querySelector("#beispielpakete")).toBeNull();
    expect(container.querySelector("#demopakete")).toBeNull();
    expect(container.querySelector('[data-testid="lesevarianten-laden"]')).toBeNull();
  });
});

describe("ADMIN-16 · K5 · die alten Direktlinks der Importseite bleiben wirksam", () => {
  for (const anker of ["#beispielpakete", "#demopakete"]) {
    it(`/import${anker} führt auf die Karte „Beispiel- und Demopakete“ der Verwaltung`, async () => {
      await mount(`/import${anker}`);
      expect(container.querySelector('[data-testid="ort"]')?.textContent).toBe(
        adminHref("vorfuehrdaten", "pakete"),
      );
    });
  }

  it("ohne Anker bleibt /import, wo es ist", async () => {
    await mount("/import");
    expect(container.querySelector('[data-testid="ort"]')).toBeNull();
    expect(container.querySelector("h1")).not.toBeNull();
  });
});

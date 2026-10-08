// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · GESAMT-KENNZAHLEN — DIE MANAGEMENT-SICHT (`Capital`, Stufe 2).
// ================================================================================================
//
// Gemountet wird die echte Seite mit gestellter Serverantwort (fetch an der Netzgrenze):
//   M1  FR-VAL-06  offen/erledigt je Person auch in Admin/Management, mit Namen statt Kennung
//   M2  FR-VAL-06  ist die Zuweisungsübersicht nicht abrufbar, sagt die Karte das — keine leere
//                  Liste, die wie „keine Aufgaben" aussähe
//   M3  R-0736 / R-0755  Demobestand im Snapshot wird benannt; der Wissenskapital-Wert trägt den
//                  Hinweis, dass er ein berechneter Index ist
// Nicht gemessen: Browserlayout in Chromium.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }),
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { ManagementSnapshot } from "../../apps/web/src/api/types";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Capital } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SNAPSHOT: ManagementSnapshot = {
  generatedAt: "2026-10-08T08:00:00.000Z",
  overview: {
    totalKos: 4,
    validated: 3,
    open: 1,
    openGaps: 0,
    openConflicts: 0,
    avgTrust: 70,
    healthScore: 60,
    healthBand: "mittel",
    demoKos: 1,
  },
  capital: { score: 60, band: "mittel", parts: [] },
  valuationFacts: { validatedKos: 3, totalKos: 4, avgTrust: 70 },
  statement: {
    assets: 3,
    riskItems: 0,
    riskBreakdown: { singleSourceCategories: 0, stale: 0, openGaps: 0, openConflicts: 0 },
    net: 3,
  },
  maturity: { stage: 3, stageKey: "validieren", progressPct: 60 },
  priorities: [],
  recommendations: [],
  house: [],
  pilot: [{ days: 30, created: 1, validated: 1 }],
};

const UEBERSICHT = [
  { userId: "u-ben", open: 1, done: 4 },
  { userId: "u-anna", open: 3, done: 2 },
];
const VERZEICHNIS = [
  { id: "u-anna", name: "Anna Prüferin" },
  { id: "u-ben", name: "Ben Fachmann" },
];

let uebersichtScheitert = false;

function stelleFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const pfad = String(url);
      const koerper = pfad.includes("/api/management/snapshot")
        ? SNAPSHOT
        : pfad.includes("/api/validation/overview")
          ? uebersichtScheitert
            ? null
            : UEBERSICHT
          : pfad.includes("/api/directory")
            ? VERZEICHNIS
            : null;
      if (koerper === null) {
        return { ok: false, status: 500, statusText: "no", text: async () => "{}" } as Response;
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(koerper),
      } as Response;
    }),
  );
}

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const gemountet: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

afterEach(async () => {
  for (const { root, container } of gemountet.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  uebersichtScheitert = false;
  vi.unstubAllGlobals();
  await i18n.changeLanguage("de");
});

async function mounten(): Promise<HTMLDivElement> {
  await i18n.changeLanguage("de");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  gemountet.push({ root, container });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(MemoryRouter, { initialEntries: ["/kapital"] }, createElement(Capital)),
        ),
      ),
    );
    await durchlaufen();
  });
  // Das Personenverzeichnis wird erst gefragt, wenn es Zeilen gibt — eine Abfrage später.
  for (let runde = 0; runde < 5; runde++) {
    await act(durchlaufen);
  }
  return container;
}

function element(container: HTMLElement, testid: string): Element {
  const el = container.querySelector(`[data-testid="${testid}"]`);
  if (!el) {
    throw new Error(`/kapital: [data-testid="${testid}"] fehlt auf der Seite`);
  }
  return el;
}

describe("Gesamt-Kennzahlen · Management-Sicht", () => {
  it("M1 · FR-VAL-06: offen/erledigt je Person, mit Namen, meiste offene zuerst", async () => {
    stelleFetch();
    const container = await mounten();
    const karte = element(container, "kapital-pruefaufgaben");
    expect(karte.textContent).toContain(i18n.t("kennzahlen.personen.titel"));
    const zeilen = [...element(container, "kapital-personen").children].map((z) => z.textContent);
    expect(zeilen).toEqual([
      `Anna Prüferin${i18n.t("kennzahlen.personen.zeile", { open: 3, done: 2 })}`,
      `Ben Fachmann${i18n.t("kennzahlen.personen.zeile", { open: 1, done: 4 })}`,
    ]);
    expect(karte.textContent).not.toContain("u-anna");
  });

  it("M2 · FR-VAL-06: nicht abrufbare Übersicht wird benannt, nicht als leer ausgegeben", async () => {
    uebersichtScheitert = true;
    stelleFetch();
    const container = await mounten();
    const karte = element(container, "kapital-pruefaufgaben");
    expect(karte.textContent).toContain(i18n.t("kennzahlen.personen.nichtAbrufbar"));
    expect(karte.textContent).not.toContain(i18n.t("kennzahlen.personen.leer"));
    expect(container.querySelector('[data-testid="kapital-personen"]')).toBeNull();
  });

  it("M3 · R-0736/R-0755: Demobestand und berechneter Index sind gekennzeichnet", async () => {
    stelleFetch();
    const container = await mounten();
    expect(element(container, "kapital-demo-hinweis").textContent).toBe(
      i18n.t("kennzahlen.demo.hinweis", { demo: 1, total: 4 }),
    );
    expect(element(container, "kapital-index-hinweis").textContent).toBe(
      i18n.t("kennzahlen.kapital.index"),
    );
  });
});

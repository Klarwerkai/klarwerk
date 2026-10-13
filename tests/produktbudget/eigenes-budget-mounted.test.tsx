// @vitest-environment jsdom
// ================================================================================================
// produkt:20261013:produktbudget-anwender-admin (PBE-12) · DAS EIGENE BUDGET — montiert.
// ================================================================================================
//
// Die Anwenderfläche (`components/assistenz/EigenesProduktbudget.tsx`) mit echter i18n und einem
// Netz, das genau `GET/PUT /api/me/produktbudget…` beantwortet. Fiktive Werte.
//
//   E1  Anzeige: Gesamtbudget und Zeitraum, erlaubte Zuweisung, eigene Belegung, eigener Rest
//   E2  Unterlimit über der Zuweisung: der Grund des Servers steht da, die Eingabe bleibt
//   E3  Unterlimit innerhalb: gesendet wird NUR Unterlimit und Fassung — kein Konto, kein Betrag
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { EigeneBudgets, EigenesBudget } from "../../apps/web/src/api/produktbudget";
import { EigenesProduktbudget } from "../../apps/web/src/components/assistenz/EigenesProduktbudget";
import i18n from "../../apps/web/src/i18n";
import { beruhige, klicke, tippe } from "../admin-navigation/vorrichtung";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const t = (key: string): string => i18n.t(key);

function bereich(teil: Partial<EigenesBudget> & Pick<EigenesBudget, "bereich">): EigenesBudget {
  return {
    anbieter: "anthropic",
    betragCent: 2000,
    waehrung: "EUR",
    zeitraum: "einmalig",
    sperre: null,
    gesamtVerbleibendCent: 1500,
    zuweisungCent: 2000,
    zuweisungGesetzt: false,
    unterlimitCent: null,
    belegtCent: 0,
    eigenVerbleibendCent: 1500,
    fassung: 0,
    ...teil,
  };
}

function stand(claude: Partial<EigenesBudget> = {}): EigeneBudgets {
  return {
    gelesenAm: "2026-10-13T14:00:00.000Z",
    bereiche: [
      bereich({ bereich: "perplexity-poc", anbieter: "perplexity" }),
      bereich({
        bereich: "nr32-claude",
        zuweisungCent: 800,
        zuweisungGesetzt: true,
        belegtCent: 300,
        eigenVerbleibendCent: 500,
        fassung: 1,
        ...claude,
      }),
      bereich({ bereich: "nr32-chatgpt", anbieter: "openai" }),
    ],
  };
}

let puts: Record<string, unknown>[] = [];
let schreiben: () => { status: number; body: unknown } = () => ({ status: 200, body: stand() });

function netz(): void {
  puts = [];
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async (eingabe: unknown, init?: { method?: string; body?: string }) => {
      const pfad = String(eingabe);
      const methode = (init?.method ?? "GET").toUpperCase();
      let a: { status: number; body: unknown };
      if (methode === "GET" && pfad.endsWith("/api/me/produktbudget")) {
        a = { status: 200, body: stand() };
      } else if (methode === "PUT" && pfad.endsWith("/api/me/produktbudget/nr32-claude")) {
        puts.push(JSON.parse(init?.body ?? "{}") as Record<string, unknown>);
        a = schreiben();
      } else {
        throw new Error(`kein Netz in diesem Prüfstand: ${methode} ${pfad}`);
      }
      return {
        status: a.status,
        ok: a.status < 400,
        statusText: a.status < 400 ? "OK" : "Fehler",
        text: async () => JSON.stringify(a.body),
      };
    },
  });
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function montieren(): Promise<HTMLDivElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const r = root;
  act(() => {
    r.render(
      createElement(QueryClientProvider, { client: qc }, createElement(EigenesProduktbudget)),
    );
  });
  await beruhige();
  return container;
}

function text(c: HTMLElement, testId: string): string {
  return c.querySelector(`[data-testid="${testId}"]`)?.textContent ?? "";
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  schreiben = () => ({ status: 200, body: stand() });
  netz();
});

afterEach(() => {
  const r = root;
  if (r) {
    act(() => r.unmount());
  }
  container?.remove();
  root = null;
  container = null;
});

describe("PBE-12 · das eigene Budget", () => {
  it("E1 · zeigt Zuweisung, eigene Belegung und eigenen Rest je Bereich", async () => {
    const c = await montieren();
    expect(c.textContent).toContain(t("produktbudget.eigen.titel"));
    expect(text(c, "eigenes-budget-zuweisung-nr32-claude")).toBe("8,00 EUR");
    expect(text(c, "eigenes-budget-belegt-nr32-claude")).toBe("3,00 EUR");
    expect(text(c, "eigenes-budget-verbleibend-nr32-claude")).toBe("5,00 EUR");
    expect(text(c, "eigenes-budget-nr32-chatgpt")).toContain(t("produktbudget.zeitraum.einmalig"));
  });

  it("E2 · über der Zuweisung: der Grund des Servers steht da, die Eingabe bleibt", async () => {
    schreiben = () => ({
      status: 400,
      body: { error: "VALIDATION", grund: "unterlimit", message: "zu hoch" },
    });
    const c = await montieren();
    await tippe(c.querySelector('[data-testid="eigenes-budget-unterlimit-nr32-claude"]'), "9");
    await klicke(c.querySelector('[data-testid="eigenes-budget-speichern-nr32-claude"]'));
    expect(text(c, "eigenes-budget-meldung-nr32-claude")).toBe(
      t("produktbudget.fehler.unterlimit"),
    );
    const feld = c.querySelector('[data-testid="eigenes-budget-unterlimit-nr32-claude"]');
    expect((feld as HTMLInputElement).value).toBe("9");
  });

  it("E3 · innerhalb: gesendet werden nur Unterlimit und Fassung", async () => {
    schreiben = () => ({ status: 200, body: stand({ unterlimitCent: 400, fassung: 2 }) });
    const c = await montieren();
    await tippe(c.querySelector('[data-testid="eigenes-budget-unterlimit-nr32-claude"]'), "4");
    await klicke(c.querySelector('[data-testid="eigenes-budget-speichern-nr32-claude"]'));
    expect(puts).toEqual([{ unterlimit: "4", fassung: 1 }]);
    expect(text(c, "eigenes-budget-meldung-nr32-claude")).toBe(t("produktbudget.gespeichert"));
    const feld = c.querySelector('[data-testid="eigenes-budget-unterlimit-nr32-claude"]');
    expect((feld as HTMLInputElement).value).toBe("4,00");
  });
});

// @vitest-environment jsdom
// ================================================================================================
// R-0730 · R-0746 · FR-LIB-03 — BUS-FAKTOR UND RISIKO-COCKPIT JE GEBIET, AN DER ECHTEN SEITE.
// ================================================================================================
//
// Die Ableitung (`lib/knowledgeHealth.ts`, `domainRisk`) ist in knowledge-health.test.ts ohne DOM
// belegt. Dieser Test fährt die echte Risiko-Seite und hält fest, was die Kriterien an der FLÄCHE
// verlangen:
//   B1  ein Gebiet mit nur einer Quelle wird als Absicherungshinweis AM GEBIET gezeigt — mit dem,
//       der es trägt; ein breit getragenes Gebiet bekommt den Hinweis nicht
//   B2  je Kategorie: Menge, Prüfanteil, Stufe (kritisch/mittel/gut) und der Klickweg zu den Objekten
//   B3  die Bus-Faktor-Liste nennt jede Kategorie mit der Zahl ihrer Träger
// Die Endpointgrenze ist die einzige Attrappe; die Namen sind erfundene Testpersonen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  const ko = (id: string, category: string, author: string, status: string) => ({
    id,
    title: id,
    statement: "s",
    category,
    author,
    originalAuthor: author,
    status,
    trust: 70,
  });
  const kos = [
    ko("k1", "Betrieb", "u2", "validiert"),
    ko("k2", "Betrieb", "u2", "offen"),
    ko("k3", "Qualitaet", "u2", "validiert"),
    ko("k4", "Qualitaet", "u3", "validiert"),
  ];
  const bus = [
    { category: "Betrieb", koCount: 2, authorCount: 1, singleSource: true },
    { category: "Qualitaet", koCount: 2, authorCount: 2, singleSource: false },
  ];
  const personen = [
    { id: "u2", name: "Hanna Beispiel" },
    { id: "u3", name: "Jonas Beispiel" },
  ];
  return {
    endpoints: {
      conflicts: { list: ok([]) },
      gaps: { list: ok([]), summary: ok({ total: 0, byPriority: {} }) },
      ko: { list: ok(kos) },
      directory: { list: ok(personen) },
      analytics: { busfactor: ok(bus), expertise: ok([]) },
      aiCheck: { coverageSummary: ok({ total: 4, incomplete: 0, unchecked: 0, noCoverage: 0 }) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Risk } from "../../apps/web/src/pages/Risk";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

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
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(MemoryRouter, { initialEntries: ["/risiko"] }, createElement(Risk)),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

/** Die Cockpit-Karte einer Kategorie: der Klickweg zu ihren Objekten ist ein direktes Kind. */
function karte(kategorie: string): Element {
  const link = container.querySelector(
    `a[href="/bibliothek?category=${encodeURIComponent(kategorie)}"]`,
  );
  const k = link?.parentElement;
  if (!k) {
    throw new Error(`Cockpit-Karte „${kategorie}" fehlt`);
  }
  return k;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("Risiko-Cockpit · Bus-Faktor je Gebiet an der echten Seite", () => {
  it("B1 · Einzelquelle als Hinweis am Gebiet, mit dem Träger — das breit getragene Gebiet ohne Hinweis", async () => {
    await mount();
    const betrieb = karte("Betrieb").textContent ?? "";
    const qualitaet = karte("Qualitaet").textContent ?? "";

    expect(betrieb).toContain(i18n.t("risk.singleSource"));
    expect(betrieb).toContain(i18n.t("risk.singleSourceExplain"));
    expect(betrieb).toContain(i18n.t("risk.bearer", { names: "Hanna Beispiel" }));
    // Gegenprobe: zwei Träger ⇒ kein Einzelquellen-Hinweis, kein Trägersatz.
    expect(qualitaet).not.toContain(i18n.t("risk.singleSource"));
    expect(qualitaet).not.toContain("Getragen von");
  });

  it("B2 · je Kategorie Menge, Prüfanteil und Stufe; der Klick führt zu den betroffenen Objekten", async () => {
    await mount();
    const betrieb = karte("Betrieb").textContent ?? "";
    const qualitaet = karte("Qualitaet").textContent ?? "";

    expect(betrieb).toContain(i18n.t("risk.level.kritisch"));
    expect(betrieb).toContain("50%");
    expect(qualitaet).toContain(i18n.t("risk.level.gut"));
    expect(qualitaet).toContain("100%");
    for (const kategorie of ["Betrieb", "Qualitaet"]) {
      const link = karte(kategorie).querySelector("a");
      expect(link?.getAttribute("href")).toBe(`/bibliothek?category=${kategorie}`);
      expect(link?.textContent).toContain(i18n.t("risk.viewObjects"));
    }
  });

  it("B3 · die Bus-Faktor-Liste nennt jede Kategorie mit der Zahl ihrer Träger", async () => {
    await mount();
    const text = container.textContent ?? "";

    expect(text).toContain(i18n.t("risk.busfactor"));
    expect(text).toContain(i18n.t("risk.expertsCount", { count: 1 }));
    expect(text).toContain(i18n.t("risk.expertsCount", { count: 2 }));
  });
});

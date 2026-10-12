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

/** B5: die Bus-Faktor-Antwort ist erfolgreich, aber leer. */
const lage = vi.hoisted(() => ({ busLeer: false }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  // `urheber` fehlt ⇒ Erfasser und Urheber sind dieselbe Person (die Gegenprobe zu B1b).
  const ko = (id: string, category: string, author: string, status: string, urheber?: string) => ({
    id,
    title: id,
    statement: "s",
    category,
    author,
    originalAuthor: urheber ?? author,
    status,
    trust: 70,
  });
  const kos = [
    ko("k1", "Betrieb", "u2", "validiert"),
    ko("k2", "Betrieb", "u2", "offen"),
    ko("k3", "Qualitaet", "u2", "validiert"),
    ko("k4", "Qualitaet", "u3", "validiert"),
    // B1b (ben F1): zwei ERFASSER (u2, u3), aber EIN Urheber (u4) — übernommenes Wissen.
    ko("k5", "Uebernahme", "u2", "validiert", "u4"),
    ko("k6", "Uebernahme", "u3", "validiert", "u4"),
  ];
  // So zählt der Server (library-analytics `busFactor`): nach `originalAuthor`.
  const bus = [
    { category: "Betrieb", koCount: 2, authorCount: 1, singleSource: true },
    { category: "Qualitaet", koCount: 2, authorCount: 2, singleSource: false },
    { category: "Uebernahme", koCount: 2, authorCount: 1, singleSource: true },
  ];
  const personen = [
    { id: "u2", name: "Hanna Beispiel" },
    { id: "u3", name: "Jonas Beispiel" },
    { id: "u4", name: "Rita Beispiel" },
  ];
  return {
    endpoints: {
      conflicts: { list: ok([]) },
      gaps: { list: ok([]), summary: ok({ total: 0, byPriority: {} }) },
      ko: { list: ok(kos) },
      directory: { list: ok(personen) },
      analytics: {
        busfactor: vi.fn(async () => (lage.busLeer ? [] : bus)),
        expertise: ok([]),
      },
      aiCheck: { coverageSummary: ok({ total: 6, incomplete: 0, unchecked: 0, noCoverage: 0 }) },
      // B4: der „Stimmt das noch?"-Merker nach einer Anlagenänderung liegt auf k2 (Betrieb).
      lifecycle: { pending: ok(["k2"]) },
      // Nacharbeit 3: die Seite zieht den Bereichsblick und (Admin) die Pflege mit.
      management: {
        riskHorizon: ok({ generatedAt: "", seesAll: true, areas: [] }),
        profiles: ok({ categories: [], retirement: [] }),
      },
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

/** Der Einzelquellenhinweis einer Karte: der Block, dessen Kopfzeile `risk.singleSource` ist. */
function hinweis(kategorie: string): Element | undefined {
  return [...karte(kategorie).querySelectorAll("div")].find(
    (d) => d.firstElementChild?.textContent === i18n.t("risk.singleSource"),
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  lage.busLeer = false;
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

  it("B1b · Erfasser ≠ Urheber: der Hinweis nennt allein den Urheber, nach dem der Bus-Faktor zählt", async () => {
    await mount();
    const block = hinweis("Uebernahme");
    expect(block, "Einzelquellenhinweis an „Uebernahme“ fehlt").toBeDefined();
    const text = block?.textContent ?? "";

    // Der Trägersatz trägt genau EINEN Namen — den Urheber u4 —, nicht die beiden Erfasser.
    const traeger = [...(block?.querySelectorAll("p") ?? [])].map((p) => p.textContent);
    expect(traeger).toContain(i18n.t("risk.bearer", { names: "Rita Beispiel" }));
    expect(text).not.toContain("Hanna Beispiel");
    expect(text).not.toContain("Jonas Beispiel");
    // Gegenprobe: wo Erfasser und Urheber dieselbe Person sind, bleibt der bisherige Träger.
    expect(hinweis("Betrieb")?.textContent).toContain(
      i18n.t("risk.bearer", { names: "Hanna Beispiel" }),
    );
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
      const link = karte(kategorie).querySelector('a[href^="/bibliothek"]');
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

  it("B4 · Vergleich zum Werksdurchschnitt und Objekte, die eine Anlagenänderung veralten ließ (R-1639)", async () => {
    await mount();
    // Werksdurchschnitt: 5 von 6 sichtbaren Objekten validiert ⇒ 83 %.
    const vergleich = (k: string) => karte(k).querySelector('[data-testid="risk-vs-plant"]');
    expect(vergleich("Betrieb")?.textContent).toBe(i18n.t("risk.vsPlant.below", { avg: 83 }));
    expect(vergleich("Qualitaet")?.textContent).toBe(i18n.t("risk.vsPlant.above", { avg: 83 }));

    // Nur Betrieb trägt einen Merker (k2) — mit Weg zur bestehenden Prüfliste.
    const veraltet = karte("Betrieb").querySelector('[data-testid="risk-stale-asset"]');
    expect(veraltet?.textContent).toBe(i18n.t("risk.staleByAssetChange", { count: 1 }));
    expect(veraltet?.getAttribute("href")).toBe("/lebenszyklus");
    // Gegenprobe: ohne Merker keine Zeile, auch keine „0“.
    expect(karte("Qualitaet").querySelector('[data-testid="risk-stale-asset"]')).toBeNull();
  });

  // R-0956 (Ben, Nacharbeit 2): die leere Bus-Faktor-Liste sagt nicht nur „Keine Risikodaten.“,
  // sondern ordnet in den Wissenskreis ein und nennt den nächsten Schritt.
  it("B5 · leere Bus-Faktor-Liste: Leersatz, Einordnung in den Wissenskreis und ein echter nächster Schritt", async () => {
    lage.busLeer = true;
    await mount();
    const text = container.textContent ?? "";

    expect(text).toContain(i18n.t("risk.busEmpty"));
    expect(text).toContain(i18n.t("story.rescue.title"));
    expect(text).toContain(i18n.t("story.surface.risk.lead"));
    expect(text).toContain(i18n.t("cycle.capture.label"));
    const erfassen = [...container.querySelectorAll("a")].find(
      (a) => a.textContent === i18n.t("empty.cta.capture"),
    );
    expect(erfassen, "der nächste Schritt ist ein echter Link").toBeDefined();
    expect(erfassen?.getAttribute("href")?.startsWith("/")).toBe(true);
  });

  // R-0956 (Bestandsabgleich, Nacharbeit 4): die leere Lückenliste (hier liefert `gaps.list`
  // nichts) ordnet ebenfalls ein und führt zum Fragen.
  it("B6 · leere Lückenliste: Leersatz, Einordnung und der Weg zum Fragen", async () => {
    await mount();
    const text = container.textContent ?? "";
    expect(text).toContain(i18n.t("risk.gapsEmpty"));
    expect(text).toContain(i18n.t("story.surface.gaps.lead"));
    const fragen = [...container.querySelectorAll("a")].find(
      (a) => a.textContent === i18n.t("empty.cta.ask"),
    );
    expect(fragen?.getAttribute("href")).toBe("/fragen");
  });

  it("B5b · Gegenprobe: mit Daten keine Leer-Einordnung der Risikoliste", async () => {
    await mount();
    expect(container.textContent ?? "").not.toContain(i18n.t("story.surface.risk.lead"));
    expect(container.textContent ?? "").not.toContain(i18n.t("risk.busEmpty"));
  });
});

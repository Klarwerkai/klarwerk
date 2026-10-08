// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · GESAMT-KENNZAHLEN — DIE AUSWERTUNGSSEITE GEGEN IHRE ORIGINALKRITERIEN.
// ================================================================================================
//
// Gefahren wird die echte Analytics-Seite; die Endpointgrenze ist die einzige Attrappe.
//
//   K1  R-0723   oben stehen genau die vier Kernzahlen für Entscheider — geprüftes Wissen,
//                gestellte Fragen, ohne Lücke beantwortet, Antwortquote — vor allen anderen Blöcken
//   K2  R-0750   der Wochenverlauf: Antwortquote je Woche UND validiertes Wissen je Woche, und die
//                vier Zahlen stehen nicht ein zweites Mal als eigene Reihe darunter
//   K3  FR-VAL-06 / FR-ANA-01  offen/erledigt je Person, mit Namen statt Kennung
//   K4  R-0755   Demobestand in den Zahlen wird ausdrücklich benannt; ohne Demobestand kein Hinweis
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lage = vi.hoisted(() => ({ mitDemo: true }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  const echt = [
    { id: "k1", title: "A", statement: "s", category: "Betrieb", status: "validiert", trust: 80 },
    { id: "k2", title: "B", statement: "s", category: "Betrieb", status: "validiert", trust: 70 },
    { id: "k3", title: "C", statement: "s", category: "Technik", status: "offen", trust: 40 },
  ];
  const demo = {
    id: "k4",
    title: "D",
    statement: "s",
    category: "Technik",
    status: "validiert",
    trust: 90,
    demoSeed: true,
  };
  return {
    endpoints: {
      ko: { list: vi.fn(async () => (lage.mitDemo ? [...echt, demo] : echt)) },
      conflicts: { list: ok([]) },
      gaps: { list: ok([]), summary: ok({ total: 0, byPriority: {} }) },
      directory: {
        list: ok([
          { id: "u-anna", name: "Anna Prüferin" },
          { id: "u-ben", name: "Ben Fachmann" },
        ]),
      },
      analytics: {
        overview: ok({
          total: 4,
          byType: { best_practice: 4 },
          byStatus: { offen: 1, validiert: 3 },
          byCategory: { Betrieb: 2, Technik: 2 },
        }),
        busfactor: ok([]),
        expertise: ok([]),
        impact: ok({
          validatedTotal: 3,
          validatedByWeek: { "2026-09-07": 1, "2026-09-14": 2 },
          askTotal: 7,
          answeredWithoutGap: 5,
          answerRate: 5 / 7,
          askByWeek: {
            "2026-09-07": { asked: 3, answeredWithoutGap: 1 },
            "2026-09-14": { asked: 4, answeredWithoutGap: 4 },
          },
        }),
      },
      audit: { list: ok([]) },
      lifecycle: { pending: ok([]) },
      validation: {
        overview: ok([
          { userId: "u-ben", open: 1, done: 4 },
          { userId: "u-anna", open: 3, done: 2 },
          { userId: "u-niemand", open: 0, done: 0 },
        ]),
      },
      aiCheck: {
        coverageSummary: ok({ total: 4, incomplete: 0, unchecked: 0, noCoverage: 0 }),
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
import { AUTHOR_LOADING_KEY } from "../../apps/web/src/lib/koAuthor";
import { Analytics } from "../../apps/web/src/pages/Analytics";

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
              createElement(
                MemoryRouter,
                { initialEntries: ["/analytics"] },
                createElement(Analytics),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

function element(testid: string): Element {
  const el = container.querySelector(`[data-testid="${testid}"]`);
  if (!el) {
    throw new Error(`/analytics: [data-testid="${testid}"] fehlt auf der Seite`);
  }
  return el;
}

/** Die Kacheln einer Kachelreihe als [Beschriftung, Wert] — in Zeichenreihenfolge. */
function kacheln(reihe: Element): [string, string][] {
  return [...reihe.children].map((kachel) => [
    kachel.children[0]?.textContent ?? "",
    kachel.children[1]?.textContent ?? "",
  ]);
}

/** Das erste Blatt-Element mit genau diesem Text. */
function blatt(text: string): Element | undefined {
  return [...container.querySelectorAll("*")].find(
    (e) => e.children.length === 0 && e.textContent === text,
  );
}

function vor(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

beforeEach(async () => {
  lage.mitDemo = true;
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("Gesamt-Kennzahlen · die Auswertungsseite gegen ihre Originalkriterien", () => {
  it("K1 · R-0723: oben stehen genau die vier Kernzahlen, mit den Werten der Live-Quellen", async () => {
    await mount();
    const reihe = element("analytics-kernzahlen");
    expect(kacheln(reihe)).toEqual([
      // drei echte validierte + ein validiertes Demo-Objekt: gezählt wird der ganze Bestand
      [i18n.t("ana.exec.validated"), "3"],
      [i18n.t("ana.impactAsk"), "7"],
      [i18n.t("ana.impactAnswered"), "5"],
      [i18n.t("ana.impactRate"), "71%"],
    ]);
    // Die Quote nennt ihren jüngsten Wochenwert gleich mit — „im Wochenverlauf".
    expect(reihe.textContent).toContain(
      i18n.t("kennzahlen.exec.rateHint", { rate: "100%", week: "2026-09-14" }),
    );
    // „oben": vor dem Health-Wert, vor dem Bestand und vor dem Wirkungsabschnitt.
    for (const spaeter of ["health.title", "ana.total", "ana.impact"]) {
      const ziel = blatt(i18n.t(spaeter));
      expect(ziel, `${spaeter} fehlt`).toBeDefined();
      expect(vor(reihe, ziel as Element), `Kernzahlen nicht vor ${spaeter}`).toBe(true);
    }
  });

  it("K2 · R-0750: Antwortquote und validiertes Wissen je Woche — ohne zweite Zahlenreihe", async () => {
    await mount();
    const quote = element("analytics-quote-woche");
    const text = quote.textContent ?? "";
    expect(text).toContain(
      i18n.t("kennzahlen.wochen.quoteZeile", { rate: "33%", answered: 1, asked: 3 }),
    );
    expect(text).toContain(
      i18n.t("kennzahlen.wochen.quoteZeile", { rate: "100%", answered: 4, asked: 4 }),
    );
    expect(text.indexOf("2026-09-07"), "Wochen nicht chronologisch").toBeLessThan(
      text.indexOf("2026-09-14"),
    );
    expect(container.textContent).toContain(i18n.t("ana.weekly"));
    expect(container.textContent).toContain(i18n.t("kennzahlen.wochen.validiertHinweis"));
    // Die vier Zahlen stehen EINMAL auf der Seite (die doppelte Zahlenreihe ist zusammengezogen).
    const fragen = [...container.querySelectorAll("div")].filter(
      (e) => e.children.length === 0 && e.textContent === i18n.t("ana.impactAsk"),
    );
    expect(fragen).toHaveLength(1);
  });

  it("K3 · FR-VAL-06 / FR-ANA-01: offen/erledigt je Person, mit Namen, meiste offene zuerst", async () => {
    await mount();
    // Die Personenzeilen erscheinen erst mit der Zuweisungsübersicht, und erst dann fragt die Zeile
    // das Personenverzeichnis — eine Abfrage später. Gewartet wird, bis kein Name mehr „lädt";
    // geprüft wird danach unverändert der volle Sollwert (bleibt er aus, scheitert der Vergleich).
    const laedt = i18n.t(AUTHOR_LOADING_KEY);
    for (let runde = 0; runde < 10; runde++) {
      if (!(element("analytics-personen").textContent ?? "").includes(laedt)) {
        break;
      }
      await act(flush);
    }
    const personen = element("analytics-personen");
    const zeilen = [...personen.children].map((z) => z.textContent ?? "");
    expect(zeilen).toEqual([
      `Anna Prüferin${i18n.t("kennzahlen.personen.zeile", { open: 3, done: 2 })}`,
      `Ben Fachmann${i18n.t("kennzahlen.personen.zeile", { open: 1, done: 4 })}`,
    ]);
    // Keine rohe Kennung und keine Leerzeile für eine Person ohne Zuweisung.
    expect(personen.textContent).not.toContain("u-anna");
    expect(personen.textContent).not.toContain("u-niemand");
  });

  it("K3 · FR-ANA-01 / R-0723: der Bestand steht auch nach Kategorie verteilt da", async () => {
    await mount();
    const kategorien = element("analytics-kategorien");
    expect(kategorien.textContent).toContain(i18n.t("kennzahlen.byCategory"));
    const zeilen = [...(kategorien.children[1]?.children ?? [])].map((z) => z.textContent);
    // Gleichstand 2:2 → nach Name; der Zähler steht an jeder Zeile.
    expect(zeilen).toEqual(["Betrieb2", "Technik2"]);
  });

  it("K4 · R-0755: Demobestand in den Zahlen wird benannt", async () => {
    await mount();
    expect(element("analytics-demo-hinweis").textContent).toBe(
      i18n.t("kennzahlen.demo.hinweis", { demo: 1, total: 4 }),
    );
  });

  it("K4 · Gegenprobe: ohne Demobestand steht kein Hinweis da", async () => {
    lage.mitDemo = false;
    await mount();
    expect(container.querySelector('[data-testid="analytics-demo-hinweis"]')).toBeNull();
    const erste = kacheln(element("analytics-kernzahlen"))[0];
    expect(erste).toEqual([i18n.t("ana.exec.validated"), "2"]);
  });
});

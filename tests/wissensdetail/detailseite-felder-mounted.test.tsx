// @vitest-environment jsdom
// ================================================================================================
// WISSENSDETAIL (R-0907 · R-0998 · R-1037 · R-1697) — DIE DETAILSEITE NENNT IHRE FELDER.
// ================================================================================================
//
// Gemessen an der ECHTEN Route `/wissen/:id` (`KnowledgeDetail` → `BibliothekFlaeche` →
// `BibliothekLesen`), mit stillgelegter HTTP-Grenze — Bauform aus
// `tests/review26-originaldatei-kopf/lesen-harness.tsx`.
//
// Vorher standen Bedingungen und Maßnahmen als namenlose Absätze im Fließtext, die Tags und die
// Anlage gar nicht, und die Kernaussage fiel weg, sobald ein Fließtext da war. Diese Datei hält
// fest: jedes Feld unter seinem Namen, die Aussage genau einmal, der Status genau einmal, und der
// Browser-Tab trägt den Titel des Eintrags.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import type { KnowledgeObject } from "../../apps/web/src/api/types";

declare global {
  // eslint-disable-next-line no-var
  var __wissensdetailKo: KnowledgeObject;
}

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => globalThis.__wissensdetailKo),
        list: vi.fn(async () => [globalThis.__wissensdetailKo]),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async () => globalThis.__wissensdetailKo),
      },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: { list: vi.fn(async () => [{ id: "u1", name: "Eva" }]) },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({ text: "" })),
        assistPresets: leer,
        extract: vi.fn(async () => ({ points: [], note: null })),
        describeImage: vi.fn(async () => ({})),
      },
      aiCheck: { coverageSummary: vi.fn(async () => ({ total: 0 })) },
    },
  };
});

import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TITEL = "Reinigung Spritzzone Linie 3";
const AUSSAGE = "Die Spritzzone wird nach jeder Schicht nass gereinigt.";
const BEDINGUNG = "Nur bei abgeschalteter Linie";
const MASSNAHME = "Düsen mit Bürste reinigen";
const TAG = "spritzzone";
const ANLAGE = "Presse-P2";

function ko(teil: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko-1",
    title: TITEL,
    statement: AUSSAGE,
    bodyHtml: "<p>Reinigung nach Plan R-7, Abschnitt 2.</p>",
    conditions: [BEDINGUNG],
    measures: [MASSNAHME],
    type: "best_practice",
    category: "Produktion",
    tags: [TAG],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version: 1,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: ANLAGE,
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments: [],
    sources: [],
    attachments: [],
    ...teil,
  } as unknown as KnowledgeObject;
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let qc: QueryClient | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(teil: Partial<KnowledgeObject> = {}): Promise<HTMLDivElement> {
  globalThis.__wissensdetailKo = ko(teil);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  qc = client;
  const flaeche = document.createElement("div");
  document.body.appendChild(flaeche);
  container = flaeche;
  const wurzel = createRoot(flaeche);
  root = wurzel;
  await act(async () => {
    wurzel.render(
      createElement(
        QueryClientProvider,
        { client },
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
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/wissen/ko-1"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/wissen/:id",
                      element: createElement(KnowledgeDetail),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
  return flaeche;
}

function unmount(): void {
  const wurzel = root;
  if (wurzel) {
    act(() => wurzel.unmount());
  }
  container?.remove();
  qc?.clear();
  root = null;
  container = null;
  qc = null;
}

const text = (e: Element | null | undefined): string =>
  (e?.textContent ?? "").replace(/\s+/g, " ").trim();

function teil(c: HTMLElement, testId: string): HTMLElement | null {
  return c.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

function vorkommen(heuhaufen: string, nadel: string): number {
  return nadel.length === 0 ? 0 : heuhaufen.split(nadel).length - 1;
}

afterEach(() => {
  unmount();
  vi.clearAllMocks();
  document.title = "KLARWERK · Reasoning System";
});

describe("Wissensdetail · die Felder stehen benannt auf der Detailseite", () => {
  it("W1 · Aussage, Bedingungen, Maßnahmen, Tags und Anlage stehen unter ihrem Namen", async () => {
    await i18n.changeLanguage("de");
    const c = await mount();
    const felder = teil(c, "bib-felder");
    expect(felder, "der Felderblock fehlt").not.toBeNull();
    const f = text(felder);
    expect(f).toContain(i18n.t("ko.statement"));
    expect(f).toContain(AUSSAGE);
    expect(f).toContain(i18n.t("ko.conditions"));
    expect(f).toContain(BEDINGUNG);
    expect(f).toContain(i18n.t("ko.measures"));
    expect(f).toContain(MASSNAHME);
    expect(f).toContain(`#${TAG}`);
    expect(f).toContain(i18n.t("capture.fAsset"));
    expect(f).toContain(ANLAGE);
    // Inhalt, kein Erklärtext: der H4-Textmesser zieht `data-bib-text` ab.
    expect(felder?.getAttribute("data-bib-text")).toBe("felder");
    // Bedingungen und Maßnahmen stehen NICHT mehr namenlos im Fließtext.
    const fliesstext = text(teil(c, "bib-text"));
    expect(fliesstext).toContain("Plan R-7");
    expect(fliesstext).not.toContain(BEDINGUNG);
    expect(fliesstext).not.toContain(MASSNAHME);
    // Der Felderblock folgt dem Text und steht vor den Chips (Lesereihenfolge).
    const chips = teil(c, "bib-chips") as HTMLElement;
    expect(
      (teil(c, "bib-text") as HTMLElement).compareDocumentPosition(felder as HTMLElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      (felder as HTMLElement).compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("W2 · ohne Fließtext trägt der Text die Aussage — sie steht nicht ein zweites Mal da", async () => {
    await i18n.changeLanguage("de");
    const c = await mount({ bodyHtml: null } as Partial<KnowledgeObject>);
    expect(text(teil(c, "bib-text"))).toContain(AUSSAGE);
    expect(teil(c, "bib-feld-aussage")).toBeNull();
    expect(vorkommen(text(teil(c, "bib-lesen")), AUSSAGE)).toBe(1);
    // Die übrigen Felder bleiben benannt.
    expect(text(teil(c, "bib-felder"))).toContain(BEDINGUNG);
  });

  it("W3 · leere Felder zeichnen nichts — kein erfundener Inhalt, kein leerer Block", async () => {
    await i18n.changeLanguage("de");
    const c = await mount({
      bodyHtml: null,
      conditions: [],
      measures: [],
      tags: [],
      asset: null,
    } as Partial<KnowledgeObject>);
    expect(teil(c, "bib-titel")).not.toBeNull();
    expect(teil(c, "bib-felder")).toBeNull();
  });

  it("W4 · EN: dieselben Felder mit englischen Namen", async () => {
    await i18n.changeLanguage("en");
    const c = await mount();
    const f = text(teil(c, "bib-felder"));
    expect(f).toContain(i18n.t("ko.statement"));
    expect(i18n.t("ko.statement")).toBe("Statement");
    expect(f).toContain(i18n.t("ko.conditions"));
    expect(f).toContain(i18n.t("ko.measures"));
    expect(f).toContain(i18n.t("capture.fAsset"));
    await i18n.changeLanguage("de");
  });
});

describe("Wissensdetail · die Seite heißt wie ihr Wissen und sagt Status und Sicherheit einmal", () => {
  it("T1 · die einzige Überschrift der Lesefläche ist der Titel, nicht „Detail“", async () => {
    await i18n.changeLanguage("de");
    const c = await mount();
    const lesen = teil(c, "bib-lesen") as HTMLElement;
    const ueberschriften = [...lesen.querySelectorAll("h1")].map((h) => text(h));
    expect(ueberschriften).toEqual([TITEL]);
    expect(ueberschriften.join(" ")).not.toMatch(/\bDetail\b/);
  });

  it("T2 · der Status steht auf der Lesefläche genau einmal, die Sicherheit höchstens einmal", async () => {
    await i18n.changeLanguage("de");
    const c = await mount();
    const lesen = text(teil(c, "bib-lesen"));
    const pille = text(teil(c, "bib-pille"));
    expect(pille.length, "die Statuspille fehlt").toBeGreaterThan(0);
    // Als ganzes Wort gezählt: „Validierte"/„validierten" in anderen Sätzen sind keine Statusangabe.
    const alsWort = new RegExp(`(^|[^\\p{L}])${pille}(?=$|[^\\p{L}])`, "gu");
    expect(lesen.match(alsWort)?.length ?? 0).toBe(1);
    const flaeche = teil(c, "bib-lesen") as HTMLElement;
    expect(flaeche.querySelectorAll('[data-objektstatus="wissen"]').length).toBe(1);
    expect(vorkommen(lesen, i18n.t("evidence.percentSure", { pct: 80 }))).toBeLessThanOrEqual(1);
  });

  it("T3 · der Browser-Tab trägt den Titel des Eintrags und gibt ihn beim Verlassen zurück", async () => {
    await i18n.changeLanguage("de");
    document.title = "KLARWERK · Reasoning System";
    await mount();
    expect(document.title).toBe(`${TITEL} · KLARWERK · Reasoning System`);
    unmount();
    expect(document.title).toBe("KLARWERK · Reasoning System");
  });
});

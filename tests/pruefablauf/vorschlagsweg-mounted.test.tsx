// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME gesamt-peer-validierung · package:pruefablauf — DER VORSCHLAGSWEG IN DER FLÄCHE.
// ================================================================================================
//
// Ben, Nacharbeit 3: an der Web-Fläche fehlten (1) die benannte Prüfperson beim Einreichen, (2) die
// Rückfrage als dritte Antwort und (3) der Status des EIGENEN Vorschlags für den Einreicher — die
// Vorschlagsanzeige stand nur Freigabeberechtigten und nur für offene Vorschläge offen.
//
// GEMESSEN AN DER ECHTEN ROUTE `/wissen/:id` (`KnowledgeDetail` → `BibliothekLesen`), mit demselben
// Aufbau wie `tests/word-rueckweg/web-einreichweg-mounted.test.tsx`. ERSETZT ist nur die
// HTTP-Grenze (`api/endpoints`); Rollen, Zustand und jede Ableitung sind Produktcode. jsdom ist
// kein Browser: gemessen ist, WAS die Fläche aufruft und WAS sie sagt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  rolle: "experte" as "experte" | "controller" | "admin",
  ichId: "u-experte",
  aufrufe: [] as { id: string; body: Record<string, unknown> }[],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({
      id: box.ichId,
      name: "Eva",
      email: "e@x.de",
      role: box.rolle,
    })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => globalThis.__pruefablaufKo),
        list: vi.fn(async () => [globalThis.__pruefablaufKo]),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async (id: string, body: Record<string, unknown>) => {
          box.aufrufe.push({ id, body });
          return globalThis.__pruefablaufKo;
        }),
        remove: vi.fn(async () => undefined),
      },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: {
        list: vi.fn(async () => [
          { id: "u-experte", name: "Eva Expertin" },
          { id: "u-admin", name: "Ada Admin" },
        ]),
      },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => null),
        assist: vi.fn(async () => ({ text: "" })),
        assistPresets: leer,
        extract: vi.fn(async () => ({ points: [], note: null })),
        describeImage: vi.fn(async () => ({})),
      },
      aiCheck: { coverageSummary: vi.fn(async () => ({ total: 0 })) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useRef } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import type { KnowledgeObject, KoProposal } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ModalBoundaryProvider } from "../../apps/web/src/app/ModalBoundaryContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";

declare global {
  // eslint-disable-next-line no-var
  var __pruefablaufKo: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

const FREIGEGEBENER_TEXT = "Bei Überdruck Ventil X manuell schließen.";

function ko(over: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Ventil X",
    statement: FREIGEGEBENER_TEXT,
    bodyHtml: "<p>Der freigegebene Fließtext.</p>",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 99,
    trust: 99,
    status: "validiert",
    version: 3,
    author: "u-admin",
    originalAuthor: "u-admin",
    neededValidations: 2,
    assignments: [],
    asset: null,
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments: [],
    sources: [],
    attachments: [],
    ...over,
  } as KnowledgeObject;
}

function vorschlag(over: Partial<KoProposal> = {}): KoProposal {
  return {
    id: "p-1",
    author: "u-experte",
    at: "2026-09-13T07:00:00.000Z",
    baseVersion: 3,
    statement: "Ventil X zusätzlich verplomben.",
    status: "offen",
    origin: "klarwerk_web",
    ...over,
  };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function Huelle({ children }: { children: React.ReactNode }): JSX.Element {
  const mainRef = useRef<HTMLElement | null>(null);
  return createElement(ModalBoundaryProvider, {
    hostRef: mainRef,
    children: [
      createElement(
        "main",
        { key: "main", ref: mainRef, className: "flex-1 overflow-y-auto px-9 py-7" },
        children,
      ),
      createElement(ToastViewport, { key: "toasts" }),
    ],
  });
}

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
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
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/wissen/ko-1"] },
                  createElement(
                    Huelle,
                    null,
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
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

function da(testId: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

function muss(testId: string): HTMLElement {
  const treffer = da(testId);
  if (!treffer) {
    throw new Error(`„${testId}" ist auf der Fläche nicht da`);
  }
  return treffer;
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
  await act(flush);
}

async function bearbeiten(): Promise<void> {
  await klick(muss("bib-eintrag-menue"));
  await klick(muss("bib-menue-bearbeiten"));
}

function kernaussage(): HTMLTextAreaElement {
  const treffer = [...document.body.querySelectorAll("textarea")].find((f) =>
    f.value.includes(FREIGEGEBENER_TEXT),
  );
  if (!treffer) {
    throw new Error("das Kernaussage-Feld mit dem freigegebenen Text ist nicht da");
  }
  return treffer as HTMLTextAreaElement;
}

async function setzeWert(
  feld: HTMLTextAreaElement | HTMLSelectElement,
  wert: string,
  ereignis: "input" | "change",
): Promise<void> {
  await act(async () => {
    const istAuswahl = feld instanceof HTMLSelectElement;
    const proto = istAuswahl ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set as (v: string) => void;
    setter.call(feld, wert);
    feld.dispatchEvent(new Event(ereignis, { bubbles: true }));
    await flush();
  });
  await act(flush);
}

function schreibaufrufe(aktion: string): Record<string, unknown>[] {
  return box.aufrufe.filter((a) => a.body.action === aktion).map((a) => a.body);
}

beforeEach(async () => {
  box.rolle = "experte";
  box.ichId = "u-experte";
  box.aufrufe = [];
  globalThis.__pruefablaufKo = ko();
  await i18n.changeLanguage("de");
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  qc.clear();
});

describe("package:pruefablauf · die benannte Prüfperson beim Einreichen", () => {
  it("P1 · die Auswahl bietet andere Personen an, und die gewählte reist mit dem Vorschlag", async () => {
    await mount();
    await bearbeiten();
    const wahl = muss("bib-pruefer-wahl") as HTMLSelectElement;
    const angeboten = [...wahl.options].map((o) => o.value);
    // Leer = keine bestimmte Person; die eigene Person steht nicht zur Wahl.
    expect(angeboten).toEqual(["", "u-admin"]);

    await setzeWert(kernaussage(), "Ventil X zusätzlich verplomben.", "input");
    await setzeWert(wahl, "u-admin", "change");
    await klick(muss("bib-einreichen"));

    const eingereicht = schreibaufrufe("propose");
    expect(eingereicht).toHaveLength(1);
    expect(eingereicht[0]?.proposal).toMatchObject({
      statement: "Ventil X zusätzlich verplomben.",
      baseVersion: 3,
      pruefer: "u-admin",
    });
  });

  it("P2 · GEGENPROBE: ohne Wahl geht kein Prüferfeld hinaus — der bisherige Vertrag bleibt", async () => {
    await mount();
    await bearbeiten();
    await setzeWert(kernaussage(), "Ventil X zusätzlich verplomben.", "input");
    await klick(muss("bib-einreichen"));
    const eingereicht = schreibaufrufe("propose");
    expect(eingereicht).toHaveLength(1);
    expect(Object.keys((eingereicht[0]?.proposal ?? {}) as object)).not.toContain("pruefer");
  });
});

describe("package:pruefablauf · die Rückfrage im Prüfweg", () => {
  it("P3 · die Prüferin sieht die benannte Person und stellt eine Rückfrage mit Inhalt", async () => {
    box.rolle = "admin";
    box.ichId = "u-admin";
    globalThis.__pruefablaufKo = ko({ proposals: [vorschlag({ pruefer: "u-admin" })] });
    await mount();

    expect(muss("bib-vorschlag-pruefer").textContent).toBe(
      i18n.t("pruefablauf.pruefer.zugeordnet", { name: "Ada Admin" }),
    );
    await klick(muss("bib-vorschlag-rueckfrage"));
    const senden = muss("bib-vorschlag-rueckfrage-ab") as HTMLButtonElement;
    // Ohne Inhalt keine Rückfrage — niemand wüsste, was zu klären ist.
    expect(senden.disabled).toBe(true);
    await setzeWert(
      muss("bib-vorschlag-rueckfrage-text") as HTMLTextAreaElement,
      "Gilt das auch für Ventil Y?",
      "input",
    );
    await klick(muss("bib-vorschlag-rueckfrage-ab"));

    expect(schreibaufrufe("decide-proposal")).toEqual([
      {
        action: "decide-proposal",
        proposalId: "p-1",
        decision: "rueckfrage",
        expectedVersion: 3,
        note: "Gilt das auch für Ventil Y?",
      },
    ]);
  });

  it("P4 · eine gestellte Rückfrage steht am offenen Vorschlag — mit Person und Inhalt", async () => {
    box.rolle = "admin";
    box.ichId = "u-admin";
    globalThis.__pruefablaufKo = ko({
      proposals: [
        vorschlag({
          rueckfragen: [
            { von: "u-admin", at: "2026-09-14T08:00:00.000Z", text: "Bitte Quelle nennen." },
          ],
        }),
      ],
    });
    await mount();
    const liste = muss("bib-vorschlaege");
    const eintrag = liste.querySelector('[data-testid="bib-vorschlag-rueckfrage-eintrag"]');
    const frage = eintrag?.textContent;
    expect(frage).toContain("Ada Admin");
    expect(frage).toContain("Bitte Quelle nennen.");
    // Der Vorschlag ist weiter entscheidbar.
    expect(da("bib-vorschlag-uebernehmen")).not.toBeNull();
  });
});

describe("package:pruefablauf · der Einreicher sieht den Status", () => {
  it("P5 · ohne Freigaberecht: offen mit Rückfrage, übernommen mit Fassung, abgelehnt mit Begründung", async () => {
    globalThis.__pruefablaufKo = ko({
      proposals: [
        vorschlag({
          id: "p-offen",
          rueckfragen: [
            { von: "u-admin", at: "2026-09-14T08:00:00.000Z", text: "Bitte Quelle nennen." },
          ],
        }),
        vorschlag({
          id: "p-genommen",
          status: "uebernommen",
          resultVersion: 4,
          decidedBy: "u-admin",
          decidedAt: "2026-09-15T08:00:00.000Z",
        }),
        vorschlag({
          id: "p-weg",
          status: "abgelehnt",
          decidedBy: "u-admin",
          decidedAt: "2026-09-16T08:00:00.000Z",
          note: "Widerspricht der Betriebsanweisung 4.",
        }),
      ],
    });
    await mount();

    // Die Prüferansicht steht ihm nicht offen — die eigene Statusansicht schon.
    expect(da("bib-vorschlaege")).toBeNull();
    const liste = muss("bib-eigene-vorschlaege");
    const teil = (id: string, testId: string): string => {
      const eintrag = liste.querySelector(`[data-vorschlag-id="${id}"]`);
      return eintrag?.querySelector(`[data-testid="${testId}"]`)?.textContent ?? "";
    };
    const ganz = (id: string): string =>
      liste.querySelector(`[data-vorschlag-id="${id}"]`)?.textContent ?? "";
    const status = "bib-eigener-vorschlag-status";

    expect(teil("p-offen", status)).toBe(i18n.t("pruefablauf.status.offenRueckfrage"));
    expect(ganz("p-offen")).toContain("Bitte Quelle nennen.");

    expect(teil("p-genommen", status)).toBe(i18n.t("pruefablauf.status.uebernommen", { n: "4" }));
    expect(ganz("p-genommen")).toContain("Ada Admin");

    expect(teil("p-weg", status)).toBe(i18n.t("pruefablauf.status.abgelehnt"));
    const grund = i18n.t("pruefablauf.begruendung", {
      text: "Widerspricht der Betriebsanweisung 4.",
    });
    expect(teil("p-weg", "bib-eigener-vorschlag-begruendung")).toBe(grund);
  });

  it("P6 · GEGENPROBE: fremde Vorschläge stehen nicht in der eigenen Statusansicht", async () => {
    globalThis.__pruefablaufKo = ko({ proposals: [vorschlag({ author: "u-fremd" })] });
    await mount();
    expect(da("bib-eigene-vorschlaege")).toBeNull();
  });
});

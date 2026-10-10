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
  // eslint-disable-next-line no-var
  var __wissensdetailRolle: string | undefined;
  // eslint-disable-next-line no-var
  var __wissensdetailKonflikte: unknown[] | undefined;
}

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({
      id: "u1",
      name: "Eva",
      email: "e@x.de",
      role: globalThis.__wissensdetailRolle ?? "admin",
    })),
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
      conflicts: { list: vi.fn(async () => globalThis.__wissensdetailKonflikte ?? []) },
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

// `scrollIntoView` fehlt in jsdom; der Sprung in „Mehr" ruft es (Muster: JOB 3108,
// `tests/berichtskopf-spruenge/kopf-fuehrt-zu-quellen-und-anhaengen.test.tsx`).
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => undefined;

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
  globalThis.__wissensdetailRolle = undefined;
  globalThis.__wissensdetailKonflikte = undefined;
});

async function klick(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

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
    const flaeche = teil(c, "bib-lesen") as HTMLElement;
    const lesen = text(flaeche);
    const pille = text(teil(c, "bib-pille"));
    expect(pille.length, "die Statuspille fehlt").toBeGreaterThan(0);
    // Je TEXTKNOTEN als ganzes Wort gezählt. `textContent` der ganzen Fläche klebt benachbarte
    // Pillen ohne Zwischenraum aneinander („ValidiertIntern") — dort gäbe es keine Wortgrenze.
    // „Validierte"/„validierten" in anderen Sätzen sind keine Statusangabe.
    const alsWort = new RegExp(`(^|[^\\p{L}])${pille}(?=$|[^\\p{L}])`, "gu");
    let statusNennungen = 0;
    const gang = document.createTreeWalker(flaeche, NodeFilter.SHOW_TEXT);
    for (let k = gang.nextNode(); k !== null; k = gang.nextNode()) {
      statusNennungen += (k.textContent ?? "").match(alsWort)?.length ?? 0;
    }
    expect(statusNennungen).toBe(1);
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

// ================================================================================================
// R-0998 · DIE NÄCHSTE SINNVOLLE HANDLUNG — sichtbar UND bedienbar, an den vorhandenen Wegen.
// ================================================================================================
const QUELLE = {
  id: "q1",
  label: "Reinigungsplan R-7",
  url: null,
  excerpt: null,
  kind: "document",
  peerValidated: false,
  author: "u1",
  at: "2026-08-01T00:00:00.000Z",
};

function empfehlung(c: HTMLElement): HTMLElement {
  const e = teil(c, "bib-naechste");
  if (!e) {
    throw new Error(`Die Empfehlung fehlt; DOM: ${text(c)}`);
  }
  return e;
}

function ziel(c: HTMLElement): HTMLElement {
  const e = teil(c, "bib-naechste-ziel");
  if (!e) {
    throw new Error("Das Ziel der Empfehlung fehlt");
  }
  return e;
}

describe("Wissensdetail · R-0998 · die nächste sinnvolle Handlung", () => {
  it("H1 · validiert → „In Fragen nutzen“ über DENSELBEN Fragenweg wie der Knopf „Fragen“", async () => {
    await i18n.changeLanguage("de");
    const c = await mount();
    const e = empfehlung(c);
    expect(e.getAttribute("data-naechste")).toBe("use");
    expect(text(e)).toContain(i18n.t("ko.nextLabel"));
    expect(text(e)).toContain(i18n.t("ko.next.use"));
    const a = ziel(c);
    expect(a.tagName).toBe("A");
    expect(text(a)).toBe(i18n.t("ko.cta.use"));
    // Herkunft (`ko=<id>`) und Vertraulichkeitsverhalten kommen aus `fragenHref` — dieselbe
    // Adresse wie der verbindliche Knopf „Fragen“ im Kopf, nicht `koCta`s nackte Frage.
    const fragen = teil(c, "bib-fragen") as HTMLAnchorElement;
    expect(a.getAttribute("href")).toBe(fragen.getAttribute("href"));
    expect(a.getAttribute("href")).toContain("ko=ko-1");
    // Inhalt, kein Erklärtext (H4-Textmesser).
    expect(e.getAttribute("data-bib-text")).toBe("naechste");
  });

  it("H2 · in Prüfung (zugewiesen) → „Bewertung abschließen“, für den Admin ein Weg zur Validierung", async () => {
    await i18n.changeLanguage("de");
    const c = await mount({ status: "offen", assignments: ["u2"] } as Partial<KnowledgeObject>);
    expect(empfehlung(c).getAttribute("data-naechste")).toBe("review");
    expect(text(empfehlung(c))).toContain(i18n.t("ko.next.review"));
    const a = ziel(c);
    expect(a.tagName).toBe("A");
    expect(a.getAttribute("href")).toBe("/validierung");
    expect(text(a)).toBe(i18n.t("ko.cta.review"));
  });

  it("H3 · offen mit Quelle → „Zur Validierung“; ein Viewer sieht die Empfehlung, aber keinen Weg", async () => {
    await i18n.changeLanguage("de");
    globalThis.__wissensdetailRolle = "viewer";
    const c = await mount({ status: "offen", sources: [QUELLE] } as Partial<KnowledgeObject>);
    expect(empfehlung(c).getAttribute("data-naechste")).toBe("validate");
    expect(text(empfehlung(c))).toContain(i18n.t("ko.next.validate"));
    const z = ziel(c);
    // `RoleLink`: /validierung verlangt controller — kein Link, kein href, sichtbar „Kein Zugriff“.
    expect(z.tagName).not.toBe("A");
    expect(z.getAttribute("data-role-no-reach")).toBe("true");
    expect(empfehlung(c).querySelector('a[href^="/validierung"]')).toBeNull();
    expect(text(z)).toContain(i18n.t("ko.cta.validate"));
  });

  it("H4 · offen ohne Quelle und Anhang → „Zu Quellen & Belegen“ öffnet „Mehr“ und den Quellenabschnitt — auch ein zweites Mal", async () => {
    await i18n.changeLanguage("de");
    const c = await mount({ status: "offen" } as Partial<KnowledgeObject>);
    expect(empfehlung(c).getAttribute("data-naechste")).toBe("addSource");
    const knopf = ziel(c);
    expect(knopf).toBeInstanceOf(HTMLButtonElement);
    expect((knopf as HTMLButtonElement).type).toBe("button");
    expect(text(knopf)).toBe(i18n.t("ko.cta.addSource"));
    const mehr = teil(c, "bib-mehr") as HTMLButtonElement;
    expect(mehr.getAttribute("aria-expanded")).toBe("false");

    await klick(knopf);
    expect(mehr.getAttribute("aria-expanded")).toBe("true");
    const quellen = () => c.querySelector<HTMLDetailsElement>('[data-bib-abschnitt="quellen"]');
    expect(quellen()?.open, "der Quellenabschnitt steht nicht offen").toBe(true);
    expect(document.activeElement).toBe(quellen()?.querySelector("summary"));

    // Zuklappen von Hand verwirft das Sprungziel; der zweite Sprung muss wieder wirken.
    await klick(mehr);
    expect(mehr.getAttribute("aria-expanded")).toBe("false");
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    await klick(ziel(c));
    expect(quellen()?.open, "der zweite Sprung wirkte nicht").toBe(true);
    expect(document.activeElement).toBe(quellen()?.querySelector("summary"));
  });

  it("H5 · ein offener Konflikt am validierten Eintrag → nicht „nutzen“, sondern „Bewertung abschließen“", async () => {
    await i18n.changeLanguage("de");
    globalThis.__wissensdetailKonflikte = [
      {
        id: "c1",
        koA: "ko-1",
        koB: "ko-2",
        type: "truth",
        description: "Widerspruch zur Reinigungsfolge",
        status: "offen",
        secondOpinion: null,
        decidedBy: null,
        decision: null,
        createdAt: "2026-08-02T00:00:00.000Z",
      },
    ];
    const c = await mount();
    expect(empfehlung(c).getAttribute("data-naechste")).toBe("review");
    expect(text(empfehlung(c))).not.toContain(i18n.t("ko.next.use"));
  });

  it("H6 · EN: Empfehlung und Ziel in der Oberflächensprache", async () => {
    await i18n.changeLanguage("en");
    const c = await mount();
    expect(text(empfehlung(c))).toContain(i18n.t("ko.nextLabel"));
    expect(i18n.t("ko.nextLabel")).toBe("Next action:");
    expect(text(ziel(c))).toBe(i18n.t("ko.cta.use"));
    await i18n.changeLanguage("de");
  });
});

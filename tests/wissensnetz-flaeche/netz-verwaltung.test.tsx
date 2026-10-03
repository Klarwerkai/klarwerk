// @vitest-environment jsdom
// ================================================================================================
// R-0744 — DIE VERWALTERSEITE RUND UM DIE NETZDARSTELLUNG, MIT AUSDRÜCKLICH ZU WÄHLENDEM
// QUALITÄTSBLICK.
// ================================================================================================
//
// Wortlaut R-0744: „Für Verwalter gibt es eine Seite rund um die Netzdarstellung: Kopfkennzahlen,
// Filterleiste, Detailfenster und Suche, rein lesend, ohne Bearbeiten im Netz. Dazu kommt ein
// ausdrücklich zu wählender Qualitätsblick auf Konflikte, Lücken, veraltetes Wissen und Dubletten –
// jede Zahl mit ihrem Nenner und dem Alter des Bestands."
//
// Fläche: /graph → `GraphView` (`apps/web/src/pages/Stufe2.tsx`), eine Stufe-2-Seite (nur Verwalter).
// Echt sind Seite, i18n, React-Query und Router; ersetzt ist allein die Endpointgrenze.
//
//   Q1  ohne Wahl: kein Qualitätsblick, und keiner seiner Eingänge wird geladen
//   Q2  gewählt: vier Quoten, JEDE mit Nenner, gezählt nur über Objekte der Graphantwort; das Alter
//       des Bestands aus dem jüngsten Eintrag IM GRAPHEN (ein jüngerer außerhalb zählt nicht)
//   Q3  ein Eingang scheitert → „nicht erhoben", nie „0 von N"; die anderen bleiben stehen
//   Q4  abwählen blendet ihn wieder aus
//   Q5  solange ein Eingang lädt: „wird erhoben" — weder eine Zahl noch „nicht erhoben"
//   K1  die Kopfkennzahlen stehen über dem Bild
//   F1  Filterleiste: Status allein und zusammen mit dem Titelteil (Suche)
//   D1  Detailfenster: Titel, Status, Konflikte, Verbindungen mit Grund, Öffnen-Link — rein lesend
//   D2  fällt der Eintrag aus dem Filter, schließt das Detailfenster
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }),
}));

const KNOTEN = [
  { id: "n1", title: "Pumpe P2 schmieren" },
  { id: "n2", title: "Pumpe P3 schmieren" },
  { id: "n3", title: "Ventil X schliessen" },
  { id: "n4", title: "Filter F3 pruefen" },
  { id: "n5", title: "Notstrom testen" },
];
const JUENGSTER_IM_GRAPHEN = "2026-09-30T10:00:00.000Z";

const d = vi.hoisted(() => ({
  dublettenFehler: false,
  anstehendHaengt: false,
  duplicates: vi.fn(),
  pending: vi.fn(),
  luecken: vi.fn(),
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const arrFn = () => vi.fn(async () => []);
  const ko = (id: string, title: string, status: string, createdAt: string) => ({
    id,
    title,
    status,
    createdAt,
    tags: [],
    trust: 80,
    confidence: 80,
    type: "regel",
    category: "Betrieb",
    conditions: [],
    measures: [],
    assignments: [],
    version: 1,
    author: "a",
    originalAuthor: "a",
  });
  d.duplicates.mockImplementation(async () => {
    if (d.dublettenFehler) {
      throw new Error("Pruefstand: Dubletten gestoert");
    }
    return [
      { id: "o1", koA: "n1", koB: "n2", status: "offen" },
      { id: "o2", koA: "n4", koB: "n5", status: "geschlossen" },
    ];
  });
  d.pending.mockImplementation(() =>
    d.anstehendHaengt ? new Promise<never>(() => undefined) : Promise.resolve(["n4", "fremd"]),
  );
  d.luecken.mockImplementation(async () => ({
    objekteGesamt: 6,
    ohneThema: 2,
    sichtbareBeitragendeGesamt: 1,
    themen: [],
  }));
  const base: Record<string, unknown> = {
    library: {
      graph: vi.fn(async () => ({
        nodes: [
          { id: "n1", title: "Pumpe P2 schmieren" },
          { id: "n2", title: "Pumpe P3 schmieren" },
          { id: "n3", title: "Ventil X schliessen" },
          { id: "n4", title: "Filter F3 pruefen" },
          { id: "n5", title: "Notstrom testen" },
        ],
        edges: [{ a: "n1", b: "n2", via: "pumpe" }],
        kuratierteKanten: [
          {
            a: "n2",
            b: "n3",
            art: "ergaenzt",
            richtung: "ungerichtet",
            status: "aktiv",
            herkunft: "kuratiert",
          },
        ],
        kuratierteKantenGesamt: 1,
        kuratierteKantenGekuerzt: false,
      })),
    },
    conflicts: {
      list: vi.fn(async () => [
        { id: "c1", koA: "n1", koB: "n3", status: "offen", createdAt: "2026-09-01T00:00:00Z" },
        { id: "c2", koA: "n4", koB: "n5", status: "geloest", createdAt: "2026-09-01T00:00:00Z" },
        // Ein Konflikt ausserhalb der Graphantwort darf keine Zahl erhoehen.
        {
          id: "c3",
          koA: "fremd",
          koB: "fremd-2",
          status: "offen",
          createdAt: "2026-09-01T00:00:00Z",
        },
      ]),
    },
    ko: {
      list: vi.fn(async () => [
        ko("n1", "Pumpe P2 schmieren", "validiert", "2026-09-01T10:00:00.000Z"),
        ko("n2", "Pumpe P3 schmieren", "validiert", "2026-09-02T10:00:00.000Z"),
        ko("n3", "Ventil X schliessen", "offen", "2026-09-03T10:00:00.000Z"),
        ko("n4", "Filter F3 pruefen", "offen", "2026-09-04T10:00:00.000Z"),
        ko("n5", "Notstrom testen", "offen", "2026-09-30T10:00:00.000Z"),
        // Juenger, aber NICHT im Graphen — das Alter des Bestands darf ihn nicht nehmen.
        ko("fremd", "Fremdes Objekt", "offen", "2026-10-02T10:00:00.000Z"),
      ]),
    },
    duplicates: { list: d.duplicates },
    lifecycle: { pending: d.pending },
    wissensnetz: { luecken: d.luecken },
  };
  const endpoints = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return new Proxy({}, { get: () => arrFn() });
    },
  });
  return { endpoints };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { koDetailPath } from "../../apps/web/src/lib/graphNav";
import { GraphView } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let steht = false;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
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
          ToastProvider,
          null,
          createElement(
            MemoryRouter,
            { initialEntries: ["/graph"] },
            createElement(
              Routes,
              null,
              createElement(Route, { path: "/graph", element: createElement(GraphView) }),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  steht = true;
}

function abbauen(): void {
  if (!steht) return;
  act(() => root.unmount());
  container.remove();
  steht = false;
}

const marke = (id: string): HTMLElement | null => container.querySelector(`[data-testid="${id}"]`);
const ids = (): string[] =>
  [...container.querySelectorAll('[data-testid="graph-objekt"]')].map(
    (e) => e.getAttribute("data-id") ?? "?",
  );

async function klick(el: Element | null): Promise<void> {
  expect(el, "Bedienelement fehlt").not.toBeNull();
  await act(async () => {
    (el as HTMLElement).click();
    await flush();
  });
}

async function setzeFeld(id: string, wert: string): Promise<void> {
  const feld = marke(id) as HTMLInputElement | HTMLSelectElement | null;
  expect(feld, `Feld ${id}`).not.toBeNull();
  const proto =
    feld instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setzer = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  await act(async () => {
    setzer?.call(feld, wert);
    feld?.dispatchEvent(
      new Event(feld instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
    );
    await flush();
  });
}

const quote = (was: string, anzahl: number, nenner: number): string =>
  i18n.t("graph.qb.quote", { was: i18n.t(`graph.qb.${was}`), anzahl, nenner });

beforeEach(async () => {
  d.dublettenFehler = false;
  d.anstehendHaengt = false;
  await i18n.changeLanguage("de");
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

describe("R-0744 · der Qualitätsblick ist zu wählen, jede Zahl trägt ihren Nenner", () => {
  it("Q1 · ohne Wahl: kein Qualitätsblick, keiner seiner Eingänge wird geladen", async () => {
    await mount();
    const schalter = marke("graph-qb-schalter");
    expect(schalter?.getAttribute("aria-pressed")).toBe("false");
    expect(schalter?.textContent).toBe(i18n.t("graph.qb.an"));
    expect(marke("graph-qb-inhalt")).toBeNull();
    expect(d.duplicates).not.toHaveBeenCalled();
    expect(d.pending).not.toHaveBeenCalled();
    expect(d.luecken).not.toHaveBeenCalled();
  });

  it("Q2 · gewählt: vier Quoten mit Nenner — nur Objekte der Graphantwort; das Alter aus dem jüngsten Graph-Eintrag", async () => {
    await mount();
    await klick(marke("graph-qb-schalter"));
    expect(marke("graph-qb-schalter")?.getAttribute("aria-pressed")).toBe("true");
    // n1 und n3 (offener Konflikt c1); c2 ist gelöst, c3 liegt ausserhalb des Graphen.
    expect(marke("graph-qb-konflikte")?.textContent).toBe(quote("konflikte", 2, 5));
    // Nenner der Sichtmetrik: alle sichtbaren Objekte, davon zwei ohne Schlagwort.
    expect(marke("graph-qb-luecken")?.textContent).toBe(quote("luecken", 2, 6));
    // n4 steht an; „fremd" ist nicht im Graphen.
    expect(marke("graph-qb-veraltet")?.textContent).toBe(quote("veraltet", 1, 5));
    // n1 und n2 (offene Überschneidung o1); o2 ist geschlossen.
    expect(marke("graph-qb-dubletten")?.textContent).toBe(quote("dubletten", 2, 5));
    const ms = Date.parse(JUENGSTER_IM_GRAPHEN);
    const tage = Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
    expect(marke("graph-qb-alter")?.textContent).toBe(
      i18n.t("graph.qb.alter", {
        datum: new Date(JUENGSTER_IM_GRAPHEN).toLocaleDateString("de"),
        count: tage,
      }),
    );
    expect(d.duplicates).toHaveBeenCalled();
    expect(d.pending).toHaveBeenCalled();
    expect(d.luecken).toHaveBeenCalled();
  });

  it("Q3 · ein gescheiterter Eingang heißt „nicht erhoben“ — keine 0, die anderen bleiben", async () => {
    d.dublettenFehler = true;
    await mount();
    await klick(marke("graph-qb-schalter"));
    expect(marke("graph-qb-dubletten")?.textContent).toBe(
      i18n.t("graph.qb.nichtErhoben", { was: i18n.t("graph.qb.dubletten") }),
    );
    expect(marke("graph-qb-dubletten")?.textContent ?? "").not.toMatch(/\b0\b/);
    expect(marke("graph-qb-konflikte")?.textContent).toBe(quote("konflikte", 2, 5));
  });

  it("Q5 · solange ein Eingang lädt, heißt es „wird erhoben“ — weder Zahl noch „nicht erhoben“", async () => {
    d.anstehendHaengt = true;
    await mount();
    await klick(marke("graph-qb-schalter"));
    expect(marke("graph-qb-veraltet")?.getAttribute("data-zustand")).toBe("laedt");
    expect(marke("graph-qb-veraltet")?.textContent).toBe(
      i18n.t("graph.qb.laedt", { was: i18n.t("graph.qb.veraltet") }),
    );
    expect(marke("graph-qb-luecken")?.getAttribute("data-zustand")).toBe("erhoben");
  });

  it("Q4 · abwählen blendet den Qualitätsblick wieder aus", async () => {
    await mount();
    await klick(marke("graph-qb-schalter"));
    expect(marke("graph-qb-inhalt")).not.toBeNull();
    await klick(marke("graph-qb-schalter"));
    expect(marke("graph-qb-inhalt")).toBeNull();
    expect(marke("graph-qb-schalter")?.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("R-0744 · Kopfkennzahlen, Filterleiste, Suche und Detailfenster — rein lesend", () => {
  it("K1 · die Kopfkennzahlen stehen über dem Bild", async () => {
    await mount();
    expect(marke("graph-kopfkennzahlen")?.textContent).toContain(
      i18n.t("s2.graphCount", { nodes: 5, edges: 1 }),
    );
    expect(marke("graph-kopfkennzahlen")?.textContent).toContain(
      i18n.t("graph.kuratiertCount", { count: 1 }),
    );
  });

  it("F1 · Status allein und zusammen mit dem Titelteil", async () => {
    await mount();
    expect([...ids()].sort()).toEqual(KNOTEN.map((k) => k.id).sort());
    await setzeFeld("graph-objektliste-status", "validiert");
    expect([...ids()].sort()).toEqual(["n1", "n2"]);
    await setzeFeld("graph-objektliste-status", "nicht-validiert");
    expect([...ids()].sort()).toEqual(["n3", "n4", "n5"]);
    await setzeFeld("graph-objektliste-filter", "Pumpe");
    expect(ids()).toEqual([]);
    expect(marke("graph-objektliste-leer")).not.toBeNull();
    await setzeFeld("graph-objektliste-status", "alle");
    expect([...ids()].sort()).toEqual(["n1", "n2"]);
  });

  it("D1 · Detailfenster: Titel, Status, Konflikte, Verbindungen mit Grund, Öffnen — und nichts zum Bearbeiten", async () => {
    await mount();
    await klick(container.querySelector('[data-id="n2"] [data-testid="graph-objekt-details"]'));
    const fenster = marke("graph-detail");
    expect(fenster?.getAttribute("data-id")).toBe("n2");
    expect(marke("graph-detail-titel")?.textContent).toBe("Pumpe P3 schmieren");
    expect(marke("graph-detail-status")?.textContent).toBe(
      i18n.t("graph.detail.status", { status: i18n.t("graph.legendValidated") }),
    );
    expect(marke("graph-detail-konflikte")?.textContent).toBe(
      i18n.t("graph.detail.konflikte", { count: 0 }),
    );
    const verbindungen = [
      ...(marke("graph-detail-verbindungen")?.querySelectorAll("li") ?? []),
    ].map((l) => l.textContent);
    expect(verbindungen).toContain(
      i18n.t("graph.detail.verbindung", {
        title: "Pumpe P2 schmieren",
        grund: i18n.t("graph.detail.grundSchlagwort", { via: "pumpe" }),
      }),
    );
    expect(verbindungen.some((v) => (v ?? "").startsWith("Ventil X schliessen — "))).toBe(true);
    expect(marke("graph-detail-oeffnen")?.getAttribute("href")).toBe(koDetailPath("n2"));
    // Rein lesend: kein Eingabefeld, nur der Schließen-Schalter.
    expect(fenster?.querySelectorAll("input, select, textarea, form").length).toBe(0);
    expect(
      [...(fenster?.querySelectorAll("button") ?? [])].map((b) => b.getAttribute("data-testid")),
    ).toEqual(["graph-detail-schliessen"]);
    // Konflikte am Objekt n1: c1 ist offen.
    await klick(container.querySelector('[data-id="n1"] [data-testid="graph-objekt-details"]'));
    expect(marke("graph-detail")?.getAttribute("data-id")).toBe("n1");
    expect(marke("graph-detail-konflikte")?.textContent).toBe(
      i18n.t("graph.detail.konflikte", { count: 1 }),
    );
    await klick(marke("graph-detail-schliessen"));
    expect(marke("graph-detail")).toBeNull();
  });

  it("D2 · fällt der Eintrag aus dem Filter, schließt das Detailfenster", async () => {
    await mount();
    await klick(container.querySelector('[data-id="n3"] [data-testid="graph-objekt-details"]'));
    expect(marke("graph-detail")?.getAttribute("data-id")).toBe("n3");
    await setzeFeld("graph-objektliste-status", "validiert");
    expect(marke("graph-detail")).toBeNull();
  });
});

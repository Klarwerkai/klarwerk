// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME gesamt-wissensluecken · Nacharbeit 1 — DIE DREI NEUEN AUSKÜNFTE AN IHRER FLÄCHE.
// ================================================================================================
//
//   R-0291 · am Lücken-Board steht je offener Lücke, welcher Beleg fehlen würde — mit denselben
//            Torwörtern wie die Antwortfläche; redigierte Lücken zeigen nichts davon.
//   R-0773 · „Deine Suchen ohne Treffer" erscheint, sobald es eigene gibt, und trägt den
//            Suchbegriff NICHT in die Adresse des Erfassungseinstiegs.
//   R-1626 · „Meine Aufgaben" nennt die Themen, deren einziger sichtbarer Träger die Person ist,
//            samt Einstieg ins Interview — und nichts, wenn jemand anderes mitträgt.
//
// Gemessen wird die gemountete Seite mit derselben Haken-Attrappe wie in
// `tests/ask/gap-sprachetikett-sichtbar.test.tsx`. Optische Abnahme im Browser bleibt offen.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Gap, NulltrefferSuche } from "../../apps/web/src/api/types";

const lage = vi.hoisted(() => ({ gaps: [] as unknown[], kos: [] as unknown[] }));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useGaps: () => ok(lage.gaps),
    useKos: () => ok(lage.kos),
    useAudit: () => ok([]),
    useConflicts: () => ok([]),
    useLifecyclePending: () => ok([]),
    useValidationBoard: () => ok([]),
    useDirectory: () => ok([]),
    useRisks: () => ok([]),
    useCaptureDrafts: () => ok([]),
    useBusFactor: () => ok([]),
    useExpertise: () => ok([]),
    useAiCheckCoverageSummary: () => ok(null),
    useRiskHorizon: () => ok({ generatedAt: "", seesAll: false, areas: [] }),
    useManagementProfiles: () => ok({ categories: [], retirement: [] }),
    useFeatures: () => ok(null),
    useGapAnsprechpartner: () => ok(null),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { meineEinzelquellenThemen } from "../../apps/web/src/lib/meineEinzelquellen";
import { MyTasks } from "../../apps/web/src/pages/MyTasks";
import { Risk } from "../../apps/web/src/pages/Risk";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

function gap(teil: Partial<Gap> & Pick<Gap, "id">): Gap {
  return {
    question: "Wie oft wird der Abscheider gespuelt?",
    status: "offen",
    assignee: null,
    priority: "mittel",
    createdAt: "2026-10-01T00:00:00.000Z",
    locale: "de",
    ...teil,
  };
}

function ko(id: string, category: string, originalAuthor: string): unknown {
  return {
    id,
    title: `Objekt ${id}`,
    statement: "Aussage",
    type: "best_practice",
    category,
    author: originalAuthor,
    originalAuthor,
    status: "validiert",
    tags: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

function mount(
  seite: () => JSX.Element,
  daten: { gaps?: Gap[]; kos?: unknown[]; nulltreffer?: NulltrefferSuche[] } = {},
): void {
  lage.gaps = daten.gaps ?? [];
  lage.kos = daten.kos ?? [];
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  // `staleTime: Infinity`: der vorbelegte Stand IST die Serverantwort dieses Falls — es wird nicht
  // nachgeladen (ohne Server gäbe es dafür keine Antwort).
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  if (daten.nulltreffer) {
    qc.setQueryData(["library", "nulltreffer"], daten.nulltreffer);
  }
  act(() => {
    r.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: ["/aufgaben"] }, createElement(seite)),
      ),
    );
  });
}

afterEach(() => {
  if (root) {
    const r = root;
    act(() => r.unmount());
    root = null;
  }
  container?.remove();
});

const belegbedarf = (): string =>
  container.querySelector('[data-testid="luecke-belegbedarf"]')?.textContent ?? "";

describe("R-0291 · der Belegbedarf am Lücken-Board", () => {
  it("F1 · die Torwörter der Antwortfläche, in der Reihenfolge des Servers", () => {
    mount(Risk, { gaps: [gap({ id: "g1", belegbedarf: ["freigabe", "stufe"] })] });
    expect(belegbedarf()).toContain(i18n.t("gap.belegbedarf.label"));
    expect(belegbedarf()).toContain("Freigabe fehlt");
    expect(belegbedarf()).toContain("Vertraulichkeitsstufe fehlt");
    expect(belegbedarf().indexOf("Freigabe")).toBeLessThan(belegbedarf().indexOf("Vertraulich"));
  });

  it("F2 · es fehlt ein Wissensobjekt — ausdrücklich so benannt", () => {
    mount(Risk, { gaps: [gap({ id: "g2", belegbedarf: ["wissensobjekt"] })] });
    expect(belegbedarf()).toContain(i18n.t("gap.belegbedarf.wissensobjekt"));
  });

  it("F3 · Altbestand ohne Befund → ausdrücklich „unbestimmt“, nicht Schweigen", () => {
    mount(Risk, { gaps: [gap({ id: "g3" })] });
    expect(belegbedarf()).toContain(i18n.t("gap.belegbedarf.unbestimmt"));
  });

  it("F4 · redigierte Lücke → kein Befund (er gehört zur Frage)", () => {
    mount(Risk, { gaps: [gap({ id: "g4", question: "", redacted: true })] });
    expect(container.textContent, "KALIBRIERUNG").toContain(i18n.t("risk.gapRedacted"));
    expect(container.querySelector('[data-testid="luecke-belegbedarf"]')).toBeNull();
  });
});

describe("R-0773 · die eigenen Suchen ohne Treffer", () => {
  it("F5 · eigene Nulltreffer stehen mit Häufigkeit da; der Einstieg trägt den Begriff nicht", () => {
    mount(Risk, {
      nulltreffer: [{ begriff: "Kesselflansch", anzahl: 2, zuletzt: "2026-10-08T10:00:00.000Z" }],
    });
    const flaeche = container.querySelector('[data-testid="eigene-nulltreffer"]');
    expect(flaeche, "die Fläche fehlt").not.toBeNull();
    expect(flaeche?.textContent).toContain("Kesselflansch");
    expect(flaeche?.textContent).toContain("2× gesucht");
    expect(flaeche?.textContent).toContain(i18n.t("nulltreffer.hinweis"));
    const links = Array.from(flaeche?.querySelectorAll("a") ?? []);
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/erfassen"]);
  });

  it("F7 · gefilterte Nulltreffer tragen ihre Eingrenzung — kein Befund über den ganzen Bestand", () => {
    mount(Risk, {
      nulltreffer: [
        {
          begriff: "Kesselflansch",
          anzahl: 1,
          zuletzt: "2026-10-09T10:00:00.000Z",
          eingrenzung: { category: "Wartung" },
        },
        { begriff: "Kesselflansch", anzahl: 1, zuletzt: "2026-10-09T09:00:00.000Z" },
      ],
    });
    const zeilen = Array.from(container.querySelectorAll('[data-testid="nulltreffer-zeile"]'));
    expect(zeilen, "zwei Einträge, nicht einer").toHaveLength(2);
    const marken = container.querySelectorAll('[data-testid="nulltreffer-eingrenzung"]');
    expect(marken, "nur die gefilterte Suche ist gekennzeichnet").toHaveLength(1);
    expect(marken[0]?.textContent).toContain(i18n.t("nulltreffer.feld.category"));
    expect(marken[0]?.textContent).toContain("Wartung");
  });

  it("F6 · ohne eigene Nulltreffer keine Fläche und kein Leersatz", () => {
    mount(Risk, { nulltreffer: [] });
    expect(container.querySelector('[data-testid="eigene-nulltreffer"]')).toBeNull();
  });
});

describe("R-1626 · Wissen, das nur bei dir liegt", () => {
  it("E1 · nur die Themen, deren einziger sichtbarer Träger die Person ist — mit Interview-Einstieg", () => {
    mount(MyTasks, {
      kos: [
        ko("k1", "Pumpen", "u1"),
        ko("k2", "Pumpen", "u1"),
        ko("k3", "Wartung", "u1"),
        ko("k4", "Wartung", "u2"),
        ko("k5", "Hydraulik", "u2"),
      ],
    });
    const flaeche = container.querySelector('[data-testid="meine-einzelquellen"]');
    expect(flaeche, "die Liste fehlt").not.toBeNull();
    const themen = Array.from(container.querySelectorAll('[data-testid="einzelquelle-thema"]'));
    expect(themen).toHaveLength(1);
    expect(themen[0]?.textContent).toContain("Pumpen");
    expect(flaeche?.textContent).not.toContain("Wartung");
    expect(flaeche?.textContent).not.toContain("Hydraulik");
    expect(
      container.querySelector('[data-testid="einzelquelle-einstieg"]')?.getAttribute("href"),
    ).toBe("/erfassen?weg=interview&thema=Pumpen");
  });

  it("E2 · trägt jemand anderes mit, erscheint nichts", () => {
    mount(MyTasks, { kos: [ko("k1", "Wartung", "u1"), ko("k2", "Wartung", "u2")] });
    expect(container.querySelector('[data-testid="meine-einzelquellen"]')).toBeNull();
  });

  it("E3 · die Regel: verschiedene Träger je Thema, wie der Bus-Faktor des Servers", () => {
    const objekte = [
      { category: "A", originalAuthor: "u1" },
      { category: "A", originalAuthor: "u1" },
      { category: "B", originalAuthor: "u1" },
      { category: "B", originalAuthor: "u2" },
      { category: "C", originalAuthor: "u2" },
    ];
    expect(meineEinzelquellenThemen(objekte, "u1")).toEqual([{ thema: "A", objekte: 2 }]);
    expect(meineEinzelquellenThemen(objekte, "u2")).toEqual([{ thema: "C", objekte: 1 }]);
    expect(meineEinzelquellenThemen(objekte, undefined)).toEqual([]);
  });
});

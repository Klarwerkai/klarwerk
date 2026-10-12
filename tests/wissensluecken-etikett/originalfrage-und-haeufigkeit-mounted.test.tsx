// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME gesamt-wissensluecken — DAS NEUTRALE ETIKETT UND DIE HÄUFIGKEIT AM LÜCKEN-BOARD.
// ================================================================================================
//
// R-0307 / R-1061: Wo die Herkunftssprache einer Wissenslücke nicht bekannt ist (Altbestand), steht
// statt einer Sprachangabe das immer wahre Etikett „Originalfrage". Gemessen am Design-Lead-Befund
// vom 26.08.: „für Altbestände schweigt die Anzeige weiterhin".
//
// R-0333 / R-0753: Dieselbe Frage ist EIN Eintrag mit Zähler („3× gefragt") — in „Meine Aufgaben"
// belegt `tests/app/gap-haeufigkeit-mounted.test.tsx`; hier die zweite Fläche, das Lücken-Board
// auf „Risiko & Lücken", wo Lücken nach Wichtigkeit geordnet und verteilt werden.
//
// Gemessen wird wie in `tests/ask/gap-sprachetikett-sichtbar.test.tsx` die Struktur, die über die
// Sichtbarkeit entscheidet (nicht im kürzenden Titel, `shrink-0`). Die optische Abnahme an einer
// laufenden Instanz bleibt offen.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Gap } from "../../apps/web/src/api/types";

const lage = vi.hoisted(() => ({ gaps: [] as unknown[] }));

const LANGER_ALTER_TITEL =
  "Are countersunk screws allowed in food contact zones and splash zones of filling lines?";

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useGaps: () => ok(lage.gaps),
    useKos: () => ok([]),
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
import { gapLocaleTag, gapTitelEtikett } from "../../apps/web/src/lib/gapLocaleTag";
import { MyTasks } from "../../apps/web/src/pages/MyTasks";
import { Risk } from "../../apps/web/src/pages/Risk";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function gap(teil: Partial<Gap> & Pick<Gap, "id">): Gap {
  return {
    question: LANGER_ALTER_TITEL,
    status: "offen",
    assignee: null,
    priority: "mittel",
    createdAt: "2026-08-15T00:00:00.000Z",
    ...teil,
  };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

function mount(seite: () => JSX.Element, gaps: Gap[]): void {
  lage.gaps = gaps;
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

const ORIGINALFRAGE = "Originalfrage";

/** Alle Elemente, deren eigener Text genau `text` ist. */
function elementeMitText(text: string): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("span, div")).filter(
    (e) => e.textContent?.trim() === text,
  );
}

describe("R-0307 / R-1061 · die Regel des Etiketts", () => {
  const t = i18n.getFixedT("de");

  it("VORBEDINGUNG: der Schlüssel trägt im Deutschen den Wortlaut „Originalfrage“", () => {
    expect(t("gap.originalfrage")).toBe(ORIGINALFRAGE);
  });

  it("ohne Sprachangabe → „Originalfrage“ statt Schweigen", () => {
    expect(gapTitelEtikett({}, "de", t)).toBe(ORIGINALFRAGE);
  });

  it("die bisherige Sprachregel bleibt unverändert (keine erfundene Sprache)", () => {
    // `gapLocaleTag` behauptet für den Altbestand weiterhin KEINE Sprache — das neutrale Etikett
    // ist ein eigener Wert, keine Sprachangabe.
    expect(gapLocaleTag(undefined, "de")).toBeNull();
    expect(gapTitelEtikett({ locale: "en" }, "de", t)).toBe("Englisch");
    expect(gapTitelEtikett({ locale: "de" }, "de", t)).toBeNull();
  });

  it("redigierte Lücke ohne Sprache → kein Etikett: über der Neutralbezeichnung wäre es falsch", () => {
    expect(gapTitelEtikett({ redacted: true }, "de", t)).toBeNull();
  });
});

describe("R-0307 / R-1061 · „Originalfrage“ an der Fläche", () => {
  it("Meine Aufgaben: die alte Lücke ohne Sprachangabe trägt das Etikett außerhalb des gekürzten Titels", () => {
    mount(MyTasks, [gap({ id: "alt" })]);
    expect(container.textContent, "KALIBRIERUNG: die Lücke steht in der Liste").toContain(
      "countersunk screws",
    );
    const [el] = elementeMitText(ORIGINALFRAGE);
    expect(el, "das neutrale Etikett fehlt").toBeDefined();
    expect(el?.closest(".line-clamp-2")).toBeNull();
    expect(el?.closest(".truncate")).toBeNull();
    expect(el?.className).toContain("shrink-0");
  });

  it("Risiko & Lücken: dasselbe Etikett an der zweiten Anzeigestelle, nicht im abgeschnittenen Titel", () => {
    mount(Risk, [gap({ id: "alt" })]);
    const el = container.querySelector<HTMLElement>('[data-testid="luecke-etikett"]');
    expect(el?.textContent?.trim()).toBe(ORIGINALFRAGE);
    expect(el?.closest(".truncate")).toBeNull();
    expect(el?.className).toContain("shrink-0");
  });

  it("Lücke MIT Sprachangabe: weiterhin die Sprache, nicht „Originalfrage“", () => {
    mount(Risk, [gap({ id: "en", locale: "en" })]);
    expect(container.querySelector('[data-testid="luecke-etikett"]')?.textContent?.trim()).toBe(
      "Englisch",
    );
    expect(elementeMitText(ORIGINALFRAGE)).toEqual([]);
  });

  it("redigierte Lücke ohne Sprachangabe: kein „Originalfrage“ über der Neutralbezeichnung", () => {
    mount(Risk, [gap({ id: "r", question: "", redacted: true })]);
    expect(container.textContent).toContain(i18n.t("risk.gapRedacted"));
    expect(container.querySelector('[data-testid="luecke-etikett"]')).toBeNull();
  });
});

describe("R-0333 / R-0753 · die Häufigkeit auf dem Lücken-Board", () => {
  const haeufigkeit = (): HTMLElement | null =>
    container.querySelector<HTMLElement>('[data-testid="luecke-haeufigkeit"]');

  it("dreimal gefragt → „3× gefragt“ an der Zeile, außerhalb des abgeschnittenen Titels", () => {
    mount(Risk, [gap({ id: "drei", askCount: 3 })]);
    expect(haeufigkeit()?.textContent?.trim()).toBe("3× gefragt");
    expect(haeufigkeit()?.closest(".truncate")).toBeNull();
    expect(haeufigkeit()?.className).toContain("shrink-0");
  });

  it("einmal gefragt → keine Zahl (eine 1 wäre Rauschen)", () => {
    mount(Risk, [gap({ id: "eins", askCount: 1 })]);
    expect(haeufigkeit()).toBeNull();
  });

  it("Altbestand ohne Zähler → keine erfundene Häufigkeit", () => {
    mount(Risk, [gap({ id: "alt" })]);
    expect(haeufigkeit()).toBeNull();
  });

  it("auch die redigierte Lücke trägt die Zahl — eine Häufigkeit ist kein Fragetext", () => {
    mount(Risk, [gap({ id: "r", question: "", redacted: true, askCount: 4 })]);
    expect(haeufigkeit()?.textContent?.trim()).toBe("4× gefragt");
  });
});

// @vitest-environment jsdom
// ================================================================================================
// JOB 1111 / D1 — D-032, SICHTBARE HÄLFTE: DIE LÜCKE SAGT, WIE OFT SIE GEFRAGT WURDE.
// ================================================================================================
//
// WARUM ES DIESEN ZÄHLER ÜBERHAUPT GIBT (D-032, „Ehrlichkeitszusatz, den ich empfehle"):
//
//   „ein Zähler am Eintrag (‚3× gefragt') — sonst geht das Häufigkeitssignal verloren, das die
//    Dubletten heute unfreiwillig tragen."
//
// Das ist der Kern: Fünf Dubletten sind zwar Unordnung, aber sie SAGEN etwas — diese Frage kam
// fünfmal. Wer sie zusammenführt, ohne die Zahl zu retten, macht die Liste ordentlicher und die
// Auskunft ärmer. Genau das verhindert diese Anzeige.
//
// ================================================================================================
// DIE OFFENE NAHT — EHRLICH VORNEWEG.
// ================================================================================================
//
// Dieser Wächter misst den RENDERER: was die Aufgabenliste aus einer Lücke macht, die `askCount`
// trägt. Er kann NICHT messen, dass der Server das Feld auch ausliefert — die Projektion an den
// Client sitzt in `services/ask/src/gap-visibility.ts` (`redactGapForViewer`), und diese Datei
// liegt NICHT in der Lease dieses Auftrags. Solange dort eine Zeile fehlt, bleibt der Zähler
// serverintern und diese Anzeige inert. Das steht so in der Rückgabe; hier wird nichts behauptet,
// was der Server nicht liefert.
//
// jsdom rechnet kein Layout: ob der Titel wirklich abgeschnitten wird, ist hier nicht messbar.
// Geprüft wird die Struktur, die darüber entscheidet — dieselbe Bauform, die das Sprach-Etikett
// nach seinem Befund bekommen hat (`tests/ask/gap-sprachetikett-sichtbar.test.tsx`).
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Gap } from "../../apps/web/src/api/types";

const LANGER_TITEL =
  "Are countersunk screws allowed in food contact zones and splash zones of filling lines?";

const lage = vi.hoisted(() => ({ gaps: [] as unknown[] }));

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
import { MyTasks } from "../../apps/web/src/pages/MyTasks";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function luecke(extra: Partial<Gap>): Gap {
  return {
    id: "g-1",
    question: LANGER_TITEL,
    status: "offen",
    assignee: null,
    priority: "hoch",
    createdAt: "2026-08-15T00:00:00.000Z",
    ...extra,
  };
}

function mount(gaps: Gap[]): void {
  lage.gaps = gaps;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: ["/aufgaben"] }, createElement(MyTasks)),
      ),
    );
  });
}

afterEach(() => {
  if (root) {
    act(() => root.unmount());
  }
  container?.remove();
  lage.gaps = [];
});

/** Das Element, das die Häufigkeit trägt. */
function haeufigkeit(): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-testid="gap-frequency"]');
}

describe("D-032 · die Häufigkeit steht an der Wissenslücke", () => {
  it("VORBEDINGUNG: die Oberfläche läuft auf Deutsch", () => {
    expect(i18n.language).toBe("de");
  });

  it("KALIBRIERUNG: die Lücke steht überhaupt in der Aufgabenliste", () => {
    // Ohne diesen Fall wäre jede Abwesenheitsaussage unten auch bei leerer Liste grün.
    mount([luecke({ askCount: 3 })]);
    expect(container.textContent).toContain("countersunk screws");
  });

  it("mehrfach gefragt: die Zahl steht sichtbar an der Zeile", () => {
    mount([luecke({ askCount: 3 })]);
    const el = haeufigkeit();
    expect(
      el,
      "die Häufigkeit wird nicht angezeigt — das Signal der Dubletten ist verloren",
    ).not.toBeNull();
    expect(el?.textContent?.replace(/\s+/g, "")).toContain("3");
  });

  it("einmal gefragt: KEINE Häufigkeit — eine 1 wäre Rauschen", () => {
    mount([luecke({ askCount: 1 })]);
    expect(haeufigkeit(), "auch die einfache Frage bekommt ein Etikett").toBeNull();
  });

  it("Altbestand ohne Zähler: es wird KEINE Häufigkeit erfunden", () => {
    // Lücken von vor dieser Scheibe tragen das Feld nicht. Eine gezeigte „1×" wäre eine Behauptung
    // über etwas, das nie gezählt wurde.
    mount([luecke({})]);
    expect(haeufigkeit()).toBeNull();
  });

  it("die Häufigkeit steht NICHT im abgeschnittenen Titel — sonst fällt sie als Erstes weg", () => {
    // Genau der Befund, den das Sprach-Etikett schon einmal gekostet hat.
    mount([luecke({ askCount: 7 })]);
    expect(haeufigkeit()?.closest(".truncate")).toBeNull();
  });

  it("die Häufigkeit schrumpft nicht mit: sie trägt shrink-0", () => {
    mount([luecke({ askCount: 7 })]);
    expect(haeufigkeit()?.className).toContain("shrink-0");
  });

  it("auch die REDIGIERTE Lücke trägt die Häufigkeit — eine Zahl ist kein Fragetext", () => {
    // Datensparsamkeit heißt nicht Sprachlosigkeit: wie oft gefragt wurde, verrät nichts über den
    // Inhalt. Wer nur die Neutralbezeichnung sieht, soll die Dringlichkeit trotzdem erkennen.
    mount([luecke({ question: "", redacted: true, askCount: 4 })]);
    expect(container.textContent).toContain(i18n.t("task.gapRedacted"));
    expect(haeufigkeit()?.textContent?.replace(/\s+/g, "")).toContain("4");
  });
});

// @vitest-environment jsdom
// ================================================================================================
// JOB 3064 · H5 — DER LEERZUSTAND VON „MEINE AUFGABEN" GEHÖRT DER LISTE, NICHT DER GRUPPE.
// ================================================================================================
//
// DER BEFUND (Ben, Runde 3, Korrekturpflicht 3): der Leerzustand stand INNERHALB der Schleife über
// die drei Dringlichkeitsgruppen (Kritisch/Heute/Später). Eine einzige kritische Aufgabe erzeugte
// daneben zwei „Nichts offen."-Zeilen mit zwei „Wie geht es weiter?"-Knöpfen — Bens Messung:
// `expected 2 to be +0`. Das ist keine Schönheitsfrage: „nichts offen" ist eine Aussage über den
// BESTAND, und sie war schlicht falsch, solange etwas offen war.
//
// Diese Datei misst beide Richtungen, denn nur eine von beiden allein wäre auch bei einem
// abgeschalteten Leerzustand grün:
//   · bei EINER Aufgabe darf KEIN Leerzustandsknopf stehen (der Fall, der rot war),
//   · bei KEINER Aufgabe muss GENAU EINER stehen (der Fall, der nicht verloren gehen darf).
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Gap } from "../../apps/web/src/api/types";

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
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte", stufe2: false }),
}));
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

function luecke(id: string): Gap {
  return {
    id,
    question: `Frage ${id}`,
    status: "offen",
    assignee: null,
    priority: "hoch",
    createdAt: "2026-08-15T00:00:00.000Z",
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

const knoepfe = (): number => container.querySelectorAll('[data-testid="task-wie-weiter"]').length;

describe("JOB 3064 · L · der Leerzustand hängt am Bestand, nicht an der Dringlichkeitsgruppe", () => {
  it("VORBEDINGUNG: die Oberfläche läuft auf Deutsch", () => {
    expect(i18n.language).toBe("de");
  });

  it("L1 · DER FANG: bei EINER Aufgabe steht KEIN Leerzustandsknopf", () => {
    mount([luecke("g-1")]);
    // Die Aufgabe steht wirklich da — sonst prüfte die Zeile darunter nur eine leere Liste.
    expect(container.textContent).toContain("Frage g-1");
    expect(knoepfe(), "leere Gruppen dürfen keinen eigenen Leerzustand erzeugen").toBe(0);
    expect(container.textContent).not.toContain(i18n.t("task.none"));
  });

  it("L2 · bei KEINER Aufgabe steht GENAU EIN Leerzustand mit GENAU EINEM Knopf", () => {
    mount([]);
    expect(container.textContent).toContain(i18n.t("task.none"));
    expect(knoepfe()).toBe(1);
  });

  it("L3 · der Knopf öffnet weiterhin die vorhandenen CTAs (der Weg ist nicht verloren)", () => {
    mount([]);
    const knopf = container.querySelector<HTMLButtonElement>('[data-testid="task-wie-weiter"]');
    expect(knopf).not.toBeNull();
    const inhalt = () =>
      container.querySelector<HTMLElement>('[data-testid="task-wie-weiter-inhalt"]');
    expect(inhalt()?.hasAttribute("hidden"), "vorher zu").toBe(true);
    act(() => {
      knopf?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(inhalt()?.hasAttribute("hidden"), "nach dem Klick offen").toBe(false);
    expect(inhalt()?.textContent ?? "").toContain(i18n.t("empty.cta.capture"));
  });

  it("L4 · leere Gruppen tragen auch keinen Kicker mehr — eine leere Gruppe ist keine Nachricht", () => {
    mount([luecke("g-1")]);
    // Die Lücke ist „später"; „Kritisch" und „Heute" sind leer und stehen deshalb nicht da.
    expect(container.textContent).toContain(i18n.t("task.later"));
    expect(container.textContent).not.toContain(i18n.t("task.critical"));
  });
});

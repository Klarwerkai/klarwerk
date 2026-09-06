// @vitest-environment jsdom
// ================================================================================================
// JOB 3101 · UX-04 — „NICHTS OFFEN." IST EINE AUSSAGE ÜBER DEN BESTAND, KEIN LADEZUSTAND.
// ================================================================================================
//
// WARUM DIESER FALL ZU UX-04 GEHÖRT: Solange der Filter in `useState("all")` lag, sah man den
// Leerzustand praktisch nie beim ersten Anstrich — die Seite wurde geöffnet, die Abfragen liefen an,
// und bis der Satz irgendwo hätte stehen können, waren die Daten meist da. Mit dem Deep-Link
// (`/aufgaben?art=conflict`) ändert sich genau das: die Adresse gilt SOFORT, die Liste ist im ersten
// Anstrich leer, und der Satz stünde da — mitten im Ladezustand. Er behauptete dann etwas über einen
// Bestand, den niemand gesehen hat.
//
// Die drei Phasen kommen aus dem vorhandenen gemeinsamen Vertrag (`lib/loadingState.ts`), nicht aus
// einer zweiten Lehre in dieser Seite.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lage = vi.hoisted(() => ({
  gaps: { data: undefined as unknown, isError: false },
  conflicts: { data: [] as unknown, isError: false },
}));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useGaps: () => ({ ...lage.gaps, isLoading: false, error: null }),
    useKos: () => ok([]),
    useAudit: () => ok([]),
    useConflicts: () => ({ ...lage.conflicts, isLoading: false, error: null }),
    useLifecyclePending: () => ok([]),
    useValidationBoard: () => ok([]),
    useDirectory: () => ok([]),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
// Der Leerzustand öffnet die `EmptyStateCtas`; die brauchen Rolle und Toast — wie in
// `tests/app/job3064-aufgaben-leerzustand-mounted.test.tsx`.
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

function mount(adresse = "/aufgaben"): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [adresse] }, createElement(MyTasks)),
      ),
    );
  });
}

const text = (): string => (container.textContent ?? "").replace(/\s+/g, " ");
const knoepfe = (): number => container.querySelectorAll('[data-testid="task-wie-weiter"]').length;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  lage.gaps = { data: [], isError: false };
  lage.conflicts = { data: [], isError: false };
});

afterEach(() => {
  if (root) {
    act(() => root.unmount());
  }
  container?.remove();
  root = undefined as unknown as ReturnType<typeof createRoot>;
});

describe("JOB 3101 · UX-04 · E · der Leerzustand hängt an geladenen Daten", () => {
  it("VORBEDINGUNG: die Oberfläche läuft auf Deutsch", () => {
    expect(i18n.language).toBe("de");
  });

  it("E1 · alle Quellen erfolgreich und leer ⇒ „Nichts offen.“ steht da (der Fall, der bleiben muss)", () => {
    mount();
    expect(text()).toContain(i18n.t("task.none"));
    expect(knoepfe()).toBe(1);
  });

  it("E2 · eine Quelle lädt noch ⇒ „Nichts offen.“ steht NICHT da, sondern der Ladezustand", () => {
    lage.gaps = { data: undefined, isError: false };
    mount();
    expect(text(), "keine Bestandsaussage ohne Bestand").not.toContain(i18n.t("task.none"));
    expect(knoepfe(), "und kein „Wie geht es weiter?“ auf eine ungeprüfte Behauptung").toBe(0);
    expect(text()).toContain(i18n.t("state.loading"));
  });

  it("E3 · eine Quelle im Fehler ⇒ „Nichts offen.“ steht NICHT da, sondern der Fehlerhinweis", () => {
    lage.conflicts = { data: undefined, isError: true };
    mount();
    expect(text()).not.toContain(i18n.t("task.none"));
    expect(knoepfe()).toBe(0);
    expect(text()).toContain(i18n.t("loadstate.error.title"));
    expect(text(), "ein Fehler ist kein Ladezustand").not.toContain(i18n.t("state.loading"));
  });

  it("E4 · DER DEEP-LINK-FALL: `?art=conflict` im Ladezustand zeigt auch den GEFILTERTEN Leersatz nicht", () => {
    lage.conflicts = { data: undefined, isError: false };
    mount("/aufgaben?art=conflict");
    expect(text()).not.toContain(i18n.t("task.noneFiltered"));
    expect(text()).not.toContain(i18n.t("task.none"));
    expect(text()).toContain(i18n.t("state.loading"));
  });

  it("E5 · geladen und gefiltert leer ⇒ der gefilterte Leersatz nennt den Filter als Grund", () => {
    mount("/aufgaben?art=conflict");
    expect(text()).toContain(i18n.t("task.noneFiltered"));
    expect(text(), "„Nichts offen.“ wäre hier die falsche Auskunft").not.toContain(
      i18n.t("task.none"),
    );
    expect(knoepfe()).toBe(0);
  });

  it("E7 · im Ladezustand trägt kein Segment eine Zahl — ein Zähler behauptet Vollständigkeit (§9)", () => {
    lage.gaps = { data: undefined, isError: false };
    mount();
    const alle = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").trim().startsWith(i18n.t("task.filter.all")),
    );
    expect(alle?.textContent ?? "", "keine erfundene 0 vor den Daten").not.toMatch(/\d/);
    // Die AUSWAHL ist dagegen eine Nutzerangabe und gilt schon: das Segment ist gedrückt.
    expect(alle?.getAttribute("aria-pressed")).toBe("true");
  });

  it("E8 · geladen ⇒ die Zähler stehen wieder als Zahl da (der Fall, der nicht verloren gehen darf)", () => {
    mount();
    const alle = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").trim().startsWith(i18n.t("task.filter.all")),
    );
    expect(alle?.textContent ?? "").toMatch(/0\s*$/);
  });

  it("E6 · Cache mit gescheiterter Auffrischung: die Daten bleiben die Aussage, kein Umschlagen", () => {
    // Vollständige Daten liegen vor, ein Refetch ist gescheitert (`isError` bei vorhandenen Daten).
    lage.conflicts = { data: [], isError: true };
    mount();
    expect(text(), "kein Rückfall in den Initialfehler").not.toContain(
      i18n.t("loadstate.error.title"),
    );
    expect(text()).toContain(i18n.t("task.none"));
  });
});

// @vitest-environment jsdom
// ================================================================================================
// JOB 3101 · UX-04 — DIE GEWÄHLTE AUFGABENART STEHT IN DER ADRESSZEILE.
// ================================================================================================
//
// Gemessen wird an der ECHTEN jsdom-History (BrowserRouter), nicht am MemoryRouter: Fall A2 fragt,
// ob ein Filterklick einen zusätzlichen Verlaufseintrag erzeugt, und diese Frage KANN ein
// Speicher-Router nicht beantworten. Fünf Filterklicks dürfen einen Reviewer nicht fünf Mal Zurück
// kosten, um zur vorigen Seite zu kommen — deshalb `replace` statt `push` (Auftrag Lieferung 2).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Conflict, Gap } from "../../apps/web/src/api/types";

const lage = vi.hoisted(() => ({ gaps: [] as unknown[], conflicts: [] as unknown[] }));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useGaps: () => ok(lage.gaps),
    useKos: () => ok([]),
    useAudit: () => ok([]),
    useConflicts: () => ok(lage.conflicts),
    useLifecyclePending: () => ok([]),
    useValidationBoard: () => ok([]),
    useDirectory: () => ok([]),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { BrowserRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { MyTasks } from "../../apps/web/src/pages/MyTasks";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function konflikt(n: number): Conflict {
  return {
    id: `c-${n}`,
    koA: `ko-a-${n}`,
    koB: `ko-b-${n}`,
    type: "truth",
    description: `KONFLIKT-${n}`,
    status: "offen",
    secondOpinion: null,
    decidedBy: null,
    decision: null,
    createdAt: "2026-08-15T00:00:00.000Z",
  };
}

function luecke(n: number): Gap {
  return {
    id: `g-${n}`,
    question: `LUECKE-${n}`,
    status: "offen",
    assignee: null,
    priority: "hoch",
    createdAt: "2026-08-15T00:00:00.000Z",
  };
}

async function mount(adresse: string): Promise<void> {
  lage.conflicts = [konflikt(1), konflikt(2)];
  lage.gaps = [luecke(1), luecke(2), luecke(3)];
  window.history.pushState({}, "", adresse);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(BrowserRouter, null, createElement(MyTasks)),
      ),
    );
    await flush();
  });
  await act(flush);
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

/** Das Segment mit dieser Beschriftung — gelesen aus dem gerenderten Knopf, nicht geraten. */
function segment(key: string): HTMLButtonElement {
  const label = i18n.t(`task.filter.${key}`);
  const knopf = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").trim().startsWith(label),
  );
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Segment „${label}" nicht gefunden. Sichtbar: ${text()}`);
  }
  return knopf;
}

async function klick(key: string): Promise<void> {
  const knopf = segment(key);
  await act(async () => {
    knopf.click();
    await flush();
  });
}

const zeilen = (): number => container.querySelectorAll('[data-testid="task-zeile"]').length;

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root.unmount();
      await flush();
    });
  }
  container?.remove();
  root = undefined as unknown as ReturnType<typeof createRoot>;
});

describe("JOB 3101 · UX-04 · A · die Aufgabenart steht in der Adresszeile", () => {
  it("VORBEDINGUNG: die Oberfläche läuft auf Deutsch", () => {
    expect(i18n.language).toBe("de");
  });

  it("A1 · `/aufgaben?art=conflict` zeigt beim ERSTEN Anstrich nur Konflikte, „Konflikte“ ist gedrückt", async () => {
    await mount("/aufgaben?art=conflict");
    expect(text()).toContain("KONFLIKT-1");
    expect(text()).toContain("KONFLIKT-2");
    expect(text(), "die Wissenslücken sind ausgefiltert").not.toContain("LUECKE-1");
    expect(zeilen()).toBe(2);
    expect(segment("conflict").getAttribute("aria-pressed")).toBe("true");
    expect(segment("all").getAttribute("aria-pressed")).toBe("false");
  });

  it("A2 · ein Filterklick schreibt `art=gap` und erzeugt KEINEN zusätzlichen Verlaufseintrag", async () => {
    await mount("/aufgaben");
    expect(zeilen(), "ungefiltert stehen alle fünf Aufgaben da").toBe(5);
    const laengeVorher = window.history.length;

    await klick("gap");

    expect(new URLSearchParams(window.location.search).get("art")).toBe("gap");
    expect(window.location.pathname).toBe("/aufgaben");
    expect(segment("gap").getAttribute("aria-pressed")).toBe("true");
    expect(zeilen()).toBe(3);
    expect(
      window.history.length,
      "replace statt push: der Filterklick kostet keinen Zurück-Schritt",
    ).toBe(laengeVorher);
  });

  it("A3 · `/aufgaben?art=erfunden` filtert NICHT — „Alle“ ist gewählt, alles bleibt sichtbar", async () => {
    await mount("/aufgaben?art=erfunden");
    expect(zeilen()).toBe(5);
    expect(text()).toContain("KONFLIKT-1");
    expect(text()).toContain("LUECKE-1");
    expect(segment("all").getAttribute("aria-pressed")).toBe("true");
    expect(segment("conflict").getAttribute("aria-pressed")).toBe("false");
  });

  it("A4 · ein fremder Parameter überlebt den Filterklick unverändert", async () => {
    await mount("/aufgaben?q=abc&art=gap");
    expect(zeilen()).toBe(3);

    await klick("conflict");

    const raus = new URLSearchParams(window.location.search);
    expect(raus.get("q"), "der fremde Parameter bleibt stehen").toBe("abc");
    expect(raus.get("art")).toBe("conflict");
    expect(zeilen()).toBe(2);
  });

  it("A5 · zurück auf „Alle“ entfernt den Parameter, statt ihn zu schreiben", async () => {
    await mount("/aufgaben?q=abc&art=conflict");
    await klick("all");
    const raus = new URLSearchParams(window.location.search);
    expect(raus.get("art"), "der neutrale Zustand steht nicht in der Adresszeile").toBeNull();
    expect(raus.get("q")).toBe("abc");
    expect(zeilen()).toBe(5);
  });
});

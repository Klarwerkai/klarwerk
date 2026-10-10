// @vitest-environment jsdom
// ================================================================================================
// R-1663 / R-2178 — DIE BEGRÜNDUNG MUSS AM BILDSCHIRM STEHEN, NICHT NUR IM DRAHT.
// ================================================================================================
//
// Die Quelle verlangt „Vorgeschlagene Ansprechpartner nach vorhandenen Wissensspuren" mit Gründen
// wie „Originalautor von 5 ähnlichen Wissensobjekten" oder „hat 3 relevante Objekte validiert" —
// und ausdrücklich NICHT „Das ist der beste Experte". Gemessen wird hier die gemountete Fläche an
// einer Lücke: erst nach ausdrücklichem Aufklappen gefragt, je Person die Spuren in Worten, keine
// Spur mit Zahl 0, alphabetisch nach Namen, und „Zuweisen" läuft über die bestehende Zuweisung.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnsprechpartnerAuskunft } from "../../apps/web/src/api/types";

const AUSKUNFT: AnsprechpartnerAuskunft = {
  vorschlaege: [
    {
      personId: "u-zora",
      spuren: {
        originalautor: 0,
        erfasst: 0,
        validiert: 3,
        pruefung: 0,
        verantwortlich: 0,
        aehnlicheLuecken: 0,
      },
      objekte: [{ id: "k1", title: "Pumpe entlüften" }],
    },
    {
      personId: "u-anna",
      spuren: {
        originalautor: 5,
        erfasst: 0,
        validiert: 0,
        pruefung: 0,
        verantwortlich: 0,
        aehnlicheLuecken: 1,
      },
      objekte: [{ id: "k2", title: "Druck prüfen" }],
    },
  ],
  grundlage: { objekte: 6, aehnlicheLuecken: 1 },
};

const angefragt = vi.fn();

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null });
  return {
    useGapAnsprechpartner: (id: string, enabled: boolean) => {
      if (enabled) {
        angefragt(id);
      }
      return enabled ? ok(AUSKUNFT) : { data: undefined, isPending: true, isError: false };
    },
    useDirectory: () =>
      ok([
        { id: "u-anna", name: "Anna Albers" },
        { id: "u-zora", name: "Zora Zander" },
      ]),
  };
});

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { LueckenAnsprechpartner } from "../../apps/web/src/components/LueckenAnsprechpartner";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const zugewiesen = vi.fn();

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(LueckenAnsprechpartner, {
          gapId: "luecke-1",
          onAssign: zugewiesen,
          assignPending: false,
        }),
      ),
    );
  });
}

function knopf(text: string): HTMLButtonElement {
  const treffer = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  );
  if (!treffer) {
    throw new Error(`Knopf „${text}" fehlt`);
  }
  return treffer;
}

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  angefragt.mockClear();
  zugewiesen.mockClear();
});

describe("Ansprechpartner an der Wissenslücke — begründet, ohne Rangfolge", () => {
  it("VORBEDINGUNG: die Oberfläche läuft auf Deutsch", () => {
    expect(i18n.language).toBe("de");
  });

  it("F1: zugeklappt wird nichts angefragt; erst das Aufklappen fragt", () => {
    mount();
    expect(angefragt).not.toHaveBeenCalled();
    act(() => knopf("Ansprechpartner vorschlagen").click());
    expect(angefragt).toHaveBeenCalledWith("luecke-1");
    const titel = "Passende Ansprechpartner nach vorhandenen Wissensspuren";
    expect(container.textContent).toContain(titel);
  });

  it("F2: je Person stehen die Spuren in Worten; leere Spuren erscheinen nicht", () => {
    mount();
    act(() => knopf("Ansprechpartner vorschlagen").click());
    const text = container.textContent ?? "";
    expect(text).toContain("Originalautor von 5 passenden Wissensobjekten");
    expect(text).toContain("war für 1 ähnliche, inzwischen geschlossene Wissenslücke zuständig");
    expect(text).toContain("hat 3 passende Objekte validiert");
    const leer = container.querySelectorAll('[data-testid="ansprechpartner-spur-erfasst"]');
    expect(leer).toHaveLength(0);
    expect(text).toContain("Pumpe entlüften");
    expect(text).not.toMatch(/beste[rn]? Expert/i);
  });

  it("F3: alphabetisch nach Namen, nicht in der Reihenfolge des Servers", () => {
    mount();
    act(() => knopf("Ansprechpartner vorschlagen").click());
    // Der Name hat eine eigene Kennung: `li.querySelector("div div")` wertet den Selektor gegen das
    // ganze Dokument aus und traf den umschliessenden Block samt Spuren (Prüflauf Nacharbeit 1).
    const namen = Array.from(
      container.querySelectorAll('[data-testid="ansprechpartner-name"]'),
      (el) => el.textContent?.trim(),
    );
    expect(namen).toEqual(["Anna Albers", "Zora Zander"]);
  });

  it("F4: „Zuweisen“ übergibt die Kennung an die bestehende Zuweisung", () => {
    mount();
    act(() => knopf("Ansprechpartner vorschlagen").click());
    const zeilen = container.querySelectorAll('[data-testid="ansprechpartner-vorschlag"]');
    const ersteZeile = zeilen[0] as HTMLElement;
    act(() => (ersteZeile.querySelector("button") as HTMLButtonElement).click());
    expect(zugewiesen).toHaveBeenCalledWith("u-anna");
  });
});

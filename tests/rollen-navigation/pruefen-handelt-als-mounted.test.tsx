// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME gesamt-rollen-navigation · R-0563 und R-0551 — IN WELCHER ROLLE HIER GEPRÜFT WIRD.
// ================================================================================================
//
// R-0563: „Die App sollte anzeigen, in welcher Rolle jemand gerade handelt, etwa ‚Du prüfst als
// Kontrolleur', damit Verantwortung sichtbar wird." Die belegte Antwort vom 05.07.2026 lautete: eine
// solche Anzeige existiert nicht. Die Rolle stand bis hierher nur im zugeklappten Konto-Menü.
//
// R-0551: „Wer sich die Ansicht einer anderen Rolle anschaut, sieht nur; es gilt immer die echte
// Rolle der laufenden Sitzung." Deshalb nennt der Prüfen-Kopf die SITZUNGSROLLE (`/auth/me`), nicht
// die Ansicht einer Rollenvorschau — am Server urteilt die Sitzung, und genau die trägt die
// Verantwortung.
//
// Gemessen am gemounteten `PruefenKopf` — dem einen Kopf der vier Prüfreiter (Validierung,
// Konflikte, Duplikate, Erneut prüfen). Die Abrufe sind Kulisse (leere Listen), die Sitzung ist der
// Gegenstand.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sitzung: { user: { id: string; role: string } | null } = { user: null };

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useValidationBoard: () => ok([]),
    useConflicts: () => ok([]),
    useDuplicates: () => ok([]),
    useLifecyclePending: () => ok([]),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: sitzung.user }),
}));
// Eine laufende Rollenvorschau: der Admin sieht die Fläche als Controller. Der Kopf darf daraus
// KEINE Rolle ableiten — er liest diesen Kontext nicht. Der Mock steht hier, damit ein späterer
// Umbau, der doch `useRole().role` liest, an P2 sichtbar rot wird.
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "controller", previewActive: true, isSessionRole: true }),
}));

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { PruefenKopf } from "../../apps/web/src/components/pruefen/PruefenKopf";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/validierung"] },
        createElement(PruefenKopf, { aktiv: "offen" }),
      ),
    );
  });
}

function zeile(): string | null {
  const el = container.querySelector('[data-testid="pruefen-handelt-als"]');
  return el ? (el.textContent ?? "").trim() : null;
}

beforeEach(async () => {
  sitzung.user = null;
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("R-0563 · der Prüfen-Kopf nennt die Rolle, in der gerade geprüft wird", () => {
  it("P1 · Controller-Sitzung: „Du prüfst als Controller“", () => {
    sitzung.user = { id: "u-c", role: "controller" };
    mount();
    expect(zeile()).toBe("Du prüfst als Controller");
  });

  it("P1b · jede Sitzungsrolle erscheint mit ihrem vollen Namen", () => {
    const erwartet: Record<string, string> = {
      viewer: "Du prüfst als Betrachter",
      experte: "Du prüfst als Experte",
      controller: "Du prüfst als Controller",
      admin: "Du prüfst als Administrator",
    };
    for (const [rolle, satz] of Object.entries(erwartet)) {
      sitzung.user = { id: `u-${rolle}`, role: rolle };
      mount();
      expect(zeile(), rolle).toBe(satz);
      act(() => root.unmount());
      container.remove();
    }
    // afterEach erwartet eine gemountete Fläche.
    mount();
  });

  it("P2 · R-0551: während einer Rollenvorschau gilt die echte Sitzungsrolle, nicht die Ansicht", () => {
    sitzung.user = { id: "u-a", role: "admin" };
    mount();
    expect(zeile()).toBe("Du prüfst als Administrator");
    expect(zeile()).not.toContain("Controller");
  });

  it("P3 · ohne bestätigte Sitzung steht keine Aussage über Verantwortung", () => {
    sitzung.user = null;
    mount();
    expect(zeile()).toBeNull();
  });

  it("P4 · Englisch und Niederländisch tragen denselben Satz in ihrer Sprache", async () => {
    sitzung.user = { id: "u-c", role: "controller" };
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    mount();
    expect(zeile()).toBe("You are reviewing as Controller");
    act(() => root.unmount());
    container.remove();
    await act(async () => {
      await i18n.changeLanguage("nl");
    });
    mount();
    expect(zeile()).toBe("Je controleert als Controller");
  });
});

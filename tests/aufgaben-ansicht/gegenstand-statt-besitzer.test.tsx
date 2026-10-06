// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · GESAMT-AUFGABENANSICHT · R-0962 — DIE FLÄCHE NENNT IHREN GEGENSTAND.
// ================================================================================================
//
// Anforderung (R-0962): Der Menüpunkt verspricht keine persönlichen Aufgaben mehr, denn nur einer
// von fünf Aufgabentypen ist personenbezogen. Ein Satz unter der Überschrift nennt, was hier landet:
// zurückgegebene Entwürfe, fällige Prüfungen, Konflikte, Wissenslücken und Re-Validierungen.
//
// Die Quelle (D-003, 13.08.) nennt den Punkt „Offene Aufgaben" statt „Meine Aufgaben".
// G1 misst die Namen in allen drei Sprachen (Menü, Hilfekapitel, Seitenhilfe), G2 den Inhalt des
// Satzes, G3 den Satz auf der gemounteten Seite — direkt unter der Überschrift, in jeder Sprache.
// Die Hausform (nur der Draht gemockt, echte Hooks, echter QueryClient) stammt aus
// `tests/demo-leerbestand/aufgaben-leerbestand.test.tsx`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { board: ok([]), settings: ok({ defaultNeededValidations: 3 }) },
      conflicts: { list: ok([]) },
      lifecycle: { pending: ok([]) },
      gaps: { list: ok([]), summary: ok({ open: 0, byPriority: {} }) },
      audit: { list: ok([]) },
      ko: { list: ok([]) },
      directory: { list: ok([{ id: "u1", name: "Pia", email: "p@x.de", role: "editor" }]) },
    },
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
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const SPRACHEN = ["de", "en", "nl"] as const;

/** Besitzanzeigende Wörter je Sprache — keines davon darf im Namen der Fläche stehen. */
const BESITZ: Record<(typeof SPRACHEN)[number], RegExp> = {
  de: /\b(mein|meine|dein|deine|ihre)\b/i,
  en: /\b(my|your)\b/i,
  nl: /\b(mijn|jouw|je)\b/i,
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    neu.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: ["/aufgaben"] }, createElement(MyTasks)),
      ),
    );
    await flush();
  });
  await act(flush);
}

function abbauen(): void {
  act(() => root?.unmount());
  container.remove();
  root = null;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  if (root) {
    abbauen();
  }
  await i18n.changeLanguage("de");
});

describe("R-0962 · die Aufgabenfläche nennt ihren Gegenstand statt ihres Besitzers", () => {
  it("G1 · Menüpunkt, Hilfekapitel und Seitenhilfe versprechen in DE/EN/NL keine persönlichen Aufgaben", () => {
    for (const sprache of SPRACHEN) {
      const t = i18n.getFixedT(sprache);
      for (const schluessel of ["nav.tasks", "help.tasks.title", "seitenhilfe.aufgaben.title"]) {
        const wert = t(schluessel);
        expect(wert, `${sprache}: ${schluessel} fehlt`).not.toBe(schluessel);
        expect(wert, `${sprache}: ${schluessel} = "${wert}"`).not.toMatch(BESITZ[sprache]);
      }
    }
    expect(i18n.getFixedT("de")("nav.tasks")).toBe("Offene Aufgaben");
  });

  it("G2 · der deutsche Satz nennt die fünf Arten, die hier landen", () => {
    const satz = i18n.getFixedT("de")("aufgaben.leitsatz");
    for (const art of [
      "zurückgegebene Entwürfe",
      "fällige Prüfungen",
      "Konflikte",
      "Wissenslücken",
      "Re-Validierungen",
    ]) {
      expect(satz).toContain(art);
    }
  });

  it("G3 · auf /aufgaben steht der Satz direkt unter der Überschrift — in allen drei Sprachen", async () => {
    for (const sprache of SPRACHEN) {
      await i18n.changeLanguage(sprache);
      await mount();
      const h1 = container.querySelector("h1");
      expect(h1?.textContent, sprache).toBe(i18n.t("nav.tasks"));
      const satz = h1?.nextElementSibling;
      expect(satz?.getAttribute("data-testid"), sprache).toBe("page-lead");
      const erwartet = i18n.t("aufgaben.leitsatz");
      expect(erwartet, `${sprache}: Schlüssel fehlt`).not.toBe("aufgaben.leitsatz");
      expect(satz?.textContent, sprache).toBe(erwartet);
      abbauen();
    }
  });
});

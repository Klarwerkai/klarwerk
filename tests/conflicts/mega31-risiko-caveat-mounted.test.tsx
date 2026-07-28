// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega31 BLOCK C1 (bens GELB-2) — DIE ACHTE FLÄCHE.
// ================================================================================================
//
// mega29 hat die leeren Konflikt- und Duplikat-Boards ehrlich gemacht. Die RISIKOANSICHT zeigt
// denselben Kennwert — „offene Konflikte" — ebenfalls als echte Null, und zwar ohne jede
// Einschränkung. Sie ist damit dieselbe falsche Entwarnung, nur an einer Stelle, an die niemand
// gedacht hat: die wörtliche Zahl stimmt, die Management-Inferenz „kein Risiko" ist unbelegt.
//
// Dieser gemountete Test fährt die echte Seite und belegt beide Richtungen:
//   • unvollständig geprüfter Bestand  → der Vorbehalt STEHT DA, obwohl die Kachel „0" zeigt,
//   • belegt vollständig geprüfter Bestand → er steht NICHT da (kein Dauerrauschen).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Die Zusammenfassung ist der einzige bewegliche Teil — sie entscheidet, ob der Vorbehalt spricht.
const summary = vi.hoisted(() => ({
  wert: { total: 39, incomplete: 12, unchecked: 3, noCoverage: 0 },
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      // KEIN offener Konflikt — die Kachel zeigt eine echte Null. Genau bens Fall.
      conflicts: { list: ok([]) },
      gaps: { list: ok([]), summary: ok({ total: 0, byPriority: {} }) },
      ko: { list: ok([]) },
      directory: { list: ok([]) },
      analytics: { busfactor: ok([]), expertise: ok([]) },
      aiCheck: { coverageSummary: vi.fn(async () => summary.wert) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Risk } from "../../apps/web/src/pages/Risk";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
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
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(MemoryRouter, { initialEntries: ["/risiko"] }, createElement(Risk)),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

beforeEach(async () => {
  summary.wert = { total: 39, incomplete: 12, unchecked: 3, noCoverage: 0 };
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("mega31 C1 · die Risikoansicht entwarnt nicht mehr still", () => {
  it("zeigt den Vorbehalt, obwohl die Kachel „offene Konflikte“ eine echte Null trägt", async () => {
    await mount();
    const text = container.textContent ?? "";

    // Die Null steht wirklich da — der Test prüft nicht an der Fläche vorbei.
    expect(text).toContain(i18n.t("risk.kpiOpenConflicts"));
    // Und daneben steht jetzt die Einschränkung, mit den Zahlen des Bestands.
    expect(text).toContain("Das heißt nicht");
    expect(text).toContain("39");
    expect(text).toContain("12");
  });

  it("A4: Altbestand ohne Abdeckung bekommt den EIGENEN Satz, nicht „gar kein Lauf“", async () => {
    summary.wert = { total: 39, incomplete: 0, unchecked: 0, noCoverage: 39 };
    await mount();
    const text = container.textContent ?? "";

    expect(text).toContain("keine Abdeckung nachgewiesen");
    // Der „gar keinen"-Satz gehört dem Objekt, über das WIRKLICH kein Lauf etwas sagt.
    expect(text).not.toContain("gar keinen");
  });

  it("ein belegt vollständig geprüfter Bestand bekommt keinen Warnsatz (kein Dauerrauschen)", async () => {
    summary.wert = { total: 39, incomplete: 0, unchecked: 0, noCoverage: 0 };
    await mount();
    const text = container.textContent ?? "";

    expect(text).toContain(i18n.t("risk.kpiOpenConflicts"));
    expect(text).not.toContain("Das heißt nicht");
    expect(text).not.toContain("keine Abdeckung nachgewiesen");
  });
});

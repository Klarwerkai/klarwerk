// @vitest-environment jsdom
// ================================================================================================
// R-0846 / L6 — DER PRODUKTIVE SCHLIESSWEG TRÄGT DEN OBJEKTBEZUG.
// ================================================================================================
//
// Ben, Nacharbeit 4: Die Seite „Risiko & Lücken" schloss eine Lücke mit `{ close: true }` — ohne
// Objektbezug. Jetzt wählt man beim Schliessen das Wissensobjekt, das die Lücke beantwortet, und
// genau diese Kennung geht an den Server. Ob sie gilt, entscheidet der Server (`AskService.closeGap`,
// Fälle in services/ask/src/service.test.ts und tests/datenintegritaet/datenintegritaet-pg F5);
// lehnt er ab, sagt die Zeile es, und die Lücke bleibt offen.
//
//   S1 — Die Auswahl nennt die Wissensobjekte; gewählt wird, gesendet wird (Lücke, Objekt).
//   S2 — Lehnt der Server ab, steht die Ablehnung an der Zeile.
//   S3 — Ohne Wissensobjekte lässt sich nicht schliessen (die Auswahl ist gesperrt).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lage = vi.hoisted(() => ({
  kos: [] as unknown[],
  schliessen: vi.fn(async (_id: string, _koId: string): Promise<unknown> => ({})),
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
      conflicts: { list: ok([]) },
      gaps: {
        list: ok([
          {
            id: "gap-1",
            question: "Wie wechsle ich das Ventil?",
            status: "offen",
            assignee: null,
            priority: "mittel",
            createdAt: "2026-10-01T08:00:00.000Z",
          },
        ]),
        summary: ok({ open: 1, byPriority: { hoch: 0, mittel: 1, niedrig: 0 } }),
        close: lage.schliessen,
        assign: ok({}),
        setPriority: ok({}),
        remove: ok(undefined),
      },
      ko: { list: vi.fn(async () => lage.kos) },
      directory: { list: ok([]) },
      analytics: { busfactor: ok([]), expertise: ok([]) },
      aiCheck: {
        coverageSummary: ok({ total: 0, incomplete: 0, unchecked: 0, noCoverage: 0 }),
      },
      lifecycle: { pending: ok([]) },
      management: {
        riskHorizon: ok({ generatedAt: "", seesAll: true, areas: [] }),
        profiles: ok({ categories: [], retirement: [] }),
      },
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

const VENTIL = {
  id: "ko-ventil",
  title: "Ventilwechsel an Anlage 1",
  category: "Anlage 1",
  status: "validiert",
  author: "pia",
  originalAuthor: "pia",
};

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

function auswahl(): HTMLSelectElement {
  const feld = container.querySelector<HTMLSelectElement>('[data-testid="luecke-schliessen"]');
  if (!feld) {
    throw new Error("Die Schliessauswahl der Lücke fehlt.");
  }
  return feld;
}

async function waehle(koId: string): Promise<void> {
  await act(async () => {
    const feld = auswahl();
    feld.value = koId;
    feld.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(flush);
}

beforeEach(async () => {
  lage.kos = [VENTIL];
  lage.schliessen.mockReset();
  lage.schliessen.mockImplementation(async () => ({}));
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("R-0846 / L6 · Schliessen einer Wissenslücke mit Objektbezug", () => {
  it("S1 · die Auswahl nennt das Wissensobjekt, und gesendet wird Lücke plus Objekt", async () => {
    await mount();
    const optionen = Array.from(auswahl().options, (o) => o.textContent);
    expect(optionen).toContain("Ventilwechsel an Anlage 1");
    expect(auswahl().disabled).toBe(false);

    await waehle("ko-ventil");
    expect(lage.schliessen).toHaveBeenCalledTimes(1);
    expect(lage.schliessen).toHaveBeenCalledWith("gap-1", "ko-ventil");
  });

  it("S2 · lehnt der Server den Bezug ab, steht die Ablehnung an der Zeile", async () => {
    lage.schliessen.mockImplementation(async () => {
      throw new Error("BAD_REQUEST");
    });
    await mount();
    await waehle("ko-ventil");
    const meldung = container.querySelector('[data-testid="luecke-zeile"] [role="alert"]');
    expect(meldung?.textContent).toBe(i18n.t("risk.closeFailed"));
  });

  it("S3 · ohne Wissensobjekte ist die Auswahl gesperrt — geschlossen wird nichts", async () => {
    lage.kos = [];
    await mount();
    expect(auswahl().disabled).toBe(true);
    expect(lage.schliessen).not.toHaveBeenCalled();
  });
});

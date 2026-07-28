// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega32 BLOCK F — DASS DER FAKTOR FEHLT, MUSS DORT STEHEN, WO DIE ZAHL STEHT.
// ================================================================================================
//
// Der reine Ableitungstest (health-conflict-factor.test.ts) belegt, dass der Konfliktfaktor aus der
// RECHNUNG fällt. Dieser Test belegt die zweite Hälfte von Pedis Entscheidung: dass er nicht
// STILLSCHWEIGEND fehlt. Er fährt die echte Analytics-Seite.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const summary = vi.hoisted(() => ({
  wert: { total: 39, incomplete: 12, unchecked: 3, noCoverage: 0 } as {
    total: number;
    incomplete: number;
    unchecked: number;
    noCoverage: number;
  } | null,
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
  const kos = [
    { id: "k1", title: "A", statement: "s", category: "Betrieb", status: "validiert", trust: 80 },
    { id: "k2", title: "B", statement: "s", category: "Betrieb", status: "offen", trust: 40 },
  ];
  return {
    endpoints: {
      ko: { list: ok(kos) },
      // ZWEI offene Konflikte — vor mega32 hätten sie den Score gedrückt, ohne dass irgendwo
      // stünde, dass die Erkennung sie gar nicht vollständig gesucht hat.
      conflicts: {
        list: ok([
          { id: "c1", koA: "k1", koB: "k2", type: "truth", description: "x", status: "offen" },
          { id: "c2", koA: "k1", koB: "k2", type: "truth", description: "y", status: "offen" },
        ]),
      },
      gaps: { list: ok([]), summary: ok({ total: 0, byPriority: {} }) },
      directory: { list: ok([]) },
      analytics: {
        overview: ok({ total: 2, byType: {}, byStatus: {}, byCategory: {} }),
        busfactor: ok([]),
        expertise: ok([]),
        impact: ok([]),
      },
      audit: { list: ok([]) },
      lifecycle: { pending: ok([]) },
      validation: { overview: ok([]) },
      aiCheck: {
        coverageSummary: vi.fn(async () => {
          if (!summary.wert) {
            throw new Error("keine Zusammenfassung");
          }
          return summary.wert;
        }),
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
import { Analytics } from "../../apps/web/src/pages/Analytics";

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
              createElement(
                MemoryRouter,
                { initialEntries: ["/analytics"] },
                createElement(Analytics),
              ),
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

// AUFTRAG-mega33 BLOCK B: die sichtbare Zahl ist der SCHLECHTESTE Fall, das Band entfällt, und der
// optimistische Rand steht daneben — benannt als das, was er ist.
//
// Der Bestand dieses Tests: 1 von 2 validiert ⇒ Basis 50, keine weiteren Abzüge. Mit vollem
// Konfliktabzug (20) also 30 sichtbar; optimistisch (2 gefundene Konflikte = 10) 40.
describe("mega33 B · der Score zeigt den schlechtesten Fall, und sagt es", () => {
  it("unbelegte Erkennung: groß steht die schlechtere Zahl, das Band entfällt", async () => {
    await mount();
    const text = container.textContent ?? "";

    // Die Punktzahl steht weiter da — sie verschwindet nicht, sie wird nur ehrlich.
    expect(text).toContain(i18n.t("health.title"));
    expect(container.querySelector('[data-testid="health-conflict-unproven"]')).not.toBeNull();
    // Der schlechteste Fall steht groß da …
    expect(text).toContain("30");
    // … und der optimistische Rand daneben, benannt.
    expect(text).toContain(i18n.t("health.conflictUnproven.title", { worst: 30, best: 40 }));
    // Kein Band, das „gut" behauptet, solange nichts belegt ist.
    expect(container.querySelector('[data-testid="health-band-unproven"]')).not.toBeNull();
    expect(text).not.toContain(i18n.t("health.explain.gut"));
    // Mit dem GRUND, nicht nur als Fußnote.
    expect(text).toContain("nicht durchgängig vollständig gelaufen");
    // Und die bekannten Konflikte bleiben als sicherer Mindestabzug benannt.
    expect(text).toContain(
      i18n.t("health.conflictUnproven.known", { count: 2, penalty: 10, max: 20 }),
    );
    expect(text).toContain(i18n.t("health.factor.openConflicts"));
  });

  it("gar keine Aussage über die Abdeckung ⇒ eigener Grund, nicht derselbe Satz", async () => {
    summary.wert = null; // Die Route antwortet nicht — „unbekannt" ist kein Beleg.
    await mount();
    const text = container.textContent ?? "";

    expect(container.querySelector('[data-testid="health-conflict-unproven"]')).not.toBeNull();
    expect(text).toContain("keine Aussage vor");
    expect(text).not.toContain("nicht durchgängig vollständig gelaufen");
  });

  it("belegt vollständige Erkennung: kein Zusatz, ein Band, keine Spanne", async () => {
    summary.wert = { total: 39, incomplete: 0, unchecked: 0, noCoverage: 0 };
    await mount();
    const text = container.textContent ?? "";

    expect(text).toContain(i18n.t("health.factor.openConflicts"));
    // Kein Dauerrauschen: wo nichts offen ist, steht auch nichts.
    expect(container.querySelector('[data-testid="health-conflict-unproven"]')).toBeNull();
    expect(container.querySelector('[data-testid="health-band-unproven"]')).toBeNull();
    // 50 − 10 (zwei gefundene Konflikte) = 40 ⇒ Band „mittel", belegt.
    expect(text).toContain(i18n.t("health.band.mittel"));
  });
});

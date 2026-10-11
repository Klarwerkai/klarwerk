// @vitest-environment jsdom
// ================================================================================================
// R-0734 — FEHLEN LIVE-SIGNALE, GILT DER WERT EHRLICH ALS UNBEKANNT STATT GESCHÄTZT.
// ================================================================================================
//
// Der Knowledge-Health-Wert (0–100) rechnet aus fünf Quellen: Wissensobjekte, Lücken, Konflikte,
// Revalidierungen, Bus-Faktor. Bis hierher rechnete die Seite `?? []` — fehlte eine Antwort, stand
// oben trotzdem eine Zahl (bei fehlenden Objekten: 0), die wie ein Befund aussah. Dieser Test fährt
// die echte Analytics-Seite; die Endpointgrenze ist die einzige Attrappe.
//
//   U1  eine Quelle antwortet nie (lädt)        → „unbekannt", keine Zahl, keine Faktoren
//   U2  eine Quelle scheitert ohne frühere Daten → „unbekannt", keine Zahl, keine Faktoren
//   U3  Gegenprobe: alle fünf antworten         → die Zahl und die Faktoren stehen da
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** ok = antwortet · haengt = antwortet nie (lädt) · fehler = scheitert ohne früheren Stand */
type Lage = "ok" | "haengt" | "fehler";
const lage = vi.hoisted(() => ({ busfactor: "ok" as Lage, pending: "ok" as Lage }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  function nach<T>(schalter: () => Lage, v: T) {
    return vi.fn((): Promise<T> => {
      const s = schalter();
      if (s === "haengt") {
        return new Promise<T>(() => undefined);
      }
      if (s === "fehler") {
        return Promise.reject(new Error("Pruefstand: Quelle nicht erreichbar"));
      }
      return Promise.resolve(v);
    });
  }
  const kos = [
    { id: "k1", title: "A", statement: "s", category: "Betrieb", status: "validiert", trust: 80 },
    { id: "k2", title: "B", statement: "s", category: "Betrieb", status: "offen", trust: 40 },
  ];
  const bus = [{ category: "Betrieb", koCount: 2, authorCount: 1, singleSource: true }];
  return {
    endpoints: {
      ko: { list: ok(kos) },
      conflicts: { list: ok([]) },
      gaps: { list: ok([]), summary: ok({ total: 0, byPriority: {} }) },
      directory: { list: ok([]) },
      analytics: {
        overview: ok({ total: 2, byType: {}, byStatus: {}, byCategory: {} }),
        busfactor: nach(() => lage.busfactor, bus),
        expertise: ok([]),
        impact: ok([]),
      },
      audit: { list: ok([]) },
      lifecycle: { pending: nach(() => lage.pending, []) },
      validation: { overview: ok([]) },
      aiCheck: {
        coverageSummary: ok({ total: 2, incomplete: 0, unchecked: 0, noCoverage: 0 }),
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

/**
 * Der Abschnitt des Health-Werts: vom Titel bis vor die nächste Sektion. Der Titel heißt seit
 * R-0908 „Zustand der Wissensbasis“ (`fachwort.gesundheit.titel`, vorher `health.title`).
 */
function healthAbschnitt(): Element {
  const titel = [...container.querySelectorAll("*")].find(
    (e) => e.children.length === 0 && e.textContent === i18n.t("fachwort.gesundheit.titel"),
  );
  // Titel → Kopfzeile → Abschnitt (s. Analytics.tsx: <div><div><SectionLabel/>…</div><Card/></div>).
  const abschnitt = titel?.parentElement?.parentElement;
  if (!abschnitt) {
    throw new Error("Knowledge-Health-Abschnitt fehlt auf der Seite");
  }
  return abschnitt;
}

/** Die fünf Faktoren aus `lib/knowledgeHealth.ts` — welche davon auf der Fläche stehen. */
const FAKTOR = ["validatedRatio", "staleRatio", "singleSourceShare", "openGaps", "openConflicts"];

function faktorZeilen(abschnitt: Element): string[] {
  const text = abschnitt.textContent ?? "";
  const labels = FAKTOR.map((k) => i18n.t(`health.factor.${k}`));
  return labels.filter((label) => text.includes(label));
}

beforeEach(async () => {
  lage.busfactor = "ok";
  lage.pending = "ok";
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("R-0734 · ohne Live-Signale ist der Health-Wert unbekannt, nicht geschätzt", () => {
  it("U1 · der Bus-Faktor antwortet nie: „unbekannt“, keine Zahl, keine Faktoren", async () => {
    lage.busfactor = "haengt";
    await mount();
    const abschnitt = healthAbschnitt();

    expect(abschnitt.querySelector('[data-testid="health-unknown"]')).not.toBeNull();
    expect(abschnitt.textContent).toContain(i18n.t("health.unknown"));
    expect(abschnitt.textContent).toContain(i18n.t("health.unknownExplain"));
    expect(abschnitt.textContent, "keine Punktzahl auf 100").not.toContain("/100");
    expect(abschnitt.textContent ?? "", "keine geschätzte Zahl").not.toMatch(/\d/);
    expect(faktorZeilen(abschnitt)).toEqual([]);
    expect(abschnitt.querySelector('[data-testid="health-band-unproven"]')).toBeNull();
  });

  it("U2 · die Revalidierungen scheitern ohne früheren Stand: ebenfalls „unbekannt“", async () => {
    lage.pending = "fehler";
    await mount();
    const abschnitt = healthAbschnitt();

    expect(abschnitt.querySelector('[data-testid="health-unknown"]')).not.toBeNull();
    expect(abschnitt.textContent, "keine Punktzahl auf 100").not.toContain("/100");
    expect(abschnitt.textContent ?? "").not.toMatch(/\d/);
    expect(faktorZeilen(abschnitt)).toEqual([]);
  });

  it("U3 · Gegenprobe: alle fünf Quellen antworten — die Zahl und die Faktoren stehen da", async () => {
    await mount();
    const abschnitt = healthAbschnitt();

    expect(abschnitt.querySelector('[data-testid="health-unknown"]')).toBeNull();
    expect(abschnitt.textContent).toContain("/100");
    // 1 von 2 validiert ⇒ Basis 50; eine von einer Kategorie Einzelquelle ⇒ 100 % × 0,3 = 30 Abzug.
    expect(abschnitt.textContent).toContain("20");
    expect(faktorZeilen(abschnitt)).toHaveLength(5);
  });
});

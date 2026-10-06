// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · GESAMT-AUFGABENANSICHT · R-0961 — DIREKTER ABSPRUNG ZUM OBJEKT.
// ================================================================================================
//
// Bens Befund (Runde 1): Konflikte, Re-Validierungen und Wissenslücken führten aus der Aufgabenliste
// nur auf `/konflikte`, `/lebenszyklus` und `/risiko` — ohne Kennung. Dort stand der ERSTE Fall der
// Warteschlange, nicht der angeklickte. Diese Datei misst beide Hälften am echten Produktpfad:
//   Z1  die Zeilen der Aufgabenliste tragen die Kennung ihres Falls in der Adresse;
//   Z2  `/konflikte?fall=…` zeigt genau diesen Konflikt, und Blättern hebt die Vorwahl auf;
//   Z3  `/lebenszyklus?fall=…` wählt genau dieses Objekt in der Warteschlange;
//   Z4  `/risiko?fall=…` markiert genau diese Lücke;
//   Z5  ein unbekannter Fall fällt auf das gewohnte Verhalten zurück (kein Fehler, keine Leere).
// Nur der Draht ist gemockt; Router, Hooks und QueryClient sind echt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

const KO = (id: string, titel: string) => ({
  id,
  title: titel,
  statement: `${titel} gilt.`,
  status: "validiert",
  trust: 80,
  author: "u1",
  originalAuthor: "u1",
  conditions: [],
  measures: [],
  sources: [],
  tags: [],
  category: "Konstruktion",
  createdAt: "2026-08-01T06:00:00.000Z",
});

const KONFLIKT = (id: string, koA: string, koB: string, beschreibung: string) => ({
  id,
  koA,
  koB,
  type: "truth",
  description: beschreibung,
  status: "offen",
  secondOpinion: null,
  decidedBy: null,
  decision: null,
  origin: "auto",
  detector: { trigger: "background", method: "model", confidence: 0.9, rationale: "Grund" },
  createdAt: "2026-08-01T06:00:00.000Z",
});

const LUECKE = (id: string, frage: string) => ({
  id,
  question: frage,
  status: "offen",
  assignee: null,
  priority: "mittel",
  createdAt: "2026-08-01T06:00:00.000Z",
});

const daten = vi.hoisted(() => ({
  kos: [] as unknown[],
  konflikte: [] as unknown[],
  faellig: [] as string[],
  luecken: [] as unknown[],
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: {
        board: ok([]),
        overview: ok([]),
        settings: ok({ defaultNeededValidations: 3 }),
      },
      conflicts: {
        list: vi.fn(async () => daten.konflikte),
        escalate: ok({}),
        secondOpinion: ok({}),
        dismiss: ok({}),
      },
      duplicates: { list: ok([]) },
      lifecycle: { pending: vi.fn(async () => daten.faellig), assetChanged: ok([]) },
      gaps: {
        list: vi.fn(async () => daten.luecken),
        summary: ok({ open: 0, total: 0, byPriority: {} }),
      },
      audit: { list: ok([]) },
      ko: { list: vi.fn(async () => daten.kos), act: ok({}) },
      directory: { list: ok([{ id: "u1", name: "Pia", email: "p@x.de", role: "admin" }]) },
      learningPaths: { byRole: ok(null), progress: ok([]), complete: ok({}) },
      analytics: { busfactor: ok([]), expertise: ok([]) },
      aiCheck: {
        coverageSummary: ok({ total: 0, incomplete: 0, unchecked: 0, noCoverage: 0 }),
      },
      reasoner: {
        status: ok({ active: false, mode: "off", reachable: "unknown", tasks: {} }),
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
import { FALL_PARAM, fallHref, leseFall } from "../../apps/web/src/lib/fallAbsprung";
import { Conflicts } from "../../apps/web/src/pages/Conflicts";
import { Lifecycle } from "../../apps/web/src/pages/Lifecycle";
import { MyTasks } from "../../apps/web/src/pages/MyTasks";
import { Risk } from "../../apps/web/src/pages/Risk";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const gerollt: Element[] = [];
Element.prototype.scrollIntoView = function (this: Element) {
  gerollt.push(this);
};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(seite: () => JSX.Element, pfad: string): Promise<void> {
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
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(MemoryRouter, { initialEntries: [pfad] }, createElement(seite)),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

const text = (): string => (container.textContent ?? "").replace(/\s+/g, " ");

beforeEach(async () => {
  await i18n.changeLanguage("de");
  gerollt.length = 0;
  daten.kos = [
    KO("ko-a", "Titel A"),
    KO("ko-b", "Titel B"),
    KO("ko-c", "Titel C"),
    KO("ko-d", "Titel D"),
  ];
  daten.konflikte = [
    KONFLIKT("c-1", "ko-a", "ko-b", "Erster Widerspruch"),
    KONFLIKT("c-2", "ko-c", "ko-d", "Zweiter Widerspruch"),
  ];
  daten.faellig = ["ko-a", "ko-c"];
  daten.luecken = [LUECKE("g-1", "Erste offene Frage"), LUECKE("g-2", "Zweite offene Frage")];
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
});

describe("R-0961 · direkter Absprung aus der Aufgabenliste zum Fall", () => {
  it("Z0 · die Adressform: eine Kennung hin, dieselbe Kennung zurück", () => {
    const href = fallHref("/konflikte", "c 2/x");
    expect(href).toBe(`/konflikte?${FALL_PARAM}=c%202%2Fx`);
    expect(leseFall(new URL(href, "http://x").searchParams)).toBe("c 2/x");
    expect(leseFall(new URLSearchParams(""))).toBeNull();
    expect(leseFall(new URLSearchParams(`${FALL_PARAM}=%20`))).toBeNull();
  });

  it("Z1 · jede Konflikt-, Re-Validierungs- und Lückenzeile trägt die Kennung ihres Falls", async () => {
    await mount(MyTasks, "/aufgaben");
    const ziele = [...container.querySelectorAll('[data-testid="task-zeile"] a')].map((a) =>
      a.getAttribute("href"),
    );
    expect(ziele).toEqual(
      expect.arrayContaining([
        "/konflikte?fall=c-1",
        "/konflikte?fall=c-2",
        "/lebenszyklus?fall=ko-a",
        "/lebenszyklus?fall=ko-c",
        "/risiko?fall=g-1",
        "/risiko?fall=g-2",
      ]),
    );
    // Keine Zeile führt mehr auf die nackte Fläche.
    for (const nackt of ["/konflikte", "/lebenszyklus", "/risiko"]) {
      expect(ziele, nackt).not.toContain(nackt);
    }
  });

  it("Z2 · /konflikte?fall=c-2 zeigt genau diesen Konflikt — Blättern hebt die Vorwahl auf", async () => {
    await mount(Conflicts, "/konflikte?fall=c-2");
    expect(text()).toContain("Titel C");
    expect(text()).not.toContain("Titel A");
    // Die Position „k von n" folgt der Vorwahl, nicht der Startstelle 0.
    const zurueck = container.querySelector<HTMLButtonElement>('[data-testid="pruefen-zurueck"]');
    const vor = container.querySelector<HTMLButtonElement>('[data-testid="pruefen-vor"]');
    const amAnfang = zurueck?.disabled === true;
    const knopf = amAnfang ? vor : zurueck;
    expect(knopf).not.toBeNull();
    await act(async () => {
      knopf?.click();
      await flush();
    });
    expect(text()).toContain("Titel A");
    expect(text()).not.toContain("Titel C");
  });

  it("Z3 · /lebenszyklus?fall=ko-c wählt genau dieses Objekt in der Warteschlange", async () => {
    await mount(Lifecycle, "/lebenszyklus?fall=ko-c");
    const aktiv = container.querySelector(
      '[data-testid="pruefen-warteschlange-eintrag"][aria-current="true"]',
    );
    expect(aktiv?.textContent).toBe("Titel C");
  });

  it("Z4 · /risiko?fall=g-2 markiert genau diese Lücke und holt sie in Sicht", async () => {
    await mount(Risk, "/risiko?fall=g-2");
    const markiert = [
      ...container.querySelectorAll('[data-testid="luecke-zeile"][aria-current="true"]'),
    ];
    expect(markiert).toHaveLength(1);
    expect(markiert[0]?.textContent).toContain("Zweite offene Frage");
    expect(gerollt).toContain(markiert[0]);
  });

  it("Z5 · ein unbekannter Fall ist kein Fehler: jede Fläche bleibt bei ihrem gewohnten Verhalten", async () => {
    await mount(Lifecycle, "/lebenszyklus?fall=gibt-es-nicht");
    expect(
      container.querySelector('[data-testid="pruefen-warteschlange-eintrag"][aria-current="true"]')
        ?.textContent,
    ).toBe("Titel A");
    act(() => root?.unmount());
    container.remove();

    await mount(Risk, "/risiko?fall=gibt-es-nicht");
    expect(container.querySelectorAll('[data-testid="luecke-zeile"]')).toHaveLength(2);
    expect(container.querySelector('[data-testid="luecke-zeile"][aria-current="true"]')).toBeNull();
    act(() => root?.unmount());
    container.remove();

    await mount(Conflicts, "/konflikte?fall=gibt-es-nicht");
    expect(container.querySelector('[data-testid="pruefen-flaeche"]')).not.toBeNull();
    expect(text()).toMatch(/Titel [AC]/);
  });
});

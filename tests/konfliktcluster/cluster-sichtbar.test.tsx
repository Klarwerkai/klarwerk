// @vitest-environment jsdom
// ================================================================================================
// R-1637 · KONFLIKT-CLUSTER-ERKENNUNG — zusammenhängende Widersprüche erscheinen als Gruppe.
// ================================================================================================
//
// Originalwortlaut (Roadmap §4.3): „Wenn zu einem Thema mehrere widersprüchliche Wissensobjekte
// existieren, zeigt KLARWERK das als Cluster statt als einzelnen Konflikt."
//
// C1–C3 messen die reine Ableitung (`lib/konfliktCluster.ts`), C4–C7 die echte, gemountete
// Konfliktseite. Gerüst und Mock-Bauform folgen `tests/conflict-description/beschreibung-sichtbar
// .test.tsx`, der dieselbe Seite fährt; ohne Playwright-Import (Browsergruppe aus dem Importgraphen).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const daten = vi.hoisted(() => ({ konflikte: [] as unknown[] }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "controller" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: () => T) => vi.fn(async () => v());
  return {
    endpoints: {
      conflicts: { list: ok(() => daten.konflikte) },
      duplicates: { list: ok(() => []), settings: ok(() => ({ minConfidence: 0.5 })) },
      validation: { board: ok(() => []), overview: ok(() => []) },
      lifecycle: { pending: ok(() => []) },
      ko: { list: ok(() => KOS) },
      gaps: { list: ok(() => []), summary: ok(() => ({ total: 0, byPriority: {} })) },
      directory: { list: ok(() => []) },
      analytics: { busfactor: ok(() => []), expertise: ok(() => []) },
      aiCheck: {
        coverageSummary: ok(() => ({ total: 2, incomplete: 0, unchecked: 0, noCoverage: 0 })),
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
import { clusterReihenfolge, konfliktCluster } from "../../apps/web/src/lib/konfliktCluster";
import { Conflicts } from "../../apps/web/src/pages/Conflicts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const ko = (id: string, titel: string) => ({
  id,
  title: titel,
  statement: `Aussage ${id}`,
  status: "validiert",
  category: "Technik",
  trust: 80,
  conditions: [],
  measures: [],
  sources: [],
  tags: [],
  createdAt: "2026-08-01T06:00:00.000Z",
  updatedAt: "2026-08-01T06:00:00.000Z",
});

const KOS = [
  ko("ko-a", "Frist 14 Tage"),
  ko("ko-b", "Frist 30 Tage"),
  ko("ko-c", "Frist 21 Tage"),
  ko("ko-x", "Ofen 180 Grad"),
  ko("ko-y", "Ofen 200 Grad"),
];

const konflikt = (id: string, koA: string, koB: string, zeit: string) => ({
  id,
  koA,
  koB,
  type: "truth",
  description: `Widerspruch ${id}`,
  status: "offen",
  secondOpinion: null,
  decidedBy: null,
  decision: null,
  createdAt: zeit,
});

// Neueste zuerst: c-xy ist der neueste Einzelfall und steht deshalb vor dem Cluster; der
// Cluster-Teil c-bc ist der älteste und stünde ohne Cluster-Reihenfolge ganz hinten.
const FRIST_AB = konflikt("c-ab", "ko-a", "ko-b", "2026-08-03T06:00:00.000Z");
const OFEN_XY = konflikt("c-xy", "ko-x", "ko-y", "2026-08-04T06:00:00.000Z");
const FRIST_CA = konflikt("c-ca", "ko-c", "ko-a", "2026-08-02T06:00:00.000Z");
const FRIST_BC = konflikt("c-bc", "ko-b", "ko-c", "2026-08-01T06:00:00.000Z");

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
                { initialEntries: ["/konflikte"] },
                createElement(Conflicts),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

const flaeche = (): HTMLElement => {
  const el = container.querySelector<HTMLElement>('[data-testid="pruefen-flaeche"]');
  if (!el) {
    throw new Error("Konfliktfläche nicht gefunden — die Seite hat gar nicht gerendert.");
  }
  return el;
};
const clusterKasten = (): HTMLElement | null =>
  flaeche().querySelector<HTMLElement>('[data-testid="konflikt-cluster"]');
const mitglieder = (): HTMLButtonElement[] => [
  ...flaeche().querySelectorAll<HTMLButtonElement>('[data-testid="konflikt-cluster-mitglied"]'),
];
const lauf = (): string =>
  flaeche().querySelector('[data-testid="pruefen-pille-lauf"]')?.textContent ?? "";
const beschreibung = (): string =>
  flaeche().querySelector('[data-testid="konflikt-beschreibung"]')?.textContent ?? "";

async function klick(el: HTMLElement | null | undefined): Promise<void> {
  if (!el) {
    throw new Error("Bedienelement fehlt.");
  }
  await act(async () => {
    el.click();
  });
  await act(flush);
}

beforeEach(async () => {
  daten.konflikte = [];
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  }
});

// ------------------------------------------------------------------------------------------------

describe("R-1637 · C1–C3 — die Ableitung", () => {
  it("C1: über gemeinsame Beiträge verbundene Widersprüche bilden EINEN Cluster", () => {
    const zuordnung = konfliktCluster([FRIST_AB, OFEN_XY, FRIST_CA, FRIST_BC]);
    const gruppe = zuordnung.get("c-ab");
    expect(gruppe?.konflikte).toEqual(["c-ab", "c-ca", "c-bc"]);
    expect(gruppe?.beitraege).toEqual(["ko-a", "ko-b", "ko-c"]);
    expect(zuordnung.get("c-ca")).toBe(gruppe);
    expect(zuordnung.get("c-bc")).toBe(gruppe);
    // Der unverbundene Einzelfall gehört zu keinem Cluster.
    expect(zuordnung.has("c-xy")).toBe(false);
  });

  it("C2: ein Paar bleibt ein Einzelkonflikt — auch mit zwei Konfliktarten zwischen denselben zwei Beiträgen", () => {
    const zweiterTyp = { ...FRIST_AB, id: "c-ab-2", type: "context" };
    expect(konfliktCluster([FRIST_AB, zweiterTyp]).size).toBe(0);
    expect(konfliktCluster([FRIST_AB]).size).toBe(0);
    expect(konfliktCluster([]).size).toBe(0);
  });

  it("C3: die Reihenfolge stellt Cluster-Mitglieder nebeneinander und lässt alles andere stehen", () => {
    const ids = (liste: (typeof FRIST_AB)[]): string[] =>
      clusterReihenfolge(liste).map((k) => k.id);
    expect(ids([OFEN_XY, FRIST_AB, FRIST_CA, FRIST_BC])).toEqual(["c-xy", "c-ab", "c-ca", "c-bc"]);
    // Mit einem Einzelfall MITTEN im Cluster rückt der Cluster an die Stelle seines ersten Mitglieds.
    expect(ids([FRIST_AB, OFEN_XY, FRIST_CA, FRIST_BC])).toEqual(["c-ab", "c-ca", "c-bc", "c-xy"]);
    // Ohne Cluster: unverändert.
    const ohne = [OFEN_XY, FRIST_AB];
    expect(clusterReihenfolge(ohne)).toEqual(ohne);
  });
});

describe("R-1637 · C4–C7 — die Konfliktseite zeigt den Cluster", () => {
  it("C4: ein Konflikt im Cluster trägt die Cluster-Auskunft mit Anzahl, Beiträgen und Mitgliedern", async () => {
    daten.konflikte = [FRIST_AB, OFEN_XY, FRIST_CA, FRIST_BC];
    await mount();
    // Neueste zuerst: der Einzelfall steht vorn und zeigt KEINE Cluster-Auskunft.
    expect(lauf()).toBe("1 von 4");
    expect(beschreibung()).toBe("Widerspruch c-xy");
    expect(clusterKasten()).toBeNull();

    await klick(flaeche().querySelector<HTMLElement>('[data-testid="pruefen-vor"]'));
    expect(lauf()).toBe("2 von 4");
    expect(beschreibung()).toBe("Widerspruch c-ab");
    const kasten = clusterKasten();
    const titel = "Konflikt-Cluster: 3 Widersprüche zwischen 3 Beiträgen";
    expect(kasten?.textContent).toContain(titel);
    const beitraege = kasten?.querySelector('[data-testid="konflikt-cluster-beitraege"]');
    expect(beitraege?.textContent).toBe("Frist 14 Tage · Frist 30 Tage · Frist 21 Tage");
    expect(mitglieder().map((b) => b.textContent)).toEqual([
      "Frist 14 Tage ↔ Frist 30 Tage",
      "Frist 21 Tage ↔ Frist 14 Tage",
      "Frist 30 Tage ↔ Frist 21 Tage",
    ]);
    // Der angezeigte Widerspruch ist als aktuell markiert; der Einzelfall ist kein Mitglied.
    expect(mitglieder().map((b) => b.getAttribute("aria-current"))).toEqual(["true", null, null]);
    expect(kasten?.textContent).not.toContain("Ofen");
  });

  it("C5: die Cluster-Mitglieder stehen beim Blättern nebeneinander", async () => {
    daten.konflikte = [FRIST_AB, OFEN_XY, FRIST_CA, FRIST_BC];
    await mount();
    const folge: string[] = [beschreibung()];
    for (let i = 0; i < 3; i++) {
      await klick(flaeche().querySelector<HTMLElement>('[data-testid="pruefen-vor"]'));
      folge.push(beschreibung());
    }
    expect(folge).toEqual([
      "Widerspruch c-xy",
      "Widerspruch c-ab",
      "Widerspruch c-ca",
      "Widerspruch c-bc",
    ]);
  });

  it("C6: ein Mitglied anklicken springt zu genau diesem Widerspruch", async () => {
    daten.konflikte = [FRIST_AB, OFEN_XY, FRIST_CA, FRIST_BC];
    await mount();
    await klick(flaeche().querySelector<HTMLElement>('[data-testid="pruefen-vor"]'));
    await klick(mitglieder()[2]);
    expect(lauf()).toBe("4 von 4");
    expect(beschreibung()).toBe("Widerspruch c-bc");
    expect(mitglieder().map((b) => b.getAttribute("aria-current"))).toEqual([null, null, "true"]);
  });

  it("C7: ohne Cluster bleibt die Fläche ohne Cluster-Auskunft — auch in EN beschriftet der Cluster sich übersetzt", async () => {
    daten.konflikte = [FRIST_AB, OFEN_XY];
    await mount();
    expect(clusterKasten()).toBeNull();
    await klick(flaeche().querySelector<HTMLElement>('[data-testid="pruefen-vor"]'));
    expect(clusterKasten()).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
    daten.konflikte = [FRIST_AB, FRIST_CA, FRIST_BC];
    await i18n.changeLanguage("en");
    await mount();
    const titel = "Conflict cluster: 3 contradictions between 3 items";
    expect(clusterKasten()?.textContent).toContain(titel);
  });
});

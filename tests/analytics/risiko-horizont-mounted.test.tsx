// @vitest-environment jsdom
// ================================================================================================
// R-1639 · R-2183 · R-0751 (Nacharbeit 3) — MEIN BEREICH UND DIE PFLEGE SEINER EINGÄNGE, GEMOUNTET.
// ================================================================================================
//
// Die Ableitung belegen services/management/src/horizon.test.ts (H1–H5), die Türen
// services/app/src/management-routes.test.ts. Dieser Test rendert die beiden Flächen der
// Risiko-Seite mit einer Antwort in Serverform; die Endpointgrenze ist die einzige Attrappe.
//   R1  Bereich mit Verantwortlichem, Bus-Faktor 1, Kritikalität, Trägern mit Frist und Arbeitsvorrat;
//       der 24-Monats-Filter blendet den 36-Monats-Träger aus
//   R2  ohne eigenen Bereich: der ehrliche Leersatz, keine Hauszahlen
//   P1  Pflege: Stufen/Verantwortung speichern und einen Ruhestandshorizont setzen — genau diese Werte
//       gehen an den Server
// Die Namen sind erfundene Testpersonen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  areas: [] as unknown[],
  seesAll: false,
  // R3 (Nacharbeit 5): die vollständige Antwort aus der ECHTEN Ableitung `riskHorizon`.
  antwort: null as unknown,
  setCategoryProfile: vi.fn(async (body: unknown) => body),
  setRetirement: vi.fn(async (_userId: string, _h: unknown) => ({ entry: null })),
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    management: {
      riskHorizon: vi.fn(async () =>
        d.antwort !== null
          ? d.antwort
          : { generatedAt: "2026-10-04T00:00:00.000Z", seesAll: d.seesAll, areas: d.areas },
      ),
      profiles: vi.fn(async () => ({ categories: [], retirement: [] })),
      setCategoryProfile: d.setCategoryProfile,
      setRetirement: d.setRetirement,
    },
    directory: {
      list: vi.fn(async () => [
        { id: "u-mara", name: "Mara Beispiel" },
        { id: "u-rosa", name: "Rosa Beispiel" },
        { id: "u-tom", name: "Tom Beispiel" },
      ]),
    },
    ko: { list: vi.fn(async () => [{ id: "k1", category: "Presse", status: "offen" }]) },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { BereichsprofilPflege } from "../../apps/web/src/components/BereichsprofilPflege";
import { RisikoHorizont } from "../../apps/web/src/components/RisikoHorizont";
import i18n from "../../apps/web/src/i18n";
import type { KnowledgeObject } from "../../services/knowledge-object";
import { riskHorizon } from "../../services/management/src/horizon";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(komponente: typeof RisikoHorizont): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, null, createElement(komponente)),
      ),
    );
  });
  await act(flush);
}

const alle = (id: string): Element[] => [...container.querySelectorAll(`[data-testid="${id}"]`)];
const eins = (id: string): Element | null => container.querySelector(`[data-testid="${id}"]`);

async function klicken(el: Element | null | undefined): Promise<void> {
  await act(async () => {
    (el as HTMLElement).click();
    await flush();
  });
}

async function waehlen(el: Element | null | undefined, wert: string): Promise<void> {
  const select = el as HTMLSelectElement;
  const setzer = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(select, wert);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

const BEREICH = {
  category: "Presse",
  managerId: "u-mara",
  criticality: "hoch",
  singleSource: true,
  koCount: 3,
  bearers: [
    {
      userId: "u-rosa",
      horizonMonths: 24,
      currentHorizon: 24,
      // Mittags UTC: das angezeigte Kalenderdatum hängt so in keiner Zeitzone vom Versatz ab.
      dueAt: "2028-10-04T12:00:00.000Z",
      koCount: 2,
      openKoIds: ["k1", "k2"],
      soleBearer: true,
      openGaps: 1,
    },
    {
      userId: "u-tom",
      horizonMonths: 36,
      currentHorizon: 36,
      dueAt: "2029-10-04T00:00:00.000Z",
      koCount: 1,
      openKoIds: [],
      soleBearer: false,
      openGaps: 0,
    },
  ],
};

beforeEach(async () => {
  await i18n.changeLanguage("de");
  d.areas = [];
  d.seesAll = false;
  d.antwort = null;
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

describe("Mein Bereich · Ruhestandshorizonte und Arbeitsvorrat (Nacharbeit 3)", () => {
  it("R1 · Bereich, Verantwortliche, Bus-Faktor 1, Träger mit Frist und Arbeitsvorrat; 24 blendet 36 aus", async () => {
    d.areas = [BEREICH];
    await mount(RisikoHorizont);

    const bereich = eins("horizont-bereich");
    expect(bereich?.getAttribute("data-kategorie")).toBe("Presse");
    expect(eins("horizont-verantwortlich")?.textContent).toBe(
      i18n.t("risk.horizon.manager", { name: "Mara Beispiel" }),
    );
    expect(eins("horizont-busfaktor")).not.toBeNull();
    expect(eins("horizont-kritikalitaet")?.textContent).toContain(
      i18n.t("risk.horizon.level.hoch"),
    );

    // Standard: 36 Monate — beide Träger, nach Frist geordnet.
    expect(alle("horizont-traeger").map((t) => t.getAttribute("data-person"))).toEqual([
      "u-rosa",
      "u-tom",
    ]);
    const rosa = alle("horizont-traeger")[0];
    expect(rosa?.textContent).toContain("Rosa Beispiel");
    expect(rosa?.textContent).toContain("04.10.2028");
    expect(rosa?.querySelector('[data-testid="horizont-vorrat-einziger"]')).not.toBeNull();
    expect(rosa?.querySelector('[data-testid="horizont-vorrat-offen"]')?.textContent).toBe(
      i18n.t("risk.horizon.todo.openKos", { count: 2 }),
    );
    expect(rosa?.querySelector('[data-testid="horizont-vorrat-luecken"]')?.textContent).toBe(
      i18n.t("risk.horizon.todo.openGaps", { count: 1 }),
    );
    // Gegenprobe Tom: kein einziger Träger, nichts offen — keine leeren Vorratszeilen.
    const tom = alle("horizont-traeger")[1];
    expect(tom?.querySelector('[data-testid="horizont-vorrat-einziger"]')).toBeNull();
    expect(tom?.querySelector('[data-testid="horizont-vorrat-offen"]')).toBeNull();

    await klicken(container.querySelector('[data-testid="horizont-filter"][data-monate="24"]'));
    expect(alle("horizont-traeger").map((t) => t.getAttribute("data-person"))).toEqual(["u-rosa"]);
  });

  // R3 (Nacharbeit 5, ben K7/K14 · F4): ZEITFORTSCHRITT. Derselbe unveränderte Eintrag — gepflegt
  // mit 36 Monaten, Frist 04.10.2029 — durch die ECHTE Ableitung `riskHorizon` zu zwei fest
  // vorgegebenen Bezugszeiten und in der ECHTEN Fläche gerendert. Am 04.10.2026 sind es 36 Monate
  // bis zur Frist (nur im 36-Monats-Blick), am 04.01.2028 nur noch 21 (auch im 24-Monats-Blick).
  const FRIST = "2029-10-04T00:00:00.000Z";
  const antwortZu = (bezug: string) =>
    JSON.parse(
      JSON.stringify(
        riskHorizon({
          kos: [
            { id: "k1", category: "Presse", originalAuthor: "u-rosa", status: "offen" },
            { id: "k2", category: "Presse", originalAuthor: "u-rosa", status: "validiert" },
          ] as KnowledgeObject[],
          busFactor: [{ category: "Presse", koCount: 2, authorCount: 1, singleSource: true }],
          profiles: [],
          retirement: [
            {
              userId: "u-rosa",
              horizonMonths: 36,
              dueAt: FRIST,
              updatedAt: "2026-10-04T00:00:00.000Z",
              updatedBy: "u-admin",
            },
          ],
          gaps: [{ status: "offen", assignee: "u-rosa" }],
          viewer: { userId: "u-admin", seesAll: true },
          now: Date.parse(bezug),
        }),
      ),
    );
  const filter = (monate: number) =>
    container.querySelector(`[data-testid="horizont-filter"][data-monate="${monate}"]`);
  const personen = () => alle("horizont-traeger").map((t) => t.getAttribute("data-person"));
  const fristText = new Date(FRIST).toLocaleDateString("de", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  it("R3a · Bezugszeit 04.10.2026: der 36-Monats-Eintrag steht im 36-, nicht im 24-Monats-Blick", async () => {
    d.antwort = antwortZu("2026-10-04T00:00:00.000Z");
    await mount(RisikoHorizont);

    expect(personen(), "Standard 36 Monate").toEqual(["u-rosa"]);
    await klicken(filter(24));
    expect(personen(), "36 Monate bis zur Frist sind nicht „die nächsten 24“").toEqual([]);
    expect(eins("horizont-keine-traeger")).not.toBeNull();
  });

  it("R3b · Bezugszeit 04.01.2028, derselbe Eintrag: im 24-Monats-Blick, mit Arbeitsvorrat und unveränderter Frist", async () => {
    d.antwort = antwortZu("2028-01-04T00:00:00.000Z");
    await mount(RisikoHorizont);

    await klicken(filter(24));
    expect(personen()).toEqual(["u-rosa"]);
    const rosa = alle("horizont-traeger")[0];
    expect(rosa?.textContent, "die gespeicherte Frist bleibt").toContain(fristText);
    expect(rosa?.textContent).toContain(
      i18n.t("risk.horizon.bearer", { name: "Rosa Beispiel", months: 24, due: fristText }),
    );
    expect(rosa?.querySelector('[data-testid="horizont-vorrat-einziger"]')).not.toBeNull();
    expect(rosa?.querySelector('[data-testid="horizont-vorrat-offen"]')?.textContent).toBe(
      i18n.t("risk.horizon.todo.openKos", { count: 1 }),
    );
    expect(rosa?.querySelector('[data-testid="horizont-vorrat-luecken"]')?.textContent).toBe(
      i18n.t("risk.horizon.todo.openGaps", { count: 1 }),
    );
  });

  it("R2 · ohne eigenen Bereich: der Leersatz für „kein Bereich zugeordnet“", async () => {
    await mount(RisikoHorizont);
    expect(eins("horizont-leer")?.textContent).toBe(i18n.t("risk.horizon.noOwnArea"));
    expect(alle("horizont-bereich")).toHaveLength(0);
    // Nacharbeit 4: das Verzeichnis lädt mit der FLÄCHE, nicht erst mit der ersten Bereichskarte —
    // sonst zeigte R1 nach Ankunft des Bereichsblicks „Autorenname wird geladen" statt des Namens.
    expect(endpoints.directory.list).toHaveBeenCalled();
  });
});

describe("Pflege der Eingänge (Nacharbeit 3, nur Admin)", () => {
  it("P1 · Stufen und Verantwortung speichern, Ruhestandshorizont setzen — genau diese Werte gehen hinaus", async () => {
    await mount(BereichsprofilPflege);

    const zeile = container.querySelector(
      '[data-testid="pflege-bereich"][data-kategorie="Presse"]',
    );
    expect(zeile, "die Kategorie aus dem Bestand steht zur Pflege da").not.toBeNull();
    await waehlen(zeile?.querySelector('[data-testid="pflege-manager"]'), "u-mara");
    await waehlen(zeile?.querySelector('[data-faktor="criticality"]'), "hoch");
    await waehlen(zeile?.querySelector('[data-faktor="repetition"]'), "niedrig");
    await klicken(zeile?.querySelector('[data-testid="pflege-speichern"]'));

    expect(d.setCategoryProfile).toHaveBeenCalledWith({
      category: "Presse",
      managerId: "u-mara",
      criticality: "hoch",
      processProximity: null,
      repetition: "niedrig",
      damagePotential: null,
    });

    const rosa = container.querySelector('[data-testid="pflege-ruhestand"][data-person="u-rosa"]');
    await waehlen(rosa?.querySelector("select"), "24");
    expect(d.setRetirement).toHaveBeenCalledWith("u-rosa", 24);
    // Gegenprobe: „kein Eintrag" geht als null hinaus, nicht als 0.
    await waehlen(rosa?.querySelector("select"), "");
    expect(d.setRetirement).toHaveBeenLastCalledWith("u-rosa", null);
  });
});

// @vitest-environment jsdom
// ================================================================================================
// R-0768 · R-1772 · R-2111 · FR-EXT-05 (FE-MGMT-08) — DAS WISSENSHAUS ALS FLÄCHE.
// ================================================================================================
//
// Die Rechnung belegt services/management/src/metrics.test.ts („R-0768 · …"). Dieser Test rendert
// die Fläche, die `/kapital` im Abschnitt „Wissenshaus" zeigt (Stufe2.tsx → Wissenshaus), mit einer
// Antwort in der Form des Servers, und hält die historische Abnahme fest — „Screen zeigt Haus mit
// Domänen-Füllgrad + KPIs":
//   H1  ein Haus: Dach, darunter je Fachgebiet ein Stockwerk in Serverreihenfolge, „ohne Fachgebiet"
//       zuunterst und benannt; jedes Stockwerk trägt seinen Füllgrad als Balken UND als Text
//   H2  gesichert vs. fragil, sichtbar — und der Grund des Fragilen (Füllgrad, Einzelquelle)
//   H3  Import → Wissenshaus → Ausgabe als drei Kennzahlen aus `houseFlow`, samt Grenzsatz
//   H4  Gegenprobe: ohne Stockwerk ohne Fachgebiet fehlt dessen Hinweis
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { MgmtHouseFloor, MgmtHouseFlow } from "../../apps/web/src/api/types";
import { Wissenshaus } from "../../apps/web/src/components/Wissenshaus";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function stockwerk(p: Partial<MgmtHouseFloor> & { domain: string | null }): MgmtHouseFloor {
  return {
    koCount: 4,
    validated: 3,
    validatedRatio: 75,
    authorCount: 2,
    singleSource: false,
    fragile: false,
    imported: 0,
    ...p,
  };
}

const STOCKWERKE: MgmtHouseFloor[] = [
  stockwerk({ domain: "Instandhaltung", imported: 1 }),
  stockwerk({ domain: "Qualität", koCount: 2, validated: 0, validatedRatio: 0, fragile: true }),
  // Alles validiert, aber nur ein Urheber → fragil (der Server setzt beides).
  stockwerk({
    domain: "Einkauf",
    koCount: 1,
    validated: 1,
    validatedRatio: 100,
    authorCount: 1,
    singleSource: true,
    fragile: true,
  }),
  stockwerk({ domain: null, koCount: 5, validated: 4, validatedRatio: 80, authorCount: 3 }),
];

const FLUSS: MgmtHouseFlow = {
  imported: 3,
  importedValidated: 2,
  inHouse: 12,
  secured: 8,
  floors: 4,
  fragileFloors: 2,
  outputReady: 8,
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function mount(floors: MgmtHouseFloor[], flow: MgmtHouseFlow = FLUSS): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(Wissenshaus, { floors, flow }));
  });
}

function stockwerke(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-testid="haus-stockwerk"]')];
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("Wissenshaus · Stockwerke je Fachgebiet, Füllgrad, Import → Haus → Ausgabe", () => {
  it("H1 · Dach und je Fachgebiet ein Stockwerk mit Füllgrad als Balken und Text", async () => {
    await mount(STOCKWERKE);

    const bild = container.querySelector('[data-testid="haus-bild"]');
    expect(bild?.querySelector("svg polygon"), "das Dach").not.toBeNull();
    expect(container.querySelector('[data-testid="haus-dach"]')?.textContent).toBe(
      i18n.t("wissenshaus.dach", { floors: 4 }),
    );
    expect(stockwerke().map((s) => s.getAttribute("data-fachgebiet"))).toEqual([
      "Instandhaltung",
      "Qualität",
      "Einkauf",
      "",
    ]);
    const unten = stockwerke()[3];
    expect(unten?.textContent).toContain(i18n.t("wissenshaus.ohneFachgebiet"));

    const erstes = stockwerke()[0];
    const balken = erstes?.querySelector<HTMLElement>('[data-testid="haus-fuellgrad"]');
    expect(balken?.getAttribute("data-pct")).toBe("75");
    expect((balken?.firstElementChild as HTMLElement | null)?.style.width).toBe("75%");
    expect(erstes?.textContent).toContain(i18n.t("wissenshaus.fuellgrad", { pct: 75 }));
    expect(erstes?.textContent).toContain(
      i18n.t("wissenshaus.zeile", { count: 4, validated: 3, authors: 2, imported: 1 }),
    );
    expect(container.querySelector('[data-testid="haus-ohne-fachgebiet"]')?.textContent).toBe(
      i18n.t("wissenshaus.ohneFachgebietHinweis"),
    );
  });

  it("H2 · gesichert vs. fragil ist sichtbar, mit Grund", async () => {
    await mount(STOCKWERKE);

    expect(stockwerke().map((s) => s.getAttribute("data-zustand"))).toEqual([
      "gesichert",
      "fragil",
      "fragil",
      "gesichert",
    ]);
    const zustand = (i: number) =>
      stockwerke()[i]?.querySelector('[data-testid="haus-zustand"]')?.textContent;
    expect(zustand(0)).toBe(i18n.t("wissenshaus.zustand.gesichert"));
    expect(zustand(1)).toBe(
      `${i18n.t("wissenshaus.zustand.fragil")} · ${i18n.t("wissenshaus.grund.fuellgrad")}`,
    );
    expect(zustand(2)).toBe(
      `${i18n.t("wissenshaus.zustand.fragil")} · ${i18n.t("wissenshaus.grund.einzelquelle")}`,
    );
  });

  it("H3 · Import → Wissenshaus → Ausgabe als drei Kennzahlen mit Grenzsatz", async () => {
    await mount(STOCKWERKE);

    const fluss = container.querySelector('[data-testid="haus-fluss"]');
    expect(fluss?.getAttribute("aria-label")).toBe(i18n.t("wissenshaus.fluss.titel"));
    const station = (id: string) => container.querySelector(`[data-testid="haus-fluss-${id}"]`);
    const wert = (id: string) =>
      station(id)?.querySelector('[data-testid="haus-fluss-wert"]')?.textContent;
    expect([wert("import"), wert("haus"), wert("ausgabe")]).toEqual(["3", "12", "8"]);
    expect(station("import")?.textContent).toContain(
      i18n.t("wissenshaus.fluss.importDetail", { n: 2 }),
    );
    expect(station("haus")?.textContent).toContain(
      i18n.t("wissenshaus.fluss.hausDetail", { secured: 8, fragile: 2, floors: 4 }),
    );
    expect(station("ausgabe")?.textContent).toContain(i18n.t("wissenshaus.fluss.ausgabeDetail"));
    expect(fluss?.textContent).toContain(i18n.t("wissenshaus.fluss.grenze"));
  });

  it("H4 · Gegenprobe: ohne Stockwerk ohne Fachgebiet fehlt dessen Hinweis", async () => {
    await mount(STOCKWERKE.filter((s) => s.domain !== null));

    expect(stockwerke()).toHaveLength(3);
    expect(container.querySelector('[data-testid="haus-ohne-fachgebiet"]')).toBeNull();
    expect(container.textContent).not.toContain(i18n.t("wissenshaus.ohneFachgebiet"));
  });
});

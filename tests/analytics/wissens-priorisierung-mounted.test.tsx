// @vitest-environment jsdom
// ================================================================================================
// R-0751 · FR-EXT-04 · FE-MGMT-09 (Nacharbeit 1) — GERANKTE LISTE MIT SCORE, FLAGS, FAKTOR-DETAIL.
// ================================================================================================
//
// Die Rechnung belegt services/management/src/metrics.test.ts (P1–P5). Dieser Test rendert die
// Fläche, die `/kapital` im Abschnitt „Wissens-Priorisierung" zeigt (Stufe2.tsx → WissensPriorisierung),
// mit einer Antwort in der Form des Servers, und hält fest:
//   W1  Rang, Score, Flags und das Faktor-Detail mit allen neun Faktoren der Quelle; ein Faktor ohne
//       Eingangsdaten heisst „keine Eingangsdaten", nie 0 — und der Satz darüber nennt diese Faktoren
//   W2  die Filter der Quelle: alles · Bus-Faktor 1 · veraltet · hoher Schutzwert
//   W3  Gegenproben: leerer Filter sagt es; haben alle Faktoren Daten, fehlt der Hinweissatz
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { MgmtPriority, MgmtPriorityFactorKey } from "../../apps/web/src/api/types";
import { WissensPriorisierung } from "../../apps/web/src/components/WissensPriorisierung";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const QUELLE: MgmtPriorityFactorKey[] = [
  "busFactor",
  "criticality",
  "processProximity",
  "age",
  "sourceQuality",
  "conflictDensity",
  "repetition",
  "damagePotential",
  "protection",
];
const OHNE_DATEN: MgmtPriorityFactorKey[] = [
  "criticality",
  "processProximity",
  "repetition",
  "damagePotential",
];

function zeile(
  category: string,
  score: number,
  flags: MgmtPriority["flags"],
  ohne: readonly MgmtPriorityFactorKey[] = OHNE_DATEN,
): MgmtPriority {
  return {
    category,
    score,
    knownFactors: 9 - ohne.length,
    factors: QUELLE.map((key) => ({ key, value: ohne.includes(key) ? null : 0 })),
    flags,
  };
}

const ANTWORT: MgmtPriority[] = [
  zeile("Anlage 1", 88, ["busFactorOne", "stale", "highProtection"]),
  zeile("Anlage 3", 40, ["stale"]),
  zeile("Anlage 2", 8, []),
];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function mount(priorities: MgmtPriority[]): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(WissensPriorisierung, { priorities }));
  });
}

function kategorien(): (string | null)[] {
  const zeilen = [...container.querySelectorAll('[data-testid="prio-zeile"]')];
  return zeilen.map((z) => z.getAttribute("data-kategorie"));
}

function knopf(f: string): HTMLButtonElement | null {
  return container.querySelector(`[data-testid="prio-filter"][data-filter="${f}"]`);
}

async function filtern(f: string): Promise<void> {
  await act(async () => {
    knopf(f)?.click();
  });
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

describe("Wissens-Priorisierung · die Fläche der neun Faktoren", () => {
  it("W1 · Rang, Score, Flags und Faktor-Detail; fehlende Eingangsdaten heissen so, nicht 0", async () => {
    await mount(ANTWORT);

    expect(kategorien()).toEqual(["Anlage 1", "Anlage 3", "Anlage 2"]);
    const erste = container.querySelector('[data-testid="prio-zeile"]');
    expect(erste?.querySelector('[data-testid="prio-score"]')?.textContent).toBe("88");
    const flags = [...(erste?.querySelectorAll('[data-testid="prio-flag"]') ?? [])];
    // R-0908: „Bus-Faktor 1" steht als Markierung jetzt in Anwendersprache („nur eine Person"),
    // der Filter darüber erklärt den Begriff (`texte/fachwort.ts`).
    expect(flags.map((e) => e.textContent)).toEqual([
      i18n.t("fachwort.einzelperson.markierung"),
      i18n.t("mgmt.prio.flag.stale"),
      i18n.t("mgmt.prio.flag.highProtection"),
    ]);

    // Das Faktor-Detail trägt ALLE neun Faktoren der Quelle, in ihrer Reihenfolge.
    const faktoren = [...(erste?.querySelectorAll('[data-testid="prio-faktor"]') ?? [])];
    expect(faktoren.map((f) => f.getAttribute("data-faktor"))).toEqual(QUELLE);
    expect(erste?.querySelector("summary")?.textContent).toBe(
      i18n.t("mgmt.prio.detail", { known: 5 }),
    );
    for (const f of faktoren) {
      const key = f.getAttribute("data-faktor") as MgmtPriorityFactorKey;
      expect(f.textContent).toContain(i18n.t(`mgmt.prio.factor.${key}`));
      if (OHNE_DATEN.includes(key)) {
        expect(f.textContent, key).toContain(i18n.t("mgmt.prio.noData"));
      } else {
        expect(f.textContent, key).not.toContain(i18n.t("mgmt.prio.noData"));
      }
    }
    // Der Satz über der Liste nennt genau die vier Faktoren ohne Eingangsdaten.
    expect(container.querySelector('[data-testid="prio-ohne-daten"]')?.textContent).toBe(
      i18n.t("mgmt.prio.noDataNote", {
        factors: OHNE_DATEN.map((k) => i18n.t(`mgmt.prio.factor.${k}`)).join(", "),
      }),
    );
  });

  it("W2 · die Filter der Quelle: alles, Bus-Faktor 1, veraltet, hoher Schutzwert", async () => {
    await mount(ANTWORT);

    // Die Filter sind EINE benannte Gruppe — als <fieldset>, nicht als div mit role="group".
    const gruppe = knopf("all")?.closest("fieldset");
    expect(gruppe?.getAttribute("aria-label")).toBe(i18n.t("mgmt.prio.filterLabel"));
    expect(gruppe?.querySelectorAll('[data-testid="prio-filter"]')).toHaveLength(4);
    expect(container.querySelector('[role="group"]')).toBeNull();

    await filtern("busFactorOne");
    expect(kategorien()).toEqual(["Anlage 1"]);
    await filtern("stale");
    expect(kategorien()).toEqual(["Anlage 1", "Anlage 3"]);
    await filtern("highProtection");
    expect(kategorien()).toEqual(["Anlage 1"]);
    expect(knopf("highProtection")?.getAttribute("aria-pressed")).toBe("true");
    expect(knopf("all")?.getAttribute("aria-pressed")).toBe("false");
    await filtern("all");
    expect(kategorien()).toEqual(["Anlage 1", "Anlage 3", "Anlage 2"]);
  });

  it("W3 · Gegenproben: leerer Filter sagt es; haben alle Faktoren Daten, fehlt der Hinweissatz", async () => {
    await mount([zeile("Anlage 2", 8, [], [])]);

    expect(container.querySelector('[data-testid="prio-ohne-daten"]')).toBeNull();
    expect(container.textContent).not.toContain(i18n.t("mgmt.prio.noData"));
    await filtern("busFactorOne");
    expect(kategorien()).toEqual([]);
    expect(container.querySelector('[data-testid="prio-leer"]')?.textContent).toBe(
      i18n.t("mgmt.prio.emptyFilter"),
    );
  });
});

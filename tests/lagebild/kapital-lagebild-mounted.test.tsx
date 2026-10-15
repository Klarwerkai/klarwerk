// @vitest-environment jsdom
// ================================================================================================
// PETER-20261011-P13 · DIE KAPITALSICHT (`Capital`, Stufe 2), GEMOUNTET, MIT FIKTIVER ANTWORT.
// ================================================================================================
//
// Gefahren wird die echte Seite gegen einen ersetzten Draht (fetch an der Netzgrenze). Alle Zahlen,
// Fälle und Kennungen sind erfunden — eine Agentenprüfung, keine Messung mit realen Anwendern.
//   G1  K6  kein Geldwert aus dem Bestand: die Schätzung (validierte Objekte × Vorgabewerte) steht
//           nur als gekennzeichnetes Beispiel getrennt daneben (lagebild-reale-werte-eingabe); ohne
//           gemessene Fälle heisst es „Kein Geldwert“ mit Grund
//   G2  K6/K7  eingetragene Fälle: Formel mit offengelegten Annahmen; Mehraufwand und
//           Zusatzkosten bleiben in der Rechnung, auch unter null
//   G3  K2  eine Agentenprüfung ist als Simulation gekennzeichnet — kein realer Kapitalwert
//   G4  K1  Reifegrad: Stufen mit Nachweisen, kein firmenweiter Wert aus der Validierungsquote
//   G5  K4  leerer Bestand: kein Kapitalwert und keine Anteile in Prozent
// Nicht gemessen: Browserlayout in Chromium.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }),
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { ManagementSnapshot } from "../../apps/web/src/api/types";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { BERECHNUNGSVERSION, REIFESTUFEN } from "../../apps/web/src/lib/lagebild";
import { Capital } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 3 validierte Objekte, Ø-Vertrauen 70: die alte Schätzung hätte 3 × 360 € × 0,7 = 756 € gezeigt. */
function snapshot(teil: Partial<ManagementSnapshot> = {}): ManagementSnapshot {
  return {
    generatedAt: "2026-10-12T08:00:00.000Z",
    overview: {
      totalKos: 4,
      validated: 3,
      open: 1,
      openGaps: 0,
      openConflicts: 0,
      avgTrust: 70,
      healthScore: 60,
      healthBand: "mittel",
      demoKos: 0,
    },
    capital: {
      score: 60,
      band: "mittel",
      parts: [
        { key: "validatedRatio", value: 75, weight: 0.3 },
        { key: "freshnessInv", value: 100, weight: 0.15 },
      ],
    },
    valuationFacts: { validatedKos: 3, totalKos: 4, avgTrust: 70 },
    statement: {
      assets: 3,
      riskItems: 0,
      riskBreakdown: { singleSourceCategories: 0, stale: 0, openGaps: 0, openConflicts: 0 },
      net: 3,
    },
    maturity: { stage: 3, stageKey: "validieren", progressPct: 60 },
    priorities: [],
    recommendations: [],
    house: [],
    houseFlow: {
      imported: 0,
      importedValidated: 0,
      inHouse: 4,
      secured: 3,
      floors: 0,
      fragileFloors: 0,
      outputReady: 3,
    },
    pilot: [{ days: 30, created: 1, validated: 1 }],
    ...teil,
  };
}

let aktuell: ManagementSnapshot = snapshot();

function stelleFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const pfad = String(url);
      const koerper = pfad.includes("/api/management/snapshot")
        ? aktuell
        : pfad.includes("/api/validation/overview")
          ? []
          : pfad.includes("/api/directory")
            ? []
            : null;
      if (koerper === null) {
        return { ok: false, status: 500, statusText: "no", text: async () => "{}" } as Response;
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(koerper),
      } as Response;
    }),
  );
}

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const gemountet: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

afterEach(async () => {
  for (const { root, container } of gemountet.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  aktuell = snapshot();
  vi.unstubAllGlobals();
  await i18n.changeLanguage("de");
});

async function mounten(): Promise<HTMLDivElement> {
  stelleFetch();
  await i18n.changeLanguage("de");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  gemountet.push({ root, container });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(MemoryRouter, { initialEntries: ["/kapital"] }, createElement(Capital)),
        ),
      ),
    );
    await durchlaufen();
  });
  for (let runde = 0; runde < 3; runde++) {
    await act(durchlaufen);
  }
  return container;
}

function element(container: ParentNode, testid: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  if (!el) {
    throw new Error(`/kapital: [data-testid="${testid}"] fehlt auf der Seite`);
  }
  return el;
}

const de = (k: string, o: Record<string, unknown> = {}): string => i18n.getFixedT("de")(k, o);

/** Ein Feld so setzen, wie React es von einer Eingabe erwartet. */
function tippe(el: HTMLElement, wert: string): void {
  const auswahl = el instanceof HTMLSelectElement;
  const proto = auswahl ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, wert);
    el.dispatchEvent(new Event(auswahl ? "change" : "input", { bubbles: true }));
  });
}

function klick(el: HTMLElement): void {
  act(() => {
    el.click();
  });
}

/** Trägt einen Fall in die Zeile `nr` ein (0-basiert). */
function fallEintragen(
  geld: HTMLElement,
  nr: number,
  f: { id: string; ohne: string; mit: string; vergleichbar: boolean },
): void {
  const zeile = geld.querySelectorAll<HTMLElement>('[data-testid="p13-fall"]')[nr];
  if (!zeile) {
    throw new Error(`Fallzeile ${nr} fehlt`);
  }
  tippe(element(zeile, "p13-fall-id"), f.id);
  tippe(element(zeile, "p13-fall-ohne"), f.ohne);
  tippe(element(zeile, "p13-fall-mit"), f.mit);
  const haken = element(zeile, "p13-fall-vergleichbar") as HTMLInputElement;
  if (haken.checked !== f.vergleichbar) {
    klick(haken);
  }
}

describe("P13 · Kapitalsicht: Geldwert nur aus gemessenen Fällen", () => {
  it("G1 · K6: kein Euro aus dem Bestand, keine Vorgabewerte — „Kein Geldwert“ mit Grund", async () => {
    const container = await mounten();
    const geld = element(container, "p13-geldwert");
    expect(element(geld, "p13-ergebnis").dataset.lage).toBe("nicht_berechenbar");
    expect(geld.textContent).toContain(de("lagebild.geld.kein"));
    expect(element(geld, "p13-grund").textContent).toBe(de("lagebild.geld.messartFehlt"));
    // Der Geldwert rechnet nicht aus dem Bestand: weder der Betrag der Schätzung aus 3 validierten
    // Objekten (756 €) noch ihre Formel stehen in dieser Karte.
    expect(geld.textContent).not.toMatch(/756/);
    expect(geld.textContent).not.toContain("validierte Objekte ×");
    // Die Schätzung aus validierten Objekten gibt es nur als gekennzeichnetes Beispiel
    // (produkt:20261013:lagebild-reale-werte-eingabe) — getrennt von dieser Karte, nie darin.
    const beispiel = element(container, "kapital-beispielrechnung");
    expect(element(beispiel, "kapital-beispiel-kennzeichnung").textContent).toBe(
      de("lagebildwerte.beispiel.kennzeichnung"),
    );
    expect(beispiel.contains(geld)).toBe(false);
    expect(geld.contains(beispiel)).toBe(false);
    // Keine Vorgabewerte in den Annahmen.
    expect((element(geld, "p13-kostensatz") as HTMLInputElement).value).toBe("");
    expect((element(geld, "p13-zusatzkosten") as HTMLInputElement).value).toBe("");

    // Messart gewählt, aber noch kein Fall: der Grund ändert sich, ein Wert entsteht nicht.
    tippe(element(geld, "p13-messart"), "mensch");
    expect(element(geld, "p13-grund").textContent).toBe(de("lagebild.geld.grund.keine_faelle"));
  });

  it("G2 · K6/K7: Formel mit Annahmen; Mehraufwand und Zusatzkosten bleiben in der Rechnung", async () => {
    const container = await mounten();
    const geld = element(container, "p13-geldwert");
    tippe(element(geld, "p13-messart"), "mensch");
    fallEintragen(geld, 0, { id: "F-1", ohne: "20", mit: "50", vergleichbar: true });
    klick(element(geld, "p13-fall-hinzufuegen"));
    fallEintragen(geld, 1, { id: "F-2", ohne: "40", mit: "20", vergleichbar: true });
    // Ohne Kostensatz kein Wert — auch nicht mit Fällen.
    expect(element(geld, "p13-grund").textContent).toBe(de("lagebild.geld.grund.kostensatz_fehlt"));
    tippe(element(geld, "p13-kostensatz"), "60");
    // Ohne Angabe der Zusatzkosten kein Wert — sie fallen nicht still weg.
    expect(element(geld, "p13-grund").textContent).toBe(
      de("lagebild.geld.grund.zusatzkosten_fehlt"),
    );
    tippe(element(geld, "p13-zusatzkosten"), "15");

    // (20 − 50) + (40 − 20) = −10 Minuten → −10 € brutto, −25 € netto.
    expect(element(geld, "p13-ergebnis").dataset.lage).toBe("berechnet");
    const netto = element(geld, "p13-netto").textContent ?? "";
    expect(netto).toContain("25");
    expect(netto).toMatch(/[-−]\s?25/);
    const formel = element(geld, "p13-formel").textContent ?? "";
    expect(formel).toContain("2 Fälle");
    expect(formel).toContain("-10 Minuten");
    expect(formel).toMatch(/15/);
    expect(element(geld, "p13-mehraufwand").textContent).toBe(
      de("lagebild.geld.mehraufwand", { count: 1 }),
    );
    expect(element(geld, "p13-messart-hinweis").textContent).toBe(de("lagebild.geld.echt"));
    expect(geld.textContent).toContain(de("lagebild.geld.keinUmsatz"));
    expect(geld.textContent).toContain(BERECHNUNGSVERSION);

    // Ein Fall ohne vergleichbare Qualität verhindert den Wert für alle.
    fallEintragen(geld, 1, { id: "F-2", ohne: "40", mit: "20", vergleichbar: false });
    expect(element(geld, "p13-grund").textContent).toBe(
      de("lagebild.geld.grund.qualitaet_nicht_vergleichbar"),
    );
  });

  it("G3 · K2: eine Agentenprüfung ist als Simulation gekennzeichnet", async () => {
    const container = await mounten();
    const geld = element(container, "p13-geldwert");
    tippe(element(geld, "p13-messart"), "agent");
    fallEintragen(geld, 0, { id: "RF-fiktiv-1", ohne: "30", mit: "10", vergleichbar: true });
    tippe(element(geld, "p13-kostensatz"), "60");
    tippe(element(geld, "p13-zusatzkosten"), "0");
    const hinweis = element(geld, "p13-messart-hinweis");
    expect(hinweis.dataset.messart).toBe("agent");
    expect(hinweis.textContent).toBe(de("lagebild.geld.simulation"));
    expect(hinweis.textContent).not.toBe(de("lagebild.geld.echt"));
  });
});

describe("P13 · Kapitalsicht: Reifegrad und leerer Bestand", () => {
  it("G4 · K1: Stufen mit Nachweisen je Arbeitsweg, kein firmenweiter Reifegrad", async () => {
    const container = await mounten();
    const reife = element(container, "p13-reifegrad");
    const stufen = [...reife.querySelectorAll<HTMLElement>('[data-testid="p13-stufe"]')];
    expect(stufen.map((s) => s.dataset.stufe)).toEqual([...REIFESTUFEN]);
    for (const s of stufen) {
      const stufe = s.dataset.stufe ?? "";
      expect(s.textContent).toContain(de(`lagebild.reife.text.${stufe}`));
    }
    expect(element(reife, "p13-keine-belege").textContent).toBe(de("lagebild.reife.keineBelege"));
    // Der Snapshot meldet „Stufe 3/5 · Validieren“ — die Karte gibt das nicht mehr aus.
    const karte = reife.parentElement as HTMLElement;
    expect(karte.textContent).not.toContain("3/5");
    expect(karte.textContent).not.toContain(de("mgmt.stageName.validieren"));
  });

  it("G5 · K4: ohne Bestand kein Kapitalwert und keine Prozentanteile", async () => {
    aktuell = snapshot({
      overview: {
        totalKos: 0,
        validated: 0,
        open: 0,
        openGaps: 0,
        openConflicts: 0,
        avgTrust: 0,
        healthScore: 0,
        healthBand: "kritisch",
        demoKos: 0,
      },
      capital: {
        score: 0,
        band: "kritisch",
        parts: [
          { key: "validatedRatio", value: 0, weight: 0.3 },
          { key: "freshnessInv", value: 100, weight: 0.15 },
        ],
      },
    });
    const container = await mounten();
    // Ohne Bestand zeigt die Seite den Leerhinweis statt der Kapitalsicht (`Capital`) — der vom
    // Server gerechnete Wert 0/100 und die Anteile 0 % bzw. 100 % erscheinen nicht.
    expect(container.textContent).toContain(de("mgmt.empty"));
    expect(container.querySelectorAll('[data-testid="kapital-anteil"]')).toHaveLength(0);
    expect(container.querySelector('[data-testid="kapital-index-hinweis"]')).toBeNull();
    expect(container.querySelector('[data-testid="p13-geldwert"]')).toBeNull();
    expect(container.textContent).not.toContain(`/ 100 · ${de("mgmt.band.kritisch")}`);
    expect(container.textContent).not.toMatch(/\b(0|100) · (30|15)%/);
  });

  it("mit Bestand bleiben Kapitalwert und Anteile wie bisher", async () => {
    const container = await mounten();
    expect(container.querySelector('[data-testid="kapital-index-hinweis"]')).not.toBeNull();
    const anteile = [...container.querySelectorAll<HTMLElement>('[data-testid="kapital-anteil"]')];
    expect(anteile[0]?.textContent).toContain("75 · 30%");
  });
});

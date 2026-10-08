// @vitest-environment jsdom
// ================================================================================================
// R-0920 — DAS ERGEBNIS EINES IMPORTLAUFS HAT EINE EIGENE ADRESSE, ROLLE, DREI SPRACHEN, TASTATUR.
// ================================================================================================
//
// Gemessen wird `/import/lauf/:importId` (`pages/ImportLauf.tsx`) an vier Stellen:
//   A  ADRESSE   — die Route steht im Rollen-Gate und in `PAGES`; die Kennung kommt aus der Adresse.
//   R  ROLLE     — dieselbe Schranke wie `/import`: Admin und Stufe 2, kein Controller.
//   S  SPRACHEN  — jeder Schlüssel der Seite steht in DE, EN und NL (ohne Rückfall auf Deutsch).
//   B  BEDIENUNG — genau eine `h1`, Kennung als Text, Ausgang in einer Live-Region, Zähler als
//                  benannte Liste, Rückweg als Verweis; 404 behauptet weder Zustand noch Zähler.
//
// Der Lesehaken ist ein Doppelgänger (wie in `tests/import-lauf-kennung/`): gemessen wird die
// Darstellung, nicht der Abruf. Dass der echte Haken gegen den echten Server liest, messen die
// bestehenden Fälle in `tests/import-volltext/selektivimport-hat-eine-lauf-kennung.test.ts`.
//
// NICHT GEMESSEN, und das gehört hierher: eine echte Vorlesehilfe. jsdom kennt keinen
// Barrierebaum; geprüft sind Rollen, Namen und Live-Region am DOM — nicht die Ansage selbst.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/hooks", () => ({ useImportRun: vi.fn() }));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { admin: { import: { group: vi.fn(), apply: vi.fn() } } },
}));

import type { Mock } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { ApiError } from "../../apps/web/src/api/client";
import { useImportRun } from "../../apps/web/src/api/hooks";
import type { ImportRunRecord } from "../../apps/web/src/api/types";
import {
  GUARDED_ITEMS,
  canSee,
  istAktiverEintrag,
  routePathAllows,
} from "../../apps/web/src/app/navigation";
import { importLaufPfad } from "../../apps/web/src/components/ImportLaufLink";
import { STICHWORT_JE_EINTRAG } from "../../apps/web/src/components/einstellungen/rollenFreiheiten";
import i18n from "../../apps/web/src/i18n";
import { ImportLauf } from "../../apps/web/src/pages/ImportLauf";
import { sprachbestand } from "../support/i18nBestand";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KENNUNG = "run-0920";
const laufDoppel = (): Mock => useImportRun as unknown as Mock;

function laufakte(teil: Partial<ImportRunRecord> = {}): ImportRunRecord {
  return {
    importId: KENNUNG,
    sourceSystem: "confluence",
    externalId: null,
    sourceScope: "DEMO",
    requestedSourceVersion: null,
    status: "COMPLETED",
    sourceRecordId: null,
    startedAt: "2026-10-08T08:00:00.000Z",
    completedAt: "2026-10-08T08:05:00.000Z",
    failureCode: null,
    failureReason: null,
    counters: { itemsTotal: 5, itemsCreated: 2, itemsBound: 1, itemsSkipped: 1, itemsFailed: 1 },
    ...teil,
  };
}

function stelle(zustand: {
  data: ImportRunRecord | undefined;
  isError?: boolean;
  error?: unknown;
  isFetching?: boolean;
  isPaused?: boolean;
}): void {
  laufDoppel().mockReturnValue({
    isError: false,
    error: null,
    isFetching: false,
    isPaused: false,
    ...zustand,
  });
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function zeige(pfad: string): HTMLDivElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(
        MemoryRouter,
        { initialEntries: [pfad] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: "/import/lauf/:importId",
            element: createElement(ImportLauf),
          }),
          createElement(Route, { path: "/import", element: createElement("p", null, "IMPORT") }),
        ),
      ),
    );
  });
  return container;
}

const q = (sel: string): HTMLElement | null =>
  (container?.querySelector(sel) as HTMLElement | null) ?? null;

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  if (root !== null) {
    await act(async () => {
      root?.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  vi.clearAllMocks();
});

describe("R-0920 · A — eine eigene Adresse, aus der Navigationsquelle geroutet", () => {
  it("A1: `/import/lauf/:importId` steht im Rollen-Gate und hat einen Seiteneintrag in routes.tsx", () => {
    const eintrag = GUARDED_ITEMS.find((i) => i.path === "/import/lauf/:importId");
    expect(eintrag?.id).toBe("importLauf");
    const routen = readFileSync("apps/web/src/routes.tsx", "utf8");
    expect(routen).toContain("importLauf: ImportLauf,");
    expect(routen).toMatch(/lazy\(\(\) =>\s*import\("\.\/pages\/ImportLauf"\)/);
  });

  it("A2: die Kennung kommt aus der Adresse und geht unverändert an den Lesehaken", () => {
    stelle({ data: laufakte() });
    zeige(`/import/lauf/${KENNUNG}`);
    expect(q("[data-testid=imp-lauf-kennung]")?.textContent).toBe(KENNUNG);
    expect(laufDoppel()).toHaveBeenCalledWith(KENNUNG);
  });

  it("A3: der Verweis auf die Adresse kodiert die Kennung als EIN Pfadsegment", () => {
    expect(importLaufPfad("a/b?c")).toBe("/import/lauf/a%2Fb%3Fc");
    expect(importLaufPfad(KENNUNG)).toBe(`/import/lauf/${KENNUNG}`);
  });

  it("A4: im Menü bleibt `/import` ausgezeichnet — kein eigener Menüpunkt", () => {
    const importPunkt = GUARDED_ITEMS.find((i) => i.id === "import");
    expect(importPunkt && istAktiverEintrag(importPunkt, `/import/lauf/${KENNUNG}`)).toBe(true);
  });
});

describe("R-0920 · R — dieselbe Schranke wie `/import`", () => {
  it("R1: Admin darf, Controller, Experte und Betrachter nicht; ohne Stufe 2 nicht sichtbar", () => {
    const pfad = `/import/lauf/${KENNUNG}`;
    expect(routePathAllows(pfad, "admin")).toBe(true);
    for (const rolle of ["controller", "experte", "viewer"] as const) {
      expect(routePathAllows(pfad, rolle), rolle).toBe(false);
    }
    const eintrag = GUARDED_ITEMS.find((i) => i.id === "importLauf");
    const importPunkt = GUARDED_ITEMS.find((i) => i.id === "import");
    expect(eintrag?.minRole).toBe(importPunkt?.minRole);
    expect(eintrag?.stufe2).toBe(importPunkt?.stufe2);
    expect(eintrag && canSee(eintrag, "admin", false)).toBe(false);
  });

  it("R2: die Rollenkarte nennt dafür dieselbe Freiheit wie für den Import", () => {
    // Gegenprobe zu `tests/app/h6-rollenfreiheiten.test.ts` Fall 1, beschränkt auf den Eintrag
    // dieses Auftrags: jener Fall ist am Basisstand wegen des fremden Eintrags `ablauf` rot.
    expect("importLauf" in STICHWORT_JE_EINTRAG).toBe(true);
    expect(STICHWORT_JE_EINTRAG.importLauf).toBe(STICHWORT_JE_EINTRAG.import);
    expect(STICHWORT_JE_EINTRAG.importLauf).toBe("adm.sec.quellen");
  });
});

describe("R-0920 · K — die neuen Klassenbindungen sind auflösbar", () => {
  // Gegenprobe zu `tests/app/mega47-modale-flaechen-sammler.test.tsx` (JOB 1181), beschränkt auf die
  // Dateien dieses Auftrags: dessen Gesamtzahl 226 ist am Basisstand durch fremde Bindungen
  // überholt. Dieselbe Regel wie dort: eine Bindung ist aufgelöst, wenn sie ein Literal ist oder ein
  // Bezeichner, den DIESE Datei mit literalem Wert deklariert.
  for (const datei of [
    "apps/web/src/pages/ImportLauf.tsx",
    "apps/web/src/components/ImportLaufLink.tsx",
  ]) {
    it(`K1: ${datei} trägt keine unauflösbare className-Bindung`, () => {
      const quelle = readFileSync(datei, "utf8");
      const ausdruecke = [...quelle.matchAll(/className=\{([^}]*)\}/g)].map((m) =>
        (m[1] ?? "").trim(),
      );
      const offen = ausdruecke.filter((a) => {
        if (/^"[^"]*"$/.test(a)) {
          return false;
        }
        if (/^[A-Z_][A-Z0-9_]*$/.test(a)) {
          return !new RegExp(`const ${a} =\\s*"[^"]*";`).test(quelle);
        }
        return true;
      });
      expect(offen, datei).toEqual([]);
    });
  }
});

describe("R-0920 · S — Deutsch, Englisch, Niederländisch", () => {
  const SCHLUESSEL = [
    "imp.lauf.oeffnen",
    "imp.lauf.titel",
    "imp.lauf.lead",
    "imp.lauf.kennung",
    "imp.lauf.ausgang",
    "imp.lauf.nichtGefunden",
    "imp.lauf.zaehler.gesamt",
    "imp.lauf.zaehler.angelegt",
    "imp.lauf.zaehler.gebunden",
    "imp.lauf.zaehler.uebersprungen",
    "imp.lauf.zaehler.gescheitert",
    "imp.lauf.gestartet",
    "imp.lauf.beendet",
    "imp.lauf.nochNichtBeendet",
    "imp.lauf.zurueck",
  ];

  it("S1: jeder Schlüssel steht in jeder Sprache selbst — kein Rückfall, keine Kopie des Deutschen", () => {
    const de = sprachbestand("de");
    for (const sprache of ["de", "en", "nl"] as const) {
      const bestand = sprachbestand(sprache);
      const fehlend = SCHLUESSEL.filter((k) => !(bestand[k] ?? "").trim());
      expect(fehlend, sprache).toEqual([]);
      if (sprache !== "de") {
        const gleich = SCHLUESSEL.filter((k) => k !== "imp.lauf.kennung" && bestand[k] === de[k]);
        expect(gleich, `${sprache} übernimmt deutsche Texte`).toEqual([]);
      }
    }
  });

  it("S2: die Seite spricht die eingestellte Sprache — EN und NL gemountet", async () => {
    for (const sprache of ["en", "nl"] as const) {
      await i18n.changeLanguage(sprache);
      stelle({ data: laufakte() });
      const flaeche = zeige(`/import/lauf/${KENNUNG}`);
      const t = i18n.getFixedT(sprache);
      expect(flaeche.querySelector("h1")?.textContent).toBe(t("imp.lauf.titel"));
      expect(q("[data-testid=imp-lauf-zurueck]")?.textContent).toContain(t("imp.lauf.zurueck"));
      expect(flaeche.textContent).toContain(t("w2.run.status.COMPLETED"));
      await act(async () => {
        root?.unmount();
      });
      container?.remove();
      root = null;
      container = null;
    }
  });
});

describe("R-0920 · B — Tastatur und Vorleseprogramm, und nichts wird behauptet", () => {
  it("B1: genau eine h1, ein benannter Ausgangsabschnitt, Ausgang in einer höflichen Live-Region", () => {
    stelle({ data: laufakte() });
    const flaeche = zeige(`/import/lauf/${KENNUNG}`);
    expect(flaeche.querySelectorAll("h1")).toHaveLength(1);
    const abschnitt = flaeche.querySelector("section[aria-labelledby]");
    const name = abschnitt
      ? document.getElementById(abschnitt.getAttribute("aria-labelledby") ?? "")?.textContent
      : null;
    expect(name).toBe(i18n.t("imp.lauf.ausgang"));
    expect(q("[data-testid=imp-lauf-ausgang]")?.getAttribute("aria-live")).toBe("polite");
    // Der Ausgang steht DARIN — sonst sagte die Live-Region nichts an.
    expect(q("[data-testid=imp-lauf-ausgang] [data-testid=w2-run]")).not.toBeNull();
  });

  it("B2: die Zähler sind eine Beschreibungsliste mit Namen und Server-Werten", () => {
    stelle({ data: laufakte() });
    zeige(`/import/lauf/${KENNUNG}`);
    const liste = q("[data-testid=imp-lauf-zaehler]");
    expect(liste?.tagName).toBe("DL");
    expect(q("[data-testid=imp-lauf-zaehler-itemsTotal]")?.textContent).toBe("5");
    expect(q("[data-testid=imp-lauf-zaehler-itemsFailed]")?.textContent).toBe("1");
    const namen = [...(liste?.querySelectorAll("dt") ?? [])].map((d) => d.textContent);
    expect(namen).toContain(i18n.t("imp.lauf.zaehler.gescheitert"));
  });

  it("B3: der Rückweg ist ein fokussierbarer Verweis mit sichtbarem Fokus und führt nach /import", async () => {
    stelle({ data: laufakte() });
    zeige(`/import/lauf/${KENNUNG}`);
    const zurueck = q("[data-testid=imp-lauf-zurueck]");
    expect(zurueck?.tagName).toBe("A");
    expect(zurueck?.getAttribute("href")).toBe("/import");
    expect(zurueck?.className).toContain("focus-visible:outline");
    zurueck?.focus();
    expect(document.activeElement).toBe(zurueck);
    await act(async () => {
      zurueck?.click();
    });
    expect(container?.textContent).toContain("IMPORT");
  });

  it("B4: ein laufender Lauf ist als laufend benannt und nicht als beendet", () => {
    stelle({ data: laufakte({ status: "EXTRACTING", completedAt: null }) });
    zeige(`/import/lauf/${KENNUNG}`);
    expect(q("[data-testid=w2-run]")?.getAttribute("data-run-running")).toBe("true");
    expect(q("[data-testid=w2-run]")?.getAttribute("data-run-success")).toBe("false");
    expect(q("[data-testid=imp-lauf-beendet]")?.textContent).toBe(
      i18n.t("imp.lauf.nochNichtBeendet"),
    );
  });

  it("B5: 404 — kein Zustand, kein Zähler, eine Statusmeldung; die Kennung bleibt sichtbar", () => {
    stelle({ data: undefined, isError: true, error: new ApiError(404, "NOT_FOUND", "x") });
    zeige(`/import/lauf/${KENNUNG}`);
    const meldung = q("[data-testid=imp-lauf-nicht-gefunden]");
    // `<output>` hat die eingebaute Rolle `status` (HTML-AAM) — dieselbe Ansage, ohne Rollenattribut.
    // Eine von Hand gesetzte, abweichende Rolle würde die eingebaute überschreiben; deshalb steht
    // zusätzlich fest, dass keine gesetzt ist.
    expect(meldung?.tagName).toBe("OUTPUT");
    expect(meldung?.hasAttribute("role")).toBe(false);
    expect(meldung?.textContent).toBe(i18n.t("imp.lauf.nichtGefunden"));
    expect(q("[data-testid=w2-run]")).toBeNull();
    expect(q("[data-testid=imp-lauf-zaehler]")).toBeNull();
    expect(q("[data-testid=imp-lauf-kennung]")?.textContent).toBe(KENNUNG);
  });

  it("B6: lädt noch — der vorhandene Ladehinweis, kein Zustand und kein Zähler", () => {
    stelle({ data: undefined, isFetching: true });
    zeige(`/import/lauf/${KENNUNG}`);
    expect(q("[data-testid=imp-groups-run-outcome]")?.textContent).toBe(
      i18n.t("imp.groups.runOutcomeLoading"),
    );
    expect(q("[data-testid=w2-run]")).toBeNull();
    expect(q("[data-testid=imp-lauf-zaehler]")).toBeNull();
  });
});

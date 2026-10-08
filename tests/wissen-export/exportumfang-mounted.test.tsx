// @vitest-environment jsdom
// ================================================================================================
// aufnahme:20260922:gesamt-wissen-export — DER EXPORTUMFANG STEHT VOR DEM DOWNLOAD (N-0082),
// DIE AUSWAHL GEHT BIS IN DIE EXPORTADRESSE (R-0681 / FR-LIB-02).
// ================================================================================================
//
// Befund N-0082: bei gefiltertem eigenem offenem Treffer enthielt der JSON-Download fünf andere
// Einträge und den sichtbaren Treffer nicht; das Menü nannte nur Formate. Gemessen wird hier an der
// gemounteten `BibliothekFlaeche` (nur der Datenabruf ist ersetzt, Bauform wie
// `tests/bibliothek-suchraum/risiko-speicherumfang-auswahl-mounted.test.tsx`):
//   U1  Vorgabe Gesamtbestand: Satz nennt „alle validierten … unabhängig von Suche und Filter",
//       Adresse ohne `ids` (Kalibrierung: der bisherige Weg bleibt).
//   U2  „Aktuelle Treffer": die Adresse trägt genau die validierten Treffer; der Satz nennt, wie
//       viele nicht validierte nicht mitgehen.
//   U3  Der Befundfall: nur ein offener Treffer sichtbar ⇒ der Satz sagt, dass nichts exportiert
//       würde, und es gibt keinen Formatlink, der stattdessen fremde Einträge lieferte.
//   U4  „Markierte Einträge" erscheint erst mit Markierung und exportiert genau sie.
//   U5  rein: über dem Deckel kein Link, kein stilles Abschneiden.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";

// BEN-NACHARBEIT: die angemeldete Rolle ist steuerbar — dieselbe, an der der Server
// `includeConfidential` bindet.
const session = vi.hoisted(() => ({ role: "experte" }));

function ko(
  id: string,
  title: string,
  status: "offen" | "validiert",
  extra: Record<string, unknown> = {},
): KnowledgeObject {
  return {
    id,
    title,
    statement: "Wartung",
    type: "best_practice",
    category: "Anlage A",
    tags: ["Wartung"],
    status,
    author: "u2",
    originalAuthor: "u2",
    assignments: [],
    neededValidations: 2,
    asset: null,
    trust: 50,
    confidence: 0,
    version: 1,
    conditions: [],
    measures: [],
    createdAt: "2026-08-20T00:00:00.000Z",
    history: [{ version: 1, author: "u2", at: "2026-08-20T00:00:00.000Z", note: "erstellt" }],
    ...extra,
  } as unknown as KnowledgeObject;
}

// `vg` ist validiert, vertraulich und vom angemeldeten Nutzer selbst verfasst — der Experte SIEHT
// ihn (Autorregel, services/app/src/sichtbarkeit.ts), der Export liefert ihn ihm nicht.
const KOS: KnowledgeObject[] = [
  ko("v1", "A Ventil freigegeben", "validiert"),
  ko("v2", "B Ventil freigegeben", "validiert"),
  ko("o1", "C Ventil offen", "offen"),
  ko("vg", "D Ventil vertraulich eigen", "validiert", {
    author: "u1",
    originalAuthor: "u1",
    confidentiality: "vertraulich",
  }),
];

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({
    data,
    isLoading: false,
    isError: false,
    isRefetchError: false,
    isFetching: false,
    isStale: false,
    fetchStatus: "idle",
    dataUpdatedAt: 100,
    refetch: async () => ({}),
  });
  return {
    useKos: () => ok(KOS),
    useLibrarySearch: () => ok(KOS),
    useConflicts: () => ok([]),
    useDirectory: () => ok([]),
    useKo: () => ({ ...ok(undefined), isLoading: true }),
    useEigeneBefunde: () => ok([]),
    useAudit: () => ok([]),
    koQueryKey: (id: string) => ["ko", id],
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: session.role } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: session.role }),
}));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { BibliothekFlaeche } from "../../apps/web/src/components/bibliothek/BibliothekFlaeche";
import i18n from "../../apps/web/src/i18n";
import {
  EXPORT_AUSWAHL_MAX,
  darfVertraulichExportieren,
  exportMoeglich,
  exportUmfang,
  exportUrl,
} from "../../apps/web/src/lib/libraryExport";
import { menueOeffnen } from "../library/support/bib-flaeche";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

function mount(entry = "/bibliothek"): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    neu.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [entry] }, createElement(BibliothekFlaeche)),
      ),
    );
  });
}

const MENUE = "bib-liste-menue";

function element(testId: string): HTMLElement | null {
  return menueOeffnen(container, MENUE).querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

function klicke(testId: string): void {
  const el = element(testId);
  if (!el) throw new Error(`„${testId}" fehlt im Menü`);
  act(() => {
    el.click();
  });
}

const satz = (): string => element("bib-export-umfang-satz")?.textContent ?? "";
const jsonLink = (): string | null => element("bib-export-json")?.getAttribute("href") ?? null;
const idsAus = (href: string | null): string[] => {
  const roh = new URLSearchParams((href ?? "").split("?")[1] ?? "").get("ids");
  return roh === null ? [] : roh.split(",").sort();
};

beforeEach(async () => {
  await i18n.changeLanguage("de");
  session.role = "experte";
  window.localStorage.clear();
});
afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
});

describe("N-0082 · der Exportumfang steht vor dem Download", () => {
  it("U1 · Vorgabe Gesamtbestand: Satz und Adresse wie bisher", () => {
    mount();
    expect(element("bib-export-umfang-bestand")?.getAttribute("aria-checked")).toBe("true");
    expect(satz()).toBe(String(i18n.t("wissenexport.umfang.bestandSatz")));
    expect(satz()).toContain("unabhängig von Suche und Filter");
    expect(jsonLink()).toBe("/api/library/export");
    expect(element("bib-export-markdown")?.getAttribute("href")).toBe(
      "/api/library/export?format=markdown",
    );
  });

  it("U2 · „Aktuelle Treffer“: nur validierte Treffer in der Adresse, Rest benannt", () => {
    mount();
    klicke("bib-export-umfang-treffer");
    expect(element("bib-export-umfang-treffer")?.getAttribute("aria-checked")).toBe("true");
    // Experte: der eigene vertrauliche `vg` ist sichtbar, geht aber nicht in die Datei.
    expect(idsAus(jsonLink())).toEqual(["v1", "v2"]);
    expect(element("bib-export-html")?.getAttribute("href")).toContain("format=html&ids=");
    expect(satz()).toContain("2 von 4");
    expect(satz()).toContain("1 nicht validiert, 1 vertraulich ohne Prüfrecht");
  });

  it("U3 · Befundfall: nur ein offener Treffer ⇒ „nichts zu exportieren“, kein Formatlink", () => {
    mount("/bibliothek?zustand=offen");
    klicke("bib-export-umfang-treffer");
    expect(satz()).toContain("Keiner der 1 gewählten Einträge geht in die Datei");
    expect(satz()).toContain("Nicht validiert: 1");
    expect(element("bib-export-json")).toBeNull();
    // Der Gesamtbestand bleibt wählbar — und sagt wieder, was er ist.
    klicke("bib-export-umfang-bestand");
    expect(jsonLink()).toBe("/api/library/export");
  });

  it("U4 · „Markierte Einträge“ erst mit Markierung; exportiert genau sie", () => {
    mount();
    expect(element("bib-export-umfang-markiert")).toBeNull();
    klicke("bib-auswahl-modus");
    const box = container.querySelector<HTMLInputElement>(
      '[data-testid="bib-zeile-markieren"][data-bib-id="v2"]',
    );
    if (!box) throw new Error("Markierfeld für v2 fehlt");
    act(() => {
      box.click();
    });
    expect(element("bib-export-umfang-markiert")?.textContent).toContain("(1)");
    klicke("bib-export-umfang-markiert");
    expect(idsAus(jsonLink())).toEqual(["v2"]);
    expect(satz()).toContain("1 von 1");
  });

  // BEN-NACHARBEIT (N-0082): der Gegenfall, den das Menü zuvor falsch versprach („1 von 1" für
  // eine Datei, die der Server leer ausliefert).
  function markiere(id: string): void {
    klicke("bib-auswahl-modus");
    const box = container.querySelector<HTMLInputElement>(
      `[data-testid="bib-zeile-markieren"][data-bib-id="${id}"]`,
    );
    if (!box) throw new Error(`Markierfeld für ${id} fehlt`);
    act(() => {
      box.click();
    });
    klicke("bib-export-umfang-markiert");
  }

  it("U6 · Experte, eigener validierter vertraulicher Eintrag markiert ⇒ nichts, kein Link", () => {
    mount();
    markiere("vg");
    expect(satz()).toContain("Keiner der 1 gewählten Einträge geht in die Datei");
    expect(satz()).toContain("vertraulich ohne Prüfrecht (Controller, Admin): 1");
    expect(satz()).not.toContain("1 von 1");
    for (const format of ["json", "markdown", "mediawiki", "html"]) {
      expect(element(`bib-export-${format}`), format).toBeNull();
    }
  });

  it("U7 · KALIBRIERUNG Controller: derselbe Eintrag geht mit (Prüfrecht wie am Server)", () => {
    session.role = "controller";
    mount();
    markiere("vg");
    expect(idsAus(jsonLink())).toEqual(["vg"]);
    expect(satz()).toContain("1 von 1");
    expect(satz()).toContain("0 vertraulich ohne Prüfrecht");
  });

  it("U5 · EN: eigener Satz ohne deutschen Rest", async () => {
    await i18n.changeLanguage("en");
    mount();
    expect(satz()).toContain("regardless of search and filters");
    expect(satz()).not.toMatch(/validierten|Bestand/);
  });
});

describe("R-0681 · Auswahl als reine Logik", () => {
  it("exportUrl hängt die Auswahl an, ohne Auswahl bleibt die Adresse unverändert", () => {
    expect(exportUrl("json", ["a", "b"])).toBe("/api/library/export?ids=a,b");
    expect(exportUrl("mediawiki", ["a"])).toBe("/api/library/export?format=mediawiki&ids=a");
    expect(exportUrl("json")).toBe("/api/library/export");
  });

  it("vertraulich zählt wie am Server: nur mit Prüfrecht exportierbar, Grund getrennt gezählt", () => {
    const eintraege = [
      { id: "a", status: "validiert", confidentiality: "vertraulich" as const },
      { id: "b", status: "validiert", confidentiality: "streng_vertraulich" as const },
      { id: "c", status: "validiert", confidentiality: "intern" as const },
      { id: "d", status: "offen", confidentiality: "vertraulich" as const },
    ];
    const ohne = exportUmfang("markiert", eintraege, false);
    expect(ohne.ids).toEqual(["c"]);
    expect(ohne.art !== "bestand" && [ohne.nichtValidiert, ohne.vertraulichOhneRecht]).toEqual([
      1, 2,
    ]);
    const mit = exportUmfang("markiert", eintraege, true);
    expect(mit.ids).toEqual(["a", "b", "c"]);
    expect(mit.art !== "bestand" && mit.vertraulichOhneRecht).toBe(0);
    expect(exportMoeglich(exportUmfang("markiert", eintraege.slice(0, 2), false))).toBe(false);
    expect(darfVertraulichExportieren("experte")).toBe(false);
    expect(darfVertraulichExportieren("viewer")).toBe(false);
    expect(darfVertraulichExportieren(undefined)).toBe(false);
    expect(darfVertraulichExportieren("controller")).toBe(true);
    expect(darfVertraulichExportieren("admin")).toBe(true);
  });

  it("über dem Deckel: kein Export der Auswahl, kein stilles Abschneiden", () => {
    const viele = Array.from({ length: EXPORT_AUSWAHL_MAX + 1 }, (_, i) => ({
      id: `k${i}`,
      status: "validiert",
    }));
    const umfang = exportUmfang("treffer", viele);
    expect(umfang.art === "treffer" && umfang.zuViele).toBe(true);
    expect(exportMoeglich(umfang)).toBe(false);
    // Kalibrierung: genau am Deckel geht es noch.
    expect(exportMoeglich(exportUmfang("treffer", viele.slice(1)))).toBe(true);
    expect(exportMoeglich(exportUmfang("bestand", []))).toBe(true);
  });
});

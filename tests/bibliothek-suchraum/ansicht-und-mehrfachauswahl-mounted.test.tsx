// @vitest-environment jsdom
// ================================================================================================
// R-1006 (K16, BEN NACHARBEIT 7) — KOMPAKTE LISTE ODER KARTEN, UND MEHRFACHAUSWAHL VON ZEILEN.
// ================================================================================================
// Gemessen an der gemounteten `BibliothekFlaeche`, nur der Datenabruf ist ersetzt (Bauform wie
// `risiko-speicherumfang-auswahl-mounted.test.tsx`). Bedient wird über das echte Menü „…" der Liste.
//   AN1  Vorgabe ist die kompakte Liste — ohne Umschalten keine Häkchen, keine Auswahlleiste.
//   AN2  „Karten" stellt dieselben Treffer als Karten dar, wird im Browser gemerkt und gilt nach
//        einem neuen Aufbau weiter; „Kompakte Liste" kehrt zurück.
//   MA1  „Mehrere auswählen": je Treffer ein benanntes Häkchen, die Leiste zählt, ein Häkchen
//        öffnet nichts, „Auswahl aufheben" leert.
//   MA2  Gezählt wird nur, was gerade Treffer ist; eine weggefilterte Markierung kehrt zurück.
//   MA3  Verlassen des Modus nimmt Häkchen, Leiste UND Auswahl weg.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";

function ko(id: string, title: string, status: "offen" | "validiert"): KnowledgeObject {
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
  } as unknown as KnowledgeObject;
}

const KOS = [
  ko("k1", "Ventil eins", "validiert"),
  ko("k2", "Ventil zwei", "validiert"),
  ko("k3", "Ventil drei", "offen"),
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
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
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
import { gewaehlteId, menueEintrag, menueOeffnen, segment } from "../library/support/bib-flaeche";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const ANSICHT_SPEICHER = "klarwerk.library.ansicht";

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

function abbauen(): void {
  if (root) {
    const alt = root;
    act(() => alt.unmount());
    root = null;
  }
  container?.remove();
}

const spur = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="bib-spur"]');
const block = (id: string): HTMLElement | null =>
  container.querySelector<HTMLElement>(`[data-testid="bib-zeilenblock"][data-bib-id="${id}"]`);
const haekchen = (id: string): HTMLInputElement | null =>
  container.querySelector<HTMLInputElement>(
    `[data-testid="bib-zeile-markieren"][data-bib-id="${id}"]`,
  );
const anzahl = (): string =>
  container.querySelector('[data-testid="bib-auswahl-anzahl"]')?.textContent?.trim() ?? "";
const zeilenIds = (): (string | null)[] =>
  [...container.querySelectorAll('[data-testid="bib-zeile"]')].map((z) =>
    z.getAttribute("data-bib-id"),
  );

function imListenMenue(beschriftung: string): void {
  const eintrag = menueEintrag(menueOeffnen(container, "bib-liste-menue"), beschriftung);
  act(() => {
    eintrag.click();
  });
}

function klick(el: HTMLElement | null): void {
  if (!el) {
    throw new Error("Element fehlt");
  }
  act(() => {
    el.click();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
});
afterEach(() => {
  abbauen();
});

describe("R-1006 · Liste oder Karten", () => {
  it("AN1 · Vorgabe: kompakte Liste, keine Häkchen, keine Auswahlleiste", () => {
    mount();
    expect(spur()?.getAttribute("data-ansicht")).toBe("liste");
    expect(block("k1")?.className).toContain("border-b");
    expect(block("k1")?.className).not.toContain("rounded-card");
    expect(container.querySelector('[data-testid="bib-zeile-markieren"]')).toBeNull();
    expect(container.querySelector('[data-testid="bib-auswahl-leiste"]')).toBeNull();
    const menue = menueOeffnen(container, "bib-liste-menue");
    expect(
      menueEintrag(menue, String(i18n.t("lib.ansicht.liste"))).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("AN2 · Karten zeigen dieselben Treffer, bleiben nach neuem Aufbau, Liste kehrt zurück", () => {
    mount();
    const vorher = zeilenIds();
    imListenMenue(String(i18n.t("lib.ansicht.karten")));
    expect(spur()?.getAttribute("data-ansicht")).toBe("karten");
    expect(block("k1")?.className).toContain("rounded-card");
    expect(zeilenIds(), "dieselben Treffer in derselben Reihenfolge").toEqual(vorher);
    expect(window.localStorage.getItem(ANSICHT_SPEICHER)).toBe("karten");

    abbauen();
    mount();
    expect(spur()?.getAttribute("data-ansicht"), "nach neuem Aufbau gemerkt").toBe("karten");

    imListenMenue(String(i18n.t("lib.ansicht.liste")));
    expect(spur()?.getAttribute("data-ansicht")).toBe("liste");
    expect(block("k1")?.className).toContain("border-b");
  });
});

describe("R-1006 · Mehrfachauswahl von Zeilen", () => {
  it("MA1 · benannte Häkchen, Zähler, ein Häkchen öffnet nichts, Auswahl aufheben leert", () => {
    mount();
    const offen = gewaehlteId(container);
    imListenMenue(String(i18n.t("lib.auswahl.modus")));
    expect(haekchen("k1")?.getAttribute("aria-label")).toBe(
      String(i18n.t("lib.auswahl.zeile", { titel: "Ventil eins" })),
    );
    expect(anzahl()).toBe(String(i18n.t("lib.auswahl.anzahl", { count: 0 })));

    klick(haekchen("k1"));
    klick(haekchen("k3"));
    expect(anzahl()).toBe(String(i18n.t("lib.auswahl.anzahl", { count: 2 })));
    expect(haekchen("k1")?.checked).toBe(true);
    expect(haekchen("k2")?.checked).toBe(false);
    expect(block("k3")?.getAttribute("data-markiert")).toBe("true");
    expect(gewaehlteId(container), "ein Häkchen öffnet keinen Eintrag").toBe(offen);

    klick(container.querySelector<HTMLElement>('[data-testid="bib-auswahl-leeren"]'));
    expect(anzahl()).toBe(String(i18n.t("lib.auswahl.anzahl", { count: 0 })));
    expect(haekchen("k1")?.checked).toBe(false);
  });

  it("MA2 · gezählt wird nur, was Treffer ist; die weggefilterte Markierung kehrt zurück", () => {
    mount();
    imListenMenue(String(i18n.t("lib.auswahl.modus")));
    klick(haekchen("k1"));
    klick(haekchen("k3"));
    segment(container, "offen");
    expect(zeilenIds()).toEqual(["k3"]);
    expect(anzahl()).toBe(String(i18n.t("lib.auswahl.anzahl", { count: 1 })));
    segment(container, "alle");
    expect(anzahl()).toBe(String(i18n.t("lib.auswahl.anzahl", { count: 2 })));
    expect(haekchen("k1")?.checked).toBe(true);
  });

  it("MA3 · Modus verlassen nimmt Häkchen, Leiste und Auswahl weg", () => {
    mount();
    imListenMenue(String(i18n.t("lib.auswahl.modus")));
    klick(haekchen("k2"));
    imListenMenue(String(i18n.t("lib.auswahl.modus")));
    expect(container.querySelector('[data-testid="bib-zeile-markieren"]')).toBeNull();
    expect(container.querySelector('[data-testid="bib-auswahl-leiste"]')).toBeNull();
    imListenMenue(String(i18n.t("lib.auswahl.modus")));
    expect(haekchen("k2")?.checked, "keine verborgene Altauswahl").toBe(false);
    expect(anzahl()).toBe(String(i18n.t("lib.auswahl.anzahl", { count: 0 })));
  });

  it("EN/NL tragen eigene Texte", () => {
    for (const sprache of ["en", "nl"] as const) {
      for (const schluessel of [
        "lib.ansicht.label",
        "lib.ansicht.liste",
        "lib.ansicht.karten",
        "lib.auswahl.modus",
        "lib.auswahl.leeren",
        "lib.auswahl.zeile",
      ]) {
        const wert = i18n.getResource(sprache, "translation", schluessel) as unknown;
        expect(typeof wert, `${sprache} · ${schluessel}`).toBe("string");
        expect(wert, `${sprache} · ${schluessel}`).not.toBe(
          i18n.getResource("de", "translation", schluessel),
        );
      }
    }
  });
});

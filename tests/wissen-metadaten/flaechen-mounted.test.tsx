// @vitest-environment jsdom
// ================================================================================================
// aufnahme:20260922:gesamt-wissen-metadaten — DIE FLÄCHEN DIESES AUFTRAGS, GEMOUNTET.
// ================================================================================================
// Gemessen an den echten Komponenten (nur der Datenabruf ist ersetzt, wie in
// `tests/bibliothek-suchraum/fachgebiet-facette-mounted.test.tsx`):
//   A1  Vom Gerät zum Wissen (R-0477): die Bibliothek grenzt über das Menü „Filter" → „Anlage" auf
//       die Objekte ein, deren kanonisches Feld `asset` diese Anlage nennt — unabhängig von
//       Kategorie und Fachgebiet; Objekte ohne Anlage sind nie dabei.
//   A2  Die Adresse trägt die Anlagenauswahl (`?asset=…`).
//   F1  Das Fachgebiet ist nachträglich setzbar (R-0034, R-0465): das Feld zeigt den gespeicherten
//       Wert, gibt erst nach einer Änderung frei und reicht den bereinigten Wert weiter.
//   F2  Ohne Recht: nur die Anzeige, kein Eingabefeld.
//   W1  Die fünf Wissensarten sind optisch unterscheidbar (R-0042, R-1701): fünf verschiedene
//       Zeichen und fünf verschiedene Bezeichnungen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";

function ko(
  id: string,
  title: string,
  asset: string | null,
  domain?: string,
  assets?: string[],
): KnowledgeObject {
  return {
    id,
    title,
    statement: "Wartung",
    type: "best_practice",
    category: "Anlage A",
    ...(domain ? { domain } : {}),
    ...(assets ? { assets } : {}),
    tags: ["Wartung"],
    status: "validiert",
    author: "u2",
    originalAuthor: "u2",
    assignments: [],
    neededValidations: 2,
    asset,
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
  // R-0082: k1 hängt an ZWEI Anlagen (kanonische Liste), die übrigen tragen Altbestand-Einzelwerte.
  ko("k1", "Pumpe entlüften", "DP-4", "Verfahrenstechnik", ["DP-4", "FB-2"]),
  ko("k2", "Membran prüfen", "DP-4"),
  ko("k3", "Förderband spannen", "FB-2", "Verfahrenstechnik"),
  ko("k4", "Allgemeiner Hinweis", null),
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
import { AnlagenFeld } from "../../apps/web/src/components/Anlagen";
import { FachgebietFeld } from "../../apps/web/src/components/Fachgebiet";
import { BibliothekFlaeche } from "../../apps/web/src/components/bibliothek/BibliothekFlaeche";
import { KNOWLEDGE_TYPES, KnowledgeTypeTag } from "../../apps/web/src/components/trust";
import i18n from "../../apps/web/src/i18n";
import { listenZaehler, menueOeffnen, tippe, waehleImMenue } from "../library/support/bib-flaeche";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

function render(element: ReturnType<typeof createElement>): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  act(() => {
    neu.render(element);
  });
}

function mountBibliothek(entry = "/bibliothek"): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(MemoryRouter, { initialEntries: [entry] }, createElement(BibliothekFlaeche)),
    ),
  );
}

const sortiert = (): (string | null)[] =>
  [...container.querySelectorAll('[data-testid="bib-zeile"]')]
    .map((z) => z.getAttribute("data-bib-id"))
    .sort();

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
});
afterEach(() => {
  if (root) {
    const alt = root;
    act(() => alt.unmount());
    root = null;
  }
  container?.remove();
});

describe("R-0477 · vom Gerät zum Wissen — die Anlage als Facette der Bibliothek", () => {
  it("A1 · Auswahl im Menü grenzt auf die Objekte dieser Anlage ein; ohne Anlage nie dabei", () => {
    mountBibliothek();
    expect(sortiert()).toEqual(["k1", "k2", "k3", "k4"]);
    const filter = menueOeffnen(container, "bib-menue-filter");
    expect(filter.textContent).toContain(String(i18n.t("wissensmetadaten.anlage.facette")));

    // Der Menüeintrag lautet „<Wert> · <Zahl>"; mit dem Trenner ist der Anfang eindeutig.
    waehleImMenue(container, "bib-menue-filter", "DP-4 · ");
    expect(sortiert(), "beide Objekte an DP-4 — gleich welches Fachgebiet").toEqual(["k1", "k2"]);
    expect(listenZaehler(container)).toBe(2);
  });

  it("A2 · die Adresse trägt die Anlagenauswahl — ein Objekt mit zwei Anlagen steht unter beiden", () => {
    mountBibliothek("/bibliothek?asset=FB-2");
    expect(sortiert()).toEqual(["k1", "k3"]);
  });

  it("M1 · die Anlagen-Matrix aus dem Menü zeigt die Zuordnung n:m über die sichtbaren Treffer", () => {
    mountBibliothek();
    const menue = menueOeffnen(container, "bib-liste-menue");
    const punkt = menue.querySelector<HTMLButtonElement>('[data-testid="bib-anlagen-matrix"]');
    if (!punkt) {
      throw new Error("Menüpunkt „Anlagen-Matrix“ fehlt");
    }
    act(() => punkt.click());
    const matrix = document.querySelector('[data-testid="anlagen-matrix"]');
    if (!matrix) {
      throw new Error("Anlagen-Matrix wurde nicht geöffnet");
    }
    const spalten = [...matrix.querySelectorAll('[data-testid="anlagen-matrix-spalte"]')].map(
      (s) => s.textContent,
    );
    expect(spalten).toEqual(["DP-4", "FB-2"]);
    const zeilen = [...matrix.querySelectorAll('[data-testid="anlagen-matrix-zeile"]')];
    // Ohne Anlage (k4) keine Zeile.
    expect(zeilen.map((z) => z.getAttribute("data-ko-id")).sort()).toEqual(["k1", "k2", "k3"]);
    const trefferJeZeile = (id: string): number => {
      const zeile = zeilen.find((z) => z.getAttribute("data-ko-id") === id);
      return zeile?.querySelectorAll('[data-testid="anlagen-matrix-treffer"]').length ?? 0;
    };
    expect(trefferJeZeile("k1"), "k1 hängt an zwei Anlagen").toBe(2);
    expect(trefferJeZeile("k2")).toBe(1);
    const anzahl = [...matrix.querySelectorAll('[data-testid="anlagen-matrix-anzahl"]')].map(
      (z) => z.textContent,
    );
    expect(anzahl, "DP-4 an zwei Objekten, FB-2 an zwei Objekten").toEqual(["2", "2"]);
  });

  it("M2 · die Matrix folgt der Eingrenzung — ausgefilterte Objekte erscheinen nicht", () => {
    mountBibliothek("/bibliothek?asset=FB-2");
    const menue = menueOeffnen(container, "bib-liste-menue");
    act(() => {
      menue.querySelector<HTMLButtonElement>('[data-testid="bib-anlagen-matrix"]')?.click();
    });
    const zeilen = [...document.querySelectorAll('[data-testid="anlagen-matrix-zeile"]')];
    expect(zeilen.map((z) => z.getAttribute("data-ko-id")).sort()).toEqual(["k1", "k3"]);
  });
});

describe("R-0082 · die Anlagenliste am Objekt ändern", () => {
  it("L1 · zeigt die Liste, gibt erst nach Änderung frei und reicht die bereinigte Liste weiter", () => {
    const gespeichert: string[][] = [];
    render(
      createElement(AnlagenFeld, {
        ko: { asset: "DP-4", assets: ["DP-4", "FB-2"] },
        darfAendern: true,
        wartet: false,
        onSpeichern: (anlagen: string[]) => gespeichert.push(anlagen),
      }),
    );
    const liste = [...container.querySelectorAll('[data-testid="ko-anlagen-liste"] li')].map(
      (li) => li.textContent,
    );
    expect(liste).toEqual(["DP-4", "FB-2"]);
    const knopf = container.querySelector<HTMLButtonElement>(
      '[data-testid="ko-anlagen-speichern"]',
    );
    const feld = container.querySelector<HTMLInputElement>('[data-testid="ko-anlagen-eingabe"]');
    if (!knopf || !feld) {
      throw new Error("Anlagenfeld nicht gerendert");
    }
    expect(knopf.disabled).toBe(true);
    tippe(feld, " DP-4 ; PR-7;DP-4 ");
    expect(knopf.disabled).toBe(false);
    act(() => knopf.click());
    expect(gespeichert).toEqual([["DP-4", "PR-7"]]);
  });

  it("L3 · eine Kennung mit Semikolon bleibt beim Öffnen und Speichern EINE Anlage", () => {
    const gespeichert: string[][] = [];
    render(
      createElement(AnlagenFeld, {
        ko: { asset: "Linie;Station" },
        darfAendern: true,
        wartet: false,
        onSpeichern: (anlagen: string[]) => gespeichert.push(anlagen),
      }),
    );
    const liste = [...container.querySelectorAll('[data-testid="ko-anlagen-liste"] li')].map(
      (li) => li.textContent,
    );
    expect(liste).toEqual(["Linie;Station"]);
    const knopf = container.querySelector<HTMLButtonElement>(
      '[data-testid="ko-anlagen-speichern"]',
    );
    const feld = container.querySelector<HTMLInputElement>('[data-testid="ko-anlagen-eingabe"]');
    if (!knopf || !feld) {
      throw new Error("Anlagenfeld nicht gerendert");
    }
    // Wiederöffnet zeigt das Feld die maskierte Form — und gilt als UNVERÄNDERT.
    expect(feld.value).toBe("Linie\\;Station");
    expect(knopf.disabled).toBe(true);
    tippe(feld, `${feld.value}; DP-4`);
    act(() => knopf.click());
    expect(gespeichert).toEqual([["Linie;Station", "DP-4"]]);
  });

  it("L2 · Altbestand mit nur `asset` zeigt seine Einzelzuordnung", () => {
    render(
      createElement(AnlagenFeld, {
        ko: { asset: "DP-4" },
        darfAendern: false,
        wartet: false,
        onSpeichern: () => {},
      }),
    );
    const liste = [...container.querySelectorAll('[data-testid="ko-anlagen-liste"] li')].map(
      (li) => li.textContent,
    );
    expect(liste).toEqual(["DP-4"]);
    expect(container.querySelector('[data-testid="ko-anlagen-eingabe"]')).toBeNull();
  });
});

describe("R-0034 / R-0465 · das Fachgebiet nachträglich setzen", () => {
  it("F1 · zeigt den gespeicherten Wert, gibt erst nach Änderung frei, reicht den bereinigten Wert weiter", () => {
    const gespeichert: string[] = [];
    render(
      createElement(FachgebietFeld, {
        domain: "Instandhaltung",
        darfAendern: true,
        wartet: false,
        onSpeichern: (wert: string) => gespeichert.push(wert),
      }),
    );
    expect(container.querySelector('[data-testid="ko-fachgebiet-wert"]')?.textContent).toBe(
      "Instandhaltung",
    );
    const knopf = container.querySelector<HTMLButtonElement>(
      '[data-testid="ko-fachgebiet-speichern"]',
    );
    expect(knopf?.disabled, "unverändert ist nichts zu speichern").toBe(true);
    const feld = container.querySelector<HTMLInputElement>('[data-testid="ko-fachgebiet-eingabe"]');
    if (!feld || !knopf) {
      throw new Error("Fachgebietsfeld nicht gerendert");
    }
    tippe(feld, "  Qualität ");
    expect(knopf.disabled).toBe(false);
    act(() => knopf.click());
    expect(gespeichert).toEqual(["Qualität"]);
  });

  it("F1b · ohne gespeicherten Wert sagt das Feld das, statt etwas abzuleiten", () => {
    render(
      createElement(FachgebietFeld, {
        domain: undefined,
        darfAendern: true,
        wartet: false,
        onSpeichern: () => {},
      }),
    );
    expect(container.querySelector('[data-testid="ko-fachgebiet-wert"]')?.textContent).toBe(
      String(i18n.t("wissensmetadaten.fachgebiet.keins")),
    );
  });

  it("F2 · ohne Recht nur die Anzeige", () => {
    render(
      createElement(FachgebietFeld, {
        domain: "Instandhaltung",
        darfAendern: false,
        wartet: false,
        onSpeichern: () => {},
      }),
    );
    expect(container.querySelector('[data-testid="ko-fachgebiet-eingabe"]')).toBeNull();
    expect(container.querySelector('[data-testid="ko-fachgebiet-speichern"]')).toBeNull();
  });
});

describe("R-0042 / R-1701 · die fünf Wissensarten sind optisch unterscheidbar", () => {
  it("W1 · fünf verschiedene Kennzeichnungen", () => {
    render(
      createElement(
        "div",
        null,
        ...KNOWLEDGE_TYPES.map((typ) => createElement(KnowledgeTypeTag, { key: typ, type: typ })),
      ),
    );
    const zeichen = [...container.querySelectorAll('span[aria-hidden="true"]')].map(
      (s) => s.textContent?.trim() ?? "",
    );
    const bezeichnungen = KNOWLEDGE_TYPES.map((typ) => String(i18n.t(`ktype.${typ}`)));
    expect(KNOWLEDGE_TYPES).toHaveLength(5);
    expect(new Set(zeichen).size, `Zeichen: ${zeichen.join(" | ")}`).toBe(5);
    expect(new Set(bezeichnungen).size, `Bezeichnungen: ${bezeichnungen.join(" | ")}`).toBe(5);
    expect(container.textContent).toContain(String(i18n.t("ktype.negativwissen")));
  });
});

// @vitest-environment jsdom
// ================================================================================================
// ADMIN-11 · WISSENSKENNZAHLEN — DIE FLÄCHE, GEMOUNTET, MIT FIKTIVER ANTWORT.
// ================================================================================================
//
// produkt:20261009:admin-wissenskennzahlen. Gefahren wird die echte Komponente `Wissenskennzahlen`
// (oben auf `/analytics`) gegen einen ersetzten Draht. Belegt wird, was die Oberfläche aus der
// Antwort macht:
//   M1  Handlungsbedarf steht VOR den Zeitraumzahlen; jede Zahl trägt ihre Lage sichtbar, und die
//       Berechnung (Bedeutung, Grundmenge, Zeitraum, Datenstand) steht zugeklappt darunter (K1, K2).
//   M2  Detailliste = die gezählten Vorgänge, mit Weg in die Arbeit und in die Arbeitsliste; mit
//       Teamfilter steht die Liste nur hier (K3, K4).
//   M3  Auswahl in der Adresse: ein Wechsel lädt mit genau dieser Auswahl neu (K3).
//   M4  Fehlendes Recht und nicht wählbarer Filter sind verständliche Zustände (K5).
//   M5  Export lädt dieselbe Antwort als Datei mit Stand und Auswahl im Namen (K6).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Wissenskennzahlen as Antwort } from "../../apps/web/src/api/wissenskennzahlen";

const d = vi.hoisted(() => ({
  aufrufe: [] as unknown[],
  antwort: null as unknown,
  fehler: null as unknown,
}));

vi.mock("../../apps/web/src/api/wissenskennzahlen", async (original) => {
  const echt = await original<typeof import("../../apps/web/src/api/wissenskennzahlen")>();
  return {
    ...echt,
    wissenskennzahlenApi: {
      laden: vi.fn(async (auswahl: unknown) => {
        d.aufrufe.push(auswahl);
        if (d.fehler) {
          throw d.fehler;
        }
        return d.antwort;
      }),
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { ApiError } from "../../apps/web/src/api/client";
import { Wissenskennzahlen } from "../../apps/web/src/components/Wissenskennzahlen";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STAND = "2026-10-09T12:00:00.000Z";

function antwort(teil: Partial<Antwort> = {}): Antwort {
  return {
    stand: STAND,
    anfrage: { tage: 7, space: null, team: null },
    zeitraum: { von: "2026-10-02T12:00:00.000Z", bis: STAND },
    vorperiode: { von: "2026-09-25T12:00:00.000Z", bis: "2026-10-02T12:00:00.000Z" },
    handlungsbedarf: [
      {
        schluessel: "pruefung",
        art: "momentaufnahme",
        einheit: "anzahl",
        wert: 2,
        zaehler: null,
        nenner: null,
        lage: "gemessen",
        erhobenSeit: null,
        trend: null,
        trendGrund: "momentaufnahme",
        arbeitsliste: "/qualitaetsaufgaben?typ=pruefung",
        eintraege: [
          {
            schluessel: "pruefung:ko-1",
            typ: "pruefung",
            zustand: "offen",
            titel: "Fiktiv: Pumpe P-7 entlüften",
            arbeitsweg: "/wissen/ko-1",
            spaces: [],
            seit: null,
            ueberfaellig: false,
          },
          {
            schluessel: "pruefung:ko-2",
            typ: "pruefung",
            zustand: "in_arbeit",
            titel: "Fiktiv: Lager L-3 fetten",
            arbeitsweg: "/wissen/ko-2",
            spaces: [],
            seit: null,
            ueberfaellig: true,
          },
        ],
      },
      {
        schluessel: "luecke",
        art: "momentaufnahme",
        einheit: "anzahl",
        wert: 0,
        zaehler: null,
        nenner: null,
        lage: "gemessen",
        erhobenSeit: null,
        trend: null,
        trendGrund: "momentaufnahme",
        arbeitsliste: "/qualitaetsaufgaben?typ=luecke",
        eintraege: [],
      },
      {
        schluessel: "konflikt",
        art: "momentaufnahme",
        einheit: "anzahl",
        wert: null,
        zaehler: null,
        nenner: null,
        lage: "unbekannt",
        erhobenSeit: null,
        trend: null,
        trendGrund: "unbekannt",
        arbeitsliste: null,
      },
    ],
    nutzung: [
      {
        schluessel: "fragen",
        art: "zeitraum",
        einheit: "anzahl",
        wert: 4,
        zaehler: null,
        nenner: null,
        lage: "gemessen",
        erhobenSeit: "2026-09-20T08:00:00.000Z",
        trend: { vorher: 2, differenz: 2 },
        trendGrund: "verglichen",
        arbeitsliste: null,
      },
      {
        schluessel: "antwortquote",
        art: "zeitraum",
        einheit: "prozent",
        wert: null,
        zaehler: 0,
        nenner: 0,
        lage: "gemessen",
        erhobenSeit: "2026-09-20T08:00:00.000Z",
        trend: null,
        trendGrund: "nenner_null",
        arbeitsliste: null,
      },
      {
        schluessel: "neue_luecken",
        art: "zeitraum",
        einheit: "anzahl",
        wert: 1,
        zaehler: null,
        nenner: null,
        lage: "unvollstaendig",
        erhobenSeit: null,
        trend: null,
        trendGrund: "vorperiode_unvollstaendig",
        // Nacharbeit 3: dieselbe Menge wie die Zahl, kein Weg in eine anders gefilterte Liste.
        arbeitsliste: null,
        eintraege: [
          {
            schluessel: "luecke:gap-zu",
            typ: "luecke",
            zustand: "erledigt",
            titel: null,
            arbeitsweg: "/risiko?fall=gap-zu",
            spaces: [],
            seit: "2026-10-05T08:00:00.000Z",
            ueberfaellig: false,
          },
        ],
      },
    ],
    bedarf: {
      lage: "gemessen",
      offen: 1,
      ohneZaehlung: 0,
      eintraege: [
        {
          lueckeId: "gap-1",
          frage: null,
          haeufigkeit: 3,
          zugeordnet: false,
          seit: "2026-10-01T08:00:00.000Z",
          arbeitsweg: "/risiko?fall=gap-1",
          vorgang: "luecke:gap-1",
        },
      ],
    },
    suche: {
      lage: "gemessen",
      deckel: 20,
      zuordnung: "bekannt",
      eintraege: [
        {
          begriff: "Fiktiv Anzugswert Mutter M-77",
          anzahl: 2,
          zuletzt: "2026-10-08T08:00:00.000Z",
          eingrenzung: {},
          vorgang: { schluessel: "luecke:gap-1", arbeitsweg: "/risiko?fall=gap-1" },
        },
        {
          begriff: "Fiktiv Ölwechsel Getriebe G-2",
          anzahl: 1,
          zuletzt: "2026-10-07T08:00:00.000Z",
          eingrenzung: { type: "best_practice" },
          vorgang: null,
        },
      ],
    },
    filterwerte: {
      spaces: [{ id: "space-a", name: "Fiktiv Montage" }],
      teams: [{ id: "team-1", name: "Fiktiv Team Montage", spaces: ["space-a"] }],
    },
    quellen: { vorgaenge: "teilweise", fragen: "ok", luecken: "ok" },
    ...teil,
  };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Zeigt die aktuelle Adresse — so wird belegt, dass die Auswahl dort steht. */
function Adresse(): JSX.Element {
  const ort = useLocation();
  return createElement("output", { "data-testid": "adresse" }, `${ort.pathname}${ort.search}`);
}

async function mount(start = "/analytics?tage=7"): Promise<void> {
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
          MemoryRouter,
          { initialEntries: [start] },
          createElement(Wissenskennzahlen),
          createElement(Adresse),
        ),
      ),
    );
  });
  await act(flush);
}

const de = (k: string, o: Record<string, unknown> = {}): string => i18n.getFixedT("de")(k, o);
const karte = (s: string): HTMLElement | null =>
  container.querySelector<HTMLElement>(`[data-testid="wkz-kennzahl"][data-schluessel="${s}"]`);

beforeEach(async () => {
  d.aufrufe.length = 0;
  d.antwort = antwort();
  d.fehler = null;
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

describe("ADMIN-11 · M1 · Handlungsbedarf zuerst, jede Zahl mit sichtbarer Lage", () => {
  it("Reihenfolge, Lage-Etiketten und erreichbare Berechnung", async () => {
    await mount();
    const handlung = container.querySelector('[data-testid="wkz-handlungsbedarf"]');
    const nutzung = container.querySelector('[data-testid="wkz-nutzung"]');
    expect(handlung).not.toBeNull();
    expect(nutzung).not.toBeNull();
    // Handlungsbedarf steht im Dokument VOR den Zeitraumzahlen.
    const lage = (handlung as Node).compareDocumentPosition(nutzung as Node);
    expect(lage & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Null, unbekannt, nicht berechenbar, unvollständig: vier sichtbar verschiedene Zustände.
    expect(karte("luecke")?.dataset.anzeige).toBe("zahl");
    expect(karte("luecke")?.querySelector('[data-testid="wkz-wert"]')?.textContent).toBe("0");
    expect(karte("konflikt")?.dataset.anzeige).toBe("unbekannt");
    expect(karte("konflikt")?.querySelector('[data-testid="wkz-wert"]')?.textContent).toBe("—");
    expect(karte("konflikt")?.textContent).toContain(de("wkz.anzeige.unbekannt"));
    expect(karte("antwortquote")?.dataset.anzeige).toBe("nicht_berechenbar");
    expect(karte("antwortquote")?.textContent).toContain(de("wkz.anzeige.nicht_berechenbar"));
    expect(karte("neue_luecken")?.dataset.anzeige).toBe("unvollstaendig");
    expect(karte("neue_luecken")?.textContent).toContain(de("wkz.erhoben.keins"));

    // Trend nur, wo verglichen wurde — mit Vorzeichen und Vorzeitraumwert.
    expect(karte("fragen")?.querySelector('[data-testid="wkz-trend"]')?.textContent).toBe(
      de("wkz.trend.verglichen", { differenz: "+2", vorher: "2" }),
    );
    expect(karte("antwortquote")?.textContent).toContain(de("wkz.trend.nenner_null"));

    // Die Berechnung ist erreichbar, aber zugeklappt: sie verdrängt den Handlungsbedarf nicht.
    const details = karte("antwortquote")?.querySelector("details");
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain(de("wkz.k.antwortquote.bedeutung"));
    expect(details?.textContent).toContain(de("wkz.k.antwortquote.nenner"));
    expect(details?.textContent).toContain(de("wkz.details.quote", { zaehler: 0, nenner: 0 }));
    expect(details?.textContent).toContain(de("wkz.details.datenstand"));
    expect(karte("pruefung")?.querySelector("details")?.textContent).toContain(
      de("wkz.details.momentaufnahme"),
    );
    // Datenstand der Antwort steht oben; eine teilweise ausgefallene Quelle wird gesagt.
    expect(container.querySelector('[data-testid="wkz-stand"]')?.textContent).toContain("2026");
    expect(container.querySelector('[data-testid="wkz-quelle-teilweise"]')).not.toBeNull();
    // Nacharbeit 3: die eigenen Suchen ohne Treffer — Grenze erklärt, kumuliert, mit Weg zur Lücke.
    const suche = container.querySelector('[data-testid="wkz-suche"]');
    expect(suche?.getAttribute("data-lage")).toBe("gemessen");
    expect(suche?.textContent).toContain(de("wkz.suche.text", { deckel: 20 }));
    const suchen = suche?.querySelectorAll('[data-testid="wkz-suche-eintrag"]') ?? [];
    expect(suchen).toHaveLength(2);
    expect(suchen[0]?.getAttribute("data-vorgang")).toBe("luecke:gap-1");
    expect(suchen[0]?.querySelector("a")?.getAttribute("href")).toBe("/risiko?fall=gap-1");
    expect(suchen[1]?.querySelector("a")).toBeNull();
    expect(suchen[1]?.textContent).toContain(de("wkz.suche.ohneVorgang"));
    expect(suchen[1]?.textContent).toContain("type: best_practice");

    // „Neue Wissenslücken“: die Detailliste ist dieselbe Menge, ohne Weg in die Arbeitsliste.
    const neu = karte("neue_luecken");
    expect(neu?.querySelectorAll('[data-testid="wkz-eintrag"]')).toHaveLength(1);
    expect(neu?.querySelector('[data-testid="wkz-arbeitsliste"]')).toBeNull();
    expect(neu?.textContent).toContain(de("wkz.liste.nurHierZeitraum"));
  });
});

describe("ADMIN-11 · Nacharbeit 4 · Suchzuordnung: Nichttreffer und unbekannt getrennt", () => {
  it("ausgefallene Lückenquelle: Häufigkeit und Zeitpunkt bleiben, die Zuordnung heißt unbekannt", async () => {
    const ohneLuecken = antwort();
    ohneLuecken.quellen = { ...ohneLuecken.quellen, luecken: "fehler" };
    ohneLuecken.suche = {
      ...ohneLuecken.suche,
      zuordnung: "unbekannt",
      eintraege: ohneLuecken.suche.eintraege.map((e) => ({ ...e, vorgang: null })),
    };
    d.antwort = ohneLuecken;
    await mount();
    const zeilen = container.querySelectorAll('[data-testid="wkz-suche-eintrag"]');
    expect(zeilen).toHaveLength(2);
    for (const z of zeilen) {
      expect(z.querySelector("a")).toBeNull();
      expect(z.querySelector('[data-testid="wkz-suche-zuordnung"]')?.textContent).toBe(
        de("wkz.suche.zuordnungUnbekannt"),
      );
      expect(z.textContent).not.toContain(de("wkz.suche.ohneVorgang"));
    }
    // Die bekannte Häufigkeit steht weiter da — nur die Zuordnung fehlt.
    expect(zeilen[0]?.textContent).toContain("2× gesucht");
  });

  it("belegter Nichttreffer: neutral auf den sichtbaren Umfang bezogen", async () => {
    await mount();
    const zeilen = container.querySelectorAll('[data-testid="wkz-suche-eintrag"]');
    expect(zeilen[1]?.querySelector('[data-testid="wkz-suche-zuordnung"]')?.textContent).toBe(
      de("wkz.suche.ohneVorgang"),
    );
  });
});

describe("ADMIN-11 · M2 · vom Wert zur betroffenen Arbeit", () => {
  it("Detailliste = gezählte Vorgänge, Weg zum Vorgang und in die Arbeitsliste", async () => {
    await mount();
    const p = karte("pruefung");
    const zeilen = p?.querySelectorAll('[data-testid="wkz-eintrag"]') ?? [];
    expect(zeilen).toHaveLength(2);
    expect(p?.querySelector('[data-testid="wkz-liste"]')?.textContent).toBe(
      de("wkz.liste.zusammenfassung", { anzahl: 2 }),
    );
    expect(zeilen[0]?.querySelector("a")?.getAttribute("href")).toBe("/wissen/ko-1");
    expect(zeilen[1]?.textContent).toContain(de("wkz.liste.ueberfaellig"));
    expect(p?.querySelector('[data-testid="wkz-arbeitsliste"]')?.getAttribute("href")).toBe(
      "/qualitaetsaufgaben?typ=pruefung",
    );
    // Der Fragebedarf führt auf die vorhandene Lücke — ohne Fragetext.
    const bedarf = container.querySelector('[data-testid="wkz-bedarf-eintrag"]');
    expect(bedarf?.getAttribute("data-vorgang")).toBe("luecke:gap-1");
    expect(bedarf?.querySelector("a")?.getAttribute("href")).toBe("/risiko?fall=gap-1");
    expect(bedarf?.textContent).toContain(de("wkz.liste.zurueckgehalten"));
    expect(bedarf?.textContent).toContain(de("wkz.bedarf.haeufigkeit", { anzahl: 3 }));
  });

  it("mit Teamfilter steht die Liste nur hier — kein Weg in eine anders gefilterte Liste", async () => {
    const mitTeam = antwort();
    mitTeam.anfrage = { tage: 7, space: null, team: "team-1" };
    for (const k of mitTeam.handlungsbedarf) {
      k.arbeitsliste = null;
    }
    d.antwort = mitTeam;
    await mount("/analytics?tage=7&team=team-1");
    const p = karte("pruefung");
    expect(p?.querySelector('[data-testid="wkz-arbeitsliste"]')).toBeNull();
    expect(p?.textContent).toContain(de("wkz.liste.nurHier"));
  });
});

describe("ADMIN-11 · M3 · die Auswahl steht in der Adresse und lädt genau sie", () => {
  it("Space wählen: Adresse und Abruf tragen dieselbe Auswahl", async () => {
    await mount();
    expect(d.aufrufe[0]).toEqual({ tage: 7, space: null, team: null });
    const auswahl = container.querySelector<HTMLSelectElement>('[data-testid="wkz-filter-space"]');
    expect(auswahl).not.toBeNull();
    await act(async () => {
      if (auswahl) {
        auswahl.value = "space-a";
        auswahl.dispatchEvent(new Event("change", { bubbles: true }));
      }
      await flush();
    });
    expect(container.querySelector('[data-testid="adresse"]')?.textContent).toBe(
      "/analytics?tage=7&space=space-a",
    );
    expect(d.aufrufe.at(-1)).toEqual({ tage: 7, space: "space-a", team: null });
    // Zurücksetzen nimmt Space und Team heraus, der Zeitraum bleibt.
    const knopf = container.querySelector('[data-testid="wkz-filter-zuruecksetzen"]');
    await act(async () => {
      (knopf as HTMLButtonElement | null)?.click();
      await flush();
    });
    expect(container.querySelector('[data-testid="adresse"]')?.textContent).toBe(
      "/analytics?tage=7",
    );
  });
});

describe("ADMIN-11 · M4 · Recht und Filter als verständliche Zustände", () => {
  it("403: der Verwaltung vorbehalten — keine Zahlen, kein Wiederholen", async () => {
    d.fehler = new ApiError(403, "FORBIDDEN", "verboten");
    await mount();
    const zustand = container.querySelector('[data-testid="wkz-ladezustand"]');
    expect(zustand?.querySelector('[role="alert"]')?.textContent).toBe(de("wkz.recht"));
    expect(zustand?.querySelector("button")).toBeNull();
    expect(container.querySelector('[data-testid="wkz-kennzahl"]')).toBeNull();
  });

  it("400: die Auswahl ist nicht wählbar — mit Weg zurück", async () => {
    d.fehler = new ApiError(400, "BAD_REQUEST", "Dieser Space ist nicht wählbar.");
    await mount("/analytics?tage=7&space=space-fremd");
    const zustand = container.querySelector('[data-testid="wkz-ladezustand"]');
    expect(zustand?.textContent).toContain(de("wkz.filter.ungueltig"));
    expect(zustand?.querySelector("button")?.textContent).toBe(de("wkz.filter.zuruecksetzen"));
  });
});

describe("ADMIN-11 · M5 · Export der gezeigten Antwort", () => {
  it("lädt eine CSV-Datei mit Stand und Zeitraum im Namen", async () => {
    const urls: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      urls.push(b);
      return "blob:fiktiv";
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
    const namen: string[] = [];
    const klick = vi.spyOn(HTMLAnchorElement.prototype, "click");
    klick.mockImplementation(function (this: HTMLAnchorElement) {
      namen.push(this.download);
    });
    await mount();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="wkz-export"]')?.click();
    });
    expect(urls).toHaveLength(1);
    expect(urls[0]?.type).toBe("text/csv;charset=utf-8");
    expect(namen).toEqual(["wissenskennzahlen_2026-10-09_7t.csv"]);
  });
});

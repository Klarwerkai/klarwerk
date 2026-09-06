// @vitest-environment jsdom
// ================================================================================================
// JOB 3121 · UX-14 — DIE BIBLIOTHEK AUF DEM TELEFON: EINE FLÄCHE, UND EIN WEG ZURÜCK.
// ================================================================================================
//
// DER AUSGANGSFEHLER (N-0043, gemessen an 1.0.0-beta.1.131): der Container der Fläche stand
// bedingungslos auf `flex` — eine Zeile, ohne Bruchpunkt. Die Liste hält 380 px fest
// (`BibliothekListe.tsx:128`); bei 390 px blieben dem Bericht 10 px, bei 320 px keine. Wer auf dem
// Telefon einen Treffer wählte, bekam einen breitenlosen Bericht — auch nach Neuladen (N-0045,
// N-0049/N-0051 hängen am selben Engpass).
//
// GEMESSEN WIRD AN DER GEMOUNTETEN FLÄCHE, NICHT AM QUELLTEXT (Auftrag §8.1): ob eine Klasse einen
// Bruchpunkt trägt, sagt nichts darüber, WAS auf der Fläche steht. Geprüft wird deshalb, welche der
// beiden Flächen im DOM ist, was die Tastatur erreicht und wo der Fokus sitzt.
//
// DIE BREITE KOMMT AUS `matchMedia`, UND DAS IST KEIN TESTBEHELF: was schmal nicht sichtbar ist,
// darf auch nicht mit der Tastatur erreichbar sein (Lieferung 5, N-0001/0019/0031/0035). Ein
// CSS-Zweig bliebe im DOM; die Fläche entscheidet deshalb in JS, was sie baut. Gelesen wird
// `matchMedia` an der EINEN Stelle des Hauses (`shell/useMediaQuery.ts:11`) — der Stub hier zählt
// also nur, weil das Produkt wirklich dort hineingreift (BENs Auflage aus
// `tests/app/w5-konflikt-mobile-mounted.test.tsx:19-25`).
//
//   F1  schmal · Treffer gewählt      → der Bericht trägt die Fläche ALLEIN, keine Liste daneben
//   F2  schmal · der Rückweg          → sichtbar, fokussierbar, echtes <button>, führt zur Liste
//   F3  schmal · der Rückweg nimmt nichts mit — Suchbegriff, Filter, Zeilen, kein neuer Abruf
//   F4  breit  · bleibt breit         → Liste UND Bericht nebeneinander, kein Rückweg dazwischen
//   F5  schmal · ohne Wahl            → die Liste trägt die Fläche, kein leerer Bericht daneben
//   F6  schmal · keine unsichtbaren Tab-Ziele in beide Richtungen
//   F7  schmal · der Fokus geht mit — in den Bericht und zurück auf die gelesene Zeile
//   F8  schmal · gescheiterte Auffrischung → Satz UND Wiederholknopf stehen auf der Fläche, EINMAL
//   F9  Breitenwechsel ohne Neuladen (900 → 390 → 900), ohne zweiten Abruf
//   F10 die Zustandsanker (JOB 3072) bleiben in beiden Anordnungen unsichtbar
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Titel",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "validiert",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    confidentiality: "intern",
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

const KOS = [
  ko({ id: "k1", title: "Ventil X bei Überdruck schließen", category: "Anlage 1" }),
  ko({ id: "k2", title: "Rührwerk Y vor der Reinigung entlüften", category: "Anlage 1" }),
  ko({ id: "k3", title: "Pumpe Z nach dem Spülen entlüften", category: "Anlage 2" }),
];

/** Der Zeitpunkt des zuletzt ERFOLGREICHEN Abrufs — die Zahl im Auffrischungssatz stammt aus ihm. */
const ZULETZT_ERFOLGREICH = Date.parse("2026-09-06T09:30:00.000Z");

const stand = vi.hoisted(() => ({ auffrischungScheitert: false, rufe: 0 }));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ruf = () => {
    stand.rufe += 1;
    return Promise.resolve({});
  };
  const ok = <T,>(data: T) => ({
    data,
    isLoading: false,
    isError: false,
    isRefetchError: false,
    isFetching: false,
    isStale: false,
    fetchStatus: "idle",
    dataUpdatedAt: ZULETZT_ERFOLGREICH,
    error: null,
    refetch: ruf,
  });
  const alt = <T,>(data: T) => ({
    ...ok(data),
    isError: true,
    isRefetchError: true,
    error: new Error("Netz weg"),
  });
  return {
    useKos: () => (stand.auffrischungScheitert ? alt(KOS) : ok(KOS)),
    useLibrarySearch: () => (stand.auffrischungScheitert ? alt(KOS) : ok(KOS)),
    useDirectory: () => ok([{ id: "u9", name: "Eva" }]),
    useConflicts: () => ok([]),
    useEigeneBefunde: () => ok([]),
    useKo: (id: string) => ok(KOS.find((k) => k.id === id)),
    useAudit: () => ok([]),
    useReasonerStatus: () => ok({ active: false, mode: "off" }),
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
import i18n from "../../apps/web/src/i18n";
import { AUFFRISCHUNG_HINWEIS_MARKE } from "../../apps/web/src/lib/confidentiality";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---- Die Attrappe für `matchMedia` -------------------------------------------------------------
// Sie beantwortet GENAU die Abfrage der Fläche (`max-width: 759px`) und führt ihre Hörer, damit ein
// Breitenwechsel OHNE Neuladen ankommt (F9). Bauform wie `tests/wissensnetz-leseweg/leseweg.test.tsx`.
type Hoerer = () => void;
let hoerer: Hoerer[] = [];
let istSchmal = false;
function setzeBreite(schmal: boolean): void {
  hoerer = [];
  istSchmal = schmal;
  (globalThis as unknown as { matchMedia?: unknown }).matchMedia = (abfrage: string) => ({
    get matches() {
      return istSchmal && /max-width:\s*759px/.test(abfrage);
    },
    media: abfrage,
    addEventListener: (_typ: string, fn: Hoerer) => {
      hoerer.push(fn);
    },
    removeEventListener: (_typ: string, fn: Hoerer) => {
      hoerer = hoerer.filter((h) => h !== fn);
    },
  });
}
function wechsleBreite(schmal: boolean): void {
  istSchmal = schmal;
  act(() => {
    for (const h of [...hoerer]) {
      h();
    }
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function flaeche(adresse: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [adresse] }, createElement(Library)),
      ),
    );
  });
}

beforeEach(() => {
  setzeBreite(false);
  stand.auffrischungScheitert = false;
  stand.rufe = 0;
  window.localStorage.clear();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  hoerer = [];
});

function da(marke: string): HTMLElement | null {
  const el = container.querySelector(`[data-testid="${marke}"]`);
  return el instanceof HTMLElement ? el : null;
}
function zeilen(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-testid="bib-zeile"]')];
}
function rueckweg(): HTMLElement | null {
  return da("bib-zurueck");
}
function suchfeld(): HTMLInputElement {
  const el = da("bib-suche");
  if (!(el instanceof HTMLInputElement)) {
    throw new Error("Suchfeld fehlt");
  }
  return el;
}
/** Der Titel des Berichts auf der Lesefläche — nicht der Zeilentitel in der Liste. */
function leseTitel(): string {
  return (da("bib-titel")?.textContent ?? "").trim();
}
const ZURUECK_TEXT = (): string =>
  i18n.t("nb.back", { title: i18n.t("nav.library") as string }) as string;

describe("JOB 3121 · UX-14 · schmal trägt EINE Fläche", () => {
  it("F1 · schmal mit gewähltem Treffer: der Bericht trägt die Fläche allein, die Liste steht nicht daneben", () => {
    setzeBreite(true);
    flaeche("/bibliothek?eintrag=k2");
    // Der Bericht ist da — und zwar der gewählte.
    expect(da("bib-lesen")).not.toBeNull();
    expect(leseTitel()).toBe(KOS[1]?.title);
    // Und die Liste steht NICHT gleichzeitig daneben. Genau hier war die Fläche bis JOB 3121 rot:
    // beide Kinder standen in einer Zeile, der Bericht bekam 10 px.
    expect(da("bib-liste")).toBeNull();
    expect(zeilen()).toHaveLength(0);
  });

  it("F2 · der Rückweg ist da, sichtbar, mit der Tastatur erreichbar — und führt zur Liste", () => {
    setzeBreite(true);
    flaeche("/bibliothek?eintrag=k2");
    const knopf = rueckweg();
    expect(knopf).not.toBeNull();
    // Ein echtes <button type="button">: DAS ist der Vertrag, der es im Browser mit Enter und
    // Leertaste auslösbar macht. jsdom führt die Standardaktion einer Taste nicht aus (aus einem
    // Enter entsteht dort kein Klick) — geprüft wird deshalb der Vertrag, nicht seine Nachbildung.
    expect(knopf).toBeInstanceOf(HTMLButtonElement);
    expect((knopf as HTMLButtonElement).type).toBe("button");
    expect((knopf as HTMLButtonElement).disabled).toBe(false);
    // Kein ausgehängtes oder verstecktes Ziel: es nimmt den Fokus, und es ist nicht aria-hidden.
    expect(knopf?.getAttribute("tabindex")).toBeNull();
    expect(knopf?.closest("[aria-hidden='true']")).toBeNull();
    expect(knopf?.closest("[hidden]")).toBeNull();
    act(() => {
      knopf?.focus();
    });
    expect(document.activeElement).toBe(knopf);
    // Der zugängliche Name nennt das Ziel und kommt aus VORHANDENEN Schlüsseln (Auftrag §4):
    // `nb.back` mit dem Namen der Fläche aus `nav.library`. Kein neuer Übersetzungsschlüssel.
    expect((knopf?.textContent ?? "").trim()).toBe(ZURUECK_TEXT());
    // Auslösen — derselbe Pfad, den Enter im Browser nimmt.
    act(() => {
      (knopf as HTMLButtonElement).click();
    });
    expect(da("bib-liste")).not.toBeNull();
    expect(da("bib-lesen")).toBeNull();
    expect(rueckweg()).toBeNull();
  });

  it("F3 · der Rückweg verliert nichts: Suchbegriff, Filter und Zeilen stehen, es wird nichts neu abgerufen", () => {
    setzeBreite(true);
    // Suchbegriff UND Facettenwahl in der Adresse: „Anlage 1" lässt k1 und k2 übrig, k3 fällt raus.
    flaeche("/bibliothek?q=entl%C3%BCften&category=Anlage+1&eintrag=k2");
    expect(da("bib-lesen")).not.toBeNull();
    const rufeVorher = stand.rufe;
    act(() => {
      (rueckweg() as HTMLButtonElement).click();
    });
    // Der Suchbegriff steht unverändert im Feld …
    expect(suchfeld().value).toBe("entlüften");
    // … die Filterwahl wirkt weiter (k3 aus „Anlage 2" ist nicht dabei) und der Suchbegriff
    // ordnet weiter: k2 trägt „entlüften" im Titel und steht deshalb vor k1. BENANNTE GRENZE: die
    // Vorauswahl nach `q` trifft der Server (`useLibrarySearch`, hier eine Attrappe); im Browser
    // stünde k1 gar nicht erst in der Antwort. Was hier gemessen wird, ist die Reihung aus
    // `searchLibrary` — und die hängt am Suchbegriff, der den Rückweg überlebt hat.
    const titel = zeilen().map((z) =>
      (z.querySelector('[data-bib-text="zeile-titel"]')?.textContent ?? "").trim(),
    );
    expect(titel).toEqual([KOS[1]?.title, KOS[0]?.title]);
    // … und es wurde nichts nachgeladen: der Rückweg ist eine Anordnung, kein Abruf.
    expect(stand.rufe).toBe(rufeVorher);
  });

  it("F4 · breit bleibt breit: Liste und Bericht stehen nebeneinander, kein Rückweg drängt sich dazwischen", () => {
    setzeBreite(false);
    flaeche("/bibliothek?eintrag=k2");
    expect(da("bib-liste")).not.toBeNull();
    expect(da("bib-lesen")).not.toBeNull();
    expect(leseTitel()).toBe(KOS[1]?.title);
    expect(zeilen()).toHaveLength(KOS.length);
    expect(rueckweg()).toBeNull();
  });

  it("F5 · schmal ohne Wahl: die Liste trägt die Fläche — kein leerer Bericht, kein Rückweg ins Nichts", () => {
    setzeBreite(true);
    flaeche("/bibliothek");
    expect(da("bib-liste")).not.toBeNull();
    expect(zeilen()).toHaveLength(KOS.length);
    expect(da("bib-lesen")).toBeNull();
    expect(rueckweg()).toBeNull();
    // Und nichts ist STILL vorgewählt: die Vorwahl `sichtbareIds[0]` füllt breit die zweite Spalte,
    // schmal würde sie den Erstbesuch ungefragt in einen Bericht stellen.
    expect(container.querySelector('[data-testid="bib-zeile"][aria-current="true"]')).toBeNull();
  });

  it("F6 · keine unsichtbaren Tab-Ziele: was schmal nicht auf der Fläche steht, ist auch nicht im DOM", () => {
    setzeBreite(true);
    flaeche("/bibliothek?eintrag=k2");
    // Mit Bericht: kein einziges Bedienelement der Liste — weder Suchfeld noch Menüs noch Zeilen.
    for (const marke of ["bib-suche", "bib-menue-filter", "bib-menue-bereich", "bib-liste-menue"]) {
      expect(da(marke)).toBeNull();
    }
    expect(zeilen()).toHaveLength(0);
    // Und zurück: dann steht der Bericht nicht als unsichtbares Ziel daneben.
    act(() => {
      (rueckweg() as HTMLButtonElement).click();
    });
    expect(da("bib-lesen")).toBeNull();
    expect(da("bib-titel")).toBeNull();
    expect(da("bib-suche")).not.toBeNull();
  });

  it("F7 · der Fokus geht mit: in den Bericht hinein und auf die gelesene Zeile zurück", () => {
    setzeBreite(true);
    flaeche("/bibliothek");
    const zeile = zeilen().find((z) => z.getAttribute("data-bib-id") === "k2");
    expect(zeile).toBeDefined();
    act(() => {
      zeile?.click();
    });
    // Die Zeile ist mit der Liste verschwunden — ohne diesen Griff fiele der Fokus auf <body>, und
    // die Tastatur begänne wieder ganz oben.
    expect(document.activeElement).toBe(rueckweg());
    act(() => {
      (rueckweg() as HTMLButtonElement).click();
    });
    expect(document.activeElement).toBe(
      zeilen().find((z) => z.getAttribute("data-bib-id") === "k2"),
    );
  });

  it("F8 · schmal mit Bericht: der Auffrischungssatz samt Wiederholknopf steht auf der Fläche — genau einmal", () => {
    stand.auffrischungScheitert = true;
    setzeBreite(true);
    flaeche("/bibliothek?eintrag=k2");
    // Die Liste, an der der Satz sonst hängt (`BibliothekFlaeche` → `hinweis`), ist schmal nicht da.
    expect(da("bib-liste")).toBeNull();
    // Der Satz steht trotzdem auf der Fläche — ein Hinweis, den man auf dem Telefon nicht sieht,
    // ist keiner (Auftrag §9) — und er steht GENAU EINMAL, nicht zusätzlich noch an der Lesefläche.
    expect(
      container.querySelectorAll(`[data-testid="${AUFFRISCHUNG_HINWEIS_MARKE}"]`),
    ).toHaveLength(1);
    const erneut = da("bib-hinweis-erneut");
    expect(erneut).not.toBeNull();
    // Und er ist bedienbar: der Knopf holt beide Listenquellen zurück (und den Bericht dazu).
    const vorher = stand.rufe;
    act(() => {
      (erneut as HTMLButtonElement).click();
    });
    expect(stand.rufe).toBeGreaterThan(vorher);
  });

  it("F8b · KALIBRIERUNG breit: derselbe Satz steht weiterhin an der Liste, genau einmal", () => {
    stand.auffrischungScheitert = true;
    setzeBreite(false);
    flaeche("/bibliothek?eintrag=k2");
    const liste = da("bib-liste");
    expect(liste).not.toBeNull();
    expect(
      container.querySelectorAll(`[data-testid="${AUFFRISCHUNG_HINWEIS_MARKE}"]`),
    ).toHaveLength(1);
    expect(liste?.querySelector(`[data-testid="${AUFFRISCHUNG_HINWEIS_MARKE}"]`)).not.toBeNull();
    expect(liste?.querySelector('[data-testid="bib-hinweis-erneut"]')).not.toBeNull();
  });

  it("F9 · Breitenwechsel ohne Neuladen: breit → schmal → breit, ohne zweiten Abruf", () => {
    setzeBreite(false);
    flaeche("/bibliothek?eintrag=k2");
    expect(da("bib-liste")).not.toBeNull();
    expect(da("bib-lesen")).not.toBeNull();
    const rufeVorher = stand.rufe;

    wechsleBreite(true);
    expect(da("bib-liste")).toBeNull();
    expect(da("bib-lesen")).not.toBeNull();
    expect(rueckweg()).not.toBeNull();

    wechsleBreite(false);
    expect(da("bib-liste")).not.toBeNull();
    expect(da("bib-lesen")).not.toBeNull();
    expect(rueckweg()).toBeNull();
    // Die Anordnung ist rein örtlich: sie ruft nichts (Auftrag §3, Nutzenkette ohne Abfrage).
    expect(stand.rufe).toBe(rufeVorher);
  });

  it("F10 · die Zustandsanker (JOB 3072) bleiben in beiden Anordnungen unsichtbar", () => {
    setzeBreite(true);
    flaeche("/bibliothek");
    const anker = da("bib-zustand-anker-liste");
    expect(anker).not.toBeNull();
    expect(anker?.hasAttribute("hidden")).toBe(true);
    expect(container.querySelectorAll('[data-testid="bib-zustand-anker"]')).toHaveLength(
      KOS.length,
    );
    // Sie hängen am Bestand, nicht an der Anordnung — auch mit gelesenem Bericht bleiben sie
    // vollständig und unsichtbar.
    wechsleBreite(false);
    expect(da("bib-zustand-anker-liste")?.hasAttribute("hidden")).toBe(true);
  });
});

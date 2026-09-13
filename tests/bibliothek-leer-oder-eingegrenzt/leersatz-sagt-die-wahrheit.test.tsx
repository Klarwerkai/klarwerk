// @vitest-environment jsdom
// ================================================================================================
// JOB 3788 · „NOCH KEINE EINTRÄGE." IST EINE AUSSAGE ÜBER DEN BESTAND, NICHT ÜBER DIE AUSWAHL.
// ================================================================================================
//
// DER BEFUND (JOB 3762, `runde-1/RUECKGABE.md:42`): `BibliothekListe.tsx:389` entschied allein an
// `q.trim()`, welcher der beiden Sätze im Leerzweig steht. Das Suchfeld ist aber nur EINE von sechs
// Wahlen, die die Trefferliste einengen können — Facetten, Zeitraum, Umschalter, Gruppierung und
// Geltungsbereich zählten nicht mit. Wer auf einer GEFÜLLTEN Bibliothek eine trefferlose Abteilung
// wählte und das Suchfeld leer liess, bekam „Noch keine Einträge." zu lesen: eine Falschaussage
// über den Wissensbestand in einem System, dessen Anspruch das ehrliche Benennen von Lücken ist.
//
// DIE WEICHE HÄNGT JETZT AN `anyFilterActive` (`BibliothekFlaeche.tsx:1238`) — dem Ausdruck, den
// die Fläche für „Diese Suche merken" ohnehin schon bildet. Er wird DURCHGEREICHT (Prop
// `eingegrenzt`), nicht nachgebaut: ein zweiter Filterbegriff in der Liste wäre der Anfang von zwei
// auseinanderlaufenden Wahrheiten.
//
// WAS HIER GEMESSEN WIRD: der gerenderte Satz unter `data-testid="bib-leer"` an der ECHTEN,
// gemounteten Fläche (über `pages/Library`, seit JOB 3063 eine Hülle um `BibliothekFlaeche`) —
// nicht der Rückgabewert einer Hilfsfunktion. Die Fälle halten BEIDE Richtungen: B1 hält fest, dass
// der Bestandssatz nicht verschwindet, B3–B7 halten fest, dass er nicht zu weit greift.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Titel",
    statement: "",
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
    // Kein Eintrag in der Historie ⇒ `createdByOf` kennt keinen Ersteller ⇒ das Objekt gehört in
    // KEINE persönliche Ablage (`libraryOwnScope.ts:79-87`). Genau das braucht B6.
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

// Zwei Objekte in ZWEI Abteilungen mit je EIGENEM Schlagwort: „Anlage 1" trägt nur „ventil",
// „Anlage 2" nur „pumpe". Beide Werte kommen im Bestand wirklich vor — die KOMBINATION trifft
// keines. Damit ist die Facettenwahl echt (sie übersteht die Wertprüfung aus
// `libraryUrlFilters.ts:208`) und trotzdem trefferlos. Dieselbe Bauform wie in
// `tests/library/mega59-nullzustand-mounted.test.tsx`.
const KO_A = ko({ id: "a", title: "Alpha Ventil", category: "Anlage 1", tags: ["ventil"] });
const KO_B = ko({ id: "b", title: "Beta Pumpe", category: "Anlage 2", tags: ["pumpe"] });
const BESTAND = [KO_A, KO_B];

/**
 * Die Felder, die `BibliothekFlaeche` an einer Abfrage wirklich liest. `fetchStatus` trägt das
 * Anhalten (`angehalten()`), `isLoading` den Erstabruf, `isError` den Fehler — die drei Lagen aus
 * §9, die B9 gegen den Leerzweig abgrenzt.
 */
const abfrage = (
  data: unknown,
  extra: Partial<{ isLoading: boolean; isError: boolean; fetchStatus: string }> = {},
): Record<string, unknown> => ({
  data,
  isLoading: false,
  isError: false,
  isPaused: false,
  isRefetchError: false,
  fetchStatus: "idle",
  dataUpdatedAt: data === undefined ? 0 : Date.parse("2026-09-12T09:00:00.000Z"),
  ...extra,
});

const lage = vi.hoisted(() => ({
  /** `GET /api/library/search` — die Trefferliste der Fläche (`query`). */
  suche: {} as Record<string, unknown>,
  /** `GET /api/ko` — der Bestand, an dem die Facettenprüfung hängt (`all`). */
  bestand: {} as Record<string, unknown>,
}));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    koQueryKey: ["kos", undefined],
    useKos: () => ({ ...lage.bestand, error: null }),
    useLibrarySearch: () => ({ ...lage.suche, error: null }),
    useDirectory: () => ok([]),
    useConflicts: () => ok([]),
    useEigeneBefunde: () => ok([]),
    // Die Lesefläche rechts bleibt im Ladezustand — sie ist dann ohne Text und mischt sich in
    // keine Zusicherung über den Satz links ein.
    useKo: () => ({ data: undefined, isLoading: true, isError: false, error: null }),
    useAudit: () => ok([]),
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
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

function mount(adresse = "/bibliothek"): void {
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
        createElement(MemoryRouter, { initialEntries: [adresse] }, createElement(Library)),
      ),
    );
  });
}

function abbauen(): void {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
}

const leerfeld = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="bib-leer"]');

/** Der Satz selbst — der Absatz, NICHT der Kasten mitsamt Knopf. Sonst misst man Text über Text. */
const leersatz = (): string | null => {
  const p = leerfeld()?.querySelector("p");
  return p ? (p.textContent ?? "").replace(/\s+/g, " ").trim() : null;
};

// ------------------------------------------------------------------------------------------------
// DER SPRACHWÄCHTER-KERN (Bauart wie S9 in `tests/seitenhilfe-dubletten/seitenhilfe-dubletten.test.tsx`).
// ------------------------------------------------------------------------------------------------
// `i18n.t` beantwortet eine fehlende niederländische Zeile still auf Deutsch (`fallbackLng: "de"`).
// Ein Fall, der gegen `t()` prüft, bliebe also grün, während der Niederländer Deutsch liest.
// Deshalb liest B8 die SPRACHRESSOURCE selbst; fehlt sie, fliegt der Fall mit Schlüssel UND Sprache.
type Sprache = "de" | "en" | "nl";
function ressource(sprache: Sprache, schluessel: string): string {
  const wert: unknown = i18n.getResource(sprache, "translation", schluessel);
  if (typeof wert !== "string" || wert.trim() === "") {
    throw new Error(`Schlüssel ${schluessel} fehlt in der Sprachressource ${sprache}`);
  }
  return wert;
}
const BESTANDSSATZ = (s: Sprache = "de"): string => ressource(s, "lib.liste.leer");
const AUSWAHLSATZ = (s: Sprache = "de"): string => ressource(s, "lib.liste.leerSuche");

beforeEach(async () => {
  await i18n.changeLanguage("de");
  lage.suche = abfrage([]);
  lage.bestand = abfrage([]);
});

afterEach(abbauen);

describe("JOB 3788 · der Leersatz sagt die Wahrheit über den Bestand", () => {
  it("B1 · Bestand LEER, nichts eingegrenzt ⇒ der Satz über den BESTAND", () => {
    // Die Gegenrichtung, und sie ist genauso wichtig: eine Weiche, die nur noch „Nichts gefunden."
    // sagt, hätte den Fehler bloss umgedreht. Der erste Schritt steht daneben (`bib-leer-erfassen`).
    mount();
    expect(leersatz()).toBe(BESTANDSSATZ());
    const knopf = container.querySelector<HTMLAnchorElement>('[data-testid="bib-leer-erfassen"]');
    expect(knopf?.getAttribute("href")).toBe("/erfassen");
  });

  it("B2 · Bestand GEFÜLLT, Suchwort ohne Treffer ⇒ der Satz über die AUSWAHL", () => {
    // Der eine Fall, den `q.trim()` schon richtig hatte. Er darf durch die Umstellung nicht kippen.
    lage.bestand = abfrage(BESTAND);
    lage.suche = abfrage([]);
    mount("/bibliothek?q=gibtesnicht");
    expect(leersatz()).toBe(AUSWAHLSATZ());
  });

  it("B3 · Bestand GEFÜLLT, Bereichsfacette ohne Treffer, Suchfeld LEER ⇒ der Satz über die AUSWAHL", () => {
    // DER FALL, DER VOR JOB 3788 ROT WAR. Die Suche liefert beide Objekte, „Anlage 1" + „pumpe"
    // zeigt keines davon — hundert Einträge dürfen dann nicht als „noch keine" ausgegeben werden.
    lage.bestand = abfrage(BESTAND);
    lage.suche = abfrage(BESTAND);
    mount("/bibliothek?category=Anlage+1&tag=pumpe");
    expect(leersatz()).toBe(AUSWAHLSATZ());
  });

  it("B4 · dasselbe mit gewähltem ZEITRAUM", () => {
    // `von`/`bis` filtern erst nach der Serverantwort (`matchesFacetRange`, `BibliothekFlaeche.tsx:557`).
    // Ein Fenster in der Zukunft trifft keines der beiden Objekte (geändert 2026-07-20).
    lage.bestand = abfrage(BESTAND);
    lage.suche = abfrage(BESTAND);
    mount("/bibliothek?von=2027-01-01&bis=2027-12-31");
    expect(leersatz()).toBe(AUSWAHLSATZ());
  });

  it("B5 · dasselbe mit NICHT-STANDARD-SEGMENT", () => {
    // Der Umschalter „Offen" (`zustand=offen`) passt auf kein validiertes Objekt.
    lage.bestand = abfrage(BESTAND);
    lage.suche = abfrage(BESTAND);
    mount("/bibliothek?zustand=offen");
    expect(leersatz()).toBe(AUSWAHLSATZ());
  });

  it("B6 · dasselbe mit gewechseltem GELTUNGSBEREICH — „Meine Ablage“", () => {
    // ==============================================================================================
    // LIEFERUNG 3 — WARUM DER GELTUNGSBEREICH ALS EINGRENZUNG ZÄHLT, UND WAS DAGEGEN SPRICHT.
    // ==============================================================================================
    // DIE GEGENPOSITION, und sie ist ernst zu nehmen: „Meine Ablage" ist für den Menschen ein
    // eigener Ort, kein Filter. Ist dieser Ort leer, wäre „Noch keine Einträge." eine wahre Aussage
    // über GENAU den Bestand, den er gerade ansieht — und die hilfreichere dazu, denn sie lädt zum
    // Erfassen ein, statt eine Suche zu vermuten, die niemand gestellt hat.
    //
    // WARUM SIE TROTZDEM NICHT GEWÄHLT IST — an der Fläche gemessen, nicht nach Geschmack:
    // `applyLibraryScope` (`lib/libraryOwnScope.ts:107-112`) ist kein eigener Abruf und kein
    // Rechtefilter, sondern `items.filter(...)` auf DERSELBEN Antwort, die auch „Alle" zeigt — der
    // Kommentar dort sagt es wörtlich: „Der Gesamtbestand laesst die Menge UNVERAENDERT … Diese
    // Stelle darf die Menge deshalb nur VERKLEINERN." Die Bibliothek hat die hundert fremden
    // Einträge in derselben Sekunde in der Hand, in der sie „Noch keine Einträge." schriebe. Dazu
    // kommt die fail-closed-Regel (`:55-58`): ohne Nutzerkennung und ohne Historie liefert die
    // eigene Ablage NICHTS — ein leerer Bereich ist hier also auch ein Zeichen fehlender Herkunft,
    // nicht nur fehlenden Wissens. Eine Aussage über den ganzen Bestand auf diese Menge zu stützen,
    // wäre die zu starke; „Nichts gefunden." ist die schwächere und trägt.
    //
    // Die Gegenlesart ist als ausführbarer Gegenfall unten benannt (B6-GEGEN), nicht bloss erwähnt.
    lage.bestand = abfrage(BESTAND);
    lage.suche = abfrage(BESTAND);
    mount("/bibliothek?raum=meine");
    expect(leersatz()).toBe(AUSWAHLSATZ());
  });

  it("B6-GEGEN · die verworfene Lesart, ausführbar: „Meine Ablage leer ⇒ Bestandssatz“ gilt NICHT", () => {
    // Der Gegenfall zu B6. Er ist bewusst so geschrieben, dass er rot würde, sobald jemand den
    // Geltungsbereich aus `anyFilterActive` herausnähme — und er nennt dabei beim Namen, welche der
    // zwei Lesarten dann gälte. Ohne ihn wäre Lieferung 3 eine Zusicherung statt einer Messung.
    lage.bestand = abfrage(BESTAND);
    lage.suche = abfrage(BESTAND);
    mount("/bibliothek?raum=meine");
    expect(
      leersatz(),
      "die Gegenlesart („der eigene Ort ist wirklich leer“) ist gemessen verworfen — s. B6",
    ).not.toBe(BESTANDSSATZ());
  });

  it("B7 · Bestand LEER und eingegrenzt ⇒ die AUSWAHL ist die nähere Erklärung", () => {
    // WARUM DIE AUSWAHL GEWINNT, obwohl der Bestandssatz hier zufällig auch wahr wäre: der Mensch
    // sieht seine Wahl in der Kopfzeile stehen. „Noch keine Einträge." daneben liest sich als
    // Antwort auf diese Wahl und behauptet damit mehr, als die Fläche in dieser Lage weiss — sie
    // hat unter der Wahl gesucht, nicht im ganzen Bestand. Die schwächere Aussage trägt.
    //
    // GEMESSEN WIRD MIT DEM UMSCHALTER, nicht mit einer Facette aus der Adresse: eine Facette,
    // deren Wert im (leeren) Bestand nicht vorkommt, VERWIRFT die Fläche vor dieser Weiche
    // (`libraryUrlFilters.ts:208-213`, „Bleibt nichts übrig, verschwindet die Dimension ganz").
    // Dieser benannte Sonderweg steht als eigener Fall direkt darunter.
    lage.bestand = abfrage([]);
    lage.suche = abfrage([]);
    mount("/bibliothek?zustand=offen");
    expect(leersatz()).toBe(AUSWAHLSATZ());
  });

  it("B7b · BENANNTER SONDERWEG: eine Facette auf leerem Bestand wird VERWORFEN, nicht ausgewertet", () => {
    // Kein Mangel des Leersatzes, sondern die Wertprüfung der Adressfilter: „Anlage 1" kommt in
    // einem leeren Bestand nicht vor, die Dimension fällt ganz weg — es steht danach KEINE
    // Eingrenzung mehr, und der Bestandssatz ist die richtige Auskunft. Dieser Fall hält den
    // Mechanismus fest, damit er nicht mit der Weiche aus B3 verwechselt wird; die Prüfung selbst
    // ist Sache von `libraryUrlFilters.ts` und steht ausserhalb dieses Auftrags (§10).
    lage.bestand = abfrage([]);
    lage.suche = abfrage([]);
    mount("/bibliothek?category=Anlage+1");
    expect(leersatz()).toBe(BESTANDSSATZ());
  });

  it("B8 · die Weiche fällt in EN und NL nicht still auf Deutsch zurück", async () => {
    for (const sprache of ["en", "nl"] as const) {
      await i18n.changeLanguage(sprache);

      // Eingegrenzt ⇒ der Satz über die Auswahl, in DIESER Sprache.
      lage.bestand = abfrage(BESTAND);
      lage.suche = abfrage(BESTAND);
      mount("/bibliothek?category=Anlage+1&tag=pumpe");
      expect(leersatz(), `eingegrenzt, ${sprache}`).toBe(AUSWAHLSATZ(sprache));
      expect(leersatz(), `${sprache} fällt auf Deutsch zurück`).not.toBe(BESTANDSSATZ("de"));
      abbauen();

      // Nichts eingegrenzt ⇒ der Satz über den Bestand, in DIESER Sprache.
      lage.bestand = abfrage([]);
      lage.suche = abfrage([]);
      mount();
      expect(leersatz(), `nicht eingegrenzt, ${sprache}`).toBe(BESTANDSSATZ(sprache));
      abbauen();
    }
    await i18n.changeLanguage("de");
  });

  it("B9 · LADEN, FEHLER und ANGEHALTEN zeigen KEINEN der beiden Sätze — auch mit gewählter Facette", () => {
    // §9: die Änderung sitzt INNERHALB von `!laedt && !fehler && !pausiert`; sie lockert die
    // Bedingung nicht. Eine Eingrenzung darf aus keiner der drei Lagen einen Leersatz machen.
    const lagen: readonly [string, Record<string, unknown>][] = [
      ["laedt", abfrage(undefined, { isLoading: true, fetchStatus: "fetching" })],
      ["fehler", abfrage(undefined, { isError: true })],
      ["pausiert", abfrage([], { fetchStatus: "paused" })],
    ];
    for (const [name, suche] of lagen) {
      // Der Bestand bleibt bestätigt und gefüllt, damit die Facette die Wertprüfung übersteht
      // (s. B7b) — gemessen wird also wirklich die Lage der Trefferabfrage, nicht ein Nebeneffekt.
      lage.bestand = abfrage(BESTAND);
      lage.suche = suche;
      mount("/bibliothek?category=Anlage+1&tag=pumpe");
      expect(leerfeld(), `${name}: kein Leerkasten`).toBeNull();
      const alles = (container.textContent ?? "").replace(/\s+/g, " ");
      expect(alles, `${name}: kein Bestandssatz`).not.toContain(BESTANDSSATZ());
      expect(alles, `${name}: kein Auswahlsatz`).not.toContain(AUSWAHLSATZ());
      abbauen();
    }
  });

  it("KALIBRIERUNG · mit sichtbaren Treffern steht überhaupt kein Leersatz da", () => {
    // Ohne diesen Fall wären alle oberen grün, wenn IMMER ein Satz dastünde.
    lage.bestand = abfrage(BESTAND);
    lage.suche = abfrage(BESTAND);
    mount();
    expect(leerfeld()).toBeNull();
  });
});

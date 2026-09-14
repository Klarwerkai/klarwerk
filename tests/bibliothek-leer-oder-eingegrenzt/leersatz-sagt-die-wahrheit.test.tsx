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
// der Bestandssatz nicht verschwindet, B3–B7e halten fest, dass er nicht zu weit greift.
//
// JOB 3877 · B7b: Der letzte Weg, auf dem er trotzdem zu weit griff, war die Adresse auf einem
// LEEREN Bestand — die Wertprüfung warf die Facette weg, und mit ihr die Information, dass
// überhaupt eingegrenzt wurde. B7b ist deshalb umgedreht (er pinnte bis dahin die Unwahrheit),
// B7c–B7e halten die drei Grenzen dieses Wegs.
//
// JOB 3913 · DER LEBENSZYKLUS DIESES BEFUNDS — B10–B12 messen die andere Hälfte der Zusage.
// Der Befund `verworfeneEingrenzung` wird GESETZT in `BibliothekFlaeche.tsx:428` (aus
// `droppedFacetDimensions`, vorher gegen nachher derselben Wertprüfung), GELÖSCHT in `:654` über
// `keimVerbrauchen()` — dem gemeinsamen Griff von „Filter zurücksetzen" (`:693`) und dem Anwenden
// einer gemerkten Sicht (`:717`) — und GELESEN einzig in `:1270` (`anyFilterActive`). B7b–B7e
// halten das Setzen; das LÖSCHEN hielt bis JOB 3913 kein Fall, obwohl der Kommentar `:651-653`
// beide Bedienwege ausdrücklich nennt. B10 (gemerkte Sicht, `:488`) und B11 (Zurücksetzen,
// `:522`) fahren je einen davon an der gemounteten Fläche und lesen danach den Satz über den
// BESTAND; B12 (`:545`) hält die Gegenrichtung — eine Sicht, die selbst eingrenzt, lässt den Satz
// über die AUSWAHL stehen, also kommt der Bestandssatz nicht nach JEDER Bedienung zurück. Alle
// drei messen zusätzlich, ob der Rücksetzweg `facet.reset` angeboten wird (`BibliothekFlaeche.tsx:1815-1822`,
// er hängt an derselben Größe): bei verworfener Eingrenzung ja, nach B10/B11 nicht mehr.
//
// GEMESSEN, NICHT BEHAUPTET: entfernt man `setVerworfeneEingrenzung([])` aus `keimVerbrauchen()`,
// werden B10 und B11 rot und die fünfzehn Bestandsfälle bleiben grün (JOB 3913, Gegenprobe V1).
//
// JOB 3935 · B10–B12 LAUFEN JETZT IN de, en UND nl. Bis dahin waren beide Bedienwege nur auf
// Deutsch gemessen, und die Suche nach dem Rücksetzweg war sogar FEST deutsch — in EN/NL hätte sie
// nie einen Eintrag gefunden, und die Abschlusszusicherung `.toBeUndefined()` wäre ein Scheinbeleg
// gewesen (sie bliebe grün, auch wenn der Weg zurück sichtbar stehen bliebe). Die Sprache ist
// deshalb ein Argument von `ruecksetzEintrag()` geworden, aus DERSELBEN Ressource; K1/K2 halten
// fest, dass diese Parametrisierung nicht ins Leere läuft.
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
// JOB 3913: die Handgriffe an dieser Fläche gibt es genau einmal (`tests/library/support/bib-flaeche`).
// Sie werden importiert, nicht nachgebaut — ein zweiter Menühelfer wäre der Anfang zweier Fassungen.
import {
  eintragText,
  menueEintrag,
  menueOeffnen,
  suche,
  tippe,
} from "../library/support/bib-flaeche";

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
/** Die drei geführten Sprachen, in der Reihenfolge, in der die Fälle sie fahren (JOB 3935). */
const SPRACHEN = ["de", "en", "nl"] as const;
function ressource(sprache: Sprache, schluessel: string): string {
  const wert: unknown = i18n.getResource(sprache, "translation", schluessel);
  if (typeof wert !== "string" || wert.trim() === "") {
    throw new Error(`Schlüssel ${schluessel} fehlt in der Sprachressource ${sprache}`);
  }
  return wert;
}
const BESTANDSSATZ = (s: Sprache = "de"): string => ressource(s, "lib.liste.leer");
const AUSWAHLSATZ = (s: Sprache = "de"): string => ressource(s, "lib.liste.leerSuche");

// ------------------------------------------------------------------------------------------------
// JOB 3913 — DIE ZWEI BEDIENWEGE, DIE DEN BEFUND WIEDER LÖSCHEN (B10–B12).
// ------------------------------------------------------------------------------------------------

function element<T extends HTMLElement>(selektor: string): T {
  const el = container.querySelector<T>(selektor);
  if (!el) {
    throw new Error(`Element fehlt: ${selektor}`);
  }
  return el;
}

/**
 * Der Rücksetzweg `facet.reset` im Menü „Filter" — `undefined`, wenn er NICHT angeboten wird.
 * Bauform von `tests/library/mega59-nullzustand-mounted.test.tsx:137-145`; gesucht wird über die
 * Beschriftung und nicht über `menueEintrag`, weil hier auch die ABWESENHEIT gemessen wird
 * (`menueEintrag` wirft dann) — der Eintrag hängt an `anyFilterActive`
 * (`BibliothekFlaeche.tsx:1815`), also an genau der Größe, um die es in B10/B11 geht.
 *
 * JOB 3935 · WARUM DIE SPRACHE HIER EIN ARGUMENT IST und keine feste Zeile: bis dahin stand hier
 * `ressource("de", …)`. In einem englischen Menü kommt „Alle zurücksetzen" nicht vor — die Suche
 * hätte NIE etwas gefunden. Die Ausgangslagenprüfung (`toBeTruthy`) wäre rot gewesen, und schlimmer:
 * die Abschlussprüfung (`toBeUndefined`) wäre grün geblieben, auch wenn der Weg zurück in Wahrheit
 * sichtbar stehen bliebe. Es gibt genau EINEN Weg zur Beschriftung — dieselbe `ressource()`; eine
 * zweite Übersetzungsliste im Test wäre der Anfang zweier Fassungen.
 */
function ruecksetzEintrag(sprache: Sprache = "de"): HTMLButtonElement | undefined {
  const menue = menueOeffnen(container, "bib-menue-filter");
  const label = ressource(sprache, "facet.reset");
  return [...menue.querySelectorAll('[role="menuitem"]')].find((b) => eintragText(b) === label) as
    | HTMLButtonElement
    | undefined;
}

/** Eine Sicht über den echten Bedienweg merken (`tests/bibliothek-sichten/sichten-mounted.test.tsx:134-138`). */
function sichtSpeichern(name: string): void {
  menueOeffnen(container, "bib-liste-menue");
  tippe(element<HTMLInputElement>("#bib-sichtname"), name);
  const knopf = element<HTMLButtonElement>('[data-testid="bib-sicht-speichern"]');
  expect(knopf.disabled, `„${name}" lässt sich nicht speichern`).toBe(false);
  act(() => {
    knopf.click();
  });
}

/** Eine gemerkte Sicht über den echten Bedienweg anwenden (ebenda, `:139-141`). */
function sichtAnwenden(name: string): void {
  const eintrag = menueEintrag(menueOeffnen(container, "bib-liste-menue"), name);
  act(() => {
    eintrag.click();
  });
}

/**
 * Auf die entprellte Suchfortschreibung warten (`LIBRARY_SEARCH_DEBOUNCE_MS`), statt mit festen
 * Wartezeiten zu raten — dieselbe Bauform wie `sichten-mounted.test.tsx:149-153`.
 */
async function entprellung(): Promise<void> {
  await act(async () => {
    await new Promise((fertig) => setTimeout(fertig, 360));
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  lage.suche = abfrage([]);
  lage.bestand = abfrage([]);
  // JOB 3913: gemerkte Sichten liegen im `localStorage` und überlebten sonst den Fall, der sie
  // angelegt hat (`sichten-mounted.test.tsx:158`). Kein Fall darf vom Nachlass eines anderen leben.
  window.localStorage.clear();
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

  it("B7b · JOB 3877: eine auf leerem Bestand VERWORFENE Facette bleibt eine Eingrenzung", () => {
    // ==============================================================================================
    // DER FALL, DER VOR JOB 3877 ROT WAR — und bis dahin die Unwahrheit festnagelte.
    // ==============================================================================================
    // „Anlage 1" kommt in einem leeren Bestand nicht vor; die Wertprüfung der Adressfilter räumt die
    // Dimension weg (`libraryUrlFilters.ts`, uxpol4: ein Link darf kein strukturelles No-Match
    // erzeugen, also fällt der Wert ersatzlos). Bis JOB 3877 war die Auswahl danach von „es wurde nie
    // etwas gewählt" nicht mehr zu unterscheiden, und hier stand „Noch keine Einträge." — eine
    // Aussage über den ganzen Wissensbestand, obwohl die Fläche unter einer Eingrenzung gesucht hat.
    //
    // Die Auswahl selbst ist unverändert geblieben (kein No-Match, keine Ersatzwerte); was verworfen
    // wurde, meldet `droppedFacetDimensions` NEBEN ihr, und `anyFilterActive` zählt es mit.
    lage.bestand = abfrage([]);
    lage.suche = abfrage([]);
    mount("/bibliothek?category=Anlage+1");
    expect(leersatz()).toBe(AUSWAHLSATZ());
  });

  it("B7c · JOB 3877 (a): leerer Bestand, unbekannter Wert in der Adresse ⇒ der Satz über die AUSWAHL", () => {
    // Derselbe Kern wie B7b, aber mit einem Wert, den auch ein GEFÜLLTER Bestand nicht kennt — der
    // Fall des geteilten Links auf einer frisch aufgesetzten Instanz. Er hängt an der Meldung der
    // Wertprüfung; V1 (Meldung immer leer) und V2 (Meldung nicht verdrahtet) machen ihn rot.
    lage.bestand = abfrage([]);
    lage.suche = abfrage([]);
    mount("/bibliothek?tag=gibtesnicht");
    expect(leersatz()).toBe(AUSWAHLSATZ());
  });

  it("B7d · JOB 3877 (b): leerer Bestand, LEERE Adresse ⇒ weiterhin der Satz über den BESTAND", () => {
    // Die Gegenprobe zu B7c, und sie trägt die halbe Beweislast: sie zeigt, dass die neue Bedingung
    // wirklich am Befund der Wertprüfung hängt und nicht bedingungslos durchgereicht ist. V3 (die
    // Bedingung fest auf `true`) macht genau diesen Fall rot, B7c bleibt dabei grün.
    lage.bestand = abfrage([]);
    lage.suche = abfrage([]);
    mount("/bibliothek");
    expect(leersatz()).toBe(BESTANDSSATZ());
  });

  it("B7e · JOB 3877 (c): GEFÜLLTER Bestand, unbekannter Wert, 0 Treffer ⇒ der Satz über die AUSWAHL", () => {
    // Hier war der alte Satz am deutlichsten falsch: zwei Einträge liegen im Bestand, die Adresse
    // grenzt auf einen Wert ein, den es nicht gibt, die Suche liefert nichts — und „Noch keine
    // Einträge." behauptete einen leeren Wissensbestand, den die Fläche in derselben Sekunde in der
    // Hand hält. Er ist heute aus dem neuen Grund richtig: die verworfene Dimension zählt mit.
    lage.bestand = abfrage(BESTAND);
    lage.suche = abfrage([]);
    mount("/bibliothek?category=Gibtesnicht");
    expect(leersatz()).toBe(AUSWAHLSATZ());
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
    // JOB 3877: die zweite Adresse ist die NEUE Lage — eine Facette, die die Wertprüfung vollständig
    // verwirft (`?category=Gibtesnicht`). Sie hält seit 3877 die Weiche offen (B7e); B9 hätte sie
    // ohne diese Zeile nicht abgedeckt, denn die erste Adresse trägt eine ÜBERLEBENDE Facette.
    const adressen = [
      "/bibliothek?category=Anlage+1&tag=pumpe",
      "/bibliothek?category=Gibtesnicht",
    ];
    for (const [name, suche] of lagen) {
      for (const adresse of adressen) {
        // Der Bestand bleibt bestätigt und gefüllt, damit die erste Facette die Wertprüfung
        // übersteht — gemessen wird also wirklich die Lage der Trefferabfrage, nicht ein Nebeneffekt.
        lage.bestand = abfrage(BESTAND);
        lage.suche = suche;
        mount(adresse);
        expect(leerfeld(), `${name} · ${adresse}: kein Leerkasten`).toBeNull();
        const alles = (container.textContent ?? "").replace(/\s+/g, " ");
        expect(alles, `${name} · ${adresse}: kein Bestandssatz`).not.toContain(BESTANDSSATZ());
        expect(alles, `${name} · ${adresse}: kein Auswahlsatz`).not.toContain(AUSWAHLSATZ());
        abbauen();
      }
    }
  });

  // ==============================================================================================
  // JOB 3913 · B10–B12 — WAS DIE ADRESSE GESETZT HAT, MUSS DIE BEDIENUNG WIEDER LÖSCHEN KÖNNEN.
  // ==============================================================================================
  // B7b–B7e halten fest, dass eine verworfene Facette eine Eingrenzung BLEIBT. Die andere Hälfte
  // derselben Zusage steht im Produkt seit JOB 3877 als Kommentar (`BibliothekFlaeche.tsx:651-653`)
  // und war ungemessen: wer danach eine gemerkte Sicht anwendet oder die Filter zurücksetzt, hat
  // nichts mehr eingegrenzt — dann ist „Nichts gefunden." die Falschaussage, und zwar eine, die
  // bliebe, bis die Seite neu geladen wird. Gemessen wird an der gemounteten Fläche über
  // `pages/Library`, mit den echten Bedienwegen (Menü „…" für Sichten, Menü „Filter" für das
  // Zurücksetzen) — nicht durch Schreiben in den `localStorage` und einen zweiten Mount: der misst
  // den Mount, nicht das Anwenden, und bliebe grün, selbst wenn `keimVerbrauchen()` den Befund
  // stehen liesse.
  //
  // JOB 3935 · UND ZWAR IN JEDER GEFÜHRTEN SPRACHE. Die drei Fälle liefen bis dahin nur auf
  // Deutsch; K1 und K2 darunter kalibrieren, dass die Sprachschleife wirklich etwas misst.

  // ----------------------------------------------------------------------------------------------
  // JOB 3935 · K1/K2 — DIE ZWEI KALIBRIERUNGEN DER SPRACHSCHLEIFE.
  // ----------------------------------------------------------------------------------------------
  it("K1 · JOB 3935: die drei gemessenen Zeilen lauten in de, en und nl PAARWEISE VERSCHIEDEN", () => {
    // OHNE DIESEN FALL MISST DIE SPRACHSCHLEIFE MÖGLICHERWEISE NICHTS: wären zwei Sprachfassungen
    // wortgleich, bliebe ein „englischer" Fall auch dann grün, wenn die Fläche (oder der Helfer
    // darüber) in Wahrheit die deutsche Zeile benutzte. Der Fall nennt bei Gleichheit Schlüssel und
    // Sprachenpaar, damit die Meldung sagt, WELCHE Messung ihre Kraft verloren hat.
    const paare = [
      ["de", "en"],
      ["de", "nl"],
      ["en", "nl"],
    ] as const;
    for (const schluessel of ["lib.liste.leer", "lib.liste.leerSuche", "facet.reset"]) {
      for (const [a, b] of paare) {
        expect(
          ressource(a, schluessel),
          `${schluessel}: ${a} und ${b} lauten gleich — ein „${b}“-Fall wäre auch mit der ${a}-Fassung grün`,
        ).not.toBe(ressource(b, schluessel));
      }
    }
  });

  it("K2 · JOB 3935: die Sprachumschaltung kommt an der gemounteten Fläche an — Satz UND Menü", async () => {
    // OHNE DIESEN FALL WÄRE ALLES GRÜN, WENN `changeLanguage` still wirkungslos bliebe: die Fälle
    // vergleichen dann die deutsche Fläche mit der deutschen Ressource und bestätigen sich selbst.
    // Gemessen werden BEIDE Orte, an denen B10–B12 hängen — der gerenderte Leersatz und die
    // Beschriftung im Filtermenü, über die `ruecksetzEintrag()` den Weg zurück sucht.
    await i18n.changeLanguage("en");
    lage.bestand = abfrage([]);
    lage.suche = abfrage([]);
    mount();
    expect(leersatz(), "der Leersatz steht nicht in der englischen Fassung").toBe(
      BESTANDSSATZ("en"),
    );
    expect(leersatz(), "die Fläche zeigt trotz en den deutschen Satz").not.toBe(BESTANDSSATZ("de"));
    abbauen();

    // Dasselbe im Menü: bei verworfener Eingrenzung (wie B7c) steht der Rücksetzweg da — und er
    // trägt die ENGLISCHE Beschriftung. Die zweite Zeile ist die eigentliche Aussage: mit der
    // deutschen Beschriftung ist er NICHT zu finden. Genau deshalb braucht der Helfer die Sprache.
    mount("/bibliothek?tag=gibtesnicht");
    expect(ruecksetzEintrag("en"), "der Rücksetzweg fehlt in der englischen Fläche").toBeTruthy();
    expect(
      ruecksetzEintrag("de"),
      "das englische Menü trägt weiterhin die deutsche Beschriftung — dann misst B10/B11 in en nichts",
    ).toBeUndefined();
  });

  for (const s of SPRACHEN) {
    it(`B10 · ${s} · JOB 3913 (a): eine gemerkte NEUTRALE Sicht bringt den Satz über den BESTAND zurück`, async () => {
      await i18n.changeLanguage(s);
      // Ausgangslage wie B7c: leerer Bestand, ein Wert in der Adresse, den auch ein gefüllter
      // Bestand nicht kennt — der geteilte Link auf der frisch aufgesetzten Instanz.
      lage.bestand = abfrage([]);
      lage.suche = abfrage([]);
      mount("/bibliothek?tag=gibtesnicht");
      expect(leersatz(), `${s}: Ausgangslage: die Eingrenzung ist verworfen, gilt aber`).toBe(
        AUSWAHLSATZ(s),
      );
      // GEMESSEN, NICHT GERATEN (Lieferung 3): der Rücksetzweg hängt an derselben Größe wie der Satz
      // (`anyFilterActive`), wird bei verworfener Eingrenzung also ANGEBOTEN. Der Mensch liest hier
      // „Nichts gefunden." und hat einen Weg zurück — kein Produktbefund zu melden.
      expect(
        ruecksetzEintrag(s),
        `${s}: bei verworfener Eingrenzung fehlt der Weg zurück`,
      ).toBeTruthy();
      // WARUM DIESE SICHT NEUTRAL IST, und warum sie genau hier entsteht: gespeichert wird
      // `currentViewState` (`BibliothekFlaeche.tsx:522`) mit q, facetSel, range, groupBy, segment und
      // scope — in dieser Lage stehen alle sechs auf Standard, denn die Wertprüfung hat die Facette
      // weggeräumt. Der Befund `verworfeneEingrenzung` gehört NICHT zum Zustand einer Sicht; genau
      // deshalb lässt sich die neutrale Sicht hier über den echten Bedienweg merken (das Untermenü
      // „Sicht speichern" steht überhaupt nur bei `anyFilterActive`, `:1595`).
      // Der Sichtname ist EINGABE des Menschen und bleibt deshalb in jeder Sprache derselbe; über
      // ihn findet `sichtAnwenden` den Eintrag, nicht über eine übersetzte Beschriftung.
      sichtSpeichern("Ganzer Bestand");
      expect(leersatz(), `${s}: das blosse Merken ändert die Lage nicht`).toBe(AUSWAHLSATZ(s));
      sichtAnwenden("Ganzer Bestand");
      // `applyView` → `keimVerbrauchen()` (`:717`, `:649-655`): der Befund ist weg, also ist nichts
      // mehr eingegrenzt — und über den leeren Bestand ist „Noch keine Einträge." wieder wahr.
      expect(
        leersatz(),
        `${s}: nach der gemerkten Sicht behauptet die Fläche weiter eine Eingrenzung`,
      ).toBe(BESTANDSSATZ(s));
      expect(
        ruecksetzEintrag(s),
        `${s}: nichts ist mehr eingegrenzt — ein Rücksetzweg zeigte auf nichts`,
      ).toBeUndefined();
    });
  }

  for (const s of SPRACHEN) {
    it(`B11 · ${s} · JOB 3913 (b): „Filter zurücksetzen“ bringt den Satz über den BESTAND zurück`, async () => {
      await i18n.changeLanguage(s);
      lage.bestand = abfrage([]);
      lage.suche = abfrage([]);
      mount("/bibliothek?tag=gibtesnicht");
      expect(leersatz(), `${s}: Ausgangslage: die Eingrenzung ist verworfen, gilt aber`).toBe(
        AUSWAHLSATZ(s),
      );
      // Der Weg zurück wird über die Beschriftung SEINER Sprache gesucht und auch dort geklickt —
      // ein Fall, der nur den Satz vergliche, erfüllte den Wortlaut und nicht den Zweck.
      const knopf = ruecksetzEintrag(s);
      expect(knopf, `${s}: bei verworfener Eingrenzung fehlt der Weg zurück`).toBeTruthy();
      act(() => {
        knopf?.click();
      });
      // `onResetFilters` (`:691-698`) geht über DENSELBEN Griff `keimVerbrauchen()` wie die Sicht —
      // der Kommentar `:651-653` nennt beide Wege, und beide werden hier gefahren.
      expect(
        leersatz(),
        `${s}: nach dem Zurücksetzen behauptet die Fläche weiter eine Eingrenzung`,
      ).toBe(BESTANDSSATZ(s));
      expect(
        ruecksetzEintrag(s),
        `${s}: nichts ist mehr eingegrenzt — ein Rücksetzweg zeigte auf nichts`,
      ).toBeUndefined();
    });
  }

  for (const s of SPRACHEN) {
    it(`B12 · ${s} · JOB 3913 (c): eine Sicht, die SELBST eingrenzt, lässt den Satz über die AUSWAHL stehen`, async () => {
      // DIE GEGENRICHTUNG ZU B10/B11, und sie trägt deren Beweislast mit: ohne sie wären beide auch
      // dann grün, wenn nach JEDER Bedienung der Bestandssatz käme. Hier ist der Befund aus der
      // Adresse nach dem Anwenden ebenfalls gelöscht — aber die Sicht bringt ihre EIGENE Eingrenzung
      // mit (ein Suchwort), und die trägt den Satz über die Auswahl weiter. In jeder Sprache: sonst
      // bliebe offen, ob die fremdsprachige Fläche nach JEDER Bedienung den Bestandssatz zeigt.
      await i18n.changeLanguage(s);
      lage.bestand = abfrage([]);
      lage.suche = abfrage([]);
      mount("/bibliothek?tag=gibtesnicht");
      suche(container, "ventil");
      await entprellung();
      sichtSpeichern("Nur Ventile");
      // Zurück auf die Ausgangslage: ohne Suchwort steht der Auswahlsatz allein wegen der verworfenen
      // Eingrenzung da (wie B7c). Das Suchfeld ist leer — die Sicht bringt ihr Wort gleich selbst mit.
      suche(container, "");
      await entprellung();
      expect(element<HTMLInputElement>('[data-testid="bib-suche"]').value).toBe("");
      expect(leersatz(), `${s}: ohne Suchwort trägt die verworfene Eingrenzung den Satz`).toBe(
        AUSWAHLSATZ(s),
      );
      sichtAnwenden("Nur Ventile");
      await entprellung();
      expect(
        element<HTMLInputElement>('[data-testid="bib-suche"]').value,
        `${s}: die Sicht hat ihr Suchwort nicht mitgebracht — dann misst dieser Fall nichts`,
      ).toBe("ventil");
      expect(
        leersatz(),
        `${s}: eine eingrenzende Sicht darf den Bestandssatz nicht herbeiführen`,
      ).toBe(AUSWAHLSATZ(s));
      expect(
        ruecksetzEintrag(s),
        `${s}: die Sicht grenzt ein — der Weg zurück gehört dazu`,
      ).toBeTruthy();
    });
  }

  it("KALIBRIERUNG · mit sichtbaren Treffern steht überhaupt kein Leersatz da", () => {
    // Ohne diesen Fall wären alle oberen grün, wenn IMMER ein Satz dastünde.
    lage.bestand = abfrage(BESTAND);
    lage.suche = abfrage(BESTAND);
    mount();
    expect(leerfeld()).toBeNull();
  });
});

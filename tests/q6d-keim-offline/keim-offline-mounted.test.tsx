// @vitest-environment jsdom
// ================================================================================================
// JOB 3567 · Q6d-KEIM-OFFLINE — DER DRITTE WEG INS SCHWEIGEN: UNGEPRÜFTER FILTER AUS DER ADRESSE.
// ================================================================================================
//
// DER BEFUND, den Codex an JOB 3531 als ungemessene Lücke ausgewiesen hat
// (`archiv/3531/runde-1/ben.md:26`, Prüfpunkt 6): „Der Zusammenfall von `keimWartet` und Pause
// bleibt ungetestet." Wer die Bibliothek über einen Link MIT Filter öffnet (Wissensnetz-Themenkarte,
// gespeicherte Sicht, Lesezeichen) und dabei kein Netz hat, bekam den Satz aus JOB 3531 nicht zu
// sehen — er bekam gar nichts. `keimWartet` (`BibliothekFlaeche.tsx:808`) fragte allein nach
// `all.isError`; offline ist nichts gescheitert, also wartete die Fläche weiter, `laedt` blieb wahr
// und `BibliothekListe.tsx:362` schaltete damit den Verbindungssatz ab.
//
// WIE GEMESSEN WIRD — dieselbe Bauweise (A)+(B) wie in
// `tests/q6d-offline-auskunft/veralteter-leerer-cache-mounted.test.tsx:24-32`:
//
// (A) ECHTER QueryClient UND ECHTER `onlineManager`. Ein behauptetes `fetchStatus: "paused"` könnte
//     den Fall nicht tragen: der Punkt ist, dass TanStack Query die Lage SELBST einnimmt und dass
//     dabei wirklich kein Ruf hinausgeht. `netz.suche` und `netz.kos` halten jeden Ruf fest.
//
// (B) DIE LAGE WIRD ECHT HERGESTELLT, nicht gesetzt: die Adresse trägt `?tag=…` (genau der Weg der
//     Themenkarte, `pages/Wissensnetz.tsx` → `/bibliothek?tag=…`), das Netz ist weg, bevor montiert
//     wird — und damit kommt der Bestandsabruf nie durch, der die Auswahl prüfen müsste.
//
// (C) UNABHÄNGIGE SOLLWERTE: die Pflichttexte stehen als Literale hier und werden gegen `i18n.ts`
//     gepinnt (der WERT, nicht der Schlüssel).
//
// (D) GEWARTET WIRD AUF BEOBACHTBARE ZUSTÄNDE, NICHT AUF TIMER-DURCHLÄUFE (Korrekturpflicht 1 aus
//     `archiv/3567/runde-1/ben.md`). Jede Stelle, an der ein Ergebnis erwartet wird, hängt an
//     `warteBis(…)`: gepollt wird der Zustand der Abfrage bzw. das DOM, bis er gilt, mit Frist —
//     läuft sie ab, ist der Fall rot samt letztem Lagebericht. `ruhe()` ist nur noch der Flush
//     nach dem Montieren. In F3 antworten beide Quellen ausdrücklich VERZÖGERT und in beiden
//     Abschlussreihenfolgen; mit einer festen Zahl `setTimeout(0)`-Runden wäre F3 damit rot.
//
// ROT-FIRST UND BEWAHRUNG SIND HIER GETRENNT AUSGEWIESEN (Promptverbesserung aus
// `archiv/3531/runde-1/ben.md:33`): F1–F3 sind die neuen Verhaltenszusagen und vor der Korrektur
// rot; B1–B2 sind Bewahrungstests und schon vorher grün.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

/** Der Offline-Block der Liste (JOB 3531). */
const OFFLINE = '[data-testid="bib-offline"]';
/** Der Leerzustand („Nichts gefunden.") samt seinem Knopf. */
const LEER = '[data-testid="bib-leer"]';
const LEER_AKTION = '[data-testid="bib-leer-erfassen"]';
/** Der Satz „Stand von <Zeit> · Auffrischung fehlgeschlagen" — er gehört NICHT in diese Lage. */
const AUFFRISCHUNG = '[data-testid="auffrischung-fehlgeschlagen"]';
/** Der Menüknopf „Filter" — er trägt die Zahl der wirksamen Filter als „Filter · n". */
const FILTER_MENUE = '[data-testid="bib-menue-filter"]';

const KLARTEXT = {
  offline: "Ohne Verbindung kann gerade nicht gesucht werden.",
  offlineWeiter: "Sobald die Verbindung wieder steht, wird die Suche von selbst fortgesetzt.",
  nichtsGefunden: "Nichts gefunden.",
  fehler: "Die Liste ließ sich nicht laden.",
  erneut: "Erneut versuchen",
} as const;

/** Das Schlagwort aus der Adresse — der ungeprüfte Filter. */
const TAG = "Lieferanten";
/** Ein Suchbegriff, der nie beantwortet wurde — für den echten Ladefall B1. */
const BEGRIFF = "Ventil";

function ko(overrides: Record<string, unknown>): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Ventil X schliesst bei Ueberdruck",
    statement: "Bei Ueberdruck Ventil X manuell schliessen.",
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
    createdAt: "2026-08-12T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

const BESTAND = [
  ko({ id: "l1", title: "Lieferanten jaehrlich bewerten", tags: [TAG] }),
  ko({ id: "l2", title: "Lieferantenaudit vorbereiten", tags: [TAG] }),
  ko({ id: "a1", title: "Ventil X schliesst bei Ueberdruck", tags: ["Anlage"] }),
  ko({ id: "a2", title: "Ruehrwerk Y vor der Reinigung entlueften", tags: ["Anlage"] }),
];
/** Die Titel, die der Filter aus der Adresse übriglässt. */
const MIT_TAG = ["Lieferanten jaehrlich bewerten", "Lieferantenaudit vorbereiten"].sort();
/** Alle Titel — das, was bei einem verlorenen Filter dastünde. */
const ALLE = BESTAND.map((k) => k.title).sort();

const lage = vi.hoisted(() => ({
  /** Suchtext → Serverantwort der Trefferliste. */
  antwort: new Map<string, unknown[]>(),
  /** Die Antwort des Bestandsabrufs `GET /api/kos`. */
  bestand: [] as unknown[],
  /** Lässt den Bestandsabruf scheitern (B2). */
  bestandFehler: false,
  /** Hält den Bestandsabruf offen, bis der Test ihn freigibt (B1). */
  bestandTor: null as Promise<void> | null,
  /** Dasselbe für den Suchabruf (B1b). */
  sucheTor: null as Promise<void> | null,
  /** Die Frischefrist beider Abfragen — 0 macht einen zwischengespeicherten Stand veraltet (F2). */
  frist: Number.POSITIVE_INFINITY as number,
  /**
   * Antwortzeit der beiden Quellen in Millisekunden (F3). Sie ist der Grund, warum in F3 auf einen
   * BEOBACHTBAREN Abschluss gewartet werden muss: mit ihr kommt keine Antwort im selben
   * Timer-Durchlauf, und die Reihenfolge der Abschlüsse lässt sich umdrehen.
   */
  dauerBestand: 0,
  dauerSuche: 0,
}));
const netz = vi.hoisted(() => ({ kos: 0, suche: [] as string[] }));

vi.mock("../../apps/web/src/api/hooks", async (importOriginal) => {
  const echt = await importOriginal<Record<string, unknown>>();
  const rq = await import("../../apps/web/node_modules/@tanstack/react-query");
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  const leer = () => ok([]);
  return {
    ...echt,
    useKos: () =>
      rq.useQuery({
        queryKey: ["kos", undefined],
        queryFn: async () => {
          netz.kos += 1;
          if (lage.bestandTor) {
            await lage.bestandTor;
          }
          if (lage.dauerBestand > 0) {
            await new Promise((r) => setTimeout(r, lage.dauerBestand));
          }
          if (lage.bestandFehler) {
            throw new Error("Bestandsabruf gescheitert");
          }
          return lage.bestand;
        },
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: lage.frist,
      }),
    useLibrarySearch: (params: { q?: string }) =>
      rq.useQuery({
        queryKey: ["library", "search", params],
        queryFn: async () => {
          const suchtext = params.q ?? "";
          netz.suche.push(suchtext);
          if (lage.sucheTor) {
            await lage.sucheTor;
          }
          if (lage.dauerSuche > 0) {
            await new Promise((r) => setTimeout(r, lage.dauerSuche));
          }
          return lage.antwort.get(suchtext) ?? [];
        },
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: lage.frist,
      }),
    useKo: (id: string) => ok(BESTAND.find((k) => k.id === id) ?? null),
    useAudit: leer,
    useConflicts: leer,
    useDirectory: leer,
    useEigeneBefunde: leer,
    useKoEvidence: leer,
    useKoNeighbors: leer,
    useKoVersions: leer,
    useLifecyclePending: leer,
    useExternalPolicy: () => ok({ stage: "blocked" }),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u9", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { EMPTY_LIBRARY_FILTER, buildLibraryQuery } from "../../apps/web/src/lib/libraryQuery";
import { LIBRARY_SEARCH_DEBOUNCE_MS } from "../../apps/web/src/lib/useDebouncedValue";
import { Library } from "../../apps/web/src/pages/Library";
import { listenZaehler, suche, zeilenTitel } from "../library/support/bib-flaeche";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

/** Die Adresse des Befunds: der Filterlink ohne jeden Suchtext. */
const MIT_FILTER = `/bibliothek?tag=${TAG}`;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
let qc: QueryClient;

/**
 * Ein paar Durchläufe des Ereignisplans nach dem Montieren — das ist ein FLUSH, kein Warten auf ein
 * Ergebnis. Wo auf ein Ergebnis gewartet wird, steht `warteBis` (siehe dort).
 */
async function ruhe(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

function neuerClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
}

async function bibliothek(adresse: string, client?: QueryClient): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = client ?? neuerClient();
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [adresse] }, createElement(Library)),
      ),
    );
  });
  await ruhe();
}

async function entprellungAbwarten(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, LIBRARY_SEARCH_DEBOUNCE_MS + 60));
  });
  await ruhe();
}

/** Abbauen OHNE den Zwischenspeicher zu leeren — F2 montiert danach ein zweites Mal. */
function abbauen(): void {
  if (root) {
    const alt = root;
    act(() => {
      alt.unmount();
    });
    root = null;
  }
  container?.remove();
}

afterEach(() => {
  abbauen();
  onlineManager.setOnline(true);
});

beforeEach(() => {
  netz.kos = 0;
  netz.suche = [];
  lage.antwort = new Map<string, unknown[]>([["", BESTAND]]);
  lage.bestand = BESTAND;
  lage.bestandFehler = false;
  lage.bestandTor = null;
  lage.sucheTor = null;
  lage.frist = Number.POSITIVE_INFINITY;
  lage.dauerBestand = 0;
  lage.dauerSuche = 0;
});

function abfragezustand(key: readonly unknown[]): { status: string; fetchStatus: string } | null {
  const st = qc.getQueryState(key);
  return st ? { status: st.status, fetchStatus: st.fetchStatus } : null;
}

function suchzustand(suchtext: string): { status: string; fetchStatus: string } | null {
  return abfragezustand([
    "library",
    "search",
    buildLibraryQuery({ ...EMPTY_LIBRARY_FILTER, q: suchtext }),
  ]);
}

function bestandszustand(): { status: string; fetchStatus: string } | null {
  return abfragezustand(["kos", undefined]);
}

function de(key: string): unknown {
  return i18n.getResource("de", "translation", key);
}

function text(sel: string): string {
  return (container.querySelector(sel)?.textContent ?? "").trim();
}

/**
 * Der Lagebericht — was auf der Fläche WIRKLICH steht. Er ist die Messung aus Lieferung 1: die
 * Rotausgabe dieses einen Vergleichs zeigt den Ist-Zustand wörtlich, statt ihn zu behaupten.
 */
function lagebericht(): Record<string, unknown> {
  return {
    bestand: bestandszustand(),
    suche: suchzustand(""),
    rufeBestand: netz.kos,
    rufeSuche: netz.suche.length,
    offlineBlock: text(OFFLINE),
    leerzustand: container.querySelector(LEER) !== null,
    auffrischungssatz: container.querySelector(AUFFRISCHUNG) !== null,
    zeilen: zeilenTitel(container).length,
    zaehler: listenZaehler(container),
    filtermenue: text(FILTER_MENUE),
  };
}

/**
 * WARTEN AUF EIN BEOBACHTBARES EREIGNIS, MIT FRIST — nicht auf eine feste Zahl Timer-Durchläufe.
 *
 * Korrekturpflicht 1 aus `archiv/3567/runde-1/ben.md`: die erste Fassung von F3 flusste nach
 * `setOnline(true)` vier Runden `setTimeout(0)` (das `ruhe()` oben) und prüfte danach. Das misst
 * nicht den Abschluss, sondern hofft auf ihn: Codex hat die Bestandsantwort um 100 ms verzögert,
 * und F3 wurde rot (`die gefilterten Treffer stehen: expected [] to deeply equal [ …(2) ]`) —
 * obwohl am Produkt nichts fehlte. `setOnline(true)` LÖST die Wiederaufnahme nur aus.
 *
 * Deshalb: hier wird der Zustand gepollt, bis er gilt, mit Obergrenze. Läuft die Frist ab, ist das
 * ein echter Fehlschlag mit dem letzten sichtbaren Lagebericht im Text — eine unterbundene
 * Wiederaufnahme wird so rot, statt unbemerkt durchzurutschen. Eigenbau, weil es in diesem Projekt
 * keine Testing-Library gibt (Hausform, gleich `tests/app/job2709-glocke-zu-viele-mounted.test.tsx:451`).
 */
async function warteBis(bedingung: () => boolean, was: string, grenzeMs = 3000): Promise<void> {
  const ende = Date.now() + grenzeMs;
  while (Date.now() < ende) {
    if (bedingung()) {
      return;
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
  throw new Error(
    `Zeitüberschreitung beim Warten darauf, dass ${was} · letzte Lage: ${JSON.stringify(lagebericht())}`,
  );
}

/** Fertig = geantwortet UND nichts mehr unterwegs. Das ist der beobachtbare Abschluss einer Quelle. */
function fertig(zustand: { status: string; fetchStatus: string } | null): boolean {
  return zustand?.status === "success" && zustand.fetchStatus === "idle";
}

/** Der beobachtbare EINTRITT in die Offline-Lage: beide Quellen sind angehalten. */
async function warteAufPause(): Promise<void> {
  await warteBis(
    () => bestandszustand()?.fetchStatus === "paused" && suchzustand("")?.fetchStatus === "paused",
    "beide Abrufe angehalten sind",
  );
}

// ------------------------------------------------------------------------------------------------
// Der Wortlaut-Pin (C) — die Sätze kommen aus `i18n.ts` und werden hier unabhängig festgehalten.
// ------------------------------------------------------------------------------------------------
describe("JOB 3567 · Wortlaut-Pin", () => {
  it.each([
    ["lib.liste.offline", KLARTEXT.offline],
    ["lib.liste.offlineWeiter", KLARTEXT.offlineWeiter],
    ["lib.liste.leerSuche", KLARTEXT.nichtsGefunden],
    ["lib.liste.fehler", KLARTEXT.fehler],
    ["lib.liste.erneut", KLARTEXT.erneut],
  ])("%s lautet auf Deutsch genau so", (key, soll) => {
    expect(de(key)).toBe(soll);
  });
});

// ------------------------------------------------------------------------------------------------
// F1 (ROT-FIRST, Lieferung 2) — der ungeprüfte Filter aus der Adresse, ohne Netz, ohne Bestand
// ------------------------------------------------------------------------------------------------
describe("JOB 3567 · Q6d F1 — offline mit ungeprüftem Filter aus der Adresse sagt die Fläche, was mit ihr ist", () => {
  it("`/bibliothek?tag=…` offline gemountet → `bib-offline`, kein Leerzustand, kein Auffrischungssatz, null Rufe", async () => {
    onlineManager.setOnline(false);
    await bibliothek(MIT_FILTER);
    await warteAufPause();

    // Die Lage ist wirklich erreicht: beide Abfragen sind ANGEHALTEN, keine hat je geantwortet.
    expect(bestandszustand(), "der Bestandsabruf ist angehalten, nicht gescheitert").toEqual({
      status: "pending",
      fetchStatus: "paused",
    });
    expect(suchzustand(""), "die Suche ebenso").toEqual({
      status: "pending",
      fetchStatus: "paused",
    });
    expect(netz.kos, "offline geht kein Bestandsruf hinaus").toBe(0);
    expect(netz.suche, "offline geht kein Suchruf hinaus").toEqual([]);

    // Der Kern: eine Aussage über die VERBINDUNG, keine über den Bestand.
    const block = container.querySelector(OFFLINE);
    expect(block, "der Offline-Block steht da").not.toBeNull();
    expect(block?.textContent).toContain(KLARTEXT.offline);
    expect(block?.textContent).toContain(KLARTEXT.offlineWeiter);
    expect(block?.textContent).not.toContain("lib.liste.");

    // „Nichts gefunden." wäre eine Tatsachenaussage über einen Bestand, den niemand geholt hat.
    expect(container.querySelector(LEER), "kein Leerzustand").toBeNull();
    expect(container.textContent).not.toContain(KLARTEXT.nichtsGefunden);
    expect(container.querySelector(LEER_AKTION), "und kein Erfassen-Knopf").toBeNull();
    // Offline ist NICHTS fehlgeschlagen (JOB 3072 R4).
    expect(container.querySelector(AUFFRISCHUNG), "kein Auffrischungssatz").toBeNull();
    // Kein Knopf im Block: „Erneut versuchen" wäre eine Handlung ohne Wirkung.
    expect(block?.querySelectorAll("button, a, input").length).toBe(0);
  });

  it("Lieferung 1 · der vollständige Lagebericht dieser einen Lage", async () => {
    onlineManager.setOnline(false);
    await bibliothek(MIT_FILTER);
    await warteAufPause();

    expect(lagebericht()).toEqual({
      bestand: { status: "pending", fetchStatus: "paused" },
      suche: { status: "pending", fetchStatus: "paused" },
      rufeBestand: 0,
      rufeSuche: 0,
      offlineBlock: `${KLARTEXT.offline}${KLARTEXT.offlineWeiter}`,
      leerzustand: false,
      auffrischungssatz: false,
      zeilen: 0,
      // Der Zähler schweigt: die Auswahl aus der Adresse ist unbestätigt (Lieferung 4).
      zaehler: null,
      // Der Filter aus der Adresse ist wirksam und sichtbar: „Filter · 1".
      filtermenue: `${String(de("lib.menue.filter"))} · 1`,
    });
  });
});

// ------------------------------------------------------------------------------------------------
// F2 (ROT-FIRST, Lieferung 4) — der Filter bleibt wirksam, die Vollmenge bleibt draußen
// ------------------------------------------------------------------------------------------------
describe("JOB 3567 · Q6d F2 — offline steht der Filter aus der Adresse, nicht die ungefilterte Vollmenge", () => {
  it("veralteter voller Zwischenspeicher + ungeprüfter Filter → nur die passenden Zeilen, Zähler „–“", async () => {
    // Frist 0: der Stand aus dem ersten Besuch ist beim zweiten Montieren VERALTET — genau so
    // entsteht die Lage „Zwischenspeicher da, Bestand für DIESE Montage unbestätigt" (JOB 3115).
    lage.frist = 0;

    // Erster Besuch, online, ohne Filter: Bestand und Trefferliste landen im Zwischenspeicher.
    const client = neuerClient();
    await bibliothek("/bibliothek", client);
    await warteBis(
      () => fertig(bestandszustand()) && fertig(suchzustand("")),
      "der erste Besuch online beide Quellen beantwortet hat",
    );
    expect(zeilenTitel(container).slice().sort(), "online steht der volle Bestand").toEqual(ALLE);
    abbauen();

    // Zweiter Besuch über den Filterlink — ohne Netz.
    netz.kos = 0;
    netz.suche = [];
    onlineManager.setOnline(false);
    await bibliothek(MIT_FILTER, client);
    await warteAufPause();

    expect(bestandszustand(), "der Bestand ist da, seine Auffrischung angehalten").toEqual({
      status: "success",
      fetchStatus: "paused",
    });
    expect(netz.kos, "offline geht kein Bestandsruf hinaus").toBe(0);
    expect(netz.suche, "offline geht kein Suchruf hinaus").toEqual([]);

    // REGELN §7: die zuletzt erfolgreich geholten Werte bleiben sichtbar — GEFILTERT nach der
    // Auswahl aus der Adresse (`wirksameAuswahl`), genau wie im gescheiterten Fall.
    expect(zeilenTitel(container).slice().sort(), "der Filter wirkt").toEqual(MIT_TAG);
    expect(zeilenTitel(container).slice().sort(), "die Vollmenge steht NICHT da").not.toEqual(ALLE);
    // Die Auswahl ist sichtbar wirksam, nicht nur in der Adresse.
    expect(text(FILTER_MENUE)).toBe(`${String(de("lib.menue.filter"))} · 1`);
    // Eine Zahl wäre die zu starke Aussage: die Auswahl ist unbestätigt.
    expect(listenZaehler(container), "der Zähler nennt keine Zahl").toBeNull();
    // Zeilen stehen da — über die Verbindung ist damit nichts mehr zu sagen (Auftrag §9).
    expect(container.querySelector(OFFLINE)).toBeNull();
    expect(container.querySelector(LEER)).toBeNull();
    expect(container.querySelector(AUFFRISCHUNG)).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
// F3 (ROT-FIRST, Lieferung 5) — die Wiederaufnahme
// ------------------------------------------------------------------------------------------------
describe("JOB 3567 · Q6d F3 — kommt das Netz zurück, geht es von selbst weiter", () => {
  // Beide Quellen antworten VERZÖGERT, und zwar in beiden Reihenfolgen (Codex, Prüfpunkt 6 an
  // Runde 1). Keine Antwort fällt damit in denselben Timer-Durchlauf wie `setOnline(true)`: der Fall
  // kommt nur durch, wenn wirklich auf den Abschluss gewartet wird.
  it.each([
    ["die Suche zuerst, der Bestand später", 120, 10],
    ["der Bestand zuerst, die Suche später", 10, 120],
  ])(
    "offline Block → Netz zurück (%s) → je EIN Abruf, die gefilterten Treffer stehen, der Filter ist unverändert",
    async (_name, dauerBestand, dauerSuche) => {
      lage.dauerBestand = dauerBestand;
      lage.dauerSuche = dauerSuche;

      onlineManager.setOnline(false);
      await bibliothek(MIT_FILTER);
      await warteAufPause();

      expect(container.querySelector(OFFLINE), "erst der Verbindungssatz").not.toBeNull();
      expect(netz.suche).toEqual([]);
      const filterVorher = text(FILTER_MENUE);
      expect(filterVorher).toBe(`${String(de("lib.menue.filter"))} · 1`);

      // Netz zurück — ohne einen einzigen Handgriff. `setOnline(true)` LÖST die Wiederaufnahme nur
      // aus; gewartet wird danach auf den beobachtbaren Abschluss BEIDER Quellen, mit Frist.
      act(() => {
        onlineManager.setOnline(true);
      });
      await warteBis(
        () =>
          fertig(bestandszustand()) && fertig(suchzustand("")) && zeilenTitel(container).length > 0,
        "beide Quellen geantwortet haben, nichts mehr unterwegs ist und Zeilen stehen",
      );

      expect(netz.kos, "genau ein Bestandsabruf").toBe(1);
      expect(netz.suche, "genau ein Suchabruf, und zwar der leere").toEqual([""]);
      expect(zeilenTitel(container).slice().sort(), "die gefilterten Treffer stehen").toEqual(
        MIT_TAG,
      );
      expect(container.querySelector(OFFLINE), "der Block räumt sich selbst ab").toBeNull();
      expect(text(FILTER_MENUE), "der Filter aus der Adresse ist unverändert").toBe(filterVorher);
      // Jetzt ist die Auswahl geprüft und der Abruf frisch — erst jetzt darf eine Zahl dastehen.
      expect(listenZaehler(container)).toBe(MIT_TAG.length);
    },
  );

  // Die Gegenprobe zur Wartefrist selbst, als stehender Fall: bleibt das Netz weg, kommt der
  // Abschluss NIE — dann muss das Warten mit einem echten Fehlschlag enden, nicht stillschweigend
  // weiterlaufen. Genau daran hängt, dass F3 eine unterbundene Wiederaufnahme überhaupt bemerkt.
  it("bleibt das Netz weg, läuft die Wartefrist ab und der Fall wird rot (die Frist ist scharf)", async () => {
    lage.dauerBestand = 10;
    lage.dauerSuche = 10;
    onlineManager.setOnline(false);
    await bibliothek(MIT_FILTER);
    await warteAufPause();

    await expect(
      warteBis(
        () => fertig(bestandszustand()) && fertig(suchzustand("")),
        "beide Quellen geantwortet haben",
        300,
      ),
    ).rejects.toThrow(/Zeitüberschreitung/);
    expect(netz.kos, "und es ging weiterhin kein Ruf hinaus").toBe(0);
    expect(netz.suche).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
// B1 (BEWAHRUNG, Lieferung 6) — echtes Laden zeigt weiter nichts
// ------------------------------------------------------------------------------------------------
describe("JOB 3567 · Q6d B1 (Bewahrung) — solange der Bestandsabruf WIRKLICH läuft, bleibt die Liste stumm", () => {
  it("Bestandsabruf offen gehalten, Netz weg, neue Suche angehalten → kein Satz, kein Leerzustand, keine Zeile", async () => {
    let torAufloesen: () => void = () => {};
    lage.bestandTor = new Promise<void>((r) => {
      torAufloesen = r;
    });

    // Online montieren: der Bestandsabruf geht wirklich hinaus und bleibt hängen.
    await bibliothek(MIT_FILTER);
    await warteBis(
      () => bestandszustand()?.fetchStatus === "fetching",
      "der Bestandsabruf wirklich unterwegs ist",
    );
    expect(netz.kos, "der Abruf ist wirklich draußen").toBe(1);
    expect(bestandszustand(), "und er LÄUFT — nicht angehalten, nicht gescheitert").toEqual({
      status: "pending",
      fetchStatus: "fetching",
    });

    // Jetzt geht das Netz weg, und es wird ein NEUER Suchbegriff getippt: dessen Schlüssel wurde
    // nie beantwortet, sein Abruf wird sofort angehalten. Der Bestandsabruf läuft weiter — genau
    // die Lage, in der die Fläche WIRKLICH lädt, obwohl die Suche angehalten ist.
    onlineManager.setOnline(false);
    suche(container, BEGRIFF);
    await entprellungAbwarten();
    await warteBis(
      () => suchzustand(BEGRIFF)?.fetchStatus === "paused",
      "der Abruf des neuen Suchbegriffs angehalten ist",
    );

    expect(bestandszustand(), "der Bestandsabruf läuft unverändert").toEqual({
      status: "pending",
      fetchStatus: "fetching",
    });
    expect(suchzustand(BEGRIFF), "die neue Suche ist angehalten").toEqual({
      status: "pending",
      fetchStatus: "paused",
    });
    expect(netz.suche, "für den neuen Begriff ging kein Ruf hinaus").toEqual([""]);

    // „Laden: keine Zeile, kein Text." (`BibliothekListe.tsx:330`) — und ausdrücklich auch KEINE
    // Aussage über die Verbindung: es wird ja gerade gerufen.
    expect(container.querySelector(OFFLINE), "kein Verbindungssatz während des Ladens").toBeNull();
    expect(container.querySelector(LEER), "kein Leerzustand").toBeNull();
    expect(zeilenTitel(container), "keine Zeile").toEqual([]);
    expect(listenZaehler(container), "keine Zahl").toBeNull();

    // Aufräumen: das Tor öffnen, sonst hängt der Abruf über das Testende hinaus.
    lage.bestandTor = null;
    await act(async () => {
      torAufloesen();
      await new Promise((r) => setTimeout(r, 0));
    });
    await ruhe();
  });

  // Die ZWEITE Hälfte des Ladezweigs. B1 oben hängt an `keimWartet`; für `query.isLoading` gilt
  // dasselbe Versprechen, und es wird hier eigens gemessen: gemessen, nicht mitbehauptet — ohne
  // diesen Fall bliebe das Entfernen von `query.isLoading` aus `BibliothekFlaeche.tsx:1384`
  // unbemerkt (eigener Gegenprobenlauf, siehe RUECKGABE).
  it("B1b · Bestand geprüft, Suche noch unterwegs → kein Leerzustand, keine Zeile, keine Zahl", async () => {
    let sucheAufloesen: () => void = () => {};
    lage.sucheTor = new Promise<void>((r) => {
      sucheAufloesen = r;
    });
    // Der Bestand kommt durch — die Auswahl aus der Adresse ist damit GEPRÜFT, `keimWartet` fällt
    // weg. Was die Liste jetzt noch stumm hält, ist allein `query.isLoading`.
    await bibliothek(MIT_FILTER);
    await warteBis(
      () => fertig(bestandszustand()) && suchzustand("")?.fetchStatus === "fetching",
      "der Bestand geprüft und die Suche noch unterwegs ist",
    );

    expect(container.querySelector(LEER), "kein Leerzustand während des Ladens").toBeNull();
    expect(container.textContent).not.toContain(KLARTEXT.nichtsGefunden);
    expect(container.querySelector(OFFLINE), "und erst recht kein Verbindungssatz").toBeNull();
    expect(zeilenTitel(container), "keine Zeile").toEqual([]);
    expect(listenZaehler(container), "keine Zahl").toBeNull();

    // Aufräumen: Tor öffnen und den Abschluss abwarten, sonst läuft der Abruf ins Testende.
    lage.sucheTor = null;
    act(() => {
      sucheAufloesen();
    });
    await warteBis(() => fertig(suchzustand("")), "die Suche danach fertig ist");
  });
});

// ------------------------------------------------------------------------------------------------
// B2 (BEWAHRUNG, Lieferung 6) — ein Bestands-Erstfehler bleibt ein Fehler
// ------------------------------------------------------------------------------------------------
describe("JOB 3567 · Q6d B2 (Bewahrung) — der gescheiterte Erstabruf des Bestands bleibt der Fehlerzweig", () => {
  it("`all` scheitert ohne Zwischenspeicher → Fehlersatz mit Wiederholknopf, NICHT der Verbindungssatz", async () => {
    lage.bestandFehler = true;
    await bibliothek(MIT_FILTER);
    await warteBis(
      () => bestandszustand()?.status === "error",
      "der Bestandsabruf wirklich gescheitert ist",
    );

    expect(bestandszustand(), "gescheitert, nicht angehalten").toEqual({
      status: "error",
      fetchStatus: "idle",
    });

    expect(container.textContent, "der vorhandene Fehlersatz").toContain(KLARTEXT.fehler);
    const erneut = [...container.querySelectorAll("button")].filter(
      (b) => (b.textContent ?? "").trim() === KLARTEXT.erneut,
    );
    expect(erneut.length, "genau ein Wiederholknopf").toBe(1);

    expect(container.querySelector(OFFLINE), "kein Verbindungssatz — es ist etwas passiert").toBe(
      null,
    );
    expect(container.querySelector(LEER), "kein Leerzustand").toBeNull();
    expect(listenZaehler(container), "und keine Zahl").toBeNull();
  });
});

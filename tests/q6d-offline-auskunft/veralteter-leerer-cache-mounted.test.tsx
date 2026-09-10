// @vitest-environment jsdom
// ================================================================================================
// JOB 3531 · Q6d — TEILFALL (b): EIN VERALTETER LEERER ZWISCHENSPEICHER BEHAUPTETE OFFLINE „NICHTS
// GEFUNDEN".
// ================================================================================================
//
// DER BEFUND. `BibliothekFlaeche.tsx` bildete die Lage der Liste als
// `pausiert={angehalten(query) && query.data === undefined}`, und der Kommentar darüber erklärte die
// zweite Bedingung ausdrücklich als Absicht: „auch ein zwischengespeichertes LEERES Ergebnis darf
// weiter ‚Nichts gefunden.' sagen, denn es wurde wirklich einmal erfolgreich geholt". Codex hat
// genau das danach als Fehler gemessen (Prioritätenzeile Q6d, R-1613 auf 1.0.0-beta.1.110): der
// Server HAT den Treffer, der Zwischenspeicher ist leer und veraltet, und die Oberfläche behauptet
// offline eine Tatsache über den Bestand, die sie nicht kennt. „Einmal erfolgreich geholt" trägt die
// Aussage „es gibt nichts" nur so lange, wie sie nachgeprüft werden kann — offline kann sie das
// nicht.
//
// WAS HIER GEMESSEN WIRD: die BILDUNG der Lage, also die erste Hälfte der Naht. Die zweite Hälfte
// (die Auswertung in der Liste) misst `liste-sagt-offline-mounted.test.tsx` am direkt gemounteten
// Bauteil.
//
// WIE — dieselbe Bauweise wie `tests/bibliothek-offline-suche/leerzustand-ohne-netz.test.tsx`
// (JOB 3099), aus dem der Aufbau übernommen ist:
//
// (A) ECHTER QueryClient UND ECHTER `onlineManager`. Ein behauptetes `fetchStatus: "paused"` könnte
//     den Fall nicht tragen: der Punkt ist, dass TanStack Query die Lage SELBST einnimmt und dass
//     dabei wirklich kein Ruf hinausgeht. `netz.rufe` hält jeden Ruf mit seinem Suchtext fest.
//
// (B) DER VERALTETE LEERE ZWISCHENSPEICHER WIRD ECHT HERGESTELLT, nicht gesetzt: erst online mit
//     leerer Serverantwort suchen (dann liegt `[]` im Speicher und der Leerzustand steht zu Recht
//     da), dann bekommt der Server den Treffer, dann geht das Netz weg und die Abfrage wird
//     aufgefrischt — die Auffrischung wird angehalten, und der alte leere Satz bleibt im Speicher.
//     Genau die Lage des Befunds.
//
// (C) UNABHÄNGIGE SOLLWERTE: die Pflichttexte stehen als Literale hier und werden gegen `i18n.ts`
//     gepinnt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

/** Der neue Offline-Block der Liste. */
const OFFLINE = '[data-testid="bib-offline"]';
/** Der Leerzustand („Nichts gefunden.") samt seinem Knopf. */
const LEER = '[data-testid="bib-leer"]';
const LEER_AKTION = '[data-testid="bib-leer-erfassen"]';
/** Der Satz „Stand von <Zeit> · Auffrischung fehlgeschlagen" — er gehört NICHT in diese Lage. */
const AUFFRISCHUNG = '[data-testid="auffrischung-fehlgeschlagen"]';

const KLARTEXT = {
  offline: "Ohne Verbindung kann gerade nicht gesucht werden.",
  offlineWeiter: "Sobald die Verbindung wieder steht, wird die Suche von selbst fortgesetzt.",
  nichtsGefunden: "Nichts gefunden.",
} as const;

/** Der Suchbegriff aus dem Befund. */
const BEGRIFF = "Lieferanten";

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
  ko({ id: "a", title: "Ventil X schliesst bei Ueberdruck" }),
  ko({ id: "b", title: "Ruehrwerk Y vor der Reinigung entlueften" }),
];

const LIEFERANTEN = [
  ko({ id: "l1", title: "Lieferanten jaehrlich bewerten" }),
  ko({ id: "l2", title: "Lieferantenaudit vorbereiten" }),
];

const lage = vi.hoisted(() => ({ antwort: new Map<string, unknown[]>() }));
const netz = vi.hoisted(() => ({ rufe: [] as string[] }));

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
        queryFn: async () => [...BESTAND, ...LIEFERANTEN],
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: Number.POSITIVE_INFINITY,
      }),
    useLibrarySearch: (params: { q?: string }) =>
      rq.useQuery({
        queryKey: ["library", "search", params],
        queryFn: async () => {
          const suchtext = params.q ?? "";
          netz.rufe.push(suchtext);
          return lage.antwort.get(suchtext) ?? [];
        },
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: Number.POSITIVE_INFINITY,
      }),
    useKo: (id: string) => ok([...BESTAND, ...LIEFERANTEN].find((k) => k.id === id) ?? null),
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

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
let qc: QueryClient;

async function ruhe(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

async function entprellungAbwarten(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, LIBRARY_SEARCH_DEBOUNCE_MS + 60));
  });
  await ruhe();
}

async function bibliothek(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: ["/bibliothek"] }, createElement(Library)),
      ),
    );
  });
  await ruhe();
}

afterEach(() => {
  if (root) {
    const alt = root;
    act(() => {
      alt.unmount();
    });
    root = null;
  }
  container?.remove();
  onlineManager.setOnline(true);
});

beforeEach(() => {
  netz.rufe = [];
  lage.antwort = new Map<string, unknown[]>([["", BESTAND]]);
});

function rufeFuer(suchtext: string): number {
  return netz.rufe.filter((r) => r === suchtext).length;
}

function suchzustand(suchtext: string): { status: string; fetchStatus: string } | null {
  const params = buildLibraryQuery({ ...EMPTY_LIBRARY_FILTER, q: suchtext });
  const st = qc.getQueryState(["library", "search", params]);
  return st ? { status: st.status, fetchStatus: st.fetchStatus } : null;
}

function de(key: string): unknown {
  return i18n.getResource("de", "translation", key);
}

function suchfeldWert(): string {
  const feld = container.querySelector('[data-testid="bib-suche"]');
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error("Suchfeld fehlt");
  }
  return feld.value;
}

/**
 * (B) Offline gehen und die laufende Suche auffrischen lassen. TanStack Query hält den gewollten
 * Abruf dann an (`fetchStatus: "paused"`), statt ihn zu führen — der zuletzt geholte Satz bleibt
 * unangetastet im Speicher liegen. Genau so entsteht der VERALTETE Stand des Befunds.
 */
async function offlineAuffrischen(): Promise<void> {
  onlineManager.setOnline(false);
  await act(async () => {
    void qc.invalidateQueries();
    await new Promise((r) => setTimeout(r, 0));
  });
  await ruhe();
}

// ------------------------------------------------------------------------------------------------
// Der Wortlaut-Pin (C)
// ------------------------------------------------------------------------------------------------
describe("JOB 3531 · Wortlaut-Pin an der Fläche", () => {
  it.each([
    ["lib.liste.offline", KLARTEXT.offline],
    ["lib.liste.offlineWeiter", KLARTEXT.offlineWeiter],
    ["lib.liste.leerSuche", KLARTEXT.nichtsGefunden],
  ])("%s lautet auf Deutsch genau so", (key, soll) => {
    expect(de(key)).toBe(soll);
  });
});

// ------------------------------------------------------------------------------------------------
// F3 — der veraltete LEERE Zwischenspeicher
// ------------------------------------------------------------------------------------------------
describe("JOB 3531 · Q6d F3 — offline behauptet ein leerer alter Speicher nichts mehr über den Bestand", () => {
  it("leer geholt, Server hat inzwischen Treffer, Netz weg → `bib-offline` statt „Nichts gefunden.“", async () => {
    // Schritt 1: online wirklich suchen, Server antwortet leer. Das ist der ehrliche Leerzustand.
    lage.antwort.set(BEGRIFF, []);
    await bibliothek();
    suche(container, BEGRIFF);
    await entprellungAbwarten();

    expect(rufeFuer(BEGRIFF), "online wird wirklich gerufen").toBe(1);
    expect(suchzustand(BEGRIFF)).toEqual({ status: "success", fetchStatus: "idle" });
    expect(container.querySelector(LEER), "bis hier steht der Leerzustand zu Recht").not.toBeNull();

    // Schritt 2: der Server bekommt den Treffer — der Speicher weiss davon nichts.
    lage.antwort.set(BEGRIFF, LIEFERANTEN);

    // Schritt 3: Netz weg, Auffrischung angehalten. Der alte leere Satz liegt weiter im Speicher.
    await offlineAuffrischen();

    expect(
      suchzustand(BEGRIFF),
      "die Lage ist wirklich erreicht: Daten da, Abruf angehalten",
    ).toEqual({ status: "success", fetchStatus: "paused" });
    expect(rufeFuer(BEGRIFF), "offline geht kein zweiter Ruf hinaus").toBe(1);

    // Der Kern: keine Aussage mehr über den Bestand, dafür eine über die Verbindung.
    const block = container.querySelector(OFFLINE);
    expect(block, "der Offline-Block steht da").not.toBeNull();
    expect(block?.textContent).toContain(KLARTEXT.offline);
    expect(block?.textContent).toContain(KLARTEXT.offlineWeiter);

    expect(container.querySelector(LEER), "der Leerzustand ist weg").toBeNull();
    expect(container.textContent).not.toContain(KLARTEXT.nichtsGefunden);
    expect(container.querySelector(LEER_AKTION), "und mit ihm sein Knopf").toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
// F4 — Gegenrichtung: ein Speicher MIT Treffern verliert nichts
// ------------------------------------------------------------------------------------------------
describe("JOB 3531 · Q6d F4 — zwischengespeicherte Treffer bleiben offline stehen", () => {
  it("zwei geholte Zeilen, Netz weg → die Zeilen stehen, KEIN Offline-Block, kein Auffrischungssatz", async () => {
    lage.antwort.set(BEGRIFF, LIEFERANTEN);
    await bibliothek();
    suche(container, BEGRIFF);
    await entprellungAbwarten();
    expect(zeilenTitel(container)).toEqual(LIEFERANTEN.map((k) => k.title));

    await offlineAuffrischen();

    expect(suchzustand(BEGRIFF)).toEqual({ status: "success", fetchStatus: "paused" });
    // REGELN §7: die zuletzt erfolgreich geholten Werte bleiben SICHTBAR.
    expect(zeilenTitel(container), "der geholte Bestand verschwindet nicht").toEqual(
      LIEFERANTEN.map((k) => k.title),
    );
    expect(container.querySelector(OFFLINE), "mit Treffern gibt es nichts zu erklären").toBeNull();
    expect(container.querySelector(LEER)).toBeNull();
    // Der Auffrischungssatz verhält sich wie bisher: offline ist NICHTS fehlgeschlagen, also sagt
    // auch niemand „fehlgeschlagen" (JOB 3072 R4).
    expect(container.querySelector(AUFFRISCHUNG)).toBeNull();
    // Und der Zähler bleibt wie bisher stumm — eine Zahl wäre eine Aussage über den Bestand JETZT.
    expect(listenZaehler(container)).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
// F2b — Lieferung 3 an der echten Fläche: der Suchtext trägt über die Netzrückkehr
// ------------------------------------------------------------------------------------------------
describe("JOB 3531 · Q6d — der Suchtext bleibt und wird von selbst zur Suche", () => {
  it("offline getippt → Block plus Suchtext im Feld; Netz zurück → EIN Ruf und Treffer, ohne erneutes Tippen", async () => {
    lage.antwort.set(BEGRIFF, LIEFERANTEN);
    await bibliothek();

    onlineManager.setOnline(false);
    suche(container, BEGRIFF);
    await entprellungAbwarten();

    expect(suchzustand(BEGRIFF), "neuer Schlüssel, noch nie beantwortet").toEqual({
      status: "pending",
      fetchStatus: "paused",
    });
    expect(rufeFuer(BEGRIFF)).toBe(0);
    expect(container.querySelector(OFFLINE), "der Offline-Block steht da").not.toBeNull();
    expect(suchfeldWert(), "N-0036: der eingetippte Text bleibt stehen").toBe(BEGRIFF);

    // Netz zurück — ohne einen einzigen weiteren Tastendruck.
    await act(async () => {
      onlineManager.setOnline(true);
      await new Promise((r) => setTimeout(r, 0));
    });
    await ruhe();

    expect(rufeFuer(BEGRIFF), "genau ein Abruf, nicht zwei").toBe(1);
    expect(zeilenTitel(container)).toEqual(LIEFERANTEN.map((k) => k.title));
    expect(container.querySelector(OFFLINE), "der Block räumt sich selbst ab").toBeNull();
    expect(suchfeldWert()).toBe(BEGRIFF);
  });
});

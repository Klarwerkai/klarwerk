// @vitest-environment jsdom
// ================================================================================================
// JOB 3099 · Q6c — EIN LEERER BILDSCHIRM IST KEINE LEERE TREFFERLISTE.
// ================================================================================================
//
// DER BEFUND, GEMESSEN VON CODEX AN DER LIVE-FASSUNG (`R-1613-offline-20260905-1955/BEFUND.md`,
// Punkte 3 und 4, 05.09.2026 19:53–19:55 gegen app.klarwerk.ai 1.0.0-beta.1.103, Chromium):
// offline einen bisher unbenutzten Suchbegriff eintippen → links steht „Nichts gefunden." samt
// „Erfassen", und im zweiten Lauf zählte Codex NULL Suchrequests vor der Netzrückkehr. Nach der
// Rückkehr genau EIN `GET /api/library/search?q=Lieferanten` → 200 und zwei sichtbare Einträge,
// ohne jede Datenänderung dazwischen. Der Leerzustand war also verfrüht: die Fläche behauptete ein
// Ergebnis, das sie nie geholt hatte.
//
// DIE URSACHE, DREI VERNEINUNGEN (`BibliothekFlaeche.tsx:719`/`:724`/`:357`): offline ist
// `isLoading` falsch (der Abruf ist `paused`, also nicht `fetching`), `isError` falsch (es wurde
// gar nicht gerufen, nichts konnte scheitern), und `query.data ?? []` macht aus dem fehlenden
// Ergebnis eine leere Trefferliste. Zusammen ergibt das die Aussage „erfolgreich gesucht, nichts
// gefunden" — dieselbe Fehlerklasse, gegen die `lib/eigeneKollision.ts:10-13` geschrieben ist.
//
// WIE HIER GEMESSEN WIRD — und warum nicht mit behaupteten Flags:
//
// (A) ECHTER QueryClient UND ECHTER `onlineManager`. Ein Standbild-Mock („fetchStatus: 'paused'")
//     könnte den Fall gar nicht tragen: der Punkt ist, dass TanStack Query die Lage SELBST
//     einnimmt, wenn ein NEUER Abfrageschlüssel offline entsteht — und dass dabei wirklich kein
//     Ruf hinausgeht. Der Zähler `netz.rufe` hält jeden Ruf mit seinem Suchtext fest; dieselbe
//     Zählweise wie in `tests/vertraulichkeit-klartext/stufe-im-klartext.test.tsx:419`.
//
// (B) DER SCHLÜSSEL TRÄGT DEN SUCHTEXT — genau wie im Produkt (`api/hooks.ts:19`,
//     `["library", "search", params]`). Ohne ihn gäbe es den Fall nicht: erst ein NEUER Schlüssel
//     hat für seinen Suchbegriff noch nie eine Antwort gesehen (`data === undefined`).
//
// (C) DIE ENTPRELLUNG WIRD ECHT ABGEWARTET, nicht übersprungen. `LIBRARY_SEARCH_DEBOUNCE_MS`
//     (300 ms, `lib/useDebouncedValue.ts`) liegt zwischen Tastendruck und neuem Abfrageschlüssel.
//     Ein Test, der die Zeit nicht ablaufen lässt, misst noch den ALTEN Suchbegriff — und wäre
//     wertlos, weil dessen Treffer längst im Zwischenspeicher liegen. Die Fälle warten deshalb mit
//     echten Zeitgebern `DEBOUNCE + 60 ms` ab (keine falschen Timer: der echte QueryClient arbeitet
//     in denselben Makrotasks) und prüfen ZUSÄTZLICH den Abfragezustand am `QueryClient`, damit ein
//     versehentlich zu kurzes Warten als Fehlschlag auffällt und nicht als Erfolg.
//
// (D) UNABHÄNGIGE SOLLWERTE. Die Pflichttexte stehen unten als Literale und werden gegen `i18n.ts`
//     gepinnt (Korrekturpflicht aus JOB 3034 R2): eine Wortlautmutation darf nicht deshalb grün
//     bleiben, weil Test und Fläche dieselbe Tabelle lesen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

/** Der Leerzustand der Liste — genau der Knoten, den der Befund offline sah. */
const LEER = '[data-testid="bib-leer"]';
/** Der Knopf im Leerzustand („Erfassen"). */
const LEER_AKTION = '[data-testid="bib-leer-erfassen"]';

/**
 * (D) Die Pflichttexte, unabhängig von der Produktquelle hingeschrieben.
 */
const KLARTEXT = {
  nichtsGefunden: "Nichts gefunden.",
  erfassen: "Erfassen",
  listeFehler: "Die Liste ließ sich nicht laden.",
  erneut: "Erneut versuchen",
} as const;

/** Der Suchbegriff aus dem Befund — im Ausgangsbestand kommt er NICHT vor. */
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

// Der „Server": zu jedem Suchtext seine Antwort. Was hier nicht steht, beantwortet er leer — so
// entsteht der echte Leerfall (B-3) aus derselben Quelle wie der Treffer-Fall.
const lage = vi.hoisted(() => ({
  antwort: new Map<string, unknown[]>(),
}));

// Jeder wirklich hinausgegangene Suchruf, mit seinem Suchtext. Offline muss diese Liste ruhen.
const netz = vi.hoisted(() => ({
  zustand: "ok" as "ok" | "fehler",
  rufe: [] as string[],
}));

// TEILMOCK (Muster aus `stufe-im-klartext.test.tsx:107`): überschrieben wird nur, was dieser Test
// steuert; die tragenden Abfragen laufen als ECHTE `useQuery` gegen den echten `QueryClient`.
vi.mock("../../apps/web/src/api/hooks", async (importOriginal) => {
  const echt = await importOriginal<Record<string, unknown>>();
  // Dieselbe Modulinstanz wie der Provider unten — sonst hätte der Haken einen anderen
  // Zwischenspeicher als der Test.
  const rq = await import("../../apps/web/node_modules/@tanstack/react-query");
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  const leer = () => ok([]);
  return {
    ...echt,
    // Die zweite Anzeigequelle der Fläche (Zustandswort, Ton, Umschalter). Sie ist beim ersten
    // Abruf da und wird danach nicht mehr angefasst — der Gegenstand dieses Tests ist die SUCHE.
    useKos: () =>
      rq.useQuery({
        queryKey: ["kos", undefined],
        queryFn: async () => [...BESTAND, ...LIEFERANTEN],
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: Number.POSITIVE_INFINITY,
      }),
    // (B) Der Schlüssel trägt den Suchtext, genau wie `api/hooks.ts:17-21`.
    useLibrarySearch: (params: { q?: string }) =>
      rq.useQuery({
        queryKey: ["library", "search", params],
        queryFn: async () => {
          const suchtext = params.q ?? "";
          netz.rufe.push(suchtext);
          if (netz.zustand === "fehler") {
            throw new Error("Netz weg");
          }
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

/** Lässt die angestoßenen Abrufe und die daraus folgenden Renderdurchgänge auslaufen. */
async function ruhe(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

/** (C) Die Entprellung wirklich ablaufen lassen — mit echten Zeitgebern, nicht übersprungen. */
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

beforeEach(() => {
  netz.zustand = "ok";
  netz.rufe = [];
  lage.antwort = new Map<string, unknown[]>([
    ["", BESTAND],
    [BEGRIFF, LIEFERANTEN],
  ]);
});

afterEach(() => {
  abbauen();
  onlineManager.setOnline(true);
});

function leerknoten(): HTMLElement | null {
  const el = container.querySelector(LEER);
  return el instanceof HTMLElement ? el : null;
}

/** Die Zahl der wirklich hinausgegangenen Rufe für DIESEN Suchtext. */
function rufeFuer(suchtext: string): number {
  return netz.rufe.filter((r) => r === suchtext).length;
}

/**
 * Der Zustand der Abfrage zu DIESEM Suchtext, am echten QueryClient abgelesen. Der Schlüssel wird
 * mit demselben Bauer gebildet wie in der Fläche (`buildLibraryQuery`) — ein hier abgeschriebenes
 * Objektliteral wäre eine zweite Fassung desselben Schlüssels und liefe irgendwann auseinander.
 */
function suchzustand(suchtext: string): { status: string; fetchStatus: string } | null {
  const params = buildLibraryQuery({ ...EMPTY_LIBRARY_FILTER, q: suchtext });
  const st = qc.getQueryState(["library", "search", params]);
  return st ? { status: st.status, fetchStatus: st.fetchStatus } : null;
}

function de(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

// ------------------------------------------------------------------------------------------------
// (D) Der Wortlaut-Pin
// ------------------------------------------------------------------------------------------------
describe("JOB 3099 · Wortlaut-Pin — die Pflichttexte stehen unabhängig fest", () => {
  it.each([
    ["lib.liste.leerSuche", KLARTEXT.nichtsGefunden],
    ["lib.liste.erfassen", KLARTEXT.erfassen],
    ["lib.liste.fehler", KLARTEXT.listeFehler],
    ["lib.liste.erneut", KLARTEXT.erneut],
  ])("%s lautet auf Deutsch genau so", (key, soll) => {
    expect(de(key)).toBe(soll);
  });
});

// ------------------------------------------------------------------------------------------------
// B-1 / B-2 — der Befund selbst und seine Gegenprobe
// ------------------------------------------------------------------------------------------------
describe("JOB 3099 · Q6c — offline sagt die Suche nicht „Nichts gefunden“", () => {
  it("B-1: offline, neuer Suchbegriff — kein Leerzustand, keine „Erfassen“-Aktion, NULL Rufe", async () => {
    await bibliothek();
    expect(zeilenTitel(container), "der Ausgangsbestand steht wirklich da").toHaveLength(
      BESTAND.length,
    );

    onlineManager.setOnline(false);
    suche(container, BEGRIFF);
    await entprellungAbwarten();

    // Der Aufbau muss die Lage wirklich erreicht haben: ein NEUER Abfrageschlüssel, angehalten.
    expect(suchzustand(BEGRIFF), "die neue Suchabfrage muss entstanden sein").toEqual({
      status: "pending",
      fetchStatus: "paused",
    });
    expect(rufeFuer(BEGRIFF), "offline geht kein Ruf hinaus").toBe(0);

    expect(leerknoten(), "ein nicht geführter Abruf ist kein leeres Ergebnis").toBeNull();
    expect(container.textContent).not.toContain(KLARTEXT.nichtsGefunden);
    expect(container.querySelector(LEER_AKTION), "kein Knopf ohne Wirkung").toBeNull();
    // Und die Liste behauptet auch keine Zahl — der Zähler steht wie bisher auf „–".
    expect(listenZaehler(container)).toBeNull();
  });

  it("B-2: Netz zurück — genau EIN Ruf für diesen Suchbegriff, danach stehen die Treffer da", async () => {
    await bibliothek();
    onlineManager.setOnline(false);
    suche(container, BEGRIFF);
    await entprellungAbwarten();
    expect(rufeFuer(BEGRIFF)).toBe(0);

    await act(async () => {
      onlineManager.setOnline(true);
      await new Promise((r) => setTimeout(r, 0));
    });
    await ruhe();

    expect(rufeFuer(BEGRIFF), "genau ein Abruf, nicht zwei").toBe(1);
    expect(suchzustand(BEGRIFF)).toEqual({ status: "success", fetchStatus: "idle" });
    expect(zeilenTitel(container)).toEqual(LIEFERANTEN.map((k) => k.title));
    // Die Regel schweigt nur, sie blockiert nichts: der Leerzustand ist auch jetzt nicht da,
    // weil es Treffer gibt.
    expect(leerknoten()).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
// B-3 / B-4 — Bestandsschutz: was diese Regel NICHT stumm machen darf
// ------------------------------------------------------------------------------------------------
describe("JOB 3099 · Bestandsschutz — der echte Leerfall und der Fehlerweg bleiben", () => {
  it("B-3: online, erfolgreicher Abruf ohne Treffer → „Nichts gefunden.“ und „Erfassen“", async () => {
    // Derselbe Weg wie B-1, nur MIT Netz und mit einer leeren Serverantwort.
    lage.antwort.set(BEGRIFF, []);
    await bibliothek();
    suche(container, BEGRIFF);
    await entprellungAbwarten();

    expect(rufeFuer(BEGRIFF), "online wird wirklich gerufen").toBe(1);
    expect(suchzustand(BEGRIFF)).toEqual({ status: "success", fetchStatus: "idle" });
    expect(zeilenTitel(container)).toHaveLength(0);

    const leer = leerknoten();
    expect(leer, "ein wirklich leeres Ergebnis wird gesagt").not.toBeNull();
    expect(leer?.textContent).toContain(KLARTEXT.nichtsGefunden);
    expect(container.querySelector(LEER_AKTION)?.textContent).toContain(KLARTEXT.erfassen);
  });

  it("B-4: online, Erstabruf gescheitert ohne Bestand → Fehlersatz und „Erneut versuchen“", async () => {
    netz.zustand = "fehler";
    await bibliothek();

    expect(rufeFuer(""), "der Abruf ist wirklich hinausgegangen").toBeGreaterThanOrEqual(1);
    expect(suchzustand("")).toEqual({ status: "error", fetchStatus: "idle" });

    expect(container.textContent).toContain(KLARTEXT.listeFehler);
    expect(container.textContent).toContain(KLARTEXT.erneut);
    expect(leerknoten(), "ein Fehler ist kein leeres Ergebnis").toBeNull();
  });
});

// @vitest-environment jsdom
// ================================================================================================
// JOB 2689 D1 — DIE STELLE, AN DER DER MENSCH HANDELT (Abnahme §5)
// ================================================================================================
//
// „Ein Mensch tippt `%` in die Bibliothekssuche und bekommt kein Ergebnis statt aller — und wer
// nach ‚80 % Auslastung' sucht, findet es." Gemessen wird deshalb am Suchfeld der echten
// Bibliotheksseite, nicht am Endpunkt: der Wert wandert durch Debounce und react-query in den
// ECHTEN LibraryService, dessen Treffer aus dem ECHTEN Pg-Adapter kommen — hinter dem ein
// Pool-Doppel steht, das `ILIKE … ESCAPE '\'` nach den LIKE-Regeln auswertet
// (tests/app/job2689-like-doppel.ts). Was das Doppel NICHT ist: eine Datenbank.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import type { KoService } from "../../services/knowledge-object";
import { PgKoSearchProjectionRepo } from "../../services/knowledge-object/src/search-projection-repo-pg";
import { LibraryService } from "../../services/library-analytics";
import { type Abgesetzt, type Suchzeile, likePool } from "./job2689-like-doppel";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Titel",
    statement: "",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
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
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

// Sechzehn Objekte ohne Prozentzeichen — die Groesse des heutigen Beispielbestands (Auftrag §1).
const KOS_OHNE: KnowledgeObject[] = Array.from({ length: 16 }, (_, i) =>
  ko({ id: `ko-${i + 1}`, title: `Ventil ${i + 1} warten`, statement: "Quartalsweise pruefen." }),
);
// Fuenfzehn davon plus EIN Objekt, das wirklich ein Prozentzeichen traegt.
const KOS_MIT: KnowledgeObject[] = [
  ...KOS_OHNE.slice(0, 15),
  ko({
    id: "ko-auslastung",
    title: "80 % Auslastung als Grenze",
    statement: "Ab 80 % Auslastung wird die zweite Linie zugeschaltet.",
    category: "Betrieb",
  }),
];

function zeilen(kos: readonly KnowledgeObject[]): Suchzeile[] {
  return kos.map((k) => ({
    ko_id: k.id,
    title_text: k.title,
    statement_text: k.statement,
    caption_text: "",
    category_text: k.category ?? "",
    tag_text: "",
    status: "validiert",
  }));
}

// Die veraenderliche Lage: welcher Bestand gilt, was der Server gefragt wurde, welches SQL lief.
const lage = vi.hoisted(() => ({
  kos: [] as KnowledgeObject[],
  abrufe: [] as string[],
  abgesetzt: [] as Abgesetzt[],
  suche: undefined as undefined | ((q: string) => Promise<unknown>),
}));

// Die Serverseite: echter LibraryService, echter Pg-Adapter, Pool-Doppel mit LIKE-Auswerter ueber
// dem jeweils geltenden Bestand.
const koService = {
  listForSearch: async () => lage.kos,
  findSearchHits: async (query: { terms: readonly string[]; limit?: number }) => {
    const doppel = likePool(zeilen(lage.kos));
    const treffer = await new PgKoSearchProjectionRepo(doppel.pool).findActive(query);
    lage.abgesetzt.push(...doppel.suchabfragen());
    return treffer;
  },
} as unknown as KoService;
const server = new LibraryService({ koService });
lage.suche = (q: string) => server.search(q);

vi.mock("../../apps/web/src/api/hooks", async () => {
  const { useQuery } = await import("../../apps/web/node_modules/@tanstack/react-query");
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok(lage.kos),
    // Der echte Hook-Vertrag (react-query pro Parameter-Key), nur die Datenquelle ist der Server oben.
    useLibrarySearch: (params: { q?: string }) =>
      useQuery({
        queryKey: ["job2689", "search", params.q ?? ""],
        queryFn: () => {
          lage.abrufe.push(params.q ?? "");
          return lage.suche?.(params.q ?? "") ?? Promise.resolve([]);
        },
      }),
    useDirectory: () => ok([]),
    useConflicts: () => ok([]),
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
import { LIBRARY_SEARCH_DEBOUNCE_MS } from "../../apps/web/src/lib/useDebouncedValue";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: ["/bibliothek"] }, createElement(Library)),
      ),
    );
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  lage.kos = KOS_OHNE;
  lage.abrufe = [];
  lage.abgesetzt = [];
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function text(): string {
  return container.textContent ?? "";
}

function suchfeld(): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>("input#library-search");
  if (!el) {
    throw new Error("Das Suchfeld der Bibliothek ist nicht gerendert");
  }
  return el;
}

async function warte(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

/** Tippt wie ein Mensch: setzt den Wert ueber den nativen Setter und loest `input` aus. */
async function tippe(wert: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(suchfeld(), wert);
    suchfeld().dispatchEvent(new Event("input", { bubbles: true }));
  });
  // Debounce abwarten, dann die Antwort des Servers.
  await warte(LIBRARY_SEARCH_DEBOUNCE_MS + 50);
  for (let i = 0; i < 40 && !lage.abrufe.includes(wert); i++) {
    await warte(25);
  }
  await warte(50);
}

function sichtbareTitel(): string[] {
  const alle = new Set([...KOS_OHNE, ...KOS_MIT].map((k) => k.title));
  return [...alle].filter((t) => text().includes(t));
}

/**
 * Auf den ERSTEN Anstrich der Liste warten — begrenzt, nicht auf gut Glueck.
 *
 * WARUM (JOB 3061 R4, Tor-Befund M1 „expected [] to have a length of 16 but got +0"): M1 wartete
 * nach `mount()` eine feste Frist von 50 ms. Der erste Abruf laeuft aber durch react-query, also
 * ueber mindestens einen Microtask und einen weiteren Anstrich; auf einem ausgelasteten Rechner —
 * im Tor laufen alle Dateien nebenher — reichen 50 ms dafuer nicht, und der Fall meldete null
 * Titel. Einzeln laeuft dieselbe Datei gruen (5/5), was den Zeitverdacht bestaetigt.
 *
 * Gewartet wird deshalb auf das EREIGNIS (die Liste steht) statt auf eine geratene Frist — mit
 * Deckel. Die Zaehne bleiben: kommt gar nichts, laeuft die Schleife aus und M1 faellt wie zuvor;
 * kommen drei Titel statt sechzehn, faellt M1 an seiner Zusicherung. Dieselbe Bauform benutzt
 * `tippe()` seit JOB 2689 fuer die Antwort nach dem Debounce.
 */
async function warteAufBestand(): Promise<void> {
  for (let i = 0; i < 40 && sichtbareTitel().length === 0; i++) {
    await warte(25);
  }
}

describe("JOB 2689 D1 · die Bibliothekssuche am Suchfeld", () => {
  it("M1 · vor dem Tippen zeigt die Seite den Bestand (16 Titel) — die Ausgangslage", async () => {
    mount();
    await warteAufBestand();
    expect(sichtbareTitel()).toHaveLength(16);
  });

  it("M2 · ein Mensch tippt `%`: kein Ergebnis statt aller — und der Server hat maskiert und gedeckelt", async () => {
    mount();
    await tippe("%");
    expect(lage.abrufe).toContain("%");
    // Was der Mensch sieht: kein einziger Titel, und der Nulltreffer nennt seine Eingabe.
    expect(sichtbareTitel()).toHaveLength(0);
    expect(text()).toContain("%");
    // Was der Server tat: `%\%%` als Muster, ESCAPE an jeder Klausel, LIMIT 200.
    const [abfrage] = lage.abgesetzt;
    expect(abfrage?.params[2]).toBe("%\\%%");
    expect(abfrage?.sql).toContain("ESCAPE '\\'");
    expect(abfrage?.params[abfrage.params.length - 1]).toBe(200);
  });

  it("M2b · traegt ein Objekt ein echtes Prozentzeichen, zeigt `%` genau dieses eine — nicht alle 16", async () => {
    lage.kos = KOS_MIT;
    mount();
    await tippe("%");
    expect(sichtbareTitel()).toEqual(["80 % Auslastung als Grenze"]);
  });

  it("M3 · wer „80 % Auslastung“ tippt, findet genau das Objekt mit dem Prozentzeichen", async () => {
    lage.kos = KOS_MIT;
    mount();
    await tippe("80 % Auslastung");
    expect(lage.abrufe).toContain("80 % Auslastung");
    expect(sichtbareTitel()).toEqual(["80 % Auslastung als Grenze"]);
  });

  it("M4 · Gegenprobe ohne Maskierung: dasselbe Doppel liefert bei `%%%` alle 16 — so sah das SQL bis 2689 aus", async () => {
    const { pool } = likePool(zeilen(KOS_OHNE));
    const res = await pool.query(
      "SELECT p.ko_id FROM ko_search_projections p WHERE p.search_text ILIKE $3",
      [2, 5, "%%%"],
    );
    expect(res.rowCount).toBe(16);
  });
});

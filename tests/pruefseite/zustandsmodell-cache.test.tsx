// @vitest-environment jsdom
// ================================================================================================
// JOB 3027 · R2 — DAS ZUSTANDSMODELL DES PRUEFBRETTS AN EINEM ECHTEN QUERYCLIENT.
// ================================================================================================
//
// DER BEFUND AUS RUNDE 1 (BEN, Korrekturpflicht 1): `QueryState` fragt `isError` VOR den Daten
// (`apps/web/src/components/ui.tsx:225-230`). react-query setzt bei einer gescheiterten
// AUFFRISCHUNG `status: "error"` und BEHAELT dabei die Zeilen im Cache — die Pruefseite reichte
// diesen Zustand unveraendert weiter und ersetzte damit vorhandene Karten durch eine Fehlerflaeche.
// Wer gerade eine Freigabe erwog, verlor Karte, Stufe und Herkunft, weil ein HINTERGRUND-Abruf
// scheiterte. Das ist genau der Fall, den der Auftrag in §9 („Cache mit gescheiterter
// Auffrischung": unveraendert dasselbe) ausdruecklich verlangt.
//
// WAS HIER GEMESSEN WIRD, und warum es nicht in der Nachbardatei steht: Diese Faelle brauchen den
// ECHTEN QueryClient samt seinen Uebergaengen — erste erfolgreiche Antwort, dann eine zweite, die
// haengt, scheitert oder wegen `onlineManager` gar nicht erst laeuft. Der Mount-Helfer gibt den
// QueryClient deshalb heraus; die Nachbardatei misst die drei LAGEN, diese hier die ZUSTAENDE.
//
// DIE GRENZE, damit der Fall nicht als Freibrief gelesen wird: Ein ERSTFEHLER OHNE Daten muss die
// Karten weiterhin ersetzen — sonst behauptete die Seite einen Bestand, den sie nie hatte. Fall E1
// haelt genau diese Gegenrichtung fest.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    validation: { board: vi.fn(async () => []), overview: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
    reasoner: {
      status: vi.fn(async () => ({
        active: false,
        mode: "none",
        reachable: "unknown",
        tasks: {},
      })),
    },
    ko: {
      act: vi.fn(async () => ({})),
      aiCheckRetry: vi.fn(async () => ({})),
      remove: vi.fn(async () => ({})),
    },
    // JOB 3061 · H2: der gemeinsame Reiterkopf zaehlt alle vier Reiter aus ECHTEN Abrufen. Diese
    // drei kommen deshalb dazu; sie liefern hier bewusst leere Listen — gemessen wird der Reiter
    // „Offen", die uebrigen duerfen den Lauf nur nicht zerreissen.
    conflicts: { list: vi.fn(async () => []) },
    duplicates: { list: vi.fn(async () => []) },
    lifecycle: { pending: vi.fn(async () => []) },
  },
}));

vi.mock("../../apps/web/src/app/AuthContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/AuthContext")>()),
  useSession: () => ({ user: { id: "u1", name: "Prüfer" }, isLoading: false }) as never,
}));
vi.mock("../../apps/web/src/app/RoleContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/RoleContext")>()),
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }) as never,
}));
vi.mock("../../apps/web/src/app/ToastContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/ToastContext")>()),
  useToast: () => ({ push: () => {} }) as never,
}));

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { ValidationBoardKo } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { Validation } from "../../apps/web/src/pages/Validation";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const de = (key: string): string => String(i18n.getResource("de", "translation", key));

const STUFE = '[data-testid="val-stufe"]';
const HERKUNFT = '[data-testid="val-herkunft"]';
const ZEILE = '[data-testid="validation-row"]';
/** Der ehrliche Hinweis: der Stand steht, aber die letzte Auffrischung ist gescheitert.
 *  JOB 3061 · H2: derselbe Hinweis, neuer Anker — er ist jetzt ein gemeinsames Bauteil der
 *  Pruefflaeche (`components/pruefen/PruefenZustand.tsx`) und steht ueber der Warteschlange. */
const AUFFRISCHUNG = '[data-testid="pruefen-nicht-frisch"]';

const TITEL = "PROBE-KO Ventilwartung";

function zeile(over: Partial<ValidationBoardKo> = {}): ValidationBoardKo {
  return {
    id: "k1",
    title: TITEL,
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 50,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 3,
    assignments: [],
    reviewVotes: { up: 0, warn: 0, down: 0 },
    staleVotes: 0,
    asset: null,
    createdAt: "2026-08-12T00:00:00.000Z",
    history: [],
    confidentiality: "vertraulich",
    confidentialityProvenance: "ko",
    origin: "word_addin",
    originSources: [],
    ...over,
  } as ValidationBoardKo;
}

const board = endpoints.validation.board as unknown as ReturnType<typeof vi.fn>;
const directory = endpoints.directory.list as unknown as ReturnType<typeof vi.fn>;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** Mountet die Seite mit einem ECHTEN QueryClient und gibt ihn zum Steuern der Uebergaenge frei. */
async function mounten(): Promise<void> {
  directory.mockResolvedValue([{ id: "u1", name: "Prüfer" }] as never);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/validierung"] },
          createElement(Validation),
        ),
      ),
    );
  });
  for (let i = 0; i < 8 && container.querySelectorAll(ZEILE).length === 0; i += 1) {
    await flush();
  }
}

/** Erst eine erfolgreiche Antwort — das ist der Cache, um den es in allen drei Faellen geht. */
async function mitCacheZeile(): Promise<void> {
  board.mockResolvedValue([zeile()] as never);
  await mounten();
  // Kalibrierung VOR dem Uebergang: ohne sie liesse sich „bleibt sichtbar" auch dann behaupten,
  // wenn nie etwas sichtbar war.
  expect(container.querySelectorAll(ZEILE)).toHaveLength(1);
  expect(container.querySelector(STUFE)?.textContent?.trim()).toBe(de("conf.level.vertraulich"));
}

/** Eine Auffrischung anstossen und den Uebergang abwarten (Fehler werden nicht geworfen). */
async function auffrischen(): Promise<void> {
  await act(async () => {
    await qc.refetchQueries({ queryKey: ["validation", "board"] }).catch(() => undefined);
  });
  await flush();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  vi.clearAllMocks();
  onlineManager.setOnline(true);
  window.localStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  onlineManager.setOnline(true);
});

// ================================================================================================
// C1 · LAUFENDE AUFFRISCHUNG — die Zeilen bleiben stehen
// ================================================================================================
describe("JOB 3027 R2 · C1: waehrend die Auffrischung laeuft, bleibt der Stand sichtbar", () => {
  it("Karte, Stufe und Herkunft bleiben, solange der zweite Abruf noch offen ist", async () => {
    await mitCacheZeile();

    board.mockImplementation(() => new Promise(() => undefined));
    await act(async () => {
      void qc.refetchQueries({ queryKey: ["validation", "board"] });
    });
    await flush();

    expect(container.textContent).toContain(TITEL);
    expect(container.querySelector(STUFE)?.textContent?.trim()).toBe(de("conf.level.vertraulich"));
    expect(container.querySelector(HERKUNFT)?.textContent).toContain(
      de("ko.originWordAddin.label"),
    );
    // Kein Ladeplatzhalter anstelle der Karten — und keine vorweggenommene Einstufung.
    expect(container.textContent).not.toContain(de("state.loading"));
    expect(container.textContent).not.toContain(de("val.stufe.nichtEingestuft"));
  });
});

// ================================================================================================
// C2 · GESCHEITERTE AUFFRISCHUNG — der Stand bleibt, und der Fehlschlag wird BENANNT
// ================================================================================================
describe("JOB 3027 R2 · C2: eine gescheiterte Auffrischung ersetzt den Stand nicht", () => {
  it("Karte, Stufe und Herkunft bleiben nach einem abgelehnten Abruf sichtbar", async () => {
    await mitCacheZeile();

    board.mockRejectedValue(new Error("Netz weg") as never);
    await auffrischen();

    expect(container.querySelectorAll(ZEILE)).toHaveLength(1);
    expect(container.textContent).toContain(TITEL);
    expect(container.querySelector(STUFE)?.textContent?.trim()).toBe(de("conf.level.vertraulich"));
    expect(container.querySelector(HERKUNFT)?.textContent).toContain(
      de("ko.originWordAddin.label"),
    );
  });

  it("der Fehlschlag verschwindet nicht still — die Seite sagt, dass der Stand nicht frisch ist", async () => {
    await mitCacheZeile();

    board.mockRejectedValue(new Error("Netz weg") as never);
    await auffrischen();

    const hinweis = container.querySelector(AUFFRISCHUNG);
    expect(hinweis?.textContent).toBe(de("pruefen.refreshFailed"));
  });

  it("ohne Fehlschlag steht der Hinweis NICHT da — er ist kein Dauerinventar", async () => {
    await mitCacheZeile();

    expect(container.querySelectorAll(AUFFRISCHUNG)).toHaveLength(0);
  });

  it("nach einer wieder erfolgreichen Auffrischung ist der Hinweis weg", async () => {
    await mitCacheZeile();
    board.mockRejectedValue(new Error("Netz weg") as never);
    await auffrischen();
    expect(container.querySelectorAll(AUFFRISCHUNG)).toHaveLength(1);

    board.mockResolvedValue([
      zeile({ confidentiality: null, confidentialityProvenance: "unknown" }),
    ] as never);
    await auffrischen();

    expect(container.querySelectorAll(AUFFRISCHUNG)).toHaveLength(0);
    // Und die neue Antwort ist wirklich angekommen: die Stufe hat sich geaendert.
    expect(container.querySelector(STUFE)?.textContent?.trim()).toBe(
      de("val.stufe.nichtEingestuft"),
    );
  });
});

// ================================================================================================
// C3 · PAUSIERT (offline) — dasselbe, ohne jede neue Behauptung
// ================================================================================================
describe("JOB 3027 R2 · C3: offline pausiert die Auffrischung und laesst den Stand stehen", () => {
  it("Karte, Stufe und Herkunft bleiben, wenn der Abruf gar nicht erst startet", async () => {
    await mitCacheZeile();

    onlineManager.setOnline(false);
    board.mockRejectedValue(new Error("darf gar nicht laufen") as never);
    await act(async () => {
      void qc.refetchQueries({ queryKey: ["validation", "board"] });
    });
    await flush();

    expect(container.querySelectorAll(ZEILE)).toHaveLength(1);
    expect(container.querySelector(STUFE)?.textContent?.trim()).toBe(de("conf.level.vertraulich"));
    expect(container.querySelector(HERKUNFT)?.textContent).toContain(
      de("ko.originWordAddin.label"),
    );
    // Pausiert ist KEIN Fehlschlag: der Hinweis aus C2 gehoert hier nicht hin.
    expect(container.querySelectorAll(AUFFRISCHUNG)).toHaveLength(0);
  });
});

// ================================================================================================
// C4 · DER LEERE CACHE IST AUCH EIN CACHE (JOB 3027 R3, BEN-Korrekturpflicht)
// ================================================================================================
//
// DER BEFUND AUS RUNDE 2: Die Seite erkannte „Bestand vorhanden" an der ZEILENZAHL. Eine
// erfolgreich geladene LEERE Antwort ist aber genauso eine belegte Auskunft wie eine mit zehn
// Zeilen — sie sagt „hier ist gerade nichts offen". Scheiterte danach die Auffrischung, wurde aus
// dieser belegten Aussage die Erstfehlerflaeche („Etwas ist schiefgelaufen"), und der Mensch davor
// konnte nicht mehr unterscheiden, ob nichts zu pruefen ist oder ob nichts geladen werden konnte.
// Dieselbe Lehre steht seit JOB 3002 R3/R4 im Haus: „alter Leer-Cache plus abgelehnter Refetch"
// (LEHREN.md).
//
// DIE UNTERSCHEIDUNG LIEGT DESHALB AN DER QUERY-LAGE (`query.data !== undefined`) und nicht an
// einer Zeilenzahl: `undefined` heisst „nie eine Antwort gehabt", `[]` heisst „eine Antwort gehabt,
// sie war leer".
describe("JOB 3027 R3 · C4: eine erfolgreich geladene LEERE Antwort ist Bestand", () => {
  /** Erst eine erfolgreiche LEERE Antwort — der Leerzustand ist danach belegt, nicht geraten. */
  async function mitLeeremCache(): Promise<void> {
    board.mockResolvedValue([] as never);
    await mounten();
    // Kalibrierung VOR dem Uebergang.
    expect(container.textContent).toContain(de("val.empty"));
    expect(container.textContent).not.toContain(de("pruefen.loadError"));
  }

  it("nach einem abgelehnten Abruf bleibt der Leerzustand — und wird nicht zum Erstfehler", async () => {
    await mitLeeremCache();

    board.mockRejectedValue(new Error("Netz weg") as never);
    await auffrischen();

    expect(container.textContent).toContain(de("val.empty"));
    expect(container.textContent).not.toContain(de("pruefen.loadError"));
  });

  it("und der Fehlschlag wird auch hier benannt", async () => {
    await mitLeeremCache();

    board.mockRejectedValue(new Error("Netz weg") as never);
    await auffrischen();

    expect(container.querySelector(AUFFRISCHUNG)?.textContent).toBe(de("pruefen.refreshFailed"));
  });

  it("solange nichts scheitert, steht der Hinweis auch am leeren Brett nicht da", async () => {
    await mitLeeremCache();

    expect(container.querySelectorAll(AUFFRISCHUNG)).toHaveLength(0);
  });
});

// ================================================================================================
// E1 · DIE GEGENRICHTUNG — ein Erstfehler OHNE Daten ersetzt die Karten weiterhin
// ================================================================================================
describe("JOB 3027 R2 · E1: ohne je geladenen Bestand bleibt der Fehlerzustand der Fehlerzustand", () => {
  it("der erste Abruf scheitert: keine Karte, keine Stufe, keine Herkunft, kein Cache-Hinweis", async () => {
    board.mockRejectedValue(new Error("Netz weg") as never);
    await mounten();
    await flush();

    expect(container.querySelectorAll(ZEILE)).toHaveLength(0);
    expect(container.querySelectorAll(STUFE)).toHaveLength(0);
    expect(container.querySelectorAll(HERKUNFT)).toHaveLength(0);
    expect(container.querySelectorAll(AUFFRISCHUNG)).toHaveLength(0);
    expect(container.textContent).toContain(de("pruefen.loadError"));
  });
});

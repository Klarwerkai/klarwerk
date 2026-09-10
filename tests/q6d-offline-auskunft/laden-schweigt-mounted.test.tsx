// @vitest-environment jsdom
// ================================================================================================
// JOB 3559 · Q6d — DIE DRITTE OFFLINE-LAGE: WÄHREND DES LADENS SAGT DIE LISTE GAR NICHTS.
// ================================================================================================
//
// DIE LÜCKE, DIE HIER GESCHLOSSEN WIRD. JOB 3531 hat den Offline-Satz der Liste gebaut und seine
// beiden ersten Lagen gemessen (`liste-sagt-offline-mounted.test.tsx`, `veralteter-leerer-cache-
// mounted.test.tsx`). Die dritte Lage hat er ausdrücklich als UNGEMESSEN ausgewiesen
// (`archiv/3531/runde-1/RUECKGABE.md`, REST: „Nicht gemessen: der Zusammenfall von `pausiert` und
// `keimWartet`. `!laedt` schaltet den Block dort ab; das ist gewollt … aber kein Fall hält es
// fest."). Genau dieser Fall steht jetzt hier.
//
// DIE ZUSAGE (Zustandsmodell, Lage „laden"): solange geladen wird, behauptet die Liste WEDER etwas
// über die Verbindung NOCH etwas über den Bestand. Kein `bib-offline`, kein `bib-leer`, kein
// „Nichts gefunden.". Erst wenn das Laden vorbei ist, darf der Verbindungssatz erscheinen.
//
// WIE DIE LAGE WIRKLICH ENTSTEHT — und warum sie nicht gestellt, sondern gefahren wird. Die Liste
// bekommt zwei getrennte Eigenschaften gereicht (`BibliothekFlaeche.tsx`):
//   `laedt={query.isLoading || keimWartet}`  (:1373)
//   `pausiert={angehalten(query) && (query.data === undefined || query.data.length === 0)}` (:1424)
// `query.isLoading` kann in dieser Lage gar nicht wahr sein: ein angehaltener Abruf ist nicht
// „fetching", also ist `isLoading` falsch (gemessen — genau darauf beruht der Offline-Block in
// `veralteter-leerer-cache-mounted.test.tsx`). Der EINZIGE Weg, unter dem `laedt` und `pausiert`
// zugleich gelten, ist `keimWartet`: eine Adresse, die einen Facettenwert mitbringt
// (`?category=…`), der erst gegen den geladenen BESTAND geprüft werden darf (JOB 3115). Solange
// der Bestandsabruf läuft, wartet die Fläche — und schweigt.
//
// Beides läuft hier an der ECHTEN Fläche mit ECHTEM `onlineManager` und ECHTEM QueryClient; der
// Bestandsabruf hängt an einem Tor, das der Test öffnet. Der Suchabruf ist zwischen den beiden
// Messpunkten NACHWEISLICH unverändert (`suchzustand`) — der einzige Unterschied ist das Ende des
// Ladens. Damit misst der Fall die Regel `!laedt` und nichts daneben.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

/** Der Offline-Block der Liste. */
const OFFLINE = '[data-testid="bib-offline"]';
/** Der Leerzustand („Nichts gefunden.") samt seinem Knopf. */
const LEER = '[data-testid="bib-leer"]';
const LEER_AKTION = '[data-testid="bib-leer-erfassen"]';

/** Unabhängige Sollwerte (wie in den Nachbardateien): der Test liest den WERT, nicht den Schlüssel. */
const KLARTEXT = {
  offline: "Ohne Verbindung kann gerade nicht gesucht werden.",
  offlineWeiter: "Sobald die Verbindung wieder steht, wird die Suche von selbst fortgesetzt.",
  nichtsGefunden: "Nichts gefunden.",
} as const;

const BEGRIFF = "Lieferanten";
/** Der Bereich, den die Adresse mitbringt — er kommt im Bestand wirklich vor. */
const BEREICH = "Anlage 1";

function ko(overrides: Record<string, unknown>): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Ventil X schliesst bei Ueberdruck",
    statement: "Bei Ueberdruck Ventil X manuell schliessen.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: BEREICH,
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

const lage = vi.hoisted(() => ({ antwort: new Map<string, unknown[]>() }));
const netz = vi.hoisted(() => ({ rufe: [] as string[] }));

/**
 * Das Tor vor dem BESTANDSABRUF. Kein `networkMode`-Kniff und kein gesetzter Zustand: der Abruf
 * läuft wirklich und ist wirklich noch nicht fertig, solange das Tor zu ist. Genau das ist die
 * Lage „es wird noch geladen".
 */
const bestandsTor = vi.hoisted(() => {
  let oeffner: () => void = () => {};
  let versprechen: Promise<void> = Promise.resolve();
  return {
    schliessen(): void {
      versprechen = new Promise<void>((r) => {
        oeffner = r;
      });
    },
    oeffnen(): void {
      oeffner();
    },
    warten(): Promise<void> {
      return versprechen;
    },
  };
});

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
          await bestandsTor.warten();
          return BESTAND;
        },
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
import { Library } from "../../apps/web/src/pages/Library";

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

async function bibliothek(adresse: string): Promise<void> {
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
        createElement(MemoryRouter, { initialEntries: [adresse] }, createElement(Library)),
      ),
    );
  });
  await ruhe();
}

beforeEach(() => {
  netz.rufe = [];
  lage.antwort = new Map<string, unknown[]>([
    ["", BESTAND],
    // Der Server hat zu diesem Begriff wirklich nichts — der Leerzustand wäre online berechtigt.
    // Offline darf er trotzdem nicht dastehen, und WÄHREND DES LADENS erst recht nicht.
    [BEGRIFF, []],
  ]);
  bestandsTor.schliessen();
});

afterEach(() => {
  bestandsTor.oeffnen();
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

function suchzustand(suchtext: string): { status: string; fetchStatus: string } | null {
  const params = buildLibraryQuery({ ...EMPTY_LIBRARY_FILTER, q: suchtext });
  const st = qc.getQueryState(["library", "search", params]);
  return st ? { status: st.status, fetchStatus: st.fetchStatus } : null;
}

function bestandszustand(): { status: string; fetchStatus: string } | null {
  const st = qc.getQueryState(["kos", undefined]);
  return st ? { status: st.status, fetchStatus: st.fetchStatus } : null;
}

function de(key: string): unknown {
  return i18n.getResource("de", "translation", key);
}

/** Offline gehen und NUR die Suche auffrischen lassen — der Bestandsabruf bleibt unberührt. */
async function offlineSucheAuffrischen(): Promise<void> {
  onlineManager.setOnline(false);
  await act(async () => {
    void qc.invalidateQueries({ queryKey: ["library", "search"] });
    await new Promise((r) => setTimeout(r, 0));
  });
  await ruhe();
}

// ------------------------------------------------------------------------------------------------
// Der Wortlaut-Pin — dieselben unabhängigen Sollwerte wie in den Nachbardateien.
// ------------------------------------------------------------------------------------------------
describe("JOB 3559 · Wortlaut-Pin", () => {
  it.each([
    ["lib.liste.offline", KLARTEXT.offline],
    ["lib.liste.offlineWeiter", KLARTEXT.offlineWeiter],
    ["lib.liste.leerSuche", KLARTEXT.nichtsGefunden],
  ])("%s lautet auf Deutsch genau so", (key, soll) => {
    expect(de(key)).toBe(soll);
  });
});

// ------------------------------------------------------------------------------------------------
// F5 — die dritte Lage: laden schweigt, danach spricht der Verbindungssatz
// ------------------------------------------------------------------------------------------------
describe("JOB 3559 · Q6d F5 — offline WÄHREND des Ladens behauptet die Liste gar nichts", () => {
  it("Bestand lädt noch, Suche angehalten → weder `bib-offline` noch `bib-leer`; Laden fertig → `bib-offline`", async () => {
    // Die Adresse bringt einen Facettenwert mit, der gegen den Bestand geprüft werden muss
    // (JOB 3115) — deshalb wartet die Fläche auf den Bestandsabruf und meldet `laedt`.
    await bibliothek(`/bibliothek?q=${BEGRIFF}&category=${encodeURIComponent(BEREICH)}`);

    // Die Lage ist wirklich „es wird noch geladen": der Bestandsabruf läuft, er ist nicht fertig.
    expect(bestandszustand(), "der Bestandsabruf läuft wirklich noch").toEqual({
      status: "pending",
      fetchStatus: "fetching",
    });

    await offlineSucheAuffrischen();

    // Und die Suche ist wirklich angehalten — das ist die Lage, in der der Verbindungssatz sonst
    // erscheint (so gemessen in `veralteter-leerer-cache-mounted.test.tsx`).
    const zustandVorher = suchzustand(BEGRIFF);
    expect(zustandVorher, "die Suche ist angehalten, nicht gescheitert").toEqual({
      status: "success",
      fetchStatus: "paused",
    });
    expect(bestandszustand(), "und der Bestand lädt weiter").toEqual({
      status: "pending",
      fetchStatus: "fetching",
    });

    // ── DER KERN, ERSTE HÄLFTE: solange geladen wird, steht KEINE Aussage da. ───────────────────
    expect(
      container.querySelector(OFFLINE),
      "während des Ladens sagt die Liste nichts über die Verbindung",
    ).toBeNull();
    expect(container.textContent).not.toContain(KLARTEXT.offline);
    expect(
      container.querySelector(LEER),
      "während des Ladens sagt die Liste nichts über den Bestand",
    ).toBeNull();
    expect(container.textContent).not.toContain(KLARTEXT.nichtsGefunden);
    expect(container.querySelector(LEER_AKTION)).toBeNull();

    // ── Das Laden endet. Am Netz ändert sich dabei NICHTS. ─────────────────────────────────────
    bestandsTor.oeffnen();
    await ruhe();

    expect(bestandszustand(), "der Bestand ist da").toEqual({
      status: "success",
      fetchStatus: "idle",
    });
    expect(
      suchzustand(BEGRIFF),
      "die Suche ist unverändert angehalten — das Laden ist der einzige Unterschied",
    ).toEqual(zustandVorher);
    expect(
      netz.rufe.filter((r) => r === BEGRIFF).length,
      "offline geht kein zweiter Ruf hinaus",
    ).toBe(1);

    // ── DER KERN, ZWEITE HÄLFTE: jetzt erst spricht der Verbindungssatz. ───────────────────────
    const block = container.querySelector(OFFLINE);
    expect(block, "nach dem Laden steht der Verbindungssatz da").not.toBeNull();
    expect(block?.textContent).toContain(KLARTEXT.offline);
    expect(block?.textContent).toContain(KLARTEXT.offlineWeiter);
    // Und weiterhin keine Aussage über den Bestand.
    expect(container.querySelector(LEER)).toBeNull();
    expect(container.textContent).not.toContain(KLARTEXT.nichtsGefunden);
  });

  it("Gegenrichtung: ohne wartenden Bestand steht der Verbindungssatz sofort da", async () => {
    // Dieselbe Netzlage, nur ohne den zu prüfenden Facettenwert in der Adresse — dann wartet die
    // Fläche auf nichts, `laedt` ist falsch, und der Block erscheint ohne Zutun. Das belegt, dass
    // das Schweigen oben WIRKLICH am Ladezustand hängt und nicht an der Netzlage.
    bestandsTor.oeffnen();
    await bibliothek(`/bibliothek?q=${BEGRIFF}`);
    await offlineSucheAuffrischen();

    expect(suchzustand(BEGRIFF)).toEqual({ status: "success", fetchStatus: "paused" });
    expect(container.querySelector(OFFLINE), "ohne Warten spricht die Liste sofort").not.toBeNull();
    expect(container.querySelector(LEER)).toBeNull();
  });
});

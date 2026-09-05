// @vitest-environment jsdom
// ================================================================================================
// JOB 3063 · H4 RUNDE 6 — WAS `ko` AUF `/fragen` IST: EIN HERKUNFTSMARKER, KEIN FILTER.
// ================================================================================================
//
// BENS PRÜFLÜCKE ZU RUNDE 5 (Punkt 6): „Die Zielseite `Ask.tsx:137-138,307-308` liest derzeit `q`,
// aber nicht `ko`; ein Folgetest sollte klären, ob `ko` lediglich Deep-Link-Metadatum ist oder die
// Antwortauswahl tatsächlich einschränken soll."
//
// DIE ANTWORT, GEMESSEN STATT BEHAUPTET: `ko` ist ein HERKUNFTSMARKER. Er sagt, WOHER die Frage
// kommt (welcher Eintrag offen war, als jemand „Fragen" drückte); er schränkt die Antwort NICHT
// ein. Dieser Fall misst den ganzen Weg an der echten Fläche: Klick auf „Fragen" in der Bibliothek
// → die dabei entstandene Adresse → die ECHTE Ask-Seite → der Anfragevertrag, der wirklich
// hinausgeht (`endpoints.ask.ask(frage, sprache)`, Ask.tsx:307-308).
//   · Was ankommt: die vorbelegte Frage.
//   · Was NICHT ankommt: die Kennung des Eintrags — in keinem Argument.
// Damit steht die Zusage nicht nur im Kommentar, sondern unter Messung: wer später „die Antwort ist
// auf diesen Eintrag beschränkt" behaupten will, muss diesen Fall ändern.
//
// WARUM ES IN DIESEM AUFTRAG DABEI BLEIBT: `apps/web/src/pages/Ask.tsx` liegt AUSSERHALB der
// Zielpfade (§4). Eine echte Bindung wäre eine Änderung an der Ask-Seite UND an ihrem
// Anfragevertrag — das ist ein eigener Auftrag, keine Nebenwirkung einer Bibliotheks-Runde. Bis
// dahin ist die ehrliche Fassung genau diese: der Marker reist mit, und keine Fläche verspricht
// etwas über ihn (deshalb misst Fall 1 auch, dass die Kennung auf der Ask-Seite nirgends steht).
//
// NICHT VAKUÖS: Fall 3 verstellt die Frage und zeigt, dass derselbe Spy den Unterschied SEHEN
// würde — die Gleichheit in Fall 2 ist damit eine Aussage über `ko`, nicht über einen blinden Spy.
import { afterEach, describe, expect, it, vi } from "vitest";

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
    // „intern" ist die Stufe, für die der Knopf den Auto-Antwort-Weg (`ask=1`) baut
    // (`isKnownNonConfidential`, lib/confidentiality.ts:44) — nur so geht überhaupt eine Anfrage
    // hinaus, deren Vertrag dieser Fall lesen kann.
    confidentiality: "intern",
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

// Zwei Kennungen, die in keinem anderen sichtbaren Text vorkommen — sonst hieße „nicht enthalten"
// nichts.
const KO_EINS = ko({ id: "k-marker-4711", title: "Ventil X bei Überdruck schließen" });
const KO_ZWEI = ko({ id: "k-marker-0815", title: "Rührwerk Y vor der Reinigung entlüften" });
const KOS = [KO_EINS, KO_ZWEI];

const STATUS_MIT_MODELL = {
  active: true,
  mode: "cloud",
  reachable: "active",
  tasks: { answer: true },
};

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok(KOS),
    useLibrarySearch: () => ok(KOS),
    useDirectory: () => ok([{ id: "u9", name: "Eva" }]),
    useConflicts: () => ok([]),
    // JOB 3068 (N5): die Lesefläche fragt das eigene Signal jetzt selbst — leer heißt „kein Befund".
    useEigeneBefunde: () => ok([]),
    useKo: (id: string) => ok(KOS.find((k) => k.id === id)),
    useAudit: () => ok([]),
    // Ohne nutzbares Modell feuert der Auto-Ask bewusst NICHT (Ask.tsx:437-441) — dann gäbe es
    // keinen Anfragevertrag zu messen. Hier ist eins da.
    useReasonerStatus: () => ok(STATUS_MIT_MODELL),
  };
});
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => []) },
    conflicts: { list: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
    reasoner: { status: vi.fn(async () => STATUS_MIT_MODELL) },
    ask: {
      ask: vi.fn(async () => ({
        result: {
          answered: false,
          answer: null,
          knowledgeClass: "unbekannt",
          trust: 0,
          sources: [],
          steps: [],
          demo: true,
        },
        gap: null,
      })),
      helpful: vi.fn(async () => undefined),
    },
  },
}));
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
import type { ReactElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
// Der Import richtet die i18n-Instanz ein — ohne ihn stünde in jedem Knopf der SCHLÜSSEL.
import "../../apps/web/src/i18n";
import {
  isConfidentialAskPrefill,
  readAskQuestion,
  shouldAutoAskFromSearch,
} from "../../apps/web/src/lib/askQuestion";
import { Ask } from "../../apps/web/src/pages/Ask";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const askMock = endpoints.ask.ask as unknown as ReturnType<typeof vi.fn>;

/** Der Suchtext steht in der Adresse — die Fläche liest ihn dort (BibliothekFlaeche.tsx:160). */
const SUCHTEXT = "Spritzzone reinigen";

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function mount(href: string, seite: ReactElement): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [href] }, seite),
      ),
    );
  });
}

function abbauen(): void {
  if (root) {
    act(() => {
      root?.unmount();
    });
    root = null;
  }
  container?.remove();
  container = null;
}

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

/** Der echte Weg zur Adresse: Bibliothek mit Suchtext öffnen, Zeile anklicken, Knopf auslesen. */
function fragenAdresse(koId: string): string {
  mount(`/bibliothek?q=${encodeURIComponent(SUCHTEXT)}`, createElement(Library));
  const zeile = container?.querySelector(`[data-testid="bib-zeile"][data-bib-id="${koId}"]`);
  if (!(zeile instanceof HTMLElement)) {
    throw new Error(`Zeile „${koId}" fehlt; vorhanden: ${container?.textContent}`);
  }
  act(() => {
    zeile.click();
  });
  const a = container?.querySelector('[data-testid="bib-fragen"]');
  if (!(a instanceof HTMLAnchorElement)) {
    throw new Error(`Knopf „Fragen" ist kein Link; DOM: ${container?.textContent}`);
  }
  const href = a.getAttribute("href") ?? "";
  abbauen();
  return href;
}

/** Die ECHTE Ask-Seite unter dieser Adresse öffnen und alle Effekte zur Ruhe kommen lassen. */
async function askOeffnen(href: string): Promise<void> {
  mount(href, createElement(Ask));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

function frageFeld(): HTMLInputElement {
  const input = container?.querySelector("form input");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Frage-Eingabe nicht gefunden; DOM: ${container?.textContent}`);
  }
  return input;
}

/** Der Anfragevertrag dieses Laufs: exakt die Argumente, mit denen `/api/ask` gerufen wurde. */
function anfragevertrag(): unknown[][] {
  return askMock.mock.calls as unknown[][];
}

/** Dieselbe Adresse mit ausgetauschtem oder entferntem `ko` — sonst Zeichen für Zeichen gleich. */
function mitMarker(href: string, wert: string | null): string {
  const url = new URL(href, "http://klarwerk.test");
  if (wert === null) {
    url.searchParams.delete("ko");
  } else {
    url.searchParams.set("ko", wert);
  }
  return `${url.pathname}${url.search}`;
}

describe("JOB 3063 · H4 R6 · `ko` auf /fragen ist Herkunft, nicht Einschränkung", () => {
  it("1 · Klick-durch: die Frage reist in den Anfragevertrag, die Kennung des Eintrags NICHT", async () => {
    const href = fragenAdresse(KO_EINS.id);
    const url = new URL(href, "http://klarwerk.test");
    expect(url.pathname).toBe("/fragen");
    expect(url.searchParams.get("ko")).toBe(KO_EINS.id);
    expect(url.searchParams.get("q")).toBe(SUCHTEXT);
    expect(url.searchParams.get("ask")).toBe("1");

    await askOeffnen(href);
    // Die Frage ist angekommen — vorbelegt im Feld und einmal gesendet.
    expect(frageFeld().value).toBe(SUCHTEXT);
    expect(anfragevertrag()).toEqual([[SUCHTEXT, "de"]]);
    // DER KERN: die Kennung steht in KEINEM Argument der Anfrage …
    expect(JSON.stringify(anfragevertrag())).not.toContain(KO_EINS.id);
    // … und die Fläche behauptet auch nirgends einen Bezug auf diesen Eintrag.
    expect(container?.textContent ?? "").not.toContain(KO_EINS.id);
  });

  it("2 · derselbe Marker, ein fremder Marker und gar kein Marker ergeben DENSELBEN Anfragevertrag", async () => {
    const href = fragenAdresse(KO_EINS.id);
    const vertraege: unknown[][][] = [];
    for (const marker of [KO_EINS.id, KO_ZWEI.id, null]) {
      await askOeffnen(mitMarker(href, marker));
      vertraege.push(anfragevertrag().map((args) => [...args]));
      abbauen();
      vi.clearAllMocks();
    }
    for (const vertrag of vertraege) {
      expect(vertrag).toEqual([[SUCHTEXT, "de"]]);
    }
    expect(vertraege[1]).toEqual(vertraege[0]);
    expect(vertraege[2]).toEqual(vertraege[0]);
  });

  it("3 · KALIBRIERUNG: eine andere Frage ändert den Anfragevertrag sofort — der Spy ist scharf", async () => {
    const href = fragenAdresse(KO_EINS.id);
    const andere = new URL(href, "http://klarwerk.test");
    andere.searchParams.set("q", "Wie oft wird das Rührwerk gewartet?");
    await askOeffnen(`${andere.pathname}${andere.search}`);
    expect(anfragevertrag()).toEqual([["Wie oft wird das Rührwerk gewartet?", "de"]]);
    expect(anfragevertrag()).not.toEqual([[SUCHTEXT, "de"]]);
  });

  it("4 · die drei Leser der /fragen-Adresse kennen `ko` nicht — es gibt keinen Zweig über ihn", () => {
    const ohne = new URLSearchParams({ q: SUCHTEXT, ask: "1" });
    const mit = new URLSearchParams({ q: SUCHTEXT, ask: "1", ko: KO_EINS.id });
    expect(readAskQuestion(mit)).toBe(readAskQuestion(ohne));
    expect(shouldAutoAskFromSearch(mit)).toBe(shouldAutoAskFromSearch(ohne));
    expect(isConfidentialAskPrefill(mit)).toBe(isConfidentialAskPrefill(ohne));
    // Und die Vorbelegung ist wirklich die Frage — sonst prüften die drei Zeilen nur `null === null`.
    expect(readAskQuestion(mit)).toBe(SUCHTEXT);
    expect(shouldAutoAskFromSearch(mit)).toBe(true);
  });
});

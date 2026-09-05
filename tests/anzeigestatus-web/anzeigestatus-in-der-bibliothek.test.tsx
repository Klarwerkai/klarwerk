// @vitest-environment jsdom
// ================================================================================================
// JOB 3072 · N4 — DER ERHOBENE ZUSTAND STEHT IN DER BIBLIOTHEK: ZEILE, PILLE, UMSCHALTER.
// ================================================================================================
//
// PEDIS ZEILE N4: „Jeder Eintrag zeigt seinen echten Zustand: Entwurf, offen, in Prüfung,
// validiert, abgelehnt, Re-Validierung, Konflikt." Gemessen wird hier NICHT, dass ein Feld
// verdrahtet ist, sondern dass an der gemounteten Fläche das WORT dasteht: in der Listenzeile
// links (`[data-bib-text="zeile-meta"]`), im Punkt daneben (`[data-testid="bib-punkt"]`), in der
// Pille auf der Lesefläche (`[data-testid="bib-pille"]`) und in der Zugehörigkeit zum
// Segment-Umschalter — alles aus DERSELBEN Zahl.
//
// ------------------------------------------------------------------------------------------------
// DER AUFBAU SPIEGELT DEN ECHTEN DRAHT — und das ist der Kern dieser Datei
// ------------------------------------------------------------------------------------------------
// Die Liste der Fläche kommt NICHT aus `GET /api/kos`, sondern aus `GET /api/library/search`
// (`BibliothekFlaeche.tsx:252`, `useLibrarySearch`). Diese Route reicht die Projektion ungefiltert
// durch (`services/app/src/routes/library-routes.ts:331-338`) und erhebt den Anzeigestatus NICHT.
// Erhoben wird er an `GET /api/kos` (`ko-routes.ts:843-847`) und `GET /api/kos/:id` (`:902`).
//
// Deshalb liefern die beiden Mocks hier VERSCHIEDENE Objekte für dieselben Einträge:
//   `useLibrarySearch` → ohne `anzeigestatus` (wie die Suchroute wirklich antwortet)
//   `useKos`/`useKo`   → mit `anzeigestatus` (wie die Leserouten wirklich antworten)
// Eine Probe, die der Suche das Feld unterschöbe, wäre grün — und das Produkt bliebe blind.
//
// ------------------------------------------------------------------------------------------------
// DIE KALIBRIERUNG: sieben Einträge, sechs verschiedene Wörter
// ------------------------------------------------------------------------------------------------
// Vier davon (`pruefung`, `abgelehnt`, `revalidierung` und der Konfliktfall im Segment) waren vor
// diesem Auftrag auf dieser Fläche UNERREICHBAR. Zwei weitere (`k-offen`, `k-ohne`) stehen daneben,
// damit eine Fläche, die pauschal ein Wort zeichnet, durchfällt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Conflict, KnowledgeObject } from "../../apps/web/src/api/types";

/** Der gespeicherte Kern-Enum eines Eintrags — mehr trägt die Suchroute nicht bei. */
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
    status: "offen",
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
  } as KnowledgeObject;
}

/** Die Herkunft, wie sie unterhalb des Listendeckels aussieht: nur `konflikt` bleibt ungeprüft. */
const HERKUNFT_ERHOBEN = {
  status: "geprueft",
  zuweisungen: "geprueft",
  bewertungen: "geprueft",
  konflikt: "ungeprueft",
  revalidierung: "geprueft",
  ungeprueft: { konflikt: "Der Konfliktweg wird derzeit umgebaut (JOB 3002)." },
} as const;

/** Die Herkunft über dem Deckel von 200: alle vier beschafften Eingänge tragen den Deckelgrund. */
const DECKEL =
  "Diese Liste fuehrt 201 sichtbare Eintraege und liegt damit ueber dem Deckel von 200.";
const HERKUNFT_DECKEL = {
  status: "geprueft",
  zuweisungen: "ungeprueft",
  bewertungen: "ungeprueft",
  konflikt: "ungeprueft",
  revalidierung: "ungeprueft",
  ungeprueft: {
    zuweisungen: DECKEL,
    bewertungen: DECKEL,
    konflikt: DECKEL,
    revalidierung: DECKEL,
  },
} as const;

// ---- Der Bestand, wie ihn die SUCHE liefert (ohne erhobenen Anzeigestatus) ----------------------
const SUCHE: readonly KnowledgeObject[] = [
  ko({ id: "k-pruefung", title: "Alpha zugewiesen", status: "offen" }),
  ko({ id: "k-offen", title: "Beta unberührt", status: "offen" }),
  ko({ id: "k-abgelehnt", title: "Gamma rot bewertet", status: "offen" }),
  ko({ id: "k-reval", title: "Delta fällig", status: "validiert" }),
  ko({ id: "k-ohne", title: "Epsilon ohne Auskunft", status: "validiert" }),
  ko({ id: "k-konflikt", title: "Zeta im Widerspruch", status: "validiert" }),
  ko({ id: "k-deckel", title: "Eta über dem Deckel", status: "offen" }),
];

/** Was die Leserouten daraus machen. `k-ohne` fehlt hier ABSICHTLICH — der Rückfall (R-3). */
const ERHOBEN: Record<string, Partial<KnowledgeObject>> = {
  "k-pruefung": { anzeigestatus: "pruefung", anzeigestatusHerkunft: HERKUNFT_ERHOBEN },
  "k-offen": { anzeigestatus: "offen", anzeigestatusHerkunft: HERKUNFT_ERHOBEN },
  "k-abgelehnt": { anzeigestatus: "abgelehnt", anzeigestatusHerkunft: HERKUNFT_ERHOBEN },
  "k-reval": { anzeigestatus: "revalidierung", anzeigestatusHerkunft: HERKUNFT_ERHOBEN },
  "k-konflikt": { anzeigestatus: "validiert", anzeigestatusHerkunft: HERKUNFT_ERHOBEN },
  "k-deckel": { anzeigestatus: "offen", anzeigestatusHerkunft: HERKUNFT_DECKEL },
};

const KOS: readonly KnowledgeObject[] = SUCHE.map((k) =>
  ERHOBEN[k.id] ? ({ ...k, ...ERHOBEN[k.id] } as KnowledgeObject) : k,
);

/** Der eine offene Konflikt der Oberfläche — die EINZIGE Konfliktkenntnis, die es gibt. */
const KONFLIKT: Conflict = {
  id: "c-1",
  koA: "k-konflikt",
  koB: "k-fremd",
  type: "truth",
  description: "Die Gegenseite behauptet 6 bar.",
  status: "offen",
  secondOpinion: null,
  decidedBy: null,
  decision: null,
  createdAt: "2026-09-01T00:00:00Z",
} as unknown as Conflict;

const box = vi.hoisted(() => ({ konflikte: [] as unknown[] }));

vi.mock("../../apps/web/src/api/hooks", async () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  const echt = await vi.importActual<Record<string, unknown>>("../../apps/web/src/api/hooks");
  return {
    ...echt,
    useKos: () => ok(KOS),
    useLibrarySearch: () => ok(SUCHE),
    useDirectory: () => ok([{ id: "u9", name: "Eva" }]),
    useConflicts: () => ok(box.konflikte),
    useEigeneBefunde: () => ok([]),
    useKo: (id: string) => ok(KOS.find((k) => k.id === id)),
    useAudit: () => ok([]),
    useReasonerStatus: () => ok({ active: false, mode: "off" }),
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
// Der Import richtet die i18n-Instanz ein — ohne ihn stünde überall der SCHLÜSSEL.
import i18n from "../../apps/web/src/i18n";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(adresse = "/bibliothek"): void {
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
  box.konflikte = [KONFLIKT];
  window.localStorage.clear();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

// ---- Auslesen ----------------------------------------------------------------------------------

function zeile(id: string): HTMLElement {
  const el = container.querySelector(`[data-testid="bib-zeile"][data-bib-id="${id}"]`);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Zeile „${id}" fehlt; vorhanden: ${sichtbareIds().join(", ")}`);
  }
  return el;
}

/** Das Zustandswort der Listenzeile — die Meta-Zeile trägt „Bereich · Zustand". */
function zeilenWort(id: string): string {
  const meta = zeile(id).querySelector('[data-bib-text="zeile-meta"]');
  return (meta?.textContent ?? "").split("·").slice(1).join("·").trim();
}

/** Der Ton des Punkts links — als Klassenname, so wie ihn `PUNKT_TON` setzt. */
function zeilenTon(id: string): string {
  const punkt = zeile(id).querySelector('[data-testid="bib-punkt"]');
  const klassen = punkt?.className ?? "";
  return ["pos", "warn", "crit"].find((t) => klassen.includes(`bg-trust-${t}-fill`)) ?? "(keiner)";
}

function sichtbareIds(): string[] {
  return [...container.querySelectorAll('[data-testid="bib-zeile"]')].map(
    (el) => el.getAttribute("data-bib-id") ?? "?",
  );
}

interface Anker {
  herkunft: string | null;
  ungeprueft: string[];
}

function ankerAus(el: Element | null): Anker {
  if (el === null) {
    throw new Error("Anker fehlt");
  }
  const roh = el.getAttribute("data-anzeigestatus-ungeprueft");
  return {
    herkunft: el.getAttribute("data-anzeigestatus-herkunft"),
    ungeprueft: roh === null ? [] : roh.split(" ").filter(Boolean).sort(),
  };
}

/** Der Anker der Listenzeile (JOB 3072: er hängt an einem eigenen, unsichtbaren Element — s. RUECKGABE). */
function zeilenAnker(id: string): Anker {
  return ankerAus(
    container.querySelector(`[data-testid="bib-zustand-anker"][data-bib-id="${id}"]`),
  );
}

function waehle(id: string): void {
  act(() => {
    zeile(id).click();
  });
}

function pille(): { wort: string; ton: string; anker: Anker } {
  const el = container.querySelector('[data-testid="bib-pille"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Pille fehlt; DOM: ${container.textContent?.slice(0, 200)}`);
  }
  return {
    wort: (el.textContent ?? "").trim(),
    ton:
      ["pos", "warn", "crit"].find((t) => el.className.includes(`bg-trust-${t}-bg`)) ?? "(keiner)",
    anker: ankerAus(el),
  };
}

const WORT = (schluessel: string): string =>
  String(i18n.getResource("de", "translation", schluessel));

describe("JOB 3072 · N4 — die Bibliothek zeigt den erhobenen Zustand", () => {
  // ----------------------------------------------------------------------------------------------
  // R-1 · IN PRÜFUNG — an der Liste UND an der Lesefläche, im selben Fall.
  // ----------------------------------------------------------------------------------------------
  it("R-1 · ein zugewiesener Eintrag heisst in Liste und Pille „In Prüfung“ — der danebenliegende „Offen“", () => {
    mount();
    expect(zeilenWort("k-pruefung")).toBe(WORT("status.pruefung"));
    // Die Kalibrierung: eine Fläche, die pauschal EIN Wort zeichnet, fällt hier durch.
    expect(zeilenWort("k-offen")).toBe(WORT("status.offen"));
    waehle("k-pruefung");
    expect(pille().wort).toBe(WORT("status.pruefung"));
    waehle("k-offen");
    expect(pille().wort).toBe(WORT("status.offen"));
  });

  // ----------------------------------------------------------------------------------------------
  // R-2 · ABGELEHNT (crit) UND RE-VALIDIERUNG (warn).
  // ----------------------------------------------------------------------------------------------
  it("R-2 · ein rot bewerteter Eintrag heisst „Abgelehnt“ und trägt den Ton `crit`", () => {
    mount();
    expect(zeilenWort("k-abgelehnt")).toBe(WORT("status.abgelehnt"));
    expect(zeilenTon("k-abgelehnt")).toBe("crit");
    waehle("k-abgelehnt");
    expect(pille().wort).toBe(WORT("status.abgelehnt"));
    expect(pille().ton).toBe("crit");
  });

  it("R-2b · ein fälliger Eintrag heisst „Re-Validierung“ und trägt den Ton `warn`", () => {
    mount();
    expect(zeilenWort("k-reval")).toBe(WORT("status.revalidierung"));
    expect(zeilenTon("k-reval")).toBe("warn");
    waehle("k-reval");
    expect(pille().wort).toBe(WORT("status.revalidierung"));
    expect(pille().ton).toBe("warn");
  });

  // ----------------------------------------------------------------------------------------------
  // R-3 · FEHLT DAS FELD, STEHT DAS HEUTIGE WORT DA — UND DER ANKER SAGT ES.
  // ----------------------------------------------------------------------------------------------
  it("R-3 · ohne erhobene Auskunft bleibt es beim gespeicherten Status; der Anker nennt `bestand`", () => {
    mount();
    expect(zeilenWort("k-ohne")).toBe(WORT("status.validiert"));
    expect(zeilenAnker("k-ohne")).toEqual({ herkunft: "bestand", ungeprueft: [] });
    waehle("k-ohne");
    expect(pille().anker.herkunft).toBe("bestand");
  });

  it("R-3b · Gegenprobe: mit erhobener Auskunft nennt der Anker `server`", () => {
    mount();
    expect(zeilenAnker("k-pruefung")).toEqual({ herkunft: "server", ungeprueft: ["konflikt"] });
    waehle("k-pruefung");
    expect(pille().anker).toEqual({ herkunft: "server", ungeprueft: ["konflikt"] });
  });

  // ----------------------------------------------------------------------------------------------
  // R-4 · DER KONFLIKT WIRKT AUF WORT, TON *UND* UMSCHALTER — der Fall, an dem der Umschalter fiel.
  // ----------------------------------------------------------------------------------------------
  it("R-4 · ein validierter Eintrag mit offenem Konflikt heisst „Konflikt“ und trägt `crit`", () => {
    mount();
    expect(zeilenWort("k-konflikt")).toBe(WORT("status.konflikt"));
    expect(zeilenTon("k-konflikt")).toBe("crit");
    waehle("k-konflikt");
    expect(pille().wort).toBe(WORT("status.konflikt"));
    expect(pille().ton).toBe("crit");
  });

  it("R-4b · derselbe Eintrag fällt aus „Freigegeben“ heraus und unter „Offen“ hinein", () => {
    mount("/bibliothek?zustand=validiert");
    expect(sichtbareIds()).not.toContain("k-konflikt");
    // Kalibrierung: OHNE Konflikt stünde er dort — dieselbe Fläche, dieselbe Adresse.
    act(() => {
      root.unmount();
    });
    container.remove();
    box.konflikte = [];
    mount("/bibliothek?zustand=validiert");
    expect(sichtbareIds()).toContain("k-konflikt");
  });

  it("R-4c · unter „Offen“ steht er, unter „Freigegeben“ nur, was wirklich freigegeben ist", () => {
    mount("/bibliothek?zustand=offen");
    expect(sichtbareIds()).toContain("k-konflikt");
    expect(sichtbareIds()).toContain("k-pruefung");
    expect(sichtbareIds()).toContain("k-abgelehnt");
    expect(sichtbareIds()).toContain("k-reval");
    expect(sichtbareIds()).not.toContain("k-ohne");
  });

  // ----------------------------------------------------------------------------------------------
  // R-5 · ÜBER DEM DECKEL: KEINE FEINERE STUFE, UND DIE LÜCKE STEHT AM ANKER.
  // ----------------------------------------------------------------------------------------------
  it("R-5 · über dem Listendeckel steht der gespeicherte Status, und der Anker nennt die vier ungeprüften Eingänge", () => {
    mount();
    expect(zeilenWort("k-deckel")).toBe(WORT("status.offen"));
    expect(zeilenAnker("k-deckel").ungeprueft).toEqual([
      "bewertungen",
      "konflikt",
      "revalidierung",
      "zuweisungen",
    ]);
    waehle("k-deckel");
    expect(pille().wort).toBe(WORT("status.offen"));
    expect(pille().anker.ungeprueft).toEqual([
      "bewertungen",
      "konflikt",
      "revalidierung",
      "zuweisungen",
    ]);
  });

  // ----------------------------------------------------------------------------------------------
  // R-0 · KEIN NEUES WORT AUF DEM BILDSCHIRM (H4 verbietet Erklärtext auf der Lesefläche).
  // ----------------------------------------------------------------------------------------------
  it("R-0 · die Anker tragen keinen sichtbaren Text — die Auskunft ist rein maschinenlesbar", () => {
    mount();
    for (const el of container.querySelectorAll('[data-testid="bib-zustand-anker"]')) {
      expect((el.textContent ?? "").trim()).toBe("");
    }
    // Die sieben Statuswörter existieren seit jeher; dieser Auftrag erfindet keines.
    for (const s of ["offen", "pruefung", "validiert", "abgelehnt", "revalidierung", "konflikt"]) {
      expect(WORT(`status.${s}`).length).toBeGreaterThan(0);
    }
  });
});

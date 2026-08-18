// @vitest-environment jsdom
// ================================================================================================
// JOB 381 · D1 — DIE ORTSZEILE MUSS WIRKEN, NICHT NUR AUSSEHEN.
// ================================================================================================
//
// Pedis Entscheidung (`00_CONTROL/ENTSCHEIDUNGEN/JOB-381-ORTSZEILE.md:40-43`) ist an dieser Stelle
// ungewoehnlich deutlich, und dieser Test ist ihre ausfuehrbare Fassung:
//
//   „Die Zeile muss wirken, nicht nur aussehen. 'Meine Ablage' filtert auf createdBy des
//    angemeldeten Nutzers. Eine Schaltflaeche ohne Wirkung waere eine Attrappe."
//
// Deshalb prueft diese Datei die TREFFERMENGE an der gemounteten Seite, nicht die Adresszeile. Eine
// Fassung, die nur `raum` in die URL schreibt, ist hier kausal rot — genau das verlangt Lieferung 5.
//
// ================================================================================================
// WELCHES FELD IST `createdBy`? — DIE MESSUNG VOR DEM BAU (Lieferung 2).
// ================================================================================================
//
// Am Wire der Bibliothekssuche (`GET /api/library/search` -> `KnowledgeObject[]`, die Projektion
// laesst ausschliesslich `bodyHtml` weg) gibt es **kein** Feld `createdBy`. Die beiden nahe-
// liegenden Kandidaten sind gemessen und BEIDE untauglich:
//
//   · `author` ist der AKTUELLE Verantwortliche und wandert bei der Autor-Uebergabe
//     (`service.ts:3675`, FR-LIF-02: „current author aendert sich, originalAuthor bleibt erhalten").
//     Wer sein Objekt uebergibt, verlOre es damit aus der eigenen Ablage, obwohl er es angelegt hat.
//   · `originalAuthor` ist beim Confluence-Import ausdruecklich der QUELL-Autor aus dem Fremdsystem
//     (`service.ts:248-254`: „KEIN KLARWERK-Nutzer, KEIN Fake-User"). Er kann also eine Kennung
//     tragen, die zu keinem angemeldeten Nutzer gehoert.
//
// Die kanonische Projektion ist die ERSTE HISTORIENZEILE. Sie entsteht bei der Anlage mit
// `history: [{ version: 1, at, author: input.author, note: "erstellt" }]` (`service.ts:1564`), sie
// traegt immer einen echten KLARWERK-Nutzer (beim Import den annehmenden Reviewer), und sie ist
// stabil: jede Revision HAENGT AN (`[...ko.history, …]`, `:3136` und `:3361`), die Autor-Uebergabe
// fasst sie nicht an, und die Suchprojektion entfernt nur `bodyHtml` (InMemory `repo.ts:355`,
// Postgres `SELECT data - 'bodyHtml' AS data`).
//
// Die beiden Kalibrierungsfaelle unten nageln genau das fest — sie sind der Grund, warum dieser
// Test nicht auch mit `author` oder `originalAuthor` gruen waere.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

const ICH = "u-ich";
const ANDERE = "u-andere";

function ko(overrides: Partial<KnowledgeObject> & { id: string }): KnowledgeObject {
  return {
    title: `Titel ${overrides.id}`,
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
    originalAuthor: ANDERE,
    author: ANDERE,
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    history: [{ version: 1, at: "2026-08-01T00:00:00.000Z", author: ANDERE, note: "erstellt" }],
    ...overrides,
  } as unknown as KnowledgeObject;
}

/** Von mir angelegt — der Normalfall. */
const MEINS = ko({
  id: "meins",
  title: "Ventil V1 pruefen",
  author: ICH,
  originalAuthor: ICH,
  history: [{ version: 1, at: "2026-08-01T00:00:00.000Z", author: ICH, note: "erstellt" }],
});

/** Von jemand anderem angelegt — der Normalfall der Gegenseite. */
const FREMD = ko({ id: "fremd", title: "Pumpe P2 schmieren" });

/**
 * KALIBRIERUNG 1 — die Autor-Uebergabe. Ich habe es angelegt, jemand anders traegt es heute
 * (`setAuthor`). Es MUSS in meiner Ablage bleiben. Eine Fassung, die auf `author` filtert,
 * verliert es hier.
 */
const UEBERGEBEN = ko({
  id: "uebergeben",
  title: "Filterwechsel dokumentiert",
  author: ANDERE,
  originalAuthor: ICH,
  history: [{ version: 1, at: "2026-08-02T00:00:00.000Z", author: ICH, note: "erstellt" }],
});

/**
 * KALIBRIERUNG 2 — der Import. Ich habe den Kandidaten angenommen, der Quell-Autor aus Confluence
 * steht in `originalAuthor` und ist kein KLARWERK-Nutzer. Es MUSS in meiner Ablage sein. Eine
 * Fassung, die auf `originalAuthor` filtert, verliert es hier.
 */
const IMPORTIERT = ko({
  id: "importiert",
  title: "Kaltstart mit Vorwaermung",
  author: ICH,
  originalAuthor: "confluence:jdoe",
  history: [{ version: 1, at: "2026-08-03T00:00:00.000Z", author: ICH, note: "erstellt" }],
});

/**
 * KALIBRIERUNG 3 — die Falle in die andere Richtung. `author` ist ICH (etwa nach einer Uebergabe
 * AN mich), angelegt hat es aber jemand anders. Es darf NICHT in meiner Ablage stehen. Eine
 * Fassung, die auf `author` filtert, zeigt es hier faelschlich.
 */
const UEBERNOMMEN = ko({
  id: "uebernommen",
  title: "Foerderband Sichtpruefung",
  author: ICH,
  originalAuthor: ANDERE,
  history: [{ version: 1, at: "2026-08-04T00:00:00.000Z", author: ANDERE, note: "erstellt" }],
});

const ALLE = [MEINS, FREMD, UEBERGEBEN, IMPORTIERT, UEBERNOMMEN];

const lage = vi.hoisted(() => ({
  user: { id: "u-ich", role: "experte" } as { id: string; role: string } | null,
}));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok(ALLE),
    useLibrarySearch: () => ok(ALLE),
    useDirectory: () => ok([]),
    useConflicts: () => ok([]),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: lage.user }),
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
import {
  ALLE_INHALTE_LABEL,
  LIBRARY_SCOPE_PARAM,
  MEINE_ABLAGE_LABEL,
  applyLibraryScope,
  createdByOf,
  parseLibraryScope,
} from "../../apps/web/src/lib/libraryOwnScope";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(entry = "/bibliothek"): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [entry] }, createElement(Library)),
      ),
    );
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  lage.user = { id: ICH, role: "experte" };
});

const text = (): string => (container.textContent ?? "").replace(/\s+/g, " ");
const ortszeile = (): HTMLElement | null =>
  container.querySelector('[data-testid="library-scope-bar"]');
const schalter = (): HTMLButtonElement[] =>
  [...(ortszeile()?.querySelectorAll("button[aria-pressed]") ?? [])] as HTMLButtonElement[];
const knopf = (label: string): HTMLButtonElement | undefined =>
  schalter().find((b) => (b.textContent ?? "").includes(label));

// ================================================================================================
// LIEFERUNG 1 — DER ANKER, ZWEI SCHALTFLAECHEN, DIE REIHENFOLGE, NIE EIN AUSWAHLMENUE.
// ================================================================================================

describe("JOB 381 · Lieferung 1 — die Ortszeile als Bauteil", () => {
  it("Anker vorhanden, genau zwei aria-pressed-Schaltflaechen, kein select", () => {
    mount();
    expect(ortszeile()).not.toBeNull();
    expect(schalter()).toHaveLength(2);
    expect(ortszeile()?.querySelectorAll("select")).toHaveLength(0);
  });

  it("Reihenfolge: zuerst Meine Ablage, danach Alle Inhalte", () => {
    mount();
    const [erste, zweite] = schalter();
    expect(erste?.textContent).toContain(MEINE_ABLAGE_LABEL);
    expect(zweite?.textContent).toContain(ALLE_INHALTE_LABEL);
  });

  it("die Ortszeile steht im DOM VOR dem Suchfeld (R-17 misst die y-Position)", () => {
    mount();
    const bar = ortszeile();
    const suche = container.querySelector("#library-search");
    if (!bar || !suche) {
      throw new Error(
        "Ortszeile oder Suchfeld fehlt — die Positionsfrage ist dann gegenstandslos.",
      );
    }
    // Node.DOCUMENT_POSITION_FOLLOWING: `suche` folgt auf `bar` in der Dokumentordnung.
    expect(bar.compareDocumentPosition(suche) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Standard ist Alle Inhalte — sie ist gedrueckt, Meine Ablage nicht", () => {
    mount();
    expect(knopf(ALLE_INHALTE_LABEL)?.getAttribute("aria-pressed")).toBe("true");
    expect(knopf(MEINE_ABLAGE_LABEL)?.getAttribute("aria-pressed")).toBe("false");
  });
});

// ================================================================================================
// LIEFERUNG 2 + 5 — DIE EIGENTLICHE FILTERWIRKUNG. HIER STIRBT DIE ATTRAPPE.
// ================================================================================================

describe("JOB 381 · Lieferung 2/5 — Meine Ablage filtert die echte Treffermenge", () => {
  it("Alle Inhalte laesst alle sichtbaren Treffer stehen", () => {
    mount();
    for (const k of ALLE) {
      expect(text()).toContain(k.title);
    }
  });

  it("Meine Ablage zeigt nur, was ICH angelegt habe — Fremdes verschwindet", () => {
    mount();
    act(() => {
      knopf(MEINE_ABLAGE_LABEL)?.click();
    });
    expect(text()).toContain(MEINS.title);
    expect(text()).not.toContain(FREMD.title);
  });

  it("KALIBRIERUNG Autor-Uebergabe: von mir angelegt, heute fremd getragen — bleibt meins", () => {
    mount();
    act(() => {
      knopf(MEINE_ABLAGE_LABEL)?.click();
    });
    // Eine Fassung, die auf `author` filtert, verliert genau diesen Fall.
    expect(text()).toContain(UEBERGEBEN.title);
  });

  it("KALIBRIERUNG Import: Quell-Autor fremd, angenommen habe ich — bleibt meins", () => {
    mount();
    act(() => {
      knopf(MEINE_ABLAGE_LABEL)?.click();
    });
    // Eine Fassung, die auf `originalAuthor` filtert, verliert genau diesen Fall.
    expect(text()).toContain(IMPORTIERT.title);
  });

  it("KALIBRIERUNG Gegenrichtung: heute mir zugeschrieben, angelegt von anderen — NICHT meins", () => {
    mount();
    act(() => {
      knopf(MEINE_ABLAGE_LABEL)?.click();
    });
    // Eine Fassung, die auf `author` filtert, zeigt genau diesen Fall faelschlich.
    expect(text()).not.toContain(UEBERNOMMEN.title);
  });

  it("Zurueck auf Alle Inhalte bringt die fremden Treffer wieder", () => {
    mount();
    act(() => {
      knopf(MEINE_ABLAGE_LABEL)?.click();
    });
    expect(text()).not.toContain(FREMD.title);
    act(() => {
      knopf(ALLE_INHALTE_LABEL)?.click();
    });
    expect(text()).toContain(FREMD.title);
  });
});

// ================================================================================================
// LIEFERUNG 3 — ADRESSE, FOKUS, FREMDE PARAMETER, RELOAD, FAIL-CLOSED.
// ================================================================================================

describe("JOB 381 · Lieferung 3 — Adresse, Fokus und Wiederherstellung", () => {
  it("der Reload-Zustand wird aus der Adresse wiederhergestellt", () => {
    mount(`/bibliothek?${LIBRARY_SCOPE_PARAM}=meine`);
    expect(knopf(MEINE_ABLAGE_LABEL)?.getAttribute("aria-pressed")).toBe("true");
    expect(text()).toContain(MEINS.title);
    expect(text()).not.toContain(FREMD.title);
  });

  it("ein fremder Parameter ueberlebt das Umschalten", () => {
    mount("/bibliothek?q=ventil&sonstwas=behalten");
    act(() => {
      knopf(MEINE_ABLAGE_LABEL)?.click();
    });
    // Die Seite haelt die Adresse selbst fort; geprueft wird, dass der Fremdparameter nicht
    // verlorengeht. Der Zugriff laeuft ueber die gerenderte Ortszeile, nicht ueber window.location:
    // MemoryRouter fuehrt seine eigene Adresse.
    expect(ortszeile()?.getAttribute("data-raum")).toBe("meine");
  });

  it("der Fokus bleibt auf der gedrueckten Schaltflaeche (A-6/R-18)", () => {
    mount();
    const b = knopf(MEINE_ABLAGE_LABEL);
    act(() => {
      b?.focus();
      b?.click();
    });
    expect(document.activeElement).toBe(knopf(MEINE_ABLAGE_LABEL));
  });

  it("FAIL-CLOSED: ohne Nutzeridentitaet zeigt Meine Ablage keinen Treffer", () => {
    lage.user = null;
    mount(`/bibliothek?${LIBRARY_SCOPE_PARAM}=meine`);
    for (const k of ALLE) {
      expect(text()).not.toContain(k.title);
    }
  });
});

// ================================================================================================
// DIE MODULLOGIK EINZELN — damit ein Flaechenfehler von einem Regelfehler unterscheidbar bleibt.
// ================================================================================================

describe("JOB 381 · libraryOwnScope — die eine Stelle, die Zugehoerigkeit entscheidet", () => {
  it("createdByOf liest die erste Historienzeile, nicht author/originalAuthor", () => {
    expect(createdByOf(UEBERGEBEN)).toBe(ICH);
    expect(createdByOf(UEBERNOMMEN)).toBe(ANDERE);
    expect(createdByOf(IMPORTIERT)).toBe(ICH);
  });

  it("ohne Historie gibt es keinen Ersteller — und keinen stillen Rueckfall", () => {
    expect(createdByOf(ko({ id: "leer", history: [] }))).toBeUndefined();
    expect(applyLibraryScope([ko({ id: "leer", history: [] })], "meine", ICH)).toEqual([]);
  });

  it("parseLibraryScope faellt fuer alles Unbekannte auf den Standard zurueck", () => {
    expect(parseLibraryScope("meine")).toBe("meine");
    expect(parseLibraryScope("alle")).toBe("alle");
    expect(parseLibraryScope("quatsch")).toBe("alle");
    expect(parseLibraryScope(null)).toBe("alle");
  });

  it("applyLibraryScope ist fail-closed ohne Nutzerkennung", () => {
    expect(applyLibraryScope(ALLE, "meine", undefined)).toEqual([]);
    expect(applyLibraryScope(ALLE, "meine", "")).toEqual([]);
    // „Alle Inhalte" bleibt davon unberuehrt — es ist kein Rechtefilter, sondern eine Sicht.
    expect(applyLibraryScope(ALLE, "alle", undefined)).toHaveLength(ALLE.length);
  });
});

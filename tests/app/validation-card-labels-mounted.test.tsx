// @vitest-environment jsdom
// ================================================================================================
// JOB 1100 · D-033 — DIE PRÜFKARTE TRÄGT WENIGER ETIKETTEN, OHNE DASS EINE ANGABE VERSCHWINDET
// ================================================================================================
//
// GEGENSTAND (Designkatalog Block 2, D-033). Die Etikettenzeile der Prüfkarte trägt drei belegte
// Redundanzen:
//
//   (a) Die **Status-Pille** sagt auf dieser Seite fast nichts: Das Board holt ausschliesslich
//       offene Objekte (`services/validation/src/service.ts:327`, `status: "offen"`). Dieselben
//       Felder werden zugleich feiner ausgewertet — von `reviewWorkView`, dessen Plakette bis
//       hierher im `<details>` versteckt lag. Die gröbere Aussage stand vorn, die feinere hinten.
//   (b) **„Vertrauen N"** und **„X von Y grün"** standen als zwei Abzeichen nebeneinander. Bei
//       null Bewertungen sagen sie buchstäblich dasselbe. Sie zusammenzulegen ist verlustfrei —
//       ersatzloses Streichen wäre es NICHT: „Vertrauen" trägt zusätzlich Gelb-Stimmen,
//       Ask-Rückmeldungen und den Konfliktabzug, die nirgends sonst auf der Karte erscheinen.
//   (c) Die **Kategorie** stand ohne Beschriftungswort und las sich dadurch wie ein sechster
//       Prüfzustand.
//
// WAS DIESER WÄCHTER FESTHÄLT — und was ausdrücklich NICHT. Er prüft die vier Aussagen von D-033
// am GEMOUNTETEN Board und zusätzlich, dass **keine** Angabe dabei verlorengegangen ist. Er prüft
// NICHT die Gesamtzahl „acht", die der Designer an einem Live-Eintrag gezählt hat: Diese Zahl
// hängt an bedingten Abzeichen (rote Stimmen, veraltete Stimmen, KI-Prüfung, Erstellungsdatum),
// die je Objekt kommen und gehen. Gepinnt wird stattdessen die belastbare Grösse — die
// Etikettenzahl **je festem Fixture** und die Reduktion um genau eins durch die Zusammenlegung.
//
// GEMESSEN WIRD AM ECHTEN BAUM, NICHT AM QUELLTEXT. Die Seite wird gemountet und über den echten
// react-query-Cache mit Board-Daten versorgt. Ein Test, der `Validation.tsx` nach Zeichenketten
// durchsucht, bewiese nur, dass ein Wort im Code steht.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Die Endpunkte, die das Board zieht — explizit gemockt, damit kein Netz und keine Kulisse
// aus einem globalen Setup den Ausgang bestimmt. `board` und `directory` werden je Fall gesetzt.
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
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
// i18n VOR der Seite: initialisiert react-i18next global.
import i18n from "../../apps/web/src/i18n";
import { Validation } from "../../apps/web/src/pages/Validation";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const de = (key: string, vars?: Record<string, unknown>): string =>
  vars ? String(i18n.t(key, vars)) : String(i18n.getResource("de", "translation", key));

/** Die Marke an der Etikettenzeile — eine Zählung über Textfragmente wäre eine Scheinmessung. */
const ZEILE = '[data-testid="validation-card-labels"]';

/**
 * Ein Board-Objekt mit EXAKT den Pflichtangaben: keine KI-Prüfung, keine roten Stimmen, keine
 * veralteten Stimmen, kein Erstellungsdatum. Damit ist die Etikettenzahl deterministisch — jedes
 * bedingte Abzeichen bliebe sonst eine wandernde Grösse.
 */
function schlichtesKo(over: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "k1",
    title: "PROBE-KO Ventilwartung",
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
    history: [],
    ...over,
  } as unknown as KnowledgeObject;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function mountMit(items: KnowledgeObject[]): Promise<void> {
  (endpoints.validation.board as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
    items as never,
  );
  (endpoints.directory.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
    { id: "u1", name: "Prüfer" },
  ] as never);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: ["/pruefen"] }, createElement(Validation)),
      ),
    );
  });
  for (let i = 0; i < 8 && !(container.textContent ?? "").includes("PROBE-KO"); i += 1) {
    await flush();
  }
}

/** Die Etikettenzeile der ersten Karte. */
function zeile(): HTMLElement {
  const el = container.querySelector(ZEILE);
  if (!(el instanceof HTMLElement)) {
    throw new Error("Etikettenzeile nicht gefunden — trägt die Karte ihre Marke?");
  }
  return el;
}

/** Die Etiketten = die direkten Kinder der Zeile, die wirklich etwas rendern. */
function etiketten(): HTMLElement[] {
  return [...zeile().children].filter(
    (c): c is HTMLElement => c instanceof HTMLElement && (c.textContent ?? "").trim().length > 0,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  vi.clearAllMocks();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// ================================================================================================
// A1 · KALIBRIERUNG — die Karte rendert überhaupt
// ================================================================================================
describe("JOB 1100 · D-033 · A1: das Prüfboard rendert eine Karte", () => {
  it("die Karte trägt Titel und eine markierte Etikettenzeile", async () => {
    await mountMit([schlichtesKo()]);

    expect(container.textContent).toContain("PROBE-KO Ventilwartung");
    expect(container.querySelectorAll('[data-testid="validation-row"]')).toHaveLength(1);
    expect(etiketten().length).toBeGreaterThan(0);
  });
});

// ================================================================================================
// A2 · PFLICHT 1 — der feinere Prüfstand steht vorn, die grobe Status-Pille ist weg
// ================================================================================================
describe("JOB 1100 · D-033 · A2: Prüfstand statt Status-Pille", () => {
  it("die Etikettenzeile trägt den Prüfstand", async () => {
    await mountMit([schlichtesKo()]);

    // `trust: 0` und keine Zuweisung ⇒ `reviewWorkView` liefert den Zustand „neu erfasst".
    expect(zeile().textContent).toContain(de("val.reviewState.new"));
  });

  it("die Status-Pille steht NICHT mehr in der Etikettenzeile", async () => {
    await mountMit([schlichtesKo()]);

    expect(zeile().textContent).not.toContain(de("status.offen"));
  });

  it("der Prüfstand steht auf der Karte genau EINMAL — nicht zusätzlich im Aufklapper", async () => {
    await mountMit([schlichtesKo()]);

    const treffer = (container.textContent ?? "").split(de("val.reviewState.new")).length - 1;
    expect(treffer).toBe(1);
  });
});

// ================================================================================================
// A3 · PFLICHT 2a — Vertrauen und Grünanteil in EINEM Abzeichen
// ================================================================================================
describe("JOB 1100 · D-033 · A3: ein Abzeichen für Vertrauen und Grünanteil", () => {
  it("genau ein Etikett trägt beide Angaben", async () => {
    await mountMit([schlichtesKo()]);

    const votes = de("val.votes", { have: 0, need: 3 });
    const beide = etiketten().filter(
      (e) =>
        (e.textContent ?? "").includes(de("val.trust")) && (e.textContent ?? "").includes(votes),
    );
    expect(beide).toHaveLength(1);
  });

  it("beide Zahlen bleiben lesbar — Streichen wäre ein echter Verlust", async () => {
    await mountMit([schlichtesKo({ trust: 42, reviewVotes: { up: 2, warn: 0, down: 0 } })]);

    const text = zeile().textContent ?? "";
    expect(text).toContain(`${de("val.trust")} 42`);
    expect(text).toContain(de("val.votes", { have: 2, need: 3 }));
  });

  it("der Grünanteil steht in KEINEM Etikett mehr für sich allein", async () => {
    // Das ist die eigentliche Zusammenlegung: Bis D-033 trug ein eigenes Abzeichen „X von Y grün"
    // ohne jeden Bezug zum Vertrauenswert daneben.
    await mountMit([schlichtesKo()]);

    const votes = de("val.votes", { have: 0, need: 3 });
    const alleinstehend = etiketten().filter(
      (e) =>
        (e.textContent ?? "").includes(votes) && !(e.textContent ?? "").includes(de("val.trust")),
    );
    expect(alleinstehend).toHaveLength(0);
  });
});

// ================================================================================================
// A4 · PFLICHT 2b — die Kategorie sagt, dass sie eine Kategorie ist
// ================================================================================================
describe("JOB 1100 · D-033 · A4: die Kategorie ist beschriftet", () => {
  it("die Kategorie trägt ihr Beschriftungswort", async () => {
    await mountMit([schlichtesKo({ category: "Wartung" })]);

    const kategorie = etiketten().find((e) => (e.textContent ?? "").includes("Wartung"));
    expect(kategorie?.textContent).toContain(de("lib.facet.category"));
  });

  it("der Kategoriewert selbst bleibt unverändert lesbar", async () => {
    await mountMit([schlichtesKo({ category: "Anlage 1" })]);

    expect(zeile().textContent).toContain("Anlage 1");
  });
});

// ================================================================================================
// A5 · PFLICHT 3 — nichts ist verlorengegangen
// ================================================================================================
//
// Die bedingten Warnabzeichen sind das Gegenstück zur Verdichtung: Sie dürfen dabei NICHT
// mitverschwinden. Jeder Fall erzeugt seine Bedingung eigens.
describe("JOB 1100 · D-033 · A5: die bedingten Abzeichen bleiben erreichbar", () => {
  it("rote Stimmen erscheinen weiterhin", async () => {
    await mountMit([schlichtesKo({ reviewVotes: { up: 0, warn: 0, down: 2 } })]);

    expect(zeile().textContent).toContain(de("val.votesBlocked", { count: 2 }));
  });

  it("veraltete Stimmen erscheinen weiterhin", async () => {
    await mountMit([schlichtesKo({ staleVotes: 3 })]);

    expect(zeile().textContent).toContain(de("val.staleVotes", { count: 3 }));
  });

  it("die Wissensart bleibt das erste Etikett", async () => {
    await mountMit([schlichtesKo()]);

    expect(etiketten()[0]?.textContent).toContain(de("ktype.best_practice"));
  });
});

// ================================================================================================
// A6 · DIE VERDICHTUNG IST MESSBAR — feste Fixtures, feste Zahlen
// ================================================================================================
//
// Gepinnt wird die Etikettenzahl je Fixture. Die Zusammenlegung aus A3 nimmt genau EIN Etikett
// heraus; der Plakettentausch aus A2 verändert die Zahl nicht (eines geht, eines kommt).
describe("JOB 1100 · D-033 · A6: die Zeile ist kürzer geworden", () => {
  // Die fünf sind: Wissensart · Prüfstand · Vertrauen+Stimmen · Kategorie · Ersteller.
  // Der Ersteller kommt aus dem Verzeichnis (`author: "u1"` → „Prüfer") und ist kein Prüfsignal,
  // sondern Herkunft — er zählt mit, weil er in derselben Zeile steht. Vor D-033 waren es sechs:
  // Status-Pille UND Prüfstand fehlten sich nicht gegenseitig, aber Vertrauen und Stimmen standen
  // getrennt. Die Reduktion um genau eins ist die Zusammenlegung; der Plakettentausch verändert
  // die Zahl nicht (eines geht, eines kommt) — genau so gemessen.
  it("schlichtes Objekt: fünf Etiketten statt vorher sechs", async () => {
    await mountMit([schlichtesKo()]);

    expect(etiketten()).toHaveLength(5);
  });

  it("mit beiden Warnabzeichen: sieben — die bedingten kommen obendrauf, nicht anstelle", async () => {
    await mountMit([schlichtesKo({ reviewVotes: { up: 0, warn: 0, down: 1 }, staleVotes: 2 })]);

    expect(etiketten()).toHaveLength(7);
  });
});

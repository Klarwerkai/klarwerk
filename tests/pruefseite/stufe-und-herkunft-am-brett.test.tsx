// @vitest-environment jsdom
// ================================================================================================
// JOB 3027 · STATION 4 — STUFE UND HERKUNFT AM PRUEF-BRETT, UND EIN FEHLEN HEISST FEHLEN.
// ================================================================================================
//
// DIE SERVERHAELFTE IST SEIT JOB 3003/3009 LIVE: `GET /api/validation/board` haengt an jede Zeile
// `confidentiality` + `confidentialityProvenance` (`discloseConfidentiality`) sowie `origin` und
// `originSources` (`services/validation/src/board-herkunft.ts:122-135`). Die Oberflaeche hat diese
// Auskunft bis hierher nicht gelesen, sondern GEGLAETTET: `validationFacets.ts:61` rief
// `confidentialityOf`, und die gibt fuer JEDEN nicht ausdruecklich vertraulichen Wert „intern"
// zurueck (`apps/web/src/lib/confidentiality.ts:12-15`). Ein Objekt, das der Server ausdruecklich
// als „niemand hat hier je eingestuft" ausweist, landete damit unter „Intern" — die Seite behauptete
// eine Einstufung, die nie jemand gesetzt hat. Genau das nennt Pedi „raten".
//
// DREI LAGEN, NICHT ZWEI. Der Grund steht am Server ausgeschrieben (board-herkunft.ts:10-18): fuer
// den Menschen davor sind „dieses Objekt ist nicht eingestuft" und „diese Antwort liefert die
// Einstufung nicht" zwei voellig verschiedene Zustaende. Der zweite ist real — ein Cache-Stand von
// VOR der Auslieferung von JOB 3003 traegt die beiden Felder gar nicht (Fall R3).
//
// GEMESSEN WIRD AN DER GEMOUNTETEN SEITE, ueber den echten react-query-Weg: gemockt ist der
// ENDPUNKT, nicht der Haken. Ein Test, der `useValidationBoard` selbst ersetzte, bewiese nur, dass
// eine Testvoraussetzung ankommt; hier laeuft die Kette
// `endpoints.validation.board` → `useValidationBoard` → `pruefZeile`/`boardAuskunft` → Karte.
// Muster: `apps/web/src/pages/Library.origin-chip.test.tsx` und
// `tests/app/validation-card-labels-mounted.test.tsx`.
//
// JEDER FALL PRUEFT BEIDE RICHTUNGEN: die Aussage erscheint bei ihrer Lage UND sie erscheint bei
// keiner anderen. Eine Aussage, die immer dasteht, sagt nichts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Die Endpunkte, die das Board zieht — explizit gemockt, damit kein Netz und keine Kulisse aus
// einem globalen Setup den Ausgang bestimmt.
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
import type { ValidationBoardKo } from "../../apps/web/src/api/types";
// i18n VOR der Seite: initialisiert react-i18next global.
import i18n from "../../apps/web/src/i18n";
import { pruefZeile } from "../../apps/web/src/lib/boardAuskunft";
import { applyFacetSelection } from "../../apps/web/src/lib/facets";
import { validationFacetValues } from "../../apps/web/src/lib/validationFacets";
import { Validation } from "../../apps/web/src/pages/Validation";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const de = (key: string): string => String(i18n.getResource("de", "translation", key));

/** Die zwei Marken, an denen gemessen wird — kein Raten ueber CSS-Klassen oder Textfragmente. */
const STUFE = '[data-testid="val-stufe"]';
const HERKUNFT = '[data-testid="val-herkunft"]';
const ETIKETTEN = '[data-testid="validation-card-labels"]';

/**
 * Eine Board-Zeile, wie die Route sie seit JOB 3003 liefert: die vier Auskunftsfelder sind IMMER
 * da, der Fehlzustand ist eine Aussage (`null` + `"unknown"`) und kein weggelassener Schluessel.
 *
 * JOB 3027 R2: Hier stand ein LOKALER Reparaturtyp, weil `ValidationBoardKo` die beiden nullbaren
 * Felder noch in der KO-Form fuehrte. Der Produktionstyp ist jetzt selbst exakt (Begruendung an
 * `types.ts`), also misst der Test wieder gegen ihn — ein Test, der seinen Messgegenstand erst
 * zurechtbiegt, misst den Gegenstand nicht.
 */
function zeile(over: Partial<ValidationBoardKo> = {}): ValidationBoardKo {
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
    createdAt: "2026-08-12T00:00:00.000Z",
    history: [],
    confidentiality: null,
    confidentialityProvenance: "unknown",
    origin: null,
    originSources: [],
    ...over,
  } as ValidationBoardKo;
}

/**
 * Eine Zeile aus einem Antwortstand VOR JOB 3003 (oder von einem anderen Lesepfad): die vier
 * Felder fehlen vollstaendig. Der Cast ist der Punkt des Falls — der Typ verspricht sie, die
 * Wirklichkeit eines alten Caches haelt das nicht.
 */
function zeileOhneAuskunft(over: Partial<ValidationBoardKo> = {}): ValidationBoardKo {
  const {
    confidentiality: _c,
    confidentialityProvenance: _p,
    origin: _o,
    originSources: _q,
    ...rest
  } = zeile(over);
  return rest as ValidationBoardKo;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function mountMit(items: ValidationBoardKo[]): Promise<void> {
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
        createElement(
          MemoryRouter,
          { initialEntries: ["/validierung"] },
          createElement(Validation),
        ),
      ),
    );
  });
  for (
    let i = 0;
    i < 8 && container.querySelectorAll('[data-testid="validation-row"]').length === 0;
    i += 1
  ) {
    await flush();
  }
}

/** Der Aufklapper der Karte, wie ihn ein Mensch oeffnet — sonst misst der Test eine zugeklappte Flaeche. */
async function aufklappen(): Promise<void> {
  await act(async () => {
    for (const d of container.querySelectorAll("details")) {
      d.open = true;
    }
  });
}

function stufen(): HTMLElement[] {
  return [...container.querySelectorAll(STUFE)] as HTMLElement[];
}

function stufenText(): string {
  return (stufen()[0]?.textContent ?? "").trim();
}

function herkunftText(): string {
  return ((container.querySelector(HERKUNFT) as HTMLElement | null)?.textContent ?? "").trim();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// ================================================================================================
// K · KALIBRIERUNG — die Seite rendert ueberhaupt, und zwar aus den ECHTEN Daten
// ================================================================================================
describe("JOB 3027 · K: das Prüfbrett rendert eine Karte mit beiden Auskünften", () => {
  it("eine Zeile ergibt eine Karte, eine Stufen- und eine Herkunftsaussage", async () => {
    await mountMit([zeile({ confidentiality: "vertraulich", confidentialityProvenance: "ko" })]);
    await aufklappen();

    expect(container.textContent).toContain("PROBE-KO Ventilwartung");
    expect(container.querySelectorAll('[data-testid="validation-row"]')).toHaveLength(1);
    expect(stufen()).toHaveLength(1);
    expect(container.querySelectorAll(HERKUNFT)).toHaveLength(1);
  });
});

// ================================================================================================
// R1 · DIE STUFE STEHT AUF DER KARTE — im vorhandenen Wortlaut, nicht in einem zweiten
// ================================================================================================
describe("JOB 3027 · R1: eingestuft heißt eingestuft", () => {
  it("„vertraulich“ mit Beleglage `ko` zeigt den vorhandenen Klartext", async () => {
    await mountMit([zeile({ confidentiality: "vertraulich", confidentialityProvenance: "ko" })]);

    expect(stufenText()).toBe(de("conf.level.vertraulich"));
    expect(stufen()[0]?.getAttribute("data-lage")).toBe("eingestuft");
  });

  it("„intern“ mit Beleglage `ko` sagt „intern“ — die Stufe wurde hier wirklich gesetzt", async () => {
    await mountMit([zeile({ confidentiality: "intern", confidentialityProvenance: "ko" })]);

    expect(stufenText()).toBe(de("conf.level.intern"));
    expect(stufenText()).not.toBe(de("val.stufe.nichtEingestuft"));
  });

  it("die Stufe steht GENAU EINMAL in der gezählten Etikettenzeile (D-033)", async () => {
    await mountMit([
      zeile({ confidentiality: "streng_vertraulich", confidentialityProvenance: "ko" }),
    ]);

    const etiketten = container.querySelector(ETIKETTEN) as HTMLElement | null;
    expect(etiketten?.querySelectorAll(STUFE)).toHaveLength(1);
    // Die Herkunft gehört NICHT in diese Zeile — sonst wären es zwei Ergänzungen.
    expect(etiketten?.querySelectorAll(HERKUNFT)).toHaveLength(0);
    expect(stufen()).toHaveLength(1);
  });
});

// ================================================================================================
// R2 · NICHT EINGESTUFT IST NICHT „INTERN" — auf der Karte UND in der Facettenschiene
// ================================================================================================
describe("JOB 3027 · R2: „nicht eingestuft“ ist eine eigene Aussage", () => {
  it("`null` + `unknown` zeigt „nicht eingestuft“ und NICHT „intern“", async () => {
    await mountMit([zeile({ confidentiality: null, confidentialityProvenance: "unknown" })]);

    expect(stufenText()).toBe(de("val.stufe.nichtEingestuft"));
    expect(stufenText()).not.toBe(de("conf.level.intern"));
    expect(stufen()[0]?.getAttribute("data-lage")).toBe("nicht_eingestuft");
  });

  it("die Facettenschiene sortiert es nicht unter „Intern“ ein", () => {
    const ohneStufe = pruefZeile(
      zeile({ confidentiality: null, confidentialityProvenance: "unknown" }),
    );
    const mitStufe = pruefZeile(
      zeile({ id: "k2", confidentiality: "intern", confidentialityProvenance: "ko" }),
    );

    expect(validationFacetValues(ohneStufe).confidentiality).toEqual(["nicht_eingestuft"]);
    expect(validationFacetValues(mitStufe).confidentiality).toEqual(["intern"]);

    // Beide Richtungen: „Intern" findet NUR das wirklich eingestufte Objekt …
    const unterIntern = applyFacetSelection([ohneStufe, mitStufe], validationFacetValues, {
      confidentiality: ["intern"],
    });
    expect(unterIntern.map((k) => k.id)).toEqual(["k2"]);
    // … und der neue Wert findet nur das nicht eingestufte.
    const unterOhne = applyFacetSelection([ohneStufe, mitStufe], validationFacetValues, {
      confidentiality: ["nicht_eingestuft"],
    });
    expect(unterOhne.map((k) => k.id)).toEqual(["k1"]);
  });

  it("die Schiene beschriftet den neuen Wert im Klartext (gemountet, „Weitere Filter“ offen)", async () => {
    window.localStorage.setItem("klarwerk.validation.filters.moreOpen", "1");
    await mountMit([
      zeile({ confidentiality: null, confidentialityProvenance: "unknown" }),
      zeile({ id: "k2", confidentiality: "vertraulich", confidentialityProvenance: "ko" }),
      zeileOhneAuskunft({ id: "k3" }),
    ]);

    const schiene = container.querySelector("aside") as HTMLElement | null;
    expect(schiene?.textContent).toContain(de("lib.facet.confidentiality"));
    expect(schiene?.textContent).toContain(de("val.stufe.nichtEingestuft"));
    expect(schiene?.textContent).toContain(de("val.stufe.auskunftFehlt"));
    // Kein Objekt dieses Bestands ist „intern" — die Schiene darf es also auch nicht anbieten.
    expect(schiene?.textContent).not.toContain(de("conf.level.intern"));
  });
});

// ================================================================================================
// R3 · DIE DRITTE AUSSAGE — die Antwort traegt die Auskunft gar nicht
// ================================================================================================
describe("JOB 3027 · R3: „Auskunft fehlt“ ist weder „intern“ noch „nicht eingestuft“", () => {
  it("eine Zeile ohne die beiden Felder sagt genau das", async () => {
    await mountMit([zeileOhneAuskunft()]);

    expect(stufenText()).toBe(de("val.stufe.auskunftFehlt"));
    expect(stufenText()).not.toBe(de("conf.level.intern"));
    expect(stufenText()).not.toBe(de("val.stufe.nichtEingestuft"));
    expect(stufen()[0]?.getAttribute("data-lage")).toBe("auskunft_fehlt");
  });

  it("eine Zeile, die eine gültige Stufe trägt, sagt es NICHT — auch ohne Beleglage", async () => {
    // Ein alter Cache kann `confidentiality: "vertraulich"` tragen (das Feld gab es am KO schon)
    // und die Beleglage nicht. „Einstufung nicht in dieser Antwort" wäre dann schlicht falsch:
    // sie steht ja da. Nur das FEHLEN einer Stufe braucht die Beleglage.
    const alt = zeileOhneAuskunft();
    await mountMit([{ ...alt, confidentiality: "vertraulich" } as ValidationBoardKo]);

    expect(stufenText()).toBe(de("conf.level.vertraulich"));
  });
});

// ================================================================================================
// R4 · DIE HERKUNFT — im vorhandenen Wortlaut, mit ihren zwei Fehlzustaenden
// ================================================================================================
describe("JOB 3027 · R4: der Erfassungsweg steht am Aufklapper", () => {
  it("`word_addin` nutzt den VORHANDENEN Wortlaut — keine zweite Beschriftung", async () => {
    await mountMit([zeile({ origin: "word_addin" })]);
    await aufklappen();

    expect(herkunftText()).toContain(de("ko.originWordAddin.label"));
    expect(herkunftText()).toContain(de("val.herkunft.label"));
  });

  // Die übrigen vier Herkünfte trugen bis hierher gar keine Beschriftung — der Chip in Bibliothek
  // und KO-Detail kennt nur `word_addin`. Jede bekommt einen eigenen Fall, damit der Fehlschlag
  // sagt, WELCHE fehlt.
  for (const [herkunft, key] of [
    ["tell", "ko.origin.tell"],
    ["studio", "ko.origin.studio"],
    ["expert", "ko.origin.expert"],
    ["frontdoor", "ko.origin.frontdoor"],
  ] as const) {
    it(`\`${herkunft}\` trägt einen eigenen Klartext`, async () => {
      await mountMit([zeile({ origin: herkunft })]);
      await aufklappen();

      expect(herkunftText()).toContain(de(key));
    });
  }

  it("`origin: null` sagt „Herkunft unbekannt“ — und nicht „über die Vordertür erfasst“", async () => {
    await mountMit([zeile({ origin: null })]);
    await aufklappen();

    expect(herkunftText()).toContain(de("val.herkunft.unbekannt"));
    expect(herkunftText()).not.toContain(de("ko.origin.frontdoor"));
  });

  it("eine Zeile ohne das Feld sagt die dritte Aussage", async () => {
    await mountMit([zeileOhneAuskunft()]);
    await aufklappen();

    expect(herkunftText()).toContain(de("val.herkunft.auskunftFehlt"));
    expect(herkunftText()).not.toContain(de("val.herkunft.unbekannt"));
  });

  it("die Beschriftung ist NICHT die des Demo-/Eigenes-Filters (die Wortfalle)", async () => {
    // Auf derselben Seite steht `lib.originLabel` („Herkunft") für Demo-Wissen vs. eigenes Wissen
    // (Validation.tsx:602-604). Zweimal dasselbe Wort für zwei Sachen wäre genau das Raten, das
    // dieser Auftrag beendet.
    expect(de("val.herkunft.label")).not.toBe(de("lib.originLabel"));

    await mountMit([zeile({ origin: "word_addin" })]);
    await aufklappen();
    expect(herkunftText()).not.toContain(de("lib.originLabel"));
  });
});

// ================================================================================================
// Z · DAS ZUSTANDSMODELL — keine Aussage ohne Zeile (Auftrag §9)
// ================================================================================================
describe("JOB 3027 · Z: laden, leer und Fehler sagen NICHTS über eine Einstufung", () => {
  it("leeres Board: keine Karte, keine Stufen- und keine Herkunftsaussage", async () => {
    await mountMit([]);

    expect(stufen()).toHaveLength(0);
    expect(container.querySelectorAll(HERKUNFT)).toHaveLength(0);
  });

  it("während des Ladens steht kein Platzhalter, der „intern“ vorwegnimmt", async () => {
    (endpoints.validation.board as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => undefined) as never,
    );
    (endpoints.directory.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [] as never,
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

    expect(stufen()).toHaveLength(0);
    expect(container.textContent).not.toContain(de("val.stufe.nichtEingestuft"));
  });

  it("Erstfehler: keine Karte und damit keine Aussage über irgendein Objekt", async () => {
    (endpoints.validation.board as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Netz weg") as never,
    );
    (endpoints.directory.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [] as never,
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
    for (let i = 0; i < 8; i += 1) {
      await flush();
    }

    expect(container.querySelectorAll('[data-testid="validation-row"]')).toHaveLength(0);
    expect(stufen()).toHaveLength(0);
  });
});

// ================================================================================================
// Q · DIE QUELLENLISTE BLEIBT DRAUSSEN (Lieferung 7)
// ================================================================================================
describe("JOB 3027 · Q: `originSources` wird getragen, aber nicht gezeigt", () => {
  it("kein Quellenhinweis erscheint auf der Übersichtsfläche", async () => {
    await mountMit([
      zeile({
        origin: "word_addin",
        originSources: [{ id: "q1", label: "Handbuch Seite 12", kind: "external" }],
      }),
    ]);
    await aufklappen();

    expect(container.textContent).not.toContain("Handbuch Seite 12");
  });
});

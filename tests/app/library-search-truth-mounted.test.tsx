// @vitest-environment jsdom
// ================================================================================================
// JOB 1119 · D1 — D-002: DIE BIBLIOTHEKSSUCHE SAGT SICHTBAR, WORIN SIE SUCHT.
// ================================================================================================
//
// DER BEFUND (DESIGN_AN_CHEF/LIEFERUNG-20260813-KATALOGREST.md, D-002): Das Suchfeld trägt nur den
// Platzhalter „Volltextsuche …" und ein `sr-only`-Label — ohne Tippen ist nicht erkennbar, worin
// gesucht wird. Der Nulltreffer-Text rät „anders formulieren". Die Facette heißt „Schlagwort", das
// Treffer-Abzeichen daneben „Tag". Die Topbar verspricht „Wissen, Funktionen oder Anlagen".
//
// ------------------------------------------------------------------------------------------------
// EINE ANNAHME DES BEFUNDS HAT DER PRODUKTSTAND ÜBERHOLT — UND SIE IST DIE WICHTIGE.
// ------------------------------------------------------------------------------------------------
//
// D-002 schlägt als Nulltrefferhinweis vor: „Schlagworte durchsucht dieses Feld nicht — dafür gibt
// es links den Filter ‚Schlagwort'." Belegt wird das mit
// `services/knowledge-object/src/search-projection.ts:616-620`. Dort steht wörtlich:
//
//     AUSDRÜCKLICH NICHT ENTHALTEN (und das ist die Feldgrenze aus S1):
//      · `category` / `tags`  — versionslose Metadaten, s. metadata-projection.ts;
//
// Dieser Satz sagt, was NICHT in `search_text` einfließt. Er sagt NICHT, dass danach nicht gesucht
// wird. Zwei Zeilen weiter im selben Wellen-Umbau steht der Treffer-Vertrag, und der prüft beides
// ausdrücklich mit (`effective-search-document.ts:116-146`):
//
//     const category = treffer(doc.categoryText);
//     const tag      = treffer(doc.tagText);
//     if (!treffer(doc.searchText) && !category && !tag) { return undefined; }
//
// Der Postgres-Adapter bildet dieselbe Regel ab — `COALESCE(md.tag_text,'') ILIKE $n` steht in
// `orsSearch` und damit in der WHERE-Bedingung (`search-projection-repo-pg.ts:565-592`).
//
// DAS SUCHFELD DURCHSUCHT SCHLAGWÖRTER ALSO SEHR WOHL. Der vorgeschlagene Satz wäre eine FALSCHE
// Aussage im Produkt gewesen — und Falschaussagen über den Suchraum sind genau das, wogegen D-002
// angetreten ist. Block E misst den Vertrag, statt ihn zu glauben; Block C hält fest, dass der
// Nulltreffer-Text diese Behauptung nicht aufstellt.
//
// GEBAUT IST DESHALB DIE ZUSAGE DES TITELS, NICHT DER BEISPIELSATZ: Der Nulltreffer-Text benennt
// den WIRKLICHEN Suchraum. Das beantwortet dieselbe Nutzerfrage („warum finde ich nichts?") mit
// einer Angabe, die stimmt.
//
// ==================================================================================================
// JOB 3063 (H4) — WAS DER EIGENTÜMER AM 04.09.2026 AN DIESER ZUSAGE GEÄNDERT HAT.
// ==================================================================================================
//
// Maßstab ist jetzt Apple Pages: „Knopf und Feld erklären sich selbst" (AUFTRAG 3063 §1). Aus dem
// Sichtfeld verschwindet, was erklärt statt zu benennen; §8.5 sagt ausdrücklich, dass gegen DIESE
// Vorgabe geprüft wird und nicht gegen ältere Pins. Für D-002 heißt das dreierlei:
//
//   · DIE FORM des sichtbaren Labels ist weg. Das Feld trägt seinen Namen wieder über ein
//     `sr-only`-Label (`components/bibliothek/BibliothekListe.tsx:118`). DIE SACHE von D-002 bleibt
//     aber erfüllt, und deshalb wird sie hier weiter gemessen: der PLATZHALTER sagt ohne Tippen,
//     WORIN gesucht wird („Bibliothek durchsuchen"), nicht WIE („Volltextsuche"). Genau das war der
//     Befund. Block A misst ab jetzt den zugänglichen Namen, Block B den Platzhalter.
//   · DIE FELDLISTE im Platzhalter („Titel, Text, Kategorie und Schlagwort …") ist gestrichen —
//     sie war der längste Erklärtext der Fläche. Der Schlüssel `lib.search` ist entfallen.
//   · DER NULLTREFFERTEXT ist auf einen Satz gekürzt (AUFTRAG §9: „Nichts gefunden." bzw. „Noch
//     keine Einträge."). Er nennt die Felder nicht mehr. WAS BLEIBT und hier weiter gemessen wird:
//     er stellt keine FALSCHE Behauptung über den Suchraum auf — das war der eigentliche Streitpunkt
//     dieses Auftrags (Block C, Block E).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

// ------------------------------------------------------------------------------------------------
// Die Bibliothek wird wie in `tests/app/a30-suchraum-grenze-mounted.test.tsx` gemountet: echte
// Seite, echte i18n, nur die Datenzuflüsse als Modul-Mock. Die Lage ist veränderlich, damit
// derselbe Mock den Trefferfall UND den echten Nulltreffer bedienen kann.
// ------------------------------------------------------------------------------------------------
function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Titel",
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

const KO_SCHLAGWORT = ko({
  id: "s",
  title: "Flanschmontage",
  statement: "Kurzfassung ohne das Pruefwort.",
  category: "Wartung",
  tags: ["zeitplanung"],
});

const lage: { treffer: KnowledgeObject[]; leseKo: KnowledgeObject | null } = {
  treffer: [],
  leseKo: null,
};

vi.mock("../../apps/web/src/api/hooks", async (importOriginal) => {
  const echt = await importOriginal<Record<string, unknown>>();
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  const leer = () => ok([]);
  return {
    ...echt,
    useKos: () => ok([KO_SCHLAGWORT]),
    useLibrarySearch: () => ok(lage.treffer),
    useDirectory: leer,
    useConflicts: leer,
    // JOB 3063 (H4): die Fläche zeigt rechts den gewählten Eintrag. Die meisten Fälle hier messen
    // die LISTE; die Lesefläche bleibt dann bewusst im Ladezustand — eine leere Fläche ohne Text,
    // die sich in keine Zusicherung einmischt. Block D braucht sie und schaltet sie ausdrücklich an.
    useKo: () =>
      lage.leseKo === null
        ? { data: undefined, isLoading: true, isError: false, error: null }
        : ok(lage.leseKo),
    useAudit: leer,
    useKoEvidence: leer,
    useKoNeighbors: leer,
    useKoVersions: leer,
    useEigeneBefunde: leer,
    useLifecyclePending: leer,
    useExternalPolicy: () => ok({ stage: "blocked" }),
    useReasonerStatus: () => ok({ ready: false }),
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
import { Library } from "../../apps/web/src/pages/Library";
// Der ECHTE Treffer-Vertrag des Servers — nicht eine Nacherzählung davon. Block E misst an ihm,
// was das Suchfeld wirklich durchsucht.
import {
  type EffectiveSearchDocument,
  matchEffectiveSearchDocument,
} from "../../services/knowledge-object/src/effective-search-document";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(entry: string): void {
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

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  lage.treffer = [];
  lage.leseKo = null;
});

function text(): string {
  return container.textContent ?? "";
}

function wert(sprache: Sprache, key: string): string {
  return String(i18n.getResource(sprache, "translation", key));
}

/** Das Suchfeld der Bibliothek — über seine Id, nicht über „irgendein input[type=search]". */
function suchfeld(): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>("input#bib-suche");
  if (!el) {
    throw new Error("Das Suchfeld der Bibliothek ist nicht gerendert");
  }
  return el;
}

/** Das Label, das WIRKLICH zu diesem Feld gehört — über `for`, nicht über Textsuche. */
function suchLabel(): HTMLLabelElement {
  const el = container.querySelector<HTMLLabelElement>('label[for="bib-suche"]');
  if (!el) {
    throw new Error("Zum Suchfeld gehört kein Label");
  }
  return el;
}

// ================================================================================================
// BLOCK A — DAS FELD TRÄGT EINEN NAMEN, UND ZWAR DEN DER BIBLIOTHEK
// ================================================================================================
describe("JOB 1119 · A · das Suchfeld ist benannt", () => {
  it("das Label gehört zum Feld und trägt den Bibliotheks-Wortlaut", () => {
    mount("/bibliothek");
    expect(suchLabel().textContent?.trim()).toBe(wert("de", "lib.searchLabel"));
    expect(wert("de", "lib.searchLabel")).toBe("Bibliothek durchsuchen");
  });

  it("der Name ist auch OHNE Vorlesehilfe da — er steht im Platzhalter", () => {
    // JOB 3063: das Label ist wieder `sr-only`, weil die Fläche keine zweite Zeile Text trägt. Die
    // Zusage von D-002 („ohne Tippen erkennbar, worin gesucht wird") hängt deshalb ab hier am
    // Platzhalter — und die misst dieser Fall, statt sie der Form nach für erfüllt zu erklären.
    mount("/bibliothek");
    expect(suchfeld().placeholder).toBe(wert("de", "lib.searchLabel"));
  });
});

// ================================================================================================
// BLOCK B — DER PLATZHALTER BENENNT DEN SUCHRAUM
// ================================================================================================
describe("JOB 1119 · B · der Platzhalter sagt, worin gesucht wird", () => {
  it("er nennt den Bestand statt der Technik dahinter", () => {
    mount("/bibliothek");
    const platzhalter = suchfeld().placeholder;
    // „Volltextsuche" ist eine Technikauskunft: sie sagt WIE gesucht wird, nicht WORIN.
    expect(platzhalter).not.toContain("Volltextsuche");
    expect(platzhalter).toContain("Bibliothek");
  });

  it("er behauptet keine Felder, die es nicht gibt", () => {
    // Gegenprobe zur Topbar-Zusage: „Funktionen" und „Anlagen" durchsucht diese Suche nicht.
    mount("/bibliothek");
    for (const nichtFeld of ["Funktionen", "Anlagen"]) {
      expect(suchfeld().placeholder).not.toContain(nichtFeld);
    }
  });
});

// ================================================================================================
// BLOCK C — DER NULLTREFFERHINWEIS IST EHRLICH
// ================================================================================================
describe("JOB 1119 · C · der Nulltreffer behauptet nichts Falsches", () => {
  it("er sagt, dass die SUCHE nichts fand — nicht, dass es das nicht gibt", () => {
    lage.treffer = [];
    mount("/bibliothek?q=wortdasesnirgendsgibt");
    expect(text()).toContain(wert("de", "lib.liste.leerSuche"));
    expect(text()).not.toContain("Keine Treffer.");
  });

  it("er behauptet NICHT, dass Schlagworte ungesucht blieben", () => {
    // Der Satz aus dem Katalogvorschlag. Er wäre falsch (Block E) — und eine falsche Auskunft über
    // den Suchraum ist genau der Schaden, den D-002 beheben will.
    lage.treffer = [];
    mount("/bibliothek?q=wortdasesnirgendsgibt");
    expect(text()).not.toContain("durchsucht dieses Feld nicht");
    expect(text()).not.toContain("Schlagworte durchsucht");
  });

  it("KALIBRIERUNG: bei Treffern erscheint der Nulltreffer-Text nicht", () => {
    // Ohne diesen Fall bliebe der Block auch dann grün, wenn der Hinweis IMMER stünde.
    lage.treffer = [KO_SCHLAGWORT];
    mount("/bibliothek?q=zeitplanung");
    expect(text()).toContain("Flanschmontage");
    expect(text()).not.toContain(wert("de", "lib.liste.leerSuche"));
  });
});

// ================================================================================================
// BLOCK D — „TAG" HEISST AUF DEUTSCH SCHLAGWORT UND AUF NIEDERLÄNDISCH TREFWOORD
// ================================================================================================
describe("JOB 1119 · D · eine Sache, ein Wort", () => {
  it("das Treffer-Abzeichen heißt wie die Facette daneben", () => {
    // Facette und Abzeichen bezeichnen DASSELBE Feld. Zwei Wörter dafür auf einer Seite sind für
    // den Leser zwei Dinge.
    expect(wert("de", "lib.match.tag")).toBe(wert("de", "lib.facet.tag"));
    expect(wert("nl", "lib.match.tag")).toBe(wert("nl", "lib.facet.tag"));
    expect(wert("de", "lib.match.tag")).toBe("Schlagwort");
    expect(wert("nl", "lib.match.tag")).toBe("Trefwoord");
  });

  it("im Englischen bleibt Tag stehen — dort ist es das richtige Wort", () => {
    expect(wert("en", "lib.match.tag")).toBe("Tag");
  });

  it("das Abzeichen erscheint mit diesem Wortlaut an einem echten Schlagworttreffer", () => {
    // JOB 3063 (H4): der Treffergrund steht auf der LESEFLÄCHE unter der Meta-Zeile
    // (`components/bibliothek/BibliothekLesen.tsx:526-534`), nicht mehr an der Trefferzeile — und
    // er trägt eine eigene Marke, statt über eine CSS-Klassenkette gesucht zu werden.
    lage.treffer = [KO_SCHLAGWORT];
    lage.leseKo = KO_SCHLAGWORT;
    mount("/bibliothek?q=zeitplanung");
    const grund = container.querySelector('[data-testid="bib-treffergrund"]');
    expect(grund, "der Treffergrund fehlt auf der Lesefläche").toBeTruthy();
    expect((grund?.textContent ?? "").trim()).toBe(
      `${wert("de", "lib.matchIn")} ${wert("de", "lib.match.tag")}`,
    );
  });

  it("KALIBRIERUNG: ohne Suchtext steht kein Treffergrund da", () => {
    // Ohne diesen Fall wäre der Fall oben auch dann grün, wenn der Grund immer dastünde — dann
    // behauptete die Fläche einen Treffergrund, wo gar nicht gesucht wurde.
    lage.treffer = [KO_SCHLAGWORT];
    lage.leseKo = KO_SCHLAGWORT;
    mount("/bibliothek");
    expect(container.querySelector('[data-testid="bib-treffergrund"]')).toBeNull();
  });
});

// ================================================================================================
// BLOCK E — DER GEMESSENE SUCHRAUM: SCHLAGWÖRTER WERDEN DURCHSUCHT
// ================================================================================================
//
// Dieser Block ist die Grundlage für den Wortlaut in B und C. Er misst den echten Treffer-Vertrag
// des Servers, statt eine Annahme über ihn zu übernehmen.
describe("JOB 1119 · E · was der Suchvertrag wirklich prüft", () => {
  function dokument(over: Partial<EffectiveSearchDocument>): EffectiveSearchDocument {
    return {
      koId: "k",
      koVersion: 1,
      projectionVersion: 2,
      searchText: "",
      titleText: "",
      statementText: "",
      captionText: "",
      bodyText: "",
      language: "de",
      contentHash: "h",
      status: "ready",
      classificationSnapshot: {},
      categoryText: "",
      tagText: "",
      metadataRevision: 1,
      ...over,
    } as EffectiveSearchDocument;
  }

  it("ein Begriff, der NUR im Schlagwort steht, ist ein Treffer", () => {
    const hit = matchEffectiveSearchDocument(dokument({ tagText: "zeitplanung" }), ["zeitplanung"]);
    expect(hit).toBeDefined();
    expect(hit?.matched.tag).toBe(true);
  });

  it("ein Begriff, der NUR in der Kategorie steht, ist ein Treffer", () => {
    const hit = matchEffectiveSearchDocument(dokument({ categoryText: "wartung" }), ["wartung"]);
    expect(hit).toBeDefined();
    expect(hit?.matched.category).toBe(true);
  });

  it("KALIBRIERUNG: ein Begriff, den kein Feld trägt, ist kein Treffer", () => {
    // Ohne diesen Fall wären die beiden oben auch dann grün, wenn der Vertrag ALLES zurückgäbe.
    expect(matchEffectiveSearchDocument(dokument({ tagText: "zeitplanung" }), ["nirgends"])).toBe(
      undefined,
    );
  });
});

// ================================================================================================
// BLOCK F — DREI SPRACHEN, DREI ECHTE ÜBERSETZUNGEN
// ================================================================================================
describe("JOB 1119 · F · DE, EN und NL", () => {
  // JOB 3063: `lib.search` und `lib.emptyQuery` sind entfallen; an ihre Stelle tritt der eine
  // Nulltreffersatz der neuen Liste. Die Sprachzusage zieht mit dem Text um, nicht mit dem Namen.
  const SCHLUESSEL = ["lib.searchLabel", "lib.liste.leerSuche", "topbar.search"];

  it("jeder berührte Schlüssel existiert in allen drei Sprachen", () => {
    for (const key of SCHLUESSEL) {
      for (const sprache of SPRACHEN) {
        const v = wert(sprache, key);
        expect(v, `${key} fehlt in ${sprache}`).not.toBe("undefined");
        expect(v.trim().length, `${key} ist in ${sprache} leer`).toBeGreaterThan(0);
      }
    }
  });

  it("keine Sprache trägt den Wortlaut einer anderen", () => {
    // Der billige Weg, „dreisprachig" zu behaupten, ist Kopieren. Das fängt dieser Fall.
    for (const key of SCHLUESSEL) {
      const werte = SPRACHEN.map((s) => wert(s, key));
      expect(new Set(werte).size, `${key} ist nicht in drei Sprachen übersetzt`).toBe(3);
    }
  });

  it("die niederländische Fassung ist wirklich niederländisch", () => {
    expect(wert("nl", "lib.searchLabel").toLowerCase()).toContain("bibliotheek");
    expect(wert("nl", "lib.liste.leerSuche").toLowerCase()).toContain("gevonden");
    // Das Wort, um das Block D geht, steht in seiner niederländischen Fassung da.
    expect(wert("nl", "lib.match.tag")).toBe("Trefwoord");
  });

  it("die Bibliothek zeigt in jeder Sprache ihren eigenen Feldnamen", async () => {
    // Nicht nur die Wörterbücher — die gemountete Seite, Label UND Platzhalter.
    for (const sprache of SPRACHEN) {
      await act(async () => {
        await i18n.changeLanguage(sprache);
      });
      mount("/bibliothek");
      expect(suchLabel().textContent?.trim()).toBe(wert(sprache, "lib.searchLabel"));
      expect(suchfeld().placeholder).toBe(wert(sprache, "lib.searchLabel"));
      act(() => root.unmount());
      container.remove();
    }
    // Der abschließende Mount, den `afterEach` abräumt.
    await act(async () => {
      await i18n.changeLanguage("de");
    });
    mount("/bibliothek");
  });
});

// ================================================================================================
// BLOCK G — DIE TOPBAR VERSPRICHT NUR, WOHIN SIE WIRKLICH FÜHRT
// ================================================================================================
describe("JOB 1119 · G · die Topbar-Zusage", () => {
  it("sie verspricht keine Funktionen und keine Anlagen mehr", () => {
    // `Topbar.tsx:397-400` navigiert ausschließlich nach `/bibliothek?q=…` — Funktionen und Anlagen
    // findet dieser Weg nicht. Der Beleg für das WOHIN steht als gemounteter Fall in
    // `tests/app/topbar-search-enter-mounted.test.tsx`; hier steht die Zusage dazu.
    expect(wert("de", "topbar.search")).not.toContain("Funktionen");
    expect(wert("de", "topbar.search")).not.toContain("Anlagen");
    expect(wert("en", "topbar.search")).not.toContain("features");
    expect(wert("nl", "topbar.search")).not.toContain("functies");
  });

  it("sie nennt die Bibliothek als das, was sie durchsucht", () => {
    expect(wert("de", "topbar.search").toLowerCase()).toContain("bibliothek");
    expect(wert("en", "topbar.search").toLowerCase()).toContain("library");
    expect(wert("nl", "topbar.search").toLowerCase()).toContain("bibliotheek");
  });
});

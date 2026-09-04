// @vitest-environment jsdom
// ================================================================================================
// A30 — DAS SICHTBARE ENDE DER SUCHKETTE (mounted)
// ================================================================================================
//
// JOB 612 · D4, Korrekturpflicht 4: „Server-, Route-, Client- und mounted-UI-Fälle einschließlich
// unsichtbarer Beiträge und echtem Nulltreffer ausliefern. Der sichtbare Wortlaut darf nur
// erscheinen, wenn ein sichtbarer, nicht projizierter Beitrag nachweislich existiert."
//
// Server und Route stehen in `tests/app/a30-suchraum-grenze.test.ts` (Teile A/B/C). Hier steht das
// letzte Glied: die gemountete Bibliothek.
//
// WAS DIESE DATEI KORRIGIERT. Das D3-Urteil hat die Nutzenkette als SERVERINTERN eingestuft, weil
// `library-analytics/service.ts:1240` den Treffer nur zum Filtern nutzt und `KnowledgeObject[]`
// ausgibt — `KoSearchHit.matched.tag` reist nicht über den Draht. Das stimmt, und es ist trotzdem
// nicht das Ende der Kette: der Client RECHNET den Fundstellengrund selbst, aus dem gelieferten
// Objekt (`lib/librarySearch.ts:134-163`, `scoreKo`), und `pages/Library.tsx:1050-1063` zeichnet
// ihn als „gefunden in: …". Der Nutzer sieht also sehr wohl, WARUM ein Objekt in seiner Liste
// steht. D1/D2 nageln genau das fest — vorher war es an keiner Stelle gemessen.
//
// UND WAS SIE NICHT BAUT. Einen Hinweis auf „Projektionsrückstand" gibt es hier nicht. Die
// Vorbedingung dafür — ein sichtbarer, nicht projizierter Beitrag — ist im Betrieb nicht
// erreichbar (Teil B der Server-Datei: das Freigabegate lässt eine Instanz mit unvollständiger
// Metadatenprojektion nicht suchbereit werden, und eine nicht suchbereite Instanz wirft, statt
// leer zu antworten). D3 hält deshalb fest, dass der Nulltreffer den EHRLICHEN Nulltreffer-Text
// trägt und eben keine Rückstandsbehauptung.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

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

// Das Prüfwort steht AUSSCHLIESSLICH im Schlagwort — nicht im Titel, nicht in der Kernaussage,
// nicht in der Kategorie. Ohne diese Trennung wiese D1 den Schlagwort-Grund gar nicht nach,
// sondern nur irgendeinen Grund.
const KO_SCHLAGWORT = ko({
  id: "s",
  title: "Flanschmontage",
  statement: "Kurzfassung ohne das Pruefwort.",
  category: "Wartung",
  tags: ["schlagwortalpha"],
});
// Spiegelbild für die Kategorie-Dimension.
const KO_KATEGORIE = ko({
  id: "k",
  title: "Pumpenkennlinie",
  statement: "Kurzfassung ohne das Pruefwort.",
  category: "Kategoriewortalpha",
  tags: ["hydraulik"],
});

// Die Lage ist veränderlich, damit derselbe Modul-Mock den Trefferfall UND den echten Nulltreffer
// bedienen kann (dasselbe Muster wie Library.origin-chip.test.tsx).
const lage: { treffer: KnowledgeObject[] } = { treffer: [] };

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok([KO_SCHLAGWORT, KO_KATEGORIE]),
    useLibrarySearch: () => ok(lage.treffer),
    useDirectory: () => ok([]),
    useConflicts: () => ok([]),
    // JOB 3063 (H4): der Fundstellengrund steht auf der LESEFLÄCHE unter der Meta-Zeile
    // (`components/bibliothek/BibliothekLesen.tsx:526-534`), nicht mehr an der Trefferzeile — die
    // Zeile trägt seit dem Umbau nur Punkt, Titel und „Bereich · Status". Die Lesefläche zeigt den
    // gewählten Eintrag; sie bekommt ihn hier aus derselben Treffermenge.
    useKo: () => ok(lage.treffer[0] ?? null),
    useAudit: () => ok([]),
    useKoEvidence: () => ok([]),
    useKoNeighbors: () => ok([]),
    useKoVersions: () => ok([]),
    useEigeneBefunde: () => ok([]),
    useLifecyclePending: () => ok([]),
    useExternalPolicy: () => ok({ stage: "blocked" }),
    useReasonerStatus: () => ok({ active: false }),
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

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  lage.treffer = [];
});

function text(): string {
  return container.textContent ?? "";
}

function de(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

// Die Fundstellengründe als MENGE, aus ihrer eigenen Marke gelesen — nicht über eine Textsuche im
// ganzen Rumpf. Ein Wort wie „Titel" kommt auf der Seite auch anderswo vor; eine Rumpfsuche danach
// wäre kein Nachweis, sondern ein Zufall.
//
// JOB 3063 (H4): die Gründe stehen als EINE Zeile auf der Lesefläche
// (`data-testid="bib-treffergrund"`, `BibliothekLesen.tsx:526-534`) in der Form
// „Treffer in <Grund> · <Grund>". Gelesen wird der Teil nach der Beschriftung.
function gruende(): string[] {
  const zeile = container.querySelector('[data-testid="bib-treffergrund"]');
  if (zeile === null) {
    return [];
  }
  const roh = (zeile.textContent ?? "").replace(/\s+/g, " ").trim();
  const kopf = `${de("lib.matchIn")} `;
  return roh.startsWith(kopf)
    ? roh
        .slice(kopf.length)
        .split(" · ")
        .map((s) => s.trim())
    : [roh];
}

describe("A30 · Teil D · die Bibliothek zeigt, WARUM etwas in der Liste steht", () => {
  it("D1 — ein reiner Schlagworttreffer erscheint MIT dem Fundstellengrund „in Schlagwort", () => {
    lage.treffer = [KO_SCHLAGWORT];

    mount("/bibliothek?q=schlagwortalpha");

    // Das Objekt selbst ist da …
    expect(text()).toContain("Flanschmontage");
    // … und daneben steht der GRUND, aus dem es da ist. Genau dieses Glied hat D3 als fehlend
    // beanstandet; es entsteht clientseitig aus dem gelieferten Objekt, nicht aus matched.tag.
    expect(text()).toContain(de("lib.matchIn"));
    // Die Gründe stehen als MENGE fest: genau der Schlagwort-Grund, kein zweiter. Wäre hier bloß
    // „enthält den Schlagwort-Grund" geprüft, bliebe der Fall auch grün, wenn die Oberfläche
    // wahllos alle Dimensionen anzeigte.
    expect(gruende()).toEqual([de("lib.match.tag")]);
  });

  it("D2 — ein reiner Kategorietreffer erscheint MIT dem Fundstellengrund „in Kategorie", () => {
    lage.treffer = [KO_KATEGORIE];

    mount("/bibliothek?q=kategoriewortalpha");

    expect(text()).toContain("Pumpenkennlinie");
    expect(gruende()).toEqual([de("lib.match.category")]);
  });

  it("D3 — ein ECHTER Nulltreffer trägt den ehrlichen Nulltreffer-Text, keine Rückstandsbehauptung", () => {
    lage.treffer = [];

    mount("/bibliothek?q=wortdasesnirgendsgibt");

    // Der Wortlaut sagt nichts über den Zustand der Projektion. Ein Satz wie „möglicherweise noch
    // nicht durchsuchbar" wäre nach Korrekturpflicht 4 nur zulässig, wenn ein sichtbarer, nicht
    // projizierter Beitrag nachweislich existierte — er existiert nicht.
    //
    // JOB 3063 (H4): der Nulltreffer ist auf EINEN Satz gekürzt („Nichts gefunden.",
    // AUFTRAG §9) und wiederholt die Anfrage nicht mehr. Der Suchtext steht weiter sichtbar im
    // Feld — dort, wo er hingehört; die Wiederholung im Satz war Text über Text.
    expect(text()).toContain(de("lib.liste.leerSuche"));
    const feld = container.querySelector("#bib-suche");
    expect((feld as HTMLInputElement | null)?.value).toBe("wortdasesnirgendsgibt");
    for (const verbotenerHinweis of ["Projektion", "projiziert", "noch nicht durchsuchbar"]) {
      expect(
        text(),
        `Die Bibliothek darf keinen Projektionsrückstand behaupten (${verbotenerHinweis})`,
      ).not.toContain(verbotenerHinweis);
    }
  });

  it("D4 — KALIBRIERUNG: bei Treffern erscheint der Nulltreffer-Text NICHT", () => {
    lage.treffer = [KO_SCHLAGWORT];

    mount("/bibliothek?q=schlagwortalpha");

    // Ohne diesen Fall wäre D3 auch dann grün, wenn der Leerzustand IMMER stünde.
    expect(text()).not.toContain(de("lib.liste.leerSuche"));
  });
});

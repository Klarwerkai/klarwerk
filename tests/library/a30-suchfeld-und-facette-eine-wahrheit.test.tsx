// @vitest-environment jsdom
// ================================================================================================
// A30 · SUCHFELD UND SCHLAGWORTFACETTE — DIE INVARIANTEN, DIE JEDE OWNERENTSCHEIDUNG ÜBERLEBEN MUSS
// ================================================================================================
//
// JOB 1073 · D3. Der Auftragstext ist das rote Vollurteil BEN4-PRUEFUNG-JOB-1073-D2
// (SHA-256 0d1c2cc2…). Es sperrt den Produktwrite ausdrücklich:
//
//     „PRODUKTSPERRE: Vor dem nächsten Produktwrite ist die Ownerentscheidung zum
//      Bewahrungsanker zwingend; die D2-Lease ersetzt diese Entscheidung nicht."
//
// und in der FOLGEBINDUNG: „Kein automatischer D3-Bau vor der Ownerentscheidung."
//
// GEMESSEN: `00_CONTROL/ENTSCHEIDUNGEN/` führt keine Entscheidung zu JOB 1073 und keine zum
// Bewahrungsanker. Der Konflikt besteht unverändert — `tests/library/wissensraum381-bewahrung-
// nulldiff.test.ts` pinnt `apps/web/src/lib/librarySearch.ts` bytegleich auf
// `0d7c4880…`, und genau diese Datei müsste Korrekturpflicht 3 ändern.
//
// ------------------------------------------------------------------------------------------------
// WAS DIESE DATEI IST — UND WAS SIE AUSDRÜCKLICH NICHT IST
// ------------------------------------------------------------------------------------------------
// Sie ändert KEINEN Produktcode. `librarySearch.ts` und der Bewahrungsanker bleiben zeichengleich.
//
// Sie hält die drei Zusagen fest, die unter JEDER der drei vom Urteil eröffneten Optionen gelten
// müssen — Anker fortschreiben, anderer einziger Vertragspfad, oder A30 zurückstellen:
//
//   I.   DIE ZWEI BEDIENWEGE, jeder an seinem eigenen Vertrag (Prüflücke 3): die Facette FILTERT
//        clientseitig, das Suchfeld RANKT nur — die Auswahl trifft dort der Server. Wer den
//        Suchraum künftig anders verdrahtet, darf beide Verträge nicht verlieren.
//   II.  FELDBINDUNG DES GRUNDES: ein Schlagwort-Treffergrund entsteht nur, wenn das Schlagwort
//        wirklich am Objekt steht. Kein Grund ohne Feld.
//   III. FAIL-CLOSED OHNE FELD: ein Objekt ohne Schlagwörter erzeugt weder einen Schlagwort-Grund
//        noch einen Facettenwert.
//
// Sie behauptet NICHT, der Vertrag sei einheitlich. Das ist er nicht (s. Rückgabe §3): der Server
// entscheidet über die Projektion (`tagText` im Effective Search Document), der Client über das
// operative Feld `ko.tags` — `scoreKo:134` und `libraryFilterValues:102` lesen beide dieses Feld.
// Ein grüner Test, der diesen Zustand als richtig festschreibt, wäre ein Scheinbeleg; deshalb steht
// hier kein solcher Fall.
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
// nicht in der Kategorie. Ohne diese Trennung prüfte die Deckungsgleichheit unten irgendeinen
// Treffer statt des Schlagworttreffers.
const MIT_SCHLAGWORT = ko({
  id: "mit",
  title: "Zylinderdichtung",
  statement: "Kurzfassung ohne das Pruefwort.",
  category: "Wartung",
  tags: ["hydraulikpruefwort"],
});
// Der Kalibrierungspartner: gleiche Form, anderes Schlagwort. Ohne ihn wären die Fälle unten auch
// dann grün, wenn Suchfeld und Facette schlicht alles durchließen.
const OHNE_SCHLAGWORT = ko({
  id: "ohne",
  title: "Pumpenkennlinie",
  statement: "Kurzfassung ohne das Pruefwort.",
  category: "Wartung",
  tags: ["ganzandereswort"],
});
// Und ein Objekt ganz ohne Schlagwörter — für die Fail-closed-Zusage.
const OHNE_FELD = ko({
  id: "leer",
  title: "Ventilkennlinie",
  statement: "Kurzfassung ohne das Pruefwort.",
  category: "Wartung",
  tags: [],
});

const KOS = [MIT_SCHLAGWORT, OHNE_SCHLAGWORT, OHNE_FELD];
const PRUEFWORT = "hydraulikpruefwort";

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok(KOS),
    // Die Suchroute liefert hier ALLE drei Objekte — bewusst, und es ist die Messanordnung dieses
    // Durchgangs: so wird sichtbar, was der CLIENT allein tut. Er filtert beim Suchfeld nicht; die
    // Auswahl trifft der Server über die Projektion. Genau diese Arbeitsteilung ist der Gegenstand
    // der offenen Ownerentscheidung.
    useLibrarySearch: () => ok(KOS),
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
import { libraryFilterValues } from "../../apps/web/src/lib/libraryFacets";
// Der EINE Produktweg des Suchfelds — kein Nachbau. `scoreKo` ist die Funktion, die
// Korrekturpflicht 3 künftig an den maßgeblichen Suchraum binden soll.
import { scoreKo } from "../../apps/web/src/lib/librarySearch";
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
});

function text(): string {
  return container.textContent ?? "";
}

// ================================================================================================
// I · DIE ZWEI BEDIENWEGE — und der gemessene Grund, warum sie NICHT von selbst deckungsgleich sind
// ================================================================================================
//
// Prüflücke 3 verlangt: „Positivkalibrierung mit vorhandener Metadatenprojektion: Suchfeld und
// Facette müssen dasselbe Objekt finden."
//
// AM BESTAND GEMESSEN — und der erste Entwurf dieser Datei lag darin falsch: die beiden Wege sind
// NICHT symmetrisch gebaut, und das ist Absicht, kein Fehler.
//
//   · Die SCHLAGWORTFACETTE filtert CLIENTSEITIG. `libraryFilterValues` (libraryFacets.ts:102)
//     liest `ko.tags`, `applyFacetSelection` wirft alles Übrige weg.
//   · Das SUCHFELD filtert clientseitig GAR NICHT. `searchLibrary` (librarySearch.ts:172-174)
//     „verwirft nichts" — es RE-RANKT nur, was der Server geliefert hat. Die Auswahl trifft
//     ausschließlich der Server, über die Projektion (`tagText` im Effective Search Document).
//
// DARAUS FOLGT DIE EIGENTLICHE AUSSAGE DIESES DURCHGANGS, und sie ist die Entscheidungsgrundlage,
// die dem Owner fehlt: die beiden Wege sind genau dann deckungsgleich, wenn die SERVERPROJEKTION
// dieselbe Auskunft gibt wie das operative Feld `ko.tags`. Genau diese Gleichheit ist heute nicht
// zugesichert — das ist BEN4s „Server und Client verwenden weiterhin verschiedene Suchwahrheiten".
//
// Die Fälle hier pinnen deshalb, was JEDER der drei Entscheidungswege erhalten muss: den
// Client-Vertrag beider Wege, einzeln und ehrlich. Sie behaupten NICHT, die Wege seien schon eine
// Wahrheit.

describe("A30 · I — die beiden Bedienwege, jeder an seinem eigenen Vertrag", () => {
  it("die SCHLAGWORTFACETTE filtert auf genau das Objekt mit dem Schlagwort", () => {
    mount(`/bibliothek?tag=${PRUEFWORT}`);

    expect(text()).toContain("Zylinderdichtung");
    expect(text()).not.toContain("Pumpenkennlinie");
    expect(text()).not.toContain("Ventilkennlinie");
  });

  it("das SUCHFELD stellt dasselbe Objekt nach vorn — und verwirft dabei nichts", () => {
    mount(`/bibliothek?q=${PRUEFWORT}`);

    // Der Client-Vertrag des Suchfelds ist RANG, nicht Auswahl (librarySearch.ts:172-174). Das
    // Objekt mit dem Schlagwort steht vorn; die anderen bleiben sichtbar, weil der SERVER sie
    // geliefert hat. Wer das für ein Filter hielte, überschätzte den Client — genau dieser Irrtum
    // stand im ersten Entwurf dieser Datei und ist am Bestand korrigiert.
    //
    // DER TITEL IST MIT ABSICHT „Zylinderdichtung": er sortiert alphabetisch HINTER die beiden
    // anderen. Der Tie-Breaker der Rangfolge (Titel, librarySearch.ts:182) zieht ihn also nach
    // HINTEN — vorn steht er nur, wenn wirklich der SCORE entscheidet. Der erste Entwurf hiess
    // „Flanschmontage" und stand schon alphabetisch vorn; eine Gegenmutation an `b.score - a.score`
    // blieb damit gruen, und der Fall pruefte nichts. Am Bestand gemessen und behoben.
    const rumpf = text();
    expect(rumpf).toContain("Zylinderdichtung");
    expect(rumpf.indexOf("Zylinderdichtung")).toBeLessThan(rumpf.indexOf("Pumpenkennlinie"));
    expect(rumpf.indexOf("Zylinderdichtung")).toBeLessThan(rumpf.indexOf("Ventilkennlinie"));
  });

  it("KALIBRIERUNG: ohne Auswahl zeigt die Seite alle drei — die Facette filtert wirklich", () => {
    // Ohne diesen Fall waere der Facettenfall auch dann gruen, wenn die Seite grundsaetzlich nur
    // ein Objekt zeigte.
    mount("/bibliothek");

    expect(text()).toContain("Zylinderdichtung");
    expect(text()).toContain("Pumpenkennlinie");
    expect(text()).toContain("Ventilkennlinie");
  });
});

// ================================================================================================
// II + III · FELDBINDUNG UND FAIL-CLOSED — DOM-frei an den beiden Produktfunktionen
// ================================================================================================
//
// Beide Bedienwege lesen heute dasselbe operative Feld: `scoreKo` (librarySearch.ts:134) und
// `libraryFilterValues` (libraryFacets.ts:102). Diese Faelle halten fest, dass der Treffergrund an
// das Feld gebunden bleibt — die Zusage, die eine kuenftige Umverdrahtung nicht verlieren darf.

describe("A30 · II/III — der Treffergrund ist an das Feld gebunden", () => {
  it("ein Schlagwort-Grund entsteht nur, wenn das Schlagwort wirklich am Objekt steht", () => {
    expect(scoreKo(MIT_SCHLAGWORT, PRUEFWORT).matches).toContain("tag");
    expect(scoreKo(OHNE_SCHLAGWORT, PRUEFWORT).matches).not.toContain("tag");
  });

  it("und die Facette fuehrt genau dasselbe Feld", () => {
    const jetzt = Date.now();
    expect(libraryFilterValues(MIT_SCHLAGWORT, jetzt).tag).toEqual([PRUEFWORT]);
    expect(libraryFilterValues(OHNE_SCHLAGWORT, jetzt).tag).not.toContain(PRUEFWORT);
  });

  it("FAIL-CLOSED: ohne Schlagwortfeld gibt es weder Grund noch Facettenwert", () => {
    expect(scoreKo(OHNE_FELD, PRUEFWORT).matches).toEqual([]);
    expect(libraryFilterValues(OHNE_FELD, Date.now()).tag).toEqual([]);
  });
});

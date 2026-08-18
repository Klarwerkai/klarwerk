// ================================================================================================
// W6 · DIE DREI PREFILTER-ZUSTÄNDE — UND DASS DIE LEITUNG ZWEI VON IHNEN NICHT UNTERSCHEIDET
// ================================================================================================
//
// JOB 954 · D4. Der Auftragstext ist das rote Vollurteil BEN-PRUEFUNG-JOB-954-D3
// (SHA-256 09eb380e…). Sein Abschnitt 4 („DEEP-ZUSAGE: semantische Grundlage nicht gebunden")
// verlangt drei Zustände und stellt fest, D3 liefere die Matrix nicht:
//
//     Zustand 1 · Prefilter deaktiviert
//     Zustand 2 · Prefilter aktiviert, aber Store leer
//     Zustand 3 · Prefilter aktiviert und sinnvoll befüllt
//
// „Nur der dritte Zustand kann eine allgemeine semantische Reichweitenzusage tragen."
//
// Am Bestand nachgemessen: die Nachbardatei `services/app/src/check-text-detection.test.ts` deckt
// Zustand 1 (:107) und Zustand 3 (:127, :153). Zustand 2 fehlt. Diese Datei schließt ihn — und
// hält dabei einen Befund fest, der beim Messen erst sichtbar wurde und den das Urteil nur
// vermutet hatte.
//
// ------------------------------------------------------------------------------------------------
// DER BEFUND: `method` beschreibt das URTEILS-Verfahren, nicht die ABRUF-Tiefe
// ------------------------------------------------------------------------------------------------
// Gemessen (Zählungen embed / findCandidates / ko.get, dann duplicates):
//
//     Zustand 1, ferner Text : embed –   find 1   get 0   →   [["v1","model"]]
//     Zustand 2, ferner Text : embed 1   find 1   get 0   →   [["v1","model"]]
//     Zustand 3, ferner Text : embed 1   find 0   get 1   →   [["v1","model"]]
//
// Die Abrufwege sind drei verschiedene. Die Antwort ist in allen drei Fällen DIESELBE. `method`
// unterscheidet nur, ob der Judge geurteilt hat (`model`) oder die deterministische Ähnlichkeit
// gereicht hat (`deterministic`) — es sagt nichts darüber, ob der Kandidat semantisch oder
// lexikalisch überhaupt GEFUNDEN wurde.
//
// Damit ist die Sorge aus Abschnitt 4 („Die UI kann weiterhin eine Tiefe suggerieren, die der
// reale Kandidatenpool nicht deckt") kein Verdacht mehr, sondern gemessen: ein Aufruf mit leerem
// Vektorspeicher liefert ein Ergebnis, das von einem echten Tiefentreffer auf der Leitung nicht
// zu trennen ist. Der letzte Fall dieser Datei hält genau diese Ununterscheidbarkeit fest — nicht
// als gutes Verhalten, sondern als Sollbruchstelle, die rot wird, sobald jemand den fehlenden
// Zustand nachrüstet. Dann ist das Nachziehen dieser Datei der bewusste Beleg dafür, dass die
// Lücke geschlossen wurde.
//
// WAS DIESE DATEI NICHT TUT: sie schließt die Lücke nicht. Der Eingriffsort wäre
// `check-text-detection.ts` (Ergebnisform) und `check-text-routes.ts` (`toResponse`); beide sind
// in der Lease dieses Durchgangs NICHT enthalten — sie führt ausschließlich `tests/**`. Ob die
// Antwort künftig einen eigenen Reichweitenzustand trägt, ist eine Owner-Entscheidung.
//
// EBENFALLS NICHT GEPINNT: dass der Embedder bei leerem Store überhaupt läuft. Er tut es
// (`embed: 1`), ohne Ertrag. Ein Vertraulichkeitsleck ist das nicht — das Tor sitzt davor, in der
// Route (fail-safe vertraulich) und in `selectValidatedPool` —, aber es als richtig
// festzuschreiben wäre ein Scheinbeleg. Es steht in der Rückgabe als gemessene Kosten.
import { describe, expect, it, vi } from "vitest";
import { checkText } from "../../services/app/src/check-text-detection";
import type { SemanticPrefilter } from "../../services/app/src/duplicate-detection";
import { InMemoryOverlapRepo, OverlapService, type OverlapVerdict } from "../../services/conflicts";
import type { EmbeddingProvider, EmbeddingStore } from "../../services/embedding";
import type { KnowledgeObject, KoService } from "../../services/knowledge-object";

/** Der geprüfte Text. */
const EINGABE = "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlüften.";
/**
 * Der Bestandssatz ist bewusst NICHT wortgleich. Wortgleich griffe die deterministische Ähnlichkeit
 * und der Judge liefe nie — dann prüfte die Matrix den kurzgeschlossenen Weg statt des normalen.
 */
const BESTAND = "Nach dem Anfahren zehn Sekunden warten.";

function mkKo(id: string): KnowledgeObject {
  return {
    id,
    title: "Pumpe entlüften",
    statement: BESTAND,
    status: "validiert",
    conditions: [],
    measures: [],
    tags: [],
    category: "Wartung",
    asset: null,
  } as unknown as KnowledgeObject;
}

const treffer: OverlapVerdict = {
  beziehung: "teilweise",
  aspects: [
    { beschreibung: "Titel deckt sich", zitatA: "Pumpe entlüften", zitatB: "Pumpe entlüften" },
  ],
  nurInA: "nur in A",
  nurInB: "nur in B",
  empfehlung: "zusammenfuehren_pruefen",
  confidence: 0.9,
  begruendung: "Teilweiser gemeinsamer Kern.",
};

/** `hits` leer = Store leer (Zustand 2); `hits` gefüllt = Store befüllt (Zustand 3). */
function spyPrefilter(hits: Array<{ id: string }>) {
  const embed = vi.fn(async () => ({ vectors: [[1, 0, 0]], embeddingVersion: "spy@3", dim: 3 }));
  const nearest = vi.fn(async () => hits);
  const prefilter: SemanticPrefilter = {
    embedder: {
      name: "spy",
      embeddingVersion: "spy@3",
      dim: 3,
      isAvailable: () => true,
      embed,
    } as unknown as EmbeddingProvider,
    store: { upsert: vi.fn(), nearest, delete: vi.fn() } as unknown as EmbeddingStore,
    topK: 20,
  };
  return { prefilter, embed, nearest };
}

/**
 * Ein Durchgang. Der KO-Fake deckelt bewusst nicht selbst — würde er sich begrenzen, wäre jede
 * Aussage über den Abrufweg tautologisch. Gemessen wird, was der Orchestrator anfordert.
 */
async function lauf(prefilter: SemanticPrefilter | undefined) {
  const seed = [mkKo("v1")];
  const list = vi.fn(async () => seed);
  const findCandidates = vi.fn(async (_q: { terms: readonly string[]; limit: number }) => seed);
  const get = vi.fn(async (id: string) => seed.find((k) => k.id === id));
  const judge = vi.fn(async (): Promise<OverlapVerdict | null> => treffer);

  const ergebnis = await checkText(
    { text: EINGABE, title: "Pumpe entlüften" },
    {
      ko: { list, findCandidates, get } as unknown as KoService,
      overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
      duplicateJudge: judge,
      ...(prefilter ? { semanticPrefilter: prefilter } : {}),
    },
  );
  return { ergebnis, list, findCandidates, get, judge };
}

/** Die Antwort so, wie ein Aufrufer sie sieht — mehr trägt `duplicates` je Treffer nicht. */
const aufDerLeitung = (e: Awaited<ReturnType<typeof lauf>>["ergebnis"]) =>
  e.duplicates.map((d) => [d.koId, d.method]);

// ================================================================================================

describe("W6 · Zustand 2 — Prefilter aktiviert, Vektorspeicher LEER", () => {
  it("versucht den semantischen Weg wirklich und faellt dann lexikalisch zurueck", async () => {
    const { prefilter, embed, nearest } = spyPrefilter([]);
    const { findCandidates, get, list, ergebnis } = await lauf(prefilter);

    // Ohne diese beiden Zeilen pruefte der Fall nicht Zustand 2, sondern Zustand 1.
    expect(embed).toHaveBeenCalledTimes(1);
    expect(nearest).toHaveBeenCalledTimes(1);

    // Der Speicher gab nichts her. Statt einer falschen Leermenge greift die gedeckelte
    // lexikalische Kandidatenwahl — ein stilles `[]` waere hier das schlimmere Verhalten.
    expect(findCandidates).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    expect(ergebnis.duplicates).toHaveLength(1);
  });

  it("markiert wortgleiche Treffer weiterhin deterministic — der Judge laeuft dafuer nicht", async () => {
    // Kalibrierung gegen den Kurzschluss: ist der Bestandssatz wortgleich, entscheidet die
    // deterministische Aehnlichkeit und kein Modell. Ohne diesen Fall koennte der Fall darueber
    // gruen bleiben, obwohl der Judge auf JEDEN Treffer angesetzt wuerde.
    const seed = [{ ...mkKo("v1"), statement: EINGABE } as KnowledgeObject];
    const findCandidates = vi.fn(async () => seed);
    const judge = vi.fn(async (): Promise<OverlapVerdict | null> => treffer);
    const { prefilter } = spyPrefilter([]);

    const ergebnis = await checkText(
      { text: EINGABE, title: "Pumpe entlüften" },
      {
        ko: {
          list: vi.fn(async () => seed),
          findCandidates,
          get: vi.fn(async () => seed[0]),
        } as unknown as KoService,
        overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
        duplicateJudge: judge,
        semanticPrefilter: prefilter,
      },
    );

    expect(judge).not.toHaveBeenCalled();
    expect(ergebnis.duplicates[0]?.method).toBe("deterministic");
  });
});

describe("W6 · die Nachbarzustaende — Kalibrierung, damit Zustand 2 etwas bedeutet", () => {
  it("Zustand 1 — Prefilter DEAKTIVIERT: kein Embedder-Aufruf, rein lexikalisch", async () => {
    const { findCandidates, get, ergebnis } = await lauf(undefined);

    expect(findCandidates).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
    expect(ergebnis.duplicates).toHaveLength(1);
  });

  it("Zustand 3 — Prefilter BEFUELLT: der semantische Weg traegt, kein lexikalischer Rueckfall", async () => {
    const { prefilter, embed, nearest } = spyPrefilter([{ id: "v1" }]);
    const { findCandidates, get } = await lauf(prefilter);

    // Ohne diesen Fall waere Zustand 2 auch dann gruen, wenn der semantische Weg NIE traegt — dann
    // maesse die Datei nur, dass immer lexikalisch gearbeitet wird.
    expect(embed).toHaveBeenCalledTimes(1);
    expect(nearest).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("v1");
    expect(findCandidates).not.toHaveBeenCalled();
  });

  it("die drei ABRUFWEGE sind wirklich verschieden — sonst waere die Matrix eine Behauptung", async () => {
    const s1 = await lauf(undefined);
    const s2 = spyPrefilter([]);
    const r2 = await lauf(s2.prefilter);
    const s3 = spyPrefilter([{ id: "v1" }]);
    const r3 = await lauf(s3.prefilter);

    // Spalten: embed · findCandidates · ko.get. Drei unterscheidbare Zeilen.
    expect([
      [0, s1.findCandidates.mock.calls.length, s1.get.mock.calls.length],
      [s2.embed.mock.calls.length, r2.findCandidates.mock.calls.length, r2.get.mock.calls.length],
      [s3.embed.mock.calls.length, r3.findCandidates.mock.calls.length, r3.get.mock.calls.length],
    ]).toEqual([
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 1],
    ]);
  });
});

describe("W6 · DIE LUECKE — die Antwort traegt die Abruftiefe nicht", () => {
  it("Zustand 2 und Zustand 3 sind auf der Leitung nicht zu unterscheiden", async () => {
    const leererSpeicher = await lauf(spyPrefilter([]).prefilter);
    const befuellterSpeicher = await lauf(spyPrefilter([{ id: "v1" }]).prefilter);

    // Oben ist belegt, dass die beiden Zustaende voellig verschieden abrufen: der eine faellt auf
    // die lexikalische Suche zurueck, der andere traegt semantisch. Hier kommt trotzdem dasselbe
    // heraus. `method: "model"` heisst „ein Modell hat GEURTEILT" — nicht „semantisch GEFUNDEN".
    expect(aufDerLeitung(leererSpeicher.ergebnis)).toEqual([["v1", "model"]]);
    expect(aufDerLeitung(befuellterSpeicher.ergebnis)).toEqual(
      aufDerLeitung(leererSpeicher.ergebnis),
    );

    // SOLLBRUCHSTELLE, KEINE ZUSAGE. Diese Zeile haelt fest, dass das Ergebnis heute ausser
    // `koId` und `method` nichts trägt, woran ein Aufrufer die Reichweite ablesen koennte.
    // Wer den fehlenden Zustand nachruestet, macht diesen Fall rot; ihn dann anzupassen ist der
    // bewusste Beleg, dass Auflage 1 des Urteils erfuellt wurde. Bis dahin ist er der Nachweis,
    // dass sie es NICHT ist.
    const treffer2 = leererSpeicher.ergebnis.duplicates[0];
    expect(treffer2).toBeDefined();
    expect(
      Object.keys(treffer2 as object).some((k) => /reach|depth|limited|degraded/i.test(k)),
    ).toBe(false);
  });
});

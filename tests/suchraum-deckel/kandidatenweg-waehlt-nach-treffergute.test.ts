// ================================================================================================
// JOB 3053 — DER KANDIDATENWEG FORDERT DIE GÜTEAUSWAHL AN.
// ================================================================================================
//
// DER AUSGANGSFEHLER, den diese Datei schließt: JOB 3048 hat die Güteauswahl im Deckel gebaut und
// an beiden Adaptern geprüft (`deckel-waehlt-nach-treffergute.test.ts`, `deckel-paritaet-pg.ts`) —
// aber NIEMAND forderte sie an. `KoService.findCandidates` rief `findSearchHits` ohne
// `deckelauswahl`, also galt die Vorgabe `vertrauen`. Im gewachsenen Bestand füllte der Deckel
// seine Plätze damit nach dem VERTRAUENSWERT, und ausgerechnet das Objekt, das den Fragebegriff im
// TITEL trägt, fiel heraus, wenn genug beiläufige Körpertreffer mehr Trust hatten. Pedis Frage
// endete in „keine belastbare Grundlage", obwohl das Wissen im Haus lag.
//
// GEMESSEN WIRD AM ECHTEN PRODUKTWEG. Nicht am Adapter (das tat JOB 3048 bereits, und genau
// deshalb war die Zeile danach immer noch offen), sondern an `KoService.findCandidates` — derselben
// Dienstgrenze, die `AskService.prefilterCandidates` (`services/ask/src/service.ts:560`),
// `checkText` (`services/app/src/check-text-detection.ts:232`) und `checkKnowledge`
// (`services/app/src/knowledge-check.ts:134`) benutzen. Keine Hülle, kein Proxy, kein Doppelgänger:
// die Fälle rufen den echten Dienst.
//
// DER BESTAND (Auftrag §6): 201 validierte Objekte, alle mit dem Begriff „urlaubsregelung".
//   ·  200 tragen ihn NUR im Dokumentkörper und haben Trust 90 — die beiläufigen Funde.
//   ·    1 trägt ihn im TITEL und hat den NIEDRIGSTEN Trust (1) — das gesuchte Wissen.
// Der Deckel ist 200. Vor dieser Lieferung überlebten die 200 trustreichsten Körpertreffer und das
// Titel-Objekt fiel als 201. heraus; jetzt überlebt es, und ein Körpertreffer weicht.
//
// WAS DIESE DATEI AUSDRÜCKLICH NICHT ZUSAGT: den PostgreSQL-Adapter (eigener Nachweis in
// `deckel-paritaet-pg.test.ts`, Fake-Pool mit SQL-Pin — ein ausführender Postgres ist in der
// Sandkiste nicht messbar) und die Ausgabefläche (dieser Auftrag ändert keine Fläche).
import { beforeAll, describe, expect, it } from "vitest";
import type { KoCandidateQuery } from "../../services/knowledge-object";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";
import type { CreateKoInput } from "../../services/knowledge-object/src/service";
import { LIBRARY_SEARCH_HIT_LIMIT } from "../../services/library-analytics/src/service";

/** Der Fragebegriff. Er steht in JEDEM der 201 Objekte — nur an verschiedenen Stellen. */
const BEGRIFF = "urlaubsregelung";

/**
 * Der Deckel, an dem gemessen wird: der ECHTE Bibliotheksdeckel, aus seiner Quelle gelesen statt
 * abgeschrieben. Er ist hier zugleich der Kandidatendeckel — dieselbe Zahl auf beiden Wegen ist
 * genau die Lage, in der eine im Adapter versteckte Güte die Bibliothek still verschöbe (K-2).
 */
const DECKEL = LIBRARY_SEARCH_HIT_LIMIT; // 200 (services/library-analytics/src/service.ts:208)
const KOERPERTREFFER = DECKEL; // 200 Störer + 1 Titel-Objekt = 201 validierte Treffer

const VORLAGE: Omit<CreateKoInput, "title" | "statement"> = {
  type: "best_practice",
  category: "Handbuch",
  author: "anna",
};

interface Bestand {
  ko: KoService;
  /** Die 200 Störer mit Trust 90, die den Begriff NUR im Fließtext tragen. */
  koerper: string[];
  /** Das eine Objekt mit Trust 1, das den Begriff im TITEL trägt. */
  titeltreffer: string;
}

// Der Stapel ist der echte: `activateSearchProjectionV2()` fährt die vorgeschriebene Freigabefolge
// über den Produktpfad, alles Weitere läuft über `KoService.create`/`setValidationState`.
async function bestand(): Promise<Bestand> {
  const repo = new InMemoryKoRepo();
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: new InMemoryKoSearchProjectionRepo(repo),
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);

  const koerper: string[] = [];
  for (let i = 0; i < KOERPERTREFFER; i += 1) {
    const nr = String(i).padStart(3, "0");
    const eintrag = await ko.create({
      ...VORLAGE,
      title: `Sitzungsnotiz ${nr}`,
      statement: `Beschluss ${nr}.`,
      bodyHtml: `<p>Im Protokoll wurde die Urlaubsregelung beilaeufig erwaehnt (${nr}).</p>`,
    });
    await ko.setValidationState(eintrag.id, { trust: 90, status: "validiert" });
    koerper.push(eintrag.id);
  }

  const treffer = await ko.create({
    ...VORLAGE,
    title: "Urlaubsregelung des Hauses",
    statement: "Der Jahresurlaub betraegt 30 Tage.",
  });
  await ko.setValidationState(treffer.id, { trust: 1, status: "validiert" });

  return { ko, koerper, titeltreffer: treffer.id };
}

let b: Bestand;
/** Die Kennungen der 200 Störer in der Ordnung, die der Vertrauensweg herstellt (Trust gleich → koId). */
let koerperSortiert: string[];

beforeAll(async () => {
  b = await bestand();
  koerperSortiert = [...b.koerper].sort();
}, 180_000);

// ------------------------------------------------------------------------------------------------
// K-1 — DER ECHTE PRODUKTWEG
// ------------------------------------------------------------------------------------------------

describe("JOB 3053 · K-1 — `findCandidates` bringt den Titeltreffer herein", () => {
  it("K-1 · das Titel-Objekt liegt in der Kandidatenmenge, obwohl 200 Körpertreffer mehr Trust haben", async () => {
    const ids = (await b.ko.findCandidates({ terms: [BEGRIFF], limit: DECKEL })).map((k) => k.id);

    // Der Deckel ist wirklich überfüllt — sonst sagte der Fall nichts über die Auswahl aus.
    expect(ids).toHaveLength(DECKEL);
    // Der Ausgangsfehler in einer Zeile: am Basisstand steht das Titel-Objekt hier NICHT.
    expect(ids).toContain(b.titeltreffer);
  });

  it("K-1b · und es weicht GENAU EIN Körpertreffer — die Menge wird nicht durcheinandergewirbelt", async () => {
    // Ohne diesen Fall bliebe offen, ob die Güteauswahl einen Platz tauscht oder die Auswahl
    // insgesamt verschiebt. Sie tauscht genau einen: das Titel-Objekt kommt herein, der letzte
    // Körpertreffer der Trustordnung fällt heraus.
    const ids = (await b.ko.findCandidates({ terms: [BEGRIFF], limit: DECKEL })).map((k) => k.id);

    const koerperImDeckel = ids.filter((id) => id !== b.titeltreffer);
    expect([...koerperImDeckel].sort()).toEqual(koerperSortiert.slice(0, DECKEL - 1));
  });
});

// ------------------------------------------------------------------------------------------------
// K-2 — DIE BIBLIOTHEK VERSCHIEBT SICH NICHT
// ------------------------------------------------------------------------------------------------
//
// DER FEHLER, DEN DIESER FALL AUSSCHLIESST (die naheliegende Halbheit, Auftrag §8.4): die Güte in
// `findSearchHits` zu setzen statt in `findCandidates`. Dann bekäme JEDER gedeckelte Aufrufer sie —
// auch `LibraryService.search`, das seit JOB 2689 mit `LIBRARY_SEARCH_HIT_LIMIT = 200` fragt
// (`services/library-analytics/src/service.ts:1334`) — und die Trefferliste der Bibliothek
// verschöbe sich still. Gemessen wird deshalb am selben 201er-Bestand mit demselben Deckel und der
// Anfrageform, die die Bibliothek wirklich stellt: `terms` + `limit`, ohne `deckelauswahl`.

describe("JOB 3053 · K-2 — der Bibliotheksweg behält Zeichen für Zeichen seine Liste", () => {
  it("K-2 · `findSearchHits` ohne Anforderung liefert die 200 der alten Auswahl, in derselben Reihenfolge", async () => {
    const ids = (await b.ko.findSearchHits({ terms: [BEGRIFF], limit: DECKEL })).map((h) => h.koId);

    // Die Erwartung ist unabhängig gerechnet, nicht vom Ergebnis abgeschrieben: alle 201 sind
    // validiert, die 200 Störer tragen Trust 90 (untereinander nach Kennung), das Titel-Objekt
    // Trust 1 und fällt als 201. heraus.
    expect(ids).toEqual(koerperSortiert.slice(0, DECKEL));
    expect(ids).not.toContain(b.titeltreffer);
  });

  it("K-2b · und derselbe Bestand mit AUSDRÜCKLICHER Anforderung wählt anders — die Trennung trägt", async () => {
    // Ohne diesen Fall wäre K-2 auch bei einer Suche grün, die die Güte gar nicht mehr kann.
    const mitGuete = (
      await b.ko.findSearchHits({
        terms: [BEGRIFF],
        limit: DECKEL,
        deckelauswahl: "trefferguete",
      })
    ).map((h) => h.koId);

    expect(mitGuete).toContain(b.titeltreffer);
    expect(mitGuete).not.toEqual(koerperSortiert.slice(0, DECKEL));
  });
});

// ------------------------------------------------------------------------------------------------
// K-3 — OHNE GREIFENDEN DECKEL ÄNDERT SICH NICHTS
// ------------------------------------------------------------------------------------------------

describe("JOB 3053 · K-3 — ohne Deckel ist die Auswahl wirkungslos", () => {
  it("K-3 · ein Deckel, der nicht greift: dieselbe Menge, dieselbe Reihenfolge wie am Basisstand", async () => {
    const ids = (await b.ko.findCandidates({ terms: [BEGRIFF], limit: KOERPERTREFFER + 1 })).map(
      (k) => k.id,
    );

    expect(ids).toEqual([...koerperSortiert, b.titeltreffer]);
  });

  it("K-3b · und ganz OHNE `limit` ebenso — die Güte hängt am Deckel, nicht am Weg", async () => {
    // `KoCandidateQuery.limit` ist PFLICHT (`services/knowledge-object/src/repo.ts:76`), der Aufruf
    // „ohne Deckel" also kein gültiger Typ. Zur Laufzeit ist er möglich, und der Suchvertrag sagt
    // für ihn zu: „weggelassen heißt, der Aufrufer deckelt selbst; dann ist auch `deckelauswahl`
    // ohne jede Wirkung" (`search-projection.ts:943`). Genau diese Zusage wird hier gemessen — die
    // Typlockerung steht sichtbar an dieser einen Stelle und nirgends im Produkt.
    const ohneDeckel = { terms: [BEGRIFF] } as unknown as KoCandidateQuery;
    const ids = (await b.ko.findCandidates(ohneDeckel)).map((k) => k.id);

    expect(ids).toEqual([...koerperSortiert, b.titeltreffer]);
    expect(ids).toHaveLength(KOERPERTREFFER + 1);
  });
});

// ------------------------------------------------------------------------------------------------
// K-4 — DIE AUSGABEREIHENFOLGE BLEIBT
// ------------------------------------------------------------------------------------------------
//
// EHRLICHKEIT VOR OPTIK: die Güte entscheidet, WER im Deckel überlebt — nicht, wer vorne steht.
// Kein Objekt wird durch diese Lieferung vertrauenswürdiger dargestellt, als es ist. Die feine
// Relevanzauswahl (Top-K) macht weiterhin der Reasoner.

describe("JOB 3053 · K-4 — die Ausgabe bleibt validiert ↓, Trust ↓, koId", () => {
  it("K-4 · das Titel-Objekt steht NICHT vorne, sondern nur ÜBERHAUPT drin — es steht ganz hinten", async () => {
    const ids = (await b.ko.findCandidates({ terms: [BEGRIFF], limit: DECKEL })).map((k) => k.id);

    // Alle Störer tragen Trust 90, das Titel-Objekt Trust 1. Entschiede die Güte auch über die
    // AUSGABE, stünde es vorn.
    expect(ids.at(-1)).toBe(b.titeltreffer);
    expect(ids.slice(0, DECKEL - 1)).toEqual(koerperSortiert.slice(0, DECKEL - 1));
  });
});

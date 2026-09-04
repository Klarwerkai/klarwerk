// ================================================================================================
// JOB 3048 — DER DECKEL DER SUCHE WIRFT NICHT MEHR DEN BESTEN TREFFER WEG.
// ================================================================================================
//
// DER AUSGANGSFEHLER: die gedeckelte Kandidatenabfrage (`findActive` mit `limit`) füllt ihre Plätze
// nach `validiert ↓, trust ↓, koId` — also nach dem VERTRAUENSWERT, nicht danach, wie gut ein
// Objekt zur Frage passt. Sobald mehr als `limit` validierte Objekte einen Fragebegriff im
// Fließtext tragen, fällt ausgerechnet das Objekt heraus, das den Begriff im TITEL trägt, wenn sein
// Trust niedriger ist. Pedis Frage endet dann in „keine belastbare Grundlage", obwohl das Wissen im
// Haus liegt. VERGANGENHEIT seit JOB 3053: `KoService.findCandidates` fordert die Güteauswahl
// ausdrücklich an, und damit trägt die hier gebaute Regel bis in Klaras Antwort — s. Block V.
//
// DER BESTAND, an dem hier gemessen wird — er ist die belegte Lage aus dem Auftrag §6:
//   ·  60 validierte Objekte mit Trust 90, die „Ruettelfrequenz" NUR im Dokumentkörper tragen
//   ·  60 validierte Objekte mit Trust 90, die „Spezialpresse" NUR im Dokumentkörper tragen
//   ·   1 validiertes Objekt mit Trust 1, das BEIDE Wörter im TITEL trägt — das gesuchte Wissen
//
// WARUM ZWEI DECOY-GRUPPEN UND NICHT EINE: der Fragepfad stellt je Fragebegriff eine EIGENE
// gedeckelte Abfrage (`services/ask/src/service.ts:504`, JOB 531). Ein Begriff, der nur wenige
// Treffer hat, brächte das richtige Objekt über seine eigene Abfrage herein — der Deckelverlust
// wäre am Fragedienst gar nicht sichtbar. Erst wenn JEDER Fragebegriff für sich überfüllt ist,
// zeigt sich der Fehler dort, wo Pedi ihn erlebt. Genau das leisten die zwei Gruppen.
//
// WAS HIER NICHT GEMESSEN WIRD: der PostgreSQL-Adapter. Er hat seinen eigenen Nachweis in
// `deckel-paritaet-pg.test.ts` (Fake-Pool, SQL-Pin) — ohne Docker ist ein ausführender Postgres in
// dieser Sandkiste nicht messbar, und das steht so in der Rückgabe.
//
// ================================================================================================
// JOB 3053 — DIE FEHLENDE ANFORDERUNG IST GESETZT; ALLE BLÖCKE SIND JETZT ZUSAGEN
// ================================================================================================
//
// JOB 3048 baute die Regel und beide Adapter, konnte aber die eine Stelle nicht anfassen, die sie
// ANFORDERN muss: `KoService.findCandidates` lag nicht in seinen Zielpfaden. Diese Datei trug
// deshalb drei Blöcke, die einen MANGEL festhielten (V, Q) oder ihn nur VORFÜHRTEN (W, per Proxy).
// JOB 3053 hat die Anforderung gesetzt (`services/knowledge-object/src/service.ts`,
// `deckelauswahl: "trefferguete"`); die Blöcke sind entsprechend nachgeführt:
//   V · B · Q   sind aus der Charakterisierung in ZUSAGEN umgeschrieben — sie messen jetzt am
//               ECHTEN Dienst, was vorher nur die Proxy-Hülle aus Block W zeigen konnte.
//   W           ist ERSATZLOS ENTFALLEN. Die Hülle `mitAngeforderterGuete` bildete die fehlende
//               Zeile nach; die Zeile steht jetzt im Produkt, und eine Nachbildung daneben wäre
//               der alte Weg, der nicht neben dem neuen stehenbleiben darf.
//   K           misst weiter, aber die umgekehrte Aussage: der Adapter sieht die Absicht NUR,
//               weil der Aufrufer sie ausspricht — an den Termen und am Deckel wäre sie nicht
//               erkennbar.
//   D · F · P   unverändert: die Regel selbst und beide Adapter.
//
// DER PRODUKTWEG selbst hat seinen eigenen, unabhängigen Nachweis in
// `kandidatenweg-waehlt-nach-treffergute.test.ts` (JOB 3053, 201er-Bestand am Bibliotheksdeckel).
import { beforeAll, describe, expect, it } from "vitest";
import { checkText } from "../../services/app/src/check-text-detection";
import { DETECTION_CANDIDATE_CAP } from "../../services/app/src/detection-cap";
import { checkKnowledge } from "../../services/app/src/knowledge-check";
import { AskService, InMemoryGapRepo } from "../../services/ask";
import {
  ConflictService,
  InMemoryConflictRepo,
  InMemoryOverlapRepo,
  OverlapService,
} from "../../services/conflicts";
import type { KnowledgeObject } from "../../services/knowledge-object";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";
import {
  SUCH_TREFFERGUETE,
  suchTrefferguete,
} from "../../services/knowledge-object/src/search-projection";
import type { CreateKoInput } from "../../services/knowledge-object/src/service";
import {
  LIBRARY_SEARCH_HIT_LIMIT,
  LibraryService,
} from "../../services/library-analytics/src/service";
import { Reasoner } from "../../services/reasoner";

// Die beiden Wörter sind bewusst frei erfunden: kein Stoppwort, keine deklarierte Entsprechung
// (`SUCH_ZUORDNUNGEN`), keine zufällige Überschneidung mit einem anderen Fixture-Wort. Ihre
// Termform ist gemessen, nicht geraten — `queryTokens("Welche Ruettelfrequenz hat die
// Spezialpresse?")` ergibt `["ruettelfrequenz", "spezialpr"]`.
const FRAGE = "Welche Ruettelfrequenz hat die Spezialpresse?";
const TERM_A = "ruettelfrequenz";
const TERM_B = "spezialpr";
const DECKEL = 50; // = ASK_PREFILTER_TERM_LIMIT (services/ask/src/service.ts:70)
const DECOYS_JE_GRUPPE = 60;

// Die Güteauswahl ist eine ANGABE DES AUFRUFERS. Wer sie nicht macht, bekommt die alte Auswahl —
// deshalb steht sie hier in jedem Aufruf sichtbar und ist nirgends Vorgabe.
const GUETE = { deckelauswahl: "trefferguete" } as const;

// Die drei ECHTEN Deckel des Hauses, aus ihren Quellen gelesen statt abgeschrieben.
const BIBLIOTHEKSDECKEL = LIBRARY_SEARCH_HIT_LIMIT; // 200 (library-analytics/src/service.ts:208)
const DETECTION_DECKEL = DETECTION_CANDIDATE_CAP; // 20 (app/src/detection-cap.ts:39)
const KNOWLEDGE_CHECK_DECKEL = 40; // app/src/knowledge-check.ts:103 (dort nicht exportiert)

/** Der eine Begriff, der im großen Bestand überfüllt ist. */
const BEGRIFF = "Ruettelfrequenz";
/** Der Prüftext beider Prüfwege — wörtlich die Aussage des Titel-Objekts. */
const PRUEFTEXT = "Die Ruettelfrequenz betraegt 50 Hertz.";

const VORLAGE: Omit<CreateKoInput, "title" | "statement"> = {
  type: "best_practice",
  category: "Handbuch",
  author: "anna",
};

interface Bestand {
  ko: KoService;
  ask: AskService;
  /** Die 60 Störer, die „Ruettelfrequenz" nur im Fließtext tragen. */
  koerperA: string[];
  /** Die 60 Störer, die „Spezialpresse" nur im Fließtext tragen. */
  koerperB: string[];
  /** Das eine Objekt, das beide Wörter im Titel trägt — mit dem NIEDRIGSTEN Trust. */
  titeltreffer: string;
}

// Der Stapel ist der echte (Muster: tests/suche-zuordnung/n2-…): `activateSearchProjectionV2()`
// fährt die vorgeschriebene Folge über den Produktweg, der `KoService` ist der echte, und der
// Reasoner ist der echte deterministische (kein Modellclient, kein Netz). Kein Doppelgänger
// entscheidet hier etwas.
async function bestand(anzahlDecoys = DECOYS_JE_GRUPPE): Promise<Bestand> {
  const repo = new InMemoryKoRepo();
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: new InMemoryKoSearchProjectionRepo(repo),
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);

  const koerperA: string[] = [];
  const koerperB: string[] = [];
  for (let i = 0; i < anzahlDecoys; i += 1) {
    const nr = String(i).padStart(3, "0");
    const a = await ko.create({
      ...VORLAGE,
      title: `Sitzungsnotiz A ${nr}`,
      statement: `Beschluss A ${nr}.`,
      bodyHtml: `<p>Im Protokoll wurde die Ruettelfrequenz beilaeufig erwaehnt (${nr}).</p>`,
    });
    await ko.setValidationState(a.id, { trust: 90, status: "validiert" });
    koerperA.push(a.id);

    const b = await ko.create({
      ...VORLAGE,
      title: `Sitzungsnotiz B ${nr}`,
      statement: `Beschluss B ${nr}.`,
      bodyHtml: `<p>Im Protokoll wurde die Spezialpresse beilaeufig erwaehnt (${nr}).</p>`,
    });
    await ko.setValidationState(b.id, { trust: 90, status: "validiert" });
    koerperB.push(b.id);
  }

  const treffer = await ko.create({
    ...VORLAGE,
    title: "Ruettelfrequenz der Spezialpresse",
    statement: "Der Sollwert liegt bei 50 Hertz.",
  });
  await ko.setValidationState(treffer.id, { trust: 1, status: "validiert" });

  const ask = new AskService({
    reasoner: new Reasoner(),
    koService: ko,
    gaps: new InMemoryGapRepo(),
  });
  return { ko, ask, koerperA, koerperB, titeltreffer: treffer.id };
}

// ------------------------------------------------------------------------------------------------
// DER GROSSE BESTAND — einer mehr als der Bibliotheksdeckel (Blöcke B und Q)
// ------------------------------------------------------------------------------------------------

interface Grossbestand {
  ko: KoService;
  bibliothek: LibraryService;
  /** 201 validierte Störer mit Trust 90, die den Begriff NUR im Fließtext tragen. */
  koerper: string[];
  /** Das eine validierte Objekt mit Trust 1, das den Begriff im TITEL trägt. */
  titeltreffer: string;
}

async function grossbestand(): Promise<Grossbestand> {
  const repo = new InMemoryKoRepo();
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: new InMemoryKoSearchProjectionRepo(repo),
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);

  const koerper: string[] = [];
  for (let i = 0; i < BIBLIOTHEKSDECKEL + 1; i += 1) {
    const nr = String(i).padStart(3, "0");
    const eintrag = await ko.create({
      ...VORLAGE,
      title: `Sitzungsnotiz ${nr}`,
      statement: `Beschluss ${nr}.`,
      bodyHtml: `<p>Im Protokoll wurde die Ruettelfrequenz beilaeufig erwaehnt (${nr}).</p>`,
    });
    await ko.setValidationState(eintrag.id, { trust: 90, status: "validiert" });
    koerper.push(eintrag.id);
  }
  const treffer = await ko.create({
    ...VORLAGE,
    title: "Ruettelfrequenz der Spezialpresse",
    statement: PRUEFTEXT,
  });
  await ko.setValidationState(treffer.id, { trust: 1, status: "validiert" });

  return {
    ko,
    bibliothek: new LibraryService({ koService: ko }),
    koerper,
    titeltreffer: treffer.id,
  };
}

/**
 * Die Beobachtungshülle um den ECHTEN `KoService`: sie schreibt jede Kandidatenantwort mit und
 * reicht sie unverändert durch. Ein nachgebautes `findCandidates` prüfte die Attrappe statt den
 * Suchweg — deshalb ein Proxy und kein Doppelgänger.
 */
function mitPoolprotokoll(dienst: KoService) {
  const pool: string[] = [];
  const huelle = new Proxy(dienst, {
    get(ziel, name) {
      const wert = Reflect.get(ziel, name, ziel);
      if (name !== "findCandidates" || typeof wert !== "function") {
        return typeof wert === "function" ? wert.bind(ziel) : wert;
      }
      return async (...args: unknown[]) => {
        const treffer = (await (wert as (...a: unknown[]) => Promise<KnowledgeObject[]>).apply(
          ziel,
          args,
        )) as KnowledgeObject[];
        pool.push(...treffer.map((k) => k.id));
        return treffer;
      };
    },
  });
  return { huelle, pool };
}

async function wissenspruefung(dienst: KoService) {
  const { huelle, pool } = mitPoolprotokoll(dienst);
  const ergebnis = await checkKnowledge(PRUEFTEXT, {
    ko: huelle,
    conflicts: new ConflictService({ repo: new InMemoryConflictRepo() }),
  });
  return { pool, ergebnis };
}

async function textpruefung(dienst: KoService) {
  const { huelle, pool } = mitPoolprotokoll(dienst);
  const ergebnis = await checkText(
    { text: PRUEFTEXT, title: "Entwurf" },
    { ko: huelle, overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }) },
  );
  return { pool, ergebnis };
}

let b: Bestand;
let klein: Bestand;
let gross: Grossbestand;

beforeAll(async () => {
  b = await bestand();
  klein = await bestand(5);
  gross = await grossbestand();
}, 120_000);

// ------------------------------------------------------------------------------------------------
// D — DIE REGEL SELBST: aus `matched` wird ein Rang, und der Rang ist eine Leiter
// ------------------------------------------------------------------------------------------------

describe("JOB 3048 · D — die eine Güteregel", () => {
  it("D1 · die Leiter: Titel > Aussage > Einordnung > Fußnote > Körper", () => {
    const rang = (m: Partial<Record<string, boolean>>) =>
      suchTrefferguete({
        title: false,
        statement: false,
        category: false,
        tag: false,
        caption: false,
        body: false,
        ...m,
      } as Parameters<typeof suchTrefferguete>[0]);

    expect(rang({ title: true })).toBe(SUCH_TREFFERGUETE.titel);
    expect(rang({ statement: true })).toBe(SUCH_TREFFERGUETE.aussage);
    expect(rang({ category: true })).toBe(SUCH_TREFFERGUETE.einordnung);
    expect(rang({ tag: true })).toBe(SUCH_TREFFERGUETE.einordnung);
    expect(rang({ caption: true })).toBe(SUCH_TREFFERGUETE.fussnote);
    expect(rang({ body: true })).toBe(SUCH_TREFFERGUETE.koerper);

    // Die Leiter ist streng geordnet — sonst wäre „besser" keine Aussage.
    expect(SUCH_TREFFERGUETE.titel).toBeGreaterThan(SUCH_TREFFERGUETE.aussage);
    expect(SUCH_TREFFERGUETE.aussage).toBeGreaterThan(SUCH_TREFFERGUETE.einordnung);
    expect(SUCH_TREFFERGUETE.einordnung).toBeGreaterThan(SUCH_TREFFERGUETE.fussnote);
    expect(SUCH_TREFFERGUETE.fussnote).toBeGreaterThan(SUCH_TREFFERGUETE.koerper);
  });

  it("D2 · die STÄRKSTE Fundstelle entscheidet — kein Punktekonto, keine erfundene Gewichtung", () => {
    // Ein Objekt, das den Begriff in Titel UND Körper trägt, steht genauso hoch wie eines, das ihn
    // nur im Titel trägt: der Rang ist ein Ordinal über den Fundstellen. Damit muss zwischen den
    // Feldern nichts verrechnet werden — es gibt keine Zahl, die etwas behauptet, was niemand
    // gemessen hat.
    const nurTitel = suchTrefferguete({
      title: true,
      statement: false,
      category: false,
      tag: false,
      caption: false,
      body: false,
    });
    const titelUndMehr = suchTrefferguete({
      title: true,
      statement: true,
      category: true,
      tag: true,
      caption: true,
      body: false,
    });
    expect(titelUndMehr).toBe(nurTitel);
  });
});

// ------------------------------------------------------------------------------------------------
// F — DER DECKEL IM SPEICHER-ADAPTER
// ------------------------------------------------------------------------------------------------

describe("JOB 3048 · F — im Deckel entscheidet die Treffergüte", () => {
  it("F1 · das Titel-Objekt überlebt den Deckel, obwohl 60 Körpertreffer mehr Trust haben", async () => {
    const hits = await b.ko.findSearchHits({ terms: [TERM_A], limit: DECKEL, ...GUETE });

    expect(hits).toHaveLength(DECKEL);
    // Der Ausgangsfehler in einer Zeile: vor dem Bau steht der Titeltreffer hier NICHT.
    expect(hits.map((h) => h.koId)).toContain(b.titeltreffer);
    // Und er ist wirklich der Titeltreffer, nicht irgendein Überlebender.
    expect(hits.find((h) => h.koId === b.titeltreffer)?.matched.title).toBe(true);
  });

  it("F2 · die AUSGABEREIHENFOLGE bleibt validiert ↓, Trust ↓, koId — der Titeltreffer steht HINTEN", async () => {
    const hits = await b.ko.findSearchHits({ terms: [TERM_A], limit: DECKEL, ...GUETE });

    // Alle Störer tragen Trust 90, der Titeltreffer Trust 1. Entschiede die Güte auch über die
    // AUSGABE, stünde er vorn — er steht aber ganz hinten, weil die Güte nur über das Überleben
    // entscheidet. Genau das ist die Zusage „die Reihenfolge der Ausgabe bleibt unverändert".
    expect(hits.at(-1)?.koId).toBe(b.titeltreffer);
    expect(hits.slice(0, DECKEL - 1).map((h) => h.koId)).toEqual(
      [...b.koerperA].sort().slice(0, DECKEL - 1),
    );
  });

  it("F1b · dasselbe gilt für den ZWEITEN Fragebegriff — sonst käme das Objekt über ihn herein", async () => {
    // Ohne diesen Fall wäre N2 nicht schlüssig: brächte eine der beiden Abfragen den Titeltreffer
    // ohnehin herein, sagte der Ask-Fall nichts über den Deckel aus.
    const hits = await b.ko.findSearchHits({ terms: [TERM_B], limit: DECKEL, ...GUETE });
    expect(hits).toHaveLength(DECKEL);
    expect(hits.map((h) => h.koId)).toContain(b.titeltreffer);
  });

  it("F3 · OHNE `limit` ändert sich nichts — dieselbe Menge, dieselbe Reihenfolge", async () => {
    const hits = await b.ko.findSearchHits({ terms: [TERM_A] });

    // Die Erwartung ist unabhängig gerechnet, nicht vom Ergebnis abgeschrieben: alle 61 sind
    // validiert, die 60 Störer haben Trust 90 (untereinander nach koId), der Titeltreffer Trust 1.
    expect(hits.map((h) => h.koId)).toEqual([...[...b.koerperA].sort(), b.titeltreffer]);
    expect(hits).toHaveLength(DECOYS_JE_GRUPPE + 1);
  });

  it("F3b · MIT `limit`, aber OHNE Anforderung: die Güte wirkt NICHT — die Vorgabe ist die alte Auswahl", async () => {
    // Der Kern der Korrektur aus Runde 1. Derselbe Bestand, derselbe Deckel, nur ohne
    // `deckelauswahl` — und das Ergebnis ist Zeichen für Zeichen die alte Auswahl: die 50
    // trustreichsten Körpertreffer, das Titel-Objekt fällt heraus. Wer nichts sagt, bekommt
    // nichts Neues.
    const hits = await b.ko.findSearchHits({ terms: [TERM_A], limit: DECKEL });

    expect(hits.map((h) => h.koId)).not.toContain(b.titeltreffer);
    expect(hits.map((h) => h.koId)).toEqual([...b.koerperA].sort().slice(0, DECKEL));
  });

  it("F4 · das Freigabetor steht weiterhin VOR jeder fachlichen Auswahl", async () => {
    // Eine frische, nicht in Betrieb genommene Instanz wirft — auch mit der neuen Auswahl. Sie
    // liefert keine reihenfolgeabhängige Teilmenge und meldet kein unehrliches „nichts gefunden".
    const repo = new InMemoryKoRepo();
    const roh = new KoService({
      repo,
      versions: new InMemoryKoVersionRepo(),
      searchProjections: new InMemoryKoSearchProjectionRepo(repo),
    });
    // Geprüft wird der GRUND, nicht nur „irgendein Fehler": sonst bliebe der Fall auch bei einem
    // kaputten Aufbau grün.
    await expect(roh.findSearchHits({ terms: [TERM_A], limit: DECKEL, ...GUETE })).rejects.toThrow(
      /SEARCH_PROJECTION_NOT_READY|nicht freigegeben/,
    );
    // Und ohne Deckel genauso — das Tor hängt nicht am `limit`.
    await expect(roh.findSearchHits({ terms: [TERM_A] })).rejects.toThrow(
      /SEARCH_PROJECTION_NOT_READY|nicht freigegeben/,
    );
  });
});

// ------------------------------------------------------------------------------------------------
// K — DIE ABSICHT STEHT IM AUFRUF, NICHT IN DEN DATEN
// ------------------------------------------------------------------------------------------------
//
// Der Grund, warum die Anforderung beim AUFRUFER liegen muss und nicht im Adapter erfunden werden
// darf — dieser Block MISST ihn, statt ihn zu behaupten:
//
//   Bibliothek und Kandidatenweg erreichen `findActive` mit derselben Anfrageform: EIN Begriff,
//   EINE Zahl. An den Daten allein hätte der Adapter kein Merkmal, an dem er „Listenanzeige" von
//   „Kandidatenmenge" unterscheiden könnte. Was sie unterscheidet, ist AUSSCHLIESSLICH das eine
//   Feld, das der Aufrufer ausspricht: `KoService.findCandidates` setzt seit JOB 3053
//   `deckelauswahl: "trefferguete"` (`services/knowledge-object/src/service.ts`),
//   `LibraryService.search` sagt nichts und behält damit die alte Auswahl.
//
// Wer die Unterscheidung stattdessen im Adapter erfände — an der Termzahl, an der Deckelhöhe, an
// der Gestalt des Begriffs —, baute genau die stille Reichweite, die JOB 3048 Runde 1 rot gemacht
// hat: die Trefferliste der Bibliothek verschöbe sich, ohne dass jemand darum gebeten hätte.

describe("JOB 3048/3053 · K — nur das ausgesprochene Feld trennt die beiden Wege", () => {
  it("K1 · dieselbe Anfrageform, EIN Unterschied: der Kandidatenweg nennt seine Auswahl, die Bibliothek nicht", async () => {
    const gesehen: Record<string, unknown>[] = [];
    const beobachtet = new Proxy(gross.ko, {
      get(ziel, name, empfaenger) {
        const wert = Reflect.get(ziel, name, ziel);
        if (typeof wert !== "function") {
          return wert;
        }
        if (name === "findSearchHits") {
          return (frage: Record<string, unknown>) => {
            gesehen.push(frage);
            return (wert as (f: unknown) => unknown).call(ziel, frage);
          };
        }
        // An den EMPFÄNGER gebunden — sonst liefe der interne Aufruf `this.findSearchHits` in
        // `findCandidates` am Mitschreiben vorbei, und der Fall zählte nur die Bibliothek.
        return (...args: unknown[]) =>
          (wert as (...a: unknown[]) => unknown).apply(empfaenger, args);
      },
    });

    await new LibraryService({ koService: beobachtet }).search(BEGRIFF);
    await beobachtet.findCandidates({ terms: [BEGRIFF.toLowerCase()], limit: DECKEL });

    expect(gesehen).toHaveLength(2);
    const [bibliothek, kandidaten] = gesehen as [Record<string, unknown>, Record<string, unknown>];
    // AN DEN DATEN sind beide ununterscheidbar: je ein Begriff, je eine Zahl.
    expect(Object.keys(bibliothek).sort()).toEqual(["limit", "terms"]);
    expect((bibliothek.terms as string[]).length).toBe(1);
    expect((kandidaten.terms as string[]).length).toBe(1);
    expect(kandidaten.limit).toBe(DECKEL);
    // DER EINZIGE UNTERSCHIED ist das ausgesprochene Feld — genau ein Feld mehr, kein weiteres.
    expect(Object.keys(kandidaten).sort()).toEqual(["deckelauswahl", "limit", "terms"]);
    expect(kandidaten.deckelauswahl).toBe("trefferguete");
    // Und die Bibliothek sagt weiterhin nichts: sie behält die Vorgabe `vertrauen`.
    expect(bibliothek.deckelauswahl).toBeUndefined();
  });
});

// ------------------------------------------------------------------------------------------------
// V — DIE NUTZENKETTE, AM ECHTEN PRODUKTWEG (JOB 3053: aus Charakterisierung wurde Zusage)
// ------------------------------------------------------------------------------------------------
//
// Bis JOB 3053 hielten diese beiden Fälle einen MANGEL fest: `KoService.findCandidates` forderte
// die Güteauswahl nicht an, und Klara meldete im gewachsenen Bestand keine belastbare Grundlage.
// Die Anforderung steht jetzt im Produkt, und dieselben zwei Messungen sagen deshalb das Gegenteil
// — ohne Hülle, ohne Proxy: der ECHTE `KoService`, der ECHTE `AskService.ask`, der ECHTE
// deterministische Reasoner.

describe("JOB 3053 · V — der Kandidatenweg fordert die Güte an, und es trägt bis in die Antwort", () => {
  it("V1 · `findCandidates` bringt das Titel-Objekt herein — der Deckel wirft es nicht mehr weg", async () => {
    const ids = (await b.ko.findCandidates({ terms: [TERM_A], limit: DECKEL })).map((k) => k.id);
    expect(ids).toHaveLength(DECKEL);
    expect(ids).toContain(b.titeltreffer);
  });

  it("V2 · und Klara nennt es im gewachsenen Bestand als Quelle statt eine Wissenslücke zu melden", async () => {
    const out = await b.ask.ask(FRAGE, "nutzer-1", "de", {
      validatedOnly: true,
      retrievalOnly: true,
    });

    // Die 120 Störer teilen mit der Frage je genau EIN Inhaltstoken und fallen an
    // `MIN_ANSWER_SUBSTANCE`; das eine Objekt, das zwei teilt, überlebt jetzt den Deckel.
    expect(out.result.answered).toBe(true);
    expect(out.result.sources).toEqual([b.titeltreffer]);
  });

  it("V3 · KALIBRIERUNG: die Güte hängt am DECKEL — greift er nicht, ändert sie nichts", async () => {
    // Ohne diesen Fall wäre V1 auch von einer Auswahl nicht zu unterscheiden, die den Titeltreffer
    // immer nach vorn zöge. Ohne greifenden Deckel steht die Menge unverändert in `validiert ↓,
    // Trust ↓, koId` — das Titel-Objekt (Trust 1) also ganz hinten.
    const ids = (await b.ko.findCandidates({ terms: [TERM_A], limit: DECOYS_JE_GRUPPE + 1 })).map(
      (k) => k.id,
    );
    expect(ids).toEqual([...[...b.koerperA].sort(), b.titeltreffer]);
  });
});

// ------------------------------------------------------------------------------------------------
// N — DIE KALIBRIERUNG DES KLEINEN BESTANDS
// ------------------------------------------------------------------------------------------------

describe("JOB 3048 · N — der kleine Bestand war nie betroffen", () => {
  it("N3 · KALIBRIERUNG: im KLEINEN Bestand war die Antwort schon vorher richtig — und bleibt es", async () => {
    // Ohne diesen Fall wäre N2 von einem kaputten Aufbau nicht zu unterscheiden. Fünf Störer je
    // Gruppe füllen den Deckel nicht; die Frage bekommt hier heute wie morgen dieselbe Quelle.
    const out = await klein.ask.ask(FRAGE, "nutzer-1", "de", {
      validatedOnly: true,
      retrievalOnly: true,
    });
    expect(out.result.answered).toBe(true);
    expect(out.result.sources).toEqual([klein.titeltreffer]);
  });
});

// ------------------------------------------------------------------------------------------------
// B — DIE BIBLIOTHEK BLEIBT UNBERÜHRT, UND ZWAR AN IHREM ECHTEN DECKEL
// ------------------------------------------------------------------------------------------------
//
// DER FEHLER AUS RUNDE 1, den dieser Block schließt (BEN, Korrekturpflicht 1): der Auftrag behauptet
// in §2.4, die Bibliothek setze KEIN `limit`. Sie tut es. Seit JOB 2689 fragt
// `LibraryService.search` mit `LIBRARY_SEARCH_HIT_LIMIT = 200`
// (services/library-analytics/src/service.ts:208 und :1334). Eine Güteauswahl, die an JEDEM Deckel
// wirkt, hätte damit die Trefferliste der Bibliothek still verschoben — genau die Halbheit, die
// §8.4 des Auftrags ausschließen wollte.
//
// DER BESTAND HIER IST DESHALB EINER MEHR ALS DER DECKEL: 201 validierte Körpertreffer mit Trust 90
// plus EIN validiertes Titel-Objekt mit Trust 1. Vor der Güte gibt es genau eine richtige Antwort
// für die Bibliothek — die 200 trustreichsten, nach Kennung geschnitten — und genau eine für den
// Kandidatenweg: das Titel-Objekt muss dabei sein.

describe("JOB 3048 · B — 202 Treffer, Deckel 200: die Bibliothek zählt anders als der Kandidatenweg", () => {
  it("B1 · `LibraryService.search` liefert EXAKT die 200 Kennungen der alten Auswahl — ohne das Titel-Objekt", async () => {
    const ids = (await gross.bibliothek.search(BEGRIFF)).map((k) => k.id);

    expect(ids).toHaveLength(BIBLIOTHEKSDECKEL);
    // Die Erwartung ist unabhängig gerechnet: alle sind validiert, die 201 Störer tragen Trust 90
    // (untereinander nach Kennung), das Titel-Objekt Trust 1 und fällt als 202. heraus.
    expect([...ids].sort()).toEqual([...gross.koerper].sort().slice(0, BIBLIOTHEKSDECKEL));
    expect(ids).not.toContain(gross.titeltreffer);
  });

  it("B2 · derselbe Bestand, derselbe Deckel, über `findCandidates`: dort IST das Titel-Objekt dabei", async () => {
    // DER KERN DER TRENNUNG, in einem Fall: gleiche Daten, gleiche Zahl, zwei Aufrufer — und zwei
    // verschiedene Überlebendenmengen, weil der eine seine Auswahl ausspricht und der andere nicht.
    const kandidaten = (
      await gross.ko.findCandidates({ terms: [BEGRIFF], limit: BIBLIOTHEKSDECKEL })
    ).map((k) => k.id);
    expect(kandidaten).toHaveLength(BIBLIOTHEKSDECKEL);
    expect(kandidaten).toContain(gross.titeltreffer);

    // UND DIE BIBLIOTHEK BLEIBT DABEI, WO SIE IST — im selben Bestand, im selben Lauf.
    expect((await gross.bibliothek.search(BEGRIFF)).map((k) => k.id)).not.toContain(
      gross.titeltreffer,
    );
  });

  it("B3 · der Unterschied ist GENAU das Titel-Objekt und sonst nichts", async () => {
    // Ohne diesen Fall bliebe offen, ob die Güteauswahl die Menge nur an einer Stelle verschiebt
    // oder sie durcheinanderwirft. Sie tauscht genau einen Platz: das Titel-Objekt kommt herein,
    // der letzte Körpertreffer der Trustordnung fällt heraus.
    const vorgabe = (
      await gross.ko.findSearchHits({ terms: [BEGRIFF], limit: BIBLIOTHEKSDECKEL })
    ).map((h) => h.koId);
    const mitGuete = (
      await gross.ko.findSearchHits({ terms: [BEGRIFF], limit: BIBLIOTHEKSDECKEL, ...GUETE })
    ).map((h) => h.koId);

    const dazu = mitGuete.filter((id) => !vorgabe.includes(id));
    const weg = vorgabe.filter((id) => !mitGuete.includes(id));
    expect(dazu).toEqual([gross.titeltreffer]);
    expect(weg).toEqual([[...gross.koerper].sort()[BIBLIOTHEKSDECKEL - 1]]);
  });
});

// ------------------------------------------------------------------------------------------------
// Q — DIE BEIDEN ANDEREN VERBRAUCHER DES KANDIDATENWEGES (BEN, Korrekturpflicht 3)
// ------------------------------------------------------------------------------------------------
//
// `KoService.findCandidates` hat DREI produktive Aufrufer, nicht einen — vollständig erhoben mit
// `grep -rn "findCandidates" --include='*.ts' services apps/web/src tools scripts | grep -v test`:
// Klara (`services/ask/src/service.ts:548`, Deckel 50), die TEXTPRÜFUNG
// (`services/app/src/check-text-detection.ts:232`, Deckel `DETECTION_CANDIDATE_CAP` = 20) und die
// WISSENSPRÜFUNG (`services/app/src/knowledge-check.ts:134`, Deckel 40).
//
// DIE FESTLEGUNG (BEN, Korrekturpflicht 3; ausgeschrieben im Kommentar über `findCandidates`):
// beide Prüfwege suchen das Objekt, das DASSELBE THEMA behandelt. Für sie ist ein Titeltreffer das
// stärkere Signal als ein hoher Vertrauenswert, und was im Deckel verlorengeht, kann weder Dublette
// noch Widerspruch werden — die Güteauswahl gilt deshalb ausdrücklich auch für sie. Sie erben sie,
// weil sie durch DENSELBEN `findCandidates` gehen; keiner der drei braucht eine andere Auswahlart.
//
// Gemessen wird am POOL, den der jeweilige Prüfweg wirklich bekommt: eine Beobachtungshülle um den
// ECHTEN `KoService` schreibt jede Kandidatenantwort mit und reicht sie unverändert durch. Sie
// entscheidet nichts.

describe("JOB 3053 · Q — Textprüfung und Wissensprüfung erben die Auswahl mit", () => {
  it("Q1 · `checkKnowledge` (Deckel 40): das Titel-Objekt ist im Pool UND im Befund", async () => {
    const lauf = await wissenspruefung(gross.ko);
    expect(lauf.pool.length).toBe(KNOWLEDGE_CHECK_DECKEL);
    expect(lauf.pool).toContain(gross.titeltreffer);
    // Und es bleibt nicht im Pool stecken: der lexikalische Ähnlichkeitsbefund nennt es.
    expect(lauf.ergebnis.similar.map((s) => s.id)).toContain(gross.titeltreffer);
  });

  it("Q2 · `checkText` (Deckel 20): das Titel-Objekt ist im Pool", async () => {
    const lauf = await textpruefung(gross.ko);
    expect(lauf.pool.length).toBe(DETECTION_DECKEL);
    expect(lauf.pool).toContain(gross.titeltreffer);
  });

  it("Q3 · GEGENPROBE: ohne die Güteauswahl fehlt es beiden — der Deckel ist wirklich überfüllt", async () => {
    // Ohne diesen Fall wären Q1/Q2 von einem zu kleinen Bestand nicht zu unterscheiden. Derselbe
    // Bestand, dieselben Deckel, aber die Vorgabe-Auswahl: das Titel-Objekt (Trust 1) fällt hinter
    // die 201 Störer (Trust 90) und erreicht keinen der beiden Prüfwege.
    const nachVertrauen = (
      await gross.ko.findSearchHits({ terms: [BEGRIFF], limit: KNOWLEDGE_CHECK_DECKEL })
    ).map((h) => h.koId);
    expect(nachVertrauen).not.toContain(gross.titeltreffer);

    const engerNachVertrauen = (
      await gross.ko.findSearchHits({ terms: [BEGRIFF], limit: DETECTION_DECKEL })
    ).map((h) => h.koId);
    expect(engerNachVertrauen).not.toContain(gross.titeltreffer);
  });
});

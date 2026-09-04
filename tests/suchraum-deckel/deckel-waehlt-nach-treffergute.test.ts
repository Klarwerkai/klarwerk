// ================================================================================================
// JOB 3048 — DER DECKEL DER SUCHE WIRFT NICHT MEHR DEN BESTEN TREFFER WEG.
// ================================================================================================
//
// DER AUSGANGSFEHLER: die gedeckelte Kandidatenabfrage (`findActive` mit `limit`) füllt ihre Plätze
// nach `validiert ↓, trust ↓, koId` — also nach dem VERTRAUENSWERT, nicht danach, wie gut ein
// Objekt zur Frage passt. Sobald mehr als `limit` validierte Objekte einen Fragebegriff im
// Fließtext tragen, fällt ausgerechnet das Objekt heraus, das den Begriff im TITEL trägt, wenn sein
// Trust niedriger ist. Pedis Frage endet dann in „keine belastbare Grundlage", obwohl das Wissen im
// Haus liegt. PRÄSENS, denn am Produktweg ist dieser Fehler NICHT geschlossen — s. Blöcke V und K.
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
// RUNDE 3 — WAS DIESE DATEI ZUSAGT UND WAS SIE AUSDRÜCKLICH NICHT ZUSAGT
// ================================================================================================
//
// Die Regel und beide Adapter sind gebaut und liegen in den Zielpfaden dieses Auftrags. Die eine
// Stelle, die sie ANFORDERN müsste — `KoService.findCandidates` in
// `services/knowledge-object/src/service.ts` — liegt NICHT darin. Runde 1 hatte die Auswahl
// stattdessen auf JEDEN Deckel gelegt und damit die Bibliothek verschoben (deren 200er-Deckel der
// Auftrag in §2.4 übersieht); Runde 2 hatte die Zeile in `service.ts` gesetzt und wurde von der
// Vorprüfung als Zielpfad-Verstoß abgewiesen. Beides ist zurückgenommen.
//
// DIE BLÖCKE SAGEN DESHALB VERSCHIEDENE DINGE, und das steht an jedem einzelnen dran:
//   D · F · P   ZUSAGE — die gebaute Regel und beide Adapter, an der erreichbaren Stelle gemessen.
//   B · K       ZUSAGE — die Bibliothek ist unberührt, und der Adapter KANN die beiden Wege nicht
//               auseinanderhalten (der Konflikt, mechanisch nachgewiesen statt behauptet).
//   V · Q       CHARAKTERISIERUNG — was das Produkt HEUTE tut. V2 hält fest, dass Klaras Antwort
//               im gewachsenen Bestand weiterhin die Wissenslücke ist: das Nutzenversprechen des
//               Auftrags ist NICHT eingelöst.
//   W           VORFÜHRUNG der einen fehlenden Zeile — kein Beleg für das Produkt.
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
// K — DER KONFLIKTNACHWEIS: warum die Verdrahtung NICHT in den Zielpfaden liegen kann
// ------------------------------------------------------------------------------------------------
//
// Der Auftrag hält in §2.4 fest, die Bibliothek setze KEIN `limit`, und leitet daraus seine
// ZIELPFADE ab. Die Annahme ist falsch (s. Block B), und daran hängt ein Zielpfadkonflikt, der sich
// nicht wegargumentieren lässt — dieser Block MISST ihn, statt ihn zu behaupten:
//
//   Beide Wege erreichen `findActive` mit einem strukturell IDENTISCHEN Anfrageobjekt. Der Adapter
//   hat also kein Merkmal, an dem er „Listenanzeige" von „Kandidatenmenge" unterscheiden könnte —
//   die Unterscheidung MUSS der Aufrufer treffen, und der einzige Ort dafür ist
//   `KoService.findCandidates` (`services/knowledge-object/src/service.ts:3028`). Diese Datei steht
//   NICHT in den Zielpfaden dieses Auftrags.
//
// Wer eine Unterscheidung im Adapter erfände — an der Termzahl, an der Deckelhöhe, an der Gestalt
// des Begriffs —, baute genau die stille Reichweite, die Runde 1 rot gemacht hat.

describe("JOB 3048 · K — der Adapter kann die beiden Wege nicht unterscheiden", () => {
  it("K1 · Bibliothek und Kandidatenweg erreichen `findActive` mit derselben Anfrageform", async () => {
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
    // DASSELBE FELDBILD, und keines der Felder trägt die Absicht: zwei Begriffe und zwei Zahlen.
    expect(Object.keys(bibliothek).sort()).toEqual(["limit", "terms"]);
    expect(Object.keys(kandidaten).sort()).toEqual(["limit", "terms"]);
    // Auch die Werte geben nichts her: beide fragen mit GENAU EINEM Begriff.
    expect((bibliothek.terms as string[]).length).toBe(1);
    expect((kandidaten.terms as string[]).length).toBe(1);
    // Und keiner von beiden sagt, wer im Deckel überleben soll.
    expect(bibliothek.deckelauswahl).toBeUndefined();
    expect(kandidaten.deckelauswahl).toBeUndefined();
  });
});

// ------------------------------------------------------------------------------------------------
// V — WAS DAS PRODUKT HEUTE TUT (Charakterisierung, nicht Zusage)
// ------------------------------------------------------------------------------------------------
//
// DIESE FÄLLE HALTEN EINEN MANGEL FEST, KEINE LEISTUNG. Solange `KoService.findCandidates` die
// Güteauswahl nicht anfordert — und das kann dieser Auftrag nicht ändern, s. Block K —, bleibt das
// NUTZENVERSPRECHEN DES AUFTRAGS UNERFÜLLT: Klara meldet im gewachsenen Bestand weiterhin keine
// belastbare Grundlage. Das steht so in der Rückgabe unter REST.
//
// Sie sind zugleich der ROT-ZUERST-VERTRAG für die nächste Scheibe (Muster: der Z/W-Block in
// `tests/suche-zuordnung/n2-klara-versteht-zusammensetzungen.test.ts`): wird die eine Zeile gesetzt,
// werden V1 und V2 rot und müssen in ihre Zusagen umgeschrieben werden.

describe("JOB 3048 · V — der Kandidatenweg fordert die Güte HEUTE NICHT an", () => {
  it("V1 · `findCandidates` bringt das Titel-Objekt NICHT herein — der Deckel wirft es weiter weg", async () => {
    const ids = (await b.ko.findCandidates({ terms: [TERM_A], limit: DECKEL })).map((k) => k.id);
    expect(ids).toHaveLength(DECKEL);
    expect(ids).not.toContain(b.titeltreffer);
  });

  it("V2 · und deshalb bleibt Klaras Antwort im gewachsenen Bestand die Wissenslücke", async () => {
    const out = await b.ask.ask(FRAGE, "nutzer-1", "de", {
      validatedOnly: true,
      retrievalOnly: true,
    });

    // Die 120 Störer teilen mit der Frage je genau EIN Inhaltstoken und fallen an
    // `MIN_ANSWER_SUBSTANCE`; das eine Objekt, das zwei teilt, hat der Deckel entfernt.
    expect(out.result.answered).toBe(false);
    expect(out.result.sources).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
// W — DIE EINE FEHLENDE ZEILE, vorgeführt
// ------------------------------------------------------------------------------------------------
//
// EHRLICHKEIT VOR OPTIK: dieser Block ist KEIN Beleg dafür, dass das Produkt den Nutzen liefert. Er
// ist der Beleg dafür, dass GENAU EINE ZEILE dazwischensteht — und dass sie an der gebauten Regel
// nichts mehr zu ändern hätte. Die Hülle unten ändert am Produkt NICHTS: sie fängt `findSearchHits`
// am echten `KoService` ab und ergänzt dieselbe Angabe, die `findCandidates` künftig selbst setzen
// muss. Dahinter läuft der ECHTE `findCandidates`, der ECHTE `AskService.ask` und der ECHTE
// Reasoner — kein Doppelgänger entscheidet etwas.
//
// DIE ZEILE, wörtlich (services/knowledge-object/src/service.ts:3028):
//   const hits = await this.findSearchHits({ terms: query.terms, limit: query.limit });
// wird zu
//   const hits = await this.findSearchHits({ terms: query.terms, limit: query.limit,
//                                            deckelauswahl: "trefferguete" });

/** Der `KoService`, wie er nach dem Setzen der einen Zeile fragte — sonst unverändert. */
function mitAngeforderterGuete(dienst: KoService): KoService {
  return new Proxy(dienst, {
    get(ziel, name, empfaenger) {
      const wert = Reflect.get(ziel, name, ziel);
      if (typeof wert !== "function") {
        return wert;
      }
      if (name === "findSearchHits") {
        return (frage: Record<string, unknown>) =>
          (wert as (f: unknown) => unknown).call(ziel, { ...frage, ...GUETE });
      }
      // WICHTIG: an den EMPFÄNGER gebunden, nicht an das Ziel — sonst liefe der interne Aufruf
      // `this.findSearchHits` in `findCandidates` am Abfangen vorbei und der Fall wäre wirkungslos.
      return (...args: unknown[]) => (wert as (...a: unknown[]) => unknown).apply(empfaenger, args);
    },
  });
}

describe("JOB 3048 · W — mit der einen Zeile trägt die gebaute Regel bis in die Antwort", () => {
  it("W1 · `findCandidates` bringt das Titel-Objekt herein", async () => {
    const ids = (
      await mitAngeforderterGuete(b.ko).findCandidates({
        terms: [TERM_A],
        limit: DECKEL,
      })
    ).map((k) => k.id);

    expect(ids).toHaveLength(DECKEL);
    expect(ids).toContain(b.titeltreffer);
  });

  it("W2 · und die Antwort nennt es als Quelle statt eine Wissenslücke zu melden", async () => {
    const ask = new AskService({
      reasoner: new Reasoner(),
      koService: mitAngeforderterGuete(b.ko),
      gaps: new InMemoryGapRepo(),
    });

    const out = await ask.ask(FRAGE, "nutzer-1", "de", {
      validatedOnly: true,
      retrievalOnly: true,
    });

    expect(out.result.answered).toBe(true);
    expect(out.result.sources).toEqual([b.titeltreffer]);
  });

  it("W3 · KALIBRIERUNG: die Hülle allein bewirkt nichts — ohne die Angabe bleibt alles beim Alten", async () => {
    // Ohne diesen Fall könnte W1/W2 auch an der Hülle liegen statt an der Angabe. Dieselbe
    // Bauform, aber mit `vertrauen` statt `trefferguete`: das Ergebnis ist wieder das von V1.
    const nurHuelle = new Proxy(b.ko, {
      get(ziel, name, empfaenger) {
        const wert = Reflect.get(ziel, name, ziel);
        return typeof wert === "function"
          ? (...args: unknown[]) => (wert as (...a: unknown[]) => unknown).apply(empfaenger, args)
          : wert;
      },
    });
    const ids = (await nurHuelle.findCandidates({ terms: [TERM_A], limit: DECKEL })).map(
      (k) => k.id,
    );
    expect(ids).not.toContain(b.titeltreffer);
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

  it("B2 · derselbe Bestand, derselbe Deckel, über `findCandidates`: HEUTE fehlt es dort ebenfalls", async () => {
    // CHARAKTERISIERUNG, keine Zusage (s. Block V): solange `findCandidates` die Güte nicht
    // anfordert, verhält es sich wie die Bibliothek. Mit der einen Zeile ist das Titel-Objekt
    // dabei — vorgeführt in derselben Lage eine Zeile tiefer.
    const heute = (
      await gross.ko.findCandidates({ terms: [BEGRIFF], limit: BIBLIOTHEKSDECKEL })
    ).map((k) => k.id);
    expect(heute).not.toContain(gross.titeltreffer);

    const mitZeile = (
      await mitAngeforderterGuete(gross.ko).findCandidates({
        terms: [BEGRIFF],
        limit: BIBLIOTHEKSDECKEL,
      })
    ).map((k) => k.id);
    expect(mitZeile).toHaveLength(BIBLIOTHEKSDECKEL);
    expect(mitZeile).toContain(gross.titeltreffer);
    // UND DIE BIBLIOTHEK BLEIBT DABEI, WO SIE IST — auch dann. Das ist der Kern der Trennung.
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
// DIE FESTLEGUNG (BEN, Korrekturpflicht 3): beide Prüfwege suchen das Objekt, das DASSELBE THEMA
// behandelt. Für sie ist ein Titeltreffer das stärkere Signal als ein hoher Vertrauenswert, und was
// im Deckel verlorengeht, kann weder Dublette noch Widerspruch werden — die Güteauswahl soll
// deshalb ausdrücklich auch für sie gelten. Sie erben sie automatisch, weil sie durch DENSELBEN
// `findCandidates` gehen; genau deshalb hängt auch ihr Nutzen an der einen Zeile aus Block W.
//
// Gemessen wird am POOL, den der jeweilige Prüfweg wirklich bekommt: eine Beobachtungshülle um den
// ECHTEN `KoService` schreibt jede Kandidatenantwort mit und reicht sie unverändert durch. Sie
// entscheidet nichts.

describe("JOB 3048 · Q — Textprüfung und Wissensprüfung hängen an derselben einen Zeile", () => {
  it("Q1 · `checkKnowledge` (Deckel 40): HEUTE fehlt das Titel-Objekt, mit der Zeile ist es im Pool UND im Befund", async () => {
    const heute = await wissenspruefung(gross.ko);
    expect(heute.pool.length).toBe(KNOWLEDGE_CHECK_DECKEL);
    expect(heute.pool).not.toContain(gross.titeltreffer);
    expect(heute.ergebnis.similar.map((s) => s.id)).not.toContain(gross.titeltreffer);

    const mitZeile = await wissenspruefung(mitAngeforderterGuete(gross.ko));
    expect(mitZeile.pool.length).toBe(KNOWLEDGE_CHECK_DECKEL);
    expect(mitZeile.pool).toContain(gross.titeltreffer);
    // Und es bleibt nicht im Pool stecken: der lexikalische Ähnlichkeitsbefund nennt es.
    expect(mitZeile.ergebnis.similar.map((s) => s.id)).toContain(gross.titeltreffer);
  });

  it("Q2 · `checkText` (Deckel 20): HEUTE fehlt das Titel-Objekt, mit der Zeile ist es im Pool", async () => {
    const heute = await textpruefung(gross.ko);
    expect(heute.pool.length).toBe(DETECTION_DECKEL);
    expect(heute.pool).not.toContain(gross.titeltreffer);

    const mitZeile = await textpruefung(mitAngeforderterGuete(gross.ko));
    expect(mitZeile.pool.length).toBe(DETECTION_DECKEL);
    expect(mitZeile.pool).toContain(gross.titeltreffer);
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

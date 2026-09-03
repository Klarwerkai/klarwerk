// ================================================================================================
// JOB 3021 · N2 — DIE DEKLARIERTE WORTZUORDNUNG GILT AUCH, WENN KLARA ANTWORTET.
// ================================================================================================
//
// Pedis Zeile: „Suche versteht zusammengesetzte Wörter: ‚Urlaubsregelung' findet ‚Urlaubszeiten',
// Firmenwagen findet Dienstwagenfarbe — als begrenzte, deklarierte Domänenrelation, in Scheiben."
//
// Die Zuordnung wirkte in der Bibliothek und NICHT bei Klara: dieselbe Frage bekam je nach Weg eine
// andere Antwort. Diese Datei misst den Unterschied am ECHTEN Fragedienst — nicht die Anwesenheit
// eines Bezeichners, sondern das Verhalten.
//
// DER STAPEL IST DER ECHTE, keine Abkürzung (Muster: `tests/knowledge/s2-adapter-aufruf.test.ts`):
// `activateSearchProjectionV2()` fährt die vorgeschriebene Folge über den Produktweg, der
// `KoService` ist der echte, und die Vorauswahl läuft durch `findCandidates` wie im Betrieb.
//
// WO GEMESSEN WIRD: an der Modulgrenze `koService.findCandidates`. Das ist genau der Punkt, an dem
// `prefilterCandidates` seine Terme abgibt und seine Kandidaten bekommt; mitgeschrieben werden
// BEIDE Seiten — die abgefragten Terme UND die Objekte, die dabei herauskommen.
//
// ================================================================================================
// JOB 3039 R2 · N2, SCHEIBE 2 — WIE WEIT DIE ZUORDNUNG WIRKLICH TRÄGT, AM ECHTEN REASONER GEMESSEN.
// ================================================================================================
//
// AUCH DER REASONER IST JETZT DER ECHTE. Bis Runde 1 stand hier ein Doppelgänger, der aus jedem
// nichtleeren Kontext selbst `answered:true` machte — er konnte deshalb nur den Ausgang des ERSTEN
// Tors zeigen und hat eine Antwort behauptet, die das Produkt nie gegeben hätte (BEN, Runde 1,
// Korrekturpflicht 3). Ab Runde 2 läuft ein echter `Reasoner` (ohne Modellclient, also der
// deterministische Weg), und um ihn liegt eine reine BEOBACHTUNGSHÜLLE: sie schreibt jeden Aufruf
// mit und reicht ihn unverändert durch. Sie entscheidet nichts.
//
// WAS DIESE DATEI DAMIT MISST:
//   F1–F5  die Vorauswahl (JOB 3021) — dort wirkt die Zuordnung, unverändert und belegt
//   F6     die Ein-Wort-Grenze des Substanzmaßes, mit berichtigter Begründung
//   Z      DAS ZWEITE TOR: der echte Reasoner wählt auf der ROHEN Frage noch einmal aus und
//          verwirft das über die Entsprechung gefundene Objekt — der Grund, warum JOB 3039 die
//          Zusage „Klara antwortet aus dem gefundenen Objekt" NICHT einlösen konnte
//   W      warum es nicht genügt, nur das erste Tor zu weiten — und warum es sogar schadet
//   D      der Acht-Term-Deckel der Vorauswahl
//   L      die Grundformen der Tabelle als Fixpunkte
//   U      `ungeprueft`/`verschlossen` rechnen weiter auf der Vorauswahl
//   P      die Stämme im PostgreSQL-Adapter
//
// Z und W sind zugleich der ROT-ZUERST-VERTRAG für die nächste Scheibe: sind sie eines Tages grün
// beziehungsweise gegenstandslos, ist der Relevanztext durch beide Tore geführt.
import type { Pool } from "pg";
import { beforeEach, describe, expect, it } from "vitest";
import { AskService, InMemoryGapRepo } from "../../services/ask";
import { zugeordneteSuchterme } from "../../services/ask/src/service";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
  S2_ERWEITERUNG_GRENZE,
  SUCH_ZUORDNUNGEN,
} from "../../services/knowledge-object";
import { PgKoSearchProjectionRepo } from "../../services/knowledge-object/src/search-projection-repo-pg";
import type { CreateKoInput } from "../../services/knowledge-object/src/service";
import {
  DEFAULT_TOP_K,
  type KnowledgeRef,
  MIN_ANSWER_SUBSTANCE,
  type ModelClient,
  ModelProvider,
  Reasoner,
  queryTokens,
  selectCandidates,
} from "../../services/reasoner";

interface Abfrage {
  readonly terme: readonly string[];
  /** Wird nach dem Durchreichen gefüllt — die Abfragen laufen nebenläufig (`Promise.all`). */
  treffer: readonly string[];
}

interface Messplatz {
  readonly ask: AskService;
  readonly ko: KoService;
  /** Jede Quellabfrage der Vorauswahl, in der Reihenfolge ihres Auftretens. */
  readonly abfragen: Abfrage[];
  /** Was der ECHTE Reasoner zu sehen bekam — Frage und die Kennungen seines Trefferkontexts. */
  readonly reasonerSah: { frage: string; ids: string[] }[];
  /**
   * JEDER Methodenaufruf am Reasoner, in der Reihenfolge des Auftretens — die Hülle schreibt ihn
   * mit, bevor sie durchreicht. Der Egress-Riegel liest hier: taucht `embed` auf, lief ein
   * Einbettungsweg; taucht `answer` auf, lief der Modellweg (hier ohne Client, also deterministisch).
   */
  readonly reasonerAufrufe: string[];
}

/** Die abgefragten Terme in der Reihenfolge, in der die Vorauswahl sie abgegeben hat. */
function abgefragteTerme(m: Messplatz): string[] {
  return m.abfragen.flatMap((a) => [...a.terme]);
}

/** Alle Objekte, die die Vorauswahl über irgendeine ihrer Abfragen erreicht hat. */
function vorausgewaehlt(m: Messplatz): string[] {
  return [...new Set(m.abfragen.flatMap((a) => a.treffer))];
}

async function messplatz(): Promise<Messplatz> {
  const repo = new InMemoryKoRepo();
  const projections = new InMemoryKoSearchProjectionRepo(repo);
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: projections,
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);

  const abfragen: Abfrage[] = [];
  const reasonerSah: { frage: string; ids: string[] }[] = [];
  const reasonerAufrufe: string[] = [];

  // KEIN Doppelgänger der Datenquelle: die Umhüllung schreibt mit und reicht an den ECHTEN Dienst
  // durch. Ein nachgebautes `findCandidates` prüfte sonst die Attrappe statt den Suchweg.
  const beobachtet = {
    findCandidates: async (query: { terms: string[]; limit: number }) => {
      // Der Eintrag entsteht VOR dem Durchreichen: `prefilterCandidates` fährt seine Abfragen
      // nebenläufig, und nach dem `await` wäre die Reihenfolge die des Zurückkommens, nicht die
      // der Abgabe. Genau die Abgabereihenfolge ist hier die Messgröße.
      const eintrag: Abfrage = { terme: [...query.terms], treffer: [] };
      abfragen.push(eintrag);
      const treffer = await ko.findCandidates(query);
      eintrag.treffer = treffer.map((t) => t.id);
      return treffer;
    },
    searchProjectionOf: (id: string) => ko.searchProjectionOf(id),
  };

  // ==============================================================================================
  // DER ECHTE REASONER, IN EINER REINEN BEOBACHTUNGSHÜLLE (BEN, Runde 1, Korrekturpflicht 3).
  // ==============================================================================================
  //
  // `new Reasoner()` ohne Argumente heisst: primary = secondary = fallback = `DeterministicProvider`
  // (`reasoner/src/service.ts:256-270`). Kein Modellclient, kein Netz — und trotzdem der ECHTE
  // Antwortweg mitsamt seiner eigenen Kandidatenauswahl. Genau diese zweite Auswahl ist der
  // Gegenstand des Z-Blocks; ein Doppelgänger hätte sie verdeckt.
  //
  // Die Hülle ist ein `Proxy`, der jeden Methodenaufruf mitschreibt und unverändert durchreicht.
  // Sie erzeugt KEIN Ergebnis: über `answered` entscheidet ausschließlich der echte Reasoner.
  const echterReasoner = new Reasoner();
  const beobachteterReasoner = new Proxy(echterReasoner, {
    get(ziel, name) {
      const wert = Reflect.get(ziel, name, ziel);
      if (typeof wert !== "function" || typeof name !== "string") {
        return wert;
      }
      return (...args: unknown[]) => {
        reasonerAufrufe.push(name);
        if (name === "answer" || name === "answerRetrievalOnly") {
          const kontext = (args[1] ?? []) as readonly { id: string }[];
          reasonerSah.push({ frage: String(args[0]), ids: kontext.map((k) => k.id) });
        }
        return (wert as (...a: unknown[]) => unknown).apply(ziel, args);
      };
    },
  });

  const ask = new AskService({
    reasoner: beobachteterReasoner,
    koService: beobachtet as never,
    gaps: new InMemoryGapRepo(),
  });
  return { ask, ko, abfragen, reasonerSah, reasonerAufrufe };
}

const VORLAGE: Omit<CreateKoInput, "title" | "statement"> = {
  type: "best_practice",
  category: "Handbuch",
  author: "anna",
};

let m: Messplatz;
let urlaub: string;
let wagen: string;
let fremd: string;

beforeEach(async () => {
  m = await messplatz();
  // Die Objekte tragen NUR das jeweils andere Wort des Paares — nie das gefragte.
  urlaub = (
    await m.ko.create({
      ...VORLAGE,
      title: "Abwesenheiten",
      statement: "Die Urlaubszeiten stehen im Handbuch.",
    })
  ).id;
  wagen = (
    await m.ko.create({
      ...VORLAGE,
      title: "Fuhrpark",
      statement: "Die Dienstwagenfarbe ist einheitlich festgelegt.",
    })
  ).id;
  // Das Gegenstück: es hat mit keiner der beiden Fragen etwas zu tun.
  fremd = (
    await m.ko.create({ ...VORLAGE, title: "Kantine", statement: "Der Speiseplan hängt aus." })
  ).id;
});

// ------------------------------------------------------------------------------------------------
// F1/F2 — DIE BEIDEN FÄLLE AUS PEDIS ZEILE, am echten Fragedienst
// ------------------------------------------------------------------------------------------------

describe("N2 · F — Klara findet, was die Bibliothek längst findet", () => {
  it("F1 · die Frage nach der Urlaubsregelung erreicht das Objekt mit Urlaubszeiten", async () => {
    await m.ask.ask("Wie ist die Urlaubsregelung?", "nutzer-1", "de", { retrievalOnly: true });

    // (a) DIE TERME: die Entsprechung wurde wirklich abgefragt — und die getippte steht weiter vorn.
    expect(abgefragteTerme(m)).toEqual(["urlaubsregel", "urlaubszei"]);

    // (b) DAS OBJEKT: die Vorauswahl bringt es herein, und zwar über GENAU die ergänzte Abfrage.
    expect(vorausgewaehlt(m)).toContain(urlaub);
    expect(m.abfragen.find((a) => a.terme.includes("urlaubszei"))?.treffer).toContain(urlaub);
    // Nicht vakuos: die getippte Form allein holt nichts herein — das ist der Ausgangsfehler.
    expect(m.abfragen.find((a) => a.terme.includes("urlaubsregel"))?.treffer).toEqual([]);
    // Und die Erweiterung reißt nicht den Bestand herein.
    expect(vorausgewaehlt(m)).not.toContain(fremd);
  });

  it("F2 · die Frage nach dem Firmenwagen erreicht das Objekt mit Dienstwagenfarbe", async () => {
    await m.ask.ask("Welche Farbe hat der Firmenwagen?", "nutzer-1", "de", { retrievalOnly: true });

    expect(abgefragteTerme(m)).toEqual(["farb", "firmenwag", "dienstwag"]);
    expect(m.abfragen.find((a) => a.terme.includes("dienstwag"))?.treffer).toContain(wagen);
    expect(m.abfragen.find((a) => a.terme.includes("firmenwag"))?.treffer).toEqual([]);
    // Die Zerlegung von „Dienstwagenfarbe" war nie das Problem: der Treffer-Vertrag prüft per
    // Teilzeichenkette. Gefehlt hat allein die Brücke zwischen den beiden Wörtern.
    expect(vorausgewaehlt(m)).toContain(wagen);
  });

  it("F2b · die Zuordnung gilt in beide Richtungen", async () => {
    // Sonst wäre „firmenwagen/dienstwagen" eine Einbahnstraße, die als Paar dasteht.
    await m.ask.ask("Wo steht etwas zum Dienstwagen?", "nutzer-1", "de", { retrievalOnly: true });
    expect(abgefragteTerme(m)).toContain("firmenwag");
  });
});

// ------------------------------------------------------------------------------------------------
// F3 — DER RIEGEL: die Erweiterung schärft die Suche und behauptet nichts
// ------------------------------------------------------------------------------------------------

describe("N2 · F3 — der Riegel: `frageterme` bleibt unberührt", () => {
  it("F3 · die Aussagen über die Antwort rechnen weiter auf dem Getippten", async () => {
    const out = await m.ask.ask("Wie ist die Urlaubsregelung?", "nutzer-1", "de", {
      retrievalOnly: true,
    });

    // (a) DIE FRAGE, die den Reasoner erreicht, ist die getippte — kein ergänztes Wort ist
    //     hineingemischt worden.
    expect(m.reasonerSah.map((r) => r.frage)).toEqual(["Wie ist die Urlaubsregelung?"]);
    for (const ruf of m.reasonerSah) {
      expect(ruf.frage.toLowerCase()).not.toContain("urlaubszei");
    }

    // (b) DIE WISSENSLÜCKE nennt die Frage, nicht die Entsprechung. Das ist der Kern des Riegels:
    //     die Erweiterung darf nie als das ausgegeben werden, wonach gefragt wurde.
    expect(out.gap?.question ?? "").not.toMatch(/urlaubszei/i);
    expect(JSON.stringify(out)).not.toMatch(/"urlaubszei"/);

    // (c) DIE HERKUNFTSAUSKUNFT (`captionSources`) rechnet weiter auf `frageterme` — sie behauptet
    //     keine Fundstelle, die es für das Getippte nicht gibt.
    expect(out.result.captionSources).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
// F4 — UNVERÄNDERT, wo keine Zuordnung greift
// ------------------------------------------------------------------------------------------------

describe("N2 · F4 — ohne passende Zuordnung ändert sich nichts", () => {
  it("F4 · Term für Term dieselbe Vorauswahl, inklusive Reihenfolge", async () => {
    const frage = "Wo hängt der Speiseplan?";
    await m.ask.ask(frage, "nutzer-1", "de", { retrievalOnly: true });
    // Die Vorauswahl fragt GENAU die Frageterme ab, in ihrer Reihenfolge — nichts kommt hinzu.
    expect(abgefragteTerme(m)).toEqual(queryTokens(frage));
    expect(vorausgewaehlt(m)).toEqual([fremd]);
  });

  it("F4b · die Erweiterung kürzt nie und sortiert nie um", async () => {
    // Die Zusage von `expandSearchTerms`, hier an der Termbildung des Fragepfads gemessen.
    const eingabe = ["urlaubsregel", "handbuch", "frist"];
    expect([...eingabe, ...zugeordneteSuchterme(eingabe)]).toEqual([
      "urlaubsregel",
      "handbuch",
      "frist",
      "urlaubszei",
    ]);
    expect(S2_ERWEITERUNG_GRENZE.entferntTerme).toBe(false);
  });

  it("F4c · die Markierung behält ihren Platz VOR den ergänzten Termen", async () => {
    // Die entschiedene Reihenfolge (Begründung im Quelltext an der Aufrufstelle): Frage, dann
    // Markierung, dann Ergänzung. Unter dem Deckel fällt zuerst das Abgeleitete, nie eine echte
    // Eingabe.
    await m.ask.ask("Wie ist die Urlaubsregelung?", "nutzer-1", "de", {
      retrievalOnly: true,
      selection: "Der Speiseplan der Kantine hängt aus.",
    });
    const terme = abgefragteTerme(m);
    expect(terme.indexOf("urlaubsregel")).toBe(0);
    expect(terme.indexOf("speiseplan")).toBeLessThan(terme.indexOf("urlaubszei"));
    expect(terme[terme.length - 1]).toBe("urlaubszei");
  });
});

// ------------------------------------------------------------------------------------------------
// F5 — DIE GRENZE, als Messung und nicht als Kommentar
// ------------------------------------------------------------------------------------------------

describe("N2 · F5 — kein Modell, kein Embedder, kein Netz", () => {
  it("F5 · der Lauf aus F1 kommt ohne Modellweg aus, der Vorfilter bleibt unberührt", async () => {
    await m.ask.ask("Wie ist die Urlaubsregelung?", "nutzer-1", "de", { retrievalOnly: true });
    // Die Hülle schreibt JEDEN Methodenaufruf am echten Reasoner mit. Gelaufen ist genau der
    // Retrieval-Weg — kein `embed`, kein `assistText`, kein `probe`, kein Modellzugang.
    expect(m.reasonerAufrufe).toEqual(["answerRetrievalOnly"]);
    expect(m.reasonerAufrufe).not.toContain("embed");
    // Und die Zusicherung der Erweiterung selbst, gelesen statt behauptet.
    expect(S2_ERWEITERUNG_GRENZE.brauchtNetz).toBe(false);
    expect(S2_ERWEITERUNG_GRENZE.ruehrtVorfilterAn).toBe(false);
    expect(S2_ERWEITERUNG_GRENZE.leitetAb).toBe(false);
  });

  it("F5b · nichts wird abgeleitet — nur deklarierte Wörter treffen", async () => {
    // Ein Nachbarwort desselben Wortfelds steht NICHT in der Tabelle. Wer hier eine
    // Komposita-Regel oder ein Wörterbuch einbaut, wird an diesem Fall rot.
    expect(zugeordneteSuchterme(queryTokens("Firmenparkplatz"))).toEqual([]);
    expect(zugeordneteSuchterme(queryTokens("Urlaubsantrag"))).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
// F6 — DIE GRENZE DIESER SCHEIBE, gemessen statt verschwiegen
// ------------------------------------------------------------------------------------------------

describe("N2 · F6 — die Ein-Wort-Frage: was auch die Zuordnung nicht leistet", () => {
  it("F6 · eine Frage mit EINEM Inhaltstoken bleibt eine Wissenslücke — auch mit getipptem Gegenwort", async () => {
    const frage = "Wie ist die Urlaubsregelung?";
    const out = await m.ask.ask(frage, "nutzer-1", "de", { retrievalOnly: true });

    // (a) Die Vorauswahl hat das Objekt hereingeholt — das ist die Zusage von JOB 3021.
    expect(vorausgewaehlt(m)).toContain(urlaub);

    // (b) UND DIE ANTWORT BLEIBT EINE WISSENSLÜCKE, aus ZWEI unabhängigen Gründen. Beide sind
    //     gemessen, und JOB 3039 R2 hat den zweiten erst gefunden:
    //
    //     GRUND 1 — DAS SUBSTANZMASS: Die Frage zerfällt in GENAU EIN Inhaltstoken.
    //     `MIN_ANSWER_SUBSTANCE` (2, `services/reasoner/src/provider.ts:1392`) verlangt ZWEI
    //     verschiedene gemeinsame Inhaltstoken. Die Entsprechung tritt an die STELLE des getippten
    //     Wortes, sie legt kein zweites dazu — diese Frage fiele auch dann, wenn der Fragende
    //     „Urlaubszeiten" wörtlich getippt hätte (unten als (c) gemessen, nicht behauptet).
    //
    //     GRUND 2 — DAS ZWEITE TOR: Selbst eine Frage MIT zwei Inhaltstoken käme nicht durch,
    //     solange nur das erste Tor die Entsprechung kennt; der echte Reasoner wählt auf der rohen
    //     Frage noch einmal aus (Block Z). Das ist der Befund, der JOB 3039 aufgehalten hat.
    expect(queryTokens(frage)).toEqual(["urlaubsregel"]);
    expect(MIN_ANSWER_SUBSTANCE).toBe(2);
    expect(m.reasonerSah.map((r) => r.ids)).toEqual([[]]);
    expect(out.result.answered).toBe(false);

    // (c) DER BELEG ZU GRUND 1, am echten Reasoner: derselbe Ein-Wort-Fall mit dem WÖRTLICH
    //     getippten Gegenwort fällt genauso. Damit ist ausgeschlossen, dass hier die Zuordnung
    //     schuld ist — es ist das Maß.
    const direkt = await new Reasoner().answerRetrievalOnly(
      "Wie sind die Urlaubszeiten?",
      [
        {
          id: urlaub,
          title: "Abwesenheiten",
          statement: "Die Urlaubszeiten stehen im Handbuch.",
          status: "validiert",
          trust: 80,
        },
      ],
      "de",
    );
    expect(direkt.answered).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
// K — DIE KALIBRIERUNG: der Prüfstand SIEHT den Unterschied
// ------------------------------------------------------------------------------------------------
//
// Ohne diesen Block wäre alles darüber eine Reihe grüner Zusicherungen, die von einem toten
// Prüfstand nicht zu unterscheiden ist. Hier wird DIESELBE Kette mit LEERER und mit VERFÄLSCHTER
// Zuordnungstabelle gefahren — und fällt beide Male auf das alte Verhalten zurück.

describe("N2 · K — ohne die deklarierte Tabelle fällt F1 auf das alte Verhalten zurück", () => {
  it("K1 · leere Tabelle: keine Ergänzung, und das Objekt bleibt unerreichbar", async () => {
    const frageterme = queryTokens("Wie ist die Urlaubsregelung?");
    expect(zugeordneteSuchterme(frageterme, [])).toEqual([]);
    // Und das ist genau der Ausgangsfehler: mit diesen Termen erreicht die Vorauswahl nichts.
    const treffer = await m.ko.findCandidates({ terms: frageterme, limit: 50 });
    expect(treffer.map((t) => t.id)).toEqual([]);
  });

  it("K2 · verfälschte Tabelle: von dieser Seite ist keine Zuordnung zu erfinden", async () => {
    const frageterme = queryTokens("Wo hängt der Speiseplan?");
    // Ein Paar, das die DEKLARIERTE Tabelle nicht kennt. Der Fragepfad erkennt „speiseplan" darin
    // wieder — und ergänzt trotzdem nichts, weil die Paarung in `expandSearchTerms` steht und
    // nicht hier. Von dieser Seite ist keine Zuordnung zu erfinden.
    const verfaelscht = [
      { begriffe: ["speiseplan", "urlaubszeiten"], quelle: "KALIBRIERUNG — bewusst falsch" },
    ];
    expect(zugeordneteSuchterme(frageterme, verfaelscht)).toEqual([]);
    const treffer = await m.ko.findCandidates({
      terms: [...frageterme, ...zugeordneteSuchterme(frageterme, verfaelscht)],
      limit: 50,
    });
    expect(treffer.map((t) => t.id)).toEqual([fremd]);
    expect(treffer.map((t) => t.id)).not.toContain(urlaub);
  });

  it("K3 · die echte Tabelle über dieselbe Kette: das Objekt IST erreichbar", async () => {
    // Die Gegenprobe zu K1/K2 an derselben Stelle, damit der Unterschied an EINER Zeile hängt.
    const frageterme = queryTokens("Wie ist die Urlaubsregelung?");
    const treffer = await m.ko.findCandidates({
      terms: [...frageterme, ...zugeordneteSuchterme(frageterme)],
      limit: 50,
    });
    expect(treffer.map((t) => t.id)).toEqual([urlaub]);
  });
});

// ================================================================================================
// JOB 3039 R2 · WO DIE ZUORDNUNG WIRKLICH ENDET — UND WARUM SIE DORT ENDET
// ================================================================================================

/**
 * Die Prüffrage dieser Scheibe.
 *
 * WARUM NICHT „Wo stehen die Urlaubsregelungen im Handbuch?", wie der Auftrag sie nennt: Diese
 * Frage ist GEMESSEN schon vor JOB 3039 beantwortet worden, und zwar ohne jede Zuordnung. Sie
 * zerfällt in DREI Inhaltstoken (`steh`, `urlaubsregel`, `handbuch`, nicht zwei), und das Objekt
 * trägt „Die Urlaubszeiten STEHEN im HANDBUCH." — zwei wörtliche Treffer, also `substanz = 2` ohne
 * jede Entsprechung. Sie taugt deshalb nicht als Rot-zuerst-Fall; der Fall Z4 hält diesen Befund
 * als eigene Messung fest, statt ihn zu verschweigen. „finde ich" statt „stehen" nimmt genau den
 * einen zufälligen Wortgleichklang heraus, sodass wirklich nur die Zuordnung entscheiden könnte.
 */
const PRUEFFRAGE = "Wo finde ich die Urlaubsregelungen im Handbuch?";

/**
 * DER TEXT, DEN RUNDE 1 DEM ERSTEN TOR ÜBERGEBEN HAT — hier nur noch als MESSGRÖSSE.
 *
 * Im Produkt gibt es ihn nicht mehr (Runde 2 hat ihn zurückgebaut, Begründung im Grenzblock von
 * `services/ask/src/service.ts`). Die Fälle W1/W2 brauchen ihn, um zu zeigen, WARUM: er ist die
 * naheliegende Bauform, und sie trägt nachweislich nicht. Die Terme kommen aus dem Produkt
 * (`zugeordneteSuchterme`), nicht aus einer abgeschriebenen Liste — sonst prüfte der Fall sich selbst.
 */
function geweiteterTortext(frage: string): string {
  const ergaenzt = zugeordneteSuchterme(queryTokens(frage));
  return ergaenzt.length === 0 ? frage : `${frage} ${ergaenzt.join(" ")}`;
}

/** Eine Quelle in der Form, in der der Fragedienst sie an den Reasoner gibt. */
function ref(id: string, title: string, statement: string, stark = false): KnowledgeRef {
  return {
    id,
    title,
    statement,
    status: stark ? "validiert" : "offen",
    trust: stark ? 90 : 0,
  };
}

/**
 * Die Refs, wie der Fragedienst sie baut (`service.ts`, `refs`-Block) — für die Messungen, die am
 * Tor selbst rechnen und deshalb nicht durch `ask` laufen können.
 *
 * Die Nachbildung ist keine zweite Wahrheit, weil sie IM SELBEN FALL gegen den echten Lauf gehalten
 * wird: dieselbe rohe Frage auf diesen Refs muss dasselbe Ergebnis liefern, das der Reasoner im
 * Produktlauf gesehen hat (Z1, Anker). Stimmte die Nachbildung nicht, fiele dieser Anker.
 */
async function refsWieImDienst(mp: Messplatz, ids: readonly string[]): Promise<KnowledgeRef[]> {
  const raus: KnowledgeRef[] = [];
  for (const id of ids) {
    const ko = await mp.ko.get(id);
    if (!ko) {
      continue;
    }
    const projektion = await mp.ko.searchProjectionOf(id);
    raus.push({
      id: ko.id,
      title: ko.title,
      statement: ko.statement,
      status: ko.status,
      trust: ko.trust,
      ...(ko.captionTexts?.length ? { captionTexts: ko.captionTexts } : {}),
      ...(projektion?.bodyText.trim() ? { bodyText: projektion.bodyText } : {}),
    });
  }
  return raus;
}

// ------------------------------------------------------------------------------------------------
// Z — DAS ZWEITE TOR: WARUM DIE ZUORDNUNG NICHT BIS ZUR ANTWORT TRÄGT
// ------------------------------------------------------------------------------------------------
//
// DAS IST DER BEFUND DIESER RUNDE, und er ist der Grund, warum JOB 3039 seine Zusage nicht einlösen
// konnte. Zwischen der Vorauswahl und der Antwort stehen ZWEI Auswahlpunkte:
//
//   TOR 1  `selectCandidates` im Fragedienst   (`ask/src/service.ts`)
//   TOR 2  DIESELBE Auswahl NOCH EINMAL im Reasoner:
//            `Reasoner.answerRetrievalOnly` (`reasoner/src/service.ts:1150-1156`)
//              → `DeterministicProvider.answer` → `select` → `selectCandidates(question, …)`
//                (`reasoner/src/provider.ts:1683`)
//            `ModelProvider.answer` → `selectCandidates(question, context)`
//              (`reasoner/src/provider-model.ts:1424`)
//
// TOR 2 bekommt die ROHE Frage, und daran ist nichts falsch: die Antwort darf nur auf dem stehen,
// wonach wirklich gefragt wurde. Solange die Entsprechung nur Tor 1 kennt, entscheidet Tor 2
// dagegen — und die Wissenslücke bleibt.

describe("N2 · Z — das zweite Tor im echten Reasoner", () => {
  it("Z1 · ECHTPFAD: das über die Entsprechung gefundene Objekt erreicht den Reasoner NICHT", async () => {
    const out = await m.ask.ask(PRUEFFRAGE, "nutzer-1", "de", { retrievalOnly: true });

    // (a) DIE VORAUSWAHL bringt das Objekt herein — die Zusage von JOB 3021, unverändert gültig.
    expect(vorausgewaehlt(m)).toContain(urlaub);

    // (b) UND DIE ANTWORT IST TROTZDEM EINE WISSENSLÜCKE. Kein Doppelgänger mildert das ab: hier
    //     entscheidet der echte Reasoner. Beide Antwortwege des Dienstes enden gleich — der
    //     Retrieval-Weg des Add-ins ebenso wie der übliche Weg der Frageseite.
    expect(out.result.answered).toBe(false);
    expect(out.result.sources).toEqual([]);
    expect(out.gap).not.toBeNull();
    expect(m.reasonerSah.at(-1)?.frage).toBe(PRUEFFRAGE);
    const ueblich = await m.ask.ask(PRUEFFRAGE, "nutzer-1", "de", {});
    expect(m.reasonerAufrufe).toEqual(["answerRetrievalOnly", "answer"]);
    expect(ueblich.result.answered).toBe(false);
    expect(ueblich.result.sources).toEqual([]);

    // (c) DER ANKER für die Nachbildung: dieselbe rohe Frage auf den nachgebauten Refs liefert
    //     genau das, was der Reasoner im Produktlauf gesehen hat. Damit sind die Refs unten
    //     nachweislich die des Dienstes und keine bequeme Erfindung.
    const refs = await refsWieImDienst(m, vorausgewaehlt(m));
    expect(refs.length).toBeGreaterThan(1);
    expect(selectCandidates(PRUEFFRAGE, refs, DEFAULT_TOP_K).map((r) => r.id)).toEqual(
      m.reasonerSah.at(-1)?.ids,
    );

    // (d) UND DIE HALBE WAHRHEIT, die Runde 1 für die ganze gehalten hat: Tor 1 WÜRDE das Objekt
    //     durchlassen, wenn es die Entsprechung kennte. Es nützt nur nichts — siehe Z2.
    expect(
      selectCandidates(geweiteterTortext(PRUEFFRAGE), refs, DEFAULT_TOP_K).map((r) => r.id),
    ).toContain(urlaub);
  });

  it("Z2 · BEIDE Antwortwege verwerfen das Objekt, obwohl es fertig im Kontext liegt", async () => {
    // Hier hängt nichts mehr an der Vorauswahl: Das Objekt wird dem Reasoner DIREKT gegeben, so
    // wie ein durchlässiges Tor 1 es täte. Beide Wege verwerfen es erneut.
    const r = new Reasoner();
    const kontext = [ref(urlaub, "Abwesenheiten", "Die Urlaubszeiten stehen im Handbuch.", true)];

    expect((await r.answer(PRUEFFRAGE, kontext, "de")).answered).toBe(false);
    expect((await r.answerRetrievalOnly(PRUEFFRAGE, kontext, "de")).answered).toBe(false);

    // KALIBRIERUNG — ohne sie wäre das oben von einem toten Prüfstand nicht zu unterscheiden:
    // dasselbe Objekt, derselbe Satzbau, nur das deklarierte Gegenwort WÖRTLICH getippt. Jetzt
    // antworten beide Wege, und die Quelle ist das Objekt.
    const getippt = "Wo finde ich die Urlaubszeiten im Handbuch?";
    const normal = await r.answer(getippt, kontext, "de");
    const retrieval = await r.answerRetrievalOnly(getippt, kontext, "de");
    expect(normal.answered).toBe(true);
    expect(retrieval.answered).toBe(true);
    expect(retrieval.sources).toContain(urlaub);
  });

  it("Z2b · auch der MODELLWEG verwirft es — und fragt das Modell gar nicht erst", async () => {
    // BENs Prüflücke aus Runde 1: der zweite Provider war nur über seine Quellzeile belegt, nicht
    // laufend gemessen. Hier läuft er — mit einem aufzeichnenden Modellclient statt eines echten
    // Zugangs (kein Schlüssel, kein Netz). `ModelProvider.answer` wählt VOR jedem Modellaufruf
    // selbst aus (`provider-model.ts:1424`); fällt das Objekt dort, wird nicht einmal gefragt.
    const rufe: string[] = [];
    const client: ModelClient = {
      name: "aufzeichnend",
      complete: async () => {
        rufe.push("complete");
        return "Die Urlaubszeiten stehen im Handbuch. [1]";
      },
    };
    const provider = new ModelProvider(client);
    const kontext = [ref(urlaub, "Abwesenheiten", "Die Urlaubszeiten stehen im Handbuch.", true)];

    const ohne = await provider.answer(PRUEFFRAGE, kontext, "de");
    expect(ohne.answered).toBe(false);
    expect(rufe).toEqual([]);

    // KALIBRIERUNG: mit dem wörtlich getippten Gegenwort öffnet dasselbe Tor, und derselbe Client
    // wird gerufen. Ohne diesen Gegenlauf wäre oben nicht von einem toten Client zu unterscheiden.
    const mit = await provider.answer("Wo finde ich die Urlaubszeiten im Handbuch?", kontext, "de");
    expect(rufe).toEqual(["complete"]);
    expect(mit.answered).toBe(true);
  });

  it("Z3 · das zweite Tor IST `selectCandidates` — dieselbe Funktion erklärt beide Beobachtungen", () => {
    // Kein Ratespiel über die Ursache: die Funktion, die beide Provider aufrufen, verwirft die rohe
    // Frage und trägt die getippte. Wer den Relevanztext eines Tages durchreicht, ändert genau hier.
    const kontext = [ref(urlaub, "Abwesenheiten", "Die Urlaubszeiten stehen im Handbuch.", true)];
    expect(selectCandidates(PRUEFFRAGE, kontext, DEFAULT_TOP_K)).toEqual([]);
    expect(
      selectCandidates("Wo finde ich die Urlaubszeiten im Handbuch?", kontext, DEFAULT_TOP_K).map(
        (x) => x.id,
      ),
    ).toEqual([urlaub]);
  });

  it('Z4 · BEFUND ZUM AUFTRAG: „Wo stehen die Urlaubsregelungen im Handbuch?" trägt schon ohne Zuordnung', async () => {
    // Der Auftrag nennt diese Frage als Rot-zuerst-Fall und rechnet mit zwei Inhaltstoken. Gemessen
    // sind es drei, und „steh" trifft das Objekt wörtlich — sie wird auch OHNE jede Zuordnung
    // beantwortet, und zwar vom ECHTEN Reasoner. Der Fall bleibt stehen, damit niemand diese Frage
    // als Beleg für die Zuordnung führt.
    const frage = "Wo stehen die Urlaubsregelungen im Handbuch?";
    expect(queryTokens(frage)).toEqual(["steh", "urlaubsregel", "handbuch"]);
    const out = await m.ask.ask(frage, "nutzer-1", "de", { retrievalOnly: true });
    expect(out.result.answered).toBe(true);
    expect(out.result.sources).toContain(urlaub);
  });

  it("Z5 · GEGENPROBE: eine fremde Frage erreicht das Urlaubsobjekt nicht", async () => {
    // Die Zuordnung erfindet nichts: dieselbe Fläche, dieselbe Kategorie, andere Sache.
    const frage = "Wo hängt der Speiseplan im Handbuch?";
    const out = await m.ask.ask(frage, "nutzer-1", "de", { retrievalOnly: true });
    expect(zugeordneteSuchterme(queryTokens(frage))).toEqual([]);
    expect(m.reasonerSah.at(-1)?.ids).not.toContain(urlaub);
    expect(out.result.sources).not.toContain(urlaub);
    // Nicht vakuos: die passende Quelle trägt sehr wohl — der echte Reasoner antwortet hier.
    expect(out.result.answered).toBe(true);
    expect(out.result.sources).toEqual([fremd]);
  });
});

// ------------------------------------------------------------------------------------------------
// W — WARUM ES NICHT GENÜGT, NUR TOR 1 ZU WEITEN (und warum es sogar schadet)
// ------------------------------------------------------------------------------------------------
//
// Runde 1 hat genau das getan und daraus eine Antwort behauptet. Diese beiden Fälle halten fest,
// warum der Bau zurückgenommen wurde — beides gemessen, nicht überlegt.

describe("N2 · W — die zurückgenommene Bauform, mit ihren zwei gemessenen Folgen", () => {
  it("W1 · SCHADEN: acht Zuordnungstreffer füllen den Deckel und verdrängen den tragenden Treffer", async () => {
    // Acht Objekte, die NUR über die Entsprechung hereinkommen, dazu ein Objekt, das die Frage
    // wörtlich trifft. `DEFAULT_TOP_K` ist 8 — also passt eines nicht mehr hinein.
    const viele = Array.from({ length: DEFAULT_TOP_K }, (_, i) =>
      ref(`mit-${i}`, `Abwesenheiten ${i}`, "Die Urlaubszeiten stehen im Handbuch.", true),
    );
    const gut = ref("gut", "Urlaubsregelung", "Die Urlaubsregelung steht im Handbuch.");
    const refs = [...viele, gut];

    const ohne = selectCandidates(PRUEFFRAGE, refs, DEFAULT_TOP_K).map((x) => x.id);
    const mit = selectCandidates(geweiteterTortext(PRUEFFRAGE), refs, DEFAULT_TOP_K).map(
      (x) => x.id,
    );
    expect(ohne).toEqual(["gut"]);
    expect(mit).toHaveLength(DEFAULT_TOP_K);
    expect(mit).not.toContain("gut");

    // UND DAS IST DER SCHADEN, am echten Reasoner zu Ende gemessen: aus einer belegten Antwort
    // wird eine Wissenslücke. Tor 1 allein zu weiten macht die Antwort also nicht besser — es kann
    // sie zerstören.
    const r = new Reasoner();
    const mitOhne = await r.answerRetrievalOnly(
      PRUEFFRAGE,
      refs.filter((x) => ohne.includes(x.id)),
      "de",
    );
    const mitMit = await r.answerRetrievalOnly(
      PRUEFFRAGE,
      refs.filter((x) => mit.includes(x.id)),
      "de",
    );
    expect(mitOhne.answered).toBe(true);
    expect(mitOhne.sources).toContain("gut");
    expect(mitMit.answered).toBe(false);
  });

  it("W2 · FAIL-OPEN: eine Quelle mit BEIDEN Wörtern des Paares sammelt zwei Punkte aus einem", () => {
    // Der Auftrag verlangt ausdrücklich: „genau den Substanzpunkt, den das getippte Wort verschafft
    // hätte — keinen zweiten". Ein weiter Tortext hält das NICHT: trägt eine Quelle beide Wörter des
    // Paares, zählt das Maß sie als zwei verschiedene Inhaltstoken, und ein einziges getipptes Wort
    // öffnet das Substanztor. Wer den Relevanztext eines Tages durch beide Tore führt, muss jedes
    // Paar höchstens EINMAL zählen — sonst ist `MIN_ANSWER_SUBSTANCE` für jedes deklarierte Wort
    // faktisch auf eins abgesenkt.
    const einWort = "Wie ist die Urlaubsregelung?";
    expect(queryTokens(einWort)).toEqual(["urlaubsregel"]);
    const beide = [ref("beide", "Urlaubsregelung", "Die Urlaubszeiten sind hier geregelt.")];

    expect(selectCandidates(einWort, beide, DEFAULT_TOP_K)).toEqual([]);
    expect(
      selectCandidates(geweiteterTortext(einWort), beide, DEFAULT_TOP_K).map((x) => x.id),
    ).toEqual(["beide"]);
  });
});

// ------------------------------------------------------------------------------------------------
// L — DIE FORMEN DER TABELLE, BELEGT STATT ANGENOMMEN
// ------------------------------------------------------------------------------------------------
//
// `zugeordneteSuchterme` gibt GRUNDFORMEN an die Vorauswahl. Trüge eine davon sich beim nächsten
// Durchlauf durch `tokenize` anders, stünde an einer späteren Stelle ein anderes Wort als in der
// Vorauswahl — die zweite Wahrheit, die JOB 3021 gerade abgeschafft hat. Für den künftigen
// Relevanztext (Block Z) ist genau das die Vorbedingung.

describe("N2 · L — die Grundformen der Zuordnung sind stabil", () => {
  it("L1 · die Ergänzung dieser Prüffrage ist genau ein Term aus der deklarierten Tabelle", () => {
    expect(zugeordneteSuchterme(queryTokens(PRUEFFRAGE))).toEqual(["urlaubszei"]);
  });

  it("L3 · jede deklarierte Entsprechung ist ihr eigener Fixpunkt", () => {
    // DIE PFLICHT AN KÜNFTIGE TABELLENZEILEN: Wer ein Paar einträgt, dessen Grundform sich beim
    // zweiten Durchlauf noch einmal ändert (oder als Stoppform/Kurzwort ganz herausfällt), wird hier
    // rot. Dann steht am Tor ein anderes Wort als in der Vorauswahl, und der Bau hält nicht mehr.
    const woerter = SUCH_ZUORDNUNGEN.flatMap((z) => z.begriffe);
    expect(woerter.length).toBeGreaterThanOrEqual(6);
    for (const wort of woerter) {
      for (const term of queryTokens(wort)) {
        expect(queryTokens(term), `Grundform „${term}" ist nicht ihr eigener Fixpunkt`).toEqual([
          term,
        ]);
      }
    }
  });

  it("L4 · das Maß dahinter bleibt unberührt", () => {
    // Der Auftrag verbietet den bequemen Weg ausdrücklich: F6 ist nicht durch ein Absenken der
    // Schwelle grün zu machen. Diese Zeile hält die Zahl fest, an der es hängt.
    expect(MIN_ANSWER_SUBSTANCE).toBe(2);
  });
});

// ------------------------------------------------------------------------------------------------
// D — DER ACHT-TERM-DECKEL
// ------------------------------------------------------------------------------------------------
//
// `ASK_PREFILTER_MAX_TERMS` (8) schneidet die ABFRAGEN der Vorauswahl. Der ergänzte Term steht ganz
// hinten und fällt deshalb zuerst — die Frageterme behalten den Vorrang. Von Codex zu JOB 3021
// nachgefordert (LEHREN.md, 2026-09-03T10:47) und hier für beide Lagen entschieden und gemessen.

describe("N2 · D — was der Deckel der Vorauswahl mit der Entsprechung macht", () => {
  const FUENF_FREMDE = "Kupplungsscheibe Nockenwelle Ventilspiel Zahnriemen Radlager";

  it("D1 · Fenster voll: der ergänzte Term fällt zuerst — ein anderer Term holt das Objekt trotzdem", async () => {
    // Drei Frageterme plus fünf Markierungsterme füllen das Fenster; „urlaubszei" wird nicht mehr
    // abgefragt. Das Objekt kommt hier über „handbuch" trotzdem in die Vorauswahl — der Deckel
    // entscheidet also über die ABFRAGE, nicht über die Erreichbarkeit.
    const out = await m.ask.ask(PRUEFFRAGE, "nutzer-1", "de", {
      retrievalOnly: true,
      selection: FUENF_FREMDE,
    });
    const terme = abgefragteTerme(m);
    expect(terme).toHaveLength(8);
    expect(terme).not.toContain("urlaubszei");
    expect(vorausgewaehlt(m)).toContain(urlaub);
    // Und die Antwort bleibt dieselbe wie ohne Markierung: eine Wissenslücke — das zweite Tor
    // entscheidet, nicht der Deckel (Block Z).
    expect(out.result.answered).toBe(false);
  });

  it("D2 · Fenster voll, Objekt NUR über die Entsprechung erreichbar: dieselbe Antwort wie ohne Zuordnung", async () => {
    // Die Frage nennt kein Wort des Objekts; ohne die abgefragte Entsprechung ist es unerreichbar.
    // Fällt sie am Deckel, gibt es keinen Kandidaten — und das Tor kann nichts durchlassen, was nie
    // gefunden wurde. Die Antwort ist dann Zeile für Zeile die eines Laufs ohne Zuordnung.
    //
    // EHRLICH DAZUGESAGT: Diese Frage bliebe auch mit Kandidat eine Wissenslücke, weil sie nur EIN
    // Inhaltstoken trägt (F6). Gemessen wird hier deshalb der Deckel an der VORAUSWAHL — dass das
    // Objekt gar nicht erst gefunden wird — und nicht das Substanzmaß.
    const frage = "Wie ist die Urlaubsregelung?";
    const langeMarkierung = `${FUENF_FREMDE} Waermetauscher Druckspeicher Bremssattel`;
    const out = await m.ask.ask(frage, "nutzer-1", "de", {
      retrievalOnly: true,
      selection: langeMarkierung,
    });
    const terme = abgefragteTerme(m);
    expect(terme).toHaveLength(8);
    expect(terme).not.toContain("urlaubszei");
    expect(vorausgewaehlt(m)).not.toContain(urlaub);
    expect(out.result.answered).toBe(false);

    // NICHT VAKUOS: mit kurzer Markierung bleibt Platz, der Term wird abgefragt, und das Objekt
    // steht in der Vorauswahl. Nur der Deckel unterscheidet die beiden Läufe.
    const kurz = await messplatz();
    const kurzUrlaub = (
      await kurz.ko.create({
        ...VORLAGE,
        title: "Abwesenheiten",
        statement: "Die Urlaubszeiten stehen im Handbuch.",
      })
    ).id;
    await kurz.ask.ask(frage, "nutzer-1", "de", { retrievalOnly: true, selection: "Nockenwelle" });
    expect(abgefragteTerme(kurz)).toContain("urlaubszei");
    expect(vorausgewaehlt(kurz)).toContain(kurzUrlaub);
  });
});

// ------------------------------------------------------------------------------------------------
// U — DIE BEIDEN BETRACHTER-MELDUNGEN RECHNEN AUF DER VORAUSWAHL, NICHT AUF DER ANTWORT
// ------------------------------------------------------------------------------------------------
//
// Von Codex zu JOB 3021 nachgefordert (LEHREN.md, 2026-09-03T10:47). Beide Meldungen entstehen aus
// `prefilteredRaw` — der VORAUSWAHL. Weder ein Tor noch ein künftiger Relevanztext darf sie wachsen
// lassen oder schrumpfen; gemessen wird das an einem Lauf, dessen Antwort trägt, und einem, dessen
// Antwort fehlt.
//
// EHRLICH ABGEGRENZT: Dass die VORAUSWAHL seit JOB 3021 auch über eine Entsprechung findet, wirkt
// selbstverständlich auch auf diese beiden Listen — das ist die Zusage von JOB 3021 und war schon
// vorher so.

describe("N2 · U — `ungeprueft` und `verschlossen` folgen der Vorauswahl", () => {
  it("U1 · `ungeprueft` meldet genau die unvalidierten Objekte der Vorauswahl", async () => {
    // `validatedOnly` verwirft alle drei offenen Objekte — gemeldet werden sie trotzdem, mit
    // Zustand und ohne Inhalt.
    const zu = await m.ask.ask(PRUEFFRAGE, "nutzer-1", "de", {
      retrievalOnly: true,
      validatedOnly: true,
      ungeprueftSichtbarFuer: () => true,
    });
    expect(zu.result.answered).toBe(false);
    const gemeldet = (zu.ungeprueft ?? []).map((h) => h.id).sort();
    expect(gemeldet).toEqual([...vorausgewaehlt(m)].sort());
    expect(gemeldet).toContain(urlaub);

    // NICHT VAKUOS: derselbe Lauf OHNE Betrachterfilter trägt das Feld überhaupt nicht (mega77).
    const ohneFilter = await messplatz();
    await ohneFilter.ko.create({
      ...VORLAGE,
      title: "Abwesenheiten",
      statement: "Die Urlaubszeiten stehen im Handbuch.",
    });
    const stumm = await ohneFilter.ask.ask(PRUEFFRAGE, "nutzer-1", "de", {
      retrievalOnly: true,
      validatedOnly: true,
    });
    expect(stumm.ungeprueft).toBeUndefined();

    // UND KEIN ERGÄNZTES WORT steht in der Meldung — sie trägt nur `{id,title,status}`.
    expect(JSON.stringify(zu.ungeprueft)).not.toMatch(/urlaubszei/i);
  });

  it("U2 · `verschlossen` nennt die Torlage der Vorauswahl — und nur bei fehlender Antwort", async () => {
    // (a) DIE WISSENSLÜCKE: das Objekt steht in der Vorauswahl, seine Tore sind benannt. Gerechnet
    //     wird auf `prefilteredRaw`, nicht auf dem, was der Reasoner durchgelassen hat.
    const luecke = await m.ask.ask("Wie ist die Urlaubsregelung?", "nutzer-1", "de", {
      retrievalOnly: true,
      verschlossenSichtbarFuer: () => true,
    });
    expect(luecke.result.answered).toBe(false);
    const eintrag = (luecke.verschlossen ?? []).find((h) => h.id === urlaub);
    expect(eintrag?.freigabeFehlt).toBe(true);
    expect(JSON.stringify(luecke.verschlossen)).not.toMatch(/urlaubszei/i);

    // (b) UND WENN DIE ANTWORT TRÄGT, gibt es keine Torlage zu melden — der bestehende Vertrag
    //     („NUR bei answered=false") bleibt Wort für Wort gültig. Gemessen an der Frage, die auch
    //     ohne Zuordnung trägt (Z4), damit der Fall nicht an der offenen Baustelle hängt.
    const out = await m.ask.ask("Wo stehen die Urlaubsregelungen im Handbuch?", "nutzer-1", "de", {
      retrievalOnly: true,
      verschlossenSichtbarFuer: () => true,
    });
    expect(out.result.answered).toBe(true);
    expect(out.verschlossen).toBeUndefined();
  });
});

// ------------------------------------------------------------------------------------------------
// P — DIE STÄMME IM POSTGRESQL-ADAPTER
// ------------------------------------------------------------------------------------------------
//
// Von Codex zu JOB 3021 nachgefordert. Die Frage ist nicht „läuft die Datenbank", sondern: WAS
// schickt der Betriebsadapter, wenn der Fragepfad ihm seine Grundformen gibt?
//
// SKIP-BEDINGUNG: KEINE. Dieser Block braucht keine laufende Datenbank und wird in keiner Umgebung
// übersprungen — der aufzeichnende Doppelgänger beantwortet die Steuerzeile und fängt die
// Suchabfrage ab (Bauart übernommen aus `tests/knowledge/s2-adapter-postgres.test.ts:42-71`).
// GESAMTZAHL: drei Fälle, in jeder Umgebung dieselben drei.
const AKTIVE_GENERATION = 5;
const STEUERZEILE_V2_ACTIVE = {
  active_projection_version: 2,
  target_projection_version: 2,
  projection_state: "V2_ACTIVE",
  last_successful_rebuild: "2026-08-01T00:00:00.000Z",
  last_reconcile: "2026-08-01T00:00:00.000Z",
  last_failure: null,
  build_started_at: "2026-08-01T00:00:00.000Z",
  build_finished_at: "2026-08-01T00:00:00.000Z",
  build_generation: AKTIVE_GENERATION,
  active_generation: AKTIVE_GENERATION,
  integrity_marker: `V2-READY:${AKTIVE_GENERATION}`,
  activated_at: "2026-08-01T00:00:00.000Z",
};

function fakePool() {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes("ko_projection_control")) {
      return { rows: [STEUERZEILE_V2_ACTIVE], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
  const pool = {
    query,
    connect: async () => ({ query, release: () => undefined }),
  } as unknown as Pool;
  return { pool, calls };
}

/** Die Suchbegriffe unter den Parametern — sie reisen als `%begriff%` in die ILIKE-Bedingungen. */
function begriffeIn(calls: { sql: string; params: unknown[] }[]): string[] {
  const abfrage = calls.find((c) => !c.sql.includes("ko_projection_control"));
  expect(abfrage, "der Postgres-Adapter hat gar keine Suchabfrage abgesetzt").toBeDefined();
  return (abfrage as { params: unknown[] }).params
    .filter((p): p is string => typeof p === "string" && p.startsWith("%") && p.endsWith("%"))
    .map((p) => p.slice(1, -1));
}

describe("N2 · P — der Betriebsadapter und die Grundformen des Fragepfads", () => {
  it("P1 · jeder Term, den der Fragepfad bildet, erreicht die Abfrage unverändert", async () => {
    // Der Fragepfad fragt je Term EINE Abfrage ab (`prefilterCandidates`). Gemessen wird deshalb
    // Term für Term, mit genau der Liste, die JOB 3039 an dieser Frage bildet.
    const terme = [...queryTokens(PRUEFFRAGE), ...zugeordneteSuchterme(queryTokens(PRUEFFRAGE))];
    expect(terme).toEqual(["find", "urlaubsregel", "handbuch", "urlaubszei"]);
    for (const term of terme) {
      const { pool, calls } = fakePool();
      await new PgKoSearchProjectionRepo(pool).findActive({ terms: [term] });
      expect(begriffeIn(calls), `der Term „${term}" kommt nicht am Adapter an`).toContain(term);
    }
  });

  it("P2 · die Umrechnung geschieht im Fragepfad — der Adapter erfindet aus einem Stamm nichts", async () => {
    // Der entscheidende Befund von JOB 3021, hier für den Betriebsadapter belegt: `urlaubsregel` ist
    // die Grundform, die Tabelle führt die OBERFLÄCHENFORM. Der Adapter allein baut die Brücke also
    // NICHT — er kann sie nicht bauen, und genau deshalb rechnet `zugeordneteSuchterme` sie um.
    const { pool, calls } = fakePool();
    await new PgKoSearchProjectionRepo(pool).findActive({ terms: ["urlaubsregel"] });
    expect(new Set(begriffeIn(calls))).toEqual(new Set(["urlaubsregel"]));

    // Zum Vergleich, damit der Fall nicht bloß eine Abwesenheit misst: die Oberflächenform wird vom
    // Adapter sehr wohl erweitert.
    const ober = fakePool();
    await new PgKoSearchProjectionRepo(ober.pool).findActive({ terms: ["urlaubsregelung"] });
    expect(begriffeIn(ober.calls)).toContain("urlaubszeiten");
  });

  it("P3 · der Stamm trifft in SQL, was er im Speicher trifft — als Teilzeichenkette", async () => {
    // Der Treffer-Vertrag ist beidseits `%term%` (ILIKE in SQL, `lower.includes` im Speicher). Der
    // Stamm `urlaubszei` steckt in „Urlaubszeiten" — deshalb findet der Betriebsadapter dasselbe
    // Objekt wie der Speicheradapter, und die Begriffe bleiben Parameter statt SQL-Text.
    const { pool, calls } = fakePool();
    await new PgKoSearchProjectionRepo(pool).findActive({ terms: ["urlaubszei"] });
    expect(begriffeIn(calls)).toContain("urlaubszei");
    const abfrage = calls.find((c) => !c.sql.includes("ko_projection_control"));
    expect(abfrage?.sql).toContain("ILIKE");
    expect(abfrage?.sql).not.toContain("urlaubszei");
    expect("Die Urlaubszeiten stehen im Handbuch.".toLowerCase()).toContain("urlaubszei");
    // Und derselbe Stamm findet im Speicheradapter wirklich das Objekt.
    const treffer = await m.ko.findCandidates({ terms: ["urlaubszei"], limit: 50 });
    expect(treffer.map((t) => t.id)).toEqual([urlaub]);
  });
});

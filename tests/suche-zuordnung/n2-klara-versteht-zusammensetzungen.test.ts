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
// `KoService` ist der echte, und die Vorauswahl läuft durch `findCandidates` wie im Betrieb. Nur
// der Reasoner ist ein BEOBACHTENDER Doppelgänger — er schreibt mit, was ihm übergeben wird.
//
// WO GEMESSEN WIRD: an der Modulgrenze `koService.findCandidates`. Das ist genau der Punkt, an dem
// `prefilterCandidates` seine Terme abgibt und seine Kandidaten bekommt; mitgeschrieben werden
// BEIDE Seiten — die abgefragten Terme UND die Objekte, die dabei herauskommen.
import { beforeEach, describe, expect, it } from "vitest";
import { AskService, InMemoryGapRepo } from "../../services/ask";
import { zugeordneteSuchterme } from "../../services/ask/src/service";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
  S2_ERWEITERUNG_GRENZE,
} from "../../services/knowledge-object";
import type { CreateKoInput } from "../../services/knowledge-object/src/service";
import { queryTokens } from "../../services/reasoner";

const LEER = {
  answered: false,
  answer: null,
  knowledgeClass: "unbekannt",
  trust: 0,
  sources: [] as string[],
  citedSources: [] as string[],
  steps: [],
};

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
  /** Was der Reasoner zu sehen bekam — Frage und die Kennungen seines Trefferkontexts. */
  readonly reasonerSah: { frage: string; ids: string[] }[];
  /**
   * Der Riegel gegen jeden Egress: jeder Aufruf, den ein Modell- oder Einbettungsweg auslösen
   * würde. Bleibt die Liste leer, ist der Lauf ohne Modell und ohne Embedder gefahren.
   */
  readonly modellwege: string[];
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
  const modellwege: string[] = [];

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

  const reasoner = {
    answer: async (frage: string, kontext: readonly { id: string }[]) => {
      modellwege.push("answer");
      reasonerSah.push({ frage, ids: kontext.map((k) => k.id) });
      return LEER;
    },
    answerRetrievalOnly: async (frage: string, kontext: readonly { id: string }[]) => {
      reasonerSah.push({ frage, ids: kontext.map((k) => k.id) });
      const best = kontext[0];
      if (!best) {
        return LEER;
      }
      return { ...LEER, answered: true, answer: "steht im Bestand", sources: [best.id] };
    },
    embed: async () => {
      modellwege.push("embed");
      return [] as number[];
    },
  };

  const ask = new AskService({
    reasoner: reasoner as never,
    koService: beobachtet as never,
    gaps: new InMemoryGapRepo(),
  });
  return { ask, ko, abfragen, reasonerSah, modellwege };
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
    // Der Doppelgänger schreibt JEDEN Modell- und Einbettungsweg mit. Leer heißt: keiner lief.
    expect(m.modellwege).toEqual([]);
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

describe("N2 · F6 — was diese Scheibe leistet und was sie nicht leistet", () => {
  it("F6 · die Zuordnung schärft die VORAUSWAHL — über das Relevanzmaß entscheidet sie nicht", async () => {
    const out = await m.ask.ask("Wie ist die Urlaubsregelung?", "nutzer-1", "de", {
      retrievalOnly: true,
    });

    // (a) Die Vorauswahl hat das Objekt hereingeholt — das ist die Zusage dieses Durchgangs.
    expect(vorausgewaehlt(m)).toContain(urlaub);

    // (b) UND HIER ENDET SIE. Zwischen Vorauswahl und Antwort steht `selectCandidates`
    //     (`reasoner/src/provider.ts`), und dessen Relevanzmaß rechnet auf dem GETIPPTEN Fragetext:
    //     „urlaubsregel" kommt im Objekt literal nicht vor, also fällt es dort. Der Reasoner sieht
    //     es nicht, und die Antwort bleibt eine ehrliche Wissenslücke.
    //
    //     Das ist KEIN Fehler dieses Baus, sondern seine ausgesprochene Grenze: der Auftrag deckt
    //     „Klaras Kandidatenvorauswahl", nicht das Relevanzmaß des Reasoners. Wer das Versprechen
    //     „Klara antwortet aus dem gefundenen Objekt" einlösen will, muss die Zuordnung DORT
    //     ebenfalls verdrahten — eine eigene Scheibe. Diese Zeile hält fest, wo der Stand steht,
    //     damit niemand mehr behauptet, als gemessen ist.
    expect(m.reasonerSah.map((r) => r.ids)).toEqual([[]]);
    expect(out.result.answered).toBe(false);
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

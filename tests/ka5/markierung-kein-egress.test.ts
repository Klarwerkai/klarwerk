// ================================================================================================
// JOB 3006 · KA5 — DIE PASSAGE VERLÄSST DAS HAUS NICHT. GEMESSEN, NICHT ZUGESICHERT.
// ================================================================================================
//
// Der Riegel wird hier am Ask-Dienst gemessen, weil dort die einzige Verwendung der Passage liegt
// (Bildung der Suchbegriffe) und weil dort ALLE Ausgänge zusammenlaufen: Reasoner, Prüfprotokoll,
// Wissenslücke, Antwortkörper. Der Reasoner ist ein BEOBACHTENDER Doppelgänger — er schreibt mit,
// was ihm übergeben wird, statt zu antworten wie das Produkt.
//
// DAS WORT, AN DEM GEMESSEN WIRD. „Nachtfalter" steht in der markierten Passage und SONST NIRGENDS —
// nicht in der Frage, nicht in einem Wissensobjekt. Findet es sich in irgendeiner Ausgabe, ist es
// über die Passage dorthin gelangt; es gibt keinen zweiten Weg. „Ölwannenschraube" ist bewusst NICHT
// dieses Wort: es steht auch im Wissensobjekt B, und dass es in Kontext und Antwort auftaucht, ist
// die Auskunft des Bestands über sich selbst und kein Egress der Markierung.
import { describe, expect, it } from "vitest";
import { AskService, InMemoryGapRepo } from "../../services/ask";
import { queryTokens } from "../../services/reasoner";

const FRAGE = "Wie ist die Montage der Bremsleitung beim Kaltstart?";
const PASSAGE = "Beim Kaltstart der Baureihe Nachtfalter tropft es an der Ölwannenschraube.";
const MARKE = "nachtfalter";

interface TestKo {
  id: string;
  title: string;
  statement: string;
  status: string;
  trust: number;
  confidentiality: string;
  author: string;
  version: number;
  /**
   * Die SCHLAGWÖRTER — auffindbar, aber nicht relevanzbildend. Genau diese Asymmetrie hat der
   * Bestand wirklich: die Suche liest Schlagwörter mit (Effective Search Document), das Relevanzmaß
   * des Reasoners liest sie NICHT (`refMatchText` = Titel, Aussage, Fußnoten, Fließtext).
   */
  schlagwoerter: string;
}

const BESTAND: TestKo[] = [
  {
    id: "ko-a",
    title: "Bremsleitung Montage Standard",
    statement: "Die Montage der Bremsleitung erfolgt nach Plan.",
    schlagwoerter: "Kaltstart",
    status: "validiert",
    trust: 90,
    confidentiality: "intern",
    author: "autor-1",
    version: 1,
  },
  {
    id: "ko-b",
    title: "Bremsleitung Montage im Kaltstart",
    statement: "Bei der Montage der Bremsleitung im Kaltstart zuerst die Ölwannenschraube lösen.",
    schlagwoerter: "",
    status: "validiert",
    trust: 40,
    confidentiality: "intern",
    author: "autor-1",
    version: 1,
  },
];

interface Messplatz {
  ask: AskService;
  /** Jede Quellabfrage, in der Reihenfolge ihres Auftretens — das Fenster auf `terms`. */
  abgefragteTerme: string[];
  /** Was der Reasoner zu sehen bekam: Aufruf, Fragetext, serialisierter Trefferkontext. */
  reasonerSah: { methode: string; frage: string; kontext: string }[];
  /** Jeder Prüfprotokolleintrag, so wie er geschrieben wurde. */
  protokoll: unknown[];
  gaps: InMemoryGapRepo;
}

const LEER = {
  answered: false,
  answer: null,
  knowledgeClass: "unbekannt",
  trust: 0,
  sources: [] as string[],
  citedSources: [] as string[],
  steps: [],
};

function messplatz(opts: { antwortet: boolean } = { antwortet: true }): Messplatz {
  const abgefragteTerme: string[] = [];
  const reasonerSah: { methode: string; frage: string; kontext: string }[] = [];
  const protokoll: unknown[] = [];
  const gaps = new InMemoryGapRepo();

  // Die Datenquelle als Doppelgänger — mit der EINEN Eigenschaft, auf die es hier ankommt: sie
  // deckelt je Term und ordnet dabei nach Trust (so tut es der echte Suchweg,
  // `search-projection-repo.ts:761`). Der Deckel steht hier auf 1 statt auf 50, damit derselbe
  // Effekt ohne fünfzig Füllobjekte messbar ist: das trust-schwächere, aber passendere Objekt
  // erreicht die Antwortkette über einen Frageterm NICHT — nur über einen seltenen Begriff, den die
  // Markierung mitbringt.
  const QUELL_DECKEL = 1;
  const koService = {
    findCandidates: async ({ terms, limit }: { terms: string[]; limit: number }) => {
      abgefragteTerme.push(...terms);
      const gesucht = terms.map((t) => t.toLowerCase());
      return BESTAND.filter((ko) =>
        gesucht.some((t) =>
          `${ko.title} ${ko.statement} ${ko.schlagwoerter}`.toLowerCase().includes(t),
        ),
      )
        .sort((a, b) => b.trust - a.trust)
        .slice(0, Math.min(limit, QUELL_DECKEL));
    },
    searchProjectionOf: async () => undefined,
  };

  const merke = (methode: string, frage: string, kontext: readonly unknown[]) => {
    reasonerSah.push({ methode, frage, kontext: JSON.stringify(kontext) });
  };
  const antwortAus = (kontext: readonly { id: string; statement: string }[]) => {
    const best = kontext[0];
    if (!opts.antwortet || !best) {
      return LEER;
    }
    return {
      ...LEER,
      answered: true,
      answer: best.statement,
      knowledgeClass: "regel",
      trust: 50,
      sources: [best.id],
      citedSources: [best.id],
    };
  };
  const reasoner = {
    answer: async (frage: string, kontext: readonly { id: string; statement: string }[]) => {
      merke("answer", frage, kontext);
      return antwortAus(kontext);
    },
    answerRetrievalOnly: async (
      frage: string,
      kontext: readonly { id: string; statement: string }[],
    ) => {
      merke("answerRetrievalOnly", frage, kontext);
      return antwortAus(kontext);
    },
  };

  const audit = {
    record: async (eintrag: unknown) => {
      protokoll.push(eintrag);
    },
    recordOnce: async () => true,
  };

  const ask = new AskService({
    reasoner: reasoner as never,
    koService: koService as never,
    gaps,
    audit: audit as never,
  });
  return { ask, abgefragteTerme, reasonerSah, protokoll, gaps };
}

describe("KA5 · der Egress-Riegel der Markierung", () => {
  it("KA5-R3 · die Passage schärft die Suche — und erreicht den Reasoner NICHT", async () => {
    // Der Gegenstand: ohne Markierung trägt ko-a die Antwort, ko-b ist unerreichbar.
    const ohne = messplatz();
    const vorher = await ohne.ask.ask(FRAGE, "nutzer-1", "de", {
      validatedOnly: true,
      retrievalOnly: true,
    });
    expect(vorher.result.sources).toEqual(["ko-a"]);

    const m = messplatz();
    const out = await m.ask.ask(FRAGE, "nutzer-1", "de", {
      validatedOnly: true,
      retrievalOnly: true,
      selection: PASSAGE,
    });

    // (a) NICHT VAKUOS: die Passage hat wirklich gewirkt — ihr seltenes Wort wurde abgefragt, und
    // die Antwort steht jetzt auf dem Objekt, das zur markierten Stelle passt.
    expect(m.abgefragteTerme).toContain("ölwannenschraub");
    expect(m.abgefragteTerme).toContain(MARKE);
    expect(out.result.sources).toEqual(["ko-b"]);

    // (b) DER RIEGEL: der Reasoner wurde gerufen, und er sah GENAU die Frage — kein Wort mehr.
    expect(m.reasonerSah.length).toBeGreaterThan(0);
    for (const ruf of m.reasonerSah) {
      expect(ruf.methode).toBe("answerRetrievalOnly");
      expect(ruf.frage).toBe(FRAGE);
      expect(ruf.frage.toLowerCase()).not.toContain(MARKE);
      // Auch der Trefferkontext trägt das Wort nicht, das nur in der Passage steht.
      expect(ruf.kontext.toLowerCase()).not.toContain(MARKE);
      expect(ruf.kontext).not.toContain(PASSAGE);
    }

    // (c) KEIN ANTWORTKÖRPER trägt die Passage — und trotzdem hat sie den Treffer gefunden.
    expect(out.result.sources).toContain("ko-b");
    expect(JSON.stringify(out).toLowerCase()).not.toContain(MARKE);
    expect(JSON.stringify(out)).not.toContain(PASSAGE);

    // (d) KEIN PRÜFPROTOKOLL trägt sie. `ask.query` ist metadata-only und bleibt es.
    expect(m.protokoll.length).toBeGreaterThan(0);
    expect(JSON.stringify(m.protokoll).toLowerCase()).not.toContain(MARKE);
    expect(JSON.stringify(m.protokoll)).not.toContain(PASSAGE);
  });

  it("KA5-R3b · auch die WISSENSLÜCKE einer Nicht-Antwort trägt nur die Frage", async () => {
    const m = messplatz({ antwortet: false });
    const out = await m.ask.ask(FRAGE, "nutzer-1", "de", { selection: PASSAGE });
    expect(out.result.answered).toBe(false);
    expect(out.gap).not.toBeNull();
    expect(out.gap?.question).toBe(FRAGE);
    const gespeichert = await m.gaps.all();
    expect(JSON.stringify(gespeichert).toLowerCase()).not.toContain(MARKE);
    expect(JSON.stringify(gespeichert)).not.toContain(PASSAGE);
  });

  it("KA5-R3c · MIT KA4-Freigabe (der Modellweg) gilt derselbe Riegel", async () => {
    // Der externe Zweig von KA5 ist NICHT Teil dieser Runde: die Passage darf ein Modell unter
    // KEINER Bedingung erreichen — auch nicht auf dem Weg, den eine gültige Einwilligung öffnet.
    const m = messplatz();
    await m.ask.ask(FRAGE, "nutzer-1", "de", { gapPolicy: "count_only", selection: PASSAGE });
    expect(m.reasonerSah.map((r) => r.methode)).toEqual(["answer"]);
    expect(m.reasonerSah[0]?.frage).toBe(FRAGE);
    expect(m.reasonerSah[0]?.kontext.toLowerCase()).not.toContain(MARKE);
  });
});

describe("KA5 · die Suchbegriffe: Vorrang, Deckel, keine Dubletten", () => {
  it("KA5-R7 · die Frageterme stehen vorn und vollständig; die Passage hängt sich an", async () => {
    const m = messplatz();
    await m.ask.ask(FRAGE, "nutzer-1", "de", { selection: PASSAGE });
    const frageterme = queryTokens(FRAGE);
    expect(m.abgefragteTerme.slice(0, frageterme.length)).toEqual(frageterme);
    // „Kaltstart" steht in Frage UND Passage — abgefragt wird es genau einmal.
    expect(m.abgefragteTerme.filter((t) => t === "kaltstar")).toHaveLength(1);
    expect(new Set(m.abgefragteTerme).size).toBe(m.abgefragteTerme.length);
  });

  it("KA5-R8 · der Deckel: eine lange Passage sprengt die Lastgrenze der Vorauswahl nicht", async () => {
    // ASK_PREFILTER_MAX_TERMS (8) ist die bestehende Lastgrenze je Frage. Der Deckel der
    // Passagenterme ist derselbe Wert — mehr fragt die Vorauswahl konstruktiv nie ab. Gemessen wird
    // deshalb genau das, was messbar ist: die Zahl der Quellabfragen bleibt die alte.
    const m = messplatz();
    const lang = [
      "Getriebeoeldruck Kupplungsscheibe Nockenwelle Ventilspiel Zahnriemen",
      "Waermetauscher Druckspeicher Schwungscheibe Radlager Bremssattel",
      "Ausgleichsbehaelter Keilriemen Zylinderkopf Steuerkette",
    ].join(" ");
    await m.ask.ask(FRAGE, "nutzer-1", "de", { selection: lang });
    expect(queryTokens(lang).length).toBeGreaterThan(8);
    expect(m.abgefragteTerme.length).toBeLessThanOrEqual(8);
    expect(m.abgefragteTerme.slice(0, queryTokens(FRAGE).length)).toEqual(queryTokens(FRAGE));
  });

  it("KA5-R8b · DIE GRENZE, ausgesprochen: acht Frageterme füllen das Fenster — die Passage wirkt dann nicht", async () => {
    // BENs Prüflücke aus Runde 2, hier als dauerhafte Messung statt als Fußnote. `prefilterCandidates`
    // schneidet die Termliste auf ASK_PREFILTER_MAX_TERMS (8), und die Frage hat Vorrang. Trägt sie
    // selbst schon acht Inhaltstoken, bleibt für die Markierung kein Platz — sie wird gebildet und
    // fällt am Schnitt. Das ist der PREIS des Vorrangs (§5.3 des Auftrags: „Die Frageterme behalten
    // Vorrang"), nicht ein Fehler; wer ihn ändern will, ändert die Lastgrenze und entscheidet das.
    const langeFrage =
      "Welche Spannrolle Portalanlage Kupplungsscheibe Nockenwelle Ventilspiel Zahnriemen Radlager Bremssattel?";
    expect(queryTokens(langeFrage).length).toBeGreaterThanOrEqual(8);
    const ohne = messplatz();
    await ohne.ask.ask(langeFrage, "nutzer-1", "de", {});
    const mit = messplatz();
    await mit.ask.ask(langeFrage, "nutzer-1", "de", { selection: PASSAGE });
    expect(mit.abgefragteTerme).toEqual(ohne.abgefragteTerme);
    expect(mit.abgefragteTerme).not.toContain(MARKE);
    expect(mit.abgefragteTerme).toHaveLength(8);
  });

  it("KA5-R9 · eine Passage ohne Inhaltstoken verhält sich wie ein fehlendes Feld", async () => {
    const ohne = messplatz();
    await ohne.ask.ask(FRAGE, "nutzer-1", "de", {});
    const leer = messplatz();
    await leer.ask.ask(FRAGE, "nutzer-1", "de", { selection: "und der die das ist es an" });
    expect(leer.abgefragteTerme).toEqual(ohne.abgefragteTerme);
    expect(leer.reasonerSah).toEqual(ohne.reasonerSah);
  });
});

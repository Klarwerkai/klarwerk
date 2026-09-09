// ================================================================================================
// JOB 3353 · ASK-C02 — ZUERST MESSEN, DANN REPARIEREN.
// ================================================================================================
//
// DER AUFTRAG kam mit einer These („der Auszug ist leer, weil `invoices` und `invoice` kein
// identisches Token teilen") und mit einer Nachführung, die sie zurücknimmt: „Diagnose ist daher
// OFFEN: zuerst mit dem echten Ask-Pfad MESSEN, welcher Schritt den Hinweis liefert. […] Keine
// Reparatur auf Verdacht." Diese Datei ist genau diese Messung, und sie bleibt danach stehen —
// eine Reparatur, deren Ausgangsbefund nicht mehr nachprüfbar ist, ist eine Behauptung.
//
//   M · DIE MESSUNG    vier Fälle, die jeden Schritt der Kette einzeln befragen. M1 WIDERLEGT die
//                      Ausgangsthese des Auftrags, M2 und M3 benennen die zwei echten Fehler.
//   A · DIE ANTWORT    beide Frageformen, ganze Kette, liefern die Regel mit ihrer Quelle.
//   R · DER RÜCKFALL   was der Deckungsrückfall ausgibt — und was er ab jetzt nie mehr ausgibt.
//   Z · DIE ZWILLINGE  das validierte Paketobjekt überlebt beide Tore und trägt die Antwort.
//
// DER STOFF IST DER ECHTE. Die Absätze stammen wörtlich aus `advisor-ict-en-v1.ts` (Baustein C02
// des Demopakets), der Fiktionshinweis aus derselben Datei; beide werden importiert und nicht
// abgeschrieben, damit eine Änderung am Paket diesen Prüfstand rot macht statt ihn zu überholen.
// Die beiden Frageformen stehen wörtlich so, wie Codex sie live gestellt hat (d1710126 / a2c15bbf).
//
// KEIN MODELLAUFRUF: der Modell-Client ist ein Testdoppel, das mitschreibt, was ihm vorgelegt wird,
// und eine feste Antwort zurückgibt. `KLARWERK_SKIP_KEYCHAIN` schaltet zusätzlich die
// Schlüsselbund-Auflösung ab, damit auf einer Maschine mit hinterlegtem Schlüssel kein echter
// Aufruf über das Ergebnis entscheidet (dieselbe Vorsichtsmaßnahme wie in tests/ask-volltext).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADVISOR_FICTION_NOTICE } from "../../services/app/src/example-packages/advisor-ict-en-v1";
import { ADVISOR_ICT_EN_V1 } from "../../services/app/src/example-packages/advisor-ict-en-v1";
import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { AskService } from "../../services/ask/src/service";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { type KnowledgeRef, type ModelClient, Reasoner } from "../../services/reasoner";
import {
  MIN_ANSWER_SUBSTANCE,
  meetsRelevanceThreshold,
  queryTokens,
  selectCandidates,
} from "../../services/reasoner/src/provider";
import {
  ModelProvider,
  dokumentAuszug,
  pruefeDeckung,
  quellSegmente,
  rueckfallAntwort,
  titelkern,
  waehleKandidaten,
} from "../../services/reasoner/src/provider-model";

const VORGEFUNDEN = process.env.KLARWERK_SKIP_KEYCHAIN;
beforeAll(() => {
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
});
afterAll(() => {
  if (VORGEFUNDEN === undefined) {
    delete process.env.KLARWERK_SKIP_KEYCHAIN;
  } else {
    process.env.KLARWERK_SKIP_KEYCHAIN = VORGEFUNDEN;
  }
});

/** Der Baustein C02 des Demopakets — aus der Paketdefinition, nicht abgeschrieben. */
const C02 = ADVISOR_ICT_EN_V1.items.find((i) => i.key === "C02");
if (!C02) {
  throw new Error("Baustein C02 fehlt in ADVISOR_ICT_EN_V1 — dieser Prüfstand hängt an ihm.");
}
const ABSAETZE = C02.paragraphs;
const REGELSATZ = ABSAETZE[0] as string;
const AUSNAHMESATZ = ABSAETZE[1] as string;

/** Pedis Frage in der Form, in der sie am Freitag gestellt wird (Auftrag §1, wörtlich). */
const FRAGE_LANG =
  "In the fictional Advisor ICT demo data, what is the standard invoice payment period? Answer in English and cite the stored source. If the sources disagree, say so rather than choosing silently.";
/** Dieselbe Sache, kurz gefragt (Codex-Gegenprobe a2c15bbf, wörtlich). */
const FRAGE_KURZ = "What is the standard invoice due date?";

/**
 * Das VALIDIERTE Paketobjekt: `[Beispiel] ` vor dem Titel, die Absätze als Kernaussage
 * (`baselineStatement` = `paragraphs.join("\n\n")`, demo-pakete.ts:133).
 */
function paketobjekt(): KnowledgeRef {
  return {
    id: "paket-c02",
    title: "[Beispiel] Standard invoice due date",
    statement: ABSAETZE.join("\n\n"),
    status: "validiert",
    trust: 90,
    bodyText: ABSAETZE.join(" "),
  };
}

/**
 * Die OFFENE Confluence-Kopie derselben Seite: der Titel trägt die Herkunftsmarke der Demo-Seite,
 * die Kernaussage ist der Fiktionshinweis (Zeile 3 jeder Quelldatei des Pakets), die Regel steht
 * NUR im Dokumenttext. Das ist der Datensatz, den Codex live geöffnet hat (KO cc482eec…, Open).
 */
function confluenceKopie(): KnowledgeRef {
  return {
    id: "conf-c02",
    title: "[DEMO C02] Standard invoice due date",
    statement: ADVISOR_FICTION_NOTICE,
    status: "offen",
    trust: 0,
    bodyText: ABSAETZE.join(" "),
  };
}

/** Zählt VERSCHIEDENE gemeinsame Inhaltstoken zwischen Frage und dem ganzen Match-Text der Quelle. */
function ueberschneidung(frage: string, ref: KnowledgeRef): number {
  const f = new Set(queryTokens(frage));
  return new Set(
    queryTokens(`${ref.title} ${ref.statement} ${ref.bodyText ?? ""}`).filter((w) => f.has(w)),
  ).size;
}

// ================================================================================================
// M · DIE MESSUNG
// ================================================================================================

describe("JOB 3353 M · welcher Schritt liefert den DEMO-Hinweis", () => {
  it("M1 · WIDERLEGT DIE AUSGANGSTHESE: der Auszug ist bei BEIDEN Frageformen gefüllt", () => {
    // Die Zerlegung normalisiert bereits: „invoices" und „invoice" fallen beide auf „invoic".
    expect(queryTokens("invoices")).toEqual(queryTokens("invoice"));
    for (const frage of [FRAGE_LANG, FRAGE_KURZ]) {
      const auszug = dokumentAuszug(frage, confluenceKopie());
      expect(auszug.length).toBeGreaterThan(0);
      expect(auszug.join(" ")).toContain("30 calendar days");
      // Und er ist satzganz: jeder Satz steht wörtlich so im Dokumenttext.
      for (const satz of auszug) {
        expect(ABSAETZE.join(" ")).toContain(satz);
      }
    }
    // Der Auftrag hatte „Auszug leer → Modell sieht nur Titel + Kernaussage" als Ursache benannt.
    // Diese Zeile hält fest, dass das NICHT der Befund ist — die Normalisierung aus Pflicht 2 wird
    // deshalb bewusst nicht gebaut (Nachführung: „nur, wenn die Messung sie trägt").
    expect(dokumentAuszug(FRAGE_LANG, confluenceKopie())).toContain(REGELSATZ);
  });

  it("M2 · DER ERSTE FEHLER: die Rahmenwörter der langen Frage werfen das validierte Objekt heraus", () => {
    const paket = paketobjekt();
    const kopie = confluenceKopie();

    // Die lange Frage: die Kopie misst mehr — und die vier Zusatzpunkte kommen aus dem RAHMEN.
    const langPaket = ueberschneidung(FRAGE_LANG, paket);
    const langKopie = ueberschneidung(FRAGE_LANG, kopie);
    expect(langPaket).toBe(2);
    expect(langKopie).toBe(6);
    // Nachgerechnet, woher der Vorsprung kommt: aus dem Fiktionshinweis, nicht aus der Sache.
    const rahmen = new Set(queryTokens(ADVISOR_FICTION_NOTICE));
    const zusatz = queryTokens(FRAGE_LANG).filter(
      (w) => rahmen.has(w) && !new Set(queryTokens(ABSAETZE.join(" "))).has(w),
    );
    expect(new Set(zusatz)).toEqual(new Set(["fictional", "advisor", "ict"]));
    // Und das ist die Zeile, die das validierte Objekt entfernt (provider.ts `meetsRelevanceThreshold`).
    expect(meetsRelevanceThreshold(langPaket, langKopie)).toBe(false);

    // Die kurze Frage: Gleichstand, beide bleiben — daher die Frageform-Abhängigkeit im Livebefund.
    expect(ueberschneidung(FRAGE_KURZ, paket)).toBe(4);
    expect(ueberschneidung(FRAGE_KURZ, kopie)).toBe(4);
    expect(meetsRelevanceThreshold(4, 4)).toBe(true);
    expect(selectCandidates(FRAGE_KURZ, [paket, kopie], 8, []).map((r) => r.id)).toContain(
      "paket-c02",
    );
    // Der gemessene Ausgangszustand der langen Frage, unverändert festgehalten: `selectCandidates`
    // allein verliert das validierte Objekt. Genau darauf antwortet die Zwillingsregel (Z1).
    expect(selectCandidates(FRAGE_LANG, [paket, kopie], 8, []).map((r) => r.id)).toEqual([
      "conf-c02",
    ]);
  });

  it("M3 · DER ZWEITE FEHLER: die Paraphrase fällt an der Zitatprüfung, der Rückfall gab den Hinweis aus", () => {
    const kopie = confluenceKopie();
    // So antwortet ein Modell, das den Regelsatz im Auszug bekommen hat: es formuliert um.
    const paraphrase =
      "The standard invoice payment period is 30 calendar days after the invoice date [1].";
    expect(pruefeDeckung(paraphrase, [kopie]).gedeckt).toBe(false);
    // Der wörtliche Satz besteht sie — die Prüfung ist also nicht kaputt, sie ist streng (JOB 2659).
    expect(pruefeDeckung(`${REGELSATZ} [1]`, [kopie]).gedeckt).toBe(true);
    // Bis JOB 3353 ging an dieser Stelle `carrying[0].statement` hinaus. Bei der Kopie ist das der
    // Fiktionshinweis — der Livetext der Vorführung, Wort für Wort.
    expect(kopie.statement).toBe(ADVISOR_FICTION_NOTICE);
    expect(kopie.statement).not.toContain("30 calendar days");
  });

  it("M5 · WARUM DER NAHELIEGENDE ZUSATZ NICHT GEBAUT IST: das Maß trennt die beiden Fälle nicht", () => {
    // Die Nachführung verlangt, der Rückfall dürfe „NIE eine Kernaussage als Antwort ausgeben, die
    // die Frage nicht beantwortet". Der naheliegende Weg wäre ein Tor auf dem Fragebezug der
    // Kernaussage. Diese Zahlen zeigen, dass es keines geben kann: der RICHTIGE Rückfall aus JOB
    // 2659 (BENs Pflichtfall G1/H1) und der FALSCHE aus diesem Job liegen beide bei genau 1.
    const bezug = (frage: string, text: string) => {
      const f = new Set(queryTokens(frage));
      return new Set(queryTokens(text).filter((w) => f.has(w))).size;
    };
    expect(
      bezug("Was tun mit Ventil A in Anlage 7?", "Pruefen Sie Ventil A. Schliessen Sie Ventil B."),
    ).toBe(1);
    expect(bezug(FRAGE_LANG, "DEMO notice: content imported for the demonstration.")).toBe(1);
    // Ein Tor bei `MIN_ANSWER_SUBSTANCE` (2) verwürfe also BEIDE — gemessen: 15 bestehende Fälle
    // wurden damit rot. Der Livefall wird deshalb ausschließlich über den Auszug geschlossen (A5).
    expect(MIN_ANSWER_SUBSTANCE).toBe(2);
  });

  it("M4 · KALIBRIERUNG: der Regelsatz steht im Dokumenttext und in keiner Kernaussage der Kopie", () => {
    // Ohne diesen Fall wären M1 und A1 auch dann grün, wenn die Regel zufällig anderswo stünde.
    expect(REGELSATZ).toContain("30 calendar days");
    expect(`${confluenceKopie().title} ${confluenceKopie().statement}`).not.toContain(
      "30 calendar days",
    );
    expect(confluenceKopie().bodyText).toContain(REGELSATZ);
  });
});

// ================================================================================================
// R · DER RÜCKFALL
// ================================================================================================

describe("JOB 3353 R · der Deckungsrückfall sagt nie etwas, das die Frage nicht berührt", () => {
  it("R1 · der Auszug schlägt die Kernaussage: hinaus geht der Satz mit den 30 Kalendertagen", () => {
    const rueckfall = rueckfallAntwort(FRAGE_LANG, [confluenceKopie()]);
    expect(rueckfall?.ref.id).toBe("conf-c02");
    expect(rueckfall?.text).toContain("30 calendar days");
    expect(rueckfall?.text).not.toContain("Fictional demonstration material");
  });

  it("R2 · der Rückfalltext besteht die Zitatprüfung seiner eigenen Quelle", () => {
    // Das ist die tragende Zusage: was der Rückfall ausgibt, ist ein Ausschnitt EINES Segments
    // DERSELBEN Quelle — die Prüfung D4 aus JOB 2659 bleibt unangetastet und wird hier bestanden.
    const kopie = confluenceKopie();
    const rueckfall = rueckfallAntwort(FRAGE_LANG, [kopie]);
    expect(rueckfall).not.toBeNull();
    expect(pruefeDeckung(`${rueckfall?.text} [1]`, [kopie]).gedeckt).toBe(true);
    // …und zwar, weil jeder seiner Sätze ein Segment der Quelle ist.
    expect(quellSegmente(kopie).length).toBeGreaterThan(0);
  });

  it("R3 · ohne Dokumenttext trägt die Kernaussage — unverändert wie seit JOB 2659", () => {
    const ohneKoerper: KnowledgeRef = {
      id: "ohne",
      title: "Standard invoice due date",
      statement: "Standard invoices are due 30 calendar days after the invoice date.",
      status: "validiert",
      trust: 90,
    };
    expect(rueckfallAntwort(FRAGE_LANG, [ohneKoerper])?.text).toBe(ohneKoerper.statement);
  });

  it("R4 · ohne jedes Material wird nichts behauptet — der Rückfall bleibt leer", () => {
    // Bis JOB 3353 ging hier die leere Zeichenkette als BEANTWORTETE Frage hinaus.
    const leerAussage: KnowledgeRef = {
      id: "leer-aussage",
      title: "Standard invoice due date",
      statement: "   ",
      status: "offen",
      trust: 0,
    };
    expect(rueckfallAntwort(FRAGE_LANG, [leerAussage])).toBeNull();
  });

  it("R5 · die Rangfolge zählt: hat die erste tragende Quelle nichts, liefert die zweite", () => {
    const leer: KnowledgeRef = {
      id: "leer",
      title: "Remote work policy",
      statement: "Home office notice.",
      status: "offen",
      trust: 0,
    };
    const rueckfall = rueckfallAntwort(FRAGE_LANG, [leer, confluenceKopie()]);
    expect(rueckfall?.ref.id).toBe("conf-c02");
    expect(rueckfall?.text).toContain("30 calendar days");
  });

  it("R6 · der Deckel aus JOB 3298 gilt weiter: der Rückfalltext ist nie länger als der Auszug", () => {
    const lang: KnowledgeRef = {
      ...confluenceKopie(),
      bodyText: Array.from({ length: 40 }, () => REGELSATZ).join(" "),
    };
    const rueckfall = rueckfallAntwort(FRAGE_LANG, [lang]);
    expect(rueckfall?.text).toBe(dokumentAuszug(FRAGE_LANG, lang).join(" "));
    expect((rueckfall?.text ?? "").length).toBeLessThanOrEqual(600);
  });
});

// ================================================================================================
// Z · DIE ZWILLINGE
// ================================================================================================

describe("JOB 3353 Z · das validierte Paketobjekt geht nicht still verloren", () => {
  it("Z1 · Tor 2: die lange Frage behält beide Kandidaten, das validierte vorn", () => {
    const gewaehlt = waehleKandidaten(FRAGE_LANG, [paketobjekt(), confluenceKopie()], 8, []);
    expect(gewaehlt.map((r) => r.id)).toEqual(["paket-c02", "conf-c02"]);
  });

  it("Z2 · die Zwillingsregel holt KEINEN neuen Titel herein", () => {
    const fremd: KnowledgeRef = {
      id: "fremd",
      title: "[Beispiel] Remote work policy",
      statement: "Remote work is agreed individually.",
      status: "validiert",
      trust: 90,
    };
    const gewaehlt = waehleKandidaten(FRAGE_LANG, [paketobjekt(), confluenceKopie(), fremd], 8, []);
    expect(gewaehlt.map((r) => r.id)).not.toContain("fremd");
  });

  it("Z3 · ohne Zwilling ändert die Regel die Auswahl um kein Zeichen", () => {
    const nurKopie = [confluenceKopie()];
    expect(waehleKandidaten(FRAGE_LANG, nurKopie, 8, [])).toEqual(
      selectCandidates(FRAGE_LANG, nurKopie, 8, []),
    );
    const kurz = [paketobjekt(), confluenceKopie()];
    // Bei der kurzen Frage wählt `selectCandidates` schon beide; die Regel ordnet nur noch.
    expect(new Set(waehleKandidaten(FRAGE_KURZ, kurz, 8, []).map((r) => r.id))).toEqual(
      new Set(selectCandidates(FRAGE_KURZ, kurz, 8, []).map((r) => r.id)),
    );
  });

  it("Z4 · NUR belegte Herkunftsmarken fallen weg — fachliche Präfixe bleiben Teil des Titels", () => {
    // Codex 6338b57f, Befund 1: Runde 1 entfernte JEDE führende Klammergruppe. Diese Fälle sind
    // die Grenze, die das verhindert.
    expect(titelkern("[Beispiel] Standard invoice due date")).toBe(
      titelkern("[DEMO C02] Standard invoice due date"),
    );
    // Geltungsbereich ist KEINE Herkunft: die beiden bleiben verschieden.
    expect(titelkern("[NL] Invoice due date")).not.toBe(titelkern("[DE] Invoice due date"));
    expect(titelkern("[Router A] Reset")).not.toBe(titelkern("[Router B] Reset"));
    // …und keiner von beiden fällt versehentlich mit dem markenlosen Titel zusammen.
    expect(titelkern("[NL] Invoice due date")).not.toBe(titelkern("Invoice due date"));
    // Eine zweite Klammer nach der Marke bleibt stehen — es fällt höchstens EINE.
    expect(titelkern("[DEMO] [NL] Invoice due date")).toBe("[nl] invoice due date");
    expect(titelkern("Titel mit [Klammer] mittendrin")).toBe("titel mit [klammer] mittendrin");
  });

  it("Z6 · ein sachfremder validierter Stand wird NICHT vorgereiht (Tor 2, echter Weg)", async () => {
    // Der Schaden, den Codex an der zu breiten Normalisierung benannt hat: „[NL] …" dürfte sich
    // nicht vor „[DE] …" schieben. Gemessen an der Kandidatenwahl selbst.
    const nl: KnowledgeRef = {
      id: "nl",
      title: "[NL] Standard invoice due date",
      statement: "Standaardfacturen zijn 60 kalenderdagen na de factuurdatum verschuldigd.",
      status: "validiert",
      trust: 90,
      bodyText: "Standaardfacturen zijn 60 kalenderdagen na de factuurdatum verschuldigd.",
    };
    const gewaehlt = waehleKandidaten(FRAGE_LANG, [confluenceKopie(), nl], 8, []);
    // Die niederländische Fassung ist kein Zwilling der Demo-Seite: sie wird nicht davorgezogen.
    expect(gewaehlt[0]?.id).toBe("conf-c02");
  });
});

// ================================================================================================
// A · DIE ANTWORT — DIE GANZE KETTE, BEIDE FRAGEFORMEN
// ================================================================================================

/** Ein Modell-Client, der mitschreibt, was ihm vorgelegt wurde, und eine feste Antwort gibt. */
function mitschreiber(antwort: string): { client: ModelClient; prompts: () => string[] } {
  const prompts: string[] = [];
  return {
    client: {
      name: "mitschreiber",
      complete: async (_system: string, user: string) => {
        prompts.push(user);
        return antwort;
      },
    },
    prompts: () => prompts,
  };
}

/**
 * Der Bestand der Vorführung über die ECHTEN Dienste: das freigegebene Paketobjekt und die offene
 * Confluence-Kopie derselben Seite, beide über den Produktpfad angelegt, mit aktiver
 * Suchprojektion. Einziges Testdoppel ist der Modell-Client.
 */
async function aufbauen(
  antwort: string,
  opts: {
    ohnePaketobjekt?: boolean;
    /**
     * JOB 3353 R4 (BEN-Prüflücke 6): die Absätze der Confluence-Kopie, wenn sie vom freigegebenen
     * Stand ABWEICHEN sollen. Ohne Angabe tragen beide denselben Text — der Normalfall.
     */
    kopieAbsaetze?: readonly string[];
  } = {},
) {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  const paket = await koService.create({
    title: "[Beispiel] Standard invoice due date",
    statement: ABSAETZE.join("\n\n"),
    bodyHtml: ABSAETZE.map((a) => `<p>${a}</p>`).join(""),
    type: "best_practice",
    category: "Commercial",
    author: "anna",
  });
  await koService.setValidationState(paket.id, { trust: 90, status: "validiert" });
  if (opts.ohnePaketobjekt) {
    // Der Bestand OHNE freigegebenen Zwilling: nur die importierte Seite. Das ist der Normalfall
    // für die 30 Confluence-Seiten, die am Freitag KEIN Paketobjekt neben sich haben — und der
    // einzige Aufbau, in dem der Deckungsrückfall wirklich zur Antwort wird.
    await koService.delete(paket.id, "anna", { hard: true });
  }
  const kopieAbsaetze = opts.kopieAbsaetze ?? ABSAETZE;
  const kopie = await koService.create({
    title: "[DEMO C02] Standard invoice due date",
    statement: ADVISOR_FICTION_NOTICE,
    bodyHtml: kopieAbsaetze.map((a) => `<p>${a}</p>`).join(""),
    type: "best_practice",
    category: "Commercial",
    author: "bea",
  });
  const { client, prompts } = mitschreiber(antwort);
  const ask = new AskService({
    reasoner: new Reasoner(new ModelProvider(client)),
    koService,
    gaps: new InMemoryGapRepo(),
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
  });
  return { ask, paket, kopie, prompts };
}

/** So antwortet ein Modell, das den Regelsatz im Auszug bekommen hat: es formuliert um (M3). */
const PARAPHRASE =
  "The standard invoice payment period is 30 calendar days after the invoice date [1].";

describe("JOB 3353 A · dieselbe Regel, gleich wie gefragt wird", () => {
  for (const [name, frage] of [
    ["lang", FRAGE_LANG],
    ["kurz", FRAGE_KURZ],
  ] as const) {
    it(`A1/${name} · die Antwort nennt „30 calendar days" und belegt sie mit dem validierten Objekt`, async () => {
      const { ask, paket, prompts } = await aufbauen(PARAPHRASE);
      const antwort = await ask.ask(frage, "anna", "en");
      // Das Modell hat den Regelsatz WIRKLICH gesehen — sonst wäre die Antwort unten Zufall.
      expect(prompts()).toHaveLength(1);
      expect(prompts()[0] ?? "").toContain("30 calendar days");
      expect(antwort.result.answered).toBe(true);
      expect(antwort.result.answer).toContain("30 calendar days");
      // Der Fiktionshinweis ist keine Antwort — und geht ab jetzt auch nicht mehr als eine hinaus.
      expect(antwort.result.answer).not.toContain("Fictional demonstration material");
      // Pflicht 4: das validierte Paketobjekt trägt die Antwort, der Vertrauenswert ist echt.
      expect(antwort.result.citedSources).toEqual([paket.id]);
      expect(antwort.result.sources).toContain(paket.id);
      expect(antwort.result.trust).toBeGreaterThan(0);
    });
  }

  it("A2 · die Confluence-Kopie bleibt als zweite Quelle sichtbar (Widerspruch bleibt sagbar)", async () => {
    // Pedis Frage verlangt „If the sources disagree, say so rather than choosing silently" — das
    // geht nur, solange BEIDE Stände im Kontext stehen. Die Zwillingsregel ordnet, sie verschweigt
    // nicht.
    const { ask, paket, kopie, prompts } = await aufbauen(PARAPHRASE);
    const antwort = await ask.ask(FRAGE_LANG, "anna", "en");
    expect(antwort.result.sources).toEqual(expect.arrayContaining([paket.id, kopie.id]));
    const prompt = prompts()[0] ?? "";
    expect(prompt).toContain("[1]");
    expect(prompt).toContain("[2]");
  });

  // ----------------------------------------------------------------------------------------------
  // A8 · ZWEI ABWEICHENDE FRISTEN — was die Kette DURCHREICHT (BEN-Prüflücke 6, R3)
  // ----------------------------------------------------------------------------------------------
  //
  // BEN wörtlich: „fehlt in den neuen C02-Fällen eine tatsächliche Konfliktantwort bei
  // unterschiedlichen Fristen; A2 belegt lediglich beide Quellen im Kontext." Der Bestand steht hier
  // deshalb mit ZWEI VERSCHIEDENEN Fristen: der freigegebene Stand sagt 30, die Confluence-Kopie 45.
  //
  // WAS A8 BELEGT UND WAS NICHT — die Grenze gehört an den Fall, nicht in die Rückgabe allein:
  //  · BELEGT: beide Fristen liegen dem Modell wirklich vor, und eine Antwort, die beide MIT MARKE
  //    nennt, geht unverändert hinaus, mit beiden Quellen als Beleg. Die Kette unterschlägt den
  //    Widerspruch also nicht auf dem Weg nach draussen.
  //  · NICHT BELEGT: dass das Produkt den Widerspruch von sich aus ERKENNT oder AUSSPRICHT. Die
  //    Modellantwort ist hier VORGEGEBEN (Testdoppel); dieser Fall misst das Durchreichen, keine
  //    Konflikterkennung.
  //
  // DER OFFENE REST, gemessen und NICHT hier festgeschrieben: sagt das Modell stattdessen einen
  // freien Satz ÜBER die Quellen („The sources disagree …"), verwirft ihn die Zitatprüfung
  // (`pruefeDeckung`, provider-model.ts:361ff — ein Nachlauf ohne Marke ist von keiner Quelle
  // gedeckt), und der Rückfall nennt still nur die 30 Tage. Damit ist die Zusage aus AUFTRAG §5.3
  // („If the sources disagree, say so rather than choosing silently") NICHT erfüllt. Das ist ein
  // BEFUND, kein Verhalten, das dieser Test grün festhalten darf — er gehört als roter Fall in den
  // Folgeauftrag JOB 3365 (ASK-C02-KONFLIKT), zusammen mit der Entscheidung, wie ein solcher Satz
  // belegbar wird. Deshalb steht er hier als Notiz und nicht als Zusicherung.
  const KOPIE_45 = [
    "Standard invoices are due 45 calendar days after the invoice date.",
    ...ABSAETZE.slice(1),
  ];

  it("A8 · zwei abweichende Fristen: beide liegen dem Modell vor, und beide belegten Sätze gehen unverändert hinaus", async () => {
    const zweiSeiten = `${REGELSATZ} [1] Standard invoices are due 45 calendar days after the invoice date. [2]`;
    const { ask, paket, kopie, prompts } = await aufbauen(zweiSeiten, { kopieAbsaetze: KOPIE_45 });
    const antwort = await ask.ask(FRAGE_LANG, "anna", "en");

    // 1. Das Modell hat den Widerspruch WIRKLICH vorliegen — sonst wäre alles Weitere Zufall.
    const prompt = prompts()[0] ?? "";
    expect(prompt).toContain("30 calendar days");
    expect(prompt).toContain("45 calendar days");
    // 2. Der Text geht unverändert hinaus, mit beiden Fristen — nichts wird auf dem Weg gekürzt.
    expect(antwort.result.answered).toBe(true);
    expect(antwort.result.answer).toBe(zweiSeiten);
    expect(antwort.result.answer).toContain("30 calendar days");
    expect(antwort.result.answer).toContain("45 calendar days");
    // 3. Und beide Stände sind als Beleg genannt, der freigegebene vorn (Zwillingsregel).
    expect(antwort.result.citedSources).toEqual(expect.arrayContaining([paket.id, kopie.id]));
  });

  it("A3 · antwortet das Modell wörtlich, geht sein Text unverändert hinaus", async () => {
    // Gegenprobe zum Rückfall: er ist ein RÜCKFALL, kein neuer Regelweg. Wo die Deckung hält,
    // ändert dieser Auftrag nichts.
    const { ask } = await aufbauen(`${REGELSATZ} [1]`);
    const antwort = await ask.ask(FRAGE_LANG, "anna", "en");
    expect(antwort.result.answer).toBe(`${REGELSATZ} [1]`);
  });

  it("A7 · TOR 1 am echten Weg: der validierte Zwilling kommt zurück, der sachfremde NICHT", async () => {
    // DAS IST DER NACHWEIS FÜR TOR 1 (Codex 6338b57f, Befund 2). Runde 1 belegte ihn mit einem
    // Vergleich zweier Kopien IM TEST; das misst nicht das Produkt. Hier läuft der echte
    // `AskService`, und im Bestand liegt NEBEN dem Paketobjekt und der Confluence-Kopie ein
    // freigegebenes Objekt mit demselben Resttitel, aber anderem GELTUNGSBEREICH („[NL] …").
    // Es darf NICHT als Zwilling mitkommen — sonst stünde eine niederländische Frist in Pedis
    // englischer Antwort.
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    await koService.activateSearchProjectionV2();
    const paket = await koService.create({
      title: "[Beispiel] Standard invoice due date",
      statement: ABSAETZE.join("\n\n"),
      bodyHtml: ABSAETZE.map((a) => `<p>${a}</p>`).join(""),
      type: "best_practice",
      category: "Commercial",
      author: "anna",
    });
    await koService.setValidationState(paket.id, { trust: 90, status: "validiert" });
    await koService.create({
      title: "[DEMO C02] Standard invoice due date",
      statement: ADVISOR_FICTION_NOTICE,
      bodyHtml: ABSAETZE.map((a) => `<p>${a}</p>`).join(""),
      type: "best_practice",
      category: "Commercial",
      author: "bea",
    });
    const nl = await koService.create({
      title: "[NL] Standard invoice due date",
      statement: "Standard invoices are due 60 calendar days after the invoice date.",
      type: "best_practice",
      category: "Commercial",
      author: "cem",
    });
    await koService.setValidationState(nl.id, { trust: 90, status: "validiert" });

    const { client, prompts } = mitschreiber(PARAPHRASE);
    const ask = new AskService({
      reasoner: new Reasoner(new ModelProvider(client)),
      koService,
      gaps: new InMemoryGapRepo(),
      audit: new AuditService({ repo: new InMemoryAuditRepo() }),
    });
    const antwort = await ask.ask(FRAGE_LANG, "anna", "en");
    // Der echte Zwilling ist da und trägt die Antwort …
    expect(antwort.result.citedSources).toEqual([paket.id]);
    // … der sachfremde Stand ist weder Quelle noch im Prompt.
    expect(antwort.result.sources).not.toContain(nl.id);
    expect(prompts()[0] ?? "").not.toContain("60 calendar days");
  });

  it("A5 · OHNE validierten Zwilling: die Confluence-Kopie antwortet mit ihrem Regelsatz, nicht mit dem Hinweis", async () => {
    // DER LIVEFALL, isoliert. Nur die importierte Seite ist da; ihre Kernaussage ist der
    // Fiktionshinweis, die Regel steht im Fließtext, und das Modell paraphrasiert. Bis JOB 3353
    // ging hier `carrying[0].statement` hinaus — also der Hinweis, mit `answered: true`.
    for (const frage of [FRAGE_LANG, FRAGE_KURZ]) {
      const { ask, kopie, prompts } = await aufbauen(PARAPHRASE, { ohnePaketobjekt: true });
      const antwort = await ask.ask(frage, "anna", "en");
      expect(prompts()[0] ?? "").toContain("30 calendar days");
      expect(antwort.result.answered).toBe(true);
      expect(antwort.result.answer).toContain("30 calendar days");
      expect(antwort.result.answer).not.toContain("Fictional demonstration material");
      expect(antwort.result.citedSources).toEqual([kopie.id]);
    }
  });

  it("A6 · BENANNTE PRÜFLÜCKE: ohne Dokumenttext geht der Hinweis weiterhin hinaus", async () => {
    // EHRLICH FESTGEHALTEN, nicht verschwiegen (Auftrag §Nachführung, zweiter Spiegelstrich). Trägt
    // eine Quelle KEINEN Dokumenttext und ist ihre Kernaussage ein reiner Herkunftshinweis, dann
    // gewinnt Schritt 2 des Rückfalls und der Hinweis geht als Antwort hinaus. Warum das so bleibt,
    // rechnet M5 vor: das einzige Maß, das dieses Haus hat, trennt diesen Fall nicht von BENs
    // Pflichtfällen aus JOB 2659. Dieser Fall ist die MESSUNG der Lücke — wird sie geschlossen,
    // wird er rot und ist dann nachzuführen.
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    await koService.activateSearchProjectionV2();
    await koService.create({
      title: "Standard invoice due date",
      statement: "DEMO notice: content imported for the demonstration.",
      type: "best_practice",
      category: "Commercial",
      author: "anna",
    });
    const { client, prompts } = mitschreiber(PARAPHRASE);
    const ask = new AskService({
      reasoner: new Reasoner(new ModelProvider(client)),
      koService,
      gaps: new InMemoryGapRepo(),
      audit: new AuditService({ repo: new InMemoryAuditRepo() }),
    });
    const antwort = await ask.ask(FRAGE_LANG, "anna", "en");
    expect(prompts()).toHaveLength(1); // das Modell WURDE befragt — der Fall ist nicht leer
    expect(antwort.result.answer).toBe("DEMO notice: content imported for the demonstration.");
    // Der Livefall der Vorführung ist ein ANDERER: dort trägt die Seite ihren Dokumenttext, und
    // dann gewinnt der Auszug (A5). Diese Zeile hält den Unterschied fest.
    expect(confluenceKopie().bodyText).toBeTruthy();
  });

  it("A4 · der Auszug der langen Frage bleibt auf die Sache begrenzt", () => {
    // Die Anweisungssätze („Answer in English…", „If the sources disagree…") holen keinen
    // zusätzlichen Satz in den Auszug: gewählt wird, was zur Sache gehört.
    expect(dokumentAuszug(FRAGE_LANG, confluenceKopie())).toEqual([REGELSATZ]);
    // Die kurze Frage trifft mehr Sätze — inklusive der kundenbezogenen Ausnahme.
    expect(dokumentAuszug(FRAGE_KURZ, confluenceKopie())).toContain(AUSNAHMESATZ);
  });
});

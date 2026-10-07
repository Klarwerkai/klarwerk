import { describe, expect, it } from "vitest";
import {
  AskService,
  InMemoryAnswerSnapshotRepo,
  InMemoryGapRepo,
  redactGapForViewer,
} from "../../services/ask";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";

// ================================================================================================
// R-0595 (DS15) und R-0585 (DS6) — DIE NACHMESSUNG, DIE NIE GEMACHT WURDE
// ================================================================================================
//
// R-0595: „Ob die Antwort-Tabelle den Fragetext doch mitführt, ist noch nicht nachgemessen."
// R-0585: „Offen ist, wie viele Nutzdaten das Prüfprotokoll je Aktion mitführt."
//
// GEMESSEN WIRD AM ABLAGEINHALT, NICHT AM TYP. Die Typen `AnswerRecord`/`AnswerEvidenceSnapshot`
// kennen kein Fragefeld — das sagt nichts darüber, was der Schreibweg zur Laufzeit hineinlegt.
// Deshalb läuft hier ein echter Antwortlauf mit einer Frage aus unverwechselbaren Wörtern, und
// danach wird JEDE Ablage, die der Lauf beschrieben hat, als Text nach diesen Wörtern durchsucht.
//
// DIE GRENZE STEHT AUSDRÜCKLICH MIT DRIN: eine UNBEANTWORTETE Frage wird zur Wissenslücke, und die
// Lücke trägt den Fragetext — das ist ihr Zweck (jemand soll sie schließen). Sie ist kein Protokoll
// der Anfrage; ihre Sichtbarkeit regelt `redactGapForViewer`.

const FRAGE = "Darf Brandauer den Resturlaub im Projekt Kranichsee buchen?";
const MERKWOERTER = ["Brandauer", "Resturlaub", "Kranichsee"];
const ANTWORT = "Zollwertnachweis wird quartalsweise eingereicht.";

// Der Inhalt des Prüfprotokolls je Frage — das Inventar aus
// docs/datenschutz/pruefprotokoll-nutzdaten.md, hier als Gegenmutation festgehalten: ein neues Feld
// in `ask.query` fällt hier auf, statt still mitzulaufen.
const ASK_QUERY_FELDER = [
  "answered",
  "candidateCount",
  "prefilterCount",
  "prefilterQueries",
  "prefilterTermLimit",
  "retrievalMode",
  "topK",
];

function reasoner(beantwortet: boolean) {
  return {
    answer: async () => ({
      answered: beantwortet,
      answer: beantwortet ? ANTWORT : "",
      sources: beantwortet ? ["ko-a", "ko-b"] : [],
      citedSources: beantwortet ? ["ko-a"] : [],
      knowledgeClass: "validiert" as const,
    }),
  } as unknown as ConstructorParameters<typeof AskService>[0]["reasoner"];
}

async function aufbau(beantwortet: boolean) {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  const snapshots = new InMemoryAnswerSnapshotRepo();
  const gaps = new InMemoryGapRepo();
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  let n = 0;
  const dienst = new AskService({
    reasoner: reasoner(beantwortet),
    koService,
    gaps,
    audit,
    answerSnapshots: snapshots,
    now: () => 1_754_121_600_000,
    genId: () => `id-${++n}`,
  });
  return { dienst, snapshots, gaps, audit };
}

/** Alles, was der Antwortlauf in Beleg und Prüfprotokoll abgelegt hat, als ein Text. */
async function abgelegt(
  answerId: string | null,
  snapshots: InMemoryAnswerSnapshotRepo,
  audit: AuditService,
): Promise<string> {
  if (!answerId) {
    throw new Error("der Lauf hat keinen Antwortbeleg geschrieben — die Messung wäre leer");
  }
  const record = await snapshots.findRecord(answerId);
  const revisionen = await snapshots.listSnapshots(answerId);
  expect(record, "Antwortbeleg fehlt").toBeDefined();
  expect(revisionen.length).toBeGreaterThan(0);
  return JSON.stringify({ record, revisionen, audit: await audit.list() });
}

describe("R-0595 · der Antwortbeleg führt weder Frage- noch Antworttext", () => {
  it("beantwortete Frage: kein Merkwort in Antwortbeleg, Snapshot oder Prüfprotokoll", async () => {
    const { dienst, snapshots, audit } = await aufbau(true);
    const ergebnis = await dienst.ask(FRAGE, "anna", "de");
    const text = await abgelegt(ergebnis.answerId, snapshots, audit);
    for (const wort of MERKWOERTER) {
      expect(text, `„${wort}“ steht in der Ablage`).not.toContain(wort);
    }
    expect(text).not.toContain("Zollwertnachweis");
    // Kalibrierung: festgehalten ist, welches geprüfte Wissen getragen hat — sonst wäre die
    // Abwesenheit oben bloß eine leere Ablage.
    expect(text).toContain("ko-a");
    expect(text).toContain('"evidenceRole":"carrying"');
  });

  it("unbeantwortete Frage: Beleg und Protokoll bleiben frei — NUR die Wissenslücke trägt den Text", async () => {
    const { dienst, snapshots, gaps, audit } = await aufbau(false);
    const ergebnis = await dienst.ask(FRAGE, "anna", "de");
    const text = await abgelegt(ergebnis.answerId, snapshots, audit);
    for (const wort of MERKWOERTER) {
      expect(text, `„${wort}“ steht in der Ablage`).not.toContain(wort);
    }
    const luecken = await gaps.all();
    expect(luecken).toHaveLength(1);
    expect(luecken[0]?.question).toBe(FRAGE);
  });
});

describe("R-0585 · Fragetext nur für Fragende und Zuständige, Prüfprotokoll ohne Fragetext", () => {
  it("das Prüfprotokoll trägt je Frage genau die inventarisierten Zählfelder", async () => {
    const { dienst, audit } = await aufbau(true);
    await dienst.ask(FRAGE, "anna", "de");
    const eintraege = await audit.list({ action: "ask.query" });
    expect(eintraege).toHaveLength(1);
    expect(Object.keys(eintraege[0]?.payload ?? {}).sort()).toEqual(ASK_QUERY_FELDER);
    for (const wert of Object.values(eintraege[0]?.payload ?? {})) {
      expect(["number", "boolean", "string"]).toContain(typeof wert);
    }
    expect(eintraege[0]?.payload.retrievalMode).toBe("prefilter");
  });

  it("die Wissenslücke: Fragende und Zuständige sehen den Text, alle anderen nicht", async () => {
    const { dienst, gaps, audit } = await aufbau(false);
    await dienst.ask(FRAGE, "anna", "de");
    const [luecke] = await gaps.all();
    if (!luecke) {
      throw new Error("keine Wissenslücke angelegt");
    }
    const zugewiesen = { ...luecke, assignee: "bert" };
    // Kein Rollenrecht mehr im Kontext (R-0585): Prüfrollen ohne Zuständigkeit misst
    // services/app/src/ask-routes.test.ts am echten /api/gaps, die Glocke
    // tests/app/notifications-gap-redaction.test.ts.
    const sicht = (viewerId: string) => redactGapForViewer(zugewiesen, { viewerId });
    expect(sicht("anna").question).toBe(FRAGE);
    expect(sicht("bert").question).toBe(FRAGE);
    expect(sicht("carla").question).toBe("");
    expect(sicht("carla").redacted).toBe(true);
    // Das gap.created-Protokoll trägt keinen Text — nur die Kennung der Lücke als Ziel.
    const angelegt = await audit.list({ action: "gap.created" });
    expect(angelegt).toHaveLength(1);
    expect(angelegt[0]?.target).toBe(luecke.id);
    expect(angelegt[0]?.payload).toEqual({});
  });
});

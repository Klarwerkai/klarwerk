// ================================================================================================
// JOB 541 D3 — DER SCHREIBWEG BINDET DIE FASSUNG UND DIE ENTSCHEIDUNG. BEIDE GAB ES SCHON.
// ================================================================================================
//
// DER BEFUND, den D2 gemessen und BEN bestaetigt hat: Der produktive Schreibweg setzte
// `knowledgeObjectVersion` HART auf `null` und begruendete das mit `w3c_no_decision_carrier` —
// „es gibt keinen Traeger von der Entscheidung zur Antwort".
//
// BEIDES IST UEBERHOLT, und zwar an zwei belegbaren Stellen im Bestand:
//
//   · Die FASSUNG lag die ganze Zeit in der Hand des Antwortlaufs. `prefiltered` enthaelt die
//     wirklich herangezogenen `KnowledgeObject`s samt `version` — der Schreibweg hat sie nur nie
//     mitgeschrieben. Sie zu binden ist KEINE Neusuche (die waere nach KW-W3-18 verboten), sondern
//     das Aufschreiben dessen, was der Lauf ohnehin in der Hand hielt.
//   · Der TRAEGER existiert: `KnowledgeObject.validationDecisionRef`
//     (`services/knowledge-object/src/types.ts`), geschrieben von `setValidationDecisionRef`.
//
// Damit faellt der Grund `w3c_no_decision_carrier` fuer NEUE Snapshots weg. An seine Stelle tritt
// die per-Evidence-Antwort aus KW-W3-23: entweder die Referenz des Objekts oder ein
// maschinenlesbarer Abwesenheitsgrund — je Evidence, nie oben.
import { describe, expect, it } from "vitest";
import { InMemoryKoRepo, KoService } from "../../knowledge-object";
import { InMemoryAnswerSnapshotRepo } from "./repo";
import { AskService } from "./service";

/**
 * Ein Reasoner, der die Kandidaten ZURUECKGIBT, die er bekommen hat.
 *
 * Der Bestandsaufbau in `snapshot-verdrahtung-76.test.ts` liefert feste Fantasie-Ids; fuer die
 * Fassungsbindung waere er blind, weil zu diesen Ids kein Objekt existiert. Hier soll gerade
 * gemessen werden, dass die Fassung des TATSAECHLICH herangezogenen Objekts gebunden wird — also
 * muessen die Quellen echte Objekte sein.
 */
function reasonerAusKandidaten(tragend: (ids: string[]) => string[]) {
  return {
    answer: async (_frage: string, kandidaten: { id: string }[]) => {
      const ids = kandidaten.map((k) => k.id);
      return {
        answered: true,
        answer: "Alle 500 Stunden schmieren.",
        sources: ids,
        citedSources: tragend(ids),
        knowledgeClass: "validiert" as const,
      };
    },
  } as unknown as ConstructorParameters<typeof AskService>[0]["reasoner"];
}

async function koDienst(): Promise<KoService> {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  return koService;
}

async function aufbau(tragend: (ids: string[]) => string[]) {
  const snapshots = new InMemoryAnswerSnapshotRepo();
  const koService = await koDienst();
  let n = 0;
  const dienst = new AskService({
    reasoner: reasonerAusKandidaten(tragend),
    koService,
    gaps: {
      insert: async () => {},
      findById: async () => undefined,
      update: async () => {},
      delete: async () => {},
      all: async () => [],
    },
    now: () => 1_754_121_600_000,
    genId: () => `id-${++n}`,
    answerSnapshots: snapshots,
  });
  return { dienst, snapshots, koService };
}

/**
 * Die Frage und die Objekte folgen dem BEWAEHRTEN Muster des Bestandstests
 * (`service.test.ts`): die Auswahl hat ein Relevanzgatter, und ein einzelnes gemeinsames Wort
 * kommt nicht durch. Das ist Produktverhalten und wird hier bedient, nicht umgangen.
 */
const FRAGE = "Was tun bei Ueberdruck am Ventil?";

async function legeKoAn(koService: KoService, zusatz: string) {
  return koService.create({
    title: `Ventil bei Ueberdruck ${zusatz}`,
    statement: `Bei Ueberdruck Ventil ${zusatz} manuell schliessen.`,
    type: "best_practice",
    category: "Anlage 1",
    author: "anna",
  });
}

describe("JOB 541 D3 · die KO-Fassung wird zum Ausfuehrungszeitpunkt gebunden", () => {
  it("die Evidence traegt die ECHTE Version des herangezogenen Objekts — nicht null und nicht 0", async () => {
    const { dienst, snapshots, koService } = await aufbau((ids) => ids.slice(0, 1));
    const ko = await legeKoAn(koService, "X");
    expect(ko.version).toBeGreaterThan(0);

    const lauf = await dienst.ask(FRAGE, "anna", "de");
    expect(lauf.answerId).not.toBeNull();
    const snapshot = await snapshots.latestSnapshot(String(lauf.answerId));
    const evidenz = snapshot?.evidence.find((e) => e.knowledgeObjectId === ko.id);

    expect(evidenz, "das herangezogene Objekt fehlt im Beleg").toBeDefined();
    expect(evidenz?.knowledgeObjectVersion).toBe(ko.version);
    expect(evidenz?.knowledgeObjectVersion).not.toBeNull();
    expect(evidenz?.knowledgeObjectVersion).not.toBe(0);
  });

  it("nach einer Revision bindet ein NEUER Lauf die NEUE Fassung — der alte Beleg bleibt stehen", async () => {
    const { dienst, snapshots, koService } = await aufbau((ids) => ids.slice(0, 1));
    const ko = await legeKoAn(koService, "X");

    const ersterLauf = await dienst.ask(FRAGE, "anna", "de");
    const ersterBeleg = await snapshots.latestSnapshot(String(ersterLauf.answerId));
    const alteFassung = ersterBeleg?.evidence.at(0)?.knowledgeObjectVersion;

    const revidiert = await koService.revise(
      ko.id,
      { statement: "Bei Ueberdruck Ventil X sofort manuell schliessen." },
      "bob",
    );
    expect(revidiert.version).toBeGreaterThan(ko.version);

    const zweiterLauf = await dienst.ask(FRAGE, "anna", "de");
    const zweiterBeleg = await snapshots.latestSnapshot(String(zweiterLauf.answerId));
    expect(zweiterBeleg?.evidence.at(0)?.knowledgeObjectVersion).toBe(revidiert.version);
    // Der historische Beleg wird NICHT nachgezogen — das ist der Kern von KW-W3-18.
    const nochmal = await snapshots.latestSnapshot(String(ersterLauf.answerId));
    expect(nochmal?.evidence.at(0)?.knowledgeObjectVersion).toBe(alteFassung);
  });
});

describe("JOB 541 D3 · die Validierungsentscheidung wird je Evidence gebunden", () => {
  it("traegt das Objekt eine Entscheidung, steht sie AN DIESER Evidence", async () => {
    const { dienst, snapshots, koService } = await aufbau((ids) => ids.slice(0, 1));
    const ko = await legeKoAn(koService, "X");
    await koService.setValidationDecisionRef(ko.id, { auditSeq: 42, auditHash: "hash-42" });

    const lauf = await dienst.ask(FRAGE, "anna", "de");
    const snapshot = await snapshots.latestSnapshot(String(lauf.answerId));
    const evidenz = snapshot?.evidence.find((e) => e.knowledgeObjectId === ko.id);

    expect(evidenz?.validationDecisionRef).toEqual({ auditSeq: 42, auditHash: "hash-42" });
    expect(evidenz?.validationReferenceAbsenceReason).toBeUndefined();
    // KW-W3-23 §3: neue Snapshots schreiben oben NICHTS mehr.
    expect(snapshot?.validationDecisionRef).toBeNull();
  });

  it("ohne Entscheidung traegt eine TRAGENDE Evidence NOT_AVAILABLE_AT_EXECUTION", async () => {
    const { dienst, snapshots, koService } = await aufbau((ids) => ids.slice(0, 1));
    const ko = await legeKoAn(koService, "X");

    const lauf = await dienst.ask(FRAGE, "anna", "de");
    const snapshot = await snapshots.latestSnapshot(String(lauf.answerId));
    const evidenz = snapshot?.evidence.find((e) => e.knowledgeObjectId === ko.id);

    expect(evidenz?.validationDecisionRef).toBeUndefined();
    expect(evidenz?.validationReferenceAbsenceReason).toBe("NOT_AVAILABLE_AT_EXECUTION");
    // Der ueberholte Grund darf an einem NEUEN Snapshot nicht mehr auftauchen.
    expect(snapshot?.validationDecisionRefReason).not.toBe("w3c_no_decision_carrier");
  });

  it("eine ERGAENZENDE Evidence ohne Entscheidung traegt NOT_REQUIRED", async () => {
    // Nur das erste Objekt traegt die Antwort; das zweite ist herangezogen.
    const { dienst, snapshots, koService } = await aufbau((ids) => ids.slice(0, 1));
    await legeKoAn(koService, "X");
    await legeKoAn(koService, "Y");
    // BEWUSST OHNE Entscheidung an beiden Objekten: gemessen wird die ROLLE, nicht die Referenz.
    // Dieselbe Lage, zwei verschiedene Gruende — genau das ist der Unterschied, den KW-W3-23 macht.
    const lauf = await dienst.ask(FRAGE, "anna", "de");
    const snapshot = await snapshots.latestSnapshot(String(lauf.answerId));
    expect(snapshot?.evidence.length).toBeGreaterThan(1);

    const tragend = snapshot?.evidence.filter((e) => e.evidenceRole === "carrying") ?? [];
    const ergaenzend = snapshot?.evidence.filter((e) => e.evidenceRole === "consulted") ?? [];
    expect(tragend.length).toBeGreaterThan(0);
    expect(ergaenzend.length).toBeGreaterThan(0);
    for (const e of tragend) {
      expect(e.validationReferenceAbsenceReason).toBe("NOT_AVAILABLE_AT_EXECUTION");
    }
    for (const e of ergaenzend) {
      expect(e.validationDecisionRef).toBeUndefined();
      expect(e.validationReferenceAbsenceReason).toBe("NOT_REQUIRED");
    }
  });

  it("jede Evidence traegt GENAU EINES von beidem — nie beides, nie keines", async () => {
    const { dienst, snapshots, koService } = await aufbau((ids) => ids.slice(0, 1));
    const a = await legeKoAn(koService, "X");
    await legeKoAn(koService, "Y");
    await koService.setValidationDecisionRef(a.id, { auditSeq: 7, auditHash: "h7" });

    const lauf = await dienst.ask(FRAGE, "anna", "de");
    const snapshot = await snapshots.latestSnapshot(String(lauf.answerId));
    for (const e of snapshot?.evidence ?? []) {
      const hatRef = e.validationDecisionRef !== undefined;
      const hatGrund = e.validationReferenceAbsenceReason !== undefined;
      expect(hatRef !== hatGrund, `Evidence ${e.knowledgeObjectId} verletzt den Ausschluss`).toBe(
        true,
      );
    }
  });
});

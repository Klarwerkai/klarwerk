// ================================================================================================
// KW-W3-23 — DIE VALIDIERUNGSREFERENZ GEHOERT AN DIE EVIDENCE, NICHT AN DEN SNAPSHOT.
// ================================================================================================
//
// DER BEFUND, den D2 gemessen und BEN bestaetigt hat: Der Snapshot trug seine Validierungsreferenz
// EINMAL, oben, fuer die ganze Antwort. Bei einer einzigen Quelle faellt das nicht auf. Bei zwei
// Quellen ist es eine Falschaussage: Eine Referenz kann nicht zwei verschiedene Entscheidungen
// belegen, und welcher der beiden Quellen sie gehoert, steht nirgends.
//
// Der bequeme Ausweg waere gewesen, die erste, die letzte oder die „tragende" Referenz zu nehmen.
// KW-W3-23 §1 verbietet das woertlich, und Pflichttest 3 unten misst genau diesen Verbotsfall.
//
// DIE ZEHN PFLICHTTESTS aus KW-W3-23 §5 stehen hier vollstaendig und in ihrer Reihenfolge. Sie
// sind die Abnahme dieses Durchgangs — nicht eine Auswahl daraus.
import { describe, expect, it } from "vitest";
import {
  ANSWER_SNAPSHOT_SCHEMA_VERSION,
  type AnswerEvidenceRef,
  type AnswerEvidenceSnapshot,
  answerSnapshotIntegrity,
  answerSnapshotStatus,
  hashAnswerSnapshot,
  legacyValidationZuordnung,
} from "./types";

const REF_A = { auditSeq: 11, auditHash: "hash-a" };
const REF_B = { auditSeq: 22, auditHash: "hash-b" };

/**
 * Die Fixture streift Felder mit `undefined` AB, statt sie zu setzen.
 *
 * `exactOptionalPropertyTypes` unterscheidet „Feld fehlt" von „Feld ist undefined", und der
 * Vertrag meint das erste: eine Evidence OHNE Referenz hat das Feld nicht. Ohne dieses Abstreifen
 * schriebe der Test eine Form, die der Schreibweg nie erzeugt — und pruefte damit etwas anderes,
 * als er behauptet.
 */
type EvidenceUeberschreibung = {
  [K in keyof AnswerEvidenceRef]?: AnswerEvidenceRef[K] | undefined;
};

function evidence(over: EvidenceUeberschreibung = {}): AnswerEvidenceRef {
  const zusammen: Record<string, unknown> = {
    knowledgeObjectId: "ko-1",
    knowledgeObjectVersion: 3,
    evidenceRole: "carrying",
    sourceRecordId: "sr-1",
    sourceRecordIdReason: null,
    locator: "S. 4",
    locatorReason: null,
    validationDecisionRef: REF_A,
    ...over,
  };
  for (const [schluessel, wert] of Object.entries(zusammen)) {
    if (wert === undefined) {
      delete zusammen[schluessel];
    }
  }
  return zusammen as unknown as AnswerEvidenceRef;
}

function snapshot(over: Partial<AnswerEvidenceSnapshot> = {}): AnswerEvidenceSnapshot {
  const roh: AnswerEvidenceSnapshot = {
    answerId: "ans-1",
    snapshotRevision: 1,
    supersedesSnapshotRevision: null,
    schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
    capturedAt: "2026-08-17T09:00:00.000Z",
    citedSources: ["ko-1"],
    evidence: [evidence()],
    resolutionId: "res-1",
    resolutionIdReason: null,
    // KW-W3-23 §3: NEUE Snapshots schreiben das top-level Feld nicht mehr.
    validationDecisionRef: null,
    validationDecisionRefReason: null,
    status: "PENDING_EVIDENCE",
    integrityHash: "",
    ...over,
  };
  const mitStatus = { ...roh, status: answerSnapshotStatus(roh) };
  return { ...mitStatus, integrityHash: hashAnswerSnapshot(mitStatus) };
}

const HEIL = { primaryResolvable: true, gesperrt: false } as const;

describe("KW-W3-23 · Pflichttest 1-3 · Kardinalitaet", () => {
  it("1 · Single-Source mit gueltiger per-Evidence-Referenz → COMPLETE", () => {
    const s = snapshot();
    expect(s.status).toBe("COMPLETE");
    expect(answerSnapshotIntegrity(s, HEIL)).toBe("VALID");
  });

  it("2 · Multi-Source mit JE EIGENER gueltiger Referenz → COMPLETE", () => {
    const s = snapshot({
      citedSources: ["ko-1", "ko-2"],
      evidence: [
        evidence(),
        evidence({
          knowledgeObjectId: "ko-2",
          knowledgeObjectVersion: 5,
          validationDecisionRef: REF_B,
        }),
      ],
    });
    expect(s.status).toBe("COMPLETE");
    expect(answerSnapshotIntegrity(s, HEIL)).toBe("VALID");
    // Jede Evidence traegt IHRE Referenz — nicht dieselbe zweimal.
    expect(s.evidence.map((e) => e.validationDecisionRef?.auditSeq)).toEqual([11, 22]);
  });

  it("3 · KEINE Auswahl erster, letzter oder tragender Referenz", () => {
    // Zwei Quellen, nur die ERSTE traegt eine Referenz. Der bequeme Trick waere, sie fuer beide
    // gelten zu lassen — dann waere dieser Snapshot COMPLETE. Er ist es nicht.
    const nurErste = snapshot({
      citedSources: ["ko-1", "ko-2"],
      evidence: [
        evidence(),
        evidence({
          knowledgeObjectId: "ko-2",
          knowledgeObjectVersion: 5,
          validationDecisionRef: undefined,
          validationReferenceAbsenceReason: "NOT_AVAILABLE_AT_EXECUTION",
        }),
      ],
    });
    expect(nurErste.status).not.toBe("COMPLETE");

    // Und die Reihenfolge aendert an der Zuordnung nichts (KW-W3-23 §2, letzte Invariante).
    const gedreht = snapshot({
      citedSources: ["ko-2", "ko-1"],
      evidence: [
        evidence({
          knowledgeObjectId: "ko-2",
          knowledgeObjectVersion: 5,
          validationDecisionRef: REF_B,
        }),
        evidence(),
      ],
    });
    const zuordnung = new Map(
      gedreht.evidence.map((e) => [e.knowledgeObjectId, e.validationDecisionRef?.auditSeq]),
    );
    expect(zuordnung.get("ko-1")).toBe(11);
    expect(zuordnung.get("ko-2")).toBe(22);
  });
});

describe("KW-W3-23 · Pflichttest 4-6 · Integritaet je Evidence", () => {
  it("4 · Pflicht-Evidence mit HASH_MISMATCH → INVALIDATED", () => {
    const s = snapshot();
    expect(
      answerSnapshotIntegrity(s, {
        ...HEIL,
        evidenceValidationRefStates: new Map([["ko-1", "HASH_MISMATCH" as const]]),
      }),
    ).toBe("INVALIDATED");
  });

  it("5 · Pflicht-Evidence mit WRONG_SUBJECT → INVALIDATED", () => {
    const s = snapshot();
    expect(
      answerSnapshotIntegrity(s, {
        ...HEIL,
        evidenceValidationRefStates: new Map([["ko-1", "WRONG_SUBJECT" as const]]),
      }),
    ).toBe("INVALIDATED");
  });

  it("6 · EINE redigierte Evidence → aktuelle Sicht REDACTED", () => {
    const s = snapshot({
      citedSources: ["ko-1", "ko-2"],
      evidence: [
        evidence(),
        evidence({
          knowledgeObjectId: "ko-2",
          knowledgeObjectVersion: 5,
          validationDecisionRef: REF_B,
        }),
      ],
    });
    expect(
      answerSnapshotIntegrity(s, {
        ...HEIL,
        evidenceValidationRefStates: new Map([["ko-2", "REDACTED" as const]]),
      }),
    ).toBe("REDACTED");
  });

  it("Ein defekter Beleg schlaegt die Redaktion — Manipulation wird nie beschoenigt", () => {
    const s = snapshot({
      citedSources: ["ko-1", "ko-2"],
      evidence: [
        evidence(),
        evidence({
          knowledgeObjectId: "ko-2",
          knowledgeObjectVersion: 5,
          validationDecisionRef: REF_B,
        }),
      ],
    });
    expect(
      answerSnapshotIntegrity(s, {
        ...HEIL,
        evidenceValidationRefStates: new Map([
          ["ko-1", "HASH_MISMATCH" as const],
          ["ko-2", "REDACTED" as const],
        ]),
      }),
    ).toBe("INVALIDATED");
  });
});

describe("KW-W3-23 · Pflichttest 7-9 · Legacy und Widerspruch", () => {
  it("7 · Legacy Single-Source mit top-level Referenz bleibt lesbar", () => {
    const s = snapshot({
      evidence: [evidence({ validationDecisionRef: undefined })],
      validationDecisionRef: REF_A,
    });
    // Lesbar: die Legacy-Zuordnung ordnet die EINE top-level Referenz der EINEN Evidence zu.
    const zuordnung = legacyValidationZuordnung(s);
    expect(zuordnung.get("ko-1")).toEqual(REF_A);
    expect(answerSnapshotIntegrity(s, HEIL)).not.toBe("INVALIDATED");
  });

  it("8 · Legacy Multi-Source mit top-level Referenz → INCOMPLETE/DEGRADED, keine erfundene Zuordnung", () => {
    const s = snapshot({
      citedSources: ["ko-1", "ko-2"],
      evidence: [
        evidence({ validationDecisionRef: undefined }),
        evidence({
          knowledgeObjectId: "ko-2",
          knowledgeObjectVersion: 5,
          validationDecisionRef: undefined,
        }),
      ],
      validationDecisionRef: REF_A,
    });
    expect(s.status).toBe("INCOMPLETE");
    expect(answerSnapshotIntegrity(s, HEIL)).toBe("DEGRADED");
    // Und ausdruecklich: KEINE Zuordnung wird erfunden.
    const zuordnung = legacyValidationZuordnung(s);
    expect(zuordnung.size).toBe(0);
  });

  it("9 · top-level und per-Evidence widerspruechlich → INVALIDATED", () => {
    const s = snapshot({
      evidence: [evidence({ validationDecisionRef: REF_A })],
      validationDecisionRef: REF_B,
    });
    expect(answerSnapshotIntegrity(s, HEIL)).toBe("INVALIDATED");
  });

  it("9b · Referenz UND Abwesenheitsgrund zugleich → INVALIDATED (sie schliessen sich aus)", () => {
    const s = snapshot({
      evidence: [
        evidence({
          validationDecisionRef: REF_A,
          validationReferenceAbsenceReason: "NOT_REQUIRED",
        }),
      ],
    });
    expect(answerSnapshotIntegrity(s, HEIL)).toBe("INVALIDATED");
  });
});

describe("KW-W3-23 · Pflichttest 10 · Freeze-129 wird ersetzt, nicht gelockert", () => {
  it("10a · Eine Evidence OHNE Referenz und OHNE Abwesenheitsgrund ist nie COMPLETE", () => {
    const s = snapshot({
      evidence: [evidence({ validationDecisionRef: undefined })],
    });
    expect(s.status).not.toBe("COMPLETE");
  });

  it("10b · Pflicht-Evidence mit Abwesenheitsgrund → INCOMPLETE, nicht PARTIAL", () => {
    const s = snapshot({
      evidence: [
        evidence({
          validationDecisionRef: undefined,
          validationReferenceAbsenceReason: "NOT_AVAILABLE_AT_EXECUTION",
        }),
      ],
    });
    expect(s.status).toBe("INCOMPLETE");
  });

  it("10c · NUR eine ergaenzende Evidence mit NOT_REQUIRED → PARTIAL, kein INVALIDATED", () => {
    const s = snapshot({
      citedSources: ["ko-1"],
      evidence: [
        evidence(),
        evidence({
          knowledgeObjectId: "ko-2",
          knowledgeObjectVersion: 5,
          evidenceRole: "consulted",
          validationDecisionRef: undefined,
          validationReferenceAbsenceReason: "NOT_REQUIRED",
        }),
      ],
    });
    expect(s.status).toBe("PARTIAL");
    expect(answerSnapshotIntegrity(s, HEIL)).toBe("DEGRADED");
  });

  it("10d · Fehlende Referenz an einer ERGAENZENDEN Evidence invalidiert nicht", () => {
    const s = snapshot({
      citedSources: ["ko-1"],
      evidence: [
        evidence(),
        evidence({
          knowledgeObjectId: "ko-2",
          knowledgeObjectVersion: 5,
          evidenceRole: "consulted",
          validationDecisionRef: undefined,
          validationReferenceAbsenceReason: "NOT_REQUIRED",
        }),
      ],
    });
    expect(
      answerSnapshotIntegrity(s, {
        ...HEIL,
        evidenceValidationRefStates: new Map([["ko-2", "MISSING" as const]]),
      }),
    ).not.toBe("INVALIDATED");
  });

  it("10e · Die per-Evidence-Referenz geht ins Hashmaterial ein", () => {
    const a = snapshot();
    const b = snapshot({ evidence: [evidence({ validationDecisionRef: REF_B })] });
    expect(a.integrityHash).not.toBe(b.integrityHash);

    const mitGrund = snapshot({
      evidence: [
        evidence({
          validationDecisionRef: undefined,
          validationReferenceAbsenceReason: "NOT_REQUIRED",
        }),
      ],
    });
    const ohneBeides = snapshot({ evidence: [evidence({ validationDecisionRef: undefined })] });
    expect(mitGrund.integrityHash).not.toBe(ohneBeides.integrityHash);
  });
});

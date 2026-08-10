import { describe, expect, it } from "vitest";
import {
  ANSWER_SNAPSHOT_SCHEMA_VERSION,
  type AnswerEvidenceSnapshot,
  type AnswerValidationRefState,
  answerSnapshotIntegrity,
  hashAnswerSnapshot,
} from "./types";

// ================================================================================================
// W3-B (KW-W3-19) — DIE FUENF NEGATIVZUSTAENDE BLEIBEN UNTERSCHEIDBAR
// ================================================================================================
//
// Kopfentscheidung zu Auftrag 67, Option (a): der Referenzbefund reist als BENANNTES,
// maschinenlesbares Kontextfeld. Die Alternative — vier verschiedene Ursachen auf zwei
// Alt-Felder abzubilden — haette am Leseweg identisch ausgesehen und genau die Ehrlichkeit
// zerstoert, die KW-W3-19 herstellen will.

function snapshot(over: Partial<AnswerEvidenceSnapshot> = {}): AnswerEvidenceSnapshot {
  const roh: AnswerEvidenceSnapshot = {
    answerId: "ans-1",
    snapshotRevision: 1,
    supersedesSnapshotRevision: null,
    schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
    capturedAt: "2026-08-02T09:00:00.000Z",
    citedSources: ["B"],
    evidence: [
      {
        knowledgeObjectId: "ko-1",
        knowledgeObjectVersion: 3,
        evidenceRole: "carrying",
        sourceRecordId: "sr-1",
        sourceRecordIdReason: null,
        locator: "S. 4",
        locatorReason: null,
      },
    ],
    resolutionId: "res-1",
    resolutionIdReason: null,
    validationDecisionRef: { auditSeq: 7, auditHash: "h7" },
    validationDecisionRefReason: null,
    status: "COMPLETE",
    integrityHash: "",
    ...over,
  };
  return { ...roh, integrityHash: hashAnswerSnapshot(roh) };
}

function zustand(
  validationRefState: AnswerValidationRefState,
  over: { primaerePruefung?: boolean; gesperrt?: boolean } = {},
) {
  return answerSnapshotIntegrity(snapshot(), {
    primaryResolvable: true,
    gesperrt: over.gesperrt ?? false,
    validationRefState,
    validationIstPrimaer: over.primaerePruefung ?? true,
  });
}

describe("W3-B/67 · der Referenzbefund entscheidet unterscheidbar", () => {
  it("OK laesst den Snapshot VALID", () => {
    expect(zustand("OK")).toBe("VALID");
  });

  it("MISSING als PRIMAERE Validierung ⇒ INVALIDATED", () => {
    expect(zustand("MISSING", { primaerePruefung: true })).toBe("INVALIDATED");
  });

  it("MISSING als nur ERGAENZENDES Detail ⇒ hoechstens DEGRADED", () => {
    // Genau die Unterscheidung aus KW-W3-19. Ohne diesen Fall waere die Regel nur behauptet.
    expect(zustand("MISSING", { primaerePruefung: false })).toBe("DEGRADED");
  });

  it("HASH_MISMATCH ⇒ INVALIDATED, auch als ergaenzendes Detail — keine Ersatzsuche", () => {
    expect(zustand("HASH_MISMATCH", { primaerePruefung: true })).toBe("INVALIDATED");
    expect(zustand("HASH_MISMATCH", { primaerePruefung: false })).toBe("INVALIDATED");
  });

  it("WRONG_EVENT_TYPE ⇒ INVALIDATED", () => {
    expect(zustand("WRONG_EVENT_TYPE")).toBe("INVALIDATED");
  });

  it("WRONG_SUBJECT ⇒ INVALIDATED", () => {
    expect(zustand("WRONG_SUBJECT")).toBe("INVALIDATED");
  });

  it("REDACTED invalidiert NICHT automatisch — die Referenz bleibt intern verifizierbar", () => {
    expect(zustand("REDACTED")).toBe("REDACTED");
  });

  it("die vier Ursachen sind am Ergebnis UNTERSCHEIDBAR geblieben", () => {
    // Der Kern von Option (a): MISSING kann DEGRADED sein, die drei anderen nie. Waeren alle vier
    // auf dieselben zwei Alt-Felder abgebildet, waere dieser Fall nicht formulierbar.
    expect(zustand("MISSING", { primaerePruefung: false })).not.toBe(
      zustand("HASH_MISMATCH", { primaerePruefung: false }),
    );
  });

  it("Manipulation des Snapshots schlaegt jeden Referenzbefund — auch REDACTED", () => {
    const echt = snapshot();
    const manipuliert = { ...echt, citedSources: ["gefaelscht"] };
    expect(
      answerSnapshotIntegrity(manipuliert, {
        primaryResolvable: true,
        gesperrt: false,
        validationRefState: "REDACTED",
        validationIstPrimaer: true,
      }),
    ).toBe("INVALIDATED");
  });

  it("ohne Referenz im Snapshot bleibt der Befund wirkungslos — null mit Grund ist erlaubt", () => {
    const ohneRef = snapshot({
      validationDecisionRef: null,
      validationDecisionRefReason: "w3b_findbyseq_missing",
      status: "PARTIAL",
    });
    // Kein INVALIDATED: ein ehrlich leeres Feld mit Grund ist kein gebrochener Beleg.
    expect(
      answerSnapshotIntegrity(ohneRef, {
        primaryResolvable: true,
        gesperrt: false,
        validationRefState: "MISSING",
        validationIstPrimaer: true,
      }),
    ).toBe("DEGRADED");
  });

  // ==============================================================================================
  // KW-W3-22 ENTSCHEIDUNG 1 — DIE POSITION DES REFERENZBEFUNDS IST JETZT KANONISCH.
  // ==============================================================================================
  //
  // Die vollstaendige Kette lautet: Hash -> validationRefState -> gesperrt -> Aufloesbarkeit samt
  // Ursache -> Status. Der Referenzbefund steht damit VOR der allgemeinen Sperre, und die
  // Begruendung steht im Wortlaut der Entscheidung: ein gebrochener oder nicht verifizierbarer
  // Validierungsbeleg ist ein INTEGRITAETSDEFEKT des historischen Snapshots und darf nicht durch
  // eine allgemeine Sichtbeschraenkung verdeckt werden.
  //
  // Die zwei Faelle unten pinnen deshalb die KETTENPOSITION, nicht nur ein Ergebnis.

  it("P3 · ein gebrochener Referenzbefund schlaegt die allgemeine Sperre — nicht umgekehrt", () => {
    // Waere `gesperrt` zuerst bewertet, kaeme hier REDACTED heraus und der Defekt verschwaende
    // hinter einer Sichtbeschraenkung.
    expect(zustand("HASH_MISMATCH", { gesperrt: true })).toBe("INVALIDATED");
    expect(zustand("WRONG_SUBJECT", { gesperrt: true })).toBe("INVALIDATED");
    expect(zustand("MISSING", { primaerePruefung: true, gesperrt: true })).toBe("INVALIDATED");
  });

  it("P4 · validationRefState REDACTED bleibt der eigene Zustand der Validierungsentscheidung", () => {
    // Er sagt etwas ueber die konkret referenzierte ENTSCHEIDUNG — nicht ueber die primaere
    // KO-Aufloesung und nicht ueber eine allgemeine Snapshot-Sperre (KW-W3-22 Entscheidung 3).
    // Deshalb bleibt das Ergebnis REDACTED, ohne dass eine der beiden anderen Quellen gesetzt ist.
    expect(zustand("REDACTED", { gesperrt: false })).toBe("REDACTED");
  });
});

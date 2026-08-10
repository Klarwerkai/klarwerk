import { describe, expect, it } from "vitest";
import { InMemoryAnswerSnapshotRepo } from "./repo";
import {
  ANSWER_SNAPSHOT_SCHEMA_VERSION,
  type AnswerEvidenceRef,
  type AnswerEvidenceSnapshot,
  type AnswerRecord,
  answerSnapshotIntegrity,
  answerSnapshotStatus,
  hashAnswerSnapshot,
} from "./types";

// ================================================================================================
// W3-A · ANTWORTIDENTITAET UND UNVERAENDERLICHE SNAPSHOT-REVISIONEN (KW-W3-18, Auftrag 56)
// ================================================================================================
//
// WAS HIER GEPRUEFT WIRD, IST DER VERTRAG — nicht die Implementierung. Jeder Fall hat ein
// benanntes Gegenstueck in `KW-W3-18` oder in den Pflichtbelegen des Auftrags, und zu jeder neuen
// Zusage gehoert eine Gegenmutation: eine Zusage, die man nicht brechen kann, hat man nicht
// geprueft.

const T0 = "2026-08-02T09:00:00.000Z";

function record(over: Partial<AnswerRecord> = {}): AnswerRecord {
  return {
    answerId: "ans-1",
    askExecutionId: "exec-1",
    createdAt: T0,
    schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
    ...over,
  };
}

function evidenz(over: Partial<AnswerEvidenceRef> = {}): AnswerEvidenceRef {
  return {
    knowledgeObjectId: "ko-1",
    knowledgeObjectVersion: 3,
    evidenceRole: "carrying",
    sourceRecordId: null,
    sourceRecordIdReason: "w2a_not_wired",
    locator: null,
    locatorReason: "no_locator_from_import",
    ...over,
  };
}

function snapshot(over: Partial<AnswerEvidenceSnapshot> = {}): AnswerEvidenceSnapshot {
  return {
    answerId: "ans-1",
    snapshotRevision: 1,
    supersedesSnapshotRevision: null,
    schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
    capturedAt: T0,
    citedSources: ["B"],
    evidence: [evidenz()],
    resolutionId: null,
    resolutionIdReason: "w1_not_on_answer_path",
    validationDecisionRef: null,
    validationDecisionRefReason: "w3b_findbyseq_missing",
    status: "PARTIAL",
    integrityHash: "",
    ...over,
  };
}

/** Ein Snapshot mit stimmigem Hash — so, wie ihn der Schreibweg erzeugen wuerde. */
function gehasht(over: Partial<AnswerEvidenceSnapshot> = {}): AnswerEvidenceSnapshot {
  const roh = snapshot(over);
  return { ...roh, integrityHash: hashAnswerSnapshot(roh) };
}

// ------------------------------------------------------------------------------------------------
// A · STABILE IDENTITAET UND APPEND-ONLY-VERTRAG
// ------------------------------------------------------------------------------------------------
describe("W3-A/56 · stabile Antwortidentität und append-only Revisionen", () => {
  it("ein Record ist über beide Wege wiederauffindbar und überlebt einen zweiten Zugriff", async () => {
    const repo = new InMemoryAnswerSnapshotRepo();
    const r = record();
    expect(await repo.createRecord(r)).toBe(true);
    expect(await repo.findRecord("ans-1")).toEqual(r);
    // Gegenkontrolle: eine ANDERE Id liefert einen anderen Stand — sonst wäre der Positivbefund
    // blind gegen eine fest verdrahtete Antwort.
    expect(await repo.findRecord("ans-2")).toBeUndefined();
  });

  it("der Vertrag kennt kein update und kein delete — Unveränderlichkeit ist strukturell", () => {
    const repo = new InMemoryAnswerSnapshotRepo() as unknown as Record<string, unknown>;
    for (const verboten of ["update", "delete", "remove", "upsert", "replaceSnapshot"]) {
      expect(repo[verboten], verboten).toBeUndefined();
    }
  });

  it("dieselbe Revision zweimal ⇒ genau EINE Zeile, die erste bleibt wertgleich", async () => {
    const repo = new InMemoryAnswerSnapshotRepo();
    await repo.createRecord(record());
    const erste = gehasht({ citedSources: ["B"] });
    expect(await repo.appendSnapshot(erste)).toBe(true);
    // Zweiter Anlauf derselben Revision mit ABWEICHENDEM Inhalt: er darf nichts überschreiben.
    expect(await repo.appendSnapshot(gehasht({ citedSources: ["Z"] }))).toBe(false);
    const alle = await repo.listSnapshots("ans-1");
    expect(alle).toHaveLength(1);
    expect(alle[0]).toEqual(erste);
  });

  it("gelesene Snapshots sind Schnappschüsse — eine Mutation des Lesewerts trifft den Bestand nicht", async () => {
    const repo = new InMemoryAnswerSnapshotRepo();
    await repo.createRecord(record());
    await repo.appendSnapshot(gehasht());
    const gelesen = await repo.findSnapshot("ans-1", 1);
    (gelesen as unknown as { citedSources: string[] }).citedSources.push("mutiert");
    expect((await repo.findSnapshot("ans-1", 1))?.citedSources).toEqual(["B"]);
  });
});

// ------------------------------------------------------------------------------------------------
// B · REVISION n+1 STATT MUTATION
// ------------------------------------------------------------------------------------------------
describe("W3-A/56 · Ergänzung erzeugt Revision n+1, niemals eine Änderung", () => {
  it("Revision 2 bindet supersedesSnapshotRevision = 1 und lässt Revision 1 unangetastet", async () => {
    const repo = new InMemoryAnswerSnapshotRepo();
    await repo.createRecord(record());
    const v1 = gehasht({ snapshotRevision: 1, supersedesSnapshotRevision: null });
    const v2 = gehasht({
      snapshotRevision: 2,
      supersedesSnapshotRevision: 1,
      citedSources: ["B", "C"],
    });
    expect(await repo.appendSnapshot(v1)).toBe(true);
    expect(await repo.appendSnapshot(v2)).toBe(true);

    const alle = await repo.listSnapshots("ans-1");
    expect(alle.map((s) => s.snapshotRevision)).toEqual([1, 2]);
    expect(alle[0]).toEqual(v1);
    expect((await repo.latestSnapshot("ans-1"))?.snapshotRevision).toBe(2);
  });

  it("eine Revision > 1 OHNE supersedesSnapshotRevision wird abgewiesen — keine verwaiste Kette", async () => {
    const repo = new InMemoryAnswerSnapshotRepo();
    await repo.createRecord(record());
    await repo.appendSnapshot(gehasht());
    await expect(
      repo.appendSnapshot(gehasht({ snapshotRevision: 2, supersedesSnapshotRevision: null })),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await repo.listSnapshots("ans-1")).toHaveLength(1);
  });

  it("eine Revision, die nicht auf ihren Vorgänger zeigt, wird abgewiesen", async () => {
    const repo = new InMemoryAnswerSnapshotRepo();
    await repo.createRecord(record());
    await repo.appendSnapshot(gehasht());
    await expect(
      repo.appendSnapshot(gehasht({ snapshotRevision: 3, supersedesSnapshotRevision: 1 })),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("ein Snapshot ohne zugehörigen Record wird abgewiesen — keine Waise", async () => {
    const repo = new InMemoryAnswerSnapshotRepo();
    await expect(repo.appendSnapshot(gehasht())).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ------------------------------------------------------------------------------------------------
// C · citedSources STATT sources — UND KEINE NEUSUCHE
// ------------------------------------------------------------------------------------------------
describe("W3-A/56 · der Snapshot bindet citedSources, niemals alle Kandidaten", () => {
  it("aus sources=[A,B,C] und citedSources=[B] bindet der Snapshot genau B", async () => {
    const repo = new InMemoryAnswerSnapshotRepo();
    await repo.createRecord(record());
    const s = gehasht({ citedSources: ["B"] });
    await repo.appendSnapshot(s);
    const gelesen = await repo.findSnapshot("ans-1", 1);
    expect(gelesen?.citedSources).toEqual(["B"]);
    expect(gelesen?.citedSources).not.toContain("A");
    expect(gelesen?.citedSources).not.toContain("C");
  });

  it("die citedSources gehen in den Hash ein — eine andere Menge ist ein anderer Snapshot", () => {
    expect(hashAnswerSnapshot(snapshot({ citedSources: ["B"] }))).not.toBe(
      hashAnswerSnapshot(snapshot({ citedSources: ["A", "B", "C"] })),
    );
  });

  it("das Lesen sucht nicht — Zähler bleibt 0, und der Zähler kann zählen", async () => {
    const repo = new InMemoryAnswerSnapshotRepo();
    await repo.createRecord(record());
    await repo.appendSnapshot(gehasht());

    let listAufrufe = 0;
    const beobachtet = new Proxy(repo, {
      get(ziel, feld, empfaenger) {
        if (feld === "listSnapshots") {
          listAufrufe += 1;
        }
        return Reflect.get(ziel, feld, empfaenger);
      },
    }) as InMemoryAnswerSnapshotRepo;

    await beobachtet.findSnapshot("ans-1", 1);
    expect(listAufrufe, "ein Punktlesen darf nichts auflisten").toBe(0);
    // POSITIVKONTROLLE: derselbe Zähler MUSS zählen können, sonst beweist die 0 nur, dass der
    // Beobachter nicht verdrahtet ist.
    await beobachtet.listSnapshots("ans-1");
    expect(listAufrufe).toBe(1);
  });
});

// ------------------------------------------------------------------------------------------------
// D · NULL WIRD KANONISCH UND UNTERSCHEIDBAR MITGEHASHT
// ------------------------------------------------------------------------------------------------
describe("W3-A/56 · null wird kanonisch und unterscheidbar mitgehasht (KW-W3-18)", () => {
  it('null und die Zeichenkette "null" sind verschiedene Hashes', () => {
    expect(hashAnswerSnapshot(snapshot({ resolutionId: null }))).not.toBe(
      hashAnswerSnapshot(snapshot({ resolutionId: "null" })),
    );
  });

  it("null und die leere Zeichenkette sind verschiedene Hashes", () => {
    expect(hashAnswerSnapshot(snapshot({ resolutionId: null }))).not.toBe(
      hashAnswerSnapshot(snapshot({ resolutionId: "" })),
    );
  });

  it("zwei gleich befüllte Snapshots ergeben denselben Hash — er ist deterministisch", () => {
    expect(hashAnswerSnapshot(snapshot())).toBe(hashAnswerSnapshot(snapshot()));
  });

  it("der Hash bindet die geordnete Evidence — Reihenfolge ist Inhalt, nicht Zufall", () => {
    const a = snapshot({
      evidence: [evidenz({ knowledgeObjectId: "ko-1" }), evidenz({ knowledgeObjectId: "ko-2" })],
    });
    const b = snapshot({
      evidence: [evidenz({ knowledgeObjectId: "ko-2" }), evidenz({ knowledgeObjectId: "ko-1" })],
    });
    expect(hashAnswerSnapshot(a)).not.toBe(hashAnswerSnapshot(b));
  });
});

// ------------------------------------------------------------------------------------------------
// E · STATUS — OHNE PRIMAERE KO-VERSION KEIN COMPLETE
// ------------------------------------------------------------------------------------------------
describe("W3-A/56 · Abschlussstatus bleibt ehrlich", () => {
  it("ohne jede Evidence ⇒ PENDING_EVIDENCE, niemals PARTIAL", () => {
    expect(answerSnapshotStatus(snapshot({ evidence: [] }))).toBe("PENDING_EVIDENCE");
  });

  it("fehlende primäre KO-Version ⇒ INCOMPLETE, niemals COMPLETE und niemals PARTIAL", () => {
    const ohneVersion = snapshot({
      evidence: [evidenz({ knowledgeObjectVersion: null })],
    });
    expect(answerSnapshotStatus(ohneVersion)).toBe("INCOMPLETE");
  });

  it("strukturell gebundene Evidence mit offener Ergänzung ⇒ PARTIAL", () => {
    expect(answerSnapshotStatus(snapshot())).toBe("PARTIAL");
  });

  it("erst vollständig gebundene Evidence ⇒ COMPLETE", () => {
    const vollstaendig = snapshot({
      evidence: [
        evidenz({
          sourceRecordId: "sr-1",
          sourceRecordIdReason: null,
          locator: "S. 4",
          locatorReason: null,
        }),
      ],
      resolutionId: "res-1",
      resolutionIdReason: null,
      validationDecisionRef: { auditSeq: 7, auditHash: "h7" },
      validationDecisionRefReason: null,
    });
    expect(answerSnapshotStatus(vollstaendig)).toBe("COMPLETE");
  });

  it("ein null-Feld OHNE maschinenlesbaren Grund wird abgewiesen — Schweigen ist kein Grund", async () => {
    const repo = new InMemoryAnswerSnapshotRepo();
    await repo.createRecord(record());
    await expect(
      repo.appendSnapshot(gehasht({ resolutionId: null, resolutionIdReason: null })),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ------------------------------------------------------------------------------------------------
// F · INTEGRITAETSZUSTAENDE
// ------------------------------------------------------------------------------------------------
describe("W3-A/56 · Integritätszustände bleiben ehrlich", () => {
  it("ein unveränderter, vollständig auflösbarer Snapshot ist VALID", () => {
    const s = gehasht({
      evidence: [
        evidenz({
          sourceRecordId: "sr-1",
          sourceRecordIdReason: null,
          locator: "S. 4",
          locatorReason: null,
        }),
      ],
      resolutionId: "res-1",
      resolutionIdReason: null,
      validationDecisionRef: { auditSeq: 7, auditHash: "h7" },
      validationDecisionRefReason: null,
    });
    expect(answerSnapshotIntegrity(s, { primaryResolvable: true, gesperrt: false })).toBe("VALID");
  });

  it("eine manipulierte Rohzeile ist INVALIDATED — und die unveränderte bleibt es nicht", () => {
    const echt = gehasht();
    const manipuliert = { ...echt, citedSources: ["heimlich-geaendert"] };
    expect(answerSnapshotIntegrity(manipuliert, { primaryResolvable: true, gesperrt: false })).toBe(
      "INVALIDATED",
    );
    // GEGENKONTROLLE: ohne Manipulation darf derselbe Weg NICHT INVALIDATED liefern.
    expect(answerSnapshotIntegrity(echt, { primaryResolvable: true, gesperrt: false })).not.toBe(
      "INVALIDATED",
    );
  });

  it("eine nicht auflösbare primäre Referenz ist INVALIDATED, nicht DEGRADED", () => {
    expect(answerSnapshotIntegrity(gehasht(), { primaryResolvable: false, gesperrt: false })).toBe(
      "INVALIDATED",
    );
  });

  it("eine fehlende ERGÄNZENDE Referenz ist DEGRADED — die primäre Evidence trägt weiter", () => {
    expect(answerSnapshotIntegrity(gehasht(), { primaryResolvable: true, gesperrt: false })).toBe(
      "DEGRADED",
    );
  });

  it("eine gesperrte Referenz ist REDACTED — und Sperre schlägt Ergänzungslücke", () => {
    expect(answerSnapshotIntegrity(gehasht(), { primaryResolvable: true, gesperrt: true })).toBe(
      "REDACTED",
    );
  });

  it("Manipulation schlägt selbst eine Sperre — eine gefälschte Zeile wird nie als REDACTED beschönigt", () => {
    const manipuliert = { ...gehasht(), citedSources: ["gefaelscht"] };
    expect(answerSnapshotIntegrity(manipuliert, { primaryResolvable: true, gesperrt: true })).toBe(
      "INVALIDATED",
    );
  });
});

// ------------------------------------------------------------------------------------------------
// E · DAS GESCHLOSSENE URSACHENMODELL (KW-W3-20 B, KW-W3-21 B, KW-W3-22 A/A/A)
// ------------------------------------------------------------------------------------------------
//
// WARUM ES DIESE FAELLE GIBT. Bis hierher war `primaryResolvable: false` eine Aussage OHNE Grund,
// und die Funktion konnte daraus nur EINEN Schluss ziehen: INVALIDATED. Ein Leser ohne Recht sah
// damit dasselbe wie ein Angriff auf den Beleg — „kaputt" statt „nicht fuer Sie". Das ist genau die
// Sorte Auskunft, die freundlich klingt und falsch ist.
//
// KW-W3-21 B fuehrt deshalb eine GESCHLOSSENE Ursache ein, KW-W3-22 A legt die vollstaendige
// Prioritaetskette fest:
//
//     1 Hash  ->  2 validationRefState  ->  3 gesperrt  ->  4 Aufloesbarkeit + Ursache  ->  5 Status
//
// UND DIE DREI WEGE ZU `REDACTED` BLEIBEN GETRENNT (KW-W3-22 Entscheidung 3). Keiner darf aus einem
// anderen abgeleitet werden — deshalb setzt jeder Fall unten sein Feld AUSDRUECKLICH.
describe("W3-C/129 · die Ursache entscheidet, nicht die blosse Unaufloesbarkeit", () => {
  // U1-U3 · technische/referenzielle Ursachen ⇒ INVALIDATED.
  it.each([["UNKNOWN_REFERENCE"], ["UNRESOLVABLE_REFERENCE"], ["DAMAGED_REFERENCE"]] as const)(
    "U · %s ist INVALIDATED — der Beleg traegt nicht mehr",
    (ursache) => {
      expect(
        answerSnapshotIntegrity(gehasht(), {
          primaryResolvable: false,
          gesperrt: false,
          primaryResolutionFailure: ursache,
        }),
      ).toBe("INVALIDATED");
    },
  );

  // U4-U5 · Rechte-/Redaktionsursachen ⇒ REDACTED. DAS IST DER EIGENTLICHE GEWINN:
  // derselbe unveraenderte Beleg, ein anderer Leser — und die Auskunft sagt die Wahrheit.
  it.each([["ACCESS_DENIED"], ["REDACTION_REQUIRED"]] as const)(
    "U · %s ist REDACTED, nicht INVALIDATED — fehlendes Recht ist kein Defekt",
    (ursache) => {
      expect(
        answerSnapshotIntegrity(gehasht(), {
          primaryResolvable: false,
          gesperrt: false,
          primaryResolutionFailure: ursache,
        }),
      ).toBe("REDACTED");
    },
  );

  it("U6 · unaufloesbar OHNE Ursache ist ein unvollstaendiger Kontext ⇒ fail-closed INVALIDATED", () => {
    expect(answerSnapshotIntegrity(gehasht(), { primaryResolvable: false, gesperrt: false })).toBe(
      "INVALIDATED",
    );
  });

  it("U7 · ein unbekannter Laufzeitwert ⇒ fail-closed INVALIDATED, niemals durchgelassen", () => {
    // Bewusst an der Typgrenze vorbei: die Laufzeitpruefung ist verbindlich (KW-W3-22 Entscheidung 2),
    // gerade WEIL ein fremder Wert aus einem aelteren oder fremden Aufrufer stammen kann.
    const fremd = {
      primaryResolvable: false,
      gesperrt: false,
      primaryResolutionFailure: "SONSTIGES",
    };
    expect(
      answerSnapshotIntegrity(
        gehasht(),
        fremd as unknown as Parameters<typeof answerSnapshotIntegrity>[1],
      ),
    ).toBe("INVALIDATED");
  });

  it("U8 · aufloesbar MIT Ursache ist ein Widerspruch ⇒ fail-closed INVALIDATED", () => {
    // Beide Angaben behaupten Gegenteiliges. Die Ursache stillschweigend zu ignorieren waere die
    // bequeme Auslegung — und sie wuerde einen kaputten Aufrufer unsichtbar machen.
    expect(
      answerSnapshotIntegrity(gehasht(), {
        primaryResolvable: true,
        gesperrt: false,
        primaryResolutionFailure: "ACCESS_DENIED",
      }),
    ).toBe("INVALIDATED");
  });

  it("P1 · Hashfehler schlaegt ACCESS_DENIED — eine gefaelschte Zeile wird nie beschoenigt", () => {
    const manipuliert = { ...gehasht(), citedSources: ["gefaelscht"] };
    expect(
      answerSnapshotIntegrity(manipuliert, {
        primaryResolvable: false,
        gesperrt: false,
        primaryResolutionFailure: "ACCESS_DENIED",
      }),
    ).toBe("INVALIDATED");
  });

  it("P2 · Hashfehler schlaegt die allgemeine Sperre", () => {
    const manipuliert = { ...gehasht(), citedSources: ["gefaelscht"] };
    expect(answerSnapshotIntegrity(manipuliert, { primaryResolvable: true, gesperrt: true })).toBe(
      "INVALIDATED",
    );
  });

  it("P5 · gesperrt schlaegt die Ursache — Prioritaet 3 vor Prioritaet 4", () => {
    // OHNE die kanonische Reihenfolge waere das INVALIDATED: die Unaufloesbarkeit wuerde die Sperre
    // ueberholen. Der Fall pinnt damit genau die Kettenposition, nicht nur das Ergebnis.
    expect(
      answerSnapshotIntegrity(gehasht(), {
        primaryResolvable: false,
        gesperrt: true,
        primaryResolutionFailure: "UNKNOWN_REFERENCE",
      }),
    ).toBe("REDACTED");
  });

  it("S1 · aufloesbare Kennung ohne gebundene Fassung ⇒ Status INCOMPLETE UND Integritaet DEGRADED", () => {
    // KW-W3-20 B in einem Fall: der Beleg ist ehrlich unvollstaendig, aber nicht gebrochen.
    // Status und Integritaet werden GETRENNT geprueft — zwei Fragen, zwei Antworten.
    const s = gehasht({ evidence: [evidenz({ knowledgeObjectVersion: null })] });
    expect(answerSnapshotStatus(s)).toBe("INCOMPLETE");
    expect(answerSnapshotIntegrity(s, { primaryResolvable: true, gesperrt: false })).toBe(
      "DEGRADED",
    );
  });

  it("S2 · ein historisch COMPLETE-Beleg behaelt seinen Status, wenn das Recht spaeter entfaellt", () => {
    // DER PRUEFSTEIN DES GANZEN VERTRAGS. Der eingefrorene Status ist eine Eigenschaft des Belegs
    // und fuer jeden Leser gleich; die Integritaet ist eine Aussage ueber DIESEN Leser JETZT.
    // Ein Beleg, der seine Geschichte umschreibt, sobald jemand ihn nicht mehr sehen darf, waere
    // kein Beleg.
    const vollstaendig = gehasht({
      evidence: [
        evidenz({
          sourceRecordId: "sr-1",
          sourceRecordIdReason: null,
          locator: "S. 4",
          locatorReason: null,
        }),
      ],
      resolutionId: "res-1",
      resolutionIdReason: null,
      validationDecisionRef: { auditSeq: 7, auditHash: "h7" },
      validationDecisionRefReason: null,
    });
    expect(answerSnapshotStatus(vollstaendig)).toBe("COMPLETE");
    expect(
      answerSnapshotIntegrity(vollstaendig, {
        primaryResolvable: false,
        gesperrt: false,
        primaryResolutionFailure: "ACCESS_DENIED",
      }),
    ).toBe("REDACTED");
    // GEGENKONTROLLE: der Status hat sich durch den Rechteentzug NICHT veraendert.
    expect(answerSnapshotStatus(vollstaendig)).toBe("COMPLETE");
  });
});

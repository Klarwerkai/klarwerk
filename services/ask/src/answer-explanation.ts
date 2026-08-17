// ================================================================================================
// W3-C (KW-W3-18) — DIE ERKLAERUNG EINER ANTWORT. LESEN, NICHT NEU SUCHEN.
// ================================================================================================
//
// WOZU DIESE DATEI. Der Beleg einer Antwort existiert seit W3-A/B als unveraenderlicher Snapshot.
// Was fehlte, war der Weg, ihn ZU LESEN — und zwar so, dass drei Dinge gleichzeitig stimmen:
//
//   · Der Begruendungspfad gehoert zur SELBEN Ausfuehrung. Spaeteres Oeffnen loest keine Neusuche
//     aus (KW-W3-18, erste fortgeltende Entscheidung). Diese Datei sucht deshalb nichts; sie
//     bekommt Record und Snapshot uebergeben und rechnet.
//   · Historische Bezuege bleiben gebunden, aber es gelten die AKTUELLEN Rechte. Der Snapshot ist
//     von damals, die Sichtbarkeit ist von heute.
//   · Manipulation schlaegt Redaktion. Ein gefaelschter Beleg darf nie als „da war etwas, Sie
//     duerfen es nur nicht sehen" erscheinen — das waere die freundlichste denkbare Luege ueber
//     einen Angriff.
//
// WAS HIER AUSDRUECKLICH NICHT GESCHIEHT: kein Modellaufruf, kein Egress, keine zweite
// Provenienz-Domaene, kein Chain-of-Thought und keine internen Prompts (KW-W3-18, No-Gos).
import {
  type AnswerEvidenceRef,
  type AnswerEvidenceSnapshot,
  type AnswerIntegrityContext,
  type AnswerIntegrityState,
  type AnswerRecord,
  type AnswerSnapshotStatus,
  type AnswerValidationDecisionRef,
  type ValidationReferenceAbsenceReason,
  answerSnapshotIntegrity,
  legacyValidationZuordnung,
} from "./types";

/**
 * EINE Zeile der Erklaerung — was diese Wissenseinheit zur Antwort beigetragen hat.
 *
 * Die Felder sind bewusst dieselben wie im Snapshot und nicht reicher: die Erklaerung ERZAEHLT
 * den Beleg, sie ergaenzt ihn nicht. Alles, was hier stuende und nicht im Snapshot steht, waere
 * eine nachtraegliche Behauptung ueber eine vergangene Ausfuehrung.
 */
export interface AnswerExplanationEvidence {
  readonly knowledgeObjectId: string;
  readonly knowledgeObjectVersion: number | null;
  readonly evidenceRole: "carrying" | "consulted";
  /**
   * Die wirksame Referenz: die eigene der Evidence, sonst die eindeutig zuordenbare
   * Legacy-Referenz. Bei mehreren Evidenzen eines Altbestandssnapshots bleibt sie `null` — die
   * Zuordnung ist dort unbestimmt und wird NICHT geraten (KW-W3-23 §3).
   */
  readonly validationDecisionRef: AnswerValidationDecisionRef | null;
  readonly validationReferenceAbsenceReason: ValidationReferenceAbsenceReason | null;
  /** `true`, wenn dieser Beleg fuer DIESEN Leser gesperrt ist. Dann sind die Felder oben leer. */
  readonly redacted: boolean;
}

export interface AnswerExplanationView {
  readonly answerId: string;
  readonly createdAt: string;
  /** Der HISTORISCHE Abschlussstatus des Snapshots — er aendert sich nie. */
  readonly snapshotStatus: AnswerSnapshotStatus;
  readonly snapshotRevision: number;
  /** Der AKTUELLE Lesezustand. Er wird bei jedem Lesen neu ermittelt. */
  readonly integrity: AnswerIntegrityState;
  readonly evidence: readonly AnswerExplanationEvidence[];
  /**
   * Wie viele Belege der Snapshot fuehrt — auch dann, wenn keiner davon sichtbar ist.
   *
   * Diese Zahl bleibt bei Redaktion stehen, und das ist Absicht: „es gibt drei Belege, Sie duerfen
   * sie nicht sehen" ist eine ehrliche Auskunft; „es gibt keine Belege" waere eine falsche.
   */
  readonly evidenceCount: number;
}

/**
 * DAS ERGEBNIS EINES ERKLAERVERSUCHS — ein geschlossener Verbund, kein Objekt mit Lueckenfeldern.
 *
 * `NOT_FOUND` deckt ZWEI Lagen ab, und zwar mit Absicht ununterscheidbar: die Antwort gibt es
 * nicht, oder sie gehoert jemand anderem. Waeren sie unterscheidbar, waere die Kennung selbst eine
 * Auskunft ueber fremden Bestand — genau das Leck, das KW-W3-18 mit „aktuelle Rechte beim Lesen"
 * ausschliesst.
 */
export type AnswerExplanationOutcome =
  | { readonly kind: "OK"; readonly view: AnswerExplanationView }
  | { readonly kind: "NOT_FOUND" }
  /** Der Record existiert, ein Beleg wurde nie geschrieben (Ausfall zwischen den zwei Writes). */
  | { readonly kind: "NO_SNAPSHOT"; readonly answerId: string; readonly createdAt: string };

/** Was der Aufrufer ueber die AKTUELLE Sichtbarkeit je Wissenseinheit weiss. */
export interface AnswerExplanationSicht extends AnswerIntegrityContext {
  /**
   * Die Wissenseinheiten, die dieser Leser NICHT sehen darf. Ermittelt vom Aufrufer gegen den
   * heutigen Bestand — hier wird nichts nachgeschlagen.
   */
  readonly gesperrteObjekte?: ReadonlySet<string>;
}

/**
 * Baut die Erklaerung. REINE RECHNUNG: alles, was gebraucht wird, kommt als Argument herein.
 *
 * Die Reihenfolge der drei Entscheidungen ist der Vertrag:
 *   1. Kein Snapshot -> `NO_SNAPSHOT`. Der Record allein erklaert nichts.
 *   2. Integritaet ermitteln (KW-W3-23 §4 Leiter, in `answerSnapshotIntegrity`).
 *   3. Erst danach redigieren. Ein `INVALIDATED` gibt KEINE Belegdetails heraus — nicht weil sie
 *      geheim waeren, sondern weil sie nicht mehr belastbar sind.
 */
export function baueAnswerExplanation(
  record: AnswerRecord,
  snapshot: AnswerEvidenceSnapshot | undefined,
  sicht: AnswerExplanationSicht,
): AnswerExplanationOutcome {
  if (snapshot === undefined) {
    return { kind: "NO_SNAPSHOT", answerId: record.answerId, createdAt: record.createdAt };
  }
  const integrity = answerSnapshotIntegrity(snapshot, sicht);
  const legacy = legacyValidationZuordnung(snapshot);
  const gesperrt = sicht.gesperrteObjekte ?? new Set<string>();
  // Bei `INVALIDATED` steht die Zahl, aber kein Detail: ein manipulierter Beleg soll nicht
  // aussehen, als truege er noch Aussagen.
  const zeilen: AnswerExplanationEvidence[] =
    integrity === "INVALIDATED"
      ? []
      : snapshot.evidence.map((ref) => zeile(ref, legacy, gesperrt.has(ref.knowledgeObjectId)));
  return {
    kind: "OK",
    view: {
      answerId: record.answerId,
      createdAt: record.createdAt,
      snapshotStatus: snapshot.status,
      snapshotRevision: snapshot.snapshotRevision,
      integrity,
      evidence: zeilen,
      evidenceCount: snapshot.evidence.length,
    },
  };
}

function zeile(
  ref: AnswerEvidenceRef,
  legacy: ReadonlyMap<string, AnswerValidationDecisionRef>,
  redacted: boolean,
): AnswerExplanationEvidence {
  if (redacted) {
    // GESCHWAERZT HEISST GESCHWAERZT: keine Kennung, keine Fassung, keine Referenz. Die Rolle
    // bleibt, weil sie nichts ueber den Inhalt verraet — nur darueber, DASS etwas beigetragen hat.
    return {
      knowledgeObjectId: "",
      knowledgeObjectVersion: null,
      evidenceRole: ref.evidenceRole,
      validationDecisionRef: null,
      validationReferenceAbsenceReason: null,
      redacted: true,
    };
  }
  return {
    knowledgeObjectId: ref.knowledgeObjectId,
    knowledgeObjectVersion: ref.knowledgeObjectVersion,
    evidenceRole: ref.evidenceRole,
    validationDecisionRef: ref.validationDecisionRef ?? legacy.get(ref.knowledgeObjectId) ?? null,
    validationReferenceAbsenceReason: ref.validationReferenceAbsenceReason ?? null,
    redacted: false,
  };
}

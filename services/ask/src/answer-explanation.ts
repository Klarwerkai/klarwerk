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
  type AnswerGenerationMode,
  type AnswerIntegrityContext,
  type AnswerIntegrityState,
  type AnswerNullReason,
  type AnswerPrimaryResolutionFailure,
  type AnswerRecord,
  type AnswerSnapshotStatus,
  type AnswerValidationDecisionRef,
  BEKANNTE_PRIMAERURSACHEN,
  type ValidationReferenceAbsenceReason,
  answerSnapshotIntegrity,
  hashAnswerSnapshot,
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
  /**
   * R-0293 / R-0317 — QUELLE UND FUNDSTELLE, wie der Beleg sie festhielt. Ist ein Feld leer, steht
   * daneben sein maschinenlesbarer Grund aus dem Snapshot — nie ein leeres Feld ohne Grund.
   */
  readonly sourceRecordId: string | null;
  readonly sourceRecordIdReason: AnswerNullReason | null;
  readonly locator: string | null;
  readonly locatorReason: AnswerNullReason | null;
  /** R-0317: die Rechtelage zum Ausfuehrungszeitpunkt (`null`: keine Stufe oder nicht erfasst). */
  readonly confidentialityAtExecution: string | null;
  /** R-0340: die damalige Zustaendigkeit (`null`: Altbestand ohne erfasste Zustaendigkeit). */
  readonly responsibleAtExecution: string | null;
  readonly responsibleKindAtExecution: "owner" | "author-fallback" | null;
  /**
   * R-0293 — IST HEUTE EIN WIDERSPRUCH ZU DIESER WISSENSEINHEIT OFFEN?
   *
   * Eine Aussage von HEUTE, keine historische: der Beleg hielt keine Konfliktlage fest, und eine
   * erfundene waere schlimmer als eine benannte Gegenwart. `null` heisst UNBEKANNT (Abruf nicht
   * moeglich) — ausdruecklich nicht „kein Widerspruch".
   */
  readonly openConflictToday: boolean | null;
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
  /**
   * R-0276 — WARUM DER HAUPTBELEG NICHT AUFLOEST: genau einer der fuenf Gruende, oder `null`.
   *
   * `null` heisst nur dann „loest auf", wenn `integrity` nicht `INVALIDATED` ist. Ein entwerteter
   * Beleg OHNE Grund ist genau der Fall „Grund fehlt -> entwertet" aus KW-W3-21 — er wird nicht
   * nachtraeglich mit einem geratenen Grund versehen.
   */
  readonly primaryResolutionFailure: AnswerPrimaryResolutionFailure | null;
  /**
   * R-0293 — SIND DIE TRAGENDEN QUELLEN VOLLSTAENDIG GEPRUEFT? Ja genau dann, wenn jede tragende
   * Evidence eine wirksame Freigabereferenz (`auditSeq`/`auditHash`) traegt. Gibt es keine tragende
   * Evidence, ist das KEIN Ja. `null` heisst: fuer DIESEN Leser nicht feststellbar — der Beleg ist
   * entwertet, oder eine tragende Zeile ist ihm geschwaerzt (sonst verriete die Gesamtaussage, was
   * die Zeile verschweigt).
   */
  readonly carryingSourcesValidated: boolean | null;
  /**
   * R-0293 — IST HEUTE EIN WIDERSPRUCH ZU EINER TRAGENDEN QUELLE OFFEN? `null` = unbekannt.
   * Ueber geschwaerzte Zeilen wird hier nichts verraten, was die Zeile selbst verschweigt: die
   * Gesamtaussage beruecksichtigt nur Zeilen, die dieser Leser sehen darf.
   */
  readonly openConflictToday: boolean | null;
  /** R-0317: Erzeugungsart des Antworttextes; `null` bei Belegen von vor R-0317. */
  readonly generationMode: AnswerGenerationMode | null;
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
  /**
   * R-0293: die Wissenseinheiten, zu denen HEUTE ein Widerspruch offen ist — `null`, wenn der
   * Aufrufer das nicht feststellen konnte. Fehlt das Feld, ist die Konfliktlage ebenso unbekannt.
   */
  readonly offeneKonflikte?: ReadonlySet<string> | null;
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
  const konflikte = sicht.offeneKonflikte ?? null;
  // Bei `INVALIDATED` steht die Zahl, aber kein Detail: ein manipulierter Beleg soll nicht
  // aussehen, als truege er noch Aussagen.
  const zeilen: AnswerExplanationEvidence[] =
    integrity === "INVALIDATED"
      ? []
      : snapshot.evidence.map((ref) =>
          zeile(ref, legacy, gesperrt.has(ref.knowledgeObjectId), konflikte),
        );
  const tragend = zeilen.filter((z) => z.evidenceRole === "carrying");
  return {
    kind: "OK",
    view: {
      answerId: record.answerId,
      createdAt: record.createdAt,
      snapshotStatus: snapshot.status,
      snapshotRevision: snapshot.snapshotRevision,
      integrity,
      primaryResolutionFailure: aufloesungsgrund(snapshot, sicht, gesperrt),
      carryingSourcesValidated:
        integrity === "INVALIDATED" || tragend.some((z) => z.redacted)
          ? null
          : tragend.length > 0 && tragend.every((z) => z.validationDecisionRef !== null),
      openConflictToday:
        integrity === "INVALIDATED" || konflikte === null
          ? null
          : tragend.some((z) => z.openConflictToday === true),
      generationMode: snapshot.generationMode ?? null,
      evidence: zeilen,
      evidenceCount: snapshot.evidence.length,
    },
  };
}

/**
 * R-0276 — DER EINE GRUND, WARUM DER HAUPTBELEG NICHT AUFLOEST (KW-W3-21 B, KW-W3-22).
 *
 * Die Reihenfolge folgt der Prioritaetsleiter in `answerSnapshotIntegrity`: zuerst die eigene
 * Unversehrtheit des Belegs, dann der Aufloesungsversuch des Aufrufers, zuletzt das Leserecht.
 *
 *   Hash stimmt nicht                     -> `DAMAGED_REFERENCE`
 *   Aufloesung gescheitert, Grund bekannt -> genau dieser Grund
 *   Aufloesung gescheitert, Grund fehlt
 *     oder ist fremd / widerspruechlich   -> `null` (der Beleg ist entwertet, ein Grund wird NICHT
 *                                            geraten — `integrity` traegt das `INVALIDATED`)
 *   eine tragende Quelle ist gesperrt     -> `ACCESS_DENIED`
 *   sonst                                 -> `null` (loest auf)
 */
function aufloesungsgrund(
  snapshot: AnswerEvidenceSnapshot,
  sicht: AnswerExplanationSicht,
  gesperrt: ReadonlySet<string>,
): AnswerPrimaryResolutionFailure | null {
  if (snapshot.integrityHash !== hashAnswerSnapshot(snapshot)) {
    return "DAMAGED_REFERENCE";
  }
  const ursache = sicht.primaryResolutionFailure;
  if (!sicht.primaryResolvable) {
    return ursache !== undefined && BEKANNTE_PRIMAERURSACHEN.includes(ursache) ? ursache : null;
  }
  if (ursache !== undefined) {
    return null;
  }
  const tragendGesperrt = snapshot.evidence.some(
    (ref) => ref.evidenceRole === "carrying" && gesperrt.has(ref.knowledgeObjectId),
  );
  return tragendGesperrt ? "ACCESS_DENIED" : null;
}

function zeile(
  ref: AnswerEvidenceRef,
  legacy: ReadonlyMap<string, AnswerValidationDecisionRef>,
  redacted: boolean,
  konflikte: ReadonlySet<string> | null,
): AnswerExplanationEvidence {
  if (redacted) {
    // GESCHWAERZT HEISST GESCHWAERZT: keine Kennung, keine Fassung, keine Referenz, keine Fundstelle,
    // keine Zustaendigkeit und keine Konfliktlage (R-0618). Die Rolle bleibt, weil sie nichts ueber
    // den Inhalt verraet — nur darueber, DASS etwas beigetragen hat.
    return {
      knowledgeObjectId: "",
      knowledgeObjectVersion: null,
      evidenceRole: ref.evidenceRole,
      validationDecisionRef: null,
      validationReferenceAbsenceReason: null,
      sourceRecordId: null,
      sourceRecordIdReason: null,
      locator: null,
      locatorReason: null,
      confidentialityAtExecution: null,
      responsibleAtExecution: null,
      responsibleKindAtExecution: null,
      openConflictToday: null,
      redacted: true,
    };
  }
  return {
    knowledgeObjectId: ref.knowledgeObjectId,
    knowledgeObjectVersion: ref.knowledgeObjectVersion,
    evidenceRole: ref.evidenceRole,
    validationDecisionRef: ref.validationDecisionRef ?? legacy.get(ref.knowledgeObjectId) ?? null,
    validationReferenceAbsenceReason: ref.validationReferenceAbsenceReason ?? null,
    sourceRecordId: ref.sourceRecordId,
    sourceRecordIdReason: ref.sourceRecordIdReason,
    locator: ref.locator,
    locatorReason: ref.locatorReason,
    confidentialityAtExecution: ref.confidentialityAtExecution ?? null,
    responsibleAtExecution: ref.responsibleAtExecution ?? null,
    responsibleKindAtExecution: ref.responsibleKindAtExecution ?? null,
    openConflictToday: konflikte === null ? null : konflikte.has(ref.knowledgeObjectId),
    redacted: false,
  };
}

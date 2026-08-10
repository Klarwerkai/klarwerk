import { createHash } from "node:crypto";

// FR-ASK-05 / SCRUM-115: Priorität einer Wissenslücke. Default "mittel".
export type GapPriority = "hoch" | "mittel" | "niedrig";

export const GAP_PRIORITIES: readonly GapPriority[] = ["hoch", "mittel", "niedrig"];

export function isGapPriority(value: unknown): value is GapPriority {
  return value === "hoch" || value === "mittel" || value === "niedrig";
}

export interface Gap {
  id: string;
  question: string;
  status: "offen" | "geschlossen";
  assignee: string | null;
  priority: GapPriority;
  createdAt: string;
  // FUNKE-FIX2 P0 (bens Blocker Gap-Freitext): Ersteller/Owner der Lücke (der fragende Actor). Grundlage
  // der adressatengerechten Freitext-Sichtbarkeit — der Ersteller darf „seinen" Fragetext wiedersehen
  // (z. B. beim Erfassen), ein Unberechtigter bekommt eine redigierte Sicht. Nur INTERN (Persistenz +
  // Redaktions-Entscheid); der GapView an den Client trägt das Feld NIE (kein Leak, wer eine
  // vertrauliche Lücke anlegte). Fehlt bei Altbeständen/System-Lücken → dann greift nur assignee/Rolle.
  createdBy?: string;
  // Herkunfts-Markierung: vom Demo-Seed erzeugte Lücke (stabil, überlebt Bearbeitung/Persistenz).
  // Der Demo-Purge entfernt gezielt genau diese — kein fragiler Titel-/Text-Abgleich mehr.
  demoSeed?: boolean;
}

// FUNKE-FIX P0 (bens ROT-1): FORBIDDEN — ein „Danke" ohne gültigen, dieses KO belegenden
// Antwort-Receipt (unbelegte/fremd gewählte KO-ID) → 403 (sendError-Mapping).
export type AskErrorCode = "NOT_FOUND" | "CONFIRM_REQUIRED" | "BAD_REQUEST" | "FORBIDDEN";

export class AskError extends Error {
  readonly code: AskErrorCode;

  constructor(code: AskErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AskError";
  }
}

// ================================================================================================
// W3-A (KW-W3-18) — DIE ANTWORT ALS BELEGBARER GEGENSTAND
// ================================================================================================
//
// WOZU DAS HIER STEHT. Eine Antwort war bisher ein Vorgang ohne Nachleben: `AskResult` traegt keine
// Kennung, und was die Antwort getragen hat, verfiel mit dem Receipt nach dreissig Minuten. Wer
// spaeter fragte „worauf stuetzte sich das", konnte nur neu suchen — und eine neue Suche ist eine
// neue Antwort, nicht der Beleg der alten. `KW-W3-18` fuehrt deshalb zwei Vertraege ein: eine
// stabile Identitaet und einen UNVERAENDERLICHEN Beleg-Schnappschuss.
//
// WAS HIER AUSDRUECKLICH NICHT ENTSTEHT: kein Egress, keine Neusuche, keine Client-Evidence, keine
// zweite Rating-/Conflict-/Provenienz-/Validation-Domaene. Der Kern speichert, was die Antwort
// getragen hat — er erzeugt es nicht.

/** Die Fassung des Snapshot-Vertrags. Sie geht in den Hash ein, damit ein Formatwechsel sichtbar ist. */
export const ANSWER_SNAPSHOT_SCHEMA_VERSION = 1;

/**
 * Die vier Abschlusszustaende (KW-W3-18). Sie sind eine LEITER, keine Auswahl: `COMPLETE` verlangt
 * strikt mehr als `PARTIAL`, und `PARTIAL` verlangt strukturell gebundene Evidence.
 */
export type AnswerSnapshotStatus = "PENDING_EVIDENCE" | "INCOMPLETE" | "PARTIAL" | "COMPLETE";

/** Der Integritaetszustand BEIM LESEN — er gehoert nicht in die Zeile, er wird ermittelt. */
export type AnswerIntegrityState = "VALID" | "DEGRADED" | "INVALIDATED" | "REDACTED";

/**
 * Warum ein Pflichtfeld leer ist — MASCHINENLESBAR, nicht als Freitext.
 *
 * `KW-W3-18` erlaubt `null` nur „mit maschinenlesbarem Grund". Ein `null` ohne Grund waere die
 * gefaehrlichste Form der Luecke: sie sieht aus wie eine Aussage („es gibt keine") und ist in
 * Wahrheit ein Schweigen. Deshalb ist der Grund ein geschlossener Wertebereich.
 */
export type AnswerNullReason =
  /** W1 beruehrt den Antwortweg nicht — es gibt keine Resolution, die man binden koennte. */
  | "w1_not_on_answer_path"
  /** Die W2-A-Quellrevision ist nicht verdrahtet; niemand schreibt ExternalSourceRecords. */
  | "w2a_not_wired"
  /** Der Import erzeugt bis heute keine Fundstelle (buildSource setzt excerpt: null). */
  | "no_locator_from_import"
  /**
   * Der Validation-Leseweg (findBySeq) existiert noch nicht — das war W3-B.
   *
   * SEIT FREEZE 67 IST DIESER GRUND ERLEDIGT: `findBySeq` existiert. Der Wert bleibt im
   * Wertebereich, weil Altbestand ihn tragen kann; NEUE Snapshots duerfen ihn nicht mehr
   * behaupten (Auftrag 76, Akzeptanz 3).
   */
  | "w3b_findbyseq_missing"
  /**
   * ES GIBT KEINEN TRAEGER VON DER ENTSCHEIDUNG ZUR ANTWORT.
   *
   * Der sachlich richtige Grund seit Freeze 67 und Prewrite 72 §2: die Validierungsentscheidung
   * faellt beim BEWERTEN, der Snapshot entsteht beim ANTWORTEN — spaeter, anderer Request,
   * anderer Actor. Das Knowledge Object fuehrt heute nur `trust` und `status`, keine
   * Validierungsreferenz; sie verfaellt am Ende des Validierungsrequests.
   *
   * Die drei denkbaren Auswege sind entweder verboten (spaeteres Suchen, Client-Evidence) oder
   * verlangen eine noch offene Produktentscheidung (das KO traegt die Referenz). Bis dahin ist
   * `null` MIT DIESEM GRUND die einzige ehrliche Antwort — nicht ein erfundener Beleg und nicht
   * ein Grund, der laengst behoben ist.
   */
  | "w3c_no_decision_carrier";

/** Die Validation-Referenz aus `KW-W3-19` — Sequenz UND Hash, nie nur eine der beiden. */
export interface AnswerValidationDecisionRef {
  readonly auditSeq: number;
  readonly auditHash: string;
}

/**
 * EINE herangezogene Wissenseinheit. `knowledgeObjectId` und `knowledgeObjectVersion` sind die
 * PRIMAERE Evidence; alles Weitere ist Ergaenzung. Genau an dieser Trennung haengt der Status:
 * ohne primaere KO-Version gibt es kein `COMPLETE` (KW-W3-18).
 */
export interface AnswerEvidenceRef {
  readonly knowledgeObjectId: string;
  /** `null` heisst ehrlich „die Fassung ist nicht gebunden" — nicht „Fassung 0". */
  readonly knowledgeObjectVersion: number | null;
  /** Die Rolle im Bestand: tragend oder herangezogen (reasoner/src/types.ts:49-65). */
  readonly evidenceRole: "carrying" | "consulted";
  readonly sourceRecordId: string | null;
  readonly sourceRecordIdReason: AnswerNullReason | null;
  readonly locator: string | null;
  readonly locatorReason: AnswerNullReason | null;
}

/** Die stabile Identitaet einer Antwort. Sie entsteht einmal und aendert sich nie. */
export interface AnswerRecord {
  readonly answerId: string;
  readonly askExecutionId: string;
  readonly createdAt: string;
  readonly schemaVersion: number;
}

/**
 * EINE Revision des Belegs. Unveraenderlich: eine Ergaenzung ist Revision `n+1` mit
 * `supersedesSnapshotRevision = n`, niemals eine Aenderung an `n`.
 */
export interface AnswerEvidenceSnapshot {
  readonly answerId: string;
  readonly snapshotRevision: number;
  readonly supersedesSnapshotRevision: number | null;
  readonly schemaVersion: number;
  readonly capturedAt: string;
  /**
   * NUR die Quellen, deren Fussnotenmarke im gelieferten Text wirklich vorkam — nie alle
   * herangezogenen Kandidaten. Die Unterscheidung ist im Bestand seit langem scharf gezogen
   * (reasoner/src/types.ts:49-65); hier wird sie eingefroren, nicht erfunden.
   */
  readonly citedSources: readonly string[];
  readonly evidence: readonly AnswerEvidenceRef[];
  readonly resolutionId: string | null;
  readonly resolutionIdReason: AnswerNullReason | null;
  readonly validationDecisionRef: AnswerValidationDecisionRef | null;
  readonly validationDecisionRefReason: AnswerNullReason | null;
  readonly status: AnswerSnapshotStatus;
  readonly integrityHash: string;
}

/**
 * DIE KANONISCHE FORM EINES WERTES FUER DEN HASH.
 *
 * `KW-W3-18` verlangt woertlich: „`null` wird kanonisch mitgehasht." Das ist mehr als „nicht
 * weglassen": `null`, die leere Zeichenkette und die Zeichenkette "null" muessen DREI verschiedene
 * Materialien ergeben. Waeren sie gleich, koennte ein fehlendes Feld nachtraeglich als leeres Feld
 * ausgegeben werden, ohne dass der Hash es merkt — und genau das soll er merken.
 *
 * Der Nullmarker traegt ein Steuerzeichen, das in keinem der gebundenen Nutzwerte vorkommen kann.
 */
const NULL_MARKER = "\u0000null";

function hashWert(value: string | number | null): string {
  return value === null ? NULL_MARKER : String(value);
}

/**
 * DAS HASHMATERIAL — geordnet, vollstaendig, mit Feldnamen.
 *
 * Die Feldnamen stehen bewusst mit im Material: ohne sie waeren zwei Snapshots, die dieselben
 * Werte in anderen Feldern tragen, hashgleich. Die Reihenfolge der Evidence gehoert dazu, weil
 * sie Inhalt ist (die gelieferte Reihenfolge der Belege) und nicht Zufall.
 */
export function answerSnapshotHashMaterial(snapshot: AnswerEvidenceSnapshot): readonly string[] {
  const material: string[] = [
    `answerId=${snapshot.answerId}`,
    `snapshotRevision=${snapshot.snapshotRevision}`,
    `supersedes=${hashWert(snapshot.supersedesSnapshotRevision)}`,
    `schemaVersion=${snapshot.schemaVersion}`,
    `capturedAt=${snapshot.capturedAt}`,
    `citedSources=${snapshot.citedSources.join("\u001f")}`,
    `resolutionId=${hashWert(snapshot.resolutionId)}`,
    `resolutionIdReason=${hashWert(snapshot.resolutionIdReason)}`,
    `validationDecisionRef=${
      snapshot.validationDecisionRef === null
        ? NULL_MARKER
        : `${snapshot.validationDecisionRef.auditSeq}#${snapshot.validationDecisionRef.auditHash}`
    }`,
    `validationDecisionRefReason=${hashWert(snapshot.validationDecisionRefReason)}`,
    `status=${snapshot.status}`,
    `evidenceCount=${snapshot.evidence.length}`,
  ];
  snapshot.evidence.forEach((ref, index) => {
    material.push(
      [
        `evidence[${index}].koId=${ref.knowledgeObjectId}`,
        `koVersion=${hashWert(ref.knowledgeObjectVersion)}`,
        `role=${ref.evidenceRole}`,
        `sourceRecordId=${hashWert(ref.sourceRecordId)}`,
        `sourceRecordIdReason=${hashWert(ref.sourceRecordIdReason)}`,
        `locator=${hashWert(ref.locator)}`,
        `locatorReason=${hashWert(ref.locatorReason)}`,
      ].join("\u001e"),
    );
  });
  return material;
}

/**
 * Der Integritaetshash. Dasselbe Verfahren wie die Auditkette (`audit/src/chain.ts:7-18`):
 * SHA-256 ueber eine geordnete, mit `|` gefuegte Materialliste. Kein eigenes Verfahren, wo eines
 * existiert und sich bewaehrt hat.
 *
 * Das Feld `integrityHash` selbst geht NICHT ein — es ist das Ergebnis, nicht die Eingabe.
 */
export function hashAnswerSnapshot(snapshot: AnswerEvidenceSnapshot): string {
  return createHash("sha256").update(answerSnapshotHashMaterial(snapshot).join("|")).digest("hex");
}

/** Traegt diese Referenz eine vollstaendige PRIMAERE Bindung? */
function primaerGebunden(ref: AnswerEvidenceRef): boolean {
  return ref.knowledgeObjectId.trim().length > 0 && ref.knowledgeObjectVersion !== null;
}

/** Ist jede Ergaenzung dieser Referenz aufgeloest? */
function ergaenzungVollstaendig(ref: AnswerEvidenceRef): boolean {
  return ref.sourceRecordId !== null && ref.locator !== null;
}

/**
 * DER ABSCHLUSSSTATUS, ABGELEITET STATT BEHAUPTET.
 *
 * Die Reihenfolge der Pruefungen IST die Regel:
 *   · keine Evidence            -> PENDING_EVIDENCE  (nicht PARTIAL — es gibt nichts, was traegt)
 *   · Evidence ohne KO-Version  -> INCOMPLETE        (KW-W3-18: kein COMPLETE ohne primaere Version;
 *                                                     und ausdruecklich KEIN PARTIAL fuer
 *                                                     strukturell ungebundene Evidence)
 *   · gebunden, Ergaenzung offen-> PARTIAL
 *   · alles aufgeloest          -> COMPLETE
 */
export function answerSnapshotStatus(snapshot: AnswerEvidenceSnapshot): AnswerSnapshotStatus {
  if (snapshot.evidence.length === 0) {
    return "PENDING_EVIDENCE";
  }
  if (!snapshot.evidence.every(primaerGebunden)) {
    return "INCOMPLETE";
  }
  const alleErgaenzungen =
    snapshot.evidence.every(ergaenzungVollstaendig) &&
    snapshot.resolutionId !== null &&
    snapshot.validationDecisionRef !== null;
  return alleErgaenzungen ? "COMPLETE" : "PARTIAL";
}

/**
 * W3-B (KW-W3-19) — DER BEFUND DER VALIDIERUNGSREFERENZ, ALS BENANNTER WERT.
 *
 * Kopfentscheidung zu Auftrag 67, Option (a). Die Alternative waere gewesen, die vier verschiedenen
 * Ursachen auf die zwei vorhandenen Kontextfelder abzubilden — dann saehen `MISSING`,
 * `HASH_MISMATCH`, `WRONG_EVENT_TYPE` und `WRONG_SUBJECT` am Leseweg IDENTISCH aus. Ein Leser
 * erfuehre, DASS etwas nicht stimmt, aber nie WAS, und genau diese Auskunft ist der Zweck von
 * KW-W3-19.
 *
 * DIE WERTE SIND HIER EIGENS DEKLARIERT und nicht aus dem Audit-Modul importiert: die
 * Pruefung liegt dort (`pruefeValidationDecisionRef`), ist aber noch nicht aus dessen Fassade
 * ausgeleitet — `services/audit/index.ts` lag ausserhalb des Scopes von Auftrag 67. Die beiden
 * Aufzaehlungen sind strukturell deckungsgleich; die Zusammenfuehrung gehoert in die Welle, die
 * die Fassade oeffnet. Bis dahin ist die Doppelung eine benannte Restgrenze, kein Versehen.
 *
 * `REDACTED` steht nur hier und nicht in der Audit-Pruefung: es ist eine Aussage ueber DIESEN
 * Leser, keine Eigenschaft des Belegs.
 */
export type AnswerValidationRefState =
  | "OK"
  | "MISSING"
  | "HASH_MISMATCH"
  | "WRONG_EVENT_TYPE"
  | "WRONG_SUBJECT"
  | "REDACTED";

/** Was der Leser ueber die Aufloesbarkeit der Referenzen weiss — er, nicht der Kern. */
/**
 * WARUM `primaryResolvable=false` NICHT MEHR OHNE GRUND AUSKOMMT (KW-W3-21 B, KW-W3-22 A).
 *
 * Ein einzelnes Ja/Nein konnte zwei voellig verschiedene Lagen nicht auseinanderhalten: „der Beleg
 * traegt nicht mehr" und „Sie duerfen ihn nicht sehen". Beide endeten auf `INVALIDATED` — ein
 * fehlendes Recht sah damit aus wie ein Angriff auf den Beleg. Diese Aufzaehlung ist GESCHLOSSEN
 * und trennt die zwei Familien:
 *
 *   technisch/referenziell  -> INVALIDATED   (der Beleg ist wirklich nicht mehr belastbar)
 *   Recht/Redaktion         -> REDACTED      (der Beleg ist heil, dieser Leser sieht ihn nicht)
 */
export type AnswerPrimaryResolutionFailure =
  | "UNKNOWN_REFERENCE"
  | "UNRESOLVABLE_REFERENCE"
  | "DAMAGED_REFERENCE"
  | "ACCESS_DENIED"
  | "REDACTION_REQUIRED";

/**
 * Die bekannten Ursachen als LAUFZEITliste — bewusst zusaetzlich zum Typ.
 *
 * KW-W3-22 Entscheidung 2 verlangt die explizite Laufzeitpruefung: ein rein typseitig
 * diskriminierter Verbund ist NICHT kanonisch, weil die ungueltigen Faelle darstellbar und
 * pruefbar bleiben muessen. Ein fremder Wert kann aus einem aelteren Aufrufer, aus JSON oder aus
 * einem `as`-Cast stammen; der Compiler sieht ihn dann nicht.
 */
const BEKANNTE_PRIMAERURSACHEN: readonly string[] = [
  "UNKNOWN_REFERENCE",
  "UNRESOLVABLE_REFERENCE",
  "DAMAGED_REFERENCE",
  "ACCESS_DENIED",
  "REDACTION_REQUIRED",
];

export interface AnswerIntegrityContext {
  /** Sind die PRIMAEREN Referenzen (KO-Id/-Version) auffindbar und verwertbar? */
  readonly primaryResolvable: boolean;
  /**
   * WARUM die primaere Referenz nicht aufloest — additiv und optional (KW-W3-22 Entscheidung 2).
   *
   * Bei `primaryResolvable === false` ist GENAU EINE bekannte Ursache erforderlich; bei `true` muss
   * sie fehlen. Fehlende, unbekannte oder widerspruechliche Angaben sind ein ungueltiger Kontext
   * und enden fail-closed auf `INVALIDATED` — nicht auf „Ursache ignorieren".
   *
   * ZUSTAENDIGKEIT, ausschliesslich (KW-W3-22 Entscheidung 3): dieses Feld traegt das Ergebnis des
   * AKTUELLEN serverseitigen Aufloesungsversuchs der primaeren KO-Referenz. Es wird NICHT aus
   * `gesperrt` und NICHT aus `validationRefState` abgeleitet — und umgekehrt genauso wenig.
   */
  readonly primaryResolutionFailure?: AnswerPrimaryResolutionFailure;
  /** Ist mindestens eine Referenz fuer DIESEN Leser gesperrt? */
  readonly gesperrt: boolean;
  /** Das Ergebnis des Leseablaufs aus KW-W3-19 — vom Aufrufer ermittelt, hier nur ausgewertet. */
  readonly validationRefState?: AnswerValidationRefState;
  /**
   * Traegt die Validierung diesen Snapshot PRIMAER, oder ist sie ein ergaenzendes Detail?
   *
   * KW-W3-19 macht die Unterscheidung ausdruecklich: ein fehlender Eintrag invalidiert die primaere
   * Validierung, ist aber bei einem ergaenzenden Detail hoechstens `DEGRADED`. Ohne dieses Feld
   * waere die Regel nicht ausdrueckbar — nur behauptbar.
   */
  readonly validationIstPrimaer?: boolean;
}

/**
 * DIE PRIMAERE AUFLOESUNG ALS EIGENER BEFUND (KW-W3-21 B, KW-W3-22 A/A/A).
 *
 * Getrennt von der Hauptfunktion, weil hier DREI Fragen zusammenfallen, die man einzeln beantworten
 * muss: ist der Kontext ueberhaupt gueltig, loest die Referenz auf, und wenn nicht — WARUM nicht.
 *
 * `undefined` heisst: kein Befund, die Kette laeuft weiter. Alles andere ist ein Ergebnis.
 */
function primaerBefund(kontext: AnswerIntegrityContext): AnswerIntegrityState | undefined {
  const ursache = kontext.primaryResolutionFailure;
  if (kontext.primaryResolvable) {
    // WIDERSPRUCH: aufloesbar UND mit Ursache. Beide Angaben behaupten Gegenteiliges. Die Ursache
    // stillschweigend zu ignorieren waere die bequeme Auslegung — und sie machte einen kaputten
    // Aufrufer unsichtbar. KW-W3-22: fail-closed.
    return ursache === undefined ? undefined : "INVALIDATED";
  }
  // Nicht aufloesbar: GENAU EINE bekannte Ursache ist Pflicht. Fehlt sie oder ist sie fremd, ist der
  // Kontext unvollstaendig — und ein unvollstaendiger Kontext darf nie zu einer milderen Auskunft
  // fuehren als ein vollstaendiger.
  if (ursache === undefined || !BEKANNTE_PRIMAERURSACHEN.includes(ursache)) {
    return "INVALIDATED";
  }
  return ursache === "ACCESS_DENIED" || ursache === "REDACTION_REQUIRED"
    ? "REDACTED"
    : "INVALIDATED";
}

/**
 * DER INTEGRITAETSZUSTAND BEIM LESEN (KW-W3-18, KW-W3-20 B, KW-W3-21 B, KW-W3-22 A).
 *
 * DIE REIHENFOLGE IST DIE AUSSAGE, und sie ist seit KW-W3-22 vollstaendig kanonisch:
 *
 *   1 Snapshot-/Hashintegritaet
 *   2 Validierungsreferenzbefund (`validationRefState`)
 *   3 allgemeine Sperre/Redaktion (`gesperrt`)
 *   4 primaere Aufloesbarkeit samt geschlossener Ursache
 *   5 Ergaenzungsluecke -> `INCOMPLETE`/`PARTIAL`/`COMPLETE`-Bewertung
 *
 * Manipulation steht ZUERST und schlaegt alles andere: eine gefaelschte Zeile darf nie als
 * `REDACTED` beschoenigt werden („da war was, Sie duerfen es nur nicht sehen"), denn das waere die
 * freundlichste denkbare Luege ueber einen Angriff.
 *
 * Der Validierungsreferenzbefund steht VOR der allgemeinen Sperre, und zwar aus demselben Grund
 * eine Ebene tiefer (KW-W3-22 Entscheidung 1): ein gebrochener oder nicht verifizierbarer
 * Validierungsbeleg ist ein INTEGRITAETSDEFEKT des historischen Snapshots und darf nicht hinter
 * einer Sichtbeschraenkung verschwinden.
 *
 * Die primaere Aufloesbarkeit steht NACH der Sperre: wer ohnehin nichts sehen darf, bekommt keine
 * feinere Auskunft darueber, warum eine Referenz nicht auflaest.
 */
export function answerSnapshotIntegrity(
  snapshot: AnswerEvidenceSnapshot,
  kontext: AnswerIntegrityContext,
): AnswerIntegrityState {
  if (snapshot.integrityHash !== hashAnswerSnapshot(snapshot)) {
    return "INVALIDATED";
  }
  // ============================================================================================
  // W3-B (KW-W3-19) — DER REFERENZBEFUND, NACH DER MANIPULATIONSPRUEFUNG UND VOR DER SPERRE.
  // ============================================================================================
  //
  // NACH der Manipulationspruefung, weil ein gefaelschter Snapshot keine Grundlage fuer eine
  // Aussage ueber seine Referenz ist. VOR der Sperre, weil ein gebrochener Beleg nie als
  // „Sie duerfen nur nicht hinsehen" beschoenigt werden darf — dieselbe Regel wie oben, eine
  // Ebene tiefer.
  //
  // ENTSCHEIDEND: der Befund gilt NUR, wenn der Snapshot ueberhaupt eine Referenz traegt. Ein
  // ehrlich leeres Feld mit maschinenlesbarem Grund (KW-W3-18) ist KEIN gebrochener Beleg, sondern
  // eine benannte Luecke — sie faellt unten in die gewoehnliche Ergaenzungsluecke (`DEGRADED`).
  // Ohne diese Zeile wuerde W3-B jeden ehrlichen W3-A-Snapshot invalidieren, der die Referenz
  // (noch) nicht hat, und damit genau die Ehrlichkeit bestrafen, die W3-A hergestellt hat.
  const refBefund =
    snapshot.validationDecisionRef === null ? undefined : kontext.validationRefState;
  if (refBefund === "HASH_MISMATCH" || refBefund === "WRONG_EVENT_TYPE") {
    return "INVALIDATED";
  }
  if (refBefund === "WRONG_SUBJECT") {
    return "INVALIDATED";
  }
  if (refBefund === "MISSING") {
    // Die eine Stelle, an der die Rolle den Ausschlag gibt (KW-W3-19).
    return kontext.validationIstPrimaer === false ? "DEGRADED" : "INVALIDATED";
  }
  if (refBefund === "REDACTED") {
    return "REDACTED";
  }
  // ============================================================================================
  // PRIORITAET 3 — DIE ALLGEMEINE SPERRE (KW-W3-22 Entscheidung 1).
  // ============================================================================================
  //
  // Eigenstaendige Sicht-/Sperrentscheidung fuer diesen Snapshot beziehungsweise diesen Leser. Sie
  // wird NICHT aus der Aufloesungsursache und NICHT aus dem Referenzbefund abgeleitet — die drei
  // Wege zu `REDACTED` haben getrennte, einzige Zustaendigkeiten (KW-W3-22 Entscheidung 3).
  if (kontext.gesperrt) {
    return "REDACTED";
  }
  // ============================================================================================
  // PRIORITAET 4 — PRIMAERE AUFLOESBARKEIT SAMT GESCHLOSSENER URSACHE.
  // ============================================================================================
  //
  // Hier stand bis Auftrag 129 eine ursachenlose Zeile an PRIORITAET 2: `!primaryResolvable` ergab
  // unbedingt `INVALIDATED`. Damit sah ein fehlendes Leserecht genauso aus wie ein gebrochener
  // Beleg — und die Sperre kam zu spaet, um das zu verhindern. Beides ist jetzt getrennt.
  const primaer = primaerBefund(kontext);
  if (primaer !== undefined) {
    return primaer;
  }
  const ergaenzungOffen =
    !snapshot.evidence.every(ergaenzungVollstaendig) ||
    snapshot.resolutionId === null ||
    snapshot.validationDecisionRef === null;
  return ergaenzungOffen ? "DEGRADED" : "VALID";
}

// Öffentliche API des Moduls ask.
export { AskService, GESPRAECHSFADEN_MAX_FRAGEN } from "./src/service";
export type {
  AskAntwortZuschnitt,
  AskServiceDeps,
  AskPruefrahmen,
  AskResult,
  UngeprueftHinweis,
} from "./src/service";
// AUFNAHME 20260922 · R-0346 (Ben nacharbeit-9): der Zuschnitt der Antwort selbst.
export { schneideAntwortZu } from "./src/antwort-zuschnitt";
export type {
  BegriffHerkunft,
  ZuschnittAbschnitt,
  ZuschnittBegriff,
  ZuschnittDerAntwort,
  ZuschnittErgaenzung,
} from "./src/antwort-zuschnitt";
export { InMemoryGapRepo, type GapRepo } from "./src/repo";
// R-1089: der Meldeweg „Antwort falsch / Quelle passt nicht" — die Glocke liest dieselbe Aktion.
export {
  ANTWORT_MELDE_GRUENDE,
  ANTWORT_MELDUNG_ACTION,
  isAntwortMeldeGrund,
  type AntwortMeldeGrund,
  type AntwortMeldungQuittung,
} from "./src/antwort-meldung";
export { PgGapRepo, ASK_SCHEMA } from "./src/repo-pg";
// R-0773: erfolglose Suchen je Person (Begründung und Grenzen in `src/nulltreffer.ts`).
export {
  InMemoryNulltrefferRepo,
  NULLTREFFER_DECKEL,
  nulltrefferBegriff,
  nulltrefferEingrenzung,
  type NulltrefferRepo,
  type NulltrefferSuche,
} from "./src/nulltreffer";
export { PgNulltrefferRepo } from "./src/repo-pg";
// W3-A (KW-W3-18): der Repo-Kern der Antwortbelege. Die Fassade wird MITGESCHRIEBEN und nicht
// nachgereicht — die W2-A-Lehre (Preflight 39 F1): eine exportierte Konstante, die die
// Modulfassade nicht weiterreicht, ist fuer `services/app` unerreichbar, und der Fehler faellt
// erst der naechsten Welle auf.
export {
  InMemoryAnswerSnapshotRepo,
  pruefeSnapshotKette,
  type AnswerSnapshotRepo,
} from "./src/repo";
export { PgAnswerSnapshotRepo, ANSWER_SNAPSHOT_SCHEMA } from "./src/repo-pg";
export {
  ANSWER_SNAPSHOT_SCHEMA_VERSION,
  answerSnapshotHashMaterial,
  answerSnapshotIntegrity,
  answerSnapshotStatus,
  // JOB 541 D3: dieselbe Lehre wie oben — was `services/app` fuer den Lesepfad braucht, muss die
  // Fassade weiterreichen. `gehoertNutzer` und die Legacy-Zuordnung sind genau solche Stellen.
  gehoertNutzer,
  hashAnswerSnapshot,
  legacyValidationZuordnung,
} from "./src/types";
// W3-C (JOB 541 D3): das reine Lesemodell der Antwort-Erklaerung.
export { baueAnswerExplanation } from "./src/answer-explanation";
export type {
  AnswerExplanationEvidence,
  AnswerExplanationOutcome,
  AnswerExplanationSicht,
  AnswerExplanationView,
} from "./src/answer-explanation";
export type {
  AnswerEvidenceRef,
  AnswerEvidenceSnapshot,
  AnswerIntegrityContext,
  // KW-W3-22 (Auftrag 129): die geschlossene Ursache MUSS ueber die Fassade erreichbar sein — der
  // spaetere W3-C-Lesepfad in `services/app` bildet sie, und ein Typ, den die Fassade nicht
  // weiterreicht, ist dort schlicht nicht vorhanden (Lehre W2-A Preflight 39 F1).
  AnswerPrimaryResolutionFailure,
  AnswerIntegrityState,
  AnswerNullReason,
  AnswerRecord,
  AnswerSnapshotStatus,
  AnswerValidationDecisionRef,
  AnswerOwner,
  ValidationReferenceAbsenceReason,
} from "./src/types";
export {
  ANSWER_RECEIPT_TTL_MS,
  MIN_RECEIPT_SECRET_BYTES,
  ReceiptSecretError,
  parseConfiguredReceiptSecret,
  signAnswerReceipt,
  verifyAnswerReceipt,
} from "./src/receipt";
export { AskError, isGapPriority } from "./src/types";
export type { Gap, GapBelegbedarf, GapPriority, AskErrorCode } from "./src/types";
// AUFTRAG-mega34 B1: der kanonische, quellengebundene Evidenzzustand — die EINE Auslegung der
// Antwort-Einstufung für alle Verbraucher, die sie nicht selbst bilden können (Word/Klara).
export { answerCheckState, answerEvidence } from "./src/answer-evidence";
export type {
  AnswerCheckCaveat,
  AnswerCheckState,
  AnswerEvidence,
  AnswerEvidenceInput,
  AnswerGrade,
} from "./src/answer-evidence";
// AUFNAHME 20260922 · Antwort-Erklärung: Belastbarkeit, Zustandsfamilie und Konfliktseiten an der
// Antwort — gelesen aus der fertigen Einstufung, nicht neu eingestuft.
export {
  antwortBelastbarkeit,
  antwortZuschnitt,
  konfliktGegenseiten,
} from "./src/answer-belastbarkeit";
export type {
  AntwortBelastbarkeit,
  AntwortBelastbarkeitInput,
  AntwortKonflikt,
  AntwortLage,
  AntwortZuschnitt,
  ArgumentStufe,
  BelegteBeziehung,
  BelegteBeziehungsArt,
  FrageAnlass,
  FragendenRolle,
  BelastbarkeitsGrund,
  KonfliktSeite,
  QuellenBelastbarkeit,
  WoerterbuchErgaenzung,
} from "./src/answer-belastbarkeit";
// produkt:20261009:referenzki-quellenbelege (REF-01): Aussage → Quellenversion → Passage, die
// Auflösung mit aktuellen Rechten und die Eingabe der Referenz-Prüfung.
export {
  AUSSAGEN_BELEG_SCHEMA,
  FUNDSTELLEN_AUFLOESEN_MAX,
  FUNDSTELLEN_HINWEIS,
  aufKernaussagenBeschraenkt,
  bestaetigungGilt,
  bindeAussagen,
  fingerabdruck,
  leseFundstellenAnfrage,
  leseFundstellenVerweis,
  loeseFundstelleAuf,
  pruefPaket,
  quellenLink,
  belegstellenLink,
  volltextDerFassung,
} from "./src/aussage-fundstellen";
export type {
  Aussage,
  AussagenBeleg,
  BindungsQuelle,
  ExterneFundstelle,
  Fundstelle,
  FundstellenAufloesung,
  FundstellenLeser,
  FundstellenVerweis,
  FundstellenZustand,
  InterneFundstelle,
  ModellAngabe,
  PrueferAngabe,
  PruefPaket,
  PruefPosten,
  Teilaussage,
} from "./src/aussage-fundstellen";
export { redactGapForViewer, summarizeGaps } from "./src/gap-visibility";
// R-1630 / R-2176: der Stichtag des Antwortvergleichs — die Route liest ihn mit derselben Regel.
export { stichtagAus } from "./src/wissensstand-vergleich";
// R-1663 / R-2178: begründete Ansprechpartner-Vorschläge zu einer Wissenslücke.
export type {
  AnsprechpartnerAuskunft,
  AnsprechpartnerSpuren,
  AnsprechpartnerVorschlag,
} from "./src/ansprechpartner";
export type { GapView, GapViewerContext, GapSummary } from "./src/gap-visibility";

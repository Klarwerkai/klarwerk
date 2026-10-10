// Öffentliche API des Moduls output (FR-EXT-03 / SCRUM-117).
export { OutputService } from "./src/service";
export type { OutputServiceDeps } from "./src/service";
export {
  OUTPUT_KINDS,
  UNCERTAIN_TRUST_BELOW,
  OutputError,
  type OutputKind,
  type OutputSource,
  type OutputProvenance,
  type OutputDocument,
  type GenerateOutputInput,
  type OutputErrorCode,
} from "./src/types";
// AUFTRAG-mega29 C3: der Ehrlichkeits-Satz des Herkunftsblocks (+ der Renderer, der ihn trägt).
export { OUTPUT_NO_CHECK_NOTE, renderProvenance } from "./src/render";
// aufnahme:20260922:gesamt-wissensvermaechtnis — die Beiträge einer Person als Vermächtnis-Buch.
export {
  VERMAECHTNIS_OHNE_THEMA,
  erstelleVermaechtnisBuch,
  istBeitragVon,
  type VermaechtnisAusgelassen,
  type VermaechtnisBuch,
  type VermaechtnisEingabe,
} from "./src/vermaechtnis";
// produkt:wettbewerb:20261003:lernplattform — Übergabe an eine Lernplattform als SCORM-1.2-Paket.
export {
  LmsExportService,
  LmsExportError,
  SCORM_FORMAT,
  MAX_SCORM_EINHEITEN,
  leseLmsEmpfaenger,
  leseScormEingabe,
} from "./src/scorm";
export type {
  LmsExportServiceDeps,
  ScormBefund,
  ScormBefundCode,
  ScormBefundBereich,
  ScormEmpfaenger,
  ScormExportEingabe,
  ScormFassung,
  ScormMedienLeser,
  ScormMedium,
  ScormPaket,
  ScormPruefung,
} from "./src/scorm";
export { SCORM_BESCHRIFTUNG, SCORM_SPRACHEN, type ScormSprache } from "./src/scorm-laufzeit";
// RECHERCHE:pmo-fea-0004 — das Wissensupdate fürs Teamgespräch (auf Abruf, kein Versand).
export {
  WochenupdateService,
  WOCHENUPDATE_KEIN_VERSAND,
  WOCHENUPDATE_TAGE,
  WOCHENUPDATE_TITEL,
  leseWochenupdateBis,
  renderWochenupdate,
  waehleWochenupdate,
} from "./src/wochenupdate";
export type {
  Wochenupdate,
  WochenupdateArt,
  WochenupdateEintrag,
  WochenupdateServiceDeps,
} from "./src/wochenupdate";
// KA6 Stufe 1 (JOB 1491 D1): der Zuruf, der einen VORSCHLAG erzeugt und nichts schreibt.
// KA6 Stufe 2 (JOB 3026): `ZurufBindung` und `Ka6Einwilligungspruefer` kommen dazu — der Riegel
// liegt im Erzeuger und fragt das Sitzungstor, statt einem Client-Bool zu glauben.
export { ZurufService, ZurufError, ZURUF_ARTEN } from "./src/zuruf";
export type {
  ZurufArt,
  ZurufEingabe,
  ZurufBindung,
  Ka6Einwilligungspruefer,
  ZurufVorschlag,
  ZurufServiceDeps,
  ZurufFehlerCode,
  ZurufAuftrag,
  ZurufBeleg,
  Formulierer,
} from "./src/zuruf";

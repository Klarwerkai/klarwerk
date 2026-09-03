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

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

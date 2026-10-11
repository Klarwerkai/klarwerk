// Öffentliche API des media-Moduls (Video-/Audio-Import & -Analyse, SCRUM-382).
export {
  MediaAnalysisService,
  type MediaAnalysisDeps,
  SPRACHAUFNAHME_MAX_BYTES,
  type SprachTranskript,
} from "./src/service";
// SCRUM-502 R8 (Encapsulation): nach außen NUR der gecappte Weg. Der rohe whisperClient und
// createTranscriberFromEnv (Credential-Zugriff) bleiben modul-intern (Tests greifen white-box relativ
// auf ./src/transcriber zu). cappedTranscriber bleibt für Tests/On-prem-Wrapping exportiert.
export { cappedTranscriber, createCappedTranscriberFromEnv } from "./src/transcriber";
export type { MediaAnalysis, MediaError, Transcriber } from "./src/types";
export { MediaAnalysisError, TranscriberConfidentialError } from "./src/types";

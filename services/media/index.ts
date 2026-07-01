// Öffentliche API des media-Moduls (Video-/Audio-Import & -Analyse, SCRUM-382).
export { MediaAnalysisService, type MediaAnalysisDeps } from "./src/service";
export { createTranscriberFromEnv, whisperClient } from "./src/transcriber";
export type { MediaAnalysis, MediaError, Transcriber } from "./src/types";
export { MediaAnalysisError } from "./src/types";

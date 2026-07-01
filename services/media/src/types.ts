// SCRUM-382: Video-/Audio-Import & -Analyse (Teil der Knowledge-Import-Pipeline, Konzept §5).
// Grundsatz G-2/G-3: Ohne aktiven Transkriptions-Dienst wird NICHTS erfunden — der Zustand
// wird ehrlich als "inactive" ausgewiesen; die Analyse ist dann bewusst nicht verfügbar.

export interface MediaAnalysis {
  objectId: string;
  // Der gewonnene Rohtext (Transkript). Nur vorhanden, wenn engineActive.
  transcript: string | null;
  engineActive: boolean;
  // Ehrliche Herkunft: Modellname (z. B. "openai:whisper-1") oder null.
  engine: string | null;
  // Nutzerlesbare Einordnung (DE), immer gesetzt.
  note: string;
}

// Austauschbarer Transkriptions-Client (modellagnostisch wie der Reasoner).
export interface Transcriber {
  name: string;
  transcribe(bytes: Buffer, mime: string, locale: "de" | "en"): Promise<string>;
}

export type MediaError = "NOT_FOUND" | "UNSUPPORTED_KIND" | "ENGINE_FAILED";

export class MediaAnalysisError extends Error {
  readonly code: MediaError;

  constructor(code: MediaError, message: string) {
    super(message);
    this.code = code;
    this.name = "MediaAnalysisError";
  }
}

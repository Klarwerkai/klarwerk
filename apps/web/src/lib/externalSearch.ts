// Reines, DOM-freies Mapping externer Suchtreffer → add-source-Payload (SCRUM-118).
// Übernimmt NIE automatisch; wird erst durch Nutzerklick aufgerufen. Die Quelle
// bleibt serverseitig immer external/nicht peer-validiert.
import type { ExternalResult } from "../api/types";

export interface SourcePayload {
  label: string;
  url: string;
  excerpt: string;
  provider: string;
}

const MAX_EXCERPT = 300;

export function toSourcePayload(result: ExternalResult): SourcePayload {
  const label = result.title.trim();
  return {
    label,
    url: result.url.trim(),
    excerpt: result.snippet.trim().slice(0, MAX_EXCERPT),
    provider: result.provider.trim(),
  };
}

// Ein Treffer ist anhängbar, wenn er einen Titel hat (Label-Pflichtfeld serverseitig).
export function isAttachable(result: ExternalResult): boolean {
  return result.title.trim().length > 0;
}

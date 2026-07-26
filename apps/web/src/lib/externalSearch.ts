// Reines, DOM-freies Mapping externer Suchtreffer → Wartelisten-/Anzeige-Eintrag (SCRUM-118).
// Übernimmt NIE automatisch; wird erst durch Nutzerklick aufgerufen. Die Quelle
// bleibt serverseitig immer external/nicht peer-validiert.
//
// AUFTRAG-mega15 Block B (bens SB-4): `provider` ist hier ANZEIGEWERT — die Warteliste im Erfassen
// und die Trefferliste im Prüfbereich zeigen ihn. An den Server geht er NICHT: die Herkunft leitet
// der Server aus der Adresse ab (services/external-search/src/provenance.ts), und der Weg dorthin
// führt über `toAddSourceRequest` (lib/koSource.ts), das genau dieses Feld abschneidet.
import type { ExternalResult } from "../api/types";

export interface SourcePayload {
  label: string;
  url: string;
  excerpt: string;
  /** Nur Anzeige. Wird nie an add-source geschickt und dort auch nicht gelesen. */
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

// Reine, DOM-freie Helfer für Anhänge (SCRUM-121).
// Neue Anhänge tragen objectId + thumbnail (Referenz statt Inline-Original);
// Alt-Anhänge tragen dataUrl. Die Vorschau bleibt in beiden Fällen möglich.
import type { KoAttachment } from "../api/types";

// Bevorzugt thumbnail (neu), fällt auf dataUrl (alt) zurück; null wenn keins.
export function attachmentPreview(a: Pick<KoAttachment, "thumbnail" | "dataUrl">): string | null {
  return a.thumbnail ?? a.dataUrl ?? null;
}

// Läuft dieser Anhang über den Object-Store (neue, saubere Variante)?
export function isObjectAttachment(a: Pick<KoAttachment, "objectId">): boolean {
  return Boolean(a.objectId);
}

// Teil B (Pedis Befund): die Bildergalerie schon im ENTWURF sichtbar — nicht erst in der
// Leseansicht. DIESELBE BodyImageGallery (ben-abgenommen inkl. Modal/Fokus), abgeleitet aus dem
// AKTUELLEN Editor-bodyHtml; gegen Render-Last debounced (300 ms — derselbe Hook wie die Suche).
// Kein Duplikat, keine neue Persistenz: ohne verankertes Bild rendert die Galerie selbst nichts.
import { LIBRARY_SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../lib/useDebouncedValue";
import { BodyImageGallery } from "./BodyImageGallery";

export function DraftBodyGallery({ bodyHtml }: { bodyHtml: string }): JSX.Element | null {
  const debounced = useDebouncedValue(bodyHtml, LIBRARY_SEARCH_DEBOUNCE_MS);
  return <BodyImageGallery bodyHtml={debounced} />;
}

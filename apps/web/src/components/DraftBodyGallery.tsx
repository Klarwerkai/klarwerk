// Teil B (Pedis Befund): die Bildergalerie schon im ENTWURF sichtbar — nicht erst in der
// Leseansicht. DIESELBE BodyImageGallery (ben-abgenommen inkl. Modal/Fokus), abgeleitet aus dem
// AKTUELLEN Editor-bodyHtml; gegen Render-Last debounced (300 ms — derselbe Hook wie die Suche).
// Kein Duplikat, keine neue Persistenz: ohne verankertes Bild rendert die Galerie selbst nichts.
import { LIBRARY_SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../lib/useDebouncedValue";
import { BodyImageGallery } from "./BodyImageGallery";

// AUFTRAG-mega69 Block A: `onEditCaption` reicht den Weg zum Bildbeschreibungs-Formular durch —
// im Entwurf ist der Editor immer da, die Galerie darunter bekommt damit denselben Einstieg.
export function DraftBodyGallery({
  bodyHtml,
  onEditCaption,
}: {
  bodyHtml: string;
  onEditCaption?: ((imageId: string) => void) | undefined;
}): JSX.Element | null {
  const debounced = useDebouncedValue(bodyHtml, LIBRARY_SEARCH_DEBOUNCE_MS);
  return <BodyImageGallery bodyHtml={debounced} onEditCaption={onEditCaption} />;
}

// Teil B (Pedis Befund): die Bildergalerie schon im ENTWURF sichtbar — nicht erst in der
// Leseansicht. DIESELBE BodyImageGallery (ben-abgenommen inkl. Modal/Fokus), abgeleitet aus dem
// AKTUELLEN Editor-bodyHtml; gegen Render-Last debounced (300 ms — derselbe Hook wie die Suche).
// Kein Duplikat, keine neue Persistenz: ohne verankertes Bild rendert die Galerie selbst nichts.
import { useTranslation } from "react-i18next";
import { bildverlust } from "../lib/bildverlust";
import { extractBodyImages } from "../lib/bodyImages";
import { LIBRARY_SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../lib/useDebouncedValue";
import { BodyImageGallery } from "./BodyImageGallery";

// AUFTRAG-mega69 Block A: `onEditCaption` reicht den Weg zum Bildbeschreibungs-Formular durch —
// im Entwurf ist der Editor immer da, die Galerie darunter bekommt damit denselben Einstieg.
//
// JOB 512 (R5): `quellBildzahl` ist die Zahl der Bilder in der QUELLDATEI, erhoben beim Import VOR
// jedem Budget-/Formatabzug und mit dem Entwurf persistiert (DraftPayload.sourceImageCount). Ohne
// sie kann diese Galerie einen Bildverlust prinzipiell nicht erkennen: „0 von 0" sähe aus wie ein
// Dokument, das nie Bilder hatte. Fehlt sie, schweigt der Hinweis — es wird nichts behauptet.
export function DraftBodyGallery({
  bodyHtml,
  onEditCaption,
  quellBildzahl,
}: {
  bodyHtml: string;
  onEditCaption?: ((imageId: string) => void) | undefined;
  quellBildzahl?: number | null | undefined;
}): JSX.Element | null {
  const { t } = useTranslation();
  const debounced = useDebouncedValue(bodyHtml, LIBRARY_SEARCH_DEBOUNCE_MS);
  // Gezählt wird auf DEMSELBEN debouncten Stand, den die Galerie darunter zeigt — sonst meldete der
  // Hinweis eine Abweichung gegen ein Bild, das gerade erst getippt wurde. `extractBodyImages` ist
  // dieselbe Quelle der Wahrheit, aus der die Galerie ihre Kacheln bildet; damit können Meldung und
  // Galerie sich nicht widersprechen.
  //
  // GEMESSEN, nicht vermutet (JOB 512 D5, tests/capture/job512-bildverlust-kette-mounted.test.tsx):
  // Solange der debouncte Stand dem aktuellen Body HINTERHERHINKT, ist der Vergleich gegenstandslos.
  // Beim Laden eines Entwurfs steht `debounced` noch auf dem leeren Anfangswert, während der Body
  // bereits seine Bilder trägt — der Hinweis meldete dann für ~300 ms einen Verlust, den es nicht
  // gibt. Ein Hinweis, der aufblitzt und wieder verschwindet, ist schlimmer als keiner: er macht
  // den Verlust zu einer Zufallsbeobachtung. Deshalb wird NUR verglichen, wenn beide Stände
  // übereinstimmen — fail-closed wie überall sonst in dieser Kette.
  const standAktuell = debounced === bodyHtml;
  const verlust = standAktuell
    ? bildverlust(quellBildzahl, extractBodyImages(debounced).length)
    : ({ art: "unbekannt" } as const);
  return (
    <>
      {verlust.art === "verlust" ? (
        // `<output>` statt `<p role="status">`: dieselbe Ansage an die Vorlesehilfe, aber als
        // semantisches Element — so verlangt es die a11y-Regel `useSemanticElements`.
        <output data-testid="draft-gallery-loss">
          {t("ko.galleryLoss", { n: verlust.fehlend, m: verlust.quelle })}
        </output>
      ) : null}
      <BodyImageGallery bodyHtml={debounced} onEditCaption={onEditCaption} />
    </>
  );
}

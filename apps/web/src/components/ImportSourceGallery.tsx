// AUFTRAG-ic7-import-vision + uxpol1 (PAKET 2): EHRLICHE Quellen-Galerie. Zeigt visuell, wohin die
// Import-Reise geht, ohne je eine Fähigkeit vorzutäuschen. Zwei Gruppen: Systeme (PAKET 1) und
// Dateien (PAKET 2) — beide über das GEMEINSAME, polierte FileTypePicker-Bauteil (EINE Design-Sprache
// mit dem Erfassen-Dateityp-Picker).
//
// Ehrlichkeit vor Optik (unangetastet):
//  - NUR "active"-Kacheln lösen über onActivate den echten, bereits existierenden Import-Fluss aus.
//  - Ein Klick auf "soon"/"planned" startet NIE einen Import, öffnet kein Formular, zeigt keinen
//    Fortschritt — er blendet nur einen ruhigen, nicht-modalen, ehrlichen Hinweis ein (aria-live).
//  - Badges tragen TEXT (nicht nur Farbe); jede Kachel ist ein <button> (tastaturfokussierbar).
import { useTranslation } from "react-i18next";
import { FILE_SOURCES, SYSTEM_SOURCES } from "../lib/importSourceGallery";
import { FileTypePicker, systemIcon } from "./FileTypePicker";

// AUFTRAG-mega32 BLOCK G: der Auf-/Zu-Zustand wird JE BROWSER gemerkt, wie bei „Weitere Filter" in
// der Bibliothek. Zwei Schlüssel — Systeme und Dateien sind zwei getrennte Gruppen, und wer die eine
// aufklappt, hat damit über die andere nichts gesagt.
const GALLERY_SYSTEMS_PLANNED_STORAGE_KEY = "klarwerk.import.gallery.systems.plannedOpen";
const GALLERY_FILES_PLANNED_STORAGE_KEY = "klarwerk.import.gallery.files.plannedOpen";

export function ImportSourceGallery({
  onActivate,
}: {
  // Wird AUSSCHLIESSLICH für aktive Kacheln aufgerufen (echter, bestehender Fluss). Für bald/geplant
  // bleibt dieser Callback bewusst unberührt — kein Import, kein Konnektor-Call (das steuert der Picker).
  onActivate: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <FileTypePicker
        title={t("imp.gallery.systemsTitle")}
        sources={SYSTEM_SOURCES}
        onActivate={onActivate}
        iconFor={systemIcon}
        collapsePlanned
        plannedStorageKey={GALLERY_SYSTEMS_PLANNED_STORAGE_KEY}
      />
      <FileTypePicker
        title={t("imp.gallery.filesTitle")}
        sources={FILE_SOURCES}
        onActivate={onActivate}
        collapsePlanned
        plannedStorageKey={GALLERY_FILES_PLANNED_STORAGE_KEY}
      />
    </div>
  );
}

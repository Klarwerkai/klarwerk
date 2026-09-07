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
//
// ================================================================================================
// JOB 3190 (UX-18) — DIE UNEHRLICHKEIT LIEF HIER IN DIE ANDERE RICHTUNG.
// ================================================================================================
//
// Bis hierher hat diese Fläche eine VORHANDENE Fähigkeit verschwiegen: Word und PDF standen als
// „bald" da, obwohl dieselbe Datei im Erfassen längst eingelesen wird. Wer das las, ging davon aus,
// dass es die Funktion nicht gibt. Jetzt sagt die Kachel „im Erfassen" — und sie IST der Weg
// dorthin: ein echtes `<a>` auf die Erfassen-Route, mit Maus, Tab/Enter und Browser-Rückweg.
//
// WIE WEIT SIE TRÄGT, STEHT AUF IHR (Runde 2). Der Klick landet auf dem BLATT des Erfassens; der
// Dateiimport liegt dort noch hinter „Datei" → „Datei importieren" — gemessen im Browser
// (`kachel-schmal-chromium.test.ts`, Fall B4: `{"dateiauswahl":false,"dateieingang":true,
// "dateiwerkzeug":true}`). Diese zwei Schritte stehen deshalb SICHTBAR auf der Kachel, im Wortlaut
// der Zielfläche. Ein Deep-Link, der den Dateiimport in EINEM Schritt öffnete, müsste
// `components/erfassen/Blatt.tsx` lesen lassen (`ansicht` kennt dort keinen Parameter) — das ist
// kein Zielpfad dieses Auftrags und steht als Rest in der Rückgabe.
//
// KEIN NEUER IMPORT. Die Kachel öffnet keinen Dialog, setzt kein `accept`, ruft keinen Konnektor —
// sie navigiert auf den VORHANDENEN Weg. `onActivate` bleibt weiterhin den aktiven Kacheln
// vorbehalten.
//
// DIE ROUTE WIRD NICHT GETIPPT, SONDERN GELESEN: sie kommt aus derselben Registry, aus der der
// Router sein Gate zieht (`app/navigation.ts`, `ALL_ITEMS`, Eintrag `erfassen` → `/erfassen`,
// dort auch als Route verdrahtet: `routes.tsx:203-205` über `GUARDED_ITEMS`). Ein getippter Pfad
// wäre eine zweite Wahrheit, die bei der nächsten Umbenennung ins Leere zeigt.
//
// UND ER IST VON HIER AUS IMMER BEGEHBAR: `/import` verlangt `minRole: "admin"`
// (`app/navigation.ts:281`), `/erfassen` verlangt `minRole: "experte"` (`:123`); nach `ROLE_RANK`
// (`:33`) schliesst Admin Experte ein. Wer diese Galerie überhaupt sieht, darf also auch dorthin.
import { useTranslation } from "react-i18next";
import { ALL_ITEMS } from "../app/navigation";
import { FILE_SOURCES, type GallerySource, SYSTEM_SOURCES } from "../lib/importSourceGallery";
import { FileTypePicker, systemIcon } from "./FileTypePicker";

// AUFTRAG-mega32 BLOCK G: der Auf-/Zu-Zustand wird JE BROWSER gemerkt, wie bei „Weitere Filter" in
// der Bibliothek. Zwei Schlüssel — Systeme und Dateien sind zwei getrennte Gruppen, und wer die eine
// aufklappt, hat damit über die andere nichts gesagt.
const GALLERY_SYSTEMS_PLANNED_STORAGE_KEY = "klarwerk.import.gallery.systems.plannedOpen";
const GALLERY_FILES_PLANNED_STORAGE_KEY = "klarwerk.import.gallery.files.plannedOpen";

/**
 * Die Erfassen-Route, AUS DER REGISTRY gelesen. Fehlt der Eintrag einmal, gibt es kein Ziel und
 * damit keinen Link — dann bleibt die Kachel ein Knopf mit dem ehrlichen Hinweis, statt auf einen
 * erfundenen Pfad zu zeigen (fail-closed).
 */
const ERFASSEN_ROUTE: string | null =
  ALL_ITEMS.find((item) => item.id === "erfassen")?.path ?? null;

/** Nur „anderswo verfügbar" führt weg von hier — jeder andere Zustand behält sein Verhalten. */
function erfassenZielFuer(source: GallerySource): string | null {
  return source.state === "elsewhere" ? ERFASSEN_ROUTE : null;
}

export function ImportSourceGallery({
  onActivate,
}: {
  // Wird AUSSCHLIESSLICH für aktive Kacheln aufgerufen (echter, bestehender Fluss). Für bald/geplant
  // bleibt dieser Callback bewusst unberührt — kein Import, kein Konnektor-Call (das steuert der Picker).
  onActivate: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div id="import-source-gallery" className="space-y-4">
      <FileTypePicker
        title={t("imp.gallery.systemsTitle")}
        sources={SYSTEM_SOURCES}
        onActivate={onActivate}
        iconFor={systemIcon}
        collapsePlanned
        plannedStorageKey={GALLERY_SYSTEMS_PLANNED_STORAGE_KEY}
      />
      <a
        href="/demonstration/importwege.html"
        className="inline-block rounded text-sm text-muted underline underline-offset-4 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        {t("imp.gallery.src.jira")} / {t("imp.gallery.src.confluence")} →
      </a>
      <FileTypePicker
        title={t("imp.gallery.filesTitle")}
        sources={FILE_SOURCES}
        onActivate={onActivate}
        hrefFor={erfassenZielFuer}
        collapsePlanned
        plannedStorageKey={GALLERY_FILES_PLANNED_STORAGE_KEY}
      />
    </div>
  );
}

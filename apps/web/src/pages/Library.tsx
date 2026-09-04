import { BibliothekFlaeche } from "../components/bibliothek/BibliothekFlaeche";

// ==================================================================================================
// JOB 3063 · H4 — DIE BIBLIOTHEK IST EINE FLÄCHE, KEINE TREFFERWAND MEHR.
// ==================================================================================================
//
// Diese Datei trug bis zu diesem Auftrag 1.370 Zeilen: Kicker, Suchfeld mit Hilfe-Tipp, Export-
// Leiste, Bestandssatz, Karte „Antwort statt nur Treffer?", Reife-Erklärbox, gespeicherte Sichten,
// Sortier- und Untergruppen-Reihen, eine Facettenschiene über zehn Dimensionen und Trefferzeilen mit
// bis zu neun Abzeichen. Gemessen am 04.09.2026 in Chromium an der gebauten Seite: 1.059 Zeichen
// sichtbarer Text bei EINEM Wissensobjekt im Bestand.
//
// JETZT: links die Liste, rechts der Eintrag zum Lesen — dieselbe Fläche, die `/wissen/:id` zeigt
// (`components/bibliothek/BibliothekFlaeche.tsx`). Keine Funktion ist verloren; wo sie hingezogen
// ist, steht in der Tabelle im Kopf jener Datei.
//
// KEIN `PageHeader` mehr: die Hülle nennt die Seite (Auftrag §5, Lieferung 1). Der Routen-Anker
// `data-testid="page-bibliothek"` — er hängt in `ui.tsx` an `PageHeader` — wandert deshalb an die
// Fläche selbst, damit die Rauchprobe der Kernrouten ihn weiter findet.
export function Library(): JSX.Element {
  return (
    <div data-testid="page-bibliothek">
      <BibliothekFlaeche />
    </div>
  );
}

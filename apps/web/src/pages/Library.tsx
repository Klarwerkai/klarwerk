import { useTranslation } from "react-i18next";
import { HelpTip } from "../components/HelpTip";
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
//
// ==================================================================================================
// JOB 3669 — DIE SEITENHILFE DIESER SEITE (Zahnrad → „Seitenhilfe").
// ==================================================================================================
//
// Das Zahnrad-Menü stellte auf `/bibliothek` bis hierher genau EINEN Satz bereit: den Nav-Erklärsatz
// aus dem Hilfekapitel `help.library.*` („Die Bibliothek durchsucht und filtert den Bestand …"), den
// `shell/ZahnradMenue.tsx` aus der Route ableitet. Er sagt, WAS die Bibliothek ist — er sagt nicht,
// wo auf DIESER Fläche das Suchfeld liegt (im Kopfband, nicht auf der Seite), wo Filter und Sichten
// liegen (im „…"-Menü über der Liste) und was der nächste Schritt ist.
//
// Genau das ergänzt der Tipp hier, und nur das: er wiederholt den Kapitelsatz nicht. Er rendert
// nichts im Sichtfeld (`components/HelpTip.tsx`) — die Fläche von JOB 3063 bleibt unverändert.
export function Library(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div data-testid="page-bibliothek">
      <HelpTip title={t("seitenhilfe.bibliothek.title")} body={t("seitenhilfe.bibliothek.body")} />
      <BibliothekFlaeche />
    </div>
  );
}

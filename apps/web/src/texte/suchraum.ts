// ================================================================================================
// SUCHRAUM UND KOMBINIERBARE FACETTEN · DIE TEXTE DIESES AUFTRAGS — bei ihrer Funktion.
// ================================================================================================
//
// WOHER SIE KOMMEN: aus `aufnahme:20260922:gesamt-suche-filter` (Bibliothek, Leseansicht,
// Änderungsübersicht, Protokoll). Sie standen in diesem Arbeitsstrang in `apps/web/src/i18n.ts`;
// parallel hat `main` die Grundwörterbücher nach `apps/web/src/woerterbuch/` verlegt (I18N-AUFTEILUNG)
// und für neue Texte die Textmodule vorgeschrieben. Beim Zusammenführen sind sie deshalb WÖRTLICH,
// in allen drei Sprachen, hierher umgezogen — kein Wert geändert, keiner verloren.
//
// ES SIND ALTNAMEN und stehen deshalb in `legacySchluessel`: die Fläche (`BibliothekFlaeche.tsx`,
// `BibliothekListe.tsx`, Leseansicht) und die Tests lesen sie unter genau diesen Namen, und
// `audit.action.ko_domain_changed` leitet `lib/auditAction.ts` aus dem Protokollvorgang
// `ko.domain-changed` ab, den `services/knowledge-object/src/service.ts` schreibt. Neue Schlüssel
// dieses Nutzerwegs heissen `suchraum.<name>`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "suchraum.",
  legacySchluessel: [
    "ko.read.weitereAngaben",
    "audit.action.ko_domain_changed",
    "ko.revision.field.schlagwoerter",
    "lib.facet.domain",
    "lib.sort.risk",
    "lib.views.saveScope",
    "lib.liste.leerRaum",
    "lib.liste.leerAndererRaum",
    "lib.ansicht.label",
    "lib.ansicht.liste",
    "lib.ansicht.karten",
    "lib.auswahl.modus",
    "lib.auswahl.anzahl_one",
    "lib.auswahl.anzahl_other",
    "lib.auswahl.leeren",
    "lib.auswahl.zeile",
    "lib.lesen.ausserhalbTreffer",
  ],
  de: {
    // R-0432 (K3): die Leseansicht sagt „Schlagwörter" wie Facette und Trefferart. Neuer Schlüssel
    // statt geändertem Wert: `ko.read.moreDetails` steht im eingefrorenen Textschnappschuss
    // (tests/i18n-textmodule, mit Prüfsumme) und wird von keiner Fläche mehr gelesen.
    "ko.read.weitereAngaben": "Weitere Angaben (Bedingungen · Maßnahmen · Schlagwörter)",
    "audit.action.ko_domain_changed": "Fachgebiet geändert",
    // R-0432 (K3): der gelesene Feldname der Änderungsübersicht (`koRevisionItemLabelKey`).
    "ko.revision.field.schlagwoerter": "Schlagwörter",
    // R-0431 / R-1728 / FR-LIB-01 (K2): das Fachgebiet als eigene Achse neben der Kategorie.
    "lib.facet.domain": "Fachgebiet",
    // R-1006: Reife (Zu prüfen → In Prüfung → Nutzbar), darin Vertrauen niedrig zuerst
    // (`librarySort.ts`, `riskRankOf` über den angezeigten Zustand).
    "lib.sort.risk": "Risiko (unsicher zuerst)",
    // N-0060: der Speicherumfang direkt unter „Diese Suche merken" (Kurzfassung von storageHint).
    "lib.views.saveScope":
      "Wird nur in diesem Browser gespeichert – nicht auf dem Server, nicht auf anderen Geräten. {{ownership}}",
    // R-0446 / R-1812: der Nulltreffer sagt, WORIN nichts gefunden wurde — mit dem Wort der
    // Ortszeile (`lib.ownScope.*`) — und nennt in der eigenen Ablage den Weg in den Gesamtbestand.
    "lib.liste.leerRaum": "Gesucht in: {{raum}}",
    "lib.liste.leerAndererRaum": "In „{{raum}}“ suchen",
    // R-1006 (K16): Darstellung (kompakte Liste ist Vorgabe) und Mehrfachauswahl im Menü „…".
    "lib.ansicht.label": "Ansicht",
    "lib.ansicht.liste": "Kompakte Liste",
    "lib.ansicht.karten": "Karten",
    "lib.auswahl.modus": "Mehrere auswählen",
    "lib.auswahl.anzahl_one": "{{count}} ausgewählt",
    "lib.auswahl.anzahl_other": "{{count}} ausgewählt",
    "lib.auswahl.leeren": "Auswahl aufheben",
    "lib.auswahl.zeile": "„{{titel}}“ auswählen",
    // N-0074: der geöffnete Beitrag liegt ausserhalb der aktuellen Treffer (Suche/Filter/Bereich).
    "lib.lesen.ausserhalbTreffer":
      "Dieser Beitrag ist nicht unter den aktuellen Treffern – Suche, Filter oder Bereich schließen ihn aus.",
  },
  en: {
    "ko.read.weitereAngaben": "More details (conditions · measures · tags)",
    "audit.action.ko_domain_changed": "Domain changed",
    "ko.revision.field.schlagwoerter": "Tags",
    "lib.facet.domain": "Domain",
    "lib.sort.risk": "Risk (least reliable first)",
    "lib.views.saveScope":
      "Saved only in this browser – not on the server, not on other devices. {{ownership}}",
    "lib.liste.leerRaum": "Searched in: {{raum}}",
    "lib.liste.leerAndererRaum": "Search in “{{raum}}”",
    "lib.ansicht.label": "View",
    "lib.ansicht.liste": "Compact list",
    "lib.ansicht.karten": "Cards",
    "lib.auswahl.modus": "Select several",
    "lib.auswahl.anzahl_one": "{{count}} selected",
    "lib.auswahl.anzahl_other": "{{count}} selected",
    "lib.auswahl.leeren": "Clear selection",
    "lib.auswahl.zeile": "Select “{{titel}}”",
    "lib.lesen.ausserhalbTreffer":
      "This entry is not among the current results – search, filters or scope exclude it.",
  },
  nl: {
    "ko.read.weitereAngaben": "Meer details (voorwaarden · maatregelen · trefwoorden)",
    "audit.action.ko_domain_changed": "Vakgebied gewijzigd",
    "ko.revision.field.schlagwoerter": "Trefwoorden",
    "lib.facet.domain": "Vakgebied",
    "lib.sort.risk": "Risico (minst betrouwbaar eerst)",
    "lib.views.saveScope":
      "Alleen in deze browser opgeslagen – niet op de server, niet op andere apparaten. {{ownership}}",
    "lib.liste.leerRaum": "Gezocht in: {{raum}}",
    "lib.liste.leerAndererRaum": "Zoeken in ‘{{raum}}’",
    "lib.ansicht.label": "Weergave",
    "lib.ansicht.liste": "Compacte lijst",
    "lib.ansicht.karten": "Kaarten",
    "lib.auswahl.modus": "Meerdere selecteren",
    "lib.auswahl.anzahl_one": "{{count}} geselecteerd",
    "lib.auswahl.anzahl_other": "{{count}} geselecteerd",
    "lib.auswahl.leeren": "Selectie opheffen",
    "lib.auswahl.zeile": "‘{{titel}}’ selecteren",
    "lib.lesen.ausserhalbTreffer":
      "Dit item staat niet tussen de huidige resultaten – zoekopdracht, filters of bereik sluiten het uit.",
  },
} satisfies Textmodul;

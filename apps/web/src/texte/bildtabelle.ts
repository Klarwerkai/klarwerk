// ================================================================================================
// OCR-E03 · BILDHAFTE TABELLEN ALS BEARBEITBARE TABELLEN — die Texte dieses Nutzerwegs.
// ================================================================================================
//
// Neu mit dem Auftrag produkt:20261012:klara-ocr-tabellen. Verwendet in
// `components/BildTabelleBearbeiten.tsx` (unter dem Befund in `components/BildBefundListe.tsx`).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "bildtabelle.",
  legacySchluessel: [],
  de: {
    "bildtabelle.titel": "Tabelle aus dem Bild — bearbeitbar",
    "bildtabelle.hinweis":
      "{{zeilen}} Zeilen × {{spalten}} Spalten. Änderungen gelten nur für dieses Bild; Befund und Originalbild bleiben, wie sie sind.",
    "bildtabelle.kopfzeile": "Die erste Zeile ist als Überschrift erkannt.",
    "bildtabelle.legende":
      "[?…] unsicher gelesen, [unleserlich] nicht lesbar, [ungeprüft] im Bild nicht prüfbar — nichts davon ist ergänzt. Leere Zellen sind im Bild als leer geprüft.",
    "bildtabelle.unsicher": "Unsichere Zellen: {{n}}",
    "bildtabelle.mehrdeutig": "Zellen mit unsicherer Spaltenzuordnung: {{n}}",
    "bildtabelle.zelle": "Zeile {{zeile}}, Spalte {{spalte}}",
    "bildtabelle.zelle.unsicher": "unsicher gelesen",
    "bildtabelle.zelle.unleserlich": "nicht lesbar",
    "bildtabelle.zelle.ungeprueft": "nicht geprüft — ob hier etwas steht, ist offen",
    "bildtabelle.zelle.berichtigt": "berichtigt — erkannt war „{{roh}}“",
    "bildtabelle.zelle.fundstelle":
      "Stelle von Zeile {{zeile}}, Spalte {{spalte}} im Original zeigen",
    "bildtabelle.berichtigtTabelle":
      "Die Tabelle zeigt die gespeicherte Berichtigung dieses Bildes; das Originalbild ist unverändert.",
    "bildtabelle.nichtZugeordnet":
      "Teile der Berichtigung ohne eindeutige Tabellenzelle (nicht in die Tabelle eingesetzt): {{teile}}",
    "bildtabelle.speichern": "Als Berichtigung speichern",
    "bildtabelle.gespeichert":
      "Gespeichert — die Tabelle gilt jetzt als Berichtigung dieses Bildes (Quelle und Bildfassung). Rückgängig und Zurücksetzen am Bildtext.",
    "bildtabelle.verweigert":
      "Nicht gespeichert: Diese Rolle darf erkannten Text nicht berichtigen.",
    "bildtabelle.speicherFehler": "Nicht gespeichert: {{grund}}",
    "bildtabelle.nurAnsicht.nichtAngebunden":
      "Änderungen gelten nur in dieser Ansicht: Diese Fläche speichert keine Berichtigungen.",
    "bildtabelle.nurAnsicht.ohneQuelle":
      "Änderungen gelten nur in dieser Ansicht: Dieser Text ist noch nicht gespeichert, es gibt keine Quelle für eine dauerhafte Berichtigung.",
    "bildtabelle.nurAnsicht.keinRecht":
      "Änderungen gelten nur in dieser Ansicht: Diese Rolle darf erkannten Text nicht berichtigen.",
    "bildtabelle.nurAnsicht.laedt":
      "Gespeicherte Berichtigungen werden geladen — Speichern ist danach möglich.",
    "bildtabelle.nurAnsicht.fehler":
      "Gespeicherte Berichtigungen konnten nicht geladen werden; Änderungen gelten nur in dieser Ansicht.",
    "bildtabelle.zelle.leer": "leer",
    "bildtabelle.zelle.mehrdeutig": "Spalte?",
    "bildtabelle.zelle.mehrdeutigLang": "Zuordnung zu dieser Spalte nicht eindeutig",
    "bildtabelle.zelle.bearbeitet": "geändert",
    "bildtabelle.zelle.zuruecksetzen":
      "Zeile {{zeile}}, Spalte {{spalte}} auf das Erkannte zurücksetzen",
    "bildtabelle.allesZuruecksetzen": "Alle Änderungen verwerfen",
    "bildtabelle.kopieren": "Tabelle kopieren",
    "bildtabelle.kopiert.tabelle":
      "Kopiert — als Tabelle (HTML) und als Text mit Tabulatoren. In einen Text einfügen oder in eine Tabellenkalkulation.",
    "bildtabelle.kopiert.nurText":
      "Kopiert — nur als Text mit Tabulatoren; dieser Browser nimmt keine HTML-Tabelle an.",
    "bildtabelle.kopiert.nichtVerfuegbar":
      "Die Zwischenablage ist in diesem Browser nicht verfügbar.",
    "bildtabelle.kopiert.fehlgeschlagen": "Kopieren fehlgeschlagen.",
    "bildtabelle.beschriftung": "Tabelle aus {{quelle}}, Bild {{bild}} (Texterkennung)",
    "bildtabelle.beschriftungFolie":
      "Tabelle aus {{quelle}}, Folie {{folie}}, Bild {{bild}} (Texterkennung)",
  },
  en: {
    "bildtabelle.titel": "Table from the image — editable",
    "bildtabelle.hinweis":
      "{{zeilen}} rows × {{spalten}} columns. Changes apply to this image only; the result and the original image stay as they are.",
    "bildtabelle.kopfzeile": "The first row is recognised as the header.",
    "bildtabelle.legende":
      "[?…] read with uncertainty, [unleserlich] illegible, [ungeprüft] could not be checked in the image — nothing has been filled in. Empty cells were checked as empty in the image.",
    "bildtabelle.unsicher": "Uncertain cells: {{n}}",
    "bildtabelle.mehrdeutig": "Cells with an uncertain column assignment: {{n}}",
    "bildtabelle.zelle": "Row {{zeile}}, column {{spalte}}",
    "bildtabelle.zelle.unsicher": "read with uncertainty",
    "bildtabelle.zelle.unleserlich": "illegible",
    "bildtabelle.zelle.ungeprueft": "not checked — whether anything is here is unknown",
    "bildtabelle.zelle.berichtigt": "corrected — recognised was “{{roh}}”",
    "bildtabelle.zelle.fundstelle": "Show row {{zeile}}, column {{spalte}} in the original",
    "bildtabelle.berichtigtTabelle":
      "The table shows the saved correction of this image; the original image is unchanged.",
    "bildtabelle.nichtZugeordnet":
      "Parts of the correction without an unambiguous table cell (not put into the table): {{teile}}",
    "bildtabelle.speichern": "Save as correction",
    "bildtabelle.gespeichert":
      "Saved — the table is now the correction of this image (source and image version). Undo and reset at the image text.",
    "bildtabelle.verweigert": "Not saved: this role may not correct recognised text.",
    "bildtabelle.speicherFehler": "Not saved: {{grund}}",
    "bildtabelle.nurAnsicht.nichtAngebunden":
      "Changes apply to this view only: this area does not save corrections.",
    "bildtabelle.nurAnsicht.ohneQuelle":
      "Changes apply to this view only: this text has not been saved yet, so there is no source for a lasting correction.",
    "bildtabelle.nurAnsicht.keinRecht":
      "Changes apply to this view only: this role may not correct recognised text.",
    "bildtabelle.nurAnsicht.laedt": "Loading saved corrections — saving is possible afterwards.",
    "bildtabelle.nurAnsicht.fehler":
      "Saved corrections could not be loaded; changes apply to this view only.",
    "bildtabelle.zelle.leer": "empty",
    "bildtabelle.zelle.mehrdeutig": "Column?",
    "bildtabelle.zelle.mehrdeutigLang": "Assignment to this column is ambiguous",
    "bildtabelle.zelle.bearbeitet": "changed",
    "bildtabelle.zelle.zuruecksetzen":
      "Reset row {{zeile}}, column {{spalte}} to the recognised value",
    "bildtabelle.allesZuruecksetzen": "Discard all changes",
    "bildtabelle.kopieren": "Copy table",
    "bildtabelle.kopiert.tabelle":
      "Copied — as a table (HTML) and as tab-separated text. Paste it into a text or a spreadsheet.",
    "bildtabelle.kopiert.nurText":
      "Copied — as tab-separated text only; this browser does not accept an HTML table.",
    "bildtabelle.kopiert.nichtVerfuegbar": "The clipboard is not available in this browser.",
    "bildtabelle.kopiert.fehlgeschlagen": "Copying failed.",
    "bildtabelle.beschriftung": "Table from {{quelle}}, image {{bild}} (text recognition)",
    "bildtabelle.beschriftungFolie":
      "Table from {{quelle}}, slide {{folie}}, image {{bild}} (text recognition)",
  },
  nl: {
    "bildtabelle.titel": "Tabel uit de afbeelding — bewerkbaar",
    "bildtabelle.hinweis":
      "{{zeilen}} rijen × {{spalten}} kolommen. Wijzigingen gelden alleen voor deze afbeelding; het resultaat en de originele afbeelding blijven zoals ze zijn.",
    "bildtabelle.kopfzeile": "De eerste rij is herkend als kop.",
    "bildtabelle.legende":
      "[?…] onzeker gelezen, [unleserlich] onleesbaar, [ungeprüft] niet te controleren in de afbeelding — er is niets aangevuld. Lege cellen zijn in de afbeelding als leeg gecontroleerd.",
    "bildtabelle.unsicher": "Onzekere cellen: {{n}}",
    "bildtabelle.mehrdeutig": "Cellen met een onzekere kolomtoewijzing: {{n}}",
    "bildtabelle.zelle": "Rij {{zeile}}, kolom {{spalte}}",
    "bildtabelle.zelle.unsicher": "onzeker gelezen",
    "bildtabelle.zelle.unleserlich": "onleesbaar",
    "bildtabelle.zelle.ungeprueft": "niet gecontroleerd — of hier iets staat, is onbekend",
    "bildtabelle.zelle.berichtigt": "gecorrigeerd — herkend was „{{roh}}”",
    "bildtabelle.zelle.fundstelle": "Rij {{zeile}}, kolom {{spalte}} in het origineel tonen",
    "bildtabelle.berichtigtTabelle":
      "De tabel toont de opgeslagen correctie van deze afbeelding; de originele afbeelding is ongewijzigd.",
    "bildtabelle.nichtZugeordnet":
      "Delen van de correctie zonder eenduidige tabelcel (niet in de tabel geplaatst): {{teile}}",
    "bildtabelle.speichern": "Als correctie opslaan",
    "bildtabelle.gespeichert":
      "Opgeslagen — de tabel geldt nu als correctie van deze afbeelding (bron en afbeeldingsversie). Ongedaan maken en terugzetten bij de afbeeldingstekst.",
    "bildtabelle.verweigert": "Niet opgeslagen: deze rol mag herkende tekst niet corrigeren.",
    "bildtabelle.speicherFehler": "Niet opgeslagen: {{grund}}",
    "bildtabelle.nurAnsicht.nichtAngebunden":
      "Wijzigingen gelden alleen in deze weergave: dit onderdeel slaat geen correcties op.",
    "bildtabelle.nurAnsicht.ohneQuelle":
      "Wijzigingen gelden alleen in deze weergave: deze tekst is nog niet opgeslagen, er is geen bron voor een blijvende correctie.",
    "bildtabelle.nurAnsicht.keinRecht":
      "Wijzigingen gelden alleen in deze weergave: deze rol mag herkende tekst niet corrigeren.",
    "bildtabelle.nurAnsicht.laedt":
      "Opgeslagen correcties worden geladen — opslaan is daarna mogelijk.",
    "bildtabelle.nurAnsicht.fehler":
      "Opgeslagen correcties konden niet worden geladen; wijzigingen gelden alleen in deze weergave.",
    "bildtabelle.zelle.leer": "leeg",
    "bildtabelle.zelle.mehrdeutig": "Kolom?",
    "bildtabelle.zelle.mehrdeutigLang": "Toewijzing aan deze kolom is niet eenduidig",
    "bildtabelle.zelle.bearbeitet": "gewijzigd",
    "bildtabelle.zelle.zuruecksetzen":
      "Rij {{zeile}}, kolom {{spalte}} terugzetten naar de herkende waarde",
    "bildtabelle.allesZuruecksetzen": "Alle wijzigingen verwerpen",
    "bildtabelle.kopieren": "Tabel kopiëren",
    "bildtabelle.kopiert.tabelle":
      "Gekopieerd — als tabel (HTML) en als tekst met tabs. Plak het in een tekst of een spreadsheet.",
    "bildtabelle.kopiert.nurText":
      "Gekopieerd — alleen als tekst met tabs; deze browser accepteert geen HTML-tabel.",
    "bildtabelle.kopiert.nichtVerfuegbar": "Het klembord is in deze browser niet beschikbaar.",
    "bildtabelle.kopiert.fehlgeschlagen": "Kopiëren mislukt.",
    "bildtabelle.beschriftung": "Tabel uit {{quelle}}, afbeelding {{bild}} (tekstherkenning)",
    "bildtabelle.beschriftungFolie":
      "Tabel uit {{quelle}}, dia {{folie}}, afbeelding {{bild}} (tekstherkenning)",
  },
} satisfies Textmodul;

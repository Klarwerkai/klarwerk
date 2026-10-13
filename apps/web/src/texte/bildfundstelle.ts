// ================================================================================================
// OCR-E01/E02 · FUNDSTELLEN AM ORIGINAL UND BERICHTIGTER BILDTEXT — die Texte dieses Nutzerwegs.
// ================================================================================================
//
// Neu mit dem Auftrag produkt:20261012:klara-ocr-fundstellen-korrekturen. Verwendet in
// `components/BildBefundListe.tsx`, `components/BildFundstelleAnsicht.tsx`,
// `components/BildTextBerichtigung.tsx` und `lib/klaraBildKontext.ts`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "bildfundstelle.",
  legacySchluessel: [],
  de: {
    "bildfundstelle.text.hinweis":
      "Ein Wort wählen (Klick, oder Tab und Eingabe), um seine Stelle im Original zu sehen.",
    "bildfundstelle.stelle.zeigen": "Stelle von „{{wort}}“ im Original zeigen",
    "bildfundstelle.dialog.titel": "Fundstelle im Original · {{ort}}",
    "bildfundstelle.dialog.quelle": "Quelle: {{quelle}} · {{ort}}",
    "bildfundstelle.dialog.markiert":
      "Markiert: „{{wort}}“ — gestrichelter Rahmen mit der Nummer 1.",
    "bildfundstelle.dialog.markiertErsetzt":
      "Markiert ist die Stelle des ursprünglich erkannten Wortes „{{roh}}“ (berichtigt zu „{{wort}}“) — gestrichelter Rahmen mit der Nummer 1.",
    "bildfundstelle.dialog.ohnePosition":
      "Für „{{wort}}“ gibt es keine verlässliche Position im Bild. Gezeigt wird das ganze Bild; nichts ist markiert.",
    "bildfundstelle.dialog.keinBild": "Das Originalbild ist hier nicht verfügbar.",
    "bildfundstelle.dialog.bildAlt": "Original: {{quelle}} · {{ort}}",
    "bildfundstelle.dialog.drehen": "Ansicht um 90° drehen",
    "bildfundstelle.dialog.groesser": "Vergrößern",
    "bildfundstelle.dialog.kleiner": "Verkleinern",
    "bildfundstelle.dialog.zuruecksetzen": "Ansicht zurücksetzen",
    "bildfundstelle.dialog.ansicht": "Ansicht: um {{drehung}}° gedreht, {{zoom}} %.",
    "bildfundstelle.dialog.gedreht":
      "Das Foto ist laut Datei gedreht; die Ansicht zeigt es so, wie es angezeigt wird.",
    "bildfundstelle.dialog.original":
      "Das Original bleibt unverändert; Drehen und Vergrößern betreffen nur diese Ansicht.",
    "bildfundstelle.grund.keinePositionen":
      "Die Texterkennung hat für dieses Bild keine Wortpositionen geliefert.",
    "bildfundstelle.grund.ohneZuordnung":
      "Diese Stelle wurde ergänzt und hat keine Entsprechung in der Erkennung.",
    "bildfundstelle.grund.keineMasse": "Die Bildmaße sind aus der Datei nicht lesbar.",
    "bildfundstelle.grund.drehungUnklar":
      "Das Bild trägt eine Drehangabe, deren Bezug zu den erkannten Positionen nicht eindeutig ist.",
    "bildfundstelle.grund.ausserhalb": "Die erkannten Positionen passen nicht zu den Bildmaßen.",
    "bildfundstelle.korrektur.berichtigen": "Text berichtigen",
    "bildfundstelle.korrektur.bearbeiten": "Berichtigung bearbeiten",
    "bildfundstelle.korrektur.feld": "Berichtigter Text für {{ort}}",
    "bildfundstelle.korrektur.speichern": "Berichtigung speichern",
    "bildfundstelle.korrektur.abbrechen": "Abbrechen",
    "bildfundstelle.korrektur.rueckgaengig": "Rückgängig",
    "bildfundstelle.korrektur.zuruecksetzen": "Auf Rohbefund zurücksetzen",
    "bildfundstelle.korrektur.berichtigt":
      "Berichtigt — Klara verwendet diesen Text. Das Originalbild ist unverändert.",
    "bildfundstelle.korrektur.rohbefund": "Rohbefund der Texterkennung",
    "bildfundstelle.korrektur.andereFassung":
      "Für eine frühere Fassung dieses Bildes gibt es eine Berichtigung. Sie gilt nicht für das veränderte Bild und wurde nicht übernommen.",
    "bildfundstelle.korrektur.ohneQuelle":
      "Berichtigen ist möglich, sobald dieser Text gespeichert ist — erst dann gibt es eine Quelle, an die die Berichtigung gebunden wird.",
    "bildfundstelle.korrektur.keinRecht": "Diese Rolle darf erkannten Text nicht berichtigen.",
    "bildfundstelle.korrektur.laedt": "Gespeicherte Berichtigungen werden geladen …",
    "bildfundstelle.korrektur.ladeFehler":
      "Gespeicherte Berichtigungen konnten nicht geladen werden; angezeigt wird der Rohbefund.",
    "bildfundstelle.korrektur.fehler": "Die Berichtigung wurde nicht gespeichert: {{grund}}",
    "bildfundstelle.korrektur.verweigert":
      "Die Berichtigung wurde abgelehnt: Diese Rolle darf nicht berichtigen.",
    "bildfundstelle.korrektur.gespeichert": "Berichtigung gespeichert.",
    "bildfundstelle.korrektur.zurueckgesetzt": "Rohbefund wiederhergestellt.",
    "bildfundstelle.kontext.textBerichtigt": "Bildtext (berichtigt)",
    "bildfundstelle.korrektur.erneutLaden": "Erneut laden",
    "bildfundstelle.kontext.inhaltVorBerichtigung":
      "Bildinhalt (Beschreibung vor der Berichtigung; abweichende Angaben gelten nicht, maßgeblich ist der berichtigte Bildtext)",
    "bildfundstelle.korrektur.beschreibungVorBerichtigung":
      "Diese Beschreibung stammt von vor der Berichtigung und ließ sich nicht eindeutig angleichen. Maßgeblich ist der berichtigte Bildtext.",
    "bildfundstelle.anweisung.berichtigt":
      "Für Bilder mit „Bildtext (berichtigt)“ gilt allein dieser berichtigte Text. Gib keine davon abweichende Schreibweise oder Lesung wieder.",
    "bildfundstelle.klara.wartet":
      "Gespeicherte Berichtigungen werden geladen — Klara fragt erst danach, mit dem berichtigten Text.",
    "bildfundstelle.klara.ladeFehler":
      "Gespeicherte Berichtigungen konnten nicht geladen werden. Klara fragt erst, wenn sie geladen sind — sonst bekäme sie den unberichtigten Text.",
  },
  en: {
    "bildfundstelle.text.hinweis":
      "Choose a word (click, or Tab and Enter) to see where it is in the original.",
    "bildfundstelle.stelle.zeigen": "Show where “{{wort}}” is in the original",
    "bildfundstelle.dialog.titel": "Location in the original · {{ort}}",
    "bildfundstelle.dialog.quelle": "Source: {{quelle}} · {{ort}}",
    "bildfundstelle.dialog.markiert": "Marked: “{{wort}}” — dashed frame with the number 1.",
    "bildfundstelle.dialog.markiertErsetzt":
      "Marked is the location of the originally recognised word “{{roh}}” (corrected to “{{wort}}”) — dashed frame with the number 1.",
    "bildfundstelle.dialog.ohnePosition":
      "There is no reliable position in the image for “{{wort}}”. The whole image is shown; nothing is marked.",
    "bildfundstelle.dialog.keinBild": "The original image is not available here.",
    "bildfundstelle.dialog.bildAlt": "Original: {{quelle}} · {{ort}}",
    "bildfundstelle.dialog.drehen": "Rotate view by 90°",
    "bildfundstelle.dialog.groesser": "Zoom in",
    "bildfundstelle.dialog.kleiner": "Zoom out",
    "bildfundstelle.dialog.zuruecksetzen": "Reset view",
    "bildfundstelle.dialog.ansicht": "View: rotated by {{drehung}}°, {{zoom}} %.",
    "bildfundstelle.dialog.gedreht":
      "According to the file the photo is rotated; the view shows it as it is displayed.",
    "bildfundstelle.dialog.original":
      "The original stays unchanged; rotating and zooming only affect this view.",
    "bildfundstelle.grund.keinePositionen":
      "Text recognition did not provide word positions for this image.",
    "bildfundstelle.grund.ohneZuordnung":
      "This passage was added and has no counterpart in the recognition.",
    "bildfundstelle.grund.keineMasse": "The image dimensions cannot be read from the file.",
    "bildfundstelle.grund.drehungUnklar":
      "The image carries a rotation flag whose relation to the recognised positions is ambiguous.",
    "bildfundstelle.grund.ausserhalb": "The recognised positions do not fit the image dimensions.",
    "bildfundstelle.korrektur.berichtigen": "Correct text",
    "bildfundstelle.korrektur.bearbeiten": "Edit correction",
    "bildfundstelle.korrektur.feld": "Corrected text for {{ort}}",
    "bildfundstelle.korrektur.speichern": "Save correction",
    "bildfundstelle.korrektur.abbrechen": "Cancel",
    "bildfundstelle.korrektur.rueckgaengig": "Undo",
    "bildfundstelle.korrektur.zuruecksetzen": "Reset to raw recognition",
    "bildfundstelle.korrektur.berichtigt":
      "Corrected — Klara uses this text. The original image is unchanged.",
    "bildfundstelle.korrektur.rohbefund": "Raw text recognition result",
    "bildfundstelle.korrektur.andereFassung":
      "There is a correction for an earlier version of this image. It does not apply to the changed image and was not carried over.",
    "bildfundstelle.korrektur.ohneQuelle":
      "Correcting becomes possible once this text has been saved — only then is there a source the correction can be bound to.",
    "bildfundstelle.korrektur.keinRecht": "This role may not correct recognised text.",
    "bildfundstelle.korrektur.laedt": "Loading saved corrections …",
    "bildfundstelle.korrektur.ladeFehler":
      "Saved corrections could not be loaded; the raw recognition result is shown.",
    "bildfundstelle.korrektur.fehler": "The correction was not saved: {{grund}}",
    "bildfundstelle.korrektur.verweigert":
      "The correction was refused: this role may not correct text.",
    "bildfundstelle.korrektur.gespeichert": "Correction saved.",
    "bildfundstelle.korrektur.zurueckgesetzt": "Raw recognition result restored.",
    "bildfundstelle.kontext.textBerichtigt": "Image text (corrected)",
    "bildfundstelle.korrektur.erneutLaden": "Load again",
    "bildfundstelle.kontext.inhaltVorBerichtigung":
      "Image content (description from before the correction; differing details do not apply, the corrected image text is authoritative)",
    "bildfundstelle.korrektur.beschreibungVorBerichtigung":
      "This description dates from before the correction and could not be aligned unambiguously. The corrected image text is authoritative.",
    "bildfundstelle.anweisung.berichtigt":
      "For images with “Image text (corrected)” only this corrected text applies. Do not repeat any differing spelling or reading.",
    "bildfundstelle.klara.wartet":
      "Loading saved corrections — Klara will only answer afterwards, using the corrected text.",
    "bildfundstelle.klara.ladeFehler":
      "Saved corrections could not be loaded. Klara will only answer once they are loaded — otherwise she would receive the uncorrected text.",
  },
  nl: {
    "bildfundstelle.text.hinweis":
      "Kies een woord (klik, of Tab en Enter) om te zien waar het in het origineel staat.",
    "bildfundstelle.stelle.zeigen": "Laat zien waar „{{wort}}” in het origineel staat",
    "bildfundstelle.dialog.titel": "Vindplaats in het origineel · {{ort}}",
    "bildfundstelle.dialog.quelle": "Bron: {{quelle}} · {{ort}}",
    "bildfundstelle.dialog.markiert": "Gemarkeerd: „{{wort}}” — gestippeld kader met het nummer 1.",
    "bildfundstelle.dialog.markiertErsetzt":
      "Gemarkeerd is de plaats van het oorspronkelijk herkende woord „{{roh}}” (gecorrigeerd naar „{{wort}}”) — gestippeld kader met het nummer 1.",
    "bildfundstelle.dialog.ohnePosition":
      "Voor „{{wort}}” is er geen betrouwbare positie in de afbeelding. De hele afbeelding wordt getoond; niets is gemarkeerd.",
    "bildfundstelle.dialog.keinBild": "De originele afbeelding is hier niet beschikbaar.",
    "bildfundstelle.dialog.bildAlt": "Origineel: {{quelle}} · {{ort}}",
    "bildfundstelle.dialog.drehen": "Weergave 90° draaien",
    "bildfundstelle.dialog.groesser": "Vergroten",
    "bildfundstelle.dialog.kleiner": "Verkleinen",
    "bildfundstelle.dialog.zuruecksetzen": "Weergave herstellen",
    "bildfundstelle.dialog.ansicht": "Weergave: {{drehung}}° gedraaid, {{zoom}} %.",
    "bildfundstelle.dialog.gedreht":
      "Volgens het bestand is de foto gedraaid; de weergave toont hem zoals hij wordt weergegeven.",
    "bildfundstelle.dialog.original":
      "Het origineel blijft ongewijzigd; draaien en vergroten gelden alleen voor deze weergave.",
    "bildfundstelle.grund.keinePositionen":
      "De tekstherkenning heeft voor deze afbeelding geen woordposities geleverd.",
    "bildfundstelle.grund.ohneZuordnung":
      "Deze passage is toegevoegd en heeft geen tegenhanger in de herkenning.",
    "bildfundstelle.grund.keineMasse": "De afmetingen van de afbeelding zijn niet leesbaar.",
    "bildfundstelle.grund.drehungUnklar":
      "De afbeelding heeft een draai-aanduiding waarvan de relatie tot de herkende posities niet eenduidig is.",
    "bildfundstelle.grund.ausserhalb":
      "De herkende posities passen niet bij de afmetingen van de afbeelding.",
    "bildfundstelle.korrektur.berichtigen": "Tekst corrigeren",
    "bildfundstelle.korrektur.bearbeiten": "Correctie bewerken",
    "bildfundstelle.korrektur.feld": "Gecorrigeerde tekst voor {{ort}}",
    "bildfundstelle.korrektur.speichern": "Correctie opslaan",
    "bildfundstelle.korrektur.abbrechen": "Annuleren",
    "bildfundstelle.korrektur.rueckgaengig": "Ongedaan maken",
    "bildfundstelle.korrektur.zuruecksetzen": "Terug naar ruwe herkenning",
    "bildfundstelle.korrektur.berichtigt":
      "Gecorrigeerd — Klara gebruikt deze tekst. De originele afbeelding is ongewijzigd.",
    "bildfundstelle.korrektur.rohbefund": "Ruw resultaat van de tekstherkenning",
    "bildfundstelle.korrektur.andereFassung":
      "Er is een correctie voor een eerdere versie van deze afbeelding. Die geldt niet voor de gewijzigde afbeelding en is niet overgenomen.",
    "bildfundstelle.korrektur.ohneQuelle":
      "Corrigeren is mogelijk zodra deze tekst is opgeslagen — pas dan is er een bron waaraan de correctie wordt gekoppeld.",
    "bildfundstelle.korrektur.keinRecht": "Deze rol mag herkende tekst niet corrigeren.",
    "bildfundstelle.korrektur.laedt": "Opgeslagen correcties worden geladen …",
    "bildfundstelle.korrektur.ladeFehler":
      "Opgeslagen correcties konden niet worden geladen; het ruwe resultaat wordt getoond.",
    "bildfundstelle.korrektur.fehler": "De correctie is niet opgeslagen: {{grund}}",
    "bildfundstelle.korrektur.verweigert":
      "De correctie is geweigerd: deze rol mag niet corrigeren.",
    "bildfundstelle.korrektur.gespeichert": "Correctie opgeslagen.",
    "bildfundstelle.korrektur.zurueckgesetzt": "Ruw resultaat hersteld.",
    "bildfundstelle.kontext.textBerichtigt": "Afbeeldingstekst (gecorrigeerd)",
    "bildfundstelle.korrektur.erneutLaden": "Opnieuw laden",
    "bildfundstelle.kontext.inhaltVorBerichtigung":
      "Beeldinhoud (beschrijving van vóór de correctie; afwijkende gegevens gelden niet, de gecorrigeerde afbeeldingstekst is bepalend)",
    "bildfundstelle.korrektur.beschreibungVorBerichtigung":
      "Deze beschrijving dateert van vóór de correctie en kon niet eenduidig worden aangepast. De gecorrigeerde afbeeldingstekst is bepalend.",
    "bildfundstelle.anweisung.berichtigt":
      "Voor afbeeldingen met „Afbeeldingstekst (gecorrigeerd)” geldt alleen deze gecorrigeerde tekst. Geef geen afwijkende spelling of lezing weer.",
    "bildfundstelle.klara.wartet":
      "Opgeslagen correcties worden geladen — Klara antwoordt pas daarna, met de gecorrigeerde tekst.",
    "bildfundstelle.klara.ladeFehler":
      "Opgeslagen correcties konden niet worden geladen. Klara antwoordt pas als ze geladen zijn — anders kreeg ze de ongecorrigeerde tekst.",
  },
} satisfies Textmodul;

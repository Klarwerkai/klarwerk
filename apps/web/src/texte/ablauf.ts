// ================================================================================================
// BILDSCHIRMABLÄUFE · DIE TEXTE DES NUTZERWEGS „BILDSCHIRMABLAUF ÜBERNEHMEN".
// ================================================================================================
//
// WOHER: `produkt:wettbewerb:20261003:bildschirmablaeufe`. Fläche: `pages/AblaufUebernahme.tsx`
// (`/erfassen/ablauf`), Logik: `lib/ablaufImport.ts`, `lib/ablaufSchwaerzen.ts`. Alle Schlüssel sind
// neu und tragen das Präfix `ablauf.`. Der Auftrag verlangt DE/EN; NL steht dabei, weil der
// Textmodul-Vertrag alle drei Sprachen der Oberfläche verlangt (`./intern/pruefung.ts`).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "ablauf.",
  legacySchluessel: [],
  de: {
    "ablauf.titel": "Bildschirmablauf übernehmen",
    "ablauf.einleitung":
      "Übernimm einen außerhalb Klarwerks bewusst aufgezeichneten Softwareablauf als bearbeitbare Schrittanleitung. Unterstützt werden Dateien im Format klarwerk-ablauf/1 und JSON-Exporte des Chrome-DevTools-Recorders.",
    "ablauf.datenfluss":
      "Datenfluss: Die Datei wird in deinem Browser geprüft. Erst wenn sie vollständig gültig ist, legt Klarwerk daraus einen privaten Entwurf auf dem Klarwerk-Server dieser Instanz an. Es wird kein KI-Dienst aufgerufen.",
    "ablauf.einstieg": "Bildschirmablauf übernehmen",
    "ablauf.datei.waehlen": "Ablaufdatei wählen (.json)",
    "ablauf.datei.neu": "Anderen Ablauf übernehmen",
    "ablauf.laedt": "Entwurf wird geladen …",
    "ablauf.fehler.titel": "Import nicht übernommen",
    "ablauf.fehler.bestandBleibt": "Dein bisheriger Stand bleibt unverändert.",
    "ablauf.fehler.datei_zu_gross": "Die Datei ist größer als 4 MB.",
    "ablauf.fehler.kein_json": "Die Datei ist kein gültiges JSON.",
    "ablauf.fehler.format_unbekannt":
      "Dieses Format wird nicht unterstützt{{detail}}. Erwartet: klarwerk-ablauf/1 oder ein JSON-Export des Chrome-DevTools-Recorders.",
    "ablauf.fehler.werkzeug_fehlt":
      "Die Datei nennt kein Aufzeichnungswerkzeug (Feld „werkzeug“). Ohne Herkunft wird nichts übernommen.",
    "ablauf.fehler.keine_schritte": "Die Datei enthält keine Schritte.",
    "ablauf.fehler.zu_viele_schritte": "Die Datei enthält mehr als {{detail}} Schritte.",
    "ablauf.fehler.schritt_ohne_text": "Schritt {{schritt}} hat keinen Handlungstext.",
    "ablauf.fehler.schritt_zu_lang": "Der Handlungstext von Schritt {{schritt}} ist zu lang.",
    "ablauf.fehler.bild_ungueltig":
      "Das Bild von Schritt {{schritt}} ist kein unterstütztes Rasterbild (PNG, JPEG, WebP als data-URL).",
    "ablauf.fehler.bild_zu_gross": "Das Bild von Schritt {{schritt}} ist zu groß.",
    "ablauf.fehler.bilder_zu_gross":
      "Die Bilder sind zusammen zu groß. Entferne oder verkleinere einzelne Bilder.",
    "ablauf.fehler.schritttyp_unbekannt":
      "Schritt {{schritt}} hat einen nicht unterstützten Typ{{detail}}. Es wird keine lückenhafte Anleitung angelegt.",
    "ablauf.herkunft.extern": "Außerhalb Klarwerks aufgezeichnet mit {{werkzeug}}",
    "ablauf.herkunft.format": "Format: {{format}}",
    "ablauf.herkunft.datei": "Datei: {{datei}}",
    "ablauf.herkunft.zeit": "Aufgezeichnet: {{zeit}}",
    "ablauf.herkunft.anwendung": "Anwendung: {{anwendung}}",
    "ablauf.rumpf.herkunft":
      "Herkunft: außerhalb Klarwerks aufgezeichnet mit {{werkzeug}} ({{format}}){{zusatz}}; in Klarwerk übernommen und vor der Ablage bearbeitet.",
    "ablauf.rumpf.hinweis":
      "Beobachteter Ablauf: Die fachliche Richtigkeit bestätigt die Prüfung, nicht die Aufzeichnung.",
    "ablauf.schritte.anzahl": "{{anzahl}} Schritte",
    "ablauf.schritt.titel": "Schritt {{nummer}}",
    "ablauf.schritt.textLabel": "Handlungstext von Schritt {{nummer}}",
    "ablauf.schritt.hoch": "Nach oben",
    "ablauf.schritt.runter": "Nach unten",
    "ablauf.schritt.entfernen": "Schritt entfernen",
    "ablauf.schritt.ohneBild": "Kein Bild",
    "ablauf.bild.alt": "Bildschirmfoto zu Schritt {{nummer}}",
    "ablauf.bild.setzen": "Bild hinzufügen oder ersetzen",
    "ablauf.bild.entfernen": "Bild entfernen",
    "ablauf.bild.schwaerzenHilfe":
      "Zum Schwärzen einen Rahmen über die Angabe im Bild ziehen und dann „Bereich schwärzen“ wählen.",
    "ablauf.bild.schwaerzen": "Bereich schwärzen",
    "ablauf.bild.geschwaerzt":
      "Bereich geschwärzt. Das Bild wurde neu erstellt; das Original ist darin nicht mehr enthalten.",
    "ablauf.bild.fehler": "Das Bild konnte nicht bearbeitet werden und bleibt unverändert.",
    "ablauf.schwaerzen.titel": "Angabe in allen Texten schwärzen",
    "ablauf.schwaerzen.feld": "Zu schwärzende Angabe",
    "ablauf.schwaerzen.knopf": "In Texten schwärzen",
    "ablauf.schwaerzen.ergebnis": "{{anzahl}} Stelle(n) geschwärzt.",
    "ablauf.meta.titel": "Titel",
    "ablauf.meta.aussage": "Kernaussage",
    "ablauf.meta.art": "Wissensart",
    "ablauf.meta.kategorie": "Kategorie",
    "ablauf.meta.stufe": "Vertraulichkeit",
    "ablauf.meta.waehlen": "Bitte wählen",
    "ablauf.speichern": "Entwurf speichern",
    "ablauf.gespeichert": "Entwurf gespeichert.",
    "ablauf.ungespeichert": "Ungespeicherte Änderungen",
    "ablauf.speichernFehler":
      "Nicht gespeichert: {{grund}} Deine Bearbeitung bleibt hier erhalten.",
    "ablauf.einreichen": "Zur Prüfung einreichen",
    "ablauf.einreichenFehlt": "Zum Einreichen fehlen: {{felder}}",
    "ablauf.einreichenFehler": "Nicht eingereicht: {{grund}} Dein Entwurf bleibt erhalten.",
    "ablauf.eingereicht":
      "Eingereicht. Das Wissensobjekt durchläuft jetzt die Prüfung nach der Regel deines Kontos – bis zur Entscheidung ist es kein gültiges Wissen.",
    "ablauf.bereitsEingereicht":
      "Diese Aufzeichnung hast du bereits als Wissensobjekt eingereicht. Es entsteht kein zweites Objekt. Für eine neue Fassung gib unten das bestehende Wissensobjekt an.",
    "ablauf.zumObjekt": "Wissensobjekt öffnen",
    "ablauf.fassung.titel": "Als neue Fassung eines bestehenden Wissensobjekts übernehmen",
    "ablauf.fassung.feld": "Kennung oder Adresse des Wissensobjekts",
    "ablauf.fassung.knopf": "Neue Fassung anlegen",
    "ablauf.fassung.erfolg":
      "Fassung {{version}} am bestehenden Wissensobjekt angelegt; sie wartet auf die Prüfung.",
    "ablauf.fassung.fehler": "Keine neue Fassung angelegt: {{grund}}",
    "ablauf.laden.fehler": "Der Entwurf konnte nicht geladen werden.",
    "ablauf.laden.keinAblauf": "Dieser Entwurf enthält keinen Bildschirmablauf.",
    "ablauf.formulierung.oeffnen": "Öffne {{adresse}}",
    "ablauf.formulierung.klicken": "Klicke auf „{{ziel}}“",
    "ablauf.formulierung.eingeben": "Gib „{{wert}}“ in „{{ziel}}“ ein",
    "ablauf.formulierung.taste": "Drücke die Taste {{taste}}",
  },
  en: {
    "ablauf.titel": "Import a screen procedure",
    "ablauf.einleitung":
      "Turn a software procedure that was deliberately recorded outside Klarwerk into an editable step-by-step guide. Supported: files in the klarwerk-ablauf/1 format and JSON exports of the Chrome DevTools Recorder.",
    "ablauf.datenfluss":
      "Data flow: the file is checked in your browser. Only once it is fully valid does Klarwerk create a private draft from it on the Klarwerk server of this instance. No AI service is called.",
    "ablauf.einstieg": "Import a screen procedure",
    "ablauf.datei.waehlen": "Choose procedure file (.json)",
    "ablauf.datei.neu": "Import another procedure",
    "ablauf.laedt": "Loading draft …",
    "ablauf.fehler.titel": "Import not applied",
    "ablauf.fehler.bestandBleibt": "Your current state stays unchanged.",
    "ablauf.fehler.datei_zu_gross": "The file is larger than 4 MB.",
    "ablauf.fehler.kein_json": "The file is not valid JSON.",
    "ablauf.fehler.format_unbekannt":
      "This format is not supported{{detail}}. Expected: klarwerk-ablauf/1 or a JSON export of the Chrome DevTools Recorder.",
    "ablauf.fehler.werkzeug_fehlt":
      "The file does not name a recording tool (field “werkzeug”). Nothing is imported without its origin.",
    "ablauf.fehler.keine_schritte": "The file contains no steps.",
    "ablauf.fehler.zu_viele_schritte": "The file contains more than {{detail}} steps.",
    "ablauf.fehler.schritt_ohne_text": "Step {{schritt}} has no action text.",
    "ablauf.fehler.schritt_zu_lang": "The action text of step {{schritt}} is too long.",
    "ablauf.fehler.bild_ungueltig":
      "The image of step {{schritt}} is not a supported raster image (PNG, JPEG, WebP as data URL).",
    "ablauf.fehler.bild_zu_gross": "The image of step {{schritt}} is too large.",
    "ablauf.fehler.bilder_zu_gross":
      "The images are too large in total. Remove or shrink individual images.",
    "ablauf.fehler.schritttyp_unbekannt":
      "Step {{schritt}} has an unsupported type{{detail}}. No incomplete guide is created.",
    "ablauf.herkunft.extern": "Recorded outside Klarwerk with {{werkzeug}}",
    "ablauf.herkunft.format": "Format: {{format}}",
    "ablauf.herkunft.datei": "File: {{datei}}",
    "ablauf.herkunft.zeit": "Recorded: {{zeit}}",
    "ablauf.herkunft.anwendung": "Application: {{anwendung}}",
    "ablauf.rumpf.herkunft":
      "Origin: recorded outside Klarwerk with {{werkzeug}} ({{format}}){{zusatz}}; imported into Klarwerk and edited before filing.",
    "ablauf.rumpf.hinweis":
      "Observed procedure: its factual correctness is confirmed by the review, not by the recording.",
    "ablauf.schritte.anzahl": "{{anzahl}} steps",
    "ablauf.schritt.titel": "Step {{nummer}}",
    "ablauf.schritt.textLabel": "Action text of step {{nummer}}",
    "ablauf.schritt.hoch": "Move up",
    "ablauf.schritt.runter": "Move down",
    "ablauf.schritt.entfernen": "Remove step",
    "ablauf.schritt.ohneBild": "No image",
    "ablauf.bild.alt": "Screenshot for step {{nummer}}",
    "ablauf.bild.setzen": "Add or replace image",
    "ablauf.bild.entfernen": "Remove image",
    "ablauf.bild.schwaerzenHilfe":
      "To redact, drag a frame over the detail in the image and then choose “Redact area”.",
    "ablauf.bild.schwaerzen": "Redact area",
    "ablauf.bild.geschwaerzt":
      "Area redacted. The image was re-created; the original is no longer contained in it.",
    "ablauf.bild.fehler": "The image could not be edited and stays unchanged.",
    "ablauf.schwaerzen.titel": "Redact a detail in all texts",
    "ablauf.schwaerzen.feld": "Detail to redact",
    "ablauf.schwaerzen.knopf": "Redact in texts",
    "ablauf.schwaerzen.ergebnis": "{{anzahl}} occurrence(s) redacted.",
    "ablauf.meta.titel": "Title",
    "ablauf.meta.aussage": "Key statement",
    "ablauf.meta.art": "Knowledge type",
    "ablauf.meta.kategorie": "Category",
    "ablauf.meta.stufe": "Confidentiality",
    "ablauf.meta.waehlen": "Please choose",
    "ablauf.speichern": "Save draft",
    "ablauf.gespeichert": "Draft saved.",
    "ablauf.ungespeichert": "Unsaved changes",
    "ablauf.speichernFehler": "Not saved: {{grund}} Your edits remain here.",
    "ablauf.einreichen": "Submit for review",
    "ablauf.einreichenFehlt": "Missing before submitting: {{felder}}",
    "ablauf.einreichenFehler": "Not submitted: {{grund}} Your draft is kept.",
    "ablauf.eingereicht":
      "Submitted. The knowledge object now goes through review under your account's rule – until the decision it is not valid knowledge.",
    "ablauf.bereitsEingereicht":
      "You have already submitted this recording as a knowledge object. No second object is created. For a new version, enter the existing knowledge object below.",
    "ablauf.zumObjekt": "Open knowledge object",
    "ablauf.fassung.titel": "Import as a new version of an existing knowledge object",
    "ablauf.fassung.feld": "ID or address of the knowledge object",
    "ablauf.fassung.knopf": "Create new version",
    "ablauf.fassung.erfolg":
      "Version {{version}} created on the existing knowledge object; it awaits review.",
    "ablauf.fassung.fehler": "No new version created: {{grund}}",
    "ablauf.laden.fehler": "The draft could not be loaded.",
    "ablauf.laden.keinAblauf": "This draft contains no screen procedure.",
    "ablauf.formulierung.oeffnen": "Open {{adresse}}",
    "ablauf.formulierung.klicken": "Click “{{ziel}}”",
    "ablauf.formulierung.eingeben": "Enter “{{wert}}” in “{{ziel}}”",
    "ablauf.formulierung.taste": "Press the {{taste}} key",
  },
  nl: {
    "ablauf.titel": "Schermprocedure overnemen",
    "ablauf.einleitung":
      "Neem een buiten Klarwerk bewust opgenomen softwareprocedure over als bewerkbare stap-voor-stap-handleiding. Ondersteund: bestanden in het formaat klarwerk-ablauf/1 en JSON-exports van de Chrome DevTools Recorder.",
    "ablauf.datenfluss":
      "Gegevensstroom: het bestand wordt in je browser gecontroleerd. Pas als het volledig geldig is, maakt Klarwerk er een privéconcept van op de Klarwerk-server van deze instantie. Er wordt geen AI-dienst aangeroepen.",
    "ablauf.einstieg": "Schermprocedure overnemen",
    "ablauf.datei.waehlen": "Procedurebestand kiezen (.json)",
    "ablauf.datei.neu": "Andere procedure overnemen",
    "ablauf.laedt": "Concept wordt geladen …",
    "ablauf.fehler.titel": "Import niet overgenomen",
    "ablauf.fehler.bestandBleibt": "Je huidige stand blijft ongewijzigd.",
    "ablauf.fehler.datei_zu_gross": "Het bestand is groter dan 4 MB.",
    "ablauf.fehler.kein_json": "Het bestand is geen geldige JSON.",
    "ablauf.fehler.format_unbekannt":
      "Dit formaat wordt niet ondersteund{{detail}}. Verwacht: klarwerk-ablauf/1 of een JSON-export van de Chrome DevTools Recorder.",
    "ablauf.fehler.werkzeug_fehlt":
      "Het bestand noemt geen opnamehulpmiddel (veld „werkzeug”). Zonder herkomst wordt niets overgenomen.",
    "ablauf.fehler.keine_schritte": "Het bestand bevat geen stappen.",
    "ablauf.fehler.zu_viele_schritte": "Het bestand bevat meer dan {{detail}} stappen.",
    "ablauf.fehler.schritt_ohne_text": "Stap {{schritt}} heeft geen handelingstekst.",
    "ablauf.fehler.schritt_zu_lang": "De handelingstekst van stap {{schritt}} is te lang.",
    "ablauf.fehler.bild_ungueltig":
      "De afbeelding van stap {{schritt}} is geen ondersteunde rasterafbeelding (PNG, JPEG, WebP als data-URL).",
    "ablauf.fehler.bild_zu_gross": "De afbeelding van stap {{schritt}} is te groot.",
    "ablauf.fehler.bilder_zu_gross":
      "De afbeeldingen zijn samen te groot. Verwijder of verklein afzonderlijke afbeeldingen.",
    "ablauf.fehler.schritttyp_unbekannt":
      "Stap {{schritt}} heeft een niet-ondersteund type{{detail}}. Er wordt geen onvolledige handleiding aangemaakt.",
    "ablauf.herkunft.extern": "Buiten Klarwerk opgenomen met {{werkzeug}}",
    "ablauf.herkunft.format": "Formaat: {{format}}",
    "ablauf.herkunft.datei": "Bestand: {{datei}}",
    "ablauf.herkunft.zeit": "Opgenomen: {{zeit}}",
    "ablauf.herkunft.anwendung": "Toepassing: {{anwendung}}",
    "ablauf.rumpf.herkunft":
      "Herkomst: buiten Klarwerk opgenomen met {{werkzeug}} ({{format}}){{zusatz}}; in Klarwerk overgenomen en vóór opslag bewerkt.",
    "ablauf.rumpf.hinweis":
      "Waargenomen procedure: de inhoudelijke juistheid bevestigt de beoordeling, niet de opname.",
    "ablauf.schritte.anzahl": "{{anzahl}} stappen",
    "ablauf.schritt.titel": "Stap {{nummer}}",
    "ablauf.schritt.textLabel": "Handelingstekst van stap {{nummer}}",
    "ablauf.schritt.hoch": "Omhoog",
    "ablauf.schritt.runter": "Omlaag",
    "ablauf.schritt.entfernen": "Stap verwijderen",
    "ablauf.schritt.ohneBild": "Geen afbeelding",
    "ablauf.bild.alt": "Schermafbeelding bij stap {{nummer}}",
    "ablauf.bild.setzen": "Afbeelding toevoegen of vervangen",
    "ablauf.bild.entfernen": "Afbeelding verwijderen",
    "ablauf.bild.schwaerzenHilfe":
      "Om zwart te maken: sleep een kader over het gegeven in de afbeelding en kies dan „Gebied zwart maken”.",
    "ablauf.bild.schwaerzen": "Gebied zwart maken",
    "ablauf.bild.geschwaerzt":
      "Gebied zwart gemaakt. De afbeelding is opnieuw aangemaakt; het origineel zit er niet meer in.",
    "ablauf.bild.fehler": "De afbeelding kon niet worden bewerkt en blijft ongewijzigd.",
    "ablauf.schwaerzen.titel": "Gegeven in alle teksten zwart maken",
    "ablauf.schwaerzen.feld": "Zwart te maken gegeven",
    "ablauf.schwaerzen.knopf": "In teksten zwart maken",
    "ablauf.schwaerzen.ergebnis": "{{anzahl}} plaats(en) zwart gemaakt.",
    "ablauf.meta.titel": "Titel",
    "ablauf.meta.aussage": "Kernuitspraak",
    "ablauf.meta.art": "Kennissoort",
    "ablauf.meta.kategorie": "Categorie",
    "ablauf.meta.stufe": "Vertrouwelijkheid",
    "ablauf.meta.waehlen": "Maak een keuze",
    "ablauf.speichern": "Concept opslaan",
    "ablauf.gespeichert": "Concept opgeslagen.",
    "ablauf.ungespeichert": "Niet-opgeslagen wijzigingen",
    "ablauf.speichernFehler": "Niet opgeslagen: {{grund}} Je bewerking blijft hier behouden.",
    "ablauf.einreichen": "Ter beoordeling indienen",
    "ablauf.einreichenFehlt": "Voor indienen ontbreekt: {{felder}}",
    "ablauf.einreichenFehler": "Niet ingediend: {{grund}} Je concept blijft behouden.",
    "ablauf.eingereicht":
      "Ingediend. Het kennisobject doorloopt nu de beoordeling volgens de regel van je account – tot de beslissing is het geen geldige kennis.",
    "ablauf.bereitsEingereicht":
      "Deze opname heb je al als kennisobject ingediend. Er ontstaat geen tweede object. Geef voor een nieuwe versie hieronder het bestaande kennisobject op.",
    "ablauf.zumObjekt": "Kennisobject openen",
    "ablauf.fassung.titel": "Overnemen als nieuwe versie van een bestaand kennisobject",
    "ablauf.fassung.feld": "Kenmerk of adres van het kennisobject",
    "ablauf.fassung.knopf": "Nieuwe versie aanmaken",
    "ablauf.fassung.erfolg":
      "Versie {{version}} aangemaakt bij het bestaande kennisobject; ze wacht op beoordeling.",
    "ablauf.fassung.fehler": "Geen nieuwe versie aangemaakt: {{grund}}",
    "ablauf.laden.fehler": "Het concept kon niet worden geladen.",
    "ablauf.laden.keinAblauf": "Dit concept bevat geen schermprocedure.",
    "ablauf.formulierung.oeffnen": "Open {{adresse}}",
    "ablauf.formulierung.klicken": "Klik op „{{ziel}}”",
    "ablauf.formulierung.eingeben": "Voer „{{wert}}” in bij „{{ziel}}”",
    "ablauf.formulierung.taste": "Druk op de toets {{taste}}",
  },
} satisfies Textmodul;

// ================================================================================================
// ADMIN-15 — Unternehmensprofil und interne Richtlinien (`/unternehmen`, `/richtlinien`).
// ================================================================================================
//
// DE/EN/NL, weil der Textmodulvertrag jede Sprache der Oberfläche verlangt
// (docs/i18n-textmodule.md). Die Texte erklären Wirkung und Grenzen, sie versprechen keine
// rechtliche Wirkung: interne Richtlinien ersetzen weder Impressum noch Datenschutzerklärung.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "unternehmen.",
  legacySchluessel: [],
  de: {
    "unternehmen.seite.titel": "Unternehmensprofil und Richtlinien",
    "unternehmen.seite.lead":
      "Name, Logo und Akzentfarbe des Unternehmens sowie eigene interne Richtlinien mit Fassungen.",
    "unternehmen.seite.zurueck": "Zurück zur Verwaltung",
    "unternehmen.seite.laedt": "Wird geladen …",
    "unternehmen.verwaltung.zeile": "Unternehmensprofil und Richtlinien",
    "unternehmen.konto.richtlinien": "Interne Richtlinien",
    "unternehmen.abbrechen": "Abbrechen",
    "unternehmen.kopf.logoAlt": "Logo von {{name}}",

    "unternehmen.profil.titel": "Unternehmensprofil",
    "unternehmen.profil.name": "Name des Unternehmens",
    "unternehmen.profil.logo": "Logo",
    "unternehmen.profil.logoHinweis":
      "PNG oder JPEG, höchstens {{maxKb}} KB, mindestens {{min}} Pixel breit und hoch, Seitenverhältnis höchstens {{verhaeltnis}}:1. SVG wird nicht angenommen.",
    "unternehmen.profil.logoWaehlen": "Logodatei auswählen",
    "unternehmen.profil.logoEntfernen": "Logo entfernen",
    "unternehmen.profil.akzent": "Akzentfarbe",
    "unternehmen.profil.kontrast": "Kontrast {{wert}} : 1",
    "unternehmen.profil.grund": "Grund für die Übernahme von Fassung {{fassung}}",
    "unternehmen.profil.speichern": "Speichern",
    "unternehmen.profil.gespeichert": "Gespeichert als Fassung {{version}}.",
    "unternehmen.profil.verlauf": "Frühere Fassungen ({{anzahl}})",
    "unternehmen.profil.fassung": "Fassung {{version}} · {{zeit}} · {{wer}}",
    "unternehmen.profil.mitLogo": "mit Logo",
    "unternehmen.profil.ohneLogo": "ohne Logo",
    "unternehmen.profil.korrektur": "Übernommen aus Fassung {{fassung}}: {{grund}}",
    "unternehmen.profil.uebernehmen": "Fassung {{version}} als Vorlage übernehmen",

    "unternehmen.akzent.neutral": "Neutral (hell)",
    "unternehmen.akzent.nachtblau": "Nachtblau",
    "unternehmen.akzent.tannengruen": "Tannengrün",
    "unternehmen.akzent.aubergine": "Aubergine",
    "unternehmen.akzent.anthrazit": "Anthrazit",

    "unternehmen.vorschau.titel": "Vorschau des Unternehmenskopfs",
    "unternehmen.vorschau.ungespeichert":
      "So erscheint der Kopf der Seite „Interne Richtlinien“ nach dem Speichern. Noch nicht gespeichert.",
    "unternehmen.vorschau.gespeichert": "So erscheint der Kopf der Seite „Interne Richtlinien“.",
    "unternehmen.vorschau.desktop": "Breite Ansicht",
    "unternehmen.vorschau.mobil": "Mobil (390 Pixel)",
    "unternehmen.vorschau.leer": "Für die Vorschau bitte einen Namen eingeben.",

    "unternehmen.fehler.name": "Der Name muss zwischen 2 und 80 Zeichen lang sein.",
    "unternehmen.fehler.akzent": "Diese Akzentfarbe ist nicht verfügbar.",
    "unternehmen.fehler.logoTyp":
      "Diese Datei wurde abgewiesen: Als Logo sind nur PNG- oder JPEG-Dateien erlaubt. SVG und andere Formate können Skripte oder fremde Verweise enthalten.",
    "unternehmen.fehler.logoInhalt":
      "Diese Datei wurde abgewiesen: Ihr Inhalt ist kein lesbares PNG- oder JPEG-Bild.",
    "unternehmen.fehler.logoGross":
      "Diese Datei wurde abgewiesen: Sie ist größer als {{maxKb}} KB. Bitte eine kleinere Fassung des Logos wählen.",
    "unternehmen.fehler.logoMasse":
      "Diese Datei wurde abgewiesen: Das Bild muss zwischen 32 und 4000 Pixel breit und hoch sein, sonst ist das Logo nicht lesbar.",
    "unternehmen.fehler.logoFormat":
      "Diese Datei wurde abgewiesen: Das Logo ist zu schmal oder zu lang und wäre im Kopf nicht lesbar.",
    "unternehmen.fehler.veraltet":
      "Inzwischen wurde eine neuere Fassung gespeichert. Bitte die Seite neu laden und die Änderung erneut vornehmen.",
    "unternehmen.fehler.grund": "Bitte einen Grund mit mindestens 3 Zeichen angeben.",
    "unternehmen.fehler.titel": "Der Titel muss zwischen 3 und 120 Zeichen lang sein.",
    "unternehmen.fehler.text": "Bitte den Text der Richtlinie eingeben.",
    "unternehmen.fehler.verantwortlich":
      "Bitte angeben, wer für diese Fassung verantwortlich ist (2 bis 120 Zeichen).",
    "unternehmen.fehler.geltung":
      "Bitte ein gültiges Datum „Gültig ab“ und gültige Rollen angeben.",
    "unternehmen.fehler.anforderung":
      "Bitte festlegen, ob die Fassung nur angezeigt wird oder Kenntnisnahme bzw. Zustimmung verlangt.",
    "unternehmen.fehler.wirkung":
      "Die Wirkung hat sich geändert. Bitte die angezeigte Wirkung prüfen und erneut veröffentlichen.",
    "unternehmen.fehler.nichtHaltbar":
      "Diese Instanz kann die Angaben nicht dauerhaft speichern. Es wurde nichts geändert.",
    "unternehmen.fehler.anmeldung": "Bitte erneut anmelden.",
    "unternehmen.fehler.recht":
      "Unternehmensprofil und Richtlinien können nur Administratorinnen und Administratoren verwalten.",
    "unternehmen.fehler.allgemein": "Das hat nicht geklappt. Bitte erneut versuchen.",

    "unternehmen.anforderung.anzeige": "Nur anzeigen",
    "unternehmen.anforderung.anzeigeErklaerung":
      "Die Fassung wird angezeigt; es wird keine Bestätigung erfasst.",
    "unternehmen.anforderung.kenntnisnahme": "Kenntnisnahme verlangen",
    "unternehmen.anforderung.kenntnisnahmeErklaerung":
      "Jede betroffene Person bestätigt ausdrücklich, die Fassung zur Kenntnis genommen zu haben.",
    "unternehmen.anforderung.zustimmung": "Zustimmung verlangen",
    "unternehmen.anforderung.zustimmungErklaerung":
      "Jede betroffene Person stimmt der Fassung ausdrücklich zu.",
    "unternehmen.art.kenntnisnahme": "Kenntnisnahme",
    "unternehmen.art.zustimmung": "Zustimmung",

    "unternehmen.wirkung.pruefen": "Wirkung anzeigen",
    "unternehmen.wirkung.fehlt":
      "Vor dem Veröffentlichen bitte die Wirkung anzeigen lassen. Ändern sich Geltung oder verlangte Handlung, wird sie erneut angezeigt.",
    "unternehmen.wirkung.anzeige":
      "Diese Fassung wird {{betroffen}} Konten nur angezeigt. Es wird weder eine Kenntnisnahme noch eine Zustimmung verlangt.",
    "unternehmen.wirkung.erstmals.kenntnisnahme":
      "{{betroffen}} Konten müssen diese Fassung zur Kenntnis nehmen.",
    "unternehmen.wirkung.erstmals.zustimmung":
      "{{betroffen}} Konten müssen dieser Fassung zustimmen.",
    "unternehmen.wirkung.erneut.kenntnisnahme":
      "Erneut verlangt: Alle {{betroffen}} betroffenen Konten müssen Fassung {{fassung}} zur Kenntnis nehmen. {{alt}} Handlungen zu Fassung {{bisher}} bleiben im Protokoll erhalten, gelten aber nicht für die neue Fassung.",
    "unternehmen.wirkung.erneut.zustimmung":
      "Erneut verlangt: Alle {{betroffen}} betroffenen Konten müssen Fassung {{fassung}} zustimmen. {{alt}} Handlungen zu Fassung {{bisher}} bleiben im Protokoll erhalten, gelten aber nicht für die neue Fassung.",

    "unternehmen.richtlinien.verwaltungTitel": "Interne Richtlinien",
    "unternehmen.richtlinien.trennung":
      "Interne Richtlinien sind getrennt von persönlichen Einstellungen und von Impressum und Datenschutzerklärung.",
    "unternehmen.richtlinien.ansicht": "Ansicht für Beschäftigte öffnen",
    "unternehmen.richtlinien.verwaltungLeer": "Es gibt noch keine interne Richtlinie.",
    "unternehmen.richtlinie.neu": "Neue Richtlinie",
    "unternehmen.richtlinie.neueFassung": "Neue Fassung",
    "unternehmen.richtlinie.neueFassungVon": "Neue Fassung von „{{titel}}“",
    "unternehmen.richtlinie.titelFeld": "Titel",
    "unternehmen.richtlinie.text": "Text der Richtlinie",
    "unternehmen.richtlinie.verantwortlich": "Verantwortlich",
    "unternehmen.richtlinie.gueltigAb": "Gültig ab",
    "unternehmen.richtlinie.geltung": "Gilt für",
    "unternehmen.richtlinie.geltungHinweis": "Ohne Auswahl gilt die Richtlinie für alle Konten.",
    "unternehmen.richtlinie.alle": "alle Konten",
    "unternehmen.richtlinie.anforderung": "Verlangte Handlung",
    "unternehmen.richtlinie.aenderungsgrund": "Grund der neuen Fassung",
    "unternehmen.richtlinie.veroeffentlichen": "Fassung {{fassung}} veröffentlichen",
    "unternehmen.richtlinie.meta":
      "Fassung {{fassung}} · gültig ab {{datum}} · verantwortlich: {{verantwortlich}}",
    "unternehmen.richtlinie.metaVerwaltung":
      "Fassung {{fassung}} · gültig ab {{datum}} · verantwortlich: {{verantwortlich}} · gilt für: {{geltung}} · {{anforderung}}",
    "unternehmen.richtlinie.standAnzeige": "Wird {{betroffen}} Konten angezeigt.",
    "unternehmen.richtlinie.stand.kenntnisnahme":
      "{{erledigt}} von {{betroffen}} Konten haben Fassung {{fassung}} zur Kenntnis genommen.",
    "unternehmen.richtlinie.stand.zustimmung":
      "{{erledigt}} von {{betroffen}} Konten haben Fassung {{fassung}} zugestimmt.",
    "unternehmen.richtlinie.grundAnzeige": "Grund der aktuellen Fassung: {{grund}}",
    "unternehmen.richtlinie.fassungen": "Alle Fassungen ({{anzahl}})",
    "unternehmen.richtlinie.fassungZeile":
      "Fassung {{fassung}} · veröffentlicht {{zeit}} · verantwortlich: {{verantwortlich}} · {{anforderung}}",

    "unternehmen.protokoll.titel": "Protokoll",
    "unternehmen.protokoll.laedt": "Protokoll wird geladen …",
    "unternehmen.protokoll.hinweis":
      "Erfasst werden nur ausdrückliche Kenntnisnahmen und Zustimmungen, jeweils mit ihrer Fassung. Das bloße Anzeigen zählt nicht. Einträge können nicht gelöscht werden.",
    "unternehmen.protokoll.leer": "Noch keine Kenntnisnahme oder Zustimmung.",
    "unternehmen.protokoll.person": "Person",
    "unternehmen.protokoll.fassung": "Fassung",
    "unternehmen.protokoll.handlung": "Handlung",
    "unternehmen.protokoll.zeit": "Zeitpunkt",

    "unternehmen.richtlinien.titel": "Interne Richtlinien",
    "unternehmen.richtlinien.lead": "Die Regeln, die in unserem Unternehmen für dich gelten.",
    "unternehmen.richtlinien.laedt": "Richtlinien werden geladen …",
    "unternehmen.richtlinien.leer": "Für dich gilt derzeit keine interne Richtlinie.",
    "unternehmen.richtlinien.nurAnzeige": "Zur Information – eine Bestätigung ist nicht nötig.",
    "unternehmen.richtlinien.kenntnisErklaerung":
      "Mit dem Knopf bestätigst du, Fassung {{fassung}} zur Kenntnis genommen zu haben. Das Öffnen dieser Seite allein zählt nicht.",
    "unternehmen.richtlinien.zustimmungErklaerung":
      "Mit dem Knopf stimmst du Fassung {{fassung}} ausdrücklich zu. Das Öffnen dieser Seite allein zählt nicht.",
    "unternehmen.richtlinien.kenntnisnehmen": "Fassung {{fassung}} zur Kenntnis nehmen",
    "unternehmen.richtlinien.zustimmen": "Fassung {{fassung}} zustimmen",
    "unternehmen.richtlinien.kenntnisAm": "Fassung {{fassung}} zur Kenntnis genommen am {{zeit}}.",
    "unternehmen.richtlinien.zugestimmtAm": "Fassung {{fassung}} zugestimmt am {{zeit}}.",
    "unternehmen.richtlinien.fehler.veraltet":
      "Inzwischen gibt es eine neuere Fassung. Die Seite zeigt jetzt die aktuelle Fassung.",
    "unternehmen.richtlinien.fehler.weg": "Diese Richtlinie gilt nicht mehr für dich.",
    "unternehmen.richtlinien.rechtlich":
      "Rechtliche Dokumente sind davon getrennt und bleiben unverändert:",
    "unternehmen.richtlinien.impressum": "Impressum",
    "unternehmen.richtlinien.datenschutz": "Datenschutz",
  },
  en: {
    "unternehmen.seite.titel": "Company profile and policies",
    "unternehmen.seite.lead":
      "The company's name, logo and accent colour, plus your own internal policies with versions.",
    "unternehmen.seite.zurueck": "Back to administration",
    "unternehmen.seite.laedt": "Loading …",
    "unternehmen.verwaltung.zeile": "Company profile and policies",
    "unternehmen.konto.richtlinien": "Internal policies",
    "unternehmen.abbrechen": "Cancel",
    "unternehmen.kopf.logoAlt": "Logo of {{name}}",

    "unternehmen.profil.titel": "Company profile",
    "unternehmen.profil.name": "Company name",
    "unternehmen.profil.logo": "Logo",
    "unternehmen.profil.logoHinweis":
      "PNG or JPEG, at most {{maxKb}} KB, at least {{min}} pixels wide and high, aspect ratio at most {{verhaeltnis}}:1. SVG is not accepted.",
    "unternehmen.profil.logoWaehlen": "Choose logo file",
    "unternehmen.profil.logoEntfernen": "Remove logo",
    "unternehmen.profil.akzent": "Accent colour",
    "unternehmen.profil.kontrast": "Contrast {{wert}} : 1",
    "unternehmen.profil.grund": "Reason for restoring version {{fassung}}",
    "unternehmen.profil.speichern": "Save",
    "unternehmen.profil.gespeichert": "Saved as version {{version}}.",
    "unternehmen.profil.verlauf": "Earlier versions ({{anzahl}})",
    "unternehmen.profil.fassung": "Version {{version}} · {{zeit}} · {{wer}}",
    "unternehmen.profil.mitLogo": "with logo",
    "unternehmen.profil.ohneLogo": "without logo",
    "unternehmen.profil.korrektur": "Restored from version {{fassung}}: {{grund}}",
    "unternehmen.profil.uebernehmen": "Use version {{version}} as template",

    "unternehmen.akzent.neutral": "Neutral (light)",
    "unternehmen.akzent.nachtblau": "Night blue",
    "unternehmen.akzent.tannengruen": "Fir green",
    "unternehmen.akzent.aubergine": "Aubergine",
    "unternehmen.akzent.anthrazit": "Anthracite",

    "unternehmen.vorschau.titel": "Preview of the company header",
    "unternehmen.vorschau.ungespeichert":
      "This is how the header of the “Internal policies” page will look after saving. Not saved yet.",
    "unternehmen.vorschau.gespeichert":
      "This is how the header of the “Internal policies” page looks.",
    "unternehmen.vorschau.desktop": "Wide view",
    "unternehmen.vorschau.mobil": "Mobile (390 pixels)",
    "unternehmen.vorschau.leer": "Enter a name to see the preview.",

    "unternehmen.fehler.name": "The name must be between 2 and 80 characters long.",
    "unternehmen.fehler.akzent": "This accent colour is not available.",
    "unternehmen.fehler.logoTyp":
      "This file was rejected: only PNG or JPEG files are allowed as a logo. SVG and other formats can contain scripts or external references.",
    "unternehmen.fehler.logoInhalt":
      "This file was rejected: its content is not a readable PNG or JPEG image.",
    "unternehmen.fehler.logoGross":
      "This file was rejected: it is larger than {{maxKb}} KB. Please choose a smaller version of the logo.",
    "unternehmen.fehler.logoMasse":
      "This file was rejected: the image must be between 32 and 4000 pixels wide and high, otherwise the logo is not legible.",
    "unternehmen.fehler.logoFormat":
      "This file was rejected: the logo is too narrow or too long and would not be legible in the header.",
    "unternehmen.fehler.veraltet":
      "A newer version has been saved in the meantime. Please reload the page and make the change again.",
    "unternehmen.fehler.grund": "Please give a reason of at least 3 characters.",
    "unternehmen.fehler.titel": "The title must be between 3 and 120 characters long.",
    "unternehmen.fehler.text": "Please enter the text of the policy.",
    "unternehmen.fehler.verantwortlich":
      "Please state who is responsible for this version (2 to 120 characters).",
    "unternehmen.fehler.geltung": "Please enter a valid “Valid from” date and valid roles.",
    "unternehmen.fehler.anforderung":
      "Please decide whether the version is only displayed or requires acknowledgement or consent.",
    "unternehmen.fehler.wirkung":
      "The effect has changed. Please check the effect shown and publish again.",
    "unternehmen.fehler.nichtHaltbar":
      "This instance cannot store the information permanently. Nothing was changed.",
    "unternehmen.fehler.anmeldung": "Please sign in again.",
    "unternehmen.fehler.recht": "Only administrators can manage the company profile and policies.",
    "unternehmen.fehler.allgemein": "That did not work. Please try again.",

    "unternehmen.anforderung.anzeige": "Display only",
    "unternehmen.anforderung.anzeigeErklaerung":
      "The version is displayed; no confirmation is recorded.",
    "unternehmen.anforderung.kenntnisnahme": "Require acknowledgement",
    "unternehmen.anforderung.kenntnisnahmeErklaerung":
      "Every person concerned explicitly confirms having taken note of the version.",
    "unternehmen.anforderung.zustimmung": "Require consent",
    "unternehmen.anforderung.zustimmungErklaerung":
      "Every person concerned explicitly agrees to the version.",
    "unternehmen.art.kenntnisnahme": "Acknowledgement",
    "unternehmen.art.zustimmung": "Consent",

    "unternehmen.wirkung.pruefen": "Show effect",
    "unternehmen.wirkung.fehlt":
      "Please show the effect before publishing. If the scope or the required action changes, it is shown again.",
    "unternehmen.wirkung.anzeige":
      "This version is only displayed to {{betroffen}} accounts. Neither acknowledgement nor consent is required.",
    "unternehmen.wirkung.erstmals.kenntnisnahme":
      "{{betroffen}} accounts must acknowledge this version.",
    "unternehmen.wirkung.erstmals.zustimmung":
      "{{betroffen}} accounts must consent to this version.",
    "unternehmen.wirkung.erneut.kenntnisnahme":
      "Required again: all {{betroffen}} accounts concerned must acknowledge version {{fassung}}. {{alt}} actions on version {{bisher}} remain in the log but do not count for the new version.",
    "unternehmen.wirkung.erneut.zustimmung":
      "Required again: all {{betroffen}} accounts concerned must consent to version {{fassung}}. {{alt}} actions on version {{bisher}} remain in the log but do not count for the new version.",

    "unternehmen.richtlinien.verwaltungTitel": "Internal policies",
    "unternehmen.richtlinien.trennung":
      "Internal policies are separate from personal settings and from the legal notice and privacy policy.",
    "unternehmen.richtlinien.ansicht": "Open the employee view",
    "unternehmen.richtlinien.verwaltungLeer": "There is no internal policy yet.",
    "unternehmen.richtlinie.neu": "New policy",
    "unternehmen.richtlinie.neueFassung": "New version",
    "unternehmen.richtlinie.neueFassungVon": "New version of “{{titel}}”",
    "unternehmen.richtlinie.titelFeld": "Title",
    "unternehmen.richtlinie.text": "Policy text",
    "unternehmen.richtlinie.verantwortlich": "Responsible",
    "unternehmen.richtlinie.gueltigAb": "Valid from",
    "unternehmen.richtlinie.geltung": "Applies to",
    "unternehmen.richtlinie.geltungHinweis":
      "Without a selection the policy applies to all accounts.",
    "unternehmen.richtlinie.alle": "all accounts",
    "unternehmen.richtlinie.anforderung": "Required action",
    "unternehmen.richtlinie.aenderungsgrund": "Reason for the new version",
    "unternehmen.richtlinie.veroeffentlichen": "Publish version {{fassung}}",
    "unternehmen.richtlinie.meta":
      "Version {{fassung}} · valid from {{datum}} · responsible: {{verantwortlich}}",
    "unternehmen.richtlinie.metaVerwaltung":
      "Version {{fassung}} · valid from {{datum}} · responsible: {{verantwortlich}} · applies to: {{geltung}} · {{anforderung}}",
    "unternehmen.richtlinie.standAnzeige": "Displayed to {{betroffen}} accounts.",
    "unternehmen.richtlinie.stand.kenntnisnahme":
      "{{erledigt}} of {{betroffen}} accounts have acknowledged version {{fassung}}.",
    "unternehmen.richtlinie.stand.zustimmung":
      "{{erledigt}} of {{betroffen}} accounts have consented to version {{fassung}}.",
    "unternehmen.richtlinie.grundAnzeige": "Reason for the current version: {{grund}}",
    "unternehmen.richtlinie.fassungen": "All versions ({{anzahl}})",
    "unternehmen.richtlinie.fassungZeile":
      "Version {{fassung}} · published {{zeit}} · responsible: {{verantwortlich}} · {{anforderung}}",

    "unternehmen.protokoll.titel": "Log",
    "unternehmen.protokoll.laedt": "Loading log …",
    "unternehmen.protokoll.hinweis":
      "Only explicit acknowledgements and consents are recorded, each with its version. Merely viewing does not count. Entries cannot be deleted.",
    "unternehmen.protokoll.leer": "No acknowledgement or consent yet.",
    "unternehmen.protokoll.person": "Person",
    "unternehmen.protokoll.fassung": "Version",
    "unternehmen.protokoll.handlung": "Action",
    "unternehmen.protokoll.zeit": "Time",

    "unternehmen.richtlinien.titel": "Internal policies",
    "unternehmen.richtlinien.lead": "The rules that apply to you in our company.",
    "unternehmen.richtlinien.laedt": "Loading policies …",
    "unternehmen.richtlinien.leer": "No internal policy currently applies to you.",
    "unternehmen.richtlinien.nurAnzeige": "For information – no confirmation needed.",
    "unternehmen.richtlinien.kenntnisErklaerung":
      "With this button you confirm that you have taken note of version {{fassung}}. Opening this page alone does not count.",
    "unternehmen.richtlinien.zustimmungErklaerung":
      "With this button you explicitly consent to version {{fassung}}. Opening this page alone does not count.",
    "unternehmen.richtlinien.kenntnisnehmen": "Acknowledge version {{fassung}}",
    "unternehmen.richtlinien.zustimmen": "Consent to version {{fassung}}",
    "unternehmen.richtlinien.kenntnisAm": "Version {{fassung}} acknowledged on {{zeit}}.",
    "unternehmen.richtlinien.zugestimmtAm": "Consented to version {{fassung}} on {{zeit}}.",
    "unternehmen.richtlinien.fehler.veraltet":
      "There is a newer version in the meantime. The page now shows the current version.",
    "unternehmen.richtlinien.fehler.weg": "This policy no longer applies to you.",
    "unternehmen.richtlinien.rechtlich": "Legal documents are separate and remain unchanged:",
    "unternehmen.richtlinien.impressum": "Legal notice",
    "unternehmen.richtlinien.datenschutz": "Privacy",
  },
  nl: {
    "unternehmen.seite.titel": "Bedrijfsprofiel en richtlijnen",
    "unternehmen.seite.lead":
      "Naam, logo en accentkleur van het bedrijf en eigen interne richtlijnen met versies.",
    "unternehmen.seite.zurueck": "Terug naar beheer",
    "unternehmen.seite.laedt": "Laden …",
    "unternehmen.verwaltung.zeile": "Bedrijfsprofiel en richtlijnen",
    "unternehmen.konto.richtlinien": "Interne richtlijnen",
    "unternehmen.abbrechen": "Annuleren",
    "unternehmen.kopf.logoAlt": "Logo van {{name}}",

    "unternehmen.profil.titel": "Bedrijfsprofiel",
    "unternehmen.profil.name": "Bedrijfsnaam",
    "unternehmen.profil.logo": "Logo",
    "unternehmen.profil.logoHinweis":
      "PNG of JPEG, maximaal {{maxKb}} KB, minstens {{min}} pixels breed en hoog, beeldverhouding maximaal {{verhaeltnis}}:1. SVG wordt niet geaccepteerd.",
    "unternehmen.profil.logoWaehlen": "Logobestand kiezen",
    "unternehmen.profil.logoEntfernen": "Logo verwijderen",
    "unternehmen.profil.akzent": "Accentkleur",
    "unternehmen.profil.kontrast": "Contrast {{wert}} : 1",
    "unternehmen.profil.grund": "Reden voor het overnemen van versie {{fassung}}",
    "unternehmen.profil.speichern": "Opslaan",
    "unternehmen.profil.gespeichert": "Opgeslagen als versie {{version}}.",
    "unternehmen.profil.verlauf": "Eerdere versies ({{anzahl}})",
    "unternehmen.profil.fassung": "Versie {{version}} · {{zeit}} · {{wer}}",
    "unternehmen.profil.mitLogo": "met logo",
    "unternehmen.profil.ohneLogo": "zonder logo",
    "unternehmen.profil.korrektur": "Overgenomen uit versie {{fassung}}: {{grund}}",
    "unternehmen.profil.uebernehmen": "Versie {{version}} als sjabloon gebruiken",

    "unternehmen.akzent.neutral": "Neutraal (licht)",
    "unternehmen.akzent.nachtblau": "Nachtblauw",
    "unternehmen.akzent.tannengruen": "Dennengroen",
    "unternehmen.akzent.aubergine": "Aubergine",
    "unternehmen.akzent.anthrazit": "Antraciet",

    "unternehmen.vorschau.titel": "Voorbeeld van de bedrijfskop",
    "unternehmen.vorschau.ungespeichert":
      "Zo ziet de kop van de pagina „Interne richtlijnen” eruit na het opslaan. Nog niet opgeslagen.",
    "unternehmen.vorschau.gespeichert": "Zo ziet de kop van de pagina „Interne richtlijnen” eruit.",
    "unternehmen.vorschau.desktop": "Brede weergave",
    "unternehmen.vorschau.mobil": "Mobiel (390 pixels)",
    "unternehmen.vorschau.leer": "Voer een naam in voor het voorbeeld.",

    "unternehmen.fehler.name": "De naam moet tussen 2 en 80 tekens lang zijn.",
    "unternehmen.fehler.akzent": "Deze accentkleur is niet beschikbaar.",
    "unternehmen.fehler.logoTyp":
      "Dit bestand is geweigerd: als logo zijn alleen PNG- of JPEG-bestanden toegestaan. SVG en andere formaten kunnen scripts of externe verwijzingen bevatten.",
    "unternehmen.fehler.logoInhalt":
      "Dit bestand is geweigerd: de inhoud is geen leesbare PNG- of JPEG-afbeelding.",
    "unternehmen.fehler.logoGross":
      "Dit bestand is geweigerd: het is groter dan {{maxKb}} KB. Kies een kleinere versie van het logo.",
    "unternehmen.fehler.logoMasse":
      "Dit bestand is geweigerd: de afbeelding moet tussen 32 en 4000 pixels breed en hoog zijn, anders is het logo niet leesbaar.",
    "unternehmen.fehler.logoFormat":
      "Dit bestand is geweigerd: het logo is te smal of te lang en zou in de kop niet leesbaar zijn.",
    "unternehmen.fehler.veraltet":
      "Intussen is een nieuwere versie opgeslagen. Laad de pagina opnieuw en breng de wijziging opnieuw aan.",
    "unternehmen.fehler.grund": "Geef een reden van minstens 3 tekens op.",
    "unternehmen.fehler.titel": "De titel moet tussen 3 en 120 tekens lang zijn.",
    "unternehmen.fehler.text": "Voer de tekst van de richtlijn in.",
    "unternehmen.fehler.verantwortlich":
      "Geef aan wie verantwoordelijk is voor deze versie (2 tot 120 tekens).",
    "unternehmen.fehler.geltung": "Geef een geldige datum „Geldig vanaf” en geldige rollen op.",
    "unternehmen.fehler.anforderung":
      "Bepaal of de versie alleen wordt getoond of kennisname of instemming vraagt.",
    "unternehmen.fehler.wirkung":
      "Het effect is gewijzigd. Controleer het getoonde effect en publiceer opnieuw.",
    "unternehmen.fehler.nichtHaltbar":
      "Deze instantie kan de gegevens niet blijvend opslaan. Er is niets gewijzigd.",
    "unternehmen.fehler.anmeldung": "Meld je opnieuw aan.",
    "unternehmen.fehler.recht":
      "Alleen beheerders kunnen het bedrijfsprofiel en de richtlijnen beheren.",
    "unternehmen.fehler.allgemein": "Dat is niet gelukt. Probeer het opnieuw.",

    "unternehmen.anforderung.anzeige": "Alleen tonen",
    "unternehmen.anforderung.anzeigeErklaerung":
      "De versie wordt getoond; er wordt geen bevestiging vastgelegd.",
    "unternehmen.anforderung.kenntnisnahme": "Kennisname vragen",
    "unternehmen.anforderung.kenntnisnahmeErklaerung":
      "Iedere betrokken persoon bevestigt uitdrukkelijk kennis te hebben genomen van de versie.",
    "unternehmen.anforderung.zustimmung": "Instemming vragen",
    "unternehmen.anforderung.zustimmungErklaerung":
      "Iedere betrokken persoon stemt uitdrukkelijk in met de versie.",
    "unternehmen.art.kenntnisnahme": "Kennisname",
    "unternehmen.art.zustimmung": "Instemming",

    "unternehmen.wirkung.pruefen": "Effect tonen",
    "unternehmen.wirkung.fehlt":
      "Laat vóór het publiceren het effect tonen. Wijzigen de geldigheid of de gevraagde handeling, dan wordt het opnieuw getoond.",
    "unternehmen.wirkung.anzeige":
      "Deze versie wordt alleen getoond aan {{betroffen}} accounts. Er wordt geen kennisname of instemming gevraagd.",
    "unternehmen.wirkung.erstmals.kenntnisnahme":
      "{{betroffen}} accounts moeten kennisname van deze versie bevestigen.",
    "unternehmen.wirkung.erstmals.zustimmung":
      "{{betroffen}} accounts moeten met deze versie instemmen.",
    "unternehmen.wirkung.erneut.kenntnisnahme":
      "Opnieuw gevraagd: alle {{betroffen}} betrokken accounts moeten kennisname van versie {{fassung}} bevestigen. {{alt}} handelingen bij versie {{bisher}} blijven in het logboek, maar gelden niet voor de nieuwe versie.",
    "unternehmen.wirkung.erneut.zustimmung":
      "Opnieuw gevraagd: alle {{betroffen}} betrokken accounts moeten met versie {{fassung}} instemmen. {{alt}} handelingen bij versie {{bisher}} blijven in het logboek, maar gelden niet voor de nieuwe versie.",

    "unternehmen.richtlinien.verwaltungTitel": "Interne richtlijnen",
    "unternehmen.richtlinien.trennung":
      "Interne richtlijnen staan los van persoonlijke instellingen en van colofon en privacyverklaring.",
    "unternehmen.richtlinien.ansicht": "Weergave voor medewerkers openen",
    "unternehmen.richtlinien.verwaltungLeer": "Er is nog geen interne richtlijn.",
    "unternehmen.richtlinie.neu": "Nieuwe richtlijn",
    "unternehmen.richtlinie.neueFassung": "Nieuwe versie",
    "unternehmen.richtlinie.neueFassungVon": "Nieuwe versie van „{{titel}}”",
    "unternehmen.richtlinie.titelFeld": "Titel",
    "unternehmen.richtlinie.text": "Tekst van de richtlijn",
    "unternehmen.richtlinie.verantwortlich": "Verantwoordelijk",
    "unternehmen.richtlinie.gueltigAb": "Geldig vanaf",
    "unternehmen.richtlinie.geltung": "Geldt voor",
    "unternehmen.richtlinie.geltungHinweis":
      "Zonder selectie geldt de richtlijn voor alle accounts.",
    "unternehmen.richtlinie.alle": "alle accounts",
    "unternehmen.richtlinie.anforderung": "Gevraagde handeling",
    "unternehmen.richtlinie.aenderungsgrund": "Reden van de nieuwe versie",
    "unternehmen.richtlinie.veroeffentlichen": "Versie {{fassung}} publiceren",
    "unternehmen.richtlinie.meta":
      "Versie {{fassung}} · geldig vanaf {{datum}} · verantwoordelijk: {{verantwortlich}}",
    "unternehmen.richtlinie.metaVerwaltung":
      "Versie {{fassung}} · geldig vanaf {{datum}} · verantwoordelijk: {{verantwortlich}} · geldt voor: {{geltung}} · {{anforderung}}",
    "unternehmen.richtlinie.standAnzeige": "Wordt getoond aan {{betroffen}} accounts.",
    "unternehmen.richtlinie.stand.kenntnisnahme":
      "{{erledigt}} van {{betroffen}} accounts hebben kennisgenomen van versie {{fassung}}.",
    "unternehmen.richtlinie.stand.zustimmung":
      "{{erledigt}} van {{betroffen}} accounts hebben ingestemd met versie {{fassung}}.",
    "unternehmen.richtlinie.grundAnzeige": "Reden van de huidige versie: {{grund}}",
    "unternehmen.richtlinie.fassungen": "Alle versies ({{anzahl}})",
    "unternehmen.richtlinie.fassungZeile":
      "Versie {{fassung}} · gepubliceerd {{zeit}} · verantwoordelijk: {{verantwortlich}} · {{anforderung}}",

    "unternehmen.protokoll.titel": "Logboek",
    "unternehmen.protokoll.laedt": "Logboek wordt geladen …",
    "unternehmen.protokoll.hinweis":
      "Alleen uitdrukkelijke kennisnames en instemmingen worden vastgelegd, telkens met hun versie. Alleen bekijken telt niet. Vermeldingen kunnen niet worden verwijderd.",
    "unternehmen.protokoll.leer": "Nog geen kennisname of instemming.",
    "unternehmen.protokoll.person": "Persoon",
    "unternehmen.protokoll.fassung": "Versie",
    "unternehmen.protokoll.handlung": "Handeling",
    "unternehmen.protokoll.zeit": "Tijdstip",

    "unternehmen.richtlinien.titel": "Interne richtlijnen",
    "unternehmen.richtlinien.lead": "De regels die in ons bedrijf voor jou gelden.",
    "unternehmen.richtlinien.laedt": "Richtlijnen worden geladen …",
    "unternehmen.richtlinien.leer": "Er geldt momenteel geen interne richtlijn voor jou.",
    "unternehmen.richtlinien.nurAnzeige": "Ter informatie – een bevestiging is niet nodig.",
    "unternehmen.richtlinien.kenntnisErklaerung":
      "Met deze knop bevestig je dat je kennis hebt genomen van versie {{fassung}}. Alleen het openen van deze pagina telt niet.",
    "unternehmen.richtlinien.zustimmungErklaerung":
      "Met deze knop stem je uitdrukkelijk in met versie {{fassung}}. Alleen het openen van deze pagina telt niet.",
    "unternehmen.richtlinien.kenntnisnehmen": "Kennisname van versie {{fassung}} bevestigen",
    "unternehmen.richtlinien.zustimmen": "Instemmen met versie {{fassung}}",
    "unternehmen.richtlinien.kenntnisAm": "Kennisgenomen van versie {{fassung}} op {{zeit}}.",
    "unternehmen.richtlinien.zugestimmtAm": "Ingestemd met versie {{fassung}} op {{zeit}}.",
    "unternehmen.richtlinien.fehler.veraltet":
      "Intussen is er een nieuwere versie. De pagina toont nu de actuele versie.",
    "unternehmen.richtlinien.fehler.weg": "Deze richtlijn geldt niet meer voor jou.",
    "unternehmen.richtlinien.rechtlich":
      "Juridische documenten staan hier los van en blijven ongewijzigd:",
    "unternehmen.richtlinien.impressum": "Colofon",
    "unternehmen.richtlinien.datenschutz": "Privacy",
  },
} satisfies Textmodul;

// ================================================================================================
// AUFNAHME 20260922 · GESAMT-BESTANDSRESET — DER ADMINISTRATIVE AUFRUF (Nacharbeit 2).
// ================================================================================================
//
// Die Texte des Abschnitts „Wissensbestand zurücksetzen" in der Karte Werkseinstellungen
// (`pages/AdminDatenDetails.tsx`, `BestandsresetAbschnitt`). Peters Entscheidung vom 11.10.:
// Konten und Firmenwörterbuch bleiben; Folgenvorschau, zweimal das Passwort und ein Häkchen.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "bestandsreset.",
  legacySchluessel: [],
  de: {
    "bestandsreset.titel": "Wissensbestand zurücksetzen",
    "bestandsreset.erklaerung":
      "Löscht alle Wissensobjekte samt Papierkorb und alles, was an ihnen hängt (Fassungen, Belege, Importe, Prüfungen, Kenntnisnahmen). Konten, Anmeldungen, Einstellungen, das Firmenwörterbuch und das Auditprotokoll bleiben erhalten.",
    "bestandsreset.erhaltenHinweis": "Konten und Firmenwörterbuch bleiben in jedem Fall erhalten.",
    "bestandsreset.nichtVerfuegbar":
      "In dieser Installation nicht verfügbar — den Bestandsreset gibt es nur im Serverbetrieb mit Datenbank.",
    "bestandsreset.vorschauTitel": "Folgen des Zurücksetzens",
    "bestandsreset.wissensobjekte":
      "{{anzahl}} Wissensobjekte werden endgültig gelöscht, davon {{papierkorb}} im Papierkorb.",
    "bestandsreset.erhalten":
      "Bleibt erhalten: {{konten}} Konten und {{begriffe}} Begriffe im Firmenwörterbuch.",
    "bestandsreset.tabellen": "Gelöschte Datensätze je Bereich",
    "bestandsreset.letzterLauf": "Letzter Lauf: {{zustand}}",
    "bestandsreset.keinLauf": "Bisher wurde kein Bestandsreset ausgeführt.",
    "bestandsreset.zustand.ok": "erfolgreich abgeschlossen",
    "bestandsreset.zustand.zurueck": "zurückgerollt — der Bestand steht unverändert",
    "bestandsreset.zustand.laeuft": "läuft gerade",
    "bestandsreset.zustand.unklar": "Abschluss nicht belegt — bitte den Bestand prüfen",
    "bestandsreset.starten": "Wissensbestand zurücksetzen …",
    "bestandsreset.passwort": "Dein Passwort",
    "bestandsreset.passwortWiederholung": "Passwort wiederholen",
    "bestandsreset.ungleich": "Die beiden Passworteingaben stimmen nicht überein.",
    "bestandsreset.checkbox":
      "Ich habe die Folgen gelesen. Die Löschung ist endgültig und lässt sich nicht rückgängig machen.",
    "bestandsreset.ausfuehren": "Endgültig zurücksetzen",
    "bestandsreset.abbrechen": "Abbrechen",
    "bestandsreset.fertig":
      "Wissensbestand zurückgesetzt. Konten und Firmenwörterbuch sind erhalten.",
    "bestandsreset.falsch": "Falsches Passwort — es wurde nichts gelöscht.",
    "bestandsreset.veraltet":
      "Der Bestand hat sich seit der Vorschau verändert. Bitte die neue Vorschau prüfen und erneut bestätigen.",
    "bestandsreset.fehler": "Der Bestandsreset ist nicht durchgelaufen.",
    "bestandsreset.vorschauGeaendert":
      "Die Vorschau hat sich geändert. Bitte die neuen Folgen prüfen und erneut bestätigen.",
  },
  en: {
    "bestandsreset.titel": "Reset knowledge base",
    "bestandsreset.erklaerung":
      "Deletes all knowledge objects including the recycle bin and everything attached to them (versions, evidence, imports, reviews, acknowledgements). Accounts, sign-ins, settings, the company glossary and the audit log are kept.",
    "bestandsreset.erhaltenHinweis": "Accounts and the company glossary are always kept.",
    "bestandsreset.nichtVerfuegbar":
      "Not available in this installation — the knowledge base reset only exists in server mode with a database.",
    "bestandsreset.vorschauTitel": "Consequences of the reset",
    "bestandsreset.wissensobjekte":
      "{{anzahl}} knowledge objects will be deleted permanently, {{papierkorb}} of them in the recycle bin.",
    "bestandsreset.erhalten":
      "Kept: {{konten}} accounts and {{begriffe}} terms in the company glossary.",
    "bestandsreset.tabellen": "Deleted records per area",
    "bestandsreset.letzterLauf": "Last run: {{zustand}}",
    "bestandsreset.keinLauf": "No knowledge base reset has been run yet.",
    "bestandsreset.zustand.ok": "completed successfully",
    "bestandsreset.zustand.zurueck": "rolled back — the knowledge base is unchanged",
    "bestandsreset.zustand.laeuft": "currently running",
    "bestandsreset.zustand.unklar": "completion not confirmed — please check the knowledge base",
    "bestandsreset.starten": "Reset knowledge base …",
    "bestandsreset.passwort": "Your password",
    "bestandsreset.passwortWiederholung": "Repeat password",
    "bestandsreset.ungleich": "The two password entries do not match.",
    "bestandsreset.checkbox":
      "I have read the consequences. The deletion is permanent and cannot be undone.",
    "bestandsreset.ausfuehren": "Reset permanently",
    "bestandsreset.abbrechen": "Cancel",
    "bestandsreset.fertig": "Knowledge base reset. Accounts and the company glossary are kept.",
    "bestandsreset.falsch": "Wrong password — nothing was deleted.",
    "bestandsreset.veraltet":
      "The knowledge base has changed since the preview. Please check the new preview and confirm again.",
    "bestandsreset.fehler": "The knowledge base reset did not complete.",
    "bestandsreset.vorschauGeaendert":
      "The preview has changed. Please check the new consequences and confirm again.",
  },
  nl: {
    "bestandsreset.titel": "Kennisbestand terugzetten",
    "bestandsreset.erklaerung":
      "Verwijdert alle kennisobjecten inclusief de prullenbak en alles wat eraan hangt (versies, bewijzen, imports, controles, kennisnames). Accounts, aanmeldingen, instellingen, het bedrijfswoordenboek en het auditlogboek blijven behouden.",
    "bestandsreset.erhaltenHinweis":
      "Accounts en het bedrijfswoordenboek blijven in elk geval behouden.",
    "bestandsreset.nichtVerfuegbar":
      "Niet beschikbaar in deze installatie — het terugzetten van het kennisbestand bestaat alleen in serverbedrijf met een database.",
    "bestandsreset.vorschauTitel": "Gevolgen van het terugzetten",
    "bestandsreset.wissensobjekte":
      "{{anzahl}} kennisobjecten worden definitief verwijderd, waarvan {{papierkorb}} in de prullenbak.",
    "bestandsreset.erhalten":
      "Blijft behouden: {{konten}} accounts en {{begriffe}} begrippen in het bedrijfswoordenboek.",
    "bestandsreset.tabellen": "Verwijderde records per onderdeel",
    "bestandsreset.letzterLauf": "Laatste run: {{zustand}}",
    "bestandsreset.keinLauf": "Er is nog geen terugzetting van het kennisbestand uitgevoerd.",
    "bestandsreset.zustand.ok": "succesvol afgerond",
    "bestandsreset.zustand.zurueck": "teruggedraaid — het kennisbestand is ongewijzigd",
    "bestandsreset.zustand.laeuft": "loopt op dit moment",
    "bestandsreset.zustand.unklar": "afronding niet bevestigd — controleer het kennisbestand",
    "bestandsreset.starten": "Kennisbestand terugzetten …",
    "bestandsreset.passwort": "Je wachtwoord",
    "bestandsreset.passwortWiederholung": "Wachtwoord herhalen",
    "bestandsreset.ungleich": "De twee wachtwoordinvoeren komen niet overeen.",
    "bestandsreset.checkbox":
      "Ik heb de gevolgen gelezen. Het verwijderen is definitief en kan niet ongedaan worden gemaakt.",
    "bestandsreset.ausfuehren": "Definitief terugzetten",
    "bestandsreset.abbrechen": "Annuleren",
    "bestandsreset.fertig":
      "Kennisbestand teruggezet. Accounts en het bedrijfswoordenboek zijn behouden.",
    "bestandsreset.falsch": "Onjuist wachtwoord — er is niets verwijderd.",
    "bestandsreset.veraltet":
      "Het kennisbestand is sinds het voorbeeld gewijzigd. Controleer het nieuwe voorbeeld en bevestig opnieuw.",
    "bestandsreset.fehler": "Het terugzetten van het kennisbestand is niet voltooid.",
    "bestandsreset.vorschauGeaendert":
      "Het voorbeeld is gewijzigd. Controleer de nieuwe gevolgen en bevestig opnieuw.",
  },
} satisfies Textmodul;

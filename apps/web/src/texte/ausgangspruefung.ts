// ================================================================================================
// AUSGANGSPRÜFUNG (R-1646) — die Texte der Seite `/ausgangspruefung`.
// ================================================================================================
//
// NL steht hier, weil der Textmodulvertrag jede Sprache der Oberfläche verlangt
// (docs/i18n-textmodule.md) — ohne NL fiele die niederländische Oberfläche still auf Deutsch zurück.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "ausgangspruefung.",
  legacySchluessel: [],
  de: {
    "ausgangspruefung.seite.titel": "Ausgangsprüfung",
    "ausgangspruefung.seite.lead":
      "Bevor ein KI-Aufruf das Haus verlässt, steht hier genau der Text, der gesendet würde. Ersetzte Stellen sind hervorgehoben. Gesendet wird erst nach deiner Freigabe.",
    "ausgangspruefung.seite.grenze":
      "Automatisch ersetzt werden E-Mail-Adressen, Telefonnummern, IBANs und die vollständigen Namen der Konten dieser Installation. Andere Namen, Kunden oder Firmen erkennt die Prüfung nicht — steht so etwas noch im Text, bitte ablehnen.",
    "ausgangspruefung.seite.laedt": "Wartende Aufrufe werden geladen …",
    "ausgangspruefung.seite.aus":
      "Die Ausgangsprüfung ist in dieser Installation ausgeschaltet. Der Betreiber schaltet sie mit KLARWERK_AUSGANGSPRUEFUNG=an ein.",
    "ausgangspruefung.seite.leer": "Gerade wartet kein ausgehender Aufruf auf Freigabe.",
    "ausgangspruefung.eintrag.empfaenger": "Empfänger: {{anbieter}}",
    "ausgangspruefung.eintrag.zeit":
      "Wartet seit {{erstellt}} · ohne Entscheidung bis {{ablauf}} wird nichts gesendet",
    "ausgangspruefung.eintrag.keineErsetzung": "In diesem Text wurde nichts ersetzt.",
    "ausgangspruefung.eintrag.ersetzungen": "Ersetzt: {{liste}}",
    "ausgangspruefung.eintrag.bild":
      "Zu diesem Aufruf gehört ein Bild. Es wird unverändert gesendet und nicht anonymisiert.",
    "ausgangspruefung.eintrag.nutzer": "Ausgehender Text",
    "ausgangspruefung.eintrag.system": "Anweisung an das Modell anzeigen",
    "ausgangspruefung.eintrag.freigeben": "Freigeben und senden",
    "ausgangspruefung.eintrag.ablehnen": "Ablehnen",
    "ausgangspruefung.art.person": "Person",
    "ausgangspruefung.art.email": "E-Mail",
    "ausgangspruefung.art.telefon": "Telefon",
    "ausgangspruefung.art.iban": "IBAN",
    "ausgangspruefung.fehler.anmeldung": "Bitte melde dich erneut an.",
    "ausgangspruefung.fehler.recht":
      "Die Ausgangsprüfung ist Controllern und Administratoren vorbehalten.",
    "ausgangspruefung.fehler.nichtMehrOffen":
      "Dieser Aufruf wartet nicht mehr — er wurde schon entschieden oder ist abgelaufen.",
    "ausgangspruefung.fehler.allgemein": "Das hat nicht geklappt. Bitte versuche es erneut.",
  },
  en: {
    "ausgangspruefung.seite.titel": "Outbound check",
    "ausgangspruefung.seite.lead":
      "Before an AI call leaves the organisation, this page shows exactly the text that would be sent. Replaced passages are highlighted. Nothing is sent until you approve it.",
    "ausgangspruefung.seite.grenze":
      "Email addresses, phone numbers, IBANs and the full names of this installation's accounts are replaced automatically. Other names, customers or companies are not detected — if anything like that remains in the text, please reject.",
    "ausgangspruefung.seite.laedt": "Loading waiting calls …",
    "ausgangspruefung.seite.aus":
      "The outbound check is switched off in this installation. The operator switches it on with KLARWERK_AUSGANGSPRUEFUNG=an.",
    "ausgangspruefung.seite.leer": "No outbound call is currently waiting for approval.",
    "ausgangspruefung.eintrag.empfaenger": "Recipient: {{anbieter}}",
    "ausgangspruefung.eintrag.zeit":
      "Waiting since {{erstellt}} · without a decision by {{ablauf}} nothing is sent",
    "ausgangspruefung.eintrag.keineErsetzung": "Nothing was replaced in this text.",
    "ausgangspruefung.eintrag.ersetzungen": "Replaced: {{liste}}",
    "ausgangspruefung.eintrag.bild":
      "This call includes an image. It is sent unchanged and is not anonymised.",
    "ausgangspruefung.eintrag.nutzer": "Outbound text",
    "ausgangspruefung.eintrag.system": "Show instruction to the model",
    "ausgangspruefung.eintrag.freigeben": "Approve and send",
    "ausgangspruefung.eintrag.ablehnen": "Reject",
    "ausgangspruefung.art.person": "Person",
    "ausgangspruefung.art.email": "Email",
    "ausgangspruefung.art.telefon": "Phone",
    "ausgangspruefung.art.iban": "IBAN",
    "ausgangspruefung.fehler.anmeldung": "Please sign in again.",
    "ausgangspruefung.fehler.recht": "The outbound check is reserved for controllers and admins.",
    "ausgangspruefung.fehler.nichtMehrOffen":
      "This call is no longer waiting — it has already been decided or has expired.",
    "ausgangspruefung.fehler.allgemein": "That did not work. Please try again.",
  },
  nl: {
    "ausgangspruefung.seite.titel": "Uitgaande controle",
    "ausgangspruefung.seite.lead":
      "Voordat een AI-aanroep de organisatie verlaat, staat hier precies de tekst die verzonden zou worden. Vervangen passages zijn gemarkeerd. Er wordt pas verzonden na jouw goedkeuring.",
    "ausgangspruefung.seite.grenze":
      "E-mailadressen, telefoonnummers, IBAN's en de volledige namen van de accounts van deze installatie worden automatisch vervangen. Andere namen, klanten of bedrijven worden niet herkend — staat zoiets nog in de tekst, wijs dan af.",
    "ausgangspruefung.seite.laedt": "Wachtende aanroepen worden geladen …",
    "ausgangspruefung.seite.aus":
      "De uitgaande controle is in deze installatie uitgeschakeld. De beheerder schakelt haar in met KLARWERK_AUSGANGSPRUEFUNG=an.",
    "ausgangspruefung.seite.leer": "Er wacht momenteel geen uitgaande aanroep op goedkeuring.",
    "ausgangspruefung.eintrag.empfaenger": "Ontvanger: {{anbieter}}",
    "ausgangspruefung.eintrag.zeit":
      "Wacht sinds {{erstellt}} · zonder besluit vóór {{ablauf}} wordt niets verzonden",
    "ausgangspruefung.eintrag.keineErsetzung": "In deze tekst is niets vervangen.",
    "ausgangspruefung.eintrag.ersetzungen": "Vervangen: {{liste}}",
    "ausgangspruefung.eintrag.bild":
      "Bij deze aanroep hoort een afbeelding. Die wordt ongewijzigd verzonden en niet geanonimiseerd.",
    "ausgangspruefung.eintrag.nutzer": "Uitgaande tekst",
    "ausgangspruefung.eintrag.system": "Instructie aan het model tonen",
    "ausgangspruefung.eintrag.freigeben": "Goedkeuren en verzenden",
    "ausgangspruefung.eintrag.ablehnen": "Afwijzen",
    "ausgangspruefung.art.person": "Persoon",
    "ausgangspruefung.art.email": "E-mail",
    "ausgangspruefung.art.telefon": "Telefoon",
    "ausgangspruefung.art.iban": "IBAN",
    "ausgangspruefung.fehler.anmeldung": "Meld je opnieuw aan.",
    "ausgangspruefung.fehler.recht":
      "De uitgaande controle is voorbehouden aan controllers en beheerders.",
    "ausgangspruefung.fehler.nichtMehrOffen":
      "Deze aanroep wacht niet meer — er is al over beslist of hij is verlopen.",
    "ausgangspruefung.fehler.allgemein": "Dat is niet gelukt. Probeer het opnieuw.",
  },
} satisfies Textmodul;

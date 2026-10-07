// ================================================================================================
// produkt:wettbewerb:20261003:lernplattform — die Texte der Übergabe an eine Lernplattform.
// ================================================================================================
//
// Drei Dinge werden hier bewusst AUSEINANDERGEHALTEN, weil der Auftrag es verlangt und weil eine
// Vermischung irreführt:
//   · die INHALTSÜBERGABE (Klarwerk erzeugt ein Paket — mehr nicht),
//   · der LERNABSCHLUSS (meldet das Paket in der Lernplattform, nicht Klarwerk),
//   · der RÜCKKANAL nach Klarwerk (gibt es nicht; Klarwerk zeigt keine Lernergebnisse).
// Befundtexte werden über den Code des Dienstes gewählt (`lmsexport.befund.<CODE>`).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "lmsexport.",
  legacySchluessel: [],
  de: {
    "lmsexport.titel": "An Lernplattform übergeben (SCORM 1.2)",
    "lmsexport.einleitung":
      "Erzeugt aus den gewählten validierten Wissensobjekten ein SCORM-1.2-Paket (ZIP) für Moodle 4.5 LTS. Das Paket lädt nichts aus dem Netz nach.",
    "lmsexport.grenzen":
      "Klarwerk übergibt nur den Inhalt. Den Lernabschluss meldet das Paket an die Lernplattform; Klarwerk liest keine Lernergebnisse zurück. Eine bereits veröffentlichte Fassung in der Lernplattform ersetzt Klarwerk nicht — das neue Paket muss dort bewusst eingespielt werden.",
    "lmsexport.empfaenger": "Empfänger (freigegebene Lernplattform)",
    "lmsexport.keineEmpfaenger": "Keine Lernplattform freigegeben",
    "lmsexport.sprache": "Paketsprache",
    "lmsexport.sprache.de": "Deutsch",
    "lmsexport.sprache.en": "Englisch",
    "lmsexport.pruefen": "Export prüfen",
    "lmsexport.herunterladen": "SCORM-Paket herunterladen",
    "lmsexport.exportierbar": "Exportierbar. Exportfassung {{kennung}}.",
    "lmsexport.blockiert": "Nicht exportierbar — bitte die Befunde unten beheben.",
    "lmsexport.hinweise": "Hinweise (nicht im Paket enthalten)",
    "lmsexport.befunde": "Befunde",
    "lmsexport.heruntergeladen":
      "Paket {{datei}} gespeichert. Inhalt übergeben — noch nicht in der Lernplattform eingespielt.",
    "lmsexport.fehler": "Das Paket konnte nicht erzeugt werden.",
    "lmsexport.bereich.inhalt": "Inhaltsfreigabe",
    "lmsexport.bereich.medien": "Medien",
    "lmsexport.bereich.quellen": "Quellen",
    "lmsexport.bereich.empfaenger": "Empfängerfreigabe",
    "lmsexport.befund.NO_SOURCES": "Kein Wissensobjekt gewählt.",
    "lmsexport.befund.TOO_MANY_SOURCES": "Zu viele Wissensobjekte für ein Paket.",
    "lmsexport.befund.UNKNOWN_KO": "Wissensobjekt nicht gefunden.",
    "lmsexport.befund.NOT_VALIDATED": "Nicht validiert — nur validiertes Wissen darf hinaus.",
    "lmsexport.befund.CONFIDENTIAL": "Vertraulich — darf nicht an eine Lernplattform gehen.",
    "lmsexport.befund.SCHUTZDATEN": "Enthält Schutzdaten (Quarantäne) — nicht exportierbar.",
    "lmsexport.befund.SOURCE_RESTRICTED":
      "Quelle ist im Quellsystem zugriffsbeschränkt — nicht exportierbar.",
    "lmsexport.befund.MEDIA_MISSING": "Bild fehlt im Speicher — das Paket wäre unvollständig.",
    "lmsexport.befund.MEDIA_UNSUPPORTED":
      "Medienformat wird im Paket nicht unterstützt (nur PNG, JPEG, GIF, WebP).",
    "lmsexport.befund.MEDIA_CONFIDENTIAL": "Bild ist vertraulich eingestuft — nicht exportierbar.",
    "lmsexport.befund.MEDIA_FOREIGN":
      "Bild stammt aus einem Fremdsystem — ohne geklärte Rechte nicht exportierbar.",
    "lmsexport.befund.ATTACHMENTS_NOT_INCLUDED":
      "Anhänge (keine eingebetteten Bilder) gehen nicht ins Paket.",
    "lmsexport.befund.LINK_INTERNAL_REMOVED":
      "Interne Klarwerk-Verweise funktionieren in der Lernplattform nicht und wurden als Text belassen.",
    "lmsexport.befund.EXTERNAL_LINK":
      "Externe Verweise bleiben erhalten und öffnen nur auf Klick (keine automatische Netzverbindung).",
    "lmsexport.befund.RECIPIENTS_NOT_CONFIGURED":
      "Der Betreiber hat keine Lernplattform freigegeben (KLARWERK_LMS_EMPFAENGER).",
    "lmsexport.befund.RECIPIENT_NOT_ALLOWED": "Diese Lernplattform ist nicht freigegeben.",
  },
  en: {
    "lmsexport.titel": "Hand over to a learning platform (SCORM 1.2)",
    "lmsexport.einleitung":
      "Creates a SCORM 1.2 package (ZIP) for Moodle 4.5 LTS from the selected validated knowledge objects. The package loads nothing from the network.",
    "lmsexport.grenzen":
      "Klarwerk only hands over the content. The package reports learning completion to the learning platform; Klarwerk does not read any learning results back. Klarwerk does not replace a version already published in the learning platform — the new package must be imported there deliberately.",
    "lmsexport.empfaenger": "Recipient (approved learning platform)",
    "lmsexport.keineEmpfaenger": "No learning platform approved",
    "lmsexport.sprache": "Package language",
    "lmsexport.sprache.de": "German",
    "lmsexport.sprache.en": "English",
    "lmsexport.pruefen": "Check export",
    "lmsexport.herunterladen": "Download SCORM package",
    "lmsexport.exportierbar": "Exportable. Export version {{kennung}}.",
    "lmsexport.blockiert": "Not exportable — please resolve the findings below.",
    "lmsexport.hinweise": "Notes (not included in the package)",
    "lmsexport.befunde": "Findings",
    "lmsexport.heruntergeladen":
      "Package {{datei}} saved. Content handed over — not yet imported into the learning platform.",
    "lmsexport.fehler": "The package could not be created.",
    "lmsexport.bereich.inhalt": "Content release",
    "lmsexport.bereich.medien": "Media",
    "lmsexport.bereich.quellen": "Sources",
    "lmsexport.bereich.empfaenger": "Recipient release",
    "lmsexport.befund.NO_SOURCES": "No knowledge object selected.",
    "lmsexport.befund.TOO_MANY_SOURCES": "Too many knowledge objects for one package.",
    "lmsexport.befund.UNKNOWN_KO": "Knowledge object not found.",
    "lmsexport.befund.NOT_VALIDATED": "Not validated — only validated knowledge may leave.",
    "lmsexport.befund.CONFIDENTIAL": "Confidential — must not go to a learning platform.",
    "lmsexport.befund.SCHUTZDATEN": "Contains protected data (quarantine) — not exportable.",
    "lmsexport.befund.SOURCE_RESTRICTED":
      "Source is access-restricted in its source system — not exportable.",
    "lmsexport.befund.MEDIA_MISSING": "Image missing in storage — the package would be incomplete.",
    "lmsexport.befund.MEDIA_UNSUPPORTED":
      "Media format not supported in the package (PNG, JPEG, GIF, WebP only).",
    "lmsexport.befund.MEDIA_CONFIDENTIAL": "Image is classified confidential — not exportable.",
    "lmsexport.befund.MEDIA_FOREIGN":
      "Image comes from an external system — not exportable without cleared rights.",
    "lmsexport.befund.ATTACHMENTS_NOT_INCLUDED":
      "Attachments (not embedded images) are not included in the package.",
    "lmsexport.befund.LINK_INTERNAL_REMOVED":
      "Internal Klarwerk links do not work in the learning platform and were kept as text.",
    "lmsexport.befund.EXTERNAL_LINK":
      "External links are kept and only open on click (no automatic network connection).",
    "lmsexport.befund.RECIPIENTS_NOT_CONFIGURED":
      "The operator has not approved any learning platform (KLARWERK_LMS_EMPFAENGER).",
    "lmsexport.befund.RECIPIENT_NOT_ALLOWED": "This learning platform is not approved.",
  },
  nl: {
    "lmsexport.titel": "Overdragen aan een leerplatform (SCORM 1.2)",
    "lmsexport.einleitung":
      "Maakt van de gekozen gevalideerde kennisobjecten een SCORM 1.2-pakket (ZIP) voor Moodle 4.5 LTS. Het pakket laadt niets van het netwerk.",
    "lmsexport.grenzen":
      "Klarwerk draagt alleen de inhoud over. Het pakket meldt de leerafronding aan het leerplatform; Klarwerk leest geen leerresultaten terug. Klarwerk vervangt geen versie die al in het leerplatform is gepubliceerd — het nieuwe pakket moet daar bewust worden ingelezen.",
    "lmsexport.empfaenger": "Ontvanger (vrijgegeven leerplatform)",
    "lmsexport.keineEmpfaenger": "Geen leerplatform vrijgegeven",
    "lmsexport.sprache": "Pakkettaal",
    "lmsexport.sprache.de": "Duits",
    "lmsexport.sprache.en": "Engels",
    "lmsexport.pruefen": "Export controleren",
    "lmsexport.herunterladen": "SCORM-pakket downloaden",
    "lmsexport.exportierbar": "Exporteerbaar. Exportversie {{kennung}}.",
    "lmsexport.blockiert": "Niet exporteerbaar — los de bevindingen hieronder op.",
    "lmsexport.hinweise": "Opmerkingen (niet in het pakket opgenomen)",
    "lmsexport.befunde": "Bevindingen",
    "lmsexport.heruntergeladen":
      "Pakket {{datei}} opgeslagen. Inhoud overgedragen — nog niet in het leerplatform ingelezen.",
    "lmsexport.fehler": "Het pakket kon niet worden aangemaakt.",
    "lmsexport.bereich.inhalt": "Inhoudsvrijgave",
    "lmsexport.bereich.medien": "Media",
    "lmsexport.bereich.quellen": "Bronnen",
    "lmsexport.bereich.empfaenger": "Ontvangervrijgave",
    "lmsexport.befund.NO_SOURCES": "Geen kennisobject gekozen.",
    "lmsexport.befund.TOO_MANY_SOURCES": "Te veel kennisobjecten voor één pakket.",
    "lmsexport.befund.UNKNOWN_KO": "Kennisobject niet gevonden.",
    "lmsexport.befund.NOT_VALIDATED":
      "Niet gevalideerd — alleen gevalideerde kennis mag naar buiten.",
    "lmsexport.befund.CONFIDENTIAL": "Vertrouwelijk — mag niet naar een leerplatform.",
    "lmsexport.befund.SCHUTZDATEN": "Bevat beschermde gegevens (quarantaine) — niet exporteerbaar.",
    "lmsexport.befund.SOURCE_RESTRICTED":
      "Bron is in het bronsysteem toegangsbeperkt — niet exporteerbaar.",
    "lmsexport.befund.MEDIA_MISSING":
      "Afbeelding ontbreekt in de opslag — het pakket zou onvolledig zijn.",
    "lmsexport.befund.MEDIA_UNSUPPORTED":
      "Mediaformaat wordt in het pakket niet ondersteund (alleen PNG, JPEG, GIF, WebP).",
    "lmsexport.befund.MEDIA_CONFIDENTIAL":
      "Afbeelding is vertrouwelijk ingedeeld — niet exporteerbaar.",
    "lmsexport.befund.MEDIA_FOREIGN":
      "Afbeelding komt uit een extern systeem — zonder geregelde rechten niet exporteerbaar.",
    "lmsexport.befund.ATTACHMENTS_NOT_INCLUDED":
      "Bijlagen (geen ingesloten afbeeldingen) gaan niet mee in het pakket.",
    "lmsexport.befund.LINK_INTERNAL_REMOVED":
      "Interne Klarwerk-verwijzingen werken niet in het leerplatform en zijn als tekst behouden.",
    "lmsexport.befund.EXTERNAL_LINK":
      "Externe verwijzingen blijven behouden en openen alleen bij een klik (geen automatische netwerkverbinding).",
    "lmsexport.befund.RECIPIENTS_NOT_CONFIGURED":
      "De beheerder heeft geen leerplatform vrijgegeven (KLARWERK_LMS_EMPFAENGER).",
    "lmsexport.befund.RECIPIENT_NOT_ALLOWED": "Dit leerplatform is niet vrijgegeven.",
  },
} satisfies Textmodul;

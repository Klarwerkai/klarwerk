// ================================================================================================
// OFFICE IM ARTIKEL · die Texte des eingebetteten Office-Editors am Artikel.
// ================================================================================================
//
// Auftrag `produkt:20261007:office-artikel-editor`. Die Texte sagen, was beim Öffnen, Speichern,
// Abbrechen und bei einem Konflikt wirklich geschieht — insbesondere, dass eine Dokumentänderung den
// Artikel nie freigibt und dass Klara keine Markierung aus dem Editor sieht.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "officeartikel.",
  legacySchluessel: [],
  de: {
    "officeartikel.titel": "Office-Dokumente im Artikel",
    "officeartikel.oeffnen": "Im Artikel öffnen",
    "officeartikel.zuklappen": "Zuklappen",
    "officeartikel.fassungStatus": "Artikelfassung {{fassung}} · Status: {{status}}",
    "officeartikel.weg.direkt": "Du kannst dieses Dokument hier bearbeiten.",
    "officeartikel.weg.vorschlag":
      "Dieser Artikel ist freigegeben. Ohne Freigaberecht kannst du das Dokument nur ansehen.",
    "officeartikel.weg.nur-lesen": "Du kannst dieses Dokument hier nur ansehen.",
    "officeartikel.weg.kein-zugang": "Du hast keinen Zugang zu diesem Dokument.",
    "officeartikel.statusRegel":
      "Jede gespeicherte Dokumentänderung wird eine neue Artikelfassung mit Status „offen“. Die Aussagen des Artikels gelten danach nicht automatisch als geprüft; eine Freigabe geschieht nie von selbst.",
    "officeartikel.gemeinsam":
      "Dieses Dokument ist gerade im Editor geöffnet (begonnen auf Fassung {{fassung}}). Wer es jetzt öffnet, arbeitet in derselben Bearbeitung mit.",
    "officeartikel.gesichert":
      "Ein Bearbeitungsstand vom {{zeit}} wurde beim Schließen nicht übernommen, weil der Artikel inzwischen anderweitig geändert wurde. Der Stand ist gesichert; es wurde nichts überschrieben.",
    "officeartikel.gesichertUebernehmen": "Gesicherten Stand als neue Fassung übernehmen",
    "officeartikel.bearbeiten": "Im Editor bearbeiten",
    "officeartikel.ansehen": "Im Editor ansehen",
    "officeartikel.zurueckZumArtikel": "Zurück zum Artikel",
    "officeartikel.alsFassung": "Als neue Fassung übernehmen",
    "officeartikel.speichernZurueck": "Speichern und zurück zum Artikel",
    "officeartikel.abbrechen": "Abbrechen",
    "officeartikel.abgebrochen": "Die Ansicht wurde geschlossen.",
    "officeartikel.abgebrochenSchreiben":
      "Die Bearbeitung wurde abgebrochen. Was der Editor bereits automatisch gespeichert hatte, wird beim Schließen als neue Fassung übernommen oder — bei einem Konflikt — gesichert.",
    "officeartikel.editorGeschlossen": "Der Editor wurde geschlossen.",
    "officeartikel.uebernommen":
      "Gespeichert als Artikelfassung {{fassung}}. Status: offen — bitte die Aussagen neu prüfen lassen.",
    "officeartikel.editorTitel": "Eingebetteter Office-Editor",
    "officeartikel.klaraOhneAuswahl":
      "Klara sieht Markierungen in diesem Editor nicht: der Editor übergibt keine Auswahl. Klara hilft weiter mit markiertem Text aus dem Artikel.",
    "officeartikel.phase.laedt": "Der Editor lädt das Dokument …",
    "officeartikel.phase.bereit": "Der Editor ist bereit.",
    "officeartikel.phase.speichert": "Der Editor speichert …",
    "officeartikel.phase.uebernimmt": "Der Stand wird als neue Fassung übernommen …",
    "officeartikel.phase.fehler": "Der Editor arbeitet nicht wie erwartet.",
    "officeartikel.phase.abgebrochen": "Abgebrochen.",
    "officeartikel.phase.geschlossen": "Der Editor ist geschlossen.",
    "officeartikel.verlauf": "Dokumentstände",
    "officeartikel.stand": "Fassung {{fassung}} · {{zeit}}",
    "officeartikel.zurueckgeholtAus": "zurückgeholt aus Fassung {{fassung}}",
    "officeartikel.aktuell": "aktuell",
    "officeartikel.zurueckholen": "Dokument aus Fassung {{fassung}} zurückholen",
    "officeartikel.belegstellen": "Belegstellen aus diesem Dokument",
    "officeartikel.keineBelegstellen":
      "Keine Belegstelle des Artikels stützt sich auf dieses Dokument.",
    "officeartikel.belegAktuell": "stützt sich auf den aktuellen Dokumentstand",
    "officeartikel.belegFrueher":
      "stützt sich auf einen früheren Dokumentstand (Fassung {{fassung}}) — nach der Änderung nicht neu geprüft",
    "officeartikel.fehler.netz": "Keine Verbindung zum Server. Es wurde nichts geändert.",
    "officeartikel.fehler.nichtEingerichtet":
      "Der eingebettete Office-Editor ist auf diesem Server nicht eingerichtet.",
    "officeartikel.fehler.nichtErreichbar":
      "Der Office-Editor antwortet gerade nicht. Es wurde nichts geändert.",
    "officeartikel.fehler.formatNichtAngeboten":
      "Der Office-Editor bietet für dieses Dateiformat diese Aktion nicht an.",
    "officeartikel.fehler.konflikt":
      "Der Artikel wurde inzwischen anderweitig geändert. Es wurde nichts überschrieben. Dein Stand bleibt im Editor und wird beim Schließen gesichert.",
    "officeartikel.fehler.keineSitzung": "Für dieses Dokument läuft keine Bearbeitung mehr.",
    "officeartikel.fehler.nichtsGespeichert": "Der Editor hat noch nichts gespeichert.",
    "officeartikel.fehler.sitzungLaeuft":
      "Das Dokument ist gerade im Editor geöffnet. Bitte zuerst die Bearbeitung schließen.",
    "officeartikel.fehler.freigegeben":
      "Dieser Artikel ist freigegeben. Ohne Freigaberecht wird das Dokument nur angesehen.",
    "officeartikel.fehler.keinRecht": "Du darfst dieses Dokument nicht öffnen oder ändern.",
    "officeartikel.fehler.allgemein": "Das hat nicht geklappt. Es wurde nichts geändert.",
    "officeartikel.fehler.laden":
      "Der Editor hat das Dokument nicht geladen. Bitte abbrechen und erneut öffnen.",
    "officeartikel.fehler.speichern":
      "Der Editor hat das Speichern nicht bestätigt. Der Editor bleibt offen; es ist nichts verloren.",
  },
  en: {
    "officeartikel.titel": "Office documents in the article",
    "officeartikel.oeffnen": "Open in article",
    "officeartikel.zuklappen": "Collapse",
    "officeartikel.fassungStatus": "Article version {{fassung}} · Status: {{status}}",
    "officeartikel.weg.direkt": "You can edit this document here.",
    "officeartikel.weg.vorschlag":
      "This article is released. Without release rights you can only view the document.",
    "officeartikel.weg.nur-lesen": "You can only view this document here.",
    "officeartikel.weg.kein-zugang": "You have no access to this document.",
    "officeartikel.statusRegel":
      "Every saved document change becomes a new article version with status “open”. The article's statements are not automatically considered checked afterwards; a release never happens by itself.",
    "officeartikel.gemeinsam":
      "This document is currently open in the editor (started on version {{fassung}}). Whoever opens it now joins the same editing session.",
    "officeartikel.gesichert":
      "An editing state from {{zeit}} was not taken over on closing because the article was changed elsewhere in the meantime. The state is kept; nothing was overwritten.",
    "officeartikel.gesichertUebernehmen": "Take over kept state as new version",
    "officeartikel.bearbeiten": "Edit in editor",
    "officeartikel.ansehen": "View in editor",
    "officeartikel.zurueckZumArtikel": "Back to article",
    "officeartikel.alsFassung": "Take over as new version",
    "officeartikel.speichernZurueck": "Save and back to article",
    "officeartikel.abbrechen": "Cancel",
    "officeartikel.abgebrochen": "The view was closed.",
    "officeartikel.abgebrochenSchreiben":
      "Editing was cancelled. Whatever the editor had already saved automatically is taken over as a new version on closing or — in case of a conflict — kept.",
    "officeartikel.editorGeschlossen": "The editor was closed.",
    "officeartikel.uebernommen":
      "Saved as article version {{fassung}}. Status: open — please have the statements checked again.",
    "officeartikel.editorTitel": "Embedded Office editor",
    "officeartikel.klaraOhneAuswahl":
      "Klara cannot see selections in this editor: the editor does not pass on a selection. Klara keeps helping with text selected in the article.",
    "officeartikel.phase.laedt": "The editor is loading the document …",
    "officeartikel.phase.bereit": "The editor is ready.",
    "officeartikel.phase.speichert": "The editor is saving …",
    "officeartikel.phase.uebernimmt": "The state is being taken over as a new version …",
    "officeartikel.phase.fehler": "The editor is not working as expected.",
    "officeartikel.phase.abgebrochen": "Cancelled.",
    "officeartikel.phase.geschlossen": "The editor is closed.",
    "officeartikel.verlauf": "Document states",
    "officeartikel.stand": "Version {{fassung}} · {{zeit}}",
    "officeartikel.zurueckgeholtAus": "restored from version {{fassung}}",
    "officeartikel.aktuell": "current",
    "officeartikel.zurueckholen": "Restore document from version {{fassung}}",
    "officeartikel.belegstellen": "Evidence from this document",
    "officeartikel.keineBelegstellen": "No evidence of the article relies on this document.",
    "officeartikel.belegAktuell": "relies on the current document state",
    "officeartikel.belegFrueher":
      "relies on an earlier document state (version {{fassung}}) — not checked again after the change",
    "officeartikel.fehler.netz": "No connection to the server. Nothing was changed.",
    "officeartikel.fehler.nichtEingerichtet":
      "The embedded Office editor is not set up on this server.",
    "officeartikel.fehler.nichtErreichbar":
      "The Office editor is not responding right now. Nothing was changed.",
    "officeartikel.fehler.formatNichtAngeboten":
      "The Office editor does not offer this action for this file format.",
    "officeartikel.fehler.konflikt":
      "The article was changed elsewhere in the meantime. Nothing was overwritten. Your state stays in the editor and is kept on closing.",
    "officeartikel.fehler.keineSitzung": "No editing session is running for this document anymore.",
    "officeartikel.fehler.nichtsGespeichert": "The editor has not saved anything yet.",
    "officeartikel.fehler.sitzungLaeuft":
      "The document is currently open in the editor. Please close the editing session first.",
    "officeartikel.fehler.freigegeben":
      "This article is released. Without release rights the document is view-only.",
    "officeartikel.fehler.keinRecht": "You may not open or change this document.",
    "officeartikel.fehler.allgemein": "That did not work. Nothing was changed.",
    "officeartikel.fehler.laden":
      "The editor did not load the document. Please cancel and open it again.",
    "officeartikel.fehler.speichern":
      "The editor did not confirm saving. The editor stays open; nothing is lost.",
  },
  nl: {
    "officeartikel.titel": "Office-documenten in het artikel",
    "officeartikel.oeffnen": "In artikel openen",
    "officeartikel.zuklappen": "Inklappen",
    "officeartikel.fassungStatus": "Artikelversie {{fassung}} · Status: {{status}}",
    "officeartikel.weg.direkt": "Je kunt dit document hier bewerken.",
    "officeartikel.weg.vorschlag":
      "Dit artikel is vrijgegeven. Zonder vrijgaverecht kun je het document alleen bekijken.",
    "officeartikel.weg.nur-lesen": "Je kunt dit document hier alleen bekijken.",
    "officeartikel.weg.kein-zugang": "Je hebt geen toegang tot dit document.",
    "officeartikel.statusRegel":
      "Elke opgeslagen documentwijziging wordt een nieuwe artikelversie met status ‘open’. De uitspraken van het artikel gelden daarna niet automatisch als gecontroleerd; een vrijgave gebeurt nooit vanzelf.",
    "officeartikel.gemeinsam":
      "Dit document is nu geopend in de editor (begonnen op versie {{fassung}}). Wie het nu opent, werkt mee in dezelfde bewerking.",
    "officeartikel.gesichert":
      "Een bewerkingsstand van {{zeit}} is bij het sluiten niet overgenomen, omdat het artikel intussen elders is gewijzigd. De stand is bewaard; er is niets overschreven.",
    "officeartikel.gesichertUebernehmen": "Bewaarde stand als nieuwe versie overnemen",
    "officeartikel.bearbeiten": "In editor bewerken",
    "officeartikel.ansehen": "In editor bekijken",
    "officeartikel.zurueckZumArtikel": "Terug naar het artikel",
    "officeartikel.alsFassung": "Als nieuwe versie overnemen",
    "officeartikel.speichernZurueck": "Opslaan en terug naar het artikel",
    "officeartikel.abbrechen": "Annuleren",
    "officeartikel.abgebrochen": "De weergave is gesloten.",
    "officeartikel.abgebrochenSchreiben":
      "De bewerking is geannuleerd. Wat de editor al automatisch had opgeslagen, wordt bij het sluiten als nieuwe versie overgenomen of — bij een conflict — bewaard.",
    "officeartikel.editorGeschlossen": "De editor is gesloten.",
    "officeartikel.uebernommen":
      "Opgeslagen als artikelversie {{fassung}}. Status: open — laat de uitspraken opnieuw controleren.",
    "officeartikel.editorTitel": "Ingebedde Office-editor",
    "officeartikel.klaraOhneAuswahl":
      "Klara ziet selecties in deze editor niet: de editor geeft geen selectie door. Klara helpt verder met tekst die in het artikel is geselecteerd.",
    "officeartikel.phase.laedt": "De editor laadt het document …",
    "officeartikel.phase.bereit": "De editor is klaar.",
    "officeartikel.phase.speichert": "De editor slaat op …",
    "officeartikel.phase.uebernimmt": "De stand wordt als nieuwe versie overgenomen …",
    "officeartikel.phase.fehler": "De editor werkt niet zoals verwacht.",
    "officeartikel.phase.abgebrochen": "Geannuleerd.",
    "officeartikel.phase.geschlossen": "De editor is gesloten.",
    "officeartikel.verlauf": "Documentstanden",
    "officeartikel.stand": "Versie {{fassung}} · {{zeit}}",
    "officeartikel.zurueckgeholtAus": "teruggehaald uit versie {{fassung}}",
    "officeartikel.aktuell": "actueel",
    "officeartikel.zurueckholen": "Document uit versie {{fassung}} terughalen",
    "officeartikel.belegstellen": "Bewijsplaatsen uit dit document",
    "officeartikel.keineBelegstellen": "Geen bewijsplaats van het artikel steunt op dit document.",
    "officeartikel.belegAktuell": "steunt op de actuele documentstand",
    "officeartikel.belegFrueher":
      "steunt op een eerdere documentstand (versie {{fassung}}) — na de wijziging niet opnieuw gecontroleerd",
    "officeartikel.fehler.netz": "Geen verbinding met de server. Er is niets gewijzigd.",
    "officeartikel.fehler.nichtEingerichtet":
      "De ingebedde Office-editor is op deze server niet ingericht.",
    "officeartikel.fehler.nichtErreichbar":
      "De Office-editor reageert op dit moment niet. Er is niets gewijzigd.",
    "officeartikel.fehler.formatNichtAngeboten":
      "De Office-editor biedt deze actie voor dit bestandsformaat niet aan.",
    "officeartikel.fehler.konflikt":
      "Het artikel is intussen elders gewijzigd. Er is niets overschreven. Je stand blijft in de editor en wordt bij het sluiten bewaard.",
    "officeartikel.fehler.keineSitzung": "Voor dit document loopt geen bewerking meer.",
    "officeartikel.fehler.nichtsGespeichert": "De editor heeft nog niets opgeslagen.",
    "officeartikel.fehler.sitzungLaeuft":
      "Het document is nu geopend in de editor. Sluit eerst de bewerking.",
    "officeartikel.fehler.freigegeben":
      "Dit artikel is vrijgegeven. Zonder vrijgaverecht wordt het document alleen bekeken.",
    "officeartikel.fehler.keinRecht": "Je mag dit document niet openen of wijzigen.",
    "officeartikel.fehler.allgemein": "Dat is niet gelukt. Er is niets gewijzigd.",
    "officeartikel.fehler.laden":
      "De editor heeft het document niet geladen. Annuleer en open het opnieuw.",
    "officeartikel.fehler.speichern":
      "De editor heeft het opslaan niet bevestigd. De editor blijft open; er gaat niets verloren.",
  },
} satisfies Textmodul;

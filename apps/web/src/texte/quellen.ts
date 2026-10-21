// ================================================================================================
// QUELLENÄNDERUNGEN (aufnahme:20260928) · DIE TEXTE DIESES NUTZERWEGS — bei ihrer Funktion.
// ================================================================================================
//
// Letzte Änderungsprüfung, gefundene und übernommene Änderungen, die Änderungskarte eines
// Abschnitts und der Momentaufnahme-Vermerk (`components/gesamtanweisung/LesestandAnsicht.tsx`).
// Die Texte sind NEU, deshalb tragen sie das Präfix `quellen.` (Vertrag in `./intern/pruefung.ts`)
// und keine Ausnahme in `legacySchluessel`. Bis zur I18N-AUFTEILUNG standen sie als `ga.quellen.*`
// in `i18n.ts`; Wortlaut unverändert.
//
// „aktuell" steht ausschliesslich im Ergebnis `aktuell` — kein anderer Satz behauptet es.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "quellen.",
  legacySchluessel: [],
  de: {
    "quellen.titel": "Quellenänderungen",
    "quellen.letzte": "Letzte Änderungsprüfung: {{zeit}}",
    "quellen.ergebnis.aktuell": "Ergebnis: Alle verwendeten Quellenfassungen sind aktuell.",
    "quellen.ergebnis.aenderungen_gefunden": "Ergebnis: Es gibt neuere Quellenfassungen.",
    "quellen.ergebnis.fehlgeschlagen":
      "Ergebnis: Prüfung fehlgeschlagen – {{anzahl}} Quelle(n) konnten nicht gelesen werden. Ob es neuere Fassungen gibt, ist unbekannt.",
    "quellen.ergebnis.unvollstaendig":
      "Ergebnis: Nicht für alle Quellen bestimmbar – einige Abschnitte sind für dich nicht zugänglich.",
    "quellen.ergebnis.keine_quellen": "Ergebnis: Diese Anleitung verwendet noch keine Quellen.",
    "quellen.ergebnis.nichtGesichert":
      "Ergebnis: nicht gesichert – die Prüfung konnte nicht wiederholt werden.",
    "quellen.gefunden": "Gefundene Änderungen: {{anzahl}}",
    "quellen.uebernommen": "Übernommene Änderungen",
    "quellen.uebernahme":
      "Abschnitt {{abschnitt}}: Fassung {{von}} → {{bis}}, übernommen am {{zeit}} (Anleitungsstand {{stand}})",
    "quellen.ueberwachungNichtEingerichtet":
      "Automatische Überwachung: nicht eingerichtet. Nach neueren Fassungen wird beim Öffnen der Anleitung gesehen.",
    "quellen.quelle": "Betroffene Quelle",
    "quellen.verwendet": "Bisherige, verwendete Fassung",
    "quellen.neuere": "Neue Fassung",
    "quellen.betroffen": "Betroffene Abschnitte",
    "quellen.fassung": "Fassung {{version}}",
    "quellen.unterschiedeAnsehen": "Unterschiede ansehen",
    "quellen.beibehalten": "Bisherige Fassung beibehalten",
    "quellen.beibehaltenHinweis":
      "Die Anleitung verwendet weiterhin Fassung {{version}}. Es wurde nichts geändert.",
    "quellen.uebernehmen": "Fassung {{version}} übernehmen",
    "quellen.uebernehmenFolge":
      "Eine Übernahme erzeugt einen neuen Anleitungsstand; frühere Stände bleiben erhalten. Die Anleitung wird dabei wieder zum Entwurf und muss erneut vorgelegt und entschieden werden.",
    "quellen.weiterhin":
      "Während du die Änderung ansiehst, verwendet die Anleitung weiterhin Fassung {{version}}.",
    "quellen.unterschiedeLaden": "Unterschiede werden geladen …",
    "quellen.unterschiedeFehler":
      "Die Unterschiede konnten nicht geladen werden. An der Anleitung ändert sich dadurch nichts.",
    "quellen.bisher": "Bisher (Fassung {{version}})",
    "quellen.neu": "Neu (Fassung {{version}})",
    "quellen.momentaufnahme":
      "Hochgeladene Datei „{{name}}“: Momentaufnahme vom {{zeit}}. Spätere Änderungen an der Originaldatei werden nicht erkannt.",
    "quellen.dateiOhneName": "ohne Namen",
    "quellen.abschnitteTitel": "Quellen dieser Fassung",
    "quellen.abschnitteUnbekannt": "Quellen dieser Fassung: unbekannt",
    "quellen.quellfassung": "Quellfassung {{version}}",
    "quellen.revision": "Revision {{revision}}",
    "quellen.standGeprueft": "Quellstand geprüft",
    "quellen.standUngeprueft": "Quellstand ungeprüft",
    "quellen.fassungOeffnen": "Fassung {{version}} öffnen",
    "quellen.originalOeffnen": "Original in der Quelle öffnen (heutiger Stand)",
    "quellen.gespeichert.titel": "Verwendete Fassung {{version}} · gespeichert am {{zeit}}",
    "quellen.gespeichert.laedt": "Gespeicherte Fassung wird geladen …",
    "quellen.gespeichert.fehler":
      "Die gespeicherte Fassung ist für dich nicht zugänglich oder konnte nicht geladen werden.",
    "quellen.gespeichert.fehlt": "Fassung {{version}} ist nicht gespeichert.",
    "quellen.gespeichert.gewaehlt": "Quellabschnitt dieses Absatzes",
    "quellen.gespeichert.hinweis":
      "Du liest die gespeicherte Fassung {{version}}. Der heutige Stand des Eintrags steht darunter.",
    "quellen.gespeichert.quellinhaltOeffnen": "Damaligen Quellinhalt öffnen",
    "quellen.gespeichert.quellinhaltLaedt": "Damaliger Quellinhalt wird geladen …",
    "quellen.gespeichert.quellinhaltFehler":
      "Der damalige Quellinhalt ist für dich nicht zugänglich oder an diesem Eintrag nicht erhalten.",
    "quellen.gespeichert.quellinhaltTitel":
      "Damaliger Quellinhalt der Revision {{revision}}, übernommen in Fassung {{fassung}}",
    "quellen.gespeichert.quellinhaltNichtErhalten":
      "Damaliger Quellinhalt nicht erhalten: Dieser Anker trägt weder eine Belegstelle noch eine festgeschriebene Revision.",
    "quellen.gespeichert.abgleichBestaetigt":
      "Wörtlich bestätigt: Der Inhaltsabdruck gleicht dem der Quellrevision.",
    "quellen.gespeichert.abgleichAbweichend":
      "Wie übernommen, nicht wörtlich bestätigt: Der Inhaltsabdruck weicht von dem der Quellrevision ab, zum Beispiel nach der Bereinigung des HTML.",
    "quellen.gespeichert.abgleichUnbekannt":
      "Die Quellrevision ist nicht mehr auffindbar; ein Abgleich mit ihrem Inhaltsabdruck ist nicht möglich.",
  },
  en: {
    "quellen.titel": "Source changes",
    "quellen.letzte": "Last change check: {{zeit}}",
    "quellen.ergebnis.aktuell": "Result: All source versions in use are current.",
    "quellen.ergebnis.aenderungen_gefunden": "Result: Newer source versions exist.",
    "quellen.ergebnis.fehlgeschlagen":
      "Result: Check failed – {{anzahl}} source(s) could not be read. Whether newer versions exist is unknown.",
    "quellen.ergebnis.unvollstaendig":
      "Result: Not determinable for all sources – some sections are not accessible to you.",
    "quellen.ergebnis.keine_quellen": "Result: This instruction does not use any sources yet.",
    "quellen.ergebnis.nichtGesichert": "Result: not confirmed – the check could not be repeated.",
    "quellen.gefunden": "Changes found: {{anzahl}}",
    "quellen.uebernommen": "Adopted changes",
    "quellen.uebernahme":
      "Section {{abschnitt}}: version {{von}} → {{bis}}, adopted on {{zeit}} (instruction state {{stand}})",
    "quellen.ueberwachungNichtEingerichtet":
      "Automatic monitoring: not set up. Newer versions are looked up when the instruction is opened.",
    "quellen.quelle": "Affected source",
    "quellen.verwendet": "Previous version in use",
    "quellen.neuere": "New version",
    "quellen.betroffen": "Affected sections",
    "quellen.fassung": "Version {{version}}",
    "quellen.unterschiedeAnsehen": "View differences",
    "quellen.beibehalten": "Keep previous version",
    "quellen.beibehaltenHinweis":
      "The instruction keeps using version {{version}}. Nothing was changed.",
    "quellen.uebernehmen": "Adopt version {{version}}",
    "quellen.uebernehmenFolge":
      "Adopting creates a new instruction state; earlier states are kept. The instruction becomes a draft again and must be submitted and decided again.",
    "quellen.weiterhin":
      "While you review the change, the instruction keeps using version {{version}}.",
    "quellen.unterschiedeLaden": "Loading differences …",
    "quellen.unterschiedeFehler":
      "The differences could not be loaded. Nothing changes in the instruction.",
    "quellen.bisher": "Previous (version {{version}})",
    "quellen.neu": "New (version {{version}})",
    "quellen.momentaufnahme":
      "Uploaded file “{{name}}”: snapshot from {{zeit}}. Later changes to the original file are not detected.",
    "quellen.dateiOhneName": "unnamed",
    "quellen.abschnitteTitel": "Sources of this version",
    "quellen.abschnitteUnbekannt": "Sources of this version: unknown",
    "quellen.quellfassung": "Source version {{version}}",
    "quellen.revision": "Revision {{revision}}",
    "quellen.standGeprueft": "Source state verified",
    "quellen.standUngeprueft": "Source state unverified",
    "quellen.fassungOeffnen": "Open version {{version}}",
    "quellen.originalOeffnen": "Open original in the source (its state today)",
    "quellen.gespeichert.titel": "Version {{version}} in use · saved on {{zeit}}",
    "quellen.gespeichert.laedt": "Loading saved version …",
    "quellen.gespeichert.fehler":
      "The saved version is not accessible to you or could not be loaded.",
    "quellen.gespeichert.fehlt": "Version {{version}} is not saved.",
    "quellen.gespeichert.gewaehlt": "Source section of this paragraph",
    "quellen.gespeichert.hinweis":
      "You are reading saved version {{version}}. The entry as it is today follows below.",
    "quellen.gespeichert.quellinhaltOeffnen": "Open source content as it was then",
    "quellen.gespeichert.quellinhaltLaedt": "Loading source content as it was then …",
    "quellen.gespeichert.quellinhaltFehler":
      "The source content as it was then is not accessible to you or not kept for this entry.",
    "quellen.gespeichert.quellinhaltTitel":
      "Source content of revision {{revision}} as it was then, taken over in version {{fassung}}",
    "quellen.gespeichert.quellinhaltNichtErhalten":
      "Source content as it was then not kept: this anchor carries neither a quoted passage nor a recorded revision.",
    "quellen.gespeichert.abgleichBestaetigt":
      "Verified word for word: the content fingerprint matches that of the source revision.",
    "quellen.gespeichert.abgleichAbweichend":
      "As taken over, not verified word for word: the content fingerprint differs from that of the source revision, for example after HTML cleanup.",
    "quellen.gespeichert.abgleichUnbekannt":
      "The source revision can no longer be found; a comparison with its content fingerprint is not possible.",
  },
  nl: {
    "quellen.titel": "Bronwijzigingen",
    "quellen.letzte": "Laatste wijzigingscontrole: {{zeit}}",
    "quellen.ergebnis.aktuell": "Resultaat: Alle gebruikte bronversies zijn actueel.",
    "quellen.ergebnis.aenderungen_gefunden": "Resultaat: Er zijn nieuwere bronversies.",
    "quellen.ergebnis.fehlgeschlagen":
      "Resultaat: Controle mislukt – {{anzahl}} bron(nen) konden niet worden gelezen. Of er nieuwere versies zijn, is onbekend.",
    "quellen.ergebnis.unvollstaendig":
      "Resultaat: Niet voor alle bronnen te bepalen – sommige onderdelen zijn voor jou niet toegankelijk.",
    "quellen.ergebnis.keine_quellen": "Resultaat: Deze instructie gebruikt nog geen bronnen.",
    "quellen.ergebnis.nichtGesichert":
      "Resultaat: niet bevestigd – de controle kon niet worden herhaald.",
    "quellen.gefunden": "Gevonden wijzigingen: {{anzahl}}",
    "quellen.uebernommen": "Overgenomen wijzigingen",
    "quellen.uebernahme":
      "Onderdeel {{abschnitt}}: versie {{von}} → {{bis}}, overgenomen op {{zeit}} (instructiestand {{stand}})",
    "quellen.ueberwachungNichtEingerichtet":
      "Automatische bewaking: niet ingericht. Bij het openen van de instructie wordt naar nieuwere versies gekeken.",
    "quellen.quelle": "Betrokken bron",
    "quellen.verwendet": "Huidige, gebruikte versie",
    "quellen.neuere": "Nieuwe versie",
    "quellen.betroffen": "Betrokken onderdelen",
    "quellen.fassung": "Versie {{version}}",
    "quellen.unterschiedeAnsehen": "Verschillen bekijken",
    "quellen.beibehalten": "Huidige versie behouden",
    "quellen.beibehaltenHinweis":
      "De instructie blijft versie {{version}} gebruiken. Er is niets gewijzigd.",
    "quellen.uebernehmen": "Versie {{version}} overnemen",
    "quellen.uebernehmenFolge":
      "Overnemen maakt een nieuwe instructiestand; eerdere standen blijven bewaard. De instructie wordt weer een concept en moet opnieuw worden voorgelegd en besloten.",
    "quellen.weiterhin":
      "Terwijl je de wijziging bekijkt, blijft de instructie versie {{version}} gebruiken.",
    "quellen.unterschiedeLaden": "Verschillen worden geladen …",
    "quellen.unterschiedeFehler":
      "De verschillen konden niet worden geladen. Aan de instructie verandert daardoor niets.",
    "quellen.bisher": "Huidig (versie {{version}})",
    "quellen.neu": "Nieuw (versie {{version}})",
    "quellen.momentaufnahme":
      "Geüploade bestand „{{name}}”: momentopname van {{zeit}}. Latere wijzigingen aan het originele bestand worden niet herkend.",
    "quellen.dateiOhneName": "zonder naam",
    "quellen.abschnitteTitel": "Bronnen van deze versie",
    "quellen.abschnitteUnbekannt": "Bronnen van deze versie: onbekend",
    "quellen.quellfassung": "Bronversie {{version}}",
    "quellen.revision": "Revisie {{revision}}",
    "quellen.standGeprueft": "Bronstand gecontroleerd",
    "quellen.standUngeprueft": "Bronstand niet gecontroleerd",
    "quellen.fassungOeffnen": "Versie {{version}} openen",
    "quellen.originalOeffnen": "Origineel in de bron openen (stand van vandaag)",
    "quellen.gespeichert.titel": "Gebruikte versie {{version}} · opgeslagen op {{zeit}}",
    "quellen.gespeichert.laedt": "Opgeslagen versie wordt geladen …",
    "quellen.gespeichert.fehler":
      "De opgeslagen versie is voor jou niet toegankelijk of kon niet worden geladen.",
    "quellen.gespeichert.fehlt": "Versie {{version}} is niet opgeslagen.",
    "quellen.gespeichert.gewaehlt": "Brononderdeel van deze alinea",
    "quellen.gespeichert.hinweis":
      "Je leest de opgeslagen versie {{version}}. De stand van vandaag staat eronder.",
    "quellen.gespeichert.quellinhaltOeffnen": "Broninhoud van toen openen",
    "quellen.gespeichert.quellinhaltLaedt": "Broninhoud van toen wordt geladen …",
    "quellen.gespeichert.quellinhaltFehler":
      "De broninhoud van toen is voor jou niet toegankelijk of bij dit item niet bewaard.",
    "quellen.gespeichert.quellinhaltTitel":
      "Broninhoud van revisie {{revision}} van toen, overgenomen in versie {{fassung}}",
    "quellen.gespeichert.quellinhaltNichtErhalten":
      "Broninhoud van toen niet bewaard: dit anker heeft geen citaat en geen vastgelegde revisie.",
    "quellen.gespeichert.abgleichBestaetigt":
      "Letterlijk bevestigd: de inhoudsvingerafdruk komt overeen met die van de bronrevisie.",
    "quellen.gespeichert.abgleichAbweichend":
      "Zoals overgenomen, niet letterlijk bevestigd: de inhoudsvingerafdruk wijkt af van die van de bronrevisie, bijvoorbeeld na het opschonen van de HTML.",
    "quellen.gespeichert.abgleichUnbekannt":
      "De bronrevisie is niet meer te vinden; vergelijken met haar inhoudsvingerafdruk is niet mogelijk.",
  },
} satisfies Textmodul;

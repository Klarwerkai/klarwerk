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
  },
} satisfies Textmodul;

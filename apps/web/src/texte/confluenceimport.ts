// ================================================================================================
// CONFLUENCE-GESAMTIMPORT (aufnahme:20260922:gesamt-confluence-import) · DIE TEXTE DIESES WEGS.
// ================================================================================================
//
// Herkunftsangaben importierter Quellen (`ko.source.*`, R-0131/R-0162/R-0163/R-0549), der
// Quellabgleich am Importlauf (`w2.run.*`, R-0162/R-0163), das Importergebnis auf der Wissensseite
// (`ko.importResult.*`, R-0142) und der Riegel der unbekannten Anmeldeart
// (`imp.access.blocker.invalidAuthMode`, R-0166).
//
// Bis zur Zusammenführung mit der I18N-AUFTEILUNG standen diese Texte in `i18n.ts`; sie sind hier
// Zeichen für Zeichen unverändert übernommen. Ihre Namen bleiben, weil Oberfläche und Tests sie
// unter genau diesen Namen lesen (`components/bibliothek/ImportErgebnis.tsx`,
// `components/bibliothek/MehrAbschnitte.tsx`, `pages/Stufe2.tsx`, `pages/Validation.tsx`,
// `lib/importAccessState.ts`, `tests/confluence-quellabgleich/*`) — deshalb stehen sie in
// `legacySchluessel` (Vertrag in `./intern/pruefung.ts`). Neue Texte dieses Wegs tragen das Präfix
// `confluenceimport.`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "confluenceimport.",
  legacySchluessel: [
    "imp.access.blocker.invalidAuthMode",
    "w2.run.sourceSync",
    "w2.run.attachmentsSynced",
    "w2.run.sourceSyncSkipped",
    "w2.run.sourceSyncNotSupported",
    "w2.run.restrictionsSynced",
    "w2.run.syncFailed",
    "w2.run.syncListsTruncated",
    "w2.run.attachmentsIncomplete",
    "ko.importResult.lead",
    "ko.importResult.revision",
    "ko.importResult.noRevision",
    "ko.importResult.contentNotCaptured",
    "ko.importResult.run",
    "ko.importResult.noRun",
    "ko.importResult.noItem",
    "ko.importResult.outcome.CREATED",
    "ko.importResult.outcome.BOUND",
    "ko.importResult.outcome.SKIPPED",
    "ko.importResult.outcome.FAILED",
    "ko.importResult.outcome.unknown",
    "ko.importResult.gapsNotAvailable",
    "ko.importResult.gapsNone",
    "ko.importResult.gapsNoneChecked",
    "ko.importResult.gapsUnavailableKi",
    "ko.importResult.gapsRule",
    "ko.importResult.gapsScope",
    "ko.importResult.gapRedacted",
    "ko.importResult.gaps",
    "ko.source.removedInOrigin",
    "ko.source.attachment",
    "ko.source.readGroups",
    "ko.source.readPersons",
  ],
  de: {
    "imp.access.blocker.invalidAuthMode":
      "Die gewählte Anmeldeart ist unbekannt. Möglich sind die Cloud-Anmeldung (E-Mail und API-Token) oder ein persönliches Zugriffstoken für selbst betriebenes Confluence (Server/Data Center) — bis das stimmt, kommt kein Zugang zustande.",
    // R-0162 (Runde 3): der Löschabgleich am Lauf.
    "w2.run.sourceSync":
      "Abgleich mit der Quelle: {{geloescht}} gelöscht vermerkt, {{wieder}} wieder vorhanden, {{ausserhalb}} nicht mehr im Bereich, {{unbekannt}} mit unbekanntem Zustand.",
    "w2.run.attachmentsSynced":
      "Anhänge an {{anzahl}} unveränderten Seite(n) an die Quelle angeglichen.",
    "w2.run.sourceSyncSkipped":
      "Kein Löschabgleich: die Quelle wurde nicht vollständig gelesen, über Löschungen sagt dieser Lauf nichts.",
    "w2.run.sourceSyncNotSupported":
      "Kein Löschabgleich: diese Quelle kann Löschungen nicht einzeln nachfragen, über Löschungen sagt dieser Lauf nichts.",
    "w2.run.restrictionsSynced":
      "Leserestriktion an {{anzahl}} unveränderten Seite(n) an die Quelle angeglichen; wo die Quelle jetzt strenger ist, wurde die Vertraulichkeit heraufgesetzt.",
    "w2.run.syncFailed":
      "Nachzug von Anhängen oder Leserestriktion an {{anzahl}} Seite(n) gescheitert — dort gilt der alte Stand.",
    "w2.run.syncListsTruncated":
      "Die Zahlen oben sind vollständig; die Liste der betroffenen Seiten ist gekürzt gespeichert.",
    "w2.run.attachmentsIncomplete":
      "An {{anzahl}} Seite(n) konnte die Anhangsliste nicht vollständig gelesen werden — dort wurde kein Anhang entfernt, es können aber Anhänge fehlen.",
    // R-0142 (Lauf 5): das Importergebnis auf der Wissensseite.
    "ko.importResult.lead": "Aus welchem Importlauf und welcher Quellfassung dieses Wissen stammt.",
    "ko.importResult.revision": "Quellfassung {{version}}, aufgenommen {{zeit}}",
    "ko.importResult.noRevision":
      "Für diesen Import ist keine Quellfassung festgehalten (übernommen, bevor Importläufe ihr Ergebnis aufzeichneten).",
    "ko.importResult.contentNotCaptured":
      "Ein eigener Abzug des Originals ist nicht gespeichert; der übernommene Volltext steht an diesem Wissen.",
    "ko.importResult.run": "Importlauf: {{status}}",
    "ko.importResult.noRun": "Der aufnehmende Importlauf ist nicht lesbar.",
    "ko.importResult.noItem": "Zu diesem Wissen steht im Importlauf noch kein Ausgang fest.",
    "ko.importResult.outcome.CREATED": "Beim Annehmen ist dieses Wissen neu entstanden.",
    "ko.importResult.outcome.BOUND":
      "Beim Annehmen wurde dieses bestehende Wissen mit der Quellfassung fortgeschrieben.",
    "ko.importResult.outcome.SKIPPED": "Diese Quellfassung wurde nicht übernommen.",
    "ko.importResult.outcome.FAILED": "Die Übernahme dieser Quellfassung ist gescheitert.",
    "ko.importResult.outcome.unknown": "Ausgang unbekannt ({{wert}}).",
    "ko.importResult.gapsNotAvailable":
      "Wissenslücken: Ein Bezug zwischen Lücken und einzelnem Wissen wird nicht geführt — deshalb wird hier keine Lücke behauptet.",
    "ko.importResult.gapsNone": "Keine offene Wissenslücke betrifft dieses Wissen.",
    "ko.importResult.gapsNoneChecked":
      "Unter den {{geprueft}} geprüften offenen Lücken betrifft keine dieses Wissen. Über die übrigen ist nichts gesagt.",
    "ko.importResult.gapsUnavailableKi":
      "Wissenslücken: Der Bezug wird über die Antwortsuche ermittelt, und die KI ist derzeit abgeschaltet — deshalb wird hier keine Lücke behauptet und keine ausgeschlossen.",
    "ko.importResult.gapsRule":
      "Gezählt werden offene Lücken, für deren Frage die Antwortsuche dieses Wissen heranzieht.",
    "ko.importResult.gapsScope":
      "Geprüft wurden die {{geprueft}} jüngsten von {{offen}} offenen Lücken.",
    "ko.importResult.gapRedacted": "Lücke (Fragetext nicht freigegeben)",
    "ko.importResult.gaps": "Wissenslücken zu diesem Wissen: {{anzahl}}",
    // R-0162 / R-0163 / R-0549: Herkunftsangaben importierter Quellen.
    "ko.source.removedInOrigin":
      "In der Quelle gelöscht (festgestellt {{zeit}}). Der Link führt nicht mehr zur Seite; das Wissen hier bleibt unverändert.",
    "ko.source.attachment": "Anhang der Quellseite",
    "ko.source.readGroups": "In der Quelle nur lesbar für: {{gruppen}}",
    "ko.source.readPersons": "In der Quelle nur lesbar für {{anzahl}} einzeln benannte Person(en)",
  },
  en: {
    "imp.access.blocker.invalidAuthMode":
      "The selected sign-in method is unknown. Possible are the cloud sign-in (email and API token) or a personal access token for self-hosted Confluence — until this is correct, no access is established.",
    "w2.run.sourceSync":
      "Sync with the source: {{geloescht}} marked as deleted, {{wieder}} available again, {{ausserhalb}} no longer in the space, {{unbekannt}} with unknown state.",
    "w2.run.attachmentsSynced":
      "Attachments aligned with the source on {{anzahl}} unchanged page(s).",
    "w2.run.sourceSyncSkipped":
      "No deletion sync: the source was not read completely, so this run says nothing about deletions.",
    "w2.run.sourceSyncNotSupported":
      "No deletion sync: this source cannot look up deletions page by page, so this run says nothing about deletions.",
    "w2.run.restrictionsSynced":
      "Read restriction aligned with the source on {{anzahl}} unchanged page(s); where the source is now stricter, the confidentiality was raised.",
    "w2.run.syncFailed":
      "Updating attachments or read restriction failed on {{anzahl}} page(s) — the previous state still applies there.",
    "w2.run.syncListsTruncated":
      "The numbers above are complete; the stored list of affected pages is shortened.",
    "w2.run.attachmentsIncomplete":
      "On {{anzahl}} page(s) the attachment list could not be read completely — no attachment was removed there, but attachments may be missing.",
    "ko.importResult.lead": "Which import run and which source version this knowledge comes from.",
    "ko.importResult.revision": "Source version {{version}}, captured {{zeit}}",
    "ko.importResult.noRevision":
      "No source version is recorded for this import (taken over before import runs recorded their result).",
    "ko.importResult.contentNotCaptured":
      "No separate copy of the original is stored; the imported full text is held on this knowledge.",
    "ko.importResult.run": "Import run: {{status}}",
    "ko.importResult.noRun": "The import run that captured it cannot be read.",
    "ko.importResult.noItem": "The import run does not yet record an outcome for this knowledge.",
    "ko.importResult.outcome.CREATED": "This knowledge was newly created on acceptance.",
    "ko.importResult.outcome.BOUND":
      "On acceptance, this existing knowledge was updated with the source version.",
    "ko.importResult.outcome.SKIPPED": "This source version was not taken over.",
    "ko.importResult.outcome.FAILED": "Taking over this source version failed.",
    "ko.importResult.outcome.unknown": "Outcome unknown ({{wert}}).",
    "ko.importResult.gapsNotAvailable":
      "Knowledge gaps: no link between gaps and individual knowledge is kept — so no gap is claimed here.",
    "ko.importResult.gapsNone": "No open knowledge gap concerns this knowledge.",
    "ko.importResult.gapsNoneChecked":
      "Among the {{geprueft}} open gaps checked, none concerns this knowledge. Nothing is said about the rest.",
    "ko.importResult.gapsUnavailableKi":
      "Knowledge gaps: the link is determined via the answer search, and AI is currently switched off — so no gap is claimed or ruled out here.",
    "ko.importResult.gapsRule":
      "Counted are open gaps whose question leads the answer search to this knowledge.",
    "ko.importResult.gapsScope":
      "Checked were the {{geprueft}} most recent of {{offen}} open gaps.",
    "ko.importResult.gapRedacted": "Gap (question text not released)",
    "ko.importResult.gaps": "Knowledge gaps for this knowledge: {{anzahl}}",
    "ko.source.removedInOrigin":
      "Deleted in the source (detected {{zeit}}). The link no longer leads to the page; the knowledge here stays unchanged.",
    "ko.source.attachment": "Attachment of the source page",
    "ko.source.readGroups": "In the source, readable only by: {{gruppen}}",
    "ko.source.readPersons":
      "In the source, readable only by {{anzahl}} individually named person(s)",
  },
  nl: {
    "imp.access.blocker.invalidAuthMode":
      "De gekozen aanmeldmethode is onbekend. Mogelijk zijn de cloud-aanmelding (e-mail en API-token) of een persoonlijk toegangstoken voor zelf beheerde Confluence — zolang dat niet klopt, komt er geen toegang tot stand.",
    "w2.run.sourceSync":
      "Afstemming met de bron: {{geloescht}} als verwijderd gemarkeerd, {{wieder}} weer beschikbaar, {{ausserhalb}} niet meer in de ruimte, {{unbekannt}} met onbekende status.",
    "w2.run.attachmentsSynced":
      "Bijlagen op {{anzahl}} ongewijzigde pagina('s) gelijkgetrokken met de bron.",
    "w2.run.sourceSyncSkipped":
      "Geen verwijderafstemming: de bron is niet volledig gelezen, dus deze run zegt niets over verwijderingen.",
    "w2.run.sourceSyncNotSupported":
      "Geen verwijderafstemming: deze bron kan verwijderingen niet per pagina nagaan, dus deze run zegt niets over verwijderingen.",
    "w2.run.restrictionsSynced":
      "Leesbeperking op {{anzahl}} ongewijzigde pagina('s) gelijkgetrokken met de bron; waar de bron nu strenger is, is de vertrouwelijkheid verhoogd.",
    "w2.run.syncFailed":
      "Bijwerken van bijlagen of leesbeperking mislukt op {{anzahl}} pagina('s) — daar geldt de vorige stand.",
    "w2.run.syncListsTruncated":
      "De aantallen hierboven zijn volledig; de opgeslagen lijst van betrokken pagina's is ingekort.",
    "w2.run.attachmentsIncomplete":
      "Op {{anzahl}} pagina('s) kon de bijlagenlijst niet volledig worden gelezen — daar is geen bijlage verwijderd, maar er kunnen bijlagen ontbreken.",
    "ko.importResult.lead": "Uit welke importrun en welke bronversie deze kennis afkomstig is.",
    "ko.importResult.revision": "Bronversie {{version}}, opgenomen {{zeit}}",
    "ko.importResult.noRevision":
      "Voor deze import is geen bronversie vastgelegd (overgenomen voordat importruns hun resultaat vastlegden).",
    "ko.importResult.contentNotCaptured":
      "Er is geen aparte kopie van het origineel opgeslagen; de overgenomen volledige tekst staat bij deze kennis.",
    "ko.importResult.run": "Importrun: {{status}}",
    "ko.importResult.noRun": "De importrun die het opnam, is niet leesbaar.",
    "ko.importResult.noItem": "De importrun legt voor deze kennis nog geen uitkomst vast.",
    "ko.importResult.outcome.CREATED": "Bij het aannemen is deze kennis nieuw ontstaan.",
    "ko.importResult.outcome.BOUND":
      "Bij het aannemen is deze bestaande kennis bijgewerkt met de bronversie.",
    "ko.importResult.outcome.SKIPPED": "Deze bronversie is niet overgenomen.",
    "ko.importResult.outcome.FAILED": "Het overnemen van deze bronversie is mislukt.",
    "ko.importResult.outcome.unknown": "Uitkomst onbekend ({{wert}}).",
    "ko.importResult.gapsNotAvailable":
      "Kennislacunes: er wordt geen verband tussen lacunes en afzonderlijke kennis bijgehouden — daarom wordt hier geen lacune beweerd.",
    "ko.importResult.gapsNone": "Geen open kennislacune heeft betrekking op deze kennis.",
    "ko.importResult.gapsNoneChecked":
      "Van de {{geprueft}} gecontroleerde open lacunes heeft er geen betrekking op deze kennis. Over de overige wordt niets gezegd.",
    "ko.importResult.gapsUnavailableKi":
      "Kennislacunes: het verband wordt via de antwoordzoektocht bepaald, en AI is momenteel uitgeschakeld — daarom wordt hier geen lacune beweerd of uitgesloten.",
    "ko.importResult.gapsRule":
      "Geteld worden open lacunes waarvoor de antwoordzoektocht deze kennis betrekt.",
    "ko.importResult.gapsScope":
      "Gecontroleerd zijn de {{geprueft}} meest recente van {{offen}} open lacunes.",
    "ko.importResult.gapRedacted": "Lacune (vraagtekst niet vrijgegeven)",
    "ko.importResult.gaps": "Kennislacunes bij deze kennis: {{anzahl}}",
    "ko.source.removedInOrigin":
      "Verwijderd in de bron (vastgesteld {{zeit}}). De link leidt niet meer naar de pagina; de kennis hier blijft ongewijzigd.",
    "ko.source.attachment": "Bijlage van de bronpagina",
    "ko.source.readGroups": "In de bron alleen leesbaar voor: {{gruppen}}",
    "ko.source.readPersons":
      "In de bron alleen leesbaar voor {{anzahl}} afzonderlijk genoemde perso(o)n(en)",
  },
} satisfies Textmodul;

// ================================================================================================
// AUFNAHME 20260922 · GESAMT-AUDITPROTOKOLL — die Texte der Prüfspur (Aktionsnamen, Kettenexport).
// ================================================================================================
//
// Diese Schlüssel standen bis zur I18N-AUFTEILUNG im Grundbestand von `i18n.ts` (Lauf 3 der
// Aufnahme). Bei der Zusammenführung mit main liegt der Grundbestand in `woerterbuch/`, und neue
// Texte gehören in ein Textmodul. Die Namen bleiben UNVERÄNDERT: `audit.action.*` wird aus dem
// Aktionsnamen des Belegs abgeleitet (`ko.revalidated` → `audit.action.ko_revalidated`), die
// `adm.sich.*`-Schlüssel nennt die Verwalterseite. Deshalb stehen alle in `legacySchluessel`.
// Wortlaute Zeichen für Zeichen aus dem Stand vor der Zusammenführung übernommen.
//
// Verwalteransicht (Teil 3 der Aufnahme): die Spalten- und Detailansichtstexte des Prüfprotokolls
// sind neu und tragen deshalb das Präfix `auditprotokoll.`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "auditprotokoll.",
  legacySchluessel: [
    "audit.action.ko_revalidated",
    "audit.action.library_export",
    "audit.action.audit_exported",
    "audit.action.conflict_created",
    "audit.action.conflict_auto_created",
    "audit.action.conflict_escalated",
    "audit.action.conflict_resolved",
    "audit.action.conflict_dismissed",
    "audit.action.conflict_second_opinion",
    "audit.action.conflict_participant_removed",
    "audit.action.conflict_auto_resolved",
    "audit.action.conflict_superseded",
    // Aufnahme gesamt-konfliktklassifikation (R-0252): die Einordnung als Regel/Sache/Version.
    "audit.action.conflict_classified",
    "audit.action.overlap_auto_created",
    "audit.action.overlap_in_progress",
    "audit.action.overlap_dismissed",
    "audit.action.overlap_kept_separate",
    "audit.action.overlap_linked_related",
    "audit.action.overlap_superseded",
    "audit.action.overlap_participant_removed",
    "audit.action.overlap_withdrawn_own",
    "audit.action.ko_change_rolled_back",
    "audit.action.user_created",
    "audit.action.ko_source_removed_in_origin",
    "audit.action.ko_source_restored_in_origin",
    "audit.action.ko_source_attachments_synced",
    "audit.action.ko_source_restriction_synced",
    "audit.action.output_lms_export",
    "adm.sich.export.button",
    "adm.sich.export.done",
    "adm.sich.qualityNote",
  ],
  de: {
    // §12.3: Re-Validierung, Bibliotheks- und Kettenexport.
    "audit.action.ko_revalidated": "Neu validiert (stimmt noch)",
    "audit.action.library_export": "Bibliothek exportiert",
    "audit.action.audit_exported": "Prüfprotokoll exportiert",
    // R-0766 (Runde 2): Konfliktbelege erscheinen in der Herkunftskette am Objekt.
    "audit.action.conflict_created": "Konflikt gemeldet",
    "audit.action.conflict_auto_created": "Konflikt automatisch erkannt",
    "audit.action.conflict_escalated": "Konflikt eskaliert",
    "audit.action.conflict_resolved": "Konflikt entschieden",
    "audit.action.conflict_dismissed": "Konflikt als Fehlalarm geschlossen",
    "audit.action.conflict_second_opinion": "Zweitmeinung zum Konflikt",
    "audit.action.conflict_participant_removed": "Konfliktbeteiligtes Objekt entfernt",
    "audit.action.conflict_auto_resolved": "Konflikt automatisch geschlossen",
    "audit.action.conflict_superseded": "Konflikt durch neue Fassung überholt",
    "audit.action.conflict_classified": "Konflikt eingeordnet (Art der Arbeit)",
    // R-0766 (Runde 3): Überschneidungsbelege und die Rücknahme einer Änderung.
    "audit.action.overlap_auto_created": "Überschneidung erkannt",
    "audit.action.overlap_in_progress": "Überschneidung in Bearbeitung",
    "audit.action.overlap_dismissed": "Überschneidung als Fehlalarm geschlossen",
    "audit.action.overlap_kept_separate": "Überschneidung: bewusst getrennt gelassen",
    "audit.action.overlap_linked_related": "Überschneidung: als verwandt verknüpft",
    "audit.action.overlap_superseded": "Überschneidung durch neue Fassung überholt",
    "audit.action.overlap_participant_removed": "Beteiligtes Objekt der Überschneidung entfernt",
    "audit.action.overlap_withdrawn_own": "Überschneidung durch Rücknahme geschlossen",
    "audit.action.ko_change_rolled_back": "Änderung zurückgenommen",
    // Aktionsabdeckung (Nacharbeit 2): die Kontoanlage hat einen eigenen Beleg.
    "audit.action.user_created": "Konto angelegt",
    // Verwalteransicht (Bens Befund Nacharbeit 5): die Herkunftsbelege aus dem Quellabgleich
    // (`KoService`, Confluence-Import) tragen das Objekt als Ziel und erscheinen in Prüfprotokoll
    // und Objektspur — ohne Namen stand dort die Humanisierung „ko source removed in origin“.
    "audit.action.ko_source_removed_in_origin": "Quelle im Ursprungssystem gelöscht",
    "audit.action.ko_source_restored_in_origin": "Quelle im Ursprungssystem wiederhergestellt",
    "audit.action.ko_source_attachments_synced": "Anhänge der Quelle abgeglichen",
    "audit.action.ko_source_restriction_synced": "Leseeinschränkung der Quelle abgeglichen",
    // Bens Befund Nacharbeit 7: der SCORM-Export (`lms-export-routes.ts`) — Prüfprotokoll und, über
    // `objekte[].koId`, die Spur jedes exportierten Objekts.
    "audit.action.output_lms_export": "Für Lernplattform exportiert (SCORM)",
    "adm.sich.export.button": "Kette exportieren",
    "adm.sich.export.done":
      "Export mit {{count}} Einträgen gespeichert. Kopf der Kette: Nr. {{seq}} · {{hash}}. Wer diesen Kopf außerhalb der Anlage ablegt, erkennt dort später, ob die Kette bis zu diesem Punkt neu gebildet wurde.",
    "adm.sich.qualityNote":
      "Das Protokoll hält fest, wer was wann erfasst, geändert, geprüft und freigegeben hat. Solche Nachweise erwarten Managementsysteme wie ISO 9001 (Qualität) oder ISO/IEC 27001 (Informationssicherheit) von dokumentierten Abläufen. Eine Zertifizierung ersetzt das Protokoll nicht, und KLARWERK sagt keine zu. Es dient der Nachvollziehbarkeit des Wissens, nicht der Leistungsbewertung von Personen.",
    // Verwalteransicht (N-0027): Spaltenköpfe der Protokolltabelle und die Detailansicht, in der
    // die technischen Kennungen stehen — ergänzend, nicht statt der Namen.
    "auditprotokoll.spalte.zeit": "Zeitpunkt",
    "auditprotokoll.spalte.technik": "Technische Angaben",
    "auditprotokoll.tabelle.titel": "Die {{shown}} jüngsten Aktionen von insgesamt {{count}}",
    "auditprotokoll.technik.anzeigen": "Kennungen anzeigen",
    "auditprotokoll.technik.nr": "Eintrag Nr.",
    "auditprotokoll.technik.akteur": "Kennung ausführendes Konto",
    "auditprotokoll.technik.konto": "Kennung betroffenes Konto",
    "auditprotokoll.technik.objekt": "Kennung betroffenes Objekt",
    "auditprotokoll.technik.hash": "Prüfwert (Hash)",
    "auditprotokoll.technik.hilfe":
      "Die Spalten nennen Ereignis, ausführende und betroffene Person und beim Rollenwechsel die Rolle vorher und nachher. Die technischen Kennungen jedes Eintrags (Eintragsnummer, Kennungen der Konten oder des Objekts, Prüfwert) stehen ergänzend unter „Kennungen anzeigen“. Ein gelöschtes Konto bleibt mit dem Namen benannt, den das Protokoll beim Löschen oder bei einem früheren Rollenwechsel gespeichert hat.",
  },
  en: {
    "audit.action.ko_revalidated": "Revalidated (still valid)",
    "audit.action.library_export": "Library exported",
    "audit.action.audit_exported": "Audit log exported",
    "audit.action.conflict_created": "Conflict reported",
    "audit.action.conflict_auto_created": "Conflict detected automatically",
    "audit.action.conflict_escalated": "Conflict escalated",
    "audit.action.conflict_resolved": "Conflict decided",
    "audit.action.conflict_dismissed": "Conflict closed as false alarm",
    "audit.action.conflict_second_opinion": "Second opinion on conflict",
    "audit.action.conflict_participant_removed": "Object involved in conflict removed",
    "audit.action.conflict_auto_resolved": "Conflict closed automatically",
    "audit.action.conflict_superseded": "Conflict superseded by a new version",
    "audit.action.conflict_classified": "Conflict classified (kind of work)",
    "audit.action.overlap_auto_created": "Overlap detected",
    "audit.action.overlap_in_progress": "Overlap in progress",
    "audit.action.overlap_dismissed": "Overlap closed as false alarm",
    "audit.action.overlap_kept_separate": "Overlap: deliberately kept separate",
    "audit.action.overlap_linked_related": "Overlap: linked as related",
    "audit.action.overlap_superseded": "Overlap superseded by a new version",
    "audit.action.overlap_participant_removed": "Object involved in overlap removed",
    "audit.action.overlap_withdrawn_own": "Overlap closed by withdrawal",
    "audit.action.ko_change_rolled_back": "Change rolled back",
    "audit.action.user_created": "Account created",
    "audit.action.ko_source_removed_in_origin": "Source deleted in the origin system",
    "audit.action.ko_source_restored_in_origin": "Source restored in the origin system",
    "audit.action.ko_source_attachments_synced": "Source attachments synchronised",
    "audit.action.ko_source_restriction_synced": "Source read restriction synchronised",
    "audit.action.output_lms_export": "Exported for learning platform (SCORM)",
    "adm.sich.export.button": "Export chain",
    "adm.sich.export.done":
      "Export with {{count}} entries saved. Head of the chain: no. {{seq}} · {{hash}}. Whoever stores this head outside the installation can later tell there whether the chain up to this point was rebuilt.",
    "adm.sich.qualityNote":
      "The log records who captured, changed, reviewed and approved what, and when. Management systems such as ISO 9001 (quality) or ISO/IEC 27001 (information security) expect this kind of evidence from documented processes. The log does not replace a certification, and KLARWERK does not promise one. It serves the traceability of knowledge, not the performance assessment of people.",
    "auditprotokoll.spalte.zeit": "Time",
    "auditprotokoll.spalte.technik": "Technical details",
    "auditprotokoll.tabelle.titel": "The {{shown}} most recent actions out of {{count}} in total",
    "auditprotokoll.technik.anzeigen": "Show IDs",
    "auditprotokoll.technik.nr": "Entry no.",
    "auditprotokoll.technik.akteur": "ID of performing account",
    "auditprotokoll.technik.konto": "ID of affected account",
    "auditprotokoll.technik.objekt": "ID of affected object",
    "auditprotokoll.technik.hash": "Check value (hash)",
    "auditprotokoll.technik.hilfe":
      "The columns name the event, the performing and the affected person and, for a role change, the role before and after. The technical identifiers of every entry (entry number, identifiers of the accounts or the object, check value) are available in addition under “Show IDs”. A deleted account stays named with the name the trail stored when it was deleted or at an earlier role change.",
  },
  nl: {
    "audit.action.ko_revalidated": "Opnieuw gevalideerd (klopt nog)",
    "audit.action.library_export": "Bibliotheek geëxporteerd",
    "audit.action.audit_exported": "Auditlog geëxporteerd",
    "audit.action.conflict_created": "Conflict gemeld",
    "audit.action.conflict_auto_created": "Conflict automatisch herkend",
    "audit.action.conflict_escalated": "Conflict geëscaleerd",
    "audit.action.conflict_resolved": "Conflict beslist",
    "audit.action.conflict_dismissed": "Conflict als vals alarm gesloten",
    "audit.action.conflict_second_opinion": "Tweede mening over conflict",
    "audit.action.conflict_participant_removed": "Bij conflict betrokken object verwijderd",
    "audit.action.conflict_auto_resolved": "Conflict automatisch gesloten",
    "audit.action.conflict_superseded": "Conflict achterhaald door nieuwe versie",
    "audit.action.conflict_classified": "Conflict ingedeeld (soort werk)",
    "audit.action.overlap_auto_created": "Overlap herkend",
    "audit.action.overlap_in_progress": "Overlap in behandeling",
    "audit.action.overlap_dismissed": "Overlap als vals alarm gesloten",
    "audit.action.overlap_kept_separate": "Overlap: bewust gescheiden gehouden",
    "audit.action.overlap_linked_related": "Overlap: als verwant gekoppeld",
    "audit.action.overlap_superseded": "Overlap achterhaald door nieuwe versie",
    "audit.action.overlap_participant_removed": "Bij overlap betrokken object verwijderd",
    "audit.action.overlap_withdrawn_own": "Overlap gesloten door intrekking",
    "audit.action.ko_change_rolled_back": "Wijziging teruggedraaid",
    "audit.action.user_created": "Account aangemaakt",
    "audit.action.ko_source_removed_in_origin": "Bron in het herkomstsysteem verwijderd",
    "audit.action.ko_source_restored_in_origin": "Bron in het herkomstsysteem hersteld",
    "audit.action.ko_source_attachments_synced": "Bijlagen van de bron bijgewerkt",
    "audit.action.ko_source_restriction_synced": "Leesbeperking van de bron bijgewerkt",
    "audit.action.output_lms_export": "Geëxporteerd voor leerplatform (SCORM)",
    "adm.sich.export.button": "Keten exporteren",
    "adm.sich.export.done":
      "Export met {{count}} items opgeslagen. Kop van de keten: nr. {{seq}} · {{hash}}. Wie deze kop buiten de installatie bewaart, kan daar later zien of de keten tot dit punt opnieuw is opgebouwd.",
    "adm.sich.qualityNote":
      "Het logboek legt vast wie wat wanneer heeft vastgelegd, gewijzigd, gecontroleerd en vrijgegeven. Managementsystemen zoals ISO 9001 (kwaliteit) of ISO/IEC 27001 (informatiebeveiliging) verwachten zulk bewijs van gedocumenteerde processen. Het logboek vervangt geen certificering, en KLARWERK belooft er geen. Het dient de herleidbaarheid van kennis, niet de beoordeling van personen.",
    "auditprotokoll.spalte.zeit": "Tijdstip",
    "auditprotokoll.spalte.technik": "Technische gegevens",
    "auditprotokoll.tabelle.titel": "De {{shown}} meest recente acties van in totaal {{count}}",
    "auditprotokoll.technik.anzeigen": "ID's tonen",
    "auditprotokoll.technik.nr": "Vermelding nr.",
    "auditprotokoll.technik.akteur": "ID uitvoerend account",
    "auditprotokoll.technik.konto": "ID betrokken account",
    "auditprotokoll.technik.objekt": "ID betrokken object",
    "auditprotokoll.technik.hash": "Controlewaarde (hash)",
    "auditprotokoll.technik.hilfe":
      "De kolommen noemen de gebeurtenis, de uitvoerende en de betrokken persoon en bij een rolwijziging de rol daarvoor en daarna. De technische kenmerken van elke vermelding (vermeldingsnummer, kenmerken van de accounts of het object, controlewaarde) staan aanvullend onder „ID's tonen“. Een verwijderd account blijft benoemd met de naam die het protocol bij het verwijderen of bij een eerdere rolwijziging heeft opgeslagen.",
  },
} satisfies Textmodul;

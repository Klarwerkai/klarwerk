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
    "audit.action.overlap_auto_created",
    "audit.action.overlap_in_progress",
    "audit.action.overlap_dismissed",
    "audit.action.overlap_kept_separate",
    "audit.action.overlap_linked_related",
    "audit.action.overlap_superseded",
    "audit.action.overlap_participant_removed",
    "audit.action.overlap_withdrawn_own",
    "audit.action.ko_change_rolled_back",
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
    "adm.sich.export.button": "Kette exportieren",
    "adm.sich.export.done":
      "Export mit {{count}} Einträgen gespeichert. Kopf der Kette: Nr. {{seq}} · {{hash}}. Wer diesen Kopf außerhalb der Anlage ablegt, erkennt dort später, ob die Kette bis zu diesem Punkt neu gebildet wurde.",
    "adm.sich.qualityNote":
      "Das Protokoll hält fest, wer was wann erfasst, geändert, geprüft und freigegeben hat. Solche Nachweise erwarten Managementsysteme wie ISO 9001 (Qualität) oder ISO/IEC 27001 (Informationssicherheit) von dokumentierten Abläufen. Eine Zertifizierung ersetzt das Protokoll nicht, und KLARWERK sagt keine zu. Es dient der Nachvollziehbarkeit des Wissens, nicht der Leistungsbewertung von Personen.",
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
    "audit.action.overlap_auto_created": "Overlap detected",
    "audit.action.overlap_in_progress": "Overlap in progress",
    "audit.action.overlap_dismissed": "Overlap closed as false alarm",
    "audit.action.overlap_kept_separate": "Overlap: deliberately kept separate",
    "audit.action.overlap_linked_related": "Overlap: linked as related",
    "audit.action.overlap_superseded": "Overlap superseded by a new version",
    "audit.action.overlap_participant_removed": "Object involved in overlap removed",
    "audit.action.overlap_withdrawn_own": "Overlap closed by withdrawal",
    "audit.action.ko_change_rolled_back": "Change rolled back",
    "adm.sich.export.button": "Export chain",
    "adm.sich.export.done":
      "Export with {{count}} entries saved. Head of the chain: no. {{seq}} · {{hash}}. Whoever stores this head outside the installation can later tell there whether the chain up to this point was rebuilt.",
    "adm.sich.qualityNote":
      "The log records who captured, changed, reviewed and approved what, and when. Management systems such as ISO 9001 (quality) or ISO/IEC 27001 (information security) expect this kind of evidence from documented processes. The log does not replace a certification, and KLARWERK does not promise one. It serves the traceability of knowledge, not the performance assessment of people.",
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
    "audit.action.overlap_auto_created": "Overlap herkend",
    "audit.action.overlap_in_progress": "Overlap in behandeling",
    "audit.action.overlap_dismissed": "Overlap als vals alarm gesloten",
    "audit.action.overlap_kept_separate": "Overlap: bewust gescheiden gehouden",
    "audit.action.overlap_linked_related": "Overlap: als verwant gekoppeld",
    "audit.action.overlap_superseded": "Overlap achterhaald door nieuwe versie",
    "audit.action.overlap_participant_removed": "Bij overlap betrokken object verwijderd",
    "audit.action.overlap_withdrawn_own": "Overlap gesloten door intrekking",
    "audit.action.ko_change_rolled_back": "Wijziging teruggedraaid",
    "adm.sich.export.button": "Keten exporteren",
    "adm.sich.export.done":
      "Export met {{count}} items opgeslagen. Kop van de keten: nr. {{seq}} · {{hash}}. Wie deze kop buiten de installatie bewaart, kan daar later zien of de keten tot dit punt opnieuw is opgebouwd.",
    "adm.sich.qualityNote":
      "Het logboek legt vast wie wat wanneer heeft vastgelegd, gewijzigd, gecontroleerd en vrijgegeven. Managementsystemen zoals ISO 9001 (kwaliteit) of ISO/IEC 27001 (informatiebeveiliging) verwachten zulk bewijs van gedocumenteerde processen. Het logboek vervangt geen certificering, en KLARWERK belooft er geen. Het dient de herleidbaarheid van kennis, niet de beoordeling van personen.",
  },
} satisfies Textmodul;

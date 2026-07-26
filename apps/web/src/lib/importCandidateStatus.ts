// AUFTRAG-mega9 Block E-1 (KW-E2E-005): EINE Quelle für die Statusdarstellung eines
// Import-Kandidaten.
//
// Der Prüferbefund: ein offener Kandidat trug das Abzeichen „Neu" — das beschreibt seinen
// technischen Anlagezustand, nicht seine Bedeutung für den Nutzer. Er ist zur Prüfung vorgemerkt und
// wartet auf eine Entscheidung; genau das soll dastehen. Dieselbe Sprache benutzt die Oberfläche an
// anderer Stelle schon (imp.preview.queued, imp.groups.hintQueued: „bereits zur Prüfung vorgemerkt").
//
// Der Prüfer schlug ausdrücklich vor, die Statuskopie zu ZENTRALISIEREN statt Fundstellen einzeln
// umzubenennen. Vorher baute Stufe2.tsx den i18n-Schlüssel inline per String-Interpolation
// (`imp.status.${c.status}`) und hielt den Farbton in einer eigenen Map daneben — beides konnte
// unabhängig auseinanderlaufen und bei einem unbekannten Status still ins Nichts zeigen.
//
// Reine, DOM-freie Schlüssel-Abbildung wie noAiReasonKey (lib/importGroups) und
// aiCheckFailureReasonKey (lib/aiCheckStatusCard) — kein i18n-Kontext in der Lib.

// Die Zustände, die die Import-Review-Queue kennt.
export const IMPORT_CANDIDATE_STATES = [
  "neu",
  "in_bearbeitung",
  "angenommen",
  "abgelehnt",
  "info-angefragt",
] as const;

export type ImportCandidateStatus = (typeof IMPORT_CANDIDATE_STATES)[number];

export function isImportCandidateStatus(value: string): value is ImportCandidateStatus {
  return (IMPORT_CANDIDATE_STATES as readonly string[]).includes(value);
}

// i18n-Schlüssel für den sichtbaren Statustext. Ein unbekannter Status fällt bewusst auf den
// „unbekannt"-Text zurück statt auf einen fehlenden Schlüssel (sonst stünde der rohe Key in der
// Oberfläche).
export function importCandidateStatusKey(status: string): string {
  return isImportCandidateStatus(status) ? `imp.status.${status}` : "imp.status.unknown";
}

// Farbton des Abzeichens — hier, damit Text und Ton nicht getrennt gepflegt werden müssen.
export function importCandidateStatusTone(status: string): string {
  switch (status) {
    case "neu":
      // Wartet auf Entscheidung → dieselbe Warnfarbe wie „Info angefragt": etwas ist offen.
      return "bg-trust-warn-bg text-trust-warn-text";
    case "angenommen":
      return "bg-trust-pos-bg text-trust-pos-text";
    case "abgelehnt":
      return "bg-trust-crit-bg text-trust-crit-text";
    case "info-angefragt":
      return "bg-trust-warn-bg text-trust-warn-text";
    default:
      return "bg-page text-muted";
  }
}

// „Zählt dieser Kandidat als offen?" — bisher stand `status === "neu"` an vier Stellen in Stufe2.tsx
// verstreut (Zähler, defaultOpen, Aktionszeile). Eine Quelle, damit die Zahl und die Sicht nicht
// auseinanderlaufen können (siehe auch E-5).
export function isOpenImportCandidate(status: string): boolean {
  return status === "neu";
}

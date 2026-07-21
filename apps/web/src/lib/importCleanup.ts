// WP-D-CLEAN (Pedis Entscheid: alle Testdaten löschen, auch Confluence und Jira): flache
// Copy-Schlüssel des Aufräum-Kastens — EINE Quelle für Komponente + i18n-Vollständigkeitstest
// (Muster IMPORT_GROUPS_TEXT). Der Ablauf ist ZWEISTUFIG und immer von Pedi geklickt: erst die
// Vorschau (Zähler, nichts passiert), dann die explizite Bestätigung, dann die ehrliche Bilanz.
export const IMPORT_CLEANUP_TEXT = {
  title: "imp.cleanup.title",
  desc: "imp.cleanup.desc",
  previewCta: "imp.cleanup.previewCta",
  previewLoading: "imp.cleanup.previewLoading",
  previewResult: "imp.cleanup.previewResult",
  confirmHint: "imp.cleanup.confirmHint",
  confirmCta: "imp.cleanup.confirmCta",
  cancel: "imp.cleanup.cancel",
  running: "imp.cleanup.running",
  doneCandidates: "imp.cleanup.doneCandidates",
  doneKos: "imp.cleanup.doneKos",
  doneSkipped: "imp.cleanup.doneSkipped",
  // WP-SHIP8-FIX (bens F2): der Bestand driftete zwischen Vorschau und Bestätigung → 409, die
  // Vorschau wird automatisch neu geladen.
  drift: "imp.cleanup.drift",
  // WP-SHIP8-FIX (bens F1): Aufräumen lief, nur der Abschluss-Audit-Eintrag schlug fehl.
  auditFailed: "imp.cleanup.auditFailed",
  // WP-NIGHT-FIX (bens F2-TOCTOU): parallel eingereihte Kandidaten überleben — ehrlich beziffert.
  newSince: "imp.cleanup.newSince",
} as const;

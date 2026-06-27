// SCRUM-229: stabile Deep-Link-Anker für Analytics-Sektionen. Die alte App hatte eine eigene
// Audit-Fläche; im aktuellen Frontend ist Audit bewusst in Analytics konsolidiert. Damit Audit
// trotzdem direkt verlinkbar bleibt, gibt es einen stabilen Hash-Anker — keine neue Route,
// kein neues Audit-System. Reine, DOM-freie Mapping-Logik (testbar ohne Browser).

// Stabiler Element-Anker des Audit-Abschnitts in Analytics.
export const ANALYTICS_AUDIT_ANCHOR = "analytics-audit";

// Deep-Link auf den Audit-Abschnitt (Hash innerhalb der bestehenden /analytics-Seite).
export const ANALYTICS_AUDIT_PATH = `/analytics#${ANALYTICS_AUDIT_ANCHOR}`;

// Sichere Element-ID aus einem Location-Hash ableiten (#foo → foo; leer/whitespace → null).
export function hashToElementId(hash: string): string | null {
  const id = hash.replace(/^#/, "").trim();
  return id.length > 0 ? id : null;
}

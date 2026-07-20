import { blankLegacyCaptionPlaceholders } from "../lib/editorFigures";
import { sanitizeHtml } from "../lib/richText";

// KW-STR / SCRUM-45/46/48: rendert allowlist-sanitisiertes HTML. Einziger Ort mit
// dangerouslySetInnerHTML; Eingabe wird hier (und serverseitig) sanitisiert.
// WP-D10: Altlast-Platzhalter („Noch keine Bildbeschreibung" u. Ä.) werden in der ANZEIGE wie leer
// behandelt (geleert → das CSS blendet die leere Fußnote aus) — reine Render-Transformation, die
// gespeicherten Daten bleiben unangetastet; der Editor migriert sie beim Laden (editorFigures.ts).
export function SanitizedHtml({
  html,
  className,
}: {
  html: string;
  className?: string;
}): JSX.Element {
  const inner = { __html: blankLegacyCaptionPlaceholders(sanitizeHtml(html)) };
  // biome-ignore lint/security/noDangerouslySetInnerHtml: Inhalt ist allowlist-sanitisiert (richText.sanitizeHtml + Server).
  return <div className={className} dangerouslySetInnerHTML={inner} />;
}

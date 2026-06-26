import { sanitizeHtml } from "../lib/richText";

// KW-STR / SCRUM-45/46/48: rendert allowlist-sanitisiertes HTML. Einziger Ort mit
// dangerouslySetInnerHTML; Eingabe wird hier (und serverseitig) sanitisiert.
export function SanitizedHtml({
  html,
  className,
}: {
  html: string;
  className?: string;
}): JSX.Element {
  const inner = { __html: sanitizeHtml(html) };
  // biome-ignore lint/security/noDangerouslySetInnerHtml: Inhalt ist allowlist-sanitisiert (richText.sanitizeHtml + Server).
  return <div className={className} dangerouslySetInnerHTML={inner} />;
}

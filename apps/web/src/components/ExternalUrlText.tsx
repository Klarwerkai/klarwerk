import type { ReactNode } from "react";
import { safeHttpUrl } from "../lib/safeUrl";

// SCRUM-527 (WP2 — SourceLink-Härtung): rendert eine externe URL als anklickbaren Link NUR, wenn sie
// eine sichere absolute http/https-URL ist. Unsichere/Legacy-Werte (javascript:/data:/relativ) erscheinen
// als reiner, nicht anklickbarer Text — so kann eine bereits gespeicherte gefährliche URL beim Rendern
// kein aktives Schema ausführen. Geteilte defensive Verteidigungslinie für alle externen Treffer-/
// Quelllinks (KnowledgeDetail-Quellliste, externe Suchtreffer, Enrich-Panel, Capture, ExternalKnowledge).
// `leading` erlaubt ein vorangestelltes Element (z. B. ein Link-Icon), das im sicheren wie im
// neutralisierten Fall gleich erscheint.
export function ExternalUrlText({
  url,
  className,
  leading,
}: {
  url: string | null | undefined;
  className?: string;
  leading?: ReactNode;
}): JSX.Element | null {
  if (!url) {
    return null;
  }
  const href = safeHttpUrl(url);
  if (!href) {
    return (
      <span className="block truncate font-mono text-[11px] text-muted-2" title={url}>
        {leading}
        {url}
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {leading}
      {url}
    </a>
  );
}

import { useTranslation } from "react-i18next";

// Herkunftszeile (BRIEF §5 / G-4): Autor · Originalautor · Domäne · Version.
export interface Provenance {
  author: string;
  originalAuthor?: string;
  domain?: string;
  version?: number;
}

export function ProvenanceLine({
  author,
  originalAuthor,
  domain,
  version,
}: Provenance): JSX.Element {
  const { t } = useTranslation();
  const parts: string[] = [author];
  if (originalAuthor && originalAuthor !== author) {
    parts.push(`${t("provenance.original")} ${originalAuthor}`);
  }
  if (domain) {
    parts.push(domain);
  }
  if (version != null) {
    parts.push(`v${version}`);
  }
  return <div className="font-mono text-[11px] text-muted-2">{parts.join(" · ")}</div>;
}

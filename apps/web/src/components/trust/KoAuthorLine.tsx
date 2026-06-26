import { useTranslation } from "react-i18next";

// SCRUM-70 / FR-LIF-04: kompakte Autorzeile für KO-Karten/-Zeilen in Listen.
// Präsentational — bekommt bereits aufgelöste Namen (siehe lib/koAuthor.koAuthorParts).
export interface KoAuthorLineProps {
  author: string;
  originalAuthor?: string;
}

export function KoAuthorLine({ author, originalAuthor }: KoAuthorLineProps): JSX.Element {
  const { t } = useTranslation();
  const text = originalAuthor
    ? `${t("ko.author")}: ${author} · ${t("ko.originalAuthor")}: ${originalAuthor}`
    : `${t("ko.author")}: ${author}`;
  return <div className="truncate font-mono text-[11px] text-muted-2">{text}</div>;
}

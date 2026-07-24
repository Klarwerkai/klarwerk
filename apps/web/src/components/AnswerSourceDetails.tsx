// Paket 4 (nacht24, C1/C2/E1 — Pedis Befund „Quellendarstellung zu schwach"): die Detail-Zeile
// einer Antwort-Quelle. Zeigt je Quelle: Status-Badge KONSISTENT zur Validierung (StatusPill/
// deriveStatus) + Trust-Wert, den bestehenden Pulldown-Summary-Aufklapper (KoSummaryDisclosure,
// E2-Baustein wiederverwendet) und auf Klick den AUSZUG IM DOKUMENT-FORMAT über die bestehende
// sichere Render-Kette (SanitizedHtml — Allowlist-Sanitizer unangetastet; Formatierung inkl.
// Bilder, sofern das KO sie trägt). Kein neuer Egress: ausschließlich bereits geladene,
// berechtigte KO-Daten.
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { KnowledgeObject } from "../api/types";
import { deriveStatus } from "../lib/displayStatus";
import { KoSummaryDisclosure } from "./KoSummaryDisclosure";
import { SanitizedHtml } from "./SanitizedHtml";
import { StatusPill } from "./trust/StatusPill";
import { cx } from "./ui";

export function AnswerSourceDetails({
  ko,
  authorName,
}: {
  ko: KnowledgeObject;
  // FUNKE F1 (nacht24 Paket 6): der Wissensträger wird sichtbar gewürdigt — „aus dem Wissen von
  // <Name>". Der Name kommt vom Aufrufer (Directory-Auflösung EINMAL je Seite; Fallback bleibt
  // ehrlich die Autor-Id, nie erfunden). Die Komponente bleibt dadurch netz-/hookfrei mountbar.
  authorName?: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const [excerptOpen, setExcerptOpen] = useState(false);
  const body = (ko.bodyHtml ?? "").trim();
  return (
    <div className="mt-1 w-full">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Status + Trust — dieselbe Sprache wie Bibliothek/Validierung, kein neues Vokabular. */}
        <StatusPill status={deriveStatus(ko)} />
        <span className="rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted">
          {t("answerSource.trust", { n: ko.trust })}
        </span>
        {authorName ? (
          <span className="text-[11px] text-muted-2">
            {t("funke.sourceAuthor", { name: authorName })}
          </span>
        ) : null}
      </div>
      {/* E2-Baustein wiederverwendet: kurze Inhaltsvorschau (Kernaussage) als Pulldown. */}
      <KoSummaryDisclosure source={ko} className="mt-1" />
      {/* Auszug im DOKUMENT-Format — nur wenn das KO einen formatierten Inhalt trägt (ehrlich:
          ohne bodyHtml gibt es keinen Dokument-Auszug, es wird nichts erfunden). */}
      {body.length > 0 ? (
        <div className="mt-1">
          <button
            type="button"
            aria-expanded={excerptOpen}
            onClick={() => setExcerptOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ai hover:opacity-80"
          >
            <ChevronDown
              size={12}
              className={cx("transition-transform", excerptOpen ? "rotate-180" : "")}
            />
            {excerptOpen ? t("answerSource.excerptHide") : t("answerSource.excerptShow")}
          </button>
          {excerptOpen ? (
            <div className="mt-1.5 rounded-card border border-hairline bg-surface p-3">
              {/* Dieselbe sichere Kette wie die KO-Leseansicht (KoRead): SanitizedHtml + prose-kw. */}
              <SanitizedHtml
                html={body}
                className="prose-kw text-[13.5px] leading-relaxed text-text"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

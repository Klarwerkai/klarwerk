import { useTranslation } from "react-i18next";
import type { KnowledgeObject } from "../../api/types";
import { SourceEvidence } from "../ko/SourceEvidence";

// SCRUM-486 (WP4-Design): eine Konfliktseite (A oder B) als SICHTBARER Beleg — kanonische Kernaussage
// des KO plus die kompakte Belegzeile (klickbare Quelle + Quelldatum + KO-Konfidenz). Der Beleg IST der
// Wow-Moment und gehört auf die Karte, NICHT in ein zugeklapptes <details>. PURE Präsentation.
// Fehlt das KO (entfernt/nicht gefunden), erscheint ein ehrlicher Hinweis statt Fake-Inhalt.
export function ConflictKoSide({
  ko,
  fallbackId,
}: {
  ko: KnowledgeObject | null;
  // Herkunfts-ID für den ehrlichen Entfernt-Zustand (kein erfundener Titel).
  fallbackId: string;
}): JSX.Element {
  const { t } = useTranslation();

  if (!ko) {
    return (
      <div className="rounded-card border border-dashed border-hairline bg-page p-3 text-[12.5px] text-muted-2">
        {t("board.koRemoved")}
        <span className="ml-1 font-mono text-[10.5px]">({fallbackId})</span>
      </div>
    );
  }

  const evidenceDate = ko.sources?.[0]?.at ?? ko.createdAt;
  return (
    <div className="rounded-card border border-trust-crit-fill/30 bg-page p-3">
      <p className="text-[13px] font-semibold leading-snug text-text">{ko.title}</p>
      <p className="mt-1 line-clamp-3 text-[12.5px] leading-relaxed text-muted">{ko.statement}</p>
      <div className="mt-2 border-t border-hairline pt-2">
        <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-muted-2">
          {t("con.evidenceSideLabel")}
        </div>
        <SourceEvidence
          sources={ko.sources ?? []}
          confidence={ko.confidence}
          date={evidenceDate}
          variant="compact"
        />
      </div>
    </div>
  );
}

import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

// SCRUM-527 (WP4-Design): der Abschluss zeigt nicht „gespeichert", sondern die KONSEQUENZ — auf
// Aktualität geprüft, der Name der Person als Quelle hinterlegt, und dass das Wissen künftig gefunden
// wird (nicht die Person). Warm, mit Namensnennung (Experten-Name aus der Session). Reine Präsentation.
// Der optionale Nachfrage-Bezug (SCRUM-499) erscheint NUR, wenn er verfügbar ist (followUpAvailable) —
// kein Fake-Haken ohne Datenbasis.
export function IntakeCompletion({
  authorName,
  koId,
  followUpAvailable = false,
  followUpChecked = false,
  onFollowUpChange,
}: {
  authorName: string;
  // Ziel des „ansehen"-Links; ohne id kein Link (z. B. als Entwurf gespeichert).
  koId?: string;
  followUpAvailable?: boolean;
  followUpChecked?: boolean;
  onFollowUpChange?: (checked: boolean) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="rounded-card border border-trust-pos-fill/30 bg-trust-pos-bg p-5">
      <div className="flex items-center gap-2 text-trust-pos-text">
        <CheckCircle2 size={18} aria-hidden="true" />
        <span className="text-[15px] font-semibold">{t("intake.done.heading")}</span>
      </div>
      <div className="mt-2 space-y-1 text-[13.5px] leading-relaxed text-text">
        <p>{t("intake.done.checked")}</p>
        <p className="font-medium">{t("intake.done.credited", { name: authorName })}</p>
        <p className="text-muted">{t("intake.done.findable")}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {koId ? (
          <Link
            to={`/wissen/${koId}`}
            className="inline-flex items-center rounded-btn border border-hairline bg-surface px-3.5 py-2 text-[13px] font-semibold text-text hover:bg-hairline-soft"
          >
            {t("intake.done.viewKo")}
          </Link>
        ) : null}
        {followUpAvailable ? (
          <label className="inline-flex items-center gap-2 text-[12.5px] text-muted">
            <input
              type="checkbox"
              checked={followUpChecked}
              onChange={(e) => onFollowUpChange?.(e.target.checked)}
            />
            {t("intake.done.followUp")}
          </label>
        ) : null}
      </div>
    </div>
  );
}

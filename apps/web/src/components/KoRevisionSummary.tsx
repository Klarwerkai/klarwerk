// SCRUM-325: kompakter Änderungsüberblick im KO-Detail Edit-Modus. Zeigt, welche Bereiche gegenüber
// dem Original geändert wurden, und weist ehrlich auf die Revisions-Folge hin (neue Version + Review,
// keine automatische Freigabe). Blockiert das Speichern NICHT; keine fachliche Wahrheitsbewertung.
import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type KoRevisionFields, koRevisionSummary } from "../lib/koRevisionSummary";

export function KoRevisionSummary({
  original,
  edit,
}: {
  original: KoRevisionFields | null | undefined;
  edit: KoRevisionFields | null | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const summary = koRevisionSummary(original, edit);

  return (
    <div className="mt-2 rounded-card border border-hairline bg-page p-2.5">
      <div className="flex items-center gap-1.5">
        <Pencil size={13} className="text-muted" />
        <span className="text-[11.5px] font-semibold text-ink">{t("ko.revision.title")}</span>
      </div>
      {summary.hasChanges ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {summary.items.map((item) => (
            <span
              key={item.id}
              className="rounded-pill bg-ai-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-ai"
            >
              {t(item.labelKey)}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{t("ko.revision.none")}</p>
      )}
      <p className="mt-2 border-t border-hairline pt-2 text-[11px] leading-relaxed text-muted-2">
        {t("ko.revision.note")}
      </p>
    </div>
  );
}

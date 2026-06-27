import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useRole } from "../app/RoleContext";
import { type EmptyStateContext, emptyStateActions } from "../lib/emptyStateActions";

// SCRUM-181: kompakte „nächste Schritte"-Links für leere Übersichten. Rein additiv, rollen-/
// Stufe-2-gefiltert über emptyStateActions. KO-interne Navigation, keine Fremd-URLs.
export function EmptyStateCtas({ context }: { context: EmptyStateContext }): JSX.Element | null {
  const { t } = useTranslation();
  const { role, stufe2 } = useRole();
  const actions = emptyStateActions(context, role, stufe2);
  if (actions.length === 0) {
    return null;
  }
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      {actions.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className="rounded-btn border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-text hover:border-ink/30 hover:text-ai"
        >
          {t(a.labelKey)}
        </Link>
      ))}
    </div>
  );
}

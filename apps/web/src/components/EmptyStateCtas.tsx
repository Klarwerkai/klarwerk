import { useTranslation } from "react-i18next";
import { useRole } from "../app/RoleContext";
import { type EmptyStateContext, emptyStateActions } from "../lib/emptyStateActions";
import { knowledgeStory } from "../lib/knowledgeStory";
import { RoleLink } from "./RoleLink";

// SCRUM-181: kompakte „nächste Schritte"-Links für leere Übersichten. Rein additiv, rollen-/
// Stufe-2-gefiltert über emptyStateActions. KO-interne Navigation, keine Fremd-URLs.
// SCRUM-377: leere/erste Zustände sind keine Sackgassen mehr — eine ruhige, app-weite Knowledge-
// Rescue-Story rahmt die Fläche (Erfahrungswissen sichern), ordnet sie in den Knowledge-OS-Kreis
// ein (Erfassen → Validieren → Nutzen → Aktuell halten) und bleibt ehrlich (nichts wird automatisch
// validiert). Die echten nächsten Handlungen liefern weiterhin die vorhandenen, rollengefilterten CTAs.
export function EmptyStateCtas({ context }: { context: EmptyStateContext }): JSX.Element | null {
  const { t } = useTranslation();
  const { role, stufe2 } = useRole();
  const actions = emptyStateActions(context, role, stufe2);
  if (actions.length === 0) {
    return null;
  }
  const story = knowledgeStory(context);
  return (
    <div className="mx-auto mt-3 max-w-md">
      {/* SCRUM-377: ruhige Story-/Kreis-Rahmung (Progressive Disclosure, keine Textwand). */}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span className="text-[12.5px] font-semibold text-text">{t(story.titleKey)}</span>
        <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted-2">
          {t("task.phaseLabel")} {t(story.phaseLabelKey)}
        </span>
      </div>
      <p className="mt-1 text-center text-[12px] leading-relaxed text-muted">{t(story.leadKey)}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {actions.map((a) => (
          // AUFTRAG-mega51 BLOCK A: die Kandidaten sind über `emptyStateActions` bereits rollen-
          // gefiltert — RoleLink sperrt hier also nie. Der Weg läuft trotzdem durch dasselbe Tor,
          // damit die Regel „kein roher Link auf der Startseite" ohne Ausnahme prüfbar bleibt.
          <RoleLink
            key={a.to}
            to={a.to}
            className="rounded-btn border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-text"
            hoverClassName="hover:border-ink/30 hover:text-ai"
          >
            {() => t(a.labelKey)}
          </RoleLink>
        ))}
      </div>
      {/* Ehrlicher Dauerhinweis: Wissen ist erst nach der Prüfung gesichert. */}
      <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-2">
        {t(story.honestKey)}
      </p>
    </div>
  );
}

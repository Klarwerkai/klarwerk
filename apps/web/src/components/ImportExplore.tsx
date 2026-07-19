// IC-2 (Import-Cockpit): erste sichtbare Erkundungs-Ansicht „was ist da". Zeigt VOR jedem Import eine
// Landkarte der Quelle (Mengen, Autoren, Themen, Zeitraum, Bild-Hinweis). READ-ONLY — der „Erkunden"-
// Knopf ruft nur die aggregierende Explore-Route (schreibt nichts). Quellen-Kacheln: Confluence aktiv,
// Jira „bald" (ausgegraut). Design schlicht, iPad-tauglich. Übersetzung DE/EN/NL über i18n-Keys.
import { useMutation } from "@tanstack/react-query";
import { Images, Loader2, Search, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { ImportExploreResponse } from "../api/types";
import {
  type ExploreView,
  NO_AUTHOR_LABEL,
  NO_THEME_LABEL,
  toExploreView,
} from "../lib/importExplore";
import { Button, Card, SectionLabel } from "./ui";

// Die Kern-Platzhalter kommen sprach-neutral aus IC-1 („(ohne Autor)"/„(ohne Label)"); hier auf die
// lokalisierten Anzeigetexte abbilden, damit die Landkarte in jeder UI-Sprache ehrlich lesbar ist.
function localizeName(name: string, t: (k: string) => string): string {
  if (name === NO_AUTHOR_LABEL) {
    return t("imp.explore.noAuthor");
  }
  if (name === NO_THEME_LABEL) {
    return t("imp.explore.noTheme");
  }
  return name;
}

function ExploreMap({ view, truncated }: { view: ExploreView; truncated: boolean }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mt-4 border-t border-hairline pt-4">
      {truncated ? (
        <p className="mb-3 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12px] text-trust-warn-text">
          {t("imp.explore.truncated", { n: view.totalCount })}
        </p>
      ) : null}
      {/* Kennzahlen */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t("imp.explore.pages")} value={String(view.totalCount)} />
        <Stat label={t("imp.explore.sources")} value={String(view.distinctSources)} />
        <Stat label={t("imp.explore.period")} value={view.period} />
      </div>

      {/* Autoren */}
      {view.authors.length > 0 ? (
        <div className="mt-4">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted">
            <Users size={13} /> {t("imp.explore.authors")}
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {view.authors.map((a) => (
              <span
                key={a.name}
                className="inline-flex items-center gap-1 rounded-pill border border-hairline bg-page px-2 py-0.5 text-[12px] text-text"
              >
                {localizeName(a.name, t)}
                <span className="font-mono text-[10.5px] text-muted-2">{a.count}</span>
              </span>
            ))}
            {view.authorsRest > 0 ? (
              <span className="inline-flex items-center rounded-pill px-2 py-0.5 text-[12px] text-muted-2">
                {t("imp.explore.more", { n: view.authorsRest })}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Themen */}
      {view.themes.length > 0 ? (
        <div className="mt-4">
          <span className="text-[12px] font-semibold text-muted">{t("imp.explore.themes")}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {view.themes.map((th) => (
              <span
                key={th.label}
                className="inline-flex items-center gap-1 rounded-pill border border-hairline bg-page px-2 py-0.5 text-[12px] text-text"
              >
                {localizeName(th.label, t)}
                <span className="font-mono text-[10.5px] text-muted-2">{th.count}</span>
              </span>
            ))}
            {view.themesRest > 0 ? (
              <span className="inline-flex items-center rounded-pill px-2 py-0.5 text-[12px] text-muted-2">
                {t("imp.explore.more", { n: view.themesRest })}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Bild-Hinweis */}
      {view.withImagesHint > 0 ? (
        <p className="mt-4 inline-flex items-center gap-1.5 text-[12px] text-muted-2">
          <Images size={13} /> {t("imp.explore.withImages", { n: view.withImagesHint })}
        </p>
      ) : null}

      {view.totalCount === 0 ? (
        <p className="mt-3 text-[12.5px] text-muted-2">{t("imp.explore.empty")}</p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-card border border-hairline bg-page px-3 py-2">
      <div className="text-[18px] font-semibold leading-tight text-text">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-2">{label}</div>
    </div>
  );
}

export function ImportExplore(): JSX.Element {
  const { t } = useTranslation();
  const explore = useMutation<ImportExploreResponse>({
    mutationFn: () => endpoints.admin.import.explore(),
  });

  const view = explore.data ? toExploreView(explore.data.summary) : null;
  const errorMessage = explore.error instanceof ApiError ? explore.error.message : t("state.error");

  return (
    <Card className="mb-5">
      <SectionLabel>{t("imp.explore.title")}</SectionLabel>
      <p className="mb-3 text-[13px] text-muted">{t("imp.explore.hint")}</p>

      {/* Quellen-Kacheln: Confluence aktiv, Jira „bald". */}
      <div className="flex flex-wrap gap-2">
        <div className="rounded-card border border-ink/25 bg-surface px-3 py-2 text-[13px] font-semibold text-text">
          Confluence
          <span className="ml-1.5 rounded-pill bg-trust-pos-bg px-1.5 py-0.5 text-[10px] font-medium text-trust-pos-text">
            {t("imp.explore.active")}
          </span>
        </div>
        <div className="rounded-card border border-hairline bg-page px-3 py-2 text-[13px] font-semibold text-muted-2">
          Jira
          <span className="ml-1.5 rounded-pill bg-hairline-soft px-1.5 py-0.5 text-[10px] font-medium text-muted-2">
            {t("imp.explore.soon")}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <Button variant="primary" disabled={explore.isPending} onClick={() => explore.mutate()}>
          {explore.isPending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Search size={15} />
          )}
          {explore.isPending ? t("imp.explore.exploring") : t("imp.explore.cta")}
        </Button>
      </div>

      {explore.isError ? (
        <p className="mt-3 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
          {errorMessage}
        </p>
      ) : null}

      {view ? <ExploreMap view={view} truncated={explore.data?.truncated ?? false} /> : null}
    </Card>
  );
}

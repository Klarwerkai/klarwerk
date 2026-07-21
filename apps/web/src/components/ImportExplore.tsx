// IC-2 (Import-Cockpit): erste sichtbare Erkundungs-Ansicht „was ist da". Zeigt VOR jedem Import eine
// Landkarte der Quelle (Mengen, Autoren, Themen, Zeitraum, Bild-Hinweis). READ-ONLY — der „Erkunden"-
// Knopf ruft nur die aggregierende Explore-Route (schreibt nichts). Quellen-Kacheln: Confluence aktiv,
// Jira „bald" (ausgegraut). Design schlicht, iPad-tauglich. Übersetzung DE/EN/NL über i18n-Keys.
// WP-IC-PAKET-1 (Teil 3): Autoren-/Themen-/Space-Chips sind jetzt KLICKBARE Filter (aria-pressed,
// aktiver Zustand deutlich, große Trefferfläche) — sie speisen die Auswahl-Vorschau (ImportSelect).
// WP-IC-PAKET-1 (Teil 2): abgeleitete Themen (aus Titeln, deterministisch) sind dezent gekennzeichnet.
// WP-IC-PAKET-1 (Teil 4): „davon bereits importiert"-Zeile aus dem Quell-Referenz-Abgleich.
import { useMutation } from "@tanstack/react-query";
import { Images, Loader2, Search, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { ImportExploreResponse } from "../api/types";
import { displayImportText } from "../lib/htmlEntities";
import {
  type ExploreView,
  NO_AUTHOR_LABEL,
  NO_THEME_LABEL,
  toExploreView,
} from "../lib/importExplore";
import { ImportSelect } from "./ImportSelect";
import { Button, Card, SectionLabel } from "./ui";

// Die Kern-Platzhalter kommen sprach-neutral aus IC-1 („(ohne Autor)"/„(ohne Label)"); hier auf die
// lokalisierten Anzeigetexte abbilden, damit die Landkarte in jeder UI-Sprache ehrlich lesbar ist.
// WP-IC-PAKET-1c (ROT-2): der defensive Entity-Decode läuft NUR, wenn der Decode-Marker der Summary
// fehlt (Altbestand) — kanonische Namen (Marker "decoded") würden sonst DOPPELT dekodiert und ein
// echtes Literal wie „&uuml;" fälschlich zu ü.
function localizeName(name: string, t: (k: string) => string, textDecoded: boolean): string {
  if (name === NO_AUTHOR_LABEL) {
    return t("imp.explore.noAuthor");
  }
  if (name === NO_THEME_LABEL) {
    return t("imp.explore.noTheme");
  }
  return displayImportText(name, textDecoded ? "decoded" : undefined);
}

// WP-IC-PAKET-1 (Teil 3): einheitlicher Filter-Chip — echtes button, aria-pressed, iPad-große Fläche,
// aktiver Zustand deutlich (invertiert). Platzhalter-Einträge bleiben nicht-klickbare Anzeige.
function FilterChip({
  label,
  count,
  active,
  onToggle,
  extra,
  title,
}: {
  label: string;
  count: number;
  active: boolean;
  onToggle: () => void;
  extra?: string;
  title?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      {...(title !== undefined ? { title } : {})}
      className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-[12.5px] ${
        active
          ? "border-ink/30 bg-ink text-white"
          : "border-hairline bg-page text-text hover:border-ink/20"
      }`}
    >
      {label}
      {extra !== undefined ? (
        <span className={`text-[10px] italic ${active ? "text-white/70" : "text-muted-2"}`}>
          {extra}
        </span>
      ) : null}
      <span className={`font-mono text-[10.5px] ${active ? "text-white/80" : "text-muted-2"}`}>
        {count}
      </span>
    </button>
  );
}

function toggleValue(setter: (fn: (prev: string[]) => string[]) => void, value: string): void {
  setter((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
}

function ExploreMap({
  view,
  truncated,
  alreadyImported,
  failedPages,
}: {
  view: ExploreView;
  truncated: boolean;
  alreadyImported: number;
  // WP-SAMMEL20-FIX (bens Fix 6a): Seiten, die beim Lesen/Mappen der Quelle scheiterten.
  failedPages: number;
}): JSX.Element {
  const { t } = useTranslation();
  // WP-IC-PAKET-1 (Teil 3): Klick-Filter der Landkarte — Roh-Werte (Server-Vertrag), Anzeige dekodiert.
  const [selAuthors, setSelAuthors] = useState<string[]>([]);
  const [selThemes, setSelThemes] = useState<string[]>([]);
  const [selSpaces, setSelSpaces] = useState<string[]>([]);

  return (
    <div className="mt-4 border-t border-hairline pt-4">
      {truncated ? (
        <p className="mb-3 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12px] text-trust-warn-text">
          {t("imp.explore.truncated", { n: view.totalCount })}
        </p>
      ) : null}
      {/* WP-SAMMEL20-FIX (bens Fix 6a): partielle Lesefehler nüchtern ausweisen statt verschweigen. */}
      {failedPages > 0 ? (
        <p className="mb-3 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12px] text-trust-warn-text">
          {t("imp.explore.failedPages", { n: failedPages })}
        </p>
      ) : null}
      {/* Kennzahlen */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t("imp.explore.pages")} value={String(view.totalCount)} />
        <Stat label={t("imp.explore.sources")} value={String(view.distinctSources)} />
        <Stat label={t("imp.explore.period")} value={view.period} />
      </div>
      {/* WP-IC-PAKET-1 (Teil 4, IC-6a): ehrlicher Import-Status über die Quell-Referenzen. */}
      {alreadyImported > 0 ? (
        <p className="mt-2 text-[12px] text-muted">
          {t("imp.explore.alreadyImported", { n: alreadyImported })}
        </p>
      ) : null}

      {/* Autoren — klickbare Filter (WP-IC-PAKET-1 Teil 3; vorher nur Anzeige). */}
      {view.authors.length > 0 ? (
        <div className="mt-4">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted">
            <Users size={13} /> {t("imp.explore.authors")}
            {/* WP-SAMMEL20-FIX (bens Fix 6b): der Server liefert Top-N — ehrlich beziffert. */}
            {view.authorsTotal > view.authorsListed ? (
              <span className="font-normal text-muted-2">
                · {t("imp.explore.topOf", { n: view.authorsListed, total: view.authorsTotal })}
              </span>
            ) : null}
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {view.authors.map((a) =>
              a.name === NO_AUTHOR_LABEL ? (
                <span
                  key={a.name}
                  className="inline-flex items-center gap-1 rounded-pill border border-hairline bg-page px-2.5 py-1 text-[12.5px] text-muted-2"
                >
                  {localizeName(a.name, t, view.textDecoded)}
                  <span className="font-mono text-[10.5px]">{a.count}</span>
                </span>
              ) : (
                <FilterChip
                  key={a.name}
                  label={localizeName(a.name, t, view.textDecoded)}
                  count={a.count}
                  active={selAuthors.includes(a.name)}
                  onToggle={() => toggleValue(setSelAuthors, a.name)}
                />
              ),
            )}
            {view.authorsRest > 0 ? (
              <span className="inline-flex items-center rounded-pill px-2 py-0.5 text-[12px] text-muted-2">
                {t("imp.explore.more", { n: view.authorsRest })}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Themen — klickbare Filter; abgeleitete Themen (aus Titeln) dezent gekennzeichnet (Teil 2). */}
      {view.themes.length > 0 ? (
        <div className="mt-4">
          <span className="text-[12px] font-semibold text-muted">
            {t("imp.explore.themes")}
            {view.themesTotal > view.themesListed ? (
              <span className="font-normal text-muted-2">
                {" "}
                · {t("imp.explore.topOf", { n: view.themesListed, total: view.themesTotal })}
              </span>
            ) : null}
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {view.themes.map((th) =>
              th.label === NO_THEME_LABEL ? (
                <span
                  key={th.label}
                  className="inline-flex items-center gap-1 rounded-pill border border-hairline bg-page px-2.5 py-1 text-[12.5px] text-muted-2"
                >
                  {localizeName(th.label, t, view.textDecoded)}
                  <span className="font-mono text-[10.5px]">{th.count}</span>
                </span>
              ) : (
                <FilterChip
                  key={th.label}
                  label={localizeName(th.label, t, view.textDecoded)}
                  count={th.count}
                  active={selThemes.includes(th.label)}
                  onToggle={() => toggleValue(setSelThemes, th.label)}
                  {...(th.derived
                    ? { extra: t("imp.explore.derivedTag"), title: t("imp.explore.derivedHint") }
                    : {})}
                />
              ),
            )}
            {view.themesRest > 0 ? (
              <span className="inline-flex items-center rounded-pill px-2 py-0.5 text-[12px] text-muted-2">
                {t("imp.explore.more", { n: view.themesRest })}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Spaces — Filter nur, wenn es MEHRERE gibt (Teil 3; bei einem Space wäre der Chip sinnlos). */}
      {view.spaces.length > 1 ? (
        <div className="mt-4">
          <span className="text-[12px] font-semibold text-muted">{t("imp.explore.spaces")}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {view.spaces.map((s) => (
              <FilterChip
                key={s.name}
                label={displayImportText(s.name, view.textDecoded ? "decoded" : undefined)}
                count={s.count}
                active={selSpaces.includes(s.name)}
                onToggle={() => toggleValue(setSelSpaces, s.name)}
              />
            ))}
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

      {/* IC-3: prompt-/filtergesteuerte Auswahl-Vorschau — die Chips der Landkarte sind die Filter.
          READ-ONLY (kein Übernahme-Button; das ist IC-4). */}
      {view.totalCount > 0 ? (
        <ImportSelect chip={{ themes: selThemes, authors: selAuthors, spaces: selSpaces }} />
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

      {view ? (
        <ExploreMap
          view={view}
          truncated={explore.data?.truncated ?? false}
          alreadyImported={explore.data?.alreadyImported ?? 0}
          failedPages={explore.data?.failedPages ?? 0}
        />
      ) : null}
    </Card>
  );
}

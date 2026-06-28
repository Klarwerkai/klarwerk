import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, RotateCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { useDirectory, useKos, useLibrarySearch } from "../api/hooks";
import { useToast } from "../app/ToastContext";
import { DemoBanner } from "../components/DemoBanner";
import { EmptyStateCtas } from "../components/EmptyStateCtas";
import {
  ConfidenceBar,
  KNOWLEDGE_TYPES,
  KnowledgeTypeTag,
  KoAuthorLine,
  StatusPill,
} from "../components/trust";
import { Button, Card, PageHeader, QueryState } from "../components/ui";
import { isDemoContext } from "../lib/demoPilotPath";
import { deriveStatus } from "../lib/displayStatus";
import { type KnowledgeGuidanceTone, knowledgeGuidance } from "../lib/knowledgeGuidance";
import { koAuthorParts } from "../lib/koAuthor";
import { windowList } from "../lib/libraryDisplay";
import { EXPORT_FORMATS, type ExportFormat, exportFilename, exportUrl } from "../lib/libraryExport";
import {
  MATURITY_FILTERS,
  type MaturityFilter,
  type MaturityTone,
  countByMaturity,
  filterByMaturity,
  libraryMaturity,
  libraryUseCta,
  maturityFilterLabelKey,
} from "../lib/libraryMaturity";
import { EMPTY_LIBRARY_FILTER, buildLibraryQuery } from "../lib/libraryQuery";
import { type MatchField, searchLibrary } from "../lib/librarySearch";
import { canRevalidate } from "../lib/revalidation";
import { categoryOptions, tagOptions } from "../lib/validationFilters";

const KO_STATUSES = ["offen", "validiert"] as const;

// SCRUM-262: Tönung der Reife-/Nutzbarkeits-Plakette (nutzbar/in Prüfung/zu prüfen).
const MATURITY_TONE: Record<MaturityTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
};

// SCRUM-289: kompakte Reife-Erklärung (nutzbar vs. in Prüfung/zu prüfen).
const GUIDE_TONE: Record<KnowledgeGuidanceTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
};

export function Library(): JSX.Element {
  const { t } = useTranslation();
  // Startfilter aus der URL (?q=…), gesetzt von der globalen Topbar-Suche.
  const [params] = useSearchParams();
  const [filter, setFilter] = useState({ ...EMPTY_LIBRARY_FILTER, q: params.get("q") ?? "" });
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");
  // SCRUM-267: einfacher Reife-Filter (Alle/Nutzbar/In Prüfung/Zu prüfen) auf der gerankten Liste.
  const [maturity, setMaturity] = useState<MaturityFilter>("all");
  const guide = knowledgeGuidance("library");

  // Optionen (Domäne/Tags) aus dem ungefilterten Bestand, damit sie stabil bleiben.
  const all = useKos();
  const cats = categoryOptions(all.data ?? []);
  const tags = tagOptions(all.data ?? []);
  // FR-LIF-04: Autor in jeder KO-Zeile sichtbar (Namen via Directory, Fallback ID).
  const dir = useDirectory();
  const nameOf = (uid: string): string => dir.data?.find((d) => d.id === uid)?.name || uid;

  // Ergebnisse über den Server-Search-/Filterpfad (Volltext + KoFilter).
  const query = useLibrarySearch(buildLibraryQuery(filter));
  // SCRUM-245: aktuelle Volltext-Query für client-seitiges Re-Ranking + Match-Hinweise.
  const trimmedQ = filter.q.trim();

  // Match-Grund → kompaktes, ehrliches Label (kein „semantisch", keine Fake-Treffer).
  const matchLabel = (field: MatchField): string => t(`lib.match.${field}`);

  const qc = useQueryClient();
  const { push } = useToast();
  // SCRUM-136: Re-Validierung über den vorhandenen KO-/Lifecycle-Pfad (revalidate).
  const revalidate = useMutation({
    mutationFn: (id: string) => endpoints.ko.act(id, { action: "revalidate" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["library"] });
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["validation"] });
      void qc.invalidateQueries({ queryKey: ["lifecycle"] });
      push("success", t("lib.revalidateDone"));
    },
    onError: () => push("error", t("state.error")),
  });

  const selectCls =
    "h-10 rounded-input border border-hairline bg-surface px-2 text-sm text-text outline-none focus:border-ink/30";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        kicker={t("lib.kicker")}
        title={t("nav.library")}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/import">
              <Button variant="ghost">{t("lib.reimport")}</Button>
            </Link>
            <select
              aria-label={t("lib.exportFormat")}
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              className="h-9 rounded-input border border-hairline bg-surface px-2 text-[13px] text-text outline-none focus:border-ink/30"
            >
              {EXPORT_FORMATS.map((fmt) => (
                <option key={fmt} value={fmt}>
                  {t(`lib.format.${fmt}`)}
                </option>
              ))}
            </select>
            <a href={exportUrl(exportFormat)} download={exportFilename(exportFormat)}>
              <Button>
                <Download size={15} />
                {t("lib.export")}
              </Button>
            </a>
          </div>
        }
      />
      {/* SCRUM-291: Demo-/Pilotpfad auf der Zielseite wiedererkennbar (nur bei ?demo=stage1). */}
      {isDemoContext(params) ? <DemoBanner surface="library" /> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={filter.q}
          onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
          placeholder={t("lib.search")}
          className="h-10 min-w-[12rem] flex-1 rounded-input border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
        />
        <select
          value={filter.type}
          onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}
          className={selectCls}
        >
          <option value="">{t("lib.allTypes")}</option>
          {KNOWLEDGE_TYPES.map((tp) => (
            <option key={tp} value={tp}>
              {t(`ktype.${tp}`)}
            </option>
          ))}
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          className={selectCls}
        >
          <option value="">{t("lib.allStatus")}</option>
          {KO_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <select
          value={filter.category}
          onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}
          className={selectCls}
        >
          <option value="">{t("lib.allCategories")}</option>
          {cats.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filter.tag}
          onChange={(e) => setFilter((f) => ({ ...f, tag: e.target.value }))}
          className={selectCls}
        >
          <option value="">{t("lib.allTags")}</option>
          {tags.map((tg) => (
            <option key={tg} value={tg}>
              {tg}
            </option>
          ))}
        </select>
      </div>
      {/* SCRUM-289: Reife-Plaketten/Filter kurz erklären — kein neues Statusmodell. */}
      <Card className="mb-4 border-dashed">
        <div className="mb-2">
          <h2 className="text-[14px] font-semibold text-ink">{t(guide.titleKey)}</h2>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{t(guide.bodyKey)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {guide.items.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className="inline-flex items-start gap-2 rounded-btn border border-hairline bg-surface px-2.5 py-2 hover:border-ink/30"
            >
              <span
                className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${GUIDE_TONE[item.tone]}`}
              >
                {t(item.labelKey)}
              </span>
              <span className="max-w-[18rem] text-[12px] leading-relaxed text-muted">
                {t(item.bodyKey)}
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <QueryState
        query={query}
        emptyText={trimmedQ ? t("lib.emptyQuery", { q: trimmedQ }) : t("lib.empty")}
        emptyExtra={<EmptyStateCtas context="library" />}
      >
        {(items) => {
          // SCRUM-245: client-seitig nach nachvollziehbarer Relevanz re-ranken (verwirft nichts).
          const ranked = searchLibrary(items, trimmedQ);
          // SCRUM-267: Reife-Zähler über die gerankte Liste; dann nach Reife filtern …
          const maturityCounts = countByMaturity(ranked);
          const filtered = filterByMaturity(ranked, maturity);
          // SCRUM-158: … erst danach fenstern + zählen (Count-Linie passt zur sichtbaren Menge).
          const win = windowList(filtered);
          return (
            <>
              {/* SCRUM-267: Reife-Filter — dieselbe Logik wie die Plakette (libraryMaturity). */}
              <div className="mb-2 flex flex-wrap gap-1.5">
                {MATURITY_FILTERS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMaturity(m)}
                    className={`rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold ${
                      maturity === m
                        ? "border-ink bg-ink text-white"
                        : "border-hairline text-muted hover:text-text"
                    }`}
                  >
                    {t(maturityFilterLabelKey(m))} · {maturityCounts[m]}
                  </button>
                ))}
              </div>
              <div className="mb-2 flex items-center justify-between gap-2 font-mono text-[11px] text-muted-2">
                <span>{t("lib.resultCount", { n: win.total })}</span>
                {win.limited ? (
                  <span className="text-trust-warn-text">
                    {t("lib.showingFirst", { shown: win.shown, total: win.total })}
                  </span>
                ) : null}
              </div>
              <Card className="p-0">
                <div className="divide-y divide-hairline">
                  {win.visible.map(({ ko: k, matches }) => {
                    // SCRUM-262: ehrliche Reife/Nutzbarkeit je Treffer (DOM-freier Helper).
                    const maturity = libraryMaturity(k);
                    const useCta = libraryUseCta(k);
                    return (
                      <div
                        key={k.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-hairline-soft"
                      >
                        <Link
                          to={`/wissen/${k.id}`}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          <span
                            className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${MATURITY_TONE[maturity.tone]}`}
                          >
                            {t(maturity.labelKey)}
                          </span>
                          <StatusPill status={deriveStatus(k)} />
                          <KnowledgeTypeTag type={k.type} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] text-text">
                              {k.title}
                            </span>
                            <KoAuthorLine {...koAuthorParts(k, nameOf)} />
                            {/* SCRUM-245: kompakte, ehrliche Match-Gründe (nur bei aktiver Suche). */}
                            {trimmedQ && matches.length > 0 ? (
                              <span className="mt-0.5 flex flex-wrap items-center gap-1">
                                <span className="font-mono text-[9.5px] uppercase tracking-wide text-muted-2">
                                  {t("lib.matchIn")}
                                </span>
                                {matches.map((field) => (
                                  <span
                                    key={field}
                                    className="rounded-pill bg-hairline-soft px-1.5 py-0.5 text-[10px] text-muted"
                                  >
                                    {matchLabel(field)}
                                  </span>
                                ))}
                              </span>
                            ) : null}
                          </span>
                          <span className="hidden font-mono text-[11px] text-muted-2 sm:block">
                            {k.category}
                          </span>
                          <div className="hidden sm:block">
                            <ConfidenceBar value={k.confidence} showLabel={false} />
                          </div>
                        </Link>
                        {/* SCRUM-288: nur nutzbares/validiertes Wissen direkt in Ask; offene KOs → Review. */}
                        <Link
                          to={useCta.href}
                          title={t(useCta.labelKey)}
                          className={`inline-flex shrink-0 items-center gap-1 rounded-btn border px-2.5 py-1 text-[12px] font-semibold hover:text-text ${
                            useCta.kind === "ask"
                              ? "border-ink bg-ink text-white hover:text-white"
                              : "border-hairline text-muted"
                          }`}
                        >
                          {t(useCta.labelKey)}
                        </Link>
                        {canRevalidate(k.status) ? (
                          <button
                            type="button"
                            title={t("lib.revalidate")}
                            disabled={revalidate.isPending && revalidate.variables === k.id}
                            onClick={() => revalidate.mutate(k.id)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text disabled:opacity-50"
                          >
                            <RotateCw size={13} />
                            {t("lib.revalidate")}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}

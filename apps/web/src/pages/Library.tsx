import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, RotateCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { useDirectory, useKos, useLibrarySearch } from "../api/hooks";
import { useToast } from "../app/ToastContext";
import {
  ConfidenceBar,
  KNOWLEDGE_TYPES,
  KnowledgeTypeTag,
  KoAuthorLine,
  StatusPill,
} from "../components/trust";
import { Button, Card, PageHeader, QueryState } from "../components/ui";
import { deriveStatus } from "../lib/displayStatus";
import { koAuthorParts } from "../lib/koAuthor";
import { windowList } from "../lib/libraryDisplay";
import { EXPORT_FORMATS, type ExportFormat, exportFilename, exportUrl } from "../lib/libraryExport";
import { EMPTY_LIBRARY_FILTER, buildLibraryQuery } from "../lib/libraryQuery";
import { canRevalidate } from "../lib/revalidation";
import { categoryOptions, tagOptions } from "../lib/validationFilters";

const KO_STATUSES = ["offen", "validiert"] as const;

export function Library(): JSX.Element {
  const { t } = useTranslation();
  // Startfilter aus der URL (?q=…), gesetzt von der globalen Topbar-Suche.
  const [params] = useSearchParams();
  const [filter, setFilter] = useState({ ...EMPTY_LIBRARY_FILTER, q: params.get("q") ?? "" });
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");

  // Optionen (Domäne/Tags) aus dem ungefilterten Bestand, damit sie stabil bleiben.
  const all = useKos();
  const cats = categoryOptions(all.data ?? []);
  const tags = tagOptions(all.data ?? []);
  // FR-LIF-04: Autor in jeder KO-Zeile sichtbar (Namen via Directory, Fallback ID).
  const dir = useDirectory();
  const nameOf = (uid: string): string => dir.data?.find((d) => d.id === uid)?.name || uid;

  // Ergebnisse über den Server-Search-/Filterpfad (Volltext + KoFilter).
  const query = useLibrarySearch(buildLibraryQuery(filter));

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

      <QueryState query={query} emptyText={t("lib.empty")}>
        {(items) => {
          // SCRUM-158: große Bestände bedienbar halten + ehrlich begrenzen.
          const win = windowList(items);
          return (
            <>
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
                  {win.visible.map((k) => (
                    <div
                      key={k.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-hairline-soft"
                    >
                      <Link
                        to={`/wissen/${k.id}`}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <StatusPill status={deriveStatus(k)} />
                        <KnowledgeTypeTag type={k.type} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] text-text">{k.title}</span>
                          <KoAuthorLine {...koAuthorParts(k, nameOf)} />
                        </span>
                        <span className="hidden font-mono text-[11px] text-muted-2 sm:block">
                          {k.category}
                        </span>
                        <div className="hidden sm:block">
                          <ConfidenceBar value={k.confidence} showLabel={false} />
                        </div>
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
                  ))}
                </div>
              </Card>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}

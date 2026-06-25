import { Download } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useKos, useLibrarySearch } from "../api/hooks";
import { ConfidenceBar, KNOWLEDGE_TYPES, KnowledgeTypeTag, StatusPill } from "../components/trust";
import { Button, Card, PageHeader, QueryState } from "../components/ui";
import { deriveStatus } from "../lib/displayStatus";
import { EMPTY_LIBRARY_FILTER, buildLibraryQuery } from "../lib/libraryQuery";
import { categoryOptions, tagOptions } from "../lib/validationFilters";

const KO_STATUSES = ["offen", "validiert"] as const;

export function Library(): JSX.Element {
  const { t } = useTranslation();
  // Startfilter aus der URL (?q=…), gesetzt von der globalen Topbar-Suche.
  const [params] = useSearchParams();
  const [filter, setFilter] = useState({ ...EMPTY_LIBRARY_FILTER, q: params.get("q") ?? "" });

  // Optionen (Domäne/Tags) aus dem ungefilterten Bestand, damit sie stabil bleiben.
  const all = useKos();
  const cats = categoryOptions(all.data ?? []);
  const tags = tagOptions(all.data ?? []);

  // Ergebnisse über den Server-Search-/Filterpfad (Volltext + KoFilter).
  const query = useLibrarySearch(buildLibraryQuery(filter));

  const selectCls =
    "h-10 rounded-input border border-hairline bg-surface px-2 text-sm text-text outline-none focus:border-ink/30";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        kicker={t("lib.kicker")}
        title={t("nav.library")}
        actions={
          <a href="/api/library/export" className="inline-flex">
            <Button>
              <Download size={15} />
              {t("lib.export")}
            </Button>
          </a>
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
        {(items) => (
          <Card className="p-0">
            <div className="divide-y divide-hairline">
              {items.map((k) => (
                <Link
                  key={k.id}
                  to={`/wissen/${k.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-hairline-soft"
                >
                  <StatusPill status={deriveStatus(k)} />
                  <KnowledgeTypeTag type={k.type} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">{k.title}</span>
                  <span className="hidden font-mono text-[11px] text-muted-2 sm:block">
                    {k.category}
                  </span>
                  <div className="hidden sm:block">
                    <ConfidenceBar value={k.confidence} showLabel={false} />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </QueryState>
    </div>
  );
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Minus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { useDirectory, useValidationBoard } from "../api/hooks";
import type { Verdict } from "../api/types";
import { useSession } from "../app/AuthContext";
import { ConfidenceBar, KnowledgeTypeTag } from "../components/trust";
import { Card, PageHeader, QueryState } from "../components/ui";
import {
  EMPTY_VALIDATION_FILTER,
  categoryOptions,
  matchesValidationFilter,
  tagOptions,
  typeOptions,
} from "../lib/validationFilters";

export function Validation(): JSX.Element {
  const { t } = useTranslation();
  const query = useValidationBoard();
  const users = useDirectory();
  const { user } = useSession();
  const qc = useQueryClient();
  const [filter, setFilter] = useState(EMPTY_VALIDATION_FILTER);
  const selectCls =
    "h-10 rounded-input border border-hairline bg-surface px-2 text-sm text-text outline-none focus:border-ink/30";

  const invalidate = (): void => void qc.invalidateQueries({ queryKey: ["validation"] });

  const rate = useMutation({
    mutationFn: ({ id, verdict }: { id: string; verdict: Verdict }) =>
      endpoints.ko.act(id, { action: "rate", verdict }),
    onSuccess: invalidate,
  });

  const assign = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      endpoints.ko.act(id, { action: "assign", userIds: [userId] }),
    onSuccess: invalidate,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader kicker={t("val.kicker")} title={t("nav.validation")} />
      <p className="-mt-3 mb-4 text-sm text-muted">{t("val.intro")}</p>
      <QueryState query={query} emptyText={t("val.empty")}>
        {(items) => {
          const cats = categoryOptions(items);
          const tags = tagOptions(items);
          const types = typeOptions(items);
          const visible = items.filter((k) => matchesValidationFilter(k, filter, user?.id ?? null));
          return (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                  value={filter.search}
                  onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
                  placeholder={t("val.filter")}
                  className="h-10 min-w-[12rem] flex-1 rounded-input border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
                />
                <select
                  value={filter.type}
                  onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">{t("val.filterAllTypes")}</option>
                  {types.map((tp) => (
                    <option key={tp} value={tp}>
                      {t(`ktype.${tp}`)}
                    </option>
                  ))}
                </select>
                <select
                  value={filter.category}
                  onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">{t("val.filterAllCategories")}</option>
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
                  <option value="">{t("val.filterAllTags")}</option>
                  {tags.map((tg) => (
                    <option key={tg} value={tg}>
                      {tg}
                    </option>
                  ))}
                </select>
                <label className="flex h-10 items-center gap-1.5 rounded-input border border-hairline bg-surface px-3 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={filter.mineOnly}
                    onChange={(e) => setFilter((f) => ({ ...f, mineOnly: e.target.checked }))}
                  />
                  {t("val.filterMine")}
                </label>
              </div>
              <div className="space-y-3">
                {visible.map((k) => (
                  <Card key={k.id} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <KnowledgeTypeTag type={k.type} />
                        <span className="font-mono text-[11px] text-muted-2">{k.category}</span>
                      </div>
                      <Link
                        to={`/wissen/${k.id}`}
                        className="block truncate text-[14px] font-medium text-text hover:text-ink"
                      >
                        {k.title}
                      </Link>
                      <div className="mt-1.5 flex items-center gap-3">
                        <ConfidenceBar value={k.confidence} showLabel={false} />
                        <span className="font-mono text-[11px] text-muted-2">
                          {t("val.target", { n: k.neededValidations })}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          title={t("val.confirm")}
                          onClick={() => rate.mutate({ id: k.id, verdict: "up" })}
                          className="grid h-9 w-9 place-items-center rounded-btn bg-trust-pos-bg text-trust-pos-text hover:opacity-80"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          type="button"
                          title={t("val.conditional")}
                          onClick={() => rate.mutate({ id: k.id, verdict: "warn" })}
                          className="grid h-9 w-9 place-items-center rounded-btn bg-trust-warn-bg text-trust-warn-text hover:opacity-80"
                        >
                          <Minus size={16} />
                        </button>
                        <button
                          type="button"
                          title={t("val.reject")}
                          onClick={() => rate.mutate({ id: k.id, verdict: "down" })}
                          className="grid h-9 w-9 place-items-center rounded-btn bg-trust-crit-bg text-trust-crit-text hover:opacity-80"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <select
                        value=""
                        disabled={assign.isPending}
                        onChange={(e) => {
                          if (e.target.value) {
                            assign.mutate({ id: k.id, userId: e.target.value });
                          }
                        }}
                        className="h-8 w-40 rounded-input border border-hairline bg-surface px-2 text-[12px] text-muted"
                      >
                        <option value="">{t("val.assign")}</option>
                        {(users.data ?? []).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name || u.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}

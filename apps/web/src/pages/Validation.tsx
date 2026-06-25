import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Minus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { useDirectory, useValidationBoard } from "../api/hooks";
import type { Verdict } from "../api/types";
import { ConfidenceBar, KnowledgeTypeTag } from "../components/trust";
import { Card, PageHeader, QueryState } from "../components/ui";

export function Validation(): JSX.Element {
  const { t } = useTranslation();
  const query = useValidationBoard();
  const users = useDirectory();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");

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
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t("val.filter")}
        className="mb-4 h-10 w-full max-w-xs rounded-input border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
      />
      <QueryState query={query} emptyText={t("val.empty")}>
        {(items) => (
          <div className="space-y-3">
            {items
              .filter((k) => k.title.toLowerCase().includes(filter.toLowerCase()))
              .map((k) => (
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
        )}
      </QueryState>
    </div>
  );
}

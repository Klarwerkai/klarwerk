import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../api/endpoints";
import { useBusFactor, useGaps } from "../api/hooks";
import { Card, PageHeader, QueryState, SectionLabel } from "../components/ui";

export function Risk(): JSX.Element {
  const { t } = useTranslation();
  const bus = useBusFactor();
  const gaps = useGaps();
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["gaps"] });
  const close = useMutation({ mutationFn: (id: string) => endpoints.gaps.close(id), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => endpoints.gaps.remove(id), onSuccess: invalidate });

  const maxKo = Math.max(1, ...(bus.data ?? []).map((b) => b.koCount));

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <PageHeader kicker={t("risk.kicker")} title={t("nav.risk")} />

      <div>
        <SectionLabel>{t("risk.busfactor")}</SectionLabel>
        <QueryState query={bus} emptyText={t("risk.busEmpty")}>
          {(items) => (
            <Card className="space-y-2.5">
              {items.map((b) => (
                <div key={b.category} className="flex items-center gap-3">
                  <span className="w-32 truncate text-[13px] text-text">{b.category}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-page">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(b.koCount / maxKo) * 100}%`,
                        background: b.singleSource ? "#c0473f" : "#3aa06a",
                      }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-muted-2">
                    {b.authorCount} {t("risk.experts")}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </QueryState>
      </div>

      <div>
        <SectionLabel>{t("risk.gaps")}</SectionLabel>
        <QueryState query={gaps} emptyText={t("risk.gapsEmpty")}>
          {(items) => (
            <Card className="p-0">
              <div className="divide-y divide-hairline">
                {items.map((g) => (
                  <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">{g.question}</span>
                    <span className="font-mono text-[10.5px] uppercase text-muted-2">{t(`risk.gapStatus.${g.status}`)}</span>
                    {g.status === "offen" ? (
                      <button
                        type="button"
                        title={t("risk.close")}
                        onClick={() => close.mutate(g.id)}
                        className="grid h-8 w-8 place-items-center rounded-btn text-trust-pos-text hover:bg-trust-pos-bg"
                      >
                        <Check size={15} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      title={t("risk.delete")}
                      onClick={() => remove.mutate(g.id)}
                      className="grid h-8 w-8 place-items-center rounded-btn text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </QueryState>
      </div>
    </div>
  );
}

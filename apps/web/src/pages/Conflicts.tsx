import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { endpoints } from "../api/endpoints";
import { useConflicts } from "../api/hooks";
import type { ConflictStatus } from "../api/types";
import { Button, Card, PageHeader, QueryState } from "../components/ui";

const PATH: ConflictStatus[] = ["eskaliert", "zweitmeinung", "geloest"];

export function Conflicts(): JSX.Element {
  const { t } = useTranslation();
  const query = useConflicts();
  const qc = useQueryClient();
  const escalate = useMutation({
    mutationFn: (id: string) => endpoints.conflicts.escalate(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["conflicts"] }),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader kicker={t("con.kicker")} title={t("con.title")} />
      <p className="-mt-3 mb-4 text-sm text-muted">{t("con.intro")}</p>
      <QueryState query={query} emptyText={t("con.empty")}>
        {(items) => (
          <div className="space-y-4">
            {items.map((c) => (
              <Card key={c.id}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="rounded-pill bg-trust-crit-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase text-trust-crit-text">
                    {t(`con.type.${c.type}`)}
                  </span>
                  <span className="font-mono text-[11px] uppercase text-muted-2">{t(`con.status.${c.status}`)}</span>
                </div>
                <p className="text-[14px] font-medium text-text">{c.description}</p>
                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="rounded-card bg-page p-2.5 font-mono text-[12px] text-text">{c.koA}</div>
                  <span className="font-mono text-[11px] text-muted-2">vs</span>
                  <div className="rounded-card bg-page p-2.5 font-mono text-[12px] text-text">{c.koB}</div>
                </div>

                {c.type === "truth" ? (
                  <div className="mt-4">
                    <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
                      {t("con.escPath")}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {PATH.map((step, i) => {
                        const reached = PATH.indexOf(c.status) >= i || c.status === "geloest";
                        return (
                          <span
                            key={step}
                            className={`rounded-pill px-2 py-1 font-mono text-[11px] ${
                              reached ? "bg-ink text-white" : "border border-hairline text-muted-2"
                            }`}
                          >
                            {i + 1} {t(`con.status.${step}`)}
                          </span>
                        );
                      })}
                    </div>
                    {c.status === "offen" ? (
                      <Button
                        className="mt-3"
                        disabled={escalate.isPending}
                        onClick={() => escalate.mutate(c.id)}
                      >
                        {t("con.escalate")}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}

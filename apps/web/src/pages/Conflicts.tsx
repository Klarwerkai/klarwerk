import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useConflicts } from "../api/hooks";
import type { ConflictStatus } from "../api/types";
import { Button, Card, PageHeader, QueryState } from "../components/ui";

const PATH: ConflictStatus[] = ["eskaliert", "zweitmeinung", "geloest"];

export function Conflicts(): JSX.Element {
  const { t } = useTranslation();
  const query = useConflicts();
  const qc = useQueryClient();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [decision, setDecision] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ["conflicts"] });
    void qc.invalidateQueries({ queryKey: ["kos"] });
  };

  const escalate = useMutation({
    mutationFn: (id: string) => endpoints.conflicts.escalate(id),
    onSuccess: invalidate,
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const resolve = useMutation({
    mutationFn: (c: { id: string; koA: string }) =>
      endpoints.ko.act(c.koA, {
        action: "resolve-conflict",
        conflictId: c.id,
        decision: decision.trim(),
      }),
    onSuccess: () => {
      invalidate();
      setResolvingId(null);
      setDecision("");
      setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
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
                  <span className="font-mono text-[11px] uppercase text-muted-2">
                    {t(`con.status.${c.status}`)}
                  </span>
                </div>
                <p className="text-[14px] font-medium text-text">{c.description}</p>
                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="rounded-card bg-page p-2.5 font-mono text-[12px] text-text">
                    {c.koA}
                  </div>
                  <span className="font-mono text-[11px] text-muted-2">vs</span>
                  <div className="rounded-card bg-page p-2.5 font-mono text-[12px] text-text">
                    {c.koB}
                  </div>
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
                  </div>
                ) : null}

                {c.status !== "geloest" ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-3">
                    {c.type === "truth" && c.status === "offen" ? (
                      <Button disabled={escalate.isPending} onClick={() => escalate.mutate(c.id)}>
                        {t("con.escalate")}
                      </Button>
                    ) : null}
                    <Button
                      variant="primary"
                      onClick={() => {
                        setErr(null);
                        setDecision("");
                        setResolvingId(resolvingId === c.id ? null : c.id);
                      }}
                    >
                      {t("con.resolve")}
                    </Button>
                  </div>
                ) : c.decision ? (
                  <div className="mt-4 rounded-card bg-trust-pos-bg p-3 text-[13px] text-trust-pos-text">
                    <span className="font-semibold">{t("con.decision")}:</span> {c.decision}
                  </div>
                ) : null}

                {resolvingId === c.id ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={decision}
                      onChange={(e) => setDecision(e.target.value)}
                      rows={2}
                      placeholder={t("con.decisionPlaceholder")}
                      className="w-full resize-y rounded-input border border-hairline bg-surface p-2.5 text-sm text-text outline-none focus:border-ink/30"
                    />
                    {err ? (
                      <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                        {err}
                      </div>
                    ) : null}
                    <Button
                      variant="primary"
                      disabled={resolve.isPending || decision.trim().length === 0}
                      onClick={() => resolve.mutate({ id: c.id, koA: c.koA })}
                    >
                      {t("con.resolveConfirm")}
                    </Button>
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

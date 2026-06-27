import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../api/endpoints";
import { useBusFactor, useConflicts, useDirectory, useGaps, useKos } from "../api/hooks";
import type { GapPriority } from "../api/types";
import { Card, PageHeader, QueryState, SectionLabel } from "../components/ui";
import {
  GAP_PRIORITIES,
  type PriorityTone,
  priorityTone,
  sortGapsByPriority,
} from "../lib/gapPriority";
import { type RiskLevel, domainRisk } from "../lib/knowledgeHealth";
import { buildRiskCockpit } from "../lib/riskCockpit";

const RISK_TONE: Record<RiskLevel, string> = {
  kritisch: "bg-trust-crit-bg text-trust-crit-text",
  mittel: "bg-trust-warn-bg text-trust-warn-text",
  gut: "bg-trust-pos-bg text-trust-pos-text",
};

const PRIORITY_TONE: Record<PriorityTone, string> = {
  crit: "bg-trust-crit-bg text-trust-crit-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
};

export function Risk(): JSX.Element {
  const { t } = useTranslation();
  const bus = useBusFactor();
  const gaps = useGaps();
  const conflicts = useConflicts();
  const kos = useKos();
  const users = useDirectory();
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["gaps"] });
  const close = useMutation({
    mutationFn: (id: string) => endpoints.gaps.close(id),
    onSuccess: invalidate,
  });
  const assign = useMutation({
    mutationFn: ({ id, expertId }: { id: string; expertId: string }) =>
      endpoints.gaps.assign(id, expertId),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => endpoints.gaps.remove(id),
    onSuccess: invalidate,
  });
  const setPriority = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: GapPriority }) =>
      endpoints.gaps.setPriority(id, priority),
    onSuccess: invalidate,
  });

  const maxKo = Math.max(1, ...(bus.data ?? []).map((b) => b.koCount));
  const nameOf = (uid: string): string => users.data?.find((u) => u.id === uid)?.name || uid;

  // SCRUM-230: kompakter Cockpit-Einstieg aus echten Gap-/Conflict-Daten (kein Score, keine Engine).
  const cockpit = buildRiskCockpit(gaps.data ?? [], conflicts.data ?? []);
  const cockpitTiles: { key: string; label: string; value: number; crit?: boolean }[] = [
    { key: "openGaps", label: t("risk.kpiOpenGaps"), value: cockpit.openGaps },
    {
      key: "high",
      label: t("risk.kpiHigh"),
      value: cockpit.highPriority,
      crit: cockpit.highPriority > 0,
    },
    { key: "unassigned", label: t("risk.kpiUnassigned"), value: cockpit.unassigned },
    { key: "assigned", label: t("risk.kpiAssigned"), value: cockpit.assigned },
    {
      key: "conflicts",
      label: t("risk.kpiOpenConflicts"),
      value: cockpit.openConflicts,
      crit: cockpit.openConflicts > 0,
    },
    { key: "closed", label: t("risk.kpiClosedGaps"), value: cockpit.closedGaps },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <PageHeader kicker={t("risk.kicker")} title={t("nav.risk")} />

      {/* SCRUM-230: kompakter Cockpit-Einstieg — aggregierte Kennzahlen aus vorhandenen Daten. */}
      <div>
        <SectionLabel>{t("risk.summary")}</SectionLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {cockpitTiles.map((tile) => (
            <Card key={tile.key} className="p-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
                {tile.label}
              </div>
              <div
                className={`mt-1 text-2xl font-semibold ${
                  tile.crit ? "text-trust-crit-text" : "text-ink"
                }`}
              >
                {tile.value}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* SCRUM-133: Risiko-Cockpit nach Domäne/Kategorie */}
      <div>
        <SectionLabel>{t("risk.cockpit")}</SectionLabel>
        <QueryState query={kos} emptyText={t("risk.cockpitEmpty")}>
          {(items) => {
            const rows = domainRisk(items, bus.data ?? []);
            if (rows.length === 0) {
              return (
                <Card className="border-dashed text-center text-sm text-muted">
                  {t("risk.cockpitEmpty")}
                </Card>
              );
            }
            return (
              <div className="grid gap-2 sm:grid-cols-2">
                {rows.map((r) => (
                  <Card key={r.category} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[13.5px] font-medium text-text">
                        {r.category}
                      </span>
                      <span
                        className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${RISK_TONE[r.level]}`}
                      >
                        {t(`risk.level.${r.level}`)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
                      <span>
                        {t("risk.koCount")}: <span className="text-text">{r.koCount}</span>
                      </span>
                      <span>
                        {t("risk.validated")}:{" "}
                        <span className="text-text">{r.validatedRatio}%</span>
                      </span>
                      <span>
                        {t("risk.openKo")}: <span className="text-text">{r.openCount}</span>
                      </span>
                      <span>
                        {t("risk.experts")}: <span className="text-text">{r.authorCount}</span>
                      </span>
                    </div>
                    {r.singleSource ? (
                      <div className="text-[11px] font-semibold text-trust-crit-text">
                        {t("risk.singleSource")}
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
            );
          }}
        </QueryState>
      </div>

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
                {sortGapsByPriority(items).map((g) => (
                  <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${PRIORITY_TONE[priorityTone(g.priority)]}`}
                    >
                      {t(`risk.priority.${g.priority}`)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">
                      {g.question}
                    </span>
                    <span className="font-mono text-[10.5px] uppercase text-muted-2">
                      {g.assignee ? `→ ${nameOf(g.assignee)}` : t(`risk.gapStatus.${g.status}`)}
                    </span>
                    {g.status === "offen" ? (
                      <>
                        <select
                          value={g.priority}
                          disabled={setPriority.isPending}
                          onChange={(e) =>
                            setPriority.mutate({
                              id: g.id,
                              priority: e.target.value as GapPriority,
                            })
                          }
                          title={t("risk.priorityLabel")}
                          className="h-8 w-28 rounded-input border border-hairline bg-surface px-2 text-[12px] text-muted"
                        >
                          {GAP_PRIORITIES.map((p) => (
                            <option key={p} value={p}>
                              {t(`risk.priority.${p}`)}
                            </option>
                          ))}
                        </select>
                        <select
                          value=""
                          disabled={assign.isPending}
                          onChange={(e) => {
                            if (e.target.value) {
                              assign.mutate({ id: g.id, expertId: e.target.value });
                            }
                          }}
                          className="h-8 w-36 rounded-input border border-hairline bg-surface px-2 text-[12px] text-muted"
                        >
                          <option value="">{t("risk.assign")}</option>
                          {(users.data ?? []).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name || u.id}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          title={t("risk.close")}
                          onClick={() => close.mutate(g.id)}
                          className="grid h-8 w-8 place-items-center rounded-btn text-trust-pos-text hover:bg-trust-pos-bg"
                        >
                          <Check size={15} />
                        </button>
                      </>
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

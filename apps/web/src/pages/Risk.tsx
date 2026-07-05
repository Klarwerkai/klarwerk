import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { useBusFactor, useConflicts, useDirectory, useGaps, useKos } from "../api/hooks";
import type { GapPriority } from "../api/types";
import { HelpTip } from "../components/HelpTip";
import { Card, PageHeader, QueryState, SectionLabel } from "../components/ui";
import { captureGapHref, gapPrivacyNoticeKey } from "../lib/captureFromGap";
import {
  GAP_PRIORITIES,
  type PriorityTone,
  gapNextStep,
  gapPhase,
  priorityTone,
  sortGapsByPriority,
} from "../lib/gapPriority";
import { type RiskLevel, domainRisk } from "../lib/knowledgeHealth";
import { buildRiskCockpit } from "../lib/riskCockpit";
import { phaseLabelKey } from "../lib/taskAction";

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
        <div className="mb-2 flex items-center gap-1.5">
          <SectionLabel>{t("risk.summary")}</SectionLabel>
          <HelpTip title={t("risk.summary")} body={t("risk.help.summary")} />
        </div>
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
        <div className="mb-2 flex items-center gap-1.5">
          <SectionLabel>{t("risk.cockpit")}</SectionLabel>
          <HelpTip title={t("risk.cockpit")} body={t("risk.help.cockpit")} />
        </div>
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
                {rows.map((r) => {
                  // Pedi 05.07.: „wer trägt das Wissen" sichtbar machen — die Personen hinter dieser
                  // Domäne (aus den echten KO-Autoren abgeleitet), damit ein Einzelquellen-Risiko konkret wird.
                  const bearers = Array.from(
                    new Set(items.filter((k) => k.category === r.category).map((k) => k.author)),
                  ).map(nameOf);
                  return (
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
                      {/* Pedi 05.07.: Einzelquellen-Risiko ausführlich erklären + WER es trägt. */}
                      {r.singleSource ? (
                        <div className="rounded-btn bg-trust-crit-bg px-2.5 py-2 text-[11.5px] text-trust-crit-text">
                          <div className="font-semibold">{t("risk.singleSource")}</div>
                          <p className="mt-0.5 leading-relaxed">{t("risk.singleSourceExplain")}</p>
                          {bearers.length > 0 ? (
                            <p className="mt-1 font-semibold">
                              {t("risk.bearer", { names: bearers.join(", ") })}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {/* Verweis auf die konkreten Objekte dieser Domäne (das „was"). */}
                      <Link
                        to={`/bibliothek?category=${encodeURIComponent(r.category)}`}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline"
                      >
                        {t("risk.viewObjects")} <span aria-hidden="true">→</span>
                      </Link>
                    </Card>
                  );
                })}
              </div>
            );
          }}
        </QueryState>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <SectionLabel>{t("risk.busfactor")}</SectionLabel>
          <HelpTip title={t("risk.busfactor")} body={t("risk.help.busfactor")} />
        </div>
        <QueryState query={bus} emptyText={t("risk.busEmpty")}>
          {(items) => (
            <Card className="space-y-2.5">
              {/* Pedi 05.07.: Legende, damit die Balkenfarbe verständlich ist. */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-full" style={{ background: "#c0473f" }} />
                  {t("risk.busLegendSingle")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-full" style={{ background: "#3aa06a" }} />
                  {t("risk.busLegendOk")}
                </span>
              </div>
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
        <div className="mb-1 flex items-center gap-1.5">
          <SectionLabel>{t("risk.gaps")}</SectionLabel>
          <HelpTip title={t("risk.gaps")} body={t("risk.help.gaps")} />
        </div>
        {/* SCRUM-283: ehrlich + datensparsam — gespeicherte Fragen sind offene Lücken (keine Antwort/
            kein validiertes Wissen); beim Erfassen keine sensiblen Details, geprüfte Erfahrung ergänzen. */}
        <p className="mb-2 text-[12px] text-muted-2">{t(gapPrivacyNoticeKey())}</p>
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
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] text-text">{g.question}</div>
                      {/* SCRUM-253: ehrliche nächste Handlung je offener Lücke (priorisieren/zuweisen/erfassen). */}
                      {g.status === "offen" ? (
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                          {/* SCRUM-298: Knowledge-OS-Phase — offene Lücke ist „Erfassen"-Arbeit (gleiche Kreis-Sprache wie Start/MyTasks). */}
                          <span className="rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-2">
                            {t("task.phaseLabel")} {t(phaseLabelKey(gapPhase(g)))}
                          </span>
                          <span>
                            <span className="font-mono uppercase tracking-wider text-muted-2">
                              {t("risk.gapNextLabel")}:
                            </span>{" "}
                            {t(`risk.gapNext.${gapNextStep(g)}`)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <span className="shrink-0 font-mono text-[10.5px] uppercase text-muted-2">
                      {g.assignee ? `→ ${nameOf(g.assignee)}` : t(`risk.gapStatus.${g.status}`)}
                    </span>
                    {g.status === "offen" ? (
                      <>
                        {/* SCRUM-263: offene Lücke direkt als Erfassungskontext starten. */}
                        <Link
                          to={captureGapHref(g.question)}
                          className="inline-flex shrink-0 items-center rounded-btn bg-ink px-2.5 py-1 text-[12px] font-semibold text-white hover:opacity-90"
                        >
                          {t("risk.gapCapture")}
                        </Link>
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

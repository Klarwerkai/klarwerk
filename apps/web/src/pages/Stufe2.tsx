import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Copy, Download, FileText, Printer, Upload } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../api/endpoints";
import {
  useConflicts,
  useEvidenceIndex,
  useGraph,
  useImportCandidates,
  useKos,
  useManagementSnapshot,
  useModelRuns,
  useOutputSources,
  useReasonerConfig,
} from "../api/hooks";
import type {
  ImportItemInput,
  ManagementSnapshot,
  OutputDocument,
  OutputKind,
  ReviewAction,
} from "../api/types";
import { useRole } from "../app/RoleContext";
import { useToast } from "../app/ToastContext";
import { Button, Card, PageHeader, QueryState, SectionLabel } from "../components/ui";
import { deriveStatus } from "../lib/displayStatus";
import { evidenceKindTone, limitEvidence, summarizeEvidence } from "../lib/evidenceIndex";
import { IMPORT_PIPELINE_STEPS, candidateFindings, summarizeImportQueue } from "../lib/extConcept";
import { layoutConflicts, layoutGraph, limitGraph } from "../lib/graphLayout";
import { ImportParseError, parseImportItems } from "../lib/importReview";
import {
  DEFAULT_ASSUMPTIONS,
  type ValuationAssumptions,
  estimateValuation,
  formatEur,
} from "../lib/knowledgeValuation";
import { limitModelRuns, modelRunStatusTone, summarizeModelRuns } from "../lib/modelRuns";
import { OUTPUT_KIND_OPTIONS, downloadFilename, orderedSelection } from "../lib/outputDoc";
import { isModelConfigured, reasonerModeTone } from "../lib/reasonerStatus";

function Stufe2Header({ titleKey, ticket }: { titleKey: string; ticket: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <PageHeader
      kicker={t("s2.kicker")}
      title={t(titleKey)}
      actions={
        <span className="rounded-pill bg-ai-surface-1 px-2.5 py-1 font-mono text-[11px] font-semibold text-ai">
          Stufe 2 · {ticket}
        </span>
      }
    />
  );
}

function Notice({ textKey }: { textKey: string }): JSX.Element {
  const { t } = useTranslation();
  return <Card className="border-dashed text-center text-sm text-muted">{t(textKey)}</Card>;
}

// FR-EXT-03 / SCRUM-117+109: echte Output Factory — Dokumente NUR aus validierten KOs,
// mit Markdown-Export und voller Herkunft. Kein roher Library-Export, kein Fake.
export function Output(): JSX.Element {
  const { t } = useTranslation();
  const { push } = useToast();
  const { role } = useRole();
  const sources = useOutputSources();
  const [kind, setKind] = useState<OutputKind>("instruction");
  const [selected, setSelected] = useState<string[]>([]);
  const [doc, setDoc] = useState<OutputDocument | null>(null);

  const sourceIds = (sources.data ?? []).map((s) => s.id);
  const toggle = (id: string): void =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const generate = useMutation({
    mutationFn: () =>
      endpoints.output.generate({
        kind,
        koIds: orderedSelection(selected, sourceIds),
        audienceRole: role,
      }),
    onSuccess: (d) => setDoc(d),
    onError: () => push("error", t("out.genError")),
  });

  const copy = (): void => {
    if (doc) {
      void navigator.clipboard
        ?.writeText(doc.markdown)
        .then(() => push("success", t("out.copied")));
    }
  };
  const download = (): void => {
    if (!doc) {
      return;
    }
    const blob = new Blob([doc.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFilename(doc);
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Stufe2Header titleKey="nav.output" ticket="SCRUM-117" />

      <Card className="mb-4">
        <SectionLabel>{t("out.kindTitle")}</SectionLabel>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {OUTPUT_KIND_OPTIONS.map((o) => (
            <button
              key={o.kind}
              type="button"
              onClick={() => setKind(o.kind)}
              className={`rounded-card border p-2.5 text-left ${
                kind === o.kind ? "border-ink bg-page" : "border-hairline hover:border-ink/30"
              }`}
            >
              <div className="text-[13px] font-semibold text-ink">{t(o.labelKey)}</div>
              <div className="mt-0.5 text-[11.5px] text-muted">{t(o.descKey)}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <SectionLabel>{t("out.sourcesTitle")}</SectionLabel>
        <QueryState query={sources} emptyText={t("out.noValidated")}>
          {(list) => (
            <ul className="mt-2 space-y-1.5">
              {list.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-input border border-hairline px-2.5 py-2 hover:bg-hairline-soft">
                    <input
                      type="checkbox"
                      checked={selected.includes(s.id)}
                      onChange={() => toggle(s.id)}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-text">{s.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-2">
                      {s.type} · {s.category} · T{s.trust} · v{s.version}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </QueryState>
        <div className="mt-3">
          <Button
            variant="primary"
            disabled={selected.length === 0 || generate.isPending}
            onClick={() => generate.mutate()}
          >
            <FileText size={15} />
            {t("out.generate")}
          </Button>
        </div>
      </Card>

      {doc ? (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <SectionLabel>{t("out.previewTitle")}</SectionLabel>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={copy}>
                <Copy size={14} />
                {t("out.copy")}
              </Button>
              <Button variant="ghost" onClick={download}>
                <Download size={14} />
                {t("out.download")}
              </Button>
            </div>
          </div>
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-card bg-page p-3 text-[12.5px] leading-relaxed text-text">
            {doc.markdown}
          </pre>
          <div className="mt-3">
            <SectionLabel>{t("out.provenanceTitle")}</SectionLabel>
            <ul className="mt-1.5 space-y-1">
              {doc.provenance.map((p) => (
                <li key={p.koId} className="text-[12px] text-muted">
                  <span className="font-mono text-[11px] text-ink">{p.koId}</span> · {p.status} · T
                  {p.trust} · {p.validity}
                  {p.uncertain ? (
                    <span className="text-trust-warn-text"> · {t("out.uncertain")}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

const REVIEW_TONE: Record<string, string> = {
  neu: "bg-page text-muted",
  angenommen: "bg-trust-pos-bg text-trust-pos-text",
  abgelehnt: "bg-trust-crit-bg text-trust-crit-text",
  "info-angefragt": "bg-trust-warn-bg text-trust-warn-text",
};

// SCRUM-108/116/FE-LIB-04: JSON-Re-Import mit echter Source-Review-Queue.
export function ImportReview(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const query = useImportCandidates();
  const [noteId, setNoteId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const createCandidates = useMutation({
    mutationFn: (items: ImportItemInput[]) => endpoints.library.importCandidates.create(items),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["import-candidates"] });
      push("success", t("imp.parsed", { n: created.length }));
    },
    onError: () => push("error", t("state.error")),
  });

  const review = useMutation({
    mutationFn: (v: { id: string; action: ReviewAction; note?: string }) =>
      endpoints.library.importCandidates.review(v.id, v.action, v.note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["import-candidates"] });
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["library"] });
      void qc.invalidateQueries({ queryKey: ["validation"] });
      setNoteId(null);
      setNote("");
      push("success", t("imp.reviewed"));
    },
    onError: () => push("error", t("state.error")),
  });

  const onFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }
    try {
      const items = parseImportItems(await file.text());
      createCandidates.mutate(items);
    } catch (err) {
      push("error", err instanceof ImportParseError ? t("imp.parseError") : t("state.error"));
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Stufe2Header titleKey="nav.import" ticket="SCRUM-116" />

      <Card className="mb-5">
        <SectionLabel>{t("imp.uploadTitle")}</SectionLabel>
        <p className="mb-3 text-[13px] text-muted">{t("imp.uploadHint")}</p>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-3 py-2 text-[13px] font-semibold text-text hover:bg-hairline-soft">
          <Upload size={15} />
          {t("imp.upload")}
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            disabled={createCandidates.isPending}
            onChange={(e) => void onFile(e)}
          />
        </label>
      </Card>

      {/* SCRUM-90/91: konzeptioneller Pipeline-Fluss + ehrliche Queue-Zusammenfassung. */}
      <Card className="mb-4">
        <SectionLabel>{t("ext.pipeline.title")}</SectionLabel>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {IMPORT_PIPELINE_STEPS.map((step, i) => (
            <span key={step} className="flex items-center gap-1.5">
              <span className="rounded-pill border border-hairline bg-page px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase text-muted">
                {t(`ext.pipeline.${step}`)}
              </span>
              {i < IMPORT_PIPELINE_STEPS.length - 1 ? (
                <span className="text-muted-2">→</span>
              ) : null}
            </span>
          ))}
        </div>
        {query.data && query.data.length > 0
          ? (() => {
              const s = summarizeImportQueue(query.data);
              return (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-hairline pt-2 font-mono text-[11.5px] text-muted-2">
                  <span>{t("ext.queue.total", { n: s.total })}</span>
                  <span>{t("ext.queue.open", { n: s.open })}</span>
                  <span>{t("ext.queue.accepted", { n: s.accepted })}</span>
                  <span>{t("ext.queue.rejected", { n: s.rejected })}</span>
                  <span>{t("ext.queue.infoRequested", { n: s.infoRequested })}</span>
                  <span>{t("ext.queue.duplicates", { n: s.duplicates })}</span>
                </div>
              );
            })()
          : null}
      </Card>

      <SectionLabel>{t("imp.queueTitle")}</SectionLabel>
      <QueryState query={query} emptyText={t("imp.queueEmpty")}>
        {(candidates) =>
          candidates.length === 0 ? (
            <Card className="border-dashed text-center text-sm text-muted">
              {t("imp.queueEmpty")}
            </Card>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => (
                <Card key={c.id} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-pill px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase ${
                        REVIEW_TONE[c.status] ?? "bg-page text-muted"
                      }`}
                    >
                      {t(`imp.status.${c.status}`)}
                    </span>
                    {(() => {
                      // SCRUM-91: kompakte, ehrlich abgeleitete Befund-Badges.
                      const f = candidateFindings(c);
                      return (
                        <>
                          {f.duplicate ? (
                            <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase text-trust-warn-text">
                              {t("ext.finding.duplicate")}
                            </span>
                          ) : null}
                          {f.missingInfo ? (
                            <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase text-trust-warn-text">
                              {t("ext.finding.missingInfo")}
                            </span>
                          ) : null}
                          {f.infoRequested ? (
                            <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase text-muted">
                              {t("ext.finding.infoRequested")}
                            </span>
                          ) : null}
                          {f.acceptedKo ? (
                            <span className="rounded-pill bg-trust-pos-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase text-trust-pos-text">
                              {t("ext.finding.acceptedKo")}
                            </span>
                          ) : null}
                          {f.rejected ? (
                            <span className="rounded-pill bg-trust-crit-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase text-trust-crit-text">
                              {t("ext.finding.rejected")}
                            </span>
                          ) : null}
                        </>
                      );
                    })()}
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-text">
                      {c.item.title}
                    </span>
                    <span className="font-mono text-[11px] text-muted-2">{c.item.category}</span>
                  </div>
                  <p className="text-[13px] text-muted">{c.item.statement}</p>
                  {c.note ? (
                    <p className="text-[12px] text-trust-warn-text">
                      {t("imp.note")}: {c.note}
                    </p>
                  ) : null}

                  {c.status === "neu" ? (
                    <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-2">
                      <Button
                        variant="primary"
                        disabled={review.isPending}
                        onClick={() => review.mutate({ id: c.id, action: "accept" })}
                      >
                        {t("imp.accept")}
                      </Button>
                      <Button
                        disabled={review.isPending}
                        onClick={() => review.mutate({ id: c.id, action: "reject" })}
                      >
                        {t("imp.reject")}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setNoteId((id) => (id === c.id ? null : c.id));
                          setNote("");
                        }}
                      >
                        {t("imp.info")}
                      </Button>
                    </div>
                  ) : null}

                  {noteId === c.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={t("imp.notePlaceholder")}
                        className="h-9 flex-1 rounded-input border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
                      />
                      <Button
                        variant="primary"
                        disabled={review.isPending || note.trim().length === 0}
                        onClick={() =>
                          review.mutate({ id: c.id, action: "info", note: note.trim() })
                        }
                      >
                        {t("imp.infoSend")}
                      </Button>
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          )
        }
      </QueryState>
    </div>
  );
}

const BAND_TEXT: Record<string, string> = {
  gut: "text-trust-pos-text",
  mittel: "text-trust-warn-text",
  kritisch: "text-trust-crit-text",
};

function MgmtKpi({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="rounded-card bg-page p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">{label}</div>
      <div className="mt-1 text-xl font-semibold text-ink">{value}</div>
    </div>
  );
}

// SCRUM-120/114 / FE-MGMT: echte, datenbasierte Management-/Wissenskapital-Sichten.
// Alle Zahlen aus dem Live-Snapshot; Valuation ist ein transparentes Schätzmodell.
function CapitalDashboard({ snap }: { snap: ManagementSnapshot }): JSX.Element {
  const { t } = useTranslation();
  const [assumptions, setAssumptions] = useState<ValuationAssumptions>({ ...DEFAULT_ASSUMPTIONS });
  const valuation = estimateValuation(snap.valuationFacts, assumptions);
  const setNum = (k: keyof ValuationAssumptions) => (e: ChangeEvent<HTMLInputElement>) =>
    setAssumptions((a) => ({ ...a, [k]: Number(e.target.value) || 0 }));

  const o = snap.overview;
  return (
    <div className="space-y-4">
      {/* FE-MGMT-01: operativer Snapshot */}
      <Card>
        <SectionLabel>{t("mgmt.overview")}</SectionLabel>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <MgmtKpi label={t("mgmt.kpiTotal")} value={o.totalKos} />
          <MgmtKpi label={t("mgmt.kpiValidated")} value={o.validated} />
          <MgmtKpi label={t("mgmt.kpiOpen")} value={o.open} />
          <MgmtKpi label={t("mgmt.kpiGaps")} value={o.openGaps} />
          <MgmtKpi label={t("mgmt.kpiConflicts")} value={o.openConflicts} />
          <MgmtKpi label={t("mgmt.kpiTrust")} value={o.avgTrust} />
        </div>
      </Card>

      {/* FE-MGMT-03: Knowledge Capital Score */}
      <Card>
        <SectionLabel>{t("mgmt.capital")}</SectionLabel>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={`text-4xl font-bold ${BAND_TEXT[snap.capital.band] ?? "text-ink"}`}>
            {snap.capital.score}
          </span>
          <span className="text-sm text-muted">/ 100 · {t(`mgmt.band.${snap.capital.band}`)}</span>
        </div>
        <div className="mt-3 space-y-1.5">
          {snap.capital.parts.map((p) => (
            <div key={p.key} className="flex items-center gap-2">
              <span className="w-40 shrink-0 text-[12px] text-muted">
                {t(`mgmt.part.${p.key}`)}
              </span>
              <div className="h-2 flex-1 rounded-pill bg-page">
                <div className="h-2 rounded-pill bg-ink" style={{ width: `${p.value}%` }} />
              </div>
              <span className="w-14 shrink-0 text-right font-mono text-[11px] text-muted-2">
                {p.value} · {Math.round(p.weight * 100)}%
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* FE-MGMT-04: Valuation als Schätzmodell */}
      <Card>
        <SectionLabel>{t("mgmt.valuation")}</SectionLabel>
        <div className="mt-2 rounded-card bg-trust-warn-bg px-3 py-2 text-[12px] text-trust-warn-text">
          {t("mgmt.valuationDisclaimer")}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="text-[12px] text-muted">
            {t("mgmt.assumeRate")}
            <input
              type="number"
              value={assumptions.hourlyRate}
              onChange={setNum("hourlyRate")}
              className="mt-1 h-9 w-full rounded-input border border-hairline bg-page px-2 text-sm"
            />
          </label>
          <label className="text-[12px] text-muted">
            {t("mgmt.assumeHours")}
            <input
              type="number"
              value={assumptions.hoursSavedPerValidatedKo}
              onChange={setNum("hoursSavedPerValidatedKo")}
              className="mt-1 h-9 w-full rounded-input border border-hairline bg-page px-2 text-sm"
            />
          </label>
          <label className="text-[12px] text-muted">
            {t("mgmt.assumeReuse")}
            <input
              type="number"
              value={assumptions.reuseFactor}
              onChange={setNum("reuseFactor")}
              className="mt-1 h-9 w-full rounded-input border border-hairline bg-page px-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-3 text-2xl font-semibold text-ink">
          {formatEur(valuation.estimateEur)}
        </div>
        <div className="mt-1 font-mono text-[11px] text-muted-2">{valuation.formula}</div>
        <div className="text-[11px] text-muted-2">
          {t("mgmt.basis", {
            n: snap.valuationFacts.validatedKos,
            trust: snap.valuationFacts.avgTrust,
          })}
        </div>
      </Card>

      {/* FE-MGMT-05: Knowledge Statement */}
      <Card>
        <SectionLabel>{t("mgmt.statement")}</SectionLabel>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <MgmtKpi label={t("mgmt.assets")} value={snap.statement.assets} />
          <MgmtKpi label={t("mgmt.risks")} value={snap.statement.riskItems} />
          <MgmtKpi label={t("mgmt.net")} value={snap.statement.net} />
        </div>
        <div className="mt-2 text-[12px] text-muted">
          {t("mgmt.riskBreakdown", {
            ss: snap.statement.riskBreakdown.singleSourceCategories,
            stale: snap.statement.riskBreakdown.stale,
            gaps: snap.statement.riskBreakdown.openGaps,
            conf: snap.statement.riskBreakdown.openConflicts,
          })}
        </div>
      </Card>

      {/* FE-MGMT-06: Maturity Journey */}
      <Card>
        <SectionLabel>{t("mgmt.maturity")}</SectionLabel>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">
            {t("mgmt.stage")} {snap.maturity.stage}/5 ·{" "}
            {t(`mgmt.stageName.${snap.maturity.stageKey}`)}
          </span>
        </div>
        <div className="mt-2 h-2 rounded-pill bg-page">
          <div
            className="h-2 rounded-pill bg-ink"
            style={{ width: `${snap.maturity.progressPct}%` }}
          />
        </div>
      </Card>

      {/* FE-MGMT-08: Knowledge House */}
      <Card>
        <SectionLabel>{t("mgmt.house")}</SectionLabel>
        {snap.house.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-muted">{t("mgmt.empty")}</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {snap.house.map((f) => (
              <li
                key={f.category}
                className={`flex items-center gap-2 rounded-input border px-2.5 py-2 ${
                  f.fragile ? "border-trust-crit-fill/30 bg-trust-crit-bg" : "border-hairline"
                }`}
              >
                <Building2 size={14} className="text-muted-2" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-text">{f.category}</span>
                <span className="font-mono text-[11px] text-muted-2">
                  {f.koCount} · {f.validatedRatio}% ·{" "}
                  {t(f.fragile ? "mgmt.fragile" : "mgmt.stable")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* FE-MGMT-07: Hero Assist / Empfehlungen */}
      <Card>
        <SectionLabel>{t("mgmt.recommendations")}</SectionLabel>
        {snap.recommendations.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-muted">{t("mgmt.noRecs")}</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {snap.recommendations.map((r) => (
              <li key={r.key} className="flex items-center gap-2 text-[13px]">
                <span
                  className={`rounded-pill px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${
                    r.severity === "hoch"
                      ? "bg-trust-crit-bg text-trust-crit-text"
                      : "bg-trust-warn-bg text-trust-warn-text"
                  }`}
                >
                  {t(`mgmt.sev.${r.severity}`)}
                </span>
                <span className="text-text">{t(`mgmt.rec.${r.key}`, { count: r.count })}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* FE-MGMT-09: Wissens-Priorisierung (9 Faktoren) */}
      <Card>
        <SectionLabel>{t("mgmt.priorities")}</SectionLabel>
        {snap.priorities.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-muted">{t("mgmt.empty")}</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {snap.priorities.slice(0, 8).map((p) => (
              <li key={p.category} className="flex items-center gap-2 text-[12.5px]">
                <span className="min-w-0 flex-1 truncate text-text">{p.category}</span>
                <div className="h-1.5 w-28 rounded-pill bg-page">
                  <div className="h-1.5 rounded-pill bg-ink" style={{ width: `${p.score}%` }} />
                </div>
                <span className="w-8 text-right font-mono text-[11px] text-muted-2">{p.score}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* FE-MGMT-02: Pilot 30/60/90 — Druck-/HTML-Ansicht */}
      <Card>
        <div className="flex items-center justify-between">
          <SectionLabel>{t("mgmt.pilot")}</SectionLabel>
          <Button variant="ghost" onClick={() => window.print()}>
            <Printer size={14} />
            {t("mgmt.print")}
          </Button>
        </div>
        <div className="mt-1 text-[11px] text-muted-2">{t("mgmt.pilotNote")}</div>
        <table className="mt-2 w-full text-[13px]">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase text-muted-2">
              <th className="py-1">{t("mgmt.window")}</th>
              <th className="py-1">{t("mgmt.created")}</th>
              <th className="py-1">{t("mgmt.validatedCol")}</th>
            </tr>
          </thead>
          <tbody>
            {snap.pilot.map((w) => (
              <tr key={w.days} className="border-t border-hairline">
                <td className="py-1.5">
                  {w.days} {t("mgmt.days")}
                </td>
                <td className="py-1.5">{w.created}</td>
                <td className="py-1.5">{w.validated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// SCRUM-165: kompakte, read-only Sicht auf die jüngsten Reasoner-/ModelRuns (nur Metadaten).
function ReasonerRunsCard(): JSX.Element {
  const { t } = useTranslation();
  const runs = useModelRuns(50);
  const records = limitModelRuns(runs.data ?? [], 12);
  const summary = summarizeModelRuns(runs.data ?? []);
  return (
    <Card className="mt-4">
      <SectionLabel>{t("mrun.title")}</SectionLabel>
      {runs.isLoading ? (
        <p className="text-[13px] text-muted">{t("state.loading")}</p>
      ) : runs.isError ? (
        <p className="text-[13px] text-danger">{t("state.error")}</p>
      ) : records.length === 0 ? (
        <p className="text-[13px] text-muted">{t("mrun.empty")}</p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-2">
            <span>{t("mrun.total", { n: summary.total })}</span>
            <span className={summary.errors > 0 ? "text-trust-crit-text" : undefined}>
              {t("mrun.errors", { n: summary.errors })}
            </span>
            <span>{t("mrun.fallbacks", { n: summary.fallbacks })}</span>
            <span>{t("mrun.demo", { n: summary.demo })}</span>
          </div>
          <ul className="divide-y divide-hairline">
            {records.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="rounded-pill border border-hairline px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted">
                  {t(`mrun.task.${r.task}`)}
                </span>
                <span
                  className={`rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                    modelRunStatusTone(r) === "crit"
                      ? "bg-trust-crit-bg text-trust-crit-text"
                      : "bg-trust-pos-bg text-trust-pos-text"
                  }`}
                >
                  {t(`mrun.status.${r.status}`)}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-2">
                  {r.provider} · {r.locale ?? "—"}
                </span>
                {r.fallback ? (
                  <span className="rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-trust-warn-text">
                    {t("mrun.fallback")}
                  </span>
                ) : null}
                {r.demo ? (
                  <span className="rounded-pill bg-ai-surface-1 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-ai">
                    {t("mrun.demoTag")}
                  </span>
                ) : null}
                <span className="font-mono text-[10px] text-muted-2">
                  {new Date(r.startedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

// SCRUM-166: read-only Provider-/Model-Konfiguration (nur Metadaten, keine Secrets).
function ReasonerConfigCard(): JSX.Element {
  const { t } = useTranslation();
  const config = useReasonerConfig();
  return (
    <Card className="mt-4">
      <SectionLabel>{t("rcfg.title")}</SectionLabel>
      {config.isLoading ? (
        <p className="text-[13px] text-muted">{t("state.loading")}</p>
      ) : config.isError || !config.data ? (
        <p className="text-[13px] text-danger">{t("state.error")}</p>
      ) : (
        (() => {
          const c = config.data;
          const warn = reasonerModeTone(c) === "warn";
          return (
            <div className="space-y-2 text-[12.5px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">{t("rcfg.mode")}</span>
                <span
                  className={`rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                    warn
                      ? "bg-trust-warn-bg text-trust-warn-text"
                      : "bg-trust-pos-bg text-trust-pos-text"
                  }`}
                >
                  {t(`rcfg.modeLabel.${c.mode}`)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">{t("rcfg.provider")}</span>
                <span className="font-mono text-text">{c.provider}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">{t("rcfg.model")}</span>
                <span className="font-mono text-text">
                  {isModelConfigured(c) && c.model ? c.model : t("rcfg.notConfigured")}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">{t("rcfg.locales")}</span>
                <span className="font-mono text-muted-2">{c.supportsLocales.join(", ")}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">{t("rcfg.tasks")}</span>
                <span className="font-mono text-muted-2">{c.tasks.join(", ")}</span>
              </div>
              {warn ? (
                <p className="border-t border-hairline pt-2 text-[12px] text-trust-warn-text">
                  {t("rcfg.fallbackHint")}
                </p>
              ) : null}
            </div>
          );
        })()
      )}
    </Card>
  );
}

// SCRUM-169: KO-übergreifender read-only Evidence-Index (QM/Stufe 2). Nur Metadaten —
// keine Object-Rohdaten, URLs nur als Text (nicht klickbar), kein Edit/Delete/Backfill.
function EvidenceIndexCard(): JSX.Element {
  const { t } = useTranslation();
  const index = useEvidenceIndex(100);
  const records = limitEvidence(index.data ?? [], 12);
  const summary = summarizeEvidence(index.data ?? []);
  return (
    <Card className="mt-4">
      <SectionLabel>{t("evx.title")}</SectionLabel>
      {index.isLoading ? (
        <p className="text-[13px] text-muted">{t("state.loading")}</p>
      ) : index.isError ? (
        <p className="text-[13px] text-danger">{t("state.error")}</p>
      ) : records.length === 0 ? (
        <p className="text-[13px] text-muted">{t("evx.empty")}</p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-2">
            <span>{t("evx.total", { n: summary.total })}</span>
            <span>{t("evx.sources", { n: summary.sources })}</span>
            <span>{t("evx.attachments", { n: summary.attachments })}</span>
            <span>{t("evx.kos", { n: summary.distinctKos })}</span>
          </div>
          <ul className="divide-y divide-hairline">
            {records.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <span
                  className={`rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                    evidenceKindTone(r) === "source"
                      ? "bg-ai-surface-1 text-ai"
                      : "bg-trust-info-bg text-trust-info-text"
                  }`}
                >
                  {t(`evx.kind.${r.kind}`)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-text">{r.label}</span>
                <span className="font-mono text-[10px] text-muted-2">
                  {t("evx.koRef", { id: r.koId })}
                </span>
                {r.provider ? (
                  <span className="rounded-pill bg-surface px-1.5 py-0.5 font-mono text-[9.5px] text-muted-2 ring-1 ring-hairline">
                    {t("evx.providerPill", { v: r.provider })}
                  </span>
                ) : null}
                {r.mime ? (
                  <span className="rounded-pill bg-surface px-1.5 py-0.5 font-mono text-[9.5px] text-muted-2 ring-1 ring-hairline">
                    {r.mime}
                  </span>
                ) : null}
                {r.objectId ? (
                  <span className="rounded-pill bg-surface px-1.5 py-0.5 font-mono text-[9.5px] text-muted-2 ring-1 ring-hairline">
                    {t("evx.objectPill", { v: r.objectId })}
                  </span>
                ) : null}
                {r.url ? (
                  // URL bewusst nur als Text (nicht klickbar) — fremde Links werden nicht verlinkt.
                  <span className="max-w-[40%] truncate rounded-pill bg-surface px-1.5 py-0.5 font-mono text-[9.5px] text-muted-2 ring-1 ring-hairline">
                    {r.url}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export function Capital(): JSX.Element {
  const snapshot = useManagementSnapshot();
  return (
    <div className="mx-auto max-w-3xl">
      <Stufe2Header titleKey="nav.capital" ticket="SCRUM-120" />
      <QueryState query={snapshot}>
        {(snap) =>
          snap.overview.totalKos === 0 ? (
            <Notice textKey="mgmt.empty" />
          ) : (
            <CapitalDashboard snap={snap} />
          )
        }
      </QueryState>
      {/* SCRUM-166: Reasoner-/Provider-Konfiguration (read-only, unabhängig vom Snapshot). */}
      <ReasonerConfigCard />
      {/* SCRUM-165: ModelRun-Übersicht — unabhängig vom Snapshot, auch bei leerem Bestand sichtbar. */}
      <ReasonerRunsCard />
      {/* SCRUM-169: KO-übergreifender read-only Evidence-Index (QM). */}
      <EvidenceIndexCard />
    </div>
  );
}

const MAX_GRAPH_NODES = 60;

// Knotenfarbe aus abgeleitetem Anzeigestatus (FE-Join über useKos), currentColor → fill.
const STATUS_NODE_COLOR: Record<string, string> = {
  validiert: "text-trust-pos-fill",
  offen: "text-muted-2",
  pruefung: "text-trust-warn-fill",
  revalidierung: "text-trust-warn-fill",
  konflikt: "text-trust-crit-fill",
  abgelehnt: "text-trust-crit-fill",
};

function LegendDot({ colorClass, label }: { colorClass: string; label: string }): JSX.Element {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
      <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
      {label}
    </span>
  );
}

// SCRUM-119 / FR-ANA-03: echter SVG-Wissensgraph aus Live-Daten. Tag-Kanten aus
// /api/graph, Knotenstatus per FE-Join, Konfliktkanten aus echten Conflict-Daten.
export function GraphView(): JSX.Element {
  const { t } = useTranslation();
  const graphQ = useGraph();
  const kosQ = useKos();
  const conflictsQ = useConflicts();

  return (
    <div className="mx-auto max-w-3xl">
      <Stufe2Header titleKey="nav.graph" ticket="SCRUM-119" />
      <QueryState query={graphQ} emptyText={t("s2.graphEmpty")}>
        {(raw) => {
          if (raw.nodes.length === 0) {
            return <Notice textKey="s2.graphEmpty" />;
          }
          const statusOf = new Map((kosQ.data ?? []).map((k) => [k.id, deriveStatus(k)]));
          const { graph: g, truncated } = limitGraph(raw, MAX_GRAPH_NODES);
          const layout = layoutGraph(g);
          const conflicts = layoutConflicts(
            (conflictsQ.data ?? []).map((c) => ({ a: c.koA, b: c.koB })),
            layout.positions,
          );

          return (
            <Card>
              <p className="mb-2 text-[13px] text-muted">
                {t("s2.graphCount", { nodes: raw.nodes.length, edges: raw.edges.length })}
                {truncated ? ` · ${t("graph.truncated", { n: MAX_GRAPH_NODES })}` : ""}
              </p>
              <svg
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                className="w-full"
                role="img"
                aria-label={t("nav.graph")}
              >
                <title>{t("nav.graph")}</title>
                {/* Tag-Relationen (grau) */}
                {layout.edges.map((e) => (
                  <line
                    key={`tag-${e.a}-${e.via}-${e.b}`}
                    x1={e.x1}
                    y1={e.y1}
                    x2={e.x2}
                    y2={e.y2}
                    className="text-hairline"
                    stroke="currentColor"
                    strokeWidth={1}
                  >
                    <title>{e.via}</title>
                  </line>
                ))}
                {/* Konfliktkanten (rot, gestrichelt) */}
                {conflicts.map((c) => (
                  <line
                    key={`conf-${c.a}-${c.b}`}
                    x1={c.x1}
                    y1={c.y1}
                    x2={c.x2}
                    y2={c.y2}
                    className="text-trust-crit-fill"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    strokeDasharray="5 4"
                  />
                ))}
                {/* Knoten */}
                {layout.nodes.map((n) => (
                  <g key={n.id}>
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={7}
                      className={STATUS_NODE_COLOR[statusOf.get(n.id) ?? "offen"] ?? "text-muted-2"}
                      fill="currentColor"
                    />
                    <text x={n.x} y={n.y - 11} textAnchor="middle" className="fill-text text-[9px]">
                      {n.title.length > 16 ? `${n.title.slice(0, 15)}…` : n.title}
                    </text>
                  </g>
                ))}
              </svg>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                <LegendDot colorClass="bg-trust-pos-fill" label={t("graph.legendValidated")} />
                <LegendDot colorClass="bg-muted-2" label={t("graph.legendOpen")} />
                <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
                  <span className="h-0.5 w-5 bg-hairline" />
                  {t("graph.legendTag")}
                </span>
                <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
                  <span className="h-0 w-5 border-t-2 border-dashed border-trust-crit-fill" />
                  {t("graph.legendConflict")}
                </span>
              </div>
            </Card>
          );
        }}
      </QueryState>
    </div>
  );
}

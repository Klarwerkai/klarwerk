import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useConflicts, useKos } from "../api/hooks";
import type { Conflict, ConflictStatus, KnowledgeObject } from "../api/types";
import { HelpTip } from "../components/HelpTip";
import { KoView } from "../components/KoView";
import { Modal } from "../components/Modal";
import { Button, Card, PageHeader, QueryState } from "../components/ui";
import { CONFLICT_BOARD_TEXT, canDismiss, conflictOriginInfo } from "../lib/conflictBoard";
import { conflictKoPair, conflictNextStep, resolutionEffect } from "../lib/conflictView";
import { type ReviewHelpId, reviewHelp } from "../lib/reviewHelp";

const PATH: ConflictStatus[] = ["eskaliert", "zweitmeinung", "geloest"];

// SCRUM-127: echte KO-Daten gegenüberstellen (Titel, Aussage, Bedingungen/Maßnahmen, Quellen).
function KoPanel({
  ko,
  fallbackId,
}: {
  ko: KnowledgeObject | null;
  fallbackId: string;
}): JSX.Element {
  const { t } = useTranslation();
  if (!ko) {
    return (
      <div className="rounded-card border border-dashed border-hairline bg-page p-3 text-[12px] text-muted">
        {t("con.koMissing", { id: fallbackId })}
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-card bg-page p-3">
      <KoView ko={ko} />
      <Link
        to={`/wissen/${ko.id}`}
        className="inline-block text-[11.5px] font-semibold text-ai hover:underline"
      >
        {t("con.openKo")} →
      </Link>
    </div>
  );
}

// Berater-Konzept 04.07. (Stufe 4b): eine wörtliche Belegstelle (Zitat) im Board.
function ConflictQuote({ labelKey, quote }: { labelKey: string; quote: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <p className="rounded-input bg-surface px-2 py-1.5 text-[11.5px] leading-relaxed text-muted">
      <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-2">
        {t(labelKey)}
      </span>
      <span className="mt-0.5 block italic">„{quote}“</span>
    </p>
  );
}

// Herkunfts-Badge: „Automatisch erkannt · Sicherheit % · Begründung + zwei Zitate" bzw. „Manuell".
function ConflictOriginBadge({ conflict }: { conflict: Conflict }): JSX.Element {
  const { t } = useTranslation();
  const origin = conflictOriginInfo(conflict);
  if (!origin.isAuto) {
    return (
      <div className="mt-1.5">
        <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted-2">
          {t(origin.labelKey)}
        </span>
      </div>
    );
  }
  return (
    <div className="mt-2 rounded-card border border-ai/20 bg-ai/5 p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-pill bg-ai/10 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-ai">
          {t(origin.labelKey)}
        </span>
        {origin.confidencePercent !== undefined ? (
          <span className="font-mono text-[10.5px] text-muted">
            {t(CONFLICT_BOARD_TEXT.confidence, { percent: origin.confidencePercent })}
          </span>
        ) : null}
      </div>
      {origin.rationale ? (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-text">
          <span className="font-semibold">{t(CONFLICT_BOARD_TEXT.why)}:</span> {origin.rationale}
        </p>
      ) : null}
      {origin.quoteA && origin.quoteB ? (
        <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <ConflictQuote labelKey={CONFLICT_BOARD_TEXT.quoteA} quote={origin.quoteA} />
          <ConflictQuote labelKey={CONFLICT_BOARD_TEXT.quoteB} quote={origin.quoteB} />
        </div>
      ) : null}
    </div>
  );
}

export function Conflicts(): JSX.Element {
  const { t } = useTranslation();
  // SCRUM-406: einheitlicher ?-HelpTip aus der zentralen Hilfe-Karte des Prüfbereichs.
  const vhelp = (helpId: ReviewHelpId): JSX.Element => {
    const topic = reviewHelp(helpId);
    return <HelpTip title={t(topic.titleKey)} body={t(topic.bodyKey)} />;
  };
  const query = useConflicts();
  const kos = useKos();
  const qc = useQueryClient();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [decision, setDecision] = useState("");
  const [opinionId, setOpinionId] = useState<string | null>(null);
  const [opinion, setOpinion] = useState("");
  const [err, setErr] = useState<string | null>(null);
  // Pedi 04.07.: welcher Konflikt gerade in der Gegenüberstellung (Pop-up) offen ist.
  const [compareId, setCompareId] = useState<string | null>(null);

  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ["conflicts"] });
    void qc.invalidateQueries({ queryKey: ["kos"] });
  };

  const escalate = useMutation({
    mutationFn: (id: string) => endpoints.conflicts.escalate(id),
    onSuccess: invalidate,
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const secondOpinion = useMutation({
    mutationFn: (id: string) => endpoints.conflicts.secondOpinion(id, opinion.trim()),
    onSuccess: () => {
      invalidate();
      setOpinionId(null);
      setOpinion("");
      setErr(null);
    },
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

  // Berater-Konzept 04.07. (Stufe 4b): „Fehlalarm" schließt einen automatisch erkannten Konflikt.
  const dismiss = useMutation({
    mutationFn: (id: string) => endpoints.conflicts.dismiss(id),
    onSuccess: () => {
      invalidate();
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
                {/* Stufe 4b: Herkunft + Begründung + wörtliche Belege bei automatisch erkannten Konflikten. */}
                <ConflictOriginBadge conflict={c} />
                {(() => {
                  const pair = conflictKoPair(c, kos.data ?? []);
                  return (
                    <div className="mt-3 grid grid-cols-1 items-start gap-3 sm:grid-cols-[1fr_auto_1fr]">
                      <KoPanel ko={pair.a} fallbackId={c.koA} />
                      <span className="self-center text-center font-mono text-[11px] text-muted-2">
                        {t("con.versus")}
                      </span>
                      <KoPanel ko={pair.b} fallbackId={c.koB} />
                    </div>
                  );
                })()}
                {/* Pedi 04.07.: beide Objekte komplett nebeneinander im Pop-up öffnen — direkt
                    vergleichen, ohne die Seite zu verlassen. Nur wenn beide Objekte vorhanden sind. */}
                {(() => {
                  const pair = conflictKoPair(c, kos.data ?? []);
                  return pair.a && pair.b ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button variant="ghost" onClick={() => setCompareId(c.id)}>
                        {t("con.compareOpen")}
                      </Button>
                      <Link
                        to={`/konflikte/${c.id}/vergleich`}
                        className="inline-flex items-center justify-center rounded-btn border border-hairline px-3.5 py-2 text-[13px] font-semibold text-text hover:bg-hairline-soft"
                      >
                        Read-only Vergleich →
                      </Link>
                    </div>
                  ) : null;
                })()}

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

                {c.secondOpinion ? (
                  <div className="mt-4 rounded-card bg-page p-3 text-[13px] text-text">
                    <span className="font-semibold">{t("con.secondOpinion")}:</span>{" "}
                    {c.secondOpinion}
                  </div>
                ) : null}

                {c.status !== "geloest" ? (
                  <div className="mt-4 border-t border-hairline pt-3">
                    {/* SCRUM-252: genau eine empfohlene nächste Handlung, abgeleitet aus Art+Status. */}
                    <p className="mb-2 text-[12.5px] text-muted">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
                        {t("con.nextLabel")}:
                      </span>{" "}
                      <span className="font-medium text-text">
                        {t(`con.next.${conflictNextStep(c)}`)}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {c.type === "truth" && c.status === "offen" ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Button
                            disabled={escalate.isPending}
                            onClick={() => escalate.mutate(c.id)}
                          >
                            {t("con.escalate")}
                          </Button>
                          {vhelp("conflictEscalate")}
                        </span>
                      ) : null}
                      {c.status !== "zweitmeinung" ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Button
                            onClick={() => {
                              setErr(null);
                              setOpinion("");
                              setOpinionId(opinionId === c.id ? null : c.id);
                            }}
                          >
                            {t("con.secondOpinionAdd")}
                          </Button>
                          {vhelp("conflictSecondOpinion")}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-0.5">
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
                        {vhelp("conflictResolve")}
                      </span>
                      {/* Stufe 4b: Ein-Klick-„Fehlalarm" nur bei automatisch erkannten Konflikten. */}
                      {canDismiss(c) ? (
                        <Button
                          variant="ghost"
                          disabled={dismiss.isPending}
                          onClick={() => dismiss.mutate(c.id)}
                        >
                          {t(CONFLICT_BOARD_TEXT.dismiss)}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : c.decision ? (
                  <div className="mt-4 rounded-card bg-trust-pos-bg p-3 text-[13px] text-trust-pos-text">
                    <span className="font-semibold">{t("con.decision")}:</span> {c.decision}
                  </div>
                ) : null}

                {opinionId === c.id ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={opinion}
                      onChange={(e) => setOpinion(e.target.value)}
                      rows={2}
                      placeholder={t("con.secondOpinionPlaceholder")}
                      className="w-full resize-y rounded-input border border-hairline bg-surface p-2.5 text-sm text-text outline-none focus:border-ink/30"
                    />
                    {err ? (
                      <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                        {err}
                      </div>
                    ) : null}
                    <Button
                      variant="primary"
                      disabled={secondOpinion.isPending || opinion.trim().length === 0}
                      onClick={() => secondOpinion.mutate(c.id)}
                    >
                      {t("con.secondOpinionConfirm")}
                    </Button>
                  </div>
                ) : null}

                {resolvingId === c.id ? (
                  <div className="mt-3 space-y-2">
                    {/* SCRUM-128: Auflösung wirkt dokumentierend, nicht mutierend */}
                    <div className="rounded-input bg-trust-warn-bg p-2.5 text-[12px] text-trust-warn-text">
                      {t("con.resolveEffect")}
                      {resolutionEffect(c).revalidationRecommended ? (
                        <span> {t("con.resolveRevalidate")}</span>
                      ) : null}
                    </div>
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

                {(() => {
                  const pair = conflictKoPair(c, kos.data ?? []);
                  if (!pair.a || !pair.b) {
                    return null;
                  }
                  return (
                    <Modal
                      open={compareId === c.id}
                      onClose={() => setCompareId(null)}
                      title={t("con.compareTitle")}
                      wide
                    >
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="rounded-card border border-hairline bg-page p-3">
                          <KoView ko={pair.a} />
                          <Link
                            to={`/wissen/${pair.a.id}`}
                            className="mt-2 inline-block text-[11.5px] font-semibold text-ai hover:underline"
                          >
                            {t("con.openKo")} →
                          </Link>
                        </div>
                        <div className="rounded-card border border-hairline bg-page p-3">
                          <KoView ko={pair.b} />
                          <Link
                            to={`/wissen/${pair.b.id}`}
                            className="mt-2 inline-block text-[11.5px] font-semibold text-ai hover:underline"
                          >
                            {t("con.openKo")} →
                          </Link>
                        </div>
                      </div>
                    </Modal>
                  );
                })()}
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}

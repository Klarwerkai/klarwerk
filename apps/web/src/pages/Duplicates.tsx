import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useDuplicates, useKos } from "../api/hooks";
import type { KnowledgeObject, OverlapEntry } from "../api/types";
import { FindingCard, FindingGroupHeader } from "../components/FindingCard";
import { HelpTip } from "../components/HelpTip";
import { KoView } from "../components/KoView";
import { Modal } from "../components/Modal";
import { Button, Card, PageHeader, QueryState } from "../components/ui";
import { conflictKoPair } from "../lib/conflictView";
import {
  DUPLICATE_BOARD_TEXT,
  canClose,
  overlapDetectorInfo,
  relationLabelKey,
} from "../lib/duplicateBoard";
import { groupFindingsByBeitrag, overlapFinding, resolveKo } from "../lib/findingGroups";

// Ein echtes Wissensobjekt (oder Hinweis, dass es entfernt wurde).
function KoPanel({
  ko,
  fallbackId,
}: { ko: KnowledgeObject | null; fallbackId: string }): JSX.Element {
  const { t } = useTranslation();
  if (!ko) {
    return (
      <div className="rounded-card border border-dashed border-hairline bg-page p-3 text-[12px] text-muted">
        {t("dup.koMissing", { id: fallbackId })}
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
        {t("dup.openKo")} →
      </Link>
    </div>
  );
}

// Eine wörtliche Belegstelle (Zitat) einer gemeinsamen Aussage.
function OverlapQuote({ labelKey, quote }: { labelKey: string; quote: string }): JSX.Element {
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

// Erkennungs-Badge: Erkennungsart · Textdeckung % · (KI) Sicherheit % + Begründung.
function OverlapDetectorBadge({ entry }: { entry: OverlapEntry }): JSX.Element | null {
  const { t } = useTranslation();
  const info = overlapDetectorInfo(entry);
  if (!info) {
    return null;
  }
  // Pedi 04.07.: der Inhalt entscheidet, nicht die Wortdeckung. Deshalb führt die KI-Wahrscheinlichkeit
  // („Vermutliches Duplikat · NN %"); die Textdeckung steht nur noch als Nebendetail darunter. Der
  // deterministische Fall (fast wortgleich, ohne KI) führt mit der Textdeckung selbst.
  // SCRUM-486 E: „KI-Fund" nur bei echter Konfidenz — Lead, Methoden-Pill und Caption konsistent.
  const isModel = info.isModelFinding;
  const leadPercent = isModel ? info.confidencePercent : info.overlapPercent;
  return (
    <div className="mt-2 rounded-card border border-ai/20 bg-ai/5 p-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[13px] font-semibold text-text">
          {isModel ? t("dup.probable") : t("dup.textIdentical")}
        </span>
        <span className="font-mono text-[15px] font-semibold text-ai">{leadPercent} %</span>
        <span className="rounded-pill bg-ai/10 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-ai">
          {t(info.methodLabelKey)}
        </span>
      </div>
      {/* SCRUM-486 B: ehrliche Rahmung — die führende Zahl ist Ähnlichkeit/Wahrscheinlichkeit, kein Beweis. */}
      <div className="mt-0.5 text-[11px] text-muted-2">
        {t(isModel ? "dup.leadCaptionModel" : "dup.leadCaptionText")}
      </div>
      {isModel ? (
        <div className="mt-1 font-mono text-[10.5px] text-muted-2">
          {t(DUPLICATE_BOARD_TEXT.overlap, { percent: info.overlapPercent })}
        </div>
      ) : null}
      {info.rationale ? (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-text">
          <span className="font-semibold">{t(DUPLICATE_BOARD_TEXT.why)}:</span> {info.rationale}
        </p>
      ) : null}
    </div>
  );
}

export function Duplicates(): JSX.Element {
  const { t } = useTranslation();
  const query = useDuplicates();
  const kos = useKos();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);

  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ["duplicates"] });
  };
  const onError = (e: unknown): void =>
    setErr(e instanceof ApiError ? e.message : t("state.error"));

  const dismiss = useMutation({
    mutationFn: (id: string) => endpoints.duplicates.dismiss(id),
    onSuccess: () => {
      invalidate();
      setErr(null);
    },
    onError,
  });
  const keepSeparate = useMutation({
    mutationFn: (id: string) => endpoints.duplicates.keepSeparate(id),
    onSuccess: () => {
      invalidate();
      setErr(null);
    },
    onError,
  });
  const linkRelated = useMutation({
    mutationFn: (id: string) => endpoints.duplicates.linkRelated(id),
    onSuccess: () => {
      invalidate();
      setErr(null);
    },
    onError,
  });
  const busy = dismiss.isPending || keepSeparate.isPending || linkRelated.isPending;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        kicker={t("dup.kicker")}
        title={t("dup.title")}
        actions={
          <HelpTip title={t("dup.help.detection.title")} body={t("dup.help.detection.body")} />
        }
      />
      <p className="-mt-3 mb-4 text-sm text-muted">{t("dup.intro")}</p>
      {err ? (
        <div className="mb-3 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
          {err}
        </div>
      ) : null}
      <QueryState query={query} emptyText={t("dup.empty")}>
        {(items) => (
          <div className="space-y-6">
            {/* SCRUM-486 (nacht24 Paket 3): gruppiert je Beitrag, neueste zuerst — die Kern-
                Darstellung je Befund (WAS · Erkennungsweg · beide Seiten verlinkt · Aktion)
                kommt aus der geteilten FindingCard; Details/Aktionen bleiben darunter. */}
            {groupFindingsByBeitrag(items).map((group) => (
              <section key={group.koId} aria-label={t("finding.groupKicker")}>
                <FindingGroupHeader
                  ko={resolveKo(group.koId, kos.data ?? [])}
                  count={group.items.length}
                />
                <div className="space-y-4">
                  {group.items.map((e) => {
                    const pair = conflictKoPair(e, kos.data ?? []);
                    return (
                      <Card key={e.id}>
                        <FindingCard
                          view={overlapFinding(e)}
                          a={pair.a}
                          b={pair.b}
                          statusLabel={t(`dup.status.${e.status}`)}
                        >
                          {/* Beziehungs-Detail (identisch / enthält / teilweise / verwandt) — ehrlich sichtbar. */}
                          <div className="mt-1.5">
                            <span className="rounded-pill bg-ai/10 px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase text-ai">
                              {t(relationLabelKey(e.relation))}
                            </span>
                          </div>

                          {/* Move B: die führende Zahl bleibt sichtbar (das „Warum"), aber ehrlich gerahmt. */}
                          <OverlapDetectorBadge entry={e} />

                          {/* SCRUM-486: KO-Panels, Belege und Eigenanteile hinter einer ruhigen Aufklappung. */}
                          <details className="mt-3">
                            <summary className="cursor-pointer list-none text-[12px] font-semibold text-ai hover:opacity-80">
                              {t("board.detailsShow")}
                            </summary>
                            <div className="mt-2">
                              <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[1fr_auto_1fr]">
                                <KoPanel ko={pair.a} fallbackId={e.koA} />
                                <span className="self-center text-center font-mono text-[11px] text-muted-2">
                                  {t("dup.versus")}
                                </span>
                                <KoPanel ko={pair.b} fallbackId={e.koB} />
                              </div>

                              {pair.a && pair.b ? (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <Button variant="ghost" onClick={() => setCompareId(e.id)}>
                                    {t("dup.compareOpen")}
                                  </Button>
                                  <Link
                                    to={`/duplikate/${e.id}/vergleich`}
                                    className="inline-flex items-center justify-center rounded-btn border border-hairline px-3.5 py-2 text-[13px] font-semibold text-text hover:bg-hairline-soft"
                                  >
                                    Read-only Vergleich →
                                  </Link>
                                </div>
                              ) : null}

                              {e.aspects.length > 0 ? (
                                <div className="mt-4">
                                  <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
                                    {t("dup.shared")}
                                  </div>
                                  <div className="space-y-2">
                                    {e.aspects.map((a, i) => (
                                      <div
                                        key={`${e.id}-aspect-${i}`}
                                        className="rounded-card border border-hairline bg-page p-2.5"
                                      >
                                        {a.beschreibung ? (
                                          <p className="mb-1.5 text-[12.5px] font-medium text-text">
                                            {a.beschreibung}
                                          </p>
                                        ) : null}
                                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                          <OverlapQuote
                                            labelKey={DUPLICATE_BOARD_TEXT.quoteA}
                                            quote={a.zitatA}
                                          />
                                          <OverlapQuote
                                            labelKey={DUPLICATE_BOARD_TEXT.quoteB}
                                            quote={a.zitatB}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {e.eigenanteilA || e.eigenanteilB ? (
                                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  {e.eigenanteilA ? (
                                    <div className="rounded-card bg-page p-2.5 text-[12.5px] text-text">
                                      <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-2">
                                        {t("dup.onlyA")}
                                      </span>
                                      <span className="mt-0.5 block">{e.eigenanteilA}</span>
                                    </div>
                                  ) : null}
                                  {e.eigenanteilB ? (
                                    <div className="rounded-card bg-page p-2.5 text-[12.5px] text-text">
                                      <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-2">
                                        {t("dup.onlyB")}
                                      </span>
                                      <span className="mt-0.5 block">{e.eigenanteilB}</span>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </details>

                          {canClose(e) ? (
                            <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-3">
                              <Button
                                variant="primary"
                                disabled={busy}
                                onClick={() => keepSeparate.mutate(e.id)}
                              >
                                {t(DUPLICATE_BOARD_TEXT.keepSeparate)}
                              </Button>
                              <Button disabled={busy} onClick={() => linkRelated.mutate(e.id)}>
                                {t(DUPLICATE_BOARD_TEXT.linkRelated)}
                              </Button>
                              <Button
                                variant="ghost"
                                disabled={busy}
                                onClick={() => dismiss.mutate(e.id)}
                              >
                                {t(DUPLICATE_BOARD_TEXT.dismiss)}
                              </Button>
                            </div>
                          ) : e.resolution ? (
                            <div className="mt-4 rounded-card bg-trust-pos-bg p-3 text-[13px] text-trust-pos-text">
                              <span className="font-semibold">{t("dup.closed")}:</span>{" "}
                              {t(`dup.reason.${e.resolution.reason}`)}
                            </div>
                          ) : null}

                          {pair.a && pair.b ? (
                            <Modal
                              open={compareId === e.id}
                              onClose={() => setCompareId(null)}
                              title={t("dup.compareTitle")}
                              wide
                            >
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="rounded-card border border-hairline bg-page p-3">
                                  <KoView ko={pair.a} />
                                  <Link
                                    to={`/wissen/${pair.a.id}`}
                                    className="mt-2 inline-block text-[11.5px] font-semibold text-ai hover:underline"
                                  >
                                    {t("dup.openKo")} →
                                  </Link>
                                </div>
                                <div className="rounded-card border border-hairline bg-page p-3">
                                  <KoView ko={pair.b} />
                                  <Link
                                    to={`/wissen/${pair.b.id}`}
                                    className="mt-2 inline-block text-[11.5px] font-semibold text-ai hover:underline"
                                  >
                                    {t("dup.openKo")} →
                                  </Link>
                                </div>
                              </div>
                            </Modal>
                          ) : null}
                        </FindingCard>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}

// WP-IC-4 (Schritt 4+5): Gruppen-Freigabe + Übernahme mit ehrlicher Bilanz. „Gruppieren" holt die
// KI-Gruppierung (Server; ohne funktionierendes Modell kommt die ehrliche deterministische
// Themen-Gruppierung — Kennzeichnung „Ohne KI gruppiert"). Gruppen als aufklappbare Karten mit
// großen Klickflächen (iPad); der Gruppen-Entscheid ist die Vorgabe je Kandidat, Einzel-Overrides
// bleiben; „bereits importiert" ist vorab abgewählt. „Auswahl übernehmen" startet den BESTEHENDEN
// Import-Weg (Review-Queue; Review-Invariante bleibt) in Batches mit ehrlichem Fortschritt und
// endet in der Bilanz (übernommen/übersprungen/ausgeschlossen/fehlgeschlagen).
import { CheckCircle2, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { ImportApplyResponse, ImportGroupResponse, ImportSelectCriteria } from "../api/types";
import { displayImportText } from "../lib/htmlEntities";
import {
  type ApplyRunState,
  EMPTY_APPLY_RUN,
  type GroupedCandidate,
  IMPORT_GROUPS_TEXT,
  type ImportBilanz,
  type ImportGroup,
  aggregateBilanz,
  applyGroupToggle,
  buildBatches,
  groupLabelKey,
  hintLabelKey,
  includedIds,
  initialSelection,
  selectionCounts,
  toggleCandidate,
} from "../lib/importGroups";
import { toReasonerLocale } from "../lib/reasonerLocale";
import { Button } from "./ui";

// Präsentationsteil (kontrolliert, ohne Netz) — separat exportiert für den Mounted-Test.
export function GroupApprovalPanel({
  groups,
  candidates,
  selection,
  demo,
  onToggleGroup,
  onToggleCandidate,
}: {
  groups: ImportGroup[];
  candidates: GroupedCandidate[];
  selection: Record<string, boolean>;
  demo: boolean;
  onToggleGroup: (group: ImportGroup, on: boolean) => void;
  onToggleCandidate: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const counts = selectionCounts(selection);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-text">
          {t(IMPORT_GROUPS_TEXT.selectedCount, { x: counts.selected, y: counts.total })}
        </span>
        {demo ? (
          <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
            {t(IMPORT_GROUPS_TEXT.noAi)}
          </span>
        ) : (
          <span className="rounded-pill bg-ai-surface-1 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-ai">
            {t(IMPORT_GROUPS_TEXT.aiGrouped)}
          </span>
        )}
      </div>
      <div className="mt-2 space-y-2">
        {groups.map((group) => {
          const labelKey = groupLabelKey(group);
          const label = labelKey ? t(labelKey) : group.title;
          const groupOn = group.ids.some((id) => selection[id] === true);
          return (
            <details
              key={`${group.title}-${group.ids[0] ?? ""}`}
              className="rounded-card border border-hairline bg-surface"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-3">
                <ChevronDown size={16} className="shrink-0 text-muted-2" />
                <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-text">
                  {label}
                </span>
                <span className="text-[12px] text-muted-2">
                  {t(IMPORT_GROUPS_TEXT.groupCount, { n: group.ids.length })}
                </span>
                {/* Große Klickflächen (iPad): ganze Gruppe freigeben/ausschließen. */}
                <button
                  type="button"
                  aria-pressed={groupOn}
                  onClick={(e) => {
                    e.preventDefault();
                    onToggleGroup(group, true);
                  }}
                  className={`rounded-btn border px-3 py-1.5 text-[12px] font-semibold ${
                    groupOn
                      ? "border-trust-pos-fill/60 bg-trust-pos-bg text-trust-pos-text"
                      : "border-hairline bg-surface text-muted hover:text-text"
                  }`}
                >
                  {t(IMPORT_GROUPS_TEXT.approve)}
                </button>
                <button
                  type="button"
                  aria-pressed={!groupOn}
                  onClick={(e) => {
                    e.preventDefault();
                    onToggleGroup(group, false);
                  }}
                  className={`rounded-btn border px-3 py-1.5 text-[12px] font-semibold ${
                    groupOn
                      ? "border-hairline bg-surface text-muted hover:text-text"
                      : "border-trust-warn-fill/60 bg-trust-warn-bg text-trust-warn-text"
                  }`}
                >
                  {t(IMPORT_GROUPS_TEXT.exclude)}
                </button>
              </summary>
              <ul className="space-y-1 border-t border-hairline p-3">
                {group.ids.map((id) => {
                  const candidate = byId.get(id);
                  if (!candidate) {
                    return null;
                  }
                  return (
                    <li key={id} className="flex items-start gap-2 text-[12.5px] text-text">
                      <input
                        type="checkbox"
                        aria-label={displayImportText(candidate.title, candidate.textCodec)}
                        checked={selection[id] === true}
                        onChange={() => onToggleCandidate(id)}
                        className="mt-0.5 h-5 w-5 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        {displayImportText(candidate.title, candidate.textCodec)}
                      </span>
                      {/* WP-IC-6b: nüchternes Badge — Quelle wurde seit dem Import aktualisiert;
                          der Kandidat ist als Aktualisierung wählbar (neue KO-Version im Review). */}
                      {candidate.sourceNewer ? (
                        <span className="shrink-0 rounded-pill bg-ai-surface-1 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-ai">
                          {t(IMPORT_GROUPS_TEXT.hintSourceNewer)}
                        </span>
                      ) : null}
                      {candidate.hints.map((hint) => {
                        const key = hintLabelKey(hint);
                        return key ? (
                          <span
                            key={hint}
                            className="shrink-0 rounded-pill bg-page px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-2"
                          >
                            {t(key)}
                          </span>
                        ) : null;
                      })}
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}

export function ImportGroups({ criteria }: { criteria: ImportSelectCriteria }): JSX.Element {
  const { i18n, t } = useTranslation();
  const [data, setData] = useState<ImportGroupResponse | null>(null);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<"group" | "apply" | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [runState, setRunState] = useState<ApplyRunState>(EMPTY_APPLY_RUN);
  const [bilanz, setBilanz] = useState<ImportBilanz | null>(null);
  const [error, setError] = useState<string | null>(null);
  // WP-REST18 (bens Fix 2): der Snapshot hinter data.snapshotToken wurde serverseitig verdrängt —
  // in diesem Zustand gibt es NUR den Weg „Neu gruppieren" (frischer /group-Aufruf, neuer Token);
  // ein Wiederholen mit dem alten Token liefe garantiert wieder in den 409.
  const [snapshotExpired, setSnapshotExpired] = useState(false);
  // WP-RETEST7 R7 (Pedis Befund: Gruppieren nicht gefunden): nach dem Gruppieren scrollt die
  // Ansicht sanft zum Gruppen-Bereich — der Schritt darf nicht vom Scroll-Zufall abhängen.
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (data !== null && bilanz === null) {
      panelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  }, [data, bilanz]);

  const runGrouping = async (): Promise<void> => {
    setBusy("group");
    setError(null);
    setBilanz(null);
    setRunState(EMPTY_APPLY_RUN);
    setSnapshotExpired(false);
    try {
      const response = await endpoints.admin.import.group({
        criteria,
        locale: toReasonerLocale(i18n.language),
      });
      setData(response);
      setSelection(initialSelection(response.candidates));
    } catch (err) {
      // Ehrliche Meldung; der erneute Versuch nutzt serverseitig automatisch die deterministische
      // Fallback-Gruppierung, falls das Modell weiter ausfällt.
      setError(err instanceof ApiError ? err.message : t("state.error"));
    } finally {
      setBusy(null);
    }
  };

  // WP-SHIP7-FIX (Fix 3): expliziter Lauf-Zustand (attempted/transportFailed) über Batches hinweg.
  // Ein HTTP-Fehler bricht den Lauf ab: die Ids DIESES Batches gelten als fehlgeschlagen (Zustand
  // unbekannt), alle noch nicht versuchten werden ehrlich als „nicht versucht" ausgewiesen — der
  // Wiederholen-Knopf übernimmt NUR den nicht versuchten Rest (kein Doppel-Import-Risiko).
  const runApply = async (idsOverride?: readonly string[]): Promise<void> => {
    if (!data) {
      return;
    }
    const prior = idsOverride ? runState : EMPTY_APPLY_RUN;
    const ids = idsOverride ? [...idsOverride] : includedIds(selection);
    setBusy("apply");
    setError(null);
    setProgress({ done: 0, total: ids.length });
    const results = [...prior.results];
    const attempted = [...prior.attempted];
    const transportFailed = [...prior.transportFailed];
    try {
      for (const batch of buildBatches(ids)) {
        attempted.push(...batch);
        try {
          const result: ImportApplyResponse = await endpoints.admin.import.apply({
            criteria,
            includeIds: batch,
            // Snapshot-Pin: alle Batches dieses Laufs arbeiten auf der Datenbasis der Gruppierung.
            snapshotToken: data.snapshotToken,
          });
          results.push(result);
        } catch (err) {
          // WP-REST18 (bens Fix 2): SNAPSHOT_EXPIRED ist KEIN Transportfehler — der alte Token
          // liefe bei jedem Wiederholen wieder in den 409. Lauf kontrolliert beenden, kompletten
          // Gruppierungs-Zustand zurücksetzen und NUR den Weg „Neu gruppieren" anbieten.
          if (err instanceof ApiError && err.code === "SNAPSHOT_EXPIRED") {
            setData(null);
            setSelection({});
            setRunState(EMPTY_APPLY_RUN);
            setBilanz(null);
            setSnapshotExpired(true);
            return;
          }
          transportFailed.push(...batch);
          setError(err instanceof ApiError ? err.message : t("state.error"));
          break; // Rest bleibt „nicht versucht" — der Wiederholen-Knopf übernimmt ihn.
        }
        setProgress((prev) => ({
          done: Math.min((prev?.done ?? 0) + batch.length, ids.length),
          total: ids.length,
        }));
      }
    } finally {
      setBusy(null);
      setProgress(null);
    }
    const nextRun: ApplyRunState = { results, attempted, transportFailed };
    setRunState(nextRun);
    setBilanz(aggregateBilanz(data.candidates, selection, nextRun));
  };

  const counts = selectionCounts(selection);

  return (
    <div className="mt-3 border-t border-hairline pt-3">
      {snapshotExpired ? (
        // WP-REST18 (Fix 2): handlungsfähiger Zustand — klare Meldung + prominenter Neustart des
        // Gruppierungs-Flows. Der alte Token existiert hier nicht mehr (data wurde zurückgesetzt).
        <div className="space-y-2">
          <p className="rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text">
            {t(IMPORT_GROUPS_TEXT.expired)}
          </p>
          <Button variant="primary" disabled={busy !== null} onClick={() => void runGrouping()}>
            {busy === "group" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Sparkles size={15} />
            )}
            {busy === "group" ? t(IMPORT_GROUPS_TEXT.grouping) : t(IMPORT_GROUPS_TEXT.regroup)}
          </Button>
        </div>
      ) : null}

      {data === null && !snapshotExpired ? (
        // WP-RETEST7 R7: UNÜBERSEHBARER Primär-CTA direkt unter der Vorschau — große Klickfläche,
        // volle Breite; der nächste Schritt (Gruppieren & Übernehmen) ist damit explizit benannt.
        <Button
          variant="primary"
          className="w-full py-3 text-[14px]"
          disabled={busy === "group"}
          onClick={() => void runGrouping()}
        >
          {busy === "group" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {busy === "group" ? t(IMPORT_GROUPS_TEXT.grouping) : t(IMPORT_GROUPS_TEXT.cta)}
        </Button>
      ) : null}

      {error ? (
        <div className="mt-2">
          <p className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
            {error}
          </p>
          {data === null ? (
            <Button variant="ghost" disabled={busy !== null} onClick={() => void runGrouping()}>
              {t(IMPORT_GROUPS_TEXT.retry)}
            </Button>
          ) : null}
        </div>
      ) : null}

      {data !== null && bilanz === null ? (
        <div ref={panelRef}>
          <GroupApprovalPanel
            groups={data.groups}
            candidates={data.candidates}
            selection={selection}
            demo={data.demo}
            onToggleGroup={(group, on) => setSelection((prev) => applyGroupToggle(prev, group, on))}
            onToggleCandidate={(id) => setSelection((prev) => toggleCandidate(prev, id))}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              disabled={busy !== null || counts.selected === 0}
              onClick={() => void runApply()}
            >
              {busy === "apply" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              {t(IMPORT_GROUPS_TEXT.applyCta, { n: counts.selected })}
            </Button>
            {progress ? (
              <span className="text-[12.5px] text-muted">
                {t(IMPORT_GROUPS_TEXT.applying, { x: progress.done, y: progress.total })}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {bilanz !== null ? (
        <div className="mt-3 rounded-card border border-hairline bg-page p-3">
          <p className="text-[13px] font-semibold text-text">{t(IMPORT_GROUPS_TEXT.bilanzTitle)}</p>
          <ul className="mt-1.5 space-y-0.5 text-[12.5px] text-text">
            <li>· {t(IMPORT_GROUPS_TEXT.bilanzImported, { n: bilanz.imported })}</li>
            {bilanz.updates > 0 ? (
              <li className="pl-3 text-muted">
                {t(IMPORT_GROUPS_TEXT.bilanzUpdates, { n: bilanz.updates })}
              </li>
            ) : null}
            <li>· {t(IMPORT_GROUPS_TEXT.bilanzQueued, { n: bilanz.alreadyQueued })}</li>
            <li>· {t(IMPORT_GROUPS_TEXT.bilanzSkipped, { n: bilanz.skippedAlreadyImported })}</li>
            <li>· {t(IMPORT_GROUPS_TEXT.bilanzExcluded, { n: bilanz.excluded })}</li>
            <li>· {t(IMPORT_GROUPS_TEXT.bilanzFailed, { n: bilanz.failed.length })}</li>
            {bilanz.notAttempted.length > 0 ? (
              <li>
                · {t(IMPORT_GROUPS_TEXT.bilanzNotAttempted, { n: bilanz.notAttempted.length })}
              </li>
            ) : null}
          </ul>
          {bilanz.failed.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-trust-crit-text">
              {bilanz.failed.map((f) => (
                <li key={f.id}>
                  · {f.id} —{" "}
                  {f.reason === "not-found"
                    ? t(IMPORT_GROUPS_TEXT.failNotFound)
                    : f.reason === "http-error"
                      ? t(IMPORT_GROUPS_TEXT.failHttp)
                      : f.reason}
                </li>
              ))}
            </ul>
          ) : null}
          {bilanz.notAttempted.length > 0 ? (
            <div className="mt-2">
              <Button
                variant="ghost"
                disabled={busy !== null}
                onClick={() => void runApply(bilanz.notAttempted)}
              >
                {t(IMPORT_GROUPS_TEXT.retryRest, { n: bilanz.notAttempted.length })}
              </Button>
            </div>
          ) : null}
          <p className="mt-2 text-[12px] text-muted-2">{t(IMPORT_GROUPS_TEXT.bilanzReview)}</p>
        </div>
      ) : null}
    </div>
  );
}

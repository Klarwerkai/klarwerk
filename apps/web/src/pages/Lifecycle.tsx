import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { useKos, useLearningPath, useLearningProgress, useLifecyclePending } from "../api/hooks";
import { useSession } from "../app/AuthContext";
import { StatusPill } from "../components/trust";
import { Button, Card, PageHeader, QueryState, SectionLabel } from "../components/ui";
import { completedCount, isStepDone, progressPercent } from "../lib/learningPath";
import { revalidationView } from "../lib/revalidation";

export function Lifecycle(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user } = useSession();
  const role = user?.role ?? "viewer";

  const query = useLifecyclePending();
  const kos = useKos();
  const path = useLearningPath(role);
  const pathId = path.data?.id;
  const progress = useLearningProgress(pathId);
  const done = progress.data ?? [];

  const confirm = useMutation({
    mutationFn: (id: string) => endpoints.ko.act(id, { action: "revalidate" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["lifecycle"] }),
  });

  // SCRUM-146: Asset-Change-Auslöser → markiert gekoppelte KOs „prüfen".
  const [assetRef, setAssetRef] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const assetChanged = useMutation({
    mutationFn: (ref: string) => endpoints.lifecycle.assetChanged(ref),
    onSuccess: (ids) => {
      void qc.invalidateQueries({ queryKey: ["lifecycle"] });
      setNote(t("lcy.assetMarked", { n: ids.length, asset: assetRef.trim() }));
      setAssetRef("");
    },
    onError: () => setNote(t("state.error")),
  });

  // SCRUM-145: Lernpfad-Schritt abhaken (Fortschritt serverseitig).
  const complete = useMutation({
    mutationFn: (stepId: string) => endpoints.learningPaths.complete(pathId ?? "", stepId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["learning-progress", pathId] }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader kicker={t("lcy.kicker")} title={t("nav.lifecycle")} />

      {/* SCRUM-146: Anlagenänderung melden → Revalidierung anstoßen */}
      <div>
        <SectionLabel>{t("lcy.assetTitle")}</SectionLabel>
        <Card className="space-y-2">
          <p className="text-[13px] text-muted">{t("lcy.assetHint")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={assetRef}
              onChange={(e) => setAssetRef(e.target.value)}
              placeholder={t("lcy.assetPlaceholder")}
              className="h-9 min-w-[12rem] flex-1 rounded-input border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
            />
            <Button
              variant="primary"
              disabled={assetChanged.isPending || assetRef.trim().length === 0}
              onClick={() => assetChanged.mutate(assetRef.trim())}
            >
              {t("lcy.assetTrigger")}
            </Button>
          </div>
          {note ? <p className="text-[12.5px] text-trust-warn-text">{note}</p> : null}
        </Card>
      </div>

      {/* Pending-Revalidierung (bestehend, unverändert) */}
      <div>
        <SectionLabel>{t("lcy.pendingTitle")}</SectionLabel>
        <div className="mb-3 rounded-card border border-trust-warn-fill/30 bg-trust-warn-bg p-3 text-[13px] text-trust-warn-text">
          {t("lcy.banner")}
        </div>
        <QueryState query={query} emptyText={t("lcy.empty")}>
          {(ids) => (
            <div className="space-y-3">
              {ids.map((id) => {
                // SCRUM-254: ID gegen geladenen Bestand auflösen → Titel, Anlagenbezug, Status, Schritt.
                const view = revalidationView(id, kos.data ?? []);
                return (
                  <Card key={id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <StatusPill status="revalidierung" />
                        {view.asset ? (
                          <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-2">
                            {t("lcy.revalAsset")}: {view.asset}
                          </span>
                        ) : null}
                      </div>
                      <Link
                        to={`/wissen/${id}`}
                        className="block truncate text-[13.5px] font-medium text-text hover:text-ink"
                      >
                        {view.title}
                      </Link>
                      {/* SCRUM-254: ehrliche nächste Handlung + Hinweis, wenn Details fehlen. */}
                      <div className="mt-0.5 text-[11.5px] text-muted">
                        <span className="font-mono uppercase tracking-wider text-muted-2">
                          {t("lcy.revalNextLabel")}:
                        </span>{" "}
                        {t(`lcy.revalNext.${view.nextStep}`)}
                      </div>
                      {!view.found ? (
                        <div className="mt-0.5 text-[11px] text-trust-warn-text">
                          {t("lcy.revalMissing")}
                        </div>
                      ) : null}
                    </div>
                    <Button
                      variant="primary"
                      disabled={confirm.isPending}
                      onClick={() => confirm.mutate(id)}
                    >
                      {t("lcy.stillValid")}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </QueryState>
      </div>

      {/* SCRUM-145: Rollenspezifischer Lernpfad */}
      <div>
        <SectionLabel>{t("lcy.pathTitle", { role: t(`role.name.${role}`) })}</SectionLabel>
        {path.isLoading ? (
          <Card className="text-center text-sm text-muted">{t("state.loading")}</Card>
        ) : path.data ? (
          <Card className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-page">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${progressPercent(path.data, done)}%` }}
                />
              </div>
              <span className="font-mono text-[11px] text-muted-2">
                {completedCount(path.data, done)}/{path.data.steps.length}
              </span>
            </div>
            <ol className="space-y-2">
              {path.data.steps.map((step, i) => {
                const stepDone = isStepDone(done, step.id);
                return (
                  <li key={step.id} className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={stepDone || complete.isPending}
                      onClick={() => complete.mutate(step.id)}
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-btn border ${
                        stepDone
                          ? "border-trust-pos-fill bg-trust-pos-bg text-trust-pos-text"
                          : "border-hairline text-muted hover:bg-hairline-soft"
                      }`}
                      title={stepDone ? t("lcy.stepDone") : t("lcy.stepComplete")}
                    >
                      {stepDone ? (
                        <Check size={14} />
                      ) : (
                        <span className="text-[11px]">{i + 1}</span>
                      )}
                    </button>
                    <span
                      className={`text-[13.5px] ${
                        stepDone ? "text-muted line-through" : "text-text"
                      }`}
                    >
                      {step.title}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>
        ) : (
          <Card className="border-dashed text-center text-sm text-muted">{t("lcy.pathEmpty")}</Card>
        )}
      </div>
    </div>
  );
}

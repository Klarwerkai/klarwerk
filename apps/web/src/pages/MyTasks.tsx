import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  useAudit,
  useConflicts,
  useDirectory,
  useGaps,
  useKos,
  useLifecyclePending,
  useValidationBoard,
} from "../api/hooks";
import { useSession } from "../app/AuthContext";
import { EmptyStateCtas } from "../components/EmptyStateCtas";
import { KoAuthorLine } from "../components/trust";
import { Card, PageHeader } from "../components/ui";
import { type KoAuthorParts, koAuthorParts } from "../lib/koAuthor";
import { reworkHref } from "../lib/reviewReworkContext";
import { type ReviewWorkTone, type ReviewWorkView, reviewWorkView } from "../lib/reviewSignals";
import { type TaskTone, knowledgeOsPhase, phaseLabelKey, taskAction } from "../lib/taskAction";
import {
  TASK_FILTERS,
  type TaskFilterKey,
  countTasksByFilter,
  filterTasks,
} from "../lib/taskFilters";
import { returnedToAuthor } from "../lib/validationStatus";
import { type WorkSeverity, groupTasks, severityForType } from "../lib/workCenter";

// SCRUM-260: Tönung der sichtbaren nächsten Handlung je Aufgabe (passend zur Dringlichkeit).
const ACTION_TONE: Record<TaskTone, string> = {
  crit: "text-trust-crit-text",
  warn: "text-trust-warn-text",
  neutral: "text-muted",
};

// SCRUM-287: Tönung des Review-Arbeitszustands (neu/offen, zugewiesen, in Prüfung).
const REVIEW_WORK_TONE: Record<ReviewWorkTone, string> = {
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
  pos: "bg-trust-pos-bg text-trust-pos-text",
};

interface Task {
  id: string;
  label: string;
  typeKey: string;
  to: string;
  // SCRUM-247: Dringlichkeit aus der Quelle abgeleitet (DOM-freier Helper) → testbare Gruppierung.
  severity: WorkSeverity;
  // FR-LIF-04: Autor sichtbar, wo ein KO hinter der Aufgabe steht.
  author?: KoAuthorParts;
  // SCRUM-287: Review-Zustand nur bei Validierungsaufgaben (DOM-frei aus KO-Feldern).
  review?: ReviewWorkView;
}

// Aufgabe mit aus dem typeKey abgeleiteter Severity bauen (eine Quelle der Wahrheit).
function task(input: Omit<Task, "severity">): Task {
  return { ...input, severity: severityForType(input.typeKey) };
}

export function MyTasks(): JSX.Element {
  const { t } = useTranslation();
  const board = useValidationBoard();
  const conflicts = useConflicts();
  const lifecycle = useLifecyclePending();
  const gaps = useGaps();
  const audit = useAudit();
  const kos = useKos();
  const dir = useDirectory();
  const { user } = useSession();

  const nameOf = (uid: string): string => dir.data?.find((d) => d.id === uid)?.name || uid;
  // SCRUM-124: KOs, die mir (als Autor) nach Gelb/Rot zur Nacharbeit zurückgegeben wurden.
  const kosById = new Map((kos.data ?? []).map((k) => [k.id, k]));
  const authorOf = (koId: string): KoAuthorParts | undefined => {
    const ko = kosById.get(koId);
    return ko ? koAuthorParts(ko, nameOf) : undefined;
  };
  // SCRUM-247: alle echten Signale zu EINER flachen Aufgabenliste (Quelle → Severity) verdichten,
  // danach über den DOM-freien Helper nach Dringlichkeit gruppieren (kein Vermischen der Arten).
  const tasks: Task[] = [
    ...(user
      ? returnedToAuthor(audit.data ?? [], kos.data ?? [], user.id).map((r) =>
          task({
            id: `rw-${r.koId}`,
            label: kosById.get(r.koId)?.title ?? r.koId,
            typeKey: "task.returned",
            // SCRUM-351: in den FOKUSSIERTEN Rework-Kontext führen (Feedback + geordnete Schritte),
            // nicht auf die nackte KO-Detailseite — so wird Review → Rework → Validation ein Fluss.
            to: reworkHref(r.koId),
            author: authorOf(r.koId),
          }),
        )
      : []),
    ...(conflicts.data ?? [])
      .filter((c) => c.status !== "geloest")
      .map((c) =>
        task({ id: c.id, label: c.description, typeKey: "task.conflict", to: "/konflikte" }),
      ),
    ...(board.data ?? []).map((k) =>
      task({
        id: k.id,
        label: k.title,
        typeKey: "task.validation",
        to: `/wissen/${k.id}`,
        author: koAuthorParts(k, nameOf),
        review: reviewWorkView(k),
      }),
    ),
    ...(lifecycle.data ?? []).map((id) =>
      task({
        id: `lc-${id}`,
        label: kosById.get(id)?.title ?? id,
        typeKey: "task.revalidation",
        to: "/lebenszyklus",
        author: authorOf(id),
      }),
    ),
    ...(gaps.data ?? [])
      .filter((g) => g.status === "offen")
      .map((g) => task({ id: g.id, label: g.question, typeKey: "task.gap", to: "/risiko" })),
  ];
  const grouped = groupTasks(tasks);

  const groups: Array<{ key: string; tone: string; items: Task[] }> = [
    {
      key: "task.critical",
      tone: "bg-trust-crit-bg text-trust-crit-text",
      items: grouped.critical,
    },
    { key: "task.today", tone: "bg-trust-warn-bg text-trust-warn-text", items: grouped.today },
    { key: "task.later", tone: "bg-page text-muted", items: grouped.later },
  ];

  // SCRUM-158: Typ-Filter über alle Gruppen; ehrliche Zähler je Chip.
  const [taskFilter, setTaskFilter] = useState<TaskFilterKey>("all");
  const counts = countTasksByFilter(tasks);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader kicker={t("task.kicker")} title={t("nav.tasks")} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TASK_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setTaskFilter(f.key)}
            className={`rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold ${
              taskFilter === f.key
                ? "border-ink bg-ink text-white"
                : "border-hairline text-muted hover:text-text"
            }`}
          >
            {t(`task.filter.${f.key}`)} · {counts[f.key]}
          </button>
        ))}
      </div>
      <div className="space-y-6">
        {groups.map((g) => {
          const visible = filterTasks(g.items, taskFilter);
          return (
            <div key={g.key}>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`rounded-pill px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase ${g.tone}`}
                >
                  {t(g.key)}
                </span>
                <span className="text-[12px] text-muted-2">{visible.length}</span>
              </div>
              <Card className="p-0">
                {visible.length === 0 ? (
                  <div className="p-4">
                    <p className="text-sm text-muted">
                      {taskFilter === "all" ? t("task.none") : t("task.noneFiltered")}
                    </p>
                    {taskFilter === "all" ? <EmptyStateCtas context="tasks" /> : null}
                  </div>
                ) : (
                  <div className="divide-y divide-hairline">
                    {visible.map((it) => {
                      // SCRUM-260: sichtbare nächste Handlung je Aufgabe (DOM-freier Helper).
                      const action = taskAction(it.typeKey);
                      return (
                        <Link
                          key={it.id}
                          to={it.to}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-hairline-soft"
                        >
                          <span className="flex shrink-0 flex-col items-start gap-1">
                            <span className="rounded-pill border border-hairline px-2 py-0.5 font-mono text-[10.5px] text-muted">
                              {t(it.typeKey)}
                            </span>
                            {/* SCRUM-297: Knowledge-OS-Phase (Erfassen/Validieren/Aktuell halten) — gleiche Kreis-Sprache wie Start. */}
                            <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-2">
                              {t("task.phaseLabel")}{" "}
                              {t(phaseLabelKey(knowledgeOsPhase(it.typeKey)))}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] text-text">
                              {it.label}
                            </span>
                            {/* Pedi 05.07.: Klartext „was ist zu tun" — die Karte war nicht
                                selbsterklärend. Ein Satz, direkt unter dem Titel. */}
                            <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-2">
                              {t(action.explainKey)}
                            </span>
                            {it.author ? <KoAuthorLine {...it.author} /> : null}
                            {it.review ? (
                              <span
                                className={`mt-1 inline-flex rounded-pill px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${REVIEW_WORK_TONE[it.review.tone]}`}
                              >
                                {t(it.review.labelKey)}
                              </span>
                            ) : null}
                          </span>
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold ${ACTION_TONE[action.tone]}`}
                          >
                            {t(action.actionLabelKey)} <span aria-hidden="true">→</span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}

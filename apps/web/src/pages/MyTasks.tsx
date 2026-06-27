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
import {
  TASK_FILTERS,
  type TaskFilterKey,
  countTasksByFilter,
  filterTasks,
} from "../lib/taskFilters";
import { returnedToAuthor } from "../lib/validationStatus";

interface Task {
  id: string;
  label: string;
  typeKey: string;
  to: string;
  // FR-LIF-04: Autor sichtbar, wo ein KO hinter der Aufgabe steht.
  author?: KoAuthorParts;
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
  const returned: Task[] = user
    ? returnedToAuthor(audit.data ?? [], kos.data ?? [], user.id).map((r) => ({
        id: `rw-${r.koId}`,
        label: kosById.get(r.koId)?.title ?? r.koId,
        typeKey: "task.returned",
        to: `/wissen/${r.koId}`,
        author: authorOf(r.koId),
      }))
    : [];

  const critical: Task[] = [
    ...returned,
    ...(conflicts.data ?? [])
      .filter((c) => c.status !== "geloest")
      .map((c) => ({ id: c.id, label: c.description, typeKey: "task.conflict", to: "/konflikte" })),
  ];
  const today: Task[] = [
    ...(board.data ?? []).map((k) => ({
      id: k.id,
      label: k.title,
      typeKey: "task.validation",
      to: `/wissen/${k.id}`,
      author: koAuthorParts(k, nameOf),
    })),
    ...(lifecycle.data ?? []).map((id) => ({
      id: `lc-${id}`,
      label: kosById.get(id)?.title ?? id,
      typeKey: "task.revalidation",
      to: "/lebenszyklus",
      author: authorOf(id),
    })),
  ];
  const later: Task[] = (gaps.data ?? [])
    .filter((g) => g.status === "offen")
    .map((g) => ({ id: g.id, label: g.question, typeKey: "task.gap", to: "/risiko" }));

  const groups: Array<{ key: string; tone: string; items: Task[] }> = [
    { key: "task.critical", tone: "bg-trust-crit-bg text-trust-crit-text", items: critical },
    { key: "task.today", tone: "bg-trust-warn-bg text-trust-warn-text", items: today },
    { key: "task.later", tone: "bg-page text-muted", items: later },
  ];

  // SCRUM-158: Typ-Filter über alle Gruppen; ehrliche Zähler je Chip.
  const [taskFilter, setTaskFilter] = useState<TaskFilterKey>("all");
  const counts = countTasksByFilter([...critical, ...today, ...later]);

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
                    {visible.map((it) => (
                      <Link
                        key={it.id}
                        to={it.to}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-hairline-soft"
                      >
                        <span className="rounded-pill border border-hairline px-2 py-0.5 font-mono text-[10.5px] text-muted">
                          {t(it.typeKey)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] text-text">{it.label}</span>
                          {it.author ? <KoAuthorLine {...it.author} /> : null}
                        </span>
                      </Link>
                    ))}
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

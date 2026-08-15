import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  useAudit,
  useConflicts,
  useGaps,
  useKos,
  useLifecyclePending,
  useValidationBoard,
} from "../api/hooks";
import { useSession } from "../app/AuthContext";
import { EmptyStateCtas } from "../components/EmptyStateCtas";
import { KoAuthorLine } from "../components/trust";
import { Card, PageHeader } from "../components/ui";
import { gapLocaleTag } from "../lib/gapLocaleTag";
import { type KoAuthorParts, koAuthorParts } from "../lib/koAuthor";
import { reworkHref } from "../lib/reviewReworkContext";
import { type ReviewWorkTone, type ReviewWorkView, reviewWorkView } from "../lib/reviewSignals";
import { type TaskTone, knowledgeOsPhase, phaseLabelKey, taskAction } from "../lib/taskAction";
import {
  TASK_FILTERS,
  type TaskFilterKey,
  countTasksByFilter,
  filterTasks,
  isOpenGap,
  isUnresolvedConflict,
} from "../lib/taskFilters";
import { useAuthorName } from "../lib/useAuthorName";
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
  // GAP-SPRACHHERKUNFT: Sprachname einer fremdsprachigen Wissenslücke. BEWUSST ein eigenes Feld
  // und kein Anhang an `label`: Der Titel wird einzeilig gekürzt (`truncate`), und ein angehängtes
  // Etikett fiele als Erstes weg — ausgerechnet bei den langen Titeln, für die es gebaut wurde.
  localeTag?: string;
}

// Aufgabe mit aus dem typeKey abgeleiteter Severity bauen (eine Quelle der Wahrheit).
function task(input: Omit<Task, "severity">): Task {
  return { ...input, severity: severityForType(input.typeKey) };
}

export function MyTasks(): JSX.Element {
  const { t, i18n } = useTranslation();
  const board = useValidationBoard();
  const conflicts = useConflicts();
  const lifecycle = useLifecyclePending();
  const gaps = useGaps();
  const audit = useAudit();
  const kos = useKos();
  const { user } = useSession();

  // AUFTRAG-mega62 Block H: die Auflösung kommt aus dem EINEN Haken (lib/useAuthorName.ts). Die
  // abgeschriebene Zeile hier sagte „Unbekannte Person", sobald das Verzeichnis nur NICHT DA war —
  // eine Aussage über die Person, wo gar keine feststand.
  const nameOf = useAuthorName();
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
            // CWDFEST/EXACTOPTIONAL: `authorOf` liefert `KoAuthorParts | undefined`, und
            // `exactOptionalPropertyTypes` (aktiv im Gate `./tools/check`, NICHT im blossen
            // `tsc --noEmit` der Wurzel) verbietet, `undefined` ausdruecklich an ein optionales
            // Feld zu uebergeben. Deshalb weglassen statt undefined setzen.
            ...(authorOf(r.koId) ? { author: authorOf(r.koId) as KoAuthorParts } : {}),
          }),
        )
      : []),
    // SCHEIBE D-019b: dieselbe Regel wie der Seitenleisten-Zähler, aus derselben Quelle. Hier stand
    // `c.status !== "geloest"` als eigener Ausdruck — dieselbe Aussage, zweimal geschrieben. Genau
    // daraus entstand der Befund von JOB 690 („54" in der Leiste, „57" auf der Seite): zwei Kopien
    // driften auseinander, sobald eine von beiden nachgezogen wird und die andere nicht.
    ...(conflicts.data ?? [])
      .filter(isUnresolvedConflict)
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
        ...(authorOf(id) ? { author: authorOf(id) as KoAuthorParts } : {}),
      }),
    ),
    // FUNKE-FIX2 P0 (bens Erforderlich 3): /aufgaben ist ab Rolle experte erreichbar — ohne Detail-
    // Berechtigung liefert der Server den Fragetext redigiert (g.redacted); dann NUR eine neutrale
    // Aufgabenbezeichnung statt des Freitextes (der Volltext erscheint nur für Berechtigte).
    // GAP-SPRACHHERKUNFT: Der Fragetext behält die Sprache seiner Quelle — kommt die Frage über
    // das Word-Add-in aus einem englischen Dokument, steht ein englischer Titel in der deutschen
    // Liste und liest sich wie ein Fehler. Übersetzt wird er nicht (er ist der Beleg der
    // Originalfrage); stattdessen benennt ein Etikett die Herkunft. Gleiche Sprache und
    // Altbestände ohne Angabe bekommen keins (siehe lib/gapLocaleTag).
    // SCHEIBE D-019b: wie oben — `g.status === "offen"` stand hier abgeschrieben. Bei Lücken ist die
    // Positivform richtig (der Typ kennt genau `offen | geschlossen`); dass sie es ist, steht jetzt
    // an EINER Stelle begründet (lib/taskFilters.ts) statt hier stillschweigend vorausgesetzt.
    ...(gaps.data ?? []).filter(isOpenGap).map((g) => {
      const sprache = gapLocaleTag(g.locale, i18n.language);
      return task({
        id: g.id,
        label: g.redacted ? t("task.gapRedacted") : g.question,
        typeKey: "task.gap",
        to: "/risiko",
        ...(sprache ? { localeTag: sprache } : {}),
      });
    }),
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
      <PageHeader kicker={t("task.kicker")} title={t("nav.tasks")} pageKey="aufgaben" />
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
                            {/* GAP-SPRACHHERKUNFT: Titel und Etikett sind GESCHWISTER, nicht
                                verschachtelt. Der Titel kürzt (`truncate`, `min-w-0`), das Etikett
                                bleibt (`shrink-0`). Als Textanhang im Titel wäre es genau bei den
                                langen Titeln weggeschnitten worden, für die es gedacht ist. */}
                            <span className="flex items-baseline gap-1.5">
                              <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">
                                {it.label}
                              </span>
                              {it.localeTag ? (
                                <span className="shrink-0 rounded-pill border border-hairline px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                                  {it.localeTag}
                                </span>
                              ) : null}
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

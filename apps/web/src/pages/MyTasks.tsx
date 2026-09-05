import { ChevronRight, Info } from "lucide-react";
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
import { PageHeader } from "../components/ui";
import { gapLocaleTag } from "../lib/gapLocaleTag";
import { type KoAuthorParts, koAuthorParts } from "../lib/koAuthor";
import { reworkHref } from "../lib/reviewReworkContext";
import { type ReviewWorkView, reviewWorkView } from "../lib/reviewSignals";
import { knowledgeOsPhase, phaseLabelKey, taskAction } from "../lib/taskAction";
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

// ================================================================================================
// JOB 3064 · H5 — „MEINE AUFGABEN" IN DER ZEILENFORM DER STARTSEITE.
// ================================================================================================
// Bis hierher trug jede Aufgabe VIER Pillen (Typ, Phase, Sprache, Häufigkeit), einen Erklärsatz,
// eine Autorenzeile und eine Review-Plakette — sechs Textebenen je Zeile, und darüber sechs
// Filter-Pillen in Monoschrift. Das ist dieselbe Textwand, die Pedi am 04.09. auf der Startseite
// unmöglich nannte.
//
// Ab hier gilt die Zeile des Zielbilds (`design/klarwerk/Main.dc.html` Z.47–52): Zustandspunkt,
// Titel, EINE Meta-Zeile, Chevron. NICHTS ist gestrichen — jede der sechs Angaben steht weiter da:
//   · Typ, Phase, Sprache und Häufigkeit stehen in der EINEN Meta-Zeile (12,5 px) statt in vier
//     Pillen; Autor und Review-Zustand hängen sichtbar hinten an.
//   · Der Erklärsatz („was ist zu tun") liegt hinter dem Info-Symbol: als `title` für die Maus UND
//     als aufklappbarer Text für Tastatur und Vorleseprogramm (`aria-expanded`, echter Knopf).
//   · Die sechs Filter sind EIN Segment mit ihren echten Zählern statt sechs Monopillen.
//   · Der Leerzustand ist eine Zeile („Nichts offen.") plus der Knopf „Wie geht es weiter?", hinter
//     dem die bestehenden `EmptyStateCtas` liegen.
//
// Gemessen: `tests/design/h5-funktionsinventar.test.ts` (Info-Symbol öffnet den Erklärsatz, Knopf
// öffnet die CTAs) und die bestehenden Aufgaben-Tests, die auf denselben Wortlauten stehen.

const GRUPPEN_PUNKT: Record<WorkSeverity, string> = {
  critical: "bg-trust-crit-fill",
  today: "bg-trust-warn-fill",
  later: "bg-trust-pos-fill",
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
  // GAP-SPRACHHERKUNFT: Sprachname einer fremdsprachigen Wissenslücke.
  localeTag?: string;
  // JOB 1111 / D-032: wie oft dieselbe Frage zu dieser Lücke geführt hat. Nur ab zwei.
  askCount?: number;
}

// Aufgabe mit aus dem typeKey abgeleiteter Severity bauen (eine Quelle der Wahrheit).
function task(input: Omit<Task, "severity">): Task {
  return { ...input, severity: severityForType(input.typeKey) };
}

/**
 * Der Erklärsatz je Aufgabe — Tooltip für die Maus, aufklappbarer Text für alle anderen.
 *
 * Der Satz bleibt IM DOM, auch wenn er zu ist: `hidden` nimmt ihn aus dem Fluss, aus `innerText`
 * und aus dem Zugänglichkeitsbaum, aber er bleibt an SEINER Zeile gebunden. Ein nachträglich
 * gerenderter Satz an anderer Stelle wäre ein zweiter Ort für dieselbe Aussage.
 */
function ErklaerKnopf({ satz }: { satz: string }): JSX.Element {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-testid="task-erklaerung-knopf"
        aria-expanded={offen}
        aria-label={t("task.erklaerung")}
        title={satz}
        onClick={() => setOffen((v) => !v)}
        className={`shrink-0 rounded-btn p-0.5 transition-colors ${
          offen ? "text-brand-text" : "text-muted-2 hover:text-text"
        }`}
      >
        <Info size={14} aria-hidden="true" />
      </button>
      <p
        data-testid="task-erklaerung"
        hidden={!offen}
        className="basis-full pl-5 text-[12.5px] leading-relaxed text-muted-2"
      >
        {satz}
      </p>
    </>
  );
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

  // AUFTRAG-mega62 Block H: die Auflösung kommt aus dem EINEN Haken (lib/useAuthorName.ts).
  const nameOf = useAuthorName();
  // SCRUM-124: KOs, die mir (als Autor) nach Gelb/Rot zur Nacharbeit zurückgegeben wurden.
  const kosById = new Map((kos.data ?? []).map((k) => [k.id, k]));
  const authorOf = (koId: string): KoAuthorParts | undefined => {
    const ko = kosById.get(koId);
    return ko ? koAuthorParts(ko, nameOf) : undefined;
  };
  // SCRUM-247: alle echten Signale zu EINER flachen Aufgabenliste verdichten.
  const tasks: Task[] = [
    ...(user
      ? returnedToAuthor(audit.data ?? [], kos.data ?? [], user.id).map((r) =>
          task({
            id: `rw-${r.koId}`,
            label: kosById.get(r.koId)?.title ?? r.koId,
            typeKey: "task.returned",
            // SCRUM-351: in den FOKUSSIERTEN Rework-Kontext führen, nicht auf die nackte Detailseite.
            to: reworkHref(r.koId),
            // CWDFEST/EXACTOPTIONAL: `exactOptionalPropertyTypes` verbietet ein ausdrückliches
            // `undefined` an einem optionalen Feld — deshalb weglassen statt undefined setzen.
            ...(authorOf(r.koId) ? { author: authorOf(r.koId) as KoAuthorParts } : {}),
          }),
        )
      : []),
    // SCHEIBE D-019b: dieselbe Regel wie der Seitenleisten-Zähler, aus derselben Quelle.
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
    // FUNKE-FIX2 P0: ohne Detail-Berechtigung liefert der Server den Fragetext redigiert.
    // GAP-SPRACHHERKUNFT: der Fragetext behält die Sprache seiner Quelle; ein Etikett benennt sie.
    ...(gaps.data ?? []).filter(isOpenGap).map((g) => {
      const sprache = gapLocaleTag(g.locale, i18n.language);
      return task({
        id: g.id,
        label: g.redacted ? t("task.gapRedacted") : g.question,
        typeKey: "task.gap",
        to: "/risiko",
        ...(sprache ? { localeTag: sprache } : {}),
        // JOB 1111 / D-032: erst ab zwei — eine „1×" wäre Rauschen.
        ...(typeof g.askCount === "number" && g.askCount > 1 ? { askCount: g.askCount } : {}),
      });
    }),
  ];
  const grouped = groupTasks(tasks);

  const groups: Array<{ key: string; severity: WorkSeverity; items: Task[] }> = [
    { key: "task.critical", severity: "critical", items: grouped.critical },
    { key: "task.today", severity: "today", items: grouped.today },
    { key: "task.later", severity: "later", items: grouped.later },
  ];

  // SCRUM-158: Typ-Filter über alle Gruppen; ehrliche Zähler je Segment.
  const [taskFilter, setTaskFilter] = useState<TaskFilterKey>("all");
  const counts = countTasksByFilter(tasks);
  // §4: der Weg aus dem Leerzustand liegt hinter EINEM Knopf, nicht als Textblock daneben.
  const [wieWeiter, setWieWeiter] = useState(false);

  // KORREKTURPFLICHT 3 (Ben, Runde 3): der Leerzustand hängt am GESAMTEN gefilterten Bestand, nicht
  // an der einzelnen Dringlichkeitsgruppe. Vorher stand er INNERHALB der Gruppenschleife: eine
  // einzige kritische Aufgabe erzeugte daneben zwei „Nichts offen."-Zeilen mit zwei
  // „Wie geht es weiter?"-Knöpfen (Bens Messung: `expected 2 to be +0`). Eine leere Gruppe ist
  // keine Nachricht — sie entfällt samt Kicker; „nichts offen" ist eine Aussage über die LISTE.
  const sichtbareGruppen = groups
    .map((g) => ({ ...g, visible: filterTasks(g.items, taskFilter) }))
    .filter((g) => g.visible.length > 0);
  const gesamtSichtbar = sichtbareGruppen.reduce((n, g) => n + g.visible.length, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("nav.tasks")} pageKey="aufgaben" />
      {/* §4: EIN Segment statt sechs Monopillen — die Zähler bleiben, die Schrift wird Fließtext. */}
      <fieldset
        aria-label={t("task.kicker")}
        className="mb-5 inline-flex flex-wrap rounded-btn border border-hairline bg-surface p-0.5"
      >
        {TASK_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={taskFilter === f.key}
            onClick={() => setTaskFilter(f.key)}
            className={`rounded-btn px-3 py-1 text-[12.5px] transition-colors ${
              taskFilter === f.key
                ? "bg-ink font-semibold text-white"
                : "text-muted hover:text-text"
            }`}
          >
            {t(`task.filter.${f.key}`)} {counts[f.key]}
          </button>
        ))}
      </fieldset>
      <div className="space-y-6">
        {gesamtSichtbar === 0 ? (
          // GENAU EINE Zeile für die ganze Liste — und der Weg dahinter bleibt derselbe Knopf mit
          // denselben `EmptyStateCtas`. Beim gefilterten Leerstand nennt der Satz den Filter als
          // Grund; ein „Wie geht es weiter?" wäre dort die falsche Auskunft, denn offen ist etwas,
          // nur nicht in dieser Auswahl.
          <div className="overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-tile">
            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex-1 text-[14px] text-text">
                  {taskFilter === "all" ? t("task.none") : t("task.noneFiltered")}
                </span>
                {taskFilter === "all" ? (
                  <button
                    type="button"
                    data-testid="task-wie-weiter"
                    aria-expanded={wieWeiter}
                    onClick={() => setWieWeiter((v) => !v)}
                    className="shrink-0 rounded-btn border border-hairline px-3 py-1 text-[12.5px] font-semibold text-text hover:bg-hairline-soft"
                  >
                    {t("task.weiter")}
                  </button>
                ) : null}
              </div>
              {taskFilter === "all" ? (
                <div data-testid="task-wie-weiter-inhalt" hidden={!wieWeiter}>
                  <EmptyStateCtas context="tasks" />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {sichtbareGruppen.map((g) => {
          const visible = g.visible;
          return (
            <div key={g.key}>
              {/* §4: die Gruppe ist ein KICKER wie auf der Startseite, keine farbige Plakette. */}
              <div className="mb-2.5 flex items-center gap-2 px-1">
                <span className={`h-2 w-2 shrink-0 rounded-full ${GRUPPEN_PUNKT[g.severity]}`} />
                <span className="text-[11px] uppercase tracking-[0.5px] text-muted-2">
                  {t(g.key)}
                </span>
                <span className="text-[11px] text-muted-2">{visible.length}</span>
              </div>
              <div className="overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-tile">
                {visible.map((it) => {
                  // SCRUM-260: sichtbare nächste Handlung je Aufgabe (DOM-freier Helper).
                  const action = taskAction(it.typeKey);
                  return (
                    <div
                      key={it.id}
                      data-testid="task-zeile"
                      className="flex flex-wrap items-center gap-3 border-b border-hairline-soft px-4 py-3"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${GRUPPEN_PUNKT[it.severity]}`}
                      />
                      <Link to={it.to} className="min-w-0 flex-1 hover:opacity-80">
                        <span className="block truncate text-[14px] text-text">{it.label}</span>
                        {/* §4: EINE Meta-Zeile statt vier Pillen — Typ · Phase · Sprache ·
                              Häufigkeit · Review-Zustand.
                              GAP-SPRACHHERKUNFT / JOB 1111 D-032: Sprach-Etikett und Häufigkeit
                              bleiben `shrink-0` und stehen AUSSERHALB des kürzenden Teils. Genau
                              das war ihr Bauzweck: als Anhang am Titel fielen sie dem `truncate`
                              zuerst zum Opfer — bei den langen Titeln, für die sie gedacht sind.
                              Der kürzende Teil ist jetzt der Anfang der Meta-Zeile. */}
                        <span
                          data-testid="task-meta"
                          className="mt-0.5 flex items-baseline gap-1.5 text-[12.5px] text-muted-2"
                        >
                          <span className="min-w-0 truncate">
                            {t(it.typeKey)} · {t("task.phaseLabel")}{" "}
                            {t(phaseLabelKey(knowledgeOsPhase(it.typeKey)))}
                          </span>
                          {it.localeTag ? (
                            <>
                              <span aria-hidden="true" className="shrink-0">
                                ·
                              </span>
                              <span className="shrink-0">{it.localeTag}</span>
                            </>
                          ) : null}
                          {it.askCount ? (
                            <>
                              <span aria-hidden="true" className="shrink-0">
                                ·
                              </span>
                              <span data-testid="gap-frequency" className="shrink-0 font-mono">
                                {it.askCount}×
                              </span>
                            </>
                          ) : null}
                          {it.review ? (
                            <>
                              <span aria-hidden="true" className="shrink-0">
                                ·
                              </span>
                              <span className="shrink-0">{t(it.review.labelKey)}</span>
                            </>
                          ) : null}
                        </span>
                        {it.author ? <KoAuthorLine {...it.author} /> : null}
                      </Link>
                      <ErklaerKnopf satz={t(action.explainKey)} />
                      <Link
                        to={it.to}
                        aria-label={t(action.actionLabelKey)}
                        className="shrink-0 text-muted-2 hover:text-text"
                      >
                        <ChevronRight size={13} strokeWidth={2} aria-hidden="true" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

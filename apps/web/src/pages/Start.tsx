import { ArrowRight, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  useAnalytics,
  useConflicts,
  useGapsSummary,
  useKos,
  useLearningPath,
  useLearningProgress,
  useLifecyclePending,
  useLiveWall,
  useValidationBoard,
} from "../api/hooks";
import { useSession } from "../app/AuthContext";
import { useRole } from "../app/RoleContext";
import { AdminFirstRunCard } from "../components/AdminFirstRunCard";
import { EmptyStateCtas } from "../components/EmptyStateCtas";
// FUNKE (nacht24 Paket 6): Wissenskapital-Kachel (F5) + offene Wissenslücken (F3).
import { KnowledgeCapitalNumbers, OpenGapsSummary } from "../components/FunkeCards";
import { HelpTip } from "../components/HelpTip";
import { Card, PageHeader } from "../components/ui";
import { DEMO_PILOT_PATH, captureDemoHref } from "../lib/demoPilotPath";
import { knowledgeCapital } from "../lib/funke";
import { KNOWLEDGE_CYCLE } from "../lib/knowledgeCycle";
import { type KnowledgeGuidanceTone, knowledgeGuidance } from "../lib/knowledgeGuidance";
import { missionsForRole } from "../lib/missions";
import { PROOF_CHAIN } from "../lib/proofChain";
import { type StartHelpId, startHelp } from "../lib/startHelp";
import {
  START_ORIENTATION_TEXT,
  isStartOrientationFirstRun,
  markStartOrientationSeen,
} from "../lib/startOrientation";
import { stufe2FeatureLabelKeys, stufe2HintKind } from "../lib/stufe2Hint";
import { knowledgeOsPhase, phaseLabelKey } from "../lib/taskAction";
import {
  type WorkSeverity,
  buildWorkOverview,
  learningOpenSteps,
  primaryWorkItem,
  workSignalsFrom,
} from "../lib/workCenter";

// Severity → Farbton der Punkt-Markierung (kritisch/heute/später).
const WORK_TONE: Record<WorkSeverity, string> = {
  critical: "bg-trust-crit-fill",
  today: "bg-trust-warn-fill",
  later: "bg-muted-2",
};

// SCRUM-289: Führungston für gesichert/zu prüfen/quellengebunden nutzen.
const GUIDE_TONE: Record<KnowledgeGuidanceTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
};

// Garantierter Fallback (unbekannte Rolle → Viewer-Einstieg) — hält den Index-Zugriff unten
// auch unter noUncheckedIndexedAccess ehrlich definiert.
const CTA_VIEWER = { to: "/fragen", key: "start.ctaAsk" };
const CTA: Record<string, { to: string; key: string }> = {
  viewer: CTA_VIEWER,
  experte: { to: "/erfassen", key: "start.ctaCapture" },
  controller: { to: "/validierung", key: "start.ctaValidate" },
  admin: { to: "/validierung", key: "start.ctaValidate" },
};

// Audit-P4 (SCRUM-398): Live-Wall als ruhige Start-Karte — „frisch gesichert" und
// „hat geholfen" aus echten Ereignissen (KO-Bestand + Wirkungs-Audit). Keine Scores,
// keine Ranglisten; leere Zustände werden ehrlich benannt. Beamer-Ansicht = Folge-Slice.
function LiveWallCard(): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const { data } = useLiveWall();
  if (!data) {
    return null;
  }
  const fmt = (at: string): string =>
    new Date(at).toLocaleString(i18n.language.startsWith("en") ? "en-GB" : "de-DE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <Card className="mb-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{t("start.livewall.title")}</h2>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
            {t("start.livewall.subtitle")}
          </p>
        </div>
        {data.helpedToday > 0 ? (
          <span className="rounded-pill bg-trust-pos-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold text-trust-pos-text">
            {t("start.livewall.helpedToday", { n: data.helpedToday })}
          </span>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-2">
            {t("start.livewall.saved")}
          </div>
          {data.saved.length === 0 ? (
            <p className="text-[12.5px] text-muted">{t("start.livewall.savedEmpty")}</p>
          ) : (
            <ul className="space-y-1">
              {data.saved.map((s) => (
                <li key={s.koId} className="flex items-baseline gap-2">
                  <Link
                    to={`/wissen/${s.koId}`}
                    className="min-w-0 flex-1 truncate text-[13px] font-medium text-text hover:text-ink"
                  >
                    {s.title}
                  </Link>
                  <span
                    className={`shrink-0 rounded-pill px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${
                      s.status === "validiert"
                        ? "bg-trust-pos-bg text-trust-pos-text"
                        : "bg-page text-muted"
                    }`}
                  >
                    {s.status}
                  </span>
                  <span className="shrink-0 font-mono text-[10.5px] text-muted-2">{fmt(s.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-2">
            {t("start.livewall.helped")}
          </div>
          {data.helped.length === 0 ? (
            <p className="text-[12.5px] text-muted">{t("start.livewall.helpedEmpty")}</p>
          ) : (
            <ul className="space-y-1">
              {data.helped.map((h) => (
                <li key={`${h.koId}-${h.at}`} className="flex items-baseline gap-2">
                  <Link
                    to={`/wissen/${h.koId}`}
                    className="min-w-0 flex-1 truncate text-[13px] font-medium text-text hover:text-ink"
                  >
                    {h.title}
                  </Link>
                  <span className="shrink-0 font-mono text-[10.5px] text-muted-2">{fmt(h.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="rounded-card bg-page p-4">
      <div className="font-mono text-micro uppercase tracking-wider text-muted-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
    </div>
  );
}

export function Start(): JSX.Element {
  const { t } = useTranslation();
  // SCRUM-488: ?-Hilfen auf dem Start-Screen (Nullschulung) — zentrale Karte, gleiches Muster wie chelp/vhelp.
  const shelp = (id: StartHelpId): JSX.Element => {
    const topic = startHelp(id);
    return <HelpTip title={t(topic.titleKey)} body={t(topic.bodyKey)} />;
  };
  const { role, stufe2 } = useRole();
  const { user } = useSession();
  const analytics = useAnalytics();
  const board = useValidationBoard();
  // FUNKE-FIX2 P0 (bens Erforderlich 1): die Startseite lädt KEINE Gap-Volltexte mehr — nur die
  // aggregierten Zähler (offene gesamt + je Priorität). Kein Fragetext gelangt in den Browser.
  const gapsSummary = useGapsSummary();
  const openGapsTotal = gapsSummary.data?.open ?? 0;
  const criticalGapsTotal = gapsSummary.data?.byPriority.hoch ?? 0;
  // FUNKE F5 (nacht24): Bestand für die Wissenskapital-Kachel (nur echte Zahlen).
  const kos = useKos();
  // SCRUM-247: echte Signale für die Arbeitsübersicht (Konflikte, Revalidierung, Lernpfad).
  const conflicts = useConflicts();
  const pending = useLifecyclePending();
  const learningPath = useLearningPath(role);
  const learningProgress = useLearningProgress(learningPath.data?.id);
  const cta = CTA[role] ?? CTA_VIEWER;
  // FE-FND-09: rollenbewusste Missionen — Deep-Links in echte Flows (keine neuen Seiten).
  const missions = missionsForRole(role, stufe2);
  // SCRUM-235: ehrlicher Stufe-2-Auffindbarkeits-Hinweis — nur für Admins mit ausgeschaltetem Schalter.
  const showStufe2Hint = stufe2HintKind(role, stufe2) === "enable";
  const stufe2Features = stufe2FeatureLabelKeys()
    .map((k) => t(k))
    .join(", ");

  // SCRUM-247: getrennte, datengetriebene Arbeitsübersicht (keine vermischte Todo-Liste, keine Fakes).
  // FUNKE-FIX2 P0: die kritischen Lücken kommen aus dem aggregierten Summary (byPriority.hoch), nicht
  // aus geladenen Gap-Volltexten — deshalb `gaps: []` an workSignalsFrom und criticalGaps überschreiben.
  const overview = buildWorkOverview({
    ...workSignalsFrom({
      board: board.data ?? [],
      conflicts: conflicts.data ?? [],
      revalidation: pending.data ?? [],
      gaps: [],
      learningOpenSteps: learningOpenSteps(learningPath.data, learningProgress.data),
    }),
    criticalGaps: criticalGapsTotal,
  });
  // SCRUM-271: bester nächster Einstieg aus der vorhandenen Übersicht (null bei Leerzustand).
  const focus = primaryWorkItem(overview);
  const guide = knowledgeGuidance("start");
  // Aufräum-Pass 02.07.: Erklär-Blöcke nur beim Erstbesuch offen — danach ruhige Startseite.
  const [showOrientation, setShowOrientation] = useState(() =>
    isStartOrientationFirstRun(window.localStorage),
  );
  useEffect(() => {
    markStartOrientationSeen(window.localStorage);
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        kicker={t("start.kicker")}
        title={t("start.greeting", { name: user?.name ?? "" })}
        actions={
          <Link
            to={cta.to}
            className="inline-flex items-center gap-2 rounded-btn bg-ink px-4 py-2.5 text-[13px] font-semibold text-white hover:opacity-90"
          >
            {t(cta.key)}
            <ArrowRight size={16} />
          </Link>
        }
      />
      {/* SCRUM-429: ruhige Erststart-Führung nur für den neuen Admin (erster Besuch, ausblendbar). */}
      {role === "admin" ? <AdminFirstRunCard /> : null}
      {/* SCRUM-261: Knowledge-OS-Kreis als vorhandene Arbeitsführung (kein Chatbot). */}
      <div className="mb-5">
        <div className="flex items-center gap-1.5">
          <h2 className="text-[15px] font-semibold text-ink">{t("cycle.title")}</h2>
          {shelp("cycle")}
        </div>
        <p className="mb-3 mt-0.5 text-[12.5px] text-muted">{t("cycle.subtitle")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KNOWLEDGE_CYCLE.map((step, i) => (
            <Link
              key={step.id}
              to={step.to}
              className="group rounded-card border border-hairline bg-surface p-4 transition hover:border-ink/30"
            >
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink font-mono text-[11px] font-semibold text-white">
                  {i + 1}
                </span>
                <span className="text-[14px] font-semibold text-ink">{t(step.labelKey)}</span>
                {i < KNOWLEDGE_CYCLE.length - 1 ? (
                  <ArrowRight
                    size={15}
                    className="ml-auto text-muted-2 transition group-hover:translate-x-0.5 group-hover:text-ink"
                  />
                ) : null}
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{t(step.descKey)}</p>
            </Link>
          ))}
        </div>
      </div>
      {/* Aufräum-Pass 02.07. (Pedi): „So liest du Klarwerk" (SCRUM-289) + Demo-/Pilotpfad
          (SCRUM-290/301) gebündelt in EINER einklappbaren Orientierungs-Karte — Erstbesuch
          offen, danach zu. Inhalte unverändert, nur Dichte reduziert. */}
      <Card className="mb-5">
        <button
          type="button"
          aria-expanded={showOrientation}
          onClick={() => setShowOrientation((s) => !s)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span>
            <span className="text-[15px] font-semibold text-ink">
              {t(START_ORIENTATION_TEXT.title)}
            </span>
            <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">
              {t(START_ORIENTATION_TEXT.hint)}
            </span>
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-muted-2 transition-transform ${showOrientation ? "rotate-180" : ""}`}
          />
        </button>
        {showOrientation ? (
          <div className="mt-4 space-y-5">
            {/* SCRUM-289: Pilot-Führung — gesichertes Wissen vs. Review-Arbeit vs. Ask erklären. */}
            <div>
              <div className="mb-3">
                <h2 className="text-[15px] font-semibold text-ink">{t(guide.titleKey)}</h2>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                  {t(guide.bodyKey)}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {guide.items.map((item) => (
                  <Link
                    key={item.id}
                    to={item.to}
                    className="rounded-card border border-hairline bg-surface p-3 transition hover:border-ink/30"
                  >
                    <span
                      className={`rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${GUIDE_TONE[item.tone]}`}
                    >
                      {t(item.labelKey)}
                    </span>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                      {t(item.bodyKey)}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
            {/* SCRUM-290: konkreter Stage-1 Demo-/Pilotpfad — Start → Ask → Library/KO-Detail → Validation,
          nur vorhandene Routen, demo-sichere Frage. Zeigt: quellengebunden fragen → Quelle/Trust/
          Status/Version sehen → ungeprüftes Wissen zur Validierung (kein Chatbot). */}
            <div className="border-t border-hairline pt-4">
              <div className="mb-3">
                <h2 className="text-[15px] font-semibold text-ink">{t("demo.title")}</h2>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                  {t("demo.subtitle")}
                </p>
                {/* SCRUM-301: sichtbare Pilot-Beweiskette — Start verspricht „finden → Nutzbarkeit erkennen →
              Quelle/Trust/Version prüfen"; Library/KO-Detail lösen sie mit denselben Begriffen ein. */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                    {t("demo.proof.label")}
                  </span>
                  {PROOF_CHAIN.map((beat) => (
                    <span key={beat.id} className="flex items-center gap-1.5">
                      {beat.n > 1 ? <span className="text-muted-2">→</span> : null}
                      <span className="rounded-pill bg-page px-2 py-0.5 text-[11px] font-medium text-text">
                        {t(beat.labelKey)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
              <ol className="grid gap-2 sm:grid-cols-3">
                {DEMO_PILOT_PATH.map((step) => (
                  <li key={step.id}>
                    <Link
                      to={step.to}
                      className="group block h-full rounded-card border border-hairline bg-surface p-3 transition hover:border-ink/30"
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink font-mono text-[10px] font-semibold text-white">
                          {step.n}
                        </span>
                        <span className="text-[13.5px] font-semibold text-ink">
                          {t(step.labelKey)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                        {t(step.descKey)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ol>
              {/* SCRUM-296: aktiver Erfassungsfluss als Einstieg — Capture → Validation → Use. */}
              <Link
                to={captureDemoHref()}
                className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:underline"
              >
                {t("demo.captureEntry")} <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        ) : null}
      </Card>
      {/* Audit-P4 (SCRUM-398): Live-Wall — was gerade passiert (frisch gesichert / hat geholfen). */}
      <LiveWallCard />
      {/* FUNKE (nacht24 Paket 6): Wissenskapital-Kachel (F5, ehrliche Bestandssummen — auch für
          Begutachter) und offene Wissenslücken (F3, Direkteinstieg „in 2 Minuten beantworten"). */}
      {(kos.data?.length ?? 0) > 0 ? (
        <Card className="mb-5">
          <KnowledgeCapitalNumbers
            capital={{ ...knowledgeCapital(kos.data ?? [], []), openGaps: openGapsTotal }}
          />
        </Card>
      ) : null}
      {/* FUNKE-FIX P0 (bens Sammel-Nacht) + FUNKE-FIX2 P0 (bens Erforderlich 1): nur die anonyme
          offene Zahl (aus dem Summary-Endpunkt, KEIN Volltext-Fetch) + Weg in Risiko & Lücken. */}
      {openGapsTotal > 0 ? (
        <Card className="mb-5">
          <OpenGapsSummary total={openGapsTotal} />
        </Card>
      ) : null}
      {missions.length > 0 ? (
        <div className="mb-5">
          <h2 className="text-[15px] font-semibold text-ink">{t("missions.title")}</h2>
          <p className="mb-3 mt-0.5 text-[12.5px] text-muted">{t("missions.subtitle")}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {missions.map((m) => (
              <Link
                key={m.id}
                to={m.path}
                className="group rounded-card border border-hairline bg-surface p-4 transition hover:border-ink/30"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-ink">{t(m.labelKey)}</span>
                  <ArrowRight
                    size={16}
                    className="text-muted-2 transition group-hover:translate-x-0.5 group-hover:text-ink"
                  />
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{t(m.descKey)}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      {showStufe2Hint ? (
        <Card className="mb-5 border-dashed">
          <h2 className="text-[14px] font-semibold text-ink">{t("start.stufe2.title")}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            {t("start.stufe2.body", { features: stufe2Features, toggle: t("role.stage2") })}
          </p>
        </Card>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[15px] font-semibold text-ink">{t("start.workTitle")}</h2>
              {shelp("work")}
            </div>
            <Link to="/aufgaben" className="text-[12.5px] font-semibold text-brand">
              {t("start.allTasks")}
            </Link>
          </div>
          {/* SCRUM-488: Klartext-Legende für die Dringlichkeits-Punkte (rot=jetzt · gelb=heute · grau=später). */}
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-muted-2">
            {(["critical", "today", "later"] as const).map((sev) => (
              <span key={sev} className="flex items-center gap-1">
                <span className={`h-2 w-2 shrink-0 rounded-full ${WORK_TONE[sev]}`} />
                {t(`start.severity.${sev}`)}
              </span>
            ))}
            {shelp("severity")}
          </div>
          {/* SCRUM-271: bester nächster Einstieg hervorgehoben (kein Auto-Handeln, nur Führung). */}
          {focus ? (
            <Link
              to={focus.to}
              className="mb-3 flex items-center gap-3 rounded-card bg-page p-3 hover:opacity-90"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${WORK_TONE[focus.severity]}`} />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-2">
                  {t("start.focusLabel")}
                </span>
                <span className="block truncate text-[13.5px] font-semibold text-ink">
                  {t(`work.${focus.key}`)}
                </span>
                {/* SCRUM-297: Knowledge-OS-Phase der nächsten Arbeit (Erfassen/Validieren/Aktuell halten). */}
                <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-muted-2">
                  {t("task.phaseLabel")} {t(phaseLabelKey(knowledgeOsPhase(focus.key)))}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[13px] font-semibold text-ink">
                {focus.count}
              </span>
              <ArrowRight size={15} className="shrink-0 text-muted-2" />
            </Link>
          ) : null}
          <div className="divide-y divide-hairline">
            {overview.length === 0 ? (
              <div className="py-4">
                <p className="text-sm text-muted">{t("start.todoEmpty")}</p>
                <EmptyStateCtas context="start" />
              </div>
            ) : (
              overview.map((it) => (
                <Link
                  key={it.key}
                  to={it.to}
                  className="flex items-center gap-3 py-2.5 hover:opacity-80"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${WORK_TONE[it.severity]}`} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">
                    {t(`work.${it.key}`)}
                  </span>
                  <span className="shrink-0 font-mono text-[13px] font-semibold text-ink">
                    {it.count}
                  </span>
                  <ArrowRight size={15} className="shrink-0 text-muted-2" />
                </Link>
              ))
            )}
          </div>
        </Card>
        <div>
          {/* SCRUM-488: Klartext-Überschrift + Hilfe, damit die vier Zahlen ohne Vorwissen lesbar sind. */}
          <div className="mb-2 flex items-center gap-1.5">
            <h2 className="text-[13px] font-semibold text-ink">{t("start.kpiSectionTitle")}</h2>
            {shelp("kpis")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Kpi label={t("start.kpiTotal")} value={analytics.data?.total ?? "—"} />
            <Kpi label={t("start.kpiOpen")} value={analytics.data?.byStatus?.offen ?? "—"} />
            <Kpi
              label={t("start.kpiValidated")}
              value={analytics.data?.byStatus?.validiert ?? "—"}
            />
            <Kpi label={t("start.kpiGaps")} value={gapsSummary.data ? openGapsTotal : "—"} />
          </div>
        </div>
      </div>
    </div>
  );
}

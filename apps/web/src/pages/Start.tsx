import { ArrowRight, ChevronDown, Plus, Search, ShieldCheck } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useConflicts,
  useEigeneBefunde,
  useGapsSummary,
  useKos,
  useLearningPath,
  useLearningProgress,
  useLifecyclePending,
  useLiveWall,
  useValidationBoard,
} from "../api/hooks";
// JOB 3015 D5: das Suchfeld der Konsole navigiert wie die Topbar-Suche — durch den Eingabe-Wächter.
import { useGuardedNavigate } from "../app/NavGuardContext";
import { useRole } from "../app/RoleContext";
import { AdminFirstRunCard } from "../components/AdminFirstRunCard";
import { EmptyStateCtas } from "../components/EmptyStateCtas";
// FUNKE (nacht24 Paket 6): Wissenskapital-Kachel (F5) + offene Wissenslücken (F3).
import { KnowledgeCapitalNumbers, OpenGapsSummary } from "../components/FunkeCards";
import { HelpTip } from "../components/HelpTip";
import { KlaraPathTeaser } from "../components/KlaraPathTeaser";
import { LoadErrorState, StaleMarker } from "../components/LoadState";
// AUFTRAG-mega51 BLOCK A: das EINE Tor für jeden Weg dieser Seite — was die Rolle nicht erreicht,
// wird als Lage gezeigt, nicht als Link. Deshalb steht hier kein `Link` aus react-router-dom mehr.
import { RoleLink } from "../components/RoleLink";
// AUFTRAG-mega34 F: die vorhandene, übersetzte Status-Plakette — statt des rohen DB-Werts.
import { StatusPill } from "../components/trust";
import { Card } from "../components/ui";
import { DEMO_PILOT_PATH, captureDemoHref } from "../lib/demoPilotPath";
// A27 (OFFEN.md:81) · JOB 3025: DIESELBE Funktion wie auf der Detailseite. Ein zweiter
// Ableitungsweg wäre genau die Drift, an der JOB 3002 Runde 4 fiel — dort las die Startseite noch
// mit `?? []`, während die Detailseite schon Lagen unterschied.
import { eigeneKollisionStart } from "../lib/eigeneKollision";
import { knowledgeCapital } from "../lib/funke";
import { KNOWLEDGE_CYCLE } from "../lib/knowledgeCycle";
import { type KnowledgeGuidanceTone, knowledgeGuidance } from "../lib/knowledgeGuidance";
import { isGroupError, isGroupLoading, isGroupStale } from "../lib/loadingState";
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

// ================================================================================================
// JOB 3015 D5 „KonsoleStart" (Zielbild KonsoleStart.dc.html, Z.25–56) — DIE STARTSEITE WIRD KONSOLE.
// ================================================================================================
// Oben steht nicht mehr Kicker, Gruß und Kachelwand, sondern die Frage des Zielbilds, darunter das
// Suchfeld, darunter drei Karten. Alles, was die Seite vorher zeigte, rückt UNTER die Konsole
// (Zwecksatz, Klara-Teaser, Erststart-Karte, Kreis, Orientierung, LiveWall, Wissenskapital, Lücken,
// Stufe-2-Hinweis, Nächste Handlungen) — nichts davon ist gelöscht. Gegangen sind nur Kicker
// „Übersicht" und Gruß (der Name steht in der Seitenleiste) sowie die beiden CTA-Knöpfe des
// Kopfes: ihre Ziele sind jetzt die Karten — „Frage stellen" → Suchen (/fragen), „Wissen erfassen" →
// Hinzufügen (/erfassen), „Validierung öffnen" → Prüfen (/validierung). Die Rollenfrage stellt wie
// bisher RoleLink; was die Rolle nicht erreicht, ist eine Lage, kein Weg (mega51).
//
// DAS SUCHFELD FÜHRT WIRKLICH: Eingabe + Enter → `/bibliothek?q=…`, derselbe belegte Weg wie die
// Topbar-Suche (shell/Topbar.tsx, submitSearch), den pages/Library.tsx über `params.get("q")`
// liest — dort steht bei aktiver Suche auch der Weg zur belegten Antwort („Frage stellen"). KEIN
// ⌘K-Chip (Zielbild Z.34): ⌘K öffnet im Produkt die Seitensprung-Palette (shell/CommandPalette.tsx),
// nicht dieses Feld — eine angezeigte Taste, die etwas anderes tut, wäre eine Scheinfunktion.
//
// DIE PILLE „N offen" trägt die echte Zahl des Prüfboards (dieselbe Quelle wie „Nächste Handlungen",
// workCenter.ts: validationOpen = board.length). Ist das Board nicht geladen, gibt es keine Pille —
// keine erfundene Zahl, kein Platzhalter.
//
// Maße, Farben und Wortlaute sind aus dem Zielbild gelesen; gemessen an der in Chromium gemounteten
// echten Seite in tests/design/zielbild-konsole-start.test.ts. Farben über Token (Werkbank-Palette:
// text = #1A2233, muted-2 = #525B6B, hairline = #E9E5DE, funke-deep = #C2500A, warn = #8A5A00 auf
// #FDF1D7); der Funke-dunkel-Token existiert nur im modernen Thema, deshalb trägt das Symbol den
// klassischen Ersatzwert als var()-Rückfall.
const KONSOLE_KARTE_KLASSEN =
  "flex flex-col gap-3 rounded-[14px] border border-hairline bg-surface px-6 py-[26px] shadow-tile transition";
const KONSOLE_SYMBOL_KLASSEN = "shrink-0 text-[rgb(var(--kw-funke-deep,194_80_10))]";

function KonsoleKarte({
  to,
  symbol,
  titleKey,
  bodyKey,
  pille,
}: {
  to: string;
  symbol: ReactNode;
  titleKey: string;
  bodyKey: string;
  pille?: ReactNode;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <RoleLink to={to} className={KONSOLE_KARTE_KLASSEN} hoverClassName="hover:border-ink/30">
      {() => (
        <>
          <div className="flex items-center justify-between">
            {symbol}
            {pille ?? null}
          </div>
          <div className="text-[16px] font-[650] text-text">{t(titleKey)}</div>
          <div className="text-[13px] leading-[1.5] text-muted-2">{t(bodyKey)}</div>
        </>
      )}
    </RoleLink>
  );
}

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
                  <RoleLink
                    to={`/wissen/${s.koId}`}
                    className="min-w-0 flex-1 truncate text-[13px] font-medium text-text"
                    hoverClassName="hover:text-ink"
                  >
                    {() => s.title}
                  </RoleLink>
                  {/* AUFTRAG-mega34 F: hier stand der rohe Enum-Wert — „VALIDIERT" / „OFFEN"
                      direkt aus der Datenbank, in Großbuchstaben, und bei englischer oder
                      niederländischer Oberfläche trotzdem auf Deutsch. Es ist die erste Karte,
                      die die Testerin nach der Anmeldung sieht. Überall sonst im Produkt macht
                      das die bestehende StatusPill über `t("status.<wert>")`; diese eine Stelle
                      hat sie umgangen. Kein neues Bauteil, nur das vorhandene benutzt. */}
                  <span className="shrink-0">
                    <StatusPill status={s.status} />
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
                  <RoleLink
                    to={`/wissen/${h.koId}`}
                    className="min-w-0 flex-1 truncate text-[13px] font-medium text-text"
                    hoverClassName="hover:text-ink"
                  >
                    {() => h.title}
                  </RoleLink>
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

// AUFTRAG-mega38 BLOCK G2: die Kachel-Komponente `Kpi` ist mit dem doppelten Kennzahlen-Block
// entfallen — sie hatte hier keinen zweiten Verwender.

export function Start(): JSX.Element {
  const { t } = useTranslation();
  // SCRUM-488: ?-Hilfen auf dem Start-Screen (Nullschulung) — zentrale Karte, gleiches Muster wie chelp/vhelp.
  const shelp = (id: StartHelpId): JSX.Element => {
    const topic = startHelp(id);
    return <HelpTip title={t(topic.titleKey)} body={t(topic.bodyKey)} />;
  };
  const { role, stufe2 } = useRole();
  const board = useValidationBoard();
  // JOB 3015 D5: das Suchfeld der Konsole — derselbe Weg wie die Topbar-Suche (Topbar.tsx).
  const navigate = useGuardedNavigate();
  const [suche, setSuche] = useState("");
  const submitSuche = (e: FormEvent): void => {
    e.preventDefault();
    const term = suche.trim();
    navigate(term ? `/bibliothek?q=${encodeURIComponent(term)}` : "/bibliothek");
  };
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
  // AUFTRAG-mega2 Block C (bens D9): Arbeitsübersicht und Gap-Signale sind EINE zusammengehörige
  // Gruppe. Solange die tragenden Quellen (Board, Konflikte, Revalidierung, Gap-Summary) nicht geladen
  // sind, darf die Startseite KEINE echte 0 und kein „nichts zu tun" behaupten — das wäre eine
  // Negativaussage aus fehlenden Daten. Vor `loaded` zeigt die Übersicht einen ehrlichen Ladezustand.
  //
  // JOB 1217: DER LERNFORTSCHRITT GEHÖRT DAZU — ABER NUR, WENN ES EINEN PFAD GIBT.
  //
  // `useLearningProgress` hängt an `learningPath.data?.id` (:185). Zwischen „Pfad geladen" und
  // „Fortschritt geladen" liegt zwangsläufig ein Fenster, und in ihm rechnet `:203` bereits:
  // `learningOpenSteps` meldet wegen `done?.length ?? 0` (workCenter.ts:141) die VOLLE Schrittzahl.
  // Ohne den Fortschritt in dieser Gruppe zeigt die Übersicht sie an — eine erfundene Zahl NACH OBEN.
  //
  // WARUM BEDINGT UND NICHT EINFACH ANGEHÄNGT: `useLearningProgress` ist ohne Pfad-Id dauerhaft
  // `enabled: false` (api/hooks.ts:158) und liefert dann NIE `data`. Fest angehängt bliebe die Gruppe
  // für jede Rolle ohne Lernpfad ewig im Ladezustand — das wäre die zweite Unwahrheit statt der
  // ersten, genau die, vor der loadingState.ts:6-8 warnt. Gibt es keinen Pfad, gibt es auch kein
  // Fenster: `learningOpenSteps(null|undefined, …)` ist dann echte 0 (workCenter.ts:138-140).
  //
  // Die Bedingung SPIEGELT die des Hooks (`enabled: !!pathId`) und prüft deshalb die ID, nicht das
  // Datum: `byRole` liefert bei einer Rolle ohne Pfad `null` — dann ist `data` gesetzt, `data.id`
  // aber nicht, und die Abfrage bleibt untätig. Eine Prüfung auf `data === undefined` würde genau
  // diesen Fall übersehen und die Gruppe ewig laden lassen.
  const lernfortschrittGehoertDazu = Boolean(learningPath.data?.id);
  const workSources = lernfortschrittGehoertDazu
    ? [board, conflicts, pending, gapsSummary, learningProgress]
    : [board, conflicts, pending, gapsSummary];
  const workLoading = isGroupLoading(workSources);
  // AUFTRAG-mega3 Block B (bens D9): dritte Phase „error" — eine dauerhaft gescheiterte tragende Quelle
  // (ohne nutzbare Daten) zeigt einen ehrlichen Fehlerzustand mit Wiederholen, statt endlos „lädt".
  const workError = isGroupError(workSources);
  // Stale: brauchbare Daten liegen vor, ein Refetch scheiterte — Daten bleiben sichtbar, aber markiert.
  const workStale = isGroupStale(workSources);
  const retryWork = (): void => {
    void board.refetch();
    void conflicts.refetch();
    void pending.refetch();
    void gapsSummary.refetch();
  };
  // SCRUM-271: bester nächster Einstieg aus der vorhandenen Übersicht (null bei Leerzustand).
  // AUFTRAG-mega38 BLOCK G3: rollenbewusst — kein Hinweis auf Arbeit, die diese Rolle auf der
  // Zielseite gar nicht ausführen darf.
  const focus = primaryWorkItem(overview, role);
  // ================================================================================================
  // A27 (OFFEN.md:81) · JOB 3025 — DIE AUSKUNFT ÜBER DIE EIGENEN OBJEKTE.
  // ================================================================================================
  // `primaryWorkItem(overview, role)` darüber bleibt UNANGETASTET: dort geht es um Arbeit, die die
  // Rolle auf der Zielseite ausführen darf, und für eine Expertin ist das genau nichts. Hier geht es
  // um etwas anderes — um Auskunft über das eigene Wissen, die jede Rolle bekommt, weil sie über
  // ihre eigenen Objekte spricht und nicht über fremde Arbeit.
  //
  // Die drei Quellen gehen als LAGE hinein, nicht als „Daten oder leer". `kos` und `conflicts`
  // wurden bis hierher mit `?? []` gelesen (`:200`, `:481`); für die Arbeitsübersicht bleibt das
  // richtig, weil `isGroupLoading`/`isGroupError`/`isGroupStale` die Lage dort GETRENNT tragen. Für
  // diese Auskunft trägt sie `eigeneKollisionStart` — dieselbe Regel wie am Detail.
  const eigeneBefunde = useEigeneBefunde();
  const kollision = eigeneKollisionStart({
    befunde: eigeneBefunde,
    konflikte: conflicts,
    kos,
  });
  const kollisionsWeg = kollision.weg;
  // Wie am Detail: alle Texte dieses Bereichs entstehen hier oben, die Kind-Funktion von `RoleLink`
  // trägt nur noch den Pfeil.
  const kollisionsWegText = kollisionsWeg === null ? null : t(kollisionsWeg.textKey);
  const guide = knowledgeGuidance("start");
  // Aufräum-Pass 02.07.: Erklär-Blöcke nur beim Erstbesuch offen — danach ruhige Startseite.
  const [showOrientation, setShowOrientation] = useState(() =>
    isStartOrientationFirstRun(window.localStorage),
  );
  useEffect(() => {
    markStartOrientationSeen(window.localStorage);
  }, []);

  return (
    <>
      {/* ==========================================================================================
          JOB 3015 D5 — DIE KONSOLE (Zielbild Z.25–56). `page-start` bleibt der Seitenanker des
          UI-Smokes (tests-smoke/ui-smoke.spec.ts, KERNROUTEN); vorher trug ihn der PageHeader.
          ==========================================================================================
          DIE RAUMWIRKUNG (Runde 4, bens Korrekturpflicht): das Zielbild gibt der Konsole den ganzen
          freien Bildschirm (Z.25 `flex-grow: 1; justify-content: center`) — Frage, Feld und Karten
          stehen in der Mitte, nichts anderes ist auf dem ersten Bildschirm. Die Seite ist Inhalt
          des scrollenden `<main>` der Hülle (shell/AppShell.tsx), das als Flex-Kind eine bestimmte
          Höhe hat; die Modalregion dazwischen ist `display: contents`. Deshalb greift hier eine
          Prozent-Mindesthöhe: der ERSTE Block der Seite ist `min-h-full` = der Inhaltskasten von
          <main>, egal ob darunter ein Hinweisband steht oder nicht, und die Konsole wächst darin
          mit `flex-1` und zentriert mit `justify-center` — das Gegenstück zu Z.25. Die Altinhalte
          stehen im ZWEITEN Block darunter, erreichbar durch Scrollen. Gemessen bei 1280×800 in
          tests/design/zielbild-konsole-start.test.ts (V28–V31): Konsole = Inhaltskasten von <main>,
          Inhalt vertikal mittig, Frage der erste Textblock. */}
      <div className="mx-auto flex min-h-full max-w-5xl flex-col">
        <section
          data-testid="page-start"
          aria-labelledby="konsole-frage"
          className="flex flex-1 flex-col items-center justify-center gap-11 pt-12 pb-[72px]"
        >
          <div className="flex flex-col items-center gap-2.5 text-center">
            <h1 id="konsole-frage" className="text-[30px] font-[650] tracking-[-0.3px] text-text">
              {t("start.konsole.frage")}
            </h1>
            <p className="text-[14px] text-muted-2">{t("start.konsole.untertitel")}</p>
          </div>
          <form
            onSubmit={submitSuche}
            className="flex w-[640px] max-w-full items-center gap-3 rounded-[14px] border border-hairline bg-surface px-5 py-4 shadow-tile"
          >
            <Search
              size={20}
              strokeWidth={1.8}
              aria-hidden="true"
              className="shrink-0 text-muted-2"
            />
            <input
              type="text"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              aria-label={t("start.konsole.feld")}
              placeholder={t("start.konsole.feld")}
              className="min-w-0 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-muted-2"
            />
          </form>
          <div className="grid w-[840px] max-w-full grid-cols-3 gap-5">
            <KonsoleKarte
              to="/fragen"
              symbol={
                <Search
                  size={24}
                  strokeWidth={1.7}
                  aria-hidden="true"
                  className={KONSOLE_SYMBOL_KLASSEN}
                />
              }
              titleKey="start.konsole.suchen.titel"
              bodyKey="start.konsole.suchen.text"
            />
            <KonsoleKarte
              to="/validierung"
              symbol={
                <ShieldCheck
                  size={24}
                  strokeWidth={1.7}
                  aria-hidden="true"
                  className={KONSOLE_SYMBOL_KLASSEN}
                />
              }
              titleKey="start.konsole.pruefen.titel"
              bodyKey="start.konsole.pruefen.text"
              pille={
                board.data ? (
                  <span className="rounded-[999px] bg-trust-warn-bg px-2.5 py-[3px] text-[11.5px] font-bold text-trust-warn-text">
                    {t("start.konsole.offen", { n: board.data.length })}
                  </span>
                ) : null
              }
            />
            <KonsoleKarte
              to="/erfassen"
              symbol={
                <Plus
                  size={24}
                  strokeWidth={1.7}
                  aria-hidden="true"
                  className={KONSOLE_SYMBOL_KLASSEN}
                />
              }
              titleKey="start.konsole.hinzufuegen.titel"
              bodyKey="start.konsole.hinzufuegen.text"
            />
          </div>
        </section>
      </div>
      {/* Der zweite Block: alles, was die Startseite vor D5 zeigte — unter der Konsole, unverändert. */}
      <div className="mx-auto max-w-5xl">
        {/* ==========================================================================================
          AUFTRAG-mega38 BLOCK G1 (Pedi 27.07.) — DER EINE SATZ, OHNE EIN FACHWORT.
          ==========================================================================================
          Aufgabe 1 der Testerin lautet wörtlich: „Notiere in einem Satz: Wofür, glaubst du, ist
          dieses System da?" Bis mega37 stand ganz oben „Control Room" und „Guten Tag, <Name>." —
          und die erste Erklärung überhaupt kam an dritter Stelle und definierte über eine
          Verneinung („Kein Chatbot"). Hier steht ein bejahender Satz in ihrer Sprache.
          JOB 3015 D5: er eröffnet jetzt den Bereich UNTER der Konsole — ganz oben steht die Frage. */}
        {/* mega40 D: `kw-start-purpose` — Stil-Anker; das modern-Thema gibt dem Satz Bühne
          (große ruhige Typo, Luft), der Text selbst bleibt wörtlich derselbe. */}
        <p className="kw-start-purpose mb-5 max-w-2xl text-[14px] leading-relaxed text-text">
          {t("start.purpose")}
        </p>
        <KlaraPathTeaser surface="start" />
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
              <RoleLink
                key={step.id}
                to={step.to}
                className="group rounded-card border border-hairline bg-surface p-4 transition"
                hoverClassName="hover:border-ink/30"
              >
                {/* Der Kreis behält alle vier Schritte — auch den, den diese Rolle nicht selbst
                  ausführt. Wegzulassen wäre nicht ehrlicher, sondern nur unvollständig. */}
                {(erreichbar) => (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink font-mono text-[11px] font-semibold text-white">
                        {i + 1}
                      </span>
                      <span className="text-[14px] font-semibold text-ink">{t(step.labelKey)}</span>
                      {erreichbar && i < KNOWLEDGE_CYCLE.length - 1 ? (
                        <ArrowRight
                          size={15}
                          className="ml-auto text-muted-2 transition group-hover:translate-x-0.5 group-hover:text-ink"
                        />
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                      {t(step.descKey)}
                    </p>
                  </>
                )}
              </RoleLink>
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
                    <RoleLink
                      key={item.id}
                      to={item.to}
                      className="rounded-card border border-hairline bg-surface p-3 transition"
                      hoverClassName="hover:border-ink/30"
                    >
                      {() => (
                        <>
                          <span
                            className={`rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${GUIDE_TONE[item.tone]}`}
                          >
                            {t(item.labelKey)}
                          </span>
                          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                            {t(item.bodyKey)}
                          </p>
                        </>
                      )}
                    </RoleLink>
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
                      <RoleLink
                        to={step.to}
                        className="group block h-full rounded-card border border-hairline bg-surface p-3 transition"
                        hoverClassName="hover:border-ink/30"
                      >
                        {() => (
                          <>
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
                          </>
                        )}
                      </RoleLink>
                    </li>
                  ))}
                </ol>
                {/* SCRUM-296: aktiver Erfassungsfluss als Einstieg — Capture → Validation → Use. */}
                <RoleLink
                  to={captureDemoHref()}
                  className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-text"
                  hoverClassName="hover:underline"
                >
                  {(erreichbar) => (
                    <>
                      {t("demo.captureEntry")} {erreichbar ? <ArrowRight size={13} /> : null}
                    </>
                  )}
                </RoleLink>
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
        {/* ==========================================================================================
          AUFTRAG-mega38 BLOCK G2 — „Nächste Schritte" (vier Kacheln) IST HIER ENTFERNT.
          ==========================================================================================
          Die Startseite trug vier konkurrierende Antworten auf dieselbe Frage „Was jetzt?":
          die Erststart-Karte (Admin, Erstbesuch), diese vier Kacheln, „Nächste Handlungen"
          (jetzt/heute/später) und „Bester nächster Einstieg" darin. Vier Empfehlungen sind keine
          Empfehlung.
          Dieser Block war der leerste davon: seine Ziele (/erfassen, /validierung, /risiko,
          /fragen, /bibliothek — damals aus lib/missions.ts, in mega39 BLOCK F samt Test gelöscht,
          weil seit diesem Schnitt niemand mehr davon liest) stehen bereits in der Navigation UND als
          Wissenskreis-Kacheln darüber, und im Gegensatz zu „Nächste Handlungen" trug er keine
          einzige echte Zahl. Er war eine zweite Navigation in Kachelform.
          Was BLEIBT, ist „Nächste Handlungen" mit „Bester nächster Einstieg" darin — der EINE
          Block, der aus echten Signalen entsteht.
          WAS OFFEN BLEIBT, benannt statt verschwiegen: die Erststart-Karte oben steht weiterhin
          daneben. Sie erscheint nur für Admins beim ERSTEN Besuch und ist eine Einrichtungs-
          Checkliste (Verwaltung öffnen), keine Wissensarbeit — s. Bericht mega38, Block G2. */}
        {showStufe2Hint ? (
          <Card className="mb-5 border-dashed">
            <h2 className="text-[14px] font-semibold text-ink">{t("start.stufe2.title")}</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              {t("start.stufe2.body", { features: stufe2Features, toggle: t("role.stage2") })}
            </p>
          </Card>
        ) : null}
        {/* AUFTRAG-mega38 BLOCK G2: hier stand rechts daneben ein zweiter Zahlenblock „Kennzahlen"
          (Wissensobjekte · Offen · Validiert · Wissenslücken). Drei seiner vier Zahlen sind
          dieselben Größen wie im Wissenskapital oben — die Wissenslücken standen sogar mit
          IDENTISCHEM Wert dreimal auf einer Seite. Der Block ist weg; seine einzige eigene Zahl
          („Offen") ist ins Wissenskapital gewandert, wo sie neben „davon validiert" gehört. */}
        {/* ==========================================================================================
          A27 (OFFEN.md:81) · JOB 3025 — WAS AN DEN EIGENEN OBJEKTEN KOLLIDIERT.
          ==========================================================================================
          Eine eigene Karte und nicht eine Zeile in „Nächste Handlungen": das hier ist AUSKUNFT über
          eigenes Wissen, keine Arbeit, die die Rolle ausführen darf. Die Expertin darf Konflikte
          nicht auflösen (`conflict.resolve` bleibt `controller`, ENTSCHEIDUNGEN/JOB-1546.md) — sie
          darf und soll aber wissen, dass etwas offen ist.

          Kein Inhalt der Gegenseite (A28, OFFEN.md:165), und keine Zahl ohne Grundlage: steht
          `datenlageKey`, ist die Lage nicht `frisch`, und dann steht hier ein Satz über die
          Datenlage statt über den Bestand. */}
        <Card className="mb-5" data-testid="job3025-kollision-start">
          <h2 className="mb-1 text-[15px] font-semibold text-ink">{t("kollision.start.title")}</h2>
          <p className="text-[12.5px] leading-relaxed text-text">
            {t(kollision.satzKey, { n: kollision.anzahl })}
          </p>
          {kollision.art !== "keine" && kollision.datenlageKey ? (
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-2">
              {t(kollision.datenlageKey)}
            </p>
          ) : null}
          {kollisionsWeg ? (
            <RoleLink
              to={kollisionsWeg.to}
              className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-text"
            >
              {(erreichbar) => (
                <>
                  {kollisionsWegText}
                  {erreichbar ? <ArrowRight size={14} className="shrink-0" /> : null}
                </>
              )}
            </RoleLink>
          ) : null}
          {kollision.wiederholenMoeglich ? (
            <button
              type="button"
              onClick={kollision.erneutPruefen}
              className="mt-1 ml-3 inline-flex items-center text-[12px] font-semibold text-brand-text underline"
            >
              {t("kollision.wiederholen")}
            </button>
          ) : null}
        </Card>
        <div className="grid gap-5">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <h2 className="text-[15px] font-semibold text-ink">{t("start.workTitle")}</h2>
                {shelp("work")}
              </div>
              <RoleLink
                to="/aufgaben"
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-text"
              >
                {() => t("start.allTasks")}
              </RoleLink>
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
            {/* SCRUM-271: bester nächster Einstieg hervorgehoben (kein Auto-Handeln, nur Führung).
              Block C: im Ladezustand NICHT anzeigen (kein erfundener „bester nächster Schritt"). */}
            {!workLoading && !workError && focus ? (
              <RoleLink
                to={focus.to}
                className="mb-3 flex items-center gap-3 rounded-card bg-page p-3"
                hoverClassName="hover:opacity-90"
              >
                {(erreichbar) => (
                  <>
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${WORK_TONE[focus.severity]}`}
                    />
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
                    {erreichbar ? <ArrowRight size={15} className="shrink-0 text-muted-2" /> : null}
                  </>
                )}
              </RoleLink>
            ) : null}
            {/* Block B: Stale-Fall — Daten sind da, ein Refetch scheiterte → sichtbar veraltet markiert. */}
            {workStale ? (
              <div className="mb-3">
                <StaleMarker onRetry={retryWork} />
              </div>
            ) : null}
            <div className="divide-y divide-hairline">
              {workError ? (
                // Block B: dauerhaft gescheitert → ehrlicher Fehlerzustand mit Wiederholen (kein „lädt", keine 0).
                <div className="py-4">
                  <LoadErrorState onRetry={retryWork} />
                </div>
              ) : workLoading ? (
                // Block C: ehrlicher Ladezustand statt vorschnellem „nichts zu tun" (echte 0) aus
                // noch fehlenden Daten.
                <div className="py-4">
                  <p className="text-sm text-muted">{t("start.todoLoading")}</p>
                </div>
              ) : overview.length === 0 ? (
                <div className="py-4">
                  <p className="text-sm text-muted">{t("start.todoEmpty")}</p>
                  <EmptyStateCtas context="start" />
                </div>
              ) : (
                overview.map((it) => (
                  // AUFTRAG-mega51 BLOCK A: DIE Fundstelle des Erstnutzerlaufs. Diese Zeilen waren
                  // uneingeschränkte Links auf vier Controller-Seiten; eine Expertin landete beim
                  // Klick wieder auf /start. Die Zahl bleibt — sie ist wahr —, der Weg entfällt.
                  <RoleLink
                    key={it.key}
                    to={it.to}
                    className="flex items-center gap-3 py-2.5"
                    hoverClassName="hover:opacity-80"
                  >
                    {(erreichbar) => (
                      <>
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${WORK_TONE[it.severity]}`}
                        />
                        <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">
                          {t(`work.${it.key}`)}
                        </span>
                        <span className="shrink-0 font-mono text-[13px] font-semibold text-ink">
                          {it.count}
                        </span>
                        {erreichbar ? (
                          <ArrowRight size={15} className="shrink-0 text-muted-2" />
                        ) : null}
                      </>
                    )}
                  </RoleLink>
                ))
              )}
            </div>
          </Card>
        </div>
        {/* JOB 3015 D5 — der Leitsatz (Zielbild Z.60) als LETZTE Zeile der Startseite. Die Fußleiste
          der App-Hülle (Z.59–62) ist nicht Teil dieses Auftrags; der Satz gehört trotzdem auf diese
          Fläche. Gemessen in tests/design/zielbild-konsole-start.test.ts (V26/V27). */}
        <p className="mt-8 pb-4 text-center text-[11.5px] text-muted-2">
          {t("start.konsole.leitsatz")}
        </p>
      </div>
    </>
  );
}

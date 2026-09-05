import { Mic, Search } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
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
  useNotifications,
  useValidationBoard,
} from "../api/hooks";
// JOB 3015 D5: das Suchfeld der Konsole navigiert wie die Topbar-Suche — durch den Eingabe-Wächter.
import { useGuardedNavigate } from "../app/NavGuardContext";
import { useRole } from "../app/RoleContext";
import { OverflowMenu } from "../components/start/OverflowMenu";
import { Seitenblatt } from "../components/start/Seitenblatt";
import { FuerDichKarte, ZuletztKarte } from "../components/start/StartKarten";
import { StartPanelInhalt } from "../components/start/StartPanel";
import { forYouGesamt, forYouLage, forYouZeilen } from "../components/start/forYou";
import {
  START_PANEL_IDS,
  type StartPanelId,
  startPanelLabelKey,
  startPanelSichtbar,
} from "../components/start/startPunkte";
import { useDiktat } from "../components/start/useDiktat";
// A27 (OFFEN.md:81) · JOB 3025: DIESELBE Funktion wie auf der Detailseite — ein zweiter
// Ableitungsweg wäre genau die Drift, an der JOB 3002 Runde 4 fiel.
import { eigeneKollisionStart } from "../lib/eigeneKollision";
import { notificationTarget } from "../lib/notificationTarget";
import { isStartOrientationFirstRun, markStartOrientationSeen } from "../lib/startOrientation";
import { buildWorkOverview, learningOpenSteps, workSignalsFrom } from "../lib/workCenter";

// ================================================================================================
// JOB 3064 · H5 — DIE STARTSEITE NACH PAGES-MASSSTAB (Zielbild `design/klarwerk/Main.dc.html`).
// ================================================================================================
//
// PEDI, 04.09. 06:50, über die Startseite von JOB 3015: „Text über Text über Text … Absolut
// unmöglich." Sie trug zehn Blöcke gleichzeitig — Konsole mit drei Werbekarten, Zwecksatz,
// Klara-Teaser, Wissenskreis, Orientierungskarte, Demo-Pfad, Live-Wall, Wissenskapital, Lücken,
// Stufe-2-Hinweis, Kollisionskarte, „Nächste Handlungen" und Leitsatz.
//
// Das Zielbild lässt VIER Dinge übrig: die Frage, das Feld, „FÜR DICH" und „ZULETZT". Sonst steht
// nichts im Sichtfeld — gemessen in `tests/design/zielbild-h5-kein-erklaertext.test.ts`
// (innerText von <main> abzüglich Überschrift, Zeilen, Kicker und Knopfbeschriftungen ≤ 40 Zeichen).
//
// UND KEINE FUNKTION GEHT VERLOREN (Pedi 07:58). Jeder der zehn Blöcke hat einen BENANNTEN Ort im
// „…"-Menü oben rechts (`components/start/StartPanel.tsx`); `tests/design/h5-funktionsinventar.test.ts`
// klickt jeden Punkt an und verlangt seinen Inhalt. Was die Fläche selbst übernimmt:
//   · Die drei Konsolenkarten (Suchen · Prüfen · Hinzufügen) werden die Punkte des Kopfbands
//     (JOB 3060). Hier entfällt nur ihre Kachel — die Ziele /fragen, /validierung, /erfassen sind
//     über Kopfband und Seitenleiste unverändert erreichbar.
//   · „Nächste Handlungen" IST „FÜR DICH".
//   · Die Kollisionskarte (JOB 3025) wird eine ZEILE in „FÜR DICH" — und nur im Fall.
//   · Das Suchfeld führt jetzt nach `/fragen?q=…` statt in die Bibliothekssuche: das Zielbild
//     nennt es „Frage oder Suchbegriff" unter der Überschrift „Was möchtest du wissen?", und die
//     Antwort auf eine Frage gibt `/fragen`, nicht die Trefferliste. Der Weg läuft weiter durch den
//     Eingabe-Wächter (`useGuardedNavigate`), also über dasselbe Tor wie bisher.
//
// DAS ZUSTANDSMODELL (§9 des Auftrags) LIEGT IN `components/start/forYou.ts` und ist dort begründet:
// Zeilen und Pille erst nach einem erfolgreichen frischen Abruf; „lädt" zeigt NICHTS; eine Störung
// zeigt keinen erfundenen Bestand, aber ihren Wiederholen-Knopf; ein gescheiterter Nachlauf lässt
// die zuletzt geholten Werte stehen und markiert sie.
export function Start(): JSX.Element {
  const { t } = useTranslation();
  const { role, stufe2 } = useRole();
  const navigate = useGuardedNavigate();

  const [frage, setFrage] = useState("");
  const diktat = useDiktat((text) => setFrage((prev) => (prev ? `${prev} ${text}` : text)));
  const absenden = (e: FormEvent): void => {
    e.preventDefault();
    const begriff = frage.trim();
    navigate(begriff ? `/fragen?q=${encodeURIComponent(begriff)}` : "/fragen");
  };

  // ---- Die drei Quellen von „FÜR DICH" (keine neue: alle drei standen schon auf dieser Seite) ---
  const board = useValidationBoard();
  const conflicts = useConflicts();
  const pending = useLifecyclePending();
  const gapsSummary = useGapsSummary();
  const meldungen = useNotifications();
  const learningPath = useLearningPath(role);
  const learningProgress = useLearningProgress(learningPath.data?.id);
  const kos = useKos();
  const eigeneBefunde = useEigeneBefunde();
  const liveWall = useLiveWall();

  // JOB 1217: der Lernfortschritt gehört nur dann zur Gruppe, wenn es einen Pfad gibt — ohne
  // Pfad-Id bleibt `useLearningProgress` dauerhaft untätig und die Gruppe hinge ewig im Ladezustand.
  const lernfortschrittGehoertDazu = Boolean(learningPath.data?.id);
  const arbeitsQuellen = lernfortschrittGehoertDazu
    ? [board, conflicts, pending, gapsSummary, meldungen, learningProgress]
    : [board, conflicts, pending, gapsSummary, meldungen];
  const lage = forYouLage(arbeitsQuellen);

  // FUNKE-FIX2 P0: die kritischen Lücken kommen aus dem aggregierten Summary (byPriority.hoch),
  // nicht aus geladenen Gap-Volltexten — kein Fragetext gelangt in den Browser.
  const arbeit = buildWorkOverview({
    ...workSignalsFrom({
      board: board.data ?? [],
      conflicts: conflicts.data ?? [],
      revalidation: pending.data ?? [],
      gaps: [],
      learningOpenSteps: learningOpenSteps(learningPath.data, learningProgress.data),
    }),
    criticalGaps: gapsSummary.data?.byPriority.hoch ?? 0,
  });

  // A27 · JOB 3025: die Auskunft über die EIGENEN Objekte. Sie geht als LAGE hinein, nicht als
  // „Daten oder leer" — und sie wird nur dann zur Zeile, wenn die Lage eine Bestandsaussage trägt.
  const kollisionsAuskunft = eigeneKollisionStart({
    befunde: eigeneBefunde,
    konflikte: conflicts,
    kos,
  });
  const kollision =
    kollisionsAuskunft.art === "keine" || !kollisionsAuskunft.bestandGesichert
      ? null
      : {
          satzKey: kollisionsAuskunft.satzKey,
          anzahl: kollisionsAuskunft.anzahl,
          art: kollisionsAuskunft.art,
          to: kollisionsAuskunft.weg?.to ?? null,
        };

  // ==============================================================================================
  // DER ERSTBESUCH — §5a: die Erststart-Karte steht im Menü UND „beim Erstbesuch zusätzlich als
  // Zeile in „Für dich"".
  // ==============================================================================================
  // Der Vermerk aus dem Aufräum-Pass 02.07. bleibt und behält seinen Sinn: er unterscheidet den
  // ersten Besuch vom zweiten. Er klappt nur keine Erklärkarte mehr auf (die gibt es nicht mehr),
  // sondern setzt EINE Zeile in „FÜR DICH" — für Admins, beim ersten Besuch, mit dem Weg in die
  // Verwaltung. Danach ist sie weg; die vollständige Führung bleibt im Menü unter
  // „Ersteinrichtung".
  //
  // WARUM EIN REF: die Rolle löst in zwei Stufen auf (`/auth/status`, dann `/auth/me`). Beim ersten
  // Rendern steht sie noch auf dem Vorgabewert, und der Effekt oben hat den Vermerk da schon
  // gesetzt. Der Ref hält deshalb die Antwort des ERSTEN Rendervorgangs fest — sonst wäre die
  // Zeile für genau die Person unsichtbar, für die sie gedacht ist.
  const erstbesuch = useRef(isStartOrientationFirstRun(window.localStorage));
  const zeilen = forYouZeilen({
    ...(erstbesuch.current && role === "admin"
      ? { ersteinrichtung: { textKey: startPanelLabelKey("erst"), to: "/admin" } }
      : {}),
    arbeit,
    meldungen: (meldungen.data ?? []).map((m) => ({
      id: m.id,
      kind: m.kind,
      title: m.title,
      ...(m.seen === undefined ? {} : { seen: m.seen }),
      ...(m.redacted === undefined ? {} : { redacted: m.redacted }),
      to: notificationTarget(m),
    })),
    kollision,
  });
  const wiederholen = (): void => {
    void board.refetch();
    void conflicts.refetch();
    void pending.refetch();
    void gapsSummary.refetch();
    void meldungen.refetch();
    void liveWall.refetch();
  };

  // ---- Das „…"-Menü ------------------------------------------------------------------------------
  const [blatt, setBlatt] = useState<StartPanelId | null>(null);
  const punkte = START_PANEL_IDS.filter((id) => startPanelSichtbar(id, role, stufe2)).map((id) => ({
    id,
    label: t(startPanelLabelKey(id)),
  }));
  useEffect(() => {
    markStartOrientationSeen(window.localStorage);
  }, []);

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col">
      <div className="flex justify-end">
        <OverflowMenu
          label={t("start.menu.label")}
          punkte={punkte}
          onWahl={(id) => setBlatt(id as StartPanelId)}
          testId="h5-start-menu"
        />
      </div>
      {/* Zielbild Z.36: `flex-grow:1; align-items:center; padding-top:64px; gap:30px`. */}
      <section
        data-testid="page-start"
        aria-labelledby="h5-frage"
        className="flex flex-1 flex-col items-center gap-[30px] pt-16 pb-12"
      >
        <h1 id="h5-frage" className="text-[30px] font-[650] tracking-[-0.3px] text-text">
          {t("start.konsole.frage")}
        </h1>
        {/* Zielbild Z.38: 640 px, Lupe links, Mikrofon rechts, Radius 14, Rahmen, Schatten. */}
        <form
          onSubmit={absenden}
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
            value={frage}
            onChange={(e) => setFrage(e.target.value)}
            aria-label={t("start.konsole.feld")}
            placeholder={t("start.konsole.feld")}
            className="min-w-0 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-muted-2"
          />
          {/* §6: kann der Browser nicht erkennen, FEHLT das Mikrofon einfach — kein toter Knopf,
              kein Satz darunter. Der ehrliche Hinweis dazu steht auf `/fragen` unter „Mehr". */}
          {diktat.moeglich ? (
            <button
              type="button"
              data-testid="h5-start-mikrofon"
              onClick={diktat.umschalten}
              aria-pressed={diktat.laeuft}
              aria-label={diktat.laeuft ? t("ask.diktatStop") : t("ask.diktatStart")}
              title={diktat.laeuft ? t("ask.diktatStop") : t("ask.diktatStart")}
              className={`shrink-0 rounded-btn p-0.5 transition-colors ${
                diktat.laeuft ? "text-brand-text" : "text-muted-2 hover:text-text"
              }`}
            >
              <Mic size={18} strokeWidth={1.8} aria-hidden="true" />
            </button>
          ) : null}
        </form>
        {/* Zielbild Z.43: Raster 900 px, zwei Spalten, Abstand 24 px, Abstand nach oben 18 px. */}
        <div className="mt-[18px] grid w-[900px] max-w-full grid-cols-2 gap-6">
          <FuerDichKarte
            lage={lage}
            zeilen={zeilen}
            gesamt={forYouGesamt(zeilen)}
            onWiederholen={wiederholen}
          />
          {/* Die Lage dieser Karte kommt aus IHRER Quelle (`liveWall`), nicht aus der Gruppe
              nebenan: „Zuletzt" wäre sonst gestört, weil eine Aufgabenquelle klemmt. Ihr
              Wiederholen-Weg holt entsprechend genau diese eine Abfrage nach. */}
          <ZuletztKarte
            lage={forYouLage([liveWall])}
            daten={liveWall.data}
            jetzt={new Date()}
            onWiederholen={() => {
              void liveWall.refetch();
            }}
          />
        </div>
      </section>
      {blatt ? (
        <Seitenblatt
          titel={t(startPanelLabelKey(blatt))}
          testId={`h5-start-blatt-${blatt}`}
          onSchliessen={() => setBlatt(null)}
        >
          <StartPanelInhalt id={blatt} />
        </Seitenblatt>
      ) : null}
    </div>
  );
}

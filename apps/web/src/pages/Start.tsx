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
import { HelpTip } from "../components/HelpTip";
import { RoleLink } from "../components/RoleLink";
import { OverflowMenu } from "../components/start/OverflowMenu";
import { Seitenblatt } from "../components/start/Seitenblatt";
import { FuerDichKarte, ZuletztKarte } from "../components/start/StartKarten";
import { StartPanelInhalt } from "../components/start/StartPanel";
import {
  type ForYouQuelle,
  type Kartenlage,
  auffrischungLaeuft,
  forYouGesamt,
  forYouLage,
  forYouZeilen,
} from "../components/start/forYou";
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
// JOB 3098 · Q6b: der Onlinezustand wird GEREICHT, nicht gedeutet — aus derselben einen Quelle wie
// an den zwei Flächen von JOB 3084 (`components/start/StartPanel.tsx:88`).
import { useNetzOnline } from "../lib/netzzustand";
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

/**
 * EINE Quelle der Karte „FÜR DICH" — und der Typ hält die zwei Enden zusammen (JOB 3098 Runde 2).
 *
 * Bens Befund an Runde 1: die Quellenliste war um `eigeneBefunde` und `kos` gewachsen, der
 * Wiederholen-Weg daneben nicht. Wörtlich: „Nach behobenem Serverfehler erzeugt der Klick jeweils
 * null Abrufe der betroffenen Quelle." Die Karte konnte also in eine Störung geraten, aus der ihr
 * eigener Knopf nicht mehr herausführte — ein Knopf, der die Störung nicht behebt, die er anbietet.
 *
 * Deshalb steht die Liste jetzt genau EINMAL da (`arbeitsQuellen`), und beide Enden lesen sie:
 * `forYouLage()` den Zustand, `wiederholen()` das `refetch`. Eine Quelle hinzuzufügen, ohne den Weg
 * heraus mitzunehmen, ist damit keine Nachlässigkeit mehr, sondern unmöglich.
 */
type Arbeitsquelle = ForYouQuelle & { readonly refetch: () => unknown };

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

  // JOB 3098 · Q6b: EINE Ablesung des Netzes für diese ganze Fläche — die Kollisionsregel und die
  // Lage der Karte müssen von demselben Zustand sprechen, sonst trüge die Karte die Markierung,
  // während die Zeile schweigt, oder umgekehrt.
  const netzOnline = useNetzOnline();

  // JOB 1217: der Lernfortschritt gehört nur dann zur Gruppe, wenn es einen Pfad gibt — ohne
  // Pfad-Id bleibt `useLearningProgress` dauerhaft untätig und die Gruppe hinge ewig im Ladezustand.
  const lernfortschrittGehoertDazu = Boolean(learningPath.data?.id);
  // JOB 3098 · Q6b, LIEFERUNG 4: `eigeneBefunde` und `kos` stehen hier, weil die Kollisionszeile
  // ALLEIN aus ihnen entsteht — eine Karte, die Frische behauptet, muss jede Quelle kennen, aus der
  // eine ihrer Zeilen kommt. Bis hierher fehlten sie: lud die KO-Liste noch oder war der
  // Signal-Abruf gescheitert, galt die Karte trotzdem als frisch und schrieb „Nichts offen." unter
  // eine Zeile, die es nur deshalb nicht gab. Dieselbe Regel, aus der `eigeneKollision.ts:485-493`
  // die KO-Liste in die Gesamtlage der Auskunft nimmt.
  const arbeitsQuellen: readonly Arbeitsquelle[] = lernfortschrittGehoertDazu
    ? [board, conflicts, pending, gapsSummary, meldungen, learningProgress, eigeneBefunde, kos]
    : [board, conflicts, pending, gapsSummary, meldungen, eigeneBefunde, kos];
  const lage = forYouLage(arbeitsQuellen, netzOnline);
  // JOB 3118 Runde 2/3 (Bens Korrekturpflicht 1): dieselbe Liste beantwortet auch die Frage, ob
  // gerade ein Abruf LÄUFT. Solange einer läuft, steht weder eine Verneinung des Bestands noch ein
  // Satz über den LETZTEN Versuch noch ein zweiter Wiederholen-Knopf — die Werte bleiben, die
  // Behauptung geht. Die drei Angaben gehen als EIN Bündel in die Karte, damit keine der drei
  // Entscheidungen eine davon verpasst. Kein zweiter Quellensatz, sonst liefen Lage und
  // Auffrischung auseinander (derselbe Grund wie bei `wiederholen()` unten).
  const kartenlage: Kartenlage = {
    lage,
    online: netzOnline,
    auffrischung: auffrischungLaeuft(arbeitsQuellen),
  };

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
  // „Daten oder leer" — und sie wird nur dann zur Zeile, wenn ein Befund feststeht.
  const kollisionsAuskunft = eigeneKollisionStart(
    {
      befunde: eigeneBefunde,
      konflikte: conflicts,
      kos,
    },
    netzOnline,
  );
  // JOB 3098 · Q6b, LIEFERUNG 3 — WARUM HIER NICHT MEHR `bestandGesichert` STEHT.
  //
  // `bestandGesichert` ist genau `lage === "frisch"`. Sobald die Fläche den Onlinezustand wirklich
  // reicht, kippt es beim Netzverlust auf `false` — und die Zeile eines BEREITS BEKANNTEN Befunds
  // wäre still verschwunden. Das ist A27 rückwärts: „eine Kollision, die der Autorin verschwiegen
  // wird" (`lib/eigeneKollision.ts:439-441`). Der Befund verschwindet nie; er wird eingeordnet —
  // die Karte trägt dafür den Datenlagesatz (`components/start/StartKarten.tsx`, `Datenlagezeile`),
  // der aus derselben Netzablesung entsteht.
  //
  // Was `standVorhanden` dagegen wirklich ausschließt, ist die andere Erfindung: eine Zeile OHNE
  // jeden früheren Stand. Eine Verneinung entsteht HIER in keiner Lage — die Karte zeigt ihre
  // Zeilen nur, wenn `forYouLage` das erlaubt.
  //
  // Die Verneinung der KARTE („Nichts offen.") stand bis JOB 3118 auch aus einem ruhenden
  // Zwischenspeicher da. Sie hängt jetzt an `entwarnungErlaubt()` (`components/start/forYou.ts`)
  // und entsteht nur noch aus `frisch` — dieselbe Regel, die hier `standVorhanden` durchsetzt.
  const kollision =
    kollisionsAuskunft.art === "keine" || !kollisionsAuskunft.standVorhanden
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
  // JOB 3098 · Q6b RUNDE 2, KORREKTURPFLICHT 1: der Weg heraus führt über GENAU die Quellen, die
  // hineinführen — dieselbe Liste, keine zweite. `liveWall` steht bewusst nicht darunter: sie trägt
  // die Karte „ZULETZT" und hat ihren eigenen Weg (s. unten). Ein Wiederholen, das eine fremde
  // Quelle mitzieht und eine eigene auslässt, war der Fehler, nicht das Versehen.
  const wiederholen = (): void => {
    for (const quelle of arbeitsQuellen) {
      void quelle.refetch();
    }
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
      {/* ==========================================================================================
          JOB 3669 — DIE SEITENHILFE DIESER SEITE. SIE STEHT IM ZAHNRAD, NICHT IM BILD.
          ==========================================================================================
          Pedi (11.09.): eine Person, die noch nie mit Klarwerk gearbeitet hat, soll sich „relativ
          schnell einarbeiten". `/start` hatte dafür bis hierher KEINE Hilfequelle: das Zahnrad-Menü
          zeigte unter „Seitenhilfe" den Leersatz, und die drei Erklärstücke von `startHelp`
          (Wissenskreis, Arbeitsübersicht, Dringlichkeitspunkte) liegen im „…"-Menü dieser Seite —
          sie erklären BLÖCKE, nicht die Seite. Dieser eine Text erklärt die Seite: was sie ist, was
          man hier tun kann, was der nächste Schritt ist. Er wiederholt die drei nicht.

          `HelpTip` rendert NICHTS (`components/HelpTip.tsx`) — er meldet Titel und Text bei der
          Seitenhilfe an. Das Zielbild dieser Seite (≤ 40 Zeichen Erklärtext im Sichtfeld,
          `tests/design/zielbild-h5-kein-erklaertext.test.ts`) bleibt damit unberührt, und Pedis
          Vorgabe vom 04.09. — „Erklärung gehört hinter Zahnrad/Profil, nicht ins Sichtfeld" —
          auch. Eine Sprechblase oder eine Tour ist hier ausdrücklich NICHT gebaut. */}
      <HelpTip title={t("seitenhilfe.start.title")} body={t("seitenhilfe.start.body")} />
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
        {/* ==========================================================================================
            JOB 3266 (D1) — „MEINE ENTWÜRFE" STEHT AUF DER STARTSEITE.
            ==========================================================================================
            PEDIS BEFUND (Vorführung 07.09.): Er hatte ein Dokument importiert und als Entwurf
            gesichert. Beim nächsten Besuch — neue Anmeldung, kein `?draft=`-Link in der Hand —
            fand er ihn NICHT wieder. Die Startseite nannte den Weg nicht, und in der Erfassung lag
            er hinter einem Symbolknopf ohne Wort.

            DIE STARTSEITE IST DER ORT, an dem der Besuch beginnt; also steht der Weg hier, mit dem
            Wort, das der Mensch sucht. Er ist ein echter Link: Tab erreicht ihn, Enter geht ihn,
            den sichtbaren Fokusring bringt die globale `*:focus-visible`-Regel mit (index.css).

            ER FÜHRT ZUR EINEN LISTE UND BAUT KEINE ZWEITE: `/erfassen?entwuerfe=1` öffnet die
            vorhandene Entwurfsfläche des Blattes (`components/erfassen/Blatt.tsx`, dort steht die
            Begründung). Eine zweite Titelliste auf der Startseite wäre ein zweiter Abruf, ein
            zweiter Leerzustand und ein zweiter Öffnungsweg für dieselbe Zusage.

            `RoleLink` UND NICHT `Link`: `/erfassen` verlangt die Rolle „Experte"
            (`app/navigation.ts:123`). Wer sie nicht hat, hat auch keine eigenen Entwürfe — die
            Angabe verschwindet trotzdem nicht, sie hört auf, ein Weg zu sein. Das ist die Regel,
            die auf dieser Seite schon für jede andere Zeile gilt (mega51 Block A).

            DAS WORT IST DASSELBE WIE AM BLATT (`fd.saved.toDrafts`, DE „Meine Entwürfe", EN „My
            drafts"): ein zweiter Schlüssel mit gleichem Wortlaut wäre die Bauform, in der die zwei
            Türen zu einer Liste eines Tages verschieden heissen. */}
        <RoleLink
          to="/erfassen?entwuerfe=1"
          testId="h5-start-entwuerfe"
          className="text-[13px] text-muted-2 underline underline-offset-2"
          hoverClassName="hover:text-text"
        >
          {() => t("fd.saved.toDrafts")}
        </RoleLink>
        {/* Zielbild Z.43: Raster 900 px, zwei Spalten, Abstand 24 px, Abstand nach oben 18 px —
            gemessen wird das an einem 1280-px-Fenster (`tests/design/zielbild-h5-start.test.ts:356`,
            V14). Das Zielbild beschreibt den Schreibtisch, nicht das Telefon.

            JOB 3118 · UX-17 (N-0034): bis hierher stand `grid-cols-2` FEST, ohne Bruchpunkt. Bei
            390 px teilten sich die zwei Karten die Breite abzüglich 24 px Abstand — je Karte rund
            150 px, davon gingen Symbol, Abstände und Datum ab, und der sichtbare Titel schrumpfte
            auf „N…"/„Ko…". Unterhalb von `sm` (640 px) liegen die Karten deshalb UNTEREINANDER in
            voller Breite; ab `sm` bleibt alles, wie es gemessen ist. */}
        <div className="mt-[18px] grid w-[900px] max-w-full grid-cols-1 gap-6 sm:grid-cols-2">
          <FuerDichKarte
            kartenlage={kartenlage}
            zeilen={zeilen}
            gesamt={forYouGesamt(zeilen)}
            onWiederholen={wiederholen}
          />
          {/* Die Lage dieser Karte kommt aus IHRER Quelle (`liveWall`), nicht aus der Gruppe
              nebenan: „Zuletzt" wäre sonst gestört, weil eine Aufgabenquelle klemmt. Ihr
              Wiederholen-Weg holt entsprechend genau diese eine Abfrage nach. */}
          <ZuletztKarte
            kartenlage={{
              lage: forYouLage([liveWall], netzOnline),
              online: netzOnline,
              auffrischung: auffrischungLaeuft([liveWall]),
            }}
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

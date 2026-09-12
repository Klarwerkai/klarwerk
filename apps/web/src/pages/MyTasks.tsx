import { ChevronRight, Info } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  useAudit,
  useConflicts,
  useGaps,
  useKos,
  useLifecyclePending,
  useValidationBoard,
} from "../api/hooks";
import { useSession } from "../app/AuthContext";
import { readHistoryIndex } from "../app/navHistory";
import { EmptyStateCtas } from "../components/EmptyStateCtas";
import { HelpTip } from "../components/HelpTip";
import { StaleMarker } from "../components/LoadState";
import { KoAuthorLine } from "../components/trust";
import { PageHeader } from "../components/ui";
import { gapLocaleTag } from "../lib/gapLocaleTag";
import { type KoAuthorParts, koAuthorParts } from "../lib/koAuthor";
import { groupLoadPhase, isGroupStale } from "../lib/loadingState";
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
import {
  type Verlaufsort,
  begrenzteListenposition,
  leseListenposition,
  merkeListenposition,
  taskFilterFromParams,
  verwirfUeberholtePositionen,
  writeTaskFilterToParams,
} from "../lib/taskViewState";
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
//
// ------------------------------------------------------------------------------------------------
// JOB 3462 · REVIEW26 — GESTALTUNGSVERMERK: DIE ZEILE IST SCHMALFEST, NICHT NEU.
// ------------------------------------------------------------------------------------------------
// Der Prüferlauf vom 08.09. fand bei 390 px Titel und Phasen nach wenigen Worten mit „…" gekappt;
// der lange eigene Reviewtitel war nicht eindeutig lesbar. Der Titel darf deshalb auf ZWEI Zeilen
// umbrechen und wird erst danach gekürzt — zwei Zeilen genügen jedem Titel des Belegs, während eine
// Liste aus fünfzeiligen Titeln keine Liste mehr wäre, sondern eine Textwand (die von JOB 3064
// oben). Für den Restfall liegt der volle Titel im `title`-Attribut. Die Phase hat Vorrang vor dem
// Kürzen, weil sie die Aussage „was ist als Nächstes zu tun" trägt; ein Typ ohne Phase ist eine
// halbe Auskunft, also bricht der Meta-Anfang um statt zu kürzen, und die `shrink-0`-Anhänge
// behalten ihren Platz hinter ihm. Bei Desktopbreite ändert sich nichts: alles bleibt einzeilig.
// Gemessen in Chromium: `tests/review26-aufgaben-schmal/aufgaben-schmal-chromium.test.ts`.

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

  // ==============================================================================================
  // JOB 3101 · UX-04 — DIE ADRESSZEILE IST DER EINZIGE ORT DER FILTERWAHL.
  // ==============================================================================================
  // Bis hierher stand hier `useState<TaskFilterKey>("all")`. Jede Aufgabenzeile navigiert per
  // `<Link>` fort, die Seite wird ausgehängt, und beim Zurückkommen lief `useState("all")` erneut an:
  // die Wahl war weg. Ab hier steht sie in der Adresse — teilbar, reload-fest, und sie kommt beim
  // Browser-Zurück von selbst mit, weil der Verlaufseintrag sie trägt.
  //
  // SCRUM-158 bleibt unberührt: Filtermenge, Reihenfolge und Zähler kommen weiter aus
  // `lib/taskFilters.ts`. Es gibt KEINEN zweiten Zustandsort daneben — kein `useState`, kein
  // Speicher, kein nachgeführter Effekt (der wäre die Endlosschleife zwischen Lesen und Schreiben).
  const [params, setParams] = useSearchParams();
  const taskFilter = taskFilterFromParams(params);
  const setTaskFilter = (key: TaskFilterKey): void => {
    // `replace`: fünf Filterklicks dürfen einen Reviewer nicht fünf Zurück-Schritte kosten, bis er
    // die vorige Seite erreicht. Und der Verlaufsindex bleibt derselbe — daran hängt unten die
    // gemerkte Listenposition.
    setParams((prev) => writeTaskFilterToParams(prev, key), { replace: true });
  };
  const counts = countTasksByFilter(tasks);

  // Der gemeinsame, ehrliche Ladevertrag (`lib/loadingState.ts`) über GENAU die Quellen, aus denen
  // die Liste oben gebaut ist. Zusammengehörig und atomar: erst wenn jede geliefert hat, darf über
  // den Bestand etwas ausgesagt werden. Ein gescheiterter Refetch bei vorhandenen Daten bleibt
  // `loaded` — die Liste bleibt sichtbar, sie schlägt nicht auf „Nichts offen." um.
  const quellen = [board, conflicts, lifecycle, gaps, audit, kos];
  const ladephase = groupLoadPhase(quellen);

  // ==============================================================================================
  // JOB 3762 · RUNDE 2 — „NICHTS OFFEN." DARF NICHT AUS EINEM GESCHEITERTEN NACHLAUF KOMMEN.
  // ==============================================================================================
  // Der Kommentar darüber beschreibt die eine Hälfte richtig: ein gescheiterter Refetch bei
  // vorhandenen Daten bleibt `loaded`, die Liste bleibt stehen (REGELN §7, erster Satz). Die ZWEITE
  // Hälfte desselben Satzes fehlte hier: „mit dem Hinweis Stand von <Zeit> · Auffrischung
  // fehlgeschlagen". Ohne sie stand „Nichts offen." — eine Tatsachenaussage über JETZT — unverändert
  // da, obwohl der letzte Versuch, das nachzuprüfen, gescheitert war. Das ist genau der Fehler, den
  // JOB 3118 auf der Startseite behoben hat und den Auftrag §9 („Cache mit gescheiterter
  // Auffrischung") für JEDE der drei Flächen verlangt.
  //
  // KEIN DRITTER WEG (Auftrag §5 Lieferung 6): die Markierung ist der vorhandene `StaleMarker`
  // (`components/LoadState.tsx:30`) mit dem vorhandenen Satz `loadstate.stale` — dasselbe Bauteil,
  // das Analytics und Bereitschaft schon tragen, und derselbe Wortlaut wie in der Datenlagezeile der
  // Startseite. `isGroupStale()` beantwortet die Frage über GENAU dieselben Quellen wie `ladephase`
  // darüber; eine zweite Quellenliste wäre die Drift, gegen die `arbeitsQuellen` auf `pages/Start.tsx`
  // gebaut ist. Gemessen in `tests/demo-leerbestand/aufgaben-leerbestand.test.tsx` (L5-Auf-c).
  //
  // OFFEN UND BENANNT: der ANGEHALTENE Abruf (offline) ist damit nicht abgedeckt — `isGroupStale`
  // kennt nur `isError`, und „Auffrischung fehlgeschlagen" wäre offline die falsche Auskunft (die
  // Lehre aus JOB 3118). Dafür fehlt ein Offline-Bauteil neben `StaleMarker`, und das liegt in
  // `components/LoadState.tsx` — ausserhalb der Zielpfade dieses Auftrags. L5-Auf-d hält den
  // Ist-Zustand fest.
  const nachlaufGescheitert = isGroupStale(quellen);
  const erneutHolen = (): void => {
    for (const quelle of quellen) {
      void quelle.refetch();
    }
  };

  // ── Die Listenposition überlebt das Öffnen einer Aufgabe ──────────────────────────────────────
  // Gerechnet wird in `lib/taskViewState.ts`; hier wird nur gelesen und gesetzt.
  //
  // Der Ort wird beim EINTRITT festgehalten und im Ref gehalten. Das ist kein Stil, sondern
  // notwendig: klickt der Reviewer eine Zeile, stempelt der Router den NEUEN Verlaufsindex, BEVOR
  // React diese Seite aushängt. Ein `readHistoryIndex()` im Aufräumer läse also den Eintrag der
  // Aufgabe und legte die Position unter dem falschen Schlüssel ab.
  //
  // `key` aus `useLocation()` ist die Kennung DIESES Verlaufseintrags. Sie muss mit hinein, weil der
  // Index allein nach einem Zurück und einem neuen PUSH erneut vergeben wird — der frische Besuch
  // erbte sonst die Stelle des abgeschnittenen alten Eintrags (Korrekturpflicht 1, BEN Runde 2).
  // Sie ändert sich auch beim Filterklick (`replace` legt einen neuen Eintrag an); genau deshalb
  // steht sie in der Abhängigkeitsliste, und genau deshalb räumt `verwirfUeberholtePositionen` den
  // ersetzten Zwilling desselben Verlaufsplatzes weg.
  const { pathname, key: eintragsSchluessel } = useLocation();
  const listenort = useRef<Verlaufsort | null>(null);
  useLayoutEffect(() => {
    const ort: Verlaufsort = {
      pfad: pathname,
      index: readHistoryIndex(),
      eintrag: eintragsSchluessel,
    };
    listenort.current = ort;
    verwirfUeberholtePositionen(ort);
    // Nur so weit, wie die Liste JETZT reicht: eine erledigte Aufgabe macht sie kürzer, und ein
    // Sprung ins Leere wäre schlimmer als gar keiner. Auf einen späteren, längeren Stand wird
    // ausdrücklich nicht gewartet.
    const machbar = document.documentElement.scrollHeight - window.innerHeight;
    const ziel = begrenzteListenposition(leseListenposition(ort), machbar);
    if (ziel !== null) {
      window.scrollTo(0, ziel);
    }
    return () => {
      const verlassen = listenort.current;
      if (verlassen) {
        merkeListenposition(verlassen, window.scrollY);
      }
    };
  }, [pathname, eintragsSchluessel]);
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

  // JOB 3101 · UX-04, Lieferung 5: „Nichts offen." und der gefilterte Leersatz sind Aussagen über
  // den BESTAND — sie dürfen nur fallen, wenn der Bestand wirklich da ist.
  //
  // WARUM DAS ERST JETZT AUFFÄLLT: Solange der Filter in `useState("all")` lag, sah man den Satz
  // beim ersten Anstrich praktisch nie. Mit dem Deep-Link (`/aufgaben?art=conflict`) gilt die
  // Auswahl SOFORT, die gefilterte Liste ist im ersten Anstrich leer — und der Satz stünde mitten im
  // Ladezustand da und behauptete etwas über Daten, die noch niemand gesehen hat.
  const leersatzGilt = ladephase === "loaded";

  return (
    <div className="mx-auto max-w-4xl">
      {/* ==========================================================================================
          JOB 3669 — DIE SEITENHILFE DIESER SEITE (Zahnrad → „Seitenhilfe").
          ==========================================================================================
          Vorhanden war hier nur der Nav-Erklärsatz aus `help.tasks.*` („Hier sammeln sich die dir
          zugewiesenen Validierungs- und Rückfrage-Aufgaben …"), den das Zahnrad-Menü aus der Route
          ableitet. Er nennt nicht, was die Fläche BEDIENBAR macht: die drei Dringlichkeitsfarben,
          die Filterreihe mit ihren echten Zahlen, das „i" je Zeile (der Erklärsatz „was ist zu
          tun") und den Knopf „Wie geht es weiter?" im Leerzustand. Der Tipp hier ergänzt genau das
          und wiederholt den Kapitelsatz nicht.

          Er rendert nichts im Sichtfeld (`components/HelpTip.tsx`): die Zeilenform von JOB 3064
          bleibt unverändert. */}
      <HelpTip title={t("seitenhilfe.aufgaben.title")} body={t("seitenhilfe.aufgaben.body")} />
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
            {/* Ein Zähler ist eine Datenaussage: solange nicht jede Quelle geliefert hat, stünde
                dort eine Zahl, die Vollständigkeit behauptet (§9). Die AUSWAHL dagegen ist eine
                Nutzerangabe und färbt das Segment auch im Ladezustand. */}
            {t(`task.filter.${f.key}`)} {ladephase === "loaded" ? counts[f.key] : "…"}
          </button>
        ))}
      </fieldset>
      <div className="space-y-6">
        {/* Über der Liste und nicht in ihr: der Satz gilt für ALLES, was darunter steht — für die
            Zeilen ebenso wie für „Nichts offen.". Dieselbe Stelle, an der die Bibliothek ihren
            gleichlautenden Hinweis trägt (`BibliothekListe.tsx:326`). */}
        {nachlaufGescheitert ? (
          <div data-testid="task-stand-veraltet">
            <StaleMarker onRetry={erneutHolen} />
          </div>
        ) : null}
        {gesamtSichtbar === 0 ? (
          // GENAU EINE Zeile für die ganze Liste — und der Weg dahinter bleibt derselbe Knopf mit
          // denselben `EmptyStateCtas`. Beim gefilterten Leerstand nennt der Satz den Filter als
          // Grund; ein „Wie geht es weiter?" wäre dort die falsche Auskunft, denn offen ist etwas,
          // nur nicht in dieser Auswahl.
          <div className="overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-tile">
            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex-1 text-[14px] text-text">
                  {ladephase === "loading"
                    ? t("state.loading")
                    : ladephase === "error"
                      ? t("loadstate.error.title")
                      : taskFilter === "all"
                        ? t("task.none")
                        : t("task.noneFiltered")}
                </span>
                {leersatzGilt && taskFilter === "all" ? (
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
              {leersatzGilt && taskFilter === "all" ? (
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
                        {/* JOB 3462: `line-clamp-2` ist die EINZIGE Kürzungsregel am Titel — zwei
                            Zeilen, dann „…"; kein `truncate` mehr. `break-words` bricht auch ein
                            überlanges Einzelwort, statt es aus dem Rahmen ragen zu lassen. */}
                        <span
                          title={it.label}
                          className="line-clamp-2 break-words text-[14px] text-text"
                        >
                          {it.label}
                        </span>
                        {/* §4: EINE Meta-Zeile statt vier Pillen — Typ · Phase · Sprache ·
                              Häufigkeit · Review-Zustand.
                              GAP-SPRACHHERKUNFT / JOB 1111 D-032: Sprach-Etikett und Häufigkeit
                              bleiben `shrink-0` und stehen AUSSERHALB des kürzbaren Teils. Genau
                              das war ihr Bauzweck: als Anhang am Titel fielen sie dem `truncate`
                              zuerst zum Opfer — bei den langen Titeln, für die sie gedacht sind.
                              Der kürzbare Teil ist der Anfang der Meta-Zeile.
                              JOB 3462: dieser Anfang KÜRZT nicht mehr, er bricht um (`break-words`,
                              kein `truncate`) — die Phase verschwand im Schmalfall als Erstes. Die
                              Anhänge stehen weiter in ihrer Reihenfolge hinter ihm; ist die Zeile
                              voll, rücken sie geschlossen in die nächste (`flex-wrap`, derselbe
                              Mechanismus wie die Aufgabenzeile selbst). */}
                        <span
                          data-testid="task-meta"
                          className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-[12.5px] text-muted-2"
                        >
                          <span className="min-w-0 break-words">
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

// ================================================================================================
// JOB 3061 · H2 — REITER „OFFEN": LINKS DIE WARTESCHLANGE, RECHTS EINE KARTE, SONST NICHTS.
// ================================================================================================
//
// WAS HIER BIS 04.09.2026 STAND und warum es weg ist: 1537 Zeilen mit eigenem Seitenkopf
// („Validation Board"), einem Einleitungssatz, einer Herkunfts-Pillenzeile, einer Fokus-Pillenzeile,
// einer Zeile „aktive Fokusfilter", einer Filterleiste mit vier Feldern und zwei Kästchen, einer
// Facettenschiene und darunter Karten mit acht Etiketten, zwei Aufklappern, einer Leitkarte und
// einem zweizeiligen Fußband. Pedi 04.09. 06:50: „so irreführend und so unübersichtlich".
//
// WAS STATT DESSEN DA IST (design/klarwerk/Pruefen.dc.html): der gemeinsame Reiterkopf „Prüfen",
// links die 260px-Warteschlange, rechts EINE Karte — Pille, Meta, Titel, Text, Quellen-Chips,
// „Mehr" (zu) und ein Fußband mit Freigeben / Rückfrage / Ablehnen und den drei Stimmenpunkten.
//
// NICHTS GEHT VERLOREN (Pedi 04.09. 07:58, Auftrag §11). Jede Funktion, die aus dem Sichtfeld geht,
// hat einen benannten Ort bekommen — die Tabelle steht in der RUECKGABE und wird in der GEBAUTEN
// Fläche von `tests/design/h2-funktionsinventar.test.ts` Zeile für Zeile angeklickt:
//
//   Volltext, Wissensart, Kategorie, Tag, Review-Fokus, Herkunft, „Mir zugewiesen",
//   „KI-Prüfung läuft", Zurücksetzen, Facettenschiene ......... Filter-Menü neben dem Segment
//   Leitkarte, Entscheidungswirkung, alle ?-Hilfen ............ „?"-Menü neben dem Titel
//   Als wahr kennzeichnen, Zuweisen, Bearbeiten, Löschen,
//   Details ansehen, KI-Prüfung wiederholen .................. „···"-Menü an der Karte
//   Vertrauen, Stimmen, veraltete Stimmen, KI-Prüfstatus,
//   Stufe, Erfassungsweg, Kategorie/Art/Tags, Wirkung,
//   Autorzeile, Review-Kontext, letzte Entscheidung .......... „Mehr" unter dem Text
//
// DIE ZUSTANDSREGELN (Auftrag §9, Regelwerk §7) SIND UNVERÄNDERT SCHARF:
//   · Eine gescheiterte AUFFRISCHUNG löscht die Warteschlange nicht — sie bekommt eine Zeile.
//   · Ein Erstfehler (nie eine Antwort) bleibt eine Fehlerfläche mit „Erneut laden".
//   · Kein „Freigegeben" ohne 2xx: die Knöpfe sind bis zur Serverantwort gesperrt.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Lock,
  Minus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useDirectory, useDuplicates, useReasonerStatus, useValidationBoard } from "../api/hooks";
import type { Confidentiality, KnowledgeObject } from "../api/types";
import { useSession } from "../app/AuthContext";
import { useRole } from "../app/RoleContext";
import { useToast } from "../app/ToastContext";
import { AiCheckBadge } from "../components/AiCheckBadge";
import { DemoBanner } from "../components/DemoBanner";
import { EmptyStateCtas } from "../components/EmptyStateCtas";
import { FacetFilter } from "../components/FacetFilter";
import { ValidationReviewContext } from "../components/ValidationReviewContext";
import { PruefenKopf } from "../components/pruefen/PruefenKopf";
import { PruefenMehr, PruefenMehrBlock, PruefenMehrZeile } from "../components/pruefen/PruefenMehr";
import {
  PruefenHilfeBlock,
  PruefenMenue,
  PruefenMenueEintrag,
  PruefenMenueTrenner,
} from "../components/pruefen/PruefenMenue";
import { MenueSymbol, PruefenPille } from "../components/pruefen/PruefenPaar";
import {
  PruefenErstfehler,
  PruefenNichtFrisch,
  PruefenPlatzhalter,
  PruefenSatz,
} from "../components/pruefen/PruefenZustand";
import { flaechenZustand } from "../components/pruefen/zaehler";
import { ConfidenceBar, KnowledgeTypeTag, KoAuthorLine } from "../components/trust";
import { Button, cx } from "../components/ui";
import { aiModelUsable } from "../lib/aiAvailability";
import { AI_CHECK_POLL_MS } from "../lib/aiCheckStatusCard";
import { type PruefZeile, boardZeilen, stufenFacetLabelKey } from "../lib/boardAuskunft";
import {
  DEMO_KNOWLEDGE_FILTERS,
  type DemoKnowledgeFilter,
  demoKnowledgeFilterLabelKey,
  matchesDemoKnowledgeFilter,
  ownKnowledgeEmptyHint,
  readDemoKnowledgeFilter,
} from "../lib/demoKnowledge";
import { isDemoContext } from "../lib/demoPilotPath";
import { clearFacetSelection } from "../lib/facetFilter";
import { EMPTY_RAIL_UI, type FacetRailUiState, facetRailGroups } from "../lib/facetRail";
import {
  type FacetSelection,
  applyFacetSelection,
  isFacetGroupActive,
  toggleFacetValue,
} from "../lib/facets";
import { koAuthorParts } from "../lib/koAuthor";
import { formatKoTimestamp } from "../lib/koDates";
import {
  REVIEW_DECISIONS,
  type ReviewVerdict,
  reviewNextSteps,
  reviewOutcome,
} from "../lib/reviewDecision";
import {
  DECISION_IMPACTS,
  DECISION_TRUST_NOTE_KEY,
  REVIEW_CHECK_ITEMS,
  decisionImpact,
  reviewGuidanceFocusKey,
} from "../lib/reviewGuidance";
import { REVIEW_HELP_TOPICS } from "../lib/reviewHelp";
import { reviewSignals, reviewWorkView, sortByReviewPriority } from "../lib/reviewSignals";
import { useAuthorName } from "../lib/useAuthorName";
import { useReadiness } from "../lib/useReadiness";
import {
  type ValidationAiGate,
  boardHasPendingAiCheck,
  validationAiGate,
} from "../lib/validationAiGate";
import {
  applyBoardFocusParams,
  boardEmptyKind,
  boardFocusActive,
  resetBoardFocusParams,
} from "../lib/validationBoardFocus";
// SCRUM-416: Flächen-Klick öffnet die Karte — Bedienelemente bleiben davon unberührt.
import { cardClickOpens } from "../lib/validationCard";
import {
  isStaleKoDeleteError,
  withDeletedKoId,
  withoutKoById,
  withoutKoIds,
} from "../lib/validationDelete";
// JOB 3112 · V3: der Paarhinweis auf der Prüfkarte („es gibt ein zweites Exemplar").
import { doppelhinweis } from "../lib/validationDoppelhinweis";
import {
  VALIDATION_FACET_CONFIGS,
  VALIDATION_MORE_FILTERS_STORAGE_KEY,
  VALIDATION_PILL_FACET_KEYS,
  VALIDATION_SECONDARY_FACET_KEYS,
  validationFacetValues,
} from "../lib/validationFacets";
import {
  type FeedbackVerdict,
  buildValidationFeedback,
  isFeedbackSubmittable,
} from "../lib/validationFeedback";
import {
  EMPTY_VALIDATION_FILTER,
  type ValidationFilterState,
  applyMineOnlyParam,
  categoryOptions,
  matchesValidationFilter,
  mineQueueEmptyHint,
  readMineOnlyFilter,
  tagOptions,
  typeOptions,
} from "../lib/validationFilters";
import {
  REVIEW_FOCUS_FILTERS,
  type ReviewFocusFilter,
  countByReviewFocus,
  matchesReviewFocus,
  readReviewFocusFilter,
  reviewFocusLabelKey,
  validationReviewContext,
} from "../lib/validationReviewContext";
// JOB 3112 · V3: die Regel der Stufenfrage — gefragt, nicht erzwungen (Pedi, Entscheidung 32).
import {
  FreigabeFehler,
  OHNE_STUFE,
  STUFENFRAGE_WAHLEN,
  type StufenAntwort,
  brauchtStufenfrage,
  freigabeFehlerUrsache,
  gespeicherteStufeAusFehler,
  stufeAusAntwort,
} from "../lib/validationStufenfrage";
import { NARROW_QUERY, useMediaQuery } from "../shell/useMediaQuery";

// SCRUM-365: Textfarbe der Entscheidungswirkungen im „?"-Menü (Grün/Gelb/Rot).
const IMPACT_TEXT_TONE: Record<"pos" | "warn" | "crit", string> = {
  pos: "text-trust-pos-text",
  warn: "text-trust-warn-text",
  crit: "text-trust-crit-text",
};

// Wie lange die Quittung im Fußband steht (Auftrag §5.3: „eine Zeile ‚Freigegeben' 3 s im Fuß").
const QUITTUNG_MS = 3000;

// JOB 3504: ab wie viel angesammeltem Radweg die Auswahl einen Artikel weiterrückt. Ein Rastpunkt
// eines gewöhnlichen Mausrads misst 100 px und schaltet damit genau einmal; ein Trackpad schickt
// Zehntel davon, und ohne diese Schwelle rauschte die Auswahl bei der kleinsten Handbewegung durch
// die halbe Liste. Gehalten von `tests/pruefen-listennavigation/mausrad.test.tsx`.
const RAD_SCHWELLE_PX = 40;

// Ein Radereignis meldet seinen Weg in Pixeln (0), Zeilen (1) oder Seiten (2) — Firefox liefert für
// eine Raste `deltaMode: 1, deltaY: 3`. Ohne Umrechnung wären drei Zeilen drei Pixel und keine Raste
// erreichte je die Schwelle.
const RAD_MASS_PX: Record<number, number> = { 0: 1, 1: 16, 2: 400 };

/**
 * JOB 3112 · V3 — die zwei Wege, auf denen ein Wissensobjekt die Prüffläche FREIGEGEBEN verlässt.
 * `rate` ist der Knopf „Freigeben" im Fußband (Recht `ko.validate`), `admin` das „Als wahr
 * kennzeichnen" im „···"-Menü (Recht `users.manage`). Beide bekommen dieselbe Stufenfrage davor;
 * die Rückfrage („Wirklich?") und die Ablehnung sind ausdrücklich KEINE Freigabe und stehen
 * deshalb nicht in dieser Aufzählung.
 */
type Freigabeweg = "rate" | "admin";

export function Validation(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [params, setSearchParams] = useSearchParams();
  const query = useValidationBoard();
  const users = useDirectory();
  // JOB 3112 · V3: die Quelle des Paarhinweises. KEIN zusätzlicher Netzabruf — der gemeinsame
  // Reiterkopf zieht `["duplicates"]` schon für seinen Zähler (`PruefenKopf.tsx:56`), react-query
  // teilt beide Leser denselben Eintrag. Scheitert er, bleibt `data` `undefined` und es entsteht
  // KEINE Aussage; scheitert eine AUFFRISCHUNG, bleibt der zuletzt geholte Stand stehen.
  const duplikate = useDuplicates();
  const { user } = useSession();
  const aiModelActive = aiModelUsable(useReasonerStatus().data);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { role } = useRole();
  const { push } = useToast();
  // AUFTRAG-mega47/48 (Rauchprobe): auf schmalen Geräten bleibt die Facettenschiene ihr eigener
  // Auslöser MIT Vollbild-Filterblatt und liegt AUSSERHALB des Datenzweigs — genau die Bauform, die
  // `tests-smoke/ui-smoke.spec.ts` als einziges datenunabhängiges Bedienelement dieser Seite
  // benutzt. Auf breiten Geräten (der Fall des Mockups) wohnt dieselbe Schiene im Filter-Menü.
  const schmal = useMediaQuery(NARROW_QUERY);

  const boardPending = boardHasPendingAiCheck(query.data);
  useEffect(() => {
    if (!boardPending) {
      return;
    }
    const timer = window.setInterval(() => {
      void qc.invalidateQueries({ queryKey: ["validation", "board"] });
    }, AI_CHECK_POLL_MS);
    return () => window.clearInterval(timer);
  }, [boardPending, qc]);

  const [facetSel, setFacetSel] = useState<FacetSelection>({});
  const [railUi, setRailUi] = useState<FacetRailUiState>(EMPTY_RAIL_UI);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [locallyDeletedKoIds, setLocallyDeletedKoIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Der aktive Eintrag der Warteschlange. `null` heisst „noch keiner gewählt" — dann führt der
  // erste sichtbare. Ein gewählter Eintrag, der aus der Liste fällt (entschieden, weggefiltert),
  // fällt automatisch auf denselben Weg zurück.
  const [aktivId, setAktivId] = useState<string | null>(null);
  const pruefbereichRef = useRef<HTMLDivElement>(null);
  // JOB 3504: die Warteschlange selbst — Anker für den Radlauf und für „die Auswahl bleibt sichtbar".
  const warteschlangeRef = useRef<HTMLUListElement>(null);
  const markDeletedKo = (id: string): void => {
    setLocallyDeletedKoIds((ids) => withDeletedKoId(ids, id));
  };
  const removeDeletedKoFromCaches = (id: string): void => {
    // H1c: Die Löschantwort bestätigt das Entfernen, aber keine neue Gesamtzahl.
    // Der bereinigte Bestand überlebt einen Seitenwechsel; 0 entzieht seiner Kopfzahl die
    // Bestätigung, auch bei zuvor frischem Cache. Erst refreshAfterDelete bestätigt sie neu.
    qc.setQueriesData<KnowledgeObject[]>(
      { queryKey: ["validation", "board"] },
      (items) => withoutKoById(items, id),
      { updatedAt: 0 },
    );
    // Der Bibliothekscache speist keinen Kopfzähler und behält seine bisherige Bereinigung.
    qc.setQueriesData<KnowledgeObject[]>({ queryKey: ["kos"] }, (items) =>
      withoutKoById(items, id),
    );
  };
  const refreshAfterDelete = (): void => {
    for (const key of [
      ["validation", "board"],
      ["validation", "overview"],
      ["kos"],
      ["analytics"],
      ["notifications"],
    ]) {
      void qc.invalidateQueries({ queryKey: key });
    }
  };
  const removeKo = useMutation({
    mutationFn: (id: string) => endpoints.ko.remove(id),
    onSuccess: (_data, id) => {
      setConfirmDeleteId(null);
      markDeletedKo(id);
      removeDeletedKoFromCaches(id);
      refreshAfterDelete();
      push("success", t("ko.deleteDone"));
    },
    onError: (e, id) => {
      if (isStaleKoDeleteError(e)) {
        setConfirmDeleteId(null);
        markDeletedKo(id);
        removeDeletedKoFromCaches(id);
        refreshAfterDelete();
        push("success", t("ko.deleteAlreadyGone"));
        return;
      }
      push("error", e instanceof ApiError ? e.message : t("state.error"));
    },
  });
  const nameOf = useAuthorName();
  const [filter, setFilter] = useState<ValidationFilterState>(() => ({
    ...EMPTY_VALIDATION_FILTER,
    mineOnly: readMineOnlyFilter(params),
  }));
  const setMineOnly = (mineOnly: boolean): void => {
    setFilter((f) => ({ ...f, mineOnly }));
    setSearchParams((prev) => applyMineOnlyParam(prev, mineOnly), { replace: true });
  };
  const [demoFilter, setDemoFilter] = useState<DemoKnowledgeFilter>(() =>
    readDemoKnowledgeFilter(params),
  );
  const [reviewFocus, setReviewFocus] = useState<ReviewFocusFilter>(() =>
    readReviewFocusFilter(params),
  );
  const resetBoardFocus = (): void => {
    setDemoFilter("all");
    setReviewFocus("all");
    setSearchParams((prev) => resetBoardFocusParams(prev), { replace: true });
  };
  const [feedback, setFeedback] = useState<{ id: string; verdict: FeedbackVerdict } | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  // SCRUM-277 → JOB 3061: die Quittung ist keine Karte mehr, sondern eine Zeile im Fuß (3 s) und
  // danach die Zeile „zuletzt: …" im „Mehr" des nächsten Eintrags. Beide Auskünfte stammen aus
  // DERSELBEN Entscheidung; `bis` trennt nur, wie lange die laute Form steht.
  const [lastDecision, setLastDecision] = useState<{
    id: string;
    title: string;
    verdict: ReviewVerdict;
  } | null>(null);
  const [quittungOffen, setQuittungOffen] = useState(false);
  useEffect(() => {
    if (!quittungOffen) {
      return;
    }
    const timer = window.setTimeout(() => setQuittungOffen(false), QUITTUNG_MS);
    return () => window.clearTimeout(timer);
  }, [quittungOffen]);
  const selectCls =
    "h-9 w-full rounded-input border border-hairline bg-surface px-2 text-[12.5px] text-text outline-none focus:border-ink/30";

  const invalidate = (): void => void qc.invalidateQueries({ queryKey: ["validation"] });

  const nachEntscheidung = (vars: { id: string; title: string; verdict: ReviewVerdict }): void => {
    invalidate();
    setLastDecision(vars);
    setQuittungOffen(true);
    // Auftrag §5.3: „Erfolg = nächster Eintrag wird aktiv". Der entschiedene Eintrag verlässt das
    // Board mit der nächsten Antwort; bis dahin führt die Wahl schon weiter.
    setAktivId(naechsteId(vars.id));
  };

  // Die offene Stufenfrage: für welchen Eintrag, und auf welchem Weg sie gestellt wurde. `null`
  // heisst „keine Frage offen". Sie ist ein Bedienschritt auf bereits geladenem Bestand — kommt
  // eine frische Antwort herein, während sie offen steht, bleibt sie offen: der Mensch entscheidet,
  // nicht der Abruf.
  //
  // RUNDE 3 · BENS KORREKTURPFLICHT: `gespeichert` gehört HIERHER und nicht an den letzten Fehler.
  // Runde 2 las den Zwischenstand aus `freigabe.error`; die Wiederholung schickt aber `stufe: null`,
  // und ihr Fehlschlag trug deshalb keine Stufe mehr — die Fläche fiel auf „Nicht gespeichert" und
  // erneute Stufenwahl zurück, obwohl der Server die Stufe längst hatte. Ein Fehler ist ein
  // EREIGNIS, kein Gedächtnis. Was der Server bestätigt hat, ist eine Tatsache über den laufenden
  // VORGANG — und dieselbe Regel wie im Zustandsmodell (§9): eine positive Aussage („es liegt
  // etwas") verschwindet nie wegen eines Fehlschlags, denn Verschwinden wäre die Entwarnung.
  const [stufenfrage, setStufenfrage] = useState<{
    id: string;
    title: string;
    weg: Freigabeweg;
    /** Die vom Server BESTÄTIGTE Stufe dieses Vorgangs. `null` = noch keine kam durch. */
    gespeichert: Confidentiality | null;
  } | null>(null);

  // ================================================================================================
  // JOB 3112 · V3 — DER EINE FREIGABEWEG, MIT DER STUFENFRAGE DAVOR.
  // ================================================================================================
  //
  // WAS HIER BIS ZUM 06.09.2026 STAND: zwei Mutationen, `rate` (Fußband „Freigeben") und
  // `adminValidate` („Als wahr kennzeichnen"), und beide schickten ihren Aufruf UNMITTELBAR am
  // Klick. Codex hat an der laufenden 1.116 gemessen, was dabei herauskommt: „Stufenfrage fehlt im
  // Administratorweg; HTTP 200 validiert/null" (R-0994, Prüfschritt 2). Ein Objekt verliess die
  // Prüffläche freigegeben und ohne dass irgendjemand nach seiner Einstufung gefragt worden wäre.
  //
  // BEIDE ALTEN WEGE SIND ERSETZT, NICHT ERGÄNZT. Es gibt hier keinen Codepfad mehr, der `rate`
  // mit `verdict: "up"` oder `admin-validate` absetzt, ohne vorher `brauchtStufenfrage` gefragt zu
  // haben: `freigabeStarten` ist der einzige Eingang, und diese Mutation der einzige Ausgang.
  //
  // DIE REIHENFOLGE IST VERBINDLICH: erst die Stufe, dann die Freigabe. Eine Freigabe, deren Stufe
  // nicht gespeichert wurde, wäre genau der Zustand, den R-0994 beanstandet. `await` heisst hier
  // deshalb wörtlich: schlägt der erste Aufruf fehl, wirft er, und der zweite läuft nie.
  //
  // `stufe: null` ist die Abwesenheit eines Aufrufs, nicht ein Ersatzwert — sie steht für „Ohne
  // Stufe freigeben", für „trägt schon eine Stufe" UND für die Wiederholung nach einem Teilerfolg.
  // In allen drei Fällen wird nichts (mehr) eingestuft.
  //
  // RUNDE 2 · KORREKTURPFLICHT 2 (Ben): der Weg hat zwei Aufrufe, also drei Ausgänge und nicht zwei.
  // Der dritte ist der TEILERFOLG — die Stufe liegt am Server, die Freigabe scheiterte. Bisher meldete
  // die Fläche dafür „Nicht gespeichert"; das war schlicht falsch. Jeder Schritt wirft deshalb einen
  // `FreigabeFehler`, der mitträgt, was VOR ihm angekommen ist.
  const freigabe = useMutation({
    mutationFn: async ({
      id,
      weg,
      stufe,
    }: { id: string; title: string; weg: Freigabeweg; stufe: Confidentiality | null }) => {
      if (stufe) {
        try {
          await endpoints.ko.act(id, { action: "confidentiality", level: stufe });
        } catch (e) {
          // Schritt 1 gescheitert: es liegt NICHTS am Server, und der zweite Aufruf läuft nie.
          throw new FreigabeFehler("stufe", null, e);
        }
      }
      try {
        if (weg === "rate") {
          await endpoints.ko.act(id, { action: "rate", verdict: "up" });
          return;
        }
        await endpoints.ko.act(id, { action: "admin-validate" });
      } catch (e) {
        // Schritt 2 gescheitert: `stufe` ist genau dann gespeichert, wenn Schritt 1 überhaupt lief.
        throw new FreigabeFehler("freigabe", stufe, e);
      }
    },
    onSuccess: (_data, vars) => {
      setStufenfrage(null);
      if (vars.weg === "rate") {
        nachEntscheidung({ id: vars.id, title: vars.title, verdict: "up" });
        return;
      }
      // Der Administratorweg räumt auf wie bisher — derselbe Wortlaut, dieselben vier Schlüssel.
      setConfirmTrueId(null);
      for (const key of [["validation"], ["kos"], ["analytics"], ["notifications"]]) {
        void qc.invalidateQueries({ queryKey: key });
      }
      push("success", t("val.markTrueDone"));
    },
    onError: (e, vars) => {
      // TEILERFOLG: die Stufe steht am Server. Der Bestand muss das zeigen, sonst behauptet die
      // Karte weiter „nicht eingestuft" — eine Aussage, die seit diesem Aufruf nicht mehr stimmt.
      // Nur hier wird nachgeladen: ohne gespeicherte Stufe hat sich am Server nichts geändert.
      const neuGespeichert = gespeicherteStufeAusFehler(e);
      if (neuGespeichert) {
        invalidate();
      }
      // `?? vorher.gespeichert` IST die Korrektur aus Runde 3: eine spätere, erfolglose Wiederholung
      // meldet `null` — das heisst „bei DIESEM Versuch kam nichts an", nicht „es liegt nichts". Was
      // einmal bestätigt war, bleibt im Vorgang stehen, bis er abgebrochen oder abgeschlossen wird.
      setStufenfrage((vorher) =>
        vorher ? { ...vorher, gespeichert: neuGespeichert ?? vorher.gespeichert } : vorher,
      );
      // Der Administratorweg meldete Fehler bisher als Hinweis — das bleibt. Der Fußband-Weg tat es
      // nie; er bekommt seine Meldung stattdessen AM BLOCK (unten), wo die Frage offen stehen
      // bleibt. Zwei Meldungen für denselben Fehler wären eine zu viel.
      // `freigabeFehlerUrsache` schält die Hülle ab: der Mensch soll den Servertext lesen, nicht
      // den Namen unserer Fehlerklasse.
      if (vars.weg === "admin") {
        const roh = freigabeFehlerUrsache(e);
        push("error", roh instanceof ApiError ? roh.message : t("state.error"));
      }
    },
  });

  /**
   * Der EINZIGE Eingang in eine Freigabe — beide Wege, eine Entscheidung.
   * Trägt das Objekt schon eine Stufe, bleibt der heutige Weg Zeichen für Zeichen erhalten: ein
   * Klick, ein Aufruf. Sonst wird gefragt — und nichts geschickt, bis geantwortet ist.
   */
  const freigabeStarten = (k: PruefZeile, weg: Freigabeweg): void => {
    // Die Prüfsperre gilt am Eingang wie im Ablauf (siehe `freigabeSenden`).
    if (validationAiGate(k.aiCheck, aiModelActive).locked) {
      return;
    }
    if (brauchtStufenfrage(k.auskunft.stufe.lage)) {
      freigabe.reset();
      // Ein zweiter Klick auf DENSELBEN Eintrag setzt den Vorgang fort, er beginnt ihn nicht neu:
      // was der Server bestätigt hat, gilt weiter (Runde 3). Erreichbar, solange die frische Antwort
      // mit der gespeicherten Stufe noch unterwegs ist und die Zeile darum „nicht eingestuft" sagt.
      // Ein ANDERER Eintrag ist ein anderer Vorgang und erbt nichts.
      setStufenfrage((vorher) => ({
        id: k.id,
        title: k.title,
        weg,
        gespeichert: vorher?.id === k.id ? vorher.gespeichert : null,
      }));
      return;
    }
    freigabe.mutate({ id: k.id, title: k.title, weg, stufe: null });
  };

  /**
   * DER SCHREIBENDE AUSGANG DER OFFENEN FRAGE — und die Stelle, an der die Prüfsperre ein zweites
   * Mal gilt.
   *
   * RUNDE 2 · KORREKTURPFLICHT 1 (Ben): die Sperre `validationAiGate` wurde bisher nur an den
   * EINSTIEGEN geprüft. Ein bereits geöffneter Folgezustand überlebt aber den Wechsel der Karte auf
   * `aiCheck.status === "pending"` (real erreichbar: Eintrag failed → Frage geöffnet → „Prüfung
   * erneut" → pending). React behält `stufenfrage`, der neue Abrufstand schliesst sie nicht — und
   * die Antwortknöpfe schickten weiter. Genau dieselbe Lücke hatte WP-SHIP9-B3FIX2 schon einmal für
   * das Begründungsfeld und die Admin-Rückfrage geschlossen
   * (`tests/validation/ai-gate-lock-followstate-mounted.test.tsx:2-10`); die Stufenfrage ist der
   * dritte Folgezustand derselben Bauart.
   *
   * Der `gate` kommt aus der Zeichnung der Karte und damit aus dem FRISCHEN Zeilenstand — nicht aus
   * dem Stand, der galt, als die Frage aufging.
   */
  const freigabeSenden = (stufe: Confidentiality | null, gate: ValidationAiGate): void => {
    if (!stufenfrage || gate.locked) {
      return;
    }
    freigabe.mutate({
      id: stufenfrage.id,
      title: stufenfrage.title,
      weg: stufenfrage.weg,
      stufe,
    });
  };

  /** Die Antwort eines Menschen auf die Frage. `STUFENFRAGE_VERTRAG.setztNiemalsSelbst`: was hier
   *  nicht gewählt wurde, wird auch nicht geschrieben. */
  const stufenfrageBeantworten = (antwort: StufenAntwort, gate: ValidationAiGate): void =>
    freigabeSenden(stufeAusAntwort(antwort), gate);

  const stufenfrageAbbrechen = (): void => {
    setStufenfrage(null);
    setConfirmTrueId(null);
    freigabe.reset();
  };

  const reviewWithFeedback = useMutation({
    mutationFn: async ({
      id,
      verdict,
      text,
    }: { id: string; title: string; verdict: FeedbackVerdict; text: string }) => {
      await endpoints.ko.act(id, {
        action: "comment",
        text: buildValidationFeedback(verdict, text),
      });
      await endpoints.ko.act(id, { action: "rate", verdict });
    },
    onSuccess: (_data, vars) => {
      setFeedback(null);
      setFeedbackText("");
      nachEntscheidung(vars);
    },
  });

  const openFeedback = (id: string, verdict: FeedbackVerdict): void => {
    setFeedback({ id, verdict });
    setFeedbackText("");
    reviewWithFeedback.reset();
  };

  const assign = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      endpoints.ko.act(id, { action: "assign", userIds: [userId] }),
    onSuccess: invalidate,
  });

  const aiCheckRetry = useMutation({
    mutationFn: (id: string) => endpoints.ko.aiCheckRetry(id),
    onSuccess: () => {
      invalidate();
      push("success", t("val.aiCheck.retryStarted"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  // JOB 3112 · V3: die eigene Mutation `adminValidate` ist ENTFALLEN — „Als wahr kennzeichnen"
  // läuft über denselben `freigabe`-Ausgang wie das Fußband, samt Stufenfrage davor. Der Zustand
  // der Rückfrage bleibt: sie tritt nicht an die Stelle der Stufenfrage, sondern steht davor.
  const [confirmTrueId, setConfirmTrueId] = useState<string | null>(null);

  const facetValueLabel = (key: string, value: string): string => {
    switch (key) {
      case "pruefstand":
        return t(`val.reviewState.${value}`);
      case "maturity":
        return t(useReadiness(value as Parameters<typeof useReadiness>[0]).labelKey);
      case "trust":
        return t(`lib.facet.trustBucket.${value}`);
      case "confidentiality":
        return t(stufenFacetLabelKey(value));
      case "author":
        return nameOf(value);
      default:
        return value || t("lib.facet.none");
    }
  };

  // JOB 3027 · DIE NAHT: dieselben Zeilen wie bisher, einmal um die abgeleitete `auskunft` erweitert.
  const items = boardZeilen(query.data);
  const lage = flaechenZustand(query);
  const cats = categoryOptions(items);
  const tags = tagOptions(items);
  const types = typeOptions(items);
  const boardFiltered =
    withoutKoIds(
      items.filter((k) => matchesValidationFilter(k, filter, user?.id ?? null)),
      locallyDeletedKoIds,
    ) ?? [];
  const demoCounts: Record<DemoKnowledgeFilter, number> = {
    all: boardFiltered.length,
    demo: boardFiltered.filter((k) => matchesDemoKnowledgeFilter(k, "demo")).length,
    "non-demo": boardFiltered.filter((k) => matchesDemoKnowledgeFilter(k, "non-demo")).length,
  };
  const focusBase = boardFiltered.filter((k) => matchesDemoKnowledgeFilter(k, demoFilter));
  const reviewFocusCounts = countByReviewFocus(focusBase);
  const nachFokus = focusBase.filter((k) => matchesReviewFocus(k, reviewFocus));
  const facetItems = nachFokus.map(validationFacetValues);
  const facetGroups = facetRailGroups(
    facetItems,
    VALIDATION_FACET_CONFIGS,
    facetSel,
    railUi,
    facetValueLabel,
  );
  const visible = sortByReviewPriority(
    applyFacetSelection(nachFokus, validationFacetValues, facetSel),
  ) as PruefZeile[];
  const persoenlicheMenge =
    withoutKoIds(
      items.filter((k) =>
        matchesValidationFilter(
          k,
          { ...EMPTY_VALIDATION_FILTER, mineOnly: filter.mineOnly },
          user?.id ?? null,
        ),
      ),
      locallyDeletedKoIds,
    ) ?? [];
  const mineEmpty = mineQueueEmptyHint({
    mineOnly: filter.mineOnly,
    visibleCount: persoenlicheMenge.length,
  });
  const ownEmpty = ownKnowledgeEmptyHint({
    filter: demoFilter,
    count: demoCounts["non-demo"],
  });

  function naechsteId(nachId: string): string | null {
    const i = visible.findIndex((k) => k.id === nachId);
    if (i === -1) {
      return null;
    }
    return visible[i + 1]?.id ?? visible[i - 1]?.id ?? null;
  }

  const aktiv = visible.find((k) => k.id === aktivId) ?? visible[0] ?? null;

  // ================================================================================================
  // JOB 3504 — DURCH DIE LISTE GEHEN, OHNE JEDEN ARTIKEL ANZUKLICKEN (Pedi, 10.09. 06:48).
  // ================================================================================================
  //
  // BEIDES, und beides NUR HIER: die Pfeiltasten, solange die Liste den Fokus hat, und das Mausrad,
  // solange der Zeiger über ihr steht. Es gibt KEINEN Zuhörer an `window` oder `document` — ein
  // globaler Griff nach ArrowUp/ArrowDown kaperte das Suchfeld des Filter-Menüs, das Begründungsfeld
  // der Rückfrage und jede Auswahlliste der Karte. Die Reichweite IST die Zusage: sie steht nicht in
  // einer Bedingung, die man vergessen kann, sondern im ORT der beiden Zuhörer (Auftrag §3.1).
  //
  // RECHTS KANN NICHTS VERALTEN (Auftrag §3.4). Die Karte ist eine Ableitung aus `visible` — genau
  // derselben Liste, die links steht (`karte(aktiv)` weiter unten). Weiterschalten löst KEINEN
  // artikelbezogenen Abruf aus; es gibt also gar keine späte Antwort, die zu einer überholten
  // Auswahl eintreffen könnte. Deshalb wird hier auch nichts entprellt und nichts verzögert: jeder
  // Schritt ist ein Zustandswechsel, und der nächste Zeichenlauf zeigt genau ihn.
  //
  // HOVER GIBT ES NICHT (Auftrag §3.5). Bloßes Überfahren wählt nichts aus — an den Einträgen steht
  // kein `onMouseEnter`, und dieses Fehlen ist die ganze Umsetzung dieser Zusage.
  //
  // DER FOKUS BLEIBT, WO ER IST (Auftrag §3.3). Verschoben wird `aktivId`, sonst nichts; der Knopf,
  // der den Fokus hat, behält ihn (die Liste selbst ändert sich beim Schalten ja nicht).

  // DIE SCHWELLENDE AUSWAHL, und warum sie eine Referenz ist und kein Zustand mehr.
  //
  // GEMESSEN (Runde 1, `pfeiltasten.test.tsx` „schnelles Weiterschalten"): fünf Pfeiltasten in EINEM
  // React-Durchlauf rückten die Auswahl von F nur bis E — nicht bis A. React fasst mehrere
  // Zustandssetzungen desselben Durchlaufs zusammen; jeder der fünf Schritte las deshalb dieselbe
  // alte `aktiv` aus seinem Abschluss und rechnete fünfmal denselben Nachbarn aus. Vier Tastendrücke
  // wären spurlos verschwunden.
  //
  // `aktivRef` trägt die SOFORT nachgeführte Auswahl: sie wird beim Schieben gesetzt, bevor React
  // gezeichnet hat, und nach jedem Zeichenlauf wieder mit der tatsächlich gezeigten Auswahl
  // abgeglichen. Damit rechnet Schritt n+1 auf dem Ergebnis von Schritt n — und ein weggefilterter
  // oder entschiedener Eintrag setzt sie auf denselben Weg zurück wie die Fläche selbst.
  const aktivRef = useRef<string | null>(aktiv?.id ?? null);
  useEffect(() => {
    aktivRef.current = aktiv?.id ?? null;
  });

  /**
   * Die Auswahl um `delta` Einträge verschieben. Ohne `ausfuehren` wird nur GEFRAGT, ob der Schritt
   * überhaupt möglich ist — das braucht der Radlauf, um zu entscheiden, ob er das Ereignis
   * verbraucht oder der Seite überlässt. An den Enden ist Schluss: kein Umlauf.
   */
  function auswahlSchieben(delta: number, ausfuehren: boolean): boolean {
    const i = visible.findIndex((k) => k.id === aktivRef.current);
    const ziel = i === -1 ? undefined : visible[i + delta];
    if (!ziel) {
      return false;
    }
    if (!ausfuehren) {
      return true;
    }
    aktivRef.current = ziel.id;
    setAktivId(ziel.id);
    // Die Auswahl bleibt sichtbar. `nearest` zieht nur, wenn sie wirklich aus dem Sichtbereich
    // gewandert ist — beim Klick geschieht das ausdrücklich NICHT (das Ziel ist ja getroffen worden
    // und steht damit schon im Blick; JOB 3464 misst genau das). Der Zielknopf steht bereits im
    // Baum, bevor React neu zeichnet: die Liste ändert sich beim Schalten nicht, nur ihre Markierung.
    //
    // UND DER ARTIKEL RECHTS BLEIBT ES AUCH — das ist seit JOB 3593 der zweite Teil der Zusage.
    // `scrollIntoView` rollt den nächsten Vorfahren, der rollen KANN. Bis hierher war das nicht die
    // Liste (sie hatte weder Höhe noch eigene Rollregel), sondern der Hauptbereich der Hülle
    // (`<main class="flex-1 overflow-y-auto …">`) — und in dem liegt die Karte gleich mit. Gemessen
    // an vierzig offenen Artikeln bei 1280×900 (`tests/design/job2935-validierung-fussband.test.ts`,
    // Block L): ab dem FÜNFZEHNTEN Schritt stand die Karte 38,5 px über dem Fensterrand, bei
    // Schritt 20 war sie ganz draussen (oben −259,5 / unten −5,25 px), bei Schritt 30 bei −702,5 px.
    // Wer sich durch die Liste arbeitete, las ab da nichts mehr — genau das, was Pedi nicht wollte.
    // Die Liste hat deshalb jetzt ihren EIGENEN Rollbereich (weiter unten am `<ul>`); dieser Aufruf
    // bleibt unverändert und wirkt nur noch in ihr.
    warteschlangeRef.current
      ?.querySelectorAll<HTMLElement>('[data-testid="pruefen-warteschlange-eintrag"]')
      ?.[i + delta]?.scrollIntoView({ block: "nearest", behavior: "instant" });
    return true;
  }

  // Der Radlauf hängt an einem NATIVEN Zuhörer und liest über diese Referenz, was der letzte
  // Zeichenlauf weiss (`visible`, `aktiv`). Ohne dep-Liste läuft die Nachführung nach jedem Zeichnen.
  const schiebenRef = useRef(auswahlSchieben);
  useEffect(() => {
    schiebenRef.current = auswahlSchieben;
  });

  const listeSteht = visible.length > 0;
  useEffect(() => {
    const ul = listeSteht ? warteschlangeRef.current : null;
    if (!ul) {
      return;
    }
    // NATIV und ausdrücklich `passive: false`. React hängt `onWheel` als PASSIVEN Zuhörer ein; dort
    // liefe `preventDefault()` ins Leere (samt Konsolenwarnung) und die Seite scrollte unter der
    // Auswahl weg, während die Auswahl gleichzeitig weiterrückt — zwei Bewegungen auf eine Geste.
    let summe = 0;
    const beiRad = (e: WheelEvent): void => {
      const schub = e.deltaY * (RAD_MASS_PX[e.deltaMode] ?? 1);
      if (schub === 0) {
        return;
      }
      const richtung = schub > 0 ? 1 : -1;
      if (!schiebenRef.current(richtung, false)) {
        // Am Ende der Liste gehört das Rad wieder der Seite — sonst wäre die Fläche eine Sackgasse.
        summe = 0;
        return;
      }
      e.preventDefault();
      // Ein Richtungswechsel verwirft das Angesammelte: sonst schaltete ein Zurückwischen den
      // nächsten Vorwärtsschub verfrüht durch.
      summe = Math.sign(summe) === richtung ? summe + schub : schub;
      if (Math.abs(summe) < RAD_SCHWELLE_PX) {
        return;
      }
      summe = 0;
      schiebenRef.current(richtung, true);
    };
    ul.addEventListener("wheel", beiRad, { passive: false });
    return () => ul.removeEventListener("wheel", beiRad);
  }, [listeSteht]);

  // Wie viele Filter gerade greifen — der einzige Text, den das geschlossene Filter-Menü zeigt.
  const filterAktiv =
    (filter.search.trim() ? 1 : 0) +
    (filter.type ? 1 : 0) +
    (filter.category ? 1 : 0) +
    (filter.tag ? 1 : 0) +
    (filter.mineOnly ? 1 : 0) +
    (filter.aiPending ? 1 : 0) +
    (demoFilter !== "all" ? 1 : 0) +
    (reviewFocus !== "all" ? 1 : 0) +
    Object.values(facetSel).filter((v) => isFacetGroupActive(v)).length;

  const facetSchiene = (
    <FacetFilter
      configs={VALIDATION_FACET_CONFIGS}
      groups={facetGroups}
      selection={facetSel}
      secondaryKeys={VALIDATION_SECONDARY_FACET_KEYS}
      moreStorageKey={VALIDATION_MORE_FILTERS_STORAGE_KEY}
      pillKeys={VALIDATION_PILL_FACET_KEYS}
      total={nachFokus.length}
      shown={visible.length}
      onQueryChange={(key, value) =>
        setRailUi((prev) => ({ ...prev, query: { ...prev.query, [key]: value } }))
      }
      onShowAllToggle={(key) =>
        setRailUi((prev) => ({
          ...prev,
          showAll: { ...prev.showAll, [key]: prev.showAll[key] !== true },
        }))
      }
      onToggle={(key, value) => setFacetSel((prev) => toggleFacetValue(prev, key, value))}
      onReset={() => {
        setFacetSel(clearFacetSelection());
        setRailUi(EMPTY_RAIL_UI);
      }}
      labelForValue={facetValueLabel}
    />
  );

  // ---- Das Filter-Menü (Auftrag §5.2c) ---------------------------------------------------------
  const filterMenue = (
    <PruefenMenue
      kennung="filter"
      beschriftung={t("pruefen.menu.filter")}
      symbol={<SlidersHorizontal size={16} aria-hidden="true" />}
      zaehler={filterAktiv}
      breite="w-80"
    >
      <div data-help="rev:filters" className="space-y-2.5 px-2.5 py-2">
        <input
          value={filter.search}
          onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
          placeholder={t("val.filter")}
          className="h-9 w-full rounded-input border border-hairline bg-surface px-3 text-[12.5px] outline-none focus:border-ink/30"
        />
        <select
          value={filter.type}
          onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}
          className={selectCls}
          aria-label={t("val.filterAllTypes")}
        >
          <option value="">{t("val.filterAllTypes")}</option>
          {types.map((tp) => (
            <option key={tp} value={tp}>
              {t(`ktype.${tp}`)}
            </option>
          ))}
        </select>
        <select
          value={filter.category}
          onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}
          className={selectCls}
          aria-label={t("val.filterAllCategories")}
        >
          <option value="">{t("val.filterAllCategories")}</option>
          {cats.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filter.tag}
          onChange={(e) => setFilter((f) => ({ ...f, tag: e.target.value }))}
          className={selectCls}
          aria-label={t("val.filterAllTags")}
        >
          <option value="">{t("val.filterAllTags")}</option>
          {tags.map((tg) => (
            <option key={tg} value={tg}>
              {tg}
            </option>
          ))}
        </select>
        {/* SCRUM-327: Review-Fokus (Alle/Neu/Überarbeitet) — Zähler über die gefilterte Menge. */}
        <div data-help="rev:reviewFocus">
          <div className="mb-1 text-[11.5px] font-semibold text-muted">
            {t("val.reviewFocus.label")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REVIEW_FOCUS_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setReviewFocus(f);
                  setSearchParams(
                    (prev) => applyBoardFocusParams(prev, { origin: demoFilter, review: f }),
                    { replace: true },
                  );
                }}
                className={cx(
                  "rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold",
                  reviewFocus === f
                    ? "border-ink bg-ink text-white"
                    : "border-hairline text-muted hover:text-text",
                )}
              >
                {t(reviewFocusLabelKey(f))} · {reviewFocusCounts[f]}
              </button>
            ))}
          </div>
        </div>
        {/* SCRUM-311: Herkunft (Demo/Eigenes) — nur Ansicht, kein Review-Status. */}
        <div data-help="rev:originFilter">
          <div className="mb-1 text-[11.5px] font-semibold text-muted">{t("lib.originLabel")}</div>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_KNOWLEDGE_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setDemoFilter(f);
                  setSearchParams(
                    (prev) => applyBoardFocusParams(prev, { origin: f, review: reviewFocus }),
                    { replace: true },
                  );
                }}
                className={cx(
                  "rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold",
                  demoFilter === f
                    ? "border-ink bg-ink text-white"
                    : "border-hairline text-muted hover:text-text",
                )}
              >
                {t(demoKnowledgeFilterLabelKey(f))} · {demoCounts[f]}
              </button>
            ))}
          </div>
        </div>
        <label
          data-help="rev:mineOnly"
          className="flex items-center gap-1.5 text-[12.5px] text-muted"
        >
          <input
            type="checkbox"
            checked={filter.mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
          />
          {t("val.filterMine")}
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
          <input
            type="checkbox"
            checked={filter.aiPending}
            onChange={(e) => setFilter((f) => ({ ...f, aiPending: e.target.checked }))}
          />
          {t("val.filterAiPending")}
        </label>
        <button
          type="button"
          data-testid="pruefen-filter-reset"
          onClick={() => {
            setFilter({ ...EMPTY_VALIDATION_FILTER });
            setFacetSel(clearFacetSelection());
            setRailUi(EMPTY_RAIL_UI);
            resetBoardFocus();
            setSearchParams((prev) => applyMineOnlyParam(prev, false), { replace: true });
          }}
          className="text-[12px] font-semibold text-muted hover:text-text"
        >
          {t("val.focusReset")}
        </button>
      </div>
      {/* Auf breiten Geräten wohnt die Facettenschiene HIER — im Menü, nicht als Dauerspalte. */}
      {schmal ? null : <div className="border-t border-hairline pt-1.5">{facetSchiene}</div>}
    </PruefenMenue>
  );

  // ---- Das „?"-Menü (Auftrag §5.2d) ------------------------------------------------------------
  const guideFocusKey = aktiv
    ? reviewGuidanceFocusKey({
        kind: validationReviewContext(aktiv).kind,
        authorTransferred: reviewSignals(aktiv).authorTransferred,
      })
    : null;
  const hilfeMenue = (
    <PruefenMenue
      kennung="hilfe"
      beschriftung={t("pruefen.menu.help")}
      symbol={<HelpCircle size={16} aria-hidden="true" />}
      ausrichtung="links"
      breite="w-[22rem]"
    >
      <PruefenHilfeBlock titel={t("val.guide.title")}>
        <ul className="space-y-1">
          {REVIEW_CHECK_ITEMS.map((item) => (
            <li key={item.id}>
              <span className="font-semibold text-text">{t(item.labelKey)}</span> {t(item.hintKey)}
            </li>
          ))}
        </ul>
        {guideFocusKey ? <p className="text-trust-warn-text">{t(guideFocusKey)}</p> : null}
      </PruefenHilfeBlock>
      <PruefenMenueTrenner />
      <PruefenHilfeBlock titel={t("val.guide.impactTitle")}>
        <ul className="space-y-1">
          {DECISION_IMPACTS.map((d) => (
            <li key={d.verdict}>
              <span className={cx("font-semibold", IMPACT_TEXT_TONE[d.tone])}>
                {t(d.titleKey)}:
              </span>{" "}
              {t(d.bodyKey)}
            </li>
          ))}
        </ul>
        <p className="text-muted-2">{t(DECISION_TRUST_NOTE_KEY)}</p>
        {/* SCRUM-258: Die Begründungspflicht bleibt WIRKSAM (Absenden ist ohne Text gesperrt,
            `isFeedbackSubmittable`). Ihr ERKLÄRTEXT stand bis JOB 3061 als Dauerzeile im Fußband
            jeder Karte — im Mockup steht dort nichts dergleichen. Er steht deshalb hier, wörtlich
            unverändert; verloren ist er damit nicht. */}
        <p className="text-muted-2">{t("val.feedbackRequiredHint")}</p>
      </PruefenHilfeBlock>
      <PruefenMenueTrenner />
      {/* SCRUM-406: DIESELBE zentrale Hilfe-Karte wie bisher — gleiche Schlüssel, gleicher Wortlaut,
          nur an EINEM Ort statt als sieben ?-Symbole quer über die Karte. */}
      {REVIEW_HELP_TOPICS.filter((topic) =>
        [
          "originFilter",
          "reviewFocus",
          "filters",
          "mineOnly",
          "signals",
          "approve",
          "query",
          "reject",
          "feedbackForm",
          "assign",
          "markTrue",
        ].includes(topic.id),
      ).map((topic) => (
        <PruefenHilfeBlock key={topic.id} titel={t(topic.titleKey)}>
          <p>{t(topic.bodyKey)}</p>
        </PruefenHilfeBlock>
      ))}
      <PruefenMenueTrenner />
      <PruefenHilfeBlock titel={t("val.votesTitle")}>
        <p>{t("val.votesHint", { need: aktiv?.neededValidations ?? 0 })}</p>
      </PruefenHilfeBlock>
    </PruefenMenue>
  );

  const kopf = <PruefenKopf aktiv="offen" filter={filterMenue} hilfe={hilfeMenue} />;

  // ---- Der Leerzustand: EIN Satz, höchstens ein Weiterweg (Auftrag §9) -------------------------
  function leerSatz(): JSX.Element {
    if (mineEmpty) {
      return (
        <div className="space-y-2">
          <PruefenSatz kennung="leer">{t(mineEmpty.titleKey)}</PruefenSatz>
          <Button variant="ghost" onClick={() => setMineOnly(false)}>
            {t(mineEmpty.ctaKey)}
          </Button>
        </div>
      );
    }
    if (ownEmpty) {
      return (
        <div className="space-y-2">
          <PruefenSatz kennung="leer">{t(ownEmpty.titleKey)}</PruefenSatz>
          <Link
            to={ownEmpty.to}
            className="inline-flex items-center gap-1 rounded-btn bg-ink px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90"
          >
            {t(ownEmpty.ctaKey)} <span aria-hidden="true">→</span>
          </Link>
        </div>
      );
    }
    if (boardEmptyKind({ totalItems: items.length, visibleCount: visible.length }) === "filtered") {
      return (
        <div className="space-y-2">
          <PruefenSatz kennung="leer">{t("val.focusEmpty.filtered")}</PruefenSatz>
          {boardFocusActive({ origin: demoFilter, review: reviewFocus }) ? (
            <Button variant="ghost" onClick={resetBoardFocus}>
              {t("val.focusReset")}
            </Button>
          ) : null}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {/* Der Wortlaut bleibt `val.empty` — die Rauchprobe misst genau diesen Satz. */}
        <PruefenSatz kennung="leer">{t("val.empty")}</PruefenSatz>
        <EmptyStateCtas context="validation" />
      </div>
    );
  }

  return (
    // JOB 3625: In der BREITEN Bauform ist die Fläche so hoch wie der Platz, den die Hülle ihr
    // lässt (`AppShell.tsx:144` reicht ihre Höhe über `kw-inhalt h-full` durch) — und nicht so
    // hoch wie ihr Inhalt. Nur so kann die Liste weiter unten ihren Deckel aus dem WIRKLICH
    // verfügbaren Platz nehmen statt aus einer Prozentzahl vom Fenster. Alles daran trägt `lg:`;
    // im schmalen Fenster wächst die Fläche wie bisher mit ihrem Inhalt.
    <div className="mx-auto max-w-[1040px] lg:flex lg:h-full lg:flex-col">
      {kopf}
      {isDemoContext(params) ? <DemoBanner surface="validation" /> : null}
      {schmal ? facetSchiene : null}
      <div
        data-testid="pruefen-flaeche"
        className="flex flex-col items-start gap-6 lg:min-h-0 lg:flex-1 lg:flex-row"
      >
        {/* ---- Die Warteschlange (Pruefen.dc.html Z.43–50) ---------------------------------- */}
        {/* `lg:h-full` holt die Höhe der Fläche in die Spalte (`items-start` streckt sie nicht von
            selbst), `lg:min-h-0` erlaubt ihren Kindern, kleiner zu werden als ihr Inhalt. Erst
            beides zusammen macht die Liste unten deckelbar. */}
        <div className="w-full shrink-0 lg:flex lg:h-full lg:w-[260px] lg:min-h-0 lg:flex-col">
          {lage.auffrischungGescheitert ? <PruefenNichtFrisch /> : null}
          {lage.lage === "laedt" ? <PruefenPlatzhalter /> : null}
          {lage.lage === "erstfehler" ? (
            <PruefenErstfehler
              onRetry={() => void qc.invalidateQueries({ queryKey: ["validation", "board"] })}
            />
          ) : null}
          {lage.lage === "leer" || (lage.lage === "bestand" && visible.length === 0)
            ? leerSatz()
            : null}
          {visible.length > 0 ? (
            // JOB 3504: der Tastenlauf hängt an der LISTE und fängt damit nur, was aus ihr
            // aufsteigt. Ein Pfeil im Suchfeld des Filter-Menüs, im Begründungsfeld der Rückfrage
            // oder irgendwo sonst auf der Seite kommt hier nie an — die Liste ist die Grenze.
            // Der Fokus wohnt in den EINTRÄGEN (es sind Knöpfe); die Liste trägt nur die
            // Weiterschaltung und bekommt deshalb weder Rolle noch eigene Fokussierbarkeit.
            //
            // JOB 3593: die Liste rollt SELBST — und nur in der breiten Bauform, in der rechts
            // überhaupt eine Karte daneben steht. Ohne diese zwei Regeln fand `auswahlSchieben`
            // keinen rollbaren Vorfahren innerhalb der Fläche und bewegte den Hauptbereich der
            // Hülle; die Karte wanderte dabei mit aus dem Bild (Zahlen an `auswahlSchieben`).
            //
            // JOB 3625: DER DECKEL IST KEINE PROZENTZAHL MEHR. JOB 3593 hat ihn auf `70vh` gesetzt
            // und dazu behauptet, das halte die Liste vollständig im Fenster. Das stimmte nicht:
            // Prozent vom Fenster rechnet den Kopf ÜBER der Liste nicht mit. GEMESSEN am 11.09.
            // (`tests/design/job2935-validierung-fussband.test.ts`, Block L, Cloud-Lauf
            // fd8f48791cf0b46b1eb58b04): der Kopf ist 138,5 px hoch und von der Fensterhöhe
            // unabhängig; die Liste reichte damit bis 768,5 px, während der sichtbare Teil der
            // Hülle schon bei 683 px endete. Diese 85,5 px Überhang sind genau die 86 px, die die
            // Hülle danach doch noch rollte (`archiv/3593/runde-1/RUECKGABE.md:64`, dort als
            // unerklärt notiert) — und mit ihr wanderte die Karte 3,5 px unter das Kopfband. Bei
            // 1280×420 waren es 205,5 px Überhang und 206 px Hüllenbewegung.
            //
            // STATTDESSEN NIMMT DIE LISTE DEN PLATZ, DER WIRKLICH DA IST: Die Spalte darüber ist
            // eine Flex-Spalte in voller Höhe der Fläche; `lg:min-h-0` erlaubt dieser Liste — und
            // nur ihr —, unter ihre Inhaltshöhe zu schrumpfen. Alles über ihr (Kopf der Fläche,
            // der Hinweis auf einen nicht frischen Stand) behält seine natürliche Höhe und wird
            // damit automatisch abgezogen. Ein Wachsen gibt es nicht (`flex-grow` bleibt 0): eine
            // kurze Liste bleibt so hoch wie ihre Einträge.
            //
            // Erst dadurch liegt die Liste vollständig im sichtbaren Teil der Hülle — und genau das
            // ist die Bedingung dafür, dass `scrollIntoView` nach ihr keinen weiteren Vorfahren
            // mehr rollen muss.
            //
            // Der SCHMALE Weg bleibt unberührt (`lg:` greift erst ab 1024 px): dort steht die Karte
            // unter der Liste, nicht neben ihr, und die bewusste Auswahl führt den Blick ausdrücklich
            // zu ihr (`:1127-1137`). Eine gedeckelte Liste wäre dort eine Verschlechterung.
            <ul
              ref={warteschlangeRef}
              data-testid="pruefen-warteschlange"
              className="flex flex-col gap-1 lg:min-h-0 lg:overflow-y-auto"
              onKeyDown={(e) => {
                if (e.key !== "ArrowDown" && e.key !== "ArrowUp") {
                  return;
                }
                // Mit Zusatztaste gehört der Pfeil der Seite (Auswahl erweitern, Seitenanfang …).
                if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
                  return;
                }
                if (!auswahlSchieben(e.key === "ArrowDown" ? 1 : -1, true)) {
                  return;
                }
                e.preventDefault();
              }}
            >
              {visible.map((k) => {
                const ist = aktiv?.id === k.id;
                return (
                  <li key={k.id} data-testid="validation-row">
                    <button
                      type="button"
                      data-testid="pruefen-warteschlange-eintrag"
                      aria-current={ist ? "true" : undefined}
                      onClick={() => {
                        const auswahlSetzen = () => setAktivId(k.id);
                        if (!schmal) {
                          auswahlSetzen();
                          return;
                        }
                        // Nur die bewusste Auswahl führt den Blick. Erst die gewählte Karte
                        // zeichnen, dann ihre Lage nutzen; Abrufe und Entscheidungen springen nie.
                        flushSync(auswahlSetzen);
                        pruefbereichRef.current?.scrollIntoView({
                          block: "start",
                          behavior: "instant",
                        });
                        pruefbereichRef.current?.focus({ preventScroll: true });
                      }}
                      className={cx(
                        "block w-full rounded-[9px] border px-[12px] py-[10px] text-left text-[13.5px] leading-[1.35]",
                        ist
                          ? "border-hairline bg-surface font-semibold text-text"
                          : "border-transparent text-muted hover:bg-hairline-soft",
                      )}
                    >
                      <span data-text="titel">{k.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {/* ---- Die eine Karte (Pruefen.dc.html Z.51–62) -------------------------------------- */}
        <div ref={pruefbereichRef} tabIndex={schmal ? -1 : undefined} className="min-w-0 flex-1">
          {aktiv ? karte(aktiv) : null}
        </div>
      </div>
    </div>
  );

  // ================================================================================================
  // DIE KARTE — eine ZEICHENFUNKTION, ausdrücklich KEINE innere Komponente.
  // ================================================================================================
  //
  // Sie greift auf ein Dutzend Zustände und Mutationen der Seite zu (Feedback, Sperre, Rollen,
  // Quittung); als eigene Komponente bräuchte sie ein Dutzend Props, die alle dasselbe sagen.
  //
  // ABER: eine INNERE Komponente wäre hier ein Fehler und kein Stilfrage. React vergleicht
  // Elementtypen per Identität; eine bei jedem Rendern neu erzeugte Funktion ist ein NEUER Typ, und
  // React hängt den ganzen Teilbaum ab und neu auf. Der aufgeklappte „Mehr"-Zustand, das offene
  // „···"-Menü und der Cursor im Begründungsfeld gingen bei jedem Tastendruck verloren. Eine
  // Zeichenfunktion liefert dagegen gewöhnliche Elemente in den Baum der Seite — kein neuer Typ,
  // kein Neuaufbau. Deshalb wird sie gerufen (`karte(aktiv)`) und nicht gerendert (`<Karte …/>`).
  function karte(k: PruefZeile): JSX.Element {
    const sig = reviewSignals(k);
    const reviewWork = reviewWorkView(k);
    const kontext = validationReviewContext(k);
    const gate = validationAiGate(k.aiCheck, aiModelActive);
    const createdLabel = formatKoTimestamp(k.createdAt, i18n.language);
    const vonId = k.originalAuthor?.trim() ? k.originalAuthor : k.author;
    const createdByName = vonId ? nameOf(vonId).trim() : "";
    const meta = [createdByName, k.category, createdLabel].filter(Boolean).join(" · ");
    const quellen = k.sources ?? [];
    const bilder = (k.attachments ?? []).filter((a) => a.mime.startsWith("image/"));
    const darfLoeschen = role === "admin" || role === "controller" || k.author === user?.id;
    // JOB 3112 · V3: der Paarhinweis und die Frage, ob dieser Betrachter den Vergleich betreten
    // darf. Dieselbe Rollenlesart wie `darfLoeschen` — die Vergleichsfläche selbst trägt
    // `minRole: "controller"` (`navigation.ts:204`).
    const doppel = doppelhinweis(k.id, duplikate.data);
    const darfVergleichen = role === "admin" || role === "controller";
    const punkte = Array.from({ length: Math.max(sig.needed, 1) }, (_, i) => i);
    const quittung = quittungOffen && lastDecision ? reviewOutcome(lastDecision.verdict) : null;

    return (
      // Der Flächen-Klick ist reiner MAUS-Komfort. Die Karte bekommt ausdrücklich KEINE
      // Button-Rolle und keinen Tastatur-Handler: sie enthält Links, Knöpfe und Felder, und eine
      // Rolle darüber gäbe ihr einen Sammel-Accessible-Name und verschachtelte Knöpfe (E2E-012/013).
      // Ein Tastatur-Handler ohne Fokussierbarkeit wäre toter Code. Mit der Tastatur bedient man
      // den Titel-Link und die Bedienelemente darin — der Weg ins Objekt ist also nicht nur mit
      // der Maus erreichbar, er ist es an einer anderen Stelle.
      // biome-ignore lint/a11y/useKeyWithClickEvents: Begründung siehe oben — Tastaturweg ist der Titel-Link.
      <div
        data-testid="pruefen-karte"
        // SCRUM-416: Klick auf die freie Fläche öffnet das Wissensobjekt. `cardClickOpens`
        // entscheidet, ob der Klick wirklich ins Leere ging — Links, Knöpfe, Felder, Aufklapper
        // und Menüs bleiben unberührt.
        onClick={(e) => {
          if (cardClickOpens(e.target as Element)) {
            navigate(`/wissen/${k.id}`);
          }
        }}
        className={cx(
          "overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-tile",
          gate.locked ? "opacity-60" : "",
        )}
      >
        <div className="flex flex-col gap-[12px] px-[28px] pb-[20px] pt-[24px]">
          <div className="flex items-center gap-2">
            <PruefenPille ton="warn" kennung="art">
              <span className="uppercase">{t(kontext.labelKey)}</span>
            </PruefenPille>
            <span data-text="meta" className="text-[12.5px] text-muted">
              {meta}
            </span>
            {/* Das „···"-Menü der Karte (Auftrag §5.2a) — geschlossen nur das Symbol. */}
            <span className="ml-auto">
              <PruefenMenue
                kennung="karte"
                beschriftung={t("pruefen.menu.actions")}
                symbol={<MenueSymbol />}
              >
                {role === "admin" ? (
                  // JOB 3112 · V3: drei Stufen desselben Weges — Eintrag, Rückfrage, Stufenfrage.
                  // Die Stufenfrage steht HIER im Menüblatt und nicht im Fußband, obwohl es
                  // derselbe Ablauf ist: das Blatt legt eine Schließfläche über die ganze Seite
                  // (`PruefenMenue`, `fixed inset-0 z-30`), und ein Block im Fußband läge darunter
                  // — der erste Klick auf eine Stufe schlösse nur das Menü. Ein Ablauf, zwei Orte.
                  stufenfrage?.id === k.id && stufenfrage.weg === "admin" ? (
                    <div className="px-2.5 py-2">{stufenfrageBlock(gate)}</div>
                  ) : confirmTrueId === k.id ? (
                    <div className="px-2.5 py-2">
                      <div className="text-[12.5px] font-semibold text-trust-pos-text">
                        {t("val.markTrueConfirm")}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <button
                          type="button"
                          className="text-[12px] font-semibold text-muted hover:text-text"
                          onClick={() => setConfirmTrueId(null)}
                        >
                          {t("val.markTrueCancel")}
                        </button>
                        <button
                          type="button"
                          disabled={gate.locked || freigabe.isPending}
                          className="text-[12px] font-semibold text-trust-pos-text disabled:opacity-50"
                          onClick={() => freigabeStarten(k, "admin")}
                        >
                          {t("val.markTrueYes")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <PruefenMenueEintrag
                      disabled={gate.locked}
                      onClick={() => setConfirmTrueId(k.id)}
                    >
                      <Check size={13} aria-hidden="true" />
                      {t("val.markTrue")}
                    </PruefenMenueEintrag>
                  )
                ) : null}
                <div className="px-2.5 py-1.5">
                  <select
                    value=""
                    disabled={gate.locked || assign.isPending}
                    onChange={(e) => {
                      if (e.target.value) {
                        assign.mutate({ id: k.id, userId: e.target.value });
                      }
                    }}
                    className={selectCls}
                    aria-label={t("val.assign")}
                  >
                    <option value="">{t("val.assign")}</option>
                    {(users.data ?? []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.id}
                      </option>
                    ))}
                  </select>
                </div>
                <PruefenMenueEintrag onClick={() => navigate(`/wissen/${k.id}?edit=1`)}>
                  {t("val.editKo")}
                </PruefenMenueEintrag>
                <PruefenMenueEintrag onClick={() => navigate(`/wissen/${k.id}`)}>
                  {t("val.openDetails")}
                </PruefenMenueEintrag>
                <PruefenMenueEintrag
                  disabled={aiCheckRetry.isPending}
                  onClick={() => aiCheckRetry.mutate(k.id)}
                >
                  {t("val.aiCheck.retry")}
                </PruefenMenueEintrag>
                {darfLoeschen ? (
                  <>
                    <PruefenMenueTrenner />
                    {confirmDeleteId === k.id ? (
                      // AUFTRAG-mega45 Block E / SCRUM-412: der ZERSTÖRENDE Knopf trägt die
                      // Warnfarbe, der bewahrende die zurückhaltende — dieselbe Bauform wie in der
                      // Bibliothek, gehalten vom Sammler in
                      // `tests/app/mega45-loeschbestaetigung-sammler.test.ts`. Der Fragetext ist
                      // weiterhin umbruchfähig (`min-w-0 flex-1`); im Menüblatt konkurriert er
                      // allerdings mit nichts mehr um Platz — das war Pedis Bruch vom 04.07.
                      <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-2">
                        <span className="min-w-0 flex-1 text-[12px] font-semibold text-text">
                          {t("ko.deleteQ")}
                        </span>
                        <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                          {t("ko.deleteKeep")}
                        </Button>
                        <Button
                          variant="danger"
                          disabled={removeKo.isPending}
                          onClick={() => removeKo.mutate(k.id)}
                        >
                          {t("ko.deleteYes")}
                        </Button>
                      </div>
                    ) : (
                      <PruefenMenueEintrag onClick={() => setConfirmDeleteId(k.id)}>
                        {t("ko.deleteButton")}
                      </PruefenMenueEintrag>
                    )}
                  </>
                ) : null}
              </PruefenMenue>
            </span>
          </div>
          <Link
            to={`/wissen/${k.id}`}
            data-text="titel"
            className="text-[20px] font-[650] leading-snug tracking-[-0.2px] text-text underline-offset-4 hover:underline"
          >
            {k.title}
          </Link>
          <p
            data-testid="pruefen-karte-text"
            data-text="text"
            className="text-[15px] leading-[1.65] text-text"
          >
            {k.statement}
          </p>
          {quellen.length > 0 || bilder.length > 0 ? (
            <div className="flex flex-wrap gap-[8px]">
              {quellen.map((q) => (
                <span
                  key={q.id}
                  data-text="chip"
                  data-testid="pruefen-chip"
                  className="inline-flex items-center gap-[6px] rounded-[8px] border border-hairline bg-page px-[10px] py-[5px]"
                >
                  <FileText size={13} aria-hidden="true" className="text-muted" />
                  <span className="text-[12px] font-semibold text-text">{q.label}</span>
                </span>
              ))}
              {bilder.length > 0 ? (
                <span
                  data-text="chip"
                  data-testid="pruefen-chip"
                  className="inline-flex items-center gap-[6px] rounded-[8px] border border-hairline bg-page px-[10px] py-[5px]"
                >
                  <ImageIcon size={13} aria-hidden="true" className="text-muted" />
                  <span className="text-[12px] text-muted">
                    {t("pruefen.images", { n: bilder.length })}
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}

          {/* ---- „Mehr" (Auftrag §5.2b/§5.3) ------------------------------------------------- */}
          <PruefenMehr kennung="karte">
            <PruefenMehrZeile beschriftung={t("val.trust")}>
              <span className="inline-flex items-center gap-2">
                <ConfidenceBar value={k.confidence} showLabel={false} />
                <span className="font-mono">{sig.trust}</span>
              </span>
            </PruefenMehrZeile>
            <PruefenMehrZeile beschriftung={t("val.votesTitle")}>
              {t("val.votes", { have: sig.greenVotes, need: sig.needed })}
              {sig.redVotes > 0 ? ` · ${t("val.votesBlocked", { count: sig.redVotes })}` : ""}
              {sig.staleVotes > 0 ? ` · ${t("val.staleVotes", { count: sig.staleVotes })}` : ""}
            </PruefenMehrZeile>
            <PruefenMehrZeile beschriftung={t("pruefen.mehr.status")}>
              {t(reviewWork.labelKey)}
              <span className="ml-1 font-mono text-muted-2">v{sig.version}</span>
              <span className="ml-1 text-muted-2">{t("val.target", { n: sig.needed })}</span>
              {sig.authorTransferred ? ` · ${t("val.transferred")}` : ""}
              {sig.assigned ? ` · ${t("val.assigned")}` : ""}
            </PruefenMehrZeile>
            <PruefenMehrZeile beschriftung={t("pruefen.mehr.aiCheck")}>
              <AiCheckBadge
                aiCheck={k.aiCheck}
                onRetry={() => aiCheckRetry.mutate(k.id)}
                retryBusy={aiCheckRetry.isPending}
                modelActive={aiModelActive}
                subjectConfidentiality={k.confidentiality}
              />
            </PruefenMehrZeile>
            <PruefenMehrZeile beschriftung={t("lib.facet.confidentiality")}>
              <span data-testid="val-stufe" data-lage={k.auskunft.stufe.lage}>
                {t(k.auskunft.stufe.labelKey)}
              </span>
            </PruefenMehrZeile>
            {/* JOB 3027 · R4: Der Anker sitzt an der GANZEN Zeile — die Auskunft ist Beschriftung
                („Erfassungsweg", ausdrücklich NICHT „Herkunft") plus Wert. */}
            <PruefenMehrZeile
              beschriftung={t("val.herkunft.label")}
              kennung="val-herkunft"
              lage={k.auskunft.herkunft.lage}
            >
              {t(k.auskunft.herkunft.labelKey)}
            </PruefenMehrZeile>
            <PruefenMehrZeile beschriftung={t("lib.facet.category")}>
              <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                {k.category}
                <KnowledgeTypeTag type={k.type} />
                {k.tags.length > 0 ? (
                  <span className="text-muted-2">{k.tags.join(", ")}</span>
                ) : null}
              </span>
            </PruefenMehrZeile>
            <PruefenMehrBlock beschriftung={t("val.decisionLabel")}>
              {t(`val.decision.${sig.trustBand}`)} {t(reviewWork.hintKey)}
            </PruefenMehrBlock>
            <PruefenMehrBlock beschriftung={t("pruefen.mehr.reviewContext")}>
              <ValidationReviewContext ko={k} />
            </PruefenMehrBlock>
            <PruefenMehrBlock beschriftung={t("ko.author")}>
              <KoAuthorLine {...koAuthorParts(k, nameOf)} />
            </PruefenMehrBlock>
            {/* WP-D10 (Fix 4) + WP-BILD-1f: Erstellungsdatum und Ersteller BESCHRIFTET. In der
                Meta-Zeile der Karte stehen sie nach dem Mockup nackt („Autor · Bereich · Datum");
                wer wissen will, was die Zahl bedeutet, findet sie hier mit ihrem Wort. Fehlt beides
                (Altdaten), erscheint die Zeile ehrlich gar nicht. */}
            {createdLabel || createdByName ? (
              <PruefenMehrZeile beschriftung={t("ko.createdAt")}>
                {[
                  createdLabel ? `${t("ko.createdAt")} ${createdLabel}` : null,
                  createdByName ? t("ko.createdByName", { name: createdByName }) : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
              </PruefenMehrZeile>
            ) : null}
            {/* Auftrag §5.3: „die Quittung wandert in ‚Mehr' des nächsten Eintrags („zuletzt: …")". */}
            {lastDecision ? (
              <PruefenMehrBlock beschriftung={t("pruefen.lastDecision")}>
                <span data-testid="pruefen-zuletzt">
                  {t(reviewOutcome(lastDecision.verdict).statusKey)} — {lastDecision.title}
                </span>
                <span className="mt-1 flex flex-wrap gap-2">
                  {reviewNextSteps(lastDecision).map((s) => (
                    <Link
                      key={s.to}
                      to={s.to}
                      className="text-[12px] font-semibold text-ai hover:opacity-80"
                    >
                      {t(s.labelKey)} →
                    </Link>
                  ))}
                </span>
              </PruefenMehrBlock>
            ) : null}
          </PruefenMehr>

          {/* ---- JOB 3112 · V3: „es gibt ein zweites Exemplar" (2623 D1 §2 Punkt 3) ---------- */}
          {/* Nur bei belegtem Treffer. Kein Platzhalter beim Laden, KEIN Satz „keine Dublette"
              bei leerer Antwort: `/api/duplicates` gibt nur die für diesen Betrachter SICHTBAREN
              Paare heraus (overlap-routes.ts:59) und sichert damit keine Vollständigkeit zu — eine
              Entwarnung wäre eine Aussage über einen Bestand, den diese Antwort nicht abbildet.
              Der Satz nennt DASS, nie WAS: Titel und Inhalt der Gegenseite bleiben draussen.
              `data-text="text"` reiht ihn unter die Texte der Karte ein (wie die Zeilen aus
              `PruefenZustand`) — er ist eine Auskunft über DIESES Objekt, kein Erklärtext. */}
          {doppel ? (
            <p
              data-testid="pruefen-doppelhinweis"
              data-text="text"
              className="rounded-[10px] border border-dashed border-trust-warn-fill/60 bg-page px-3 py-2 text-[12.5px] text-trust-warn-text"
            >
              {doppel.anzahl > 1
                ? t("val.doppel.satzMehrere", {
                    n: doppel.anzahl,
                    beziehung: t(doppel.beziehungLabelKey),
                  })
                : t("val.doppel.satz", { beziehung: t(doppel.beziehungLabelKey) })}
              {/* Der Weg zum Vergleich nur für die Rollen, die ihn betreten dürfen
                  (`navigation.ts:204`, minRole controller) — sonst stünde dort ein toter Link. */}
              {darfVergleichen ? (
                <Link
                  to={`/duplikate/${doppel.eintragId}/vergleich`}
                  data-testid="pruefen-doppelhinweis-vergleich"
                  data-text="knopf"
                  className="ml-2 font-semibold underline-offset-4 hover:underline"
                >
                  {t("val.doppel.vergleich")} <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </p>
          ) : null}
        </div>

        {/* ---- Das Fußband (Pruefen.dc.html Z.58–61) ---------------------------------------- */}
        <div
          data-testid="pruefen-fussband"
          className="flex flex-wrap items-center gap-[10px] border-t border-hairline bg-page px-[28px] py-[16px]"
        >
          {gate.locked ? (
            <p data-text="text" className="w-full basis-full text-[11px] font-semibold text-muted">
              {t(gate.noteKey)}
            </p>
          ) : null}
          {REVIEW_DECISIONS.map((d) => {
            const aktivesFeld = feedback?.id === k.id && feedback.verdict === d.verdict;
            const gut = d.verdict === "up";
            return (
              <button
                key={d.verdict}
                type="button"
                data-text="knopf"
                data-testid={`pruefen-entscheidung-${d.verdict}`}
                title={t(decisionImpact(d.verdict).bodyKey)}
                disabled={
                  gate.locked ||
                  (gut
                    ? freigabe.isPending || reviewWithFeedback.isPending
                    : reviewWithFeedback.isPending)
                }
                // JOB 3112 · V3: „Freigeben" schickt nicht mehr unmittelbar — es geht durch den
                // einen Eingang, der zuerst `brauchtStufenfrage` fragt. Rückfrage und Ablehnen
                // bleiben unberührt (Lieferung 4): 2623 D1 §2 spricht von der FREIGABE, und eine
                // Ablehnung ist kein Anlass, eine Einstufung zu setzen.
                onClick={() =>
                  d.verdict === "up" ? freigabeStarten(k, "rate") : openFeedback(k.id, d.verdict)
                }
                className={cx(
                  "inline-flex items-center gap-[7px] rounded-[10px] px-[20px] py-[10px] text-[14px] leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  gut
                    ? "bg-trust-pos-fill font-semibold text-white hover:opacity-90"
                    : d.verdict === "down"
                      ? "border border-hairline bg-surface text-trust-crit-text hover:bg-hairline-soft"
                      : "border border-hairline bg-surface text-text hover:bg-hairline-soft",
                  aktivesFeld ? "ring-2 ring-current" : "",
                )}
              >
                {gut ? (
                  gate.locked ? (
                    <Lock size={14} aria-hidden="true" />
                  ) : (
                    <Check size={14} aria-hidden="true" />
                  )
                ) : d.verdict === "warn" ? (
                  <Minus size={14} aria-hidden="true" />
                ) : (
                  <X size={14} aria-hidden="true" />
                )}
                {t(d.labelKey)}
              </button>
            );
          })}
          {/* Die drei Punkte: grün gefüllt je Stimme, rot je Gegenstimme (Pruefen.dc.html:60). */}
          <span
            data-testid="pruefen-stimmenpunkte"
            title={t("val.votesHint", { need: sig.needed })}
            className="ml-auto flex items-center gap-[5px]"
          >
            {punkte.map((i) => {
              const rot = i < sig.redVotes;
              const gruen = !rot && i < sig.greenVotes;
              return (
                <span
                  // Die Punkte sind PLÄTZE (0…needed-1), keine Objekte — ihre Nummer IST ihre Identität.
                  key={`punkt-${i}`}
                  data-punkt={rot ? "rot" : gruen ? "gruen" : "leer"}
                  className={cx(
                    "h-[9px] w-[9px] rounded-full",
                    rot
                      ? "bg-trust-crit-fill"
                      : gruen
                        ? "bg-trust-pos-fill"
                        : "border-[1.5px] border-hairline",
                  )}
                />
              );
            })}
          </span>
          {/* Auftrag §5.3: eine Zeile „Freigegeben" 3 s im Fuß — nie ohne Serverantwort. */}
          {quittung ? (
            <p
              data-testid="pruefen-quittung"
              data-text="text"
              className="w-full basis-full text-[12px] font-semibold text-trust-pos-text"
            >
              {t("val.decisionSaved")} — {t(quittung.statusKey)}
            </p>
          ) : null}
          {/* JOB 3112 · V3: die Stufenfrage des FUSSBAND-Weges — dieselbe Stelle und dieselbe
              Bauform wie das Begründungsfeld darunter. Der Administratorweg stellt dieselbe Frage
              in seinem Menüblatt (Begründung dort). */}
          {stufenfrage?.id === k.id && stufenfrage.weg === "rate" ? stufenfrageBlock(gate) : null}
          {/* Begründungspflicht bleibt: Rückfrage/Ablehnen klappen das Feld hier auf. */}
          {feedback?.id === k.id ? (
            <div data-testid="pruefen-begruendung" className="w-full basis-full pt-2">
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={t("val.feedback.placeholder")}
                rows={3}
                aria-label={
                  feedback.verdict === "warn"
                    ? t("val.feedback.condTitle")
                    : t("val.feedback.rejTitle")
                }
                className="w-full resize-y rounded-input border border-hairline bg-surface p-2.5 text-sm text-text outline-none placeholder:text-muted-2 focus:border-ink/30"
              />
              {reviewWithFeedback.isError ? (
                <div className="mt-2 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                  {t("val.feedback.error")}
                </div>
              ) : null}
              <div className="mt-2 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  disabled={reviewWithFeedback.isPending}
                  onClick={() => {
                    setFeedback(null);
                    setFeedbackText("");
                  }}
                >
                  {t("val.feedback.cancel")}
                </Button>
                <Button
                  variant="primary"
                  disabled={
                    gate.locked ||
                    reviewWithFeedback.isPending ||
                    !isFeedbackSubmittable(feedbackText)
                  }
                  onClick={() =>
                    reviewWithFeedback.mutate({
                      id: k.id,
                      title: k.title,
                      verdict: feedback.verdict,
                      text: feedbackText,
                    })
                  }
                >
                  {t("val.feedback.submit")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ================================================================================================
  // JOB 3112 · V3 — DIE STUFENFRAGE. EINE BAUFORM, ZWEI AUFRUFSTELLEN, EINE ENTSCHEIDUNG.
  // ================================================================================================
  //
  // Auch sie ist eine ZEICHENFUNKTION und keine innere Komponente — dieselbe Begründung wie bei
  // `karte` (React hängt einen bei jedem Rendern neu erzeugten Typ ab und neu auf; die offene Frage
  // ginge bei jedem Tastendruck der Seite verloren).
  //
  // SIE LIEST IHREN GEGENSTAND AUS DEM ZUSTAND und nicht aus einem Parameter: welcher Eintrag und
  // welcher Weg gefragt sind, steht in `stufenfrage`. Damit gibt es die Entscheidung genau einmal —
  // das Fußband und das Menüblatt zeichnen dieselbe Frage, sie stellen keine zweite.
  //
  // WAS SIE NICHT TUT: vorbelegen. Kein Knopf ist gewählt, „intern" ist keine Voreinstellung, und
  // aus dem Wegklicken entsteht keine Stufe (`STUFENFRAGE_VERTRAG.setztNiemalsSelbst`).
  //
  // RUNDE 2 — die Frage trägt jetzt DEN GATE IHRER KARTE (Korrekturpflicht 1) und kennt einen
  // zweiten Zustand: den TEILERFOLG (Korrekturpflicht 2). Beide kommen von aussen herein, weil beide
  // an der Zeile hängen und nicht an der Frage.
  function stufenfrageBlock(gate: ValidationAiGate): JSX.Element {
    // Liegt die Stufe schon am Server und scheiterte nur die Freigabe, ist die FRAGE beantwortet.
    // Dann stehen keine Stufenknöpfe mehr da — man wählt nichts zum zweiten Mal —, sondern der
    // ehrliche Zwischenstand und die Wiederholung des EINEN fehlenden Aufrufs.
    //
    // RUNDE 3: gelesen wird der VORGANG (`stufenfrage.gespeichert`) und nicht mehr der letzte
    // Fehler. Sonst vergässe die zweite gescheiterte Wiederholung, was die erste bestätigt hat.
    const gespeicherteStufe = stufenfrage?.gespeichert ?? null;
    // Gesperrt heisst: nichts wird geschrieben. Abbrechen bleibt, es schickt nichts.
    const schreibenGesperrt = gate.locked || freigabe.isPending;
    return (
      <div data-testid="pruefen-stufenfrage" className="w-full basis-full pt-2">
        <p data-text="text" className="text-[12.5px] font-semibold text-text">
          {gespeicherteStufe ? t("val.stufenfrage.nurNochFreigeben") : t("val.stufenfrage.frage")}
        </p>
        {/* Die offene Frage sagt selbst, warum sie gerade nichts annimmt — der Sperrhinweis des
            Fußbandes steht im Menüblatt des Administratorwegs nicht zur Verfügung. */}
        {gate.locked ? (
          <p
            data-testid="pruefen-stufenfrage-gesperrt"
            data-text="text"
            className="mt-2 text-[11px] font-semibold text-muted"
          >
            {t(gate.noteKey)}
          </p>
        ) : null}
        {gespeicherteStufe ? null : (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {STUFENFRAGE_WAHLEN.filter((a) => a !== OHNE_STUFE).map((stufe) => (
              <button
                key={stufe}
                type="button"
                data-text="knopf"
                data-testid={`pruefen-stufenfrage-wahl-${stufe}`}
                disabled={schreibenGesperrt}
                onClick={() => stufenfrageBeantworten(stufe, gate)}
                className="rounded-[9px] border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-text hover:bg-hairline-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                {/* Der VORHANDENE Wortlaut der Stufen (`conf.level.*`) — keine zweite Fassung. */}
                {t(`conf.level.${stufe}`)}
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {gespeicherteStufe ? (
            // Die Wiederholung schickt AUSDRÜCKLICH `stufe: null` — genau ein Aufruf. Die Stufe ein
            // zweites Mal zu schreiben wäre eine Behauptung über einen Server, der sie schon hat.
            <button
              type="button"
              data-text="knopf"
              data-testid="pruefen-stufenfrage-wiederholen"
              disabled={schreibenGesperrt}
              onClick={() => freigabeSenden(null, gate)}
              className="rounded-[9px] border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-text hover:bg-hairline-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("val.stufenfrage.wiederholen")}
            </button>
          ) : (
            // „Gefragt, nicht erzwungen": EIN Klick übergeht die Frage, und es wird nichts gesetzt.
            <button
              type="button"
              data-text="knopf"
              data-testid="pruefen-stufenfrage-ohne"
              disabled={schreibenGesperrt}
              onClick={() => stufenfrageBeantworten(OHNE_STUFE, gate)}
              className="text-[12px] font-semibold text-muted underline-offset-4 hover:text-text hover:underline disabled:opacity-50"
            >
              {t("val.stufenfrage.ohneStufe")}
            </button>
          )}
          <button
            type="button"
            data-text="knopf"
            data-testid="pruefen-stufenfrage-abbrechen"
            disabled={freigabe.isPending}
            onClick={stufenfrageAbbrechen}
            className="text-[12px] font-semibold text-muted hover:text-text disabled:opacity-50"
          >
            {t("val.stufenfrage.abbrechen")}
          </button>
        </div>
        {/* Scheitert das Setzen der Stufe (oder die Freigabe selbst), bleibt die Frage OFFEN und
            sagt es. Kein stilles Weiterlaufen, keine Quittung ohne 2xx (Validation.tsx:31).
            ZWEI Meldungen, weil es zwei Zustände sind: „nichts gespeichert" ist etwas anderes als
            „die Stufe liegt, die Freigabe nicht" — die zweite Fassung nennt die Stufe beim Namen. */}
        {freigabe.isError ? (
          <p
            data-testid="pruefen-stufenfrage-fehler"
            data-text="text"
            className="mt-2 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
          >
            {gespeicherteStufe
              ? t("val.stufenfrage.fehlerNachStufe", {
                  stufe: t(`conf.level.${gespeicherteStufe}`),
                })
              : t("val.stufenfrage.fehler")}
          </p>
        ) : null}
      </div>
    );
  }
}

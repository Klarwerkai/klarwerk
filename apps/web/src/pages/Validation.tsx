import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Lock, Minus, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useDirectory, useReasonerStatus, useValidationBoard } from "../api/hooks";
import type { KnowledgeObject, Verdict } from "../api/types";
import { useSession } from "../app/AuthContext";
// SCRUM-417: Bearbeiten/Löschen vom Board — gleiche Rollenregel wie Bibliothek/KO-Detail.
import { useRole } from "../app/RoleContext";
import { useToast } from "../app/ToastContext";
// WP-SUBMIT-ASYNC: Status der Hintergrund-KI-Pruefung je Karte (pending/failed + Retry).
import { AiCheckBadge } from "../components/AiCheckBadge";
import { DemoBanner } from "../components/DemoBanner";
import { EmptyStateCtas } from "../components/EmptyStateCtas";
// AUFTRAG-mega45 Block H (SCRUM-425): DIESELBE Schiene wie die Bibliothek, keine zweite Fassung.
import { FacetFilter } from "../components/FacetFilter";
import { HelpTip } from "../components/HelpTip";
import { KoSummaryDisclosure } from "../components/KoSummaryDisclosure";
import { ValidationReviewContext } from "../components/ValidationReviewContext";
// D-033: `StatusPill` ist hier nicht mehr importiert — die Prüfkarte trägt statt der groben
// Status-Pille die feinere Prüfstands-Plakette. Die Komponente selbst bleibt unangetastet und
// wird von Bibliothek und Mobilansicht weiterhin verwendet.
import { ConfidenceBar, KnowledgeTypeTag, KoAuthorLine } from "../components/trust";
import { Button, Card, PageHeader, QueryState } from "../components/ui";
// WP-SHIP9-B3FIX: Poll-Intervall (geteilt mit Capture) + ehrliches Ausgrauen/Sperren, solange die
// KI-Prüfung eines Eintrags noch läuft — die Liste bekommt den Übergang pending → done selbst mit.
import { aiModelUsable } from "../lib/aiAvailability";
import { AI_CHECK_POLL_MS } from "../lib/aiCheckStatusCard";
// JOB 3027 · Station 4: die zwei Auskünfte der Board-Zeile (Stufe und Herkunft) in drei
// unterscheidbaren Lagen — abgeleitet, nicht geraten. Begründung im Kopf der Datei.
import {
  type PruefZeile,
  type StufenAuskunft,
  boardZeilen,
  stufenFacetLabelKey,
} from "../lib/boardAuskunft";
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
import { type FacetSelection, applyFacetSelection, toggleFacetValue } from "../lib/facets";
import { koAuthorParts } from "../lib/koAuthor";
// WP-D10 (Fix 4): lokalisiertes Erstellungsdatum aus dem vorhandenen KO-Feld (keine neue Persistenz).
import { formatKoTimestamp } from "../lib/koDates";
import {
  REVIEW_DECISIONS,
  type ReviewOutcomeTone,
  type ReviewTone,
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
import { type ReviewHelpId, reviewHelp } from "../lib/reviewHelp";
import {
  type ReviewWorkTone,
  type TrustBand,
  reviewSignals,
  reviewWorkView,
  sortByReviewPriority,
} from "../lib/reviewSignals";
import { useAuthorName } from "../lib/useAuthorName";
import { useReadiness } from "../lib/useReadiness";
// WP-SHIP9-B3FIX: pending-Gate (ausgrauen + Aktionen sperren) und Board-weites pending-Prädikat (Polling).
import { boardHasPendingAiCheck, validationAiGate } from "../lib/validationAiGate";
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

// SCRUM-249: Trust-Band → Tönung der Trust-Plakette (kritisch/mittel/gut).
const TRUST_TONE: Record<TrustBand, string> = {
  low: "bg-trust-crit-bg text-trust-crit-text",
  mid: "bg-trust-warn-bg text-trust-warn-text",
  high: "bg-trust-pos-bg text-trust-pos-text",
};

// SCRUM-258: Tönung der drei Review-Entscheidungs-Schaltflächen (Freigeben/Rückfrage/Ablehnen).
const DECISION_TONE: Record<ReviewTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  crit: "bg-trust-crit-bg text-trust-crit-text",
};

// SCRUM-406: je Entscheidung der passende ?-Hilfe-Baustein aus der zentralen Hilfe-Karte.
const DECISION_HELP: Record<ReviewVerdict, ReviewHelpId> = {
  up: "approve",
  warn: "query",
  down: "reject",
};

// SCRUM-365: Textfarbe der Entscheidungswirkungen in der „Was prüfe ich?"-Führung (Grün/Gelb/Rot).
const IMPACT_TEXT_TONE: Record<"pos" | "warn" | "crit", string> = {
  pos: "text-trust-pos-text",
  warn: "text-trust-warn-text",
  crit: "text-trust-crit-text",
};

// SCRUM-287: Review-Arbeitszustand konsistent zu MyTasks (neu/offen, zugewiesen, in Prüfung).
const REVIEW_WORK_TONE: Record<ReviewWorkTone, string> = {
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
  pos: "bg-trust-pos-bg text-trust-pos-text",
};

// JOB 3027: Tönung der Stufen-Plakette. Sie kommt AUS DER STUFE und nicht aus der Lage — „nicht
// eingestuft" und „Auskunft fehlt" sind Feststellungen, keine Alarme, und werden deshalb ruhig
// gezeichnet. Wer sie einfärbte, machte aus einer Auskunft eine Bewertung.
const STUFE_TONE: Record<StufenAuskunft["tone"], string> = {
  neutral: "bg-page text-muted",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  crit: "bg-trust-crit-bg text-trust-crit-text",
};

// SCRUM-292: Success-/Outcome-Card passend zum Verdict tönen (up/warn/down).
const OUTCOME_TONE: Record<
  ReviewOutcomeTone,
  { card: string; text: string; subtle: string; close: string }
> = {
  pos: {
    card: "border-trust-pos-fill/40 bg-trust-pos-bg",
    text: "text-trust-pos-text",
    subtle: "text-trust-pos-text/90",
    close: "text-trust-pos-text/70 hover:text-trust-pos-text",
  },
  warn: {
    card: "border-trust-warn-fill/40 bg-trust-warn-bg",
    text: "text-trust-warn-text",
    subtle: "text-trust-warn-text/90",
    close: "text-trust-warn-text/70 hover:text-trust-warn-text",
  },
  crit: {
    card: "border-trust-crit-fill/40 bg-trust-crit-bg",
    text: "text-trust-crit-text",
    subtle: "text-trust-crit-text/90",
    close: "text-trust-crit-text/70 hover:text-trust-crit-text",
  },
};

export function Validation(): JSX.Element {
  // WP-D10 (Fix 4): i18n.language für das lokalisierte Erstellungsdatum auf den Karten.
  const { t, i18n } = useTranslation();
  const [params, setSearchParams] = useSearchParams();
  const query = useValidationBoard();
  const users = useDirectory();
  const { user } = useSession();
  // PAKET 1.4 + 3.4 (bens V4): ehrlicher Name des Sperr-Hinweises je Modellzustand — „mit KI" nur bei
  // ECHT nutzbarem Modell (aktiv UND zuletzt erreichbar), nicht bloß konfiguriert. Sperr-Logik unverändert.
  const aiModelActive = aiModelUsable(useReasonerStatus().data);
  const qc = useQueryClient();
  // WP-SHIP9-B3FIX (Pedi 23.07.): Solange mindestens ein Eintrag noch in KI-Prüfung ist (aiCheck
  // pending), das Board im Hintergrund nachladen — ein ausgegrauter Eintrag wird ohne manuelles
  // Neuladen frei, sobald das Ergebnis (done/failed) vorliegt. Kein pending mehr → Polling stoppt.
  // Reine Anzeige-Aktualisierung (gleiches Muster wie die Live-Status-Karte auf /erfassen).
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
  // SCRUM-416: Flächen-Klick der Board-Karte führt ins KO-Detail (Tastatur-Weg bleibt der Titel-Link).
  const navigate = useNavigate();
  // SCRUM-417: Bearbeiten/Löschen direkt vom Board (Autor/Controller/Admin) — der Server
  // erzwingt dieselbe Regel (403 sonst); Löschen nur mit Inline-Bestätigung.
  const { role } = useRole();
  const { push } = useToast();
  // AUFTRAG-mega45 Block H (SCRUM-425): Zustand der Facetten-Schiene. Rein Ansicht — er berührt
  // weder `filter` (die fachliche Vorauswahl) noch den Review-Fokus noch eine Prüf-Aktion.
  const [facetSel, setFacetSel] = useState<FacetSelection>({});
  const [railUi, setRailUi] = useState<FacetRailUiState>(EMPTY_RAIL_UI);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [locallyDeletedKoIds, setLocallyDeletedKoIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const markDeletedKo = (id: string): void => {
    setLocallyDeletedKoIds((ids) => withDeletedKoId(ids, id));
  };
  const removeDeletedKoFromCaches = (id: string): void => {
    qc.setQueriesData<KnowledgeObject[]>({ queryKey: ["validation", "board"] }, (items) =>
      withoutKoById(items, id),
    );
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
  // FR-LIF-04: Autor je KO-Karte (Namen via Directory, Fallback ID).
  // AUFTRAG-mega62 Block H: die Auflösung kommt aus dem EINEN Haken (lib/useAuthorName.ts). Die
  // abgeschriebene Zeile hier sagte „Unbekannte Person", sobald das Verzeichnis nur NICHT DA war —
  // eine Aussage über die Person, wo gar keine feststand.
  const nameOf = useAuthorName();
  // SCRUM-364 / AG-15 follow-up: „Mir zugewiesen"-Linse lazy aus ?mine=1 (Ziel der Assignment-
  // Benachrichtigung) — die übrigen Filter starten leer. Aktiviert nur die vorhandene mineOnly-Filterung.
  const [filter, setFilter] = useState<ValidationFilterState>(() => ({
    ...EMPTY_VALIDATION_FILTER,
    mineOnly: readMineOnlyFilter(params),
  }));
  // SCRUM-364: „Mir zugewiesen" umschalten + URL synchron halten (übrige Query bleibt erhalten).
  const setMineOnly = (mineOnly: boolean): void => {
    setFilter((f) => ({ ...f, mineOnly }));
    setSearchParams((prev) => applyMineOnlyParam(prev, mineOnly), { replace: true });
  };
  // SCRUM-311: Herkunftsfilter (Demo/Eigenes) — ergänzend zur Review-Auswahl; lazy aus ?origin=…
  // (z. B. Capture-Success → eigenes Wissen), fehlend/ungültig → „all". Nur Ansicht, kein Review-Status.
  const [demoFilter, setDemoFilter] = useState<DemoKnowledgeFilter>(() =>
    readDemoKnowledgeFilter(params),
  );
  // SCRUM-327: Review-Fokus (Alle/Neu/Überarbeitet) — lazy aus ?review=…, fehlend/ungültig → „all".
  // Nur Ansicht; nutzt dieselbe neu-vs.-revision-Logik (Version > 1) wie SCRUM-326.
  const [reviewFocus, setReviewFocus] = useState<ReviewFocusFilter>(() =>
    readReviewFocusFilter(params),
  );
  // SCRUM-328: beide Fokusfilter auf Standard zurücksetzen (State + URL; übrige Query bleibt erhalten).
  const resetBoardFocus = (): void => {
    setDemoFilter("all");
    setReviewFocus("all");
    setSearchParams((prev) => resetBoardFocusParams(prev), { replace: true });
  };
  // Offenes Feedback-Formular (FE-VAL-06): pro KO + gewählter Verdict.
  const [feedback, setFeedback] = useState<{ id: string; verdict: FeedbackVerdict } | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  // SCRUM-277: letzte erfolgreiche Entscheidung → Rückmeldung + nächster Schritt (KO ansehen/nutzen).
  const [lastDecision, setLastDecision] = useState<{
    id: string;
    title: string;
    verdict: ReviewVerdict;
  } | null>(null);
  const selectCls =
    "h-10 rounded-input border border-hairline bg-surface px-2 text-sm text-text outline-none focus:border-ink/30";
  // SCRUM-406: einheitlicher ?-HelpTip aus der zentralen Hilfe-Karte des Prüfbereichs.
  const vhelp = (helpId: ReviewHelpId): JSX.Element => {
    const topic = reviewHelp(helpId);
    return <HelpTip title={t(topic.titleKey)} body={t(topic.bodyKey)} />;
  };

  const invalidate = (): void => void qc.invalidateQueries({ queryKey: ["validation"] });

  const rate = useMutation({
    // SCRUM-277: Titel mitführen → Rückmeldung/Next-Step benennt das betroffene KO.
    mutationFn: ({ id, verdict }: { id: string; title: string; verdict: Verdict }) =>
      endpoints.ko.act(id, { action: "rate", verdict }),
    onSuccess: (_data, vars) => {
      invalidate();
      setLastDecision({ id: vars.id, title: vars.title, verdict: vars.verdict });
    },
  });

  // Gelb/Rot: erst Pflicht-Kommentar, dann Bewertung (FE-VAL-06).
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
      invalidate();
      setFeedback(null);
      setFeedbackText("");
      setLastDecision({ id: vars.id, title: vars.title, verdict: vars.verdict });
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

  // WP-SUBMIT-ASYNC: Retry am failed-Badge — reiht die Hintergrund-Pruefung serverseitig neu ein
  // und laedt das Board nach, damit das Badge sofort auf „laeuft" wechselt.
  const aiCheckRetry = useMutation({
    mutationFn: (id: string) => endpoints.ko.aiCheckRetry(id),
    onSuccess: () => {
      invalidate();
      push("success", t("val.aiCheck.retryStarted"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  // Pedi 05.07.: Admin-Override „als wahr kennzeichnen" — schließt die Validierung komplett ab.
  // Zwei-Klick-Bestätigung im UI; danach verlässt das Objekt das Board (Status validiert).
  const [confirmTrueId, setConfirmTrueId] = useState<string | null>(null);
  const adminValidate = useMutation({
    mutationFn: (id: string) => endpoints.ko.act(id, { action: "admin-validate" }),
    onSuccess: () => {
      setConfirmTrueId(null);
      for (const key of [["validation"], ["kos"], ["analytics"], ["notifications"]]) {
        void qc.invalidateQueries({ queryKey: key });
      }
      push("success", t("val.markTrueDone"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  // Beschriftung eines Facettenwertes. Dieselbe Zuordnungsregel wie in der Bibliothek: der
  // Schlüssel wählt den Namensraum, der Wert wird angehängt. `pruefstand` und `maturity` bilden
  // die Ausnahme — sie führen ihren Beschriftungsschlüssel bereits in der Bauform mit
  // (`reviewWorkView` bzw. `useReadiness`), und genau der wird hier benutzt, damit Schiene und
  // Kartenabzeichen für denselben Zustand DASSELBE sagen.
  const facetValueLabel = (key: string, value: string): string => {
    switch (key) {
      case "pruefstand":
        return t(`val.reviewState.${value}`);
      case "maturity":
        return t(useReadiness(value as Parameters<typeof useReadiness>[0]).labelKey);
      case "trust":
        return t(`lib.facet.trustBucket.${value}`);
      case "confidentiality":
        // JOB 3027: die Beschriftung kommt aus derselben Zuordnung wie die Plakette auf der Karte —
        // die zwei Fehlzustände tragen keinen Stufennamen und dürfen deshalb keinen bekommen.
        return t(stufenFacetLabelKey(value));
      case "author":
        return nameOf(value);
      default:
        return value || t("lib.facet.none");
    }
  };

  // ------------------------------------------------------------------------------------------
  // AUFTRAG-mega45 Block H (SCRUM-425): die Facetten-Ableitung liegt BEWUSST hier — VOR dem
  // `return` und damit ausserhalb des children-Slots von `QueryState`.
  //
  // Läge sie im Slot, verschwände die Schiene bei jedem Lade- und Fehlerzustand; genau diesen
  // Rückschritt hat die Bibliothek bereits benannt und vermieden (Library.tsx). `items` ist
  // dasselbe Array, das `QueryState` unten durchreicht (`query.data`) — die Rechnung ist
  // identisch, sie steht nur früher.
  // ------------------------------------------------------------------------------------------
  // JOB 3027 · DIE NAHT: dieselben Zeilen, die `QueryState` unten durchreicht (`query.data`) — nur
  // EINMAL um die abgeleitete `auskunft` erweitert. Danach ist jede Zeile ein gewöhnliches
  // Wissensobjekt, und Filter, Sortierung und Abzeichen bleiben unangetastet. Kein Bestand
  // (laden/Fehler) = keine Zeile und damit auch keine Aussage über eine Einstufung.
  const items = boardZeilen(query.data);
  // JOB 3027 R2/R3 · NUR DER ERSTFEHLER OHNE JEDE ANTWORT ERSETZT DIE LISTE.
  //
  // Liegt eine Antwort im Cache, ist ein Fehler die Aussage „die AUFFRISCHUNG ist gescheitert" und
  // nicht „es gibt nichts zu zeigen". `QueryState` kennt diesen Unterschied nicht (es fragt
  // `isError` vor den Daten, ui.tsx:225-230) und liegt ausserhalb der Zielpfade dieses Auftrags —
  // die Unterscheidung wird deshalb HIER getroffen, an der einzigen Stelle, die beides weiss.
  //
  // GEMESSEN WIRD DIE QUERY-LAGE, NICHT DIE ZEILENZAHL (R3, BEN-Korrekturpflicht). In R2 stand hier
  // `items.length > 0`, und damit fiel eine erfolgreich geladene LEERE Antwort durch: sie ist
  // genauso eine belegte Auskunft („hier ist gerade nichts offen") wie eine mit zehn Zeilen, wurde
  // nach einem gescheiterten Refetch aber zur Erstfehlerfläche. `undefined` heisst „nie eine
  // Antwort gehabt", `[]` heisst „eine Antwort gehabt, sie war leer" — nur das Erste ist ein
  // Erstfehler. Dieselbe Lehre steht seit JOB 3002 R3/R4 im Haus (LEHREN.md: alter Leer-Cache plus
  // abgelehnter Refetch).
  //
  // Der Zusicherung liegt kein Verschweigen zugrunde: `auffrischungGescheitert` schaltet oben in der
  // Liste einen sichtbaren Hinweis, und die Fehlerfläche bleibt für den Fall OHNE Antwort
  // unverändert erhalten (gemessen in tests/pruefseite/zustandsmodell-cache.test.tsx, Fälle C4/E1).
  const auffrischungGescheitert = query.isError && query.data !== undefined;
  const boardZustand = (
    auffrischungGescheitert ? { ...query, status: "success", isError: false, error: null } : query
  ) as typeof query;
  const cats = categoryOptions(items);
  const tags = tagOptions(items);
  const types = typeOptions(items);
  // SCRUM-249: handlungsnah priorisieren (Autor-Transfer/niedriger Trust zuerst) — Filter
  // bleiben unverändert, es wird nichts verworfen, nur die Reihenfolge geschärft.
  const boardFiltered =
    withoutKoIds(
      items.filter((k) => matchesValidationFilter(k, filter, user?.id ?? null)),
      locallyDeletedKoIds,
    ) ?? [];
  // SCRUM-311: Herkunfts-Zähler über die (review-)gefilterte Menge; dann ergänzend nach
  // Herkunft filtern. Nur Ansicht — Status/Trust/Review-Entscheidung unberührt.
  const demoCounts: Record<DemoKnowledgeFilter, number> = {
    all: boardFiltered.length,
    demo: boardFiltered.filter((k) => matchesDemoKnowledgeFilter(k, "demo")).length,
    "non-demo": boardFiltered.filter((k) => matchesDemoKnowledgeFilter(k, "non-demo")).length,
  };
  // SCRUM-327: Review-Fokus über die fachlich + herkunfts-gefilterte Menge zählen, dann anwenden.
  const focusBase = boardFiltered.filter((k) => matchesDemoKnowledgeFilter(k, demoFilter));
  const reviewFocusCounts = countByReviewFocus(focusBase);
  const nachFokus = focusBase.filter((k) => matchesReviewFocus(k, reviewFocus));
  // Die Facetten-Schiene setzt GANZ ZULETZT an — sie ist reine Ansicht und lässt jede
  // vorgelagerte Prüf-Logik unberührt.
  const facetItems = nachFokus.map(validationFacetValues);
  const facetGroups = facetRailGroups(
    facetItems,
    VALIDATION_FACET_CONFIGS,
    facetSel,
    railUi,
    facetValueLabel,
  );
  // JOB 3027: `sortByReviewPriority` ist auf `KnowledgeObject` typisiert (reviewSignals.ts:111) und
  // gibt die Zeilen deshalb ohne ihre `auskunft` zurück — sie SORTIERT nur, sie baut keine neuen
  // Zeilen. Die Zusicherung steht hier, weil die Bibliotheksdatei ausserhalb der Zielpfade dieses
  // Auftrags liegt; sie generisch zu machen ist die saubere Lösung und gehört in den Job, der sie
  // besitzt. Falsch wird sie nicht stillschweigend: stünde auf der Karte danach keine Stufe, wäre
  // der gemountete Fall R1 rot.
  const visible = sortByReviewPriority(
    applyFacetSelection(nachFokus, validationFacetValues, facetSel),
  ) as PruefZeile[];
  // SCRUM-364 / AG-15: ehrlicher Leerzustand der persönlichen Linse (nur wenn „Mir zugewiesen"
  // aktiv ist und nichts für die Person offen ist) — hat Vorrang vor dem generischen Filter-Empty.
  //
  // AUFTRAG-mega47 Block D → AUFTRAG-mega48 Block D (bens P2): gezählt wird jetzt die PERSÖNLICHE
  // MENGE — der Bestand des Boards, auf den nur die persönliche Linse angewandt ist. Die persönliche
  // Linse beantwortet eine ZUSTANDSFRAGE („ist mir überhaupt Arbeit zugewiesen?"), alles andere auf
  // dieser Seite beantwortet eine SICHTFRAGE („was davon zeige ich gerade?"): Suche, Typ, Kategorie
  // und Schlagwort (`matchesValidationFilter`), „in Prüfung", Herkunft, Review-Fokus und die
  // Facetten. mega47 hat nur die Facetten vorgezogen; blendete einer der übrigen Sichtfilter die
  // zugewiesene Arbeit aus, sagte die Seite weiterhin „keine dir zugewiesene Review-Arbeit" — und
  // das ist schlicht falsch. Für die Sichtfrage steht direkt darunter der generische
  // Filter-Leerzustand bereit; er greift dann, weil `mineEmpty` null ist, benennt die aktiven
  // Fokusfilter und kann sie zurücksetzen. Kein neuer Text.
  //
  // `withoutKoIds` bleibt drin: eine gerade gelöschte Aufgabe ist keine Sicht, sondern weg.
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

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader kicker={t("val.kicker")} title={t("nav.validation")} pageKey="validierung" />
      {/* SCRUM-291: Demo-/Pilotpfad auf der Zielseite wiedererkennbar (nur bei ?demo=stage1). */}
      {isDemoContext(params) ? <DemoBanner surface="validation" /> : null}
      <p className="-mt-3 mb-4 text-sm text-muted">{t("val.intro")}</p>
      {/* SCRUM-277: Rückmeldung nach der Entscheidung + nächster Schritt (KO ansehen / optional nutzen). */}
      {lastDecision
        ? (() => {
            const outcome = reviewOutcome(lastDecision.verdict);
            const tone = OUTCOME_TONE[outcome.tone];
            return (
              <Card className={`mb-4 ${tone.card}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className={`text-[13px] font-semibold ${tone.text}`}>
                      {t("val.decisionSaved")}
                    </div>
                    <p className={`mt-0.5 truncate text-[12.5px] ${tone.subtle}`}>
                      {lastDecision.title}
                    </p>
                  </div>
                  <button
                    type="button"
                    title={t("val.feedback.cancel")}
                    onClick={() => setLastDecision(null)}
                    className={`shrink-0 ${tone.close}`}
                  >
                    <X size={16} />
                  </button>
                </div>
                {/* SCRUM-292: ehrliche Folge-Aussage je Verdict — up nutzbar (wenn Status/Trust tragen),
                    warn/down bleiben Review-/Feedback-Arbeit; keine automatische/Fake-Validierung. */}
                <p className={`mt-2 text-[12px] leading-relaxed ${tone.subtle}`}>
                  {t(outcome.statusKey)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {reviewNextSteps(lastDecision).map((s) => (
                    <Link
                      key={s.to}
                      to={s.to}
                      className="inline-flex items-center gap-1 rounded-btn bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90"
                    >
                      {t(s.labelKey)} <span aria-hidden="true">→</span>
                    </Link>
                  ))}
                </div>
              </Card>
            );
          })()
        : null}
      {/* AUFTRAG-mega45 Block H (SCRUM-425): Schiene links, Prüfliste rechts — dieselbe Aufteilung
          und dieselbe Komponente wie in der Bibliothek. Auf schmalen Geräten fällt die Spalte weg;
          FacetFilter zeigt dort von sich aus den Knopf „Filter (N)" und ein Vollbild-Filterblatt. */}
      <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
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
        <div className="min-w-0">
          {/* JOB 3027 R2 · CACHE SCHLÄGT FEHLER — aber der Fehlschlag wird BENANNT.
              react-query setzt bei einer gescheiterten AUFFRISCHUNG `status: "error"` und behält
              die Zeilen im Cache; `QueryState` fragt `isError` VOR den Daten (ui.tsx:225-230) und
              ersetzte damit vorhandene Karten durch eine Fehlerfläche — mitsamt Stufe und
              Herkunft. Wer gerade eine Freigabe erwog, verlor den Bestand, weil ein
              Hintergrund-Abruf scheiterte. Der Auftrag verlangt das Gegenteil (§9: „Cache mit
              gescheiterter Auffrischung — unverändert dasselbe").
              STILL WEGGELASSEN WIRD DER FEHLER DESHALB NICHT: die Zeile hier sagt, dass der
              angezeigte Stand nicht frisch ist. Ohne sie wäre die Reparatur eine Verschönerung. */}
          {auffrischungGescheitert ? (
            <p
              data-testid="val-auffrischung-fehler"
              className="mb-3 rounded-card border border-hairline bg-page px-3 py-2 text-[11.5px] text-muted"
            >
              {t("val.refreshFailed")}
            </p>
          ) : null}
          <QueryState
            query={boardZustand}
            emptyText={t("val.empty")}
            emptyExtra={<EmptyStateCtas context="validation" />}
          >
            {() => {
              return (
                <>
                  {/* SCRUM-364 / AG-15 follow-up: aktive „Mir zugewiesen"-Linse verständlich benennen —
                  „Das ist deine persönliche Review-Liste" + Zähler + Rückweg zur allgemeinen Liste. */}
                  {filter.mineOnly ? (
                    <Card className="mb-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-ai">
                            {t("val.mineFocus.title")}
                          </div>
                          <p className="mt-0.5 text-[12px] text-muted">{t("val.mineFocus.hint")}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[11px] font-semibold text-text">
                            {t("val.mineFocus.count", { n: visible.length })}
                          </span>
                          <button
                            type="button"
                            onClick={() => setMineOnly(false)}
                            className="text-[11.5px] font-semibold text-muted hover:text-text"
                          >
                            {t("val.mineFocus.reset")}
                          </button>
                        </div>
                      </div>
                    </Card>
                  ) : null}
                  {/* SCRUM-311: Herkunftsfilter (Demo/Eigenes) — nur Ansicht/Auffinden, KEIN Review-Status;
                  Labels konsistent mit der Library. Ersetzt nicht Status/Trust/Review-Entscheidung. */}
                  {/* Klara v1: data-help-Anker — Fokus in diesem Bereich erklärt ihn im Klara-Panel. */}
                  <div
                    data-help="rev:originFilter"
                    className="mb-3 flex flex-wrap items-center gap-1.5"
                  >
                    <span className="mr-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                      {t("lib.originLabel")}:
                    </span>
                    {vhelp("originFilter")}
                    {DEMO_KNOWLEDGE_FILTERS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          setDemoFilter(f);
                          // SCRUM-328: URL-Sync — Herkunft setzen, übrige Query (z. B. demo=stage1) erhalten.
                          setSearchParams(
                            (prev) =>
                              applyBoardFocusParams(prev, { origin: f, review: reviewFocus }),
                            { replace: true },
                          );
                        }}
                        className={`rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold ${
                          demoFilter === f
                            ? "border-ink bg-ink text-white"
                            : "border-hairline text-muted hover:text-text"
                        }`}
                      >
                        {t(demoKnowledgeFilterLabelKey(f))} · {demoCounts[f]}
                      </button>
                    ))}
                  </div>
                  {/* SCRUM-327: Review-Fokus (Alle/Neu/Überarbeitet) — nur Ansicht; Counts über die fachlich
                  + herkunfts-gefilterte Menge. Ersetzt keinen Filter, ändert keinen Review-Status. */}
                  <div
                    data-help="rev:reviewFocus"
                    className="mb-3 flex flex-wrap items-center gap-1.5"
                  >
                    <span className="mr-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                      {t("val.reviewFocus.label")}:
                    </span>
                    {vhelp("reviewFocus")}
                    {REVIEW_FOCUS_FILTERS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          setReviewFocus(f);
                          // SCRUM-328: URL-Sync — Review-Fokus setzen, übrige Query erhalten.
                          setSearchParams(
                            (prev) =>
                              applyBoardFocusParams(prev, { origin: demoFilter, review: f }),
                            { replace: true },
                          );
                        }}
                        className={`rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold ${
                          reviewFocus === f
                            ? "border-ink bg-ink text-white"
                            : "border-hairline text-muted hover:text-text"
                        }`}
                      >
                        {t(reviewFocusLabelKey(f))} · {reviewFocusCounts[f]}
                      </button>
                    ))}
                  </div>
                  {/* SCRUM-328: aktive Fokusfilter sichtbar benennen + zurücksetzbar. */}
                  {boardFocusActive({ origin: demoFilter, review: reviewFocus }) ? (
                    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-card border border-hairline bg-page px-3 py-2">
                      <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                        {t("val.focusActive.label")}:
                      </span>
                      {demoFilter !== "all" ? (
                        <span className="rounded-pill bg-surface px-2 py-0.5 text-[11px] font-semibold text-text">
                          {t("lib.originLabel")}: {t(demoKnowledgeFilterLabelKey(demoFilter))}
                        </span>
                      ) : null}
                      {reviewFocus !== "all" ? (
                        <span className="rounded-pill bg-surface px-2 py-0.5 text-[11px] font-semibold text-text">
                          {t("val.reviewFocus.label")}: {t(reviewFocusLabelKey(reviewFocus))}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={resetBoardFocus}
                        className="ml-auto text-[11.5px] font-semibold text-muted hover:text-text"
                      >
                        {t("val.focusReset")}
                      </button>
                    </div>
                  ) : null}
                  <div data-help="rev:filters" className="mb-4 flex flex-wrap items-center gap-2">
                    <input
                      value={filter.search}
                      onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
                      placeholder={t("val.filter")}
                      className="h-10 min-w-[12rem] flex-1 rounded-input border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
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
                    <label
                      data-help="rev:mineOnly"
                      className="flex h-10 items-center gap-1.5 rounded-input border border-hairline bg-surface px-3 text-sm text-muted"
                    >
                      <input
                        type="checkbox"
                        checked={filter.mineOnly}
                        onChange={(e) => setMineOnly(e.target.checked)}
                      />
                      {t("val.filterMine")}
                      {vhelp("mineOnly")}
                    </label>
                    {/* WP-SUBMIT-ASYNC: „in Pruefung" — nur Beitraege, deren Hintergrund-KI-Pruefung
                    noch laeuft (aiCheck pending); trivial im bestehenden Filter-Bereich. */}
                    <label className="flex h-10 items-center gap-1.5 rounded-input border border-hairline bg-surface px-3 text-sm text-muted">
                      <input
                        type="checkbox"
                        checked={filter.aiPending}
                        onChange={(e) => setFilter((f) => ({ ...f, aiPending: e.target.checked }))}
                      />
                      {t("val.filterAiPending")}
                    </label>
                    {vhelp("filters")}
                  </div>
                  <div className="space-y-3">
                    {/* SCRUM-364 / AG-15: spezifischer Leerzustand der persönlichen Linse — ruhig und
                    motivierend, mit Rückweg zur allgemeinen Liste. Vorrang vor dem generischen Filter-Empty. */}
                    {mineEmpty ? (
                      <Card className="text-center">
                        <p className="text-[13px] font-semibold text-text">
                          {t(mineEmpty.titleKey)}
                        </p>
                        <p className="mt-0.5 text-[12px] text-muted">{t(mineEmpty.hintKey)}</p>
                        <Button variant="ghost" className="mt-2" onClick={() => setMineOnly(false)}>
                          {t(mineEmpty.ctaKey)}
                        </Button>
                      </Card>
                    ) : null}
                    {/* SCRUM-328: ehrlicher Filter-Empty-State — Daten vorhanden, aber Filter zu eng.
                    QueryState behandelt den „gar keine Review-Arbeit"-Fall (items leer) separat. */}
                    {!mineEmpty &&
                    boardEmptyKind({ totalItems: items.length, visibleCount: visible.length }) ===
                      "filtered" ? (
                      <Card className="text-center">
                        <p className="text-[13px] text-muted">{t("val.focusEmpty.filtered")}</p>
                        {boardFocusActive({ origin: demoFilter, review: reviewFocus }) ? (
                          <Button variant="ghost" className="mt-2" onClick={resetBoardFocus}>
                            {t("val.focusReset")}
                          </Button>
                        ) : (
                          <p className="mt-1 text-[11.5px] text-muted-2">
                            {t("val.focusEmpty.otherFilters")}
                          </p>
                        )}
                      </Card>
                    ) : null}
                    {/* Beta Own-Knowledge Work Queue v0: bei aktiver „Eigenes Wissen"-Linse ohne eigene KOs
                    den Weg ins Erfassen zeigen — eigenes Wissen erscheint hier nach dem Speichern. */}
                    {(() => {
                      const ownEmpty = ownKnowledgeEmptyHint({
                        filter: demoFilter,
                        count: demoCounts["non-demo"],
                      });
                      if (!ownEmpty) {
                        return null;
                      }
                      return (
                        <Card>
                          <p className="text-[13px] font-semibold text-text">
                            {t(ownEmpty.titleKey)}
                          </p>
                          <p className="mt-0.5 text-[12px] text-muted">{t(ownEmpty.hintKey)}</p>
                          <Link
                            to={ownEmpty.to}
                            className="mt-2 inline-flex items-center gap-1 rounded-btn bg-ink px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90"
                          >
                            {t(ownEmpty.ctaKey)} <span aria-hidden="true">→</span>
                          </Link>
                        </Card>
                      );
                    })()}
                    {visible.map((k) => {
                      const sig = reviewSignals(k);
                      const reviewWork = reviewWorkView(k);
                      // WP-D10 (Fix 4): Erstellungsdatum aus dem VORHANDENEN KO-Feld — gleichnamige
                      // Beiträge werden unterscheidbar. Fehlt/unparsebar (Altdaten) → ehrlich weglassen.
                      const createdLabel = formatKoTimestamp(k.createdAt, i18n.language);
                      // WP-BILD-1f (Pedis Befund): der ERSTELLER aus dem vorhandenen KO-Vertrag —
                      // dezent neben dem Datum. Fehlt das Feld bei Altdaten, erscheint ehrlich nichts.
                      // WP-SAMMEL21-FIX (Pedis Autor-Entscheid, Fix 4): „von" zeigt den WISSENSTRÄGER
                      // (originalAuthor — beim Import der Quell-Autor, sonst identisch mit author)
                      // mit Vorrang vor dem System-Autor; nameOf fällt für Nicht-Nutzer (Quell-
                      // Autoren sind keine KLARWERK-Nutzer) auf den Roh-Namen zurück.
                      const vonId = k.originalAuthor?.trim() ? k.originalAuthor : k.author;
                      const createdByName = vonId ? nameOf(vonId).trim() : "";
                      // SCRUM-365 / AG-12: kontextbezogener Prüf-Fokus aus vorhandenen Signalen
                      // (revidiert → gezielt die Änderung; Autor übertragen → extra Blick).
                      const guideFocusKey = reviewGuidanceFocusKey({
                        kind: validationReviewContext(k).kind,
                        authorTransferred: sig.authorTransferred,
                      });
                      // WP-SHIP9-B3FIX (Pedi 23.07.): läuft die KI-Prüfung noch (aiCheck pending), ist die
                      // Karte reine Anzeige — ausgegraut, Prüf-Aktionen gesperrt, ehrlicher Hinweis. Sie
                      // bleibt sichtbar und zum KO-Detail (Lesen) klickbar; done/failed → normal bedienbar.
                      const gate = validationAiGate(k.aiCheck, aiModelActive);
                      return (
                        // AUFTRAG-mega59 BLOCK H3: der Zeilen-Anker des Prüf-Boards. Die
                        // Datenlage-Kalibrierung in tests-smoke/ui-smoke.spec.ts prüfte im
                        // geseedeten Zweig eine ABWESENHEIT (kein Leer-Text) — die ist auch im Lade-
                        // und im Fehlerzustand erfüllt, ein Lauf mit leerem oder fehlgeschlagenem
                        // Board war damit grün und löste die Kalibrierung nicht ein. Für die
                        // POSITIVE Zusicherung („mindestens ein Prüf-Eintrag ist sichtbar") gab es
                        // auf /validierung keinen Anker; hier ist er.
                        <div key={k.id} data-testid="validation-row" className="space-y-2">
                          {/* SCRUM-416: ganze Karte klickbar (freie Fläche → KO-Detail, sichtbarer
                          Hover); Entscheidungs-Knöpfe/Aufklapper/Links bleiben sauber getrennt. */}
                          <Card
                            // E2E-012/013: die Karte enthält Links, Buttons und ein Zuweisungs-Select —
                            // daher NICHT selbst role="button" (kein verschachtelter Button, kein
                            // Sammel-Accessible-Name). Container mit Maus-Komfortklick; Tastatur/AT nutzen
                            // den Titel-Link und die inneren Steuerelemente.
                            interactive={false}
                            onClick={(e) => {
                              if (cardClickOpens(e.target as Element)) {
                                navigate(`/wissen/${k.id}`);
                              }
                            }}
                            // JOB 2935 D1 (Pedis Wort zum Ist-Stand: „peinlich"): die Karte war bis
                            // hierher zweispaltig — links der Inhalt, rechts eine schmale Säule, in
                            // der Entscheidung, Zuweisung und Verwaltung übereinander klebten. Das
                            // Zielbild (DESIGN_ZIELBILD_20260827/Validierung.dc.html, Z. 56–63) zeigt
                            // stattdessen ein FUSSBAND über die volle Kartenbreite: die Entscheidung
                            // links, der Begründungshinweis rechts an der Kante, darüber eine
                            // Trennlinie. Deshalb bleibt die Karte hier auch auf breiten Schirmen
                            // eine Spalte (Inhalt oben, Fußband unten) — genau der Wechsel, den die
                            // sechs Messfälle V1/V2/V3/V4/V7/V9 in tests/design/zielbild-validierung
                            // seit JOB 2618 D5 als offene Bauaufgabe rot festhalten.
                            className={`flex cursor-pointer flex-col gap-3 transition-colors hover:border-ink/30 ${
                              gate.locked ? "opacity-60" : ""
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              {/* SCRUM-396: Titel zuerst und deutlich — er ging zwischen Badges und
                              Meta-Zeilen unter; klar als Link erkennbar (KO-Detail = Ort für
                              Bearbeiten/Löschen). Badges rücken in eine ruhige Zeile darunter. */}
                              {/* SCRUM-425 (Pedi 03.07.): Titel-Typografie, -Hover und Pill-Abstand
                              an die Bibliothek angeglichen (dort text-[15px], nur Unterstreichung
                              beim Hover, gap-1.5) — eine ruhige, konsistente Board-/Listen-Optik. */}
                              {/* JOB 2935 D2 — DER KLEINSTE STRUKTURFIX, den die neue Messung
                              verlangt hat. `truncate` galt bisher auf JEDER Breite. Auf der
                              Kartenbreite von D1 reicht der Platz, gemessen im Classic-Standard bei
                              1280 px: Überlauf 0. In einem Word-nahen schmalen Fenster (360 px; das
                              Aufgabenfenster ist im Produkt 340 px breit, KlaraAssistant.tsx:355)
                              reicht er nicht — dort wurde der Titel wieder abgeschnitten, gemessener
                              Überlauf 2 px. Und der Titel ist auf einem Prüfboard die einzige
                              Angabe, an der man die Karten auseinanderhält; genau darum ging es in
                              D1. `sm:truncate` statt `truncate`: schmal darf der Titel UMBRECHEN,
                              ab der ersten Tailwind-Stufe bleibt die ruhige einzeilige Optik
                              unverändert. Eine Zeile, keine Farbe, kein Token, kein Wortlaut. */}
                              <Link
                                to={`/wissen/${k.id}`}
                                className="block text-[15px] font-semibold leading-snug text-text underline-offset-4 hover:underline sm:truncate"
                              >
                                {k.title}
                              </Link>
                              {/* JOB 1100 / D-033: die Marke der Etikettenzeile. Sie ist die
                                  einzige belastbare Art, die Etiketten zu ZÄHLEN — eine Zählung
                                  über Textfragmente träfe auch den Titel und die Meta-Zeilen
                                  darunter. Ausschliesslich Testadressierbarkeit: Reihenfolge,
                                  Abstände und Tönung bleiben unverändert. */}
                              <div
                                data-testid="validation-card-labels"
                                className="mt-1 flex flex-wrap items-center gap-1.5"
                              >
                                <KnowledgeTypeTag type={k.type} />
                                {/* D-033 (a): HIER STAND DIE STATUS-PILLE — und sie sagte auf
                                    diesem Board fast nichts. Das Prüfboard holt ausschliesslich
                                    offene Objekte (`services/validation/src/service.ts:327`,
                                    `status: "offen"`), also trug die Pille auf jeder Karte
                                    praktisch denselben Wert. Dieselben Felder wertet
                                    `reviewWorkView` feiner aus — neu erfasst, zugewiesen,
                                    Bewertung begonnen, validiert. Diese Plakette lag bis hierher
                                    im Aufklapper und ist jetzt an ihrer Stelle: Der Tausch ist
                                    verlustfrei, weil die feinere Aussage die gröbere enthält. */}
                                <span
                                  className={`rounded-pill px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${REVIEW_WORK_TONE[reviewWork.tone]}`}
                                >
                                  {t(reviewWork.labelKey)}
                                </span>
                                {/* WP-SUBMIT-ASYNC: Status der Hintergrund-KI-Pruefung — laeuft/
                                fehlgeschlagen (Ursache im Tooltip, Retry reiht neu ein);
                                done/Altbestand zeigt bewusst nichts. */}
                                <AiCheckBadge
                                  aiCheck={k.aiCheck}
                                  onRetry={() => aiCheckRetry.mutate(k.id)}
                                  retryBusy={aiCheckRetry.isPending}
                                  modelActive={aiModelActive}
                                  // AUFTRAG-mega9 Block E-3 (KW-E2E-007): die ECHTE Stufe dieses Objekts —
                                  // sonst behauptet der Grund „Vertraulich", obwohl nur der VERGLEICHS-
                                  // partner vertraulich war (Paar-Eigenschaft, s. aiCheckStatusCard).
                                  subjectConfidentiality={k.confidentiality}
                                />
                                {/* JOB 3027 · STATION 4 — WIE VERTRAULICH, IN DREI LAGEN.
                                    Die Stufe stand auf dieser Karte bis hierher NIRGENDS; ihr
                                    einziges Vorkommen war die Weitergabe an das KI-Abzeichen
                                    darüber, die nur die Begründung eines anderen Zustands trägt.
                                    GENAU EIN neues Element in dieser Zeile: sie wird gezählt
                                    (D-033, `validation-card-labels`), eine zweite Ergänzung
                                    verfälschte die Zählung. Die Herkunft steht deshalb unten im
                                    Aufklapper. Der Text kommt aus `boardAuskunft` und ist bei
                                    fehlender Stufe ausdrücklich NICHT „Intern". */}
                                <span
                                  data-testid="val-stufe"
                                  data-lage={k.auskunft.stufe.lage}
                                  title={t("lib.facet.confidentiality")}
                                  className={`rounded-pill px-1.5 py-0.5 font-mono text-[10px] font-semibold ${STUFE_TONE[k.auskunft.stufe.tone]}`}
                                >
                                  {t(k.auskunft.stufe.labelKey)}
                                </span>
                                {/* D-033 (b): VERTRAUEN UND GRÜNANTEIL SIND EIN ABZEICHEN.
                                    Bei null Bewertungen sagten die beiden getrennten Pillen
                                    buchstäblich dasselbe. Zusammengelegt statt gestrichen — und
                                    zwar bewusst: „Vertrauen" trägt zusätzlich die Gelb-Stimmen,
                                    die Ask-Rückmeldungen und den Konfliktabzug, die auf dieser
                                    Karte sonst nirgends erscheinen. Wer es streicht, verliert sie.
                                    BEIDE TÖNUNGEN BLEIBEN: der Rahmen trägt das Trust-Band, der
                                    Stimmenteil behält seine eigene Erreicht-Färbung — auch das
                                    ist Information, nicht Dekoration.
                                    SCRUM-416 (Trust sichtbar) und Pedi 05.07. (Fortschritt + ?-Hilfe)
                                    gelten unverändert weiter; nur die Form ist verdichtet. */}
                                <span
                                  className={`inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 font-mono text-[10px] font-semibold ${TRUST_TONE[sig.trustBand]}`}
                                >
                                  <span>
                                    {t("val.trust")} {sig.trust}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span
                                    title={t("val.votesHint", { need: sig.needed })}
                                    className={`rounded-pill px-1 ${
                                      sig.greenVotes >= sig.needed
                                        ? "bg-trust-pos-bg text-trust-pos-text"
                                        : "bg-trust-warn-bg text-trust-warn-text"
                                    }`}
                                  >
                                    {t("val.votes", { have: sig.greenVotes, need: sig.needed })}
                                  </span>
                                  <HelpTip
                                    title={t("val.votesTitle")}
                                    body={t("val.votesHint", { need: sig.needed })}
                                  />
                                </span>
                                {sig.redVotes > 0 ? (
                                  <span className="rounded-pill bg-trust-crit-bg px-1.5 py-0.5 font-mono text-[10px] font-semibold text-trust-crit-text">
                                    {t("val.votesBlocked", { count: sig.redVotes })}
                                  </span>
                                ) : null}
                                {/* SCRUM-507 R2: Bewertungen aus einer frueheren Revision sind veraltet und
                                zaehlen nicht mehr — ehrlich sichtbar, damit „X von Y gruen" nicht taeuscht. */}
                                {sig.staleVotes > 0 ? (
                                  <span
                                    title={t("val.staleVotesHint", { version: sig.version })}
                                    className="rounded-pill bg-page px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-2"
                                  >
                                    {t("val.staleVotes", { count: sig.staleVotes })}
                                  </span>
                                ) : null}
                                {/* D-033 (c): Die Kategorie stand ohne Beschriftungswort zwischen
                                    lauter Prüfzuständen und las sich dadurch wie ein weiterer.
                                    Der Schlüssel ist der vorhandene, dreisprachige aus der
                                    Bibliotheks-Facette — kein neuer Text. */}
                                <span className="font-mono text-[11px] text-muted-2">
                                  {t("lib.facet.category")}: {k.category}
                                </span>
                                {/* WP-D10 (Fix 4) + WP-BILD-1f (Pedi): dezentes Erstellungsdatum plus
                                Ersteller (Erstellt am … von …) — unterscheidet gleichnamige
                                Beiträge; fehlende Felder (Altdaten) bleiben ehrlich weg. */}
                                {/* JOB 2935 D1: Solange die Karte zweispaltig war, brach diese Zeile
                                fast immer um, und Kategorie und Erstellungsangabe standen
                                untereinander. Auf der vollen Breite stehen sie nebeneinander — und
                                liefen dann ohne Trenner ineinander („… Allgemein Erstellt am …").
                                Das Zielbild trennt genau diese Angaben mit einem Mittelpunkt
                                (Validierung.dc.html:54). Der Trenner steht bewusst als CSS-Inhalt
                                (`before:`) und nicht als eigenes Element: die Etikettenzeile
                                darüber wird GEZÄHLT (D-033, `validation-card-labels`), ein
                                zusätzliches Kind hätte diese Zählung verfälscht. */}
                                {createdLabel || createdByName ? (
                                  <span
                                    title={t("ko.createdAt")}
                                    className="font-mono text-[10.5px] text-muted-2 before:mr-1.5 before:content-['·']"
                                  >
                                    {[
                                      createdLabel ? `${t("ko.createdAt")} ${createdLabel}` : null,
                                      createdByName
                                        ? t("ko.createdByName", { name: createdByName })
                                        : null,
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                  </span>
                                ) : null}
                              </div>
                              {/* WP-SHIP9-S2 Paket 3 (E2): Kurzvorschau-Aufklapper — die vorhandene
                              Kernaussage auf einen Blick, ohne das KO zu öffnen (kein Roundtrip). */}
                              <KoSummaryDisclosure source={k} className="mt-2" />
                              {/* SCRUM-416 (Pedi 03.07.): Karten-Dichte — Signale, Kontext, Autor,
                              Entscheidungs-Hinweis und Prüf-Führung wandern hinter EINE ruhige
                              Aufklappung. Nichts entfernt, nur verlagert; alles Weitere im KO-Detail. */}
                              <details className="mt-2">
                                <summary className="cursor-pointer list-none text-[11.5px] font-semibold text-muted hover:text-text">
                                  {t("val.more")}
                                </summary>
                                <div className="mt-2 space-y-2">
                                  {/* SCRUM-249: Review-Signale kompakt — Trust, Version, Ziel, Provenance. */}
                                  <div className="flex flex-wrap items-center gap-2">
                                    <ConfidenceBar value={k.confidence} showLabel={false} />
                                    <span className="font-mono text-[10px] text-muted-2">
                                      v{sig.version}
                                    </span>
                                    <span className="font-mono text-[11px] text-muted-2">
                                      {t("val.target", { n: sig.needed })}
                                    </span>
                                    {sig.authorTransferred ? (
                                      <span className="rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-trust-warn-text">
                                        {t("val.transferred")}
                                      </span>
                                    ) : null}
                                    {sig.assigned ? (
                                      <span className="rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted">
                                        {t("val.assigned")}
                                      </span>
                                    ) : null}
                                    {/* D-033 (a): Die Prüfstands-Plakette stand bis hierher AN
                                        DIESER STELLE — im Aufklapper, während die gröbere
                                        Status-Pille vorn auf der Karte saß. Sie ist jetzt oben in
                                        der Etikettenzeile und steht deshalb hier nicht mehr:
                                        zweimal dieselbe Aussage wäre keine Verdichtung. Der
                                        Hinweistext `reviewWork.hintKey` bleibt unverändert im
                                        Entscheidungs-HelpTip weiter unten erreichbar. */}
                                    {vhelp("signals")}
                                  </div>
                                  {/* SCRUM-326: Review-Kontext — neu/offen vs. revidiert (Version>1) + Hinweis. */}
                                  <ValidationReviewContext ko={k} />
                                  <div className="mt-1">
                                    <KoAuthorLine {...koAuthorParts(k, nameOf)} />
                                  </div>
                                  {/* JOB 3027 · STATION 4 — WOHER, neben dem WER.
                                      Beschriftet mit `val.herkunft.label` („Erfassungsweg") und
                                      ausdrücklich NICHT mit `lib.originLabel` („Herkunft"): dieses
                                      Wort trägt auf derselben Seite schon der Demo-/Eigenes-Filter
                                      (:602-604), und zweimal dasselbe Wort für zwei verschiedene
                                      Sachen wäre wieder Raten. Für `word_addin` gilt der bereits
                                      vorhandene Wortlaut des Chips aus Bibliothek und KO-Detail. */}
                                  <p
                                    data-testid="val-herkunft"
                                    data-lage={k.auskunft.herkunft.lage}
                                    className="mt-1 text-[11.5px] text-muted"
                                  >
                                    <span className="font-semibold text-text">
                                      {t("val.herkunft.label")}:{" "}
                                    </span>
                                    {t(k.auskunft.herkunft.labelKey)}
                                  </p>
                                  {/* SCRUM-249: ehrlicher Entscheidungs-Hinweis (aus Trust-Band abgeleitet).
                              SCRUM-396: auf EINE Zeile verdichtet — Volltext im ?-HelpTip, damit die
                              Karte keine Textwand wird (nichts entfernt, nur Dichte). */}
                                  <p className="mt-1 flex min-w-0 items-center gap-1 text-[11.5px] text-muted">
                                    <span className="min-w-0 truncate">
                                      <span className="font-semibold text-text">
                                        {t("val.decisionLabel")}{" "}
                                      </span>
                                      {t(`val.decision.${sig.trustBand}`)}
                                    </span>
                                    <HelpTip
                                      title={t("val.decisionLabel")}
                                      body={`${t(`val.decision.${sig.trustBand}`)} ${t(reviewWork.hintKey)}`}
                                    />
                                  </p>
                                  {/* SCRUM-365 / AG-12 / PI-K2: ruhige, einklappbare Review-Führung —
                              „Was prüfe ich?" (Checkliste + Kontext-Fokus) + „Was bewirkt die
                              Entscheidung?" + ehrliche Trust-/Quorum-Notiz. Progressive disclosure,
                              damit das Board nicht zur Formularwand wird. */}
                                  <details className="mt-2">
                                    <summary className="cursor-pointer list-none text-[11.5px] font-semibold text-ai hover:opacity-80">
                                      {t("val.guide.title")}
                                    </summary>
                                    <div className="mt-2 space-y-2 rounded-card border border-hairline bg-page px-3 py-2.5">
                                      <ul className="space-y-1">
                                        {REVIEW_CHECK_ITEMS.map((item) => (
                                          <li
                                            key={item.id}
                                            className="text-[11.5px] leading-relaxed text-muted"
                                          >
                                            <span className="font-semibold text-text">
                                              {t(item.labelKey)}
                                            </span>{" "}
                                            {t(item.hintKey)}
                                          </li>
                                        ))}
                                      </ul>
                                      {guideFocusKey ? (
                                        <p className="text-[11.5px] leading-relaxed text-trust-warn-text">
                                          {t(guideFocusKey)}
                                        </p>
                                      ) : null}
                                      <div className="border-t border-hairline pt-2">
                                        <div className="mb-1 font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                                          {t("val.guide.impactTitle")}
                                        </div>
                                        <ul className="space-y-1">
                                          {DECISION_IMPACTS.map((d) => (
                                            <li
                                              key={d.verdict}
                                              className="text-[11.5px] leading-relaxed text-muted"
                                            >
                                              <span
                                                className={`font-semibold ${IMPACT_TEXT_TONE[d.tone]}`}
                                              >
                                                {t(d.titleKey)}:
                                              </span>{" "}
                                              {t(d.bodyKey)}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                      <p className="border-t border-hairline pt-2 text-[11px] leading-relaxed text-muted-2">
                                        {t(DECISION_TRUST_NOTE_KEY)}
                                      </p>
                                    </div>
                                  </details>
                                </div>
                              </details>
                              {/* SCRUM-396: expliziter Weg ins KO-Detail — dort liegen Bearbeiten und
                              „Wissensobjekt löschen" (Autor/Controller/Admin). Kein Direkt-Löschen
                              auf dem Board: die bewusste Hürde (Inline-Bestätigung im Detail) bleibt. */}
                              <Link
                                to={`/wissen/${k.id}`}
                                className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-ai hover:opacity-80"
                              >
                                {t("val.openDetails")} <span aria-hidden="true">→</span>
                              </Link>
                            </div>
                            {/* JOB 2935 D1 · DAS FUSSBAND. Vier der Sollwerte stehen hier an einer
                            Stelle, damit sie nicht wieder auseinanderlaufen — jeder ist im Zielbild
                            (Validierung.dc.html:56) belegt und wird von einem eigenen Fall gemessen:
                              gap-2.5      = 10px Knopfabstand   → V1
                              pt-3.5       = 14px Oberabstand    → V2
                              border-t     = 1px Trennlinie      → V3
                              border-hairline → --kw-hairline    → V4 (#E9E5DE im Theme „modern")
                            Die Knöpfe sind ABSICHTLICH direkte Kinder des Bandes: so ist der
                            gemessene `gap` wirklich der Abstand zwischen ihnen und nicht der einer
                            Zwischenhülle. Nicht übernommen und weiterhin offen: die eigene Fläche
                            des Bandes (#FAF8F5) — sie erbt die Karte, das wäre ein Produktumbau. */}
                            <div className="flex w-full flex-wrap items-center gap-2.5 border-t border-hairline pt-3.5">
                              {/* WP-SHIP9-B3FIX (Pedi 23.07.): ehrlicher Sperr-Hinweis, solange die
                              KI-Prüfung läuft — die Aktionen darunter sind bis zum Ergebnis deaktiviert.
                              JOB 2935 D1: eigene volle Zeile ÜBER den Knöpfen statt einer schmalen
                              Spalte daneben — er begründet die Sperre, die man direkt darunter sieht. */}
                              {gate.locked ? (
                                <p className="w-full basis-full text-[11px] font-semibold text-muted">
                                  {t(gate.noteKey)}
                                </p>
                              ) : null}
                              {/* SCRUM-258: Review-Entscheidung textlich geführt — gleiche Mutationen
                              (up/warn/down), Rückfrage/Ablehnen öffnen weiterhin das Pflicht-Feedback. */}
                              {REVIEW_DECISIONS.map((d) => {
                                const active =
                                  feedback?.id === k.id && feedback.verdict === d.verdict;
                                return (
                                  <span
                                    key={d.verdict}
                                    className="inline-flex items-center gap-0.5"
                                  >
                                    <button
                                      type="button"
                                      // SCRUM-365: Hover/Touch zeigt direkt die ehrliche Wirkung der Entscheidung.
                                      title={t(decisionImpact(d.verdict).bodyKey)}
                                      disabled={
                                        // WP-SHIP9-B3FIX: gesperrt, solange die KI-Prüfung noch läuft.
                                        gate.locked ||
                                        (d.verdict === "up"
                                          ? rate.isPending || reviewWithFeedback.isPending
                                          : reviewWithFeedback.isPending)
                                      }
                                      onClick={() =>
                                        d.verdict === "up"
                                          ? rate.mutate({
                                              id: k.id,
                                              title: k.title,
                                              verdict: "up",
                                            })
                                          : openFeedback(k.id, d.verdict)
                                      }
                                      className={`flex h-9 items-center gap-1.5 rounded-btn px-2.5 text-[12.5px] font-semibold hover:opacity-80 disabled:opacity-50 ${DECISION_TONE[d.tone]} ${
                                        active ? "ring-2 ring-current" : ""
                                      }`}
                                    >
                                      {/* PAKET 3.2 (Pedi 23.07.): im gesperrten Zustand trägt „Freigeben"
                                        KEIN ✓-Häkchen (das las sich wie „schon freigegeben") — statt
                                        dessen ein neutrales Schloss. „0 von 3 grün" bleibt die Wahrheit. */}
                                      {d.verdict === "up" ? (
                                        gate.locked ? (
                                          <Lock size={15} />
                                        ) : (
                                          <Check size={15} />
                                        )
                                      ) : d.verdict === "warn" ? (
                                        <Minus size={15} />
                                      ) : (
                                        <X size={15} />
                                      )}
                                      <span>{t(d.labelKey)}</span>
                                      {d.requiresFeedback ? <sup className="-mr-0.5">*</sup> : null}
                                    </button>
                                    {vhelp(DECISION_HELP[d.verdict])}
                                  </span>
                                );
                              })}
                              {/* SCRUM-258: Pflicht-Feedback sichtbar machen (Rückfrage/Ablehnen).
                              JOB 2935 D1: der Hinweis stand als eigene Zeile unter den Knöpfen und
                              war mit 10.5px der kleinste Text der Seite. Jetzt steht er da, wo das
                              Zielbild ihn zeigt — `ml-auto` schiebt ihn an die rechte Bandkante,
                              auf Augenhöhe mit dem Sternchen, das er erklärt (→ V9), und er trägt
                              den Schriftgrad der Vorlage (11.5px → V7). Der WORTLAUT bleibt
                              unverändert: das Sternchen ist der Bezug zum `<sup>*</sup>` an
                              Rückfrage und Ablehnen; das Zielbild schreibt ihn ohne Stern und ohne
                              Punkt, doch dort gibt es auch kein Sternchen am Knopf. Diese eine
                              Abweichung ist damit eine offene Entscheidung, kein Versäumnis. */}
                              <p className="ml-auto text-[11.5px] text-muted-2">
                                {t("val.feedbackRequiredHint")}
                              </p>
                              {/* JOB 2935 D1: die NEBENAKTIONEN — Zuweisen, „als wahr", Bearbeiten,
                              Löschen. Sie stehen im Zielbild nicht, gehören aber zum Produkt. Sie
                              bekommen deshalb eine eigene, ruhige zweite Zeile des Bandes
                              (`basis-full`), rechts ausgerichtet: links die Entscheidung, rechts die
                              Verwaltung. Vorher konkurrierten sie in derselben schmalen Säule mit
                              den drei Entscheidungsknöpfen um Platz. */}
                              <div className="flex w-full basis-full flex-wrap items-center justify-end gap-2">
                                {/* Pedi 05.07.: Admin-Override „als wahr kennzeichnen" — schließt die
                              Validierung in einem Schritt ab. Zwei-Klick-Bestätigung; nur Admin. */}
                                {role === "admin" ? (
                                  confirmTrueId === k.id ? (
                                    <div className="flex flex-wrap items-center justify-end gap-1.5 rounded-btn border border-trust-pos-fill/40 bg-trust-pos-bg px-2.5 py-1.5">
                                      <span className="text-[11.5px] font-semibold text-trust-pos-text">
                                        {t("val.markTrueConfirm")}
                                      </span>
                                      <button
                                        type="button"
                                        className="text-[11.5px] font-semibold text-muted hover:text-text"
                                        onClick={() => setConfirmTrueId(null)}
                                      >
                                        {t("val.markTrueCancel")}
                                      </button>
                                      <button
                                        type="button"
                                        // WP-SHIP9-B3FIX2 (bens F1): auch die BEREITS GEÖFFNETE Admin-
                                        // Bestätigung sperren, sobald die KI-Prüfung (wieder) läuft —
                                        // sonst überlebt der Ja-Knopf den Lock (failed/done → Retry →
                                        // pending, confirmTrueId bleibt) und könnte weiter mutieren.
                                        disabled={gate.locked || adminValidate.isPending}
                                        className="text-[11.5px] font-semibold text-trust-pos-text disabled:opacity-50"
                                        onClick={() => adminValidate.mutate(k.id)}
                                      >
                                        {t("val.markTrueYes")}
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 sm:justify-end">
                                      <button
                                        type="button"
                                        // WP-SHIP9-B3FIX: kein „als wahr" vor Abschluss der KI-Prüfung.
                                        disabled={gate.locked}
                                        onClick={() => setConfirmTrueId(k.id)}
                                        className="inline-flex items-center gap-1 rounded-btn px-2 py-1 text-[11.5px] font-semibold text-trust-pos-text hover:bg-trust-pos-bg disabled:opacity-50 disabled:hover:bg-transparent"
                                      >
                                        <Check size={13} />
                                        {t("val.markTrue")}
                                      </button>
                                      {vhelp("markTrue")}
                                    </span>
                                  )
                                ) : null}
                                <div className="flex items-center gap-1">
                                  <select
                                    value=""
                                    // WP-SHIP9-B3FIX: kein Zuweisen, solange die KI-Prüfung noch läuft.
                                    disabled={gate.locked || assign.isPending}
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        assign.mutate({ id: k.id, userId: e.target.value });
                                      }
                                    }}
                                    className="h-8 w-40 rounded-input border border-hairline bg-surface px-2 text-[12px] text-muted disabled:opacity-50"
                                    aria-label={t("val.assign")}
                                  >
                                    <option value="">{t("val.assign")}</option>
                                    {(users.data ?? []).map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {u.name || u.id}
                                      </option>
                                    ))}
                                  </select>
                                  {vhelp("assign")}
                                </div>
                                {/* SCRUM-417: Bearbeiten/Löschen vom Board — optisch nachrangig unter
                              den Entscheidungs-Knöpfen; Bestätigung auf eigener Zeile (SCRUM-419). */}
                                {role === "admin" ||
                                role === "controller" ||
                                k.author === user?.id ? (
                                  confirmDeleteId === k.id ? (
                                    // AUFTRAG-mega45 Block E (Pedis Befund 28.07.): DIESELBE Form wie in
                                    // der Bibliothek — eigene volle Zeile mit Trennlinie statt eines
                                    // gerahmten Kastens mit Breitendeckel. Begründung an der
                                    // Bedienbarkeit: der Deckel begrenzte den Schaden, die eigene Zeile
                                    // beseitigt seine Ursache — auf einer vollen Zeile konkurriert die
                                    // Rückfrage gar nicht mehr mit dem Karteninhalt um Platz. Die eine
                                    // Zutat der alten Fassung, die den Bruch vom 04.07. wirklich behob,
                                    // bleibt erhalten: der Fragetext ist umbruchfähig (min-w-0 flex-1).
                                    // Kein Funktionsverlust — dieselben Schlüssel, dieselbe Mutation.
                                    <span className="flex w-full basis-full flex-wrap items-center justify-end gap-1.5 border-t border-hairline pt-2">
                                      <span className="min-w-0 flex-1 text-[12px] font-semibold text-text">
                                        {t("ko.deleteQ")}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        onClick={() => setConfirmDeleteId(null)}
                                      >
                                        {t("ko.deleteKeep")}
                                      </Button>
                                      {/* SCRUM-412 / mega14 Block F galt bisher NUR in der Bibliothek —
                                    hier stand die neutrale Vorgabe „outline" am zerstörenden
                                    Knopf. Jetzt Warnfarbe, gehalten vom Sammler in
                                    tests/app/mega45-loeschbestaetigung-sammler.test.ts. */}
                                      <Button
                                        variant="danger"
                                        disabled={removeKo.isPending}
                                        onClick={() => removeKo.mutate(k.id)}
                                      >
                                        {t("ko.deleteYes")}
                                      </Button>
                                    </span>
                                  ) : (
                                    <div className="flex items-center gap-2 sm:justify-end">
                                      <Link
                                        to={`/wissen/${k.id}?edit=1`}
                                        className="inline-flex items-center gap-1 rounded-btn px-2 py-1 text-[12px] font-semibold text-muted hover:text-text"
                                      >
                                        <Pencil size={13} />
                                        {t("val.editKo")}
                                      </Link>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteId(k.id)}
                                        className="inline-flex items-center gap-1 rounded-btn px-2 py-1 text-[12px] font-semibold text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                                      >
                                        <Trash2 size={13} />
                                        {t("ko.deleteButton")}
                                      </button>
                                    </div>
                                  )
                                ) : null}
                              </div>
                            </div>
                          </Card>
                          {feedback?.id === k.id ? (
                            <Card className="border-hairline/80">
                              <div className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-text">
                                {feedback.verdict === "warn"
                                  ? t("val.feedback.condTitle")
                                  : t("val.feedback.rejTitle")}
                                {vhelp("feedbackForm")}
                              </div>
                              {/* SCRUM-365 / AG-12: Feedback als Hilfe zur Nacharbeit rahmen, nicht technisch. */}
                              <p className="mb-2 text-[11.5px] leading-relaxed text-muted">
                                {t("val.feedback.helpHint")}
                              </p>
                              <textarea
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                placeholder={t("val.feedback.placeholder")}
                                rows={3}
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
                                    // WP-SHIP9-B3FIX2 (bens F1): auch das BEREITS GEÖFFNETE Feedback-
                                    // Formular sperren, sobald die KI-Prüfung (wieder) läuft — sonst
                                    // überlebt der Absenden-Knopf den Lock (failed → Retry → pending,
                                    // feedback bleibt) und könnte weiter reviewWithFeedback auslösen.
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
                            </Card>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            }}
          </QueryState>
        </div>
      </div>
    </div>
  );
}

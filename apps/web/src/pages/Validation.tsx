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
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useDirectory, useReasonerStatus, useValidationBoard } from "../api/hooks";
import type { KnowledgeObject, Verdict } from "../api/types";
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
import { NARROW_QUERY, useMediaQuery } from "../shell/useMediaQuery";

// SCRUM-365: Textfarbe der Entscheidungswirkungen im „?"-Menü (Grün/Gelb/Rot).
const IMPACT_TEXT_TONE: Record<"pos" | "warn" | "crit", string> = {
  pos: "text-trust-pos-text",
  warn: "text-trust-warn-text",
  crit: "text-trust-crit-text",
};

// Wie lange die Quittung im Fußband steht (Auftrag §5.3: „eine Zeile ‚Freigegeben' 3 s im Fuß").
const QUITTUNG_MS = 3000;

export function Validation(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [params, setSearchParams] = useSearchParams();
  const query = useValidationBoard();
  const users = useDirectory();
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

  const rate = useMutation({
    mutationFn: ({ id, verdict }: { id: string; title: string; verdict: Verdict }) =>
      endpoints.ko.act(id, { action: "rate", verdict }),
    onSuccess: (_data, vars) => nachEntscheidung(vars),
  });

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
    <div className="mx-auto max-w-[1040px]">
      {kopf}
      {isDemoContext(params) ? <DemoBanner surface="validation" /> : null}
      {schmal ? facetSchiene : null}
      <div data-testid="pruefen-flaeche" className="flex flex-col items-start gap-6 lg:flex-row">
        {/* ---- Die Warteschlange (Pruefen.dc.html Z.43–50) ---------------------------------- */}
        <div className="w-full shrink-0 lg:w-[260px]">
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
            <ul data-testid="pruefen-warteschlange" className="flex flex-col gap-1">
              {visible.map((k) => {
                const ist = aktiv?.id === k.id;
                return (
                  <li key={k.id} data-testid="validation-row">
                    <button
                      type="button"
                      data-testid="pruefen-warteschlange-eintrag"
                      aria-current={ist ? "true" : undefined}
                      onClick={() => setAktivId(k.id)}
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
        <div className="min-w-0 flex-1">{aktiv ? karte(aktiv) : null}</div>
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
                  confirmTrueId === k.id ? (
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
                          disabled={gate.locked || adminValidate.isPending}
                          className="text-[12px] font-semibold text-trust-pos-text disabled:opacity-50"
                          onClick={() => adminValidate.mutate(k.id)}
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
                    ? rate.isPending || reviewWithFeedback.isPending
                    : reviewWithFeedback.isPending)
                }
                onClick={() =>
                  d.verdict === "up"
                    ? rate.mutate({ id: k.id, title: k.title, verdict: "up" })
                    : openFeedback(k.id, d.verdict)
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
}

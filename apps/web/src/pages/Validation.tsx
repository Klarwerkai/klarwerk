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
  ListChecks,
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
import {
  useConflicts,
  useDirectory,
  useDuplicates,
  useLibrarySearch,
  useReasonerStatus,
  useValidationBoard,
} from "../api/hooks";
import type { Confidentiality, ConflictType, KnowledgeObject, OverlapEntry } from "../api/types";
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
import { bewertungsumfang } from "../lib/bewertungsumfang";
import { type PruefZeile, boardZeilen, stufenFacetLabelKey } from "../lib/boardAuskunft";
import type { ConflictImpact } from "../lib/conflictImpact";
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
import { quellHinweise, quellennachweis, sourceBadgeKey } from "../lib/koSource";
import {
  type Objektbezug,
  gleicherBezug,
  leseObjektbezug,
  leserHref,
  mitObjektbezug,
} from "../lib/objektbezug";
import { pruefKonfliktLage } from "../lib/pruefKonflikt";
import {
  type StapelErgebnis,
  bestaetigenVorpruefung,
  bleibtAusgewaehlt,
  zuweisenVorpruefung,
} from "../lib/pruefStapel";
import {
  REVIEW_DECISIONS,
  type ReviewVerdict,
  type Stimmenlage,
  reviewNextSteps,
  reviewOutcome,
  stimmenlageAus,
  zustimmungsquittung,
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
  DUBLETTE_BESTAETIGUNG_FEHLT,
  type ValidationAiGate,
  boardHasPendingAiCheck,
  brauchtDublettenBestaetigung,
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
  BegruendungFehler,
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

// R-0238: die Arten eines Widerspruchs — dieselbe Liste wie „Konflikt melden" in der Bibliothek.
const KONFLIKTARTEN: readonly ConflictType[] = [
  "truth",
  "experience",
  "context",
  "temporal",
  "role",
];

// Rückfrage/Ablehnung: ein unterbrochener Vorgang ist EINE Karte mit EINER Entscheidung.
function vorgangSchluessel(id: string, verdict: FeedbackVerdict): string {
  return `${id}|${verdict}`;
}

/** R-0238 · Nacharbeit 7: die Bewertung steht am Server, nur der Konfliktvorschlag fehlt. */
const KONFLIKTVORSCHLAG_OFFEN = "KONFLIKTVORSCHLAG_OFFEN";
/** R-0238 · Nacharbeit 8: Bewertung und Vorschlag stehen, nur die Wahrheitskonflikt-Folge fehlt. */
const KONFLIKTFOLGE_OFFEN = "KONFLIKTFOLGE_OFFEN";
/** R-0238 · Nacharbeit 8: die Fortsetzung passt nicht mehr zur abgelehnten Fassung. */
const FASSUNG_UEBERARBEITET = "FASSUNG_UEBERARBEITET";

/** R-0246 · Nacharbeit 7: der Stand, an dem der Stapel jedes Objekt vor seinem Aufruf prüft. */
interface StapelStand {
  visible: PruefZeile[];
  duplikate: OverlapEntry[] | undefined;
  aiModelActive: boolean;
}

/** Ein unterbrochener Rückfrage-/Ablehnungsvorgang: was davon schon am Server liegt. */
interface GespeicherterVorgang {
  /** Die bestätigte Begründung. */
  text: string;
  /** Der gewählte Widerspruch — er kehrt beim Wiederöffnen zurück. */
  widerspruch?: { koB: string; type: ConflictType; titel: string } | undefined;
  /**
   * `null` = die Bewertung fehlt noch. Sonst steht sie (für `fassung`), und offen ist entweder der
   * Konfliktvorschlag selbst oder nur seine Folge. Die Fortsetzung schickt dann
   * `fortsetzungFuerFassung` und bewertet NICHT erneut (Nacharbeit 8).
   */
  fortsetzung: { fassung: number; offen: "vorschlag" | "folge" } | null;
}

/**
 * Nacharbeit 8: was eine Fehlerantwort über den Stand des Vorgangs sagt. Nur die zwei Teilerfolge
 * mit Fassungsangabe setzen eine Fortsetzung; jeder andere Fehlschlag (Netz, Server) lässt die
 * schon bekannte stehen — ein Fehler ist ein Ereignis, kein Gedächtnis.
 */
function fortsetzungAus(
  ursache: ApiError | null,
  vorher: GespeicherterVorgang["fortsetzung"],
): GespeicherterVorgang["fortsetzung"] {
  const fassung = ursache?.details.bewerteteFassung;
  if (typeof fassung !== "number") {
    return vorher;
  }
  if (ursache?.code === KONFLIKTFOLGE_OFFEN) {
    return { fassung, offen: "folge" };
  }
  if (ursache?.code === KONFLIKTVORSCHLAG_OFFEN) {
    return { fassung, offen: "vorschlag" };
  }
  return vorher;
}

function ohneKarte<T>(
  vorgaenge: Readonly<Record<string, T>>,
  id: string,
): Readonly<Record<string, T>> {
  const weg = new Set([vorgangSchluessel(id, "warn"), vorgangSchluessel(id, "down")]);
  return Object.fromEntries(
    Object.entries(vorgaenge).filter(([schluessel]) => !weg.has(schluessel)),
  );
}

/**
 * JOB 3112 · V3 — die zwei Wege, auf denen ein Wissensobjekt die Prüffläche FREIGEGEBEN verlässt.
 * `rate` ist der Knopf „Freigeben" im Fußband (Recht `ko.validate`), `admin` das „Als wahr
 * kennzeichnen" im „···"-Menü (Recht `users.manage`). Beide bekommen dieselbe Stufenfrage davor;
 * die Rückfrage („Wirklich?") und die Ablehnung sind ausdrücklich KEINE Freigabe und stehen
 * deshalb nicht in dieser Aufzählung.
 */
type Freigabeweg = "rate" | "admin";

/** R-0247: die offene Frage „offene Dublette gesehen?" — für welchen Eintrag, auf welchem Weg. */
interface DublettenFrage {
  id: string;
  weg: Freigabeweg;
}

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
  // §8.2 / Pedis Entscheidung vom 03.10.2026: die Konfliktlage je Karte. Derselbe Eintrag
  // `["conflicts"]`, den der Reiterkopf für seinen Zähler zieht — kein zweiter Netzabruf, aber ein
  // EIGENER Lade- und Fehlerzustand an der Karte (`pruefKonfliktLage`).
  const konflikte = useConflicts();
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
  //
  // ARBEITSWEGE AM SELBEN ARTIKEL: nennt die Adresse einen Beitrag (`ko=<id>`, z. B. direkt nach
  // dem Einreichen), ist ER die Wahl — nicht der erste Eintrag einer anders sortierten Liste.
  //
  // DIE ADRESSE IST DIE QUELLE, AUCH BEI MONTIERTER SEITE (Nacharbeit 3, bens Befund): eine
  // Navigation, die `ko` von A auf B ändert (Link, Zurück, Vorwärts), bestimmt die Auswahl NOCH IM
  // SELBEN Zeichenlauf — React-Muster „Zustand aus geänderter Eingabe ableiten". Erst danach läuft
  // der Effekt, der die Adresse aus der Auswahl schreibt; er findet dort also schon B vor und
  // schreibt nicht mehr A zurück. Ein Wegfall von `ko` ändert die Auswahl nicht.
  //
  // `angefordertOffen`: die Kennung, die die Adresse verlangt hat und die die Liste noch NICHT
  // gezeigt hat. Solange sie fehlt, steht rechts KEINE fremde Karte (s. `aktiv` weiter unten).
  const adressKo = leseObjektbezug(params)?.koId ?? null;
  const [aktivId, setAktivId] = useState<string | null>(adressKo);
  const [angefordertOffen, setAngefordertOffen] = useState<string | null>(adressKo);
  const [gesehenerAdressKo, setGesehenerAdressKo] = useState<string | null>(adressKo);
  if (adressKo !== gesehenerAdressKo) {
    setGesehenerAdressKo(adressKo);
    if (adressKo !== null) {
      setAktivId(adressKo);
      setAngefordertOffen(adressKo);
    }
  }
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
    /** STATUS-FREIGABE: die Stimmenlage aus der Serverantwort einer Zustimmung, sonst fehlt sie. */
    stimmen?: Stimmenlage | null;
  } | null>(null);
  const [quittungOffen, setQuittungOffen] = useState(false);
  const [entschiedenAm, setEntschiedenAm] = useState<number | null>(null);
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

  const nachEntscheidung = (vars: {
    id: string;
    title: string;
    verdict: ReviewVerdict;
    stimmen?: Stimmenlage | null;
  }): void => {
    invalidate();
    // Arbeitswege am selben Artikel: ab wann eine Board-Antwort NACH dieser Entscheidung kam — nur
    // sie trägt das tatsächliche Ergebnis (Zeile „Entschieden", `entschiedenStand`).
    setEntschiedenAm(Date.now());
    setLastDecision(vars);
    setQuittungOffen(true);
    // Auftrag §5.3: „Erfolg = nächster Eintrag wird aktiv". Der entschiedene Eintrag verlässt das
    // Board mit der nächsten Antwort; bis dahin führt die Wahl schon weiter.
    setAktivId(naechsteId(vars.id));
  };

  // STATUS-FREIGABE: der Satz zu einer Entscheidung — für die Quittung UND die Zeile „zuletzt".
  // Eine Zustimmung nennt ihre Stimme und was noch fehlt (`zustimmungsquittung`); Rückfrage und
  // Ablehnung behalten ihren bisherigen Satz.
  const entscheidungsSatz = (d: {
    verdict: ReviewVerdict;
    stimmen?: Stimmenlage | null;
  }): { art: string; text: string } => {
    if (d.verdict !== "up") {
      return { art: d.verdict, text: t(reviewOutcome(d.verdict).statusKey) };
    }
    const q = zustimmungsquittung(d.stimmen ?? null);
    return { art: q.art, text: t(q.schluessel, q.werte) };
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

  // R-0247 (Pedis Entscheidung 73b53301, weiche Sperre): die offene Bestätigungsfrage „offene
  // Dublette gesehen?" — für welchen Eintrag und auf welchem Freigabeweg — und der Eintrag, für den
  // die Bestätigung ausdrücklich gegeben wurde. Nur dann trägt die Freigabe `duplicateAcknowledged`.
  const [dublettenFrage, setDublettenFrage] = useState<DublettenFrage | null>(null);
  const [dubletteBestaetigt, setDubletteBestaetigt] = useState<string | null>(null);

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
      dubletteBestaetigt,
    }: {
      id: string;
      title: string;
      weg: Freigabeweg;
      stufe: Confidentiality | null;
      dubletteBestaetigt: boolean;
    }) => {
      // R-0247: das Kennzeichen steht NUR in der Nutzlast, wenn ausdrücklich bestätigt wurde —
      // ohne offene Dublette bleibt der Aufruf zeichengleich wie bisher.
      const bestaetigung = dubletteBestaetigt ? { duplicateAcknowledged: true as const } : {};
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
          // STATUS-FREIGABE: die Antwort trägt die Stimmenlage NACH dieser Stimme — sie wird gelesen,
          // nicht verworfen (Quittung: Stimme, Erforderliches, noch Fehlendes).
          const antwort: unknown = await endpoints.ko.act(id, {
            action: "rate",
            verdict: "up",
            ...bestaetigung,
          });
          return antwort;
        }
        await endpoints.ko.act(id, { action: "admin-validate", ...bestaetigung });
        return undefined;
      } catch (e) {
        // Schritt 2 gescheitert: `stufe` ist genau dann gespeichert, wenn Schritt 1 überhaupt lief.
        throw new FreigabeFehler("freigabe", stufe, e);
      }
    },
    onSuccess: (antwort, vars) => {
      setStufenfrage(null);
      setDublettenFrage(null);
      setDubletteBestaetigt(null);
      if (vars.weg === "rate") {
        // Die erforderliche Zahl stammt aus derselben Prüfzeile wie die Stimmenpunkte.
        const zeile = Array.isArray(query.data)
          ? query.data.find((z) => z.id === vars.id)
          : undefined;
        const stimmen = stimmenlageAus(antwort, zeile?.neededValidations);
        nachEntscheidung({ id: vars.id, title: vars.title, verdict: "up", stimmen });
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
      // R-0247: der Server kennt eine offene Dublette, die diese Karte (noch) nicht zeigte, und
      // lehnt ohne Bestätigung ab. Dann stellt die Karte die Bestätigungsfrage — nichts wurde
      // validiert. Eine bereits gespeicherte Stufe ist oben nachgeladen; die Stufenfrage schliesst.
      const ursache = freigabeFehlerUrsache(e);
      if (ursache instanceof ApiError && ursache.code === DUBLETTE_BESTAETIGUNG_FEHLT) {
        setStufenfrage(null);
        setDubletteBestaetigt(null);
        setDublettenFrage({ id: vars.id, weg: vars.weg });
        return;
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
  const freigabeStarten = (
    k: PruefZeile,
    weg: Freigabeweg,
    bestaetigt = dubletteBestaetigt === k.id,
  ): void => {
    // Die Prüfsperre gilt am Eingang wie im Ablauf (siehe `freigabeSenden`).
    if (validationAiGate(k.aiCheck, aiModelActive).locked) {
      return;
    }
    // R-0247: VOR der Stufenfrage steht die Dublettenfrage. Ohne ausdrückliche Bestätigung wird
    // nichts geschickt; die Bestätigung führt über `dublettenBestaetigen` hierher zurück.
    if (!bestaetigt && brauchtDublettenBestaetigung(k.id, duplikate.data)) {
      freigabe.reset();
      setStufenfrage(null);
      setDublettenFrage({ id: k.id, weg });
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
    freigabe.mutate({
      id: k.id,
      title: k.title,
      weg,
      stufe: null,
      dubletteBestaetigt: bestaetigt,
    });
  };

  /** R-0247: die ausdrückliche Bestätigung „Dublette gesehen" — und erst danach die Freigabe. */
  const dublettenBestaetigen = (k: PruefZeile, gate: ValidationAiGate): void => {
    if (!dublettenFrage || dublettenFrage.id !== k.id || gate.locked) {
      return;
    }
    const { weg } = dublettenFrage;
    setDublettenFrage(null);
    setDubletteBestaetigt(k.id);
    freigabeStarten(k, weg, true);
  };

  /** Abbrechen schickt nichts und lässt die Dublette, wie sie ist. */
  const dublettenFrageAbbrechen = (): void => {
    setDublettenFrage(null);
    setDubletteBestaetigt(null);
    setConfirmTrueId(null);
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
      dubletteBestaetigt: dubletteBestaetigt === stufenfrage.id,
    });
  };

  /** Die Antwort eines Menschen auf die Frage. `STUFENFRAGE_VERTRAG.setztNiemalsSelbst`: was hier
   *  nicht gewählt wurde, wird auch nicht geschrieben. */
  const stufenfrageBeantworten = (antwort: StufenAntwort, gate: ValidationAiGate): void =>
    freigabeSenden(stufeAusAntwort(antwort), gate);

  const stufenfrageAbbrechen = (): void => {
    setStufenfrage(null);
    setDubletteBestaetigt(null);
    setConfirmTrueId(null);
    freigabe.reset();
  };

  // Aufnahme 20260922 · Prüfboard-Bedienung: die Begründung, die der Server schon BESTÄTIGT hat,
  // während die Bewertung danach scheiterte. Dieselbe Regel wie `stufenfrage.gespeichert`: ein
  // Fehler ist ein Ereignis, kein Gedächtnis — was angekommen ist, bleibt eine Tatsache des
  // Vorgangs, auch über Abbrechen und erneutes Öffnen hinweg, bis die Bewertung durch ist.
  //
  // RUNDE 2 · BENS BEFUND B1: EIN VORGANG JE KARTE UND ENTSCHEIDUNG, nicht einer für die Seite.
  // Runde 1 hielt genau einen Platz; der Teilerfolg auf Karte B überschrieb den noch offenen von
  // Karte A, und A schrieb ihre Begründung danach ein zweites Mal. Der Schlüssel ist
  // `vorgangSchluessel(id, verdict)`.
  //
  // NACHARBEIT 7 · DER VORGANG TRÄGT AUCH SEINEN WIDERSPRUCH. Gespeichert wurde bisher nur der Text;
  // beim Wiederöffnen fehlten Gegenüber und Art, und „Bewertung erneut senden" schickte eine
  // gewöhnliche Ablehnung ohne den gewählten Konfliktvorschlag. `fortsetzung` hält den zweiten
  // Teilerfolg fest (Nacharbeit 8): die Ablehnung steht für eine bestimmte Fassung, offen ist der
  // Vorschlag (`KONFLIKTVORSCHLAG_OFFEN`) oder nur seine Folge (`KONFLIKTFOLGE_OFFEN`).
  const [begruendungenGespeichert, setBegruendungenGespeichert] = useState<
    Readonly<Record<string, GespeicherterVorgang>>
  >({});
  const gespeicherteBegruendung = (
    id: string,
    verdict: FeedbackVerdict,
  ): GespeicherterVorgang | undefined => begruendungenGespeichert[vorgangSchluessel(id, verdict)];

  // R-0238 · DIE WIDERSPRECHENDE ABLEHNUNG (UI/UX-Brief Screen 5: „widersprechende Ablehnung →
  // Konfliktvorschlag"). Optional und nur an der Ablehnung: das Gegenüber wird über die vorhandene
  // Bibliothekssuche gefunden (sie läuft erst ab zwei Zeichen), die Art wählt der Mensch. Gewählt
  // ist ein Gegenüber erst mit einer Art — sonst bleibt „Absenden" gesperrt.
  const [widerspruchSuche, setWiderspruchSuche] = useState("");
  const [widerspruchZiel, setWiderspruchZiel] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [widerspruchArt, setWiderspruchArt] = useState<ConflictType | "">("");
  const widerspruchUnvollstaendig = widerspruchZiel !== null && widerspruchArt === "";
  const widerspruchBegriff = widerspruchSuche.trim();
  const widerspruchTreffer = useLibrarySearch(
    { q: widerspruchBegriff },
    feedback?.verdict === "down" && widerspruchZiel === null && widerspruchBegriff.length >= 2,
  );
  const widerspruchZuruecksetzen = (): void => {
    setWiderspruchSuche("");
    setWiderspruchZiel(null);
    setWiderspruchArt("");
  };

  const reviewWithFeedback = useMutation({
    mutationFn: async ({
      id,
      verdict,
      text,
      nurBewertung,
      widerspruch,
      fortsetzungFuerFassung,
    }: {
      id: string;
      title: string;
      verdict: FeedbackVerdict;
      text: string;
      nurBewertung: boolean;
      widerspruch?: { koB: string; type: ConflictType; description: string };
      /** Nur für das Wiederöffnen: der Titel des Gegenübers, wie die Fläche ihn zeigte. */
      widerspruchTitel?: string;
      /** Nacharbeit 8: nur die fehlenden Konfliktschritte, gebunden an diese Fassung. */
      fortsetzungFuerFassung?: number;
    }) => {
      if (!nurBewertung) {
        try {
          await endpoints.ko.act(id, {
            action: "comment",
            text: buildValidationFeedback(verdict, text),
          });
        } catch (e) {
          throw new BegruendungFehler(false, e);
        }
      }
      try {
        await endpoints.ko.act(id, {
          action: "rate",
          verdict,
          ...(widerspruch ? { widerspruch } : {}),
          ...(fortsetzungFuerFassung !== undefined ? { fortsetzungFuerFassung } : {}),
        });
      } catch (e) {
        throw new BegruendungFehler(true, e);
      }
    },
    onSuccess: (_data, vars) => {
      setFeedback(null);
      setFeedbackText("");
      widerspruchZuruecksetzen();
      // Der Konfliktvorschlag ist entstanden: Reiterzähler und Konfliktmarkierung lesen ihn neu.
      if (vars.widerspruch) {
        void qc.invalidateQueries({ queryKey: ["conflicts"] });
      }
      // Entschieden ist die KARTE: auch ein offener Vorgang mit der anderen Entscheidung auf
      // derselben Karte ist damit überholt. Andere Karten bleiben unberührt.
      setBegruendungenGespeichert((alt) => ohneKarte(alt, vars.id));
      nachEntscheidung(vars);
    },
    onError: (e, vars) => {
      if (!(e instanceof BegruendungFehler && e.begruendungGespeichert)) {
        return;
      }
      const ursache = e.ursache instanceof ApiError ? e.ursache : null;
      const schluessel = vorgangSchluessel(vars.id, vars.verdict);
      // Nacharbeit 8: die abgelehnte Fassung ist überarbeitet (oder die Ablehnung gilt nicht
      // mehr). Es wurde nichts bewertet und nichts angelegt — der Vorgang ist beendet, und eine
      // neue Entscheidung beginnt von vorn (mit neuer Begründung zur neuen Fassung).
      if (ursache?.code === FASSUNG_UEBERARBEITET) {
        setBegruendungenGespeichert((alt) => ohneKarte(alt, vars.id));
        return;
      }
      setBegruendungenGespeichert((alt) => ({
        ...alt,
        [schluessel]: {
          text: vars.text,
          widerspruch: vars.widerspruch
            ? {
                koB: vars.widerspruch.koB,
                type: vars.widerspruch.type,
                titel: vars.widerspruchTitel ?? vars.widerspruch.koB,
              }
            : undefined,
          fortsetzung: fortsetzungAus(ursache, alt[schluessel]?.fortsetzung ?? null),
        },
      }));
    },
  });

  const openFeedback = (id: string, verdict: FeedbackVerdict): void => {
    setFeedback({ id, verdict });
    // Liegt die Begründung zu genau diesem Vorgang schon am Server, steht sie wieder da — sie wird
    // nicht ein zweites Mal geschrieben. Mit ihr kehrt ein gewählter Widerspruch zurück.
    const vorgang = gespeicherteBegruendung(id, verdict);
    setFeedbackText(vorgang?.text ?? "");
    widerspruchZuruecksetzen();
    if (vorgang?.widerspruch) {
      setWiderspruchZiel({ id: vorgang.widerspruch.koB, title: vorgang.widerspruch.titel });
      setWiderspruchArt(vorgang.widerspruch.type);
    }
    reviewWithFeedback.reset();
  };

  const assign = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      endpoints.ko.act(id, { action: "assign", userIds: [userId] }),
    onSuccess: (_data, vars) => {
      invalidate();
      push("success", t("pruefboard.zuweisenErfolg", { name: nameOf(vars.userId) }));
    },
    // Bisher ohne jede Meldung: das Auswahlfeld sprang zurück, und niemand erfuhr, dass die
    // Zuweisung nicht angekommen war.
    onError: (e) =>
      push(
        "error",
        t("pruefboard.zuweisenFehler", {
          grund: e instanceof ApiError ? e.message : t("state.error"),
        }),
      ),
  });

  const aiCheckRetry = useMutation({
    mutationFn: (id: string) => endpoints.ko.aiCheckRetry(id),
    onSuccess: () => {
      invalidate();
      push("success", t("val.aiCheck.retryStarted"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  // R-0246 · STAPEL-BEARBEITUNG: die Auswahl mehrerer Einträge, ab Controller (UI/UX-Brief
  // Screen 5). Die Regel je Objekt steht in `lib/pruefStapel.ts`; das Ergebnis je Objekt bleibt
  // stehen, bis der nächste Stapel läuft.
  const darfStapel = role === "admin" || role === "controller";
  const [stapelAuswahl, setStapelAuswahl] = useState<ReadonlySet<string>>(() => new Set());
  const [stapelLaeuft, setStapelLaeuft] = useState(false);
  const [stapelErgebnisse, setStapelErgebnisse] = useState<StapelErgebnis[] | null>(null);
  // Nacharbeit 6: die Kästchen stehen nur im AUSWAHLMODUS da (eingeschaltet im Menü „Stapel“
  // oder solange etwas ausgewählt ist). Dauernd sichtbar kosteten sie jedem Titel rund 20 px
  // Breite; ein Titel brach dann eine Zeile tiefer um, und die Auswahl rutschte bei 1280×420 aus
  // der Liste (`job2935-validierung-fussband.test.ts` L19). Ohne Modus ist die Liste wie vorher.
  const [stapelModus, setStapelModus] = useState(false);

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

  // ARBEITSWEGE AM SELBEN ARTIKEL — DIE ADRESSE NENNT DEN GEZEIGTEN BEITRAG, IMMER.
  //
  // `angefordertFehlt`: die Adresse hat einen Beitrag verlangt, den die Liste (noch) nicht zeigt
  // (nicht nachgeladen, weggefiltert, schon entschieden). Dann steht rechts KEINE Karte — keine
  // fremde an seiner Stelle (Nacharbeit 3, bens Befund) —, eine Zeile sagt es, und die Adresse
  // behält den verlangten Beitrag: Klara und „Fragen" nennen damit genau das, was die Seite meint.
  // Kommt er mit dem nächsten Abruf, wird er von selbst gezeigt. Ein Klick auf einen anderen
  // Eintrag beendet die Lage, weil `aktivId` dann nicht mehr die verlangte Kennung ist.
  //
  // Sonst gilt die alte Regel: ohne Wahl (oder wenn ein schon gezeigter Eintrag aus der Liste
  // fällt) führt der erste sichtbare. Und die Adresse trägt DEN GEZEIGTEN Beitrag samt Fassung
  // auch dann, wenn ihn niemand ausdrücklich gewählt hat — Klara liest ihn von dort.
  const gewaehlt = visible.find((k) => k.id === aktivId) ?? null;
  const angefordertFehlt =
    angefordertOffen !== null && aktivId === angefordertOffen && gewaehlt === null;
  if (angefordertOffen !== null && gewaehlt !== null && gewaehlt.id === angefordertOffen) {
    // Gefunden: ab jetzt eine gewöhnliche Wahl (fällt sie später heraus, führt der erste).
    setAngefordertOffen(null);
  }
  const aktiv = gewaehlt ?? (angefordertFehlt ? null : (visible[0] ?? null));

  const adressBezug = leseObjektbezug(params);
  const sollBezug: Objektbezug | null = aktiv
    ? { koId: aktiv.id, fassung: typeof aktiv.version === "number" ? aktiv.version : null }
    : null;
  useEffect(() => {
    if (sollBezug === null || gleicherBezug(adressBezug, sollBezug)) {
      return;
    }
    setSearchParams((prev) => mitObjektbezug(prev, sollBezug), { replace: true });
  });

  // Das tatsächliche Ergebnis der letzten Entscheidung: was die ERSTE Board-Antwort NACH ihr über
  // diesen Beitrag sagt — nicht die eigene Stimme. Steht er noch im Board, nennt die Zeile seine
  // Freigaben laut Server; steht er nicht mehr darin, hat er die Prüfung verlassen, und der Weg
  // „Beitrag öffnen" zeigt seinen Stand. Vor dieser Antwort sagt die Zeile nichts über den Stand.
  const nachEntscheidungGeladen =
    entschiedenAm !== null &&
    typeof query.dataUpdatedAt === "number" &&
    query.dataUpdatedAt >= entschiedenAm &&
    !query.isFetching;
  const entschiedenImBoard =
    lastDecision && nachEntscheidungGeladen
      ? (items.find((k) => k.id === lastDecision.id) ?? null)
      : null;
  const entschiedenStand: "offen" | "raus" | null =
    lastDecision && nachEntscheidungGeladen ? (entschiedenImBoard ? "offen" : "raus") : null;

  // ================================================================================================
  // R-0246 — MEHRERE AUSWÄHLEN, GESAMMELT BESTÄTIGEN ODER ZUWEISEN.
  // ================================================================================================
  //
  // Ausgewählt ist nur, was die Liste gerade zeigt, in IHRER Reihenfolge (Prüfvorrang) — ein
  // weggefilterter Eintrag wird nicht still mitbearbeitet. Die Auswahl ist unabhängig von der
  // aktiven Karte: das Kästchen wählt für den Stapel, der Eintrag selbst öffnet die Karte.
  const stapel = visible.filter((k) => stapelAuswahl.has(k.id));
  const alleGewaehlt = visible.length > 0 && stapel.length === visible.length;
  const kaestchenSichtbar = darfStapel && (stapelModus || stapel.length > 0);

  /** Modus aus heisst auch: nichts mehr ausgewählt — sonst bliebe eine unsichtbare Auswahl. */
  function modusUmschalten(): void {
    if (kaestchenSichtbar) {
      setStapelModus(false);
      setStapelAuswahl(new Set());
      return;
    }
    setStapelModus(true);
  }

  function stapelUmschalten(id: string): void {
    setStapelAuswahl((alt) => {
      const neu = new Set(alt);
      if (neu.has(id)) {
        neu.delete(id);
      } else {
        neu.add(id);
      }
      return neu;
    });
  }

  function alleUmschalten(): void {
    setStapelAuswahl(alleGewaehlt ? new Set() : new Set(visible.map((k) => k.id)));
  }

  // Nacharbeit 7: der jeweils letzte gezeichnete Stand — Liste, Dublettenlage, Modell. Der Stapel
  // liest ihn VOR JEDEM einzelnen Aufruf; ein Stand, der beim Start festgehalten wurde, sähe eine
  // inzwischen laufende KI-Prüfung nicht. Nachgeführt nach jedem Zeichenlauf (wie `aktivRef`).
  const stapelStandRef = useRef<StapelStand>({ visible, duplikate: duplikate.data, aiModelActive });
  useEffect(() => {
    stapelStandRef.current = { visible, duplikate: duplikate.data, aiModelActive };
  });

  function stapelFehler(k: PruefZeile, e: unknown): StapelErgebnis {
    const meldung = e instanceof ApiError ? e.message : t("state.error");
    return { id: k.id, title: k.title, art: "fehler", meldung };
  }

  /**
   * Läuft den Stapel NACHEINANDER ab, nicht parallel: jedes Objekt bekommt seine eigene
   * Serverantwort, und das Ergebnis je Objekt ist genau diese Antwort. Erledigtes verlässt die
   * Auswahl; was nicht geschickt wurde oder scheiterte, bleibt ausgewählt.
   */
  async function stapelAusfuehren(
    schritt: (k: PruefZeile, stand: StapelStand) => Promise<StapelErgebnis>,
  ): Promise<void> {
    // Festgehalten wird nur, WELCHE Einträge gewählt waren — nicht ihr Stand (Nacharbeit 7).
    const ziele = stapel.map((k) => ({ id: k.id, title: k.title }));
    setStapelLaeuft(true);
    setStapelErgebnisse(null);
    const ergebnisse: StapelErgebnis[] = [];
    for (const ziel of ziele) {
      // VOR JEDEM Aufruf der jetzige Stand: was während des vorigen Aufrufs gesperrt wurde oder
      // aus der Liste fiel, wird nicht mehr geschickt.
      const stand = stapelStandRef.current;
      const k = stand.visible.find((z) => z.id === ziel.id);
      if (!k) {
        ergebnisse.push({ id: ziel.id, title: ziel.title, art: "entfallen" });
        continue;
      }
      ergebnisse.push(await schritt(k, stand));
    }
    setStapelErgebnisse(ergebnisse);
    setStapelAuswahl((alt) => {
      const neu = new Set(alt);
      for (const e of ergebnisse) {
        if (!bleibtAusgewaehlt(e.art)) {
          neu.delete(e.id);
        }
      }
      return neu;
    });
    setStapelLaeuft(false);
    invalidate();
  }

  // Gesammelt bestätigen = je Objekt DERSELBE Freigabeweg wie am Knopf „Freigeben", mit denselben
  // Sperren davor. Eine offene Dublette oder eine fehlende Stufe wird NICHT im Stapel entschieden:
  // das Objekt wird nicht geschickt und bleibt für die Einzelentscheidung an seiner Karte stehen.
  const stapelBestaetigen = (): Promise<void> =>
    stapelAusfuehren(async (k, stand) => {
      const vorab = bestaetigenVorpruefung({
        gesperrt: validationAiGate(k.aiCheck, stand.aiModelActive).locked,
        dubletteOffen: brauchtDublettenBestaetigung(k.id, stand.duplikate),
        stufeFehlt: brauchtStufenfrage(k.auskunft.stufe.lage),
      });
      if (vorab) {
        return { id: k.id, title: k.title, art: vorab };
      }
      try {
        await endpoints.ko.act(k.id, { action: "rate", verdict: "up" });
        return { id: k.id, title: k.title, art: "bestaetigt" };
      } catch (e) {
        // Der Server kennt eine Dublette, die die Fläche (noch) nicht zeigte: nichts validiert.
        if (e instanceof ApiError && e.code === DUBLETTE_BESTAETIGUNG_FEHLT) {
          return { id: k.id, title: k.title, art: "dubletteOffen" };
        }
        return stapelFehler(k, e);
      }
    });

  // Gesammelt zuweisen = je Objekt derselbe `assign` wie das Auswahlfeld der Karte.
  const stapelZuweisen = (userId: string): Promise<void> =>
    stapelAusfuehren(async (k, stand) => {
      const vorab = zuweisenVorpruefung(
        { gesperrt: validationAiGate(k.aiCheck, stand.aiModelActive).locked },
        k.assignments ?? [],
        userId,
      );
      if (vorab) {
        return { id: k.id, title: k.title, art: vorab };
      }
      try {
        await endpoints.ko.act(k.id, { action: "assign", userIds: [userId] });
        return { id: k.id, title: k.title, art: "zugewiesen" };
      } catch (e) {
        return stapelFehler(k, e);
      }
    });

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

  // ------------------------------------------------------------------------------------------
  // EIN ANDERER ARTIKEL FÄNGT OBEN AN (JOB 3812, Runde 2).
  // ------------------------------------------------------------------------------------------
  // Seit die rechte Spalte ihren eigenen Rollbereich hat, HAT sie eine Rollstellung — und die
  // überlebt den Wechsel der Auswahl, weil dasselbe DOM-Element stehen bleibt: die Karte ist eine
  // Zeichenfunktion und keine Komponente (`karte(aktiv)` weiter unten), das `<div>` darum wird
  // nicht neu gehängt. Wer bei 1280×420 ans Ende eines Artikels gerollt ist und dann den nächsten
  // wählt, landete damit mitten im neuen — Pedis Satz zu dieser Seite lautet aber „rechts den
  // passenden Artikel sehen", nicht dessen Mitte. Gemessen wird das in L19 des Browserblocks
  // (`tests/design/job2935-validierung-fussband.test.ts`), samt Gegenprobe ohne diese Zeilen.
  //
  // AM `id` UND NICHT AM OBJEKT: eine eintreffende Auffrischung liefert ein neues Objekt für
  // denselben Artikel. Hinge der Effekt daran, spränge die Rollstellung bei jeder Auffrischung auf
  // null — genau das, was das Zustandsmodell des Auftrags (§9) ausschliesst. Es entsteht kein
  // Zuhörer und keine Taste: die Rollstellung gehört dem Artikel, der gezeigt wird.
  const gezeigteId = aktiv?.id ?? null;
  useEffect(() => {
    const el = pruefbereichRef.current;
    // `gezeigteId !== null` ist keine Formalie für den Abhängigkeitsprüfer: steht rechts gar kein
    // Artikel (leere Warteschlange, Ladelage, Erstfehler), ist die Spalte kinderlos — dort gibt es
    // keine Rollstellung, die zurückzusetzen wäre. Gemessen in `rollbereich-lagen.test.tsx` F9.
    if (el && gezeigteId !== null) {
      el.scrollTop = 0;
    }
  }, [gezeigteId]);

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
  const laeuftKey = aiModelActive ? "val.aiCheck.pendingAi" : "val.aiCheck.pending";
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
          placeholder={t("pruefboard.volltextFiltern")}
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
            // Arbeitswege am selben Artikel: „Zurücksetzen" nimmt die FILTER zurück, nicht den
            // Suchtext — er steht sichtbar im Feld darüber und wird dort geleert, wenn gewollt.
            // Dieselbe Regel wie in der Bibliothek (`BibliothekFlaeche.tsx`, `onResetFilters`).
            setFilter((f) => ({ ...EMPTY_VALIDATION_FILTER, search: f.search }));
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

  // R-0246: die Stapel-Leiste wohnt als MENÜ neben dem Filter-Menü — nicht über der Liste. Ein
  // Kasten über der Liste kostet die Liste genau seine Höhe und schiebt sie unter den Anfang der
  // Karte; das schliessen die Geometrieverträge aus (`job2935-validierung-fussband.test.ts`, Block
  // L: Liste und Karte beginnen auf gleicher Höhe, die Liste behält ihren Platz). Das Menüblatt
  // liegt über der Fläche und nimmt der Spalte nichts. Der Zähler am geschlossenen Menü nennt die
  // Anzahl der ausgewählten Einträge.
  //
  // Nacharbeit 7: das Menü bleibt auch bei LEERER Warteschlange stehen, solange ein Lauf läuft oder
  // ein Ergebnis vorliegt — sonst nahm die letzte erfolgreiche Bestätigung die Rückmeldung je
  // Objekt mit: das Board lud neu, die Liste war leer, das Menü samt Ergebnis verschwand.
  const stapelSichtbar = visible.length > 0 || stapelLaeuft || stapelErgebnisse !== null;
  const stapelMenue =
    darfStapel && stapelSichtbar ? (
      <PruefenMenue
        kennung="stapel"
        beschriftung={t("pruefboard.stapel.menue")}
        symbol={<ListChecks size={16} aria-hidden="true" />}
        zaehler={stapel.length}
        breite="w-80"
      >
        {stapelLeiste()}
      </PruefenMenue>
    ) : null;

  const kopf = (
    <PruefenKopf
      aktiv="offen"
      filter={
        <>
          {filterMenue}
          {stapelMenue}
        </>
      }
      hilfe={hilfeMenue}
    />
  );

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
      {/* ARBEITSWEGE AM SELBEN ARTIKEL: die angeforderte Prüfung steht hier gerade nicht — offen
          gesagt, statt still einen fremden Beitrag zu zeigen. Solange die Liste nachlädt, heißt
          das „wird gesucht"; danach nennt die Zeile den Weg zum Beitrag selbst. */}
      {angefordertFehlt && angefordertOffen !== null && lage.lage !== "erstfehler" ? (
        // `<output>` statt `<p role="status">`: dasselbe Statusverhalten über das semantische
        // Element (Biome a11y/useSemanticElements). `block`, weil `<output>` inline ist.
        <output
          data-testid="pruefen-objekt-fehlt"
          data-ko={angefordertOffen}
          className="mb-2 block text-[12.5px] text-trust-warn-text"
        >
          {query.isFetching || lage.lage === "laedt"
            ? t("arbeitsweg.pruefen.sucht")
            : t("arbeitsweg.pruefen.fehlt")}{" "}
          <Link
            className="font-semibold underline"
            to={leserHref({
              koId: angefordertOffen,
              fassung: adressBezug?.koId === angefordertOffen ? adressBezug.fassung : null,
            })}
          >
            {t("arbeitsweg.pruefen.lesen")}
          </Link>
        </output>
      ) : null}
      {/* Nach Freigabe, Rückfrage oder Ablehnung: WELCHER Beitrag entschieden wurde, sein Stand
          laut Server und wohin die Auswahl gewechselt ist — stehend, nicht nur 3 s im Fuß. */}
      {lastDecision ? (
        <p
          data-testid="pruefen-entschieden"
          data-ko={lastDecision.id}
          data-verdict={lastDecision.verdict}
          data-stand={entschiedenStand ?? undefined}
          className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-muted"
        >
          <span>
            {t("arbeitsweg.pruefen.entschieden", { titel: lastDecision.title })}{" "}
            {t(reviewOutcome(lastDecision.verdict).statusKey)}
          </span>
          {entschiedenStand === "offen" && entschiedenImBoard ? (
            <span data-testid="pruefen-entschieden-stand" className="font-semibold text-text">
              {t("arbeitsweg.pruefen.standOffen", {
                gruen: entschiedenImBoard.reviewVotes?.up ?? 0,
                noetig: entschiedenImBoard.neededValidations,
              })}
            </span>
          ) : entschiedenStand === "raus" ? (
            <span data-testid="pruefen-entschieden-stand" className="font-semibold text-text">
              {t("arbeitsweg.pruefen.standRaus")}
            </span>
          ) : null}
          <Link
            data-testid="pruefen-entschieden-oeffnen"
            className="font-semibold text-text underline"
            to={leserHref({ koId: lastDecision.id, fassung: null })}
          >
            {t("arbeitsweg.pruefen.oeffnen")}
          </Link>
          {aktiv && aktiv.id !== lastDecision.id ? (
            <span data-testid="pruefen-entschieden-weiter" data-ko={aktiv.id}>
              · {t("arbeitsweg.pruefen.weiter", { titel: aktiv.title })}
            </span>
          ) : null}
        </p>
      ) : null}
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
                // R-0213: eine laufende Prüfung ist schon in der LISTE erkennbar, nicht erst an der
                // Karte. Dasselbe Prädikat wie die Sperre der Karte (`validationAiGate`).
                const laeuft = validationAiGate(k.aiCheck, aiModelActive).locked;
                return (
                  <li key={k.id} data-testid="validation-row" className="flex items-center gap-1.5">
                    {/* R-0246: das Kästchen wählt für den Stapel; es öffnet keine Karte. */}
                    {kaestchenSichtbar ? (
                      <input
                        type="checkbox"
                        data-testid="pruefen-stapel-waehlen"
                        aria-label={t("pruefboard.stapel.waehlen", { titel: k.title })}
                        checked={stapelAuswahl.has(k.id)}
                        disabled={stapelLaeuft}
                        onChange={() => stapelUmschalten(k.id)}
                        className="shrink-0"
                      />
                    ) : null}
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
                        "block w-full min-w-0 flex-1 rounded-[9px] border px-[12px] py-[10px] text-left text-[13.5px] leading-[1.35]",
                        ist
                          ? "border-hairline bg-surface font-semibold text-text"
                          : "border-transparent text-muted hover:bg-hairline-soft",
                        laeuft ? "opacity-60" : "",
                      )}
                    >
                      <span data-text="titel">{k.title}</span>
                      {laeuft ? (
                        <Lock
                          size={12}
                          role="img"
                          data-testid="pruefen-warteschlange-laeuft"
                          aria-label={t(laeuftKey)}
                          className="ml-1.5 inline-block align-middle text-muted"
                        />
                      ) : null}
                      {/* §8.2: betroffene Einträge sind schon in der Liste erkennbar. Ein Punkt
                          mit Namen statt eines Wortes — der Titel bleibt der Text des Eintrags. */}
                      {pruefKonfliktLage(k.id, konflikte).art === "betroffen" ? (
                        <span
                          role="img"
                          data-testid="pruefen-warteschlange-konflikt"
                          aria-label={t("pruefboard.konfliktMarke")}
                          title={t("pruefboard.konfliktMarke")}
                          className="ml-1.5 inline-block h-[7px] w-[7px] rounded-full bg-trust-warn-fill align-middle"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {/* ---- Die eine Karte (Pruefen.dc.html Z.51–62) -------------------------------------- */}
        {/*
            JOB 3812: DIE RECHTE SPALTE ROLLT JETZT SELBST — spiegelbildlich zur linken.

            WAS SIE VORHER TAT: nichts. Sie trug `min-w-0 flex-1`, sonst keine Regel; ihre Höhe war
            die Höhe der Karte, und die ragte aus der Fläche heraus (`items-start` am Elternteil
            streckt sie nicht). Wer den unteren Teil des Artikels lesen wollte, musste die HÜLLE
            rollen — und in der liegt die Liste mit.

            GEMESSEN (Runde 1 dieses Jobs, `job2935-validierung-fussband.test.ts` L15, Cloud-Lauf
            499bd2d50ed2dd054d59919d; die Karte ist in jeder Lage 138,5–392,75, also 254,25 px hoch):
              1280×900 · sichtbare Hülle 56–683  · kein Überlauf   → nichts zu rollen, nichts fehlt
              1280×600 · sichtbare Hülle 56–383  · MAIN rollt 10 px  → Liste und Auswahl wandern 10 px
              1280×420 · sichtbare Hülle 56–227  · MAIN rollt 166 px → Liste und Auswahl wandern 166 px
            Bei 1280×420 stand die Liste danach bei −27,5 px: sie war aus dem Bild, genau die
            Übersicht, die JOB 3593/3625 gerade hergestellt hatten. Der untere Teil des Artikels war
            also erreichbar — aber nur gegen den Preis, den Pedi nicht zahlen wollte.

            DIE ERWEITERUNG IST FREIGEGEBEN. Bis zum 12.09. galt seine Grenze „nur die linke Liste"
            (`PRIORITAETEN.md`, PRUEFEN-LISTENNAVIGATION); JOB 3625 hat den Rest deshalb ungeschnitten
            zurückgegeben. Am 12.09. 21:4x sagte Pedi wörtlich: „ja, rechts darf mit."

            WARUM DIESE DREI REGELN UND KEINE VIERTE: `lg:h-full` holt die Höhe der Fläche in die
            Spalte (dieselbe Zeile wie links, `items-start` streckt sie nicht von selbst),
            `lg:min-h-0` erlaubt ihr, unter die Höhe der Karte zu schrumpfen, und erst dann bewegt
            `lg:overflow-y-auto` etwas. Kein Prozentdeckel: `vh` rechnet den Kopf über der Fläche
            nicht mit — das ist die Lehre aus JOB 3625.

            `tabIndex` GILT JETZT IN BEIDEN BAUFORMEN. Schmal bleibt es `-1` (der Klick führt den
            Blick dorthin, ohne einen Tabstopp zu erzeugen); breit ist die Spalte ein Rollbereich,
            und ein Rollbereich, den man nur mit der Maus bewegen kann, ist keiner. Dass ein Mensch
            damit wirklich bis ans Ende kommt, misst L17 — mit der Taste, nicht mit dem Rad.

            DER SCHMALE WEG BLEIBT UNBERÜHRT (`lg:` greift ab 1024 px): dort steht die Karte UNTER
            der Liste, und `:1187` führt den Blick bewusst zu ihr. Eine gedeckelte Karte wäre dort
            eine Verschlechterung — genau so steht es schon für die Liste weiter oben.
        */}
        <div
          ref={pruefbereichRef}
          data-testid="pruefen-artikelspalte"
          tabIndex={schmal ? -1 : 0}
          className="min-w-0 flex-1 lg:h-full lg:min-h-0 lg:overflow-y-auto"
        >
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
  // ================================================================================================
  // R-0246 — DIE STAPEL-LEISTE. Eine Zeichenfunktion wie `karte` (dieselbe Begründung).
  // ================================================================================================
  //
  // „Alle auswählen" steht immer da; die Aktionen erst, wenn etwas ausgewählt ist. Das Ergebnis
  // nennt JEDES bearbeitete Objekt mit seinem Ausgang — auch die, die nicht geschickt wurden.
  function stapelLeiste(): JSX.Element {
    return (
      <div
        data-testid="pruefen-stapel"
        className="flex flex-col gap-1.5 px-2.5 py-2 text-[12px] text-muted"
      >
        <button
          type="button"
          data-text="knopf"
          data-testid="pruefen-stapel-modus"
          aria-pressed={kaestchenSichtbar}
          disabled={stapelLaeuft}
          onClick={modusUmschalten}
          className="self-start text-[12px] font-semibold text-text underline-offset-4 hover:underline disabled:opacity-50"
        >
          {kaestchenSichtbar ? t("pruefboard.stapel.modusAus") : t("pruefboard.stapel.modusAn")}
        </button>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            data-testid="pruefen-stapel-alle"
            checked={alleGewaehlt}
            disabled={stapelLaeuft}
            onChange={alleUmschalten}
          />
          <span data-text="text">{t("pruefboard.stapel.alle")}</span>
        </label>
        {stapel.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span data-testid="pruefen-stapel-anzahl" data-text="text">
              {t("pruefboard.stapel.anzahl", { n: stapel.length })}
            </span>
            <button
              type="button"
              data-text="knopf"
              data-testid="pruefen-stapel-bestaetigen"
              disabled={stapelLaeuft}
              onClick={() => void stapelBestaetigen()}
              className="rounded-[9px] bg-trust-pos-fill px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("pruefboard.stapel.bestaetigen")}
            </button>
            <select
              value=""
              data-testid="pruefen-stapel-zuweisen"
              disabled={stapelLaeuft}
              onChange={(e) => {
                if (e.target.value) {
                  void stapelZuweisen(e.target.value);
                }
              }}
              className={selectCls}
              aria-label={t("pruefboard.stapel.zuweisen")}
            >
              <option value="">{t("pruefboard.stapel.zuweisen")}</option>
              {(users.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.id}
                </option>
              ))}
            </select>
            <button
              type="button"
              data-text="knopf"
              data-testid="pruefen-stapel-aufheben"
              disabled={stapelLaeuft}
              onClick={() => setStapelAuswahl(new Set())}
              className="text-[12px] font-semibold text-muted hover:text-text disabled:opacity-50"
            >
              {t("pruefboard.stapel.aufheben")}
            </button>
          </div>
        ) : null}
        {stapelLaeuft ? (
          <p data-testid="pruefen-stapel-laeuft" data-text="text" aria-busy="true">
            {t("pruefboard.stapel.laeuft")}
          </p>
        ) : null}
        {stapelErgebnisse ? (
          <div data-testid="pruefen-stapel-ergebnis" aria-live="polite">
            <p data-text="text" className="font-semibold text-text">
              {t("pruefboard.stapel.ergebnis")}
            </p>
            <ul className="mt-0.5 space-y-0.5">
              {stapelErgebnisse.map((e) => (
                <li key={e.id} data-testid="pruefen-stapel-ergebnis-zeile" data-art={e.art}>
                  <span className="text-text">{e.title}</span> —{" "}
                  {t(`pruefboard.stapel.art.${e.art}`, { meldung: e.meldung ?? "" })}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  // R-0238 — die optionale Angabe „widerspricht Beitrag …" im Ablehnungsfeld. Gesucht wird über die
  // Bibliothekssuche (dieselben Sichtbarkeitsregeln); das Objekt selbst steht nie in den Treffern.
  function widerspruchBlock(k: PruefZeile): JSX.Element {
    const treffer = (widerspruchTreffer.data ?? []).filter((x) => x.id !== k.id).slice(0, 5);
    return (
      <div data-testid="pruefen-widerspruch" className="mt-2 space-y-1.5 text-[12.5px] text-muted">
        <p data-text="text" className="font-semibold text-text">
          {t("pruefboard.widerspruch.titel")}
        </p>
        {widerspruchZiel ? (
          <div className="flex flex-wrap items-center gap-2">
            <span data-testid="pruefen-widerspruch-ziel" className="text-text">
              {widerspruchZiel.title}
            </span>
            <button
              type="button"
              data-text="knopf"
              data-testid="pruefen-widerspruch-entfernen"
              onClick={() => {
                setWiderspruchZiel(null);
                setWiderspruchArt("");
              }}
              className="text-[12px] font-semibold text-muted hover:text-text"
            >
              {t("pruefboard.widerspruch.entfernen")}
            </button>
            <select
              value={widerspruchArt}
              data-testid="pruefen-widerspruch-art"
              onChange={(e) => setWiderspruchArt(e.target.value as ConflictType | "")}
              className={selectCls}
              aria-label={t("pruefboard.widerspruch.art")}
            >
              <option value="">{t("pruefboard.widerspruch.art")}</option>
              {KONFLIKTARTEN.map((ct) => (
                <option key={ct} value={ct}>
                  {t(`con.type.${ct}`)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <input
              value={widerspruchSuche}
              data-testid="pruefen-widerspruch-suche"
              onChange={(e) => setWiderspruchSuche(e.target.value)}
              placeholder={t("pruefboard.widerspruch.suche")}
              aria-label={t("pruefboard.widerspruch.suche")}
              className="h-9 w-full rounded-input border border-hairline bg-surface px-3 text-[12.5px] outline-none focus:border-ink/30"
            />
            {widerspruchTreffer.isError ? (
              <p data-text="text">{t("pruefboard.widerspruch.suchFehler")}</p>
            ) : null}
            {treffer.length > 0 ? (
              <ul className="space-y-0.5">
                {treffer.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      data-text="knopf"
                      data-testid="pruefen-widerspruch-treffer"
                      onClick={() => {
                        setWiderspruchZiel({ id: x.id, title: x.title });
                        setWiderspruchSuche("");
                      }}
                      className="text-left text-[12.5px] text-text underline-offset-4 hover:underline"
                    >
                      {x.title}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>
    );
  }

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
    // JOB 4077: DIESELBE Anhangsliste trägt zwei Auskünfte — die Bild-Zählung im Chip und (neu) den
    // Dateinamen, den der Nachweis einer verankerten Quelle auflöst. Sie wird deshalb EINMAL
    // benannt statt zweimal aus `k` geholt.
    const anhaenge = k.attachments ?? [];
    const bilder = anhaenge.filter((a) => a.mime.startsWith("image/"));
    const darfLoeschen = role === "admin" || role === "controller" || k.author === user?.id;
    // JOB 3112 · V3: der Paarhinweis und die Frage, ob dieser Betrachter den Vergleich betreten
    // darf. Dieselbe Rollenlesart wie `darfLoeschen` — die Vergleichsfläche selbst trägt
    // `minRole: "controller"` (`navigation.ts:204`).
    const doppel = doppelhinweis(k.id, duplikate.data);
    const darfVergleichen = role === "admin" || role === "controller";
    // Die Konfliktseite trägt dieselbe Schwelle (`navigation.ts:274`, minRole controller).
    const konfliktLage = pruefKonfliktLage(k.id, konflikte);
    const konfliktNichtFrisch = "nichtFrisch" in konfliktLage && konfliktLage.nichtFrisch;
    const konfliktTitel = (w: ConflictImpact): string => {
      const titel = t(w.hasTruth ? "conflict.impact.truthTitle" : "conflict.impact.title");
      const n = w.unresolvedCount;
      return n > 1 ? `${titel} · ${t("pruefboard.konfliktAnzahl", { n })}` : titel;
    };
    const punkte = Array.from({ length: Math.max(sig.needed, 1) }, (_, i) => i);
    const quittung = quittungOffen && lastDecision ? entscheidungsSatz(lastDecision) : null;
    // Die OFFENEN Zuweisungen (die Board-Route reicht nur offene durch, ValidationService
    // `withOpenAssignments`) — „zugewiesen" allein sagte nicht, an wen.
    const zugewiesen = k.assignments ?? [];
    // Rückfrage/Ablehnung: liegt die Begründung dieses Vorgangs schon am Server?
    const vorgang =
      feedback?.id === k.id ? gespeicherteBegruendung(k.id, feedback.verdict) : undefined;
    const begruendungLiegt = vorgang !== undefined;
    // Nacharbeit 7/8: auch die Ablehnung steht schon — offen ist der Vorschlag oder nur seine Folge.
    const fortsetzung = vorgang?.fortsetzung ?? null;
    // Nacharbeit 8: die Fortsetzung wurde abgewiesen, weil die Fassung überarbeitet wurde.
    const fehlerJetzt = reviewWithFeedback.error;
    const ursacheJetzt = fehlerJetzt instanceof BegruendungFehler ? fehlerJetzt.ursache : null;
    const ueberarbeitet =
      feedback?.id === k.id &&
      ursacheJetzt instanceof ApiError &&
      ursacheJetzt.code === FASSUNG_UEBERARBEITET;

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
                  ) : dublettenFrage?.id === k.id && dublettenFrage.weg === "admin" ? (
                    // R-0247: dieselbe Begründung wie bei der Stufenfrage — im Menüblatt, nicht
                    // unter dessen Schließfläche im Fußband.
                    <div className="px-2.5 py-2">{dublettenFrageBlock(k, gate)}</div>
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
                    {/* Wer schon offen zugewiesen ist, steht da — aber nicht noch einmal wählbar:
                        ein zweites Zuweisen derselben Person änderte nichts und sähe aus wie eins. */}
                    {(users.data ?? []).map((u) => {
                      const schon = zugewiesen.includes(u.id);
                      return (
                        <option key={u.id} value={u.id} disabled={schon}>
                          {schon
                            ? t("pruefboard.bereitsZugewiesen", { name: u.name || u.id })
                            : u.name || u.id}
                        </option>
                      );
                    })}
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
          {/* JOB 4013: DER CHIP TRÄGT JETZT DEN ZEITPUNKT. Bis hierher stand hier ausschliesslich
              `q.label` — ein Namensschildchen, an dem niemand ablesen konnte, WANN diese Quelle ans
              Objekt kam. Der Zeitpunkt steht am Draht (`KoSource.at`) und wurde weggeworfen.
              Formatiert von `quellennachweis` über dieselbe Zeitregel, mit der die Karte wenige
              Zeilen höher das Objektdatum formatiert (`formatKoTimestamp`, `:1303`) — ein
              unlesbares `at` ergibt `null`, und dann steht KEINE Zeitangabe da statt „Invalid Date".
              Adresse und Belegstelle liegen im „Mehr" darunter (dieselbe Ableitung): in der
              Chip-Reihe würden sie bei mehreren Quellen die Zeile sprengen. */}
          {quellen.length > 0 || bilder.length > 0 ? (
            <div className="flex flex-wrap gap-[8px]">
              {quellen.map((q) => {
                const zeit = quellennachweis(q, anhaenge, i18n.language).zeit;
                return (
                  <span
                    key={q.id}
                    data-text="chip"
                    data-testid="pruefen-chip"
                    className="inline-flex items-center gap-[6px] rounded-[8px] border border-hairline bg-page px-[10px] py-[5px]"
                  >
                    <FileText size={13} aria-hidden="true" className="text-muted" />
                    <span className="text-[12px] font-semibold text-text">{q.label}</span>
                    {zeit ? (
                      <span data-testid="pruefen-quelle-zeit" className="text-[12px] text-muted">
                        {zeit}
                      </span>
                    ) : null}
                  </span>
                );
              })}
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
            {zugewiesen.length > 0 ? (
              <PruefenMehrZeile beschriftung={t("pruefboard.zugewiesenAn")}>
                <span data-testid="pruefen-zugewiesen-an">
                  {zugewiesen.map((id) => nameOf(id)).join(", ")}
                </span>
              </PruefenMehrZeile>
            ) : null}
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
            {/* ---- JOB 4013: DER NACHWEIS JE QUELLE — Adresse und Belegstelle --------------- */}
            {/* Er steht neben dem Erfassungsweg, weil er dieselbe Frage beantwortet: woher stammt
                das? Der Erfassungsweg sagt es über das OBJEKT, dieser Block über jede einzelne
                Quelle daran.

                KEINE NEUEN WÖRTER (Lieferung 6): die Blocküberschrift ist der Bestandstext
                `ko.sourcesTitle`, die Stufe die bestehende Markierung aus `sourceBadgeKey` — nicht
                nachgebaut. Adresse und Auszug tragen GAR KEINE Beschriftung: ein Link ist als Link
                erkennbar, ein `<blockquote>` als Zitat, und ein nur auf Deutsch existierendes Wort
                wäre schlimmer als keines. `apps/web/src/i18n.ts` bleibt deshalb unberührt (sie ist
                Zielpfad des laufenden JOB 3667).

                DER BLOCK ERSCHEINT NUR BEI BELEGTER QUELLE. Kein Satz „keine Quellen" bei leerer
                Liste (§9): die Board-Antwort sichert keine Vollständigkeit zu, eine Entwarnung wäre
                eine Aussage über einen Bestand, den sie nicht abbildet.

                DER LINK BRICHT DEN KLICKWEG DER KARTE NICHT: `cardClickOpens` (`:1332`) hält jedes
                `a` zurück — ein zweiter Mechanismus wäre eine zweite Wahrheit über denselben Klick. */}
            {quellen.length > 0 ? (
              <PruefenMehrBlock beschriftung={t("ko.sourcesTitle")}>
                {quellen.map((q) => {
                  const nachweis = quellennachweis(q, anhaenge, i18n.language);
                  // R-0131/R-0162: eine in der Quelle gelöschte Seite wird nicht mehr verlinkt.
                  const geloeschtAm = quellHinweise(q, i18n.language).geloeschtAm;
                  return (
                    <div
                      key={q.id}
                      data-testid="pruefen-quellennachweis"
                      className="border-b border-hairline-soft py-1.5 last:border-b-0"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold text-text">{q.label}</span>
                        <span className="text-muted-2">{t(sourceBadgeKey(q))}</span>
                      </div>
                      {/* JOB 4077: DIE DATEI, AUS DER DIESE BELEGSTELLE STAMMT. Sie steht unter dem
                          Label und damit unmittelbar über der Adresse — die drei Angaben
                          beantworten dieselbe Frage („woher?") und gehören zusammen.

                          KEINE NEUEN WÖRTER, dieselbe Regel wie oben: ein Dateiname trägt keine
                          Beschriftung, er ist als Dateiname erkennbar. `i18n.ts` bleibt unberührt.

                          OHNE ANKER KEINE ZEILE (§9): keine Datei, kein „—", kein „unbekannt". Der
                          Name kommt AUS DEM ANHANG desselben Objekts, nie aus einem Feld an der
                          Quelle — deshalb kann er auch nichts über einen Anhang behaupten, der
                          nicht mehr da ist. */}
                      {nachweis.datei ? (
                        <span
                          data-testid="pruefen-quelle-datei"
                          className="mt-0.5 block break-all text-muted"
                        >
                          {nachweis.datei}
                        </span>
                      ) : null}
                      {geloeschtAm ? (
                        <span
                          data-testid="pruefen-quelle-geloescht"
                          className="mt-0.5 block text-trust-warn-text"
                        >
                          {t("ko.source.removedInOrigin", { zeit: geloeschtAm })}
                        </span>
                      ) : null}
                      {nachweis.adresse ? (
                        nachweis.adresse.verlinkbar && !geloeschtAm ? (
                          <a
                            data-testid="pruefen-quelle-adresse"
                            href={nachweis.adresse.voll}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 block break-all text-ai underline-offset-4 hover:underline"
                          >
                            {nachweis.adresse.kurz}
                          </a>
                        ) : (
                          // Eine Fundstelle ohne Web-Adresse (das Feld heisst „URL / Referenz")
                          // bleibt SICHTBAR, aber ohne `href`: ein Link ins Nichts wäre ein
                          // Versprechen ohne Deckung, ein fremdes Schema eine ungeprüfte Fläche.
                          <span
                            data-testid="pruefen-quelle-adresse"
                            className="mt-0.5 block break-all text-muted"
                          >
                            {nachweis.adresse.kurz}
                          </span>
                        )
                      ) : null}
                      {/* JOB 4361: `[overflow-wrap:anywhere]` — UND AUSDRÜCKLICH NICHT `break-words`.
                          GEMESSEN am 20.09. in Chromium bei 320 × 568 (Fall K1/K3 in
                          `tests/pruefen-quellennachweis/lange-quellen-schmal-chromium.test.ts`):
                          eine Belegstelle mit einer langen Dokumentenkennung („DINENISO1965…", 51
                          Zeichen) hat KEINEN Umbruchpunkt. Weil die Prüfkarte in der schmalen
                          Bauform nach Inhalt breit wird (`pruefen-flaeche` trägt `items-start`,
                          `:1125`), zog dieses eine Wort die GANZE Karte auf 500 px — im 320 px
                          breiten Fenster lagen Zeitpunkt, Adresse, Belegstelle, Dateiname und der
                          Knopf „Ablehnen" allesamt hinter der beschneidenden Kante bei 304 px.
                          Nur `anywhere` geht in die min-content-Breite ein und schrumpft die Karte
                          wirklich; `break-word` bräche den Text erst INNERHALB der bereits zu
                          breiten Spalte — dieselbe Begründung steht seit Scheibe D-037 im Haus
                          (`apps/web/src/index.css:76-81`) und dieselbe Schreibweise benutzt die
                          Bibliothek (`BibliothekFlaeche.tsx:1541`). Adresse und Dateiname tragen
                          ihr `break-all` schon. */}
                      {nachweis.auszug ? (
                        <blockquote
                          data-testid="pruefen-quelle-auszug"
                          className="mt-1 border-l-2 border-hairline pl-2 italic text-muted [overflow-wrap:anywhere]"
                        >
                          {nachweis.auszug}
                        </blockquote>
                      ) : null}
                    </div>
                  );
                })}
              </PruefenMehrBlock>
            ) : null}
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
                  {entscheidungsSatz(lastDecision).text} — {lastDecision.title}
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

          {/* ---- §8.2: die Konfliktlage DIESER Karte (Pedi, 03.10.2026) -------------------- */}
          {/* Vier Lagen aus `pruefKonfliktLage`. Ohne Antwort entsteht KEINE Aussage über
              Konflikte, nur der Ladesatz oder der Fehlersatz mit „Erneut laden". „Keiner" bleibt
              still — dieselbe Entwarnungsregel wie beim Paarhinweis darüber. */}
          {konfliktLage.art === "laedt" ? (
            <p
              data-testid="pruefen-konflikt-laedt"
              data-text="text"
              aria-busy="true"
              className="text-[12px] text-muted"
            >
              {t("pruefboard.konfliktLaedt")}
            </p>
          ) : null}
          {konfliktLage.art === "fehler" ? (
            <div
              data-testid="pruefen-konflikt-fehler"
              className="flex flex-wrap items-center gap-2 text-[12px] text-muted"
            >
              <span data-text="text">{t("pruefboard.konfliktFehler")}</span>
              <button
                type="button"
                data-text="knopf"
                data-testid="pruefen-konflikt-neu-laden"
                onClick={() => void qc.invalidateQueries({ queryKey: ["conflicts"] })}
                className="rounded-[9px] border border-hairline bg-surface px-3 py-1 text-[12px] font-semibold text-text hover:bg-hairline-soft"
              >
                {t("pruefen.reload")}
              </button>
            </div>
          ) : null}
          {konfliktLage.art === "betroffen" ? (
            <div
              data-testid="pruefen-konflikthinweis"
              data-schwere={konfliktLage.wirkung.hasTruth ? "truth" : "limited"}
              className="rounded-[10px] border border-trust-warn-fill/60 bg-page px-3 py-2 text-[12.5px] text-trust-warn-text"
            >
              <p data-text="text" className="font-semibold">
                {konfliktTitel(konfliktLage.wirkung)}
              </p>
              {/* Kein Erklärsatz darunter: die Prüffläche trägt keine Vorbehaltstexte (Design
                  „Prüfen", R-1577). Wer mehr wissen will, geht zur Konfliktseite. */}
              {darfVergleichen ? (
                <Link
                  to="/konflikte"
                  data-testid="pruefen-konflikt-link"
                  data-text="knopf"
                  className="mt-1 inline-block font-semibold underline-offset-4 hover:underline"
                >
                  {t("pruefboard.konfliktZurSeite")} <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </div>
          ) : null}
          {konfliktNichtFrisch ? (
            <p
              data-testid="pruefen-konflikt-nicht-frisch"
              data-text="text"
              className="text-[11.5px] text-muted"
            >
              {t("pruefboard.konfliktNichtFrisch")}
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
          {/* PRÜFSTATUS-ANZEIGE (N-0078): „Freigeben" ist EINE positive Bewertung, nicht schon die
              Validierung. Der noch nötige Umfang steht deshalb unmittelbar daneben — als Text,
              nicht nur als Punkte mit Tooltip (`lib/bewertungsumfang.ts`). */}
          {((): JSX.Element => {
            const umfang = bewertungsumfang(sig);
            return (
              <span
                data-testid="pruefen-restumfang"
                data-umfang={umfang.art}
                data-text="text"
                className="text-[12px] text-muted"
              >
                {t(umfang.schluessel, umfang.werte)}
              </span>
            );
          })()}
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
              data-stimmenlage={quittung.art}
              className="w-full basis-full text-[12px] font-semibold text-trust-pos-text"
            >
              {t("val.decisionSaved")} — {quittung.text}
            </p>
          ) : null}
          {/* JOB 3112 · V3: die Stufenfrage des FUSSBAND-Weges — dieselbe Stelle und dieselbe
              Bauform wie das Begründungsfeld darunter. Der Administratorweg stellt dieselbe Frage
              in seinem Menüblatt (Begründung dort). */}
          {/* R-0247: die Dublettenfrage des Fußband-Weges steht vor der Stufenfrage. */}
          {dublettenFrage?.id === k.id && dublettenFrage.weg === "rate"
            ? dublettenFrageBlock(k, gate)
            : null}
          {stufenfrage?.id === k.id && stufenfrage.weg === "rate" ? stufenfrageBlock(gate) : null}
          {/* Begründungspflicht bleibt: Rückfrage/Ablehnen klappen das Feld hier auf. */}
          {feedback?.id === k.id ? (
            <div data-testid="pruefen-begruendung" className="w-full basis-full pt-2">
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={t("val.feedback.placeholder")}
                rows={3}
                // Die gespeicherte Begründung wird nicht mehr geschrieben — also auch nicht mehr
                // bearbeitet: eine geänderte Fassung käme nie am Server an.
                readOnly={begruendungLiegt}
                aria-label={
                  feedback.verdict === "warn"
                    ? t("val.feedback.condTitle")
                    : t("val.feedback.rejTitle")
                }
                className="w-full resize-y rounded-input border border-hairline bg-surface p-2.5 text-sm text-text outline-none placeholder:text-muted-2 focus:border-ink/30"
              />
              {/* R-0238: nur an der Ablehnung — optional das Gegenüber, dem widersprochen wird. */}
              {feedback.verdict === "down" ? widerspruchBlock(k) : null}
              {/* Zwei Zustände, zwei Sätze: „nichts gespeichert" ist etwas anderes als „die
                  Begründung liegt, die Bewertung nicht" (dieselbe Unterscheidung wie an der
                  Stufenfrage, `val.stufenfrage.fehlerNachStufe`). */}
              {begruendungLiegt ? (
                <div
                  data-testid="pruefen-begruendung-teilerfolg"
                  className="mt-2 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
                >
                  {fortsetzung?.offen === "folge"
                    ? t("pruefboard.konfliktfolgeOffen")
                    : fortsetzung?.offen === "vorschlag"
                      ? t("pruefboard.konfliktvorschlagOffen")
                      : t("pruefboard.begruendungGespeichert")}
                </div>
              ) : ueberarbeitet ? (
                <div
                  data-testid="pruefen-begruendung-ueberarbeitet"
                  className="mt-2 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
                >
                  {t("pruefboard.fassungUeberarbeitet")}
                </div>
              ) : reviewWithFeedback.isError ? (
                <div
                  data-testid="pruefen-begruendung-fehler"
                  className="mt-2 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
                >
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
                    widerspruchZuruecksetzen();
                  }}
                >
                  {t("val.feedback.cancel")}
                </Button>
                <Button
                  variant="primary"
                  disabled={
                    gate.locked ||
                    reviewWithFeedback.isPending ||
                    !isFeedbackSubmittable(feedbackText) ||
                    widerspruchUnvollstaendig
                  }
                  onClick={() =>
                    reviewWithFeedback.mutate({
                      id: k.id,
                      title: k.title,
                      verdict: feedback.verdict,
                      text: feedbackText,
                      nurBewertung: begruendungLiegt,
                      ...(feedback.verdict === "down" && widerspruchZiel && widerspruchArt
                        ? {
                            widerspruch: {
                              koB: widerspruchZiel.id,
                              type: widerspruchArt,
                              description: feedbackText.trim(),
                            },
                            widerspruchTitel: widerspruchZiel.title,
                          }
                        : {}),
                      // Nacharbeit 8: steht die Ablehnung schon, wird NICHT neu bewertet — nur die
                      // fehlenden Konfliktschritte, gebunden an die abgelehnte Fassung.
                      ...(fortsetzung ? { fortsetzungFuerFassung: fortsetzung.fassung } : {}),
                    })
                  }
                >
                  {fortsetzung?.offen === "folge"
                    ? t("pruefboard.konfliktfolgeSenden")
                    : fortsetzung?.offen === "vorschlag"
                      ? t("pruefboard.konfliktvorschlagSenden")
                      : begruendungLiegt
                        ? t("pruefboard.bewertungSenden")
                        : t("val.feedback.submit")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ================================================================================================
  // R-0247 — DIE DUBLETTENFRAGE (Pedis Entscheidung 73b53301, weiche Sperre).
  // ================================================================================================
  //
  // Eine Zeichenfunktion wie `stufenfrageBlock`. Sie sperrt nicht und löst die Dublette nicht auf:
  // sie verlangt nur, dass die prüfende Person ausdrücklich bestätigt, sie gesehen zu haben. Der
  // Doppelhinweis darüber (mit dem Weg zum Vergleich) bleibt, wie er ist.
  function dublettenFrageBlock(k: PruefZeile, gate: ValidationAiGate): JSX.Element {
    return (
      <div data-testid="pruefen-dublettenfrage" className="w-full basis-full pt-2">
        <p data-text="text" className="text-[12.5px] font-semibold text-trust-warn-text">
          {t("val.doppel.bestaetigung.frage")}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-text="knopf"
            data-testid="pruefen-dublettenfrage-ja"
            disabled={gate.locked || freigabe.isPending}
            onClick={() => dublettenBestaetigen(k, gate)}
            className="rounded-[9px] border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-text hover:bg-hairline-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("val.doppel.bestaetigung.ja")}
          </button>
          <button
            type="button"
            data-text="knopf"
            data-testid="pruefen-dublettenfrage-abbrechen"
            disabled={freigabe.isPending}
            onClick={dublettenFrageAbbrechen}
            className="text-[12px] font-semibold text-muted hover:text-text disabled:opacity-50"
          >
            {t("val.doppel.bestaetigung.abbrechen")}
          </button>
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

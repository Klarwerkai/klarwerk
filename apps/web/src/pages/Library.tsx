import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Download, RotateCw, Search, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useConflicts, useKos, useLibrarySearch } from "../api/hooks";
import { useSession } from "../app/AuthContext";
import { useRole } from "../app/RoleContext";
import { useToast } from "../app/ToastContext";
import { DemoBanner } from "../components/DemoBanner";
import { EmptyStateCtas } from "../components/EmptyStateCtas";
import { FacetFilter } from "../components/FacetFilter";
import { HelpTip } from "../components/HelpTip";
import { KoSummaryDisclosure } from "../components/KoSummaryDisclosure";
// AUFTRAG-mega70 BLOCK B (bens Fundstellen 2–4 + die beim Nachprüfen gefundene fünfte Stelle):
// ein Ziel, das die Rolle nicht erreicht, wird als Lage gezeigt, nicht als Weg — dasselbe Tor
// wie auf der Startseite (mega51), keine zweite Rollenlogik.
import { RoleLink } from "../components/RoleLink";
import { FacetActiveBar } from "../components/facets/FacetActiveBar";
import { ConfidenceBar, KnowledgeTypeTag, KoAuthorLine, StatusPill } from "../components/trust";
import { Button, Card, PageHeader, QueryState, cx } from "../components/ui";
import { askAnswerHref } from "../lib/askQuestion";
import {
  AUFFRISCHUNG_HINWEIS_KLASSE,
  AUFFRISCHUNG_HINWEIS_MARKE,
  CONF_TONE_CLASS,
  abfrageMitBestand,
  auffrischungGescheitert,
  auffrischungHinweisText,
  vertraulichkeitsAuskunft,
} from "../lib/confidentiality";
import { conflictImpact, conflictLimitedUsability } from "../lib/conflictImpact";
import { countByDemoKnowledge, isDemoKnowledge, ownKnowledgeEmptyHint } from "../lib/demoKnowledge";
import { demoHref, isDemoContext } from "../lib/demoPilotPath";
import { deriveStatus } from "../lib/displayStatus";
import { type FacetGroupConfig, clearFacetSelection, isAnyFacetActive } from "../lib/facetFilter";
// AUFTRAG-mega10 Block B/C: die Schienen-Logik (Suche je Dimension, aufmachbarer Deckel, abhängige
// Auswahl, additiver Bereichsfilter) — DOM-frei und einzeln getestet.
import {
  EMPTY_FACET_RANGE,
  EMPTY_RAIL_UI,
  type FacetRailUiState,
  type FacetRange,
  facetRailGroups,
  facetRangeFromParams,
  facetRangeFromSaved,
  isFacetRangeActive,
  matchesFacetRange,
  pruneDependentSelection,
  serializeFacetRange,
  writeFacetRangeToParams,
} from "../lib/facetRail";
import {
  type FacetSelection,
  type FacetValues,
  applyFacetSelection,
  facetSelectedValues,
  toggleFacetValue,
} from "../lib/facets";
import { type KnowledgeGuidanceTone, knowledgeGuidance } from "../lib/knowledgeGuidance";
import { koAuthorParts } from "../lib/koAuthor";
// JOB 528: DER VORHANDENE Helfer, derselbe wie auf der Validierungskarte. Er liefert `null`
// bei fehlendem, leerem oder unparsebarem Wert — genau diese Null IST die Zusage
// „kein Platzhalterdatum". Ein zweiter Formatierer waere eine zweite Wahrheit ueber dasselbe.
import { formatKoTimestamp } from "../lib/koDates";
import { LIBRARY_RESULT_LIMIT, windowList } from "../lib/libraryDisplay";
import { EXPORT_FORMATS, type ExportFormat, exportFilename, exportUrl } from "../lib/libraryExport";
import {
  LIBRARY_FACET_LABEL_KEYS,
  LIBRARY_GROUP_KEYS,
  type LibraryGroupKey,
  type LibrarySavedView,
  foldStatusIntoMaturity,
  groupByFacet,
  libraryFilterValues,
  migrateSavedFacetSelection,
  readLibraryViews,
  removeLibraryView,
  saveLibraryView,
} from "../lib/libraryFacets";
import { type MaturityTone, libraryMaturity, libraryUseCta } from "../lib/libraryMaturity";
// JOB 381: der Geltungsbereich der Bibliothek. Die Entscheidung „gehoert mir" faellt AUSSCHLIESSLICH
// dort — inklusive der Messung, warum weder `author` noch `originalAuthor` die Erstellerkennung ist.
import {
  ALLE_INHALTE_LABEL,
  DEFAULT_LIBRARY_SCOPE,
  LIBRARY_SCOPE_PARAM,
  type LibraryScope,
  MEINE_ABLAGE_LABEL,
  SCOPE_BAR_LABEL,
  applyLibraryScope,
  parseLibraryScope,
} from "../lib/libraryOwnScope";
import { EMPTY_LIBRARY_FILTER, buildLibraryQuery } from "../lib/libraryQuery";
import { type MatchField, searchLibrary } from "../lib/librarySearch";
import {
  DEFAULT_LIBRARY_SORT,
  LIBRARY_SORT_KEYS,
  LIBRARY_SORT_LABEL_KEYS,
  LIBRARY_SORT_STORAGE_KEY,
  koChangedMs,
  sortLibrary,
} from "../lib/librarySort";
// AUFTRAG-mega9 Block E-2 (KW-E2E-006): Facetten-Auswahl ⇄ URL, eine Quelle für beide Richtungen.
import {
  facetSelectionFromParams,
  knownFacetValues,
  pruneFacetSelectionToKnownValues,
  serializeFacetSelection,
  writeFacetSelectionToParams,
} from "../lib/libraryUrlFilters";
import { canRevalidate } from "../lib/revalidation";
import { useAuthorName } from "../lib/useAuthorName";
import { LIBRARY_SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../lib/useDebouncedValue";
import { usePersistentDisclosure } from "../lib/usePersistentDisclosure";
import { usePersistentEnum } from "../lib/usePersistentValue";
import { useReadiness } from "../lib/useReadiness";

// AUFTRAG-uxpol1 (PAKET 1): EINE Facetten-Config für die Bibliothek — jede Dimension GENAU EINMAL
// (kein Dropdown OBEN + Chip UNTEN mehr). Reihenfolge = Anzeigereihenfolge der Filterleiste. Die
// Werte je Facette leitet libraryFilterValues (unten) rein aus dem KO ab (dieselbe Ableitung wie die
// Validierungs-Badges/Reife-Plakette — keine zweite Wahrheit). Reife + Herkunft werden so ebenfalls
// vollwertige, dynamisch gezählte Facetten (vorher eigene Chip-Reihen).
// AUFTRAG-uxpol5 · Punkt 1: die rohe „Status“-Facette (offen/pruefung/validiert) ist ein reines
// Relabeling der „Reife“ (needs-work/in-review/ready) — beide aus DEMSELBEN deriveStatus(ko) ohne Flags,
// über eine Bijektion (s. foldStatusIntoMaturity). Sie hatte keine eigene Treffermenge und ist als
// Filterzeile ENTFERNT (der rohe Status bleibt anderswo — Trefferzeilen-Pille, Gruppierung — erhalten).
// Punkt 2: primäre Facetten zuerst (immer sichtbar), danach die selteneren hinter „Weitere Filter“.
// AUFTRAG-mega10 Block C: die Reihenfolge folgt jetzt einer FÜHRUNG statt einer Liste —
// Suche · Reife · Kategorie (→ Schlagwort) · Zeitraum · Vertraulichkeit · Abteilung/Autor · Rest.
// „Reife zuerst“ ist die inhaltliche Entsprechung zu „Marke zuerst“: bei KLARWERK ist die erste
// Frage nicht *was gibt es*, sondern *kann ich dem trauen*.
//
// ZUR ABBILDUNG (im Bericht ausführlich): Der Prototyp nannte „Fachgebiet“, „Thema“ und „Abteilung“
// als eigene Dimensionen — die gibt es in unseren Daten nicht. `ko.category` ist EIN flaches Feld
// und trägt bei uns die Abteilung/Kategorie; die zweite Ebene ist das Schlagwort (`ko.tags`).
// „Vertraulichkeit“ gab es als Feld (`ko.confidentiality`), aber noch nicht als Facette — sie kommt
// hier hinzu (die neun bleiben, das ist die zehnte).
const LIBRARY_FILTER_CONFIGS: readonly FacetGroupConfig[] = [
  { key: "maturity", labelKey: "lib.facet.maturity" },
  { key: "category", labelKey: LIBRARY_FACET_LABEL_KEYS.category },
  { key: "tag", labelKey: "lib.facet.tag" },
  { key: "confidentiality", labelKey: "lib.facet.confidentiality" },
  { key: "author", labelKey: LIBRARY_FACET_LABEL_KEYS.author },
  { key: "origin", labelKey: "lib.facet.origin" },
  { key: "type", labelKey: "lib.facet.type" },
  { key: "language", labelKey: LIBRARY_FACET_LABEL_KEYS.language },
  { key: "age", labelKey: LIBRARY_FACET_LABEL_KEYS.age },
  { key: "trust", labelKey: LIBRARY_FACET_LABEL_KEYS.trust },
];

// Punkt 2: „primär = immer sichtbar“ sind die geführten Dimensionen; alles Übrige wandert hinter
// „Weitere Filter“ (eingeklappt als Standard, Zustand pro Browser gemerkt).
const LIBRARY_SECONDARY_FACET_KEYS = ["origin", "type", "language", "age", "trust"] as const;

// AUFTRAG-mega10 Block B Punkt 2: die EINZIGE Abhängigkeit, die unsere Daten hergeben —
// Kategorie → Schlagwort. Sie ist NICHT modelliert, sondern wird aus dem Bestand abgeleitet
// (s. lib/facetRail). Befund zum Bestand steht im Bericht: die Kategorien tragen nahezu disjunkte
// Schlagwortmengen, die Beziehung trägt also.
const LIBRARY_FACET_DEPENDENCIES = [{ parent: "category", child: "tag" }] as const;

// Die Reife wird als Pillenreihe gezeichnet (kurz, tonhaltig) — wie im abgenommenen Vorschlag.
const LIBRARY_PILL_FACET_KEYS = ["maturity"] as const;

// AUFTRAG-mega10 Block B Punkt 4: der Bereichsfilter läuft über EIGENE URL-Parameter, nicht über
// die Facetten-Wertemenge. `von`/`bis` sind bewusst kurz und lesbar (der Link wird geteilt).
const LIBRARY_RANGE_FROM_PARAM = "von";
const LIBRARY_RANGE_TO_PARAM = "bis";
// AUFTRAG-mega9 Block E-2 (KW-E2E-006): dieselbe Liste, die die Oberfläche anzeigt, ist auch die
// Liste der URL-Parameter — aus EINER Quelle abgeleitet, damit eine neue Facette nicht versehentlich
// ohne URL-Anbindung eingeführt werden kann.
const LIBRARY_FACET_PARAM_KEYS: readonly string[] = LIBRARY_FILTER_CONFIGS.map((c) => c.key);
const LIBRARY_MORE_FILTERS_STORAGE_KEY = "klarwerk.library.filters.moreOpen";
const LIBRARY_GUIDE_STORAGE_KEY = "klarwerk.library.guideOpen";
// AUFTRAG-uxpol6 (bens GELB 3.1): stabile ID des kontrollierten Erklärbox-Inhalts für aria-controls.
const LIBRARY_GUIDE_PANEL_ID = "library-maturity-guide";

// SCRUM-262: Tönung der Reife-/Nutzbarkeits-Plakette (nutzbar/in Prüfung/zu prüfen).
const MATURITY_TONE: Record<MaturityTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
};

// AUFTRAG-mega10 Block B: die Reife erscheint in der Schiene als Pillenreihe. Im GEWÄHLTEN Zustand
// trägt sie Fläche in ihrer eigenen Tönung — dieselbe Sprache wie die Plakette am Treffer. Der
// Zustand steht zusätzlich als Text (Zähler + aria-pressed), nie nur als Farbe.
const MATURITY_PILL_TONE: Record<MaturityTone, string> = {
  pos: "border-trust-pos-text bg-trust-pos-text text-white",
  warn: "border-trust-warn-text bg-trust-warn-text text-white",
  neutral: "border-muted bg-muted text-white",
};

// Tönung eines Reife-Werts — über dieselbe Use-Readiness-Sprache wie Plakette und Filter-Label.
function libraryMaturityTone(value: string): MaturityTone {
  return useReadiness(value as Parameters<typeof useReadiness>[0]).tone;
}

// SCRUM-289: kompakte Reife-Erklärung (nutzbar vs. in Prüfung/zu prüfen).
const GUIDE_TONE: Record<KnowledgeGuidanceTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
};

export function Library(): JSX.Element {
  // JOB 528: `i18n` kam hinzu, weil die Zeit in der AKTUELLEN Sprache gebildet werden muss.
  // Ohne den Haken staende sie in einer festen Sprache da — die Validierungsflaeche macht es
  // seit WP-D10 richtig, jetzt beide gleich.
  const { t, i18n } = useTranslation();
  // Startfilter aus der URL (?q=…), gesetzt von der globalen Topbar-Suche.
  // Pedi 05.07.: zusätzlich ?category=… vorbelegen — Verweise aus Risiko & Lücken landen so
  // direkt auf den Objekten der betroffenen Domäne.
  // AUFTRAG-mega9 Block E-2 (KW-E2E-006): jetzt MIT Setter — die Facetten-Auswahl wird in die URL
  // fortgeschrieben, damit sie teilbar ist und den Reload übersteht.
  const [params, setParams] = useSearchParams();
  // Volltext-Startwert aus der URL (?q=…), gesetzt von der globalen Topbar-Suche.
  const [q, setQ] = useState(params.get("q") ?? "");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");
  // AUFTRAG-uxpol1 (PAKET 1): EINE Facetten-Auswahl für ALLE Dimensionen (Reife/Status/Herkunft/
  // Kategorie/Art/…). Vorbelegung aus der URL: ?category=… (Verweise aus Risiko & Lücken) und
  // ?origin=… (Deep-Link „eigenes Wissen“). Frühere getrennte Reife-/Herkunfts-States sind Teil davon.
  // AUFTRAG-mega9 Block E-2 (KW-E2E-006): die Vorbelegung liest jetzt ALLE Facetten-Dimensionen aus
  // der URL — derselbe bestehende Weg, nur vollständig statt nur `category`/`origin`. Die
  // Einzelwert-Deep-Links („?category=…“ aus Risiko & Lücken, „?origin=…“ aus Capture-Success)
  // bleiben unverändert gültig; ihre Semantik liegt in facetSelectionFromParams.
  //
  // AUFTRAG-mega11 Block C (bens SB-3): Der URL-Eingang ist jetzt ZWEISTUFIG. `facetSel` startet
  // LEER; der aus der URL gelesene Vorschlag wartet in `urlSeed`, bis der Bestand geladen ist, und
  // wird erst dann — nach der Wertprüfung — zur echten Auswahl.
  //
  // Warum nicht einfach nachträglich aufräumen: dann läge der Fremdwert zwischenzeitlich in
  // `facetSel`, also auch in `currentViewState()` — und „Diese Suche merken" könnte ihn in genau
  // diesem Fenster in den localStorage schreiben. Ein Wert, der nie echte Auswahl war, kann auch
  // nicht in eine gespeicherte Sicht geraten. Sichtbar ist der Unterschied nicht: solange der
  // Bestand lädt, gibt es ohnehin keine Treffer zu filtern.
  const [facetSel, setFacetSel] = useState<FacetSelection>({});
  const [urlSeed, setUrlSeed] = useState<FacetSelection | null>(() =>
    facetSelectionFromParams(params, LIBRARY_FACET_PARAM_KEYS),
  );
  // AUFTRAG-mega10 Block B Punkt 4: der Bereichsfilter „Zuletzt geändert von/bis“ — ein EIGENER,
  // additiver Zustand NEBEN der Facettenauswahl (ein Bereich ist kein Facettenwert; die
  // ausführliche Begründung steht in lib/facetRail).
  const [range, setRange] = useState<FacetRange>(() =>
    facetRangeFromParams(params, LIBRARY_RANGE_FROM_PARAM, LIBRARY_RANGE_TO_PARAM),
  );
  // Anzeige-Zustand der Schiene: Suchtext je Dimension und „Alle N zeigen“. Bewusst NICHT in der
  // URL und nicht im Speicher — das ist Bedien-, kein Suchzustand: ein geteilter Link soll dieselbe
  // TREFFERMENGE zeigen, nicht denselben halb aufgeklappten Bedienstand.
  const [railUi, setRailUi] = useState<FacetRailUiState>(EMPTY_RAIL_UI);
  // Block A: das Fenster der Trefferliste ist AUFZIEHBAR („Weitere N laden“) — vorher war bei 200
  // Schluss, ohne jeden Weg weiter. Jede Filter-/Suchänderung setzt es zurück.
  const [windowLimit, setWindowLimit] = useState(LIBRARY_RESULT_LIMIT);
  // AUFTRAG-mega9 Block E-2 (KW-E2E-006): jede Auswahländerung schreibt die URL fort — damit ist der
  // Filter teilbar und ein Reload stellt ihn unverändert wieder her (das war der Befund).
  //
  // `replace` und nicht „push“: die URL spiegelt so IMMER wahrheitsgemäß die gezeigte Auswahl. Ein
  // Push-Verlauf wäre nur dann ehrlich, wenn die URL die EINZIGE Quelle der Auswahl wäre — sonst
  // änderte der Zurück-Knopf die Adresse, ohne die Ansicht zu ändern (eine lügende URL). Diese
  // Umstellung berührt die No-Match-/Gespeicherte-Sichten-Semantik und gehört damit in das
  // Filter-Redesign, das noch zur Abnahme aussteht — hier liegt bewusst nur das Fundament.
  //
  // Der Vergleich läuft über die KANONISCHE Zeichenkette der Auswahl, nicht über Objektidentität:
  // gäbe der Updater bei gleicher Auswahl neue Parameter zurück, drehte sich Effekt → setParams →
  // Render → Effekt im Kreis. `prev` unverändert zurückzugeben bricht die Schleife bei react-router.
  //
  // AUFTRAG-mega10 Block C: der Bereichsfilter wird ERGÄNZT, nicht danebengestellt — derselbe
  // Effekt, dieselbe Schleifen-Bremse (Vergleich über die kanonische Zeichenkette), nur zwei
  // Zustände statt einem. `?origin=` behält damit unverändert seinen neutralen Rückfall.
  //
  // AUFTRAG-mega11 Block C: solange der URL-Eingang noch nicht geprüft ist, wird die URL NICHT
  // fortgeschrieben. Sonst löschte dieser Effekt beim ersten Render (facetSel ist da leer) genau die
  // Parameter aus der Adresse, die gleich noch geprüft und übernommen werden sollen — und ein Reload
  // in diesem Moment verlöre den geteilten Filter.
  useEffect(() => {
    if (urlSeed !== null) {
      return;
    }
    setParams(
      (prev) => {
        const fromUrl = facetSelectionFromParams(prev, LIBRARY_FACET_PARAM_KEYS);
        const rangeFromUrl = facetRangeFromParams(
          prev,
          LIBRARY_RANGE_FROM_PARAM,
          LIBRARY_RANGE_TO_PARAM,
        );
        const same =
          serializeFacetSelection(fromUrl, LIBRARY_FACET_PARAM_KEYS) ===
            serializeFacetSelection(facetSel, LIBRARY_FACET_PARAM_KEYS) &&
          serializeFacetRange(rangeFromUrl) === serializeFacetRange(range);
        if (same) {
          return prev;
        }
        return writeFacetRangeToParams(
          writeFacetSelectionToParams(prev, facetSel, LIBRARY_FACET_PARAM_KEYS),
          range,
          LIBRARY_RANGE_FROM_PARAM,
          LIBRARY_RANGE_TO_PARAM,
        );
      },
      { replace: true },
    );
  }, [facetSel, range, setParams, urlSeed]);

  const [groupBy, setGroupBy] = useState<LibraryGroupKey>("none");
  // AUFTRAG-sortfilter · Punkt 1: Sortier-Wahl der Trefferliste — pro Browser gemerkt (localStorage
  // über die fehlertolerante safeLocalStorage-Grenze); ein gespeicherter Fremd-/Altwert fällt sicher
  // auf den Standard „Relevanz“ (= bisherige Reihenfolge) zurück.
  const [sortKey, setSortKey] = usePersistentEnum(
    LIBRARY_SORT_STORAGE_KEY,
    LIBRARY_SORT_KEYS,
    DEFAULT_LIBRARY_SORT,
  );
  const guide = knowledgeGuidance("library");
  // AUFTRAG-uxpol5 · Punkt 3: die Reife-Erklärbox ist einklappbar — beim ERSTEN Besuch offen, danach
  // standardmäßig eingeklappt; der Zustand wird pro Browser gemerkt (localStorage).
  const [guideOpen, toggleGuide] = usePersistentDisclosure(LIBRARY_GUIDE_STORAGE_KEY, {
    defaultOpen: false,
    openOnFirstVisit: true,
  });

  // Bestand (für den Erststart-Leerzustand: kein einziges KO).
  const all = useKos();

  // AUFTRAG-mega11 Block C (bens SB-3): die EINE Stelle, an der ein URL-Wert zu einem echten
  // Facettenwert wird — und nur, wenn er im Bestand vorkommt.
  //
  // Geprüft wird gegen `all` (den VOLLEN Bestand), nicht gegen die Treffermenge von `query`: die
  // hängt am Volltext `?q=`, und `?q=Ventil&category=Anlagen` würde sonst eine völlig gültige
  // Kategorie verwerfen, nur weil sie unter den Ventil-Treffern nicht vorkommt.
  //
  // Genau EINMAL: `setUrlSeed(null)` schließt den Eingang. Spätere Bestandsänderungen (ein Refetch,
  // ein gelöschtes KO) räumen eine vom NUTZER getroffene Auswahl NICHT weg — die bliebe sonst
  // stillschweigend hinter seinem Rücken verschwinden und aus 0 Treffern würde die volle Liste.
  useEffect(() => {
    const seed = urlSeed;
    if (seed === null || all.data === undefined) {
      return;
    }
    const now = Date.now();
    const known = knownFacetValues(
      all.data.map((k) => libraryFilterValues(k, now)),
      LIBRARY_FACET_PARAM_KEYS,
    );
    setFacetSel(pruneFacetSelectionToKnownValues(seed, known));
    setUrlSeed(null);
  }, [urlSeed, all.data]);
  // FR-LIF-04: Autor in jeder KO-Zeile sichtbar (Namen via Directory, Fallback ID).
  // AUFTRAG-mega62 Block H: die Auflösung kommt aus dem EINEN Haken (lib/useAuthorName.ts). Die
  // abgeschriebene Zeile hier sagte „Unbekannte Person", sobald das Verzeichnis nur NICHT DA war —
  // eine Aussage über die Person, wo gar keine feststand.
  const nameOf = useAuthorName();
  // SCRUM-357 / AG-14: Konfliktliste für die ehrliche „conflict-limited“-Reife je Treffer.
  const conflicts = useConflicts();

  // Ergebnisse über den Server-Search-/Filterpfad (Volltext + KoFilter).
  // WP-BILD-1f (bens P4): die live getippte Volltext-Query läuft DEBOUNCED zum Server (ein Request
  // nach der Tipp-Pause statt einer pro Tastendruck); veraltete Antworten überschreiben nie das
  // Ergebnis, weil react-query pro Parameter-Key liest (latest-wins, s. useDebouncedValue).
  const debouncedQ = useDebouncedValue(q, LIBRARY_SEARCH_DEBOUNCE_MS);
  // AUFTRAG-uxpol1: Dimensionen (Art/Status/Kategorie/Tag/…) filtern jetzt EINHEITLICH client-seitig
  // über Facetten — der Server bekommt nur den Volltext. Ergebnis identisch (er lieferte die q-Treffer
  // ohnehin voll), aber die Facetten sehen den unbeschnittenen Kontext → korrekte dynamische Zähler.
  const query = useLibrarySearch(buildLibraryQuery({ ...EMPTY_LIBRARY_FILTER, q: debouncedQ }));
  // SCRUM-245: aktuelle Volltext-Query für client-seitiges Re-Ranking + Match-Hinweise.
  const trimmedQ = q.trim();

  // D-BIB Effizienz-Vertrag (10.000+ flüssig): die TEURE Facetten-Wert-Ableitung (Regex/Datums-
  // Parsen je KO) läuft genau EINMAL je Datenlauf (memoisiert auf query.data) — je Render bleiben
  // nur billige Map-Lookups und Integer-Zähler. Enthält jetzt ALLE Facetten (inkl. Reife/Herkunft/Art).
  const facetBase = useMemo(() => {
    const now = Date.now();
    return new Map((query.data ?? []).map((k) => [k.id, libraryFilterValues(k, now)]));
  }, [query.data]);

  // Match-Grund → kompaktes, ehrliches Label (kein „semantisch“, keine Fake-Treffer).
  const matchLabel = (field: MatchField): string => t(`lib.match.${field}`);

  const qc = useQueryClient();
  const { push } = useToast();
  // SCRUM-136: Re-Validierung über den vorhandenen KO-/Lifecycle-Pfad (revalidate).
  // Pedi 02.07. (mehrfach gewünscht): Löschen DIREKT in der Bibliothek — für Autor oder
  // Controller/Admin, mit Inline-Bestätigung (kein confirm()). Backend-Regel existiert
  // seit v0.9.12 (DELETE /api/kos/:id prüft Autor-oder-ko.validate serverseitig).
  const { role } = useRole();
  const { user } = useSession();
  // ============================================================================================
  // JOB 381 — DER GELTUNGSBEREICH LEBT IN DER ADRESSE, NICHT IN EINEM ZWEITEN ZUSTAND.
  // ============================================================================================
  //
  // Bewusst KEIN `useState` daneben: die Adresse ist bereits die Wahrheit dieser Seite (Facetten,
  // Bereich und `q` liegen dort). Ein zweiter Zustand muesste mit ihr abgeglichen werden, und der
  // Reload-Fall (`R-18`: „ein Neuladen stellt denselben Geltungsbereich wieder her") faellt so
  // ohne eigenen Effekt heraus — die Adresse IST der Speicher.
  const scope = parseLibraryScope(params.get(LIBRARY_SCOPE_PARAM));
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // D-BIB gespeicherte Sichten: benannt, LOKAL je Nutzer (localStorage-Muster wie die
  // Board-Checkboxen — bewusst KEIN Server-Speicher; die Sicht lebt ehrlich nur in diesem Browser).
  const viewsUserId = user?.id ?? "anon";
  const [savedViews, setSavedViews] = useState<LibrarySavedView[]>([]);
  const [viewName, setViewName] = useState("");
  const [activeView, setActiveView] = useState("");
  useEffect(() => {
    setSavedViews(readLibraryViews(window.localStorage, viewsUserId));
  }, [viewsUserId]);
  const applyView = (view: LibrarySavedView): void => {
    const s = view.state as { q?: string; groupBy?: string };
    setQ(s.q ?? "");
    // AUFTRAG-uxpol2 (bens Blocker 1.2): Legacy-Felder SEMANTIKTREU in die neue Mehrfachauswahl
    // heben — insbesondere `status:"offen"` → {offen, pruefung}, damit offene KOs MIT Zuweisung
    // (Anzeigestatus „pruefung“) nicht still aus der Sicht fallen. Die reine Migrationslogik lebt
    // testbar in libraryFacets (migrateSavedFacetSelection).
    // AUFTRAG-uxpol5 · Punkt 1: die (entfernte) Status-Facette treffermengentreu auf die sichtbare
    // Reife-Dimension falten — sonst filterte eine alte Status-Sicht „versteckt aktiv“ (ohne Pille).
    setFacetSel(foldStatusIntoMaturity(migrateSavedFacetSelection(view.state)));
    // AUFTRAG-mega10: der Bereich ist Teil der Sicht. Altsichten kennen ihn nicht → leerer Bereich
    // (kein Filter), die Treffermenge einer Altsicht bleibt damit exakt erhalten.
    setRange(facetRangeFromSaved(view.state));
    setGroupBy(
      LIBRARY_GROUP_KEYS.includes(s.groupBy as LibraryGroupKey)
        ? (s.groupBy as LibraryGroupKey)
        : "none",
    );
    setWindowLimit(LIBRARY_RESULT_LIMIT);
    setActiveView(view.name);
  };
  const currentViewState = (): Record<string, unknown> => ({
    q,
    facetSel,
    range,
    groupBy,
  });
  const removeKo = useMutation({
    mutationFn: (id: string) => endpoints.ko.remove(id),
    onSuccess: () => {
      setConfirmDeleteId(null);
      void qc.invalidateQueries({ queryKey: ["library"] });
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["validation"] });
      push("success", t("ko.deleteDone"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });
  const revalidate = useMutation({
    mutationFn: (id: string) => endpoints.ko.act(id, { action: "revalidate" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["library"] });
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["validation"] });
      void qc.invalidateQueries({ queryKey: ["lifecycle"] });
      push("success", t("lib.revalidateDone"));
    },
    onError: () => push("error", t("state.error")),
  });

  // AUFTRAG-uxpol1: Anzeige-Label je Facetten-Wert — ALLE Dimensionen (Kategorie/Tag roh; Sprache/
  // Status/Alter/Trust/Art/Herkunft/Reife lokalisiert; Autor über das Directory — Fallback bleibt die
  // Id, nie ein erfundener Name). Reife nutzt dieselbe Use-Readiness-Sprache wie die Plakette.
  const facetValueLabel = (key: string, value: string): string => {
    switch (key) {
      case "language":
        return t(`lib.facet.lang.${value}`);
      case "status":
        return t(`status.${value}`);
      case "author":
        return nameOf(value);
      case "age":
        return t(`lib.facet.ageBucket.${value}`);
      case "trust":
        return t(`lib.facet.trustBucket.${value}`);
      case "type":
        return t(`ktype.${value}`);
      // AUFTRAG-mega10 Block C: dieselben Stufen-Texte wie das Chip am Objekt (conf.level.*) —
      // keine zweite Benennung derselben Sache.
      case "confidentiality":
        return t(`conf.level.${value}`);
      case "maturity":
        return t(useReadiness(value as Parameters<typeof useReadiness>[0]).labelKey);
      case "origin":
        return t(
          value === "demo"
            ? "lib.demoFilter.demo"
            : value === "non-demo"
              ? "lib.demoFilter.nonDemo"
              : "lib.demoFilter.all",
        );
      default:
        return value || t("lib.facet.none");
    }
  };

  // AUFTRAG-mega10 Block C: die abgeleitete Treffermenge wird JETZT VOR dem return gerechnet.
  // Grund: die Filterschiene steht ab sofort NEBEN der Trefferliste, nicht darin. Läge sie weiter im
  // children-Slot von QueryState, verschwände sie (samt Suchfeld) bei jedem Lade- und Fehlerzustand —
  // dann könnte man aus einem Fehler nicht mehr heraussuchen. Die Rechnung selbst ist unverändert.
  // JOB 381: der Geltungsbereich wirkt auf die ECHTE Treffermenge, und zwar HIER — vor Relevanz,
  // Facetten, Sortierung und Fensterung. Damit traegt er durch jede abgeleitete Anzeige (Zaehler,
  // Gruppen, Leerzustand), statt nur die Liste zu kuerzen. Eine Fassung, die stattdessen nur den
  // URL-Parameter schriebe, waere die Attrappe, die Pedis Entscheidung ausdruecklich ausschliesst.
  const koItems = applyLibraryScope(query.data ?? [], scope, user?.id);
  // SCRUM-245: client-seitig nach nachvollziehbarer Relevanz re-ranken (verwirft nichts).
  const ranked = searchLibrary(koItems, trimmedQ);
  // Die Werte je KO kommen aus der je Datenlauf memoisierten Ableitung (facetBase) — nur Lookups je
  // Render (Block-A-Vertrag: die teure Ableitung läuft genau EINMAL je Datenlauf).
  const valuesOf = (item: { ko: { id: string } }): FacetValues => facetBase.get(item.ko.id) ?? {};
  const facetItems = ranked.map(valuesOf);
  // AUFTRAG-mega10 Block B: das Schienen-Modell — Kontext-Zähler + Ausgrauen (wie bisher), dazu
  // Suche je Dimension, aufmachbarer Deckel und die abgeleitete Abhängigkeit Kategorie → Schlagwort.
  const groups = facetRailGroups(
    facetItems,
    LIBRARY_FILTER_CONFIGS,
    facetSel,
    railUi,
    facetValueLabel,
    LIBRARY_FACET_DEPENDENCIES,
  );
  const faceted = applyFacetSelection(ranked, valuesOf, facetSel).filter((item) =>
    // Block B Punkt 4: der Bereich wirkt ZUSÄTZLICH zur Facettenauswahl (UND), auf demselben
    // „zuletzt geändert“, das auch die Sortierung benutzt — keine zweite Zeitrechnung.
    matchesFacetRange(koChangedMs(item.ko), range),
  );
  // AUFTRAG-sortfilter · Punkt 1: die gefilterte Treffermenge sortieren (komponiert mit den Facetten).
  const sorted = sortLibrary(faceted, sortKey, (item) => item.ko);
  // SCRUM-158 / Block A: fenstern — jetzt mit AUFZIEHBAREM Deckel („Weitere N laden“).
  const win = windowList(sorted, windowLimit);
  // Beta Own-Knowledge Work Queue v0: Zahl der eigenen (nicht-Demo) Treffer im vollen Bestand.
  const nonDemoCount = countByDemoKnowledge(ranked)["non-demo"];
  // AUFTRAG-uxpol2: Herkunft ist eine Wertemenge — der „Eigenes Wissen“-Leerzustand greift nur bei
  // einer EINDEUTIGEN Demo/Nicht-Demo-Linse (gemischte Auswahl → „all“).
  const originValues = facetSelectedValues(facetSel.origin);
  const originSel =
    originValues.length === 1 && (originValues[0] === "demo" || originValues[0] === "non-demo")
      ? originValues[0]
      : "all";

  // Block B Punkt 5: „Diese Suche merken“ erscheint nur, wenn es etwas zu merken gibt.
  const anyFilterActive =
    trimmedQ.length > 0 || isFacetRangeActive(range) || isAnyFacetActive(facetSel);

  // Eine Filter-/Suchänderung setzt das Fenster zurück — sonst zeigte die Liste nach dem Filtern
  // weiter 600 Zeilen, obwohl der Nutzer gerade eingegrenzt hat.
  const resetWindow = (): void => setWindowLimit(LIBRARY_RESULT_LIMIT);
  // ============================================================================================
  // JOB 381 — DAS UMSCHALTEN DES GELTUNGSBEREICHS.
  // ============================================================================================
  //
  // `replace: true` wie der Facetten-Effekt daneben: Umschalten ist eine Sicht-Anpassung, kein
  // Ortswechsel — sonst stolperte der Zurueck-Knopf durch jede Umschaltung. `prev` wird KOPIERT
  // und nur der eine Schluessel angefasst, damit fremde Parameter (`q`, Facetten, geteilte Links)
  // unberuehrt bleiben. Der Fokus bleibt dabei auf der gedrueckten Schaltflaeche (`A-6`/`R-18`):
  // es aendert sich nur ein Suchparameter, die Seite wird nicht neu montiert.
  const setScope = (next: LibraryScope): void => {
    resetWindow();
    setParams(
      (prev) => {
        const nextParams = new URLSearchParams(prev);
        if (next === DEFAULT_LIBRARY_SCOPE) {
          // Der Standard steht NICHT in der Adresse: ein `?raum=alle` waere Rauschen in jedem
          // geteilten Link und liesse den Standard wie eine getroffene Wahl aussehen.
          nextParams.delete(LIBRARY_SCOPE_PARAM);
        } else {
          nextParams.set(LIBRARY_SCOPE_PARAM, next);
        }
        return nextParams;
      },
      { replace: true },
    );
  };
  const onToggleFacet = (key: string, value: string): void => {
    resetWindow();
    setFacetSel((prev) =>
      // Block B Punkt 2: nach der Wahl die durch sie ungültig gewordene Unterauswahl aufräumen.
      pruneDependentSelection(
        toggleFacetValue(prev, key, value),
        facetItems,
        LIBRARY_FACET_DEPENDENCIES,
      ),
    );
  };
  const onResetFilters = (): void => {
    resetWindow();
    setFacetSel(clearFacetSelection());
    setRange(EMPTY_FACET_RANGE);
    setRailUi(EMPTY_RAIL_UI);
  };

  return (
    // AUFTRAG-mega51 BLOCK E: die Ergebnisspalte bekommt Platz. Der Rahmen wächst von `max-w-6xl`
    // auf `max-w-7xl`, die Filterschiene schrumpft von 300px auf 248px (s. unten) — zusammen rund
    // 200px mehr für den Titel, der im Erstnutzerlauf auf vier Zeilen umbrach.
    <div className="mx-auto max-w-7xl">
      <PageHeader kicker={t("lib.kicker")} title={t("nav.library")} pageKey="bibliothek" />
      {/* ==========================================================================================
          AUFTRAG-mega51 BLOCK C — DIE BIBLIOTHEK IST ZUM SUCHEN DA, NICHT ZUM EXPORTIEREN.
          ==========================================================================================
          Im Seitenkopf standen „Re-Import (JSON)", eine Formatauswahl und ein dunkler „Export"-
          Knopf; das Suchfeld steckte klein in der linken Filterschiene. Für eine Erstnutzerin war
          die Bibliothek damit ein Datenwerkzeug.

          DIE ENTSCHEIDUNG (C1): die Suche wird das Hauptbedienelement — ein breites Feld ganz oben,
          über der Trefferliste, auf jeder Bildschirmbreite die erste Fläche nach der Überschrift.
          Re-Import und Export stehen daneben als ruhiger Nebenweg: gleiche Route, gleiches
          Verhalten, gleiche Beschriftung, nur nicht mehr der lauteste Knopf der Seite (C2).

          WARUM UMZIEHEN STATT VERDOPPELN: ein zweites Suchfeld in der Schiene wäre ein zweiter Ort
          für dieselbe Sache — zwei Felder, die dieselbe Zustandsvariable schreiben, und eine
          doppelte Feld-Id im DOM. Die Schiene filtert, die Kopfzeile sucht. Das mobile Filterblatt
          (mega47/48) ist unberührt: es zeigt weiter alle Filter, und das Suchfeld steht darüber auf
          der Seite selbst — erreichbar, ohne das Blatt zu öffnen. */}
      {/* ==========================================================================================
          JOB 381 — DIE ORTSZEILE: WORIN WIRD GERADE GESUCHT.
          ==========================================================================================
          Sie steht ÜBER dem Suchfeld und nicht darunter, weil sie benennt, WORIN gesucht wird —
          `R-17` misst genau diese y-Position, und die Tabreihenfolge folgt damit der Leserichtung
          (`A-9`). Sie steht auf der SEITE und nie im Filterblatt: „Die Schiene filtert, die
          Kopfzeile sucht" (`R-19`); der Geltungsbereich ist kein Filter, sondern die Angabe des
          Bestands, auf den sich alles andere bezieht.

          Zwei echte `button[aria-pressed]` und nie ein Auswahlmenü — auch schmal nicht (`R-19`).
          Ein `select` wäre auf kleinen Geräten die naheliegende Sparform, verstecken aber genau
          die Angabe, die hier sichtbar bleiben soll.

          Die Reihenfolge „Meine Ablage" vor „Alle Inhalte" ist Pedis Entscheidung, nicht Geschmack
          (`ENTSCHEIDUNGEN/JOB-381-ORTSZEILE.md`, Tabelle). */}
      <div
        data-testid="library-scope-bar"
        data-raum={scope}
        className="mb-3 flex flex-wrap items-center gap-2"
      >
        {/* `fieldset`/`legend` statt `role="group"`: dasselbe Versprechen an die Vorlesehilfe,
            aber mit dem Element, das es nativ traegt (Biome `a11y/useSemanticElements`). Die
            sichtbare Beschriftung IST die Legende — kein zweiter Text daneben. */}
        <fieldset className="m-0 flex items-center gap-2 border-0 p-0">
          <legend className="float-left mr-2 text-[12px] font-semibold text-muted-2">
            {SCOPE_BAR_LABEL}
          </legend>
          <div className="inline-flex overflow-hidden rounded-btn border border-hairline">
            {(
              [
                { scope: "meine" as const, label: MEINE_ABLAGE_LABEL },
                { scope: "alle" as const, label: ALLE_INHALTE_LABEL },
              ] satisfies { scope: LibraryScope; label: string }[]
            ).map((eintrag) => {
              const aktiv = scope === eintrag.scope;
              return (
                <button
                  key={eintrag.scope}
                  type="button"
                  aria-pressed={aktiv}
                  onClick={() => setScope(eintrag.scope)}
                  className={cx(
                    "px-3 py-1.5 text-[12.5px] font-semibold outline-none transition-colors",
                    aktiv ? "bg-ink text-surface" : "bg-surface text-muted hover:text-text",
                  )}
                >
                  {eintrag.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-[15rem] flex-1">
          {/* JOB 1119 (D-002): das Label war `sr-only` und trug denselben Text wie der Platzhalter.
              Ein Platzhalter verschwindet beim ersten Zeichen — die Auskunft, worin gesucht wird,
              verschwand also genau dann, wenn sie gebraucht wurde. Sichtbar getrennt: das Label
              sagt, WAS das Feld ist, der Platzhalter WELCHE Felder es durchsucht, und der
              Bestandshinweis darunter (`lib.scope.note`, BASIC-u2) WELCHEN Bestand. */}
          <label
            htmlFor="library-search"
            className="mb-1 block text-[12px] font-semibold text-text"
          >
            {t("lib.searchLabel")}
          </label>
          <div className="relative">
            <Search
              size={17}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-2"
            />
            <input
              id="library-search"
              type="search"
              value={q}
              onChange={(e) => {
                resetWindow();
                setQ(e.target.value);
              }}
              placeholder={t("lib.search")}
              className="h-11 w-full rounded-input border border-hairline bg-surface pl-10 pr-3 text-[14px] outline-none placeholder:text-muted-2 focus:border-ink/30"
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <HelpTip title={t("lib.help.filters.title")} body={t("lib.help.filters.body")} />
          {/* AUFTRAG-mega70 BLOCK B (Stelle 4): /import verlangt admin UND Stufe 2. Für alle
              anderen Rollen war das ein roher Link in den stillen Rückwurf; jetzt eine Lage.
              (Fehlt einem Admin nur Stufe 2, bleibt der Weg begehbar — dort erklärt die
              Stage2Notice die Lage, keine stille Umleitung.) */}
          <RoleLink to="/import" className="inline-flex items-center gap-1.5">
            {(erreichbar) =>
              erreichbar ? (
                <Button variant="ghost">{t("lib.reimport")}</Button>
              ) : (
                <span className="px-1 text-[13px] font-semibold text-muted">
                  {t("lib.reimport")}
                </span>
              )
            }
          </RoleLink>
          <select
            aria-label={t("lib.exportFormat")}
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
            className="h-9 rounded-input border border-hairline bg-surface px-2 text-[13px] text-text outline-none focus:border-ink/30"
          >
            {EXPORT_FORMATS.map((fmt) => (
              <option key={fmt} value={fmt}>
                {t(`lib.format.${fmt}`)}
              </option>
            ))}
          </select>
          <a href={exportUrl(exportFormat)} download={exportFilename(exportFormat)}>
            <Button variant="ghost">
              <Download size={15} />
              {t("lib.export")}
            </Button>
          </a>
        </div>
      </div>
      {/* ==========================================================================================
          AUFTRAG-BASIC-u2 — EINE SUCHE, DIE NICHT SAGT, WORIN SIE SUCHT, LÄSST DEN NUTZER RATEN.
          ==========================================================================================
          DER BEFUND (Erstnutzerlauf): über dem breitesten Bedienelement der App stand keine Angabe
          darüber, welchen Bestand es durchsucht. Wer hier seinen eben gespeicherten Entwurf sucht,
          findet nichts — und liest einen Nulltreffer, der wie „das gibt es nirgends" klingt. Die
          Angabe steht deshalb DIREKT unter dem Feld, in Alltagssprache, und der Weg in die andere
          Suchwelt (die eigenen Entwürfe auf /erfassen) ist benannt statt vorausgesetzt.

          `/erfassen` verlangt die Rolle „experte" — der Weg läuft deshalb über RoleLink (dasselbe
          Tor, aus dem der Router sein Gate zieht), nicht über einen rohen Link, der eine Betrachterin
          in den stillen Rückwurf schickte (mega70 Block D hält diese Bauform fest).

          Ein `div`, kein `p`: die gesperrte RoleLink-Fassung ist ein `div` und dürfte in keinem
          Absatz stehen. An Query, Filterung, Ranking und Sichtbarkeit ändert dieser Block nichts. */}
      <div className="-mt-2 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-relaxed text-muted">
        <span>{t("lib.scope.note")}</span>
        <RoleLink
          to="/erfassen"
          className="inline-flex items-center gap-1 font-semibold text-ink"
          hoverClassName="hover:underline"
          testId="library-scope-to-drafts"
        >
          {(erreichbar) => (
            <>
              {t("lib.scope.toDrafts")} {erreichbar ? <span aria-hidden="true">→</span> : null}
            </>
          )}
        </RoleLink>
      </div>
      {/* SCRUM-291: Demo-/Pilotpfad auf der Zielseite wiedererkennbar (nur bei ?demo=stage1). */}
      {isDemoContext(params) ? <DemoBanner surface="library" /> : null}
      {/* SCRUM-460 (VIP): Suche liefert nicht nur „dumme“ Treffer — bei aktiver Suche eine echte,
          quellengebundene Antwort anbieten (nutzt die vorhandene ehrliche Ask/Reasoner-Logik). */}
      {trimmedQ ? (
        <Card className="mb-4 border-ink/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[14rem] flex-1">
              <h2 className="text-[14px] font-semibold text-ink">{t("lib.answerTitle")}</h2>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                {t("lib.answerHint", { q: trimmedQ })}
              </p>
            </div>
            <Link to={askAnswerHref(trimmedQ)}>
              <Button>
                <Sparkles size={15} />
                {t("lib.answerButton")}
              </Button>
            </Link>
          </div>
        </Card>
      ) : null}
      {/* SCRUM-289: Reife-Plaketten/Filter kurz erklären — kein neues Statusmodell.
          AUFTRAG-uxpol5 · Punkt 3: einklappbar — Titel + Toggle bleiben, Erklärung/Plaketten klappen weg
          (Standard nach dem ersten Besuch: zu; Zustand pro Browser gemerkt). */}
      <Card className="mb-4 border-dashed">
        {/* AUFTRAG-uxpol6 (bens GELB 3.1): gültiges Disclosure-Muster — der Button steckt IM h2
            (Button erlaubt nur phrasing content, kein block-level h2 als Kind); aria-controls
            verbindet ihn über eine stabile ID mit dem kontrollierten Inhalt. */}
        <h2>
          <button
            type="button"
            aria-expanded={guideOpen}
            aria-controls={LIBRARY_GUIDE_PANEL_ID}
            onClick={toggleGuide}
            className="flex w-full items-center gap-2 text-left"
          >
            <span className="flex-1 text-[14px] font-semibold text-ink">{t(guide.titleKey)}</span>
            <ChevronDown
              size={15}
              aria-hidden
              className={cx("shrink-0 text-muted transition-transform", guideOpen && "rotate-180")}
            />
          </button>
        </h2>
        {guideOpen ? (
          <div id={LIBRARY_GUIDE_PANEL_ID} className="mt-2">
            <p className="mb-2 text-[12.5px] leading-relaxed text-muted">{t(guide.bodyKey)}</p>
            <div className="flex flex-wrap gap-2">
              {/* AUFTRAG-mega70 BLOCK B (Stelle 2): der Eintrag „Zu prüfen" führt auf
                  /validierung (controller) — für Betrachter und Experten jetzt eine Lage,
                  keine stille Sackgasse. Die Erklärung selbst bleibt für alle stehen. */}
              {guide.items.map((item) => (
                <RoleLink
                  key={item.id}
                  to={item.to}
                  className="inline-flex items-start gap-2 rounded-btn border border-hairline bg-surface px-2.5 py-2"
                  hoverClassName="hover:border-ink/30"
                >
                  {() => (
                    <>
                      <span
                        className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${GUIDE_TONE[item.tone]}`}
                      >
                        {t(item.labelKey)}
                      </span>
                      <span className="max-w-[18rem] text-[12px] leading-relaxed text-muted">
                        {t(item.bodyKey)}
                      </span>
                    </>
                  )}
                </RoleLink>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      {/* AUFTRAG-mega10 Block C: Schiene links, Ergebnis rechts. Auf schmalen Geräten fällt die
          Spalte weg — FacetFilter zeigt dort den Knopf „Filter (N)“ und ein Vollbild-Filterblatt. */}
      <div className="grid items-start gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
        <FacetFilter
          configs={LIBRARY_FILTER_CONFIGS}
          groups={groups}
          selection={facetSel}
          secondaryKeys={LIBRARY_SECONDARY_FACET_KEYS}
          moreStorageKey={LIBRARY_MORE_FILTERS_STORAGE_KEY}
          pillKeys={LIBRARY_PILL_FACET_KEYS}
          toneForValue={(key, value) =>
            key === "maturity" ? MATURITY_PILL_TONE[libraryMaturityTone(value)] : undefined
          }
          total={ranked.length}
          shown={faceted.length}
          onQueryChange={(key, value) =>
            setRailUi((prev) => ({ ...prev, query: { ...prev.query, [key]: value } }))
          }
          onShowAllToggle={(key) =>
            setRailUi((prev) => ({
              ...prev,
              showAll: { ...prev.showAll, [key]: prev.showAll[key] !== true },
            }))
          }
          onToggle={onToggleFacet}
          onReset={onResetFilters}
          labelForValue={facetValueLabel}
          countLabelKey="lib.facet.showResults"
          range={range}
          onRangeChange={(next) => {
            resetWindow();
            setRange(next);
          }}
          rangeLabelKey="lib.facet.rangeLabel"
          rangeAfterKey="tag"
        />
        <div className="min-w-0">
          {/* Block B Punkt 5: gespeicherte Sichten NACH OBEN — anklickbar über der Trefferliste,
              plus „Diese Suche merken“, wenn ein Filter aktiv ist. Kein Abo, keine Benachrichtigung. */}
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
              {t("lib.views.savedLabel")}:
            </span>
            {savedViews.map((v) => (
              <button
                key={v.name}
                type="button"
                aria-pressed={activeView === v.name}
                onClick={() => applyView(v)}
                className={cx(
                  "rounded-pill border border-dashed px-2.5 py-1 text-[11.5px]",
                  activeView === v.name
                    ? "border-brand-300 bg-surface font-semibold text-brand-text"
                    : "border-hairline bg-surface text-muted hover:border-brand-300 hover:text-brand-text",
                )}
              >
                ★ {v.name}
              </button>
            ))}
            {savedViews.length === 0 ? (
              <span className="text-[11px] text-muted-2">{t("lib.views.localHint")}</span>
            ) : null}
            {anyFilterActive ? (
              <>
                <label htmlFor="library-view-name" className="sr-only">
                  {t("lib.views.namePlaceholder")}
                </label>
                <input
                  id="library-view-name"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder={t("lib.views.namePlaceholder")}
                  className="h-8 w-40 rounded-input border border-hairline bg-surface px-2 text-[12px] text-text outline-none placeholder:text-muted-2 focus:border-ink/30"
                />
                <button
                  type="button"
                  disabled={viewName.trim().length === 0}
                  onClick={() => {
                    setSavedViews(
                      saveLibraryView(window.localStorage, viewsUserId, {
                        name: viewName.trim(),
                        state: currentViewState(),
                      }),
                    );
                    setActiveView(viewName.trim());
                    setViewName("");
                  }}
                  className="rounded-pill border border-brand-300 bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-brand-text disabled:opacity-45"
                >
                  + {t("lib.views.remember")}
                </button>
              </>
            ) : null}
            {activeView ? (
              <button
                type="button"
                onClick={() => {
                  setSavedViews(removeLibraryView(window.localStorage, viewsUserId, activeView));
                  setActiveView("");
                }}
                className="rounded-pill px-2 py-1 text-[11.5px] text-muted underline underline-offset-2 hover:text-text"
              >
                {t("lib.views.remove")}
              </button>
            ) : null}
          </div>
          {/* uxpol1 (4): jede aktive Auswahl als entfernbare Pille — auch aus eingeklappten Gruppen,
              auch das strukturelle No-Match, jetzt zusätzlich die Bereichsgrenzen. */}
          <FacetActiveBar
            configs={LIBRARY_FILTER_CONFIGS}
            selection={facetSel}
            onToggle={onToggleFacet}
            onReset={onResetFilters}
            onClearGroup={(key) => {
              resetWindow();
              setFacetSel((prev) => {
                // AUFTRAG-uxpol4: eine No-Match-Pille abwählen ⇒ die ganze Dimension lösen
                // (strukturell, ohne echten Wert) — kein Marker verbleibt in der Auswahl.
                const next = { ...prev };
                delete next[key];
                return next;
              });
            }}
            labelForValue={facetValueLabel}
            range={range}
            onRangeChange={(next) => {
              resetWindow();
              setRange(next);
            }}
            rangeLabelKey="lib.facet.rangeLabel"
          />
          {/* JOB 3034 R2 · Zustandsmodell: scheitert die Auffrischung einer bereits geholten
            Trefferliste (auch offline), bleiben die Zeilen samt Stufenkennzeichen stehen; der
            Fehler steht als Hinweis darüber. Bis Runde 1 leerte `QueryState` bei `isError` die
            ganze Liste (Begründung: lib/confidentiality.ts, `abfrageMitBestand`). */}
          {auffrischungGescheitert(query) ? (
            // Klassensatz, Marke und Text kommen aus `lib/confidentiality.ts` — dieselbe Aussage
            // wie auf der Detailseite, aus derselben Quelle (JOB 3034 R3).
            <output
              aria-live="polite"
              data-testid={AUFFRISCHUNG_HINWEIS_MARKE}
              className={AUFFRISCHUNG_HINWEIS_KLASSE}
            >
              {auffrischungHinweisText(query, t, i18n.language)}
            </output>
          ) : null}
          <QueryState
            query={abfrageMitBestand(query)}
            emptyText={trimmedQ ? t("lib.emptyQuery", { q: trimmedQ }) : t("lib.empty")}
            // WP-SHIP9-S2 Paket 4 (W3): der generische Erststart-Block erscheint NUR bei wirklich
            // leerem Bestand (kein einziges KO). Bei 0 Treffern mit aktiver Suche/Filtern bleibt es
            // bei der ehrlichen Treffer-Meldung. all.data noch undefiniert (lädt) ⇒ nicht als leer
            // werten (kein Erststart-Aufblitzen).
            emptyExtra={
              (all.data?.length ?? -1) === 0 ? <EmptyStateCtas context="library" /> : undefined
            }
          >
            {() => (
              <>
                {/* AUFTRAG-sortfilter · Punkt 1: Sortier-Steuerung nahe der Trefferzeile, gleiche
                  Design-Sprache wie die übrigen Selects. Wirkt auf die aktuell gefilterte Treffermenge
                  (oben) und — bei aktiven Untergruppen — innerhalb jeder Gruppe. */}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <label
                    htmlFor="library-sort"
                    className="mr-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-2"
                  >
                    {t("lib.sort.label")}:
                  </label>
                  <select
                    id="library-sort"
                    value={sortKey}
                    onChange={(e) =>
                      setSortKey(e.target.value as (typeof LIBRARY_SORT_KEYS)[number])
                    }
                    className="h-8 rounded-input border border-hairline bg-surface px-2 text-[12.5px] text-text outline-none focus:border-ink/30"
                  >
                    {LIBRARY_SORT_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {t(LIBRARY_SORT_LABEL_KEYS[key])}
                      </option>
                    ))}
                  </select>
                </div>
                {/* D-BIB: Untergruppen-Ansicht — metadaten-basiert (KI-Themencluster bewusst NICHT
                  angebunden: nicht trivial — im Bericht vermerkt). */}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="mr-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                    {t("lib.groupBy.label")}:
                  </span>
                  {LIBRARY_GROUP_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={groupBy === key}
                      onClick={() => setGroupBy(key)}
                      className={`rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold ${
                        groupBy === key
                          ? "border-ink bg-ink text-white"
                          : "border-hairline text-muted hover:text-text"
                      }`}
                    >
                      {key === "none" ? t("lib.groupBy.none") : t(LIBRARY_FACET_LABEL_KEYS[key])}
                    </button>
                  ))}
                </div>
                {/* Beta Own-Knowledge Work Queue v0: ehrlicher Leerzustand für die „Eigenes Wissen“-Linse
                  — wenn auf eigenes/nicht-Demo-Wissen gefiltert wird, aber (noch) keins existiert, den
                  Weg zurück ins Erfassen zeigen statt einer stummen leeren Liste. */}
                {(() => {
                  const ownEmpty = ownKnowledgeEmptyHint({
                    filter: originSel,
                    count: nonDemoCount,
                  });
                  if (!ownEmpty) {
                    return null;
                  }
                  return (
                    <Card className="mb-2">
                      <p className="text-[13px] font-semibold text-text">{t(ownEmpty.titleKey)}</p>
                      <p className="mt-0.5 text-[12px] text-muted">{t(ownEmpty.hintKey)}</p>
                      {/* AUFTRAG-mega70 BLOCK B (die beim Nachprüfen gefundene FÜNFTE Stelle,
                          vom Sammler bestätigt): /erfassen verlangt experte — für Betrachter
                          war dieser betonte Leerzustands-Knopf ein Weg in den stillen Rückwurf. */}
                      <RoleLink
                        to={ownEmpty.to}
                        className="mt-2 inline-flex items-center gap-1 rounded-btn bg-ink px-3 py-1.5 text-[12px] font-semibold text-white"
                        hoverClassName="hover:opacity-90"
                      >
                        {(erreichbar) => (
                          <>
                            {t(ownEmpty.ctaKey)}{" "}
                            {erreichbar ? <span aria-hidden="true">→</span> : null}
                          </>
                        )}
                      </RoleLink>
                    </Card>
                  );
                })()}
                {/* ================================================================================
                    AUFTRAG-mega59 BLOCK D — DER STUMME NULLZUSTAND.
                    ================================================================================
                    `QueryState` bewertet NUR die Serverantwort; Facetten und Zeitbereich filtern
                    erst danach clientseitig. Liefert die Suche also Treffer, die Facetten aber
                    nicht, rendert die Liste darunter eine leere Karte GANZ OHNE TEXT — bei aktiver
                    Gruppierung ein leeres `div`. Der bereits geschlossene Fall (Suche ohne Treffer)
                    ist davon nicht betroffen; das hier ist die benachbarte Lücke, und sie war die
                    einzige Suchfläche der App ohne Leerzustand.
                    Der Text nennt den GRUND (es gibt Treffer, die Filter zeigen keinen davon), und
                    die Handlung ist der BESTEHENDE Reset-Handler `onResetFilters` — derselbe, den
                    die Pillen-Leiste oben fährt. Kein zweiter Weg, kein zweiter Zustand. */}
                {sorted.length === 0 ? (
                  <Card>
                    <p className="text-[13px] font-semibold text-text">
                      {t("lib.facetEmpty.title")}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {t("lib.facetEmpty.hint", { count: ranked.length })}
                    </p>
                    <Button className="mt-2" variant="ghost" onClick={onResetFilters}>
                      {t("lib.facetEmpty.reset")}
                    </Button>
                  </Card>
                ) : null}
                {(() => {
                  const koRows = (list: typeof win.visible): JSX.Element[] =>
                    list.map(({ ko: k, matches }) => {
                      // SCRUM-262: ehrliche Reife/Nutzbarkeit je Treffer (DOM-freier Helper).
                      const maturity = libraryMaturity(k);
                      // SCRUM-357 / AG-14: ein offener Konflikt begrenzt die Reife ehrlich (ready → in
                      // Prüfung). So wirkt ein validiertes KO mit offenem Truth-Konflikt NICHT „nutzbar“.
                      const impact = conflictImpact(k.id, conflicts.data ?? []);
                      const effReadiness = useReadiness(
                        conflictLimitedUsability(maturity.usability, impact),
                      );
                      // Konfliktbegrenztes KO führt nicht direkt in Ask, sondern zur Konfliktseite.
                      const useCta = impact.limited
                        ? {
                            labelKey: "conflict.impact.cta",
                            href: "/konflikte",
                            kind: "review" as const,
                          }
                        : // WP-UX-WOW-1 U5: echte Frage statt roher Aussage/Titel — und via ?ask=1
                          // DIREKT beantwortet (ein Klick → Antwort).
                          libraryUseCta(k, t("ask.koQuestion", { title: k.title }));
                      return (
                        <div
                          key={k.id}
                          // SCRUM-419: umbruchfähig — die Lösch-Bestätigung bekommt ihre eigene Zeile.
                          className="group flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-hairline-soft"
                        >
                          <Link
                            to={demoHref(`/wissen/${k.id}`, params)}
                            className="flex min-w-0 flex-1 items-center gap-3"
                          >
                            {/* SCRUM-396-Muster (Pedi 02.07.): Titel zuerst und deutlich — die
                              Badge-Kette davor machte die Überschrift unauffindbar. Badges
                              rücken in eine ruhige Zeile UNTER den Titel; nichts entfernt. */}
                            <span className="min-w-0 flex-1">
                              {/* WP-UX-WOW-1 U4: Titel nicht mehr hart kappen — volle Breite,
                                zweizeilig mit line-clamp; der Volltext liegt im title-Attribut. */}
                              <span
                                title={k.title}
                                className="block line-clamp-2 text-[15px] font-semibold leading-snug text-text underline-offset-4 group-hover:underline"
                              >
                                {k.title}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${MATURITY_TONE[effReadiness.tone]}`}
                                >
                                  {t(effReadiness.labelKey)}
                                </span>
                                <StatusPill status={deriveStatus(k)} />
                                {/* JOB 3034: die Vertraulichkeitsstufe im Klartext — in der
                                  Trefferzeile stand sie bisher GAR NICHT; wer eine Zeile ansah,
                                  erfuhr über die Vertraulichkeit nichts. Derselbe Chip aus
                                  derselben Funktion wie im Detail (`vertraulichkeitsAuskunft`),
                                  dieselbe `rounded-pill`-Bauform und Größe wie die Nachbarpillen.
                                  Die Listenroute schickt `confidentialityProvenance` (noch) nicht
                                  mit — die Funktion wendet dann dieselbe Serverregel selbst an, ein
                                  Altbestandstreffer ohne Stufe sagt also „Nicht eingestuft" und
                                  gibt sich nicht als intern aus. */}
                                {(() => {
                                  const stufe = vertraulichkeitsAuskunft(k);
                                  return (
                                    <span
                                      data-testid="ko-vertraulichkeitsstufe"
                                      title={t("conf.field")}
                                      aria-label={`${t("conf.field")}: ${t(stufe.labelKey)}`}
                                      className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${CONF_TONE_CLASS[stufe.tone]}`}
                                    >
                                      {t(stufe.labelKey)}
                                    </span>
                                  );
                                })()}
                                {/* SCRUM-357: sichtbares Konflikt-Signal direkt in der Trefferzeile. */}
                                {impact.limited ? (
                                  <span
                                    title={t("conflict.impact.hint")}
                                    className="shrink-0 rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-trust-warn-text"
                                  >
                                    {t("conflict.impact.badge")}
                                  </span>
                                ) : null}
                                {/* SCRUM-308: Herkunfts-Kennzeichnung Demo-/Seed-Wissen (neutral). */}
                                {isDemoKnowledge(k) ? (
                                  <span
                                    title={t("demo.badge.hint")}
                                    className="shrink-0 rounded-pill bg-hairline-soft px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted-2"
                                  >
                                    {t("demo.badge.label")}
                                  </span>
                                ) : null}
                                {/* JOB 679 / D2 (K1.2): Herkunfts-Chip „Aus Word" — dieselbe
                                  neutrale Tönung und Größe wie das Demo-Badge darüber, weil
                                  beide dasselbe sagen: WOHER, nicht WIE GUT. Die Bedingung
                                  fragt genau den einen Wert ab; ohne `origin` (Altbestand)
                                  erscheint nichts. */}
                                {k.origin === "word_addin" ? (
                                  <span
                                    data-testid="ko-origin-word-addin"
                                    title={t("ko.originWordAddin.hint")}
                                    className="shrink-0 rounded-pill bg-hairline-soft px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted-2"
                                  >
                                    {t("ko.originWordAddin.label")}
                                  </span>
                                ) : null}
                                <KnowledgeTypeTag type={k.type} />
                              </span>
                              <KoAuthorLine {...koAuthorParts(k, nameOf)} />
                              {/* JOB 528 — DIE ERSTELLZEIT, und ausschliesslich sie.
                                  Die Ownerentscheidung vom 13.08.2026 bindet `createdAt` und
                                  verwirft `koChangedMs` sowie „beide anzeigen" ausdruecklich.
                                  Liefert der Helfer `null` (fehlend, leer, unparsebar), faellt
                                  die GANZE Zeile weg — kein Ersatzwert, kein 01.01.1970. */}
                              {(() => {
                                const erstellt = formatKoTimestamp(k.createdAt, i18n.language);
                                return erstellt ? (
                                  <span
                                    data-testid="ko-zeitstempel"
                                    title={t("ko.createdAt")}
                                    className="font-mono text-[10.5px] text-muted-2"
                                  >
                                    {`${t("ko.createdAt")} ${erstellt}`}
                                  </span>
                                ) : null;
                              })()}
                              {/* SCRUM-245: kompakte, ehrliche Match-Gründe (nur bei aktiver Suche). */}
                              {trimmedQ && matches.length > 0 ? (
                                <span className="mt-0.5 flex flex-wrap items-center gap-1">
                                  <span className="font-mono text-[9.5px] uppercase tracking-wide text-muted-2">
                                    {t("lib.matchIn")}
                                  </span>
                                  {matches.map((field) => (
                                    <span
                                      key={field}
                                      className="rounded-pill bg-hairline-soft px-1.5 py-0.5 text-[10px] text-muted"
                                    >
                                      {matchLabel(field)}
                                    </span>
                                  ))}
                                </span>
                              ) : null}
                            </span>
                            <span className="hidden font-mono text-[11px] text-muted-2 sm:block">
                              {k.category}
                            </span>
                            {/* WP-UX-WOW-1 U4: „Validiert“ neben einer 0-Leiste verwirrt Laien —
                              validiert + Trust 0 bekommt statt der leeren Leiste den nüchternen
                              Hinweis (Tooltip erklärt Trust); die Leiste erst ab Trust > 0. */}
                            {/* AUFTRAG-mega51 BLOCK D2: die Bedingung las `k.trust`, angezeigt wird
                              aber `k.confidence` (die Leiste rechts). Bei `trust > 0` und
                              `confidence = 0` blieb die unerklärte Null deshalb stehen — genau der
                              Fall, den WP-UX-WOW-1 U4 verhindern wollte. Bedingung und Anzeige
                              lesen jetzt DENSELBEN Wert, und der Erklärtext spricht folgerichtig
                              von der Sicherheit statt von Trust (die Trust-Texte bleiben unberührt
                              — sie gehören zur eigenen Scheibe). */}
                            {deriveStatus(k) === "validiert" && k.confidence === 0 ? (
                              <span
                                title={t("lib.confidenceNoneHint")}
                                className="hidden text-[11px] text-muted-2 sm:block"
                              >
                                {t("lib.confidenceNone")}
                              </span>
                            ) : (
                              <div className="hidden sm:block">
                                <ConfidenceBar value={k.confidence} showLabel={false} />
                              </div>
                            )}
                          </Link>
                          {/* SCRUM-288: nur nutzbares/validiertes Wissen direkt in Ask; offene KOs → Review.
                            SCRUM-294: im Demo-Kontext den Use-Fluss-Kontext weitertragen.
                            AUFTRAG-mega70 BLOCK B (Stelle 3): die Review-/Konflikt-Handlung führt
                            auf /validierung bzw. /konflikte (controller) — für Betrachter und
                            Experten jetzt eine Lage, kein Weg in den stillen Rückwurf. */}
                          <RoleLink
                            to={demoHref(useCta.href, params)}
                            className={`inline-flex shrink-0 items-center gap-1 rounded-btn border px-2.5 py-1 text-[12px] font-semibold ${
                              useCta.kind === "ask"
                                ? "border-ink bg-ink text-white"
                                : "border-hairline text-muted"
                            }`}
                            hoverClassName={
                              useCta.kind === "ask" ? "hover:text-white" : "hover:text-text"
                            }
                          >
                            {() => t(useCta.labelKey)}
                          </RoleLink>
                          {canRevalidate(k.status) ? (
                            <button
                              type="button"
                              title={t("lib.revalidate")}
                              disabled={revalidate.isPending && revalidate.variables === k.id}
                              onClick={() => revalidate.mutate(k.id)}
                              className="inline-flex shrink-0 items-center gap-1 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text disabled:opacity-50"
                            >
                              <RotateCw size={13} />
                              {t("lib.revalidate")}
                            </button>
                          ) : null}
                          {/* Pedi 02.07.: Löschen direkt in der Zeile (Autor/Controller/Admin) —
                            Inline-Bestätigung; Server erzwingt dieselbe Regel (403 sonst). */}
                          {role === "admin" || role === "controller" || k.author === user?.id ? (
                            confirmDeleteId === k.id ? (
                              // SCRUM-412/419 (CI + Layout): Bestätigung auf EIGENER voller Zeile,
                              // rechtsbündig — quetscht sich nicht mehr neben Pills und Knöpfe.
                              <span className="flex w-full basis-full flex-wrap items-center justify-end gap-1.5 border-t border-hairline pt-2">
                                {/* AUFTRAG-mega45 Block E: der Fragetext darf schrumpfen (min-w-0)
                                    und fuellt den Rest (flex-1) — die eine Zutat, die aus der
                                    Validierungs-Fassung erhalten bleibt. Ohne sie sprengt der
                                    lange Text die Zeile (Pedis Layout-Bruch vom 04.07.). */}
                                <span className="min-w-0 flex-1 text-[12px] font-semibold text-text">
                                  {t("ko.deleteQ")}
                                </span>
                                <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                                  {t("ko.deleteKeep")}
                                </Button>
                                {/* AUFTRAG-mega14 Block F (SCRUM-412): im echten Browser gemessen —
                                    dieser Knopf trug rgb(27,30,33), also exakt die neutrale
                                    Textfarbe. Jetzt Warnfarbe am zerstörenden Knopf. */}
                                <Button
                                  variant="danger"
                                  disabled={removeKo.isPending}
                                  onClick={() => removeKo.mutate(k.id)}
                                >
                                  {t("ko.deleteYes")}
                                </Button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                title={t("ko.deleteButton")}
                                onClick={() => setConfirmDeleteId(k.id)}
                                className="inline-flex shrink-0 items-center rounded-btn border border-hairline px-2 py-1 text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                              >
                                <Trash2 size={13} />
                              </button>
                            )
                          ) : null}
                          {/* WP-SHIP9-S2 Paket 3 (E2): Kurzvorschau-Aufklapper — eigene volle Zeile
                            (flex-wrap), nutzt die bereits vorliegende Kernaussage (kein Roundtrip). */}
                          <KoSummaryDisclosure source={k} className="w-full basis-full" />
                        </div>
                      );
                    });
                  // AUFTRAG-mega59 BLOCK D: bei null sichtbaren Einträgen übernimmt der Leerzustand
                  // darüber. Ohne dieses `null` stünde die leere Karte (bzw. bei aktiver Gruppierung
                  // das leere `div`) weiter unter der Meldung — genau der stumme Zustand, den dieser
                  // Block schließt, nur diesmal mit Text darüber.
                  if (sorted.length === 0) {
                    return null;
                  }
                  // D-BIB: flache Liste ODER Untergruppen (auf-/zuklappbar, Größe absteigend) —
                  // dieselben Zeilen, nur anders gebündelt (das Fenster win.visible bleibt der Deckel).
                  return groupBy === "none" ? (
                    <Card className="p-0">
                      <div className="divide-y divide-hairline">{koRows(win.visible)}</div>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {groupByFacet(
                        win.visible,
                        (item) => facetBase.get(item.ko.id) ?? {},
                        groupBy,
                      ).map((group) => (
                        <details
                          key={group.value || "—"}
                          open
                          className="rounded-card border border-hairline bg-surface"
                        >
                          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5">
                            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">
                              {facetValueLabel(groupBy, group.value)}
                            </span>
                            <span className="shrink-0 font-mono text-[11px] text-muted-2">
                              {group.items.length}
                            </span>
                          </summary>
                          <div className="divide-y divide-hairline border-t border-hairline">
                            {koRows(group.items)}
                          </div>
                        </details>
                      ))}
                    </div>
                  );
                })()}
                {/* Block A (ehrliche Anzeige): das Fenster war bei 200 zu Ende — sichtbar gemeldet,
                    aber ohne jeden Weg weiter. Jetzt gilt „zeigt N von M“ PLUS ein Knopf, der die
                    nächsten lädt. Eine stille Kürzung gibt es an keiner Stelle. */}
                {win.limited ? (
                  <div className="mt-2 flex flex-col items-stretch gap-1.5">
                    <p className="font-mono text-[11px] text-trust-warn-text">
                      {t("lib.showingFirst", { shown: win.shown, total: win.total })}
                    </p>
                    <button
                      type="button"
                      onClick={() => setWindowLimit((n) => n + LIBRARY_RESULT_LIMIT)}
                      className="w-full rounded-btn border border-hairline bg-surface px-3 py-2.5 text-[13px] font-semibold text-text hover:border-ink/30"
                    >
                      {t("lib.loadMore", {
                        n: Math.min(LIBRARY_RESULT_LIMIT, win.total - win.shown),
                      })}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </QueryState>
        </div>
      </div>
    </div>
  );
}

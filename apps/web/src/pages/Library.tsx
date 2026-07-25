import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Download, RotateCw, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useConflicts, useDirectory, useKos, useLibrarySearch } from "../api/hooks";
import type { KnowledgeObject } from "../api/types";
import { useSession } from "../app/AuthContext";
import { useRole } from "../app/RoleContext";
import { useToast } from "../app/ToastContext";
import { DemoBanner } from "../components/DemoBanner";
import { EmptyStateCtas } from "../components/EmptyStateCtas";
import { FacetFilter } from "../components/FacetFilter";
import { HelpTip } from "../components/HelpTip";
import { KoSummaryDisclosure } from "../components/KoSummaryDisclosure";
import { ConfidenceBar, KnowledgeTypeTag, KoAuthorLine, StatusPill } from "../components/trust";
import { Button, Card, PageHeader, QueryState, cx } from "../components/ui";
import { askAnswerHref } from "../lib/askQuestion";
import { conflictImpact, conflictLimitedUsability } from "../lib/conflictImpact";
import {
  countByDemoKnowledge,
  isDemoKnowledge,
  ownKnowledgeEmptyHint,
  readDemoKnowledgeFilter,
} from "../lib/demoKnowledge";
import { demoHref, isDemoContext } from "../lib/demoPilotPath";
import { deriveStatus } from "../lib/displayStatus";
import { type FacetGroupConfig, buildFacetGroups, clearFacetSelection } from "../lib/facetFilter";
import {
  type FacetSelection,
  type FacetValues,
  applyFacetSelection,
  facetSelectedValues,
  toggleFacetValue,
} from "../lib/facets";
import { type KnowledgeGuidanceTone, knowledgeGuidance } from "../lib/knowledgeGuidance";
import { koAuthorParts } from "../lib/koAuthor";
import { windowList } from "../lib/libraryDisplay";
import { EXPORT_FORMATS, type ExportFormat, exportFilename, exportUrl } from "../lib/libraryExport";
import {
  LIBRARY_FACET_LABEL_KEYS,
  LIBRARY_GROUP_KEYS,
  type LibraryGroupKey,
  type LibrarySavedView,
  foldStatusIntoMaturity,
  groupByFacet,
  libraryFacetValues,
  migrateSavedFacetSelection,
  readLibraryViews,
  removeLibraryView,
  saveLibraryView,
} from "../lib/libraryFacets";
import { type MaturityTone, libraryMaturity, libraryUseCta } from "../lib/libraryMaturity";
import { EMPTY_LIBRARY_FILTER, buildLibraryQuery } from "../lib/libraryQuery";
import { type MatchField, searchLibrary } from "../lib/librarySearch";
import {
  DEFAULT_LIBRARY_SORT,
  LIBRARY_SORT_KEYS,
  LIBRARY_SORT_LABEL_KEYS,
  LIBRARY_SORT_STORAGE_KEY,
  sortLibrary,
} from "../lib/librarySort";
import { canRevalidate } from "../lib/revalidation";
import { LIBRARY_SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../lib/useDebouncedValue";
import { usePersistentDisclosure } from "../lib/usePersistentDisclosure";
import { usePersistentEnum } from "../lib/usePersistentValue";
import { useReadiness } from "../lib/useReadiness";

// AUFTRAG-uxpol1 (PAKET 1): EINE Facetten-Config für die Bibliothek — jede Dimension GENAU EINMAL
// (kein Dropdown OBEN + Chip UNTEN mehr). Reihenfolge = Anzeigereihenfolge der Filterleiste. Die
// Werte je Facette leitet libraryFilterValues (unten) rein aus dem KO ab (dieselbe Ableitung wie die
// Validierungs-Badges/Reife-Plakette — keine zweite Wahrheit). Reife + Herkunft werden so ebenfalls
// vollwertige, dynamisch gezählte Facetten (vorher eigene Chip-Reihen).
// AUFTRAG-uxpol5 · Punkt 1: die rohe „Status"-Facette (offen/pruefung/validiert) ist ein reines
// Relabeling der „Reife" (needs-work/in-review/ready) — beide aus DEMSELBEN deriveStatus(ko) ohne Flags,
// über eine Bijektion (s. foldStatusIntoMaturity). Sie hatte keine eigene Treffermenge und ist als
// Filterzeile ENTFERNT (der rohe Status bleibt anderswo — Trefferzeilen-Pille, Gruppierung — erhalten).
// Punkt 2: primäre Facetten zuerst (immer sichtbar), danach die selteneren hinter „Weitere Filter".
const LIBRARY_FILTER_CONFIGS: readonly FacetGroupConfig[] = [
  { key: "maturity", labelKey: "lib.facet.maturity" },
  { key: "category", labelKey: LIBRARY_FACET_LABEL_KEYS.category },
  { key: "author", labelKey: LIBRARY_FACET_LABEL_KEYS.author },
  { key: "origin", labelKey: "lib.facet.origin" },
  { key: "type", labelKey: "lib.facet.type" },
  { key: "language", labelKey: LIBRARY_FACET_LABEL_KEYS.language },
  { key: "tag", labelKey: "lib.facet.tag" },
  { key: "age", labelKey: LIBRARY_FACET_LABEL_KEYS.age },
  { key: "trust", labelKey: LIBRARY_FACET_LABEL_KEYS.trust },
];

// Punkt 2: „primär = immer sichtbar" sind Reife, Abteilung/Kategorie, Autor; alles Übrige wandert
// hinter „Weitere Filter" (eingeklappt als Standard, Zustand pro Browser gemerkt).
const LIBRARY_SECONDARY_FACET_KEYS = ["origin", "type", "language", "tag", "age", "trust"] as const;
const LIBRARY_MORE_FILTERS_STORAGE_KEY = "klarwerk.library.filters.moreOpen";
const LIBRARY_GUIDE_STORAGE_KEY = "klarwerk.library.guideOpen";
// AUFTRAG-uxpol6 (bens GELB 3.1): stabile ID des kontrollierten Erklärbox-Inhalts für aria-controls.
const LIBRARY_GUIDE_PANEL_ID = "library-maturity-guide";

// Vollständige Facetten-Werte eines KOs: die sechs Bestands-Facetten (libraryFacetValues) PLUS
// Reife, Herkunft, Wissensart und Tags — alles rein aus dem KO abgeleitet (keine zweite Logik).
function libraryFilterValues(ko: KnowledgeObject, nowMs: number): FacetValues {
  return {
    ...libraryFacetValues(ko, nowMs),
    type: [ko.type],
    tag: ko.tags ?? [],
    origin: [isDemoKnowledge(ko) ? "demo" : "non-demo"],
    maturity: [libraryMaturity(ko).usability],
  };
}

// SCRUM-262: Tönung der Reife-/Nutzbarkeits-Plakette (nutzbar/in Prüfung/zu prüfen).
const MATURITY_TONE: Record<MaturityTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
};

// SCRUM-289: kompakte Reife-Erklärung (nutzbar vs. in Prüfung/zu prüfen).
const GUIDE_TONE: Record<KnowledgeGuidanceTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
};

export function Library(): JSX.Element {
  const { t } = useTranslation();
  // Startfilter aus der URL (?q=…), gesetzt von der globalen Topbar-Suche.
  // Pedi 05.07.: zusätzlich ?category=… vorbelegen — Verweise aus Risiko & Lücken landen so
  // direkt auf den Objekten der betroffenen Domäne.
  const [params] = useSearchParams();
  // Volltext-Startwert aus der URL (?q=…), gesetzt von der globalen Topbar-Suche.
  const [q, setQ] = useState(params.get("q") ?? "");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");
  // AUFTRAG-uxpol1 (PAKET 1): EINE Facetten-Auswahl für ALLE Dimensionen (Reife/Status/Herkunft/
  // Kategorie/Art/…). Vorbelegung aus der URL: ?category=… (Verweise aus Risiko & Lücken) und
  // ?origin=… (Deep-Link „eigenes Wissen"). Frühere getrennte Reife-/Herkunfts-States sind Teil davon.
  const [facetSel, setFacetSel] = useState<FacetSelection>(() => {
    // AUFTRAG-uxpol2: Facetten-Auswahl ist eine Wertemenge je Gruppe — die URL-Vorbelegung startet
    // also als einelementige Menge (ODER innerhalb der Gruppe, weitere Werte kommen per Klick dazu).
    const initial: FacetSelection = {};
    const cat = params.get("category");
    if (cat) {
      initial.category = [cat];
    }
    const origin = readDemoKnowledgeFilter(params);
    if (origin !== "all") {
      initial.origin = [origin];
    }
    return initial;
  });
  const [groupBy, setGroupBy] = useState<LibraryGroupKey>("none");
  // AUFTRAG-sortfilter · Punkt 1: Sortier-Wahl der Trefferliste — pro Browser gemerkt (localStorage
  // über die fehlertolerante safeLocalStorage-Grenze); ein gespeicherter Fremd-/Altwert fällt sicher
  // auf den Standard „Relevanz" (= bisherige Reihenfolge) zurück.
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
  // FR-LIF-04: Autor in jeder KO-Zeile sichtbar (Namen via Directory, Fallback ID).
  const dir = useDirectory();
  const nameOf = (uid: string): string => dir.data?.find((d) => d.id === uid)?.name || uid;
  // SCRUM-357 / AG-14: Konfliktliste für die ehrliche „conflict-limited"-Reife je Treffer.
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

  // Match-Grund → kompaktes, ehrliches Label (kein „semantisch", keine Fake-Treffer).
  const matchLabel = (field: MatchField): string => t(`lib.match.${field}`);

  const qc = useQueryClient();
  const { push } = useToast();
  // SCRUM-136: Re-Validierung über den vorhandenen KO-/Lifecycle-Pfad (revalidate).
  // Pedi 02.07. (mehrfach gewünscht): Löschen DIREKT in der Bibliothek — für Autor oder
  // Controller/Admin, mit Inline-Bestätigung (kein confirm()). Backend-Regel existiert
  // seit v0.9.12 (DELETE /api/kos/:id prüft Autor-oder-ko.validate serverseitig).
  const { role } = useRole();
  const { user } = useSession();
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
    // (Anzeigestatus „pruefung") nicht still aus der Sicht fallen. Die reine Migrationslogik lebt
    // testbar in libraryFacets (migrateSavedFacetSelection).
    // AUFTRAG-uxpol5 · Punkt 1: die (entfernte) Status-Facette treffermengentreu auf die sichtbare
    // Reife-Dimension falten — sonst filterte eine alte Status-Sicht „versteckt aktiv" (ohne Pille).
    setFacetSel(foldStatusIntoMaturity(migrateSavedFacetSelection(view.state)));
    setGroupBy(
      LIBRARY_GROUP_KEYS.includes(s.groupBy as LibraryGroupKey)
        ? (s.groupBy as LibraryGroupKey)
        : "none",
    );
    setActiveView(view.name);
  };
  const currentViewState = (): Record<string, unknown> => ({
    q,
    facetSel,
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

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        kicker={t("lib.kicker")}
        title={t("nav.library")}
        actions={
          <div className="flex items-center gap-2">
            <HelpTip title={t("lib.help.filters.title")} body={t("lib.help.filters.body")} />
            <Link to="/import">
              <Button variant="ghost">{t("lib.reimport")}</Button>
            </Link>
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
              <Button>
                <Download size={15} />
                {t("lib.export")}
              </Button>
            </a>
          </div>
        }
      />
      {/* SCRUM-291: Demo-/Pilotpfad auf der Zielseite wiedererkennbar (nur bei ?demo=stage1). */}
      {isDemoContext(params) ? <DemoBanner surface="library" /> : null}
      {/* AUFTRAG-uxpol1 (PAKET 1): NUR noch die Volltextsuche steht oben — alle Dimensionen (Art/
          Status/Kategorie/Tag/Reife/Herkunft/…) erscheinen GENAU EINMAL als dynamische Facetten in
          der Filterleiste unten (kein Dropdown-oben/Chip-unten-Doppel mehr). */}
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("lib.search")}
          className="h-10 min-w-[12rem] flex-1 rounded-input border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
        />
      </div>
      {/* D-BIB (nacht24): gespeicherte Sichten — benannt, lokal je Nutzer (nur dieser Browser). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
          {t("lib.views.label")}:
        </span>
        {savedViews.length > 0 ? (
          <select
            aria-label={t("lib.views.label")}
            value={activeView}
            onChange={(e) => {
              const view = savedViews.find((v) => v.name === e.target.value);
              if (view) {
                applyView(view);
              } else {
                setActiveView("");
              }
            }}
            className="h-9 rounded-input border border-hairline bg-surface px-2 text-[12.5px] text-text outline-none focus:border-ink/30"
          >
            <option value="">{t("lib.views.pick")}</option>
            {savedViews.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        ) : null}
        <input
          value={viewName}
          onChange={(e) => setViewName(e.target.value)}
          placeholder={t("lib.views.namePlaceholder")}
          aria-label={t("lib.views.namePlaceholder")}
          className="h-9 w-44 rounded-input border border-hairline bg-surface px-2 text-[12.5px] text-text outline-none placeholder:text-muted-2 focus:border-ink/30"
        />
        <Button
          variant="ghost"
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
        >
          {t("lib.views.save")}
        </Button>
        {activeView ? (
          <Button
            variant="ghost"
            onClick={() => {
              setSavedViews(removeLibraryView(window.localStorage, viewsUserId, activeView));
              setActiveView("");
            }}
          >
            {t("lib.views.remove")}
          </Button>
        ) : null}
        <span className="text-[10.5px] text-muted-2">{t("lib.views.localHint")}</span>
      </div>
      {/* SCRUM-460 (VIP): Suche liefert nicht nur „dumme" Treffer — bei aktiver Suche eine echte,
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
              {guide.items.map((item) => (
                <Link
                  key={item.id}
                  to={item.to}
                  className="inline-flex items-start gap-2 rounded-btn border border-hairline bg-surface px-2.5 py-2 hover:border-ink/30"
                >
                  <span
                    className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${GUIDE_TONE[item.tone]}`}
                  >
                    {t(item.labelKey)}
                  </span>
                  <span className="max-w-[18rem] text-[12px] leading-relaxed text-muted">
                    {t(item.bodyKey)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <QueryState
        query={query}
        emptyText={trimmedQ ? t("lib.emptyQuery", { q: trimmedQ }) : t("lib.empty")}
        // WP-SHIP9-S2 Paket 4 (W3): der generische Erststart-Block erscheint NUR bei wirklich leerem
        // Bestand (kein einziges KO). Bei 0 Treffern mit aktiver Suche/Filtern (Bestand > 0) bleibt es
        // bei der ehrlichen Treffer-Meldung — kein „Erfasse den ersten Beitrag" trotz vorhandener KOs.
        // all.data noch undefiniert (lädt) ⇒ nicht als leer werten (kein Erststart-Aufblitzen).
        emptyExtra={
          (all.data?.length ?? -1) === 0 ? <EmptyStateCtas context="library" /> : undefined
        }
      >
        {(items) => {
          // SCRUM-245: client-seitig nach nachvollziehbarer Relevanz re-ranken (verwirft nichts).
          const ranked = searchLibrary(items, trimmedQ);
          // AUFTRAG-uxpol1 (PAKET 1): EINE dynamische Facetten-Leiste über ALLE Dimensionen. Die
          // Werte je KO kommen aus der je Datenlauf memoisierten Ableitung (facetBase) — nur Lookups
          // je Render. buildFacetGroups rechnet die Kontext-Zähler + graut 0-Optionen aus.
          const valuesOf = (item: { ko: { id: string } }) => facetBase.get(item.ko.id) ?? {};
          const groups = buildFacetGroups(ranked.map(valuesOf), LIBRARY_FILTER_CONFIGS, facetSel);
          const faceted = applyFacetSelection(ranked, valuesOf, facetSel);
          // AUFTRAG-sortfilter · Punkt 1: die gefilterte Treffermenge sortieren (komponiert mit den
          // Facetten). Bei aktiven Untergruppen wirkt die stabile Ordnung INNERHALB jeder Gruppe, weil
          // groupByFacet die Reihenfolge in die Buckets mitnimmt (Gruppen-Reihenfolge bleibt nach Größe).
          const sorted = sortLibrary(faceted, sortKey, (item) => item.ko);
          // SCRUM-158: erst danach fenstern + zählen (Count-Linie passt zur sichtbaren Menge).
          const win = windowList(sorted);
          // Beta Own-Knowledge Work Queue v0: Zahl der eigenen (nicht-Demo) Treffer im vollen Bestand
          // — für den ehrlichen Leerzustand der „Eigenes Wissen"-Linse (facetSel.origin === non-demo).
          const nonDemoCount = countByDemoKnowledge(ranked)["non-demo"];
          // AUFTRAG-uxpol2: Herkunft ist jetzt eine Wertemenge — der „Eigenes Wissen"-Leerzustand
          // greift nur bei einer EINDEUTIGEN Demo/Nicht-Demo-Linse (gemischte Auswahl → „all").
          const originValues = facetSelectedValues(facetSel.origin);
          const originSel =
            originValues.length === 1 &&
            (originValues[0] === "demo" || originValues[0] === "non-demo")
              ? originValues[0]
              : "all";
          return (
            <>
              {/* AUFTRAG-uxpol1 (PAKET 1): EINE dynamische Filterleiste für ALLE Dimensionen —
                  Aktive-Filter-Pillen + Reset, Kontext-Zähler je Option, 0-Optionen ausgegraut,
                  Trefferzeile „N von GESAMT". Reife/Herkunft/Status/Kategorie/Art/… sind hier je
                  GENAU EINMAL vertreten (keine Dropdown-oben/Chip-unten-Dopplung mehr). */}
              <FacetFilter
                configs={LIBRARY_FILTER_CONFIGS}
                groups={groups}
                selection={facetSel}
                secondaryKeys={LIBRARY_SECONDARY_FACET_KEYS}
                moreStorageKey={LIBRARY_MORE_FILTERS_STORAGE_KEY}
                total={ranked.length}
                shown={faceted.length}
                onToggle={(key, value) => setFacetSel((s) => toggleFacetValue(s, key, value))}
                onReset={() => setFacetSel(clearFacetSelection())}
                onClearGroup={(key) =>
                  setFacetSel((s) => {
                    // AUFTRAG-uxpol4: eine No-Match-Pille abwählen ⇒ die ganze Dimension lösen
                    // (strukturell, ohne echten Wert) — kein Marker verbleibt in der Auswahl.
                    const next = { ...s };
                    delete next[key];
                    return next;
                  })
                }
                labelForValue={facetValueLabel}
              />
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
                  onChange={(e) => setSortKey(e.target.value as (typeof LIBRARY_SORT_KEYS)[number])}
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
              {/* Beta Own-Knowledge Work Queue v0: ehrlicher Leerzustand für die „Eigenes Wissen"-Linse
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
                    <Link
                      to={ownEmpty.to}
                      className="mt-2 inline-flex items-center gap-1 rounded-btn bg-ink px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90"
                    >
                      {t(ownEmpty.ctaKey)} <span aria-hidden="true">→</span>
                    </Link>
                  </Card>
                );
              })()}
              {/* AUFTRAG-uxpol1: die Trefferzeile („N von GESAMT") liefert jetzt die FacetFilter-Leiste.
                  Hier bleibt NUR der ehrliche Fenster-Deckel-Hinweis (Anzeige der ersten N von vielen). */}
              {win.limited ? (
                <div className="mb-2 font-mono text-[11px] text-trust-warn-text">
                  {t("lib.showingFirst", { shown: win.shown, total: win.total })}
                </div>
              ) : null}
              {(() => {
                const koRows = (list: typeof win.visible): JSX.Element[] =>
                  list.map(({ ko: k, matches }) => {
                    // SCRUM-262: ehrliche Reife/Nutzbarkeit je Treffer (DOM-freier Helper).
                    const maturity = libraryMaturity(k);
                    // SCRUM-357 / AG-14: ein offener Konflikt begrenzt die Reife ehrlich (ready → in
                    // Prüfung). So wirkt ein validiertes KO mit offenem Truth-Konflikt NICHT „nutzbar".
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
                              <KnowledgeTypeTag type={k.type} />
                            </span>
                            <KoAuthorLine {...koAuthorParts(k, nameOf)} />
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
                          {/* WP-UX-WOW-1 U4: „Validiert" neben einer 0-Leiste verwirrt Laien —
                              validiert + Trust 0 bekommt statt der leeren Leiste den nüchternen
                              Hinweis (Tooltip erklärt Trust); die Leiste erst ab Trust > 0. */}
                          {deriveStatus(k) === "validiert" && k.trust === 0 ? (
                            <span
                              title={t("lib.trustNoneHint")}
                              className="hidden text-[11px] text-muted-2 sm:block"
                            >
                              {t("lib.trustNone")}
                            </span>
                          ) : (
                            <div className="hidden sm:block">
                              <ConfidenceBar value={k.confidence} showLabel={false} />
                            </div>
                          )}
                        </Link>
                        {/* SCRUM-288: nur nutzbares/validiertes Wissen direkt in Ask; offene KOs → Review.
                            SCRUM-294: im Demo-Kontext den Use-Fluss-Kontext weitertragen. */}
                        <Link
                          to={demoHref(useCta.href, params)}
                          title={t(useCta.labelKey)}
                          className={`inline-flex shrink-0 items-center gap-1 rounded-btn border px-2.5 py-1 text-[12px] font-semibold hover:text-text ${
                            useCta.kind === "ask"
                              ? "border-ink bg-ink text-white hover:text-white"
                              : "border-hairline text-muted"
                          }`}
                        >
                          {t(useCta.labelKey)}
                        </Link>
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
                              <span className="text-[12px] font-semibold text-text">
                                {t("ko.deleteQ")}
                              </span>
                              <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                                {t("ko.deleteKeep")}
                              </Button>
                              <Button
                                variant="outline"
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
            </>
          );
        }}
      </QueryState>
    </div>
  );
}

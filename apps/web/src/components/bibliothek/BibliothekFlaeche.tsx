import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useConflicts, useKos, useLibrarySearch } from "../../api/hooks";
import { useSession } from "../../app/AuthContext";
import { auffrischungGescheitert, vertraulichkeitsAuskunft } from "../../lib/confidentiality";
import { conflictImpact } from "../../lib/conflictImpact";
import { countByDemoKnowledge, ownKnowledgeEmptyHint } from "../../lib/demoKnowledge";
import { isDemoContext } from "../../lib/demoPilotPath";
import { deriveStatus } from "../../lib/displayStatus";
import {
  type FacetGroupConfig,
  clearFacetSelection,
  isAnyFacetActive,
} from "../../lib/facetFilter";
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
} from "../../lib/facetRail";
import {
  type FacetSelection,
  type FacetValues,
  applyFacetSelection,
  facetSelectedValues,
  toggleFacetValue,
} from "../../lib/facets";
import { LIBRARY_RESULT_LIMIT, windowList } from "../../lib/libraryDisplay";
import { EXPORT_FORMATS, exportFilename, exportUrl } from "../../lib/libraryExport";
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
} from "../../lib/libraryFacets";
import {
  ALLE_INHALTE_LABEL,
  DEFAULT_LIBRARY_SCOPE,
  LIBRARY_SCOPE_PARAM,
  type LibraryScope,
  MEINE_ABLAGE_LABEL,
  SCOPE_BAR_LABEL,
  applyLibraryScope,
  parseLibraryScope,
} from "../../lib/libraryOwnScope";
import { EMPTY_LIBRARY_FILTER, buildLibraryQuery } from "../../lib/libraryQuery";
import { type MatchField, searchLibrary } from "../../lib/librarySearch";
import {
  DEFAULT_LIBRARY_SORT,
  LIBRARY_SORT_KEYS,
  LIBRARY_SORT_LABEL_KEYS,
  LIBRARY_SORT_STORAGE_KEY,
  koChangedMs,
  sortLibrary,
} from "../../lib/librarySort";
import {
  facetSelectionFromParams,
  knownFacetValues,
  pruneFacetSelectionToKnownValues,
  serializeFacetSelection,
  writeFacetSelectionToParams,
} from "../../lib/libraryUrlFilters";
import { useAuthorName } from "../../lib/useAuthorName";
import { LIBRARY_SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../lib/useDebouncedValue";
import { usePersistentEnum } from "../../lib/usePersistentValue";
import { useReadiness } from "../../lib/useReadiness";
import { DemoBanner } from "../DemoBanner";
import { RoleLink } from "../RoleLink";
import { cx } from "../ui";
import { AuffrischungHinweis } from "./AuffrischungHinweis";
import { BibliothekLesen } from "./BibliothekLesen";
import { type BibListenPosten, BibliothekListe } from "./BibliothekListe";
import { Menue, MenuePunkt, MenueTrenner, MenueUntermenue, MenueZeile } from "./Menue";
import {
  BIB_SEGMENT_STANDARD,
  type BibSegment,
  bibSegmentAus,
  passtZuSegment,
  zustandsTon,
} from "./zustand";

// Der Umschalter in der Adresse — kurz und lesbar, weil der Link geteilt wird.
const SEGMENT_PARAM = "zustand";

// ==================================================================================================
// JOB 3063 · H4 — DIE BIBLIOTHEK ALS EINE FLÄCHE: LISTE LINKS, EINTRAG RECHTS.
// ==================================================================================================
//
// Diese Datei ist der Nachfolger der Trefferwand aus `pages/Library.tsx` UND der Detailseite mit
// dreizehn Karten aus `pages/KnowledgeDetail.tsx`. Beide Seiten rendern jetzt DIESE Fläche; der
// Unterschied ist ein Prop (`vorgewaehlt`), nicht ein zweiter Aufbau.
//
// WAS AUS DEM SICHTFELD VERSCHWUNDEN IST — und wohin (Auftrag §5a):
//   Facettenwand (10 Dimensionen)   → Menü „Filter"  (je Facette ein Untermenü)
//   Abteilung/Kategorie             → Menü „Bereich"
//   Status                          → Umschalter Alle · Validiert · Offen
//   Sortierung + Untergruppen       → Menü „Filter" → Sortieren / Untergruppen
//   Gespeicherte Sichten            → Menü „…" → Sichten
//   Export (4 Formate) + Re-Import  → Menü „…"
//   Geltungsbereich (JOB 381)       → Menü „Filter" → Geltungsbereich
//   „Weitere N laden"               → Nachladen beim Scrollen ans Listenende
//   Karte „Antwort statt nur …?"    → Knopf „Fragen" auf der Lesefläche
//   Kicker, Hilfe-Tipps, Reife-Erklärbox, Bestandssatz → ERSATZLOS (Pedi 04.09.: Erklärtext gehört
//                                     nicht ins Sichtfeld; die Wahl im Menü sagt dasselbe ohne Satz)
//
// Die Filter-, Such-, Sortier- und Geltungsbereichslogik ist UNVERÄNDERT übernommen (dieselben
// Helfer aus `lib/`), nur ihre Bedienfläche ist eine andere. Ein zweiter Filterweg entsteht nicht.

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
const LIBRARY_FACET_DEPENDENCIES = [{ parent: "category", child: "tag" }] as const;
const LIBRARY_FACET_PARAM_KEYS: readonly string[] = LIBRARY_FILTER_CONFIGS.map((c) => c.key);
const LIBRARY_RANGE_FROM_PARAM = "von";
const LIBRARY_RANGE_TO_PARAM = "bis";
// Der Bereich („Abteilung/Kategorie") bekommt ein EIGENES Menü — er ist die Dimension, nach der in
// der Vorlage zuerst gegriffen wird. Im Filter-Menü steht er deshalb nicht ein zweites Mal.
const BEREICH_KEY = "category";

export function BibliothekFlaeche({
  vorgewaehlt,
  beiWahl,
  beiLoeschung,
}: {
  /** Kennung aus `/wissen/:id` — die Fläche startet mit diesem Eintrag rechts. */
  vorgewaehlt?: string | undefined;
  /** Nur die Detailroute schreibt die Adresse fort; auf `/bibliothek` wechselt allein die Fläche. */
  beiWahl?: ((id: string) => void) | undefined;
  /** Nur die Detailroute muss die Adresse verlassen, wenn ihr Eintrag gelöscht wurde. */
  beiLoeschung?: (() => void) | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const { user } = useSession();
  const nameOf = useAuthorName();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [facetSel, setFacetSel] = useState<FacetSelection>({});
  const [urlSeed, setUrlSeed] = useState<FacetSelection | null>(() =>
    facetSelectionFromParams(params, LIBRARY_FACET_PARAM_KEYS),
  );
  const [range, setRange] = useState<FacetRange>(() =>
    facetRangeFromParams(params, LIBRARY_RANGE_FROM_PARAM, LIBRARY_RANGE_TO_PARAM),
  );
  const [railUi, setRailUi] = useState<FacetRailUiState>(EMPTY_RAIL_UI);
  const [windowLimit, setWindowLimit] = useState(LIBRARY_RESULT_LIMIT);
  const [groupBy, setGroupBy] = useState<LibraryGroupKey>("none");
  const [sortKey, setSortKey] = usePersistentEnum(
    LIBRARY_SORT_STORAGE_KEY,
    LIBRARY_SORT_KEYS,
    DEFAULT_LIBRARY_SORT,
  );
  // Die getroffene Wahl. Was RECHTS steht, leitet sich unten daraus ab — ohne zweiten Effekt, damit
  // ein Deep-Link (`/wissen/:id`) auf einen gefilterten oder noch nicht geladenen Eintrag trotzdem
  // trägt (er ist dann nicht in der Liste, aber sehr wohl die Wahl).
  const [gewaehlt, setGewaehlt] = useState<string | null>(vorgewaehlt ?? null);
  const scope = parseLibraryScope(params.get(LIBRARY_SCOPE_PARAM));
  // Der Umschalter steht in der Adresse, nicht in einem zweiten Zustand daneben — dieselbe
  // Entscheidung wie beim Geltungsbereich (JOB 381): die Adresse IST der Speicher.
  const segment = bibSegmentAus(params.get(SEGMENT_PARAM));
  const setSegment = (next: BibSegment): void => {
    resetWindow();
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === BIB_SEGMENT_STANDARD) {
          // Der Standard steht NICHT in der Adresse — sonst sähe er wie eine getroffene Wahl aus.
          p.delete(SEGMENT_PARAM);
        } else {
          p.set(SEGMENT_PARAM, next);
        }
        return p;
      },
      { replace: true },
    );
  };

  // AUFTRAG-mega9 E-2 / mega11 C: Facetten ⇄ URL, unverändert übernommen — inklusive der
  // zweistufigen Prüfung des URL-Eingangs gegen den Bestand.
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

  const all = useKos();
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

  const conflicts = useConflicts();
  const debouncedQ = useDebouncedValue(q, LIBRARY_SEARCH_DEBOUNCE_MS);
  const query = useLibrarySearch(buildLibraryQuery({ ...EMPTY_LIBRARY_FILTER, q: debouncedQ }));
  const trimmedQ = q.trim();

  const facetBase = useMemo(() => {
    const now = Date.now();
    return new Map((query.data ?? []).map((k) => [k.id, libraryFilterValues(k, now)]));
  }, [query.data]);

  // Gespeicherte Sichten — LOKAL je Nutzer, unverändert (kein Server-Speicher).
  const viewsUserId = user?.id ?? "anon";
  const [savedViews, setSavedViews] = useState<LibrarySavedView[]>([]);
  const [viewName, setViewName] = useState("");
  const [activeView, setActiveView] = useState("");
  useEffect(() => {
    setSavedViews(readLibraryViews(window.localStorage, viewsUserId));
  }, [viewsUserId]);

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

  const koItems = applyLibraryScope(query.data ?? [], scope, user?.id);
  const ranked = searchLibrary(koItems, trimmedQ);
  const valuesOf = (item: { ko: { id: string } }): FacetValues => facetBase.get(item.ko.id) ?? {};
  const facetItems = ranked.map(valuesOf);
  const groups = facetRailGroups(
    facetItems,
    LIBRARY_FILTER_CONFIGS,
    facetSel,
    railUi,
    facetValueLabel,
    LIBRARY_FACET_DEPENDENCIES,
  );
  const faceted = applyFacetSelection(ranked, valuesOf, facetSel)
    .filter((item) => matchesFacetRange(koChangedMs(item.ko), range))
    // Der Umschalter wirkt wie jede andere Wahl: UND, auf demselben abgeleiteten Anzeigestatus,
    // den auch Punkt und Pille zeigen — keine zweite Statusrechnung.
    .filter((item) => passtZuSegment(deriveStatus(item.ko), segment));
  const sorted = sortLibrary(faceted, sortKey, (item) => item.ko);
  const win = windowList(sorted, windowLimit);

  const resetWindow = (): void => setWindowLimit(LIBRARY_RESULT_LIMIT);
  const onToggleFacet = (key: string, value: string): void => {
    resetWindow();
    setFacetSel((prev) =>
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
    setSegment(BIB_SEGMENT_STANDARD);
  };
  const setScope = (next: LibraryScope): void => {
    resetWindow();
    setParams(
      (prev) => {
        const nextParams = new URLSearchParams(prev);
        if (next === DEFAULT_LIBRARY_SCOPE) {
          nextParams.delete(LIBRARY_SCOPE_PARAM);
        } else {
          nextParams.set(LIBRARY_SCOPE_PARAM, next);
        }
        return nextParams;
      },
      { replace: true },
    );
  };
  const applyView = (view: LibrarySavedView): void => {
    const s = view.state as { q?: string; groupBy?: string };
    setQ(s.q ?? "");
    setFacetSel(foldStatusIntoMaturity(migrateSavedFacetSelection(view.state)));
    setRange(facetRangeFromSaved(view.state));
    setGroupBy(
      LIBRARY_GROUP_KEYS.includes(s.groupBy as LibraryGroupKey)
        ? (s.groupBy as LibraryGroupKey)
        : "none",
    );
    resetWindow();
    setActiveView(view.name);
  };

  // ---- Zustandsmodell der Liste ----------------------------------------------------------------
  // „frisch" heißt: es LIEGEN Daten vor (react-query setzt `data` nur nach einem erfolgreichen
  // Abruf), und die Auffrischung ist weder gescheitert (`isRefetchError`) noch offline pausiert
  // (`fetchStatus === "paused"`). Nur dann trägt der Zähler eine Zahl; sonst „–" (Auftrag §9).
  //
  // Die LISTE bleibt in beiden Fällen stehen: Ein leergeräumter Cache wäre der schlechtere
  // Rückschritt (REGELN §7 — die zuletzt erfolgreich geholten Werte bleiben sichtbar). Was NICHT
  // stehen bleibt, ist die ZAHL: sie ist eine Aussage über den Bestand JETZT, und die trägt ein
  // alter Cache nicht.
  const frisch =
    query.data !== undefined && !query.isRefetchError && query.fetchStatus !== "paused";

  const zeileAus = (ko: (typeof win.visible)[number]["ko"]): BibListenPosten => {
    const status = deriveStatus(ko);
    // Ohne geladene Konfliktliste entsteht KEINE Konfliktaussage — ein fehlendes rotes Signal
    // behauptet nichts, ein erfundenes schon (JOB 3025).
    const impact = conflictImpact(ko.id, conflicts.data ?? []);
    // JOB 3034: die Vertraulichkeitsstufe im Klartext — in der Trefferzeile stand sie vorher GAR
    // NICHT; wer eine Zeile ansah, erfuhr über die Vertraulichkeit nichts. Dieselbe Funktion wie
    // auf der Lesefläche (`vertraulichkeitsAuskunft`), keine zweite Auslegung derselben Aussage.
    const auskunft = vertraulichkeitsAuskunft(ko);
    return {
      art: "eintrag",
      id: ko.id,
      titel: ko.title,
      bereich: ko.category,
      zustandWort: impact.limited ? t("status.konflikt") : t(`status.${status}`),
      ton: zustandsTon(status, impact.limited),
      stufe: { labelKey: auskunft.labelKey, tone: auskunft.tone },
    };
  };

  const posten: BibListenPosten[] =
    groupBy === "none"
      ? win.visible.map((i) => zeileAus(i.ko))
      : groupByFacet(win.visible, (item) => facetBase.get(item.ko.id) ?? {}, groupBy).flatMap(
          (g) => [
            {
              art: "gruppe" as const,
              id: `g:${g.value || "—"}`,
              titel: facetValueLabel(groupBy, g.value),
              anzahl: g.items.length,
            },
            ...g.items.map((i) => zeileAus(i.ko)),
          ],
        );

  // ---- Auswahl: eine reine Ableitung, kein zweiter Zustand -------------------------------------
  const sichtbareIds = win.visible.map((i) => i.ko.id);
  const gewaehltEffektiv =
    gewaehlt !== null && (sichtbareIds.includes(gewaehlt) || gewaehlt === vorgewaehlt)
      ? gewaehlt
      : (vorgewaehlt ?? sichtbareIds[0] ?? null);
  // Nur die Adresse darf die Wahl von außen setzen (Deep-Link, Zurück-Knopf).
  useEffect(() => {
    if (vorgewaehlt) {
      setGewaehlt(vorgewaehlt);
    }
  }, [vorgewaehlt]);
  const waehle = (id: string): void => {
    setGewaehlt(id);
    beiWahl?.(id);
  };
  const trefferFelder: readonly MatchField[] =
    win.visible.find((i) => i.ko.id === gewaehltEffektiv)?.matches ?? [];

  // Beta Own-Knowledge Work Queue v0: die Linse „Eigenes Wissen" (Herkunftsfacette) mit null
  // eigenen Treffern bekommt denselben Weg wie bisher — nur als Knopf im Leerzustand statt als
  // eigene Karte mit Titel und Hinweis.
  const originValues = facetSelectedValues(facetSel.origin);
  const originSel =
    originValues.length === 1 && (originValues[0] === "demo" || originValues[0] === "non-demo")
      ? originValues[0]
      : "all";
  const ownEmpty = ownKnowledgeEmptyHint({
    filter: originSel,
    count: countByDemoKnowledge(ranked)["non-demo"],
  });

  // Die Zahl am Menü „Filter" zählt, was IM Menü steht. Der Geltungsbereich steht seit der
  // Ortszeile sichtbar auf der Seite; ihn mitzuzählen ergäbe ein „Filter · 1", nach dessen Öffnen
  // nichts gewählt wäre — eine Zahl, die auf nichts zeigt.
  const aktiveFilterZahl =
    (isAnyFacetActive(facetSel) ? 1 : 0) +
    (isFacetRangeActive(range) ? 1 : 0) +
    (segment === BIB_SEGMENT_STANDARD ? 0 : 1) +
    (groupBy === "none" ? 0 : 1);
  // „Diese Suche merken" hängt dagegen an JEDER getroffenen Wahl — der Geltungsbereich gehört in
  // eine gemerkte Sicht, also auch in diese Bedingung.
  const anyFilterActive =
    trimmedQ.length > 0 || aktiveFilterZahl > 0 || scope !== DEFAULT_LIBRARY_SCOPE;
  const bereichGruppe = groups.find((g) => g.key === BEREICH_KEY);
  const bereichGewaehlt = facetSelectedValues(facetSel[BEREICH_KEY]);

  return (
    <div data-testid="bibliothek-flaeche" className="flex h-[calc(100vh-12rem)] min-h-[30rem]">
      <BibliothekListe
        q={q}
        onQ={(wert) => {
          resetWindow();
          setQ(wert);
        }}
        ortszeile={
          // ======================================================================================
          // JOB 381 · DIE ORTSZEILE — WORIN WIRD GERADE GESUCHT (H4: als ruhige Zeile über der Liste).
          // ======================================================================================
          //
          // Sie steht auf der SEITE und nie in einem Menü: der Geltungsbereich ist kein Filter,
          // sondern die Angabe des BESTANDS, auf den sich Suche, Umschalter und Filter erst
          // beziehen („Die Schiene filtert, die Kopfzeile sucht", `R-19`). Läge er im Filtermenü,
          // wäre die durchsuchte Menge nur nach dem Öffnen eines Menüs ablesbar — genau das
          // Übersehen-Risiko, gegen das `tests-smoke/wissensraum381-ortszeile-browser.spec.ts`
          // geschrieben ist.
          //
          // Zwei echte `button[aria-pressed]`, nie ein Auswahlmenü — auch auf schmalen Geräten
          // nicht (`R-19`): ein `select` zeigte den gewählten Bestand erst beim Öffnen.
          //
          // KEIN ERKLÄRSATZ: die Gruppe trägt ihren Namen über `aria-label` am `fieldset` (die im
          // Haus getroffene Entscheidung gegen einen ARIA-Nachbau, s. `bib-segment` daneben) —
          // sichtbar stehen nur die beiden Beschriftungen. Der Textmesser
          // (`tests/design/zielbild-h4-kein-erklaertext.test.ts`) zählt deshalb null Zeichen hinzu.
          //
          // Die Reihenfolge „Meine Ablage" vor „Alle Inhalte" ist Pedis Entscheidung
          // (`ENTSCHEIDUNGEN/JOB-381-ORTSZEILE.md`), nicht Geschmack.
          <div
            data-testid="library-scope-bar"
            data-raum={scope}
            className="flex items-center justify-between gap-2"
          >
            <fieldset
              aria-label={SCOPE_BAR_LABEL}
              className="flex min-w-0 items-center gap-1 border-0 p-0"
            >
              {(
                [
                  { wert: "meine", label: MEINE_ABLAGE_LABEL },
                  { wert: "alle", label: ALLE_INHALTE_LABEL },
                ] satisfies { wert: LibraryScope; label: string }[]
              ).map((e) => {
                const aktiv = scope === e.wert;
                return (
                  <button
                    key={e.wert}
                    type="button"
                    aria-pressed={aktiv}
                    data-testid={`bib-scope-${e.wert}`}
                    onClick={() => setScope(e.wert)}
                    className={cx(
                      "truncate rounded-btn px-1.5 py-0.5 text-[12px] outline-none hover:bg-hairline-soft",
                      aktiv ? "font-semibold text-text" : "text-muted",
                    )}
                  >
                    {e.label}
                  </button>
                );
              })}
            </fieldset>
          </div>
        }
        segment={segment}
        onSegment={setSegment}
        posten={posten}
        gewaehlt={gewaehltEffektiv}
        onWaehle={waehle}
        laedt={query.isLoading}
        // JOB 3034 R2 (nachgezogen): ein gescheiterter ABRUF ohne Bestand ist ein echter Fehler;
        // scheitert nur die AUFFRISCHUNG eines schon geholten Bestands, bleiben die Zeilen stehen
        // und der Hinweis darunter sagt es (REGELN §7 — nie den Bestand wegen eines Folgefehlers
        // leeren).
        fehler={query.isError && query.data === undefined}
        // Die Bauform steht in `AuffrischungHinweis` (EINE Stelle für Liste und Lesefläche); die
        // Lage fragt die Liste hier ab, damit sie ohne den Fall auch keinen leeren Platz hält.
        hinweis={auffrischungGescheitert(query) ? <AuffrischungHinweis query={query} /> : null}
        onErneut={() => void query.refetch()}
        gesamt={frisch ? sorted.length : null}
        onNachladen={() => {
          if (win.limited) {
            setWindowLimit((n) => n + LIBRARY_RESULT_LIMIT);
          }
        }}
        leerAktion={
          <RoleLink
            // Beta Own-Knowledge Work Queue v0: unter der Linse „Eigenes Wissen" führt der Knopf
            // dorthin, wo eigenes Wissen entsteht — dieselbe Regel wie bisher, nur ohne die Karte
            // mit zwei Erklärsätzen darüber.
            to={ownEmpty ? ownEmpty.to : "/erfassen"}
            className="inline-flex items-center gap-1 rounded-btn border border-hairline px-2.5 py-1 text-[12.5px] font-semibold text-text"
            hoverClassName="hover:bg-hairline-soft"
            testId="bib-leer-erfassen"
          >
            {() => t("lib.liste.erfassen")}
          </RoleLink>
        }
        menues={{
          punkte: (
            <Menue
              beschriftung="…"
              ariaLabel={t("lib.menue.weitere")}
              testId="bib-liste-menue"
              ausrichtung="rechts"
              breite="w-[250px]"
            >
              {(schliessen) => (
                <>
                  <MenueUntermenue beschriftung={t("lib.menue.sichten")}>
                    {savedViews.map((v) => (
                      <MenuePunkt
                        key={v.name}
                        haken={activeView === v.name}
                        onClick={() => {
                          applyView(v);
                          schliessen();
                        }}
                      >
                        {v.name}
                      </MenuePunkt>
                    ))}
                    {activeView ? (
                      <MenuePunkt
                        onClick={() => {
                          setSavedViews(
                            removeLibraryView(window.localStorage, viewsUserId, activeView),
                          );
                          setActiveView("");
                          schliessen();
                        }}
                      >
                        {t("lib.views.remove")}
                      </MenuePunkt>
                    ) : null}
                  </MenueUntermenue>
                  {anyFilterActive ? (
                    <MenueUntermenue beschriftung={t("lib.menue.sichtSpeichern")}>
                      <MenueZeile>
                        <span className="flex items-center gap-1.5">
                          <label htmlFor="bib-sichtname" className="sr-only">
                            {t("lib.views.namePlaceholder")}
                          </label>
                          <input
                            id="bib-sichtname"
                            value={viewName}
                            onChange={(e) => setViewName(e.target.value)}
                            placeholder={t("lib.views.namePlaceholder")}
                            className="min-w-0 flex-1 rounded-input border border-hairline bg-surface px-1.5 py-0.5 text-[12px]"
                          />
                          <button
                            type="button"
                            data-testid="bib-sicht-speichern"
                            disabled={viewName.trim().length === 0}
                            onClick={() => {
                              const name = viewName.trim();
                              setSavedViews(
                                saveLibraryView(window.localStorage, viewsUserId, {
                                  name,
                                  state: { q, facetSel, range, groupBy },
                                }),
                              );
                              setActiveView(name);
                              setViewName("");
                              schliessen();
                            }}
                            className="shrink-0 rounded-btn border border-hairline px-2 py-0.5 text-[12px] font-semibold text-text disabled:opacity-45"
                          >
                            {t("lib.views.remember")}
                          </button>
                        </span>
                      </MenueZeile>
                    </MenueUntermenue>
                  ) : null}
                  <MenueTrenner />
                  <MenueUntermenue beschriftung={t("lib.export")}>
                    {EXPORT_FORMATS.map((fmt) => (
                      <MenueZeile key={fmt}>
                        <a
                          href={exportUrl(fmt)}
                          download={exportFilename(fmt)}
                          data-testid={`bib-export-${fmt}`}
                          className="block w-full"
                        >
                          {t(`lib.format.${fmt}`)}
                        </a>
                      </MenueZeile>
                    ))}
                  </MenueUntermenue>
                  <MenueZeile>
                    {/* /import verlangt admin UND Stufe 2 — die gesperrte Fassung bleibt ein Wort,
                        kein Weg (mega70 B). */}
                    <RoleLink to="/import" className="block w-full" testId="bib-import">
                      {() => t("lib.reimport")}
                    </RoleLink>
                  </MenueZeile>
                </>
              )}
            </Menue>
          ),
          bereich: (
            <Menue
              beschriftung={t("lib.menue.bereich")}
              zusatz={bereichGewaehlt.length > 0 ? String(bereichGewaehlt.length) : undefined}
              testId="bib-menue-bereich"
              ausrichtung="rechts"
              breite="w-[230px]"
            >
              {() => (
                <>
                  {(bereichGruppe?.options ?? []).map((o) => (
                    <MenuePunkt
                      key={o.value}
                      haken={o.selected}
                      disabled={o.disabled}
                      onClick={() => onToggleFacet(BEREICH_KEY, o.value)}
                    >
                      {`${facetValueLabel(BEREICH_KEY, o.value)} · ${o.count}`}
                    </MenuePunkt>
                  ))}
                  {bereichGruppe && bereichGruppe.hiddenCount > 0 ? (
                    <MenuePunkt
                      onClick={() =>
                        setRailUi((p) => ({
                          ...p,
                          showAll: { ...p.showAll, [BEREICH_KEY]: true },
                        }))
                      }
                    >
                      {t("facet.showAll", { n: bereichGruppe.totalCount })}
                    </MenuePunkt>
                  ) : null}
                </>
              )}
            </Menue>
          ),
          filter: (
            <Menue
              beschriftung={t("lib.menue.filter")}
              zusatz={aktiveFilterZahl > 0 ? String(aktiveFilterZahl) : undefined}
              testId="bib-menue-filter"
              ausrichtung="rechts"
              breite="w-[270px]"
            >
              {() => (
                <>
                  <MenueUntermenue beschriftung={t("lib.sort.label")}>
                    {LIBRARY_SORT_KEYS.map((key) => (
                      <MenuePunkt key={key} haken={sortKey === key} onClick={() => setSortKey(key)}>
                        {t(LIBRARY_SORT_LABEL_KEYS[key])}
                      </MenuePunkt>
                    ))}
                  </MenueUntermenue>
                  <MenueUntermenue beschriftung={t("lib.groupBy.label")}>
                    {LIBRARY_GROUP_KEYS.map((key) => (
                      <MenuePunkt
                        key={key}
                        haken={groupBy === key}
                        onClick={() => {
                          resetWindow();
                          setGroupBy(key);
                        }}
                      >
                        {key === "none" ? t("lib.groupBy.none") : t(LIBRARY_FACET_LABEL_KEYS[key])}
                      </MenuePunkt>
                    ))}
                  </MenueUntermenue>
                  {/* Der Geltungsbereich steht NICHT hier: er ist kein Filter, sondern der
                      Bestand, auf den die Filter erst wirken. Sein Ort ist die Ortszeile über dem
                      Suchfeld (`library-scope-bar`, oben) — ein zweiter Ort für dieselbe Sache
                      wäre genau die Doppelung, die dieser Umbau abschafft. */}
                  <MenueTrenner />
                  {/* Jede Facette ein Untermenü — dieselbe Logik, dieselben Kontext-Zähler und
                      dasselbe ehrliche Ausgrauen wie in der abgelösten Schiene. */}
                  {groups
                    .filter((g) => g.key !== BEREICH_KEY)
                    .map((g) => {
                      const gewaehlteWerte = facetSelectedValues(facetSel[g.key]);
                      return (
                        <MenueUntermenue
                          key={g.key}
                          beschriftung={t(g.labelKey)}
                          zusatz={gewaehlteWerte.length > 0 ? String(gewaehlteWerte.length) : ""}
                        >
                          {g.options.map((o) => (
                            <MenuePunkt
                              key={o.value}
                              haken={o.selected}
                              disabled={o.disabled}
                              onClick={() => onToggleFacet(g.key, o.value)}
                            >
                              {`${facetValueLabel(g.key, o.value)} · ${o.count}`}
                            </MenuePunkt>
                          ))}
                          {g.hiddenCount > 0 ? (
                            <MenuePunkt
                              onClick={() =>
                                setRailUi((p) => ({
                                  ...p,
                                  showAll: { ...p.showAll, [g.key]: true },
                                }))
                              }
                            >
                              {t("facet.showAll", { n: g.totalCount })}
                            </MenuePunkt>
                          ) : null}
                        </MenueUntermenue>
                      );
                    })}
                  <MenueUntermenue beschriftung={t("lib.facet.rangeLabel")}>
                    <MenueZeile>
                      <span className="flex items-center gap-1.5">
                        <label htmlFor="bib-von" className="sr-only">
                          {t("facet.rangeFrom")}
                        </label>
                        <input
                          id="bib-von"
                          type="date"
                          value={range.from}
                          onChange={(e) => {
                            resetWindow();
                            setRange({ ...range, from: e.target.value });
                          }}
                          className="w-full rounded-input border border-hairline bg-surface px-1.5 py-0.5 text-[12px]"
                        />
                        <label htmlFor="bib-bis" className="sr-only">
                          {t("facet.rangeTo")}
                        </label>
                        <input
                          id="bib-bis"
                          type="date"
                          value={range.to}
                          onChange={(e) => {
                            resetWindow();
                            setRange({ ...range, to: e.target.value });
                          }}
                          className="w-full rounded-input border border-hairline bg-surface px-1.5 py-0.5 text-[12px]"
                        />
                      </span>
                    </MenueZeile>
                  </MenueUntermenue>
                  {anyFilterActive ? (
                    <>
                      <MenueTrenner />
                      <MenuePunkt testId="bib-filter-reset" onClick={onResetFilters}>
                        {t("facet.reset")}
                      </MenuePunkt>
                    </>
                  ) : null}
                </>
              )}
            </Menue>
          ),
        }}
      />
      <div className="flex min-w-0 flex-1 justify-center overflow-y-auto bg-page">
        <div className="flex min-w-0 flex-col">
          {/* SCRUM-291: Demo-/Pilotpfad bleibt auf der Zielseite wiedererkennbar (nur ?demo=stage1). */}
          {isDemoContext(params) ? <DemoBanner surface="library" /> : null}
          {gewaehltEffektiv ? (
            <BibliothekLesen
              key={gewaehltEffektiv}
              koId={gewaehltEffektiv}
              suchtext={trimmedQ}
              treffer={trefferFelder}
              // Steht der Satz schon an der Liste, schweigt die Lesefläche dazu — s. dort.
              hinweisSchonGesagt={auffrischungGescheitert(query)}
              onGeloescht={() => {
                setGewaehlt(null);
                beiLoeschung?.();
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

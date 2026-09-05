import type { UseQueryResult } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useConflicts, useKos, useLibrarySearch } from "../../api/hooks";
import type { KnowledgeObject } from "../../api/types";
import { useSession } from "../../app/AuthContext";
import { auffrischungGescheitert, vertraulichkeitsAuskunft } from "../../lib/confidentiality";
import { conflictImpact } from "../../lib/conflictImpact";
import { countByDemoKnowledge, ownKnowledgeEmptyHint } from "../../lib/demoKnowledge";
import { isDemoContext } from "../../lib/demoPilotPath";
import {
  type AnzeigestatusAuskunft,
  anzeigestatusAnker,
  anzeigestatusAus,
} from "../../lib/displayStatus";
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

  // ================================================================================================
  // JOB 3072 · N4 — DER ZUSTAND EINES EINTRAGS: EINMAL BESCHAFFT, VIERMAL VERWENDET.
  // ================================================================================================
  //
  // WOHER DIE ERHOBENE AUSKUNFT KOMMT — und warum sie nicht einfach an `query.data` hängt. Die Liste
  // dieser Fläche kommt aus `GET /api/library/search` (`useLibrarySearch` oben). Diese Route reicht
  // die Suchprojektion ungefiltert durch (`services/app/src/routes/library-routes.ts:331-338`) und
  // ERHEBT den Anzeigestatus nicht; erhoben wird er an `GET /api/kos` (`ko-routes.ts:843-847`) und
  // `GET /api/kos/:id` (`:902`). Ein Eintrag aus der Suche trägt das Feld also nie.
  //
  // `useKos` steht in dieser Datei bereits (`all`, für den Facettenabgleich der URL) und teilt sich
  // den Schlüssel `["kos", undefined]` mit der Lesefläche rechts (`BibliothekLesen.tsx:166`) — die
  // Auskunft ist damit KOSTENLOS zu haben, ohne eine einzige zusätzliche Abfrage. Genommen wird das
  // GANZE Objekt aus dieser Antwort und nicht nur das eine Feld: Kern-Enum und erhobene Stufe
  // stammen dann aus EINER Serverantwort und können nicht auseinanderlaufen.
  //
  // OHNE `all.data` (Laden, Fehler) fällt jeder Eintrag auf sein Suchobjekt zurück — `anzeigestatus`
  // fehlt dort, die Auskunft heißt dann `bestand`, und die Fläche sagt genau so viel wie früher.
  // Kein erfundener Zustand, keine leere Karte (REGELN §7).
  //
  // DER MERKER GILT JE OBJEKT, NICHT JE ID (JOB 3072 R2, Befund BEN-1). Die erste Fassung merkte
  // sich das Ergebnis unter `ko.id` — und lag damit auf einem Schlüssel, der WENIGER unterscheidet
  // als die Rechnung darunter: im Rückfallzweig (`?? ko`) hängt die Antwort am SUCHOBJEKT, und die
  // Suche frischt unabhängig vom KO-Bestand auf. Kam sie mit einer neuen Fassung desselben
  // Eintrags zurück, während `all.data` unverändert blieb, stand der neue Titel neben dem alten
  // Zustandswort. Der `WeakMap` über das Objekt trifft genau die Regel, die gemeint war: gleiches
  // Objekt → gleiche Antwort; neues Objekt → neu gerechnet. react-query gibt bei unveränderter
  // Antwort dieselbe Referenz zurück (strukturelles Teilen), die Ersparnis bleibt also erhalten.
  const auskunftFuer = useMemo(() => {
    const erhoben = new Map((all.data ?? []).map((k) => [k.id, k]));
    const konflikte = conflicts.data ?? [];
    // Je Eintrag EINE Rechnung — Wort, Ton, Umschalter und Anker lesen dasselbe Ergebnis.
    const gemerkt = new WeakMap<object, AnzeigestatusAuskunft>();
    return (ko: KnowledgeObject): AnzeigestatusAuskunft => {
      const da = gemerkt.get(ko);
      if (da) {
        return da;
      }
      // Ohne geladene Konfliktliste entsteht KEINE Konfliktaussage — ein fehlendes rotes Signal
      // behauptet nichts, ein erfundenes schon (JOB 3025).
      const neu = anzeigestatusAus(erhoben.get(ko.id) ?? ko, {
        konflikt: conflictImpact(ko.id, konflikte).limited,
      });
      gemerkt.set(ko, neu);
      return neu;
    };
  }, [all.data, conflicts.data]);

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
    // Der Umschalter wirkt wie jede andere Wahl: UND, auf demselben Anzeigestatus, den auch Punkt
    // und Pille zeigen — keine zweite Statusrechnung. Seit JOB 3072 ist das die vom Server erhobene
    // Zahl, und der Umschalter kennt damit auch den Konflikt: ein Eintrag mit rotem Punkt fiel
    // vorher unter „Freigegeben", weil diese Zeile als einzige die Konfliktliste nicht ansah.
    .filter((item) => passtZuSegment(auskunftFuer(item.ko).status, segment));
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
  //
  // ================================================================================================
  // JOB 3072 R2 (Befund BEN-2) — DIESE FLÄCHE STEHT AUF ZWEI ABFRAGEN, ALSO ZÄHLT DIE ÄLTERE.
  // ================================================================================================
  // Bis zu diesem Auftrag war `query` (die Suche) die einzige Quelle der Liste, und das
  // Frischemodell durfte allein auf ihr stehen. Seit dem Anschluss des erhobenen Zustands ist `all`
  // (`GET /api/kos`) eine ZWEITE ANZEIGEQUELLE: aus ihr kommen Wort, Ton, Umschalter — und über den
  // Umschalter auch die Treffermenge, die der Zähler zählt. Beide frischen unabhängig auf.
  //
  // Bliebe das Modell auf `query`, stünde nach einer gescheiterten `all`-Auffrischung ein ALTER
  // Serverzustand mit dem Anker `server` da, der Zähler nennte eine Zahl, und nichts sagte, dass
  // beides nicht mehr frisch ist. Das ist die zeitabhängige Aussage ohne frische Grundlage, die
  // Auftrag §9 und REGELN §7 verbieten. Ab hier gilt deshalb die SCHWÄCHERE der beiden Lagen.
  const quellen: readonly UseQueryResult<unknown>[] = [query, all];
  const frisch =
    query.data !== undefined &&
    quellen.every((q) => !q.isRefetchError && q.fetchStatus !== "paused");

  // ================================================================================================
  // JOB 3072 R4 — ZÄHLER UND HINWEIS FRAGEN VERSCHIEDENES, UND DAS IST DER PUNKT.
  // ================================================================================================
  // Runde 3 hat beide Zeilen auf EINE Regel gezogen („nicht frisch" = gescheitert ODER pausiert) und
  // damit den offline angehaltenen Abruf zum Fehlschlag erklärt. Das Tor hat es gefangen:
  // `tests/vertraulichkeit-klartext/stufe-im-klartext.test.tsx:423`/`:480` (JOB 3034) sichert
  // ausdrücklich zu „eine pausierte Auffrischung ist kein Fehler" — und hat recht, denn offline wird
  // GAR NICHT gerufen (derselbe Test zählt die Rufe, `:419`/`:476`). Nichts ist fehlgeschlagen, also
  // darf nichts „fehlgeschlagen" sagen. Die Unterscheidung ist keine Feinheit, sondern der
  // Unterschied zwischen zwei Aussagen:
  //
  //   ZÄHLER (oben): eine POSITIVE Aussage über den Bestand JETZT. Sie wird in BEIDEN Lagen
  //     zurückgenommen — „–" statt einer Zahl —, denn weder ein gescheiterter noch ein angehaltener
  //     Abruf trägt sie. Schweigen ist immer erlaubt.
  //   HINWEIS (hier): der Satz „Stand von <Zeit> · Auffrischung fehlgeschlagen". Er ist eine
  //     Tatsachenbehauptung ÜBER EIN EREIGNIS, und offline hat dieses Ereignis nicht stattgefunden.
  //     Er steht deshalb allein bei `auffrischungGescheitert` (`isError` mit Bestand).
  //
  // Der Satz nennt den Stand, auf dem die Fläche WIRKLICH steht: den ÄLTESTEN der gescheiterten
  // Quellen. Zwei Sätze nebeneinander wären zwei Auslegungen derselben Tatsache (JOB 3063 R6,
  // deshalb wohnt die Bauform in `AuffrischungHinweis`); der jüngere Stand wäre die zu starke
  // Aussage. Ohne den Fall entsteht nichts — `auffrischungGescheitert` verlangt einen vorhandenen
  // Bestand, und ohne Bestand ist gar kein Serverzustand im Spiel.
  const nichtFrisch = quellen.filter((q) => auffrischungGescheitert(q));
  const standQuelle =
    nichtFrisch.length === 0
      ? null
      : nichtFrisch.reduce((a, b) => (a.dataUpdatedAt <= b.dataUpdatedAt ? a : b));
  // Der Knopf holt BEIDE Quellen zurück (JOB 3072 R2). Fasste er nur die Suche an, käme nach einem
  // Doppelausfall zwar der Bestand wieder, der Zustand jedes Eintrags bliebe aber auf dem Rückfall
  // `bestand` stehen — ein Knopf, der die halbe Fläche nicht erreicht.
  const alleAuffrischen = (): void => {
    for (const q of quellen) {
      void q.refetch();
    }
  };

  const zeileAus = (ko: (typeof win.visible)[number]["ko"]): BibListenPosten => {
    // JOB 3072: EINE Quelle für Wort und Ton. Der Konflikt steht schon IM Zustand (`anzeigestatusAus`
    // prüft ihn als ersten Zweig) — die frühere zweite Abfrage `impact.limited` an Wort und Ton war
    // genau die Doppelung, an der der Umschalter darüber vorbeilief.
    const zustand = auskunftFuer(ko).status;
    // JOB 3034: die Vertraulichkeitsstufe im Klartext — in der Trefferzeile stand sie vorher GAR
    // NICHT; wer eine Zeile ansah, erfuhr über die Vertraulichkeit nichts. Dieselbe Funktion wie
    // auf der Lesefläche (`vertraulichkeitsAuskunft`), keine zweite Auslegung derselben Aussage.
    const auskunft = vertraulichkeitsAuskunft(ko);
    return {
      art: "eintrag",
      id: ko.id,
      titel: ko.title,
      bereich: ko.category,
      zustandWort: t(`status.${zustand}`),
      ton: zustandsTon(zustand),
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
      {/* ==========================================================================================
          JOB 3072 · N4 — WORAUF DER ZUSTAND JEDER ZEILE STEHT. MASCHINENLESBAR, UNSICHTBAR.
          ==========================================================================================
          Je sichtbarem Eintrag ein Anker: `server` oder `bestand`, dazu die Eingänge, die der
          Server für DIESE Antwort ausdrücklich nicht erhoben hat (Deckel über 200, fehlgeschlagene
          Abfrage). Kein sichtbarer Text, kein Übersetzungsschlüssel — H4 verbietet Erklärtext auf
          dieser Fläche, und der Textmesser misst `innerText`, den ein `hidden`-Block nicht hat.

          WARUM DIE ANKER NICHT AN DER ZEILE SELBST HÄNGEN: die Zeile zeichnet `BibliothekListe.tsx`,
          und diese Datei steht ausdrücklich NICHT in den Zielpfaden dieses Auftrags (§4/§10) — dort
          arbeitet gerade eine andere Bahn. Ein Attribut an der Zeile verlangt ein Feld an
          `BibZeile` und eine Zeile im Markup dort. Das ist als Restschuld in der Rückgabe benannt
          und in einem Zug zu erledigen, sobald die Datei frei ist; die AUSKUNFT selbst fehlt bis
          dahin nirgends. */}
      <div hidden data-testid="bib-zustand-anker-liste">
        {win.visible.map((i) => (
          <span
            key={i.ko.id}
            data-testid="bib-zustand-anker"
            data-bib-id={i.ko.id}
            {...anzeigestatusAnker(auskunftFuer(i.ko))}
          />
        ))}
      </div>
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
        //
        // ============================================================================================
        // JOB 3072 R3 (Befund BEN-3b) — DER WEG ZURÜCK ZUR FRISCHE GEHÖRT NEBEN DEN SATZ.
        // ============================================================================================
        // Der Wiederholungsknopf der Liste steht allein im Zweig `fehler` (`BibliothekListe.tsx:192`),
        // und der verlangt einen ERSTFEHLER OHNE Bestand. Genau im Fall, für den dieser Satz gebaut
        // ist — Bestand da, Auffrischung nicht durchgekommen —, gab es deshalb bis hierher gar keinen
        // Weg: die Fläche sagte „nicht frisch" und bot nichts an. Der Knopf hängt am HINWEIS und
        // nicht an der Liste, weil `BibliothekListe.tsx` nicht in den Zielpfaden steht (§4/§10); er
        // trägt dieselbe vorhandene Beschriftung wie der Knopf im Fehlerzweig, also KEIN neuer
        // Übersetzungsschlüssel und kein zweites Wort für dieselbe Handlung.
        hinweis={
          standQuelle ? (
            <>
              <AuffrischungHinweis query={standQuelle} />
              <button
                type="button"
                data-testid="bib-hinweis-erneut"
                onClick={alleAuffrischen}
                className="mb-3 rounded-btn border border-hairline px-2.5 py-1 text-[12.5px] font-semibold text-text hover:bg-hairline-soft"
              >
                {t("lib.liste.erneut")}
              </button>
            </>
          ) : null
        }
        onErneut={alleAuffrischen}
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
              hinweisSchonGesagt={standQuelle !== null}
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

import { type UseQueryResult, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { koQueryKey, useConflicts, useKos, useLibrarySearch } from "../../api/hooks";
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
  groupByFacet,
  libraryFilterValues,
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
import {
  LIBRARY_SAVED_VIEW_DIMENSIONS,
  readLibrarySavedViewState,
  sameLibrarySavedViewState,
} from "../../lib/librarySavedViewState";
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
  facetSelectionNeedsKnownValues,
  knownFacetValues,
  pruneFacetSelectionToKnownValues,
  serializeFacetSelection,
  writeFacetSelectionToParams,
} from "../../lib/libraryUrlFilters";
import { useAuthorName } from "../../lib/useAuthorName";
import { LIBRARY_SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../lib/useDebouncedValue";
import { usePersistentEnum } from "../../lib/usePersistentValue";
import { useReadiness } from "../../lib/useReadiness";
import { TABLET_LESE_QUERY, useMediaQuery } from "../../shell/useMediaQuery";
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
// JOB 3104 · UX-02 — DER SUCHBEGRIFF UND DER GELESENE EINTRAG STEHEN IN DER ADRESSE.
// ==================================================================================================
//
// DER BEFUND, gemessen von Codex an der Live-Fassung (`register/planung/UIUX-AUFTRAEGE-1.md` §UX-02,
// Meldungen N-0006 und N-0016): 05.09.2026 19:08–19:09 CEST an 1.0.0-beta.1.101 und noch einmal
// unabhängig 21:45–21:46 CEST an 1.0.0-beta.1.107 — in „Meine Ablage" den eigenen Bericht gesucht
// und gelesen, dann neu geladen. Danach stand das Suchfeld LEER und rechts ein FREMDER Bericht
// („NUTZERPRUEFUNG Bibliothek Langtext 20260905-175543"), den niemand gewählt hatte. Der direkte
// `/wissen/<id>`-Link überlebte dasselbe Neuladen unverändert — weil dort die ADRESSE die Wahl trägt.
//
// ZWEI URSACHEN, BEIDE AN DIESER DATEI:
//   · Der Suchbegriff wurde beim Montieren AUS der Adresse gelesen, aber nie hineingeschrieben —
//     der Leser lief ins Leere, denn den Parameter erzeugte niemand.
//   · Die Wahl wohnte in einem React-Zustand. Der überlebt kein Neuladen; danach griff der Rückfall
//     `sichtbareIds[0]` und stempelte den ersten sichtbaren Eintrag zur Wahl des Menschen.
//
// BEIDES WOHNT JETZT IN DER ADRESSE — dieselbe Entscheidung wie beim Umschalter (`SEGMENT_PARAM`)
// und beim Geltungsbereich (`lib/libraryOwnScope.ts`): die Adresse IST der Speicher. Kein
// `localStorage`, kein `sessionStorage`, kein zweiter Zustand daneben; zwei Speicher für eine
// Aussage laufen auseinander, und der nächste Auftrag repariert dann wieder einen davon.
//
// GESCHRIEBEN WIRD IMMER MIT `replace`, NIE MIT `push`, aus zwei Gründen:
//   1. Die Entscheidung ist schon getroffen (`pages/KnowledgeDetail.tsx:36-38`, wörtlich):
//      „`replace`, weil das Blättern in der Liste kein Ortswechsel ist: der Zurück-Knopf soll die
//      Bibliothek verlassen, nicht durch jede gelesene Zeile stolpern."
//   2. Beim Suchbegriff kommt der zweite Grund dazu: mit `push` legte jeder entprellte
//      Tastenanschlag einen Verlaufseintrag an, und ein Zurück-Klick liefe rückwärts durch
//      Wortfragmente. Ein Zurück-Klick verlässt die Bibliothek, egal wie viel gesucht und geklickt
//      wurde.
//
// EIN AUSDRUCK JE SCHLÜSSEL (Lehre 3072/3088): `SUCH_PARAM` steht auch dort, wo bis hierher das
// Literal `"q"` stand — ein zweites Literal für denselben Parameter ist die Doppelung, die
// auseinanderläuft. Beide Konstanten bleiben modul-intern: ein Export ohne Aufrufer wäre genau das,
// was `tests/capture/aufrufer-waechter.test.ts` sperrt, und ein Test ist kein Aufrufer.
const SUCH_PARAM = "q";
const EINTRAG_PARAM = "eintrag";

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

// ==================================================================================================
// JOB 3121 · UX-14 — AUF DEM TELEFON TRÄGT EINE FLÄCHE DIE BREITE, NICHT ZWEI NEBENEINANDER.
// ==================================================================================================
//
// DER BEFUND (N-0043, dazu N-0045 und N-0049/N-0051 am selben Engpass): der Container unten stand
// bedingungslos auf `flex` — keine Spalte, kein Bruchpunkt, kein Umbruch. Liste und Lesebereich
// waren damit auf JEDER Breite Geschwister in EINER Zeile. Die Liste hält ihre 380 px fest
// (`BibliothekListe.tsx:128`, `w-[380px] shrink-0`); bei 390 px blieben dem Bericht 10 px, bei
// 320 px gar keine. Der Bericht war nicht abgeschnitten — er war breitenlos, auch nach Neuladen.
//
// DIE SCHWELLE, geometrisch und nicht gefühlt: unter 760 px bekommt der Bericht WENIGER Platz als
// die 380 px breite Liste, die ihn nur findet — die Hauptsache wäre schmaler als das Verzeichnis.
// Darum 760 und NICHT die Hausschwelle `NARROW_QUERY` (≤899 px, `shell/useMediaQuery.ts:35`, die
// Schwelle des Schubfachs): bei 768 px (Tablet hochkant) blieb es bei 380 + 388 px und damit bei
// der damaligen Anordnung — genau die Breite, für die UX-21 den Tablet-Lesemodus mit einklappbarer
// Trefferliste getrennt entwirft (Auftrag §10). Seit JOB 3335 trägt dieses Band (760–899 px,
// `TABLET_LESE_QUERY`) den Lesemodus — s. den Block darunter; diese Schwelle bleibt unverändert.
//
// GELESEN WIRD DIE BREITE ÜBER `matchMedia` UND NICHT NUR ÜBER CSS (`useMediaQuery`, die EINE
// Stelle im Haus, die `matchMedia` liest — `FacetFilter.tsx:43` und `Validation.tsx:162` gehen
// denselben Weg). Der Grund ist nicht Bequemlichkeit: schmal darf die nicht gezeigte Fläche auch
// nicht mit der Tastatur erreichbar sein (Lieferung 5, N-0001/0019/0031/0035). Ein `hidden`-Zweig
// aus CSS bliebe im DOM; hier entscheidet die Anordnung, WAS gebaut wird. Fehlt `matchMedia`
// (SSR, alte Umgebung), gilt „breit" — das Verhalten von heute.
const SCHMAL_UNTER = 760;
const SCHMAL_ABFRAGE = `(max-width: ${SCHMAL_UNTER - 1}px)`;

// ==================================================================================================
// JOB 3335 · UX-21 — DAS LESE-TABLET: DER BERICHT TRÄGT DIE FLÄCHE, DIE LISTE KOMMT AUF WUNSCH DAZU.
// ==================================================================================================
//
// DER BEFUND (N-0044, Pedi am 06.09. auf dem iPad hochkant, 768 × 1024): „Liste ca. 380 px und
// Text 356 px" nebeneinander — die Anordnung des Desktops auf einer Fläche, die dafür zu schmal
// ist. Der Kommentar über `SCHMAL_UNTER` hat 768 ausdrücklich diesem Auftrag überlassen.
//
// DAS DRITTE BAND (`TABLET_LESE_QUERY`, `shell/useMediaQuery.ts`: 760–899 px, lückenlos an die
// Telefonschwelle anschliessend) macht aus dem Nebeneinander ein Nacheinander, das der MENSCH
// bestimmt: der Bericht trägt die Fläche in einem Leseraum, und ein beschrifteter Schalter in der
// haftenden Leiste holt die Trefferliste als Schublade DARÜBER dazu — ohne den Bericht zu
// schliessen, ohne Suchbegriff, Filter oder Rollstand zu verlieren. Heute klappt schmal die Breite
// die Liste weg (der Rückweg SCHLIESST den Bericht); im Tablet-Band klappt sie der Mensch.
//
// WARUM SCHUBLADE UND NICHT „DER BERICHT WEICHT": 380 px Liste neben 736 px Inhaltsbreite liessen
// dem Text wieder 356 px — genau die Quetsche des Befunds. Die Schublade liegt über dem linken
// Teil des Berichts; wer die Liste offen hat, sucht gerade seine Trefferstelle, nicht die
// Zeile im Text. Der Schalter steht rechts in der Leiste und bleibt dabei frei (gemessen in
// `tests/ux21-tablet-lesemodus/tablet-chromium.test.ts` T2, `elementFromPoint`).
//
// DIE VORLIEBE IST EINE BEDIEN-WAHL, KEIN ZUSTAND DER DATEN: sie wohnt wie die Sortierung im
// vorhandenen `usePersistentEnum` (`lib/usePersistentValue.ts`), nicht in der Adresse (ein
// geteilter Link soll nicht festlegen, ob beim Empfänger die Liste offen ist) und nicht in einem
// zweiten Speicher. Ein gespeicherter Wert ausserhalb der Menge fällt auf „zu" zurück — den
// Leseraum, der der Zweck dieses Bandes ist.
const TABLET_LISTE_STORAGE_KEY = "klarwerk.library.tabletListe";
const TABLET_LISTE_WAHL = ["offen", "zu"] as const;
// DER LESERAUM: 600 px Textbreite bei der Grundschrift des Berichts (15,5 px, `BibliothekLesen.tsx`)
// sind ≈ 75–78 Zeichen je Zeile — die obere Kante des lesbaren Bereichs (45–75 Zeichen, Bringhurst;
// darüber verliert das Auge den Zeilenanfang). Die 720 px des Desktops (Vorlage
// `Bibliothek.dc.html`, ≈ 93 Zeichen) bleiben dort unverändert; die 356 px von N-0044 (≈ 46
// Zeichen) waren nicht zu schmal für das Auge, sondern zu schmal für Bilder, Tabellen und die
// Kopfzeile des Berichts. Dazu je 24 px Innenabstand (`px-6`), damit der Text nicht am Rand der
// Inhaltsfläche klebt: 600 + 2 · 24 = 648 — die Zahl in `max-w-[648px]` unten. Tailwind liest
// Klassen als Text, deshalb steht sie dort ausgeschrieben und hier begründet.

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
  const navigate = useNavigate();
  // JOB 3121 · UX-14: die eine Breitenfrage dieser Fläche. Sie entscheidet weiter unten NUR die
  // Anordnung — keinen Abruf, keinen Filter, keine Aussage über den Bestand.
  const schmal = useMediaQuery(SCHMAL_ABFRAGE);
  // JOB 3335 · UX-21: das dritte Band (s. o.). Beide Abfragen laufen über denselben Haken — die
  // EINE Stelle des Hauses, die `matchMedia` liest. Sie schliessen sich aus (759 | 760–899 | 900).
  const tablet = useMediaQuery(TABLET_LESE_QUERY);
  // Die Bedien-Vorliebe des Lese-Tablets: ob die Trefferliste neben dem offenen Bericht steht.
  // Wirkt NUR im Tablet-Band (s. `zeigeListe`); auf Telefon und Desktop wird sie nicht gelesen.
  const [tabletListe, setTabletListe] = usePersistentEnum(
    TABLET_LISTE_STORAGE_KEY,
    TABLET_LISTE_WAHL,
    "zu",
  );
  const { user } = useSession();
  const nameOf = useAuthorName();
  // JOB 3088 · Q1b: die Detailabfrage des gelesenen Eintrags wohnt in `BibliothekLesen`, nicht hier.
  // Der Wiederholknopf erreicht sie deshalb über den Zwischenspeicher — s. `alleAuffrischen` unten.
  const qc = useQueryClient();

  const [q, setQ] = useState(params.get(SUCH_PARAM) ?? "");
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
  // ================================================================================================
  // JOB 3115 · UX-02b — DIE WERTPRÜFUNG WARTET AUF EINEN BESTÄTIGTEN BESTAND, NICHT AUF IRGENDEINEN.
  // ================================================================================================
  //
  // DER BEFUND (Codex `CODEX-ANTWORT-35 §5`, `-36 §2`, Messung `R-0459` an 1.113): der Klick auf eine
  // Themenkarte im Wissensnetz (`pages/Wissensnetz.tsx:295`, `/bibliothek?tag=…`) zeigte die VOLLE
  // Liste — 32 statt 2 — und keinen gesetzten Filter, sobald das Schlagwort erst nach dem letzten
  // Bestandsabruf entstanden war. Derselbe Link in einem frischen Fenster war korrekt.
  //
  // DIE URSACHE WAR DER ZEITPUNKT, NICHT DIE PRÜFUNG. Die Bedingung lautete `all.data === undefined`,
  // also „irgendeine Antwort liegt vor". Bei einer Navigation INNERHALB der Anwendung liegt beim
  // Montieren sofort der Stand vom letzten Besuch da; die Prüfung lief in genau diesem Augenblick,
  // fand das junge Schlagwort im alten Bestand nicht, warf die Dimension weg und verbrauchte den
  // Keim. Die frische Antwort kam Millisekunden später — und zu spät.
  //
  // DIE PRÜFUNG SELBST BLEIBT UNVERSCHOBEN (mega11 Block C, s. `lib/libraryUrlFilters.ts`): ein
  // unbekannter Wert aus einer Adresszeile wird kein echter Facettenwert, sonst überlebte er über
  // „Diese Suche merken" im localStorage. Was sich ändert, ist allein das WANN.
  //
  // WORAN „BESTÄTIGT FÜR DIESE MONTAGE" HÄNGT — am FRISCHEMODELL von react-query, nicht an einer
  // Zahl: es wird gerade kein Abruf geführt UND die vorliegende Antwort gilt innerhalb der geltenden
  // Frist als frisch. Die Frist selbst steht in `main.tsx` und wird hier weder gelesen noch
  // nachgebaut — eine zweite Zahl daneben liefe auseinander.
  //
  // `!all.isStale` trägt dabei den Fall, den `!all.isFetching` allein NICHT trägt: im ersten
  // Renderdurchgang nach dem Montieren ist der Abruf noch gar nicht angestoßen (react-query startet
  // ihn in seinem eigenen Effekt), `isFetching` ist also falsch und die Prüfung liefe wieder zu früh.
  //
  // UND `standBeimMontieren` TRÄGT DIE ANDERE HÄLFTE: eine Antwort, die WÄHREND dieser Montage
  // eingelaufen ist, ist bestätigt — auch wenn sie im selben Augenblick schon wieder als veraltet
  // gilt (eine Frist von 0). Ohne diesen Zweig hinge die Fläche bei einer kurzen Frist ewig im
  // Ladezustand; das Wartemodell darf nicht davon abhängen, wie groß die Zahl in `main.tsx` gerade
  // ist (dort arbeitet JOB 3113).
  const standBeimMontieren = useRef(all.dataUpdatedAt);
  const bestandBestaetigt =
    all.data !== undefined &&
    !all.isFetching &&
    (!all.isStale || all.dataUpdatedAt > standBeimMontieren.current);
  // Eine Auswahl ohne zu prüfenden Wert braucht gar keinen Bestand — sie darf nicht warten (sonst
  // wartete JEDER Besuch der Bibliothek auf den Bestandsabruf, auch ohne Filter in der Adresse).
  const keimBrauchtBestand = urlSeed !== null && facetSelectionNeedsKnownValues(urlSeed);
  useEffect(() => {
    const seed = urlSeed;
    if (seed === null) {
      return;
    }
    // GENAU EINE Bedingung entscheidet, ob geprüft werden darf — die alte (`all.data === undefined`,
    // „irgendeine Antwort liegt vor") ist damit vollständig abgelöst und steht nirgends mehr. Ohne
    // zu prüfenden Wert ist der Bestand ohne Belang: `pruneFacetSelectionToKnownValues` gibt dann
    // mit jedem Bestand dasselbe zurück, und ein Warten hätte nichts zu warten.
    if (keimBrauchtBestand && !bestandBestaetigt) {
      return;
    }
    const now = Date.now();
    const known = knownFacetValues(
      (all.data ?? []).map((k) => libraryFilterValues(k, now)),
      LIBRARY_FACET_PARAM_KEYS,
    );
    setFacetSel(pruneFacetSelectionToKnownValues(seed, known));
    setUrlSeed(null);
  }, [urlSeed, all.data, keimBrauchtBestand, bestandBestaetigt]);

  // Solange der Keim nicht geprüft ist, ist ER die wirksame Auswahl. Das ist KEIN zweiter
  // Auswahlspeicher, sondern eine reine Ableitung aus den zwei vorhandenen Zuständen — und es ist
  // die ehrliche Lesart: die Adresse hat ausdrücklich eingegrenzt, und daraus stillschweigend die
  // volle Liste zu machen wäre die zu starke Aussage (dieselbe Begründung, mit der `origin` in
  // `libraryUrlFilters.ts` von der Prüfung ausgenommen ist).
  const wirksameAuswahl = urlSeed ?? facetSel;

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

  // Sichten und Bedienzustand gehören zur Nutzerkennung. Beim Wechsel wird die alte Liste
  // schon vor dem Leseeffekt ausgeblendet; Name und Löschziel werden gemeinsam zurückgesetzt.
  const viewsUserId = user?.id ?? "anon";
  const [viewStore, setViewStore] = useState<{ userId: string; views: LibrarySavedView[] }>({
    userId: viewsUserId,
    views: [],
  });
  const savedViews = viewStore.userId === viewsUserId ? viewStore.views : [];
  const setSavedViews = (views: LibrarySavedView[]): void =>
    setViewStore({ userId: viewsUserId, views });
  const [viewName, setViewName] = useState("");
  const [activeView, setActiveView] = useState("");
  const [viewError, setViewError] = useState(false);
  useEffect(() => {
    let views: LibrarySavedView[] = [];
    try {
      views = readLibraryViews(window.localStorage, viewsUserId);
    } catch {
      // Auch der Zugriff auf window.localStorage selbst kann gesperrt sein.
    }
    setViewStore({ userId: viewsUserId, views });
    setActiveView("");
    setViewName("");
    setViewError(false);
  }, [viewsUserId]);
  const currentViewState = { q, facetSel: wirksameAuswahl, range, groupBy, segment, scope };

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
    wirksameAuswahl,
    railUi,
    facetValueLabel,
    LIBRARY_FACET_DEPENDENCIES,
  );
  const faceted = applyFacetSelection(ranked, valuesOf, wirksameAuswahl)
    .filter((item) => matchesFacetRange(koChangedMs(item.ko), range))
    // Der Umschalter wirkt wie jede andere Wahl: UND, auf demselben Anzeigestatus, den auch Punkt
    // und Pille zeigen — keine zweite Statusrechnung. Seit JOB 3072 ist das die vom Server erhobene
    // Zahl, und der Umschalter kennt damit auch den Konflikt: ein Eintrag mit rotem Punkt fiel
    // vorher unter „Freigegeben", weil diese Zeile als einzige die Konfliktliste nicht ansah.
    .filter((item) => passtZuSegment(auskunftFuer(item.ko).status, segment));
  const sorted = sortLibrary(faceted, sortKey, (item) => item.ko);
  const win = windowList(sorted, windowLimit);

  const resetWindow = (): void => setWindowLimit(LIBRARY_RESULT_LIMIT);

  // ================================================================================================
  // JOB 3104 · UX-02 — SUCHBEGRIFF ⇄ ADRESSE. ZWEI RICHTUNGEN, EINE WAHRHEIT.
  // ================================================================================================
  //
  // HINSCHREIBEN. Der Begriff geht denselben Weg zurück in die Adresse, den er beim Montieren
  // gekommen ist (`q` oben, `params.get(SUCH_PARAM)`). Geschrieben wird der ENTPRELLTE Wert und
  // nicht jeder Tastendruck: `debouncedQ` ist derselbe Ausdruck, der auch den Abfrageschlüssel
  // bildet — die Adresse folgt damit genau der Suche, statt eine zweite Taktung daneben zu setzen.
  // LEER HEISST GELÖSCHT, nicht `q=`: dieselbe Regel, die `setSegment` und `setScope` für ihren
  // Standard anwenden (der Standard steht NICHT in der Adresse, sonst sähe er wie eine getroffene
  // Wahl aus).
  //
  // ZURÜCKLESEN, und das ist keine Zugabe, sondern die Bedingung dafür, dass der Schreiber niemand
  // anderem ins Wort fällt. Diese Fläche bleibt bei einer Adressänderung MONTIERT — der Leser bei
  // `useState` läuft dann nicht noch einmal. Drei Wege ändern `q` von aussen:
  //   · die Suche im Kopfband (`shell/Kopfband.tsx:51`, `navigate("/bibliothek?q=…")`),
  //   · ein Deep-Link auf dieselbe Route,
  //   · der Zurück-Knopf auf einen älteren Stand.
  // Ohne diesen Leser stünde das Feld weiter leer UND der Schreiber löschte den fremden Begriff
  // 300 ms später wieder aus der Adresse — die Kopfbandsuche wäre auf `/bibliothek` wirkungslos.
  //
  // BEIDE RICHTUNGEN STEHEN IN EINEM EINZIGEN EFFEKT, und das ist kein Zusammenlegen aus
  // Ordnungsliebe, sondern gemessen erzwungen. Zwei Effekte laufen im selben Durchgang nacheinander
  // und lesen dabei DENSELBEN, alten Zustand: der Leser setzte `q` auf den fremden Begriff, und der
  // Schreiber daneben löschte ihn im gleichen Zug wieder aus der Adresse, weil sein `q` noch leer
  // war (Lauf vom 06.09.: „adresse= feld=Ventil", danach „adresse=?q=Ventil feld="). Ein Effekt
  // entscheidet ZUERST, welche Seite gerade dran ist — und dann kann die andere nicht dazwischen.
  //
  // WORAN DIE SEITE ERKANNT WIRD: `letzteAdressSuche` hält den Begriff, den diese Fläche zuletzt in
  // der Adresse GESEHEN oder selbst HINEINGESCHRIEBEN hat. Steht dort etwas anderes, war ein
  // Fremder am Werk — und nur dann folgt das Feld. Sonst gilt die andere Richtung, und die
  // schreibt erst, wenn die Entprellung eingeholt hat (`debouncedQ === q`): solange das Feld voraus
  // ist, ist noch nichts entschieden, und ein halb getippter Stand gehört nicht in eine Adresse,
  // die geteilt wird.
  const adressQ = params.get(SUCH_PARAM) ?? "";
  const letzteAdressSuche = useRef(adressQ);
  useEffect(() => {
    if (adressQ !== letzteAdressSuche.current) {
      // Von aussen gekommen: Kopfbandsuche, Deep-Link, Zurück-Knopf. Das Feld folgt der Adresse.
      letzteAdressSuche.current = adressQ;
      if (adressQ !== q) {
        // `setWindowLimit` statt `resetWindow()`: der Setzer ist stabil, die Hülle wäre je
        // Durchgang eine neue Funktion und zöge diesen Effekt in jeden Renderdurchgang.
        setWindowLimit(LIBRARY_RESULT_LIMIT);
        setQ(adressQ);
      }
      return;
    }
    if (debouncedQ !== q || adressQ === debouncedQ) {
      return;
    }
    letzteAdressSuche.current = debouncedQ;
    setParams(
      (prev) => {
        // Über `prev` und nicht über eine Kopie dieses Durchgangs: eine gleichzeitige
        // Facetten-Fortschreibung (`:214`) darf dabei nicht verlorengehen.
        const p = new URLSearchParams(prev);
        if (debouncedQ.length === 0) {
          p.delete(SUCH_PARAM);
        } else {
          p.set(SUCH_PARAM, debouncedQ);
        }
        return p;
      },
      { replace: true },
    );
  }, [adressQ, q, debouncedQ, setParams]);

  // Eine Wahl, die den Keim ERSETZT: sie kommt nicht aus der Adresse, sondern aus einer schon
  // geprüften oder ausdrücklich geleerten Quelle. Danach ist nichts Ungeprüftes mehr im Spiel.
  const keimVerbrauchen = (): void => setUrlSeed(null);
  // ================================================================================================
  // JOB 3115 R2 (Befund BEN, Korrekturpflicht 1) — EIN FILTERKLICK IST KEINE BESTÄTIGUNG.
  // ================================================================================================
  // Runde 1 hat hier den Keim VERBRAUCHT (`setUrlSeed(null)`) und sein Ergebnis nach `facetSel`
  // geschrieben. Damit galt jeder ungeprüfte Restwert aus der Adresse ab dem ersten Klick ins
  // Filtermenü als echter Facettenwert: gemessen an `/bibliothek?tag=gibt-es-nicht&tag=Abluft` mit
  // altem Zwischenspeicher und gescheitertem Bestandsabruf — „Abluft" abwählen, „Diese Suche
  // merken" drücken, und `gibt-es-nicht` stand im localStorage. Genau das verbietet mega11 Block C
  // (`lib/libraryUrlFilters.ts`); ein Klick auf eine ANDERE Dimension darf einen eingeschleusten
  // Wert nicht mit durchwinken.
  //
  // DER GRIFF ÄNDERT DESHALB DEN KEIM, STATT IHN ZU VERBRAUCHEN. Die Wahl des Menschen wirkt sofort
  // (`wirksameAuswahl` ist der Keim), sie bleibt aber ungeprüft, bis der Bestand bestätigt ist — und
  // die nachgeholte Prüfung fällt ihr nicht ins Wort: `pruneFacetSelectionToKnownValues` NIMMT nur
  // weg, was im Bestand nicht vorkommt, und setzt nichts zurück. Es bleibt bei EINEM Keim und EINER
  // Auswahl (Lieferung 6), nur wandert der Wert später statt sofort.
  //
  // Bleibt nach dem Griff nichts Prüfbares übrig (alles abgewählt), löst der Effekt oben ihn im
  // selben Durchgang auf — `facetSelectionNeedsKnownValues` ist dann falsch und wartet auf nichts.
  const onToggleFacet = (key: string, value: string): void => {
    resetWindow();
    const naechste = pruneDependentSelection(
      toggleFacetValue(wirksameAuswahl, key, value),
      facetItems,
      LIBRARY_FACET_DEPENDENCIES,
    );
    if (urlSeed !== null) {
      setUrlSeed(naechste);
      return;
    }
    setFacetSel(naechste);
  };
  const onResetFilters = (): void => {
    resetWindow();
    keimVerbrauchen();
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
    const s = readLibrarySavedViewState(view.state, LIBRARY_FACET_PARAM_KEYS);
    setQ(s.q);
    keimVerbrauchen();
    setFacetSel(s.facetSel);
    setRange(s.range);
    setGroupBy(s.groupBy);
    // Ein URL-Schreibvorgang: zwei setParams-Aufrufe im selben Ereignis bauen auf derselben
    // alten Adresse auf und könnten Segment/Scope oder Facetten gegenseitig überschreiben.
    // Auch q steht sofort daneben, damit die entprellte Suchfortschreibung nichts zurücksetzt.
    letzteAdressSuche.current = s.q;
    setParams(
      (prev) => {
        const p = writeFacetRangeToParams(
          writeFacetSelectionToParams(prev, s.facetSel, LIBRARY_FACET_PARAM_KEYS),
          s.range,
          LIBRARY_RANGE_FROM_PARAM,
          LIBRARY_RANGE_TO_PARAM,
        );
        if (s.q) p.set(SUCH_PARAM, s.q);
        else p.delete(SUCH_PARAM);
        if (s.segment === BIB_SEGMENT_STANDARD) p.delete(SEGMENT_PARAM);
        else p.set(SEGMENT_PARAM, s.segment);
        if (s.scope === DEFAULT_LIBRARY_SCOPE) p.delete(LIBRARY_SCOPE_PARAM);
        else p.set(LIBRARY_SCOPE_PARAM, s.scope);
        return p;
      },
      { replace: true },
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
  // Offline hält TanStack Query den GEWOLLTEN Abruf an, statt ihn zu führen: `fetchStatus` steht
  // dann auf `paused`. Genau dieser eine Ausdruck trägt seit JOB 3072 das Frischemodell — und seit
  // JOB 3099 auch den Leerzweig der Liste (s. `pausiert` unten). Kein `navigator.onLine`, keine
  // zweite Wahrheit über denselben Sachverhalt.
  const angehalten = (q: UseQueryResult<unknown>): boolean => q.fetchStatus === "paused";
  const frisch =
    query.data !== undefined && quellen.every((q) => !q.isRefetchError && !angehalten(q));

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
  // ================================================================================================
  // JOB 3115 — SOLANGE DIE AUSWAHL UNGEPRÜFT IST, BEHAUPTET DIE LISTE KEIN ERGEBNIS.
  // ================================================================================================
  // Die Fläche zeigt dann den vorhandenen Ladezweig (keine Zeile, kein Leerzustand, keine Zahl) —
  // sie zeigt insbesondere NICHT die ungefilterte Vollmenge als fertige Antwort.
  //
  // MIT EINER AUSNAHME, und die ist die Zusage aus REGELN §7: ist die Auffrischung des Bestands
  // GESCHEITERT, wird nicht ewig geladen. Dann steht der Filter aus der Adresse (`wirksameAuswahl`),
  // darüber der Satz „Stand von <Zeit> · Auffrischung fehlgeschlagen" mit dem Wiederholknopf — und
  // die Prüfung wird nachgeholt, sobald ein Abruf durchkommt. Der Zähler schweigt trotzdem: die
  // Auswahl ist unbestätigt, und eine Trefferzahl wäre die zu starke Aussage.
  //
  // ================================================================================================
  // JOB 3115 R2 (Befund BEN, Korrekturpflicht 3) — EIN BESTANDS-ERSTFEHLER IST EIN LISTENFEHLER.
  // ================================================================================================
  // `all` ist seit JOB 3072 eine ANZEIGEQUELLE der Liste (Wort, Ton, Umschalter) und seit heute die
  // Grundlage der Filterprüfung. Scheitert ihr ERSTER Abruf — kein Zwischenspeicher, nichts
  // aufzufrischen —, greift `auffrischungGescheitert` nicht (die verlangt vorhandene Daten), und der
  // Hinweis samt Wiederholknopf entsteht nicht. Runde 1 wartete dann ewig, und ohne Keim stand
  // sogar eine Liste mit Rückfall-Zuständen da, als wäre nichts gewesen. Beides ist die zu starke
  // Aussage: gemessen wurde nichts. Der Fall gehört deshalb in den vorhandenen Fehlerzweig der
  // Liste, dessen Knopf `alleAuffrischen` ruft und damit BEIDE Quellen zurückholt.
  //
  // `!all.isError` deckt damit BEIDE Fehlerlagen ab und ist die eine Bedingung dafür: mit Bestand
  // trägt der Hinweis den Weg zurück, ohne Bestand der Fehlerzweig. Gewartet wird nur, solange
  // überhaupt noch etwas kommen kann.
  const bestandsErstfehler = all.isError && all.data === undefined;
  const keimWartet = keimBrauchtBestand && !all.isError;
  const nichtFrisch = quellen.filter((q) => auffrischungGescheitert(q));
  const standQuelle =
    nichtFrisch.length === 0
      ? null
      : nichtFrisch.reduce((a, b) => (a.dataUpdatedAt <= b.dataUpdatedAt ? a : b));
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
      // ============================================================================================
      // JOB 3488 · DIE VORSCHAUQUELLE — SIE LIEGT SCHON HIER, ALSO KOSTET SIE NICHTS.
      // ============================================================================================
      // Die Zeile entsteht aus dem VOLLEN Suchobjekt; die Kernaussage ist damit ohne einen einzigen
      // zusätzlichen Abruf greifbar. Kein Query, kein Effekt, kein Zustand, kein KI-Aufruf.
      //
      // NUR `statement`, UND DAS IST GEMESSEN, NICHT ANGENOMMEN: `bodyHtml` ist am Draht dieser
      // Liste nicht vorhanden — `GET /api/library/search`
      // (`services/app/src/routes/library-routes.ts:539`) liefert über `KoService.listForSearch`
      // (`services/knowledge-object/src/service.ts:3031-3035`) die body-freie Projektion beider
      // Kompositionswurzeln (InMemory `repo.ts:483` `map(({ bodyHtml: _omitted, ...rest }) => rest)`,
      // Postgres `repo-pg.ts:580` `SELECT data - 'bodyHtml' AS data FROM kos`). Der Body-Rückfall aus
      // `koPreviewText` (`lib/koPreview.ts:34`) liefe hier also ins Leere; ihn trotzdem
      // hinzuschreiben behauptete eine Quelle, die es nicht gibt. `statement` dagegen ist am Draht
      // Pflichtfeld (`api/types.ts:335`, `statement: string`). Eine Zeile ohne Kernaussage bekommt
      // deshalb schlicht keinen Aufklapper — kein Nachladen je Zeile, kein Modelltext.
      vorschau: { statement: ko.statement },
    };
  };

  // ================================================================================================
  // JOB 3115 R2 (Befund BEN, Korrekturpflicht 2) — SCHWEIGEN HEISST HIER: KEINE ZEILE.
  // ================================================================================================
  // Runde 1 hat der Liste nur `laedt` gereicht und geglaubt, damit sei die Vollmenge unterdrückt.
  // Sie war es nicht: `BibliothekListe.tsx:234` zeichnet `posten` bedingungslos, `laedt` schaltet
  // dort allein den Leerzustand ab. Ein absichtlich offen gehaltener Bestandsabruf zeigte deshalb
  // weiterhin alle Zeilen — die ungefilterte Antwort, als stünde sie fest. Die Liste bekommt in
  // dieser Lage jetzt NICHTS zu zeichnen; `BibliothekListe.tsx` bleibt unverändert (Auftrag §10).
  const listeSchweigt = keimWartet || bestandsErstfehler;
  const posten: BibListenPosten[] = listeSchweigt
    ? []
    : groupBy === "none"
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

  // ---- Auswahl: eine reine Ableitung AUS DER ADRESSE, kein zweiter Zustand ----------------------
  //
  // JOB 3104 · UX-02. Bis hierher stand hier ein `useState`, den das Neuladen nicht überlebte, samt
  // einem Effekt, der ihn aus `vorgewaehlt` nachzog. Beides ist ERSETZT — die Wahl wird gelesen, wo
  // sie steht:
  //
  //   `/wissen/:id`  → der PFAD trägt sie, `vorgewaehlt` gewinnt. Der Parameter wird dort nicht
  //                    geschrieben (s. `waehle`); sonst stünde dieselbe Wahl zweimal in einer Adresse.
  //   `/bibliothek`  → `EINTRAG_PARAM` trägt sie.
  //
  // Ein leerer Parameter (`?eintrag=`) ist KEINE Wahl: „unbekannt" und „dieser Eintrag" sind
  // verschiedene Aussagen (REGELN §7), und nur die erste ist hier ehrlich.
  const wahlAusAdresse = params.get(EINTRAG_PARAM);
  const gewaehlt =
    vorgewaehlt ?? (wahlAusAdresse !== null && wahlAusAdresse.length > 0 ? wahlAusAdresse : null);
  const sichtbareIds = win.visible.map((i) => i.ko.id);
  // Steht eine Kennung in der Adresse, gilt SIE — unverändert, auch wenn sie nicht (mehr) in der
  // sichtbaren Menge steht. Genau daran hing der Befund N-0006: der alte Rückfall ersetzte eine
  // gefilterte, gelöschte oder gesperrte Wahl STILL durch den ersten sichtbaren Eintrag. Jetzt
  // bleibt sie stehen, `BibliothekLesen` läuft in seinen vorhandenen Fehlerzweig, und die Fläche
  // sagt „Der Eintrag ließ sich nicht laden." statt einen fremden Bericht unterzuschieben.
  //
  // `sichtbareIds[0]` greift nur noch ohne jede Wahl in der Adresse (Erstbesuch von `/bibliothek`).
  // Diese Vorwahl wird NICHT in die Adresse geschrieben: sie ist keine getroffene Wahl, und ein
  // gestempelter Parameter wäre die Behauptung, der Mensch habe gewählt.
  //
  // JOB 3121 · UX-14 — UND SIE HAT SCHMAL KEINEN ANLASS MEHR. Breit füllt sie die zweite Spalte,
  // die sonst leer neben der Liste stünde. Schmal gibt es keine zweite Spalte: dort würde die
  // Vorwahl den Bericht ANSTELLE der Liste zeigen, und der Erstbesuch der Bibliothek landete auf
  // einem Telefon sofort in einem Bericht, den niemand gewählt hat — die Liste wäre nur über den
  // Rückweg erreichbar. Die Ableitung bleibt EINE (kein zweiter Auswahlspeicher, Lieferung 2), sie
  // kennt jetzt nur die Breite: schmal zählt allein die getroffene Wahl aus Pfad oder Adresse.
  //
  // JOB 3335 · UX-21 — DASSELBE GILT AUF DEM LESE-TABLET, aus demselben Grund: dort trägt der
  // Bericht die Fläche und die Liste ist (in der Vorgabe) eingeklappt. Eine Vorwahl stellte den
  // Erstbesuch in einen Bericht, den niemand gewählt hat, mit weggeklappter Liste davor. Ohne Wahl
  // trägt deshalb die Liste die Fläche allein — wie auf dem Telefon.
  const einspaltig = schmal || tablet;
  const vorwahl = einspaltig ? null : (sichtbareIds[0] ?? null);
  const gewaehltEffektiv = gewaehlt ?? vorwahl;
  // ================================================================================================
  // JOB 3121 · UX-14 — WELCHE FLÄCHE DIE BREITE TRÄGT. EINE BEDINGUNG, ZWEIMAL GELESEN.
  // ================================================================================================
  // Breit steht beides nebeneinander wie bisher. Schmal trägt GENAU EINES die Fläche, und zwar das,
  // was der Mensch gerade will: ohne Wahl die Liste, mit Wahl der Bericht. Was nicht gezeigt wird,
  // wird auch nicht gebaut — nur so ist es weder sichtbar noch mit der Tastatur erreichbar
  // (Lieferung 5). `zeigeListe` ist die EINE Ableitung dafür; `!zeigeListe` heißt überall unten
  // „einspaltig, und der Bericht trägt die Fläche allein".
  //
  // JOB 3335 · UX-21 — DAS TABLET-BAND ALS DRITTE BEDINGUNG DERSELBEN ABLEITUNG. Mit Wahl trägt
  // auch hier der Bericht die Fläche; die Liste steht zusätzlich da, wenn der Mensch sie dazugeholt
  // hat (`tabletListe`). Kein zweiter Sichtbarkeitszustand: der Schalter unten liest `zeigeListe`
  // für sein `aria-expanded` und sagt damit nur, was wirklich im Baum steht. Was er wegklappt,
  // wird — wie schmal — nicht gebaut, nicht bloss versteckt.
  const listeGewuenscht = tablet && tabletListe === "offen";
  const zeigeListe = gewaehltEffektiv === null || !einspaltig || listeGewuenscht;
  const zeigeBericht = gewaehltEffektiv !== null || !einspaltig;
  // WIE die Liste steht, sagt ihr die Fläche, WIE BREIT sie dann ist, weiss `BibliothekListe.tsx`
  // selbst (JOB 3335: der Nachfahren-Selektor dieser Datei auf die Listenbreite ist dort
  // abgelöst). Allein → volle Breite; im Tablet-Band neben dem Bericht → Schublade darüber.
  const listenLage = !zeigeBericht ? "allein" : tablet ? "darueber" : "spalte";
  // Ein FOKUSZIEL, kein Zustand: wechselt schmal die Fläche, verschwindet das gedrückte
  // Bedienelement aus dem DOM, und der Fokus fiele auf `<body>` — die Tastatur begänne wieder ganz
  // oben. Der Merker sagt nur, wohin er nach dem nächsten Zeichnen gehört; er entscheidet nichts.
  const wurzel = useRef<HTMLDivElement | null>(null);
  // JOB 3335: „schalter" ist der dritte Halt — nach dem Einklappen der Schublade auf dem Tablet.
  const fokusZiel = useRef<"liste" | "bericht" | "schalter" | null>(null);
  const zuletztGelesen = useRef<string | null>(null);
  // ================================================================================================
  // JOB 3121 R2 · UX-14 — DIE LISTENPOSITION IST EINE ROLLPOSITION, KEINE ZEILE.
  // ================================================================================================
  // Runde 1 hat den Fokus auf die gelesene Zeile zurückgegeben und das „Listenposition unverändert"
  // (Lieferung 4) genannt. Die Browsermessung des Prüfers widerlegt das: 1596 px vor dem Lesen,
  // 1696 px danach. Der Grund ist `focus()` selbst — es rollt das Ziel ins Bild und wählt die
  // Rollposition dabei SELBST (die Zeile landet knapp am Rand, nicht dort, wo sie war). Wer eine
  // lange Liste durchgesehen hat, sucht seine Stelle danach neu.
  //
  // Schmal rollt nicht die Liste, sondern die Seite: `<main>` (`AppShell.tsx:102`, `overflow-y-auto`)
  // ist der nächste rollende Vorfahr, weil die einspaltige Fläche keine eigene Höhe mehr hat
  // (`:1036`). Gesucht wird er deshalb nicht über einen festen Selektor — das wäre eine zweite
  // Behauptung über eine fremde Datei —, sondern am Baum entlang: der erste Vorfahr, der wirklich
  // rollt. Findet sich keiner (jsdom hat kein Layout), bleibt es beim Verhalten von Runde 1.
  const rollbereich = (): HTMLElement | null => {
    let el = wurzel.current?.parentElement ?? null;
    while (el !== null) {
      const rollt = window.getComputedStyle(el).overflowY;
      if ((rollt === "auto" || rollt === "scroll") && el.scrollHeight > el.clientHeight) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  };
  // Die Rollposition der Liste im Augenblick des Verlassens. `null` heißt „nicht selbst dorthin
  // gerollt" (Erstaufruf, Deep-Link) — dann gibt es nichts wiederherzustellen, und behauptet wird
  // auch nichts.
  const listenRollstand = useRef<number | null>(null);
  // JOB 3335 · UX-21 — WAS DIE LISTE ROLLT, HÄNGT AM BAND. Schmal rollt die Seite (s. o.); im
  // Tablet-Band hat die Fläche ihre feste Höhe, und die Liste rollt in ihrer eigenen Spur
  // (`BibliothekListe.tsx`, `bib-spur`, `overflow-y-auto`). Der MERKER ist derselbe
  // (`listenRollstand`); nur das Element, an dem er abgelesen und wiederhergestellt wird, ist ein
  // anderes. Gesucht wird die Spur über ihre Marke, nicht über ihre Klassen.
  const listenRoller = (): HTMLElement | null =>
    tablet
      ? (wurzel.current?.querySelector<HTMLElement>('[data-testid="bib-spur"]') ?? null)
      : rollbereich();
  useEffect(() => {
    const ziel = fokusZiel.current;
    const w = wurzel.current;
    if (ziel === null || w === null) {
      return;
    }
    fokusZiel.current = null;
    const roll = rollbereich();
    if (ziel === "bericht") {
      // Der Bericht beginnt oben. Ohne diese Zeile stünde die Seite noch an der Rollposition der
      // Liste, und der Mensch begänne einen frisch geöffneten Bericht in seiner Mitte. `focus()`
      // darf hier nichts mehr rollen (`preventScroll`), sonst entschiede es diese Position wieder
      // selbst; der Rückweg haftet oben (`:1494`, `sticky top-0`) und ist damit im Bild.
      if (roll !== null) {
        roll.scrollTop = 0;
      }
      w.querySelector<HTMLElement>('[data-testid="bib-zurueck"]')?.focus({ preventScroll: true });
      return;
    }
    if (ziel === "schalter") {
      // JOB 3335: die Schublade ist eben aus dem Baum gegangen — stand der Fokus auf einer Zeile
      // darin, fiele er jetzt auf <body>. Und auch nach einem Fingertipp auf den Schalter selbst
      // liegt er nicht sicher dort: Safari (iPad) fokussiert Knöpfe beim Tippen nicht. Deshalb
      // ausdrücklich, nicht dem Browser überlassen.
      w.querySelector<HTMLElement>('[data-testid="bib-liste-schalter"]')?.focus({
        preventScroll: true,
      });
      return;
    }
    // Zurück in die Liste: auf die Zeile des eben gelesenen Berichts. Ist sie nicht (mehr) da —
    // weggefiltert, gelöscht —, nimmt der Fokus einen anderen Halt der Liste. Die Marken stammen
    // aus `BibliothekListe.tsx` (`bib-zeile`/`data-bib-id`, `bib-suche`, `bib-spur`).
    //
    // JOB 3335 RUNDE 2 (Befund BEN) — DIE ROLLPOSITION HÄNGT NICHT AN DER ZEILE. Runde 1 stellte
    // den Rollstand nur wieder her, wenn die gelesene Zeile in der Liste stand; lag der offene
    // Bericht außerhalb der gefilterten Treffer, war die Position nach Zu und Auf verloren
    // (gemessen: 240 → 0). Jetzt gilt: ERST die Position, DANN der Fokus — und der Fokus auf
    // einen SICHTBAREN Halt (N-0001/0035): die gelesene Zeile, wenn sie im Bild steht; sonst die
    // erste Zeile im Bild; ohne Layout (jsdom) die gelesene Zeile oder das Suchfeld. Der Klemmfall
    // aus JOB 3121 R2 bleibt: ist die Liste kürzer geworden und die Position nicht mehr
    // erreichbar, rollt die gelesene Zeile ins Bild — so weit wie nötig.
    const stand = listenRollstand.current;
    listenRollstand.current = null;
    const zeilen = Array.from(w.querySelectorAll<HTMLElement>('[data-testid="bib-zeile"]'));
    const zeile = zeilen.find((z) => z.getAttribute("data-bib-id") === zuletztGelesen.current);
    const suchfeld = w.querySelector<HTMLElement>('[data-testid="bib-suche"]');
    const listenRoll = listenRoller();
    if (listenRoll === null || stand === null) {
      // Nichts wiederherzustellen (Erstaufruf, Deep-Link, kein Rollbereich): der Weg von JOB 3121.
      (zeile ?? suchfeld)?.focus();
      return;
    }
    listenRoll.scrollTop = stand;
    const rr = listenRoll.getBoundingClientRect();
    const imBild = (el: HTMLElement): boolean => {
      const r = el.getBoundingClientRect();
      return rr.height > 0 && r.bottom > rr.top && r.top < rr.bottom;
    };
    if (zeile !== undefined && listenRoll.scrollTop !== stand) {
      // Geklemmt: die Liste ist kürzer geworden (Auffrischung, Löschung durch andere). Ohne
      // Layout (jsdom) gibt es kein `scrollIntoView` — und auch nichts ins Bild zu rollen.
      zeile.focus({ preventScroll: true });
      zeile.scrollIntoView?.({ block: "nearest" });
      return;
    }
    const halt =
      zeile !== undefined && (rr.height === 0 || imBild(zeile))
        ? zeile
        : (zeilen.find(imBild) ?? zeile ?? suchfeld);
    halt?.focus({ preventScroll: true });
  });
  const waehle = (id: string): void => {
    if (schmal || (tablet && !listeGewuenscht)) {
      // Schmal tritt der Bericht AN DIE STELLE der Liste — der Fokus geht mit, auf seinen ersten
      // Halt (den Rückweg). Breit bleibt er, wo er ist: dort wechselt nichts den Platz.
      // JOB 3335: auf dem Lese-Tablet gilt dasselbe, sobald die Liste mit der Wahl verschwindet
      // (Vorliebe „zu"); bleibt sie als Schublade stehen, bleibt auch der Fokus auf der Zeile.
      fokusZiel.current = "bericht";
      // Und hier, VOR dem Verschwinden der Liste, ist der einzige Augenblick, in dem ihre
      // Rollposition noch abzulesen ist: gleich zeigt derselbe Rollbereich den Bericht.
      listenRollstand.current = listenRoller()?.scrollTop ?? null;
    }
    if (vorgewaehlt === undefined) {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set(EINTRAG_PARAM, id);
          return p;
        },
        { replace: true },
      );
    }
    beiWahl?.(id);
  };
  // ================================================================================================
  // JOB 3121 · UX-14 — DER RÜCKWEG: ER WÄHLT AB, MEHR NICHT.
  // ================================================================================================
  // Er räumt weder Suche noch Filter auf und ruft nichts ab (Lieferung 4): auf `/bibliothek` nimmt
  // er GENAU einen Parameter aus der Adresse — den gelesenen Eintrag. Suchbegriff, Facetten,
  // Zeitraum, Umschalter und Geltungsbereich stehen dort unverändert daneben, das geladene Fenster
  // (`windowLimit`) und die Zwischenspeicher bleiben, wie sie sind.
  //
  // AUF `/wissen/:id` TRÄGT DER PFAD DIE WAHL (`vorgewaehlt`), und ein Parameter erreicht sie
  // nicht. Dort führt der Rückweg deshalb auf die Liste selbst — mit der Adresse, die diese Fläche
  // dort ebenfalls fortschreibt (der Suchbegriff, `:523`), damit die Suche den Weg überlebt.
  // OHNE `edit`: dieser Deep-Link gehört GENAU DEM EINEN Eintrag, für den er kam, und stünde er
  // weiter in der Adresse, risse sich das Formular am nächsten gewählten Eintrag von selbst auf.
  // Das ist nicht neu entschieden, sondern die Regel der Detailroute (`KnowledgeDetail.tsx:29-33`,
  // wörtlich „Bliebe er beim Weiterblättern stehen, risse sich das Bearbeiten-Formular an jedem
  // nächsten Eintrag von selbst auf"); `rework` und `demo` reisen dort mit und reisen auch hier
  // mit. Dass „edit" damit als drittes Literal neben `KnowledgeDetail.tsx:29` und
  // `BibliothekLesen.tsx:402` steht, ist eine benannte Restschuld: ein gemeinsamer Ausdruck
  // bräuchte eine dieser beiden Dateien, und beide stehen nicht in den Zielpfaden (§4/§10).
  const zurueckZurListe = (): void => {
    zuletztGelesen.current = gewaehltEffektiv;
    fokusZiel.current = "liste";
    if (vorgewaehlt !== undefined) {
      const p = new URLSearchParams(params);
      p.delete(EINTRAG_PARAM);
      p.delete("edit");
      const suche = p.toString();
      // `replace` wie beim Blättern (`KnowledgeDetail.tsx:36-38`): der Zurück-Knopf des Browsers
      // soll die Bibliothek verlassen, nicht durch jede gelesene Zeile stolpern.
      navigate({ pathname: "/bibliothek", search: suche ? `?${suche}` : "" }, { replace: true });
      return;
    }
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete(EINTRAG_PARAM);
        return p;
      },
      { replace: true },
    );
  };
  // ================================================================================================
  // JOB 3335 · UX-21 — DER SCHALTER „TREFFERLISTE": ER ÄNDERT DIE SICHTBARKEIT DER LISTE, SONST NICHTS.
  // ================================================================================================
  // Er fasst weder `gewaehltEffektiv` noch die Adresse an (`EINTRAG_PARAM` bleibt), stösst keinen
  // Abruf an und setzt `windowLimit` nicht zurück: Suchbegriff, Facetten, Zeitraum, Umschalter,
  // Geltungsbereich und die Rollstellung der Liste überleben jedes Ein- und Ausklappen. Der Fokus
  // wandert über den vorhandenen Merker `fokusZiel`: nach dem Ausklappen auf die Trefferstelle (die
  // Zeile des offenen Berichts, sonst das Suchfeld — derselbe Zweig wie beim Rückweg), nach dem
  // Einklappen zurück auf den Schalter (s. den Zweig „schalter" im Fokuseffekt). Der Rollstand der
  // Liste wird beim Einklappen abgelesen (gleich ist die Spur weg) und über denselben Merker
  // `listenRollstand` beim Ausklappen wiederhergestellt — kein zweiter.
  const listeUmschalten = (): void => {
    if (listeGewuenscht) {
      listenRollstand.current = listenRoller()?.scrollTop ?? null;
      fokusZiel.current = "schalter";
      setTabletListe("zu");
      return;
    }
    zuletztGelesen.current = gewaehltEffektiv;
    fokusZiel.current = "liste";
    setTabletListe("offen");
  };
  const trefferFelder: readonly MatchField[] =
    win.visible.find((i) => i.ko.id === gewaehltEffektiv)?.matches ?? [];

  // ================================================================================================
  // DER WIEDERHOLKNOPF — ER REICHT SO WEIT WIE DIE FLÄCHE, DIE ER ZURÜCKHOLEN SOLL.
  // ================================================================================================
  // Er holt BEIDE Listenquellen zurück (JOB 3072 R2). Fasste er nur die Suche an, käme nach einem
  // Doppelausfall zwar der Bestand wieder, der Zustand jedes Eintrags bliebe aber auf dem Rückfall
  // `bestand` stehen — ein Knopf, der die halbe Fläche nicht erreicht.
  //
  // JOB 3088 · Q1b: DASSELBE GALT FÜR DEN EINTRAG RECHTS. Seine Abfrage ist eine dritte, unabhängige
  // (`useKo`, gehalten von `BibliothekLesen.tsx:158`); wer den Knopf drückte, bekam die Liste zurück
  // und las weiter denselben alten Eintrag mit seinem datierten Fehlersatz (an Live 1.98 gemessen,
  // Befund R-1613). Sie steht bewusst NICHT in `quellen`: das Frischemodell darüber ist eine Aussage
  // über die LISTE, und ein einzelner Eintrag darf deren Zahl und Hinweis nicht bestimmen. Angefasst
  // wird sie über den Zwischenspeicher und `koQueryKey` — den EINEN Ausdruck ihres Schlüssels
  // (`api/hooks.ts`); ein zweites Literal hier wäre die Doppelung, die auseinanderläuft.
  //
  // DIE AUSWAHL KOMMT AUS `gewaehltEffektiv`, der vorhandenen Ableitung oben — deshalb steht diese
  // Funktion hier unten und nicht mehr beim Frischemodell. Eine eigene zweite Auswahlrechnung wäre
  // genau der zweite Zustand, den diese Datei abgeschafft hat.
  //
  // REICHWEITE, AUSDRÜCKLICH ENTSCHIEDEN: `exact: true` — nur die Detailabfrage selbst, NICHT der
  // Präfix `["ko", id]`. Unter ihm liegen auch `useKoVersions` und `useKoEvidence`
  // (`api/hooks.ts`), und über die sagt dieser Knopf nichts; was er nicht verspricht, ruft er auch
  // nicht. `type: "active"` dazu: gefrischt wird nur, was wirklich montiert ist — sonst würde ein
  // Klick Abrufe für Flächen auslösen, die niemand ansieht (Bandbreite der Nutzerin, kein Nutzen).
  //
  // DER KLEINE KNOPF AUF DER LESEFLÄCHE (`BibliothekLesen.tsx:410`) BLEIBT ABSICHTLICH STEHEN: er
  // trägt den Fall, in dem die LISTE gar nicht scheitert und dieser Knopf deshalb nie angeboten
  // wird. Das ist ein zweiter ANLASS, kein zweiter Weg zum selben Zustand — nicht als Doppelung
  // entfernen.
  //
  // JOB 3088 R2 (Befund BEN, Korrekturpflicht 1) — `cancelRefetch: false`, UND ZWAR MIT GRUND.
  // TanStack bricht bei `refetchQueries` VORGABEMÄSSIG einen schon LAUFENDEN Abruf ab und startet
  // ihn neu (`query-core/queryClient.ts`, `cancelRefetch: options?.cancelRefetch ?? true` →
  // `query.fetch`). Auf dieser Fläche wäre das genau der zweite Ruf, den Auftrag §9 für den Eintrag
  // rechts ausschliesst: „Cache mit laufender Auffrischung — kein zweiter Ruf durch den Klick,
  // solange einer läuft." Der laufende Abruf holt bereits denselben Stand; ihn abzuschiessen kostet
  // die Nutzerin Bandbreite und bringt ihr nichts als Wartezeit. Läuft nichts, ist das Feld ohne
  // Wirkung — der normale Wiederholweg bleibt unverändert.
  //
  // DIE LISTENQUELLEN OBEN BEHALTEN IHR VERHALTEN (`q.refetch()` ohne dieses Feld): sie sind seit
  // JOB 3072 so, ihr Frischemodell und ihr Hinweis stehen ausdrücklich unter Bestandsschutz
  // (Auftrag §10), und §9 trifft seine Aussage über den EINTRAG. Die Ungleichheit ist damit eine
  // benannte Grenze, kein Versehen — wer sie angleichen will, tut es als eigener Auftrag an der
  // Liste, nicht nebenbei hier.
  const alleAuffrischen = (): void => {
    for (const q of quellen) {
      void q.refetch();
    }
    if (gewaehltEffektiv === null) {
      // Steht rechts kein Eintrag, gibt es rechts auch nichts zurückzuholen — kein Ruf ins Leere.
      return;
    }
    void qc.refetchQueries(
      {
        queryKey: koQueryKey(gewaehltEffektiv),
        exact: true,
        type: "active",
      },
      { cancelRefetch: false },
    );
  };

  // Beta Own-Knowledge Work Queue v0: die Linse „Eigenes Wissen" (Herkunftsfacette) mit null
  // eigenen Treffern bekommt denselben Weg wie bisher — nur als Knopf im Leerzustand statt als
  // eigene Karte mit Titel und Hinweis.
  const originValues = facetSelectedValues(wirksameAuswahl.origin);
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
    (isAnyFacetActive(wirksameAuswahl) ? 1 : 0) +
    (isFacetRangeActive(range) ? 1 : 0) +
    (segment === BIB_SEGMENT_STANDARD ? 0 : 1) +
    (groupBy === "none" ? 0 : 1);
  // „Diese Suche merken" hängt dagegen an JEDER getroffenen Wahl — der Geltungsbereich gehört in
  // eine gemerkte Sicht, also auch in diese Bedingung.
  const anyFilterActive =
    trimmedQ.length > 0 || aktiveFilterZahl > 0 || scope !== DEFAULT_LIBRARY_SCOPE;
  const bereichGruppe = groups.find((g) => g.key === BEREICH_KEY);
  const bereichGewaehlt = facetSelectedValues(wirksameAuswahl[BEREICH_KEY]);

  // ================================================================================================
  // JOB 3063 R3/R6 · JOB 3121 — DER SATZ „STAND VON <ZEIT> · AUFFRISCHUNG FEHLGESCHLAGEN".
  // ================================================================================================
  // Er wird EINMAL gebaut und an GENAU EINER Stelle gezeigt: an der Fläche, die gerade da ist.
  // Breit und schmal-ohne-Wahl ist das die Liste (unverändert, sie bekommt ihn als `hinweis`);
  // schmal mit gelesenem Bericht steht die Liste nicht auf der Fläche, und ein Hinweis, den man auf
  // dem Telefon nicht sieht, ist keiner (Auftrag §9) — dann trägt ihn der Lesebereich. Zwei Knoten
  // nebeneinander entstehen nie: `zeigeListe` entscheidet, welcher der beiden Orte ihn bekommt, und
  // `hinweisSchonGesagt` unten bleibt unverändert an `standQuelle` — der Satz steht so oder so
  // genau einmal auf der Fläche. JOB 3335: im Tablet-Band gilt dieselbe Weiche mit jedem Klappen —
  // Schublade offen → an der Liste, zu → am Bericht; nie zwei, nie null
  // (`tests/ux21-tablet-lesemodus/tablet-lesemodus-mounted.test.tsx` R9).
  const hinweisKnoten = standQuelle ? (
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
  ) : null;

  return (
    <div
      ref={wurzel}
      data-testid="bibliothek-flaeche"
      className={cx(
        "flex",
        schmal
          ? // Schmal: EINE Spalte, und KEINE feste Höhe. `h-[calc(100vh-12rem)]` rechnet mit dem
            // breiten Kopfband und zwänge den Bericht auf dem Telefon in einen zweiten Rollbereich
            // INNERHALB der ohnehin rollenden Inhaltsfläche (`AppShell.tsx:102`, `overflow-y-auto`)
            // — genau die Falle aus Auftrag §6a. Die Mindesthöhe bleibt, damit die leere Fläche
            // nicht zusammenfällt. Die Breite der Liste steht seit JOB 3335 in
            // `BibliothekListe.tsx` selbst (`lage`), nicht mehr als Fremdgriff hier.
            "min-h-[calc(100vh-12rem)] flex-col"
          : "h-[calc(100vh-12rem)] min-h-[30rem]",
        // JOB 3335 · UX-21: im Tablet-Band bleibt die feste Höhe des Desktops (768 lief bis hierher
        // schon so, und die Schublade braucht eine Höhe, in der ihre Spur rollt). `relative` ist
        // der Bezug der Schublade (`absolute inset-y-0 left-0`, `BibliothekListe.tsx`).
        tablet ? "relative" : "",
      )}
    >
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
      {zeigeListe ? (
        <BibliothekListe
          lage={listenLage}
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
          laedt={query.isLoading || keimWartet}
          // JOB 3034 R2 (nachgezogen): ein gescheiterter ABRUF ohne Bestand ist ein echter Fehler;
          // scheitert nur die AUFFRISCHUNG eines schon geholten Bestands, bleiben die Zeilen stehen
          // und der Hinweis darunter sagt es (REGELN §7 — nie den Bestand wegen eines Folgefehlers
          // leeren).
          //
          // JOB 3115 R2: dasselbe gilt für die ZWEITE Listenquelle. Ein Erstfehler von `all` ohne
          // Bestand nimmt der Fläche Zustand, Ton, Umschalter UND die Filterprüfung — sie hat dann
          // nichts zu zeigen und sagt es hier, statt zu laden oder eine Rückfall-Liste anzubieten.
          // Der Knopf dieses Zweiges (`onErneut`) holt beide Quellen zurück.
          fehler={(query.isError && query.data === undefined) || bestandsErstfehler}
          // ============================================================================================
          // JOB 3099 · Q6c — DIE DRITTE FOLGE DERSELBEN LAGE: DER LEERZWEIG KENNT SIE JETZT AUCH.
          // ============================================================================================
          // Offline wird für einen NEUEN Suchbegriff gar nicht gerufen: `isLoading` ist falsch (der
          // Abruf ist `paused`, also nicht `fetching`), `isError` ist falsch (nichts ist gescheitert),
          // und `query.data` ist für diesen Schlüssel `undefined`. Aus diesen drei Verneinungen entstand
          // in der Liste die Behauptung „erfolgreich gesucht, nichts gefunden" — gemessen von Codex an
          // 1.0.0-beta.1.103 (`R-1613-offline-20260905-1955/BEFUND.md`, Punkte 3/4: „Nichts gefunden."
          // und „Erfassen" bei NULL Suchrequests; nach Netzrückkehr genau ein Ruf und zwei Treffer).
          //
          // DIE ZWEITE BEDINGUNG (`query.data === undefined`) IST ABSICHT und steht wörtlich so schon
          // eine Zeile höher bei `fehler`: gemeint ist „für diesen Suchbegriff liegt noch KEINE Antwort
          // vor", nicht „das Gerät ist offline". Liegen Treffer im Zwischenspeicher, bleibt alles wie
          // bisher — auch ein zwischengespeichertes LEERES Ergebnis darf weiter „Nichts gefunden."
          // sagen, denn es wurde wirklich einmal erfolgreich geholt (Auftrag §9, die zwei
          // Offline-Zeilen).
          pausiert={angehalten(query) && query.data === undefined}
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
          //
          // JOB 3121: gebaut wird er jetzt oben (`hinweisKnoten`) — dieselbe Bauform, dieselbe
          // Bedingung, nur ein Ort weiter oben, weil ihn schmal der Lesebereich zeigt.
          hinweis={hinweisKnoten}
          onErneut={alleAuffrischen}
          // Eine Zahl nur, wenn sie etwas zählt, das feststeht: nicht bei ungeprüfter Auswahl und
          // nicht bei einem Bestands-Erstfehler (dort ist `isRefetchError` falsch, `frisch` allein
          // liesse also eine Zahl zu, die auf einer Rückfall-Liste stünde).
          gesamt={frisch && !keimBrauchtBestand && !bestandsErstfehler ? sorted.length : null}
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
                breite="w-[300px] max-w-[calc(100vw-2rem)] [&_button]:focus-visible:outline [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-brand"
              >
                {(schliessen) => (
                  <>
                    {viewError ? (
                      <p role="alert" className="px-2.5 py-1.5 text-[13px] text-text">
                        {t("state.error")}
                      </p>
                    ) : null}
                    <MenueUntermenue beschriftung={t("lib.menue.sichten")}>
                      <p
                        data-testid="bib-sichten-hinweis"
                        className="px-2.5 py-1.5 text-[13px] leading-snug text-text whitespace-normal [overflow-wrap:anywhere]"
                      >
                        {t("lib.views.storageHint", {
                          ownership: t(
                            viewsUserId === "anon"
                              ? "lib.views.ownershipAnon"
                              : "lib.views.ownershipSignedIn",
                          ),
                          dimensions: Object.values(LIBRARY_SAVED_VIEW_DIMENSIONS)
                            .map((key) => t(key))
                            .join(", "),
                        })}
                      </p>
                      {savedViews.map((v) => (
                        <MenuePunkt
                          key={v.name}
                          haken={
                            !keimBrauchtBestand &&
                            sameLibrarySavedViewState(
                              currentViewState,
                              readLibrarySavedViewState(v.state, LIBRARY_FACET_PARAM_KEYS),
                            )
                          }
                          onClick={() => {
                            applyView(v);
                            schliessen();
                          }}
                        >
                          <span className="block whitespace-normal [overflow-wrap:anywhere]">
                            {v.name}
                          </span>
                        </MenuePunkt>
                      ))}
                      {activeView && savedViews.some((v) => v.name === activeView) ? (
                        <MenuePunkt
                          onClick={() => {
                            try {
                              setSavedViews(
                                removeLibraryView(window.localStorage, viewsUserId, activeView),
                              );
                              setActiveView("");
                              setViewError(false);
                              schliessen();
                            } catch {
                              setViewError(true);
                            }
                          }}
                        >
                          <span className="block whitespace-normal [overflow-wrap:anywhere]">
                            {t("lib.views.remove")} · {activeView}
                          </span>
                        </MenuePunkt>
                      ) : null}
                    </MenueUntermenue>
                    {anyFilterActive ? (
                      <MenueUntermenue beschriftung={t("lib.menue.sichtSpeichern")}>
                        <MenueZeile>
                          <span className="flex min-w-0 flex-col items-stretch gap-2">
                            <label htmlFor="bib-sichtname" className="sr-only">
                              {t("lib.views.namePlaceholder")}
                            </label>
                            <input
                              id="bib-sichtname"
                              value={viewName}
                              onChange={(e) => setViewName(e.target.value)}
                              placeholder={t("lib.views.namePlaceholder")}
                              className="w-full min-w-0 rounded-input border border-hairline bg-surface px-2 py-1.5 text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                            />
                            <button
                              type="button"
                              data-testid="bib-sicht-speichern"
                              // JOB 3115: ein UNGEPRÜFTER Wert aus der Adresse erreicht keine
                              // gespeicherte Sicht. Damit bleibt die Grenze aus mega11 Block C
                              // (`lib/libraryUrlFilters.ts`) unverschoben, obwohl der Filter aus der
                              // Adresse jetzt schon vor seiner Prüfung wirkt.
                              disabled={viewName.trim().length === 0 || keimBrauchtBestand}
                              onClick={() => {
                                const name = viewName.trim();
                                try {
                                  setSavedViews(
                                    saveLibraryView(window.localStorage, viewsUserId, {
                                      name,
                                      state: currentViewState,
                                    }),
                                  );
                                  setActiveView(name);
                                  setViewName("");
                                  setViewError(false);
                                  schliessen();
                                } catch {
                                  setViewError(true);
                                }
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
                        <MenuePunkt
                          key={key}
                          haken={sortKey === key}
                          onClick={() => setSortKey(key)}
                        >
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
                          {key === "none"
                            ? t("lib.groupBy.none")
                            : t(LIBRARY_FACET_LABEL_KEYS[key])}
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
                        const gewaehlteWerte = facetSelectedValues(wirksameAuswahl[g.key]);
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
      ) : null}
      {zeigeBericht ? (
        <div
          className={cx(
            "flex min-w-0 flex-1 justify-center bg-page",
            // Breit rollt der Lesebereich in sich (unverändert). Schmal darf er das NICHT: ein
            // eigener Rollbereich nähme dem Rückweg unten die Haftung (`sticky` haftet am nächsten
            // rollenden Vorfahren) und legte einen zweiten Rollbereich in die schon rollende
            // Inhaltsfläche. Schmal rollt die Seite, wie eine Seite auf dem Telefon rollt.
            schmal ? "w-full" : "overflow-y-auto",
          )}
        >
          <div
            className={cx(
              "flex min-w-0 flex-col",
              schmal ? "w-full" : "",
              // JOB 3335 · UX-21 — DER LESERAUM des Tablets: Innenabstand und Zeilenlängengrenze
              // (600 px Text + 2 · 24 px, Begründung bei `TABLET_LISTE_WAHL` oben). `w-full` bis
              // zur Grenze, dann hält `justify-center` des Rahmens die Spalte in der Mitte. Ohne
              // beides lief der Text randlos über die Inhaltsbreite.
              tablet ? "w-full max-w-[648px] px-6" : "",
            )}
          >
            {/* ======================================================================================
              JOB 3121 · UX-14 — DER RÜCKWEG. Er steht NUR da, wo er etwas bedeutet: einspaltig, mit
              gelesenem Bericht (Telefon; Lese-Tablet, s. u.). Breit ist die Liste nie weg, ein
              Rückweg wäre dort ein Knopf ins Nichts (und drängte sich zwischen die beiden Spalten).
              Er haftet oben, damit er auch nach dem Rollen durch einen langen Bericht noch da ist.

              KEIN NEUER ÜBERSETZUNGSSCHLÜSSEL (Auftrag §4, dieselbe Regel wie beim Wiederholknopf
              der Liste): der Satz kommt aus dem vorhandenen `nb.back` („Zurück zu „{{title}}"",
              de/en/nl) mit dem vorhandenen Namen der Fläche aus `nav.library`. Er ist damit in
              allen drei Sprachen übersetzt und nennt das Ziel — was ein blosses „Zurück" nicht tut.
              Die genauere Beschriftung („Zurück zur Trefferliste") bräuchte `i18n.ts`, und die
              Datei ist nicht Zielpfad; sie ist als REST gemeldet.

              JOB 3335 · UX-21 — DIESELBE LEISTE TRÄGT IM TABLET-BAND DEN SCHALTER „TREFFERLISTE".
              Die Leiste hat eine feste Höhe (`h-12`): die Schublade beginnt genau darunter
              (`top-12` in `LAGE_KLASSE`, `BibliothekListe.tsx`), damit Rückweg UND Schalter bei offener
              Liste frei liegen und bedienbar bleiben — kein Bedienelement unter einem Überzug,
              kein unsichtbarer Fokus (N-0001/0035). Der Rückweg bleibt auch dann stehen: er
              schliesst den Bericht, und das ist mit offener Liste weiter ein Weg. Der Schalter
              ist ein echter <button> mit `aria-expanded` auf den Listenbereich (`aria-controls`
              nur, solange der im Baum steht — eine Kennung ins Leere behauptete einen Bereich,
              den es nicht gibt) und einer Beschriftung, die den Zustand nennt. Telefon und
              Desktop bekommen ihn NICHT: dort bedeutet er nichts (dieselbe Begründung wie beim
              Rückweg). */}
            {einspaltig ? (
              <div className="sticky top-0 z-10 flex h-12 items-center justify-between gap-2 bg-page">
                <button
                  type="button"
                  data-testid="bib-zurueck"
                  onClick={zurueckZurListe}
                  className="inline-flex items-center gap-1.5 rounded-btn border border-hairline bg-surface px-2.5 py-1 text-[12.5px] font-semibold text-text hover:bg-hairline-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <ArrowLeft size={15} aria-hidden className="shrink-0" />
                  {t("nb.back", { title: t("nav.library") })}
                </button>
                {tablet ? (
                  <button
                    type="button"
                    data-testid="bib-liste-schalter"
                    aria-expanded={zeigeListe}
                    aria-controls={zeigeListe ? "bib-liste" : undefined}
                    onClick={listeUmschalten}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-btn border border-hairline bg-surface px-2.5 py-1 text-[12.5px] font-semibold text-text hover:bg-hairline-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    {zeigeListe ? (
                      <PanelLeftClose size={15} aria-hidden className="shrink-0" />
                    ) : (
                      <PanelLeftOpen size={15} aria-hidden className="shrink-0" />
                    )}
                    {t(
                      zeigeListe
                        ? "lib.lesemodus.listeAusblenden"
                        : "lib.lesemodus.listeEinblenden",
                    )}
                  </button>
                ) : null}
              </div>
            ) : null}
            {/* Der Auffrischungssatz gehört auf die Fläche, die gerade da ist — s. `hinweisKnoten`. */}
            {zeigeListe ? null : hinweisKnoten}
            {/* SCRUM-291: Demo-/Pilotpfad bleibt auf der Zielseite wiedererkennbar (nur ?demo=stage1). */}
            {isDemoContext(params) ? <DemoBanner surface="library" /> : null}
            {gewaehltEffektiv ? (
              <BibliothekLesen
                key={gewaehltEffektiv}
                koId={gewaehltEffektiv}
                suchtext={trimmedQ}
                treffer={trefferFelder}
                // Steht der Satz schon auf der Fläche — an der Liste oder, schmal, gleich hier
                // darüber (`hinweisKnoten`) —, schweigt die Lesefläche dazu. Die Bedingung ist
                // unverändert `standQuelle`: WO er steht, hat sich geändert, DASS er genau einmal
                // steht, nicht.
                hinweisSchonGesagt={standQuelle !== null}
                // JOB 3362: dieselbe Regel eine Zeile tiefer, für die übersetzte Lesart. Auf
                // `/wissen/:id` — und nur dort ist `vorgewaehlt` gesetzt — steht sie seit JOB 3326
                // schon über dieser Fläche (`pages/KnowledgeDetail.tsx`); dann schweigt die
                // Lesefläche dazu und fragt sie auch nicht ein zweites Mal ab. Auf `/bibliothek`
                // gibt es diese Karte nicht, und die Lesefläche trägt die Übersetzung selbst.
                lesevarianteSchonGesagt={vorgewaehlt !== undefined}
                // JOB 3104 · UX-02: die gelöschte Wahl verlässt die ADRESSE — sonst zeigte sie nach
                // dem Löschen auf eine tote Kennung, und die Fläche sagte ihrem eigenen Nutzer „Der
                // Eintrag ließ sich nicht laden.". Wer selbst gelöscht hat, weiß, was er getan hat;
                // ihm gehört der Normalzustand, nicht der Fehlersatz.
                onGeloescht={() => {
                  setParams(
                    (prev) => {
                      const p = new URLSearchParams(prev);
                      p.delete(EINTRAG_PARAM);
                      return p;
                    },
                    { replace: true },
                  );
                  beiLoeschung?.();
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

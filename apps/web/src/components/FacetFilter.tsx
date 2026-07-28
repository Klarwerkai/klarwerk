// AUFTRAG-uxpol1 / AUFTRAG-mega10 Block B: die dynamische Filterfläche — EINE Design-Sprache für
// alle Facetten-Flächen. Aus der Reihe von Pillenzeilen ist eine schmale, geführte SCHIENE
// geworden (mobile.de-Vorbild, Pedis abgenommener Vorschlag). Es ist dasselbe Bauteil, ausgebaut —
// kein zweites daneben.
//
// SCHNITTE (Block B verlangt eine Begründung): Diese Datei ist nur noch die ANORDNUNG — Schiene,
// „Weitere Filter“, klebender Trefferzähler, Filterblatt auf schmalen Geräten. Was eine einzelne
// Dimension zeichnet, liegt in facets/FacetGroupField; der Bereichsfilter in facets/FacetRangeField;
// die aktiven Pillen in facets/FacetActiveBar (sie gehören über die TREFFERLISTE, nicht in die
// Schiene). Die reine Logik (Suche je Dimension, Deckel, Abhängigkeit, Bereich) liegt in
// lib/facetRail. So bleibt jede Einheit lesbar und einzeln prüfbar.
//
// Verbindliches Verhalten (unverändert aus uxpol1–uxpol6, ergänzt um Block B):
//  1. Genau EINE Darstellung je Dimension.
//  2. Dynamische Kontext-Zähler je Option.
//  3. 0-Treffer-Optionen ausgegraut/deaktiviert, nicht still verschluckt.
//  4. Jede aktive Auswahl als entfernbare Pille (FacetActiveBar) + „Alle zurücksetzen“.
//  5. NEU: Suchfeld je großer Dimension + „Alle N zeigen“ — der Rest ist erreichbar, nicht nur ausgewiesen.
//  6. NEU: klebender Trefferzähler unten in der Schiene, rechnet bei jedem Häkchen neu.
//  7. NEU: auf schmalen Geräten ein Vollbild-Filterblatt mit echter Dialogsemantik.
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { type FacetGroupConfig, isAnyFacetActive } from "../lib/facetFilter";
import {
  EMPTY_FACET_RANGE,
  type FacetRailGroupView,
  type FacetRange,
  isFacetRangeActive,
} from "../lib/facetRail";
import { type FacetSelection, isFacetGroupActive } from "../lib/facets";
import { usePersistentDisclosure } from "../lib/usePersistentDisclosure";
import { NARROW_QUERY, useMediaQuery } from "../shell/useMediaQuery";
import { FacetGroupField } from "./facets/FacetGroupField";
import { FacetRangeField } from "./facets/FacetRangeField";
import { cx } from "./ui";

export interface FacetFilterProps {
  configs: readonly FacetGroupConfig[];
  groups: readonly FacetRailGroupView[];
  selection: FacetSelection;
  // Gesamt-/Treffermenge für den klebenden Zähler (GESAMT vor Facetten · N nach Facetten).
  total: number;
  shown: number;
  onToggle: (key: string, value: string) => void;
  onReset: () => void;
  labelForValue: (key: string, value: string) => string;
  // Suchtext/„alle zeigen“ je Dimension trägt bereits das Gruppen-Modell (facetRailGroups baut es
  // ein) — die Komponente meldet hier nur die Änderungen zurück an den Träger, der den Zustand hält.
  onQueryChange?: (key: string, query: string) => void;
  onShowAllToggle?: (key: string) => void;
  // Gruppen mit weniger als so vielen Optionen (und ohne aktive Wahl) bleiben still — sie filtern nichts.
  minGroupOptions?: number;
  // AUFTRAG-uxpol5 · Punkt 2: seltenere Dimensionen hinter „Weitere Filter“.
  secondaryKeys?: readonly string[];
  moreStorageKey?: string;
  // Dimensionen, die als Pillenreihe statt Ankreuzliste erscheinen (kurz + tonhaltig, z. B. Reife).
  pillKeys?: readonly string[];
  toneForValue?: (key: string, value: string) => string | undefined;
  // Volltextsuche ganz oben in der Schiene — der Träger liefert sein eigenes Feld (er besitzt die Query).
  searchSlot?: ReactNode;
  // Additiver Bereichsfilter (Block B Punkt 4) — NICHT Teil der Facetten-Wertemenge.
  range?: FacetRange;
  onRangeChange?: (range: FacetRange) => void;
  rangeLabelKey?: string;
  // Hinter welcher Dimension der Bereich einsortiert wird (Führung von grob nach fein).
  rangeAfterKey?: string;
  // i18n-Schlüssel des klebenden Zählers; der Träger benennt das Ding, das gezählt wird
  // („N Beiträge anzeigen“ / „N Kandidaten“ / „N Aufgaben“).
  countLabelKey?: string;
  // Hintergrund, der beim geöffneten Filterblatt inert geschaltet wird (Fokus bleibt im Blatt).
  backgroundRef?: RefObject<HTMLElement | null>;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusablesIn(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) {
    return [];
  }
  // Kein offsetParent-Filter: jsdom rechnet kein Layout. `hidden`/`aria-hidden` fliegen raus; im
  // echten Browser sichert zusätzlich die Inert-Schaltung des Hintergrunds die Abgrenzung.
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (el) => !el.hasAttribute("hidden") && el.closest("[hidden],[aria-hidden='true']") === null,
  );
}

// Eine Gruppe filtert nur, wenn sie genug Optionen hat ODER bereits eine Wahl trägt (dann sichtbar
// halten, damit das Abwählen möglich bleibt).
function isGroupVisible(
  group: FacetRailGroupView,
  selection: FacetSelection,
  minGroupOptions: number,
): boolean {
  // AUFTRAG-mega10 Block B Punkt 2: eine EINGESCHRÄNKTE Kindgruppe (Schlagwort unter gewählter
  // Kategorie) bleibt sichtbar, sobald sie überhaupt einen Wert hat. Ohne diese Ausnahme fiele sie
  // unter die Schwelle und verschwände genau in dem Moment, in dem die Führung sie zeigen soll —
  // der Nutzer hätte gerade eingegrenzt und bekäme die feinere Ebene weggenommen.
  if (group.restricted && group.totalCount > 0) {
    return true;
  }
  return group.totalCount >= minGroupOptions || isFacetGroupActive(selection[group.key]);
}

export function FacetFilter(props: FacetFilterProps): JSX.Element {
  const { t } = useTranslation();
  const narrow = useMediaQuery(NARROW_QUERY);
  const [sheetOpen, setSheetOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDialogElement | null>(null);
  const { backgroundRef } = props;

  // Öffnen: Hintergrund inert, Fokus ins Blatt. Schließen (Cleanup): erst Hintergrund wieder aktiv,
  // DANN Fokus zurück auf den Auslöser — die Reihenfolge ist wichtig, sonst liefe der Restore ins
  // inerte Element. Gleiches Muster wie MobileNavDrawer (dort abgenommen).
  useEffect(() => {
    if (!sheetOpen) {
      return;
    }
    const trigger = triggerRef.current;
    const background = backgroundRef?.current ?? null;
    background?.setAttribute("inert", "");
    const panel = panelRef.current;
    const first = focusablesIn(panel)[0];
    (first ?? panel)?.focus();
    return () => {
      background?.removeAttribute("inert");
      trigger?.focus();
    };
  }, [sheetOpen, backgroundRef]);

  // Auf breiten Geräten kann kein Blatt offen bleiben (sonst hinge ein unsichtbarer Dialog).
  useEffect(() => {
    if (!narrow) {
      setSheetOpen(false);
    }
  }, [narrow]);

  if (!narrow) {
    return (
      <aside className="sticky top-2 self-start rounded-card border border-hairline bg-surface">
        <RailBody {...props} idPrefix="facet-rail" />
      </aside>
    );
  }

  const activeCount = countActiveFilters(props);
  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>): void => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setSheetOpen(false);
      return;
    }
    if (e.key !== "Tab") {
      return;
    }
    // Fokusfalle: Tab am Ende springt zum Anfang, Shift+Tab am Anfang ans Ende.
    const focusables = focusablesIn(panelRef.current);
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={sheetOpen}
        onClick={() => setSheetOpen(true)}
        className="mb-2.5 inline-flex items-center gap-2 rounded-btn border border-hairline bg-surface px-3 py-2 text-[13px] font-semibold text-text hover:border-ink/30"
      >
        <SlidersHorizontal size={15} aria-hidden />
        {t("facet.openFilters")}
        {activeCount > 0 ? (
          <span className="rounded-pill bg-brand px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-white">
            {activeCount}
          </span>
        ) : null}
      </button>
      {sheetOpen ? (
        <div className="fixed inset-0 z-40">
          {/* Nicht fokussierbare, rein präsentierende Fläche — die zugängliche Schließen-Aktion
              sind der X-Knopf und Escape (gleiche Regel wie beim Navigations-Drawer). */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: Tastatur-Schließen läuft über Escape/X im Dialog. */}
          <div
            aria-hidden="true"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <dialog
            ref={panelRef}
            open
            aria-modal="true"
            aria-label={t("facet.sheetTitle")}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            className="absolute inset-0 m-0 flex h-full max-h-none w-full max-w-none flex-col bg-surface p-0 text-text outline-none"
          >
            <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
              <h2 className="flex-1 text-[15px] font-semibold text-ink">{t("facet.sheetTitle")}</h2>
              <button
                type="button"
                aria-label={t("facet.closeFilters")}
                onClick={() => setSheetOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
              >
                <X size={18} />
              </button>
            </div>
            <RailBody
              {...props}
              idPrefix="facet-sheet"
              onApply={() => setSheetOpen(false)}
              className="min-h-0 flex-1"
            />
          </dialog>
        </div>
      ) : null}
    </>
  );
}

// Zahl der aktiven Filter für die Plakette am „Filter“-Knopf (Facetten-Werte + Bereichsgrenzen).
function countActiveFilters(props: FacetFilterProps): number {
  let n = 0;
  for (const cfg of props.configs) {
    const sel = props.selection[cfg.key];
    if (isFacetGroupActive(sel)) {
      n += Array.isArray(sel) ? sel.length : 1;
    }
  }
  const range = props.range ?? EMPTY_FACET_RANGE;
  return n + (range.from ? 1 : 0) + (range.to ? 1 : 0);
}

// Der Inhalt der Schiene — identisch in der Desktop-Spalte und im Filterblatt. Nur die Feld-Ids
// unterscheiden sich (idPrefix), damit `label for` in beiden Fällen eindeutig bleibt.
function RailBody({
  groups,
  selection,
  total,
  shown,
  onToggle,
  onReset,
  labelForValue,
  onQueryChange,
  onShowAllToggle,
  minGroupOptions = 2,
  secondaryKeys,
  moreStorageKey,
  pillKeys,
  toneForValue,
  searchSlot,
  range = EMPTY_FACET_RANGE,
  onRangeChange,
  rangeLabelKey = "facet.rangeLabel",
  rangeAfterKey,
  countLabelKey = "facet.showResults",
  idPrefix,
  onApply,
  className,
}: FacetFilterProps & {
  idPrefix: string;
  onApply?: () => void;
  className?: string;
}): JSX.Element {
  const { t } = useTranslation();
  const secondarySet = new Set(secondaryKeys ?? []);
  const pillSet = new Set(pillKeys ?? []);
  const visibleGroups = groups.filter((g) => isGroupVisible(g, selection, minGroupOptions));
  const primaryGroups = visibleGroups.filter((g) => !secondarySet.has(g.key));
  const secondaryGroups = visibleGroups.filter((g) => secondarySet.has(g.key));
  // AUFTRAG-uxpol6 (bens GELB 2.1): den STABILEN Speicherschlüssel IMMER übergeben — der Hook liest
  // den gespeicherten Wert nur im useState-Initializer.
  const [moreOpen, toggleMore] = usePersistentDisclosure(moreStorageKey, { defaultOpen: false });
  // Ehrlichkeit des Zählers: „gefiltert“ hängt daran, ob ein FILTER AKTIV ist — nicht daran, ob er
  // gerade etwas wegnimmt. Eine aktive Auswahl, die zufällig alles trifft (z. B. eine migrierte
  // Altsicht über beide offenen Reifegrade), ist trotzdem ein Filter; „gesamter Bestand“ zu melden
  // wäre schlicht falsch. Diesen Fall pinnt library-view-migration-mounted.
  const filtered = isAnyFacetActive(selection) || isFacetRangeActive(range);

  const renderGroup = (group: FacetRailGroupView): JSX.Element => (
    <FacetGroupField
      key={group.key}
      group={group}
      labelForValue={labelForValue}
      onToggle={onToggle}
      onQueryChange={(key, query) => onQueryChange?.(key, query)}
      onShowAllToggle={(key) => onShowAllToggle?.(key)}
      asPills={pillSet.has(group.key)}
      toneForValue={toneForValue ? (value) => toneForValue(group.key, value) : undefined}
      idPrefix={idPrefix}
    />
  );

  // Der Bereich wird hinter seiner Anker-Dimension einsortiert; ohne Anker steht er vorn.
  const rangeField =
    onRangeChange !== undefined ? (
      <FacetRangeField
        key="__range__"
        range={range}
        onChange={onRangeChange}
        labelKey={rangeLabelKey}
        idPrefix={idPrefix}
      />
    ) : null;
  const primaryWithRange: ReactNode[] = [];
  if (rangeField && !rangeAfterKey) {
    primaryWithRange.push(rangeField);
  }
  for (const group of primaryGroups) {
    primaryWithRange.push(renderGroup(group));
    if (rangeField && rangeAfterKey === group.key) {
      primaryWithRange.push(rangeField);
    }
  }

  return (
    <div className={cx("flex flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-1">
        {searchSlot ? <div className="border-b border-hairline-soft py-3">{searchSlot}</div> : null}
        {primaryWithRange}
        {secondaryGroups.length > 0 ? (
          <div className="border-t border-hairline-soft">
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={toggleMore}
              className="flex w-full items-center gap-1.5 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-text"
            >
              <ChevronDown
                size={13}
                aria-hidden
                className={cx("transition-transform", moreOpen && "rotate-180")}
              />
              {t("facet.moreFilters")}
            </button>
            {moreOpen ? <div>{secondaryGroups.map(renderGroup)}</div> : null}
          </div>
        ) : null}
      </div>

      {/* Block B Punkt 3: der KLEBENDE Trefferzähler. Er rechnet bei jedem Häkchen neu. Auf dem
          Desktop ist er ein Anker (die Liste filtert ohnehin sofort) und deshalb bewusst KEIN
          Knopf — ein Knopf, der nichts tut, wäre unehrlich. Im Filterblatt ist er die Aktion, die
          das Blatt schließt. */}
      <div className="flex flex-col gap-1.5 border-t border-hairline px-3.5 py-2.5">
        {onApply ? (
          <button
            type="button"
            onClick={onApply}
            className="w-full rounded-btn bg-brand px-3 py-3 text-center text-[14px] font-bold text-white shadow-tile hover:opacity-95"
          >
            {t(countLabelKey, { count: shown })}
            <span className="mt-0.5 block text-[11px] font-medium opacity-90">
              {filtered ? t("facet.countFiltered", { total }) : t("facet.countAll")}
            </span>
          </button>
        ) : (
          <output className="block text-[14px] font-bold leading-tight text-ink">
            {t(countLabelKey, { count: shown })}
            <span className="mt-0.5 block text-[11px] font-medium text-muted-2">
              {filtered ? t("facet.countFiltered", { total }) : t("facet.countAll")}
            </span>
          </output>
        )}
        <button
          type="button"
          onClick={onReset}
          className="rounded-btn px-2 py-1 text-[11.5px] text-muted underline underline-offset-2 hover:text-text"
        >
          {t("facet.reset")}
        </button>
      </div>
    </div>
  );
}

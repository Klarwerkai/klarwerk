// AUFTRAG-uxpol1: generische, dynamische Filterleiste — EINE Design-Sprache für alle Facetten-Flächen.
// Rein präsentational + kontrolliert: das View-Modell (Optionen mit Kontext-Zählern, ausgegraute
// 0-Optionen) kommt aus lib/facetFilter; Auswahl/Reset steuert der Aufrufer. Verhalten (verbindlich):
//  1. Genau EINE Darstellung je Dimension (keine Dropdown-oben/Chip-unten-Dopplung mehr).
//  2. Dynamische Zähler je Option (rechnen sich bei jeder Auswahl neu — im Kontext der übrigen Facetten).
//  3. 0-Treffer-Optionen ausgegraut/deaktiviert (nicht klickbar), nicht still verschluckt.
//  4. Aktive-Filter-Leiste: je aktiver Auswahl eine entfernbare Pille + „Alle zurücksetzen".
//  5. Trefferzeile „Treffer: N von GESAMT" + dezenter „gefiltert"-Hinweis, wenn Filter aktiv.
// Barrierearm: echte <button>, aria-pressed für Chip-Zustand, Zustand als TEXT (Zähler/Label), nicht nur Farbe.
import { ChevronDown, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  type FacetGroupConfig,
  type FacetGroupView,
  activeFacetPills,
  isAnyFacetActive,
} from "../lib/facetFilter";
import { type FacetSelection, isFacetGroupActive } from "../lib/facets";
import { usePersistentDisclosure } from "../lib/usePersistentDisclosure";
import { cx } from "./ui";

export interface FacetFilterProps {
  configs: readonly FacetGroupConfig[];
  groups: readonly FacetGroupView[];
  selection: FacetSelection;
  // Gesamt-/Treffermenge für die Trefferzeile (GESAMT vor Facetten · N nach Facetten).
  total: number;
  shown: number;
  onToggle: (key: string, value: string) => void;
  onReset: () => void;
  // AUFTRAG-uxpol4 (bens ROT 3.1): eine No-Match-Pille hat keinen echten Wert zum Abwählen — ihr
  // Entfernen löst die ganze Dimension. Optional: Träger ohne migrierte Sichten brauchen ihn nicht.
  onClearGroup?: (key: string) => void;
  // Anzeige-Label eines Facetten-Werts (lokalisiert/aufgelöst; z. B. Autor-Name, Status-Text).
  labelForValue: (key: string, value: string) => string;
  // Gruppen mit weniger als so vielen Optionen (und ohne aktive Wahl) bleiben still — sie filtern nichts.
  minGroupOptions?: number;
  // AUFTRAG-uxpol5 · Punkt 2 (Pedis Höhe/Priorisierung): Keys der SELTENEREN Dimensionen — sie wandern
  // hinter einen aufklappbaren Bereich „Weitere Filter" (primäre Facetten bleiben immer sichtbar).
  // Aktive Auswahlen aus dem eingeklappten Bereich bleiben trotzdem als Pille oben sichtbar (nichts
  // „versteckt aktiv"). Leer ⇒ keine Aufteilung (alle Gruppen primär) — Rückwärtskompatibilität.
  secondaryKeys?: readonly string[];
  // localStorage-Schlüssel für den Auf-/Zu-Zustand von „Weitere Filter" (pro Browser gemerkt).
  moreStorageKey?: string;
}

// Eine Gruppe filtert nur, wenn sie genug Optionen hat ODER bereits eine Wahl trägt (dann sichtbar
// halten, damit das Abwählen möglich bleibt) — dieselbe Regel primär wie hinter „Weitere Filter".
function isGroupVisible(
  group: FacetGroupView,
  selection: FacetSelection,
  minGroupOptions: number,
): boolean {
  return group.options.length >= minGroupOptions || isFacetGroupActive(selection[group.key]);
}

const CHIP_BASE =
  "rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors";

export function FacetFilter({
  configs,
  groups,
  selection,
  total,
  shown,
  onToggle,
  onReset,
  onClearGroup,
  labelForValue,
  minGroupOptions = 2,
  secondaryKeys,
  moreStorageKey,
}: FacetFilterProps): JSX.Element {
  const { t } = useTranslation();
  const active = isAnyFacetActive(selection);
  const pills = activeFacetPills(configs, selection);
  const labelOf = (key: string): string => {
    const cfg = configs.find((c) => c.key === key);
    return cfg ? t(cfg.labelKey) : key;
  };

  // Punkt 2: sichtbare Gruppen in primär / sekundär teilen. Sekundäre (seltenere) Facetten kommen
  // hinter „Weitere Filter" — nur gebaut, wenn dort tatsächlich etwas filterbar ist.
  const secondarySet = new Set(secondaryKeys ?? []);
  const visibleGroups = groups.filter((g) => isGroupVisible(g, selection, minGroupOptions));
  const primaryGroups = visibleGroups.filter((g) => !secondarySet.has(g.key));
  const secondaryGroups = visibleGroups.filter((g) => secondarySet.has(g.key));
  // AUFTRAG-uxpol6 (bens GELB 2.1): den STABILEN Speicherschlüssel IMMER übergeben — unabhängig davon,
  // ob gerade Sekundärgruppen sichtbar sind. Der Hook liest den gespeicherten Wert nur im
  // useState-Initializer; ein erst später (Query-/Datenwechsel in derselben Instanz) erscheinender
  // Bereich würde sonst ein gespeichertes „offen" fälschlich als „zu" zeigen.
  const [moreOpen, toggleMore] = usePersistentDisclosure(moreStorageKey, { defaultOpen: false });

  const renderGroup = (group: FacetGroupView): JSX.Element => (
    <div key={group.key} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
        {t(group.labelKey)}:
      </span>
      {group.options.map((o) => (
        <button
          key={o.value || "—"}
          type="button"
          aria-pressed={o.selected}
          disabled={o.disabled}
          onClick={() => onToggle(group.key, o.value)}
          className={`${CHIP_BASE} ${
            o.selected
              ? "border-ink bg-ink text-white"
              : o.disabled
                ? "cursor-not-allowed border-hairline-soft text-muted-2 opacity-50"
                : "border-hairline text-muted hover:text-text"
          }`}
        >
          {labelForValue(group.key, o.value)} · {o.count}
        </button>
      ))}
      {group.hiddenCount > 0 ? (
        <span className="text-[10.5px] text-muted-2">
          {t("facet.more", { n: group.hiddenCount })}
        </span>
      ) : null}
    </div>
  );

  return (
    <div className="mb-3 space-y-2">
      {/* (4) Aktive-Filter-Leiste — je Auswahl eine entfernbare Pille + Alle zurücksetzen. */}
      {active ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-card border border-hairline bg-page px-2.5 py-2">
          <span className="mr-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
            {t("facet.active")}:
          </span>
          {pills.map((p) => {
            // AUFTRAG-uxpol4 (bens ROT 3.1): der STRUKTURELLE No-Match-Zustand (leere Schnittmenge einer
            // widersprüchlichen Altsicht) erscheint als ehrliche „0 Treffer"-Pille — Entfernen löst die
            // ganze Dimension (kein echter Wert, kein Aufruf von labelForValue, kein roher Marker-Text).
            const label = p.noMatch
              ? `${labelOf(p.key)}: ${t("facet.noMatch")}`
              : `${labelOf(p.key)}: ${labelForValue(p.key, p.value)}`;
            const remove = p.noMatch ? () => onClearGroup?.(p.key) : () => onToggle(p.key, p.value);
            return (
              <button
                key={p.noMatch ? `${p.key}:__nomatch__` : `${p.key}:${p.value}`}
                type="button"
                onClick={remove}
                aria-label={t("facet.remove", { label })}
                className={`${CHIP_BASE} inline-flex items-center gap-1 border-ink/25 bg-surface text-text hover:border-ink/40`}
              >
                <span>{label}</span>
                <X size={11} aria-hidden />
              </button>
            );
          })}
          <button
            type="button"
            onClick={onReset}
            className="ml-1 rounded-pill px-2 py-1 font-mono text-[11px] font-semibold text-muted underline-offset-2 hover:text-text hover:underline"
          >
            {t("facet.reset")}
          </button>
        </div>
      ) : null}

      {/* (1)(2)(3) Primäre Facetten — immer sichtbar (Reife/Kategorie/Autor). Genau eine Darstellung
          je Dimension, dynamische Zähler, 0-Optionen ausgegraut. */}
      {primaryGroups.map(renderGroup)}

      {/* Punkt 2: seltenere Facetten hinter einem aufklappbaren „Weitere Filter" (Standard: zu; Zustand
          pro Browser gemerkt). Aktive Auswahlen daraus bleiben oben als Pille sichtbar — nichts versteckt. */}
      {secondaryGroups.length > 0 ? (
        <div className="space-y-2">
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={toggleMore}
            className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-text"
          >
            <ChevronDown
              size={13}
              aria-hidden
              className={cx("transition-transform", moreOpen && "rotate-180")}
            />
            {t("facet.moreFilters")}
          </button>
          {moreOpen ? <div className="space-y-2">{secondaryGroups.map(renderGroup)}</div> : null}
        </div>
      ) : null}

      {/* (5) Trefferzeile — „Treffer: N von GESAMT" + dezenter „gefiltert"-Hinweis bei aktivem Filter. */}
      <div className="flex items-center gap-2 font-mono text-[11px] text-muted-2">
        <span>{t("facet.result", { shown, total })}</span>
        {active ? <span className="text-trust-warn-text">{t("facet.filtered")}</span> : null}
      </div>
    </div>
  );
}

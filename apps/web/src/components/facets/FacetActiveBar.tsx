// AUFTRAG-mega10 Block B: die Aktive-Filter-Leiste — herausgelöst aus FacetFilter.
//
// Schnitt-Begründung: In der Wand saß sie ÜBER den Pillenreihen. In der Schienen-Anordnung gehört
// sie über die TREFFERLISTE (dorthin schaut man, wenn man das Ergebnis liest) und nicht in die
// schmale Schiene. Weil Schiene und Trefferliste jetzt zwei getrennte Flächen sind, ist sie ein
// eigenes Bauteil, das der Träger platziert.
//
// Der uxpol-Vertrag bleibt unverändert: JEDE aktive Auswahl ist hier als entfernbare Pille
// sichtbar — auch die aus einer eingeklappten Gruppe, auch das strukturelle No-Match (als ehrliche
// „0 Treffer“-Pille ohne echten Wert), jetzt zusätzlich der additive Bereichsfilter.
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type FacetGroupConfig, activeFacetPills, isAnyFacetActive } from "../../lib/facetFilter";
import { EMPTY_FACET_RANGE, type FacetRange, isFacetRangeActive } from "../../lib/facetRail";
import type { FacetSelection } from "../../lib/facets";

export interface FacetActiveBarProps {
  configs: readonly FacetGroupConfig[];
  selection: FacetSelection;
  onToggle: (key: string, value: string) => void;
  onReset: () => void;
  onClearGroup?: (key: string) => void;
  labelForValue: (key: string, value: string) => string;
  // Additiver Bereichsfilter — je gesetzter Grenze eine eigene Pille (sie sind einzeln lösbar).
  range?: FacetRange;
  onRangeChange?: (range: FacetRange) => void;
  rangeLabelKey?: string;
}

const PILL =
  "inline-flex items-center gap-1 rounded-pill border border-ink/25 bg-surface px-2.5 py-1 font-mono text-[11px] font-semibold text-text transition-colors hover:border-ink/40";

export function FacetActiveBar({
  configs,
  selection,
  onToggle,
  onReset,
  onClearGroup,
  labelForValue,
  range = EMPTY_FACET_RANGE,
  onRangeChange,
  rangeLabelKey = "facet.rangeLabel",
}: FacetActiveBarProps): JSX.Element | null {
  const { t } = useTranslation();
  const rangeActive = isFacetRangeActive(range);
  if (!isAnyFacetActive(selection) && !rangeActive) {
    return null;
  }
  const pills = activeFacetPills(configs, selection);
  const labelOf = (key: string): string => {
    const cfg = configs.find((c) => c.key === key);
    return cfg ? t(cfg.labelKey) : key;
  };

  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-1.5 rounded-card border border-hairline bg-surface px-2.5 py-2">
      <span className="mr-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
        {t("facet.active")}:
      </span>
      {pills.map((p) => {
        // AUFTRAG-uxpol4 (bens ROT 3.1): das STRUKTURELLE No-Match erscheint als ehrliche
        // „0 Treffer“-Pille — kein echter Wert, kein Aufruf von labelForValue, kein roher Marker-Text.
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
            className={PILL}
          >
            <span>{label}</span>
            <X size={11} aria-hidden />
          </button>
        );
      })}
      {/* Bereichs-Pillen: „von“ und „bis“ sind einzeln entfernbar (nicht nur zusammen). */}
      {range.from ? (
        <button
          type="button"
          onClick={() => onRangeChange?.({ ...range, from: "" })}
          aria-label={t("facet.remove", {
            label: `${t(rangeLabelKey)}: ${t("facet.rangeFromPill", { date: range.from })}`,
          })}
          className={PILL}
        >
          <span>
            {t(rangeLabelKey)}: {t("facet.rangeFromPill", { date: range.from })}
          </span>
          <X size={11} aria-hidden />
        </button>
      ) : null}
      {range.to ? (
        <button
          type="button"
          onClick={() => onRangeChange?.({ ...range, to: "" })}
          aria-label={t("facet.remove", {
            label: `${t(rangeLabelKey)}: ${t("facet.rangeToPill", { date: range.to })}`,
          })}
          className={PILL}
        >
          <span>
            {t(rangeLabelKey)}: {t("facet.rangeToPill", { date: range.to })}
          </span>
          <X size={11} aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onReset}
        className="ml-1 rounded-pill px-2 py-1 font-mono text-[11px] font-semibold text-muted underline-offset-2 hover:text-text hover:underline"
      >
        {t("facet.reset")}
      </button>
    </div>
  );
}

// AUFTRAG-mega10 Block B Punkt 4: der Bereichsfilter „Zuletzt geändert von / bis“.
//
// Er steht ausdrücklich NEBEN der Facettenauswahl, nicht darin — `FacetSelection` ist eine
// Wertemenge je Gruppe, und auf diesem Vertrag ruhen bens struktureller No-Match und die
// semantiktreue Sicht-Migration. Ein Bereich ist kein Wert. Die Begründung steht ausführlich in
// lib/facetRail.ts; hier ist nur die Anzeige.
//
// Barrierearm: zwei echte <input type="date"> mit sichtbarem <label for>. Ein widersprüchlicher
// Bereich (von > bis) wird als TEXT gemeldet, statt kommentarlos 0 Treffer zu zeigen.
import { useTranslation } from "react-i18next";
import { type FacetRange, isFacetRangeContradictory } from "../../lib/facetRail";

export interface FacetRangeFieldProps {
  range: FacetRange;
  onChange: (range: FacetRange) => void;
  // i18n-Schlüssel der Bereichs-Überschrift (der Träger benennt, WORAUF sich der Bereich bezieht).
  labelKey: string;
  idPrefix: string;
}

export function FacetRangeField({
  range,
  onChange,
  labelKey,
  idPrefix,
}: FacetRangeFieldProps): JSX.Element {
  const { t } = useTranslation();
  const fromId = `${idPrefix}-range-from`;
  const toId = `${idPrefix}-range-to`;
  const contradictory = isFacetRangeContradictory(range);

  return (
    <div className="border-b border-hairline-soft py-3 last:border-b-0">
      <div className="mb-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
        {t(labelKey)}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label htmlFor={fromId} className="mb-0.5 block text-[10.5px] text-muted-2">
            {t("facet.rangeFrom")}
          </label>
          <input
            id={fromId}
            type="date"
            value={range.from}
            onChange={(e) => onChange({ ...range, from: e.target.value })}
            className="h-8 w-full rounded-input border border-hairline bg-surface px-2 text-[12.5px] text-text outline-none focus:border-ink/30"
          />
        </div>
        <div>
          <label htmlFor={toId} className="mb-0.5 block text-[10.5px] text-muted-2">
            {t("facet.rangeTo")}
          </label>
          <input
            id={toId}
            type="date"
            value={range.to}
            onChange={(e) => onChange({ ...range, to: e.target.value })}
            className="h-8 w-full rounded-input border border-hairline bg-surface px-2 text-[12.5px] text-text outline-none focus:border-ink/30"
          />
        </div>
      </div>
      {contradictory ? (
        <p className="mt-1 text-[11px] text-trust-warn-text">{t("facet.rangeContradictory")}</p>
      ) : null}
    </div>
  );
}

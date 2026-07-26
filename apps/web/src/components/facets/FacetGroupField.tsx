// AUFTRAG-mega10 Block B: EINE Dimension in der Filterschiene.
//
// Schnitt-Begründung: `FacetFilter` war eine Datei, die Leiste UND Gruppe UND Pillen zeichnete. Mit
// Suchfeld, Deckel-Umschalter und abhängiger Auswahl je Gruppe wäre sie unlesbar geworden. Diese
// Datei ist deshalb genau EINE Dimension — und dadurch für sich prüfbar. Es ist KEIN zweites
// Bauteil neben FacetFilter: FacetFilter setzt sich aus diesen Feldern zusammen.
//
// Barrierearm (Punkt 7): echte <input type="checkbox"> in einem <label> (bzw. echte <button> mit
// aria-pressed in der Pillen-Darstellung), jeder Zustand als TEXT (Zähler, Beschriftung, „Alle N
// zeigen"), nicht nur als Farbe. Das Suchfeld ist ein <input type="search"> mit <label for>.
import { useTranslation } from "react-i18next";
import type { FacetRailGroupView } from "../../lib/facetRail";
import { cx } from "../ui";

export interface FacetGroupFieldProps {
  group: FacetRailGroupView;
  // Anzeige-Label eines Facetten-Werts (Autor-Name statt Id, lokalisierter Status, …).
  labelForValue: (key: string, value: string) => string;
  onToggle: (key: string, value: string) => void;
  onQueryChange: (key: string, query: string) => void;
  onShowAllToggle: (key: string) => void;
  // Diese Dimension als Pillenreihe statt als Ankreuzliste zeichnen (für kurze, tonhaltige
  // Dimensionen wie die Reife — dort ist die Reihe schneller zu erfassen als eine Liste).
  asPills?: boolean;
  // Tönung je Wert (nur in der Pillen-Darstellung; z. B. Reife nutzbar/in Prüfung/zu prüfen).
  toneForValue?: ((value: string) => string | undefined) | undefined;
  // Eindeutiges Präfix für die Feld-Ids — dieselbe Gruppe kann in Schiene UND Filterblatt stehen.
  idPrefix: string;
}

const PILL_BASE =
  "rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors";

export function FacetGroupField({
  group,
  labelForValue,
  onToggle,
  onQueryChange,
  onShowAllToggle,
  asPills = false,
  toneForValue,
  idPrefix,
}: FacetGroupFieldProps): JSX.Element {
  const { t } = useTranslation();
  const groupLabel = t(group.labelKey);
  const searchId = `${idPrefix}-search-${group.key}`;

  return (
    <div className="border-b border-hairline-soft py-3 last:border-b-0">
      <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
          {groupLabel}
        </span>
        {/* Block B Punkt 2: die Einschränkung durch die übergeordnete Dimension wird AUSGEWIESEN —
            eine stille Verkürzung der Werteliste wäre genau das Verschweigen, das uxpol verbietet. */}
        {group.restricted ? (
          <span className="text-[10.5px] text-muted-2">{t("facet.restricted")}</span>
        ) : null}
      </div>

      {/* Punkt 1: Suchfeld INNERHALB der Dimension — nur dort, wo es etwas zu suchen gibt. */}
      {group.searchable ? (
        <div className="mb-1.5">
          <label htmlFor={searchId} className="sr-only">
            {t("facet.searchLabel", { label: groupLabel })}
          </label>
          <input
            id={searchId}
            type="search"
            value={group.query}
            onChange={(e) => onQueryChange(group.key, e.target.value)}
            placeholder={t("facet.searchPlaceholder", { label: groupLabel })}
            className="h-8 w-full rounded-input border border-hairline bg-surface px-2 text-[12.5px] text-text outline-none placeholder:text-muted-2 focus:border-ink/30"
          />
        </div>
      ) : null}

      {asPills ? (
        <div className="flex flex-wrap gap-1.5">
          {group.options.map((o) => (
            <button
              key={o.value || "—"}
              type="button"
              aria-pressed={o.selected}
              disabled={o.disabled}
              onClick={() => onToggle(group.key, o.value)}
              className={cx(
                PILL_BASE,
                o.selected
                  ? (toneForValue?.(o.value) ?? "border-ink bg-ink text-white")
                  : o.disabled
                    ? "cursor-not-allowed border-hairline-soft text-muted-2 opacity-50"
                    : "border-hairline text-muted hover:text-text",
              )}
            >
              {labelForValue(group.key, o.value)} · {o.count}
            </button>
          ))}
        </div>
      ) : (
        // Ankreuzliste: echte Checkboxen, scrollbar gedeckelt, Zähler rechts als Text.
        <fieldset className="m-0 max-h-[186px] overflow-y-auto border-0 p-0 pr-0.5">
          <legend className="sr-only">{groupLabel}</legend>
          {group.options.map((o) => (
            <label
              key={o.value || "—"}
              className={cx(
                "flex items-center gap-2 rounded-btn px-1 py-1 text-[12.5px] text-text-soft",
                o.disabled
                  ? "cursor-not-allowed opacity-45"
                  : "cursor-pointer hover:bg-hairline-soft",
              )}
            >
              <input
                type="checkbox"
                checked={o.selected}
                disabled={o.disabled}
                onChange={() => onToggle(group.key, o.value)}
                className="h-3.5 w-3.5 shrink-0 accent-brand"
              />
              <span className="min-w-0 flex-1 truncate">{labelForValue(group.key, o.value)}</span>
              <span className="shrink-0 font-mono text-[10.5px] text-muted-2">{o.count}</span>
            </label>
          ))}
        </fieldset>
      )}

      {/* Ehrlicher Leerzustand der Dimensions-Suche — nicht einfach eine leere Liste. */}
      {group.noSearchHit ? (
        <p className="px-1 py-1.5 text-[11.5px] text-muted-2">
          {t("facet.searchNoHit", { query: group.query })}
        </p>
      ) : null}

      {/* Punkt 1: der Deckel ist ab jetzt AUFMACHBAR — „+ N weitere“ war sichtbar, aber unerreichbar. */}
      {group.hiddenCount > 0 || group.showAll ? (
        <button
          type="button"
          aria-expanded={group.showAll}
          onClick={() => onShowAllToggle(group.key)}
          className="mt-1 rounded-btn px-1 py-0.5 text-[11.5px] text-brand-text underline underline-offset-2 hover:text-ink"
        >
          {group.showAll
            ? t("facet.showLess")
            : t("facet.showAll", { n: group.totalCount, label: groupLabel })}
        </button>
      ) : null}
    </div>
  );
}

// ================================================================================================
// FE-MGMT-09 / FR-EXT-04 / R-0751 (Nacharbeit 1) — GERANKTE LISTE MIT SCORE, FLAGS UND FAKTOR-DETAIL.
// ================================================================================================
//
// Abnahme der Quelle: „Gerankte Liste mit Score, Flags, Faktor-Detail"; filtern lässt sich nach
// allem, nach Bus-Faktor eins, nach Veraltetem und nach hohem Schutzwert. Die Fläche RECHNET NICHTS:
// Score, Faktoren und Flags kommen aus dem Management-Snapshot (services/management/src/metrics.ts).
//
// Ein Faktor ohne Eingangsdaten (`value: null`) steht im Detail als „keine Eingangsdaten" — nie als
// 0 und nie als Schätzung. Fehlen einem Faktor in ALLEN Zeilen die Daten, sagt ein Satz über der
// Liste, welche das sind; der Score ist dann ausdrücklich aus den übrigen berechnet.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MgmtPriority, MgmtPriorityFactorKey, MgmtPriorityFlag } from "../api/types";
import { cx } from "./ui";

type Filter = "all" | MgmtPriorityFlag;
const FILTER: readonly Filter[] = ["all", "busFactorOne", "stale", "highProtection"];

// R-0908: „Bus-Faktor 1" stand unerklärt auf Filter und Markierung. Der Filter nennt jetzt zuerst,
// was es heißt („Nur eine Person …"), und behält das Fachwort in Klammern; die Texte stehen in
// `texte/fachwort.ts`. Die übrigen Filter und Markierungen kommen unverändert aus `mgmt.prio.*`.
function filterKey(f: Filter): string {
  return f === "busFactorOne" ? "fachwort.einzelperson.filter" : `mgmt.prio.filter.${f}`;
}

function flagKey(fl: MgmtPriorityFlag): string {
  return fl === "busFactorOne" ? "fachwort.einzelperson.markierung" : `mgmt.prio.flag.${fl}`;
}

/** Faktoren, für die in KEINER Zeile Eingangsdaten vorliegen — in der Reihenfolge der Quelle. */
function ohneDatenUeberall(priorities: readonly MgmtPriority[]): MgmtPriorityFactorKey[] {
  const erste = priorities[0];
  if (!erste) {
    return [];
  }
  const wert = (p: MgmtPriority, key: MgmtPriorityFactorKey) =>
    p.factors.find((f) => f.key === key)?.value;
  const keys = erste.factors.map((f) => f.key);
  return keys.filter((key) => priorities.every((p) => wert(p, key) === null));
}

export function WissensPriorisierung({
  priorities,
}: {
  priorities: readonly MgmtPriority[];
}): JSX.Element {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>("all");
  const zeilen = filter === "all" ? priorities : priorities.filter((p) => p.flags.includes(filter));
  const ohneDaten = ohneDatenUeberall(priorities);

  return (
    <div className="mt-2 space-y-2">
      {ohneDaten.length > 0 ? (
        <p data-testid="prio-ohne-daten" className="text-[12px] text-muted">
          {t("mgmt.prio.noDataNote", {
            factors: ohneDaten.map((k) => t(`mgmt.prio.factor.${k}`)).join(", "),
          })}
        </p>
      ) : null}
      <fieldset aria-label={t("mgmt.prio.filterLabel")} className="flex min-w-0 flex-wrap gap-1.5">
        {FILTER.map((f) => (
          <button
            key={f}
            type="button"
            data-testid="prio-filter"
            data-filter={f}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cx(
              "rounded-pill border px-2.5 py-1 text-[11.5px]",
              filter === f
                ? "border-ink bg-ink text-white"
                : "border-hairline bg-page text-muted hover:text-ink",
            )}
          >
            {t(filterKey(f))}
          </button>
        ))}
      </fieldset>
      {zeilen.length === 0 ? (
        <p data-testid="prio-leer" className="text-[12.5px] text-muted">
          {t("mgmt.prio.emptyFilter")}
        </p>
      ) : (
        <ol className="space-y-1.5">
          {zeilen.map((p, i) => (
            <li
              key={p.category}
              data-testid="prio-zeile"
              data-kategorie={p.category}
              className="rounded-card bg-page px-3 py-2"
            >
              <div className="flex items-center gap-2 text-[12.5px]">
                <span className="w-5 font-mono text-[11px] text-muted-2">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-text">{p.category}</span>
                {p.flags.map((fl) => (
                  <span
                    key={fl}
                    data-testid="prio-flag"
                    data-flag={fl}
                    className="shrink-0 rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-trust-warn-text"
                  >
                    {t(flagKey(fl))}
                  </span>
                ))}
                <span
                  data-testid="prio-score"
                  className="w-8 shrink-0 text-right font-mono text-[11px] text-ink"
                >
                  {p.score}
                </span>
              </div>
              <details className="mt-1">
                <summary className="cursor-pointer text-[11.5px] text-muted">
                  {t("mgmt.prio.detail", { known: p.knownFactors })}
                </summary>
                <ul className="mt-1 space-y-0.5">
                  {p.factors.map((f) => (
                    <li
                      key={f.key}
                      data-testid="prio-faktor"
                      data-faktor={f.key}
                      className="flex gap-2 text-[11.5px]"
                    >
                      <span className="flex-1 text-text">{t(`mgmt.prio.factor.${f.key}`)}</span>
                      <span className="font-mono text-muted-2">
                        {f.value === null ? t("mgmt.prio.noData") : f.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

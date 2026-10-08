// Aufnahme 20260922 · import-gesamtvertrag (R-0179, FR-EXT-01): die Befundübersicht der Import-
// Pipeline — sechs Arten in einer Zeile unter den Pipeline-Schritten. Die Zahlen rechnet
// `importFindingsOverview` (lib/extConcept.ts) aus vorhandenen Signalen; diese Komponente liest nur
// die beiden Signale nach, die die Prüfliste nicht selbst trägt (Konflikte, erneute Prüfung).
// Ein nicht abrufbares Signal steht als „nicht ermittelt" da — nie als 0.
import { useTranslation } from "react-i18next";
import { useConflicts, useLifecyclePending } from "../api/hooks";
import type { ImportCandidate } from "../api/types";
import { IMPORT_FINDING_KINDS, importFindingsOverview } from "../lib/extConcept";

export function ImportFindingsOverview({
  candidates,
}: {
  candidates: readonly ImportCandidate[];
}): JSX.Element {
  const { t } = useTranslation();
  const conflicts = useConflicts();
  const pending = useLifecyclePending();
  const befunde = importFindingsOverview(candidates, {
    conflicts: conflicts.data,
    pendingIds: pending.data,
  });
  return (
    <div className="mt-3 border-t border-hairline pt-2" data-testid="import-befunde">
      <div className="text-[11.5px] font-semibold text-muted">{t("importbefunde.title")}</div>
      <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11.5px] text-muted-2">
        {IMPORT_FINDING_KINDS.map((art) => {
          const n = befunde[art];
          return (
            <div key={art} className="flex gap-1" data-befund={art} data-wert={n ?? "offen"}>
              <dt>{t(`importbefunde.${art}`)}:</dt>
              <dd>{n === null ? t("importbefunde.notDetermined") : n}</dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{t("importbefunde.hint")}</p>
    </div>
  );
}

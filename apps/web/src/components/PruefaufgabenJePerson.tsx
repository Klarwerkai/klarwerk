// ================================================================================================
// FR-VAL-06 / FR-ANA-01 (Aufnahme gesamt-kennzahlen) — PRÜFAUFGABEN JE PERSON, OFFEN/ERLEDIGT.
// ================================================================================================
//
// Dieselbe Zuweisungsübersicht (`GET /api/validation/overview`) an zwei Orten: in der Auswertung
// (`pages/Analytics.tsx`) und in der Management-Sicht (`pages/Stufe2.tsx`, Kapital-Sichten). EINE
// Darstellung, damit beide nicht auseinanderlaufen.
//
// Namen kommen über den einen Weg `useAuthorName` (lädt / nicht abrufbar / unbekannt ehrlich
// unterschieden, nie eine rohe Kennung). Das Verzeichnis wird nur gefragt, wenn es eine Zeile
// aufzulösen gibt — deshalb sitzt der Namensweg in `PersonenZeilen`, nicht weiter oben.
import { useTranslation } from "react-i18next";
import { useValidationOverview } from "../api/hooks";
import type { AssignmentSummary } from "../api/types";
import { assignmentRows } from "../lib/analyticsMetrics";
import { useAuthorName } from "../lib/useAuthorName";

export function PersonenZeilen({
  rows,
  testid = "analytics-personen",
}: { rows: readonly AssignmentSummary[]; testid?: string }): JSX.Element {
  const { t } = useTranslation();
  const nameOf = useAuthorName();
  return (
    <div className="space-y-1.5" data-testid={testid}>
      {rows.map((r) => (
        <div key={r.userId} className="flex items-center gap-3 text-[12.5px]">
          <span className="min-w-0 flex-1 truncate text-text">{nameOf(r.userId)}</span>
          <span className="font-mono text-[11px] text-muted-2">
            {t("kennzahlen.personen.zeile", { open: r.open, done: r.done })}
          </span>
        </div>
      ))}
    </div>
  );
}

// Die Management-Fassung: holt die Übersicht selbst. Lädt sie noch oder ist sie nicht abrufbar,
// steht das da — nie eine leere Liste, die wie „keine Aufgaben" aussähe.
export function PruefaufgabenJePerson({ testid }: { testid: string }): JSX.Element {
  const { t } = useTranslation();
  const overview = useValidationOverview();
  if (overview.data === undefined) {
    return (
      <p className="text-[12.5px] text-muted">
        {t(overview.isError ? "kennzahlen.personen.nichtAbrufbar" : "kennzahlen.personen.laedt")}
      </p>
    );
  }
  const rows = Array.isArray(overview.data) ? assignmentRows(overview.data) : [];
  if (rows.length === 0) {
    return <p className="text-[12.5px] text-muted">{t("kennzahlen.personen.leer")}</p>;
  }
  return <PersonenZeilen rows={rows} testid={testid} />;
}

import { useTranslation } from "react-i18next";
import type { KnowledgeObject } from "../../../api/types";
import { INTAKE_STARTERS, type IntakeStarter } from "../../../lib/intakeStarters";
import { SourceEvidence } from "../../ko/SourceEvidence";

// SCRUM-527 (Iteration 1): der Leerzustand von „Wissen erfassen" — KEIN leeres Feld. Warme Frage als
// Überschrift, optional ein DOMÄNEN-nahes Beispiel aus dem Bestand (nie fachfremd aufgedrängt; kein
// Signal → gar kein Beispiel), vier antippbare Starter-Chips (zeigen die ART Wissen) und ein
// Beruhigungssatz. Reine Präsentation; das Antippen eines Chips meldet die GEWÄHLTE Wissensart an den
// Aufrufer (onStart) — der Container setzt sie als entfernbares Label über das Feld, das Feld bleibt LEER.
export function IntakeEmptyState({
  example,
  onStart,
}: {
  // Echter, möglichst domänennaher Beispiel-KO aus dem Bestand; null → KEIN Beispiel (nur Frage + Feld).
  example: KnowledgeObject | null;
  // Ein Starter wurde angetippt → die gewählte Wissensart (NICHT als Textvorbefüllung).
  onStart: (starter: IntakeStarter) => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Warme Frage als Überschrift — kein Feldlabel. */}
      <h1 className="text-2xl font-semibold leading-snug text-ink">{t("intake.question")}</h1>

      {/* Domänennahes Beispiel: „So etwas — aber deins." NUR wenn ein echter, passender KO existiert —
          nie ein fachfremder Muster-KO aufdrängen. */}
      {example ? (
        <div className="rounded-card border border-hairline bg-surface p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="font-mono text-micro uppercase tracking-wider text-muted-2">
              {t("intake.exampleLabel")}
            </span>
          </div>
          <p className="text-[15px] font-semibold text-text">{example.title}</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{example.statement}</p>
          <div className="mt-3 border-t border-hairline pt-3">
            <SourceEvidence
              sources={example.sources ?? []}
              confidence={example.confidence}
              date={example.sources?.[0]?.at ?? example.createdAt}
              variant="compact"
            />
          </div>
        </div>
      ) : null}

      {/* Vier Starter-Chips — zeigen die ART Wissen; Tipp startet die Eingabe (Feld bleibt leer). */}
      <div className="flex flex-wrap gap-2">
        {INTAKE_STARTERS.map((starter) => (
          <button
            key={starter.id}
            type="button"
            onClick={() => onStart(starter)}
            className="rounded-btn border border-hairline bg-surface px-3.5 py-2 text-left text-[13px] font-medium text-text transition-colors hover:border-ink/30 hover:bg-hairline-soft"
          >
            {t(starter.labelKey)}
          </button>
        ))}
      </div>

      {/* Beruhigungssatz. */}
      <p className="text-[13px] text-muted">{t("intake.calming")}</p>
    </div>
  );
}

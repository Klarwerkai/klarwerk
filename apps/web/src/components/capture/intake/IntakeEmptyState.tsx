import { useTranslation } from "react-i18next";
import type { KnowledgeObject } from "../../../api/types";
import { INTAKE_STARTERS } from "../../../lib/intakeStarters";
import { SourceEvidence } from "../../ko/SourceEvidence";

// SCRUM-527 (WP1-Design): der Leerzustand von „Wissen erfassen" — KEIN leeres Feld. Warme Frage als
// Überschrift, ein FERTIGES Beispiel (echter KO aus dem Bestand, sonst ein klar markierter Muster-KO),
// vier antippbare Starter-Chips (zeigen die ART Wissen) und ein Beruhigungssatz. Reine Präsentation;
// das Antippen eines Chips meldet den passenden Satzanfang an den Aufrufer (onStart).
export function IntakeEmptyState({
  example,
  onStart,
}: {
  // Echter Beispiel-KO aus dem Bestand; null → klar markierter Muster-KO (i18n, kein Fake-Bestand).
  example: KnowledgeObject | null;
  // Ein Starter wurde angetippt → der vorbefüllte Satzanfang (bereits übersetzt).
  onStart: (prefill: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const isSample = example === null;
  const title = example ? example.title : t("intake.sample.title");
  const statement = example ? example.statement : t("intake.sample.statement");

  return (
    <div className="space-y-6">
      {/* Warme Frage als Überschrift — kein Feldlabel. */}
      <h1 className="text-2xl font-semibold leading-snug text-ink">{t("intake.question")}</h1>

      {/* Fertiges Beispiel: „So etwas — aber deins." */}
      <div className="rounded-card border border-hairline bg-surface p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-mono text-micro uppercase tracking-wider text-muted-2">
            {t("intake.exampleLabel")}
          </span>
          {isSample ? (
            <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted-2">
              {t("intake.sampleBadge")}
            </span>
          ) : null}
        </div>
        <p className="text-[15px] font-semibold text-text">{title}</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{statement}</p>
        {example ? (
          <div className="mt-3 border-t border-hairline pt-3">
            <SourceEvidence
              sources={example.sources ?? []}
              confidence={example.confidence}
              date={example.sources?.[0]?.at ?? example.createdAt}
              variant="compact"
            />
          </div>
        ) : null}
      </div>

      {/* Vier Starter-Chips — zeigen die ART Wissen; Tipp startet die Eingabe. */}
      <div className="flex flex-wrap gap-2">
        {INTAKE_STARTERS.map((starter) => (
          <button
            key={starter.id}
            type="button"
            onClick={() => onStart(t(starter.prefillKey))}
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

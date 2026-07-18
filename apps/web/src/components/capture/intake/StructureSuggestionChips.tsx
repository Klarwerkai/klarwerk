import { useTranslation } from "react-i18next";
import type { IntakeSuggestion } from "../../../lib/intakeSuggestion";

// SCRUM-527 (WP3-Design): der Struktur-Vorschlag als EDITIERBARE Chips — Titel · Kategorie · vermutete
// Quelle. Das System legt vor, der Mensch nickt ab oder tippt an (kein erzwungenes Formular). Jeder Chip
// ist ein kleines Inline-Eingabefeld: der vorgeschlagene Wert steht drin und lässt sich direkt ändern.
// Reine, kontrollierte Präsentation (Werte via Props, Änderungen via onChange). `derived` markiert
// ehrlich, dass der Vorschlag aus dem Text abgeleitet ist (kein KI-Modell) — kein Fake.
function Chip({
  label,
  value,
  placeholder,
  onValue,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onValue: (v: string) => void;
}): JSX.Element {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-surface px-2.5 py-1">
      <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onValue(e.target.value)}
        aria-label={label}
        className="min-w-[6ch] bg-transparent text-[13px] font-medium text-text outline-none placeholder:text-muted-2"
      />
    </label>
  );
}

export function StructureSuggestionChips({
  suggestion,
  onChange,
  derived = false,
}: {
  suggestion: IntakeSuggestion;
  onChange: (next: IntakeSuggestion) => void;
  // true = aus dem Text abgeleiteter Platzhalter (kein KI-Modell) → ehrlich kennzeichnen.
  derived?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const set = (patch: Partial<IntakeSuggestion>): void => onChange({ ...suggestion, ...patch });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] font-medium text-muted">
          {t("intake.structure.heading")}
        </span>
        {derived ? (
          <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[9.5px] uppercase text-muted-2">
            {t("intake.structure.derived")}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip
          label={t("intake.structure.title")}
          value={suggestion.title}
          onValue={(v) => set({ title: v })}
        />
        <Chip
          label={t("intake.structure.category")}
          value={suggestion.category}
          placeholder={t("intake.structure.categoryPlaceholder")}
          onValue={(v) => set({ category: v })}
        />
        <Chip
          label={t("intake.structure.source")}
          value={suggestion.source}
          onValue={(v) => set({ source: v })}
        />
      </div>
    </div>
  );
}

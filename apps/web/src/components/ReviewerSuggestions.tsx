import { useTranslation } from "react-i18next";
import { useReviewerSuggestions } from "../api/hooks";
import { useDebouncedValue } from "../lib/useDebouncedValue";

// R-0265: Prüfer-Vorschlag beim Einreichen. Zeigt über der manuellen Auswahl, wer zu Kategorie und
// Schlagworten passt — mit dem Grund. Ein Klick wählt die Person wie in der Liste darunter aus
// (dieselbe Auswahl, dieselbe Obergrenze); zugewiesen wird erst beim Einreichen (R-1084).
//
// Nur Personen aus `choices` erscheinen: dieselbe Menge wie die manuelle Auswahl, ohne den Autor.

export const REVIEWER_SUGGESTION_DEBOUNCE_MS = 400;

export function ReviewerSuggestions({
  category,
  tags,
  choices,
  selected,
  limitReached,
  onToggle,
}: {
  category: string;
  tags: readonly string[];
  choices: readonly { id: string; name: string }[];
  selected: readonly string[];
  limitReached: boolean;
  onToggle: (id: string) => void;
}): JSX.Element | null {
  const { t } = useTranslation();
  const thema = useDebouncedValue(category, REVIEWER_SUGGESTION_DEBOUNCE_MS);
  const schlagworte = useDebouncedValue(tags, REVIEWER_SUGGESTION_DEBOUNCE_MS);
  const vorschlag = useReviewerSuggestions(thema, schlagworte);
  if (thema.trim().length === 0 && schlagworte.length === 0) {
    return null;
  }
  const namen = new Map(choices.map((p) => [p.id, p.name]));
  const personen = (vorschlag.data ?? []).filter((s) => namen.has(s.userId));
  return (
    <div className="mb-2.5" data-testid="reviewer-suggestions">
      <div className="mb-1 text-[11.5px] font-semibold text-muted">
        {t("prueferzuweisung.vorschlag.titel")}
      </div>
      {vorschlag.isError ? (
        <div className="text-[12px] text-muted-2">{t("prueferzuweisung.vorschlag.fehler")}</div>
      ) : vorschlag.data && personen.length === 0 ? (
        <div className="text-[12px] text-muted-2">{t("prueferzuweisung.vorschlag.keiner")}</div>
      ) : (
        <ul className="flex flex-col gap-1">
          {personen.map((s) => {
            const active = selected.includes(s.userId);
            return (
              <li key={s.userId} className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggle(s.userId)}
                  aria-pressed={active}
                  disabled={!active && limitReached}
                  className={
                    active
                      ? "rounded-btn border border-ink bg-ink px-2.5 py-1 text-[12px] font-semibold text-white"
                      : "rounded-btn border border-hairline px-2.5 py-1 text-[12px] text-muted hover:text-text"
                  }
                >
                  {namen.get(s.userId)}
                </button>
                <span className="text-[11.5px] text-muted-2">
                  {s.gruende.map((g) => t(`prueferzuweisung.grund.${g}`)).join(" · ")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-1 text-[11px] leading-snug text-muted-2">
        {t("prueferzuweisung.vorschlag.hinweis")}
      </div>
    </div>
  );
}

// IC-3 (Import-Cockpit): prompt-/filtergesteuerte AUSWAHL. Der Nutzer grenzt per Satz ODER per Klick
// (Themen-Chips aus der Landkarte, Limit) ein, WAS importiert wird. „Vorschau" ruft die READ-ONLY
// select-Route (schreibt nichts) und zeigt „X von Y Treffer", die EFFEKTIV benutzten Kriterien
// (Transparenz: wie hat die KI den Satz verstanden?) und eine kompakte Vorschau-Liste. Noch KEIN
// Übernahme-Button — das ist IC-4. Übersetzung DE/EN/NL über i18n.
import { useMutation } from "@tanstack/react-query";
import { Images, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { ImportSelectCriteria, ImportSelectResponse } from "../api/types";
import { NO_THEME_LABEL, summarizeSelectCriteria } from "../lib/importExplore";
import { Button, TextInput } from "./ui";

export function ImportSelect({ themes }: { themes: string[] }): JSX.Element {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [limit, setLimit] = useState("");

  // „(ohne Label)" ist kein echter Filter-Wert (Items ohne Tags matchen ihn nicht) → nicht anbieten.
  const chips = themes.filter((th) => th !== NO_THEME_LABEL);

  const buildCriteria = (): ImportSelectCriteria => {
    const parsedLimit = Number.parseInt(limit, 10);
    return {
      ...(selected.length > 0 ? { themes: selected } : {}),
      ...(Number.isInteger(parsedLimit) && parsedLimit > 0 ? { limit: parsedLimit } : {}),
    };
  };

  const select = useMutation<ImportSelectResponse>({
    mutationFn: () =>
      endpoints.admin.import.select({ prompt: prompt.trim(), criteria: buildCriteria() }),
  });

  const toggleTheme = (label: string): void => {
    setSelected((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
    );
  };

  const criteriaLines = select.data
    ? summarizeSelectCriteria(select.data.criteria, {
        themes: t("imp.select.critThemes"),
        authors: t("imp.select.critAuthors"),
        keywords: t("imp.select.critKeywords"),
        years: t("imp.select.critYears"),
        limit: t("imp.select.critLimit"),
      })
    : [];

  const errorMessage = select.error instanceof ApiError ? select.error.message : t("state.error");

  return (
    <div className="mt-4 border-t border-hairline pt-4">
      <span className="text-[12px] font-semibold text-muted">{t("imp.select.title")}</span>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-2">{t("imp.select.hint")}</p>

      {/* Freitext-Prompt */}
      <div className="mt-2">
        <TextInput
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("imp.select.promptPlaceholder")}
        />
      </div>

      {/* Themen-Chips als Klick-Filter */}
      {chips.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((label) => {
            const on = selected.includes(label);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleTheme(label)}
                className={`rounded-pill border px-2 py-0.5 text-[12px] ${
                  on
                    ? "border-ink/30 bg-ink text-white"
                    : "border-hairline bg-page text-text hover:border-ink/20"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Limit + Vorschau-Button */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          {t("imp.select.limit")}
          <input
            type="number"
            min={1}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="h-8 w-20 rounded-input border border-hairline bg-surface px-2 text-[12.5px] text-text"
          />
        </label>
        <Button variant="primary" disabled={select.isPending} onClick={() => select.mutate()}>
          {select.isPending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Sparkles size={15} />
          )}
          {select.isPending ? t("imp.select.previewing") : t("imp.select.previewCta")}
        </Button>
      </div>

      {select.isError ? (
        <p className="mt-3 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
          {errorMessage}
        </p>
      ) : null}

      {select.data ? (
        <div className="mt-3 rounded-card border border-hairline bg-page p-3">
          <div className="text-[13px] font-semibold text-text">
            {t("imp.select.matched", {
              matched: select.data.preview.length,
              total: select.data.matched,
            })}
            {select.data.limited ? ` · ${t("imp.select.limitedNote")}` : ""}
          </div>

          {/* Effektiv benutzte Kriterien — Transparenz. Leer → „alles". */}
          {criteriaLines.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-muted-2">
              {criteriaLines.map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[11.5px] text-muted-2">{t("imp.select.critAll")}</p>
          )}

          {/* Kompakte Vorschau-Liste */}
          {select.data.preview.length > 0 ? (
            <ul className="mt-2 space-y-1 border-t border-hairline pt-2">
              {select.data.preview.map((entry, i) => (
                <li
                  key={`${entry.title}-${i}`}
                  className="flex items-start gap-2 text-[12.5px] text-text"
                >
                  <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                  {entry.author ? (
                    <span className="shrink-0 text-[11px] text-muted-2">{entry.author}</span>
                  ) : null}
                  {entry.hasImage ? (
                    <Images size={12} className="mt-0.5 shrink-0 text-muted-2" />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-muted-2">{t("imp.select.empty")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

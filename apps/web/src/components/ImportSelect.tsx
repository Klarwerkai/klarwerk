// IC-3 (Import-Cockpit): prompt-/filtergesteuerte AUSWAHL. Der Nutzer grenzt per Satz ODER per Klick
// (Autoren-/Themen-/Space-Chips der Landkarte, Zeitraum, Limit) ein, WAS importiert wird. „Vorschau"
// ruft die READ-ONLY select-Route (schreibt nichts) und zeigt „X von Y Treffer", die EFFEKTIV benutzten
// Kriterien (Transparenz) und die Vorschau-Liste. Noch KEIN Übernahme-Button — das ist IC-4.
// WP-IC-PAKET-1 (Teil 3): Chip-Filter kommen aus der Landkarte (Props); Zeitraum (von/bis Jahr) hier;
// eine bereits geöffnete Vorschau aktualisiert sich LIVE bei jeder Filter-Änderung (debounced).
// WP-IC-PAKET-1 (Teil 4, IC-6a): bereits importierte Seiten sind markiert („bereits importiert",
// optional „Quelle neuer als Import") und standardmäßig ABGEWÄHLT — bewusst wieder anwählbar (kein
// hartes Verbot; Review-Invariante bleibt, importiert wird hier ohnehin nichts).
// WP-IC-PAKET-1 (Teil 1): Altbestand-Anzeige dekodiert HTML-Entities (nur Text-Rendering, nie HTML).
import { useMutation } from "@tanstack/react-query";
import { Images, Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { ImportSelectCriteria, ImportSelectResponse } from "../api/types";
import { decodeHtmlEntities } from "../lib/htmlEntities";
import { summarizeSelectCriteria } from "../lib/importExplore";
// WP-IC-PAKET-1b (bens ROT-3): latest-wins — Antworten aelterer Requests werden verworfen.
import { createLatestWins } from "../lib/latestWins";
import { Button, TextInput } from "./ui";

// Klick-Filter der Erkundungs-Landkarte (Roh-Werte, wie der Server sie kennt — dekodiert wird nur die
// Anzeige, nie der Filterwert).
export interface ImportChipCriteria {
  themes: string[];
  authors: string[];
  spaces: string[];
}

function parsedPositiveInt(raw: string): number | undefined {
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function ImportSelect({ chip }: { chip: ImportChipCriteria }): JSX.Element {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState("");
  const [limit, setLimit] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  // WP-IC-PAKET-1 (Teil 4): Auswahl-Zustand je Vorschau-Zeile — Standard: alles an, AUSSER bereits
  // importierte Einträge (Doppel-Import vermeiden); bewusstes Wieder-Anwählen bleibt möglich.
  const [checkedRows, setCheckedRows] = useState<boolean[]>([]);
  // WP-IC-PAKET-1b (bens ROT-3): die angezeigte Vorschau liegt in EIGENEM State und wird NUR vom
  // latest-wins-Guard gesetzt — select.data (letzte SETTLED Mutation) könnte eine ältere, später
  // fertig gewordene Antwort sein und Vorschau + checkedRows rückwärts überschreiben.
  const [preview, setPreview] = useState<ImportSelectResponse | null>(null);
  const latestRef = useRef(createLatestWins());

  const buildCriteria = (): ImportSelectCriteria => {
    const parsedLimit = parsedPositiveInt(limit);
    const from = parsedPositiveInt(yearFrom);
    const to = parsedPositiveInt(yearTo);
    return {
      ...(chip.themes.length > 0 ? { themes: chip.themes } : {}),
      ...(chip.authors.length > 0 ? { authors: chip.authors } : {}),
      ...(chip.spaces.length > 0 ? { spaces: chip.spaces } : {}),
      ...(from !== undefined ? { yearFrom: from } : {}),
      ...(to !== undefined ? { yearTo: to } : {}),
      ...(parsedLimit !== undefined ? { limit: parsedLimit } : {}),
    };
  };

  const select = useMutation<{ requestId: number; data: ImportSelectResponse }>({
    mutationFn: async () => {
      // ROT-3: jeder Start zieht eine Request-ID; nur die zuletzt gestartete darf anwenden.
      const requestId = latestRef.current.begin();
      const data = await endpoints.admin.import.select({
        prompt: prompt.trim(),
        criteria: buildCriteria(),
      });
      return { requestId, data };
    },
    onSuccess: ({ requestId, data }) => {
      if (!latestRef.current.isCurrent(requestId)) {
        return; // ältere Antwort — verwerfen, die neuere Vorschau bleibt stehen
      }
      setPreview(data);
      setCheckedRows(data.preview.map((entry) => entry.alreadyImported !== true));
    },
  });

  // WP-IC-PAKET-1 (Teil 3): LIVE-Trefferzahl — sobald eine Vorschau einmal geöffnet wurde, aktualisiert
  // jede Filter-Änderung (Chips/Jahre/Limit) sie automatisch (debounced; Prompt weiterhin per Knopf).
  const hasPreviewRef = useRef(false);
  if (preview !== null) {
    hasPreviewRef.current = true;
  }
  const criteriaKey = JSON.stringify([
    chip.themes,
    chip.authors,
    chip.spaces,
    yearFrom,
    yearTo,
    limit,
  ]);
  const mutateRef = useRef(select.mutate);
  mutateRef.current = select.mutate;
  const lastCriteriaKeyRef = useRef(criteriaKey);
  useEffect(() => {
    // Nur bei ECHTER Filter-Änderung nach einer geöffneten Vorschau nachladen (nicht beim Mount).
    if (!hasPreviewRef.current || lastCriteriaKeyRef.current === criteriaKey) {
      lastCriteriaKeyRef.current = criteriaKey;
      return;
    }
    lastCriteriaKeyRef.current = criteriaKey;
    const timer = setTimeout(() => mutateRef.current(), 350);
    return () => clearTimeout(timer);
  }, [criteriaKey]);

  const criteriaLines = preview
    ? summarizeSelectCriteria(preview.criteria, {
        themes: t("imp.select.critThemes"),
        authors: t("imp.select.critAuthors"),
        keywords: t("imp.select.critKeywords"),
        years: t("imp.select.critYears"),
        limit: t("imp.select.critLimit"),
        spaces: t("imp.select.critSpaces"),
      })
    : [];

  const errorMessage = select.error instanceof ApiError ? select.error.message : t("state.error");
  const alreadyImportedCount = preview?.alreadyImported ?? 0;
  const selectedCount = checkedRows.filter(Boolean).length;

  const toggleRow = (index: number): void => {
    setCheckedRows((prev) => prev.map((on, i) => (i === index ? !on : on)));
  };

  const yearInputCls =
    "h-9 w-24 rounded-input border border-hairline bg-surface px-2 text-[12.5px] text-text";

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

      {/* Zeitraum + Limit + Vorschau-Button (WP-IC-PAKET-1 Teil 3: von/bis Jahr aus den Erkundungsdaten) */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          {t("imp.select.yearFrom")}
          <input
            type="number"
            min={1990}
            max={2100}
            value={yearFrom}
            onChange={(e) => setYearFrom(e.target.value)}
            className={yearInputCls}
          />
        </label>
        <label className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          {t("imp.select.yearTo")}
          <input
            type="number"
            min={1990}
            max={2100}
            value={yearTo}
            onChange={(e) => setYearTo(e.target.value)}
            className={yearInputCls}
          />
        </label>
        <label className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          {t("imp.select.limit")}
          <input
            type="number"
            min={1}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="h-9 w-20 rounded-input border border-hairline bg-surface px-2 text-[12.5px] text-text"
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

      {/* ROT-3: gerendert wird IMMER der latest-wins-Stand (preview), nie select.data direkt. */}
      {preview ? (
        <div className="mt-3 rounded-card border border-hairline bg-page p-3">
          <div className="text-[13px] font-semibold text-text">
            {t("imp.select.matched", {
              matched: preview.preview.length,
              total: preview.matched,
            })}
            {preview.limited ? ` · ${t("imp.select.limitedNote")}` : ""}
            {/* WP-IC-PAKET-1 (Teil 4): ehrlicher Import-Status der Vorschau. */}
            {alreadyImportedCount > 0
              ? ` · ${t("imp.select.alreadyImported", { n: alreadyImportedCount })}`
              : ""}
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

          {/* Vorschau-Liste mit Auswahl (Teil 4): bereits Importiertes markiert + standardmäßig abgewählt. */}
          {preview.preview.length > 0 ? (
            <>
              <p className="mt-2 text-[11.5px] text-muted-2">
                {t("imp.select.selectedCount", { n: selectedCount })}
                {alreadyImportedCount > 0 ? ` — ${t("imp.select.importedDeselected")}` : ""}
              </p>
              <ul className="mt-1.5 space-y-1 border-t border-hairline pt-2">
                {preview.preview.map((entry, i) => (
                  <li
                    key={`${entry.title}-${i}`}
                    className="flex items-start gap-2 text-[12.5px] text-text"
                  >
                    <input
                      type="checkbox"
                      aria-label={decodeHtmlEntities(entry.title)}
                      checked={checkedRows[i] ?? false}
                      onChange={() => toggleRow(i)}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    {/* WP-IC-PAKET-1 (Teil 1): Altbestand-Entities nur fürs Text-Rendering dekodieren. */}
                    <span className="min-w-0 flex-1 truncate">
                      {decodeHtmlEntities(entry.title)}
                    </span>
                    {entry.alreadyImported ? (
                      <span className="shrink-0 rounded-pill bg-trust-pos-bg px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-pos-text">
                        {t("imp.preview.imported")}
                      </span>
                    ) : null}
                    {entry.sourceNewer ? (
                      <span className="shrink-0 rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
                        {t("imp.preview.sourceNewer")}
                      </span>
                    ) : null}
                    {entry.author ? (
                      <span className="shrink-0 text-[11px] text-muted-2">
                        {decodeHtmlEntities(entry.author)}
                      </span>
                    ) : null}
                    {entry.hasImage ? (
                      <Images size={12} className="mt-0.5 shrink-0 text-muted-2" />
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-[12px] text-muted-2">{t("imp.select.empty")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

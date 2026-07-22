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
import { displayImportText } from "../lib/htmlEntities";
import { summarizeSelectCriteria } from "../lib/importExplore";
// WP-IC-PAKET-1b (bens ROT-3): latest-wins — Antworten aelterer Requests werden verworfen.
import { createLatestWins } from "../lib/latestWins";
import { toReasonerLocale } from "../lib/reasonerLocale";
// WP-IC-4: Schritt 4+5 (Gruppen-Freigabe + Übernahme mit Bilanz).
import { ImportGroups } from "./ImportGroups";
// WP-COCKPIT-LINIE: Schritt-Überschrift (3 Eingrenzen) + Meilenstein-Meldung an die Leiste.
import { ImportStepHeading, useReportImportStage } from "./ImportStepper";
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
  const { t, i18n } = useTranslation();
  const [prompt, setPrompt] = useState("");
  // WP-VIP2-GATE-2 (bens Fix 1): PFLICHT-Eigeneinstufung des Auswahl-Satzes — VORGABE ist
  // fail-safe „Ja/unsicher" (vertraulich); nur die bewusste Wahl „Nein, unbedenklich" erlaubt
  // dem Server ueberhaupt den Cloud-Weg (und auch dann nur bei komplett freigegebenem Snapshot).
  const [promptConfidential, setPromptConfidential] = useState(true);
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

  // WP-COCKPIT-LINIE: Vorschau da → Meilenstein "previewed" an die Schritt-Leiste; beim ERSTEN
  // Erscheinen zur Vorschau scrollen (Muster aus R7) — Live-Aktualisierungen der Filter springen
  // danach bewusst nicht mehr.
  const reach = useReportImportStage();
  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const scrolledToPreviewRef = useRef(false);
  useEffect(() => {
    if (preview !== null) {
      reach("previewed");
      if (!scrolledToPreviewRef.current) {
        scrolledToPreviewRef.current = true;
        previewBoxRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      }
    }
  }, [preview, reach]);

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
        // WP-SAMMEL20-FIX (bens Fix 3): locale explizit mitgeben (Route-Schema: de/en).
        locale: toReasonerLocale(i18n.language),
        // WP-VIP2-GATE-2 (bens Fix 1): die Eigeneinstufung reist IMMER mit (Pflichtfeld).
        promptConfidential,
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
      {/* WP-COCKPIT-LINIE Schritt 3: Eingrenzen — Nummer + Titel + 1-Satz-Erklärung. */}
      <ImportStepHeading step="narrow" />

      {/* Freitext-Prompt */}
      <div className="mt-2">
        <TextInput
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("imp.select.promptPlaceholder")}
        />
      </div>
      {/* WP-VIP2-GATE-2 (bens Fix 1): PFLICHT-Eigeneinstufung DIREKT an der Satz-Eingabe —
          Vorgabe „Ja/unsicher" (fail-safe vertraulich); nur die bewusste Wahl „Nein" gibt den
          Satz fuer den Cloud-Weg frei (der Server prueft zusaetzlich den Snapshot als Backstop). */}
      <div
        className="mt-1.5 flex flex-wrap items-center gap-3 text-[12px] text-muted"
        role="radiogroup"
        aria-label={t("imp.select.promptConfidentialLabel")}
      >
        <span className="font-semibold">{t("imp.select.promptConfidentialLabel")}</span>
        <label className="inline-flex items-center gap-1">
          <input
            type="radio"
            name="prompt-confidential"
            checked={promptConfidential}
            onChange={() => setPromptConfidential(true)}
          />
          {t("imp.select.promptConfidentialYes")}
        </label>
        <label className="inline-flex items-center gap-1">
          <input
            type="radio"
            name="prompt-confidential"
            checked={!promptConfidential}
            onChange={() => setPromptConfidential(false)}
          />
          {t("imp.select.promptConfidentialNo")}
        </label>
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
        {/* WP-COCKPIT-LINIE: der EINE Primär-CTA nach der Erkundung („Weiter: …"-Muster). Sobald
            die Vorschau steht, tritt er zurück (outline, „Vorschau aktualisieren") — der nächste
            Primär-Knopf gehört dann Schritt 4 (Gruppieren & Übernehmen). */}
        <Button
          variant={preview ? "outline" : "primary"}
          disabled={select.isPending}
          onClick={() => select.mutate()}
        >
          {select.isPending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Sparkles size={15} />
          )}
          {select.isPending
            ? t("imp.select.previewing")
            : preview
              ? t("imp.select.previewAgain")
              : t("imp.select.previewCta")}
        </Button>
      </div>

      {select.isError ? (
        <p className="mt-3 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
          {errorMessage}
        </p>
      ) : null}

      {/* ROT-3: gerendert wird IMMER der latest-wins-Stand (preview), nie select.data direkt. */}
      {preview ? (
        <div
          ref={previewBoxRef}
          className="mt-3 scroll-mt-4 rounded-card border border-hairline bg-page p-3"
        >
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

          {/* WP-SAMMEL20-FIX (bens Fix 2): KI-Ausfall NIE still — nüchterner Hinweis, dass nur
              die Klick-Filter gelten (die weiterhin wirken; nichts wird erfunden). */}
          {preview.inferenceStatus === "unavailable" ? (
            <p className="mt-1.5 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12px] text-trust-warn-text">
              {t("imp.select.aiUnavailable")}
            </p>
          ) : null}

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
                      aria-label={displayImportText(entry.title, entry.textCodec)}
                      checked={checkedRows[i] ?? false}
                      onChange={() => toggleRow(i)}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    {/* WP-IC-PAKET-1 (Teil 1): Altbestand-Entities nur fürs Text-Rendering dekodieren. */}
                    <span className="min-w-0 flex-1 truncate">
                      {displayImportText(entry.title, entry.textCodec)}
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
                        {displayImportText(entry.author, entry.textCodec)}
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

          {/* WP-IC-4 (Schritt 4+5): Gruppieren → Gruppen-Freigabe → Übernahme mit ehrlicher Bilanz.
              Key = Kriterien der AKTUELLEN Vorschau: eine geänderte Eingrenzung setzt den
              Gruppierungs-Schritt sauber zurück (keine veralteten Gruppen zur neuen Auswahl). */}
          {preview.preview.length > 0 ? (
            <ImportGroups key={JSON.stringify(preview.criteria)} criteria={preview.criteria} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

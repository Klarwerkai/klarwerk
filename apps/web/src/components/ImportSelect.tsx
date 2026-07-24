// IC-3 (Import-Cockpit): prompt-/filtergesteuerte AUSWAHL. Der Nutzer grenzt per Satz ODER per Klick
// (Autoren-/Themen-/Space-Chips der Landkarte, Zeitraum, Limit) ein, WAS importiert wird. „Vorschau"
// ruft die READ-ONLY select-Route (schreibt nichts) und zeigt „X von Y Treffer", die EFFEKTIV benutzten
// Kriterien (Transparenz) und die Vorschau-Liste. Noch KEIN Übernahme-Button — das ist IC-4.
// WP-IC-PAKET-1 (Teil 3): Chip-Filter kommen aus der Landkarte (Props); Zeitraum (von/bis Jahr) hier;
// eine bereits geöffnete Vorschau aktualisiert sich LIVE bei jeder Filter-Änderung (debounced).
// WP-IC-PAKET-1 (Teil 4, IC-6a): bereits importierte Seiten sind markiert („bereits importiert",
// optional „Quelle neuer als Import") und standardmäßig ABGEWÄHLT — bewusst wieder anwählbar (kein
// hartes Verbot; Review-Invariante bleibt, importiert wird hier ohnehin nichts).
// WP-SHIP9-S1b (bens GELB): offene Kandidaten tragen ein EIGENES Kennzeichen „bereits zur Prüfung
// vorgemerkt" (eigene Farbe/eigener Text, gleiche Vorab-Abwahl) — nie mehr „bereits importiert".
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
// WP-SHIP9-S2 Paket 2 (D2–D7): reines View-Modell für Suche/Filter/Alle/Gruppen der Trefferliste.
import {
  DEFAULT_PREVIEW_VIEW,
  type PreviewChip,
  type PreviewGroupMode,
  type PreviewLanguage,
  type PreviewRow,
  bulkSelectableRows,
  clearAllSelected,
  deselectLanguage,
  effectiveGroupMode,
  groupCheckboxState,
  groupModeOptions,
  groupRowsTree,
  groupsCollapsedByDefault,
  languageCounts,
  rowsAllChecked,
  selectionSummary,
  setRowsSelected,
  statusChipCounts,
  visibleRows,
} from "../lib/importSelectView";
// WP-IC-PAKET-1b (bens ROT-3): latest-wins — Antworten aelterer Requests werden verworfen.
import { createLatestWins } from "../lib/latestWins";
import { toReasonerLocale } from "../lib/reasonerLocale";
import { useAiAvailable } from "../lib/useAiAvailable";
// WP-IC-4: Schritt 4+5 (Gruppen-Freigabe + Übernahme mit Bilanz).
import { ImportGroups } from "./ImportGroups";
// RT5a-c (nacht24): Subfolder-Baum + Sprach-Massenaktion (Darstellung; Logik in importSelectView).
import { ImportPreviewTree, LanguageDeselectChips } from "./ImportPreviewTree";
// WP-COCKPIT-LINIE: Schritt-Überschrift (3 Eingrenzen) + Meilenstein-Meldung an die Leiste.
import {
  ImportStepHeading,
  useReportImportGeneration,
  useReportImportStage,
} from "./ImportStepper";
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
  // PAKET 1 (D-AISTATE, Pedi 23.07.): ist die KI-Gruppierung (Task „group") nutzbar? An ImportGroups
  // durchgereicht — der deterministische Gruppierungs-Ablauf bleibt nutzbar, nur der Vor-Hinweis ehrlich.
  const groupAi = useAiAvailable("group");
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
  // WP-SHIP9-S2 Paket 2 (D3–D7): Ansichts-Zustand der Trefferliste (Suche/Filter-Chip/Ausblenden/
  // Gruppierung). Rein für die DARSTELLUNG — die Auswahl selbst bleibt in checkedRows (Originalindex).
  const [view, setView] = useState(DEFAULT_PREVIEW_VIEW);
  // WP-BILD-1f RT5a: expliziter Auf-/Zu-Zustand je Gruppe (Baugruppen-Ordner). Nur EXPLIZITE
  // Nutzer-Klicks landen hier; ohne Eintrag gilt der Standard (offen, bzw. eingeklappt bei vielen
  // Gruppen). Der Key ist group.key (stabil über Sprach-/Themen-Wert).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

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

  // WP-COCKPIT-LINIE-b (bens Punkt 2): die Eingrenzungs-EINGABEN (Chips/Jahre/Limit/Satz) sind die
  // Generation des Fortschritts. Ändert sich die Eingrenzung nach einer Bilanz, meldet dieser
  // Effekt die neue Generation — der Provider nimmt den Schritten 4+5 ehrlich die Haken und macht
  // Schritt 3 wieder zum aktuellen (Monotonie gilt nur innerhalb einer Generation).
  const beginGeneration = useReportImportGeneration();
  const generationKey = JSON.stringify([
    chip.themes,
    chip.authors,
    chip.spaces,
    yearFrom,
    yearTo,
    limit,
    prompt,
  ]);
  useEffect(() => {
    beginGeneration(generationKey);
  }, [generationKey, beginGeneration]);

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
      // WP-SHIP9-S1b: auch Vorgemerktes startet abgewählt (Queue-Schutz), bleibt aber anwählbar.
      setCheckedRows(
        data.preview.map((entry) => entry.alreadyImported !== true && entry.alreadyQueued !== true),
      );
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
  const alreadyQueuedCount = preview?.alreadyQueued ?? 0;

  const toggleRow = (index: number): void => {
    setCheckedRows((prev) => prev.map((on, i) => (i === index ? !on : on)));
  };

  // WP-SHIP9-S2 Paket 2: abgeleitete Ansicht — gefilterte/durchsuchte Zeilen (D4/D7), optional
  // gruppiert (D3/D5). Die AUSWAHL bleibt in checkedRows (Originalindex); dies steuert nur, was
  // sichtbar ist und welche Zeilen „Alle wählen"/Gruppen-Checkbox erfassen.
  // WP-BILD-1f RT5c: der aktive Filter-Chip gilt nur, solange sein Wert im Bestand vorkommt — sonst
  // ehrlicher Rückfall auf „Alle" (ein verschwundener Chip darf die Liste nicht leer filtern).
  const activeChip: PreviewChip =
    preview && statusChipCounts(preview.preview).some((c) => c.chip === view.chip)
      ? view.chip
      : "all";
  // WP-BILD-1f RT5c: der angeforderte Gruppier-Modus gilt nur, wenn er im aktuellen Bestand überhaupt
  // angeboten wird (≥2 Gruppen) — sonst ehrlicher Rückfall auf die flache Liste (kein toter Modus).
  const groupMode = preview
    ? effectiveGroupMode(preview.preview, view.groupMode)
    : ("none" as PreviewGroupMode);
  const rows = preview ? visibleRows(preview.preview, { ...view, chip: activeChip }) : [];
  // RT5a (nacht24): ECHTER Subfolder-Baum — im Sprach-Modus bekommen Sprach-Ordner Themen-
  // Unterordner (auf-/zuklappbar), sobald die Sprache ≥2 Themen hergibt; sonst wie bisher.
  const groups = groupRowsTree(rows, groupMode);
  const summary = selectionSummary(checkedRows);
  // F1: Bulk-Aktionen (Alle wählen, Gruppen-Checkbox) UND die Haken-Anzeige arbeiten auf DERSELBEN
  // bulk-wählbaren Teilmenge — bereits importierte/vorgemerkte Zeilen fasst kein Bulk-Setzer an.
  const bulkRows = bulkSelectableRows(rows);
  const allVisibleChecked = rowsAllChecked(checkedRows, bulkRows);
  // F2: „Alle wählen" wirkt nur auf bulk-wählbare sichtbare Zeilen; „Alle abwählen" leert GLOBAL
  // (auch weggefilterte, aber gewählte Treffer) — Beschriftung und Wirkung fallen nie auseinander.
  const toggleAll = (): void => {
    if (allVisibleChecked) {
      setCheckedRows((prev) => clearAllSelected(prev));
    } else {
      setCheckedRows((prev) => setRowsSelected(prev, bulkRows, true));
    }
  };
  // WP-BILD-1f RT5b: Gruppen-Checkbox setzt die GANZE Gruppe. ANWÄHLEN erfasst nur bulk-wählbare
  // Zeilen (F1: importierte/vorgemerkte bleiben aus); ABWÄHLEN wirkt auf ALLE Zeilen der Gruppe (auch
  // bewusst wieder-angewählte bekannte Einträge).
  const setGroupSelected = (groupRowsArg: readonly PreviewRow[], value: boolean): void => {
    setCheckedRows((prev) =>
      value
        ? setRowsSelected(prev, bulkSelectableRows(groupRowsArg), true)
        : setRowsSelected(prev, groupRowsArg, false),
    );
  };
  // RT5b: Klick auf den Gruppen-Haken — "on" → ganze Gruppe abwählen; sonst anwählen (bulk-wählbare).
  // Gibt es nichts anzuwählen (nur bekannte Zeilen), aber ist etwas gewählt, wirkt der Klick als Abwahl.
  const toggleGroup = (groupRowsArg: readonly PreviewRow[]): void => {
    const state = groupCheckboxState(checkedRows, groupRowsArg);
    const canSelect = bulkSelectableRows(groupRowsArg).length > 0;
    setGroupSelected(groupRowsArg, state !== "on" && canSelect);
  };
  // RT5a: eingeklappt-Standard bei vielen Gruppen; explizite Klicks (openGroups) haben Vorrang.
  const groupsDefaultOpen = !groupsCollapsedByDefault(groups.length);
  const isGroupOpen = (key: string): boolean => openGroups[key] ?? groupsDefaultOpen;
  const setGroupOpen = (key: string, value: boolean): void => {
    setOpenGroups((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  };
  // F3: die in der Vorschau gewählten, ZULÄSSIGEN Kandidaten-IDs (Originalindex → checkedRows) —
  // sie steuern serverseitig Gruppierung UND Übernahme (nicht nur die Kriterien).
  const selectedCandidateIds = preview
    ? preview.preview.flatMap((entry, index) =>
        checkedRows[index] === true && entry.id ? [entry.id] : [],
      )
    : [];
  const languageLabel = (lang: PreviewLanguage | undefined): string =>
    lang === "de"
      ? t("imp.select.langDe")
      : lang === "en"
        ? t("imp.select.langEn")
        : lang === "nl"
          ? t("imp.select.langNl")
          : t("imp.select.langOther");
  // WP-BILD-1f RT5c: Filter-Chips DYNAMISCH aus den tatsächlichen Treffern — nur vorkommende Werte,
  // jeweils mit Zähler (verschwindet ein Wert aus dem Bestand, verschwindet der Chip). Der aktive Chip
  // wechselt nur die Sicht, nie die Auswahl.
  const chipLabel = (chip: PreviewChip): string =>
    chip === "new"
      ? t("imp.select.chipNew")
      : chip === "imported"
        ? t("imp.select.chipImported")
        : chip === "queued"
          ? t("imp.select.chipQueued")
          : t("imp.select.chipAll");
  const chips = preview ? statusChipCounts(preview.preview) : [];
  // RT5b (nacht24): Sprach-Zähler über den GESAMTEN gefundenen Bestand — Basis der Massenaktion.
  const langCounts = preview ? languageCounts(preview.preview) : [];
  // WP-BILD-1f RT5c: Gruppier-Modi ebenfalls dynamisch — „nach Sprache"/„nach Thema" nur, wenn der
  // Bestand dafür ≥2 Gruppen hergibt. „none" (flache Liste) ist immer dabei.
  const groupModeName = (mode: PreviewGroupMode): string =>
    mode === "theme"
      ? t("imp.select.groupTheme")
      : mode === "language"
        ? t("imp.select.groupLanguage")
        : t("imp.select.groupNone");
  const groupModes = preview ? groupModeOptions(preview.preview) : [];

  // Eine Vorschau-Zeile (Checkbox + Titel + Kennzeichen) — geteilt zwischen flacher und Gruppen-Ansicht.
  const renderRow = ({ entry, index }: PreviewRow): JSX.Element => (
    <li key={`${entry.title}-${index}`} className="flex items-start gap-2 text-[12.5px] text-text">
      <input
        type="checkbox"
        aria-label={displayImportText(entry.title, entry.textCodec)}
        checked={checkedRows[index] ?? false}
        onChange={() => toggleRow(index)}
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
      {/* WP-SHIP9-S1b: eigener Zustand in EIGENER Farbe — offener Kandidat ist
          „bereits zur Prüfung vorgemerkt", nicht „bereits importiert". */}
      {entry.alreadyQueued ? (
        <span className="shrink-0 rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
          {t("imp.preview.queued")}
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
      {entry.hasImage ? <Images size={12} className="mt-0.5 shrink-0 text-muted-2" /> : null}
    </li>
  );

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
            {/* WP-IC-PAKET-1 (Teil 4): ehrlicher Import-Status der Vorschau — WP-SHIP9-S1b:
                importiert und vorgemerkt sind ZWEI getrennte Zähler. */}
            {alreadyImportedCount > 0
              ? ` · ${t("imp.select.alreadyImported", { n: alreadyImportedCount })}`
              : ""}
            {alreadyQueuedCount > 0
              ? ` · ${t("imp.select.alreadyQueued", { n: alreadyQueuedCount })}`
              : ""}
          </div>

          {/* WP-SAMMEL20-FIX (bens Fix 2): KI-Ausfall NIE still — nüchterner Hinweis, dass nur
              die Klick-Filter gelten (die weiterhin wirken; nichts wird erfunden).
              WP-SHIP9-S2 (bens Folgeschnitt B4): den WAHREN Grund zeigen — vertraulichkeitsbedingter
              Cloud-Ausschluss ist etwas anderes als „KI nicht erreichbar". */}
          {preview.inferenceStatus === "unavailable" ? (
            <p className="mt-1.5 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12px] text-trust-warn-text">
              {preview.fallbackReason === "confidential"
                ? t("imp.select.aiConfidential")
                : t("imp.select.aiUnavailable")}
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

          {/* Vorschau-Liste mit Auswahl (Teil 4): bereits Importiertes markiert + standardmäßig abgewählt.
              WP-SHIP9-S2 Paket 2: darüber die Trefferlisten-Steuerung — Suche (D7), Filter-Chips (D7),
              „Alle wählen/abwählen" (D2), „Bereits Bekanntes ausblenden" (D4), Gruppierung (D3/D5) und
              die dauerhaft sichtbare Auswahl-Zusammenfassung (D7). */}
          {preview.preview.length > 0 ? (
            <div className="mt-2 border-t border-hairline pt-2">
              {/* D7: Suchfeld über der Trefferliste. */}
              <TextInput
                value={view.query}
                onChange={(e) => setView((v) => ({ ...v, query: e.target.value }))}
                placeholder={t("imp.select.searchPlaceholder")}
                aria-label={t("imp.select.searchPlaceholder")}
              />

              {/* WP-BILD-1f RT5c: dynamische Filter-Chips (nur vorkommende Werte, mit Zähler). */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <button
                    key={c.chip}
                    type="button"
                    aria-pressed={activeChip === c.chip}
                    onClick={() => setView((v) => ({ ...v, chip: c.chip }))}
                    className={`rounded-pill border px-2.5 py-1 text-[11.5px] font-semibold ${
                      activeChip === c.chip
                        ? "border-ai/50 bg-ai-surface-1 text-ai"
                        : "border-hairline bg-surface text-muted hover:text-text"
                    }`}
                  >
                    {chipLabel(c.chip)} · {c.count}
                  </button>
                ))}
              </div>

              {/* RT5b (nacht24): „alle <Sprache> abwählen" — EIN Klick je vorkommender Sprache,
                  wirkt auf den GESAMTEN Bestand (unabhängig von Suche/Filter; nur Abwahl). */}
              <LanguageDeselectChips
                counts={langCounts}
                label={languageLabel}
                buttonText={(lang, n) => t("imp.select.deselectLang", { lang, n })}
                onDeselect={(lang) => {
                  if (preview) {
                    setCheckedRows((prev) => deselectLanguage(prev, preview.preview, lang));
                  }
                }}
              />

              {/* D2 Alle wählen/abwählen · D4 Ausblenden-Schalter · D5/D3 Gruppierung. */}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-muted">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="rounded-btn border border-hairline bg-surface px-2.5 py-1 font-semibold text-text hover:bg-hairline-soft"
                >
                  {allVisibleChecked ? t("imp.select.deselectAll") : t("imp.select.selectAll")}
                </button>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={view.hideImported}
                    onChange={(e) => setView((v) => ({ ...v, hideImported: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  {t("imp.select.hideImported")}
                </label>
                <span className="inline-flex items-center gap-1.5">
                  <span>{t("imp.select.groupBy")}</span>
                  {groupModes.map((m) => (
                    <button
                      key={m.mode}
                      type="button"
                      aria-pressed={groupMode === m.mode}
                      onClick={() => setView((v) => ({ ...v, groupMode: m.mode }))}
                      className={`rounded-btn border px-2 py-0.5 font-semibold ${
                        groupMode === m.mode
                          ? "border-ai/50 bg-ai-surface-1 text-ai"
                          : "border-hairline bg-surface text-muted hover:text-text"
                      }`}
                    >
                      {groupModeName(m.mode)}
                      {m.mode === "none" ? "" : ` · ${m.count}`}
                    </button>
                  ))}
                </span>
              </div>

              {/* D7: dauerhaft sichtbare Auswahl-Zusammenfassung „X von Y gewählt". */}
              <p className="mt-2 text-[11.5px] text-muted-2">
                {t("imp.select.summary", { selected: summary.selected, total: summary.total })}
                {alreadyImportedCount > 0 ? ` — ${t("imp.select.importedDeselected")}` : ""}
                {alreadyQueuedCount > 0 ? ` — ${t("imp.select.queuedDeselected")}` : ""}
              </p>

              {rows.length === 0 ? (
                // D4/D7: nach Ausblenden/Suche/Filter keine Zeile mehr sichtbar — ehrlich benannt.
                <p className="mt-2 text-[12px] text-muted-2">{t("imp.select.emptyFiltered")}</p>
              ) : groupMode === "none" ? (
                <ul className="mt-1.5 space-y-1 border-t border-hairline pt-2">
                  {rows.map(renderRow)}
                </ul>
              ) : (
                // WP-BILD-1f RT5a/RT5b + nacht24: auf-/zuklappbare Ordner mit Tri-State-Haken —
                // im Sprach-Modus als ECHTER Subfolder-Baum (Themen-Unterordner je Sprache).
                // Darstellung geteilt in ImportPreviewTree; Logik pure in importSelectView.
                <ImportPreviewTree
                  groups={groups}
                  isOpen={isGroupOpen}
                  setOpen={setGroupOpen}
                  checkStateOf={(groupRowsArg) => groupCheckboxState(checkedRows, groupRowsArg)}
                  onToggleGroup={toggleGroup}
                  labelOf={(group) =>
                    group.kind === "language"
                      ? languageLabel(group.language)
                      : group.value === ""
                        ? t("imp.select.noTheme")
                        : displayImportText(group.value)
                  }
                  countLabel={(n) => t("imp.select.groupCount", { n })}
                  renderRow={renderRow}
                />
              )}
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-muted-2">{t("imp.select.empty")}</p>
          )}

          {/* WP-IC-4 (Schritt 4+5): Gruppieren → Gruppen-Freigabe → Übernahme mit ehrlicher Bilanz.
              Key = Kriterien der AKTUELLEN Vorschau: eine geänderte Eingrenzung setzt den
              Gruppierungs-Schritt sauber zurück (keine veralteten Gruppen zur neuen Auswahl).
              WP-SHIP9-S2d (F3, bens GELB): die stabil sortierte Vorschau-Auswahl gehört ZUSÄTZLICH
              in den Key — ändert sich selectedCandidateIds NACH dem Gruppieren, verwirft der
              Neu-Mount den kompletten aufgebauten Zustand (Gruppen/Zweit-Auswahl/Bilanz), sodass
              die sichtbaren Gruppen NIE von der aktuellen Auswahl abweichen (und ein in-flight
              /group der alten Auswahl auf der abgemeldeten Instanz ins Leere läuft). */}
          {preview.preview.length > 0 ? (
            <ImportGroups
              key={`${JSON.stringify(preview.criteria)}|${JSON.stringify([...selectedCandidateIds].sort())}`}
              criteria={preview.criteria}
              selectedCandidateIds={selectedCandidateIds}
              aiAvailable={groupAi.available}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

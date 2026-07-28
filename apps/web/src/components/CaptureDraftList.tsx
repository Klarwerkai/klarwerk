// AUFTRAG-sortfilter · Punkt 2: „Entwürfe fortsetzen" als eigene, testbare Komponente (aus Capture.tsx
// herausgelöst — identisches Verhalten, nur gekapselt). Sie trägt die Filter-/Sortier-Sicht der
// Entwurfsliste: Volltext-/Titelsuche, in der Admin-Ansicht zusätzlich ein Ersteller-Filter, und die
// Sortierung (zuletzt gespeichert neu→alt als Default, alt→neu, Titel A→Z). Der Zustand wird PRO
// BROWSER gemerkt (localStorage über die fehlertolerante safeLocalStorage-Grenze). Leerer Filter = alle.
import { ChevronDown, RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Draft } from "../api/types";
import { draftTitle } from "../lib/draftForm";
import {
  DEFAULT_DRAFT_SORT,
  DRAFT_AUTHOR_STORAGE_KEY,
  DRAFT_QUERY_STORAGE_KEY,
  DRAFT_SORT_KEYS,
  DRAFT_SORT_LABEL_KEYS,
  DRAFT_SORT_STORAGE_KEY,
  draftCreatorIds,
  draftListView,
} from "../lib/draftListView";
import { usePersistentEnum, usePersistentString } from "../lib/usePersistentValue";
import { Button, Card, SectionLabel } from "./ui";

// Ehrlicher, lokalisierbarer Zeitstempel (dieselbe Darstellung wie zuvor inline in Capture).
function formatDraftTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "unbekannt";
  }
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(date);
}

// Ersteller-Name über das Directory (Fallback = Id, nie ein erfundener Name).
function draftAuthorName(draft: Draft, directory: readonly { id: string; name: string }[]): string {
  return directory.find((entry) => entry.id === draft.originalAuthor)?.name ?? draft.originalAuthor;
}

export interface CaptureDraftListProps {
  drafts: readonly Draft[];
  isAdmin: boolean;
  directory: readonly { id: string; name: string }[];
  open: boolean;
  onToggleOpen: () => void;
  // „Meine Entwürfe" bzw. „Admin-Ansicht: alle Entwürfe" (in Capture gebildet).
  scopeLabel: string;
  // Gerade über die Vordertür gespeicherter Entwurf (Hervorhebung) bzw. gerade in Bearbeitung.
  highlightId: string | null;
  editingId: string | null;
  confirmDiscardId: string | null;
  onConfirmDiscard: (id: string | null) => void;
  discardPending: boolean;
  onDiscard: (id: string) => void;
  onResume: (draft: Draft) => void;
}

export function CaptureDraftList({
  drafts,
  isAdmin,
  directory,
  open,
  onToggleOpen,
  scopeLabel,
  highlightId,
  editingId,
  confirmDiscardId,
  onConfirmDiscard,
  discardPending,
  onDiscard,
  onResume,
}: CaptureDraftListProps): JSX.Element | null {
  const { t } = useTranslation();
  // Filter-/Sortier-Zustand pro Browser gemerkt; ein Fremd-/Altwert der Sortierung fällt sicher zurück.
  const [query, setQuery] = usePersistentString(DRAFT_QUERY_STORAGE_KEY, "");
  const [sort, setSort] = usePersistentEnum(
    DRAFT_SORT_STORAGE_KEY,
    DRAFT_SORT_KEYS,
    DEFAULT_DRAFT_SORT,
  );
  const [authorFilter, setAuthorFilter] = usePersistentString(DRAFT_AUTHOR_STORAGE_KEY, "");

  const totalCount = drafts.length;
  if (totalCount === 0) {
    return null;
  }

  const fallbackTitle = t("capture.draftFallbackTitle");
  // Der Ersteller-Filter greift nur in der Admin-Ansicht („ALLE ENTWÜRFE"); sonst zeigt der Nutzer
  // ohnehin nur die eigenen Entwürfe.
  const visibleDrafts = draftListView(
    drafts,
    { filter: { query, author: isAdmin ? authorFilter : "" }, sort },
    fallbackTitle,
  );
  const creatorIds = isAdmin ? draftCreatorIds(drafts) : [];

  return (
    <Card className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SectionLabel>{t("capture.resumeTitle")}</SectionLabel>
          {/* AUFTRAG-mega38 BLOCK J4: die Reichweiten-Plakette ist eine ADMIN-Auskunft. Für alle
              anderen stand dort „Meine Entwürfe" neben einer Überschrift, die schon „Entwürfe
              fortsetzen" heisst — doppelt gesagt und im Admin-Fall („ADMIN-ANSICHT: ALLE
              ENTWÜRFE") schlicht nicht ihre Angelegenheit. Sie erscheint nur noch, wo sie etwas
              unterscheidet. */}
          {isAdmin ? (
            <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-2">
              {scopeLabel}
            </span>
          ) : null}
          <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-2">
            {totalCount}
          </span>
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggleOpen}
          className="inline-flex items-center gap-1 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
        >
          {open ? t("capture.resumeCollapse") : t("capture.resumeExpand", { count: totalCount })}
          <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open ? (
        <>
          {/* Volltext-/Titelsuche + Sortierung (Admin zusätzlich Ersteller-Filter). Leerer Filter = alle. */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("capture.draftSearch")}
              aria-label={t("capture.draftSearch")}
              className="h-8 min-w-[10rem] flex-1 rounded-input border border-hairline bg-surface px-2.5 text-[12.5px] text-text outline-none placeholder:text-muted-2 focus:border-ink/30"
            />
            {isAdmin ? (
              <select
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value)}
                aria-label={t("capture.draftAuthorLabel")}
                className="h-8 rounded-input border border-hairline bg-surface px-2 text-[12.5px] text-text outline-none focus:border-ink/30"
              >
                <option value="">{t("capture.draftAuthorAll")}</option>
                {creatorIds.map((id) => (
                  <option key={id} value={id}>
                    {directory.find((entry) => entry.id === id)?.name ?? id}
                  </option>
                ))}
              </select>
            ) : null}
            <label className="inline-flex items-center gap-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                {t("capture.draftSortLabel")}
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as (typeof DRAFT_SORT_KEYS)[number])}
                aria-label={t("capture.draftSortLabel")}
                className="h-8 rounded-input border border-hairline bg-surface px-2 text-[12.5px] text-text outline-none focus:border-ink/30"
              >
                {DRAFT_SORT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t(DRAFT_SORT_LABEL_KEYS[key])}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {visibleDrafts.length === 0 ? (
            <p className="rounded-btn bg-page px-3 py-2 text-[12px] leading-relaxed text-muted">
              {t("capture.draftEmptyFiltered")}
            </p>
          ) : (
            <ul className="divide-y divide-hairline">
              {visibleDrafts.map((d) => (
                <li
                  key={d.id}
                  className={`flex flex-col gap-2 py-2 sm:flex-row sm:items-center ${
                    highlightId === d.id
                      ? "rounded-card border border-trust-pos-fill/40 bg-trust-pos-bg px-2"
                      : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-text">
                      {draftTitle(d, fallbackTitle)}
                      {editingId === d.id ? (
                        <span className="ml-2 font-mono text-[10px] uppercase text-ai">
                          {t("capture.editingBadge")}
                        </span>
                      ) : null}
                      {highlightId === d.id ? (
                        <span className="ml-2 font-mono text-[10px] uppercase text-trust-pos-text">
                          {t("capture.draftJustSaved")}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted">
                      <span>
                        {t("capture.draftCreatorMeta", { name: draftAuthorName(d, directory) })}
                      </span>
                      <span>
                        {t("capture.draftSavedMeta", {
                          date: formatDraftTimestamp(d.updatedAt || d.createdAt),
                        })}
                      </span>
                      <span>{t("capture.draftStatusMeta")}</span>
                    </div>
                  </div>
                  {/* Bugfix (Pedi 04.07.): Löschen erst nach Inline-Nachfrage — kein stiller Verlust. */}
                  {confirmDiscardId === d.id ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-[11.5px] font-semibold text-text">
                        {t("capture.discardDraftQ")}
                      </span>
                      <Button variant="ghost" onClick={() => onConfirmDiscard(null)}>
                        {t("capture.discardDraftKeep")}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={discardPending}
                        onClick={() => onDiscard(d.id)}
                      >
                        {t("capture.discardDraftYes")}
                      </Button>
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onResume(d)}
                        className="inline-flex items-center gap-1 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
                      >
                        <RotateCcw size={13} />
                        {t("capture.resume")}
                      </button>
                      <button
                        type="button"
                        title={t("capture.discardDraft")}
                        onClick={() => onConfirmDiscard(d.id)}
                        className="grid h-7 w-7 place-items-center rounded-btn text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
      {/* AUFTRAG-mega38 BLOCK J4: hier stand im eingeklappten Zustand „{{count}} Entwürfe sind
          eingeklappt, damit die Erfassungswege darunter erreichbar bleiben." Das erklärt der
          Leserin UNSERE Layoutentscheidung — eine Auskunft über uns, nicht über ihre Arbeit. Die
          Zahl steht ohnehin in der Plakette daneben und im Aufklapp-Knopf („Entwürfe anzeigen
          (13)"); der Satz trug nichts hinzu ausser Rechtfertigung. */}
    </Card>
  );
}

// RT5a-c (nacht24 Paket 5): echter SUBFOLDER-Baum der Import-Vorschau + Sprach-Massenaktion.
// Reine Darstellungs-Komponenten — die Logik (Baum-Bildung, Tri-State, Sprach-Abwahl) lebt pure
// und getestet in lib/importSelectView; ImportSelect hält nur den State.
import { ChevronDown } from "lucide-react";
import type {
  GroupCheckState,
  LanguageCount,
  PreviewLanguage,
  PreviewRow,
  PreviewTreeGroup,
} from "../lib/importSelectView";

// Ein Ordner-Kopf (Sprach- oder Themen-Ebene): Chevron + Tri-State-Checkbox + Titel + Zähler.
function FolderSummary({
  label,
  count,
  open,
  checkState,
  onToggleGroup,
}: {
  label: string;
  count: string;
  open: boolean;
  checkState: GroupCheckState;
  onToggleGroup: () => void;
}): JSX.Element {
  return (
    <summary className="flex cursor-pointer list-none items-center gap-2 p-2">
      <ChevronDown
        size={14}
        aria-hidden
        className={`shrink-0 text-muted-2 transition-transform ${open ? "" : "-rotate-90"}`}
      />
      <input
        type="checkbox"
        aria-label={label}
        checked={checkState === "on"}
        ref={(el) => {
          if (el) {
            el.indeterminate = checkState === "mixed";
          }
        }}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggleGroup}
        className="h-4 w-4 shrink-0"
      />
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-text">{label}</span>
      <span className="shrink-0 text-[11px] text-muted-2">{count}</span>
    </summary>
  );
}

export function ImportPreviewTree({
  groups,
  isOpen,
  setOpen,
  checkStateOf,
  onToggleGroup,
  labelOf,
  countLabel,
  renderRow,
}: {
  groups: readonly PreviewTreeGroup[];
  isOpen: (key: string) => boolean;
  setOpen: (key: string, value: boolean) => void;
  checkStateOf: (rows: readonly PreviewRow[]) => GroupCheckState;
  onToggleGroup: (rows: readonly PreviewRow[]) => void;
  labelOf: (group: PreviewTreeGroup) => string;
  countLabel: (n: number) => string;
  renderRow: (row: PreviewRow) => JSX.Element;
}): JSX.Element {
  return (
    <div className="mt-1.5 space-y-1.5 border-t border-hairline pt-2">
      {groups.map((group) => {
        const open = isOpen(group.key);
        return (
          <details
            key={group.key}
            open={open}
            onToggle={(e) => setOpen(group.key, e.currentTarget.open)}
            className="rounded-card border border-hairline bg-surface"
          >
            <FolderSummary
              label={labelOf(group)}
              count={countLabel(group.rows.length)}
              open={open}
              checkState={checkStateOf(group.rows)}
              onToggleGroup={() => onToggleGroup(group.rows)}
            />
            {group.children && group.children.length > 0 ? (
              // RT5a (nacht24): ECHTE Unterordner (Themen in der Sprache) — je eigener Auf/Zu-
              // Zustand, eigene Tri-State-Checkbox, eingerückt unter dem Sprach-Ordner.
              <div className="space-y-1.5 border-t border-hairline p-2 pl-6">
                {group.children.map((child) => {
                  // Unterordner-Schlüssel ist pfad-artig (Sprache/Thema) — stabil und kollisionsfrei.
                  const childKey = `${group.key}/${child.key}`;
                  const childOpen = isOpen(childKey);
                  return (
                    <details
                      key={childKey}
                      open={childOpen}
                      onToggle={(e) => setOpen(childKey, e.currentTarget.open)}
                      className="rounded-card border border-hairline bg-page"
                    >
                      <FolderSummary
                        label={labelOf(child)}
                        count={countLabel(child.rows.length)}
                        open={childOpen}
                        checkState={checkStateOf(child.rows)}
                        onToggleGroup={() => onToggleGroup(child.rows)}
                      />
                      <ul className="space-y-1 border-t border-hairline p-2">
                        {child.rows.map(renderRow)}
                      </ul>
                    </details>
                  );
                })}
              </div>
            ) : (
              <ul className="space-y-1 border-t border-hairline p-2">
                {group.rows.map(renderRow)}
              </ul>
            )}
          </details>
        );
      })}
    </div>
  );
}

// RT5b (nacht24): „alle <Sprache> abwählen" — EINE Klick-Aktion je vorkommender Sprache über den
// GESAMTEN Bestand (unabhängig von Suche/Filter/Sichtbarkeit; nur Abwahl, nie versteckte Anwahl).
// Erscheint erst ab zwei Sprachen (bei einer wäre es identisch mit „Alle abwählen").
export function LanguageDeselectChips({
  counts,
  label,
  buttonText,
  onDeselect,
}: {
  counts: readonly LanguageCount[];
  label: (lang: PreviewLanguage) => string;
  buttonText: (lang: string, n: number) => string;
  onDeselect: (lang: PreviewLanguage) => void;
}): JSX.Element | null {
  if (counts.length < 2) {
    return null;
  }
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {counts.map((c) => (
        <button
          key={c.language}
          type="button"
          onClick={() => onDeselect(c.language)}
          className="rounded-pill border border-hairline bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-muted hover:text-text"
        >
          {buttonText(label(c.language), c.count)}
        </button>
      ))}
    </div>
  );
}

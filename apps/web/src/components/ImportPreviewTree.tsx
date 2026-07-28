// RT5a-c (nacht24 Paket 5): echter SUBFOLDER-Baum der Import-Vorschau + Sprach-Massenaktion.
// Reine Darstellungs-Komponenten — die Logik (Baum-Bildung, Tri-State, Sprach-Abwahl) lebt pure
// und getestet in lib/importSelectView; ImportSelect hält nur den State.
//
// AUFTRAG-mega27 A5: die Ordner-Darstellung ist REKURSIV — der Quell-Ordnerbaum hat beliebige
// Tiefe, nicht mehr genau zwei Ebenen. Unverändert gilt dabei:
//   • Der Auswahl-Zustand bleibt `checkedRows: boolean[]`, indexiert nach dem ORIGINAL-Index in
//     `preview[]`; diese Komponente reicht ausschließlich PreviewRow-Objekte durch und kennt den
//     Index nur als Durchreiche-Wert.
//   • Der Dreizustand eines Ordners aggregiert über den GESAMTEN Teilbaum — `group.rows` IST der
//     Teilbaum (s. PreviewGroup.rows), die direkten Kinder stehen getrennt in `ownRows`.
//   • F1/F2 (welche Zeilen ein Bulk anfassen darf) bleiben vollständig beim Aufrufer.
import { ChevronDown } from "lucide-react";
import type {
  GroupCheckState,
  LanguageCount,
  PreviewLanguage,
  PreviewRow,
  PreviewTreeGroup,
} from "../lib/importSelectView";

// Ein Ordner-Kopf (Quell-, Sprach- oder Themen-Ebene): Chevron + Tri-State-Checkbox + Titel + Zähler.
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

interface TreeCallbacks {
  isOpen: (key: string, siblingCount: number) => boolean;
  setOpen: (key: string, value: boolean) => void;
  checkStateOf: (rows: readonly PreviewRow[]) => GroupCheckState;
  onToggleGroup: (rows: readonly PreviewRow[]) => void;
  labelOf: (group: PreviewTreeGroup) => string;
  countLabel: (n: number) => string;
  renderRow: (row: PreviewRow) => JSX.Element;
}

// A5: EIN Ordner-Knoten — und für jeden Unterordner wieder derselbe Knoten. Der Schlüssel wächst
// pfad-artig mit (Eltern-Schlüssel + „/" + Segment) und bleibt damit über den ganzen Baum stabil
// und kollisionsfrei; für den Sprach-/Themen-Baum ergibt das exakt die bisherigen Schlüssel.
function FolderNode({
  group,
  prefix,
  depth,
  siblingCount,
  cb,
}: {
  group: PreviewTreeGroup;
  prefix: string;
  depth: number;
  siblingCount: number;
  cb: TreeCallbacks;
}): JSX.Element {
  const nodeKey = prefix ? `${prefix}/${group.key}` : group.key;
  const open = cb.isOpen(nodeKey, siblingCount);
  const children = group.children ?? [];
  // Zeilen, die DIREKT an diesem Knoten hängen. Ohne `ownRows` (Sprach-/Themen-Baum) gilt das
  // bisherige Verhalten unverändert: hat der Knoten Unterordner, stecken alle Zeilen dort; sonst
  // sind es seine eigenen.
  const leafRows = group.ownRows ?? (children.length > 0 ? [] : group.rows);
  return (
    <details
      open={open}
      onToggle={(e) => cb.setOpen(nodeKey, e.currentTarget.open)}
      className={`rounded-card border border-hairline ${depth === 0 ? "bg-surface" : "bg-page"}`}
    >
      <FolderSummary
        label={cb.labelOf(group)}
        // Der Zähler nennt den GESAMTEN Teilbaum — dieselbe Menge, die der Haken erfasst.
        count={cb.countLabel(group.rows.length)}
        open={open}
        checkState={cb.checkStateOf(group.rows)}
        onToggleGroup={() => cb.onToggleGroup(group.rows)}
      />
      {children.length > 0 ? (
        // ECHTE Unterordner — je eigener Auf/Zu-Zustand, eigene Tri-State-Checkbox, eingerückt.
        <div className="space-y-1.5 border-t border-hairline p-2 pl-6">
          {children.map((child) => (
            <FolderNode
              key={child.key}
              group={child}
              prefix={nodeKey}
              depth={depth + 1}
              siblingCount={children.length}
              cb={cb}
            />
          ))}
        </div>
      ) : null}
      {leafRows.length > 0 ? (
        <ul className="space-y-1 border-t border-hairline p-2">{leafRows.map(cb.renderRow)}</ul>
      ) : null}
    </details>
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
  // A5: der Einklapp-Standard hängt an der Zahl der GESCHWISTER auf DIESER Ebene (s. Begründung an
  // groupsCollapsedByDefault) — die Komponente reicht sie durch, entscheidet aber nichts selbst.
  isOpen: (key: string, siblingCount: number) => boolean;
  setOpen: (key: string, value: boolean) => void;
  checkStateOf: (rows: readonly PreviewRow[]) => GroupCheckState;
  onToggleGroup: (rows: readonly PreviewRow[]) => void;
  labelOf: (group: PreviewTreeGroup) => string;
  countLabel: (n: number) => string;
  renderRow: (row: PreviewRow) => JSX.Element;
}): JSX.Element {
  const cb: TreeCallbacks = {
    isOpen,
    setOpen,
    checkStateOf,
    onToggleGroup,
    labelOf,
    countLabel,
    renderRow,
  };
  return (
    <div className="mt-1.5 space-y-1.5 border-t border-hairline pt-2">
      {groups.map((group) => (
        <FolderNode
          key={group.key}
          group={group}
          prefix=""
          depth={0}
          siblingCount={groups.length}
          cb={cb}
        />
      ))}
    </div>
  );
}

// RT5b (nacht24): „alle <Sprache> abwählen" — EINE Klick-Aktion je vorkommender Sprache über den
// GESAMTEN Bestand (unabhängig von Suche/Filter/Sichtbarkeit; nur Abwahl, nie versteckte Anwahl).
// Erscheint erst ab zwei Sprachen (bei einer wäre es identisch mit „Alle abwählen").
// AUFTRAG-mega27 B4: eine MASSENAKTION, kein Filter — sie steht deshalb bei „Alle abwählen" und
// nicht mehr in der Filterzeile.
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
    <div className="flex flex-wrap gap-1.5">
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

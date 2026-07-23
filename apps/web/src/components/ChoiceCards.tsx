// WP-SHIP9-S2 Paket 2 (B1): wiederverwendbares Befehlsfeld — eine Gruppe klar erkennbarer
// Auswahl-Flächen (Radio-Optik: sichtbarer Punkt + hervorgehobene Karte für die aktive Wahl).
// Ersetzt lose zusammengeklickte Button-Raster an Befehlsfeldern (Datei: Teil/Gesamt zuerst); andere
// Befehlsfelder können dasselbe Muster nutzen. Semantik: ein echtes Radiogroup (Tastatur/Screenreader).
import type { ReactNode } from "react";
import { cx } from "./ui";

export interface ChoiceOption<T extends string> {
  id: T;
  label: ReactNode;
  description?: ReactNode;
}

export function ChoiceCards<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 2,
  className,
}: {
  label?: ReactNode;
  value: T;
  options: ReadonlyArray<ChoiceOption<T>>;
  onChange: (id: T) => void;
  columns?: 1 | 2 | 3;
  className?: string;
}): JSX.Element {
  const gridCls =
    columns === 1 ? "sm:grid-cols-1" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <div className={className}>
      {label ? (
        <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">{label}</span>
      ) : null}
      {/* aria-pressed-Buttons (gleiches Muster wie die übrigen Auswahl-/Befehlsfelder im Repo) —
          semantisch klar „gewählt/nicht gewählt", ohne role=radio-Umbau. */}
      <div className={cx("grid gap-2", gridCls)}>
        {options.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={cx(
                "flex items-start gap-2 rounded-card border px-3 py-2 text-left transition-colors",
                active
                  ? "border-ai/60 bg-ai-surface-1 text-text ring-1 ring-ai/30"
                  : "border-hairline bg-page text-muted hover:border-ink/30 hover:text-text",
              )}
            >
              {/* Sichtbarer Radio-Punkt — macht „gewählt/nicht gewählt" auf einen Blick klar. */}
              <span
                aria-hidden="true"
                className={cx(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  active ? "border-ai bg-ai" : "border-hairline bg-surface",
                )}
              >
                {active ? <span className="h-1.5 w-1.5 rounded-full bg-surface" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold">{option.label}</span>
                {option.description ? (
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-2">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

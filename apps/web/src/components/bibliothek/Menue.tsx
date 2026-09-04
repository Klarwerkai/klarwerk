import { ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cx } from "../ui";

// ==================================================================================================
// JOB 3063 · H4 — DAS UNTERMENÜ IST DER ORT, AN DEN EINE FUNKTION ZIEHT, NICHT DER, AN DEM SIE STIRBT.
// ==================================================================================================
//
// Pedi 04.09.: „Stelle 100 % sicher, dass wir keine Funktion verlieren. Orientiere dich an Pages,
// arbeite mit Untermenüs." Genau dafür ist diese Datei da: ein Menü, das eine BESCHRIFTUNG trägt und
// sonst nichts — kein Erklärsatz, kein Hilfe-Tipp. Was im Sichtfeld nicht steht, steht hier drin.
//
// Bauform bewusst schlicht und ohne Fremdbibliothek: ein Knopf mit `aria-expanded`/`aria-haspopup`,
// darunter ein `role="menu"` mit echten `<button role="menuitem">`. Schließen über Escape, Klick
// nach außen und (bei einfachen Einträgen) den Klick selbst. Der Fokus geht beim Schließen zurück
// auf den Knopf — sonst landet er am Seitenanfang.

export function Menue({
  beschriftung,
  ariaLabel,
  zusatz,
  testId,
  ausrichtung = "links",
  breite = "w-[230px]",
  children,
}: {
  beschriftung: string;
  /** Zugängliche Beschriftung, wenn die sichtbare nur ein Zeichen ist („…"). */
  ariaLabel?: string | undefined;
  // Zahl aktiver Wahlen am Menü („Filter · 2") — steht als TEXT da, nie nur als Farbe.
  zusatz?: string | undefined;
  testId?: string | undefined;
  ausrichtung?: "links" | "rechts" | undefined;
  breite?: string | undefined;
  // Bekommt `schliessen`, damit ein Eintrag das Menü nach seiner Handlung zumachen kann.
  children: (schliessen: () => void) => ReactNode;
}): JSX.Element {
  const [offen, setOffen] = useState(false);
  const huelle = useRef<HTMLDivElement | null>(null);
  const knopf = useRef<HTMLButtonElement | null>(null);
  const id = useId();

  useEffect(() => {
    if (!offen) {
      return;
    }
    const beiKlick = (e: MouseEvent): void => {
      if (huelle.current && !huelle.current.contains(e.target as Node)) {
        setOffen(false);
      }
    };
    const beiTaste = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        setOffen(false);
        knopf.current?.focus();
      }
    };
    document.addEventListener("mousedown", beiKlick);
    document.addEventListener("keydown", beiTaste);
    return () => {
      document.removeEventListener("mousedown", beiKlick);
      document.removeEventListener("keydown", beiTaste);
    };
  }, [offen]);

  return (
    <div ref={huelle} className="relative">
      <button
        ref={knopf}
        type="button"
        aria-expanded={offen}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-controls={offen ? id : undefined}
        data-testid={testId}
        onClick={() => setOffen((v) => !v)}
        className={cx(
          "inline-flex items-center gap-1 rounded-btn px-1.5 py-1 text-[12.5px] outline-none",
          zusatz ? "font-semibold text-text" : "text-muted",
          "hover:bg-hairline-soft",
        )}
      >
        {zusatz ? `${beschriftung} · ${zusatz}` : beschriftung}
        <ChevronDown size={12} aria-hidden className="text-muted-2" />
      </button>
      {offen ? (
        <div
          id={id}
          role="menu"
          className={cx(
            "absolute z-30 mt-1 max-h-[26rem] overflow-y-auto rounded-[10px] border border-hairline bg-surface p-1.5 shadow-popover",
            breite,
            ausrichtung === "rechts" ? "right-0" : "left-0",
          )}
        >
          {children(() => {
            setOffen(false);
            knopf.current?.focus();
          })}
        </div>
      ) : null}
    </div>
  );
}

// Ein einfacher Menüeintrag. `haken` zeigt eine getroffene Wahl als Zeichen UND über `aria-checked`
// — nie nur über Farbe.
export function MenuePunkt({
  children,
  onClick,
  haken,
  disabled,
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  haken?: boolean;
  disabled?: boolean;
  testId?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      role={haken === undefined ? "menuitem" : "menuitemcheckbox"}
      aria-checked={haken === undefined ? undefined : haken}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-btn px-2.5 py-1.5 text-left text-[13px] text-text outline-none hover:bg-hairline-soft disabled:opacity-45"
    >
      <span aria-hidden className="w-3 shrink-0 text-[11px] text-text">
        {haken ? "✓" : ""}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

// Ein Menüeintrag, der kein Knopf ist (Link, Datei-Auswahl, RoleLink-Fassung).
export function MenueZeile({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex w-full items-center gap-2 rounded-btn px-2.5 py-1.5 text-[13px] text-text hover:bg-hairline-soft">
      <span aria-hidden className="w-3 shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

export function MenueTrenner(): JSX.Element {
  return <div aria-hidden className="my-1 h-px bg-hairline" />;
}

// Untermenü im Menü (Pages-Regel: was nicht ins Sichtfeld gehört, liegt eine Ebene tiefer).
// Bewusst ein `<details>`: aufklappbar, tastaturbedienbar und ohne eigenen Zustand im Elternteil.
export function MenueUntermenue({
  beschriftung,
  zusatz,
  children,
}: {
  beschriftung: string;
  zusatz?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-btn px-2.5 py-1.5 text-[13px] text-text hover:bg-hairline-soft">
        <span aria-hidden className="w-3 shrink-0 text-[11px] text-muted-2 group-open:rotate-90">
          ›
        </span>
        <span className="min-w-0 flex-1">{beschriftung}</span>
        {zusatz ? <span className="shrink-0 text-[11.5px] text-muted">{zusatz}</span> : null}
      </summary>
      <div className="ml-3 border-l border-hairline pl-1.5">{children}</div>
    </details>
  );
}

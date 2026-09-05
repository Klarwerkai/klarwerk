import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { GuardedLink } from "../app/NavGuardContext";

// ================================================================================================
// JOB 3060 · H1 — DIE MENÜ-BAUSTEINE NACH PAGES-ART.
// ================================================================================================
//
// Pedi (04.09. 07:58): „Orientiere dich an Pages, arbeite mit Untermenüs." Das Vorbild steht in
// `design/klarwerk/Menues.dc.html`: eine weiße Fläche mit feinem Rand und weichem Schatten, Zeilen
// von 13 px mit 6 px × 10 px Polster, Trennlinien dazwischen, ein Wert rechts. Zwei Menüs der Hülle
// (Zahnrad, Konto) und der Off-Canvas-Drawer benutzen DIESELBEN Zeilen — eine Bauform, drei Orte.
//
// TASTATUR: der Auslöser trägt `aria-haspopup="menu"` und `aria-expanded`; die Fläche ist ein
// `role="menu"`, ihre Zeilen sind `menuitem`s. Pfeil hoch/runter wandert zwischen den Zeilen,
// Escape schließt und gibt den Fokus an den Auslöser zurück, ein Klick daneben schließt ebenfalls.
// Beim Öffnen liegt der Fokus auf der ersten Zeile.
//
// NAVIGATION läuft ausschließlich über `GuardedLink` (Ungespeichert-Wächter, mega39 B) — keine
// Shell-Datei darf ein rohes `<Link>` oder `<a href>` auf eine Route tragen
// (tests/app/shell-links-guarded.test.ts).

const ZEILEN_SELEKTOR =
  '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="menu"] input, [role="menu"] a[href], [role="menu"] button';

function zeilenIn(flaeche: HTMLElement | null): HTMLElement[] {
  if (!flaeche) {
    return [];
  }
  return [...flaeche.querySelectorAll<HTMLElement>(ZEILEN_SELEKTOR)].filter(
    (el) => !el.hasAttribute("disabled") && el.closest("[hidden]") === null,
  );
}

interface MenueZustand {
  offen: boolean;
  oeffnen: () => void;
  schliessen: (fokusZurueck?: boolean) => void;
  umschalten: () => void;
  ausloeserRef: RefObject<HTMLButtonElement>;
  flaecheRef: RefObject<HTMLDivElement>;
  flaecheId: string;
  /** Tastenbehandlung der Fläche: Pfeile wandern, Escape schließt. */
  onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => void;
}

/** Der Zustand eines aufklappenden Menüs: offen/zu, Fokusrückgabe, Klick daneben, Escape. */
export function useMenue(): MenueZustand {
  const [offen, setOffen] = useState(false);
  const ausloeserRef = useRef<HTMLButtonElement>(null);
  const flaecheRef = useRef<HTMLDivElement>(null);
  const flaecheId = useId();

  const schliessen = useCallback((fokusZurueck = true): void => {
    setOffen(false);
    if (fokusZurueck) {
      ausloeserRef.current?.focus();
    }
  }, []);
  const oeffnen = useCallback((): void => setOffen(true), []);
  const umschalten = useCallback((): void => setOffen((v) => !v), []);

  // Klick daneben schließt — auf dem Dokument, damit auch ein Klick in den Seiteninhalt zählt.
  useEffect(() => {
    if (!offen) {
      return;
    }
    const onDown = (e: MouseEvent): void => {
      const ziel = e.target as Node | null;
      if (!ziel) {
        return;
      }
      if (flaecheRef.current?.contains(ziel) || ausloeserRef.current?.contains(ziel)) {
        return;
      }
      setOffen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [offen]);

  // Beim Öffnen: Fokus auf die erste Zeile, damit die Tastatur sofort im Menü ist.
  useEffect(() => {
    if (!offen) {
      return;
    }
    const erste = zeilenIn(flaecheRef.current)[0];
    erste?.focus();
  }, [offen]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>): void => {
      if (e.key === "Escape") {
        e.stopPropagation();
        schliessen(true);
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") {
        return;
      }
      const zeilen = zeilenIn(flaecheRef.current);
      if (zeilen.length === 0) {
        return;
      }
      e.preventDefault();
      const aktiv = document.activeElement as HTMLElement | null;
      const stelle = aktiv ? zeilen.indexOf(aktiv) : -1;
      const ziel =
        stelle === -1
          ? e.key === "ArrowDown"
            ? 0
            : zeilen.length - 1
          : (stelle + (e.key === "ArrowDown" ? 1 : -1) + zeilen.length) % zeilen.length;
      zeilen[ziel]?.focus();
    },
    [schliessen],
  );

  return { offen, oeffnen, schliessen, umschalten, ausloeserRef, flaecheRef, flaecheId, onKeyDown };
}

/** Die aufklappende Fläche (Pages-Art). Rendert nur, wenn offen. */
export function MenueFlaeche({
  menue,
  label,
  className = "",
  children,
  testid,
}: {
  menue: MenueZustand;
  label: string;
  className?: string;
  children: ReactNode;
  testid?: string;
}): JSX.Element | null {
  if (!menue.offen) {
    return null;
  }
  return (
    <div
      ref={menue.flaecheRef}
      id={menue.flaecheId}
      role="menu"
      aria-label={label}
      data-testid={testid}
      onKeyDown={menue.onKeyDown}
      className={`kw-menue absolute right-0 top-[calc(100%+8px)] z-30 flex w-[260px] flex-col rounded-[10px] border border-hairline bg-surface p-1.5 text-text shadow-popover ${className}`}
    >
      {children}
    </div>
  );
}

const ZEILE_KLASSE =
  "kw-menue-zeile flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[13px] text-text hover:bg-hairline-soft focus-visible:bg-hairline-soft focus-visible:outline-none";

/**
 * Eine Menüzeile: als Link (über den Wächter) oder als Knopf. `wert` steht rechts (Zahl, Zustand),
 * `aktiv` zeichnet die aktuelle Seite aus (aria-current).
 */
export function MenueZeile({
  to,
  onClick,
  children,
  wert,
  aktiv = false,
  title,
  rolle = "menuitem",
  checked,
  className = "",
  testid,
  state,
}: {
  to?: string;
  onClick?: () => void;
  children: ReactNode;
  wert?: ReactNode;
  aktiv?: boolean;
  title?: string;
  rolle?: "menuitem" | "menuitemcheckbox" | "menuitemradio";
  checked?: boolean;
  className?: string;
  testid?: string;
  state?: unknown;
}): JSX.Element {
  const inhalt = (
    <>
      <span className={`min-w-0 flex-1 truncate ${aktiv ? "font-semibold" : ""}`}>{children}</span>
      {wert === undefined || wert === null ? null : (
        <span className="kw-menue-wert shrink-0 text-[12.5px] text-muted-2">{wert}</span>
      )}
    </>
  );
  if (to !== undefined) {
    return (
      <GuardedLink
        to={to}
        role={rolle}
        aria-current={aktiv ? "page" : undefined}
        title={title}
        data-testid={testid}
        onClick={onClick}
        {...(state === undefined ? {} : { state })}
        className={`${ZEILE_KLASSE} ${className}`}
      >
        {inhalt}
      </GuardedLink>
    );
  }
  return (
    <button
      type="button"
      role={rolle}
      aria-checked={rolle === "menuitem" ? undefined : checked}
      title={title}
      data-testid={testid}
      onClick={onClick}
      className={`${ZEILE_KLASSE} ${className}`}
    >
      {inhalt}
    </button>
  );
}

/** Die feine Linie zwischen zwei Gruppen. */
export function MenueTrenner(): JSX.Element {
  return <hr className="kw-menue-trenner my-1 h-px border-0 bg-hairline" />;
}

/** Eine kleine Überschrift über einer Gruppe (z. B. „Status"). */
export function MenueKopf({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="kw-menue-kopf px-2.5 pb-0.5 pt-1.5 text-[11px] font-semibold tracking-[0.02em] text-muted-2">
      {children}
    </div>
  );
}

/**
 * Ein Untermenü, das sich IN der Fläche aufklappt (Pages: ein Pfeil rechts, darunter die Liste).
 * Die Zeile trägt `aria-expanded`; der Inhalt ist eine benannte Gruppe.
 */
export function MenueAufklapp({
  label,
  wert,
  offen,
  onToggle,
  children,
  testid,
}: {
  label: string;
  wert?: ReactNode;
  offen: boolean;
  onToggle: () => void;
  children: ReactNode;
  testid?: string;
}): JSX.Element {
  const gruppeId = useId();
  return (
    <>
      <button
        type="button"
        role="menuitem"
        aria-expanded={offen}
        aria-controls={gruppeId}
        data-testid={testid}
        onClick={onToggle}
        className={ZEILE_KLASSE}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {wert === undefined || wert === null ? null : (
          <span className="kw-menue-wert shrink-0 text-[12.5px] text-muted-2">{wert}</span>
        )}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 text-muted-2 transition-transform ${offen ? "rotate-90" : ""}`}
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
      {offen ? (
        <div id={gruppeId} className="kw-menue-gruppe pb-1 pl-2">
          {children}
        </div>
      ) : null}
    </>
  );
}

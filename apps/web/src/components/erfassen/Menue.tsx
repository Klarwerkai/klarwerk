import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";

// ================================================================================================
// JOB 3062 · H3 — DAS UNTERMENÜ NACH PAGES-ART.
// ================================================================================================
//
// PEDIS VORGABE (04.09. 07:58): „Orientiere dich an Pages, arbeite mit Untermenüs. Behalte die
// klare Linie bei. Wir haben sehr, sehr viele Informationsfunktionen."
//
// Ein Blatt hat Platz für Titel und Text — sonst nichts. Alles andere, was die Erfassung KANN,
// liegt hinter einem Werkzeug der Zeile darüber und klappt bei Klick als Liste darunter auf. Das
// ist genau die Bauform des Mockups `design/klarwerk/Menues.dc.html`: weiße Fläche, eine Haarlinie,
// Radius 10 px, der Werkbank-Schatten, Einträge 13,5 px auf 36 px Höhe.
//
// EINE MECHANIK, NICHT SIEBEN: Öffnen/Schließen, Klick nach außen, Escape und die
// Tastaturzugänglichkeit (`aria-haspopup`, `aria-expanded`, `aria-controls`) stehen hier EINMAL.
// Die Werkzeugzeile hält den offenen Namen als EINEN Zustand — es kann also nie zwei offene Menüs
// geben, und kein Werkzeug baut sich seine eigene Auslegung davon.
export interface MenueProps {
  /** Stabiler Name dieses Menüs — der Schlüssel im gemeinsamen Offen-Zustand der Zeile. */
  name: string;
  /** Der offene Name der Zeile (oder null). */
  offen: string | null;
  /** Setzt den offenen Namen der Zeile. */
  setOffen: (name: string | null) => void;
  /** Beschriftung des Werkzeugs — das eine Wort, das der Mensch liest. */
  wort: string;
  /** Das 16-px-Symbol links vom Wort (Mockup Z.36-38); ohne Symbol bleibt nur das Wort. */
  symbol?: ReactNode;
  /** Rechte Zeilenhälfte (Bereich, Vertraulichkeit, …): Rahmen, Fläche, Chevron. */
  gerahmt?: boolean;
  /** Gesperrt (z. B. „Diktieren" ohne SpeechRecognition) — sichtbar grau, NICHT verschwunden. */
  gesperrt?: boolean;
  /** Grund der Sperre bzw. Kurzhinweis am Werkzeug (title). */
  titel?: string;
  /** Ein zusätzlicher Rand am Werkzeug — die Pflichtmarkierung der Vertraulichkeit (§5.4). */
  markiert?: boolean;
  /** Der Inhalt der aufklappenden Fläche. */
  children: ReactNode;
  /** Testanker. */
  pruefname?: string;
}

const CHEVRON = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#9AA2B1"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <title>·</title>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export function Menue({
  name,
  offen,
  setOffen,
  wort,
  symbol,
  gerahmt = false,
  gesperrt = false,
  titel,
  markiert = false,
  children,
  pruefname,
}: MenueProps): JSX.Element {
  const istOffen = offen === name;
  const huelle = useRef<HTMLDivElement | null>(null);
  const flaecheId = useId();

  // Klick nach außen und Escape schließen — beides nur, solange DIESES Menü offen ist. Der Hörer
  // hängt am Dokument und nicht an der Hülle: ein Klick auf eine andere Stelle der Seite erreicht
  // die Hülle sonst nie.
  useEffect(() => {
    if (!istOffen) {
      return;
    }
    const beiKlick = (ereignis: MouseEvent): void => {
      if (huelle.current && !huelle.current.contains(ereignis.target as Node)) {
        setOffen(null);
      }
    };
    const beiTaste = (ereignis: KeyboardEvent): void => {
      if (ereignis.key === "Escape") {
        setOffen(null);
      }
    };
    document.addEventListener("mousedown", beiKlick);
    document.addEventListener("keydown", beiTaste);
    return () => {
      document.removeEventListener("mousedown", beiKlick);
      document.removeEventListener("keydown", beiTaste);
    };
  }, [istOffen, setOffen]);

  const werkzeugKlasse = gerahmt
    ? `inline-flex items-center gap-1.5 rounded-[8px] border bg-surface px-3 py-1.5 text-[13px] ${
        markiert ? "border-trust-crit-fill" : "border-hairline"
      } ${gesperrt ? "text-muted-2 opacity-60" : "text-text hover:bg-hairline-soft"}`
    : `inline-flex items-center gap-1.5 text-[13px] ${
        gesperrt ? "text-muted-2 opacity-50" : "text-muted-2 hover:text-text"
      }`;

  return (
    <div className="relative" ref={huelle}>
      <button
        type="button"
        disabled={gesperrt}
        aria-haspopup="menu"
        aria-expanded={istOffen}
        aria-controls={flaecheId}
        title={titel ?? undefined}
        data-testid={pruefname ?? `blatt-werkzeug-${name}`}
        onClick={() => setOffen(istOffen ? null : name)}
        className={werkzeugKlasse}
      >
        {symbol}
        {wort}
        {gerahmt ? CHEVRON : null}
      </button>
      {istOffen ? (
        <div
          id={flaecheId}
          role="menu"
          data-testid={`blatt-menue-${name}`}
          className={`absolute z-40 mt-1.5 min-w-[220px] max-w-[340px] rounded-[10px] border border-hairline bg-surface p-1 shadow-tile ${
            gerahmt ? "right-0" : "left-0"
          }`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

// Ein Eintrag der Liste — 36 px hoch, 13,5 px, links bündig (Auftrag §5.2).
export function MenueEintrag({
  children,
  onClick,
  gesperrt = false,
  gewaehlt = false,
  titel,
}: {
  children: ReactNode;
  onClick: () => void;
  gesperrt?: boolean;
  gewaehlt?: boolean;
  titel?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={gesperrt}
      title={titel ?? undefined}
      onClick={onClick}
      className={`flex h-9 w-full items-center gap-2 rounded-[7px] px-3 text-left text-[13.5px] ${
        gesperrt
          ? "cursor-default text-muted-2 opacity-50"
          : gewaehlt
            ? "bg-hairline-soft font-semibold text-text"
            : "text-text hover:bg-hairline-soft"
      }`}
    >
      {children}
    </button>
  );
}

// Eine Trennlinie zwischen zwei Gruppen derselben Liste.
export function MenueTrenner(): JSX.Element {
  return <div aria-hidden="true" className="my-1 h-px bg-hairline" />;
}

// Eine MENÜFLÄCHE: kein Eintrag, sondern Inhalt (Status, Hilfe, Anhänge, Entwürfe). Sie ist der
// Ort aus dem Funktionsinventar §5a für alles, was heute als Karte auf der Fläche stand.
export function MenueFlaeche({ children }: { children: ReactNode }): JSX.Element {
  return <div className="max-h-[420px] w-[320px] overflow-auto px-2 py-1.5">{children}</div>;
}

// OCR-E01 · Der erkannte (bzw. berichtigte) Bildtext als wählbare Stellen.
//
// Jedes Wort ist eine Schaltfläche, die seine Fundstelle am Original öffnet — auch wenn keine
// Position bekannt ist (dann zeigt die Ansicht das Bild und sagt, dass nichts markiert ist).
// Tastatur: EIN Tab-Stopp für den ganzen Text; Pfeiltasten, Pos1 und Ende wandern zwischen den
// Wörtern, Eingabe oder Leertaste öffnet die Fundstelle. Der sichtbare Text bleibt Zeichen für
// Zeichen derselbe (Leerraum und Zeilenumbrüche stehen zwischen den Schaltflächen).
import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type TextStelle, textStellen } from "../lib/bildFundstelle";
import type { WortPosition } from "../lib/bildRahmen";

const STELLE =
  "m-0 inline cursor-pointer rounded-sm border-0 bg-transparent p-0 text-left [color:inherit] [font:inherit] underline decoration-dotted decoration-1 underline-offset-2 hover:bg-ai/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ai";

export function BildTextStellen({
  text,
  woerter,
  onWaehle,
}: {
  text: string;
  woerter: readonly WortPosition[] | undefined;
  onWaehle: (stelle: TextStelle, index: number) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const stellen = useMemo(() => textStellen(text, woerter), [text, woerter]);
  const [aktiv, setAktiv] = useState(0);
  const knoepfe = useRef<(HTMLButtonElement | null)[]>([]);
  const fokus = (i: number): void => {
    const ziel = Math.max(0, Math.min(stellen.length - 1, i));
    setAktiv(ziel);
    knoepfe.current[ziel]?.focus();
  };
  const taste = (e: KeyboardEvent<HTMLButtonElement>, i: number): void => {
    const sprung: Record<string, number> = {
      ArrowRight: i + 1,
      ArrowDown: i + 1,
      ArrowLeft: i - 1,
      ArrowUp: i - 1,
      Home: 0,
      End: stellen.length - 1,
    };
    const ziel = sprung[e.key];
    if (ziel !== undefined) {
      e.preventDefault();
      fokus(ziel);
    }
  };
  const ende = text.length - text.trimEnd().length;
  return (
    <pre
      data-testid="bild-befund-text"
      className="mt-0.5 whitespace-pre-wrap break-words font-sans text-text"
    >
      {stellen.map((s, i) => (
        <span key={s.start}>
          {s.vor}
          <button
            ref={(el) => {
              knoepfe.current[i] = el;
            }}
            type="button"
            data-testid="bild-befund-stelle"
            data-wort={s.wort ?? ""}
            data-ersetzt={s.ersetzt ? "true" : "false"}
            tabIndex={i === Math.min(aktiv, stellen.length - 1) ? 0 : -1}
            aria-label={t("bildfundstelle.stelle.zeigen", { wort: s.text })}
            className={STELLE}
            onFocus={() => setAktiv(i)}
            onKeyDown={(e) => taste(e, i)}
            onClick={() => onWaehle(s, i)}
          >
            {s.text}
          </button>
        </span>
      ))}
      {ende > 0 ? text.slice(text.length - ende) : null}
    </pre>
  );
}

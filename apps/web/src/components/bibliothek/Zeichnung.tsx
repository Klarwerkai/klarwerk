import { type KeyboardEvent, type MouseEvent, useRef } from "react";
import {
  type Zeichnungspunkt,
  punktAusTipp,
  punktProzent,
  punktVerschieben,
} from "../../lib/zeichnungspunkt";

// ==================================================================================================
// PLAN-SPRACHANMERKUNG (R-1625, R-2177) — DIE ZEICHNUNG MIT IHRER MARKE.
// ==================================================================================================
//
// ZWEI BAUFORMEN, EIN BILD: mit `onPunkt` ist die Zeichnung ein Knopf — ein Tipp setzt die Marke an
// die getippte Stelle. Ohne `onPunkt` zeigt sie nur, wo eine gespeicherte Notiz hängt.
//
// DER TASTATURWEG: Enter oder Leertaste auf dem Knopf setzt die Marke in die Mitte, die Pfeiltasten
// schieben sie danach in kleinen Schritten. Ohne ihn käme nur, wer zeigen kann, an diese Funktion.

/** Ein Pfeiltastenschritt: zwei Hundertstel der Bildkante. */
const SCHRITT = 0.02;

const PFEILE: Record<string, [number, number]> = {
  ArrowLeft: [-SCHRITT, 0],
  ArrowRight: [SCHRITT, 0],
  ArrowUp: [0, -SCHRITT],
  ArrowDown: [0, SCHRITT],
};

export function Zeichnung({
  src,
  beschriftung,
  punkt,
  onPunkt,
}: {
  src: string;
  /** Der zugängliche Name: was die Zeichnung ist und, bei `onPunkt`, was ein Tipp bewirkt. */
  beschriftung: string;
  punkt?: Zeichnungspunkt | undefined;
  onPunkt?: ((p: Zeichnungspunkt) => void) | undefined;
}): JSX.Element {
  const bild = useRef<HTMLImageElement | null>(null);
  const prozent = punkt ? punktProzent(punkt) : null;
  // Im Lesefall trägt das Bild selbst den Namen; als Knopf trägt ihn der Knopf, und das Bild darin
  // bleibt stumm — sonst läse ein Vorleseprogramm dieselbe Angabe zweimal.
  const inhalt = (
    <>
      <img
        ref={bild}
        src={src}
        alt={onPunkt ? "" : beschriftung}
        className="block h-auto max-h-80 max-w-full"
      />
      {punkt && prozent ? (
        <span
          aria-hidden
          data-bib-zeichnung-marke={`${prozent.x},${prozent.y}`}
          style={{ left: `${punkt.x * 100}%`, top: `${punkt.y * 100}%` }}
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow"
        />
      ) : null}
    </>
  );
  if (!onPunkt) {
    return (
      <span
        data-bib-zeichnung=""
        className="relative mt-1 inline-block max-w-full rounded-card border border-hairline"
      >
        {inhalt}
      </span>
    );
  }
  const tipp = (e: MouseEvent<HTMLButtonElement>): void => {
    // `detail === 0`: der Knopf wurde über die Tastatur ausgelöst, es gibt keinen Zeigeort.
    if (e.detail === 0) {
      if (!punkt) {
        onPunkt({ x: 0.5, y: 0.5 });
      }
      return;
    }
    const flaeche = bild.current?.getBoundingClientRect();
    const neu = flaeche ? punktAusTipp(flaeche, e.clientX, e.clientY) : null;
    if (neu) {
      onPunkt(neu);
    }
  };
  const taste = (e: KeyboardEvent<HTMLButtonElement>): void => {
    const pfeil = PFEILE[e.key];
    if (!pfeil || !punkt) {
      return;
    }
    e.preventDefault();
    onPunkt(punktVerschieben(punkt, pfeil[0], pfeil[1]));
  };
  return (
    <button
      type="button"
      aria-label={beschriftung}
      data-bib-zeichnung="waehlbar"
      onClick={tipp}
      onKeyDown={taste}
      className="relative mt-1 inline-block max-w-full cursor-crosshair rounded-card border border-hairline p-0"
    >
      {inhalt}
    </button>
  );
}

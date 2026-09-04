// ================================================================================================
// JOB 3061 · H2 — DIE VIER MENÜORTE DER PRÜFFLÄCHE, EINMAL GEBAUT.
// ================================================================================================
//
// Pedi 04.09. 07:58: „Stelle 100 % sicher, dass wir keine Funktion verlieren. Orientiere dich an
// Pages, arbeite mit Untermenüs. Behalte die klare Linie bei. Wir haben sehr, sehr viele
// Informationsfunktionen."
//
// Genau das ist die Aufgabe dieser Datei. Die vier Menüorte des Mockups (`Menues.dc.html`) —
// „···" an der Karte, Filter neben dem Segment, „?" neben dem Titel und das aufklappbare „Mehr"
// unter dem Text — sind hier EIN Bauteil mit vier Aufrufstellen und nicht vier Nachbauten. Wer
// eines davon ändert, ändert alle; das ist der Unterschied zwischen einer Linie und vier
// ähnlichen Kästen.
//
// GESCHLOSSEN ZEIGT EIN MENÜ NUR SEIN SYMBOL. Das ist keine Kosmetik, sondern die messbare
// Zusicherung dieses Auftrags: der Textmesser (`tests/design/zielbild-h2-pruefen.test.ts`) liest
// den sichtbaren Text der Fläche bei geschlossenen Menüs. Ein Menü, das seinen Inhalt schon im
// zugeklappten Zustand ins DOM legt und nur per CSS verbirgt, wäre eine Halbheit — deshalb wird
// der Inhalt erst beim Öffnen gerendert (`offen ? … : null`), nicht bloß ausgeblendet.
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { cx } from "../ui";

export type MenueAusrichtung = "links" | "rechts";

export function PruefenMenue({
  kennung,
  beschriftung,
  symbol,
  zaehler,
  ausrichtung = "rechts",
  breite = "w-64",
  children,
}: {
  /** Stabiler Anker für die Messung: `pruefen-menue-<kennung>` am Auslöser, `…-panel-…` am Inhalt. */
  kennung: string;
  /** Zugänglicher Name des Auslösers (Screenreader + Tooltip). Geschlossen steht kein Text da. */
  beschriftung: string;
  symbol: ReactNode;
  /** Aktive Filter als Zahl am Symbol — der einzige Text, den ein geschlossenes Menü zeigen darf. */
  zaehler?: number;
  ausrichtung?: MenueAusrichtung;
  breite?: string;
  children: ReactNode;
}): JSX.Element {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Escape schließt — dieselbe Regel wie im übrigen Produkt (HelpTip, Filterblatt).
  useEffect(() => {
    if (!offen) {
      return;
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        setOffen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [offen]);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        data-testid={`pruefen-menue-${kennung}`}
        aria-label={beschriftung}
        aria-expanded={offen}
        title={beschriftung}
        onClick={() => setOffen((v) => !v)}
        className={cx(
          "inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[12.5px] font-semibold transition-colors",
          offen
            ? "bg-hairline-soft text-text"
            : "text-muted hover:bg-hairline-soft hover:text-text",
        )}
      >
        {symbol}
        {zaehler !== undefined && zaehler > 0 ? (
          <span
            data-testid={`pruefen-menue-${kennung}-zaehler`}
            className="rounded-[999px] bg-ink px-1.5 py-0.5 font-mono text-[10px] font-bold text-white"
          >
            {zaehler}
          </span>
        ) : null}
      </button>
      {offen ? (
        <>
          {/* Nicht fokussierbare Schließfläche — dieselbe Bauform wie HelpTip.tsx:49-55. */}
          <button
            type="button"
            aria-label={t("cmd.close")}
            tabIndex={-1}
            onClick={() => setOffen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            ref={panelRef}
            data-testid={`pruefen-menue-panel-${kennung}`}
            className={cx(
              "absolute top-8 z-40 max-h-[70vh] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-[10px] border border-hairline bg-surface p-1.5 text-left shadow-popover",
              breite,
              ausrichtung === "rechts" ? "right-0" : "left-0",
            )}
          >
            {children}
          </div>
        </>
      ) : null}
    </span>
  );
}

/** Eine Handlungszeile im „···"-Menü. Auslösen schließt das Menü über den Hintergrundknopf nicht —
 *  deshalb meldet der Aufrufer selbst, wenn nach der Handlung etwas anderes zu sehen sein soll. */
export function PruefenMenueEintrag({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[13px] text-text hover:bg-hairline-soft disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/**
 * Eine Zeile im „···"-Menü, die WOANDERS HINFÜHRT. Bewusst ein echter `<Link>` und kein Knopf mit
 * `navigate()`: nur ein `<a href>` lässt sich mit der Tastatur in einem neuen Reiter öffnen, ein
 * Vorlesewerkzeug sagt „Link" statt „Schaltfläche", und das ZIEL ist am ausgegebenen Element
 * ablesbar — genau das misst `tests/app/job2241-vergleichslink-sprache-mounted.test.tsx`.
 */
export function PruefenMenueLink({
  to,
  children,
}: { to: string; children: ReactNode }): JSX.Element {
  return (
    <Link
      to={to}
      className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[13px] text-text hover:bg-hairline-soft"
    >
      {children}
      {/* Dekoration: der Pfeil steht hinter `aria-hidden`, sonst sagte ein Vorleser
          „Rechtspfeil" im zugänglichen Namen mit an (JOB 2241 V6). */}
      <span aria-hidden="true" className="ml-auto text-muted-2">
        →
      </span>
    </Link>
  );
}

/** Die Trennlinie zwischen zwei Gruppen eines Menüs (Menues.dc.html:113). */
export function PruefenMenueTrenner(): JSX.Element {
  return <div className="my-1 h-px bg-hairline" />;
}

/** Ein Erklärabschnitt im „?"-Menü: Überschrift + Fließtext. Kein Dauertext auf der Fläche. */
export function PruefenHilfeBlock({
  titel,
  children,
}: { titel: string; children: ReactNode }): JSX.Element {
  return (
    <div className="px-2.5 py-2">
      <div className="text-[12.5px] font-semibold text-ink">{titel}</div>
      <div className="mt-1 space-y-1 text-[12px] leading-relaxed text-muted">{children}</div>
    </div>
  );
}

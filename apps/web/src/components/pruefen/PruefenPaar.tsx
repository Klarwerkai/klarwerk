import { MoreHorizontal } from "lucide-react";
// ================================================================================================
// JOB 3061 · H2 — ZWEI KARTEN NEBENEINANDER, DER UNTERSCHIED FARBIG, DARUNTER DIE ENTSCHEIDUNG.
// ================================================================================================
//
// Die gemeinsame Bauform von `Konflikte.dc.html` und `Duplikate.dc.html`. Beide Mockups sind
// dieselbe Fläche mit zwei Unterschieden: der Markierungsfarbe (#FBE6E6 gegen #FDF1D7) und der
// Beschriftung der vier Knöpfe. Deshalb steht sie EINMAL hier und nicht zweimal in den Seiten —
// wer den Abstand der Karten ändert, ändert ihn für beide Reiter.
//
// SOLLWERTE (Konflikte.dc.html Z.42–59, Duplikate.dc.html Z.42–59) — je Wert ein Messfall:
//   Zeile      Titel 15px/600 · Pillen 11px/700 · Radius 999px · Polster 3px 10px
//   Karten     Abstand 20px · Radius 14px · Rahmen 1px #E9E5DE · Schatten (--kw-shadow-tile)
//   Kartenkopf Polster 18px 22px 8px · Titel 16px/650 · Meta 12.5px #525B6B
//   Kartentext Polster 8px 22px 22px · 15px · Zeilenhöhe 1.65 · Marke Radius 4px, Polster 1px 3px
//   Knöpfe     Polster 10px 20px · Radius 10px · 14px · primär #C2500A/#FFFFFF/600
import type { ReactNode } from "react";
import { cx } from "../ui";
import type { TextStueck } from "./markierung";

export type MarkierungsTon = "konflikt" | "duplikat";

const MARKE: Record<MarkierungsTon, string> = {
  // #FBE6E6 — --kw-trust-crit-bg im modernen Thema.
  konflikt: "bg-trust-crit-bg",
  // #FDF1D7 — --kw-trust-warn-bg im modernen Thema.
  duplikat: "bg-trust-warn-bg",
};

export type PillenTon = "neutral" | "warn" | "crit";

const PILLE: Record<PillenTon, string> = {
  neutral: "bg-hairline-soft text-muted",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  crit: "bg-trust-crit-bg text-trust-crit-text",
};

/** Eine Pille der Kopfzeile („1 von 2", „92 % gleich", Konflikttyp, Beziehung). */
export function PruefenPille({
  ton = "neutral",
  kennung,
  children,
}: { ton?: PillenTon; kennung?: string; children: ReactNode }): JSX.Element {
  return (
    <span
      data-text="chip"
      data-testid={kennung ? `pruefen-pille-${kennung}` : undefined}
      className={cx(
        "rounded-[999px] px-[10px] py-[3px] text-[11px] font-bold tracking-[0.3px]",
        PILLE[ton],
      )}
    >
      {children}
    </span>
  );
}

/** Die Zeile über den zwei Karten: worum es geht, die wievielte von wie vielen, und die Art. */
export function PruefenPaarZeile({
  titel,
  children,
}: { titel: string; children?: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-[10px]">
      <div data-text="titel" className="text-[15px] font-semibold text-text">
        {titel}
      </div>
      {children}
    </div>
  );
}

/** Eine der zwei gegenübergestellten Karten. */
export function PruefenPaarKarte({
  seite,
  titel,
  meta,
  teile,
  ton,
  markeTitel,
  aktionen,
  mehr,
}: {
  /** „a" oder „b" — der Anker, an dem die Messung links von rechts unterscheidet. */
  seite: "a" | "b";
  titel: string;
  meta: string;
  teile: readonly TextStueck[];
  ton: MarkierungsTon;
  /** Auskunft an der Markierung selbst (SCRUM-492: „Streitwert wörtlich aus dem Beleg"). */
  markeTitel?: string | undefined;
  /** Das „···"-Menü dieser Karte. */
  aktionen?: ReactNode;
  /** Das „Mehr" dieser Karte (Herkunft, Sicherheit, Zitate, Status …). */
  mehr?: ReactNode;
}): JSX.Element {
  return (
    <div
      data-testid={`pruefen-paar-karte-${seite}`}
      className="flex-1 overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-tile"
    >
      <div className="flex items-start gap-2 px-[22px] pb-[8px] pt-[18px]">
        <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
          <div data-text="titel" className="text-[16px] font-[650] text-text">
            {titel}
          </div>
          <div data-text="meta" className="text-[12.5px] text-muted">
            {meta}
          </div>
        </div>
        {aktionen}
      </div>
      <p
        data-testid={`pruefen-paar-text-${seite}`}
        data-text="text"
        className="px-[22px] pb-[22px] pt-[8px] text-[15px] leading-[1.65] text-text"
      >
        {teile.map((s, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: Textstücke haben keine Kennung; ihre Reihenfolge IST ihre Identität.
            key={`${seite}-${i}`}
            data-markiert={s.markiert ? "1" : undefined}
            title={s.markiert ? markeTitel : undefined}
            className={s.markiert ? cx("rounded-[4px] px-[3px] py-[1px]", MARKE[ton]) : undefined}
          >
            {s.text}
          </span>
        ))}
      </p>
      {mehr ? <div className="px-[22px] pb-[18px]">{mehr}</div> : null}
    </div>
  );
}

/** Die zwei Karten nebeneinander (20px Abstand, gleich breit). */
export function PruefenPaar({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div data-testid="pruefen-paar" className="flex flex-col gap-[20px] sm:flex-row">
      {children}
    </div>
  );
}

export type KnopfTon = "primaer" | "neutral" | "gut" | "kritisch";

/** Ein Entscheidungsknopf der Mockups. `primaer` ist der Funke-dunkel-Knopf (#C2500A). */
export function PruefenKnopf({
  ton = "neutral",
  kennung,
  disabled,
  onClick,
  children,
}: {
  ton?: KnopfTon;
  kennung: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}): JSX.Element {
  const stil: Record<KnopfTon, string> = {
    // #C2500A — die Werkbank-Palette führt ihn als --kw-funke-deep; die Tailwind-Abbildung
    // (tailwind.config.ts) kennt ihn nicht und liegt nicht in den Zielpfaden. Siehe ABWEICHUNGEN.
    primaer: "bg-[#C2500A] font-semibold text-white hover:opacity-90",
    neutral: "border border-hairline bg-surface text-text hover:bg-hairline-soft",
    gut: "bg-trust-pos-fill font-semibold text-white hover:opacity-90",
    kritisch: "border border-hairline bg-surface text-trust-crit-text hover:bg-hairline-soft",
  };
  return (
    <button
      type="button"
      data-text="knopf"
      data-testid={`pruefen-knopf-${kennung}`}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-[7px] rounded-[10px] px-[20px] py-[10px] text-[14px] leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        stil[ton],
      )}
    >
      {children}
    </button>
  );
}

/** Das Entscheidungsband unter den zwei Karten. */
export function PruefenAktionsband({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div data-testid="pruefen-aktionsband" className="flex flex-wrap items-center gap-[10px]">
      {children}
    </div>
  );
}

/** Der Textlink am rechten Rand des Bandes („Zweitmeinung anfragen", Konflikte.dc.html:59). */
export function PruefenBandLink({
  kennung,
  onClick,
  children,
}: { kennung: string; onClick: () => void; children: ReactNode }): JSX.Element {
  return (
    <button
      type="button"
      data-text="knopf"
      data-testid={`pruefen-knopf-${kennung}`}
      onClick={onClick}
      className="ml-auto text-[13px] text-muted underline-offset-4 hover:text-text hover:underline"
    >
      {children}
    </button>
  );
}

/** Das Symbol des „···"-Menüs — überall dasselbe (Menues.dc.html:41). Der zugängliche Name sitzt
 *  am Auslöser (`PruefenMenue`), nicht am Bild; sonst spräche ein Vorleser ihn zweimal. */
export function MenueSymbol(): JSX.Element {
  return <MoreHorizontal size={16} aria-hidden="true" />;
}

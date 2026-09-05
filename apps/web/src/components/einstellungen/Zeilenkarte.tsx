// JOB 3065 H6 — DIE ZEILENKARTE (Maßstab: `design/klarwerk/Admin.dc.html`, Z.45-58).
//
// Eine Karte aus Zeilen, wie die Systemeinstellungen eines Mac: links das Label, rechts der Wert,
// dahinter ein Chevron (führt in die Detailkarte) oder ein Schloss (nur lesbar). KEINE Zeile trägt
// einen zweiten Satz — der Erklärtext lebt im „?"-Menü der Detailkarte (Auftrag Lieferung 9).
//
// Die Zielbildwerte, die `tests/design/zielbild-h6-einstellungen.test.ts` in Chromium nachmisst:
//   Karte  border-radius 14px · Rand 1px #E9E5DE · Schatten --kw-shadow-tile (Z.45)
//   Zeile  padding 13px 16px · Trennlinie 1px #E9E5DE (Z.46)
//   Label  14px · Wert 14px #525B6B · Abstand Wert↔Chevron 6px
//   Kicker 11px · Sperrung 0.4px · #525B6B (Z.52)
import { ChevronRight, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../ui";
import type { WertBefund } from "./zeilenWert";

/**
 * Der Wert eines Befunds als sichtbarer Text — die EINE Stelle, an der aus dem Zustandsmodell
 * (`zeilenWert.ts`) Sprache wird. Nie ein positiver Wert ohne Daten, nie „keine" ohne erfolgreiche
 * leere Antwort.
 */
export function useWertText(): (befund: WertBefund, leerText?: string) => string {
  const { t } = useTranslation();
  return (befund, leerText) => {
    if (befund.art === "laedt" || befund.art === "offline") {
      return t("einst.wert.unbekannt");
    }
    if (befund.art === "fehler") {
      return t("einst.wert.nichtAbrufbar");
    }
    const kern = befund.art === "leer" ? (leerText ?? t("einst.wert.keine")) : (befund.wert ?? "");
    const zusatz: string[] = [];
    if (befund.standMs > 0) {
      zusatz.push(
        t("einst.wert.stand", {
          zeit: new Date(befund.standMs).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }),
      );
    }
    if (befund.nichtAktualisiert) {
      zusatz.push(t("einst.wert.nichtAktualisiert"));
    }
    return zusatz.length > 0 ? `${kern} · ${zusatz.join(" · ")}` : kern;
  };
}

export function Kicker({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div data-einst="kicker" className="mt-2 text-[11px] tracking-[0.4px] text-muted-2">
      {children}
    </div>
  );
}

export function Zeilenkarte({
  children,
  id,
  testId,
}: {
  children: ReactNode;
  id?: string;
  testId?: string;
}): JSX.Element {
  return (
    <div
      data-einst="karte"
      id={id}
      data-testid={testId}
      className="overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-tile"
    >
      {children}
    </div>
  );
}

/**
 * Eine Zeile. Genau eine der drei Ausprägungen:
 *   `onOeffnen`  → Chevron, die ganze Zeile ist ein Knopf in die Detailkarte
 *   `steuerung`  → ein eigenes Bedienelement rechts (z. B. der Schalter „Erweiterte Module")
 *   sonst        → Schloss: nur lesbar
 */
export function Zeile({
  label,
  wert,
  onOeffnen,
  steuerung,
  ton = "ruhig",
  ohneSymbol = false,
  vorn,
  testId,
}: {
  label: string;
  wert?: string;
  onOeffnen?: () => void;
  steuerung?: ReactNode;
  ton?: "ruhig" | "kritisch";
  /**
   * Kein Chevron und kein Schloss. Für die eine Zeile, die weder in eine Detailkarte führt noch
   * nur lesbar ist, sondern SELBST die Handlung ist (Abmelden) — ein Chevron würde dort eine
   * Karte versprechen, die es nicht gibt.
   */
  ohneSymbol?: boolean;
  /** Etwas vor dem Label, im Label-Träger (das Kürzelzeichen des eigenen Kontos auf /profil). */
  vorn?: ReactNode;
  testId?: string;
}): JSX.Element {
  const { t } = useTranslation();
  const inhalt = (
    <>
      <span
        data-einst="label"
        className={cx(
          "min-w-0 text-[14px] text-text",
          vorn ? "flex items-center gap-2.5" : "truncate",
        )}
      >
        {vorn}
        {vorn ? <span className="min-w-0 truncate">{label}</span> : label}
      </span>
      <span
        className={cx(
          "flex shrink-0 items-center gap-1.5 text-[14px]",
          ton === "kritisch" ? "text-trust-crit-text" : "text-muted-2",
        )}
      >
        {wert === undefined ? null : (
          <span data-einst="wert" className="truncate">
            {wert}
          </span>
        )}
        {steuerung}
        {ohneSymbol || steuerung ? null : onOeffnen ? (
          <ChevronRight data-einst="chevron" size={13} strokeWidth={2} aria-hidden="true" />
        ) : (
          <Lock data-einst="schloss" size={13} strokeWidth={2} aria-hidden="true" />
        )}
      </span>
    </>
  );

  if (onOeffnen) {
    return (
      <button
        type="button"
        data-einst="zeile"
        data-testid={testId}
        onClick={onOeffnen}
        className="flex w-full items-center justify-between gap-3 border-b border-hairline px-4 py-[13px] text-left last:border-b-0 hover:bg-hairline-soft"
      >
        {inhalt}
      </button>
    );
  }
  return (
    <div
      data-einst="zeile"
      data-testid={testId}
      title={steuerung ? undefined : t("einst.zeile.nurLesbar")}
      className="flex w-full items-center justify-between gap-3 border-b border-hairline px-4 py-[13px] last:border-b-0"
    >
      {inhalt}
    </div>
  );
}

/** Der Flächenknopf unter einer Karte (Zielbild Z.51: 10px 20px, Radius 10px, 14px). */
export function Flaechenknopf({
  children,
  onClick,
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  testId?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      data-einst="flaechenknopf"
      data-testid={testId}
      onClick={onClick}
      className="self-start rounded-[10px] border border-hairline bg-surface px-5 py-2.5 text-[14px] text-text hover:bg-hairline-soft"
    >
      {children}
    </button>
  );
}

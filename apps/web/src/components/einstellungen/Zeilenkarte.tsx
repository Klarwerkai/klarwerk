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

// ================================================================================================
// JOB 3117 · UX-13 — DER UMBRUCHVERTRAG DER ZEILE: DIE EINE STELLE, DIE ÜBER DEN ENGPASS ENTSCHEIDET.
// ================================================================================================
//
// Bis hierher entschied nicht EINE Stelle, sondern vier verstreute Klassen: `truncate` am
// Label-Träger, `truncate` am inneren Label-Span, `shrink-0` am Wert-Träger und `truncate` am Wert.
// Ihre Summe war eine Regel, die so niemand aufgeschrieben hätte: der Wert darf NICHT schrumpfen,
// die Beschriftung gibt ALLES her. Auf einem 320-px-Telefon blieb von „E-Mail" ein „E.." übrig —
// gemessen 15 px sichtbar bei 40 px Text —, während die Adresse ihre vollen 208 px behielt
// (Gegenprüfung N-0030, 2026-09-06, Live 1.0.0-beta.1.124). Die Beschriftung trägt die BEDEUTUNG
// der Zeile; sie zuerst zu opfern war die falsche Reihenfolge.
//
// JETZT WIRD NICHTS MEHR GEKÜRZT. Reicht die Breite nicht für Beschriftung UND Wert, rückt der
// Wert-Block unter die Beschriftung; einzelne zu lange Texte brechen um. Zwei sichtbare Zeilen sind
// ehrlicher als eine Beschriftung, die niemand lesen kann.
//
// WER DAS VERHALTEN ÄNDERN WILL, ÄNDERT HIER — dieser Block ist die eine Stelle. Es gibt keinen
// zweiten Weg: in dieser Datei kommt weder `truncate` noch `whitespace-nowrap` an einem Textträger
// vor, und `shrink-0` nur an den unteilbaren Symbolen unten.
//
// VIER FLACHE KONSTANTEN, KEIN OBJEKT: der Klassenbindungs-Sammler
// (`tests/app/mega47-modale-flaechen-sammler.test.tsx:3315-3323`) löst einen lokalen Bezeichner
// mit literalem Wert auf, einen Eigenschaftszugriff `X.y` aber nicht. Ein Objekt hier hätte sechs
// Klassenlisten dieser Datei für jeden Klassen-Wächter unsichtbar gemacht (gemessen: 211 → 217
// unauflösbare Bindungen). Die Bündelung steht im Namen und in diesem Kommentar, nicht in einer
// Datenstruktur, die den Wächtern die Sicht nimmt.

/** Die Zeile: reicht der Platz nicht, bekommt der Wert-Block eine zweite Zeile (Abstand 4 px). */
const UMBRUCH_ZEILE = "flex-wrap gap-x-3 gap-y-1";
/**
 * Beschriftungs- und Wert-Träger: dürfen schrumpfen (`min-w-0`) und umbrechen (`break-words`),
 * nie kürzen. `min-w-0` ist dabei nicht kosmetisch — ohne sie käme ein Flex-Kind nie unter seine
 * Mindestinhaltsbreite, und eine lange Adresse ohne Leerzeichen bräche gar nicht erst um.
 */
const UMBRUCH_TRAEGER = "min-w-0 break-words";
/** Der Wert-Block bleibt rechts, auch wenn er in der zweiten Zeile allein steht. */
const UMBRUCH_WERT_RECHTS = "ml-auto";
/** Chevron und Schloss sind unteilbar — sie schrumpfen nicht mit und bleiben immer sichtbar. */
const UMBRUCH_SYMBOL = "shrink-0";

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
          UMBRUCH_TRAEGER,
          "text-[14px] text-text",
          vorn ? "flex items-center gap-2.5" : null,
        )}
      >
        {vorn}
        {vorn ? <span className={UMBRUCH_TRAEGER}>{label}</span> : label}
      </span>
      <span
        className={cx(
          UMBRUCH_TRAEGER,
          UMBRUCH_WERT_RECHTS,
          "flex items-center gap-1.5 text-[14px]",
          ton === "kritisch" ? "text-trust-crit-text" : "text-muted-2",
        )}
      >
        {wert === undefined ? null : (
          <span data-einst="wert" className={UMBRUCH_TRAEGER}>
            {wert}
          </span>
        )}
        {steuerung}
        {ohneSymbol || steuerung ? null : onOeffnen ? (
          <ChevronRight
            data-einst="chevron"
            className={UMBRUCH_SYMBOL}
            size={13}
            strokeWidth={2}
            aria-hidden="true"
          />
        ) : (
          <Lock
            data-einst="schloss"
            className={UMBRUCH_SYMBOL}
            size={13}
            strokeWidth={2}
            aria-hidden="true"
          />
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
        className={cx(
          UMBRUCH_ZEILE,
          "flex w-full items-center justify-between border-b border-hairline px-4 py-[13px] text-left last:border-b-0 hover:bg-hairline-soft",
        )}
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
      className={cx(
        UMBRUCH_ZEILE,
        "flex w-full items-center justify-between border-b border-hairline px-4 py-[13px] last:border-b-0",
      )}
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

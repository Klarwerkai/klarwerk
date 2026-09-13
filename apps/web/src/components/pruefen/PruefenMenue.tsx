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
//
// ================================================================================================
// JOB 3812 · DAS BLATT LIEGT AM FENSTER, NICHT IN DER KARTE — und warum das kein Geschmack ist.
// ================================================================================================
//
// BIS HIERHER: `absolute top-8 max-h-[70vh] … overflow-y-auto`, also ein Kasten, dessen Lage der
// Auslöser bestimmt und dessen Sicht jeder beschneidende Vorfahre bestimmt. `z-40` hilft dagegen
// nicht: `overflow` beschneidet unabhängig von der Stapelreihenfolge.
//
// GEMESSEN (JOB 3812 R1, `tests/design/job2935-validierung-fussband.test.ts` L16, Cloud-Lauf
// 499bd2d50ed2dd054d59919d) — das Blatt der Karte ist 248 px hoch und stand bei 195,5–443,5:
//   1280×900  Klammer 138,5–392,75 durch DIV[pruefen-karte]  → 197,25 px sichtbar, 50,75 px fehlen
//   1280×600  Klammer 138,5–383    (+ MAIN der Hülle)        → 187,5  px sichtbar
//   1280×420  Klammer 138,5–227    (+ MAIN der Hülle)        →  31,5  px sichtbar
// Der erste Beschneider ist die KARTE selbst (`overflow-hidden rounded-[14px]`, `Validation.tsx`);
// es ist also kein Fehler des flachen Fensters, sondern einer, der bei jeder Höhe schon da war.
// Und er wäre durch JOB 3812 schlimmer geworden: mit einem eigenen Rollbereich an der rechten
// Spalte blieben bei 1280×420 gemessene 3,5 px übrig (dieselbe Messung, „+ Probe").
//
// DESHALB `position: fixed`: Ein fest positionierter Kasten hat das FENSTER als enthaltenden Block
// und wird von `overflow` seiner Vorfahren nicht beschnitten. Seine Lage rechnet `blattlage()` aus
// dem Rechteck des Auslösers — dieselbe Stelle wie vorher (`top-8` = 32 px unter dessen Oberkante),
// nur eben in Fensterkoordinaten. Der Deckel ist nicht mehr `70vh` allein, sondern der KLEINERE aus
// `70vh` und dem wirklich freien Platz; bleibt unten zu wenig, klappt das Blatt nach oben auf.
//
// EIN Weg, nicht zwei: es gibt keine zweite, „absolute" Variante daneben. Alle vier Menüorte gehen
// hier durch und liegen damit gleich.
//
// RUNDE 2 · UND DIE LAGE MUSS LEBEN, SOLANGE DAS BLATT OFFEN IST.
// Runde 1 rechnete `blattlage()` ausschliesslich im Klick des Auslösers. Der Prüfbericht (BEN,
// Korrekturpflicht 1) hat die Lücke aufgemacht: wer das Menü bei 1280×900 öffnet und das Fenster
// danach auf 1280×420 zieht, behält den Deckel von vorher — gemessene 630 px in einem 420 px hohen
// Fenster, also wieder ein Blatt, das unten hinausragt. Der gerechnete Ort ist nur so gut wie der
// Zeitpunkt, zu dem gerechnet wurde. Runde 2 hat daraus einen `resize`-Zuhörer gemacht, der
// `blattlage()` neu rechnete.
//
// RUNDE 3 · DER ZUHÖRER WAR DIE FALSCHE ANTWORT — ZWEIMAL FALSCH.
// (1) SACHLICH. Der Prüfbericht der Runde 2 hat mit einem längeren Artikel nachgemessen: Blatt bei
//     1280×900 geöffnet, Fenster auf 420 verkleinert, die Artikelspalte 713 px ans Ende gerollt,
//     dann die Fensterbreite geändert. Der Auslöser war da längst aus dem Bild (`top` −549,5 px),
//     der Zuhörer rechnete ihm hinterher, und das Blatt stand danach bei −517,5 bis −269,5 px:
//     vollständig ÜBER dem Fenster, an allen neun abgetasteten Punkten unbedienbar. Der
//     Kommentarblock unten hatte für das Rollen schon begründet, warum das Blatt dem Auslöser
//     NICHT folgen darf — der `resize`-Zweig tat es trotzdem, weil er dieselbe Rechnung ohne
//     Untergrenze noch einmal fuhr.
// (2) DER ABMACHUNG NACH. Pedis Grenzen zur Prüffläche (HINWEIS der Steuerung, Punkt 4) lauten
//     „kein neuer Handler überhaupt"; die Runde 2 hatte die Abweichung nur offengelegt, und der
//     Prüfbericht hält fest, dass das die Grenze nicht aufhebt (Korrekturpflicht 3).
//
// DESHALB RECHNET JETZT DAS CSS, NICHT JAVASCRIPT. Der Ort des Blatts ist eine eigene Eigenschaft
// (`--kw-blatt-ort`), und in ihr steht kein fertiger Pixelwert, sondern ein `clamp()` gegen das
// FENSTER: `clamp(8px, <Ort des Auslösers>, calc(100% - 72px))`. Bei `position: fixed` ist der
// enthaltende Block das Fenster, `100 %` also seine Höhe — der Browser rechnet diesen Ausdruck bei
// jeder Fensteränderung von selbst neu, ohne dass jemand zuhört. Dasselbe gilt für den Deckel
// (`--kw-blatt-deckel`): der kleinere aus dem Anteil und `calc(100% - Ort - 8px)`, also dem wirklich
// freien Platz. Was bleibt, ist eine einzige Messung im Klick.
//
// WAS DAS BLATT DAMIT ZUSAGT — und was ausdrücklich nicht:
//   · Es liegt IMMER ganz im Fenster, in jeder Fensterhöhe, auch wenn sein Auslöser weggerollt ist.
//   · Seine GRÖSSE folgt dem Fenster (L18: im flachen Fenster ist es kürzer als im hohen).
//   · Sein ORT folgt ihm NICHT: er steht da, wo geöffnet wurde. Ändert sich die Fensterbreite,
//     behält das Blatt seinen Abstand zur Fensterkante und steht damit bis zu dem Betrag neben
//     seinem Auslöser, um den dessen Kante gewandert ist (gemessen: L18c). Das ist die schwächere
//     und wahre Zusage — dieselbe, die für das Rollen schon gilt und unten begründet ist.
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { cx } from "../ui";

export type MenueAusrichtung = "links" | "rechts";

/** Der Abstand des Blatts zur OBERkante des Auslösers — die Zahl hinter dem bisherigen `top-8`. */
const BLATT_ABSTAND_PX = 32;
/** Luft zum Fensterrand, damit das Blatt nicht an der Kante klebt. */
const BLATT_RAND_PX = 8;
/**
 * Der bisherige Deckel `max-h-[70vh]`, jetzt als Zahl aus der Fensterhöhe ZUR ZEIT DES KLICKS. Er
 * ist die Bequemlichkeit („ein Menü nimmt nicht das ganze Fenster") und bleibt deshalb stehen, wenn
 * sich das Fenster danach ändert. Die ZUSAGE — das Blatt liegt ganz im Fenster — hängt nicht an ihm,
 * sondern an dem Ausdruck daneben, der den freien Platz laufend nachrechnet.
 */
const BLATT_ANTEIL = 0.7;
/** Der Abstand nach oben, wenn das Blatt über dem Auslöser aufklappt. */
const BLATT_LUFT_PX = 4;
/**
 * So viel Blatt bleibt in jedem Fall stehen. Die Untergrenze der Klemme sagt: der Ort darf so weit
 * an die gegenüberliegende Kante rücken, dass dahinter noch dieser Rest plus die Randluft passt.
 * Ohne sie könnte ein sehr flaches Fenster das Blatt auf 0 px rechnen — sichtbar wäre dann nichts,
 * und „liegt im Fenster" wäre wahr und wertlos zugleich.
 */
const BLATT_MINDEST_PX = 64;

/**
 * Was das Blatt vom Klick mitbekommt: zwei eigene Eigenschaften und die waagerechte Kante.
 *
 * `--kw-blatt-ort` und `--kw-blatt-deckel` sind AUSDRÜCKE, keine Zahlen (siehe Kopf der Datei) —
 * deshalb stehen sie als eigene Eigenschaften im Stil und werden von zwei festen Klassen gelesen
 * (`[top:var(--kw-blatt-ort)]` bzw. `[bottom:…]`, `[max-height:var(--kw-blatt-deckel)]`). Zwei
 * Gründe: eigene Eigenschaften nehmen jeden Wert an, und alle Zahlen darin stammen aus den
 * Konstanten oben statt aus einem zweiten, von Hand gepflegten Klassennamen.
 *
 * Der eigene Stiltyp steht hier, weil Reacts `CSSProperties` eigene Eigenschaften nicht kennt —
 * gesetzt werden sie zur Laufzeit über `style.setProperty`. So bleiben sie geprüfte Namen statt
 * eines `as`-Griffs an der Sperre vorbei.
 */
interface Blattstil extends CSSProperties {
  "--kw-blatt-ort": string;
  "--kw-blatt-deckel": string;
}

interface Blattlage {
  stil: Blattstil;
  /** Klappt das Blatt ÜBER dem Auslöser auf? Nur davon hängt ab, an welcher Kante der Ort misst. */
  nachOben: boolean;
}

/** Gerundete Pixel: Rechtecke sind oft krumm (163,5 px), und 16 Nachkommastellen im Stil helfen keinem. */
function px(wert: number): string {
  return `${Math.round(wert * 100) / 100}px`;
}

/**
 * Wo das Blatt steht, gerechnet aus dem Rechteck seines Auslösers — EINMAL, im Klick.
 *
 * VIER ENTSCHEIDUNGEN, jede mit einem Grund:
 *   · SEITE — „rechts" heisst weiterhin: die rechte Kante des Blatts liegt auf der rechten Kante des
 *     Auslösers. In Fensterkoordinaten ist das `right`, nicht `left`; so muss die Breite des Blatts
 *     nicht bekannt sein, und ein zweiter Messdurchgang entfällt. Waagerecht steht hier eine ZAHL:
 *     die Fensterbreite ändert sich nur, wenn jemand das Fenster zieht, und dann behält das Blatt
 *     seinen Abstand zur Kante (L18c misst, dass es dabei ganz im Fenster bleibt).
 *   · RICHTUNG — nach unten, solange dort mindestens so viel Platz ist wie nach oben. Sonst klappt
 *     das Blatt über dem Auslöser auf. Verglichen wird PLATZ, nicht die Höhe des Blatts: die steht
 *     zum Zeitpunkt dieser Rechnung noch nicht fest, und der Deckel macht sie ohnehin passend.
 *   · ORT — geklemmt gegen das Fenster, nicht gegen den Auslöser. Ein Auslöser kann aus dem Bild
 *     rollen (gemessen: `top` −549,5 px); ohne Klemme rechnete diese Stelle das Blatt dorthin mit.
 *     Die Klemme steht als `clamp()` im Wert und nicht als `Math.min` um ihn herum — nur so bleibt
 *     sie gültig, wenn sich das Fenster NACH dieser Rechnung noch ändert.
 *   · DECKEL — der kleinere aus dem Anteil (`BLATT_ANTEIL` der Fensterhöhe zur Zeit des Klicks) und
 *     `calc(100% - Ort - Rand)`, also dem wirklich freien Platz zur laufenden Fensterhöhe. Damit ist
 *     das Blatt in jeder Fensterhöhe VOLLSTÄNDIG zu sehen; was nicht hineinpasst, rollt in ihm
 *     selbst (`overflow-y-auto`), statt unsichtbar zu werden.
 *
 * OHNE LAYOUT (jsdom: jeder Kasten ist null gross, `clientHeight` ist 0) wird nichts geklemmt,
 * nichts gedeckelt und nichts geklappt: eine Klemme gegen ein 0 px hohes Fenster wäre eine
 * erfundene Zahl, und jsdom misst ohnehin Text und Regeln, nicht Geometrie.
 */
function blattlage(rechteck: DOMRect, ausrichtung: MenueAusrichtung): Blattlage {
  const fensterHoehe = document.documentElement.clientHeight;
  const fensterBreite = document.documentElement.clientWidth;
  const seite =
    ausrichtung === "rechts"
      ? { right: Math.max(BLATT_RAND_PX, fensterBreite - rechteck.right) }
      : { left: Math.max(BLATT_RAND_PX, rechteck.left) };
  const oben = rechteck.top + BLATT_ABSTAND_PX;
  if (fensterHoehe <= 0 || fensterBreite <= 0) {
    return {
      stil: {
        ...seite,
        "--kw-blatt-ort": px(oben),
        "--kw-blatt-deckel": "none",
      },
      nachOben: false,
    };
  }
  const platzUnten = fensterHoehe - oben - BLATT_RAND_PX;
  const platzOben = rechteck.top - BLATT_LUFT_PX - BLATT_RAND_PX;
  const nachOben = platzUnten < platzOben;
  const ort = nachOben ? fensterHoehe - rechteck.top + BLATT_LUFT_PX : oben;
  return {
    stil: {
      ...seite,
      "--kw-blatt-ort": `clamp(${BLATT_RAND_PX}px, ${px(ort)}, calc(100% - ${BLATT_MINDEST_PX + BLATT_RAND_PX}px))`,
      "--kw-blatt-deckel": `min(${px(BLATT_ANTEIL * fensterHoehe)}, calc(100% - var(--kw-blatt-ort) - ${BLATT_RAND_PX}px))`,
    },
    nachOben,
  };
}

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
  const ausloeserRef = useRef<HTMLButtonElement | null>(null);
  // Die Lage wird EINMAL gerechnet, im Klick und nicht in einem Effekt danach: der Auslöser steht
  // schon im Baum, sein Rechteck ändert sich durch das Aufklappen nicht (das Blatt liegt ausserhalb
  // des Flusses), und so gibt es keinen Zeichenlauf, in dem das Blatt ohne Lage dasteht. Was sich
  // danach am Fenster ändert, rechnet der Browser aus den Ausdrücken in `--kw-blatt-ort` und
  // `--kw-blatt-deckel` selbst nach — hier wird dafür nichts beobachtet.
  const [lage, setLage] = useState<Blattlage | null>(null);

  // Escape schließt — dieselbe Regel wie im übrigen Produkt (HelpTip, Filterblatt). Und sonst hängt
  // hier nichts: kein `resize`, kein `scroll`, kein Rad- und kein Tastenfänger (Pedis Grenzen zur
  // Prüffläche, HINWEIS 4: „kein neuer Handler überhaupt"). Dass beim Öffnen eines Menüs GENAU
  // dieser eine Zuhörer dazukommt, ist gemessen und nicht behauptet: `rollbereich-lagen.test.tsx`,
  // F13.
  //
  // WARUM HIER AUCH KEIN `scroll` STEHT — gemessen, nicht entschieden (L18b, Cloud-Lauf
  // 836aef1fab36ce0061edaaf4): Rollt die Artikelspalte bei 1280×420 ihre 193 px ans Ende, wandert
  // der Auslöser mit ihr aus dem Bild — von 163,5 auf −29,5 px, also hinter den oberen Rand der
  // Spalte (138,5) und sogar über den Fensterrand hinaus. Ein Blatt, das ihm folgte, stünde bei
  // 2,5 px: über dem Kopfband der Anwendung, ohne sichtbaren Auslöser darunter. So bleibt es dort
  // stehen, wo es geöffnet wurde (195,5–412 in einem 420 px hohen Fenster): ganz im Fenster, an
  // allen neun abgetasteten Punkten bedienbar, und seine Handlungen gelten weiter demselben
  // Artikel. Das ist die schwächere, aber wahre Zusage — und L18b misst genau sie.
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
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [offen]);

  return (
    // Kein `relative` mehr: es war ausschliesslich der enthaltende Block des `absolute` gesetzten
    // Blatts. Seit das Blatt am Fenster hängt, hätte es nichts mehr zu tragen.
    <span className="inline-flex">
      <button
        type="button"
        ref={ausloeserRef}
        data-testid={`pruefen-menue-${kennung}`}
        aria-label={beschriftung}
        aria-expanded={offen}
        title={beschriftung}
        onClick={() => {
          const el = ausloeserRef.current;
          setLage(el ? blattlage(el.getBoundingClientRect(), ausrichtung) : null);
          setOffen((v) => !v);
        }}
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
            // Ort und Deckel stehen in EIGENEN Eigenschaften, nicht in fertigen Stilwerten: sie
            // sind Ausdrücke gegen das Fenster, und die zwei festen Klassen daneben lesen sie. Der
            // alte Weg (`absolute top-8 max-h-[70vh] right-0/left-0`) ist dabei ganz verschwunden
            // und steht nicht als zweite Möglichkeit daneben.
            style={lage?.stil}
            className={cx(
              "fixed z-40 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-[10px] border border-hairline bg-surface p-1.5 text-left shadow-popover [max-height:var(--kw-blatt-deckel)]",
              lage?.nachOben ? "[bottom:var(--kw-blatt-ort)]" : "[top:var(--kw-blatt-ort)]",
              breite,
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

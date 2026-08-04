// react BEWUSST relativ aus apps/web/node_modules (kein react im Root) — etabliertes Muster der
// gemounteten Tests seit WP-D8b, siehe tests/types/mounted-react.d.ts.
import { type ReactNode, createElement } from "../../apps/web/node_modules/react";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import { ImageDescribeValueProvider } from "../../apps/web/src/app/ImageDescribeContext";

// AUFTRAG-mega50 Block A — DIE NAHT FÜR ISOLIERT GEMOUNTETE EDITOR-TESTS.
//
// Seit mega50 HOLT sich der RichTextEditor den Weg zur Bildbeschreibung aus der App
// (`app/ImageDescribeContext.tsx`), statt ihn als Prop gereicht zu bekommen — genau deshalb kann
// ihn kein Aufrufer mehr vergessen. Tests, die den Editor ohne App montieren, hängen ihren eigenen
// Weg hier ein.
//
// Der Zweck dieser Datei ist, dass es EINE solche Naht gibt und nicht sechs. Die Ursache dieses
// ganzen Auftrags war schließlich, dass derselbe Verdrahtungsblock zweimal im Produktcode stand;
// dieselbe Doppelung im Testbaum zu erzeugen wäre der gleiche Fehler eine Etage tiefer.
export function mitBildbeschreibung(
  kind: ReactNode,
  describe?: (dataUrl: string, context?: string) => Promise<DescribeImageResult>,
  available = true,
): JSX.Element {
  return createElement(ImageDescribeValueProvider, {
    value: {
      available,
      // Voreinstellung für Tests, die die Bildbeschreibung gar nicht auslösen: sie wirft laut,
      // statt still etwas Plausibles zu liefern. Ein Test, der sie doch anfasst, soll das merken.
      describe:
        describe ??
        ((): Promise<DescribeImageResult> => {
          throw new Error("Dieser Test hat keinen describe-Weg verdrahtet.");
        }),
    },
    children: kind,
  });
}

// AUFTRAG-mega84 Block B — DIE NAHT ZUM FORMULARFELD.
//
// Das Feld der Bildbeschreibung war bis mega82 ein <textarea>; seit mega84 trägt es Formatierung
// (fett, kursiv, Zeilenumbruch, Pedis entschiedener Umfang) und ist deshalb ein contentEditable.
// Sechs Testdateien lasen es über `.value` — genau die Doppelung, gegen die es diese Datei gibt.
// Wer das Feld anfasst, tut es ab jetzt hierüber.

export function beschreibungsfeld(): HTMLElement {
  const el = document.querySelector("#caption-form-text");
  if (!(el instanceof HTMLElement)) {
    throw new Error("Beschreibungsfeld nicht gerendert");
  }
  return el;
}

export function beschreibungsfeldOffen(): boolean {
  return document.querySelector("#caption-form-text") !== null;
}

// Was der Nutzer LIEST — Klartext, ohne Auszeichnung. Für alles, was den Inhalt prüft.
export function beschreibungsText(): string {
  return (beschreibungsfeld().textContent ?? "").trim();
}

// Was gespeichert würde — mit Auszeichnung. Nur für die Formatierungs-Fälle.
export function beschreibungsHtml(): string {
  return beschreibungsfeld().innerHTML;
}

// Eingabe ins Feld. Muss vom Aufrufer in act() gehüllt werden (React-Zustandswechsel).
// jsdom kennt kein echtes Tippen in contentEditable — gesetzt wird also der Inhalt und danach das
// `input`-Ereignis ausgelöst, genau das, was der Browser nach einem Anschlag tut.
export function schreibeBeschreibung(html: string): void {
  const el = beschreibungsfeld();
  el.innerHTML = html;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// AUFTRAG-mega87 Block A — DIE NAHT ZUR AUSWAHL UND ZUM ECHTEN KLICK.
//
// DER BEFUND: bis mega86 markierten die Tests per `addRange` und riefen dann `knopf.click()`. Beides
// zusammen ist NICHT, was ein Browser tut, und deshalb blieb der Ship-Blocker unsichtbar:
//
//   · Ein Browser fokussiert beim `mousedown` die Schaltfläche — BEVOR `click` läuft. Nachgemessen
//     (`_relay/messung/mega87-auswahl-sonde.ts`): danach meldet die Auswahl `collapsed === true`,
//     und ein späteres `feld.focus()` holt sie NICHT zurück. `knopf.click()` allein übersprang
//     genau diesen Schritt. jsdom fokussiert von sich aus nicht — der Test muss es tun.
//   · jsdom feuert bei `addRange` KEIN `selectionchange` (ebenfalls nachgemessen, 0 Ereignisse).
//     Eine Markierung, die niemand ankündigt, kann sich das Feld auch nicht merken. Ein echter
//     Nutzer erzeugt beim Markieren `mouseup` (Ziehen) beziehungsweise `keyup` (Umschalt+Pfeil);
//     genau diese Ereignisse gehören zur Handlung dazu und werden hier mitgeliefert.
//
// Beide Nähte hüllt der Aufrufer in `act()`.

function setzeBereich(von: number, bis: number): void {
  const knoten = beschreibungsfeld().firstChild;
  if (!(knoten instanceof Text)) {
    throw new Error(
      "Das Feld trägt keinen einfachen Textknoten — der Ausgangszustand stimmt nicht",
    );
  }
  const bereich = document.createRange();
  bereich.setStart(knoten, von);
  bereich.setEnd(knoten, bis);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(bereich);
}

/** Markieren mit der Maus: ziehen und loslassen. */
export function markiereMitMaus(von: number, bis: number): void {
  setzeBereich(von, bis);
  beschreibungsfeld().dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
}

/** Markieren mit der Tastatur: Umschalt+Pfeil, also `keyup` im Feld. Kein `mousedown` weit und breit. */
export function markiereMitTastatur(von: number, bis: number): void {
  setzeBereich(von, bis);
  beschreibungsfeld().dispatchEvent(
    new KeyboardEvent("keyup", { bubbles: true, key: "ArrowRight", shiftKey: true }),
  );
}

export function knopf(testid: string): HTMLElement {
  const el = document.querySelector(`[data-testid="${testid}"]`);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Der Knopf ${testid} ist nicht da`);
  }
  return el;
}

/**
 * Ein Klick, wie der Browser ihn ausführt: erst `mousedown`, und WENN der nicht unterbunden wird,
 * wandert der Fokus auf die Schaltfläche — erst danach `click`. Gibt zurück, ob der Fokuswechsel
 * unterbunden wurde, damit ein Test genau das behaupten kann.
 */
export function klickWieBrowser(testid: string): { fokusUnterbunden: boolean } {
  const el = knopf(testid);
  const md = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
  el.dispatchEvent(md);
  if (!md.defaultPrevented) {
    // Das tut der Browser von selbst; jsdom nicht. Ohne diese Zeile prüfte der Test einen Klick,
    // den es so nirgends gibt.
    el.focus();
  }
  el.click();
  return { fokusUnterbunden: md.defaultPrevented };
}

/** Der Tastaturweg: mit Tab auf die Schaltfläche (Fokuswechsel OHNE `mousedown`), dann auslösen. */
export function klickMitTastatur(testid: string): void {
  const el = knopf(testid);
  el.focus();
  el.click();
}

// AUFTRAG-mega85 Block C — DIE NAHT ZUM FORMATIER-BEFEHL.
//
// DER BEFUND (ben, sammel83-mega84, ROT-Punkt 3): die drei Formatier-Knöpfe kamen im ganzen
// mega84-Diff nur als `data-testid` vor — kein einziger Test hat je auf sie geklickt, und niemand
// hat je geprüft, WELCHER Befehl dabei abgeht. Wer `onClick` entfernt oder „bold" durch „italic"
// ersetzt hätte, wäre grün geblieben.
//
// WARUM ES DIESE NAHT BRAUCHT UND NICHT EINFACH EIN KLICK GENÜGT: jsdom kennt `document.execCommand`
// gar nicht — nachgemessen, `typeof document.execCommand === "undefined"`, ein Aufruf wirft
// „document.execCommand is not a function". Ein Klick auf den Fett-Knopf läuft dort also in einen
// Fehler statt in eine Formatierung. Der Befehl wird deshalb ABGEFANGEN und geprüft: sein Name UND
// sein Ziel (welches Element im Moment des Aufrufs den Fokus hat). Das ist die Bedienhandlung, die
// der Auftrag verlangt, nicht ihre Nacherzählung.
export interface Befehlsaufruf {
  befehl: string;
  // Was im Moment des Aufrufs den Fokus hatte — `execCommand` wirkt auf die Auswahl, das Ziel ist
  // also Teil der Aussage. Ein Befehl, der abgeht, während der Editor-Body fokussiert ist, würde
  // den BEITRAG formatieren statt die Bildbeschreibung.
  ziel: Element | null;
}

export interface Befehlsspion {
  aufrufe: Befehlsaufruf[];
  abbauen: () => void;
}

/**
 * Fängt `document.execCommand` ab. `ergebnis` entscheidet, was der Browser zurückmeldet — mit
 * `() => false` lässt sich der Fall fahren, den ben benannt hat: ein Browser, der den Befehl nicht
 * kennt. Der Aufrufer baut den Spion in `afterEach` wieder ab.
 */
export function befehlsspion(ergebnis: (befehl: string) => boolean = () => true): Befehlsspion {
  const aufrufe: Befehlsaufruf[] = [];
  const vorher = Object.getOwnPropertyDescriptor(document, "execCommand");
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    writable: true,
    value: (befehl: string): boolean => {
      aufrufe.push({ befehl, ziel: document.activeElement });
      return ergebnis(befehl);
    },
  });
  return {
    aufrufe,
    abbauen: () => {
      if (vorher) {
        Object.defineProperty(document, "execCommand", vorher);
      } else {
        // Wieder in den Zustand, den jsdom hat: die Eigenschaft gibt es dort gar nicht. Ein
        // zurückgelassener Spion färbte auf die nächste Testdatei ab.
        Reflect.deleteProperty(document, "execCommand");
      }
    },
  };
}

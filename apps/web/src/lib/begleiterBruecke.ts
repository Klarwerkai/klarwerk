// ================================================================================================
// produkt:20261010:klara-office-mac-maskottchen — DIE BRÜCKE ZWISCHEN WEBFLÄCHE UND MAC-APP.
// ================================================================================================
//
// Die Begleitapp (`apps/desktop/klara-begleiter`, Swift/AppKit) zeigt diese Webfläche in einem
// WKWebView. Das Fenster, seine Lage auf den Bildschirmen und das Ziehen gehören der App; was im
// Fenster steht, gehört der Webfläche. Zwischen beiden gibt es GENAU zwei Wege:
//   · Web → App: `window.webkit.messageHandlers.klaraBegleiter.postMessage({ art, … })`
//     (nur in der App vorhanden — im Browser ist `anNative` ein Nein ohne Wirkung);
//   · App → Web: ein `CustomEvent` „klara-begleiter" am Fenster mit `{ befehl, wert }`.
// Was die App über sich selbst sagt (Fassung, Bau), legt sie VOR dem Laden der Seite unter
// `window.__KLARA_BEGLEITER__` ab — die Webfläche liest es nur und erfindet nichts dazu.

/**
 * `figur-vorgang` (produkt:20261011:assistenz-minimalistische-oberflaeche, UI-MIN-06/14): eingeklappt,
 * aber mit laufenden Vorgängen — das Fenster wächst um je einen Stopp pro Vorgang.
 */
export type ModusFenster = "figur" | "figur-vorgang" | "gespraech";

export type AnNative =
  | { art: "bereit"; webFassung: string }
  | { art: "modus"; modus: ModusFenster }
  | { art: "bewegen"; dx: number; dy: number }
  | { art: "griff"; x: number; y: number; breite: number; hoehe: number }
  | { art: "zustand"; zustand: string }
  | { art: "zuruecksetzen" }
  | { art: "andocken"; seite: "links" | "rechts" }
  | { art: "ausblenden" }
  | { art: "reduziert"; an: boolean }
  // UI-MIN-15 (Nacharbeit 46): der persönliche Name bzw. „Deine Assistenz“ für die Titelleiste.
  | { art: "name"; name: string }
  // UI-MIN-06/14 (Nacharbeit 47): Anzahl laufender Vorgänge — als Antwort auf `vorgaenge-melden`
  // (`anfrage` = dessen Nummer) und bei jeder Änderung. Die App blendet erst nach bestätigter 0 aus.
  | { art: "vorgaenge"; anzahl: number; anfrage?: number }
  // BPA-01: Sitzungswechsel entwertet die bisherige Browserkarte.
  | { art: "anmeldung" };

export type VonNative =
  | "figur-klick"
  | "gespraech-oeffnen"
  | "gespraech-schliessen"
  | "reduziert-an"
  | "reduziert-aus"
  | "vorgaenge-melden"
  // MAC-04/UI-05 (Nacharbeit 54): „Einstellungen …“ (⌘,) der App öffnet den vorhandenen Bereich.
  | "einstellungen-oeffnen";

const BEFEHLE: readonly VonNative[] = [
  "figur-klick",
  "gespraech-oeffnen",
  "gespraech-schliessen",
  "reduziert-an",
  "reduziert-aus",
  "vorgaenge-melden",
  "einstellungen-oeffnen",
];

export const BRUECKEN_EREIGNIS = "klara-begleiter";

interface BrueckenFenster {
  webkit?: { messageHandlers?: { klaraBegleiter?: { postMessage(nachricht: unknown): void } } };
  __KLARA_BEGLEITER__?: { fassung?: unknown; bau?: unknown };
}

function bruecke(w: Window): BrueckenFenster {
  return w as unknown as BrueckenFenster;
}

/** Läuft diese Seite in der Begleitapp (und nicht in einem gewöhnlichen Browser)? */
export function inBegleitApp(w: Window = window): boolean {
  return typeof bruecke(w).webkit?.messageHandlers?.klaraBegleiter?.postMessage === "function";
}

/** Eine Nachricht an die App. `false` im Browser — dort gibt es kein Fenster zu bewegen. */
export function anNative(nachricht: AnNative, w: Window = window): boolean {
  const ziel = bruecke(w).webkit?.messageHandlers?.klaraBegleiter;
  if (!ziel) {
    return false;
  }
  try {
    ziel.postMessage(nachricht);
    return true;
  } catch {
    return false;
  }
}

/** Fassung und Bau der App, wie sie selbst sie vor dem Laden eingetragen hat — sonst `null`. */
export function appFassung(w: Window = window): string | null {
  const roh = bruecke(w).__KLARA_BEGLEITER__;
  const fassung = typeof roh?.fassung === "string" ? roh.fassung.trim() : "";
  const bau = typeof roh?.bau === "string" ? roh.bau.trim() : "";
  if (!/^[0-9A-Za-z.+_-]{1,40}$/.test(fassung)) {
    return null;
  }
  return /^[0-9A-Za-z.+_-]{1,40}$/.test(bau) ? `${fassung} (${bau})` : fassung;
}

/**
 * Hört auf Befehle der App; unbekannte Befehle bleiben wirkungslos. `wert` nur als ganze Zahl
 * (z. B. die Anfragenummer von `vorgaenge-melden`). Gibt das Abmelden zurück.
 */
export function hoereAufNative(
  f: (befehl: VonNative, wert?: number) => void,
  w: Window = window,
): () => void {
  const hoerer = (e: Event): void => {
    const detail = (e as CustomEvent<{ befehl?: unknown; wert?: unknown }>).detail;
    const befehl = detail?.befehl;
    if (typeof befehl === "string" && (BEFEHLE as readonly string[]).includes(befehl)) {
      const wert = Number.isSafeInteger(detail?.wert) ? (detail?.wert as number) : undefined;
      f(befehl as VonNative, wert);
    }
  };
  w.addEventListener(BRUECKEN_EREIGNIS, hoerer);
  return () => w.removeEventListener(BRUECKEN_EREIGNIS, hoerer);
}

// AUFTRAG-mega40 BLOCK B (Pedi 28.07.): das zweite, umschaltbare Design („Modern", Werkbank-Sprache)
// ist eine REINE Präsentationsebene. Diese Datei ist die eine Wahrheit über den Schalter:
//  · Aktivierung über GENAU EIN Wurzel-Attribut `data-theme="modern"` an <html> — alle modern-Regeln
//    (apps/web/src/styles/modern.css) hängen ausschließlich darunter. Klassisch = KEIN Attribut;
//    ohne Attribut ändert sich kein einziger berechneter Wert (Invarianz-Test:
//    tests/app/mega40-theme-invarianz.test.ts).
//  · Persistenz je Browser über die BESTEHENDE fehlertolerante Speicher-Grenze (persistentToggle/
//    usePersistentValue): kaputter/verweigerter Speicher → die Wahl lebt nur diese Sitzung, nie ein
//    Absturz. Keine zweite Storage-Schicht.
//
// JOB 3060 · H1 (Pedi 04.09.): DIE VORGABE IST „MODERN". Bis hierher startete jeder Browser ohne
// gespeicherte Wahl in Klassisch; die Mockups (design/klarwerk) sind die Werkbank-Palette, und die
// Vorführung soll sie ohne Klick zeigen. Klassisch bleibt wählbar und gespeichert (Konto-Menü
// „Darstellung"); die gespeicherte Wahl gewinnt weiterhin über die Vorgabe.
// DOM-frei (globalThis, strukturelle Typen statt lib.dom) — importierbar aus node-env-Tests.
import { readStoredString, safeLocalStorage } from "./persistentToggle";

export const DESIGN_THEMES = ["classic", "modern"] as const;
export type DesignTheme = (typeof DESIGN_THEMES)[number];

/** Die Vorgabe für jeden Browser ohne gespeicherte Wahl (JOB 3060, Lieferung 4). */
export const DEFAULT_DESIGN_THEME: DesignTheme = "modern";

// Der localStorage-Schlüssel der Wahl. Werte sind exakt die DESIGN_THEMES; alles andere (Alt-/
// Fremdformat) fällt über usePersistentEnum bzw. initDesignTheme sicher auf die Vorgabe zurück.
export const DESIGN_THEME_STORAGE_KEY = "kw.designTheme";
export const DESIGN_THEME_ATTRIBUTE = "data-theme";

export function isDesignTheme(value: string | null): value is DesignTheme {
  return value !== null && (DESIGN_THEMES as readonly string[]).includes(value);
}

// Strukturell statt lib.dom (Klarwerk-Regel: lib-Helfer kompilieren auch im DOM-freien Typkontext).
type DocumentLike = {
  documentElement: {
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
  };
};

// Setzt bzw. entfernt das EINE Wurzel-Attribut. Klassisch heißt ausdrücklich „kein Attribut" —
// es gibt keinen data-theme="classic"-Zustand, an den sich je eine Regel hängen könnte.
export function applyDesignTheme(theme: DesignTheme): void {
  const doc = (globalThis as unknown as { document?: DocumentLike }).document;
  if (!doc) {
    return;
  }
  if (theme === "modern") {
    doc.documentElement.setAttribute(DESIGN_THEME_ATTRIBUTE, "modern");
  } else {
    doc.documentElement.removeAttribute(DESIGN_THEME_ATTRIBUTE);
  }
}

/** Die Wahl, die beim Start gilt: gespeichert, sonst die Vorgabe „modern". */
function storedOrDefaultDesignTheme(): DesignTheme {
  const stored = readStoredString(safeLocalStorage(), DESIGN_THEME_STORAGE_KEY);
  return isDesignTheme(stored) ? stored : DEFAULT_DESIGN_THEME;
}

// Beim App-Start (main.tsx), VOR dem ersten Render: gespeicherte Wahl bzw. Vorgabe anwenden. Nötig,
// weil der Umschalter im Konto-Menü wohnt und z. B. /mobile ohne Kopfband rendert — das Attribut
// gehört an die Wurzel, nicht an eine Komponente.
export function initDesignTheme(): void {
  applyDesignTheme(storedOrDefaultDesignTheme());
}

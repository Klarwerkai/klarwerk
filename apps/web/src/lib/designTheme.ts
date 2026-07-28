// AUFTRAG-mega40 BLOCK B (Pedi 28.07.): das zweite, umschaltbare Design („Modern", Werkbank-Sprache)
// ist eine REINE Präsentationsebene. Diese Datei ist die eine Wahrheit über den Schalter:
//  · Aktivierung über GENAU EIN Wurzel-Attribut `data-theme="modern"` an <html> — alle modern-Regeln
//    (apps/web/src/styles/modern.css) hängen ausschließlich darunter. Klassisch = KEIN Attribut;
//    ohne Attribut ändert sich kein einziger berechneter Wert (Invarianz-Test:
//    tests/app/mega40-theme-invarianz.test.ts).
//  · Persistenz je Browser über die BESTEHENDE fehlertolerante Speicher-Grenze (persistentToggle/
//    usePersistentValue): kaputter/verweigerter Speicher → die Wahl lebt nur diese Sitzung, nie ein
//    Absturz. Keine zweite Storage-Schicht.
// DOM-frei (globalThis, strukturelle Typen statt lib.dom) — importierbar aus node-env-Tests.
import { readStoredString, safeLocalStorage } from "./persistentToggle";

export const DESIGN_THEMES = ["classic", "modern"] as const;
export type DesignTheme = (typeof DESIGN_THEMES)[number];

// Der localStorage-Schlüssel der Wahl. Werte sind exakt die DESIGN_THEMES; alles andere (Alt-/
// Fremdformat) fällt über usePersistentEnum bzw. initDesignTheme sicher auf „classic" zurück.
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

// Beim App-Start (main.tsx), VOR dem ersten Render: gespeicherte Wahl anwenden. Nötig, weil der
// Umschalter in der Topbar wohnt und z. B. /mobile ohne Topbar rendert — das Attribut gehört an die
// Wurzel, nicht an eine Komponente.
export function initDesignTheme(): void {
  const stored = readStoredString(safeLocalStorage(), DESIGN_THEME_STORAGE_KEY);
  applyDesignTheme(isDesignTheme(stored) ? stored : "classic");
}

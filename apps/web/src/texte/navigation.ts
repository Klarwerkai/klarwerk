// ================================================================================================
// AUFNAHME 20260922 · GESAMT-NAVIGATION (R-1045) — „ES GEHT UNTEN WEITER".
// ================================================================================================
//
// Der Hinweis am unteren Rand einer Navigationsliste, die mehr Einträge trägt, als ins Fenster
// passen (`shell/WeiterUnten.tsx`): Off-Canvas-Drawer und die Übersicht „Arbeitsbereiche". Er steht
// nur, solange unter der sichtbaren Kante wirklich noch Einträge liegen.
//
// R-1023 (b) · `suchbegriffeZeigen/-Ausblenden`: der Entlastungsschalter der Hilfe-Seite. Die
// Merkmale („Suchbegriffe") jedes Kapitels stehen eingeklappt, bis jemand sie aufklappt oder sucht
// (`pages/Help.tsx`).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "navigation.",
  legacySchluessel: [],
  de: {
    "navigation.weiterUnten": "Weitere Einträge unten",
    "navigation.suchbegriffeZeigen": "Suchbegriffe der Kapitel zeigen",
    "navigation.suchbegriffeAusblenden": "Suchbegriffe der Kapitel ausblenden",
  },
  en: {
    "navigation.weiterUnten": "More entries below",
    "navigation.suchbegriffeZeigen": "Show the chapters' search terms",
    "navigation.suchbegriffeAusblenden": "Hide the chapters' search terms",
  },
  nl: {
    "navigation.weiterUnten": "Meer items hieronder",
    "navigation.suchbegriffeZeigen": "Zoektermen van de hoofdstukken tonen",
    "navigation.suchbegriffeAusblenden": "Zoektermen van de hoofdstukken verbergen",
  },
} satisfies Textmodul;

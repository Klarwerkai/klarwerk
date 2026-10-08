// ================================================================================================
// AUFNAHME 20260922 · GESAMT-NAVIGATION (R-1045) — „ES GEHT UNTEN WEITER".
// ================================================================================================
//
// Der Hinweis am unteren Rand einer Navigationsliste, die mehr Einträge trägt, als ins Fenster
// passen (`shell/WeiterUnten.tsx`): Off-Canvas-Drawer und die Übersicht „Arbeitsbereiche". Er steht
// nur, solange unter der sichtbaren Kante wirklich noch Einträge liegen.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "navigation.",
  legacySchluessel: [],
  de: {
    "navigation.weiterUnten": "Weitere Einträge unten",
  },
  en: {
    "navigation.weiterUnten": "More entries below",
  },
  nl: {
    "navigation.weiterUnten": "Meer items hieronder",
  },
} satisfies Textmodul;

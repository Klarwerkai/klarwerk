// R-0987 · TASTENKÜRZEL KENNT SEINE PLATTFORM.
// Angezeigte Tastenkombinationen richten sich nach dem Betriebssystem des Anwenders: auf Apple-
// Geräten „⌘K", sonst „Strg+K" (de) bzw. „Ctrl+K" (en/nl). Vorher stand überall fest „⌘K" — auch
// auf Windows und Linux, wo es keine ⌘-Taste gibt. Der Tastaturweg selbst ändert sich nicht:
// `CommandPalette.tsx` hört weiterhin auf `metaKey || ctrlKey`; hier geht es nur um die ANZEIGE.
//
// EINE Stelle für alle Anzeigeorte (Kopfband-Knopf, Zeile unter „Arbeitsbereiche", Platzhalter
// der Palette) — wer ein weiteres Kürzel anzeigt, nimmt es von hier.
// DOM-frei (globalThis, strukturelle Typen statt lib.dom) — importierbar aus node-env-Tests.
import { useTranslation } from "react-i18next";

export type Plattform = "apple" | "andere";

/** Die Felder des Navigators, aus denen die Plattform gelesen wird — für Tests einzeln setzbar. */
export interface PlattformQuelle {
  userAgentData?: { platform?: string } | undefined;
  platform?: string | undefined;
  userAgent?: string | undefined;
}

// Bewusst NICHT „Apple": jeder Chromium-Agent nennt „AppleWebKit", auch unter Windows und Linux.
const APPLE = /Mac|iPhone|iPad|iPod/i;

/**
 * Apple oder nicht. Gelesen wird die genaueste vorhandene Angabe zuerst: `userAgentData.platform`
 * (Chromium), dann `navigator.platform`, zuletzt der User-Agent. iPadOS meldet „MacIntel" und
 * zählt damit richtig als Apple.
 */
export function plattformAus(quelle: PlattformQuelle | undefined): Plattform {
  const angabe = quelle?.userAgentData?.platform || quelle?.platform || quelle?.userAgent || "";
  return APPLE.test(angabe) ? "apple" : "andere";
}

export function aktuellePlattform(): Plattform {
  return plattformAus((globalThis as unknown as { navigator?: PlattformQuelle }).navigator);
}

/** Die angezeigte Kombination für Befehlstaste/Steuerung + `taste`, z. B. „⌘K" oder „Strg+K". */
export function kuerzelText(taste: string, sprache: string, plattform: Plattform): string {
  if (plattform === "apple") {
    return `⌘${taste}`;
  }
  return `${sprache.startsWith("de") ? "Strg" : "Ctrl"}+${taste}`;
}

/** Beide Formen einer Sprache — für Prüfungen, die im Browser der jeweiligen Maschine laufen. */
export function kuerzelFormen(taste: string, sprache: string): readonly string[] {
  return [kuerzelText(taste, sprache, "apple"), kuerzelText(taste, sprache, "andere")];
}

/** Die Kombination für die aktuelle Sprache und die Plattform dieses Geräts. */
export function useKuerzel(taste: string): string {
  const { i18n } = useTranslation();
  return kuerzelText(taste, i18n.language ?? "de", aktuellePlattform());
}

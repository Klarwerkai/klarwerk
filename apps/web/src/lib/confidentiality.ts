// SCRUM-415: Vertraulichkeitsstufen im Frontend — DOM-freie Helfer für Anzeige (Chip) und Auswahl.
// „intern" ist der Standard (kein Chip nötig); „vertraulich"/„streng_vertraulich" sind vertraulich
// und werden als Chip ausgewiesen. Reine Funktionen → testbar ohne DOM.
import type { Confidentiality } from "../api/types";

export const CONFIDENTIALITY_LEVELS: readonly Confidentiality[] = [
  "intern",
  "vertraulich",
  "streng_vertraulich",
];

// Fehlendes Feld (Alt-KOs) = „intern".
export function confidentialityOf(level: Confidentiality | undefined | null): Confidentiality {
  return level === "vertraulich" || level === "streng_vertraulich" ? level : "intern";
}

export function isConfidential(level: Confidentiality | undefined | null): boolean {
  return level === "vertraulich" || level === "streng_vertraulich";
}

// WP-POLISH-CLOSE (bens Punkt 1): fail-safe-Prüfung für AUTOMATISCHE Frage-/Chip-Flächen (Beispiel-
// Chips, Auto-Send des Bibliotheks-Fragen-Knopfs). true NUR bei eindeutig nicht-vertraulicher
// Stufe: explizit „intern" oder das FEHLENDE Feld — der Server materialisiert vertrauliche Stufen
// IMMER und „intern" bewusst nie, ein fehlendes Feld ist damit die dokumentierte intern-Codierung
// (kein unklarer Fall). JEDER andere/unbekannte Wert gilt fail-safe als vertraulich (anders als
// confidentialityOf, das Unbekanntes zu „intern" glättet — für Automatik-Flächen zu lasch).
export function isKnownNonConfidential(level: unknown): boolean {
  return level === undefined || level === null || level === "intern";
}

// Anzeige-Metadaten je Stufe: i18n-Label-Schlüssel + Tönung. „intern" trägt kein Chip (showChip=false).
export interface ConfidentialityChip {
  labelKey: string;
  tone: "neutral" | "warn" | "crit";
  showChip: boolean;
}

export function confidentialityChip(
  level: Confidentiality | undefined | null,
): ConfidentialityChip {
  const effective = confidentialityOf(level);
  if (effective === "vertraulich") {
    return { labelKey: "conf.level.vertraulich", tone: "warn", showChip: true };
  }
  if (effective === "streng_vertraulich") {
    return { labelKey: "conf.level.streng_vertraulich", tone: "crit", showChip: true };
  }
  return { labelKey: "conf.level.intern", tone: "neutral", showChip: false };
}

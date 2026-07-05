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

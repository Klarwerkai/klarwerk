// SCRUM-415: Vertraulichkeitsstufen je Wissensobjekt — reine, testbare Helfer (kein Zustand).
// „intern" ist der Standard (Öffentlich-intern, keine Einschränkung). „vertraulich" und
// „streng_vertraulich" gelten als vertraulich: solche KOs gehen NIE in externe Kontexte
// (Output Factory/Export). Fehlt das Feld ganz (Alt-KOs), gilt ebenfalls „intern".
import type { Confidentiality } from "./types";

export const CONFIDENTIALITY_LEVELS: readonly Confidentiality[] = [
  "intern",
  "vertraulich",
  "streng_vertraulich",
];

// Unbekannte/leere Eingaben normalisieren defensiv auf „intern" (nie versehentlich freigeben,
// aber auch nie mit einem ungültigen Wert blockieren).
export function normalizeConfidentiality(value: unknown): Confidentiality {
  return value === "vertraulich" || value === "streng_vertraulich" ? value : "intern";
}

// Ist dieses KO vertraulich (→ nie in externe Kontexte)? Fehlendes Feld = „intern" = nicht vertraulich.
export function isConfidential(level: Confidentiality | undefined | null): boolean {
  return level === "vertraulich" || level === "streng_vertraulich";
}

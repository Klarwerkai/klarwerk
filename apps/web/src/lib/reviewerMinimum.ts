// E2E-005 / bens Auflage D4 (Sammel-Review 2): der Client muss für die Standard-Prüferanzahl EXAKT
// denselben Vertrag durchsetzen wie der Server (services/validation/src/settings.ts,
// normalizeDefaultNeeded): eine ECHTE ganze Zahl im Band 1–5. Das frühere Number.parseInt akzeptierte
// „1.5"/„1x" fälschlich als 1 (parseInt liest bis zum ersten Nicht-Ziffer-Zeichen und verwirft den
// Rest still) — und <input type="number"> verhindert eine solche Eingabe nicht zuverlässig. Diese
// DOM-freie Kern-Ableitung ist die EINE Quelle für Gültigkeitsprüfung UND Request-Wert.
export const MIN_NEEDED_VALIDATIONS = 1;
export const MAX_NEEDED_VALIDATIONS = 5;

// Rohtext → Zahl OHNE parseInt-Koerzierung. Leer/Whitespace → NaN (ungültig). „1.5" → 1.5 (kein
// Integer → ungültig), „1x" → NaN (ungültig). Number ist bewusst strikt: es akzeptiert keine
// abgeschnittene Ziffernfolge, im Gegensatz zu parseInt.
export function parseNeededValidations(raw: string): number {
  const trimmed = raw.trim();
  return trimmed.length === 0 ? Number.NaN : Number(trimmed);
}

// Gültig = ganze Zahl im Band 1–5 — dieselbe Bedingung wie normalizeDefaultNeeded serverseitig.
export function isNeededValidationsValid(raw: string): boolean {
  const n = parseNeededValidations(raw);
  return Number.isInteger(n) && n >= MIN_NEEDED_VALIDATIONS && n <= MAX_NEEDED_VALIDATIONS;
}

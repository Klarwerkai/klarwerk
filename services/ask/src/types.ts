// FR-ASK-05 / SCRUM-115: Priorität einer Wissenslücke. Default "mittel".
export type GapPriority = "hoch" | "mittel" | "niedrig";

export const GAP_PRIORITIES: readonly GapPriority[] = ["hoch", "mittel", "niedrig"];

export function isGapPriority(value: unknown): value is GapPriority {
  return value === "hoch" || value === "mittel" || value === "niedrig";
}

export interface Gap {
  id: string;
  question: string;
  status: "offen" | "geschlossen";
  assignee: string | null;
  priority: GapPriority;
  createdAt: string;
  // FUNKE-FIX2 P0 (bens Blocker Gap-Freitext): Ersteller/Owner der Lücke (der fragende Actor). Grundlage
  // der adressatengerechten Freitext-Sichtbarkeit — der Ersteller darf „seinen" Fragetext wiedersehen
  // (z. B. beim Erfassen), ein Unberechtigter bekommt eine redigierte Sicht. Nur INTERN (Persistenz +
  // Redaktions-Entscheid); der GapView an den Client trägt das Feld NIE (kein Leak, wer eine
  // vertrauliche Lücke anlegte). Fehlt bei Altbeständen/System-Lücken → dann greift nur assignee/Rolle.
  createdBy?: string;
  // Herkunfts-Markierung: vom Demo-Seed erzeugte Lücke (stabil, überlebt Bearbeitung/Persistenz).
  // Der Demo-Purge entfernt gezielt genau diese — kein fragiler Titel-/Text-Abgleich mehr.
  demoSeed?: boolean;
}

// FUNKE-FIX P0 (bens ROT-1): FORBIDDEN — ein „Danke" ohne gültigen, dieses KO belegenden
// Antwort-Receipt (unbelegte/fremd gewählte KO-ID) → 403 (sendError-Mapping).
export type AskErrorCode = "NOT_FOUND" | "CONFIRM_REQUIRED" | "BAD_REQUEST" | "FORBIDDEN";

export class AskError extends Error {
  readonly code: AskErrorCode;

  constructor(code: AskErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AskError";
  }
}

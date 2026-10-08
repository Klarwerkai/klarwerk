// FR-VAL-01: Peer-Bewertung ✅ / ⚠️ / ❌.
export type Verdict = "up" | "warn" | "down";

export interface Rating {
  koId: string;
  userId: string;
  verdict: Verdict;
  createdAt: string;
  // SCRUM-507 R2: die KO-Version, die DIESE Bewertung bewertet hat. Wird beim Bewerten gestempelt.
  // Nur Bewertungen der AKTUELLEN KO-Version zählen für Trust/Status; frühere sind „stale" (bleiben
  // aber als Historie erhalten). Additiv in der JSONB-Ablage — keine DDL-Migration nötig. Alt-
  // Bewertungen ohne Feld gelten als Version 1 (häufigster Fall; auf revidierten KOs damit stale).
  koVersion?: number;
}

export interface Assignment {
  koId: string;
  userId: string;
  status: "open" | "done";
  // AUFNAHME gesamt-entwurf-einreichen (Ben Lauf :3 Runde 1, B2): ob die Prüferin über DIESE
  // Zuweisung schon benachrichtigt ist. Nur der wiederholbare Einreichweg setzt das Feld
  // (`zuweisenBeimEinreichen` → „ausstehend", `benachrichtigungErledigt` → „erledigt"). Ohne Feld
  // (Altbestand, übrige Zuweisungswege) ist der Stand UNBEKANNT; wie er zu lesen ist, entscheidet
  // `nochZuBenachrichtigen` mit dem Nachweis des Aufrufers. Eine vorhandene Zuweisung allein beweist
  // nicht, dass die Benachrichtigung lief.
  benachrichtigung?: "ausstehend" | "erledigt";
  /**
   * R-0571: „verzeichnis" = aus der Prüfzuständigkeit des Unternehmensverzeichnisses abgeleitet.
   * Nur solche OFFENEN Zuweisungen gleicht `verzeichnisAbgleichen` mit dem Gruppenstand ab; ohne
   * Feld ist die Zuweisung von Hand (oder beim Einreichen) entstanden und bleibt unberührt.
   */
  quelle?: "verzeichnis";
}

// SCRUM-395: INVALID_DEFAULT = ungültige Standard-Prüferanzahl (Admin-Einstellung).
export type ValidationErrorCode = "NOT_FOUND" | "INVALID_DEFAULT";

export class ValidationError extends Error {
  readonly code: ValidationErrorCode;

  constructor(code: ValidationErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ValidationError";
  }
}

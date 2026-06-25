// Reine, DOM-freie Regel für die Re-Validierung aus der Bibliothek (SCRUM-136 / FE-LIB-05).
// Nur bereits validierte Objekte sinnvoll re-validierbar; kein neues Statusmodell.
import type { KoStatus } from "../api/types";

export function canRevalidate(status: KoStatus): boolean {
  return status === "validiert";
}

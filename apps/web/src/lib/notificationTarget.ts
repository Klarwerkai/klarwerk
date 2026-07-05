import type { Notification } from "../api/types";
import { validationMineHref } from "./validationFilters";

// SCRUM-220: DOM-freie Ableitung des Sprungziels einer Benachrichtigung aus vorhandenen Daten.
// Konflikt → Konflikt-Board, Wissenslücke → Risiko (dort werden Lücken geführt). Nur eindeutige
// Ziele; alles andere liefert null (dann kein Link, nur Anzeige/mark-read — kein Fake-Ziel).
// SCRUM-364 / AG-15 follow-up: Review-Zuweisung → fokussierte „Mir zugewiesen"-Linse der Validierung
// (`/validierung?mine=1`), nicht mehr nur die allgemeine Liste — direkt in die persönliche Review-Arbeit.
export function notificationTarget(n: Pick<Notification, "kind" | "koId">): string | null {
  // PMO-FEA-0002: Wirkungs-Rückmeldung führt direkt zum eigenen Wissensobjekt.
  if (n.kind === "impact") {
    return n.koId ? `/wissen/${n.koId}` : null;
  }
  if (n.kind === "conflict") {
    return "/konflikte";
  }
  // Pedi 04.07.: Duplikat-Benachrichtigung führt aufs Duplikate-Board.
  if (n.kind === "duplicate") {
    return "/duplikate";
  }
  if (n.kind === "gap") {
    return "/risiko";
  }
  if (n.kind === "assignment") {
    return validationMineHref();
  }
  return null;
}

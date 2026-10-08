import type { Notification } from "../api/types";
import { adminHref } from "./adminSections";
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
  // R-0894: eine Eskalation wird dort entschieden, wo der Konflikt steht.
  if (n.kind === "conflict" || n.kind === "escalation") {
    return "/konflikte";
  }
  // R-0894: eine Rückgabe zur Nacharbeit führt in den Eintrag — dort wird überarbeitet, nicht in
  // der Prüfliste.
  if (n.kind === "return") {
    return n.koId ? `/wissen/${n.koId}` : null;
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
  // Kenntnisnahme: der Eintrag selbst — dort steht die Anforderung samt Bestätigen-Knopf.
  if (n.kind === "kenntnisnahme") {
    return n.koId ? `/wissen/${n.koId}` : null;
  }
  // Löschantrag (R-0661): die Datenschutzkarte der Verwaltung — dort stehen Frist und Entscheidung.
  if (n.kind === "loeschantrag") {
    return adminHref("sicherheit", "datenschutz");
  }
  return null;
}

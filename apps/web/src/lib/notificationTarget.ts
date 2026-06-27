import type { Notification } from "../api/types";

// SCRUM-220: DOM-freie Ableitung des Sprungziels einer Benachrichtigung aus vorhandenen Daten.
// Konflikt → Konflikt-Board, Wissenslücke → Risiko (dort werden Lücken geführt). Nur eindeutige
// Ziele; alles andere liefert null (dann kein Link, nur Anzeige/mark-read — kein Fake-Ziel).
export function notificationTarget(n: Pick<Notification, "kind">): string | null {
  if (n.kind === "conflict") {
    return "/konflikte";
  }
  if (n.kind === "gap") {
    return "/risiko";
  }
  return null;
}

import type { Gap } from "../../ask";
import type { Conflict } from "../../conflicts";
import type { AssignmentNotice } from "../../validation";

// In-App-Benachrichtigungen (Abstimmpunkt 2). Das notifications-Modul versendet
// nur E-Mail; die Glocke/Popover-Quelle wird hier aus vorhandenen Signalen mit
// Zeitstempel aggregiert: offene Konflikte, offene Wissenslücken und — SCRUM-363 —
// die persönlichen offenen Review-Zuweisungen der aktuellen Person.
export type NotificationKind = "conflict" | "gap" | "assignment";

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  at: string;
  // SCRUM-363: bei Zuweisungen das Quell-KO (für Anzeige/Verlinkung); sonst nicht gesetzt.
  koId?: string;
}

// SCRUM-363 / AG-15: persönliche offene Review-Zuweisungen kommen als eigene Kategorie in den Feed.
// `assignments` enthält bereits NUR die Zuweisungen der aktuellen Person (Route filtert pro Nutzer) —
// hier wird keine Ownership erfunden. Konflikt-/Gap-Benachrichtigungen bleiben unverändert.
export function buildNotifications(input: {
  conflicts: Conflict[];
  gaps: Gap[];
  assignments?: AssignmentNotice[];
}): Notification[] {
  const items: Notification[] = [];
  for (const c of input.conflicts) {
    items.push({ id: `con-${c.id}`, kind: "conflict", title: c.description, at: c.createdAt });
  }
  for (const g of input.gaps) {
    if (g.status === "offen") {
      items.push({ id: `gap-${g.id}`, kind: "gap", title: g.question, at: g.createdAt });
    }
  }
  for (const a of input.assignments ?? []) {
    items.push({
      id: `assign-${a.koId}`,
      kind: "assignment",
      title: a.title,
      at: a.at,
      koId: a.koId,
    });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

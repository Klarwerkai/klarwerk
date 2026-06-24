import type { Gap } from "../../ask";
import type { Conflict } from "../../conflicts";

// In-App-Benachrichtigungen (Abstimmpunkt 2). Das notifications-Modul versendet
// nur E-Mail; die Glocke/Popover-Quelle wird hier aus vorhandenen Signalen mit
// Zeitstempel aggregiert: offene Konflikte und offene Wissenslücken.
export type NotificationKind = "conflict" | "gap";

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  at: string;
}

export function buildNotifications(input: { conflicts: Conflict[]; gaps: Gap[] }): Notification[] {
  const items: Notification[] = [];
  for (const c of input.conflicts) {
    items.push({ id: `con-${c.id}`, kind: "conflict", title: c.description, at: c.createdAt });
  }
  for (const g of input.gaps) {
    if (g.status === "offen") {
      items.push({ id: `gap-${g.id}`, kind: "gap", title: g.question, at: g.createdAt });
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

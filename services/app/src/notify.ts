import type { AuthService } from "../../auth";
import type { Mailer } from "../../notifications";

// FR-VAL-07: Benachrichtigung bei Validierungs-Zuweisung. Orchestriert auth (E-Mail-Lookup)
// und den Mailer — App-Aufgabe, da modulübergreifend.
export type AssignmentNotifier = (koId: string, userIds: readonly string[]) => Promise<void>;

export function makeAssignmentNotifier(auth: AuthService, mailer: Mailer): AssignmentNotifier {
  return async (koId, userIds) => {
    if (userIds.length === 0) {
      return;
    }
    const users = await auth.listUsers();
    const byId = new Map(users.map((u) => [u.id, u]));
    for (const id of userIds) {
      const user = byId.get(id);
      if (!user) {
        continue;
      }
      await mailer.send({
        to: user.email,
        subject: "KLARWERK: Wissensobjekt zur Validierung zugewiesen",
        text: `Hallo ${user.name},\n\ndir wurde ein Wissensobjekt (${koId}) zur Validierung zugewiesen.\nBitte prüfe es im Validierungs-Board.\n\n— KLARWERK`,
      });
    }
  };
}

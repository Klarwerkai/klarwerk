// SCRUM-181: DOM-freie Auswahl sinnvoller „nächster Schritte" für leere Übersichten. Reicht
// pro Kontext Kandidaten-Navigationsziele an und filtert sie über die VORHANDENE Rollen-/Nav-
// Logik (ALL_ITEMS + canSee). So werden nie Aktionen angeboten, die die Rolle gar nicht sehen darf.
import { ALL_ITEMS, type Role, canSee } from "../app/navigation";

export type EmptyStateContext = "start" | "tasks" | "validation" | "library";

export interface EmptyStateAction {
  to: string; // Navigationspfad aus der Nav-Quelle (kein Fremd-Link)
  labelKey: string;
}

// Kandidaten je Kontext — referenzieren echte Nav-IDs; die Sichtbarkeit entscheidet canSee.
const CANDIDATES: Record<EmptyStateContext, { navId: string; labelKey: string }[]> = {
  start: [
    { navId: "erfassen", labelKey: "empty.cta.capture" },
    { navId: "import", labelKey: "empty.cta.import" },
    { navId: "admin", labelKey: "empty.cta.admin" },
  ],
  tasks: [
    { navId: "erfassen", labelKey: "empty.cta.capture" },
    { navId: "bibliothek", labelKey: "empty.cta.library" },
    { navId: "validierung", labelKey: "empty.cta.validation" },
  ],
  validation: [
    { navId: "erfassen", labelKey: "empty.cta.capture" },
    { navId: "aufgaben", labelKey: "empty.cta.tasks" },
  ],
  library: [
    { navId: "erfassen", labelKey: "empty.cta.capture" },
    { navId: "import", labelKey: "empty.cta.import" },
  ],
};

export function emptyStateActions(
  context: EmptyStateContext,
  role: Role,
  stufe2: boolean,
): EmptyStateAction[] {
  const out: EmptyStateAction[] = [];
  for (const c of CANDIDATES[context]) {
    const item = ALL_ITEMS.find((i) => i.id === c.navId);
    if (item && canSee(item, role, stufe2)) {
      out.push({ to: item.path, labelKey: c.labelKey });
    }
  }
  return out;
}

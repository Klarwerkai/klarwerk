// Reine, DOM-freie Ableitung der rollenbewussten „Missionen" (FE-FND-09).
// Missionen sind KEINE neuen Seiten — nur kuratierte Deep-Links in bereits
// existierende, echte Flows. Sichtbarkeit kommt aus der vorhandenen `canSee`-
// Logik (keine zweite Berechtigungslogik); Reihenfolge ist aufgaben-orientiert.
import { NAV_GROUPS, type NavItem, type Role, canSee } from "../app/navigation";

export interface Mission {
  id: string;
  path: string;
  labelKey: string; // Titel — wiederverwendet das Nav-Label des Zielflows
  descKey: string; // kurze Aufgabenbeschreibung (i18n: missions.<id>.desc)
}

// Aufgaben-orientierte Priorität. Jede ID muss ein echtes NavItem referenzieren;
// gezeigt wird höchstens MAX_MISSIONS, gefiltert über die Rollen-Sichtbarkeit.
const MISSION_ORDER: readonly string[] = [
  "erfassen",
  "validierung",
  "risiko",
  "fragen",
  "bibliothek",
];
const MAX_MISSIONS = 4;

function findNavItem(id: string): NavItem | undefined {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((i) => i.id === id);
    if (item) {
      return item;
    }
  }
  return undefined;
}

export function missionsForRole(role: Role, stufe2: boolean): Mission[] {
  const missions: Mission[] = [];
  for (const id of MISSION_ORDER) {
    const item = findNavItem(id);
    if (item && canSee(item, role, stufe2)) {
      missions.push({
        id: item.id,
        path: item.path,
        labelKey: item.labelKey,
        descKey: `missions.${item.id}.desc`,
      });
    }
  }
  return missions.slice(0, MAX_MISSIONS);
}

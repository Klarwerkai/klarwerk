import { matchPath } from "react-router-dom";
import { GUARDED_ITEMS, ROLE_RANK, type Role, canSee } from "../app/navigation";
import { FRAGEN_LEKTION } from "./fragen/lektion";
import { SEITEN } from "./seiten/daten";
import { SEITEN_TUTORIALS } from "./seiten/definitionen";
import type { TutorialDefinition } from "./typen";
/** Bestehendes Fragen-Tutorial und neue Inhalte verwenden denselben Rahmen und Schrittstand. */
export const TUTORIALS: readonly TutorialDefinition[] = [FRAGEN_LEKTION, ...SEITEN_TUTORIALS];
export function tutorialFuerPfad(
  pfad: string,
  role: Role = "viewer",
  stufe2 = true,
): TutorialDefinition | null {
  const gate = GUARDED_ITEMS.find((g) => matchPath({ path: g.path, end: true }, pfad));
  if (gate && !canSee(gate, role, stufe2)) return null;
  const seite = SEITEN.find((s) => s.pfade.some((p) => matchPath({ path: p, end: true }, pfad)));
  if (seite?.minRole && ROLE_RANK[role] < ROLE_RANK[seite.minRole]) return null;
  return TUTORIALS.find((t) => matchPath({ path: t.pfad, end: true }, pfad)) ?? null;
}

// SCRUM-158: DOM-freie, ehrliche Fenster-/Limit-Logik für große KO-Listen (kein Backend-,
// kein Such-Engine-Umbau). Begrenzt die gerenderte Menge und meldet transparent „N von M".
export const LIBRARY_RESULT_LIMIT = 200;

export interface ListWindow<T> {
  visible: T[]; // tatsächlich anzuzeigende Teilmenge
  total: number; // Gesamttreffer
  shown: number; // Anzahl sichtbarer Treffer
  limited: boolean; // true, wenn nicht alle Treffer angezeigt werden
}

export function windowList<T>(
  items: readonly T[],
  limit: number = LIBRARY_RESULT_LIMIT,
): ListWindow<T> {
  const total = items.length;
  const safeLimit = Math.max(0, Math.floor(limit));
  const limited = total > safeLimit;
  const visible = limited ? items.slice(0, safeLimit) : [...items];
  return { visible, total, shown: visible.length, limited };
}

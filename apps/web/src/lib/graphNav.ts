// SCRUM-228: DOM-freie Navigations-Helfer für den Wissensgraphen. Ein Graph-Knoten trägt die
// echte KO-ID (services/library-analytics baut Knoten als { id: ko.id, title }). Damit ist die
// Navigation zum KO-Detail eine reine Pfad-Ableitung. Knoten ohne passendes KO im aktuellen
// Bestand bleiben ehrlich nicht-navigierbar (sicher deaktiviert) — keine Fake-Ziele.

// Detail-Route eines Wissensobjekts (siehe routes.tsx: /wissen/:id).
export function koDetailPath(koId: string): string {
  return `/wissen/${encodeURIComponent(koId)}`;
}

// Navigierbar nur, wenn die Knoten-ID einem bekannten KO im aktuellen Bestand entspricht.
export function isNavigableNode(id: string, knownKoIds: ReadonlySet<string>): boolean {
  return knownKoIds.has(id);
}

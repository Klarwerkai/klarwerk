import type { AssignmentSummary } from "../api/types";

// R-0756 / FR-VAL-06: „In der Auswertung und im Adminbereich ist je Person sichtbar, welche
// Prüfaufträge offen und welche erledigt sind." Die Zahlen kommen unverändert aus
// `GET /api/validation/overview` (dort schon auf den SICHTBAREN Bestand begrenzt); hier wird nur
// der Name dazugelegt und geordnet. EINE Ableitung für beide Flächen — zwei Sortierungen wären zwei
// Aussagen darüber, wer vorne steht.

export interface AuftragsZeile {
  userId: string;
  /** `null`, wenn die Person nicht (mehr) in der Personenliste steht — kein erfundener Name. */
  name: string | null;
  open: number;
  done: number;
}

export function auftraegeJePerson(
  summaries: readonly AssignmentSummary[],
  personen: readonly { id: string; name: string }[],
): AuftragsZeile[] {
  const namen = new Map(personen.map((p) => [p.id, p.name]));
  return summaries
    .map((s) => ({
      userId: s.userId,
      name: namen.get(s.userId) ?? null,
      open: s.open,
      done: s.done,
    }))
    .sort(
      (a, b) =>
        b.open - a.open ||
        b.done - a.done ||
        (a.name ?? "").localeCompare(b.name ?? "") ||
        a.userId.localeCompare(b.userId),
    );
}

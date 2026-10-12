import type { QueryClient } from "@tanstack/react-query";

// ================================================================================================
// produkt:20261011:peter-p14 (K6/K7) — DER ZWISCHENSPEICHER FOLGT DEM RECHTEKONTEXT.
// ================================================================================================
//
// Jede angemeldete Serverantwort trägt den Stempel des Rechtekontexts, unter dem sie entstand
// (`x-klarwerk-rechtekontext`, `services/app/src/rechtekontext.ts`: Konto, Rolle, lesbare Spaces).
// Bens Befund (Nacharbeit 2): die Abfrageschlüssel kennen Filter, aber keine Rechte — nach einem
// Rollen- oder Mitgliedschaftsentzug blieben alte Treffer stehen, bis die Liste zufällig neu kam.
//
// DIE REGEL:
//   · Der erste gesehene Stempel ist der bekannte Kontext.
//   · Bringt eine Antwort einen ANDEREN Stempel, beginnt eine neue Epoche: alle Inhaltsabfragen
//     werden abgebrochen (ihre noch laufenden Antworten aus dem alten Kontext zählen nicht) und
//     zurückgesetzt — bis die Neuantwort da ist, zeigt die Fläche NICHTS statt alter Treffer.
//   · Antworten auf Anfragen, die VOR dem erkannten Wechsel begonnen haben, verschieben den
//     bekannten Kontext nicht zurück (sie sind ohnehin verworfen).
//
// Abmelden leert den ganzen Speicher und lädt neu (`AuthContext`); damit beginnt auch dieser Zustand
// neu.
export const RECHTEKONTEXT_KOPF = "x-klarwerk-rechtekontext";

let bekannt: string | null = null;
let epoche = 0;
const hoerer = new Set<() => void>();

/** Die Epoche beim Beginn einer Anfrage — `rechtekontextGesehen` bekommt sie zurück. */
export function anfrageEpoche(): number {
  return epoche;
}

/** Wertet den Stempel einer Antwort aus; `beginn` ist die Epoche beim Absenden der Anfrage. */
export function rechtekontextGesehen(stempel: string | null, beginn: number): void {
  if (!stempel || beginn !== epoche) {
    return;
  }
  if (bekannt === null) {
    bekannt = stempel;
    return;
  }
  if (stempel === bekannt) {
    return;
  }
  bekannt = stempel;
  epoche += 1;
  for (const h of [...hoerer]) {
    h();
  }
}

/** Meldet jeden erkannten Wechsel. Liefert die Abmeldung. */
export function aufRechtekontextwechsel(h: () => void): () => void {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

/** Nur für Proben: der Anfangszustand (kein bekannter Kontext, Epoche 0, keine Hörer). */
export function rechtekontextZuruecksetzen(): void {
  bekannt = null;
  epoche = 0;
  hoerer.clear();
}

/** Abfragen ohne Wissensinhalt: Sitzung und Schalter — sie bleiben stehen. */
const OHNE_INHALT = new Set(["auth", "features"]);

export function istInhaltsabfrage(queryKey: readonly unknown[]): boolean {
  return !OHNE_INHALT.has(String(queryKey[0]));
}

/**
 * Verwirft alles, was unter dem alten Kontext geholt wurde: laufende Abrufe abbrechen (ihr
 * Ergebnis zählt nicht mehr), dann zurücksetzen — sichtbare Abfragen holen neu und zeigen bis dahin
 * keine Daten.
 */
export async function verwerfeAlteInhalte(queryClient: QueryClient): Promise<void> {
  const filter = {
    predicate: (q: { queryKey: readonly unknown[] }) => istInhaltsabfrage(q.queryKey),
  };
  await queryClient.cancelQueries(filter);
  await queryClient.resetQueries(filter);
}

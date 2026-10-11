// ================================================================================================
// produkt:20261011:peter-p14 · Bens Befund 3 (Nacharbeit 5) — DAS BEREICHSGEBUNDENE EXISTENZRECHT.
// ================================================================================================
//
// Peters Antwort 25 (11.10.2026): „Existenzhinweise nur mit ausdrücklichem Recht; sonst allgemeine
// Meldung unabhängig von geheimen Treffern." Dazu der Prüfnachtrag RF08/RF16: „scoped
// Existenzrecht" — ein Recht an EINEN Bereich, getrennt vom Leserecht.
//
// DIE FORM:
//   · Vergeben wird es am Space (`SpaceEingabe.existenz`, Kontoliste), im bestehenden Pflegeweg der
//     Spacezuständigen/Kontoverwaltung — dort, wo auch Mitglieder und Zugang gepflegt werden.
//   · Es wirkt nur, solange der Mensch die Inhalte des Space NICHT lesen darf (`existenzbereiche`).
//   · Der Hinweis nennt den Bereich (Kennung und Name) und SONST NICHTS: keinen Titel, keine
//     Kennung, keine Zahl, keinen Rang, keinen Auszug. Wer mehr will, fragt die Zuständigen.
//   · Gezählt wird nur, was der Mensch MIT Leserecht an genau diesem Space sehen dürfte — die
//     Stufen- und Quelllesersperren gelten weiter (`darfSehen` mit einem auf diesen einen Space
//     beschränkten Blick). Das Existenzrecht an einem Bereich verrät also nichts über Vertrauliches,
//     das auch ein Mitglied nicht sähe, und nichts über andere Bereiche.
//   · Ohne Recht ist die Antwort konstant leer — gleich, ob es einen verborgenen Treffer gibt.
//
// BENANNTE GRENZE: ein Existenzhinweis ist je Anfrage ein Bit je Bereich. Wer das Recht hat, kann
// mit variierten Begriffen mehr über den Bereich erfahren als ein Bit — das ist der Inhalt des
// Rechts, und seine Begrenzung gegen Rekonstruktion (P02-AC03) gehört zum Paket P02.
import type { SessionUser } from "./http";
import type { SichtbarkeitsFakten, SqlSichtbarkeitstrim } from "./sichtbarkeit";

/** Die Bereiche, für die ein Konto ausdrücklich das Existenzrecht ohne Leserecht hat. */
export type ExistenzbereichQuelle = (nutzerId: string) => Promise<{ id: string; name: string }[]>;

/** Ein Existenzhinweis am Draht — bewusst nur der Bereich. */
export interface Existenzhinweis {
  spaceId: string;
  spaceName: string;
}

export const EXISTENZ_BEGRIFF = { min: 3, max: 200 } as const;

/**
 * Der Blick, mit dem der Hinweis entschieden wird: derselbe Mensch (Rolle, Kennung), aber als läse
 * er GENAU diesen einen Space — keinen weiteren. Ausgewertet wird er nur von `sichtbarkeit.ts`.
 */
export function bereichsblick(user: SessionUser, spaceId: string): SessionUser {
  return { id: user.id, role: user.role, spaceLesbar: new Set([spaceId]) };
}

/** Der Trim des Bereichsblicks, verengt auf Objekte, deren führender Space genau dieser ist. */
export function bereichsTrim(basis: SqlSichtbarkeitstrim, spaceId: string): SqlSichtbarkeitstrim {
  return {
    sql(t: string, ab: number): string {
      const p = ab + basis.params.length;
      return `(${basis.sql(t, ab)} AND COALESCE(jsonb_typeof(${t}.data->'spaceId') = 'string' AND ${t}.data->>'spaceId' = $${p}::text, false))`;
    },
    params: [...basis.params, spaceId],
    trifftZu(ko: SichtbarkeitsFakten & { deletedAt?: string | null | undefined }): boolean {
      return basis.trifftZu(ko) && ko.spaceId === spaceId;
    },
  };
}

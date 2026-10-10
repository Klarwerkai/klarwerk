// ================================================================================================
// ADMIN-02 — DIE IMPORTLISTE: DIE JÜNGSTEN LÄUFE AUS DEM BESTEHENDEN LAUFBESTAND.
// ================================================================================================
//
// Die Laufablage (`services/library-analytics/src/repo.ts`, `repo-pg.ts`) ist eingefroren
// (FREEZE-144) und kennt nur den Zugriff über eine Kennung. Eine Übersicht „welche Läufe gab es?"
// braucht aber eine Liste. Sie entsteht HIER, neben dem eingefrorenen Vertrag und ohne ihn zu ändern:
// zwei Unterklassen der vorhandenen Ablagen, die ZUSÄTZLICH auflisten können. Geschrieben wird
// weiterhin ausschliesslich über die geerbten Methoden — es entsteht keine zweite Wahrheit über einen
// Lauf, nur ein zweiter LESEWEG zu derselben.
//
//   SPEICHER  — merkt sich jede neu angelegte Kennung (`insertIfAbsent` mit Ergebnis `true`). Die
//               Dev-Persistenz spielt beim Start genau diese Aufrufe aus dem Journal zurück; die Liste
//               steht nach einem Neustart also wieder vollständig da.
//   POSTGRES  — liest Kennung und Startzeit aller Läufe und ordnet in JavaScript. Bewusst KEIN
//               `ORDER BY … LIMIT` auf der JSONB-Textspalte: dieselbe Begründung wie bei
//               `findLastSuccessAt` (`repo-pg.ts`) — lexikografisch sortierte Zeitstempel mit
//               Zonenversatz stünden in falscher Reihenfolge.
//
// Geordnet wird nach `startedAt`, jüngster zuerst; unlesbare Zeitpunkte stehen hinten, gleiche nach
// Kennung. So ist dieselbe Ablage in beiden Betriebsarten gleich sortiert.
import type { Pool } from "pg";
import { type ImportRun, InMemoryImportRunRepo, PgImportRunRepo } from "../../library-analytics";

/** Die Fähigkeit, die jüngsten Läufe zu nennen. */
export interface ImportLaufListe {
  juengsteLaeufe(limit: number): Promise<ImportRun[]>;
}

/** Kann diese Ablage auflisten? (Die Dev-Persistenz reicht die Methode unverändert durch.) */
export function istLaufListe(ablage: unknown): ablage is ImportLaufListe {
  return (
    typeof ablage === "object" &&
    ablage !== null &&
    typeof (ablage as { juengsteLaeufe?: unknown }).juengsteLaeufe === "function"
  );
}

function zeitwert(iso: unknown): number {
  const wert = typeof iso === "string" ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(wert) ? Number.NEGATIVE_INFINITY : wert;
}

/** Jüngster zuerst; unlesbare Zeitpunkte hinten; Gleichstand nach Kennung. */
export function ordneJuengsteZuerst<T extends { kennung: string; startedAt: unknown }>(
  eintraege: readonly T[],
): T[] {
  const nachZeit = (a: T, b: T): number => {
    const za = zeitwert(a.startedAt);
    const zb = zeitwert(b.startedAt);
    if (za !== zb) {
      return za < zb ? 1 : -1;
    }
    return a.kennung < b.kennung ? -1 : a.kennung > b.kennung ? 1 : 0;
  };
  return [...eintraege].sort(nachZeit);
}

export class InMemoryAuflistbareImportRunRepo
  extends InMemoryImportRunRepo
  implements ImportLaufListe
{
  private readonly kennungen: string[] = [];

  override async insertIfAbsent(run: ImportRun): Promise<boolean> {
    const neu = await super.insertIfAbsent(run);
    if (neu) {
      this.kennungen.push(run.importId);
    }
    return neu;
  }

  async juengsteLaeufe(limit: number): Promise<ImportRun[]> {
    const laeufe: ImportRun[] = [];
    for (const kennung of this.kennungen) {
      const lauf = await this.findById(kennung);
      if (lauf) {
        laeufe.push(lauf);
      }
    }
    const eintraege = laeufe.map((lauf) => ({
      kennung: lauf.importId,
      startedAt: lauf.startedAt,
      lauf,
    }));
    return ordneJuengsteZuerst(eintraege)
      .slice(0, limit)
      .map((e) => e.lauf);
  }
}

export class PgAuflistbareImportRunRepo extends PgImportRunRepo implements ImportLaufListe {
  constructor(private readonly lesePool: Pool) {
    super(lesePool);
  }

  async juengsteLaeufe(limit: number): Promise<ImportRun[]> {
    const res = await this.lesePool.query<{ import_id: string; started_at: unknown }>(
      "SELECT import_id, data->>'startedAt' AS started_at FROM import_runs",
    );
    const auswahl = ordneJuengsteZuerst(
      res.rows.map((z) => ({ kennung: z.import_id, startedAt: z.started_at })),
    ).slice(0, limit);
    const laeufe: ImportRun[] = [];
    for (const eintrag of auswahl) {
      const lauf = await this.findById(eintrag.kennung);
      if (lauf) {
        laeufe.push(lauf);
      }
    }
    return laeufe;
  }
}

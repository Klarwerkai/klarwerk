// ================================================================================================
// aufnahme:20260922:gesamt-wissen-frische · Nacharbeit 5 — DER FESTGEHALTENE LERNVERLAUF (R-1636/R-0248).
// ================================================================================================
//
// Warum es diese Ablage gibt, steht an `HalbwertszeitEintrag` (frische.ts): der Lernstand eines
// vergangenen Zeitpunkts darf nicht aus dem heutigen Bestand rekonstruiert werden, sonst verlängert
// das Löschen oder Umkategorisieren eines ANDEREN Objekts eine längst abgelaufene Frist.
//
// DIE ABLAGE ERGÄNZT NUR. Es gibt kein Ändern und kein Entfernen einzelner Einträge: ein Eintrag
// mit demselben Schlüssel (Objekt + spätere Fassung) wird nicht überschrieben — die Kategorie und
// der Erfassungszeitpunkt bleiben, wie sie beim ersten Lernen waren. Entfernt wird der Verlauf nur
// mit dem ganzen Wissensbestand (Bestandsreset, `services/db-tx/src/bestandsreset.ts`).
//
// Die Tabelle legt `KO_VERSIONS_SCHEMA` an (repo-pg.ts) — sie gehört zur Fassungsfolge, aus der
// sie gelernt wird, und wird mit ihr migriert.
import type { Pool } from "pg";
import type { HalbwertszeitEintrag } from "./frische";

export interface HalbwertszeitVerlaufRepo {
  alle(): Promise<HalbwertszeitEintrag[]>;
  /** Legt neue Einträge an; ein vorhandener Schlüssel (koId + ende) bleibt unverändert. */
  ergaenze(eintraege: readonly HalbwertszeitEintrag[]): Promise<void>;
}

function schluessel(e: Pick<HalbwertszeitEintrag, "koId" | "ende">): string {
  return `${e.koId}\u0000${e.ende}`;
}

export class InMemoryHalbwertszeitVerlauf implements HalbwertszeitVerlaufRepo {
  private readonly eintraege = new Map<string, HalbwertszeitEintrag>();

  alle(): Promise<HalbwertszeitEintrag[]> {
    return Promise.resolve([...this.eintraege.values()]);
  }

  ergaenze(eintraege: readonly HalbwertszeitEintrag[]): Promise<void> {
    for (const e of eintraege) {
      if (!this.eintraege.has(schluessel(e))) {
        this.eintraege.set(schluessel(e), { ...e });
      }
    }
    return Promise.resolve();
  }
}

export class PgHalbwertszeitVerlauf implements HalbwertszeitVerlaufRepo {
  constructor(private readonly pool: Pool) {}

  async alle(): Promise<HalbwertszeitEintrag[]> {
    const res = await this.pool.query<{
      ko_id: string;
      ende: string;
      kategorie: string;
      tage: number;
      erfasst: string;
    }>("SELECT ko_id, ende, kategorie, tage, erfasst FROM ko_halbwertszeit_beobachtungen");
    return res.rows.map((r) => ({
      koId: r.ko_id,
      ende: r.ende,
      kategorie: r.kategorie,
      tage: Number(r.tage),
      erfasst: r.erfasst,
    }));
  }

  async ergaenze(eintraege: readonly HalbwertszeitEintrag[]): Promise<void> {
    for (const e of eintraege) {
      await this.pool.query(
        "INSERT INTO ko_halbwertszeit_beobachtungen(ko_id, ende, kategorie, tage, erfasst) VALUES($1,$2,$3,$4,$5) ON CONFLICT (ko_id, ende) DO NOTHING",
        [e.koId, e.ende, e.kategorie, e.tage, e.erfasst],
      );
    }
  }
}

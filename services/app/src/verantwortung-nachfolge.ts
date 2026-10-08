// ================================================================================================
// NACHFOLGE BEI BEFRISTUNG — WER NEUE BEITRÄGE EINES BEFRISTETEN KONTOS VERANTWORTET.
// ================================================================================================
//
// Auftrag `produkt:20261007:ownership-uebergabe`, Nacharbeit 4 (Ben K5). Ein befristetes Konto mit
// Bearbeitungsrecht darf bis zum Fristablauf weiter Beiträge anlegen — das bestehende Recht bleibt.
// Trüge es dafür selbst die Hauptverantwortung (Rückfall auf den Autor), läge jeder dieser Beiträge
// nach dem Fristablauf bei einer inaktiven Person. Deshalb nennt jede Befristung eines solchen
// Kontos eine NACHFOLGE: ein aktives, unbefristetes Konto mit Bearbeitungsrecht. Neue Beiträge des
// befristeten Kontos tragen sie ab der Anlage als `ownership.owner`; die Autorschaft bleibt beim
// befristeten Konto (`build-app.ts`, `verantwortungBeiAnlage`).
//
// GESETZT wird die Nachfolge an den Kontowegen (`routes/verantwortung-routes.ts`,
// `kontoendeSperre`): ausdrücklich über `verantwortungNachfolge` im Rumpf, sonst die Kontoverwaltung,
// die die Befristung setzt. ENTFERNT wird sie, sobald das Konto nicht mehr befristet ist.
import type { Pool } from "pg";

export interface NachfolgeEintrag {
  /** Das befristete Konto. */
  konto: string;
  /** Wer die Hauptverantwortung für dessen neue Beiträge trägt. */
  nachfolger: string;
  gesetztVon: string;
  gesetztAm: string;
}

export interface NachfolgeRepo {
  lies(konto: string): Promise<NachfolgeEintrag | undefined>;
  setze(eintrag: NachfolgeEintrag): Promise<void>;
  entferne(konto: string): Promise<void>;
}

export class InMemoryNachfolgeRepo implements NachfolgeRepo {
  private readonly zeilen = new Map<string, NachfolgeEintrag>();

  lies(konto: string): Promise<NachfolgeEintrag | undefined> {
    const e = this.zeilen.get(konto);
    return Promise.resolve(e ? { ...e } : undefined);
  }

  setze(eintrag: NachfolgeEintrag): Promise<void> {
    this.zeilen.set(eintrag.konto, { ...eintrag });
    return Promise.resolve();
  }

  entferne(konto: string): Promise<void> {
    this.zeilen.delete(konto);
    return Promise.resolve();
  }
}

/** Additiv und wiederholbar: ein `CREATE TABLE IF NOT EXISTS`, kein Fremdschlüssel, kein Seed. */
export const VERANTWORTUNG_NACHFOLGE_SCHEMA = `
CREATE TABLE IF NOT EXISTS verantwortung_nachfolge (
  konto text PRIMARY KEY,
  nachfolger text NOT NULL,
  gesetzt_von text NOT NULL,
  gesetzt_am timestamptz NOT NULL
);
`;

interface NachfolgeZeile {
  konto: string;
  nachfolger: string;
  gesetzt_von: string;
  gesetzt_am: Date | string;
}

export class PgNachfolgeRepo implements NachfolgeRepo {
  constructor(private readonly pool: Pool) {}

  async lies(konto: string): Promise<NachfolgeEintrag | undefined> {
    const res = await this.pool.query<NachfolgeZeile>(
      "SELECT konto, nachfolger, gesetzt_von, gesetzt_am FROM verantwortung_nachfolge WHERE konto=$1",
      [konto],
    );
    const z = res.rows[0];
    if (!z) {
      return undefined;
    }
    return {
      konto: z.konto,
      nachfolger: z.nachfolger,
      gesetztVon: z.gesetzt_von,
      gesetztAm: new Date(z.gesetzt_am).toISOString(),
    };
  }

  async setze(e: NachfolgeEintrag): Promise<void> {
    await this.pool.query(
      `INSERT INTO verantwortung_nachfolge(konto, nachfolger, gesetzt_von, gesetzt_am)
       VALUES($1,$2,$3,$4)
       ON CONFLICT (konto) DO UPDATE
         SET nachfolger=EXCLUDED.nachfolger, gesetzt_von=EXCLUDED.gesetzt_von,
             gesetzt_am=EXCLUDED.gesetzt_am`,
      [e.konto, e.nachfolger, e.gesetztVon, e.gesetztAm],
    );
  }

  async entferne(konto: string): Promise<void> {
    await this.pool.query("DELETE FROM verantwortung_nachfolge WHERE konto=$1", [konto]);
  }
}

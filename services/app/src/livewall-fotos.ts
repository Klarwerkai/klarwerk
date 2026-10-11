import type { Pool } from "pg";

// ================================================================================================
// PMO-FEA-0003 — DAS FREIWILLIGE FOTO AUF DER LIVE-WAND.
// ================================================================================================
//
// „Eine freiwillige Live-Wand zeigt neues validiertes Wissen mit zugestimmtem Namen/Foto.
// Sichtrechte und Widerruf bleiben wirksam."
//
// DAS FOTO IST DIE ZUSTIMMUNG. Es gibt kein Foto, das ohne Erklärung der Person existiert: es
// entsteht ausschließlich dadurch, dass das Konto es SELBST hochlädt (`PUT /api/livewall/photo`),
// und es verschwindet, wenn das Konto widerruft (`DELETE /api/livewall/photo`). Der Widerruf
// LÖSCHT die Bilddaten — er setzt nicht nur einen Merker. Deshalb liegt das Bild hier und nicht im
// Prüfprotokoll: das Protokoll ist anhängend und könnte ein widerrufenes Bild nie mehr hergeben.
// Ins Protokoll gehen nur die beiden Ereignisse (ohne Bilddaten) als Nachweis.
//
// Sichtrechte: das Foto erscheint nur neben Einträgen des Zweigs `validated`, und der entsteht aus
// der bereits nach `sichtbareFuer` gefilterten Grundmenge (livewall-routes.ts). Eine eigene
// Bildroute für fremde Konten gibt es bewusst nicht.

export interface LiveWallFotoRepo {
  /** Die Fotos der genannten Konten — nur die, die eines hinterlegt haben. */
  lies(kontoIds: readonly string[]): Promise<Map<string, string>>;
  setze(kontoId: string, data: string, am: string): Promise<void>;
  /** Löscht die Bilddaten. Folgenlos, wenn keine da sind. */
  entferne(kontoId: string): Promise<void>;
}

// Nur Rasterbilder als Daten-URL — KEIN SVG (ein SVG kann Skript tragen). Die Grenze hält die
// Wand-Antwort klein, auch wenn sie im Beamer-Takt abgerufen wird: ein Porträt, kein Dokument.
export const LIVEWALL_FOTO_MAX_ZEICHEN = 200_000;
const FOTO_FORM = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export function istZulaessigesFoto(wert: unknown): wert is string {
  return (
    typeof wert === "string" && wert.length <= LIVEWALL_FOTO_MAX_ZEICHEN && FOTO_FORM.test(wert)
  );
}

export class InMemoryLiveWallFotoRepo implements LiveWallFotoRepo {
  private readonly fotos = new Map<string, string>();

  lies(kontoIds: readonly string[]): Promise<Map<string, string>> {
    const treffer = new Map<string, string>();
    for (const id of kontoIds) {
      const foto = this.fotos.get(id);
      if (foto) {
        treffer.set(id, foto);
      }
    }
    return Promise.resolve(treffer);
  }

  // `_am` gehört zum Vertrag (die Pg-Fassung speichert ihn); die Speicherfassung braucht ihn nicht.
  setze(kontoId: string, data: string, _am: string): Promise<void> {
    this.fotos.set(kontoId, data);
    return Promise.resolve();
  }

  entferne(kontoId: string): Promise<void> {
    this.fotos.delete(kontoId);
    return Promise.resolve();
  }
}

/**
 * Eine Zeile je Konto. REIN ADDITIV UND WIEDERHOLBAR: `CREATE TABLE IF NOT EXISTS`, kein DROP,
 * kein Fremdschlüssel, keine Extension, kein Seed.
 */
export const LIVEWALL_FOTO_SCHEMA = `
CREATE TABLE IF NOT EXISTS livewall_fotos (
  konto_id text PRIMARY KEY,
  data text NOT NULL,
  geaendert_am timestamptz NOT NULL
);
`;

export class PgLiveWallFotoRepo implements LiveWallFotoRepo {
  constructor(private readonly pool: Pool) {}

  async lies(kontoIds: readonly string[]): Promise<Map<string, string>> {
    if (kontoIds.length === 0) {
      return new Map();
    }
    const res = await this.pool.query<{ konto_id: string; data: string }>(
      "SELECT konto_id, data FROM livewall_fotos WHERE konto_id = ANY($1)",
      [[...kontoIds]],
    );
    return new Map(res.rows.map((z) => [z.konto_id, z.data]));
  }

  async setze(kontoId: string, data: string, am: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO livewall_fotos (konto_id, data, geaendert_am) VALUES ($1, $2, $3)
       ON CONFLICT (konto_id) DO UPDATE SET data = EXCLUDED.data, geaendert_am = EXCLUDED.geaendert_am`,
      [kontoId, data, am],
    );
  }

  async entferne(kontoId: string): Promise<void> {
    await this.pool.query("DELETE FROM livewall_fotos WHERE konto_id = $1", [kontoId]);
  }
}

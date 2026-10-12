import { MAX_AUSWERTUNG_LAEUFE, type ModelRunAuswertung, werteLaeufeAus } from "./auswertung";
import type { Preisliste } from "./preisliste";
import type { KiLaufLogzeile, ProtokollModelRunRepo } from "./protokoll-repo";
import type { ModelRunRepo } from "./repo";
import type { ModelRunRecord } from "./types";

// SCRUM-165: read-only Service über das ModelRun-Protokoll. Nur Lesen (recent) — kein
// Write/Delete/Replay. Limit defensiv normalisiert.
export const DEFAULT_MODEL_RUN_LIMIT = 50;
export const MAX_MODEL_RUN_LIMIT = 200;

export function normalizeModelRunLimit(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_MODEL_RUN_LIMIT;
  }
  return Math.min(Math.floor(limit), MAX_MODEL_RUN_LIMIT);
}

export interface ModelRunServiceDeps {
  repo: ModelRunRepo;
  // Aufnahme gesamt-ki-laufprotokoll: die hinterlegte Preisliste (oder ihr Lesefehler) — die
  // Auswertung nennt sie, damit „keine Kosten" als „keine Preisliste" lesbar ist.
  preisliste?: Preisliste | null;
  preislisteFehler?: string;
  // Der Schreibweg mit Kosten und Logzeile; `logAn` verbindet ihn mit der Logsenke der App.
  protokoll?: ProtokollModelRunRepo;
}

/** Was die Auswertung über die Preisgrundlage sagt (nie die Preise selbst). */
export interface ModelRunPreisgrundlage {
  hinterlegt: boolean;
  waehrung?: string;
  preisstand?: string;
  modelle?: number;
  fehler?: string;
}

export class ModelRunService {
  private readonly repo: ModelRunRepo;
  private readonly deps: ModelRunServiceDeps;

  constructor(deps: ModelRunServiceDeps) {
    this.repo = deps.repo;
    this.deps = deps;
  }

  /** Verbindet die strukturierte Logzeile `ki_lauf` mit einer Logsenke (einmal, beim App-Bau). */
  logAn(log: (zeile: KiLaufLogzeile) => void): void {
    this.deps.protokoll?.logAn(log);
  }

  preisgrundlage(): ModelRunPreisgrundlage {
    const p = this.deps.preisliste;
    if (p) {
      return {
        hinterlegt: true,
        waehrung: p.waehrung,
        preisstand: p.preisstand,
        modelle: Object.keys(p.modelle).length,
      };
    }
    return {
      hinterlegt: false,
      ...(this.deps.preislisteFehler ? { fehler: this.deps.preislisteFehler } : {}),
    };
  }

  // Betroffenenrechte (R-0663): alle Läufe, die diese Person angefragt hat — ohne Kappung, denn
  // eine Auskunft, die nach 200 Läufen abbricht, wäre unvollständig, ohne es zu sagen.
  vonAkteur(actor: string): Promise<ModelRunRecord[]> {
    if (this.repo.vonAkteur) {
      return this.repo.vonAkteur(actor);
    }
    return this.repo
      .recent(Number.MAX_SAFE_INTEGER)
      .then((alle) =>
        alle
          .filter((r) => actor.length > 0 && r.actor === actor)
          .sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
      );
  }

  // Jüngste ModelRuns (nur Metadaten). Limit defensiv: Default 50, Max 200, ungültig → Default.
  recent(limit?: number): Promise<ModelRunRecord[]> {
    return this.repo.recent(normalizeModelRunLimit(limit));
  }

  // Aufnahme gesamt-ki-laufprotokoll (V9, R-2071): Auswertung der Läufe mit Start in [von, bis).
  // Eine Grenze mehr als die Obergrenze wird gelesen, um `gekappt` ehrlich zu belegen.
  async auswertung(von: string, bis: string): Promise<ModelRunAuswertung> {
    const grenze = MAX_AUSWERTUNG_LAEUFE + 1;
    const laeufe = this.repo.zwischen
      ? await this.repo.zwischen(von, bis, grenze)
      : (await this.repo.recent(grenze)).filter((r) => r.startedAt >= von && r.startedAt < bis);
    const gekappt = laeufe.length > MAX_AUSWERTUNG_LAEUFE;
    return werteLaeufeAus(laeufe.slice(0, MAX_AUSWERTUNG_LAEUFE), von, bis, gekappt);
  }
}

import type { ModelRunRecord } from "./types";

// SCRUM-164: Persistenz-Schnittstelle des ModelRun-Protokolls. append-only; `recent`
// liefert die jüngsten Läufe (read-only Service-/Test-Vertrag).
export interface ModelRunRepo {
  append(record: ModelRunRecord): Promise<void>;
  recent(limit?: number): Promise<ModelRunRecord[]>;
  // Aufnahme gesamt-ki-laufprotokoll (R-2071/V9): Läufe mit Start in [von, bis), jüngste zuerst,
  // höchstens `limit`. Optional, damit schlanke Test-Attrappen gültig bleiben; die Auswertung
  // fällt ohne sie auf `recent` zurück (s. ModelRunService.auswertung).
  zwischen?(von: string, bis: string, limit: number): Promise<ModelRunRecord[]>;
  // Betroffenenrechte (R-0663): ALLE Läufe, die eine Person angefragt hat (`actor`), ältester
  // zuerst — für die Auskunft. Nur lesend. Optional wie `zwischen`; fehlt sie, meldet die Auskunft
  // den Bereich als „nicht abrufbar" statt als leer.
  vonAkteur?(actor: string): Promise<ModelRunRecord[]>;
}

export class InMemoryModelRunRepo implements ModelRunRepo {
  private readonly items: ModelRunRecord[] = [];

  append(record: ModelRunRecord): Promise<void> {
    this.items.push(record);
    return Promise.resolve();
  }

  recent(limit = 100): Promise<ModelRunRecord[]> {
    const sorted = [...this.items].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return Promise.resolve(sorted.slice(0, Math.max(0, limit)));
  }

  zwischen(von: string, bis: string, limit: number): Promise<ModelRunRecord[]> {
    const treffer = this.items
      .filter((r) => r.startedAt >= von && r.startedAt < bis)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return Promise.resolve(treffer.slice(0, Math.max(0, limit)));
  }

  vonAkteur(actor: string): Promise<ModelRunRecord[]> {
    if (actor.trim().length === 0) {
      return Promise.resolve([]);
    }
    return Promise.resolve(
      this.items
        .filter((r) => r.actor === actor)
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    );
  }
}

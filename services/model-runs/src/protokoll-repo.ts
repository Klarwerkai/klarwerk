import { type Preisliste, mitKosten } from "./preisliste";
import type { ModelRunRepo } from "./repo";
import type { ModelRunRecord } from "./types";

// ================================================================================================
// Aufnahme gesamt-ki-laufprotokoll (V9, R-2071, Ben R1 B3/B5) — DER SCHREIBWEG MIT KOSTEN UND LOG.
// ================================================================================================
//
// Ein Mantel um das eigentliche Protokoll-Repo, den die Kompositionswurzel einmal anlegt. Damit gilt
// für JEDEN Schreiber (Reasoner, künftige Wege) dasselbe, ohne dass einer es vergessen kann:
//   1. die Kosten werden aus Verbrauch × Preisliste berechnet und MIT dem Preisstand gespeichert;
//   2. nach dem Speichern geht eine strukturierte Logzeile `ki_lauf` an die Logsenke — dieselben
//      Metadaten wie der Datensatz, ohne Fehlertext, Anfragenden und Gegenstand (die gehören in das
//      zugriffsgeregelte Protokoll, nicht in jede Logablage).
// Die Logzeile darf das Schreiben nie scheitern lassen.

export interface KiLaufLogzeile {
  event: "ki_lauf";
  id: string;
  task: string;
  status: string;
  provider: string;
  model?: string;
  fallback: boolean;
  demo: boolean;
  dauerMs?: number;
  eingabeToken?: number;
  ausgabeToken?: number;
  kosten?: number;
  waehrung?: string;
  erzeugt?: string;
  // Ben R2 B5: Trace-Kennungen und Zahl der Versuche — so lässt sich die Logzeile der Anfrage
  // (requestId) und dem Trace (traceId) zuordnen.
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  requestId?: string;
  versuche?: number;
}

export function kiLaufLogzeile(lauf: ModelRunRecord): KiLaufLogzeile {
  const start = Date.parse(lauf.startedAt);
  const ende = Date.parse(lauf.finishedAt);
  const dauer = !Number.isNaN(start) && !Number.isNaN(ende) && ende >= start ? ende - start : null;
  return {
    event: "ki_lauf",
    id: lauf.id,
    task: lauf.task,
    status: lauf.status,
    provider: lauf.provider,
    ...(lauf.model ? { model: lauf.model } : {}),
    fallback: lauf.fallback,
    demo: lauf.demo,
    ...(dauer !== null ? { dauerMs: dauer } : {}),
    ...(lauf.verbrauch
      ? { eingabeToken: lauf.verbrauch.eingabeToken, ausgabeToken: lauf.verbrauch.ausgabeToken }
      : {}),
    ...(lauf.kosten ? { kosten: lauf.kosten.betrag, waehrung: lauf.kosten.waehrung } : {}),
    ...(lauf.erzeugt ? { erzeugt: `${lauf.erzeugt.anzahl} ${lauf.erzeugt.art}` } : {}),
    ...(lauf.trace
      ? {
          traceId: lauf.trace.traceId,
          spanId: lauf.trace.spanId,
          ...(lauf.trace.parentSpanId ? { parentSpanId: lauf.trace.parentSpanId } : {}),
          ...(lauf.trace.requestId ? { requestId: lauf.trace.requestId } : {}),
        }
      : {}),
    ...(lauf.versuche ? { versuche: lauf.versuche.length } : {}),
  };
}

export class ProtokollModelRunRepo implements ModelRunRepo {
  private log: ((zeile: KiLaufLogzeile) => void) | undefined;

  constructor(
    private readonly inner: ModelRunRepo,
    private readonly preisliste: Preisliste | null,
  ) {}

  /** Die Logsenke entsteht erst mit der App (Fastify-Logger) — deshalb nachträglich verbunden. */
  logAn(log: (zeile: KiLaufLogzeile) => void): void {
    this.log = log;
  }

  async append(record: ModelRunRecord): Promise<void> {
    const lauf = mitKosten(record, this.preisliste);
    await this.inner.append(lauf);
    try {
      this.log?.(kiLaufLogzeile(lauf));
    } catch {
      // Eine Logsenke darf den gespeicherten Lauf nicht rückwirkend scheitern lassen.
    }
  }

  recent(limit?: number): Promise<ModelRunRecord[]> {
    return this.inner.recent(limit);
  }

  zwischen(von: string, bis: string, limit: number): Promise<ModelRunRecord[]> {
    if (this.inner.zwischen) {
      return this.inner.zwischen(von, bis, limit);
    }
    return this.inner
      .recent(limit)
      .then((alle) => alle.filter((r) => r.startedAt >= von && r.startedAt < bis));
  }

  // Betroffenenrechte (R-0663): reicht den Leseweg je Person durch. Kennt die innere Ablage ihn
  // nicht, wird der ganze Bestand gelesen und gefiltert — vollständig statt gekappt.
  vonAkteur(actor: string): Promise<ModelRunRecord[]> {
    if (this.inner.vonAkteur) {
      return this.inner.vonAkteur(actor);
    }
    return this.inner
      .recent(Number.MAX_SAFE_INTEGER)
      .then((alle) =>
        alle
          .filter((r) => actor.length > 0 && r.actor === actor)
          .sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
      );
  }
}

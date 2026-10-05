import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import type { ModelRunTrace } from "./types";

// ================================================================================================
// Aufnahme gesamt-ki-laufprotokoll (R-2071, Ben R2 B5) — TRACING NACH W3C TRACE CONTEXT.
// ================================================================================================
//
// Die App öffnet je HTTP-Anfrage einen Trace-Kontext (`mitKiTrace`); jeder KI-Lauf, der darin
// entsteht, bekommt `traceId`, einen eigenen Span und den Span der Anfrage als Elternteil. Ein
// eingehender `traceparent`-Kopf wird übernommen, damit ein vorgelagertes System seinen Trace
// fortsetzen kann. Die Kennungen stehen im Laufdatensatz und in der Logzeile `ki_lauf`; damit ist
// ein Lauf von der Anfrage über die Versuche bis zur Logzeile verfolgbar — ohne zusätzlichen Dienst.
//
// `AsyncLocalStorage` trägt den Kontext entlang der asynchronen Aufrufkette genau einer Anfrage
// (dieselbe Begründung wie bei der Modellaufruf-Spur in `services/reasoner/src/model-concurrency.ts`).

export interface KiTraceKontext {
  traceId: string;
  /** Span der Anfrage — Elternteil jedes Laufs darin. */
  spanId: string;
  requestId?: string;
}

const kontext = new AsyncLocalStorage<KiTraceKontext>();

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;
const NUR_NULLEN = /^0+$/;

export function neueSpanId(): string {
  return randomBytes(8).toString("hex");
}

function neueTraceId(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Der Kontext einer Anfrage: Trace-Kennung aus einem gültigen `traceparent` übernommen (dessen
 * Span wird Elternteil), sonst neu. Ein ungültiger Kopf wird verworfen, nie teilweise übernommen.
 */
export function traceKontextAus(traceparent: unknown, requestId?: string): KiTraceKontext {
  const roh = typeof traceparent === "string" ? traceparent.trim().toLowerCase() : "";
  const treffer = TRACEPARENT.exec(roh);
  const traceId = treffer?.[1];
  const eltern = treffer?.[2];
  const gueltig =
    traceId !== undefined &&
    eltern !== undefined &&
    !NUR_NULLEN.test(traceId) &&
    !NUR_NULLEN.test(eltern);
  return {
    traceId: gueltig ? traceId : neueTraceId(),
    spanId: neueSpanId(),
    ...(requestId ? { requestId } : {}),
  };
}

/** Führt `fn` im Trace-Kontext einer Anfrage aus. */
export function mitKiTrace<T>(ctx: KiTraceKontext, fn: () => T): T {
  return kontext.run(ctx, fn);
}

/** Der Trace eines neuen Laufs: im Kontext einer Anfrage deren Trace, sonst ein eigener. */
export function traceFuerLauf(): ModelRunTrace {
  const ctx = kontext.getStore();
  if (!ctx) {
    return { traceId: neueTraceId(), spanId: neueSpanId() };
  }
  return {
    traceId: ctx.traceId,
    spanId: neueSpanId(),
    parentSpanId: ctx.spanId,
    ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
  };
}

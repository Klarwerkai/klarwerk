// Reine, DOM-freie Offline-Queue für mobiles Draft-Speichern (SCRUM-113 / FE-MOB-07).
// Nur create/update von Entwürfen werden gequeued (Payload klein, JSON-serialisierbar).
// Keine Persistenz/kein DOM hier — der Hook (useOfflineQueue) hängt localStorage + Events an.
import type { DraftPayload } from "../api/types";

// Ehrliche Stati: queued (lokal angelegt) → pending (Sync läuft) → synced | failed.
// "offline" ist kein Op-Status, sondern der Verbindungszustand (im Hook/UI).
export type QueueStatus = "queued" | "pending" | "synced" | "failed";

export interface QueuedOp {
  id: string; // lokale Op-ID (auch temporäre Draft-Kennung vor dem Sync)
  kind: "draft.create" | "draft.update";
  draftId: string | null; // bei update: Server-Draft-ID; bei create: null
  payload: DraftPayload;
  status: QueueStatus;
  error: string | null;
  createdAt: string;
  title: string; // Anzeigetitel für die Warteschlangen-Liste
}

export interface NewOp {
  id: string;
  kind: QueuedOp["kind"];
  draftId: string | null;
  payload: DraftPayload;
  title: string;
  createdAt: string;
}

export function enqueue(queue: readonly QueuedOp[], op: NewOp): QueuedOp[] {
  // Update auf einen bereits gequeueten, noch nicht synchronisierten Op desselben
  // Drafts ersetzt dessen Payload in place (kein doppelter Eintrag).
  if (op.kind === "draft.update" && op.draftId) {
    const idx = queue.findIndex(
      (q) => q.draftId === op.draftId && (q.status === "queued" || q.status === "failed"),
    );
    if (idx >= 0) {
      return queue.map((q, i) =>
        i === idx
          ? { ...q, payload: op.payload, title: op.title, status: "queued", error: null }
          : q,
      );
    }
  }
  return [
    ...queue,
    {
      id: op.id,
      kind: op.kind,
      draftId: op.draftId,
      payload: op.payload,
      status: "queued",
      error: null,
      createdAt: op.createdAt,
      title: op.title,
    },
  ];
}

export function replacePayload(
  queue: readonly QueuedOp[],
  id: string,
  payload: DraftPayload,
  title: string,
): QueuedOp[] {
  return queue.map((q) =>
    q.id === id && (q.status === "queued" || q.status === "failed")
      ? { ...q, payload, title, status: "queued", error: null }
      : q,
  );
}

export function markPending(queue: readonly QueuedOp[], id: string): QueuedOp[] {
  return queue.map((q) => (q.id === id ? { ...q, status: "pending", error: null } : q));
}

export function markSynced(queue: readonly QueuedOp[], id: string): QueuedOp[] {
  return queue.map((q) => (q.id === id ? { ...q, status: "synced", error: null } : q));
}

export function markFailed(queue: readonly QueuedOp[], id: string, error: string): QueuedOp[] {
  return queue.map((q) => (q.id === id ? { ...q, status: "failed", error } : q));
}

// Synchronisierte Ops aus der Warteschlange entfernen (nach erfolgreichem Sync).
export function clearSynced(queue: readonly QueuedOp[]): QueuedOp[] {
  return queue.filter((q) => q.status !== "synced");
}

// Ops, die (erneut) synchronisiert werden müssen: frisch gequeued oder zuvor fehlgeschlagen.
export function syncableOps(queue: readonly QueuedOp[]): QueuedOp[] {
  return queue.filter((q) => q.status === "queued" || q.status === "failed");
}

export function pendingCount(queue: readonly QueuedOp[]): number {
  return queue.filter((q) => q.status !== "synced").length;
}

export interface QueueCounts {
  queued: number;
  pending: number;
  failed: number;
  synced: number;
}

export function countByStatus(queue: readonly QueuedOp[]): QueueCounts {
  const counts: QueueCounts = { queued: 0, pending: 0, failed: 0, synced: 0 };
  for (const q of queue) {
    counts[q.status] += 1;
  }
  return counts;
}

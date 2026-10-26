// Reine, DOM-freie Offline-Queue für mobiles Draft-Speichern (SCRUM-113 / FE-MOB-07).
// Nur create/update von Entwürfen werden gequeued (Payload klein, JSON-serialisierbar).
// Keine Persistenz/kein DOM hier — der Hook (useOfflineQueue) hängt localStorage + Events an.
import type { DraftPayload } from "../api/types";

// Ehrliche Stati: queued (lokal angelegt) → pending (Sync läuft) → synced | failed.
// "offline" ist kein Op-Status, sondern der Verbindungszustand (im Hook/UI).
export type QueueStatus = "queued" | "pending" | "synced" | "failed";

// ================================================================================================
// JOB 4249 — DER VORGANG TRÄGT SEINEN EIGENTÜMER.
// ================================================================================================
//
// Bis hierher war die Warteschlange kontoblind: ein Vorgang wusste, WAS geschrieben werden soll,
// aber nicht, WER ihn angelegt hat. An einem geteilten Gerät ist das der Unterschied zwischen
// „meine Arbeit" und „die Arbeit eines anderen" — und ohne ihn ging der offline erfasste Entwurf
// von A nach einem Kontowechsel als B hinaus.
//
// DAS FELD IST OPTIONAL, und das ist kein Komfort, sondern die einzige ehrliche Abbildung des
// Bestands: Vorgänge aus Sitzungen VOR diesem Auftrag haben keinen Eigentümer. „Kein Feld" heisst
// UNBEKANNT — nicht „gehört dem, der gerade da ist". Wer es zum aktuellen Konto verrechnete,
// verschenkte fremde Arbeit; wer es löschte, warf sie weg. Beides ist verboten (s. `useOfflineQueue`).
export interface QueuedOp {
  id: string; // lokale Op-ID (auch temporäre Draft-Kennung vor dem Sync)
  kind: "draft.create" | "draft.update";
  draftId: string | null; // bei update: Server-Draft-ID; bei create: null
  payload: DraftPayload;
  status: QueueStatus;
  error: string | null;
  createdAt: string;
  title: string; // Anzeigetitel für die Warteschlangen-Liste
  /** JOB 4249: Kennung des Kontos, das diesen Vorgang angelegt hat. Fehlt bei Altbestand. */
  eigentuemer?: string;
}

export interface NewOp {
  id: string;
  kind: QueuedOp["kind"];
  draftId: string | null;
  payload: DraftPayload;
  title: string;
  createdAt: string;
  eigentuemer?: string;
}

/**
 * JOB 4249: Gehört dieser Vorgang dem genannten Konto? Ein Vorgang OHNE Eigentümer gehört
 * niemandem — `undefined === undefined` wäre hier die teuerste Gleichung des Hauses, deshalb
 * verlangt diese Funktion ein Konto als Text und vergleicht strikt.
 */
export function gehoertKonto(op: QueuedOp, konto: string): boolean {
  return op.eigentuemer === konto;
}

/** JOB 4249: Vorgänge ohne Eigentümerfeld — Altbestand, der niemandem zugeordnet werden darf. */
export function ohneEigentuemer(op: QueuedOp): boolean {
  return op.eigentuemer === undefined;
}

export function enqueue(queue: readonly QueuedOp[], op: NewOp): QueuedOp[] {
  // Update auf einen bereits gequeueten, noch nicht synchronisierten Op desselben
  // Drafts ersetzt dessen Payload in place (kein doppelter Eintrag).
  //
  // JOB 4249: UND DESSELBEN EIGENTÜMERS. Bis hierher entschied allein `draftId` — an einem
  // geteilten Gerät verschmolzen damit zwei Konten zu EINEM Eintrag: B speicherte denselben
  // Entwurf, und As wartende Nutzlast war stillschweigend überschrieben. Der Vergleich ist strikt
  // und deckt auch den Altbestand richtig ab: ein Vorgang ohne Eigentümer wird von einem Vorgang
  // MIT Eigentümer nie vereinnahmt.
  if (op.kind === "draft.update" && op.draftId) {
    const idx = queue.findIndex(
      (q) =>
        q.draftId === op.draftId &&
        q.eigentuemer === op.eigentuemer &&
        (q.status === "queued" || q.status === "failed"),
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
      // `exactOptionalPropertyTypes`: „Schlüssel fehlt" ist etwas anderes als „Schlüssel mit
      // undefined" — und genau daran hängt hier die Unterscheidung „ungebunden" / „gebunden".
      ...(op.eigentuemer !== undefined ? { eigentuemer: op.eigentuemer } : {}),
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

// F-0027 (JOB 2951 D2): Reste eines abgebrochenen Laufs beim NEUSTART wieder aufnehmen.
//
// `syncNow` setzt jeden Op vor dem Senden auf `pending`. Bricht der Lauf ab (Fenster zu, Absturz),
// steht `pending` im localStorage — und `syncableOps` nimmt bewusst nur `queued` und `failed`.
// Diese Enge ist RICHTIG, solange ein Send läuft: sie verhindert, dass derselbe Op ein zweites Mal
// gegriffen wird. Beim Neustart läuft aber kein Send mehr; ein dort vorgefundenes `pending` ist
// kein Zustand, sondern ein Rest. Ohne diese Wiederaufnahme war er DAUERHAFT unsynchronisierbar
// und wurde von `pendingCount` trotzdem weiter als offen gezählt — der Entwurf ging nie raus, und
// die Anzeige behauptete das Gegenteil. Deshalb hier und nicht in `syncableOps`: die Grenze
// verläuft am Neustart, nicht am Sync.
export function reviveInterrupted(queue: readonly QueuedOp[]): QueuedOp[] {
  return queue.map((q) => (q.status === "pending" ? { ...q, status: "queued", error: null } : q));
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

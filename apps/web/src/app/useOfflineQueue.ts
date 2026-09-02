// Dünner DOM-Hook über die reine offlineQueue-Logik (SCRUM-113 / FE-MOB-07).
// Persistenz: localStorage (kw.offlineQueue.v1). Sync ruft die ECHTEN Draft-Endpoints —
// keine Fake-Sync-Logik; Stati spiegeln das tatsächliche fetch-Ergebnis.
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import {
  type NewOp,
  type QueueCounts,
  type QueuedOp,
  clearSynced,
  countByStatus,
  enqueue as enqueueOp,
  markFailed,
  markPending,
  markSynced,
  pendingCount,
  reviveInterrupted,
  syncableOps,
} from "../lib/offlineQueue";

const STORAGE_KEY = "kw.offlineQueue.v1";

export interface SyncResult {
  synced: number;
  failed: number;
}

export interface OfflineQueueApi {
  online: boolean;
  queue: QueuedOp[];
  counts: QueueCounts;
  pending: number;
  syncing: boolean;
  enqueue: (op: NewOp) => void;
  syncNow: () => Promise<SyncResult>;
}

function load(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Was beim letzten Mal mitten im Senden abbrach, liegt hier als `pending`. Beim Neustart läuft
    // kein Send mehr — der Rest wird wieder aufgenommen, statt für immer liegenzubleiben (F-0027).
    return raw ? reviveInterrupted(JSON.parse(raw) as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

function errMsg(e: unknown): string {
  return e instanceof ApiError
    ? e.message
    : e instanceof Error
      ? e.message
      : "Sync fehlgeschlagen.";
}

export function useOfflineQueue(onSync?: (r: SyncResult) => void): OfflineQueueApi {
  const qc = useQueryClient();
  const [queue, setQueue] = useState<QueuedOp[]>(load);
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [syncing, setSyncing] = useState(false);

  // Refs für stabile, nicht-stale Zugriffe in Event-Handlern / Sync-Schleife.
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const syncingRef = useRef(false);
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // Persistenz best effort — Verlust nur bei vollem/blockiertem Storage.
    }
  }, [queue]);

  const enqueue = useCallback((op: NewOp) => {
    setQueue((q) => enqueueOp(q, op));
  }, []);

  const syncNow = useCallback(async (): Promise<SyncResult> => {
    if (syncingRef.current || typeof navigator === "undefined" || !navigator.onLine) {
      return { synced: 0, failed: 0 };
    }
    const ops = syncableOps(queueRef.current);
    if (ops.length === 0) {
      return { synced: 0, failed: 0 };
    }
    syncingRef.current = true;
    setSyncing(true);
    let synced = 0;
    let failed = 0;
    for (const op of ops) {
      setQueue((q) => markPending(q, op.id));
      try {
        if (op.kind === "draft.create") {
          await endpoints.drafts.create(op.payload);
        } else if (op.draftId) {
          await endpoints.drafts.update(op.draftId, op.payload);
        }
        setQueue((q) => markSynced(q, op.id));
        synced += 1;
      } catch (e) {
        setQueue((q) => markFailed(q, op.id, errMsg(e)));
        failed += 1;
      }
    }
    if (synced > 0) {
      setQueue((q) => clearSynced(q));
      void qc.invalidateQueries({ queryKey: ["drafts"] });
    }
    syncingRef.current = false;
    setSyncing(false);
    return { synced, failed };
  }, [qc]);

  // F-0027 (JOB 2951 D2): EIN Anlauf beim Aufbau.
  //
  // Wer im Büro die Anwendung öffnet, hat die Verbindung SCHON. `online` markiert nur den Übergang
  // und feuert deshalb nicht; `focus` feuert beim ersten Aufbau eines bereits fokussierten Fensters
  // ebenfalls nicht. Ohne diesen Anlauf blieb die aus dem localStorage wiederhergestellte
  // Warteschlange liegen, bis der Mensch zufällig das Fenster wechselte und zurückkam — genau der
  // Weg, den F-0027 verspricht („unterwegs an der Anlage erfassen, im Büro fertigmachen").
  //
  // GENAU EINMAL, über den Ref-Riegel: Startet die Anwendung offline und kommt die Verbindung kurz
  // darauf, darf dieser Anlauf nicht zusätzlich zum `online`-Ereignis feuern — sonst legt derselbe
  // Entwurf zwei Server-Einträge an. Kein neuer Synchronisationsweg: es ist dieselbe `syncNow`,
  // die die Ereignisse unten schon benutzen.
  const startAnlaufRef = useRef(false);
  useEffect(() => {
    if (startAnlaufRef.current) {
      return;
    }
    startAnlaufRef.current = true;
    if (typeof navigator === "undefined" || !navigator.onLine) {
      return;
    }
    if (syncableOps(queueRef.current).length === 0) {
      return;
    }
    void syncNow().then((r) => {
      if (r.synced > 0 || r.failed > 0) {
        onSyncRef.current?.(r);
      }
    });
  }, [syncNow]);

  useEffect(() => {
    const goOnline = (): void => {
      setOnline(true);
      void syncNow().then((r) => {
        if (r.synced > 0 || r.failed > 0) {
          onSyncRef.current?.(r);
        }
      });
    };
    const goOffline = (): void => setOnline(false);
    const onFocus = (): void => {
      if (navigator.onLine) {
        void syncNow().then((r) => {
          if (r.synced > 0 || r.failed > 0) {
            onSyncRef.current?.(r);
          }
        });
      }
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("focus", onFocus);
    };
  }, [syncNow]);

  return {
    online,
    queue,
    counts: countByStatus(queue),
    pending: pendingCount(queue),
    syncing,
    enqueue,
    syncNow,
  };
}

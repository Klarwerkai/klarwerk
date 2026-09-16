// Dünner DOM-Hook über die reine offlineQueue-Logik (SCRUM-113 / FE-MOB-07).
// Persistenz: localStorage (kw.offlineQueue.v1). Sync ruft die ECHTEN Draft-Endpoints —
// keine Fake-Sync-Logik; Stati spiegeln das tatsächliche fetch-Ergebnis.
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { DraftPayload } from "../api/types";
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
  replacePayload,
  reviveInterrupted,
  syncableOps,
} from "../lib/offlineQueue";

const STORAGE_KEY = "kw.offlineQueue.v1";

// ================================================================================================
// JOB 4193 — DER GESEHENE STAND REIST AUCH DURCH DIE WARTESCHLANGE.
// ================================================================================================
//
// DER BEFUND, den `Mobile.tsx:157-163` seit JOB 3377 selbst benannt hat: die Warteschlange kannte
// keinen Standvergleich. Ein offline bearbeiteter Entwurf ging beim Nachsenden nach dem alten
// Vertrag „letzter Schreiber gewinnt" raus — hat der Desktop inzwischen gespeichert, war seine
// Fassung danach still weg.
//
// DIE BAUFORM, und warum der Stand HIER wohnt und nicht in `lib/offlineQueue.ts`: der reine
// Warteschlangen-Vertrag (`QueuedOp`) beschreibt einen VORGANG mit seiner Nutzlast; der gesehene
// Stand ist keine Nutzlast, sondern die Voraussetzung, unter der dieser Vorgang gelten darf. Er
// wird deshalb hier, am einzigen Ort, der wirklich sendet, an den Vorgang geheftet und beim
// Senden als `expectedUpdatedAt` mitgegeben. Die reinen Funktionen dort bleiben unangetastet und
// tragen ihn durch, weil sie durchweg mit `{ ...q }` arbeiten — genau DAS ist in
// `tests/entwurf-mobil-desktop/standvergleich-mobil.test.ts` gepinnt, damit es nicht zufällig gilt.
//
// WAS DAS NICHT IST: eine zweite Konfliktlogik. Abgewiesen wird mit demselben 409 `DRAFT_STALE`
// der bestehenden Route (JOB 2684 D1); der Vorgang bleibt als `failed` in der Warteschlange
// stehen, und aufgelöst wird er dort, wo ein Mensch ist — beim Wiederöffnen des Entwurfs
// (`Mobile.tsx`). Still überschrieben wird nichts mehr.
export interface VorgangMitStand extends QueuedOp {
  /** Der beim Bearbeiten gesehene `Draft.updatedAt`. Fehlt bei `draft.create`. */
  seenUpdatedAt?: string;
}

export interface NeuerVorgang extends NewOp {
  seenUpdatedAt?: string;
}

export interface SyncResult {
  synced: number;
  failed: number;
  /**
   * Vom Server als VERALTET abgewiesen (409 `DRAFT_STALE`). Bewusst getrennt von `failed`
   * gezählt: „konnte nicht gesendet werden" und „durfte nicht überschreiben" sind zwei
   * verschiedene Nachrichten an den Menschen. Die Vorgänge liegen in beiden Fällen weiter in der
   * Warteschlange — verloren geht nichts.
   */
  stale: number;
  /**
   * JOB 4193 R5: Aktualisierungsvorgänge OHNE gesehenen Stand — Reste aus einer Sitzung vor diesem
   * Auftrag. Sie werden nicht gesendet (das wäre der alte, ungeschützte Weg) und nicht gelöscht;
   * sie bleiben liegen, bis der Entwurf geöffnet und verglichen wurde.
   */
  ohneVoraussetzung: number;
}

export interface OfflineQueueApi {
  online: boolean;
  queue: VorgangMitStand[];
  counts: QueueCounts;
  pending: number;
  syncing: boolean;
  enqueue: (op: NeuerVorgang) => void;
  /**
   * JOB 4193: die Entscheidung eines Menschen ERSETZT die liegende Nutzlast (samt dem Stand, gegen
   * den sie gelten soll). Sie löscht den Vorgang nie still — `replacePayload` (lib/offlineQueue.ts)
   * greift nur, solange er wartet oder gescheitert ist.
   */
  replace: (id: string, payload: DraftPayload, title: string, seenUpdatedAt?: string) => void;
  syncNow: () => Promise<SyncResult>;
}

/**
 * Den Stand vom Vorgang NEHMEN, statt ihn auf `undefined` zu setzen: unter
 * `exactOptionalPropertyTypes` ist „Schlüssel fehlt" etwas anderes als „Schlüssel mit
 * `undefined`", und beim Senden entscheidet genau das, ob ein Stand mitreist.
 */
function ohneStand({ seenUpdatedAt: _stand, ...rest }: VorgangMitStand): VorgangMitStand {
  return rest;
}

function mitStand(op: VorgangMitStand, seenUpdatedAt?: string): VorgangMitStand {
  return seenUpdatedAt ? { ...op, seenUpdatedAt } : ohneStand(op);
}

/**
 * Den Stand an den Vorgang heften, den `enqueue` (lib/offlineQueue.ts) soeben angelegt ODER
 * ersetzt hat. Die zweite Hälfte ist der Grund für diese Funktion: ein zweites Speichern desselben
 * Entwurfs ersetzt den vorhandenen Eintrag in place — sein Stand muss dann mitwandern, sonst
 * gälte für die neue Nutzlast noch die Voraussetzung der alten.
 *
 * JOB 4193 R5 (BEN Korrekturpflicht 1) — EIN VORHANDENER STAND WIRD NIE WEGGESTRICHEN.
 *
 * Bis hierher setzte ein zweites Speichern OHNE Stand den Eintrag auf `ohneStand` zurück. Das war
 * die zweite Hälfte des gemessenen Datenverlusts: der Vorgang lag danach ohne Voraussetzung in der
 * Warteschlange und ging beim Nachsenden nach „letzter Schreiber gewinnt" raus. Die Voraussetzung
 * gehört aber zum ENTWURF, nicht zum einzelnen Klick — ein weiteres Speichern kann sie nicht
 * verlieren, nur ERSETZEN. Kommt ein neuer Stand mit, gilt er; kommt keiner, bleibt der alte.
 */
function standNachfuehren(queue: readonly QueuedOp[], op: NeuerVorgang): VorgangMitStand[] {
  const ersetzt = op.kind === "draft.update" && op.draftId !== null;
  return queue.map((q) =>
    q.id === op.id || (ersetzt && q.draftId === op.draftId && q.status === "queued")
      ? mitStand(q, op.seenUpdatedAt ?? (q as VorgangMitStand).seenUpdatedAt)
      : q,
  );
}

function load(): VorgangMitStand[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Was beim letzten Mal mitten im Senden abbrach, liegt hier als `pending`. Beim Neustart läuft
    // kein Send mehr — der Rest wird wieder aufgenommen, statt für immer liegenzubleiben (F-0027).
    return raw ? reviveInterrupted(JSON.parse(raw) as VorgangMitStand[]) : [];
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
  const [queue, setQueue] = useState<VorgangMitStand[]>(load);
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

  const enqueue = useCallback((op: NeuerVorgang) => {
    setQueue((q) => standNachfuehren(enqueueOp(q, op), op));
  }, []);

  const replace = useCallback(
    (id: string, payload: DraftPayload, title: string, seenUpdatedAt?: string) => {
      setQueue((q) =>
        replacePayload(q, id, payload, title).map((o) =>
          o.id === id && o.status === "queued" ? mitStand(o, seenUpdatedAt) : o,
        ),
      );
    },
    [],
  );

  const syncNow = useCallback(async (): Promise<SyncResult> => {
    if (syncingRef.current || typeof navigator === "undefined" || !navigator.onLine) {
      return { synced: 0, failed: 0, stale: 0, ohneVoraussetzung: 0 };
    }
    const ops = syncableOps(queueRef.current) as VorgangMitStand[];
    if (ops.length === 0) {
      return { synced: 0, failed: 0, stale: 0, ohneVoraussetzung: 0 };
    }
    syncingRef.current = true;
    setSyncing(true);
    let synced = 0;
    let failed = 0;
    let stale = 0;
    let ohneVoraussetzung = 0;
    for (const op of ops) {
      // ==========================================================================================
      // JOB 4193 R5 (BEN Korrekturpflicht 2/7) — KEIN AKTUALISIEREN OHNE VORAUSSETZUNG.
      // ==========================================================================================
      //
      // Bis hierher stand hier: „ohne Stand bleibt es beim alten Weg". Genau das war der letzte
      // ungeschützte Schreibweg — ein Vorgang ohne Voraussetzung überschrieb beim Nachsenden jede
      // fremde Änderung still. Seit R5 trägt JEDER am Handy angelegte Aktualisierungsvorgang seinen
      // Stand (er reist aus dem Formular, s. `Mobile.tsx` `neuerVorgang`/`resume`); ohne Stand kann
      // nur noch ein Rest aus einer Sitzung VOR diesem Auftrag liegen.
      //
      // Der wird NICHT blind gesendet und auch NICHT gelöscht: er bleibt liegen und wird gemeldet.
      // Aufgelöst wird er dort, wo ein Mensch ist — beim Öffnen des Entwurfs, wo der Vergleich
      // stattfindet und die Voraussetzung nachgetragen wird. Ein Anlegen (`draft.create`) hat
      // naturgemäss keine Voraussetzung und bleibt unberührt.
      if (op.kind === "draft.update" && op.draftId && !op.seenUpdatedAt) {
        setQueue((q) => markFailed(q, op.id, "Kein gesehener Stand — Entwurf öffnen und prüfen."));
        ohneVoraussetzung += 1;
        continue;
      }
      setQueue((q) => markPending(q, op.id));
      try {
        if (op.kind === "draft.create") {
          await endpoints.drafts.create(op.payload);
        } else if (op.draftId) {
          await endpoints.drafts.update(op.draftId, op.payload, {
            expectedUpdatedAt: op.seenUpdatedAt as string,
          });
        }
        setQueue((q) => markSynced(q, op.id));
        synced += 1;
      } catch (e) {
        setQueue((q) => markFailed(q, op.id, errMsg(e)));
        if (e instanceof ApiError && e.status === 409 && e.code === "DRAFT_STALE") {
          stale += 1;
        } else {
          failed += 1;
        }
      }
    }
    if (synced > 0) {
      setQueue((q) => clearSynced(q));
      void qc.invalidateQueries({ queryKey: ["drafts"] });
    }
    syncingRef.current = false;
    setSyncing(false);
    return { synced, failed, stale, ohneVoraussetzung };
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
      if (r.synced > 0 || r.failed > 0 || r.stale > 0 || r.ohneVoraussetzung > 0) {
        onSyncRef.current?.(r);
      }
    });
  }, [syncNow]);

  useEffect(() => {
    const melde = (r: SyncResult): void => {
      if (r.synced > 0 || r.failed > 0 || r.stale > 0 || r.ohneVoraussetzung > 0) {
        onSyncRef.current?.(r);
      }
    };
    const goOnline = (): void => {
      setOnline(true);
      void syncNow().then(melde);
    };
    const goOffline = (): void => setOnline(false);
    const onFocus = (): void => {
      if (navigator.onLine) {
        void syncNow().then(melde);
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
    replace,
    syncNow,
  };
}

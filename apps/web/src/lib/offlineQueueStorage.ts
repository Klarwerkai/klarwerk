export const OFFLINE_QUEUE_KEY = "kw.offlineQueue.v1";
export const OFFLINE_PHOTO_PREFIX = "kw.offlinePhoto.v1:";
export const OFFLINE_QUEUE_EVENT = "kw-offline-queue";
const BILDQUELLE = /(<img\b[^>]*?\ssrc\s*=\s*)(["'])([^"']*)\2/gi;
const DATA = /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/;
interface Gespeichert {
  payload?: { bodyHtml?: string };
  offlineFotos?: Record<string, string>;
  [key: string]: unknown;
}
function gespeicherteQueue(): Gespeichert[] {
  const text = localStorage.getItem(OFFLINE_QUEUE_KEY);
  if (!text) return [];
  const queue: unknown = JSON.parse(text);
  if (!Array.isArray(queue) || queue.some((q) => typeof q !== "object" || q === null))
    throw new Error("Die Offline-Warteschlange konnte nicht gelesen werden.");
  return queue;
}
function bildquellen(row: Gespeichert, quelle: (src: string) => string): Gespeichert {
  if (typeof row.payload?.bodyHtml !== "string") return { ...row };
  return {
    ...row,
    payload: {
      ...row.payload,
      bodyHtml: row.payload.bodyHtml.replace(
        BILDQUELLE,
        (_all, prefix: string, quote: string, src: string) => prefix + quote + quelle(src) + quote,
      ),
    },
  };
}
export function readOfflineQueue<T>(): T[] {
  return gespeicherteQueue().map((row) => {
    const refs = row.offlineFotos ?? {};
    const hydrated = bildquellen(row, (src) => {
      const id = Object.hasOwn(refs, src) ? refs[src] : undefined;
      if (!id) return src;
      const value = localStorage.getItem(OFFLINE_PHOTO_PREFIX + id);
      if (value === null)
        throw new Error("Ein gespeichertes Offlinefoto fehlt. Bitte die Eingabe prüfen.");
      return value;
    });
    const { offlineFotos: _refs, ...operation } = hydrated;
    return operation as T;
  });
}
/** Fotos zuerst, danach ein atomarer Metadatencommit unter dem gemeinsamen Browserlock. */
export function writeOfflineQueue<T>(queue: readonly T[]): void {
  const reusable = new Map<string, string>();
  const oldIds = new Set<string>();
  for (const row of gespeicherteQueue())
    for (const id of Object.values(row.offlineFotos ?? {})) {
      oldIds.add(id);
      const value = localStorage.getItem(OFFLINE_PHOTO_PREFIX + id);
      if (value !== null) reusable.set(value, id);
    }
  const added: string[] = [];
  const used = new Set<string>();
  try {
    const stored = (queue as readonly Gespeichert[]).map((row) => {
      const refs: Record<string, string> = {};
      const next = bildquellen(row, (src) => {
        const previous =
          row.offlineFotos && Object.hasOwn(row.offlineFotos, src)
            ? row.offlineFotos[src]
            : undefined;
        if (previous) {
          refs[src] = previous;
          used.add(previous);
          return src;
        }
        if (!DATA.test(src)) return src;
        let id = reusable.get(src);
        if (!id) {
          id = crypto.randomUUID();
          localStorage.setItem(OFFLINE_PHOTO_PREFIX + id, src);
          added.push(id);
          reusable.set(src, id);
        }
        used.add(id);
        const reference = `kw-offline-photo:${id}`;
        refs[reference] = id;
        return reference;
      });
      const { offlineFotos: _old, ...operation } = next;
      return Object.keys(refs).length ? { ...operation, offlineFotos: refs } : operation;
    });
    if (queue.length === 0) localStorage.removeItem(OFFLINE_QUEUE_KEY);
    else localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(stored));
  } catch (e) {
    for (const id of added) localStorage.removeItem(OFFLINE_PHOTO_PREFIX + id);
    throw e;
  }
  for (const id of oldIds) if (!used.has(id)) localStorage.removeItem(OFFLINE_PHOTO_PREFIX + id);
}
export async function offlineExklusiv<T>(arbeit: () => T | Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks?.request)
    throw new Error(
      "Dieser Browser kann Offlineeingaben nicht sicher zwischen Fenstern speichern. Die Eingabe bleibt im Formular.",
    );
  return navigator.locks.request("kw.offlineQueue.v1", arbeit);
}
export function entferneOfflineKonto(konto: string): void {
  const queue = gespeicherteQueue();
  writeOfflineQueue(queue.filter((q) => q.eigentuemer !== konto && q.eigentuemer !== undefined));
  (globalThis as unknown as { dispatchEvent?: (e: Event) => boolean }).dispatchEvent?.(
    new Event(OFFLINE_QUEUE_EVENT),
  );
}

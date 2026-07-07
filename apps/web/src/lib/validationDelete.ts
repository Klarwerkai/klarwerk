import { ApiError } from "../api/client";

export function withoutKoById<T extends { id: string }>(
  items: T[] | undefined,
  id: string,
): T[] | undefined {
  if (!items) {
    return items;
  }
  return items.filter((item) => item.id !== id);
}

export function withoutKoIds<T extends { id: string }>(
  items: T[] | undefined,
  ids: ReadonlySet<string>,
): T[] | undefined {
  if (!items || ids.size === 0) {
    return items;
  }
  return items.filter((item) => !ids.has(item.id));
}

export function withDeletedKoId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (ids.has(id)) {
    return ids;
  }
  const next = new Set(ids);
  next.add(id);
  return next;
}

export function isStaleKoDeleteError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

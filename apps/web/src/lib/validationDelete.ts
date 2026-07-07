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

export function isStaleKoDeleteError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404 && error.code === "NOT_FOUND";
}

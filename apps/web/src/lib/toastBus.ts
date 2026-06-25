// Reine, DOM-freie Queue-/Reducer-Logik für den Toast-Bus (SCRUM-151 / FE-FND-04).
// Bewusst getrennt vom Notification-Feed (Konflikte/Lücken in der Topbar-Glocke).

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

export interface ToastState {
  toasts: Toast[];
}

export const EMPTY_TOASTS: ToastState = { toasts: [] };

// Maximal sichtbare Toasts gleichzeitig (älteste fallen raus).
export const MAX_TOASTS = 4;

export function addToast(state: ToastState, toast: Toast): ToastState {
  return { toasts: [...state.toasts, toast].slice(-MAX_TOASTS) };
}

export function removeToast(state: ToastState, id: string): ToastState {
  return { toasts: state.toasts.filter((t) => t.id !== id) };
}

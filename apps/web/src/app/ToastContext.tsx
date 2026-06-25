import { type ReactNode, createContext, useCallback, useContext, useReducer } from "react";
import {
  EMPTY_TOASTS,
  type Toast,
  type ToastKind,
  type ToastState,
  addToast,
  removeToast,
} from "../lib/toastBus";

// Wiederverwendbarer Toast-/Benachrichtigungs-Bus (FE-FND-04). Getrennt von der
// Notification-Glocke (Konflikte/Lücken). UI-Aktionen melden Erfolg/Fehler/Info.
type Action = { type: "add"; toast: Toast } | { type: "remove"; id: string };

function reducer(state: ToastState, action: Action): ToastState {
  return action.type === "add" ? addToast(state, action.toast) : removeToast(state, action.id);
}

interface ToastApi {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

// Toasts verschwinden automatisch nach dieser Zeit.
const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, EMPTY_TOASTS);

  const dismiss = useCallback((id: string) => dispatch({ type: "remove", id }), []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = crypto.randomUUID();
    dispatch({ type: "add", toast: { id, kind, message } });
    window.setTimeout(() => dispatch({ type: "remove", id }), AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastCtx.Provider value={{ toasts: state.toasts, push, dismiss }}>
      {children}
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    throw new Error("useToast muss innerhalb von <ToastProvider> verwendet werden.");
  }
  return ctx;
}

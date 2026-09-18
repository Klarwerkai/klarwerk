import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from "react";
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

// ================================================================================================
// JOB 4339 — WARUM DIE TIMER VERWAHRT WERDEN UND NICHT EINFACH LAUFEN.
// ================================================================================================
// Bis 18.09. setzte `push` seinen 4-Sekunden-Timer und vergass ihn. Folge: der Timer feuerte auch
// dann noch `dispatch`, wenn der Provider längst abgebaut war (Seitenwechsel der App-Wurzel,
// Test-Teardown), und ein weggeklickter Toast bekam vier Sekunden später ein zweites, sinnloses
// „remove" auf eine Kennung, die es nicht mehr gab. Gemessen hat es das Tor von JOB 4330 R2
// (18.09. 00:59): 2036 Testdateien grün, kein einziger roter Test — und trotzdem `Errors 1 error`,
// `ReferenceError: window is not defined ❯ Timeout._onTimeout ToastContext.tsx:38`.
// Die Map hält je Toast-Kennung ihren Timer; jeder der drei Wege (Ablauf, Wegklicken, Abbau) räumt
// seinen Eintrag wieder weg.
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, EMPTY_TOASTS);
  const timer = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const laufend = timer.current.get(id);
    if (laufend !== undefined) {
      window.clearTimeout(laufend);
      timer.current.delete(id);
    }
    dispatch({ type: "remove", id });
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = crypto.randomUUID();
    dispatch({ type: "add", toast: { id, kind, message } });
    const laufend = window.setTimeout(() => {
      timer.current.delete(id);
      dispatch({ type: "remove", id });
    }, AUTO_DISMISS_MS);
    timer.current.set(id, laufend);
  }, []);

  // Der Abbau räumt ALLE offenen Timer — auch die von Toasts, die `MAX_TOASTS` längst aus der
  // Anzeige verdrängt hat und deren Timer deshalb noch auf seine vier Sekunden wartet.
  // Die Map wird nie neu zugewiesen, das Festhalten hier ist also dieselbe Map wie beim Abbau.
  useEffect(() => {
    const offene = timer.current;
    return () => {
      for (const laufend of offene.values()) {
        window.clearTimeout(laufend);
      }
      offene.clear();
    };
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

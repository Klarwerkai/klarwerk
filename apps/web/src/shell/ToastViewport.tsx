import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "../app/ToastContext";
import type { ToastKind } from "../lib/toastBus";

// Zentraler Toast-Viewport (FE-FND-04), in der App-Shell gemountet.
const TONE: Record<ToastKind, string> = {
  success: "border-trust-pos-fill/30 bg-trust-pos-bg text-trust-pos-text",
  error: "border-trust-crit-fill/30 bg-trust-crit-bg text-trust-crit-text",
  info: "border-hairline bg-surface text-text",
};

export function ToastViewport(): JSX.Element | null {
  const { t } = useTranslation();
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) {
    return null;
  }
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <output
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-2 rounded-card border px-3 py-2.5 text-[13px] shadow-popover ${TONE[toast.kind]}`}
        >
          <span className="min-w-0 flex-1">{toast.message}</span>
          <button
            type="button"
            aria-label={t("toast.dismiss")}
            onClick={() => dismiss(toast.id)}
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </output>
      ))}
    </div>
  );
}

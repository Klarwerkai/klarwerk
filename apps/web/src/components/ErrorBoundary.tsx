import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

// Bug (Pedi 04.07.): Bisher blendete JEDER Render-Fehler die GANZE App weiß aus (keine Sidebar,
// keine Meldung) — z. B. die leere Admin-Seite. Diese Fehlergrenze fängt Render-Fehler ab und
// zeigt eine ehrliche Karte statt einer weißen Seite; das Detail geht in die Konsole (Diagnose).
// React verlangt für Fehlergrenzen eine Klassenkomponente.

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Für die Diagnose sichtbar in der Konsole — kein stiller Absturz.
    console.error("[KLARWERK] UI-Fehler abgefangen:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorCard error={this.state.error} />;
    }
    return this.props.children;
  }
}

function ErrorCard({ error }: { error: Error }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-card border border-trust-crit-fill/40 bg-trust-crit-bg p-5">
        <h2 className="text-[15px] font-semibold text-trust-crit-text">{t("error.title")}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-text">{t("error.body")}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 rounded-btn bg-ink px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90"
        >
          {t("error.reload")}
        </button>
        {/* Ehrliches Fehlerdetail — hilft beim Melden/Beheben (kein Stacktrace-Wall). */}
        <p className="mt-3 border-t border-trust-crit-fill/30 pt-2 font-mono text-[11px] text-muted-2">
          {t("error.detail")}: {error.message || error.name}
        </p>
      </div>
    </div>
  );
}

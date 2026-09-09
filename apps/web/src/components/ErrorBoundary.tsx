import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { isStaleChunkError } from "../lib/staleChunk";
import { NeueVersionAngebot } from "./VersionsHinweis";

// Bug (Pedi 04.07.): Bisher blendete JEDER Render-Fehler die GANZE App weiß aus (keine Sidebar,
// keine Meldung) — z. B. die leere Admin-Seite. Diese Fehlergrenze fängt Render-Fehler ab und
// zeigt eine ehrliche Karte statt einer weißen Seite; das Detail geht in die Konsole (Diagnose).
// React verlangt für Fehlergrenzen eine Klassenkomponente.
//
// ------------------------------------------------------------------------------------------------
// JOB 3390 · LADEFEHLER-ALTER-TAB — WARUM DIESE GRENZE JETZT ZWEI AUSGÄNGE HAT.
// ------------------------------------------------------------------------------------------------
//
// Pedi hatte die App seit Stunden offen, dazwischen wurde veröffentlicht, und der Klick auf
// „Verwaltung" lud die Seite erst in diesem Moment nach (`routes.tsx:82`, `:190`). Ihre
// Chunk-Adresse gab es nicht mehr. Hier stand daraufhin die rote Karte mit dem englischen
// Maschinensatz „Failed to fetch dynamically imported module …/assets/Admin-C0Y_KbY4.js" — richtig
// als Fehlermeldung, falsch als Auskunft: nichts ist kaputt, der Tab ist nur alt.
//
// EIN ERKENNER, KEINE ZWEITE ZEICHENKETTENSUCHE. Ob ein Fehler ein gescheiterter `import()` ist,
// beantwortet ausschliesslich `isStaleChunkError` aus `lib/staleChunk.ts` — dieselbe Stelle, die
// schon die Lese-Pfade (mammoth/pdfjs/fflate/tesseract) fragt. Ein zweiter Erkenner hier wäre eine
// zweite Wahrheit, die beim nächsten Browser-Wortlaut auseinanderliefe.
//
// DIE BENANNTE BLINDHEIT: ein `import()`, der wegen Funkloch oder Serverausfall scheitert, sieht für
// den Browser GENAUSO aus und bekommt hier denselben Satz. Das ist bewusst so — der Satz rät zum
// Neuladen, und Neuladen ist in diesen Fällen folgenlos: es wird nichts automatisch versucht, also
// entsteht keine Schleife und keine falsche Aussage über eine Auslieferung.
//
// ALLES ANDERE BLEIBT, WIE ES WAR: ein gewöhnlicher Programmfehler zeigt weiterhin die `ErrorCard`
// samt `error.detail`-Zeile mit dem echten Grund. Zwei Ausgänge, keine dritte Lage. Gemessen in
// `tests/ladefehler-alter-tab/ladefehler-zeigt-neue-version.test.tsx` (A1–A7).

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Für die Diagnose sichtbar in der Konsole — kein stiller Absturz.
    console.error("[KLARWERK] UI-Fehler abgefangen:", error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error) {
      // Ausgang 1: das Programmstück ist weg, weil der Tab alt ist — die ruhige Karte mit dem
      // vorhandenen Satz und geschütztem Neuladen (`components/VersionsHinweis.tsx`).
      if (isStaleChunkError(error)) {
        return <NeueVersionAngebot ort="ladefehler" />;
      }
      // Ausgang 2: alles andere — unverändert die ehrliche Fehlerkarte mit Detailzeile.
      return <ErrorCard error={error} />;
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

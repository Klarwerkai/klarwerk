// ================================================================================================
// AUFTRAG-BASIC-W2-RESULTAT-VIEW-KERN-23 — DER LAUFZUSTAND, EHRLICH BENANNT.
// ================================================================================================
//
// Der Zustand steht als TEXT da — Name und Bedeutung. Symbol und Farbe sind die zweite und dritte
// Spur, nie die einzige (Auftrag §6). Wer die Farben nicht unterscheiden kann, liest denselben
// Befund; wer nur die Farbe sieht, verwechselt „teilweise fehlgeschlagen" nicht mit „abgeschlossen".
//
// `PARTIAL` und `FAILED` erscheinen NIE als Erfolg (Auftrag §5). Diese Datei entscheidet das nicht
// selbst: sie zeigt, was `importRunStateView` aus dem Serverwert abgeleitet hat.
//
// ================================================================================================
// JOB 3357 — EINE ÜBERSCHRIFT-KENNUNG JE INSTANZ, NICHT EINE FÜR ALLE.
// ================================================================================================
//
// Bis hierher stand die Überschrift-Kennung (id sowie aria-labelledby) FEST in dieser Datei —
// beide Male derselbe Wert `w2-run-heading`. Das trug, solange es genau eine
// Lauf-Fläche gab. Seit JOB 3357 zeigt auch die Bilanz der Übernahme (`components/ImportGroups.tsx`)
// den Ausgang ihres Laufs über GENAU DIESEN Banner — und beide Flächen wohnen auf derselben Seite
// (`pages/Stufe2.tsx`: `<ImportRunPanel />` oben, weiter unten über
// `ImportExplore → ImportSelect → ImportGroups` die Bilanz).
//
// Zwei Abschnitte mit derselben `id` sind kein Schönheitsfehler: `aria-labelledby` löst dann für
// BEIDE auf die ERSTE Überschrift auf, und die zweite Fläche trägt eine fremde Beschriftung. Die
// Kennung kommt deshalb aus `useId()` — je Instanz eine eigene, ohne dass ein Aufrufer daran
// denken muss. `data-testid` bleibt unverändert; es ist keine Kennung und darf sich wiederholen.
import { AlertTriangle, CheckCircle2, Clock, HelpCircle, XCircle } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { ImportRunStateView, ImportRunTone } from "../../lib/importResultView";
import { cx } from "../ui";

export interface RunStateBannerProps {
  state: ImportRunStateView;
  /** Wörtlich aus dem Vertrag; kein Ersatztext, wenn er fehlt. */
  failureCode?: string | null;
  failureReason?: string | null;
}

// Nur bereits kontrastgepinnte Tokenpaare (tests/app/contrast-tokens-d5.test.ts, Topbar-Muster).
const TON: Record<ImportRunTone, string> = {
  neutral: "bg-trust-info-bg text-trust-info-text",
  running: "bg-trust-info-bg text-trust-info-text",
  ok: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  error: "bg-trust-crit-bg text-trust-crit-text",
};

/** Eigene FORM je Zustand — nicht fünfmal derselbe Punkt in fünf Farben. */
function Zeichen({ tone }: { tone: ImportRunTone }): JSX.Element {
  const gemeinsam = "h-4 w-4 shrink-0";
  if (tone === "running" || tone === "neutral") {
    return <Clock className={gemeinsam} aria-hidden="true" />;
  }
  if (tone === "ok") {
    return <CheckCircle2 className={gemeinsam} aria-hidden="true" />;
  }
  if (tone === "warn") {
    return <AlertTriangle className={gemeinsam} aria-hidden="true" />;
  }
  return <XCircle className={gemeinsam} aria-hidden="true" />;
}

export function RunStateBanner({
  state,
  failureCode,
  failureReason,
}: RunStateBannerProps): JSX.Element {
  const { t } = useTranslation();
  const ton = TON[state.tone] ?? TON.warn;
  // Je Instanz eigen (s. Kopf): zwei Banner auf einer Seite dürfen sich keine Kennung teilen.
  const ueberschriftId = useId();
  return (
    <section
      aria-labelledby={ueberschriftId}
      data-testid="w2-run"
      data-run-tone={state.tone}
      data-run-success={String(state.success)}
      data-run-running={String(state.running)}
      className={cx("rounded-card border border-hairline p-4", ton)}
    >
      <h2 id={ueberschriftId} className="sr-only">
        {t("w2.run.heading")}
      </h2>
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        {state.unknown ? (
          <HelpCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <Zeichen tone={state.tone} />
        )}
        <span data-testid="w2-run-label">{t(state.labelKey)}</span>
      </p>
      {/* Die Bedeutung, nicht nur der Name: was dieser Zustand fuer das Gezeigte heisst. */}
      <p data-testid="w2-run-hint" className="mt-1 text-[12.5px] leading-relaxed">
        {t(state.hintKey)}
      </p>
      {failureCode ? (
        <p data-testid="w2-run-failure-code" className="mt-2 break-words text-[12.5px]">
          <span className="font-medium">{t("w2.run.failureCode")}: </span>
          <span className="font-mono">{failureCode}</span>
        </p>
      ) : null}
      {failureReason ? (
        <p data-testid="w2-run-failure-reason" className="mt-1 break-words text-[12.5px]">
          <span className="font-medium">{t("w2.run.failureReason")}: </span>
          {failureReason}
        </p>
      ) : null}
    </section>
  );
}

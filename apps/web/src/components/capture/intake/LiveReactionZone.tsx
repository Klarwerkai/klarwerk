import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { LiveVerdict } from "../../../lib/intakeSimilarity";

// SCRUM-527 (WP2-Design): die „Das System denkt mit"-Zone — die Hauptattraktion, kein grauer Spinner.
// Sie reagiert sichtbar/lebendig auf den Entwurfstext: idle (hört zu), checking (ehrlicher Lauf-Zustand
// mit pulsierenden Punkten), new / similar / conflict. never block, only show honest status. Reine
// Präsentation: der Verdict kommt vom gekapselten Hook (useLiveKnowledgeCheck) bzw. im Test gemockt.
export function LiveReactionZone({ verdict }: { verdict: LiveVerdict }): JSX.Element {
  const { t } = useTranslation();

  // Lebendiger Lauf-Zustand: drei pulsierende Punkte statt totem Ladebalken.
  if (verdict.status === "checking") {
    return (
      <div className="flex items-center gap-2 rounded-card border border-ai/20 bg-ai/5 px-4 py-3 text-[13px] text-ai">
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ai [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ai [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ai [animation-delay:300ms]" />
        </span>
        <span>{t("intake.live.checking")}</span>
      </div>
    );
  }

  if (verdict.status === "new") {
    return (
      <div className="rounded-card border border-trust-pos-fill/30 bg-trust-pos-bg px-4 py-3 text-[13px] font-medium text-trust-pos-text">
        {t("intake.live.new")}
      </div>
    );
  }

  if (verdict.status === "similar") {
    return (
      <div className="rounded-card border border-hairline bg-surface px-4 py-3 text-[13px] text-text">
        <span className="text-muted">{t("intake.live.similarLead")}</span>{" "}
        {/* SCRUM-527 (Iteration 1): das bestehende KO in einem NEUEN TAB öffnen — der Entwurf im
            Erfassungsfeld geht so NICHT verloren, und /wissen/:id rendert regulär. */}
        <Link
          to={`/wissen/${verdict.match.koId}`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-ai hover:underline"
        >
          {verdict.match.title}
        </Link>
        <span className="ml-1.5 text-muted">{t("intake.live.similarAsk")}</span>
      </div>
    );
  }

  if (verdict.status === "conflict") {
    return (
      <div className="rounded-card border border-trust-crit-fill/30 bg-trust-crit-bg px-4 py-3 text-[13px] text-trust-crit-text">
        <span>{t("intake.live.conflictLead")}</span>{" "}
        <Link
          to={`/wissen/${verdict.match.koId}`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold underline hover:opacity-80"
        >
          {verdict.match.title}
        </Link>
      </div>
    );
  }

  // idle — ruhiges „hört zu", damit die Zone nie tot wirkt.
  return <div className="px-1 py-2 text-[12.5px] italic text-muted-2">{t("intake.live.idle")}</div>;
}

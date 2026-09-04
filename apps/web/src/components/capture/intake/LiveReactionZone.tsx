import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { KoStatus } from "../../../api/types";
import type { LiveVerdict } from "../../../lib/intakeSimilarity";
import { StatusPill } from "../../trust/StatusPill";

// JOB 3045: DIE FUNDORTZEILE — wo der Treffer liegt (Kategorie) und wie er dasteht (Zustand).
// Damit entscheidet ein Mensch beim Tippen „ergänzen oder neu?", ohne den fremden Eintrag erst in
// einem zweiten Tab zu öffnen.
//
// EHRLICHKEIT VOR OPTIK — die null-Regel des Serververtrags gilt SICHTBAR, nicht nur im Typ:
//   koCategory === null  → das Kategoriestück fehlt vollständig
//   koStatus   === null  → das Zustandsstück fehlt vollständig
//   beide null           → diese Zeile wird GAR NICHT gerendert
// In keinem dieser Fälle steht ein Platzhalter, kein „—", kein „unbekannt", kein „keine Kategorie".
//
// DAS ORTS-LABEL GEHÖRT ZUR KATEGORIE, NICHT ZUR ZEILE (JOB 3045 R2, Korrekturpflicht 1 von BEN).
// In Runde 2 stand das Label fest am Zeilenanfang. Bei `koCategory === null` und belegtem Zustand
// las die Fläche dann „Liegt in: Offen" (en „Sits in: Open") — der Zustand wurde als ORT
// beschriftet, also eine Aussage, die der Bestand nie gemacht hat. Label und Kategorie sind deshalb
// EIN Stück: fällt die Kategorie weg, fällt das Label mit. Der Zustand steht dann allein als
// `StatusPill` da — die im Produkt übliche, selbsterklärende Darstellung eines Zustands.
//
// Der Zustand wird von der BESTEHENDEN `StatusPill` beschriftet (sie übersetzt über
// `t("status.<wert>")`). Kein zweiter Statuswortschatz, keine eigene Ableitung — der rohe `KoStatus`
// reist bis hierher. Die Kategorie ist ein roher Bestandswert und wird unübersetzt gezeigt.
function Fundort({
  koStatus,
  koCategory,
}: {
  koStatus: KoStatus | null;
  koCategory: string | null;
}): JSX.Element | null {
  const { t } = useTranslation();
  if (koStatus === null && koCategory === null) {
    return null;
  }
  return (
    <div
      data-testid="live-fundort"
      className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted"
    >
      {koCategory === null ? null : (
        <>
          <span>{t("intake.live.fundort")}</span>
          <span className="font-medium">{koCategory}</span>
        </>
      )}
      {koStatus === null ? null : <StatusPill status={koStatus} />}
    </div>
  );
}

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
        <Fundort koStatus={verdict.match.koStatus} koCategory={verdict.match.koCategory} />
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
        <Fundort koStatus={verdict.match.koStatus} koCategory={verdict.match.koCategory} />
      </div>
    );
  }

  // G-2-EHRLICHKEIT (SCRUM-527): „pending" = nichts Ähnliches, aber Widerspruch NICHT geprüft. Neutral
  // (nicht das positive „neu"-Grün), damit nichts Unbelegtes behauptet wird.
  if (verdict.status === "pending") {
    return (
      <div className="rounded-card border border-hairline bg-surface px-4 py-3 text-[13px] text-muted">
        {t("intake.live.pending")}
      </div>
    );
  }

  // „unavailable" = die Prüfung ist fehlgeschlagen/nicht erreichbar — ehrlich sichtbar, nicht als „neu".
  if (verdict.status === "unavailable") {
    return (
      <div className="rounded-card border border-hairline bg-surface px-4 py-3 text-[13px] text-muted">
        {t("intake.live.unavailable")}
      </div>
    );
  }

  // idle — ruhiges „hört zu", damit die Zone nie tot wirkt.
  return <div className="px-1 py-2 text-[12.5px] italic text-muted-2">{t("intake.live.idle")}</div>;
}

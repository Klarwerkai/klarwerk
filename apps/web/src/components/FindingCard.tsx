// SCRUM-486 (nacht24 Paket 3): EINE ruhige Kern-Darstellung je Konflikt-/Duplikat-Befund —
// geteilt zwischen Konflikt- und Duplikate-Board. Kopfzeile: WAS (ehrlich benannt) + Erkennungsweg
// („mit KI" / „ohne KI (deterministisch)" / „manuell") + Befund-Status. Führungszeile: BEIDE
// Beiträge als klickbare Links (Route /wissen/:id) mit Status-Badge KONSISTENT zur Validierung
// (StatusPill/deriveStatus) → empfohlene Aktion. WARUM kompakt (Prozent + Begründung, nie Fake).
// Seiten-spezifische Details/Aktionen reichen die Boards als children darunter.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { KnowledgeObject } from "../api/types";
import { deriveStatus } from "../lib/displayStatus";
import type { FindingView } from "../lib/findingGroups";
import { StatusPill } from "./trust/StatusPill";

// Eine Befund-Seite: klickbarer Titel + Validierungs-Status-Badge; entfernte Beiträge ehrlich
// als neutraler Hinweis (nie die Roh-UUID).
export function FindingSideLink({ ko }: { ko: KnowledgeObject | null }): JSX.Element {
  const { t } = useTranslation();
  if (!ko) {
    return <span className="text-[13px] text-muted-2">{t("board.koRemoved")}</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 align-baseline">
      <Link
        to={`/wissen/${ko.id}`}
        className="text-[14px] font-semibold text-text underline-offset-2 hover:underline"
      >
        {ko.title}
      </Link>
      <StatusPill status={deriveStatus(ko)} />
    </span>
  );
}

export function FindingCard({
  view,
  a,
  b,
  statusLabel,
  children,
}: {
  view: FindingView;
  a: KnowledgeObject | null;
  b: KnowledgeObject | null;
  // Befund-eigener Statustext (con.status.* / dup.status.*) — von der jeweiligen Seite lokalisiert.
  statusLabel: string;
  children?: ReactNode;
}): JSX.Element {
  const { t } = useTranslation();
  const critical = view.kind === "konflikt";
  return (
    <div data-testid={`finding-${view.id}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {/* WAS — ehrlich benannt. */}
          <span
            className={`rounded-pill px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase ${
              critical ? "bg-trust-crit-bg text-trust-crit-text" : "bg-ai/10 text-ai"
            }`}
          >
            {t(view.kindLabelKey)}
          </span>
          {/* Erkennungsweg — „mit KI" nur bei echtem Modell-Fund mit Konfidenz. */}
          <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted-2">
            {t(view.wayLabelKey)}
          </span>
        </span>
        <span className="font-mono text-[11px] uppercase text-muted-2">{statusLabel}</span>
      </div>
      {/* Zwischen WELCHEN zwei Beiträgen (beide klickbar) → WELCHE Aktion. */}
      <p className="text-[14px] font-medium leading-snug text-text">
        <FindingSideLink ko={a} />
        <span className="mx-1.5 font-mono text-[11px] uppercase text-muted-2">
          {t("finding.versus")}
        </span>
        <FindingSideLink ko={b} />
        <span className="mx-1.5 text-muted-2" aria-hidden="true">
          →
        </span>
        <span className="text-text">{t(view.actionLabelKey)}</span>
      </p>
      {/* WARUM — kompakt und ehrlich (nur echte Werte, nie ein erfundener Beleg). */}
      {view.whyPercent !== undefined || view.whyRationale ? (
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          {view.whyPercent !== undefined ? (
            <span className="mr-1.5 font-mono font-semibold text-ai">{view.whyPercent} %</span>
          ) : null}
          {view.whyRationale ?? null}
        </p>
      ) : null}
      {children}
    </div>
  );
}

// Gruppen-Kopfzeile „je Beitrag": Titel als klickbarer Link + Validierungs-Status + Befund-Zähler.
export function FindingGroupHeader({
  ko,
  count,
}: {
  ko: KnowledgeObject | null;
  count: number;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-2">
        {t("finding.groupKicker")}
      </span>
      <FindingSideLink ko={ko} />
      <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10.5px] font-semibold text-muted">
        {t("finding.groupCount", { n: count })}
      </span>
    </div>
  );
}

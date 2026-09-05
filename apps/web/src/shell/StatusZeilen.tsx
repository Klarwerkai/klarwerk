import { useTranslation } from "react-i18next";
import { useExternalPolicy, useReasonerConfig, useReasonerStatus } from "../api/hooks";
import { useRole } from "../app/RoleContext";
import { externalStagePill } from "../lib/externalStagePill";
import { kiHeaderStatus, kiHeaderStatusFromPublic } from "../lib/kiHeaderStatus";
import { reasonerReachabilityBadge } from "../lib/reasonerReachability";
import { MenueKopf, MenueZeile } from "./Menue";

// ================================================================================================
// JOB 3060 · H1 — DIE DREI ADMIN-STATUSPILLEN WERDEN ZEILEN IM ZAHNRAD-MENÜ.
// ================================================================================================
//
// „KI-Modus" · „Reasoner" · „Extern" standen als Pillen in der Kopfzeile (Topbar.tsx, mega38 H:
// nur für Admins). Dieselben Hooks, dieselben Ableitungen, dieselben Klartext-Tooltips — nur der
// ORT ist neu: Zeilen unter „Status" im Zahnrad-Menü, jede ein Link nach /admin (über den
// Ungespeichert-Wächter, mega39 B). Der Punkt vor dem Text trägt die Ampel wie zuvor.

// PAKET 2 (D-AISTATE, Pedi 23.07.): „aktiv/grün" NUR bei echter Erreichbarkeit (zuletzt geantwortet),
// nicht mehr bei bloßer Konfiguration. Zustände: aktiv (grün) · ungeprüft (gelb) · nicht erreichbar
// (rot) · nicht verfügbar (grau) — abgeleitet aus dem gecachten Server-Erreichbarkeits-Signal.
const REACHABILITY_DOT: Record<"pos" | "warn" | "crit" | "neutral", string> = {
  pos: "bg-trust-pos-fill",
  warn: "bg-trust-warn-fill",
  crit: "bg-trust-crit-fill",
  neutral: "bg-muted-2",
};

function Punkt({ klasse }: { klasse: string }): JSX.Element {
  return <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${klasse}`} />;
}

function ReasonerStatusZeile(): JSX.Element {
  const { t } = useTranslation();
  const { data } = useReasonerStatus();
  const badge = reasonerReachabilityBadge(data);
  return (
    <MenueZeile
      to="/admin"
      title={`${t("topbar.plain.reasoner")} — ${t(badge.hintKey)}`}
      testid="status-reasoner"
    >
      <span className="inline-flex items-center gap-2">
        <Punkt klasse={REACHABILITY_DOT[badge.tone]} />
        {t(badge.labelKey)}
      </span>
    </MenueZeile>
  );
}

// PAKET 2 (D-AISTATE, Pedi 23.07.): Achse 1 — externe Wissensabfrage (Web-Suche) als EIGENE Zeile,
// klar getrennt vom Reasoner (Achse 2, KI-Modell). Der Tooltip erklärt den Unterschied.
function ExternalStageZeile(): JSX.Element | null {
  const { t } = useTranslation();
  const { data } = useExternalPolicy();
  if (!data) {
    return null;
  }
  const pill = externalStagePill(data.stage);
  return (
    <MenueZeile
      to="/admin"
      title={`${t("topbar.plain.external")} — ${t(pill.hintKey)}`}
      testid="status-extern"
    >
      <span className="inline-flex items-center gap-2">
        <Punkt klasse={REACHABILITY_DOT[pill.tone]} />
        {t(pill.labelKey)}
      </span>
    </MenueZeile>
  );
}

// Pedi 05.07.: „In welcher KI bin ich — und was ist der DSGVO-Status?" — ehrliche Auskunft mit
// Herkunftsland. DSGVO-Bestätigung IMMER „nein", außer interne KI aus Europa (dann grün).
function KiModeZeile(): JSX.Element {
  const { t } = useTranslation();
  // WP-VIP2-GATE-2 (bens Fix 3): /api/reasoner/config ist echte Admin-Sicht (users.manage).
  const { role } = useRole();
  const config = useReasonerConfig(role === "admin");
  const publicStatus = useReasonerStatus();
  // Nur eine VOLLSTÄNDIGE Konfiguration (mit Aufgabenliste) trägt die Admin-Auskunft; eine leere
  // oder fremde Antwort fällt auf den öffentlichen Status zurück statt die Hülle zu reißen.
  const vollstaendig =
    config.data !== undefined &&
    config.data !== null &&
    Array.isArray((config.data as { tasks?: unknown }).tasks);
  const status = vollstaendig
    ? kiHeaderStatus(config.data)
    : kiHeaderStatusFromPublic(publicStatus.data);
  const ok = status.dsgvoConfirm;
  const neutral = status.mode === "none";
  // B2: die Zeile zeigt nur den MODUS; Herkunft + DSGVO-Status stehen im Tooltip — die
  // Ehrlichkeit bleibt vollständig.
  const detailLine =
    status.countryKey && status.dsgvoKey ? `${t(status.countryKey)} · ${t(status.dsgvoKey)}` : null;
  // AUFTRAG-mega38 BLOCK H: der Klartextsatz steht VORNE.
  const tooltip = [t("topbar.plain.ki"), t(status.hintKey), status.detail, detailLine]
    .filter(Boolean)
    .join(" — ");
  return (
    <MenueZeile to="/admin" title={tooltip} testid="status-ki">
      <span className="inline-flex items-center gap-2">
        <Punkt klasse={neutral ? "bg-muted-2" : ok ? "bg-trust-pos-fill" : "bg-trust-warn-fill"} />
        {t(status.labelKey)}
        {status.subtitleKey ? (
          <span className="text-muted-2">· {t(status.subtitleKey)}</span>
        ) : null}
      </span>
    </MenueZeile>
  );
}

/** Die Gruppe „Status" — nur für Admins gemountet (mega38 H), Ziel jeder Zeile ist /admin. */
export function StatusZeilen(): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      <MenueKopf>{t("menue.status")}</MenueKopf>
      <KiModeZeile />
      <ReasonerStatusZeile />
      <ExternalStageZeile />
    </>
  );
}

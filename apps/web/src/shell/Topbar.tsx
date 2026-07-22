import { useQueryClient } from "@tanstack/react-query";
import { Bell, HelpCircle, Search, Smartphone } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { useNotifications, useReasonerConfig, useReasonerStatus } from "../api/hooks";
import { useNavGuard } from "../app/NavGuardContext";
import { useRole } from "../app/RoleContext";
import { kiHeaderStatus, kiHeaderStatusFromPublic } from "../lib/kiHeaderStatus";
import { notificationTarget } from "../lib/notificationTarget";
import { APP_VERSION } from "../version";
import { readIslandMarker } from "./islandMarker";

function LangPill(): JSX.Element {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("en") ? "en" : i18n.language.startsWith("nl") ? "nl" : "de";
  return (
    <div className="flex overflow-hidden rounded-pill border border-hairline text-[12px] font-semibold">
      {(["de", "en", "nl"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => void i18n.changeLanguage(l)}
          className={`px-2.5 py-1 uppercase transition-colors ${
            lang === l ? "bg-ink text-white" : "text-muted hover:text-text"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function NotificationBell(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  // SCRUM-220 → Audit-P3 (SCRUM-397): Gelesen-Status jetzt serverseitig (POST
  // /api/notifications/seen, pro Nutzer, überlebt Neustart). Der lokale Satz bleibt
  // als sofortige UI-Rückmeldung, bis der nächste Fetch das seen-Feld liefert.
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const { data } = useNotifications();
  const items = data ?? [];
  const isRead = (n: (typeof items)[number]): boolean => n.seen === true || readIds.has(n.id);
  const unreadCount = items.filter((n) => !isRead(n)).length;

  // Bewusstes Als-gesehen: erst der Server-Erfolg zählt; lokal nur als Sofort-Optik.
  const persistSeen = (ids: string[]): void => {
    if (ids.length === 0) {
      return;
    }
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        next.add(id);
      }
      return next;
    });
    void endpoints.notifications
      .markSeen(ids)
      .then(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }));
  };
  const markRead = (id: string): void => persistSeen([id]);
  const markAll = (): void => persistSeen(items.filter((n) => !isRead(n)).map((n) => n.id));
  // Audit-P3: Öffnen des Panels ist die bewusste Kenntnisnahme — alles Sichtbare wird gesehen.
  const toggleOpen = (): void => {
    setOpen((v) => {
      if (!v) {
        persistSeen(items.filter((n) => !isRead(n)).map((n) => n.id));
      }
      return !v;
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative grid h-9 w-9 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
        aria-label={t("topbar.notifications")}
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 font-mono text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-20 w-80 rounded-card border border-hairline bg-surface p-3 shadow-popover">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-2">
              {t("topbar.notifications")}
            </span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAll}
                className="text-[11px] font-semibold text-ai hover:opacity-80"
              >
                {t("topbar.notifMarkAll")}
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="py-3 text-[13px] text-muted">{t("topbar.notificationsEmpty")}</p>
          ) : (
            <ul className="space-y-0.5">
              {items.slice(0, 8).map((n) => {
                const read = isRead(n);
                const target = notificationTarget(n);
                const openTarget = (): void => {
                  markRead(n.id);
                  setOpen(false);
                  if (target) {
                    navigate(target);
                  }
                };
                return (
                  <li
                    key={n.id}
                    className={`flex items-start gap-2 rounded-btn px-1.5 py-1.5 ${
                      read ? "opacity-50" : ""
                    }`}
                  >
                    <span
                      className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                        read
                          ? "bg-hairline"
                          : n.kind === "conflict"
                            ? "bg-trust-crit-fill"
                            : n.kind === "duplicate"
                              ? "bg-ai"
                              : n.kind === "assignment"
                                ? "bg-ai"
                                : n.kind === "impact"
                                  ? "bg-trust-pos-fill"
                                  : "bg-trust-info-text"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={openTarget}
                      className="min-w-0 flex-1 truncate text-left text-[13px] text-text hover:text-ai"
                      title={target ? t("topbar.notifOpen") : undefined}
                    >
                      {/* SCRUM-363: ruhige „Dir ist Review-Arbeit zugewiesen"-Kennzeichnung. */}
                      {n.kind === "assignment" ? (
                        <span className="font-semibold text-ai">
                          {t("topbar.notifAssignment")}:{" "}
                        </span>
                      ) : null}
                      {/* PMO-FEA-0002: wertschätzende, unaufdringliche Wirkungs-Rückmeldung. */}
                      {n.kind === "impact" ? (
                        <span className="font-semibold text-trust-pos-text">
                          {t("topbar.notifImpact")}:{" "}
                        </span>
                      ) : null}
                      {/* Pedi 04.07.: Duplikat-Fund klar als solcher gekennzeichnet. */}
                      {n.kind === "duplicate" ? (
                        <span className="font-semibold text-ai">
                          {t("topbar.notifDuplicate")}:{" "}
                        </span>
                      ) : null}
                      {n.title}
                    </button>
                    {read ? null : (
                      <button
                        type="button"
                        onClick={() => markRead(n.id)}
                        className="shrink-0 rounded-btn px-1 text-[11px] font-semibold text-muted-2 hover:text-text"
                        title={t("topbar.notifMarkRead")}
                      >
                        ✓
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ReasonerStatusPill(): JSX.Element {
  const { t } = useTranslation();
  const { data } = useReasonerStatus();
  const active = data?.active ?? false;
  return (
    <div
      className={`flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold ${
        active ? "bg-trust-pos-bg text-trust-pos-text" : "bg-page text-muted"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-trust-pos-fill" : "bg-muted-2"}`} />
      {active ? t("topbar.reasonerActive") : t("topbar.reasonerOffline")}
    </div>
  );
}

// Pedi 05.07.: „In welcher KI bin ich — und was ist der DSGVO-Status?" — ehrliche Header-Pille
// mit Herkunftsland. DSGVO-Bestätigung IMMER „nein", außer interne KI aus Europa (dann grün).
// Herkunft interimsweise aus der Anbieter-Kennung; später übermittelt sie Nerds zentrale
// KI-Zugangs-Steuerung. Deterministisch ist ein neutraler Ersatzmodus und keine interne KI.
function KiModePill(): JSX.Element {
  const { t } = useTranslation();
  // WP-VIP2-GATE-2 (bens Fix 3): /api/reasoner/config ist jetzt echte Admin-Sicht (users.manage).
  // Nicht-Admins bekommen die ehrliche Pille aus dem OEFFENTLICHEN abstrahierten Status
  // (active+mode) — ohne Modellname/Herkunft (die bleiben Admin-Detail); die Query auf config
  // wird fuer sie gar nicht erst gestellt (kein 403-Rauschen).
  const { role } = useRole();
  const config = useReasonerConfig(role === "admin");
  const publicStatus = useReasonerStatus();
  const status = config.data
    ? kiHeaderStatus(config.data)
    : kiHeaderStatusFromPublic(publicStatus.data);
  const ok = status.dsgvoConfirm;
  const neutral = status.mode === "none";
  // B2: Die Pille zeigt nur noch den MODUS (z. B. „KI-Modus: Cloud"), nicht mehr das grelle
  // „· USA · DSGVO: nein". Herkunft + DSGVO-Status wandern in den Tooltip — die Ehrlichkeit bleibt
  // vollständig (der Hinweistext nennt DSGVO ohnehin klar; hier zusätzlich als crisp Detail-Zeile).
  const detailLine =
    status.countryKey && status.dsgvoKey ? `${t(status.countryKey)} · ${t(status.dsgvoKey)}` : null;
  const tooltip = [t(status.hintKey), status.detail, detailLine].filter(Boolean).join(" — ");
  return (
    <div
      className={`flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold ${
        neutral
          ? "bg-page text-muted"
          : ok
            ? "bg-trust-pos-bg text-trust-pos-text"
            : "bg-trust-warn-bg text-trust-warn-text"
      }`}
      title={tooltip}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          neutral ? "bg-muted-2" : ok ? "bg-trust-pos-fill" : "bg-trust-warn-fill"
        }`}
      />
      {t(status.labelKey)}
      {/* Nur der neutrale „Keine KI"-Modus trägt noch einen sachlichen Untertitel (Ersatzmodus). */}
      {status.subtitleKey ? (
        <span className="font-normal opacity-80">· {t(status.subtitleKey)}</span>
      ) : null}
    </div>
  );
}

function IslandMarkerPill({ marker }: { marker: string }): JSX.Element {
  return (
    <span
      id="klarwerk-island-marker"
      className="min-w-0 max-w-[18rem] truncate rounded-pill border border-hairline bg-page px-2 py-0.5 font-mono text-[10.5px] text-muted-2"
      title={marker}
    >
      {marker}
    </span>
  );
}

export function Topbar(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  // WP-SAMMEL20-FIX (bens Fix 4, B1b): der Wechsel zu /mobile ist eine normale In-App-Navigation —
  // er läuft durch den NavGuard (ungespeicherte Eingaben → Bestätigungsdialog, wie Sidebar/Palette)
  // und merkt sich die AKTUELLE Route als Absprungpunkt, damit der Rückweg dorthin zurückführt.
  const { guard } = useNavGuard();
  const [q, setQ] = useState("");
  const [islandMarker] = useState(() => readIslandMarker());

  const submitSearch = (e: FormEvent): void => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/bibliothek?q=${encodeURIComponent(term)}` : "/bibliothek");
  };

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-hairline bg-surface px-5">
      <form
        onSubmit={submitSearch}
        className="flex h-9 min-w-0 max-w-md flex-1 items-center gap-2 rounded-input border border-hairline bg-page px-3 text-muted focus-within:border-ink/30"
      >
        <button
          type="submit"
          aria-label={t("topbar.search")}
          className="grid place-items-center text-muted hover:text-text"
        >
          <Search size={16} />
        </button>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("topbar.search")}
          className="w-full bg-transparent text-[13px] text-text outline-none placeholder:text-muted-2"
        />
        <button
          type="button"
          aria-label={t("cmd.open")}
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          className="hidden shrink-0 rounded border border-hairline px-1.5 font-mono text-[11px] text-muted-2 hover:text-text sm:block"
        >
          ⌘K
        </button>
      </form>

      {/* B1: das Such-Formular (min-w-0, flex-1) gibt bei Enge ZUERST nach — es überlagert den
          rechten Block nicht. WP-SAMMEL20-FIX (bens Fix 5, Viewport-Kante): ist die Suche am
          Minimum, darf der rechte Block bei SEHR schmalen Breiten selbst schrumpfen (min-w-0,
          shrink) statt aus dem Header zu laufen; overflow-hidden kappt sauber, die Pillen
          (Island-Marker) truncaten wie üblich. */}
      <div className="ml-auto flex min-w-0 shrink items-center justify-end gap-2 overflow-hidden">
        <button
          type="button"
          onClick={() =>
            guard(() =>
              navigate("/mobile", {
                state: { from: `${location.pathname}${location.search}` },
              }),
            )
          }
          className="flex shrink-0 items-center gap-1.5 rounded-btn border border-hairline px-2.5 py-1.5 text-[12px] font-medium text-muted hover:text-text"
        >
          <Smartphone size={15} />
          {t("topbar.mobile")}
        </button>
        <button
          type="button"
          onClick={() => navigate("/hilfe")}
          className="grid h-9 w-9 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
          aria-label={t("nav.help")}
        >
          <HelpCircle size={18} />
        </button>
        <LangPill />
        <NotificationBell />
        <KiModePill />
        <ReasonerStatusPill />
        {islandMarker ? <IslandMarkerPill marker={islandMarker} /> : null}
        {/* Beta-Phase: sichtbare Versionsnummer oben rechts (Pedi, 02.07.2026). */}
        <span
          className="rounded-pill border border-hairline px-2 py-0.5 font-mono text-[10.5px] text-muted-2"
          title="App-Version (Beta-Phase)"
        >
          v{APP_VERSION}
        </span>
      </div>
    </header>
  );
}

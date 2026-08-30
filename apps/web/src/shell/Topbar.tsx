import { useQueryClient } from "@tanstack/react-query";
import { Bell, HelpCircle, Menu, Search, Smartphone } from "lucide-react";
import { type FormEvent, type Ref, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import {
  useExternalPolicy,
  useNotifications,
  useReasonerConfig,
  useReasonerStatus,
} from "../api/hooks";
// AUFTRAG-mega11 Block B-2 (bens SB-2): die Topbar hatte DREI ungeschützte Ausgänge
// (Benachrichtigungsziel, Suche, Hilfe) neben einem geschützten (Mobil-Umschalter). Alle vier laufen
// jetzt über dasselbe `useGuardedNavigate` — der Unterschied ist damit nicht mehr merkbar.
// AUFTRAG-mega39 BLOCK B (ben, sammel37-mega38): mega38 BLOCK H hat drei NEUE Ausgänge aufgemacht —
// die Betriebs-Chips wurden von stummen `div`s zu rohen `Link`s nach `/admin`. Ein roher `Link` ruft
// `guard()` nicht; ein Admin, der gerade erfasst, war mit einem Klick ohne Speichern-Frage in der
// Verwaltung. Sie gehen jetzt über `GuardedLink` — dieselbe Grenze wie Logo, Sidebar und Palette.
// Dass diese Leiste KEINEN rohen `Link`/`NavLink` mehr enthalten darf, hält der Sammler in
// tests/app/shell-links-guarded.test.ts fest (nicht mehr nur das Logo, wie bis mega38).
import { GuardedLink, useGuardedNavigate } from "../app/NavGuardContext";
import { useRole } from "../app/RoleContext";
import { useToast } from "../app/ToastContext";
import {
  DESIGN_THEMES,
  DESIGN_THEME_STORAGE_KEY,
  type DesignTheme,
  applyDesignTheme,
} from "../lib/designTheme";
import { externalStagePill } from "../lib/externalStagePill";
import { kiHeaderStatus, kiHeaderStatusFromPublic } from "../lib/kiHeaderStatus";
import { notificationTarget } from "../lib/notificationTarget";
import { reasonerReachabilityBadge } from "../lib/reasonerReachability";
import { usePersistentEnum } from "../lib/usePersistentValue";
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

// AUFTRAG-mega40 BLOCK B (Pedi 28.07.): der Design-Umschalter — ein ECHTER Button (kein Link,
// keine Navigation), sichtbar für ALLE Rollen. Er schaltet ausschließlich die Präsentationsebene
// (data-theme="modern" an <html>, s. lib/designTheme.ts) und merkt sich die Wahl je Browser über
// die bestehende fehlertolerante Speicher-Grenze (usePersistentEnum → safeLocalStorage: kaputter/
// verweigerter Speicher = Wahl lebt nur diese Sitzung, nie ein Absturz). Er läuft bewusst NICHT
// durch den NavGuard und setzt keinen Dirty-Zustand — er berührt keinen laufenden Entwurf.
// Standard bleibt Klassisch: ohne Klick trägt <html> KEIN Attribut, kein berechneter Wert ändert
// sich (tests/app/mega40-design-umschalter-mounted.test.tsx, mega40-theme-invarianz.test.ts).
function DesignTogglePill(): JSX.Element {
  const { t } = useTranslation();
  const [theme, setTheme] = usePersistentEnum<DesignTheme>(
    DESIGN_THEME_STORAGE_KEY,
    DESIGN_THEMES,
    "classic",
  );
  useEffect(() => {
    applyDesignTheme(theme);
  }, [theme]);
  const modern = theme === "modern";
  return (
    <button
      type="button"
      aria-pressed={modern}
      onClick={() => setTheme(modern ? "classic" : "modern")}
      title={t("topbar.design.hint")}
      className="shrink-0 rounded-btn border border-hairline px-2.5 py-1.5 text-[12px] font-medium text-muted hover:text-text"
    >
      {t(modern ? "topbar.design.modern" : "topbar.design.classic")}
    </button>
  );
}

/**
 * JOB 2709 D4 — DER SATZ, DEN DER MENSCH ZU LESEN BEKOMMT.
 *
 * DER SERVER HAT VORRANG. Bei einem `ApiError` liefert er bereits einen vollständigen deutschen
 * Satz mit beiden Zahlen („Zu viele Meldungen auf einmal: 5001. Höchstens 5000 pro Vorgang."). Ihn
 * hier nachzubauen hiesse, zwei Wahrheiten über dieselbe Grenze zu führen — die zweite veraltet
 * beim ersten Mal, wenn jemand die Zahl am Server ändert.
 *
 * DER EIGENE SATZ IST NUR DIE AUFFANGSTELLE: Netzabbruch, Zeitüberschreitung, abgebrochene
 * Anfrage — dort gibt es keine Serverantwort und damit keine Meldung. Ein leerer Toast wäre
 * schlimmer als keiner.
 */
function meldungZumFehlschlag(fehler: unknown, t: (key: string) => string): string {
  const grund =
    fehler instanceof ApiError && fehler.message.trim().length > 0
      ? fehler.message
      : t("topbar.notifSeenFailed");
  // Der zweite Satz ist die HANDLUNGSAUSKUNFT, und nur der Client kann sie geben: der Server weiss
  // nichts von der Optik in der Glocke. Ohne ihn bliebe für den Menschen offen, ob die Meldungen
  // nun gelesen sind — genau die Ungewissheit, die dieser Job beseitigt.
  return `${grund} ${t("topbar.notifSeenReverted")}`;
}

function NotificationBell(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useGuardedNavigate();
  const queryClient = useQueryClient();
  // JOB 2709 D4: das vorhandene Anzeigemittel des Hauses, in der Shell bereits gerendert
  // (`AppShell.tsx`). Die Glocke hat es bis heute nicht benutzt — deshalb blieb jeder
  // Fehlschlag beim Speichern des Gelesen-Status stumm.
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  // SCRUM-220 → Audit-P3 (SCRUM-397): Gelesen-Status jetzt serverseitig (POST
  // /api/notifications/seen, pro Nutzer, überlebt Neustart). Der lokale Satz bleibt
  // als sofortige UI-Rückmeldung, bis der nächste Fetch das seen-Feld liefert.
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  // JOB 2709 D5: welche Kennungen der Server BESTÄTIGT hat. Sie überleben den Fehlschlag eines
  // anderen, überlappenden Aufrufs — ohne diese Menge nähme dessen Rücknahme sie mit.
  const bestaetigt = useRef<Set<string>>(new Set());
  // JOB 2709 D7: wie viele Aufrufe eine Kennung GERADE beanspruchen. Das ist eine Zahl und kein
  // Ja/Nein, und genau daran hängt der Fall, den D5 offen liess — Begründung im Block unten.
  const ansprueche = useRef<Map<string, number>>(new Map());
  const { data } = useNotifications();
  const items = data ?? [];
  const isRead = (n: (typeof items)[number]): boolean => n.seen === true || readIds.has(n.id);
  const unreadCount = items.filter((n) => !isRead(n)).length;

  // ==============================================================================================
  // JOB 2709 D4 — DIE GLOCKE NIMMT ZURÜCK, WENN DER SERVER NEIN SAGT.
  // ==============================================================================================
  //
  // WAS HIER VORHER STAND, UND WARUM ES FALSCH WAR: Die Zeile darüber versprach „erst der
  // Server-Erfolg zählt; lokal nur als Sofort-Optik". Der Code hielt das nicht. Er setzte die
  // Optik, rief `markSeen` mit `void` und OHNE `catch` — lehnte der Server ab oder brach die
  // Verbindung, blieb die Markierung stehen. `unreadCount` fiel auf 0, der Knopf „Alle gelesen"
  // verschwand (er hängt an `unreadCount > 0`), und gespeichert war nichts. Beim nächsten Laden
  // waren alle Meldungen wieder da. Kein Fehler, keine Meldung, keine Rücknahme.
  //
  // DAS TRAF JEDEN FEHLERFALL, nicht nur die 5.000er-Grenze aus D2: Netzabbruch, abgelaufene
  // Sitzung, 500. Und es traf DREI Auslöser, nicht einen — `markAll`, `markRead` je Eintrag und
  // das blosse ÖFFNEN des Panels (`toggleOpen` unten), das alles Sichtbare markiert, ohne dass
  // jemand etwas anklickt.
  //
  // DIE OPTIMISTISCHE MARKIERUNG BLEIBT — sie ist richtig, sie macht die Glocke schnell. Neu ist
  // nur, dass sie ZURÜCKGENOMMEN wird, wenn der Server sie nicht bestätigt.
  //
  // DAS ANZEIGEMITTEL IST DAS VORHANDENE: `useToast` aus `app/ToastContext`, in der Shell bereits
  // gerendert (`AppShell.tsx`). Ein zweiter Anzeigeweg daneben wäre der Parallelweg, den es hier
  // nicht geben soll.
  //
  // ==============================================================================================
  // JOB 2709 D5 — DIE RÜCKNAHME NIMMT NUR DAS EIGENE ZURÜCK, UND NUR DAS UNBESTÄTIGTE.
  // ==============================================================================================
  //
  // D4 merkte sich den GANZEN `readIds`-Stand vor dem Aufruf und schrieb ihn bei Fehlschlag
  // zurück. Das ist zu grob, und der Fall ist real:
  //
  //     A startet   (markiert Einträge, Aufruf läuft)
  //     B startet   (markiert einen weiteren)  → Server BESTÄTIGT B
  //     A scheitert → Vollsnapshot von VOR A zurück → Bs bestätigte Markierung ist gelöscht
  //
  // Der Mensch sieht eine Meldung wieder auftauchen, die der Server längst als gelesen führt.
  // Beim nächsten Laden verschwindet sie erneut — dasselbe Verwirrungsmuster wie vor D4, nur
  // andersherum. Der Kommentar an dieser Stelle warnte in D4 sogar vor der umgekehrten Falle und
  // baute dann diese.
  //
  // GEWÄHLT IST WEG (b) DES AUFTRAGS — optimistisch bleiben, mengen- und requestbezogen
  // zurücknehmen. Grund in einem Satz: Die Sofort-Optik ist seit SCRUM-397 der Grund, warum die
  // Glocke sich schnell anfühlt, und sie war nie der Fehler; zu grob war allein die Rücknahme.
  //
  // ZURÜCKGENOMMEN WERDEN GENAU DIE EIGENEN KENNUNGEN DIESES AUFRUFS — kein Snapshot, keine
  // fremden. Und davon nur die, die NICHT inzwischen bestätigt wurden: `bestaetigt` sammelt jede
  // Kennung, die ein Aufruf erfolgreich gespeichert hat. Ohne dieses Sieb nähme ein `delete` je Id
  // dem parallelen Erfolg seine Wirkung weg — genau der Fehler, nur eine Ebene tiefer.
  //
  // WARUM EIN REF UND KEIN STATE: Die Menge wird nie gerendert, sie steuert nur die Rücknahme.
  // Als State löste jede Bestätigung ein überflüssiges Neuzeichnen der ganzen Leiste aus.
  //
  // ==============================================================================================
  // JOB 2709 D7 — DER OFFENE ANSPRUCH IST GENAUSO SCHUTZWÜRDIG WIE DIE BESTÄTIGUNG.
  // ==============================================================================================
  //
  // D5 schützte die BESTÄTIGTE Kennung vor der Rücknahme eines fremden Aufrufs. Ungeschützt blieb
  // der umgekehrte Fall, und er ist derselbe Nutzerweg:
  //
  //     A startet   (markiert x, Aufruf läuft NOCH)
  //     B startet   (markiert x ebenfalls)  → B SCHEITERT
  //     Bs Catch löscht x                   → obwohl A es weiterhin beansprucht
  //
  // `bestaetigt` half hier nicht: A hatte noch nichts bestätigt, x stand nicht darin, Bs `delete`
  // griff durch. Der Mensch sah eine gerade gelesene Meldung wieder aufspringen — und wenn A
  // gleich darauf gelang, sprang sie ein zweites Mal um. Zwei Sprünge für einen Fehlschlag.
  //
  // WARUM EINE ZAHL UND KEIN ZWEITES SET: Ein Set kennt nur „drin" oder „draussen". Die Frage ist
  // aber, WIE VIELE Aufrufe eine Kennung gerade beanspruchen — gelöscht werden darf sie erst,
  // wenn der letzte davon gescheitert ist. `ansprueche` zählt genau das.
  //
  // BEIDE SIEBE BLEIBEN, und keines ist überflüssig:
  //   · der Zähler schützt den noch OFFENEN fremden Anspruch   (dieser Durchgang)
  //   · `bestaetigt` schützt die bereits ERFOLGTE Bestätigung  (D5, von BEN anerkannt)
  // Der Zähler allein liesse eine bestätigte Kennung fallen, sobald ein späterer Aufruf für
  // dieselbe Kennung scheitert und sein Zähler auf null geht — genau der D5-Fall, der nicht
  // zurückkommen darf.
  //
  // AUFGERÄUMT WIRD SOFORT: Ein Zähler, der null erreicht, verlässt die Map. Sonst wüchse sie mit
  // jeder je markierten Kennung weiter, ohne je etwas zu tragen.
  const anspruchAufloesen = (id: string): number => {
    const offen = (ansprueche.current.get(id) ?? 1) - 1;
    if (offen <= 0) {
      ansprueche.current.delete(id);
      return 0;
    }
    ansprueche.current.set(id, offen);
    return offen;
  };

  const persistSeen = (ids: string[]): void => {
    if (ids.length === 0) {
      return;
    }
    for (const id of ids) {
      ansprueche.current.set(id, (ansprueche.current.get(id) ?? 0) + 1);
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
      .then(() => {
        for (const id of ids) {
          anspruchAufloesen(id);
          bestaetigt.current.add(id);
        }
        return queryClient.invalidateQueries({ queryKey: ["notifications"] });
      })
      .catch((e: unknown) => {
        // WICHTIG: Erst ALLE Ansprüche dieses Aufrufs auflösen, dann entscheiden. Beides in einer
        // Schleife zu vermischen wäre dasselbe Ergebnis, aber die Trennung sagt, was gemeint ist:
        // die Auflösung geschieht immer, die Rücknahme nur unter Bedingung.
        const zurueckzunehmen = ids.filter(
          (id) => anspruchAufloesen(id) === 0 && !bestaetigt.current.has(id),
        );
        if (zurueckzunehmen.length > 0) {
          setReadIds((prev) => {
            const next = new Set(prev);
            for (const id of zurueckzunehmen) {
              next.delete(id);
            }
            return next;
          });
        }
        push("error", meldungZumFehlschlag(e, t));
      });
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
                      {/* FUNKE-FIX3 P0 (bens Blocker B): redigierte Wissenslücke → neutrale
                          Bezeichnung (DE/EN/NL), NIE ein Fragetext. */}
                      {n.kind === "gap" && (n.redacted || !n.title)
                        ? t("topbar.notifGapRedacted")
                        : n.title}
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

// PAKET 2 (D-AISTATE, Pedi 23.07.): „aktiv/grün" NUR bei echter Erreichbarkeit (zuletzt geantwortet),
// nicht mehr bei bloßer Konfiguration. Zustände: aktiv (grün) · ungeprüft (gelb) · nicht erreichbar
// (rot) · nicht verfügbar (grau) — abgeleitet aus dem gecachten Server-Erreichbarkeits-Signal.
const REACHABILITY_TONE: Record<"pos" | "warn" | "crit" | "neutral", { box: string; dot: string }> =
  {
    pos: { box: "bg-trust-pos-bg text-trust-pos-text", dot: "bg-trust-pos-fill" },
    warn: { box: "bg-trust-warn-bg text-trust-warn-text", dot: "bg-trust-warn-fill" },
    crit: { box: "bg-trust-crit-bg text-trust-crit-text", dot: "bg-trust-crit-fill" },
    neutral: { box: "bg-page text-muted", dot: "bg-muted-2" },
  };

function ReasonerStatusPill(): JSX.Element {
  const { t } = useTranslation();
  const { data } = useReasonerStatus();
  const badge = reasonerReachabilityBadge(data);
  const tone = REACHABILITY_TONE[badge.tone];
  // AUFTRAG-mega38 BLOCK H: aus dem `div` ist ein Link geworden — anklickbar UND mit der Tastatur
  // erreichbar. Vorher war es eine reine Hover-Anzeige: wer nicht mit der Maus darauf zeigte
  // (oder gar keine Maus benutzt), bekam die Erklaerung nie zu sehen. Und der Klartextsatz steht
  // jetzt VOR dem Fachtext, nicht dahinter.
  return (
    <GuardedLink
      to="/admin"
      className={`flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold ${tone.box}`}
      title={`${t("topbar.plain.reasoner")} — ${t(badge.hintKey)}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {t(badge.labelKey)}
    </GuardedLink>
  );
}

// PAKET 2 (D-AISTATE, Pedi 23.07.): Achse 1 — externe Wissensabfrage (Web-Suche) als EIGENE Pille,
// klar getrennt vom Reasoner-Badge (Achse 2, KI-Modell). Verhindert die Verwechslung „Extern aus" =
// „KI aus". Der Tooltip erklärt den Unterschied (Web-Suche ≠ KI-Modell).
function ExternalStagePill(): JSX.Element | null {
  const { t } = useTranslation();
  const { data } = useExternalPolicy();
  if (!data) {
    return null;
  }
  const pill = externalStagePill(data.stage);
  const tone = REACHABILITY_TONE[pill.tone];
  // AUFTRAG-mega38 BLOCK H — s. ReasonerStatusPill.
  return (
    <GuardedLink
      to="/admin"
      className={`flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold ${tone.box}`}
      title={`${t("topbar.plain.external")} — ${t(pill.hintKey)}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {t(pill.labelKey)}
    </GuardedLink>
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
  // AUFTRAG-mega38 BLOCK H: der Klartextsatz steht VORNE — „DSGVO-Bestaetigung daher: nein" ist
  // eine wahre, aber voraussetzungsreiche Auskunft; sie kommt jetzt nach dem einfachen Satz.
  const tooltip = [t("topbar.plain.ki"), t(status.hintKey), status.detail, detailLine]
    .filter(Boolean)
    .join(" — ");
  return (
    <GuardedLink
      to="/admin"
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
    </GuardedLink>
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

export function Topbar({
  narrow = false,
  onOpenMenu,
  menuButtonRef,
}: {
  narrow?: boolean;
  onOpenMenu?: () => void;
  // E2E-017 (bens Block F/Drawer): Referenz auf den Hamburger, damit der Drawer den Fokus beim
  // Schließen genau hierher zurückgibt.
  menuButtonRef?: Ref<HTMLButtonElement>;
} = {}): JSX.Element {
  const { t } = useTranslation();
  // WP-SAMMEL20-FIX (bens Fix 4, B1b): der Wechsel zu /mobile ist eine normale In-App-Navigation —
  // er läuft durch den NavGuard (ungespeicherte Eingaben → Bestätigungsdialog, wie Sidebar/Palette)
  // und merkt sich die AKTUELLE Route als Absprungpunkt, damit der Rückweg dorthin zurückführt.
  // AUFTRAG-mega11 Block B-2: das gilt jetzt für JEDE Navigation dieser Leiste, nicht nur für diese.
  const navigate = useGuardedNavigate();
  const location = useLocation();
  // AUFTRAG-mega38 BLOCK H: die drei Betriebs-Chips sind Admin-Auskunft (s. unten).
  const { role } = useRole();
  const [q, setQ] = useState("");
  const [islandMarker] = useState(() => readIslandMarker());

  const submitSearch = (e: FormEvent): void => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/bibliothek?q=${encodeURIComponent(term)}` : "/bibliothek");
  };

  return (
    <header className="kw-topbar flex h-[60px] shrink-0 items-center gap-3 border-b border-hairline bg-surface px-5">
      {/* E2E-017: schmaler Header bekommt einen Hamburger, der die Sidebar als Drawer öffnet. */}
      {narrow ? (
        <button
          type="button"
          ref={menuButtonRef}
          aria-label={t("topbar.openMenu")}
          onClick={() => onOpenMenu?.()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
        >
          <Menu size={20} />
        </button>
      ) : null}
      {/* E2E-017: auf schmalen Breiten wird der Header vereinfacht — die Volltextsuche entfällt
          (Platz für Hamburger + Kernpillen); die Suche bleibt über die Bibliothek erreichbar. */}
      <form
        onSubmit={submitSearch}
        className={`h-9 min-w-0 max-w-md flex-1 items-center gap-2 rounded-input border border-hairline bg-page px-3 text-muted focus-within:border-ink/30 ${
          narrow ? "hidden" : "flex"
        }`}
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
        {/* E2E-017 (bens Block F): im schmalen Modus (≤899px, u. a. 768px) räumt die Topbar die
            rechte Leiste auf, damit nichts horizontal abgeschnitten wird. Ausgeblendet werden die
            platzhungrigen Sekundär-Elemente, die im Drawer/Profil ohnehin erreichbar bleiben:
            der „Mobil"-Umschalter (Sinn nur auf Desktop), der Hilfe-Schnellknopf (Nav-Eintrag
            „Hilfe" liegt im Drawer), der Insel-Marker (Test-/Dev-Kennung) und die Versions-Pille.
            Erhalten bleiben die für den Betrieb wichtigen Statuspillen (KI-Modus/Erreichbarkeit/
            Extern), Benachrichtigungen und die Sprachumschaltung. */}
        {!narrow ? (
          <button
            type="button"
            onClick={() =>
              navigate("/mobile", {
                state: { from: `${location.pathname}${location.search}` },
              })
            }
            className="flex shrink-0 items-center gap-1.5 rounded-btn border border-hairline px-2.5 py-1.5 text-[12px] font-medium text-muted hover:text-text"
          >
            <Smartphone size={15} />
            {t("topbar.mobile")}
          </button>
        ) : null}
        {!narrow ? (
          <button
            type="button"
            onClick={() => navigate("/hilfe")}
            className="grid h-9 w-9 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
            aria-label={t("nav.help")}
          >
            <HelpCircle size={18} />
          </button>
        ) : null}
        {/* mega40 B: Design-Umschalter — für alle Rollen, auch im schmalen Modus (er ist klein,
            und die Wahl soll nicht vom Fensterformat abhängen). */}
        <DesignTogglePill />
        <LangPill />
        <NotificationBell />
        {/* ==================================================================================
            AUFTRAG-mega38 BLOCK H (Pedi 27.07.) — DIE DREI CHIPS SIND ADMIN-AUSKUNFT.
            ==================================================================================
            „KI-Modus: Cloud" · „Reasoner ungeprueft" · „Extern: Blockiert" standen auf JEDER
            Seite, fuer JEDE Rolle. Fuer eine Nutzerin ohne Adminrolle sind sie drei Dinge auf
            einmal: unverstaendlich (Fachtext bis hin zu „DSGVO-Bestaetigung daher: nein"),
            beunruhigend (in ihren ersten Minuten steht dort „Reasoner UNGEPRUEFT", weil die
            Erreichbarkeitspruefung erst nach einer Weile durchlaeuft) — und folgenlos, weil sie
            an keiner der Einstellungen etwas aendern darf.
            Sie sind jetzt Admins vorbehalten. Und dort, wo sie bleiben, sind sie anklickbar,
            mit der Tastatur erreichbar und beginnen mit einem Klartextsatz. */}
        {role === "admin" ? (
          <>
            <KiModePill />
            <ReasonerStatusPill />
            <ExternalStagePill />
          </>
        ) : null}
        {!narrow && islandMarker ? <IslandMarkerPill marker={islandMarker} /> : null}
        {/* Beta-Phase: sichtbare Versionsnummer oben rechts (Pedi, 02.07.2026) — nur im breiten Modus. */}
        {!narrow ? (
          <span
            className="rounded-pill border border-hairline px-2 py-0.5 font-mono text-[10.5px] text-muted-2"
            title="App-Version (Beta-Phase)"
          >
            v{APP_VERSION}
          </span>
        ) : null}
      </div>
    </header>
  );
}

import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useNotifications } from "../api/hooks";
import { useGuardedNavigate } from "../app/NavGuardContext";
import { useToast } from "../app/ToastContext";
import { notificationTarget } from "../lib/notificationTarget";
import { MenueAufklapp } from "./Menue";

// ================================================================================================
// JOB 3060 · H1 — DIE GLOCKE ZIEHT INS KONTO-MENÜ, FACHLICH VOLLSTÄNDIG.
// ================================================================================================
//
// Bis hierher stand die Glocke als eigener Knopf in der Kopfzeile (`Topbar.tsx`, NotificationBell).
// Pedis Hülle (Mockup Main.dc.html) kennt sie nicht mehr als eigenes Zeichen: ungelesene Meldungen
// zeigt ein kleiner Punkt am Konto-Kreis, die Liste steht im Konto-Menü als Zeile „Meldungen".
// Was hier steht, ist derselbe Datenweg und dieselbe Logik wie zuvor — Öffnen ist Kenntnisnahme
// (Audit-P3), „Alle gelesen", Rücknahme bei Server-Nein (JOB 2709 D4), mengenbezogene Rücknahme
// (D5) und der Anspruchszähler (D7). Kein Satz davon wurde geschwächt; nur der Ort ist neu.
//
// DER ZUSTAND LEBT IM TRÄGER, NICHT IN DER LISTE. Die Liste steht in einem Menü, das sich
// schließt (Klick daneben, Routenwechsel); würde die optimistische Markierung mit ihr aus dem Baum
// gehen, verlöre ein Fehlschlag seine Rücknahme und eine Bestätigung ihr Sieb, sobald das Menü zu
// ist. Deshalb hält `useMeldungenZustand` (im Konto-Kreis, der immer im Kopfband steht) die drei
// Mengen, und `Meldungen` bekommt sie gereicht.

/** Ist der Browser online? (react-query's onlineManager — dieselbe Quelle, die Abrufe pausiert.) */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
    () => true,
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

type Meldung = NonNullable<ReturnType<typeof useNotifications>["data"]>[number];

export interface MeldungenZustand {
  items: Meldung[];
  isRead: (n: Meldung) => boolean;
  /** Ungelesen nach Server UND örtlicher Markierung — die Zahl, die die Zeile trägt. */
  unreadCount: number;
  /** §9: nur nach einem frischen, nicht pausierten, erfolgreichen Abruf darf der Punkt stehen. */
  frisch: boolean;
  markRead: (id: string) => void;
  markAll: () => void;
  /** Öffnen der Liste ist Kenntnisnahme (Audit-P3): alles Sichtbare wird gesehen. */
  alleSichtbarenMarkieren: () => void;
}

export function useMeldungenZustand(): MeldungenZustand {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // JOB 2709 D4: das vorhandene Anzeigemittel des Hauses, in der Shell bereits gerendert
  // (`AppShell.tsx`). Die Glocke hat es bis heute nicht benutzt — deshalb blieb jeder
  // Fehlschlag beim Speichern des Gelesen-Status stumm.
  const { push } = useToast();
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
  const q = useNotifications();
  const online = useOnline();
  const items = q.data ?? [];
  const isRead = (n: Meldung): boolean => n.seen === true || readIds.has(n.id);
  const unreadCount = items.filter((n) => !isRead(n)).length;
  // §9 (Codex R5/R6): FRISCH heißt erfolgreich UND ruhend UND nicht veraltet UND online — nicht
  // „irgendwann einmal geladen". Ein alter Cache, an dem gerade eine Auffrischung läuft
  // (`fetching`), ist keine Bestätigung; ein gescheiterter Neuabruf (`status === "error"` mit
  // Daten) auch nicht; offline (`paused`) erst recht nicht. Und ein Erfolg ALTERT: nach Ablauf der
  // Frischezeit (`staleTime`, main.tsx: 30 s) ist er nur noch Cache — `isStale` kippt dann von
  // selbst (react-query meldet den Ablauf an den Beobachter), und der Punkt geht ohne weitere
  // Nutzeraktion, bis ein neuer ruhender Erfolg ihn bestätigt.
  const frisch = q.status === "success" && q.fetchStatus === "idle" && !q.isStale && online;

  // ==============================================================================================
  // JOB 2709 D4 — DIE GLOCKE NIMMT ZURÜCK, WENN DER SERVER NEIN SAGT.
  // ==============================================================================================
  //
  // Die optimistische Markierung bleibt — sie macht die Glocke schnell. Neu seit D4 ist, dass sie
  // ZURÜCKGENOMMEN wird, wenn der Server sie nicht bestätigt, und zwar für alle drei Auslöser:
  // `markAll`, `markRead` je Eintrag und das blosse ÖFFNEN der Liste.
  //
  // ==============================================================================================
  // JOB 2709 D5 — DIE RÜCKNAHME NIMMT NUR DAS EIGENE ZURÜCK, UND NUR DAS UNBESTÄTIGTE.
  // ==============================================================================================
  //
  //     A startet   (markiert Einträge, Aufruf läuft)
  //     B startet   (markiert einen weiteren)  → Server BESTÄTIGT B
  //     A scheitert → ein Vollsnapshot von VOR A löschte Bs bestätigte Markierung
  //
  // Zurückgenommen werden deshalb GENAU DIE EIGENEN KENNUNGEN eines Aufrufs — und davon nur die,
  // die NICHT inzwischen bestätigt wurden (`bestaetigt`).
  //
  // ==============================================================================================
  // JOB 2709 D7 — DER OFFENE ANSPRUCH IST GENAUSO SCHUTZWÜRDIG WIE DIE BESTÄTIGUNG.
  // ==============================================================================================
  //
  //     A startet   (markiert x, Aufruf läuft NOCH)
  //     B startet   (markiert x ebenfalls)  → B SCHEITERT
  //     Bs Catch löscht x                   → obwohl A es weiterhin beansprucht
  //
  // `ansprueche` zählt je Kennung die offenen Aufrufe; gelöscht wird erst, wenn der letzte davon
  // gescheitert ist. Beide Siebe bleiben — der Zähler schützt den OFFENEN fremden Anspruch,
  // `bestaetigt` die bereits ERFOLGTE Bestätigung. Ein Zähler, der null erreicht, verlässt die Map.
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
        // Erst ALLE Ansprüche dieses Aufrufs auflösen, dann entscheiden: die Auflösung geschieht
        // immer, die Rücknahme nur unter Bedingung.
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
  const ungelesene = (): string[] => items.filter((n) => !isRead(n)).map((n) => n.id);

  return {
    items,
    isRead,
    unreadCount,
    frisch,
    markRead: (id: string) => persistSeen([id]),
    markAll: () => persistSeen(ungelesene()),
    alleSichtbarenMarkieren: () => persistSeen(ungelesene()),
  };
}

/** Die Zeile „Meldungen" im Konto-Menü — beim Aufklappen die Liste, Öffnen ist Kenntnisnahme. */
export function Meldungen({ zustand }: { zustand: MeldungenZustand }): JSX.Element {
  const { t } = useTranslation();
  const navigate = useGuardedNavigate();
  const [open, setOpen] = useState(false);
  const { items, isRead, unreadCount, markRead, markAll, alleSichtbarenMarkieren } = zustand;
  // Audit-P3: Öffnen der Liste ist die bewusste Kenntnisnahme — alles Sichtbare wird gesehen.
  const toggleOpen = (): void => {
    if (!open) {
      alleSichtbarenMarkieren();
    }
    setOpen((v) => !v);
  };

  return (
    <MenueAufklapp
      label={t("topbar.notifications")}
      wert={unreadCount > 0 ? unreadCount : undefined}
      offen={open}
      onToggle={toggleOpen}
      testid="konto-meldungen"
    >
      <div className="px-2.5 pt-1">
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={markAll}
            className="mb-1 text-[11px] font-semibold text-ai hover:opacity-80"
          >
            {t("topbar.notifMarkAll")}
          </button>
        ) : null}
        {items.length === 0 ? (
          <p className="py-2 text-[13px] text-muted">{t("topbar.notificationsEmpty")}</p>
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
                  className={`flex items-start gap-2 rounded-btn px-1 py-1.5 ${
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
                      <span className="font-semibold text-ai">{t("topbar.notifAssignment")}: </span>
                    ) : null}
                    {/* PMO-FEA-0002: wertschätzende, unaufdringliche Wirkungs-Rückmeldung. */}
                    {n.kind === "impact" ? (
                      <span className="font-semibold text-trust-pos-text">
                        {t("topbar.notifImpact")}:{" "}
                      </span>
                    ) : null}
                    {/* Pedi 04.07.: Duplikat-Fund klar als solcher gekennzeichnet. */}
                    {n.kind === "duplicate" ? (
                      <span className="font-semibold text-ai">{t("topbar.notifDuplicate")}: </span>
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
    </MenueAufklapp>
  );
}

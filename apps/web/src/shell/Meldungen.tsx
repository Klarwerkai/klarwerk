import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useNotifications } from "../api/hooks";
import { useGuardedNavigate } from "../app/NavGuardContext";
import { useToast } from "../app/ToastContext";
import { leerzustandsZeile } from "../components/EmptyStateCtas";
import { useNetzOnline } from "../lib/netzzustand";
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

/**
 * Ist der Browser online? Der Wert kommt aus `lib/netzzustand.ts` — dort steht die EINE Verdrahtung
 * des `onlineManager` (derselben Quelle, die react-query für `fetchStatus: "paused"` liest).
 *
 * JOB 3879: bis hierher verdrahtete diese Stelle den `onlineManager` selbst, und zwar mit einer im
 * Rumpf angelegten Abonnierfunktion — gemessen 5 Anmeldungen bei 5 Rendervorgängen
 * (`tests/kollision-netztrennung/eine-verdrahtung-je-hook.test.tsx`, V-2). Der Name bleibt, weil
 * `KopfbandPunkte.tsx` ihn ruft; verschwunden ist die eigene Verdrahtung.
 */
export function useOnline(): boolean {
  return useNetzOnline();
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
  /**
   * FE-002: es liegt noch KEINE Antwort vor (erster Abruf läuft). Die leere Liste ist dann keine
   * bestätigte Null und darf nicht als „Keine Meldungen" erscheinen.
   */
  laedt: boolean;
  /** FE-002: der Abruf ist gescheitert — die Anzahl ungelesener Meldungen ist unbekannt. */
  fehler: boolean;
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
    laedt: q.status === "pending",
    fehler: q.status === "error",
    markRead: (id: string) => persistSeen([id]),
    markAll: () => persistSeen(ungelesene()),
    alleSichtbarenMarkieren: () => persistSeen(ungelesene()),
  };
}

/** Die Zeile „Meldungen" im Konto-Menü — beim Aufklappen die Liste, Öffnen ist Kenntnisnahme. */
export function Meldungen({ zustand }: { zustand: MeldungenZustand }): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { unreadCount, alleSichtbarenMarkieren } = zustand;
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
      <MeldungenListe zustand={zustand} onGeoeffnet={() => setOpen(false)} />
    </MenueAufklapp>
  );
}

/**
 * Die Liste selbst — im Konto-Menü (aufgeklappt) und im Meldungs-Menü des Kopfbands (FE-002).
 *
 * FE-002: eine leere Liste heisst nur dann „keine Meldungen", wenn der Abruf WIRKLICH geantwortet
 * hat. Solange die erste Antwort fehlt oder der Abruf gescheitert ist, sagt die Liste genau das —
 * eine unbekannte Zahl wird nicht als bestätigte Null ausgegeben.
 */
export function MeldungenListe({
  zustand,
  onGeoeffnet,
}: {
  zustand: MeldungenZustand;
  /** Nach dem Öffnen einer Meldung: das umgebende Menü schließen. */
  onGeoeffnet: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const navigate = useGuardedNavigate();
  const { items, isRead, unreadCount, markRead, markAll, laedt, fehler } = zustand;
  const leer = laedt
    ? t("fe002.meldungenLaden")
    : fehler
      ? t("fe002.meldungenFehler")
      : t("topbar.notificationsEmpty");
  return (
    <div className="px-2.5 pt-1" data-testid="meldungen-liste">
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
        <>
          <p className="py-2 text-[13px] text-muted" data-testid="meldungen-leer">
            {leer}
          </p>
          {/* R-0956 (Nacharbeit 7): nur die WIRKLICH leere Liste wird eingeordnet — beim Laden
              und bei einem Fehler sagt der Satz darüber, was los ist. */}
          {laedt || fehler ? null : leerzustandsZeile(t, "meldungen")}
        </>
      ) : (
        <ul className="space-y-0.5">
          {items.slice(0, 8).map((n) => {
            const read = isRead(n);
            const target = notificationTarget(n);
            const openTarget = (): void => {
              markRead(n.id);
              onGeoeffnet();
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
                      : n.kind === "conflict" ||
                          n.kind === "escalation" ||
                          n.kind === "reklamation" ||
                          (n.kind === "veroeffentlichung" && n.hervorgehoben)
                        ? "bg-trust-crit-fill"
                        : n.kind === "duplicate"
                          ? "bg-ai"
                          : n.kind === "assignment" ||
                              n.kind === "kenntnisnahme" ||
                              n.kind === "frische" ||
                              n.kind === "return" ||
                              n.kind === "loeschantrag"
                            ? "bg-ai"
                            : n.kind === "impact"
                              ? "bg-trust-pos-fill"
                              : "bg-trust-info-text"
                  }`}
                />
                {/* FE-002 K5: Kennung und Art, damit der Tastaturweg im Browser nachweist, WELCHE
                    Meldung den Fokus hat und ausgeführt wird. */}
                <button
                  type="button"
                  onClick={openTarget}
                  data-testid="meldung-oeffnen"
                  data-art={n.kind}
                  className="min-w-0 flex-1 truncate rounded-[4px] text-left text-[13px] text-text outline-none hover:text-ai focus-visible:bg-hairline-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                  title={target ? t("topbar.notifOpen") : undefined}
                >
                  {/* SCRUM-363: ruhige „Dir ist Review-Arbeit zugewiesen"-Kennzeichnung. */}
                  {n.kind === "assignment" ? (
                    <span className="font-semibold text-ai">{t("topbar.notifAssignment")}: </span>
                  ) : null}
                  {/* R-0894: Rückgabe zur Nacharbeit und Eskalation als eigene Art erkennbar. */}
                  {n.kind === "return" ? (
                    <span className="font-semibold text-ai">
                      {t("meldungsart.rueckgabe.zeile")}:{" "}
                    </span>
                  ) : null}
                  {n.kind === "escalation" ? (
                    <span className="font-semibold text-trust-crit-text">
                      {t("meldungsart.eskalation.zeile")}:{" "}
                    </span>
                  ) : null}
                  {/* PMO-FEA-0002: wertschätzende, unaufdringliche Wirkungs-Rückmeldung. */}
                  {n.kind === "impact" ? (
                    <span className="font-semibold text-trust-pos-text">
                      {t("topbar.notifImpact")}:{" "}
                    </span>
                  ) : null}
                  {/* Kenntnisnahme: Anforderung, Erinnerung oder abgelaufene Frist — der Titel ist
                      der Eintrag, dessen Fassung zur Kenntnis genommen werden soll. */}
                  {n.kind === "kenntnisnahme" ? (
                    <span className="font-semibold text-ai">
                      {t(
                        n.ueberfaellig
                          ? "kenntnisnahme.meldungUeberfaellig"
                          : n.erinnerung
                            ? "kenntnisnahme.meldungErinnerung"
                            : "kenntnisnahme.meldung",
                      )}
                      {n.fassung ? ` (V${n.fassung})` : ""}:{" "}
                    </span>
                  ) : null}
                  {/* Löschantrag (R-0661): Verwalteraufgabe mit Frist — der Titel ist der Name
                      der antragstellenden Person. */}
                  {n.kind === "loeschantrag" ? (
                    <span className="font-semibold text-ai">
                      {t(
                        n.ueberfaellig ? "datenschutz.meldungUeberfaellig" : "datenschutz.meldung",
                      )}
                      {n.fristBis
                        ? ` (${t("datenschutz.meldungFrist", {
                            datum: new Date(n.fristBis).toLocaleDateString(),
                          })})`
                        : ""}
                      :{" "}
                    </span>
                  ) : null}
                  {/* R-1089: gemeldete Antwort zum eigenen Wissen — Grund vorn, Titel dahinter. */}
                  {n.kind === "reklamation" ? (
                    <span className="font-semibold text-trust-crit-text">
                      {t(
                        n.grund === "quelle-passt-nicht"
                          ? "antwortmeldung.meldung.quelle-passt-nicht"
                          : "antwortmeldung.meldung.antwort-falsch",
                      )}
                      :{" "}
                    </span>
                  ) : null}
                  {/* aufnahme:20260922:gesamt-wissen-frische: Frist, Wochenvorlage oder
                      Prüfanforderung — der Titel ist das eigene Wissensobjekt. */}
                  {n.kind === "frische" ? (
                    <span className="font-semibold text-ai">
                      {t(
                        n.frischeArt === "vorlage"
                          ? "frische.meldungVorlage"
                          : n.frischeArt === "anlage"
                            ? "frische.meldungAnlage"
                            : n.ueberfaellig
                              ? "frische.meldungFristAbgelaufen"
                              : "frische.meldungFrist",
                      )}
                      :{" "}
                    </span>
                  ) : null}
                  {/* Veröffentlichung: neu oder aktualisiert; „hervorgehoben" trägt die Markierung
                      „Wichtig" und steht oben, bis sie gelesen ist (Reihenfolge vom Server). */}
                  {/* ADMIN-12: die tägliche Zusammenfassung — Tag und Anzahl vorn, die Titel der
                      (beim Abruf sichtbaren) Einträge dahinter. */}
                  {n.kind === "veroeffentlichung" && n.zusammenfassung ? (
                    <span className="font-semibold text-ai" data-zusammenfassung="ja">
                      {t("kommunikation.glocke.zusammenfassung", {
                        datum: new Date(`${n.zusammenfassung.tag}T12:00:00Z`).toLocaleDateString(),
                        anzahl: n.zusammenfassung.anzahl,
                      })}
                      :{" "}
                    </span>
                  ) : null}
                  {n.kind === "veroeffentlichung" && !n.zusammenfassung ? (
                    <span
                      className={`font-semibold ${
                        n.hervorgehoben ? "text-trust-crit-text" : "text-ai"
                      }`}
                      data-hervorgehoben={n.hervorgehoben ? "ja" : "nein"}
                    >
                      {n.hervorgehoben ? `${t("veroeffentlichung.meldungWichtig")} · ` : ""}
                      {t(
                        n.art === "aktualisierung"
                          ? "veroeffentlichung.meldungAktualisierung"
                          : "veroeffentlichung.meldungNeu",
                      )}
                      {n.fassung ? ` (V${n.fassung})` : ""}:{" "}
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
                    className="shrink-0 rounded-btn px-1 text-[11px] font-semibold text-muted-2 outline-none hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
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
  );
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";
import { type SessionUser, authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { SESSION_REFRESH_MS, resolveSessionUser } from "../lib/sessionState";
// AUFTRAG-mega63 Block A / mega64 Block B: die unbestätigte Abmeldung. mega63 hielt sie tab-gebunden
// (`sessionStorage`) — sie gehört aber zur SITZUNG, und die teilen alle Tabs. Seit mega64 gilt sie
// tabübergreifend und löst sich auf, sobald der Server erreichbar ist (s. `app/abmeldeschuld.ts`).
import {
  abmeldeschuldBeobachten,
  abmeldeschuldGesetzt,
  abmeldeschuldLoeschen,
  abmeldeschuldSetzen,
} from "./abmeldeschuld";

// Echte Sitzung aus dem Backend (/auth/status + /auth/me). Login/Logout-Screens
// (#61) nutzen diesen Context; die Shell wird später dahinter gesperrt.
interface AuthState {
  user: SessionUser | null;
  needsSetup: boolean;
  /** FR-AUTH-07: SSO im Server konfiguriert? Steuert die ehrliche SSO-UI. */
  oidcEnabled: boolean;
  isLoading: boolean;
  /** Status-Abfrage fehlgeschlagen (z. B. Backend im Dev nicht erreichbar). */
  error: boolean;
  refresh: () => void;
  /**
   * Abmelden: Session serverseitig beenden und den gesamten Query-Cache leeren.
   *
   * AUFTRAG-mega62 Block C — DIE ZWEITE, STRENGE SPIELART. Der Bestandsweg (ohne Argument) räumt
   * und verlässt die Anwendung in einem `finally`, AUCH wenn das serverseitige Abmelden scheitert.
   * Für den Kopfzeilen-Abmelder ist das richtig: die Nutzerin will weg, und ein Client, der bei
   * Netzstörung im angemeldeten Zustand festhängt, wäre schlimmer als ein hartes Neuladen.
   *
   * Für die Ablehnung des Hinweises ist es GENAU FALSCH. Dort hat die Nutzerin gerade „Nicht
   * einverstanden" bestätigt; scheitert das Abmelden serverseitig, kann die Sitzung fortbestehen,
   * und nach einem harten Neuladen ist sie wieder angemeldet — die Anwendung hätte behauptet,
   * etwas sei geschehen, was nicht geschehen ist. Das ist die einzige der vier rechtlichen Zusagen
   * aus mega61, die im Fehlerfall ins GEGENTEIL kippt.
   *
   * `{ strict: true }` räumt und verlässt deshalb NUR nach bestätigter serverseitiger Beendigung.
   * Scheitert sie, wird `signOutFailed` gesetzt (die geschützte Nutzung ist ab da gesperrt, s.
   * `Gate` in App.tsx) und der Fehler weitergereicht. Die Bestandsaufrufer sehen davon nichts.
   */
  signOut: (opts?: { strict?: boolean }) => Promise<void>;
  /**
   * AUFTRAG-mega62 Block C: Ein strenges Abmelden ist gescheitert — die Sitzung besteht womöglich
   * fort. Solange das gilt, darf die Anwendung nichts Geschütztes mehr zeigen.
   *
   * AUFTRAG-mega63 Block A: Der Zustand überlebt seit dieser Scheibe ein Neuladen.
   *
   * AUFTRAG-mega64 Block B: Und seit dieser gilt er in ALLEN Tabs (s. `app/abmeldeschuld.ts`) und
   * löst sich von selbst auf, sobald der Server die Beendigung bestätigt oder sicher feststeht, dass
   * keine Sitzung mehr besteht. Der Name bleibt `signOutFailed`, weil er die AUSLÖSENDE Tatsache
   * benennt (das strenge Abmelden ist gescheitert) — was daraus folgt, steht in `abmeldeschuld.ts`.
   */
  signOutFailed: boolean;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = useQueryClient();
  // AUFTRAG-mega62 Block C: gescheitertes STRENGES Abmelden. Bewusst hier und nicht in der
  // ablehnenden Fläche: Die Sperre gilt für die ganze Anwendung, nicht für einen Banner, und wer
  // sie aufhebt, muss die Sitzung kennen.
  //
  // AUFTRAG-mega63 Block A — KORREKTUR EINER BEGRÜNDUNG, NICHT NUR EINES FEHLERS.
  // Hier stand bis mega62: „Ein harter Neuladen setzt sie zurück — richtig so, denn danach
  // entscheidet wieder der Server, ob die Sitzung noch gilt." Der Satz ist für sich genommen
  // richtig, greift aber genau im einzigen Fall nicht, in dem er angewandt wurde: Das Abmelden ist
  // GERADE GESCHEITERT, der Server hat also nichts beendet und liefert dieselbe Sitzung weiter.
  // „Der Server entscheidet" hieße hier: er entscheidet für den Zustand, den die Nutzerin soeben
  // abgelehnt hat. Ein Kommentar, der die Begründung für einen Fehler liefert, ist schlimmer als
  // kein Kommentar — der Nächste liest ihn und lässt den Fehler stehen. Deshalb steht er nicht
  // mehr da.
  //
  // Der Anfangswert kommt aus dem Speicher (`app/abmeldeschuld.ts`), damit die Zusage „gesperrt, bis
  // der Server die Beendigung bestätigt" ein Neuladen überdauert — und seit mega64 auch einen
  // Tabwechsel. `useState` mit Funktion: EINMAL beim Aufbau gelesen, nicht bei jedem Rendern.
  const [signOutFailed, setSignOutFailed] = useState(abmeldeschuldGesetzt);

  const status = useQuery({
    queryKey: ["auth", "status"],
    queryFn: authApi.status,
    retry: false,
    // FE-FND-08: Session frisch halten — periodisch + bei Fenster-Fokus.
    refetchInterval: SESSION_REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  const needsSetup = status.data?.needsSetup ?? false;

  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    retry: false,
    // Vor Ersteinrichtung gibt es keinen Nutzer abzufragen.
    enabled: status.isSuccess && !needsSetup,
    // FE-FND-08: periodisches Nachladen + Fokus-Refetch gegen stale Session.
    refetchInterval: SESSION_REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  // ==============================================================================================
  // AUFTRAG-mega64 BLOCK B (1) — DIE ANDEREN TABS ERFAHREN ES IM SELBEN MOMENT.
  // ==============================================================================================
  //
  // Die Lücke aus mega63 war nicht der Merker, sondern sein Zuschnitt: Ein BEREITS OFFENER zweiter
  // Tab bekam ihn nie und zeigte mit demselben Cookie weiter geschützte Inhalte. `storage` feuert
  // genau dort — in den fremden Tabs, nicht im schreibenden — und schließt damit exakt diese Lücke.
  //
  // Die Richtung gilt in BEIDE Wege: Wird die Schuld irgendwo eingelöst, fällt die Sperre hier
  // ebenso. Ein Ereignis, das nur sperrt und nie entsperrt, wäre eine Falle statt eines Vorgangs.
  useEffect(() => abmeldeschuldBeobachten(setSignOutFailed), []);

  // ==============================================================================================
  // AUFTRAG-mega64 BLOCK B (2) — DIE SCHULD LÖST SICH AUF, STATT LIEGENZUBLEIBEN.
  // ==============================================================================================
  //
  // In `legal/SignOutBlocked.tsx` stand bis mega64 ausdrücklich: „SIE IST AUSDRÜCKLICH KEIN
  // WIEDERHOLUNGSMECHANISMUS. Kein Zeitgeber, kein Hintergrundversuch (…) Ein automatischer
  // Nachholer wäre wieder eine Zusage, die niemand beobachtet." Der Satz war für eine TAB-LOKALE
  // Sperre vertretbar — sie endete mit dem Tab, also endete auch das Warten.
  //
  // Für eine Schuld, die Tabs und Neuladen überdauert, ist er falsch: Ohne Nachholer hängt ihr Ende
  // daran, dass jemand einen Knopf findet und drückt. Ein Vorgang, dessen Ende von einem Zufall
  // abhängt, ist kein Vorgang. Deshalb gibt es den Nachholer jetzt — und er ist beobachtbar, weil er
  // nicht auf einem Zeitgeber läuft, sondern auf genau den zwei Ereignissen, die „der Server ist
  // vielleicht wieder da" bedeuten: das Netz kommt zurück, oder der Tab wird wieder sichtbar.
  //
  // Dass er durchkommen KANN, ist keine Annahme: `/api/auth/logout` antwortet auch ohne Token mit
  // 204 (`services/auth/src/routes.ts:277-284`). Ein verlorener Token verriegelt den Ausweg nicht.
  //
  // AUFTRAG-mega65 Block B: Der Nachholer trägt jetzt MEHR Gewicht als in mega64 — die Schuld hat
  // seit mega65 keine Frist mehr, die sie irgendwann von selbst wegnimmt (Begründung in
  // `abmeldeschuld.ts`). Genau deshalb muss er auch dort greifen, wo mega64 ihn hat vorbeilaufen
  // lassen (bens GELB-1, s. den zweiten Effekt unten).
  const einloesen = useCallback((): void => {
    void authApi
      .logout()
      .then(() => {
        // Bestätigt. Erst löschen (das erreicht auch die anderen Tabs), dann frisch starten.
        abmeldeschuldLoeschen();
        setSignOutFailed(false);
        queryClient.clear();
        window.location.assign("/");
      })
      .catch(() => {
        // Weiter geschuldet. Kein Zustandswechsel, keine Meldung — der nächste Anlass kommt.
      });
  }, [queryClient]);

  useEffect(() => {
    if (!signOutFailed) {
      return;
    }
    const beiSichtbarkeit = (): void => {
      if (document.visibilityState === "visible") {
        einloesen();
      }
    };
    window.addEventListener("online", einloesen);
    document.addEventListener("visibilitychange", beiSichtbarkeit);
    return () => {
      window.removeEventListener("online", einloesen);
      document.removeEventListener("visibilitychange", beiSichtbarkeit);
    };
  }, [signOutFailed, einloesen]);

  // ==============================================================================================
  // AUFTRAG-mega65 BLOCK B (bens GELB-1) — DER AUFBAU IST AUCH EIN ANLASS.
  // ==============================================================================================
  //
  // Der Nachholer oben wartet auf ZWEI Ereignisse: „das Netz kommt zurück" und „der Tab wird wieder
  // sichtbar". Beide sind Übergänge. Wird eine Seite MIT offener Schuld aufgebaut, während der
  // Browser bereits online UND sichtbar ist, findet keiner dieser Übergänge mehr statt — es versucht
  // also niemand die Abmeldung, und der Zustand löst sich gerade dann nicht auf, wenn er es könnte.
  //
  // Seit mega65 ist das nicht mehr bloß unschön: Die Schuld hat keine Frist mehr, die sie
  // ersatzweise wegnähme. Ein Versuch beim Aufbau ist damit der Weg, der aus jedem liegengebliebenen
  // Merker von selbst herausführt — auch aus einem beschädigten, auch aus einem fremd geschriebenen.
  //
  // Die Abhängigkeit ist bewusst NUR `einloesen` (über `queryClient` stabil), nicht `signOutFailed`:
  // Gelesen wird der Speicher, nicht der State. So läuft dieser Effekt EINMAL beim Aufbau und feuert
  // nicht ein zweites Mal, wenn in diesem Lauf gerade eine Abmeldung scheitert — die hat es
  // buchstäblich soeben versucht.
  useEffect(() => {
    if (!abmeldeschuldGesetzt()) {
      return;
    }
    // `navigator.onLine === false` ist die einzige verlässliche Aussage dieses Merkmals (`true`
    // heißt nur „irgendein Netz"). Genau so wird er hier gelesen: nicht als Zusage, sondern als
    // Ausschluss des offensichtlich sinnlosen Versuchs.
    if (navigator.onLine === false || document.visibilityState === "hidden") {
      return;
    }
    einloesen();
  }, [einloesen]);

  // ==============================================================================================
  // AUFTRAG-mega64 BLOCK B (3) — DER ZWEITE AUSWEG: DIE SITZUNG IST SICHER WEG.
  // ==============================================================================================
  //
  // Der Nachholer oben braucht ein Ereignis. Dieser Weg braucht keines: `/auth/me` wird ohnehin
  // periodisch abgefragt. Antwortet es mit 401, ist die Sitzung nicht „vielleicht weg", sondern
  // BEWIESEN weg — und damit ist die Abmeldung erreicht, egal wer sie beendet hat.
  //
  // AUSDRÜCKLICH NUR BEI 401. Ein Netzfehler setzt `isError` genauso (react-query unterscheidet das
  // nicht), bedeutet aber das Gegenteil: Wir wissen dann gerade NICHTS. Würde hier `me.isError`
  // stehen, löste sich die Sperre bei Netzstörung von selbst auf — also genau in dem Fall, der sie
  // ausgelöst hat. Das wäre der ganze Mangel aus mega62 zurück, nur besser versteckt.
  const sitzungBewiesenWeg = me.isError && me.error instanceof ApiError && me.error.status === 401;
  useEffect(() => {
    if (signOutFailed && sitzungBewiesenWeg) {
      abmeldeschuldLoeschen();
      setSignOutFailed(false);
    }
  }, [signOutFailed, sitzungBewiesenWeg]);

  const value: AuthState = {
    // FE-FND-08: bei Abfragefehler (abgelaufene Session/401) kein stale User.
    // WP-KLARA-2 (typ-neutral): undefined → null VOR dem Aufruf, damit der Generic sauber auf
    // SessionUser bindet (verhaltensgleich — resolveSessionUser normalisierte ?? null ohnehin).
    user: resolveSessionUser({ data: me.data ?? null, isError: me.isError }),
    needsSetup,
    oidcEnabled: status.data?.oidcEnabled ?? false,
    isLoading: status.isLoading || (status.isSuccess && !needsSetup && me.isLoading),
    error: status.isError,
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth"] });
      // AUFTRAG-mega61 Block A: die Schalter-Auskunft hängt seit mega61 an der Sitzung — ein
      // Unangemeldeter bekommt nur die Teilmenge, deren Fläche vor der Anmeldung erreichbar ist.
      // Sie wird mit `staleTime: Infinity` geführt (ein Schalter ändert sich im Betrieb nicht),
      // und ohne diese Zeile bliebe die Teilmenge nach dem Anmelden als vollständige Antwort
      // stehen — Herkunft, Import und Expertensicht wären danach still verschwunden.
      void queryClient.invalidateQueries({ queryKey: ["features"] });
    },
    // Nach dem Logout den Cache leeren UND hart auf "/" neu laden. Ein reines
    // invalidate/clear reicht nicht zuverlässig (React Query behält bei 401 die
    // alten /auth/me-Daten, der Nutzer wirkt weiter angemeldet). Der harte Reload
    // bootet die App frisch; da die Server-Session beendet ist, erscheint der Login.
    signOut: async (opts?: { strict?: boolean }) => {
      // AUFTRAG-mega62 Block C: der STRENGE Weg räumt erst NACH bestätigter Beendigung. Er ist
      // bewusst als eigener Zweig gebaut und nicht als Umbau des Bestandswegs — der ist ein
      // gemeinsamer Weg (Kopfzeile, Sitzungsende), und andere Aufrufer dürfen ihr Verhalten nicht
      // verlieren, nur weil eine Fläche eine strengere Zusage braucht.
      if (opts?.strict) {
        await authApi.logout().catch((fehler: unknown) => {
          // Kein kommentarloses Weiterleiten: Die Anwendung darf nicht behaupten, die Sitzung sei
          // beendet, wenn der Server das nicht bestätigt hat. Ab hier ist die geschützte Nutzung
          // gesperrt (s. `Gate`), und der Aufrufer erfährt den Fehler.
          // AUFTRAG-mega63 Block A: der Merker ZUERST, dann der React-State. Bricht der Lauf
          // dazwischen ab (Absturz, sofortiges Neuladen), ist die Sperre bereits festgehalten;
          // die umgekehrte Reihenfolge ließe genau dann eine Lücke.
          // AUFTRAG-mega64 Block B: dieselbe Reihenfolge, jetzt zusätzlich mit der Wirkung, dass
          // die anderen Tabs es im selben Moment über `storage` erfahren.
          abmeldeschuldSetzen();
          setSignOutFailed(true);
          throw fehler;
        });
        // Erst HIER — der Server hat die Beendigung bestätigt. Ohne dieses Löschen wäre die Sperre
        // eine Sackgasse: Der Knopf auf der Sperrfläche käme durch, und nach dem Neuladen stünde
        // die Sperre trotzdem wieder da.
        abmeldeschuldLoeschen();
        setSignOutFailed(false);
        queryClient.clear();
        window.location.assign("/");
        return;
      }
      try {
        await authApi.logout();
      } finally {
        queryClient.clear();
        window.location.assign("/");
      }
    },
    signOutFailed,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useSession(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) {
    throw new Error("useSession muss innerhalb von <AuthProvider> verwendet werden.");
  }
  return ctx;
}

// Session-Hilfslogik (SCRUM-152 / FE-FND-08).
// Bewusst ohne Import aus `api/auth`/`api/client`, damit dieses Modul (und sein
// Test) den API-Client nicht in den Node-/Root-Typecheck zieht.
//
// JOB 4333: Bis hierher war dieses Modul vollständig DOM-frei. Es ist es weiterhin bis auf EINE
// Funktion (`offeneVorgaengeAmGeraet`), und die steht hier aus einem Grund, der keine Bequemlichkeit
// ist: Genau ZWEI Stellen brauchen dieselbe Auskunft — der Torwächter (`App.tsx`) und die Fläche
// (`pages/Mobile.tsx`). Ein Import der einen in die andere ginge nicht: `App.tsx` → `Mobile.tsx`
// wäre ein statischer Zug auf die Handy-Seite und bräche die Aufteilung des Eintrittsstücks
// (`routes.tsx` lädt sie nach, gepinnt in `tests/erstladezeit/`); `Mobile.tsx` → `App.tsx` wäre ein
// Zyklus. Zweimal getippt wäre sie zwei Wahrheiten. Also einmal, hier, mit einem Rückfall für jede
// Umgebung ohne `localStorage`.
import { type QueuedOp, pendingCount } from "./offlineQueue";

// Konservatives Auto-Refresh-Intervall für Session-Status/-User (5 Minuten).
export const SESSION_REFRESH_MS = 5 * 60_000;

// Sichere Ableitung des Session-Users: schlägt die `/auth/me`-Abfrage fehl
// (z. B. abgelaufene Session / 401), gilt der Nutzer als abgemeldet — es werden
// KEINE alten (stale) User-Daten weitergereicht.
export function resolveSessionUser<T>(me: { data?: T | null; isError: boolean }): T | null {
  if (me.isError) {
    return null;
  }
  return me.data ?? null;
}

// ================================================================================================
// JOB 4333 — DIE SITZUNGSFRAGE HAT DREI ANTWORTEN, NICHT ZWEI.
// ================================================================================================
//
// Bis hierher kannte die Anwendung genau zwei Zustände: „ein Nutzer steht fest" und „keiner". Der
// zweite wurde überall als „abgemeldet" gelesen — auch dann, wenn niemand GEFRAGT werden konnte.
// Ohne Netz ist das der Normalfall (`/auth/status` scheitert am Transport, `/auth/me` wird deshalb
// gar nicht erst gestellt), und die Folge war die Anmeldemaske über der eigenen, noch nicht
// übertragenen Arbeit (gemessen: JOB 4322, Station (b), `jobs/4322/runde-2/ben.md:20`).
//
// „Ich konnte nicht fragen" ist aber keine Antwort, sondern eine WISSENSLÜCKE — und die wird hier
// benannt statt geraten. Das Vorbild steht seit JOB 4105 in `AuthContext` selbst:
// `selfRegistrationEnabled` ist aus genau diesem Grund dreiwertig.
export type Sitzungslage =
  /** Der Server hat geantwortet, und es besteht eine Sitzung. */
  | "bestaetigt"
  /** Der Server hat geantwortet: es besteht KEINE Sitzung (401/403 oder leere Auskunft). */
  | "keineSitzung"
  /** Niemand hat geantwortet — Netz-/Transportfehler oder clientseitiger Abbruch. */
  | "unbeantwortet";

/**
 * Die drei Lagen aus zwei Tatsachen. `ohneAntwort` bildet ausdrücklich die FEHLERART ab und nicht
 * `navigator.onLine`: „es ist ein Netz da" sagt nichts darüber, ob der Server geantwortet hat, und
 * ein abgewiesener Aufruf ist auch ohne sichtbares Netz eine Antwort.
 *
 * REIHENFOLGE IST BEDEUTUNG: Steht ein Nutzer fest, ist die Frage beantwortet — auch wenn eine
 * SPÄTERE Auffrischung am Transport gescheitert ist. Sonst kippte jede Netzstörung eine bestehende
 * Sitzung in die Wissenslücke.
 */
export function resolveSitzungslage(q: { user: unknown; ohneAntwort: boolean }): Sitzungslage {
  if (q.user !== null && q.user !== undefined) {
    return "bestaetigt";
  }
  return q.ohneAntwort ? "unbeantwortet" : "keineSitzung";
}

/**
 * Der Speicherplatz der Offline-Warteschlange. Die EINE Quelle dieses Namens ist
 * `app/useOfflineQueue.ts` (dort `STORAGE_KEY`); sie ist dort bewusst nicht exportiert, weil dieser
 * Hook der einzige SCHREIBER ist. Hier steht der Name ein zweites Mal, weil dieser Auftrag jene
 * Datei nicht anfassen darf — und damit daraus keine zweite Wahrheit wird, pinnt
 * `tests/offline-neuladen-sitzung/sitzungslage-und-bestand.test.ts` die Gleichheit beider
 * Zeichenketten am Quelltext.
 */
export const OFFLINE_WARTESCHLANGE_SCHLUESSEL = "kw.offlineQueue.v1";

/**
 * JOB 4333: Wie viele Vorgänge liegen auf DIESEM Gerät und sind noch nicht übertragen?
 *
 * KONTOUNABHÄNGIG, und das ist die ganze Aussage: Wem sie gehören, steht ohne beantwortete
 * Sitzungsfrage nicht fest (JOB 4249) — es wird deshalb weder zugeordnet noch gesendet noch
 * gelöscht, und es werden weder Titel noch Inhalte herausgegeben. Gezählt wird nach DERSELBEN Regel
 * wie auf der Fläche (`pendingCount`, `lib/offlineQueue.ts`), damit „liegt hier etwas" und „so viele
 * liegen hier" nicht auseinanderlaufen können.
 *
 * NUR LESEN, NIE SCHREIBEN. Das ist kein zweiter Warteschlangen-Zugang: der Bestand wird nicht
 * ausgewertet, nicht verändert und nicht persistiert. Und er kann in der einzigen Lage, in der
 * diese Funktion gebraucht wird, auch gar nicht wandern — ohne bestätigtes Konto nimmt
 * `useOfflineQueue.enqueue` nichts an und `syncNow` sendet nichts (JOB 4249).
 *
 * Jeder Fehler endet in `0`: ein unlesbarer Speicher ist kein Beleg für liegende Arbeit.
 */
export function offeneVorgaengeAmGeraet(): number {
  if (typeof localStorage === "undefined") {
    return 0;
  }
  try {
    const roh = localStorage.getItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL);
    if (roh === null) {
      return 0;
    }
    const liste: unknown = JSON.parse(roh);
    return Array.isArray(liste) ? pendingCount(liste as QueuedOp[]) : 0;
  } catch {
    return 0;
  }
}

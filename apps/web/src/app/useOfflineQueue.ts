// Dünner DOM-Hook über die reine offlineQueue-Logik (SCRUM-113 / FE-MOB-07).
// Persistenz: localStorage (kw.offlineQueue.v1). Sync ruft die ECHTEN Draft-Endpoints —
// keine Fake-Sync-Logik; Stati spiegeln das tatsächliche fetch-Ergebnis.
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionUser } from "../api/auth";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { DraftPayload } from "../api/types";
import {
  type NewOp,
  type QueueCounts,
  type QueuedOp,
  clearSynced,
  countByStatus,
  enqueue as enqueueOp,
  gehoertKonto,
  markFailed,
  markPending,
  markSynced,
  ohneEigentuemer,
  pendingCount,
  replacePayload,
  reviveInterrupted,
  syncableOps,
} from "../lib/offlineQueue";
import { useSession } from "./AuthContext";

const STORAGE_KEY = "kw.offlineQueue.v1";

// ================================================================================================
// JOB 4249 R4 — DER SCHLÜSSEL, UNTER DEM „WER BIN ICH?" GEFÜHRT WIRD.
// ================================================================================================
//
// `AuthContext.tsx` stellt die Sitzungsfrage als `useQuery({ queryKey: ["auth", "me"] })`. Hier
// wird dieselbe Abfrage NUR GELESEN — nicht gestartet, nicht ungültig gemacht, nicht geschrieben.
// Gelesen wird ausschliesslich EINE Tatsache: läuft gerade ein Abruf? Das ist die einzige Auskunft
// darüber, ob die zwischengespeicherte Kennung noch als BESTÄTIGT gelten darf.
//
// AUSDRÜCKLICH NUR `me` UND NICHT `["auth"]`: `["auth", "status"]` sagt, ob der Server eingerichtet
// ist, und nichts darüber, WER angemeldet ist. Ein Abruf darauf ist kein Grund zu schweigen.
const KONTO_ABFRAGE = ["auth", "me"] as const;

// ================================================================================================
// JOB 4249 R5 (BEN Korrekturpflicht 1) — EIN EINZIGER, LEBENDER BLICK AUF DIE SITZUNG.
// ================================================================================================
//
// DREI RUNDEN, DREI ZEITFENSTER, EINE URSACHE. R2 schloss „das Konto wechselt zwischen zwei
// Aufrufen", R4 schloss „die Auffrischung läuft noch" — und BEN fand in R4 das dritte Fenster:
// die Antwort ist DA (im Zwischenspeicher steht bereits B), aber React hat noch nicht gerendert.
// Der gerenderte `kontoRef` sagte weiter A, der Abrufzähler sagte schon „nichts unterwegs", und
// zwischen diesen beiden Auskünften ging der nächste Vorgang als B hinaus.
//
// Das Muster ist nicht „noch ein Fenster", sondern die Bauform: **jede aus dem Rendern abgeleitete
// Auskunft ist eine Momentaufnahme**, und zwischen zwei `await` ist eine Momentaufnahme von vorhin
// wertlos. Zwei getrennte Momentaufnahmen (Kennung aus dem Render, Abrufzustand aus dem Speicher)
// sind sogar schlechter als eine: sie können einander widersprechen, und genau in diesem
// Widerspruch lag das dritte Fenster.
//
// DESHALB STEHT HIER EINE FUNKTION UND KEINE ZWEI. Sie liest **einen** Zustand — den der Abfrage
// `["auth", "me"]`, die `AuthContext` ohnehin führt — und entnimmt ihm **beide** Tatsachen in
// einem Zug: WER zuletzt bestätigt wurde und OB diese Bestätigung gerade noch gilt. Beides aus
// demselben Objekt, also niemals gegeneinander veraltet. Kein zweiter Sitzungszugang, keine zweite
// Wahrheit: `AuthContext` bleibt der einzige, der diese Abfrage anlegt, ausführt und auswertet —
// hier wird sie nur gelesen.
//
// WARUM NICHT EINFACH `useSession()` IN DER SCHLEIFE: weil genau das der Fehler war. Der Wert aus
// `useSession()` entsteht beim Rendern; er ist richtig für das, was der Mensch SIEHT, und falsch
// für das, was im nächsten Augenblick GESCHRIEBEN wird. Die Fläche liest weiter den gerenderten
// Wert (s. `kontolage`), der Schreibweg liest hier.
// Bewusst NICHT exportiert (Aufrufer-Wächter, `tests/capture/aufrufer-waechter.test.ts`): diese
// Auskunft hat genau einen Ort, an dem sie gebraucht wird — den Schreibweg in dieser Datei. Wer sie
// herausreichte, lüde dazu ein, an einer zweiten Stelle über die Sitzung zu entscheiden.
// ================================================================================================
// JOB 4249 R6 (BEN Korrekturpflicht 1) — EINE BESTÄTIGUNG HAT EINEN ZEITPUNKT, NICHT NUR EINEN WERT.
// ================================================================================================
//
// R5 las „ist gerade ein Abruf unterwegs?" und hielt alles andere für bestätigt. BEN hat daran das
// vierte Fenster gemessen (Prüfstand e1172ae1ea84): eine Auffrischung, die OFFLINE angestossen
// wurde, steht in `fetchStatus: "paused"` — es ist tatsächlich nichts unterwegs, aber es ist auch
// nichts bestätigt. Beim `online`-Ereignis lief der Sendelauf los, bevor react-query die angehaltene
// Abfrage fortsetzen konnte: As Entwurf ging als B hinaus (`bListe: 1, gesendet: 1, rest: 0`).
//
// DAS PFLASTER WÄRE `fetchStatus !== "idle"` GEWESEN, und es hätte BENs Probe grün gemacht. Es lässt
// aber das nächste Fenster offen, und die Steuerung hat in Runde 6 ausdrücklich danach gefragt: eine
// Auffrischung, die im Zustand `idle` mit ALTEM Bestand dasteht. Solange die zuletzt geholte Antwort
// jünger ist als `staleTime` (im Betrieb 30 s, `main.tsx`), frischt react-query bei zurückkehrender
// Verbindung GAR NICHT auf — die Abfrage bleibt `idle`, und die Kennung von vorhin gälte weiter als
// bestätigt, obwohl zwischen ihr und jetzt eine Verbindungslücke liegt.
//
// DIE REGEL, DIE BEIDE FENSTER UND IHRE NACHFOLGER SCHLIESST, ist deshalb keine dritte Abfrage auf
// einen weiteren Zustandsnamen, sondern eine Aussage über ZEIT: **eine Bestätigung, die vor der
// letzten Verbindungslücke eingeholt wurde, bestätigt danach nichts mehr.** Was während der Lücke
// geschehen ist, hat dieser Client nicht gesehen — und `navigator.onLine === true` sagt nur, dass
// wieder ein Netz da ist, nicht, wer am anderen Ende angemeldet ist (BENs Satz, wörtlich).
//
// DAMIT DARAUS KEINE SPERRE WIRD, holt der Sendeweg die fehlende Bestätigung aktiv nach, statt auf
// einen Zufall zu warten (s. `bestaetigungAnfordern`): dieselbe Abfrage, die `AuthContext` ohnehin
// führt, wird um eine Antwort GEBETEN — kein zweiter Sitzungszugang, keine zweite Wahrheit.
interface Sitzungsstand {
  /**
   * Die Kennung aus der zuletzt ERFOLGREICH beantworteten Sitzungsabfrage — oder `null`, wenn es
   * keine gibt (nie beantwortet, mit Fehler beantwortet, niemand angemeldet). `null` heisst
   * ausdrücklich NICHT „unverändert der von vorhin": ein Fehler löscht die Auskunft, genau wie in
   * `resolveSessionUser` (`lib/sessionState.ts`).
   *
   * SIE BLEIBT AUCH DANN STEHEN, WENN SIE NICHT MEHR BESTÄTIGT IST (s. `unbestaetigt`) — sonst
   * könnte am Handy ohne Netz nichts mehr erfasst werden, und der ganze Auftrag begänne mit
   * Datenverlust. Annehmen darf auf die Erinnerung, Senden nicht.
   */
  konto: string | null;
  /**
   * Ist diese Auskunft GERADE JETZT belastbar? `false` heisst bestätigt. `true` heisst eines von
   * drei Dingen, und alle drei bedeuten dasselbe für den Schreibweg — es geht nichts hinaus:
   *   · ein Abruf ist unterwegs (`fetching`),
   *   · ein Abruf ist angehalten (`paused`, offline angestossen) — BENs vierter Befund,
   *   · die Antwort stammt von VOR der letzten Verbindungslücke (`veraltet`).
   */
  unbestaetigt: boolean;
  /**
   * Nichts ist unterwegs, was die Auskunft noch ändern könnte (`fetchStatus === "idle"`). Nur in
   * dieser Lage wird eine Bestätigung ANGEFORDERT: läuft schon ein Abruf oder wartet ein
   * angehaltener auf die Verbindung, kommt die Antwort von selbst.
   */
  ruht: boolean;
}

function sitzungsstandLesen(qc: QueryClient, netzLuecke: number): Sitzungsstand {
  const zustand = qc.getQueryState<SessionUser | null>(KONTO_ABFRAGE);
  if (!zustand) {
    // Die Abfrage ist noch nicht einmal angelegt (erster Aufbau, oder `AuthContext` hält sie noch
    // zurück, weil `/auth/status` aussteht). Nichts ist bestätigt.
    return { konto: null, unbestaetigt: true, ruht: true };
  }
  const kennung = zustand.status === "success" ? zustand.data?.id : undefined;
  const konto = typeof kennung === "string" && kennung !== "" ? kennung : null;
  // `dataUpdatedAt` ist der Zeitpunkt der letzten ERFOLGREICHEN Antwort (react-query setzt ihn mit
  // `Date.now()`, derselbe Zeitgeber wie `netzLuecke`). `<=` und nicht `<`: fielen Antwort und
  // Verbindungsabriss in dieselbe Millisekunde, gilt die vorsichtigere Auslegung.
  const veraltet = konto !== null && zustand.dataUpdatedAt <= netzLuecke;
  // `fetchStatus !== "idle"` fasst BEIDE laufenden Lagen — `fetching` UND `paused`. Der Unterschied
  // zwischen ihnen ist für diese Frage keiner: in beiden steht eine Antwort aus.
  const ruht = zustand.fetchStatus === "idle";
  return {
    konto,
    // `pending` heisst „es gab noch nie eine Antwort" — das ist das Gegenteil von bestätigt.
    unbestaetigt: !ruht || zustand.status === "pending" || veraltet,
    ruht,
  };
}

// ================================================================================================
// JOB 4193 — DER GESEHENE STAND REIST AUCH DURCH DIE WARTESCHLANGE.
// ================================================================================================
//
// DER BEFUND, den `Mobile.tsx:157-163` seit JOB 3377 selbst benannt hat: die Warteschlange kannte
// keinen Standvergleich. Ein offline bearbeiteter Entwurf ging beim Nachsenden nach dem alten
// Vertrag „letzter Schreiber gewinnt" raus — hat der Desktop inzwischen gespeichert, war seine
// Fassung danach still weg.
//
// DIE BAUFORM, und warum der Stand HIER wohnt und nicht in `lib/offlineQueue.ts`: der reine
// Warteschlangen-Vertrag (`QueuedOp`) beschreibt einen VORGANG mit seiner Nutzlast; der gesehene
// Stand ist keine Nutzlast, sondern die Voraussetzung, unter der dieser Vorgang gelten darf. Er
// wird deshalb hier, am einzigen Ort, der wirklich sendet, an den Vorgang geheftet und beim
// Senden als `expectedUpdatedAt` mitgegeben. Die reinen Funktionen dort bleiben unangetastet und
// tragen ihn durch, weil sie durchweg mit `{ ...q }` arbeiten — genau DAS ist in
// `tests/entwurf-mobil-desktop/standvergleich-mobil.test.ts` gepinnt, damit es nicht zufällig gilt.
//
// WAS DAS NICHT IST: eine zweite Konfliktlogik. Abgewiesen wird mit demselben 409 `DRAFT_STALE`
// der bestehenden Route (JOB 2684 D1); der Vorgang bleibt als `failed` in der Warteschlange
// stehen, und aufgelöst wird er dort, wo ein Mensch ist — beim Wiederöffnen des Entwurfs
// (`Mobile.tsx`). Still überschrieben wird nichts mehr.
export interface VorgangMitStand extends QueuedOp {
  /** Der beim Bearbeiten gesehene `Draft.updatedAt`. Fehlt bei `draft.create`. */
  seenUpdatedAt?: string;
}

export interface NeuerVorgang extends NewOp {
  seenUpdatedAt?: string;
}

// ================================================================================================
// JOB 4249 — WER IST HIER ANGEMELDET? DREI ANTWORTEN, NICHT ZWEI.
// ================================================================================================
//
// Die Warteschlange liegt am GERÄT, die Berechtigung am KONTO. Zwischen beiden steht die Sitzung,
// und die kennt drei Lagen — nicht zwei. Die dritte ist die wichtige: `unbekannt` heisst „die
// Sitzung war nicht abrufbar", und das ist etwas ganz anderes als „niemand ist angemeldet". In
// beiden Fällen gilt dasselbe: es wird NICHTS gesendet. Schweigen ist hier richtig, Raten ist
// falsch — geraten hiesse, einen fremden Entwurf unter fremdem Namen anzulegen.
export type Kontolage = { art: "laedt" } | { art: "bekannt"; konto: string } | { art: "unbekannt" };

export interface SyncResult {
  synced: number;
  failed: number;
  /**
   * Vom Server als VERALTET abgewiesen (409 `DRAFT_STALE`). Bewusst getrennt von `failed`
   * gezählt: „konnte nicht gesendet werden" und „durfte nicht überschreiben" sind zwei
   * verschiedene Nachrichten an den Menschen. Die Vorgänge liegen in beiden Fällen weiter in der
   * Warteschlange — verloren geht nichts.
   */
  stale: number;
  /**
   * JOB 4193 R5: Aktualisierungsvorgänge OHNE gesehenen Stand — Reste aus einer Sitzung vor diesem
   * Auftrag. Sie werden nicht gesendet (das wäre der alte, ungeschützte Weg) und nicht gelöscht;
   * sie bleiben liegen, bis der Entwurf geöffnet und verglichen wurde.
   */
  ohneVoraussetzung: number;
  /**
   * JOB 4249: Vorgänge eines ANDEREN Kontos. Sie wurden nicht gesendet — und sonst auch nichts mit
   * ihnen gemacht: nicht gelöscht, nicht umgeschrieben, nicht umgehängt. Sie liegen unverändert
   * weiter im Speicher, bis ihr Eigentümer zurückkommt.
   */
  fremd: number;
  /**
   * JOB 4249: Vorgänge OHNE Eigentümerfeld — Reste aus einer Sitzung vor diesem Auftrag. Dieselbe
   * Bauform wie `ohneVoraussetzung`: liegen lassen, melden, vom Menschen auflösen lassen. Wer sie
   * dem gerade Angemeldeten zuschlüge, verschenkte fremde Arbeit.
   */
  ohneBindung: number;
  /**
   * JOB 4249: Es lag etwas an, aber das Konto war nicht bestätigt (Sitzung lädt noch oder ist
   * nicht abrufbar) — es wurde deshalb NICHTS gesendet. Keine Zahl, weil hier keine Zahl ehrlich
   * wäre: ohne bekanntes Konto ist nicht einmal entscheidbar, welcher Vorgang eigen ist.
   */
  kontoUnbekannt: boolean;
  /**
   * JOB 4249 R2 (BEN Korrekturpflicht 1): Der Lauf wurde MITTENDRIN angehalten, weil die Bindung
   * nicht mehr galt — das Konto hat gewechselt, die Sitzung ist unbestätigt, oder die Fläche ist
   * ausgehängt. So viele eigene Vorgänge wurden deshalb NICHT mehr angefasst. Sie liegen
   * unverändert weiter in der Warteschlange und gehören weiter dem, der sie angelegt hat.
   */
  abgebrochen: number;
  /**
   * JOB 4249 R4 (BEN Korrekturpflicht 1): Der Lauf wurde angehalten, weil die Kennung des Kontos
   * GERADE NEU GEPRÜFT wird (`/auth/me` ist unterwegs). So viele eigene Vorgänge wurden deshalb
   * nicht mehr angefasst; sie liegen unverändert weiter da.
   *
   * BEWUSST GETRENNT VON `abgebrochen`: „das Konto hat gewechselt" ist eine Tatsache, „das Konto
   * wird gerade bestätigt" ist ein Zwischenstand, der sich von selbst auflöst — der Lauf wird
   * nachgeholt, sobald die Antwort da ist (s. den Nachhol-Effekt unten). Zwei Lagen, zwei Zahlen;
   * in EINE Zahl geworfen, sagte eine davon dem Menschen etwas Falsches.
   */
  auffrischungLaeuft: number;
}

export interface OfflineQueueApi {
  online: boolean;
  /**
   * JOB 4249: die EIGENEN Vorgänge — und nur sie. Fremde und ungebundene liegen weiter im
   * Speicher (und werden persistiert), aber sie verlassen diesen Hook nicht: Titel und Nutzlast
   * eines anderen Kontos haben auf der Fläche des gerade Angemeldeten nichts zu suchen, und kein
   * Aufrufer soll eine fremde Vorgangs-Id in die Hand bekommen (s. `replace`). Ist das Konto
   * unbekannt, ist diese Liste LEER — nicht „alles", denn dann ist nichts als eigen erwiesen.
   */
  queue: VorgangMitStand[];
  counts: QueueCounts;
  pending: number;
  syncing: boolean;
  /** JOB 4249: Wer ist angemeldet? Die Fläche bildet die drei Lagen ab, statt sie zu verrechnen. */
  kontolage: Kontolage;
  /**
   * JOB 4249 R4/R6: Die Kennung ist bekannt, gilt aber GERADE NICHT ALS BESTÄTIGT — weil ein
   * `/auth/me` unterwegs ist, weil eines angehalten wartet (`paused`), oder weil die letzte Antwort
   * von vor der Verbindungslücke stammt. Zustandsmodell §9, Zeilen „Cache mit laufender
   * Auffrischung" und „Cache mit gescheiterter Auffrischung": der letzte bekannte Stand bleibt
   * stehen — Zahlen, Titel, Liste, alles — und daneben steht der Hinweis, dass er gerade bestätigt
   * wird. Gesendet wird in dieser Lage nichts; der Lauf fordert die Bestätigung an und holt sich
   * selbst nach.
   */
  kontoAuffrischung: boolean;
  /** JOB 4249: Anzahl wartender Vorgänge eines ANDEREN Kontos. 0, solange das Konto unbekannt ist. */
  fremde: number;
  /** JOB 4249: Anzahl wartender Vorgänge OHNE Kontobindung. 0, solange das Konto unbekannt ist. */
  ohneBindung: number;
  /**
   * JOB 4249: die ungebundenen Vorgänge selbst — NICHT für die Liste, sondern für den einen Weg,
   * den JOB 4193 R6 für sie vorgesehen hat: das Wiederöffnen des Entwurfs (`resume` in
   * `Mobile.tsx`), wo ein Mensch die liegende Fassung sieht und entscheidet.
   *
   * WARUM GETRENNT VON `queue` UND NICHT DARIN: In der Liste stünde ihr Titel — und wer hier
   * angemeldet ist, weiss von diesem Rest nichts. Über `resume` ist das anders: dieser Weg beginnt
   * in der EIGENEN Entwurfsliste (serverseitig auf eigene Entwürfe gefiltert), es kann also nur ein
   * Rest auftauchen, der zu einem Entwurf gehört, den man ohnehin sehen darf. Zugeordnet wird er
   * dabei nicht, und gesendet wird er weiterhin nicht.
   *
   * Leer, solange das Konto unbekannt ist.
   */
  ungebundene: VorgangMitStand[];
  /**
   * JOB 4249: Liegt auf diesem GERÄT überhaupt etwas? Kontounabhängig und bewusst ein Ja/Nein und
   * keine Zahl — es ist die einzige Aussage, die auch ohne bestätigtes Konto zutrifft, und sie
   * erlaubt der Fläche zu sagen „hier liegt etwas, ich weiss nur noch nicht, wessen".
   */
  hatBestand: boolean;
  /**
   * JOB 4249: `false` heisst ABGELEHNT — das Konto ist nicht bestätigt, es wurde NICHTS
   * angenommen. Der Rückgabewert ist Pflicht und kein Komfort: ein Vorgang ohne Eigentümer wäre
   * neuer ungebundener Bestand, und ein stilles Verschlucken wäre Datenverlust. Der Aufrufer
   * behält den Text im Formular und sagt, was los ist (s. `Mobile.tsx`).
   */
  enqueue: (op: NeuerVorgang) => boolean;
  /**
   * JOB 4193: die Entscheidung eines Menschen ERSETZT die liegende Nutzlast (samt dem Stand, gegen
   * den sie gelten soll). Sie löscht den Vorgang nie still — `replacePayload` (lib/offlineQueue.ts)
   * greift nur, solange er wartet oder gescheitert ist.
   */
  replace: (id: string, payload: DraftPayload, title: string, seenUpdatedAt?: string) => void;
  syncNow: () => Promise<SyncResult>;
}

/**
 * Den Stand vom Vorgang NEHMEN, statt ihn auf `undefined` zu setzen: unter
 * `exactOptionalPropertyTypes` ist „Schlüssel fehlt" etwas anderes als „Schlüssel mit
 * `undefined`", und beim Senden entscheidet genau das, ob ein Stand mitreist.
 */
function ohneStand({ seenUpdatedAt: _stand, ...rest }: VorgangMitStand): VorgangMitStand {
  return rest;
}

function mitStand(op: VorgangMitStand, seenUpdatedAt?: string): VorgangMitStand {
  return seenUpdatedAt ? { ...op, seenUpdatedAt } : ohneStand(op);
}

/**
 * Den Stand an den Vorgang heften, den `enqueue` (lib/offlineQueue.ts) soeben angelegt ODER
 * ersetzt hat. Die zweite Hälfte ist der Grund für diese Funktion: ein zweites Speichern desselben
 * Entwurfs ersetzt den vorhandenen Eintrag in place — sein Stand muss dann mitwandern, sonst
 * gälte für die neue Nutzlast noch die Voraussetzung der alten.
 *
 * JOB 4193 R5 (BEN Korrekturpflicht 1) — EIN VORHANDENER STAND WIRD NIE WEGGESTRICHEN.
 *
 * Bis hierher setzte ein zweites Speichern OHNE Stand den Eintrag auf `ohneStand` zurück. Das war
 * die zweite Hälfte des gemessenen Datenverlusts: der Vorgang lag danach ohne Voraussetzung in der
 * Warteschlange und ging beim Nachsenden nach „letzter Schreiber gewinnt" raus. Die Voraussetzung
 * gehört aber zum ENTWURF, nicht zum einzelnen Klick — ein weiteres Speichern kann sie nicht
 * verlieren, nur ERSETZEN. Kommt ein neuer Stand mit, gilt er; kommt keiner, bleibt der alte.
 */
function standNachfuehren(queue: readonly QueuedOp[], op: NeuerVorgang): VorgangMitStand[] {
  const ersetzt = op.kind === "draft.update" && op.draftId !== null;
  return queue.map((q) =>
    // JOB 4249: der zweite Zweig trägt denselben Eigentümervergleich wie `enqueue`. Ohne ihn
    // schriebe das Speichern von B den gesehenen Stand an DEN Eintrag von A, der zufällig
    // denselben Entwurf betrifft — die Voraussetzung eines fremden Vorgangs, gesetzt von jemandem,
    // der sie nie gesehen hat.
    q.id === op.id ||
    (ersetzt &&
      q.draftId === op.draftId &&
      q.eigentuemer === op.eigentuemer &&
      q.status === "queued")
      ? mitStand(q, op.seenUpdatedAt ?? (q as VorgangMitStand).seenUpdatedAt)
      : q,
  );
}

function load(): VorgangMitStand[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Was beim letzten Mal mitten im Senden abbrach, liegt hier als `pending`. Beim Neustart läuft
    // kein Send mehr — der Rest wird wieder aufgenommen, statt für immer liegenzubleiben (F-0027).
    return raw ? reviveInterrupted(JSON.parse(raw) as VorgangMitStand[]) : [];
  } catch {
    return [];
  }
}

function errMsg(e: unknown): string {
  return e instanceof ApiError
    ? e.message
    : e instanceof Error
      ? e.message
      : "Sync fehlgeschlagen.";
}

/**
 * Gibt es aus diesem Lauf überhaupt etwas zu sagen? EINE Stelle für die Frage — der Aufbau-Anlauf
 * und die Ereignisse beantworteten sie bis JOB 4249 in zwei abgeschriebenen Zeilen, und eine neue
 * Zahl in nur einer der beiden wäre still verschwunden.
 */
function etwasZuMelden(r: SyncResult): boolean {
  return (
    r.synced > 0 ||
    r.failed > 0 ||
    r.stale > 0 ||
    r.ohneVoraussetzung > 0 ||
    r.fremd > 0 ||
    r.ohneBindung > 0 ||
    r.kontoUnbekannt ||
    r.abgebrochen > 0
    // JOB 4249 R4 — `auffrischungLaeuft` steht hier BEWUSST NICHT.
    //
    // Es ist die einzige Lage dieses Hooks, die sich von selbst auflöst: die Sitzungsantwort ist
    // unterwegs, und sobald sie da ist, läuft der Lauf weiter (Nachhol-Effekt unten). Eine Meldung
    // darüber wäre kein Informationsgewinn, sondern eine Warnung vor etwas, das gleich vorbei ist —
    // und sie käme bei JEDER periodischen Auffrischung und jedem Verbindungswechsel.
    //
    // VERSCHWIEGEN WIRD SIE TROTZDEM NICHT: die Zahl steht im `SyncResult` (messbar, nicht
    // verloren), und die FLÄCHE sagt es im Ruhezustand über `kontoAuffrischung` — dort, wo es
    // hingehört, statt als Fehlermeldung über einen Nicht-Fehler.
  );
}

/** Das leere Ergebnis — an vier Stellen gebraucht, deshalb an einer Stelle gebaut. */
function keinLauf(): SyncResult {
  return {
    synced: 0,
    failed: 0,
    stale: 0,
    ohneVoraussetzung: 0,
    fremd: 0,
    ohneBindung: 0,
    kontoUnbekannt: false,
    abgebrochen: 0,
    auffrischungLaeuft: 0,
  };
}

export function useOfflineQueue(onSync?: (r: SyncResult) => void): OfflineQueueApi {
  const qc = useQueryClient();
  const [queue, setQueue] = useState<VorgangMitStand[]>(load);
  // ==============================================================================================
  // JOB 4249 — DAS KONTO WIRD GELESEN, NICHT ÜBERGEBEN.
  // ==============================================================================================
  //
  // Es wäre einfacher gewesen, den Eigentümer als Parameter von `Mobile.tsx` hereinzureichen. Dann
  // hinge die Bindung am Aufrufer — und ein künftiger zweiter Aufrufer, der ihn vergisst, hätte
  // wieder die kontoblinde Warteschlange von vorher. Die Bedingung gehört an die Stelle, die
  // sendet; hier kann kein Aufrufer vorbei (dieselbe Lehre wie `sendeEntwurf` in JOB 4193 R6).
  //
  // NUR LESEND: die Sitzung wird benutzt, nicht geändert.
  const sitzung = useSession();
  // ==============================================================================================
  // JOB 4249 R6 — WANN WAR DIE VERBINDUNG ZULETZT WEG?
  // ==============================================================================================
  //
  // Der Zeitpunkt, ab dem eine Sitzungsantwort von vorhin nichts mehr bestätigt (s.
  // `sitzungsstandLesen`). `0` heisst „seit dem Aufbau ununterbrochen verbunden". Beginnt die
  // Anwendung bereits ohne Netz, zählt der Aufbauzeitpunkt — auch dann liegt zwischen der ersten
  // Antwort und einem späteren Senden eine Lücke, die dieser Client nicht gesehen hat.
  //
  // EIN REF UND KEIN STATE: Der Wert wird im Ereignis geschrieben und zwischen zwei `await`
  // gelesen. Ein gerenderter Wert wäre genau die Momentaufnahme, an der die Runden 3 bis 5
  // gescheitert sind.
  const netzLueckeRef = useRef<number>(
    typeof navigator === "undefined" || navigator.onLine ? 0 : Date.now(),
  );
  /**
   * JOB 4249 R6: Wurde für die aktuelle Lücke schon eine Bestätigung angefordert? Verhindert, dass
   * jeder angehaltene Lauf einen weiteren `/auth/me`-Abruf auslöst. Zurückgesetzt wird er, sobald
   * eine Bestätigung vorliegt — und bei jedem neuen Verbindungsabriss.
   */
  const bestaetigungAngefordertRef = useRef(false);
  // ==============================================================================================
  // JOB 4249 R6 — DIESELBE TATSACHE, EINMAL LEBEND UND EINMAL ZUM ANZEIGEN.
  // ==============================================================================================
  //
  // Bis R5 stand hier `useIsFetching({ queryKey: KONTO_ABFRAGE }) > 0`. Das ist WENIGER als die
  // Regel, nach der gesendet wird: `useIsFetching` zählt ausschliesslich `fetchStatus === "fetching"`
  // — eine angehaltene (`paused`) oder eine veraltete Auskunft sah die Fläche nicht. Der Knopf war
  // dann bedienbar und der Lauf sendete trotzdem nichts: eine Behauptung, genau die, die §9 des
  // Auftrags verbietet.
  //
  // Jetzt steht hier DIESELBE Auskunft, nach der auch geschrieben wird — aus derselben Funktion,
  // nachgeführt an derselben Quelle (dem Zwischenspeicher, s. den Nachhol-Effekt unten). Ein State
  // und kein abgeleiteter Wert, weil die Tatsache nicht nur beim Rendern entsteht.
  const [kontoUnbestaetigt, setKontoUnbestaetigt] = useState<boolean>(
    () => sitzungsstandLesen(qc, netzLueckeRef.current).unbestaetigt,
  );
  const kontolage: Kontolage = sitzung.isLoading
    ? { art: "laedt" }
    : sitzung.user
      ? { art: "bekannt", konto: sitzung.user.id }
      : { art: "unbekannt" };
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [syncing, setSyncing] = useState(false);

  // Refs für stabile, nicht-stale Zugriffe in Event-Handlern / Sync-Schleife.
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const syncingRef = useRef(false);
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;
  // ==============================================================================================
  // JOB 4249 R2 (BEN Korrekturpflicht 1) — IST DIESE FLÄCHE ÜBERHAUPT NOCH DA?
  // ==============================================================================================
  //
  // Ein Sendelauf überlebt das Aushängen: er steht in einem `await`, und wenn die Antwort kommt,
  // ist die Seite womöglich längst verlassen. Die Warteschlange gehört dann dem NÄCHSTEN Aufbau —
  // er hat sie aus dem Speicher gelesen und nimmt einen unterbrochenen Rest selbst wieder auf
  // (`reviveInterrupted`, F-0027). Ein alter Lauf, der danach weitersendet, schickt Vorgänge
  // hinaus, für die niemand mehr zuständig ist, und schreibt sein Ergebnis in einen Zustand, den
  // kein `localStorage` mehr sieht.
  //
  // Beim Aufbau ausdrücklich zurückgesetzt: unter React StrictMode wird einmal ab- und wieder
  // aufgebaut, und ein Merker, der das nicht überlebt, sperrte im Entwicklungsmodus jeden Lauf.
  const abgehaengtRef = useRef(false);
  /**
   * JOB 4249 R4: Ein Lauf wurde angehalten, WEIL die Kennung gerade geprüft wurde — es liegt also
   * noch eigene Arbeit da, die nur auf die Sitzungsantwort wartet. Ein Ref und kein State: er
   * steuert keinen Anblick, sondern nur, ob der Effekt unten etwas nachzuholen hat.
   */
  const nachAuffrischungRef = useRef(false);
  useEffect(() => {
    abgehaengtRef.current = false;
    return () => {
      abgehaengtRef.current = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // Persistenz best effort — Verlust nur bei vollem/blockiertem Storage.
    }
  }, [queue]);

  /**
   * JOB 4249 R6: Die Anzeige an die Tatsache nachführen — und, wenn eine Bestätigung vorliegt, den
   * Riegel für die nächste Anforderung lösen. EINE Stelle für beides, aufgerufen an jedem Anlass,
   * an dem sich die Lage ändern kann: Zwischenspeicher-Ereignis, Verbindungsabriss, Netzrückkehr.
   */
  const lageNachfuehren = useCallback((): Sitzungsstand => {
    const stand = sitzungsstandLesen(qc, netzLueckeRef.current);
    if (!stand.unbestaetigt) {
      bestaetigungAngefordertRef.current = false;
    }
    setKontoUnbestaetigt(stand.unbestaetigt);
    return stand;
  }, [qc]);

  // ==============================================================================================
  // JOB 4249 R6 — DIE FEHLENDE BESTÄTIGUNG WIRD GEHOLT, NICHT ABGEWARTET.
  // ==============================================================================================
  //
  // Ohne diese Stelle wäre die Frischeregel aus `sitzungsstandLesen` eine SPERRE: nach einer kurzen
  // Verbindungslücke steht die Sitzungsantwort im Zustand `idle` und ist jünger als `staleTime` —
  // react-query frischt dann bei zurückkehrender Verbindung gar nicht auf, und die Warteschlange
  // bliebe bis zur nächsten periodischen Abfrage liegen (im Betrieb bis zu fünf Minuten). Genau der
  // Weg, den F-0027 verspricht, wäre wieder zu; dieselbe Falle, die der Aufbau-Anlauf und der
  // Nachholer weiter unten schon je einmal aufgemacht und geschlossen haben.
  //
  // ES IST KEIN ZWEITER SITZUNGSZUGANG. Gebeten wird DIE Abfrage, die `AuthContext` anlegt, ausführt
  // und auswertet — mit demselben `invalidateQueries`, das `AuthContext.refresh` selbst benutzt
  // (`AuthContext.tsx:251`). Hier entsteht keine zweite Antwort und keine zweite Auslegung, nur der
  // Anlass für die eine vorhandene.
  //
  // NUR IM RUHEZUSTAND UND NUR EINMAL JE LÜCKE: Läuft schon ein Abruf oder wartet ein angehaltener
  // auf die Verbindung, kommt die Antwort ohnehin; ein zweiter Anstoss wäre Lärm. Und scheitert der
  // Abruf, steht die Auskunft auf „niemand feststellbar" — dann bricht der Lauf mit
  // `kontoUnbekannt` ab, statt es erneut zu versuchen. Keine Schleife.
  const bestaetigungAnfordern = useCallback(
    (stand: Sitzungsstand): void => {
      if (!stand.ruht || bestaetigungAngefordertRef.current) {
        return;
      }
      bestaetigungAngefordertRef.current = true;
      void qc.invalidateQueries({ queryKey: KONTO_ABFRAGE });
    },
    [qc],
  );

  const enqueue = useCallback(
    (op: NeuerVorgang): boolean => {
      // JOB 4249: EIN VORGANG OHNE EIGENTÜMER ENTSTEHT HIER NICHT MEHR. Ohne bekanntes Konto wird
      // abgelehnt statt ungebunden angelegt — der Aufrufer behält den Text und sagt es dem
      // Menschen.
      //
      // JOB 4249 R5 — dieselbe lebende Quelle wie beim Senden, aber eine SCHWÄCHERE Bedingung, und
      // das ist Absicht: Angenommen wird schon bei bekannter Kennung, auch während einer laufenden
      // Auffrischung. Wer hier ebenfalls auf die Bestätigung wartete, wiese den getippten Text bei
      // JEDER periodischen Auffrischung ab — Datenverlust als Preis für eine Zuordnung, die beim
      // SENDEN ohnehin noch einmal und dann bestätigt geprüft wird. Annehmen ist reversibel,
      // Senden nicht; deshalb die unterschiedliche Schwelle.
      //
      // JOB 4249 R6 macht diese Unterscheidung ZWINGEND, nicht nur angenehm: Seit dieser Runde gilt
      // eine Auskunft von VOR der letzten Verbindungslücke nicht mehr als bestätigt — und ohne Netz
      // liegt die Lücke definitionsgemäss immer hinter der letzten Antwort. Wer hier auf
      // `unbestaetigt` prüfte, nähme am Handy ohne Netz überhaupt nichts mehr an. Das wäre der
      // Auftrag, in sein Gegenteil gedreht.
      const stand = sitzungsstandLesen(qc, netzLueckeRef.current);
      if (stand.konto === null) {
        return false;
      }
      const mitEigentuemer: NeuerVorgang = { ...op, eigentuemer: stand.konto };
      setQueue((q) => standNachfuehren(enqueueOp(q, mitEigentuemer), mitEigentuemer));
      return true;
    },
    [qc],
  );

  const replace = useCallback(
    (id: string, payload: DraftPayload, title: string, seenUpdatedAt?: string) => {
      setQueue((q) =>
        replacePayload(q, id, payload, title).map((o) =>
          o.id === id && o.status === "queued" ? mitStand(o, seenUpdatedAt) : o,
        ),
      );
    },
    [],
  );

  const syncNow = useCallback(async (): Promise<SyncResult> => {
    if (syncingRef.current || typeof navigator === "undefined" || !navigator.onLine) {
      return keinLauf();
    }
    const wartend = syncableOps(queueRef.current) as VorgangMitStand[];
    if (wartend.length === 0) {
      return keinLauf();
    }
    // ============================================================================================
    // JOB 4249 — OHNE BESTÄTIGTES KONTO GEHT NICHTS HINAUS.
    // ============================================================================================
    //
    // Die Sitzung lädt noch, oder ihr Abruf ist gescheitert (`AuthContext` behält bei Fehler
    // KEINEN alten Nutzer, s. `resolveSessionUser`). Beides heisst dasselbe: es ist nicht
    // erwiesen, wem die wartenden Vorgänge gehören. Wer hier den letzten bekannten Namen
    // weiterbenutzte, legte im Zweifel fremde Arbeit unter fremdem Namen an — der teuerste
    // aller Ausgänge. Gemeldet wird das als Lage, nicht als Zahl: ohne Konto ist nicht einmal
    // entscheidbar, welcher Vorgang eigen wäre.
    //
    // JOB 4249 R5: Gelesen wird der LEBENDE Zustand, nicht der gerenderte. Schon der Anfang des
    // Laufs darf nicht auf einer Momentaufnahme stehen — sonst partitioniert die Zeile darunter
    // die Warteschlange nach einem Konto von vorhin.
    const start = sitzungsstandLesen(qc, netzLueckeRef.current);
    if (start.unbestaetigt) {
      // Die Auskunft steht aus (der Normalfall bei zurückkehrender Verbindung, Fokus und alle fünf
      // Minuten) oder stammt von vor der letzten Verbindungslücke. Nichts geht hinaus, nichts wird
      // angefasst, nichts wird gemeldet — die Bestätigung wird angefordert, und der Lauf wird
      // nachgeholt, sobald die Antwort da ist.
      nachAuffrischungRef.current = true;
      bestaetigungAnfordern(start);
      return { ...keinLauf(), auffrischungLaeuft: wartend.length };
    }
    if (start.konto === null) {
      return { ...keinLauf(), kontoUnbekannt: true };
    }
    const konto = start.konto;
    // ============================================================================================
    // JOB 4249 — DREI HAUFEN, UND NUR EINER WIRD ANGEFASST.
    // ============================================================================================
    //
    // `eigene`  gehen hinaus.
    // `fremde`  werden NICHT gesendet, NICHT gelöscht, NICHT umgeschrieben und NICHT umgehängt.
    //           Sie werden gezählt und sonst in Ruhe gelassen — auch kein `markFailed`: ein
    //           Fehlervermerk am Vorgang eines anderen wäre eine Änderung an fremder Arbeit, und
    //           die Meldung dazu läse jemand, den sie nichts angeht.
    // `ungebundene` sind Reste aus einer Sitzung vor diesem Auftrag. Bauform wie
    //           `ohneVoraussetzung` (JOB 4193 R5): liegen lassen, vermerken, melden — aber
    //           niemandem zuschlagen und nie löschen.
    const eigene = wartend.filter((op) => gehoertKonto(op, konto));
    const fremd = wartend.filter((op) => !ohneEigentuemer(op) && !gehoertKonto(op, konto)).length;
    const ungebundene = wartend.filter(ohneEigentuemer);
    syncingRef.current = true;
    setSyncing(true);
    let synced = 0;
    let failed = 0;
    let stale = 0;
    let ohneVoraussetzung = 0;
    let abgebrochen = 0;
    let auffrischungLaeuft = 0;
    for (const alt of ungebundene) {
      setQueue((q) => markFailed(q, alt.id, "Kein Konto hinterlegt — bitte einmal prüfen."));
    }
    // ============================================================================================
    // JOB 4249 R2 (BEN Korrekturpflicht 1) — DIE BINDUNG GILT VOR JEDEM EINZELNEN AUFRUF.
    // ============================================================================================
    //
    // DER BEFUND (BEN R1, an dieser Datei gemessen): Das Konto wurde EINMAL gelesen (`lage`, oben)
    // und EINMAL gefiltert (`eigene`, oben). Die Schleife darunter hat danach nie wieder gefragt.
    // Zwischen zwei Durchläufen liegt aber ein `await` — und darin passt ein ganzer Kontowechsel:
    // A hat zwei Vorgänge offline liegen, der erste ist unterwegs, die Sitzung wechselt auf B, und
    // der ZWEITE ging als B hinaus. BENs Messung: `{ bListe: 1, gesendet: 2 }` statt
    // `{ bListe: 0, gesendet: 1 }`.
    //
    // DIE LEHRE IST DIE VON JOB 4193 R6, nur eine Ebene tiefer: eine Bedingung, die VOR der
    // Schleife steht, deckt den Zustand von vorhin ab, nicht den von jetzt. Sie gehört an den
    // Engpass — und der Engpass ist der einzelne Aufruf, nicht der Lauf.
    //
    // WAS DER ABBRUCH NICHT TUT: Er holt nichts zurück. Ein Aufruf, der bereits unterwegs ist,
    // trägt die Anmeldedaten seines Absendezeitpunkts und gehört dem, der ihn losgeschickt hat —
    // daran kann der Client nichts mehr ändern, und er behauptet es auch nicht. Er sorgt nur
    // dafür, dass KEIN WEITERER dazukommt. Die übrigen Vorgänge bleiben unverändert liegen, mit
    // ihrem Eigentümer, und werden gezählt.
    // ============================================================================================
    // JOB 4249 R5 (BEN Korrekturpflicht 1) — DIE VIER AUSGÄNGE, AUS EINEM EINZIGEN BLICK.
    // ============================================================================================
    //
    // Hier standen bis R4 ZWEI Bedingungen: `bindungGiltNoch()` (Kennung, aus dem Rendern) und
    // `kontoWirdGeprueft()` (Abrufzustand, aus dem Speicher). Beide sind WEG — nicht ergänzt,
    // ersetzt. Zwei Auskünfte aus zwei Quellen können einander widersprechen, und genau in ihrem
    // Widerspruch lag BENs drittes Fenster: die Antwort war schon da (Speicher sagt „nichts
    // unterwegs", Kennung im Speicher: B), aber der gerenderte Wert sagte noch A. Beide Prüfungen
    // gaben grün, und der nächste Vorgang ging als B hinaus.
    //
    // Jetzt gibt es einen Blick und vier Ausgänge, in dieser Reihenfolge:
    //   1. Die Fläche ist weg          → abbrechen (der nächste Aufbau nimmt den Rest auf).
    //   2. Es ist erwiesen JEMAND ANDERES → abbrechen; das ist die endgültige Auskunft, auch wenn
    //      gleichzeitig noch ein Abruf läuft — wer schon weiss, dass es ein anderer ist, muss nicht
    //      erst abwarten.
    //   3. Die Auskunft wird GERADE GEPRÜFT → anhalten und nachholen lassen; das ist der
    //      Normalfall (alle fünf Minuten, bei Fokus, bei zurückkehrender Verbindung) und deshalb
    //      ausdrücklich KEIN Abbruch.
    //   4. Bestätigt beantwortet, aber NIEMAND angemeldet → abbrechen.
    //
    // WAS DER ABBRUCH NICHT TUT: Er holt nichts zurück. Ein Aufruf, der bereits unterwegs ist,
    // trägt die Anmeldedaten seines Absendezeitpunkts und gehört dem, der ihn losgeschickt hat —
    // daran kann der Client nichts mehr ändern, und er behauptet es auch nicht. Er sorgt nur
    // dafür, dass KEIN WEITERER dazukommt. Die übrigen Vorgänge bleiben unverändert liegen, mit
    // ihrem Eigentümer, und werden gezählt.
    for (let i = 0; i < eigene.length; i += 1) {
      const op = eigene[i];
      if (!op) {
        continue;
      }
      const offen = eigene.length - i;
      const stand = sitzungsstandLesen(qc, netzLueckeRef.current);
      if (abgehaengtRef.current) {
        abgebrochen = offen;
        break;
      }
      if (stand.konto !== null && stand.konto !== konto) {
        abgebrochen = offen;
        break;
      }
      if (stand.unbestaetigt) {
        auffrischungLaeuft = offen;
        nachAuffrischungRef.current = true;
        bestaetigungAnfordern(stand);
        break;
      }
      if (stand.konto === null) {
        abgebrochen = offen;
        break;
      }
      // ==========================================================================================
      // JOB 4193 R5 (BEN Korrekturpflicht 2/7) — KEIN AKTUALISIEREN OHNE VORAUSSETZUNG.
      // ==========================================================================================
      //
      // Bis hierher stand hier: „ohne Stand bleibt es beim alten Weg". Genau das war der letzte
      // ungeschützte Schreibweg — ein Vorgang ohne Voraussetzung überschrieb beim Nachsenden jede
      // fremde Änderung still. Seit R5 trägt JEDER am Handy angelegte Aktualisierungsvorgang seinen
      // Stand (er reist aus dem Formular, s. `Mobile.tsx` `neuerVorgang`/`resume`); ohne Stand kann
      // nur noch ein Rest aus einer Sitzung VOR diesem Auftrag liegen.
      //
      // Der wird NICHT blind gesendet und auch NICHT gelöscht: er bleibt liegen und wird gemeldet.
      // Aufgelöst wird er dort, wo ein Mensch ist — beim Öffnen des Entwurfs, wo der Vergleich
      // stattfindet und die Voraussetzung nachgetragen wird. Ein Anlegen (`draft.create`) hat
      // naturgemäss keine Voraussetzung und bleibt unberührt.
      if (op.kind === "draft.update" && op.draftId && !op.seenUpdatedAt) {
        setQueue((q) => markFailed(q, op.id, "Kein gesehener Stand — Entwurf öffnen und prüfen."));
        ohneVoraussetzung += 1;
        continue;
      }
      setQueue((q) => markPending(q, op.id));
      try {
        if (op.kind === "draft.create") {
          // ======================================================================================
          // JOB 4249 — DIE ANLAGE AUS DER WARTESCHLANGE TRÄGT IHRE VORGANGSKENNUNG.
          // ======================================================================================
          //
          // Hier stand `endpoints.drafts.create(op.payload)` — der letzte Anlegeweg des Hauses
          // OHNE Wiederholschlüssel. Folge: legte der Server an und ging die Antwort verloren,
          // erzeugte die Wiederholung einen ZWEITEN Entwurf. Der Vertrag dafür besteht seit
          // JOB 2697 D7 vollständig (Route `POST /api/drafts` trennt die Kennung ab, der Dienst
          // geht über `insertIfOperationAbsent`, die Ablage serialisiert); benutzt hat ihn dieser
          // Weg als einziger nicht.
          //
          // `op.id` IST DIE KENNUNG, und sie ist dafür genau richtig: sie entsteht einmal beim
          // Anlegen des Vorgangs (`crypto.randomUUID`), wird persistiert und übersteht damit auch
          // ein Neuladen mitten im Flug. Derselbe ungelöste Vorgang wird also beliebig oft mit
          // DERSELBEN Kennung wiederholt; nach der bestätigten Antwort verschwindet er
          // (`markSynced` → `clearSynced`), und der nächste fachliche Vorgang bekommt eine neue.
          // Das ist wörtlich die Regel der Vordertür (`job2697-client-vorgangskennung-mounted`).
          // ======================================================================================
          // JOB 4249 R6 — UND SIE TRÄGT IHREN EIGENTÜMER ALS VORAUSSETZUNG MIT.
          // ======================================================================================
          //
          // Fünf Runden lang wurde die Kontobindung im Client geprüft, und fünfmal fand BEN das
          // nächste Zeitfenster zwischen Prüfung und Absenden. Der Grund ist grundsätzlich: welches
          // Cookie der Browser anhängt, entscheidet sich ERST beim Absenden, und darauf hat kein
          // Client Zugriff. Die Prüfungen oben bleiben (sie verhindern, dass der Aufruf überhaupt
          // losgeht) — aber die ZUSAGE hängt ab hier am Server: `expectedOwner` ist die
          // Voraussetzung des Aufrufs, wie `expectedUpdatedAt` beim Aktualisieren darunter. Kommt
          // er mit einem anderen Konto an, legt der Server nichts an und antwortet 409; der Vorgang
          // bleibt liegen und gehört weiter dem, der ihn erfasst hat.
          //
          // `op.eigentuemer` ist hier nie leer: Vorgänge ohne Eigentümer erreichen diese Zeile gar
          // nicht (`eigene` ist auf `gehoertKonto` gefiltert, Altbestand liegt in `ungebundene`).
          await endpoints.drafts.create(op.payload, op.id, op.eigentuemer);
        } else if (op.draftId) {
          await endpoints.drafts.update(op.draftId, op.payload, {
            expectedUpdatedAt: op.seenUpdatedAt as string,
          });
        }
        setQueue((q) => markSynced(q, op.id));
        synced += 1;
      } catch (e) {
        setQueue((q) => markFailed(q, op.id, errMsg(e)));
        if (e instanceof ApiError && e.status === 409 && e.code === "DRAFT_STALE") {
          stale += 1;
        } else {
          failed += 1;
        }
      }
    }
    if (synced > 0) {
      setQueue((q) => clearSynced(q));
      void qc.invalidateQueries({ queryKey: ["drafts"] });
    }
    syncingRef.current = false;
    setSyncing(false);
    return {
      synced,
      failed,
      stale,
      ohneVoraussetzung,
      fremd,
      ohneBindung: ungebundene.length,
      kontoUnbekannt: false,
      abgebrochen,
      auffrischungLaeuft,
    };
  }, [qc, bestaetigungAnfordern]);

  // F-0027 (JOB 2951 D2): EIN Anlauf beim Aufbau.
  //
  // Wer im Büro die Anwendung öffnet, hat die Verbindung SCHON. `online` markiert nur den Übergang
  // und feuert deshalb nicht; `focus` feuert beim ersten Aufbau eines bereits fokussierten Fensters
  // ebenfalls nicht. Ohne diesen Anlauf blieb die aus dem localStorage wiederhergestellte
  // Warteschlange liegen, bis der Mensch zufällig das Fenster wechselte und zurückkam — genau der
  // Weg, den F-0027 verspricht („unterwegs an der Anlage erfassen, im Büro fertigmachen").
  //
  // GENAU EINMAL, über den Ref-Riegel: Startet die Anwendung offline und kommt die Verbindung kurz
  // darauf, darf dieser Anlauf nicht zusätzlich zum `online`-Ereignis feuern — sonst legt derselbe
  // Entwurf zwei Server-Einträge an. Kein neuer Synchronisationsweg: es ist dieselbe `syncNow`,
  // die die Ereignisse unten schon benutzen.
  const startAnlaufRef = useRef(false);
  useEffect(() => {
    if (startAnlaufRef.current) {
      return;
    }
    // ============================================================================================
    // JOB 4249 — DER ANLAUF WARTET AUF DIE SITZUNG, STATT SICH AN IHR ZU VERBRAUCHEN.
    // ============================================================================================
    //
    // Beim Aufbau ist `/auth/me` noch unterwegs; die Lage ist `laedt`. Bliebe der Riegel hier wie
    // bisher bedingungslos stehen, verbrauchte sich der EINE Anlauf an einem Lauf, der nach der
    // Regel oben gar nichts senden darf — die wiederhergestellte Warteschlange bliebe liegen, bis
    // der Mensch zufällig das Fenster wechselt. Genau der Weg, den F-0027 verspricht, wäre wieder
    // zu. Der Riegel fällt deshalb erst, wenn das Konto FESTSTEHT; bei `unbekannt` bleibt er
    // offen, damit eine später doch noch erfolgreiche Sitzung ihren Anlauf bekommt.
    if (kontolage.art !== "bekannt") {
      return;
    }
    startAnlaufRef.current = true;
    if (typeof navigator === "undefined" || !navigator.onLine) {
      return;
    }
    if (syncableOps(queueRef.current).length === 0) {
      return;
    }
    void syncNow().then((r) => {
      if (etwasZuMelden(r)) {
        onSyncRef.current?.(r);
      }
    });
  }, [syncNow, kontolage.art]);

  // ==============================================================================================
  // JOB 4249 R4 (BEN Korrekturpflicht 1, zweite Hälfte) — DER ANGEHALTENE LAUF WIRD NACHGEHOLT.
  // ==============================================================================================
  //
  // Die Bedingung in `syncNow` hält an, solange die Kennung geprüft wird. Ohne diese Stelle wäre
  // das eine SPERRE: eine Auffrischung ist der Normalfall (alle fünf Minuten, bei Fokuswechsel und
  // bei zurückkehrender Verbindung — genau der Augenblick, in dem F-0027 senden will), und der
  // angehaltene Rest bliebe liegen, bis ein Mensch zufällig noch einmal etwas auslöst. Genau der
  // Weg, den F-0027 verspricht, wäre wieder zu — dieselbe Falle, die der Aufbau-Anlauf oben schon
  // einmal aufgemacht und geschlossen hat.
  //
  // ZWEI BEDINGUNGEN, UND BEIDE SIND NÖTIG: Die Antwort ist da, UND es wurde wirklich etwas
  // angehalten (`nachAuffrischungRef`). Die zweite verhindert, dass hier ein ZUSÄTZLICHER,
  // unaufgeforderter Sendeauslöser entsteht — es ist kein zweiter Sendeweg, sondern die Fortsetzung
  // genau des Laufs, den die Bedingung oben unterbrochen hat. Der Merker wird VOR dem Lauf
  // gelöscht; hält der Lauf erneut an, setzt er ihn selbst wieder.
  //
  // Dass das Konto INZWISCHEN ein anderes sein kann, ist kein Sonderfall: `syncNow` liest die Lage
  // ohnehin selbst und schickt dann nichts mehr hinaus, sondern zählt fremd.
  //
  // ==============================================================================================
  // JOB 4249 R5 — DER NACHHOLER HÄNGT AM SPEICHER, NICHT AM BILD.
  // ==============================================================================================
  //
  // Bis R4 stand hier `useEffect(…, [kontoAuffrischung, …])`: nachgeholt wurde, wenn ein GERENDERTER
  // Wert von `true` auf `false` fiel. Das ist derselbe Denkfehler wie in der Sendeschleife, nur mit
  // umgekehrtem Vorzeichen — und er ist gemessen: In A16 beginnt und endet die Auffrischung
  // zwischen zwei Bildern. React sah die Zahl nie steigen, also sah sie auch nie fallen, der Effekt
  // lief nie, und der angehaltene Rest blieb liegen (`gesendet: 1, liegtNoch: 1`). Eine Sperre, die
  // sich nur manchmal löst, ist schlimmer als eine, die sich nie löst: sie fällt nicht auf.
  //
  // Der Nachholer hört deshalb dort zu, wo die Tatsache ENTSTEHT — am Zwischenspeicher selbst. Jede
  // Änderung daran ist ein Anlass nachzusehen; entschieden wird mit demselben `sitzungsstandLesen`
  // wie beim Senden, also nach derselben Regel aus derselben Quelle. `useIsFetching` bleibt, aber
  // nur noch für das, wofür es taugt: den Hinweis auf der Fläche.
  //
  // JOB 4249 R6: Derselbe Zuhörer führt jetzt auch die ANZEIGE nach (`lageNachfuehren`). Das ist
  // kein Beifang, sondern die Bedingung dafür, dass Fläche und Schreibweg dieselbe Auskunft haben:
  // die Fläche hing bis R5 an `useIsFetching` und sah `paused` und „veraltet" nicht.
  useEffect(() => {
    const nachsehen = (): void => {
      const stand = lageNachfuehren();
      if (!nachAuffrischungRef.current) {
        return;
      }
      if (stand.unbestaetigt) {
        return;
      }
      nachAuffrischungRef.current = false;
      if (typeof navigator === "undefined" || !navigator.onLine) {
        return;
      }
      if (syncableOps(queueRef.current).length === 0) {
        return;
      }
      void syncNow().then((r) => {
        if (etwasZuMelden(r)) {
          onSyncRef.current?.(r);
        }
      });
    };
    // EINMAL BEIM AUFBAU, dann bei jedem Ereignis: Wer diese Fläche erst betritt, nachdem die
    // Sitzung längst steht, bekäme sonst bis zum nächsten Zwischenspeicher-Ereignis (im Betrieb bis
    // zu fünf Minuten) einen gesperrten Knopf angezeigt.
    lageNachfuehren();
    return qc.getQueryCache().subscribe(nachsehen);
  }, [qc, syncNow, lageNachfuehren]);

  useEffect(() => {
    const melde = (r: SyncResult): void => {
      if (etwasZuMelden(r)) {
        onSyncRef.current?.(r);
      }
    };
    // ============================================================================================
    // JOB 4249 R6 — DIE LÜCKE WIRD BEIM ABRISS VERMERKT, NICHT BEI DER RÜCKKEHR GERATEN.
    // ============================================================================================
    //
    // `goOffline` schreibt den Zeitpunkt, ab dem jede vorhandene Sitzungsantwort nur noch eine
    // Erinnerung ist. `goOnline` sendet danach nicht sofort los: `syncNow` liest die Lage selbst,
    // findet sie unbestätigt, fordert die Bestätigung an und holt den Lauf nach, sobald die Antwort
    // da ist. Genau hier ging bis R5 As Entwurf als B hinaus — `navigator.onLine === true` sagt,
    // dass ein Netz da ist, und kein Wort darüber, wer angemeldet ist.
    const goOnline = (): void => {
      setOnline(true);
      lageNachfuehren();
      void syncNow().then(melde);
    };
    const goOffline = (): void => {
      netzLueckeRef.current = Date.now();
      // Für die neue Lücke ist noch nichts angefordert — sonst bliebe der Riegel von der vorigen
      // stehen und die nächste Rückkehr holte sich keine Bestätigung.
      bestaetigungAngefordertRef.current = false;
      setOnline(false);
      lageNachfuehren();
    };
    const onFocus = (): void => {
      if (navigator.onLine) {
        void syncNow().then(melde);
      }
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("focus", onFocus);
    // Startet die Anwendung bereits ohne Netz, hat es dafür kein Ereignis gegeben — der Anfangswert
    // von `netzLueckeRef` deckt das ab; hier wird nur die Anzeige daran nachgeführt.
    lageNachfuehren();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("focus", onFocus);
    };
  }, [syncNow, lageNachfuehren]);

  // ==============================================================================================
  // JOB 4249 — WAS DIESE SITZUNG SIEHT, IST IHR EIGENER TEIL DER WARTESCHLANGE.
  // ==============================================================================================
  //
  // Gespeichert (und persistiert) bleibt ALLES — sonst wäre die Zusage „nichts wird still
  // weggeworfen" gebrochen. Herausgegeben wird nur das Eigene: der Titel und die Nutzlast eines
  // fremden Vorgangs gehören nicht auf die Fläche des gerade Angemeldeten, und ohne eine fremde
  // Vorgangs-Id in der Hand kann auch kein Aufrufer (etwa `replace` oder `resume` in `Mobile.tsx`)
  // versehentlich fremde Arbeit umschreiben.
  //
  // IST DAS KONTO UNBEKANNT, IST DIESE LISTE LEER — nicht „alles". Nichts ist dann als eigen
  // erwiesen, und eine Liste, die trotzdem etwas zeigte, wäre eine Behauptung ohne Grundlage.
  const bekannt = kontolage.art === "bekannt" ? kontolage.konto : null;
  const eigene = bekannt === null ? [] : queue.filter((op) => gehoertKonto(op, bekannt));
  const wartend = syncableOps(queue) as VorgangMitStand[];
  return {
    online,
    queue: eigene,
    counts: countByStatus(eigene),
    pending: pendingCount(eigene),
    syncing,
    kontolage,
    // JOB 4249 R6: `online &&` ist kein Vorbehalt, sondern Ehrlichkeit. Ohne Verbindung ist die
    // Auskunft zwar ebenfalls unbestätigt — aber es wird gerade auch nichts bestätigt, und der Satz
    // auf der Fläche („wird gerade bestätigt … es geht von selbst weiter") wäre dann eine
    // Behauptung über einen Vorgang, der nicht läuft. Ohne Netz sagt die Fläche das, was sie schon
    // vorher gesagt hat: der Knopf ist gesperrt, weil keine Verbindung da ist.
    kontoAuffrischung: online && kontoUnbestaetigt,
    fremde:
      bekannt === null
        ? 0
        : wartend.filter((op) => !ohneEigentuemer(op) && !gehoertKonto(op, bekannt)).length,
    ohneBindung: bekannt === null ? 0 : wartend.filter(ohneEigentuemer).length,
    ungebundene: bekannt === null ? [] : queue.filter(ohneEigentuemer),
    hatBestand: pendingCount(queue) > 0,
    enqueue,
    replace,
    syncNow,
  };
}

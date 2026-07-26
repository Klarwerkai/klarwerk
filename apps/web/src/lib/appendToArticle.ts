// SCRUM-435: „Erkenntnis an bestehenden Artikel anhängen" — DOM-freie Auswahl-Logik für den
// Artikel-Picker. Filtert die vorhandenen Wissensobjekte nach Titel (Teilstring, groß-/klein-
// unabhängig); leere Suche zeigt alle.
import type { KnowledgeObject } from "../api/types";

export function filterArticlesByTitle(
  kos: readonly KnowledgeObject[],
  query: string,
): KnowledgeObject[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return [...kos];
  }
  return kos.filter((k) => k.title.toLowerCase().includes(q));
}

// ==============================================================================================
// AUFTRAG-mega18 Block A — BLINDES KOMPENSIEREN IST ABGESCHAFFT.
// ==============================================================================================
//
// WAS HIER VORHER STAND, UND WARUM ES WEG IST. Bis mega17 orchestrierte diese Datei drei
// Serveraufrufe (Anker → n× Beleg → Revision) und nahm bei einem Fehlschlag die bereits
// geschriebenen Belege per `remove-source` zurück. Der begründende Kommentar behauptete, eine
// atomare Komposition sei „mit diesem Aufbau nicht erreichbar" und ein Endpunkt dafür existiere
// nicht. Der zweite Teil war wahr und der erste falsch: das belegte den Ist-Zustand, nicht die
// Unmöglichkeit. Der Endpunkt existiert jetzt (`append-document`, ko-routes.ts), und mit ihm fallen
// beide Konstruktionen weg, die diese Datei getragen hat:
//
//  DIE KOMPENSATION. ben hat sie auseinandergenommen: sie kann selbst scheitern, der zuvor
//  angelegte append-only EvidenceRecord bleibt ohnehin stehen (die Oberfläche erkennt das als
//  `evidence-without-source`), und bei einem UNKLAREN Revisionsausgang macht sie den Schaden erst.
//  Genau dieser Fall war erreichbar: die Route persistierte `ko.revise` und lief danach weiter;
//  wirft dort etwas oder reißt die Verbindung, lehnt der Fetch ab, OBWOHL der Body gespeichert ist.
//  Diese Datei deutete das als „nicht committed", nahm die Quellen zurück, und die Oberfläche
//  meldete „Artikel unverändert". Ergebnis: neuer Inhalt, Quellen weg, Nutzer falsch informiert.
//
//  DAS GESCHLUCKTE ANKER-VERSAGEN. `attachOriginal` lief in einem `try/catch`, das jeden Fehler
//  verwarf und mit `anchor = undefined` weitermachte. Auf `search_attach` und `open` nahm die
//  Policy die ankerlose Quelle an — der Body wurde revidiert, der Beleg hing an nichts. Die
//  Belegpflicht ist jetzt eine eigene, stufenunabhängige Serverregel
//  (services/knowledge-object/src/document-append.ts) und WIRFT, statt ein ignorierbares Ergebnis
//  zu liefern.
//
// WAS STATTDESSEN GILT. Ein Aufruf, drei mögliche Wahrheiten — und keine vierte:
//
//   committed  Der Server hat geantwortet und gesagt, WAS gilt (Version, Anker, Belegstellen).
//              Nichts zu tun, nichts zu raten.
//   rejected   Der Server hat geantwortet und ABGELEHNT, mit Domänen-Fehlercode. Damit ist
//              belegt, dass er den Aufruf verarbeitet und nichts geschrieben hat: der Artikel ist
//              unverändert. Diese Zusage darf die Oberfläche geben, weil sie stimmt.
//   unknown    Der Ausgang ist UNKLAR (Netz weg, 5xx, keine Antwort). Hier — und nur hier — war
//              früher die Kompensation. Jetzt wird derselbe Aufruf mit DERSELBER Kennung
//              wiederholt: er ist idempotent, also ist die Wiederholung gefahrlos und liefert im
//              Erfolgsfall die WAHRHEIT (ggf. als `replayed`). Bleibt es unklar, sagt die
//              Oberfläche genau das — „unklar, bitte den Artikel prüfen" — und rührt nichts an.
//              Ein unklarer Ausgang ist kein Freibrief zum Aufräumen.

/** Die Antwort der Verbund-Operation — das eindeutige Commit-Ergebnis. */
export interface DocumentAppendCommit {
  committed: true;
  operationId: string;
  /** War das die Wiederholung eines bereits abgeschlossenen Vorgangs? */
  replayed: boolean;
  koVersion: number;
  attachmentId: string;
  sourceIds: string[];
  /**
   * Folgeschritte, die NACH dem Commit nicht liefen (Konflikt-/Überschneidungs-Entwertung,
   * KI-Prüfung). Ein ehrlicher Teilbefund: die Revision GILT trotzdem. Wer hieraus schließt, der
   * Inhalt stehe nicht, macht genau den Fehler, den dieser Auftrag behebt.
   */
  followUpsFailed?: string[];
}

/**
 * Domänen-Fehlercodes, bei denen der Ausgang EINDEUTIG ist: der Server hat den Aufruf verarbeitet
 * und nichts geschrieben. Jeder andere Fehler (Netzabbruch, 5xx, unbekannte Form) ist UNKLAR und
 * wird als solcher behandelt — nie als „nichts passiert".
 *
 * Bewusst eine Allowlist und keine Blockliste: ein unbekannter Fehler muss auf der SICHEREN Seite
 * landen, und die sichere Seite ist „unklar, nichts anfassen".
 */
export const DEFINITE_APPEND_REJECTIONS: readonly string[] = [
  // A-2, die interne Belegpflicht — auf jeder Stufe.
  "MISSING_DOCUMENT_ANCHOR",
  // Die externe Stufenregel (attach-policy.ts, unverändert).
  "EXTERNAL_ATTACH_BLOCKED",
  "BAD_REQUEST",
  "INVALID_SOURCE",
  "INVALID_OPERATION_ID",
  // Nebenläufige Änderung: der Compare-and-Set hat NICHT geschrieben.
  "STALE_WRITE",
  "NOT_FOUND",
  "FORBIDDEN",
  "UNAUTHENTICATED",
];

export type AppendOutcomeKind = "committed" | "rejected" | "unknown";

export interface AppendDocumentOutcome {
  kind: AppendOutcomeKind;
  /** Nur bei `committed`: was tatsächlich gilt. */
  commit?: DocumentAppendCommit;
  /** Nur bei `rejected`: der Domänen-Fehlercode, der die Ablehnung belegt. */
  reason?: string;
  /** Die Meldung des Servers (bei `rejected`) bzw. des Fehlers (bei `unknown`). */
  message?: string;
}

/** Liest den Domänen-Fehlercode aus einem Fehler — reines Ducktyping (kein ApiError-Import). */
export function appendRejectionCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const code = "code" in error ? (error as { code: unknown }).code : undefined;
  if (typeof code === "string" && DEFINITE_APPEND_REJECTIONS.includes(code)) {
    return code;
  }
  const body = "error" in error ? (error as { error: unknown }).error : undefined;
  return typeof body === "string" && DEFINITE_APPEND_REJECTIONS.includes(body) ? body : null;
}

export interface DocumentAppendApi {
  /**
   * Vollzieht die Verbund-Operation. Bekommt die Operations-Kennung, damit ein Wiederholversuch
   * DIESELBE benutzt — daran hängt die Idempotenz und damit die ganze Konstruktion.
   */
  append: (operationId: string) => Promise<DocumentAppendCommit>;
}

/**
 * Vollzieht die Übernahme und liefert eine der drei Wahrheiten. Reine Ablauflogik mit injizierter
 * API: testbar ohne DOM, ohne Netz, ohne Backend.
 *
 * BEACHTE, WAS FEHLT: kein `removeSource`, kein `rollback`, kein `sourcesLeft`. Diese Funktion
 * kann nichts zurücknehmen — nicht weil es vergessen wurde, sondern weil sie es nicht darf.
 */
export async function commitDocumentAppend(
  api: DocumentAppendApi,
  operationId: string,
): Promise<AppendDocumentOutcome> {
  const attempt = async (): Promise<AppendDocumentOutcome> => {
    try {
      return { kind: "committed", commit: await api.append(operationId) };
    } catch (error) {
      const reason = appendRejectionCode(error);
      const message = error instanceof Error ? error.message : undefined;
      if (reason) {
        return { kind: "rejected", reason, ...(message ? { message } : {}) };
      }
      return { kind: "unknown", ...(message ? { message } : {}) };
    }
  };
  const first = await attempt();
  if (first.kind !== "unknown") {
    return first;
  }
  // GENAU EIN Wiederholversuch, mit derselben Kennung. Er ist gefahrlos (idempotent) und ersetzt
  // die alte Kompensation: statt zu RATEN, was gilt, wird ehrlich NACHGEFRAGT. Bewusst nur einer —
  // eine Schleife würde bei einem echten Ausfall nur die Wartezeit verlängern, ohne mehr Wahrheit
  // zu liefern; danach ist „unklar" die richtige Auskunft.
  const second = await attempt();
  return second.kind === "unknown" ? first : second;
}

/** Bildet eine Operations-Kennung. Ein Vorgang, ein Schlüssel — über alle Wiederholungen hinweg. */
export function newAppendOperationId(): string {
  return `append-${crypto.randomUUID()}`;
}

// SCRUM-225: DOM-freie Sicht-Ableitung für den eigenständigen External-Knowledge-Einstieg.
// Bildet den Zustand der externen Suche (Server-Proxy, SCRUM-118) auf eine renderbare
// View-Variante ab. Kein KO-Bezug, kein Anhängen, kein Auto-Import — reine Lesesicht.
//
// JOB 3802 · DIE VIER FEHLERZUSTÄNDE, UND DIE REGEL, DIE SIE TRENNT.
//
//   OHNE SERVERANTWORT WIRD KEINE SERVERAUSSAGE BEHAUPTET.
//
//   `disabled`    — der Server HAT geantwortet: 501 / EXTERNAL_SEARCH_DISABLED. Die externe Suche
//                   ist abgeschaltet. Das weiß nur, wer eine Antwort bekommen hat.
//   `unreachable` — es kam GAR KEINE Antwort (Netzabbruch, DNS, Abbruch). Keine Aussage über
//                   Treffer, keine darüber, ob die Suche abgeschaltet ist. Die Fläche zeigt den
//                   Hauskatalogsatz `ext.unavailable`, keine Zeichenkette aus dem Browser.
//   `error`       — der Server hat geantwortet und einen Grund genannt (4xx/5xx). Sein Satz wird
//                   unverändert durchgereicht.
//   `empty`       — eine ERFOLGREICHE Suche ohne Treffer. Nur dann, nie im Fehlerfall.
//
// Geprüft wird auf `ApiError`, NICHT auf `Error`: ein `TypeError` aus `fetch` („Failed to fetch",
// in Safari „Load failed", in Firefox „NetworkError when attempting to fetch resource") ist eine
// `Error`-Instanz und rutschte deshalb bis JOB 3802 als vermeintliche Serveraussage auf die Fläche.
import { ApiError } from "../api/client";
import type { ExternalResult } from "../api/types";

export type ExternalSearchView =
  | { kind: "idle" } // noch nicht gesucht
  | { kind: "loading" } // Anfrage läuft
  | { kind: "disabled" } // EXTERNAL_SEARCH=off → 501, ehrlich angezeigt
  | { kind: "unreachable" } // JOB 3802: die Anfrage hat den Server nicht erreicht
  | { kind: "error"; message: string } // Serverantwort mit Grund
  | { kind: "empty" } // gesucht, keine Treffer
  | { kind: "results"; results: ExternalResult[] };

/**
 * JOB 3802: Der geworfene Wert, EINMAL an EINER Stelle eingeordnet.
 *
 * `serverantwort` ist die einzige Frage, die über `unreachable` entscheidet — und sie ist
 * ausdrücklich ein eigenes Feld statt einer Ableitung aus `status`/`message`: ein fehlender
 * Status kann auch ein Serverfehler ohne Statuszeile sein, und eine Nachricht hat jeder Wurf.
 */
export interface Suchfehler {
  status?: number | undefined;
  code?: string | undefined;
  /** Der Satz des Servers. Ohne Serverantwort ausdrücklich leer — es gibt keinen zu nennen. */
  message: string;
  /** `true` genau dann, wenn der Wert ein `ApiError` ist, der Server also geantwortet hat. */
  serverantwort: boolean;
}

export function klassifiziereSuchfehler(fehler: unknown): Suchfehler | null {
  if (fehler === null || fehler === undefined) {
    return null;
  }
  if (fehler instanceof ApiError) {
    return {
      status: fehler.status,
      code: fehler.code,
      message: fehler.message,
      serverantwort: true,
    };
  }
  // Wissenslücke statt Erfindung: hier wird KEIN Text geraten und keiner aus dem Wurf übernommen.
  // Den Satz für diesen Fall führt der Katalog (`ext.unavailable`), die Fläche setzt ihn.
  return { status: undefined, code: undefined, message: "", serverantwort: false };
}

// EXTERNAL_SEARCH=off liefert serverseitig 501 mit code EXTERNAL_SEARCH_DISABLED
// (services/app/src/routes/external-routes.ts). Beides wird als "deaktiviert" gewertet.
export function isSearchDisabled(status?: number, code?: string): boolean {
  return status === 501 || code === "EXTERNAL_SEARCH_DISABLED";
}

// Treffer ohne URL verwerfen, Dubletten (gleiche URL) entfernen — stabile Reihenfolge.
export function dedupeResults(results: readonly ExternalResult[]): ExternalResult[] {
  const seen = new Set<string>();
  const out: ExternalResult[] = [];
  for (const r of results) {
    const key = r.url.trim();
    if (key.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(r);
  }
  return out;
}

export interface ExternalSearchInput {
  pending: boolean;
  hasSearched: boolean;
  // JOB 1988: `status` und `code` werden vom Aufrufer AUSDRÜCKLICH auf `undefined` gesetzt, wenn
  // der Fehler kein ApiError ist (pages/ExternalKnowledge.tsx:30-31). Unter
  // `exactOptionalPropertyTypes` ist „darf fehlen" nicht dasselbe wie „darf undefined sein" —
  // deshalb steht `| undefined` hier ausdrücklich. Am Wert ändert das nichts.
  // JOB 3802: `serverantwort` darf FEHLEN und heißt dann „nicht erhoben" — nur ein ausdrückliches
  // `false` löst `unreachable` aus. So bleiben Aufrufer, die den Fehler selbst zusammensetzen
  // (und die Bestandsfälle in `tests/analytics/external-knowledge.test.ts`), unverändert gültig.
  error?: {
    status?: number | undefined;
    code?: string | undefined;
    message: string;
    serverantwort?: boolean | undefined;
  } | null;
  // JOB 1988: derselbe Grund wie oben — `search.data` ist `… | undefined`, solange nichts geladen
  // ist, und wird ausdrücklich durchgereicht (pages/ExternalKnowledge.tsx:35).
  results?: readonly ExternalResult[] | undefined;
}

export function buildExternalSearchView(input: ExternalSearchInput): ExternalSearchView {
  if (input.error) {
    // Reihenfolge, und zwar in dieser: `disabled` ZUERST, denn dort hat der Server geantwortet —
    // 501 ist eine Auskunft, kein Ausfall. Erst danach die Frage, ob überhaupt jemand geantwortet
    // hat.
    //
    // GENAU WAS DIESE REIHENFOLGE SCHÜTZT (berichtigt in Runde 2, BEN-Hinweis zu Runde 1): NICHT
    // den Weg über `klassifiziereSuchfehler` — von dort kommen die beiden Bedingungen nie zugleich,
    // ein `ApiError` trägt immer `serverantwort: true`, und ein fehlendes Feld erfüllt `=== false`
    // ohnehin nicht. Geschützt ist der Fall eines Aufrufers, der sein Fehlerobjekt SELBST
    // zusammensetzt und beides zugleich setzt: `status: 501` UND `serverantwort: false`. Dann gilt
    // die Auskunft des Servers, nicht die Vermutung des Aufrufers. Dieser Fall ist einzeln gepinnt
    // (`tests/externe-suche-nicht-erreichbar/netzabbruch-nennt-den-grund.test.tsx`, N5).
    if (isSearchDisabled(input.error.status, input.error.code)) {
      return { kind: "disabled" };
    }
    if (input.error.serverantwort === false) {
      return { kind: "unreachable" };
    }
    return { kind: "error", message: input.error.message };
  }
  if (input.pending) {
    return { kind: "loading" };
  }
  if (!input.hasSearched) {
    return { kind: "idle" };
  }
  const results = dedupeResults(input.results ?? []);
  return results.length === 0 ? { kind: "empty" } : { kind: "results", results };
}

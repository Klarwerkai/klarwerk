// ================================================================================================
// JOB 381 — DER GELTUNGSBEREICH DER BIBLIOTHEK: DIE EINE STELLE, DIE „GEHOERT MIR" ENTSCHEIDET.
// ================================================================================================
//
// Pedis Entscheidung (`ENTSCHEIDUNGEN/JOB-381-ORTSZEILE.md`) gibt zwei Schaltflaechen vor —
// „Meine Ablage" und „Alle Inhalte" — und einen Satz, der ueber allem steht:
//
//   „Die Zeile muss wirken, nicht nur aussehen. 'Meine Ablage' filtert auf createdBy des
//    angemeldeten Nutzers. Eine Schaltflaeche ohne Wirkung waere eine Attrappe."
//
// Diese Datei existiert, damit die Antwort auf „wem gehoert dieses Objekt" an GENAU EINEM Ort
// faellt — dieselbe Begruendung, mit der `services/app/src/sichtbarkeit.ts` die Sichtbarkeitsfrage
// buendelt: wird dieselbe Frage an mehreren Orten beantwortet, sind irgendwann alle Orte falsch.
//
// ================================================================================================
// WELCHES FELD IST `createdBy`? — GEMESSEN, NICHT ANGENOMMEN.
// ================================================================================================
//
// Am Wire der Bibliothekssuche (`GET /api/library/search` -> `KnowledgeObject[]`) gibt es **kein**
// Feld `createdBy`. Die zwei naheliegenden Kandidaten sind beide untauglich, und zwar aus je einem
// konkret belegten Grund:
//
//   · `author` ist der AKTUELLE Verantwortliche, nicht der Ersteller. Die Autor-Uebergabe
//     (`services/knowledge-object/src/service.ts:3675`, FR-LIF-02) schreibt ihn um: „current author
//     aendert sich, originalAuthor bleibt erhalten". Wer sein Objekt uebergibt, verlOre es damit
//     aus der eigenen Ablage — obwohl er es angelegt hat.
//
//   · `originalAuthor` ist beim Confluence-Import ausdruecklich der QUELL-Autor aus dem
//     Fremdsystem (`service.ts:248-254`): „`author` bleibt der annehmende Reviewer (RBAC/Historie),
//     `originalAuthor` traegt den Quell-Autor — KEIN KLARWERK-Nutzer, KEIN Fake-User". Er kann also
//     eine Kennung tragen, zu der sich nie jemand anmelden kann.
//
// DIE KANONISCHE PROJEKTION IST DIE ERSTE HISTORIENZEILE. Sie entsteht bei der Anlage als
// `history: [{ version: 1, at, author: input.author, note: "erstellt" }]` (`service.ts:1564`) und
// haelt drei Eigenschaften, die keiner der beiden Kandidaten hat:
//
//   1. Sie traegt IMMER einen echten KLARWERK-Nutzer — auch auf dem Importweg, wo `input.author`
//      der annehmende Reviewer ist.
//   2. Sie ist STABIL: jede Revision haengt an (`[...ko.history, …]`, `:3136` und `:3361`), keine
//      Stelle im Dienst ueberschreibt Eintrag 0, und die Autor-Uebergabe fasst die Historie nicht
//      an (`:3677` schreibt `{ ...ko, author }`).
//   3. Sie ist AM WIRE: die Suchprojektion laesst ausschliesslich `bodyHtml` weg — in beiden
//      Kompositionswurzeln (InMemory `repo.ts:355` `map(({ bodyHtml: _omitted, ...rest }) => rest)`,
//      Postgres `SELECT data - 'bodyHtml' AS data FROM kos`).
//
// FAIL-CLOSED, UND WARUM DAS HIER NICHT UEBERTRIEBEN IST: Ohne Nutzerkennung liefert „Meine
// Ablage" NICHTS — nicht alles. Ein Rueckfall auf die volle Liste waere die schlimmere Haelfte:
// die Zeile behauptet dann „das ist dein Bestand" und zeigt fremden. Dasselbe gilt fuer ein Objekt
// ohne Historie: kein Ersteller bekannt heisst „nicht meins", nicht „vielleicht meins".
import type { KnowledgeObject } from "../api/types";

/** Der URL-Parameter des Geltungsbereichs (PLAN 378 §4.2; die Browsersonde R-18 liest ihn). */
export const LIBRARY_SCOPE_PARAM = "raum";

export type LibraryScope = "alle" | "meine";

/** „Alle Inhalte" ist der Standard — die Bibliothek zeigt ohne Zutun alles, worauf man Zugriff hat. */
export const DEFAULT_LIBRARY_SCOPE: LibraryScope = "alle";

// Die Beschriftungen stehen wortgleich in Pedis Entscheidung (Tabelle: erste „Meine Ablage",
// zweite „Alle Inhalte"). Sie liegen hier und nicht in `i18n.ts`, weil diese Datei fuer JOB 381
// nicht im Schreibscope steht; die fehlende Uebersetzung nach en/nl ist als offener Rest benannt.
export const MEINE_ABLAGE_LABEL = "Meine Ablage";
export const ALLE_INHALTE_LABEL = "Alle Inhalte";
/** Der zugaengliche Name der Schaltflaechengruppe — ohne ihn waeren zwei Knoepfe ohne Kontext. */
export const SCOPE_BAR_LABEL = "Geltungsbereich";

/** Liest den Geltungsbereich aus der Adresse. Alles Unbekannte faellt auf den Standard zurueck. */
export function parseLibraryScope(raw: string | null | undefined): LibraryScope {
  return raw === "meine" ? "meine" : DEFAULT_LIBRARY_SCOPE;
}

/**
 * Wer hat dieses Objekt in KLARWERK angelegt?
 *
 * Bewusst `undefined` statt eines Rueckfalls auf `author`: „unbekannt" und „von dir" sind
 * verschiedene Aussagen, und nur die erste ist hier ehrlich. Ein Altobjekt ohne Historie gehoert
 * damit in keine persoenliche Ablage — es verschwindet nicht, es steht unter „Alle Inhalte".
 */
export function createdByOf(ko: Pick<KnowledgeObject, "history">): string | undefined {
  const ersteZeile = ko.history?.[0];
  const autor = ersteZeile?.author;
  return typeof autor === "string" && autor.length > 0 ? autor : undefined;
}

/** Gehoert dieses Objekt in die Ablage dieses Nutzers? Ohne Kennung: nein. */
export function isOwnKo(
  ko: Pick<KnowledgeObject, "history">,
  userId: string | null | undefined,
): boolean {
  if (typeof userId !== "string" || userId.length === 0) {
    return false;
  }
  return createdByOf(ko) === userId;
}

/**
 * Die Treffermenge auf den Geltungsbereich einschraenken.
 *
 * „Alle Inhalte" laesst die Menge UNVERAENDERT — es ist kein Rechtefilter, sondern eine Sicht; was
 * ein Nutzer ueberhaupt sehen darf, hat der Server bereits entschieden (`sichtbareFuer` plus
 * SQL-Trim an `/api/library/search`). Diese Stelle darf die Menge deshalb nur VERKLEINERN.
 */
export function applyLibraryScope<T extends Pick<KnowledgeObject, "history">>(
  items: readonly T[],
  scope: LibraryScope,
  userId: string | null | undefined,
): T[] {
  return scope === "meine" ? items.filter((ko) => isOwnKo(ko, userId)) : [...items];
}

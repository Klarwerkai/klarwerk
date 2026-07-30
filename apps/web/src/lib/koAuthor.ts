// SCRUM-70 / FR-LIF-04: Vermächtnis-Framing — der Autor ist überall am KO sichtbar.
// Reiner, DOM-freier Helfer: löst Autor (+ Originalautor bei Transfer) zu Anzeigenamen
// auf. Keine neue Backend-Logik, keine Transfer-Logik — nur Darstellung.
export type NameResolver = (id: string) => string;

export interface KoAuthorRef {
  author: string;
  originalAuthor?: string;
}

export interface KoAuthorParts {
  author: string;
  // Nur gesetzt, wenn der Ursprungsautor vom aktuellen Autor abweicht (Transfer).
  originalAuthor?: string;
}

// ================================================================================================
// AUFTRAG-mega51 BLOCK F2 — EINE UUID IST KEIN NAME.
// ================================================================================================
// Fehlt der Verzeichniseintrag zu einer Autoren-Kennung, stand bisher die ROHE Kennung in der
// Oberfläche: `dir.data?.find(...)?.name || uid`. In der Bibliothek traf das die Autorenzeile jeder
// Trefferzeile UND die Autoren-Facette in der Filterschiene. Dieselbe Zeile stand an sechs Stellen
// im Produktbaum (Bibliothek, KO-Detail, Aufgaben, Fragen, Risiko, Validierung) — deshalb steht die
// Antwort jetzt EINMAL hier und nicht sechsmal dort.
//
// WARUM NICHT NUR „Unbekannte Person": zwei verschiedene Kennungen ohne Verzeichniseintrag sähen
// dann wie EINE Person aus — in der Autoren-Facette würden aus zwei Einträgen zwei identische
// Zeilen. Das wäre eine neue Unwahrheit an der Stelle, an der wir gerade eine beseitigen. Deshalb
// trägt die ehrliche Auskunft ein kurzes, stabiles Unterscheidungsmerkmal — nicht die ganze
// Kennung, aber genug, um zwei Unbekannte auseinanderzuhalten.
export const AUTHOR_UNKNOWN_KEY = "ko.authorUnknown";

// ================================================================================================
// AUFTRAG-mega62 BLOCK H — „UNBEKANNTE PERSON" IST EINE AUSSAGE, KEIN LADEZUSTAND.
// ================================================================================================
//
// DER BEFUND (Register A22, vom Kopf am 30.07. im Live-Screenshot gesehen): An den Objekten stand
// überall „Autor: Unbekannte Person (…)". Zwei Hypothesen standen im Raum — ein Statusfilter im
// Verzeichnis oder ein Purge, der den Autor gelöscht hat. Beide sind widerlegt bzw. nicht
// reproduzierbar (Belege im Bericht zu mega62). Was BLEIBT und beweisbar ist, ist der dritte Weg,
// und er erklärt das Symptom vollständig — nämlich für ALLE Objekte auf einmal:
//
//     Jede der sechs Flächen schrieb `dir.data?.find((d) => d.id === uid)?.name`. Ist `dir.data`
//     `undefined` — die Verzeichnis-Abfrage lief noch, oder sie ist FEHLGESCHLAGEN —, liefert das
//     `undefined`, und `authorDisplayName` sagt daraufhin „Unbekannte Person". Für jeden Autor,
//     auf jeder Fläche, gleichzeitig. `useDirectory()` hat weder eine Fehleranzeige noch einen
//     eigenen Wiederholungsvertrag (api/hooks.ts) — ein 401 oder ein Netzfehler bleibt unsichtbar
//     und sieht exakt aus wie „dieser Autor hat keinen Eintrag".
//
// DAS IST DIE EINE STELLE, AN DER DIE OBERFLÄCHE EINEN FEHLER ALS TATSACHE AUSGIBT. Der Rückfall
// selbst bleibt richtig und unverändert (mega51 F2: eine UUID ist kein Name, und zwei Unbekannte
// dürfen nicht wie einer aussehen) — er darf nur nicht mehr für etwas einstehen, das gar nicht
// festgestellt wurde.
//
// DESHALB DREI ZUSTÄNDE STATT ZWEI, und die Entscheidung fällt EINMAL hier statt sechsmal in den
// Seiten — genau die Bewegung, die mega51 F2 für den Rückfalltext schon gemacht hat:
//   1. Verzeichnis da, Eintrag da   → der Name.
//   2. Verzeichnis da, Eintrag fehlt → „Unbekannte Person (ref)" — eine geprüfte Aussage.
//   3. Verzeichnis NICHT da          → keine Aussage über die Person, sondern über uns.
//
// ================================================================================================
// AUFTRAG-mega63 BLOCK B — FALL 3 WAREN IN WAHRHEIT ZWEI FÄLLE.
// ================================================================================================
//
// ben hat die Lücke benannt (BERICHT-ben-sammel60-mega62.md, Abschnitt 3), und der ursprüngliche
// mega62-Auftrag hatte es genau so verlangt: `useDirectory` liefert den vollständigen
// Abfragezustand (api/hooks.ts:130-132), weitergereicht wurde aber nur `directory.data`. „Läuft
// noch" und „fehlgeschlagen" fielen damit beide auf `undefined` zusammen und bekamen denselben
// Text — und der mega62-Test hat diese Zusammenlegung sogar ausdrücklich festgehalten.
//
// WARUM DAS MEHR IST ALS EIN WORT: „lädt noch" ist ein Zustand, der VON SELBST vergeht — die
// richtige Reaktion darauf ist Warten. „Nicht abrufbar" ist einer, der BLEIBT — die richtige
// Reaktion darauf ist, es zu melden. Wer beide gleich beschriftet, macht aus einem Fehler eine
// Geduldsfrage: Die Nutzerin wartet auf etwas, das nicht mehr kommt, und niemand erfährt von dem
// Ausfall. Es ist dieselbe Krankheit wie der ursprüngliche Befund, nur eine Stufe kleiner — eine
// Oberfläche, die einen Zustand als einen anderen ausgibt.
//
// AUS DREI ZUSTÄNDEN WERDEN ALSO VIER:
//   1. Verzeichnis da, Eintrag da    → der Name.
//   2. Verzeichnis da, Eintrag fehlt → „Unbekannte Person (ref)".
//   3. Abfrage läuft                 → „Autorenname wird geladen" — vergeht von selbst.
//   4. Abfrage fehlgeschlagen        → „Autorenname nicht abrufbar" — bleibt, gehört gemeldet.
export const AUTHOR_LOADING_KEY = "ko.authorLoading";
export const AUTHOR_UNAVAILABLE_KEY = "ko.authorUnavailable";

export interface DirectoryEntry {
  id: string;
  name: string;
}

/**
 * Der Abfragezustand des Verzeichnisses — bewusst in der Form, die `useDirectory()` ohnehin
 * liefert. Ein eigenes Zwischenformat wäre eine Übersetzung, und Übersetzungen laufen auseinander;
 * so ist der Haken darüber fast nur noch eine Weiterreichung und kann die Fälle nicht verwechseln.
 */
export interface DirectoryQueryState {
  data: readonly DirectoryEntry[] | undefined;
  isPending: boolean;
  isError: boolean;
}

export interface AuthorNameTexts {
  /** Fall 2: das Verzeichnis liegt vor, dieser Autor steht nicht darin. */
  unknown: (ref: string) => string;
  /** Fall 3: die Abfrage läuft noch — vergeht von selbst. */
  loading: () => string;
  /** Fall 4: die Abfrage ist fehlgeschlagen — bleibt, bis jemand etwas tut. */
  unavailable: () => string;
}

/**
 * Baut den Namensauflöser aus dem Abfragezustand des Verzeichnisses.
 *
 * REIHENFOLGE DER PRÜFUNGEN, und sie ist nicht beliebig:
 * `data` zuerst — liegen Einträge vor, ist eine spätere Hintergrund-Aktualisierung, die gerade
 * scheitert, kein Grund, bereits bekannte Namen zu verschweigen. Danach `isError` VOR `isPending`:
 * Ein erneuter Versuch nach einem Fehler kann beides gleichzeitig wahr machen, und in dieser
 * Kombination ist der Fehler die belastbarere Aussage — „lädt noch" würde einen bereits
 * eingetretenen Ausfall wieder zur Geduldsfrage machen, also genau der Fehler dieses Blocks.
 */
export function makeAuthorNameResolver(
  verzeichnis: DirectoryQueryState,
  texte: AuthorNameTexts,
): NameResolver {
  const { data, isError, isPending } = verzeichnis;
  if (data) {
    return (uid) =>
      authorDisplayName(uid, data.find((eintrag) => eintrag.id === uid)?.name, texte.unknown);
  }
  if (isError) {
    return () => texte.unavailable();
  }
  if (isPending) {
    return () => texte.loading();
  }
  // Kein Verzeichnis, kein Laden, kein Fehler — etwa eine abgeschaltete Abfrage. Wir HABEN es
  // nicht, und warum, wissen wir nicht; „nicht abrufbar" ist davon die ehrlichere der beiden
  // Auskünfte. „Lädt noch" wäre hier ein Versprechen auf etwas, das niemand angefordert hat.
  return () => texte.unavailable();
}

export function authorShortRef(uid: string): string {
  return uid
    .replace(/[^0-9a-zA-Z]/g, "")
    .slice(0, 6)
    .toLowerCase();
}

// `unknown` liefert die ÜBERSETZTE Auskunft (i18n bleibt aus diesem DOM-freien Modul draußen).
export function authorDisplayName(
  uid: string,
  name: string | null | undefined,
  unknown: (ref: string) => string,
): string {
  const gepflegt = (name ?? "").trim();
  return gepflegt.length > 0 ? gepflegt : unknown(authorShortRef(uid));
}

// Liefert die anzuzeigenden Autorennamen. `nameOf` löst IDs auf; fehlt der Name
// (oder kein Resolver), wird auf die ID zurückgefallen.
export function koAuthorParts(ko: KoAuthorRef, nameOf?: NameResolver): KoAuthorParts {
  const resolve: NameResolver = nameOf ?? ((id) => id);
  const author = resolve(ko.author);
  const hasOriginal = !!ko.originalAuthor && ko.originalAuthor !== ko.author;
  return hasOriginal
    ? { author, originalAuthor: resolve(ko.originalAuthor as string) }
    : { author };
}

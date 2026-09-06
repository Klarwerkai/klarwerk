// AUFTRAG-mega14 Block D (SCRUM-414) — EINE Regel für „darf ein externer Treffer angehängt werden".
//
// Der Befund: `externalAttachAllowed(stage)` stand seit SCRUM-414 in
// `services/external-search/src/policy.ts:40`, wurde aus dem Modul exportiert — und von NIEMANDEM
// aufgerufen. Damit war die Admin-Stufe „suchen, aber nicht anhängen" faktisch wirkungslos: der
// Prüfbereich kannte die Stufe überhaupt nicht, das Erfassen blendete den Knopf nur bei „blocked"
// aus, und der Server nahm jedes `add-source` an.
//
// Durchgesetzt wird die Stufe jetzt SERVERSEITIG (services/app/src/routes/ko-routes.ts, Aktion
// `add-source`). Diese Datei ist die Oberflächen-Hälfte: der Knopf ist nicht anwählbar UND der
// Nutzer erfährt den GRUND. Ein ausgegrauter Knopf ohne Begründung ist keine Erklärung, sondern
// eine Sackgasse.
//
// Bewusst NICHT geregelt: Suchen. Das bleibt auf jeder Stufe außer „blocked" möglich — genau das
// ist der Sinn der Stufe „search_on_click".

import type { ExternalKnowledgeStage } from "../api/types";

// Spiegel von `externalAttachAllowed` (policy.ts:40-42). Der Server bleibt die Autorität; die
// Oberfläche darf ihm nicht widersprechen, deshalb steht die Regel hier genau einmal und wird von
// beiden Flächen (Prüfbereich, Erfassen) benutzt.
export function canAttachExternalResult(stage: ExternalKnowledgeStage | null | undefined): boolean {
  return stage === "search_attach" || stage === "open";
}

// Suchen ist etwas anderes als Anhängen — die Trennung ist der ganze Zweck der Stufen.
export function canSearchExternal(stage: ExternalKnowledgeStage | null | undefined): boolean {
  return stage !== "blocked";
}

// Der i18n-Schlüssel der Begründung, oder undefined, wenn Anhängen erlaubt ist.
export function externalAttachBlockedKey(
  stage: ExternalKnowledgeStage | null | undefined,
): string | undefined {
  return canAttachExternalResult(stage) ? undefined : "ext.attachBlocked";
}

// ---------------------------------------------------------------------------------------------
// AUFTRAG-mega16 Block A (bens SB-4, DRITTER Durchgang) — DIE STUFE IST EINE GRENZE, FAIL-CLOSED.
//
// Bis mega15 betraf die Sperre nur ERKANNTE Provider; alles andere ging durch. Jetzt gilt auf
// `blocked` und `search_on_click`: JEDE Quelle mit öffentlicher Web-Adresse wird abgewiesen, und
// eine Quelle OHNE Adresse nur dann angenommen, wenn sie an ein Dokument gebunden ist, das der
// Server an diesem Wissensobjekt selbst hält. Der Server entscheidet (attach-policy.ts); diese
// Datei sagt es dem Nutzer VORHER — mit Grund und mit dem Weg zur Änderung. Ein Formular, das
// erst nach dem Absenden „403" sagt, ist keine Erklärung, sondern eine Falle.
//
// SPIEGEL von `classifySourceReach` (services/external-search/src/attach-policy.ts) für den EINEN
// Fall, den die Oberfläche ohne Serverwissen beurteilen kann: hat die getippte Adresse überhaupt
// eine speicherbare Form? Die Origin-Allowlist selbst kennt der Client NICHT und soll sie auch
// nicht kennen — sie ist Betreiber-Konfiguration. Deshalb ist der Hinweis bewusst konservativ
// formuliert („öffentliche Web-Adresse"), und die Entscheidung bleibt beim Server.
export type SourceAttachHint = "public-url" | "unanchored" | null;

/**
 * Welcher Hinweis gehört an ein Quellenformular, BEVOR der Nutzer absendet?
 *
 * @param stage    die Admin-Stufe (null = noch nicht geladen → kein Hinweis, keine Panikmeldung)
 * @param url      die im Formular stehende Adresse (leer/ungültig zählt als „keine Adresse")
 * @param anchored ob diese Quelle einen Anker auf ein am KO liegendes Dokument mitbringt
 *
 * JOB 3133 · UX-22 — ZUM DRITTEN ARGUMENT, DAS ZWEI JAHRE NIEMAND ÜBERGAB. Die Regel selbst ist
 * unverändert; falsch war der AUFRUF. Das Bibliotheksformular rief `sourceAttachHint(stage, url)`
 * mit zwei Argumenten (MehrAbschnitte.tsx:201), also mit dem Vorgabewert `anchored = false` — der
 * Hinweis „unanchored" konnte dort NIE verschwinden, egal was der Nutzer tat. Wer ihn übergibt,
 * schuldet eine belegte Angabe: „ein Anhang DIESES Objekts ist gewählt", nicht „im Feld steht
 * etwas". Der Server prüft ohnehin gegen seine eigene Anhangsliste (ko-routes.ts:1926-1930) — eine
 * großzügigere Vorhersage wäre eine Erlaubnis, die er gleich darauf zurücknähme.
 */
export function sourceAttachHint(
  stage: ExternalKnowledgeStage | null | undefined,
  url: string,
  anchored = false,
): SourceAttachHint {
  if (stage == null || canAttachExternalResult(stage)) {
    return null;
  }
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return anchored ? null : "unanchored";
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Nicht speicherbar → wird als adresslose Quelle behandelt (genau wie serverseitig).
    return anchored ? null : "unanchored";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return anchored ? null : "unanchored";
  }
  // Absolute http/https-Adresse: ob der Betreiber sie als intern eingetragen hat, weiß nur der
  // Server. Der Hinweis nennt deshalb die Regel, nicht ein Urteil über genau diesen Host.
  return "public-url";
}

// ---------------------------------------------------------------------------------------------
// JOB 3133 · UX-22 RUNDE 4 (Codex R3, Korrekturpflicht 1) — EIN HINWEIS IST KEIN ZULASSUNGSURTEIL.
//
// DER FEHLER, DEN DIESE FUNKTION BEHEBT: Runde 3 machte aus JEDEM Hinweis eine harte Knopfsperre.
// Das war für `unanchored` richtig und für `public-url` falsch. Denn `sourceAttachHint` kennt die
// Origin-Allowlist des Betreibers NICHT (s. Kommentar oben, Zeile 50-52) und stuft deshalb JEDE
// absolute http(s)-Adresse als „public-url" ein — auch eine, die der Betreiber ausdrücklich als
// intern eingetragen hat und die der Server mit 200 annimmt (belegt in
// tests/app/external-attach-gate-e2e.test.ts:176). Die Sperre nahm dem Nutzer damit einen Weg,
// den er hat. Gemessen von Codex: Basisstand `{"reach":"internal","calls":1}` gegen Runde 3
// `{"reach":"internal","ariaDisabled":"true","calls":0}`.
//
// DIE UNTERSCHEIDUNG: Nicht „was rät die Oberfläche?", sondern „WEISS sie es?".
//   · `unanchored` → SIE WEISS ES. Die Adresse ist leer oder nicht speicherbar (das sieht der
//     Client vollständig), und ob ein Anker gilt, prüft der Aufrufer gegen die Anhangsliste
//     DIESES Objekts — dieselbe Frage, die `ko-routes.ts:1926-1930` stellt. Client und Server
//     kommen hier zwingend zum selben Urteil. Absenden hiesse: eine sichere 403 auslösen.
//   · `public-url` → SIE WEISS ES NICHT. Ob dieser Host in der Allowlist steht, weiss allein der
//     Server. Der Hinweis bleibt sichtbar (er nennt die Regel, nicht ein Urteil über den Host),
//     aber die ENTSCHEIDUNG bleibt beim Nutzer und die Prüfung beim Server.
//
// Fail-closed bleibt gewahrt: die Grenze zieht weiterhin der Server. Eine Oberfläche, die aus
// Nichtwissen eine Ablehnung macht, ist nicht vorsichtig, sondern falsch — sie sperrt einen Weg,
// den der Betreiber freigegeben hat.
export function sourceAttachCertainlyDenied(hint: SourceAttachHint): boolean {
  return hint === "unanchored";
}

// Die i18n-Schlüssel je Hinweis — Text und Weg zur Änderung stehen in i18n.ts (DE/EN/NL).
export const SOURCE_ATTACH_HINT_KEYS: Record<
  Exclude<SourceAttachHint, null>,
  { body: string; how: string }
> = {
  "public-url": { body: "ext.gate.publicUrl", how: "ext.gate.how" },
  unanchored: { body: "ext.gate.unanchored", how: "ext.gate.how" },
};

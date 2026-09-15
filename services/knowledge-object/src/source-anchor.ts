// JOB 4077 — DIE EINE FRAGE „HÄNGT DIESER ANKER AN DIESEM OBJEKT?", an EINER Stelle.
//
// Sie wurde bis hierher an genau einem Ort gestellt (`ko-routes.ts`, `case "add-source"`) und dort
// ausschliesslich für die STUFENENTSCHEIDUNG beantwortet: „darf diese adresslose Quelle überhaupt
// angehängt werden?" (services/external-search/src/attach-policy.ts). Die Antwort wurde danach
// weggeworfen. Seit JOB 4077 braucht sie ein zweiter Aufrufer — der SPEICHERWEG (`addSource`), der
// den Anker an die Belegstelle schreibt. Zwei Ausdrücke für dieselbe Frage wären zwei Regeln, die
// auseinanderlaufen können; deshalb steht sie hier einmal.
//
// DIE ZWEI FRAGEN BLEIBEN GETRENNT — das ist wichtig und keine Formsache:
//   „DARF angehängt werden?"   → attach-policy.ts, mit der Admin-Stufe. Unverändert.
//   „WELCHER Anker gilt?"       → diese Datei, ohne jede Kenntnis der Stufe.
// Diese Funktion kennt weder `stage` noch `reach` und kann deshalb keine Erlaubnis erweitern. Sie
// beantwortet eine Tatsachenfrage über eine Anhangsliste, sonst nichts.
//
// `undefined === undefined` IST HIER KEIN TREFFER. Alt-Anhänge (SCRUM-121) tragen `dataUrl` statt
// `objectId`; ohne die ausdrückliche Prüfung auf einen vorhandenen Wert würde eine Quelle ohne
// Anker auf einen Alt-Anhang „passen" und der Server schriebe einen Anker aus dem Nichts.

/** Die Mindestform eines Anhangs für diese Frage — strukturell, damit kein Aufrufer mehr mitbringt als nötig. */
export interface AnchorCandidateAttachment {
  readonly objectId?: string | null;
}

/**
 * Liefert den Anker, wenn er in DIESER Anhangsliste liegt — sonst `null`.
 *
 * Kein Werfen und kein Ersatzwert: ein nicht bestätigter Anker war schon bisher folgenlos (die
 * Stufenregel entscheidet ihn zu `false`), und ein Fehler wäre eine NEUE Ablehnung, die dieser
 * Auftrag ausdrücklich nicht einführt. Der Aufrufer bekommt „gibt es nicht" und lässt das Feld weg.
 */
export function confirmedSourceAnchor(
  attachments: readonly AnchorCandidateAttachment[] | undefined,
  candidate: string | null | undefined,
): string | null {
  // AUSDRÜCKLICH OHNE `trim()`. Die Stufenentscheidung vergleicht seit mega16 exakt
  // (`ko-routes.ts`: `a.objectId === body.source?.objectId`), und sie ist eine Sicherheitsgrenze:
  // würde hier zusätzlich geschnitten, bestätigte ein „ obj-1 " plötzlich einen Anker, den der
  // Server bis heute nicht bestätigt — auf `blocked`/`search_on_click` eine stille Erlaubnis. Eine
  // Kennung mit Leerzeichen ist keine Kennung; sie findet nichts, und das ist die richtige Antwort.
  const gesucht = typeof candidate === "string" ? candidate : "";
  if (gesucht.length === 0) {
    return null;
  }
  const gefunden = (attachments ?? []).some((a) => a.objectId != null && a.objectId === gesucht);
  return gefunden ? gesucht : null;
}

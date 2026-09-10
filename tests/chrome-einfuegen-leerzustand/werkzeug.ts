// JOB 3524: die drei Griffe, die beide Fälle dieser Gruppe brauchen. Sie stehen HIER und nicht
// zweimal nebeneinander — zwei Kopien wären zwei Wahrheiten (dieselbe Begründung wie bei
// `panel-dom.ts` selbst, JOB 3278).
//
// `panel-dom.ts` beschreibt nur die Knoten, die es selbst anfasst, und liegt ausserhalb der
// Zielpfade dieses Jobs. Die zwei Fragen, die es dort noch nicht gibt — wo der Schreibpunkt steht
// und was an den Worker ging —, werden deshalb hier beantwortet, eng auf genau sie begrenzt.

/** Der Wortschatz der Leiste, so wie `i18n.js` ihn im Fenster ablegt. */
export type Wortschatz = Record<string, Record<string, string>>;
export const wortschatz = (fenster: { eval(quelle: string): unknown }) =>
  fenster.eval("globalThis.KLARA_TEXT") as Wortschatz;

/** Die Kennung des Knotens, auf dem der Schreibpunkt steht — leer, wenn keiner ihn trägt. */
export const fokus = (fenster: { document: unknown }) =>
  (fenster.document as { activeElement?: { id?: string } }).activeElement?.id ?? "";

/** Die Nachrichten, die die Leiste an den Worker geschickt hat, nach Art gefiltert. */
export const nachrichten = (alle: unknown[], art: string) =>
  alle.filter((m): m is { type: string } => (m as { type?: string })?.type === art);

// ================================================================================================
// AUFTRAG-mega39 BLOCK D2 (ben, sammel37-mega38) — DIE ZWEITE LISTE, DIE NICHTS SAGT.
// ================================================================================================
//
// DER BEFUND, von ben einzeln nachgeprüft und bestätigt: `sources` und `steps` entstehen 1:1 aus
// DERSELBEN Menge (der Retrieval-Auswahl, gedeckelt bei acht). Es gibt keinen Rückparser für `[n]`,
// und der Prompt ERLAUBT Quellenverweise, verlangt sie nicht. Es existiert also keine protokollierte
// Herleitung — die Liste unter „Argumentationsschritte" wiederholte schlicht die Quellenliste samt
// Aussage, eine Zeile tiefer und unter einem Namen, der Nachvollziehbarkeit versprach.
//
// DIE ENTSCHEIDUNG (Bericht, D2): AUSBLENDEN, nicht nur umbenennen. Für eine Erstnutzerin wirken
// dieselben acht Einträge zweimal untereinander wie Fülltext; sie erzeugen Länge statt Nachweis.
// Der Name ist trotzdem mit korrigiert („Herangezogene Kontextquellen"), denn ausblenden heisst hier
// AUSDRÜCKLICH NICHT „immer weg": trägt ein Schritt eine Fundstelle, die in der Quellenliste NICHT
// steht, bleibt er sichtbar. Eine pauschale Entfernung wäre Informationsverlust auf Verdacht.
//
// Die echte Trennung von ZITIERTEN gegen HERANGEZOGENE Quellen ist ausdrücklich nach Freitag
// verwiesen (bens Abschnitt 8) — hier wird kein Backend, kein Prompt und kein Feld angefasst.

export interface AskStepLike {
  sourceId?: string | null;
  description?: string;
  snippet?: string | null;
}

export interface AskSourceLike {
  id: string;
}

/**
 * Trägt ein einzelner Schritt etwas, das die Quellenliste nicht schon zeigt?
 *
 * Die Quellenzeile zeigt je Quelle Titel, Nutzbarkeit, Prüfstand, Konflikt-/Demo-Kennzeichnung UND
 * den Auszug im Dokument-Format (AnswerSourceDetails). Ein Schritt, dessen `sourceId` dort steht,
 * fügt dem nichts hinzu. Ein Schritt OHNE Quellenbezug oder mit einer Quelle, die in der Liste
 * fehlt, ist die einzige Fundstelle für diese Angabe — der bleibt.
 */
export function stepAddsBeyondSources(step: AskStepLike, sourceIds: ReadonlySet<string>): boolean {
  if (!step.sourceId) {
    return true;
  }
  return !sourceIds.has(step.sourceId);
}

/** Genau die Schritte, die eine eigene Fundstelle tragen — Reihenfolge bleibt erhalten. */
export function stepsBeyondSources<T extends AskStepLike>(
  steps: readonly T[] | undefined,
  sources: readonly AskSourceLike[] | undefined,
): T[] {
  const ids = new Set((sources ?? []).map((s) => s.id));
  return (steps ?? []).filter((s) => stepAddsBeyondSources(s, ids));
}

/** Lohnt die zweite Liste überhaupt? Nur wenn mindestens ein Schritt etwas Eigenes trägt. */
export function stepsWorthShowing(
  steps: readonly AskStepLike[] | undefined,
  sources: readonly AskSourceLike[] | undefined,
): boolean {
  return stepsBeyondSources(steps, sources).length > 0;
}

// SCRUM-164 (Knowledge-OS-Foundation): technisches ModelRun-Protokoll v1. Macht KI-/Reasoner-
// Aufrufe nachvollziehbar, OHNE Prompt-/Antworttexte oder KO-Inhalte zu speichern. Nur Metadaten.
// SCRUM-167: answer/select ergänzt — Ask-/Auswahlpfade ebenso nachvollziehbar.
// PMO-FEA-0006: extract ergänzt — Wissens-Extraktion aus Dokumenten ebenso nachvollziehbar.
// WP-BILD-1c: describe ergänzt — KI-Bildbeschreibungs-Vorschläge ebenso nachvollziehbar.
// WP-IC-4: group ergänzt — KI-Gruppierung der Import-Kandidaten ebenso nachvollziehbar.
export type ModelRunTask =
  | "structure"
  | "assist"
  | "interview"
  | "answer"
  | "select"
  | "extract"
  | "describe"
  | "group";
export type ModelRunStatus = "success" | "error";

// AUFTRAG-mega26 Block A: LAUFKONTEXT — wer den Lauf ausgelöst hat und woran er lief.
//
// WARUM: bis mega25 trug ein ModelRunRecord ausschliesslich technische Metadaten (Task, Provider,
// Zeiten, Ausgang). Er war damit ein Beleg, der sich dem, was er belegt, nicht zuordnen liess: zu
// einem Lauf gab es weder einen Anfragenden noch ein betroffenes Wissensobjekt. Für ein Produkt mit
// Beweispflicht ist das der schlechteste Zustand — er täuscht Vollständigkeit vor.
//
// STRIKTE GRENZE (unverhandelbar, deckungsgleich mit der Zusage an `error`): der Kontext trägt
// AUSSCHLIESSLICH Kennungen. NIE Prompt-Inhalt, NIE Antwortinhalt, NIE einen Schlüssel, NIE ein
// Geheimnis. `sanitizeModelRunContext` erzwingt das strukturell (s. u.).
//
// `promptVersion` fehlt hier BEWUSST — es gibt im gesamten Repo keinen Erzeuger dafür auf einem
// Weg, der einen ModelRunRecord schreibt (Begründung im Bericht zu mega26, Block A). Ein deklariertes
// Feld, das kein Code-Pfad füllt, wird nicht gebaut.
export type ModelRunSubjectKind = "ko";

// Der Gegenstand des Laufs. `kind` ist bewusst eng: nur "ko" hat heute einen Erzeuger.
export interface ModelRunSubject {
  kind: ModelRunSubjectKind;
  id: string;
}

// Was ein Aufrufer über seinen Lauf beitragen kann. Alle Felder optional — ein Aufrufer, der den
// Bezug nicht kennt, lässt ihn leer, statt ihn zu raten.
export interface ModelRunContext {
  actor?: string; // der AUTHENTIFIZIERTE Anfragende (Nutzerkennung), nie ein geratener Ersatz
  subject?: ModelRunSubject;
}

// Harte Obergrenze für jede Kennung im Laufkontext. Sie ist KEINE Formatprüfung, sondern eine
// Struktursperre: sollte ein künftiger Aufrufer den Kontext versehentlich mit Inhalt (Dokumenttext,
// Prompt, Antwort) füllen, kann dieser Inhalt das Protokoll nicht erreichen. Bewusst DROP statt
// TRUNCATE — eine gekürzte Kennung wäre eine falsche Kennung; keine ist ehrlicher als eine falsche.
export const MAX_MODEL_RUN_CONTEXT_ID_LENGTH = 200;

function idOrDrop(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed.length > MAX_MODEL_RUN_CONTEXT_ID_LENGTH
    ? undefined
    : trimmed;
}

// Reine, DOM-freie Normalisierung des Laufkontexts. Liefert nur, was als Kennung durchgeht;
// alles andere fällt weg. Ein leerer Kontext ergibt `{}` — der Datensatz bleibt dann feldfrei.
export function sanitizeModelRunContext(context?: ModelRunContext): ModelRunContext {
  if (!context) {
    return {};
  }
  const actor = idOrDrop(context.actor);
  const subjectId = idOrDrop(context.subject?.id);
  const kind = context.subject?.kind;
  return {
    ...(actor ? { actor } : {}),
    ...(subjectId && kind === "ko" ? { subject: { kind, id: subjectId } } : {}),
  };
}

export interface ModelRunRecord {
  id: string;
  task: ModelRunTask;
  provider: string; // Name des tatsächlich genutzten Providers (kein Schlüssel)
  demo: boolean; // Ergebnis vom deterministischen Provider (kein echtes Modell)
  fallback: boolean; // primärer Provider war verfügbar, schlug fehl → deterministisch genutzt
  locale?: string;
  startedAt: string;
  finishedAt: string;
  status: ModelRunStatus;
  error?: string; // generische Fehlermeldung (NIE Prompt-/Antwortinhalt)
  model?: string; // Modellname, falls ein echtes Modell genutzt wurde
  // mega26 Block A (additiv, optional): Laufkontext. Altdatensätze ohne diese Felder bleiben
  // uneingeschränkt gültig — der Lesepfad kennt keine Pflicht auf ihnen.
  actor?: string;
  subject?: ModelRunSubject;
}

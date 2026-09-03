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

// ================================================================================================
// AUFTRAG-mega61 BLOCK F — DIE MASCHINENLESBARE KENNZEICHNUNG NACH ARTIKEL 50 ABSATZ 2.
// ================================================================================================
//
// Die KI-Verordnung verlangt für ERZEUGTE Inhalte eine Kennzeichnung „in einem maschinenlesbaren
// Format". Für Text gibt es kein wirksames, robustes Wasserzeichen — maschinenlesbar heißt hier
// also ein ausdrückliches Feld in der Serverantwort. Das ist unstrittig maschinenlesbar, kostet
// fast nichts und ist die Grundlage für die Kennzeichnung in Exporten.
//
// SIE STEHT HIER, WEIL HIER DIE AUFGABENBENENNUNG STEHT (`ModelRunTask` oben). Eine zweite
// Aufgabenliste anzulegen wäre die zweite Wahrheit über dieselben acht Aufgaben.
//
// ------------------------------------------------------------------------------------------------
// DIE RECHTSAUSLEGUNG, AUSDRÜCKLICH HIER UND NICHT IM BERICHT — damit sie nachvollziehbar bleibt,
// wenn jemand in einem Jahr fragt, warum drei und nicht acht:
//
// Artikel 50 Absatz 2 nimmt aus, was „eine unterstützende Funktion für die Standardbearbeitung
// ausführt oder die bereitgestellten Eingabedaten nicht wesentlich verändert".
//
//   GEKENNZEICHNET (neuer Text entsteht, den es vorher nicht gab):
//     · `answer`    — formuliert eine Antwort. Dass der INHALT aus dem eigenen Bestand kommt,
//                     ändert daran nichts: erzeugt wird die Formulierung, und sie ist es, die
//                     gelesen wird.
//     · `interview` — erzeugt Fragen.
//     · `describe`  — erzeugt eine Bildbeschreibung.
//
//   NICHT GEKENNZEICHNET (unterstützende Standardbearbeitung an vorhandenem Material):
//     · `assist`    — formuliert vorhandenen Text um.
//     · `structure` — gliedert vorhandene Notizen.
//     · `extract`   — holt Punkte aus einer vorhandenen Datei.
//     · `group`     — ordnet vorhandene Dokumente in Themen.
//     · `select`    — wählt aus vorhandenen Objekten aus und erzeugt gar keinen Text.
//
// DAS IST EINE LESART, KEINE ENTSCHEIDUNG EINES GERICHTS. „Nicht wesentlich verändern" ist
// unbestimmt und höchstrichterlich nicht ausgelegt; `assist` liegt am nächsten an der Grenze, weil
// es den Text tatsächlich neu schreibt. Eine Kennzeichnung zu viel ist kein Verstoß, eine zu wenig
// schon — wenn die Einordnung kippt, ist die Erweiterung hier eine Zeile.
// ------------------------------------------------------------------------------------------------

/** Die drei Aufgaben, deren Ausgabe als KI-erzeugt zu kennzeichnen ist. */
export const KI_ERZEUGENDE_AUFGABEN: readonly ModelRunTask[] = ["answer", "interview", "describe"];

/**
 * Der Betriebsmodus, in dem die Ausgabe entstand.
 *
 * BEWUSST GROB: „model" oder „deterministic", nicht Cloud/Lokal. Die feinere Auskunft gibt es
 * bereits an genau einer Stelle (GET /api/reasoner/status und die Modellangabe daneben); sie hier
 * zu wiederholen hieße, zwei Wahrheiten über denselben Provider zu führen.
 */
export type AiOutputMode = "model" | "deterministic";

export interface AiGeneratedMark {
  /** Immer `true`. Das Feld existiert nur an gekennzeichneten Ausgaben — es gibt kein `false`. */
  aiGenerated: true;
  task: ModelRunTask;
  mode: AiOutputMode;
  /** Zeitpunkt der Erzeugung, ISO 8601. */
  at: string;
}

/**
 * Die Kennzeichnung bauen. `demo` ist der bereits vorhandene Marker „aus dem deterministischen
 * Rückfall" — daraus folgt der Betriebsmodus, ohne dass ein zweiter Zustand entsteht.
 */
export function aiGeneratedMark(
  task: ModelRunTask,
  demo: boolean,
  at: string = new Date().toISOString(),
): AiGeneratedMark {
  return { aiGenerated: true, task, mode: demo ? "deterministic" : "model", at };
}

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
  // JOB 3036: der Modellbezeichner OHNE Anbieter-Präfix (`claude-sonnet-4-6`, nicht
  // `anthropic:claude-sonnet-4-6`). `provider` und `model` sind ZWEI VERSCHIEDENE Angaben und dürfen
  // nicht denselben Wert tragen: `provider` sagt WER gerechnet hat (Client/Anbieter), `model` WOMIT.
  // Bis JOB 3036 stand hier ein zweites Mal `provider.name` — die Zusage war da, die Auskunft nicht.
  //
  // DAS FEHLEN IST EINE AUSSAGE: es heißt „in diesem Lauf hat kein Modell wirklich gearbeitet ODER
  // der Client nennt seines nicht". Es wird NIE durch einen Ersatzwert gefüllt (auch nicht durch
  // `provider`).
  //
  // DIE HÜRDE IST DER AUFRUF, NICHT DIE PROVIDER-AUSWAHL (JOB 3036 R2): Der Modell-Provider kann
  // einen Lauf beenden, ohne das Modell je zu befragen — `answer` ohne tragende Quelle, ein bereits
  // abgeschlossenes `interview`, `extract` auf leerem Dokument, `helpAnswer` ohne Wissensbasis;
  // `select` rechnet grundsätzlich ohne Modell. In all diesen Fällen steht hier NICHTS. Ein Wert
  // hier heißt: `ModelClient.complete()` bzw. `completeVision()` ist in genau diesem Lauf gelaufen.
  //
  // ALTDATENSÄTZE aus der Zeit vor JOB 3036 tragen `model === provider`; sie werden NICHT umgerechnet.
  // Der Lesepfad darf daraus nichts folgern — insbesondere entsteht daraus keine Anzeige
  // „unbekanntes Modell" und keine Bereinigung.
  model?: string;
  // mega26 Block A (additiv, optional): Laufkontext. Altdatensätze ohne diese Felder bleiben
  // uneingeschränkt gültig — der Lesepfad kennt keine Pflicht auf ihnen.
  actor?: string;
  subject?: ModelRunSubject;
}

// SCRUM-164 (Knowledge-OS-Foundation): technisches ModelRun-Protokoll v1. Macht KI-/Reasoner-
// Aufrufe nachvollziehbar, OHNE Prompt-/Antworttexte oder KO-Inhalte zu speichern. Nur Metadaten.
// SCRUM-167: answer/select ergänzt — Ask-/Auswahlpfade ebenso nachvollziehbar.
// PMO-FEA-0006: extract ergänzt — Wissens-Extraktion aus Dokumenten ebenso nachvollziehbar.
// WP-BILD-1c: describe ergänzt — KI-Bildbeschreibungs-Vorschläge ebenso nachvollziehbar.
// WP-IC-4: group ergänzt — KI-Gruppierung der Import-Kandidaten ebenso nachvollziehbar.
// Aufnahme gesamt-ki-laufprotokoll (R-0612, Ben R1 B2): vier Modellwege schrieben bis hierher keinen
// Lauf, obwohl sie ein Modell befragen — `enrich` (öffentliche Anreicherung), `conflict` und
// `duplicate` (Konflikt- und Dublettenurteil) und `probe` (Anbieterprobe der KI-Verwaltung). Sie
// sind keine Aufgaben der KI-Zuordnung (`REASONER_TASKS`), sondern laufen über die globale Wahl —
// deshalb stehen sie nur hier, nicht in der Zuordnungsliste.
// R-1657 (aufnahme:20260922:gesamt-wissenssprints): `gaps` — die Lückenerkennung je Bereich; wie
// `conflict` ein Urteil über die globale Wahl, das keinen gelesenen Text erzeugt (keine Kennzeichnung).
export type ModelRunTask =
  | "structure"
  | "assist"
  | "interview"
  | "answer"
  | "select"
  | "extract"
  | "describe"
  | "group"
  | "enrich"
  | "conflict"
  | "duplicate"
  | "probe"
  | "gaps";
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
// wenn jemand in einem Jahr fragt, warum vier und nicht acht:
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
//     · `enrich`    — erzeugt einen Text aus Weltwissen (öffentliche Anreicherung). Aufgenommen
//                     durch Entscheidung Pedi 8398db9e-893b-4552-8697-9ec85aced8d6; die
//                     Auszeichnung „extern/ungeprüft" an der Route bleibt daneben bestehen.
//
//   Die übrigen drei Protokollarten aus der Aufnahme gesamt-ki-laufprotokoll (`conflict`,
//   `duplicate`, `probe`) stehen in KEINER der beiden Listen dieser Datei: die Urteile und die
//   Probe erzeugen keinen Text, der gelesen wird.
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

/** Die vier Aufgaben, deren Ausgabe als KI-erzeugt zu kennzeichnen ist. */
export const KI_ERZEUGENDE_AUFGABEN: readonly ModelRunTask[] = [
  "answer",
  "interview",
  "describe",
  "enrich",
];

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
 *
 * R-0604 (G22, mega83 A): der Reasoner hängt die Marke seither NUR an Ausgaben, die ein Modell
 * geschrieben hat (`demo === false`). Der deterministische Rückfall ist keine KI-Erzeugung und
 * bekommt keine Marke — `mode: "deterministic"` bleibt als Vertragswert gültig, wird von den
 * Reasoner-Wegen aber nicht mehr erzeugt.
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

// ================================================================================================
// JOB 3074 (V9 Scheibe 3) — DER TOKENVERBRAUCH EINES LAUFS, SO WIE DIE MODELL-API IHN GEMELDET HAT.
// ================================================================================================
//
// WAS DIESE ZAHLEN SIND: die von der Modell-API SELBST genannten Token je Lauf, addiert über alle
// Modellaufrufe dieses Laufs (`extract` schickt ein langes Dokument in Abschnitten durch das Modell
// und ruft es mehrfach — deshalb eine Summe, nicht der letzte Wert).
//
// WAS SIE NICHT SIND: keine Kosten, kein Preis, keine Rechnung, keine Schätzung. Der Preis je Modell
// ist Pedis Preisliste und steht bewusst NICHT in diesem Modul — hier steht nur, was verbraucht
// wurde, nicht was es gekostet hat.
//
// `gemeldeteAufrufe` IST DIE GRUNDMENGE DER SUMME, nicht die Zahl der Modellaufrufe: es zählt die
// Aufrufe, die einen BRAUCHBAREN Verbrauch genannt haben. Ohne sie wäre die Summe eine Zahl ohne
// Bezug — dasselbe Paar aus Summe und Grundmenge, das die Laufzeit schon führt
// (`apps/web/src/lib/modelRuns.ts:18-22`).
export interface ModelRunVerbrauch {
  eingabeToken: number;
  ausgabeToken: number;
  /** Zahl der Modellaufrufe dieses Laufs, die einen brauchbaren Verbrauch GEMELDET haben (≥ 1). */
  gemeldeteAufrufe: number;
}

// ================================================================================================
// Aufnahme gesamt-ki-laufprotokoll (V9, R-0705/R-0759/R-0833, Ben R1 B3) — DIE KOSTEN EINES LAUFS.
// ================================================================================================
//
// EIN EIGENER NACHWEIS NEBEN DEM VERBRAUCH: die Kosten werden beim Schreiben des Laufs aus dem
// gemeldeten Verbrauch und der zu diesem Zeitpunkt hinterlegten Preisliste berechnet und MIT dem
// Preisstand festgehalten. Eine spätere Preisänderung rechnet alte Läufe deshalb nicht um.
//
// DAS FEHLEN IST EINE AUSSAGE (wie bei `model` und `verbrauch`): kein Verbrauch gemeldet, kein
// Modellname, keine Preisliste hinterlegt oder kein Preis für dieses Modell → kein Feld. Es wird
// kein Preis geschätzt und keiner als Vorgabe ausgeliefert — welche Preise gelten, entscheidet der
// Betreiber über die Preisliste (`preisliste.ts`), nicht der Code.
export interface ModelRunKosten {
  /** Berechneter Betrag dieses Laufs in `waehrung` (auf 6 Nachkommastellen gerundet). */
  betrag: number;
  waehrung: string;
  /** Stand der Preisliste, aus der gerechnet wurde (vom Betreiber vergeben, z. B. ein Datum). */
  preisstand: string;
}

// Aufnahme gesamt-ki-laufprotokoll (R-0759/R-1984, Ben R1 B4) — WAS EIN LAUF ERZEUGT HAT.
//
// Art und Anzahl, nie der Inhalt: „3 Punkte", „1 Antwort", „2 Gruppen". Abgeleitet aus der Form des
// Ergebnisses, das der Lauf zurückgab. Ein gescheiterter Lauf erzeugt nichts und trägt kein Feld.
export type ModelRunErzeugnisArt =
  | "vorschlag"
  | "text"
  | "frage"
  | "antwort"
  | "punkt"
  | "beschreibung"
  | "gruppe"
  | "kriterien"
  | "urteil";

export interface ModelRunErzeugnis {
  art: ModelRunErzeugnisArt;
  anzahl: number;
}

// ================================================================================================
// Aufnahme gesamt-ki-laufprotokoll (R-0705/R-1621, Ben R2 B3) — DIE VERSUCHE EINES LAUFS.
// ================================================================================================
//
// Ein Lauf ist EIN Datensatz (JOB 3074 R2), aber er kann mehrere Glieder der Kette versuchen
// (Cloud scheitert → lokal antwortet → deterministischer Rückfall). Jeder Versuch steht hier mit
// SEINEM Anbieter, SEINEM Modell und SEINEM gemeldeten Verbrauch — genau das braucht die
// Kostenrechnung: zwei Modelle mit verschiedenen Preisen dürfen nicht mit dem Preis des letzten
// bewertet werden. Nur Metadaten; der Ausgang ist „erfolg" oder „fehler", der Grund steht
// inhaltsfrei in `error` des Laufs.
//
// `spanId` ist die Kennung des Versuchs im Trace des Laufs (s. ModelRunTrace).
export interface ModelRunVersuch {
  provider: string;
  /** Nur, wenn in diesem Versuch wirklich ein Modell gerufen wurde (Regel aus JOB 3036 R2). */
  model?: string;
  startedAt: string;
  dauerMs: number;
  ausgang: "erfolg" | "fehler";
  /** Nur, wenn die Modell-API in diesem Versuch einen Verbrauch gemeldet hat (Regel aus JOB 3074). */
  verbrauch?: ModelRunVerbrauch;
  /**
   * Zahl der in diesem Versuch WIRKLICH ausgeführten Modellaufrufe (gezählt am Chokepoint). Ben
   * Lauf 3 R1 N1: `extract` ruft je Abschnitt; meldet ein Aufruf keinen Verbrauch, ist
   * `verbrauch.gemeldeteAufrufe` kleiner — der Verbrauch ist dann nur eine Teilsumme und trägt
   * keine Kosten. Fehlt in Altdatensätzen und bei Versuchen ohne Modellaufruf.
   */
  aufrufe?: number;
  spanId: string;
}

// Aufnahme gesamt-ki-laufprotokoll (R-2071, Ben R2 B5) — DER TRACE EINES LAUFS (W3C Trace Context).
//
// `traceId` verbindet den Lauf mit der HTTP-Anfrage, die ihn auslöste (aus einem eingehenden
// `traceparent`-Kopf übernommen oder je Anfrage neu erzeugt), `requestId` mit den Logzeilen dieser
// Anfrage, `spanId` ist der Lauf selbst, `parentSpanId` der Span der Anfrage. Läufe ohne Anfrage
// (Hintergrundarbeit) bekommen einen eigenen Trace. Kennungen, nie Inhalt.
export interface ModelRunTrace {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  requestId?: string;
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
  // JOB 3074: der Tokenverbrauch dieses Laufs (s. ModelRunVerbrauch oben).
  //
  // DAS FEHLEN IST EINE AUSSAGE — wortgleich zur Regel bei `model` darüber: es heißt „in diesem Lauf
  // hat keine Modell-API einen Verbrauch genannt". Das trifft drei verschiedene Lagen, und keine
  // davon wird geglättet: kein Modellaufruf (deterministischer Lauf, `demo`, die Kurzschlusswege aus
  // JOB 3036 R2), ein Modellaufruf ohne `usage`-Block in der Antwort, oder ein `usage`-Block mit
  // unbrauchbaren Werten. Es wird NIE durch einen Ersatzwert gefüllt, insbesondere nicht durch `0`:
  // eine `0` wäre die Behauptung, ein Lauf habe MESSBAR nichts verbraucht, und das ist etwas anderes
  // als „darüber ist nichts bekannt". Eine `0` in `ausgabeToken` ist deshalb NUR dann zulässig, wenn
  // die API sie selbst so genannt hat.
  //
  // ADDITIV: `repo-pg.ts` legt den Vollrecord als jsonb ab (`repo-pg.ts:22-25`) — Altdatensätze ohne
  // dieses Feld bleiben uneingeschränkt gültig, und es gibt nichts umzurechnen.
  verbrauch?: ModelRunVerbrauch;
  // Aufnahme gesamt-ki-laufprotokoll: Kosten aus Verbrauch × Preisliste (s. ModelRunKosten).
  kosten?: ModelRunKosten;
  // Aufnahme gesamt-ki-laufprotokoll: Art und Anzahl des Erzeugten (s. ModelRunErzeugnis).
  erzeugt?: ModelRunErzeugnis;
  // Aufnahme gesamt-ki-laufprotokoll (Ben R2 B3/B5): die Versuche des Laufs und sein Trace.
  versuche?: ModelRunVersuch[];
  trace?: ModelRunTrace;
  // mega26 Block A (additiv, optional): Laufkontext. Altdatensätze ohne diese Felder bleiben
  // uneingeschränkt gültig — der Lesepfad kennt keine Pflicht auf ihnen.
  actor?: string;
  subject?: ModelRunSubject;
}

// WP-SHIP9-S1 (Pedis B3): Die Bestätigungs-Karte auf /erfassen behauptete nach dem Einreichen
// mit einem STATISCHEN Hinweis, die KI-Prüfung laufe im Hintergrund — ohne den echten Job-Status
// (aiCheck pending/done/failed, WP-SUBMIT-ASYNC) je nachzulesen. Diese pure Logik bildet den
// TATSÄCHLICHEN Server-Zustand auf den Karten-Text ab: „läuft" NUR solange kein Ergebnis vorliegt,
// der Wechsel kommt ausschließlich vom echten Ergebnis, ein Fehlschlag heißt ehrlich fehlgeschlagen
// mit Ursache (F1-Vertrag — dieselben Ursachen-Keys wie das AiCheckBadge der Validierung).
import type { AiCheckCoverage, Confidentiality, KnowledgeObject } from "../api/types";
// AUFTRAG-mega9 Block E-3 (KW-E2E-007): dieselbe Stufen-Prüfung, die auch Chip und Egress benutzen —
// keine zweite Auslegung von „vertraulich".
import { isConfidential } from "./confidentiality";

// Ursache → i18n-Key (ehrlich benannt): ohne aktives Modell wurde nichts geprueft (no-model);
// WP-SHIP8-FINAL (bens Bedingung 2): timeout (Job-Frist ueberschritten) und queue-overflow
// (Warteschlangen-Kappe) sind eigene, ehrliche Ursachen. WP-SHIP8-CLOSE (bens F1): model-timeout
// (das MODELL antwortete nicht rechtzeitig) eigenständig. Unbekannt/fehlend → model-error.
// WP-SHIP9-S1 (Pedis B3): aus AiCheckBadge.tsx HIERHER gezogen (lib importiert keine .tsx —
// Root-Build ohne jsx); das Badge importiert die Funktion jetzt von hier. EINE Quelle für
// Validierungs-Badge UND Bestätigungs-Karte.
export function aiCheckFailureReasonKey(
  fallbackReason: string | undefined,
  // AUFTRAG-mega9 Block E-3 (KW-E2E-007): die TATSÄCHLICHE Vertraulichkeitsstufe des Objekts, über
  // das gesprochen wird. Fehlt sie (Aufrufer ohne KO-Kontext), wird nichts über die Stufe behauptet.
  subjectConfidentiality?: Confidentiality | null,
): string {
  if (fallbackReason === "no-model") {
    return "val.aiCheck.reason.no-model";
  }
  if (fallbackReason === "timeout") {
    return "val.aiCheck.reason.timeout";
  }
  if (fallbackReason === "model-timeout") {
    return "val.aiCheck.reason.model-timeout";
  }
  if (fallbackReason === "queue-overflow") {
    return "val.aiCheck.reason.queue-overflow";
  }
  // D-AISTATE PAKET 1 (bens V1): vertraulich → Cloud ausgeschlossen, kein lokales Modell — ehrlich
  // „ohne KI geprüft (vertraulich)", NICHT als Modellfehler tarnen.
  //
  // AUFTRAG-mega9 Block E-3 (KW-E2E-007): Der Grund darf die STUFE nicht falsch benennen. Der Prüfer
  // fand einen ausdrücklich als „Öffentlich-intern" eingereichten Beitrag mit dem Grund „Vertraulich
  // — …" vor, und er trifft den wunden Punkt: gerade ein ehrlicher Grund muss semantisch exakt sein.
  //
  // Die Ursache liegt nicht in diesem Text, sondern darin, dass `confidential` eine PAAR-Eigenschaft
  // ist: services/conflicts/src/service.ts:286 und overlap-service.ts:200 bilden
  // `subject.confidential || cand.confidential`. Ein interner Beitrag, der gegen ein vertrauliches
  // Objekt verglichen wird, blockiert die Cloud-KI also ZU RECHT (sonst reiste der vertrauliche
  // Kandidatentext mit) — nur beschrieb der Text es so, als sei der Beitrag selbst vertraulich.
  //
  // Die Entscheidung bleibt unverändert (Sicherheitsfläche). Wahr wird der TEXT: nur wenn das Objekt
  // selbst nachweislich vertraulich ist, sagt der Grund das auch. Sonst — und wenn die Stufe dem
  // Aufrufer nicht bekannt ist — benennt er die Blockade ohne Behauptung über die Einstufung.
  //
  // AUFTRAG-mega11 Block A (bens SB-1, sicherheitsrelevant): mega9 sagte im zweiten Fall „Am Vergleich
  // war vertrauliches Wissen beteiligt". Das war zwar wahr, verriet dem Leser aber ZWEI Dinge über
  // fremden, geschützten Bestand: dass zu SEINEM Beitrag ein vertraulicher Vergleichspartner
  // EXISTIERT und dass dieser thematisch RELEVANT genug war, um überhaupt verglichen zu werden.
  //
  // Warum das trägt: das Validierungs-Board ist serverseitig bereits mit `ko.read` abrufbar
  // (services/app/src/routes/validation-routes.ts:25-33) — und `ko.read` ist NICHT das Recht,
  // vertrauliche Wissensobjekte zu sehen. Die Bibliotheks-Exportgrenze bindet vertrauliche Inhalte
  // demgegenüber ausdrücklich an `ko.validate` (services/app/src/routes/library-routes.ts:111-120).
  // Der mega9-Text nutzte also den schwächeren der beiden Maßstäbe, die wir im Haus haben.
  //
  // ENTSCHEIDUNG (bewusst EIN neutraler Text statt einer berechtigten Detailstufe): Eine Detailstufe
  // müsste serverseitig an `ko.validate` gebunden werden — eine reine Client-Rollenprüfung reichte
  // nicht, weil die Antwort dann trotzdem über die Leitung ginge. Dafür müsste der Grund an der
  // Validierungs-Route rechteabhängig UMGESCHRIEBEN werden (neue Server-Aufbereitung eines heute
  // rohen Feldes, neue Testfläche an einer Sicherheitsgrenze) — und der Nutzen wäre gering: WER den
  // vertraulichen Partner ist, dürfte der Text ohnehin nicht sagen; übrig bliebe „irgendwo existiert
  // etwas Vertrauliches". Das rechtfertigt keine zweite Ausgabestufe an einer Sicherheitsgrenze acht
  // Tage vor dem Code-Freeze. Der neutrale Text bleibt wahr (Cloud gesperrt, nur deterministisch
  // geprüft), ohne über Existenz oder Relevanz geschützten Bestands zu reden.
  if (fallbackReason === "confidential") {
    // Nur die EIGENE, dem Leser ohnehin sichtbare Stufe darf benannt werden.
    return isConfidential(subjectConfidentiality)
      ? "val.aiCheck.reason.confidential"
      : "val.aiCheck.reason.privacy-no-cloud";
  }
  // RT-001 (Pedi): ehrliche Feinunterscheidung echter Providerfehler — der classifyAiCheckFailure-
  // Klassifizierer im ai-check-worker leitet diese Ursachen aus Status/Meldung ab. NIE ein
  // Anbietername/Key/Endpunkt/roher Fehlertext — nur die nutzerverständliche Ursache je Key.
  if (fallbackReason === "auth") {
    return "val.aiCheck.reason.auth";
  }
  if (fallbackReason === "rate-limit") {
    return "val.aiCheck.reason.rate-limit";
  }
  if (fallbackReason === "unreachable") {
    return "val.aiCheck.reason.unreachable";
  }
  if (fallbackReason === "bad-response") {
    return "val.aiCheck.reason.bad-response";
  }
  // ============================================================================================
  // AUFTRAG-mega23 Block B — DER TECHNISCHE EINREIHUNGSFEHLER IST KEIN MODELLFEHLER.
  // ============================================================================================
  //
  // `submit-followup-failed` setzt der Server (ko-routes.ts), wenn beim Einreichen die EINREIHUNG
  // des Prüf-Jobs scheiterte — das Modell wurde dabei nie gefragt und hat nichts beanstandet. Ohne
  // eigenen Grund fiel dieser Fall auf `model-error` zurück: „Die KI-Prüfung ist mit einem Fehler
  // abgebrochen." Ein Prüfer konnte einen technischen Einreihungsfehler damit nicht von einem
  // fachlichen Modellfehler unterscheiden — und die beiden verlangen VERSCHIEDENE Handlungen: der
  // eine ein schlichtes Neu-Anstoßen, der andere einen Blick auf Modell/Zugang.
  //
  // Der Text bleibt deshalb NEUTRAL: er nennt die Einreihung, nicht das Modell, und behauptet
  // insbesondere NICHT, an Inhalt oder Konfiguration sei etwas auffällig gewesen.
  if (fallbackReason === "submit-followup-failed") {
    return "val.aiCheck.reason.submit-followup-failed";
  }
  // AUFTRAG-mega28 A3: „capacity" = der Lauf wurde wegen Modell-Rückstaus ABGEBROCHEN. Das ist kein
  // Modellfehler (nichts war am Inhalt oder am Zugang auffällig) und auch kein Zeitlimit — es wurde
  // schlicht nicht zu Ende geprüft. Ohne eigenen Schlüssel wäre es unter „model-error" gefallen und
  // hätte den Leser zur falschen Handlung geschickt.
  if (fallbackReason === "capacity") {
    return "val.aiCheck.reason.capacity";
  }
  return "val.aiCheck.reason.model-error";
}

// ================================================================================================
// AUFTRAG-mega28 A2 (Pedi 26.07.) — DER DECKEL MUSS SICH ZEIGEN, SONST IST ER EINE LÜGE.
// ================================================================================================
//
// Seit mega28 prüft die Erkennung nicht mehr „jeder gegen jeden", sondern gegen eine gedeckelte,
// deterministisch gewählte Kandidatenmenge. Damit gilt: ein gedeckelter Lauf darf NICHT aussehen
// wie ein vollständiger. Ein leeres Ergebnis nach einem gedeckelten Lauf heißt „in den nächsten 20
// nichts gefunden" — NIEMALS „konfliktfrei".
//
// WARUM GENAU HIER: Diese Datei ist die EINE Quelle des Textes, den ein Mensch über das Urteil des
// Prüf-Laufs liest — sie trägt Validierungs-Badge (Liste) UND Bestätigungs-Karte (/erfassen).
// Der Zusatz sitzt damit unmittelbar neben dem Satz, den er einschränkt, und nicht in einem
// internen Feld, das niemand aufschlägt. Beide Oberflächen zeigen ihn AUCH im Erfolgsfall („done") —
// gerade dort wäre das Schweigen die Lüge.
//
// Die Zahlen kommen roh vom Server (aiCheck.coverage): geprüfte Menge, verfügbare Menge. Ohne Feld
// (Altbestand, Lauf vor mega28) wird NICHTS behauptet — weder vollständig noch gedeckelt.
// ------------------------------------------------------------------------------------------------
// AUFTRAG-mega29 B4 (bens M28-2) — ZWEI EINSCHRÄNKUNGEN, ZWEI SÄTZE.
// ------------------------------------------------------------------------------------------------
// Bis mega28 lieferte diese Ableitung GENAU EINE Art, und bei `aborted` gewann der Abbruchtext:
// bereits aufgetretene Übersprünge verschwanden damit für den Leser vollständig. Ein Lauf, der drei
// Vergleiche wegen Modellfehlern ausließ UND danach abbrach, las sich wie einer, der nur abbrach.
// Jetzt trägt die Notiz eine LISTE — jede vorliegende Einschränkung bekommt ihren eigenen Satz.
// ------------------------------------------------------------------------------------------------
// AUFTRAG-mega32 BLOCK A1 (bens GELB-1) — „UNBELEGT" IST DIE VIERTE EINSCHRÄNKUNG.
// ------------------------------------------------------------------------------------------------
// `unproven` heißt: die Merker sind sauber, aber die ZAHLEN tragen die Aussage „vollständig geprüft"
// nicht (`selected < available` oder `completed < attempted`). Bis mega31 schwieg die Oberfläche in
// genau diesem Fall — sie fragte nur die drei Merker ab. Dass die heutigen Erzeuger die Merker
// richtig setzen, ist kein Vertrag, sondern ein Zufall, auf den wir uns zweimal verlassen haben.
export type AiCheckCoverageLimit = "aborted" | "skipped" | "capped" | "unproven";

export interface AiCheckCoverageNote {
  // Alle vorliegenden Einschränkungen, in Lese-Reihenfolge. Nie leer (sonst ist die Notiz null).
  limits: AiCheckCoverageLimit[];
  // AUFTRAG-mega29 B1/B3: die sichtbare Zahl ist `completed` — fehlerfrei zu Ende verglichene Paare.
  // Aus der ZUSAMMENFASSUNG beider Wege ist sie das Minimum, also eine konservative MINDESTabdeckung;
  // genau so benennen die Texte sie auch.
  completed: number;
  available: number;
  skipped: number;
}

// AUFTRAG-mega32 BLOCK A1 — DIE POSITIVE INVARIANTE, AUF DIESER SEITE DER LEITUNG.
//
// KANONISCH IST services/conflicts/src/coverage.ts, isCompleteRun(). Diese Funktion leitet NICHTS
// eigenständig ab; sie spiegelt dieselbe Regel, weil apps/web keine Services importieren darf (der
// Docker-webbuild-Stage kopiert nur apps/web — s. Commit 1881211, dort wurde genau dieser Import
// einmal zum gescheiterten Deploy). Die Parität hält ein WIRKSAMER Wächter
// (tests/conflicts/coverage-invariant-parity.test.ts): 32 aus der Bedingungsliste ERZEUGTE Fälle
// plus ein Gitter aus 1296 Datensätzen gegen eine unabhängige Referenz. AUFTRAG-mega33 C: fällt an
// einem der drei Orte eine Bedingung weg oder kommt eine hinzu, wird er rot — nachgewiesen durch
// je einen Mutationslauf pro Bedingung.
//
// Begründung je Bedingung s. conflicts/src/coverage.ts. Kurz: Vollständigkeit wird BEWIESEN
// (selected === available, attempted === completed), nicht daraus geschlossen, dass kein Merker
// widerspricht.
export function aiCheckCoverageComplete(coverage: AiCheckCoverage): boolean {
  return (
    coverage.selected === coverage.available &&
    coverage.attempted === coverage.completed &&
    coverage.skipped === 0 &&
    !coverage.capped &&
    !coverage.aborted
  );
}

export function aiCheckCoverageNote(
  coverage: AiCheckCoverage | null | undefined,
): AiCheckCoverageNote | null {
  if (!coverage) {
    return null; // kein Protokoll → keine Behauptung, in keine Richtung.
  }
  // AUFTRAG-mega32 A1: das Schweigen hängt AUSSCHLIESSLICH an der positiven Invariante. Vorher
  // entschied die (leere) Liste unten darüber — und die kannte nur Merker. Diese Reihenfolge ist der
  // ganze Block: erst der Beweis, dann seine Benennung.
  if (aiCheckCoverageComplete(coverage)) {
    return null; // BELEGT vollständig geprüft — hier ist Schweigen die Wahrheit.
  }
  const limits: AiCheckCoverageLimit[] = [];
  if (coverage.aborted) {
    limits.push("aborted");
  }
  if (coverage.skipped > 0) {
    limits.push("skipped");
  }
  // „gedeckelt" tritt nur ALLEIN auf: Abbruch und Übersprung benennen die Unvollständigkeit bereits
  // schärfer und sagen dieselbe Folgerung („ohne Fund heißt das nicht konfliktfrei") schon aus.
  if (!coverage.aborted && coverage.skipped === 0 && coverage.capped) {
    limits.push("capped");
  }
  // Unvollständig, aber kein Merker benennt es: die Zahlen widersprechen sich. Ein eigener Satz —
  // ihn weglassen hieße, die Notiz ohne Grund zu zeigen; ihn unter „gedeckelt" zu buchen hieße,
  // eine Ursache zu behaupten, die das Protokoll nicht ausweist.
  if (limits.length === 0) {
    limits.push("unproven");
  }
  return {
    limits,
    completed: coverage.completed,
    available: coverage.available,
    skipped: coverage.skipped,
  };
}

// Der i18n-Schlüssel je Einschränkung. Flach gehalten (Muster AI_CHECK_CARD_TEXT), damit Test und
// Komponente dieselbe Quelle lesen.
export const AI_CHECK_COVERAGE_TEXT = {
  aborted: "val.aiCheck.coverage.aborted",
  skipped: "val.aiCheck.coverage.skipped",
  capped: "val.aiCheck.coverage.capped",
  unproven: "val.aiCheck.coverage.unproven",
} as const;

export function aiCheckCoverageNoteKeys(note: Pick<AiCheckCoverageNote, "limits">): string[] {
  return note.limits.map((limit) => AI_CHECK_COVERAGE_TEXT[limit]);
}

// Die Platzhalter-Werte, die ALLE Coverage-Texte teilen — EINE Quelle für Badge, Karte, KO-Detail
// und Test, damit keine Fläche eine eigene Zuordnung erfindet.
export function aiCheckCoverageVars(note: AiCheckCoverageNote): {
  completed: number;
  available: number;
  skipped: number;
} {
  return { completed: note.completed, available: note.available, skipped: note.skipped };
}

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test (Muster CAPTURE_FILE_TEXT).
export const AI_CHECK_CARD_TEXT = {
  running: "capture.aiCheck.running",
  done: "capture.aiCheck.done",
  failed: "capture.aiCheck.failed",
} as const;

// PAKET 1.4 (D-AISTATE, Pedi 23.07.): ehrlicher Name je Modellzustand. MIT nutzbarem Modell läuft die
// Duplikat-/Konfliktprüfung zusätzlich „(mit KI)"; OHNE Modell trägt allein die deterministische Ebene —
// dann NICHT „KI-Prüfung", sondern schlicht „Duplikat-/Konfliktprüfung". EINE Quelle für Badge (Liste),
// Bestätigungs-Karte (/erfassen) und Sperr-Hinweis (Validierung).
export function aiCheckPendingLabelKey(modelActive: boolean): string {
  return modelActive ? "val.aiCheck.pendingAi" : "val.aiCheck.pending";
}
export function aiCheckPendingHintKey(modelActive: boolean): string {
  return modelActive ? "val.aiCheck.pendingHintAi" : "val.aiCheck.pendingHint";
}
export function aiCheckCardRunningKey(modelActive: boolean): string {
  return modelActive ? "capture.aiCheck.runningAi" : "capture.aiCheck.running";
}
export function aiCheckCardDoneKey(modelActive: boolean): string {
  return modelActive ? "capture.aiCheck.doneAi" : "capture.aiCheck.done";
}

// Poll-Intervall der Karte: schnell genug für den Kurz-Check (Sekunden bis wenige Minuten),
// sparsam genug, um den Server nicht zu belasten.
export const AI_CHECK_POLL_MS = 3000;

export type AiCheckCardState =
  | { kind: "running" }
  | { kind: "done" }
  | { kind: "failed"; reasonKey: string }
  // Kein Prüf-Job vermerkt (Altbestand / Deployment ohne Worker): NICHTS behaupten —
  // weder „läuft" noch ein stilles Grün.
  | { kind: "none" };

export function aiCheckCardState(
  aiCheck: KnowledgeObject["aiCheck"] | null | undefined,
  // AUFTRAG-mega9 Block E-3 (KW-E2E-007): die Stufe des Objekts, damit der Grund sie nicht erfindet.
  subjectConfidentiality?: Confidentiality | null,
): AiCheckCardState {
  if (!aiCheck) {
    return { kind: "none" };
  }
  if (aiCheck.status === "failed") {
    return {
      kind: "failed",
      reasonKey: aiCheckFailureReasonKey(aiCheck.fallbackReason, subjectConfidentiality),
    };
  }
  if (aiCheck.status === "done") {
    return { kind: "done" };
  }
  return { kind: "running" };
}

// Weiter pollen NUR solange der echte Status offen ist — done/failed/none beenden das Polling.
export function aiCheckPollAgain(aiCheck: KnowledgeObject["aiCheck"] | null | undefined): boolean {
  return aiCheck?.status === "pending";
}

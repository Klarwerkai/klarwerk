// ================================================================================================
// AUFTRAG-mega33 BLOCK A (Pedi 27.07., nach bens ROT 3 und ROT 4) — DIE EINE EFFEKTIVE
// ANTWORT-EINSTUFUNG.
// ================================================================================================
//
// DER BAU-FEHLER, den mega32 offen ließ: es gab eine abgeleitete Aussage („ist diese Antwort
// gesichert?") und SECHS Orte, die sie sich selbst bildeten — Vertragskasten, Statusplakette,
// Evidenzplakette, Review-Wächter, Export und die mobile Antwort. mega32 senkte genau einen davon
// ab. Ergebnis: oben ein Prüfvorbehalt, darunter „Gesichert". Ein Vorbehalt an einer Stelle
// repariert die anderen nicht — er erzeugt eine Seite, die sich selbst widerspricht.
//
// DIESE DATEI IST DIE EINE STELLE. Aus Wissensklasse, Konfliktlage und Abdeckung entsteht GENAU
// EINE Einstufung; jede Anzeige, jeder Wächter und jeder Ausgabeweg liest ausschließlich sie.
// Zusammengesetzt wird sie in effectiveAnswer.ts; hier steht die Regel selbst, ohne Abhängigkeit
// auf Quellenauflösung oder DOM.
//
// KEINE NEUE ANTWORTLOGIK, KEIN SCORING, KEIN BACKEND. Nur die Zusammenführung von Signalen, die
// schon da sind.
import type { KnowledgeClass } from "../api/types";

export type AnswerGrade =
  // Sicherheit ist BELEGT: gesicherte Klasse, keine konfliktbegrenzte Quelle, jede herangezogene
  // Quelle mit vollständig belegtem Prüf-Lauf. Der einzige Zustand, der ein „Gesichert" trägt.
  | "verified"
  // Beantwortet und quellengebunden, aber ohne Beleg für Sicherheit — ehrlich markiert.
  | "unverified"
  // Keine Antwort: Wissenslücke, kein Fehler.
  | "gap";

// ALLE FÜNF EINGABEN SIND PFLICHT. Das ist bens A3-Befund: `sourcesCheckUnproven` war optional, ein
// anderer Aufrufer konnte die Bedingung damit weglassen und für eine gesicherte Klasse weiterhin
// `verified` bekommen. Ein Typvertrag, der eine Umgehung erlaubt, wird irgendwann umgangen.
export interface AnswerGradeInput {
  answered: boolean;
  knowledgeClass: KnowledgeClass;
  // Mindestens eine herangezogene Quelle ist konfliktbegrenzt (BEKANNTER offener Konflikt).
  sourcesConflicted: boolean;
  // Mindestens eine herangezogene Quelle trägt KEINEN vollständig belegten Prüf-Lauf. Beweislast-
  // Umkehr aus mega31 A: nicht „kein Gegenbeweis ⇒ sicher", sondern „ohne Beleg kein sicher".
  sourcesCheckUnproven: boolean;
  // AUFTRAG-mega34 BLOCK A1 — DIESELBE UMKEHR, EINE SCHICHT WEITER AUSSEN.
  //
  // `sourcesConflicted` beantwortet „sind BEKANNTE Konflikte im Spiel?". Diese Frage ist wertlos,
  // solange offen ist, ob die bekannten Konflikte überhaupt vorliegen. Bis mega33 kam die
  // Konfliktliste als nacktes Array an, und `conflicts.data ?? []` machte aus „noch nicht geladen"
  // und „Abruf fehlgeschlagen" ein glattes „keine Konflikte" — fail-open, genau die Annahme, die
  // mega31 am Ergebnis abgeschafft hat.
  //
  // Deshalb ist auch DIESES Signal Pflicht und nicht optional: sonst schaltet der nächste Aufrufer
  // die Bedingung wieder ab, indem er sie weglässt.
  conflictsUnproven: boolean;
}

export function answerGrade(input: AnswerGradeInput): AnswerGrade {
  if (!input.answered) {
    return "gap";
  }
  if (
    input.knowledgeClass === "gesichert" &&
    !input.sourcesConflicted &&
    !input.sourcesCheckUnproven &&
    !input.conflictsUnproven
  ) {
    return "verified";
  }
  return "unverified";
}

// Die Evidenzklasse, wie sie ANGEZEIGT werden darf. Der Datensatz bleibt unangetastet — abgesenkt
// wird die Aussage über ihn: ohne belegte Einstufung darf „gesichert" nirgends erscheinen, weder
// als Plakette noch im Export, weder auf dem Desktop noch mobil. Alle anderen Klassen sind bereits
// ehrlich und bleiben stehen (eine „Meinung" wird durch eine lückenhafte Prüfung nicht falscher).
export function effectiveKnowledgeClass(
  grade: AnswerGrade,
  knowledgeClass: KnowledgeClass,
): KnowledgeClass {
  if (grade === "verified" || knowledgeClass !== "gesichert") {
    return knowledgeClass;
  }
  return "ungeprueft";
}

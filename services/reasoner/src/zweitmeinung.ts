// ================================================================================================
// AUFNAHME 20260922 (R-0305, R-1099) · DER ABGLEICH ZWEIER ANTWORTEN AUF DIESELBE FRAGE.
// ================================================================================================
//
// Rein, ohne Modell, ohne Netz, ohne Zustand. Er urteilt NICHT, welche Antwort richtig ist, und er
// behauptet keine inhaltliche Übereinstimmung. Er sucht Warnzeichen an drei Merkmalen, die sich ohne
// ein drittes Urteil prüfen lassen (Begriffe an `ZweitmeinungAbweichung` in `./types`).
//
// WAS ER BEWUSST NICHT TUT: Wortlaut vergleichen. Zwei Modelle formulieren dieselbe Aussage fast
// immer verschieden; ein Wortlautmaß schlüge deshalb bei nahezu jeder Frage an, und eine Warnung, die
// immer kommt, liest niemand mehr. Ein Widerspruch ohne Zahl und ohne Quellenunterschied („öffnen"
// gegen „schließen") bleibt damit für den Abgleich unsichtbar — das sagt die Oberfläche dazu, und
// deshalb stehen beide Antworten immer vollständig nebeneinander.
import type { AnswerResult, ZweitmeinungAbweichung } from "./types";

type Vergleichsantwort = Pick<AnswerResult, "answered" | "answer" | "citedSources">;

// Fußnotenmarken `[1]` sind Verweise, keine Aussage — sie fallen vor der Zahlensuche heraus.
const FUSSNOTE = /\[\d+\]/gu;
// Eine Zahl samt Dezimalteil; „1.000" und „1,5" bleiben je EINE Zahl.
const ZAHL = /\d+(?:[.,]\d+)*/gu;

/** Die in einem Antworttext genannten Zahlen, mit Komma als Punkt geschrieben. */
export function genannteZahlen(text: string | null): Set<string> {
  if (!text) {
    return new Set();
  }
  const ohneFussnoten = text.replace(FUSSNOTE, " ");
  return new Set([...ohneFussnoten.matchAll(ZAHL)].map((m) => m[0].replace(/,/gu, ".")));
}

function gleicheMenge(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((wert) => b.has(wert));
}

/**
 * Die Warnzeichen zwischen zwei Antworten — leer heißt „an diesen Merkmalen kein Unterschied".
 *
 * Quellen und Zahlen werden NUR verglichen, wenn beide Seiten etwas nennen. Eine leere Liste
 * tragender Quellen heißt „Zuordnung unbekannt" (AUFTRAG-mega52 A5), keine Zahl heißt „keine Zahl
 * genannt" — beides ist kein Widerspruch, und ein Warnzeichen daraus wäre erfunden.
 */
export function vergleicheAntworten(
  erste: Vergleichsantwort,
  zweite: Vergleichsantwort,
): ZweitmeinungAbweichung[] {
  if (erste.answered !== zweite.answered) {
    return ["beantwortet"];
  }
  if (!erste.answered) {
    // Beide finden keine belastbare Grundlage — das ist eine übereinstimmende Auskunft.
    return [];
  }
  const abweichungen: ZweitmeinungAbweichung[] = [];
  const quellenA = new Set(erste.citedSources);
  const quellenB = new Set(zweite.citedSources);
  if (quellenA.size > 0 && quellenB.size > 0 && ![...quellenA].some((id) => quellenB.has(id))) {
    abweichungen.push("quellen");
  }
  const zahlenA = genannteZahlen(erste.answer);
  const zahlenB = genannteZahlen(zweite.answer);
  if (zahlenA.size > 0 && zahlenB.size > 0 && !gleicheMenge(zahlenA, zahlenB)) {
    abweichungen.push("zahlen");
  }
  return abweichungen;
}

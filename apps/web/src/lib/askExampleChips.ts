// WP-UX-WOW-1 U2/U3 (Kopfs Live-Befund, P1): die Beispiel-Chips auf /fragen behaupteten STATISCH
// „findet validiertes Wissen" — live konnte das falsch sein (F3-Beispiel → Wissenslücke). Ehrlich
// wird es über Weg (a): die Antwort-Beispiele werden aus dem ECHTEN validierten Bestand abgeleitet
// (2–3 zufällig gewählte validierte KOs → Frage „Was gilt zu: <Titel>?"); dazu bleibt EINE bewusste
// Lücken-Frage (bestehendes gap-Beispiel). Ohne validierten Bestand fallen die Chips auf die
// statischen Beispiele MIT NEUTRALEM Badge zurück („Beispiel ausprobieren" — keine Behauptung).
// DOM-frei; die Zufallsquelle ist injizierbar (Tests). Klick sendet DIREKT (U3) — verdrahtet in Ask.
import type { KnowledgeObject } from "../api/types";
import { ASK_EXAMPLES } from "./askExamples";
import { isKnownNonConfidential } from "./confidentiality";

export interface AskChipFromKo {
  kind: "ko";
  title: string; // Chip-Frage entsteht per i18n-Muster ask.koQuestion aus diesem Titel
}

export interface AskChipFromExample {
  kind: "example";
  questionKey: string;
  // "gap" = bewusste Lücken-Frage (Badge ehrlich); null = neutral (keine Ergebnis-Behauptung).
  expectation: "gap" | null;
}

export type AskExampleChip = AskChipFromKo | AskChipFromExample;

export const ASK_CHIP_MAX_KOS = 3;

// ================================================================================================
// AUFTRAG-mega38 BLOCK J3 (Pedi 27.07.) — DER ERSTE VORSCHLAG, DEN SIE SIEHT.
// ================================================================================================
// Live stand als ERSTE Beispielfrage auf /fragen:
//   „Was gilt zu: 2 General requirements Based on HD Handbuch Vers Q1-2025 (partly)?"
// Ein roher Importtitel, englisch, mit Gliederungsziffer und einem „(partly)" am Ende. Geprüft
// wurde bis mega37 nur `title.trim().length > 0` — jede Zeichenkette wurde zur Frage.
//
// Die Regeln unten sind bewusst STRENG und bewusst DUMM: sie beurteilen keine Qualität, sie
// erkennen nur, ob ein Titel wie ein Satz AUSSIEHT. Ein zu Unrecht aussortierter guter Titel
// kostet hier nichts — es gibt immer noch andere, und ganz ohne Treffer greifen die festen
// Beispiele. Ein zu Unrecht DURCHGELASSENER Titel kostet dagegen den ersten Eindruck.
const MIN_LAENGE = 10;
const MAX_LAENGE = 70;
const MIN_WOERTER = 2;
const MAX_WOERTER = 8;

export function looksLikeSentenceTitle(title: string): boolean {
  const t = title.trim();
  if (t.length < MIN_LAENGE || t.length > MAX_LAENGE) {
    return false;
  }
  // Klammern in einem importierten Titel sind fast immer eine Herkunfts-Anmerkung des Quellsystems
  // („(partly)", „(Rev. 3)"). In eine Frage eingesetzt lesen sie sich gebrochen.
  if (t.includes("(") || t.includes(")")) {
    return false;
  }
  // Ein Satz beginnt mit einem Buchstaben — nicht mit einer Gliederungsziffer („2 General …"),
  // nicht mit einem Aufzählungszeichen, nicht mit einer Dokumentnummer.
  if (!/^\p{L}/u.test(t)) {
    return false;
  }
  const woerter = t.split(/\s+/).filter((w) => w.length > 0);
  return woerter.length >= MIN_WOERTER && woerter.length <= MAX_WOERTER;
}

export function buildAskExampleChips(
  kos: readonly KnowledgeObject[],
  pick: () => number = Math.random,
): AskExampleChip[] {
  // WP-POLISH-CLOSE (bens Punkt 1, Sichtbarkeits-/Egress-Kante): vertrauliche UND streng
  // vertrauliche KOs erscheinen NIE als Chip — ihr Titel würde sichtbar UND per Chip-Klick als
  // Frage in den Ask-/Modellpfad wandern. Fail-safe über isKnownNonConfidential: nur die
  // eindeutig nicht-vertrauliche Stufe (explizit „intern" oder das fehlende Feld = dokumentierte
  // intern-Codierung des Servers) ist Chip-tauglich; jeder unbekannte Wert ist ausgeschlossen.
  const validated = kos.filter(
    (k) =>
      k.status === "validiert" &&
      // AUFTRAG-mega38 BLOCK J3: hier stand `k.title.trim().length > 0` — jede Zeichenkette
      // wurde zur Beispielfrage, auch ein roher Importtitel.
      looksLikeSentenceTitle(k.title) &&
      isKnownNonConfidential(k.confidentiality),
  );
  const pool = [...validated];
  const chosen: AskChipFromKo[] = [];
  while (pool.length > 0 && chosen.length < ASK_CHIP_MAX_KOS) {
    const index = Math.min(pool.length - 1, Math.max(0, Math.floor(pick() * pool.length)));
    const [ko] = pool.splice(index, 1);
    if (ko) {
      chosen.push({ kind: "ko", title: ko.title });
    }
  }
  if (chosen.length === 0) {
    // Kein validierter Bestand (leer/Lade-Fallback): statische Beispiele OHNE Ergebnis-Behauptung.
    return ASK_EXAMPLES.map((example) => ({
      kind: "example",
      questionKey: example.questionKey,
      expectation: null,
    }));
  }
  const gapExample = ASK_EXAMPLES.find((example) => example.kind === "gap");
  return gapExample
    ? [...chosen, { kind: "example", questionKey: gapExample.questionKey, expectation: "gap" }]
    : [...chosen];
}

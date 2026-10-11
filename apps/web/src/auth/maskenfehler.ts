// ================================================================================================
// R-0531 · DER FEHLER DER ÖFFENTLICHEN MASKEN IST EIN ZUSTAND, KEIN FERTIGER SATZ.
// ================================================================================================
//
// „Die Wahl wirkt sofort auf alle Texte der Maske." Ein Fehler, der als fertiger Satz im Zustand
// liegt, kann das nicht: er bleibt in der Sprache stehen, in der er entstand. Deshalb wird jeder
// Satz beim Eintreffen in einen SCHLÜSSEL übersetzt und erst beim Zeichnen in der gerade gewählten
// Sprache formuliert — auch eine Ablehnung, die erst NACH dem Umschalten eintrifft.
//
// WOHER DER SCHLÜSSEL KOMMT. Der Fehlercode am Draht ist zu grob (`INVALID_CREDENTIALS` steht für
// falsche Zugangsdaten UND für einen ungültigen Reset-Link). Eindeutig ist der Wortlaut: der Server
// sendet ausschließlich Sätze aus seinem Katalog, und die Sätze, die diese Masken erreichen, liegen
// zeichengleich in `texte/anmeldefehler.ts`. Erkannt wird in allen drei Sprachen, also unabhängig
// davon, mit welcher Sprache die Anfrage abging.
//
// Die Sätze, die die Maske selbst setzt (`state.error` für einen Netz- oder Formatfehler,
// `auth.passwordMismatch`), werden genauso erkannt — über die geladenen Wörterbücher.
//
// UNBEKANNT bleibt ein Satz, der nirgends vorrätig ist. Er steht, solange die Sprache gewählt ist, in
// der er formuliert wurde; danach steht an seiner Stelle eine Erklärung in der gewählten Sprache.
import anmeldefehler from "../texte/anmeldefehler";
import { SPRACHEN } from "../texte/intern/pruefung";

export type Maskenfehler =
  | { readonly schluessel: string }
  | { readonly roh: string; readonly sprache: string };

/** Die Sätze, die die Masken selbst formulieren (Grundbestand). */
const EIGENE_SCHLUESSEL = ["state.error", "auth.passwordMismatch"] as const;

const UNBEKANNT = "anmeldefehler.unbekannt";

interface Woerterbuecher {
  getResource(lng: string, ns: string, key: string): unknown;
}

/** Ein eingetroffener Satz → Schlüssel, wenn er irgendwo vorrätig ist; sonst der rohe Satz. */
export function maskenfehlerAus(
  text: string,
  sprache: string,
  woerterbuecher: Woerterbuecher,
): Maskenfehler {
  for (const l of SPRACHEN) {
    for (const [schluessel, fassung] of Object.entries(anmeldefehler[l])) {
      if (schluessel !== UNBEKANNT && fassung === text) {
        return { schluessel };
      }
    }
    for (const schluessel of EIGENE_SCHLUESSEL) {
      if (woerterbuecher.getResource(l, "translation", schluessel) === text) {
        return { schluessel };
      }
    }
  }
  return { roh: text, sprache };
}

/** Der Satz in der gerade gewählten Sprache. */
export function maskenfehlerText(
  fehler: Maskenfehler,
  t: (schluessel: string) => string,
  gewaehlt: string,
): string {
  if ("schluessel" in fehler) {
    return t(fehler.schluessel);
  }
  return fehler.sprache === gewaehlt ? fehler.roh : t(UNBEKANNT);
}

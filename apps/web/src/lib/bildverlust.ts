// JOB 512 (R5) — die Entscheidung „liegt ein Bildverlust vor" an GENAU EINER Stelle.
//
// Der Verlust, um den es geht, passiert VOR der Erzeugung des `bodyHtml`: Der Importer zählt die
// Bilder der Quelldatei (PPTX: `a:blip`; DOCX: `totalImages`) und verwirft danach Bilder am
// Format-, Byte- oder Budgetdeckel. Die Galerie unter dem Editor sieht nur noch das Ergebnis. Ohne
// die Quellzahl kann sie einen Verlust prinzipiell nicht erkennen — „0 von 0" sieht dann aus wie
// ein Dokument, das nie Bilder hatte.
//
// Warum eine eigene Datei und kein `if` in der Komponente: Die Frage „liegt ein Verlust vor" darf
// nicht an mehreren Flächen verschieden beantwortet werden.

/** Die Zahl der Bilder in der Quelldatei — `null`/`undefined`, wo der Importweg sie nicht kennt. */
export type Quellbildzahl = number | null | undefined;

export type Bildverlust =
  | {
      readonly art: "verlust";
      readonly fehlend: number;
      readonly quelle: number;
      readonly koerper: number;
    }
  | { readonly art: "kein-hinweis" }
  | { readonly art: "unbekannt" };

/**
 * Fail-closed: nur eine ganze, nicht negative Zahl ist eine belastbare Bildzahl. `NaN`, negative
 * Werte, Bruchzahlen und Fremdtypen ergeben `unbekannt` — NICHT `0`. Der Unterschied ist der
 * ganze Punkt: `0` behauptet „die Quelle hatte keine Bilder", `unbekannt` sagt „ich weiß es nicht".
 */
function brauchbar(wert: unknown): wert is number {
  return typeof wert === "number" && Number.isInteger(wert) && wert >= 0;
}

export function bildverlust(quelle: Quellbildzahl, koerper: unknown): Bildverlust {
  if (!brauchbar(quelle) || !brauchbar(koerper)) {
    return { art: "unbekannt" };
  }
  const fehlend = quelle - koerper;
  if (fehlend <= 0) {
    // Gleichstand UND der Überschussfall (mehr Körper- als Quellbilder, möglich durch die
    // Folienkonvertierung): kein Hinweis, und niemals eine negative Zahl in der Meldung.
    return { art: "kein-hinweis" };
  }
  return { art: "verlust", fehlend, quelle, koerper };
}

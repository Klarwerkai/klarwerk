// R-1349 (Aufnahme gesamt-aufruferwaechter) · DER KLARTEXT-MASSSTAB DER ANTWORTDARSTELLUNG.
//
// Bis hierher stand diese Funktion als `stripAnswerMarkdown` in `apps/web/src/lib/answerMarkdown.ts`
// — gebaut für das Word-Aufgabenfenster, das das Modul aber nie lud (es trägt seine eigene Fassung
// in `public/word-addin/taskpane.js`). Im Produkt rief sie niemand; gelesen wurde sie nur von den
// Darstellungstests, die den angezeigten Text gegen den gelieferten halten. Deshalb steht sie hier.
// Wortgleich übernommen und auf der öffentlichen Zerlegung `parseAnswerMarkdown` gebaut — der
// Maßstab rechnet damit über dieselben Segmente, die die Oberfläche rendert.
import { type AnswerInlinePart, parseAnswerMarkdown } from "../../apps/web/src/lib/answerMarkdown";

// Markdown-Zeichen entfernen, Inhalt (inkl. Listenpunkte als eigene Zeilen) erhalten. Kein Rendern.
export function stripAnswerMarkdown(answer: string): string {
  const lines: string[] = [];
  for (const segment of parseAnswerMarkdown(answer)) {
    const flat = (parts: AnswerInlinePart[]): string => parts.map((p) => p.text).join("");
    if (segment.kind === "list") {
      segment.items.forEach((item, i) => {
        lines.push(segment.ordered ? `${i + 1}. ${flat(item)}` : `- ${flat(item)}`);
      });
    } else {
      lines.push(flat(segment.parts));
    }
  }
  return lines.join("\n");
}

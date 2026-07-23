// WP-SHIP9-S2 Paket 3 (E2, Pedis Vorschlag): reine Kurzvorschau eines Wissensobjekts/Import-Kandidaten.
// Quelle ist die bereits in der Liste liegende Kernaussage (statement) — KEIN Server-Roundtrip. Fehlt
// sie (Altbestand), fällt es auf den zu Text reduzierten Body zurück. Ergebnis ist IMMER ein reiner
// String für einen React-Textknoten (nie Roh-HTML): die ersten ~2–3 Sätze, hart auf eine Obergrenze
// gedeckelt. Bewusst inhaltlich = die vorhandene Kernaussage (menschlich verfasst), kein KI-Text.

export interface KoPreviewSource {
  statement?: string;
  bodyHtml?: string | null;
}

// Roh-HTML → Text: Tags entfernen, benannte/numerische Entities grob auf ein Leerzeichen reduzieren.
// Reine Anzeige-Reduktion (Fallback für Altbestand ohne statement); das Ergebnis wird als Textknoten
// gerendert, nie als HTML.
function stripHtmlToText(html: string): string {
  return (
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/&[a-z0-9#]+;/gi, " ")
      .replace(/\s+/g, " ")
      // Entfernte Inline-Tags hinterlassen ein Leerzeichen vor Satzzeichen — glätten.
      .replace(/\s+([.!?,;:])/g, "$1")
      .trim()
  );
}

export function koPreviewText(
  source: KoPreviewSource,
  opts?: { maxSentences?: number; maxChars?: number },
): string {
  const maxSentences = opts?.maxSentences ?? 3;
  const maxChars = opts?.maxChars ?? 240;
  const statement = (source.statement ?? "").replace(/\s+/g, " ").trim();
  const base = statement || stripHtmlToText(source.bodyHtml ?? "");
  if (base.length === 0) {
    return "";
  }
  const sentences = base.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [base];
  let out = sentences.slice(0, maxSentences).join(" ").replace(/\s+/g, " ").trim();
  if (out.length > maxChars) {
    out = `${out.slice(0, maxChars).trimEnd()}…`;
  }
  return out;
}

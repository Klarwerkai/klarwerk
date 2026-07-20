// WP-D10 (Fix 4, Pedis Live-Befund): gleichnamige Beiträge waren auf den Validierungs-Karten nicht
// unterscheidbar — das VORHANDENE KO-Feld createdAt wird jetzt dezent angezeigt (Karte + Detail).
// KEINE neue Persistenz: Der KO-Vertrag führt createdAt (ISO-String); ein updatedAt existiert am KO
// NICHT (nur Drafts tragen es) — es wird deshalb ehrlich NICHT angezeigt statt erfunden.
// Fehlt das Feld bei Altdaten oder ist es unparsebar → null (Aufrufer lässt die Zeile ehrlich weg,
// kein Platzhalter-Datum).

// Lokalisiert als „20.07.2026 19:41" (DE) bzw. Locale-Äquivalent — Datum + Uhrzeit, ohne Sekunden.
export function formatKoTimestamp(iso: string | null | undefined, locale: string): string | null {
  if (!iso || iso.trim().length === 0) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const day = date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time}`;
}

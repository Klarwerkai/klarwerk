// ================================================================================================
// JOB 4203 · D3 · RUNDE 2 — DIE ZELLMATRIX, EINMAL FÜR NODE UND EINMAL FÜR DEN BROWSER.
// ================================================================================================
//
// Diese Datei ist KEIN Test. Sie liefert das Prüfmittel, das in Runde 1 gefehlt hat.
//
// WARUM ES NÖTIG IST (BEN zum Urteil der Runde 1, Prüfpunkt 2): der Bedienwegnachweis suchte die
// Zelltexte EINZELN im Flächentext. So ein Test ist grün, solange alle Wörter irgendwo stehen — er
// sieht nicht, WELCHE Zelle unter WELCHER Überschrift steht. Genau dort lag der Fehler: aus
// `| Ventil A\|B | bestanden |` wurden drei Zellen, und unter „Ergebnis" stand „B". Jedes einzelne
// Wort war vorhanden; die Aussage war trotzdem falsch.
//
// Deshalb wird ab jetzt die MATRIX verglichen — Zeile für Zeile, Zelle für Zelle, in ihrer
// Reihenfolge. Zwei Ableser, weil zwei Orte gemessen werden:
//   · `zellmatrixAusHtml` liest den erzeugten Rumpf (Node, ohne DOM) — für die Funktionsprüfung.
//   · `ZELLMATRIX_IM_BLATT` läuft IN der Seite und liest den gerenderten Baum — für den Bedienweg.
// Beide liefern dieselbe Form, damit ein Fall sie gegen dieselbe Konstante legen kann.

/** Ein `<td>`/`<th>`-Inhalt, von HTML-Maskierung befreit und mit gefaltetem Leerraum. */
function zelltext(roh: string): string {
  return (
    roh
      .replace(/<[^>]*>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // `&amp;` ZULETZT — sonst würde aus `&amp;lt;` erst `&lt;` und daraus `<`.
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Die Zellmatrix der ERSTEN Tabelle im HTML: Kopfzeile zuerst, dann die Datenzeilen.
 * Leere Liste = es gibt gar keine Tabelle (und darüber wird dann auch nichts behauptet).
 */
export function zellmatrixAusHtml(html: string): string[][] {
  const tabelle = /<table[^>]*>([\s\S]*?)<\/table>/.exec(html)?.[1];
  if (tabelle === undefined) {
    return [];
  }
  return [...tabelle.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((zeile) =>
    [...(zeile[1] ?? "").matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/g)].map((zelle) =>
      zelltext(zelle[1] ?? ""),
    ),
  );
}

/**
 * Derselbe Ableser, aber IN der Seite: die Zellmatrix der ersten Tabelle in der Schreibfläche des
 * Blattes. Gemessen wird der gerenderte Baum — nicht eine Zeichenkette, die danach aussieht.
 */
export const ZELLMATRIX_IM_BLATT = `() => {
  const wurzel = document.querySelector('[data-testid="blatt-text"]') || document.body;
  const tabelle = wurzel.querySelector('table');
  if (!tabelle) { return []; }
  return Array.prototype.map.call(tabelle.querySelectorAll('tr'), (tr) =>
    Array.prototype.map.call(tr.querySelectorAll('td, th'), (z) =>
      (z.textContent || '').replace(/\\s+/g, ' ').trim()));
}`;

/**
 * Die Zellmatrix der ersten Tabelle auf einer beliebigen Seite (z. B. am Wissenseintrag, wo es
 * kein `blatt-text` gibt). Gleiche Form, gleiche Faltung.
 */
export const ZELLMATRIX_AUF_DER_SEITE = `() => {
  const tabelle = document.querySelector('table');
  if (!tabelle) { return []; }
  return Array.prototype.map.call(tabelle.querySelectorAll('tr'), (tr) =>
    Array.prototype.map.call(tr.querySelectorAll('td, th'), (z) =>
      (z.textContent || '').replace(/\\s+/g, ' ').trim()));
}`;

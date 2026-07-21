// WP-IC-PAKET-1e (bens sammel10): DIE eine Pro-Item-Kanonisierung des Decode-Marker-Vertrags —
// EINMAL definiert, von summarizeImportItems (Erkundungs-Aggregat) UND filterImportItems (Selektion)
// genutzt. Damit sind Summary-Chips garantiert selektierbar: derselbe kanonische Wert, der als Chip
// erscheint, matcht beim Klick auch das Item (auch unmarkierten Altbestand mit rohen Entities).
// KEINE Zweitlogik anderswo — ein Drift-Pin-Test erzwingt, dass beide Seiten genau diese Funktion
// verwenden. Cross-Modul über die öffentliche structure-API (dependency-cruiser-konform).
import { decodeHtmlEntities } from "../../structure";
import type { ImportItem } from "./types";

// Markierte Items sind kanonisch (byte-genau lassen — ein echtes Literal &uuml; bleibt Literal);
// unmarkierte Items sind echter Altbestand und werden serverseitig EINMAL dekodiert.
export function canonicalImportText(item: Pick<ImportItem, "textCodec">, text: string): string {
  return item.textCodec === "decoded" ? text : decodeHtmlEntities(text);
}

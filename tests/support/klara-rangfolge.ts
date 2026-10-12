import { type ResolvedKlaraEntry, klaraGrundlage } from "../../apps/web/src/lib/klaraRegistry";

// R-1349 (Aufnahme gesamt-aufruferwaechter, Nacharbeit 7): bis hierher stand `rankKlara` als Export
// in `apps/web/src/lib/klaraRegistry.ts`. Das Produkt rief sie nicht mehr — `askAi` nimmt
// `klaraGrundlage`, und die ist ohne Bibliotheksauszüge zeichengleich mit der reinen
// Registry-Rangliste (Kommentar dort). Die Prüfstände messen dieselbe Rangliste deshalb am
// Produktweg: dieselbe Bewertung, dieselbe Reihenfolge, dieselbe Vorgabe von sechs Einträgen.
export function rankKlara(
  entries: readonly ResolvedKlaraEntry[],
  query: string,
  limit = 6,
): ResolvedKlaraEntry[] {
  return klaraGrundlage(entries, [], query, limit);
}

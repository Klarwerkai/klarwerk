// Aufnahme 20260922 · Paarpflichten-dauerhaft (G2): die Brücke Wissensobjekt → Paarpflicht-Aussage.
// conflicts kennt knowledge-object nicht; hier — wie in conflict-detection.ts — treffen sich beide.
// Wiederverwendet wird die vorhandene Prüfbasis (pruefbasis.ts): `quelle` ist die Quellrevision
// (Fassung + Quellen + Anhänge), `kontext` die Einordnung samt Vertraulichkeit, der Bestandsstempel
// der Kontext des ganzen Laufs. Es reist kein Text in die Pflicht, nur Kennungen und Fingerabdrücke.
import type { PaarpflichtAussage, PaarpflichtKontext } from "../../conflicts";
import { type KnowledgeObject, type KoService, pruefbasisVon } from "../../knowledge-object";

export function paarpflichtAussageVon(ko: KnowledgeObject, bestand: string): PaarpflichtAussage {
  const basis = pruefbasisVon(ko, bestand);
  return {
    refId: ko.id,
    version: ko.version,
    quelle: basis.quelle,
    quellen: [...(ko.sources ?? []), ...(ko.attachments ?? [])].map((q) => q.id).sort(),
    kontext: basis.kontext,
  };
}

/** Die Aussagen eines Laufs in ihrem JETZIGEN Stand; eine unbekannte Kennung bricht ab. */
export async function paarpflichtAussagenLaden(
  ko: KoService,
  ids: readonly string[],
  pruefFassung: string,
): Promise<{ aussagen: PaarpflichtAussage[]; kontext: PaarpflichtKontext }> {
  const bestand = await ko.pruefbestandStempel();
  const aussagen: PaarpflichtAussage[] = [];
  for (const id of ids) {
    const gefunden = await ko.get(id);
    if (!gefunden) {
      throw new Error(`Aussage ${id} nicht gefunden.`);
    }
    aussagen.push(paarpflichtAussageVon(gefunden, bestand));
  }
  return { aussagen, kontext: { bestand, pruefFassung } };
}

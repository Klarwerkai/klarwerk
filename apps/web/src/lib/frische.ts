// aufnahme:20260922:gesamt-wissen-frische — was die Oberfläche aus der SERVERSEITIG abgeleiteten
// Frische (`KnowledgeObject.frische`, services/knowledge-object/src/frische.ts) liest. Hier wird
// nichts neu bewertet: nur ausgewählt und geordnet. Fehlt `frische` an einem Objekt, hat der
// Lesepfad sie nicht geliefert — das Objekt fällt dann aus beiden Mengen heraus, statt geraten zu
// werden.
import type { KnowledgeObject } from "../api/types";

/**
 * R-0206: geprüftes Wissen, das wegen seines Alters oder abgelaufener Haltbarkeit wieder bestätigt
 * werden muss — zusätzlich zu den Merkern aus `GET /api/lifecycle/pending` (Anlagenänderung,
 * Anforderung aus der Bibliothek). Bereits vorgemerkte Kennungen kommen nicht doppelt.
 */
export function faelligeKennungen(
  vorgemerkt: readonly string[],
  kos: readonly KnowledgeObject[],
): string[] {
  const alle = [...vorgemerkt];
  for (const ko of kos) {
    const stufe = ko.frische?.stufe;
    if (
      ko.status === "validiert" &&
      (stufe === "faellig" || stufe === "veraltet") &&
      !alle.includes(ko.id)
    ) {
      alle.push(ko.id);
    }
  }
  return alle;
}

/**
 * R-0266: die ältesten geprüften Beiträge, für die DIESE Person verantwortlich ist — zur
 * Bestätigung vorgelegt. Geordnet nach dem Bezug der Frische (ältester zuerst); ohne lesbares
 * Datum steht ein Objekt ganz vorn, weil über seine Frische nichts belegt ist.
 */
export function aeltesteVorlage(
  kos: readonly KnowledgeObject[],
  person: string,
  anzahl = 5,
): KnowledgeObject[] {
  const zeitVon = (ko: KnowledgeObject): number => {
    const ms = ko.frische?.bezugAm ? Date.parse(ko.frische.bezugAm) : Number.NaN;
    return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
  };
  return kos
    .filter((ko) => ko.status === "validiert" && ko.frische?.verantwortlich === person)
    .sort((a, b) => zeitVon(a) - zeitVon(b))
    .slice(0, anzahl);
}

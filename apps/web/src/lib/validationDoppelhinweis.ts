// ================================================================================================
// JOB 3112 · V3 — „ZU DIESEM EINTRAG LIEGT EIN ZWEITES EXEMPLAR IM BESTAND."
// ================================================================================================
//
// AUFTRAG 2623 D1 §2 PUNKT 3: „Die Doppel-Erfassung ist sichtbar. Pedis Dokument liegt zweimal. Wer
// validiert, soll sehen, dass es ein zweites Exemplar gibt, statt eines von beiden zu bearbeiten
// und sich zu wundern." Codex hat am 06.09. gemessen, dass genau das auf der Prüfkarte fehlt
// (R-0994, offene_punkte[2]: „Die Bibliothek unterscheidet Paar/Einzelobjekt nachweislich. Auf der
// Prüfkarte fehlt der konkrete Paarhinweis").
//
// DIE QUELLE IST `GET /api/duplicates` UND AUSDRÜCKLICH NICHT `/duplicate-signal`. Das A28-Signal
// entsteht nur an den EIGENEN Objekten des Betrachters (`services/app/src/duplicate-signal.ts:174-187`,
// Grenze (2) im Kopf :22-39) — wer fremdes Wissen prüft, bekäme dort nie einen Hinweis, und Prüfen
// ist die Fläche für fremdes Wissen. `/api/duplicates` dagegen gibt die für diesen Betrachter
// sichtbaren Paare heraus (`overlap-routes.ts:59` `sichtbarePaare`, danach je Seite
// `redigiereUeberschneidung` :61-68).
//
// WAS DIESER HINWEIS NIEMALS SAGT: Titel oder Inhalt der Gegenseite. Die Redaktion liegt zwar schon
// am Server — der Hinweis nutzt sie trotzdem nicht. Er sagt DASS, nicht WAS; wer das WAS sehen
// darf, geht auf den Vergleich (`/duplikate/<id>/vergleich`, minRole controller).
//
// UND ER SAGT NIE DAS GEGENTEIL. Es gibt keinen Satz „keine Dublette": `/api/duplicates` liefert
// nur die SICHTBAREN Paare und sichert damit keine Vollständigkeit zu. Eine Entwarnung wäre eine
// Behauptung über einen Bestand, den diese Antwort gar nicht abbildet.
import type { OverlapEntry, OverlapRelation } from "../api/types";
import { relationLabelKey } from "./duplicateBoard";

/**
 * Die Rangfolge der Beziehungen, von der stärksten Aussage zur schwächsten. Sie steht als benannte
 * Konstante da und nicht als Sortierausdruck im Rumpf, weil sie eine FACHLICHE Ordnung ist: „diese
 * beiden sind identisch" wiegt schwerer als „diese beiden sind verwandt", und wer sie ändert, soll
 * sie an einer Stelle ändern.
 */
export const BEZIEHUNGS_RANG: readonly OverlapRelation[] = [
  "identisch",
  "a_enthaelt_b",
  "b_enthaelt_a",
  "teilweise",
  "verwandt",
];

export interface Doppelhinweis {
  /** Wie viele offene Überschneidungen dieses Objekt berühren. Immer ≥ 1 — sonst gibt es `null`. */
  anzahl: number;
  /** Die stärkste Beziehung unter den Treffern. */
  beziehung: OverlapRelation;
  /** Ihr i18n-Schlüssel — aus `duplicateBoard.ts`, nicht aus einer zweiten Tabelle. */
  beziehungLabelKey: string;
  /** Die Kennung des Überschneidungs-EINTRAGS (nicht die des Gegenobjekts): der Vergleichsweg. */
  eintragId: string;
}

/** Ein Treffer: ein noch OFFENER Eintrag, an dem dieses Objekt als eine der beiden Seiten steht. */
function trifft(eintrag: OverlapEntry, koId: string): boolean {
  // Dieselbe Lesart von „offen" wie `canClose` (duplicateBoard.ts:83-85): alles ausser
  // „geschlossen" ist noch in Arbeit — ein Eintrag „in_bearbeitung" ist gerade DER Fall, bei dem
  // ein zweiter Mensch nicht ahnungslos am zweiten Exemplar arbeiten soll.
  return eintrag.status !== "geschlossen" && (eintrag.koA === koId || eintrag.koB === koId);
}

function rang(beziehung: OverlapRelation): number {
  const i = BEZIEHUNGS_RANG.indexOf(beziehung);
  // Eine Beziehung, die dieser Client nicht kennt, ist die SCHWÄCHSTE Aussage — nie die stärkste.
  return i === -1 ? BEZIEHUNGS_RANG.length : i;
}

/**
 * Der Hinweis für EIN Objekt, oder `null`.
 *
 * `null` heisst in beiden Fällen dasselbe: es steht nichts auf der Karte. Kein Platzhalter, kein
 * „wird geprüft", kein „keine Dublette" — jede dieser drei Zeilen wäre eine Aussage über den
 * Bestand, und die gibt es hier nur bei einem belegten Treffer.
 *
 *   `undefined`          — es liegt keine Antwort vor (lädt, oder Fehler ohne je geholten Stand).
 *   leere Liste / kein Treffer — die Antwort ist da und nennt zu diesem Objekt nichts.
 */
export function doppelhinweis(
  koId: string,
  eintraege: readonly OverlapEntry[] | undefined,
): Doppelhinweis | null {
  if (!eintraege) {
    return null;
  }
  const treffer = eintraege.filter((e) => trifft(e, koId));
  const staerkster = [...treffer].sort((a, b) => rang(a.relation) - rang(b.relation))[0];
  if (!staerkster) {
    return null;
  }
  return {
    anzahl: treffer.length,
    beziehung: staerkster.relation,
    beziehungLabelKey: relationLabelKey(staerkster.relation),
    eintragId: staerkster.id,
  };
}

// SCRUM-415: Vertraulichkeitsstufen je Wissensobjekt — reine, testbare Helfer (kein Zustand).
// „intern" ist der Standard (Öffentlich-intern, keine Einschränkung). „vertraulich" und
// „streng_vertraulich" gelten als vertraulich: solche KOs gehen NIE in externe Kontexte
// (Output Factory/Export). Fehlt das Feld ganz (Alt-KOs), gilt ebenfalls „intern".
import type { Confidentiality } from "./types";

export const CONFIDENTIALITY_LEVELS: readonly Confidentiality[] = [
  "intern",
  "vertraulich",
  "streng_vertraulich",
];

// Unbekannte/leere Eingaben normalisieren defensiv auf „intern" (nie versehentlich freigeben,
// aber auch nie mit einem ungültigen Wert blockieren).
export function normalizeConfidentiality(value: unknown): Confidentiality {
  return value === "vertraulich" || value === "streng_vertraulich" ? value : "intern";
}

// SCRUM-509: strikte Prüfung — ist der Wert GENAU eine bekannte Stufe? (Ohne stilles Normalisieren
// auf „intern"; der Aufrufer entscheidet fail-safe, was mit einem ungültigen Wert geschieht.)
export function isValidConfidentiality(value: unknown): value is Confidentiality {
  return value === "intern" || value === "vertraulich" || value === "streng_vertraulich";
}

// SCRUM-509: Rang der Stufe (intern=0 < vertraulich=1 < streng_vertraulich=2). Ein „Downgrade" ist
// jede Änderung zu einem NIEDRIGEREN Rang (weniger vertraulich → weitere Sichtbarkeit/Egress).
export function confidentialityRank(level: Confidentiality | undefined | null): number {
  return CONFIDENTIALITY_LEVELS.indexOf(normalizeConfidentiality(level));
}

// SCRUM-509: ist `next` eine Herabstufung gegenüber `current`? (weniger vertraulich)
export function isConfidentialityDowngrade(
  current: Confidentiality | undefined | null,
  next: Confidentiality,
): boolean {
  return confidentialityRank(next) < confidentialityRank(current);
}

// Ist dieses KO vertraulich (→ nie in externe Kontexte)? Fehlendes Feld = „intern" = nicht vertraulich.
export function isConfidential(level: Confidentiality | undefined | null): boolean {
  return level === "vertraulich" || level === "streng_vertraulich";
}

// ================================================================================================
// JOB 3009 · DIE STUFE ALS AUSKUNFT — EINE REGEL, EINE STELLE.
// ================================================================================================
//
// WARUM DAS HIER STEHT UND NICHT VIERMAL IN DEN ROUTEN. Der Ausdruck „gültige Stufe oder
// ausdrücklich `null`" stand vor JOB 3009 dreimal wörtlich im Code — media-routes.ts:30,
// object-routes.ts:203 und board-herkunft.ts (JOB 3003) —, und der Detailabruf `GET /api/kos/:id`
// hätte die vierte Kopie gebraucht. Vier Orte für dieselbe Entscheidung sind vier Auslegungen; die
// Lehre steht ausgeschrieben in services/app/src/sichtbarkeit.ts:10-15 („sechs Flächen trugen
// dieselbe Zeile, und alle sechs waren falsch"). Die Stufengrenze wohnt schon hier, direkt neben
// `isValidConfidentiality` — also wohnt die Auskunft darüber ab jetzt ebenfalls hier.
//
// WARUM `null` MIT `provenance: "unknown"` UND NICHT EIN WEGGELASSENES FELD. Am Wissensobjekt ist
// die Stufe OPTIONAL: gespeichert wird sie nur, wenn sie tatsächlich vertraulich ist (service.ts
// :1650-1654 — „intern"/ungültig bleibt weg). Ein nicht gesetztes optionales Feld FEHLT im JSON
// vollständig, und für den Menschen davor sind dann zwei völlig verschiedene Zustände
// ununterscheidbar: „dieses Objekt ist nicht eingestuft" und „diese Route liefert die Einstufung
// nicht". Wer die beiden nicht trennen kann, muss raten. Die vollständige Begründung samt ihrer
// Herkunft steht in services/validation/src/board-herkunft.ts (Dateikopf).
//
// WARUM `isValidConfidentiality` UND NICHT `normalizeConfidentiality`. Die Normalisierung darüber
// legt einen unbekannten oder fehlenden Wert defensiv als „intern" aus — richtig für den ZUGRIFF,
// falsch für eine AUSKUNFT: sie behauptete eine Einstufung, die nie jemand gesetzt hat. Dieselbe
// Zeile zieht `classificationValueOf` (search-projection.ts:160-172) mit derselben Begründung.
//
// DIE BENANNTE GRENZE: DIES IST EINE AUSKUNFT, KEIN TOR. Für den ZUGRIFF gilt weiterhin und
// unverändert `darfSehen`/`sichtbareFuer` (services/app/src/sichtbarkeit.ts), und DORT gilt eine
// fehlende Stufe weiter als „intern" (ebd. :39-43: „eine zweite Auslegung derselben Stufe wäre
// genau die zweite Wahrheit"). Hier wird nichts verschärft und nichts gelockert; hier wird nur
// BENANNT, was der Bestand hergibt. Jeder Aufrufer wendet die Auskunft deshalb NACH seinem Tor an.

/**
 * WOHER die ausgegebene Stufe stammt.
 *
 * · `ko`      — sie steht am Wissensobjekt selbst und ist ein gültiger Wert.
 * · `unknown` — der Bestand trägt keine (oder keine gültige) Stufe. Ausdrücklich KEINE Aussage
 *               „intern": niemand hat hier je eingestuft.
 *
 * Bewusst dieselbe Wortwahl wie `ClassificationConfidence` in der Suchprojektion
 * (search-projection.ts:132-133) — ein zweites Vokabular für denselben Gedanken wäre eine zweite
 * Wahrheit. Bewusst NICHT dieselbe Aufzählung: dort geht es um die HISTORISCHE Belastbarkeit einer
 * Versionsaussage, hier um die Frage, ob der heutige Bestand überhaupt eine Stufe trägt.
 */
export type ConfidentialityProvenance = "ko" | "unknown";

/** Die zwei Schlüssel, die jeder Lesepfad ausgibt, der die Stufe überhaupt nennt. */
export interface ConfidentialityDisclosure {
  confidentiality: Confidentiality | null;
  confidentialityProvenance: ConfidentialityProvenance;
}

/**
 * Die Stufe als ausdrückliche Auskunft — reine Funktion über einen bereits gespeicherten Wert:
 * kein neues Datenmodell, keine Persistenz, kein Backfill.
 */
export function discloseConfidentiality(value: unknown): ConfidentialityDisclosure {
  const stufe = isValidConfidentiality(value) ? value : null;
  return { confidentiality: stufe, confidentialityProvenance: stufe ? "ko" : "unknown" };
}

// SCRUM-502: EIN geteilter Egress-Filter — entfernt vertrauliche KOs aus einer Auswahl, BEVOR sie in
// einen externen Kontext gelangen (Modell/Embedder/Add-in/Export). Alle Egress-Stellen nutzen dasselbe
// Prädikat isConfidential, damit die Semantik überall identisch zum Export-Filter (output-service) ist.
// „intern"/fehlendes Feld bleibt drin — vertrauliche KOs bleiben intern voll nutzbar, verlieren aber
// bewusst Modell-/Embedder-Features (korrekter Trade-off, kein Bug).
export function dropConfidential<T extends { confidentiality?: Confidentiality | null }>(
  items: readonly T[],
): T[] {
  return items.filter((item) => !isConfidential(item.confidentiality));
}

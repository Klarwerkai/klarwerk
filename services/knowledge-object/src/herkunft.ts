// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · R-1355 — HERKUNFTSANGABEN ENTSTEHEN AN GENAU EINER STELLE.
// ================================================================================================
//
// „Eine automatische Codeprüfung stellt sicher, dass Herkunftsangaben nur an einer zentralen Stelle
// erzeugt werden. So kann keine zweite, abweichende Quelle für dieselbe Angabe entstehen."
//
// WAS HIER ALS HERKUNFTSANGABE DES WISSENSOBJEKTS GILT — die Felder, die festhalten, woher ein
// Objekt stammt und von wem, und die nach der Anlage niemand mehr umschreibt:
//   · `originalAuthor` — der Wissensträger (FR-CAP-07 / FR-LIF-04); `author` daneben ist der
//     Handelnde, er ist über `setAuthor` (FR-LIF-02) übergebbar und gehört deshalb NICHT dazu;
//   · `origin`, `importCandidateId`, `importedVia`, `dokumentHerkunft` — Erfassungsweg,
//     Kandidaten-Anker, Importweg und Fassungsbezug.
// Die Quellenliste (`sources`) hat ihren eigenen zentralen Weg (`sanitizeSources`) und ist hier
// nicht doppelt geregelt.
//
// Bis hierher stand die Regel inline in `KoService.create`. Sie stand zwar nur dort, aber nichts
// verhinderte eine zweite Fassung an einem anderen Schreibweg. Jetzt ist sie EINE Funktion, und
// `tests/wissen-herkunft/herkunft-nur-zentral.test.ts` prüft am Quelltext, dass diese Felder im
// Wissensobjekt-Modul nirgends sonst gesetzt und dienstweit nirgends sonst abgeleitet werden.
//
// GRENZE (R-0110, entschiedene Grenze): die `frontdoor`-Fundstellen des Entwurfswegs sind ein
// anderer Vertrag (Entwurf-fortsetzen-Mechanik) und werden hier weder angefasst noch umgeleitet.
// Der Erfassungsweg kommt bereits geprüft vom Entwurf (`normalizeOriginIn`, services/capture).
import type { KnowledgeObject } from "./types";

/** Was ein Anlageweg über die Herkunft mitbringen darf. */
export interface HerkunftsEingabe {
  author: string;
  originalAuthor?: string | undefined;
  origin?: KnowledgeObject["origin"] | undefined;
  importCandidateId?: string | undefined;
  importedVia?: KnowledgeObject["importedVia"] | undefined;
  dokumentHerkunft?: KnowledgeObject["dokumentHerkunft"] | undefined;
}

/**
 * Wissensträger und Handelnder bei der Anlage. Ein abweichender Wissensträger gilt nur, wenn er
 * ausdrücklich und nicht leer mitgebracht wird (Import, Entwurfs-Promote); sonst ist der
 * Handelnde zugleich Wissensträger. Reihenfolge der Felder wie bisher am Objekt.
 */
export function urheberschaftBeiAnlage(
  eingabe: Pick<HerkunftsEingabe, "author" | "originalAuthor">,
): Pick<KnowledgeObject, "originalAuthor" | "author"> {
  return {
    originalAuthor: eingabe.originalAuthor?.trim() ? eingabe.originalAuthor : eingabe.author,
    author: eingabe.author,
  };
}

/**
 * Erfassungsweg, Kandidaten-Anker, Importweg und Fassungsbezug — jeweils nur, wenn der Anlageweg
 * einen mitbringt. Kein stiller Default: ein Objekt ohne Angabe bleibt ohne Angabe, und genau das
 * liest die Oberfläche als „unbekannt".
 */
export function herkunftsmerkmaleBeiAnlage(
  eingabe: Omit<HerkunftsEingabe, "author" | "originalAuthor">,
): Pick<KnowledgeObject, "origin" | "importCandidateId" | "importedVia" | "dokumentHerkunft"> {
  return {
    ...(eingabe.origin ? { origin: eingabe.origin } : {}),
    ...(eingabe.importCandidateId ? { importCandidateId: eingabe.importCandidateId } : {}),
    ...(eingabe.importedVia ? { importedVia: eingabe.importedVia } : {}),
    ...(eingabe.dokumentHerkunft ? { dokumentHerkunft: eingabe.dokumentHerkunft } : {}),
  };
}

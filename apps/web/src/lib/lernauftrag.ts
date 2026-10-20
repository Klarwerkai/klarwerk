// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 AC01 — ist dieser Satz ein Lernauftrag?
//
// Nur die grobe Erkennung im Klara-Eingabefeld, damit ein Lernauftrag an den Lernstart geht und
// nicht an den Frageweg. Was er bedeutet (Anwendung, Vorgänge) und ob er gilt, entscheidet der
// Server (`services/app/src/assistenz-lernen-lernauftrag.ts`) mit derselben Satzform: ein Auftrag
// an die Assistenz am Satzanfang. „Wie lerne ich …?“ ist eine Frage, kein Lernauftrag.

const LERNABSICHT =
  /^\s*(bitte\s+)?(verfolge|beobachte|lerne|schau\s+(mir\s+)?zu|merke?\s+dir|(ich\s+)?zeige?\s+dir|(ich\s+)?mache?\s+(es\s+|das\s+)?(dir\s+)?vor)\b/i;

export function istLernauftrag(text: string): boolean {
  return LERNABSICHT.test(text);
}

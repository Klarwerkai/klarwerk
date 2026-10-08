// ================================================================================================
// R-0750 / R-1741 (Aufnahme gesamt-kennzahlen) — DER PRÜFZEITPUNKT EINER FASSUNG.
// ================================================================================================
//
// Die Wirkungsmessung „wie viel Wissen wird je Woche geprüft" braucht den Zeitpunkt der Prüfung,
// nicht den der Erfassung. Bis hierher kannte das Objekt nur `createdAt`; ein im Oktober geprüftes,
// im Juni erfasstes Objekt erhöhte rückwirkend eine Juniwoche.
//
// EINE REGEL, an jedem Schreibrand des Status angewandt (Bewertung, Admin-Validierung, Überarbeiten
// mit und ohne Freigabe, Dokumentübernahme, Wahrheitskonflikt):
//   · nachher nicht „validiert"                  → kein Prüfzeitpunkt (die Prüfung gilt nicht mehr)
//   · Übergang nach „validiert" oder neue Freigabe → Prüfzeitpunkt = jetzt
//   · bleibt „validiert" (weitere grüne Stimme)    → der bisherige Zeitpunkt bleibt — auch wenn er
//     fehlt: Altbestand wird nicht nachträglich auf „jetzt" datiert.
import type { KnowledgeObject } from "./types";

export function mitPruefzeitpunkt(
  vorher: KnowledgeObject,
  nachher: KnowledgeObject,
  at: string,
  neueFreigabe = false,
): KnowledgeObject {
  if (nachher.status !== "validiert") {
    const { validatedAt: _entfaellt, ...ohne } = nachher;
    return ohne;
  }
  if (neueFreigabe || vorher.status !== "validiert") {
    return { ...nachher, validatedAt: at };
  }
  return nachher;
}

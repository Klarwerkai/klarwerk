// AUFTRAG-mega6 Block D (bens Ehrlichkeitskante): die EINZIGE Stelle, an der die Oberfläche die
// Persistenzgrenzen des Entwurfs bezieht — direkt aus der gemeinsamen Quelle des capture-Moduls.
// Bewusst KEINE eigene Zahlenkopie und bewusst KEIN neuer Endpunkt/Fetch: die Grenzen sind
// Vertragskonstanten, keine Laufzeitdaten. Läuft die Serverdatei auseinander, ändert sich die
// Oberfläche mit — ein Auseinanderdriften ist strukturell ausgeschlossen.
//
// draft-limits.ts ist ein reines Datenmodul ohne Importe; es zieht nichts Serverseitiges
// (pg, fastify, node:crypto) ins Browser-Bundle.
export { DRAFT_LIMITS } from "../../../../services/capture/src/draft-limits";

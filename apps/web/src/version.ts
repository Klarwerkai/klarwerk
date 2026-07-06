// Sichtbare App-Version für die Beta-/Aufbau-Phase (Pedi-Auftrag 02.07.2026).
// Eine Quelle: hier pflegen; die Topbar zeigt sie oben rechts (live UND lokal). Nach dem
// Livegang kann die Anzeige entfernt werden — die Konstante bleibt für Diagnose/Support.
//
// Format: 1.0.0-beta.<Freeze>.<Push-Zähler>. Die LETZTE Zahl ist ein interner, laufender
// Push-Zähler (Pedi 06.07.2026): klarwerk-ship.command erhöht sie bei JEDEM echten Push
// automatisch um 1. So sieht man auf einen Blick, ob App (live) und lokale Instanz auf
// demselben Stand sind. Basis .1.0 = noch nicht ausgeliefert; der nächste Ship-Lauf → .1.1.
export const APP_VERSION = "1.0.0-beta.1.4";

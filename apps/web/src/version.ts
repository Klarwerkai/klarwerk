// Sichtbare App-Version für die Beta-/Aufbau-Phase (Pedi-Auftrag 02.07.2026).
// Eine Quelle: hier pflegen; die Topbar zeigt sie oben rechts (live UND lokal). Nach dem
// Livegang kann die Anzeige entfernt werden — die Konstante bleibt für Diagnose/Support.
//
// Format: 1.0.0-beta.<Freeze>.<Push-Zähler>. Die LETZTE Zahl ist ein interner, laufender
// Push-Zähler (Pedi 06.07.2026): klarwerk-ship.command erhöht sie bei JEDEM echten Push
// automatisch um 1. So sieht man auf einen Blick, ob App (live) und lokale Instanz auf
// demselben Stand sind. Basis .1.0 = noch nicht ausgeliefert; der nächste Ship-Lauf → .1.1.
//
// JOB 1113 (JOB-947-B3) — ZWEITE STELLE, GLEICHE ZAHL, ERZWUNGEN.
// Seit /health Version und Deploy-Commit meldet, steht dieselbe Nummer auch in `package.json`.
// Das ist keine Verdopplung aus Bequemlichkeit, sondern die einzige Quelle, die im
// Produktionsimage existiert: `Dockerfile:37-38` kopiert nur `services` und `apps/web/dist` —
// `apps/web/src` und damit DIESE Datei liegen dort nicht.
//
// WER HIER HOCHZÄHLT, ZÄHLT DORT MIT. `scripts/deploy/klarwerk-ship.command` hebt beide Dateien im
// selben Schritt an und bricht ab, wenn `package.json` nicht die bisherige Nummer trägt; läuft sie
// gegen `package.json` auseinander, meldet /health einen Stand, den die Oberfläche nicht zeigt.
// Der Wächter `tests/app/health-version-commit.test.ts` macht genau das rot.
//
// R-1028: Auch das Word-Panel zeigt DIESE Konstante — der Build stempelt sie in „Klara <Stand>"
// (`apps/web/vite.config.ts`, Plugin `klara-stand`, Text aus `src/lib/klaraStand.ts`).
export const APP_VERSION = "1.0.0-beta.1.874";

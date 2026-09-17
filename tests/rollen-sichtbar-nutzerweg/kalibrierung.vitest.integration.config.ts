// ================================================================================================
// JOB 4326 · DER KALIBRIERLAUF — derselbe Bestand, EIN Schalter mehr, und er ist absichtlich rot.
// ================================================================================================
//
// WOZU EINE EIGENE KONFIGURATION UND NICHT EINFACH `KLARWERK_KALIBRIERUNG=1 npx vitest …`:
// Der Schalter selbst bleibt genau die Umgebungsvariable `KLARWERK_KALIBRIERUNG` (so verlangt es
// Auftrag §5.5, und lokal genügt das Voranstellen). Die Cloud-Arbeitsprüfung reicht aber KEINE
// Umgebungsvariablen durch: `register/cloud/work.py:validate_execution` lässt als Befehl nur
// `npx vitest run …`, `npx playwright test …`, `npx tsc --noEmit`, `npm run build/typecheck` und
// `tools/build|check` zu — ein vorangestelltes `NAME=WERT` ist dort kein gültiges `argv[0]`.
// Diese Datei ist deshalb der einzige Weg, den Kalibrierlauf ÜBER DIESELBE Prüfstrecke zu fahren
// wie den Nachweis, statt für die Messung die Quelle zu verstellen.
//
// WARUM DER DATEINAME `…vitest.integration.config.ts` HEISST und nicht `kalibrierung.config.ts`:
// Der Cloud-Läufer entscheidet an der Zeichenkette `vitest.integration.config` in einem der
// Argumente, ob er einen PostgreSQL-Testcluster hochfährt (`register/cloud/remote_job.py:20-21`,
// `integration_needs_postgres`). Ohne diese Zeichenkette liefe die Kalibrierung ohne Datenbank —
// und damit als stiller Skip, also als scheinbar bestandener Lauf. Der Name ist hier eine Zusage
// an den Läufer, keine Kosmetik.
//
// SONST IST NICHTS ANDERS: `include`, `setupFiles` und die Fristen kommen wörtlich aus
// `vitest.integration.config.ts`. Eine zweite, abgeschriebene Liste wäre der übliche Doppelvertrag.
import { defineConfig } from "vitest/config";
import basis from "../../vitest.integration.config";

export default defineConfig({
  ...basis,
  test: {
    ...basis.test,
    // DER EINE UNTERSCHIED. `KLARWERK_KALIBRIERUNG=1` schaltet in
    // `rollen-sichtbar-pg-im-browser.integration.test.ts` die beiden Kalibrierfälle K1 und K2 an.
    // Sie sind absichtlich ROT: K1 erhöht die Rolle im Bestand und zeigt, dass die Sperrprüfung
    // daran zerbricht; K2 blendet genau den nachgewiesenen Knopf aus und zeigt, dass der Gegenpol
    // daran zerbricht. Exit 1 ist hier das ERWARTETE Ergebnis.
    env: { ...basis.test?.env, KLARWERK_KALIBRIERUNG: "1" },
  },
});

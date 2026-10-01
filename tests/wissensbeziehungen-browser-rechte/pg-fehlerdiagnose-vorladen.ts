// GRAPH-BROWSER-RECHTE · Vorlademodul für den Serverprozess (`node --import tsx --import <dies>`).
//
// Schreibt jeden Vorfall aus `pg-fehlerdiagnose.ts` als JSON-Zeile in die Datei aus
// `KLARWERK_TEST_PG_DIAGNOSE`. Ohne diese Variable tut es nichts — der Aufrufer
// (`tastatur-schmal-rechte-pg.integration.test.ts`, ALT-500-AUSLÖSER) prüft deshalb, dass die Datei
// Zeilen bekam, bevor er aus ihrem Inhalt etwas schliesst.
import { appendFileSync } from "node:fs";
import { installiere } from "./pg-fehlerdiagnose";

const ziel = process.env.KLARWERK_TEST_PG_DIAGNOSE;
if (ziel) {
  installiere((v) => appendFileSync(ziel, `${JSON.stringify(v)}\n`));
}

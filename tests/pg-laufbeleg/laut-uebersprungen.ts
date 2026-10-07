// R-1327: Setup-Datei des Integrationslaufs (`vitest.integration.config.ts`). Nach jeder Datei
// meldet sie deren übersprungene Fälle mit Namen auf stderr — Begründung in `./melder.ts`.
//
// Ein `afterAll` aus einer Setup-Datei hängt an der Datei selbst und bekommt sie als Argument; er
// läuft, nachdem alle Fälle der Datei ihren Ausgang haben.
import { afterAll } from "vitest";
import { dateiMeldung, laufbild } from "./melder";

afterAll((datei) => {
  const meldung = dateiMeldung(laufbild([datei]));
  if (meldung !== undefined) {
    process.stderr.write(meldung);
  }
});

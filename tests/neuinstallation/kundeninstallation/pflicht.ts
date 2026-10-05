// Wann die Kundeninstallations-Strecke PFLICHT ist — und wann sie sichtbar nicht laeuft.
//
// Die Strecke baut das Produktabbild, richtet auf einem leeren Pruefplatz notfalls Docker ein und
// startet Dienste neu; sie dauert rund eine halbe Stunde. In einem allgemeinen Integrationslauf
// (`npm run test:integration`) hat sie deshalb nichts verloren, und in `tools/check` erst recht nicht:
// ein Tor, das an einem Compose-Bau haengt, sperrte jeden anderen Auftrag.
//
// PFLICHT ist sie, sobald jemand sie AUSDRUECKLICH aufruft — ihr Dateiname steht auf der
// Vitest-Kommandozeile (so ruft der gezielte Pruefweg des Testservers benannte Dateien auf), oder
// `KLARWERK_KUNDENINSTALLATION=pflicht` ist gesetzt. Dann gibt es keinen Uebersprung: ein Platz, der
// Docker, Compose, HTTPS oder den Browser nicht traegt, ist ROT.
//
// `vitest.integration.config.ts` wertet das im Hauptprozess aus (nur dort steht die Kommandozeile)
// und reicht das Ergebnis ueber die Umgebung an den Testarbeiter weiter.

export const STRECKE = "kundeninstallation-strecke.integration.test.ts";

/** Steht die Strecke ausdruecklich auf der Kommandozeile (als Datei oder Pfadfilter)? */
export function streckeBenannt(argv: readonly string[]): boolean {
  return argv.some((a) => !a.startsWith("-") && a.includes("kundeninstallation-strecke"));
}

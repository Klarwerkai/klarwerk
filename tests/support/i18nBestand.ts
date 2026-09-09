// ================================================================================================
// DER SPRACHBESTAND, WIE IHN DIE OBERFLÄCHE WIRKLICH HAT (JOB 3326 R5).
// ================================================================================================
//
// WAS ES VORHER GAB. Sieben Wörterbuch-Leser schnitten `const de/en/nl` als TEXT aus
// `apps/web/src/i18n.ts` und werteten das Stück mit `new Function` aus. Das trug, solange die drei
// Blöcke reine Objektliterale waren, und zerbrach in dem Augenblick, in dem einer von ihnen einen
// Schlüsselblock über einen Spread einbindet:
//
//     ReferenceError: lesevarianteTexteDe is not defined
//
// `new Function` bekommt keine Importbindungen; der ausgeschnittene Text nennt aber einen Namen aus
// einem Import. Sieben Testdateien scheiterten daran beim LADEN — nicht an einer Aussage, sondern
// daran, dass sie ihre Quelle nicht mehr lesen konnten.
//
// WARUM DIESE ANTWORT UND NICHT „DIE BINDUNGEN NACHREICHEN". Man könnte `new Function` die
// ausgelagerten Objekte als Parameter mitgeben. Dann müsste aber JEDE künftige Auslagerung in
// sieben Dateien nachgetragen werden, und wer es vergisst, bekommt denselben Ladefehler wieder.
// Der Bestand wird deshalb dort geholt, wo er ohnehin entsteht: beim initialisierten i18next.
// `getResourceBundle` gibt genau das Objekt zurück, das `i18n.ts` in `resources` übergibt — also
// das ZUSAMMENGESETZTE Wörterbuch samt aller gespreadeten Blöcke.
//
// DIE ZUSAGE DER SIEBEN LESER BLEIBT DABEI ERHALTEN, und sie war der Grund für das Textschneiden:
// sie wollen ALLE Schlüssel sehen, nicht nur die, an die ein Aufrufer gedacht hat. Der Bestand aus
// i18next ist dafür die stärkere Quelle — er enthält zusätzlich, was ausgelagert wurde, und er
// enthält nichts, was die Oberfläche nicht hätte.
//
// DER PREIS, ehrlich benannt: diese Leser laufen jetzt mit i18next-Laufzeit statt rein textlich.
// Sie ziehen damit `apps/web/src/i18n.ts` und dessen Importe in den Testprozess. Das ist im
// Node-Lauf gemessen tragfähig (`apps/web/src/lib/auditAction.test.ts` tut dasselbe seit Langem).
import i18n from "../../apps/web/src/i18n";

/**
 * Das vollständige Wörterbuch einer Sprache, so wie es die Oberfläche zur Laufzeit liest.
 *
 * Fehlt der Sprachbestand, ist das ein FEHLER und kein leeres Objekt: ein leerer Bestand liesse
 * jeden Sammler darüber grün werden, ohne etwas geprüft zu haben.
 */
export function sprachbestand(sprache: string): Record<string, string> {
  const bestand = i18n.getResourceBundle(sprache, "translation") as
    | Record<string, string>
    | undefined;
  if (!bestand || Object.keys(bestand).length === 0) {
    throw new Error(`Sprachbestand fehlt oder ist leer: ${sprache}`);
  }
  return bestand;
}

/** Die drei Sprachen der Oberfläche in einem Griff — die Form, die die Sammler brauchen. */
export function alleSprachbestaende(): Record<string, Record<string, string>> {
  return { de: sprachbestand("de"), en: sprachbestand("en"), nl: sprachbestand("nl") };
}

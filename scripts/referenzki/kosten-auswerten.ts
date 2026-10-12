// ================================================================================================
// produkt:20261009:referenzki-pruefdienst (REF-02, K10) — KOSTEN EINES VORHANDENEN BERICHTS, VON HAND.
// ================================================================================================
//
// Kein Modellaufruf: liest den Bericht einer früheren Beobachtung (`beobachtung.json`) und eine
// datierte Tarifquelle und rechnet je Versuch (`tests/referenzki-pruefdienst/kostenauswertung.ts`).
//
// AUFRUF:
//   npx tsx scripts/referenzki/kosten-auswerten.ts --bericht <beobachtung.json> --tarif <tarif.json>
// Tarifdatei: {"quelle":"<URL/Vertrag>","abgerufenAm":"JJJJ-MM-TT","preisliste":{"waehrung":…,
//   "preisstand":…,"modelle":{"<modell>":{"eingabeJeMillion":…,"ausgabeJeMillion":…}}}}
import { readFileSync } from "node:fs";
import {
  type BerichtLauf,
  werteKostenAus,
} from "../../tests/referenzki-pruefdienst/kostenauswertung";

function argument(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const bericht = argument("bericht");
const tarif = argument("tarif");
if (!bericht || !tarif) {
  process.stderr.write("Aufruf: … --bericht <beobachtung.json> --tarif <tarif.json>\n");
  process.exitCode = 2;
} else {
  const daten = JSON.parse(readFileSync(bericht, "utf8")) as { laufprotokoll: BerichtLauf[] };
  const ergebnis = werteKostenAus(daten.laufprotokoll, JSON.parse(readFileSync(tarif, "utf8")));
  process.stdout.write(`${JSON.stringify(ergebnis, null, 2)}\n`);
  if (!ergebnis.ok) {
    process.exitCode = 1;
  }
}

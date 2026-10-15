// ================================================================================================
// produkt:20261009:referenzki-pruefdienst (REF-02, K10) — ECHTE MODELLBEOBACHTUNG, VON HAND.
// ================================================================================================
//
// Derselbe Lauf wie im regulären Prüfablauf (`tests/referenzki-pruefdienst/modellbeobachtung.test.ts`)
// — beide nutzen `tests/referenzki-pruefdienst/beobachtung.ts`. Dieser Aufruf schreibt zusätzlich
// einen Bericht in eine Datei.
//
// AUFRUF (mit eingerichtetem Anbieter in der Umgebung — Schlüssel NIE als Argument):
//   npx tsx scripts/referenzki/beobachtung.ts --pruefer anthropic --bericht <datei.json>
//
// Kein Fehlerfreiheitsnachweis: sieben Beispiele mit einem Modell zu einem Zeitpunkt.
import { writeFileSync } from "node:fs";
import { REASONER_REFERENZ_WAHLEN, type ReasonerReferenzWahl } from "../../services/reasoner";
import { anbieterLage, beobachte } from "../../tests/referenzki-pruefdienst/beobachtung";

function argument(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const wahl = argument("pruefer") as ReasonerReferenzWahl | undefined;
  const bericht = argument("bericht");
  if (!wahl || !(REASONER_REFERENZ_WAHLEN as readonly string[]).includes(wahl) || !bericht) {
    process.stderr.write(
      "Aufruf: npx tsx scripts/referenzki/beobachtung.ts --pruefer <openai|anthropic|local> --bericht <datei.json>\n",
    );
    process.exitCode = 2;
    return;
  }
  const lage = anbieterLage(process.env);
  if (!lage[wahl].eingerichtet) {
    process.stderr.write(`${wahl} ist nicht eingerichtet: ${lage[wahl].grund ?? "unbekannt"}\n`);
    process.exitCode = 1;
    return;
  }
  const inhalt = await beobachte(wahl, process.env);
  writeFileSync(bericht, `${JSON.stringify(inhalt, null, 2)}\n`, "utf8");
  // Ohne einen einzigen Prüflauf mit Modell ist das keine Modellbeobachtung — laut scheitern.
  if (inhalt.modellaufrufeNachweis.mitModell === 0) {
    process.stderr.write(
      "Kein Prüfmodellaufruf erfolgt — Anbieter, Freigabe oder Adminliste prüfen. Der Bericht belegt KEINE Modellbeobachtung.\n",
    );
    process.exitCode = 1;
  }
  for (const r of inhalt.ergebnisse) {
    process.stdout.write(
      `${r.kennung}: erwartet ${r.erwartet.join(",")} · beobachtet ${r.beobachtet.join(",")} (${r.grund ?? r.status})\n`,
    );
  }
}

void main();

// ================================================================================================
// JOB 4293 R2 · SB — § 9 IM ECHTEN BROWSER: DIE KETTE AUS VIER ZUSTÄNDEN AN EINER KARTE.
// ================================================================================================
//
// frisch gelesen → ohne Netz angehalten → Netz zurück → Auffrischung gescheitert → erholt. Je
// Schritt wird BEIDES abgelesen: die sichtbare Kennzeichnung (mit Fläche auf dem Bildschirm, nicht
// bloss ein Knoten im Baum) und der Sperrzustand von „Annehmen".
//
// WARUM ZUSÄTZLICH ZUR GEMOUNTETEN FASSUNG: `stand-der-pruefkarte-mounted.test.tsx` stellt den
// Onlinezustand selbst (`onlineManager.setOnline`) und die Antworten über eine Leitung im selben
// Prozess. Er kann deshalb nicht sagen, ob ein ECHTER Browser beim Wegfallen des Netzes das
// `offline`-Ereignis überhaupt auslöst und ob react-query es aufnimmt. Hier fällt ein echtes Netz
// weg (`context.setOffline`), und der Volltext-Rundlauf dieses Auftrags wird dabei ausdrücklich
// NICHT wiederholt — er steht in `rundlauf-im-echten-browser.test.ts`.
//
// DER ABLAUF STEHT NICHT HIER, sondern in `flaeche.ts` (`fahreDieStandkette`), aus demselben Grund
// wie der Rundlauf: ein Bedienweg wird einmal beschrieben.
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stelleFlaecheBereit } from "../fassungsrueckholung-echter-browser/weg";
import { type Browser, DIST, mitFlaeche, starteChromium } from "../gast-nutzerweg/browserweg";
import { type Strecke, ersteinrichtung, starteStrecke } from "../gast-nutzerweg/strecke";
import { fahreDieStandkette, pruefeStandzusage } from "./flaeche";
import { JOB, KERNAUSSAGE, volltextHtml } from "./weg";

const ADMIN = "stand@volltext-4293.test";
const TITEL = `${JOB} · Stand im Browser`;

/** Eine Datei mit genau einem Eintrag — der Volltext ist hier Mitfahrer, nicht Prüfgegenstand. */
function datei(titel: string): string {
  return JSON.stringify([
    {
      title: titel,
      statement: KERNAUSSAGE,
      type: "technik",
      category: "Wartung",
      bodyHtml: volltextHtml(),
    },
  ]);
}

let browser: Browser | undefined;
let strecke: Strecke | undefined;
let bereit = false;

beforeAll(async () => {
  // PRÜFGRENZE, LAUT GEMELDET (Auftrag § 7): ohne Playwright ist der sichtbare Weg nicht messbar.
  // Ein stiller Übersprung sähe aus wie ein bestandener Lauf.
  try {
    createRequire(import.meta.url).resolve("playwright");
  } catch {
    process.stderr.write(
      `[KLARWERK] ${JOB} SB ÜBERSPRUNGEN: kein Playwright verfügbar — § 9 ist im echten Browser damit nicht messbar.\n`,
    );
    return;
  }
  const flaeche = stelleFlaecheBereit();
  if (!existsSync(join(DIST, "index.html"))) {
    process.stderr.write(
      `[KLARWERK] ${JOB} SB ÜBERSPRUNGEN: ${DIST}/index.html fehlt auch nach dem Bau.\n`,
    );
    return;
  }
  browser = await starteChromium();
  strecke = await starteStrecke(mitFlaeche());
  await ersteinrichtung(strecke, ADMIN);
  process.stderr.write(`[KLARWERK] ${JOB} SB · Prüfstand: Chromium · Fläche: ${flaeche}\n`);
  bereit = true;
}, 1_200_000);

afterAll(async () => {
  await browser?.close();
  await strecke?.schliessen();
}, 120_000);

describe(`${JOB} · SB · § 9 im echten Browser`, () => {
  it("SB1 · Kennzeichnung und Annahmesperre folgen dem Netz — und geben wieder frei", async (ctx) => {
    if (!bereit || !browser || !strecke) {
      ctx.skip();
      return;
    }
    const kette = await fahreDieStandkette({
      browser,
      strecke,
      email: ADMIN,
      titel: TITEL,
      dateiInhalt: datei(TITEL),
      // Zwei WEITERE Titel: eine Auffrischung wird durch eine echte Dateiauswahl ausgelöst, und
      // derselbe Titel wäre ein Wiederimport — dann hinge der Fall am Dublettenschutz statt am Netz.
      zweiteDatei: datei(`${TITEL} · Auslöser 2`),
      dritteDatei: datei(`${TITEL} · Auslöser 3`),
      vierteDatei: datei(`${TITEL} · Auslöser 4`),
    });
    pruefeStandzusage(kette);
    // Und die Lagen stehen wirklich einzeln da — nicht siebenmal dieselbe. „netzluecke" (Runde 4)
    // ist dabei die Lage, die es vorher gar nicht gab: Netz wieder da, gelesen noch nichts. Sie
    // steht zweimal in der Kette, und das ist der Unterschied, um den Runde 5 geht: einmal mit
    // eingehängter Seite, einmal für eine Lücke, die in ihrer ABWESENHEIT lag.
    expect(
      [
        kette.frisch.lage,
        kette.pausiert.lage,
        kette.nachNetzrueckkehr.lage,
        kette.gescheitert.lage,
        kette.nachErholung.lage,
        kette.nachAbwesenheit.lage,
        kette.nachAbwesenheitFrisch.lage,
      ],
      `${JOB}: SB1 · die Kette hat nicht die sieben erwarteten Lagen durchlaufen.`,
    ).toEqual([
      null,
      "pausiert",
      "netzluecke",
      "auffrischung_gescheitert",
      null,
      "netzluecke",
      null,
    ]);
  }, 900_000);
});

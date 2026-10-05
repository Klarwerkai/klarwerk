// ================================================================================================
// RESTPRÜFUNG GESAMTANWEISUNG · MEHRERE ANWEISUNGEN, ALLE VIER STÄNDE, DREI SPRACHEN — IM ECHTEN
// CHROMIUM, AUS DEM GESPEICHERTEN BESTAND DER LAUFENDEN INSTANZ.
// ================================================================================================
//
// DIE LÜCKE, GEGEN DIE DIESE DATEI STEHT, ist in den Nachweisen dieses Bereichs ausgeschrieben:
//   · `tests/gesamtanweisung-nutzerweg/liste-nach-prozesswechsel.integration.test.ts:33-36` — „WAS
//     SIE NICHT MISST: … die Liste in Englisch oder Niederländisch, und die Rollenmatrix"; dort steht
//     EINE Anweisung im Stand „Entwurf".
//   · `tests/wiki-gesamtanweisung-abnahme/a12-liste-flaeche.test.tsx` misst die Sprachen am
//     jsdom-DOM mit festgelegtem `fetch` — kein Browser, kein Server, kein gespeicherter Bestand.
//
// HIER: eine echte Fastify-Instanz auf einem echten Port liefert die GEBAUTE Fläche aus
// (`starteStrecke(mitFlaeche())`); der Bestand — vier Anweisungen in den vier Ständen des Modells
// und eine, deren einziger Baustein vertraulich ist — entsteht vorher über die echten Türen
// (`./bestand.ts`). Jede Sprache bekommt ein FRISCHES Profil, meldet sich über die Tastatur an und
// liest die Liste. Danach wird die Seite NEU GELADEN und dieselbe Messung wiederholt: was dann
// dasteht, kann nur aus dem Bestand des Servers kommen, nicht aus einem Zustand der Seite.
//
// GEMESSEN WIRD SICHTBAR, nicht im DOM: `zeileMussSichtbarSein` (`../gesamtanweisung-nutzerweg/
// liste-weg.ts`) prüft Titel UND Stand je Textknoten — Deckkraft, Fläche, Schriftfarbe. Die
// Sollwörter kommen aus dem Sprachkatalog (`sprachbestand`) und nicht aus diesem Prüfstand.
//
// ROLLEN AUF DER FLÄCHE: der Experte (Menüpunkt ab `experte`, `navigation.ts`) darf den
// vertraulichen Eintrag nicht sehen. Er sieht die Zeile der ganz verborgenen Anweisung mit
// „Bausteine: 0" und der Unvollständigkeitsangabe; öffnet er sie per Tab und Enter, steht der
// Hinweis dort, und der Titel des geschützten Eintrags steht NIRGENDS im sichtbaren Text. Die
// Gegenprobe: der Admin öffnet dieselbe Anweisung und sieht den Titel.
//
// NICHT GEMESSEN und deshalb nirgends behauptet: andere Browser als Chromium, Bildschirmleser,
// PostgreSQL und ein Prozesswechsel (die Instanz läuft mit den Speicherfassungen; die Haltbarkeit
// über einen echten Neustart gegen PostgreSQL misst `liste-nach-prozesswechsel.integration.test.ts`).
// Kein `ctx.skip()`: fehlt die Fläche, baut `stelleFrischeFlaecheBereit` sie oder scheitert laut.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Sprache } from "../../services/auth/src/meldungen";
import {
  type Browser,
  type Seite,
  fn,
  mitFlaeche,
  starteChromium,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, type Strecke, ersteinrichtung, starteStrecke } from "../gast-nutzerweg/strecke";
import {
  LISTE,
  eintragOeffnenMitTastatur,
  stelleFrischeFlaecheBereit,
  zeileMussSichtbarSein,
} from "../gesamtanweisung-nutzerweg/liste-weg";
import { meldeAnMitTastatur, mussSichtbarTragen } from "../gesamtanweisung-nutzerweg/weg";
import {
  FLAECHE_STEHT_AUF,
  GESAMTANWEISUNG_PFAD,
  SPRACHEN,
  profilFuer,
} from "../gesamtanweisung-tastaturweg/weg";
import { sprachbestand } from "../support/i18nBestand";
import {
  type Bestand,
  KO_GESCHUETZT,
  STAENDE,
  TITEL,
  TITEL_VERBORGEN,
  kontoMitRolle,
  legeBestandAn,
} from "./bestand";

const MARKE = "RESTPRUEFUNG BESTAND DREI SPRACHEN";
const ADMIN = "admin@restpruefung-sprachen.test";
const EXPERTE = "experte@restpruefung-sprachen.test";

let strecke: Strecke | undefined;
let browser: Browser | undefined;
let bestand: Bestand | undefined;

beforeAll(async () => {
  process.stderr.write(`${MARKE}: gebaute Fläche — ${stelleFrischeFlaecheBereit()}\n`);
  browser = await starteChromium();
  strecke = await starteStrecke(mitFlaeche());
  const { sitzung } = await ersteinrichtung(strecke, ADMIN);
  await kontoMitRolle(sitzung, strecke.profil("experte"), "experte", EXPERTE);
  bestand = await legeBestandAn(sitzung);
}, 900_000);

afterAll(async () => {
  await browser?.close();
  await strecke?.schliessen();
}, 60_000);

function zeug(): { browser: Browser; strecke: Strecke; bestand: Bestand } {
  if (!browser || !strecke || !bestand) {
    throw new Error(`${MARKE}: der Aufbau ist nicht durchgelaufen.`);
  }
  return { browser, strecke, bestand };
}

/** Ein Katalogsatz mit eingesetzter Zahl — wie i18next ihn zeichnet. */
function satz(sprache: string, schluessel: string, anzahl?: number): string {
  const roh = sprachbestand(sprache)[schluessel] ?? "";
  expect(roh.length, `${MARKE}: „${schluessel}" fehlt im Katalog „${sprache}"`).toBeGreaterThan(0);
  return anzahl === undefined ? roh : roh.replace("{{anzahl}}", String(anzahl));
}

/** Angemeldet auf der Liste, in dieser Sprache — und die Fläche steht nachweislich darauf. */
async function aufDerListe(seite: Seite, basis: string, email: string, sprache: Sprache) {
  await meldeAnMitTastatur(seite, basis, email, PASSWORT);
  await seite.goto(`${basis}${GESAMTANWEISUNG_PFAD}`, { waitUntil: "domcontentloaded" });
  await warte(seite, FLAECHE_STEHT_AUF, `die Fläche steht auf „${sprache}"`, sprache, 45_000);
}

/** Die Zeilen, die die Liste trägt — ihre Kennungen, in Reihenfolge des Dokuments. */
async function zeilenkennungen(seite: Seite): Promise<string[]> {
  return seite.evaluate<string[]>(
    fn(
      `(sel) => [...document.querySelectorAll(sel)].map((z) => z.getAttribute("data-anweisung") || "")`,
    ),
    `[data-testid="${LISTE}-eintrag"]`,
  );
}

/** Die ganze Liste in dieser Sprache: fünf Zeilen, jede mit Titel und ihrem Stand, sichtbar. */
async function listeMussStehen(
  seite: Seite,
  sprache: string,
  b: Bestand,
  wann: string,
): Promise<void> {
  for (const stand of STAENDE) {
    await zeileMussSichtbarSein(
      seite,
      b.anweisung[stand],
      TITEL[stand],
      satz(sprache, `ga.stand.${stand}`),
      `${wann} (${sprache}), Stand ${stand}`,
    );
  }
  await zeileMussSichtbarSein(
    seite,
    b.verborgen,
    TITEL_VERBORGEN,
    satz(sprache, "ga.stand.entwurf"),
    `${wann} (${sprache}), ganz verborgene Anweisung`,
  );
  // ERST NACH den Zeilen (die warten auf die geladene Liste): vorher stünde dort der Ladesatz.
  await mussSichtbarTragen(
    seite,
    `[data-testid="${LISTE}"] h2`,
    satz(sprache, "ga.liste.titel"),
    `${wann} (${sprache}): die Überschrift der Liste`,
  );
  const kennungen = await zeilenkennungen(seite);
  expect(
    [...kennungen].sort(),
    `${MARKE}: ${wann} (${sprache}) — die Liste trägt nicht genau die fünf gespeicherten Anweisungen`,
  ).toEqual([...Object.values(b.anweisung), b.verborgen].sort());
  expect(
    await seite.evaluate<boolean>(
      fn("(sel) => !!document.querySelector(sel)"),
      `[data-testid="${LISTE}-leer"]`,
    ),
    `${MARKE}: ${wann} (${sprache}) — neben einem Bestand steht der Leersatz`,
  ).toBe(false);
}

describe("Restprüfung · gespeicherter Bestand mit vier Ständen in DE/EN/NL im echten Chromium", () => {
  for (const sprache of SPRACHEN) {
    it(`(${sprache}) Admin: fünf Anweisungen, jeder Stand im Wortlaut der Sprache — auch nach dem Neuladen`, async () => {
      const { browser: b, strecke: s, bestand: best } = zeug();
      const { kontext, seite } = await profilFuer(b, sprache);
      try {
        await aufDerListe(seite, s.basis, ADMIN, sprache);
        await listeMussStehen(seite, sprache, best, "erster Aufruf");

        // Die vier Standwörter sind in jeder Sprache VERSCHIEDEN — sonst belegte „der Stand steht
        // da" nicht, dass es der RICHTIGE ist.
        const woerter = STAENDE.map((st) => satz(sprache, `ga.stand.${st}`));
        expect(new Set(woerter).size, `${MARKE}: Standwörter in „${sprache}" fallen zusammen`).toBe(
          4,
        );

        await seite.reload({ waitUntil: "domcontentloaded" });
        await warte(
          seite,
          FLAECHE_STEHT_AUF,
          `nach dem Neuladen steht „${sprache}"`,
          sprache,
          45_000,
        );
        await listeMussStehen(seite, sprache, best, "nach dem Neuladen");
      } finally {
        await kontext.close();
      }
    }, 600_000);

    it(`(${sprache}) Experte: die ganz verborgene Anweisung steht mit 0 / 1 da; geöffnet per Tastatur verrät sie nichts`, async () => {
      const { browser: b, strecke: s, bestand: best } = zeug();
      const { kontext, seite } = await profilFuer(b, sprache);
      try {
        await aufDerListe(seite, s.basis, EXPERTE, sprache);
        const zeile = `[data-testid="${LISTE}-eintrag"][data-anweisung="${best.verborgen}"]`;
        await zeileMussSichtbarSein(
          seite,
          best.verborgen,
          TITEL_VERBORGEN,
          satz(sprache, "ga.stand.entwurf"),
          `Experte (${sprache})`,
        );
        await mussSichtbarTragen(
          seite,
          `${zeile} [data-testid="${LISTE}-bausteine"]`,
          satz(sprache, "ga.liste.bausteine", 0),
          `Experte (${sprache}): sichtbare Bausteine der ganz verborgenen Anweisung`,
        );
        await mussSichtbarTragen(
          seite,
          `${zeile} [data-testid="${LISTE}-unvollstaendig"]`,
          satz(sprache, "ga.liste.unvollstaendig", 1),
          `Experte (${sprache}): Unvollständigkeitsangabe der ganz verborgenen Anweisung`,
        );
        // Eine offene Anweisung trägt für ihn KEINE Unvollständigkeitsangabe — die Angabe hängt
        // am Prädikat, nicht an der Zeile.
        expect(
          await seite.evaluate<boolean>(
            fn("(sel) => !!document.querySelector(sel)"),
            `[data-testid="${LISTE}-eintrag"][data-anweisung="${best.anweisung.entwurf}"] [data-testid="${LISTE}-unvollstaendig"]`,
          ),
          `${MARKE}: Experte (${sprache}) — eine offene Anweisung gilt als unvollständig`,
        ).toBe(false);

        await eintragOeffnenMitTastatur(
          seite,
          best.verborgen,
          TITEL_VERBORGEN,
          satz(sprache, "ga.stand.entwurf"),
          `Experte (${sprache})`,
        );
        await warte(
          seite,
          `() => !!document.querySelector('[data-testid="ga-lesestand-unvollstaendig"]')`,
          `Experte (${sprache}): der Hinweis auf nicht zugängliche Bausteine`,
          undefined,
          45_000,
        );
        await mussSichtbarTragen(
          seite,
          '[data-testid="ga-lesestand-unvollstaendig"]',
          satz(sprache, "ga.verborgene", 1),
          `Experte (${sprache}): Hinweis im Lesestand`,
        );
        const text = await seite.evaluate<string>(fn("() => document.body.innerText"));
        expect(
          text,
          `${MARKE}: Experte (${sprache}) sieht den Titel des geschützten Eintrags`,
        ).not.toContain(KO_GESCHUETZT);
        expect(
          await seite.evaluate<number>(
            fn(`() => document.querySelectorAll('[data-testid="ga-lesestand-baustein"]').length`),
          ),
          `${MARKE}: Experte (${sprache}) bekommt einen verborgenen Baustein gezeichnet`,
        ).toBe(0);
      } finally {
        await kontext.close();
      }
    }, 600_000);
  }

  it("GEGENPROBE (de) Admin: dieselbe Anweisung zeigt den geschützten Eintrag sichtbar", async () => {
    const { browser: b, strecke: s, bestand: best } = zeug();
    const { kontext, seite } = await profilFuer(b, "de");
    try {
      await aufDerListe(seite, s.basis, ADMIN, "de");
      await eintragOeffnenMitTastatur(
        seite,
        best.verborgen,
        TITEL_VERBORGEN,
        satz("de", "ga.stand.entwurf"),
        "Admin (Gegenprobe)",
      );
      await warte(
        seite,
        `() => document.querySelectorAll('[data-testid="ga-lesestand-baustein"]').length === 1`,
        "Admin: der gebundene Baustein",
        undefined,
        45_000,
      );
      await mussSichtbarTragen(
        seite,
        '[data-testid="ga-lesestand-baustein"]',
        KO_GESCHUETZT,
        "Admin (Gegenprobe): Titel des geschützten Eintrags",
      );
    } finally {
      await kontext.close();
    }
  }, 600_000);
});

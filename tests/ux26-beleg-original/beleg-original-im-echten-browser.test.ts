// ================================================================================================
// UX-26 · BELEG UND ORIGINAL IM ECHTEN BROWSER — gebaute Fläche, echter Server, Speicherablagen.
// ================================================================================================
//
// Fährt den Weg aus `weg.ts` in DE/EN/NL, je bei 320 px und am Desktop, als Bearbeiter — und je
// Sprache einmal als Leser. `beleg-original-pg.integration.test.ts` fährt DENSELBEN Weg gegen echte
// PostgreSQL und liest den gespeicherten Beleg zusätzlich am Pool nach.
//
// LAUFVORAUSSETZUNG, laut und nicht still: `apps/web/dist`. Im Tor liegt es vor (`tools/check`);
// fehlt es, stellt `stelleFlaecheBereit()` es mit demselben Bündler her, statt zu überspringen.
//
// DER ALTBESTAND „BELEG FEHLT" wird hier am Draht nachgestellt (`altbestandAmDraht`, s. `weg.ts`);
// der PostgreSQL-Lauf löscht die Zeilen wirklich.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { browserKennung, stelleFlaecheBereit } from "../fassungsrueckholung-echter-browser/weg";
import { type Browser, mitFlaeche, starteChromium } from "../gast-nutzerweg/browserweg";
import {
  type Sitzung,
  type Strecke,
  ersteinrichtung,
  gastAnlegen,
  starteStrecke,
} from "../gast-nutzerweg/strecke";
import { ermittleBrowserbefund } from "../tor-inventar/browser-gruppe";
import { SPRACHEN } from "./bedeutung";
import {
  type Bestand,
  DESKTOP,
  INHALT,
  SCHMAL,
  altbestandAmDraht,
  belegeAmServer,
  durchgangsName,
  fahreDurchgang,
  fahreLeser,
  legeBestandAn,
} from "./weg";

const ADMIN = "bearbeiter@ux26-beleg.test";
const LESER = "leser@ux26-beleg.test";
const SELBST = "tests/ux26-beleg-original/beleg-original-im-echten-browser.test.ts";
const FENSTER = [SCHMAL, DESKTOP] as const;

let strecke: Strecke | undefined;
let browser: Browser | undefined;
let adminApi: Sitzung;
let bestand: Bestand;

beforeAll(async () => {
  const flaeche = stelleFlaecheBereit();
  browser = await starteChromium();
  process.stderr.write(
    `[KLARWERK] UX-26 Beleg/Original · Chromium ${browserKennung(browser)} · Fläche: ${flaeche}\n`,
  );
  const draht = altbestandAmDraht();
  const flaecheAnhaengen = mitFlaeche();
  strecke = await starteStrecke({
    vorListen: async (app) => {
      await draht.vorListen(app);
      await flaecheAnhaengen.vorListen(app);
    },
  });
  adminApi = (await ersteinrichtung(strecke, ADMIN)).sitzung;
  const leser = await gastAnlegen(adminApi, { name: "Nur Lesen", email: LESER, role: "viewer" });
  expect(leser.status, leser.text).toBe(201);
  bestand = await legeBestandAn(
    adminApi,
    SPRACHEN.flatMap((s) => FENSTER.map((f) => durchgangsName(s, f.width))),
    async (koId) => {
      draht.ids.add(koId);
    },
  );
}, 900_000);

afterAll(async () => {
  await browser?.close();
  await strecke?.schliessen();
}, 120_000);

function zeug(): { browser: Browser; strecke: Strecke } {
  if (!browser || !strecke) {
    throw new Error("UX-26: Browser oder Strecke fehlen — der Aufbau ist nicht durchgelaufen.");
  }
  return { browser, strecke };
}

for (const sprache of SPRACHEN) {
  for (const fenster of FENSTER) {
    const name = durchgangsName(sprache, fenster.width);
    describe(`UX-26 · Beleg und Original im echten Browser — ${name}`, () => {
      it(`${name} · K1–K5: Original öffnen, abgelöstes Original, Beleg fehlt, Leerstand → Quelle → Neuladen`, async () => {
        const { browser: b, strecke: s } = zeug();
        const befund = await fahreDurchgang({
          browser: b,
          strecke: s,
          bestand,
          email: ADMIN,
          sprache,
          fenster,
        });
        expect(befund.geoeffnet).toEqual([`/api/objects/${bestand.zwei.objekt2}/raw`]);
        expect(befund.originalInhalt).toBe(INHALT.zwei);
        // Der gespeicherte Beleg — nicht was die Fläche eben zeigte, sondern der Bestand am Server.
        const leer = bestand.leer.get(name);
        const zeilen = await belegeAmServer(adminApi, leer?.koId ?? "");
        expect(zeilen.map((z) => [z.kind, z.label])).toEqual([["source", befund.neueQuelle]]);
        // Jede Pflichtstation wurde per Tab erreicht. „Mehr" und das Aufklappen des Abschnitts
        // zählen nur dort, wo die Fläche sie nicht schon offen hielt (`weg.ts`, `belegeOeffnen`).
        for (const station of [
          `${sprache}_anmeldung_email`,
          `${sprache}_anmeldung_passwort`,
          `${sprache}_zwei_mehr`,
          `${sprache}_zwei_belege`,
          `${sprache}_original_anzeigen`,
          `${sprache}_quelle_anlegen`,
          `${sprache}_quelle_feld`,
          `${sprache}_quelle_speichern`,
        ]) {
          expect(
            befund.tastatur[station],
            `${station} wurde nicht per Tab erreicht`,
          ).toBeGreaterThan(0);
        }
      }, 600_000);
    });
  }

  it(`${sprache} · K4: ein Leser sieht Leerstand und „kein Beleganlass“, aber keinen Weg`, async () => {
    const { browser: b, strecke: s } = zeug();
    const leser = await fahreLeser({ browser: b, strecke: s, bestand, email: LESER, sprache });
    expect(leser.wegDa, "dem Leser wird „Quelle anlegen“ angeboten").toBe(false);
    expect(leser.knoepfe, "im Belegabschnitt des Lesers steht eine Aktion").toEqual(["nachladen"]);
    // Und der Leerstand des Lesers blieb, wie er war.
    expect(await belegeAmServer(adminApi, bestand.leserLeer.koId)).toEqual([]);
  }, 300_000);
}

it("G · dieser Lauf gehört in die serielle Browser-Gruppe des Tors und bringt keine neue Startstelle", () => {
  const befund = ermittleBrowserbefund();
  expect(befund.browserTests).toContain(SELBST);
  expect(befund.ketten.get(SELBST) ?? []).toContain("tests/gast-nutzerweg/browserweg.ts");
  for (const eigene of ["tests/ux26-beleg-original/weg.ts", SELBST]) {
    expect(befund.startdateien).not.toContain(eigene);
  }
  expect(befund.browserTests).not.toContain(
    "tests/ux26-beleg-original/beleg-original-pg.integration.test.ts",
  );
}, 120_000);

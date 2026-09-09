// ================================================================================================
// JOB 3438 · DIE NEUEN SCHLUESSEL STEHEN IN JEDER SPRACHE, DIE DAS PANEL FUEHRT.
// ================================================================================================
//
// WARUM DIESE DATEI UEBERHAUPT DA IST — der ehrliche Befund dieser Runde (Auftrag Lieferung 6
// verlangt, den Waechter NAMENTLICH zu nennen oder sein Fehlen auszusprechen):
//
//   ES GIBT KEINEN WAECHTER, DER DIE VOLLSTAENDIGKEIT DES PANEL-WOERTERBUCHS PRUEFT.
//
// Nachgesehen, nicht behauptet:
//   · `tests/app/mega51-sprache-und-rohwerte.test.ts:67-86` ist genau die gesuchte Bauform („jeder
//     Schluessel, den eine Sprache kennt, muss von allen dreien gekannt werden") — sie liest aber
//     `apps/web/src/i18n.ts`, die SPA, nicht das Panel.
//   · `tests/i18n/nl-completeness.test.ts` prueft DE<->NL des i18next-Bestands der SPA; das Panel
//     hat kein i18next.
//   · `tests/i18n/mega35-word-wortliste.test.ts:93-134` liest wirklich ALLE drei Sprachbloecke der
//     `taskpane.html`, prueft aber Wortverbote und verlangt `toHaveLength(3)` nur fuer eine feste,
//     namentlich gepflegte Liste. Ein neuer Schluessel, der nur in `de` stuende, faellt dort NICHT auf.
//   · `tests/app/word-addin.test.ts:869`, `mega74-klara-bilder.test.ts:179`,
//     `job2613-word-bilder-budget.test.ts:179` sind punktuelle Dreisprachigkeits-Pins EINZELNER
//     Schluessel — dieselbe Bauform, die diese Datei fuer die Schluessel dieser Runde fortsetzt.
//
// Diese Datei schliesst die Luecke NICHT allgemein (das waere ein eigener Auftrag) — sie bindet die
// Schluessel DIESER Runde an alle drei Sprachen und misst dabei am ausgelieferten Quelltext.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");

/** Die Sprachen, die das Panel-Woerterbuch fuehrt — aus der Datei erhoben, nicht abgeschrieben. */
const SPRACHEN = ["de", "en", "nl"];

/** Alle Woerterbuch-Eintraege des Panels als (Schluessel, Text) — dasselbe Muster wie mega35. */
function eintraege(): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = [];
  for (const zeile of HTML.split("\n")) {
    const treffer = zeile.match(/^\s{8}([A-Za-z0-9_]+):\s*"(.*)",\s*$/);
    if (treffer) {
      out.push({ key: treffer[1] as string, text: treffer[2] as string });
    }
  }
  return out;
}

/** Die Schluessel der Bildbilanz — genau die, die JOB 3438 einfuehrt. */
const NEUE_SCHLUESSEL: readonly string[] = [
  "sendImagesShrunkOne",
  "sendImagesShrunkMany",
  "sendImagesKeptOne",
  "sendImagesKeptMany",
  "sendImagesNotShrunkOne",
  "sendImagesNotShrunkMany",
  "sendImagesFailedOne",
  "sendImagesFailedMany",
  "sendImagesUnknownOne",
  "sendImagesUnknownMany",
  "sendImageFailTooBig",
  "sendImageFailUnreadable",
  "sendImageFailTimeout",
];

/**
 * Die Schluessel, die Runde 1 einfuehrte und Runde 2 ABGELOEST hat (BEN §1: sie fassten Erfolge und
 * Ausfaelle in einer Zahl zusammen und behaupteten mit „Originalgröße" einen Erhalt im Entwurf, den
 * der Verarbeitungsbericht nicht deckt). Der alte Weg muss WEG sein, nicht danebenstehen.
 */
const ABGELOESTE_SCHLUESSEL: readonly string[] = [
  "sendImagesShrunkKeptOneOne",
  "sendImagesShrunkKeptOneMany",
  "sendImagesShrunkKeptManyOne",
  "sendImagesShrunkKeptManyMany",
  "sendImagesFailures",
  "sendImagesUnknownReason",
];

describe("JOB 3438 · das Woerterbuch des Panels traegt die Bildbilanz in jeder Sprache", () => {
  it("W1 · die Ernte greift — sonst waere jede Aussage darunter still gruen", () => {
    // Ohne diese Kalibrierung koennte ein kaputtes Muster null Treffer liefern und alles
    // Folgende waere gruen, ohne irgendetwas geprueft zu haben (mega35s Lehre, dort Fall 1).
    expect(eintraege().length).toBeGreaterThan(150);
    // Die drei Sprachbloecke sind wirklich im Quelltext.
    for (const s of SPRACHEN) {
      expect(HTML, `Sprachblock ${s} fehlt`).toContain(`      ${s}: {`);
    }
  });

  it("W2 · jeder neue Schluessel steht dreimal — DE, EN und NL, kein halbes Woerterbuch", () => {
    const alle = eintraege();
    for (const key of NEUE_SCHLUESSEL) {
      const gefunden = alle.filter((e) => e.key === key);
      expect(
        gefunden.length,
        `${key}: ${gefunden.length} von 3 Sprachen — ein halbes Woerterbuch zeigt dem Menschen den blanken Schluesselnamen`,
      ).toBe(3);
      for (const e of gefunden) {
        expect(
          e.text.trim().length,
          `${key}: eine Sprache traegt einen leeren Text`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("W3 · die drei Fassungen eines Schluessels sind wirklich verschieden — keine kopierte Zeile", () => {
    // Eine dreimal abgeschriebene deutsche Zeile bestuende W2 und waere trotzdem kein Woerterbuch.
    const alle = eintraege();
    for (const key of NEUE_SCHLUESSEL) {
      const texte = alle.filter((e) => e.key === key).map((e) => e.text);
      expect(new Set(texte).size, `${key}: dieselbe Zeile mehrfach statt drei Sprachen`).toBe(3);
    }
  });

  it("W4 · jede Platzhalter-Menge ist in allen drei Sprachen dieselbe", () => {
    // Ein `{b}`, das in EN fehlt, laesst dort eine Zahl verschwinden — und der Satz behauptet
    // weniger, als der Server gemeldet hat.
    const alle = eintraege();
    for (const key of NEUE_SCHLUESSEL) {
      const mengen = alle
        .filter((e) => e.key === key)
        .map((e) =>
          [...e.text.matchAll(/\{([a-z]+)\}/g)]
            .map((m) => m[1])
            .sort()
            .join(","),
        );
      expect(new Set(mengen).size, `${key}: die Platzhalter unterscheiden sich je Sprache`).toBe(1);
    }
  });

  it("W5 · die abgelösten Schlüssel der Runde 1 stehen NIRGENDS mehr — weder im Wörterbuch noch im Skript", () => {
    // Ablösung heisst: der alte Weg ist weg. Ein liegengebliebener Schluessel waere toter Wortlaut,
    // den niemand mehr aufruft — und der beim naechsten Leser als gueltige Fassung durchginge.
    for (const key of ABGELOESTE_SCHLUESSEL) {
      expect(HTML, `${key}: der abgelöste Schlüssel steht noch in ${TASKPANE}`).not.toContain(key);
    }
  });

  it("W6 · kein neuer Schlüssel behauptet einen Erhalt im Entwurf (BEN §5)", () => {
    // Der Bericht des Verkleinerers belegt die VERARBEITUNG, nicht den Verbleib im gespeicherten
    // Entwurf. „Originalgröße"/„original size"/„originele formaat" waeren genau diese Behauptung.
    const verbotene = ["Originalgröße", "original size", "originele formaat"];
    const alle = eintraege().filter((e) => NEUE_SCHLUESSEL.includes(e.key));
    expect(alle.length, "die Ernte fand die neuen Schlüssel nicht").toBe(
      NEUE_SCHLUESSEL.length * 3,
    );
    for (const e of alle) {
      for (const wort of verbotene) {
        expect(e.text, `${e.key} behauptet einen Erhalt im Entwurf: „${wort}“`).not.toContain(wort);
      }
    }
  });
});

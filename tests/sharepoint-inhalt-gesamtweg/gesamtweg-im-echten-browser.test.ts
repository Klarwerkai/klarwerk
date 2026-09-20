// ================================================================================================
// JOB 4295 · G — DER GANZE SHAREPOINT-INHALTSWEG IN EINEM ECHTEN CHROMIUM. SPEICHERABLAGEN, IM TOR.
// ================================================================================================
//
// DER SATZ, DEN DIESE DATEI MISST, IN EINEM LAUF: „Eine berechtigte Person öffnet den
// SharePoint-Import in einem echten Browser, sieht ihre Dateiliste, erkennt VOR der Annahme, dass
// ihre Textdatei Inhalt bringt, übernimmt sie MIT DER TASTATUR, und liest danach DENSELBEN Text am
// zurückgelesenen Wissensobjekt — samt Herkunft und Stand. Ein zweiter Import derselben Datei legt
// keinen zweiten Eintrag an."
//
// Bis hierher gab es diesen Satz als ZWEI Aussagen: `tests/sharepoint-inhalt/…-montiert.test.tsx`
// (Fläche in jsdom, Draht abgeklemmt) und `…/weg-am-draht-und-neustart.test.ts` (Server ohne
// Browser). BENs Urteil zu JOB 4232 R4 hat genau die Naht dazwischen beanstandet
// (`archiv/4232/runde-4/ben.md:20`). Der Ablauf selbst steht in `strecke.ts` — diese Datei fährt ihn
// gegen SPEICHERablagen, `gesamtweg-pg-im-browser.integration.test.ts` gegen echtes PostgreSQL.
//
// LAUFVORAUSSETZUNG, LAUT UND NICHT STILL: `apps/web/dist` muss da sein. Im Tor läuft `./tools/build`
// davor (`tools/check:9`). Fehlt es, wird dieser Lauf ROT mit Handlungsanweisung (`browserweg.ts`,
// `starteChromium`) — ein stiller Übersprung sähe aus wie ein bestandener Lauf.
//
// DIE ZWEI HÄLFTEN VON JOB 4232 BLEIBEN STEHEN und werden NICHT abgelöst: die eine ist der schnelle
// Serverweg ohne Browser (und misst zusätzlich den Appneustart), die andere die feine
// Flächenmessung mit angehaltenen Zuständen. Diese Strecke ist die Klammer um beide.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { type Browser, DIST, starteChromium } from "../gast-nutzerweg/browserweg";
import { type Strecke, ersteinrichtung } from "../gast-nutzerweg/strecke";
import {
  ANWEISUNG,
  DOWNLOAD,
  JOB,
  NOTIZ,
  QUELLSTAND,
  QUELLSTAND_NEU,
  SPRACHEN,
  TEXT,
  type Uebersetzer,
  doppel,
  fahreDenGesamtweg,
  portVon,
  protokollzeile,
  raeumeNetzAb,
  schreibeProtokoll,
  spanneNetzAuf,
  starteAnwendung,
} from "./strecke";

const ADMIN = "gesamtweg-admin@sharepoint-4295.test";

/**
 * Die Sollsätze kommen aus dem WIRKLICHEN Katalog, nicht aus diesem Test.
 *
 * JOB 4360: je Sprache gebunden statt nur auf Deutsch — der Quellstand trägt eine Beschriftung, und
 * die muss in de/en/nl im echten Browser stehen. `getFixedT` liest denselben Katalog, den die Fläche
 * bündelt; ein hier abgeschriebenes Wort wäre eine zweite Textquelle.
 */
const uebersetzer = (sprache: string): Uebersetzer => {
  const katalog = i18n.getFixedT(sprache);
  return (schluessel, werte) =>
    werte === undefined ? katalog(schluessel) : katalog(schluessel, werte);
};
const t: Uebersetzer = uebersetzer("de");

let browser: Browser | undefined;
let strecke: Strecke | undefined;

beforeAll(async () => {
  spanneNetzAuf();
  browser = await starteChromium();
  strecke = await starteAnwendung();
  await ersteinrichtung(strecke, ADMIN);
}, 300_000);

afterAll(async () => {
  // Browser UND Socket werden abgeräumt, auch wenn das eine scheitert — ein hängender Chromium
  // oder ein offener Port blockierte den nächsten Lauf auf diesem geteilten Prüfstand.
  try {
    await browser?.close();
  } finally {
    await strecke?.schliessen();
    raeumeNetzAb();
  }
}, 120_000);

function zeug(): { browser: Browser; strecke: Strecke } {
  if (!browser || !strecke) {
    throw new Error(`${JOB}: Browser oder Strecke fehlen — der Aufbau ist nicht durchgelaufen.`);
  }
  return { browser, strecke };
}

describe("JOB 4295 · G — der SharePoint-Inhaltsweg als eine Strecke im echten Chromium", () => {
  it("G1 — Liste → Kennzeichnung → Tastatur → Annahme → der Text am zurückgelesenen Objekt → kein zweiter Eintrag", async () => {
    const { browser: b, strecke: s } = zeug();
    const befund = await fahreDenGesamtweg({
      browser: b,
      strecke: s,
      katalog: uebersetzer,
      adminEmail: ADMIN,
    });

    // ── Die Belege noch einmal ausdrücklich, damit ein Mensch sie in der Rückgabe wiederfindet.
    expect(befund.ankuendigung[NOTIZ.id]).toBe(t("imp.sharepoint.vorschau.textdatei"));
    expect(befund.ankuendigung[ANWEISUNG.id]).toBe(t("imp.sharepoint.vorschau.nurMerkmale"));
    expect(befund.waehrendDerMessung).toBe(t("imp.sharepoint.vorschau.laeuft"));
    expect(befund.gemessen).toBe(t("imp.sharepoint.vorschau.text"));
    expect(befund.ergebnisSatz).toBe(t("imp.sharepoint.uebernommen.text"));
    // DER KERN: derselbe Text, gelesen am Objekt — nicht an der Antwort des Importaufrufs.
    expect(befund.gelesenerText).toBe(TEXT.replace("\n", " "));
    // UND DERSELBE TEXT SICHTBAR AM WIEDER GEÖFFNETEN OBJEKT (Lieferung 3 e, BENs Pflicht 2).
    // Diese vier Zeilen sind der Grund, warum R1 und R2 rot waren: bis hierher endete der Nachweis
    // an der Prüfkarte, und was dort stand, wurde mit `textContent` gelesen.
    expect(befund.objektseite.titel).toBe(NOTIZ.name);
    for (const zeile of TEXT.split("\n")) {
      expect(befund.objektseite.text, `„${zeile}“ fehlt am wieder geöffneten Objekt`).toContain(
        zeile,
      );
    }
    expect(befund.objektseite.quellen).toContain("SharePoint");
    expect(befund.objektseite.quellen).toContain(NOTIZ.webUrl);
    expect(befund.objektseite.quellenZeit).not.toBe("");
    // ── JOB 4360 · DER QUELLSTAND, SICHTBAR AM OBJEKT. ───────────────────────────────────────
    // EXAKT, nicht „enthält" (Runde 2, BENs Korrekturpflicht 1): „Version 17892045000" ENTHÄLT
    // „1789204500" und wäre trotzdem eine falsche Fassung. Der Sollsatz wird aus Katalog und
    // Bestandswert ZUSAMMENGESETZT; abgeschrieben ist weder das Wort noch die Zahl.
    expect(befund.objektseite.quellstand).toBe(`${t("w2.source.version")} ${QUELLSTAND}`);
    // DIE ZWEI §9-ZUSTÄNDE (BENs Pflicht 3): benannter Leersatz, erkennbar laufende Auffrischung.
    expect(befund.zustaende.leerSatz).toBe(t("imp.sharepoint.leer"));
    expect(befund.zustaende.nichtFrischSatz).toBe(t("imp.sharepoint.nichtFrisch"));
    expect(befund.zustaende.alteListeBleibtSichtbar).toBe(true);
    expect(befund.herkunft).toEqual({
      provider: "SharePoint",
      url: NOTIZ.webUrl,
      sourceVersion: QUELLSTAND,
    });
    expect(befund.zweiterImport.kartenMitDemNamen, "der Wiederholimport hat verdoppelt").toBe(1);
    // ── JOB 4360 · DIE ZWEITE FASSUNG: angekommen, ablesbar, und NICHT als zweites Objekt. ────
    expect(befund.neueFassung.koId, "die zweite Fassung lief in ein anderes Objekt").toBe(
      befund.koId,
    );
    expect(befund.neueFassung.standAmBestand, "der Bestand führt nicht den neuen Stand").toBe(
      QUELLSTAND_NEU,
    );
    expect(
      befund.neueFassung.kartenDazu,
      "die zweite Fassung hat nicht genau einen Vorgang angelegt",
    ).toBe(1);
    // DIE ENTSCHEIDENDE ZEILE: der SICHTBARE Wert ist ein ANDERER als vorher — und zwar GENAU der
    // neue. Ein Nachweis, der nur „irgendein Stand steht da" verlangte, bliebe auch grün, wenn die
    // Fläche den alten stehen liesse.
    expect(befund.neueFassung.standSichtbar).toBe(`${t("w2.source.version")} ${QUELLSTAND_NEU}`);
    expect(befund.neueFassung.standSichtbar).not.toBe(befund.objektseite.quellstand);
    // ── UND DASSELBE IN DE/EN/NL, jede Sprache mit IHRER Beschriftung aus dem Katalog. ────────
    expect(
      Object.keys(befund.neueFassung.jeSprache).sort(),
      "der Quellstand wurde nicht in allen drei Sprachen gelesen",
    ).toEqual([...SPRACHEN].sort());
    for (const sprache of SPRACHEN) {
      expect(
        befund.neueFassung.jeSprache[sprache],
        `in „${sprache}" steht nicht genau der Quellstand der zweiten Fassung`,
      ).toBe(`${uebersetzer(sprache)("w2.source.version")} ${QUELLSTAND_NEU}`);
    }
    // Die vier Fehlerlagen sind WIRKLICH gefahren, jede mit ihrem Satz und ohne Zusage daneben.
    expect(befund.fehlerlagen.map((f) => f.satz)).toEqual([
      t("imp.sharepoint.fehler.keineBerechtigung"),
      t("imp.sharepoint.fehler.nichtVorhanden"),
      t("imp.sharepoint.fehler.verbindungWeg"),
      t("imp.sharepoint.fehler.verbindungWeg"),
    ]);
    // Jedes Bedienelement des Weges wurde per Tab erreicht — eine Null wäre ein nie gegangener
    // Weg, und `tastaturAusloesen`/`tippeMitTastatur` hätten vorher geworfen.
    for (const [was, schritte] of Object.entries(befund.tastatur)) {
      expect(schritte, `${was} wurde nicht per Tab erreicht`).toBeGreaterThan(0);
    }
    // DIE SOLLLISTE IST DAS INVENTAR DES TASTATURWEGES. Sie steht hier und nicht in `strecke.ts`,
    // damit eine Station nicht still verschwinden kann: wer sie dort herausnimmt, muss sie hier
    // austragen und dabei erklären, warum.
    expect(
      Object.keys(befund.tastatur).sort(),
      "die Tastaturstationen des Weges sind nicht vollständig",
    ).toEqual(
      [
        "anmeldungEmail",
        "anmeldungPasswort",
        "ankreuzen",
        "ankreuzenOffline",
        "ankreuzenZweitesMal",
        // JOB 4360: der Import der zweiten Fassung und die beiden fremdsprachigen Durchgänge haben
        // EIGENE Stationen. Sie stehen einzeln hier, damit nicht eine von ihnen still verschwinden
        // kann — dieselbe Begründung wie für die Liste insgesamt (s. oben).
        "ankreuzenZweiteFassung",
        "annehmen",
        "annehmenZweiteFassung",
        "mehrAufklappen",
        "mehrAufklappenZweiteFassung",
        "mehrAufklappen_en",
        "mehrAufklappen_nl",
        "neuLaden_403",
        "neuLaden_404",
        "neuLaden_500",
        "neuLaden_angehalten",
        "neuLaden_leer",
        "neuLaden_zurueck",
        "neuLaden_zurueckVonLeer",
        "quellenAufklappen",
        "quellenAufklappenZweiteFassung",
        "quellenAufklappen_en",
        "quellenAufklappen_nl",
        "uebernehmen",
        "uebernehmenZweiteFassung",
        "uebernehmenZweitesMal",
        "volltextAufklappen",
        "warteschlangeAufklappen",
        "warteschlangeAufklappenZweiteFassung",
      ].sort(),
    );

    schreibeProtokoll(
      protokollzeile({
        browser: b,
        port: portVon(s),
        flaeche: existsSync(join(DIST, "index.html")) ? "war schon da" : "fehlt",
        datenhaltung: "Speicherablagen (kein PostgreSQL — dieser Lauf misst ohne Datenbank)",
        befund,
      }),
    );
  }, 900_000);

  it("G2 — NETZPROBE: kein Aufruf ging an eine fremde Adresse, und es lief wirklich etwas", () => {
    expect(doppel.fremdeAufrufe).toEqual([]);
    expect(doppel.graphAufrufe.length).toBeGreaterThanOrEqual(2);
    expect(doppel.downloadAufrufe.length).toBeGreaterThanOrEqual(1);
    expect(doppel.downloadAufrufe.every((d) => d.url.startsWith(DOWNLOAD))).toBe(true);
  });
});

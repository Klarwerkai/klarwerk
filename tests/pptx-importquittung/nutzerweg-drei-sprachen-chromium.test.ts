// ================================================================================================
// JOB 4228 · NUTZERWEG — DIE QUITTUNG AUF DER FLÄCHE, IM ENTWURF UND AM WISSENSEINTRAG. DREIMAL.
// ================================================================================================
//
// Die Fälle in `quittung-nennt-keinen-bilderverlust.test.ts` messen den Satz gegen den Import.
// Sie sagen nichts darüber, ob ein Mensch diesen Satz je zu sehen bekommt — und genau daran hängt
// der Nutzen: eine berichtigte Zeichenkette in einer Bibliothek hilft niemandem, wenn der Weg vom
// Label in den gespeicherten Entwurf abreisst oder wenn er nur auf Deutsch trägt.
//
// DIESER FALL LÄUFT DIE GANZE KETTE, je einmal in DE, EN und NL, in Chromium an der echten App:
//
//     Datei über den SICHTBAREN Knopf wählen → Quittung auf der Fläche → speichern → Entwurf
//     öffnen → NEU LADEN → einreichen → Quellenbeleg und Quittung am Wissenseintrag
//
// Gemessen wird dabei DER PERSISTIERTE SATZ (`SOURCE_LABELS.notePptx`), nicht der Bedienhinweis:
// die beiden unterscheiden sich seit JOB 4228 um genau einen Vorbehalt („soweit vorhanden"), und
// der abgeleitete Ableser `persistierterFormathinweis` holt ihn aus demselben Rumpfbauer, der ihn
// schreibt — es gibt keine zweite Abschrift.
//
// DIE SPRACHE IST KEIN BEIWERK. `localeKey` (`captureFromFile.ts`) wählt die Fassung anhand der
// beim Speichern eingestellten Sprache; ein Fall, der nur DE läuft, sagt über EN und NL nichts.
// Umgestellt wird über den echten Weg des Produkts (`localStorage["kw.sprache"]`, gelesen beim
// Start von `i18n.ts`) — kein Testschalter.
//
// KEIN `waitForTimeout`: jeder Warteschritt hängt an einem nachgewiesenen Zustand (geliehene
// Bühne, dieselbe Doktrin wie in `tests/d3-dateien-durchgaengig/`).
import { Buffer } from "node:buffer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import { CAPTURE_FRONT_DOOR_ROUTE } from "../../apps/web/src/lib/captureFrontDoor";
import {
  BLATT_TEXT,
  type SeiteMitDialog,
  ablesungKalibrieren,
  aufEingelesenWarten,
  dateiUeberSichtbareAuswahl,
  einreichenUndKennung,
  flaeche,
  persistierterFormathinweis,
  quellenanzeige,
  satz,
} from "../d3-dateien-durchgaengig/d3-buehne";
import { type Buehne, ORIGIN, buehneAufbauen, fn } from "../design/h3-blatt-buehne";
import {
  type DateiAnlage,
  type Entwurfsweiche,
  FALL_RAHMEN_MS,
  OEFFNEN_LINK_SELEKTOR,
  aufErfolgskastenWarten,
  aufFlaechensatzWarten,
  dateiwegOeffnen,
  entwurfsWeicheLegen,
  ganzdokumentWaehlen,
  kennungAusOeffnenLink,
  neuLaden,
  speichernDruecken,
  speicherversuchBeginnen,
  spracheSetzen,
  wartebudget,
} from "../ux19-speichern-oeffnen-reload/ux19-buehne";
import {
  BILD_BREITE,
  BILD_HOEHE,
  DECK_DATEINAME,
  MARKE,
  MISCH_DATEINAME,
  PPTX_MIME,
  deckMitInhalt,
  messeDeckMitInhalt,
} from "./messung";
import {
  BILANZ_PRAEFIX,
  SPRACHEN,
  type Sprache,
  VORBEHALT,
  anspruch,
  bilanzAussage,
} from "./quittungspruefer";

const DATEI = DECK_DATEINAME;

/**
 * Die Marke, an der dieser Weg den übernommenen INHALT wiedererkennt — und an der sich die
 * Ablesung kalibriert.
 *
 * SIE MUSS GENAU EINMAL AUF DER SEITE STEHEN, und das ist gemessen, nicht überlegt: mit
 * `MARKE.folientitel` war dieser Fall in allen drei Sprachen rot (Torlauf 270fdf52…,
 * „Kalibrierung GESCHEITERT: «Folientitel 4228» stand noch da, obwohl es auf der Zielseite
 * entfernt war"). Der Grund ist kein Fehler der Kalibrierung, sondern ihr Zweck: der erste
 * Folientitel wird zugleich der TITEL des Entwurfs, die Marke steht also zweimal da, und
 * `TEXT_AUSBLENDEN` leert nur den ERSTEN Textknoten. Eine Ablesung, die danach noch fündig wird,
 * ist damit nicht widerlegt — die Kalibrierung hätte nichts mehr zu sagen.
 *
 * Der Aufzählungspunkt steht nur im Rumpf der ersten Folie und sonst nirgends.
 */
const INHALTSMARKE = MARKE.listenpunkt;

/**
 * Das Deck MIT BILD als Playwright-Anlage — echte ZIP-Bytes aus `messung.ts`, dieselben, die die
 * Unit-Fälle messen. Keine zweite Fassung: was hier durch die sichtbare Dateiauswahl geht, ist
 * Byte für Byte die Datei, deren Import dort nachgerechnet wird.
 */
function bildDeckAnlage(): DateiAnlage {
  return {
    name: DECK_DATEINAME,
    mimeType: PPTX_MIME,
    buffer: Buffer.from(deckMitInhalt("png")) as Buffer,
  };
}

/**
 * JOB 4269 · Das MISCHDECK als Anlage: ein PNG, das ankommt, und ein BMP, das verworfen wird.
 * Auch hier keine zweite Fassung — dieselben Bytes, die `messeDeckMitInhalt("misch")` nachrechnet.
 */
function mischDeckAnlage(): DateiAnlage {
  return {
    name: MISCH_DATEINAME,
    mimeType: PPTX_MIME,
    buffer: Buffer.from(deckMitInhalt("misch")) as Buffer,
  };
}

/**
 * JOB 4269 · Die pauschale Bildzusage, die der Bedienhinweis bis zum 17.09.2026 trug. Sie darf im
 * Browser nirgends mehr auftauchen — weder vor dem Import noch am angenommenen Eintrag.
 */
const PAUSCHALE_BILDZUSAGE: Readonly<Record<Sprache, string>> = {
  de: "und Bilder je Folie übernommen",
  en: "and images per slide carried over",
  nl: "en afbeeldingen per dia overgenomen",
};

/**
 * JOB 4269 · Die Bilder des WISSENSEINTRAGS, gezählt wie die Quittung sie meint.
 *
 * WARUM NICHT EINFACH `<img>`-MARKEN ZÄHLEN, und das ist gemessen, nicht überlegt: am Eintrag gibt
 * es kein `[data-testid="blatt-text"]`, gezählt wird also über `document.body` — und dort stand das
 * EINE übernommene Bild zweimal (Torlauf aac29d0d…, „expected 2 to be 1"). Die Seite stellt denselben
 * Rumpf an mehr als einer Stelle dar; ein zweites `<img>` mit DERSELBEN Quelle ist aber kein zweites
 * Bild, und die Quittung behauptet auch keines.
 *
 * Gezählt werden deshalb VERSCHIEDENE Bildquellen. `kennungen` trägt die Anfänge dieser Quellen mit
 * heraus: stünden dort wirklich zwei verschiedene Bilder, wäre das in der Fehlermeldung zu sehen und
 * nicht hinter einer Entschärfung versteckt. `naturalWidth`/`naturalHeight` kommen aus der
 * Dekodierstufe und werden für JEDES Bild gelesen — ein Bild, das nur im DOM steht, hat 0.
 */
const BILDER_AM_EINTRAG = `() => {
  const wurzel = document.querySelector('[data-testid="blatt-text"]') || document.body;
  const bilder = Array.prototype.slice.call(wurzel.querySelectorAll('img[src^="data:image/"]'));
  const quellen = [];
  for (const b of bilder) {
    const q = b.getAttribute('src') || '';
    if (quellen.indexOf(q) === -1) { quellen.push(q); }
  }
  return {
    marken: bilder.length,
    verschieden: quellen.length,
    kennungen: quellen.map((q) => q.slice(0, 48)),
    kleinsteBreite: bilder.length ? Math.min.apply(null, bilder.map((b) => b.naturalWidth)) : 0,
    kleinsteHoehe: bilder.length ? Math.min.apply(null, bilder.map((b) => b.naturalHeight)) : 0,
    alleFertig: bilder.length > 0 && bilder.every((b) => b.complete),
  };
}`;

/** Zählt die EINGEBETTETEN Bilder in der Schreibfläche — dieselbe Frage wie im Quittungssatz. */
const DATEN_BILDER_ZAEHLEN = `() => {
  const wurzel = document.querySelector('[data-testid="blatt-text"]') || document.body;
  const bilder = wurzel.querySelectorAll('img[src^="data:image/"]');
  return bilder.length;
}`;

/**
 * Misst das erste eingebettete Bild so, wie der BROWSER es sieht.
 *
 * `naturalWidth`/`naturalHeight` kommen aus der Dekodierstufe: sie stehen erst, wenn die Bytes
 * wirklich ein Bild ergeben haben. `complete` allein reicht NICHT — es wird auch bei einem
 * gescheiterten Ladevorgang true; deshalb werden beide Maße daneben gelesen.
 */
const ERSTES_BILD_MESSEN = `() => {
  const wurzel = document.querySelector('[data-testid="blatt-text"]') || document.body;
  const bilder = wurzel.querySelectorAll('img[src^="data:image/"]');
  const erstes = bilder[0];
  return {
    anzahl: bilder.length,
    breite: erstes ? erstes.naturalWidth : 0,
    hoehe: erstes ? erstes.naturalHeight : 0,
    vollstaendig: erstes ? erstes.complete : false,
  };
}`;

let b: Buehne;
let seite: SeiteMitDialog;
let weiche: Entwurfsweiche;

beforeAll(async () => {
  b = await buehneAufbauen("/erfassen");
  seite = b.seite as SeiteMitDialog;
  if (b.fehler !== null) {
    return;
  }
  weiche = await entwurfsWeicheLegen(seite);
}, FALL_RAHMEN_MS);

afterAll(async () => {
  await b?.schliessen();
});

describe("JOB 4228 · Nutzerweg — die berichtigte Quittung in DE, EN und NL", () => {
  for (const sprache of SPRACHEN) {
    it(
      `${sprache}: wählen, lesen, speichern, neu laden, einreichen — und keine Aussage ist falsch`,
      async () => {
        expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();

        // ---- Sprache stellen und von vorn anfangen ------------------------------------------
        await spracheSetzen(seite, sprache);
        await neuLaden(seite);

        // ---- Datei über den SICHTBAREN Knopf wählen ------------------------------------------
        // RUNDE 2 (BEN, Prüfpunkt 3): gewählt wird jetzt das Deck MIT BILD, nicht mehr die
        // bildlose Referenz. Ein Nutzerweg, der die Bildübernahme belegen soll, muss ein Bild
        // dabeihaben — sonst ist er über den strittigen Punkt stumm.
        await dateiwegOeffnen(seite);
        await ganzdokumentWaehlen(seite);
        await dateiUeberSichtbareAuswahl(seite, bildDeckAnlage());
        await aufEingelesenWarten(seite, DATEI);

        // ---- Die Quittung auf der Fläche, in DIESER Sprache -----------------------------------
        {
          const nachEinlesen = await flaeche(seite);
          expect(
            nachEinlesen,
            `kein Formathinweis zum PowerPoint-Import in «${sprache}»`,
          ).toContain(satz(CAPTURE_FILE_TEXT.importNotePptx));
        }

        // ---- Speichern ------------------------------------------------------------------------
        const versuch = speicherversuchBeginnen(weiche);
        expect(await speichernDruecken(seite), "Speichern-Knopf nicht betätigbar").toBe(true);
        await aufErfolgskastenWarten(seite, versuch);
        await weiche.warteAufAbschluss(versuch.marke);
        const kennung = await kennungAusOeffnenLink(seite);
        expect(kennung, "kein Öffnen-Link mit Entwurfskennung").not.toBe(null);

        // ---- Der Entwurf: Inhalt, Herkunft — und die QUITTUNG, die wirklich gespeichert ist ----
        await seite.click(OEFFNEN_LINK_SELEKTOR, { timeout: wartebudget("zeigerklick") });
        await aufFlaechensatzWarten(seite, INHALTSMARKE);
        // Der GRUNDSATZ, wie ihn der Rumpfbauer ohne Bildangaben erzeugt — er steht so oder so im
        // Beleg; die Bildbilanz kommt als eigener Satz dahinter und wird unten eigens gemessen.
        const persistiert = persistierterFormathinweis("pptx");
        {
          const imEntwurf = await seite.evaluate<string>(fn(BLATT_TEXT));
          expect(await quellenanzeige(seite), "keine Quellenanzeige am Entwurf").toContain(DATEI);
          // DER SATZ STEHT IM ENTWURF — nicht nur in der Bibliothek.
          expect(persistiert, "der persistierte PPTX-Hinweis ist leer").not.toBe("");
          expect(imEntwurf, `die Quittung «${persistiert}» steht nicht im Entwurf`).toContain(
            persistiert,
          );
          // … und er sagt für DIESE Sprache das Richtige: die vier echten Verluste weiterhin
          // benannt, der Vorbehalt da — und über Bilder sagt der Grundsatz NICHTS mehr.
          for (const merkmal of ["layout", "animationen", "uebergaenge", "notizen"] as const) {
            expect(anspruch(persistiert, sprache, merkmal), `${sprache}/${merkmal}`).toBe(
              "verloren",
            );
          }
          expect(anspruch(persistiert, sprache, "bilder"), sprache).toBe("keine");
          expect(persistiert, `Vorbehalt fehlt in «${sprache}»`).toContain(VORBEHALT[sprache]);

          // ---- DIE BILDBILANZ AM GESPEICHERTEN BELEG (Runde 2) ---------------------------------
          // Die Quittung nennt eine ZAHL. Sie muss zu dem passen, was wirklich im Entwurf steht —
          // gezählt werden die eingebetteten Bilder im DOM, nicht im Quittungstext.
          const beleg = (await quellenanzeige(seite)) ?? "";
          expect(beleg, `kein Bilanzsatz im Beleg (${sprache})`).toContain(BILANZ_PRAEFIX[sprache]);
          const aussage = bilanzAussage(beleg, sprache);
          const bilderImDom = await seite.evaluate<number>(fn(DATEN_BILDER_ZAEHLEN));
          expect(aussage?.imEntwurf, `Quittung «${beleg}»`).toBe(bilderImDom);
          expect(aussage?.fehlend, "diese Datei verliert kein Bild").toBe(null);
          expect(bilderImDom, "kein eingebettetes Bild im Entwurf").toBeGreaterThan(0);

          // DIE ZUSAGE UND IHR GEGENSTAND IN EINEM ATEMZUG: der benannte Verlust tritt wirklich ein.
          expect(imEntwurf, "die Sprechernotiz ist in den Entwurf gerutscht").not.toContain(
            MARKE.notiz,
          );
        }

        // ---- Neu laden: Quittung und Herkunft überleben ---------------------------------------
        await neuLaden(
          seite,
          `${CAPTURE_FRONT_DOOR_ROUTE}?draft=${encodeURIComponent(kennung ?? "")}`,
        );
        await aufFlaechensatzWarten(seite, INHALTSMARKE);
        {
          const nachNeuladen = await seite.evaluate<string>(fn(BLATT_TEXT));
          expect(nachNeuladen, "der Inhalt hat das Neuladen nicht überlebt").toContain(
            INHALTSMARKE,
          );
          expect(nachNeuladen, "die Quittung hat das Neuladen nicht überlebt").toContain(
            persistiert,
          );
          expect(
            await quellenanzeige(seite),
            "die Quellenanzeige hat das Neuladen nicht überlebt",
          ).toContain(DATEI);

          // ==========================================================================================
          // DAS BILD IST NACH DEM NEULADEN EIN BILD — VOM BROWSER DEKODIERT (Runde 2, BEN §2)
          // ==========================================================================================
          // `naturalWidth`/`naturalHeight` sind die Maße, die die Dekodierstufe des Browsers aus den
          // Bytes gelesen hat. Sie sind 0, solange ein Bild nicht geladen ist — und sie BLEIBEN 0,
          // wenn die Bytes kein Bild ergeben. Genau daran wäre das Testbild aus Runde 1 gescheitert
          // (PNG-Signatur + Rauschen); es hätte im DOM gestanden und nie ein Bild ergeben.
          const bild = await seite.evaluate<{
            anzahl: number;
            breite: number;
            hoehe: number;
            vollstaendig: boolean;
          }>(fn(ERSTES_BILD_MESSEN));
          expect(bild.anzahl, "kein eingebettetes Bild nach dem Neuladen").toBeGreaterThan(0);
          expect(bild.vollstaendig, "das Bild wurde nicht fertig geladen").toBe(true);
          expect(bild.breite, "der Browser konnte das Bild nicht dekodieren (Breite 0)").toBe(
            BILD_BREITE,
          );
          expect(bild.hoehe, "der Browser konnte das Bild nicht dekodieren (Höhe 0)").toBe(
            BILD_HOEHE,
          );

          // Und die Quittung sagt nach dem Neuladen immer noch DIESELBE Zahl wie der Entwurf zeigt.
          const belegNachNeuladen = (await quellenanzeige(seite)) ?? "";
          expect(bilanzAussage(belegNachNeuladen, sprache)?.imEntwurf, sprache).toBe(bild.anzahl);
        }

        // ---- Einreichen: der Quellenbeleg am angenommenen Wissenseintrag -----------------------
        const koId = await einreichenUndKennung(seite);
        expect(koId.length, "kein Wissenseintrag entstanden").toBeGreaterThan(0);
        await seite.goto(`${ORIGIN}/wissen/${koId}`, {
          waitUntil: "load",
          timeout: wartebudget("neuLadenAdresse"),
        });
        await aufFlaechensatzWarten(seite, INHALTSMARKE);
        {
          const amEintrag = await flaeche(seite);
          // Herkunft UND Quittung stehen im selben Quelle-Blockquote — gezielt gelesen, nicht im
          // Gesamtseitentext gesucht: ein Dateiname steht auf so einer Seite an mehreren Stellen.
          const beleg = await quellenanzeige(seite);
          expect(beleg, "keine Quellenanzeige am Wissenseintrag").toContain(DATEI);
          expect(beleg, "die Quittung steht nicht am Wissenseintrag").toContain(persistiert);
          expect(amEintrag, "der Inhalt steht nicht am Wissenseintrag").toContain(INHALTSMARKE);
          expect(amEintrag, "die Sprechernotiz taucht am Eintrag auf").not.toContain(MARKE.notiz);
          // Die Ablesung liest WIRKLICH diese Seite — sonst wäre die negative Zusicherung
          // („die Sprechernotiz taucht nicht auf") auch bei einer blinden Ablesung grün.
          await ablesungKalibrieren(seite, INHALTSMARKE, () => flaeche(seite));
        }

        expect(b.seitenfehler, `Seitenfehler: ${JSON.stringify(b.seitenfehler)}`).toEqual([]);
      },
      FALL_RAHMEN_MS,
    );
  }
});

// ================================================================================================
// JOB 4269 · DER BILDVERLUSTFALL — BIS ZUM ANGENOMMENEN WISSENSEINTRAG, IN DREI SPRACHEN
// ================================================================================================
//
// BENs Prüflücke, wörtlich (`archiv/4228/runde-2/ben.md:24`): „Bildverluste zusätzlich im Browser
// speichern und neu laden; am angenommenen Eintrag auch Bildbilanz und Dekodierung prüfen."
//
// Der Fall oben fährt den ERFOLGSfall: ein Bild, es kommt an. Über den Fall, auf den es ankommt —
// die Quelle trug Bilder, und nicht alle sind angekommen —, sagt er nichts. Genau dieser Fall wird
// hier gefahren, mit dem MISCHDECK: ein PNG, das ankommt, und ein BMP, das der Import bewusst
// verwirft (`pptx.ts:91-97`). Die Quittung muss dann BEIDE Zahlen nennen, und beide müssen stimmen:
//
//   · „{n} übernommen"      gegen die Bilder, die der BROWSER wirklich dekodiert hat
//     (`naturalWidth`/`naturalHeight` — nicht gegen die Zahl der `<img>`-Marken),
//   · „{k} nicht übernommen" gegen den Verlust, den das Deck nachweislich herstellt.
//
// DIE ZAHLEN WERDEN NICHT ABGESCHRIEBEN, sondern am selben Deck gemessen, das durch die sichtbare
// Dateiauswahl geht (`messeDeckMitInhalt("misch")`, dieselbe Importkette). Stünde hier eine
// hingeschriebene 1, prüfte der Fall die Quittung gegen eine zweite Abschrift statt gegen den
// Import.
describe("JOB 4269 · Nutzerweg — der BILDVERLUST bis zum Wissenseintrag, in DE, EN und NL", () => {
  for (const sprache of SPRACHEN) {
    it(
      `${sprache}: ein Bild kommt an, eines nicht — und die Quittung sagt am Eintrag beides`,
      async () => {
        expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();

        // Die Bilanz DIESES Decks, an der echten Importkette gemessen — der Maßstab für alles,
        // was unten am Eintrag abgelesen wird.
        const befund = await messeDeckMitInhalt("misch");
        expect(befund.bilanz, "das Mischdeck stellt keinen Bildverlust her").toEqual({
          quelle: 2,
          imEntwurf: 1,
          fehlend: 1,
        });

        await spracheSetzen(seite, sprache);
        await neuLaden(seite);

        await dateiwegOeffnen(seite);
        await ganzdokumentWaehlen(seite);
        await dateiUeberSichtbareAuswahl(seite, mischDeckAnlage());
        await aufEingelesenWarten(seite, MISCH_DATEINAME);

        // ---- Der Bedienhinweis auf der Fläche: da, und OHNE pauschale Bildzusage (JOB 4269) ----
        {
          // EINE Ablesung, zwei Zusicherungen — und die POSITIVE trägt die negative: dieselbe
          // Zeichenkette muss den Bedienhinweis enthalten UND die alte Bildzusage nicht. Eine
          // blinde Ablesung (leerer Text, falsche Seite) scheitert damit an der ersten Zeile,
          // bevor die zweite still grün werden kann; das ist hier die Kalibrierung (Lieferung 4).
          //
          // NICHT `ablesungKalibrieren`: dieser Ableser ist der Gesamtseitentext der ERFASSUNGS-
          // seite, und der Inhaltsmarker steht dort zum Messzeitpunkt nachweislich noch nicht
          // („Kalibrierung: «Aufzaehlungspunkt 4228» steht schon vor dem Ausblenden nicht auf der
          // Seite", Torlauf 39b2bc34…). Am Wissenseintrag unten, wo er steht, wird kalibriert.
          const nachEinlesen = await flaeche(seite);
          expect(nachEinlesen, `kein Formathinweis in «${sprache}»`).toContain(
            satz(CAPTURE_FILE_TEXT.importNotePptx),
          );
          expect(
            nachEinlesen,
            `der Bedienhinweis verspricht in «${sprache}» weiterhin pauschal Bilder`,
          ).not.toContain(PAUSCHALE_BILDZUSAGE[sprache]);
        }

        // ---- Speichern ------------------------------------------------------------------------
        const versuch = speicherversuchBeginnen(weiche);
        expect(await speichernDruecken(seite), "Speichern-Knopf nicht betätigbar").toBe(true);
        await aufErfolgskastenWarten(seite, versuch);
        await weiche.warteAufAbschluss(versuch.marke);
        const kennung = await kennungAusOeffnenLink(seite);
        expect(kennung, "kein Öffnen-Link mit Entwurfskennung").not.toBe(null);

        const persistiert = persistierterFormathinweis("pptx");

        // ---- Am Entwurf: die Bilanz nennt beide Zahlen --------------------------------------
        await seite.click(OEFFNEN_LINK_SELEKTOR, { timeout: wartebudget("zeigerklick") });
        await aufFlaechensatzWarten(seite, INHALTSMARKE);
        {
          const beleg = (await quellenanzeige(seite)) ?? "";
          expect(beleg, "keine Quellenanzeige am Entwurf").toContain(MISCH_DATEINAME);
          expect(beleg, `kein Bilanzsatz im Beleg (${sprache})`).toContain(BILANZ_PRAEFIX[sprache]);
          expect(bilanzAussage(beleg, sprache), `Quittung «${beleg}»`).toEqual({
            imEntwurf: befund.bilanz.imEntwurf,
            fehlend: befund.bilanz.fehlend,
          });
        }

        // ---- Neu laden ------------------------------------------------------------------------
        await neuLaden(
          seite,
          `${CAPTURE_FRONT_DOOR_ROUTE}?draft=${encodeURIComponent(kennung ?? "")}`,
        );
        await aufFlaechensatzWarten(seite, INHALTSMARKE);
        {
          const belegNachNeuladen = (await quellenanzeige(seite)) ?? "";
          expect(
            bilanzAussage(belegNachNeuladen, sprache),
            "die Bildbilanz hat das Neuladen nicht überlebt",
          ).toEqual({ imEntwurf: befund.bilanz.imEntwurf, fehlend: befund.bilanz.fehlend });
        }

        // ---- Einreichen und AM ANGENOMMENEN EINTRAG ablesen ------------------------------------
        const koId = await einreichenUndKennung(seite);
        expect(koId.length, "kein Wissenseintrag entstanden").toBeGreaterThan(0);
        await seite.goto(`${ORIGIN}/wissen/${koId}`, {
          waitUntil: "load",
          timeout: wartebudget("neuLadenAdresse"),
        });
        await aufFlaechensatzWarten(seite, INHALTSMARKE);
        {
          const beleg = (await quellenanzeige(seite)) ?? "";
          expect(beleg, "keine Quellenanzeige am Wissenseintrag").toContain(MISCH_DATEINAME);
          expect(beleg, "die Quittung steht nicht am Wissenseintrag").toContain(persistiert);

          // DIE BILANZ UND IHR GEGENSTAND, AM SELBEN ORT UND IM SELBEN ATEMZUG.
          const aussage = bilanzAussage(beleg, sprache);
          const bilder = await seite.evaluate<{
            marken: number;
            verschieden: number;
            kennungen: string[];
            kleinsteBreite: number;
            kleinsteHoehe: number;
            alleFertig: boolean;
          }>(fn(BILDER_AM_EINTRAG));
          // „{n} übernommen" — gegen die Bilder, die der Browser WIRKLICH dekodiert hat.
          expect(
            bilder.verschieden,
            `Bildquellen am Wissenseintrag: ${JSON.stringify(bilder.kennungen)}`,
          ).toBe(befund.bilanz.imEntwurf);
          expect(bilder.alleFertig, "ein Bild wurde nicht fertig geladen").toBe(true);
          expect(
            bilder.kleinsteBreite,
            "der Browser konnte ein Bild nicht dekodieren (Breite 0)",
          ).toBe(BILD_BREITE);
          expect(
            bilder.kleinsteHoehe,
            "der Browser konnte ein Bild nicht dekodieren (Höhe 0)",
          ).toBe(BILD_HOEHE);
          expect(aussage?.imEntwurf, `Quittung «${beleg}»`).toBe(bilder.verschieden);
          // „{k} nicht übernommen" — gegen den Verlust, den das Deck herstellt.
          expect(aussage?.fehlend, `Quittung «${beleg}»`).toBe(befund.bilanz.fehlend);
          expect(aussage?.fehlend, "der Verlustfall verliert nichts").toBeGreaterThan(0);

          // Der Grundsatz sagt über Bilder nach wie vor NICHTS — die Zahlen stehen daneben.
          expect(anspruch(persistiert, sprache, "bilder"), sprache).toBe("keine");
          expect(persistiert, `Vorbehalt fehlt in «${sprache}»`).toContain(VORBEHALT[sprache]);

          const amEintrag = await flaeche(seite);
          expect(amEintrag, "der Inhalt steht nicht am Wissenseintrag").toContain(INHALTSMARKE);
          expect(amEintrag, "die Sprechernotiz taucht am Eintrag auf").not.toContain(MARKE.notiz);
          expect(
            amEintrag,
            `am Eintrag steht in «${sprache}» noch eine pauschale Bildzusage`,
          ).not.toContain(PAUSCHALE_BILDZUSAGE[sprache]);
          // Beide negativen Zusicherungen hängen an einer Ablesung, die nachweislich DIESE Seite
          // liest (Lieferung 4).
          await ablesungKalibrieren(seite, INHALTSMARKE, () => flaeche(seite));
        }

        expect(b.seitenfehler, `Seitenfehler: ${JSON.stringify(b.seitenfehler)}`).toEqual([]);
      },
      FALL_RAHMEN_MS,
    );
  }
});

/**
 * Der Vollständigkeits-Riegel: die drei Sprachen dieses Falls sind genau die drei, die
 * `SOURCE_LABELS` kennt. Käme eine vierte dazu, ohne dass hier ein Weg dafür läuft, fiele das auf.
 */
describe("JOB 4228 · Nutzerweg — Vollständigkeit", () => {
  it("es gibt genau drei Sprachen, und für jede läuft oben ein ganzer Weg", () => {
    const sprachen: readonly Sprache[] = SPRACHEN;
    expect([...sprachen]).toEqual(["de", "en", "nl"]);
  });
});

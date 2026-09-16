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
  PPTX_MIME,
  deckMitInhalt,
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

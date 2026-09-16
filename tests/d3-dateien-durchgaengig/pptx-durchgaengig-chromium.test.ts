// ================================================================================================
// JOB 4203 · D3 / T4 — PPTX: VON DER SICHTBAREN DATEIAUSWAHL BIS ZUM WIEDERGEFUNDENEN EINTRAG.
// ================================================================================================
//
// Derselbe Weg und dieselbe Schrittfolge wie beim abgenommenen DOCX-Weg (s. Kopf von
// `pdf-durchgaengig-chromium.test.ts`). Was hier ZUSÄTZLICH zählt, ist die Sprechernotiz.
//
// DIE SPRECHERNOTIZ IST DER EIGENTLICHE PRÜFSTEIN DIESES FALLS. `importNote.pptx` sagt in DE/EN/NL
// ausdrücklich zu, dass Sprechernotizen verloren gehen. Eine Zusage über einen Verlust ist nur dann
// eine Aussage, wenn irgendwo nachgesehen wird, ob der Verlust wirklich eintritt UND ob er wirklich
// benannt wird. Die Referenz-PPTX trägt deshalb genau eine Notiz, und dieser Fall misst beides:
// die Notiz steht NICHT im Entwurf, der Satz über ihren Verlust STEHT auf der Fläche.
//
// KEIN `waitForTimeout` (Auftrag §5.3): jeder Warteschritt hängt an einem nachgewiesenen Zustand.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import { CAPTURE_FRONT_DOOR_ROUTE } from "../../apps/web/src/lib/captureFrontDoor";
import { type Buehne, ORIGIN, buehneAufbauen, fn } from "../design/h3-blatt-buehne";
import {
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
  wartebudget,
} from "../ux19-speichern-oeffnen-reload/ux19-buehne";
import {
  BLATT_TEXT,
  type SeiteMitDialog,
  ablesungKalibrieren,
  aufEingelesenWarten,
  dateiUeberSichtbareAuswahl,
  eingelesenZeichen,
  einreichenUndKennung,
  flaeche,
  persistierterFormathinweis,
  quellenanzeige,
  referenzAnlage,
  satz,
} from "./d3-buehne";
import {
  PPTX_FOLIENTITEL,
  PPTX_PUNKTE,
  PPTX_SPRECHERNOTIZ_MARKE,
  PPTX_SUCHBEGRIFF,
  REFERENZ,
} from "./referenzinhalt";

const DATEI = REFERENZ.pptx.name;

let b: Buehne;
let seite: SeiteMitDialog;
let weiche: Entwurfsweiche;

beforeAll(async () => {
  await i18n.changeLanguage("de");
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

describe("JOB 4203 · T4 — die PPTX-Kette in Chromium", () => {
  it(
    "T4 · PPTX wählen, einlesen, speichern, neu laden, einreichen — drei Folien überleben, die Notiz nicht (und das steht da)",
    async () => {
      expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();

      // ---- 30-dateiauswahl -------------------------------------------------------------------
      await neuLaden(seite);
      await dateiwegOeffnen(seite);
      await ganzdokumentWaehlen(seite);
      await dateiUeberSichtbareAuswahl(seite, referenzAnlage("pptx"));

      // ---- 31-eingelesenes-dokument ----------------------------------------------------------
      await aufEingelesenWarten(seite, DATEI);
      const zeichen = await eingelesenZeichen(seite, DATEI);
      const mindestens = [...PPTX_FOLIENTITEL, ...PPTX_PUNKTE.flat()].join("\n").length;
      expect(zeichen, "keine Einlese-Quittung mit Zeichenzahl").not.toBeNull();
      expect(
        zeichen ?? 0,
        `nur ${zeichen} Zeichen gelesen, erwartet mindestens ${mindestens}`,
      ).toBeGreaterThanOrEqual(mindestens);
      const nachEinlesen = await flaeche(seite);
      expect(nachEinlesen, "kein ehrlicher Formathinweis zum PowerPoint-Import").toContain(
        satz(CAPTURE_FILE_TEXT.importNotePptx),
      );

      // ---- 32-speicherquittung ---------------------------------------------------------------
      const versuch = speicherversuchBeginnen(weiche);
      expect(await speichernDruecken(seite), "Speichern-Knopf nicht betätigbar").toBe(true);
      await aufErfolgskastenWarten(seite, versuch);
      await weiche.warteAufAbschluss(versuch.marke);
      const kennung = await kennungAusOeffnenLink(seite);
      expect(kennung, "kein Öffnen-Link mit Entwurfskennung").not.toBe(null);
      expect(await flaeche(seite)).toContain(
        satz(CAPTURE_FILE_TEXT.wholeSavedSource, { name: DATEI }),
      );

      // ---- 33-entwurf-mit-quelle -------------------------------------------------------------
      await seite.click(OEFFNEN_LINK_SELEKTOR, { timeout: wartebudget("zeigerklick") });
      await aufFlaechensatzWarten(seite, PPTX_SUCHBEGRIFF);
      // RUNDE 4: JEDER ABSCHNITT KAPSELT SEINEN LESEWERT IN EINEM EIGENEN BLOCK. In dieser Kette
      // war nichts falsch — die Falle ist trotzdem dieselbe, und sie hat in der Markdown-Kette
      // zugeschlagen (dort prüfte „36-pruefliste" einen Text von vor zwei Seitenwechseln). Was
      // ausserhalb seines Blocks nicht sichtbar ist, kann auch nicht versehentlich befragt werden.
      {
        const imEntwurf = await seite.evaluate<string>(fn(BLATT_TEXT));
        for (const titel of PPTX_FOLIENTITEL) {
          expect(imEntwurf, `Folientitel fehlt im Entwurf: ${titel}`).toContain(titel);
        }
        for (const punkt of PPTX_PUNKTE.flat()) {
          expect(imEntwurf, `Aufzählungspunkt fehlt im Entwurf: ${punkt}`).toContain(punkt);
        }
        // RUNDE 2 — DIE HERKUNFT GEZIELT, nicht im Gesamttext (BEN, Prüfpunkt 3): gelesen wird der
        // Quelle-Blockquote selbst, nicht irgendein Vorkommen des Dateinamens auf der Seite.
        expect(await quellenanzeige(seite), "keine Quellenanzeige am Entwurf").toContain(DATEI);
        // DIE ZUSAGE UND IHR GEGENSTAND, in einem Atemzug: der Verlust tritt ein …
        expect(imEntwurf, "die Sprechernotiz ist in den Entwurf gerutscht").not.toContain(
          PPTX_SPRECHERNOTIZ_MARKE,
        );
        // … und er wird benannt. GEMESSEN WIRD DER PERSISTIERTE SATZ (`SOURCE_LABELS.notePptx`),
        // nicht die Oberflächen-Quittung: die beiden weichen für PPTX im Wortlaut voneinander ab
        // (Befund in der Rückgabe). Der Auftrag nennt ausdrücklich `notePptx` (§8.4) als den Satz,
        // an dem der Verlust der Sprechernotizen nachweisbar sein muss — und der steht hier.
        const persistiert = persistierterFormathinweis("pptx");
        expect(persistiert, "der persistierte PPTX-Hinweis ist leer").not.toBe("");
        expect(persistiert, "der persistierte Satz nennt die Sprechernotizen nicht").toMatch(
          /Sprechernotizen/,
        );
        expect(imEntwurf, "der Verlust der Sprechernotizen wird nicht benannt").toContain(
          persistiert,
        );
      }

      // ---- 34-neuladen-mit-quelle ------------------------------------------------------------
      await neuLaden(
        seite,
        `${CAPTURE_FRONT_DOOR_ROUTE}?draft=${encodeURIComponent(kennung ?? "")}`,
      );
      await aufFlaechensatzWarten(seite, PPTX_SUCHBEGRIFF);
      {
        const nachNeuladen = await seite.evaluate<string>(fn(BLATT_TEXT));
        expect(nachNeuladen, "der Inhalt hat das Neuladen nicht überlebt").toContain(
          PPTX_SUCHBEGRIFF,
        );
        expect(
          await quellenanzeige(seite),
          "die Quellenanzeige hat das Neuladen nicht überlebt",
        ).toContain(DATEI);
      }

      // ---- 35-eingereicht --------------------------------------------------------------------
      const koId = await einreichenUndKennung(seite);
      expect(koId.length, "kein Wissenseintrag entstanden").toBeGreaterThan(0);

      // ---- 36-pruefliste ---------------------------------------------------------------------
      await seite.goto(`${ORIGIN}/wissen/${koId}`, {
        waitUntil: "load",
        timeout: wartebudget("neuLadenAdresse"),
      });
      await aufFlaechensatzWarten(seite, PPTX_SUCHBEGRIFF);
      {
        const amEintrag = await flaeche(seite);
        expect(await quellenanzeige(seite), "keine Quellenanzeige am Wissenseintrag").toContain(
          DATEI,
        );
        expect(amEintrag, "der Inhalt steht nicht am Wissenseintrag").toContain(PPTX_SUCHBEGRIFF);
        expect(amEintrag, "die Sprechernotiz taucht am Eintrag auf").not.toContain(
          PPTX_SPRECHERNOTIZ_MARKE,
        );
        // RUNDE 4: derselbe Nachweis wie in der Markdown-Kette — die Ablesung liest WIRKLICH diese
        // Seite. Er wiegt hier besonders schwer, weil die Zusicherung daneben eine NEGATIVE ist
        // („die Sprechernotiz taucht nicht auf"): eine Ablesung, die gar nichts von dieser Seite
        // liest, wäre auch dafür grün.
        await ablesungKalibrieren(seite, PPTX_SUCHBEGRIFF, () => flaeche(seite));
      }

      expect(b.seitenfehler, `Seitenfehler: ${JSON.stringify(b.seitenfehler)}`).toEqual([]);
    },
    FALL_RAHMEN_MS,
  );
});

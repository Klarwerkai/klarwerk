// ================================================================================================
// JOB 4203 · D3 / T5 — MARKDOWN: VON DER SICHTBAREN DATEIAUSWAHL BIS ZUM WIEDERGEFUNDENEN EINTRAG.
// ================================================================================================
//
// Derselbe Weg und dieselbe Schrittfolge wie beim abgenommenen DOCX-Weg (s. Kopf von
// `pdf-durchgaengig-chromium.test.ts`). Was hier ZUSÄTZLICH zählt, sind die beiden Befunde, die
// dieser Auftrag am Markdown-Weg repariert hat — und zwar an der ANZEIGE gemessen, nicht an einer
// Funktion:
//
//   · Der VERLUSTHINWEIS (T1): bis zu dieser Scheibe bekam der Text-/Markdown-Import als einziger
//     gar keinen. Hier steht er auf der Fläche und im gespeicherten Entwurf.
//   · Die PIPE-TABELLE (T2): sie stand als Rohtext mit Strichen im Entwurf. Hier stehen ihre Zellen
//     als Zellen da — und die Trennzeile `---` steht nirgends mehr.
//
// T1 und T2 messen dieselben zwei Dinge an der reinen Funktion. Dieser Fall misst sie dort, wo ein
// Mensch sie sieht: nach dem Speichern, nach dem Neuladen und am eingereichten Eintrag.
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
  MD_ABSATZ_NACH_TABELLE,
  MD_ABSCHNITT_EINS,
  MD_ABSCHNITT_ZWEI,
  MD_LISTENPUNKTE,
  MD_SUCHBEGRIFF,
  MD_TABELLE_MATRIX,
  MD_TITEL,
  MD_UEBERSCHRIFT_MIT_STRICH,
  REFERENZ,
  markdownText,
} from "./referenzinhalt";
import { ZELLMATRIX_AUF_DER_SEITE, ZELLMATRIX_IM_BLATT } from "./tabellenmatrix";

const DATEI = REFERENZ.markdown.name;

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

describe("JOB 4203 · T5 — die Markdown-Kette in Chromium", () => {
  it(
    "T5 · Markdown wählen, einlesen, speichern, neu laden, einreichen — Tabelle als Tabelle, Grenze benannt",
    async () => {
      expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();

      // ---- 30-dateiauswahl -------------------------------------------------------------------
      await neuLaden(seite);
      await dateiwegOeffnen(seite);
      await ganzdokumentWaehlen(seite);
      await dateiUeberSichtbareAuswahl(seite, referenzAnlage("markdown"));

      // ---- 31-eingelesenes-dokument ----------------------------------------------------------
      await aufEingelesenWarten(seite, DATEI);
      const zeichen = await eingelesenZeichen(seite, DATEI);
      // Bei Markdown ist die Untergrenze exakt bekannt: gelesen wird die Datei, wie sie ist.
      expect(zeichen, "keine Einlese-Quittung mit Zeichenzahl").toBe(markdownText().length);
      // DER SATZ, DEN ES BIS ZU DIESER SCHEIBE NICHT GAB.
      const nachEinlesen = await flaeche(seite);
      expect(nachEinlesen, "kein ehrlicher Formathinweis zum Text-/Markdown-Import").toContain(
        satz(CAPTURE_FILE_TEXT.importNoteText),
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
      // RUNDE 4: JEDER ABSCHNITT KAPSELT SEINEN LESEWERT IN EINEM EIGENEN BLOCK. Der Grund ist ein
      // belegter Fehler: in Runde 3 prüfte der Abschnitt „36-pruefliste" die Folgeüberschrift gegen
      // `imEntwurf` — einen Flächentext von VOR zwei Seitenwechseln. Der Fall war grün und sagte
      // über den Wissenseintrag nichts. Ausserhalb seines Blocks gibt es diesen Namen jetzt nicht
      // mehr; derselbe Griff scheitert damit am Compiler statt erst am Prüfer.
      await seite.click(OEFFNEN_LINK_SELEKTOR, { timeout: wartebudget("zeigerklick") });
      await aufFlaechensatzWarten(seite, MD_SUCHBEGRIFF);
      {
        const imEntwurf = await seite.evaluate<string>(fn(BLATT_TEXT));
        expect(imEntwurf, "der Titel fehlt im Entwurf").toContain(MD_TITEL);
        expect(imEntwurf).toContain(MD_ABSCHNITT_EINS);
        expect(imEntwurf).toContain(MD_ABSCHNITT_ZWEI);
        for (const punkt of MD_LISTENPUNKTE) {
          expect(imEntwurf, `Aufzählungspunkt fehlt im Entwurf: ${punkt}`).toContain(punkt);
        }
        // RUNDE 2 — DIE ZELLMATRIX, nicht einzelne Zelltexte. Ein Fall, der jede Zelle einzeln im
        // Text sucht, ist grün, solange alle Wörter irgendwo stehen; die ZUORDNUNG sieht er nicht
        // (BEN, Prüfpunkt 2). Genau daran ist die erste Fassung gescheitert: aus einer Zelle mit
        // geschütztem Strich wurden drei, und unter „Ergebnis" stand ein Wortfragment.
        expect(
          await seite.evaluate<string[][]>(fn(ZELLMATRIX_IM_BLATT)),
          "die Zellmatrix im Entwurf stimmt nicht",
        ).toEqual(MD_TABELLE_MATRIX.map((zeile) => [...zeile]));
        // Und der Absatz, der OHNE Leerzeile auf die Tabelle folgt, steht vollständig da.
        expect(imEntwurf, "der Absatz nach der Tabelle fehlt im Entwurf").toContain(
          MD_ABSATZ_NACH_TABELLE,
        );
        // RUNDE 3 — und die ÜBERSCHRIFT mit eigenem Strich, die ohne Leerzeile darüber steht: sie
        // gehört NICHT in die Tabelle (das misst der Matrixvergleich) und muss trotzdem vollständig
        // dastehen. Matrix und Folgeinhalt werden damit getrennt geprüft (BEN, Promptverbesserung).
        expect(imEntwurf, "die Überschrift hinter der Tabelle fehlt").toContain(
          MD_UEBERSCHRIFT_MIT_STRICH,
        );
        // Die Tabelle ist eine TABELLE geworden, kein Rohtext: die Trennzeile ist verschwunden.
        expect(imEntwurf, "die Markdown-Trennzeile steht als Text im Entwurf").not.toContain("---");
        // RUNDE 2 — DIE HERKUNFT GEZIELT, nicht im Gesamttext (BEN, Prüfpunkt 3): gelesen wird der
        // Quelle-Blockquote selbst, nicht irgendein Vorkommen des Dateinamens auf der Seite.
        expect(await quellenanzeige(seite), "keine Quellenanzeige am Entwurf").toContain(DATEI);
        // Am ENTWURF zählt der PERSISTIERTE Satz aus `SOURCE_LABELS.noteText` — der Satz, den T1
        // eingeführt hat und ohne den der Entwurf wie eine verlustfreie Übernahme aussähe.
        expect(imEntwurf, "kein Verlusthinweis am Entwurf").toContain(
          persistierterFormathinweis("text"),
        );
      }

      // ---- 34-neuladen-mit-quelle ------------------------------------------------------------
      await neuLaden(
        seite,
        `${CAPTURE_FRONT_DOOR_ROUTE}?draft=${encodeURIComponent(kennung ?? "")}`,
      );
      await aufFlaechensatzWarten(seite, MD_SUCHBEGRIFF);
      {
        const nachNeuladen = await seite.evaluate<string>(fn(BLATT_TEXT));
        expect(nachNeuladen, "der Inhalt hat das Neuladen nicht überlebt").toContain(
          MD_SUCHBEGRIFF,
        );
        expect(
          await quellenanzeige(seite),
          "die Quellenanzeige hat das Neuladen nicht überlebt",
        ).toContain(DATEI);
        // Auch die ZUORDNUNG übersteht das Neuladen — sie liegt beim Server, nicht im Formular.
        expect(
          await seite.evaluate<string[][]>(fn(ZELLMATRIX_IM_BLATT)),
          "die Zellmatrix hat das Neuladen nicht überlebt",
        ).toEqual(MD_TABELLE_MATRIX.map((zeile) => [...zeile]));
        expect(
          nachNeuladen,
          "der Absatz nach der Tabelle ist beim Neuladen verloren gegangen",
        ).toContain(MD_ABSATZ_NACH_TABELLE);
        // RUNDE 3, BENs Korrekturpflicht 1 wörtlich: „Zusätzlich im Markdown-Bedienweg NACH NEULADEN
        // prüfen." Die Überschrift mit eigenem Strich steht auch dann noch ausserhalb der Tabelle.
        expect(
          nachNeuladen,
          "die Überschrift hinter der Tabelle ist beim Neuladen verloren gegangen",
        ).toContain(MD_UEBERSCHRIFT_MIT_STRICH);
      }

      // ---- 35-eingereicht --------------------------------------------------------------------
      const koId = await einreichenUndKennung(seite);
      expect(koId.length, "kein Wissenseintrag entstanden").toBeGreaterThan(0);

      // ---- 36-pruefliste ---------------------------------------------------------------------
      await seite.goto(`${ORIGIN}/wissen/${koId}`, {
        waitUntil: "load",
        timeout: wartebudget("neuLadenAdresse"),
      });
      await aufFlaechensatzWarten(seite, MD_SUCHBEGRIFF);
      {
        const amEintrag = await flaeche(seite);
        expect(amEintrag, "der Inhalt steht nicht am Wissenseintrag").toContain(MD_SUCHBEGRIFF);
        // RUNDE 2: die Herkunft am EINTRAG ebenfalls gezielt — im Quelle-Blockquote, nicht irgendwo.
        expect(await quellenanzeige(seite), "keine Quellenanzeige am Wissenseintrag").toContain(
          DATEI,
        );
        expect(
          await seite.evaluate<string[][]>(fn(ZELLMATRIX_AUF_DER_SEITE)),
          "die Zellmatrix am Wissenseintrag stimmt nicht",
        ).toEqual(MD_TABELLE_MATRIX.map((zeile) => [...zeile]));
        expect(amEintrag, "der Absatz nach der Tabelle fehlt am Wissenseintrag").toContain(
          MD_ABSATZ_NACH_TABELLE,
        );
        // ==========================================================================================
        // RUNDE 4 — DIE ZEILE, DIE DER PRÜFER WIDERLEGT HAT, UND IHRE KALIBRIERUNG.
        // ==========================================================================================
        // Hier stand `expect(imEntwurf, …)` — der Flächentext von VOR zwei Seitenwechseln. Die Zeile
        // war grün und hat über den Wissenseintrag nichts gesagt; BENs Gegenprobe (Überschrift dort
        // aus dem DOM entfernt) blieb ebenfalls grün. Gelesen wird jetzt `amEintrag`, also der auf
        // DIESER Seite frisch geholte Text.
        //
        // Dass das wirklich so ist, behauptet der Fall nicht — er WEIST es nach: `ablesungKalibrieren`
        // entfernt die Überschrift auf der Zielseite, verlangt, dass die Ablesung sie danach NICHT
        // mehr findet, und stellt sie wieder her. Genau diese Gegenprobe hat der Prüfer verlangt; sie
        // steht damit dauerhaft im Fall statt einmalig in einem Protokoll.
        expect(amEintrag, "die Überschrift hinter der Tabelle fehlt am Wissenseintrag").toContain(
          MD_UEBERSCHRIFT_MIT_STRICH,
        );
        await ablesungKalibrieren(seite, MD_UEBERSCHRIFT_MIT_STRICH, () => flaeche(seite));
      }

      expect(b.seitenfehler, `Seitenfehler: ${JSON.stringify(b.seitenfehler)}`).toEqual([]);
    },
    FALL_RAHMEN_MS,
  );
});

// ================================================================================================
// JOB 4203 · D3 / T3 — PDF: VON DER SICHTBAREN DATEIAUSWAHL BIS ZUM WIEDERGEFUNDENEN EINTRAG.
// ================================================================================================
//
// DIE LÜCKE, GEGEN DIE DIESER FALL STEHT, hat die Gesamtprüfung selbst benannt
// (`gespraech/gesamt-abnahme-20260914/STATUS.json:36`, A03): „Echte synthetische DOCX über sichtbare
// Dateiauswahl übernommen; Dateiname im wiedergeöffneten Entwurf nachgewiesen. **Weitere Dateitypen
// offen.**" Für PDF gab es Einheitstests der Bausteine (`tests/capture/pdf-extract.test.ts`,
// `pdf-layout.test.ts`) — und keinen einzigen Bedienweg. Ein Parser, der im Test funktioniert, sagt
// nichts darüber, ob ein Mensch mit einer PDF bis zum Wissenseintrag kommt.
//
// DIE SCHRITTFOLGE IST DIE DES ABGENOMMENEN DOCX-WEGES, Abschnitt für Abschnitt
// (`gespraech/gesamt-abnahme-20260914/docx-erfolgreich/test-results/`): 30-dateiauswahl,
// 31-eingelesenes-dokument, 32-speicherquittung, 33-entwurf-mit-quelle, 34-neuladen-mit-quelle,
// 35-eingereicht, 36-pruefliste. Nur so ist dieser Weg mit jenem vergleichbar.
//
// WAS DIESER FALL ZUSÄTZLICH BELEGT, was kein Einheitstest kann: die ECHTE pdfjs-Engine läuft hier
// im gebauten Bündel mit ihrem Worker (`files.ts:253-265`, lazy geladen). In Node gibt es diesen
// Weg nicht — deshalb ist dies die einzige Stelle im Haus, an der belegt ist, dass eine echte PDF
// im Browser wirklich gelesen wird.
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
import { PDF_ENTWURFSTITEL, PDF_SUCHBEGRIFF, PDF_ZEILEN, REFERENZ } from "./referenzinhalt";

const DATEI = REFERENZ.pdf.name;

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

describe("JOB 4203 · T3 — die PDF-Kette in Chromium", () => {
  it(
    "T3 · PDF wählen, einlesen, speichern, neu laden, einreichen — Inhalt UND Herkunft überleben jeden Schritt",
    async () => {
      expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();

      // ---- 30-dateiauswahl -------------------------------------------------------------------
      await neuLaden(seite);
      await dateiwegOeffnen(seite);
      await ganzdokumentWaehlen(seite);
      await dateiUeberSichtbareAuswahl(seite, referenzAnlage("pdf"));

      // ---- 31-eingelesenes-dokument ----------------------------------------------------------
      await aufEingelesenWarten(seite, DATEI);
      const zeichen = await eingelesenZeichen(seite, DATEI);
      // Die Quittung nennt eine ECHTE Zeichenzahl. Untergrenze ist der bekannte Inhalt selbst —
      // eine leer gelesene PDF käme nie über sie hinweg, und eine erfundene Zahl auch nicht.
      const mindestens = PDF_ZEILEN.join("\n").length;
      expect(zeichen, "keine Einlese-Quittung mit Zeichenzahl").not.toBeNull();
      expect(
        zeichen ?? 0,
        `nur ${zeichen} Zeichen gelesen, erwartet mindestens ${mindestens}`,
      ).toBeGreaterThanOrEqual(mindestens);
      // Der GRENZENHINWEIS steht schon hier, vor dem Speichern — der Mensch weiss, was fehlt,
      // bevor er sich entscheidet.
      const nachEinlesen = await flaeche(seite);
      expect(nachEinlesen, "kein ehrlicher Formathinweis zum PDF-Import").toContain(
        satz(CAPTURE_FILE_TEXT.importNotePdf),
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
      // Ein ECHTER Zeigerklick auf den angebotenen Weg, kein `el.click()` an der Fläche vorbei.
      await seite.click(OEFFNEN_LINK_SELEKTOR, { timeout: wartebudget("zeigerklick") });
      await aufFlaechensatzWarten(seite, PDF_SUCHBEGRIFF);
      // RUNDE 4: JEDER ABSCHNITT KAPSELT SEINEN LESEWERT IN EINEM EIGENEN BLOCK. In dieser Kette
      // war nichts falsch — die Falle ist trotzdem dieselbe, und sie hat in der Markdown-Kette
      // zugeschlagen (dort prüfte „36-pruefliste" einen Text von vor zwei Seitenwechseln). Was
      // ausserhalb seines Blocks nicht sichtbar ist, kann auch nicht versehentlich befragt werden.
      {
        const imEntwurf = await seite.evaluate<string>(fn(BLATT_TEXT));
        for (const zeile of PDF_ZEILEN) {
          expect(imEntwurf, `Zeile fehlt im Entwurf: ${zeile}`).toContain(zeile);
        }
        // RUNDE 2 — DIE HERKUNFT GEZIELT, nicht im Gesamttext (BEN, Prüfpunkt 3): gelesen wird der
        // Quelle-Blockquote selbst, nicht irgendein Vorkommen des Dateinamens auf der Seite.
        expect(await quellenanzeige(seite), "keine Quellenanzeige am Entwurf").toContain(DATEI);
        // Am ENTWURF zählt der PERSISTIERTE Satz aus `SOURCE_LABELS`, nicht die Oberflächen-Quittung
        // — die beiden sind zwei Aussagen an zwei Zeitpunkten und weichen im Haus nachweislich
        // voneinander ab (s. `persistierterFormathinweis`).
        expect(imEntwurf, "kein Verlusthinweis am Entwurf").toContain(
          persistierterFormathinweis("pdf"),
        );
      }

      // ---- 34-neuladen-mit-quelle ------------------------------------------------------------
      // Das echte Neuladen. Was danach dasteht, liegt beim Server — nicht im Formular.
      await neuLaden(
        seite,
        `${CAPTURE_FRONT_DOOR_ROUTE}?draft=${encodeURIComponent(kennung ?? "")}`,
      );
      await aufFlaechensatzWarten(seite, PDF_SUCHBEGRIFF);
      {
        const nachNeuladen = await seite.evaluate<string>(fn(BLATT_TEXT));
        expect(nachNeuladen, "der Inhalt hat das Neuladen nicht überlebt").toContain(
          PDF_SUCHBEGRIFF,
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
      // Der Quellenbezug wird an der ANZEIGE des Wissenseintrags gemessen, nicht an einer Ladung.
      await seite.goto(`${ORIGIN}/wissen/${koId}`, {
        waitUntil: "load",
        timeout: wartebudget("neuLadenAdresse"),
      });
      await aufFlaechensatzWarten(seite, PDF_SUCHBEGRIFF);
      {
        const amEintrag = await flaeche(seite);
        expect(await quellenanzeige(seite), "keine Quellenanzeige am Wissenseintrag").toContain(
          DATEI,
        );
        expect(amEintrag, "der Inhalt steht nicht am Wissenseintrag").toContain(PDF_SUCHBEGRIFF);
        expect(amEintrag, "der Titel des Entwurfs steht nicht am Eintrag").toContain(
          PDF_ENTWURFSTITEL,
        );
        // RUNDE 4: derselbe Nachweis wie in der Markdown-Kette — die Ablesung liest WIRKLICH diese
        // Seite. Ohne ihn wäre „steht am Wissenseintrag" wieder nur eine Behauptung über eine
        // Variable (s. `ablesungKalibrieren`).
        await ablesungKalibrieren(seite, PDF_SUCHBEGRIFF, () => flaeche(seite));
      }

      expect(b.seitenfehler, `Seitenfehler: ${JSON.stringify(b.seitenfehler)}`).toEqual([]);
    },
    FALL_RAHMEN_MS,
  );
});

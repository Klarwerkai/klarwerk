// ================================================================================================
// AUFTRAG import-meldungen · K2 (+ K5) — ABBRUCH UND ECHTER MODUSWECHSEL, IM ECHTEN BROWSER.
// ================================================================================================
//
// JOB 3379 hat Abbruch→Moduswechsel nur auf der jsdom-Bühne gemessen, die den Arbeitsraum OHNE
// Blatt montiert (`tests/import-anleitung-modus/abbruch-dann-moduswechsel.test.tsx`, C1/C2/C4 als
// it.fails „Moduswechsel danach nicht bedienbar"). Im Produkt gibt der Abbruch die Fläche ans
// Blatt zurück (`cancelFileImport` → `onZurueckInsBlatt`), und der nächste Moduswechsel beginnt
// dort. Diese Datei geht genau diesen Weg an der gebauten Seite in Chromium (`h3-blatt-buehne.ts`):
// eine getippte Eingabe, Datei über den sichtbaren Knopf, Abbrechen, Dateiweg wieder öffnen,
// Importart wechseln, nächste Datei. Gemessen werden der Blatt-Text (die erhaltene Eingabe), die
// gedrückte Karte, die Anleitung und das Fehlen jeder Quittung der abgebrochenen Datei.
//
// NICHT hier: C3 (Abbrechen ist während des Einlesens gesperrt). Dafür braucht es ein angehaltenes
// Einlesen, das nur die jsdom-Bühne herstellen kann; der Befund bleibt dort gepinnt.
//
// K5 (R-0152): vor jeder Auswahl steht die Grenze unmittelbar vor Ablagefläche und Auswahlknopf —
// mit den Werten, die DIESER Server über `GET /api/upload-limits` ausliefert.
//
// K4 (R-0120, Nacharbeit 1): der Größenabbruch des Ganzdokuments in der VOLLSTÄNDIGEN Anwendung,
// also samt Toast-Ausgabe (`ToastViewport.tsx`), die die jsdom-Bühne nicht montiert. Genau eine
// sichtbare Meldung, und zwar in der Region, die schon VOR dem Ereignis stand; Datei und Eingabe
// bleiben.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT as T } from "../../apps/web/src/lib/captureFromFile";
import { maxRawAttachmentMb, transferLimitMb } from "../../apps/web/src/lib/uploadLimits";
import {
  BLATT_TEXT,
  type SeiteMitDialog,
  aufEingelesenWarten,
  aufLiveMeldungWarten,
  dateiUeberSichtbareAuswahl,
  dateiwegSchliessen,
  flaeche,
  liveregionen,
  satz,
} from "../d3-dateien-durchgaengig/d3-buehne";
import { type Buehne, buehneAufbauen, fn } from "../design/h3-blatt-buehne";
import {
  FALL_RAHMEN_MS,
  KLICK_KARTE,
  aufFlaechensatzWarten,
  dateiAnlage,
  dateiwegOeffnen,
  ganzdokumentWaehlen,
  neuLaden,
  speichernDruecken,
  wartebudget,
} from "../ux19-speichern-oeffnen-reload/ux19-buehne";

/** Was ein Mensch VOR dem Dateiweg geschrieben hat. Es ist der Gegenstand von K2. */
const EINGABE = "Vor dem Abbruch getippt: die Schutzhaube ABBRUCH3379 bleibt geschlossen.";
const SCHREIBFLAECHE = '[data-testid="blatt-text"] [role="textbox"]';
/** Nur ASCII, ohne Zeilenumbruch: die Zeichenzahl der Quittung ist dann genau die Länge. */
const INHALT = "Abbruch und Moduswechsel: dieser Inhalt wird nach dem Abbruch nirgends quittiert.";
const ZEICHEN = INHALT.length;

/** Die Beschriftung der gedrückten Importart-Karte — leer, wenn keine gedrückt ist. */
const GEDRUECKT = `() => {
  const k = document.querySelector('button[aria-pressed="true"]');
  return k ? (k.textContent || '').replace(/\\s+/g, ' ').trim() : '';
}`;

/** Der Grenzhinweis als unmittelbarer Vorgänger der Ablagefläche (`CaptureFileImport.tsx`). */
const GRENZE_LESEN = `() => {
  const zone = document.querySelector('[data-testid="capture-dropzone"]');
  const knopf = document.querySelector('[data-testid="capture-file-pick"]');
  const h = zone ? zone.previousElementSibling : null;
  if (!zone || !knopf || !h || h.getAttribute('data-testid') !== 'upload-limits-hint') {
    return null;
  }
  const r = h.getBoundingClientRect();
  return {
    text: (h.textContent || '').replace(/\\s+/g, ' ').trim(),
    vorZone: (h.compareDocumentPosition(zone) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    vorKnopf: (h.compareDocumentPosition(knopf) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    hatFlaeche: r.width > 0 && r.height > 0,
  };
}`;

/** Markiert die Ablehnungsregion VOR dem Ereignis — so ist nachher prüfbar, dass sie schon stand. */
const REGION_MARKIEREN = `() => {
  const r = document.querySelector('[data-testid="capture-datei-meldung"]');
  if (!r) {
    return false;
  }
  r.setAttribute('data-vor-dem-ereignis', 'ja');
  return true;
}`;

/** Trägt die vorher markierte Region (dasselbe Element) jetzt den Satz? */
const MARKIERTE_REGION_TRAEGT = `(s) => {
  const r = document.querySelector('[data-vor-dem-ereignis="ja"]');
  return r !== null && (r.textContent || '').replace(/\\s+/g, ' ').includes(s);
}`;

/** Ein Ganzdokument über der Client-Grenze — dieselbe Grösse wie im jsdom-Fall von JOB 3379. */
const RIESE = "abbruch-zu-gross.txt";

interface Grenzlage {
  readonly text: string;
  readonly vorZone: boolean;
  readonly vorKnopf: boolean;
  readonly hatFlaeche: boolean;
}

interface Grenzen {
  readonly maxAttachments: number;
  readonly maxAttachmentBytes: number;
}

let b: Buehne;
let seite: SeiteMitDialog;

const punkte = (): string => satz(T.importModePoints);
const blatt = (): Promise<string> => seite.evaluate<string>(fn(BLATT_TEXT));
const gedrueckt = (): Promise<string> => seite.evaluate<string>(fn(GEDRUECKT));

/** Die eigene Eingabe, getippt wie von Hand — zurück kommt der Blatt-Text, wie er dasteht. */
async function eigeneEingabeSchreiben(): Promise<string> {
  await neuLaden(seite);
  await seite.click(SCHREIBFLAECHE, { timeout: wartebudget("zeigerklick") });
  await seite.keyboard.type(EINGABE);
  await aufFlaechensatzWarten(seite, EINGABE);
  const text = await blatt();
  expect(text, "die eigene Eingabe steht gar nicht erst da").toContain(EINGABE);
  return text;
}

/** Wählt eine Importart-Karte und wartet, bis genau sie gedrückt ist. */
async function karteWaehlen(beschriftung: string): Promise<void> {
  await seite.evaluate<boolean>(fn(KLICK_KARTE), beschriftung);
  await seite.waitForFunction(
    fn(`(w) => {
      const k = document.querySelector('button[aria-pressed="true"]');
      return k !== null && (k.textContent || '').includes(w);
    }`),
    beschriftung,
    { timeout: wartebudget("zeigerklick") },
  );
}

/** Die Anleitung der gewählten Art steht da, die der anderen nicht (Anfang wie in A6). */
function anleitung(text: string, art: "punkte" | "ganzes"): void {
  const soll = satz(art === "ganzes" ? T.hintWhole : T.hint).slice(0, 60);
  const fremd = satz(art === "ganzes" ? T.hint : T.hintWhole).slice(0, 60);
  expect(text, `Anleitung „${art}“ fehlt`).toContain(soll);
  expect(text, `die Anleitung der anderen Art steht noch da (${art})`).not.toContain(fremd);
}

/** Keine Quittung der abgebrochenen Datei — in keiner Importart. */
function keineQuittung(text: string, name: string): void {
  for (const key of [T.loadedStats, T.loadedStatsWhole, T.wholeSourceNote]) {
    expect(text, `alte Quittung ${key} für ${name}`).not.toContain(
      satz(key, { name, chars: ZEICHEN }),
    );
  }
}

beforeAll(async () => {
  await i18n.changeLanguage("de");
  b = await buehneAufbauen("/erfassen");
  seite = b.seite as SeiteMitDialog;
}, FALL_RAHMEN_MS);

afterAll(async () => {
  await b?.schliessen();
});

describe("K2 · Abbruch, dann echter Moduswechsel — am Browserzustand", () => {
  it(
    "A · Punkte → einlesen → Abbrechen → Ganzes → Punkte → Ganzes → nächste Datei",
    async () => {
      expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
      const vorher = await eigeneEingabeSchreiben();

      await dateiwegOeffnen(seite);
      expect(await gedrueckt(), "Ausgangsart beim ersten Öffnen").toContain(punkte());
      await dateiUeberSichtbareAuswahl(seite, dateiAnlage("abbruch-a.txt", INHALT));
      const quittungA = satz(T.loadedStats, { name: "abbruch-a.txt", chars: ZEICHEN });
      await aufFlaechensatzWarten(seite, quittungA);

      // Abbrechen: die Fläche geht ans Blatt zurück, und die Eingabe steht unverändert da.
      await dateiwegSchliessen(seite);
      expect(await blatt(), "Eingabe nach dem Abbruch").toBe(vorher);
      keineQuittung(await flaeche(seite), "abbruch-a.txt");

      // Der echte Moduswechsel: Dateiweg wieder öffnen, Importart wechseln, jeder Zwischenstand.
      await dateiwegOeffnen(seite);
      expect(await gedrueckt(), "Ausgangsart nach dem Abbruch").toContain(punkte());
      await ganzdokumentWaehlen(seite);
      let text = await flaeche(seite);
      anleitung(text, "ganzes");
      keineQuittung(text, "abbruch-a.txt");

      await karteWaehlen(punkte());
      text = await flaeche(seite);
      anleitung(text, "punkte");
      keineQuittung(text, "abbruch-a.txt");

      await ganzdokumentWaehlen(seite);
      anleitung(await flaeche(seite), "ganzes");

      // Der Wechsel trägt: die nächste Datei wird in der gewählten Art eingelesen.
      await dateiUeberSichtbareAuswahl(seite, dateiAnlage("abbruch-b.txt", INHALT));
      await aufEingelesenWarten(seite, "abbruch-b.txt");
      text = await flaeche(seite);
      expect(text).toContain(satz(T.loadedStatsWhole, { name: "abbruch-b.txt", chars: ZEICHEN }));
      expect(text).not.toContain(satz(T.loadedStats, { name: "abbruch-b.txt", chars: ZEICHEN }));
      keineQuittung(text, "abbruch-a.txt");

      await dateiwegSchliessen(seite);
      expect(await blatt(), "Eingabe am Ende des Weges").toBe(vorher);
      expect(b.seitenfehler, `Seitenfehler: ${JSON.stringify(b.seitenfehler)}`).toEqual([]);
    },
    FALL_RAHMEN_MS,
  );

  it(
    "B · Ganzes → einlesen → Abbrechen → Punkte → nächste Datei",
    async () => {
      expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
      const vorher = await eigeneEingabeSchreiben();

      await dateiwegOeffnen(seite);
      await ganzdokumentWaehlen(seite);
      await dateiUeberSichtbareAuswahl(seite, dateiAnlage("abbruch-c.txt", INHALT));
      await aufEingelesenWarten(seite, "abbruch-c.txt");

      await dateiwegSchliessen(seite);
      expect(await blatt(), "Eingabe nach dem Abbruch").toBe(vorher);
      keineQuittung(await flaeche(seite), "abbruch-c.txt");

      await dateiwegOeffnen(seite);
      await karteWaehlen(punkte());
      let text = await flaeche(seite);
      anleitung(text, "punkte");
      keineQuittung(text, "abbruch-c.txt");

      await dateiUeberSichtbareAuswahl(seite, dateiAnlage("abbruch-d.txt", INHALT));
      await aufFlaechensatzWarten(
        seite,
        satz(T.loadedStats, { name: "abbruch-d.txt", chars: ZEICHEN }),
      );
      text = await flaeche(seite);
      expect(text).not.toContain(
        satz(T.loadedStatsWhole, { name: "abbruch-d.txt", chars: ZEICHEN }),
      );
      keineQuittung(text, "abbruch-c.txt");

      await dateiwegSchliessen(seite);
      expect(await blatt(), "Eingabe am Ende des Weges").toBe(vorher);
      expect(b.seitenfehler, `Seitenfehler: ${JSON.stringify(b.seitenfehler)}`).toEqual([]);
    },
    FALL_RAHMEN_MS,
  );
});

describe("K4 · R-0120 — der Größenabbruch in der vollständigen Anwendung", () => {
  it(
    "zu großes Ganzdokument: eine Meldung in der vorher montierten Region, kein Toast",
    async () => {
      expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
      const vorher = await eigeneEingabeSchreiben();
      await dateiwegOeffnen(seite);
      await ganzdokumentWaehlen(seite);
      await dateiUeberSichtbareAuswahl(seite, dateiAnlage(RIESE, "A".repeat(4_500_000)));
      await aufEingelesenWarten(seite, RIESE);

      const zuGross = satz(T.tooLargeForImport);
      expect(await flaeche(seite), "die Ablehnung steht schon vor dem Speichern da").not.toContain(
        zuGross,
      );
      expect(await seite.evaluate<boolean>(fn(REGION_MARKIEREN)), "Region fehlt").toBe(true);
      expect(await speichernDruecken(seite), "Speichern-Knopf nicht betätigbar").toBe(true);
      await aufLiveMeldungWarten(seite, zuGross);

      // Genau EIN Träger, und es ist die Region, die schon vor dem Ereignis montiert war.
      const regionen = await liveregionen(seite);
      const traeger = regionen.filter((r) => r.text.includes(zuGross)).map((r) => r.marke);
      expect(traeger, `Ansagen: ${JSON.stringify(regionen)}`).toHaveLength(1);
      expect(traeger[0]).toContain("capture-datei-meldung");
      expect(await seite.evaluate<boolean>(fn(MARKIERTE_REGION_TRAEGT), zuGross)).toBe(true);
      // Keine zweite Ausgabe — weder Fehlerkasten noch Toast.
      const text = await flaeche(seite);
      expect(text.split(zuGross).length - 1, "die Ablehnung steht mehrfach da").toBe(1);
      // Die eingelesene Datei bleibt, und die eigene Eingabe auch.
      expect(text).toContain(satz(T.wholeSourceNote, { name: RIESE }));
      await dateiwegSchliessen(seite);
      expect(await blatt(), "Eingabe nach dem Größenabbruch").toBe(vorher);
      expect(b.seitenfehler, `Seitenfehler: ${JSON.stringify(b.seitenfehler)}`).toEqual([]);
    },
    FALL_RAHMEN_MS,
  );
});

describe("K5 · R-0152 — die Grenze an der Auswahlstelle, aus der Serverkonfiguration", () => {
  it(
    "vor jeder Auswahl: Hinweis vor Ablagefläche und Knopf, Werte aus GET /api/upload-limits",
    async () => {
      expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
      await neuLaden(seite);
      await dateiwegOeffnen(seite);
      const grenzen = await b.frage<Grenzen>("GET", "/api/upload-limits");
      const erwartet = satz("capture.uploadLimits", {
        count: grenzen.maxAttachments,
        mb: transferLimitMb(grenzen.maxAttachmentBytes),
        raw: maxRawAttachmentMb(grenzen.maxAttachmentBytes),
      });
      await aufFlaechensatzWarten(seite, erwartet);
      const lage = await seite.evaluate<Grenzlage | null>(fn(GRENZE_LESEN));
      expect(lage, "Grenzhinweis steht nicht unmittelbar vor der Ablagefläche").not.toBeNull();
      expect(lage?.text).toBe(erwartet);
      expect(lage?.vorZone, "der Hinweis steht nicht vor der Ablagefläche").toBe(true);
      expect(lage?.vorKnopf, "der Hinweis steht nicht vor dem Auswahlknopf").toBe(true);
      expect(lage?.hatFlaeche, "der Hinweis nimmt keine Fläche ein").toBe(true);
    },
    FALL_RAHMEN_MS,
  );
});

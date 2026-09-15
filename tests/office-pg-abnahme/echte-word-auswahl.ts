// ================================================================================================
// JOB 4085 · DIE ECHTE WORD-AUSWAHL, EINMAL AUFGESCHLOSSEN — KEINE HANDGESCHRIEBENE HTML-ZEILE.
// ================================================================================================
//
// WARUM DIESE DATEI EXISTIERT: beide Abnahmen dieses Jobs brauchen DENSELBEN Ausgangsstoff — einen
// Word-Absatz mit Formatierung und Bildern, wie ihn ein Mensch in Word markiert. Stünde die
// Aufbereitung zweimal, könnten die Abnahme am Fenster (`echte-worddatei-am-rueckweg.test.ts`) und
// die Abnahme gegen PostgreSQL (`rueckweg-pg.integration.test.ts`) grün sein und Verschiedenes
// meinen. Sie steht deshalb hier, einmal.
//
// ================================================================================================
// EINE GEMESSENE ABWEICHUNG VOM AUFTRAG, UND SIE STEHT HIER, NICHT IN EINER FUSSNOTE.
// ================================================================================================
//
// Der Auftrag (§6) nennt `tests/fixtures/job2912-zwei-bilder.docx` als Word-Auswahl. GEMESSEN am
// produktiven Extraktor trägt diese Datei genau 22 Zeichen Klartext („BAADER Sonde Station 1").
// Das Aufgabenfenster bietet den Rückweg aber erst an, wenn die DUBLETTENPRÜFUNG Kandidaten liefert
// — und die läuft unterhalb von `W6_MINDESTZEICHEN = 40` gar nicht erst los (taskpane.html:5296,
// Lage „zu-kurz"). Mit dieser Datei allein ist der Rückweg im Fenster also NICHT erreichbar; der
// Fall wäre nicht grün, sondern nie gefahren (gemessen: `#rw-block` blieb `hidden`).
//
// DIE ANTWORT IST NICHT, DEN KLARTEXT ZU ERFINDEN — das wäre eine Auswahl, die es in Word nicht
// gibt (dort gehören Text und HTML derselben Markierung). Stattdessen entsteht hier ein ECHTES
// OOXML-Paket (`baueDocx`, seit JOB 3210 im Bestand und von `tests/m5-docx-bildunterschriften/`
// gegen das ECHTE mammoth gefahren) mit
//   · einer Überschrift und einem Absatz, wie ein Mensch ihn markiert, und
//   · GENAU DEN ZWEI BILDERN der Bestandsdatei, Byte für Byte aus ihr gelesen
//     (`bilderDerBestandsdatei`, über den produktiven Extraktor — nicht abgeschrieben).
//
// Beides zusammen bleibt eine echte Word-Datei im Sinn des Auftrags §10: eine gültige `.docx` durch
// den PRODUKTIVEN Extraktor, nicht ein gefahrener Word-Client und keine Attrappe. Was aus der
// Bestandsdatei stammt, wird zusätzlich an ihr selbst gemessen (Fall A0a).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { extractDocxRich } from "../../apps/web/src/lib/docx";
import { type Absatz, alsPuffer, baueDocx } from "../m5-docx-bildunterschriften/docx-bauen";

/** Die Datei aus dem Bestand. Zwei PNG, gültiges OOXML — von Hand in Word zu öffnen. */
export const ECHTE_DATEI = "tests/fixtures/job2912-zwei-bilder.docx";

/** Der Absatz, den der Mensch in Word markiert — lang genug, dass die Dublettenprüfung anläuft. */
export const MARKIERTER_ABSATZ =
  "Bei Überdruck ist Ventil X unverzüglich von Hand zu schließen und der Vorgang zu protokollieren.";

/** Die Überschrift darüber — sie macht aus der Markierung einen formatierten Abschnitt. */
export const MARKIERTE_UEBERSCHRIFT = "Ventil X schließt bei Überdruck";

export interface WordAuswahl {
  /** Der Rumpf, wie ihn der produktive Extraktor aus der Datei holt (Struktur + Bilder). */
  html: string;
  /** Der Klartext derselben Markierung — das, was `Office.CoercionType.Text` herausgäbe. */
  text: string;
  /** Die `<img>`-Marken des Rumpfes, in Dokumentreihenfolge. */
  bildMarken: string[];
  /** Die Datenquellen der Bilder (`data:image/...;base64,...`) — das, was ankommen muss. */
  bildQuellen: string[];
}

function bilderAus(html: string): { bildMarken: string[]; bildQuellen: string[] } {
  const bildMarken = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  return {
    bildMarken,
    bildQuellen: bildMarken.map((marke) => /src\s*=\s*"([^"]*)"/i.exec(marke)?.[1] ?? ""),
  };
}

/**
 * Die BESTANDSDATEI durch den produktiven Extraktor — ohne Bildbudget, damit nichts wegfällt.
 *
 * Ob und wie das FENSTER Bilder beschneidet, ist genau die Frage der Abnahme und darf nicht schon
 * in der Vorbereitung entschieden sein.
 */
export async function bilderDerBestandsdatei(): Promise<WordAuswahl> {
  const bytes = await readFile(join(process.cwd(), ECHTE_DATEI));
  const { html, text } = await extractDocxRich(alsPuffer(bytes));
  return { html, text, ...bilderAus(html) };
}

/**
 * Die Word-Markierung dieser Abnahme: echtes OOXML, echter Extraktor, echte Bilder.
 *
 * Die Bilder sind die der Bestandsdatei — ihre base64-Rümpfe werden aus deren Datenquellen
 * genommen, nicht neu erfunden. Fehlt dort ein Bild, bricht das hier laut ab: eine Auswahl ohne
 * Bilder wäre für diesen Job keine.
 */
export async function echteWordAuswahl(): Promise<WordAuswahl> {
  const bestand = await bilderDerBestandsdatei();
  const pngs = bestand.bildQuellen.map((quelle) => {
    const treffer = /^data:image\/[a-z+]+;base64,(.+)$/i.exec(quelle);
    if (!treffer?.[1]) {
      throw new Error(`${ECHTE_DATEI}: Bildquelle ohne base64-Rumpf — „${quelle.slice(0, 40)}…"`);
    }
    return treffer[1];
  });
  if (pngs.length === 0) {
    throw new Error(`${ECHTE_DATEI}: keine eingebetteten Bilder gefunden`);
  }
  const absaetze: Absatz[] = [
    { art: "ueberschrift", text: MARKIERTE_UEBERSCHRIFT },
    { art: "text", text: MARKIERTER_ABSATZ },
    ...pngs.map((png): Absatz => ({ art: "bild", png })),
  ];
  const gebaut = await baueDocx(absaetze);
  const { html, text } = await extractDocxRich(alsPuffer(gebaut.bytes));
  return { html, text, ...bilderAus(html) };
}

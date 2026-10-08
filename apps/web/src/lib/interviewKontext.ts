// ================================================================================================
// Aufnahme `gesamt-ocr` (FR-CAP-05) — DER ERKANNTE BILDTEXT ALS KONTEXT DES GEFÜHRTEN INTERVIEWS.
// ================================================================================================
//
// Historisches Abnahmekriterium: „OCR-Text fließt in Strukturierung/Interview ein." In die
// Strukturierung floss er schon (die Erkennung hängt ihn an den Rohtext). Das Interview bekam nur
// die Antworten. Jetzt reist der erkannte Text als Kontext mit.
//
// DIE ZUORDNUNG STEHT IM ROHTEXT SELBST (Bens Befunde, Nacharbeit 3). Die Erkennung — und nur sie,
// auf Klick — schreibt jeden Treffer als eigenen Abschnitt mit dem Kopf `[OCR: <Bildname>]`. Daraus
// folgt alles Weitere, ohne einen zweiten Zustand neben dem Text:
//
//   · Der Abschnitt reist mit dem Rohtext im vorhandenen Entwurfsweg und kommt beim Fortsetzen
//     zurück — damit auch seine Zuordnung. Eine Zuordnung nur im Sitzungszustand ging dort verloren.
//   · Kontext ist der AKTUELLE Inhalt des Abschnitts. Wer ein falsch erkanntes Zeichen korrigiert,
//     schickt die korrigierte Fassung; ein Vergleich mit dem Erkennungsergebnis warf bis hierher
//     schon bei einem geänderten Zeichen den ganzen Block hinaus.
//   · Erst wer den Abschnitt (Kopf oder ganzen Inhalt) entfernt, schließt ihn aus.
//   · Verwerfen oder ein anderer Entwurf leeren den Rohtext — und damit den Kontext.
//
// Ein Abschnitt endet an der nächsten Kopfzeile (`[OCR: …]`, `[Transkript: …]`, `[<Dateiname>]` —
// alle Einfügewege dieser Seite schreiben ihre Abschnitte so) oder am Textende. Was der Mensch
// unmittelbar unter einen erkannten Block tippt, gehört bis zur nächsten Kopfzeile mit dazu.

const OCR_KOPF = /^\[OCR: ([^\]\n]+)\]$/;
const IRGENDEIN_KOPF = /^\[[^\]\n]+\]$/;

/** Der Kopf eines erkannten Abschnitts — die eine Schreibweise für Erkennung und Kontext. */
export function ocrAbschnittKopf(bildname: string): string {
  return `[OCR: ${bildname}]`;
}

/** Ein erkannter Abschnitt im Rohtext, mit seinem aktuellen Inhalt. */
export interface OcrAbschnitt {
  readonly name: string;
  readonly text: string;
}

/** Die erkannten Abschnitte des Rohtextes in ihrer Reihenfolge, Inhalt wie er JETZT dasteht. */
export function ocrAbschnitte(raw: string): OcrAbschnitt[] {
  const abschnitte: OcrAbschnitt[] = [];
  let offen: { name: string; zeilen: string[] } | null = null;
  const schliessen = (): void => {
    if (offen) {
      abschnitte.push({ name: offen.name, text: offen.zeilen.join("\n").trim() });
      offen = null;
    }
  };
  for (const zeile of raw.split("\n")) {
    const kopf = OCR_KOPF.exec(zeile.trim());
    if (kopf) {
      schliessen();
      offen = { name: kopf[1] ?? "", zeilen: [] };
    } else if (IRGENDEIN_KOPF.test(zeile.trim())) {
      schliessen();
    } else if (offen) {
      offen.zeilen.push(zeile);
    }
  }
  schliessen();
  return abschnitte;
}

/** Der Kontext für das Interview — leer, wenn kein erkannter Abschnitt mit Inhalt mehr dasteht. */
export function interviewKontext(raw: string): string {
  return ocrAbschnitte(raw)
    .filter((a) => a.text.length > 0)
    .map((a) => `[${a.name}]\n${a.text}`)
    .join("\n\n");
}

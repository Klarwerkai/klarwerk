// ================================================================================================
// OCR-E04 · DER SEITENLESELAUF EINER PDF-DATEI — für die Eingänge außerhalb des Dateiimports.
// ================================================================================================
//
// Nacharbeit 8 (Ben): „Text aus Datei einfügen“, „Aus Dokument ergänzen“ (`BodyExtractPanel`) und
// „Fragen an ein Dokument“ lasen bei einer PDF nur die Textebene. Dieser Lauf bindet sie an den
// vorhandenen E04-Weg an — derselbe Kern (`lib/pdfScanSeiten.ts`), dieselbe Bildanalyse der Fläche,
// dieselbe Einstellung der Automatik (Setup › Klara) und dasselbe Seitenzeichnen über pdfjs wie
// der Dateiimport des Erfassens (`pages/Capture.tsx`, `leseDateiSeiten`).
//
// Die Datei und ihr Original bleiben unverändert; das Seitenbild entsteht nur im Speicher.
import { assistenzStand } from "./assistenzProfil";
import type { BildAnalyse, QuellenBefund } from "./bildAutomatik";
import { bildAutomatikAbwarten, bildAutomatikLage } from "./bildAutomatikEinstellung";
import { type PdfSeitenZeichner, pdfSeitenZeichner } from "./files";
import type { PdfDocumentText } from "./pdf";
import { lesePdfSeiten, pdfScanEingang, pdfSeitenText, pdfSeitenTexte } from "./pdfScanSeiten";

export interface PdfSeitenErgebnis {
  /** Der Lesestand je Seite (Status, Fehler, fehlende Seiten). */
  befund: QuellenBefund;
  /** Die ganze PDF in Seitenreihenfolge — Textebene und erkannter Rest, ohne Doppel. */
  text: string;
  /** Derselbe Text je Seite (Index 0 = Seite 1); nicht gelesene Seiten sind `""`. */
  seiten: string[];
}

/**
 * Ein Lauf, dessen Ergebnis nicht mehr gilt: das angemeldete Konto hat gewechselt (Nacharbeit 10)
 * oder der Aufrufer hat ihn abgebrochen. Der Aufrufer übernimmt dann NICHTS — weder Text noch Stand.
 */
export const LAUF_VERWORFEN = "verworfen" as const;

/**
 * Liest die Bild- und gemischten Seiten einer bereits geparsten PDF. `null`, wenn keine Seite
 * gelesen werden muss (reine Text-PDF — dann gilt die Textebene wie bisher).
 *
 * Nacharbeit 10 (Ben): der Lauf gehört dem Konto, unter dem er begann — derselbe Schutz wie im
 * Dateiimport (`Capture.tsx`, `leseDateiSeiten`). Wechselt das Konto, wird vor jeder weiteren Seite
 * abgebrochen, kein Zwischenstand mehr gemeldet und das Ergebnis als `LAUF_VERWORFEN` verworfen.
 */
export async function lesePdfDateiSeiten(
  datei: File,
  pdf: PdfDocumentText,
  optionen: {
    analyse: Pick<BildAnalyse, "befundFuerBild">;
    onFortschritt?: (stand: QuellenBefund) => void;
    /** Der Lauf ist überholt (andere Datei, Fläche verlassen) — vor der nächsten Seite geprüft. */
    abbrechen?: () => boolean;
  },
): Promise<PdfSeitenErgebnis | null | typeof LAUF_VERWORFEN> {
  const eingang = pdfScanEingang(datei.name, pdf);
  if (!eingang) {
    return null;
  }
  const kontoBeiStart = assistenzStand().kontoId;
  const gilt = (): boolean => {
    const kontoGleich = assistenzStand().kontoId === kontoBeiStart;
    return kontoGleich && optionen.abbrechen?.() !== true;
  };
  const lage = await bildAutomatikAbwarten();
  if (!gilt()) {
    return LAUF_VERWORFEN;
  }
  const offen: { zeichner: PdfSeitenZeichner | null } = { zeichner: null };
  try {
    const onFortschritt = optionen.onFortschritt;
    const befund = await lesePdfSeiten(eingang, {
      analyse: optionen.analyse,
      lage,
      zeichne: async (seite) => {
        offen.zeichner ??= await pdfSeitenZeichner(datei);
        return offen.zeichner.zeichne(seite);
      },
      automatikAus: () => bildAutomatikLage(assistenzStand()) === "aus",
      abbrechen: () => !gilt(),
      ...(onFortschritt
        ? {
            onFortschritt: (stand: QuellenBefund) => {
              if (gilt()) {
                onFortschritt(stand);
              }
            },
          }
        : {}),
    });
    if (!gilt()) {
      return LAUF_VERWORFEN;
    }
    return {
      befund,
      text: pdfSeitenText(befund),
      seiten: pdfSeitenTexte(befund, pdf.pageCount),
    };
  } finally {
    await offen.zeichner?.schliessen();
  }
}

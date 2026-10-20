// PP-04: E02 verwenden, keinen neuen Korrekturbestand anlegen. Nur das anfragende Konto lesen.
import type { BildKorrekturDienst } from "./assistenz-bildkorrekturen";
import { DatenFehler, type Erfassungsauftrag } from "./praesentation-daten";

export interface BildtextUebernahme {
  readonly rohText: string;
  /** Eingefrorener Übernahmestand, keine Aussage über spätere persönliche Berichtigungen. */
  readonly korrektur?: {
    readonly quelle: string;
    readonly geaendertAm: string;
    readonly text: string;
  };
}

export async function mitPowerPointBildquelle(
  auftrag: Erfassungsauftrag,
  kontoId: string,
  dienst: Pick<BildKorrekturDienst, "lies"> | undefined,
): Promise<Erfassungsauftrag> {
  const ocr = auftrag.ocr;
  const w = ocr?.wiederverwendung;
  if (!ocr || !w) return auftrag; // unveränderter PP-02-Vertrag
  if (!auftrag.ort || !dienst) {
    throw new DatenFehler(
      "ungueltig",
      "Der bestätigte Bildkorrekturstand ist nicht verfügbar; nichts erfasst.",
    );
  }
  const quelle = `office:${auftrag.ort.anhangId}`;
  const k = (await dienst.lies(kontoId)).eintraege.find(
    (e) => e.quelle === quelle && e.inhaltskennung === ocr.bildKennung,
  );
  if (
    (k?.geaendertAm ?? null) !== w.korrekturAm ||
    ocr.text.trim() !== (k?.text ?? w.rohText).trim()
  ) {
    throw new DatenFehler(
      "ungueltig",
      "Der Bildtext wurde inzwischen berichtigt. Den aktuellen Stand laden und erneut erfassen.",
    );
  }
  return {
    ...auftrag,
    ocr: {
      ...ocr,
      text: k?.text ?? w.rohText,
      uebernahme: {
        rohText: w.rohText,
        ...(k ? { korrektur: { quelle, geaendertAm: k.geaendertAm, text: k.text } } : {}),
      },
    },
  };
}

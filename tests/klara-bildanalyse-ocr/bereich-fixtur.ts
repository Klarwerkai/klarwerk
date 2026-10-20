// OCR-E06 · Kontrollierte Prüfeingaben für die Bereichsfrage: Bilder, deren Bytes eine Marke tragen
// (`deck.ts`), und je Marke die Lesung der Engine MIT Wortrahmen — bekannter Text an bekannter
// Stelle. So ist nachprüfbar, dass ein Bereich genau seinen Block liefert. Die Genauigkeit der echten
// Engine an echten Pixeln misst die Browserprobe (`tests-smoke/klara-bereichsfrage-browser.spec.ts`).
// Diese Datei ist kein Test.
import type { OcrResult, OcrWort } from "../../apps/web/src/lib/ocr";
import { markeAus } from "./deck";

/** Ein Wort mit Sicherheit und Rahmen `[x0, y0, x1, y1]` (Pixel im Original). */
function w(text: string, confidence: number, rahmen: readonly number[]): OcrWort {
  const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = rahmen;
  return { text, confidence, bbox: { x0, y0, x1, y1 } };
}

/** Das Bild mit mehreren Textblöcken — 1000 × 600 Pixel. */
export const MEHRBLOCK = { breite: 1000, hoehe: 600 } as const;

/**
 * Die Wörter in Lesereihenfolge der Engine:
 *   Block A oben          „RECHNUNG 2026-114“
 *   Block B Mitte         „SUMME 1.800 EUR“, rechts daneben „NOTIZ“ (über die Bereichskante
 *                         hinaus, Mitte außerhalb) und ein unleserliches „Xq7“
 *   Block C unten         „ZAHLBAR BIS 31.10.2026“ — das Datum absichtlich unsicher (45)
 *   Block D rechts        „PRUEFVERMERK“ — senkrecht gedrehter Text (hoher, schmaler Rahmen)
 */
export const MEHRBLOCK_WOERTER: OcrWort[] = [
  w("RECHNUNG", 95, [40, 40, 300, 80]),
  w("2026-114", 94, [320, 40, 520, 80]),
  w("SUMME", 93, [40, 260, 220, 310]),
  w("1.800", 91, [240, 260, 380, 310]),
  w("EUR", 90, [400, 260, 500, 310]),
  w("NOTIZ", 92, [560, 260, 700, 310]),
  w("Xq7", 12, [720, 262, 830, 302]),
  w("ZAHLBAR", 92, [40, 500, 260, 540]),
  w("BIS", 90, [280, 500, 360, 540]),
  w("31.10.2026", 45, [380, 500, 640, 540]),
  w("PRUEFVERMERK", 88, [900, 100, 950, 500]),
];

export const MEHRBLOCK_TEXT =
  "RECHNUNG 2026-114\nSUMME 1.800 EUR NOTIZ Xq7\nZAHLBAR BIS 31.10.2026\nPRUEFVERMERK";

/** Derselbe Text, wie der Befund ihn kennzeichnet. */
export const MEHRBLOCK_GEKENNZEICHNET =
  "RECHNUNG 2026-114\nSUMME 1.800 EUR NOTIZ [unleserlich]\nZAHLBAR BIS [?31.10.2026]\nPRUEFVERMERK";

/** Bereiche (Pixel im Original) und was in ihnen — und nur in ihnen — steht. */
export const BEREICH = {
  /** Block B; „NOTIZ“ ragt hinein, seine Mitte (630) liegt aber außerhalb. */
  summe: { x0: 20, y0: 240, x1: 600, y1: 330 },
  datum: { x0: 20, y0: 480, x1: 700, y1: 560 },
  gedreht: { x0: 880, y0: 80, x1: 980, y1: 520 },
  unleserlich: { x0: 710, y0: 250, x1: 860, y1: 310 },
  leer: { x0: 600, y0: 350, x1: 880, y1: 470 },
} as const;

export const LESUNG_JE_MARKE: Record<string, OcrResult> = {
  MB: { status: "success", text: MEHRBLOCK_TEXT, woerter: MEHRBLOCK_WOERTER },
  LS: {
    status: "success",
    text: "LIEFERSCHEIN 77",
    woerter: [w("LIEFERSCHEIN", 96, [30, 30, 400, 90]), w("77", 96, [420, 30, 480, 90])],
  },
  // Die Engine liefert Text, aber keine Wortrahmen.
  OR: { status: "success", text: "OHNE RAHMEN" },
  // Ein Bild ohne Text.
  LE: { status: "success", text: "" },
};

const NICHT_LESBAR: OcrResult = { status: "failed", text: "", error: "nicht-lesbar" };

/** Die Erkennung für die Markenbilder; unbekannte Bilder gelten als nicht lesbar. */
export async function bereichsEngine(src: unknown): Promise<OcrResult> {
  const marke = markeAus(String(src));
  return (marke ? LESUNG_JE_MARKE[marke] : undefined) ?? NICHT_LESBAR;
}

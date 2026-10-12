// DOM-freier OCR-Adapter (SCRUM-123).
// Recognizer wird injiziert → in Node mit Stub testbar, kein tesseract-Import hier.
// Die echte tesseract.js-Engine (lazy, Worker/WASM) wird im Browser-Wrapper `files.ts` gebaut.

export type OcrStatus = "running" | "success" | "failed" | "unavailable";

/** Ein erkanntes Wort mit der Sicherheit der Engine (0–100), wie tesseract.js 5 es liefert. */
export interface OcrWort {
  text: string;
  confidence: number;
}

export interface OcrResult {
  status: OcrStatus;
  text: string;
  error?: string;
  // OCR-02 (Klara-Bildanalyse): die Wörter mit ihrer Sicherheit — Grundlage, um unsichere und
  // unleserliche Stellen zu kennzeichnen, statt sie still als gelesen auszugeben.
  woerter?: OcrWort[];
}

export interface OcrRecognizer {
  recognize(input: unknown): Promise<{ data: { text: string; words?: OcrWort[] } }>;
}

// SCRUM-123: Bild → Text. Kein Recognizer (Engine nicht ladbar) → ehrlich „unavailable".
// Fehler bei der Erkennung → „failed" (keine Fake-OCR). Erfolg → „success" + getrimmter Text.
export async function recognizeImage(
  input: unknown,
  recognizer: OcrRecognizer | null,
): Promise<OcrResult> {
  if (!recognizer) {
    return { status: "unavailable", text: "" };
  }
  try {
    const result = await recognizer.recognize(input);
    const woerter = (result.data.words ?? []).map((w) => ({
      text: w.text,
      confidence: w.confidence,
    }));
    return {
      status: "success",
      text: (result.data.text ?? "").trim(),
      ...(woerter.length > 0 ? { woerter } : {}),
    };
  } catch (error) {
    return {
      status: "failed",
      text: "",
      error: error instanceof Error ? error.message : "ocr-error",
    };
  }
}

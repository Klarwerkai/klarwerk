// DOM-freier OCR-Adapter (SCRUM-123).
// Recognizer wird injiziert → in Node mit Stub testbar, kein tesseract-Import hier.
// Die echte tesseract.js-Engine (lazy, Worker/WASM) wird im Browser-Wrapper `files.ts` gebaut.

export type OcrStatus = "running" | "success" | "failed" | "unavailable";

export interface OcrResult {
  status: OcrStatus;
  text: string;
  error?: string;
}

export interface OcrRecognizer {
  recognize(input: unknown): Promise<{ data: { text: string } }>;
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
    return { status: "success", text: (result.data.text ?? "").trim() };
  } catch (error) {
    return {
      status: "failed",
      text: "",
      error: error instanceof Error ? error.message : "ocr-error",
    };
  }
}

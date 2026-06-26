import { describe, expect, it } from "vitest";
import { type OcrRecognizer, recognizeImage } from "../../apps/web/src/lib/ocr";

describe("SCRUM-123: OCR-Adapter (injizierter Recognizer)", () => {
  it("success: liefert getrimmten Text", async () => {
    const recognizer: OcrRecognizer = {
      recognize: () => Promise.resolve({ data: { text: "  Druckabfall an P2  " } }),
    };
    const res = await recognizeImage("blob", recognizer);
    expect(res.status).toBe("success");
    expect(res.text).toBe("Druckabfall an P2");
  });

  it("failed: Erkennungsfehler → keine Fake-OCR", async () => {
    const recognizer: OcrRecognizer = {
      recognize: () => Promise.reject(new Error("worker-crash")),
    };
    const res = await recognizeImage("blob", recognizer);
    expect(res.status).toBe("failed");
    expect(res.text).toBe("");
    expect(res.error).toBe("worker-crash");
  });

  it("unavailable: kein Recognizer (Engine nicht ladbar) → ehrlich gemeldet", async () => {
    const res = await recognizeImage("blob", null);
    expect(res.status).toBe("unavailable");
    expect(res.text).toBe("");
  });
});

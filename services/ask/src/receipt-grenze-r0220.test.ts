// R-0220 / R-0306 — DIE QUITTUNG HAT EINE KLARE GRENZE, UND BIS DORTHIN TRÄGT SIE.
//
// Die Quittung über die zitierten Quellen ist bewusst kurzlebig und speicherlos (HMAC über Nutzer,
// Quellen und Ablauf, `receipt.ts`). Gemessen wird hier die GRENZE selbst: bis einschließlich des
// Ablaufzeitpunkts gültig, eine Millisekunde danach nicht mehr — und eine veränderte Quittung nie.
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ANSWER_RECEIPT_TTL_MS, signAnswerReceipt, verifyAnswerReceipt } from "./receipt";

const SECRET = randomBytes(32);
const T0 = Date.parse("2026-10-01T08:00:00.000Z");

describe("R-0220 · Quittungskette: gültig oder abgelaufen", () => {
  it("die Grenze liegt genau bei Ausstellung + 30 Minuten", () => {
    expect(ANSWER_RECEIPT_TTL_MS).toBe(30 * 60 * 1000);
    const quittung = signAnswerReceipt(SECRET, "u1", ["ko-b", "ko-a", "ko-a"], T0);

    // Bis zur Grenze trägt die Kette durchgehend: Ausstellung, Mitte, letzter Augenblick.
    for (const jetzt of [T0, T0 + ANSWER_RECEIPT_TTL_MS / 2, T0 + ANSWER_RECEIPT_TTL_MS]) {
      expect(verifyAnswerReceipt(SECRET, quittung, jetzt)).toEqual({
        userId: "u1",
        sources: ["ko-a", "ko-b"],
      });
    }
    // Danach ist sie abgelaufen — ohne Übergangszone.
    expect(verifyAnswerReceipt(SECRET, quittung, T0 + ANSWER_RECEIPT_TTL_MS + 1)).toBeNull();
  });

  it("eine veränderte oder fremd signierte Quittung trägt auch vor der Grenze nicht", () => {
    const quittung = signAnswerReceipt(SECRET, "u1", ["ko-a"], T0);
    const [koerper, signatur] = quittung.split(".");
    const verlaengert = Buffer.from(
      JSON.stringify({ u: "u1", s: ["ko-a"], x: T0 + 10 * ANSWER_RECEIPT_TTL_MS }),
      "utf8",
    ).toString("base64url");
    expect(verifyAnswerReceipt(SECRET, `${verlaengert}.${signatur}`, T0)).toBeNull();
    expect(verifyAnswerReceipt(randomBytes(32), quittung, T0)).toBeNull();
    expect(verifyAnswerReceipt(SECRET, `${koerper}.`, T0)).toBeNull();
  });
});

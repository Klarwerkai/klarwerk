import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  MIN_RECEIPT_SECRET_BYTES,
  ReceiptSecretError,
  parseConfiguredReceiptSecret,
  signAnswerReceipt,
  verifyAnswerReceipt,
} from "./receipt";

// 32 verschiedene Bytes (00…1f) als 64 Hex-Ziffern — gültig UND nicht repetitiv.
const VARIED_HEX = Buffer.from(Array.from({ length: 32 }, (_, i) => i)).toString("hex");

// FUNKE-FIX2 P0 (bens Blocker 2): ein per ENV gesetztes Receipt-Secret wird nicht mehr ungeprüft
// übernommen — zu kurzes/schwaches Schlüsselmaterial führt zu einem ehrlichen Start-Fehler.
describe("FUNKE-FIX2 P0 (bens Blocker 2): parseConfiguredReceiptSecret", () => {
  it("akzeptiert 32-Byte-Hex (64 Ziffern) und dekodiert es korrekt", () => {
    const buf = parseConfiguredReceiptSecret(VARIED_HEX);
    expect(buf.length).toBe(32);
    expect(buf.equals(Buffer.from(VARIED_HEX, "hex"))).toBe(true);
  });

  it("akzeptiert Base64 von randomBytes(32)", () => {
    const raw = randomBytes(32);
    const buf = parseConfiguredReceiptSecret(raw.toString("base64"));
    expect(buf.length).toBeGreaterThanOrEqual(MIN_RECEIPT_SECRET_BYTES);
    expect(buf.equals(raw)).toBe(true);
  });

  it("akzeptiert eine lange UTF-8-Passphrase (≥ 32 Bytes, nicht Hex-/Base64-förmig)", () => {
    const passphrase = "correct-horse-battery-staple-plus-extra-length!!";
    expect(passphrase.length).toBeGreaterThanOrEqual(32);
    const buf = parseConfiguredReceiptSecret(passphrase);
    expect(buf.equals(Buffer.from(passphrase, "utf8"))).toBe(true);
  });

  it("lehnt zu kurzes Hex ab (Start-Fehler statt stiller Übernahme)", () => {
    // 8 Hex-Ziffern = 4 Byte (und als UTF-8 nur 8 Byte) → in JEDER Deutung < 32 Byte → verworfen.
    expect(() => parseConfiguredReceiptSecret("abcd1234")).toThrow(ReceiptSecretError);
  });

  it("lehnt eine kurze Passphrase ab (< 32 Bytes)", () => {
    expect(() => parseConfiguredReceiptSecret("zu-kurz")).toThrow(/mindestens 32/i);
  });

  it("lehnt einen leeren Wert ab", () => {
    expect(() => parseConfiguredReceiptSecret("   ")).toThrow(ReceiptSecretError);
  });

  it("das akzeptierte Secret verifiziert einen damit signierten Beleg (Round-Trip)", () => {
    const secret = parseConfiguredReceiptSecret(VARIED_HEX);
    const now = Date.parse("2026-07-24T12:00:00.000Z");
    const token = signAnswerReceipt(secret, "vera", ["ko-1"], now);
    expect(verifyAnswerReceipt(secret, token, now)).toEqual({ userId: "vera", sources: ["ko-1"] });
  });
});

// FUNKE-FIX3 Security (bens Blocker Receipt): das Encoding ist EINDEUTIG — erkennbares Hex/Base64,
// das zu < 32 Bytes dekodiert, ist ein Start-Fehler und wird NICHT als UTF-8 neu interpretiert.
// Offensichtlich repetitive Werte werden abgefangen (ehrlich: das ist KEIN Entropie-Nachweis).
describe("FUNKE-FIX3 Security (bens Blocker Receipt): eindeutiges Encoding, kein UTF-8-Rückfall", () => {
  it('"0".repeat(32) — erkennbares Hex, dekodiert 16 Bytes → Start-Fehler (NICHT als 32 UTF-8-Bytes)', () => {
    expect(() => parseConfiguredReceiptSecret("0".repeat(32))).toThrow(ReceiptSecretError);
    expect(() => parseConfiguredReceiptSecret("0".repeat(32))).toThrow(/hex/i);
  });

  it("32 Zeichen erkennbares Base64 (dekodiert 24 Bytes) → Start-Fehler (kein UTF-8-Rückfall)", () => {
    const b64 = Buffer.from("ABCDEFGHIJKLMNOPQRSTUVWX", "utf8").toString("base64");
    expect(b64).toHaveLength(32);
    expect(() => parseConfiguredReceiptSecret(b64)).toThrow(ReceiptSecretError);
    expect(() => parseConfiguredReceiptSecret(b64)).toThrow(/base64/i);
  });

  it("trivial repetitiver Wert → Start-Fehler (Länge ersetzt keine Zufälligkeit)", () => {
    // 64× "a" wäre gültiges 32-Byte-Hex (0xaa…aa) — nur EIN Byte-Wert → abgewiesen.
    expect(() => parseConfiguredReceiptSecret("a".repeat(64))).toThrow(/repetitiv/i);
    // Auch auf dem UTF-8-Weg (kein Hex/Base64-Alphabet): 40× "!" → abgewiesen.
    expect(() => parseConfiguredReceiptSecret("!".repeat(40))).toThrow(/repetitiv/i);
  });

  it("`hex:`-Präfix erzwingt die Hex-Deutung (gültig ≥ 32 Bytes; kaputt/zu kurz → Fehler)", () => {
    const buf = parseConfiguredReceiptSecret(`hex:${VARIED_HEX}`);
    expect(buf.equals(Buffer.from(VARIED_HEX, "hex"))).toBe(true);
    expect(() => parseConfiguredReceiptSecret("hex:zz")).toThrow(ReceiptSecretError);
    expect(() => parseConfiguredReceiptSecret(`hex:${"0".repeat(32)}`)).toThrow(ReceiptSecretError);
  });

  it("`base64:`- und `utf8:`-Präfix erzwingen genau EINE Deutung", () => {
    const raw = randomBytes(32);
    expect(parseConfiguredReceiptSecret(`base64:${raw.toString("base64")}`).equals(raw)).toBe(true);
    // Eine Passphrase, die OHNE Präfix als Base64 gedeutet (und zu kurz) wäre, ist mit `utf8:`
    // ausdrücklich als rohe Bytes gesetzt — ohne Entropie-Behauptung.
    const passphrase = "correcthorsebatterystaplecorrecthorse";
    expect(() => parseConfiguredReceiptSecret(passphrase)).toThrow(/base64/i);
    const viaPrefix = parseConfiguredReceiptSecret(`utf8:${passphrase}`);
    expect(viaPrefix.equals(Buffer.from(passphrase, "utf8"))).toBe(true);
  });

  it("ein gültiges ≥ 32-Byte-Secret (Base64 von randomBytes) bleibt akzeptiert", () => {
    const raw = randomBytes(48);
    expect(parseConfiguredReceiptSecret(raw.toString("base64")).equals(raw)).toBe(true);
  });
});

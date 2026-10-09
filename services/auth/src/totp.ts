import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// R-0562 (Aufnahme 20260922 · gesamt-zweifaktor): DER ZWEITE FAKTOR, OHNE FIRMEN-ANMELDEDIENST.
//
// Zeitbasierte Einmalcodes nach RFC 6238 (TOTP, HMAC-SHA1, 6 Stellen, 30 s) — das Verfahren, das
// jede verbreitete Authenticator-App auf einem zweiten Gerät beherrscht (Microsoft/Google
// Authenticator, 1Password, FreeOTP …). Der Server und das zweite Gerät teilen EIN Geheimnis;
// danach braucht keine Seite eine Verbindung zur anderen und kein Dritter ist beteiligt.
//
// Bewusst nur `node:crypto` und keine Bibliothek: das Verfahren sind zwanzig Zeilen, und eine
// Abhängigkeit im Anmeldeweg wäre eine zusätzliche Lieferkette für genau den Pfad, der schützen soll.

export const TOTP_STELLEN = 6;
export const TOTP_SCHRITT_S = 30;
// Ein Schritt Nachsicht in jede Richtung: die Uhr des zweiten Geräts darf bis zu 30 s abweichen,
// und wer den Code in der letzten Sekunde abtippt, wird nicht abgewiesen. Mehr Nachsicht hiesse
// mehr gültige Codes zur selben Zeit — also mehr Treffer für jemanden, der rät.
const NACHSICHT_SCHRITTE = 1;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Kodieren(daten: Buffer): string {
  let bits = 0;
  let wert = 0;
  let aus = "";
  for (const byte of daten) {
    wert = (wert << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      aus += BASE32.charAt((wert >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) {
    aus += BASE32.charAt((wert << (5 - bits)) & 31);
  }
  return aus;
}

export function base32Dekodieren(text: string): Buffer {
  const rein = text.replace(/[\s=]/g, "").toUpperCase();
  let bits = 0;
  let wert = 0;
  const bytes: number[] = [];
  for (const zeichen of rein) {
    const index = BASE32.indexOf(zeichen);
    if (index < 0) {
      throw new Error("Ungültiges Base32-Zeichen.");
    }
    wert = (wert << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((wert >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160 bit Zufall — die Länge, die RFC 4226 für HMAC-SHA1 empfiehlt. */
export function neuesTotpGeheimnis(): string {
  return base32Kodieren(randomBytes(20));
}

export function totpSchritt(jetztMs: number): number {
  return Math.floor(jetztMs / 1000 / TOTP_SCHRITT_S);
}

/** Der Code eines Zeitschritts (RFC 4226 §5.3, dynamische Kürzung). */
export function totpCode(geheimnis: string, schritt: number): string {
  const zaehler = Buffer.alloc(8);
  zaehler.writeBigUInt64BE(BigInt(schritt));
  const hmac = createHmac("sha1", base32Dekodieren(geheimnis)).update(zaehler).digest();
  const versatz = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const zahl = hmac.readUInt32BE(versatz) & 0x7fffffff;
  return String(zahl % 10 ** TOTP_STELLEN).padStart(TOTP_STELLEN, "0");
}

/**
 * Prüft einen eingegebenen Code und liefert den Zeitschritt, zu dem er passt — oder `undefined`.
 *
 * Der SCHRITT kommt zurück und nicht nur ein Ja, weil erst er die Wiederverwendung ausschliesst:
 * der Dienst merkt sich je Konto den zuletzt verbrauchten Schritt, und ein Code, der einmal eine
 * Anmeldung getragen hat, trägt keine zweite (s. `SecondFactorRepo.claimStep`).
 */
export function pruefeTotp(
  geheimnis: string,
  eingabe: string,
  jetztMs: number,
): number | undefined {
  const code = eingabe.replace(/\s/g, "");
  if (!new RegExp(`^\\d{${TOTP_STELLEN}}$`).test(code)) {
    return undefined;
  }
  const mitte = totpSchritt(jetztMs);
  let treffer: number | undefined;
  // Alle Kandidaten werden verglichen, auch nach einem Treffer — die Laufzeit verrät nicht, in
  // welchem Fenster ein Code lag.
  for (let d = -NACHSICHT_SCHRITTE; d <= NACHSICHT_SCHRITTE; d += 1) {
    const erwartet = Buffer.from(totpCode(geheimnis, mitte + d));
    if (timingSafeEqual(erwartet, Buffer.from(code)) && treffer === undefined) {
      treffer = mitte + d;
    }
  }
  return treffer;
}

/**
 * Die Einrichtungsadresse, die eine Authenticator-App als QR-Code oder Link liest
 * (Key-Uri-Format `otpauth://totp/…`). Aussteller und Konto stehen URL-kodiert darin.
 */
export function otpauthAdresse(aussteller: string, konto: string, geheimnis: string): string {
  const etikett = `${encodeURIComponent(aussteller)}:${encodeURIComponent(konto)}`;
  const parameter = new URLSearchParams({
    secret: geheimnis,
    issuer: aussteller,
    algorithm: "SHA1",
    digits: String(TOTP_STELLEN),
    period: String(TOTP_SCHRITT_S),
  });
  return `otpauth://totp/${etikett}?${parameter.toString()}`;
}

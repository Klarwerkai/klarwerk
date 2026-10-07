// ================================================================================================
// R-1647 / R-2174 (aufnahme:20260922:gesamt-anlagenzugang) — DER QR-KODIERER, UNABHÄNGIG GELESEN.
// ================================================================================================
//
// Gemessen wird `apps/web/src/lib/qrCode.ts` mit dem Leser aus `./qr-leser.ts`, der keinen Code mit
// ihm teilt und sich auf die Tabellen des Standards stützt (Formatprüfsumme, Reed-Solomon-Syndrome,
// Byte-Dekodierung). Was der Leser zurückgibt, ist das, was ein Scanner am Etikett lesen würde.
//   Q1  Typische Anlagenadressen kommen Byte für Byte zurück — auch mit Umlauten und Leerzeichen.
//   Q2  Die Versionswahl ist die kleinste passende, die Zählerbreite wechselt an Version 10.
//   Q3  Zu lange Inhalte werden abgelehnt, nicht abgeschnitten.
//   Q4  Der SVG-Pfad trägt genau die dunklen Module (rückgelesen ergibt er denselben Inhalt).
import { describe, expect, it } from "vitest";
import { anlagenAdresse } from "../../apps/web/src/lib/anlagenzugang";
import { QR_RUHEZONE, QrZuLangFehler, qrMatrix, qrSvgPfad } from "../../apps/web/src/lib/qrCode";
import { leseQr, matrixAusPfad } from "./qr-leser";

const URSPRUNG = "https://klarwerk.example.de";

describe("Anlagenzugang · QR-Kodierer", () => {
  it("Q1 · Anlagenadressen kommen unverändert zurück", () => {
    for (const kennung of [
      "DP-4",
      "Linie L4 / Dosierstation DP-4",
      "Fräse 7 – Spindel Ø 40",
      "ANL-01",
    ]) {
      const adresse = anlagenAdresse(URSPRUNG, kennung);
      const gelesen = leseQr(qrMatrix(adresse));
      expect(gelesen.text, `Kennung „${kennung}“`).toBe(adresse);
    }
  });

  it("Q2 · kleinste passende Version; ab Version 10 trägt der Zähler 16 Bit", () => {
    expect(leseQr(qrMatrix("A")).version).toBe(1);
    // Version 9-M: 182 Datenwörter → 4 + 8 + 8·180 = 1452 ≤ 1456 Bit; 181 Byte passen nicht mehr.
    const neun = "x".repeat(180);
    const zehn = "x".repeat(181);
    expect(leseQr(qrMatrix(neun))).toMatchObject({ version: 9, text: neun });
    expect(leseQr(qrMatrix(zehn))).toMatchObject({ version: 10, text: zehn });
    // Jede Zwischengröße liest sich zurück — das deckt alle Blockaufteilungen von 1 bis 10 ab.
    for (let laenge = 1; laenge <= 213; laenge += 7) {
      const text = "k".repeat(laenge);
      expect(leseQr(qrMatrix(text)).text, `${laenge} Byte`).toBe(text);
    }
  });

  it("Q3 · zu lange Inhalte werden abgelehnt, nicht abgeschnitten", () => {
    const maximal = "y".repeat(213);
    expect(leseQr(qrMatrix(maximal)).text).toBe(maximal);
    expect(() => qrMatrix("y".repeat(214))).toThrow(QrZuLangFehler);
    // Mehrbytezeichen zählen als Bytes, nicht als Zeichen: 107 × „ä" = 214 Byte.
    expect(() => qrMatrix("ä".repeat(107))).toThrow(QrZuLangFehler);
  });

  it("Q4 · der SVG-Pfad trägt genau die dunklen Module", () => {
    const adresse = anlagenAdresse(URSPRUNG, "Linie L4 / Dosierstation DP-4");
    const matrix = qrMatrix(adresse);
    const seite = matrix.length + 2 * QR_RUHEZONE;
    const zurueck = matrixAusPfad(qrSvgPfad(matrix), seite, QR_RUHEZONE);
    expect(zurueck).toEqual(matrix);
    expect(leseQr(zurueck).text).toBe(adresse);
  });
});

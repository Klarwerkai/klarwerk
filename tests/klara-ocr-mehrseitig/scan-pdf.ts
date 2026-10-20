// ================================================================================================
// OCR-E04 · KONTROLLIERTE PDF MIT BEKANNTEM INHALT — Textseiten, gescannte Seiten, gemischte Seiten.
// ================================================================================================
//
// Eine minimale, gültige PDF 1.4, Byte für Byte gebaut (Querverweistabelle mit echten Versätzen).
// Eine Seite trägt Textzeilen in der Textebene (Helvetica) und/oder ein Bild, das die ganze Breite
// einnimmt. Das Bild ist entweder ein JPEG (`DCTDecode`, im Browser gezeichnet — echter Scan-Ersatz
// für die Browserprobe) oder ein kleines Graustufenraster (für die Node-Prüfung an der echten
// pdfjs-Engine, wo nur zählt, DASS die Seite ein Bild zeichnet).
//
// Fiktive Inhalte, keine Kundendaten.

export interface ScanBild {
  breite: number;
  hoehe: number;
  /** `jpeg`: JPEG-Bytes (DeviceRGB); `grau`: rohe 8-bit-Graustufen, breite × hoehe Bytes. */
  art: "jpeg" | "grau";
  daten: Uint8Array;
}

export interface ScanSeite {
  /** Zeilen der Textebene (nur ASCII, ohne Klammern und Backslash). */
  text?: readonly string[];
  bild?: ScanBild;
}

/** Ein kleines Graustufenbild — sein Inhalt ist gleichgültig, es muss nur gezeichnet werden. */
export function grauBild(wert = 0x80): ScanBild {
  return { breite: 8, hoehe: 8, art: "grau", daten: new Uint8Array(64).fill(wert) };
}

const latin1 = (s: string): Buffer => Buffer.from(s, "latin1");

function inhalt(seite: ScanSeite): string {
  const teile: string[] = [];
  if (seite.bild) {
    // Das Bild füllt die Seite unterhalb des Kopfes: 540 pt breit, im Seitenverhältnis des Bildes.
    const hoehe = Math.round((540 * seite.bild.hoehe) / seite.bild.breite);
    teile.push(`q 540 0 0 ${hoehe} 36 ${Math.max(36, 600 - hoehe)} cm /Im1 Do Q`);
  }
  if (seite.text && seite.text.length > 0) {
    const zeilen = seite.text.map((z, i) => (i === 0 ? `(${z}) Tj` : `0 -22 Td (${z}) Tj`));
    teile.push(`BT /F1 16 Tf 54 740 Td ${zeilen.join(" ")} ET`);
  }
  return teile.join("\n");
}

/** Die PDF als Bytes. */
export function scanPdf(seiten: readonly ScanSeite[]): Buffer {
  const objekte: Buffer[] = [];
  const neu = (koerper: Buffer): number => {
    objekte.push(koerper);
    return objekte.length;
  };
  // 1 Katalog, 2 Seitenbaum, 3 Schrift — die Seiten folgen.
  neu(latin1("<< /Type /Catalog /Pages 2 0 R >>"));
  neu(Buffer.alloc(0));
  const schrift = neu(latin1("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"));
  const kinder: number[] = [];
  for (const seite of seiten) {
    let bildNr: number | null = null;
    if (seite.bild) {
      const b = seite.bild;
      const kopf =
        b.art === "jpeg"
          ? `<< /Type /XObject /Subtype /Image /Width ${b.breite} /Height ${b.hoehe} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${b.daten.length} >>`
          : `<< /Type /XObject /Subtype /Image /Width ${b.breite} /Height ${b.hoehe} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${b.daten.length} >>`;
      bildNr = neu(
        Buffer.concat([latin1(`${kopf}\nstream\n`), Buffer.from(b.daten), latin1("\nendstream")]),
      );
    }
    const strom = latin1(inhalt(seite));
    const inhaltNr = neu(
      Buffer.concat([
        latin1(`<< /Length ${strom.length} >>\nstream\n`),
        strom,
        latin1("\nendstream"),
      ]),
    );
    const bilder = bildNr !== null ? ` /XObject << /Im1 ${bildNr} 0 R >>` : "";
    kinder.push(
      neu(
        latin1(
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${schrift} 0 R >>${bilder} >> /Contents ${inhaltNr} 0 R >>`,
        ),
      ),
    );
  }
  objekte[1] = latin1(
    `<< /Type /Pages /Kids [${kinder.map((k) => `${k} 0 R`).join(" ")}] /Count ${kinder.length} >>`,
  );
  const teile: Buffer[] = [latin1("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")];
  const versaetze: number[] = [];
  let laenge = teile[0]?.length ?? 0;
  objekte.forEach((koerper, i) => {
    versaetze.push(laenge);
    const obj = Buffer.concat([latin1(`${i + 1} 0 obj\n`), koerper, latin1("\nendobj\n")]);
    teile.push(obj);
    laenge += obj.length;
  });
  const xref = [
    "xref",
    `0 ${objekte.length + 1}`,
    "0000000000 65535 f ",
    ...versaetze.map((v) => `${String(v).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objekte.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(laenge),
    "%%EOF",
    "",
  ].join("\n");
  teile.push(latin1(xref));
  return Buffer.concat(teile);
}

// ================================================================================================
// JOB 4304 · DIE BILDQUELLE — EIN ORIGINAL, DAS MAN SIEHT, UND NICHT EINES, DAS MAN HERUNTERLÄDT.
// ================================================================================================
//
// WOZU ES DIESE DATEI GIBT, wörtlich aus dem Prüfurteil von JOB 4281
// (`archiv/4281/runde-2/ben.md`, Punkt 6): „Der Downloadnachweis deckt die Textdatei ab; eine inline
// dargestellte Bilddatei fehlt. Testvorschlag: Bildoriginal anklicken und Inhalt der Zielansicht
// prüfen."
//
// DAS IST KEINE SPIELART DESSELBEN WEGES, SONDERN DER ANDERE ZWEIG DES PRODUKTS. Die Rohbyteroute
// entscheidet an einer Allowlist, was sie tut (`services/app/src/routes/object-routes.ts:42-47`,
// `:342-352`): `image/png`, `image/jpeg`, `image/gif` und `image/webp` gehen mit ihrem echten Typ
// und `Content-Disposition: inline` hinaus — ALLES andere wird zu `application/octet-stream` mit
// `attachment`. Die Textdatei des bisherigen Nachweises fällt in den zweiten Zweig; ein Klick auf
// sie löst einen DOWNLOAD aus. Ein Bild fällt in den ersten; ein Klick öffnet ein FENSTER, in dem
// das Bild steht. Bis zu diesem Auftrag hat kein Fall den ersten Zweig je betreten.
//
// ================================================================================================
// WARUM DAS BILD HIER ERZEUGT UND NICHT MITGELIEFERT WIRD
// ================================================================================================
//
// Der Auftrag verlangt „kein Kundenmaterial, keine Netzabhängigkeit" und einen „bekannten,
// prüfbaren Inhalt". Beides ist am sichersten erfüllt, wenn die Bildpunkte als ZAHLEN dastehen und
// die Datei daraus gebaut wird: dann gibt es genau EINE Wahrheit über den erwarteten Inhalt
// (`BILD_PIXEL`), und der Vergleich im Browser läuft gegen sie und nicht gegen eine zweite
// Abschrift. Eine eingecheckte Binärdatei hätte dagegen einen Inhalt, den niemand liest.
//
// PNG WIRD VON HAND GESCHRIEBEN, weil das Haus keinen Bildkodierer hat und dieser Auftrag keinen
// einführen darf. Das Format ist an dieser Stelle klein: Signatur, IHDR, ein IDAT mit
// zlib-komprimierten Zeilen (Filter „None"), IEND. `node:zlib` liefert die Kompression, die
// CRC-32-Prüfsummen rechnet die Tabelle unten.
//
// KEINE FARBPROFIL-CHUNKS (kein `iCCP`, kein `gAMA`, kein `cHRM`): ein Bild ohne Profil behandelt
// Chromium als sRGB, und die Leinwand, gegen die der Fachlauf misst, ist ebenfalls sRGB. Damit ist
// die Abbildung Byte für Byte die Identität, und ein Vergleich auf exakte Gleichheit ist zulässig.
// Mit einem eingebetteten Profil wäre er es nicht — dann verglichen wir eine Farbumrechnung.
import { deflateSync } from "node:zlib";
import { expect } from "vitest";

import type { App, Konto } from "../klara-quellen-nutzerweg/kette";

export const BILDNAME = "pruefbild-xq42-4304.png";
export const BILD_MIME = "image/png";
/** Die Bezeichnung der Quelle — eine andere als die der Textquelle, damit beide unterscheidbar sind. */
export const QUELLE_BILD = "Prüfbild XQ42 (Abschnitt 4)";

export const BILD_BREITE = 4;
export const BILD_HOEHE = 3;

/**
 * Der Inhalt des Bildes, als Bildpunkte — die EINE Wahrheit dieses Nachweises.
 *
 * Vier mal drei Punkte, jeder ein anderer: die sechs Vollfarben zuerst, danach sechs abgestufte
 * Grauwerte und Mischungen. Kein Punkt wiederholt sich, keine Zeile gleicht der anderen — damit
 * fällt jede Verschiebung, jede Spiegelung und jede vertauschte Farbreihenfolge (RGB gegen BGR)
 * beim Vergleich auf. Ein einfarbiges Bild wäre gegen all das blind.
 */
export const BILD_PIXEL: readonly (readonly [number, number, number])[] = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 0],
  [0, 255, 255],
  [255, 0, 255],
  [17, 34, 51],
  [68, 85, 102],
  [119, 136, 153],
  [170, 187, 204],
  [221, 238, 255],
  [7, 11, 13],
];

// ------------------------------------------------------------------------------------------------
// PNG — Signatur, drei Blöcke, CRC-32.
// ------------------------------------------------------------------------------------------------

const CRC_TABELLE: Uint32Array = (() => {
  const tabelle = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabelle[n] = c >>> 0;
  }
  return tabelle;
})();

function crc32(daten: Buffer): number {
  let c = 0xffffffff;
  for (const byte of daten) {
    c = (CRC_TABELLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function block(typ: string, daten: Buffer): Buffer {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length, 0);
  const kopf = Buffer.from(typ, "ascii");
  const pruefsumme = Buffer.alloc(4);
  pruefsumme.writeUInt32BE(crc32(Buffer.concat([kopf, daten])), 0);
  return Buffer.concat([laenge, kopf, daten, pruefsumme]);
}

/**
 * Die Bytes des Prüfbildes — deterministisch aus `BILD_PIXEL`.
 *
 * Farbtyp 2 (Echtfarbe RGB, 8 Bit) und NICHT 6 (RGBA): ohne Alphakanal gibt es keine
 * Vormultiplikation und damit keine Rundung, die einen exakten Bildpunktvergleich später zu einer
 * Toleranzfrage machen würde. Die Leinwand liefert für ein deckendes Bild Alpha 255 zurück; genau
 * das erwartet `erwartetePunkteRGBA`.
 */
export function bildBytes(): Buffer {
  const roh = Buffer.alloc(BILD_HOEHE * (1 + BILD_BREITE * 3));
  let i = 0;
  for (let y = 0; y < BILD_HOEHE; y += 1) {
    roh[i] = 0; // Filter „None" — die Zeile steht wie sie ist.
    i += 1;
    for (let x = 0; x < BILD_BREITE; x += 1) {
      const punkt = BILD_PIXEL[y * BILD_BREITE + x] as readonly [number, number, number];
      roh[i] = punkt[0];
      roh[i + 1] = punkt[1];
      roh[i + 2] = punkt[2];
      i += 3;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(BILD_BREITE, 0);
  ihdr.writeUInt32BE(BILD_HOEHE, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 2; // Farbtyp: Echtfarbe ohne Alpha
  ihdr[10] = 0; // Kompression: deflate
  ihdr[11] = 0; // Filterverfahren
  ihdr[12] = 0; // nicht verschränkt
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    block("IHDR", ihdr),
    block("IDAT", deflateSync(roh, { level: 9 })),
    block("IEND", Buffer.alloc(0)),
  ]);
}

/** Was die Leinwand im Browser liefern MUSS: R, G, B, A je Bildpunkt, zeilenweise. */
export function erwartetePunkteRGBA(): number[] {
  const werte: number[] = [];
  for (const [r, g, b] of BILD_PIXEL) {
    werte.push(r, g, b, 255);
  }
  return werte;
}

// ------------------------------------------------------------------------------------------------
// DER BESTAND — ein freigegebener Eintrag, dessen Quelle auf das BILD zeigt.
// ------------------------------------------------------------------------------------------------
//
// WARUM NICHT `eintragMitOriginal` AUS `kette.ts`: jener Helfer lädt fest `ORIGINALNAME` mit
// `ORIGINAL_MIME` hoch (`kette.ts:285-297`) — eine Textdatei, ohne Schalter für etwas anderes. Und
// `tests/klara-quellen-nutzerweg/**` steht nicht in den Zielpfaden dieses Auftrags. Es sind
// deshalb dieselben vier Produktgriffe in derselben Reihenfolge wie dort, nur mit anderer Nutzlast;
// G5 legt seinen Eintrag aus demselben Grund selbst an (`…integration.test.ts:803`).

export interface Bildeintrag {
  koId: string;
  /** Die Kennung im Object-Store — die Adresse des Bildoriginals. */
  objectId: string;
  titel: string;
  kernaussage: string;
}

export async function bildeintragAnlegen(
  app: App,
  konto: Konto,
  titel: string,
  kernaussage: string,
): Promise<Bildeintrag> {
  const bytes = bildBytes();
  const hochgeladen = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: konto.kopf,
    payload: {
      name: BILDNAME,
      mime: BILD_MIME,
      data: `data:${BILD_MIME};base64,${bytes.toString("base64")}`,
      kind: "image",
      purpose: "anchor",
      confidentiality: "intern",
    },
  });
  expect(hochgeladen.statusCode, `Bild-Upload gescheitert: ${hochgeladen.body}`).toBe(201);
  const objectId = (hochgeladen.json() as { id: string }).id;

  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: konto.kopf,
    payload: {
      title: titel,
      statement: kernaussage,
      type: "best_practice",
      category: "Betrieb",
      confidentiality: "intern",
      neededValidations: 1,
    },
  });
  expect(angelegt.statusCode, `Anlage gescheitert: ${angelegt.body}`).toBe(201);
  const koId = (angelegt.json() as { id: string }).id;

  const angehaengt = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: konto.kopf,
    payload: {
      action: "attach",
      attachment: { name: BILDNAME, mime: BILD_MIME, objectId, size: bytes.length },
    },
  });
  expect(angehaengt.statusCode, `Anhängen gescheitert: ${angehaengt.body}`).toBe(200);

  const verankert = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: konto.kopf,
    payload: {
      action: "add-source",
      source: { label: QUELLE_BILD, excerpt: kernaussage, objectId },
    },
  });
  expect(verankert.statusCode, `Quelle anhängen gescheitert: ${verankert.body}`).toBe(200);

  const freigegeben = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: konto.kopf,
    payload: { action: "admin-validate" },
  });
  expect(freigegeben.statusCode, `Freigabe gescheitert: ${freigegeben.body}`).toBe(200);

  return { koId, objectId, titel, kernaussage };
}

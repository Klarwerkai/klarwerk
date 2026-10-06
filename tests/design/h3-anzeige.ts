// ================================================================================================
// Aufnahme `gesamt-erfassung-einstieg:layout` (Nacharbeit 5) — DAS ECHTE DISPLAY, NICHT DIE SEITE.
// ================================================================================================
//
// Ein nativer `confirm`/`alert` steht nicht im DOM; ein Seiten-Screenshot zeigt ihn nie, und das
// kopflose Chromium zeichnet ihn gar nicht. Diese Datei stellt deshalb ein eigenes virtuelles
// X-Display bereit (Xvfb), auf dem Chromium SICHTBAR läuft, und liest das, was auf diesem Display
// tatsächlich gezeichnet ist — Browserfenster samt Dialog — als Bild.
//
// WIE GELESEN WIRD: Xvfb legt mit `-fbdir` seinen Bildspeicher als XWD-Datei ab
// (`Xvfb_screen0`). Sie wird hier gelesen und als PNG geschrieben — ohne Zusatzwerkzeug, nur mit
// Xvfb selbst und `node:zlib`. Es gibt keine DOM-Nachbildung und keinen Seiten-Screenshot.
//
// GRENZE: Ob der Dialogtext im Bild LESBAR vollständig steht, entscheidet die Sichtung der
// abgelegten Bilder; die Datei misst automatisch nur, DASS und WO der Dialog das Display verändert.
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";

export interface Anzeige {
  /** Der Wert für `DISPLAY`, z. B. ":93". */
  display: string;
  breite: number;
  hoehe: number;
  /** Das aktuell gezeichnete Display als RGB-Bild. */
  aufnehmen(): Bild;
  beenden(): Promise<void>;
}

export interface Bild {
  breite: number;
  hoehe: number;
  /** RGB, drei Bytes je Bildpunkt, Zeile für Zeile. */
  rgb: Buffer;
}

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Startet ein eigenes Xvfb-Display. Wirft laut, wenn Xvfb fehlt oder nicht hochkommt. */
export async function anzeigeStarten(breite = 1400, hoehe = 1000): Promise<Anzeige> {
  const ablage = mkdtempSync(join(tmpdir(), "h3-anzeige-"));
  let nummer = 90 + Math.floor(Math.random() * 50);
  while (existsSync(`/tmp/.X${nummer}-lock`)) {
    nummer += 1;
  }
  const display = `:${nummer}`;
  const prozess: ChildProcess = spawn(
    "Xvfb",
    [display, "-screen", "0", `${breite}x${hoehe}x24`, "-fbdir", ablage, "-nolisten", "tcp"],
    { stdio: "ignore" },
  );
  const start: { fehler: Error | null } = { fehler: null };
  prozess.on("error", (e) => {
    start.fehler = e;
  });
  const bildspeicher = join(ablage, "Xvfb_screen0");
  for (let i = 0; i < 100 && !start.fehler && !existsSync(bildspeicher); i++) {
    await warte(100);
  }
  if (start.fehler || !existsSync(bildspeicher)) {
    prozess.kill();
    rmSync(ablage, { recursive: true, force: true });
    const grund = String(start.fehler ?? "kein Bildspeicher");
    throw new Error(`Xvfb ${display} kam nicht hoch: ${grund}`);
  }
  return {
    display,
    breite,
    hoehe,
    aufnehmen: () => xwdLesen(readFileSync(bildspeicher)),
    beenden: async () => {
      prozess.kill();
      await warte(200);
      rmSync(ablage, { recursive: true, force: true });
    },
  };
}

/** XWD (X Window Dump, wie Xvfb ihn mit `-fbdir` führt) → RGB. */
export function xwdLesen(daten: Buffer): Bild {
  const feld = (i: number) => daten.readUInt32BE(i * 4);
  const kopf = feld(0);
  const breite = feld(4);
  const hoehe = feld(5);
  const byteFolge = feld(7); // 0 = LSB zuerst
  const bitsJePunkt = feld(11);
  const bytesJeZeile = feld(12);
  const masken = [feld(14), feld(15), feld(16)];
  const farben = feld(19);
  if (bitsJePunkt !== 32 && bitsJePunkt !== 24) {
    throw new Error(`XWD mit ${bitsJePunkt} Bit je Punkt wird nicht gelesen`);
  }
  const start = kopf + farben * 12;
  const schiebe = masken.map((m) => (m === 0 ? 0 : Math.log2(m & -m)));
  const rgb = Buffer.alloc(breite * hoehe * 3);
  const bpp = bitsJePunkt / 8;
  for (let y = 0; y < hoehe; y++) {
    for (let x = 0; x < breite; x++) {
      const o = start + y * bytesJeZeile + x * bpp;
      let wert = 0;
      for (let b = 0; b < bpp; b++) {
        const byte = daten[o + b] ?? 0;
        wert = byteFolge === 0 ? wert + byte * 2 ** (8 * b) : wert * 256 + byte;
      }
      const z = (y * breite + x) * 3;
      for (let k = 0; k < 3; k++) {
        rgb[z + k] = Math.floor((wert & (masken[k] ?? 0)) / 2 ** (schiebe[k] ?? 0)) & 0xff;
      }
    }
  }
  return { breite, hoehe, rgb };
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(puffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of puffer) {
    c = (CRC[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function block(art: string, inhalt: Buffer): Buffer {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(inhalt.length);
  const kopfUndInhalt = Buffer.concat([Buffer.from(art, "ascii"), inhalt]);
  const pruef = Buffer.alloc(4);
  pruef.writeUInt32BE(crc32(kopfUndInhalt));
  return Buffer.concat([laenge, kopfUndInhalt, pruef]);
}

/** Schreibt das Bild als PNG (RGB, 8 Bit). */
export function pngSchreiben(pfad: string, bild: Bild): void {
  mkdirSync(dirname(pfad), { recursive: true });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(bild.breite, 0);
  ihdr.writeUInt32BE(bild.hoehe, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const zeilen = Buffer.alloc((bild.breite * 3 + 1) * bild.hoehe);
  for (let y = 0; y < bild.hoehe; y++) {
    zeilen[y * (bild.breite * 3 + 1)] = 0;
    bild.rgb.copy(
      zeilen,
      y * (bild.breite * 3 + 1) + 1,
      y * bild.breite * 3,
      (y + 1) * bild.breite * 3,
    );
  }
  writeFileSync(
    pfad,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      block("IHDR", ihdr),
      block("IDAT", deflateSync(zeilen)),
      block("IEND", Buffer.alloc(0)),
    ]),
  );
}

export interface Veraenderung {
  punkte: number;
  links: number;
  oben: number;
  breite: number;
  hoehe: number;
}

/** Wo unterscheiden sich zwei Aufnahmen desselben Displays? Rahmen und Zahl der Punkte. */
export function veraenderung(vorher: Bild, nachher: Bild): Veraenderung {
  let punkte = 0;
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = -1;
  let y1 = -1;
  const unterschied = (i: number) => Math.abs((vorher.rgb[i] ?? 0) - (nachher.rgb[i] ?? 0));
  for (let y = 0; y < vorher.hoehe; y++) {
    for (let x = 0; x < vorher.breite; x++) {
      const i = (y * vorher.breite + x) * 3;
      if (unterschied(i) + unterschied(i + 1) + unterschied(i + 2) > 24) {
        punkte += 1;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  return punkte === 0
    ? { punkte, links: 0, oben: 0, breite: 0, hoehe: 0 }
    : { punkte, links: x0, oben: y0, breite: x1 - x0 + 1, hoehe: y1 - y0 + 1 };
}

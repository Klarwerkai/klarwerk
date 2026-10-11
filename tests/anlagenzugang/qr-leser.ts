// ================================================================================================
// gesamt-anlagenzugang · EIN UNABHÄNGIGER QR-LESER FÜR DIE PRÜFUNG DES KODIERERS.
// ================================================================================================
//
// Der Kodierer (`apps/web/src/lib/qrCode.ts`) wird NICHT gegen sich selbst geprüft. Dieser Leser
// teilt keinen Code mit ihm und stützt sich für alles, was der Kodierer rechnet, auf die TABELLEN
// des Standards (ISO/IEC 18004: Blockaufteilung der Stufe M, Lage der Ausrichtungsmuster):
//
//   1. Suchmuster in drei Ecken, Zeitmuster, dunkles Modul.
//   2. Formatinformation: BCH-Prüfsumme stimmt, Stufe ist M, beide Kopien gleich.
//   3. Datenmodule nach der Zickzackregel lesen, Maske abziehen, Blöcke entschränken.
//   4. Reed-Solomon: alle Syndrome jedes Blocks sind null (Wurzeln α^0 … α^(n−1)).
//   5. Datenstrom: Byte-Modus, Zählerbreite der Version, Bytes als UTF-8.
//
// Jeder Bruch wirft mit einer Meldung, die sagt, welcher Schritt nicht trägt.

/** Stufe M, Versionen 1–10: Fehlerkorrektur je Block und Gruppen [Anzahl Blöcke, Datenwörter]. */
const BLOECKE_M: Record<number, { ecc: number; gruppen: [number, number][] }> = {
  1: { ecc: 10, gruppen: [[1, 16]] },
  2: { ecc: 16, gruppen: [[1, 28]] },
  3: { ecc: 26, gruppen: [[1, 44]] },
  4: { ecc: 18, gruppen: [[2, 32]] },
  5: { ecc: 24, gruppen: [[2, 43]] },
  6: { ecc: 16, gruppen: [[4, 27]] },
  7: { ecc: 18, gruppen: [[4, 31]] },
  8: {
    ecc: 22,
    gruppen: [
      [2, 38],
      [2, 39],
    ],
  },
  9: {
    ecc: 22,
    gruppen: [
      [3, 36],
      [2, 37],
    ],
  },
  10: {
    ecc: 26,
    gruppen: [
      [4, 43],
      [1, 44],
    ],
  },
};

/** Mittelpunkte der Ausrichtungsmuster (Anhang E des Standards). */
const AUSRICHTUNG: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

export interface QrGelesen {
  version: number;
  maske: number;
  text: string;
}

function mul(a: number, b: number): number {
  let ergebnis = 0;
  let x = a;
  let y = b;
  while (y > 0) {
    if (y & 1) {
      ergebnis ^= x;
    }
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
    y >>= 1;
  }
  return ergebnis;
}

function funktionsmodule(version: number): boolean[][] {
  const n = version * 4 + 17;
  const f = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const markiere = (x0: number, y0: number, x1: number, y1: number): void => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        (f[y] as boolean[])[x] = true;
      }
    }
  };
  markiere(0, 0, 8, 8);
  markiere(n - 8, 0, n - 1, 8);
  markiere(0, n - 8, 8, n - 1);
  markiere(6, 0, 6, n - 1);
  markiere(0, 6, n - 1, 6);
  const pos = AUSRICHTUNG[version] ?? [];
  for (const cy of pos) {
    for (const cx of pos) {
      const ecke =
        (cx === 6 && cy === 6) || (cx === 6 && cy === n - 7) || (cx === n - 7 && cy === 6);
      if (!ecke) {
        markiere(cx - 2, cy - 2, cx + 2, cy + 2);
      }
    }
  }
  if (version >= 7) {
    markiere(n - 11, 0, n - 9, 5);
    markiere(0, n - 11, 5, n - 9);
  }
  return f;
}

function maskiert(maske: number, x: number, y: number): boolean {
  const r = y;
  const c = x;
  switch (maske) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      throw new Error(`Maske ${maske} gibt es nicht`);
  }
}

function bchRest(daten: number): number {
  let rest = daten << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rest >> i) & 1) {
      rest ^= 0x537 << (i - 10);
    }
  }
  return rest;
}

export function leseQr(m: readonly (readonly boolean[])[]): QrGelesen {
  const n = m.length;
  const version = (n - 17) / 4;
  if (!Number.isInteger(version) || version < 1 || version > 10) {
    throw new Error(`Seitenlänge ${n} passt zu keiner Version 1–10`);
  }
  const an = (x: number, y: number): boolean => (m[y] as readonly boolean[])[x] === true;

  // 1 · Suchmuster, Zeitmuster, dunkles Modul.
  for (const [ox, oy] of [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ] as const) {
    for (let dy = 0; dy < 7; dy++) {
      for (let dx = 0; dx < 7; dx++) {
        const rand = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        if (an(ox + dx, oy + dy) !== (rand !== 2)) {
          throw new Error(`Suchmuster bei (${ox},${oy}) gestört an (${dx},${dy})`);
        }
      }
    }
  }
  for (let i = 8; i < n - 8; i++) {
    if (an(i, 6) !== (i % 2 === 0) || an(6, i) !== (i % 2 === 0)) {
      throw new Error(`Zeitmuster gestört bei ${i}`);
    }
  }
  if (!an(8, n - 8)) {
    throw new Error("dunkles Modul fehlt");
  }

  // 2 · Formatinformation (beide Kopien).
  const erste: boolean[] = [];
  for (let i = 0; i <= 5; i++) {
    erste.push(an(8, i));
  }
  erste.push(an(8, 7), an(8, 8), an(7, 8));
  for (let i = 9; i < 15; i++) {
    erste.push(an(14 - i, 8));
  }
  const zweite: boolean[] = [];
  for (let i = 0; i < 8; i++) {
    zweite.push(an(n - 1 - i, 8));
  }
  for (let i = 8; i < 15; i++) {
    zweite.push(an(8, n - 15 + i));
  }
  const alsZahl = (bits: boolean[]): number =>
    bits.reduce((summe, bit, i) => summe | ((bit ? 1 : 0) << i), 0);
  const format = alsZahl(erste) ^ 0x5412;
  if (alsZahl(zweite) ^ 0x5412 ^ format) {
    throw new Error("die beiden Kopien der Formatinformation weichen voneinander ab");
  }
  const daten5 = format >> 10;
  if (bchRest(daten5) !== (format & 0x3ff)) {
    throw new Error(`Formatinformation: BCH-Prüfsumme stimmt nicht (${format.toString(2)})`);
  }
  if (daten5 >> 3 !== 0) {
    throw new Error(`Fehlerkorrekturstufe ist nicht M (Kennung ${daten5 >> 3})`);
  }
  const maske = daten5 & 7;

  // 3 · Datenmodule lesen und entmaskieren.
  const f = funktionsmodule(version);
  const bits: number[] = [];
  let aufwaerts = true;
  // Spaltenpaare von rechts, abwechselnd aufwärts und abwärts; die Zeitspalte 6 wird übersprungen
  // (n ist ungerade, `rechts` also gerade: … 8 → Paar 8/7, dann 6 → Paar 5/4).
  for (let rechts = n - 1; rechts > 0; rechts -= 2) {
    const spalte = rechts <= 6 ? rechts - 1 : rechts;
    for (let k = 0; k < n; k++) {
      const y = aufwaerts ? n - 1 - k : k;
      for (const x of [spalte, spalte - 1]) {
        if (!(f[y] as boolean[])[x]) {
          bits.push((an(x, y) ? 1 : 0) ^ (maskiert(maske, x, y) ? 1 : 0));
        }
      }
    }
    aufwaerts = !aufwaerts;
  }
  const codewoerter: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | (bits[i + j] as number);
    }
    codewoerter.push(b);
  }

  const aufbau = BLOECKE_M[version];
  if (!aufbau) {
    throw new Error(`keine Blocktabelle für Version ${version}`);
  }
  const laengen: number[] = [];
  for (const [anzahl, datenwoerter] of aufbau.gruppen) {
    for (let i = 0; i < anzahl; i++) {
      laengen.push(datenwoerter);
    }
  }
  const gesamt = laengen.reduce((s, l) => s + l + aufbau.ecc, 0);
  if (codewoerter.length !== gesamt) {
    throw new Error(`gelesene Codewörter ${codewoerter.length}, erwartet ${gesamt}`);
  }
  const bloecke = laengen.map(() => [] as number[]);
  let z = 0;
  const groesste = Math.max(...laengen);
  for (let i = 0; i < groesste; i++) {
    laengen.forEach((l, j) => {
      if (i < l) {
        (bloecke[j] as number[]).push(codewoerter[z++] as number);
      }
    });
  }
  for (let i = 0; i < aufbau.ecc; i++) {
    for (const block of bloecke) {
      block.push(codewoerter[z++] as number);
    }
  }

  // 4 · Reed-Solomon: jedes Syndrom ist null.
  bloecke.forEach((block, j) => {
    let alpha = 1;
    for (let k = 0; k < aufbau.ecc; k++) {
      let s = 0;
      for (const c of block) {
        s = mul(s, alpha) ^ c;
      }
      if (s !== 0) {
        throw new Error(`Block ${j}: Syndrom ${k} ist ${s}, nicht 0`);
      }
      alpha = mul(alpha, 2);
    }
  });

  // 5 · Datenstrom.
  const daten = bloecke.flatMap((block, j) => block.slice(0, laengen[j]));
  const strom: number[] = [];
  for (const b of daten) {
    for (let i = 7; i >= 0; i--) {
      strom.push((b >> i) & 1);
    }
  }
  let p = 0;
  const lies = (breite: number): number => {
    let wert = 0;
    for (let i = 0; i < breite; i++) {
      wert = (wert << 1) | (strom[p++] as number);
    }
    return wert;
  };
  const modus = lies(4);
  if (modus !== 0b0100) {
    throw new Error(`Modus ${modus.toString(2)} ist nicht Byte (0100)`);
  }
  const anzahl = lies(version <= 9 ? 8 : 16);
  const bytes = new Uint8Array(anzahl);
  for (let i = 0; i < anzahl; i++) {
    bytes[i] = lies(8);
  }
  return { version, maske, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
}

/** Liest die Matrix aus einem `d`-Pfad aus Einheitsquadraten (`M x y h1v1h-1z`) zurück. */
export function matrixAusPfad(pfad: string, seite: number, ruhezone: number): boolean[][] {
  const n = seite - 2 * ruhezone;
  const m = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const muster = /M(\d+) (\d+)h1v1h-1z/g;
  let treffer = muster.exec(pfad);
  while (treffer) {
    const x = Number(treffer[1]) - ruhezone;
    const y = Number(treffer[2]) - ruhezone;
    if (x < 0 || y < 0 || x >= n || y >= n) {
      throw new Error(`Modul (${x},${y}) liegt in der Ruhezone oder ausserhalb`);
    }
    (m[y] as boolean[])[x] = true;
    treffer = muster.exec(pfad);
  }
  return m;
}

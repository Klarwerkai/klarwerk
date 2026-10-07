// ================================================================================================
// R-1647 / R-2174 (aufnahme:20260922:gesamt-anlagenzugang) — DER QR-CODE AN DER ANLAGE.
// ================================================================================================
//
// WARUM EIN EIGENER KODIERER UND KEINE BIBLIOTHEK: Das Projekt führt keine QR-Abhängigkeit, und der
// Auftrag erlaubt keine Installation. Gebraucht wird genau EIN Weg: eine Adresse (UTF-8, Byte-Modus)
// in eine Modulmatrix nach ISO/IEC 18004 — Fehlerkorrektur M (rund 15 % Beschädigung lesbar,
// passend für ein Etikett an einer Maschine), Versionen 1 bis 10. Version 10-M trägt 213 Byte; eine
// Anlagenadresse ist weit kürzer. Was länger ist, wird nicht still abgeschnitten, sondern abgelehnt
// (`QrZuLangFehler`) — ein abgeschnittener Link führte an die falsche Stelle.
//
// Der Aufbau folgt dem Standard Schritt für Schritt (Segment → Füllbytes → Reed-Solomon je Block →
// Verschränkung → Funktionsmuster → Zickzack-Platzierung → Maske mit den vier Strafregeln →
// Formatinformation). Geprüft wird er in `tests/anlagenzugang/qr-code.test.ts` durch ein
// unabhängiges Rücklesen: Formatprüfsumme, Reed-Solomon-Syndrome und die dekodierten Bytes.

/** Fehlerkorrektur M: Formatkennung 0 (L=1, M=0, Q=3, H=2). */
const FORMAT_M = 0;
const HOECHSTE_VERSION = 10;

// Je Version (Index = Version, 0 unbenutzt): Fehlerkorrektur-Codewörter je Block und Anzahl der
// Blöcke für Stufe M (ISO/IEC 18004, Tabelle 9).
const ECC_JE_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26] as const;
const BLOECKE = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5] as const;

export class QrZuLangFehler extends Error {
  constructor(laenge: number) {
    super(`QR-Inhalt mit ${laenge} Byte passt nicht in Version ${HOECHSTE_VERSION}-M.`);
    this.name = "QrZuLangFehler";
  }
}

// ---- Galois-Feld GF(256), Polynom x^8 + x^4 + x^3 + x^2 + 1 ------------------------------------
function gfMal(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsTeiler(grad: number): number[] {
  const ergebnis = new Array<number>(grad).fill(0);
  ergebnis[grad - 1] = 1;
  let wurzel = 1;
  for (let i = 0; i < grad; i++) {
    for (let j = 0; j < grad; j++) {
      ergebnis[j] = gfMal(ergebnis[j] as number, wurzel);
      if (j + 1 < grad) {
        ergebnis[j] = (ergebnis[j] as number) ^ (ergebnis[j + 1] as number);
      }
    }
    wurzel = gfMal(wurzel, 0x02);
  }
  return ergebnis;
}

function rsRest(daten: readonly number[], teiler: readonly number[]): number[] {
  const ergebnis = teiler.map(() => 0);
  for (const b of daten) {
    const faktor = b ^ (ergebnis.shift() as number);
    ergebnis.push(0);
    for (let i = 0; i < teiler.length; i++) {
      ergebnis[i] = (ergebnis[i] as number) ^ gfMal(teiler[i] as number, faktor);
    }
  }
  return ergebnis;
}

// ---- Kapazität ----------------------------------------------------------------------------------
function rohModule(version: number): number {
  let ergebnis = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const ausrichtungen = Math.floor(version / 7) + 2;
    ergebnis -= (25 * ausrichtungen - 10) * ausrichtungen - 55;
    if (version >= 7) {
      ergebnis -= 36;
    }
  }
  return ergebnis;
}

function datenCodewoerter(version: number): number {
  return (
    Math.floor(rohModule(version) / 8) -
    (ECC_JE_BLOCK[version] as number) * (BLOECKE[version] as number)
  );
}

/** Zeichenzählerbreite im Byte-Modus: 8 Bit bis Version 9, 16 Bit ab Version 10. */
function zaehlerBits(version: number): number {
  return version <= 9 ? 8 : 16;
}

// ---- Datenstrom ---------------------------------------------------------------------------------
function datenMitFehlerkorrektur(bytes: Uint8Array): { version: number; codewoerter: number[] } {
  let version = 1;
  for (; version <= HOECHSTE_VERSION; version++) {
    if (4 + zaehlerBits(version) + bytes.length * 8 <= datenCodewoerter(version) * 8) {
      break;
    }
  }
  if (version > HOECHSTE_VERSION) {
    throw new QrZuLangFehler(bytes.length);
  }
  const kapazitaetBits = datenCodewoerter(version) * 8;
  const bits: number[] = [];
  const schreibe = (wert: number, laenge: number): void => {
    for (let i = laenge - 1; i >= 0; i--) {
      bits.push((wert >>> i) & 1);
    }
  };
  schreibe(0b0100, 4);
  schreibe(bytes.length, zaehlerBits(version));
  for (const b of bytes) {
    schreibe(b, 8);
  }
  schreibe(0, Math.min(4, kapazitaetBits - bits.length));
  schreibe(0, (8 - (bits.length % 8)) % 8);
  for (let fuell = 0xec; bits.length < kapazitaetBits; fuell ^= 0xec ^ 0x11) {
    schreibe(fuell, 8);
  }
  const daten: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | (bits[i + j] as number);
    }
    daten.push(b);
  }

  const bloecke = BLOECKE[version] as number;
  const eccLaenge = ECC_JE_BLOCK[version] as number;
  const roh = Math.floor(rohModule(version) / 8);
  const kurzeBloecke = bloecke - (roh % bloecke);
  const kurzLaenge = Math.floor(roh / bloecke);
  const teiler = rsTeiler(eccLaenge);
  const liste: number[][] = [];
  for (let i = 0, k = 0; i < bloecke; i++) {
    const stueck = daten.slice(k, k + kurzLaenge - eccLaenge + (i < kurzeBloecke ? 0 : 1));
    k += stueck.length;
    const ecc = rsRest(stueck, teiler);
    if (i < kurzeBloecke) {
      stueck.push(0);
    }
    liste.push(stueck.concat(ecc));
  }
  const codewoerter: number[] = [];
  const blockLaenge = (liste[0] as number[]).length;
  for (let i = 0; i < blockLaenge; i++) {
    for (let j = 0; j < liste.length; j++) {
      if (i !== kurzLaenge - eccLaenge || j >= kurzeBloecke) {
        codewoerter.push((liste[j] as number[])[i] as number);
      }
    }
  }
  return { version, codewoerter };
}

// ---- Matrix -------------------------------------------------------------------------------------
class Matrix {
  readonly version: number;
  readonly groesse: number;
  readonly module: boolean[][];
  readonly funktion: boolean[][];

  constructor(version: number) {
    this.version = version;
    this.groesse = version * 4 + 17;
    this.module = Array.from({ length: this.groesse }, () =>
      new Array<boolean>(this.groesse).fill(false),
    );
    this.funktion = Array.from({ length: this.groesse }, () =>
      new Array<boolean>(this.groesse).fill(false),
    );
  }

  setze(x: number, y: number, dunkel: boolean): void {
    (this.module[y] as boolean[])[x] = dunkel;
    (this.funktion[y] as boolean[])[x] = true;
  }

  zeichneFunktionsmuster(): void {
    const n = this.groesse;
    for (let i = 0; i < n; i++) {
      this.setze(6, i, i % 2 === 0);
      this.setze(i, 6, i % 2 === 0);
    }
    this.suchmuster(3, 3);
    this.suchmuster(n - 4, 3);
    this.suchmuster(3, n - 4);
    const pos = this.ausrichtungsPositionen();
    const anzahl = pos.length;
    for (let i = 0; i < anzahl; i++) {
      for (let j = 0; j < anzahl; j++) {
        const ecke =
          (i === 0 && j === 0) || (i === 0 && j === anzahl - 1) || (i === anzahl - 1 && j === 0);
        if (!ecke) {
          this.ausrichtungsmuster(pos[i] as number, pos[j] as number);
        }
      }
    }
    this.formatinformation(0);
    this.versionsinformation();
  }

  private suchmuster(x: number, y: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const abstand = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.groesse && yy >= 0 && yy < this.groesse) {
          this.setze(xx, yy, abstand !== 2 && abstand !== 4);
        }
      }
    }
  }

  private ausrichtungsmuster(x: number, y: number): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.setze(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  private ausrichtungsPositionen(): number[] {
    if (this.version === 1) {
      return [];
    }
    const anzahl = Math.floor(this.version / 7) + 2;
    const schritt = Math.floor((this.version * 8 + anzahl * 3 + 5) / (anzahl * 4 - 4)) * 2;
    const ergebnis = [6];
    for (let p = this.groesse - 7; ergebnis.length < anzahl; p -= schritt) {
      ergebnis.splice(1, 0, p);
    }
    return ergebnis;
  }

  formatinformation(maske: number): void {
    const daten = (FORMAT_M << 3) | maske;
    let rest = daten;
    for (let i = 0; i < 10; i++) {
      rest = (rest << 1) ^ ((rest >>> 9) * 0x537);
    }
    const bits = ((daten << 10) | rest) ^ 0x5412;
    const bit = (i: number): boolean => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) {
      this.setze(8, i, bit(i));
    }
    this.setze(8, 7, bit(6));
    this.setze(8, 8, bit(7));
    this.setze(7, 8, bit(8));
    for (let i = 9; i < 15; i++) {
      this.setze(14 - i, 8, bit(i));
    }
    const n = this.groesse;
    for (let i = 0; i < 8; i++) {
      this.setze(n - 1 - i, 8, bit(i));
    }
    for (let i = 8; i < 15; i++) {
      this.setze(8, n - 15 + i, bit(i));
    }
    this.setze(8, n - 8, true);
  }

  private versionsinformation(): void {
    if (this.version < 7) {
      return;
    }
    let rest = this.version;
    for (let i = 0; i < 12; i++) {
      rest = (rest << 1) ^ ((rest >>> 11) * 0x1f25);
    }
    const bits = (this.version << 12) | rest;
    for (let i = 0; i < 18; i++) {
      const dunkel = ((bits >>> i) & 1) !== 0;
      const a = this.groesse - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setze(a, b, dunkel);
      this.setze(b, a, dunkel);
    }
  }

  platziere(codewoerter: readonly number[]): void {
    const n = this.groesse;
    let i = 0;
    for (let rechts = n - 1; rechts >= 1; rechts -= 2) {
      if (rechts === 6) {
        rechts = 5;
      }
      for (let schrittV = 0; schrittV < n; schrittV++) {
        for (let j = 0; j < 2; j++) {
          const x = rechts - j;
          const aufwaerts = ((rechts + 1) & 2) === 0;
          const y = aufwaerts ? n - 1 - schrittV : schrittV;
          if (!(this.funktion[y] as boolean[])[x] && i < codewoerter.length * 8) {
            (this.module[y] as boolean[])[x] =
              (((codewoerter[i >>> 3] as number) >>> (7 - (i & 7))) & 1) !== 0;
            i++;
          }
        }
      }
    }
  }

  maskiere(maske: number): void {
    for (let y = 0; y < this.groesse; y++) {
      for (let x = 0; x < this.groesse; x++) {
        if (!(this.funktion[y] as boolean[])[x] && maskenBit(maske, x, y)) {
          const zeile = this.module[y] as boolean[];
          zeile[x] = !zeile[x];
        }
      }
    }
  }

  strafpunkte(): number {
    const n = this.groesse;
    const m = this.module;
    let ergebnis = 0;
    const lauf = (wert: (a: number, b: number) => boolean): void => {
      for (let a = 0; a < n; a++) {
        let farbe = false;
        let laenge = 0;
        const verlauf = [0, 0, 0, 0, 0, 0, 0];
        for (let b = 0; b < n; b++) {
          if (wert(a, b) === farbe) {
            laenge++;
            if (laenge === 5) {
              ergebnis += 3;
            } else if (laenge > 5) {
              ergebnis++;
            }
          } else {
            verlaufErgaenzen(laenge, verlauf, n);
            if (!farbe) {
              ergebnis += suchmusterImVerlauf(verlauf) * 40;
            }
            farbe = wert(a, b);
            laenge = 1;
          }
        }
        if (farbe) {
          verlaufErgaenzen(laenge, verlauf, n);
          laenge = 0;
        }
        verlaufErgaenzen(laenge + n, verlauf, n);
        ergebnis += suchmusterImVerlauf(verlauf) * 40;
      }
    };
    lauf((y, x) => (m[y] as boolean[])[x] as boolean);
    lauf((x, y) => (m[y] as boolean[])[x] as boolean);
    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        const farbe = (m[y] as boolean[])[x];
        if (
          farbe === (m[y] as boolean[])[x + 1] &&
          farbe === (m[y + 1] as boolean[])[x] &&
          farbe === (m[y + 1] as boolean[])[x + 1]
        ) {
          ergebnis += 3;
        }
      }
    }
    let dunkel = 0;
    for (const zeile of m) {
      for (const modul of zeile) {
        if (modul) {
          dunkel++;
        }
      }
    }
    const gesamt = n * n;
    ergebnis += (Math.ceil(Math.abs(dunkel * 20 - gesamt * 10) / gesamt) - 1) * 10;
    return ergebnis;
  }
}

function maskenBit(maske: number, x: number, y: number): boolean {
  switch (maske) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function verlaufErgaenzen(laenge: number, verlauf: number[], groesse: number): void {
  const wert = verlauf[0] === 0 ? laenge + groesse : laenge;
  verlauf.pop();
  verlauf.unshift(wert);
}

function suchmusterImVerlauf(v: readonly number[]): number {
  const n = v[1] as number;
  const kern = n > 0 && v[2] === n && v[3] === n * 3 && v[4] === n && v[5] === n;
  return (
    (kern && (v[0] as number) >= n * 4 && (v[6] as number) >= n ? 1 : 0) +
    (kern && (v[6] as number) >= n * 4 && (v[0] as number) >= n ? 1 : 0)
  );
}

/**
 * Die Modulmatrix eines QR-Codes für `text` (UTF-8, Byte-Modus, Fehlerkorrektur M). `true` = dunkel.
 * Zeile für Zeile, ohne Ruhezone — die legt die Darstellung an (`qrSvgPfad`).
 */
export function qrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const { version, codewoerter } = datenMitFehlerkorrektur(bytes);
  const matrix = new Matrix(version);
  matrix.zeichneFunktionsmuster();
  matrix.platziere(codewoerter);
  let beste = 0;
  let wenigste = Number.POSITIVE_INFINITY;
  for (let maske = 0; maske < 8; maske++) {
    matrix.maskiere(maske);
    matrix.formatinformation(maske);
    const punkte = matrix.strafpunkte();
    if (punkte < wenigste) {
      beste = maske;
      wenigste = punkte;
    }
    matrix.maskiere(maske);
  }
  matrix.maskiere(beste);
  matrix.formatinformation(beste);
  return matrix.module.map((zeile) => [...zeile]);
}

/** Ruhezone um den Code, in Modulen — der Standard verlangt mindestens vier. */
export const QR_RUHEZONE = 4;

/**
 * Ein SVG-Pfad (`d`) aus den dunklen Modulen, verschoben um die Ruhezone. Die Zeichenfläche ist
 * `groesse + 2 · QR_RUHEZONE` Module breit — ein Modul ist eine Einheit der `viewBox`.
 */
export function qrSvgPfad(matrix: readonly (readonly boolean[])[]): string {
  const teile: string[] = [];
  for (let y = 0; y < matrix.length; y++) {
    const zeile = matrix[y] as readonly boolean[];
    for (let x = 0; x < zeile.length; x++) {
      if (zeile[x]) {
        teile.push(`M${x + QR_RUHEZONE} ${y + QR_RUHEZONE}h1v1h-1z`);
      }
    }
  }
  return teile.join("");
}

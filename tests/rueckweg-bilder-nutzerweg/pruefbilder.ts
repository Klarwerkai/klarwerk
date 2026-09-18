// ================================================================================================
// JOB 4329 · DIE EINE WAHRHEIT ÜBER DIE ZWEI PRÜFBILDER UND ÜBER DIE NUTZLAST DES WORD-RÜCKWEGS.
// ================================================================================================
//
// WOZU ES DIESE DATEI GIBT. Dreimal hat der Prüfer dieselbe Lücke benannt und keiner hat sie
// geschlossen (Auftrag §2):
//
//   `archiv/4085/runde-2/ben.md:27`  „Die Darstellung dieser konkreten Bilder in der Web-Oberfläche
//                                     und die PG-Persistenz bleiben unbewiesen."
//   `archiv/4115/runde-1/ben.md:27`  NICHT GEPRÜFT: „… Darstellung der übernommenen Bilder in der
//                                     Bibliothek …"
//   `archiv/3667/runde-9/ben.md:23`  „Eine reale Office-/Postgres-Kette ist damit nicht bewiesen."
//
// Die PG-Hälfte hat JOB 4299 geschlossen — über die API gelesen, nicht im Browser. Was fehlt, ist
// der Satz „ein Mensch SIEHT die zwei Bilder". Dafür braucht es Bilder, deren Inhalt VOR dem Lauf
// feststeht, und eine Nutzlast, die genau die des Add-ins ist.
//
// ------------------------------------------------------------------------------------------------
// WARUM DIE BILDER HIER ERZEUGT UND NICHT MITGELIEFERT WERDEN
// ------------------------------------------------------------------------------------------------
// Dieselbe Begründung wie in `tests/d5-gesamtweg/bildquelle.ts:20-27`: stehen die Bildpunkte als
// ZAHLEN da und wird die Datei daraus gebaut, gibt es genau EINE Wahrheit über den erwarteten
// Inhalt. Eine eingecheckte Binärdatei hätte einen Inhalt, den niemand liest. Der Auftrag verbietet
// sie ausdrücklich (§9).
//
// WARUM NICHT DIE VORHANDENE FIXTURE. `tests/fixtures/job2912-zwei-bilder.docx` trägt zwei PNGs von
// je 70 Bytes — 1×1 Bildpunkt. Ein 1×1-Bild ist blind gegen Verschiebung, Spiegelung, vertauschte
// Farbkanäle und Skalierung (`bildquelle.ts:50-57`), und nach Abzug des Eckradius der Fläche bliebe
// kein Innenbereich, den ein Bildschirmfoto messen könnte.
//
// WARUM DIESE MASSE (96×64 und 80×56). Die Lesefläche zeichnet Bilder mit `border-radius: 13px`
// (`apps/web/src/index.css:116` `rounded-card`, `apps/web/tailwind.config.ts:57`). Der gemessene
// Innenbereich eines Bildschirmfotos lässt je Seite 14 px aus (13 px Radius + 1 px Kantenglättung).
// Es bleiben 68×36 und 52×28 — beides deutlich über der Untergrenze 20×20, die der Integrationslauf
// VOR jedem Punktvergleich zusichert. Zwei VERSCHIEDENE Maße, damit „Bild 1 und Bild 2 vertauscht"
// schon an der Grösse auffällt.
//
// WARUM ZWEI GETRENNTE FARBRÄUME. Innerhalb eines Bildes wiederholt sich kein Punkt, und kein Punkt
// des einen Bildes kommt im anderen vor. Beides ist keine Behauptung, sondern gemessen
// (`pruefbilder.test.ts`). Getragen wird es von einer einzigen Eigenschaft: der Rotkanal von Bild 1
// ist IMMER gerade, der von Bild 2 IMMER ungerade.
//
// KEINE FARBPROFIL-BLÖCKE (kein `iCCP`, `gAMA`, `cHRM`) — wörtlich dieselbe Begründung wie
// `bildquelle.ts:33-36`: ohne Profil behandelt Chromium das Bild als sRGB, die Leinwand ist
// ebenfalls sRGB, die Abbildung ist damit die Identität und ein Vergleich auf exakte Gleichheit
// zulässig. Mit eingebettetem Profil verglichen wir eine Farbumrechnung.
//
// DIES IST EINE BENANNTE ZWEITE FASSUNG DES PNG-SCHREIBERS AUS `tests/d5-gesamtweg/bildquelle.ts`
// (dort :89-143) und keine stille Abschrift: die Zielpfade dieses Auftrags dürfen `d5-gesamtweg/**`
// nicht anfassen (Auftrag §4), und jener Schreiber ist auf EIN Bild fester Grösse verdrahtet
// (`BILD_BREITE`/`BILD_HOEHE` als Modulkonstanten). Hier braucht es zwei Bilder verschiedener Masse.
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

export const JOB = "[KLARWERK] JOB 4329";

/** Was das Bildschirmfoto je Seite auslässt: 13 px Eckradius + 1 px Kantenglättung. */
export const FOTO_RAND = 14;

/** Die Untergrenze, unter der ein Innenbereich nichts mehr belegt (Auftrag §5 Nr. 5b3). */
export const FOTO_INNEN_MINDESTKANTE = 20;

/**
 * DER ZWEITE SCHALTER DER KALIBRIERUNG — und warum es ihn überhaupt gibt.
 *
 * Der Auftrag schaltet die absichtlich roten Kalibrierungsfälle über `KLARWERK_KALIBRIERUNG=1`.
 * GEMESSEN (Arbeitsprüfung `1a07bb4fafde4954bb9ead14882cd770` und die Ablehnung davor): der
 * Cloud-Wrapper nimmt AUSSCHLIESSLICH eine Argumentliste entgegen, die mit `npx vitest run`
 * beginnt (`register/cloud/work.py:26-29`) — eine vorangestellte Umgebungsvariable lehnt er ab
 * („Nur vitest run, playwright test, tsc --noEmit …"). Im Cloud-Lauf ist die Umgebungsvariable
 * damit nicht setzbar.
 *
 * Deshalb zählt zusätzlich eine MARKE im Arbeitsbaum: der Schnappschuss des Wrappers nimmt auch
 * unverfolgte Dateien mit (`work.py:57`, `git ls-files --cached --others`). Die Umgebungsvariable
 * bleibt unverändert gültig; die Marke ist der Weg, der in der Cloud überhaupt möglich ist.
 *
 * SIE DARF NIE MITGELIEFERT WERDEN: läge sie im Bestand, wären sechs Fälle dauerhaft rot. Genau das
 * verhindert der Tor-Zeuge (`tor-zeuge.test.ts`, Fall Z5) — er wird rot, sobald die Marke da ist.
 */
export const KALIBRIERUNGSMARKE = "tests/rueckweg-bilder-nutzerweg/KALIBRIERUNG-AN.marke";

export interface Bildmass {
  readonly breite: number;
  readonly hoehe: number;
}

/**
 * Die Bildpunkte eines Prüfbildes — als FUNKTION von Zeile und Spalte, nicht als abgeschriebene
 * Tabelle. 6144 bzw. 4480 ausgeschriebene Tripel wären eine Tabelle, die niemand liest; die
 * Eigenschaften, auf die es ankommt (Eindeutigkeit, Trennung der beiden Bilder), stehen so als
 * nachlesbare Regel da und werden in `pruefbilder.test.ts` an allen Punkten NACHGEMESSEN.
 *
 * Bild 1: r = 16 + 2x  (immer GERADE, 16…206)   · g = 20 + 3y (20…209) · b = 30 + (x+y) % 50
 * Bild 2: r = 17 + 2x  (immer UNGERADE, 17…175) · g = 25 + 3y (25…190) · b = 40 + (3x+y) % 60
 *
 * `r` hängt allein an der Spalte und ist dort umkehrbar, `g` allein an der Zeile und ebenfalls:
 * damit ist (r,g) je Punkt eindeutig, und jede Verschiebung oder Spiegelung fällt auf. Die
 * verschiedene PARITÄT von `r` trennt die beiden Bilder vollständig.
 */
export type Punktfunktion = (x: number, y: number) => readonly [number, number, number];

export interface Pruefbild {
  /** 1 oder 2 — die Reihenfolge im Fließtext. */
  readonly nr: 1 | 2;
  readonly breite: number;
  readonly hoehe: number;
  readonly punkt: Punktfunktion;
}

export const BILD1: Pruefbild = {
  nr: 1,
  breite: 96,
  hoehe: 64,
  punkt: (x, y) => [16 + 2 * x, 20 + 3 * y, 30 + ((x + y) % 50)],
};

export const BILD2: Pruefbild = {
  nr: 2,
  breite: 80,
  hoehe: 56,
  punkt: (x, y) => [17 + 2 * x, 25 + 3 * y, 40 + ((3 * x + y) % 60)],
};

export const PRUEFBILDER: readonly Pruefbild[] = [BILD1, BILD2];

/** Die Kantenlängen des Innenbereichs, den das Bildschirmfoto vergleicht. */
export function fotoInnenmass(bild: Pruefbild): Bildmass {
  return { breite: bild.breite - 2 * FOTO_RAND, hoehe: bild.hoehe - 2 * FOTO_RAND };
}

// ------------------------------------------------------------------------------------------------
// PNG — Signatur, drei Blöcke, CRC-32. Farbtyp 2 (RGB, 8 Bit), Filter „None", nicht verschränkt.
// ------------------------------------------------------------------------------------------------
//
// Farbtyp 2 und NICHT 6 (RGBA): ohne Alphakanal gibt es keine Vormultiplikation und damit keine
// Rundung, die einen exakten Bildpunktvergleich zu einer Toleranzfrage machen würde. Die Leinwand
// liefert für ein deckendes Bild Alpha 255 zurück — genau das erwartet `erwartetePunkteRGBA`, und
// genau das braucht auch das Bildschirmfoto: ein durchscheinendes Bild mischte den Seitengrund ein.

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

/** Die unkomprimierten Zeilen, wie PNG sie erwartet: je Zeile ein Filterbyte 0, dann RGB. */
export function rohzeilen(bild: Pruefbild): Buffer {
  const roh = Buffer.alloc(bild.hoehe * (1 + bild.breite * 3));
  let i = 0;
  for (let y = 0; y < bild.hoehe; y += 1) {
    roh[i] = 0; // Filter „None" — die Zeile steht wie sie ist.
    i += 1;
    for (let x = 0; x < bild.breite; x += 1) {
      const [r, g, b] = bild.punkt(x, y);
      roh[i] = r;
      roh[i + 1] = g;
      roh[i + 2] = b;
      i += 3;
    }
  }
  return roh;
}

/** Die Bytes eines Prüfbildes — deterministisch aus seiner Punktfunktion. */
export function pngBytes(bild: Pruefbild): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(bild.breite, 0);
  ihdr.writeUInt32BE(bild.hoehe, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 2; // Farbtyp: Echtfarbe ohne Alpha
  ihdr[10] = 0; // Kompression: deflate
  ihdr[11] = 0; // Filterverfahren
  ihdr[12] = 0; // nicht verschränkt
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    block("IHDR", ihdr),
    block("IDAT", deflateSync(rohzeilen(bild), { level: 9 })),
    block("IEND", Buffer.alloc(0)),
  ]);
}

/** Was die Leinwand im Browser liefern MUSS: R, G, B, A je Bildpunkt, zeilenweise. */
export function erwartetePunkteRGBA(bild: Pruefbild): number[] {
  const werte: number[] = [];
  for (let y = 0; y < bild.hoehe; y += 1) {
    for (let x = 0; x < bild.breite; x += 1) {
      const [r, g, b] = bild.punkt(x, y);
      werte.push(r, g, b, 255);
    }
  }
  return werte;
}

/** Die Bildquelle, wie das Add-in sie im Rumpf mitschickt (`taskpane.html:1362`). */
export function datenQuelle(png: Buffer): string {
  return `data:image/png;base64,${png.toString("base64")}`;
}

export function sha256(wert: string | Buffer): string {
  return createHash("sha256").update(wert).digest("hex");
}

// ------------------------------------------------------------------------------------------------
// DIE FERTIGE FIXTURE — einmal berechnet, von allen drei Läufen geteilt.
// ------------------------------------------------------------------------------------------------

export interface Bildfixture {
  readonly bild: Pruefbild;
  readonly png: Buffer;
  /** `data:image/png;base64,…` — genau das, was im `bodyHtml` steht. */
  readonly quelle: string;
  readonly sha256Png: string;
  readonly sha256Quelle: string;
  /** Der Hash der ERWARTETEN Leinwandreihe — die kurze Form für die Protokollzeile. */
  readonly sha256Rgba: string;
}

function fixture(bild: Pruefbild): Bildfixture {
  const png = pngBytes(bild);
  const quelle = datenQuelle(png);
  return {
    bild,
    png,
    quelle,
    sha256Png: sha256(png),
    sha256Quelle: sha256(quelle),
    sha256Rgba: sha256(Buffer.from(Uint8Array.from(erwartetePunkteRGBA(bild)))),
  };
}

/** Bild 1 und Bild 2 in DOKUMENTREIHENFOLGE — die Reihenfolge ist Teil der Zusage. */
export const FIXTUREN: readonly Bildfixture[] = [fixture(BILD1), fixture(BILD2)];

// ------------------------------------------------------------------------------------------------
// DER RUMPF, WIE IHN DAS ADD-IN AUS DEM WORD-`<body>` ÜBERNIMMT.
// ------------------------------------------------------------------------------------------------
//
// `taskpane.html:1348-1352` (`extractWordBodyHtml`) nimmt das INNERE des Word-`<body>`, und
// `rueckweg.js:639` reicht es ungetrimmt weiter, wenn es ins Budget passt. Word setzt Bilder in
// `<p>`, NICHT in `<figure>` — deshalb steht hier `<p><img …></p>` und keine `figure`. Das ist
// nicht Kosmetik: ohne `figure` zeichnet die Galerie unter dem Fließtext NICHTS
// (`apps/web/src/lib/bodyImages.ts:211-213` „Außerhalb jeder figure: kein Galerie-Eintrag"), also
// steht jedes Bild in der Lesefläche GENAU EINMAL — die Zusage „genau zwei `<img>` unter
// `.prose-kw`" wäre mit `figure` gar nicht prüfbar.

export const UEBERSCHRIFT = "Ventilwartung nach dem Rückweg aus Word";
export const ABSATZ =
  "Die Anlage wird vor jeder Sichtprüfung drucklos gefahren; die beiden Aufnahmen zeigen den Zustand vor und nach dem Tausch der Dichtung.";

/** Der Fließtext des Vorschlags: Überschrift, ein Absatz, danach die zwei Bilder in fester Folge. */
export function bodyHtmlWieAusWord(
  quellen: readonly string[] = FIXTUREN.map((f) => f.quelle),
): string {
  const bilder = quellen.map((q) => `<p><img src="${q}"></p>`).join("");
  return `<h2>${UEBERSCHRIFT}</h2><p>${ABSATZ}</p>${bilder}`;
}

// ------------------------------------------------------------------------------------------------
// DIE NUTZLAST — EINE BENANNTE NACHBILDUNG VON `rwLadung`.
// ------------------------------------------------------------------------------------------------
//
// Wörtlich aus `apps/web/public/word-addin/rueckweg.js:600-614`:
//
//     function rwLadung(aktion, html, text, version) {
//       var statement = text.trim();
//       var bauen = function (koerper) {
//         if (aktion === "propose") {
//           // Fall 2/3: der Vorschlag traegt DIESELBEN vier Felder wie der Einreichweg der
//           // Web-Flaeche (statement, bodyHtml, baseVersion, origin) — nicht mehr und nicht weniger.
//           return JSON.stringify({
//             action: "propose",
//             proposal: {
//               statement: statement,
//               bodyHtml: koerper,
//               baseVersion: version,
//               origin: "word_addin"
//             }
//           });
//
// DIESE FUNKTION IST NICHT DAS ADD-IN und behauptet es nirgends. Sie ist die vom TEST erzeugte
// Nutzlast IM FORMAT des Add-ins. Dass das Format noch dasselbe ist, misst `tor-zeuge.test.ts`
// gegen die Produktdatei — ohne ihn veraltete diese Nachbildung eines Tages still.
//
// `statement` wird hier GETRIMMT, weil `rwLadung` es trimmt. Die Feldreihenfolge ist die des
// Add-ins; `JSON.stringify` folgt der Einfügereihenfolge, damit ist auch die Zeichenkette gleich.

export interface RwNutzlast {
  readonly action: "propose";
  readonly proposal: {
    readonly statement: string;
    readonly bodyHtml: string;
    readonly baseVersion: number;
    readonly origin: "word_addin";
  };
}

export function nutzlastWieRwLadung(arg: {
  statement: string;
  bodyHtml: string;
  baseVersion: number;
}): RwNutzlast {
  return {
    action: "propose",
    proposal: {
      statement: arg.statement.trim(),
      bodyHtml: arg.bodyHtml,
      baseVersion: arg.baseVersion,
      origin: "word_addin",
    },
  };
}

/** Der Vorschlagstext, den der Experte aus Word zurückgibt. */
export const STATEMENT = "Dichtung an Ventil X bei jeder Sichtprüfung tauschen.";

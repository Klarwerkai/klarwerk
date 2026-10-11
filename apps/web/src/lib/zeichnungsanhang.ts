// ================================================================================================
// PLAN-SPRACHANMERKUNG (R-1625, R-2177) · NACHARBEIT 2 — DIE HOCHGELADENE ZEICHNUNG ALS BILD.
// ================================================================================================
//
// R-1625 beschreibt den Arbeitsweg wörtlich: „Konstrukteure können CAD-Zeichnungen oder PDFs
// hochladen, eine Stelle antippen und sprechen". Die erste Lieferung verankerte nur an Bildern IM
// Text. Diese Datei macht einen ANHANG des Wissensobjekts zu einem Bild, auf das dieselbe
// `Zeichnung` (Marke, Tipp, Tastaturweg) gesetzt werden kann:
//
//   · PDF  — eine Seite, gezeichnet von DERSELBEN pdfjs-Engine, mit der das Erfassen PDFs liest
//            (`files.ts`, `pdfEngine`). Die Notiz merkt sich die Seite.
//   · DXF  — die offene Austauschform von CAD-Zeichnungen (Text). Gezeichnet werden Linien,
//            Polylinien, Kreise und Bögen des ENTITIES-Abschnitts als SVG — nur Zahlen, kein
//            übernommener Text, deshalb ohne Einschleuserisiko. Andere Elemente (Bemaßung, Text,
//            Schraffur, Blockreferenzen) werden NICHT gezeichnet und als Zahl ausgewiesen.
//   · Bild — PNG/JPEG/GIF/WebP direkt über den Rohweg des Objektspeichers.
//   · DWG  — das geschlossene Binärformat. Es gibt im Werk keinen Leser dafür; die Fläche sagt das
//            und nennt den Ausweg (als PDF oder DXF exportieren), statt etwas zu zeigen, das nicht
//            die Zeichnung ist.
//
// DIE POSITION BLEIBT RELATIV (0..1) zur gezeichneten Seite — dieselbe Normalform wie im Text.
import type { KoDiskussionsStelle } from "../api/endpoints";
import { objectRawHref } from "./bodyFileLink";
import { pdfEngine } from "./files";
import { stellenFingerabdruck } from "./stellenabdruck";
import type { Zeichnungspunkt } from "./zeichnungspunkt";

export type ZeichnungsArt = "bild" | "pdf" | "dxf" | "dwg";

/** Was diese Datei an einem Anhang braucht. */
export interface ZeichnungsAnhang {
  objectId: string;
  name: string;
  mime: string;
}

const RASTER = /^image\/(png|jpe?g|gif|webp)$/i;

/** Welche Art Zeichnung ist dieser Anhang — oder keine (`null`)? Nach Typ, sonst nach Endung. */
export function zeichnungsArt(a: { name: string; mime: string }): ZeichnungsArt | null {
  const mime = a.mime.trim().toLowerCase();
  const name = a.name.trim().toLowerCase();
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }
  if (name.endsWith(".dxf") || mime === "image/vnd.dxf" || mime === "application/dxf") {
    return "dxf";
  }
  if (name.endsWith(".dwg") || mime === "image/vnd.dwg" || mime === "application/acad") {
    return "dwg";
  }
  if (RASTER.test(mime)) {
    return "bild";
  }
  return null;
}

/** Der MIME-Typ, mit dem eine gewählte Zeichnungsdatei gespeichert wird (Browser liefern oft "" ). */
export function zeichnungsMime(datei: { name: string; type: string }): string {
  if (datei.type.trim().length > 0) {
    return datei.type;
  }
  const name = datei.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (name.endsWith(".dxf")) {
    return "image/vnd.dxf";
  }
  if (name.endsWith(".dwg")) {
    return "image/vnd.dwg";
  }
  return "application/octet-stream";
}

/** Die Dateiauswahl für „Zeichnung anhängen". */
export const ZEICHNUNG_ACCEPT =
  ".pdf,application/pdf,.dxf,image/vnd.dxf,application/dxf,.dwg,image/vnd.dwg";

/**
 * Die Stelle an einem Anhang — Kennung ist die `objectId`, der Abdruck derselbe wie im Dienst
 * (`stelleAmAnhang`): Art `anhang`, leerer Abschnitt, Kennung.
 */
export function anhangStelle(
  objectId: string,
  koVersion: number,
  seite?: number,
  punkt?: Zeichnungspunkt,
): KoDiskussionsStelle {
  return {
    koVersion,
    art: "anhang",
    abschnitt: "",
    text: objectId,
    fingerabdruck: stellenFingerabdruck("anhang", "", objectId),
    ...(seite !== undefined ? { seite } : {}),
    ...(punkt ? { punkt } : {}),
  };
}

// ---- DXF ----------------------------------------------------------------------------------------

interface Strecke {
  art: "linie" | "zug";
  punkte: [number, number][];
  /**
   * NACHARBEIT 6 (BEN) — die KRÜMMUNG je Eckpunkt (DXF-Gruppencode 42, „bulge"): sie gilt für das
   * Segment VON diesem Punkt zum nächsten. 0 = gerade; sonst tan(¼ des eingeschlossenen Winkels),
   * positiv = gegen den Uhrzeigersinn. Vorher wurde sie verworfen und jeder Bogen als Gerade
   * gezeichnet — eine Notiz konnte so an einer Stelle landen, die es in der Zeichnung nicht gibt.
   */
  kruemmung: number[];
  geschlossen: boolean;
}
interface Kreisbogen {
  art: "kreis" | "bogen";
  x: number;
  y: number;
  r: number;
  von: number;
  bis: number;
}
type DxfElement = Strecke | Kreisbogen;

/**
 * Linie oder Polylinie? Eine AUSDRÜCKLICHE Typprüfung: der Vergleich `art === "linie" || …` allein
 * verengte den Typ im Build nicht (TS2339 auf `x`/`r` im Kreiszweig, Prüflauf nacharbeit-4).
 */
function istStrecke(e: DxfElement): e is Strecke {
  return e.art === "linie" || e.art === "zug";
}

/** Ein gekrümmtes Segment als Kreisbogen: Mitte, Radius, Startwinkel und Spanne (Bogenmass). */
interface Segmentbogen {
  cx: number;
  cy: number;
  r: number;
  start: number;
  /** Vorzeichenbehaftet: positiv = gegen den Uhrzeigersinn (wie in CAD). */
  spanne: number;
}

/**
 * Der Kreisbogen zwischen zwei Eckpunkten mit Krümmung `b` — `null` bei geradem Segment. Formeln
 * der DXF-Referenz: Spanne = 4·atan(b), Radius = s·(1+b²)/(4|b|) bei Sehnenlänge s; die Mitte liegt
 * auf der Mittelsenkrechten der Sehne, links der Laufrichtung im Abstand s·(1−b²)/(4b).
 */
function segmentBogen(
  von: [number, number],
  nach: [number, number],
  b: number,
): Segmentbogen | null {
  const dx = nach[0] - von[0];
  const dy = nach[1] - von[1];
  const sehne = Math.hypot(dx, dy);
  if (b === 0 || sehne === 0) {
    return null;
  }
  const abstand = (sehne * (1 - b * b)) / (4 * b);
  const cx = (von[0] + nach[0]) / 2 - (dy / sehne) * abstand;
  const cy = (von[1] + nach[1]) / 2 + (dx / sehne) * abstand;
  return {
    cx,
    cy,
    r: (sehne * (1 + b * b)) / (4 * Math.abs(b)),
    start: Math.atan2(von[1] - cy, von[0] - cx),
    spanne: 4 * Math.atan(b),
  };
}

interface Segment {
  von: [number, number];
  nach: [number, number];
  bogen: Segmentbogen | null;
}

/** Die Segmente eines Zuges (bei geschlossenem Zug samt dem Schlusssegment zum ersten Punkt). */
function segmente(e: Strecke): Segment[] {
  const aus: Segment[] = [];
  const n = e.punkte.length;
  const anzahl = e.geschlossen && n >= 2 ? n : n - 1;
  for (let k = 0; k < anzahl; k += 1) {
    const von = e.punkte[k] as [number, number];
    const nach = e.punkte[(k + 1) % n] as [number, number];
    aus.push({ von, nach, bogen: segmentBogen(von, nach, e.kruemmung[k] ?? 0) });
  }
  return aus;
}

/** Liegt der Winkel `a` auf dem Bogen? (Richtung und Spanne wie in `Segmentbogen`.) */
function aufBogen(bogen: Segmentbogen, a: number): boolean {
  const voll = 2 * Math.PI;
  const richtung = bogen.spanne >= 0 ? 1 : -1;
  const delta = ((((a - bogen.start) * richtung) % voll) + voll) % voll;
  return delta <= Math.abs(bogen.spanne) + 1e-12;
}

export interface DxfBild {
  src: string;
  /** Gezeichnete Elemente. */
  elemente: number;
  /** Elemente im ENTITIES-Abschnitt, die diese Darstellung nicht zeichnet. */
  ausgelassen: number;
}

/** Gruppencode/Wert-Paare einer DXF-Datei. */
function paare(text: string): [number, string][] {
  const zeilen = text.split(/\r?\n/);
  const aus: [number, string][] = [];
  for (let i = 0; i + 1 < zeilen.length; i += 2) {
    const code = Number.parseInt((zeilen[i] ?? "").trim(), 10);
    if (Number.isNaN(code)) {
      return aus;
    }
    aus.push([code, (zeilen[i + 1] ?? "").trim()]);
  }
  return aus;
}

const zahl = (w: string | undefined): number => {
  const n = Number.parseFloat(w ?? "");
  return Number.isFinite(n) ? n : Number.NaN;
};

/** Die Elemente des ENTITIES-Abschnitts, soweit diese Darstellung sie zeichnet. */
function dxfElemente(text: string): { elemente: DxfElement[]; ausgelassen: number } {
  const alle = paare(text);
  const start = alle.findIndex(
    ([c, w], i) => c === 2 && w === "ENTITIES" && alle[i - 1]?.[1] === "SECTION",
  );
  if (start < 0) {
    return { elemente: [], ausgelassen: 0 };
  }
  // Je Element seine Paare sammeln (ein Element beginnt bei Code 0).
  const roh: { typ: string; felder: [number, string][] }[] = [];
  for (let i = start + 1; i < alle.length; i += 1) {
    const [code, wert] = alle[i] as [number, string];
    if (code === 0) {
      if (wert === "ENDSEC") {
        break;
      }
      roh.push({ typ: wert, felder: [] });
    } else {
      roh.at(-1)?.felder.push([code, wert]);
    }
  }
  const erstes = (f: [number, string][], code: number): number =>
    zahl(f.find(([c]) => c === code)?.[1]);
  const elemente: DxfElement[] = [];
  let ausgelassen = 0;
  let offenerZug: Strecke | null = null;
  for (const { typ, felder } of roh) {
    if (typ === "VERTEX" && offenerZug) {
      offenerZug.punkte.push([erstes(felder, 10), erstes(felder, 20)]);
      // Fehlt Code 42, ist das Segment gerade; ein unlesbarer Wert bleibt NaN und macht den Zug
      // unten ungültig, statt ihn still als Gerade zu zeichnen.
      offenerZug.kruemmung.push(felder.some(([c]) => c === 42) ? erstes(felder, 42) : 0);
      continue;
    }
    if (typ === "SEQEND") {
      if (offenerZug) {
        elemente.push(offenerZug);
      }
      offenerZug = null;
      continue;
    }
    if (typ === "LINE") {
      elemente.push({
        art: "linie",
        punkte: [
          [erstes(felder, 10), erstes(felder, 20)],
          [erstes(felder, 11), erstes(felder, 21)],
        ],
        kruemmung: [0, 0],
        geschlossen: false,
      });
    } else if (typ === "LWPOLYLINE") {
      // In der Reihenfolge der Datei: 10 eröffnet einen Eckpunkt, 20 ist sein y, 42 seine Krümmung.
      const punkte: [number, number][] = [];
      const kruemmung: number[] = [];
      for (const [c, w] of felder) {
        if (c === 10) {
          punkte.push([zahl(w), Number.NaN]);
          kruemmung.push(0);
        } else if (c === 20 && punkte.length > 0) {
          (punkte[punkte.length - 1] as [number, number])[1] = zahl(w);
        } else if (c === 42 && kruemmung.length > 0) {
          kruemmung[kruemmung.length - 1] = zahl(w);
        }
      }
      elemente.push({
        art: "zug",
        punkte,
        kruemmung,
        geschlossen: (erstes(felder, 70) & 1) === 1,
      });
    } else if (typ === "POLYLINE") {
      offenerZug = {
        art: "zug",
        punkte: [],
        kruemmung: [],
        geschlossen: (erstes(felder, 70) & 1) === 1,
      };
    } else if (typ === "CIRCLE" || typ === "ARC") {
      elemente.push({
        art: typ === "CIRCLE" ? "kreis" : "bogen",
        x: erstes(felder, 10),
        y: erstes(felder, 20),
        r: erstes(felder, 40),
        von: typ === "ARC" ? erstes(felder, 50) : 0,
        bis: typ === "ARC" ? erstes(felder, 51) : 360,
      });
    } else {
      ausgelassen += 1;
    }
  }
  const gueltig = elemente.filter((e) =>
    istStrecke(e)
      ? e.punkte.length >= 2 &&
        e.punkte.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)) &&
        e.kruemmung.every(Number.isFinite)
      : [e.x, e.y, e.r, e.von, e.bis].every(Number.isFinite) && e.r > 0,
  );
  return { elemente: gueltig, ausgelassen: ausgelassen + (elemente.length - gueltig.length) };
}

const fmt = (n: number): string => String(Math.round(n * 1000) / 1000);

/**
 * Eine DXF-Zeichnung als SVG-Bild (Daten-URL). `null`, wenn der ENTITIES-Abschnitt nichts
 * Zeichenbares enthält — dann gibt es keine Zeichnung, auf die eine Marke gehörte.
 */
export function dxfAlsBild(text: string): DxfBild | null {
  const { elemente, ausgelassen } = dxfElemente(text);
  if (elemente.length === 0) {
    return null;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const nimm = (x: number, y: number): void => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const e of elemente) {
    if (istStrecke(e)) {
      for (const [x, y] of e.punkte) {
        nimm(x, y);
      }
      // Ein gekrümmtes Segment reicht über seine Eckpunkte hinaus: dazu zählen die Achsenpunkte
      // (0°, 90°, 180°, 270°) des Kreises, die auf dem Bogen liegen.
      for (const { bogen } of segmente(e)) {
        for (let k = 0; bogen && k < 4; k += 1) {
          const a = (k * Math.PI) / 2;
          if (aufBogen(bogen, a)) {
            nimm(bogen.cx + bogen.r * Math.cos(a), bogen.cy + bogen.r * Math.sin(a));
          }
        }
      }
    } else {
      nimm(e.x - e.r, e.y - e.r);
      nimm(e.x + e.r, e.y + e.r);
    }
  }
  const breite = Math.max(maxX - minX, 1e-6);
  const hoehe = Math.max(maxY - minY, 1e-6);
  const rand = Math.max(breite, hoehe) * 0.02;
  // CAD zählt y nach OBEN, SVG nach UNTEN: gespiegelt wird über y' = maxY - y. Damit entspricht
  // eine Marke bei (x, y) im Bild genau der gezeichneten Stelle.
  const px = (x: number): string => fmt(x - minX + rand);
  const py = (y: number): string => fmt(maxY - y + rand);
  const pfade = elemente.map((e) => {
    if (istStrecke(e)) {
      // Gerade Segmente als L, gekrümmte als Kreisbogen A — mit derselben Richtungsregel wie ARC
      // (gegen den Uhrzeigersinn in CAD = `sweep-flag` 0 nach der Spiegelung). Ein gerades
      // Schlusssegment zeichnet `Z`; ein gekrümmtes steht ausdrücklich davor.
      const [erster] = e.punkte as [[number, number]];
      const teile = [`M${px(erster[0])} ${py(erster[1])}`];
      const alle = segmente(e);
      for (let k = 0; k < alle.length; k += 1) {
        const { nach, bogen } = alle[k] as Segment;
        const schluss = e.geschlossen && k === e.punkte.length - 1;
        if (bogen) {
          const gross = Math.abs(bogen.spanne) > Math.PI ? 1 : 0;
          const sweep = bogen.spanne > 0 ? 0 : 1;
          const r = fmt(bogen.r);
          teile.push(`A${r} ${r} 0 ${gross} ${sweep} ${px(nach[0])} ${py(nach[1])}`);
        } else if (!schluss) {
          teile.push(`L${px(nach[0])} ${py(nach[1])}`);
        }
      }
      return `<path d="${teile.join(" ")}${e.geschlossen ? " Z" : ""}"/>`;
    }
    if (e.art === "kreis") {
      return `<circle cx="${px(e.x)}" cy="${py(e.y)}" r="${fmt(e.r)}"/>`;
    }
    const rad = (g: number): number => (g * Math.PI) / 180;
    const x1 = e.x + e.r * Math.cos(rad(e.von));
    const y1 = e.y + e.r * Math.sin(rad(e.von));
    const x2 = e.x + e.r * Math.cos(rad(e.bis));
    const y2 = e.y + e.r * Math.sin(rad(e.bis));
    const spanne = (((e.bis - e.von) % 360) + 360) % 360;
    // CAD zeichnet Bögen gegen den Uhrzeigersinn; nach der Spiegelung sieht das Bild aus wie in
    // CAD, der Bogen läuft auf dem Schirm also weiter gegen den Uhrzeigersinn — in SVG-Koordinaten
    // (y nach unten) die negative Winkelrichtung, also `sweep-flag` 0.
    return `<path d="M${px(x1)} ${py(y1)} A${fmt(e.r)} ${fmt(e.r)} 0 ${spanne > 180 ? 1 : 0} 0 ${px(x2)} ${py(y2)}"/>`;
  });
  const w = breite + 2 * rand;
  const h = hoehe + 2 * rand;
  const anzeigeBreite = 1000;
  const anzeigeHoehe = Math.max(1, Math.round((anzeigeBreite * h) / w));
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${anzeigeBreite}" height="${anzeigeHoehe}" viewBox="0 0 ${fmt(w)} ${fmt(h)}">`,
    `<rect x="0" y="0" width="${fmt(w)}" height="${fmt(h)}" fill="#fff"/>`,
    `<g fill="none" stroke="#111" stroke-width="1" vector-effect="non-scaling-stroke">${pfade.join("")}</g>`,
    "</svg>",
  ].join("");
  return {
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    elemente: elemente.length,
    ausgelassen,
  };
}

// ---- PDF ----------------------------------------------------------------------------------------

type Zeichenauftrag = { canvasContext: CanvasRenderingContext2D; viewport: unknown };

interface PdfZeichenSeite {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: Zeichenauftrag): { promise: Promise<void> };
}
interface PdfZeichenDokument {
  numPages: number;
  getPage(n: number): Promise<PdfZeichenSeite>;
  destroy?(): Promise<void> | void;
}

/** Zielbreite der gezeichneten Seite in Pixeln — scharf genug für Bemaßungen, nicht unbegrenzt. */
const PDF_ZIELBREITE = 1600;

async function pdfSeiteAlsBild(
  bytes: ArrayBuffer,
  seite: number,
): Promise<{ src: string; seiten: number; seite: number }> {
  const engine = await pdfEngine();
  const task = engine.getDocument({ data: new Uint8Array(bytes) });
  const doc = (await task.promise) as unknown as PdfZeichenDokument;
  try {
    const seiten = doc.numPages;
    const nummer = Math.min(Math.max(1, Math.trunc(seite)), Math.max(1, seiten));
    const page = await doc.getPage(nummer);
    const eins = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(3, PDF_ZIELBREITE / eins.width) });
    const leinwand = document.createElement("canvas");
    leinwand.width = Math.ceil(viewport.width);
    leinwand.height = Math.ceil(viewport.height);
    const kontext = leinwand.getContext("2d");
    if (!kontext) {
      throw new ZeichnungNichtDarstellbar("laden");
    }
    await page.render({ canvasContext: kontext, viewport }).promise;
    return { src: leinwand.toDataURL("image/png"), seiten, seite: nummer };
  } finally {
    await doc.destroy?.();
  }
}

// ---- Laden --------------------------------------------------------------------------------------

/** Die darstellbare Zeichnung eines Anhangs. `seiten` > 1 nur bei mehrseitigen PDFs. */
export interface AnhangsZeichnung {
  src: string;
  seiten: number;
  seite: number;
  /** DXF: Elemente, die diese Darstellung nicht zeichnet (0 sonst). */
  ausgelassen: number;
}

/**
 * Warum keine Zeichnung entsteht — als Grund, nicht als Text: die Fläche übersetzt.
 *   dwg   — geschlossenes Format, kein Leser im Werk
 *   leer  — nichts Zeichenbares in der Datei
 *   laden — die Datei liess sich nicht holen oder lesen
 */
export class ZeichnungNichtDarstellbar extends Error {
  readonly grund: "dwg" | "leer" | "laden";

  constructor(grund: "dwg" | "leer" | "laden") {
    super(`zeichnung-${grund}`);
    this.name = "ZeichnungNichtDarstellbar";
    this.grund = grund;
  }
}

async function holeOriginal(objectId: string): Promise<Response> {
  const href = objectRawHref(objectId);
  if (!href) {
    throw new ZeichnungNichtDarstellbar("laden");
  }
  // Derselbe Rohweg wie „Anhang öffnen" — dieselben Leserechte (Sitzungscookie, gleiche Herkunft).
  const antwort = await fetch(href, { credentials: "same-origin" });
  if (!antwort.ok) {
    throw new ZeichnungNichtDarstellbar("laden");
  }
  return antwort;
}

/** Die Zeichnung eines Anhangs, bei PDFs die verlangte Seite (begrenzt auf die vorhandenen). */
export async function ladeAnhangsZeichnung(
  anhang: ZeichnungsAnhang,
  seite: number,
): Promise<AnhangsZeichnung> {
  const art = zeichnungsArt(anhang);
  if (art === "dwg") {
    throw new ZeichnungNichtDarstellbar("dwg");
  }
  if (art === "bild") {
    const src = objectRawHref(anhang.objectId);
    if (!src) {
      throw new ZeichnungNichtDarstellbar("laden");
    }
    return { src, seiten: 1, seite: 1, ausgelassen: 0 };
  }
  if (art === "dxf") {
    const bild = dxfAlsBild(await (await holeOriginal(anhang.objectId)).text());
    if (!bild) {
      throw new ZeichnungNichtDarstellbar("leer");
    }
    return { src: bild.src, seiten: 1, seite: 1, ausgelassen: bild.ausgelassen };
  }
  if (art === "pdf") {
    try {
      const bytes = await (await holeOriginal(anhang.objectId)).arrayBuffer();
      return { ...(await pdfSeiteAlsBild(bytes, seite)), ausgelassen: 0 };
    } catch (fehler) {
      throw fehler instanceof ZeichnungNichtDarstellbar
        ? fehler
        : new ZeichnungNichtDarstellbar("laden");
    }
  }
  throw new ZeichnungNichtDarstellbar("leer");
}

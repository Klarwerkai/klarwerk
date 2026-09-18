// ================================================================================================
// JOB 4329 · WAS IM BROWSER ABGELESEN WIRD — ZWEI GETRENNTE MESSUNGEN, DIE NICHTS VONEINANDER WISSEN.
// ================================================================================================
//
// REGELN.md 9: „DOM-Anwesenheit und `textContent` sind kein Nachweis." Für ein Bild heisst das zwei
// verschiedene Fragen, und sie werden hier ausdrücklich NICHT vermischt:
//
//   (b1) WAS HAT DER BROWSER DEKODIERT?  Leinwand: `drawImage(bild, 0, 0)` in Eigengrösse, dann
//        `getImageData` über die GANZE Fläche. Das liest die dekodierte QUELLE. CSS geht darin
//        NICHT ein — der Eckradius der Lesefläche (`apps/web/src/index.css:116`) ändert kein
//        einziges dieser Bytes. Eine Abweichung hier ist deshalb NIE ein Darstellungsbefund,
//        sondern einer an Transport, Säuberung oder Ablage.
//
//   (b2) WAS SIEHT EIN MENSCH?  `checkVisibility()`, der berechnete Stil, das Rechteck im Fenster
//        und `elementFromPoint` in der Bildmitte. Das misst die gerenderte Fläche und sagt über den
//        Inhalt nichts.
//
//   (b3) UND WAS STEHT WIRKLICH AUF DEM SCHIRM?  Ein echtes Chromium-Bildschirmfoto des Rechtecks
//        aus (b2), in Node mit `sharp` dekodiert. Erst das verbindet (b1) und (b2): die dekodierten
//        Punkte stehen an der Stelle, an der das sichtbare Rechteck liegt.
//
// JEDER BEFUND TRÄGT SEINEN EIGENEN FEHLGRUND (`fehler`). Ein ausgefallener Messweg ist ein
// MASCHINENFEHLER und kein Inhaltsbefund — die Lehre aus `archiv/4304/runde-2/ben.md:28`, im
// Bestand vorgelebt von `tests/d5-gesamtweg/platz.ts:544-548`. Der Fachlauf liest `fehler` zuerst.
//
// DER GRIFF ZUM BILDSCHIRMFOTO IST NEU. Unter `tests/` gibt es bisher kein `screenshot(`. Das
// Hausinterface `Seite` (`tests/gast-nutzerweg/browserweg.ts:88-97`) kennt ihn nicht, und
// `browserweg.ts` steht nicht in den Zielpfaden dieses Auftrags (§4). Das echte Playwright-Objekt
// kann es; es wird deshalb HIER, in der eigenen Datei, auf genau diese eine Methode geschmälert.
import sharp from "sharp";
import { type Seite, fn } from "../gast-nutzerweg/browserweg";

/** Der Selektor der Bildsammlung: der Fließtext der Lesefläche, nichts daneben. */
export const BILDSAMMLUNG = '[data-testid="bib-lesen"] .prose-kw img';

export interface Rechteck {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
}

// ------------------------------------------------------------------------------------------------
// (b0) DIE SAMMLUNG — wie viele Bilder stehen da, und welche Quellen tragen sie?
// ------------------------------------------------------------------------------------------------

const QUELLEN = `(sel) => Array.from(document.querySelectorAll(sel)).map((b) => b.getAttribute("src") || "")`;

/** Die `src`-Werte der Bilder in DOKUMENTREIHENFOLGE — vollständig, nicht gekürzt. */
export function quellenLesen(seite: Seite): Promise<string[]> {
  return seite.evaluate<string[]>(fn(QUELLEN), BILDSAMMLUNG);
}

/** Der Seitenquelltext — für die Preisgabeprobe nach dem Entzug des Leserechts. */
export function seitenquelltext(seite: Seite): Promise<string> {
  return seite.evaluate<string>(fn("() => document.documentElement.outerHTML"));
}

// ------------------------------------------------------------------------------------------------
// (b1) DIE DEKODIERTEN BILDPUNKTE — vollständig, ohne Ausschnitt.
// ------------------------------------------------------------------------------------------------

export interface Punktbefund {
  index: number;
  src: string;
  complete: boolean;
  natBreite: number;
  natHoehe: number;
  /** RGBA, zeilenweise, als Base64 — leer, wenn `fehler` gesetzt ist. */
  punkteBase64: string;
  fehler: string | null;
}

const PUNKTE_LESEN = `(arg) => new Promise((fertig) => {
  const leer = (grund) => fertig({ index: arg.index, src: "", complete: false, natBreite: 0, natHoehe: 0, punkteBase64: "", fehler: grund });
  const bilder = document.querySelectorAll(arg.sel);
  if (bilder.length <= arg.index) {
    leer("die Bildsammlung hat nur " + bilder.length + " Eintraege — Bild " + (arg.index + 1) + " gibt es nicht");
    return;
  }
  const bild = bilder[arg.index];
  const src = bild.getAttribute("src") || "";
  const lesen = () => {
    if (!bild.naturalWidth || !bild.naturalHeight) {
      fertig({ index: arg.index, src: src, complete: !!bild.complete, natBreite: bild.naturalWidth || 0, natHoehe: bild.naturalHeight || 0, punkteBase64: "", fehler: "das <img> hat keine Eigengroesse — es ist nicht dekodiert worden" });
      return;
    }
    const leinwand = document.createElement("canvas");
    leinwand.width = bild.naturalWidth;
    leinwand.height = bild.naturalHeight;
    const stift = leinwand.getContext("2d");
    if (!stift) {
      leer("dieser Browser gibt keinen 2D-Zeichenstift her");
      return;
    }
    stift.drawImage(bild, 0, 0);
    try {
      const daten = stift.getImageData(0, 0, leinwand.width, leinwand.height).data;
      let roh = "";
      for (let i = 0; i < daten.length; i += 8192) {
        roh += String.fromCharCode.apply(null, daten.subarray(i, i + 8192));
      }
      fertig({ index: arg.index, src: src, complete: true, natBreite: leinwand.width, natHoehe: leinwand.height, punkteBase64: btoa(roh), fehler: null });
    } catch (e) {
      fertig({ index: arg.index, src: src, complete: true, natBreite: leinwand.width, natHoehe: leinwand.height, punkteBase64: "", fehler: "die Bildpunkte sind nicht lesbar: " + String(e) });
    }
  };
  if (bild.complete) { lesen(); return; }
  bild.onload = lesen;
  bild.onerror = () => leer("das Bild hat nicht geladen");
})`;

export function bildpunkteLesen(seite: Seite, index: number): Promise<Punktbefund> {
  return seite.evaluate<Punktbefund>(fn(PUNKTE_LESEN), { sel: BILDSAMMLUNG, index });
}

/** Die abgelesenen Punkte als Bytes — R, G, B, A je Bildpunkt, zeilenweise. */
export function punkteAlsBytes(befund: Punktbefund): Buffer {
  return Buffer.from(befund.punkteBase64, "base64");
}

// ------------------------------------------------------------------------------------------------
// (b2) SICHTBARKEIT UND GEOMETRIE — getrennt vom Inhalt.
// ------------------------------------------------------------------------------------------------

export interface Sichtbefund {
  index: number;
  /** `checkVisibility()` (Chromium ≥ 105) — nicht „ist im DOM". */
  sichtbar: boolean;
  display: string;
  visibility: string;
  opacity: string;
  rect: Rechteck;
  natBreite: number;
  natHoehe: number;
  fensterBreite: number;
  fensterHoehe: number;
  scrollX: number;
  scrollY: number;
  /** „selbst" · „nachkomme" · sonst die Beschreibung des überlagernden Elements. */
  obenAuf: string;
  fehler: string | null;
}

// Das Fenster wird VOR der Messung auf 0/0 zurückgesetzt. Grund: das Rechteck aus
// `getBoundingClientRect()` ist fensterrelativ, die Ausschnittsangabe eines Bildschirmfotos zählt
// vom Seitenanfang. Sind beide Rollwerte 0, sind die beiden Bezugssysteme dasselbe — und der
// Ausschnitt ist eindeutig, ohne dass dieser Prüfstand eine Annahme über Playwright treffen muss.
// Rollt die Lesespalte selbst (eigener Rollbereich), bleibt `window.scrollY` dabei ohnehin 0.
const SICHT_LESEN = `(arg) => {
  const leer = (grund) => ({ index: arg.index, sichtbar: false, display: "", visibility: "", opacity: "", rect: { x: 0, y: 0, breite: 0, hoehe: 0 }, natBreite: 0, natHoehe: 0, fensterBreite: window.innerWidth, fensterHoehe: window.innerHeight, scrollX: window.scrollX, scrollY: window.scrollY, obenAuf: "", fehler: grund });
  const bilder = document.querySelectorAll(arg.sel);
  if (bilder.length <= arg.index) {
    return leer("die Bildsammlung hat nur " + bilder.length + " Eintraege — Bild " + (arg.index + 1) + " gibt es nicht");
  }
  const bild = bilder[arg.index];
  if (arg.rollen) {
    bild.scrollIntoView({ block: "center", inline: "nearest" });
    window.scrollTo(0, 0);
  }
  const stil = window.getComputedStyle(bild);
  const r = bild.getBoundingClientRect();
  const mx = r.left + r.width / 2;
  const my = r.top + r.height / 2;
  const getroffen = document.elementFromPoint(mx, my);
  let obenAuf = "kein Element an der Bildmitte (ausserhalb des Fensters?)";
  if (getroffen === bild) {
    obenAuf = "selbst";
  } else if (getroffen && bild.contains(getroffen)) {
    obenAuf = "nachkomme";
  } else if (getroffen) {
    obenAuf = getroffen.tagName.toLowerCase() + "." + String(getroffen.className || "").slice(0, 60);
  }
  return {
    index: arg.index,
    sichtbar: typeof bild.checkVisibility === "function" ? bild.checkVisibility() : false,
    display: stil.display,
    visibility: stil.visibility,
    opacity: stil.opacity,
    rect: { x: r.left, y: r.top, breite: r.width, hoehe: r.height },
    natBreite: bild.naturalWidth || 0,
    natHoehe: bild.naturalHeight || 0,
    fensterBreite: window.innerWidth,
    fensterHoehe: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    obenAuf: obenAuf,
    fehler: typeof bild.checkVisibility === "function" ? null : "dieser Browser kennt checkVisibility() nicht — die Sichtbarkeit waere nicht messbar"
  };
}`;

export function sichtLesen(seite: Seite, index: number, rollen = true): Promise<Sichtbefund> {
  return seite.evaluate<Sichtbefund>(fn(SICHT_LESEN), { sel: BILDSAMMLUNG, index, rollen });
}

// ------------------------------------------------------------------------------------------------
// (b3) DAS ECHTE BILDSCHIRMFOTO — und sein in Node dekodierter Innenbereich.
// ------------------------------------------------------------------------------------------------

/** Die eine Methode des echten Playwright-Objekts, die das Hausinterface nicht führt. */
interface MitFoto {
  screenshot(o: {
    clip: { x: number; y: number; width: number; height: number };
    type: "png";
  }): Promise<Buffer>;
}

export interface Fotobefund {
  /** Der tatsächlich angeforderte Ausschnitt, auf ganze Bildpunkte gerundet. */
  ausschnitt: { x: number; y: number; width: number; height: number };
  /** Die Maße, die das Foto wirklich hat — bei Maßstab 1 gleich dem Ausschnitt. */
  fotoBreite: number;
  fotoHoehe: number;
  /** Der Innenbereich: das Foto minus `rand` je Seite. */
  innenBreite: number;
  innenHoehe: number;
  /** RGBA des Innenbereichs, zeilenweise. */
  innen: Buffer;
}

/**
 * Das Rechteck fotografieren und den Innenbereich herausschneiden.
 *
 * `rand` lässt die abgerundeten Ecken aus (13 px Radius, `apps/web/tailwind.config.ts:57`, plus
 * 1 px Kantenglättung). Die Ecken werden NICHT bewertet — sie sind schlicht nicht Teil der
 * Messung, und die Protokollzeile führt sie nicht als Befund.
 */
export async function fotoInnenbereich(
  seite: Seite,
  rect: Rechteck,
  rand: number,
): Promise<Fotobefund> {
  const ausschnitt = {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.breite),
    height: Math.round(rect.hoehe),
  };
  const png = await (seite as unknown as MitFoto).screenshot({ clip: ausschnitt, type: "png" });
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const innenBreite = info.width - 2 * rand;
  const innenHoehe = info.height - 2 * rand;
  const innen = Buffer.alloc(Math.max(0, innenBreite) * Math.max(0, innenHoehe) * 4);
  if (innenBreite > 0 && innenHoehe > 0) {
    for (let y = 0; y < innenHoehe; y += 1) {
      const von = ((y + rand) * info.width + rand) * 4;
      data.copy(innen, y * innenBreite * 4, von, von + innenBreite * 4);
    }
  }
  return {
    ausschnitt,
    fotoBreite: info.width,
    fotoHoehe: info.height,
    innenBreite,
    innenHoehe,
    innen,
  };
}

// ------------------------------------------------------------------------------------------------
// DIE KALIBRIERUNG (i) — EIN BILD GEZIELT AUSBLENDEN, MIT VORBEDINGUNGSNACHWEIS.
// ------------------------------------------------------------------------------------------------
//
// KEIN `img:nth-of-type(2)`: bei zwei getrennten `<p><img></p>` ist jedes `<img>` das erste seines
// Elternteils — der Selektor träfe KEINES, und die Kalibrierung wäre rot, ohne etwas ausgeblendet
// zu haben (Codex 17.09. 20:03, Punkt 1). Der Griff geht deshalb über die Sammlung und belegt jeden
// seiner Schritte: erst die Zahl der Bilder, dann die Kennung der Quelle, dann das Verschwinden.

export interface Ausblendbefund {
  anzahl: number;
  /** Die ersten und letzten 64 Zeichen der `src` — die Kennung, gegen die Node vergleicht. */
  srcAnfang: string;
  srcEnde: string;
  srcLaenge: number;
  /** Nach dem Setzen von `display: none`. */
  breiteDanach: number;
  hoeheDanach: number;
  sichtbarDanach: boolean;
  fehler: string | null;
}

const AUSBLENDEN = `(arg) => {
  const bilder = document.querySelectorAll(arg.sel);
  const leer = (grund) => ({ anzahl: bilder.length, srcAnfang: "", srcEnde: "", srcLaenge: 0, breiteDanach: -1, hoeheDanach: -1, sichtbarDanach: true, fehler: grund });
  if (bilder.length <= arg.index) {
    return leer("Vorbedingung verletzt: die Bildsammlung hat nur " + bilder.length + " Eintraege");
  }
  const bild = bilder[arg.index];
  const src = bild.getAttribute("src") || "";
  bild.style.display = "none";
  const r = bild.getBoundingClientRect();
  return {
    anzahl: bilder.length,
    srcAnfang: src.slice(0, 64),
    srcEnde: src.slice(-64),
    srcLaenge: src.length,
    breiteDanach: r.width,
    hoeheDanach: r.height,
    sichtbarDanach: typeof bild.checkVisibility === "function" ? bild.checkVisibility() : true,
    fehler: null
  };
}`;

export function bildAusblenden(seite: Seite, index: number): Promise<Ausblendbefund> {
  return seite.evaluate<Ausblendbefund>(fn(AUSBLENDEN), { sel: BILDSAMMLUNG, index });
}

// ------------------------------------------------------------------------------------------------
// DER VERGLEICH — und warum er die STELLE nennt, an der es zuerst auseinanderläuft.
// ------------------------------------------------------------------------------------------------
//
// `toEqual` über 24576 Zahlen meldet „arrays differ" und lässt den Leser zählen. Wer einen Befund
// zuordnen können soll (Transport? Säuberung? Darstellung?), braucht die Koordinate.

export interface Abweichung {
  index: number;
  x: number;
  y: number;
  erwartet: [number, number, number, number];
  gemessen: [number, number, number, number];
}

/** Die erste Stelle, an der zwei RGBA-Reihen auseinanderlaufen — oder `null`. */
export function ersteAbweichung(
  erwartet: Uint8Array | Buffer,
  gemessen: Uint8Array | Buffer,
  breite: number,
): Abweichung | null {
  const laenge = Math.min(erwartet.length, gemessen.length);
  for (let i = 0; i < laenge; i += 1) {
    if (erwartet[i] !== gemessen[i]) {
      const punkt = Math.floor(i / 4);
      return {
        index: i,
        x: punkt % breite,
        y: Math.floor(punkt / breite),
        erwartet: [
          erwartet[punkt * 4] as number,
          erwartet[punkt * 4 + 1] as number,
          erwartet[punkt * 4 + 2] as number,
          erwartet[punkt * 4 + 3] as number,
        ],
        gemessen: [
          gemessen[punkt * 4] as number,
          gemessen[punkt * 4 + 1] as number,
          gemessen[punkt * 4 + 2] as number,
          gemessen[punkt * 4 + 3] as number,
        ],
      };
    }
  }
  return null;
}

/** Die Zahl verschiedener Farben in einer RGBA-Reihe — ein einfarbiger Fleck darf nie grün sein. */
export function farbzahl(rgba: Uint8Array | Buffer): number {
  const farben = new Set<number>();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    farben.add(
      ((rgba[i] as number) << 24) |
        ((rgba[i + 1] as number) << 16) |
        ((rgba[i + 2] as number) << 8) |
        (rgba[i + 3] as number),
    );
  }
  return farben.size;
}

// ================================================================================================
// OCR-E01 · FUNDSTELLEN AM ORIGINAL (Auftrag produkt:20261012:klara-ocr-fundstellen-korrekturen).
// ================================================================================================
//
// Eine erkannte Textstelle führt zu IHREM Bild (Quelle · Folie/Bild, `BildFundstelle`) und — soweit
// die Texterkennung einen Wortrahmen geliefert hat — zum Bereich im Bild. Diese Datei rechnet:
//
//   · `textStellen` — der angezeigte Text (Rohbefund mit `[?wort]`/`[unleserlich]` ODER die
//     Berichtigung) in Stellen zerlegt; jede Stelle kennt das Wort der Erkennung an ihrer Position.
//     Die Zuordnung ist eine Ausrichtung über die Wortfolge: Gleiches bleibt gleich, ein berichtigtes
//     Wort steht an der Stelle des ursprünglich erkannten (`ersetzt`), Ergänztes hat keine Position.
//   · `markierung` — der Bereich in Prozent des Bildrahmens, in dem die Erkennung gemessen hat, und
//     die Drehung, mit der dieser Rahmen angezeigt werden muss. Gibt es keinen verlässlichen Rahmen
//     (keine Wortrahmen, unbekanntes Format, unklare Drehangabe, Rahmen außerhalb des Bildes), ist
//     das Ergebnis `ohne-position` mit Grund — es wird NIE eine Position erfunden.
//   · `ansichtsMasse` — die Größe der Bühne für Drehen (90°-Schritte) und Vergrößern. Bild und
//     Markierung liegen im selben gedrehten und skalierten Rahmen; die Markierung folgt dem Bild
//     deshalb bei jeder Drehung und Größe.
//
// DOM-FREI und nur lesend.

import type { BildFundstelle, BildQuelleEingang } from "./bildAutomatik";
import type { BildRahmen, WortPosition } from "./bildRahmen";

// ------------------------------------------------------------------------------------------------
// Das Original
// ------------------------------------------------------------------------------------------------

/**
 * Das Originalbild einer Fundstelle aus dem Eingang, aus dem gelesen wurde: dieselbe Quelle, dieselbe
 * Position und derselbe Anker. So zeigt eine Folie nie das Bild einer anderen Folie.
 */
export function originalAusEingang(
  eingang: BildQuelleEingang | null | undefined,
  f: BildFundstelle,
): string | null {
  const v = eingang?.vorkommen.find(
    (x) =>
      x.fundstelle.quelle === f.quelle &&
      x.fundstelle.bild === f.bild &&
      (x.fundstelle.imageId ?? "") === (f.imageId ?? "") &&
      x.fundstelle.seite === f.seite &&
      x.fundstelle.folie === f.folie,
  );
  return v?.src ?? null;
}

// ------------------------------------------------------------------------------------------------
// Textstellen
// ------------------------------------------------------------------------------------------------

export interface TextStelle {
  /** Wo die Stelle im Text beginnt (Zeichenversatz) — zugleich ihre Kennung. */
  start: number;
  /** Leerraum vor der Stelle, wie im Text (Zeilenumbrüche bleiben). */
  vor: string;
  /** Die Stelle, wie sie angezeigt wird. */
  text: string;
  /** Das Wort der Erkennung an dieser Position — `null`: keine Position bekannt. */
  wort: number | null;
  /** Die Stelle weicht vom erkannten Wort an ihrer Position ab (berichtigt oder unleserlich). */
  ersetzt: boolean;
}

/** `[?wort]` → `wort`; `[unleserlich]` bleibt (kein Wort, aber eine Stelle). */
function kern(token: string): string {
  const m = /^\[\?(.*)\]$/.exec(token);
  return (m ? (m[1] ?? "") : token).toLocaleLowerCase();
}

/** Ab dieser Größe wird nur noch exakt zugeordnet (Speicher und Zeit der Ausrichtung). */
const AUSRICHTUNG_MAX_ZELLEN = 250_000;

const UNLESERLICH = "[unleserlich]";

/** Editierdistanz zweier (kurzer) Wörter in Zeichen. */
function zeichenAbstand(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  let vorher = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const jetzt = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const ersetzen = (vorher[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      jetzt[j] = Math.min((vorher[j] ?? 0) + 1, (jetzt[j - 1] ?? 0) + 1, ersetzen);
    }
    vorher = jetzt;
  }
  return vorher[b.length] ?? 0;
}

/**
 * Was es kostet, `a` an die Stelle von `b` zu setzen: gleich 0; ähnlich (ein berichtigter Lesefehler
 * wie „Mül1er“ → „Müller“, „1.5OO“ → „1.500“) oder unleserlich 1; sonst 2 — so teuer wie Weglassen
 * und Ergänzen. Ein unähnliches Wort übernimmt deshalb nie die Position eines anderen.
 */
function ersetzKosten(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a === UNLESERLICH) {
    return 1;
  }
  const grenze = Math.max(1, Math.ceil(Math.max(a.length, b.length) / 2));
  return zeichenAbstand(a, b) <= grenze ? 1 : 2;
}

/**
 * Ordnet jedem Token `a[i]` ein Wort `b[j]` zu: gleiche Wörter, an derselben Stelle ersetzte
 * ÄHNLICHE Wörter (berichtigte Lesefehler, `[unleserlich]`) — oder `null` für Ergänztes und für
 * Unähnliches. Kleinste gewichtete Editierdistanz auf der Wortfolge (Nacharbeit 2: vorher konnte
 * bei gleichen Kosten ein fremdes Wort die Position eines berichtigten übernehmen).
 */
export function ausrichten(
  a: readonly string[],
  b: readonly string[],
): { wort: number | null; ersetzt: boolean }[] {
  const n = a.length;
  const m = b.length;
  if (n === 0) {
    return [];
  }
  if (m === 0) {
    return a.map(() => ({ wort: null, ersetzt: false }));
  }
  if ((n + 1) * (m + 1) > AUSRICHTUNG_MAX_ZELLEN) {
    // Zu groß für die volle Tabelle: nur exakte Treffer in Lesereihenfolge.
    let j = 0;
    return a.map((t) => {
      for (let k = j; k < Math.min(m, j + 3); k += 1) {
        if (b[k] === t) {
          j = k + 1;
          return { wort: k, ersetzt: false };
        }
      }
      return { wort: null, ersetzt: false };
    });
  }
  const breite = m + 1;
  const d = new Uint32Array((n + 1) * breite);
  for (let i = 0; i <= n; i += 1) {
    d[i * breite] = i;
  }
  for (let j = 0; j <= m; j += 1) {
    d[j] = j;
  }
  // Die Ersetzungskosten einmal je Paar — sie werden beim Rückweg wieder gebraucht.
  const kosten = new Uint8Array(n * m);
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const k = ersetzKosten(a[i - 1] ?? "", b[j - 1] ?? "");
      kosten[(i - 1) * m + j - 1] = k;
      const diag = (d[(i - 1) * breite + j - 1] ?? 0) + k;
      const oben = (d[(i - 1) * breite + j] ?? 0) + 1;
      const links = (d[i * breite + j - 1] ?? 0) + 1;
      d[i * breite + j] = Math.min(diag, oben, links);
    }
  }
  const aus: { wort: number | null; ersetzt: boolean }[] = a.map(() => ({
    wort: null,
    ersetzt: false,
  }));
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const hier = d[i * breite + j] ?? 0;
    const k = kosten[(i - 1) * m + j - 1] ?? 2;
    if (k < 2 && hier === (d[(i - 1) * breite + j - 1] ?? 0) + k) {
      aus[i - 1] = { wort: j - 1, ersetzt: k > 0 };
      i -= 1;
      j -= 1;
    } else if (hier === (d[(i - 1) * breite + j] ?? 0) + 1) {
      i -= 1;
    } else if (hier === (d[i * breite + j - 1] ?? 0) + 1) {
      j -= 1;
    } else {
      // Nur über eine unähnliche Ersetzung erreichbar: beide ohne Zuordnung.
      i -= 1;
      j -= 1;
    }
  }
  return aus;
}

/**
 * Der angezeigte Text in Stellen, jede mit dem Wort der Erkennung an ihrer Position. `woerter` sind
 * die Wörter der Erkennung in Lesereihenfolge (mit Rahmen). Ohne Wörter hat keine Stelle eine
 * Position.
 */
export function textStellen(
  text: string,
  woerter: readonly WortPosition[] | undefined,
): TextStelle[] {
  const stellen: { start: number; vor: string; text: string }[] = [];
  const re = /(\s*)(\S+)/g;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    const vor = m[1] ?? "";
    stellen.push({ start: m.index + vor.length, vor, text: m[2] ?? "" });
  }
  const zuordnung = ausrichten(
    stellen.map((s) => kern(s.text)),
    (woerter ?? []).map((w) => w.text.toLocaleLowerCase()),
  );
  return stellen.map((s, i) => {
    const z = zuordnung[i];
    return { ...s, wort: z?.wort ?? null, ersetzt: z?.ersetzt ?? false };
  });
}

// ------------------------------------------------------------------------------------------------
// Die Markierung
// ------------------------------------------------------------------------------------------------

export type OhnePositionGrund =
  /** Die Erkennung hat für dieses Bild keine Wortrahmen geliefert. */
  | "keine-positionen"
  /** Diese Stelle hat kein Wort der Erkennung an ihrer Position (z. B. ergänzt). */
  | "ohne-zuordnung"
  /** Die Bildmaße sind aus den Bytes nicht lesbar (Format unbekannt, kein Zugriff). */
  | "keine-masse"
  /** Das Bild trägt eine Drehangabe, deren Bezug zu den Wortrahmen nicht eindeutig ist. */
  | "drehung-unklar"
  /** Die Wortrahmen passen nicht in das Bild — dann stimmt der Bezug nicht. */
  | "ausserhalb";

export interface Bereich {
  /** Prozent des Bildrahmens (0–100). */
  links: number;
  oben: number;
  breite: number;
  hoehe: number;
}

export type Drehung = 0 | 90 | 180 | 270;

export type Markierung =
  | {
      art: "bereich";
      bereiche: Bereich[];
      /** Der Rahmen, in dem gemessen wurde (Pixel) — so groß wird das Bild angezeigt. */
      rahmen: { breite: number; hoehe: number };
      /**
       * `true`: das Bild wird MIT seiner Drehangabe angezeigt (die Erkennung hat im gedrehten Bild
       * gemessen). `false`: es wird ohne angezeigt und der Rahmen um `drehung` gedreht.
       */
      drehangabeAnwenden: boolean;
      /** Die Drehung des Rahmens, damit das Bild so steht wie im Original. */
      drehung: Drehung;
    }
  | { art: "ohne-position"; grund: OhnePositionGrund };

/** Kleine Messtoleranz der Erkennung am Bildrand (Pixel und Anteil). */
const RAND = 2;
const RAND_ANTEIL = 0.01;

function passtIn(woerter: readonly WortPosition[], breite: number, hoehe: number): boolean {
  const bx = breite * (1 + RAND_ANTEIL) + RAND;
  const hy = hoehe * (1 + RAND_ANTEIL) + RAND;
  const passt = (w: WortPosition): boolean =>
    w.x0 >= -RAND && w.y0 >= -RAND && w.x1 <= bx && w.y1 <= hy && w.x1 > w.x0 && w.y1 > w.y0;
  return woerter.every(passt);
}

function begrenzt(wert: number): number {
  return Math.min(100, Math.max(0, wert));
}

/** Was eine Markierung vom Befund braucht (`BildBefund.woerter`, `BildBefund.rahmen`). */
export interface MarkierungsGrundlage {
  woerter?: readonly WortPosition[] | undefined;
  rahmen?: BildRahmen | null | undefined;
}

/**
 * Der markierte Bereich für die Wörter `wortIndizes` eines Befunds. Alle Wörter der Erkennung gehen
 * in die Prüfung ein, in welchem Rahmen gemessen wurde — nicht nur die gewählten.
 */
export function markierung(
  befund: MarkierungsGrundlage,
  wortIndizes: readonly (number | null)[],
): Markierung {
  const woerter = befund.woerter ?? [];
  if (woerter.length === 0) {
    return { art: "ohne-position", grund: "keine-positionen" };
  }
  const gewaehlt: WortPosition[] = [];
  for (const i of wortIndizes) {
    const w = i === null ? undefined : woerter[i];
    if (w) {
      gewaehlt.push(w);
    }
  }
  if (gewaehlt.length === 0) {
    return { art: "ohne-position", grund: "ohne-zuordnung" };
  }
  const rahmen = befund.rahmen;
  if (!rahmen) {
    return { art: "ohne-position", grund: "keine-masse" };
  }
  const { breite: b, hoehe: h, orientierung: o } = rahmen;
  let rahmenMass: { breite: number; hoehe: number };
  let drehangabeAnwenden = false;
  let drehung: Drehung = 0;
  if (o === 1) {
    if (!passtIn(woerter, b, h)) {
      return { art: "ohne-position", grund: "ausserhalb" };
    }
    rahmenMass = { breite: b, hoehe: h };
  } else if (o === 6 || o === 8) {
    // Gedrehtes Foto (90° bzw. 270°): gemessen wurde entweder im gespeicherten Rahmen (b × h) oder
    // im angezeigten (h × b). Nur wenn GENAU einer passt, ist der Bezug eindeutig.
    const roh = passtIn(woerter, b, h);
    const angezeigt = passtIn(woerter, h, b);
    if (roh && !angezeigt) {
      rahmenMass = { breite: b, hoehe: h };
      drehung = o === 6 ? 90 : 270;
    } else if (angezeigt && !roh) {
      rahmenMass = { breite: h, hoehe: b };
      drehangabeAnwenden = true;
    } else {
      return { art: "ohne-position", grund: "drehung-unklar" };
    }
  } else {
    // 0 (unbekannt), 3 (180°: beide Rahmen gleich groß, nicht unterscheidbar), gespiegelt (2, 4, 5, 7).
    return { art: "ohne-position", grund: "drehung-unklar" };
  }
  const rb = rahmenMass.breite;
  const rh = rahmenMass.hoehe;
  const bereiche = gewaehlt.map((w) => ({
    links: begrenzt((w.x0 / rb) * 100),
    oben: begrenzt((w.y0 / rh) * 100),
    breite: begrenzt(((w.x1 - w.x0) / rb) * 100),
    hoehe: begrenzt(((w.y1 - w.y0) / rh) * 100),
  }));
  return { art: "bereich", bereiche, rahmen: rahmenMass, drehangabeAnwenden, drehung };
}

// ------------------------------------------------------------------------------------------------
// Die Bühne: Drehen und Vergrößern
// ------------------------------------------------------------------------------------------------

export interface AnsichtsMasse {
  /** Die Fläche, die das gedrehte Bild belegt (Pixel). */
  aussenBreite: number;
  aussenHoehe: number;
  /** Der Rahmen von Bild und Markierung vor der Drehung (Pixel). */
  innenBreite: number;
  innenHoehe: number;
  /** Die gesamte Drehung des Rahmens. */
  drehung: Drehung;
}

export function gesamtDrehung(a: number, b: number): Drehung {
  return ((((a + b) % 360) + 360) % 360) as Drehung;
}

/**
 * `rahmen` ist die Größe des Bildes; `drehung` die Gesamtdrehung; `zoom` ein Faktor (1 = so breit
 * wie `maxBreite` erlaubt, höchstens Originalgröße).
 */
export function ansichtsMasse(
  rahmen: { breite: number; hoehe: number },
  drehung: Drehung,
  zoom: number,
  maxBreite: number,
): AnsichtsMasse {
  const quer = drehung === 90 || drehung === 270;
  const sichtBreite = quer ? rahmen.hoehe : rahmen.breite;
  const basis = Math.min(1, maxBreite / Math.max(1, sichtBreite));
  const faktor = basis * zoom;
  const innenBreite = Math.round(rahmen.breite * faktor);
  const innenHoehe = Math.round(rahmen.hoehe * faktor);
  return {
    innenBreite,
    innenHoehe,
    aussenBreite: quer ? innenHoehe : innenBreite,
    aussenHoehe: quer ? innenBreite : innenHoehe,
    drehung,
  };
}

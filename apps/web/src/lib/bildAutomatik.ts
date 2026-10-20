// ================================================================================================
// OCR-02 · KLARA LIEST BEREITGESTELLTE BILDER AUTOMATISCH (Auftrag
// produkt:20261012:klara-bildanalyse-ocr-automatik, Integrationsplan docs/klara-bildanalyse-ocr/).
// ================================================================================================
//
// Peter, 12.10.2026: „sofort automatisch mitlesen." Ein bereitgestelltes Bild und die eingebetteten
// Bilder eines Dokuments werden beim Eingang gelesen — ohne Klick auf „OCR → Text".
//
// DIESE DATEI IST DOM-FREI. Die Wege werden injiziert:
//   · `erkenne` — die vorhandene Texterkennung `runImageOcr` (W01, `lib/files.ts`). Text hat Vorrang.
//   · `beschreibe` — der vorhandene Bildbeschreibungsweg W02 (`/api/reasoner/describe`) mit der
//     Herkunft der jeweiligen Fläche. Ob ein Modell das Bild sehen DARF, entscheidet weiterhin der
//     Server (Vertraulichkeitsregel); diese Datei liest nur das Ergebnis und weist es aus.
//   · `ladeBild` — Bilder, die nicht als data-URL vorliegen (Objektspeicher), über den vorhandenen,
//     berechtigten Lesezugriff holen.
// Es gibt keine zweite Engine und keinen neuen Datenweg.
//
// WAS SIE ZUSAGT, und was nicht:
//   · Jeder Befund trägt seine Fundstelle: Quelle, Bild in Dokumentreihenfolge, bei PowerPoint die
//     Folie und das Bild auf dieser Folie (L04).
//   · Gleiche Bildbytes (`sha256`, wie W16) heißen gleicher Befund, ohne neue Analyse. Andere Bytes
//     heißen neue Analyse; ein Befund gehört immer zu genau der Inhaltskennung, aus der er stammt.
//     Fehlgeschlagene Läufe werden nicht gemerkt — ein neuer Eingang versucht es erneut. Nur ein
//     AUSDRÜCKLICHER Auftrag (`neu`) erkennt dasselbe Bild noch einmal.
//   · Unsichere Wörter werden markiert (`[?wort]`), sehr unsichere als `[unleserlich]` ersetzt. Es
//     wird nichts ergänzt.
//   · Tabellen: nur wenn mindestens zwei Zeilen mit mindestens zwei Spalten an denselben Kanten
//     ausgerichtet sind, entsteht eine Tabelle — sonst keine (kein Raten).
//   · Bildinhalt: beschrieben, nicht zulässig (vertraulich), nicht verfügbar (kein Modell),
//     fehlgeschlagen oder nicht angebunden — jeder Zustand außer „beschrieben" macht die Quelle zur
//     Teilverarbeitung.
//   · Eine Quelle heißt nur dann „vollständig gelesen", wenn für jedes Bild Text und Bildinhalt
//     vorliegen, kein Bild verloren ging und keine bekannte Erfassungsgrenze greift.
//   · Das Original wird nicht verändert: gelesen wird aus der data-URL, geschrieben wird nur der
//     Befund.
//   · OCR-E01 (produkt:20261012:klara-ocr-fundstellen-korrekturen): der Befund trägt zusätzlich die
//     Wortrahmen der Erkennung und die Maße der gelesenen Bytes — Grundlage der Markierung am
//     Original (`lib/bildFundstelle.ts`). Beides kommt aus derselben Erkennung, nichts wird geraten.

import type { DescribeImageResult } from "../api/types";
import { type BildRahmen, type WortPosition, bildRahmenAus } from "./bildRahmen";
import type { OcrResult, OcrWort } from "./ocr";
import type { PptxRichResult } from "./pptx";

/** Die Automatik ist ohne abweichende Einstellung an (Product-Owner-Konkretisierung). */
export const BILD_AUTOMATIK_VOREINSTELLUNG = true;
/** Höchstdauer je Bild und Weg. Danach gilt der Lauf als „Zeitüberschreitung", nicht als gelesen. */
export const BILD_ZEITLIMIT_MS = 90_000;
/** Höchstdauer eines Lesezugriffs (Objektspeicher, Office-Anhang) einschließlich Antwortkörper. */
export const BILD_LADEFRIST_MS = 30_000;
/** Höchstzahl automatisch gelesener Bilder je Quelle; der Rest bleibt sichtbar „nicht analysiert". */
export const BILD_HOECHSTZAHL_JE_QUELLE = 40;
/** Unter dieser Sicherheit (0–100) gilt ein Wort als unsicher. */
export const UNSICHER_UNTER = 60;
/** Unter dieser Sicherheit gilt ein Wort als unleserlich und wird nicht als Text ausgegeben. */
export const UNLESERLICH_UNTER = 30;

/**
 * `rumpf`: Bilder im Text eines Entwurfs oder Wissensobjekts (Editor, auch aus Word/Browser).
 * `pdf`: OCR-E04 — die Seiten einer PDF (Textebene und gezeichnete Seite, `lib/pdfScanSeiten.ts`).
 */
export type BildQuellenArt = "bild" | "pptx" | "docx" | "rumpf" | "pdf";

export interface BildFundstelle {
  /** Name der Quelle (Dateiname). */
  quelle: string;
  art: BildQuellenArt;
  /** Position des Bildes in der Quelle, ab 1, in Dokumentreihenfolge. */
  bild: number;
  /** PowerPoint: die Folie (ab 1). */
  folie?: number;
  /** PowerPoint: die Position des Bildes auf seiner Folie (ab 1). */
  bildAufFolie?: number;
  /** Das Bild ist die gerenderte Folienansicht (W04), kein eingebettetes Einzelbild. */
  folienansicht?: boolean;
  /** Der Vorkommensanker im Rumpf (`data-image-id`), sofern vorhanden. */
  imageId?: string;
  /** OCR-E04 · PDF: die Seite (ab 1). */
  seite?: number;
  /** OCR-E04 · PDF: der Text stammt aus der Textebene der Seite oder aus der gelesenen Seite. */
  seitenteil?: "textebene" | "bild";
}

export interface BildVorkommen {
  fundstelle: BildFundstelle;
  /** Die Bilddaten als data-URL; sonst eine Adresse, die `ladeBild` auflösen darf, oder `null`. */
  src: string | null;
}

export type BildBefundStatus =
  | "wartet"
  | "laeuft"
  | "gelesen"
  | "kein-text"
  | "fehlgeschlagen"
  | "nicht-verfuegbar"
  | "kein-zugriff"
  | "zeitueberschreitung"
  | "nicht-analysiert";

export type BildinhaltStatus =
  | "beschrieben"
  /** Die Vertraulichkeitsregel schließt das Modell aus. */
  | "nicht-zulaessig"
  /** Kein Modell für die Bildbeschreibung verfügbar. */
  | "nicht-verfuegbar"
  | "fehlgeschlagen"
  /** Diese Fläche hat keinen Weg zur Bildbeschreibung. */
  | "nicht-angebunden"
  | "nicht-analysiert";

export interface Bildinhalt {
  status: BildinhaltStatus;
  /** Die Beschreibung des wesentlichen Bildinhalts (Diagramm, Foto, bildhafte Tabelle …). */
  text: string;
  /** Ursache bei allem außer „beschrieben" (z. B. `confidential`, `no-model`). */
  grund?: string;
}

export interface UnsichereStelle {
  wort: string;
  sicherheit: number;
  unleserlich: boolean;
}

export interface BildBefund {
  fundstelle: BildFundstelle;
  status: BildBefundStatus;
  /** `sha256:<hex>` der Bildbytes; `null` ohne Zugriff auf die Bytes. */
  inhaltskennung: string | null;
  /** Der erkannte Text, wie die Engine ihn geliefert hat. */
  text: string;
  /** Derselbe Text mit gekennzeichneten unsicheren und unleserlichen Stellen. */
  textGekennzeichnet: string;
  unsicher: UnsichereStelle[];
  /** Zuverlässig erkannte Tabellenstruktur (Zeilen × Zellen, Zellen gekennzeichnet) oder `null`. */
  tabelle: string[][] | null;
  /**
   * OCR-E03: dieselbe Tabelle als bearbeitbares Raster — mit leeren Zellen, Kopfzeile, Zustand und
   * Rahmen je Zelle. Fehlt bei Befunden, die vor OCR-E03 entstanden sind.
   */
  bildTabelle?: BildTabelle | null;
  /** Der wesentliche Bildinhalt über W02. */
  bildinhalt: Bildinhalt;
  /** Der Textbefund stammt aus einer früheren Analyse derselben Bildbytes. */
  wiederverwendet: boolean;
  /** Warum nicht analysiert wurde. */
  grund?: "automatik-aus" | "grenze";
  fehler?: string;
  /**
   * OCR-E04 · PDF: so viele erkannte Zeilen standen schon wörtlich in der Textebene derselben Seite
   * und sind deshalb nicht ein zweites Mal im Text.
   */
  doppelt?: number;
  /** OCR-E01: die Wörter der Erkennung mit ihrem Rahmen (Pixel der gelesenen Bytes). */
  woerter?: WortPosition[];
  /** OCR-E01: Breite, Höhe und Drehangabe der gelesenen Bytes (fehlt, wenn nicht lesbar). */
  rahmen?: BildRahmen;
  /** OCR-E02: Text und Kennzeichnung zeigen eine Berichtigung; hier steht der Rohbefund. */
  korrektur?: BildKorrekturAnzeige;
}

/** OCR-E02: der Rohbefund neben einer wirksamen Berichtigung (`lib/bildKorrektur.ts`). */
export interface BildKorrekturAnzeige {
  rohText: string;
  rohGekennzeichnet: string;
  rohUnsicher: UnsichereStelle[];
  rohTabelle: string[][] | null;
  /** Nacharbeit 3: die Bildbeschreibung (W02) vor der Angleichung an die Berichtigung. */
  rohBildinhalt?: string;
  /**
   * Nacharbeit 4: die Beschreibung ließ sich nicht eindeutig angleichen (ein berichtigtes Wort kommt
   * mehrfach vor) — sie steht unverändert da und gilt als Stand VOR der Berichtigung.
   */
  beschreibungNichtAngeglichen?: boolean;
  geaendertAm: string;
  /** Wie oft „Rückgängig“ eine frühere Berichtigung zurückholt (danach gilt der Rohbefund). */
  schritte: number;
}

export type QuellenStatus =
  | "laeuft"
  | "vollstaendig"
  | "teilweise"
  | "fehlgeschlagen"
  | "nicht-verfuegbar"
  | "aus"
  | "ohne-bilder";

/** Bilder der Quelle, die beim Einlesen nicht übernommen wurden und deshalb nicht gelesen sind. */
export interface NichtGelesen {
  folie?: number;
  anzahl: number;
}

export type QuellenHinweis =
  /** PowerPoint: Bilder aus Layout, Master, Diagrammen, SmartArt und Notizen werden nicht erfasst (L16). */
  | "pptx-layout-nicht-erfasst"
  /** Mehr Bilder als `BILD_HOECHSTZAHL_JE_QUELLE`. */
  | "grenze-erreicht"
  /** Die Quelle selbst kam nicht innerhalb der Ladefrist an (Office-Anhang). */
  | "ladefrist"
  /** OCR-03: die Einstellung des Kontos konnte nicht gelesen werden — nichts automatisch gelesen. */
  | "einstellung-unbekannt"
  /** OCR-E04: die PDF hat mehr Seiten als die Seitengrenze (`MAX_PDF_PAGES`) — der Rest fehlt. */
  | "pdf-seiten-fehlen";

export interface BildQuelleEingang {
  quelle: string;
  art: BildQuellenArt;
  vorkommen: BildVorkommen[];
  nichtGelesen?: NichtGelesen[];
  hinweise?: QuellenHinweis[];
}

export interface QuellenBefund {
  quelle: string;
  art: BildQuellenArt;
  status: QuellenStatus;
  befunde: BildBefund[];
  nichtGelesen: NichtGelesen[];
  hinweise: QuellenHinweis[];
  /** OCR-E04 · PDF: Seiten über der Seitengrenze — weder Textebene noch Seite gelesen. */
  fehlendeSeiten?: number;
}

export type BildErkenner = (src: string) => Promise<OcrResult>;
export type BildBeschreiber = (src: string) => Promise<Bildinhalt>;
/** Holt ein Bild als data-URL; `signal` bricht Abruf und Antwortkörper nach der Ladefrist ab. */
export type BildLader = (src: string, signal?: AbortSignal) => Promise<string | null>;

// ------------------------------------------------------------------------------------------------
// Vorkommen aus einem Rumpf (PPTX/DOCX-Import, Editor) — in Dokumentreihenfolge
// ------------------------------------------------------------------------------------------------

const IMG_RE = /<img\b[^>]*>/gi;
const FOLIENANSICHT_RE = /-s(\d+)$/;

function attribut(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag);
  return m ? (m[1] ?? "") : null;
}

/** HTML-Entities eines Attributwerts (`&amp;` in Adressen) auflösen. */
function attributText(wert: string): string {
  return wert.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}

/**
 * Die Bilder eines Rumpfes als Vorkommen. `folieJeBild` (aus `extractPptxRich().imageSlides`) gibt
 * die Folie je Anker; Folienansicht-Bilder (`…-s<N>`, W04) tragen ihre Foliennummer selbst.
 */
export function bildVorkommenAusRumpf(
  html: string | null | undefined,
  quelle: { name: string; art: BildQuellenArt },
  folieJeBild?: ReadonlyMap<string, number>,
): BildVorkommen[] {
  if (!html) {
    return [];
  }
  const aus: BildVorkommen[] = [];
  const zaehlerJeFolie = new Map<string, number>();
  for (const tag of html.match(IMG_RE) ?? []) {
    const roh = attribut(tag, "src");
    const src = roh === null ? null : attributText(roh);
    const imageId = attribut(tag, "data-image-id") ?? undefined;
    const folienansicht = imageId ? FOLIENANSICHT_RE.exec(imageId) : null;
    const folie = folienansicht
      ? Number(folienansicht[1])
      : imageId
        ? folieJeBild?.get(imageId)
        : undefined;
    const fundstelle: BildFundstelle = {
      quelle: quelle.name,
      art: quelle.art,
      bild: aus.length + 1,
      ...(imageId ? { imageId } : {}),
    };
    if (folie !== undefined) {
      const schluessel = `${folienansicht ? "s" : "e"}${folie}`;
      const n = (zaehlerJeFolie.get(schluessel) ?? 0) + 1;
      zaehlerJeFolie.set(schluessel, n);
      fundstelle.folie = folie;
      fundstelle.bildAufFolie = n;
      if (folienansicht) {
        fundstelle.folienansicht = true;
      }
    }
    aus.push({ fundstelle, src: src && src.length > 0 ? src : null });
  }
  return aus;
}

/**
 * Der Eingang einer gelesenen PowerPoint-Datei: Bilder mit Folie, die nicht übernommenen Bilder je
 * Folie (Format, Budget, defekt, ausserhalb `p:pic`) und der Rest aus dem Drop-to-fit ohne Folie.
 * Weil Layout-, Master-, Diagramm-, SmartArt- und Notizteile nicht eingelesen werden (L16), trägt
 * jede PowerPoint-Quelle diesen Hinweis — sie wird deshalb nie „vollständig gelesen" gemeldet.
 */
export function pptxBildEingang(
  name: string,
  html: string | null,
  pptx: Pick<PptxRichResult, "imageCount" | "imageSlides" | "imagesNotEmbeddedBySlide">,
): BildQuelleEingang {
  const folieJeBild = new Map(pptx.imageSlides.map((x) => [x.imageId, x.slide] as const));
  const vorkommen = bildVorkommenAusRumpf(html, { name, art: "pptx" }, folieJeBild);
  const eingebettet = vorkommen.filter((v) => !v.fundstelle.folienansicht).length;
  const jeFolie = pptx.imagesNotEmbeddedBySlide.map((x) => ({ folie: x.slide, anzahl: x.count }));
  const rest = pptx.imageCount - eingebettet - jeFolie.reduce((n, x) => n + x.anzahl, 0);
  return {
    quelle: name,
    art: "pptx",
    vorkommen,
    nichtGelesen: rest > 0 ? [...jeFolie, { anzahl: rest }] : jeFolie,
    hinweise: ["pptx-layout-nicht-erfasst"],
  };
}

/** Der Eingang einer gelesenen Word-Datei: Bilder in Dokumentreihenfolge, verlorene Bilder gezählt. */
export function docxBildEingang(
  name: string,
  html: string | null,
  verloreneBilder: number,
): BildQuelleEingang {
  return {
    quelle: name,
    art: "docx",
    vorkommen: bildVorkommenAusRumpf(html, { name, art: "docx" }),
    nichtGelesen: verloreneBilder > 0 ? [{ anzahl: verloreneBilder }] : [],
  };
}

/** Der Eingang eines einzeln bereitgestellten Bildes. */
export function einzelbildEingang(name: string, src: string | null): BildQuelleEingang {
  return {
    quelle: name,
    art: "bild",
    vorkommen: [{ fundstelle: { quelle: name, art: "bild", bild: 1 }, src }],
  };
}

/**
 * Tragen zwei Vorkommenslisten dieselben Bilder an denselben Stellen (Anker und Bilddaten)? Reine
 * Textänderungen lassen sie gleich — dann muss nichts neu gelesen und nichts verworfen werden.
 */
export function gleicheBilder(a: readonly BildVorkommen[], b: readonly BildVorkommen[]): boolean {
  return (
    a.length === b.length &&
    a.every((v, i) => {
      const w = b[i];
      return w !== undefined && v.src === w.src && v.fundstelle.imageId === w.fundstelle.imageId;
    })
  );
}

/** Der Eingang der Bilder im Text eines Entwurfs oder Wissensobjekts (Editor). */
export function rumpfBildEingang(name: string, html: string | null): BildQuelleEingang {
  return {
    quelle: name,
    art: "rumpf",
    vorkommen: bildVorkommenAusRumpf(html, { name, art: "rumpf" }),
  };
}

// ------------------------------------------------------------------------------------------------
// Inhaltskennung, Kennzeichnung, Tabellen
// ------------------------------------------------------------------------------------------------

const DATA_URL_RE = /^data:image\/[^;,]+;base64,([\s\S]*)$/i;

/** Liegt das Bild schon als data-URL vor? */
export function istBildDatenUrl(src: string | null): boolean {
  return src !== null && DATA_URL_RE.test(src.trim());
}

/** Die Bytes einer Bild-data-URL — `null` für alles andere (fremde Adresse, kein Bild). */
export function bildBytes(src: string | null): Uint8Array | null {
  if (!src) {
    return null;
  }
  const m = DATA_URL_RE.exec(src.trim());
  if (!m) {
    return null;
  }
  try {
    const roh = atob((m[1] ?? "").replace(/\s+/g, ""));
    const bytes = new Uint8Array(roh.length);
    for (let i = 0; i < roh.length; i += 1) {
      bytes[i] = roh.charCodeAt(i);
    }
    return bytes.length > 0 ? bytes : null;
  } catch {
    return null;
  }
}

/** `sha256:<hex>` über die Bildbytes — dieselbe Form wie W16 (`services/structure/src/bildinhalt.ts`). */
export async function bildInhaltskennung(bytes: Uint8Array): Promise<string | null> {
  // Strukturell getippt: dieselbe Datei läuft im Browser und im Node-Typcheck der Tests.
  type Digest = { digest(algorithmus: string, daten: ArrayBuffer): Promise<ArrayBuffer> };
  const subtle = (globalThis as unknown as { crypto?: { subtle?: Digest } }).crypto?.subtle;
  if (!subtle) {
    return null;
  }
  const kopie = new Uint8Array(bytes);
  const digest = new Uint8Array(await subtle.digest("SHA-256", kopie.buffer as ArrayBuffer));
  return `sha256:${Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Ein Wort, wie es im Befund steht: sicher wie gelesen, unsicher `[?wort]`, sonst `[unleserlich]`.
 * Basisreparatur 58→53: las die Gegenlesung der Engine dort etwas anderes (`abweichend`), ist das
 * Wort unsicher — auch wenn die Engine es selbst hoch bewertet.
 */
export function gekennzeichnet(wort: string, sicherheit: number, abweichend = false): string {
  if (sicherheit < UNLESERLICH_UNTER) {
    return "[unleserlich]";
  }
  if (sicherheit < UNSICHER_UNTER || abweichend) {
    return `[?${wort}]`;
  }
  return wort;
}

/**
 * Der Text mit gekennzeichneten Stellen. Die Wörter der Engine kommen in Lesereihenfolge; sie werden
 * der Reihe nach den Wörtern des Textes zugeordnet, Zeilenumbrüche bleiben stehen.
 */
export function kennzeichneUnsicheres(
  text: string,
  woerter: readonly OcrWort[] | undefined,
): { textGekennzeichnet: string; unsicher: UnsichereStelle[] } {
  if (!woerter || woerter.length === 0) {
    return { textGekennzeichnet: text, unsicher: [] };
  }
  const unsicher: UnsichereStelle[] = [];
  let zeiger = 0;
  const textGekennzeichnet = text.replace(/\S+/g, (token) => {
    let treffer = -1;
    for (let i = zeiger; i < Math.min(woerter.length, zeiger + 3); i += 1) {
      if (woerter[i]?.text === token) {
        treffer = i;
        break;
      }
    }
    if (treffer < 0) {
      return token;
    }
    zeiger = treffer + 1;
    const sicherheit = woerter[treffer]?.confidence ?? 100;
    const abweichend = woerter[treffer]?.abweichend === true;
    if (sicherheit < UNSICHER_UNTER || abweichend) {
      unsicher.push({ wort: token, sicherheit, unleserlich: sicherheit < UNLESERLICH_UNTER });
    }
    return gekennzeichnet(token, sicherheit, abweichend);
  });
  return { textGekennzeichnet, unsicher };
}

interface Zelle {
  x0: number;
  x1: number;
  text: string;
}

type WortMitRahmen = OcrWort & { bbox: NonNullable<OcrWort["bbox"]> };

function hatRahmen(w: OcrWort): w is WortMitRahmen {
  return w.bbox !== undefined && w.text.trim().length > 0;
}

function median(werte: number[]): number {
  const s = [...werte].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

/**
 * Tabellenstruktur aus den Wortrahmen — NUR wenn sie zuverlässig bestimmbar ist: mindestens zwei
 * aufeinanderfolgende Zeilen mit gleich vielen (≥ 2) Zellen, deren Spalten an der linken, rechten
 * oder mittleren Kante übereinanderstehen. Sonst `null`. Zellen tragen die Kennzeichnung unsicherer
 * Wörter wie der Text.
 */
export function tabelleAusWoertern(woerter: readonly OcrWort[] | undefined): string[][] | null {
  const mitRahmen = (woerter ?? []).filter(hatRahmen);
  if (mitRahmen.length < 4) {
    return null;
  }
  const hoehe = Math.max(1, median(mitRahmen.map((w) => w.bbox.y1 - w.bbox.y0)));
  const mitte = (w: WortMitRahmen): number => (w.bbox.y0 + w.bbox.y1) / 2;
  const sortiert = [...mitRahmen].sort((a, b) => mitte(a) - mitte(b));
  const zeilen: WortMitRahmen[][] = [];
  for (const w of sortiert) {
    const letzte = zeilen[zeilen.length - 1];
    const letzteMitte = letzte
      ? letzte.reduce((n, x) => n + mitte(x), 0) / letzte.length
      : Number.NEGATIVE_INFINITY;
    if (letzte && Math.abs(mitte(w) - letzteMitte) <= hoehe * 0.6) {
      letzte.push(w);
    } else {
      zeilen.push([w]);
    }
  }
  const zellenJeZeile: Zelle[][] = zeilen.map((zeile) => {
    const z = [...zeile].sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const zellen: Zelle[] = [];
    for (const w of z) {
      const text = gekennzeichnet(w.text, w.confidence, w.abweichend === true);
      const vorige = zellen[zellen.length - 1];
      if (vorige && w.bbox.x0 - vorige.x1 <= hoehe * 1.2) {
        vorige.text = `${vorige.text} ${text}`;
        vorige.x1 = w.bbox.x1;
      } else {
        zellen.push({ x0: w.bbox.x0, x1: w.bbox.x1, text });
      }
    }
    return zellen;
  });
  const toleranz = hoehe * 1.5;
  const passt = (a: Zelle[], b: Zelle[]): boolean =>
    a.length === b.length &&
    a.length >= 2 &&
    a.every((za, j) => {
      const zb = b[j];
      if (!zb) {
        return false;
      }
      return (
        Math.abs(za.x0 - zb.x0) <= toleranz ||
        Math.abs(za.x1 - zb.x1) <= toleranz ||
        Math.abs((za.x0 + za.x1) / 2 - (zb.x0 + zb.x1) / 2) <= toleranz
      );
    });
  let beste: Zelle[][] = [];
  let lauf: Zelle[][] = [];
  for (const zeile of zellenJeZeile) {
    const erste = lauf[0];
    if (erste && passt(erste, zeile)) {
      lauf.push(zeile);
    } else {
      lauf = [zeile];
    }
    if (lauf.length > beste.length) {
      beste = [...lauf];
    }
  }
  if (beste.length < 2 || (beste[0]?.length ?? 0) < 2) {
    return null;
  }
  return beste.map((zeile) => zeile.map((z) => z.text));
}

// ------------------------------------------------------------------------------------------------
// OCR-E03 · Bildhafte Tabellen als bearbeitbares Raster (Auftrag produkt:20261012:klara-ocr-tabellen)
// ------------------------------------------------------------------------------------------------
//
// `tabelleAusWoertern` oben verlangt gleich viele Zellen je Zeile — eine Tabelle mit leeren Zellen
// fällt dort heraus. Das Raster hier nimmt sie auf, ohne zu raten:
//   · Die Spalten stehen fest, bevor eine Zeile mit Lücken zugeordnet wird: aus mindestens zwei
//     vollständig besetzten Zeilen, deren Blöcke übereinanderstehen. Gibt es die nicht, entsteht
//     kein Raster (`null`).
//   · Eine Zeile mit weniger Blöcken bekommt LEERE Zellen dort, wo nichts steht. Leer heißt leer;
//     es wird nichts ergänzt.
//   · Ein Block, der über eine Spaltengrenze reicht, zwischen zwei Spalten steht oder sich die
//     Spalte mit einem zweiten Block teilt, steht in der wahrscheinlichsten Spalte und ist
//     `mehrdeutig` gekennzeichnet.
//   · Zellinhalte sind die Wörter der Engine, wörtlich (Dezimalkomma, Vorzeichen, Einheit), mit
//     derselben Kennzeichnung wie der Text: `[?wort]` unsicher, `[unleserlich]` statt einer Lesung.
//   · Jede Zelle mit Inhalt trägt ihren Rahmen im Bild — die Fundstelle in der Ursprungstabelle.
//   · Kopfzeile nur, wenn die erste Zeile vollständig aus Text ohne Ziffern besteht und darunter
//     Ziffern stehen.
//   · Nacharbeit 4 (Bens Befund): fehlende Wörter beweisen keine Leere. Jede Zelle ohne Wörter trägt
//     ihren Suchbereich im Bild (Spalte × Zeile). Steht dort sichtbar etwas (`tintenAnteil`), das die
//     Engine nicht gelesen hat, wird die Zelle `[unleserlich]` — ohne einen Wert zu erfinden
//     (`markiereUnerkannteInhalte`). Nur eine Zelle ohne Inhalt im Bild bleibt „leer“.

/** `ungeprueft`: keine Wörter, und das Bild konnte an dieser Stelle nicht geprüft werden. */
export type ZellZustand = "sicher" | "unsicher" | "unleserlich" | "ungeprueft" | "leer";

export interface Bildbereich {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TabellenZelle {
  /** Der Inhalt wie im Befund gekennzeichnet; `""` bei einer leeren Zelle. */
  text: string;
  zustand: ZellZustand;
  /** Die Zuordnung zu dieser Spalte ist nicht eindeutig. */
  mehrdeutig: boolean;
  /**
   * Rahmen der Zelle im Bild (Pixel, Originalmaßstab); fehlt bei leeren Zellen. Bei einer Zelle mit
   * Inhalt im Bild, den die Engine nicht lesen konnte, ist es der geprüfte Zellbereich.
   */
  rahmen?: Bildbereich;
  /** Nur bei Zellen ohne erkannte Wörter: der Bereich, in dem das Bild auf Inhalt geprüft wird. */
  bereich?: Bildbereich;
  /**
   * Die Wörter der Zelle als Positionen in `BildBefund.woerter` (OCR-E01) — Grundlage der Fundstelle
   * am Original und der Zuordnung einer Berichtigung (OCR-E02). Fehlt bei Zellen ohne Wörter.
   */
  woerter?: number[];
  /**
   * Die Zelle zeigt eine gespeicherte Berichtigung (OCR-E02, `lib/bildTabelle.ts`); hier steht, was
   * die Erkennung geliefert hatte.
   */
  berichtigt?: { roh: string; rohZustand: ZellZustand };
}

export interface BildTabelle {
  /** 1, wenn die erste Zeile als Überschrift erkannt ist, sonst 0. */
  kopfzeilen: number;
  spalten: number;
  /** Zeilen × `spalten` Zellen — jede Zeile ist vollständig, leere Zellen eingeschlossen. */
  zeilen: TabellenZelle[][];
}

interface RasterBlock {
  x0: number;
  x1: number;
  woerter: WortMitRahmen[];
}

/** Senkrechte Striche sind Gitterlinien einer gezeichneten Tabelle, kein Zellinhalt. */
const GITTERLINIE = /^[|¦]+$/;
/** Zwei Zeilen, die weiter als so viele Worthöhen auseinanderliegen, gehören nicht zur selben Tabelle. */
const ZEILENABSTAND_HOECHSTENS = 4;

function woerterInZeilen(woerter: readonly WortMitRahmen[], hoehe: number): WortMitRahmen[][] {
  const mitte = (w: WortMitRahmen): number => (w.bbox.y0 + w.bbox.y1) / 2;
  const sortiert = [...woerter].sort((a, b) => mitte(a) - mitte(b));
  const zeilen: WortMitRahmen[][] = [];
  for (const w of sortiert) {
    const letzte = zeilen[zeilen.length - 1];
    const letzteMitte = letzte
      ? letzte.reduce((n, x) => n + mitte(x), 0) / letzte.length
      : Number.NEGATIVE_INFINITY;
    if (letzte && Math.abs(mitte(w) - letzteMitte) <= hoehe * 0.6) {
      letzte.push(w);
    } else {
      zeilen.push([w]);
    }
  }
  return zeilen;
}

function bloeckeDerZeile(zeile: readonly WortMitRahmen[], hoehe: number): RasterBlock[] {
  const bloecke: RasterBlock[] = [];
  for (const w of [...zeile].sort((a, b) => a.bbox.x0 - b.bbox.x0)) {
    const vorige = bloecke[bloecke.length - 1];
    if (vorige && w.bbox.x0 - vorige.x1 <= hoehe * 1.2) {
      vorige.woerter.push(w);
      vorige.x1 = Math.max(vorige.x1, w.bbox.x1);
    } else {
      bloecke.push({ x0: w.bbox.x0, x1: w.bbox.x1, woerter: [w] });
    }
  }
  return bloecke;
}

function zeileMitte(zeile: readonly WortMitRahmen[]): number {
  return zeile.reduce((n, w) => n + (w.bbox.y0 + w.bbox.y1) / 2, 0) / Math.max(1, zeile.length);
}

function zelleAus(
  woerter: readonly WortMitRahmen[],
  mehrdeutig: boolean,
  bereich: Bildbereich,
  position: ReadonlyMap<WortMitRahmen, number>,
): TabellenZelle {
  if (woerter.length === 0) {
    return { text: "", zustand: "leer", mehrdeutig, bereich };
  }
  let unleserlich = 0;
  let unsicher = 0;
  for (const w of woerter) {
    if (w.confidence < UNLESERLICH_UNTER) {
      unleserlich += 1;
    } else if (w.confidence < UNSICHER_UNTER || w.abweichend === true) {
      unsicher += 1;
    }
  }
  const zustand: ZellZustand =
    unleserlich === woerter.length
      ? "unleserlich"
      : unleserlich + unsicher > 0
        ? "unsicher"
        : "sicher";
  return {
    text: woerter.map((w) => gekennzeichnet(w.text, w.confidence, w.abweichend === true)).join(" "),
    zustand,
    mehrdeutig,
    rahmen: {
      x0: Math.min(...woerter.map((w) => w.bbox.x0)),
      y0: Math.min(...woerter.map((w) => w.bbox.y0)),
      x1: Math.max(...woerter.map((w) => w.bbox.x1)),
      y1: Math.max(...woerter.map((w) => w.bbox.y1)),
    },
    woerter: woerter.flatMap((w) => {
      const i = position.get(w);
      return i === undefined ? [] : [i];
    }),
  };
}

const HAT_ZIFFER = /\p{N}/u;
const HAT_BUCHSTABE = /\p{L}/u;

/**
 * Das bearbeitbare Raster einer bildhaften Tabelle — oder `null`, wenn die Spalten nicht aus
 * mindestens zwei vollständig besetzten, übereinanderstehenden Zeilen bestimmbar sind.
 */
export function bildTabelleAusWoertern(
  woerter: readonly OcrWort[] | undefined,
): BildTabelle | null {
  // Die Position jedes Wortes in derselben Folge wie `BildBefund.woerter` (`wortPositionen`: alle
  // Wörter mit Rahmen und Text) — auch Gitterlinien zählen dort mit.
  const alleMitRahmen = (woerter ?? []).filter(hatRahmen);
  const position = new Map(alleMitRahmen.map((w, i) => [w, i] as const));
  const mitRahmen = alleMitRahmen.filter((w) => !GITTERLINIE.test(w.text.trim()));
  if (mitRahmen.length < 4) {
    return null;
  }
  const hoehe = Math.max(1, median(mitRahmen.map((w) => w.bbox.y1 - w.bbox.y0)));
  const zeilen = woerterInZeilen(mitRahmen, hoehe);
  const bloecke = zeilen.map((z) => bloeckeDerZeile(z, hoehe));
  const spalten = Math.max(0, ...bloecke.map((b) => b.length));
  if (spalten < 2) {
    return null;
  }

  // 1 · Das Spaltenraster aus den vollständig besetzten Zeilen, die übereinanderstehen.
  const toleranz = hoehe * 1.5;
  const stehenUebereinander = (a: RasterBlock[], b: RasterBlock[]): boolean =>
    a.every((ba, j) => {
      const bb = b[j];
      return (
        bb !== undefined &&
        (Math.abs(ba.x0 - bb.x0) <= toleranz ||
          Math.abs(ba.x1 - bb.x1) <= toleranz ||
          Math.abs((ba.x0 + ba.x1) / 2 - (bb.x0 + bb.x1) / 2) <= toleranz)
      );
    });
  const volle = bloecke.map((b, i) => (b.length === spalten ? i : -1)).filter((i) => i >= 0);
  let gruppe: number[] = [];
  for (const i of volle) {
    const kandidat = volle.filter((j) => stehenUebereinander(bloecke[i] ?? [], bloecke[j] ?? []));
    if (kandidat.length > gruppe.length) {
      gruppe = kandidat;
    }
  }
  if (gruppe.length < 2) {
    return null;
  }
  const raster = Array.from({ length: spalten }, (_, j) => ({
    x0: Math.min(...gruppe.map((i) => bloecke[i]?.[j]?.x0 ?? Number.POSITIVE_INFINITY)),
    x1: Math.max(...gruppe.map((i) => bloecke[i]?.[j]?.x1 ?? Number.NEGATIVE_INFINITY)),
  }));
  for (let j = 1; j < raster.length; j += 1) {
    if ((raster[j - 1]?.x1 ?? 0) >= (raster[j]?.x0 ?? 0)) {
      return null; // Spalten überlappen — keine verlässliche Struktur.
    }
  }

  // 2 · Jede Zeile dem Raster zuordnen. Ein Block gehört eindeutig zu einer Spalte, wenn er genau
  //     eine berührt; sonst steht er in der Spalte mit der größten Überdeckung (bzw. der nächsten)
  //     und ist mehrdeutig.
  const nah = hoehe * 0.5;
  const zuordnen = (block: RasterBlock): { spalte: number; mehrdeutig: boolean } => {
    const beruehrt = raster
      .map((s, j) => ({ j, s }))
      .filter(({ s }) => block.x0 <= s.x1 + nah && block.x1 >= s.x0 - nah);
    if (beruehrt.length === 1) {
      return { spalte: beruehrt[0]?.j ?? 0, mehrdeutig: false };
    }
    const mitteBlock = (block.x0 + block.x1) / 2;
    let beste = 0;
    let bestesMass = Number.NEGATIVE_INFINITY;
    raster.forEach((s, j) => {
      const deckung = Math.min(block.x1, s.x1) - Math.max(block.x0, s.x0);
      const mass = beruehrt.length > 1 ? deckung : -Math.abs(mitteBlock - (s.x0 + s.x1) / 2);
      if (mass > bestesMass) {
        bestesMass = mass;
        beste = j;
      }
    });
    return { spalte: beste, mehrdeutig: true };
  };
  type Zeilenart = "tabelle" | "einzeln" | "fremd";
  const zugeordnet = bloecke.map((zeile) => {
    const zellen: { woerter: WortMitRahmen[]; mehrdeutig: boolean }[] = raster.map(() => ({
      woerter: [],
      mehrdeutig: false,
    }));
    let eindeutig = 0;
    for (const block of zeile) {
      const { spalte, mehrdeutig } = zuordnen(block);
      const zelle = zellen[spalte];
      if (!zelle) {
        continue;
      }
      if (zelle.woerter.length > 0) {
        zelle.mehrdeutig = true; // zwei Blöcke in einer Spalte
      }
      zelle.woerter.push(...block.woerter);
      zelle.mehrdeutig = zelle.mehrdeutig || mehrdeutig;
      eindeutig += mehrdeutig ? 0 : 1;
    }
    const art: Zeilenart =
      zeile.length >= 2 && eindeutig >= 1
        ? "tabelle"
        : zeile.length === 1 && eindeutig === 1
          ? "einzeln"
          : "fremd";
    return { zellen, art };
  });

  // 3 · Der zusammenhängende Lauf um das Raster: Zeilen mit Lücken gehören dazu, eine Zeile mit nur
  //     einem Block nur INNERHALB der Tabelle (sonst ist sie Überschrift oder Text daneben).
  const anker = gruppe[0] ?? 0;
  const passt = (i: number, nachbar: number): boolean =>
    zugeordnet[i]?.art !== "fremd" &&
    Math.abs(zeileMitte(zeilen[i] ?? []) - zeileMitte(zeilen[nachbar] ?? [])) <=
      hoehe * ZEILENABSTAND_HOECHSTENS;
  let von = anker;
  while (von > 0 && passt(von - 1, von)) {
    von -= 1;
  }
  let bis = anker;
  while (bis < zeilen.length - 1 && passt(bis + 1, bis)) {
    bis += 1;
  }
  while (von < bis && zugeordnet[von]?.art === "einzeln") {
    von += 1;
  }
  while (bis > von && zugeordnet[bis]?.art === "einzeln") {
    bis -= 1;
  }
  if (gruppe.some((i) => i < von || i > bis)) {
    // Die vollständigen Zeilen liegen nicht in einem Lauf — keine verlässliche Tabelle.
    return null;
  }
  const tabelle = zugeordnet.slice(von, bis + 1).map((z, k) => {
    // Der Zeilenbereich: von der Ober- bis zur Unterkante der Wörter dieser Zeile.
    const zeile = zeilen[von + k] ?? [];
    const y0 = Math.min(...zeile.map((w) => w.bbox.y0));
    const y1 = Math.max(...zeile.map((w) => w.bbox.y1));
    return z.zellen.map((zelle, s) =>
      zelleAus(
        zelle.woerter,
        zelle.mehrdeutig,
        { x0: raster[s]?.x0 ?? 0, y0, x1: raster[s]?.x1 ?? 0, y1 },
        position,
      ),
    );
  });
  if (tabelle.length < 2) {
    return null;
  }

  const erste = tabelle[0] ?? [];
  const kopf =
    erste.every(
      (z) =>
        z.zustand !== "leer" &&
        z.zustand !== "unleserlich" &&
        HAT_BUCHSTABE.test(z.text) &&
        !HAT_ZIFFER.test(z.text),
    ) && tabelle.slice(1).some((zeile) => zeile.some((z) => HAT_ZIFFER.test(z.text)));
  return { kopfzeilen: kopf ? 1 : 0, spalten, zeilen: tabelle };
}

// ------------------------------------------------------------------------------------------------
// OCR-E03 · Nacharbeit 4 — Zellen ohne erkannte Wörter am Bild prüfen
// ------------------------------------------------------------------------------------------------

/**
 * Ab dieser Helligkeitsabweichung (0–255) vom Hintergrund der Zelle gilt ein Bildpunkt als Inhalt —
 * über dem Rauschen von Kompression und Scan (< 10), unter blasser, unscharfer Schrift (≈ 25).
 */
export const TINTE_AB_ABWEICHUNG = 16;
/** Ab diesem Anteil solcher Bildpunkte trägt ein Zellbereich sichtbaren Inhalt. */
export const TINTE_AB_ANTEIL = 0.004;
/** Um so viele Pixel wird der Zellbereich nach innen verkleinert (Linien, Nachbarzellen). */
export const TINTE_RAND_PX = 2;

/**
 * Misst je Bereich den Anteil sichtbarer Bildpunkte (0–1) — `null`, wo das Bild nicht messbar ist.
 * Im Browser `bildTintenAnteile` (`lib/files.ts`, Canvas); gelesen wird nur, nichts verändert.
 */
export type TintenMesser = (
  src: string,
  bereiche: readonly Bildbereich[],
) => Promise<readonly (number | null)[]>;

/**
 * Der Anteil der Bildpunkte, die sich sichtbar vom Hintergrund abheben. Hintergrund ist der
 * häufigste Helligkeitswert des Bereichs (Median); Transparenz zählt als Weiß. DOM-frei: RGBA-Bytes
 * wie aus `getImageData`.
 */
export function tintenAnteil(rgba: ArrayLike<number>, breite: number, hoehe: number): number {
  const n = Math.max(0, Math.floor(breite) * Math.floor(hoehe));
  if (n === 0 || rgba.length < n * 4) {
    return 0;
  }
  const hell = new Uint8Array(n);
  const verteilung = new Uint32Array(256);
  for (let i = 0; i < n; i += 1) {
    const r = rgba[i * 4] ?? 255;
    const g = rgba[i * 4 + 1] ?? 255;
    const b = rgba[i * 4 + 2] ?? 255;
    const a = (rgba[i * 4 + 3] ?? 255) / 255;
    const l = Math.round((0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a));
    hell[i] = l;
    verteilung[l] = (verteilung[l] ?? 0) + 1;
  }
  let hintergrund = 0;
  for (let summe = 0; hintergrund < 256; hintergrund += 1) {
    summe += verteilung[hintergrund] ?? 0;
    if (summe * 2 >= n) {
      break;
    }
  }
  let tinte = 0;
  for (let i = 0; i < n; i += 1) {
    if (Math.abs((hell[i] ?? hintergrund) - hintergrund) >= TINTE_AB_ABWEICHUNG) {
      tinte += 1;
    }
  }
  return tinte / n;
}

/** Die Prüfbereiche aller Zellen ohne erkannte Wörter, zeilenweise, nach innen verkleinert. */
export function leereZellBereiche(tabelle: BildTabelle): Bildbereich[] {
  const bereiche: Bildbereich[] = [];
  for (const zeile of tabelle.zeilen) {
    for (const zelle of zeile) {
      if (zelle.zustand === "leer" && zelle.bereich) {
        const b = zelle.bereich;
        bereiche.push({
          x0: b.x0 + TINTE_RAND_PX,
          y0: b.y0 + TINTE_RAND_PX,
          x1: Math.max(b.x0 + TINTE_RAND_PX, b.x1 - TINTE_RAND_PX),
          y1: Math.max(b.y0 + TINTE_RAND_PX, b.y1 - TINTE_RAND_PX),
        });
      }
    }
  }
  return bereiche;
}

/**
 * Das Ergebnis der Messung je Zelle ohne erkannte Wörter (`anteile` in der Reihenfolge von
 * `leereZellBereiche`):
 *   · sichtbarer Inhalt  ⇒ `[unleserlich]` — die Engine hat dort etwas nicht lesen können;
 *   · gemessen ohne Inhalt ⇒ „leer“ — NUR so entsteht eine leere Zelle;
 *   · nicht gemessen (`null`, fehlendes Ergebnis) ⇒ `[ungeprüft]` (Nacharbeit 5, Bens Befund):
 *     fehlende Wörter beweisen keine Leere, und eine fehlende Messung auch nicht.
 * Kein Wert wird ergänzt; Zellen mit erkannten Wörtern bleiben, wie sie sind.
 */
export function markiereUnerkannteInhalte(
  tabelle: BildTabelle,
  anteile: readonly (number | null | undefined)[],
): BildTabelle {
  let n = 0;
  const zeilen = tabelle.zeilen.map((zeile) =>
    zeile.map((zelle): TabellenZelle => {
      if (zelle.zustand !== "leer" || !zelle.bereich) {
        return zelle;
      }
      const anteil = anteile[n];
      n += 1;
      if (anteil === null || anteil === undefined || !Number.isFinite(anteil)) {
        return {
          text: "[ungeprüft]",
          zustand: "ungeprueft",
          mehrdeutig: zelle.mehrdeutig,
          rahmen: zelle.bereich,
        };
      }
      if (anteil < TINTE_AB_ANTEIL) {
        return zelle;
      }
      return {
        text: "[unleserlich]",
        zustand: "unleserlich",
        mehrdeutig: zelle.mehrdeutig,
        rahmen: zelle.bereich,
      };
    }),
  );
  // Eine Kopfzeile setzt volle, lesbare Zellen voraus (s. oben) — eine jetzt unleserliche oder
  // ungeprüfte Zelle in der ersten Zeile hebt sie auf.
  const kopf =
    tabelle.kopfzeilen > 0 &&
    (zeilen[0] ?? []).every((z) => z.zustand !== "unleserlich" && z.zustand !== "ungeprueft");
  return { ...tabelle, kopfzeilen: kopf ? tabelle.kopfzeilen : 0, zeilen };
}

/**
 * Misst die Zellen ohne Wörter am Bild und kennzeichnet das Ergebnis. Ohne Messweg oder bei einem
 * Fehler der Messung gilt jede dieser Zellen als ungeprüft — nie still als leer.
 */
export async function pruefeLeereZellen(
  tabelle: BildTabelle,
  src: string,
  messeTinte: TintenMesser | undefined,
): Promise<BildTabelle> {
  const bereiche = leereZellBereiche(tabelle);
  if (bereiche.length === 0) {
    return tabelle;
  }
  if (!messeTinte) {
    return markiereUnerkannteInhalte(tabelle, []);
  }
  try {
    return markiereUnerkannteInhalte(tabelle, await messeTinte(src, bereiche));
  } catch {
    return markiereUnerkannteInhalte(tabelle, []);
  }
}

// ------------------------------------------------------------------------------------------------
// Bildinhalt über W02 — das Ergebnis des vorhandenen Wegs, ehrlich eingeordnet
// ------------------------------------------------------------------------------------------------

/**
 * Macht aus dem vorhandenen Beschreibungsweg (W02, `useImageDescribe` bzw.
 * `endpoints.reasoner.describeImage` mit der Herkunft der Fläche) einen Beschreiber für die
 * Automatik. Ist kein Modell nutzbar, wird gar nicht erst angefragt.
 */
export function bildBeschreiberAus(weg: {
  available: boolean;
  describe: (dataUrl: string) => Promise<DescribeImageResult>;
}): BildBeschreiber {
  return async (src) => {
    if (!weg.available) {
      return { status: "nicht-verfuegbar", text: "", grund: "no-model" };
    }
    try {
      const r = await weg.describe(src);
      const text = (r.text ?? "").trim();
      if (!r.demo && text.length > 0) {
        return { status: "beschrieben", text };
      }
      if (r.fallbackReason === "confidential") {
        return { status: "nicht-zulaessig", text: "", grund: "confidential" };
      }
      if (r.fallbackReason === "model-timeout" || r.fallbackReason === "model-error") {
        return { status: "fehlgeschlagen", text: "", grund: r.fallbackReason };
      }
      return { status: "nicht-verfuegbar", text: "", grund: r.fallbackReason ?? "no-model" };
    } catch (error) {
      // 409 ist die typisierte Vertraulichkeitssperre des Servers (reasoner-routes.ts) — eine Regel,
      // kein Fehler.
      const status = (error as { status?: unknown } | null)?.status;
      if (status === 409) {
        return { status: "nicht-zulaessig", text: "", grund: "confidential" };
      }
      return {
        status: "fehlgeschlagen",
        text: "",
        grund: error instanceof Error ? error.message : "fehler",
      };
    }
  };
}

// ------------------------------------------------------------------------------------------------
// Quellenstatus
// ------------------------------------------------------------------------------------------------

const ERFOLG: ReadonlySet<BildBefundStatus> = new Set(["gelesen", "kein-text"]);

/** Ein Befund in diesem Zustand ist kein Ergebnis — ein ausdrücklicher Auftrag versucht es neu. */
export const NEU_VERSUCHEN: ReadonlySet<BildBefundStatus> = new Set([
  "wartet",
  "laeuft",
  "fehlgeschlagen",
  "zeitueberschreitung",
  "kein-zugriff",
  "nicht-analysiert",
]);

/** Text gelesen UND Bildinhalt beschrieben — erst dann ist ein Bild vollständig verarbeitet. */
export function bildVollstaendig(b: BildBefund): boolean {
  return ERFOLG.has(b.status) && b.bildinhalt.status === "beschrieben";
}

/** Etwas Nutzbares liegt vor: Text gelesen oder Bildinhalt beschrieben. */
function verwertbar(b: BildBefund): boolean {
  return ERFOLG.has(b.status) || b.bildinhalt.status === "beschrieben";
}

export function quellenStatus(
  befunde: readonly BildBefund[],
  nichtGelesen: readonly NichtGelesen[],
  hinweise: readonly QuellenHinweis[],
): QuellenStatus {
  const verloren = nichtGelesen.reduce((n, x) => n + x.anzahl, 0);
  if (befunde.length === 0) {
    return verloren > 0 ? "teilweise" : "ohne-bilder";
  }
  if (befunde.some((b) => b.status === "wartet" || b.status === "laeuft")) {
    return "laeuft";
  }
  if (befunde.every((b) => b.grund === "automatik-aus")) {
    return "aus";
  }
  if (!befunde.some(verwertbar)) {
    return befunde.every((b) => b.status === "nicht-verfuegbar")
      ? "nicht-verfuegbar"
      : "fehlgeschlagen";
  }
  if (!befunde.every(bildVollstaendig) || verloren > 0 || hinweise.length > 0) {
    return "teilweise";
  }
  return "vollstaendig";
}

/**
 * OCR-03: Die Einstellung des Kontos ist nicht lesbar — dann wird nicht automatisch gelesen, und das
 * steht da (statt still „an“ oder still „aus“ anzunehmen).
 */
export function einstellungUnbekannt(eingang: BildQuelleEingang): QuellenBefund {
  const befunde = eingang.vorkommen.map((v) => leererBefund(v.fundstelle, "nicht-analysiert"));
  const nichtGelesen = (eingang.nichtGelesen ?? []).filter((x) => x.anzahl > 0);
  const hinweise: QuellenHinweis[] = [...(eingang.hinweise ?? []), "einstellung-unbekannt"];
  return {
    quelle: eingang.quelle,
    art: eingang.art,
    status: quellenStatus(befunde, nichtGelesen, hinweise),
    befunde,
    nichtGelesen,
    hinweise,
  };
}

/** Ein Quellenbefund aus einzeln gelesenen Bildern (z. B. Bildanhänge eines Beitrags). */
export function quellenBefundAus(
  quelle: string,
  art: BildQuellenArt,
  befunde: BildBefund[],
): QuellenBefund {
  return {
    quelle,
    art,
    status: quellenStatus(befunde, [], []),
    befunde,
    nichtGelesen: [],
    hinweise: [],
  };
}

// ------------------------------------------------------------------------------------------------
// Die Analyse
// ------------------------------------------------------------------------------------------------

interface Erkennung {
  status: BildBefundStatus;
  text: string;
  textGekennzeichnet: string;
  unsicher: UnsichereStelle[];
  tabelle: string[][] | null;
  bildTabelle: BildTabelle | null;
  /** OCR-E01: die Wörter mit Rahmen, wie die Engine sie geliefert hat. */
  woerter: WortPosition[];
  /** Vollständige Enginewörter für gezielte Auswahl; Positionen im Befund bleiben unverändert. */
  engineWoerter: OcrWort[];
  fehler?: string;
}

/**
 * OCR-E06 · Die Lesung EINES Bildes mit den Wortrahmen der Engine — Grundlage der Bereichsfrage
 * („Klara, was steht hier?“, `lib/klaraBereich.ts`). Dieselbe Lesung wie der automatische Befund.
 */
export interface BildLesung {
  rahmen?: BildRahmen | undefined;
  status: BildBefundStatus;
  inhaltskennung: string | null;
  text: string;
  textGekennzeichnet: string;
  /** Die Wörter mit Sicherheit und, soweit die Engine sie liefert, Rahmen (Pixel im Original). */
  woerter: OcrWort[];
  /** Die Lesung stammt aus einer früheren Analyse derselben Bildbytes (z. B. der Automatik). */
  wiederverwendet: boolean;
  fehler?: string;
}

/** OCR-E01: nur Wörter mit Rahmen tragen eine Position. */
function wortPositionen(woerter: readonly OcrWort[] | undefined): WortPosition[] {
  const aus: WortPosition[] = [];
  for (const w of woerter ?? []) {
    if (w.bbox && w.text.trim().length > 0) {
      aus.push({ text: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 });
    }
  }
  return aus;
}

const NICHT_ANALYSIERT: Bildinhalt = { status: "nicht-analysiert", text: "" };

export function leererBefund(
  fundstelle: BildFundstelle,
  status: BildBefundStatus,
  extra: Partial<BildBefund> = {},
): BildBefund {
  return {
    fundstelle,
    status,
    inhaltskennung: null,
    text: "",
    textGekennzeichnet: "",
    unsicher: [],
    tabelle: null,
    bildinhalt: NICHT_ANALYSIERT,
    wiederverwendet: false,
    ...extra,
  };
}

export interface BildOptionen {
  /** Der Weg zur Bildbeschreibung der Fläche; fehlt er, heißt der Bildinhalt „nicht angebunden". */
  beschreibe?: BildBeschreiber | undefined;
  /** Ausdrücklicher Auftrag: dasselbe Bild trotz vorhandenem Befund noch einmal erkennen. */
  neu?: boolean;
}

export interface BildAnalyse {
  /** Ein einzelnes Bild lesen (bzw. den vorhandenen Befund derselben Bytes wiederverwenden). */
  befundFuerBild(vorkommen: BildVorkommen, optionen?: BildOptionen): Promise<BildBefund>;
  /**
   * Alle Bilder einer Quelle lesen, der Reihe nach; `onFortschritt` sieht jeden Zwischenstand.
   * OCR-03: Ist die Automatik aus, wird NICHTS neu ausgewertet — vorhandene Ergebnisse dieser Fläche
   * für dieselben Bildbytes bleiben nutzbar (gekennzeichnet als vorhanden), alle übrigen Bilder
   * heißen „nicht gelesen, Automatik aus“. `abbrechen` beendet einen überholten Lauf vor dem
   * nächsten Bild (Bild getauscht, Automatik ausgeschaltet); er startet dann nichts mehr.
   */
  analysiereQuelle(
    eingang: BildQuelleEingang,
    optionen: {
      automatik: boolean;
      beschreibe?: BildBeschreiber | undefined;
      onFortschritt?: (stand: QuellenBefund) => void;
      abbrechen?: () => boolean;
      /**
       * Nacharbeit 4 (Bens Befund „datei-automatik“): die Automatik wurde WÄHREND des Laufs
       * ausgeschaltet. Vor dem nächsten Bild geprüft: abgeschlossene Ergebnisse bleiben, die übrigen
       * Bilder heißen „nicht gelesen, Automatik aus“, und dieser Endstand wird gemeldet.
       */
      automatikAus?: () => boolean;
    },
  ): Promise<QuellenBefund>;
  /**
   * OCR-E06: die Lesung eines einzelnen, ausdrücklich ausgewählten Bildes samt Wortrahmen. Liegt
   * für dieselben Bildbytes schon eine Lesung vor (Automatik oder frühere Auswahl), wird sie
   * wiederverwendet; sonst wird GENAU DIESES Bild gelesen — nie die ganze Quelle. Das Ergebnis
   * steht danach auch der Automatik zur Verfügung (gleiche Bytes, gleicher Befund).
   */
  lesungFuerBild(vorkommen: BildVorkommen): Promise<BildLesung>;
  /** Wie oft die Texterkennung tatsächlich gelaufen ist (für die Wiederverwendungsprüfung). */
  anzahlAnalysen(): number;
  /** Wie oft die Bildbeschreibung tatsächlich angefragt wurde. */
  anzahlBeschreibungen(): number;
}

/** Ein Lauf mit Höchstdauer: das Ergebnis oder `"frist"`, wenn er nicht rechtzeitig fertig wird. */
export async function mitFrist<T>(lauf: Promise<T>, ms: number): Promise<T | "frist"> {
  let uhr: ReturnType<typeof setTimeout> | undefined;
  const frist = new Promise<"frist">((resolve) => {
    uhr = setTimeout(() => resolve("frist"), ms);
  });
  try {
    return await Promise.race([lauf, frist]);
  } finally {
    if (uhr !== undefined) {
      clearTimeout(uhr);
    }
  }
}

export function createBildAnalyse(optionen: {
  erkenne: BildErkenner;
  ladeBild?: BildLader;
  /** OCR-E03: misst Zellen ohne erkannte Wörter am Bild (Browser: `bildTintenAnteile`). */
  messeTinte?: TintenMesser;
  zeitlimitMs?: number;
  ladefristMs?: number;
  hoechstzahl?: number;
}): BildAnalyse {
  const zeitlimit = optionen.zeitlimitMs ?? BILD_ZEITLIMIT_MS;
  const ladefrist = optionen.ladefristMs ?? BILD_LADEFRIST_MS;
  const hoechstzahl = optionen.hoechstzahl ?? BILD_HOECHSTZAHL_JE_QUELLE;
  const gemerkt = new Map<string, Promise<Erkennung>>();
  const inhalteGemerkt = new Map<string, Promise<Bildinhalt>>();
  // OCR-03: welche Inhaltskennung ein geladenes Objektspeicher-Bild hatte — damit eine ausgeschaltete
  // Automatik vorhandene Ergebnisse wiederfindet, ohne das Bild erneut zu laden.
  const kennungJeAdresse = new Map<string, string>();
  // OCR-E01: die Maße je Inhaltskennung — auch für vorhandene Ergebnisse ohne erneutes Laden.
  const rahmenJeKennung = new Map<string, BildRahmen>();
  let analysen = 0;
  let beschreibungen = 0;

  const erkenneMitFrist = async (src: string): Promise<Erkennung> => {
    analysen += 1;
    const leer = {
      text: "",
      textGekennzeichnet: "",
      unsicher: [],
      tabelle: null,
      bildTabelle: null,
      woerter: [],
      engineWoerter: [],
    };
    try {
      const ergebnis = await mitFrist(optionen.erkenne(src), zeitlimit);
      if (ergebnis === "frist") {
        return { status: "zeitueberschreitung", ...leer };
      }
      if (ergebnis.status === "success") {
        const text = ergebnis.text.trim();
        if (text.length === 0) {
          return { status: "kein-text", ...leer };
        }
        const raster = bildTabelleAusWoertern(ergebnis.woerter);
        return {
          status: "gelesen",
          text,
          ...kennzeichneUnsicheres(text, ergebnis.woerter),
          tabelle: tabelleAusWoertern(ergebnis.woerter),
          // OCR-E03 Nacharbeit 4: Zellen ohne Wörter am Bild prüfen, bevor sie „leer“ heißen.
          bildTabelle: raster ? await pruefeLeereZellen(raster, src, optionen.messeTinte) : raster,
          woerter: wortPositionen(ergebnis.woerter),
          engineWoerter: ergebnis.woerter ?? [],
        };
      }
      return {
        status: ergebnis.status === "unavailable" ? "nicht-verfuegbar" : "fehlgeschlagen",
        ...leer,
        ...(ergebnis.error ? { fehler: ergebnis.error } : {}),
      };
    } catch (error) {
      return {
        status: "fehlgeschlagen",
        ...leer,
        fehler: error instanceof Error ? error.message : "fehler",
      };
    }
  };

  const beschreibeMitFrist = async (
    beschreibe: BildBeschreiber,
    src: string,
  ): Promise<Bildinhalt> => {
    beschreibungen += 1;
    try {
      const ergebnis = await mitFrist(beschreibe(src), zeitlimit);
      return ergebnis === "frist"
        ? { status: "fehlgeschlagen", text: "", grund: "zeitueberschreitung" }
        : ergebnis;
    } catch (error) {
      return {
        status: "fehlgeschlagen",
        text: "",
        grund: error instanceof Error ? error.message : "fehler",
      };
    }
  };

  // Nacharbeit 5 (Bens Befund 2): der Lesezugriff ist begrenzt — Abruf UND Antwortkörper. Nach der
  // Frist wird abgebrochen; das Bild heißt „Zeitüberschreitung“, und das nächste Bild läuft weiter.
  const ladeDaten = async (src: string | null): Promise<string | null | "frist"> => {
    if (!src || istBildDatenUrl(src)) {
      return src;
    }
    const lader = optionen.ladeBild;
    if (!lader) {
      return null;
    }
    const abbruch = new AbortController();
    try {
      const ergebnis = await mitFrist(lader(src, abbruch.signal), ladefrist);
      if (ergebnis === "frist") {
        abbruch.abort();
      }
      return ergebnis;
    } catch {
      return null;
    }
  };

  // Die Erkennung derselben Bildbytes — gemerkt oder neu. Gemeinsam für Befund und Bereichsfrage.
  const erkennungFuer = async (
    daten: string,
    kennung: string | null,
    neu: boolean,
  ): Promise<{ erkennung: Erkennung; wiederverwendet: boolean }> => {
    const vorhanden = kennung && !neu ? gemerkt.get(kennung) : undefined;
    if (vorhanden) {
      return { erkennung: await vorhanden, wiederverwendet: true };
    }
    const lauf = erkenneMitFrist(daten);
    if (kennung) {
      gemerkt.set(kennung, lauf);
    }
    const erkennung = await lauf;
    // Nur ein abgeschlossener Befund wird gemerkt; ein Fehlschlag darf beim nächsten Eingang
    // erneut versucht werden.
    if (kennung && !ERFOLG.has(erkennung.status) && gemerkt.get(kennung) === lauf) {
      gemerkt.delete(kennung);
    }
    return { erkennung, wiederverwendet: false };
  };

  // Laden und Inhaltskennung eines Vorkommens; Objektspeicher-Adressen merken ihre Kennung.
  const datenUndKennung = async (
    vorkommen: BildVorkommen,
  ): Promise<{ daten: string; kennung: string | null } | "frist" | null> => {
    const daten = await ladeDaten(vorkommen.src);
    if (daten === "frist") {
      return "frist";
    }
    const bytes = bildBytes(daten);
    if (!bytes || !daten) {
      return null;
    }
    const kennung = await bildInhaltskennung(bytes);
    if (kennung && vorkommen.src && !istBildDatenUrl(vorkommen.src)) {
      kennungJeAdresse.set(vorkommen.src.trim(), kennung);
    }
    const rahmen = bildRahmenAus(bytes);
    if (kennung && rahmen) {
      rahmenJeKennung.set(kennung, rahmen);
    }
    return { daten, kennung };
  };

  const befundFuerBild: BildAnalyse["befundFuerBild"] = async (vorkommen, bildOptionen = {}) => {
    const geladen = await datenUndKennung(vorkommen);
    if (geladen === "frist") {
      return leererBefund(vorkommen.fundstelle, "zeitueberschreitung", { fehler: "ladefrist" });
    }
    if (!geladen) {
      return leererBefund(vorkommen.fundstelle, "kein-zugriff");
    }
    const { daten, kennung } = geladen;
    const rahmen = kennung ? rahmenJeKennung.get(kennung) : undefined;
    const { erkennung, wiederverwendet } = await erkennungFuer(
      daten,
      kennung,
      bildOptionen.neu === true,
    );
    // Bildinhalt nach dem Text (Text hat Vorrang). Gemerkt wird nur eine gelungene Beschreibung;
    // „nicht zulässig" oder „nicht verfügbar" wird beim nächsten Eingang neu gefragt, denn
    // Einstufung und Modelllage können sich ändern.
    let bildinhalt: Bildinhalt;
    if (!bildOptionen.beschreibe) {
      bildinhalt = { status: "nicht-angebunden", text: "" };
    } else {
      const inhaltVorhanden =
        kennung && !bildOptionen.neu ? inhalteGemerkt.get(kennung) : undefined;
      if (inhaltVorhanden) {
        bildinhalt = await inhaltVorhanden;
      } else {
        const lauf = beschreibeMitFrist(bildOptionen.beschreibe, daten);
        if (kennung) {
          inhalteGemerkt.set(kennung, lauf);
        }
        bildinhalt = await lauf;
        if (
          kennung &&
          bildinhalt.status !== "beschrieben" &&
          inhalteGemerkt.get(kennung) === lauf
        ) {
          inhalteGemerkt.delete(kennung);
        }
      }
    }
    return {
      fundstelle: vorkommen.fundstelle,
      status: erkennung.status,
      inhaltskennung: kennung,
      text: erkennung.text,
      textGekennzeichnet: erkennung.textGekennzeichnet,
      unsicher: erkennung.unsicher,
      tabelle: erkennung.tabelle,
      bildTabelle: erkennung.bildTabelle,
      bildinhalt,
      wiederverwendet,
      ...(erkennung.fehler ? { fehler: erkennung.fehler } : {}),
      ...(erkennung.woerter.length > 0 ? { woerter: erkennung.woerter } : {}),
      ...(rahmen ? { rahmen } : {}),
    };
  };

  // OCR-03: ein VORHANDENES, abgeschlossenes Ergebnis derselben Bildbytes — ohne neue Erkennung, ohne
  // neue Beschreibung und ohne erneutes Laden. Läuft für dieselben Bytes gerade noch eine Erkennung,
  // wird ihr Ende abgewartet (eine laufende Analyse läuft zu Ende, sie wird nicht verworfen).
  const vorhandenerBefund = async (vorkommen: BildVorkommen): Promise<BildBefund | null> => {
    const src = vorkommen.src?.trim() ?? "";
    if (src.length === 0) {
      return null;
    }
    let kennung: string | null = null;
    if (istBildDatenUrl(src)) {
      const bytes = bildBytes(src);
      kennung = bytes ? await bildInhaltskennung(bytes) : null;
    } else {
      kennung = kennungJeAdresse.get(src) ?? null;
    }
    const lauf = kennung ? gemerkt.get(kennung) : undefined;
    if (!kennung || !lauf) {
      return null;
    }
    const erkennung = await lauf;
    if (!ERFOLG.has(erkennung.status)) {
      return null;
    }
    const inhalt = inhalteGemerkt.get(kennung);
    const rahmen = rahmenJeKennung.get(kennung);
    return {
      fundstelle: vorkommen.fundstelle,
      status: erkennung.status,
      inhaltskennung: kennung,
      text: erkennung.text,
      textGekennzeichnet: erkennung.textGekennzeichnet,
      unsicher: erkennung.unsicher,
      tabelle: erkennung.tabelle,
      bildTabelle: erkennung.bildTabelle,
      bildinhalt: inhalt ? await inhalt : NICHT_ANALYSIERT,
      wiederverwendet: true,
      ...(erkennung.woerter.length > 0 ? { woerter: erkennung.woerter } : {}),
      ...(rahmen ? { rahmen } : {}),
    };
  };

  // OCR-E06: nur dieses eine Bild — vorhandene Lesung derselben Bytes zuerst, sonst gezielt ergänzt.
  const lesungFuerBild: BildAnalyse["lesungFuerBild"] = async (vorkommen) => {
    const leer = (status: BildBefundStatus, fehler?: string): BildLesung => ({
      status,
      inhaltskennung: null,
      text: "",
      textGekennzeichnet: "",
      woerter: [],
      wiederverwendet: false,
      ...(fehler ? { fehler } : {}),
    });
    const geladen = await datenUndKennung(vorkommen);
    if (geladen === "frist") {
      return leer("zeitueberschreitung", "ladefrist");
    }
    if (!geladen) {
      return leer("kein-zugriff");
    }
    const { erkennung, wiederverwendet } = await erkennungFuer(
      geladen.daten,
      geladen.kennung,
      false,
    );
    return {
      status: erkennung.status,
      inhaltskennung: geladen.kennung,
      text: erkennung.text,
      textGekennzeichnet: erkennung.textGekennzeichnet,
      woerter: erkennung.engineWoerter,
      rahmen: geladen.kennung ? rahmenJeKennung.get(geladen.kennung) : undefined,
      wiederverwendet,
      ...(erkennung.fehler ? { fehler: erkennung.fehler } : {}),
    };
  };

  const analysiereQuelle: BildAnalyse["analysiereQuelle"] = async (
    eingang,
    { automatik, beschreibe, onFortschritt, abbrechen, automatikAus },
  ) => {
    const nichtGelesen = (eingang.nichtGelesen ?? []).filter((x) => x.anzahl > 0);
    const hinweise = [...(eingang.hinweise ?? [])];
    if (eingang.vorkommen.length > hoechstzahl) {
      hinweise.push("grenze-erreicht");
    }
    const befunde: BildBefund[] = eingang.vorkommen.map((v, i) =>
      !automatik
        ? leererBefund(v.fundstelle, "nicht-analysiert", { grund: "automatik-aus" })
        : i >= hoechstzahl
          ? leererBefund(v.fundstelle, "nicht-analysiert", { grund: "grenze" })
          : leererBefund(v.fundstelle, "wartet"),
    );
    const stand = (): QuellenBefund => ({
      quelle: eingang.quelle,
      art: eingang.art,
      status: quellenStatus(befunde, nichtGelesen, hinweise),
      befunde: [...befunde],
      nichtGelesen,
      hinweise,
    });
    if (automatik) {
      for (let i = 0; i < befunde.length; i += 1) {
        const vorkommen = eingang.vorkommen[i];
        const befund = befunde[i];
        if (!vorkommen || !befund || befund.status !== "wartet") {
          continue;
        }
        if (abbrechen?.()) {
          break;
        }
        if (automatikAus?.()) {
          for (let j = i; j < befunde.length; j += 1) {
            const rest = befunde[j];
            if (rest && rest.status === "wartet") {
              befunde[j] = leererBefund(rest.fundstelle, "nicht-analysiert", {
                grund: "automatik-aus",
              });
            }
          }
          onFortschritt?.(stand());
          break;
        }
        befunde[i] = { ...befund, status: "laeuft" };
        onFortschritt?.(stand());
        befunde[i] = await befundFuerBild(vorkommen, { beschreibe });
        onFortschritt?.(stand());
      }
    } else {
      // OCR-03: aus heißt „nichts NEU auswerten“ — vorhandene Ergebnisse bleiben nutzbar.
      for (let i = 0; i < befunde.length; i += 1) {
        const vorkommen = eingang.vorkommen[i];
        if (!vorkommen || i >= hoechstzahl || abbrechen?.()) {
          continue;
        }
        const vorhanden = await vorhandenerBefund(vorkommen);
        if (vorhanden) {
          befunde[i] = vorhanden;
        }
      }
    }
    const ende = stand();
    if (!automatik) {
      onFortschritt?.(ende);
    }
    return ende;
  };

  return {
    befundFuerBild,
    analysiereQuelle,
    lesungFuerBild,
    anzahlAnalysen: () => analysen,
    anzahlBeschreibungen: () => beschreibungen,
  };
}

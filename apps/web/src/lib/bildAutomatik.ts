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

import type { DescribeImageResult } from "../api/types";
import type { OcrResult, OcrWort } from "./ocr";
import type { PptxRichResult } from "./pptx";

/** Die Automatik ist ohne abweichende Einstellung an (Product-Owner-Konkretisierung). */
export const BILD_AUTOMATIK_VOREINSTELLUNG = true;
/** Höchstdauer je Bild und Weg. Danach gilt der Lauf als „Zeitüberschreitung", nicht als gelesen. */
export const BILD_ZEITLIMIT_MS = 90_000;
/** Höchstzahl automatisch gelesener Bilder je Quelle; der Rest bleibt sichtbar „nicht analysiert". */
export const BILD_HOECHSTZAHL_JE_QUELLE = 40;
/** Unter dieser Sicherheit (0–100) gilt ein Wort als unsicher. */
export const UNSICHER_UNTER = 60;
/** Unter dieser Sicherheit gilt ein Wort als unleserlich und wird nicht als Text ausgegeben. */
export const UNLESERLICH_UNTER = 30;

/** `rumpf`: Bilder im Text eines Entwurfs oder Wissensobjekts (Editor, auch aus Word/Browser). */
export type BildQuellenArt = "bild" | "pptx" | "docx" | "rumpf";

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
  /** Der wesentliche Bildinhalt über W02. */
  bildinhalt: Bildinhalt;
  /** Der Textbefund stammt aus einer früheren Analyse derselben Bildbytes. */
  wiederverwendet: boolean;
  /** Warum nicht analysiert wurde. */
  grund?: "automatik-aus" | "grenze";
  fehler?: string;
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
  | "grenze-erreicht";

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
}

export type BildErkenner = (src: string) => Promise<OcrResult>;
export type BildBeschreiber = (src: string) => Promise<Bildinhalt>;
export type BildLader = (src: string) => Promise<string | null>;

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

/** Ein Wort, wie es im Befund steht: sicher wie gelesen, unsicher `[?wort]`, sonst `[unleserlich]`. */
function gekennzeichnet(wort: string, sicherheit: number): string {
  if (sicherheit < UNLESERLICH_UNTER) {
    return "[unleserlich]";
  }
  if (sicherheit < UNSICHER_UNTER) {
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
    if (sicherheit < UNSICHER_UNTER) {
      unsicher.push({ wort: token, sicherheit, unleserlich: sicherheit < UNLESERLICH_UNTER });
    }
    return gekennzeichnet(token, sicherheit);
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
      const text = gekennzeichnet(w.text, w.confidence);
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
  fehler?: string;
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
  /** Alle Bilder einer Quelle lesen, der Reihe nach; `onFortschritt` sieht jeden Zwischenstand. */
  analysiereQuelle(
    eingang: BildQuelleEingang,
    optionen: {
      automatik: boolean;
      beschreibe?: BildBeschreiber | undefined;
      onFortschritt?: (stand: QuellenBefund) => void;
    },
  ): Promise<QuellenBefund>;
  /** Wie oft die Texterkennung tatsächlich gelaufen ist (für die Wiederverwendungsprüfung). */
  anzahlAnalysen(): number;
  /** Wie oft die Bildbeschreibung tatsächlich angefragt wurde. */
  anzahlBeschreibungen(): number;
}

async function mitFrist<T>(lauf: Promise<T>, ms: number): Promise<T | "frist"> {
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
  zeitlimitMs?: number;
  hoechstzahl?: number;
}): BildAnalyse {
  const zeitlimit = optionen.zeitlimitMs ?? BILD_ZEITLIMIT_MS;
  const hoechstzahl = optionen.hoechstzahl ?? BILD_HOECHSTZAHL_JE_QUELLE;
  const gemerkt = new Map<string, Promise<Erkennung>>();
  const inhalteGemerkt = new Map<string, Promise<Bildinhalt>>();
  let analysen = 0;
  let beschreibungen = 0;

  const erkenneMitFrist = async (src: string): Promise<Erkennung> => {
    analysen += 1;
    const leer = { text: "", textGekennzeichnet: "", unsicher: [], tabelle: null };
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
        return {
          status: "gelesen",
          text,
          ...kennzeichneUnsicheres(text, ergebnis.woerter),
          tabelle: tabelleAusWoertern(ergebnis.woerter),
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

  const ladeDaten = async (src: string | null): Promise<string | null> => {
    if (!src || istBildDatenUrl(src)) {
      return src;
    }
    if (!optionen.ladeBild) {
      return null;
    }
    try {
      return await optionen.ladeBild(src);
    } catch {
      return null;
    }
  };

  const befundFuerBild: BildAnalyse["befundFuerBild"] = async (vorkommen, bildOptionen = {}) => {
    const daten = await ladeDaten(vorkommen.src);
    const bytes = bildBytes(daten);
    if (!bytes || !daten) {
      return leererBefund(vorkommen.fundstelle, "kein-zugriff");
    }
    const kennung = await bildInhaltskennung(bytes);
    const vorhanden = kennung && !bildOptionen.neu ? gemerkt.get(kennung) : undefined;
    let erkennung: Erkennung;
    let wiederverwendet = false;
    if (vorhanden) {
      erkennung = await vorhanden;
      wiederverwendet = true;
    } else {
      const lauf = erkenneMitFrist(daten);
      if (kennung) {
        gemerkt.set(kennung, lauf);
      }
      erkennung = await lauf;
      // Nur ein abgeschlossener Befund wird gemerkt; ein Fehlschlag darf beim nächsten Eingang
      // erneut versucht werden.
      if (kennung && !ERFOLG.has(erkennung.status) && gemerkt.get(kennung) === lauf) {
        gemerkt.delete(kennung);
      }
    }
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
      bildinhalt,
      wiederverwendet,
      ...(erkennung.fehler ? { fehler: erkennung.fehler } : {}),
    };
  };

  const analysiereQuelle: BildAnalyse["analysiereQuelle"] = async (
    eingang,
    { automatik, beschreibe, onFortschritt },
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
        befunde[i] = { ...befund, status: "laeuft" };
        onFortschritt?.(stand());
        befunde[i] = await befundFuerBild(vorkommen, { beschreibe });
        onFortschritt?.(stand());
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
    anzahlAnalysen: () => analysen,
    anzahlBeschreibungen: () => beschreibungen,
  };
}

// ================================================================================================
// OCR-02 · KLARA LIEST BEREITGESTELLTE BILDER AUTOMATISCH (Auftrag
// produkt:20261012:klara-bildanalyse-ocr-automatik, Integrationsplan docs/klara-bildanalyse-ocr/).
// ================================================================================================
//
// Peter, 12.10.2026: „sofort automatisch mitlesen." Ein bereitgestelltes Bild und die eingebetteten
// Bilder eines Dokuments werden beim Eingang gelesen — ohne Klick auf „OCR → Text".
//
// DIESE DATEI IST DOM-FREI. Die Erkennung selbst wird injiziert (`erkenne`); im Browser ist das
// die vorhandene Texterkennung `runImageOcr` (W01, `lib/files.ts`), in den Tests ein Stellvertreter.
// Es gibt keine zweite Engine.
//
// WAS SIE ZUSAGT, und was nicht:
//   · Jeder Befund trägt seine Fundstelle: Quelle, Bild in Dokumentreihenfolge, bei PowerPoint die
//     Folie und das Bild auf dieser Folie (L04).
//   · Gleiche Bildbytes (`sha256`, wie W16) heißen gleicher Befund, ohne neue Analyse. Andere Bytes
//     heißen neue Analyse; ein Befund gehört immer zu genau der Inhaltskennung, aus der er stammt.
//     Fehlgeschlagene Läufe werden nicht gemerkt — ein neuer Eingang versucht es erneut.
//   · Unsichere Wörter werden markiert (`[?wort]`), sehr unsichere als `[unleserlich]` ersetzt. Es
//     wird nichts ergänzt.
//   · Eine Quelle heißt nur dann „vollständig gelesen", wenn jedes Bild gelesen ist, kein Bild der
//     Quelle beim Einlesen verloren ging und keine bekannte Erfassungsgrenze greift. Sonst
//     „teilweise", „fehlgeschlagen" oder „nicht verfügbar" — nie stillschweigend „fertig".
//   · Das Original wird nicht verändert: gelesen wird aus der data-URL, geschrieben wird nur der
//     Befund.
//
// NICHT HIER: die Beschreibung des Bildinhalts über ein Modell (W02) und die Nutzung der Befunde in
// Klaras Antworten sowie der Setup-Schalter — das sind OCR-03 bzw. eigene Entscheidungen.

import type { OcrResult, OcrWort } from "./ocr";
import type { PptxRichResult } from "./pptx";

/** Die Automatik ist ohne abweichende Einstellung an (Product-Owner-Konkretisierung). */
export const BILD_AUTOMATIK_VOREINSTELLUNG = true;
/** Höchstdauer je Bild. Danach gilt der Lauf als „Zeitüberschreitung", nicht als gelesen. */
export const BILD_ZEITLIMIT_MS = 90_000;
/** Höchstzahl automatisch gelesener Bilder je Quelle; der Rest bleibt sichtbar „nicht analysiert". */
export const BILD_HOECHSTZAHL_JE_QUELLE = 40;
/** Unter dieser Sicherheit (0–100) gilt ein Wort als unsicher. */
export const UNSICHER_UNTER = 60;
/** Unter dieser Sicherheit gilt ein Wort als unleserlich und wird nicht als Text ausgegeben. */
export const UNLESERLICH_UNTER = 30;

export type BildQuellenArt = "bild" | "pptx" | "docx";

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
  /** Die Bilddaten als data-URL; `null` oder eine fremde Adresse heißt: kein Zugriff auf die Bytes. */
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
  /** Der Befund stammt aus einer früheren Analyse derselben Bildbytes. */
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

// ------------------------------------------------------------------------------------------------
// Vorkommen aus einem Rumpf (PPTX/DOCX-Import) — in Dokumentreihenfolge
// ------------------------------------------------------------------------------------------------

const IMG_RE = /<img\b[^>]*>/gi;
const FOLIENANSICHT_RE = /-s(\d+)$/;

function attribut(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag);
  return m ? (m[1] ?? "") : null;
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
    const src = attribut(tag, "src");
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

// ------------------------------------------------------------------------------------------------
// Inhaltskennung und Kennzeichnung
// ------------------------------------------------------------------------------------------------

const DATA_URL_RE = /^data:image\/[^;,]+;base64,([\s\S]*)$/i;

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
    if (sicherheit < UNLESERLICH_UNTER) {
      unsicher.push({ wort: token, sicherheit, unleserlich: true });
      return "[unleserlich]";
    }
    if (sicherheit < UNSICHER_UNTER) {
      unsicher.push({ wort: token, sicherheit, unleserlich: false });
      return `[?${token}]`;
    }
    return token;
  });
  return { textGekennzeichnet, unsicher };
}

// ------------------------------------------------------------------------------------------------
// Quellenstatus
// ------------------------------------------------------------------------------------------------

const ERFOLG: ReadonlySet<BildBefundStatus> = new Set(["gelesen", "kein-text"]);

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
  const erfolgreich = befunde.filter((b) => ERFOLG.has(b.status)).length;
  if (erfolgreich === 0) {
    return befunde.every((b) => b.status === "nicht-verfuegbar")
      ? "nicht-verfuegbar"
      : "fehlgeschlagen";
  }
  if (erfolgreich < befunde.length || verloren > 0 || hinweise.length > 0) {
    return "teilweise";
  }
  return "vollstaendig";
}

// ------------------------------------------------------------------------------------------------
// Die Analyse
// ------------------------------------------------------------------------------------------------

interface Erkennung {
  status: BildBefundStatus;
  text: string;
  textGekennzeichnet: string;
  unsicher: UnsichereStelle[];
  fehler?: string;
}

function leererBefund(
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
    wiederverwendet: false,
    ...extra,
  };
}

export interface BildAnalyse {
  /** Ein einzelnes Bild lesen (bzw. den vorhandenen Befund derselben Bytes wiederverwenden). */
  befundFuerBild(vorkommen: BildVorkommen): Promise<BildBefund>;
  /** Alle Bilder einer Quelle lesen, der Reihe nach; `onFortschritt` sieht jeden Zwischenstand. */
  analysiereQuelle(
    eingang: BildQuelleEingang,
    optionen: { automatik: boolean; onFortschritt?: (stand: QuellenBefund) => void },
  ): Promise<QuellenBefund>;
  /** Wie oft die Engine tatsächlich gelaufen ist (für die Wiederverwendungsprüfung). */
  anzahlAnalysen(): number;
}

export function createBildAnalyse(optionen: {
  erkenne: BildErkenner;
  zeitlimitMs?: number;
  hoechstzahl?: number;
}): BildAnalyse {
  const zeitlimit = optionen.zeitlimitMs ?? BILD_ZEITLIMIT_MS;
  const hoechstzahl = optionen.hoechstzahl ?? BILD_HOECHSTZAHL_JE_QUELLE;
  const gemerkt = new Map<string, Promise<Erkennung>>();
  let analysen = 0;

  const erkenneMitFrist = async (src: string): Promise<Erkennung> => {
    analysen += 1;
    let uhr: ReturnType<typeof setTimeout> | undefined;
    const frist = new Promise<"frist">((resolve) => {
      uhr = setTimeout(() => resolve("frist"), zeitlimit);
    });
    try {
      const ergebnis = await Promise.race([optionen.erkenne(src), frist]);
      if (ergebnis === "frist") {
        return { status: "zeitueberschreitung", text: "", textGekennzeichnet: "", unsicher: [] };
      }
      if (ergebnis.status === "success") {
        const text = ergebnis.text.trim();
        if (text.length === 0) {
          return { status: "kein-text", text: "", textGekennzeichnet: "", unsicher: [] };
        }
        return { status: "gelesen", text, ...kennzeichneUnsicheres(text, ergebnis.woerter) };
      }
      return {
        status: ergebnis.status === "unavailable" ? "nicht-verfuegbar" : "fehlgeschlagen",
        text: "",
        textGekennzeichnet: "",
        unsicher: [],
        ...(ergebnis.error ? { fehler: ergebnis.error } : {}),
      };
    } catch (error) {
      return {
        status: "fehlgeschlagen",
        text: "",
        textGekennzeichnet: "",
        unsicher: [],
        fehler: error instanceof Error ? error.message : "fehler",
      };
    } finally {
      if (uhr !== undefined) {
        clearTimeout(uhr);
      }
    }
  };

  const befundFuerBild = async (vorkommen: BildVorkommen): Promise<BildBefund> => {
    const bytes = bildBytes(vorkommen.src);
    if (!bytes || !vorkommen.src) {
      return leererBefund(vorkommen.fundstelle, "kein-zugriff");
    }
    const kennung = await bildInhaltskennung(bytes);
    const vorhanden = kennung ? gemerkt.get(kennung) : undefined;
    let erkennung: Erkennung;
    let wiederverwendet = false;
    if (vorhanden) {
      erkennung = await vorhanden;
      wiederverwendet = true;
    } else {
      const lauf = erkenneMitFrist(vorkommen.src);
      if (kennung) {
        gemerkt.set(kennung, lauf);
      }
      erkennung = await lauf;
      // Nur ein abgeschlossener Befund wird gemerkt; ein Fehlschlag darf beim nächsten Eingang
      // erneut versucht werden.
      if (kennung && !ERFOLG.has(erkennung.status)) {
        gemerkt.delete(kennung);
      }
    }
    return {
      fundstelle: vorkommen.fundstelle,
      status: erkennung.status,
      inhaltskennung: kennung,
      text: erkennung.text,
      textGekennzeichnet: erkennung.textGekennzeichnet,
      unsicher: erkennung.unsicher,
      wiederverwendet,
      ...(erkennung.fehler ? { fehler: erkennung.fehler } : {}),
    };
  };

  const analysiereQuelle: BildAnalyse["analysiereQuelle"] = async (
    eingang,
    { automatik, onFortschritt },
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
        befunde[i] = await befundFuerBild(vorkommen);
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
  };
}

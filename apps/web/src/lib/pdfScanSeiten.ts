// ================================================================================================
// OCR-E04 · VOLLSTÄNDIG GESCANNTE, MEHRSEITIGE DOKUMENTE AUTOMATISCH LESEN (Auftrag
// produkt:20261012:klara-ocr-mehrseitige-scans, Revision 1).
// ================================================================================================
//
// Eine PDF, deren Seiten ganz oder teilweise Bilder sind, wird beim Eingang Seite für Seite gelesen
// — ohne Klick, solange die Automatik an ist (Setup › Klara, OCR-03). Bis hier las der Dateiimport
// nur die Textebene (BESTAND L06); eine gescannte Seite ergab keinen Text.
//
// DIESE DATEI IST DOM-FREI. Die Wege werden injiziert:
//   · `zeichne` — die Seite als Bild über dieselbe pdfjs-Engine (`pdfSeitenZeichner`, `lib/files.ts`),
//   · `analyse` — die vorhandene Bildanalyse (`createBildAnalyse`, `lib/bildAutomatik.ts`) mit der
//     vorhandenen Texterkennung (W01). Es gibt keine zweite Engine und keinen neuen Datenweg; ein
//     Modell wird für Seiten nicht gefragt.
//
// WAS SIE ZUSAGT:
//   · Jede gelesene Seite steht mit ihrer Seitenzahl da, in Seitenreihenfolge: die Textebene als
//     „Seite N“, die erkannte Seite als „Seite N, erkannt“. Absätze und Überschriften einer Seite
//     bleiben, wie Textebene bzw. Erkennung sie liefern (Zeilen und Leerzeilen).
//   · Eine Seite wird gelesen, wenn ihre Textebene (fast) leer ist ODER wenn sie ein Bild zeichnet
//     (gemischte Seite). Eine reine Textseite wird nicht erkannt.
//   · Nichts doppelt: Eine erkannte Zeile, die wörtlich (ohne Gross-/Kleinschreibung, Satzzeichen und
//     Leerraum) schon in der Textebene DERSELBEN Seite steht, kommt nicht ein zweites Mal in den Text.
//     Wie viele Zeilen das betraf, steht am Befund (`doppelt`).
//   · Laufende, fehlgeschlagene, nicht gelesene und fehlende Seiten (über `MAX_PDF_PAGES`) stehen als
//     solche im Status — nie still ausgelassen. Ein Fehler auf einer Seite hält die übrigen nicht auf.
//   · „Vollständig“ heisst: jede Seite gelesen, keine fehlt.
//   · Das Original wird nicht verändert: das Seitenbild entsteht nur im Speicher für die Lesung.

import {
  type BildAnalyse,
  type BildBefund,
  type BildFundstelle,
  type BildQuelleEingang,
  type BildVorkommen,
  type QuellenBefund,
  type QuellenHinweis,
  type QuellenStatus,
  leererBefund,
  mitFrist,
} from "./bildAutomatik";
import type { PdfDocumentText } from "./pdf";

/** Unter so vielen Zeichen (ohne Leerraum) gilt die Textebene einer Seite als leer: Bildseite. */
export const SEITE_OHNE_TEXTEBENE_UNTER = 20;
/** Höchstdauer, eine Seite als Bild zu zeichnen. Danach heisst sie „Zeitüberschreitung“. */
export const SEITE_ZEICHENFRIST_MS = 30_000;

/** `textebene`: nur Text; `bildseite`: (fast) keine Textebene; `gemischt`: Text und Bild. */
export type PdfSeitenArt = "textebene" | "bildseite" | "gemischt";

export interface PdfSeite {
  seite: number;
  art: PdfSeitenArt;
  /** Der Text der Textebene dieser Seite — auch bei Bild- und gemischten Seiten, wenn vorhanden. */
  textebene: string;
}

export interface PdfScanEingang extends BildQuelleEingang {
  art: "pdf";
  seiten: PdfSeite[];
  /** Seiten über der Seitengrenze — weder Textebene noch Seite gelesen. */
  fehlendeSeiten: number;
}

function zeichen(text: string): number {
  return text.replace(/\s+/g, "").length;
}

/**
 * Die Seiten einer gelesenen PDF mit ihrer Art. Ohne Seitentexte (`pages`) gibt es keinen Plan.
 * Eine vorhandene Textebene bleibt IMMER erhalten — auch eine kurze (etwa nur eine Überschrift über
 * einem Scan); sie wird nie still verworfen. Eine Seite mit Bild und Text ist gemischt.
 *
 * Nacharbeit 2 (Ben): Konnte die Engine NICHT bestimmen, ob die Seite ein Bild zeichnet
 * (`pageImages[i] === null`, etwa nach einem Fehler in `getOperatorList`), ist sie nicht
 * nachweislich bildfrei — sie wird wie eine gemischte Seite gelesen, statt einen möglichen
 * Bildinhalt still auszulassen. Nur `false` heisst „ohne Bild“.
 */
export function pdfSeitenPlan(pdf: Pick<PdfDocumentText, "pages" | "pageImages">): PdfSeite[] {
  return (pdf.pages ?? []).map((text, i) => {
    const textebene = text.trim();
    const bild = pdf.pageImages?.[i];
    const vielleichtBild = bild === true || bild === null;
    const art: PdfSeitenArt =
      vielleichtBild && textebene.length > 0
        ? "gemischt"
        : zeichen(textebene) < SEITE_OHNE_TEXTEBENE_UNTER
          ? "bildseite"
          : "textebene";
    return { seite: i + 1, art, textebene };
  });
}

/**
 * Der Eingang einer PDF für das Seitenlesen — `null`, wenn keine Seite gelesen werden muss (reine
 * Text-PDF: dort bleibt der Import, wie er war). Je Seite ein Vorkommen für die Textebene (wenn sie
 * Text trägt) und eines für die gelesene Seite (Bild- und gemischte Seiten), in Seitenreihenfolge.
 */
export function pdfScanEingang(
  name: string,
  pdf: Pick<PdfDocumentText, "pages" | "pageImages" | "pageCount" | "totalPages">,
): PdfScanEingang | null {
  const seiten = pdfSeitenPlan(pdf);
  if (!seiten.some((s) => s.art !== "textebene")) {
    return null;
  }
  const vorkommen: BildVorkommen[] = [];
  const fundstelle = (seite: number, seitenteil: "textebene" | "bild"): BildFundstelle => ({
    quelle: name,
    art: "pdf",
    bild: vorkommen.length + 1,
    seite,
    seitenteil,
  });
  for (const s of seiten) {
    if (s.textebene.length > 0) {
      vorkommen.push({ fundstelle: fundstelle(s.seite, "textebene"), src: null });
    }
    if (s.art !== "textebene") {
      vorkommen.push({ fundstelle: fundstelle(s.seite, "bild"), src: null });
    }
  }
  const fehlendeSeiten = Math.max(0, (pdf.totalPages ?? pdf.pageCount) - pdf.pageCount);
  return {
    quelle: name,
    art: "pdf",
    vorkommen,
    seiten,
    fehlendeSeiten,
    nichtGelesen: [],
    hinweise: fehlendeSeiten > 0 ? ["pdf-seiten-fehlen"] : [],
  };
}

// ------------------------------------------------------------------------------------------------
// Nichts doppelt
// ------------------------------------------------------------------------------------------------

/**
 * Ein Wort der Vergleichsform: Buchstaben/Ziffern samt unmittelbar vorangestelltem Vorzeichen bzw.
 * Vergleichsoperator („-1500“, „<1500“, „≥5“) und Dezimal-/Tausendertrennern zwischen Ziffern
 * („4,5“, „1.500“). Allein stehende Operatoren und Einheitenzeichen bleiben eigene Wörter.
 */
const VERGLEICHSWORT_RE = /[+\-±<>≤≥=]*[\p{L}\p{N}]+(?:[.,][\p{N}]+)*|[+\-±<>≤≥=%€$£§]/gu;

/**
 * Eine Zeile zum Vergleich: klein, Leerraum und reine Satzzeichen ohne Bedeutung entfernt.
 * Nacharbeit 2 (Ben): Vorzeichen, Vergleichsoperatoren und Zahltrenner bleiben erhalten — „1500“
 * und „-1500“ oder „<1500“ und „>1500“ sind verschiedene Angaben und gelten nicht als doppelt.
 * Nacharbeit 3 (Ben): ein ABGESETZTES Vorzeichen bzw. ein abgesetzter Operator gehört trotzdem zu
 * seiner Zahl („- 1500“ = „-1500“, „< 1500“ = „<1500“). Sonst blieb er ein eigenes Wort, die Suche
 * nach „ 1500 “ traf das Zahlwort allein, und eine verschiedene Angabe galt als doppelt.
 */
function vergleichsform(zeile: string): string[] {
  const woerter = zeile
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[−–]/g, "-")
    .replace(/([+\-±<>≤≥=]+)\s+(?=\p{N})/gu, "$1")
    .match(VERGLEICHSWORT_RE);
  return woerter ?? [];
}

/** Ein Wort, das mit einer Ziffer beginnt (ohne vorangestelltes Vorzeichen/Operator). */
const BEGINNT_MIT_ZIFFER_RE = /^\p{N}/u;
/** Ein Wort, das mit einer Ziffer endet. */
const ENDET_MIT_ZIFFER_RE = /\p{N}$/u;

/**
 * Steht die Wortfolge `gesucht` als GANZE Angabe in `vorhanden`?
 *
 * Nacharbeit 4 (Ben): Leerraum kann ein Tausendertrenner sein — „1 500 €“ zerfällt in die Wörter
 * „1“, „500“, „€“, und eine erkannte Zeile „500 €“ wäre darin als Teilfolge enthalten, obwohl 500
 * und 1500 verschiedene Werte sind. Deshalb zählt eine Fundstelle nur, wenn die Zahl an ihren
 * Rändern nicht weitergeht: beginnt die Folge mit einer Ziffer und endet das Wort davor mit einer
 * Ziffer (oder umgekehrt am Ende), ist die Gruppierung unklar — dann wird NICHT dedupliziert.
 * Lieber eine sichtbare Doppelung als ein still gelöschter Wert.
 */
function enthaeltGanz(vorhanden: readonly string[], gesucht: readonly string[]): boolean {
  const n = gesucht.length;
  if (n === 0) {
    return false;
  }
  const erstes = gesucht[0] ?? "";
  const letztes = gesucht[n - 1] ?? "";
  for (let i = 0; i + n <= vorhanden.length; i += 1) {
    if (!gesucht.every((w, j) => vorhanden[i + j] === w)) {
      continue;
    }
    const davor = vorhanden[i - 1];
    const danach = vorhanden[i + n];
    const vorneOffen =
      davor !== undefined && ENDET_MIT_ZIFFER_RE.test(davor) && BEGINNT_MIT_ZIFFER_RE.test(erstes);
    const hintenOffen =
      danach !== undefined &&
      BEGINNT_MIT_ZIFFER_RE.test(danach) &&
      ENDET_MIT_ZIFFER_RE.test(letztes);
    if (!vorneOffen && !hintenOffen) {
      return true;
    }
  }
  return false;
}

/**
 * Die erkannten Zeilen ohne jene, die wörtlich schon in der Textebene derselben Seite stehen.
 * `gekennzeichnet` (mit `[?…]`) läuft Zeile für Zeile mit `text` und verliert dieselben Zeilen.
 */
export function ohneDoppelteZeilen(
  text: string,
  gekennzeichnet: string,
  textebene: string,
): { text: string; gekennzeichnet: string; doppelt: number } {
  const vorhanden = vergleichsform(textebene);
  if (vorhanden.length === 0) {
    return { text, gekennzeichnet, doppelt: 0 };
  }
  const zeilen = text.split("\n");
  const markiert = gekennzeichnet.split("\n");
  const gleichLang = zeilen.length === markiert.length;
  const behalten: string[] = [];
  const behaltenMarkiert: string[] = [];
  let doppelt = 0;
  zeilen.forEach((zeile, i) => {
    const form = vergleichsform(zeile);
    if (enthaeltGanz(vorhanden, form)) {
      doppelt += 1;
      return;
    }
    behalten.push(zeile);
    behaltenMarkiert.push(gleichLang ? (markiert[i] ?? zeile) : zeile);
  });
  const glatt = (z: string[]): string =>
    z
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  return { text: glatt(behalten), gekennzeichnet: glatt(behaltenMarkiert), doppelt };
}

// ------------------------------------------------------------------------------------------------
// Status
// ------------------------------------------------------------------------------------------------

function gelesen(b: BildBefund): boolean {
  return b.status === "gelesen" || b.status === "kein-text";
}

/** Der Status der ganzen PDF aus ihren Seitenbefunden — nie „vollständig“ mit offener Seite. */
export function pdfQuellenStatus(
  befunde: readonly BildBefund[],
  fehlendeSeiten: number,
): QuellenStatus {
  if (befunde.some((b) => b.status === "wartet" || b.status === "laeuft")) {
    return "laeuft";
  }
  const seitenBilder = befunde.filter((b) => b.fundstelle.seitenteil === "bild");
  const textebenen = befunde.filter((b) => b.fundstelle.seitenteil === "textebene");
  if (
    textebenen.length === 0 &&
    seitenBilder.length > 0 &&
    seitenBilder.every((b) => b.grund === "automatik-aus")
  ) {
    return "aus";
  }
  if (!befunde.some(gelesen)) {
    return seitenBilder.length > 0 && seitenBilder.every((b) => b.status === "nicht-verfuegbar")
      ? "nicht-verfuegbar"
      : "fehlgeschlagen";
  }
  return befunde.every(gelesen) && fehlendeSeiten === 0 ? "vollstaendig" : "teilweise";
}

// ------------------------------------------------------------------------------------------------
// Das Lesen
// ------------------------------------------------------------------------------------------------

export interface PdfSeitenOptionen {
  analyse: Pick<BildAnalyse, "befundFuerBild">;
  /** Die Seite als Bild (data-URL) — `null`, wenn sie sich nicht zeichnen lässt. */
  zeichne: (seite: number) => Promise<string | null>;
  /** Die Einstellung des Kontos (Setup › Klara): an, aus oder nicht lesbar. */
  lage: "an" | "aus" | "unbekannt";
  onFortschritt?: (stand: QuellenBefund) => void;
  /** Der Lauf ist überholt (andere Datei, anderes Konto) — vor der nächsten Seite geprüft. */
  abbrechen?: () => boolean;
  /** Die Automatik wurde während des Laufs ausgeschaltet — vor der nächsten Seite geprüft. */
  automatikAus?: () => boolean;
  zeichenfristMs?: number;
}

function textebeneBefund(fundstelle: BildFundstelle, text: string): BildBefund {
  return leererBefund(fundstelle, "gelesen", { text, textGekennzeichnet: text });
}

/**
 * Liest alle Seiten einer PDF: die Textebene sofort, die Bild- und gemischten Seiten der Reihe nach
 * über `zeichne` und die Bildanalyse. `onFortschritt` sieht jeden Zwischenstand.
 */
export async function lesePdfSeiten(
  eingang: PdfScanEingang,
  optionen: PdfSeitenOptionen,
): Promise<QuellenBefund> {
  const frist = optionen.zeichenfristMs ?? SEITE_ZEICHENFRIST_MS;
  const textebeneJeSeite = new Map(eingang.seiten.map((s) => [s.seite, s.textebene] as const));
  const hinweise: QuellenHinweis[] = [...(eingang.hinweise ?? [])];
  if (optionen.lage === "unbekannt") {
    hinweise.push("einstellung-unbekannt");
  }
  const befunde: BildBefund[] = eingang.vorkommen.map((v) => {
    const f = v.fundstelle;
    if (f.seitenteil === "textebene") {
      return textebeneBefund(f, textebeneJeSeite.get(f.seite ?? 0) ?? "");
    }
    if (optionen.lage === "an") {
      return leererBefund(f, "wartet");
    }
    return leererBefund(
      f,
      "nicht-analysiert",
      optionen.lage === "aus" ? { grund: "automatik-aus" } : {},
    );
  });
  const stand = (): QuellenBefund => ({
    quelle: eingang.quelle,
    art: "pdf",
    status: pdfQuellenStatus(befunde, eingang.fehlendeSeiten),
    befunde: [...befunde],
    nichtGelesen: [],
    hinweise,
    fehlendeSeiten: eingang.fehlendeSeiten,
  });
  optionen.onFortschritt?.(stand());
  for (let i = 0; i < befunde.length; i += 1) {
    const befund = befunde[i];
    const vorkommen = eingang.vorkommen[i];
    if (!befund || !vorkommen || befund.status !== "wartet") {
      continue;
    }
    if (optionen.abbrechen?.()) {
      break;
    }
    if (optionen.automatikAus?.()) {
      for (let j = i; j < befunde.length; j += 1) {
        const rest = befunde[j];
        if (rest && rest.status === "wartet") {
          befunde[j] = leererBefund(rest.fundstelle, "nicht-analysiert", {
            grund: "automatik-aus",
          });
        }
      }
      break;
    }
    befunde[i] = { ...befund, status: "laeuft" };
    optionen.onFortschritt?.(stand());
    befunde[i] = await leseSeite(vorkommen.fundstelle, optionen, frist, textebeneJeSeite);
    optionen.onFortschritt?.(stand());
  }
  return stand();
}

async function leseSeite(
  fundstelle: BildFundstelle,
  optionen: PdfSeitenOptionen,
  frist: number,
  textebeneJeSeite: ReadonlyMap<number, string>,
): Promise<BildBefund> {
  const seite = fundstelle.seite ?? 0;
  let src: string | null | "frist";
  try {
    src = await mitFrist(optionen.zeichne(seite), frist);
  } catch (error) {
    return leererBefund(fundstelle, "fehlgeschlagen", {
      fehler: error instanceof Error ? error.message : "seite-nicht-gezeichnet",
    });
  }
  if (src === "frist") {
    return leererBefund(fundstelle, "zeitueberschreitung", { fehler: "zeichenfrist" });
  }
  if (!src) {
    return leererBefund(fundstelle, "fehlgeschlagen", { fehler: "seite-nicht-gezeichnet" });
  }
  const befund = await optionen.analyse.befundFuerBild({ fundstelle, src });
  const textebene = textebeneJeSeite.get(seite) ?? "";
  if (befund.status !== "gelesen" || textebene.length === 0) {
    return befund;
  }
  const ohne = ohneDoppelteZeilen(befund.text, befund.textGekennzeichnet, textebene);
  if (ohne.doppelt === 0) {
    return befund;
  }
  return {
    ...befund,
    text: ohne.text,
    textGekennzeichnet: ohne.gekennzeichnet,
    unsicher: befund.unsicher.filter((u) => ohne.gekennzeichnet.includes(u.wort)),
    doppelt: ohne.doppelt,
  };
}

/**
 * Der Text der ganzen PDF in Seitenreihenfolge — Textebene und erkannter Rest je Seite, ohne
 * Doppel. Seiten ohne gelesenen Text tragen nichts bei; dass sie fehlen, sagt der Status.
 */
export function pdfSeitenText(befund: QuellenBefund): string {
  return pdfSeitenTexte(befund, 0)
    .filter((s) => s.length > 0)
    .join("\n\n");
}

/**
 * Nacharbeit 8: der gelesene Text JE SEITE (Index 0 = Seite 1), mindestens `seitenzahl` Einträge —
 * Textebene und erkannter Rest derselben Seite zusammen, ohne Doppel. Eine Seite ohne gelesenen
 * Text ist `""`; dass sie fehlt oder scheiterte, sagt der Status. Für Wege, die Fundstellen je Seite
 * bilden (Fragen an ein Dokument).
 */
export function pdfSeitenTexte(befund: QuellenBefund, seitenzahl: number): string[] {
  const jeSeite: string[][] = [];
  for (const b of befund.befunde) {
    const seite = b.fundstelle.seite ?? 0;
    const text = b.textGekennzeichnet.trim();
    if (seite < 1 || b.status !== "gelesen" || text.length === 0) {
      continue;
    }
    while (jeSeite.length < seite) {
      jeSeite.push([]);
    }
    jeSeite[seite - 1]?.push(text);
  }
  while (jeSeite.length < seitenzahl) {
    jeSeite.push([]);
  }
  return jeSeite.map((teile) => teile.join("\n\n"));
}

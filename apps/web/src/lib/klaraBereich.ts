// ================================================================================================
// OCR-E06 · AUSGEWÄHLTES BILD ODER BEREICH GEZIELT ERKLÄREN: „KLARA, WAS STEHT HIER?“ (Auftrag
// produkt:20261012:klara-ocr-bereichsfrage).
// ================================================================================================
//
// Ein Bild der Quelle — ganz oder ein Rechteck darin — wird ausgewählt; Klara bekommt NUR diese
// Auswahl. Die Komponente dazu ist `components/KlaraBereichsfrage.tsx`.
//
// DIESE DATEI IST DOM-FREI. Die Lesung kommt aus der vorhandenen Analyse der Fläche
// (`BildAnalyse.lesungFuerBild`, `lib/bildAutomatik.ts`): dieselben Bildbytes heißen dieselbe
// Lesung, und eine Bereichsfrage liest höchstens dieses eine Bild — nie die ganze Quelle neu.
//
// WAS SIE ZUSAGT:
//   · Zum Bereich gehört ein Wort genau dann, wenn die MITTE seines Rahmens im Bereich liegt. Wörter
//     außerhalb stehen nie im Bereichstext, auch nicht teilweise angeschnittene.
//   · Ohne Wortrahmen (die Engine lieferte keine) gibt es keinen Bereichstext — nur die ehrliche
//     Auskunft, dass der Bereich nicht bestimmbar ist. Der Text des ganzen Bildes wird dann NICHT
//     als Text des Bereichs ausgegeben.
//   · Leer und unleserlich sind eigene Zustände; unsichere Stellen bleiben gekennzeichnet
//     (`[?wort]`, `[unleserlich]`), es wird nichts ergänzt.
//   · Die beschriebene Bildaussage (W02) betrifft das ganze Bild — sie geht nur bei Auswahl des
//     ganzen Bildes mit an Klara, nie bei einem Bereich.
//   · Jede Auswahl hat einen Schlüssel aus Konto, Fläche, Bild, Bildbytes und Bereich. Nachfragen
//     bleiben bei diesem Schlüssel; ein anderer Schlüssel ist ein neuer Kontext.
//   · Gelesen wird nur: weder Bild noch Dokument noch Befund werden verändert.

import {
  type BildBefund,
  type BildFundstelle,
  type BildLesung,
  UNLESERLICH_UNTER,
  gekennzeichnet,
} from "./bildAutomatik";
import { markierung, textStellen } from "./bildFundstelle";
import type { OcrWort } from "./ocr";

export type Uebersetze = (schluessel: string, werte?: Record<string, string | number>) => string;

/** Ein Rechteck in Pixeln des Originalbildes (dieselben Koordinaten wie die Wortrahmen). */
export interface BildBereich {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Kleinere Rechtecke (Pixel je Seite) gelten als Klick, nicht als Bereich. */
export const BEREICH_MINDESTGROESSE = 4;

/**
 * Aus zwei Punkten (Pixel im Originalbild) ein Bereich — auf das Bild begrenzt und gerundet; `null`,
 * wenn er zu klein ist.
 */
export function bereichAus(
  a: { x: number; y: number },
  b: { x: number; y: number },
  breite: number,
  hoehe: number,
): BildBereich | null {
  const klemme = (v: number, max: number): number => Math.round(Math.min(Math.max(v, 0), max));
  const x0 = klemme(Math.min(a.x, b.x), breite);
  const x1 = klemme(Math.max(a.x, b.x), breite);
  const y0 = klemme(Math.min(a.y, b.y), hoehe);
  const y1 = klemme(Math.max(a.y, b.y), hoehe);
  if (x1 - x0 < BEREICH_MINDESTGROESSE || y1 - y0 < BEREICH_MINDESTGROESSE) {
    return null;
  }
  return { x0, y0, x1, y1 };
}

/** Die Auswahl: ein Bild der Quelle, ganz (`bereich: null`) oder ein Rechteck darin. */
export interface BildAuswahl {
  fundstelle: BildFundstelle;
  bereich: BildBereich | null;
}

/**
 * Der Kontext, zu dem Antworten und Nachfragen gehören: Konto, Fläche samt Lauf (`kontextSchluessel`
 * wie bei `KlaraBildKontextFrage` — ein ausgetauschtes Bild ist dort ein neuer Lauf), Bild und Bereich.
 */
export function auswahlSchluessel(
  kontoId: string | null,
  kontextSchluessel: string,
  auswahl: BildAuswahl,
): string {
  const f = auswahl.fundstelle;
  const b = auswahl.bereich;
  const bereich = b ? `${b.x0},${b.y0},${b.x1},${b.y1}` : "ganz";
  return [
    kontoId ?? "-",
    kontextSchluessel,
    `${f.quelle}|${f.bild}|${f.folie ?? ""}|${f.imageId ?? ""}`,
    bereich,
  ].join("::");
}

type WortMitRahmen = OcrWort & { bbox: NonNullable<OcrWort["bbox"]> };

function hatRahmen(w: OcrWort): w is WortMitRahmen {
  return w.bbox !== undefined && w.text.trim().length > 0;
}

/** Die Wörter, deren Rahmenmitte im Bereich liegt — in der Reihenfolge der Engine. */
export function woerterImBereich(
  woerter: readonly OcrWort[],
  bereich: BildBereich,
): WortMitRahmen[] {
  return woerter.filter(hatRahmen).filter((w) => {
    const mx = (w.bbox.x0 + w.bbox.x1) / 2;
    const my = (w.bbox.y0 + w.bbox.y1) / 2;
    return mx >= bereich.x0 && mx <= bereich.x1 && my >= bereich.y0 && my <= bereich.y1;
  });
}

function median(werte: number[]): number {
  const s = [...werte].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

/** Wörter zeilenweise (nach Rahmenmitte), je Zeile von links nach rechts, gekennzeichnet. */
export function zeilenText(woerter: readonly WortMitRahmen[]): string {
  if (woerter.length === 0) {
    return "";
  }
  const hoehe = Math.max(1, median(woerter.map((w) => w.bbox.y1 - w.bbox.y0)));
  const mitte = (w: WortMitRahmen): number => (w.bbox.y0 + w.bbox.y1) / 2;
  const zeilen: WortMitRahmen[][] = [];
  for (const w of [...woerter].sort((a, b) => mitte(a) - mitte(b))) {
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
  return zeilen
    .map((zeile) =>
      [...zeile]
        .sort((a, b) => a.bbox.x0 - b.bbox.x0)
        .map((w) => gekennzeichnet(w.text, w.confidence, w.abweichend === true))
        .join(" "),
    )
    .join("\n");
}

export type BereichStatus =
  /** Text in der Auswahl gelesen (ggf. mit gekennzeichneten Stellen). */
  | "gelesen"
  /** In der Auswahl steht kein erkannter Text. */
  | "leer"
  /** In der Auswahl stehen nur unleserliche Zeichen. */
  | "unleserlich"
  /** Das Bild ist gelesen, aber ohne Wortrahmen — ein Bereich ist nicht bestimmbar. */
  | "ohne-positionen"
  /** Das Bild selbst ist nicht gelesen (fehlgeschlagen, kein Zugriff, keine Engine …). */
  | "nicht-gelesen";

export interface BereichsErgebnis {
  status: BereichStatus;
  /** Der Text der Auswahl mit gekennzeichneten Stellen — leer außer bei `gelesen`. */
  text: string;
  /** Anzahl der als unsicher oder unleserlich gekennzeichneten Stellen im Text. */
  unsicher: number;
  /** Bei `nicht-gelesen`: der Zustand der Lesung. */
  lesung: BildLesung["status"];
  /** Die Lesung stammt aus einer vorhandenen Analyse derselben Bildbytes. */
  wiederverwendet: boolean;
}

const MARKE_RE = /\[\?[^\]]*\]|\[unleserlich\]/g;
const HAT_ZEICHEN = /[\p{L}\p{N}]/u;

function nurUnleserlich(woerter: readonly OcrWort[]): boolean {
  const mitZeichen = woerter.filter((w) => HAT_ZEICHEN.test(w.text));
  return mitZeichen.length > 0 && mitZeichen.every((w) => w.confidence < UNLESERLICH_UNTER);
}

/** Was in der Auswahl steht — ausschließlich aus der Lesung dieses Bildes. */
export function bereichsErgebnis(
  lesung: BildLesung,
  bereich: BildBereich | null,
): BereichsErgebnis {
  const basis = { lesung: lesung.status, wiederverwendet: lesung.wiederverwendet };
  if (lesung.status === "kein-text") {
    return { ...basis, status: "leer", text: "", unsicher: 0 };
  }
  if (lesung.status !== "gelesen") {
    return { ...basis, status: "nicht-gelesen", text: "", unsicher: 0 };
  }
  if (bereich === null) {
    if (nurUnleserlich(lesung.woerter)) {
      return { ...basis, status: "unleserlich", text: "", unsicher: 0 };
    }
    const text = lesung.textGekennzeichnet.trim();
    return {
      ...basis,
      status: text ? "gelesen" : "leer",
      text,
      unsicher: text.match(MARKE_RE)?.length ?? 0,
    };
  }
  if (!lesung.woerter.some(hatRahmen)) {
    return { ...basis, status: "ohne-positionen", text: "", unsicher: 0 };
  }
  const drin = woerterImBereich(lesung.woerter, bereich);
  if (!drin.some((w) => HAT_ZEICHEN.test(w.text))) {
    return { ...basis, status: "leer", text: "", unsicher: 0 };
  }
  if (nurUnleserlich(drin)) {
    return { ...basis, status: "unleserlich", text: "", unsicher: 0 };
  }
  const text = zeilenText(drin);
  return { ...basis, status: "gelesen", text, unsicher: text.match(MARKE_RE)?.length ?? 0 };
}

/** Die gelieferte Berichtigung und Positionszuordnung gelten auch für Bereichsfragen. */
export function lesungMitBerichtigung(
  lesung: BildLesung,
  befund: BildBefund | undefined,
): BildLesung {
  if (!befund?.korrektur || befund.inhaltskennung !== lesung.inhaltskennung) {
    return lesung;
  }
  const positionen = lesung.woerter.filter(hatRahmen);
  const stellen = textStellen(
    befund.textGekennzeichnet,
    positionen.map((w) => ({
      text: gekennzeichnet(w.text, w.confidence, w.abweichend === true),
      ...w.bbox,
    })),
  );
  // Ergänzte Wörter bekommen nie die Position eines anderen Blocks. Bei unklarer Zuordnung
  // bleibt das ganze Bild lesbar, die freie Bereichsauswahl fällt ehrlich auf das Bild zurück.
  const eindeutig = stellen.every((s) => s.wort !== null);
  return {
    ...lesung,
    status: befund.textGekennzeichnet.trim() ? "gelesen" : "kein-text",
    text: befund.textGekennzeichnet,
    textGekennzeichnet: befund.textGekennzeichnet,
    woerter: eindeutig
      ? stellen.map((s) => {
          const position = positionen[s.wort ?? -1];
          return { text: s.text, confidence: 100, ...(position ? { bbox: position.bbox } : {}) };
        })
      : [],
  };
}

/** Positionen in die unverändert angezeigte Bildvorschau übertragen, einschließlich EXIF 6/8. */
export function lesungInVorschau(lesung: BildLesung): BildLesung {
  const mitRahmen = lesung.woerter.filter(hatRahmen);
  const m = markierung(
    { woerter: mitRahmen.map((w) => ({ text: w.text, ...w.bbox })), rahmen: lesung.rahmen },
    [0],
  );
  if (m.art !== "bereich") {
    return { ...lesung, woerter: [] };
  }
  if (m.drehung === 0) {
    return lesung;
  }
  const drehen = (x: number, y: number) =>
    m.drehung === 90 ? { x: m.rahmen.hoehe - y, y: x } : { x: y, y: m.rahmen.breite - x };
  return {
    ...lesung,
    woerter: lesung.woerter.map((w) => {
      if (!w.bbox) return w;
      const a = drehen(w.bbox.x0, w.bbox.y0);
      const b = drehen(w.bbox.x1, w.bbox.y1);
      return {
        ...w,
        bbox: {
          x0: Math.min(a.x, b.x),
          y0: Math.min(a.y, b.y),
          x1: Math.max(a.x, b.x),
          y1: Math.max(a.y, b.y),
        },
      };
    }),
  };
}

/** Eine bisherige Frage zu derselben Auswahl. */
export interface BereichsWechsel {
  frage: string;
  antwort: string;
}

/**
 * Was Klara bekommt: NUR die Auswahl — ihr Text, bei ganzem Bild auch der beschriebene Bildinhalt,
 * und die bisherigen Fragen zu genau dieser Auswahl. Kein Dokumenttext, keine anderen Bilder.
 */
export function bereichsKontext(
  ort: string,
  ergebnis: BereichsErgebnis,
  bildinhalt: string | null,
  verlauf: readonly BereichsWechsel[],
  t: Uebersetze,
): string {
  const zeilen = [t("klarabereich.kontext.kopf", { ort })];
  zeilen.push(`${t("klarabereich.kontext.text")}: ${ergebnis.text}`);
  if (bildinhalt?.trim()) {
    zeilen.push(`${t("klarabereich.kontext.inhalt")}: ${bildinhalt.trim()}`);
  }
  if (verlauf.length > 0) {
    zeilen.push("", t("klarabereich.kontext.verlauf"));
    for (const w of verlauf) {
      zeilen.push(`${t("klarabereich.kontext.frage")}: ${w.frage}`);
      zeilen.push(`${t("klarabereich.kontext.antwort")}: ${w.antwort}`);
    }
  }
  return zeilen.join("\n");
}

/** Die Anweisung an Klara: nur diese Auswahl, Text wiedergeben, kurz erklären, nichts ergänzen. */
export function bereichsAnweisung(frage: string, ort: string, t: Uebersetze): string {
  return [
    t("klarabereich.anweisung.frage", { frage: frage.trim(), ort }),
    t("klarabereich.anweisung.grenze"),
  ].join(" ");
}

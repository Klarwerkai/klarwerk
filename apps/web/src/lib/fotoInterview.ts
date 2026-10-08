// ================================================================================================
// R-1624 · FOTO-ZU-WISSEN MIT BILDVERSTEHEN — DOM-freie Helfer.
// ================================================================================================
//
// Wortlaut der Quelle (KLARWERK-Funktions-Roadmap 1.2): „Der Experte fotografiert einen Schaden,
// eine Schweißnaht, ein Bauteil. KLARWERK erkennt aus dem Bild Kontext (Maschine, Bauteil-Typ) und
// stellt gezielte Rückfragen: ‚Welcher Fehler ist hier zu sehen? Welche Ursache vermutest du? Was
// wäre die Lösung?' — und baut daraus ein Wissensobjekt mit Bild-Anker."
//
// WAS NEU IST UND WAS WIEDERVERWENDET WIRD:
//   · Bildverstehen = die vorhandene Bildbeschreibung (WP-BILD-1c, `useImageDescribe`). Ihr Text
//     ist der BILDBEFUND, den der Mensch sieht, korrigieren kann und bestätigt.
//   · Rückfragen = das vorhandene geführte Interview (SCRUM-132) mit der Foto-Fragenfolge
//     (`INTERVIEW_PHOTO_QUESTIONS`, services/reasoner/src/provider.ts). Der Befund reist als
//     Klartext mit; das Bild selbst geht nur einmal an das Modell — beim bewussten „Bild auswerten".
//   · Bild-Anker = das Foto als `<figure>` mit dem Befund als Fußnote im Rumpf des Entwurfs. Es ist
//     dieselbe Bauform wie jedes andere Bild (BILD-1a), also greifen Kennung, Fußnote,
//     Bildbeschreibung und Speicherweg unverändert.
import {
  escapeCaptionText,
  insertImageSrcHtml,
  isEmptyHtml,
  isSafeImgSrc,
  sanitizeHtml,
} from "./richText";

// Derselbe Wert wie die serverseitige Obergrenze (`MAX_INTERVIEW_IMAGE_CONTEXT_LENGTH`): der
// Befund ist die (ggf. korrigierte) Bildbeschreibung und nie länger als sie.
export const MAX_FOTO_BEFUND = 300;

// Lange Kante, auf die das Foto vor Auswertung und Einbettung verkleinert wird — dieselbe
// lesbare Größe wie bei eingebetteten Dokumentbildern (WP-D1c, `lib/files.ts`).
export const FOTO_MAX_KANTE_PX = 1600;

export interface FotoAnker {
  /** Das verkleinerte Foto als data:image-URL. */
  dataUrl: string;
  /** Der bestätigte Bildbefund (Klartext). */
  befund: string;
}

/** Befund säubern und auf die gemeinsame Obergrenze kappen. */
export function normalizeFotoBefund(befund: string): string {
  return befund.replace(/\s+/g, " ").trim().slice(0, MAX_FOTO_BEFUND).trim();
}

/** Ein Foto-Interview darf erst starten, wenn ein sicheres Bild UND ein Befund vorliegen. */
export function fotoStartbereit(foto: FotoAnker | null): foto is FotoAnker {
  return foto !== null && isSafeImgSrc(foto.dataUrl) && normalizeFotoBefund(foto.befund).length > 0;
}

/**
 * Der Bild-Anker: das Foto als `<figure>` mit dem Befund als Fußnote. Ein unsicheres Bild ergibt
 * KEIN Markup (leerer String) — nie ein `<img>` mit fremder Quelle.
 */
export function fotoAnkerHtml(foto: FotoAnker): string {
  if (!isSafeImgSrc(foto.dataUrl)) {
    return "";
  }
  const befund = normalizeFotoBefund(foto.befund);
  return sanitizeHtml(
    `<figure>${insertImageSrcHtml(foto.dataUrl, befund)}<figcaption>${escapeCaptionText(befund)}</figcaption></figure>`,
  );
}

/** Anker in den Rumpf: leer → setzen, sonst anhängen (nie still überschreiben). */
export function applyFotoAnker(currentHtml: string | null | undefined, foto: FotoAnker): string {
  const base = currentHtml ?? "";
  const anker = fotoAnkerHtml(foto);
  if (anker.length === 0) {
    return base;
  }
  return isEmptyHtml(base) ? anker : base + anker;
}

export type FotoArtikelLocale = "de" | "en";

type FotoAbschnitt = "fehler" | "ursache" | "loesung" | "kontext";

const UEBERSCHRIFTEN: Record<FotoArtikelLocale, Record<FotoAbschnitt, string>> = {
  de: { fehler: "Fehlerbild", ursache: "Vermutete Ursache", loesung: "Lösung", kontext: "Kontext" },
  en: { fehler: "Fault", ursache: "Suspected cause", loesung: "Solution", kontext: "Context" },
};

export interface FotoArtikelInput {
  statement?: string | null;
  conditions?: readonly string[] | null;
  measures?: readonly string[] | null;
  tags?: readonly string[] | null;
}

function liste(items: readonly string[] | null | undefined): string {
  const sauber = (items ?? []).map((i) => i.trim()).filter((i) => i.length > 0);
  if (sauber.length === 0) {
    return "";
  }
  return `<ul>${sauber.map((i) => `<li>${escapeCaptionText(i)}</li>`).join("")}</ul>`;
}

/**
 * Die Wissensseite aus den Antworten des Foto-Interviews. Die Felder kommen unverändert aus der
 * deterministischen Verdichtung (`condenseInterview`): Fehler → Aussage, Ursache → Bedingung,
 * Lösung → Maßnahme. Nur die Überschriften sprechen die Sprache des Fotos. Leere Felder fallen weg.
 */
export function fotoArtikelHtml(input: FotoArtikelInput, locale: FotoArtikelLocale = "de"): string {
  const h = UEBERSCHRIFTEN[locale];
  const teile: string[] = [];
  const fehler = (input.statement ?? "").trim();
  if (fehler) {
    teile.push(`<h2>${h.fehler}</h2><p>${escapeCaptionText(fehler)}</p>`);
  }
  const ursache = liste(input.conditions);
  if (ursache) {
    teile.push(`<h3>${h.ursache}</h3>${ursache}`);
  }
  const loesung = liste(input.measures);
  if (loesung) {
    teile.push(`<h3>${h.loesung}</h3>${loesung}`);
  }
  const tags = (input.tags ?? []).map((t) => t.trim()).filter((t) => t.length > 0);
  if (tags.length > 0) {
    teile.push(`<h3>${h.kontext}</h3><p>${escapeCaptionText(tags.join(", "))}</p>`);
  }
  return teile.length === 0 ? "" : sanitizeHtml(teile.join(""));
}

/** Seite in den Rumpf: anhängen, nie überschreiben — der Bild-Anker steht dann darüber. */
export function applyFotoArtikel(
  currentHtml: string | null | undefined,
  input: FotoArtikelInput,
  locale: FotoArtikelLocale = "de",
): string {
  const base = currentHtml ?? "";
  const seite = fotoArtikelHtml(input, locale);
  if (seite.length === 0) {
    return base;
  }
  return isEmptyHtml(base) ? seite : base + seite;
}

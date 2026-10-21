// ================================================================================================
// AW-03 · AW03-K02/K04 — DER QUELLABSCHNITT EINES HERKUNFTSANKERS, EINE REGEL FÜR ALLE LESER.
// ================================================================================================
//
// Ein Herkunftsanker (`KoSource`) sagt, woher eine Fassung stammt. Diese Datei macht daraus den
// QUELLABSCHNITT, den ein Mensch öffnen kann: Quell-ID, Quellfassung, festgeschriebene Revision,
// Adresse und Fundstelle. Gesamtanweisung (`gesamtanweisung-service.ts`), Textexport
// (`library-analytics`) und Oberfläche lesen dieselbe Regel — zwei Auslegungen wären zwei Wahrheiten.
// Der Antwortbeleg bindet seit der Integration mit main über `quellbindung` (services/ask).
//
// FUNDSTELLE, zwei Arten:
//   · `beleg:<Anker-Kennung>` — eine wörtliche Belegstelle (`excerpt`), z. B. aus einer
//     Dokumentübernahme; die Stelle ist das Zitat am Anker der Fassung.
//   · `quellseite:<externalId>@<sourceVersion>` — eine importierte Seite. Der Import ist seitenweise,
//     der Abschnitt ist also die ganze Quellfassung. Er gilt nur mit festgeschriebener Revision
//     (`sourceRecordId`, R-0169): ohne sie ist der Stand nicht überprüfbar.
// Trägt ein Anker keines von beiden, steht er mit `stand: "ungeprueft"` da (AW03-K02: „unbekannter
// Stand erscheint ungeprüft"). Erfunden wird nichts.

/** Die Mindestform eines Ankers — strukturell erfüllt von `KoSource`. */
export interface QuellankerFakten {
  readonly id?: string | null | undefined;
  readonly label?: string | null | undefined;
  readonly url?: string | null | undefined;
  readonly excerpt?: string | null | undefined;
  readonly provider?: string | null | undefined;
  readonly externalId?: string | null | undefined;
  readonly sourceVersion?: number | null | undefined;
  readonly sourceRecordId?: string | null | undefined;
}

export interface Quellabschnitt {
  readonly ankerId: string | null;
  readonly bezeichnung: string;
  readonly anbieter: string | null;
  readonly quellId: string | null;
  readonly quellfassung: number | null;
  readonly quellrevision: string | null;
  readonly url: string | null;
  readonly fundstelle: string | null;
  readonly stand: "geprueft" | "ungeprueft";
}

function text(wert: string | null | undefined): string | null {
  const t = typeof wert === "string" ? wert.trim() : "";
  return t.length > 0 ? t : null;
}

/** Die Fundstelle EINES Ankers — oder `null`, wenn sie nicht überprüfbar ist. */
export function fundstelleDesAnkers(anker: QuellankerFakten): string | null {
  const id = text(anker.id);
  if (text(anker.excerpt) && id) {
    return `beleg:${id}`;
  }
  const seite = text(anker.externalId);
  if (text(anker.sourceRecordId) && seite && typeof anker.sourceVersion === "number") {
    return `quellseite:${seite}@${anker.sourceVersion}`;
  }
  return null;
}

/**
 * Die Quellabschnitte einer Fassung. `null` heisst UNBEKANNT (die Fassung trägt keine Ankerliste),
 * `[]` heisst: die Fassung hat keine Anker.
 */
export function quellabschnitteAus(
  anker: readonly QuellankerFakten[] | null | undefined,
): Quellabschnitt[] | null {
  if (!Array.isArray(anker)) {
    return null;
  }
  return anker.map((a) => {
    const fundstelle = fundstelleDesAnkers(a);
    return {
      ankerId: text(a.id),
      bezeichnung: text(a.label) ?? "",
      anbieter: text(a.provider),
      quellId: text(a.externalId),
      quellfassung: typeof a.sourceVersion === "number" ? a.sourceVersion : null,
      quellrevision: text(a.sourceRecordId),
      url: text(a.url),
      fundstelle,
      stand: fundstelle ? "geprueft" : "ungeprueft",
    };
  });
}

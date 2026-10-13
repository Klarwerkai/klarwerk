// ================================================================================================
// OCR-E02 · BERICHTIGTER BILDTEXT (Auftrag produkt:20261012:klara-ocr-fundstellen-korrekturen).
// ================================================================================================
//
// Eine Berichtigung gilt für GENAU eine Quelle und GENAU eine Bildfassung:
//   · Quelle — die Kennung der Fläche (`korrekturQuelle`): `office:<anhang>`, `datei:<name>`,
//     `ko:<id>`/`entwurf:<id>` im Editor. Bei einzeln bereitgestellten Bildern (Bildanhänge) kommt
//     der Name des Bildes dazu.
//   · Bildfassung — die Inhaltskennung (`sha256` der Bildbytes).
// Ein anderes Bild, ein verändertes Bild (andere Bytes) oder dieselben Bytes in einer anderen Quelle
// bekommen die Berichtigung NICHT. Ein erneutes Lesen derselben Bytes ändert sie nicht — sie liegt
// am Konto (`/api/me/assistenz/bildkorrekturen`), getrennt vom Rohbefund.
//
// Diese Datei ist DOM-FREI und rein: sie legt eine Berichtigung über einen Befund (für Anzeige UND
// Klaras Kontext) und hält den Rohbefund daneben. Bild und Datei werden nie angefasst.

import type { BildBefund, BildFundstelle, QuellenBefund } from "./bildAutomatik";

/** Eine gespeicherte Berichtigung, wie der Server sie bestätigt (`/api/me/assistenz/bildkorrekturen`). */
export interface BildKorrekturDaten {
  /** Die Quelle, an die die Berichtigung gebunden ist (z. B. `office:<anhang>`, `datei:<name>`). */
  quelle: string;
  /** `sha256:<hex>` der Bildbytes — die Bildfassung. */
  inhaltskennung: string;
  /** Die Stelle des Bildes beim Speichern (nur Anzeige). */
  ort: string | null;
  text: string;
  /** Wie oft „Rückgängig“ eine frühere Berichtigung zurückholt (danach gilt der Rohbefund). */
  schritte: number;
  geaendertAm: string;
}

/** Die Bindung einer Berichtigung an die Quelle — für Bildanhänge samt Bildname. */
export function korrekturQuelleFuer(praefix: string, f: BildFundstelle): string {
  return f.art === "bild" ? `${praefix}|${f.quelle}` : praefix;
}

/** Die Stelle des Bildes in der Quelle, kurz (nur zur Anzeige; bindet nichts). */
export function ortKennung(f: BildFundstelle): string {
  if (f.folie !== undefined && f.folienansicht) {
    return `s${f.folie}`;
  }
  if (f.folie !== undefined) {
    return `f${f.folie}-b${f.bildAufFolie ?? 1}`;
  }
  return `b${f.bild}`;
}

/** Kann dieser Befund berichtigt werden? Nur ein abgeschlossener Textbefund mit Bildfassung. */
export function berichtigbar(b: BildBefund): b is BildBefund & { inhaltskennung: string } {
  return (b.status === "gelesen" || b.status === "kein-text") && b.inhaltskennung !== null;
}

export function findeKorrektur(
  liste: readonly BildKorrekturDaten[],
  quelle: string,
  inhaltskennung: string | null,
): BildKorrekturDaten | null {
  if (!inhaltskennung) {
    return null;
  }
  return liste.find((k) => k.quelle === quelle && k.inhaltskennung === inhaltskennung) ?? null;
}

/**
 * Gibt es für DIESELBE Quelle und DIESELBE Stelle eine Berichtigung einer ANDEREN Bildfassung? Dann
 * wurde das Bild verändert — die alte Berichtigung gilt nicht und wird sichtbar nicht übernommen.
 */
export function andereFassungBerichtigt(
  liste: readonly BildKorrekturDaten[],
  quelle: string,
  b: BildBefund,
): boolean {
  if (!b.inhaltskennung) {
    return false;
  }
  const ort = ortKennung(b.fundstelle);
  return liste.some(
    (k) => k.quelle === quelle && k.ort === ort && k.inhaltskennung !== b.inhaltskennung,
  );
}

/** Der Befund mit wirksamer Berichtigung (für Anzeige und Klara); der Rohbefund steht daneben. */
export function befundMitKorrektur(b: BildBefund, k: BildKorrekturDaten | null): BildBefund {
  if (!k || !berichtigbar(b) || k.inhaltskennung !== b.inhaltskennung) {
    return b;
  }
  return {
    ...b,
    status: k.text.trim().length > 0 ? "gelesen" : "kein-text",
    text: k.text,
    textGekennzeichnet: k.text,
    unsicher: [],
    // Die erkannte Tabelle stammt aus dem Rohbefund; sie bleibt dort sichtbar.
    tabelle: null,
    korrektur: {
      rohText: b.text,
      rohGekennzeichnet: b.textGekennzeichnet,
      rohUnsicher: b.unsicher,
      rohTabelle: b.tabelle,
      geaendertAm: k.geaendertAm,
      schritte: k.schritte,
    },
  };
}

/**
 * Die Quellen mit ihren wirksamen Berichtigungen. Ohne Quelle (`praefix === null`: kein dauerhafter
 * Bezug) bleibt alles unverändert. Unveränderte Quellen bleiben dieselben Objekte.
 */
export function quellenMitKorrekturen(
  quellen: readonly QuellenBefund[],
  praefix: string | null | undefined,
  liste: readonly BildKorrekturDaten[],
): QuellenBefund[] {
  if (!praefix || liste.length === 0) {
    return [...quellen];
  }
  return quellen.map((q) => {
    let geaendert = false;
    const befunde = q.befunde.map((b) => {
      const k = findeKorrektur(liste, korrekturQuelleFuer(praefix, b.fundstelle), b.inhaltskennung);
      const neu = befundMitKorrektur(b, k);
      geaendert ||= neu !== b;
      return neu;
    });
    return geaendert ? { ...q, befunde } : q;
  });
}

/** Fingerabdruck der wirksamen Berichtigungen — ändert sich eine, gilt eine Antwort nicht mehr. */
export function korrekturFingerabdruck(quellen: readonly QuellenBefund[]): string {
  const teile: string[] = [];
  for (const q of quellen) {
    for (const b of q.befunde) {
      if (b.korrektur) {
        teile.push(`${q.quelle}|${b.fundstelle.bild}|${b.korrektur.geaendertAm}`);
      }
    }
  }
  return teile.join(",");
}

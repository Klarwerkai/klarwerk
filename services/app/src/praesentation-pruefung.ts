// ================================================================================================
// KLARA POWERPOINT · PP-03 — VALIDIERUNG UND DATENKONTROLLE
// (Auftrag produkt:20261015:klara-powerpoint-validierung, Integrationsplan Abschnitt 3).
// ================================================================================================
//
// WAS DAS IST. Die Kontrollen je Datenpunkt, die PP-02 („Datenpunkt“, Prüfstand je Dimension) noch
// fehlen: konkrete, vom Server selbst festgestellte Prüfzustände statt eines bloßen „offen“.
//   · Struktur:     fehlender Bezugszeitraum, fehlende Einheit/Währung, Prozentwert ohne Bezugsgröße.
//   · Berechnung:   Summenzeile bzw. Summenspalte einer Folientabelle nachgerechnet (V06 `rechne`).
//   · Erkennung:    unsichere Texterkennung wird Klärungsbedarf, bis jemand den Wert am Bild bestätigt.
//   · Konsistenz:   dieselbe Bezugsgröße im selben Zeitraum mit anderem Wert → mögliche Abweichung mit
//                   beiden Fundstellen; anderer Zeitraum oder andere Einheit ist KEIN Widerspruch;
//                   eine Folie, die inzwischen etwas anderes zeigt als die gebundene Datenfassung.
//   · Aktualität:   neue Quellfassung (wie V02) und die Klarwerk-Frische der Quelle (V03).
//   · Freigabe:     Artikelstatus der Quelle (V01) als Auskunft; ein berechneter Wert gilt erst als
//                   validiert, wenn seine Eingaben es sind.
//
// WAS NICHT HIER ENTSTEHT. Keine zweite Statuslogik: Fingerabdruck, Überholung durch Änderungen und
// die menschlichen Prüfungen bleiben bei PP-02 (`pruefstand`). Diese Datei legt ihre Befunde nur
// DARÜBER (`mitKontrollen`) — nach festen Regeln:
//   1. „überholt“ aus PP-02 bleibt überholt. Eine Änderung hebt den alten Status immer auf.
//   2. Ein Klärungsbefund dieser Datei schlägt ein „bestanden“: eine fehlende Pflichtangabe, eine
//      falsche Summe, ein Widerspruch oder eine veraltete Quelle lässt sich nicht wegbestätigen,
//      nur beheben (Korrektur → neue Datenfassung).
//   3. Ein maschinell bestandener Befund ersetzt nur dort eine offene Prüfung, wo die Maschine die
//      Frage vollständig beantwortet (Summe nachgerechnet, Quelle aktuell und frisch). Struktur,
//      Konsistenz und fachliche Freigabe bleiben sonst menschliche Prüfungen.
//   4. OCR, eine verlässliche Quelle oder ein grüner Teiltest validieren nie allein.
//
// RECHTE. Die Umgebung (`KontrollUmgebung`) liefert nur, was der Handelnde lesen darf — dieselbe Regel
// wie PP-02 (`vollLesbar`). Gegenstellen eines Widerspruchs erscheinen nur, wenn sie lesbar sind.
//
// ANSCHLUSS AN PP-02. Die Typen unten beschreiben genau die Felder des PP-02-Vertrags, die hier
// gelesen werden (structural typing): ein PP-02-`Datenpunkt` und sein `Pruefstand` passen ohne
// Umbau. KEIN MODELL läuft hier, und es wird nichts geschrieben.

import { type KnowledgeObject, discloseFrische } from "../../knowledge-object";
import { rechne } from "./office-nachbearbeitung";

// ------------------------------------------------------------------------------------------------
// DER PP-02-VERTRAG, SOWEIT ER HIER GELESEN WIRD
// ------------------------------------------------------------------------------------------------

export type Dimension =
  | "erkennung"
  | "struktur"
  | "berechnung"
  | "konsistenz"
  | "aktualitaet"
  | "fachliche_freigabe";

export const DIMENSIONEN: readonly Dimension[] = [
  "erkennung",
  "struktur",
  "berechnung",
  "konsistenz",
  "aktualitaet",
  "fachliche_freigabe",
];

export const DIMENSIONSNAME: Record<Dimension, string> = {
  erkennung: "Erkennung",
  struktur: "Struktur",
  berechnung: "Berechnung",
  konsistenz: "Konsistenz",
  aktualitaet: "Aktualität",
  fachliche_freigabe: "Fachliche Freigabe",
};

export type DimensionsStand = "bestanden" | "klaerung" | "offen" | "ueberholt" | "nicht_zutreffend";

export type Zustand = "erfasst" | "in_pruefung" | "klaerung" | "validiert" | "ueberpruefung_noetig";

export interface KontrollFundstelle {
  readonly art: string;
  readonly sldId?: string;
  readonly shapeId?: string;
  readonly folienPosition?: number;
  readonly folienTitel?: string;
  readonly elementName?: string;
  readonly zeile?: number;
  readonly spalte?: number;
  readonly zeilenkopf?: string;
  readonly spaltenkopf?: string;
  readonly zitat?: string;
  readonly ocrText?: string;
  readonly unsicher?: boolean;
}

export interface KontrollDatenpunkt {
  readonly id: string;
  readonly heimatKoId: string;
  readonly fassung: number;
  readonly art: "zahl" | "aussage";
  readonly wert: string;
  readonly zahl?: number;
  readonly einheit?: string;
  readonly waehrung?: string;
  readonly zeitraum?: string;
  readonly bezugsgroesse?: string;
  readonly erfassung: "direkt" | "ocr" | "manuell" | "berechnet" | "prognose";
  readonly quelle?: {
    readonly koId: string;
    readonly koFassung: number;
    readonly anhangId?: string;
    readonly objectId?: string;
  };
  readonly fundstelle: KontrollFundstelle;
  readonly rechenweg?: {
    readonly eingaben: readonly {
      readonly datenpunktId: string;
      readonly fassung: number;
      readonly wert: string;
    }[];
  };
}

/** Eine Prüfung, wie PP-02 sie führt (`Pruefung`). */
export interface KontrollPruefung {
  readonly id: string;
  readonly dimension: Dimension;
  readonly ergebnis: "bestanden" | "klaerung";
  readonly grund: string;
  readonly von: string;
  readonly am: string;
  readonly datenFassung: number;
}

/** Der Prüfstand einer Dimension, wie PP-02 ihn liefert (`DimensionsBefund`). */
export interface DimensionsEingang {
  readonly dimension: Dimension;
  readonly stand: DimensionsStand;
  readonly grund: string;
  readonly pruefung?: KontrollPruefung;
}

/** Der Prüfstand, wie PP-02 ihn liefert (`Pruefstand`). */
export interface PruefstandEingang {
  readonly datenFassung: number;
  readonly erforderlich: readonly Dimension[];
  readonly dimensionen: readonly DimensionsEingang[];
  readonly prognose: boolean;
}

/** Wie PP-02 eine Bindung heute vorfindet (`BindungsSicht`), soweit hier gelesen. */
export interface BindungsEingang {
  readonly lage: string;
  readonly folienPosition: number;
  readonly elementName: string;
  readonly datenFassung: number;
  readonly anhangName?: string;
  readonly heute?: string;
}

/** Eine Folientabelle der aktuellen Dateifassung (PP-02 `leseFolienDaten`), soweit hier gelesen. */
export interface KontrollFolien {
  readonly objectId: string;
  readonly satz: {
    readonly folien: readonly {
      readonly sldId: string;
      readonly elemente: readonly {
        readonly shapeId: string;
        readonly zellen?: readonly {
          readonly zeile: number;
          readonly spalte: number;
          readonly text: string;
        }[];
      }[];
    }[];
  };
}

// ------------------------------------------------------------------------------------------------
// UMGEBUNG — Rechte und Bestand kommen vom Aufrufer
// ------------------------------------------------------------------------------------------------

export interface KontrollUmgebung {
  /** Der Artikel, wenn der Handelnde ihn lesen darf (`ko.read` + `darfSehen`); sonst nichts. */
  artikel(koId: string): Promise<KnowledgeObject | undefined>;
  /** Folien der AKTUELLEN Fassung eines PPTX-Anhangs eines lesbaren Artikels (PP-02 `folien`). */
  folien(koId: string, anhangId: string): Promise<KontrollFolien | undefined>;
  /**
   * Andere Datenpunkte desselben Kontexts (Heimatartikel, dieselbe Präsentation), die der Handelnde
   * VOLLSTÄNDIG lesen darf (PP-02 `vollLesbar`). Nur sie werden verglichen und genannt.
   */
  vergleichbare(dp: KontrollDatenpunkt): Promise<readonly KontrollDatenpunkt[]>;
  /** Der Zustand einer Eingabe in der verwendeten Fassung — `undefined`, wenn nicht lesbar. */
  eingabeZustand?(
    datenpunktId: string,
    fassung: number,
  ): Promise<{ readonly zustand: Zustand; readonly wert: string } | undefined>;
  readonly jetzt: number;
}

// ------------------------------------------------------------------------------------------------
// BEFUNDE
// ------------------------------------------------------------------------------------------------

/**
 * Das Ergebnis einer Kontrolle:
 *   · `klaerung`  — konkreter Mangel; die Dimension steht auf Klärungsbedarf (Regel 2).
 *   · `bestanden` — nachgeprüft; ersetzt eine offene Prüfung nur mit `ersetztPruefung` (Regel 3).
 *   · `offen`     — konkret benannte offene Prüfung, die die Maschine nicht beantworten kann.
 *   · `hinweis`   — Kontext, kein Mangel (z. B. anderer Zeitraum ist kein Widerspruch).
 */
export type KontrollErgebnis = "klaerung" | "bestanden" | "offen" | "hinweis";

export interface Gegenstelle {
  readonly datenpunktId: string;
  readonly wert: string;
  readonly erfassung: KontrollDatenpunkt["erfassung"];
  readonly fundstelle: string;
}

export interface Kontrollbefund {
  /** Stabile Kennung der Regel, z. B. `struktur.zeitraum_fehlt`. */
  readonly id: string;
  readonly dimension: Dimension;
  readonly ergebnis: KontrollErgebnis;
  /** Kurzer Titel für Listen. */
  readonly titel: string;
  /** Warum — ein Satz, den der Nutzer versteht, mit den konkreten Werten. */
  readonly grund: string;
  /** Welche konkrete Arbeit den Befund ändert. */
  readonly naechsteArbeit?: string;
  /** Die vorhandene Klarwerk-Regel bzw. der Weg, aus dem der Befund stammt. */
  readonly regel: string;
  readonly ersetztPruefung?: boolean;
  /** Die Fundstelle dieses Datenpunkts (bei Widersprüchen). */
  readonly hier?: string;
  /** Lesbare Gegenstellen (bei Widersprüchen). */
  readonly gegenstellen?: readonly Gegenstelle[];
}

// ------------------------------------------------------------------------------------------------
// ZAHLEN UND TEXT
// ------------------------------------------------------------------------------------------------

const ZAHLTOKEN = /(?:(?<![\p{L}\p{N}])[-+−])?\d+(?:[.,]\d+)*/gu;

/** Eine Zahl in deutscher Schreibweise lesen („1.500“ = 1500, „1,5“ = 1,5) — wie PP-02. */
function zahlAusToken(token: string): number {
  let s = token.replace(/−/g, "-").replace(/^\+/, "");
  const punkte = (s.match(/\./g) ?? []).length;
  const kommas = (s.match(/,/g) ?? []).length;
  if (punkte > 0 && kommas > 0) {
    s =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (kommas > 1) {
    s = s.replace(/,/g, "");
  } else if (kommas === 1) {
    s = s.replace(",", ".");
  } else if (punkte > 1 || /^-?\d{1,3}\.\d{3}$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  return Number(s);
}

/** Die EINE Zahl eines Texts samt Nachkommastellen; `undefined` bei keiner oder mehreren. */
export function eineZahl(text: string): { zahl: number; stellen: number } | undefined {
  const token = [...text.matchAll(ZAHLTOKEN)].map((m) => m[0]);
  if (token.length !== 1 || token[0] === undefined) {
    return undefined;
  }
  const zahl = zahlAusToken(token[0]);
  if (!Number.isFinite(zahl)) {
    return undefined;
  }
  const nachkomma = /[.,](\d+)$/.exec(token[0]);
  const stellen = nachkomma?.[1] && !Number.isInteger(zahl) ? nachkomma[1].length : 0;
  return { zahl, stellen };
}

function deutsch(zahl: number, stellen: number): string {
  return zahl.toLocaleString("de-DE", {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  });
}

function normal(text: string | undefined): string {
  return (text ?? "")
    .replace(/[\s  ]+/g, " ")
    .trim()
    .toLocaleLowerCase("de-DE");
}

/** Kopfzeile bzw. -spalte einer Summe. */
const SUMMENKOPF = /^(summe|gesamt|insgesamt|total|gesamtsumme|σ)\b/i;

function istProzent(dp: KontrollDatenpunkt): boolean {
  return normal(dp.einheit) === "%" || /%/.test(dp.wert) || normal(dp.einheit) === "prozent";
}

/** Die Fundstelle als Satz für Gegenüberstellungen — ohne technische Kennungen. */
export function fundstellenText(f: KontrollFundstelle): string {
  const folie =
    f.folienPosition !== undefined
      ? `Folie ${f.folienPosition}${f.folienTitel ? ` „${f.folienTitel}“` : ""}`
      : "";
  switch (f.art) {
    case "tabellenzelle":
      return `${folie}, Tabelle${f.elementName ? ` „${f.elementName}“` : ""}, Zeile ${f.zeile ?? "?"}${f.zeilenkopf ? ` („${f.zeilenkopf}“)` : ""}, Spalte ${f.spalte ?? "?"}${f.spaltenkopf ? ` („${f.spaltenkopf}“)` : ""}`;
    case "folienelement":
      return `${folie}${f.elementName ? `, „${f.elementName}“` : ""}`;
    case "bild":
      return `${folie}, Bild${f.elementName ? ` „${f.elementName}“` : ""} (OCR${f.unsicher ? ", unsicher" : ""})`;
    case "artikel":
      return f.zitat ? `Artikelstelle „${f.zitat}“` : "Artikelstelle";
    case "eingabe":
      return "manuelle Eingabe";
    case "rechenweg":
      return "berechnet";
    default:
      return folie || f.art;
  }
}

// ------------------------------------------------------------------------------------------------
// DIE KONTROLLEN
// ------------------------------------------------------------------------------------------------

function strukturBefunde(dp: KontrollDatenpunkt): Kontrollbefund[] {
  if (dp.art !== "zahl") {
    return [];
  }
  const befunde: Kontrollbefund[] = [];
  if (!dp.zeitraum) {
    befunde.push({
      id: "struktur.zeitraum_fehlt",
      dimension: "struktur",
      ergebnis: "klaerung",
      titel: "Bezugszeitraum fehlt",
      grund: `Für „${dp.wert}“ fehlt der Bezugszeitraum (z. B. „Q3 2026“). Ohne Zeitraum ist der Wert weder vergleichbar noch validierbar.`,
      naechsteArbeit: "Bezugszeitraum ergänzen (Korrektur am Datenpunkt).",
      regel: "PP-03 Pflichtangaben (Abschnitt 4/5, V08 Geltung)",
    });
  }
  if (!dp.einheit && !dp.waehrung) {
    befunde.push({
      id: "struktur.einheit_fehlt",
      dimension: "struktur",
      ergebnis: "klaerung",
      titel: "Einheit oder Währung fehlt",
      grund: `Für „${dp.wert}“ fehlt die Einheit bzw. Währung.`,
      naechsteArbeit: "Einheit oder Währung ergänzen (Korrektur am Datenpunkt).",
      regel: "PP-03 Pflichtangaben (Abschnitt 4/5)",
    });
  }
  if (istProzent(dp) && !dp.bezugsgroesse) {
    befunde.push({
      id: "struktur.bezugsgroesse_fehlt",
      dimension: "struktur",
      ergebnis: "klaerung",
      titel: "Bezugsgröße des Prozentwerts fehlt",
      grund: `„${dp.wert}“ ist ein Anteil ohne Bezugsgröße (Nenner). Wovon er gerechnet ist, bleibt offen.`,
      naechsteArbeit: "Bezugsgröße (Nenner) ergänzen.",
      regel: "PP-03 Pflichtangaben (Abschnitt 6: Nenner eines Prozentwerts)",
    });
  }
  if (befunde.length === 0) {
    befunde.push({
      id: "struktur.pflichtangaben_vollstaendig",
      dimension: "struktur",
      ergebnis: "bestanden",
      titel: "Pflichtangaben vollständig",
      grund: `Zeitraum, ${dp.waehrung ? "Währung" : "Einheit"}${istProzent(dp) ? " und Bezugsgröße" : ""} sind angegeben. Ob Format und Zuordnung stimmen, prüft ein Mensch.`,
      regel: "PP-03 Pflichtangaben",
    });
  }
  return befunde;
}

/**
 * Summenzeile („Summe“, „Gesamt“ … im Zeilenkopf) bzw. Summenspalte einer Folientabelle: die Teile
 * aus DERSELBEN Dateifassung lesen und mit V06 (`rechne`) nachrechnen.
 */
async function summenBefunde(
  dp: KontrollDatenpunkt,
  u: KontrollUmgebung,
): Promise<Kontrollbefund[]> {
  const f = dp.fundstelle;
  if (
    dp.art !== "zahl" ||
    f.art !== "tabellenzelle" ||
    !dp.quelle?.anhangId ||
    f.zeile === undefined ||
    f.spalte === undefined
  ) {
    return [];
  }
  const zeile = f.zeile;
  const spalte = f.spalte;
  const zeilenSumme = SUMMENKOPF.test((f.zeilenkopf ?? "").trim()) && zeile > 2;
  const spaltenSumme = !zeilenSumme && SUMMENKOPF.test((f.spaltenkopf ?? "").trim()) && spalte > 2;
  if (!zeilenSumme && !spaltenSumme) {
    return [];
  }
  const datei = await u.folien(dp.quelle.koId, dp.quelle.anhangId);
  if (!datei || datei.objectId !== dp.quelle.objectId) {
    // Andere Dateifassung: die Aktualität meldet das; gerechnet wird nur in der verwendeten Fassung.
    return [
      {
        id: "berechnung.summe_nicht_pruefbar",
        dimension: "berechnung",
        ergebnis: "offen",
        titel: "Summe nicht nachgerechnet",
        grund:
          "Die verwendete Dateifassung ist nicht mehr die aktuelle; die Summe wird erst nach dem Neulesen an der aktuellen Fassung nachgerechnet.",
        regel: "V06 Rechenprüfung",
      },
    ];
  }
  const zellen =
    datei.satz.folien
      .find((x) => x.sldId === f.sldId)
      ?.elemente.find((e) => e.shapeId === f.shapeId)?.zellen ?? [];
  // Die Teile: in der Summenzeile die Zeilen darüber (ohne Kopfzeile), in der Summenspalte die
  // Spalten davor (ohne Kopfspalte).
  const teile = zellen
    .filter((z) =>
      zeilenSumme
        ? z.spalte === spalte && z.zeile > 1 && z.zeile < zeile
        : z.zeile === zeile && z.spalte > 1 && z.spalte < spalte,
    )
    .sort((a, b) => (zeilenSumme ? a.zeile - b.zeile : a.spalte - b.spalte));
  const kopfVon = (z: { zeile: number; spalte: number }): string => {
    const kopf = zeilenSumme
      ? zellen.find((k) => k.zeile === z.zeile && k.spalte === 1)
      : zellen.find((k) => k.zeile === 1 && k.spalte === z.spalte);
    return kopf?.text ?? "";
  };
  const gelesen = teile.map((z) => ({ z, n: eineZahl(z.text), kopf: kopfVon(z) }));
  const unlesbar = gelesen.filter((g) => !g.n);
  const bereich = zeilenSumme ? `Zeilen 2–${zeile - 1}` : `Spalten 2–${spalte - 1}`;
  const stelleVon = (z: { zeile: number; spalte: number }) =>
    zeilenSumme ? `Zeile ${z.zeile}` : `Spalte ${z.spalte}`;
  if (teile.length === 0 || unlesbar.length > 0) {
    const liste = unlesbar.map((g) => `${stelleVon(g.z)}: „${g.z.text}“`).join("; ");
    return [
      {
        id: "berechnung.summe_unvollstaendig",
        dimension: "berechnung",
        ergebnis: "klaerung",
        titel: "Summe nicht nachrechenbar",
        grund:
          teile.length === 0
            ? `Zu „${dp.wert}“ gibt es in der Tabelle keine Teilwerte.`
            : `In ${bereich} steht nicht überall genau eine Zahl (${liste}). Die Summe ist so nicht prüfbar.`,
        naechsteArbeit:
          "Teilwerte vervollständigen oder die Summe als manuelle Angabe kennzeichnen.",
        regel: "V06 Rechenprüfung",
      },
    ];
  }
  const eingaben = gelesen.map((g) => g.n?.zahl ?? 0);
  const stellen = Math.max(
    eineZahl(dp.wert)?.stellen ?? 0,
    ...gelesen.map((g) => g.n?.stellen ?? 0),
  );
  const summe = rechne({ art: "summe", eingaben, ergebnis: "" });
  const gerundet = Math.round(summe * 10 ** stellen) / 10 ** stellen;
  const steht = eineZahl(dp.wert)?.zahl ?? dp.zahl;
  const teileText = gelesen.map((g) => `${g.kopf ? `„${g.kopf}“ ` : ""}${g.z.text}`).join(" + ");
  if (steht === undefined || Math.abs(steht - gerundet) > 0.5 * 10 ** -stellen) {
    return [
      {
        id: "berechnung.summe_falsch",
        dimension: "berechnung",
        ergebnis: "klaerung",
        titel: "Falsche Summe",
        grund: `${bereich} ergeben ${teileText} = ${deutsch(gerundet, stellen)}; in der Summe steht „${dp.wert}“ (Abweichung ${deutsch((steht ?? 0) - gerundet, stellen)}).`,
        naechsteArbeit:
          "Summe oder Teilwert an der Quelle prüfen und korrigieren; danach wird neu nachgerechnet.",
        regel: "V06 Rechenprüfung (rechne: summe)",
      },
    ];
  }
  return [
    {
      id: "berechnung.summe_stimmt",
      dimension: "berechnung",
      ergebnis: "bestanden",
      titel: "Summe nachgerechnet",
      grund: `${bereich}: ${teileText} = ${deutsch(gerundet, stellen)} — stimmt mit „${dp.wert}“ überein (verwendete Dateifassung).`,
      regel: "V06 Rechenprüfung (rechne: summe)",
      ersetztPruefung: true,
    },
  ];
}

function erkennungsBefunde(
  dp: KontrollDatenpunkt,
  stand: DimensionsEingang | undefined,
): Kontrollbefund[] {
  if (dp.erfassung !== "ocr") {
    return [];
  }
  // Ein Mensch hat den Wert am Bild für DIESE Datenfassung bestätigt (PP-02 bindet das an den
  // Fingerabdruck): dann gilt seine Prüfung, nicht die Unsicherheit der Erkennung.
  const bestaetigt =
    stand?.stand === "bestanden" && stand.pruefung && !stand.pruefung.von.startsWith("klarwerk:");
  if (bestaetigt) {
    return [];
  }
  if (dp.fundstelle.unsicher) {
    return [
      {
        id: "erkennung.ocr_unsicher",
        dimension: "erkennung",
        ergebnis: "klaerung",
        titel: "Unsichere Texterkennung",
        grund: `Die Texterkennung meldete unsichere Stellen; „${dp.wert}“ ist am Bild (${fundstellenText(dp.fundstelle)}) noch nicht bestätigt. OCR allein validiert nicht.`,
        naechsteArbeit: "Wert am Bild bestätigen oder korrigieren.",
        regel: "W03/A02 Erkennung",
      },
    ];
  }
  return [
    {
      id: "erkennung.ocr_unbestaetigt",
      dimension: "erkennung",
      ergebnis: "offen",
      titel: "OCR-Wert nicht bestätigt",
      grund: `„${dp.wert}“ ist OCR-erkannt und noch nicht am Bild bestätigt. OCR allein validiert nicht.`,
      naechsteArbeit: "Wert am Bild bestätigen.",
      regel: "W03/A02 Erkennung",
    },
  ];
}

/** Derselbe Sachverhalt: gleiche Bezugsgröße. Zeitraum und Einheit entscheiden über Vergleichbarkeit. */
function konsistenzBefunde(
  dp: KontrollDatenpunkt,
  andere: readonly KontrollDatenpunkt[],
  bindungen: readonly BindungsEingang[],
): Kontrollbefund[] {
  const befunde: Kontrollbefund[] = [];
  for (const b of bindungen) {
    if (b.lage === "abweichung") {
      befunde.push({
        id: "konsistenz.folie_abweichend",
        dimension: "konsistenz",
        ergebnis: "klaerung",
        titel: "Folie weicht ab",
        grund: `Folie ${b.folienPosition}${b.elementName ? ` „${b.elementName}“` : ""}${b.anhangName ? ` (${b.anhangName})` : ""} zeigt „${b.heute ?? ""}“; gebunden ist „${dp.wert}“ (Datenfassung ${dp.fassung}).`,
        naechsteArbeit:
          "Folie an die Datenfassung angleichen oder den Datenpunkt mit Grund korrigieren.",
        regel: "PP-02 Bindung (Abweichung zur gebundenen Datenfassung)",
      });
    }
  }
  if (dp.art !== "zahl" || dp.zahl === undefined) {
    return befunde;
  }
  if (!dp.bezugsgroesse) {
    befunde.push({
      id: "konsistenz.nicht_vergleichbar",
      dimension: "konsistenz",
      ergebnis: "offen",
      titel: "Nicht abgleichbar",
      grund:
        "Ohne Bezugsgröße lässt sich der Wert nicht mit anderen Angaben zum selben Sachverhalt abgleichen.",
      naechsteArbeit: "Bezugsgröße ergänzen, dann gleicht Klarwerk automatisch ab.",
      regel: "PP-03 Konsistenz",
    });
    return befunde;
  }
  const sachverhalt = normal(dp.bezugsgroesse);
  const masz = normal(dp.waehrung ?? dp.einheit);
  const gleich = andere.filter(
    (a) =>
      a.id !== dp.id &&
      a.art === "zahl" &&
      a.zahl !== undefined &&
      normal(a.bezugsgroesse) === sachverhalt,
  );
  const unsicher = (x: KontrollDatenpunkt) =>
    x.erfassung === "ocr" && x.fundstelle.unsicher === true;
  const hier = fundstellenText(dp.fundstelle);
  const mitStelle = (liste: readonly KontrollDatenpunkt[]) =>
    liste.map((a) => `„${a.wert}“ (${fundstellenText(a.fundstelle)})`).join(", ");
  const mitRahmen = (liste: readonly KontrollDatenpunkt[]) =>
    liste
      .map((a) => {
        const angabe = a.waehrung ?? a.einheit;
        return `„${a.wert}“ (${a.zeitraum ?? "ohne Zeitraum"}${angabe ? `, ${angabe}` : ""})`;
      })
      .join(", ");
  const gegen = (a: KontrollDatenpunkt): Gegenstelle => ({
    datenpunktId: a.id,
    wert: a.wert,
    erfassung: a.erfassung,
    fundstelle: fundstellenText(a.fundstelle),
  });
  const widerspruch: KontrollDatenpunkt[] = [];
  const unsicherAbweichend: KontrollDatenpunkt[] = [];
  const andererRahmen: KontrollDatenpunkt[] = [];
  const uebereinstimmend: KontrollDatenpunkt[] = [];
  for (const a of gleich) {
    const vergleichbar =
      dp.zeitraum !== undefined &&
      normal(a.zeitraum) === normal(dp.zeitraum) &&
      normal(a.waehrung ?? a.einheit) === masz;
    if (!vergleichbar) {
      if (a.zahl !== dp.zahl) {
        andererRahmen.push(a);
      }
      continue;
    }
    if (a.zahl === dp.zahl) {
      uebereinstimmend.push(a);
    } else if (unsicher(a) || unsicher(dp)) {
      unsicherAbweichend.push(a);
    } else {
      widerspruch.push(a);
    }
  }
  const eigenesMasz = dp.waehrung ?? dp.einheit;
  const rahmen = `${dp.bezugsgroesse}, ${dp.zeitraum ?? "ohne Zeitraum"}${eigenesMasz ? `, ${eigenesMasz}` : ""}`;
  if (widerspruch.length > 0) {
    befunde.push({
      id: "konsistenz.widerspruch",
      dimension: "konsistenz",
      ergebnis: "klaerung",
      titel: "Mögliche Abweichung",
      grund: `Zum selben Sachverhalt (${rahmen}) steht hier „${dp.wert}“ (${hier}), dort ${mitStelle(widerspruch)}. Klara entscheidet nicht, welcher Wert richtig ist.`,
      naechsteArbeit:
        "Beide Fundstellen prüfen; den falschen Wert korrigieren oder den Bezugsrahmen (Zeitraum, Definition) präzisieren.",
      regel: "PP-03 Konsistenz (wie A05: beide Fundstellen, keine Entscheidung ohne Beleg)",
      hier,
      gegenstellen: widerspruch.map(gegen),
    });
  }
  if (unsicherAbweichend.length > 0) {
    befunde.push({
      id: "konsistenz.abweichung_unsicher",
      dimension: "konsistenz",
      ergebnis: "offen",
      titel: "Abweichung bei unsicherer Erkennung",
      grund: `Zum selben Sachverhalt (${rahmen}) weicht ${mitStelle(unsicherAbweichend)} ab; mindestens eine Angabe ist unsicher erkannt. Das ist noch kein belegter Widerspruch.`,
      naechsteArbeit: "Die unsicher erkannte Angabe am Bild bestätigen oder korrigieren.",
      regel: "PP-03 Konsistenz (unsichere OCR ist kein Widerspruch)",
      hier,
      gegenstellen: unsicherAbweichend.map(gegen),
    });
  }
  if (andererRahmen.length > 0) {
    befunde.push({
      id: "konsistenz.anderer_bezugsrahmen",
      dimension: "konsistenz",
      ergebnis: "hinweis",
      titel: "Kein Widerspruch: anderer Bezugsrahmen",
      grund: `${mitRahmen(andererRahmen)} gilt für einen anderen Zeitraum bzw. eine andere Einheit und wird nicht als Widerspruch gewertet.`,
      regel: "PP-03 Konsistenz (Perioden und Einheiten vor Vergleichen berücksichtigen)",
      hier,
      gegenstellen: andererRahmen.map(gegen),
    });
  }
  if (uebereinstimmend.length > 0 && widerspruch.length === 0) {
    befunde.push({
      id: "konsistenz.uebereinstimmung",
      dimension: "konsistenz",
      ergebnis: "bestanden",
      titel: "Stimmt mit anderen Angaben überein",
      grund: `Zum selben Sachverhalt (${rahmen}) nennt auch ${mitStelle(uebereinstimmend)} denselben Wert. Abgeglichen sind nur die für dich lesbaren Datenpunkte.`,
      regel: "PP-03 Konsistenz",
      hier,
      gegenstellen: uebereinstimmend.map(gegen),
    });
  }
  return befunde;
}

/** V02/V03 und V01 an der Quelle des Datenpunkts. */
async function quellBefunde(
  dp: KontrollDatenpunkt,
  stand: DimensionsEingang | undefined,
  u: KontrollUmgebung,
): Promise<Kontrollbefund[]> {
  if (!dp.quelle) {
    return [];
  }
  const ko = await u.artikel(dp.quelle.koId);
  if (!ko) {
    return [];
  }
  const befunde: Kontrollbefund[] = [];
  const anhang = dp.quelle.anhangId
    ? ko.attachments?.find((a) => a.id === dp.quelle?.anhangId)
    : undefined;
  const neueDatei = dp.quelle.anhangId !== undefined && anhang?.objectId !== dp.quelle.objectId;
  const neueFassung = ko.version !== dp.quelle.koFassung;
  if (neueDatei || neueFassung) {
    befunde.push({
      id: "aktualitaet.neue_quellfassung",
      dimension: "aktualitaet",
      ergebnis: "klaerung",
      titel: "Veraltete Quellfassung",
      grund: neueDatei
        ? `Verwendet wurde eine frühere Fassung des Quelldokuments${anhang ? ` „${anhang.name}“` : ""}; inzwischen liegt eine neue Fassung vor.`
        : `Verwendet wurde Fassung ${dp.quelle.koFassung} von „${ko.title}“; aktuell ist Fassung ${ko.version}.`,
      naechsteArbeit: "Wert an der aktuellen Quellfassung neu lesen bzw. bestätigen.",
      regel: "V02 Bindung an die Fassung",
    });
  }
  const frische = discloseFrische(ko, u.jetzt, {
    revalidierung: { ungeprueft: "Für die Datenkontrolle nicht erhoben." },
    konflikt: { ungeprueft: "Für die Datenkontrolle nicht erhoben." },
  }).frische;
  const stufeText: Record<typeof frische.stufe, string> = {
    frisch: "frisch",
    altert: "altert",
    faellig: "fällig",
    veraltet: "veraltet",
  };
  if (frische.stufe === "faellig" || frische.stufe === "veraltet") {
    befunde.push({
      id: "aktualitaet.quelle_veraltet",
      dimension: "aktualitaet",
      ergebnis: "klaerung",
      titel: "Quelle nicht mehr aktuell",
      grund: `Die Quelle „${ko.title}“ ist laut Klarwerk-Frische „${stufeText[frische.stufe]}“${frische.bezugAm ? ` (letzter Stand ${frische.bezugAm.slice(0, 10)})` : ""}. Ob sie zum Verwendungszeitpunkt passt, ist zu klären.`,
      naechsteArbeit:
        "Quelle durch die verantwortliche Person bestätigen lassen oder eine aktuelle Quelle verwenden.",
      regel: "V03 Frische",
    });
  } else if (!neueDatei && !neueFassung && stand?.stand !== "ueberholt") {
    befunde.push({
      id: "aktualitaet.quelle_aktuell",
      dimension: "aktualitaet",
      ergebnis: "bestanden",
      titel: "Quellfassung aktuell",
      grund: `Verwendet wird die aktuelle Fassung ${ko.version} von „${ko.title}“; laut Klarwerk-Frische „${stufeText[frische.stufe]}“.`,
      regel: "V02 Bindung an die Fassung, V03 Frische",
      ersetztPruefung: true,
    });
  }
  befunde.push({
    id: "freigabe.quellstatus",
    dimension: "fachliche_freigabe",
    ergebnis: "hinweis",
    titel: "Status der Quelle",
    grund: `Die Quelle „${ko.title}“ ist als Artikel ${ko.status === "validiert" ? "validiert" : "noch nicht validiert"}. Eine validierte Quelle validiert den Wert nicht automatisch.`,
    regel: "V01 Artikelstatus",
  });
  return befunde;
}

async function eingabeBefunde(
  dp: KontrollDatenpunkt,
  u: KontrollUmgebung,
): Promise<Kontrollbefund[]> {
  if (!dp.rechenweg || !u.eingabeZustand) {
    return [];
  }
  const nicht: string[] = [];
  for (const e of dp.rechenweg.eingaben) {
    const z = await u.eingabeZustand(e.datenpunktId, e.fassung);
    if (!z) {
      nicht.push(`„${e.wert}“ (nicht lesbar)`);
    } else if (z.zustand !== "validiert") {
      nicht.push(`„${e.wert}“ (${ZUSTANDSNAME[z.zustand]})`);
    }
  }
  if (nicht.length === 0) {
    return [];
  }
  return [
    {
      id: "freigabe.eingaben_nicht_validiert",
      dimension: "fachliche_freigabe",
      ergebnis: "klaerung",
      titel: "Eingaben nicht validiert",
      grund: `Der Rechenweg verwendet Eingaben, die selbst nicht validiert sind: ${nicht.join(", ")}. Ein berechneter Wert gilt erst als validiert, wenn seine Eingaben es sind.`,
      naechsteArbeit:
        "Die genannten Eingaben prüfen; danach gilt die Freigabe dieses Werts wieder.",
      regel: "PP-03 Herkunft (Abschnitt 5: kein Status aus einem grünen Teiltest)",
    },
  ];
}

export const ZUSTANDSNAME: Record<Zustand, string> = {
  erfasst: "Erfasst, noch nicht geprüft",
  in_pruefung: "In Prüfung",
  klaerung: "Klärungsbedarf",
  validiert: "Validiert",
  ueberpruefung_noetig: "Überprüfung nötig",
};

export const STANDNAME: Record<DimensionsStand, string> = {
  bestanden: "bestanden",
  klaerung: "Klärungsbedarf",
  offen: "offen",
  ueberholt: "überholt",
  nicht_zutreffend: "trifft nicht zu",
};

/** Alle Kontrollen eines Datenpunkts — rein lesend. */
export async function kontrollen(
  dp: KontrollDatenpunkt,
  stand: PruefstandEingang,
  u: KontrollUmgebung,
  bindungen: readonly BindungsEingang[] = [],
): Promise<Kontrollbefund[]> {
  const dim = (d: Dimension) => stand.dimensionen.find((x) => x.dimension === d);
  return [
    ...erkennungsBefunde(dp, dim("erkennung")),
    ...strukturBefunde(dp),
    ...(await summenBefunde(dp, u)),
    ...konsistenzBefunde(dp, await u.vergleichbare(dp), bindungen),
    ...(await quellBefunde(dp, dim("aktualitaet"), u)),
    ...(await eingabeBefunde(dp, u)),
  ];
}

// ------------------------------------------------------------------------------------------------
// ÜBERLAGERUNG — die Befunde über dem PP-02-Prüfstand
// ------------------------------------------------------------------------------------------------

export interface KontrollDimension {
  readonly dimension: Dimension;
  readonly name: string;
  readonly stand: DimensionsStand;
  readonly standName: string;
  readonly grund: string;
  /** Woher der Stand kommt: eine Prüfung (Person/Weg, Zeit), eine Kontrolle oder noch nichts. */
  readonly herkunft: "pruefung" | "kontrolle" | "keine";
  readonly pruefung?: KontrollPruefung;
  readonly befunde: readonly Kontrollbefund[];
}

export interface Datenkontrolle {
  readonly datenpunktId: string;
  readonly datenFassung: number;
  readonly zustand: Zustand;
  readonly zustandName: string;
  readonly grund: string;
  readonly naechsteArbeit: readonly string[];
  readonly erforderlich: readonly Dimension[];
  readonly dimensionen: readonly KontrollDimension[];
  readonly befunde: readonly Kontrollbefund[];
  readonly prognose: boolean;
  readonly gepruefAm: string;
}

/**
 * Legt die Befunde über den PP-02-Prüfstand (Regeln im Kopf der Datei) und leitet den Zustand neu
 * ab — mit denselben Stufen wie PP-02. „Validiert“ heißt weiterhin: ALLE erforderlichen Dimensionen
 * bestanden, die fachliche Freigabe eingeschlossen.
 */
export function mitKontrollen(
  dp: Pick<KontrollDatenpunkt, "id">,
  stand: PruefstandEingang,
  befunde: readonly Kontrollbefund[],
  jetzt: number,
): Datenkontrolle {
  const erforderlich = new Set(stand.erforderlich);
  const dimensionen = DIMENSIONEN.map((dimension): KontrollDimension => {
    const ein: DimensionsEingang = stand.dimensionen.find((d) => d.dimension === dimension) ?? {
      dimension,
      stand: "offen",
      grund: "",
    };
    const eigene = befunde.filter((b) => b.dimension === dimension);
    const klaerung = eigene.filter((b) => b.ergebnis === "klaerung");
    const ersetzt = eigene.filter((b) => b.ergebnis === "bestanden" && b.ersetztPruefung);
    const offeneBefunde = eigene.filter((b) => b.ergebnis === "offen");
    let s: DimensionsStand = ein.stand;
    let grund = ein.grund;
    let herkunft: KontrollDimension["herkunft"] = ein.pruefung ? "pruefung" : "keine";
    if (ein.stand === "ueberholt") {
      // Regel 1: eine Änderung hebt den alten Status immer auf.
    } else if (klaerung.length > 0) {
      // Regel 2: ein konkreter Mangel lässt sich nicht wegbestätigen.
      s = "klaerung";
      grund = klaerung.map((b) => b.grund).join(" ");
      herkunft = "kontrolle";
      erforderlich.add(dimension);
    } else if (ersetzt.length > 0 && (ein.stand === "offen" || ein.stand === "nicht_zutreffend")) {
      // Regel 3: die Maschine beantwortet die Frage vollständig.
      s = "bestanden";
      grund = ersetzt.map((b) => b.grund).join(" ");
      herkunft = "kontrolle";
      erforderlich.add(dimension);
    } else if (offeneBefunde.length > 0 && ein.stand === "nicht_zutreffend") {
      // Eine Kontrolle macht die Dimension erforderlich (z. B. eine Summe, die an der aktuellen
      // Fassung erst noch nachzurechnen ist) — sie bleibt offen, bis die Arbeit getan ist.
      s = "offen";
      grund = offeneBefunde.map((b) => b.grund).join(" ");
      herkunft = "kontrolle";
      erforderlich.add(dimension);
    }
    return {
      dimension,
      name: DIMENSIONSNAME[dimension],
      stand: s,
      standName: STANDNAME[s],
      grund,
      herkunft,
      ...(ein.pruefung ? { pruefung: ein.pruefung } : {}),
      befunde: eigene,
    };
  });
  const relevant = dimensionen.filter((d) => d.stand !== "nicht_zutreffend");
  const mit = (st: DimensionsStand) => relevant.filter((d) => d.stand === st);
  const ueberholt = mit("ueberholt");
  const klaerung = mit("klaerung");
  const offen = mit("offen");
  const bestanden = mit("bestanden");
  const namen = (liste: readonly KontrollDimension[]) => liste.map((d) => d.name).join(", ");
  let zustand: Zustand;
  let grund: string;
  if (ueberholt.length > 0) {
    zustand = "ueberpruefung_noetig";
    grund = `Überprüfung nötig (${namen(ueberholt)}): ${ueberholt.map((d) => d.grund).join(" ")}`;
  } else if (klaerung.length > 0) {
    zustand = "klaerung";
    grund = `Klärungsbedarf (${namen(klaerung)}): ${klaerung.map((d) => d.grund).join(" ")}`;
  } else if (offen.length === 0) {
    zustand = "validiert";
    grund = `Validiert für Datenfassung ${stand.datenFassung} im Prüfrahmen ${namen(relevant)}.${stand.prognose ? " Es bleibt eine Prognose mit Annahmen, kein beobachteter Wert." : ""}`;
  } else if (bestanden.length > 0) {
    zustand = "in_pruefung";
    grund = `In Prüfung: bestanden ${namen(bestanden)}; offen ${namen(offen)}.`;
  } else {
    zustand = "erfasst";
    grund = `Erfasst, noch nicht geprüft. Offen: ${namen(offen)}.`;
  }
  const arbeit = (d: KontrollDimension) =>
    d.befunde
      .filter((b) => b.ergebnis === "klaerung" || b.ergebnis === "offen")
      .flatMap((b) => (b.naechsteArbeit ? [b.naechsteArbeit] : []));
  const naechsteArbeit = [
    ...ueberholt.map((d) => `${d.name} für Fassung ${stand.datenFassung} erneut prüfen.`),
    ...klaerung.flatMap((d) => {
      const a = arbeit(d);
      return a.length > 0 ? a : [`Klärung zu ${d.name}: ${d.grund}`];
    }),
    ...offen.flatMap((d) => {
      const a = arbeit(d);
      return a.length > 0 ? a : [`${d.name} prüfen.`];
    }),
  ];
  return {
    datenpunktId: dp.id,
    datenFassung: stand.datenFassung,
    zustand,
    zustandName: ZUSTANDSNAME[zustand],
    grund,
    naechsteArbeit: [...new Set(naechsteArbeit)],
    erforderlich: DIMENSIONEN.filter((d) => erforderlich.has(d)),
    dimensionen,
    befunde,
    prognose: stand.prognose,
    gepruefAm: new Date(jetzt).toISOString(),
  };
}

/** Kontrollen ausführen und über den PP-02-Prüfstand legen — der Einstieg für Route und Sicht. */
export async function datenkontrolle(
  dp: KontrollDatenpunkt,
  stand: PruefstandEingang,
  u: KontrollUmgebung,
  bindungen: readonly BindungsEingang[] = [],
): Promise<Datenkontrolle> {
  return mitKontrollen(dp, stand, await kontrollen(dp, stand, u, bindungen), u.jetzt);
}

// ------------------------------------------------------------------------------------------------
// DATENLAGE EINER PRÄSENTATION — erforderliche Prüfungen und offene Punkte auf einen Blick
// ------------------------------------------------------------------------------------------------

export interface Datenlage {
  readonly anzahl: number;
  readonly jeZustand: Readonly<Record<Zustand, number>>;
  /** Je offener bzw. klärungsbedürftiger Befund: welcher Wert, was zu tun ist. */
  readonly offenePunkte: readonly {
    readonly datenpunktId: string;
    readonly zustand: Zustand;
    readonly titel: string;
    readonly naechsteArbeit?: string;
  }[];
}

export function datenlage(liste: readonly Datenkontrolle[]): Datenlage {
  const jeZustand: Record<Zustand, number> = {
    erfasst: 0,
    in_pruefung: 0,
    klaerung: 0,
    validiert: 0,
    ueberpruefung_noetig: 0,
  };
  const offenePunkte: Datenlage["offenePunkte"][number][] = [];
  for (const k of liste) {
    jeZustand[k.zustand] += 1;
    for (const b of k.befunde) {
      if (b.ergebnis === "klaerung") {
        offenePunkte.push({
          datenpunktId: k.datenpunktId,
          zustand: k.zustand,
          titel: b.titel,
          ...(b.naechsteArbeit ? { naechsteArbeit: b.naechsteArbeit } : {}),
        });
      }
    }
  }
  return { anzahl: liste.length, jeZustand, offenePunkte };
}

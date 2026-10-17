// ================================================================================================
// OCR-E02 · BERICHTIGTER BILDTEXT (Auftrag produkt:20261012:klara-ocr-fundstellen-korrekturen).
// ================================================================================================
//
// Eine Berichtigung gilt für GENAU eine Quelle und GENAU eine Bildfassung:
//   · Quelle — die Kennung der Fläche (`korrekturQuelle`): `office:<anhang>`, `datei:sha256:<hex>|<name>`,
//     `ko:<id>`/`entwurf:<id>` im Editor. Bei einzeln bereitgestellten Bildern (Bildanhänge) kommt
//     der Name des Bildes dazu.
//   · Bildfassung — die Inhaltskennung (`sha256` der Bildbytes).
// Ein anderes Bild, ein verändertes Bild (andere Bytes) oder dieselben Bytes in einer anderen Quelle
// bekommen die Berichtigung NICHT. Ein erneutes Lesen derselben Bytes ändert sie nicht — sie liegt
// am Konto (`/api/me/assistenz/bildkorrekturen`), getrennt vom Rohbefund.
//
// Diese Datei ist DOM-FREI und rein: sie legt eine Berichtigung über einen Befund (für Anzeige UND
// Klaras Kontext) und hält den Rohbefund daneben. Bild und Datei werden nie angefasst.

import {
  type BildBefund,
  type BildFundstelle,
  type QuellenBefund,
  bildInhaltskennung,
} from "./bildAutomatik";
import { ausrichten } from "./bildFundstelle";

/** Höchstlänge eines Namens in der Quelle (die ganze Quelle darf höchstens 300 Zeichen haben). */
const NAME_MAX = 100;

/** Der Dateiname ohne Steuerzeichen, gekürzt — er ist nur Teil der Bindung, keine Anzeige. */
function nameTeil(name: string): string {
  let aus = "";
  for (const zeichen of name) {
    const code = zeichen.codePointAt(0) ?? 0;
    if (code > 0x1f && (code < 0x7f || code > 0x9f)) {
      aus += zeichen;
    }
  }
  return aus.slice(0, NAME_MAX);
}

/**
 * Nacharbeit 2 (Bens Befund „gleichnamige Dokumente“): die Quelle einer eingelesenen DATEI ist ihr
 * Inhalt UND ihr Name — `datei:sha256:<hex über alle Bytes>|<name>`. Zwei verschiedene Dokumente
 * gleichen Namens (auch mit denselben eingebetteten Bildern) sind damit zwei Quellen; dieselbe,
 * unverändert wieder eingelesene Datei ist dieselbe Quelle. Eine umbenannte Kopie übernimmt nichts.
 * Ohne lesbare Bytes gibt es keine Quelle (`null`) — dann wird nicht berichtigt, statt still eine
 * fremde Bindung zu treffen.
 */
export async function dokumentKorrekturQuelle(datei: {
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}): Promise<string | null> {
  try {
    const kennung = await bildInhaltskennung(new Uint8Array(await datei.arrayBuffer()));
    return kennung ? `datei:${kennung}|${nameTeil(datei.name)}` : null;
  } catch {
    return null;
  }
}

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
  return f.art === "bild" ? `${praefix}|${nameTeil(f.quelle)}` : praefix;
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

const DATEI_INHALT = /^datei:sha256:[0-9a-f]{64}\|/;

/** Eine Dateiquelle ohne ihren Inhaltsteil — nur für den HINWEIS auf frühere Fassungen. */
function ohneDateiInhalt(quelle: string): string {
  return quelle.replace(DATEI_INHALT, "datei-name|");
}

/**
 * Gibt es für dieselbe Quelle (bei Dateien: dieselbe gleichnamige Datei in einer früheren Fassung)
 * und DIESELBE Stelle eine Berichtigung einer ANDEREN Bildfassung? Dann wurde das Bild verändert —
 * die alte Berichtigung gilt nicht und wird sichtbar nicht übernommen. Dient nur dem Hinweis; die
 * Bindung selbst (`findeKorrektur`) bleibt Quelle UND Bildfassung.
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
  const vergleich = ohneDateiInhalt(quelle);
  return liste.some(
    (k) =>
      ohneDateiInhalt(k.quelle) === vergleich &&
      k.ort === ort &&
      k.inhaltskennung !== b.inhaltskennung,
  );
}

/** Der Befund mit wirksamer Berichtigung (für Anzeige und Klara); der Rohbefund steht daneben. */
export function befundMitKorrektur(b: BildBefund, k: BildKorrekturDaten | null): BildBefund {
  if (!k || !berichtigbar(b) || k.inhaltskennung !== b.inhaltskennung) {
    return b;
  }
  // Nacharbeit 3 (Modelllauf): die automatische Bildbeschreibung (W02) desselben Bildes kann den
  // berichtigten Lesefehler wörtlich enthalten („Schild mit LAGFR 4711“). Die Berichtigung wirkt
  // deshalb auch dort — nur für die berichtigten Wörter; die Beschreibung bleibt im Rohbefund.
  const beschrieben = b.bildinhalt.status === "beschrieben";
  const angleichung = beschrieben
    ? beschreibungAngleichen(b.text, k.text, b.bildinhalt.text)
    : { text: "", uneindeutig: false };
  return {
    ...b,
    status: k.text.trim().length > 0 ? "gelesen" : "kein-text",
    text: k.text,
    textGekennzeichnet: k.text,
    unsicher: [],
    // Die erkannte Tabelle stammt aus dem Rohbefund; sie bleibt dort sichtbar.
    tabelle: null,
    ...(beschrieben ? { bildinhalt: { ...b.bildinhalt, text: angleichung.text } } : {}),
    korrektur: {
      rohText: b.text,
      rohGekennzeichnet: b.textGekennzeichnet,
      rohUnsicher: b.unsicher,
      rohTabelle: b.tabelle,
      ...(beschrieben ? { rohBildinhalt: b.bildinhalt.text } : {}),
      ...(angleichung.uneindeutig ? { beschreibungNichtAngeglichen: true } : {}),
      geaendertAm: k.geaendertAm,
      schritte: k.schritte,
    },
  };
}

/** Alle Vorkommen eines Wortes als ganzes Wort (Groß-/Kleinschreibung egal, Unicode-Grenzen). */
function vorkommen(text: string, wort: string): { index: number; laenge: number }[] {
  const sicher = wort.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${sicher}(?![\\p{L}\\p{N}])`, "giu");
  return [...text.matchAll(re)].map((m) => ({ index: m.index ?? 0, laenge: m[0].length }));
}

/**
 * Die Beschreibung, angeglichen an die Berichtigung — NUR wo die Zuordnung eindeutig ist
 * (Nacharbeit 4, Bens Befund): ein Wort, das die Berichtigung an derselben Stelle durch ein
 * ÄHNLICHES ersetzt hat („LAGFR“ → „LAGER“), wird in der Beschreibung ersetzt, wenn es im Rohtext
 * GENAU EINMAL steht und in der Beschreibung GENAU EINMAL vorkommt. Kommt es mehrfach vor (Rohtext
 * „10 10“, Berichtigung „10 11“, Beschreibung „Links 10, rechts 10“), ist nicht bestimmbar, welches
 * Vorkommen gemeint ist: dann bleibt die Beschreibung unverändert und `uneindeutig` ist gesetzt —
 * maßgeblich ist der berichtigte Bildtext, und die Beschreibung wird als „vor der Berichtigung“
 * gekennzeichnet. Alle Ersetzungen beziehen sich auf die ursprüngliche Beschreibung (keine Kette).
 *
 * Nacharbeit 6 (Bens Befund): ebenso, wenn ein Rohwort, das in der Beschreibung vorkommt, in der
 * Berichtigung KEINE Entsprechung mehr hat — gelöscht („Termin 15.11.2026“ → „Termin“), der ganze
 * Text geleert, oder durch etwas Unähnliches ersetzt („Abholung morgen“). Dann ist die Beschreibung
 * nicht sicher angleichbar: sie bleibt als Rohbefund unverändert und gilt als Stand VOR der
 * Berichtigung (`uneindeutig`), statt die entfernte Angabe als aktuell weiterzutragen.
 */
export function beschreibungAngleichen(
  roh: string,
  berichtigt: string,
  beschreibung: string,
): { text: string; uneindeutig: boolean } {
  const rohWoerter = roh.split(/\s+/).filter((w) => w.length > 0);
  const neuWoerter = berichtigt.split(/\s+/).filter((w) => w.length > 0);
  const klein = (w: string): string => w.toLocaleLowerCase();
  const zuordnung = ausrichten(neuWoerter.map(klein), rohWoerter.map(klein));
  const ersetzungen: { index: number; laenge: number; neu: string }[] = [];
  // Entfernte bzw. nicht zuordenbare Rohwörter, die die Beschreibung noch nennt.
  const zugeordnet = new Set(zuordnung.flatMap((z) => (z.wort === null ? [] : [z.wort])));
  let uneindeutig = rohWoerter.some(
    (w, j) => !zugeordnet.has(j) && vorkommen(beschreibung, w).length > 0,
  );
  for (const [i, z] of zuordnung.entries()) {
    const alt = z.wort === null ? undefined : rohWoerter[z.wort];
    const neu = neuWoerter[i];
    if (!z.ersetzt || !alt || !neu || klein(alt) === klein(neu)) {
      continue;
    }
    const treffer = vorkommen(beschreibung, alt);
    if (treffer.length === 0) {
      continue;
    }
    const imRohtext = rohWoerter.filter((w) => klein(w) === klein(alt)).length;
    const stelle = treffer[0];
    if (imRohtext !== 1 || treffer.length !== 1 || !stelle) {
      uneindeutig = true;
      continue;
    }
    if (ersetzungen.some((e) => e.index === stelle.index)) {
      uneindeutig = true;
      continue;
    }
    ersetzungen.push({ ...stelle, neu });
  }
  if (uneindeutig) {
    // Keine Teilangleichung: lieber die ganze Beschreibung unverändert und gekennzeichnet.
    return { text: beschreibung, uneindeutig: true };
  }
  let text = beschreibung;
  for (const e of [...ersetzungen].sort((x, y) => y.index - x.index)) {
    text = text.slice(0, e.index) + e.neu + text.slice(e.index + e.laenge);
  }
  return { text, uneindeutig: false };
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

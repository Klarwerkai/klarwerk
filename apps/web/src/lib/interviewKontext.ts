// ================================================================================================
// Aufnahme `gesamt-ocr` (FR-CAP-05) — DER ERKANNTE BILDTEXT ALS KONTEXT DES GEFÜHRTEN INTERVIEWS.
// ================================================================================================
//
// Historisches Abnahmekriterium: „OCR-Text fließt in Strukturierung/Interview ein." In die
// Strukturierung floss er schon (die Erkennung hängt ihn an den Rohtext). Das Interview bekam nur
// die Antworten. Jetzt reist der erkannte Text als Kontext mit.
//
// DIE ZUORDNUNG STEHT IM ROHTEXT SELBST (Bens Befunde, Nacharbeit 3). Die Erkennung — und nur sie,
// auf Klick — schreibt jeden Treffer als eigenen, ABGESCHLOSSENEN Abschnitt:
//
//     [OCR: <Bildname>]
//     <erkannter Text>
//     [/OCR]
//
//   · Der Abschnitt reist mit dem Rohtext im vorhandenen Entwurfsweg und kommt beim Fortsetzen
//     zurück — damit auch seine Zuordnung.
//   · Kontext ist der AKTUELLE Inhalt des Abschnitts. Korrekturen landen im Kontext; erst wer den
//     Kopf oder den ganzen Inhalt entfernt, schließt ihn aus.
//   · Verwerfen oder ein anderer Entwurf leeren den Rohtext — und damit den Kontext.
//
// DIE GRENZEN SIND EINDEUTIG (Bens Befunde, Nacharbeit 4). Bis hierher endete ein Abschnitt an
// JEDER Zeile der Form `[…]` — eine erkannte Zeile wie `[Hinweis]` schnitt den Rest ab, und ein
// Bildname wie `aushang[1].png` erzeugte einen Kopf, den das Lesen nicht wiedererkannte. Jetzt:
//
//   · Der Kopf ist `[OCR: ` + Name + `]` bis zum ZEILENENDE — Klammern im Namen sind erlaubt.
//     Zeilenumbrüche im Namen (in Dateinamen praktisch nicht vorhanden) werden beim Schreiben zu
//     Leerzeichen, damit Schreiben und Lesen für jeden Namen zusammenpassen.
//   · Der Abschnitt endet NUR an seiner Endzeile `[/OCR]`. Klammerzeilen im Inhalt sind Inhalt.
//     Eine Inhaltszeile, die selbst wie eine Grenze aussieht (`[/OCR]`, `[OCR: …]`), wird beim
//     Schreiben mit `\` geschützt und beim Lesen zurückgewandelt.
//   · Fehlt die Endzeile (vom Menschen gelöscht), reicht der Abschnitt bis zum nächsten OCR-Kopf
//     oder zum Textende — es geht kein erkannter Text verloren.
//
// FÜR STRUKTURIERTE ENTWÜRFE (Nacharbeit 4): Nach dem Strukturieren speichert die Seite die
// verdichtete Aussage, nicht den Rohtext. Die erkannten Abschnitte reisen deshalb zusätzlich als
// eigenes Entwurfsfeld `ocrAbschnitte` mit (`ocrAbschnitteFuerEntwurf`); beim Fortsetzen ohne
// Rohtext kommen sie als „gesicherte" Abschnitte zurück und bleiben Kontext.

const OCR_KOPF = /^\[OCR: (.+)\]$/;
const OCR_ENDE = "[/OCR]";
const SCHUTZ = "\\";

/** Wäre die Zeile als Grenze lesbar (Kopf oder Ende)? */
function istGrenze(getrimmt: string): boolean {
  return getrimmt === OCR_ENDE || OCR_KOPF.test(getrimmt);
}

/** Der Kopf eines erkannten Abschnitts — die eine Schreibweise für Erkennung und Lesen. */
export function ocrAbschnittKopf(bildname: string): string {
  return `[OCR: ${bildname.replace(/[\r\n]+/g, " ").trim()}]`;
}

/**
 * Der vollständige, abgeschlossene Abschnitt, wie die Erkennung ihn in den Rohtext schreibt. Eine
 * erkannte Zeile, die wie eine Grenze aussähe (`[/OCR]` oder `[OCR: …]`), wird mit `\` geschützt
 * und beim Lesen zurückgewandelt — andere Klammerzeilen wie `[Hinweis]` bleiben unverändert.
 */
export function ocrAbschnittText(bildname: string, erkannt: string): string {
  const inhalt = erkannt
    .split("\n")
    .map((zeile) => (istGrenze(zeile.trim()) ? `${SCHUTZ}${zeile.trim()}` : zeile))
    .join("\n");
  return `${ocrAbschnittKopf(bildname)}\n${inhalt}\n${OCR_ENDE}`;
}

/** Eine geschützte Inhaltszeile zurückwandeln; alles andere bleibt, wie es dasteht. */
function inhaltszeile(zeile: string): string {
  const getrimmt = zeile.trim();
  return getrimmt.startsWith(SCHUTZ) && istGrenze(getrimmt.slice(SCHUTZ.length))
    ? getrimmt.slice(SCHUTZ.length)
    : zeile;
}

/** Ein erkannter Abschnitt, mit seinem aktuellen Inhalt. */
export interface OcrAbschnitt {
  readonly name: string;
  readonly text: string;
}

/** Die erkannten Abschnitte des Rohtextes in ihrer Reihenfolge, Inhalt wie er JETZT dasteht. */
export function ocrAbschnitte(raw: string): OcrAbschnitt[] {
  const abschnitte: OcrAbschnitt[] = [];
  let name: string | null = null;
  let zeilen: string[] = [];
  const schliessen = (): void => {
    if (name !== null) {
      abschnitte.push({ name, text: zeilen.join("\n").trim() });
    }
    name = null;
    zeilen = [];
  };
  for (const zeile of raw.split("\n")) {
    const getrimmt = zeile.trim();
    const kopf = OCR_KOPF.exec(getrimmt);
    if (kopf) {
      // Ein neuer Kopf schließt einen Abschnitt nur dann, wenn dessen Endzeile fehlt (gelöscht) —
      // geschützte Köpfe im Inhalt kommen hier nie an.
      schliessen();
      name = kopf[1] ?? "";
    } else if (name !== null && getrimmt === OCR_ENDE) {
      schliessen();
    } else if (name !== null) {
      zeilen.push(inhaltszeile(zeile));
    }
  }
  schliessen();
  return abschnitte.filter((a) => a.text.length > 0);
}

// ================================================================================================
// Nacharbeit 11 (Bens Befund) — DIE SICHTBAREN FELDER, NICHT NUR DER ROHTEXT.
// ================================================================================================
//
// Seit der Integration mit R-1688/R-1733 landet erkannter Bildtext im SICHTBAREN Feld: im Formular
// in der „Aussage" (`draft.statement`), sonst im Rohtext. Bis hierher las der Interviewkontext und
// die Entwurfssicherung nur den Rohtext — ein im Formular erkannter Block fehlte im Interview und in
// `ocrAbschnitte`. Jetzt nehmen alle drei Funktionen die FELDER entgegen (Rohtext und Aussage) und
// lesen jedes für sich (ein Feld mit fehlender Endzeile kann das andere nicht verschlucken). Ein
// Abschnitt, der in beiden Feldern steht — der Moduswechsel übernimmt Text zwischen ihnen —, zählt
// EINMAL. Gelesen wird immer der aktuelle Inhalt. Dass eine KORRIGIERTE oder GELÖSCHTE Kopie die
// alte Quelle ablöst, regelt erst Nacharbeit 16 (unten).

/** Ein Feld oder mehrere — Rohtext und Aussage, so wie sie gerade dastehen. */
export type SichtbareFelder = string | readonly string[];

// ================================================================================================
// Nacharbeit 16 (Bens Befund) — NACH DER ÜBERNAHME ZÄHLT DIE KOPIE, NICHT DIE ALTE QUELLE.
// ================================================================================================
//
// Der Moduswechsel kopiert den Rohtext in die leere Aussage (und umgekehrt), die Quelle bleibt
// dabei stehen. Bis hierher zählten beide Felder: eine in der Aussage korrigierte Fassung reiste
// NEBEN der alten, und eine dort gelöschte lebte aus dem Rohtext weiter. Die Deduplizierung über
// Name und Text half nur bei identischen Fassungen.
//
// Jetzt merkt sich die Seite bei JEDER Übernahme, welche Abschnitte des Quellfeldes durch die Kopie
// ersetzt sind (`ocrUebernahmeErsetzt`). Diese Abschnitte zählen im Quellfeld nicht mehr — die Kopie
// ist die maßgebliche Fassung, mit allen Korrekturen und Löschungen. Was danach NEU im Quellfeld
// entsteht (eine weitere Erkennung oder eine eigene Änderung am alten Block), hat einen anderen
// Schlüssel und zählt wieder: unabhängige Abschnitte bleiben erhalten.

/** Je Feld (Reihenfolge wie die Felder) die Schlüssel der durch Übernahme ersetzten Abschnitte. */
export type OcrErsetzt = readonly (readonly string[] | undefined)[];

const schluessel = (a: OcrAbschnitt): string => `${a.name}\n${a.text.trim()}`;

/**
 * Nach einer Übernahme aus Feld `von` (Inhalt `quelle`) in Feld `nach`: alle Abschnitte, die gerade
 * in der Quelle stehen, gelten dort als ersetzt. Das Zielfeld bekommt neuen Inhalt — seine früheren
 * Markierungen gelten nicht mehr (sonst zählte ein unverändert zurückkopierter Abschnitt nirgends).
 */
export function ocrUebernahmeErsetzt(
  ersetzt: OcrErsetzt,
  von: number,
  quelle: string,
  nach: number,
): OcrErsetzt {
  const neu = [...ersetzt];
  while (neu.length <= Math.max(von, nach)) {
    neu.push(undefined);
  }
  const bisher = neu[von] ?? [];
  const dazu = ocrAbschnitte(quelle)
    .map(schluessel)
    .filter((s) => !bisher.includes(s));
  neu[von] = [...bisher, ...dazu];
  neu[nach] = undefined;
  return neu;
}

/**
 * Nacharbeit 17 (Bens Befund): Wurde Feld `feld` seit dem letzten Räumen in ein anderes übernommen?
 * `ocrUebernahmeErsetzt` legt die Liste des Quellfeldes bei JEDER Übernahme an (auch ohne erkannten
 * Abschnitt) und eine Rückübernahme entfernt sie. Dann ist die Kopie maßgeblich — auch wenn sie
 * absichtlich ganz geleert wurde; die stehen gebliebene Quelle ist kein Ersatz für sie.
 */
export function feldUebernommen(ersetzt: OcrErsetzt, feld: number): boolean {
  return ersetzt[feld] !== undefined;
}

/**
 * Nacharbeit 18 (Bens Befund): die Aussage, die ein Entwurf sichert — Feld 0 ist der Rohtext,
 * Feld 1 die Formularaussage (wie `sichtbareOcrFelder` in Capture.tsx). Nach einer Übernahme gilt
 * die maßgebliche Kopie in BEIDEN Richtungen, auch leer. Ohne Übernahme bleibt der bisherige
 * Rückfall: die Aussage, und wenn sie leer ist oder fehlt, der Rohtext.
 */
export function massgeblicheAussage(
  aussage: string | undefined,
  rohtext: string,
  ersetzt: OcrErsetzt,
): string {
  if (aussage !== undefined && feldUebernommen(ersetzt, 0)) {
    return aussage;
  }
  if (aussage !== undefined && feldUebernommen(ersetzt, 1)) {
    return rohtext;
  }
  return aussage || rohtext;
}

/**
 * Eine neue Erkennung schreibt einen frischen Abschnitt — der zählt, auch wenn ein gleichlautender
 * früher durch eine Übernahme ersetzt wurde.
 */
export function ocrErsetztOhne(ersetzt: OcrErsetzt, bild: string, erkannt: string): OcrErsetzt {
  const frisch = new Set(ocrAbschnitte(ocrAbschnittText(bild, erkannt)).map(schluessel));
  return ersetzt.map((liste) => liste?.filter((s) => !frisch.has(s)));
}

/** Die erkannten Abschnitte aller sichtbaren Felder, jeder Abschnitt einmal, in Feldreihenfolge. */
export function ocrAbschnitteDerFelder(
  felder: SichtbareFelder,
  ersetzt: OcrErsetzt = [],
): OcrAbschnitt[] {
  const liste = typeof felder === "string" ? [felder] : felder;
  const gesehen = new Set<string>();
  const ergebnis: OcrAbschnitt[] = [];
  for (const [index, feld] of liste.entries()) {
    const ersetztHier = new Set(ersetzt[index] ?? []);
    for (const abschnitt of ocrAbschnitte(feld)) {
      const s = schluessel(abschnitt);
      if (!ersetztHier.has(s) && !gesehen.has(s)) {
        gesehen.add(s);
        ergebnis.push(abschnitt);
      }
    }
  }
  return ergebnis;
}

/**
 * Was der Entwurf als `ocrAbschnitte` sichert: die gesicherten (beim Fortsetzen nicht wieder
 * sichtbar gewordenen) und die in den sichtbaren Feldern maßgeblichen Abschnitte — jeder einmal.
 */
export function ocrAbschnitteFuerEntwurf(
  gesichert: readonly OcrAbschnitt[],
  felder: SichtbareFelder,
  ersetzt: OcrErsetzt = [],
): OcrAbschnitt[] {
  const sichtbar = ocrAbschnitteDerFelder(felder, ersetzt);
  const imFeld = new Set(sichtbar.map(schluessel));
  const mitInhalt = gesichert.filter((a) => a.text.trim().length > 0);
  const unsichtbar = mitInhalt.filter((a) => !imFeld.has(schluessel(a)));
  return [...unsichtbar, ...sichtbar];
}

/**
 * Gesicherte Abschnitte, die NICHT schon in den wiederhergestellten Feldern stehen — so kommt beim
 * Fortsetzen nichts doppelt, und die sichtbaren Felder bleiben für ihre Abschnitte die Quelle.
 */
export function gesicherteOhneRohtext(
  gespeichert: readonly OcrAbschnitt[],
  felder: SichtbareFelder,
  ersetzt: OcrErsetzt = [],
): OcrAbschnitt[] {
  const imFeld = new Set(ocrAbschnitteDerFelder(felder, ersetzt).map(schluessel));
  return gespeichert.filter((a) => !imFeld.has(schluessel(a)));
}

/** Der Kontext für das Interview — leer, wenn kein erkannter Abschnitt mit Inhalt mehr dasteht. */
export function interviewKontext(
  felder: SichtbareFelder,
  gesichert: readonly OcrAbschnitt[] = [],
  ersetzt: OcrErsetzt = [],
): string {
  return ocrAbschnitteFuerEntwurf(gesichert, felder, ersetzt)
    .map((a) => `[${a.name}]\n${a.text.trim()}`)
    .join("\n\n");
}

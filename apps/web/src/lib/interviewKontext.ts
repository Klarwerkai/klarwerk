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

/**
 * Was der Entwurf als `ocrAbschnitte` sichert: die gesicherten (beim Fortsetzen ohne Rohtext
 * zurückgekommenen) und die im Rohtext stehenden Abschnitte.
 */
export function ocrAbschnitteFuerEntwurf(
  gesichert: readonly OcrAbschnitt[],
  raw: string,
): OcrAbschnitt[] {
  return [...gesichert.filter((a) => a.text.trim().length > 0), ...ocrAbschnitte(raw)];
}

/**
 * Gesicherte Abschnitte, die NICHT schon im wiederhergestellten Rohtext stehen — so kommt beim
 * Fortsetzen nichts doppelt, und der Rohtext bleibt für seine Abschnitte die Quelle.
 */
export function gesicherteOhneRohtext(
  gespeichert: readonly OcrAbschnitt[],
  raw: string,
): OcrAbschnitt[] {
  const imRohtext = new Set(ocrAbschnitte(raw).map((a) => `${a.name}\n${a.text}`));
  return gespeichert.filter((a) => !imRohtext.has(`${a.name}\n${a.text.trim()}`));
}

/** Der Kontext für das Interview — leer, wenn kein erkannter Abschnitt mit Inhalt mehr dasteht. */
export function interviewKontext(raw: string, gesichert: readonly OcrAbschnitt[] = []): string {
  return ocrAbschnitteFuerEntwurf(gesichert, raw)
    .map((a) => `[${a.name}]\n${a.text.trim()}`)
    .join("\n\n");
}

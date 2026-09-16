// ================================================================================================
// JOB 4203 · D3 — WAS IN DEN DREI REFERENZDATEIEN STEHT. VORHER AUFGESCHRIEBEN.
// ================================================================================================
//
// Diese Datei ist KEIN Test. Sie ist die eine Quelle für den ERWARTETEN Inhalt der drei
// Referenzdateien aus `tests/fixtures/` — und sie steht bewusst neben dem Erzeuger
// (`tests/fixtures/d3-referenz-erzeugen.mjs`) und nicht in ihm: ein erwarteter Wert, den man aus
// dem Ergebnis abliest, prüft nichts. Wer den Erzeuger ändert, muss die Konstanten hier von Hand
// nachziehen; genau dieser Handgriff ist die Prüfung.
//
// KEINE LOSEN ZEICHENKETTEN IM PRÜFSCHRITT (Auftrag §5.1): jeder Fall dieses Ordners vergleicht
// gegen die benannten Konstanten unten, nie gegen ein daneben getipptes Literal.
import type { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Die drei Dateiarten dieses Auftrags — mehr gibt es hier nicht (Auftrag §10: kein neues Format). */
export type Referenzart = "pdf" | "pptx" | "markdown";

interface Referenzdatei {
  /** Der Dateiname, unter dem ein Mensch die Datei wählt — er ist selbst ein Beleg (Herkunft). */
  readonly name: string;
  /** Der MIME-Typ, den ein Browser beim Wählen mitgibt. */
  readonly mime: string;
}

export const REFERENZ: Readonly<Record<Referenzart, Referenzdatei>> = {
  pdf: { name: "d3-referenz.pdf", mime: "application/pdf" },
  pptx: {
    name: "d3-referenz.pptx",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  markdown: { name: "d3-referenz.md", mime: "text/markdown" },
};

/** Die Bytes einer Referenzdatei — gelesen von der Platte, nicht erzeugt. */
export function referenzBytes(art: Referenzart): Buffer {
  return readFileSync(resolve(process.cwd(), "tests/fixtures", REFERENZ[art].name));
}

// ------------------------------------------------------------------------------------------------
// MARKDOWN
// ------------------------------------------------------------------------------------------------

export const MD_TITEL = "D3 Referenz Markdown";
export const MD_ABSCHNITT_EINS = "Abschnitt Eins Wartung";
export const MD_ABSCHNITT_ZWEI = "Abschnitt Zwei Pruefung";
export const MD_ABSATZ_ZEILEN = [
  "Vor der Wartung wird der Hauptschalter ausgeschaltet und",
  "gegen Wiedereinschalten gesichert.",
] as const;
export const MD_LISTENPUNKTE = [
  "Erster Aufzaehlungspunkt der Referenz",
  "Zweiter Aufzaehlungspunkt der Referenz",
] as const;
/** Die Kopfzeile der Pipe-Tabelle — zwei Spalten. */
export const MD_TABELLE_KOPF = ["Pruefschritt", "Ergebnis"] as const;
/**
 * Die drei Datenzeilen der Pipe-Tabelle — als ZELLEN, so wie sie im Entwurf stehen müssen.
 *
 * Die dritte Zeile ist der Prüfstein der Korrekturpflicht 1 (BEN zu Runde 1): in der Datei steht
 * `Ventil A\|B`, ein GESCHÜTZTER Strich innerhalb EINER Zelle. Erwartet sind zwei Zellen mit
 * `Ventil A|B` und `geprueft` — nicht drei mit `Ventil A\`, `B`, `geprueft`. Der Unterschied ist
 * nicht kosmetisch: bei drei Zellen steht unter „Ergebnis" das Wort „B".
 */
export const MD_TABELLE_ZEILEN = [
  ["Ventilprobe", "bestanden"],
  ["Dichtheit", "offen"],
  ["Ventil A|B", "geprueft"],
] as const;
/** Genau so steht die dritte Datenzeile in der Datei — mit Schutzzeichen. */
export const MD_TABELLE_ZEILE_MIT_SCHUTZ = "| Ventil A\\|B | geprueft |";
/**
 * Die ÜBERSCHRIFT, die OHNE Leerzeile unmittelbar auf die letzte Datenzeile folgt — und die einen
 * eigenen Strich trägt. Der Prüfstein der Korrekturpflicht 1 aus Runde 3: sie darf NICHT zur
 * Tabellenzeile werden, sonst stünde „Grenzfaelle" unter der Überschrift „Ergebnis".
 */
export const MD_UEBERSCHRIFT_MIT_STRICH = "## Abschnitt Drei | Grenzfaelle";
/**
 * Der Absatz, der OHNE Leerzeile unmittelbar auf die Tabelle folgt — der Prüfstein der
 * Korrekturpflicht 2 aus Runde 2. Er muss vollständig erhalten bleiben UND darf nicht in die
 * Tabelle geraten.
 */
export const MD_ABSATZ_NACH_TABELLE = "Direkt nach der Tabelle folgt dieser Absatz ohne Leerzeile.";

/**
 * Die vollständige Zellmatrix der Tabelle: Kopfzeile plus Datenzeilen.
 *
 * BEN hat in Runde 1 beanstandet, dass der Bedienwegnachweis nur Zelltexte einzeln suchte
 * („Vergleiche die Tabellen-Zellmatrix"). Eine Liste von Treffern sagt nichts über die ZUORDNUNG —
 * genau die war der Fehler. Verglichen wird ab jetzt die Matrix als Ganzes.
 */
export const MD_TABELLE_MATRIX: readonly (readonly string[])[] = [
  [...MD_TABELLE_KOPF],
  ...MD_TABELLE_ZEILEN.map((zeile) => [...zeile]),
];
/** Kommt in der ganzen Datei GENAU EINMAL vor — damit ein Treffer nichts anderes sein kann. */
export const MD_SUCHBEGRIFF = "MARKDOWNBELEG4203";

/** Der Klartext der Markdown-Referenz, so wie ihn `readTextFile` im Browser liefert. */
export function markdownText(): string {
  return referenzBytes("markdown").toString("utf8");
}

// ------------------------------------------------------------------------------------------------
// PDF
// ------------------------------------------------------------------------------------------------

/**
 * Die sechs Zeilen der PDF-Referenz, in Lesereihenfolge. Sie sind zugleich die Erwartung an die
 * Absatzrekonstruktion: Zeile 3 und 4 gehören zu EINEM Absatz (18 pt Abstand, genau auf der
 * Schwelle), alle übrigen Übergänge sind Absatzgrenzen (42 pt).
 */
export const PDF_ZEILEN = [
  "D3 Referenz PDF",
  "Abschnitt Eins Wartung",
  "Vor der Wartung wird der Hauptschalter ausgeschaltet und",
  "gegen Wiedereinschalten gesichert.",
  "Abschnitt Zwei Pruefung",
  "Der Suchbegriff PDFBELEG4203 kommt in dieser Datei genau einmal vor.",
] as const;
export const PDF_SUCHBEGRIFF = "PDFBELEG4203";
/**
 * Der Titel, den `wholeDocumentTitle` für dieses PDF bildet. KEIN Zufall und keine Schwäche des
 * Tests: ein PDF trägt keine Markdown-Überschrift, also greift der Dateinamen-Rückfall
 * (`captureFromFile.ts:327-347`, `titleFromFileName`). Das wird hier festgehalten, damit ein
 * stillschweigender Wechsel der Titelquelle auffällt.
 */
export const PDF_ENTWURFSTITEL = "d3 referenz";

// ------------------------------------------------------------------------------------------------
// PPTX
// ------------------------------------------------------------------------------------------------

export const PPTX_FOLIENTITEL = [
  "D3 Referenz Folie Eins",
  "D3 Referenz Folie Zwei",
  "D3 Referenz Folie Drei",
] as const;
export const PPTX_PUNKTE = [
  ["Ventil pruefen", "Dichtung tauschen"],
  ["Protokoll fuehren", "Abweichung melden"],
  ["Suchbegriff PPTXBELEG4203", "Freigabe einholen"],
] as const;
export const PPTX_SUCHBEGRIFF = "PPTXBELEG4203";
/**
 * Die Marke der EINEN Sprechernotiz im Deck. Sie darf im übernommenen Inhalt NIE auftauchen —
 * `PPTX_NEEDED_ENTRY_RE` (`apps/web/src/lib/pptx.ts:78`) lässt `ppt/notesSlides/**` gar nicht erst
 * ins Entpacken. Der Verlust ist damit strukturell; benannt wird er von `importNote.pptx`.
 */
export const PPTX_SPRECHERNOTIZ_MARKE = "SPRECHERNOTIZ4203";

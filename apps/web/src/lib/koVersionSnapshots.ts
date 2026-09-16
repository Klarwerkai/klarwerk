import type { HistoryEntry, KnowledgeType, KoVersionSnapshot } from "../api/types";
import { htmlToPlainText, isEmptyHtml } from "./richText";

// ==================================================================================================
// JOB 4213 · WIKI-NACHVOLLZIEHEN — DER EINE ORT, AN DEM DIE HERKUNFT VOM DRAHT GELESEN WIRD.
// ==================================================================================================
//
// WAS DER SERVER SCHREIBT: eine Fassung, die einen früheren Stand zurückholt, trägt in ihrem
// Historieneintrag zusätzlich `restoredFrom` — die Version, aus der ihr Inhalt stammt
// (`services/knowledge-object/src/types.ts`, `HistoryEntry`; geschrieben in `KoService.naechsteFassung`).
//
// WARUM HIER EIN ENGER CAST UND KEIN FELD IM CLIENT-TYP: `apps/web/src/api/types.ts` ist NICHT
// Zielpfad dieses Auftrags. Der Cast ist deshalb so schmal wie möglich — er behauptet über den
// Eintrag nichts, ausser dass dort ein Feld dieses Namens STEHEN KANN, und er prüft den Wert, statt
// ihm zu glauben. Kein `any`: der abgefragte Typ ist `unknown`, und nur eine echte Zahl kommt durch.
//
// „FEHLT" UND „KEINE ZAHL" SIND DASSELBE UND HEISSEN `null`: diese Fassung entstand nicht aus einer
// Übernahme. `0` wäre eine Aussage über eine Version, die es nicht gibt.
export function uebernahmeHerkunft(eintrag: HistoryEntry | undefined): number | null {
  const wert = (eintrag as { restoredFrom?: unknown } | undefined)?.restoredFrom;
  return typeof wert === "number" && Number.isInteger(wert) && wert >= 1 ? wert : null;
}

// ==================================================================================================
// JOB 3475 · UX-28 — DIE ZEILE EINER FASSUNG FÜHRT DEN GESPEICHERTEN BERICHT MIT.
// ==================================================================================================
//
// BIS HIERHER trug diese Zeile als einzigen Inhalt einen 139 Zeichen kurzen Auszug der Kernaussage.
// Der ausführliche Bericht (`bodyHtml`, `api/types.ts:337`) kam gar nicht vor — mit zwei Folgen, die
// Pedi an der Live-Fläche gemessen hat (Nutzungsprüfung 06.09., N-0055/N-0057): zwei Fassungen, die
// sich nur im Bericht unterscheiden, sahen zeichengleich aus, und der frühere 19.857-Zeichen-Bericht
// war über die Oberfläche überhaupt nicht erreichbar.
//
// DER SCHNAPPSCHUSS FÜHRT ALLES MIT, was dafür nötig ist: `KoVersionSnapshot.snapshot` ist ein
// VOLLES `KnowledgeObject` (`api/types.ts:136`), am Server als JSON-Tiefkopie des KO abgelegt
// (`services/knowledge-object/src/service.ts:774`) und ohne Projektion zurückgegeben
// (`repo-pg.ts:757-769` → `service.ts:3541` → `ko-routes.ts:938`). Diese Datei ERSCHLIESST also nur,
// was schon da ist; sie fügt nichts hinzu und rekonstruiert nichts.
export interface KoVersionSnapshotRow {
  key: string;
  version: number;
  at: string;
  author: string;
  note: string;
  title: string;
  status: string;
  /** Die Art dieser Fassung als SCHLÜSSEL (`ktype.<art>`), nicht als Anzeigetext. */
  type: KnowledgeType;
  /** Die gespeicherte Kernaussage dieser Fassung — ungekürzt, für den geöffneten Zustand. */
  statement: string;
  conditions: string[];
  measures: string[];
  excerpt: string;
  /**
   * Das ROH-HTML des gespeicherten Berichts DIESER Fassung; `""` heißt „für diese Fassung ist kein
   * ausführlicher Inhalt gespeichert". Gezeichnet wird es ausschließlich über `SanitizedHtml`.
   */
  berichtHtml: string;
  /**
   * Die GEMESSENE Länge dieses Berichts in Zeichen Klartext — die Angabe, an der ein Mensch zwei
   * Fassungen unterscheiden kann, deren Kernaussage gleich geblieben ist. Gemessen wird der Text,
   * nicht das Markup: die Länge des Roh-HTML wäre bei eingebetteten Bildern eine Zahl über
   * base64-Daten und keine Aussage über den Bericht.
   */
  berichtZeichen: number;
  /**
   * JOB 4213: die Fassung, aus der DIESER Stand zurückgeholt wurde — `null` heisst „diese Fassung
   * entstand nicht aus einer Übernahme".
   *
   * SIE WIRD GELESEN, NICHT GERECHNET: sie steht im Historieneintrag DIESER Version, den der
   * Schnappschuss mitführt, und kommt über `uebernahmeHerkunft` (oben) herein. Sie aus gleichen
   * Inhalten zu erraten wäre eine Behauptung — zwei Fassungen dürfen denselben Text tragen, ohne
   * dass eine aus der anderen stammt.
   */
  herkunft: number | null;
}

export function snapshotExcerpt(text: string, max = 140): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function koVersionRows(snapshots: readonly KoVersionSnapshot[]): KoVersionSnapshotRow[] {
  return [...snapshots]
    .sort((a, b) => b.version - a.version || b.at.localeCompare(a.at))
    .map((entry) => {
      // `isEmptyHtml` ist die EINE Hausregel dafür, ob HTML sichtbaren Inhalt trägt
      // (`richText.ts:462`): leere Absätze zählen nicht, ein reines Bild schon. Ein zweites
      // Leer-Urteil daneben wäre die Drift, die dieses Haus mehrfach eingesammelt hat.
      const berichtHtml = isEmptyHtml(entry.snapshot.bodyHtml)
        ? ""
        : (entry.snapshot.bodyHtml ?? "");
      const berichtText = berichtHtml ? htmlToPlainText(berichtHtml) : "";
      // Der Historieneintrag GENAU DIESER Version. Der Schnappschuss ist das volle Objekt in dem
      // Augenblick, in dem die Version entstand — sein letzter Historieneintrag ist also ihrer.
      // Gesucht wird trotzdem über die Versionsnummer und nicht über „der letzte": eine Ablage, die
      // aus irgendeinem Grund einen anderen Stand mitführte, ergäbe sonst eine falsche Herkunft.
      const eigenerEintrag = (entry.snapshot.history ?? []).find(
        (h) => h.version === entry.version,
      );
      return {
        key: `${entry.koId}:${entry.version}`,
        version: entry.version,
        at: entry.at,
        author: entry.author,
        note: entry.note,
        title: entry.snapshot.title || `v${entry.version}`,
        status: entry.snapshot.status,
        type: entry.snapshot.type,
        statement: entry.snapshot.statement,
        conditions: entry.snapshot.conditions ?? [],
        measures: entry.snapshot.measures ?? [],
        // ERSETZT die alte Bildung `statement || title`: fehlt die Kernaussage, tritt jetzt der
        // BERICHTSTEXT an ihre Stelle und erst danach der Titel — der Titel steht auf der Karte
        // ohnehin schon darüber und war als Auszug eine Wiederholung. `snapshotExcerpt` bleibt die
        // EINE Kürzungsregel; ein zweiter Kürzer entsteht hier nicht.
        excerpt: snapshotExcerpt(
          entry.snapshot.statement || berichtText || entry.snapshot.title || "",
        ),
        berichtHtml,
        berichtZeichen: berichtText.length,
        // Über den EINEN Leser oben — dieselbe Funktion, die auch die Historie auf der Lesefläche
        // benutzt. Ein zweiter Cast daneben wäre eine zweite Wahrheit über dasselbe Drahtfeld.
        herkunft: uebernahmeHerkunft(eigenerEintrag),
      };
    });
}

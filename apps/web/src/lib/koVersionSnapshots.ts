import type { KnowledgeType, KoVersionSnapshot } from "../api/types";
import { htmlToPlainText, isEmptyHtml } from "./richText";

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
      };
    });
}

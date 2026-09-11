// SCRUM-409 (PMO-FEA-0008-Delta, Paul 03.07.): Mehrpunkt-Wege für den Erzähl-Modus „Aus Datei".
// Bisher (PMO-FEA-0006): ausgewählte Punkte laufen als sichtbare Warteschlange EINZELN durch den
// Wizard. NEU dazu (nichts entfernt): (a) mehrere bestätigte Punkte als SEPARATE ENTWÜRFE in den
// bestehenden Draft-Pool (FE-CAP-07) speichern — je Entwurf mit sichtbarem Quellenvermerk im Body;
// (b) mehrere bestätigte Punkte VOR der Übernahme zu EINEM Eintrag zusammenführen — der Eintrag
// trägt ALLE Belegstellen (Body-Abschnitte je Punkt; add-source je Punkt über die SCRUM-408-
// Warteliste). Nichts wird automatisch gespeichert; jeder Weg ist ein bewusster Klick.
import type { DraftPayload, ExtractedPoint, StructureResult } from "../api/types";
import { type ExtractSectionLocale, extractSectionsHtml } from "./bodyExtract";

// Ein bestätigter Punkt → EIN Entwurf im bestehenden Draft-Format. Der Quellenvermerk
// (Belegstellen-Zitat + Dateiname) steht sichtbar im Body — kein verstecktes Metadatum.
export function draftPayloadFromPoint(
  point: ExtractedPoint,
  fileName: string,
  locale: ExtractSectionLocale = "de",
): DraftPayload {
  return {
    title: point.title,
    statement: point.summary,
    bodyHtml: extractSectionsHtml([point], fileName, locale),
  };
}

// Mehrere bestätigte Punkte → EIN zusammengeführter Wizard-Entwurf (StructureResult).
// Titel = erster Punkt; Kernaussage = Kurzfassungen der Punkte. Die Belegstellen kommen
// über extractSectionsHtml in den Body; die Quellen je Punkt vermerkt der Aufrufer
// (fileSourcePayload → Warteliste/add-source). Unter 2 Punkten gibt es nichts zu mergen.
export function mergedDraftFromPoints(
  points: readonly ExtractedPoint[],
  demo: boolean,
): StructureResult | null {
  const first = points[0];
  if (points.length < 2 || first === undefined) {
    return null;
  }
  return {
    title: first.title,
    statement: points
      .map((p) => p.summary.trim())
      .filter((s) => s.length > 0)
      .join(" "),
    conditions: [],
    measures: [],
    tags: [],
    confidence: 0,
    demo,
  };
}

// Entwürfe EINZELN anlegen — ein Teilfehler kippt nicht den ganzen Stapel (SCRUM-374-Muster);
// fehlgeschlagene Punkte werden ehrlich (per Titel) zurückgemeldet.
//
// JOB 3600: UND die gelungenen werden ehrlich zurückgemeldet — als die Punkte SELBST (`createdPoints`),
// nicht als Zahl und nicht als Titelliste. Bis hierher erfuhr der Aufrufer nur, WIE VIELE gelungen
// sind. Wer nach einem Teilfehler noch einmal anlief, lief deshalb wieder über ALLE Punkte und legte
// die bereits gespeicherten ein zweites Mal an (sichtbar in „Meine Entwürfe" als Doppelung, die
// niemand angelegt hat). `created` bleibt unverändert stehen — es wird ergänzt, nicht ersetzt.
//
// Der Typparameter trägt den Punkttyp des Aufrufers durch (z. B. `SelectableExtractPoint`): nur so
// sind die zurückgemeldeten Punkte IDENTISCH mit denen, die hineingegeben wurden, und der Aufrufer
// kann sie aus seiner eigenen Liste nehmen, ohne sie über Titel wiederzuerkennen. Titel sind dafür
// untauglich — zwei Punkte einer Datei dürfen denselben tragen.
export async function createPointDrafts<P extends ExtractedPoint>(
  points: readonly P[],
  fileName: string,
  locale: ExtractSectionLocale,
  create: (payload: DraftPayload) => Promise<unknown>,
): Promise<{ created: number; failed: string[]; createdPoints: P[] }> {
  let created = 0;
  const failed: string[] = [];
  const createdPoints: P[] = [];
  for (const point of points) {
    try {
      await create(draftPayloadFromPoint(point, fileName, locale));
      created += 1;
      createdPoints.push(point);
    } catch {
      failed.push(point.title);
    }
  }
  return { created, failed, createdPoints };
}

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
export async function createPointDrafts(
  points: readonly ExtractedPoint[],
  fileName: string,
  locale: ExtractSectionLocale,
  create: (payload: DraftPayload) => Promise<unknown>,
): Promise<{ created: number; failed: string[] }> {
  let created = 0;
  const failed: string[] = [];
  for (const point of points) {
    try {
      await create(draftPayloadFromPoint(point, fileName, locale));
      created += 1;
    } catch {
      failed.push(point.title);
    }
  }
  return { created, failed };
}

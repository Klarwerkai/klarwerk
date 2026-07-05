// Berater-Konzept 04.07. (Stufe 3): Verdrahtung der automatischen Konflikterkennung im App-Root.
// Hier — und NUR hier — treffen sich knowledge-object (Kandidaten), reasoner („Konfliktprüfung")
// und conflicts (Anlegen). So bleiben die Modulgrenzen sauber: conflicts kennt weder KO noch Reasoner,
// es bekommt modul-reine Kerntext-Subjekte + einen judge-Callback. Best-effort: ein Fehler in der
// Erkennung darf das Einreichen NIE kippen — das KO ist zu diesem Zeitpunkt bereits gespeichert.
import type { ConflictService, DetectSubject } from "../../conflicts";
import type { KnowledgeObject, KoService } from "../../knowledge-object";
import type { Reasoner } from "../../reasoner";

// K0-2: Erkennungs-Gegenstand ist der Kerntext (title+statement+conditions+measures), nicht bodyHtml.
function toDetectSubject(ko: KnowledgeObject): DetectSubject {
  return {
    refId: ko.id,
    title: ko.title,
    statement: ko.statement,
    conditions: ko.conditions,
    measures: ko.measures,
    category: ko.category,
    tags: ko.tags,
    asset: ko.asset,
  };
}

export interface ConflictDetectionDeps {
  ko: KoService;
  conflicts: ConflictService;
  reasoner: Reasoner;
}

// Prüft den frisch eingereichten Beitrag gegen den vorhandenen Bestand und legt erkannte
// Widersprüche automatisch als Konflikte an. Läuft in v1 synchron im Einreiche-Pfad; ohne
// verbundenes KI-Modell ist es ein stiller No-op (judge liefert null — keine Fake-Konflikte,
// K0-3: Demo-Beiträge bleiben außen vor). Wirft nie — Fehler bleiben ohne Wirkung auf das Einreichen.
export async function detectConflictsForKo(
  koId: string,
  deps: ConflictDetectionDeps,
): Promise<void> {
  try {
    const subject = await deps.ko.get(koId);
    if (!subject || subject.demoSeed) {
      return;
    }
    const pool = (await deps.ko.list())
      .filter((k) => k.id !== koId && !k.demoSeed)
      .map(toDetectSubject);
    if (pool.length === 0) {
      return;
    }
    await deps.conflicts.detectForSubject(toDetectSubject(subject), pool, (a, b) =>
      deps.reasoner.judgeConflict(a, b),
    );
  } catch {
    // Erkennung ist best-effort — Fehler werden bewusst geschluckt, das Einreichen bleibt erfolgreich.
  }
}

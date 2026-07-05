// Berater-Konzept Duplikate 04.07. (Stufe D3b): Verdrahtung der automatischen Überschneidungs-
// Erkennung im App-Root. Hier — und NUR hier — treffen sich knowledge-object (Kandidaten),
// reasoner („Duplikatprüfung") und conflicts/OverlapService (Anlegen). So bleiben die Modulgrenzen
// sauber: conflicts kennt weder KO noch Reasoner, es bekommt modul-reine Kerntext-Subjekte + einen
// judge-Callback. Best-effort: ein Fehler in der Erkennung darf das Einreichen NIE kippen — das KO
// ist zu diesem Zeitpunkt bereits gespeichert.
import {
  DEFAULT_OVERLAP_SETTINGS,
  type DetectSubject,
  type OverlapService,
  type OverlapSettingsRepo,
} from "../../conflicts";
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

export interface DuplicateDetectionDeps {
  ko: KoService;
  overlaps: OverlapService;
  reasoner: Reasoner;
  // Pedi 04.07.: einstellbare Anzeige-Schwelle (Admin). Ohne gesetzten Wert gilt der Startwert 0,5.
  settings: OverlapSettingsRepo;
}

// Prüft den frisch eingereichten Beitrag gegen den vorhandenen Bestand und legt erkannte
// Überschneidungen automatisch als Einträge an. Läuft in v1 synchron im Einreiche-Pfad. Sehr hohe
// Textdeckung → deterministischer Eintrag OHNE Modell (auch ohne KI erkennbar); mittlere Deckung →
// Modell-Profil (ohne Modell stiller No-op — keine Fake-Duplikate, K0-3: Demo-Beiträge bleiben
// außen vor). Wirft nie — Fehler bleiben ohne Wirkung auf das Einreichen.
export async function detectDuplicatesForKo(
  koId: string,
  deps: DuplicateDetectionDeps,
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
    // Pedi 04.07.: „jeder gegen jeden" — der gesamte Bestand ist der Kandidaten-Pool; die im Admin
    // gesetzte Schwelle entscheidet, ab welcher KI-Wahrscheinlichkeit ein Treffer angezeigt wird.
    const minConfidence =
      (await deps.settings.get())?.minConfidence ?? DEFAULT_OVERLAP_SETTINGS.minConfidence;
    await deps.overlaps.detectForSubject(
      toDetectSubject(subject),
      pool,
      (a, b) => deps.reasoner.judgeDuplicate(a, b),
      { minConfidence },
    );
  } catch {
    // Erkennung ist best-effort — Fehler werden bewusst geschluckt, das Einreichen bleibt erfolgreich.
  }
}

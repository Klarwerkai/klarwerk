// Berater-Konzept 04.07. (Stufe 3): Verdrahtung der automatischen Konflikterkennung im App-Root.
// Hier — und NUR hier — treffen sich knowledge-object (Kandidaten), reasoner („Konfliktprüfung")
// und conflicts (Anlegen). So bleiben die Modulgrenzen sauber: conflicts kennt weder KO noch Reasoner,
// es bekommt modul-reine Kerntext-Subjekte + einen judge-Callback. Best-effort: ein Fehler in der
// Erkennung darf das Einreichen NIE kippen — das KO ist zu diesem Zeitpunkt bereits gespeichert.
import type { ConflictService, DetectSubject } from "../../conflicts";
import { type KnowledgeObject, type KoService, isConfidential } from "../../knowledge-object";
import type { Reasoner } from "../../reasoner";

// K0-2: Erkennungs-Gegenstand ist der Kerntext (title+statement+conditions+measures), nicht bodyHtml.
// D-AISTATE PAKET 1 (bens V1): die Vertraulichkeits-MARKE (Boolean, kein Text) + die Inhaltsversion
// (PAKET 4/V5) reisen mit. Vertraulicher Text geht so NIE an die Cloud (der Reasoner nimmt sie bei
// einem vertraulichen Paar aus der Kette), aber die Erkennung überspringt vertrauliche Beiträge
// NICHT mehr pauschal — die (lokale, egress-freie) deterministische Ebene läuft immer.
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
    confidential: isConfidential(ko.confidentiality),
    ...(ko.version !== undefined ? { version: ko.version } : {}),
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
  // ben-Review #6: optionaler Log-Haken. Der Fehler bleibt geschluckt (best-effort), wird aber sichtbar,
  // wenn ein Aufrufer (z. B. der Import-Accept-Pfad) einen Logger reicht. Ohne → altes stilles Verhalten.
  log?: (msg: string, err: unknown) => void,
): Promise<void> {
  try {
    const subject = await deps.ko.get(koId);
    // Demo-Beiträge bleiben außen vor (K0-3). Ein VERTRAULICHES Subjekt überspringt die Erkennung
    // NICHT mehr (bens V1): die deterministische Ebene läuft, die Cloud bleibt gate-geschützt draußen.
    if (!subject || subject.demoSeed) {
      return;
    }
    // D-AISTATE PAKET 1 (bens V1): vertrauliche Kandidaten bleiben im Pool (gemischte Paare werden
    // verglichen) — die Vertraulichkeits-MARKE (toDetectSubject) sorgt dafür, dass die Cloud sie nie
    // sieht. Konflikte haben keine deterministische Ebene: ein vertrauliches Paar ohne lokales Modell
    // liefert kein Urteil (ehrlicher Status "confidential", kein Konflikt erfunden).
    const pool = (await deps.ko.list())
      .filter((k) => k.id !== koId && !k.demoSeed)
      .map(toDetectSubject);
    if (pool.length === 0) {
      return;
    }
    await deps.conflicts.detectForSubject(
      toDetectSubject(subject),
      pool,
      (a, b, confidential) => deps.reasoner.judgeConflict(a, b, "de", confidential),
      {
        // bens V2: KEIN stiller Cap 8 im Live-Pfad — jeder Kandidat wird dem Judge vorgelegt.
        cap: Number.POSITIVE_INFINITY,
        // bens V5: Stale-Schreibschutz — vor dem Persistieren beide gebundenen Versionen prüfen.
        isCurrent: async (id, version) => (await deps.ko.get(id))?.version === version,
      },
    );
  } catch (err) {
    // Erkennung ist best-effort — Fehler werden bewusst geschluckt, das Einreichen bleibt erfolgreich.
    log?.(`Konflikterkennung für KO ${koId} fehlgeschlagen`, err);
  }
}

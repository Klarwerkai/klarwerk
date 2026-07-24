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
  coreText,
} from "../../conflicts";
import type { EmbeddingProvider, EmbeddingStore } from "../../embedding";
import { type KnowledgeObject, type KoService, isConfidential } from "../../knowledge-object";
import type { Reasoner } from "../../reasoner";

// K0-2: Erkennungs-Gegenstand ist der Kerntext (title+statement+conditions+measures), nicht bodyHtml.
// D-AISTATE PAKET 1 (bens V1): Vertraulichkeits-MARKE (Boolean) + Inhaltsversion (PAKET 4/V5) reisen mit.
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

// Weg 3 (Prefilter, hinter Feature-Flag): Vektor-Store der Duplikat-Indizierung. Die Erzeugung/Ablage
// (indexKoForDuplicatePrefilter) bleibt bestehen; das VERENGEN des Erkennungs-Pools durch den Prefilter
// ist mit bens V2.2 (D-AISTATE) ENTFALLEN — die deterministische Deckungsprüfung darf nie beschnitten
// werden und ein Cloud-Embedder darf vertraulichen Subjekt-Text nie berühren.
export interface SemanticPrefilter {
  embedder: EmbeddingProvider;
  store: EmbeddingStore;
  topK: number;
}

export interface DuplicateDetectionDeps {
  ko: KoService;
  overlaps: OverlapService;
  reasoner: Reasoner;
  // Pedi 04.07.: einstellbare Anzeige-Schwelle (Admin). Ohne gesetzten Wert gilt der Startwert 0,5.
  settings: OverlapSettingsRepo;
  // Weg 3: nur für die Indizierung (indexKoForDuplicatePrefilter) relevant; die Erkennung nutzt IMMER
  // den Voll-Pool (bens V2.2). Feld bleibt für Rückwärtskompatibilität der Verdrahtung.
  semanticPrefilter?: SemanticPrefilter | undefined;
}

// Prüft den frisch eingereichten Beitrag gegen den vorhandenen Bestand und legt erkannte
// Überschneidungen automatisch als Einträge an. Läuft in v1 synchron im Einreiche-Pfad. Sehr hohe
// Textdeckung → deterministischer Eintrag OHNE Modell (auch ohne KI erkennbar); mittlere Deckung →
// Modell-Profil (ohne Modell stiller No-op — keine Fake-Duplikate, K0-3: Demo-Beiträge bleiben
// außen vor). Wirft nie — Fehler bleiben ohne Wirkung auf das Einreichen.
export async function detectDuplicatesForKo(
  koId: string,
  deps: DuplicateDetectionDeps,
  // ben-Review #6: optionaler Log-Haken (best-effort bleibt) — analog detectConflictsForKo.
  log?: (msg: string, err: unknown) => void,
): Promise<void> {
  try {
    const subject = await deps.ko.get(koId);
    // Demo-Beiträge bleiben außen vor (K0-3). Ein VERTRAULICHES Subjekt überspringt die Erkennung
    // NICHT mehr (bens V1): die (lokale, egress-freie) deterministische Deckungsprüfung läuft IMMER,
    // auch für vertrauliche Subjekte und gemischte Paare.
    if (!subject || subject.demoSeed) {
      return;
    }
    const subjectSubject = toDetectSubject(subject);
    // D-AISTATE PAKET 1+2 (bens V1/V2.2): der VOLLE Bestand ist der Pool — vertrauliche Kandidaten
    // bleiben drin (gemischte Paare werden deterministisch verglichen), ihre Vertraulichkeits-MARKE
    // hält die Cloud draußen. Der semantische Prefilter (Cloud-Embedder!) wird hier NICHT mehr zum
    // VERENGEN des Pools genutzt: er dürfte die deterministische Deckungsprüfung nie beschneiden und
    // für vertrauliche Subjekte nie den Embedder anfragen. Die Indizierung (indexKoForDuplicatePrefilter)
    // bleibt für andere Pfade bestehen; die VIP-Bestandsgröße trägt die Voll-Pool-Prüfung locker.
    const pool = (await deps.ko.list())
      .filter((k) => k.id !== koId && !k.demoSeed)
      .map(toDetectSubject);
    if (pool.length === 0) {
      return;
    }
    const minConfidence =
      (await deps.settings.get())?.minConfidence ?? DEFAULT_OVERLAP_SETTINGS.minConfidence;
    await deps.overlaps.detectForSubject(
      subjectSubject,
      pool,
      (a, b, confidential) => deps.reasoner.judgeDuplicate(a, b, "de", confidential),
      {
        minConfidence,
        // bens V5: Stale-Schreibschutz — vor dem Persistieren beide gebundenen Versionen prüfen.
        isCurrent: async (id, version) => (await deps.ko.get(id))?.version === version,
      },
    );
  } catch (err) {
    // Erkennung ist best-effort — Fehler werden bewusst geschluckt, das Einreichen bleibt erfolgreich.
    log?.(`Duplikaterkennung für KO ${koId} fehlgeschlagen`, err);
  }
}

// Repo-Idiom (seed.ts): schmaler, immer sichtbarer Log für best-effort-Betrieb (Fastify läuft ohne
// eigenen Logger). Bewusst kein Werfen.
function defaultLog(msg: string, err: unknown): void {
  console.warn(`[dup-prefilter] ${msg}`, err);
}

// Weg 3 (B6): bettet ein frisch angelegtes KO ein und legt es im Vektor-Store ab, damit KÜNFTIGE
// Beiträge es als semantischen Nachbarn finden. Läuft im Einreiche-Pfad NACH dem 201 (der Nutzer
// wartet nie darauf). Strikt best-effort: ohne aktiven Prefilter (Flag aus) ein No-op; jeder Fehler
// wird geloggt und geschluckt — der Submit darf NIE fehlschlagen. Das aktuelle KO braucht sich selbst
// nicht (der Prefilter nutzt excludeId), daher ist die Reihenfolge zum eigenen Submit unkritisch.
export async function indexKoForDuplicatePrefilter(
  ko: KnowledgeObject,
  semanticPrefilter: SemanticPrefilter | undefined,
  log: (msg: string, err: unknown) => void = defaultLog,
): Promise<void> {
  if (!semanticPrefilter) {
    return; // Flag aus → kein Embedden, alter Pfad bitidentisch.
  }
  if (ko.demoSeed) {
    return; // Demo-Beiträge bleiben außen vor (K0-3), wie bei der Erkennung selbst.
  }
  // SCRUM-502: vertrauliche KOs werden NIE eingebettet — der Embedder ist ein externer Kontext (heute
  // Stub, später echt). Kein Vektor, kein Egress. Bestehende Anzeige/Speicherung bleibt unberührt.
  if (isConfidential(ko.confidentiality)) {
    return;
  }
  try {
    const { vectors, embeddingVersion } = await semanticPrefilter.embedder.embed([
      coreText(toDetectSubject(ko)),
    ]);
    const vector = vectors[0];
    if (!vector) {
      return;
    }
    await semanticPrefilter.store.upsert(ko.id, vector, embeddingVersion);
  } catch (err) {
    // Niemals den Submit beeinflussen (läuft ohnehin nach dem 201) — ehrlich loggen und schlucken.
    log(`Embedden/Ablegen für KO ${ko.id} fehlgeschlagen`, err);
  }
}

// GDPR Art. 17 (Kaskadenlöschung, gdpr-compliance-runbook.md §3): Wird ein KO HART gelöscht (endgültig
// aus dem Bestand entfernt, nicht Papierkorb), muss ein evtl. abgelegter Embedding-Vektor mitgelöscht
// werden — sonst bliebe ein personenbezogen ableitbares Artefakt zurück. Strikt best-effort: ohne
// aktiven Prefilter (Flag aus) ein No-op; ein fehlender Eintrag ist ein No-op (idempotent); jeder
// Fehler wird geloggt und geschluckt — die Löschung selbst darf NIE daran scheitern.
export async function removeKoFromDuplicatePrefilter(
  koId: string,
  semanticPrefilter: SemanticPrefilter | undefined,
  log: (msg: string, err: unknown) => void = defaultLog,
): Promise<void> {
  if (!semanticPrefilter) {
    return; // Flag aus → nie etwas abgelegt, nichts zu löschen.
  }
  try {
    await semanticPrefilter.store.delete(koId);
  } catch (err) {
    // Die (harte) Löschung ist bereits geschehen — ein Store-Fehler darf sie nicht nachträglich kippen.
    log(`Embedding-Kaskadenlöschung für KO ${koId} fehlgeschlagen`, err);
  }
}

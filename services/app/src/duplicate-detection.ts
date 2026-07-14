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

// Weg 3 (Prefilter, hinter Feature-Flag): ersetzt den „jeder-gegen-jeden"-Pool durch die semantisch
// nächsten Top-K aus dem Vektor-Store. Optional — fehlt es, gilt das heutige Verhalten (Voll-Pool).
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
  // Weg 3: nur gesetzt, wenn KLARWERK_DUP_PREFILTER aktiv ist. Sonst undefined → Voll-Pool (Default).
  semanticPrefilter?: SemanticPrefilter | undefined;
}

// Wählt den Kandidaten-Pool. Default (kein Prefilter) = heutiges „jeder gegen jeden". Mit Prefilter:
// die semantisch nächsten Top-K aus dem Store. Voll-Pool-Fallback bei JEDEM Zweifel — leerer Store
// (noch nicht befüllt), leeres Ergebnis oder Fehler → voller Pool. So schwächt der Prefilter die
// Erkennung nie, er verengt sie nur, wenn er verlässlich engere Kandidaten liefert.
async function selectPool(
  subject: DetectSubject,
  candidates: DetectSubject[],
  excludeId: string,
  prefilter: SemanticPrefilter | undefined,
): Promise<DetectSubject[]> {
  if (!prefilter) {
    return candidates;
  }
  try {
    const { vectors, embeddingVersion } = await prefilter.embedder.embed([coreText(subject)]);
    const query = vectors[0];
    if (!query) {
      return candidates;
    }
    const hits = await prefilter.store.nearest(query, embeddingVersion, prefilter.topK, excludeId);
    const ids = new Set(hits.map((h) => h.id));
    const narrowed = candidates.filter((c) => ids.has(c.refId));
    // Leerer semantischer Pool (Store in dieser Ausbaustufe noch nicht befüllt) → Voll-Pool-Fallback.
    return narrowed.length > 0 ? narrowed : candidates;
  } catch {
    // Fehler im Embedding/Store → Voll-Pool-Fallback (Erkennung bleibt best-effort und vollständig).
    return candidates;
  }
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
    const subjectSubject = toDetectSubject(subject);
    const candidates = (await deps.ko.list())
      .filter((k) => k.id !== koId && !k.demoSeed)
      .map(toDetectSubject);
    if (candidates.length === 0) {
      return;
    }
    // Pedi 04.07.: „jeder gegen jeden" ist der Default-Pool. Weg 3 (hinter Feature-Flag): der Prefilter
    // verengt ihn auf die semantisch nächsten Top-K; die Admin-Schwelle entscheidet unverändert, ab
    // welcher KI-Wahrscheinlichkeit ein Treffer angezeigt wird.
    const pool = await selectPool(subjectSubject, candidates, koId, deps.semanticPrefilter);
    if (pool.length === 0) {
      return;
    }
    const minConfidence =
      (await deps.settings.get())?.minConfidence ?? DEFAULT_OVERLAP_SETTINGS.minConfidence;
    await deps.overlaps.detectForSubject(
      subjectSubject,
      pool,
      (a, b) => deps.reasoner.judgeDuplicate(a, b),
      { minConfidence },
    );
  } catch {
    // Erkennung ist best-effort — Fehler werden bewusst geschluckt, das Einreichen bleibt erfolgreich.
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

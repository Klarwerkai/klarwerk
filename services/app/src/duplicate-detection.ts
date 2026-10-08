// Berater-Konzept Duplikate 04.07. (Stufe D3b): Verdrahtung der automatischen Überschneidungs-
// Erkennung im App-Root. Hier — und NUR hier — treffen sich knowledge-object (Kandidaten),
// reasoner („Duplikatprüfung") und conflicts/OverlapService (Anlegen). So bleiben die Modulgrenzen
// sauber: conflicts kennt weder KO noch Reasoner, es bekommt modul-reine Kerntext-Subjekte + einen
// judge-Callback. Best-effort: ein Fehler in der Erkennung darf das Einreichen NIE kippen — das KO
// ist zu diesem Zeitpunkt bereits gespeichert.
import {
  DEFAULT_OVERLAP_SETTINGS,
  type DetectSubject,
  type DetectionCoverage,
  type OverlapService,
  type OverlapSettingsRepo,
  coreText,
  emptyCoverage,
} from "../../conflicts";
import type { EmbeddingProvider, EmbeddingStore } from "../../embedding";
import { type KnowledgeObject, type KoService, isConfidential } from "../../knowledge-object";
import type { Reasoner } from "../../reasoner";
import { comparisonFailureReason } from "./conflict-detection";
import { DETECTION_CANDIDATE_CAP } from "./detection-cap";

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
// AUFTRAG-mega28 A2/A3: gibt die ABDECKUNG des Laufs zurück (s. detectConflictsForKo). Wichtig
// gerade hier: der Duplikatweg reicht einen ModelCapacityError bewusst DURCH die Erkennung — das
// Protokoll wird deshalb vom Lauf fortgeschrieben und nicht erst am Ende gebaut.
export async function detectDuplicatesForKo(
  koId: string,
  deps: DuplicateDetectionDeps,
  // ben-Review #6: optionaler Log-Haken (best-effort bleibt) — analog detectConflictsForKo.
  log?: (msg: string, err: unknown) => void,
): Promise<DetectionCoverage> {
  const coverage = emptyCoverage();
  try {
    const subject = await deps.ko.get(koId);
    // Demo-Beiträge bleiben außen vor (K0-3). Ein VERTRAULICHES Subjekt überspringt die Erkennung
    // NICHT mehr (bens V1): die (lokale, egress-freie) deterministische Deckungsprüfung läuft IMMER,
    // auch für vertrauliche Subjekte und gemischte Paare.
    // R-1107: ein AUFGEGANGENER Artikel (`mergedInto`) ist weder Subjekt noch Kandidat. Sein Inhalt
    // lebt im Führungsartikel weiter; ein neuer Befund „Führungsartikel ⇄ aufgegangener" wäre genau
    // das Paar, das gerade bewusst zusammengeführt wurde.
    if (!subject || subject.demoSeed || subject.mergedInto) {
      return coverage; // gar kein Lauf — ehrlich „nichts stand zur Wahl", nicht „gedeckelt"
    }
    const subjectSubject = toDetectSubject(subject);
    // D-AISTATE PAKET 1+2 (bens V1/V2.2): der VOLLE Bestand ist der Pool — vertrauliche Kandidaten
    // bleiben drin (gemischte Paare werden deterministisch verglichen), ihre Vertraulichkeits-MARKE
    // hält die Cloud draußen. Der semantische Prefilter (Cloud-Embedder!) wird hier NICHT mehr zum
    // VERENGEN des Pools genutzt: er dürfte die deterministische Deckungsprüfung nie beschneiden und
    // für vertrauliche Subjekte nie den Embedder anfragen. Die Indizierung (indexKoForDuplicatePrefilter)
    // bleibt für andere Pfade bestehen; die VIP-Bestandsgröße trägt die Voll-Pool-Prüfung locker.
    // R-0194: derselbe Pool speist die Ähnlichkeitsprüfsumme in detectForSubject — Demo-Seed und
    // das Objekt selbst bleiben ihr damit ebenso fern wie dem Trigramm-Rang.
    const pool = (await deps.ko.list())
      .filter((k) => k.id !== koId && !k.demoSeed && !k.mergedInto)
      .map(toDetectSubject);
    if (pool.length === 0) {
      // R-0194 (bens Befund zu K3): auch ohne Vergleichspartner ist das eine Anlage bzw. Änderung —
      // die lokale Prüfsumme des (nicht-Demo-)Subjekts wird gepflegt. Kein Vergleich, kein Modell.
      deps.overlaps.checksums.upsert(subjectSubject);
      return coverage;
    }
    const minConfidence =
      (await deps.settings.get())?.minConfidence ?? DEFAULT_OVERLAP_SETTINGS.minConfidence;
    await deps.overlaps.detectForSubject(
      subjectSubject,
      pool,
      async (a, b, confidential) => {
        const outcome = await deps.reasoner.judgeDuplicateOutcome(a, b, "de", confidential);
        return { verdict: outcome.verdict, failureReason: comparisonFailureReason(outcome) };
      },
      {
        minConfidence,
        // AUFTRAG-mega28 A1 (Pedi 26.07.): Hier stand bis mega27 GAR KEIN cap — der Weg legte den
        // vollen Bestand vor. Jetzt gilt derselbe Deckel wie im Konfliktweg (EIN Wert, s.
        // detection-cap.ts), und die Kandidatenwahl davor ist deterministisch nach dem lexikalischen
        // Deckungsmaß sortiert (selectOverlapCandidates), nicht nach Datenbank-Zeilenreihenfolge.
        cap: DETECTION_CANDIDATE_CAP,
        // bens V5: Stale-Schreibschutz — vor dem Persistieren beide gebundenen Versionen prüfen.
        isCurrent: async (id, version) => (await deps.ko.get(id))?.version === version,
        coverage,
      },
    );
  } catch (err) {
    // Erkennung ist best-effort — Fehler werden bewusst geschluckt, das Einreichen bleibt erfolgreich.
    // AUFTRAG-mega28 A3: der Kapazitätsabbruch (ModelCapacityError) landet GENAU HIER und sah bisher
    // aus wie ein sauberer Lauf. detectForSubject hat das Protokoll vor dem Werfen fortgeschrieben
    // (aborted + Stand); der Sicherheitsnetz-Setzer deckt jeden anderen Weg hierher ab.
    coverage.aborted = true;
    log?.(`Duplikaterkennung für KO ${koId} fehlgeschlagen`, err);
  }
  return coverage;
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

// ================================================================================================
// R-0195 / R-0470 / R-0483 (Aufnahme gesamt-suchindex-aktualitaet) — DER VEKTOR FOLGT DEM OBJEKT.
// ================================================================================================
//
// Bis hierher entstand ein Vektor genau einmal, beim Einreichen, und verschwand nur bei der
// Endlöschung. Eine Überarbeitung liess den alten Stand im Speicher stehen; ein heraufgestuftes,
// zurückgezogenes oder aufgegangenes Objekt blieb als Nachbar auffindbar.
//
// Diese Funktion ist der EINE Eintrag, den die Reindex-Warteschlange (reindex-queue.ts) je
// Änderung abarbeitet. Sie liest das Objekt FRISCH (nicht den Stand des Aufrufers) und entscheidet:
//   · kein lebendes Objekt mehr (Papierkorb, endgelöscht), aufgegangen (`mergedInto`), vertraulich
//     oder Demo  →  der Vektor wird ENTFERNT (verdrängt, nicht ergänzt; vertraulich verlässt den
//     Index, sobald die Stufe steigt);
//   · sonst  →  der Kerntext wird neu eingebettet — aber nur, wenn er sich seit der letzten Ablage
//     geändert hat (`zuletzt`), damit eine Bewertung oder ein Kommentar keinen Embedder-Aufruf kostet.
// Fehler wirft sie weiter: die Warteschlange isoliert und meldet sie (`onError` ist dort Pflicht).
function vektorBleibtFuer(ko: KnowledgeObject | undefined): ko is KnowledgeObject {
  return (
    ko !== undefined &&
    !ko.deletedAt &&
    !ko.mergedInto &&
    !ko.demoSeed &&
    !isConfidential(ko.confidentiality)
  );
}

export async function reindexKoForDuplicatePrefilter(
  koId: string,
  deps: {
    ko: Pick<KoService, "get">;
    semanticPrefilter: SemanticPrefilter;
    // Kerntext je Kennung bei der letzten Ablage durch DIESEN Weg — gehört dem Aufrufer, damit er
    // die Lebensdauer bestimmt (eine Warteschlange, eine Merkliste).
    zuletzt: Map<string, string>;
  },
): Promise<void> {
  const { semanticPrefilter, zuletzt } = deps;
  const ko = await deps.ko.get(koId);
  if (!vektorBleibtFuer(ko)) {
    zuletzt.delete(koId);
    await semanticPrefilter.store.delete(koId);
    return;
  }
  const text = coreText(toDetectSubject(ko));
  if (zuletzt.get(koId) === text) {
    return;
  }
  const { vectors, embeddingVersion } = await semanticPrefilter.embedder.embed([text]);
  const vector = vectors[0];
  if (!vector) {
    // Kein Vektor für den neuen Stand: der alte darf nicht als „aktuell" stehen bleiben.
    zuletzt.delete(koId);
    await semanticPrefilter.store.delete(koId);
    return;
  }
  await semanticPrefilter.store.upsert(koId, vector, embeddingVersion);
  zuletzt.set(koId, text);
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

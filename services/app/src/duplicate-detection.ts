// Berater-Konzept Duplikate 04.07. (Stufe D3b): Verdrahtung der automatischen Überschneidungs-
// Erkennung im App-Root. Hier — und NUR hier — treffen sich knowledge-object (Kandidaten),
// reasoner („Duplikatprüfung") und conflicts/OverlapService (Anlegen). So bleiben die Modulgrenzen
// sauber: conflicts kennt weder KO noch Reasoner, es bekommt modul-reine Kerntext-Subjekte + einen
// judge-Callback. Best-effort: ein Fehler in der Erkennung darf das Einreichen NIE kippen — das KO
// ist zu diesem Zeitpunkt bereits gespeichert.
import { createHash } from "node:crypto";
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
import { type PruefUmfang, vergleichsDeckel } from "./detection-cap";

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
  // AUFNAHME 20260922 · R-1124: `vollstaendig` nur auf ausdrückliche Wahl (s. detection-cap.ts).
  umfang: PruefUmfang = "gedeckelt",
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
        // R-1124: im gewählten Vollabgleich ohne Deckel. Einen fachlichen Vorfilter hat dieser
        // Weg nicht (selectOverlapCandidates) — ohne Deckel ist das der ganze Pool.
        cap: vergleichsDeckel(umfang),
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
  // R-0623: nur die Fehlerklasse — Meldung und Stack können Inhalte tragen.
  console.warn(`[dup-prefilter] ${msg}: ${err instanceof Error ? err.name : "unknown"}`);
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
    // R-0470: mit Stand, damit die Nachführung nach einem Neustart diesen Vektor als passend erkennt.
    await semanticPrefilter.store.upsert(ko.id, vector, embeddingVersion, kerntextStand(ko));
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
//     oder Demo  →  der Vektor wird ENTFERNT (verdrängt, nicht ergänzt);
//   · sonst  →  der Kerntext wird neu eingebettet — aber nur, wenn sein Fingerabdruck (`stand`) vom
//     abgelegten abweicht, damit eine Bewertung oder ein Kommentar keinen Embedder-Aufruf kostet.
//     Der Stand liegt IM Speicher, nicht im Prozess: nach einem Neustart gilt er weiter.
// Fehler wirft sie weiter: die Warteschlange isoliert und meldet sie (`onError` ist dort Pflicht).
//
// BEN, NACHARBEIT 3 — EINE LAUFENDE EINBETTUNG SCHREIBT KEINEN ÜBERHOLTEN STAND. Zwischen dem
// Lesen und dem Ablegen liegt das Warten auf den Embedder. Steigt in dieser Zeit die Stufe, darf der
// vorher gelesene öffentliche Stand nicht mehr geschrieben werden. Deshalb wird nach dem Einbetten
// frisch gelesen, bevor geschrieben wird, und nach dem Schreiben noch einmal: hat der sofortige
// Entzug (`setAenderungsNachlauf` in build-app.ts) schon vor unserem Schreiben gelöscht, löscht
// diese zweite Prüfung den eben geschriebenen Vektor wieder. Die Heraufstufung ist gespeichert,
// bevor ihr Entzug läuft — die Prüfung nach dem Schreiben sieht sie also in jedem Fall.
export function vektorBleibtFuer(ko: KnowledgeObject | undefined): ko is KnowledgeObject {
  return (
    ko !== undefined &&
    !ko.deletedAt &&
    !ko.mergedInto &&
    !ko.demoSeed &&
    !isConfidential(ko.confidentiality)
  );
}

/** Der Fingerabdruck des eingebetteten Kerntexts — eine Prüfsumme, kein Inhalt. */
function kerntextStand(ko: KnowledgeObject): string {
  return createHash("sha256")
    .update(coreText(toDetectSubject(ko)))
    .digest("hex");
}

export async function reindexKoForDuplicatePrefilter(
  koId: string,
  deps: { ko: Pick<KoService, "get">; semanticPrefilter: SemanticPrefilter },
): Promise<void> {
  const { store, embedder } = deps.semanticPrefilter;
  const ko = await deps.ko.get(koId);
  if (!vektorBleibtFuer(ko)) {
    await store.delete(koId);
    return;
  }
  const stand = kerntextStand(ko);
  const abgelegt = await store.standVon(koId);
  // NACHGEFÜHRT WIRD, WAS IM INDEX STEHT — es wird nichts NEU aufgenommen. Ob ein Objekt überhaupt
  // eingebettet wird, entscheidet weiter der Einreicheweg (`indexKoForDuplicatePrefilter`); der
  // Bulk-Import und alle Antwortwege betten bewusst nicht ein (Kosten, Datenabfluss —
  // tests/library/import-json-zero-model-calls.test.ts). Diese Nachführung hält das ein.
  if (abgelegt === undefined || abgelegt === stand) {
    return;
  }
  const { vectors, embeddingVersion } = await embedder.embed([coreText(toDetectSubject(ko))]);
  const vector = vectors[0];
  // Frisch gelesen VOR dem Schreiben: was während des Einbettens geschah, gewinnt.
  const vorDemSchreiben = await deps.ko.get(koId);
  if (!vektorBleibtFuer(vorDemSchreiben)) {
    await store.delete(koId);
    return;
  }
  if (kerntextStand(vorDemSchreiben) !== stand) {
    // Ein neuerer Text ist gespeichert — und hat seinen eigenen Eintrag in der Schlange.
    return;
  }
  if (!vector) {
    // Kein Vektor für den neuen Stand: der alte darf nicht als „aktuell" stehen bleiben.
    await store.delete(koId);
    return;
  }
  await store.upsert(koId, vector, embeddingVersion, stand);
  // Und NACH dem Schreiben: eine Heraufstufung, deren Entzug unserem Schreiben zuvorkam.
  if (!vektorBleibtFuer(await deps.ko.get(koId))) {
    await store.delete(koId);
  }
}

/**
 * Der Speicher, den die Kompositionswurzel an ALLE Schreiber reicht — auch an den Einreicheweg
 * (`indexKoForDuplicatePrefilter`), der den Vektor aus dem Objekt des Aufrufers baut. Jede Ablage
 * prüft danach das lebende Objekt; darf es keinen Vektor mehr tragen (inzwischen heraufgestuft,
 * zurückgezogen, aufgegangen), wird der eben geschriebene Vektor sofort wieder entfernt.
 *
 * BEN, NACHARBEIT 5 — AUCH DIE ERSTINDIZIERUNG KANN ÜBERHOLT SEIN. Der Einreicheweg bettet den Text
 * des Objekts ein, das er beim Anlegen in der Hand hatte. Wird es überarbeitet, während diese erste
 * Einbettung noch wartet, findet der Eintrag der Schlange noch keinen Vektor und endet (es wird
 * nichts NEU aufgenommen) — danach schrieb die Erstindizierung den alten Text, und er blieb stehen.
 * Jetzt vergleicht jede Ablage ihren Stand mit dem heutigen Kerntext; weicht er ab, wird das Objekt
 * über `nachfuehren` (die Warteschlange) eingereiht. Weil jetzt ein Vektor steht, führt der Eintrag
 * ihn auf den neuen Text nach. Für nie eingebettete Objekte ändert sich nichts: ohne Ablage kein
 * Vergleich, keine Nachführung.
 */
export function gesicherterVektorspeicher(
  store: EmbeddingStore,
  ko: Pick<KoService, "get">,
  nachfuehren: (koId: string) => void = () => undefined,
): EmbeddingStore {
  return {
    async upsert(id, vector, embeddingVersion, stand) {
      await store.upsert(id, vector, embeddingVersion, stand);
      const jetzt = await ko.get(id);
      if (!vektorBleibtFuer(jetzt)) {
        await store.delete(id);
        return;
      }
      if (stand !== undefined && stand !== kerntextStand(jetzt)) {
        nachfuehren(id);
      }
    },
    nearest: (query, embeddingVersion, topK, excludeId) =>
      store.nearest(query, embeddingVersion, topK, excludeId),
    delete: (id) => store.delete(id),
    standVon: (id) => store.standVon(id),
    staende: () => store.staende(),
  };
}

/**
 * BEN, NACHARBEIT 5 — DER ENTZUG HÄNGT NICHT AM SCHALTER.
 *
 * Ist der Vorfilter aus, wird nichts eingebettet — aber der dauerhafte Speicher kann Vektoren aus
 * einer Zeit tragen, in der er an war. Für sie gilt R-0470/R-0483 weiter: ein heraufgestuftes,
 * zurückgezogenes, aufgegangenes oder gelöschtes Objekt verliert seinen Vektor. Diese Funktion ist
 * der Abgleich beim Start für genau diesen Betriebszustand: sie ENTFERNT nur (kein Embedder, kein
 * Modell, keine Schlange). Den sofortigen Entzug bei einer Änderung leistet der Nachlauf in
 * build-app.ts. Rückgabe: die Zahl der entfernten Vektoren (keine Inhalte).
 */
export async function entzugNachStart(deps: {
  ko: Pick<KoService, "list">;
  store: EmbeddingStore;
}): Promise<number> {
  const abgelegt = await deps.store.staende();
  if (abgelegt.size === 0) {
    return 0;
  }
  const zulaessig = new Set(
    (await deps.ko.list()).filter((ko) => vektorBleibtFuer(ko)).map((ko) => ko.id),
  );
  let entfernt = 0;
  for (const id of abgelegt.keys()) {
    if (!zulaessig.has(id)) {
      await deps.store.delete(id);
      entfernt += 1;
    }
  }
  return entfernt;
}

/**
 * R-0470 — DIE NACHFÜHRUNG ÜBERLEBT DEN NEUSTART.
 *
 * Die Warteschlange lebt im Prozess; stirbt er, sind wartende Einträge weg. Statt sie zusätzlich
 * zu speichern, wird beim Start der Bestand gegen den dauerhaften Speicher gehalten: jeder
 * abgelegte Vektor, dessen Stand nicht zum heutigen Kerntext passt, jeder Vektor eines Objekts, das
 * keinen tragen darf, und jeder Vektor ohne lebendes Objekt wird eingereiht. Damit ist jede vor dem
 * Neustart unterbrochene Änderung nachgeholt — auch eine, die nie eingereiht wurde. Objekte ohne
 * Vektor bleiben ohne (s. `reindexKoForDuplicatePrefilter`). Rückgabe: die Zahl der eingereihten
 * Kennungen (keine Inhalte).
 */
export async function nachfuehrungNachStart(deps: {
  ko: Pick<KoService, "list">;
  store: EmbeddingStore;
  enqueue: (koId: string) => void;
}): Promise<number> {
  const abgelegt = await deps.store.staende();
  const offen = new Set<string>();
  for (const ko of await deps.ko.list()) {
    if (!abgelegt.has(ko.id)) {
      continue;
    }
    const stand = abgelegt.get(ko.id);
    abgelegt.delete(ko.id);
    if (!vektorBleibtFuer(ko) || stand !== kerntextStand(ko)) {
      offen.add(ko.id);
    }
  }
  // Was jetzt noch übrig ist, hat kein lebendes Objekt mehr (Papierkorb, Endlöschung).
  for (const id of abgelegt.keys()) {
    offen.add(id);
  }
  for (const id of offen) {
    deps.enqueue(id);
  }
  return offen.size;
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

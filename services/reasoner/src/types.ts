// SCRUM-88 / FR-I18N-01: sprachbewusste Reasoner-Steuerung. Nur DE/EN; Default "de".
// Steuert Prompting, Interview-Fragen und Step-Labels — NICHT den Quelleninhalt.
export type ReasonerLocale = "de" | "en";

// Minimaler Wissens-Bezug (entkoppelt: reasoner kennt knowledge-object nicht direkt).
export interface KnowledgeRef {
  id: string;
  title: string;
  statement: string;
  status: "offen" | "validiert";
  trust: number;
  // WP-RETEST7 R5 (Pedis Befund: Fragen findet Fußnotentext nicht): die persistierten Bild-
  // Fußnoten (captionTexts-Suchfeld, WP-BILD-1g) fließen ADDITIV in Matching/Ranking ein —
  // KEIN bodyHtml, kein neuer Scanner; Altbestand ohne Feld matcht wie bisher.
  captionTexts?: readonly string[];
}

// FR-RSN-03: Trennung gesichert / ungeprüft / Meinung / extern / Annahme / unbekannt.
export type KnowledgeClass =
  | "gesichert"
  | "ungeprueft"
  | "meinung"
  | "extern"
  | "annahme"
  | "unbekannt";

export interface AnswerStep {
  description: string;
  sourceId: string | null;
  snippet: string | null; // FR-ASK-06: konkrete Belegstelle/Textstelle der Quelle.
}

export interface AnswerResult {
  answered: boolean;
  answer: string | null;
  knowledgeClass: KnowledgeClass;
  trust: number;
  sources: string[];
  steps: AnswerStep[];
  demo: boolean; // FR-RSN-04: ohne Modell als Demo erkennbar.
}

export interface StructureResult {
  title: string;
  statement: string;
  conditions: string[];
  measures: string[];
  tags: string[];
  confidence: number;
  demo: boolean;
  // WP-D8 (Pedis Live-ROT B): WARUM lief der deterministische Fallback? demo:true allein verschluckte
  // drei verschiedene Ursachen — die UI konnte nur ein erklärungsloses FALLBACK-Badge zeigen.
  //  - "no-model": kein Modell in der Kette (kein Cloud-Key konfiguriert ODER Policy deterministisch).
  //  - "model-timeout": ein Modell wurde versucht, überschritt aber das Zeitlimit (WP-D10 Fix 3 —
  //    vorher im Sammelbegriff "model-error" verschluckt).
  //  - "model-error": ein Modell wurde versucht, scheiterte aber (HTTP/Quota/Netz/Parse) → Kette fiel durch.
  // Nur bei demo:true gesetzt; PII-frei (nie Eingabetext).
  fallbackReason?: "no-model" | "model-timeout" | "model-error";
}

// FR-RSN-03: sprachliche Präzisierung/Glättung eines Textes (ohne Inhalt zu erfinden).
export interface AssistResult {
  text: string;
  demo: boolean;
}

// SCRUM-132: reasoner-getriebenes Interview. Stateless: Antworten rein, nächste Frage +
// aus den Antworten verdichteter Entwurf raus. Eine Frage pro Turn. demo=true → Fallback.
export interface InterviewResult {
  question: string | null; // nächste Frage; null, wenn ausreichend Inhalt
  done: boolean; // Abschluss erreicht
  draft: StructureResult; // nachvollziehbar aus den Antworten verdichtet
  demo: boolean; // deterministischer Fallback klar markiert
}

// PMO-FEA-0006: ein aus einem Dokument extrahierter Wissenspunkt. sourceExcerpt ist die
// wörtliche Belegstelle aus dem Dokument (G-2: nur was im Text steht, nichts erfinden).
export interface ExtractedPoint {
  title: string; // die Aussage in einem Satz
  summary: string; // Kurzfassung des Wissenspunkts
  sourceExcerpt: string; // wörtlicher Auszug aus dem Dokument als Beleg
}

// PMO-FEA-0006: Ergebnis der Wissens-Extraktion aus Dokumenttext. Ohne Modell gibt es
// KEINE Fake-Punkte — points bleibt leer und note erklärt ehrlich warum (FR-RSN-04/G-2).
// SCRUM-426: Public-KI-Anreicherung — bewusst NICHT quellengebundener Modell-Beitrag
// (Weltwissen), klar als extern/ungeprüft zu behandeln. Ohne Modell: leer + demo=true.
export interface EnrichResult {
  text: string;
  provider: string;
  demo: boolean;
}

export interface ExtractResult {
  points: ExtractedPoint[];
  note: string | null; // ehrliche Erklärung, wenn keine Punkte geliefert werden können
  demo: boolean; // true = deterministischer Fallback (kein Modell)
}

export interface ReasonerStatus {
  active: boolean; // FR-RSN-05: spiegelt tatsächliche Modell-Verfügbarkeit.
  provider: string;
  mode: "model" | "deterministic";
}

// SCRUM-166: read-only Provider-/Model-Konfigurationssicht. Nur technische Metadaten —
// KEINE Secrets/API-Keys, keine Prompt-/Antwortinhalte. provider/model sind Anzeige-Labels.
export type ReasonerConfigMode = "model" | "fallback" | "demo";
// WP-BILD-1c: describe (KI-Bildbeschreibungs-Vorschlag) als eigene, in der KI-Verwaltung sichtbare
// Aufgabe. NUR der Cloud-Client hat einen Bild-Eingang — lokale/deterministische Glieder liefern
// ehrlich keinen Text (nie erfinden).
// WP-IC-4: group (KI-Gruppierung der Import-Kandidaten) als weitere, in der KI-Verwaltung
// sichtbare Aufgabe — mit ehrlichem deterministischem Themen-Fallback (der Flow bleibt benutzbar).
export type ReasonerTask =
  | "structure"
  | "assist"
  | "interview"
  | "answer"
  | "select"
  | "extract"
  | "describe"
  | "group";

// KI-Verwaltung (Pedi 02./03.07.): je Aufgabe bewusst wählen.
//  - "auto"          Cloud → lokal → deterministisch (was verfügbar ist, in dieser Reihenfolge)
//  - "cloud"         das Cloud-Modell verlangen (ehrlicher Fallback, wenn nicht verfügbar)
//  - "local"         den EIGENEN lokalen LLM verlangen (SCRUM-424; ehrlicher Fallback)
//  - "model"         Alias für "cloud" (Rückwärtskompatibilität)
//  - "deterministic" bewusst ohne Modell
export type ReasonerTaskChoice = "auto" | "model" | "cloud" | "local" | "deterministic";

// SCRUM-525 P.5 (WP-C): Herkunft der AKTIVEN Policy — "env" (Deploy-ENV KLARWERK_REASONER_POLICY,
// deklarativ pro Deploy, per Admin-Schreibpfad NICHT änderbar), "db" (persistierte Admin-Wahl) oder
// "default" (nichts konfiguriert/geladen, inkl. eines fail-closed Ladefehlers — s. Reasoner.setTaskConfig).
export type ReasonerPolicySource = "env" | "db" | "default";

export interface ReasonerTaskConfig {
  global: ReasonerTaskChoice;
  perTask: Partial<Record<ReasonerTask, ReasonerTaskChoice>>;
}

export interface ReasonerConfigStatus {
  provider: string; // Label des aktiven Providers (kein Schlüssel)
  model?: string; // Modell-Label, falls ein echtes Modell konfiguriert ist
  configured: boolean; // ist ein echtes Modell verdrahtet & verfügbar?
  mode: ReasonerConfigMode; // "model" konfiguriert · sonst "demo" (deterministisch)
  fallbackAvailable: boolean; // deterministischer Fallback immer verfügbar (FR-RSN-04)
  supportsLocales: ReasonerLocale[];
  tasks: ReasonerTask[];
  // KI-Verwaltung v1: gewünschte Zuordnung + was je Aufgabe EFFEKTIV läuft (ehrlich).
  taskConfig: ReasonerTaskConfig;
  effective: Record<string, "model" | "deterministic">;
  // SCRUM-424: der eigene lokale LLM (verdrahtet & auswählbar?) + sein Anzeige-Label.
  cloudConfigured: boolean;
  localConfigured: boolean;
  localProvider?: string;
  // SCRUM-424: welche KI je Aufgabe EFFEKTIV zuerst arbeitet (cloud/lokal/deterministisch).
  effectiveProvider: Record<string, "cloud" | "local" | "deterministic">;
  // v1 bewusst ohne Persistenz (gilt bis Neustart) — UI zeigt das ehrlich an.
  persisted: boolean;
  // SCRUM-525 P.5 (WP-C): Herkunft der aktiven Policy — die Admin-UI zeigt bei "env" einen Sperrhinweis
  // (Änderung nur per Deploy/ENV), statt ein PUT zu erlauben, das serverseitig ohnehin 409 liefert.
  policySource: ReasonerPolicySource;
}

// SCRUM-492: strukturierte Kollisionsfelder eines Widerspruchs — je Seite eine knappe Kernaussage
// (1 Satz) + der konkret kollidierende „streitwert" (z. B. „blau" vs. „rot"). streitwertWoertlich
// setzt der Parser: true, wenn der Streitwert wörtlich im zugehörigen Zitat vorkommt → belegter Fall,
// den die UI stärker hervorheben darf. Rein additiv/optional; gatet die Konflikt-Anlage NICHT.
export interface KollisionSeite {
  kernaussage: string;
  streitwert: string;
  streitwertWoertlich: boolean;
}
export interface Kollision {
  streitpunkt: string;
  seiteA: KollisionSeite;
  seiteB: KollisionSeite;
}

// Berater-Konzept 04.07. (Stufe 2, kon-v1): striktes Modellurteil der Aufgabe „Konfliktprüfung".
// Rein inhaltlich (keine Autoren/Trust): vergleicht zwei Kerntexte A/B. Die Belegzitate werden
// nachgelagert wörtlich gegen die Texte geprüft (G-2), bevor daraus ein Konflikt entsteht.
export interface ConflictJudgeResult {
  relation: "widerspruch" | "doppelung" | "ueberholt" | "kein_konflikt" | "unsicher";
  older: "a" | "b" | null;
  confidence: number;
  begruendung: string;
  zitat_a: string;
  zitat_b: string;
  // SCRUM-492: optionale Kollisions-Anreicherung (Kacheln im Board). Fehlt sie, bleibt alles wie bisher.
  kollision?: Kollision;
}

// WP-SHIP8-CLOSE (bens F1): schmaler Ergebnis-Vertrag der Judge-Flächen — der AUSGANG wird
// unterscheidbar. Vorher verschluckten die Judge-Methoden normale Provider-/HTTP-/Netz-/Parse-
// fehler intern und lieferten null — für Aufrufer ununterscheidbar von „kein Modell" oder einem
// echten Nicht-Treffer. failure benennt die Ursache; verdict null OHNE failure gibt es nicht
// (ein echtes „kein_konflikt"/„verschieden" ist ein NICHT-null-verdict).
export type JudgeFailure = "model-error" | "model-timeout" | "no-model";

export interface ConflictJudgeOutcome {
  verdict: ConflictJudgeResult | null;
  failure?: JudgeFailure;
}

export interface DuplicateJudgeOutcome {
  verdict: DuplicateJudgeResult | null;
  failure?: JudgeFailure;
}

// Berater-Konzept Duplikate 04.07. (Stufe D2, dup-v1): Überschneidungs-Profil zweier Kerntexte A/B.
// Struktur passt (namensgleich) zum OverlapVerdict der Duplikat-Kernlogik — der App-Root reicht das
// Modellurteil direkt an die (modul-reine) Erkennung weiter, ohne Umbau. Zitate werden nachgelagert
// wörtlich geprüft (G-2). „verschieden"/„unsicher" sind gültige Nicht-Treffer.
export interface DuplicateAspect {
  beschreibung: string;
  zitatA: string;
  zitatB: string;
}
export interface DuplicateJudgeResult {
  beziehung:
    | "identisch"
    | "a_enthaelt_b"
    | "b_enthaelt_a"
    | "teilweise"
    | "verwandt"
    | "verschieden"
    | "unsicher";
  aspects: DuplicateAspect[];
  nurInA: string;
  nurInB: string;
  empfehlung:
    | "zusammenfuehren"
    | "zusammenfuehren_pruefen"
    | "getrennt_lassen"
    | "verwandt_verlinken";
  confidence: number;
  begruendung: string;
}

// WP-IC-4 (Schritt 4 des abgenommenen Cockpit-Flows): KI-Gruppierung der eingegrenzten
// Import-Kandidaten. Eingabe ist SPARSAM (id, kanonisierter Titel, kurzer kanonisierter Text,
// optional IC-1-Thema — NIE volle Bodies zur Cloud); Ergebnis sind 3–8 thematische Gruppen mit
// Zuordnung jeder Id zu GENAU einer Gruppe. `kind` markiert die deterministisch beschrifteten
// Gruppen (Auffanggruppe/Ohne Thema) — die UI lokalisiert sie DE/EN/NL selbst.
export interface GroupCandidateInput {
  id: string;
  title: string;
  text?: string;
  theme?: string | null; // IC-1-Thema (kanonisch) — Basis der ehrlichen deterministischen Gruppierung
}

export interface CandidateGroup {
  title: string;
  ids: string[];
  kind?: "catchall" | "no-theme";
}

// Ohne funktionierendes Modell (no-model/model-timeout/model-error) kommt die EHRLICHE
// deterministische Themen-Gruppierung (demo:true) — der Flow bleibt IMMER benutzbar; die UI
// kennzeichnet „Ohne KI gruppiert".
// WP-SHIP9-S1 (bens W2-Auflage): "confidential" = ein Cloud-Modell IST konfiguriert und die
// Task-Policy wäre cloud-geeignet (auto/cloud/model), aber die Cloud-Kante wurde wegen
// vertraulicher Kandidaten aus der Kette entfernt und kein lokales Modell konnte einspringen —
// vorher lief das irreführend unter "no-model". Additive Union, nur der group-Task.
export interface GroupCandidatesResult {
  groups: CandidateGroup[];
  demo: boolean;
  fallbackReason?: "no-model" | "model-timeout" | "model-error" | "confidential";
}

// WP-SAMMEL20-FIX (bens Fix 2, IC-3): EHRLICHES Ergebnis der Prompt→Kriterien-Ableitung. criteria
// ist das rohe Modell-JSON (Sanitisieren macht library-analytics) — oder null. fallbackReason
// unterscheidet die Ausfall-Ursache (Muster wie groupCandidates); null = das Modell hat geliefert
// ODER es war (leerer Prompt) gar nichts gefragt. Ein Ausfall wird vom Aufrufer SICHTBAR gemeldet,
// statt still als „alles passt" durchzurutschen.
export interface ImportCriteriaResult {
  criteria: unknown | null;
  fallbackReason: "no-model" | "model-timeout" | "model-error" | null;
}

// WP-BILD-1c (Pedis Präzisierung 20.07.): KI-Bildbeschreibung als VORSCHLAG beim Bearbeiten der
// Fußnote — nie automatisch gespeichert. Ehrlichkeit vor Vollständigkeit: ohne funktionierendes
// Vision-Modell ist text null und fallbackReason erklärt warum (dieselben Ursachen wie beim
// structure-Task, WP-D8/D10) — es gibt KEINE Pseudo-Beschreibung.
export interface DescribeImageResult {
  text: string | null; // kurzer, nüchterner Beschreibungs-Vorschlag — oder ehrlich null
  demo: boolean; // true = kein echtes Modell hat geantwortet
  fallbackReason?: "no-model" | "model-timeout" | "model-error";
}

// Key-Test (Pedi 02.07.): Ergebnis eines echten Mini-Aufrufs — ehrlich, keine Vermutung.
export interface ReasonerProbeResult {
  ok: boolean;
  provider: string; // Label (kein Schlüssel)
  mode: "model" | "deterministic";
  detail: string; // ehrliche Begründung (z. B. "Modell-API antwortete mit 401")
  at: string; // Zeitstempel des Tests (ISO)
}

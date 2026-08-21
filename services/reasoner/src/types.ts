// RT-001 (bens Sammel-Review 3): anbieterneutrale, strukturierte Fehlerklasse eines Judge-Versuchs
// (nur Klasse + optionaler HTTP-Status — nie Rohmeldung/Secret/Provider-Detail) reist bis zum Runner.
import type { AiGeneratedMark } from "../../model-runs";
import type { ModelFailureInfo } from "./model-errors";

// SCRUM-88 / FR-I18N-01: sprachbewusste Reasoner-Steuerung. Steuert Prompting, Interview-Fragen
// und Step-Labels — NICHT den Quelleninhalt.
//
// AUFTRAG-mega52 D1: „nl" ist jetzt eine EIGENE Reasoner-Sprache. Vorher endete Niederländisch am
// Rand der Anwendung: `toReasonerLocale` bildete alles Nicht-Englische auf "de" ab, obwohl NL eine
// vollwertige Oberflächensprache ist. Folge (Pedis P0 vom 28.07.): Englisch UND Niederländisch
// übersetzten nur die Metadaten, nie den Antwortkörper — das Modell hat die gewählte Sprache
// schlicht nie erfahren. Default bleibt "de".
export type ReasonerLocale = "de" | "en" | "nl";

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
  // ==============================================================================================
  // G27 (JOB 1565 D1) — DER DOKUMENTKÖRPER, ALS BEREITS GESCHNITTENER KLARTEXT
  // ==============================================================================================
  //
  // DER BEFUND: Der Körper ist gespeichert, angezeigt, exportierbar — und für das Relevanzmaß nicht
  // vorhanden. `refMatchText` baute bis heute nur Titel + Aussage + Bild-Fußnoten. Ein Treffer, der
  // AUSSCHLIESSLICH im Dokumenttext steht, wird über die Suchprojektion zwar Kandidat, fällt aber am
  // Relevanztor — die Antwort bleibt eine Wissenslücke, obwohl das Wissen im Haus liegt.
  //
  // WARUM KEIN `bodyHtml` UND KEIN SCANNER: Der sichtbare Klartext existiert bereits als
  // persistiertes Feld der Suchprojektion (`search-projection.ts:637`, `bodyText`), gewonnen über
  // den EINEN kanonischen Scanner und dort schon geschnitten (`MAX_SEARCH_TEXT_LENGTH`). Der
  // Reasoner scannt deshalb nichts, parst nichts und kennt `knowledge-object` weiterhin nicht — er
  // nimmt entgegen, was die Projektion ohnehin gerechnet hat.
  //
  // WER WIE VIEL DAVON MITGIBT, IST NICHT HIER ENTSCHIEDEN — und das ist Absicht. Der Aufrufer
  // baut bis zu `ASK_CANDIDATE_PREFILTER_LIMIT` (200) Refs je Frage; bei voller Ausschöpfung des
  // Projektionsdeckels wären das 200 × 200.000 = 40 Mio. Zeichen, die je Frage tokenisiert würden.
  // Dieses Feld erfindet deshalb KEINE eigene Grenze: eine neu erfundene Zahl wäre exakt derselbe
  // Fehler wie die 500 aus `wordAddin.ts:925`, nur mit einer größeren Ziffer. Die Menge gehört zum
  // Aufrufer, wo sie messbar ist; fehlt das Feld, matcht der Altbestand wie bisher.
  bodyText?: string;
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
  // Die HERANGEZOGENEN Quellen — alles, was das Ranking dem Antwortweg vorgelegt hat. Unverändert
  // in Bedeutung und Befüllung; `ask.sourcesHint` beschreibt genau das seit jeher ehrlich.
  sources: string[];
  // AUFTRAG-mega52 A2/A3 — DIE TRAGENDEN QUELLEN.
  //
  // DER BEFUND: die Antwort wusste nicht, worauf sie steht. Der Modellmodus füllte `sources`
  // pauschal aus ALLEN bis zu acht Kandidaten; der Prompt nummerierte die Quellen und erlaubte
  // Verweise, aber die Marken wurden nie zurückgelesen. Der deterministische Rückfall machte es
  // längst richtig (`sources: [best.id]`, s. provider.ts) — im Modellmodus fehlte diese Ehrlichkeit.
  //
  // `citedSources` ist ADDITIV: `sources` bleibt, was es ist. Enthalten sind ausschließlich die
  // Quellen, deren Fußnotenmarke `[n]` im gelieferten Antworttext WIRKLICH vorkommt.
  //
  // A5 — DIE REISSLEINE: liefert das Modell keine oder unbrauchbare Marken, ist die Liste LEER.
  // Nie geraten, nie stillschweigend auf alle zurückgefallen; die Oberfläche sagt dann, dass die
  // Zuordnung nicht möglich war. Leer heißt „unbekannt", nicht „keine".
  citedSources: string[];
  steps: AnswerStep[];
  demo: boolean; // FR-RSN-04: ohne Modell als Demo erkennbar.
  // AUFTRAG-mega61 Block F: die maschinenlesbare Kennzeichnung nach Artikel 50 Absatz 2 der
  // KI-Verordnung. Sie wird ZENTRAL an der Dienstgrenze gesetzt (ReasonerService), damit sie
  // nicht an jedem Provider einzeln vergessen werden kann; die Provider bauen ihr Ergebnis
  // unverändert ohne sie. Deshalb hier optional — die Zusage „immer gesetzt" gilt ab dem
  // Dienst und ist genau dort getestet.
  aiGenerated?: AiGeneratedMark;
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
  //  - "confidential": WP-SHIP9-S2 — Cloud-KI konfiguriert und Policy cloud-geeignet, aber die Cloud-Kante
  //    wurde wegen vertraulichem Text ausgeschlossen (kein lokales Modell sprang ein); vorher „no-model".
  // Nur bei demo:true gesetzt; PII-frei (nie Eingabetext).
  fallbackReason?: "no-model" | "model-timeout" | "model-error" | "confidential";
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
  // AUFTRAG-mega61 Block F: die maschinenlesbare Kennzeichnung nach Artikel 50 Absatz 2 der
  // KI-Verordnung. Sie wird ZENTRAL an der Dienstgrenze gesetzt (ReasonerService), damit sie
  // nicht an jedem Provider einzeln vergessen werden kann; die Provider bauen ihr Ergebnis
  // unverändert ohne sie. Deshalb hier optional — die Zusage „immer gesetzt" gilt ab dem
  // Dienst und ist genau dort getestet.
  aiGenerated?: AiGeneratedMark;
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
//
// JOB 615 D7: DIE EINE AUFGABENQUELLE — und warum sie ausgerechnet hier steht.
//
// Bis D6 gab es drei Beschreibungen derselben Sache: die Liste `REASONER_TASKS` in `service.ts`,
// diese Union hier und eine dritte in `apps/web/src/api/types.ts` mit nur sieben Werten. Der Typ
// wanderte nicht mit, wenn die Liste wuchs — `group` fehlte in der Oberfläche.
//
// Die Liste gehört in DIESE Datei, nicht in `service.ts`: `types.ts` ist die abhängigkeitsfreie
// Basisschicht, und `service.ts` importiert daraus (service.ts:57). Läge sie dort, müsste `types.ts`
// aus `service.ts` importieren — ein Zirkelbezug, den `.dependency-cruiser.cjs` (`no-circular`)
// zu Recht verbietet. `service.ts` reicht sie unverändert weiter, damit alle Bestandsimporteure
// (services/reasoner/index.ts:10) unberührt bleiben.
export const REASONER_TASKS = [
  "structure",
  "assist",
  "interview",
  "answer",
  "select",
  "extract",
  "describe",
  "group",
] as const;

// Abgeleitet, nicht abgeschrieben: kommt eine Aufgabe hinzu, wandert der Typ ohne Zutun mit.
export type ReasonerTask = (typeof REASONER_TASKS)[number];

// Die geschlossene Karte je Aufgabe. Sie ersetzt `Record<string, boolean>` überall dort, wo der
// Server VOLLSTÄNDIG antwortet — ein Tippfehler ist damit ein Typfehler und nicht mehr `undefined`.
export type ReasonerTaskMap = Record<ReasonerTask, boolean>;

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
// D-AISTATE PAKET 1 (bens V1, 23.07.): "confidential" = das Paar ist vertraulich, die Cloud-Kante
// wurde deshalb aus der Judge-Kette entfernt UND kein lokales Modell konnte einspringen. Ein
// unterscheidbarer, EHRLICHER Ausgang — NICHT "no-model" (ein Cloud-Modell IST konfiguriert, es
// darf nur vertraulichen Text nicht sehen) und NICHT "done".
export type JudgeFailure = "model-error" | "model-timeout" | "no-model" | "confidential";

// RT-001 (bens Sammel-Review 3): NEBEN der groben `failure` reist bei einem GEFANGENEN Providerfehler
// zusätzlich die ANBIETERNEUTRALE, strukturierte Fehlerklasse mit (HTTP-Status-/Fehlertyp-Kategorie).
// Der Runner leitet daraus die feine, ehrliche Ursache (auth/rate-limit/unreachable/bad-response) ab,
// OHNE die grobe Klasse vorher zu verdichten. Es wird NIE Rohmeldung/Secret/Provider-Detail geführt —
// providerFailure trägt ausschließlich {failureClass, status?}. Fehlt es (z. B. Antwort kam, war aber
// unverwertbar → null), bleibt der ehrliche grobe Rückfall.
export interface ConflictJudgeOutcome {
  verdict: ConflictJudgeResult | null;
  failure?: JudgeFailure;
  providerFailure?: ModelFailureInfo;
}

export interface DuplicateJudgeOutcome {
  verdict: DuplicateJudgeResult | null;
  failure?: JudgeFailure;
  providerFailure?: ModelFailureInfo;
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
  // WP-SHIP9-S2 (bens Folgeschnitt B4): "confidential" additiv — Cloud-KI konfiguriert und select-Policy
  // cloud-geeignet, aber die Cloud-Kante wegen vertraulicher Kandidaten ausgeschlossen (kein lokales
  // Modell sprang ein); vorher irreführend „no-model".
  fallbackReason: "no-model" | "model-timeout" | "model-error" | "confidential" | null;
}

// WP-BILD-1c (Pedis Präzisierung 20.07.): KI-Bildbeschreibung als VORSCHLAG beim Bearbeiten der
// Fußnote — nie automatisch gespeichert. Ehrlichkeit vor Vollständigkeit: ohne funktionierendes
// Vision-Modell ist text null und fallbackReason erklärt warum (dieselben Ursachen wie beim
// structure-Task, WP-D8/D10) — es gibt KEINE Pseudo-Beschreibung.
export interface DescribeImageResult {
  text: string | null; // kurzer, nüchterner Beschreibungs-Vorschlag — oder ehrlich null
  demo: boolean; // true = kein echtes Modell hat geantwortet
  // WP-SHIP9-S2 (bens Folgeschnitt B4): "confidential" additiv — Cloud-Vision konfiguriert, aber wegen
  // vertraulichem Bild ausgeschlossen (kein lokales Modell sprang ein); vorher irreführend „no-model".
  fallbackReason?: "no-model" | "model-timeout" | "model-error" | "confidential";
  // WP-BILD-1f (Pedi 22.07.): true, wenn der Vorschlag WIRKLICH mit dem umgebenden Dokument-Kontext
  // erzeugt wurde (Kontext lag vor UND ging über denselben Cloud-Weg wie das Bild mit). Die UI
  // kennzeichnet den Vorschlag dann als „mit Dokument-Kontext erzeugt". Bei vertraulichem Bild
  // (Cloud ausgeschlossen) gibt es KEINEN Vorschlag und damit auch kein withContext.
  withContext?: boolean;
  // AUFTRAG-mega61 Block F: die maschinenlesbare Kennzeichnung nach Artikel 50 Absatz 2 der
  // KI-Verordnung. Sie wird ZENTRAL an der Dienstgrenze gesetzt (ReasonerService), damit sie
  // nicht an jedem Provider einzeln vergessen werden kann; die Provider bauen ihr Ergebnis
  // unverändert ohne sie. Deshalb hier optional — die Zusage „immer gesetzt" gilt ab dem
  // Dienst und ist genau dort getestet.
  aiGenerated?: AiGeneratedMark;
  // ============================================================================================
  // JOB 1164 · D1 (TV1 Stufe 1): DER TITELVORSCHLAG — ADDITIV, OPTIONAL, SERVERINTERN.
  // ============================================================================================
  //
  // WAS ES IST: die Ableitung aus `titel-vorschlag.ts`, an derselben Dienstgrenze gesetzt wie
  // `aiGenerated` (service.ts, `describeImage`). Es entsteht KEIN zweiter Modellaufruf — die
  // Ableitung ist eine reine Funktion über das bereits vorliegende Ergebnis.
  //
  // WAS ES NICHT IST: ein sichtbarer Nutzen. Kein Anwender sieht heute einen Titelvorschlag; der
  // Renderer ist Stufe 2 und existiert nicht. Diese Zeile darf nichts anderes behaupten.
  //
  // GESETZT NUR IM ERFOLGSFALL. Konnte kein Titel abgeleitet werden, FEHLT das Feld — es steht
  // dann nicht mit `titel: null` da. „Kein Feld" ist eindeutig; ein Feld ohne Titel wäre etwas,
  // das man für einen Vorschlag halten kann. Der Werteraum ist damit enger als der Typ; der Typ
  // trägt die vollständige Form, weil Stufe 2 den Grund anzeigen können soll, ohne den Draht
  // erneut zu ändern.
  //
  // WARUM DIE FORM HIER AUSGESCHRIEBEN STEHT UND NICHT IMPORTIERT WIRD — gemessen, nicht
  // vermutet: `titel-vorschlag.ts` importiert `DescribeImageResult` aus DIESER Datei. Ein
  // `import type { TitelVorschlagErgebnis } from "./titel-vorschlag"` schließt den Ring, und
  // `.dependency-cruiser.cjs` (`no-circular`, severity error, `tsPreCompilationDeps: true`)
  // meldet ihn als Verstoß — nachgemessen in diesem Durchgang:
  //   `titel-vorschlag.ts → types.ts → titel-vorschlag.ts`.
  // Dieselbe Begründung, aus der `REASONER_TASKS` in dieser Datei liegt (s. dort), verbietet also
  // den umgekehrten Import.
  //
  // DASS DIE BEIDEN FORMEN NICHT AUSEINANDERLAUFEN, SICHERT DER COMPILER: `describeImage` weist
  // hier das Ergebnis von `titelVorschlag()` zu. Divergiert eine Seite, ist die Zuweisung ein
  // Typfehler — die Kopplung ist geprüft, nicht behauptet. Zusätzlich vergleicht
  // `tests/reasoner/job1164-wiretyp-dienstgrenze.test.ts` beide Formen im Quelltext.
  titelVorschlag?:
    | { readonly titel: string; readonly grund: "abgeleitet" }
    | { readonly titel: null; readonly grund: "kein_text" | "demo" | "vertraulich" | "leer" };
}

// Key-Test (Pedi 02.07.): Ergebnis eines echten Mini-Aufrufs — ehrlich, keine Vermutung.
export interface ReasonerProbeResult {
  ok: boolean;
  provider: string; // Label (kein Schlüssel)
  mode: "model" | "deterministic";
  detail: string; // ehrliche Begründung (z. B. "Modell-API antwortete mit 401")
  at: string; // Zeitstempel des Tests (ISO)
}

// PAKET 2 (D-AISTATE, Pedi 23.07.): ehrlicher Erreichbarkeits-Zustand für die Top-Badges — „aktiv"
// heißt zuletzt WIRKLICH erreichbar, nicht nur konfiguriert (isAvailable = client !== undefined).
//  - "none":        kein Modell konfiguriert.
//  - "unverified":  konfiguriert, aber (noch) keine frische Erreichbarkeits-Antwort (Cache leer/abgelaufen).
//  - "active":      zuletzt erreichbar (echte probe/Task-Antwort innerhalb der Cache-Frist).
//  - "unreachable": konfiguriert, aber zuletzt NICHT erreichbar (Key abgelaufen, Tunnel aus, Ausfall).
export type ReasonerReachability = "none" | "unverified" | "active" | "unreachable";

import type { ReasonerPolicySource, ReasonerTaskChoice } from "./types";

// ================================================================================================
// W1 S4 — DER KLARA POLICY RESOLVER (KW-S4-02, KW-S4-03, KW-S4-04)
// ================================================================================================
//
// WOZU ER DA IST. Klara zeigt im Add-in dauerhaft an, WAS gerade rechnet: Admin-Vorgabe,
// tatsächlicher Modus, Anbieter, Modell und — bei Abweichung — den Grund. Bis heute konnte das
// Add-in das nur raten: `GET /api/reasoner/status` beantwortet eine andere Frage (die globale
// Reasoner-Lage), und alles Klara-Spezifische hätte im Browser zusammengerechnet werden müssen.
// Genau das ist das No-Go aus KW-S4-04 §54-57: „Berechnung des effektiven Zustands im Add-in" und
// „Anzeige und Ausführung aus verschiedenen Auflösungen".
//
// DIESE DATEI IST DIE EINE STELLE, an der aus Konfiguration ein Klara-Zustand wird. Sie ist REIN:
// kein I/O, keine Datenbank, kein HTTP, keine Zeitquelle ausser der übergebenen. Damit ist sie
// vollständig prüfbar — und die HTTP-Schicht kann gar nichts entscheiden, weil sie nichts zu
// entscheiden hat (No-Go 1 des Auftrags: keine Provider-/Modell-/Fallback-/Consententscheidung im
// HTTP-Layer).
//
// SIE LEGT KEINE ZWEITE KONFIGURATION AN. Eingabe ist der vorhandene Reasoner-Zustand
// (`ReasonerTaskChoice`, `cloudConfigured`, `localConfigured`, Provider-/Modell-Label). Eine eigene
// Klara-Kopie wäre das ausdrückliche No-Go aus KW-S4-04 §129.

/**
 * DIE DREI KANONISCHEN MODI (KW-S4-02 §51-54). Provider und Modell sind Bindungen INNERHALB eines
 * Modus, keine zusätzlichen Modi.
 */
export type KlaraMode = "deterministic" | "internal" | "external";

export const KLARA_MODES: readonly KlaraMode[] = ["deterministic", "internal", "external"];

/**
 * Warum der effektive Modus von der Admin-Vorgabe abweicht — oder warum nicht ausgeführt werden
 * darf. Ein benannter Grund, kein Freitext: das Add-in zeigt ihn an, und was es anzeigt, muss
 * serverseitig entschieden sein.
 */
export type KlaraDeviationReason =
  // Admin will `external`, aber es gibt keinen einsatzbereiten Cloud-Anbieter.
  | "external_not_configured"
  // Admin will `internal`, aber es gibt kein einsatzbereites lokales Modell.
  | "internal_not_configured"
  // Admin will `external`; der externe Antwortweg ist in dieser Ausbaustufe noch nicht migriert.
  | "external_not_migrated"
  // Admin will `external`; die Sitzung hat (noch) keine gültige Zustimmung.
  | "external_consent_missing"
  // Die Konfiguration ist unvollständig oder widersprüchlich.
  | "policy_incomplete";

/**
 * DER STATUSVERTRAG (Auftrag §99-116, KW-S4-04 §32-47). Genau diese Felder, nicht mehr.
 *
 * `provider` und `model` sind AUCH für `deterministic` und `internal` gefüllt — kanonische
 * serverseitige Werte statt einer Lücke, die das Add-in raten müsste (Auftrag §118).
 */
export interface KlaraResolution {
  readonly resolutionId: string;
  readonly mode: KlaraMode;
  readonly provider: string;
  readonly model: string;
  readonly adminConfiguredMode: KlaraMode;
  readonly effectiveMode: KlaraMode;
  readonly deviation: boolean;
  readonly deviationReason: KlaraDeviationReason | null;
  readonly externalConsentRequired: boolean;
  readonly externalConsentGranted: boolean;
  /**
   * WER AUSFÜHREN WÜRDE, WENN ZUGESTIMMT WIRD (JOB 3079 R2, BEN-Korrekturpflicht 1).
   *
   * `provider`/`model` oben beantworten „was rechnet JETZT" und melden vor der Zustimmung
   * absichtlich die deterministischen Ersatzwerte. Der Zustimmungsdialog stellt eine ANDERE Frage —
   * „an wen ginge es, wenn ich ja sage?" — und muss sie aus dem Vertrag beantworten, nicht aus einer
   * Ableitung im Add-in (No-Go 1).
   *
   * `null` heisst: es gibt keinen Empfänger, den eine Zustimmung freischalten würde. Dann darf gar
   * nicht zugestimmt werden — eine Zustimmung ohne bestimmten Empfänger ist nach KW-S4-22 §4 „nicht
   * hinreichend bestimmt". Die Begründung der Belegung steht bei `zustimmungWuerdeTragen`.
   */
  readonly externalConsentProvider: string | null;
  readonly externalConsentModel: string | null;
  readonly executionAllowed: boolean;
  readonly blockedReason: KlaraDeviationReason | null;
  readonly resolvedAt: string;
  readonly expiresAt: string;
  readonly policyVersion: string;
  readonly configurationVersion: string;
  /**
   * DIE NUTZLASTKLASSEN, DIE DIESE AUFLÖSUNG TATSÄCHLICH VERSENDEN WÜRDE (BEN-35 Befund 1).
   *
   * Sie fehlten hier, und das war kein Schönheitsfehler: die Deckungsprüfung verglich den Consent
   * deshalb gegen eine hart codierte Klasse. Die verwendete Auflösung konnte die Nutzlastsemantik,
   * die eine Zustimmung binden soll, überhaupt nicht ausdrücken — eine Bindung an etwas, das nicht
   * aus der Bindungsquelle stammt, ist keine.
   *
   * Sie stehen bewusst NEBEN `externalConsentRequired` und nicht darin: WAS gesendet würde, ist
   * eine andere Frage als OB dafür zugestimmt werden muss.
   */
  readonly effectivePayloadClasses: readonly string[];
}

/**
 * Was der Resolver über die Instanz wissen muss — ausschliesslich Werte, die es im Repository
 * bereits gibt. Nichts davon ist neu erfunden.
 */
export interface KlaraPolicyInput {
  /** Die Admin-Wahl für die Aufgabe `answer`, aus der vorhandenen `ReasonerTaskConfig`. */
  readonly choice: ReasonerTaskChoice;
  /** Herkunft der aktiven Policy (`env` | `db` | `default`) — geht in die Policyversion ein. */
  readonly source: ReasonerPolicySource;
  /**
   * DIE EFFEKTIVE ANSWER-BINDUNG — `config.effectiveProvider.answer` (BEN ROT-1).
   *
   * Sie ist die taskbezogene Wahrheit des Reasoners: was für die Aufgabe `answer` WIRKLICH
   * laufen würde. Bis R1 stand hier die globale Bevorzugung (`config.provider`), und das war der
   * Fehler: bei gleichzeitig verdrahtetem Cloud UND Local und Admin-Wahl `answer = local` meldete
   * der Kopf `internal` zusammen mit dem CLOUD-Anbieter. Anzeige und wirksame Auflösung liefen
   * auseinander — genau das, was KW-S4-02 §18 verbietet.
   */
  readonly effectiveAnswerProvider: "cloud" | "local" | "deterministic";
  /** Ist ein externer Cloud-Anbieter einsatzbereit verdrahtet? */
  readonly cloudConfigured: boolean;
  /** Ist ein lokales/internes Modell einsatzbereit verdrahtet? */
  readonly localConfigured: boolean;
  /** Anzeigelabel des CLOUD-Anbieters (kein Schlüssel, kein Secret). */
  readonly providerLabel: string;
  /** Anzeigelabel des Cloud-Modells, falls eines verdrahtet ist. */
  readonly modelLabel?: string | undefined;
  /** Anzeigelabel des LOKALEN Anbieters/Modells, falls eines verdrahtet ist. */
  readonly localProviderLabel?: string | undefined;
  /** Liegt für die betrachtete Sitzung eine gültige externe Zustimmung vor? */
  readonly externalConsentGranted: boolean;
  /** Erzeugungszeitpunkt (ms). Injiziert, damit die Auflösung reproduzierbar ist. */
  readonly now: number;
  /**
   * DIE IDENTITÄT DIESER AUFLÖSUNG (BEN ROT-2).
   *
   * Sie wird HEREINGEGEBEN, nicht hier erzeugt. Bis R1 rief der Resolver bei jeder Auskunft
   * `newId()` — zwei Statusabrufe ergaben zwei Identitäten, und Session, Consent und Status
   * konnten unmöglich dieselbe referenzieren. Wer die Identität besitzt, ist der Sitzungsdienst:
   * er persistiert sie und reicht sie herein, solange Policy- und Konfigurationsversion tragen.
   */
  readonly resolutionId: string;
}

/**
 * DIE KANONISCHEN ERSATZWERTE für Anbieter und Modell.
 *
 * Sie sind der Unterschied zwischen „das Add-in weiss es nicht" und „es rechnet nachweislich ohne
 * Modell". `deterministic` HAT einen Anbieter — die eigene deterministische Verarbeitung — und sie
 * heisst so. Ein `undefined` an dieser Stelle wäre die Lücke, die KW-S4-04 §49-50 verbietet.
 */
export const KLARA_DETERMINISTIC_PROVIDER = "Klarwerk (deterministisch)";
export const KLARA_DETERMINISTIC_MODEL = "ohne generatives Modell";

/**
 * WIE LANGE EINE AUFLÖSUNG GILT.
 *
 * Sie ist bewusst kurzlebig: sie bindet Anzeige und Ausführung aneinander, und was das Add-in vor
 * einer Stunde angezeigt bekam, darf keine Ausführung von jetzt rechtfertigen. Der Wert ist ein
 * benannter Betriebsparameter (KW-S4-03 §68: „Die konkreten Zeitwerte sind Betriebsparameter"),
 * kein aus einer Zahl abgeleitetes Produktverhalten.
 */
export const KLARA_RESOLUTION_TTL_MS = 5 * 60 * 1000;

/**
 * DER SCHALTER FÜR DEN EXTERNEN ANTWORTWEG — und er steht seit dem 05.09.2026 auf AN.
 *
 * WIE ER ENTSTAND. In der Welle W1 S4 stand er auf AUS, und das war richtig so: der damalige
 * Auftrag war ausdrücklich „Noch wird kein neuer externer Antwortweg freigeschaltet" (§16-17) und
 * „Kein neuer Modellaufruf und kein neuer externer Egress" (No-Go 3). Eine Admin-Auswahl
 * `external` führte deshalb nie zu `executionAllowed = true`, sondern zu einer ehrlichen Blockade
 * mit dem Grund `external_not_migrated` (§145). Die Konstante steht hier sichtbar und nicht als
 * verstreute Bedingung, damit die Freischaltung EINE benannte Entscheidung ist und kein Suchen —
 * und genau deshalb liest sie AUCH HEUTE nur eine einzige Stelle (Strukturpin in
 * `klara-policy.test.ts`).
 *
 * ============================================================================================
 * FREIGESCHALTET AM 05.09.2026 (JOB 3079) — NACHDEM ALLE VIER SPERRGRÜNDE BEHOBEN WAREN.
 * ============================================================================================
 *
 * Der Eigentümer (Pedi) hat am 03.09.2026 entschieden, den externen Antwortweg freizugeben
 * (Herkunft `PRIORITAETEN.md` Zeile V2), und am 05.09.2026 um 12:03 bestätigt („JA",
 * Entscheidung 15). JOB 3033 hat die Konstante damals umgelegt und dabei vier Stellen freigelegt,
 * an denen der Bestand etwas anderes tat oder sagte, als die Einwilligung verspricht. Er hat sie
 * deshalb NICHT freigeschaltet, sondern als Bedingung an diesen Wert gebunden
 * (`tests/ka4-freischaltung/ka4-einwilligung-wirkt.test.ts`, Fälle S1 bis S4: jeder misst BEIDE
 * Zustände des Schalters). JOB 3079 hat die vier behoben — hier steht, WO:
 *
 *   S1 · DIE FRIST GILT JETZT FÜR DIE FREISCHALTUNG. `pruefeConsentDeckung`
 *        (`services/app/src/services/klara-session-service.ts`) verwirft eine Zustimmung, die
 *        älter als `KLARA_RESOLUTION_TTL_MS` (oben) ist — fail-closed, mit dem benannten Grund
 *        `aufloesung_abgelaufen`. Vorher prüfte nur die Sitzungsfrist (15 min Inaktivität), und
 *        Anzeige (5 min) und Ausführung liefen um genau diese Differenz auseinander.
 *   S2 · DIE ZUSTIMMUNG NENNT DEN AUSFÜHRENDEN EMPFÄNGER. `grantConsent` bildet sie aus der
 *        Auflösung MIT Zustimmung; `providerReference`/`modelReference` tragen deshalb den
 *        Cloud-Anbieter und sein Modell statt der deterministischen Ersatzwerte. Die
 *        Deckungsprüfung vergleicht gegen dieselbe Auflösung — sonst wäre der Fix ein Widerspruch.
 *   S3 · DER ZUSTIMMUNGSUMFANG DECKT, WAS HINAUSGEHT. `KLARA_PAYLOAD_CLASSES` (unten) weist Frage
 *        UND Kandidatentexte aus, weil der Antwortweg beides versendet.
 *   S4 · DIE FLÄCHE SAGT DIE WAHRHEIT JE ZUSTAND. Die Lagetexte des Add-ins behaupten nicht mehr
 *        „immer ohne KI-Modell"; der Satz zum Weg dieses Fensters hängt jetzt am S4-Zustand
 *        (`klaraWegSatz` in `apps/web/public/word-addin/taskpane.html`), in drei Sprachen.
 *
 * WAS UNABHÄNGIG WEITER GILT, auch nach der Freischaltung: die Admin-Auswahl muss `external`
 * ergeben, ein Cloud-Anbieter MIT Bezeichnung muss verdrahtet sein (sonst fällt die Auflösung auf
 * `deterministic` zurück, s. `cloudLabelFehlt` unten), und es muss eine deckende Einwilligung für
 * genau diese Sitzung und genau dieses Dokument vorliegen (`external_consent_missing`). Der
 * Fail-safe bleibt unangetastet: fehlende oder widersprüchliche Policy endet in `deterministic`
 * oder `blocked`, niemals still in `external`.
 *
 * WER IHN ZURÜCKLEGT, legt den ganzen Weg zurück: die Fälle S1 bis S4 messen weiterhin BEIDE
 * Zustände. `false` sperrt den externen Weg vollständig — es hinterlässt keinen Halbstand.
 */
export const KLARA_EXTERNAL_EXECUTION_MIGRATED = true;

/**
 * DIE NUTZLASTKLASSEN, DIE DIESER SERVER AUF DEM ANTWORTWEG VERSENDET.
 *
 * Sie sind keine Auswahl aus einem Katalog, sondern eine ABGELESENE Tatsache des Bestands. Wer sie
 * ändern will, muss vorher `services/ask/src/service.ts` ändern — nicht umgekehrt.
 *
 * `question` · die Frage des Nutzers, wörtlich, wie sie getippt wurde. Sie geht als erstes Argument
 *   an `Reasoner.answer` (`services/ask/src/service.ts`, Aufruf `this.reasoner.answer(question, …)`).
 *
 * `candidate_texts` · die TEXTE DER GEFUNDENEN EINTRÄGE. Der Antwortweg übergibt dem Modell neben
 *   der Frage die ausgewählten Kandidaten als `KnowledgeRef`: Titel, Aussage, Status, Vertrauenswert
 *   und — seit JOB 2614 D3 — den geschnittenen Dokumenttext (`bodyText`) sowie die Bild-Fußnoten
 *   (`captionTexts`). Das ist mehr als „die Frage", und genau daran ist JOB 3033 als Sperrgrund S3
 *   hängen geblieben: die Zustimmung wies eine Klasse aus, hinaus gingen zwei.
 *
 * ============================================================================================
 * WARUM DIE ZWEITE KLASSE HIER JETZT STEHEN DARF (JOB 3079, 05.09.2026).
 * ============================================================================================
 *
 * Der Kommentar an dieser Stelle lautete bis JOB 3033: „Käme eine zweite Klasse hinzu, wäre das
 * eine Zustimmungsentscheidung — und die trifft niemand als Nebenwirkung eines Refactorings."
 * Das gilt unverändert. Diese zweite Klasse ist keine Nebenwirkung: sie ist der ausdrückliche
 * Gegenstand der Ownerentscheidung vom 05.09.2026 (Pedi, „JA", PRIORITAETEN.md V2) und sie
 * ERFINDET nichts — sie benennt, was der Antwortweg seit JOB 2614 ohnehin versendet hätte, sobald
 * er extern ausführt. Die Zustimmung wird dadurch nicht breiter, sondern erstmals wahr.
 *
 * WAS AUSDRÜCKLICH NICHT DAZUGEHÖRT, obwohl das Panel es kennt: die MARKIERTE PASSAGE aus dem
 * Word-Dokument (`selection`). Sie erreicht das Modell nicht — `services/ask/src/service.ts`
 * verwendet sie ausschliesslich zur Bildung der Suchterme (`erweiterteSuchterme`) und gibt sie
 * nirgends an einen Provider weiter. Eine Klasse dafür auszuweisen wäre eine Zustimmung für etwas,
 * das gar nicht hinausgeht — dieselbe Unehrlichkeit wie S3, nur in die andere Richtung.
 */
export const KLARA_PAYLOAD_CLASS_QUESTION = "question";
export const KLARA_PAYLOAD_CLASS_CANDIDATE_TEXTS = "candidate_texts";

/**
 * Die Menge, die eine Auflösung ausweist — in fester Reihenfolge, damit die Anzeige stabil ist.
 * Die Deckungsprüfung vergleicht mengenstabil (`payloadKlassenSchluessel`), die Reihenfolge ist
 * also allein eine Frage der Lesbarkeit im Zustimmungssatz.
 *
 * EINGEFROREN, und das ist keine Zierde: jede Auflösung reicht DIESE Liste heraus. Wäre sie
 * beschreibbar, könnte ein einziger Aufrufer die Zustimmungsgrundlage des ganzen Prozesses
 * verstellen — `readonly` allein ist ein Compilerversprechen und keine Laufzeitgrenze.
 */
export const KLARA_PAYLOAD_CLASSES: readonly string[] = Object.freeze([
  KLARA_PAYLOAD_CLASS_QUESTION,
  KLARA_PAYLOAD_CLASS_CANDIDATE_TEXTS,
]);

/** Die Admin-Wahl auf die drei kanonischen Modi abbilden — die WUNSCHseite. */
function adminModeOf(choice: ReasonerTaskChoice, cloudConfigured: boolean): KlaraMode {
  switch (choice) {
    case "cloud":
      return "external";
    case "local":
      return "internal";
    case "deterministic":
      return "deterministic";
    default:
      // `auto` und `model` heissen „nimm das beste verdrahtete Modell". Was das ist, entscheidet
      // die Verdrahtung — nicht der Wunsch. Ohne Cloud ist das die lokale/interne Bindung.
      return cloudConfigured ? "external" : "internal";
  }
}

/** Die EFFEKTIVE Answer-Bindung auf die drei kanonischen Modi abbilden — die TATSACHENseite. */
function effectiveModeOf(binding: KlaraPolicyInput["effectiveAnswerProvider"]): KlaraMode {
  switch (binding) {
    case "cloud":
      return "external";
    case "local":
      return "internal";
    default:
      return "deterministic";
  }
}

/**
 * DIE AUFLÖSUNG (KW-S4-02 §11-18): `gewählt` → `erlaubt` → `effektiv` → Grund der Abweichung.
 *
 * KORRIGIERT NACH BEN ROT-1. Der effektive Modus kommt jetzt aus `effectiveAnswerProvider`, also
 * aus der taskbezogenen Wahrheit des Reasoners — nicht mehr aus einer eigenen Ableitung über
 * `choice` und `cloudConfigured`. Anbieter und Modell folgen derselben Bindung: `local` meldet den
 * LOKALEN Anbieter, `cloud` den Cloud-Anbieter. Der Fall „Cloud und Local verdrahtet, Admin wählt
 * local" meldet damit `internal` MIT lokalem Anbieter — er meldete zuvor `internal` mit Cloud.
 *
 * FAIL-SAFE (Auftrag §156): fehlende oder widersprüchliche Policy endet in `deterministic` oder
 * `blocked` — niemals still in `external`.
 */
export function resolveKlaraPolicy(input: KlaraPolicyInput): KlaraResolution {
  const adminConfiguredMode = adminModeOf(input.choice, input.cloudConfigured);
  const resolvedAtMs = input.now;
  const resolvedAt = new Date(resolvedAtMs).toISOString();
  const expiresAt = new Date(resolvedAtMs + KLARA_RESOLUTION_TTL_MS).toISOString();

  let effectiveMode = effectiveModeOf(input.effectiveAnswerProvider);
  let reason: KlaraDeviationReason | null = null;

  if (effectiveMode !== adminConfiguredMode) {
    // Der Grund benennt, WAS fehlt — nicht bloss, dass etwas abweicht.
    if (adminConfiguredMode === "external") {
      reason = input.cloudConfigured ? "policy_incomplete" : "external_not_configured";
    } else if (adminConfiguredMode === "internal") {
      reason = input.localConfigured ? "policy_incomplete" : "internal_not_configured";
    } else {
      reason = "policy_incomplete";
    }
  }

  // Eine Bindung, die ihren Anbieter nicht benennen kann, ist unvollständig — dann deterministisch
  // statt mit einer erfundenen Bezeichnung.
  const cloudLabelFehlt = effectiveMode === "external" && !input.providerLabel;
  const localLabelFehlt = effectiveMode === "internal" && !input.localProviderLabel;
  if (cloudLabelFehlt || localLabelFehlt) {
    effectiveMode = "deterministic";
    reason = "policy_incomplete";
  }

  const externalConsentRequired = effectiveMode === "external";
  const externalConsentGranted = externalConsentRequired && input.externalConsentGranted;

  // ================================================================================================
  // JOB 3079 RUNDE 2 (BEN-Korrekturpflicht 3) — WIDERSPRÜCHLICHE POLICY IST FAIL-CLOSED.
  // ================================================================================================
  //
  // DER BEFUND, wörtlich nachgestellt: `choice: "deterministic"`, effektive Bindung `"cloud"`, ein
  // benannter Cloud-Anbieter und eine Zustimmung ergaben `deviationReason: "policy_incomplete"` —
  // und trotzdem `effectiveMode: "external"` mit `executionAllowed: true`. Der Resolver BENANNTE
  // den Widerspruch also und liess ihn passieren. Solange der Schalter auf `false` stand, war das
  // folgenlos; mit der Freischaltung wird daraus ein Egress, den kein Administrator gewählt hat.
  // Der Kommentar über dieser Funktion versprach seit W1 S4 das Gegenteil („fehlende oder
  // widersprüchliche Policy endet in `deterministic` oder `blocked` — niemals still in `external`").
  //
  // DIE REGEL, in einem Satz: externe Ausführung braucht eine ADMIN-WAHL, die extern ergibt, UND
  // eine verdrahtete Cloud. Beides sind Tatsachen der Konfiguration, keine Ableitung:
  //   · `adminConfiguredMode !== "external"` heisst, der Administrator hat den externen Weg nicht
  //     gewählt. Dass die effektive Bindung trotzdem auf Cloud zeigt, ist ein Widerspruch in der
  //     Konfiguration — und eine Zustimmung des Nutzers kann eine fehlende Admin-Wahl nicht
  //     ersetzen.
  //   · `!cloudConfigured` bei effektiver Cloud-Bindung heisst, dieselbe Konfiguration sagt an zwei
  //     Stellen Verschiedenes. Welche Stelle recht hat, kann diese reine Funktion nicht wissen —
  //     also führt sie nicht aus.
  //
  // WARUM `blocked` UND NICHT „still auf deterministic drehen": ein Rückfall auf `deterministic`
  // wäre eine BEHAUPTUNG darüber, was rechnet, und die Fläche zeigte einen ruhigen Normalzustand.
  // Der Widerspruch bliebe unsichtbar. Als Blockade mit dem Grund `policy_incomplete` steht er im
  // Panel und im Protokoll — und der Ask-Weg fällt trotzdem nicht aus: er bleibt in der Enge und
  // antwortet deterministisch (`ask-routes.ts`, `ka4Freigabe` liefert `false`).
  const externAutorisiert = adminConfiguredMode === "external" && input.cloudConfigured;

  let blockedReason: KlaraDeviationReason | null = null;
  if (effectiveMode === "external") {
    if (!externAutorisiert) {
      blockedReason = "policy_incomplete";
    } else if (!KLARA_EXTERNAL_EXECUTION_MIGRATED) {
      blockedReason = "external_not_migrated";
    } else if (!externalConsentGranted) {
      blockedReason = "external_consent_missing";
    }
  }

  const executionAllowed = blockedReason === null;

  // ================================================================================================
  // JOB 3079 RUNDE 2 (BEN-Korrekturpflicht 1) — WEM DER MENSCH ZUSTIMMT, BEVOR ER ZUSTIMMT.
  // ================================================================================================
  //
  // DER BEFUND: die echte Panel-Ableitung zeigte im Zustimmungskasten wörtlich „Deine Frage und die
  // Texte der gefundenen Einträge gehen an Klarwerk (deterministisch)." Der Grund liegt eine Zeile
  // tiefer: `provider`/`model` folgen der Regel „angezeigt wird, was rechnet", und VOR der
  // Zustimmung rechnet nichts extern — also stehen dort die deterministischen Ersatzwerte. Für die
  // KI-Zeile ist das richtig. Für die EINWILLIGUNGSFRAGE ist es falsch: sie fragt nicht, was
  // rechnet, sondern was rechnen WÜRDE, wenn der Mensch ja sagt.
  //
  // ZWEI FRAGEN, ZWEI FELDER — und ausdrücklich kein Umdeuten von `provider`. Hätte ich `provider`
  // in `external` immer auf den Cloud-Anbieter gesetzt, stünde in der KI-Zeile ein Anbieter, der
  // gerade nichts tut; genau diese Bauform hat mega79 einmal als falsche Modellbehauptung
  // aussortiert.
  //
  // NULL HEISST „ES GIBT KEINEN EMPFÄNGER, DEN EINE ZUSTIMMUNG FREISCHALTEN WÜRDE" — und das Panel
  // bietet dann keinen Zustimmungsknopf an (dieselbe Fail-safe-Bauform wie bei den Nutzlastklassen,
  // KW-S4-22 §4: eine Zustimmung ohne bestimmten Empfänger ist nicht hinreichend bestimmt). Es ist
  // deshalb genau dann gefüllt, wenn eine Zustimmung WIRKLICH etwas bewirken kann: externer Modus,
  // vom Administrator autorisiert, Weg freigeschaltet. Bei `policy_incomplete` oder gesperrtem
  // Schalter bleibt es `null` — dort hülfe keine Zustimmung.
  //
  // DAS MODELL wird mit DERSELBEN Ableitung gebildet, die `grantConsent` in die Urkunde schreibt
  // (`resolution.model` im Freigabefall). Zwei Ableitungen wären zwei Wahrheiten: das Panel nennte
  // einen Empfänger und die gespeicherte Zustimmung einen anderen — genau der Fehler, den S2 gerade
  // behoben hat.
  // ABGELEITET AUS DER EINEN ENTSCHEIDUNGSKASKADE OBEN, nicht aus ihren Bedingungen noch einmal:
  // nach ihr ist `external_consent_missing` der einzige Blockierungsgrund, den eine Zustimmung
  // beseitigen kann (und `null` heisst, sie ist schon erteilt). Jede andere Sperre —
  // `policy_incomplete`, `external_not_migrated` — hilft keine Zustimmung, dort bleibt das Feld
  // leer. Die Bedingungen hier zu wiederholen hiesse, die Kaskade an zwei Stellen zu pflegen; der
  // Strukturpin in `klara-policy.test.ts` besteht zu Recht darauf, dass der Schalter GENAU EINE
  // lesende Stelle hat.
  const zustimmungWuerdeTragen =
    effectiveMode === "external" &&
    (blockedReason === null || blockedReason === "external_consent_missing");
  const externalConsentProvider = zustimmungWuerdeTragen ? input.providerLabel : null;
  const externalConsentModel = zustimmungWuerdeTragen
    ? (input.modelLabel ?? KLARA_DETERMINISTIC_MODEL)
    : null;

  // Anbieter und Modell folgen dem EFFEKTIVEN Modus und seiner Bindung: angezeigt wird, was rechnet.
  const laeuftMitModell = effectiveMode !== "deterministic" && executionAllowed;
  let provider = KLARA_DETERMINISTIC_PROVIDER;
  let model = KLARA_DETERMINISTIC_MODEL;
  if (laeuftMitModell && effectiveMode === "internal") {
    provider = input.localProviderLabel ?? KLARA_DETERMINISTIC_PROVIDER;
    model = input.localProviderLabel ?? KLARA_DETERMINISTIC_MODEL;
  } else if (laeuftMitModell && effectiveMode === "external") {
    provider = input.providerLabel;
    model = input.modelLabel ?? KLARA_DETERMINISTIC_MODEL;
  }

  return {
    resolutionId: input.resolutionId,
    mode: effectiveMode,
    provider,
    model,
    adminConfiguredMode,
    effectiveMode,
    deviation: effectiveMode !== adminConfiguredMode || blockedReason !== null,
    deviationReason: reason ?? blockedReason,
    externalConsentRequired,
    externalConsentGranted,
    externalConsentProvider,
    externalConsentModel,
    executionAllowed,
    blockedReason,
    resolvedAt,
    expiresAt,
    policyVersion: klaraPolicyVersion(input),
    configurationVersion: klaraConfigurationVersion(input),
    // BEN-35 Befund 1: die Auflösung nennt ihre Nutzlastklassen selbst. Sie ist für jeden Modus
    // gleich, weil der Server für jeden Modus dasselbe versendet — Frage und Kandidatentexte. Das
    // ist ehrlicher als eine modusabhängige Menge zu erfinden, die keinem Codepfad entspricht.
    effectivePayloadClasses: KLARA_PAYLOAD_CLASSES,
  };
}

/**
 * DIE VERSIONEN — abgeleitet, nicht erfunden.
 *
 * Der Vertrag verlangt `policyVersion` und `configurationVersion`; im Repository gibt es sie heute
 * nicht als persistierte Felder. Statt eine Zahl zu erfinden, werden sie aus den Werten gebildet,
 * die die Auflösung TATSÄCHLICH bestimmen. Das genügt für ihren einzigen Zweck: erkennen, ob sich
 * die Grundlage geändert hat und eine Zustimmung damit ungültig wird (KW-S4-03 §1.3 Nr. 7-10).
 *
 * Ändert sich die Admin-Wahl oder die Herkunft der Policy, ändert sich `policyVersion`. Ändert
 * sich die Verdrahtung von Anbieter oder Modell, ändert sich `configurationVersion`. Beides ist
 * stabil über Neustarts, weil es nur aus Konfigurationswerten entsteht — nie aus einem Zeitpunkt
 * oder einer Zufallszahl.
 */
export function klaraPolicyVersion(input: Pick<KlaraPolicyInput, "choice" | "source">): string {
  return `policy:${input.source}:${input.choice}`;
}

export function klaraConfigurationVersion(
  input: Pick<
    KlaraPolicyInput,
    | "cloudConfigured"
    | "localConfigured"
    | "providerLabel"
    | "modelLabel"
    | "localProviderLabel"
    | "effectiveAnswerProvider"
  >,
): string {
  const cloud = input.cloudConfigured ? "cloud" : "-";
  const local = input.localConfigured ? "local" : "-";
  // Die EFFEKTIVE Bindung gehört in die Version: wechselt sie von `cloud` auf `local`, wechselt
  // der Empfänger — und genau das muss eine erteilte Zustimmung entwerten (KW-S4-03 §1.3 Nr. 12).
  return [
    "config",
    cloud,
    local,
    input.effectiveAnswerProvider,
    input.providerLabel,
    input.modelLabel ?? "-",
    input.localProviderLabel ?? "-",
  ].join(":");
}

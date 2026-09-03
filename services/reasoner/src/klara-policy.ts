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
 * DER SCHALTER FÜR DEN EXTERNEN ANTWORTWEG — und er steht weiterhin auf AUS.
 *
 * WIE ER ENTSTAND. In der Welle W1 S4 stand er auf AUS, und das war richtig so: der damalige
 * Auftrag war ausdrücklich „Noch wird kein neuer externer Antwortweg freigeschaltet" (§16-17) und
 * „Kein neuer Modellaufruf und kein neuer externer Egress" (No-Go 3). Eine Admin-Auswahl
 * `external` führt deshalb nie zu `executionAllowed = true`, sondern zu einer ehrlichen Blockade
 * mit dem Grund `external_not_migrated` (§145). Die Konstante steht hier sichtbar und nicht als
 * verstreute Bedingung, damit die Freischaltung EINE benannte Entscheidung ist und kein Suchen.
 *
 * ============================================================================================
 * DIE OWNERENTSCHEIDUNG IST GEFALLEN — DIE FREISCHALTUNG NICHT (JOB 3033, 03.09.2026).
 * ============================================================================================
 *
 * Der Eigentümer (Pedi) hat am 03.09.2026 entschieden, den externen Antwortweg freizugeben
 * (Herkunft `PRIORITAETEN.md` Zeile V2). Die Annahme des Auftrags war: „Der Grund für die Sperre
 * ist keine fehlende Funktion, sondern eine benannte Owner-Entscheidung." DIESE ANNAHME TRÄGT
 * NICHT. Runde 1 hat die Konstante umgelegt und dabei vier Stellen freigelegt, an denen der
 * Bestand etwas anderes tut oder sagt, als die Einwilligung verspricht. Solange sie stehen, wäre
 * ein `true` hier kein freigeschalteter Weg, sondern ein unehrlicher:
 *
 *   S1 · DIE FRIST WIRD SERVERSEITIG NICHT ERZWUNGEN. `KLARA_RESOLUTION_TTL_MS` (oben) begrenzt
 *        die Anzeige — das Add-in markiert die Auflösung danach als veraltet und holt sie neu
 *        (`taskpane.html:1876-1878`, `:3222-3232`). Die AUSFÜHRUNG kennt diese Frist nicht:
 *        `pruefeExterneAusfuehrung` prüft nur die Sitzungsfrist (15 min Inaktivität). Gemessen:
 *        `tests/ka4-freischaltung/ka4-einwilligung-wirkt.test.ts`, Fall S1.
 *   S2 · DIE ZUSTIMMUNG NENNT DEN FALSCHEN EMPFÄNGER. `grantConsent` bildet sie aus der Auflösung
 *        OHNE Zustimmung; die ist blockiert, und dann melden `provider`/`model` die
 *        deterministischen Ersatzwerte (`:278-288`). In `providerReference`/`modelReference`
 *        landet deshalb „Klarwerk (deterministisch)" — während bei erteilter Zustimmung der
 *        Cloud-Anbieter ausführen würde. Fall S2 ebenda.
 *   S3 · DER ZUSTIMMUNGSUMFANG IST ZU SCHMAL BESCHRIEBEN. `KLARA_PAYLOAD_CLASS_QUESTION` (unten)
 *        weist genau eine Klasse aus, „die Frage". Der normale Antwortweg übergibt dem Modell
 *        zusätzlich Titel, Aussage und Dokumenttext der Kandidaten
 *        (`services/ask/src/service.ts:549-566`). Fall S3 ebenda.
 *   S4 · DIE FLÄCHE SAGT DAS GEGENTEIL. Alle vier Lagetexte des Add-ins behaupten, Klaras Antwort
 *        entstehe „immer ohne KI-Modell" (`taskpane.html:2113-2117`) — auch der Text für den Fall,
 *        dass in KLARWERK eine externe KI arbeitet. Fall S4 ebenda.
 *
 * DIE VIER SIND NICHT BEHAUPTET, SONDERN GEBUNDEN: die genannten Fälle sind so geschrieben, dass
 * sie HEUTE grün sind und in dem Augenblick rot werden, in dem jemand diesen Wert auf `true` legt,
 * ohne sie zu beheben. Der Schalter ist damit kein Wort mehr, sondern eine Bedingung.
 *
 * WAS AUSSERDEM UNABHÄNGIG WEITER GILT, auch nach der Behebung: die Admin-Auswahl muss `external`
 * ergeben, ein Cloud-Anbieter MIT Bezeichnung muss verdrahtet sein (sonst fällt die Auflösung auf
 * `deterministic` zurück, `:239-244`), und es muss eine deckende Einwilligung für genau diese
 * Sitzung und genau dieses Dokument vorliegen (`external_consent_missing`, `:253-255`).
 */
export const KLARA_EXTERNAL_EXECUTION_MIGRATED = false;

/**
 * DIE EINZIGE NUTZLASTKLASSE, DIE DIESER SERVER HEUTE VERSENDET.
 *
 * Sie ist keine Auswahl aus einem Katalog, sondern eine Tatsache des Bestands: die Frage des
 * Nutzers. Der Wert stand bis BEN-35 als hart codierter Vergleichswert IN der Deckungsprüfung —
 * an genau der falschen Stelle. Er gehört zur Auflösung, weil die Auflösung entscheidet, was
 * hinausginge; die Deckungsprüfung darf ihn nur noch LESEN.
 *
 * KEINE ERFUNDENE ERWEITERUNG. Die Menge bleibt einelementig, solange der Server nichts anderes
 * versendet. Käme eine zweite Klasse hinzu, wäre das eine Zustimmungsentscheidung — und die trifft
 * niemand als Nebenwirkung eines Refactorings.
 */
export const KLARA_PAYLOAD_CLASS_QUESTION = "question";

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

  let blockedReason: KlaraDeviationReason | null = null;
  if (effectiveMode === "external") {
    if (!KLARA_EXTERNAL_EXECUTION_MIGRATED) {
      blockedReason = "external_not_migrated";
    } else if (!externalConsentGranted) {
      blockedReason = "external_consent_missing";
    }
  }

  const executionAllowed = blockedReason === null;

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
    executionAllowed,
    blockedReason,
    resolvedAt,
    expiresAt,
    policyVersion: klaraPolicyVersion(input),
    configurationVersion: klaraConfigurationVersion(input),
    // BEN-35 Befund 1: die Auflösung nennt ihre Nutzlastklassen selbst. Sie ist für jeden Modus
    // gleich, weil der Server für jeden Modus dasselbe versendet — die Frage. Das ist ehrlicher
    // als eine modusabhängige Menge zu erfinden, die keinem Codepfad entspricht.
    effectivePayloadClasses: [KLARA_PAYLOAD_CLASS_QUESTION],
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

import { randomUUID } from "node:crypto";
import {
  type ModelRunContext,
  type ModelRunRepo,
  type ModelRunStatus,
  type ModelRunTask,
  // mega61 Block F: die maschinenlesbare Kennzeichnung erzeugter Ausgaben (KI-VO Art. 50 Abs. 2).
  aiGeneratedMark,
  sanitizeModelRunContext,
} from "../../model-runs";
import {
  ModelCapacityError,
  type ModellAufrufSpur,
  type ModellVerbrauch,
  mitModellAufrufSpur,
  verbrauchSumme,
} from "./model-concurrency";
// WP-D10 (Fix 3): Fehlerklasse eines gescheiterten Modellaufrufs (timeout|http|network|parse) für die
// ehrliche Fallback-Ursache und das PII-freie Diagnose-Log.
import { ModelHttpError, classifyModelFailure } from "./model-errors";
import type { ModelFailureInfo } from "./model-errors";
import {
  type AssistPreset,
  type AssistPresetInput,
  type AssistPresetRepo,
  InMemoryAssistPresetRepo,
  normalizeAssistPresets,
} from "./presets";
import {
  DeterministicProvider,
  type ReasonerProvider,
  deterministicCandidateGroups,
  honestExtractModelFailed,
} from "./provider";
import { ModelProvider, outputLanguageRule } from "./provider-model";
import { InMemoryReasonerPolicyRepo, type ReasonerPolicyRepo } from "./reasoner-policy";
// JOB 1164 D1: die reine Ableitung des Titelvorschlags (kein Modell, kein Netz, kein Zustand).
import { titelVorschlag } from "./titel-vorschlag";

import type {
  AnswerResult,
  AssistResult,
  ConflictJudgeOutcome,
  ConflictJudgeResult,
  DescribeImageResult,
  DuplicateJudgeOutcome,
  DuplicateJudgeResult,
  EnrichResult,
  ExtractResult,
  GroupCandidateInput,
  GroupCandidatesResult,
  ImportCriteriaResult,
  InterviewResult,
  JudgeFailure,
  KnowledgeRef,
  ReasonerAktiveWahl,
  ReasonerCloudAnbieter,
  ReasonerCloudAnbieterStatus,
  ReasonerConfigStatus,
  ReasonerKiFreigabe,
  ReasonerLegacyChoice,
  ReasonerLocale,
  ReasonerPolicyMigration,
  ReasonerPolicySource,
  ReasonerProbeResult,
  ReasonerReachability,
  ReasonerStatus,
  ReasonerTask,
  ReasonerTaskChoice,
  ReasonerTaskConfig,
  ReasonerTaskConfigEingabe,
  ReasonerTaskMap,
  ReasonerWahlMigration,
  Relevanztext,
  StructureResult,
} from "./types";
// JOB 3134 (KI-WAHL): die beiden externen Anbieter als Aufzählung und ihr lesbarer Name.
import { REASONER_CLOUD_ANBIETER, REASONER_CLOUD_ANBIETER_NAME } from "./types";

// SCRUM-525 P.5 (WP-C): Befund 3(a) — eine per Deploy-ENV gesetzte Policy (KLARWERK_REASONER_POLICY)
// ist eine bewusste, deklarative Vorgabe des Deploys; sie darf NICHT still von einem Admin-Schreibpfad
// zur Laufzeit überschrieben werden (sonst wäre die Deploy-Garantie „läuft mit global=X" aushebelbar,
// ohne dass das Deploy selbst geändert wurde). Eigener Fehlertyp (statt genericher Error), damit die
// Route ihn gezielt auf 409 abbilden kann — mit einer ehrlichen Begründung statt eines stillen No-ops
// oder der generischen 400-Validierungsantwort.
export class ReasonerPolicyLockedError extends Error {
  constructor() {
    super(
      "Die KI-Zuordnung ist per Deploy-Konfiguration (KLARWERK_REASONER_POLICY) festgelegt und kann " +
        "hier nicht geändert werden. Änderungen sind nur über die Deploy-ENV möglich.",
    );
    this.name = "ReasonerPolicyLockedError";
  }
}

// ================================================================================================
// JOB 3353 · B — DER LAUF SAGT SELBST, DASS DIE VERTRAULICHKEIT IHN LEER GELASSEN HAT.
// ================================================================================================
//
// WARUM ES DIESEN TYP GIBT (Codex 73217c82, Vorprüfung R2): Runde 2 hatte den Fall in der ROUTE
// erraten — „ein Fehler, den `classifyModelFailure` nicht einordnen kann, wird schon die Sperre
// gewesen sein". Das ist kein Beleg, sondern ein Umkehrschluss: ein Programmfehler in einem lokalen
// Anbieter fällt in dieselbe Klasse und hätte dem Menschen erzählt, er solle eine Einstufung
// ändern, die mit dem Fehler nichts zu tun hat. Eine falsche Erklärung ist schlimmer als gar keine.
//
// DIE AUSKUNFT GEHÖRT DORTHIN, WO SIE ENTSTEHT. Nur `runTask` weiss, welche Anbieter in der Kette
// standen, warum die Cloud fehlte und ob am Ende etwas herauskam. Dieser Fehler wird deshalb GENAU
// DANN geworfen, wenn beides gemessen zutrifft (`runTask`, Ende der Kette):
//   1. in der Kette stand kein einziger Modell-Anbieter — nur der deterministische Ersatz, UND
//   2. `cloudExcludedByConfidentiality(task, confidential)`: der Lauf war vertraulich UND für DIESE
//      Aufgabe ist ein Cloud-Anbieter verdrahtet und policy-seitig zuständig — die Cloud fehlte also
//      wegen der Vertraulichkeit und nicht, weil ohnehin keine da war.
// Das ist dasselbe Maß, mit dem `structure`/`describe`/`groupCandidates` seit WP-SHIP9-S1/S2 ihre
// Ursache „confidential" von „no-model" trennen.
//
// Fehlt eine der beiden Bedingungen, bleibt es der Fehler, der es war. Insbesondere ein LOKALER
// Anbieter, der in der Kette stand und scheiterte, ergibt nie diesen Typ: dann war die Cloud zwar
// aus, aber es gab einen zulässigen Antwortgeber, und sein Scheitern ist eine Störung.
//
// ER ERFINDET KEINEN ZWEITEN WORTLAUT (Runde 3, gemessen an service.test.ts:1033 und
// tests/n11b-…/zustimmung.test.ts:131). JOB 3276 hat für genau diese Lage bereits den ehrlichen,
// zweisprachigen Satz gebaut — „Die KI hat keine Antwort geliefert. Grund: Der Text ist als
// vertraulich eingestuft …" (`assistOhneVorschlagMeldung` + `vertraulichkeitsGrund`). Runde 2 hat
// ihn hier überschrieben und damit zwei Fassungen derselben Tatsache erzeugt; drei bestehende
// Zusagen wurden rot, und die schlechtere Fassung stand vorn. Jetzt ÜBERNIMMT dieser Typ die
// Meldung seiner Ursache und fügt nur die Einordnung hinzu. Er hat nur dort einen eigenen Satz, wo
// es keine Ursache gibt.
//
// ER TRÄGT KEINEN NUTZERTEXT: die übernommene Meldung stammt aus derselben geprüften Quelle
// (Metadaten, nie Eingabetext), und die Aufgabe ist ein Wort aus geschlossener Menge.
export class ConfidentialCloudBlockedError extends Error {
  readonly task: ModelRunTask;
  readonly ursache: unknown;
  constructor(task: ModelRunTask, ursache?: unknown) {
    const geerbt = ursache instanceof Error ? ursache.message.trim() : "";
    super(
      geerbt.length > 0
        ? geerbt
        : `Vertraulicher Text (${task}): die Cloud-KI ist ausgeschlossen, und es stand kein zulässiger Anbieter zur Verfügung — der Lauf blieb ohne Ergebnis.`,
    );
    this.name = "ConfidentialCloudBlockedError";
    this.task = task;
    this.ursache = ursache;
  }
}

// SCRUM-525 P.5 (WP6): der DEFINIERTE Default der KI-Zuordnung, wenn nichts persistiert ist. Exportiert,
// damit Aufrufer/Tests den Default benennen können (kein magisches, verstecktes "auto").
export const DEFAULT_REASONER_POLICY: ReasonerTaskConfig = { global: "auto", perTask: {} };

// SCRUM-525 P.5 (WP3-Batch3): FAIL-CLOSED-Default, wenn die persistierte Policy beim Start NICHT gelesen
// werden kann (DB-Fehler). Bewusst "deterministic" (kein externer Modell-Egress, antwortet immer) statt
// still "auto": lieber KI-Features degradieren als unter UNBEKANNTER Policy ungewollt an die Cloud gehen.
// Der Ladefehler wird zusätzlich LAUT geloggt; sobald die DB wieder erreichbar ist, greift die Admin-Wahl.
export const LOAD_FAILURE_FALLBACK_POLICY: ReasonerTaskConfig = {
  global: "deterministic",
  perTask: {},
};

// JOB 3134: die AKTIVEN Werte plus die beiden ABGELÖSTEN (`model`, `cloud`), die an jeder
// Eingangsstelle noch angenommen, aber sofort migriert werden (s. `migriereWahl`).
const VALID_CHOICES: readonly ReasonerTaskChoice[] = [
  "auto",
  "openai",
  "anthropic",
  "local",
  "deterministic",
  "model",
  "cloud",
];

const LEGACY_CHOICES: readonly ReasonerLegacyChoice[] = ["model", "cloud"];

function istAbgeloesteWahl(choice: ReasonerTaskChoice): choice is ReasonerLegacyChoice {
  return (LEGACY_CHOICES as readonly string[]).includes(choice);
}

// JOB 3134: die Kante des Erreichbarkeits-Speichers — je externer Anbieter eine, dazu die lokale.
type ReachKante = ReasonerCloudAnbieter | "local";

// Die beiden externen Provider, so wie die Kompositionswurzel sie verdrahtet — plus je Anbieter der
// Grund, wenn keiner entstand (`createCappedCloudClientFromEnv`, model-client.ts).
export interface ReasonerCloudAnbindung {
  anbieter: Partial<Record<ReasonerCloudAnbieter, ReasonerProvider>>;
  gruende?: Partial<Record<ReasonerCloudAnbieter, string>>;
}

// Der Anbieter eines Cloud-Providers, gelesen aus dem Clientnamen — DERSELBE Vertrag, den die Fläche
// liest (`apps/web/src/lib/aiOverview.ts`): `cloud:openai:<modell>` bzw. `anthropic:<modell>`, gesetzt
// von der Stelle, die die Verbindung wirklich aufbaut (model-client.ts).
function anbieterAusName(name: string): ReasonerCloudAnbieter | undefined {
  if (name.startsWith("cloud:openai:")) {
    return "openai";
  }
  if (name.startsWith("anthropic:")) {
    return "anthropic";
  }
  return undefined;
}

// ================================================================================================
// JOB 3420 (UX-10b) — DIE URSACHE EINER GESCHEITERTEN PROBE, SO WIE SIE GEMESSEN WURDE.
// ================================================================================================
//
// Bis hierher trug das Probe-Ergebnis nur die ROHMELDUNG (`detail`). Die Fläche hängte daran EINEN
// pauschalen Ratschlag („Schlüssel erneuern") — auch bei einem 400, bei dem ein neuer Schlüssel
// nichts ändert, und auch beim eigenen lokalen LLM. Die Klasse war die ganze Zeit ableitbar; sie
// wurde an dieser einen Stelle nur nicht gebildet.
//
// WAS HIER NICHT PASSIERT: `anbieterGrund` wird NUR aus einem echten `ModelHttpError` gelesen, nie
// aus der Meldung geraten. Und es wird kein Feld gesetzt, für das keine Messung vorliegt —
// `exactOptionalPropertyTypes` macht daraus keine `undefined`-Werte, sondern fehlende Schlüssel.
function probeUrsache(
  error: unknown,
): Pick<ReasonerProbeResult, "fehlerklasse" | "status" | "anbieterGrund"> {
  const befund = classifyModelFailure(error);
  const grund = error instanceof ModelHttpError ? error.anbieterGrund : undefined;
  return {
    fehlerklasse: befund.failureClass,
    ...(befund.status === undefined ? {} : { status: befund.status }),
    ...(grund === undefined ? {} : { anbieterGrund: grund }),
  };
}

// WP-BILD-1c: die EINE Task-Liste für Policy-Validierung und KI-Verwaltungs-Anzeige (vorher drei
// Inline-Kopien). "describe" = KI-Bildbeschreibungs-Vorschlag (nur mit Vision-fähigem Cloud-Client).
//
// JOB 615 D7: Die Liste steht jetzt in `./types` (dort steht auch, warum genau dort) und wird hier
// nur DURCHGEREICHT. Kein zweiter Wortlaut, keine Drift — `tests/reasoner/
// job615-public-status-task-contract.test.ts` macht eine wiederkehrende zweite Liste gezielt rot.
// Importiert UND re-exportiert: die Datei benutzt die Liste selbst (publicStatus, configStatus),
// und `services/reasoner/index.ts:10` holt sie weiterhin von hier.
import { REASONER_TASKS } from "./types";
export { REASONER_TASKS };

// JOB 615 D7: baut eine VOLLSTÄNDIGE Karte über die geschlossene Aufgabenmenge.
//
// Vorher stand hier `Object.fromEntries(...)`. Dessen Rückgabetyp ist `{ [k: string]: T }` — genau
// darüber entstand die offene Signatur `Record<string, boolean>`, in der ein Tippfehler nicht
// auffällt, sondern als `undefined` bis zur Oberfläche reist und dort still einen Knopf ausgraut.
// Der `reduce` schreibt in ein Ziel geschlossener Form; fehlt eine Aufgabe, ist das ein Typfehler.
function aufgabenKarte(wert: (task: ReasonerTask) => boolean): ReasonerTaskMap {
  return REASONER_TASKS.reduce((karte, task) => {
    karte[task] = wert(task);
    return karte;
  }, {} as ReasonerTaskMap);
}

// WP-IC-4: harte Server-Kappung der KI-Gruppierung — mehr Kandidaten je Aufruf lehnt die Route
// mit einer ehrlichen Meldung ab (weiter eingrenzen), statt still zu kappen.
export const MAX_GROUP_CANDIDATES = 200;

// ================================================================================================
// JOB 1164 · D1 (TV1 Stufe 1) — DER TITELVORSCHLAG AN DER DIENSTGRENZE.
// ================================================================================================
//
// REICHWEITE: serverinterne Vorarbeit. Das Feld reist ab hier durch Route und Client (beide reichen
// das Ergebnisobjekt unverändert durch — gemessen in JOB 1161 D1: `reasoner-routes.ts:322-324`,
// `endpoints.ts:473`). Ein Anwender sieht davon nichts; der Renderer ist Stufe 2.
//
// EINE STELLE, NICHT ZWEI. `describeImage` hat zwei Rückgabewege — Modell hat geantwortet und
// deterministischer Rückfall mit Ursache. Beide laufen durch diese Funktion, aus demselben Grund,
// aus dem `aiGenerated` zentral gesetzt wird: zwei Stellen wären zwei Gelegenheiten, eine zu
// vergessen.
//
// NUR DER ERFOLGSFALL WIRD GESETZT. Liefert die Ableitung keinen Titel, bleibt das Feld ABWESEND —
// nicht `titel: null`, nicht leer. Der Aufrufer soll „kein Vorschlag" nicht von einem leeren
// Vorschlag unterscheiden müssen; es gibt dann schlicht nichts.
//
// DAS ERGEBNIS MUSS VOLLSTÄNDIG SEIN, BEVOR ES HIER ANKOMMT: `titelVorschlag` prüft
// `fallbackReason === "confidential"` ZUERST (titel-vorschlag.ts:139) — ein vertrauliches Bild darf
// über den Umweg eines Titels keine Aussage erzeugen. Wer diese Funktion vor dem Setzen von
// `fallbackReason` aufruft, hebelt genau diese Prüfung aus.
function mitTitelVorschlag(ergebnis: DescribeImageResult): DescribeImageResult {
  const vorschlag = titelVorschlag(ergebnis);
  return vorschlag.grund === "abgeleitet" ? { ...ergebnis, titelVorschlag: vorschlag } : ergebnis;
}

// WP-BILD-1c/1f: schneller String-Vorab-Deckel für die describe-Bild-Daten (data:image-URL-Länge in
// Zeichen). AUTORITATIV ist die DEKODIERTE Bytegrenze MAX_DESCRIBE_IMAGE_BYTES (5 MB, bens P3 —
// s. image-validation.ts); dieser Vorab-Deckel liegt deshalb bewusst darüber (~5,25 MB dekodiert)
// und fängt nur grob Überdimensioniertes ab, bevor überhaupt geparst wird.
export const MAX_DESCRIBE_IMAGE_DATAURL_CHARS = 7_000_000;

export function isValidReasonerChoice(value: string): value is ReasonerTaskChoice {
  return (VALID_CHOICES as readonly string[]).includes(value);
}

function clone(config: ReasonerTaskConfig): ReasonerTaskConfig {
  return {
    global: config.global,
    perTask: { ...config.perTask },
    // JOB 3549: die Freigabe reist mit — sonst verlöre `clone` sie beim Setzen des Default oder des
    // fail-closed Ladewerts. Beide Vorlagen (DEFAULT_REASONER_POLICY, LOAD_FAILURE_FALLBACK_POLICY)
    // tragen bewusst KEINE Freigabe; dass sie hier trotzdem kopiert würde, ist die Zusage für jeden
    // anderen Aufrufer und nicht der Weg, auf dem eine Vorgabe hereinkäme.
    ...(config.kiFreigabe ? { kiFreigabe: { ...config.kiFreigabe } } : {}),
  };
}

// ================================================================================================
// JOB 3549 · DIE FREIGABE NORMALISIEREN — NUR `true` ZÄHLT, ALLES ANDERE IST „NICHT FREIGEGEBEN".
// ================================================================================================
//
// EINE Stelle, die aus einer Eingabe (Adminweg, Datenbankbestand, Deploy-ENV) den WIRKSAMEN Wert
// macht. Sie ist bewusst streng:
//   - jeder Schalter, der nicht wörtlich `true` ist, fällt weg (auch `"true"`, `1`, `{}`),
//   - bleibt nichts übrig, gibt es kein Feld — „gesperrt" hat genau EINE Darstellung.
// Ohne diese Verengung gäbe es zwei Arten von „nicht freigegeben" (`false` und „fehlt"), und jede
// spätere Prüfung müsste beide kennen. Genau daraus entstehen die Lücken, die dieser Auftrag
// schließt. Der Vertrag sagt es wörtlich: „Nur `true` erlaubt; `false` und ‚fehlt' sperren gleich."
function normalisiereKiFreigabe(
  eingabe: ReasonerKiFreigabe | undefined,
): ReasonerKiFreigabe | undefined {
  if (!eingabe || typeof eingabe !== "object") {
    return undefined;
  }
  const wirksam: ReasonerKiFreigabe = {
    ...(eingabe.oeffentlicheKi === true ? { oeffentlicheKi: true } : {}),
    ...(eingabe.vertraulicheInhalte === true ? { vertraulicheInhalte: true } : {}),
  };
  return Object.keys(wirksam).length > 0 ? wirksam : undefined;
}

// IC-3: eng geschnittener, JSON-liefernder System-Prompt für die Import-Auswahl. Das Modell soll aus
// dem Freitext NUR die belegbaren Filter ableiten und AUSSCHLIESSLICH JSON zurückgeben — nichts erfinden.
function importSelectSystem(locale: ReasonerLocale): string {
  const contract =
    '{"themes": string[], "keywords": string[], "authors": string[], ' +
    '"yearFrom": number|null, "yearTo": number|null}';
  // mega52 D3: die abgeleiteten Themen-Labels erscheinen dem Nutzer in der Import-Auswahl — auch
  // dieser Task legt seine Ausgabesprache ausdrücklich fest, statt sie dem Prompt-Zwilling zu
  // überlassen. Die `keywords` sind Suchbegriffe aus dem Nutzertext und bleiben davon unberührt.
  const base =
    locale === "de"
      ? `Du wandelst einen Freitext-Importwunsch in Auswahl-Filter um. Antworte AUSSCHLIESSLICH mit JSON: ${contract}. themes = Themen-Labels, keywords = Wörter für Titel/Text-Treffer, authors = Personennamen, yearFrom/yearTo = Zeitraum. Nutze nur, was der Text klar hergibt; lass ein Feld leer, wenn unsicher. Erfinde nichts.`
      : `You turn a user's free-text import request into selection filters. Respond ONLY with JSON: ${contract}. themes = topic labels, keywords = words to match in title/text, authors = person names, yearFrom/yearTo = time range. Use only what the text clearly states; leave a field empty if unsure. Invent nothing.`;
  return `${base} ${outputLanguageRule(locale)}`;
}

// ================================================================================================
// JOB 3276 (KI-ASSIST-LEER) — WANN IST EIN „VORSCHLAG" EINER?
// ================================================================================================
//
// Verglichen wird der INHALT, nicht die Zeichenkette. Ein Vergleich auf Gleichheit der Zeichen
// hätte den gemessenen Fall NICHT gefangen: der deterministische Ersatz gibt „notirt anzahl" als
// „Notirt anzahl." zurück — eine andere Zeichenkette, derselbe Text, dieselben Fehler. Genau das
// stand am 08.09. als „KI-Vorschlag" auf dem Bildschirm.
//
// Die Normalform tilgt deshalb GENAU das, was der Ersatz zu leisten vermag (Leerraum, Groß-/
// Kleinschreibung, Schlusszeichen) — und nichts darüber hinaus. Ein Ersatz, der eines Tages
// wirklich umformuliert, kommt damit durch; ein kosmetischer nicht.
function assistInhaltsform(text: string): string {
  return text
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[.!?…]+$/u, "")
    .trim()
    .toLowerCase();
}

function istEchterVorschlag(original: string, vorschlag: string): boolean {
  const neu = assistInhaltsform(vorschlag);
  return neu.length > 0 && neu !== assistInhaltsform(original);
}

// ================================================================================================
// JOB 3276 RUNDE 3 — DASSELBE FÜR DAS MODELL, ABER MIT ANDEREM MASSSTAB.
// ================================================================================================
//
// Codex' Vorprüfung R2 (08.09. 16:30) hat den zweiten Weg gemessen: das Modell antwortet NICHT
// leer, sondern gibt den Text unverändert zurück — und der ging bis hierher als „KI-Vorschlag"
// hinaus. Für den Menschen ist das derselbe Betrug wie der geglättete Ersatz: er klickt
// „Rechtschreibung", bekommt „notirt" zurück und glaubt, es sei geprüft.
//
// DER MASSSTAB IST HIER ABER EIN ANDERER als beim deterministischen Ersatz. Der Ersatz KANN nur
// Groß-/Kleinschreibung und Schlusszeichen; deshalb zählt beides bei ihm nicht als Leistung. Ein
// MODELL, das genau diese Fehler korrigiert („der ventil schließen" → „Der Ventil schließen."), hat
// dagegen wirklich gearbeitet — bei ihm wird nur der Leerraum normalisiert, sonst nichts.
// Codex' Wortlaut: „echte Korrekturen an Satzzeichen/Großschreibung bleiben ein gültiger Vorschlag
// (Vergleich normalisiert nur Whitespace)".
function modellInhaltsform(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

function istEchterModellVorschlag(original: string, vorschlag: string): boolean {
  const neu = modellInhaltsform(vorschlag);
  return neu.length > 0 && neu !== modellInhaltsform(original);
}

// Die Meldung, die der Mensch liest, wenn es keinen Vorschlag gibt. DE/EN gleichwertig (die
// Vorführung am 11.09. läuft auf Englisch); NL folgt der Hausregel der übrigen ehrlichen
// Servermeldungen (z. B. der extract-Note) und bekommt den deutschen Satz.
//
// SIE NENNT IMMER EINEN GRUND. Ohne Grund wäre sie zwar ehrlich, aber unbrauchbar: „Es hat nicht
// geklappt" sagt niemandem, ob der Schlüssel fehlt, das Modell abgewiesen hat oder das Budget im
// Denken aufging. Der Grund ist die Fehlermeldung des Modells (Metadaten: Anbieter, Status,
// finish_reason, Budget) — sie trägt nie Text des Nutzers.
function vertraulichkeitsGrund(locale: ReasonerLocale): string {
  return locale === "en"
    ? "The text is classified as confidential — the cloud AI must not process it."
    : "Der Text ist als vertraulich eingestuft — die Cloud-KI darf ihn nicht verarbeiten.";
}

function assistOhneVorschlagMeldung(locale: ReasonerLocale, modellFehler: string | null): string {
  const grund = modellFehler?.trim();
  if (locale === "en") {
    return `The AI returned no answer. Reason: ${
      grund && grund.length > 0
        ? grund
        : "No AI model answered; the deterministic fallback would only have returned the original text."
    }`;
  }
  return `Die KI hat keine Antwort geliefert. Grund: ${
    grund && grund.length > 0
      ? grund
      : "Kein KI-Modell hat geantwortet; die deterministische Ersatzform hätte nur den Originaltext zurückgegeben."
  }`;
}

// JOB 3276 R3: DIE ZWEITE, SCHWÄCHERE LAGE — und sie braucht ihren eigenen Satz. „Die KI hat keine
// Antwort geliefert" wäre hier schlicht unwahr: sie HAT geantwortet, sie hatte nur nichts zu ändern.
// Wer „Rechtschreibung" auf einen fehlerfreien Satz klickt, soll genau das erfahren und nicht einen
// Ausfall vermuten (Codex-Vorprüfung R2: „ehrlich ‚Keine Änderungen vorgeschlagen‘ … statt ‚KI
// antwortete nicht‘"). Der Grund trägt Anbieter/Modell — nie den Text des Nutzers.
function assistOhneAenderungMeldung(locale: ReasonerLocale, grund: string): string {
  return locale === "en"
    ? `The AI proposed no changes. Reason: ${grund}`
    : `Die KI hat keine Änderungen vorgeschlagen. Grund: ${grund}`;
}

// IC-3: erstes JSON-Objekt aus einer Modell-Antwort robust herausschneiden (geschwätzige Prosa/Code-
// Fences toleriert). Kein Treffer/kein gültiges JSON → null (der Aufrufer nutzt dann leere Kriterien).
function parseFirstJsonObject(raw: string): unknown | null {
  const start = raw.indexOf("{");
  if (start < 0) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// FR-RSN-01: gebündelte Aufgaben über die Reasoner-Schicht.
// FR-RSN-06: der KI-Schlüssel lebt ausschließlich im Provider (serverseitig),
// der Reasoner reicht ihn nie nach außen — Status/Ergebnisse enthalten keinen Schlüssel.
export class Reasoner {
  // JOB 3134 (KI-WAHL): die externen Anbieter EINZELN, unter ihrem Namen. Bis hierher gab es genau
  // einen `primary`, und WER das war, hatte die Fabrik nach einer Vorzugsregel entschieden. Jetzt
  // steht je Anbieter ein Provider (oder keiner), und die gespeicherte Wahl bestimmt, welcher in
  // die Kette kommt — nie beide in derselben Kette (kein heimlicher Wechsel).
  private readonly cloud: Record<ReasonerCloudAnbieter, ReasonerProvider | undefined>;
  // Warum ein Anbieter NICHT eingerichtet ist — geheimnisfreier Satz mit Env-Namen, aus der Fabrik.
  private readonly cloudGruende: Partial<Record<ReasonerCloudAnbieter, string>>;
  // SCRUM-424: der eigene lokale LLM als zweites echtes Backend (Cloud + lokal). Ohne
  // Angabe = deterministischer Fallback (dann gibt es effektiv nur Cloud + Ersatzmodus).
  private readonly secondary: ReasonerProvider;
  private readonly fallback: ReasonerProvider;
  // SCRUM-164: optionales ModelRun-Protokoll. Ohne Repo → No-op (rückwärtskompatibel).
  private readonly modelRuns: ModelRunRepo | undefined;
  // SCRUM-386: kundeneigene Assist-Presets — echtes Repo (Pg/Dev-Journal); ohne Repo In-Memory.
  private readonly presetRepo: AssistPresetRepo;
  // SCRUM-525 P.5 (WP6): persistente KI-Zuordnung (Policy). Ohne Repo In-Memory (Tests/Dev).
  private readonly policyRepo: ReasonerPolicyRepo;

  // PAKET 2 (D-AISTATE, Pedi 23.07.): LEICHTER, GECACHTER Erreichbarkeits-Zustand für die Top-Badges.
  // Bewusst KEIN Ping pro Request (Kosten/Rate): der Cache lebt REACHABILITY_TTL_MS; publicStatus()
  // liest NUR den Cache (synchron), und refreshReachabilityIfStale() stößt höchstens einmal je Frist
  // einen echten Hintergrund-Probe an (feuern-und-vergessen). recordReachability() lässt zusätzlich
  // echte Task-Ausgänge den Cache auffrischen (schonendste Variante — kein Extra-Netz).
  // D-AISTATE PAKET 3 (bens V4, aistate-fix3): der Cache ist PRO PROVIDERKANTE (cloud/local) —
  // vorher galt global „irgendein Modell erreichbar", wodurch eine cloud-gestellte Task bei
  // unerreichbarer Cloud + erreichbarem Local fälschlich als nutzbar erschien. Die per-Task-Karte
  // (publicStatus.tasks) wertet jetzt GENAU die Kette der Task gegen die Kanten-Zustände aus.
  private static readonly REACHABILITY_TTL_MS = 60_000;
  // JOB 3134: eine Kante je externem Anbieter (statt einer gemeinsamen „cloud"-Kante) plus die lokale.
  private readonly reachabilityCache: Record<
    ReachKante,
    { at: number; reachable: boolean } | null
  > = { openai: null, anthropic: null, local: null };
  private reachabilityProbeInFlight = false;

  constructor(
    // Der EINE Cloud-Provider des Bestands (vor JOB 3134). Weiterhin angenommen, damit die
    // positionalen Aufrufe unverändert bleiben; sein Anbieter wird aus dem Clientnamen gelesen
    // (`anbieterAusName`), und ein Provider OHNE erkennbaren Anbieter gilt als Anthropic — der Weg,
    // den `primary` seit FR-RSN-02 bis JOB 3090 ausschliesslich bedeutete. Wer beide Anbieter
    // verdrahtet, nutzt `cloud` (unten) und lässt diesen Parameter leer.
    primary?: ReasonerProvider,
    fallback: ReasonerProvider = new DeterministicProvider(),
    modelRuns?: ModelRunRepo,
    assistPresets?: AssistPresetRepo,
    // SCRUM-424: optionaler zweiter Provider (eigener lokaler LLM). Als LETZTER Parameter,
    // damit bestehende (positionale) Aufrufe unverändert bleiben.
    secondary?: ReasonerProvider,
    // SCRUM-525 P.5 (WP6): optionales Policy-Repo. Als LETZTER Parameter — bestehende positionale
    // Aufrufe bleiben unverändert. Ohne Repo → In-Memory (Policy lebt nur für die Prozesslaufzeit).
    policyRepo?: ReasonerPolicyRepo,
    // JOB 3134: BEIDE externen Anbieter unter ihrem Namen (Kompositionswurzel). Schliesst `primary`
    // aus — zwei Wege an dieselbe Kette wären zwei Wahrheiten darüber, wer die Cloud ist.
    cloud?: ReasonerCloudAnbindung,
  ) {
    if (cloud && primary) {
      throw new Error(
        "Reasoner: entweder `primary` (Bestand) oder `cloud` (JOB 3134), nicht beides.",
      );
    }
    this.cloud = { openai: undefined, anthropic: undefined };
    if (cloud) {
      this.cloud.openai = cloud.anbieter.openai;
      this.cloud.anthropic = cloud.anbieter.anthropic;
    } else if (primary && primary !== fallback) {
      this.cloud[anbieterAusName(primary.name) ?? "anthropic"] = primary;
    }
    this.cloudGruende = { ...(cloud?.gruende ?? {}) };
    this.secondary = secondary ?? fallback;
    this.fallback = fallback;
    this.modelRuns = modelRuns;
    this.presetRepo = assistPresets ?? new InMemoryAssistPresetRepo();
    this.policyRepo = policyRepo ?? new InMemoryReasonerPolicyRepo();
  }

  // ---- SCRUM-386: kundeneigene KI-Assist-Funktionen (Presets) ----
  // Lesen darf jede Rolle (die Palette zeigt sie an); Schreiben guarded die Route (Admin).
  // Replace-Semantik: die Admin-UI pflegt die komplette Liste; ids bleiben stabil, neue
  // Einträge bekommen hier ihre UUID (das Repo erhält fertige ids — Journal-Replay exakt).
  async getAssistPresets(): Promise<AssistPreset[]> {
    return this.presetRepo.list();
  }

  async setAssistPresets(input: readonly AssistPresetInput[]): Promise<AssistPreset[]> {
    const next = normalizeAssistPresets(input, () => randomUUID());
    await this.presetRepo.replaceAll(next);
    return this.presetRepo.list();
  }

  // JOB 3134: der Provider EINES externen Anbieters — nur, wenn er verdrahtet und verfügbar ist.
  private cloudProvider(anbieter: ReasonerCloudAnbieter): ReasonerProvider | undefined {
    const provider = this.cloud[anbieter];
    return provider && provider !== this.fallback && provider.isAvailable() ? provider : undefined;
  }

  // Ist IRGENDEIN externer Anbieter verdrahtet & verfügbar? (Bis JOB 3134 hiess das `usingPrimary`.)
  private usingAnyCloud(): boolean {
    return REASONER_CLOUD_ANBIETER.some((anbieter) => this.cloudProvider(anbieter) !== undefined);
  }

  // SCRUM-424: ist der eigene lokale LLM verdrahtet & verfügbar (kein Alias auf den Fallback)?
  private usingSecondary(): boolean {
    return this.secondary.isAvailable() && this.secondary !== this.fallback;
  }

  // JOB 3134: der Anbieter, auf den „auto" (und die abgelösten Werte `cloud`/`model`) aufgelöst
  // werden — der ERSTE eingerichtete in der Reihenfolge von REASONER_CLOUD_ANBIETER. Das ist genau
  // die Reihenfolge, nach der die alte Fabrik entschied (OpenAI vor Anthropic); sie ist jetzt
  // sichtbar (`configStatus().autoAnbieter`) und mit einer ausdrücklichen Wahl überstimmbar.
  private vorgabeAnbieter(): ReasonerCloudAnbieter | undefined {
    return REASONER_CLOUD_ANBIETER.find((anbieter) => this.cloudProvider(anbieter) !== undefined);
  }

  // Welchen externen Anbieter eine Wahl MEINT — unabhängig davon, ob er eingerichtet ist. Eine
  // ausdrückliche Wahl meint sich selbst (auch wenn der Anbieter fehlt: dann bleibt die Kette ohne
  // Cloud, und der Grund steht in `cloudProviders`); `auto` meint den Vorgabe-Anbieter; lokal und
  // deterministisch meinen keinen.
  private anbieterFuerWahl(choice: ReasonerTaskChoice): ReasonerCloudAnbieter | undefined {
    switch (choice) {
      case "openai":
      case "anthropic":
        return choice;
      case "auto":
      case "cloud":
      case "model":
        return this.vorgabeAnbieter();
      default:
        return undefined;
    }
  }

  // Der verfügbare Cloud-Provider einer Wahl — oder keiner.
  private cloudFuerWahl(choice: ReasonerTaskChoice): ReasonerProvider | undefined {
    const anbieter = this.anbieterFuerWahl(choice);
    return anbieter ? this.cloudProvider(anbieter) : undefined;
  }

  // Unter welchem Anbieter ein Provider verdrahtet ist — für Kanten, Labels und das Protokoll.
  private anbieterVon(provider: ReasonerProvider): ReasonerCloudAnbieter | undefined {
    return REASONER_CLOUD_ANBIETER.find((anbieter) => this.cloud[anbieter] === provider);
  }

  private kanteVon(provider: ReasonerProvider): ReachKante {
    return this.anbieterVon(provider) ?? "local";
  }

  // SCRUM-424: geordnete Provider-Kette je Aufgabe aus der bewussten Zuordnung.
  //  - "auto"                Vorgabe-Anbieter → lokal → deterministisch (verfügbare in dieser Reihenfolge)
  //  - "openai"/"anthropic"  GENAU dieser Anbieter (dann deterministisch) — JOB 3134
  //  - "local"               lokaler LLM (dann deterministisch)
  //  - "deterministic"       nur deterministisch
  // Der deterministische Fallback ist IMMER das letzte Glied (FR-RSN-04, antwortet stets).
  // JOB 3134 — KEIN HEIMLICHER WECHSEL: in KEINER Kette stehen zwei externe Anbieter. Scheitert
  // der gewählte (400/401/429/Netz), folgt der lokale LLM (nur bei `auto`) oder der deterministische
  // Ersatz — ehrlich als Ersatz gekennzeichnet (`demo`, `fallbackReason`) —, nie der andere externe
  // Anbieter.
  // SCRUM-502 Schicht 2: `confidential` = der Eingabetext (KO/Draft) ist vertraulich → die Cloud
  // wird aus der Kette GENOMMEN. Vertraulicher Text verlässt den Server nie extern; es bleibt der
  // lokale LLM (falls verdrahtet) und/oder der deterministische Fallback. Die Durchsetzung liegt
  // hier zentral am Routing, damit kein Aufrufer sie vergessen kann — für BEIDE externen Anbieter.
  // ==============================================================================================
  // JOB 3549 · DIE EINE ENTSCHEIDUNGSSTELLE: DARF JETZT ETWAS AN EINE ÖFFENTLICHE KI HINAUS?
  // ==============================================================================================
  //
  // Sie steht hier und NUR hier. Jede andere Stelle, die etwas über den Cloudweg wissen will, fragt
  // sie — keine zweite Auffassung, kein zweiter Riegel, den ein Aufrufer vergessen kann. Genau das
  // war der Fehler, den dieser Auftrag beseitigt: bis hierher entschied der Code selbst („vertraulich
  // ⇒ nie Cloud"), und die Erlaubnis für den gewöhnlichen Fall war überhaupt keine Entscheidung,
  // sondern die Verdrahtung.
  //
  // DIE REGEL, wörtlich aus Pedis Entscheidung (10.09. 21:25, über Codex 07cc6d07):
  //   1. Ohne AUSDRÜCKLICHE Grundfreigabe geht NICHTS hinaus — auch nicht bei einer Instanz, die
  //      heute läuft. Bloße frühere Nutzung ist keine Zustimmung.
  //   2. Vertrauliches braucht ZUSÄTZLICH die zweite Freigabe. Sie erweitert die erste, sie ersetzt
  //      sie nicht: ohne Grundfreigabe ist sie wirkungslos (deshalb die frühe Rückkehr).
  //   3. Nur `true` erlaubt. `false` und „fehlt" sperren gleich — im Zweifel gesperrt.
  //
  // WAS SIE NICHT IST: eine Aussage darüber, WER eingerichtet oder gewählt ist. Diese Frage
  // beantwortet `chainForChoice(..., { fuerAnzeige: true })`, und sie beantwortet sie auch ohne
  // Freigabe — Sichtbarkeit ist keine Erlaubnis, aber eine fehlende Erlaubnis ist auch kein Grund,
  // den eingerichteten Anbieter zu verschweigen (Pedi: „Der Anbieter bleibt sichtbar, es gibt keinen
  // Demo-Sonderweg").
  private oeffentlicheKiErlaubt(confidential: boolean): boolean {
    const freigabe = this.taskConfig.kiFreigabe;
    if (freigabe?.oeffentlicheKi !== true) {
      return false;
    }
    return !confidential || freigabe.vertraulicheInhalte === true;
  }

  private chainForChoice(
    choice: ReasonerAktiveWahl,
    confidential = false,
    // JOB 3549: `fuerAnzeige` beantwortet die KONFIGURATIONSfrage („wer ist eingerichtet und
    // gewählt") statt der Egressfrage („darf jetzt etwas hinaus"). Es hebt AUSSCHLIESSLICH den
    // Freigabe-Riegel auf, niemals die Vertraulichkeitsregel — und es hat keinen einzigen Aufrufer
    // auf einem Weg, auf dem echter Text das Haus verlässt. Die Liste dieser Aufrufer steht bei
    // `activeModelProvider`, `effectiveAnbieterFor` und `configStatus`.
    // JOB 3549 R2: dazu kommt `durchVertraulichkeitAusgeschlossen()` — der einzige Aufrufer, der die
    // Kette nicht einmal ausliest, sondern nur zwei Mitgliedschaften vergleicht (Ursachenfrage).
    opts?: { fuerAnzeige?: boolean },
  ): ReasonerProvider[] {
    const chain: ReasonerProvider[] = [];
    if (choice !== "deterministic") {
      const darfHinaus =
        opts?.fuerAnzeige === true ? !confidential : this.oeffentlicheKiErlaubt(confidential);
      if (darfHinaus && choice !== "local") {
        const cloud = this.cloudFuerWahl(choice);
        if (cloud) {
          chain.push(cloud);
        }
      }
      // SCRUM-502 Round 4 (P1): vertraulich schließt die Cloud aus, ABER der lokale LLM (on-prem, kein
      // externer Egress) darf einspringen — auch bei expliziter Anbieterwahl. So degradiert
      // vertraulicher Text nicht unnötig auf „deterministisch", wenn ein lokales Modell verdrahtet ist.
      // aistate-fix3 (bens V1): „lokal" nur, wenn der Secondary vertraulichkeits-tauglich ist
      // (bestätigte On-Prem-Origin, rejectsConfidential()!==true) — ein fremd verdrahteter Endpunkt
      // fällt bei vertraulichem Text aus der Kette (kein Egress, deterministischer Fallback trägt).
      if (
        (choice === "auto" || choice === "local" || confidential) &&
        this.usingSecondary() &&
        !(confidential && this.secondary.rejectsConfidential?.() === true)
      ) {
        chain.push(this.secondary);
      }
    }
    chain.push(this.fallback);
    return chain;
  }

  private providerChain(task: ModelRunTask, confidential = false): ReasonerProvider[] {
    return this.chainForChoice(this.choiceFor(task), confidential);
  }

  // Welche KI läuft je Aufgabe EFFEKTIV zuerst (für die ehrliche Anzeige) — die STUFE.
  private providerLabelFor(task: ModelRunTask): "cloud" | "local" | "deterministic" {
    const anbieter = this.effectiveAnbieterFor(task);
    return anbieter === "local" || anbieter === "deterministic" ? anbieter : "cloud";
  }

  // JOB 3134: dieselbe Auflösung mit dem NAMEN des externen Anbieters — „extern" sagt nicht, wem
  // die Texte gezeigt werden.
  // JOB 3549: ANZEIGE, nicht Egress. Dieses Feld (`configStatus().effectiveAnbieter`, darüber auch
  // `effectiveProvider`) beantwortet „welcher Anbieter ist für diese Aufgabe eingerichtet und
  // gewählt" — und muss das auch dann beantworten, wenn die Freigabe fehlt, sonst stünde auf der
  // Adminfläche „kein KI-Modell" statt „ChatGPT eingerichtet · Freigabe fehlt" und niemand fände den
  // Schalter, der zu setzen wäre. Ob wirklich etwas läuft, sagt daneben `configStatus().effective`
  // (`effectiveFor`, gegated) — die beiden Antworten stehen bewusst nebeneinander.
  private effectiveAnbieterFor(
    task: ModelRunTask,
  ): ReasonerCloudAnbieter | "local" | "deterministic" {
    const first = this.chainForChoice(this.choiceFor(task), false, { fuerAnzeige: true })[0];
    if (!first || first === this.fallback) {
      return "deterministic";
    }
    if (first === this.secondary && this.usingSecondary()) {
      return "local";
    }
    return this.anbieterVon(first) ?? "deterministic";
  }

  // Key-Test (Pedi 02.07.): ehrlicher Echtaufruf statt Anzeige-Vermutung. Ohne Modell
  // klarer Befund; Fehler werden benannt (z. B. 401 = Schlüssel ungültig), nie geraten.
  // Kein Fallback-Umweg: der Test prüft GENAU den konfigurierten Modellzugang.
  //
  // JOB 3134: geprüft wird der Anbieter, den die GESPEICHERTE globale Wahl bestimmt — nicht „der
  // erste verfügbare". Ist keiner gewählt (lokal/deterministisch) oder der gewählte nicht
  // eingerichtet, sagt das Ergebnis genau das, statt still einen anderen zu prüfen. Mit `anbieter`
  // prüft die Erreichbarkeits-Sonde (unten) gezielt EINE Kante.
  async probe(anbieter?: ReasonerCloudAnbieter): Promise<ReasonerProbeResult> {
    const at = new Date().toISOString();
    const gewaehlt = anbieter ?? this.anbieterFuerWahl(this.taskConfig.global);
    if (!gewaehlt) {
      return {
        ok: false,
        provider: this.fallback.name,
        mode: "deterministic",
        detail: this.usingAnyCloud()
          ? `Kein externer Anbieter gewählt (global: ${this.taskConfig.global}) — es wurde keiner geprüft.`
          : "Kein Modell konfiguriert — es läuft der deterministische Ersatzmodus.",
        at,
      };
    }
    const provider = this.cloudProvider(gewaehlt);
    if (!provider || typeof provider.probe !== "function") {
      return {
        ok: false,
        provider: this.fallback.name,
        mode: "deterministic",
        detail: `${REASONER_CLOUD_ANBIETER_NAME[gewaehlt]} ist nicht eingerichtet: ${this.cloudStatus(gewaehlt).grund ?? "kein Client verdrahtet."}`,
        at,
        anbieter: gewaehlt,
      };
    }
    try {
      await provider.probe();
      return {
        ok: true,
        provider: provider.name,
        mode: "model",
        detail: "Modell hat geantwortet.",
        at,
        anbieter: gewaehlt,
      };
    } catch (error) {
      return {
        ok: false,
        provider: provider.name,
        mode: "model",
        detail: error instanceof Error ? error.message : String(error),
        at,
        anbieter: gewaehlt,
        ...probeUrsache(error),
      };
    }
  }

  // SCRUM-428: Key-Test für den EIGENEN lokalen LLM (secondary) — echter Mini-Aufruf über den
  // Tunnel/OpenAI-kompatiblen Endpoint. Ehrlich: nicht verdrahtet → klarer Befund; erreichbar
  // → „geantwortet"; Tunnel/Server aus → der echte Fehler (nie geraten).
  async probeLocal(): Promise<ReasonerProbeResult> {
    const at = new Date().toISOString();
    if (!this.usingSecondary() || typeof this.secondary.probe !== "function") {
      return {
        ok: false,
        provider: this.secondary.name,
        mode: "deterministic",
        detail: "Kein lokaler LLM verdrahtet (KLARWERK_LOCAL_LLM_URL/_MODEL setzen).",
        at,
      };
    }
    try {
      await this.secondary.probe();
      return {
        ok: true,
        provider: this.secondary.name,
        mode: "model",
        detail: "Lokaler LLM hat geantwortet.",
        at,
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.secondary.name,
        mode: "model",
        detail: error instanceof Error ? error.message : String(error),
        at,
        ...probeUrsache(error),
      };
    }
  }

  // D-AISTATE PAKET 3 (bens V4): Kanten-Zustand aus dem per-Provider-Cache (frisch → letzter echter
  // Befund; sonst "unverified" — kein Fake-Grau beim Start).
  private providerReachability(kante: ReachKante): "unverified" | "active" | "unreachable" {
    const cache = this.reachabilityCache[kante];
    if (!cache || Date.now() - cache.at > Reasoner.REACHABILITY_TTL_MS) {
      return "unverified";
    }
    return cache.reachable ? "active" : "unreachable";
  }

  // JOB 3134: die Kanten, die WIRKLICH verdrahtet sind — je eingerichteter externer Anbieter eine,
  // dazu die lokale. Erreichbarkeit wird je Anbieter geführt, nicht je Stufe.
  private verdrahteteKanten(): ReachKante[] {
    const kanten: ReachKante[] = REASONER_CLOUD_ANBIETER.filter(
      (anbieter) => this.cloudProvider(anbieter) !== undefined,
    );
    if (this.usingSecondary()) {
      kanten.push("local");
    }
    return kanten;
  }

  // PAKET 2 (D-AISTATE): synchroner GLOBALER Erreichbarkeits-Zustand für die Badges — NUR aus dem
  // Cache, nie ein Ping pro Aufruf. Ohne Modell "none"; irgendeine Kante frisch erreichbar →
  // "active"; alles Konfigurierte frisch unerreichbar → "unreachable"; sonst "unverified".
  // (Die per-Task-Nutzbarkeit läuft NICHT hierüber, sondern über taskModelUsable — bens V4.)
  reachabilityState(): ReasonerReachability {
    if (!this.usingAnyModel()) {
      return "none";
    }
    const states = this.verdrahteteKanten().map((kante) => this.providerReachability(kante));
    if (states.includes("active")) {
      return "active";
    }
    if (states.includes("unverified")) {
      return "unverified";
    }
    return "unreachable";
  }

  // Feuern-und-vergessen: probt HÖCHSTENS einmal je Frist echt (keine Kosten pro Request; kein Sturm
  // bei parallelen Anfragen dank In-Flight-Flag). Der Aufrufer (Status-Route) wartet NICHT — die
  // Antwort trägt den aktuellen Cache; der frische Befund greift ab dem nächsten Abruf.
  refreshReachabilityIfStale(): void {
    if (!this.usingAnyModel() || this.reachabilityProbeInFlight) {
      return;
    }
    const isFresh = (kante: ReachKante): boolean => {
      const cache = this.reachabilityCache[kante];
      return cache !== null && Date.now() - cache.at <= Reasoner.REACHABILITY_TTL_MS;
    };
    if (this.verdrahteteKanten().every(isFresh)) {
      return;
    }
    this.reachabilityProbeInFlight = true;
    void this.runReachabilityProbe().finally(() => {
      this.reachabilityProbeInFlight = false;
    });
  }

  // Echte Mini-Aufrufe (probe/probeLocal) — D-AISTATE PAKET 3 (bens V4): JEDE konfigurierte Kante
  // wird einzeln geprobt und einzeln gecacht (vorher: „irgendein Modell erreichbar" global).
  // JOB 3134: je eingerichteter externer Anbieter GEZIELT seine Kante (`probe(anbieter)`), nicht
  // „die Cloud" — sonst hinge die Erreichbarkeit von Claude am Befund von ChatGPT.
  private async runReachabilityProbe(): Promise<void> {
    for (const anbieter of REASONER_CLOUD_ANBIETER) {
      if (!this.cloudProvider(anbieter)) {
        continue;
      }
      try {
        this.recordReachability((await this.probe(anbieter)).ok, anbieter);
      } catch {
        this.recordReachability(false, anbieter);
      }
    }
    if (this.usingSecondary()) {
      try {
        this.recordReachability((await this.probeLocal()).ok, "local");
      } catch {
        this.recordReachability(false, "local");
      }
    }
  }

  // Auffrischen aus einem beliebigen echten Erreichbarkeits-Befund (Probe ODER realer Task-Ausgang).
  // Ohne Kanten-Angabe (Bestands-Aufrufer) wird der Befund auf ALLE konfigurierten Kanten gelegt —
  // das alte globale Verhalten bleibt für diese Aufrufer erhalten. JOB 3134: die Bestandsangabe
  // "cloud" meint ALLE eingerichteten externen Anbieter; ein Anbietername meint genau seine Kante.
  recordReachability(reachable: boolean, provider?: ReachKante | "cloud"): void {
    const stamp = { at: Date.now(), reachable };
    const kanten =
      provider === undefined
        ? this.verdrahteteKanten()
        : provider === "cloud"
          ? this.verdrahteteKanten().filter((kante) => kante !== "local")
          : [provider];
    for (const kante of kanten) {
      this.reachabilityCache[kante] = stamp;
    }
  }

  // ---- KI-Verwaltung v1 (Teil-Slice, 02.07.2026): Zuordnung global + je Aufgabe ----
  // Bewusst OHNE Persistenz (gilt bis Neustart): kein neuer Speicherpfad kurz vor dem
  // Beta-RC; der Voll-Ausbau (PMO-Eintrag "KI-Management-Seite") bringt Repo+Persistenz.
  // SCRUM-525 P.5 (WP6): der DEFINIERTE Default, wenn NICHTS persistiert ist. "auto" bleibt die
  // fachlich gewollte Standard-Kette (Cloud → lokal → deterministisch) — aber beim Start wird bewusst
  // GELOGGT, dass er greift, weil keine Policy konfiguriert ist (kein STILLER Auto-Fallback).
  private taskConfig: ReasonerTaskConfig = clone(DEFAULT_REASONER_POLICY);
  // SCRUM-525 P.5 (WP-C): Herkunft der AKTUELL wirksamen Policy — merkt sich insbesondere, ob ein
  // ENV-Override aktiv ist (dann lehnt setTaskConfig Schreibversuche ab, s. ReasonerPolicyLockedError).
  // Startwert "default", bis loadPersistedPolicy() (Boot) oder ein erfolgreiches setTaskConfig sie setzt.
  private policySource: ReasonerPolicySource = "default";
  // JOB 3134: die nachvollziehbare Migration der zuletzt übernommenen Zuordnung — gesetzt, wenn sie
  // abgelöste Werte (`cloud`/`model`) trug; sonst undefined. Steht in `configStatus().migration`.
  private migration: ReasonerPolicyMigration | undefined;

  getTaskConfig(): ReasonerTaskConfig {
    return clone(this.taskConfig);
  }

  // JOB 3134: wohin ein abgelöster Wert wandert — auf den Anbieter, der unter der alten Vorzugsregel
  // GEANTWORTET HÄTTE: OpenAI, wenn eingerichtet, sonst der Anthropic-Weg (so entschied
  // `createCappedCloudClientFromEnv` bis JOB 3122: `openAi… ?? anthropic…`). Nachvollziehbar, nicht
  // still: der Weg steht in `migration`, bis die nächste ausdrückliche Speicherung ihn ablöst.
  private migrationsZiel(): ReasonerCloudAnbieter {
    return this.cloudProvider("openai") ? "openai" : "anthropic";
  }

  private migriereWahl(choice: ReasonerTaskChoice): {
    wahl: ReasonerAktiveWahl;
    migration?: ReasonerWahlMigration;
  } {
    if (istAbgeloesteWahl(choice)) {
      const nach = this.migrationsZiel();
      return { wahl: nach, migration: { von: choice, nach } };
    }
    return { wahl: choice };
  }

  // Validiert eine Policy und normalisiert sie (nur bekannte Tasks/Choices). Wirft bei Ungültigem.
  // JOB 3134: migriert dabei die abgelösten Werte und gibt die Migration zurück — für JEDE
  // Eingangsstelle dieselbe Regel (Schreibweg, Datenbank, Deploy-ENV).
  // JOB 3549: `bisher` ist die Freigabe, die gilt, wenn die EINGABE keine nennt — der Vertrag sagt
  // „Weglassen lässt die Freigabe unverändert". Die beiden Ladewege (Datenbank, Deploy-ENV) reichen
  // hier bewusst NICHTS herein: sie ERSETZEN den Zustand, und was die Quelle nicht trägt, ist nicht
  // freigegeben. Nur der Admin-Schreibweg (`setTaskConfig`) reicht den bisherigen Wert durch.
  private normalizeTaskConfig(
    next: ReasonerTaskConfigEingabe,
    bisher?: ReasonerKiFreigabe | undefined,
  ): {
    config: ReasonerTaskConfig;
    migration: ReasonerPolicyMigration | undefined;
  } {
    const tasks = REASONER_TASKS;
    if (!isValidReasonerChoice(next.global)) {
      throw new Error("Ungültige globale KI-Zuordnung.");
    }
    const global = this.migriereWahl(next.global);
    const migration: ReasonerPolicyMigration = { perTask: {} };
    let migriert = false;
    if (global.migration) {
      migration.global = global.migration;
      migriert = true;
    }
    const perTask: ReasonerTaskConfig["perTask"] = {};
    for (const task of tasks) {
      const c = next.perTask?.[task];
      if (c === undefined) continue;
      if (!isValidReasonerChoice(c)) {
        throw new Error(`Ungültige KI-Zuordnung für Aufgabe '${task}'.`);
      }
      const wahl = this.migriereWahl(c);
      perTask[task] = wahl.wahl;
      if (wahl.migration) {
        migration.perTask[task] = wahl.migration;
        migriert = true;
      }
    }
    const kiFreigabe =
      next.kiFreigabe === undefined
        ? normalisiereKiFreigabe(bisher)
        : normalisiereKiFreigabe(next.kiFreigabe);
    return {
      config: { global: global.wahl, perTask, ...(kiFreigabe ? { kiFreigabe } : {}) },
      migration: migriert ? migration : undefined,
    };
  }

  // SCRUM-525 P.5 (WP6 + WP3-Batch3): setzt die Policy UND PERSISTIERT sie. WRITE-THEN-RUNTIME: erst
  // validieren, dann in die DB schreiben, und NUR bei Erfolg den Laufzeitwert aktualisieren. Schlägt der
  // DB-Write fehl, bleibt die Laufzeit-Policy unverändert (kein Drift „Laufzeit gesetzt, DB nicht") und der
  // Fehler wird ehrlich geworfen — der Aufrufer meldet ihn, die alte Zuordnung gilt weiter.
  // SCRUM-525 P.5 (WP-C): Befund 3(a) — solange die aktive Policy aus der Deploy-ENV stammt, lehnt dieser
  // Schreibpfad ab (ReasonerPolicyLockedError, von der Route auf 409 gemappt), STATT sie sofort im
  // laufenden Prozess UND in der DB zu überschreiben. Kein stilles Aushebeln der ENV-Deploy-Garantie.
  // JOB 3134: persistiert werden NUR aktive Werte — ein abgelöster Eingabewert wird vorher migriert
  // und die Migration in der Antwort gemeldet (`configStatus().migration`).
  async setTaskConfig(next: ReasonerTaskConfigEingabe): Promise<ReasonerTaskConfig> {
    if (this.policySource === "env") {
      throw new ReasonerPolicyLockedError();
    }
    // JOB 3549: der bisherige Freigabestand wird durchgereicht — ein Speichern der ZUORDNUNG ohne
    // Rumpf-Feld `kiFreigabe` lässt die Freigabe, wie sie war (weder gelöscht noch erteilt).
    const normalized = this.normalizeTaskConfig(next, this.taskConfig.kiFreigabe); // wirft bei Ungültigem, bevor irgendetwas passiert
    await this.policyRepo.set(normalized.config); // ZUERST persistieren …
    this.taskConfig = normalized.config; // … Laufzeit erst nach erfolgreichem Write
    this.migration = normalized.migration;
    this.policySource = "db"; // die Laufzeit-Policy ist jetzt die gerade persistierte Admin-Wahl.
    return this.getTaskConfig();
  }

  // SCRUM-525 P.5 (WP6 + WP3-Batch3): beim Start die wirksame Policy bestimmen. PRÄZEDENZ (dokumentiert):
  //   1. ENV-Override KLARWERK_REASONER_POLICY (deklarativ pro Deploy) — TRANSIENT, wird NICHT persistiert;
  //      die persistierte Admin-Wahl bleibt erhalten und greift wieder, sobald die ENV entfernt wird.
  //   2. persistierte Admin-Wahl (überlebt Deploy).
  //   3. definierter Default (auto).
  // Kann die persistierte Wahl NICHT gelesen werden (DB-Fehler), wird NICHT still auf auto gefallen,
  // sondern fail-closed auf LOAD_FAILURE_FALLBACK_POLICY (deterministic) — der Aufrufer meldet
  // `source: "load-error"` und loggt LAUT. Boot schreibt nie in die DB (nur eine echte Admin-Setzung tut das).
  async loadPersistedPolicy(opts?: { envGlobal?: string | undefined }): Promise<{
    source: "env" | "persisted" | "default" | "load-error";
    config: ReasonerTaskConfig;
    detail?: string;
  }> {
    // 1) ENV-Override — deterministisch pro Deploy. Gültig → greift; ungültig → ignorieren + melden.
    const envRaw = opts?.envGlobal?.trim();
    if (envRaw) {
      if (isValidReasonerChoice(envRaw)) {
        // JOB 3134: auch der Deploy-Wert wird migriert (`cloud` → Vorgabe-Anbieter) und gemeldet.
        const normalized = this.normalizeTaskConfig({ global: envRaw, perTask: {} });
        this.taskConfig = normalized.config;
        this.migration = normalized.migration;
        // SCRUM-525 P.5 (WP-C): merkt sich den ENV-Ursprung fürs restliche Prozessleben — setTaskConfig
        // lehnt Admin-Schreibversuche ab, solange dieser Zustand gilt (bis zum nächsten Neustart ohne ENV).
        this.policySource = "env";
        return { source: "env", config: this.getTaskConfig() };
      }
      // Ungültiger ENV-Wert: nicht anwenden, aber ehrlich weiterreichen (Fall-through zu 2/3).
      const detail = `Ungültige KLARWERK_REASONER_POLICY='${envRaw}' — ignoriert.`;
      const fallthrough = await this.loadFromRepoOrFailClosed();
      return { ...fallthrough, detail };
    }
    // 2)/3) persistierte Wahl bzw. Default — inkl. fail-closed bei Lesefehler.
    return this.loadFromRepoOrFailClosed();
  }

  // Liest die persistierte Policy; setzt sie als Laufzeitwert. Fehlt sie → Default (auto). Ein LESEFEHLER
  // (DB) fällt NICHT still auf auto, sondern fail-closed auf deterministic (source "load-error").
  private async loadFromRepoOrFailClosed(): Promise<{
    source: "persisted" | "default" | "load-error";
    config: ReasonerTaskConfig;
    detail?: string;
  }> {
    let stored: ReasonerTaskConfigEingabe | null;
    try {
      stored = await this.policyRepo.get();
    } catch (err) {
      this.taskConfig = clone(LOAD_FAILURE_FALLBACK_POLICY);
      this.migration = undefined;
      // SCRUM-525 P.5 (WP-C): ein Ladefehler ist KEIN ENV-Override — der Schreibpfad bleibt offen, damit
      // ein Admin die Zuordnung setzen kann, sobald die DB wieder erreichbar ist (s. auch server.ts-Log,
      // das hier bewusst KEINE automatische Wiederherstellung mehr verspricht).
      this.policySource = "default";
      return {
        source: "load-error",
        config: this.getTaskConfig(),
        detail: err instanceof Error ? err.message : String(err),
      };
    }
    if (stored) {
      // Defensive Normalisierung: auch ein (theoretisch) fremd-manipulierter Datensatz wird geprüft.
      // JOB 3134: ein Bestand mit `cloud`/`model` wird hier MIGRIERT (in der Laufzeit, gemeldet in
      // `configStatus().migration`) — die Datenbank bleibt unberührt, bis eine ausdrückliche
      // Speicherung den neuen Wert schreibt (Boot schreibt nie in die DB).
      const normalized = this.normalizeTaskConfig(stored);
      this.taskConfig = normalized.config;
      this.migration = normalized.migration;
      this.policySource = "db";
      return { source: "persisted", config: this.getTaskConfig() };
    }
    this.taskConfig = clone(DEFAULT_REASONER_POLICY);
    this.migration = undefined;
    this.policySource = "default";
    return { source: "default", config: this.getTaskConfig() };
  }

  private choiceFor(task: ModelRunTask): ReasonerAktiveWahl {
    return this.taskConfig.perTask[task] ?? this.taskConfig.global;
  }

  // Effektiver Modus je Aufgabe — ehrlich: "model" nur, wenn ein echtes Modell (Cloud ODER
  // lokal) zuerst arbeitet. SCRUM-424: leitet sich aus der Provider-Kette ab.
  private effectiveFor(task: ModelRunTask): "model" | "deterministic" {
    return this.providerChain(task)[0] !== this.fallback ? "model" : "deterministic";
  }

  // SCRUM-164/424: führt eine Reasoner-Task entlang der Provider-Kette aus (Cloud → lokal →
  // deterministisch, je nach Zuordnung) und protokolliert sie als ModelRunRecord (nur
  // Metadaten, kein Prompt-/Antworttext). Der erste Provider, der OHNE Fehler antwortet,
  // gewinnt; jeder Fehler fällt still zum nächsten Glied. Das letzte Glied (deterministisch)
  // antwortet immer, daher ist der Erfolg garantiert.
  // JOB 3276: aus den gesammelten Versuchsfehlern EINE Protokollzeile. Einzeilig (ein Fehlerkörper
  // kann Zeilenumbrüche tragen) und gekappt — ins Protokoll gehört ein Satz, keine Seite. Die
  // Kappung ist sichtbar (…), damit niemand eine abgeschnittene Meldung für die ganze hält.
  private static readonly VERSUCHSFEHLER_MAX = 500;

  private static versuchsfehlerZeile(fehler: readonly string[]): string {
    const zeile = fehler.join(" · ").replace(/\s+/gu, " ").trim();
    return zeile.length > Reasoner.VERSUCHSFEHLER_MAX
      ? `${zeile.slice(0, Reasoner.VERSUCHSFEHLER_MAX - 1)}…`
      : zeile;
  }

  private async runTask<T extends { demo: boolean }>(
    task: ModelRunTask,
    locale: ReasonerLocale,
    run: (provider: ReasonerProvider) => Promise<T>,
    // SCRUM-502 Schicht 2: vertraulicher Eingabetext → Cloud aus der Kette (siehe providerChain).
    confidential = false,
    // mega26 Block A: LAUFKONTEXT des Aufrufers (wer/woran). Als LETZTER Parameter, damit alle
    // bestehenden (positionalen) Aufrufe unverändert bleiben. Ohne Kontext bleibt der Datensatz
    // exakt wie bisher — ein ungebundener Aufrufer schreibt keine leeren Felder.
    context?: ModelRunContext,
  ): Promise<T> {
    const startedAt = new Date().toISOString();
    const chain = this.providerChain(task, confidential);
    let lastError: unknown;
    // JOB 3036: das zuletzt WIRKLICH GERUFENE Modell. Nur der Fehler-Datensatz unten liest es — ein
    // gescheiterter Lauf soll sagen, an welchem Modell er gescheitert ist, statt von einem rein
    // deterministischen Lauf ununterscheidbar zu sein. Bleibt `undefined`, wenn kein versuchter
    // Provider ein Modell wirklich befragt hat (reine deterministische Kette, Kurzschlusswege).
    let lastModel: string | undefined;
    // JOB 3074: der Verbrauch des GANZEN Laufs, über alle Provider-Versuche hinweg. Anders als
    // `lastModel`, das den zuletzt versuchten Provider NENNT, wird hier ADDIERT: eine Cloud-Anfrage,
    // die nach 3000 Eingabetoken scheitert, ist bezahlt — auch wenn danach das lokale Modell
    // antwortet. Sie im Erfolgsdatensatz wegzulassen hieße, dem Lauf einen Teil seines Verbrauchs
    // abzuschreiben, den jemand tatsächlich zahlt.
    let laufVerbrauch: ModellVerbrauch | undefined;
    // ============================================================================================
    // JOB 3276 — EIN GESCHEITERTER VERSUCH, DEM EIN ERFOLG FOLGT, VERSCHWAND AUS DEM PROTOKOLL.
    // ============================================================================================
    // Gemessen von Codex am 08.09.: das Interview zeigte nach sichtbarer OpenAI-Anzeige alle drei
    // Fragen als „Deterministischer Fallback" — und das Laufprotokoll schrieb dazu einen Datensatz
    // mit status „success", ohne ein Wort darüber, WARUM das Modell nicht geantwortet hat. Der
    // Fehler war passiert, bezahlt und spurlos.
    //
    // KEIN ZWEITER DATENSATZ JE VERSUCH: ein Lauf ist ein Datensatz (JOB 3074 R2 — die
    // Doppelzählung dort hat 84/14 statt 42/7 gemeldet). Die Ursache steht deshalb IM Datensatz des
    // Laufs, mit Anbieter und Modell davor, damit sie zuzuordnen ist.
    //
    // NUR METADATEN: gesammelt wird die Meldung des Modellfehlers (Status, finish_reason, Budget,
    // Anbieterbegründung) — nie Prompt- oder Antworttext. Und gekappt, weil ein Fehlerkörper auch
    // eine ganze Seite sein kann.
    const versuchsfehler: string[] = [];
    for (let i = 0; i < chain.length; i++) {
      const provider = chain[i];
      if (!provider) {
        continue;
      }
      // JOB 3036 R2: die Spur GENAU DIESES Versuchs. Neu je Versuch, damit ein Lauf, der erst die
      // Cloud befragt und dann lokal antwortet, im Datensatz das Modell trägt, das geantwortet hat.
      const spur: ModellAufrufSpur = { gerufen: false };
      // JOB 3074 R2 (bens Befund): DIE SPUR EINES VERSUCHS WIRD GENAU EINMAL ÜBERNOMMEN. Runde 1
      // addierte sie an zwei Stellen — nach dem Erfolg und noch einmal im Catch-Block. Der
      // Catch-Block umfasst aber mehr als den Modellaufruf: auch das Protokollschreiben (`recordRun`
      // unten) liegt darin. Scheiterte es einmal und gelang danach, so zählte der Datensatz denselben
      // Modellaufruf zweimal (84/14 statt 42/7) — eine Zahl, die einen Aufruf behauptet, den es nie
      // gab. Der Merker ist die Antwort und nicht etwa ein `finally`: der Erfolgszweig BRAUCHT den
      // Wert bereits vor `recordRun`, ein `finally` liefe erst danach.
      let uebernommen = false;
      const uebernimmVerbrauch = (): void => {
        if (uebernommen) {
          return;
        }
        uebernommen = true;
        laufVerbrauch = verbrauchSumme(laufVerbrauch, spur.verbrauch);
      };
      try {
        const result = await mitModellAufrufSpur(spur, () => run(provider));
        uebernimmVerbrauch();
        // JOB 3036: `model` kommt aus dem Provider selbst, NICHT aus `provider.name` (das ist der
        // Anbieter und steht bereits in `provider`).
        //
        // JOB 3036 R2 (bens Befund): UND nur, wenn in diesem Lauf wirklich ein Modellaufruf
        // stattgefunden hat. „Ein Modell-Provider hat den Lauf beendet" ist KEIN Beleg dafür: der
        // ModelProvider kehrt auf vier Wegen zurück, ohne den Client je zu rufen (answer ohne
        // tragende Quelle, abgeschlossenes interview, extract auf leerem Dokument, helpAnswer ohne
        // Wissensbasis), und `select` rechnet ohnehin ohne Modell. Nennt der Provider kein Modell
        // oder hat keines gearbeitet, FEHLT das Feld — es wird kein Ersatz eingesetzt.
        const model = spur.gerufen ? provider.modelName?.() : undefined;
        await this.recordRun(
          task,
          locale,
          startedAt,
          "success",
          {
            fallback: i > 0,
            demo: result.demo,
            provider: provider.name,
            ...(model ? { model } : {}),
            // JOB 3074: nur, wenn wirklich ein Verbrauch gemeldet wurde. Fehlt er, FEHLT das Feld —
            // kein Nullwert, keine Schätzung (services/model-runs/src/types.ts).
            ...(laufVerbrauch ? { verbrauch: laufVerbrauch } : {}),
            // JOB 3276: der Lauf ist gelungen — aber nicht am ersten Glied. Was auf dem Weg dorthin
            // scheiterte, steht hier, sonst nirgends. Kein gescheiterter Versuch → kein Feld.
            ...(versuchsfehler.length > 0
              ? { error: Reasoner.versuchsfehlerZeile(versuchsfehler) }
              : {}),
          },
          context,
        );
        return result;
      } catch (err) {
        // SCRUM-498 B2: Backpressure ist KEIN Provider-Fehler — nicht auf den deterministischen
        // Fallback ausweichen, sondern durchreichen (die HTTP-Schicht macht daraus 503 + Retry-After).
        // Es wird auch nichts protokolliert, also bleibt `lastModel` hier bewusst unberührt.
        if (err instanceof ModelCapacityError) {
          throw err;
        }
        lastError = err;
        // JOB 3036 R2: auch hier zählt nur der wirklich erfolgte Aufruf. Ein Provider, der vor dem
        // Client-Aufruf an etwas anderem gescheitert ist, hat kein Modell versucht.
        const versuchsModell = spur.gerufen ? provider.modelName?.() : undefined;
        lastModel = versuchsModell ?? lastModel;
        // JOB 3276: Anbieter, Modell, Grund — die drei Auskünfte, die einen Ausfall zuordenbar
        // machen. Sie stehen im Erfolgsdatensatz unten, falls ein späteres Glied noch antwortet.
        versuchsfehler.push(
          `${provider.name}${versuchsModell ? ` (${versuchsModell})` : ""}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        // JOB 3074: was dieser Versuch bis zu seinem Scheitern verbraucht hat, ist bezahlt und wird
        // nicht verworfen — ein Modellaufruf, der eine Antwort ohne Antwortinhalt zurückbekommt,
        // ist der teure Fall, nicht der billige. Ist der Verbrauch oben schon übernommen worden
        // (der Modellaufruf gelang, erst das Protokollschreiben scheiterte), tut diese Zeile nichts.
        uebernimmVerbrauch();
      }
    }
    // mega26 Block A: der FEHLGESCHLAGENE Lauf trägt denselben Kontext wie der erfolgreiche —
    // gerade der Fehlerfall ist der, den ein Prüfer später zuordnen können muss.
    await this.recordRun(
      task,
      locale,
      startedAt,
      "error",
      {
        fallback: chain.length > 1,
        demo: true,
        provider: this.fallback.name,
        // JOB 3036: das zuletzt WIRKLICH GERUFENE Modell. `provider` bleibt der Fallback-Name — der
        // Datensatz behauptet also weiterhin NICHT, ein Modell habe geantwortet; er sagt nur,
        // welches befragt wurde und dabei scheiterte. Hat kein Modell gearbeitet, fehlt das Feld.
        ...(lastModel ? { model: lastModel } : {}),
        // JOB 3074: der gescheiterte Lauf trägt seinen Verbrauch genauso wie der erfolgreiche.
        // Gerade er muss ihn tragen: er hat bezahlt und nichts bekommen.
        ...(laufVerbrauch ? { verbrauch: laufVerbrauch } : {}),
        error: lastError instanceof Error ? lastError.message : "unknown",
      },
      context,
    );
    // JOB 3353 B: WAR ES DIE VERTRAULICHKEIT? Gemessen, nicht vermutet — und mit DEMSELBEN Maß, das
    // `structure`, `describe` und `groupCandidates` seit WP-SHIP9-S1/S2 verwenden, um genau diese
    // Ursache von „no-model"/„model-error" zu trennen: kein Modell in der (gefilterten) Kette UND
    // `cloudExcludedByConfidentiality`. Eine zweite Auffassung davon, was eine Vertraulichkeits-
    // blockade ist, gibt es damit nicht.
    //
    // Der Unterschied zu den drei genannten Wegen ist nur der AUSGANG: die liefern ein
    // deterministisches Ergebnis mit `fallbackReason: "confidential"`. Wo es kein ehrliches Ergebnis
    // gibt — der Lauf ist hier ohne eines geblieben —, ist der typisierte Fehler die einzige Form,
    // in der dieselbe Auskunft den Aufrufer erreicht.
    const ohneModellInKette = chain.every((p) => p === this.fallback);
    if (ohneModellInKette && this.cloudExcludedByConfidentiality(task, confidential)) {
      throw new ConfidentialCloudBlockedError(task, lastError);
    }
    throw lastError ?? new Error("Kein Provider verfügbar.");
  }

  private async recordRun(
    task: ModelRunTask,
    locale: ReasonerLocale | undefined,
    startedAt: string,
    status: ModelRunStatus,
    extra: {
      fallback: boolean;
      demo: boolean;
      provider: string;
      model?: string;
      // JOB 3074: der gemeldete Tokenverbrauch des Laufs — fehlt, wenn keiner genannt wurde.
      verbrauch?: ModellVerbrauch;
      error?: string;
    },
    // mega26 Block A: der Laufkontext des Aufrufers. Wird hier — und NUR hier — in den Datensatz
    // geschrieben. `sanitizeModelRunContext` ist die Struktursperre gegen Inhalt: was keine Kennung
    // ist, erreicht das Protokoll nicht. Ohne Kontext bleibt der Datensatz feldgleich zu bisher.
    context?: ModelRunContext,
  ): Promise<void> {
    if (!this.modelRuns) {
      return;
    }
    const runContext = sanitizeModelRunContext(context);
    await this.modelRuns.append({
      id: randomUUID(),
      task,
      provider: extra.provider,
      demo: extra.demo,
      fallback: extra.fallback,
      ...(locale ? { locale } : {}),
      startedAt,
      finishedAt: new Date().toISOString(),
      status,
      ...(extra.error ? { error: extra.error } : {}),
      ...(extra.model ? { model: extra.model } : {}),
      ...(extra.verbrauch ? { verbrauch: extra.verbrauch } : {}),
      ...(runContext.actor ? { actor: runContext.actor } : {}),
      ...(runContext.subject ? { subject: runContext.subject } : {}),
    });
  }

  // SCRUM-424: ein echtes Modell ist verfügbar, wenn Cloud ODER lokal verdrahtet ist.
  // Das aktive Anzeige-Modell bevorzugt die Cloud (Rückwärtskompatibilität), sonst lokal.
  private usingAnyModel(): boolean {
    return this.usingAnyCloud() || this.usingSecondary();
  }

  // WP-SHIP9-S1 (bens W2-Auflage aus BERICHT-w2check): taskbezogene Ursachenbestimmung — wertet
  // GENAU die Routing-Entscheidung aus, mit der providerChain(task, confidential) die Cloud-Kante
  // setzt (choiceFor(task) meint einen Anbieter UND der ist verdrahtet). Ein globales
  // usingAnyModel() reicht bewusst NICHT: eine deterministische Task-Policy, eine local-Policy
  // ohne lokales Modell und der fail-closed Policy-Ladefehler (LOAD_FAILURE_FALLBACK_POLICY →
  // deterministic) dürfen NIE als Vertraulichkeitsblockade erscheinen.
  //
  // JOB 3549 R2 — SIE IST BEWUSST FREIGABE-NEUTRAL, UND ZWAR AUS EINEM GEMESSENEN GRUND.
  //
  // Runde 1 hatte hier den Riegel mitgeprüft („nur `confidential`, wenn es OHNE die Vertraulichkeit
  // hinausgedurft hätte"). Das klingt genauer und ist trotzdem falsch: `runTask` wirft den
  // typisierten `ConfidentialCloudBlockedError` NUR, wenn diese Antwort hier `true` ist (`:1297`).
  // Wurde sie durch die fehlende Freigabe zu `false`, blieb der ROHE Providerfehler übrig, und die
  // Route beantwortete den vertraulichen Lauf mit **HTTP 500** statt mit dem typisierten 409 —
  // gemessen an `services/app/src/routes/reasoner-routes.test.ts:443` (B10, „expected 500 to be
  // 409"). Ein 500 ist unter keiner Lesart die ehrlichere Auskunft; es ist der Verlust jeder
  // Auskunft. Der Auftrag verlangt diese Verfeinerung auch nirgends — Runde 1 hat sie selbst unter
  // ABWEICHUNGEN geführt. Sie ist deshalb zurückgenommen.
  //
  // WAS DIESE FRAGE BEANTWORTET, ist eine ANDERE als die des Riegels:
  //   Riegel (`oeffentlicheKiErlaubt`)  — „darf jetzt etwas hinaus?"        → entscheidet den Egress.
  //   Hier                              — „hat die Vertraulichkeit etwas
  //                                        aus der Kette genommen?"        → benennt die Ursache.
  // Beide sind wahr, wenn beide zutreffen; die Ursachenfrage wird nicht dadurch unwahr, dass daneben
  // noch ein zweiter Grund steht. Der Text IST vertraulich, und eine Cloud IST verdrahtet — genau
  // das sagt der Satz. Die fehlende Freigabe meldet die Adminfläche an ihrer eigenen Stelle
  // (`configStatus().taskConfig.kiFreigabe`, JOB 3501), nicht über den Ursachencode eines Laufs.
  //
  // KEIN ZWEITER RIEGEL: diese Zeile lässt nichts hinaus. Sie wird ausschließlich gelesen, nachdem
  // die Kette (die durch den Riegel ging) ohne Ergebnis geblieben ist.
  private cloudExcludedByConfidentiality(task: ModelRunTask, confidential: boolean): boolean {
    return confidential && this.cloudFuerWahl(this.choiceFor(task)) !== undefined;
  }

  // JOB 3134 R3 (bens Korrekturpflicht 1): die aufgabenlosen Wege (Konflikt-/Dublettenurteil,
  // Weltwissen, Status) lesen DIESELBE Kette wie jede Aufgabe — die der gespeicherten globalen
  // Wahl, ohne das deterministische Schlussglied. Bis Runde 2 stand hier `judgeCloud()`, das bei
  // fehlendem gewähltem Client auf den Vorgabe-Anbieter zurückfiel: „Claude gewählt, Anthropic nicht
  // eingerichtet" schickte Weltwissen und Konfliktprüfung an OpenAI — genau der heimliche Wechsel,
  // den Pflichtlieferung 5 ausschließt. Jetzt gibt es EINEN Auswahlweg (`chainForChoice`): fehlt
  // der gewählte Anbieter, bleibt die Kette ohne externen Anbieter, und der Ausgang sagt „no-model".
  private globaleKette(confidential = false): ReasonerProvider[] {
    return this.chainForChoice(this.taskConfig.global, confidential).filter(
      (provider) => provider !== this.fallback,
    );
  }

  // JOB 3549 R2 · DIE EINE DEFINITION VON „WEGEN DER VERTRAULICHKEIT AUSGESCHLOSSEN".
  //
  // Sie misst AUSSCHLIESSLICH die Wirkung des Vertraulichkeits-Bits: was in derselben Kette stünde,
  // wenn der Text nicht vertraulich wäre, mit ihm aber fehlt. Der Freigabe-Riegel ist dabei
  // ausgeklammert (`fuerAnzeige`), weil er die andere Frage beantwortet — sonst verschwände die
  // Ursache „confidential" überall dort, wo AUSSERDEM die Freigabe fehlt, und `no-model" behauptete,
  // es sei kein Modell da, obwohl eines verdrahtet ist. Genau dieselbe Neutralität hat
  // `cloudExcludedByConfidentiality` (oben) für die aufgabenbezogenen Wege; die beiden Fundstellen
  // antworten damit gleich, was Pflichtlieferung 2 verlangt.
  //
  // KEIN EGRESS: es wird nur die MITGLIEDSCHAFT zweier Ketten verglichen, nie eine davon befragt.
  // Der Weg, der wirklich etwas hinausgibt, ist `globaleKette(confidential)` darüber — gegated.
  private durchVertraulichkeitAusgeschlossen(): boolean {
    const anzeige = (confidential: boolean): ReasonerProvider[] =>
      this.chainForChoice(this.taskConfig.global, confidential, { fuerAnzeige: true }).filter(
        (provider) => provider !== this.fallback,
      );
    const mitBit = anzeige(true);
    return anzeige(false).some((provider) => !mitBit.includes(provider));
  }

  // JOB 3549: ANZEIGE, nicht Egress — `status()` nennt Namen und Stufe der verdrahteten, gewählten
  // KI. Es überträgt nichts; jeder Weg, der wirklich etwas hinausgibt, geht über `globaleKette()`
  // bzw. `providerChain()` und damit über den Riegel. Diese Trennung ist Pflichtlieferung 3.
  private activeModelProvider(): ReasonerProvider {
    return (
      this.chainForChoice(this.taskConfig.global, false, { fuerAnzeige: true }).filter(
        (provider) => provider !== this.fallback,
      )[0] ?? this.fallback
    );
  }

  // FR-RSN-05: server-echte Statusanzeige. JOB 3134 R3: „aktiv" heißt, dass die GEWÄHLTE Kette
  // ein Modell trägt — nicht, dass irgendein Modell verdrahtet ist. Vorher meldete `active: true`
  // mit `provider: deterministic`, sobald ein nicht gewählter Anbieter eingerichtet war; die
  // KI-Prüfung (ai-check-worker) hätte dann Paare geprüft, die kein Urteil bekommen können.
  status(): ReasonerStatus {
    const aktiv = this.activeModelProvider();
    const active = aktiv !== this.fallback;
    return {
      active,
      provider: aktiv.name,
      mode: active ? "model" : "deterministic",
    };
  }

  // WP-VIP2-GATE (bens P1): ABSTRAHIERTE, oeffentliche Status-Sicht. Der Provider-/Modellname
  // (status().provider, z. B. der konkrete Anthropic-Modellstring) ist Infrastruktur-Detail und
  // gehoert ausschliesslich in die ECHTE Admin-Sicht (/api/reasoner/config, users.manage —
  // WP-VIP2-GATE-2 Fix 3/4). mode nennt die STUFE (cloud/local/deterministic), nie das Produkt.
  // AUFTRAG-mega69 B2 (bens sammel65, Punkt 4): „NUR {active, mode}" stimmt seit D-AISTATE/mega67
  // nicht mehr — publicStatus() traegt BEWUSST zusaetzlich `reachable`, `tasks` und `billable`
  // (abstrakte Booleans je Aufgabe, nie ein Name). Das ist eine gewollte Vertragserweiterung fuer
  // ehrliches Ausgrauen und den bedingten Kostenhinweis, dokumentiert statt still.
  // PAKET 2 (D-AISTATE, Pedi 23.07.): zusätzlich der ehrliche ERREICHBARKEITS-Zustand (reachable) —
  // „active" nur, wenn ein Modell zuletzt WIRKLICH geantwortet hat. `active`/`mode` bleiben die
  // Konfigurations-Wahrheit (rückwärtskompatibel); die Badges nutzen `reachable` für die Farbe.
  // D-AISTATE PAKET 3 (bens V4, aistate-fix3): Nutzbarkeit EINER Aufgabe nach ihrer TATSÄCHLICH
  // gewählten Providerkette UND deren Kanten-Erreichbarkeit — nicht mehr „Policy-Slot da" + global
  // „irgendein Modell erreichbar". true nur, wenn IRGENDEIN Modell-Glied der Task-Kette nicht zuletzt
  // unerreichbar war ("unverified" zählt als nutzbar — kein Fake-Grau beim Start; die Kette fällt zur
  // Laufzeit ohnehin durch erreichbare Glieder). Cloud-unerreichbar + Local-erreichbar + Task=cloud ⇒
  // false (die Kette dieser Task enthält NUR die Cloud). Bewusst nur ein Boolean — kein Provider-/
  // Modellname (Sicherheitsvertrag vip2-gate).
  private taskModelUsable(task: ModelRunTask): boolean {
    const chainModels = this.providerChain(task).filter((p) => p !== this.fallback);
    if (chainModels.length === 0) {
      return false; // Aufgabe bewusst deterministisch gestellt bzw. kein Modell verdrahtet
    }
    return chainModels.some((p) => this.providerReachability(this.kanteVon(p)) !== "unreachable");
  }

  // ==============================================================================================
  // AUFTRAG-mega67 BLOCK G (Pedi 30.07.) — KOSTET EIN KLICK AUF DIESE AUFGABE WIRKLICH GELD?
  // ==============================================================================================
  //
  // DER BEFUND. Die Oberfläche trug den Satz „Ein Klick startet sofort eine echte, kostenpflichtige
  // KI-Anfrage" UNBEDINGT. Für die Bedingung gab es hier keine Auskunft, und die beiden Felder, die
  // danach aussehen, tragen sie NICHT:
  //  - `tasks[task]` ist NUTZBARKEIT, nicht Preis: true auch dann, wenn die Aufgabe über das
  //    LOKALE Modell läuft — das kostet nichts.
  //  - `mode` ist die HAUSWEITE Stufe (usingPrimary() ? cloud : …) und sagt nichts über die Kette
  //    DIESER Aufgabe. Eine Installation kann Cloud verdrahtet haben und `structure` trotzdem
  //    ausdrücklich lokal stellen.
  // Die per-Aufgabe-Auflösung `effectiveProvider` gibt es nur in configStatus() — und die ist
  // admin-only (users.manage, WP-VIP2-GATE). Für den Kostenhinweis, den JEDE Rolle sieht, war sie
  // also keine Quelle.
  //
  // WARUM EIN BOOLEAN UND KEIN PROVIDERNAME: derselbe Sicherheitsvertrag wie bei `tasks` (vip2-gate)
  // — die öffentliche Sicht nennt die STUFE nie namentlich. „Kostet / kostet nicht" ist genau die
  // Auskunft, die der Satz braucht, und keine darüber hinaus.
  //
  // ERREICHBARKEIT ZÄHLT MIT, aus demselben Grund wie bei taskModelUsable: ist die Cloud-Kante
  // zuletzt unerreichbar gewesen, fällt der Lauf auf lokal/deterministisch durch — dann kostet der
  // Klick nichts, und der Satz wäre wieder eine falsche Tatsachenaussage.
  //
  // NICHT-VERTRAULICHE KETTE, bewusst: `providerChain(task)` ohne `confidential`. Vertraulicher Text
  // nimmt die Cloud aus der Kette (SCRUM-502) — der Klick wäre dann kostenlos. Die Aussage „kann
  // kosten" gilt also für den ALLGEMEINEN Fall am Knopf; sie behauptet nie zu wenig.
  //
  // AUFTRAG-mega69 B2 (bens sammel65-Auflage 2) — WAS DIESES FELD IST UND WAS NICHT: `billable`
  // sagt „die Cloud KANN für diese Aufgabe kostenpflichtig verwendet werden" — eine MÖGLICHKEIT,
  // keine Abrechnungstatsache über den konkreten Klick. Drei benannte Gründe, warum ein Klick trotz
  // `true` nichts kosten kann: (1) `unverified` zählt vorsorglich als erreichbar, (2) die
  // Vertraulichkeit der konkreten Eingabe nimmt die Cloud zur Laufzeit aus der Kette, (3) ein
  // Laufzeitfehler mit lokalem/deterministischem Rückfall erzeugt keine abrechenbare Antwort.
  // Der Oberflächen-Wortlaut sagt deshalb „kann … auslösen" (i18n `ai.costHint`), nie „startet".
  private taskBillable(task: ModelRunTask): boolean {
    // JOB 3134: das Cloud-Glied DIESER Kette (höchstens eines) und die Erreichbarkeit SEINER Kante.
    const cloud = this.providerChain(task).find((p) => this.anbieterVon(p) !== undefined);
    if (!cloud) {
      return false; // keine Cloud verdrahtet bzw. diese Aufgabe lokal oder deterministisch gestellt
    }
    return this.providerReachability(this.kanteVon(cloud)) !== "unreachable";
  }

  // D-AISTATE PAKET 3 (bens V4, 23.07.): zusätzlich eine ABSTRAKTE per-Task-Nutzbarkeitskarte
  // `tasks: { [task]: boolean }` — NUR true/false je Aufgabe, KEIN Provider-/Modellname (die bleiben
  // der Admin-Sicht vorbehalten, vip2-gate). true = für die Aufgabe ist ein echtes Modell (cloud|local)
  // in der Kette UND dessen Kante ist nicht zuletzt unerreichbar (bens V4: Erreichbarkeit PRO TASK
  // nach der echten Providerkette, s. taskModelUsable); false = deterministisch bzw. die für die
  // Aufgabe zulässigen Provider sind unerreichbar. So kann der öffentliche Hook die LLM-Knöpfe je
  // Aufgabe ehrlich ausgrauen, ohne die admin-only Config zu ziehen.
  publicStatus(): {
    active: boolean;
    mode: "cloud" | "local" | "deterministic";
    reachable: ReasonerReachability;
    tasks: ReasonerTaskMap;
    billable: ReasonerTaskMap;
  } {
    const active = this.usingAnyModel();
    return {
      active,
      mode: this.usingAnyCloud() ? "cloud" : this.usingSecondary() ? "local" : "deterministic",
      reachable: this.reachabilityState(),
      tasks: aufgabenKarte((task) => this.taskModelUsable(task)),
      // AUFTRAG-mega67 BLOCK G: kostet ein Klick auf DIESE Aufgabe wirklich Geld? (s. taskBillable)
      billable: aufgabenKarte((task) => this.taskBillable(task)),
    };
  }

  // SCRUM-166: read-only Provider-/Model-Konfiguration. Nur Metadaten — keine Secrets,
  // keine Prompt-/Antwortinhalte. Ohne konfiguriertes Modell ehrlich Demo-Modus.
  // JOB 3134: was die Fläche über EINEN externen Anbieter erfährt — eingerichtet (Clientname und
  // Modell, wie sie später im Laufprotokoll stehen) oder nicht (der Grund aus der Fabrik).
  private cloudStatus(anbieter: ReasonerCloudAnbieter): ReasonerCloudAnbieterStatus {
    const provider = this.cloudProvider(anbieter);
    if (provider) {
      const model = provider.modelName?.();
      return { configured: true, name: provider.name, ...(model ? { model } : {}) };
    }
    return {
      configured: false,
      grund: this.cloudGruende[anbieter] ?? "nicht eingerichtet (kein Client verdrahtet).",
    };
  }

  configStatus(): ReasonerConfigStatus {
    const configured = this.usingAnyModel();
    // JOB 3134: „AKTIVE KI" IST, WAS DIE GESPEICHERTE GLOBALE WAHL BESTIMMT — nicht „der erste
    // verfügbare Anbieter". Bis hierher stand hier `activeModelProvider()` (Cloud vor lokal, egal
    // was gewählt war): genau der Widerspruch „Dropdown Claude, aktiv ChatGPT", den Pedi meldete.
    // Jetzt ist es das erste Glied der Kette der globalen Wahl; ist das der Ersatzmodus (Wahl
    // deterministisch, oder gewählter Anbieter nicht eingerichtet), steht das hier auch — mit
    // `mode: "demo"`, obwohl `configured` (irgendein Modell ist verdrahtet) wahr sein kann.
    // JOB 3549: ANZEIGE (`fuerAnzeige`) — „aktive KI" bleibt der eingerichtete, gewählte Anbieter,
    // auch wenn die Freigabe fehlt. Sonst verschwände er aus der Adminsicht, und 3501 könnte den
    // Warnhinweis „… ist eingerichtet, aber nicht freigegeben" gar nicht bauen. Was tatsächlich
    // LÄUFT, steht daneben in `effective` (gegated) und in `taskConfig.kiFreigabe`.
    const aktiv =
      this.chainForChoice(this.taskConfig.global, false, { fuerAnzeige: true })[0] ?? this.fallback;
    const aktivIstModell = aktiv !== this.fallback;
    return {
      provider: aktivIstModell ? aktiv.name : this.fallback.name,
      ...(aktivIstModell ? { model: aktiv.name } : {}),
      configured,
      mode: aktivIstModell ? "model" : "demo",
      fallbackAvailable: true,
      // mega52 D1: Niederländisch ist eine eigene Reasoner-Sprache und wird hier ehrlich gemeldet.
      supportsLocales: ["de", "en", "nl"],
      tasks: [...REASONER_TASKS],
      taskConfig: this.getTaskConfig(),
      effective: Object.fromEntries(REASONER_TASKS.map((task) => [task, this.effectiveFor(task)])),
      // SCRUM-424: der eigene lokale LLM + welche KI je Aufgabe zuerst arbeitet.
      cloudConfigured: this.usingAnyCloud(),
      localConfigured: this.usingSecondary(),
      ...(this.usingSecondary() ? { localProvider: this.secondary.name } : {}),
      effectiveProvider: Object.fromEntries(
        REASONER_TASKS.map((task) => [task, this.providerLabelFor(task)]),
      ),
      // JOB 3134: dieselbe Auflösung mit Anbieternamen, die beiden Anbieter einzeln, der
      // Vorgabe-Anbieter hinter „auto" und die nachvollziehbare Migration abgelöster Werte.
      effectiveAnbieter: Object.fromEntries(
        REASONER_TASKS.map((task) => [task, this.effectiveAnbieterFor(task)]),
      ),
      cloudProviders: {
        openai: this.cloudStatus("openai"),
        anthropic: this.cloudStatus("anthropic"),
      },
      autoAnbieter: this.vorgabeAnbieter() ?? null,
      ...(this.migration ? { migration: this.migration } : {}),
      persisted: this.policySource === "db",
      // SCRUM-525 P.5 (WP-C): additive Eigenschaft — zeigt der Admin-UI, ob die Zuordnung per Deploy-ENV
      // gesperrt ist ("env", PUT liefert 409), aus der DB stammt ("db") oder (noch) Default ist.
      policySource: this.policySource,
    };
  }

  // WP-IC-4: KI-Gruppierung der eingegrenzten Import-Kandidaten (Schritt 4 des Cockpit-Flows).
  // Dieselbe ehrliche Fallback-Mechanik wie structure/describe: das letzte Kettenglied ist die
  // DETERMINISTISCHE Themen-Gruppierung (demo:true) — der Flow bleibt IMMER benutzbar, und
  // fallbackReason unterscheidet no-model / model-timeout / model-error für die ehrliche
  // „Ohne KI gruppiert"-Kennzeichnung. Vertraulichkeits-Routing wie gehabt (vertraulich → nie Cloud).
  async groupCandidates(
    candidates: readonly GroupCandidateInput[],
    locale: ReasonerLocale = "de",
    confidential = false,
  ): Promise<GroupCandidatesResult> {
    const hadModelInChain = this.providerChain("group", confidential).some(
      (p) => p !== this.fallback,
    );
    const failureBox: { current: { err: unknown; provider: string; elapsedMs: number } | null } = {
      current: null,
    };
    const result = await this.runTask<GroupCandidatesResult>(
      "group",
      locale,
      async (p) => {
        if (p === this.fallback || typeof p.groupCandidates !== "function") {
          return { groups: deterministicCandidateGroups(candidates, locale), demo: true };
        }
        const startedMs = Date.now();
        try {
          return await p.groupCandidates(candidates, locale, confidential);
        } catch (err) {
          failureBox.current = { err, provider: p.name, elapsedMs: Date.now() - startedMs };
          throw err;
        }
      },
      confidential,
    );
    if (!result.demo) {
      return result;
    }
    const modelFailure = failureBox.current;
    const failure = modelFailure === null ? null : classifyModelFailure(modelFailure.err);
    // WP-SHIP9-S1 (bens W2-Auflage): war KEIN Modell in der (vertraulichkeitsgefilterten) Kette,
    // wird unterschieden, WARUM — fiel die Cloud-Kante genau durch die Vertraulichkeit weg, ist
    // die ehrliche Ursache "confidential" statt des irreführenden "no-model". War ein (lokales)
    // Modell in der Kette und scheiterte, bleiben model-timeout/model-error unangetastet.
    const fallbackReason = !hadModelInChain
      ? this.cloudExcludedByConfidentiality("group", confidential)
        ? ("confidential" as const)
        : ("no-model" as const)
      : failure?.failureClass === "timeout"
        ? ("model-timeout" as const)
        : ("model-error" as const);
    return { ...result, fallbackReason };
  }

  // WP-BILD-1c (löst den WP-BILD-1b-TODO ein): KI-Bildbeschreibung als VORSCHLAG. Der ModelClient hat
  // jetzt einen OPTIONALEN Vision-Pfad (completeVision, content als image/text-Block-Array — nur der
  // Anthropic-Cloud-Client implementiert ihn); Provider ohne Bild-Eingang scheitern EHRLICH. Ohne
  // funktionierendes Modell: text null + fallbackReason (dieselbe Ursachen-Unterscheidung wie beim
  // structure-Task) — es entsteht NIE eine Pseudo-Beschreibung, nichts wird automatisch gespeichert.
  async describeImage(
    dataUrl: string,
    locale: ReasonerLocale = "de",
    confidential = false,
    // WP-BILD-1f (Pedi 22.07.): optionaler umgebender Dokument-Kontext (Klartext). Reist NUR mit,
    // wenn der Beitrag ohnehin den Cloud-Weg nehmen darf — durch DIESELBE providerChain-/Egress-Stelle
    // wie das Bild selbst. Vertraulich → Cloud aus der Kette → weder Bild noch Kontext egress.
    context?: string,
  ): Promise<DescribeImageResult> {
    const hadModelInChain = this.providerChain("describe", confidential).some(
      (p) => p !== this.fallback,
    );
    // Box statt let (siehe structure): TS-Narrowing über Closure-Zuweisungen bleibt korrekt.
    const failureBox: { current: { err: unknown; provider: string; elapsedMs: number } | null } = {
      current: null,
    };
    const result = await this.runTask<DescribeImageResult>(
      "describe",
      locale,
      async (p) => {
        if (p === this.fallback || typeof p.describeImage !== "function") {
          // Deterministisch gibt es KEINE Bildbeschreibung — ehrlich leer (demo), nie erfinden.
          return { text: null, demo: true };
        }
        const startedMs = Date.now();
        try {
          return await p.describeImage(dataUrl, locale, confidential, context);
        } catch (err) {
          failureBox.current = { err, provider: p.name, elapsedMs: Date.now() - startedMs };
          throw err;
        }
      },
      confidential,
    );
    // AUFTRAG-mega61 Block F: die Kennzeichnung an BEIDEN Rückgabewegen dieser Methode — der
    // frühen (Modell hat geantwortet) und der späten (deterministischer Rückfall mit Ursache).
    // Genau solche zwei Ausgänge sind der Grund, warum die Kennzeichnung zentral gesetzt wird und
    // nicht in den Providern.
    const kennzeichnung = aiGeneratedMark("describe", result.demo);
    if (!result.demo) {
      return mitTitelVorschlag({ ...result, aiGenerated: kennzeichnung });
    }
    const modelFailure = failureBox.current;
    const failure = modelFailure === null ? null : classifyModelFailure(modelFailure.err);
    // WP-SHIP9-S2 (bens Folgeschnitt B4): dieselbe Ursachen-Harmonisierung wie groupCandidates —
    // fiel die Cloud-Kante genau durch die Vertraulichkeit weg (kein lokales Modell sprang ein), ist
    // die ehrliche Ursache "confidential" statt des irreführenden "no-model". Ein versuchtes, aber
    // gescheitertes (lokales) Modell behält model-timeout/model-error.
    const fallbackReason = !hadModelInChain
      ? this.cloudExcludedByConfidentiality("describe", confidential)
        ? ("confidential" as const)
        : ("no-model" as const)
      : failure?.failureClass === "timeout"
        ? ("model-timeout" as const)
        : ("model-error" as const);
    // JOB 1164 D1: der Vorschlag entsteht aus dem VOLLSTÄNDIGEN Ergebnis — `fallbackReason` gehört
    // dazu und wird erst hier gesetzt. Würde er vorher abgeleitet, sähe die Ableitung kein
    // `confidential` und der Egress-Ausschluss käme als „demo" heraus. Die Reihenfolge ist Absicht.
    return mitTitelVorschlag({ ...result, fallbackReason, aiGenerated: kennzeichnung });
  }

  // FR-RSN-04/FR-I18N-01: Modellfehler dürfen den Betrieb nicht stoppen → deterministischer
  // Fallback. locale wird an primary UND fallback identisch durchgereicht (Default "de").
  // SCRUM-502 Schicht 2: `confidential` route vertrauliche Drafts/KOs an der Cloud vorbei
  // (lokal/deterministisch). Default false = unverändertes Verhalten für nicht-vertraulichen Text.
  async structure(
    rawText: string,
    locale: ReasonerLocale = "de",
    confidential = false,
  ): Promise<StructureResult> {
    // WP-D8 (Pedis Live-ROT B): VOR dem Lauf festhalten, ob überhaupt ein Modell in der Kette steht —
    // damit ein demo-Ergebnis hinterher EHRLICH begründet werden kann (kein Modell konfiguriert/aktiv
    // vs. Modell versucht, aber gescheitert). Die UI zeigt die Ursache statt nur eines FALLBACK-Badges.
    const hadModelInChain = this.providerChain("structure", confidential).some(
      (p) => p !== this.fallback,
    );
    // WP-D10 (Fix 3): den LETZTEN Modellfehler der Kette samt Dauer festhalten (gleiches Muster wie
    // extract) — runTask fällt still zum nächsten Glied, aber die Diagnose braucht Klasse/Status/elapsed.
    // Zum Timeout selbst: das Zeitlimit ist DEFAULT_MODEL_TIMEOUT_MS = 30 000 ms (Override nur bewusst
    // per REASONER_TIMEOUT_MS) — nicht unter 30 s, wird hier NICHT blind erhöht; elapsedMs im Log zeigt
    // den Ist-Wert je Vorfall.
    // Box statt let-Variable: TS invalidiert die Narrowing-Analyse von Closure-Zuweisungen an lokale
    // let-Variablen nicht — über die Objekteigenschaft bleibt der Typ nach dem await korrekt.
    const failureBox: { current: { err: unknown; provider: string; elapsedMs: number } | null } = {
      current: null,
    };
    const result = await this.runTask(
      "structure",
      locale,
      async (p) => {
        if (p === this.fallback) {
          return p.structure(rawText, locale, confidential);
        }
        const startedMs = Date.now();
        try {
          return await p.structure(rawText, locale, confidential);
        } catch (err) {
          failureBox.current = { err, provider: p.name, elapsedMs: Date.now() - startedMs };
          throw err;
        }
      },
      confidential,
    );
    if (!result.demo) {
      return result;
    }
    // WP-D10 (Fix 3): Timeout als EIGENE Ursache — die UI unterscheidet Zeitüberschreitung von Fehler.
    const modelFailure = failureBox.current;
    const failure = modelFailure === null ? null : classifyModelFailure(modelFailure.err);
    // WP-SHIP9-S2 (bens Folgeschnitt B4): Ursachen-Harmonisierung wie groupCandidates — die Cloud-
    // Kante fiel genau durch die Vertraulichkeit weg (kein lokales Modell sprang ein) → ehrliche
    // Ursache "confidential" statt "no-model"; ein versuchtes, aber gescheitertes Modell behält seine Klasse.
    const fallbackReason = !hadModelInChain
      ? this.cloudExcludedByConfidentiality("structure", confidential)
        ? ("confidential" as const)
        : ("no-model" as const)
      : failure?.failureClass === "timeout"
        ? ("model-timeout" as const)
        : ("model-error" as const);
    // PII-freies Diagnose-Log (nur Ursache/Klasse/Status/Dauer/Modell-ID + Prompt-LÄNGE als Zahl,
    // NIE der Eingabetext) — damit „FALLBACK trotz Kappung" serverseitig zuordenbar ist.
    const promptLength = rawText.length;
    const detail =
      modelFailure === null || failure === null
        ? ""
        : ` class=${failure.failureClass} status=${failure.status ?? "-"} elapsedMs=${modelFailure.elapsedMs} model=${modelFailure.provider}`;
    process.stderr.write(
      `[KLARWERK] Reasoner-Fallback (structure): reason=${fallbackReason}${detail} promptLength=${promptLength}\n`,
    );
    return { ...result, fallbackReason };
  }

  // SCRUM-167: Ask-/Antwortpfad ebenfalls über runTask protokolliert (nur Metadaten).
  //
  // ==============================================================================================
  // AUFTRAG-mega61 BLOCK G — DAS SICHERHEITSNETZ WAR AUF DIESEM WEG STRUKTURELL TOT.
  // ==============================================================================================
  //
  // BEFUND (nachgesehen, nicht vermutet): Bis mega60 hatte genau diese Methode als EINZIGE der acht
  // Aufgaben keinen `confidential`-Parameter. Sie rief `runTask("answer", locale, …)` mit drei
  // Argumenten; der vierte blieb auf seinem Vorgabewert `false`. Folgen, beide real:
  //   · `providerChain` entfernte die Cloud-Kante NIE (service.ts:271 prüft `!confidential`).
  //   · `ConfidentialEgressError` am Engpass (model-concurrency.ts:174-178) prüft AUSSCHLIESSLICH
  //     dieses Boolean — er scannt keinen Prompt und keinen Kontext. Bei fest `false` konnte er auf
  //     dem Antwortweg gar nicht auslösen.
  //
  // GEFAHR WAR ES TROTZDEM NICHT: `services/ask/src/service.ts` entfernt vertrauliche
  // Wissensobjekte VOR diesem Aufruf (`dropConfidential`). Der Weg war also zu — aber durch EINE
  // Barriere, ohne zweites Netz. Fiele diese Zeile je weg (Umbau, neuer Aufrufer von `answer`,
  // anderer Retrieval-Pfad), ginge vertraulicher Text ungebremst an die Cloud, und nichts hätte
  // angeschlagen.
  //
  // DIE KLEINSTE EHRLICHE EBENE: `answer` bekommt denselben vierten Parameter wie die anderen
  // sieben Aufgaben und reicht ihn durch. Der Aufrufer leitet ihn aus dem Kontext ab, den er
  // TATSÄCHLICH übergibt — heute also immer `false`, weil der Filter davor greift. Genau das ist
  // die Absicht: KEINE Verhaltensänderung heute, aber ein Netz, das morgen fängt. Antwortvertrag
  // und Substanztor bleiben unberührt.
  async answer(
    question: string,
    context: readonly KnowledgeRef[],
    locale: ReasonerLocale = "de",
    confidential = false,
    // mega61 Block G, vierter Punkt: der Laufkontext. Bis hierher trug der Protokolleintrag der
    // HÄUFIGSTEN KI-Handlung des Produkts weder Handelnden noch Gegenstand — ein Beleg, der sich
    // dem, was er belegt, nicht zuordnen ließ. Der Gegenstand bleibt bewusst leer (bei einer
    // Antwort ist er eine Trefferliste, kein Objekt); der Handelnde nicht mehr.
    runContext?: ModelRunContext,
    // ============================================================================================
    // JOB 3049 (N2, Scheibe 3) — DER RELEVANZTEXT REIST NEBEN DER FRAGE, NICHT IN IHR.
    // ============================================================================================
    //
    // Der Aufrufer, der die deklarierte Entsprechung gebildet hat (`services/ask/src/service.ts`),
    // reicht sie hier herein; dieser Dienst gibt sie unverändert an den Provider weiter, der sie
    // ausschließlich seiner Kandidatenauswahl vorlegt. `question` wird nirgends umgeschrieben —
    // Prompt, Antworttext, Wissenslücke und Prüfprotokoll rechnen weiter auf dem Getippten.
    //
    // OHNE IHN ÄNDERT SICH NICHTS: jeder andere Aufrufer (Sitzungspfad, Hilfeweg, Routen) lässt
    // ihn weg und bekommt Zeichen für Zeichen das bisherige Verhalten.
    relevanz?: Relevanztext,
  ): Promise<AnswerResult> {
    const result = await this.runTask(
      "answer",
      locale,
      (p) => p.answer(question, context, locale, confidential, relevanz),
      confidential,
      runContext,
    );
    // AUFTRAG-mega61 Block F: die Kennzeichnung wird HIER gesetzt und nicht in den Providern —
    // es gibt drei Provider-Wege zu einer Antwort (Cloud, lokal, deterministisch), und drei
    // Stellen wären drei Gelegenheiten, sie zu vergessen.
    return { ...result, aiGenerated: aiGeneratedMark("answer", result.demo) };
  }

  // SCRUM-490 R2 (B1): RETRIEVAL-ONLY-Antwort für den Add-on-Pfad (Klara). Der Eingabetext ist der
  // (vertrauliche) Dokumenttext → er darf NIE synthetisiert/egress werden. Deshalb NICHT über die
  // Provider-Kette (Cloud/Local könnten den Text ans Modell geben), sondern AUSSCHLIESSLICH über den
  // deterministischen (lexikalischen) Fallback gegen den bereits gefilterten (validiert, nicht-
  // vertraulich) Kontext. Es findet KEIN Modell-/Embedder-Call statt (kein Egress). Kein Treffer →
  // answered:false, sources:[] (ehrlich leer, koppelt A2). Die Quelle ist immer die genutzte KO-ID.
  async answerRetrievalOnly(
    question: string,
    context: readonly KnowledgeRef[],
    locale: ReasonerLocale = "de",
    // JOB 3049: derselbe Relevanztext wie bei `answer` — beide Antwortwege des Fragedienstes
    // müssen ihn kennen, sonst löst genau der Weg des Word-Add-ins die Zusage nicht ein. Er geht
    // an die Auswahl des deterministischen Providers; ein Modell wird hier nach wie vor NICHT
    // gerufen, und der Egress-Riegel dieses Wegs bleibt unberührt.
    relevanz?: Relevanztext,
  ): Promise<AnswerResult> {
    return this.fallback.answer(question, context, locale, false, relevanz);
  }

  // FR-RSN-03: Text präzisieren.
  //
  // ==============================================================================================
  // JOB 3276 (KI-ASSIST-LEER) — DER ERSATZ ANTWORTET NUR, WENN ER WIRKLICH ETWAS KANN.
  // ==============================================================================================
  //
  // Bis hierher lief assist wie jede andere Aufgabe durch die Kette: scheitert das Modell,
  // antwortet der deterministische Ersatz. Bei assist ist dessen ganze Leistung aber Leerraum
  // glätten, groß schreiben und einen Punkt setzen (`provider.ts`, DeterministicProvider.
  // assistText) — INHALTLICH gibt er den Eingabetext zurück. Als „Vorschlag" gereicht ist das
  // genau das, was Codex am 08.09. gemessen und Pedi im Editor gesehen hat: „Rechtschreibung"
  // liefert den eigenen Text samt Fehlern zurück, im Expertenformular ohne jeden Hinweis.
  //
  // Die Regel ist deshalb ein VERGLEICH und kein pauschales Nein: liefert der Ersatz einen wirklich
  // anderen INHALT, ist das ein Vorschlag und geht (als `demo: true`) hinaus. Gibt er nur den
  // Eingabetext in anderer Schreibung zurück, gibt es keinen Vorschlag — und dann sagt der Dienst
  // das, mit dem Grund, den er kennt.
  //
  // WARUM EIN FEHLER UND KEIN ERGEBNIS MIT LEEREM TEXT: die Aufrufer (`AiAssistBox`, die Vorschau
  // im Haupteditor) zeigen JEDEN zurückgegebenen Text als Vorschlag mit „Ersetzen"-Schalter. Ein
  // leerer Text wäre dort eine leere Vorschau mit scharfem Ersetzen-Schalter — unerklärt und
  // gefährlich. Der Fehlerweg dagegen hat auf beiden Flächen bereits eine sichtbare Meldung:
  // `AiAssistBox` zeigt den Satz des Servers wörtlich an (ApiError.message), der Haupteditor seine
  // eigene Fehlerzeile. Diese Abweichung von der wörtlichen Auftragsvorlage steht in der Rückgabe.
  async assistText(
    text: string,
    locale: ReasonerLocale = "de",
    instruction?: string,
    // SCRUM-502 Schicht 2: vertraulicher Draft/KO → Cloud aus der Kette.
    confidential = false,
  ): Promise<AssistResult> {
    // Der Grund des zuletzt gescheiterten Modells — er ist die Auskunft, die die Meldung trägt.
    let modellFehler: string | null = null;
    // Und das Ergebnis eines Modells, das in DIESEM Lauf bereits geantwortet hat. Die Kette wird
    // auch dann am nächsten Glied fortgesetzt, wenn nicht der Modellaufruf, sondern das
    // PROTOKOLLSCHREIBEN danach scheitert (runTask, JOB 3074 R2). Einen fertigen Vorschlag des
    // Modells wegen eines Protokollproblems wegzuwerfen wäre falsch — und die Meldung „Kein
    // KI-Modell hat geantwortet" wäre dann schlicht unwahr.
    let modellErgebnis: AssistResult | null = null;
    // JOB 3276 R3: der Grund für die SCHWÄCHERE Lage — ein Modell hat geantwortet, aber nichts
    // geändert. Er entscheidet am Ende, welcher der beiden ehrlichen Sätze dasteht.
    let modellOhneAenderung: string | null = null;
    return this.runTask(
      "assist",
      locale,
      async (provider) => {
        if (provider !== this.fallback) {
          try {
            const ergebnis = await provider.assistText(text, locale, instruction, confidential);
            // Ein unverändert zurückgegebener Text ist kein Vorschlag — auch dann nicht, wenn ein
            // echtes Modell ihn geschickt hat (Codex-Vorprüfung R2). Er wird deshalb NICHT gemerkt
            // (`modellErgebnis` bleibt leer) und der Versuch zählt als gescheitert: vielleicht kann
            // das nächste Glied etwas. Kann es das nicht, steht am Ende der ehrliche Satz.
            if (text.trim().length > 0 && !istEchterModellVorschlag(text, ergebnis.text)) {
              const modell = provider.modelName?.();
              const grund =
                locale === "en"
                  ? "returned the text unchanged."
                  : "gab den Text unverändert zurück.";
              modellOhneAenderung = `${provider.name}${modell ? ` (${modell})` : ""} ${grund}`;
              throw new Error(modellOhneAenderung);
            }
            modellErgebnis = ergebnis;
            return ergebnis;
          } catch (err) {
            modellFehler = err instanceof Error ? err.message : String(err);
            throw err;
          }
        }
        if (modellErgebnis !== null) {
          return modellErgebnis;
        }
        const ersatz = await this.fallback.assistText(text, locale, instruction);
        // Ohne Eingabetext gibt es nichts zu überarbeiten und nichts zu melden — der Bestandsweg
        // (leeres Ergebnis) bleibt unverändert, statt einen Ausfall zu behaupten, den es nicht gibt.
        if (text.trim().length === 0) {
          return ersatz;
        }
        if (istEchterVorschlag(text, ersatz.text)) {
          return ersatz;
        }
        // JOB 3276 R3: HAT ein Modell geantwortet und nur nichts geändert, ist „Die KI hat keine
        // Antwort geliefert" unwahr. Dann steht der schwächere, aber richtige Satz da. Er gewinnt
        // auch dann, wenn ein SPÄTERES Glied zusätzlich ausgefallen ist: die Frage des Menschen
        // lautet „warum sehe ich keinen Vorschlag", und die Antwort darauf ist die Antwort des
        // Modells, nicht der Ausfall daneben.
        if (modellOhneAenderung !== null) {
          throw new Error(assistOhneAenderungMeldung(locale, modellOhneAenderung));
        }
        // Die Cloud kann auch OHNE Fehler ausgefallen sein: ist der Text vertraulich eingestuft,
        // nimmt providerChain sie aus der Kette, bevor irgendetwas gerufen wird (SCRUM-502).
        // „Kein KI-Modell hat geantwortet" wäre da zwar wahr, aber die schwächere Auskunft — der
        // Mensch soll erfahren, dass seine EINSTUFUNG die Ursache ist und nicht ein Ausfall.
        throw new Error(
          assistOhneVorschlagMeldung(
            locale,
            modellFehler ??
              (this.cloudExcludedByConfidentiality("assist", confidential)
                ? vertraulichkeitsGrund(locale)
                : null),
          ),
        );
      },
      confidential,
    );
  }

  // SCRUM-132: reasoner-getriebenes Interview; Modellfehler → deterministischer Fallback.
  async interview(
    answers: readonly string[],
    locale: ReasonerLocale = "de",
    // SCRUM-502 Schicht 2: vertraulicher Draft → Cloud aus der Kette.
    confidential = false,
  ): Promise<InterviewResult> {
    const result = await this.runTask(
      "interview",
      locale,
      (p) => p.interview(answers, locale, confidential),
      confidential,
    );
    // mega61 Block F: Interviewfragen sind erzeugter Text — gekennzeichnet.
    return { ...result, aiGenerated: aiGeneratedMark("interview", result.demo) };
  }

  // PMO-FEA-0006: Wissenspunkte aus Dokumenttext extrahieren (optional mit Suchauftrag).
  // Ohne Modell/bei Modellfehler → ehrlicher Fallback (keine Punkte + note), G-2/FR-RSN-04.
  async extract(
    documentText: string,
    locale: ReasonerLocale = "de",
    query?: string,
    // SCRUM-451: true = Ergebnis in der Sprache des Dokuments lassen (nichts übersetzen).
    keepSourceLanguage = false,
    // SCRUM-502 Schicht 2: vertraulicher Dokumenttext/KO → Cloud aus der Kette.
    confidential = false,
    // mega26 Block A: der GEBUNDENE Aufrufer reicht hier seinen Laufkontext durch (wer/woran).
    // Als letzter Parameter — bestehende positionale Aufrufe bleiben unverändert und schreiben
    // wie bisher einen kontextlosen Datensatz.
    context?: ModelRunContext,
  ): Promise<ExtractResult> {
    // SCRUM-411 (Pedi-Test 03.07.): Scheitert der Modell-Aufruf, obwohl ein Modell gewollt
    // UND konfiguriert ist, bekommt der Nutzer den ECHTEN Grund — nicht die falsche
    // „kein KI-Modell"-Meldung des deterministischen Fallbacks. G-2 bleibt: keine Pseudo-Punkte.
    // SCRUM-424: der letzte Modellfehler der Kette (Cloud und/oder lokal) wird gemerkt, damit
    // der deterministische Abschluss den ECHTEN Grund melden kann statt „kein KI-Modell".
    let modelError: string | null = null;
    const wantedModel = this.effectiveFor("extract") === "model";
    return this.runTask(
      "extract",
      locale,
      async (provider) => {
        if (provider === this.fallback) {
          const honest = await this.fallback.extract(
            documentText,
            locale,
            query,
            keepSourceLanguage,
          );
          return wantedModel && modelError !== null
            ? honestExtractModelFailed(modelError, locale)
            : honest;
        }
        try {
          return await provider.extract(
            documentText,
            locale,
            query,
            keepSourceLanguage,
            confidential,
          );
        } catch (error) {
          modelError = error instanceof Error ? error.message : String(error);
          throw error;
        }
      },
      confidential,
      context,
    );
  }

  // IC-3 (Import-Cockpit): leitet aus einem FREITEXT-Prompt strukturierte Auswahl-Kriterien ab
  // (JSON: themes/keywords/authors/yearFrom/yearTo). NUR über ein echtes Modell — der Auswahl-Task
  // folgt der bestehenden „select"-Zuordnung. NIE raten, NIE erfinden; das Sanitisieren macht der
  // library-analytics-Kern.
  //
  // WP-SAMMEL20-FIX (bens Fix 1, P0): `confidential` läuft durch DASSELBE zentrale Provider-Routing
  // wie alle anderen Tasks (providerChain nimmt die Cloud aus der Kette; ein lokaler LLM darf
  // weiter ableiten) — der Aufrufer klassifiziert den Batch fail-safe (groupingRequiresConfidential).
  // WP-SAMMEL20-FIX (bens Fix 2, EHRLICHER AUSFALL): statt still null → strukturiertes Ergebnis mit
  // fallbackReason (no-model / model-timeout / model-error, dasselbe Muster wie groupCandidates).
  // criteria bleibt bei jedem Ausfall null — der Aufrufer meldet den Ausfall SICHTBAR, statt die
  // ungefilterte Vollmenge als KI-Ergebnis auszugeben.
  // WP-VIP2-GATE (bens P0-1, endgueltig): `confidential` ist PFLICHT — kein Default mehr. Der
  // Freitext-Prompt ist Nutzereingabe ÜBER potenziell vertrauliches Wissen; jeder Aufrufer dieses
  // completeRaw-nahen Pfads muss die Provenienz EXPLIZIT entscheiden (der Compiler erzwingt es).
  // `locale` verliert seinen Default mit (TS erlaubt keinen Pflicht-Parameter nach einem optionalen).
  //
  // JOB 3127 (MR-SELECT-1, Codex-Befund R-1567): DIESER WEG PROTOKOLLIERTE NICHTS. Er ruft ein
  // echtes Modell (`completeRaw`) über die „select"-Zuordnung, kehrte aber in JEDEM Zweig zurück,
  // ohne `recordRun` zu rufen — während `runTask` jeden Lauf schreibt, im Erfolg wie im Fehler.
  // Gemessen am lebenden Produkt: die Route antwortete 200 mit `fallbackReason: "model-error"`
  // (ein Modell wurde also befragt und scheiterte), und die Laufliste blieb leer. Der TEUERSTE
  // Fall — bezahlter Aufruf ohne Ergebnis — hinterließ keine Spur. Ab jetzt schreibt JEDE echte
  // Anfrage GENAU EINEN select-Lauf; der leere Prompt weiterhin keinen (ein Lauf ohne Anfrage wäre
  // eine erfundene Auskunft).
  //
  // DAS SCHREIBEN LIEGT AUSSERHALB DES try/catch, und das ist der Kern der Bauform: der Ausgang
  // wird im try/catch nur ERMITTELT, geschrieben wird danach an EINER Stelle. Ein `recordRun` im
  // try-Zweig fiele bei einem Schreibfehler in den eigenen catch und schriebe ein zweites Mal —
  // genau die Doppelzählung aus JOB 3074 R2. Zusätzlich wird jeder Schreibfehler geschluckt: eine
  // gültige Auswahl-Vorschau darf nie an einem Protokollproblem scheitern (und ein nicht
  // geschriebener Lauf wird auch nie behauptet).
  async deriveImportCriteria(
    prompt: string,
    locale: ReasonerLocale,
    confidential: boolean,
  ): Promise<ImportCriteriaResult> {
    if (prompt.trim().length === 0) {
      return { criteria: null, fallbackReason: null }; // nichts gefragt — kein Ausfall
    }
    const startedAt = new Date().toISOString();
    // Der Auswahl-Task nutzt die „select"-Zuordnung; nur ein echtes Modell darf ableiten.
    const chain = this.providerChain("select", confidential);
    const model = chain.find(
      (p): p is ModelProvider =>
        p !== this.fallback && p instanceof ModelProvider && p.isAvailable(),
    );
    if (!model) {
      // WP-SHIP9-S2 (bens Folgeschnitt B4): war ein Cloud-Modell konfiguriert und die select-Policy
      // cloud-geeignet, aber die Cloud-Kante fiel wegen vertraulicher Kandidaten weg (kein lokales
      // Modell sprang ein), ist die ehrliche Ursache "confidential" statt des irreführenden "no-model".
      const fallbackReason = this.cloudExcludedByConfidentiality("select", confidential)
        ? ("confidential" as const)
        : ("no-model" as const);
      // JOB 3127: auch der Fall, in dem die KI-Auswahl GAR NICHT STATTFAND, gehört in die Laufkarte.
      // `demo: true` und KEIN `model`-Feld — es hat keines gearbeitet; die Ursache ist dieselbe, die
      // auch die Rückgabe nennt.
      await this.recordRun("select", locale, startedAt, "error", {
        fallback: chain.length > 1,
        demo: true,
        provider: this.fallback.name,
        error: fallbackReason,
      }).catch(() => undefined);
      return { criteria: null, fallbackReason };
    }
    // JOB 3036 R2 / JOB 3074: die Spur GENAU DIESES Laufs. Sie entscheidet, ob `model` und
    // `verbrauch` in den Datensatz dürfen — nur ein wirklich erfolgter Aufruf trägt sie ein.
    const spur: ModellAufrufSpur = { gerufen: false };
    let ergebnis: ImportCriteriaResult;
    try {
      const raw = await mitModellAufrufSpur(spur, () =>
        model.completeRaw(importSelectSystem(locale), prompt.trim()),
      );
      const parsed = parseFirstJsonObject(raw);
      // Modell hat geantwortet, aber ohne verwertbares JSON → ehrlich als Modellfehler ausweisen.
      ergebnis =
        parsed === null
          ? { criteria: null, fallbackReason: "model-error" }
          : { criteria: parsed, fallbackReason: null };
    } catch (err) {
      const failure = classifyModelFailure(err);
      ergebnis = {
        criteria: null,
        fallbackReason: failure.failureClass === "timeout" ? "model-timeout" : "model-error",
      };
    }
    const modellname = spur.gerufen ? model.modelName() : undefined;
    await this.recordRun(
      "select",
      locale,
      startedAt,
      ergebnis.fallbackReason === null ? "success" : "error",
      {
        // Ein Modell hat gearbeitet — auch der gescheiterte Lauf ist kein Demo-Ergebnis.
        demo: false,
        fallback: chain[0] !== model,
        provider: model.name,
        ...(modellname ? { model: modellname } : {}),
        // JOB 3074: der bezahlte, ergebnislose Aufruf behält seinen Verbrauch.
        ...(spur.verbrauch ? { verbrauch: spur.verbrauch } : {}),
        ...(ergebnis.fallbackReason ? { error: ergebnis.fallbackReason } : {}),
      },
    ).catch(() => undefined);
    return ergebnis;
  }

  // Klara Stufe 2 (Pedi 05.07.): generierende Hilfe-Antwort aus der Hilfe-Wissensdatenbank.
  // Laeuft ueber die answer-Task-Zuordnung (Admin steuert intern/extern/deterministisch mit).
  // Kann der aktive Provider nicht generieren (deterministischer Fallback), greift ehrlich
  // dessen strikte answer()-Zitierlogik — nie stilles Raten.
  async helpAnswer(
    question: string,
    context: readonly KnowledgeRef[],
    locale: ReasonerLocale = "de",
  ): Promise<AnswerResult> {
    return this.runTask("answer", locale, (p) =>
      p.helpAnswer ? p.helpAnswer(question, context, locale) : p.answer(question, context, locale),
    );
  }

  // SCRUM-426: Public-KI-Anreicherung — externer Modell-Beitrag (Weltwissen). Nur echte
  // Modelle (Cloud → lokal) können das; ohne Modell ehrlich leer (demo=true, kein Erfinden).
  // Das Ergebnis ist IMMER extern/ungeprüft; die Freigabe (Stufe „offen") prüft die Route.
  async enrichPublic(query: string, locale: ReasonerLocale = "de"): Promise<EnrichResult> {
    // JOB 3134 R3: die Kette der GEWÄHLTEN globalen Wahl (s. globaleKette) — nie ein anderer
    // externer Anbieter, auch nicht, wenn der gewählte fehlt.
    for (const provider of this.globaleKette()) {
      if (!provider.isAvailable() || !provider.enrichPublic) {
        continue;
      }
      try {
        const result = await provider.enrichPublic(query, locale);
        if (result.text.trim().length > 0) {
          return result;
        }
      } catch {
        // nächstes Modell versuchen
      }
    }
    return {
      text: "",
      provider: this.fallback.name,
      demo: true,
    };
  }

  // WP-SHIP8-CLOSE (bens F1): Fehlerklasse eines Judge-Versuchs — timeout wird eigenständig
  // ausgewiesen, alles andere (HTTP/Netz/Parse) ist model-error. ModelCapacityError bleibt der
  // EINZIGE durchgereichte Fehler (Backpressure-Vertrag → 503, unverändert).
  private static judgeFailureOf(err: unknown): JudgeFailure {
    return classifyModelFailure(err).failureClass === "timeout" ? "model-timeout" : "model-error";
  }

  // D-AISTATE PAKET 1 (bens V1, 23.07.): vertraulichkeitsbewusste Provider-Auswahl der Judge-Kette.
  // Ersetzt die frühere direkte, GATE-LOSE Schleife über [primary, secondary] (bens Befund 3.3). Die
  // Regel ist EXAKT die des zentralen `providerChain`-Chokepoints (SCRUM-502): vertraulich ⇒ die Cloud
  // (primary, externer Egress) fällt aus der Kette. aistate-fix3 (bens V1, Sicherheitsblocker):
  // auch der Secondary ist bei vertraulichen Paaren nur zulässig, wenn er vertraulichkeits-tauglich
  // ist (rejectsConfidential()!==true ⇔ bestätigte On-Prem-Origin, s. createCappedLocalClientFromEnv)
  // — ein fremd verdrahteter „lokaler" Endpunkt fällt VOR jedem Aufruf/Fetch aus der Kette.
  // `confidentialExcluded` hält fest, ob ein vorhandenes Modell GENAU an der Vertraulichkeit
  // scheiterte — dann ist der ehrliche Ausgang "confidential", nicht "no-model". Der deterministische
  // Fallback ist KEIN Judge (er urteilt nicht inhaltlich), daher taucht er hier nicht auf.
  // `confidential` ist die restriktivste Stufe des PAARES — vom Aufrufer gesetzt, hier nicht absenkbar.
  private judgeProviders(confidential: boolean): {
    providers: ReasonerProvider[];
    confidentialExcluded: boolean;
  } {
    // JOB 3134 R3: EXAKT die Kette des zentralen Chokepoints für die globale Wahl (s. globaleKette)
    // — kein zweiter Auswahlweg mehr. Ausgeschlossen GENAU wegen der Vertraulichkeit ist, was in
    // derselben Kette ohne das Paar-Bit stünde, mit ihm aber fehlt (Cloud, oder ein nicht
    // bestätigter Secondary).
    const providers = this.globaleKette(confidential);
    // JOB 3549 R2: die Differenz kommt aus `durchVertraulichkeitAusgeschlossen()` — freigabe-neutral
    // und damit deckungsgleich mit `cloudExcludedByConfidentiality`. Vorher stand hier
    // `globaleKette(false)`, das seit dem Riegel BEIDE Ketten leer sieht, sobald die Freigabe fehlt:
    // die Differenz wäre still zu `false` geworden und der Ausgang zu „no-model", obwohl ein Modell
    // verdrahtet ist. `providers` (der Egress) bleibt unverändert gegated.
    const confidentialExcluded = confidential && this.durchVertraulichkeitAusgeschlossen();
    return { providers, confidentialExcluded };
  }

  // Ehrlicher Ausgang, wenn KEIN Judge-Provider befragt werden konnte: existiert ein Modell und
  // wurde es NUR wegen der Vertraulichkeit ausgeschlossen (Cloud ODER nicht-bestätigter Secondary),
  // ist das "confidential" — NICHT "no-model" (das Modell existiert, es darf den Text nur nicht sehen).
  private static noJudgeFailure(
    confidential: boolean,
    confidentialExcluded: boolean,
  ): JudgeFailure {
    return confidential && confidentialExcluded ? "confidential" : "no-model";
  }

  // Berater-Konzept 04.07. (Stufe 2, kon-v1): „Konfliktprüfung" — urteilt inhaltlich, ob zwei
  // Kerntexte einander widersprechen/doppeln/überholen (Cloud → lokal).
  // WP-SHIP8-CLOSE (bens F1): Ergebnis-Vertrag mit unterscheidbarem AUSGANG. Vorher wurden
  // normale Provider-/HTTP-/Netz-/Parsefehler hier still zu null — für den aiCheck-Runner
  // ununterscheidbar von „kein Modell". Jetzt: verdict (das Urteil) ODER failure (Ursache):
  //  - kein befragbares Modell → no-model,
  //  - Modellaufruf warf (HTTP/Netz) → model-error, Zeitlimit → model-timeout,
  //  - Modell antwortete, aber unverwertbar (Provider parst zu null) → model-error
  //    (ein echtes „kein_konflikt" ist ein NICHT-null-verdict — nie eine Verwechslung).
  // Der erste Fehler der Kette benennt die Ursache; ein späterer Provider-ERFOLG gewinnt weiter.
  // D-AISTATE PAKET 1 (bens V1): `confidential` = restriktivste Stufe des Paares. Vertraulich ⇒ die
  // Cloud fällt über judgeProviders aus der Kette (kein Egress); nur ein lokales Modell darf urteilen.
  async judgeConflictOutcome(
    coreA: string,
    coreB: string,
    locale: ReasonerLocale = "de",
    confidential = false,
  ): Promise<ConflictJudgeOutcome> {
    let failure: JudgeFailure | undefined;
    // RT-001 (bens Sammel-Review 3): die ANBIETERNEUTRALE, strukturierte Fehlerklasse des ERSTEN
    // gefangenen Providerfehlers — reist zusätzlich zur groben `failure` bis zum Runner, damit dieser
    // die feine Ursache (auth/rate-limit/unreachable/bad-response) bilden kann, statt hier vorab auf
    // model-error zu verdichten. Trägt NIE Rohmeldung/Secret/Provider-Detail (nur {failureClass,status?}).
    let providerFailure: ModelFailureInfo | undefined;
    let attempted = false;
    const { providers, confidentialExcluded } = this.judgeProviders(confidential);
    for (const provider of providers) {
      if (!provider.judgeConflict) {
        continue;
      }
      attempted = true;
      try {
        // aistate-fix3 (bens V1): das ECHTE Paar-Bit reist bis zum ModelClient.complete-Wächter.
        const result = await provider.judgeConflict(coreA, coreB, locale, confidential);
        if (result) {
          return { verdict: result };
        }
        failure = failure ?? "model-error"; // Antwort kam, war aber unverwertbar (Parse → null)
      } catch (err) {
        if (err instanceof ModelCapacityError) {
          throw err; // Backpressure durchreichen (→ 503), nicht als Modellfehler still schlucken.
        }
        // aistate-fix3 (bens V1, Fail-safe): der zentrale Egress-Wächter hat vertraulich+nicht-lokal
        // VOR dem Fetch abgelehnt — das ist KEIN Modellfehler, sondern der ehrliche Ausgang
        // "confidential" (kein Egress, kein done).
        if (err instanceof Error && err.name === "ConfidentialEgressError") {
          failure = failure ?? "confidential";
          continue;
        }
        failure = failure ?? Reasoner.judgeFailureOf(err);
        providerFailure = providerFailure ?? classifyModelFailure(err);
        // nächstes Modell versuchen
      }
    }
    if (!attempted) {
      return {
        verdict: null,
        failure: Reasoner.noJudgeFailure(confidential, confidentialExcluded),
      };
    }
    return {
      verdict: null,
      failure: failure ?? "model-error",
      ...(providerFailure ? { providerFailure } : {}),
    };
  }

  // Bestandsfassade (Konsole/check-text/knowledge-check binden hierüber — geprüft, unverändert):
  // exakt das alte Verhalten, null in allen Nicht-Urteil-Fällen. `confidential` optional (Default
  // false = Bestandsverhalten); die Detection reicht die Paar-Vertraulichkeit durch.
  async judgeConflict(
    coreA: string,
    coreB: string,
    locale: ReasonerLocale = "de",
    confidential = false,
  ): Promise<ConflictJudgeResult | null> {
    return (await this.judgeConflictOutcome(coreA, coreB, locale, confidential)).verdict;
  }

  // Berater-Konzept Duplikate 04.07. (Stufe D2, dup-v1): „Duplikatprüfung" — Überschneidungs-Profil
  // zweier Kerntexte (Cloud → lokal). WP-SHIP8-CLOSE (bens F1): derselbe Ergebnis-Vertrag wie bei
  // judgeConflictOutcome — der Ausgang (Urteil vs. Fehlerursache vs. kein Modell) ist unterscheidbar.
  // D-AISTATE PAKET 1 (bens V1): vertraulichkeitsbewusst wie judgeConflictOutcome.
  async judgeDuplicateOutcome(
    coreA: string,
    coreB: string,
    locale: ReasonerLocale = "de",
    confidential = false,
  ): Promise<DuplicateJudgeOutcome> {
    let failure: JudgeFailure | undefined;
    // RT-001: strukturierte, anbieterneutrale Fehlerklasse des ersten gefangenen Providerfehlers (wie
    // judgeConflictOutcome) — reist bis zum Runner, keine Verdichtung auf model-error an dieser Stelle.
    let providerFailure: ModelFailureInfo | undefined;
    let attempted = false;
    const { providers, confidentialExcluded } = this.judgeProviders(confidential);
    for (const provider of providers) {
      if (!provider.judgeDuplicate) {
        continue;
      }
      attempted = true;
      try {
        // aistate-fix3 (bens V1): das ECHTE Paar-Bit reist bis zum ModelClient.complete-Wächter.
        const result = await provider.judgeDuplicate(coreA, coreB, locale, confidential);
        if (result) {
          return { verdict: result };
        }
        failure = failure ?? "model-error"; // Antwort kam, war aber unverwertbar (Parse → null)
      } catch (err) {
        if (err instanceof ModelCapacityError) {
          throw err; // Backpressure durchreichen (→ 503), nicht als Modellfehler still schlucken.
        }
        // aistate-fix3 (bens V1, Fail-safe): Egress-Wächter-Ablehnung ⇒ ehrlich "confidential".
        if (err instanceof Error && err.name === "ConfidentialEgressError") {
          failure = failure ?? "confidential";
          continue;
        }
        failure = failure ?? Reasoner.judgeFailureOf(err);
        providerFailure = providerFailure ?? classifyModelFailure(err);
        // nächstes Modell versuchen
      }
    }
    if (!attempted) {
      return {
        verdict: null,
        failure: Reasoner.noJudgeFailure(confidential, confidentialExcluded),
      };
    }
    return {
      verdict: null,
      failure: failure ?? "model-error",
      ...(providerFailure ? { providerFailure } : {}),
    };
  }

  // Bestandsfassade — exakt das alte Verhalten, null in allen Nicht-Urteil-Fällen.
  async judgeDuplicate(
    coreA: string,
    coreB: string,
    locale: ReasonerLocale = "de",
    confidential = false,
  ): Promise<DuplicateJudgeResult | null> {
    return (await this.judgeDuplicateOutcome(coreA, coreB, locale, confidential)).verdict;
  }

  // SCRUM-167: select bleibt synchron (reines Keyword-Ranking, kein Modell-/Netzaufruf).
  // ModelRun wird fire-and-forget protokolliert; demo=true, kein Fallback-Pfad. Nur Metadaten.
  select(question: string, candidates: readonly KnowledgeRef[]): KnowledgeRef[] {
    // JOB 3134 R3 (bens Korrekturpflicht 2): das erste Glied der Kette DER AUFGABE `select` — mit
    // Aufgabenabweichung und Zurücksetzen —, damit der Laufdatensatz denselben Anbieter nennt wie
    // `configStatus().effectiveAnbieter.select`. Bis Runde 2 las `select()` nur die globale Wahl.
    const provider = this.providerChain("select")[0] ?? this.fallback;
    const startedAt = new Date().toISOString();
    try {
      const result = provider.select(question, candidates);
      this.logSelect(startedAt, provider.name, "success");
      return result;
    } catch (err) {
      this.logSelect(
        startedAt,
        provider.name,
        "error",
        err instanceof Error ? err.message : "unknown",
      );
      throw err;
    }
  }

  // Fire-and-forget-Protokollierung für das synchrone select (kein await im sync-Pfad).
  private logSelect(
    startedAt: string,
    provider: string,
    status: ModelRunStatus,
    error?: string,
  ): void {
    void this.recordRun("select", undefined, startedAt, status, {
      fallback: false,
      demo: true, // deterministisches Keyword-Ranking, kein echtes Modell
      provider,
      ...(error ? { error } : {}),
    }).catch(() => undefined);
  }
}

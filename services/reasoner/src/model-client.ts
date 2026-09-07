import { execFileSync } from "node:child_process";
import {
  cappedModelClient,
  meldeAbgeschnitteneModellantwort,
  meldeModellVerbrauch,
} from "./model-concurrency";
// WP-D10 (Fix 3): typisierte Fehlerklassen (Timeout vs. HTTP-Status) — Meldungstexte unverändert.
// AUFTRAG-mega18 Block E (SCRUM-544): ModelEmptyResponseError = Antwort ohne Antwortinhalt.
import { ModelEmptyResponseError, ModelHttpError, ModelTimeoutError } from "./model-errors";
import type { ModelClient } from "./provider-model";
// JOB 3134: der Anbieterschlüssel der beiden Cloud-Wege (openai | anthropic) und ihr lesbarer Name —
// EINE Aufzählung in `types.ts`.
import { REASONER_CLOUD_ANBIETER_NAME, type ReasonerCloudAnbieter } from "./types";

export const CLOUD_API_KEY_ENV = "ANTHROPIC_API_KEY";
// JOB 3122: der Name der Env, die das Modell für BEIDE Anbieter trägt — und der Vorgabewert, den
// der Anthropic-Weg dafür kennt. Beides stand vorher als Literal in der Datei; seit dieser Runde
// wird der Vorgabewert an zwei Stellen gebraucht (die Modellwahl und die Warnzeile der
// Anbieterfalle unten), und zwei gleichlautende Literale wären zwei Wahrheiten.
const REASONER_MODEL_ENV = "REASONER_MODEL";
const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-6";
// JOB 3090 (Pedis Entscheidung 24, 05.09.): ChatGPT (OpenAI) ist ein EIGENER Cloud-Anbieter neben
// Anthropic — kein „lokaler LLM" mit fremder Adresse. Die drei Env-Namen sind von Pedi gesetzt und
// werden nicht umbenannt; die Basis-URL ist eigen, damit ein Azure-/Proxy-Endpunkt möglich bleibt.
// Sie sind ABSICHTLICH nicht exportiert: gelesen werden sie an der einen Stelle unten
// (openAiCloudClientFromEnv), und ein Export wäre ein zweiter Weg an dieselbe Konfiguration.
const OPENAI_API_KEY_ENV = "OPENAI_API_KEY";
const OPENAI_BASE_URL_ENV = "OPENAI_BASE_URL";
const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";
// Der Name des Clients trägt BEIDE Auskünfte, die die Fläche braucht: dass der Lauf in die CLOUD
// geht und WELCHER Anbieter sie ist. `local:` (s. openAiCompatibleClient) und `anthropic:` bleiben
// dadurch eindeutig unterscheidbar; `apps/web/src/lib/aiOverview.ts` liest genau dieses Präfix.
const OPENAI_CLIENT_NAME_PREFIX = "cloud:openai";
// Anzeigename in Fehlermeldungen. „Lokaler LLM antwortete mit 429" wäre über einen Anbieter in den
// USA schlicht falsch — dieselbe Klasse Unwahrheit, gegen die dieser Auftrag angetreten ist.
// JOB 3134: derselbe Name wie im Prüfergebnis des Reasoners — EINE Quelle (`types.ts`).
const OPENAI_BEZEICHNUNG = REASONER_CLOUD_ANBIETER_NAME.openai;
export const CLOUD_API_KEYCHAIN_SERVICE = "Klarwerk";
export const CLOUD_API_KEYCHAIN_ACCOUNT = CLOUD_API_KEY_ENV;
export const LEGACY_CLOUD_API_KEYCHAIN_SERVICE = "KLARWERK-App-Anthropic";
export const LEGACY_CLOUD_API_KEYCHAIN_ACCOUNT = "team1";

// SCRUM-Timeout: Cloud- und lokaler Client brechen einen hängenden Request nach diesem
// Limit ab (statt den Reasoner unbegrenzt blockieren zu lassen). Override per Env.
export const DEFAULT_MODEL_TIMEOUT_MS = 30_000;

// Parst eine Timeout-Env in ms; nur endliche, positive Zahlen zählen, sonst undefined
// (→ Default greift). Schützt vor "0", "abc", negativen Werten.
function parseTimeoutMs(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// AUFTRAG-mega18 Block E (SCRUM-544): Token-Untergrenze aus einer Env; nur endliche, positive Werte
// zählen (ganzzahlig abgeschnitten), sonst undefined → keine Untergrenze (Verhalten wie bisher).
function parseMaxTokens(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : undefined;
}

// Anbieterspezifischer HTTP-Client (Anthropic Messages API). Der Schlüssel bleibt
// ausschließlich hier (serverseitig) und verlässt den Prozess nie (FR-RSN-06).
// `fetchFn` ist injizierbar → in Tests ohne Netz prüfbar.
export interface HttpModelConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

// WP-BILD-1c: Bild-Eingang für den Vision-Pfad. Eine data:image-URL wird in den base64-Block der
// Anthropic Messages API zerlegt. NUR die vier sicheren Rasterformate (identisch zur Editor-
// Einbettungs-Allowlist); alles andere → null (der Aufrufer meldet ehrlich, nichts wird geraten).
const IMAGE_DATA_URL_RE = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$/;

// JOB 3100: EIN Wortlaut für EINEN Befund. Beide Bildwege (Anthropic-Blockform, OpenAI-data:-URL)
// prüfen mit demselben Parser und melden denselben Satz — zwei gleichlautende Literale wären zwei
// Wahrheiten, die auseinanderlaufen können.
const BILD_FORMAT_FEHLER = "Bild-Daten sind keine gültige data:image-URL (png/jpeg/gif/webp).";

export function parseImageDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const match = IMAGE_DATA_URL_RE.exec(dataUrl.trim());
  if (!match || !match[1] || !match[2]) {
    return null;
  }
  return { mediaType: match[1], base64: match[2] };
}

export function anthropicClient(config: HttpModelConfig): ModelClient {
  const fetchFn = config.fetchFn ?? fetch;
  const baseUrl = config.baseUrl ?? "https://api.anthropic.com";
  const timeoutMs = config.timeoutMs ?? DEFAULT_MODEL_TIMEOUT_MS;
  // Gemeinsamer Request-Kern für Text- und Vision-Aufrufe: gleicher Timeout, gleiche
  // Fehlerklassen (ModelHttpError/ModelTimeoutError), gleicher Antwort-Vertrag.
  const postMessages = async (body: Record<string, unknown>): Promise<string> => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const res = await fetchFn(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new ModelHttpError(`Modell-API antwortete mit ${res.status}`, res.status);
      }
      // Den ersten TEXT-Block nehmen, nicht blind Block 0. Denkfaehige Modelle stellen
      // einen `thinking`-Block voran; der traegt kein `text`, sodass `content[0].text`
      // `undefined` ist und der Client fuer JEDEN Aufruf "" zurueckgab. Ein leerer String
      // ist kein gueltiges JSON -> `parseExtractResponse` scheitert -> `hardFailure` ->
      // der Nutzer las "Ein Teil des Dokuments konnte nicht vollstaendig verarbeitet
      // werden", obwohl die API mit 200 geantwortet hatte. Der Request setzt `thinking`
      // nirgends: auf Modellen ohne Standard-Denken (etwa claude-sonnet-4-6) ist Block 0
      // deshalb ein Textblock und alles lief; auf Modellen, die adaptives Denken von sich
      // aus einschalten, brach derselbe Code lautlos. Der Fehler lag also nicht im Code,
      // der zuletzt geaendert wurde, sondern in der Modellwahl der Umgebung.
      const data = (await res.json()) as {
        content?: { type?: string; text?: string }[];
        // JOB 3074: der Verbrauchsblock der Anthropic Messages API. Bis hierher war er nicht etwa
        // ungenutzt, sondern durch diese Typangabe WEGGEWORFEN, bevor ihn irgendwer sehen konnte.
        // Bewusst `unknown` je Wert: was hier ankommt, ist eine fremde Antwort, kein Vertrag —
        // geprüft wird sie an der einen Stelle, die das darf (`meldeModellVerbrauch`).
        usage?: { input_tokens?: unknown; output_tokens?: unknown } | null;
      };
      // JOB 3074: VERBRAUCHT IST VERBRAUCHT. Der Verbrauch wird gemeldet, BEVOR die Textauswertung
      // darunter entscheidet, ob etwas Brauchbares herauskam — eine Antwort ohne verwertbaren
      // Textblock ist trotzdem bezahlt. Fehlt der Block oder trägt er unbrauchbare Werte, meldet
      // diese Zeile nichts; sie erfindet unter keinen Umständen eine Zahl.
      meldeModellVerbrauch(data.usage?.input_tokens, data.usage?.output_tokens);
      const blocks = data.content ?? [];
      // Erst der ausdrueckliche Textblock; sonst der erste Block, der ueberhaupt Text
      // traegt (aeltere Antwortformen ohne `type`-Feld bleiben so lesbar).
      const text = (
        blocks.find((block) => block?.type === "text") ??
        blocks.find((block) => typeof block?.text === "string")
      )?.text;
      return text ?? "";
    } catch (err) {
      if (timedOut) {
        throw new ModelTimeoutError(
          `Modell-API überschritt das Zeitlimit von ${timeoutMs} ms`,
          timeoutMs,
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };
  return {
    name: `anthropic:${config.model}`,
    // JOB 3036: derselbe Wert OHNE Anbieter-Präfix — das Laufprotokoll nennt damit das echte
    // Modell, statt ein zweites Mal den Provider. `name` bleibt bytegleich.
    model: config.model,
    // SCRUM-411: maxTokens pro Aufruf — kurze Tasks bleiben bei 1024; extract braucht mehr
    // (JSON mit bis zu 20 Punkten inkl. wörtlicher Belegstellen wurde bei 1024 abgeschnitten).
    // SCRUM-502 Schicht 2: `confidential` ist Interface-Pflicht; der Egress-Wächter sitzt im
    // Cloud-Wrapper (cappedModelClient), der rohe Client selbst reicht den Aufruf nur durch.
    async complete(
      system: string,
      user: string,
      _confidential: boolean,
      maxTokens = 1024,
    ): Promise<string> {
      return postMessages({
        model: config.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      });
    },
    // WP-BILD-1c: Vision-Aufruf — content als Block-Array (image + text), exakt der in der
    // WP-BILD-1b-Skizze beschriebene multimodale Pfad. Ungültige/nicht erlaubte Bild-Daten
    // werfen VOR dem HTTP-Aufruf (ehrlicher Fehler, kein Request ins Leere).
    async completeVision(
      system: string,
      imageDataUrl: string,
      user: string,
      _confidential: boolean,
      maxTokens = 1024,
    ): Promise<string> {
      const image = parseImageDataUrl(imageDataUrl);
      if (!image) {
        throw new Error(BILD_FORMAT_FEHLER);
      }
      return postMessages({
        model: config.model,
        max_tokens: maxTokens,
        system,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: image.mediaType, data: image.base64 },
              },
              { type: "text", text: user },
            ],
          },
        ],
      });
    },
  };
}

type CloudKeyLookup = (service: string, account: string) => string | undefined;
type CloudKeyStore = (service: string, account: string, value: string) => boolean;

function findCloudKeyInKeychain(service: string, account: string): string | undefined {
  try {
    const value = execFileSync(
      "security",
      ["find-generic-password", "-s", service, "-a", account, "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function storeCloudKeyInKeychain(service: string, account: string, value: string): boolean {
  try {
    execFileSync(
      "security",
      ["add-generic-password", "-U", "-s", service, "-a", account, "-w", value],
      { stdio: ["ignore", "ignore", "ignore"] },
    );
    return true;
  } catch {
    process.stderr.write(
      `[KLARWERK] Legacy-Cloud-KI-Key konnte nicht in den kanonischen Keychain-Eintrag migriert werden (service=${service}, account=${account}).\n`,
    );
    return false;
  }
}

export function resolveCloudApiKey(
  env: Record<string, string | undefined> = process.env,
  keychainLookup: CloudKeyLookup = findCloudKeyInKeychain,
  keychainStore: CloudKeyStore = storeCloudKeyInKeychain,
): string | undefined {
  const envKey = env[CLOUD_API_KEY_ENV]?.trim();
  if (envKey) {
    return envKey;
  }
  const canonicalKey = keychainLookup(CLOUD_API_KEYCHAIN_SERVICE, CLOUD_API_KEYCHAIN_ACCOUNT);
  if (canonicalKey) {
    return canonicalKey;
  }
  const legacyKey = keychainLookup(
    LEGACY_CLOUD_API_KEYCHAIN_SERVICE,
    LEGACY_CLOUD_API_KEYCHAIN_ACCOUNT,
  );
  if (!legacyKey) {
    return undefined;
  }
  keychainStore(CLOUD_API_KEYCHAIN_SERVICE, CLOUD_API_KEYCHAIN_ACCOUNT, legacyKey);
  return legacyKey;
}

// Baut den Cloud-Client aus Env oder macOS-Keychain. Ohne Schlüssel → deterministischer Betrieb.
export function createModelClientFromEnv(
  env: Record<string, string | undefined> = process.env,
  keychainLookup: CloudKeyLookup = findCloudKeyInKeychain,
  keychainStore: CloudKeyStore = storeCloudKeyInKeychain,
): ModelClient | undefined {
  const apiKey = resolveCloudApiKey(env, keychainLookup, keychainStore);
  if (!apiKey) {
    if (keychainLookup === findCloudKeyInKeychain) {
      process.stderr.write(
        `[KLARWERK] Cloud-KI-Key weder per ENV noch im macOS-Keychain gefunden oder lesbar (canonical=${CLOUD_API_KEYCHAIN_SERVICE}/${CLOUD_API_KEYCHAIN_ACCOUNT}, legacy=${LEGACY_CLOUD_API_KEYCHAIN_SERVICE}/${LEGACY_CLOUD_API_KEYCHAIN_ACCOUNT}).\n`,
      );
    }
    return undefined;
  }
  const timeoutMs = parseTimeoutMs(env.REASONER_TIMEOUT_MS);
  return anthropicClient({
    apiKey,
    // JOB 3122: `?? "claude-sonnet-4-6"` griff bei einem LEER gesetzten Eintrag NICHT — `??` fängt
    // nur `undefined`/`null`. Ein `REASONER_MODEL=` (oder ein Eintrag aus Leerzeichen) ergab damit
    // ein LEERES Modell im Request. `?.trim() ||` fängt beide Formen auf denselben Vorgabewert und
    // ist die Voraussetzung dafür, dass die Compose-Zeile den Namen ohne Vorgabewert durchreichen
    // darf (docker-compose.prod.yml, `${REASONER_MODEL:-}`).
    // JOB 3134: die Regel steht jetzt in `anthropicModellAusEnv` (unten) — ANTHROPIC_MODEL vor dem
    // gemeinsamen Wert, und der gemeinsame Wert nur, wenn er ein Anthropic-Bezeichner ist.
    model: anthropicModellAusEnv(env),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });
}

// SCRUM-424 (Pedi 03.07.): generischer OpenAI-kompatibler Client. Deckt den EIGENEN lokalen
// LLM-Server ab — vLLM (z. B. Qwen3-32B-AWQ), Ollama, llama.cpp-Server, LM Studio u. a. sprechen
// alle /v1/chat/completions —, und seit JOB 3090 denselben Weg zu ChatGPT (OpenAI). Der Schlüssel
// bleibt (wie beim Anthropic-Client) serverseitig und verlässt den Prozess nie. `fetchFn`
// injizierbar → in Tests ohne Netz prüfbar.
//
// JOB 3090: der Typ heißt nicht mehr `LocalHttpModelConfig`. Er konfiguriert seit diesem Auftrag
// AUCH einen externen Cloud-Anbieter; ein „Local" im Namen wäre genau die Etikettenlüge, gegen die
// dieser Auftrag steht. Was WIRKLICH lokal ist, entscheidet nicht dieser Typ, sondern
// `isConfirmedLocalOrigin` (s. u.) — und für OpenAI gar nichts davon: dort ist der Egress-Riegel
// hart gesetzt.
export interface ChatCompletionsModelConfig {
  baseUrl: string; // z. B. http://127.0.0.1:8000/v1 oder https://api.openai.com/v1
  model: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  // JOB 3090: der vollständige Client-NAME. Ohne Angabe `local:${model}` — der Bestandsname des
  // eigenen lokalen LLM, unverändert. Der OpenAI-Cloud-Weg setzt ihn auf `cloud:openai:${model}`,
  // damit die Fläche den Anbieter nennen kann, statt ihn als „lokal" auszugeben.
  name?: string;
  // JOB 3090: der Anzeigename in Fehlermeldungen. Ohne Angabe „Lokaler LLM" (Wortlaut unverändert).
  // Das Muster „<Name> antwortete mit <Status>" bleibt erhalten — `services/app/src/
  // ai-check-worker.ts:147` liest den HTTP-Status genau daraus.
  bezeichnung?: string;
  // AUFTRAG-mega18 Block E (SCRUM-544): UNTERGRENZE des Antwort-Budgets für den EIGENEN lokalen LLM
  // (Env KLARWERK_LOCAL_LLM_MAX_TOKENS). Die Aufrufer-Budgets (Default 1024, extract 16384 …) sind auf
  // die Cloud-Ökonomie gerechnet; ein DENKMODELL verbraucht sie in seiner Denkphase und liefert dann
  // gar keinen Antwortinhalt mehr. Auf eigener Hardware kostet Kopfraum nichts, deshalb hebt dieser
  // Wert ein zu kleines Budget an (Math.max) — er SENKT nie ein bewusst höheres Aufrufer-Budget.
  maxTokensFloor?: number;
  // JOB 3100: BILDEINGANG (Vision) — ausdrücklich konfiguriert, nicht geschenkt. Nur wenn dieses Feld
  // gesetzt ist, trägt der gebaute Client überhaupt ein `completeVision`. Grund: `describeImage`
  // (`provider-model.ts:1281`) entscheidet an `typeof client.completeVision !== "function"`, ob es den
  // Bildweg gehen darf. Eine IMMER vorhandene Methode würde die Kette auch an einen EIGENEN lokalen
  // LLM schicken, dessen Bildfähigkeit niemand zugesagt hat — statt dort ehrlich zu scheitern.
  // Gesetzt wird das Feld an genau EINER Stelle: `openAiCloudClientFromEnv`.
  bildEingang?: boolean;
  // JOB 3222: WELCHES FELD das Antwortbudget trägt (Begründung im Block unter dieser
  // Schnittstelle, bei der Typdeklaration `BudgetFeld`). Ohne Angabe
  // `max_tokens` — der Bestandsvertrag des EIGENEN lokalen Servers, byteweise unverändert. Gesetzt
  // wird es an genau EINER Stelle: `openAiCloudClientFromEnv` (Konfigurationsart cloud:openai).
  budgetFeld?: BudgetFeld;
}

// ================================================================================================
// JOB 3222 (KI-OPENAI-400) — DAS ANTWORTBUDGET HEISST NICHT AN JEDER GEGENSTELLE GLEICH.
// ================================================================================================
//
// Live gemessen (Codex a4e82a81, 07.09., Konfiguration `cloud:openai:gpt-6-astra`): der Ein-Wort-
// Ping des Admin-Tests bekam HTTP 400, und dank JOB 3122 stand der Grund wörtlich dabei —
// „Unsupported parameter: 'max_tokens' is not supported with this model. Use
// 'max_completion_tokens' instead. (unsupported_parameter)". `max_completion_tokens` ist bei OpenAI
// die Obergrenze EINSCHLIESSLICH der Reasoning-Tokens; `max_tokens` gilt dort als veraltet.
//
// Bei einem EIGENEN lokalen OpenAI-kompatiblen Server (vLLM, llama.cpp, Ollama, LM Studio) ist es
// umgekehrt: dort trägt `max_tokens`, und ein neuer Name wäre ein neuer 400. Es gibt also nicht
// EINEN richtigen Parameter, sondern einen JE KONFIGURATIONSART — und genau daran, VOR dem Aufruf,
// wird er entschieden.
//
// AUSDRÜCKLICH NICHT so: keine Heuristik über den Fehlertext des Anbieters und keine Verhandlung
// (erst das eine Feld, bei 400 das andere). Ein geratener zweiter Versuch verdoppelt jeden
// Fehlerfall, verschiebt das Zeitlimit und macht aus einem klaren Befund eine Vermutung. Ein 400
// bleibt deshalb ein Fehler mit Grund (JOB 3122), auch dieser.
type BudgetFeld = "max_tokens" | "max_completion_tokens";
const BUDGET_FELD_VORGABE: BudgetFeld = "max_tokens";

// AUFTRAG-mega18 Block E (SCRUM-544): Antwortform von /chat/completions, so weit sie hier gelesen wird.
// `finish_reason` belegt den Abbruch am Token-Limit. `reasoning` / `reasoning_content` /
// `thinking` sind die verbreiteten Felder, in die DENKMODELLE (qwen3,
// DeepSeek-R1 …) ihre Denkphase legen (vLLM/llama.cpp: reasoning_content, neuere Ollama: reasoning
// bzw. thinking). Sie werden NUR gelesen, um „hat gedacht, aber nichts geantwortet" von „hat nichts
// geliefert" zu unterscheiden — ihr TEXT ist kein Antwortinhalt und wird NIE als Ergebnis gereicht.
interface OpenAiChatChoice {
  finish_reason?: string | null;
  message?: {
    content?: string | null;
    reasoning?: string | null;
    reasoning_content?: string | null;
    thinking?: string | null;
  } | null;
}

// Fremde Verbrauchswerte bleiben unknown, bis der jeweilige Leser sie geprüft hat.
interface OpenAiChatUsage {
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  completion_tokens_details?: { reasoning_tokens?: unknown } | null;
}

// AUFTRAG-mega18 Block E (SCRUM-544): der EINE Ort, an dem aus der Antwort ein Ergebnis wird.
// Fehlender/leerer Inhalt wirft einen typisierten, unterscheidbaren Fehler. Nichtleerer Inhalt
// bleibt als WERT unverändert: salvageTruncatedExtract rettet vorhandenes, abgeschnittenes JSON.
// JOB 3239: Ein belegter Abbruch wird vor der Rückgabe serverintern gemeldet; ein Fragment geht
// damit weiterhin zum Aufrufer, aber nicht mehr ohne Auskunft über seine Unvollständigkeit.
// JOB 3090: `bezeichnung` benennt den Anbieter, der nichts geliefert hat. Vorgabe „Lokaler LLM"
// (Bestandswortlaut); für ChatGPT steht dort „ChatGPT (OpenAI)". Der maschinenlesbare Teil
// (`reason`, `finishReason`, `maxTokens`) ist davon unberührt.
//
// JOB 3222: `budgetFeld` benennt im Diagnose-Detail das Feld, das WIRKLICH gesendet wurde.
// Der Name der Zahl folgt dem Request. „max_tokens=1024" über einen Aufruf, der
// `max_completion_tokens` geschickt hat, wäre eine Aussage über ein Feld, das gar nicht vorkam.
function requireChatContent(
  data: unknown,
  maxTokens: number,
  bezeichnung: string,
  budgetFeld: BudgetFeld,
): string {
  const response = data as
    | {
        choices?: OpenAiChatChoice[];
        usage?: OpenAiChatUsage | null;
      }
    | null
    | undefined;
  const choice = response?.choices?.[0];
  const message = choice?.message;
  const content = typeof message?.content === "string" ? message.content : "";
  const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : undefined;
  const truncated = finishReason === "length";
  if (content.trim().length > 0) {
    if (truncated) {
      meldeAbgeschnitteneModellantwort(
        bezeichnung,
        budgetFeld,
        maxTokens,
        finishReason,
        content.length,
      );
    }
    return content;
  }
  const reasoningTokens = response?.usage?.completion_tokens_details?.reasoning_tokens;
  const sawReasoning =
    [message?.reasoning, message?.reasoning_content, message?.thinking].some(
      (field) => typeof field === "string" && field.trim().length > 0,
    ) ||
    (typeof reasoningTokens === "number" && reasoningTokens > 0);
  // PII-frei: die Meldung trägt nur Metadaten (Budget, finish_reason) — nie Antwort- oder Denktext.
  const detail = `${budgetFeld}=${maxTokens}, finish_reason=${finishReason ?? "-"}`;
  if (sawReasoning) {
    throw new ModelEmptyResponseError(
      `${bezeichnung} lieferte nur eine Denkphase (reasoning) ohne Antwortinhalt (${detail}).`,
      { reason: "reasoning-only", finishReason, sawReasoning: true, maxTokens },
    );
  }
  if (truncated) {
    throw new ModelEmptyResponseError(
      `${bezeichnung}: Antwort wurde am Token-Limit abgeschnitten, bevor Antwortinhalt entstand (${detail}).`,
      { reason: "truncated", finishReason, maxTokens },
    );
  }
  throw new ModelEmptyResponseError(`${bezeichnung} lieferte keinen Antwortinhalt (${detail}).`, {
    reason: "empty",
    finishReason,
    maxTokens,
  });
}

// ================================================================================================
// JOB 3122 (N12d) — DIE BEGRÜNDUNG DES ANBIETERS KAM AN UND WURDE WEGGEWORFEN.
// ================================================================================================
//
// Bis hierher warf der Request-Kern bei `!res.ok` sofort — der Antwortkörper wurde erst DANACH
// gelesen, bei einem 4xx also nie. Der OpenAI-400-Körper (`{"error":{"message":…,"code":…}}`) sagt
// aber genau das, was in der Vorführung fehlte: unbekanntes Modell, nicht unterstützter Parameter,
// abgelehnter Schlüssel. Er wird jetzt gelesen, BEVOR geworfen wird.
//
// DREI REGELN, DIE DAS ZITAT EINGRENZEN:
//  1. ZITIERT, NICHT GEDEUTET. Ist kein Grund gewinnbar (leerer Körper, Lesefehler, Antwort ohne
//     `text()`), bleibt die Meldung EXAKT die bisherige — kein „unbekannter Fehler"-Text.
//  2. GEHEIMNISFREI. Der Schlüssel verlässt den Prozess nie (FR-RSN-06) — auch nicht als Echo in
//     der Fehlermeldung eines Anbieters, der ihn zurückzitiert („Incorrect API key provided: sk-…").
//  3. EINZEILIG UND GEKAPPT. Ein Fehlerkörper kann eine HTML-Seite sein; ins Diagnose-Log gehört ein
//     Satz, keine Seite.
const ANBIETER_GRUND_MAX = 200;
const GEHEIMNIS_MARKE = "[entfernt]";

// Schlüsselartige Zeichenketten. Die Reihenfolge ist Absicht: `Bearer <…>` zuerst, damit ein
// „Bearer sk-…" als Ganzes fällt und nicht nur sein Rumpf.
//
// JOB 3122 RUNDE 2 (bens Korrekturpflicht 1): die erste Fassung verglich nur `[A-Za-z0-9_-]` und
// endete damit AM MASKIERUNGSZEICHEN. Genau so schickt OpenAI seine Schlüssel-Echos aber zurück:
// „Incorrect API key provided: sk-proj-********************abcd" bzw. „sk-…abcd". Aus
// `sk-proj-BEN***SYNTHETIC_TAIL` wurde `[entfernt]***SYNTHETIC_TAIL` — ein SCHLÜSSELAUSSCHNITT blieb
// stehen, und der ist genau das, was FR-RSN-06 verbietet. Der Zeichenvorrat deckt deshalb auch die
// Maskierungs- und Base64-Zeichen ab.
//
// JOB 3122 RUNDE 3 (bens Korrekturpflicht): die MASKIERUNGSBRÜCKE kannte nur die ASCII-Punktfolge
// `...`. Der Kommentar behauptete „`…`/`...`" — das EINZELZEICHEN U+2026 stand aber nirgends im
// Muster, und aus `sk-…BEN_SYNTHETIC_TAIL` wurde `[entfernt]…BEN_SYNTHETIC_TAIL`: derselbe Rest,
// nur eine Maskierungsform weiter. Beide Schreibweisen sind jetzt AUSFÜHRBAR im Muster, nicht nur
// im Kommentar.
//
// DIE BRÜCKE TRÄGT NUR, WENN AUF BEIDEN SEITEN SCHLÜSSEL STEHT: die Punkte/das Auslassungszeichen
// werden nur dann mitgetilgt, wenn UNMITTELBAR weiteres Schlüsselmaterial folgt. Ein Satzende bleibt
// deshalb Auskunft — weder „sk-proj-ABC123XYZ. You can find …" noch „sk-proj-ABC123… siehe Doku"
// verlieren ihren Erklärungssatz.
const SCHLUESSEL_RUMPF = "[A-Za-z0-9_*+/=-]";
const MASKIERUNGSBRUECKE = "(?:\\.{2,}|\\u2026+)";
const SCHLUESSEL_MUSTER = new RegExp(
  `\\bsk[-_]${SCHLUESSEL_RUMPF}*(?:${MASKIERUNGSBRUECKE}${SCHLUESSEL_RUMPF}+)*`,
  "gi",
);

function tilgeGeheimnisse(text: string): string {
  return text
    .replace(/\bBearer\s+\S+/gi, `Bearer ${GEHEIMNIS_MARKE}`)
    .replace(SCHLUESSEL_MUSTER, GEHEIMNIS_MARKE);
}

// Aus einem rohen Fremdtext wird eine einzeilige, geheimnisfreie, gekappte Auskunft — oder
// `undefined`, wenn nichts übrig bleibt (dann sagt der Anbieter eben nichts).
function kuerzeAnbieterGrund(roh: string): string | undefined {
  const einzeilig = tilgeGeheimnisse(roh).replace(/\s+/g, " ").trim();
  if (einzeilig.length === 0) {
    return undefined;
  }
  return einzeilig.length > ANBIETER_GRUND_MAX
    ? `${einzeilig.slice(0, ANBIETER_GRUND_MAX - 1)}…`
    : einzeilig;
}

// Liest den Fehlerkörper und gewinnt daraus den Grund. FAIL-SAFE: dieser Weg darf den Fehlerweg
// nicht sprengen — jeder Fehlschlag (kein `text()`, abgebrochener Körper, kein JSON) endet in
// `undefined` bzw. im rohen Text, nie in einem zweiten geworfenen Fehler.
async function anbieterGrundAusAntwort(res: Response): Promise<string | undefined> {
  let roh: string;
  try {
    roh = await res.text();
  } catch {
    return undefined;
  }
  if (typeof roh !== "string" || roh.trim().length === 0) {
    return undefined;
  }
  try {
    const daten = JSON.parse(roh) as { error?: { message?: unknown; code?: unknown } } | null;
    const fehler = daten?.error;
    const satz = typeof fehler?.message === "string" ? fehler.message.trim() : "";
    const code = typeof fehler?.code === "string" ? fehler.code.trim() : "";
    if (satz && code) {
      return kuerzeAnbieterGrund(`${satz} (${code})`);
    }
    if (satz || code) {
      return kuerzeAnbieterGrund(satz || code);
    }
  } catch {
    // Kein JSON — dann ist der rohe Text die einzige Auskunft, die es gibt.
  }
  return kuerzeAnbieterGrund(roh);
}

export function openAiCompatibleClient(config: ChatCompletionsModelConfig): ModelClient {
  const fetchFn = config.fetchFn ?? fetch;
  const base = config.baseUrl.replace(/\/+$/, "");
  const timeoutMs = config.timeoutMs ?? DEFAULT_MODEL_TIMEOUT_MS;
  const bezeichnung = config.bezeichnung ?? "Lokaler LLM";
  // JOB 3222: EINMAL entschieden, danach unveränderlich — die Konfigurationsart bestimmt das Feld,
  // nicht die Antwort des Anbieters.
  const budgetFeld: BudgetFeld = config.budgetFeld ?? BUDGET_FELD_VORGABE;
  // JOB 3100: GEMEINSAMER REQUEST-KERN für Text- UND Bildaufruf — genau wie `postMessages` auf der
  // Anthropic-Kante (s. o.). Text und Bild unterscheiden sich beim OpenAI-Vertrag AUSSCHLIESSLICH in
  // der Form von `messages`; alles andere (Zeitlimit, Bearer, res.ok, Verbrauchsmeldung,
  // Antwort-Vertrag, Fehlerklassen) ist dasselbe und steht deshalb nur EINMAL da. Der gefetchte
  // Ausdruck (Basis + Pfad) steht an genau einer Stelle dieser Datei — F12 zählt genau diese
  // Zeichenform und duldet keine zweite, auch nicht als Zitat in einem Kommentar; deshalb ist er
  // hier nicht wiederholt.
  const postChatCompletions = async (messages: unknown[], maxTokens: number): Promise<string> => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    // AUFTRAG-mega18 Block E (SCRUM-544): wirksames Budget = Aufrufer-Budget, mindestens die
    // konfigurierte Untergrenze (s. maxTokensFloor). Ohne Konfiguration bleibt alles wie bisher.
    const budget = Math.max(maxTokens, config.maxTokensFloor ?? 0);
    try {
      const res = await fetchFn(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          // JOB 3222: GENAU EIN Budgetfeld je Anfrage, benannt von der Konfigurationsart. Nicht
          // beide nebeneinander: OpenAI weist `max_tokens` mit 400 zurück, statt es zu übergehen.
          [budgetFeld]: budget,
          messages,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        // JOB 3122: DER EINE WURF — und er liest vorher den Körper. Das Präfix
        // „<Bezeichnung> antwortete mit <Status>" bleibt ZEICHENGLEICH und steht am Anfang, weil
        // `model-errors.ts` (`/antwortete mit (\d{3})/`) und `services/app/src/ai-check-worker.ts`
        // den Status genau daraus lesen. Ohne Grund bleibt der Satz karg statt erfunden.
        const grund = await anbieterGrundAusAntwort(res);
        throw new ModelHttpError(
          grund === undefined
            ? `${bezeichnung} antwortete mit ${res.status}`
            : `${bezeichnung} antwortete mit ${res.status}: ${grund}`,
          res.status,
          grund,
        );
      }
      const data = await res.json();
      // JOB 3074: NUR MELDEN, WAS DER SERVER WIRKLICH NENNT. Ein lokaler LLM-Server MUSS keinen
      // `usage`-Block liefern; tut er es nicht, steht im Protokoll nichts. Eine Schätzung aus der
      // Textlänge wäre bequem und wäre eine erfundene Zahl. Gemeldet wird VOR
      // `requireChatContent`: eine Antwort ohne Antwortinhalt hat trotzdem Token verbraucht, und
      // genau dieser Fall (Denkphase ohne Ergebnis) ist der teure.
      const usage = (data as { usage?: OpenAiChatUsage | null } | null)?.usage;
      meldeModellVerbrauch(usage?.prompt_tokens, usage?.completion_tokens);
      // AUFTRAG-mega18 Block E (SCRUM-544): kein stilles "" mehr — fehlender/leerer Antwortinhalt
      // wirft einen unterscheidbaren Fehler (reasoning-only / truncated / empty). Das gilt seit
      // JOB 3100 auch für den Bildweg: eine leere Bild-Antwort ist ein Fehler, kein Leerstring.
      return requireChatContent(data, budget, bezeichnung, budgetFeld);
    } catch (err) {
      // JOB 3122 RUNDE 2 (bens Korrekturpflicht 2): EIN EMPFANGENER STATUS IST DIE STÄRKERE AUSKUNFT.
      // Seit das Lesen des Fehlerkörpers (oben) im Fehlerweg liegt, kann das Zeitlimit AUCH DANN noch
      // zuschlagen, wenn der Status längst da ist: der Anbieter hat mit 400 geantwortet, nur der Körper
      // tröpfelt. Ohne diese Bedingung überschrieb der Zeitlimit-Zweig genau diesen Fall — aus einem
      // belegten `ModelHttpError` (Status 400, Klasse „http") wurde ein `ModelTimeoutError` OHNE Status,
      // und nutzerseitig wurde aus „Anbieter lehnt ab" ein „zu langsam". Ein bereits geworfener
      // HTTP-Fehler trägt eine gemessene Tatsache und geht deshalb unverändert durch; das Zeitlimit
      // bleibt für alles zuständig, was VOR einer Statuszeile abbricht.
      if (timedOut && !(err instanceof ModelHttpError)) {
        throw new ModelTimeoutError(
          `${bezeichnung} überschritt das Zeitlimit von ${timeoutMs} ms`,
          timeoutMs,
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };
  return {
    name: config.name ?? `local:${config.model}`,
    // JOB 3036: s. anthropicClient — der reine Modellbezeichner des eigenen lokalen Modells.
    model: config.model,
    // SCRUM-502 Schicht 2: `confidential` ist Interface-Pflicht; der Egress-Wächter sitzt im
    // Cloud-Wrapper (cappedModelClient), der rohe Client selbst reicht den Aufruf nur durch.
    async complete(
      system: string,
      user: string,
      _confidential: boolean,
      maxTokens = 1024,
    ): Promise<string> {
      return postChatCompletions(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        maxTokens,
      );
    },
    // JOB 3100: DER BILDWEG IST FREIGESCHALTET, NICHT EINGEBAUT — er hängt an `bildEingang` (s. dort).
    // FREI für ChatGPT (OpenAI): Pedis Entscheidung 6 („hundert Prozent auf ChatGPT") gilt auch für
    // Bilder; OpenAI sagt den `image_url`-Eingang auf `/chat/completions` zu.
    // BEWUSST NICHT für den EIGENEN lokalen LLM (`createLocalClientFromEnv` setzt das Feld nicht):
    // ob ein selbst betriebener Server Bilder kann, ist nicht garantiert — dort bleibt der fehlende
    // Bild-Eingang ein ehrlicher Fehlschlag (der alte Grund, unverändert gültig; nie erfinden).
    ...(config.bildEingang
      ? {
          async completeVision(
            system: string,
            imageDataUrl: string,
            user: string,
            _confidential: boolean,
            maxTokens = 1024,
          ): Promise<string> {
            // Derselbe Parser und dieselbe Allowlist wie auf der Anthropic-Kante (kein zweiter
            // Parser, keine zweite Liste): ungültige Bild-Daten werfen VOR dem HTTP-Aufruf.
            if (!parseImageDataUrl(imageDataUrl)) {
              throw new Error(BILD_FORMAT_FEHLER);
            }
            return postChatCompletions(
              [
                { role: "system", content: system },
                {
                  role: "user",
                  content: [
                    { type: "text", text: user },
                    // Der OpenAI-Vertrag verlangt die data:-URL AM STÜCK. Sie wird deshalb nicht in
                    // base64 und Medientyp zerlegt — hinaus geht genau die geprüfte Zeichenkette.
                    { type: "image_url", image_url: { url: imageDataUrl.trim() } },
                  ],
                },
              ],
              maxTokens,
            );
          },
        }
      : {}),
  };
}

// SCRUM-424: baut den lokalen Client aus der Umgebung. Ohne URL/Modell → undefined (kein lokaler
// LLM verdrahtet). Die Werte kommen aus dem Launcher/Schlüsselbund, NIE aus dem Code/Repo.
export function createLocalClientFromEnv(
  env: Record<string, string | undefined> = process.env,
): ModelClient | undefined {
  const baseUrl = env.KLARWERK_LOCAL_LLM_URL;
  const model = env.KLARWERK_LOCAL_LLM_MODEL;
  if (!baseUrl || !model) {
    return undefined;
  }
  const timeoutMs = parseTimeoutMs(env.KLARWERK_LOCAL_LLM_TIMEOUT_MS);
  // AUFTRAG-mega18 Block E (SCRUM-544): gleiches Konfigurationsmuster wie URL/Modell/Key/Timeout —
  // Wert kommt aus dem Launcher/der Umgebung, NIE aus dem Code. Ungültig/0/negativ → Default (aus).
  const maxTokensFloor = parseMaxTokens(env.KLARWERK_LOCAL_LLM_MAX_TOKENS);
  return openAiCompatibleClient({
    baseUrl,
    model,
    ...(env.KLARWERK_LOCAL_LLM_KEY ? { apiKey: env.KLARWERK_LOCAL_LLM_KEY } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    ...(maxTokensFloor !== undefined ? { maxTokensFloor } : {}),
  });
}

// ================================================================================================
// JOB 3090 — CHATGPT IST EIN CLOUD-ANBIETER UND SAGT DAS AUCH.
// ================================================================================================
//
// Pedis Entscheidung 24 (05.09., 19:23): „Als KI werden wir ChatGPT nehmen … neuer Token für
// KLARWERK und Klara". Vor diesem Auftrag gab es dafür genau einen Weg — den LOKALEN
// (`createLocalClientFromEnv`), und der hätte gelogen: der Egress-Riegel wäre über
// `isConfirmedLocalOrigin` zwar gefallen (api.openai.com ist kein Loopback), der Client hätte aber
// weiter `local:gpt-…` geheißen und die Admin-Übersicht ihn als „eigenen lokalen LLM-Server"
// ausgewiesen — über einen Anbieter in den USA.
//
// KEIN ZWEITER TRANSPORTWEG: `openAiCompatibleClient` kann /chat/completions, Bearer, die
// usage-Meldung und die typisierten Leer-Antwort-Fehler bereits. Er bekommt zwei Parameter mehr
// (Name, Bezeichnung) statt einer zweiten Fassung derselben HTTP-Schleife.
//
// KEIN `maxTokensFloor`: die Untergrenze aus AUFTRAG-mega18 Block E ist auf EIGENE Hardware
// gerechnet, wo Kopfraum nichts kostet. Bei einem Anbieter, der pro Token abrechnet, wäre sie eine
// stillschweigende Kostenerhöhung.
//
// Ohne Schlüssel ODER ohne Modell: `undefined` — inaktiv, ohne Fehler und ohne Log-Rauschen
// (dasselbe Muster wie `createLocalClientFromEnv`). Ein Schlüssel ohne Modell ist KEINE
// Konfiguration: `REASONER_MODEL` hat für Anthropic einen Vorgabewert, für OpenAI wäre jeder
// geratene Modellname eine Erfindung.
//
// JOB 3122 (N12d) — UND EIN ANTHROPIC-BEZEICHNER IST EBENFALLS KEINE OPENAI-KONFIGURATION.
// `REASONER_MODEL` gilt für BEIDE Wege. Wer nur `OPENAI_API_KEY` setzte und das Modell aus dem
// Anthropic-Betrieb stehen liess, schickte `claude-…` an api.openai.com — ein garantierter 400 bei
// JEDEM Lauf, gefolgt von einem Ersatzmodus, dem niemand ansah, warum. Ein solcher Bezeichner gilt
// hier deshalb wie „kein Modell": der OpenAI-Client entsteht gar nicht, und
// `createCappedCloudClientFromEnv` fällt auf den Anthropic-Weg zurück, wo der Name hingehört. Die
// Fläche bleibt dabei ehrlich, weil der Clientname den TATSÄCHLICH arbeitenden Anbieter trägt
// (`anthropic:` statt `cloud:openai:`, gelesen von `apps/web/src/lib/aiOverview.ts`).
//
// VERGLICHEN WERDEN PRÄFIXE, KEINE TEILZEICHENKETTEN: ein echtes OpenAI-Modell, in dessen Namen das
// Wort zufällig vorkäme, bleibt am OpenAI-Weg. Genau EINE stderr-Zeile erklärt die übergangene
// Konfiguration — mit den Env-NAMEN und dem Modellnamen, nie mit einem Schlüssel oder einem
// Schlüsselausschnitt.
const ANTHROPIC_MODELL_PRAEFIXE = ["claude-", "anthropic/"];

function istAnthropicModell(modell: string): boolean {
  const name = modell.trim().toLowerCase();
  return ANTHROPIC_MODELL_PRAEFIXE.some((praefix) => name.startsWith(praefix));
}

//
// ================================================================================================
// JOB 3134 (KI-WAHL) — JE ANBIETER EIN EIGENES MODELL, UND EIN GRUND, WENN ER NICHT ENTSTEHT.
// ================================================================================================
//
// `REASONER_MODEL` gilt weiterhin für beide Wege — aber NUR für den, zu dem der Name gehört
// (dieselbe Präfixregel wie oben: `claude-`/`anthropic/` ist Anthropic, alles andere OpenAI). Wer
// beide Anbieter hinterlegt und für beide ein eigenes Modell will, setzt `OPENAI_MODEL` bzw.
// `ANTHROPIC_MODEL`; sie gehen dem gemeinsamen Wert vor. Kein Anbieter bekommt je einen
// anbieterfremden Bezeichner untergeschoben (P03 Lieferumfang 2).
//
// Ein Anbieter, der NICHT entsteht, sagt WARUM — als geheimnisfreier Satz mit Env-NAMEN, den die
// Fläche neben dem nicht wählbaren Eintrag zeigt (`ReasonerConfigStatus.cloudProviders[…].grund`).
// Er nennt nie einen Schlüssel, nie einen Schlüsselausschnitt.
const OPENAI_MODEL_ENV = "OPENAI_MODEL";
const ANTHROPIC_MODEL_ENV = "ANTHROPIC_MODEL";

// Das Ergebnis EINES Anbieter-Aufbaus: entweder der rohe Client oder der Grund, warum keiner entstand.
interface AnbieterAufbau {
  client?: ModelClient;
  grund?: string;
}

// MODUL-INTERN, absichtlich nicht exportiert: nach außen geht ausschließlich der gecappte Client
// aus `createCappedCloudClientFromEnv` unten. Wer den rohen Client bekäme, bekäme den Schlüssel und
// könnte den Vertraulichkeits-Wächter weglassen.
function openAiCloudClientFromEnv(env: Record<string, string | undefined>): AnbieterAufbau {
  const apiKey = env[OPENAI_API_KEY_ENV]?.trim();
  if (!apiKey) {
    return { grund: `${OPENAI_API_KEY_ENV} fehlt.` };
  }
  const eigenes = env[OPENAI_MODEL_ENV]?.trim();
  const gemeinsam = env[REASONER_MODEL_ENV]?.trim();
  const model = eigenes || gemeinsam;
  if (!model) {
    return {
      grund: `Kein OpenAI-Modell: ${OPENAI_MODEL_ENV} (oder ${REASONER_MODEL_ENV}) setzen, z. B. gpt-4o-mini.`,
    };
  }
  if (istAnthropicModell(model)) {
    const quelle = eigenes ? OPENAI_MODEL_ENV : REASONER_MODEL_ENV;
    // JOB 3122 RUNDE 2 (bens Korrekturpflicht 3): die Zeile sagte „Es arbeitet der Anthropic-Weg." —
    // eine Zusage, die diese Funktion gar nicht geben kann. Ob dort ein Schlüssel liegt, entscheidet
    // erst `createModelClientFromEnv` (Env ODER Schlüsselbund); ohne ihn liefert die Fabrik
    // `undefined`, und es arbeitet NIEMAND, sondern der deterministische Ersatzmodus. Der Satz ist
    // deshalb an seine Voraussetzung gebunden — die schwächere Aussage statt der starken.
    // JOB 3134: seit der Anbieterwahl ist Claude nicht mehr die automatische Folge, sondern wählbar.
    process.stderr.write(
      `[KLARWERK] ${OPENAI_API_KEY_ENV} ist gesetzt, aber ${quelle}=${model} benennt ein Anthropic-Modell — der OpenAI-Weg bleibt ungenutzt (er würde bei jedem Lauf mit 400 antworten). ChatGPT (OpenAI) ist damit nicht eingerichtet; Claude (Anthropic) ist wählbar, SOFERN dort ein Schlüssel vorliegt; sonst bleibt der Cloud-Zugang inaktiv und es arbeitet der deterministische Ersatzmodus. Für ChatGPT gehört ein OpenAI-Modell in ${OPENAI_MODEL_ENV} oder ${REASONER_MODEL_ENV} (z. B. gpt-4o-mini).\n`,
    );
    return {
      grund: `${quelle}=${model} benennt ein Anthropic-Modell — ${OPENAI_MODEL_ENV} setzen (z. B. gpt-4o-mini).`,
    };
  }
  const timeoutMs = parseTimeoutMs(env.REASONER_TIMEOUT_MS);
  return {
    client: openAiCompatibleClient({
      baseUrl: env[OPENAI_BASE_URL_ENV]?.trim() || OPENAI_DEFAULT_BASE_URL,
      model,
      apiKey,
      name: `${OPENAI_CLIENT_NAME_PREFIX}:${model}`,
      bezeichnung: OPENAI_BEZEICHNUNG,
      // JOB 3100: DIE EINE STELLE, an der der Bildweg freigeschaltet wird. Pedis Entscheidung 6 gilt
      // auch für Bilder: ist ChatGPT der Cloud-Anbieter, beschreibt ChatGPT auch das Bild — statt dass
      // der Bildauftrag scheitert und die Reasoner-Kette auf einen Anbieter ausweicht, der laut
      // derselben Entscheidung gar nicht mehr benutzt werden soll.
      bildEingang: true,
      // JOB 3222: DIE EINE STELLE, an der die Konfigurationsart „cloud:openai" ihren eigenen
      // Budgetparameter setzt. Live belegt (Codex a4e82a81): mit `max_tokens` antwortete
      // `gpt-6-astra` auf JEDEN Aufruf mit 400 — auch auf den Ein-Wort-Ping des Admin-Tests.
      // Ausdrücklich KEIN `maxTokensFloor` daneben: `max_completion_tokens` deckelt bei OpenAI
      // Reasoning UND sichtbare Ausgabe, eine Untergrenze wäre also eine stillschweigende
      // Kostenerhöhung bei einem Anbieter, der pro Token abrechnet — und es liegt kein gemessener
      // Bedarf dafür vor. Verbraucht ein Modell sein Budget im Denken, meldet `requireChatContent`
      // das bei belegter Denkphase als „reasoning-only“, statt den leeren Inhalt zu verstecken.
      budgetFeld: "max_completion_tokens",
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    }),
  };
}

// Der Anthropic-Weg mit Grund: `createModelClientFromEnv` (oben) bleibt der Bestandsaufbau, diese
// Hülle benennt nur, WARUM er leer ausgeht. Der Schlüssel kann aus der Env ODER dem Schlüsselbund
// kommen — deshalb nennt der Grund beide Orte und keinen Wert.
function anthropicCloudClientFromEnv(
  env: Record<string, string | undefined>,
  keychainLookup: CloudKeyLookup,
  keychainStore: CloudKeyStore,
): AnbieterAufbau {
  const client = createModelClientFromEnv(env, keychainLookup, keychainStore);
  return client
    ? { client }
    : { grund: `${CLOUD_API_KEY_ENV} fehlt (weder ENV noch Schlüsselbund).` };
}

// Das Modell des Anthropic-Wegs: `ANTHROPIC_MODEL`, sonst der gemeinsame `REASONER_MODEL` — aber nur,
// wenn er ein Anthropic-Bezeichner IST (spiegelbildlich zur Sperre am OpenAI-Weg) —, sonst der
// Vorgabewert. Ein `REASONER_MODEL=gpt-4o-mini` erreicht Claude damit nie.
function anthropicModellAusEnv(env: Record<string, string | undefined>): string {
  const eigenes = env[ANTHROPIC_MODEL_ENV]?.trim();
  if (eigenes) {
    return eigenes;
  }
  const gemeinsam = env[REASONER_MODEL_ENV]?.trim();
  return gemeinsam && istAnthropicModell(gemeinsam) ? gemeinsam : ANTHROPIC_DEFAULT_MODEL;
}

/**
 * JOB 3134: BEIDE gecappten Cloud-Clients, getrennt — plus je Anbieter der Grund, wenn er nicht
 * entstand. Das ist die Rückgabe von `createCappedCloudClientFromEnv`.
 */
export interface CappedCloudClients {
  openai: ModelClient | undefined;
  anthropic: ModelClient | undefined;
  /** Nur für NICHT eingerichtete Anbieter gesetzt: der geheimnisfreie Grund mit Env-Namen. */
  gruende: Partial<Record<ReasonerCloudAnbieter, string>>;
}

// SCRUM-502 R8 (Encapsulation + Credential-Gating): der EINZIGE Weg, von außerhalb dieses Moduls an
// einen Cloud-Modell-Client zu kommen. Der ROHE Client (anthropicClient) und der Credential-Zugriff
// (resolveCloudApiKey/Keychain) bleiben modul-intern und werden NICHT re-exportiert; nach außen werden
// ausschließlich GECAPPTE Cloud-Clients gereicht — mit zwingendem Egress-Wächter
// (rejectsConfidential=true) und dem globalen In-Flight-Cap. Ein Aufrufer kann so weder den Schlüssel
// erlangen noch den Vertraulichkeits-Guard weglassen. Die Keychain-Injektionen bleiben für den
// Desktop-/Skip-Keychain-Pfad durchreichbar.
//
// JOB 3134 — DIE VORZUGSREGEL IST WEG. Bis hierher galt (JOB 3090): „sind OPENAI_API_KEY und
// REASONER_MODEL gesetzt, arbeitet ChatGPT; sonst Anthropic" — der Anthropic-Zweig wurde bei
// gesetzter OpenAI-Konfiguration gar nicht betreten, und die Fläche konnte Claude nie WÄHLEN, nur
// bekommen. Jetzt entstehen BEIDE Clients unabhängig voneinander; WELCHER arbeitet, entscheidet die
// gespeicherte Wahl im Reasoner (`services/reasoner/src/service.ts`, `providerChain`), nicht diese
// Fabrik. Pedis Entscheidung 42 (06.09.): „Wir können auch gerne beide hinterlegen. Ich werde dann
// auswählen, welche ich benutzen möchte."
//
// DER NAME DER FUNKTION BLEIBT (Singular), obwohl sie beide Clients liefert: `services/reasoner/
// index.ts` reicht genau dieses Symbol nach aussen, und diese Datei liegt ausserhalb der Zielpfade
// von JOB 3134 (in der Rückgabe unter ABWEICHUNGEN benannt). Die Rückgabeform sagt, was sie ist.
//
// EIN Ort, an dem für die Cloud `rejectsConfidential: true` gesetzt wird — für BEIDE Anbieter. Für
// OpenAI ist die Marke hart und nicht origin-abhängig wie beim lokalen Weg unten: OpenAI ist per
// Definition extern, auch hinter einem Azure-/Proxy-Endpunkt. Eine Env, die das lockert, gibt es
// nicht und darf es nicht geben.
export function createCappedCloudClientFromEnv(
  env: Record<string, string | undefined> = process.env,
  keychainLookup: CloudKeyLookup = findCloudKeyInKeychain,
  keychainStore: CloudKeyStore = storeCloudKeyInKeychain,
): CappedCloudClients {
  const openai = openAiCloudClientFromEnv(env);
  const anthropic = anthropicCloudClientFromEnv(env, keychainLookup, keychainStore);
  const gruende: CappedCloudClients["gruende"] = {};
  if (openai.grund) {
    gruende.openai = openai.grund;
  }
  if (anthropic.grund) {
    gruende.anthropic = anthropic.grund;
  }
  // DIE EINE Egress-Regel, für beide Anbieter — `tests/openai-cloud-anbieter` (F12) zählt sie.
  const gecappt = (client: ModelClient | undefined): ModelClient | undefined =>
    client ? cappedModelClient(client, { rejectsConfidential: true }) : undefined;
  return { openai: gecappt(openai.client), anthropic: gecappt(anthropic.client), gruende };
}

// D-AISTATE PAKET 1 (bens V1, aistate-fix3): „lokal" ist TECHNISCH begrenzt, nicht nur eine
// ENV-Konvention. Als On-Prem bestätigt gilt eine KLARWERK_LOCAL_LLM_URL nur, wenn ihr Ziel
//  (a) eine Loopback-Adresse ist (localhost, 127.0.0.0/8, ::1) ODER
//  (b) ihre Origin EXPLIZIT über KLARWERK_LOCAL_LLM_ALLOWED_ORIGINS (kommagetrennte Origins,
//      z. B. "http://10.0.0.5:8000") als private On-Prem-Origin freigegeben wurde.
// Alles andere (z. B. https://fremder-host.example/v1) wird wie ein externer Endpunkt behandelt:
// der Wrapper unten bekommt rejectsConfidential=true — vertraulicher Paartext wird VOR jedem Fetch
// am zentralen Wächter (cappedModelClient) abgelehnt. Nicht parsebare URLs gelten fail-safe als
// NICHT lokal.
export function isConfirmedLocalOrigin(baseUrl: string, allowedOrigins?: string): boolean {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  const loopback =
    host === "localhost" ||
    host === "::1" ||
    host === "[::1]" ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
  if (loopback) {
    return true;
  }
  return (allowedOrigins ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .some((entry) => {
      try {
        return new URL(entry).origin === url.origin;
      } catch {
        return false;
      }
    });
}

// SCRUM-502 R8: analog für den eigenen lokalen LLM (on-prem, kein externer Egress). Gecappt (globaler
// In-Flight-Cap). D-AISTATE PAKET 1 (bens V1, aistate-fix3): rejectsConfidential ist NICHT mehr blind
// false — nur eine als On-Prem BESTÄTIGTE Origin (Loopback bzw. explizit freigegeben, s.
// isConfirmedLocalOrigin) darf vertrauliche Inhalte bedienen. Ein fremd verdrahteter „lokaler"
// Endpunkt wird am zentralen Wächter fail-safe abgelehnt (kein Egress vertraulichen Paartexts).
export function createCappedLocalClientFromEnv(
  env: Record<string, string | undefined> = process.env,
): ModelClient | undefined {
  const raw = createLocalClientFromEnv(env);
  if (!raw) {
    return undefined;
  }
  const confirmedLocal = isConfirmedLocalOrigin(
    env.KLARWERK_LOCAL_LLM_URL ?? "",
    env.KLARWERK_LOCAL_LLM_ALLOWED_ORIGINS,
  );
  return cappedModelClient(raw, { rejectsConfidential: !confirmedLocal });
}

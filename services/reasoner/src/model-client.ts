import { execFileSync } from "node:child_process";
import { cappedModelClient, meldeModellVerbrauch } from "./model-concurrency";
// WP-D10 (Fix 3): typisierte Fehlerklassen (Timeout vs. HTTP-Status) — Meldungstexte unverändert.
// AUFTRAG-mega18 Block E (SCRUM-544): ModelEmptyResponseError = Antwort ohne Antwortinhalt.
import { ModelEmptyResponseError, ModelHttpError, ModelTimeoutError } from "./model-errors";
import type { ModelClient } from "./provider-model";

export const CLOUD_API_KEY_ENV = "ANTHROPIC_API_KEY";
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
const OPENAI_BEZEICHNUNG = "ChatGPT (OpenAI)";
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
    model: env.REASONER_MODEL ?? "claude-sonnet-4-6",
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
}

// AUFTRAG-mega18 Block E (SCRUM-544): Antwortform von /chat/completions, so weit sie hier gelesen wird.
// `finish_reason` wurde bisher gar nicht ausgewertet — genau deshalb war eine am Token-Limit
// abgeschnittene Antwort von einer echten Antwort nicht unterscheidbar. `reasoning` /
// `reasoning_content` / `thinking` sind die verbreiteten Felder, in die DENKMODELLE (qwen3,
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

// AUFTRAG-mega18 Block E (SCRUM-544): der EINE Ort, an dem aus der Antwort ein Ergebnis wird.
// Vorher: `content ?? ""` — fehlender/leerer Inhalt kam als LEERER STRING nach oben und galt still als
// Ergebnis (kein Fehler, kein unterscheidbarer Zustand). Jetzt: nur echter Inhalt ist ein Ergebnis,
// alles andere wirft einen typisierten, unterscheidbaren Fehler. NICHT-leerer Inhalt geht unverändert
// durch — auch wenn finish_reason "length" ist (die extract-Rettung, salvageTruncatedExtract, lebt
// bewusst von abgeschnittenem, aber vorhandenem JSON).
// JOB 3090: `bezeichnung` benennt den Anbieter, der nichts geliefert hat. Vorgabe „Lokaler LLM"
// (Bestandswortlaut); für ChatGPT steht dort „ChatGPT (OpenAI)". Der maschinenlesbare Teil
// (`reason`, `finishReason`, `maxTokens`) ist davon unberührt.
function requireChatContent(data: unknown, maxTokens: number, bezeichnung: string): string {
  const choice = (data as { choices?: OpenAiChatChoice[] } | null | undefined)?.choices?.[0];
  const message = choice?.message;
  const content = typeof message?.content === "string" ? message.content : "";
  if (content.trim().length > 0) {
    return content;
  }
  const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : undefined;
  const sawReasoning = [message?.reasoning, message?.reasoning_content, message?.thinking].some(
    (field) => typeof field === "string" && field.trim().length > 0,
  );
  // PII-frei: die Meldung trägt nur Metadaten (Budget, finish_reason) — nie Antwort- oder Denktext.
  const detail = `max_tokens=${maxTokens}, finish_reason=${finishReason ?? "-"}`;
  if (sawReasoning) {
    throw new ModelEmptyResponseError(
      `${bezeichnung} lieferte nur eine Denkphase (reasoning) ohne Antwortinhalt (${detail}).`,
      { reason: "reasoning-only", finishReason, sawReasoning: true, maxTokens },
    );
  }
  if (finishReason === "length") {
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

export function openAiCompatibleClient(config: ChatCompletionsModelConfig): ModelClient {
  const fetchFn = config.fetchFn ?? fetch;
  const base = config.baseUrl.replace(/\/+$/, "");
  const timeoutMs = config.timeoutMs ?? DEFAULT_MODEL_TIMEOUT_MS;
  const bezeichnung = config.bezeichnung ?? "Lokaler LLM";
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
          max_tokens: budget,
          messages,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new ModelHttpError(`${bezeichnung} antwortete mit ${res.status}`, res.status);
      }
      const data = await res.json();
      // JOB 3074: NUR MELDEN, WAS DER SERVER WIRKLICH NENNT. Ein lokaler LLM-Server MUSS keinen
      // `usage`-Block liefern; tut er es nicht, steht im Protokoll nichts. Eine Schätzung aus der
      // Textlänge wäre bequem und wäre eine erfundene Zahl. Gemeldet wird VOR
      // `requireChatContent`: eine Antwort ohne Antwortinhalt hat trotzdem Token verbraucht, und
      // genau dieser Fall (Denkphase ohne Ergebnis) ist der teure.
      const usage = (
        data as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } | null } | null
      )?.usage;
      meldeModellVerbrauch(usage?.prompt_tokens, usage?.completion_tokens);
      // AUFTRAG-mega18 Block E (SCRUM-544): kein stilles "" mehr — fehlender/leerer Antwortinhalt
      // wirft einen unterscheidbaren Fehler (reasoning-only / truncated / empty). Das gilt seit
      // JOB 3100 auch für den Bildweg: eine leere Bild-Antwort ist ein Fehler, kein Leerstring.
      return requireChatContent(data, budget, bezeichnung);
    } catch (err) {
      if (timedOut) {
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
// MODUL-INTERN, absichtlich nicht exportiert: nach außen geht ausschließlich der gecappte Client
// aus `createCappedCloudClientFromEnv` unten. Wer den rohen Client bekäme, bekäme den Schlüssel und
// könnte den Vertraulichkeits-Wächter weglassen.
function openAiCloudClientFromEnv(
  env: Record<string, string | undefined>,
): ModelClient | undefined {
  const apiKey = env[OPENAI_API_KEY_ENV]?.trim();
  const model = env.REASONER_MODEL?.trim();
  if (!apiKey || !model) {
    return undefined;
  }
  const timeoutMs = parseTimeoutMs(env.REASONER_TIMEOUT_MS);
  return openAiCompatibleClient({
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
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });
}

// SCRUM-502 R8 (Encapsulation + Credential-Gating): der EINZIGE Weg, von außerhalb dieses Moduls an
// einen Cloud-Modell-Client zu kommen. Der ROHE Client (anthropicClient) und der Credential-Zugriff
// (resolveCloudApiKey/Keychain) bleiben modul-intern und werden NICHT re-exportiert; nach außen wird
// ausschließlich der GECAPPTE Cloud-Client gereicht — mit zwingendem Egress-Wächter
// (rejectsConfidential=true) und dem globalen In-Flight-Cap. Ein Aufrufer kann so weder den Schlüssel
// erlangen noch den Vertraulichkeits-Guard weglassen. Ohne Schlüssel → undefined (deterministischer
// Betrieb). Die Keychain-Injektionen bleiben für den Desktop-/Skip-Keychain-Pfad durchreichbar.
//
// JOB 3090 — DIE ANBIETERWAHL, in einem Satz: SIND OPENAI_API_KEY UND REASONER_MODEL GESETZT,
// ARBEITET CHATGPT (OPENAI); SONST — UND NUR DANN — DER ANTHROPIC-WEG WIE BISHER. Berechenbar, nicht
// „was zuerst gefunden wird": bei ZWEI gesetzten Schlüsseln gewinnt immer OpenAI, weil das die
// ausdrücklich neu getroffene Wahl ist (Pedis Entscheidung 24) und Anthropic laut derselben
// Entscheidung die ALTERNATIVE bleibt. Ist keiner der beiden Wege konfiguriert, bleibt der
// Cloud-Zugang inaktiv (undefined) und der deterministische Ersatzmodus greift unverändert.
//
// Der Anthropic-Zweig wird bei gesetzter OpenAI-Konfiguration GAR NICHT betreten (`??` wertet rechts
// nur bei `undefined` aus): kein Keychain-Zugriff, keine Fehlzeile auf stderr über einen Schlüssel,
// den niemand mehr sucht.
//
// EIN Ort, an dem für die Cloud `rejectsConfidential: true` gesetzt wird — für BEIDE Anbieter. Für
// OpenAI ist die Marke hart und nicht origin-abhängig wie beim lokalen Weg unten: OpenAI ist per
// Definition extern, auch hinter einem Azure-/Proxy-Endpunkt. Eine Env, die das lockert, gibt es
// nicht und darf es nicht geben.
export function createCappedCloudClientFromEnv(
  env: Record<string, string | undefined> = process.env,
  keychainLookup: CloudKeyLookup = findCloudKeyInKeychain,
  keychainStore: CloudKeyStore = storeCloudKeyInKeychain,
): ModelClient | undefined {
  const raw =
    openAiCloudClientFromEnv(env) ?? createModelClientFromEnv(env, keychainLookup, keychainStore);
  return raw ? cappedModelClient(raw, { rejectsConfidential: true }) : undefined;
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

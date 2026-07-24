import { execFileSync } from "node:child_process";
import { cappedModelClient } from "./model-concurrency";
// WP-D10 (Fix 3): typisierte Fehlerklassen (Timeout vs. HTTP-Status) — Meldungstexte unverändert.
import { ModelHttpError, ModelTimeoutError } from "./model-errors";
import type { ModelClient } from "./provider-model";

export const CLOUD_API_KEY_ENV = "ANTHROPIC_API_KEY";
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
      const data = (await res.json()) as { content?: { text?: string }[] };
      return data.content?.[0]?.text ?? "";
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
        throw new Error("Bild-Daten sind keine gültige data:image-URL (png/jpeg/gif/webp).");
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

// SCRUM-424 (Pedi 03.07.): generischer OpenAI-kompatibler Client für den EIGENEN lokalen
// LLM-Server. Deckt vLLM (z. B. Qwen3-32B-AWQ), Ollama, llama.cpp-Server, LM Studio u. a. ab —
// sie alle sprechen /v1/chat/completions. Der Server ist nur über den SSH-Tunnel auf localhost
// erreichbar; ein optionaler Schlüssel bleibt (wie beim Cloud-Client) serverseitig und verlässt
// den Prozess nie. `fetchFn` injizierbar → in Tests ohne Netz prüfbar.
export interface LocalHttpModelConfig {
  baseUrl: string; // z. B. http://127.0.0.1:8000/v1
  model: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export function openAiCompatibleClient(config: LocalHttpModelConfig): ModelClient {
  const fetchFn = config.fetchFn ?? fetch;
  const base = config.baseUrl.replace(/\/+$/, "");
  const timeoutMs = config.timeoutMs ?? DEFAULT_MODEL_TIMEOUT_MS;
  // WP-BILD-1c: BEWUSST kein completeVision — ob ein lokaler LLM Bilder kann, ist nicht garantiert;
  // der Reasoner behandelt fehlenden Bild-Eingang ehrlich als Fehlschlag (nie erfinden).
  return {
    name: `local:${config.model}`,
    // SCRUM-502 Schicht 2: `confidential` ist Interface-Pflicht; der Egress-Wächter sitzt im
    // Cloud-Wrapper (cappedModelClient), der rohe Client selbst reicht den Aufruf nur durch.
    async complete(
      system: string,
      user: string,
      _confidential: boolean,
      maxTokens = 1024,
    ): Promise<string> {
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      try {
        const res = await fetchFn(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: maxTokens,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new ModelHttpError(`Lokaler LLM antwortete mit ${res.status}`, res.status);
        }
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        return data.choices?.[0]?.message?.content ?? "";
      } catch (err) {
        if (timedOut) {
          throw new ModelTimeoutError(
            `Lokaler LLM überschritt das Zeitlimit von ${timeoutMs} ms`,
            timeoutMs,
          );
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    },
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
  return openAiCompatibleClient({
    baseUrl,
    model,
    ...(env.KLARWERK_LOCAL_LLM_KEY ? { apiKey: env.KLARWERK_LOCAL_LLM_KEY } : {}),
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
export function createCappedCloudClientFromEnv(
  env: Record<string, string | undefined> = process.env,
  keychainLookup: CloudKeyLookup = findCloudKeyInKeychain,
  keychainStore: CloudKeyStore = storeCloudKeyInKeychain,
): ModelClient | undefined {
  const raw = createModelClientFromEnv(env, keychainLookup, keychainStore);
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

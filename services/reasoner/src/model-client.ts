import { execFileSync } from "node:child_process";
import type { ModelClient } from "./provider-model";

export const CLOUD_API_KEY_ENV = "ANTHROPIC_API_KEY";
export const CLOUD_API_KEYCHAIN_SERVICE = "Klarwerk";
export const CLOUD_API_KEYCHAIN_ACCOUNT = CLOUD_API_KEY_ENV;
export const LEGACY_CLOUD_API_KEYCHAIN_SERVICE = "KLARWERK-App-Anthropic";
export const LEGACY_CLOUD_API_KEYCHAIN_ACCOUNT = "team1";

// Anbieterspezifischer HTTP-Client (Anthropic Messages API). Der Schlüssel bleibt
// ausschließlich hier (serverseitig) und verlässt den Prozess nie (FR-RSN-06).
// `fetchFn` ist injizierbar → in Tests ohne Netz prüfbar.
export interface HttpModelConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export function anthropicClient(config: HttpModelConfig): ModelClient {
  const fetchFn = config.fetchFn ?? fetch;
  const baseUrl = config.baseUrl ?? "https://api.anthropic.com";
  return {
    name: `anthropic:${config.model}`,
    // SCRUM-411: maxTokens pro Aufruf — kurze Tasks bleiben bei 1024; extract braucht mehr
    // (JSON mit bis zu 20 Punkten inkl. wörtlicher Belegstellen wurde bei 1024 abgeschnitten).
    async complete(system: string, user: string, maxTokens = 1024): Promise<string> {
      const res = await fetchFn(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) {
        throw new Error(`Modell-API antwortete mit ${res.status}`);
      }
      const data = (await res.json()) as { content?: { text?: string }[] };
      return data.content?.[0]?.text ?? "";
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
  return anthropicClient({ apiKey, model: env.REASONER_MODEL ?? "claude-sonnet-4-6" });
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
}

export function openAiCompatibleClient(config: LocalHttpModelConfig): ModelClient {
  const fetchFn = config.fetchFn ?? fetch;
  const base = config.baseUrl.replace(/\/+$/, "");
  return {
    name: `local:${config.model}`,
    async complete(system: string, user: string, maxTokens = 1024): Promise<string> {
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
      });
      if (!res.ok) {
        throw new Error(`Lokaler LLM antwortete mit ${res.status}`);
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return data.choices?.[0]?.message?.content ?? "";
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
  return openAiCompatibleClient({
    baseUrl,
    model,
    ...(env.KLARWERK_LOCAL_LLM_KEY ? { apiKey: env.KLARWERK_LOCAL_LLM_KEY } : {}),
  });
}

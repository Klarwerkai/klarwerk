// ================================================================================================
// JOB 3074 · V9 Scheibe 3 — gemeinsame Attrappen der Verbrauchsfälle.
// ================================================================================================
//
// HERMETIK: kein Netz. Die Umgebungsfabriken nehmen kein injizierbares `fetchFn` entgegen
// (`model-client.ts:247-251`, `:407-413`), deshalb wird `fetch` in den Fällen global ersetzt; der
// Schlüsselbund wird nie befragt (beide Zugriffe sind ausdrücklich stillgelegt).
//
// GEMESSEN WIRD DER ECHTE WEG nach draußen: `createCappedCloudClientFromEnv` /
// `createCappedLocalClientFromEnv` liefern den GECAPPTEN Client — denselben, den das Produkt
// benutzt (`model-client.ts:416-430`, `:470-487`). Eine Probe am rohen Client wäre grün, während
// der Wrapper den Wert verliert (das war JOB 3036s Befund und gilt für den Verbrauch gleich).
import {
  createCappedCloudClientFromEnv,
  createCappedLocalClientFromEnv,
} from "../../services/reasoner/src/model-client";
import type { ModelClient } from "../../services/reasoner/src/provider-model";

export const CLOUD_ENV = {
  ANTHROPIC_API_KEY: "test-schluessel-nur-hier",
  REASONER_MODEL: "claude-sonnet-4-6",
};

export const LOCAL_ENV = {
  KLARWERK_LOCAL_LLM_URL: "http://127.0.0.1:8000/v1",
  KLARWERK_LOCAL_LLM_MODEL: "qwen3-32b-awq",
};

const KEIN_SCHLUESSELBUND = (): string | undefined => undefined;
const KEIN_SPEICHERN = (): boolean => false;

/** Eine Attrappe der `fetch`-Antwort, so weit die Clients sie lesen (ok/status/json). */
export function alsAntwort(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

/** Der Antwortkörper des Cloud-Clients: ein Textblock, optional der `usage`-Block. */
export function cloudKoerper(text: string, usage?: unknown): Record<string, unknown> {
  return { content: [{ type: "text", text }], ...(usage !== undefined ? { usage } : {}) };
}

/** Der Antwortkörper des lokalen OpenAI-kompatiblen Servers. */
export function lokalKoerper(content: string | null, usage?: unknown): Record<string, unknown> {
  return {
    choices: [{ finish_reason: "stop", message: { content } }],
    ...(usage !== undefined ? { usage } : {}),
  };
}

export function cloudClient(): ModelClient | undefined {
  return createCappedCloudClientFromEnv(CLOUD_ENV, KEIN_SCHLUESSELBUND, KEIN_SPEICHERN);
}

export function lokalerClient(): ModelClient | undefined {
  return createCappedLocalClientFromEnv(LOCAL_ENV);
}

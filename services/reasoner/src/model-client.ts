import type { ModelClient } from "./provider-model";

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
    async complete(system: string, user: string): Promise<string> {
      const res = await fetchFn(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 1024,
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

// Baut den Client aus der Umgebung. Ohne Schlüssel → undefined → deterministischer Betrieb.
export function createModelClientFromEnv(
  env: Record<string, string | undefined> = process.env,
): ModelClient | undefined {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return undefined;
  }
  return anthropicClient({ apiKey, model: env.REASONER_MODEL ?? "claude-sonnet-4-6" });
}

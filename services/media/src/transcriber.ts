import type { Transcriber } from "./types";

// Anbieter-Client für Sprache→Text. Der Schlüssel bleibt ausschließlich serverseitig
// (G-7) und wird nie geloggt oder an den Client gegeben. `fetchFn` injizierbar → testbar ohne Netz.
export interface WhisperConfig {
  apiKey: string;
  model?: string | undefined;
  baseUrl?: string | undefined;
  fetchFn?: typeof fetch | undefined;
}

export function whisperClient(config: WhisperConfig): Transcriber {
  const fetchFn = config.fetchFn ?? fetch;
  const baseUrl = config.baseUrl ?? "https://api.openai.com";
  const model = config.model ?? "whisper-1";
  return {
    name: `openai:${model}`,
    async transcribe(bytes: Buffer, mime: string, locale: "de" | "en"): Promise<string> {
      const form = new FormData();
      form.append("model", model);
      form.append("language", locale);
      form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), "media");
      const res = await fetchFn(`${baseUrl}/v1/audio/transcriptions`, {
        method: "POST",
        headers: { authorization: `Bearer ${config.apiKey}` },
        body: form,
      });
      if (!res.ok) {
        throw new Error(`Transkriptions-API antwortete mit ${res.status}`);
      }
      const data = (await res.json()) as { text?: string };
      return data.text ?? "";
    },
  };
}

// Aus der Umgebung: MEDIA_TRANSCRIBE_API_KEY (dediziert) oder OPENAI_API_KEY.
// Ohne Schlüssel → undefined → ehrlicher Inaktiv-Zustand (kein Fake-Transkript).
export function createTranscriberFromEnv(
  env: Record<string, string | undefined> = process.env,
): Transcriber | undefined {
  const apiKey = env.MEDIA_TRANSCRIBE_API_KEY ?? env.OPENAI_API_KEY;
  if (!apiKey) {
    return undefined;
  }
  return whisperClient({ apiKey, model: env.MEDIA_TRANSCRIBE_MODEL });
}

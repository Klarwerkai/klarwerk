import { type Transcriber, TranscriberConfidentialError } from "./types";

// SCRUM-502 R7: der Transkriptions-Chokepoint. NUR der Cloud-Transkriber (build-app) wird mit
// rejectsConfidential umschlossen und wirft bei confidential=true, BEVOR die Rohbytes gesendet
// werden — fail-safe by construction, analog cappedModelClient des Reasoners. Ein späterer lokaler
// (on-prem) Transkriber würde OHNE diesen Wächter umschlossen und dürfte vertrauliche Medien.
export function cappedTranscriber(
  inner: Transcriber,
  opts: { rejectsConfidential?: boolean } = {},
): Transcriber {
  return {
    name: inner.name,
    transcribe: (bytes, mime, locale, confidential) => {
      if (opts.rejectsConfidential && confidential) {
        return Promise.reject(new TranscriberConfidentialError());
      }
      return inner.transcribe(bytes, mime, locale, confidential);
    },
  };
}

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
    // SCRUM-502 R7: `confidential` ist Interface-Pflicht; der Egress-Wächter sitzt im Cloud-Wrapper
    // (cappedTranscriber). Der rohe Client reicht den Aufruf nur durch (kein externer Egress bei
    // confidential, weil der Wrapper vorher wirft).
    async transcribe(
      bytes: Buffer,
      mime: string,
      locale: "de" | "en",
      _confidential: boolean,
    ): Promise<string> {
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

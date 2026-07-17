import { describe, expect, it } from "vitest";
import { ModelProvider, Reasoner } from "../../services/reasoner";
// SCRUM-502 R8: die rohen Clients sind bewusst NICHT mehr aus dem Paket-Index exportiert
// (Encapsulation). White-box-Unit-Tests der Roh-Client-Internas greifen relativ auf das Modul zu —
// wie die paketinternen Tests (provider-model.test.ts). Von „außen" bleibt nur der gecappte Weg.
import {
  createLocalClientFromEnv,
  openAiCompatibleClient,
} from "../../services/reasoner/src/model-client";
import type { ModelClient } from "../../services/reasoner/src/provider-model";

// SCRUM-424 (Pedi 03.07., VIP-Vorbereitung): zwei KI-Backends parallel — Claude-Cloud UND
// der eigene lokale LLM (OpenAI-kompatibel, z. B. vLLM/Qwen). Standard „auto": Cloud → lokal
// → deterministisch. Beide serverseitig beim Start verdrahtet (unabhängig vom Login).
describe("SCRUM-424: zwei KI-Backends (Cloud + lokaler LLM)", () => {
  const cloud = (out: string | (() => never)): ModelClient => ({
    name: "anthropic:test",
    complete: async () => (typeof out === "function" ? out() : out),
  });
  const local = (out: string): ModelClient => ({
    name: "local:Qwen3-32B-AWQ",
    complete: async () => out,
  });
  const boom = () => {
    throw new Error("Backend 500");
  };

  it("auto: das Cloud-Modell arbeitet zuerst, wenn es verfügbar ist", async () => {
    const r = new Reasoner(
      new ModelProvider(cloud("CLOUD")),
      undefined,
      undefined,
      undefined,
      new ModelProvider(local("LOCAL")),
    );
    expect((await r.assistText("roh", "de")).text).toBe("CLOUD");
  });

  it("auto: fällt der Cloud-Aufruf aus, übernimmt automatisch der lokale LLM (nicht der Ersatzmodus)", async () => {
    const r = new Reasoner(
      new ModelProvider(cloud(boom)),
      undefined,
      undefined,
      undefined,
      new ModelProvider(local("LOCAL")),
    );
    const res = await r.assistText("roh", "de");
    expect(res.text).toBe("LOCAL");
    expect(res.demo).toBe(false); // echtes Modell, kein deterministischer Ersatz
  });

  it("fallen BEIDE Modelle aus, bleibt der deterministische Ersatzmodus (nie ein Absturz)", async () => {
    const r = new Reasoner(
      new ModelProvider(cloud(boom)),
      undefined,
      undefined,
      undefined,
      new ModelProvider({ name: "local:x", complete: async () => boom() }),
    );
    const res = await r.assistText("nur roher Text", "de");
    expect(res.demo).toBe(true); // deterministischer Ersatz hat geantwortet
  });

  it("je Aufgabe 'local' wählbar: dann arbeitet der lokale LLM, obwohl Cloud verfügbar wäre", async () => {
    const r = new Reasoner(
      new ModelProvider(cloud("CLOUD")),
      undefined,
      undefined,
      undefined,
      new ModelProvider(local("LOCAL")),
    );
    await r.setTaskConfig({ global: "auto", perTask: { assist: "local" } });
    expect((await r.assistText("roh", "de")).text).toBe("LOCAL");
    expect(r.configStatus().effectiveProvider.assist).toBe("local");
  });

  it("configStatus weist den lokalen LLM ehrlich aus + welche KI je Aufgabe zuerst arbeitet", () => {
    const r = new Reasoner(
      new ModelProvider(cloud("CLOUD")),
      undefined,
      undefined,
      undefined,
      new ModelProvider(local("LOCAL")),
    );
    const cfg = r.configStatus();
    expect(cfg.cloudConfigured).toBe(true);
    expect(cfg.localConfigured).toBe(true);
    expect(cfg.localProvider).toBe("local:Qwen3-32B-AWQ");
    expect(cfg.effectiveProvider.structure).toBe("cloud"); // auto → Cloud zuerst
    // Ohne verdrahteten lokalen LLM bleibt localConfigured false.
    const cloudOnly = new Reasoner(new ModelProvider(cloud("C"))).configStatus();
    expect(cloudOnly.cloudConfigured).toBe(true);
    expect(cloudOnly.localConfigured).toBe(false);
  });

  it("ungültige Zuordnung 'local' bei Bedarf bleibt gültig; Unsinn wird weiterhin abgewiesen", async () => {
    const r = new Reasoner(new ModelProvider(cloud("C")));
    await expect(r.setTaskConfig({ global: "local", perTask: {} })).resolves.toBeDefined();
    await expect(r.setTaskConfig({ global: "quantum" as never, perTask: {} })).rejects.toThrow();
  });
});

describe("SCRUM-424: OpenAI-kompatibler lokaler Client", () => {
  it("ruft /chat/completions, reicht maxTokens durch und liest choices[0].message.content", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const fetchFn = (async (url: unknown, init?: { body?: unknown; headers?: unknown }) => {
      calls.push({
        url: String(url),
        body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
      });
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "OK-LOKAL" } }] }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const client = openAiCompatibleClient({
      baseUrl: "http://127.0.0.1:8000/v1/",
      model: "Qwen3-32B-AWQ",
      apiKey: "tunnel-key",
      fetchFn,
    });
    expect(client.name).toBe("local:Qwen3-32B-AWQ");
    const out = await client.complete("sys", "user", false, 4096);
    expect(out).toBe("OK-LOKAL");
    expect(calls[0]?.url).toBe("http://127.0.0.1:8000/v1/chat/completions");
    expect(calls[0]?.body.max_tokens).toBe(4096);
    expect(calls[0]?.body.model).toBe("Qwen3-32B-AWQ");
  });

  it("meldet Fehlerstatus ehrlich (kein stilles Schlucken)", async () => {
    const fetchFn = (async () =>
      ({ ok: false, status: 502 }) as unknown as Response) as unknown as typeof fetch;
    const client = openAiCompatibleClient({ baseUrl: "http://x/v1", model: "m", fetchFn });
    await expect(client.complete("s", "u", false)).rejects.toThrow("502");
  });

  it("createLocalClientFromEnv: ohne URL/Modell → undefined; mit beiden → Client", () => {
    expect(createLocalClientFromEnv({})).toBeUndefined();
    expect(createLocalClientFromEnv({ KLARWERK_LOCAL_LLM_URL: "http://x/v1" })).toBeUndefined();
    const c = createLocalClientFromEnv({
      KLARWERK_LOCAL_LLM_URL: "http://127.0.0.1:8000/v1",
      KLARWERK_LOCAL_LLM_MODEL: "Qwen3-32B-AWQ",
    });
    expect(c?.name).toBe("local:Qwen3-32B-AWQ");
  });
});

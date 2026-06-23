import { describe, expect, it, vi } from "vitest";
import { anthropicClient, createModelClientFromEnv } from "./model-client";
import { type ModelClient, ModelProvider } from "./provider-model";
import type { KnowledgeRef } from "./types";

const KOS: KnowledgeRef[] = [
  {
    id: "ko1",
    title: "Ventil bei Überdruck schließen",
    statement: "Bei Überdruck Ventil X schließen.",
    status: "validiert",
    trust: 90,
  },
];

function fakeClient(reply: string): ModelClient {
  return { name: "fake", complete: async () => reply };
}

describe("ModelProvider", () => {
  it("isAvailable spiegelt den vorhandenen Client", () => {
    expect(new ModelProvider().isAvailable()).toBe(false);
    expect(new ModelProvider(fakeClient("{}")).isAvailable()).toBe(true);
  });

  it("structure parst das Modell-JSON (demo=false)", async () => {
    const client = fakeClient(
      'Vorwort {"title":"T","statement":"S","conditions":["c"],"measures":[],"tags":["t"],"confidence":0.8} Nachwort',
    );
    const res = await new ModelProvider(client).structure("Rohtext.");
    expect(res.title).toBe("T");
    expect(res.conditions).toEqual(["c"]);
    expect(res.tags).toEqual(["t"]);
    expect(res.confidence).toBe(0.8);
    expect(res.demo).toBe(false);
  });

  it("answer bleibt in den Quellen verankert; Trust/Quellen aus den Daten", async () => {
    const res = await new ModelProvider(fakeClient("Antwort des Modells.")).answer(
      "Überdruck Ventil",
      KOS,
    );
    expect(res.answered).toBe(true);
    expect(res.answer).toBe("Antwort des Modells.");
    expect(res.knowledgeClass).toBe("gesichert");
    expect(res.trust).toBe(90);
    expect(res.sources).toContain("ko1");
    expect(res.demo).toBe(false);
  });

  it("FR-RSN-03: ohne passende Quelle keine Modellanfrage, keine Rateantwort", async () => {
    const complete = vi.fn(async () => "darf nicht aufgerufen werden");
    const res = await new ModelProvider({ name: "fake", complete }).answer(
      "Wie hoch ist der Aktienkurs?",
      KOS,
    );
    expect(res.answered).toBe(false);
    expect(complete).not.toHaveBeenCalled();
  });
});

describe("model-client", () => {
  it("createModelClientFromEnv: ohne Schlüssel undefined, mit Schlüssel definiert", () => {
    expect(createModelClientFromEnv({})).toBeUndefined();
    expect(createModelClientFromEnv({ ANTHROPIC_API_KEY: "k" })).toBeDefined();
  });

  it("anthropicClient ruft die API über injizierten fetch und liest den Text", async () => {
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify({ content: [{ text: "Hallo" }] }), { status: 200 }),
    );
    const client = anthropicClient({
      apiKey: "k",
      model: "m",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(await client.complete("sys", "user")).toBe("Hallo");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("anthropicClient wirft bei Fehlerstatus", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 500 }));
    const client = anthropicClient({
      apiKey: "k",
      model: "m",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await expect(client.complete("s", "u")).rejects.toThrow();
  });
});

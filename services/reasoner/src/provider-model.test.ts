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

// SCRUM-88 / FR-I18N-01: System-/User-Prompts folgen der locale.
describe("ModelProvider locale-aware prompts", () => {
  function capturingClient(): { client: ModelClient; calls: { system: string; user: string }[] } {
    const calls: { system: string; user: string }[] = [];
    const client: ModelClient = {
      name: "capture",
      complete: async (system, user) => {
        calls.push({ system, user });
        return "Modellausgabe";
      },
    };
    return { client, calls };
  }

  it("answer: englische System-/User-Prompts bei locale 'en'", async () => {
    const { client, calls } = capturingClient();
    await new ModelProvider(client).answer("Überdruck Ventil", KOS, "en");
    expect(calls[0]?.system).toContain("Answer ONLY based on the numbered sources");
    expect(calls[0]?.user).toContain("Question:");
    expect(calls[0]?.user).toContain("Sources:");
  });

  it("answer: deutsche Prompts bleiben Default", async () => {
    const { client, calls } = capturingClient();
    await new ModelProvider(client).answer("Überdruck Ventil", KOS);
    expect(calls[0]?.system).toContain("nummerierten Quellen");
    expect(calls[0]?.user).toContain("Frage:");
    expect(calls[0]?.user).toContain("Quellen:");
  });

  // SCRUM-366 / AG-04: anti-halluzinatorische Quellen-Leitplanken im System-Prompt (DE + EN).
  it("answer: System-Prompt trägt die Anti-Halluzinations-Leitplanken (DE)", async () => {
    const { client, calls } = capturingClient();
    await new ModelProvider(client).answer("Überdruck Ventil", KOS);
    const system = calls[0]?.system ?? "";
    // nichts erfinden (inkl. Ursachen/Maßnahmen), kein Weltwissen, nicht überdehnen, keine Fake-Zitate,
    // bei unzureichender Basis ehrlich auf die fehlende Wissensbasis verweisen.
    expect(system).toContain("Ursachen oder Maßnahmen");
    expect(system).toContain("kein allgemeines Weltwissen");
    expect(system).toContain("Dehne keine Quelle");
    expect(system).toContain("Wissensbasis das nicht abdeckt");
    expect(system).toContain("erfinde keine Zitate");
  });

  it("answer: System-Prompt trägt die Anti-Halluzinations-Leitplanken (EN)", async () => {
    const { client, calls } = capturingClient();
    await new ModelProvider(client).answer("Überdruck Ventil", KOS, "en");
    const system = calls[0]?.system ?? "";
    expect(system).toContain("causes or measures");
    expect(system).toContain("general world knowledge");
    expect(system).toContain("stretch a source");
    expect(system).toContain("knowledge base does not cover this");
    expect(system).toContain("never fabricate quotes");
  });

  // SCRUM-366: nur die begrenzten Quellen landen im User-Prompt (kein Fremdwissen durchgereicht);
  // Top-K/selectCandidates-Verhalten bleibt intakt (irrelevante Quelle wird nicht eingebettet).
  it("answer: User-Prompt enthält nur die ausgewählten, relevanten Quellen", async () => {
    const { client, calls } = capturingClient();
    const many: KnowledgeRef[] = [
      ...KOS,
      {
        id: "ko2",
        title: "Kantine Speiseplan",
        statement: "Dienstags gibt es Suppe.",
        status: "validiert",
        trust: 80,
      },
    ];
    await new ModelProvider(client).answer("Überdruck Ventil schließen", many);
    const user = calls[0]?.user ?? "";
    expect(user).toContain("Ventil");
    // Die thematisch irrelevante Quelle wird durch selectCandidates nicht eingebettet.
    expect(user).not.toContain("Speiseplan");
  });

  it("interview: englischer System-Prompt + Labels bei locale 'en'", async () => {
    const { client, calls } = capturingClient();
    // Nur eine Antwort → noch nicht abgeschlossen → Modell wird zum Umformulieren befragt.
    const res = await new ModelProvider(client).interview(["Core message"], "en");
    expect(res.demo).toBe(false);
    // SCRUM-410: Prompt-Wortlaut überarbeitet (Sprach-Leitplanken) — Kernzusage bleibt: EINE Frage.
    expect(calls[0]?.system).toContain("exactly ONE natural next question");
    expect(calls[0]?.user).toContain("Previous answers:");
    expect(calls[0]?.user).toContain("Guiding question:");
  });

  it("structure/assist: englische System-Prompts bei locale 'en'", async () => {
    const struct = capturingClient();
    await new ModelProvider(struct.client).structure("Raw text.", "en").catch(() => undefined);
    expect(struct.calls[0]?.system).toContain("Respond ONLY with JSON");

    const assist = capturingClient();
    await new ModelProvider(assist.client).assistText("text", "en");
    expect(assist.calls[0]?.system).toContain("Improve wording without changing content");
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

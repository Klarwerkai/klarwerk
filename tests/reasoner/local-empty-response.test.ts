import { describe, expect, it, vi } from "vitest";
import { ModelProvider, Reasoner } from "../../services/reasoner";
// SCRUM-502 R8: die rohen Clients sind bewusst NICHT aus dem Paket-Index exportiert (Encapsulation) —
// White-box-Tests der Roh-Client-Internas greifen relativ auf das Modul zu (wie dual-provider.test.ts).
import {
  createLocalClientFromEnv,
  openAiCompatibleClient,
} from "../../services/reasoner/src/model-client";
import {
  ModelEmptyResponseError,
  classifyModelFailure,
} from "../../services/reasoner/src/model-errors";

// AUFTRAG-mega18 Block E (SCRUM-544): `content ?? ""` machte drei verschiedene Zustände zu EINEM
// stillen leeren String — eine leere Antwort galt als Ergebnis. Kein Netzaufruf hier: `fetch` wird
// gestubbt, der lokale LLM ist nur eine Antwortform.
type ChatPayload = Record<string, unknown>;

// Stub-fetch: liefert eine feste JSON-Antwort und protokolliert den gesendeten Body.
function stubFetch(payload: ChatPayload, bodies: ChatPayload[] = []): typeof fetch {
  return (async (_url: unknown, init?: { body?: unknown }) => {
    bodies.push(JSON.parse(String(init?.body ?? "{}")) as ChatPayload);
    return { ok: true, json: async () => payload } as unknown as Response;
  }) as unknown as typeof fetch;
}

function localClient(payload: ChatPayload, bodies: ChatPayload[] = []) {
  return openAiCompatibleClient({
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "qwen3:14b",
    fetchFn: stubFetch(payload, bodies),
  });
}

describe("SCRUM-544: leere Antwort des lokalen LLM ist nie stillschweigend ein Ergebnis", () => {
  // Weg (a) — reproduziert mit qwen3:14b: die Denkphase steckt in einem EIGENEN Feld, `content`
  // bleibt leer, das Token-Budget ist verbraucht.
  it("(a) Denkmodell: voller reasoning-Text, content leer → Fehler 'reasoning-only', der Denktext wird NIE Ergebnis", async () => {
    const denktext = "Ich überlege: zuerst prüfe ich die Grenzwerte, dann die Ausnahmen …";
    const client = localClient({
      choices: [{ finish_reason: "length", message: { content: "", reasoning: denktext } }],
    });
    const err = await client.complete("sys", "user", false).then(
      (value) => value,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ModelEmptyResponseError);
    const empty = err as ModelEmptyResponseError;
    // Unterscheidbar: eigener Grund + „es wurde gedacht" ist als Zustand sichtbar …
    expect(empty.reason).toBe("reasoning-only");
    expect(empty.sawReasoning).toBe(true);
    // … aber der Denk-TEXT ist kein Antwortinhalt und taucht nirgends als Ergebnis/Meldung auf.
    expect(empty.message).not.toContain(denktext);
    expect(empty.message).toMatch(/Denkphase/);
    // Und niemals das alte stille "" (Promise hat NICHT aufgelöst).
    expect(typeof err).not.toBe("string");
  });

  // Weg (a), Variante: vLLM/llama.cpp nennen das Feld `reasoning_content` (Ollama auch `thinking`).
  it("(a) reasoning_content/thinking werden ebenso als Denkphase erkannt", async () => {
    await expect(
      localClient({
        choices: [
          { finish_reason: "stop", message: { content: null, reasoning_content: "denk …" } },
        ],
      }).complete("sys", "user", false),
    ).rejects.toMatchObject({ reason: "reasoning-only" });
    await expect(
      localClient({ choices: [{ message: { content: "   ", thinking: "denk …" } }] }).complete(
        "sys",
        "user",
        false,
      ),
    ).rejects.toMatchObject({ reason: "reasoning-only" });
  });

  // Weg (b) — abgeschnitten am Token-Limit, bevor Antwortinhalt entstand: EIGENER Grund.
  it("(b) finish_reason 'length' ohne Inhalt → eigener, unterscheidbarer Grund 'truncated'", async () => {
    const client = localClient({
      choices: [{ finish_reason: "length", message: { content: "" } }],
    });
    const err = (await client
      .complete("sys", "user", false, 1024)
      .catch((e: unknown) => e)) as ModelEmptyResponseError;
    expect(err).toBeInstanceOf(ModelEmptyResponseError);
    expect(err.reason).toBe("truncated");
    expect(err.finishReason).toBe("length");
    expect(err.sawReasoning).toBe(false);
    expect(err.maxTokens).toBe(1024);
    expect(err.reason).not.toBe("reasoning-only"); // (a) und (b) bleiben getrennt
  });

  // Weg (c) — jede abweichende Antwortform, die `?? ""` in Leere verwandelte.
  it("(c) abweichende Antwortform (kein choices/message/content) → Grund 'empty' statt leerer String", async () => {
    for (const payload of [
      {},
      { choices: [] },
      { choices: [{}] },
      { choices: [{ message: {} }] },
    ]) {
      const err = (await localClient(payload)
        .complete("sys", "user", false)
        .catch((e: unknown) => e)) as ModelEmptyResponseError;
      expect(err).toBeInstanceOf(ModelEmptyResponseError);
      expect(err.reason).toBe("empty");
      expect(err.finishReason).toBeUndefined();
    }
  });

  // Gegenprobe: der normale Weg bleibt EXAKT wie vorher.
  it("normale, nicht-leere Antwort geht unverändert durch (auch abgeschnitten, aber mit Inhalt)", async () => {
    expect(
      await localClient({
        choices: [{ finish_reason: "stop", message: { content: "OK-LOKAL" } }],
      }).complete("sys", "user", false),
    ).toBe("OK-LOKAL");
    // Abgeschnittener, aber VORHANDENER Inhalt bleibt nutzbar — die extract-Rettung
    // (salvageTruncatedExtract) lebt genau davon.
    expect(
      await localClient({
        choices: [{ finish_reason: "length", message: { content: '{"points": [{"title"' } }],
      }).complete("sys", "user", false),
    ).toBe('{"points": [{"title"');
  });

  it("kein anbieterspezifisches reasoning_effort im Request (ehrliche Fehlerbehandlung statt Provider-Trick)", async () => {
    const bodies: ChatPayload[] = [];
    await localClient({ choices: [{ message: { content: "OK" } }] }, bodies).complete(
      "sys",
      "user",
      false,
    );
    expect(bodies[0]).not.toHaveProperty("reasoning_effort");
    expect(Object.keys(bodies[0] ?? {}).join(",")).not.toMatch(/reasoning/);
  });
});

describe("SCRUM-544: der leere Zustand kommt ehrlich oben an, ohne Aufrufer zu zerreißen", () => {
  // Die nutzerseitige Ableitung: „Antwort kam an, war aber unbrauchbar" → parse (→ bad-response),
  // klar getrennt von timeout/http/network/unknown.
  it("classifyModelFailure ordnet die leere Antwort als 'parse' ein (nicht 'unknown'/'network')", () => {
    for (const reason of ["reasoning-only", "truncated", "empty"] as const) {
      const err = new ModelEmptyResponseError("leer", { reason });
      expect(classifyModelFailure(err).failureClass).toBe("parse");
    }
  });

  it("Reasoner: leere lokale Antwort → deterministischer Ersatzmodus statt leerem Ergebnis (kein Absturz)", async () => {
    const reasoner = new Reasoner(
      new ModelProvider(localClient({ choices: [{ message: { content: "" } }] })),
    );
    const res = await reasoner.assistText("Pumpe bei über 80 Grad abschalten", "de");
    expect(res.demo).toBe(true); // ehrlicher Ersatz — nicht das stille ""
    expect(res.text.length).toBeGreaterThan(0);
  });

  it("Key-Test (probe) meldet die leere Antwort als NICHT ok — vorher galt sie als 'hat geantwortet'", async () => {
    const reasoner = new Reasoner(
      undefined,
      undefined,
      undefined,
      undefined,
      new ModelProvider(
        localClient({
          choices: [{ finish_reason: "length", message: { content: "", reasoning: "…" } }],
        }),
      ),
    );
    const probe = await reasoner.probeLocal();
    expect(probe.ok).toBe(false);
    expect(probe.detail).toMatch(/Denkphase/);
  });
});

describe("SCRUM-544: Token-Untergrenze für lokale Modelle (KLARWERK_LOCAL_LLM_MAX_TOKENS)", () => {
  it("hebt ein zu kleines Aufrufer-Budget an und senkt ein größeres NIE", async () => {
    const bodies: ChatPayload[] = [];
    const client = openAiCompatibleClient({
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "qwen3:14b",
      maxTokensFloor: 4096,
      fetchFn: stubFetch({ choices: [{ message: { content: "OK" } }] }, bodies),
    });
    await client.complete("sys", "user", false); // Default-Budget 1024
    await client.complete("sys", "user", false, 16384); // bewusst größeres Budget (extract)
    expect(bodies[0]?.max_tokens).toBe(4096);
    expect(bodies[1]?.max_tokens).toBe(16384);
  });

  it("createLocalClientFromEnv liest KLARWERK_LOCAL_LLM_MAX_TOKENS; Unsinn/0 bleibt ohne Wirkung", async () => {
    // KEIN Netz: der globale fetch wird gestubbt, BEVOR der Env-Client gebaut wird (der Client bindet
    // seinen fetch bei der Erzeugung). vi.unstubAllGlobals() räumt danach auf.
    const bodies: ChatPayload[] = [];
    vi.stubGlobal("fetch", stubFetch({ choices: [{ message: { content: "OK" } }] }, bodies));
    try {
      const base = {
        KLARWERK_LOCAL_LLM_URL: "http://127.0.0.1:11434/v1",
        KLARWERK_LOCAL_LLM_MODEL: "qwen3:14b",
      };
      const configured = createLocalClientFromEnv({
        ...base,
        KLARWERK_LOCAL_LLM_MAX_TOKENS: "2048",
      });
      expect(configured?.name).toBe("local:qwen3:14b");
      await configured?.complete("sys", "user", false); // Aufrufer-Default 1024 …
      expect(bodies[0]?.max_tokens).toBe(2048); // … angehoben auf die Untergrenze
      // Unsinn/0 → keine Untergrenze; das Aufrufer-Budget bleibt exakt wie bisher.
      for (const raw of ["0", "abc", "-5"]) {
        await createLocalClientFromEnv({ ...base, KLARWERK_LOCAL_LLM_MAX_TOKENS: raw })?.complete(
          "sys",
          "user",
          false,
        );
      }
      expect(bodies.slice(1).map((b) => b.max_tokens)).toEqual([1024, 1024, 1024]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

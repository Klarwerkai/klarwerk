// ================================================================================================
// JOB 3222 — DAS ANTWORTBUDGET HEISST NICHT AN JEDER GEGENSTELLE GLEICH.
// ================================================================================================
//
// DER BEFUND (Codex 0cfb9be9 / a4e82a81, Live 1.0.0-beta.1.164, Konfiguration
// `cloud:openai:gpt-6-astra`): `POST /api/reasoner/test` antwortete `ok:false, mode:model` mit
// HTTP 400 — auf einen Ein-Wort-Ping ohne Dokumente. Der bereinigte Anbietergrund (JOB 3122)
// nannte die Ursache wörtlich:
//
//     „Unsupported parameter: 'max_tokens' is not supported with this model.
//      Use 'max_completion_tokens' instead. (unsupported_parameter)"
//
// `max_completion_tokens` ist bei OpenAI die Obergrenze EINSCHLIESSLICH der Reasoning-Tokens;
// `max_tokens` ist dort veraltet. Bei einem EIGENEN lokalen OpenAI-kompatiblen Server (vLLM,
// llama.cpp, Ollama, LM Studio) ist es umgekehrt: dort ist `max_tokens` der Vertrag, der trägt.
// Es gibt also nicht EINEN richtigen Parameter, sondern einen JE KONFIGURATIONSART.
//
// ------------------------------------------------------------------------------------------------
// WAS DIESE DATEI MISST — und was ausdrücklich woanders gemessen wird
// ------------------------------------------------------------------------------------------------
// HIER: die Konfigurationsarten, die sich NICHT ändern dürfen (eigener lokaler Server, Anthropic-
// Kern) und die Mechanik des Feldes am rohen Client. Gemessen wird der ANFRAGEKÖRPER ALS
// ZEICHENKETTE, nicht als geparstes Objekt: „byteweise unverändert" ist eine Aussage über Bytes,
// und ein `toEqual` auf dem geparsten Objekt sähe eine geänderte Schlüsselreihenfolge nicht.
//
// DORT: `tests/openai-anbieterfalle/openai-budget-parameter.test.ts` fährt den ECHTEN Cloudweg
// über die Umgebungsfabrik `createCappedCloudClientFromEnv` (nach aussen gibt es keinen anderen
// Cloud-Client, SCRUM-502 R8) bis in `Reasoner.probe()` — den Weg des Admin-Mini-Tests. Die
// Aufteilung ist Absicht: kein zweiter Prüfweg für dieselbe Aussage.
//
// HERMETIK: kein Netz, kein Schlüsselbund. `fetchFn` wird injiziert; Schlüssel sind synthetisch.
import { afterEach, describe, expect, it, vi } from "vitest";
import { anthropicClient, createLocalClientFromEnv, openAiCompatibleClient } from "./model-client";
import { ModelEmptyResponseError } from "./model-errors";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Eine Attrappe, die jeden Aufruf mitschreibt und eine feste Antwort liefert. */
function fetchAttrappe(antwort: () => unknown): {
  fetchFn: typeof fetch;
  koerper: string[];
  urls: string[];
} {
  const koerper: string[] = [];
  const urls: string[] = [];
  const fetchFn = (async (url: unknown, init?: { body?: unknown }) => {
    urls.push(String(url));
    koerper.push(String(init?.body ?? ""));
    return antwort() as Response;
  }) as unknown as typeof fetch;
  return { fetchFn, koerper, urls };
}

/** Eine gültige Antwort des OpenAI-kompatiblen Vertrags. */
function chatOk(inhalt = "OK"): unknown {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content: inhalt }, finish_reason: "stop" }] }),
  };
}

/** Eine gültige Antwort des Anthropic-Messages-Vertrags. */
function messagesOk(inhalt = "OK"): unknown {
  return { ok: true, json: async () => ({ content: [{ type: "text", text: inhalt }] }) };
}

// Eine winzige, formgültige data:image-URL (der Parser prüft Form, nicht Bildinhalt).
const BILD = "data:image/png;base64,AAAA";

// ================================================================================================
// DER EIGENE LOKALE SERVER — SEIN VERTRAG BLEIBT BYTEWEISE DERSELBE.
// ================================================================================================
describe("JOB 3222 · der eigene lokale OpenAI-kompatible Server sendet weiter max_tokens", () => {
  it("L1: der Anfragekörper ist zeichengleich der bisherige", async () => {
    const { fetchFn, koerper, urls } = fetchAttrappe(chatOk);
    const client = openAiCompatibleClient({
      baseUrl: "http://127.0.0.1:8000/v1",
      model: "Qwen3-32B-AWQ",
      fetchFn,
    });
    await client.complete("sys", "nutzer", false, 4096);
    expect(urls).toEqual(["http://127.0.0.1:8000/v1/chat/completions"]);
    expect(koerper[0]).toBe(
      '{"model":"Qwen3-32B-AWQ","max_tokens":4096,"messages":[{"role":"system","content":"sys"},{"role":"user","content":"nutzer"}]}',
    );
  });

  // Gemessen wird die ECHTE Umgebungsfabrik (die den Client im Betrieb baut), nicht ein von Hand
  // gleich konfigurierter Zwilling: `fetch` wird dafür global ersetzt.
  it("L2: auch aus der Umgebungsfabrik (mit Untergrenze) bleibt es max_tokens", async () => {
    const { fetchFn, koerper } = fetchAttrappe(chatOk);
    vi.stubGlobal("fetch", fetchFn);
    const client = createLocalClientFromEnv({
      KLARWERK_LOCAL_LLM_URL: "http://127.0.0.1:8000/v1",
      KLARWERK_LOCAL_LLM_MODEL: "Qwen3-32B-AWQ",
      KLARWERK_LOCAL_LLM_MAX_TOKENS: "2048",
    });
    if (!client) {
      throw new Error("Kein lokaler Client aus der Env — die Probe misst dann gar nichts.");
    }
    expect(client.name).toBe("local:Qwen3-32B-AWQ");
    await client.complete("sys", "nutzer", false, 1024);
    // Die Untergrenze hebt das Budget an (Bestandsverhalten) — und sie steht in `max_tokens`.
    expect(koerper[0]).toBe(
      '{"model":"Qwen3-32B-AWQ","max_tokens":2048,"messages":[{"role":"system","content":"sys"},{"role":"user","content":"nutzer"}]}',
    );
  });

  it("L3: die Fehlermeldung ohne Antwortinhalt nennt das FELD, das gesendet wurde", async () => {
    const { fetchFn } = fetchAttrappe(() => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "" }, finish_reason: "length" }] }),
    }));
    const client = openAiCompatibleClient({
      baseUrl: "http://127.0.0.1:8000/v1",
      model: "Qwen3-32B-AWQ",
      fetchFn,
    });
    const fehler = await client.complete("sys", "nutzer", false, 512).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(ModelEmptyResponseError);
    expect((fehler as Error).message).toContain("max_tokens=512");
  });
});

// ================================================================================================
// DER ANTHROPIC-KERN — EINE ANDERE API, EIN ANDERER VERTRAG, UNVERÄNDERT.
// ================================================================================================
//
// `/v1/messages` kennt `max_completion_tokens` gar nicht. Dass der OpenAI-Cloudweg umgestellt wird,
// darf hier nichts anfassen — und zwar auch nicht versehentlich über einen gemeinsamen Baustein.
describe("JOB 3222 · der Anthropic-Messages-Kern bleibt byteweise unverändert", () => {
  it("A1: der Textaufruf sendet unverändert max_tokens", async () => {
    const { fetchFn, koerper, urls } = fetchAttrappe(messagesOk);
    const client = anthropicClient({
      apiKey: "ant-test-nur-hier",
      model: "claude-sonnet-4-6",
      fetchFn,
    });
    await client.complete("sys", "nutzer", false);
    expect(urls).toEqual(["https://api.anthropic.com/v1/messages"]);
    expect(koerper[0]).toBe(
      '{"model":"claude-sonnet-4-6","max_tokens":1024,"system":"sys","messages":[{"role":"user","content":"nutzer"}]}',
    );
  });

  it("A2: auch der Bildaufruf sendet unverändert max_tokens", async () => {
    const { fetchFn, koerper } = fetchAttrappe(messagesOk);
    const client = anthropicClient({
      apiKey: "ant-test-nur-hier",
      model: "claude-sonnet-4-6",
      fetchFn,
    });
    await client.completeVision?.("sys", BILD, "nutzer", false);
    expect(koerper[0]).toBe(
      '{"model":"claude-sonnet-4-6","max_tokens":1024,"system":"sys","messages":[{"role":"user","content":[{"type":"image","source":{"type":"base64","media_type":"image/png","data":"AAAA"}},{"type":"text","text":"nutzer"}]}]}',
    );
  });
});

// ================================================================================================
// DIE MECHANIK DES FELDES — EINE KONFIGURATIONSART, EIN EINDEUTIGER REQUEST.
// ================================================================================================
//
// Ausdrücklich KEINE Heuristik über Fehlermeldungstexte und KEINE Verhandlung (Auftrag §5.1/§5.2,
// Codex ab279b6f): welches Feld gilt, entscheidet die Konfiguration VOR dem Aufruf.
describe("JOB 3222 · die Konfigurationsart bestimmt das Budgetfeld", () => {
  it("B1: mit `budgetFeld: max_completion_tokens` trägt der Körper genau dieses Feld — und kein max_tokens", async () => {
    const { fetchFn, koerper } = fetchAttrappe(chatOk);
    const client = openAiCompatibleClient({
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-6-astra",
      apiKey: "sk-test-nur-hier",
      budgetFeld: "max_completion_tokens",
      fetchFn,
    });
    await client.complete("sys", "nutzer", false, 1024);
    expect(koerper[0]).toBe(
      '{"model":"gpt-6-astra","max_completion_tokens":1024,"messages":[{"role":"system","content":"sys"},{"role":"user","content":"nutzer"}]}',
    );
    // Der veraltete Name ist WEG, nicht danebengestellt (Auftrag §5.1: der alte Weg wird entfernt).
    expect(koerper[0]).not.toContain('"max_tokens"');
  });

  it("B2: der Bildweg trägt dasselbe Feld wie der Textweg", async () => {
    const { fetchFn, koerper } = fetchAttrappe(chatOk);
    const client = openAiCompatibleClient({
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-6-astra",
      apiKey: "sk-test-nur-hier",
      budgetFeld: "max_completion_tokens",
      bildEingang: true,
      fetchFn,
    });
    await client.completeVision?.("sys", BILD, "nutzer", false, 777);
    expect(koerper[0]).toContain('"max_completion_tokens":777');
    expect(koerper[0]).not.toContain('"max_tokens"');
    expect(koerper[0]).toContain('"image_url"');
  });

  it("B3: die Fehlermeldung ohne Antwortinhalt nennt auch hier das gesendete Feld", async () => {
    const { fetchFn } = fetchAttrappe(() => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "" }, finish_reason: "length" }] }),
    }));
    const client = openAiCompatibleClient({
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-6-astra",
      apiKey: "sk-test-nur-hier",
      budgetFeld: "max_completion_tokens",
      fetchFn,
    });
    const fehler = await client.complete("sys", "nutzer", false, 512).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(ModelEmptyResponseError);
    // Die Regel bleibt (abgeschnitten = ehrlicher Fehler); nur der Name des Budgets folgt dem
    // Request. „max_tokens=512" wäre hier eine Aussage über ein Feld, das gar nicht gesendet wurde.
    expect((fehler as Error).message).toContain("max_completion_tokens=512");
    expect((fehler as ModelEmptyResponseError).reason).toBe("truncated");
  });
});

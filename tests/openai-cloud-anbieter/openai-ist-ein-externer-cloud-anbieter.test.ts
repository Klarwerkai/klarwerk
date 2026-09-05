// ================================================================================================
// JOB 3090 — CHATGPT (OPENAI) IST EIN EIGENER CLOUD-ANBIETER, EHRLICH ALS EXTERN AUSGEWIESEN.
// ================================================================================================
//
// Pedis Entscheidung 24 (05.09., 19:23): „Als KI werden wir ChatGPT nehmen … neuer Token für
// KLARWERK und Klara". Vor diesem Auftrag gab es dafür keinen ehrlichen Weg: der einzige Client,
// der `/chat/completions` sprechen konnte, hieß per Konstruktion `local:${model}`
// (`model-client.ts`), und die Admin-Übersicht wies ihn in der Zeile „lokaler LLM-Server" aus. Wer
// ChatGPT so verdrahtet hätte, hätte einen Anbieter in den USA als „eigenen lokalen Server"
// angezeigt bekommen — der Egress-Riegel hätte gehalten, die AUSKUNFT nicht.
//
// GEMESSEN WIRD DER ECHTE WEG: die Umgebungsfabrik `createCappedCloudClientFromEnv` — nach außen
// gibt es keinen anderen Cloud-Client (SCRUM-502 R8). Eine Probe am rohen Client wäre grün, während
// der Wrapper (Egress-Wächter + In-Flight-Cap) fehlt oder etwas verliert.
//
// HERMETIK: kein Netz, kein echter Schlüssel. `fetch` ist global durch einen Spion ersetzt, der
// jede Anfrage mitschreibt; der Schlüsselbund ist ausdrücklich stillgelegt.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aiAccessRows, anbieterUndModell } from "../../apps/web/src/lib/aiOverview";
// SCRUM-502 R8: die Umgebungsfabriken sind bewusst nicht aus dem Paket-Index exportiert; der Zugriff
// erfolgt relativ auf das Modul — dasselbe Muster wie in `tests/ki-lauf-modell/lauf-nennt-modell.test.ts`.
import { createCappedCloudClientFromEnv } from "../../services/reasoner/src/model-client";
import {
  ConfidentialEgressError,
  type ModellAufrufSpur,
  mitModellAufrufSpur,
} from "../../services/reasoner/src/model-concurrency";

const OPENAI_ENV = {
  OPENAI_API_KEY: "test-schluessel-nur-hier",
  REASONER_MODEL: "gpt-4o-mini",
};

const ANTHROPIC_ENV = {
  ANTHROPIC_API_KEY: "test-schluessel-nur-hier",
  REASONER_MODEL: "claude-sonnet-4-6",
};

// Der Schlüsselbund wird nie befragt (der Schlüssel steht in der Env) — beide Zugriffe sind
// trotzdem ausdrücklich stillgelegt, damit der Lauf auf jedem Rechner gleich ist.
const KEIN_SCHLUESSELBUND = (): undefined => undefined;
const KEIN_SPEICHERN = (): boolean => false;

interface Anfrage {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** Ersetzt `fetch` global und schreibt jede Anfrage mit. Antwortet in der /chat/completions-Form. */
function fetchSpion(antwort: unknown = { choices: [{ message: { content: "OK" } }] }): Anfrage[] {
  const anfragen: Anfrage[] = [];
  vi.stubGlobal("fetch", (async (url: unknown, init: unknown) => {
    const opts = (init ?? {}) as { headers?: Record<string, string>; body?: string };
    anfragen.push({
      url: String(url),
      headers: opts.headers ?? {},
      body: JSON.parse(opts.body ?? "{}") as Record<string, unknown>,
    });
    return { ok: true, status: 200, json: async () => antwort } as unknown as Response;
  }) as unknown as typeof fetch);
  return anfragen;
}

function cloudClient(env: Record<string, string | undefined>) {
  return createCappedCloudClientFromEnv(env, KEIN_SCHLUESSELBUND, KEIN_SPEICHERN);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("JOB 3090 F1–F7: der Weg nach OpenAI", () => {
  it("F1: OPENAI_API_KEY + REASONER_MODEL → ein Cloud-Client, der den Anbieter nennt", () => {
    const client = cloudClient(OPENAI_ENV);
    expect(client).toBeDefined();
    // Der Name trägt „cloud" UND „openai" UND das Modell — und ist von beiden Bestandsformen
    // (`local:…`, `anthropic:…`) eindeutig unterscheidbar.
    expect(client?.name).toBe("cloud:openai:gpt-4o-mini");
    expect(client?.name.startsWith("local:")).toBe(false);
    expect(client?.name.startsWith("anthropic:")).toBe(false);
    // JOB 3036: `model` bleibt der REINE Bezeichner ohne Anbieter-Präfix (Laufprotokoll).
    expect(client?.model).toBe("gpt-4o-mini");
  });

  it("F2: complete() postet auf /chat/completions mit Bearer und dem Modell aus REASONER_MODEL", async () => {
    const anfragen = fetchSpion();
    const client = cloudClient(OPENAI_ENV);
    await client?.complete("system", "nutzer", false);
    expect(anfragen).toHaveLength(1);
    const anfrage = anfragen[0] as Anfrage;
    expect(anfrage.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(anfrage.headers.authorization).toBe("Bearer test-schluessel-nur-hier");
    expect(anfrage.body.model).toBe("gpt-4o-mini");
    expect(anfrage.body.messages).toEqual([
      { role: "system", content: "system" },
      { role: "user", content: "nutzer" },
    ]);
  });

  it("F2b: OPENAI_BASE_URL verlegt den Endpunkt (Azure/Proxy) — der Pfad bleibt /chat/completions", async () => {
    const anfragen = fetchSpion();
    const client = cloudClient({ ...OPENAI_ENV, OPENAI_BASE_URL: "https://proxy.example/v1/" });
    await client?.complete("s", "u", false);
    expect(anfragen[0]?.url).toBe("https://proxy.example/v1/chat/completions");
  });

  it("F3: vertraulicher Text wird abgelehnt, BEVOR fetch gerufen wird (null Aufrufe)", async () => {
    const anfragen = fetchSpion();
    const client = cloudClient(OPENAI_ENV);
    // Die WIRKUNG zuerst, die sichtbare Marke danach: fiele der Riegel, stünde hier die Anfrage im
    // Spion — ein Fehler NACH dem Fetch wäre bereits Egress, deshalb zählt nur die Null.
    await expect(client?.complete("system", "vertraulicher Paartext", true)).rejects.toBeInstanceOf(
      ConfidentialEgressError,
    );
    expect(anfragen).toHaveLength(0);
    // Die Egress-Politik ist am gereichten Client zusätzlich SICHTBAR — der Reasoner liest sie, um
    // die Kante bei vertraulichen Paaren VOR jedem Aufruf aus der Kette zu nehmen.
    expect(client?.rejectsConfidential).toBe(true);
  });

  it("F3b: auch hinter einem Proxy bleibt OpenAI extern — kein Weg lockert den Riegel", async () => {
    // Der lokale Weg entscheidet über `isConfirmedLocalOrigin`; eine Loopback-Adresse gälte dort als
    // on-prem. Für OpenAI gilt das ausdrücklich NICHT: die Marke hängt am Anbieter, nicht an der URL.
    const anfragen = fetchSpion();
    const client = cloudClient({ ...OPENAI_ENV, OPENAI_BASE_URL: "http://127.0.0.1:8080/v1" });
    expect(client?.rejectsConfidential).toBe(true);
    await expect(client?.complete("s", "u", true)).rejects.toBeInstanceOf(ConfidentialEgressError);
    expect(anfragen).toHaveLength(0);
  });

  it("F4: ohne OPENAI_API_KEY entsteht nichts — kein Wurf, keine Ausgabe", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    expect(cloudClient({})).toBeUndefined();
    expect(cloudClient({ REASONER_MODEL: "gpt-4o-mini" })).toBeUndefined();
    expect(stderr).not.toHaveBeenCalled();
  });

  it("F5: ein Schlüssel ohne REASONER_MODEL ist keine Konfiguration", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    expect(cloudClient({ OPENAI_API_KEY: "test-schluessel-nur-hier" })).toBeUndefined();
    expect(stderr).not.toHaveBeenCalled();
  });

  it("F6: nur ANTHROPIC_API_KEY → der Bestandsweg unverändert (/v1/messages, x-api-key)", async () => {
    const anfragen = fetchSpion({ content: [{ type: "text", text: "OK" }] });
    const client = cloudClient(ANTHROPIC_ENV);
    expect(client?.name).toBe("anthropic:claude-sonnet-4-6");
    expect(client?.rejectsConfidential).toBe(true);
    // Der Bildpfad (completeVision) gehört weiterhin zu Anthropic und ist unangetastet.
    expect(typeof client?.completeVision).toBe("function");
    await client?.complete("system", "nutzer", false);
    expect(anfragen[0]?.url).toBe("https://api.anthropic.com/v1/messages");
    expect(anfragen[0]?.headers["x-api-key"]).toBe("test-schluessel-nur-hier");
    expect(anfragen[0]?.headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("F7: beide Schlüssel gesetzt → OpenAI arbeitet, der Schlüsselbund wird nicht einmal gefragt", async () => {
    const anfragen = fetchSpion();
    let schluesselbundGefragt = 0;
    const client = createCappedCloudClientFromEnv(
      { ...ANTHROPIC_ENV, ...OPENAI_ENV, REASONER_MODEL: "gpt-4o-mini" },
      () => {
        schluesselbundGefragt += 1;
        return undefined;
      },
      KEIN_SPEICHERN,
    );
    expect(client?.name).toBe("cloud:openai:gpt-4o-mini");
    await client?.complete("s", "u", false);
    expect(anfragen[0]?.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(schluesselbundGefragt).toBe(0);
  });
});

describe("JOB 3090 F8/F9: die Admin-Übersicht nennt den Anbieter ehrlich", () => {
  it("F8: mit OpenAI-Cloud steht der Anbieter lesbar in der Cloud-Zeile", () => {
    const rows = aiAccessRows({
      configured: true,
      cloudConfigured: true,
      provider: "cloud:openai:gpt-4o-mini",
      model: "cloud:openai:gpt-4o-mini",
      mode: "model",
    });
    expect(rows[0]).toEqual({
      id: "cloud",
      state: "active",
      detail: "ChatGPT (OpenAI) · gpt-4o-mini",
    });
    // Ein Mensch erkennt den Anbieter, ohne den Modellnamen deuten zu müssen — und er liest ihn
    // NICHT in der Zeile des eigenen lokalen Servers.
    expect(rows[0]?.detail).toContain("OpenAI");
    expect(rows[2]).toEqual({ id: "local", state: "planned", detail: null });
  });

  it("F8b: Anthropic ist in derselben Zeile davon unterscheidbar", () => {
    const rows = aiAccessRows({
      configured: true,
      cloudConfigured: true,
      provider: "anthropic:claude-sonnet-4-6",
      model: "anthropic:claude-sonnet-4-6",
      mode: "model",
    });
    expect(rows[0]?.detail).toBe("Claude (Anthropic) · claude-sonnet-4-6");
    expect(rows[0]?.detail).not.toContain("OpenAI");
  });

  it("F8c: eine unbekannte Kennung wird wörtlich gezeigt, nicht geraten", () => {
    expect(anbieterUndModell("irgendwas:modell-x")).toBe("irgendwas:modell-x");
    // Auch der lokale Name bleibt, was er ist — diese Ableitung gilt der Cloud-Zeile.
    expect(anbieterUndModell("local:Qwen3-32B-AWQ")).toBe("local:Qwen3-32B-AWQ");
  });

  it("F9: ohne Cloud-Konfiguration bleibt die Zeile leer — und die lokale Zeile unverändert", () => {
    const rows = aiAccessRows({
      configured: true,
      cloudConfigured: false,
      provider: "local:Qwen3-32B-AWQ",
      model: "local:Qwen3-32B-AWQ",
      mode: "model",
      localConfigured: true,
      localProvider: "local:Qwen3-32B-AWQ",
    });
    // Kein Anbietername ohne Schlüssel: das wäre eine Aussage über eine Verbindung, die es nicht gibt.
    expect(rows[0]).toEqual({ id: "cloud", state: "missing", detail: null });
    expect(rows[2]).toEqual({ id: "local", state: "available", detail: "local:Qwen3-32B-AWQ" });
    expect(rows.map((r) => r.id)).toEqual(["cloud", "fallback", "local"]);
  });
});

describe("JOB 3090 F10–F12: die ausgewiesenen Grenzen", () => {
  it("F10: der OpenAI-Client kann keine Bilder — das Feld fehlt, statt etwas zu erfinden", () => {
    const client = cloudClient(OPENAI_ENV);
    expect(client?.completeVision).toBeUndefined();
    expect("completeVision" in (client ?? {})).toBe(false);
  });

  it("F11: der von OpenAI gemeldete Verbrauch kommt an — genau einmal je Aufruf", async () => {
    fetchSpion({
      choices: [{ message: { content: "OK" } }],
      usage: { prompt_tokens: 11, completion_tokens: 7 },
    });
    const client = cloudClient(OPENAI_ENV);
    const spur: ModellAufrufSpur = { gerufen: false };
    await mitModellAufrufSpur(spur, async () => {
      await client?.complete("s", "u", false);
    });
    expect(spur.gerufen).toBe(true);
    // Ein Aufruf, eine Meldung: `gemeldeteAufrufe: 1` schließt die Doppelzählung aus (JOB 3074 R1).
    expect(spur.verbrauch).toEqual({ eingabeToken: 11, ausgabeToken: 7, gemeldeteAufrufe: 1 });
  });

  // F12 IST EINE STRUKTURPRÜFUNG UND SONST NICHTS — und das steht hier, weil Runde 1 in der
  // Rückgabe mehr behauptet hat, als dieser Test kann (BEN, Korrekturpflicht 1): F12 liest den
  // QUELLTEXT und zählt Muster. Er sieht deshalb NICHT, WELCHER Anbieter gewählt wird; wird die
  // OpenAI-Wahl wieder ausgebaut (Probe M2), bleibt er GRÜN — gemessen, nicht vermutet. Was er
  // leistet: er fängt eine ZWEITE Kopie des HTTP-Wegs und eine ZWEITE Cloud-Egress-Regel. Den
  // Nachweis der Anbieterwahl führen F1/F2/F7 und der Verbindungstest
  // (`cloud-wahl-verbindungstest.test.tsx`, V1–V4), die unter M2 rot werden.
  it("F12: es gibt genau EINEN /chat/completions-Weg und EINE Cloud-Egress-Regel", () => {
    const quelle = readFileSync(
      join(process.cwd(), "services/reasoner/src/model-client.ts"),
      "utf8",
    );
    // Kein zweiter HTTP-Weg (Lieferpunkt 7): der Pfad wird an genau EINER Stelle gefetcht — gezählt
    // wird die Code-Form `${base}/chat/completions`, nicht die Erwähnung in einem Kommentar.
    expect(quelle.match(/\$\{base\}\/chat\/completions/g) ?? []).toHaveLength(1);
    // Keine zweite Egress-Regel: die Marke wird für die Cloud an genau einer Stelle gesetzt — in der
    // einen Fabrik, für BEIDE Anbieter.
    expect(quelle.match(/\{ rejectsConfidential: true \}/g) ?? []).toHaveLength(1);
  });
});

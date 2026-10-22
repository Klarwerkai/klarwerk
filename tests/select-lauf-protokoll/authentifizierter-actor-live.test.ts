// PL5-ACTOR-SELECT-LIVE: heutige Sitzung/Route → Reasoner → Protokoll-Wrapper → InMemory.
// Nur der Modelltransport ist kontrolliert; der Actor stammt aus der Anmeldung.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import { confluenceImportRoutes } from "../../services/app/src/routes/confluence-import-routes";
import type { ConfluenceSourceAdapter } from "../../services/confluence";
import type { ImportItem } from "../../services/library-analytics";
import {
  InMemoryModelRunRepo,
  type ModelRunRecord,
  type ModelRunRepo,
  ProtokollModelRunRepo,
} from "../../services/model-runs";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import {
  cappedModelClient,
  meldeModellVerbrauch,
} from "../../services/reasoner/src/model-concurrency";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const PROMPT = "PL5_PROMPT_SENTINEL: alles zur Wartung";
const RAW_RESULT = "PL5_RAW_RESULT_SENTINEL";
const MODEL_DETAIL = "PL5_MODEL_DETAIL_SENTINEL";
const DB_DETAIL = "PL5_DB_DETAIL_SENTINEL";
const BODY_ACTOR = "PL5_BODY_ACTOR_SENTINEL";
const HEADER_ACTOR = "PL5_HEADER_ACTOR_SENTINEL";
const apps: Array<ReturnType<typeof buildApp>> = [];

beforeEach(() => {
  vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
  vi.stubEnv("EXTERNAL_SEARCH", "off");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("KLARWERK_DEV_PERSIST", "0");
  vi.stubEnv("ANTHROPIC_API_KEY", undefined);
  vi.stubEnv("OPENAI_API_KEY", undefined);
  vi.stubEnv("KLARWERK_LOCAL_LLM_URL", undefined);
  vi.stubEnv("KLARWERK_LOCAL_LLM_MODEL", undefined);
  vi.stubEnv("KLARWERK_CONFLUENCE_IMPORT", undefined);
  vi.stubEnv("KLARWERK_ADDON_API", undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("PL5-ACTOR-SELECT-LIVE: Netzwerk ist im Test verboten.");
    }),
  );
});

afterEach(async () => {
  try {
    for (const app of apps.splice(0)) {
      await app.close();
    }
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

async function aufbau(opts: { modell?: "fehler" | "fehlt"; appendAblehnen?: boolean } = {}) {
  const repo = new InMemoryModelRunRepo();
  const append = vi.fn(async (record: ModelRunRecord) => {
    if (opts.appendAblehnen) {
      throw new Error(DB_DETAIL);
    }
    await repo.append(record);
  });
  const inner: ModelRunRepo = { append, recent: (limit) => repo.recent(limit) };
  const protokoll = new ProtokollModelRunRepo(inner, null);
  const complete = vi.fn(async () => {
    meldeModellVerbrauch(5, 2);
    if (opts.modell === "fehler") {
      throw new Error(MODEL_DETAIL);
    }
    return JSON.stringify({ themes: ["wartung"], foreign: RAW_RESULT });
  });
  const client = cappedModelClient(
    { name: "anthropic:pl5-inprocess", model: "pl5-inprocess", complete },
    { rejectsConfidential: true },
  );
  const reasoner = new Reasoner(
    opts.modell === "fehlt" ? undefined : new ModelProvider(client),
    new DeterministicProvider(),
    protokoll,
  );
  await erteileKiFreigabe(reasoner);
  return { repo, append, complete, reasoner };
}

type Aufbau = Awaited<ReturnType<typeof aufbau>>;

async function mitSitzung(opts: Parameters<typeof aufbau>[0] = {}) {
  const env = await aufbau(opts);
  const services = buildServices();
  const app = buildApp(services);
  apps.push(app);
  const items: ImportItem[] = [
    {
      title: "Wartung Pumpe",
      statement: "Die Pumpe wird jährlich gewartet.",
      type: "best_practice",
      category: "K",
      tags: ["wartung"],
      confidentiality: "intern",
    },
  ];
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      reasoner: env.reasoner,
      makeAdapter: () =>
        ({
          source: "Confluence",
          collect: async () => items,
          collectAll: async () => ({ items, failed: [], truncated: false }),
        }) as unknown as ConfluenceSourceAdapter,
    }),
  );
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "pl5@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pl5@x.de", password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  const sitzung = login.json<{ token: string; user: { id: string } }>();
  expect(sitzung.user.id).toEqual(expect.any(String));
  expect(sitzung.user.id).not.toBe("");
  return {
    ...env,
    actorId: sitzung.user.id,
    select: (spoof = false) =>
      app.inject({
        method: "POST",
        url: "/api/admin/import/confluence/select",
        headers: {
          authorization: `Bearer ${sitzung.token}`,
          ...(spoof ? { "x-actor-id": HEADER_ACTOR } : {}),
        },
        payload: {
          prompt: PROMPT,
          promptConfidential: false,
          ...(spoof
            ? { actor: BODY_ACTOR, subject: { kind: "ko", id: "fremd" }, tenant: "fremd" }
            : {}),
        },
      }),
  };
}

function angebotenerLauf(env: Aufbau): ModelRunRecord {
  expect(env.append).toHaveBeenCalledTimes(1);
  const record = env.append.mock.calls[0]?.[0];
  if (!record) {
    throw new Error("Kein Lauf zum Speichern angeboten.");
  }
  return record;
}

async function gespeicherterLauf(env: Aufbau): Promise<ModelRunRecord> {
  const angeboten = angebotenerLauf(env);
  const laeufe = await env.repo.recent(10);
  expect(laeufe).toHaveLength(1);
  const lauf = laeufe[0];
  if (!lauf) {
    throw new Error("Kein Lauf im Speicher.");
  }
  expect(lauf).toStrictEqual(angeboten);
  return lauf;
}

function nurLaufmetadaten(lauf: ModelRunRecord) {
  expect(Object.hasOwn(lauf, "subject")).toBe(false);
  expect(Object.hasOwn(lauf, "tenant")).toBe(false);
  for (const text of [PROMPT, RAW_RESULT, MODEL_DETAIL, DB_DETAIL, BODY_ACTOR, HEADER_ACTOR]) {
    expect(JSON.stringify(lauf)).not.toContain(text);
  }
}

describe("PL5-ACTOR-SELECT-LIVE: Session-Actor im heutigen Importweg", () => {
  it("A · Erfolg: Sitzungs-ID trotz Body-/Header-Spoof, genau ein Modellaufruf/Write", async () => {
    const env = await mitSitzung();
    const response = await env.select(true);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      inferenceStatus: "ok",
      criteria: { themes: ["wartung"] },
      matched: 1,
    });
    expect(response.json().criteria).toEqual({ themes: ["wartung"] });
    expect(response.body).not.toContain(env.actorId);
    expect(response.body).not.toContain(RAW_RESULT);
    expect(env.complete).toHaveBeenCalledTimes(1);
    const lauf = await gespeicherterLauf(env);
    expect(lauf).toMatchObject({
      actor: env.actorId,
      task: "select",
      status: "success",
      demo: false,
    });
    nurLaufmetadaten(lauf);
  });

  it("B · Modellfehler: Actor, ein Fehlversuch und gemeldeter Verbrauch", async () => {
    const env = await mitSitzung({ modell: "fehler" });
    const response = await env.select();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      inferenceStatus: "unavailable",
      fallbackReason: "model-error",
      criteria: {},
    });
    expect(env.complete).toHaveBeenCalledTimes(1);
    const lauf = await gespeicherterLauf(env);
    expect(lauf).toMatchObject({
      actor: env.actorId,
      task: "select",
      status: "error",
      demo: false,
      model: "pl5-inprocess",
      error: "model-error",
      verbrauch: { eingabeToken: 5, ausgabeToken: 2, gemeldeteAufrufe: 1 },
    });
    expect(lauf.versuche).toHaveLength(1);
    expect(lauf.versuche?.[0]).toMatchObject({
      provider: "anthropic:pl5-inprocess",
      model: "pl5-inprocess",
      startedAt: expect.any(String),
      dauerMs: expect.any(Number),
      aufrufe: 1,
      ausgang: "fehler",
      verbrauch: { eingabeToken: 5, ausgabeToken: 2, gemeldeteAufrufe: 1 },
      spanId: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
    expect(Object.hasOwn(lauf, "kosten")).toBe(false);
    nurLaufmetadaten(lauf);
  });

  it("C · Früher no-model-Record: Actor, kein Modell und keine erfundenen Versuche", async () => {
    const env = await mitSitzung({ modell: "fehlt" });
    const response = await env.select();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      inferenceStatus: "unavailable",
      fallbackReason: "no-model",
    });
    expect(env.complete).not.toHaveBeenCalled();
    const lauf = await gespeicherterLauf(env);
    expect(lauf).toMatchObject({
      actor: env.actorId,
      task: "select",
      status: "error",
      demo: true,
      error: "no-model",
    });
    for (const feld of ["model", "verbrauch", "versuche", "kosten"]) {
      expect(Object.hasOwn(lauf, feld)).toBe(false);
    }
    nurLaufmetadaten(lauf);
  });

  it("D · Ohne Context feldlos; leerer Prompt ohne weiteren Modellaufruf/Write", async () => {
    const env = await aufbau();
    const result = await env.reasoner.deriveImportCriteria(PROMPT, "de", false);
    expect(result).toMatchObject({ criteria: { themes: ["wartung"] }, fallbackReason: null });
    const lauf = await gespeicherterLauf(env);
    expect(Object.hasOwn(lauf, "actor")).toBe(false);
    nurLaufmetadaten(lauf);
    await expect(env.reasoner.deriveImportCriteria("  ", "de", false)).resolves.toEqual({
      criteria: null,
      fallbackReason: null,
    });
    expect(env.complete).toHaveBeenCalledTimes(1);
    expect(env.append).toHaveBeenCalledTimes(1);
    expect(await env.repo.recent(10)).toHaveLength(1);
  });

  it("E · Appendablehnung: Actor angeboten, Kriterien nutzbar", async () => {
    const env = await mitSitzung({ appendAblehnen: true });
    const response = await env.select();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      inferenceStatus: "ok",
      criteria: { themes: ["wartung"] },
      matched: 1,
    });
    expect(response.json().criteria).toEqual({ themes: ["wartung"] });
    expect(response.json().fallbackReason).toBeUndefined();
    expect(response.body).not.toContain(DB_DETAIL);
    expect(response.body).not.toContain(env.actorId);
    expect(env.complete).toHaveBeenCalledTimes(1);
    const angeboten = angebotenerLauf(env);
    expect(angeboten).toMatchObject({ actor: env.actorId, status: "success", demo: false });
    nurLaufmetadaten(angeboten);
    expect(await env.repo.recent(10)).toEqual([]);
  });
});

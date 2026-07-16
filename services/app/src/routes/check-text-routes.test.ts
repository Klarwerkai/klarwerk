import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryOverlapRepo, OverlapService, type OverlapVerdict } from "../../../conflicts";
import type { EmbeddingProvider, EmbeddingStore } from "../../../embedding";
import type { KnowledgeObject, KoService } from "../../../knowledge-object";
import type { Reasoner } from "../../../reasoner";
import { buildApp, buildServices } from "../build-app";
import type { SemanticPrefilter } from "../duplicate-detection";
import type { Guards } from "../http";
import { checkTextRoutes } from "./check-text-routes";

// SCRUM-491 Slice 5/6: POST /api/check-text, hinter KLARWERK_ADDON_API. Sichert: Flag AUS = Endpunkt
// existiert nicht (404, bit-identisch); Flag AN = Dry-Run ohne Persistenz; Auth Session ODER
// addon(checktext.validated); Roh-Pfad-Exaktheit; Längen-Validierung; kontrollierter 400 statt 500;
// Stufe 1 (deterministisch, kein Modell) vs Stufe 2 (want:"deep" → Modell-Judge, injiziert getestet);
// Rate-Limit auf dem Add-on-Pfad.
const ADDON_KEY_HEADER = "x-klarwerk-addon-key";
const KEY = "s3cr3t-addon-key";

// Near-identische Kerntexte → deterministisches Duplikat (kein Modell).
const SEED_STMT = "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlüften.";
const CHECK_STMT = "Nach dem Anfahren 10 Sekunden warten und dann die Pumpe entlüften.";

const SAVED: Record<string, string | undefined> = {};
const KEYS = [
  "KLARWERK_ADDON_API",
  "KLARWERK_ADDON_API_KEY",
  "KLARWERK_ADDON_ORIGIN",
  "KLARWERK_ADDON_RATE_MAX",
  "KLARWERK_ADDON_RATE_WINDOW",
];
beforeEach(() => {
  for (const k of KEYS) {
    SAVED[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of KEYS) {
    if (SAVED[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = SAVED[k];
    }
  }
});

async function loggedInApp() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  return { app, headers };
}

// Legt ein VALIDIERTES KO an (POST + rate up → status "validiert"), damit der validated-only-Pool trifft.
async function seedValidated(
  app: ReturnType<typeof buildApp>,
  headers: Record<string, string>,
  statement: string,
) {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Pumpe entlüften",
      statement,
      type: "best_practice",
      category: "Wartung",
      neededValidations: 1,
    },
  });
  const id = created.json().id as string;
  await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers,
    payload: { action: "rate", verdict: "up" },
  });
  return id;
}

describe("SCRUM-491 Slice 5: POST /api/check-text (Flag AUS = Endpunkt existiert nicht)", () => {
  it("Flag AUS → /api/check-text NICHT registriert → 404 (bit-identisch)", async () => {
    const { app, headers } = await loggedInApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers,
      payload: { text: CHECK_STMT },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("SCRUM-491 Slice 5: POST /api/check-text (Flag AN)", () => {
  beforeEach(() => {
    process.env.KLARWERK_ADDON_API = "1";
    process.env.KLARWERK_ADDON_API_KEY = KEY;
  });

  it("Session, Text in range → deterministische duplicates, persisted:false, NULL Persistenz", async () => {
    const { app, headers } = await loggedInApp();
    const seedId = await seedValidated(app, headers, SEED_STMT);
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers,
      payload: { text: CHECK_STMT, title: "Pumpe entlüften" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.persisted).toBe(false);
    expect(body.answer).toBeNull();
    expect(body.conflicts).toEqual([]);
    expect(body.duplicates.length).toBeGreaterThanOrEqual(1);
    expect(body.duplicates[0].koId).toBe(seedId);
    expect(body.duplicates[0].method).toBe("deterministic"); // KEIN Modell
    // NULL Persistenz: kein Board-Eintrag, keine Wissenslücke, kein zusätzliches KO.
    const board = await app.inject({ method: "GET", url: "/api/duplicates", headers });
    expect(board.json()).toHaveLength(0);
    const gaps = await app.inject({ method: "GET", url: "/api/gaps", headers });
    expect(gaps.json()).toHaveLength(0);
    const kos = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(kos.json()).toHaveLength(1); // nur das Seed-KO, kein transientes angelegt
  });

  it("deterministischer Pfad → kein Inhalts-Audit: der transiente Text landet NIRGENDS", async () => {
    const { app, headers } = await loggedInApp();
    await seedValidated(app, headers, SEED_STMT);
    const MARKER = "SONDERMARKE9911";
    await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers,
      payload: { text: `${MARKER} — dieser transiente Prüftext darf niemals gespeichert werden.` },
    });
    const audit = await app.inject({ method: "GET", url: "/api/audit", headers });
    expect(JSON.stringify(audit.json())).not.toContain(MARKER);
    const gaps = await app.inject({ method: "GET", url: "/api/gaps", headers });
    expect(gaps.json()).toHaveLength(0);
    const board = await app.inject({ method: "GET", url: "/api/duplicates", headers });
    expect(board.json()).toHaveLength(0);
  });

  it("addon-Principal MIT checktext.validated (echter Key) → erreichbar (200)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers: { [ADDON_KEY_HEADER]: KEY },
      payload: { text: CHECK_STMT },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().persisted).toBe(false);
  });

  it("addon-Key: Roh-Pfad-Exaktheit (enkodierte/Varianten → 403), literal → 200", async () => {
    const app = buildApp(buildServices());
    const post = (url: string) =>
      app.inject({
        method: "POST",
        url,
        headers: { [ADDON_KEY_HEADER]: KEY },
        payload: { text: CHECK_STMT },
      });
    expect((await post("/api/check-text")).statusCode).toBe(200);
    expect((await post("/api/check-text?x=1")).statusCode).toBe(200);
    expect((await post("/api/%63heck-text")).statusCode).toBe(403); // %63 = 'c'
    expect((await post("/api/check-text/")).statusCode).toBe(403); // Trailing-Slash
    expect((await post("/API/CHECK-TEXT")).statusCode).toBe(403); // Groß-/Kleinschreibung
  });

  it("addon-Key auf einer dritten Route bleibt 403 (Deny-by-default, kein Teilzugriff)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "GET",
      url: "/api/conflicts",
      headers: { [ADDON_KEY_HEADER]: KEY },
    });
    expect(res.statusCode).toBe(403);
  });

  it("Text < 40 oder > 8.000 Zeichen → 400", async () => {
    const { app, headers } = await loggedInApp();
    const tooShort = await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers,
      payload: { text: "zu kurz" },
    });
    expect(tooShort.statusCode).toBe(400);
    const tooLong = await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers,
      payload: { text: "a".repeat(8_001) },
    });
    expect(tooLong.statusCode).toBe(400);
  });

  it('want:"deep" (Stufe 2) → 200 (Modell-Pfad aktiv, kein 400 mehr)', async () => {
    // Slice 6: want:"deep" schaltet Stufe 2. Mit dem realen (offline) Reasoner liefert judgeDuplicate
    // null → deterministisch/leer, aber der Endpunkt antwortet 200 (kein „noch nicht" mehr). Der
    // injizierte-Judge-Beweis, dass das Modell wirklich läuft, steht in der Stufe-2-Suite unten.
    const { app, headers } = await loggedInApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers,
      payload: { text: CHECK_STMT, want: "deep" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().persisted).toBe(false);
  });
});

describe("SCRUM-491 Slice 5 (ben-Review): kontrollierter 400 statt 500 bei fehlendem/malformem Body", () => {
  beforeEach(() => {
    process.env.KLARWERK_ADDON_API = "1";
    process.env.KLARWERK_ADDON_API_KEY = KEY;
  });

  it("gültiger addon-Key, KEIN Body → 400 (nicht 500), keine interne Fehlermeldung/TypeError", async () => {
    // bens exakte Repro: früher las der Handler request.body.text ohne Body → TypeError → 500.
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers: { [ADDON_KEY_HEADER]: KEY },
    });
    expect(res.statusCode).toBe(400);
    expect(res.payload).not.toContain("TypeError");
    expect(res.payload).not.toContain("Cannot read");
  });

  it("Body ohne text / nicht-String / zu kurz → 400 (Schema, EINE Quelle der Validierung)", async () => {
    const app = buildApp(buildServices());
    const post = (payload: unknown) =>
      app.inject({
        method: "POST",
        url: "/api/check-text",
        headers: { [ADDON_KEY_HEADER]: KEY },
        payload: payload as object,
      });
    expect((await post({})).statusCode).toBe(400); // text fehlt
    expect((await post({ text: 123 })).statusCode).toBe(400); // kein String
    expect((await post({ text: "kurz" })).statusCode).toBe(400); // < 40 Zeichen
    expect((await post({ text: "a".repeat(8_001) })).statusCode).toBe(400); // > 8.000
  });

  it("malformer JSON-Body → 400 (nicht 500)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers: { [ADDON_KEY_HEADER]: KEY, "content-type": "application/json" },
      payload: "{ das ist kein json",
    });
    expect(res.statusCode).toBe(400);
  });

  it("Fix 2 (auth-vor-Validierung): anonymer Request → 401 VOR der Body-400", async () => {
    const app = buildApp(buildServices());
    // Valider Body, aber keine Auth → 401 (nicht 200).
    const okBody = await app.inject({
      method: "POST",
      url: "/api/check-text",
      payload: { text: CHECK_STMT },
    });
    expect(okBody.statusCode).toBe(401);
    // Invalider Body ohne Auth → weiterhin 401 (Auth schlägt die Schema-400).
    const badBody = await app.inject({ method: "POST", url: "/api/check-text", payload: {} });
    expect(badBody.statusCode).toBe(401);
  });
});

// --- Stufe-2-Harness (Slice 6): der Endpunkt mit INJIZIERTEN Fakes (Reasoner-Judge + Prefilter),
// KEIN echter Modellaufruf. Direkt-Plugin ohne den addon-Hook → Auth über einen Fake-Session-Guard.
const TEXT_IDENTISCH = "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlüften und prüfen.";
const TEXT_MITTEL = "Nach dem Anfahren zehn Sekunden warten.";

function mkKo(id: string, statement: string): KnowledgeObject {
  return {
    id,
    title: "Pumpe entlüften",
    statement,
    status: "validiert",
    conditions: [],
    measures: [],
    tags: [],
    category: "Wartung",
    asset: null,
  } as unknown as KnowledgeObject;
}

function fakeKo(seed: KnowledgeObject[]) {
  const list = vi.fn(async () => seed);
  const findCandidates = vi.fn(async () => seed);
  const get = vi.fn(async (id: string) => seed.find((k) => k.id === id));
  return { ko: { list, findCandidates, get } as unknown as KoService };
}

function spyPrefilter(hits: Array<{ id: string }>) {
  const embed = vi.fn(async () => ({ vectors: [[1, 0, 0]], embeddingVersion: "spy@3", dim: 3 }));
  const nearest = vi.fn(async () => hits);
  const prefilter: SemanticPrefilter = {
    embedder: {
      name: "spy",
      embeddingVersion: "spy@3",
      dim: 3,
      isAvailable: () => true,
      embed,
    } as unknown as EmbeddingProvider,
    store: { upsert: vi.fn(), nearest, delete: vi.fn() } as unknown as EmbeddingStore,
    topK: 20,
  };
  return { prefilter, embed };
}

const teilweiseVerdict: OverlapVerdict = {
  beziehung: "teilweise",
  aspects: [
    { beschreibung: "Titel deckt sich", zitatA: "Pumpe entlüften", zitatB: "Pumpe entlüften" },
  ],
  nurInA: "nur A",
  nurInB: "nur B",
  empfehlung: "zusammenfuehren_pruefen",
  confidence: 0.9,
  begruendung: "Teilweiser gemeinsamer Kern.",
};

// Fake-Guard: autorisiert den Session-Pfad (preValidation) ohne echte Sessions.
const fakeGuards = {
  requireUser: async () => ({ id: "u1" }),
  requirePermission: async () => ({ id: "u1" }),
} as unknown as Guards;

async function stage2App() {
  const repo = new InMemoryOverlapRepo();
  const { prefilter, embed } = spyPrefilter([{ id: "v2" }]);
  const { ko } = fakeKo([mkKo("v2", TEXT_MITTEL), mkKo("noise", "völlig anderer inhalt hier")]);
  const judgeDuplicate = vi.fn(async () => teilweiseVerdict);
  const reasoner = {
    judgeDuplicate,
    judgeConflict: vi.fn(async () => null),
  } as unknown as Reasoner;
  const app = Fastify();
  await app.register(
    checkTextRoutes(
      { ko, overlaps: new OverlapService({ repo }), reasoner, semanticPrefilter: prefilter },
      fakeGuards,
    ),
  );
  return { app, embed, judgeDuplicate, repo };
}

describe("SCRUM-491 Slice 6: Stufe 2 (want:'deep') mit injiziertem Fake-Judge", () => {
  it("want:'deep' → Judge + embed laufen; Ergebnis trägt Modell-confidence + rationale", async () => {
    const { app, embed, judgeDuplicate } = await stage2App();
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      payload: { text: TEXT_IDENTISCH, want: "deep" },
    });
    expect(res.statusCode).toBe(200);
    expect(judgeDuplicate).toHaveBeenCalled();
    expect(embed).toHaveBeenCalled(); // Prefilter/Textabfluss NUR bei deep
    const body = res.json();
    expect(body.duplicates[0].method).toBe("model");
    expect(body.duplicates[0].confidence).toBe(0.9);
    expect(body.duplicates[0].rationale).toBeTruthy();
    expect(body.persisted).toBe(false);
    expect(body.answer).toBeNull();
  });

  it("want fehlend / 'stage1' → KEIN Judge, KEIN embed (Stufe 1 byte-identisch)", async () => {
    for (const want of [undefined, "stage1"] as const) {
      const { app, embed, judgeDuplicate } = await stage2App();
      const res = await app.inject({
        method: "POST",
        url: "/api/check-text",
        payload: { text: TEXT_IDENTISCH, ...(want ? { want } : {}) },
      });
      expect(res.statusCode).toBe(200);
      expect(judgeDuplicate, `want=${want}`).not.toHaveBeenCalled();
      expect(embed, `want=${want}`).not.toHaveBeenCalled();
    }
  });

  it("Stufe 2 → weiterhin NULL Persistenz (kein Insert in den OverlapRepo)", async () => {
    const { app, repo } = await stage2App();
    await app.inject({
      method: "POST",
      url: "/api/check-text",
      payload: { text: TEXT_IDENTISCH, want: "deep" },
    });
    expect(await repo.all()).toHaveLength(0);
  });
});

describe("SCRUM-491 Slice 5: Rate-Limit auf /api/check-text", () => {
  beforeEach(() => {
    process.env.KLARWERK_ADDON_API = "1";
    process.env.KLARWERK_ADDON_API_KEY = KEY;
    process.env.KLARWERK_ADDON_RATE_MAX = "2";
  });
  afterEach(() => {
    delete process.env.KLARWERK_ADDON_API;
    delete process.env.KLARWERK_ADDON_API_KEY;
    delete process.env.KLARWERK_ADDON_RATE_MAX;
  });

  it("addon-Pfad über die Schwelle → 429 + Retry-After", async () => {
    const app = buildApp(buildServices());
    const send = () =>
      app.inject({
        method: "POST",
        url: "/api/check-text",
        headers: { [ADDON_KEY_HEADER]: KEY },
        payload: { text: CHECK_STMT },
      });
    expect((await send()).statusCode).not.toBe(429);
    expect((await send()).statusCode).not.toBe(429);
    const limited = await send();
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
  });

  it("Session-Request auf /api/check-text wird NICHT gedrosselt (allowList exempt)", async () => {
    const { app, headers } = await loggedInApp();
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/check-text",
        headers,
        payload: { text: CHECK_STMT },
      });
      codes.push(res.statusCode);
    }
    expect(codes.every((c) => c !== 429)).toBe(true);
  });
});

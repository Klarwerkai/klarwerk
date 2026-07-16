import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryOverlapRepo, OverlapService, type OverlapVerdict } from "../../../conflicts";
import type { EmbeddingProvider, EmbeddingStore } from "../../../embedding";
import type { KnowledgeObject, KoService } from "../../../knowledge-object";
import { ModelCapacityError, ModelProvider, Reasoner } from "../../../reasoner";
import { buildApp, buildServices, modelBusyErrorHandler } from "../build-app";
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
      payload: { text: CHECK_STMT, want: "deep", source: "draft", confidentiality: "intern" },
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
      // SCRUM-502 Schicht 2 (Round 3): der Modell-Pfad braucht jetzt eine nicht-vertrauliche Herkunft.
      payload: { text: TEXT_IDENTISCH, want: "deep", source: "draft", confidentiality: "intern" },
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
      payload: { text: TEXT_IDENTISCH, want: "deep", source: "draft", confidentiality: "intern" },
    });
    expect(await repo.all()).toHaveLength(0);
  });

  // SCRUM-502 Schicht 2 (Round 3): vertraulicher geprüfter Text → deep sperrt Embedder UND Cloud-Judge.
  it("want:'deep' + vertraulicher Draft → KEIN Judge, KEIN embed, ehrlicher Hinweis (deterministisch)", async () => {
    const { app, embed, judgeDuplicate } = await stage2App();
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      payload: {
        text: TEXT_IDENTISCH,
        want: "deep",
        source: "draft",
        confidentiality: "vertraulich",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(judgeDuplicate).not.toHaveBeenCalled(); // kein Cloud-Judge
    expect(embed).not.toHaveBeenCalled(); // kein Embedder-Egress
    expect(res.json().note).toBeTruthy(); // ehrlicher Hinweis auf den deterministischen Rückfall
  });

  // Fail-safe: fehlt die Herkunft ganz (z. B. Alt-Add-in), gilt der Text als vertraulich.
  it("want:'deep' OHNE source → fail-safe: KEIN Judge, KEIN embed, Hinweis", async () => {
    const { app, embed, judgeDuplicate } = await stage2App();
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      payload: { text: TEXT_IDENTISCH, want: "deep" },
    });
    expect(res.statusCode).toBe(200);
    expect(judgeDuplicate).not.toHaveBeenCalled();
    expect(embed).not.toHaveBeenCalled();
    expect(res.json().note).toBeTruthy();
  });

  // source:"draft" mit expliziter Stufe "intern" → deep läuft normal (Judge + embed).
  it("want:'deep' + source:draft intern → Judge + embed laufen (nicht vertraulich)", async () => {
    const { app, embed, judgeDuplicate } = await stage2App();
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      payload: { text: TEXT_IDENTISCH, want: "deep", source: "draft", confidentiality: "intern" },
    });
    expect(res.statusCode).toBe(200);
    expect(judgeDuplicate).toHaveBeenCalled();
    expect(embed).toHaveBeenCalled();
    expect(res.json().note).toBeNull();
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

// SCRUM-498 B2: Der prozess-globale Modell-Cap wirft bei Überlauf ModelCapacityError; der Reasoner reicht
// ihn durch (kein Fallback), der globale setErrorHandler mappt ihn auf 503 + Retry-After. Hier End-to-End
// über den vollen buildApp-Pfad (inkl. Error-Handler), mit einem Reasoner, dessen Client den Backpressure-
// Fehler wirft — stellvertretend für „Warteschlange voll / Acquire-Timeout".
describe("SCRUM-498 B2: Modell-Cap-Überlauf (deep) → kontrolliertes 503, kein 500/Crash", () => {
  beforeEach(() => {
    process.env.KLARWERK_ADDON_API = "1";
    process.env.KLARWERK_ADDON_API_KEY = KEY;
  });

  // Reasoner, dessen einziger Chokepoint (client.complete) den Backpressure-Fehler wirft.
  function busyReasonerServices() {
    const services = buildServices();
    const throwingClient = {
      name: "cap",
      complete: async () => {
        throw new ModelCapacityError("Modell ausgelastet.");
      },
    };
    (services as unknown as { reasoner: Reasoner }).reasoner = new Reasoner(
      new ModelProvider(throwingClient),
    );
    return services;
  }

  async function loginOn(app: ReturnType<typeof buildApp>) {
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
    return { authorization: `Bearer ${login.json().token}` };
  }

  it("want:'deep' + Cap-Überlauf → 503 + Retry-After (MODEL_BUSY), nicht 500", async () => {
    const app = buildApp(busyReasonerServices());
    const headers = await loginOn(app);
    // Mittlere Deckung (identisch vs. Kurzfassung) → der deep-Pfad ruft wirklich den (werfenden) Judge.
    await seedValidated(app, headers, TEXT_MITTEL);
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers,
      // SCRUM-502 Schicht 2 (Round 3): nicht-vertrauliche Herkunft, damit der deep-Judge wirklich läuft.
      payload: { text: TEXT_IDENTISCH, want: "deep", source: "draft", confidentiality: "intern" },
    });
    expect(res.statusCode).toBe(503);
    expect(res.headers["retry-after"]).toBeDefined();
    expect(res.json().error).toBe("MODEL_BUSY");
    expect(res.payload).not.toContain("ModelCapacityError"); // kein Stacktrace nach außen
  });

  it("Stufe 1 (kein Modell) bleibt 200 — der Cap berührt den deterministischen Pfad nicht", async () => {
    const app = buildApp(busyReasonerServices());
    const headers = await loginOn(app);
    await seedValidated(app, headers, SEED_STMT);
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers,
      payload: { text: CHECK_STMT }, // kein want:"deep" → kein Judge
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().persisted).toBe(false);
  });
});

// SCRUM-498 B2 (Fix): der Semantic-Prefilter ruft embed() direkt — ohne Cap ein Bypass. Läuft der
// Embed-Cap über (ModelCapacityError), reicht der Prefilter den Fehler durch (statt still lexikalisch zu
// degradieren) → derselbe globale Handler (modelBusyErrorHandler, verbatim aus buildApp) macht daraus
// 503 + Retry-After. Echte Embed-Fehler degradieren weiter lexikalisch → 200.
async function stage2AppEmbedThrows(embedErr: Error) {
  const { ko } = fakeKo([mkKo("v2", TEXT_MITTEL)]);
  const judgeDuplicate = vi.fn(async () => teilweiseVerdict);
  const reasoner = {
    judgeDuplicate,
    judgeConflict: vi.fn(async () => null),
  } as unknown as Reasoner;
  const prefilter: SemanticPrefilter = {
    embedder: {
      name: "throwing",
      embeddingVersion: "throw@3",
      dim: 3,
      isAvailable: () => true,
      embed: async () => {
        throw embedErr;
      },
    } as unknown as EmbeddingProvider,
    store: { upsert: vi.fn(), nearest: vi.fn(), delete: vi.fn() } as unknown as EmbeddingStore,
    topK: 20,
  };
  const app = Fastify();
  app.setErrorHandler(modelBusyErrorHandler); // derselbe Handler wie in buildApp
  await app.register(
    checkTextRoutes(
      {
        ko,
        overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
        reasoner,
        semanticPrefilter: prefilter,
      },
      fakeGuards,
    ),
  );
  return { app, judgeDuplicate };
}

describe("SCRUM-498 B2 (Fix): Embed-Cap-Überlauf (deep) → 503 über den echten Handler", () => {
  it("embed wirft ModelCapacityError → 503 + Retry-After (NICHT still lexikalisch + 200)", async () => {
    const { app, judgeDuplicate } = await stage2AppEmbedThrows(
      new ModelCapacityError("Embedder ausgelastet."),
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      payload: { text: TEXT_IDENTISCH, want: "deep", source: "draft", confidentiality: "intern" },
    });
    expect(res.statusCode).toBe(503);
    expect(res.headers["retry-after"]).toBeDefined();
    expect(res.json().error).toBe("MODEL_BUSY");
    expect(judgeDuplicate).not.toHaveBeenCalled(); // Backpressure surfaced vor dem Judge
  });

  it("echter Embed-Fehler (deep) → lexikalischer Fallback → 200 (kein 503), Judge läuft", async () => {
    const { app, judgeDuplicate } = await stage2AppEmbedThrows(new Error("Netzfehler"));
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      payload: { text: TEXT_IDENTISCH, want: "deep", source: "draft", confidentiality: "intern" },
    });
    expect(res.statusCode).toBe(200);
    expect(judgeDuplicate).toHaveBeenCalled(); // lexikalischer Pool → Judge lief
  });
});

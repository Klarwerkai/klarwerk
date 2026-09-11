import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  anlegen,
  aufbau as dokumentAufbau,
  loginCookie,
  validieren,
} from "../../../../tests/m3-dokumentweg/harness";
import { InMemoryOverlapRepo, OverlapService, type OverlapVerdict } from "../../../conflicts";
import type { EmbeddingProvider, EmbeddingStore } from "../../../embedding";
import type { KnowledgeObject, KoService } from "../../../knowledge-object";
import {
  InMemoryKlaraSessionRepo,
  ModelCapacityError,
  ModelProvider,
  Reasoner,
} from "../../../reasoner";
import { buildApp, buildServices, modelBusyErrorHandler } from "../build-app";
import type { SemanticPrefilter } from "../duplicate-detection";
import type { Guards } from "../http";
import { KlaraSessionService } from "../services/klara-session-service";
import type { Ka4Freigabepruefer } from "./ask-routes";
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

// Legt ein VALIDIERTES KO an (POST + rate up → status "validiert").
// JOB 3020: der Pool ist auf dem Session-Pfad nicht mehr validated-only — der ungeprüfte Bestand
// zählt dort mit. Ein VALIDIERTES Seed bleibt trotzdem das richtige Mittel für diese Suite: es
// trifft auf BEIDEN Wegen (Session UND Add-in) und hält die Aussagen dieser Datei unverändert.
// Dass ein OFFENES Objekt jetzt ebenfalls trifft — und auf dem Add-in-Weg gerade nicht —, ist der
// Gegenstand von tests/pruefung-gegen-alles/n1-ungeprueftes-wird-gefunden.test.ts.
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
      confidentiality: "intern",
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

  // ================================================================================================
  // JOB 3216 RUNDE 2 — DER BESTEHENDE ANTWORTVERTRAG, GEPINNT STATT BEHAUPTET.
  // ================================================================================================
  //
  // WARUM DIESER FALL EXISTIERT: Runde 1 hat behauptet, `sourceHits` sei „additiv", und das Tor hat
  // gezeigt, dass die Behauptung nicht gemessen war — vier Bestandsdateien und 23 Fälle gingen an
  // dieser Route kaputt. Eine Zugabe, deren Unschädlichkeit niemand pinnt, ist keine Zugabe.
  //
  // DER PIN HAT DREI TEILE, und der dritte ist der eigentliche:
  //   1 die SECHS Felder des Altvertrags stehen VORNE und in unveränderter Reihenfolge — gemessen
  //     an der Reihenfolge der Schlüssel im serialisierten Rumpf, nicht an einer sortierten Menge;
  //   2 nach dem Entfernen der drei neuen Felder ist der Rumpf FELD FÜR FELD der alte;
  //   3 die drei neuen Felder heißen genau so und sind die EINZIGEN neuen.
  // Fällt Punkt 2, hat jemand am Altvertrag gedreht — gleich, was er sonst gebaut hat.
  const ALTVERTRAG_FELDER = [
    "duplicates",
    "conflicts",
    "konfliktpruefung",
    "answer",
    "note",
    "persisted",
  ];
  const NEUE_FELDER = ["sourceHits", "sourceHitsTruncated", "quellenfund"];

  it("JOB 3216 · der Altvertrag der Antwort ist unverändert — die Quellenfunde stehen daneben", async () => {
    const { app, headers } = await loggedInApp();
    const seedId = await seedValidated(app, headers, SEED_STMT);
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers,
      payload: { text: CHECK_STMT, title: "Pumpe entlüften" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    const schluessel = Object.keys(body);

    // 1 · Die sechs alten Felder stehen vorne, in genau dieser Reihenfolge.
    expect(schluessel.slice(0, ALTVERTRAG_FELDER.length)).toEqual(ALTVERTRAG_FELDER);
    // 3 · Und dahinter stehen genau die drei neuen — keine vierte stille Zugabe.
    expect(schluessel.slice(ALTVERTRAG_FELDER.length)).toEqual(NEUE_FELDER);

    // 2 · Ohne die drei neuen Felder ist der Rumpf der alte, Feld für Feld. Die erwarteten Werte
    // sind die des Stands VOR diesem Auftrag (deterministischer Weg, ein validiertes Seed-Objekt
    // mit nahezu gleichem Kerntext, kein Modell, kein Konfliktdienst) — nachgemessen mit
    // zurückgenommener Route-Zugabe, s. GEGENPROBEN der Rückgabe.
    const ohneZugabe: Record<string, unknown> = { ...body };
    for (const feld of NEUE_FELDER) {
      delete ohneZugabe[feld];
    }
    expect(ohneZugabe).toEqual({
      duplicates: [
        {
          koId: seedId,
          koTitle: "Pumpe entlüften",
          relation: "identisch",
          confidence: null,
          method: "deterministic",
          rationale: null,
          koStatus: "validiert",
          koCategory: "Wartung",
          pruefstand: "validiert",
          version: 1,
          fundort: {
            kategorie: "Wartung",
            bereich: "Wartung",
            bibliothekPfad: `/wissen/${seedId}`,
          },
        },
      ],
      conflicts: [],
      konfliktpruefung: {
        gelaufen: false,
        grund: "nicht_angefordert",
        kandidaten: 0,
        ausgefallen: 0,
        verworfen: 0,
      },
      answer: null,
      note: "Auch noch nicht validierte Einträge wurden mitgeprüft.",
      persisted: false,
    });
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

// SCRUM-498 (WP-D): expliziter Route-bodyLimit (CHECK_TEXT_BODY_LIMIT, 128 KiB) — analog zu
// /api/ask (ASK_BODY_LIMIT). Beweist: ein zu großer Body bekommt ein kontrolliertes 413 (statt des
// globalen 1-MiB-Fastify-Default), und ein Body knapp unter dem Cap wird weiterhin inhaltlich vom
// Schema geprüft (die Größenprüfung ersetzt die Feld-Validierung nicht).
describe("SCRUM-498 (WP-D): POST /api/check-text bodyLimit (413)", () => {
  beforeEach(() => {
    process.env.KLARWERK_ADDON_API = "1";
    process.env.KLARWERK_ADDON_API_KEY = KEY;
  });

  it("Body > 128 KiB → 413 (milder Transport-Cap, kein 500)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers: { [ADDON_KEY_HEADER]: KEY },
      payload: { text: CHECK_STMT, title: "a".repeat(200_000) },
    });
    expect(res.statusCode).toBe(413);
  });

  it("Body knapp unter 128 KiB mit zu langem text (> 8.000) → weiterhin 400 vom Schema", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers: { [ADDON_KEY_HEADER]: KEY },
      // ~120 KiB Gesamtbody (< 128 KiB) — der Cap greift NICHT; text bleibt trotzdem > 8.000 Zeichen
      // und muss weiterhin am Schema scheitern (400, nicht 413).
      payload: { text: "a".repeat(8_001), title: "b".repeat(110 * 1024) },
    });
    expect(res.statusCode).toBe(400);
  });
});

// --- Stufe-2-Harness (Slice 6): der Endpunkt mit INJIZIERTEN Fakes (Reasoner-Judge + Prefilter),
// KEIN echter Modellaufruf. Direkt-Plugin ohne den addon-Hook → Auth über einen Fake-Session-Guard.
const TEXT_IDENTISCH = "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlüften und prüfen.";
const TEXT_MITTEL = "Nach dem Anfahren zehn Sekunden warten.";

function mkKo(id: string, statement: string, confidentiality?: string): KnowledgeObject {
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
    ...(confidentiality ? { confidentiality } : {}),
  } as unknown as KnowledgeObject;
}

// JOB 3216: der Fake trägt jetzt auch den gemeinsamen Suchvertrag, den der Quellenfund benutzt.
// `suchtext` am Seed-Objekt stellt den gespeicherten Volltext (im Produkt die Suchprojektion).
function suchtextVon(k: KnowledgeObject): string {
  const volltext = (k as unknown as { suchtext?: string }).suchtext ?? "";
  return [k.title, k.statement, volltext].filter((teil) => teil.length > 0).join("\n");
}

function fakeKo(seed: KnowledgeObject[]) {
  const list = vi.fn(async () => seed);
  const findCandidates = vi.fn(async () => seed);
  const get = vi.fn(async (id: string) => seed.find((k) => k.id === id));
  const findSearchHits = vi.fn(async (q: { terms: readonly string[]; limit?: number }) =>
    seed
      .filter((k) =>
        q.terms.some((term) => suchtextVon(k).toLowerCase().includes(term.toLowerCase())),
      )
      .slice(0, q.limit ?? seed.length)
      .map((k) => ({ koId: k.id, koVersion: 1 })),
  );
  const listForSearch = vi.fn(async () => seed);
  const effectiveSearchDocumentOf = vi.fn(async (id: string) => {
    const k = seed.find((x) => x.id === id);
    return k === undefined ? undefined : { koId: id, searchText: suchtextVon(k) };
  });
  return {
    ko: {
      list,
      findCandidates,
      get,
      findSearchHits,
      listForSearch,
      effectiveSearchDocumentOf,
    } as unknown as KoService,
    findSearchHits,
  };
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

// JOB 3020: `note` trägt seit dieser Runde bis zu ZWEI Aussagen — den Vertraulichkeits-Rückfall
// (SCRUM-502) und den Satz über den mitgeprüften ungeprüften Bestand. Die Fälle unten prüften
// bisher `note === null`, um zu sagen „der deep-Pfad lief, es gab KEINEN Rückfall". Genau das
// sagen sie weiterhin — nur zielgenau auf die Aussage, um die es ihnen ging. Gelöscht wurde keine
// Zusicherung: aus „gar kein Hinweis" wurde „kein Vertraulichkeits-Hinweis".
const VERTRAULICH_HINWEIS = "nur deterministisch geprüft";

// Fake-Guard: autorisiert den Session-Pfad (preValidation) ohne echte Sessions.
// JOB 3216: MIT Rolle. Der Handler leitet aus dem festgestellten Menschen die Sichtbarkeits-
// entscheidung für die Quellenfunde ab (`sichtbarkeitsfilterFuer`/`sqlSichtbarkeitFuer`), und die
// fragt die Rechtematrix nach der Rolle. Ein rollenloser Nutzer ist im Produkt nicht erreichbar —
// ein Fake ohne Rolle hätte also eine Lage gemessen, die es nicht gibt.
const fakeGuards = {
  requireUser: async () => ({ id: "u1", role: "experte" }),
  requirePermission: async () => ({ id: "u1", role: "experte" }),
} as unknown as Guards;

async function stage2App(
  seed: KnowledgeObject[] = [mkKo("v2", TEXT_MITTEL), mkKo("noise", "völlig anderer inhalt hier")],
  ka4?: Ka4Freigabepruefer,
) {
  const repo = new InMemoryOverlapRepo();
  const { prefilter, embed } = spyPrefilter([{ id: "v2" }]);
  const { ko } = fakeKo(seed);
  const judgeDuplicate = vi.fn(async () => teilweiseVerdict);
  const reasoner = {
    judgeDuplicate,
    judgeConflict: vi.fn(async () => null),
  } as unknown as Reasoner;
  const app = Fastify();
  await app.register(
    checkTextRoutes(
      {
        ko,
        overlaps: new OverlapService({ repo }),
        reasoner,
        semanticPrefilter: prefilter,
        ...(ka4 ? { ka4 } : {}),
      },
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
    expect(res.json().note ?? "").not.toContain(VERTRAULICH_HINWEIS);
  });

  // SCRUM-502 Round 4 (Sicherheits-Kern): eine lose koId darf frei gelieferten Text NIE freigeben.
  it("want:'deep' + source:'ko' + koId (loser Anker) → KEIN Judge, KEIN embed (fail-safe)", async () => {
    const { app, embed, judgeDuplicate } = await stage2App();
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      // Genau der R4-Exploit: fremder/interner KO-Anker für frei gelieferten Text.
      payload: { text: TEXT_IDENTISCH, want: "deep", source: "ko", koId: "v2" },
    });
    expect(res.statusCode).toBe(200);
    expect(judgeDuplicate).not.toHaveBeenCalled();
    expect(embed).not.toHaveBeenCalled();
    expect(res.json().note).toBeTruthy();
  });

  // koId-Backstop HEBT: intern deklariert, aber das referenzierte KO ist gespeichert-vertraulich.
  it("want:'deep' + source:draft intern + koId eines vertraulichen KOs → KEIN Judge/embed (Backstop hebt)", async () => {
    const { app, embed, judgeDuplicate } = await stage2App([
      mkKo("v2", TEXT_MITTEL, "vertraulich"),
      mkKo("noise", "völlig anderer inhalt hier"),
    ]);
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      payload: {
        text: TEXT_IDENTISCH,
        want: "deep",
        source: "draft",
        confidentiality: "intern",
        koId: "v2",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(judgeDuplicate).not.toHaveBeenCalled();
    expect(embed).not.toHaveBeenCalled();
    expect(res.json().note).toBeTruthy();
  });

  // SCRUM-502 R5: ein Upload (transient-document) OHNE bewusste Stufe ist fail-safe vertraulich —
  // Judge UND Embedder (echte Spies) werden NIE aufgerufen. Der Upload erbt keine Container-Stufe.
  it("want:'deep' + source:'transient-document' OHNE Stufe → KEIN Judge, KEIN embed (fail-safe)", async () => {
    const { app, embed, judgeDuplicate } = await stage2App();
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      payload: { text: TEXT_IDENTISCH, want: "deep", source: "transient-document" },
    });
    expect(res.statusCode).toBe(200);
    expect(judgeDuplicate).not.toHaveBeenCalled();
    expect(embed).not.toHaveBeenCalled();
    expect(res.json().note).toBeTruthy();
  });

  // SCRUM-502 R5 Kern: Upload in ein INTERNES Ziel-KO OHNE bewusste Stufe → der Upload erbt NICHT
  // die intern-Stufe des Behälters (koId ist nur Backstop, hebt hier nichts) → fail-safe → kein Egress.
  it("want:'deep' + transient-document + koId eines INTERNEN KOs OHNE Stufe → KEIN Judge/embed", async () => {
    const { app, embed, judgeDuplicate } = await stage2App(); // v2 ist intern
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      payload: { text: TEXT_IDENTISCH, want: "deep", source: "transient-document", koId: "v2" },
    });
    expect(res.statusCode).toBe(200);
    expect(judgeDuplicate).not.toHaveBeenCalled(); // kein Erben der intern-Container-Stufe
    expect(embed).not.toHaveBeenCalled();
    expect(res.json().note).toBeTruthy();
  });

  // Positiv: ein bewusst als intern eingestufter Upload läuft den Modell-Pfad (Judge + Embed).
  it("want:'deep' + source:'transient-document' + bewusst intern → Judge + embed laufen", async () => {
    const { app, embed, judgeDuplicate } = await stage2App();
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      payload: {
        text: TEXT_IDENTISCH,
        want: "deep",
        source: "transient-document",
        confidentiality: "intern",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(judgeDuplicate).toHaveBeenCalled();
    expect(embed).toHaveBeenCalled();
    expect(res.json().note ?? "").not.toContain(VERTRAULICH_HINWEIS);
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

  // ================================================================================================
  // OFFEN (JOB 3588, nachgemessen von JOB 3657): DER FALL UNTEN BRAUCHT DIE GRUNDFREIGABE UND KANN
  // SIE VON HIER AUS NICHT BEKOMMEN.
  // ================================================================================================
  //
  // „want:'deep' + Cap-Überlauf → 503" misst, dass ein ausgelastetes Modell zu 503 + Retry-After
  // führt und NICHT zu 500 — dafür muss der Cloud-Client überhaupt gerufen werden. Unter dem Kern
  // von JOB 3549 setzt das die Adminfreigabe voraus; ohne sie läuft der Judge deterministisch durch
  // und die Route antwortet mit 200. Gemessen auf dem Messstand von JOB 3657 (Kern 1bcb283):
  // „AssertionError: expected 200 to be 503" — die Zusage wäre still verschwunden.
  //
  // BEIDE WEGE SIND VERSPERRT, gemessen und nicht vermutet:
  //   1. TESTHELFER IMPORTIEREN — `npx depcruise --config .dependency-cruiser.cjs services` meldet
  //      mit dem Import „error module-boundaries: services/app/src/routes/check-text-routes.test.ts
  //      → services/reasoner/src/testhelfer-ki-freigabe.ts" (JOB 3657, Gegenprobe 1: zusammen mit
  //      den drei Schwesterdateien „x 4 dependency violations (4 errors, 0 warnings)").
  //      `.dependency-cruiser.cjs:16-27`; Cross-Modul nur über `services/reasoner/index.ts`.
  //   2. DIE FELDER SELBST SCHREIBEN — auch in der Nutzlast des echten Adminwegs
  //      `PUT /api/reasoner/config`. Der Freigabe-Wächter F2
  //      (`tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts`) verbietet das ausnahmslos;
  //      JOB 3588 Runde 1 ist genau daran rot geworden.
  //
  // ACHTUNG, diese Datei steht in KEINEM der drei Register von `routing-zwei-attrappen.test.ts`:
  // ihr Pfad liegt ausserhalb der dort gepflegten FLÄCHE. F6 kann sie deshalb nicht einfordern —
  // sie ist genau die Sorte Datei, die im Torlauf des Kerns still rot wird. Wer die Freigabe hier
  // je setzt, trägt sie zuerst in die FLÄCHE ein.
  //
  // Der kleinste Umbau ist ein Re-Export des Helfers in `services/reasoner/index.ts` — ausserhalb
  // der Zielpfade und gegen die dort festgehaltene Hausdoktrin (mega59 Block I). JOB 3657 hat ihn
  // auf einem verworfenen Messstand gebaut: damit werden alle fünf offenen Fälle grün (128/128,
  // depcruise und `tsc` sauber), aber der Freigabe-Wächter F1 sieht die Benutzer dann nicht mehr.
  // Vollständig mit Zahlen in `services/app/src/routes/reasoner-egress.test.ts`, Kopf `appWithSpy`.
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

// Route mit echtem Sitzungsdienst. Z1 in tests/n11b-zustimmung-macht-intern misst zusätzlich
// die Verdrahtung in buildApp; diese Fälle isolieren Judge, Embedder und fehlenden Prüfer.
describe("N11b: Word-Riegel mit realem KA4-Dienst", () => {
  it.each(["erteilt", "fehlt", "fremd", "unvollständig", "dienst-fehlt"])(
    "Dokumentzustimmung %s",
    async (lage) => {
      const dienst = new KlaraSessionService({
        repo: new InMemoryKlaraSessionRepo(),
        policy: () => ({
          choice: "cloud",
          source: "db",
          effectiveAnswerProvider: "cloud",
          cloudConfigured: true,
          localConfigured: false,
          providerLabel: "anthropic",
          modelLabel: "claude",
        }),
      });
      const session = await dienst.createSession("u1", "instance-1", {
        kind: "saved",
        hostDocumentId: "doc-1",
      });
      if (lage !== "fehlt") {
        const consent = await dienst.grantConsent(session.sessionId, {
          actorId: "u1",
          addinInstanceId: "instance-1",
          documentContextId: session.documentContextId,
        });
        expect(consent.consentState).toBe("granted");
      }
      const { app, embed, judgeDuplicate } = await stage2App(
        undefined,
        lage === "dienst-fehlt" ? undefined : dienst,
      );
      try {
        const response = await app.inject({
          method: "POST",
          url: "/api/check-text",
          headers: {
            "x-klara-session": session.sessionId,
            "x-klara-instance": lage === "unvollständig" ? "" : "instance-1",
            "x-klara-document": lage === "fremd" ? "fremd" : session.documentContextId,
          },
          payload: {
            text: TEXT_IDENTISCH,
            want: "deep",
            source: "transient-document",
            confidentiality: "vertraulich",
            nichtEingestuft: true,
          },
        });
        expect(response.statusCode).toBe(200);
        if (lage === "erteilt") {
          expect(embed).toHaveBeenCalled();
          expect(judgeDuplicate).toHaveBeenCalled();
          expect(response.json().konfliktpruefung).toMatchObject({
            gelaufen: false,
            grund: "kein_konfliktdienst",
          });
        } else {
          expect(embed).not.toHaveBeenCalled();
          expect(judgeDuplicate).not.toHaveBeenCalled();
          expect(response.json().konfliktpruefung).toMatchObject({
            gelaufen: false,
            grund: "vertraulich",
          });
        }
      } finally {
        await app.close();
      }
    },
  );
});

// M3c-R: K1–K6 aus tests/ka7-konflikt-im-panel/konflikt-strukturiert.test.ts.
// Echte Login-Antwort, Sitzungsauflösung, Rechte, KO- und Konfliktdienst; nur das Modellurteil
// ist kontrolliert. Solche Fälle gehören laut Dokumentweg-Harness in die Routensuite.
const VERTRAGSFAELLE = ["K1", "K2", "K3", "K4", "K5", "K6"] as const;
const ZUSATZFELDER = ["sourceHits", "sourceHitsTruncated", "quellenfund"];
const ALTFELDER = ["duplicates", "conflicts", "konfliktpruefung", "answer", "note", "persisted"];

async function vertragsAntworten(fall: (typeof VERTRAGSFAELLE)[number]) {
  process.env.KLARWERK_ADDON_API = "1";
  const { app, services, autor, admin } = await dokumentAufbau();
  try {
    const cookie = await loginCookie(app, "autor@m3c.test", "geheim12345");
    expect(Object.keys(cookie)).toEqual(["cookie"]);
    const text = "Homeoffice ist für alle Beschäftigten an drei Tagen pro Woche möglich.";
    if (fall !== "K6") {
      const id = await anlegen(app, autor, {
        title: "Homeoffice-Regelung",
        statement: "Homeoffice ist für alle Beschäftigten an zwei Tagen pro Woche möglich.",
        // Neben dem Konflikt ein echter Quellenfund: der Vollvergleich darf nicht nur [] vergleichen.
        bodyHtml: `<p>${text}</p>`,
        type: "best_practice",
        category: "Personal",
        neededValidations: 1,
      });
      await validieren(app, admin, id);
    }
    const judge = vi.spyOn(services.reasoner, "judgeConflictOutcome").mockResolvedValue(
      fall === "K5"
        ? { verdict: null, failure: "no-model" }
        : {
            verdict: {
              relation: "widerspruch",
              older: null,
              confidence: 0.95,
              begruendung: "A erlaubt drei Tage, B zwei.",
              zitat_a: "an drei Tagen pro Woche",
              zitat_b: "an zwei Tagen pro Woche",
            },
          },
    );
    const duplicate = vi.spyOn(services.reasoner, "judgeDuplicate").mockResolvedValue(null);
    const payload = {
      text,
      title: "Homeoffice-Regelung",
      locale: "de",
      ...(fall === "K3" ? {} : { want: "deep" }),
      source: "transient-document",
      confidentiality: fall === "K4" ? "vertraulich" : "intern",
    };
    try {
      const bearerAntwort = await app.inject({
        method: "POST",
        url: "/api/check-text",
        headers: autor,
        payload,
      });
      const cookieAntwort = await app.inject({
        method: "POST",
        url: "/api/check-text",
        headers: cookie,
        payload,
      });
      return {
        bearer: {
          status: bearerAntwort.statusCode,
          body: bearerAntwort.json() as Record<string, unknown>,
        },
        cookie: {
          status: cookieAntwort.statusCode,
          body: cookieAntwort.json() as Record<string, unknown>,
        },
      };
    } finally {
      judge.mockRestore();
      duplicate.mockRestore();
    }
  } finally {
    await app.close();
  }
}

describe.each(VERTRAGSFAELLE)("M3c-R · Cookie/Bearer-Vertrag · %s", (fall) => {
  it("a · Statuscode gleich: 200", async () => {
    const { bearer, cookie } = await vertragsAntworten(fall);
    expect(cookie.status).toBe(bearer.status);
    expect(cookie.status).toBe(200);
  });

  it("b · Feldreihenfolge gleich und vollständig", async () => {
    const { bearer, cookie } = await vertragsAntworten(fall);
    expect(Object.keys(cookie.body)).toEqual(Object.keys(bearer.body));
    expect(Object.keys(cookie.body)).toEqual([...ALTFELDER, ...ZUSATZFELDER]);
  });

  it("c · Altvertrag nach Entfernung ALLER drei Zusatzfelder gleich", async () => {
    const { bearer, cookie } = await vertragsAntworten(fall);
    const alt = (body: Record<string, unknown>) => {
      const ohne = { ...body };
      for (const feld of ZUSATZFELDER) {
        delete ohne[feld];
      }
      return ohne;
    };
    expect(alt(cookie.body)).toEqual(alt(bearer.body));
  });

  it("d · vollständiger Vertrag mit Quellenfund UND konkreter K-Lage gleich", async () => {
    const { bearer, cookie } = await vertragsAntworten(fall);
    expect(cookie.body).toEqual(bearer.body);
    expect(cookie.body.sourceHits).toHaveLength(fall === "K6" ? 0 : 1);
    expect(cookie.body.sourceHitsTruncated).toBe(false);
    expect(cookie.body.quellenfund).toEqual({
      gelaufen: true,
      grund: null,
      geprueft: fall === "K6" ? 0 : 1,
    });
    const erwartet = {
      gelaufen: ["K1", "K2", "K6"].includes(fall),
      grund:
        fall === "K3"
          ? "nicht_angefordert"
          : fall === "K4"
            ? "vertraulich"
            : fall === "K5"
              ? "kein_modell"
              : null,
      kandidaten: ["K1", "K2", "K5"].includes(fall) ? 1 : 0,
      ausgefallen: fall === "K5" ? 1 : 0,
      verworfen: 0,
    };
    expect(cookie.body.konfliktpruefung).toEqual(erwartet);
    if (fall === "K1" || fall === "K2") {
      expect(cookie.body.conflicts).toEqual([
        expect.objectContaining({
          stellen: { eigen: "an drei Tagen pro Woche", quelle: "an zwei Tagen pro Woche" },
          koTitle: "Homeoffice-Regelung",
          pruefstand: "validiert",
          confidence: 0.95,
        }),
      ]);
    } else {
      expect(cookie.body.conflicts).toEqual([]);
    }
    if (fall === "K4") {
      expect(cookie.body.note).toContain("deterministisch");
    }
  });
});

it("M3c-R · fehlt set-cookie trotz erfolgreichem Login, bricht der Cookie-Helfer ab", async () => {
  const app = buildApp(buildServices());
  app.addHook("onSend", async (request, reply, payload) => {
    if (request.url === "/api/auth/login") {
      reply.removeHeader("set-cookie");
    }
    return payload;
  });
  try {
    const registered = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        name: "Cookieprobe",
        email: "cookie@test.de",
        password: "geheim12345",
      },
    });
    expect(registered.statusCode).toBe(201);
    await expect(loginCookie(app, "cookie@test.de", "geheim12345")).rejects.toThrow(
      "Anmeldung ohne gültiges set-cookie-Sitzungscookie; Cookie-Test abgebrochen.",
    );
  } finally {
    await app.close();
  }
});

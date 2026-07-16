import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../build-app";

// SCRUM-491 Slice 5: POST /api/check-text v1 = Stufe 1 (deterministisch), hinter KLARWERK_ADDON_API.
// Sichert: Flag AUS = Endpunkt existiert nicht (404, bit-identisch); Flag AN = deterministische
// Dry-Run-Prüfung ohne Persistenz/Modell; Auth Session ODER addon(checktext.validated); Roh-Pfad-
// Exaktheit; Längen-Validierung; want:"deep" = 400; Rate-Limit auf dem Add-on-Pfad.
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

  it('want:"deep" (Stufe 2) → 400 (noch nicht verfügbar, kein stilles Stufe-1)', async () => {
    const { app, headers } = await loggedInApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers,
      payload: { text: CHECK_STMT, want: "deep" },
    });
    expect(res.statusCode).toBe(400);
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

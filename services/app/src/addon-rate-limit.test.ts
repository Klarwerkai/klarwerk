import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// SCRUM-490 D3: Rate-Limit auf POST /api/ask, NUR für den addon-authentifizierten Pfad, hinter
// KLARWERK_ADDON_API. Diese Suite sichert die drei Kernzusagen:
//   Flag AUS → Plugin nicht registriert → /api/ask ungedrosselt (Regression, heutiges Verhalten).
//   Flag AN  → addon-Request über die Schwelle → 429 + Retry-After.
//   Flag AN  → Session-Request der Live-App auf /api/ask wird NICHT gedrosselt (allowList exempt).
const ADDON_KEY_HEADER = "x-klarwerk-addon-key";
const KEY = "s3cr3t-addon-key";

// Sichert & restauriert die vom Add-on-/Rate-Pfad gelesenen Env-Variablen um jeden Test.
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

// Ein eingeloggter Admin (erstes Konto) für die Session-Requests auf /api/ask.
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

describe("KLARWERK_ADDON_API — Rate-Limit auf /api/ask (Flag AUS = Bestandsverhalten)", () => {
  it("addon-Key-Requests werden NICHT gedrosselt (Plugin gar nicht registriert)", async () => {
    // Selbst mit gesetztem Key + niedriger Schwelle: bei Flag AUS existiert weder der addon-Pfad noch
    // die Drossel. Der Key wird nicht als Zugang akzeptiert (401), aber es gibt nie einen 429.
    process.env.KLARWERK_ADDON_API_KEY = KEY;
    process.env.KLARWERK_ADDON_RATE_MAX = "2";
    const app = buildApp(buildServices());
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/ask",
        headers: { [ADDON_KEY_HEADER]: KEY },
        payload: { question: "Hallo?" },
      });
      codes.push(res.statusCode);
    }
    expect(codes.every((c) => c !== 429)).toBe(true);
  });
});

describe("KLARWERK_ADDON_API — Rate-Limit auf /api/ask (Flag AN)", () => {
  beforeEach(() => {
    process.env.KLARWERK_ADDON_API = "1";
    process.env.KLARWERK_ADDON_API_KEY = KEY;
    process.env.KLARWERK_ADDON_RATE_MAX = "2"; // kleine Schwelle → Limit schnell erreicht
  });

  it("addon-Request über die Schwelle → 429 + Retry-After", async () => {
    const app = buildApp(buildServices());
    const send = () =>
      app.inject({
        method: "POST",
        url: "/api/ask",
        headers: { [ADDON_KEY_HEADER]: KEY },
        payload: { question: "Hallo?" },
      });
    // max=2 → die ersten beiden sind erlaubt, der dritte wird gedrosselt.
    expect((await send()).statusCode).not.toBe(429);
    expect((await send()).statusCode).not.toBe(429);
    const limited = await send();
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
  });

  it("Session-Request auf /api/ask wird NICHT gedrosselt (allowList exempt)", async () => {
    const { app, headers } = await loggedInApp();
    const codes: number[] = [];
    // Deutlich mehr als die Schwelle (2) — keiner darf 429 sein, weil Session-Requests exempt sind.
    for (let i = 0; i < 6; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/ask",
        headers,
        payload: { question: "Wie geht das?" },
      });
      codes.push(res.statusCode);
    }
    expect(codes.every((c) => c !== 429)).toBe(true);
  });

  it("addon-Drossel greift NICHT auf andere Routen (global:false)", async () => {
    // /health hat keine config.rateLimit → auch mit vielen Aufrufen nie 429.
    const app = buildApp(buildServices());
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await app.inject({ method: "GET", url: "/health" });
      codes.push(res.statusCode);
    }
    expect(codes.every((c) => c === 200)).toBe(true);
  });
});

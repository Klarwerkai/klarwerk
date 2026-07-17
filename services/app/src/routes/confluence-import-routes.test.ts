import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../build-app";

// SCRUM-510 WP2: Admin-Trigger-Route — Auth (nur Admin), Flag-Gating (OFF → Route nicht registriert).
const SAVED: Record<string, string | undefined> = {};
const KEYS = ["KLARWERK_CONFLUENCE_IMPORT"];
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

async function adminApp() {
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
  return { app, headers: { authorization: `Bearer ${login.json().token}` } };
}

describe("SCRUM-510 WP2: POST /api/admin/import/confluence", () => {
  it("Flag OFF → Route nicht registriert (404)", async () => {
    const { app, headers } = await adminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers,
      payload: {},
    });
    expect(res.statusCode).toBe(404);
  });

  it("Flag ON, ohne Session → 401 (Admin-Auth erzwungen)", async () => {
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });

  it("Flag ON, Nicht-Admin → abgelehnt (kein Import-Zugang)", async () => {
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
    const app = buildApp(buildServices());
    // erster User ist Admin (Bootstrap); ein ZWEITER ist ein normaler Nutzer ohne users.manage
    // (und ist bis zur Admin-Freigabe nicht aktiv) → in KEINEM Fall Import-Zugang.
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
    });
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Vip", email: "vip@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "vip@x.de", password: "secret123" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers: { authorization: `Bearer ${login.json().token ?? ""}` },
      payload: {},
    });
    // Abgelehnt (401 unbestätigt / 403 kein users.manage) — jedenfalls KEIN 2xx.
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).not.toBe(404); // Route existiert (Flag AN) — die Ablehnung ist Auth, kein Fehl-Routing
  });

  it("Flag ON, Admin, aber Confluence NICHT konfiguriert → 503 (ehrlich, kein Crash)", async () => {
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1"; // Flag an, aber keine KLARWERK_CONFLUENCE_* Config
    const { app, headers } = await adminApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers,
      payload: { dryRun: true },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe("IMPORT_UNAVAILABLE");
  });
});

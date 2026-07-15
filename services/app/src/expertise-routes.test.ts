import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// Consultant-System (Experten-Matching): Die Route ist neu — getestet wird ihre EIGENE Logik:
// Feature-Flag-Gate (Default AUS → 404) und Zugriffsschutz. Die Rechte-Durchsetzung selbst nutzt den
// bewährten guards.requirePermission("ko.assign")-Guard (an anderer Stelle abgedeckt).

const FLAG = "KLARWERK_EXPERT_MATCHING";
let savedFlag: string | undefined;
let savedKeychain: string | undefined;

beforeEach(() => {
  savedFlag = process.env[FLAG];
  savedKeychain = process.env.KLARWERK_SKIP_KEYCHAIN;
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
  delete process.env[FLAG]; // Ausgangszustand: Flag AUS (Default)
});

afterEach(() => {
  if (savedFlag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = savedFlag;
  if (savedKeychain === undefined) delete process.env.KLARWERK_SKIP_KEYCHAIN;
  else process.env.KLARWERK_SKIP_KEYCHAIN = savedKeychain;
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
  const headers = { authorization: `Bearer ${login.json().token}` };
  return { app, headers };
}

describe("Experten-Matching Route (hinter Feature-Flag)", () => {
  it("Flag AUS (Default) → 404, auch mit Admin-Token (Feature unsichtbar)", async () => {
    const { app, headers } = await adminApp();
    const res = await app.inject({ method: "GET", url: "/api/analytics/expertise", headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("Flag AN, ohne Token → 401 (Zugriff ist geschützt, nicht offen)", async () => {
    process.env[FLAG] = "1";
    const { app } = await adminApp();
    const res = await app.inject({ method: "GET", url: "/api/analytics/expertise" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("Flag AN + Admin (ko.assign) → 200, liefert Thema→Personen", async () => {
    process.env[FLAG] = "1";
    const { app, headers } = await adminApp();
    await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Pumpe",
        statement: "Pumpe entlüften.",
        type: "best_practice",
        category: "Wartung",
      },
    });
    const res = await app.inject({ method: "GET", url: "/api/analytics/expertise", headers });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      category: string;
      contributors: { authorId: string; koCount: number }[];
    }[];
    expect(Array.isArray(body)).toBe(true);
    const wartung = body.find((e) => e.category === "Wartung");
    expect(wartung).toBeDefined();
    expect(wartung?.contributors.length).toBeGreaterThan(0);
    await app.close();
  });
});

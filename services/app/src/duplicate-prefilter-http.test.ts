import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// B6 (HTTP end-to-end): mit aktivem Feature-Flag läuft die Store-Befüllung im ECHTEN Einreiche-Pfad
// (nach dem 201). Dieser Test beweist die Verdrahtung + Robustheit: zwei ähnliche KOs nacheinander
// anlegen → beide 201 (die Befüllung bricht den Submit nie), Duplikat erscheint end-to-end.
// (Store-Pfad vs. Voll-Pool-Fallback unterscheidet der diskriminierende Unit-Test in
// duplicate-detection.test.ts — über HTTP ist das Ergebnis identisch.)

const ENV_KEYS = ["KLARWERK_DUP_PREFILTER", "KLARWERK_SKIP_KEYCHAIN"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
  }
  // Flag AN (sonst Default AUS) + Keychain im Test aus (deterministisch, kein Model-Client).
  process.env.KLARWERK_DUP_PREFILTER = "1";
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = saved[k];
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
  const headers = { authorization: `Bearer ${login.json().token}` };
  return { app, headers };
}

async function createKo(
  app: Awaited<ReturnType<typeof adminApp>>["app"],
  headers: Record<string, string>,
  statement: string,
): Promise<number> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: { title: "Pumpe entlüften", statement, type: "best_practice", category: "Wartung" },
  });
  return res.statusCode;
}

describe("B6 HTTP: Store-Befüllung im Einreiche-Pfad (Flag AN)", () => {
  it("zwei ähnliche KOs nacheinander → beide 201 (Befüllung bricht den Submit nie)", async () => {
    const { app, headers } = await adminApp();
    const s1 = await createKo(
      app,
      headers,
      "Nach dem Anfahren 10 Sekunden warten, dann Pumpe entlüften.",
    );
    const s2 = await createKo(
      app,
      headers,
      "Nach dem Anfahren zehn Sekunden warten, danach die Pumpe entlüften.",
    );
    expect(s1).toBe(201);
    expect(s2).toBe(201);
    await app.close();
  });

  it("Duplikat wird end-to-end erkannt und erscheint unter /api/duplicates", async () => {
    const { app, headers } = await adminApp();
    const text = "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlüften.";
    expect(await createKo(app, headers, text)).toBe(201);
    expect(await createKo(app, headers, text)).toBe(201);
    const list = await app.inject({ method: "GET", url: "/api/duplicates", headers });
    expect(list.statusCode).toBe(200);
    expect(Array.isArray(list.json())).toBe(true);
    expect(list.json().length).toBeGreaterThan(0);
    await app.close();
  });
});

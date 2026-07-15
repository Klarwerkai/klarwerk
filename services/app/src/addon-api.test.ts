import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// KLARWERK_ADDON_API (Klara-Add-on-Pfad): EIN Flag schaltet CORS + schmalen ko.read-Token-Zugang für
// /api/ask. Diese Suite sichert beide Seiten des Flags über die ECHTEN HTTP-Routen ab:
//   Flag AUS → keine CORS-Header, kein Token-Pfad, /api/ask exakt wie bisher (Session-Guard).
//   Flag AN  → nur die konfigurierte Add-in-Origin, gültiger Key → ko.read-Antwort, ungültig/kein Key → 401,
//              und der Key öffnet KEINE andere Route.
const ADDON_KEY_HEADER = "x-klarwerk-addon-key";
const KEY = "s3cr3t-addon-key";
const ORIGIN = "https://localhost:3000";

// Sichert & restauriert die vom Add-on-Pfad gelesenen Env-Variablen um jeden Test herum, damit ein
// Test das Flag nie an einen anderen leaked.
const SAVED: Record<string, string | undefined> = {};
const KEYS = ["KLARWERK_ADDON_API", "KLARWERK_ADDON_API_KEY", "KLARWERK_ADDON_ORIGIN"];
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

// Ein validiertes KO, gegen das /api/ask deterministisch antwortet — geteiltes Setup für die Token-Tests.
async function appWithValidatedKo() {
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
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Zylinderkopfdichtung XQ42 wechseln",
      statement: "Die Zylinderkopfdichtung XQ42 vor dem Wechsel entlasten.",
      type: "best_practice",
      category: "Ask",
      neededValidations: 1,
    },
  });
  const koId = ko.json().id as string;
  await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: { action: "rate", verdict: "up" },
  });
  return { app, headers, koId };
}

describe("KLARWERK_ADDON_API — Flag AUS (Default = Bestandsverhalten)", () => {
  it("keine CORS-Header, selbst mit Add-in-Origin", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { origin: ORIGIN },
      payload: { question: "Hallo?" },
    });
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("Add-in-Key wird NICHT als Zugang akzeptiert → weiterhin 401 (kein Token-Pfad)", async () => {
    // Key im Header, aber Flag AUS → resolveAskUser fällt auf den Session-Guard zurück → anonym → 401.
    process.env.KLARWERK_ADDON_API_KEY = KEY; // gesetzt, aber Flag bleibt AUS
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [ADDON_KEY_HEADER]: KEY },
      payload: { question: "Hallo?" },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("/api/ask mit gültiger Session funktioniert unverändert", async () => {
    const { app, headers, koId } = await appWithValidatedKo();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Wie wird die Zylinderkopfdichtung XQ42 gewechselt?" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.sources).toContain(koId);
  });
});

describe("KLARWERK_ADDON_API — Flag AN", () => {
  beforeEach(() => {
    process.env.KLARWERK_ADDON_API = "1";
    process.env.KLARWERK_ADDON_API_KEY = KEY;
    process.env.KLARWERK_ADDON_ORIGIN = ORIGIN;
  });

  it("erlaubt genau die konfigurierte Add-in-Origin (kein Wildcard)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/ask",
      headers: {
        origin: ORIGIN,
        "access-control-request-method": "POST",
        "access-control-request-headers": ADDON_KEY_HEADER,
      },
    });
    expect(res.headers["access-control-allow-origin"]).toBe(ORIGIN);
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });

  it("fremde Origin bekommt niemals ihre eigene Origin oder Wildcard gespiegelt", async () => {
    // Statischer String-Origin: der Server echoet IMMER exakt die konfigurierte Origin zurück, nie die
    // Anfrage-Origin, nie "*". Der Browser blockt evil.example, weil allow-origin ≠ dessen Origin.
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/ask",
      headers: {
        origin: "https://evil.example",
        "access-control-request-method": "POST",
      },
    });
    const allow = res.headers["access-control-allow-origin"];
    expect(allow).not.toBe("https://evil.example");
    expect(allow).not.toBe("*");
    expect(allow).toBe(ORIGIN);
  });

  it("gültiger Key → ko.read-Antwort ohne Session", async () => {
    const { app, koId } = await appWithValidatedKo();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [ADDON_KEY_HEADER]: KEY, origin: ORIGIN },
      payload: { question: "Wie wird die Zylinderkopfdichtung XQ42 gewechselt?" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.sources).toContain(koId);
  });

  it("ungültiger Key → 401", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [ADDON_KEY_HEADER]: "falsch" },
      payload: { question: "Hallo?" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("kein Key + keine Session → Session-Guard greift weiter (401)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      payload: { question: "Hallo?" },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("der Key öffnet KEINE andere Route (nur /api/ask)", async () => {
    const app = buildApp(buildServices());
    // GET /api/gaps (ko.read) — trotz Key kein Zugang, weil der Key nur in /api/ask geprüft wird.
    const gaps = await app.inject({
      method: "GET",
      url: "/api/gaps",
      headers: { [ADDON_KEY_HEADER]: KEY },
    });
    expect(gaps.statusCode).toBeGreaterThanOrEqual(400);
    // POST /api/kos (ko.create) — erst recht nicht.
    const create = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: { [ADDON_KEY_HEADER]: KEY },
      payload: { title: "x", statement: "y", type: "best_practice", category: "c" },
    });
    expect(create.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("Flag AN, aber KEIN Env-Key gesetzt → Pfad bleibt zu (Key im Header → 401)", async () => {
    delete process.env.KLARWERK_ADDON_API_KEY;
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [ADDON_KEY_HEADER]: KEY },
      payload: { question: "Hallo?" },
    });
    expect(res.statusCode).toBe(401);
  });
});

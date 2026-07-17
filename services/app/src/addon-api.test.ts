import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// KLARWERK_ADDON_API (Klara-Add-on-Pfad): EIN Flag schaltet CORS + den Add-on-Principal-Zugang für
// /api/ask. Diese Suite sichert beide Seiten des Flags über die ECHTEN HTTP-Routen ab:
//   Flag AUS → keine CORS-Header, kein Token-Pfad, /api/ask exakt wie bisher (Session-Guard).
//   Flag AN  → nur die konfigurierte Add-in-Origin, gültiger Key → ask.validated-Antwort, ungültig/kein Key → 401,
//              und der Key öffnet KEINE andere Route.
const ADDON_KEY_HEADER = "x-klarwerk-addon-key";
const KEY = "s3cr3t-addon-key";
const ORIGIN = "https://localhost:3000";

// Sichert & restauriert die vom Add-on-Pfad gelesenen Env-Variablen um jeden Test herum, damit ein
// Test das Flag nie an einen anderen leaked.
const SAVED: Record<string, string | undefined> = {};
const KEYS = [
  "KLARWERK_ADDON_API",
  "KLARWERK_ADDON_API_KEY",
  "KLARWERK_ADDON_ORIGIN",
  "KLARWERK_ADDON_AUTH_MAX",
  "KLARWERK_ADDON_AUTH_WINDOW",
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

  it("CORS gilt NUR für /api/ask, nicht app-weit (ben-Review SCRUM-490 P2)", async () => {
    const app = buildApp(buildServices());
    // Preflight auf eine ANDERE Route → kein allow-origin-Header (Scope strikt auf /api/ask).
    const other = await app.inject({
      method: "OPTIONS",
      url: "/api/reasoner/status",
      headers: { origin: ORIGIN, "access-control-request-method": "GET" },
    });
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
    // Echte GET-Anfrage auf eine andere Route mit Origin → ebenfalls kein CORS-Header.
    const health = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: ORIGIN },
    });
    expect(health.headers["access-control-allow-origin"]).toBeUndefined();
    // Gegenprobe: /api/ask bekommt ihn weiterhin.
    const ask = await app.inject({
      method: "OPTIONS",
      url: "/api/ask",
      headers: { origin: ORIGIN, "access-control-request-method": "POST" },
    });
    expect(ask.headers["access-control-allow-origin"]).toBe(ORIGIN);
  });

  it("Wildcard-Origin '*' → fail-closed, gar kein CORS-Header (ben-Review SCRUM-490 P2)", async () => {
    process.env.KLARWERK_ADDON_ORIGIN = "*";
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/ask",
      headers: { origin: "*", "access-control-request-method": "POST" },
    });
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("Teil-Wildcard 'https://*.example.com' → fail-closed", async () => {
    process.env.KLARWERK_ADDON_ORIGIN = "https://*.example.com";
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/ask",
      headers: { origin: "https://evil.example.com", "access-control-request-method": "POST" },
    });
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("malformed Origin (keine URL) → fail-closed", async () => {
    process.env.KLARWERK_ADDON_ORIGIN = "not-a-real-origin";
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/ask",
      headers: { origin: "https://x", "access-control-request-method": "POST" },
    });
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("Origin mit Pfad/Trailing-Slash → fail-closed (nur echte Origin erlaubt)", async () => {
    process.env.KLARWERK_ADDON_ORIGIN = "https://localhost:3000/panel";
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/ask",
      headers: { origin: "https://localhost:3000", "access-control-request-method": "POST" },
    });
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("leere Origin → fail-closed", async () => {
    process.env.KLARWERK_ADDON_ORIGIN = "   ";
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/ask",
      headers: { origin: "https://localhost:3000", "access-control-request-method": "POST" },
    });
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("Fail-closed CORS lässt den Token-Pfad unberührt: gültiger Key → 200", async () => {
    // Selbst wenn CORS wegen Wildcard-Origin fail-closed ist, bleibt der Add-on-Principal-Key-Pfad nutzbar
    // (CORS ist Browser-Schutz, keine Server-Auth). Beleg, dass die Härtung nur die CORS-Fläche betrifft.
    process.env.KLARWERK_ADDON_ORIGIN = "*";
    const { app, koId } = await appWithValidatedKo();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [ADDON_KEY_HEADER]: KEY },
      payload: { question: "Wie wird die Zylinderkopfdichtung XQ42 gewechselt?" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.sources).toContain(koId);
  });

  it("gültiger Key → ask.validated-Antwort ohne Session", async () => {
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

  // SCRUM-490 R2 (B2): falsche UND fehlende-Key-Versuche gegen den Add-on-Endpunkt werden je IP
  // gedrosselt (Brute-Force-/Lastfläche), ohne den Session-Pfad zu drosseln.
  it("B2: viele FALSCHE Key-Versuche → gedrosselt (429 mit Retry-After)", async () => {
    process.env.KLARWERK_ADDON_AUTH_MAX = "2";
    const app = buildApp(buildServices());
    const bad = () =>
      app.inject({
        method: "POST",
        url: "/api/ask",
        headers: { [ADDON_KEY_HEADER]: "falsch" },
        payload: { question: "x" },
      });
    expect((await bad()).statusCode).toBe(401);
    expect((await bad()).statusCode).toBe(401);
    const throttled = await bad();
    expect(throttled.statusCode).toBe(429);
    expect(throttled.headers["retry-after"]).toBeDefined();
  });

  it("B2: viele FEHLENDE-Key-Versuche ohne Session → ebenfalls gedrosselt (429)", async () => {
    process.env.KLARWERK_ADDON_AUTH_MAX = "2";
    const app = buildApp(buildServices());
    const noAuth = () =>
      app.inject({ method: "POST", url: "/api/ask", payload: { question: "x" } });
    await noAuth();
    await noAuth();
    expect((await noAuth()).statusCode).toBe(429);
  });

  it("B2: eine GÜLTIGE Session wird NIE gedrosselt (Session-Pfad unbeeinträchtigt)", async () => {
    process.env.KLARWERK_ADDON_AUTH_MAX = "1"; // sehr streng — würde bei Zählung sofort greifen
    const { app, headers } = await appWithValidatedKo();
    for (let i = 0; i < 4; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/ask",
        headers,
        payload: { question: "Wie wird die Zylinderkopfdichtung XQ42 gewechselt?" },
      });
      expect(res.statusCode).toBe(200); // nie 429 (Session zählt nicht als Fehlversuch)
    }
  });

  // SCRUM-490 R3 (B2-Härtung): Gegenbeispiele gepinnt.
  it("R3/Fix2: gefälschter Bearer umgeht die Zählung NICHT (echte Session-Auth) → 429", async () => {
    process.env.KLARWERK_ADDON_AUTH_MAX = "2";
    const app = buildApp(buildServices());
    const forged = () =>
      app.inject({
        method: "POST",
        url: "/api/ask",
        headers: { authorization: "Bearer gefaelscht-kein-echtes-token" },
        payload: { question: "x" },
      });
    await forged();
    await forged();
    expect((await forged()).statusCode).toBe(429); // Token-Präsenz allein reicht NICHT als „Session"
  });

  it("R3/Fix2: erfundenes kw_session-Cookie umgeht die Zählung NICHT → 429", async () => {
    process.env.KLARWERK_ADDON_AUTH_MAX = "2";
    const app = buildApp(buildServices());
    const forged = () =>
      app.inject({
        method: "POST",
        url: "/api/ask",
        headers: { cookie: "kw_session=erfunden" },
        payload: { question: "x" },
      });
    await forged();
    await forged();
    expect((await forged()).statusCode).toBe(429);
  });

  it("R3/Fix3: falscher Key auf /health → gedrosselt (kein Fremdrouten-Gültigkeitsorakel)", async () => {
    process.env.KLARWERK_ADDON_AUTH_MAX = "2";
    const app = buildApp(buildServices());
    const bad = () =>
      app.inject({ method: "GET", url: "/health", headers: { [ADDON_KEY_HEADER]: "falsch" } });
    await bad();
    await bad();
    expect((await bad()).statusCode).toBe(429);
  });

  it("R3/Fix3: falscher Key auf /api/ask/ (trailing) → gedrosselt", async () => {
    process.env.KLARWERK_ADDON_AUTH_MAX = "2";
    const app = buildApp(buildServices());
    const bad = () =>
      app.inject({
        method: "POST",
        url: "/api/ask/",
        headers: { [ADDON_KEY_HEADER]: "falsch" },
        payload: { question: "x" },
      });
    await bad();
    await bad();
    expect((await bad()).statusCode).toBe(429);
  });

  it("R3/Fix3: NO-Key-Probe gegen normalisierten Add-on-Endpunkt (/api/ask/ trailing) → gedrosselt", async () => {
    process.env.KLARWERK_ADDON_AUTH_MAX = "2";
    const app = buildApp(buildServices());
    const probe = () =>
      app.inject({ method: "POST", url: "/api/ask/", payload: { question: "x" } });
    await probe();
    await probe();
    expect((await probe()).statusCode).toBe(429);
  });

  it("R3/Fix1: echter Preflight (OPTIONS OHNE Key) zählt NIE als Versuch (viele OPTIONS → kein 429)", async () => {
    process.env.KLARWERK_ADDON_AUTH_MAX = "2";
    const app = buildApp(buildServices());
    for (let i = 0; i < 20; i++) {
      const res = await app.inject({
        method: "OPTIONS",
        url: "/api/ask",
        headers: { origin: ORIGIN, "access-control-request-method": "POST" },
      });
      expect(res.statusCode).not.toBe(429); // legitimer Preflight (nie mit Key) — nie gedrosselt
    }
  });

  it("R4/Fix1: OPTIONS MIT falschem Key → gezählt → gedrosselt (kein 401-Orakel via Preflight)", async () => {
    process.env.KLARWERK_ADDON_AUTH_MAX = "2";
    const app = buildApp(buildServices());
    const badPreflight = () =>
      app.inject({
        method: "OPTIONS",
        url: "/api/ask",
        headers: {
          origin: ORIGIN,
          "access-control-request-method": "POST",
          [ADDON_KEY_HEADER]: "falsch",
        },
      });
    await badPreflight();
    await badPreflight();
    expect((await badPreflight()).statusCode).toBe(429);
  });

  it("R4/Fix1: OPTIONS MIT richtigem Key wird ebenfalls als Versuch gezählt (kein 403-Orakel)", async () => {
    process.env.KLARWERK_ADDON_AUTH_MAX = "2";
    const app = buildApp(buildServices());
    const keyPreflight = () =>
      app.inject({
        method: "OPTIONS",
        url: "/api/ask",
        headers: {
          origin: ORIGIN,
          "access-control-request-method": "POST",
          [ADDON_KEY_HEADER]: KEY,
        },
      });
    await keyPreflight(); // gezählt
    await keyPreflight(); // gezählt
    expect((await keyPreflight()).statusCode).toBe(429); // dritter → gedrosselt ⇒ die ersten zählten
  });

  it("R3/Fix4: gültiger Key bleibt beim normalen addonRateLimit (Throttle zählt ihn nicht)", async () => {
    // Ein gültiger Key ist KEIN Fehlversuch → der Failed-Auth-Throttle greift nie; die reguläre
    // addonRateLimit-Bremse (D3) bleibt zuständig. Mit strengem Failed-Auth-Max bleibt der Key nutzbar.
    process.env.KLARWERK_ADDON_AUTH_MAX = "1";
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

  // SCRUM-490 R2 (Punkt 6): produktive HTTPS-Taskpane-Origin via KLARWERK_ADDON_ORIGIN, in CORS erzwungen.
  it("Punkt 6: KLARWERK_ADDON_ORIGIN setzt die Prod-Origin; nur sie wird freigegeben (sonst fail-closed)", async () => {
    process.env.KLARWERK_ADDON_ORIGIN = "https://app.klarwerk.ai";
    const app = buildApp(buildServices());
    const prod = await app.inject({
      method: "OPTIONS",
      url: "/api/ask",
      headers: { origin: "https://app.klarwerk.ai", "access-control-request-method": "POST" },
    });
    expect(prod.headers["access-control-allow-origin"]).toBe("https://app.klarwerk.ai");
    // Eine andere Origin (auch die Dev-Origin) bekommt NIE ihre eigene gespiegelt — nur die konfigurierte.
    const dev = await app.inject({
      method: "OPTIONS",
      url: "/api/ask",
      headers: { origin: "https://localhost:3000", "access-control-request-method": "POST" },
    });
    expect(dev.headers["access-control-allow-origin"]).toBe("https://app.klarwerk.ai");
    expect(dev.headers["access-control-allow-origin"]).not.toBe("https://localhost:3000");
  });
});

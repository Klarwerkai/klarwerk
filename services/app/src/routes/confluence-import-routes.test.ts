import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfluenceSourceAdapter } from "../../../confluence";
import { buildApp, buildServices } from "../build-app";
import { makeGuards } from "../http";
import { confluenceImportRoutes } from "./confluence-import-routes";

// SCRUM-510 WP2: Admin-Trigger-Route — Auth (nur Admin), Flag-Gating (OFF → Route nicht registriert).
const SAVED: Record<string, string | undefined> = {};
const KEYS = ["KLARWERK_CONFLUENCE_IMPORT", "KLARWERK_ADDON_API"];
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

// WP-E (19.07.2026): Crash-Repro + Beobachtbarkeit. Prod-Befund: mit KLARWERK_ADDON_API=1 waren ZWEI
// app-globale ASYNC-onSend-Hooks aktiv (Add-in-Statics via skip-override + X-Robots aus server.ts).
// Ab zwei async-Hops erreicht Fastifys Promise-Abschluss (wrap-thenable) die Stelle "reply.send()
// gerufen + Handler resolved undefined + headersSent noch false" VOR dem writeHead der ersten
// Pipeline und sendet ERNEUT → ERR_HTTP_HEADERS_SENT als unhandled rejection → Prozess-Crash. Das
// traf JEDEN Handler der App mit diesem Muster (auch Register/Login), nicht nur den Import. Fix:
// beide globalen onSend-Hooks sind jetzt SYNCHRON (Callback-Stil) — kein Fenster mehr; die
// Import-Route sichert sich zusätzlich handler-lokal mit `return reply` (Thenable-Adoption).
// Diese Tests fahren die volle App (beide globalen Hooks in Prod-Form) und pinnen: alle Requests des
// Ablaufs (Register, Login, Import) erzeugen GENAU EINE Antwort und null unhandled rejections —
// macht jemand einen der globalen Hooks wieder async, werden sie rot. Plus: der catch loggt die
// (bereits redigierte) Ursache.

// Deterministischer Adapter-Stub, dessen Space-Read scheitert (kein Netz, kein Token). Der Cast ist
// nötig, weil ConfluenceSourceAdapter eine Klasse mit privaten Feldern ist — der Stub erfüllt den
// öffentlichen Vertrag (source/collect/collectAll), mehr sieht die Route nicht.
function failingAdapter(err: Error): ConfluenceSourceAdapter {
  return {
    source: "Confluence",
    collect: async () => [],
    collectAll: async () => {
      throw err;
    },
  } as unknown as ConfluenceSourceAdapter;
}

// Baut die App wie in Produktion nach dem 19.07.-Redeploy: Add-on-Flag AN (→ der globale onSend-Hook
// der Add-in-Statics ist live) PLUS der zweite globale onSend-Hook (X-Robots-Tag) in der heutigen
// server.ts-Form — seit WP-E beide SYNCHRON (Callback-Stil). Genau diese Form ist Teil des Fixes:
// als beide Hooks noch async waren, erzeugten bereits die Register-/Login-Requests dieses Aufbaus je
// eine unhandled rejection (Doppel-Send) — der Spion unten pinnt das dauerhaft auf null.
// Das Import-Flag bleibt AUS, damit buildApp die Route nicht selbst registriert; wir registrieren sie
// mit injiziertem, scheiterndem Adapter (deterministisch) — sonst identische Verdrahtung.
async function wpEApp(adapterErr: Error) {
  process.env.KLARWERK_ADDON_API = "1";
  const services = buildServices();
  const app = buildApp(services);
  // Spiegelt den X-Robots-Hook aus server.ts/configureWebDelivery (dort nicht importierbar, da
  // Laufzeit-Einstieg) — bewusst in der synchronen Callback-Form, wie in Prod seit WP-E.
  app.addHook("onSend", (_request, reply, payload, done) => {
    reply.header("X-Robots-Tag", "noindex, nofollow");
    done(null, payload);
  });
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      makeAdapter: () => failingAdapter(adapterErr),
    }),
  );
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

// Sammelt unhandled rejections während `run` (inkl. zweier setImmediate-Runden danach, damit ein
// verzögerter Doppel-Send noch in den Spion läuft, bevor er entfernt wird).
async function withRejectionSpy(run: () => Promise<void>): Promise<unknown[]> {
  const rejections: unknown[] = [];
  const spy = (reason: unknown) => {
    rejections.push(reason);
  };
  process.on("unhandledRejection", spy);
  try {
    await run();
    await new Promise<void>((r) => setImmediate(() => r()));
    await new Promise<void>((r) => setImmediate(() => r()));
  } finally {
    process.removeListener("unhandledRejection", spy);
  }
  return rejections;
}

describe("WP-E: kein Doppel-Send/Crash auf der Import-Route (KLARWERK_ADDON_API=1)", () => {
  it("502-Fehlerpfad → genau EINE Antwort, keine unhandled rejection", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const rejections = await withRejectionSpy(async () => {
        const { app, headers } = await wpEApp(new Error("Confluence-API antwortete mit 404"));
        const res = await app.inject({
          method: "POST",
          url: "/api/admin/import/confluence",
          headers,
          payload: { dryRun: true },
        });
        expect(res.statusCode).toBe(502);
        expect(res.json()).toEqual({
          error: "IMPORT_FAILED",
          message: "Confluence-Import fehlgeschlagen.",
        });
      });
      expect(rejections).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it("Guard-Pfad (ohne users.manage) → genau eine Antwort, keine Doppel-Sendung", async () => {
    const rejections = await withRejectionSpy(async () => {
      const { app } = await wpEApp(new Error("egal"));
      // ohne Session → requirePermission sendet 401; der Handler darf danach nichts mehr senden.
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/import/confluence",
        payload: { dryRun: true },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("UNAUTHENTICATED");
    });
    expect(rejections).toEqual([]);
  });

  it("catch loggt die (redigierte) Ursache — Body bleibt ohne Interna", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { app, headers } = await wpEApp(new Error("Confluence-API antwortete mit 404"));
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/import/confluence",
        headers,
        payload: { dryRun: true },
      });
      expect(res.statusCode).toBe(502);
      expect(res.json()).toEqual({
        error: "IMPORT_FAILED",
        message: "Confluence-Import fehlgeschlagen.",
      });
      // NUR die Message (im echten Pfad bereits durch redactedError/redactSecrets redigiert) —
      // nie Stack oder cause. Genau ein Log-Aufruf pro fehlgeschlagenem Lauf.
      expect(warn).toHaveBeenCalledWith(
        "[confluence-import] fehlgeschlagen:",
        "Confluence-API antwortete mit 404",
      );
    } finally {
      warn.mockRestore();
    }
  });
});

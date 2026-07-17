import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../build-app";
import { isAddinNamespacePath } from "./addin-static-routes";

// SCRUM-490 H: statisches Serving des Add-in-Bundles unter /addin/* — nur bei aktivem KLARWERK_ADDON_API,
// traversal-sicher (explizite Datei-Map), kein Directory-Listing.

const SAVED: Record<string, string | undefined> = {};
const KEYS = ["KLARWERK_ADDON_API", "KLARWERK_ADDON_ORIGIN"];
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

describe("SCRUM-490 H: /addin/* Bundle-Serving", () => {
  it("Flag OFF → GET /addin/taskpane.html → 404 (Route nicht registriert, heutiges Verhalten)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({ method: "GET", url: "/addin/taskpane.html" });
    expect(res.statusCode).toBe(404);
  });

  it("Flag ON → Bundle-Dateien erreichbar mit korrekten Content-Types + nosniff", async () => {
    process.env.KLARWERK_ADDON_API = "1";
    const app = buildApp(buildServices());
    const expected: [string, string][] = [
      ["/addin/taskpane.html", "text/html"],
      ["/addin/taskpane.css", "text/css"],
      ["/addin/taskpane.js", "text/javascript"],
      ["/addin/klarwerk-client.js", "text/javascript"],
      ["/addin/assets/icon-32.png", "image/png"],
      ["/addin/assets/icon-80.png", "image/png"],
    ];
    for (const [url, type] of expected) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain(type);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.rawPayload.length).toBeGreaterThan(0);
    }
  });

  it("Flag ON → Path-Traversal-Gegenbeispiele → 404, NIE eine Datei außerhalb des Bundles", async () => {
    process.env.KLARWERK_ADDON_API = "1";
    const app = buildApp(buildServices());
    const attacks = [
      "/addin/../package.json",
      "/addin/%2e%2e/package.json",
      "/addin/..%2fpackage.json",
      "/addin/..%5cpackage.json",
      "/addin/..\\package.json",
      "/addin//etc/hosts",
      "/addin/assets/../../package.json",
      "/addin/.git/config",
    ];
    for (const url of attacks) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).not.toBe(200); // nie ausgeliefert
      // und keinesfalls der Inhalt einer Repo-Datei (package.json-Marker):
      expect(res.body).not.toContain('"dependencies"');
      expect(res.body).not.toContain('"@fastify');
    }
  });

  it("Flag ON → kein Auto-Index/Listing: /addin, /addin/, /addin/unbekannt.js → 404", async () => {
    process.env.KLARWERK_ADDON_API = "1";
    const app = buildApp(buildServices());
    for (const url of ["/addin", "/addin/", "/addin/unbekannt.js", "/addin/taskpane.js.map"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(404);
      expect(res.body).not.toContain("taskpane"); // kein Verzeichnis-Listing
    }
  });

  // SCRUM-490 H2 (ben-Punkt 3): Response-Hardening der NEGATIVEN /addin-Antworten.
  const STATIC_404 = JSON.stringify({ error: "NOT_FOUND", message: "Nicht gefunden." });

  it("H2: alle 404-Fälle tragen nosniff + statischen Body OHNE Pfad-Echo (inkl. Case-Miss)", async () => {
    process.env.KLARWERK_ADDON_API = "1";
    const app = buildApp(buildServices());
    for (const url of ["/addin/unbekannt.js", "/ADDIN/TASKPANE.HTML", "/addin/", "/addin"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(404);
      expect(res.headers["x-content-type-options"]).toBe("nosniff"); // nosniff auch auf 404
      expect(res.body).toBe(STATIC_404); // exakt der statische Body …
      expect(res.body).not.toContain("TASKPANE"); // … ohne Echo des angefragten Pfades
      expect(res.body).not.toContain("unbekannt");
      expect(res.body).not.toContain("Route "); // nie der globale Fastify-Body
    }
  });

  it("H2: Malformed/encoded (..%2f, /%61ddin/…) → statischer 404 + nosniff, nie global", async () => {
    process.env.KLARWERK_ADDON_API = "1";
    const app = buildApp(buildServices());
    for (const url of [
      "/addin/..%2fpackage.json",
      "/%61ddin/taskpane.html", // encoded "addin" — zählt zum Namensraum, ist aber kein Map-Treffer
      "/ADDIN/unbekannt.css",
    ]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(404);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.body).toBe(STATIC_404);
      expect(res.body).not.toContain("Route "); // kein globaler Fastify-404
      expect(res.body).not.toContain("package.json"); // kein Pfad-Echo
    }
  });

  it("H2: %2e%2e-Dot-Segmente — Namensraum-Klassifikation greift auf dem ROH-Pfad (unit)", () => {
    // light-my-request/inject löst Dot-Segmente VORAB clientseitig auf (s. R3-Doku in addon-principal):
    // "/addin/%2e%2e/x" erreicht den Server via inject als "/x" — dort ist der globale 404 korrekt
    // (außerhalb des Namensraums). In PRODUKTION kommt der Roh-Pfad unnormalisiert an (request.raw.url);
    // diese Unit-Pinnung belegt, dass der Hook ihn dann als /addin-Namensraum fängt (→ statischer 404).
    expect(isAddinNamespacePath("/addin/%2e%2e/package.json")).toBe(true);
    expect(isAddinNamespacePath("/ADDIN/%2e%2e/x")).toBe(true);
    expect(isAddinNamespacePath("/addin/..%2fpackage.json")).toBe(true);
    expect(isAddinNamespacePath("/%61ddin/taskpane.html")).toBe(true);
    expect(isAddinNamespacePath("/addin?x=1")).toBe(true);
    // Kein neuer Weg: Nicht-/addin-Pfade bleiben unberührt.
    expect(isAddinNamespacePath("/api/ask")).toBe(false);
    expect(isAddinNamespacePath("/addinfoo")).toBe(false);
    expect(isAddinNamespacePath("/health")).toBe(false);
    expect(isAddinNamespacePath(undefined)).toBe(false);
  });

  it("H2: 200-Bundle-Treffer unverändert (Content-Type/nosniff/Bytes wie H)", async () => {
    process.env.KLARWERK_ADDON_API = "1";
    const app = buildApp(buildServices());
    const res = await app.inject({ method: "GET", url: "/addin/taskpane.html" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cache-control"]).toBe("public, max-age=300");
    expect(res.body).toContain("taskpane.js"); // echtes Bundle-HTML, unverändert ausgeliefert
  });

  it("H2: Flag OFF → /addin existiert nicht, keine Nicht-/addin-Route beeinflusst (kein Regress)", async () => {
    const app = buildApp(buildServices());
    // Flag OFF: Route/Hook nicht registriert → globaler 404 ist hier KORREKT (Pfad existiert nicht).
    expect((await app.inject({ method: "GET", url: "/addin/taskpane.html" })).statusCode).toBe(404);
    // Und mit Flag ON bleibt jede Nicht-/addin-Route vom Hook unberührt.
    process.env.KLARWERK_ADDON_API = "1";
    const on = buildApp(buildServices());
    const health = await on.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });
  });
});

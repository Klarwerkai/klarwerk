import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../build-app";

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
});

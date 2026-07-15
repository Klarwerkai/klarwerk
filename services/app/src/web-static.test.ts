import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isAssetRequest, registerWebStatic } from "./web-static";

// Stale-Static-Fix: Nach einem Frontend-Rebuild ohne Server-Neustart lieferte der laufende Prozess
// für neue Bundle-Hashes index.html (text/html) unter einem .js-Pfad aus → weiße Seite. Getestet:
// (1) Assets werden pro Anfrage dynamisch aufgelöst (auch NACH dem Start angelegte Dateien),
// (2) ein fehlendes /assets/*.js → echter 404, NICHT der index.html-Fallback,
// (3) unbekannte Navigationspfade → weiterhin index.html (Client-Routing).
describe("isAssetRequest", () => {
  it("erkennt Pfade mit Dateiendung als Asset", () => {
    expect(isAssetRequest("/assets/index-Ck7FJVCZ.js")).toBe(true);
    expect(isAssetRequest("/assets/index-B_R3UzRr.css")).toBe(true);
    expect(isAssetRequest("/assets/font-latin.woff2")).toBe(true);
    expect(isAssetRequest("/assets/index-D14aYwQS.js.map")).toBe(true);
    expect(isAssetRequest("/assets/app.js?v=123")).toBe(true);
  });

  it("behandelt Navigationspfade (ohne Dateiendung) nicht als Asset", () => {
    expect(isAssetRequest("/")).toBe(false);
    expect(isAssetRequest("/start")).toBe(false);
    expect(isAssetRequest("/import")).toBe(false);
    expect(isAssetRequest("/konflikte/123/vergleich")).toBe(false);
    expect(isAssetRequest("/duplikate/abc/vergleich?tab=1")).toBe(false);
  });
});

describe("registerWebStatic (HTTP-Ebene)", () => {
  let dir: string;
  let app: FastifyInstance;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "kw-web-static-"));
    mkdirSync(join(dir, "assets"));
    // Erkennbarer index.html-Marker, um SPA-Fallback von einem 404 zu unterscheiden.
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>KW-SPA-MARKER</title>");
    writeFileSync(join(dir, "assets", "app.js"), "export const answer = 42;\n");
    app = Fastify();
    await registerWebStatic(app, dir);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("liefert ein existierendes JS-Asset mit JS-Content-Type (kein HTML)", async () => {
    const res = await app.inject({ method: "GET", url: "/assets/app.js" });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers["content-type"])).toMatch(/javascript/);
    expect(String(res.headers["content-type"])).not.toMatch(/text\/html/);
    expect(res.body).toContain("export const answer");
  });

  it("REGRESSION: fehlendes /assets/*.js → 404, NICHT der index.html-Fallback", async () => {
    const res = await app.inject({ method: "GET", url: "/assets/does-not-exist.js" });
    expect(res.statusCode).toBe(404);
    expect(String(res.headers["content-type"] ?? "")).not.toMatch(/text\/html/);
    expect(res.body).not.toContain("KW-SPA-MARKER");
  });

  it("SPA-Fallback: unbekannter Navigationspfad → index.html (200, text/html)", async () => {
    const res = await app.inject({ method: "GET", url: "/konflikte/123/vergleich" });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers["content-type"])).toMatch(/text\/html/);
    expect(res.body).toContain("KW-SPA-MARKER");
  });

  it("API-404 bleibt strukturiertes JSON (kein SPA-HTML)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/gibt-es-nicht" });
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain("NOT_FOUND");
    expect(res.body).not.toContain("KW-SPA-MARKER");
  });

  it("Rebuild ohne Neustart: ein NACH dem Start angelegtes Asset wird ausgeliefert", async () => {
    // Genau der Stale-Static-Fall: neuer Bundle-Hash entsteht, ohne dass der Server neu startet.
    writeFileSync(join(dir, "assets", "late-bundle-Xyz123.js"), "export const late = true;\n");
    const res = await app.inject({ method: "GET", url: "/assets/late-bundle-Xyz123.js" });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers["content-type"])).toMatch(/javascript/);
    expect(res.body).toContain("export const late");
  });
});

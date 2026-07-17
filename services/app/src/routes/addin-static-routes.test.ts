import net from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../build-app";
import { isAddinNamespacePath } from "./addin-static-routes";

// SCRUM-490 H: statisches Serving des Add-in-Bundles unter /addin/* — nur bei aktivem KLARWERK_ADDON_API,
// traversal-sicher (explizite Datei-Map), kein Directory-Listing.

const SAVED: Record<string, string | undefined> = {};
const KEYS = [
  "KLARWERK_ADDON_API",
  "KLARWERK_ADDON_ORIGIN",
  "KLARWERK_ADDON_API_KEY",
  "KLARWERK_ADDON_AUTH_MAX",
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

// SCRUM-490 H3 (bens Punkt 5): ROHSOCKET-Tests — inject() normalisiert URLs clientseitig zu früh; nur
// ein echter Socket transportiert die unveränderten Trick-Pfade (Malformed, doppelt-encoded, Backslash,
// Semikolon) bis zum Server. Der Server lauscht auf 127.0.0.1:0 (ephemeral).
describe("SCRUM-490 H3: Rohsocket — negative /addin-Antwortfläche vollständig statisch", () => {
  const STATIC_404 = JSON.stringify({ error: "NOT_FOUND", message: "Nicht gefunden." });

  async function withListeningApp(
    fn: (rawGet: (pathLine: string, method?: string) => Promise<string>) => Promise<void>,
  ): Promise<void> {
    process.env.KLARWERK_ADDON_API = "1";
    const app = buildApp(buildServices());
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const rawGet = (pathLine: string, method = "GET"): Promise<string> =>
      new Promise((resolve, reject) => {
        const sock = net.connect(port, "127.0.0.1", () => {
          sock.write(`${method} ${pathLine} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`);
        });
        let buf = "";
        sock.on("data", (d) => {
          buf += d.toString();
        });
        sock.on("end", () => resolve(buf));
        sock.on("error", reject);
      });
    try {
      await fn(rawGet);
    } finally {
      await app.close();
    }
  }

  it("Malformed/encoded/Backslash/Semikolon → nosniff + statischer Body, kein Echo, nie global (7 Pfade)", async () => {
    await withListeningApp(async (rawGet) => {
      const cases = [
        "/addin/%c0%ae%c0%ae/x", // overlong-encoded dots → FST_ERR_BAD_URL-Kandidat
        "/addin/%E0%A4%A", // truncated UTF-8-Sequenz → nicht dekodierbar
        "/%2561ddin/taskpane.html", // doppelt encoded "a"
        "/%2541DDIN/x", // doppelt encoded "A" + Case
        "/addin%252Ftaskpane.html", // doppelt encodeter Slash
        "/addin\\foo", // Backslash-Variante
        "/addin;v=1/taskpane.html", // Semikolon-Segment-Parameter
      ];
      for (const p of cases) {
        const res = await rawGet(p);
        const statusLine = res.split("\r\n")[0] ?? "";
        const body = res.split("\r\n\r\n")[1] ?? "";
        expect(statusLine).toContain("404"); // konsistent 404 (dokumentierter Entscheid, auch für Malformed)
        expect(res.toLowerCase()).toContain("x-content-type-options: nosniff");
        expect(body).toBe(STATIC_404); // exakt statisch …
        expect(body).not.toContain("Route "); // … nie der globale Fastify-Body
        expect(body).not.toContain("Bad Request"); // … nie das FST_ERR_BAD_URL-Echo
        expect(body).not.toContain("taskpane"); // … kein Pfad-Echo
      }
    });
  });

  it("Rohsocket-Gegenprobe: GET Map-Treffer → 200 + nosniff (200-Pfad unverändert)", async () => {
    await withListeningApp(async (rawGet) => {
      const res = await rawGet("/addin/taskpane.html");
      expect(res.split("\r\n")[0]).toContain("200");
      expect(res.toLowerCase()).toContain("x-content-type-options: nosniff");
      expect(res).toContain("taskpane.js"); // echtes Bundle-HTML
    });
  });

  it("Rohsocket: Nicht-Namensraum-Malformed (/%E0%A4%A ohne /addin) bleibt globale Fläche (unberührt)", async () => {
    await withListeningApp(async (rawGet) => {
      const res = await rawGet("/%E0%A4%A");
      // Kein /addin-Namensraum → NICHT unsere Fläche; Fastifys globales Verhalten bleibt bit-identisch.
      expect(res.split("\r\n")[0]).toContain("400");
    });
  });
});

describe("SCRUM-490 H3: Methoden + Auth auf der /addin-Fläche", () => {
  const STATIC_404 = JSON.stringify({ error: "NOT_FOUND", message: "Nicht gefunden." });

  it("Nicht-GET/HEAD (POST/PUT/DELETE/PATCH/OPTIONS) → statischer 404 + nosniff, kein Methoden-Echo", async () => {
    process.env.KLARWERK_ADDON_API = "1";
    const app = buildApp(buildServices());
    for (const method of ["POST", "PUT", "DELETE", "PATCH", "OPTIONS"] as const) {
      for (const url of ["/addin/taskpane.html", "/addin/unbekannt.js"]) {
        const res = await app.inject({ method, url });
        expect(res.statusCode).toBe(404); // 404 statt 405: Einheitlichkeit > HTTP-Purismus (kein Orakel)
        expect(res.headers["x-content-type-options"]).toBe("nosniff");
        expect(res.body).toBe(STATIC_404);
        expect(res.body).not.toContain(method); // kein Methoden-Echo
      }
    }
    // GET/HEAD auf Map-Treffer bleiben 200 (Bytes/Header wie H).
    const get = await app.inject({ method: "GET", url: "/addin/taskpane.css" });
    expect(get.statusCode).toBe(200);
    expect(get.headers["content-type"]).toContain("text/css");
    const head = await app.inject({ method: "HEAD", url: "/addin/taskpane.css" });
    expect(head.statusCode).toBe(200);
  });

  it("Auth: falscher Key auf GET /addin → 401 (Body/Semantik unverändert) + nosniff; 429 ebenso; keyloser GET danach 200", async () => {
    process.env.KLARWERK_ADDON_API = "1";
    process.env.KLARWERK_ADDON_API_KEY = "s3cr3t";
    process.env.KLARWERK_ADDON_AUTH_MAX = "1";
    const app = buildApp(buildServices());
    // 1. falscher Key → 401, Body wie bisher (UNAUTHENTICATED), plus nosniff (H3-Punkt 4).
    const unauth = await app.inject({
      method: "GET",
      url: "/addin/taskpane.html",
      headers: { "x-klarwerk-addon-key": "falsch" },
    });
    expect(unauth.statusCode).toBe(401);
    expect(unauth.json().error).toBe("UNAUTHENTICATED"); // Semantik/Body unverändert
    expect(unauth.headers["x-content-type-options"]).toBe("nosniff");
    // 2. weiterer falscher Key → 429 (Throttle heilig: Verhalten unverändert) + nosniff.
    const throttled = await app.inject({
      method: "GET",
      url: "/addin/taskpane.html",
      headers: { "x-klarwerk-addon-key": "falsch" },
    });
    expect(throttled.statusCode).toBe(429);
    expect(throttled.headers["retry-after"]).toBeDefined();
    expect(throttled.headers["x-content-type-options"]).toBe("nosniff");
    // 3. keyloser GET (anderer, unauffälliger Client-Pfad) → weiterhin 200.
    const ok = await app.inject({ method: "GET", url: "/addin/taskpane.html" });
    expect(ok.statusCode).toBe(200);
  });
});

describe("SCRUM-490 H3: Klassifizierer-Pins (gehärtet)", () => {
  it("erkennt doppelt-encoded, Backslash, Semikolon, Decode-Fehler-Rohpräfix", () => {
    for (const p of [
      "/%2561ddin/taskpane.html",
      "/%2541DDIN/x",
      "/addin%252Ftaskpane.html",
      "/addin\\foo",
      "/addin;v=1/taskpane.html",
      "/addin/%c0%ae",
      "/addin/%E0%A4%A",
      "/ADDIN/%2e%2e/x",
      "/addin",
      "/addin/",
    ]) {
      expect(isAddinNamespacePath(p)).toBe(true);
    }
  });

  it("Negativ-Pins: /addinfoo, /addin-x, /api/ask, /health, / → NIEMALS Namensraum", () => {
    for (const p of ["/addinfoo", "/addin-x", "/api/ask", "/health", "/", "", undefined]) {
      expect(isAddinNamespacePath(p)).toBe(false);
    }
  });
});

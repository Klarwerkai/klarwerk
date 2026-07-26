import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  UPGRADE_INSECURE_REQUESTS,
  WORD_ADDIN_CSP,
  registerSecurityHeaders,
  withUpgradeInsecureRequests,
} from "../../services/app/src/security-headers";

// AUFTRAG-mega15 Block C (bens SB-3) — `upgrade-insecure-requests` NUR auf echten HTTPS-Antworten.
//
// Der Befund kam aus der Browser-Sonde: WebKit rendert die App über plain HTTP überhaupt nicht
// (weiße Seite). Ursache ist nicht der Wächter, sondern die CSP-Direktive aus den helmet-Vorgaben.
// Chromium und Firefox nehmen 127.0.0.1 aus, WebKit nicht — es zieht jede gleich-origin
// Unterressource auf https, der Server spricht kein TLS, alles scheitert. Denselben Effekt hat ein
// Safari-Nutzer auf jeder ohne TLS ausgelieferten Instanz.
//
// Geprüft wird gegen die ECHTE Produktionsregistrierung (`registerSecurityHeaders`, exakt die
// Funktion, die server.ts verdrahtet — der Verdrahtungs-Pin liegt in sync-onsend-hooks.test.ts)
// über echte inject-Requests. Kein Quelltext-String-Pin, keine Test-Kopie.
//
// WICHTIG bei der Deutung der Belege: `app.inject` fährt über einen NICHT verschlüsselten Socket.
// Jede Antwort dieses Tests ist also eine HTTP-Antwort, solange nicht ein VERTRAUTER Proxy
// `X-Forwarded-Proto: https` meldet. Genau das ist der Fall, den ein Betreiber real hat — und
// genau die Auflage bens: Proxy-Signale ausschließlich über die gehärtete Trust-Proxy-Konfiguration.

type App = ReturnType<typeof buildApp>;

const ALT = process.env.KLARWERK_TRUST_PROXY;

afterEach(() => {
  if (ALT === undefined) {
    delete process.env.KLARWERK_TRUST_PROXY;
  } else {
    process.env.KLARWERK_TRUST_PROXY = ALT;
  }
});

// `resolveTrustProxy()` liest die Umgebung, wenn `buildApp` die Fastify-Instanz erzeugt
// (build-app.ts:573) — die Variable muss deshalb VOR dem Bau stehen.
async function appWithTrustProxy(trustProxy: string | undefined): Promise<App> {
  if (trustProxy === undefined) {
    delete process.env.KLARWERK_TRUST_PROXY;
  } else {
    process.env.KLARWERK_TRUST_PROXY = trustProxy;
  }
  const app = buildApp(buildServices());
  await registerSecurityHeaders(app);
  app.get("/word-addin/taskpane.html", async (_request, reply) =>
    reply.type("text/html").send("ok"),
  );
  return app;
}

function csp(res: { headers: Record<string, unknown> }): string {
  return String(res.headers["content-security-policy"] ?? "");
}

describe("Block C: die Direktive FEHLT auf jeder HTTP-Antwort", () => {
  it("ohne Proxy: weder auf der SPA-Wurzel noch auf der API noch auf 404", async () => {
    const app = await appWithTrustProxy(undefined);
    for (const url of ["/", "/api/auth/me", "/gibtesnicht"]) {
      const res = await app.inject({ method: "GET", url });
      const value = csp(res);
      // Die CSP steht — nur eben ohne diese eine Direktive.
      expect(value, url).toContain("default-src 'self'");
      expect(value, url).not.toContain(UPGRADE_INSECURE_REQUESTS);
    }
  });

  it("auch die Word-Taskpane-Ausnahme bleibt auf HTTP ohne die Direktive", async () => {
    const app = await appWithTrustProxy(undefined);
    const res = await app.inject({ method: "GET", url: "/word-addin/taskpane.html" });
    expect(csp(res)).toBe(WORD_ADDIN_CSP);
    expect(csp(res)).not.toContain(UPGRADE_INSECURE_REQUESTS);
  });

  it("die übrigen Sicherheits-Header bleiben unangetastet", async () => {
    const app = await appWithTrustProxy(undefined);
    const res = await app.inject({ method: "GET", url: "/" });
    expect(csp(res)).toContain("frame-ancestors 'none'");
    expect(csp(res)).toContain("object-src 'none'");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["strict-transport-security"]).toContain("max-age=31536000");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("Block C: die Direktive STEHT auf einer als HTTPS erkannten Antwort", () => {
  it("hinter einem VERTRAUTEN Proxy mit X-Forwarded-Proto: https", async () => {
    const app = await appWithTrustProxy("127.0.0.1");
    const res = await app.inject({
      method: "GET",
      url: "/",
      headers: { "x-forwarded-proto": "https" },
      remoteAddress: "127.0.0.1",
    });
    const value = csp(res);
    expect(value).toContain(UPGRADE_INSECURE_REQUESTS);
    // Sie kommt HINZU, sie ersetzt nichts.
    expect(value).toContain("default-src 'self'");
    expect(value).toContain("frame-ancestors 'none'");
  });

  it("auch auf der Word-Taskpane-Ausnahme — die Ausnahme verliert die Direktive nicht", async () => {
    const app = await appWithTrustProxy("127.0.0.1");
    const res = await app.inject({
      method: "GET",
      url: "/word-addin/taskpane.html",
      headers: { "x-forwarded-proto": "https" },
      remoteAddress: "127.0.0.1",
    });
    const value = csp(res);
    expect(value).toContain(UPGRADE_INSECURE_REQUESTS);
    expect(value).toContain(
      "frame-ancestors 'self' https://*.office.com https://*.officeapps.live.com",
    );
    expect(res.headers["x-frame-options"]).toBeUndefined();
  });

  it("derselbe vertraute Proxy mit X-Forwarded-Proto: http lässt sie weg", async () => {
    const app = await appWithTrustProxy("127.0.0.1");
    const res = await app.inject({
      method: "GET",
      url: "/",
      headers: { "x-forwarded-proto": "http" },
      remoteAddress: "127.0.0.1",
    });
    expect(csp(res)).not.toContain(UPGRADE_INSECURE_REQUESTS);
  });
});

describe("Block C: ein GEFÄLSCHTES Proxy-Signal ohne Vertrauensstellung greift NICHT", () => {
  it("ohne KLARWERK_TRUST_PROXY bewirkt X-Forwarded-Proto: https nichts", async () => {
    const app = await appWithTrustProxy(undefined);
    const res = await app.inject({
      method: "GET",
      url: "/",
      headers: { "x-forwarded-proto": "https" },
    });
    expect(csp(res)).not.toContain(UPGRADE_INSECURE_REQUESTS);
  });

  it("mit VERTRAUEN auf ein ANDERES Netz bewirkt der Header von hier ebenfalls nichts", async () => {
    // Vertraut wird nur 10.9.9.9; die inject-Gegenstelle ist 127.0.0.1 → kein Vertrauen.
    const app = await appWithTrustProxy("10.9.9.9");
    const res = await app.inject({
      method: "GET",
      url: "/",
      headers: { "x-forwarded-proto": "https" },
      remoteAddress: "127.0.0.1",
    });
    expect(csp(res)).not.toContain(UPGRADE_INSECURE_REQUESTS);
  });

  it("ein Blanket-Wert wird von resolveTrustProxy verworfen — auch dann greift der Header nicht", async () => {
    // `KLARWERK_TRUST_PROXY=true` / `*` / `0.0.0.0/0` sind seit SCRUM-490 R3 ungültig und ergeben
    // `false`. Der gefälschte Header bleibt damit wirkungslos.
    for (const blanket of ["true", "*", "0.0.0.0/0"]) {
      const app = await appWithTrustProxy(blanket);
      const res = await app.inject({
        method: "GET",
        url: "/",
        headers: { "x-forwarded-proto": "https" },
        remoteAddress: "127.0.0.1",
      });
      expect(csp(res), blanket).not.toContain(UPGRADE_INSECURE_REQUESTS);
    }
  });
});

describe("Block C: withUpgradeInsecureRequests — hängt genau einmal an", () => {
  it("hängt an eine bestehende CSP an", () => {
    expect(withUpgradeInsecureRequests("default-src 'self'")).toBe(
      "default-src 'self'; upgrade-insecure-requests",
    );
  });

  it("verdoppelt nicht", () => {
    const einmal = withUpgradeInsecureRequests("default-src 'self'");
    expect(withUpgradeInsecureRequests(einmal)).toBe(einmal);
    expect(withUpgradeInsecureRequests("upgrade-insecure-requests")).toBe(
      "upgrade-insecure-requests",
    );
  });

  it("erfindet keine CSP, wo keine ist", () => {
    expect(withUpgradeInsecureRequests("")).toBe("");
    expect(withUpgradeInsecureRequests("   ")).toBe("   ");
  });

  it("verträgt ein abschließendes Semikolon", () => {
    expect(withUpgradeInsecureRequests("default-src 'self';")).toBe(
      "default-src 'self'; upgrade-insecure-requests",
    );
  });
});

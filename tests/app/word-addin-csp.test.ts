// WP-KLARA-1b (bens ROT-Fix K1/K2): die Word-Add-in-CSP-Ausnahme wird als ECHTES HTTP-VERHALTEN
// getestet — reale App (buildApp) + reale Produktionsregistrierung (registerSecurityHeaders, exakt die
// Funktion, die server.ts verdrahtet; der Verdrahtungs-Pin liegt in sync-onsend-hooks.test.ts) + echte
// inject-Requests. Ersetzt den früheren Quelltext-String-Pin („startsWith('/word-addin/')" als Text),
// der den unsicheren Prefix-Ansatz sogar festschrieb.
//
// K1-Vertrag: die Ausnahme gilt NUR für die exakt ausgelieferten kanonischen Pfade (Taskpane + die
// beiden Icons), exakter String-Vergleich auf den query-gestrippten Pfad. Präfix-/Traversal-/
// Encoding-Varianten fallen fail-closed in die strikte globale CSP (frame-ancestors 'none' +
// X-Frame-Options).
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  WORD_ADDIN_CSP,
  WORD_ADDIN_CSP_PATHS,
  isWordAddinCspPath,
  registerSecurityHeaders,
} from "../../services/app/src/security-headers";

type App = ReturnType<typeof buildApp>;

async function buildRealApp(): Promise<App> {
  const app = buildApp(buildServices());
  // EXAKT die Produktionsregistrierung (helmet-Global-CSP + Word-Add-in-Ausnahmen-Hook).
  await registerSecurityHeaders(app);
  // Stellvertreter für die statische Auslieferung (registerWebStatic braucht das gebaute dist):
  // die drei kanonischen Dateien antworten 200 — die Header kommen NICHT aus diesen Routen, sondern
  // aus helmet + dem onSend-Hook der Produktionsfunktion.
  for (const path of WORD_ADDIN_CSP_PATHS) {
    app.get(path, async (_request, reply) =>
      reply.type(path.endsWith(".html") ? "text/html" : "image/png").send("ok"),
    );
  }
  return app;
}

describe("WP-KLARA-1b K1: Header-Matrix gegen die reale Registrierung (inject)", () => {
  let app: App;
  beforeAll(async () => {
    app = await buildRealApp();
  });

  it("(a) kanonische Taskpane-/Icon-Pfade → Ersatz-CSP, KEIN X-Frame-Options", async () => {
    for (const path of WORD_ADDIN_CSP_PATHS) {
      const res = await app.inject({ method: "GET", url: path });
      expect(res.statusCode, path).toBe(200);
      expect(res.headers["content-security-policy"], path).toBe(WORD_ADDIN_CSP);
      expect(res.headers["x-frame-options"], path).toBeUndefined();
    }
  });

  it("(b) Query-String ändert den Scope nicht: /word-addin/taskpane.html?x=1 → Ersatz-CSP", async () => {
    const res = await app.inject({ method: "GET", url: "/word-addin/taskpane.html?x=1&y=2" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-security-policy"]).toBe(WORD_ADDIN_CSP);
    expect(res.headers["x-frame-options"]).toBeUndefined();
  });

  it("(c) Präfix-/Traversal-/API-/Root-Pfade → globale CSP (frame-ancestors 'none') + X-Frame-Options", async () => {
    for (const url of [
      "/word-addinX/evil.html",
      "/word-addin/../index.html",
      "/api/auth/me",
      "/",
    ]) {
      const res = await app.inject({ method: "GET", url });
      const csp = String(res.headers["content-security-policy"] ?? "");
      expect(csp, url).toContain("frame-ancestors 'none'");
      expect(csp, url).not.toContain("office.com");
      expect(res.headers["x-frame-options"], url).toBeDefined();
    }
  });

  it("(d) nicht existenter /word-addin/foo.html (404) fällt NICHT in die Ausnahme → globale CSP", async () => {
    const res = await app.inject({ method: "GET", url: "/word-addin/foo.html" });
    expect(res.statusCode).toBe(404);
    const csp = String(res.headers["content-security-policy"] ?? "");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });
});

// Die reine Pfad-Entscheidung zusätzlich als Unit-Matrix — deckt Varianten ab, die ein HTTP-Client
// vorab normalisieren würde (inject/Browser lösen z. B. „..“ teils clientseitig auf; der Hook muss
// TROTZDEM exakt bleiben, falls ein Rohsocket sie durchreicht).
describe("WP-KLARA-1b K1: isWordAddinCspPath — exakter Vergleich, fail-closed", () => {
  it("nur die kanonischen Pfade matchen (Query/Fragment gestrippt)", () => {
    expect(isWordAddinCspPath("/word-addin/taskpane.html")).toBe(true);
    expect(isWordAddinCspPath("/word-addin/taskpane.html?x=1")).toBe(true);
    expect(isWordAddinCspPath("/word-addin/taskpane.html#frag")).toBe(true);
    expect(isWordAddinCspPath("/word-addin/icon-32.png")).toBe(true);
    expect(isWordAddinCspPath("/word-addin/icon-80.png")).toBe(true);
  });

  it("Präfix-Tricks, Traversal, Encoding, Casing, Slashes → false (globale CSP)", () => {
    for (const bad of [
      "/word-addinX/taskpane.html",
      "/word-addin/../index.html",
      "/word-addin/../word-addin/taskpane.html",
      "//word-addin/taskpane.html",
      "/word-addin//taskpane.html",
      "/word-addin/taskpane.html/",
      "/Word-Addin/taskpane.html",
      "/word-addin/TASKPANE.HTML",
      "/word-addin/taskpane%2Ehtml",
      "/word-addin%2Ftaskpane.html",
      "/word-addin/taskpane.html%00",
      "/word-addin/",
      "/word-addin",
      "/word-addin/foo.html",
      "",
      undefined,
    ]) {
      expect(isWordAddinCspPath(bad), String(bad)).toBe(false);
    }
  });
});

// K2: die endgültige frame-ancestors-Liste — eng und belegt (Office-Web-Hosts laut Microsoft-Doku),
// KEINE Plattformfamilien.
describe("WP-KLARA-1b K2: frame-ancestors eng und belegt", () => {
  it("genau 'self' + *.office.com + *.officeapps.live.com; KEIN *.live.com, KEIN *.microsoft.com", () => {
    const fa = WORD_ADDIN_CSP.split("; ").find((d) => d.startsWith("frame-ancestors "));
    expect(fa).toBe("frame-ancestors 'self' https://*.office.com https://*.officeapps.live.com");
    expect(WORD_ADDIN_CSP).not.toContain("*.live.com");
    expect(WORD_ADDIN_CSP).not.toContain("*.microsoft.com");
  });
});

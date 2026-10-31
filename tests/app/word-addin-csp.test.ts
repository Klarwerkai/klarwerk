// WP-KLARA-1b (bens ROT-Fix K1/K2): die Word-Add-in-CSP-Ausnahme wird als ECHTES HTTP-VERHALTEN
// getestet — reale App (buildApp) + reale Produktionsregistrierung (registerSecurityHeaders, exakt die
// Funktion, die server.ts verdrahtet; der Verdrahtungs-Pin liegt in sync-onsend-hooks.test.ts) + echte
// inject-Requests. Ersetzt den früheren Quelltext-String-Pin („startsWith('/word-addin/')" als Text),
// der den unsicheren Prefix-Ansatz sogar festschrieb.
//
// K1-Vertrag: die Ausnahme gilt NUR für den exakt ausgelieferten kanonischen Taskpane-Pfad (WP-D10b:
// die beiden Icons brauchen als statische Bilder KEINE Ausnahme mehr), exakter String-Vergleich auf den
// query-gestrippten Pfad. Präfix-/Traversal-/Encoding-Varianten UND die Icons fallen fail-closed in die
// strikte globale CSP (frame-ancestors 'none' + X-Frame-Options).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  WORD_ADDIN_CSP,
  WORD_ADDIN_CSP_PATHS,
  isWordAddinCspPath,
  registerSecurityHeaders,
} from "../../services/app/src/security-headers";
import { panelQuelleAus } from "../support/panelquelle";

type App = ReturnType<typeof buildApp>;

async function buildRealApp(env: NodeJS.ProcessEnv = {}): Promise<App> {
  const app = buildApp(buildServices());
  // EXAKT die Produktionsregistrierung (helmet-Global-CSP + Word-Add-in-Ausnahmen-Hook).
  await registerSecurityHeaders(app, env);
  // Stellvertreter für die statische Auslieferung (registerWebStatic braucht das gebaute dist):
  // Taskpane + Icons antworten 200 — die Header kommen NICHT aus diesen Routen, sondern aus helmet +
  // dem onSend-Hook der Produktionsfunktion.
  for (const path of WORD_ADDIN_CSP_PATHS) {
    app.get(path, async (_request, reply) => reply.type("text/html").send("ok"));
  }
  // WP-D10b: die Icons werden weiterhin ausgeliefert, tragen aber die GLOBALE CSP (keine Ausnahme).
  for (const icon of ICON_PATHS) {
    app.get(icon, async (_request, reply) => reply.type("image/png").send("ok"));
  }
  return app;
}

// WP-D10b: real ausgelieferte statische Bilder OHNE CSP-Ausnahme (bens Hinweis — keine Einbettung).
const ICON_PATHS = ["/word-addin/icon-32.png", "/word-addin/icon-80.png"];

describe("WP-KLARA-1b K1: Header-Matrix gegen die reale Registrierung (inject)", () => {
  let app: App;
  beforeAll(async () => {
    app = await buildRealApp();
  });

  it("(a) NUR die kanonischen Add-in-Seiten → Ersatz-CSP, KEIN X-Frame-Options", async () => {
    // WP-D10b: die kanonische Menge ist bewusst eng — die Icons stehen ausdruecklich NICHT darin.
    // Taskpane, Anmeldedialog und die bereits ausgelieferte Begleitseite laden office.js.
    // Die genaue Dreiermenge bleibt gepinnt; Icons und Pfadvarianten bleiben ausgeschlossen.
    expect(WORD_ADDIN_CSP_PATHS).toEqual([
      "/word-addin/taskpane.html",
      "/word-addin/anmeldung.html",
      "/word-addin/begleitung.html",
    ]);
    for (const path of WORD_ADDIN_CSP_PATHS) {
      const res = await app.inject({ method: "GET", url: path });
      expect(res.statusCode, path).toBe(200);
      expect(res.headers["content-security-policy"], path).toBe(WORD_ADDIN_CSP);
      expect(res.headers["x-frame-options"], path).toBeUndefined();
    }
  });

  it("(a2, WP-D10b) die Icons werden ausgeliefert, aber MIT globaler CSP (keine Ausnahme noetig)", async () => {
    for (const icon of ICON_PATHS) {
      const res = await app.inject({ method: "GET", url: icon });
      expect(res.statusCode, icon).toBe(200);
      const csp = String(res.headers["content-security-policy"] ?? "");
      expect(csp, icon).toContain("frame-ancestors 'none'");
      expect(csp, icon).not.toContain("office.com");
      expect(res.headers["x-frame-options"], icon).toBeDefined();
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
    // JOB 4076: die Dialogseite der Office-Web-Anmeldung — derselbe exakte Vergleich, keine
    // Aufweichung zu einem Praefix.
    expect(isWordAddinCspPath("/word-addin/anmeldung.html")).toBe(true);
    expect(isWordAddinCspPath("/word-addin/anmeldung.html?v=1")).toBe(true);
    expect(isWordAddinCspPath("/word-addin/anmeldung.html#frag")).toBe(true);
    expect(isWordAddinCspPath("/word-addin/begleitung.html")).toBe(true);
    expect(isWordAddinCspPath("/word-addin/begleitung.html?v=1")).toBe(true);
    expect(isWordAddinCspPath("/word-addin/begleitung.html#frag")).toBe(true);
  });

  it("Präfix-Tricks, Traversal, Encoding, Casing, Slashes, Icons → false (globale CSP)", () => {
    for (const bad of [
      // WP-D10b: die Icons sind bewusst KEINE Ausnahme mehr (statische Bilder).
      "/word-addin/icon-32.png",
      "/word-addin/icon-80.png",
      "/word-addinX/taskpane.html",
      "/word-addin/../index.html",
      "/word-addin/../word-addin/taskpane.html",
      "//word-addin/taskpane.html",
      "/word-addin//taskpane.html",
      "/word-addin/taskpane.html/",
      // JOB 4076: die zweite Seite weicht die Pruefung NICHT auf — dieselben Varianten fallen.
      "/word-addin/anmeldung.html/",
      "/word-addin/anmeldung.htmlx",
      "/word-addinX/anmeldung.html",
      "/word-addin/ANMELDUNG.HTML",
      "/word-addin/anmeldung.html%00",
      "/word-addin/begleitung.html/",
      "/word-addin/begleitung.htmlx",
      "/word-addinX/begleitung.html",
      "/word-addin/BEGLEITUNG.HTML",
      "/word-addin/begleitung%2Ehtml",
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

// ================================================================================================
// AUFTRAG-JOB507-D4 — DIE CSP MUSS ZU DEM PASSEN, WAS DAS PANEL WIRKLICH TUT.
// ================================================================================================
//
// Die Header-Matrix oben beweist, WELCHE Antwort die Ersatz-CSP bekommt. Sie sagt nichts darueber,
// ob diese CSP das Panel ueberhaupt arbeiten laesst. Genau diese Luecke ist praktisch relevant
// geworden: mit den sichtbaren Zustaenden fuer 413/429/403 haengen jetzt fuenf verschiedene
// same-origin-Abrufe an der Oberflaeche (/api/auth/me, /api/reasoner/status, /api/ask, /api/kos/:id,
// /api/drafts). Waere einer davon absolut auf eine fremde Herkunft gezogen, blockierte
// `connect-src 'self'` ihn stillschweigend — der Nutzer saehe nur „nicht erreichbar".
//
// Dieser Test liest die Abrufziele AUS DER AUSGELIEFERTEN SEITE und misst sie gegen die real
// ausgelieferte CSP. Er behauptet nichts ueber Hosts, er zaehlt nach.
const TASKPANE_FILE = "apps/web/public/word-addin/taskpane.html";

/** Das Fenster als EIN Dokument (seit R-1611 aus taskpane.html/.css/.js zusammengefügt). */
function taskpaneSource(): string {
  return panelQuelleAus(TASKPANE_FILE);
}

/** Die ausgelieferte HTML-Datei selbst — ihre Verweise sind das, was der Browser nachlädt. */
function ausgelieferteSeite(): string {
  return readFileSync(resolve(process.cwd(), TASKPANE_FILE), "utf8");
}

describe("AUFTRAG-JOB507-D4: CSP und Panelverhalten sind konsistent", () => {
  it("jedes Abrufziel des Panels ist same-origin (absoluter /api-Pfad) — passt zu connect-src 'self'", () => {
    const html = taskpaneSource();
    // Direkte Literalziele bleiben erfasst. performAsk wählt heute anhand der Sitzung
    // zwischen dem gebundenen Klara-Zugang und dem allgemeinen Frageweg; beide echten
    // Zweige müssen ausdrücklich erkannt und derselben Same-Origin-Prüfung unterzogen werden.
    const ziele = [...html.matchAll(/\bfetch(?:Fn)?\(\s*"([^"]+)"/g)].map((m) => m[1] ?? "");
    const fragewege = html.match(
      /fetchFn\(sitzung \? "([^"]+)" \+ encodeURIComponent\(sitzung\) \+ "\/execute" : "([^"]+)"/,
    );
    expect(fragewege?.slice(1)).toEqual(["/api/klara/sessions/", "/api/ask"]);
    ziele.push(fragewege?.[1] ?? "", fragewege?.[2] ?? "");
    // Kalibrierung: der Test darf nicht vakuoes werden, wenn der Abrufweg einmal umbenannt wird.
    expect(ziele.length).toBeGreaterThanOrEqual(5);
    for (const ziel of ziele) {
      expect(ziel, ziel).toMatch(/^\/api\//);
      expect(ziel, ziel).not.toMatch(/^https?:/);
    }
    // Die fuenf real benutzten Endpunkte sind wirklich dabei.
    for (const endpunkt of [
      "/api/auth/me",
      "/api/reasoner/status",
      "/api/ask",
      "/api/klara/sessions/",
      "/api/kos/",
      "/api/drafts",
    ]) {
      expect(
        ziele.some((ziel) => ziel.startsWith(endpunkt)),
        endpunkt,
      ).toBe(true);
    }
    expect(WORD_ADDIN_CSP).toContain("connect-src 'self'");
  });

  it("die einzige FREMDE Ressource ist office.js — und genau sie steht in script-src", () => {
    const html = taskpaneSource();
    const seite = ausgelieferteSeite();
    const externeScripts = [...seite.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1] ?? "");
    // Tatsächlich ausgelieferte Quellen: nur office.js ist fremd. Jede weitere Quelle
    // bleibt relativ und wird von der bestehenden self-Direktive gedeckt.
    expect(externeScripts).toEqual([
      "https://appsforoffice.microsoft.com/lib/1/hosted/office.js",
      "begriffe.js?v=__KW_FASSUNG__",
      "anleitung.js?v=__KW_FASSUNG__",
      "begleiter.js?v=__KW_FASSUNG__",
      "kalender.js?v=__KW_FASSUNG__",
      "lernziel.js?v=__KW_FASSUNG__",
      "vormachen.js?v=__KW_FASSUNG__",
      "rueckweg.js?v=__KW_FASSUNG__",
      "taskpane.js?v=__KW_FASSUNG__",
      "wortvergleich.js?v=__KW_FASSUNG__",
      "marke.js?v=__KW_FASSUNG__",
      "minimal-funktionen.js?v=__KW_FASSUNG__",
      "minimal.js?v=__KW_FASSUNG__",
      "minimal-taskpane.js?v=__KW_FASSUNG__",
    ]);
    const stilblaetter = [...seite.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(
      (m) => m[1] ?? "",
    );
    expect(stilblaetter).toEqual(["taskpane.css?v=__KW_FASSUNG__", "minimal.css?v=__KW_FASSUNG__"]);
    const fremde = [...externeScripts, ...stilblaetter].filter((s) => /^[a-z]+:|^\/\//.test(s));
    expect(fremde).toEqual(["https://appsforoffice.microsoft.com/lib/1/hosted/office.js"]);
    expect(WORD_ADDIN_CSP).toContain(
      "script-src 'self' 'unsafe-inline' https://appsforoffice.microsoft.com",
    );
    // Die ausgelieferte HTML-Datei trägt seit dem Schnitt KEIN Inline-Skript mehr — gemessen, nicht
    // behauptet. 'unsafe-inline' in script-src bleibt trotzdem stehen: dieselbe CSP gilt auch für
    // `anmeldung.html`, und eine CSP-Änderung ist kein Teil eines verhaltensgleichen Schnitts.
    expect(seite).not.toContain("<script>");
    // Inline-Styles (`style="…"`-Attribute im Markup) brauchen 'unsafe-inline' in style-src.
    expect(seite).toMatch(/\sstyle="/);
    expect(WORD_ADDIN_CSP).toContain("style-src 'self' 'unsafe-inline'");
    // Die eingesetzten Word-Bilder reisen als data:-URL (fillWordImages) → img-src muss data: tragen.
    expect(html).toContain('"data:" + mime + ";base64," + roh');
    expect(WORD_ADDIN_CSP).toContain("img-src 'self' data:");
  });

  it("die ausgelieferte Taskpane-Antwort traegt genau diese Erlaubnisse (echter Header, kein Quelltext-Pin)", async () => {
    const app = await buildRealApp();
    const res = await app.inject({ method: "GET", url: "/word-addin/taskpane.html" });
    expect(res.statusCode).toBe(200);
    const csp = String(res.headers["content-security-policy"] ?? "");
    for (const direktive of [
      "connect-src 'self'",
      "img-src 'self' data:",
      "script-src 'self' 'unsafe-inline' https://appsforoffice.microsoft.com",
    ]) {
      expect(csp, direktive).toContain(direktive);
    }
    // Fail-closed bleibt fail-closed: keine fremde Verbindungs- oder Objektfläche.
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("connect-src *");
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

// ADD-1: echte Headerregistrierung mit ausschließlich synthetischer Testkonfiguration.
describe("ADD-1: Mandanten-CSP der eingebetteten Word-Begleitung", () => {
  it("konfigurierter Mandant gilt für Taskpane und Begleitung; Dialog und andere Pfade bleiben eng", async () => {
    const app = await buildRealApp({ KLARWERK_M365_MANDANTEN: "add1-fiktiv" });
    try {
      const erwartet = `${WORD_ADDIN_CSP} https://add1-fiktiv.sharepoint.com https://add1-fiktiv-my.sharepoint.com`;
      for (const pfad of ["/word-addin/taskpane.html", "/word-addin/begleitung.html"]) {
        for (const zusatz of ["", "?host=word&x=1", "?host=word#fragment"]) {
          const url = pfad + zusatz;
          const res = await app.inject({ method: "GET", url });
          expect(res.statusCode, url).toBe(200);
          expect(res.headers["content-security-policy"], url).toBe(erwartet);
          expect(res.headers["x-frame-options"], url).toBeUndefined();
          expect(res.headers["cross-origin-opener-policy"], url).toBe("same-origin");
        }
      }
      for (const url of [
        "/word-addin/anmeldung.html",
        "/word-addin/anmeldung.html?host=word#dialog",
      ]) {
        const res = await app.inject({ method: "GET", url });
        expect(res.statusCode, url).toBe(200);
        expect(res.headers["content-security-policy"], url).toBe(WORD_ADDIN_CSP);
        expect(res.headers["x-frame-options"], url).toBeUndefined();
        expect(res.headers["cross-origin-opener-policy"], url).toBe("unsafe-none");
      }
      for (const url of [
        "/word-addin/begleitung.html/",
        "/word-addin/begleitung.htmlx",
        "/word-addinX/begleitung.html",
        "/word-addin/BEGLEITUNG.HTML",
        "/word-addin/begleitung%2Ehtml",
        "/word-addin/icon-32.png",
        "/word-addin/icon-80.png",
        "/api/auth/me",
        "/",
      ]) {
        const res = await app.inject({ method: "GET", url });
        const csp = String(res.headers["content-security-policy"] ?? "");
        expect(csp, url).toContain("frame-ancestors 'none'");
        expect(csp, url).not.toContain("sharepoint.com");
        expect(csp, url).not.toContain("office.com");
        expect(res.headers["x-frame-options"], url).toBeDefined();
        expect(res.headers["cross-origin-opener-policy"], url).toBe("same-origin");
      }
    } finally {
      await app.close();
    }
  });

  it("fehlende oder ungültige Mandanten erweitern weder Begleitung noch Taskpane", async () => {
    for (const env of [
      {},
      {
        KLARWERK_M365_MANDANTEN:
          "https://fiktiv.sharepoint.com,*.sharepoint.com,fiktiv/weg,fiktiv:443",
      },
    ]) {
      const app = await buildRealApp(env);
      try {
        for (const pfad of ["/word-addin/taskpane.html", "/word-addin/begleitung.html"]) {
          for (const zusatz of ["", "?host=word#fragment"]) {
            const url = pfad + zusatz;
            const res = await app.inject({ method: "GET", url });
            expect(res.statusCode, url).toBe(200);
            expect(res.headers["content-security-policy"], url).toBe(WORD_ADDIN_CSP);
            expect(res.headers["x-frame-options"], url).toBeUndefined();
            expect(res.headers["cross-origin-opener-policy"], url).toBe("same-origin");
          }
        }
      } finally {
        await app.close();
      }
    }
  });
});

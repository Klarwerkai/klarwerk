// ================================================================================================
// aufnahme:20260922:excel-erster-weg · KO-04-01 · AUSLIEFERUNG UND CSP DES OFFICE-FENSTERS
// ================================================================================================
//
// Am echten Server-Code (`registerWebStatic`, `registerSecurityHeaders`), mit echten
// inject-Anfragen:
//   A1  die Seite wird gestempelt ausgeliefert wie die Word-Seite (Fassung, no-cache, Validator)
//   A2  ihre Skripte werden je Abruf revalidiert; die Word-Seite bleibt unverändert
//   A3  fehlt sie im Build, scheitert der Pfad laut
//   C1  die Seite bekommt dieselbe Ersatz-CSP wie das Word-Taskpane (office.js, Einbettung durch
//       Excel/PowerPoint im Web, eingetragene Mandanten) — und NUR sie; der Rest bleibt strikt
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, describe, expect, it } from "vitest";
import {
  OFFICE_ADDIN_CSP_PATHS,
  WORD_ADDIN_CSP,
  WORD_ADDIN_CSP_PATHS,
  isOfficeAddinCspPath,
  isWordAddinCspPath,
  registerSecurityHeaders,
} from "../../services/app/src/security-headers";
import {
  KLARA_FASSUNG_KOPF,
  KLARA_OFFICE_TASKPANE_FASSUNG,
  KLARA_OFFICE_TASKPANE_PFAD,
  KLARA_TASKPANE_FASSUNG,
  KLARA_TASKPANE_PFAD,
  registerWebStatic,
} from "../../services/app/src/web-static";
import { lies } from "./buehne";

const aufraeumen: string[] = [];
const apps: FastifyInstance[] = [];

afterAll(async () => {
  for (const app of apps) {
    await app.close();
  }
  for (const dir of aufraeumen) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Ein dist-Abbild wie aus `vite build` — mit den WIRKLICHEN Dateien des Office-Fensters. */
function dist(mitOffice: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), "kw-office-addin-"));
  aufraeumen.push(dir);
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>SPA</title>");
  mkdirSync(join(dir, "word-addin"));
  writeFileSync(join(dir, "word-addin", "taskpane.html"), '<meta content="__KW_FASSUNG__">');
  if (mitOffice) {
    mkdirSync(join(dir, "office-addin"));
    for (const datei of ["taskpane.html", "hostkern.js", "taskpane.js", "taskpane.css"]) {
      writeFileSync(join(dir, "office-addin", datei), lies(datei));
    }
  }
  return dir;
}

async function auslieferung(mitOffice = true): Promise<FastifyInstance> {
  const app = Fastify();
  apps.push(app);
  await registerWebStatic(app, dist(mitOffice));
  return app;
}

describe("A · das Office-Fenster wird wie das Word-Fenster ausgeliefert", () => {
  it("A1 · gestempelt, no-cache, Validator über den gesendeten Körper", async () => {
    const app = await auslieferung();
    const res = await app.inject({ method: "GET", url: `${KLARA_OFFICE_TASKPANE_PFAD}?v=1` });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers["content-type"])).toContain("text/html");
    expect(res.headers[KLARA_FASSUNG_KOPF]).toBe(KLARA_OFFICE_TASKPANE_FASSUNG);
    expect(res.headers["cache-control"]).toBe("no-cache");
    expect(res.headers.etag).toMatch(/^"[0-9a-f]{32}"$/);
    expect(res.body).toContain(`hostkern.js?v=${KLARA_OFFICE_TASKPANE_FASSUNG}`);
    expect(res.body).not.toContain("__KW_FASSUNG__");
  });

  it("A2 · die Skripte werden je Abruf revalidiert; die Word-Seite behält ihre Fassung", async () => {
    const app = await auslieferung();
    const kern = await app.inject({ method: "GET", url: "/office-addin/hostkern.js?v=1.0.0.0" });
    expect(kern.statusCode).toBe(200);
    expect(kern.headers["cache-control"]).toBe("no-cache");
    expect(kern.body).toContain("KlaraOfficeHost");
    const word = await app.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    expect(word.statusCode).toBe(200);
    expect(word.headers[KLARA_FASSUNG_KOPF]).toBe(KLARA_TASKPANE_FASSUNG);
  });

  it("A3 · fehlt das Office-Fenster im Build, scheitert der Pfad laut — nie als SPA-HTML", async () => {
    const app = await auslieferung(false);
    const res = await app.inject({ method: "GET", url: KLARA_OFFICE_TASKPANE_PFAD });
    expect(res.statusCode).toBe(404);
    expect(String(res.headers["content-type"] ?? "")).not.toContain("text/html");
  });
});

async function kopfzeilen(env: NodeJS.ProcessEnv, url: string) {
  const app = Fastify();
  apps.push(app);
  await registerSecurityHeaders(app, env);
  const pfad = url.split("?")[0] ?? url;
  app.get(pfad, async (_request, reply) => reply.type("text/html").send("ok"));
  const res = await app.inject({ method: "GET", url });
  return {
    csp: String(res.headers["content-security-policy"] ?? ""),
    rahmen: res.headers["x-frame-options"],
  };
}

describe("C1 · die CSP-Ausnahme gilt für das Office-Fenster genau wie für das Word-Fenster", () => {
  it("ohne Mandanten: dieselbe Ersatz-CSP, kein X-Frame-Options", async () => {
    const office = await kopfzeilen({}, `${KLARA_OFFICE_TASKPANE_PFAD}?v=1.0.0.0`);
    expect(office.csp).toBe(WORD_ADDIN_CSP);
    expect(office.csp).toContain("https://appsforoffice.microsoft.com");
    expect(office.csp).toContain(
      "frame-ancestors 'self' https://*.office.com https://*.officeapps.live.com",
    );
    expect(office.rahmen).toBeUndefined();
  });

  it("eingetragene SharePoint-Mandanten gelten für beide Taskpanes gleich", async () => {
    const env = { KLARWERK_M365_MANDANTEN: "klarwerktest4711" };
    const office = await kopfzeilen(env, KLARA_OFFICE_TASKPANE_PFAD);
    const word = await kopfzeilen(env, KLARA_TASKPANE_PFAD);
    expect(office.csp).toBe(word.csp);
    expect(office.csp).toContain("klarwerktest4711");
  });

  it("Skripte und andere Pfade unter /office-addin behalten die strikte CSP", async () => {
    for (const url of ["/office-addin/hostkern.js", "/office-addin/anmeldung.html"]) {
      const kopf = await kopfzeilen({}, url);
      expect(kopf.csp, url).toContain("frame-ancestors 'none'");
      expect(kopf.rahmen, url).toBeDefined();
    }
  });

  it("die Office-Ausnahme ist exakt; die Word-Menge bleibt unverändert", () => {
    expect(OFFICE_ADDIN_CSP_PATHS).toEqual([KLARA_OFFICE_TASKPANE_PFAD]);
    expect(WORD_ADDIN_CSP_PATHS).toEqual([
      "/word-addin/taskpane.html",
      "/word-addin/anmeldung.html",
    ]);
    expect(isOfficeAddinCspPath("/office-addin/taskpane.html?v=1#x")).toBe(true);
    expect(isWordAddinCspPath(KLARA_OFFICE_TASKPANE_PFAD)).toBe(false);
    for (const falsch of [
      "/office-addin/",
      "/office-addin/taskpane.html/",
      "/office-addin/TASKPANE.HTML",
      "/office-addinX/taskpane.html",
      "/office-addin/../office-addin/taskpane.html",
      "//office-addin/taskpane.html",
      "/office-addin/taskpane%2Ehtml",
      "/office-addin/hostkern.js",
      "",
      undefined,
    ]) {
      expect(isOfficeAddinCspPath(falsch), String(falsch)).toBe(false);
    }
  });
});

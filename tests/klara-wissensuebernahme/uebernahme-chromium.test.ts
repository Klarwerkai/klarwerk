import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import { extname, resolve } from "node:path";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
let app: ReturnType<typeof buildApp>;
let server: Server;
let browser: Browser;
let origin = "";
let token = "";
let notizId = "";
const dist = resolve("apps/web/dist");
beforeAll(async () => {
  app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "F Browser", email: "browser@f.test", password: "synthetisch123" },
  });
  token = (
    await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "browser@f.test", password: "synthetisch123" },
    })
  ).json().token;
  server = createServer(async (req, res) => {
    try {
      const url = req.url ?? "/";
      if (url.startsWith("/api/")) {
        const chunks: Buffer[] = [];
        for await (const b of req) chunks.push(Buffer.from(b));
        const raw = Buffer.concat(chunks);
        const headers = { ...req.headers, authorization: `Bearer ${token}` };
        delete headers.host;
        const r = await app.inject({
          method: req.method as "GET",
          url,
          headers,
          ...(raw.length ? { payload: raw } : {}),
        });
        res.writeHead(r.statusCode, r.headers);
        res.end(r.rawPayload);
        return;
      }
      const pathname = new URL(url, "http://localhost").pathname;
      const p = resolve(dist, `.${pathname}`);
      const file =
        p.startsWith(`${dist}/`) && existsSync(p) && statSync(p).isFile()
          ? p
          : resolve(dist, "index.html");
      const mime: Record<string, string> = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
        ".png": "image/png",
      };
      res.writeHead(200, { "content-type": mime[extname(file)] ?? "application/octet-stream" });
      res.end(readFileSync(file));
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("Adresse fehlt");
  origin = `http://127.0.0.1:${addr.port}`;
  browser = await chromium.launch({ headless: true });
}, 60000);
afterAll(async () => {
  await browser?.close();
  await new Promise<void>((r) => server?.close(() => r()));
  await app?.close();
});
it("F08 · echter Browser: gewählter Chat → privates Original → Vorschau → bewusste gemeinsame Übernahme → Rücklink", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(10000);
  await page.goto(`${origin}/start`);
  await page.locator('[data-testid="klara-figur"]').click();
  await page.locator('[data-testid="klara-menue-knopf"]').click();
  await page.locator('[data-testid="klara-menue-funktionen"]').click();
  await page.locator('[data-testid="wissen-import"] summary').click();
  for (const [feld, wert] of Object.entries({
    titel: "F Browser Service",
    projekt: "Presse 4",
    abschnitt: "gewählter Chat / Antwort 1",
    fassung: "Exportfassung 1",
    text: "Ölstand nur bei stehender Presse prüfen.\nEmpfehlung: Pause.",
  })) {
    await page.locator(`[data-testid="wissen-import-${feld}"]`).fill(wert);
  }
  await page.locator('[data-testid="wissen-import-speichern"]').click();
  await page.locator('[data-testid="klara-notiz-offen"]').waitFor();
  notizId =
    (await page.locator('[data-testid="klara-notiz-offen"]').getAttribute("data-notiz")) ?? "";
  expect(notizId).not.toBe("");
  await page.locator('[data-testid="klara-wissen"] > button').click();
  await page.locator('[data-testid="wissen-stufe"]').selectOption("intern");
  await page.locator('[data-testid="wissen-kategorie"]').fill("Wartung");
  await page.locator('[data-testid="wissen-bedingungen"]').fill("Stillstand\nFachpersonal");
  await page.locator('[data-testid="wissen-vorschau"]').click();
  await page.locator('[data-testid="wissen-vorschau-inhalt"]').waitFor();
  expect(await page.locator('[data-testid="wissen-vorschau-inhalt"]').textContent()).toContain(
    "Ölstand",
  );
  await page.locator('[data-testid="wissen-uebernehmen"]').dblclick();
  await page.locator('[data-testid="wissen-ergebnis"]').waitFor();
  const href = await page.locator('[data-testid="wissen-ergebnis"] a').getAttribute("href");
  expect(href).toMatch(/^\/wissen\//);
  const list = await app.inject({
    method: "GET",
    url: "/api/kos",
    headers: { authorization: `Bearer ${token}` },
  });
  expect(list.statusCode, list.body).toBe(200);
  const r = await app.inject({
    method: "GET",
    url: `/api/me/klara/notizen/${notizId}`,
    headers: { authorization: `Bearer ${token}` },
  });
  expect(r.statusCode).toBe(200);
  mkdirSync(".local/klara-f", { recursive: true });
  await page.locator('[data-testid="wissen-ergebnis"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".local/klara-f/f08-browser.png", fullPage: true });
  writeFileSync(
    ".local/klara-f/f08-browser.json",
    JSON.stringify(
      {
        browser: browser.version(),
        origin,
        notizId,
        beitrag: href,
        synthetisch: true,
        foreground: false,
      },
      null,
      2,
    ),
  );
  await page.close();
}, 60000);

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import { extname, resolve } from "node:path";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { MediaAnalysisService } from "../../services/media";
import { liesPcmWav } from "../../services/media/src/wav-abschnitte";
import { pcmQuelle, markerAntwort } from "./segment-fixture";
let app: ReturnType<typeof buildApp>;
let server: Server;
let browser: Browser;
let origin = "";
let token = "";
let notizId = "";
const calls: number[] = [];
let ersterFehler = true;
const dist = resolve("apps/web/dist");
beforeAll(async () => {
  mkdirSync(".local/run/klara-f", { recursive: true });
  const services = buildServices();
  services.media = new MediaAnalysisService({
    objects: services.objects,
    transcriber: {
      name: "kontrollierter Browseradapter, kein ASR-Hörbeleg",
      lokal: true,
      transcribe: async () => {
        throw Error("kein Wechsel");
      },
      transcribeTimed: async (bytes) => {
        const m = liesPcmWav(bytes).daten.readInt16LE(0);
        calls.push(m);
        if (m === 200 && ersterFehler) {
          ersterFehler = false;
          throw Error("kontrollierter Teilfehler");
        }
        return markerAntwort(m);
      },
    },
  });
  app = buildApp(services);
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
  console.log(
    JSON.stringify({
      ressource: "F15-Segment-Chromium",
      ereignis: "begonnen",
      at: new Date().toISOString(),
    }),
  );
}, 60000);
afterAll(async () => {
  await browser?.close();
  console.log(
    JSON.stringify({
      ressource: "F15-Segment-Chromium",
      ereignis: "beendet",
      at: new Date().toISOString(),
    }),
  );
  await new Promise<void>((r) => server?.close(() => r()));
  await app?.close();
});
it("Segmentfortschritt: echter Browser behält Teilfassung über Fehler/Neuladen und setzt nur offenen Rest fort", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(10000);
  await page.goto(`${origin}/start`);
  await page.locator('[data-testid="klara-figur"]').click();
  await page.locator('[data-testid="klara-menue-knopf"]').click();
  await page.locator('[data-testid="klara-menue-funktionen"]').click();
  await page.locator('[data-testid="besprechung-import"] summary').click();
  await page.locator('[data-testid="besprechung-import-titel"]').fill("Browser Teilprobe");
  await page
    .locator('input[type="file"][accept="audio/*"]')
    .setInputFiles({ name: "marker.wav", mimeType: "audio/wav", buffer: pcmQuelle() });
  await page.locator('[data-testid="besprechung-berechtigt"]').check();
  await page.locator('[data-testid="besprechung-transkription"]').check();
  await page.locator('[data-testid="besprechung-segmentiert"]').check();
  await page.locator('[data-testid="besprechung-import-speichern"]').click();
  await page.getByText("Noch nicht verarbeitet", { exact: false }).waitFor();
  const headers = { authorization: `Bearer ${token}` };
  const ns = (await app.inject({ method: "GET", url: "/api/me/klara/notizen", headers })).json()
    .notizen;
  notizId = ns.find((n: { titel: string }) => n.titel === "Browser Teilprobe").id;
  await page.locator('[data-testid="besprechung-teil-fortsetzen"]').click();
  await page.getByText("Teilfassung gespeichert", { exact: false }).waitFor();
  expect(await page.locator('[data-testid="besprechung-teilstand"]').innerText()).toContain(
    "1 von 3",
  );
  await page.locator('[data-testid="besprechung-teil-fortsetzen"]').click();
  await page.getByText("Teilfehler – Rest offen", { exact: false }).waitFor();
  await page.screenshot({ path: ".local/run/klara-f/f15-segment-fehler.png", fullPage: true });
  await page.goto(`${origin}/start?notiz=${encodeURIComponent(notizId)}`);
  await page.getByText("Teilfehler – Rest offen", { exact: false }).waitFor();
  await page.locator('[data-testid="besprechung-teil-fortsetzen"]').click();
  await page.getByText("Teilfassung gespeichert", { exact: false }).waitFor();
  expect(await page.locator('[data-testid="besprechung-teilstand"]').innerText()).toContain(
    "2 von 3",
  );
  await page.locator('[data-testid="besprechung-teil-fortsetzen"]').click();
  await page.getByText("Alle Audioteile vollständig gespeichert", { exact: false }).waitFor();
  expect(await page.locator('[data-testid="besprechung-teilstand"]').innerText()).toContain(
    "3 von 3",
  );
  const n = (
    await app.inject({ method: "GET", url: `/api/me/klara/notizen/${notizId}`, headers })
  ).json().notiz;
  expect(n.wissensHerkunft.besprechung.segmente).toHaveLength(3);
  expect(calls).toEqual([100, 200, 200, 300]);
  await page.screenshot({
    path: ".local/run/klara-f/f15-segment-vollstaendig.png",
    fullPage: true,
  });
  writeFileSync(
    ".local/run/klara-f/f15-segment-browser.json",
    JSON.stringify(
      {
        notizId,
        fassung: n.fassung,
        aufrufe: calls,
        verarbeitung: n.wissensHerkunft.besprechung.verarbeitung,
        segmentIds: n.wissensHerkunft.besprechung.segmente.map((s: { id: string }) => s.id),
      },
      null,
      2,
    ),
  );
  await page.close();
}, 60000);

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
  mkdirSync(".local/run/klara-f", { recursive: true });
  await page.locator('[data-testid="wissen-ergebnis"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".local/run/klara-f/f08-browser.png", fullPage: true });
  writeFileSync(
    ".local/run/klara-f/f08-browser.json",
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

it("F15 · Browser importiert private Besprechungsnotiz und speichert bewusst Aufgabe/Übergabe über echte Produktwege", async () => {
  const headers = { authorization: `Bearer ${token}` };
  const basisquelle = await app.inject({
    method: "POST",
    url: "/api/me/klara/notizen",
    headers,
    payload: {
      vorgang: "f-browser-fristenregel",
      weg: "geschrieben",
      titel: "Fristenregel Browser",
      inhalt: "Keine Termine in dieser Notiz.",
      objektbezug: { pfad: "/kalender", seitenName: "Mein Kalender", objekt: "Fristenregel" },
    },
  });
  expect(basisquelle.statusCode, basisquelle.body).toBe(201);
  const regel = {
    aktiv: true,
    quellen: [{ art: "notiz", id: basisquelle.json().notiz.id }],
    arten: ["ablauf"],
    bereich: "persoenlich",
    zeitzone: "Europe/Berlin",
    aenderung: "klaeren",
    widerruf: "unzuverlaessig_ohne_vorlauf",
    wiederpruefung: "relevante_aenderung_klaeren",
    pruefstand: "aw19-sollbestand-1",
  };
  const konfig = await app.inject({
    method: "PUT",
    url: "/api/me/klara/fristen/regel",
    headers,
    payload: { regel, fassung: 0 },
  });
  expect(konfig.statusCode, konfig.body).toBe(200);
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(10000);
  await page.goto(`${origin}/start`);
  await page.locator('[data-testid="klara-figur"]').click();
  await page.locator('[data-testid="klara-menue-knopf"]').click();
  await page.locator('[data-testid="klara-menue-funktionen"]').click();
  await page.locator('[data-testid="besprechung-import"] summary').click();
  await page.locator('[data-testid="besprechung-import-titel"]').fill("F Browsermeeting");
  await page
    .locator('[data-testid="besprechung-import-text"]')
    .fill(
      "Beschluss: Testlauf durchführen.\nOffen: Vertragsstand klären.\nAufgabe: Lizenz prüfen.\nLizenz L-94: Ablaufdatum 2027-04-30.",
    );
  await page.locator('[data-testid="besprechung-berechtigt"]').check();
  await page.locator('[data-testid="besprechung-import-speichern"]').click();
  await page.locator('[data-testid="besprechung-auswertung"]').waitFor();
  await page.locator('[data-testid="besprechung-auswahl-zeile-4"]').check();
  await page.locator('[data-testid="besprechung-fristquelle"]').click();
  await page.getByText("Quelle gespeichert; aktive Regel angewendet.", { exact: false }).waitFor();
  expect(await page.locator('[data-testid="besprechung-friststand"]').innerText()).toContain(
    "2027-04-30",
  );
  const friststand = (
    await app.inject({ method: "GET", url: "/api/me/klara/fristen", headers })
  ).json();
  expect(friststand.regel).toMatchObject({
    ...regel,
    quellen: expect.arrayContaining(regel.quellen),
  });
  expect(friststand.regel.quellen).toHaveLength(2);
  expect(friststand.fristen).toHaveLength(1);
  await page.locator('[data-testid="besprechung-fristquelle"]').click();
  await page.locator('[data-testid="besprechung-fristquelle"]').waitFor({ state: "visible" });
  expect(
    (await app.inject({ method: "GET", url: "/api/me/kalender", headers }))
      .json()
      .eintraege.filter((e: { art: string }) => e.art === "frist"),
  ).toHaveLength(1);
  await page.screenshot({ path: ".local/run/klara-f/f15-fristen-browser.png", fullPage: true });
  await page.locator('[data-testid="besprechung-auswahl-zeile-4"]').uncheck();
  for (const id of ["zeile-1", "zeile-2", "zeile-3"])
    await page.locator(`[data-testid="besprechung-auswahl-${id}"]`).check();
  await page.locator('[data-testid="besprechung-eigene"]').check();
  await page.locator('[data-testid="besprechung-uebernehmen"]').click();
  await page.waitForFunction(
    `document.querySelector('[data-testid="klara-notiz-inhalt"]')?.value.includes("Transkriptfassung 1")`,
  );
  expect(await page.locator('[data-testid="klara-notiz-inhalt"]').inputValue()).toContain(
    "Transkriptfassung 1",
  );
  const p = await app.inject({
    method: "GET",
    url: "/api/me/klara/aufgaben",
    headers: { authorization: `Bearer ${token}` },
  });
  expect(p.body).toContain("Lizenz prüfen.");
  await page.locator('[data-testid="klara-notiz-offen"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".local/run/klara-f/f15-browser.png", fullPage: true });
  await page.close();
}, 60000);

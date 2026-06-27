#!/usr/bin/env node
/*
 * SCRUM-218 — Headless Browser-Smoke-light für Kernrouten.
 *
 * Zweck: prüft im echten Browser, dass die App nach Login + Demo-Seed lädt, die Kernrouten
 * erreichbar sind, kein globaler JS-Crash auftritt und ein App-Shell-Landmark sichtbar ist.
 * KEIN E2E-Framework, KEINE Pixel-Screenshots, KEINE externen Secrets.
 *
 * Voraussetzungen (lokal auszuführen — im CI/Sandbox ohne Browser nicht lauffähig):
 *   1) Backend starten (In-Memory, frische Instanz):
 *        PORT=3001 npm start
 *   2) Frontend starten (Dev-Server, Proxy /api → :3001):
 *        VITE_API_TARGET=http://localhost:3001 npm --prefix apps/web run dev
 *   3) Playwright + Chromium einmalig bereitstellen:
 *        npm i -D playwright && npx playwright install chromium
 *   4) Smoke ausführen:
 *        npm run smoke:browser
 *
 * Konfiguration via ENV:
 *   SMOKE_BASE_URL   (default http://localhost:5173)
 *   SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASS (default smoke-admin@klarwerk.local / smoke-pass-123)
 *
 * Exit-Code: 0 = alle Routen ok, 1 = mind. eine Route auffällig, 2 = Setup/Browser-Blocker.
 */

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5173";
const ADMIN = {
  name: "Smoke Admin",
  email: process.env.SMOKE_ADMIN_EMAIL ?? "smoke-admin@klarwerk.local",
  password: process.env.SMOKE_ADMIN_PASS ?? "smoke-pass-123",
};

// route, Shell-Landmark-Selector (nur sichtbar, wenn eingeloggt/Shell gerendert),
// optionaler erwarteter Textmarker im Body.
const ROUTES = [
  ["/start", null],
  ["/erfassen", null],
  ["/fragen", null],
  ["/bibliothek", null],
  ["/validierung", null],
  ["/aufgaben", null],
  ["/risiko", null],
  ["/lebenszyklus", "Wissensobjekte lesen"], // SCRUM-217/218: Lernpfad-Schritt sichtbar
  ["/admin", null],
  ["/kapital", null],
  ["/mobile", null], // SCRUM-222: Mobile-Ansicht lädt in der Shell (kein Crash)
];
const SHELL = 'a[href="/start"]';

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "[smoke] Playwright nicht installiert. Lokal: npm i -D playwright && npx playwright install chromium",
  );
  process.exit(2);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: BASE });
const api = context.request;

async function setup() {
  const status = await api.get("/api/auth/status");
  if (!status.ok()) {
    throw new Error(`/api/auth/status nicht erreichbar (${status.status()}). Läuft die App?`);
  }
  const { needsSetup } = await status.json();
  if (needsSetup) {
    const reg = await api.post("/api/auth/register", { data: ADMIN });
    if (!reg.ok()) throw new Error(`register fehlgeschlagen (${reg.status()})`);
  }
  const login = await api.post("/api/auth/login", {
    data: { email: ADMIN.email, password: ADMIN.password },
  });
  if (!login.ok()) {
    throw new Error(
      `login fehlgeschlagen (${login.status()}). Bitte gegen eine FRISCHE Instanz starten ` +
        "(In-Memory: PORT=3001 npm start neu), oder SMOKE_ADMIN_* an den vorhandenen Admin anpassen.",
    );
  }
  const seed = await api.post("/api/admin/demo-seed", { data: {} });
  if (!seed.ok()) throw new Error(`demo-seed fehlgeschlagen (${seed.status()})`);
  return await seed.json();
}

async function main() {
  let seedResult;
  try {
    seedResult = await setup();
  } catch (e) {
    console.error(`[smoke] Setup-Blocker: ${e.message}`);
    await browser.close();
    process.exit(2);
  }
  console.log(`[smoke] Setup ok. demo-seed: ${JSON.stringify(seedResult)}`);

  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  const rows = [];
  for (const [route, marker] of ROUTES) {
    const errBefore = pageErrors.length;
    let shellOk = false;
    let urlOk = false;
    let markerOk = true;
    let note = "";
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForSelector(SHELL, { timeout: 8000 }).catch(() => {});
      shellOk = await page.locator(SHELL).first().isVisible().catch(() => false);
      urlOk = new URL(page.url()).pathname === route;
      if (marker) {
        const body = await page.locator("body").innerText().catch(() => "");
        markerOk = body.includes(marker);
        if (!markerOk) note = `Marker "${marker}" fehlt`;
      }
    } catch (e) {
      note = e.message;
    }
    const newErrors = pageErrors.length - errBefore;
    const ok = shellOk && urlOk && markerOk && newErrors === 0;
    rows.push({ route, shellOk, urlOk, markerOk, newErrors, ok, note });
  }

  console.log("\n=== SCRUM-218 Browser-Smoke ===");
  for (const r of rows) {
    const status = r.ok ? "OK   " : "FAIL ";
    console.log(
      `${status} ${r.route.padEnd(14)} shell=${r.shellOk} url=${r.urlOk} marker=${r.markerOk} jsErrors=${r.newErrors}${r.note ? ` :: ${r.note}` : ""}`,
    );
  }
  const failed = rows.filter((r) => !r.ok).length;
  console.log(`\n[smoke] ${rows.length - failed}/${rows.length} Routen ok.`);

  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}

await main();

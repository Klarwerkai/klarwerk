import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { expect as browserExpect, chromium } from "@playwright/test";
import { expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { eintragMitOriginal } from "../klara-quellen-nutzerweg/kette";

// Echter Chromium + gebautes Frontend + echte Routen/ACL. Der HTTP-Transport läuft wie in
// design/h6-chromium über app.inject. Fiktive Konten, kein Provider/DB/Office/Mac-Foreground.
it("J · Begleiter: Suchaufruf, Tastatur, echtes Wissensziel, Entwurf, Modalgrenze und kleine Fenster", async () => {
  const app = buildApp(assembleServices(inMemoryRepos()));
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const origin = "https://j-suchprobe.test";
  const dist = join(process.cwd(), "apps/web/dist");
  const bericht = process.env.J_REPORT_DIR ?? join(process.cwd(), ".local/run/j-suche");
  mkdirSync(bericht, { recursive: true });
  try {
    await app.ready();
    const email = "admin@j-suchprobe.test";
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "J Fiktiv", email, password: "FiktivJ-123456" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "FiktivJ-123456" },
    });
    expect(login.statusCode).toBe(200);
    const adminToken = login.json().token as string;
    const kopf = { authorization: `Bearer ${adminToken}` };
    const ko = await eintragMitOriginal(
      app,
      { email, token: adminToken, kopf },
      { titel: "Jotumbau Suchbeleg" },
    );
    const leserEmail = "viewer@j-suchprobe.test";
    const neu = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: kopf,
      payload: { name: "J Leserin", email: leserEmail, password: "FiktivJ-123456", role: "viewer" },
    });
    expect(neu.statusCode, neu.body).toBe(201);
    const leser = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: leserEmail, password: "FiktivJ-123456" },
    });
    expect(leser.statusCode).toBe(200);
    const token = leser.json().token as string;
    const gesetzt = await app.inject({
      method: "PUT",
      url: "/api/me/assistenz/tastenkuerzel",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        aktion: "suchen",
        belegung: {
          code: "KeyU",
          taste: "U",
          strg: false,
          alt: false,
          umschalt: true,
          meta: true,
        },
      },
    });
    expect(gesetzt.statusCode).toBe(200);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 400, height: 600 } });
    const page = await context.newPage();
    const fehler: string[] = [];
    page.on("pageerror", (e) => fehler.push(String(e)));
    await page.addInitScript(() => {
      const w = window as unknown as { __j: unknown[]; webkit: unknown };
      w.__j = [];
      w.webkit = {
        messageHandlers: { klaraBegleiter: { postMessage: (n: unknown) => w.__j.push(n) } },
      };
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) {
        await route.abort();
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        const r = await app.inject({
          method: request.method() as "GET" | "POST" | "PUT" | "DELETE",
          url: url.pathname + url.search,
          headers: { ...request.headers(), authorization: `Bearer ${token}` },
          ...(request.postData() === null ? {} : { payload: request.postData() ?? "" }),
        });
        await route.fulfill({
          status: r.statusCode,
          body: r.body,
          contentType: String(r.headers["content-type"] ?? "application/json"),
        });
        return;
      }
      const datei = join(dist, url.pathname === "/" ? "index.html" : url.pathname);
      const pfad = existsSync(datei) && extname(datei) ? datei : join(dist, "index.html");
      const typen: Record<string, string> = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".woff2": "font/woff2",
        ".json": "application/json",
      };
      await route.fulfill({
        status: 200,
        body: readFileSync(pfad),
        contentType: typen[extname(pfad)] ?? "application/octet-stream",
      });
    });
    await page.goto(`${origin}/begleiter`);
    await browserExpect(page.getByTestId("begleiter-figur")).toBeVisible();
    const nativ = async (befehl: string) =>
      page.evaluate(
        (b) => window.dispatchEvent(new CustomEvent("klara-begleiter", { detail: { befehl: b } })),
        befehl,
      );
    const feld = page.locator('[data-cmd="suchfeld"]');
    await nativ("suche-oeffnen");
    await browserExpect(feld).toBeFocused();
    await browserExpect(page.getByTestId("begleiter-gespraech")).toBeAttached();
    expect(
      await page
        .getByTestId("begleiter-gespraech")
        .evaluate((el) => el.closest("[inert]") !== null),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await browserExpect(feld).toHaveCount(0);
    await page.getByTestId("begleiter-eingabe").fill("Fiktiver ungesendeter Entwurf");
    await page.keyboard.press("Meta+Shift+u");
    await browserExpect(feld).toBeFocused();
    await feld.fill("Jotumbau");
    const ziel = `/wissen/${ko.koId}`;
    const treffer = page.locator(`[data-cmd-pfad="${ziel}"]`);
    await browserExpect(treffer).toBeVisible();
    await browserExpect(page.locator('[data-cmd-pfad="/admin"]')).toHaveCount(0);
    await treffer.click();
    await browserExpect(feld).toHaveCount(0);
    const ziele = await page.evaluate(() =>
      (window as unknown as { __j: { art: string; pfad?: string }[] }).__j.filter(
        (n) => n.art === "suchziel",
      ),
    );
    expect(ziele).toEqual([{ art: "suchziel", pfad: ziel }]);
    await browserExpect(page.getByTestId("begleiter-eingabe")).toHaveValue(
      "Fiktiver ungesendeter Entwurf",
    );
    for (const dunkel of [false, true]) {
      await page.emulateMedia({ colorScheme: dunkel ? "dark" : "light" });
      await page.setViewportSize({ width: dunkel ? 320 : 800, height: dunkel ? 420 : 800 });
      await nativ("suche-oeffnen");
      await browserExpect(feld).toBeFocused();
      const box = await feld.boundingBox();
      expect(box).not.toBeNull();
      const breite = dunkel ? 320 : 800;
      expect(box && box.x >= 0 && box.x + box.width <= breite).toBe(true);
      await page.screenshot({
        path: join(bericht, dunkel ? "suche-320-dunkel.png" : "suche-800-hell.png"),
      });
      await page.keyboard.press("Tab");
      expect(
        await page.locator("dialog").evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);
      await nativ("gespraech-schliessen");
      await browserExpect(feld).toHaveCount(0);
      await browserExpect(page.getByTestId("begleiter-gespraech")).toHaveCount(0);
    }
    await page.keyboard.press("Meta+Shift+u");
    await browserExpect(feld).toBeFocused();
    await browserExpect(page.getByTestId("begleiter-gespraech")).toBeAttached();
    expect(fehler).toEqual([]);
    await context.close();
  } finally {
    await browser?.close();
    await app.close();
  }
}, 90_000);

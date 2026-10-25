// Echte Navigation beider Darstellungen; kein Ersatz für die 25 PostgreSQL-Zellen von R1.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { type Browser, chromium, type Route } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { Akteur } from "../beta-rollenabnahme/buehne";
import { eintrag } from "../beta-rollenabnahme/tabelle";
import type { Seite } from "../gast-nutzerweg/browserweg";
import { anmeldenAnDerMaske, oeffneTuer, sichtbarkeit, textTraeger } from "./flaeche";
import { SPERRSATZ, TUEREN, type Tuer } from "./tueren";

const ORIGIN = "http://127.0.0.1";
const DIST = resolve("apps/web/dist");
const PASSWORT = "Navigation-2026!";
const email = (akteur: string) => `${akteur}@navigation.test`;
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
};
const bindungsPfad = process.env.KLARWERK_NAV_BAUBINDUNG;
const bindung = bindungsPfad
  ? new Map(
      (JSON.parse(readFileSync(bindungsPfad, "utf8")) as {
        dist_files: { path: string; sha256: string }[];
      }).dist_files.map((datei) => [datei.path, datei.sha256]),
    )
  : undefined;
const dateien = new Map<string, { bytes: number; sha256: string }>();
const protokoll: unknown[] = [];
const seitenfehler: string[] = [];
const anfragefehler: string[] = [];
const offen = new Set<Promise<void>>();
const geschlossen = { browser: false, app: false };
let app: ReturnType<typeof buildApp> | undefined;
let browser: Browser | undefined;

async function antworte(route: Route): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  expect(url.origin).toBe(ORIGIN);
  if (url.pathname.startsWith("/api/")) {
    // Native Sitzungskekse dieses Browserprofils; kein eingesetzter Admin-Bearer.
    const headers = { ...request.headers() };
    delete headers.host;
    const body = request.postData();
    const response = await app!.inject({
      method: request.method() as "GET",
      url: url.pathname + url.search,
      headers,
      ...(body === null ? {} : { payload: body }),
    });
    const antwortHeaders: Record<string, string> = {
      "content-type": String(response.headers["content-type"] ?? "application/json"),
    };
    const cookie = response.headers["set-cookie"];
    if (cookie) {
      antwortHeaders["set-cookie"] = Array.isArray(cookie) ? cookie.join("\n") : String(cookie);
    }
    await route.fulfill({
      status: response.statusCode,
      body: response.body,
      headers: antwortHeaders,
    });
    return;
  }
  let file = join(DIST, url.pathname === "/" ? "index.html" : url.pathname);
  if (!existsSync(file) || !statSync(file).isFile()) {
    file = join(DIST, "index.html");
  }
  expect(file.startsWith(`${DIST}/`)).toBe(true);
  const bytes = readFileSync(file);
  const hash = sha(bytes);
  if (bindung) {
    expect(bindung.get(file), `bestehende Baubindung: ${file}`).toBe(hash);
  }
  dateien.set(file, { bytes: bytes.length, sha256: hash });
  await route.fulfill({
    status: 200,
    body: bytes,
    contentType: MIME[extname(file)] ?? "application/octet-stream",
  });
}

function navigationspunkt(tuer: Tuer): string {
  if (tuer.nr === "T1" && tuer.knopf.art === "selektor") {
    return tuer.knopf.sel;
  }
  if (tuer.nr === "T2" && tuer.menuepunkt) {
    return tuer.menuepunkt.sel;
  }
  throw new Error("Dieser Teilnachweis misst nur die Navigation von T1 und T2.");
}

describe("Rollen-Navigation in Seitenleiste und Kopfband", () => {
  beforeAll(async () => {
    expect(existsSync(join(DIST, "index.html"))).toBe(true);
    app = buildApp(buildServices());
    await app.ready();
    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { name: "Navigation Admin", email: email("admin"), password: PASSWORT },
    });
    expect(setup.statusCode).toBe(201);
    const token = setup.json<{ token: string }>().token;
    for (const role of ["viewer", "experte", "controller"] as const) {
      const response = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: { authorization: `Bearer ${token}` },
        payload: { name: `Navigation ${role}`, email: email(role), password: PASSWORT, role },
      });
      expect(response.statusCode).toBe(201);
    }
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
    });
  }, 60_000);

  afterAll(async () => {
    await Promise.all([...offen]);
    await browser?.close();
    geschlossen.browser = browser !== undefined;
    await app?.close();
    geschlossen.app = app !== undefined;
    const bericht = { protokoll, seitenfehler, anfragefehler, geschlossen, dateien: [...dateien] };
    const ziel = process.env.KLARWERK_NAV_BELEG;
    if (ziel) {
      writeFileSync(ziel, `${JSON.stringify(bericht, null, 2)}\n`);
    }
    console.info(`Rollen-Navigation ${JSON.stringify(bericht)}`);
    expect(seitenfehler).toEqual([]);
    expect(anfragefehler).toEqual([]);
  }, 60_000);

  it.each([1440, 1280])("prüft echte T1/T2-Einstiege bei %i Pixeln", async (breite) => {
    const tueren = TUEREN.filter((tuer) => tuer.nr === "T1" || tuer.nr === "T2");
    expect(tueren).toHaveLength(2);
    const akteure = Object.keys(tueren[0]!.erwartet) as Akteur[];
    for (const akteur of akteure) {
      const kontext = await browser!.newContext({
        viewport: { width: breite, height: 900 },
        locale: "de-DE",
      });
      try {
        await kontext.route("**/*", (route) => {
          const arbeit = antworte(route).catch((fehler: unknown) => {
            anfragefehler.push(String(fehler));
            throw fehler;
          });
          offen.add(arbeit);
          return arbeit.finally(() => offen.delete(arbeit));
        });
        const page = await kontext.newPage();
        page.on("pageerror", (fehler) => seitenfehler.push(String(fehler)));
        const seite = page as unknown as Seite;
        if (akteur !== "anonym") {
          await anmeldenAnDerMaske(seite, ORIGIN, email(akteur), PASSWORT);
          const rolle = await page.evaluate(
            'fetch("/api/auth/me").then(r => r.json()).then(u => u.role)',
          );
          expect(rolle).toBe(akteur);
        }
        for (const tuer of tueren) {
          const soll = eintrag(tuer.erwartet[akteur]).soll;
          const sel = navigationspunkt(tuer);
          const id = tuer.nr === "T1" ? "erfassen" : "validierung";
          const alt = `[data-kopfband-punkt="${id}"]`;
          const ziel = `${ORIGIN}${soll === "erlaubt" ? "/" : tuer.seite}`;
          await oeffneTuer(
            seite,
            ziel,
            { art: "selektor", sel, name: tuer.nr },
            SPERRSATZ,
            `${akteur} an ${tuer.nr}`,
          );
          // Erst der frühere Selektor, dann der neue: dasselbe echte, unveränderte DOM.
          const vorher = await sichtbarkeit(seite, alt);
          const nachher = await sichtbarkeit(seite, sel);
          expect(nachher.verfahren).toBe("checkVisibility");
          if (soll === "erlaubt") {
            expect(vorher.sichtbar).toBe(breite === 1280);
            expect(vorher.da).toBe(breite === 1280);
            expect(nachher.sichtbar).toBe(true);
            expect(nachher.text.length).toBeGreaterThan(0);
            expect((await textTraeger(seite, nachher.text)).sichtbar).toBe(true);
            const link = page.locator(sel);
            expect(await link.count()).toBe(1);
            expect(await link.getAttribute("href")).toBe(tuer.seite);
            await link.click();
            await page.waitForURL(`${ORIGIN}${tuer.seite}`);
            expect((await textTraeger(seite, SPERRSATZ)).sichtbar).toBe(false);
          } else {
            expect(nachher.sichtbar).toBe(false);
            const sperre = akteur === "anonym"
              ? await sichtbarkeit(seite, "#auth-email")
              : await textTraeger(seite, SPERRSATZ);
            expect(sperre.verfahren).toBe("checkVisibility");
            expect(sperre.sichtbar).toBe(true);
          }
          protokoll.push({ breite, akteur, tuer: tuer.nr, soll, vorher, nachher, ziel: page.url() });
        }
      } finally {
        await Promise.all([...offen]);
        await kontext.close();
      }
    }
    expect(seitenfehler).toEqual([]);
    expect(anfragefehler).toEqual([]);
  }, 60_000);
});

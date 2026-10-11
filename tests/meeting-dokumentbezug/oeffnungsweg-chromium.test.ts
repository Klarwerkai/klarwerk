// ================================================================================================
// BPA-16 · NACHARBEIT 6 — DER ÖFFNUNGSWEG IN CHROMIUM: VOM DOKUMENTWEG BIS ZUR QUELLFASSUNG.
// ================================================================================================
//
// Die GEBAUTE Anwendung (`apps/web/dist`, Ergebnis von `./tools/build`) läuft in einem echten
// Chromium. Jeder `/api/*`-Aufruf geht an die echte Fastify-App (`buildApp`) — dieselbe Bauform
// wie `tests/design/h3-blatt-buehne.ts`, hier mit umschaltbarem Konto, weil zwei Menschen
// vorkommen. Binäre Antworten (die PPTX) reisen als Bytes, nicht als Text.
//
// DER WEG DES TEILNEHMERS (die Besprechung samt Rückmeldung legt die Vortragende vorher über die
// Routen an; die Erfassung auf der Seite misst `oberflaeche-mounted.test.tsx`):
//   1 · `/fragen/dokument` → „Besprechungen und Folien" → Besprechung öffnen;
//   2 · aus der Folie öffnen → die Rückmeldung, ihre Gesprächsstelle, der Verweis auf die
//       präsentierte Fassung; die Adresse liefert im Browser wirklich die PPTX;
//   3 · zur Gesprächsstelle → DIESELBE Rückmeldung; direkt aus der Gesprächsstelle → dieselbe,
//       mit dem Weg zurück zur Folie;
//   4 · Rechteentzug (Freigabeniveau gesenkt), ohne Neuladen: aus der Folie nichts mehr, an der
//       Gesprächsstelle nur „Folie ohne Leserecht", die Quelladresse antwortet 404.
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { NORD, VTT, pptx } from "./vorrichtung";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

const DIST = resolve(process.cwd(), "apps/web/dist");
const ORIGIN = "http://localhost";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

type App = ReturnType<typeof buildApp>;

let app: App | null = null;
let browser: Browser | null = null;
let seite: Page | null = null;
/** Das Konto, das gerade am Bildschirm sitzt. */
let token = "";

function distDatei(pfad: string): { body: Buffer; typ: string } {
  const datei = join(DIST, pfad === "/" ? "/index.html" : pfad);
  if (existsSync(datei) && statSync(datei).isFile()) {
    return { body: readFileSync(datei), typ: MIME[extname(datei)] ?? "application/octet-stream" };
  }
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

interface Konto {
  id: string;
  token: string;
}

async function konto(a: App, name: string, admin?: Konto): Promise<Konto> {
  const email = `${name}-bpa16-chromium@klarwerk.test`;
  const reg = await a.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name, email, password: "geheim12345" },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  const roh = reg.json() as { id?: string; user?: { id: string } };
  const id = roh.id ?? roh.user?.id ?? "";
  if (admin) {
    const frei = await a.inject({
      method: "POST",
      url: `/api/auth/users/${id}/approve`,
      headers: { authorization: `Bearer ${admin.token}` },
    });
    expect(frei.statusCode, frei.body).toBe(200);
  }
  const login = await a.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  expect(login.statusCode, login.body).toBe(200);
  return { id, token: (login.json() as { token: string }).token };
}

async function als(
  a: App,
  k: Konto,
  method: "GET" | "POST" | "PUT",
  url: string,
  payload?: object,
): Promise<Record<string, unknown>> {
  const res = await a.inject({
    method,
    url,
    headers: { authorization: `Bearer ${k.token}` },
    ...(payload ? { payload } : {}),
  });
  expect(res.statusCode, `${method} ${url}: ${res.body}`).toBeLessThan(300);
  return res.json() as Record<string, unknown>;
}

async function hochladen(
  a: App,
  k: Konto,
  name: string,
  mime: string,
  bytes: Uint8Array,
): Promise<string> {
  const ref = await als(a, k, "POST", "/api/objects", {
    name,
    mime,
    data: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`,
    kind: "document",
    purpose: "anchor",
    confidentiality: mime === PPTX_MIME ? "vertraulich" : "intern",
  });
  return String(ref.id);
}

/**
 * Eine Funktion für die Seite, als Quelltext — wie `tests/design/h3-blatt-buehne.ts` (`fn`): der
 * Node-Typcheck dieser Datei kennt kein `document`, die Seite schon.
 */
const fn = (quelle: string): ((arg: unknown) => unknown) =>
  new Function("arg", `return (${quelle})(arg);`) as (arg: unknown) => unknown;

/** Klick wie in den übrigen Chromium-Prüfständen: am Element in der Seite ausgelöst. */
async function klick(selektor: string): Promise<void> {
  const s = seite as Page;
  await s.waitForSelector(selektor, { timeout: 20_000 });
  await s.evaluate(fn("(sel) => { document.querySelector(sel).click(); }"), selektor);
}

/** Ruft eine Adresse AUS DER SEITE ab (derselbe Weg wie ein Klick auf den Verweis). */
async function abruf(adresse: string): Promise<{ status: number; kopf: string }> {
  return (await (seite as Page).evaluate(
    fn(`async (u) => {
      const r = await fetch(u);
      const b = new Uint8Array(await r.arrayBuffer());
      return { status: r.status, kopf: String.fromCharCode(b[0] || 0, b[1] || 0) };
    }`),
    adresse,
  )) as { status: number; kopf: string };
}

async function warte(selektor: string): Promise<void> {
  await (seite as Page).waitForSelector(selektor, { timeout: 20_000 });
}

let teilnehmer: Konto;
let vortragende: Konto;
let meetingId = "";
let kopieId = "";

beforeAll(async () => {
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor läuft es immer)");
  }
  const a = buildApp(buildServices());
  app = a;
  await a.ready();
  vortragende = await konto(a, "vortragende");
  teilnehmer = await konto(a, "teilnehmer", vortragende);
  await als(a, vortragende, "PUT", `/api/users/${teilnehmer.id}`, { freigabe: "vertraulich" });

  kopieId = await hochladen(a, vortragende, "nord-vortrag.pptx", PPTX_MIME, await pptx(NORD, "k"));
  const originalId = await hochladen(a, vortragende, "nord.pptx", PPTX_MIME, await pptx(NORD));
  const vttId = await hochladen(a, vortragende, "m.vtt", "text/vtt", new TextEncoder().encode(VTT));
  const angelegt = await als(a, vortragende, "POST", "/api/meetings", {
    titel: "Quartalsrunde Chromium",
    zeitbasis: "aufnahme",
    teilnehmer: [teilnehmer.id],
  });
  meetingId = String(angelegt.meetingId);
  const basis = `/api/meetings/${meetingId}`;
  const verbunden = await als(a, vortragende, "POST", `${basis}/praesentationen`, {
    objectId: kopieId,
    originalObjectId: originalId,
  });
  await als(a, vortragende, "POST", `${basis}/mitschriften`, {
    objectId: vttId,
    zeitbasis: "aufnahme",
  });
  await als(a, vortragende, "POST", `${basis}/folienwechsel`, {
    quelle: "host",
    zeitMs: 120_000,
    zeitbasis: "aufnahme",
    dateiId: kopieId,
    fassung: String(verbunden.fassung),
    sldId: "257",
  });
  await als(a, vortragende, "POST", `${basis}/rueckmeldungen`, {
    mitschriftId: vttId,
    stelleId: "r2",
    art: "beschlossene_korrektur",
    text: "Berechnungsgrundlage unter die Grafik",
  });

  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
  });
  seite = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await seite.route(`${ORIGIN}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.startsWith("/api/")) {
      const kopf: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers())) {
        if (!["host", "origin", "referer", "cookie"].includes(k.toLowerCase())) {
          kopf[k] = v;
        }
      }
      kopf.authorization = `Bearer ${token}`;
      const body = req.postData();
      const res = await a.inject({
        method: req.method() as "GET",
        url: url.pathname + url.search,
        headers: kopf,
        ...(body !== null ? { payload: body } : {}),
      });
      await route.fulfill({
        status: res.statusCode,
        body: res.rawPayload,
        headers: {
          "content-type": String(res.headers["content-type"] ?? "application/json"),
        },
      });
      return;
    }
    const d = distDatei(url.pathname);
    await route.fulfill({ status: 200, body: d.body, contentType: d.typ });
  });
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await app?.close();
});

describe("BPA-16 · Öffnungsweg in Chromium (K1/K6/K7/K10)", () => {
  it("Dokumentweg → Besprechung → aus Folie und Gesprächsstelle öffnen → Quellfassung → Entzug", async () => {
    const s = seite as Page;
    const a = app as App;
    token = teilnehmer.token;

    // 1 · vom vorhandenen Dokumentweg in die Besprechung
    await s.goto(`${ORIGIN}/fragen/dokument`, { waitUntil: "load", timeout: 60_000 });
    await klick('[data-testid="dokumentfragen-besprechungen"]');
    await klick('[data-testid="besprechungen-eintrag"]');
    await warte('[data-testid="besprechung-folie-oeffnen"][data-sld="257"]');
    expect(new URL(s.url()).pathname).toBe(`/besprechungen/${encodeURIComponent(meetingId)}`);

    // 2 · aus der Folie
    await klick('[data-testid="besprechung-folie-oeffnen"][data-sld="257"]');
    await warte('[data-testid="besprechung-rueckmeldung"] [data-testid="besprechung-quelle"]');
    const karteSel = '[data-testid="besprechung-rueckmeldung"]';
    const id = await s.getAttribute(karteSel, "data-rueckmeldung");
    const karte = await s.textContent('[data-testid="besprechung-rueckmeldung"]');
    expect(karte).toContain("Berechnungsgrundlage unter die Grafik");
    expect(karte).toContain("Hier fehlt die Quelle der Zahlen.");
    const quelle = await s.getAttribute('[data-testid="besprechung-quelle"]', "href");
    expect(quelle).toBe(`/api/objects/${encodeURIComponent(kopieId)}/raw`);
    expect(await abruf(quelle ?? "")).toEqual({ status: 200, kopf: "PK" });

    // 3 · zur Gesprächsstelle und direkt aus ihr — dieselbe Rückmeldung
    await klick('[data-testid="besprechung-zur-stelle"]');
    await warte('[data-testid="besprechung-treffer-titel"][data-von="stelle"]');
    await warte(`[data-testid="besprechung-rueckmeldung"][data-rueckmeldung="${id}"]`);
    await klick('[data-testid="besprechung-stelle-oeffnen"][data-stelle="r2"]');
    await warte('[data-testid="besprechung-zur-folie"]');
    expect(await s.getAttribute(karteSel, "data-rueckmeldung")).toBe(id);

    // 4 · Rechteentzug ohne Neuladen
    await als(a, vortragende, "PUT", `/api/users/${teilnehmer.id}`, { freigabe: "intern" });
    await klick('[data-testid="besprechung-folie-oeffnen"][data-sld="257"]');
    await warte('[data-testid="besprechung-treffer-leer"]');
    // Nacharbeit 9: die Überschrift nennt den gesperrten Folientitel nicht mehr.
    const titel = await s.textContent('[data-testid="besprechung-treffer-titel"]');
    expect(titel).not.toContain("Umsatzentwicklung");
    await klick('[data-testid="besprechung-stelle-oeffnen"][data-stelle="r2"]');
    await warte('[data-testid="besprechung-folie-gesperrt"]');
    expect(await s.$('[data-testid="besprechung-quelle"]')).toBeNull();
    expect(await s.$('[data-testid="besprechung-ziel-quelle"]')).toBeNull();
    expect(await abruf(quelle ?? "")).toMatchObject({ status: 404 });
  }, 120_000);
});

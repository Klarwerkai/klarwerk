// ================================================================================================
// P-ENTWUERFE-VERWALTEN · DIE ABNAHMEFOLGE NUR MIT DER TASTATUR — IM ECHTEN CHROMIUM, DE UND EN.
// ================================================================================================
//
// BENS BEFUND (Nacharbeit 3): `abnahmefolge-gesamt.test.tsx` weist eine „durchgehende
// Tastaturabnahme" aus, setzt den Fokus aber programmatisch (`focus()`) und erzeugt danach selbst
// den `click()`. Echte Fokusführung, Tab-Sperren hinter einer Modalfläche und das, was der Browser
// aus Enter macht, misst sie damit nicht. Die Chromium-Fälle in
// `tests/d1-meine-entwuerfe/zugang-schmal-chromium.test.ts` enden beim Öffnen.
//
// DIESE DATEI GEHT DIE GANZE FOLGE IM ECHTEN BROWSER, und zwar ausschliesslich mit echten Tasten:
//   Start → (Tab) Kopfband „Meine Entwürfe" → (Enter) Übersicht → neuester zuerst → (Tab) Suche →
//   per INHALT tippen → per TITEL tippen → (Tab) „Fortsetzen" → (Enter) Blatt mit genau diesem
//   Entwurf → (Tab) Titelfeld → ungesicherte Änderung tippen → (Umschalt+Tab) Kopfband →
//   (Enter) Navigationswache → (Tab) „Verwerfen und wechseln" → (Enter) Übersicht, der Bestand
//   unverändert → (Tab) Suche leeren → (Tab) Löschknopf → (Enter) Rückfrage → (Tab) „Löschen" →
//   (Enter) Eintrag weg, am Bestand gemessen.
//
// REGELN DIESES PRÜFSTANDS:
//   · KEIN `focus()`, KEIN `click()`, KEIN `dispatchEvent` aus dem Prüfcode. Die Seite wird genau
//     einmal je Sprache über die Adresse betreten (`/start`); jeder Ortswechsel danach entsteht aus
//     einer Taste. Gesucht wird ein Ziel vom AKTUELLEN Fokus aus (`tasteBis`): Tab (oder
//     Umschalt+Tab) Schritt für Schritt, bis `document.activeElement` das Ziel ist. Liegt es nicht
//     im Tabulatorlauf, ist der Fall rot — nicht umgangen.
//   · Die Rückfrage der Navigationswache liegt über einer Modalfläche (`inert` für den Rest). Wer
//     dort mit Tab das Wort „Verwerfen und wechseln" erreicht, hat die Fokusführung des Dialogs
//     benutzt und nicht an ihr vorbei.
//   · Der Server ist die ECHTE Fastify-App (`buildApp`) hinter jedem `/api/*`-Aufruf — dasselbe
//     Muster wie `zugang-schmal-chromium.test.ts`. „Alte Fassung wieder da" und „Eintrag weg"
//     werden am Bestand gemessen, nicht nur an der Fläche.
//
// WAS DIESE DATEI NICHT IST: eine menschliche Bedienung. Die Vorführung vor Pedi ersetzt sie nicht.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import i18n from "../../apps/web/src/i18n";
import { DRAFT_QUERY_STORAGE_KEY } from "../../apps/web/src/lib/draftListView";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const WURZEL = resolve(process.cwd());
const DIST = resolve(WURZEL, "apps/web/dist");
// `localhost`: nur dort führt Chromium einen sicheren Kontext (`crypto.randomUUID`), s.
// `tests/design/h3-blatt-buehne.ts`.
const ORIGIN = "http://localhost";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mjs": "application/javascript",
};

type BrowserFn = (arg: unknown) => unknown;
const fn = (quelle: string): BrowserFn =>
  new Function("arg", `return (${quelle})(arg);`) as BrowserFn;

interface Route {
  request(): {
    url(): string;
    method(): string;
    postData(): string | null;
    headers(): Record<string, string>;
  };
  fulfill(r: {
    status: number;
    body: string | Buffer;
    contentType?: string;
    headers?: Record<string, string>;
  }): Promise<void>;
}
interface Seite {
  route(url: string, handler: (route: Route) => Promise<void>): Promise<void>;
  addInitScript(script: string): Promise<void>;
  on(ereignis: string, handler: (arg: unknown) => void): void;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(f: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(f: BrowserFn, arg?: unknown): Promise<T>;
  keyboard: { press(taste: string): Promise<void>; type(text: string): Promise<void> };
}
interface Browser {
  version(): string;
  newPage(opts: Record<string, unknown>): Promise<Seite>;
  close(): Promise<void>;
}

function distDatei(pfadname: string): { body: Buffer; typ: string } {
  const rel = pfadname === "/" ? "/index.html" : pfadname;
  const datei = join(DIST, rel);
  if (existsSync(datei) && statSync(datei).isFile()) {
    return { body: readFileSync(datei), typ: MIME[extname(datei)] ?? "application/octet-stream" };
  }
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

// ------------------------------------------------------------------------------------------------
// DIE FIXTURE — zwei ältere Entwürfe; der Zielentwurf wird JE SPRACHE frisch angelegt und ist damit
// der jüngste. „Schwingungswert" steht nur im Inhalt, in keinem Titel.
// ------------------------------------------------------------------------------------------------
const ZIEL_TITEL =
  "Kühlwasserpumpe P7 — Lagerwechsel nach 3000 Betriebsstunden und Sichtprüfung am Flansch";
const INHALTSWORT = "Schwingungswert";
const TITELWORT = "Kühlwasserpumpe";
const ANDERE = [
  { title: "Ventil V2 Nord", statement: "Dichtring wechseln" },
  { title: "Anlage Süd", statement: "Druckprobe offen" },
];

let browser: Browser | null = null;
let app: ReturnType<typeof buildApp> | null = null;
let seite: Seite | null = null;
let token = "";
let fehler: string | null = null;
const seitenfehler: string[] = [];

async function api(
  method: "GET" | "POST",
  url: string,
  payload?: Record<string, unknown>,
): Promise<{ status: number; json: unknown }> {
  const a = app as NonNullable<typeof app>;
  const res = await a.inject({
    method,
    url,
    headers: { authorization: `Bearer ${token}` },
    ...(payload ? { payload } : {}),
  });
  return { status: res.statusCode, json: res.json() as unknown };
}

type Bestand = { id: string; payload: { title?: string } }[];
const bestand = async (): Promise<Bestand> => (await api("GET", "/api/drafts")).json as Bestand;

// ------------------------------------------------------------------------------------------------
// TASTEN — die einzigen Bedienmittel dieses Prüfstands.
// ------------------------------------------------------------------------------------------------

/** Trifft das fokussierte Element den Selektor? (Reines Ablesen, keine Handlung.) */
const FOKUS_PASST =
  "(sel) => { const a = document.activeElement; return !!a && a !== document.body && a.matches(sel); }";
/** Trägt das fokussierte Element genau diesen sichtbaren Text? */
const FOKUS_TEXT = `(w) => { const a = document.activeElement; return !!a && (a.textContent || '').replace(/\\s+/g, ' ').trim() === w; }`;
/** Was gerade fokussiert ist — nur für die Fehlermeldung. */
const FOKUS_BESCHREIBUNG = `() => { const a = document.activeElement; if (!a) { return '(nichts)'; } return a.tagName + ' ' + (a.getAttribute('data-testid') || '') + ' «' + (a.textContent || a.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 50) + '»'; }`;

/**
 * Vom AKTUELLEN Fokus aus mit Tab (oder Umschalt+Tab) gehen, bis das Ziel fokussiert ist. Das Ziel
 * ist ein Selektor oder — für die Knöpfe der Rückfrage — ihr sichtbares Wort.
 */
async function tasteBis(
  ziel: { selektor: string } | { text: string },
  was: string,
  taste: "Tab" | "Shift+Tab" = "Tab",
  hoechstens = 120,
): Promise<void> {
  const s = seite as Seite;
  const pruefe = async (): Promise<boolean> =>
    "selektor" in ziel
      ? s.evaluate<boolean>(fn(FOKUS_PASST), ziel.selektor)
      : s.evaluate<boolean>(fn(FOKUS_TEXT), ziel.text);
  if (await pruefe()) {
    return;
  }
  for (let i = 0; i < hoechstens; i++) {
    await s.keyboard.press(taste);
    if (await pruefe()) {
      return;
    }
  }
  const zuletzt = await s.evaluate<string>(fn(FOKUS_BESCHREIBUNG));
  throw new Error(
    `${was}: mit ${hoechstens}× ${taste} vom aktuellen Fokus aus nicht erreicht (zuletzt fokussiert: ${zuletzt})`,
  );
}

/** Der Fokus ist auch SICHTBAR (globale `*:focus-visible`-Regel, index.css). */
async function fokusSichtbar(was: string): Promise<void> {
  const ring = await (seite as Seite).evaluate<string>(
    fn("() => getComputedStyle(document.activeElement).outlineStyle"),
  );
  expect(ring, `${was}: kein sichtbarer Fokusring`).not.toBe("none");
}

/** Leert das fokussierte Eingabefeld mit Tasten (Ende, dann Rücktaste). */
async function feldLeeren(laenge: number): Promise<void> {
  const s = seite as Seite;
  await s.keyboard.press("End");
  for (let i = 0; i < laenge + 2; i++) {
    await s.keyboard.press("Backspace");
  }
}

async function warteAuf(quelle: string, arg?: unknown, frist = 20_000): Promise<void> {
  await (seite as Seite).waitForFunction(fn(quelle), arg, { timeout: frist });
}

const ADRESSE = "() => location.pathname + location.search";
const SEITEN_TITEL = `() => [...document.querySelectorAll('[data-testid="page-entwuerfe"] [data-testid="entwurfsliste-eintrag-titel"]')].map((e) => (e.textContent || '').trim())`;
const BLATT_TITEL = `() => ((document.querySelector('[data-testid="blatt-titel"]') || {}).value || '')`;

beforeAll(async () => {
  try {
    if (!existsSync(join(DIST, "index.html"))) {
      throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor laeuft es immer)");
    }
    app = buildApp(buildServices());
    await app.ready();
    const post = `pedi+${Math.random().toString(36).slice(2, 8)}@abnahme-tastatur.test`;
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Pedi", email: post, password: "geheim12345" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: post, password: "geheim12345" },
    });
    token = (login.json() as { token: string }).token;
    for (const d of ANDERE) {
      await api("POST", "/api/drafts", { ...d, type: "best_practice", category: "Anlage" });
    }

    const require = createRequire(import.meta.url);
    const { chromium } = require("playwright") as {
      chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
    };
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
    });
    seite = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    seite.on("pageerror", (e: unknown) => {
      seitenfehler.push(String(e).split("\n")[0] ?? "");
    });
    await seite.addInitScript(
      `try { localStorage.setItem("kw.designTheme", "modern"); } catch (e) {}`,
    );
    const a = app;
    await seite.route(`${ORIGIN}/**`, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname.startsWith("/api/")) {
        const k: Record<string, string> = {};
        for (const [n, v] of Object.entries(req.headers())) {
          if (!["host", "origin", "referer", "cookie"].includes(n.toLowerCase())) k[n] = v;
        }
        k.authorization = `Bearer ${token}`;
        const body = req.postData();
        const res = await a.inject({
          method: req.method() as "GET",
          url: url.pathname + url.search,
          headers: k,
          ...(body !== null ? { payload: body } : {}),
        });
        await route.fulfill({
          status: res.statusCode,
          body: res.body,
          headers: {
            "content-type": (res.headers["content-type"] as string) ?? "application/json",
          },
        });
        return;
      }
      const d = distDatei(url.pathname);
      await route.fulfill({ status: 200, body: d.body, contentType: d.typ });
    });
  } catch (e) {
    fehler = String(e).split("\n").slice(0, 3).join(" | ");
  }
}, 180_000);

afterAll(async () => {
  await browser?.close();
  await app?.close();
  await i18n.changeLanguage("de");
}, 60_000);

describe("P-ENTWUERFE-VERWALTEN · Abnahmefolge nur mit Tab/Enter im echten Chromium", () => {
  for (const sprache of ["de", "en"] as const) {
    it(`${sprache}: Start → Meine Entwürfe → finden → öffnen → ändern → Wache „Verwerfen“ → alte Fassung → Löschen mit Bestätigung → weg`, async () => {
      expect(fehler, "Prüfstand nicht aufgebaut").toBeNull();
      const s = seite as Seite;
      await i18n.changeLanguage(sprache);
      const wort = (schluessel: string): string => String(i18n.t(schluessel));

      // Der eigene Zielentwurf dieser Sprache — der jüngste im Bestand.
      const angelegt = await api("POST", "/api/drafts", {
        title: ZIEL_TITEL,
        statement: "Lager rechtzeitig tauschen.",
        bodyHtml: `<p>Ab einem <strong>${INHALTSWORT}</strong> über 7 mm/s das Lager tauschen.</p>`,
        type: "best_practice",
        category: "Anlage 7",
      });
      expect([200, 201]).toContain(angelegt.status);
      const ziel = (angelegt.json as { id: string }).id;
      const andereIds = (await bestand()).map((d) => d.id).filter((id) => id !== ziel);

      // ── 0 · EINMAL über die Adresse auf die Startseite; Sprache über den Speicher des Produkts
      // (`kw.sprache`), gemerkter Suchfilter aus einem früheren Lauf entfernt. Danach nur Tasten.
      await s.goto(`${ORIGIN}/start`, { waitUntil: "load", timeout: 60_000 });
      await s.evaluate(
        fn(
          `(a) => { localStorage.setItem('kw.sprache', a.sprache); localStorage.removeItem(a.schluessel); }`,
        ),
        { sprache, schluessel: DRAFT_QUERY_STORAGE_KEY },
      );
      await s.goto(`${ORIGIN}/start`, { waitUntil: "load", timeout: 60_000 });
      await warteAuf(`() => document.querySelector('[data-kopfband-punkt="entwuerfe"]') !== null`);
      expect(
        await s.evaluate<string>(fn(`() => document.documentElement.getAttribute('lang') || ''`)),
        "die Sprachwahl griff nicht",
      ).toBe(sprache);

      // ── 1 · NORMAL ZUR LISTE: Tab bis zum Kopfband-Punkt, Enter.
      await tasteBis(
        { selektor: '[data-kopfband-punkt="entwuerfe"]' },
        "Kopfband „Meine Entwürfe“",
      );
      await fokusSichtbar("Kopfband „Meine Entwürfe“");
      await s.keyboard.press("Enter");
      await warteAuf(`() => location.pathname === '/entwuerfe'`);
      await warteAuf(
        `(id) => document.querySelector('[data-testid="page-entwuerfe"] [data-entwurf-fortsetzen="' + id + '"]') !== null`,
        ziel,
      );

      // ── 2 · NEUESTER ZUERST.
      const titel = await s.evaluate<string[]>(fn(SEITEN_TITEL));
      expect(titel[0], "der jüngste Entwurf steht nicht oben").toBe(ZIEL_TITEL);
      expect(titel).toHaveLength(1 + andereIds.length);

      // ── 3 · FINDEN — per INHALT, dann per TITEL; getippt in das per Tab erreichte Suchfeld.
      await tasteBis({ selektor: '[data-testid="entwurfsliste-suche"]' }, "Suchfeld");
      await s.keyboard.type(INHALTSWORT);
      await warteAuf(`(n) => (${SEITEN_TITEL})().length === n`, 1);
      expect(await s.evaluate<string[]>(fn(SEITEN_TITEL))).toEqual([ZIEL_TITEL]);
      await feldLeeren(INHALTSWORT.length);
      await s.keyboard.type(TITELWORT);
      await warteAuf(`(n) => (${SEITEN_TITEL})().length === n`, 1);
      expect(await s.evaluate<string[]>(fn(SEITEN_TITEL))).toEqual([ZIEL_TITEL]);

      // ── 4 · ÖFFNEN — Tab vom Suchfeld weiter bis „Fortsetzen“ dieses Entwurfs, Enter.
      await tasteBis({ selektor: `[data-entwurf-fortsetzen="${ziel}"]` }, "„Fortsetzen“");
      await fokusSichtbar("„Fortsetzen“");
      await s.keyboard.press("Enter");
      await warteAuf(`(id) => location.search.includes('draft=' + id)`, ziel);
      await warteAuf(`(t) => (${BLATT_TITEL})() === t`, ZIEL_TITEL);

      // ── 5 · UNGESICHERTE ÄNDERUNG — Tab bis ins Titelfeld, ans Ende, tippen.
      await tasteBis({ selektor: '[data-testid="blatt-titel"]' }, "Titelfeld des Blattes");
      await s.keyboard.press("End");
      const zusatz = " — GEÄNDERT";
      await s.keyboard.type(zusatz);
      await warteAuf(`(t) => (${BLATT_TITEL})() === t`, ZIEL_TITEL + zusatz);

      // ── 6 · LISTENWECHSEL MIT BEWUSSTEM VERWERFEN — Umschalt+Tab zurück zum Kopfband, Enter;
      // die Wache fragt; Tab INNERHALB der Rückfrage bis „Verwerfen und wechseln“, Enter.
      await tasteBis(
        { selektor: '[data-kopfband-punkt="entwuerfe"]' },
        "Kopfband „Meine Entwürfe“ (zurück)",
        "Shift+Tab",
      );
      await s.keyboard.press("Enter");
      await warteAuf(`() => document.querySelectorAll('[data-navguard-dialog]').length === 1`);
      expect(
        await s.evaluate<string>(fn(ADRESSE)),
        "ohne Antwort darf der Wechsel nicht geschehen",
      ).toBe(`/erfassen?draft=${ziel}`);
      // „Verwerfen“ (ungesicherte Änderung) und „Löschen“ (gespeicherter Entwurf) sind zwei Wörter.
      expect(wort("nav.guard.discard")).not.toBe(wort("capture.discardDraftYes"));
      await tasteBis(
        { text: wort("nav.guard.discard") },
        "„Verwerfen und wechseln“ in der Rückfrage",
      );
      // Der Fokus steht IN der Rückfrage — nicht hinter ihr.
      expect(
        await s.evaluate<boolean>(
          fn(
            `() => !!document.activeElement && !!document.activeElement.closest('[data-navguard-dialog]')`,
          ),
        ),
        "der Fokus hat die Rückfrage verlassen",
      ).toBe(true);
      await s.keyboard.press("Enter");
      await warteAuf(`() => location.pathname === '/entwuerfe'`);
      await warteAuf(`() => document.querySelectorAll('[data-navguard-dialog]').length === 0`);

      // ── 7 · DIE GESPEICHERTE ALTE FASSUNG IST DA — am Bestand und in der Liste.
      expect((await bestand()).find((d) => d.id === ziel)?.payload.title).toBe(ZIEL_TITEL);
      await warteAuf(`(n) => (${SEITEN_TITEL})().length === n`, 1);
      expect(await s.evaluate<string[]>(fn(SEITEN_TITEL))).toEqual([ZIEL_TITEL]);

      // ── 8 · LÖSCHEN MIT BESTÄTIGUNG — Filter mit Tasten leeren, Tab zum Löschknopf, Enter;
      // die Rückfrage steht in DIESER Zeile; Tab bis „Löschen“, Enter.
      await tasteBis({ selektor: '[data-testid="entwurfsliste-suche"]' }, "Suchfeld (Rückweg)");
      await feldLeeren(TITELWORT.length);
      await warteAuf(`(n) => (${SEITEN_TITEL})().length === n`, 1 + andereIds.length);
      await tasteBis({ selektor: `[data-loeschen="${ziel}"]` }, "Löschknopf des Zielentwurfs");
      expect(
        await s.evaluate<string | null>(
          fn(`() => document.activeElement.getAttribute('aria-label')`),
        ),
      ).toBe(wort("capture.discardDraftYes"));
      await fokusSichtbar("Löschknopf");
      await s.keyboard.press("Enter");
      await warteAuf(
        `() => document.querySelector('[data-testid="entwurfsliste-loeschen-ja"]') !== null`,
      );
      // Der Knopf allein löscht nichts.
      expect(
        (await bestand()).some((d) => d.id === ziel),
        "der Knopf allein hat gelöscht",
      ).toBe(true);
      const frageZeile = await s.evaluate<string>(
        fn(
          `() => ((document.querySelector('[data-testid="entwurfsliste-loeschen-ja"]').closest('li') || {}).textContent || '')`,
        ),
      );
      expect(frageZeile).toContain(wort("capture.discardDraftQ"));
      expect(frageZeile).toContain(ZIEL_TITEL);
      await tasteBis(
        { selektor: '[data-testid="entwurfsliste-loeschen-ja"]' },
        "„Löschen“ in der Rückfrage",
      );
      await s.keyboard.press("Enter");

      // ── 9 · EINTRAG WEG — auf der Fläche und am Bestand; die anderen bleiben.
      await warteAuf(
        `(id) => document.querySelector('[data-entwurf-fortsetzen="' + id + '"]') === null`,
        ziel,
      );
      expect(await s.evaluate<string[]>(fn(SEITEN_TITEL))).not.toContain(ZIEL_TITEL);
      const rest = (await bestand()).map((d) => d.id).sort();
      expect(rest).toEqual([...andereIds].sort());
    }, 180_000);
  }

  it("P · die Seite hat während der Folge nichts geworfen", () => {
    expect(fehler, "Prüfstand nicht aufgebaut").toBeNull();
    expect(seitenfehler).toEqual([]);
  });
});

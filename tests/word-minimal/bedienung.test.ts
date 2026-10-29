import { mkdirSync, readFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const folder = join(process.cwd(), "apps/web/public/word-addin");
const images = join(tmpdir(), `klarwerk-word-ui-min-${process.pid}`);
const calls: { path: string; method: string; body: Record<string, unknown> }[] = [];
const messages: Record<string, unknown>[] = [];
let conversation: Record<string, unknown> | null = null;
let consent = false;
const account = "ui-min-alex";
let slowAnswer = false;
let server: Server;
let browser: Browser;
let origin = "";
let counter = 0;

let kiFixture = false;
let kiStopped = false;
let releaseKi: (() => void) | null = null;
let kiArrival: (() => void) | null = null;
const kiView = (status: string) => ({
  job: { jobId: "ki-held", status, sendungen: 0 },
  auftrag: { ziel: "Fiktiver bestehender KI-Auftrag", offenePunkte: [] },
  wegGesperrt: null,
  paketAktuell: true,
  prompt: null,
  antworten: [],
});

const resolution = () => ({
  adminConfiguredMode: "deterministic",
  effectiveMode: "deterministic",
  provider: "Klarwerk",
  model: "deterministic",
  executionAllowed: true,
  deviation: false,
  externalConsentRequired: false,
  externalConsentGranted: false,
  blockedReason: null,
  payloadClasses: ["question", "candidate_texts"],
});
const officeExtra = String.raw`
(() => {
  const noop = () => {};
  const host = "__HOST__";
  const info = { host, platform: "OfficeOnline" };
  Office.onReady = (callback) => { if (callback) queueMicrotask(() => callback(info)); return Promise.resolve(info); };
  Office.context.document.url = "https://example.test/office/Fiktiv." + (host === "Excel" ? "xlsx" : "pptx");
  Office.context.document.getActiveViewAsync = (callback) => callback({ status: "succeeded", value: "edit" });
  Office.context.document.mode = "ReadWrite";
  Office.context.diagnostics = { version: "fiktiv", host, platform: "OfficeOnline" };
  window.__officeReads = 0;
  const selected = {
    address: "Fiktiv!B2:B4", rowCount: 3, columnCount: 1, cellCount: 3,
    values: [[4], [7], [9]], formulas: [[4], [7], [9]], text: [["4"], ["7"], ["9"]],
    valueTypes: [["Double"], ["Double"], ["Double"]], load: noop,
  };
  const target = { address: "Fiktiv!B5", formulas: [[""]], values: [[""]], load: noop };
  const sheet = { name: "Fiktiv", id: "sheet-ui", load: noop,
    getRange: (address) => address.includes("B2") ? selected : target };
  const workbook = { name: "Fiktiv.xlsx", load: noop,
    worksheets: { getActiveWorksheet: () => sheet }, getSelectedRange: () => selected,
    getSelectedRanges: () => ({ areas: { items: [selected], load: noop } }) };
  window.Excel = { run: (fn) => { window.__officeReads++; return Promise.resolve().then(
    () => fn({ workbook, sync: () => Promise.resolve() })); } };
  const range = { text: "Fiktive Folie", load: noop };
  const shape = { id: "shape-ui", name: "Textfeld", type: "TextBox", load: noop,
    left: 20, top: 20, width: 200, height: 80, rotation: 0, textFrame: { textRange: range } };
  const slide = { id: "slide-ui", load: noop, shapes: { items: [shape], load: noop } };
  const presentation = { slides: { items: [slide], load: noop },
    getSelectedSlides: () => ({ items: [slide], load: noop }),
    getSelectedShapes: () => ({ items: [shape], load: noop }) };
  window.PowerPoint = { run: (fn) => { window.__officeReads++; return Promise.resolve().then(
    () => fn({ presentation, sync: () => Promise.resolve() })); } };
})();
`;
const office = String.raw`
(() => {
  const noop = () => {};
  const collection = { items: [], load: noop };
  const range = {
    text: "Fiktive Wartung", load: noop, font: { highlightColor: null, color: null },
    paragraphs: collection, inlinePictures: collection, tables: collection, contentControls: collection,
    getHtml: () => ({ value: "<p>Fiktive Wartung</p>" }), getOoxml: () => ({ value: "<p/>" }),
    insertText: (text) => { window.__wordWrites.push(text); return range; },
    insertHtml: (text) => { window.__wordWrites.push(text); return range; },
    select: noop, clear: noop, getRange: () => range,
  };
  const paragraph = { ...range, uniqueLocalId: "p-ui-1", style: "Normal" };
  range.paragraphs = { items: [paragraph], load: noop };
  window.__wordWrites = [];
  const document = {
    url: "https://example.test/word/Fiktiv.docx", body: range,
    properties: { lastSaveTime: new Date("2026-10-29T10:00:00Z"), load: noop },
    getSelection: () => range,
    getSelectedDataAsync: (...args) => args.at(-1)({ status: "succeeded", value: "Fiktive Wartung" }),
    setSelectedDataAsync: (...args) => { window.__wordWrites.push(args[0]); args.at(-1)({ status: "succeeded" }); },
    addHandlerAsync: (...args) => { if (typeof args.at(-1) === "function") args.at(-1)({ status: "succeeded" }); },
    getFileAsync: (...args) => args.at(-1)({ status: "failed", error: { message: "Fiktiver Textweg" } }),
  };
  window.Office = {
    HostType: { Word: "Word" }, PlatformType: { OfficeOnline: "OfficeOnline", Mac: "Mac" },
    AsyncResultStatus: { Succeeded: "succeeded", Failed: "failed" },
    CoercionType: { Text: "text", Html: "html", Ooxml: "ooxml" }, FileType: { Compressed: "compressed" },
    EventType: { DocumentSelectionChanged: "selection" },
    context: { document, host: "Word", platform: "OfficeOnline", displayLanguage: "de-DE",
      requirements: { isSetSupported: () => true }, diagnostics: { version: "fiktiv", host: "Word" },
      ui: { displayDialogAsync: (...args) => args.at(-1)({ status: "failed" }) } },
    onReady: (cb) => { if (cb) queueMicrotask(() => cb({ host: "Word", platform: "OfficeOnline" }));
      return Promise.resolve({ host: "Word", platform: "OfficeOnline" }); },
  };
  window.Word = { run: (fn) => Promise.resolve().then(() => fn({ document, sync: () => Promise.resolve(),
    load: noop, trackedObjects: { add: noop, remove: noop } })) };
})();
`;
beforeAll(async () => {
  mkdirSync(images, { recursive: true });
  server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://fixture");
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as Record<string, unknown>;
    const json = (value: unknown, status = 200) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(value));
    };
    if (url.pathname.startsWith("/api/")) {
      calls.push({ path: url.pathname, method: req.method || "GET", body });
      if (url.pathname === "/api/auth/me")
        return json({ id: account, name: "Alex", role: "admin" });
      if (url.pathname === "/api/me/assistenz")
        return json({
          profil: { name: "Mira", avatar: "eule", fassung: 1 },
          einrichtungOffen: false,
        });

      if (url.pathname.includes("/ki-auftraege")) {
        if (url.pathname.endsWith("/uebergabe")) {
          kiArrival?.();
          await new Promise<void>((resolve) => {
            releaseKi = resolve;
          });
          return json({ sicht: kiView("gesendet"), gesendet: true, text: "Später Fiktivrücklauf" });
        }
        if (url.pathname.endsWith("/stopp")) {
          kiStopped = true;
          return json({ auftrag: kiView("gestoppt"), text: "Gestoppt" });
        }
        return json({
          auftraege:
            kiFixture && url.pathname.includes("/g-ki-original/")
              ? [kiView(kiStopped ? "gestoppt" : "vorbereitet")]
              : [],
        });
      }

      if (url.pathname === "/api/me/klara/gespraech") return json({ gespraech: conversation });
      if (url.pathname === "/api/me/klara/gespraeche") {
        conversation = {
          id: `g-${++counter}`,
          objektbezug: body.objektbezug,
          nachrichten: [],
          einwilligungAm: null,
          letzterSchritt: null,
        };
        messages.length = 0;
        consent = false;
        return json({ gespraech: conversation }, 201);
      }
      if (url.pathname.endsWith("/einwilligung")) {
        consent = body.erteilt === true;
        if (conversation) conversation.einwilligungAm = consent ? new Date().toISOString() : null;
        return json({ gespraech: conversation });
      }
      if (url.pathname.endsWith("/nachrichten")) {
        const message = {
          ...body,
          id: `m-${messages.length}`,
          angelegtAm: new Date().toISOString(),
        };
        messages.push(message);
        if (conversation) conversation.nachrichten = [...messages];
        return json({ nachricht: message, gespraech: conversation }, 201);
      }
      if (url.pathname.endsWith("/schritt")) {
        if (conversation) conversation.letzterSchritt = body;
        return json({ gespraech: conversation });
      }
      if (url.pathname === "/api/klara/sessions")
        return json(
          {
            sessionId: "session-ui",
            documentContextId: "doc-ui",
            actorId: account,
            resolution: resolution(),
            consentState: "not-required",
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
          },
          201,
        );
      if (url.pathname === "/api/klara/ai-status") return json(resolution());
      if (url.pathname.endsWith("/execute") || url.pathname === "/api/ask") {
        if (slowAnswer) {
          await new Promise<void>((resolve) => setTimeout(resolve, 800));
        }
        return json({
          answerId: "answer-ui",
          result: {
            answered: true,
            answer: "Wartung nur bei Stillstand.",
            sources: ["source-ui"],
            citedSources: ["source-ui"],
            trust: 99,
            evidence: { grade: "verified" },
          },
          belastbarkeit: { lage: "belegt", konflikte: [] },
        });
      }
      if (url.pathname === "/api/kos/source-ui")
        return json({
          id: "source-ui",
          title: "Wartungsquelle",
          version: 1,
          statement: "Wartung nur bei Stillstand.",
          status: "validiert",
          confidentiality: "intern",
          trust: 99,
          history: [],
        });
      if (url.pathname === "/api/me/klara/notizen")
        return json({
          notizen: [
            {
              id: "n-ui",
              titel: "Fiktive Notiz",
              inhalt: "Notiz aus demselben Konto",
              fassung: 3,
              art: "notiz",
              offeneFragen: [],
            },
          ],
        });
      if (url.pathname === "/api/me/klara/aufgaben") return json({ aufgaben: [] });
      if (url.pathname === "/api/me/klara/erinnerungen") return json({ erinnerungen: [] });
      if (url.pathname.endsWith("/ki-faehigkeiten"))
        return json({
          faehigkeiten: [],
          mcpText: "",
          lage: { keineKi: !kiFixture, erlaubteAnbieter: [] },
        });
      if (url.pathname === "/api/categories") return json({ categories: [] });
      if (url.pathname.includes("reasoner/status"))
        return json({ active: false, mode: "deterministic", reachable: "reachable" });
      return json({ message: "Fiktive Schnittstelle nicht eingerichtet" }, 404);
    }
    if (url.pathname.startsWith("/word-addin/") || url.pathname.startsWith("/office-addin/")) {
      try {
        const file = basename(url.pathname);
        const source = readFileSync(
          join(
            url.pathname.startsWith("/office-addin/")
              ? join(process.cwd(), "apps/web/public/office-addin")
              : folder,
            file,
          ),
        );
        const content = file.endsWith(".html")
          ? source
              .toString()
              .replaceAll(
                "__KW_FASSUNG__",
                url.pathname.startsWith("/office-addin/") || file === "begleitung.html"
                  ? "1.0.0.1"
                  : "1.0.0.2",
              )
          : source;
        res.writeHead(200, {
          "content-type": file.endsWith(".html")
            ? "text/html"
            : file.endsWith(".css")
              ? "text/css"
              : "text/javascript",
        });
        res.end(content);
        return;
      } catch {
        res.writeHead(404);
        res.end();
        return;
      }
    }
    if (url.pathname.startsWith("/assistenz/") || url.pathname.startsWith("/klara/")) {
      try {
        const asset = readFileSync(join(process.cwd(), "apps/web/public", url.pathname.slice(1)));
        res.writeHead(200, { "content-type": "image/png" });
        res.end(asset);
      } catch {
        res.writeHead(404);
        res.end();
      }
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture-Adresse fehlt");
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  console.log(`WORD_UI_IMAGES ${images}`);
});
afterAll(async () => {
  await browser?.close();
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
});
async function open(file = "taskpane.html", dark = false, host = ""): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width: 320, height: 640 },
    colorScheme: dark ? "dark" : "light",
  });
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith("https://appsforoffice.microsoft.com/"))
      return route.fulfill({
        contentType: "text/javascript",
        body: office + (host ? officeExtra.replaceAll("__HOST__", host) : ""),
      });
    return url.startsWith(origin) ? route.continue() : route.abort();
  });
  await page.goto(origin + (host ? "/office-addin/" : "/word-addin/") + file);
  await page.locator(".mini-name").waitFor();
  await page.waitForFunction("document.querySelector('.mini-name').textContent === 'Mira'");
  return page;
}
async function choose(page: Page, name: string) {
  await page.locator(".mini-menu-button").click();
  await page.locator(`#mini-menu-${name}`).click();
}
describe("Word UI-MIN · kontrollierter Browser, fiktiver Office- und API-Rand", () => {
  it.each([false, true])(
    "320px, dunkel=%s: vier Bereiche, Eingabe erreichbar, Werkzeuge und Entwurf bleiben",
    async (dark) => {
      const page = await open("taskpane.html", dark);
      try {
        await page.locator("#ask-input").fill("Ungesendeter Entwurf");
        expect(await page.evaluate("document.documentElement.scrollWidth <= 320")).toBe(true);
        const input = await page.locator("#ask-input").boundingBox();
        expect(input && input.y + input.height <= 640).toBe(true);
        expect(await page.locator("#wv-block").isVisible()).toBe(false);
        await page.screenshot({
          path: join(images, dark ? "word-320-dunkel.png" : "word-320-hell.png"),
        });
        await choose(page, "functions");
        for (const label of [
          "Wissen erfassen",
          "Dokument prüfen",
          "Begriffe",
          "Vorlagen und Bausteine",
          "Kalender",
          "Lernen und Vormachen",
          "Notizen",
          "Aufgaben",
          "Erinnerungen",
          "Arbeitsüberblick",
        ]) {
          expect(await page.getByRole("button", { name: label, exact: true }).isVisible()).toBe(
            true,
          );
        }
        await page.getByRole("button", { name: "Dokument prüfen", exact: true }).click();
        await page.locator("#wv-btn").waitFor({ state: "visible" });
        expect(await page.locator("#wv-btn").isEnabled()).toBe(true);
        await page.screenshot({
          path: join(images, dark ? "word-pruefen-dunkel.png" : "word-pruefen-hell.png"),
        });
        await page.keyboard.press("Escape");
        expect(await page.locator("#ask-input").inputValue()).toBe("Ungesendeter Entwurf");
        await choose(page, "settings");
        await page.getByRole("button", { name: "English", exact: true }).first().click();
        await page.keyboard.press("Escape");
        await choose(page, "help");
        await page.keyboard.press("Escape");
        expect(await page.locator("#ask-input").inputValue()).toBe("Ungesendeter Entwurf");
        expect(await page.evaluate("document.documentElement.scrollWidth <= 320")).toBe(true);
      } finally {
        await page.close();
      }
    },
  );
  it("persönlicher Verlauf benutzt den echten Drahtvertrag; neues Gespräch erhält den Entwurf", async () => {
    const page = await open();
    try {
      await choose(page, "settings");
      await page
        .getByRole("button", { name: "Gespräch auf diesem Konto speichern", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Gesprächsspeicherung widerrufen", exact: true })
        .waitFor();
      expect(consent).toBe(true);
      await page.keyboard.press("Escape");
      await page.locator("#ask-input").fill("Was gilt bei Wartung?");
      await page.locator("#ask-btn").click();
      await page.waitForFunction(
        "document.querySelector('#ask-btn').className.indexOf('laeuft') < 0 && !document.querySelector('#ask-input').disabled",
      );
      expect(calls.some((call) => call.path.endsWith("/execute"))).toBe(true);
      await page.locator("#ask-input").fill("Nächste Frage als Entwurf");
      await choose(page, "history");
      await page
        .locator("#mini-page-history")
        .getByText("Was gilt bei Wartung?", { exact: true })
        .waitFor();
      await page
        .locator("#mini-page-history")
        .getByText("Wartung nur bei Stillstand.", { exact: true })
        .waitFor();
      await page.keyboard.press("Escape");
      await choose(page, "new");
      await page.getByRole("button", { name: "Beginnen", exact: true }).click();
      await page.locator("#ask-input").waitFor({ state: "visible" });
      expect(await page.locator("#ask-input").inputValue()).toBe("Nächste Frage als Entwurf");
      expect(
        calls.some((call) => call.path.endsWith("/nachrichten") && call.body.modus === "frage"),
      ).toBe(true);
      await page.screenshot({ path: join(images, "word-final-320-hell.png") });
    } finally {
      await page.close();
    }
  });
  it("aktiver Frageabbruch bleibt im Menü erreichbar und verwirft den verspäteten Rücklauf", async () => {
    const page = await open();
    try {
      slowAnswer = true;
      await page.locator("#ask-input").fill("Fiktive langsame Frage");
      await page.locator("#ask-btn").click();
      await page
        .locator("#mini-active")
        .getByRole("button", { name: "Stopp", exact: true })
        .waitFor();
      await choose(page, "functions");
      await page
        .locator("#mini-active")
        .getByRole("button", { name: "Stopp", exact: true })
        .click();
      await page.waitForTimeout(1000);
      await page.keyboard.press("Escape");
      expect(await page.locator("#ask-input").inputValue()).toBe("Fiktive langsame Frage");
      expect(await page.locator("#ask-answer-block").isVisible()).toBe(false);
    } finally {
      slowAnswer = false;
      await page.close();
    }
  });
  it("Begleitung nutzt denselben kompakten Menü-/Ablageweg und erhält Dokumentkontrollen", async () => {
    const page = await open("begleitung.html", true);
    try {
      await page.locator("#kw-frage").fill("Entwurf aus der Begleitung");
      await page.screenshot({ path: join(images, "begleitung-320-dunkel.png") });
      expect(await page.evaluate("document.documentElement.scrollWidth <= 320")).toBe(true);
      await choose(page, "functions");
      await page.getByRole("button", { name: "Notizen", exact: true }).click();
      await page.getByText("Fiktive Notiz", { exact: true }).waitFor();
      await page.keyboard.press("Escape");
      await page.locator("#mini-context").click();
      expect(await page.locator("#kw-zustimmen-knopf").isVisible()).toBe(true);
      expect(await page.locator("#kw-vertraulichkeit").isVisible()).toBe(true);
      await page.keyboard.press("Escape");
      expect(await page.locator("#kw-frage").inputValue()).toBe("Entwurf aus der Begleitung");
    } finally {
      await page.close();
    }
  });

  it.each(["Excel", "PowerPoint"])(
    "Einbettung %s: Entwurf, Auswahl und Rückgabe bleiben erreichbar",
    async (host) => {
      const page = await open("taskpane.html", true, host);
      try {
        await page.locator("#frage-text").fill("Nicht gesendete Office-Frage");
        await page.screenshot({ path: join(images, `${host.toLowerCase()}-320-dunkel.png`) });
        expect(await page.evaluate("document.documentElement.scrollWidth <= 320")).toBe(true);
        expect(await page.locator("#mini-context").innerText()).toContain(host);
        const before = await page.evaluate("window.__officeReads");
        await choose(page, "functions");
        await page.getByRole("button", { name: "Markierung", exact: true }).click();
        await page.locator("#kontext-lesen").click();
        await page.waitForFunction(`window.__officeReads > ${before}`);
        await page.locator("#kontext-details > summary").click();
        await page.waitForFunction(
          "document.getElementById('kontext-text').textContent.includes('Fiktiv')",
        );
        const context = await page.locator("#kontext-text").innerText();
        expect(context).toContain("Fiktiv");
        await page.keyboard.press("Escape");
        await choose(page, "functions");
        await page.getByRole("button", { name: "Ins Dokument übernehmen", exact: true }).click();
        if (host === "Excel") {
          await page.locator("#summe-vorbereiten").click();
          await page.locator("#plan").waitFor({ state: "visible" });
          expect(await page.locator("#plan-ausfuehren").isEnabled()).toBe(true);
          expect(await page.evaluate("window.__wordWrites.length")).toBe(0);
          await page.locator("#plan-verwerfen").click();
          expect(await page.locator("#plan").isVisible()).toBe(false);
        } else {
          expect(await page.locator("#formtext-vorbereiten").isVisible()).toBe(true);
        }
        await page.keyboard.press("Escape");
        expect(await page.locator("#frage-text").inputValue()).toBe("Nicht gesendete Office-Frage");
      } finally {
        await page.close();
      }
    },
  );

  it("Notizentwurf bleibt beim Wechsel zwischen Gespräch und Funktionen erhalten", async () => {
    const page = await open();
    try {
      await choose(page, "functions");
      await page.getByRole("button", { name: "Notizen", exact: true }).click();
      const notes = page.locator("#mini-page-notes");
      await notes.getByRole("button", { name: "Anlegen", exact: true }).click();
      await notes.getByLabel("Titel", { exact: true }).fill("Unbestätigter Notiztitel");
      await notes
        .getByLabel("Inhalt", { exact: true })
        .fill("Dieser Text ist noch nicht gespeichert.");
      const writes = calls.filter(
        (call) => call.path === "/api/me/klara/notizen" && call.method === "POST",
      ).length;
      await page.keyboard.press("Escape");
      await choose(page, "functions");
      await page.getByRole("button", { name: "Aufgaben", exact: true }).click();
      await page.keyboard.press("Escape");
      await choose(page, "functions");
      await page.getByRole("button", { name: "Notizen", exact: true }).click();
      expect(await notes.getByLabel("Titel", { exact: true }).inputValue()).toBe(
        "Unbestätigter Notiztitel",
      );
      expect(await notes.getByLabel("Inhalt", { exact: true }).inputValue()).toBe(
        "Dieser Text ist noch nicht gespeichert.",
      );
      expect(
        calls.filter((call) => call.path === "/api/me/klara/notizen" && call.method === "POST")
          .length,
      ).toBe(writes);
    } finally {
      await page.close();
    }
  });

  it("KI-Übergabe bleibt nach Gesprächswechsel am ursprünglichen Job stoppbar", async () => {
    kiFixture = true;
    kiStopped = false;
    conversation = { id: "g-ki-original", objektbezug: {}, nachrichten: [], einwilligungAm: null };
    const page = await open();
    try {
      const arrived = new Promise<void>((resolve) => {
        kiArrival = resolve;
      });
      await choose(page, "functions");
      await page.getByRole("button", { name: "Mit KI arbeiten", exact: true }).click();
      const returned = page.waitForResponse((response) => response.url().endsWith("/uebergabe"));
      await page.getByRole("button", { name: "Bewusst übernehmen", exact: true }).click();
      await arrived;
      const stop = page.locator("#mini-active").getByRole("button", { name: "Stopp", exact: true });
      expect(await stop.isVisible()).toBe(true);
      await page.keyboard.press("Escape");
      await choose(page, "new");
      await page.getByRole("button", { name: "Beginnen", exact: true }).click();
      await page.locator("#ask-input").waitFor({ state: "visible" });
      expect(await stop.isVisible()).toBe(true);
      await stop.click();
      await stop.waitFor({ state: "hidden" });
      expect(
        calls.some(
          (call) =>
            call.path === "/api/me/klara/gespraeche/g-ki-original/ki-auftraege/ki-held/stopp",
        ),
      ).toBe(true);
      releaseKi?.();
      await returned;
      await page.evaluate(
        "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
      );
      expect(await page.locator("#mini-active .mini-active-row").count()).toBe(0);
    } finally {
      releaseKi?.();
      kiArrival = null;
      kiFixture = false;
      await page.close();
    }
  });

  it("Ben-Folge: Profilentwurf bleibt bis Speichern, Verwerfen oder Kontowechsel erhalten", async () => {
    const page = await open();
    let stored = { name: "Mira", avatar: "eule", fassung: 1 };
    const writes: Record<string, unknown>[] = [];
    let reads = 0;
    try {
      await page.route(`${origin}/api/me/assistenz`, (route) => {
        if (route.request().method() === "PUT") {
          const body = route.request().postDataJSON();
          writes.push(body);
          stored = { name: body.name, avatar: body.avatar, fassung: stored.fassung + 1 };
        } else reads++;
        return route.fulfill({ json: { profil: stored, einrichtungOffen: false } });
      });
      const profile = page.locator("#mini-page-profile");
      await choose(page, "settings");
      await page.getByRole("button", { name: "Name und Avatar", exact: true }).click();
      await profile.getByLabel("Name", { exact: true }).fill("Ungespeicherter Profilname");
      await profile.getByLabel("Avatar", { exact: true }).selectOption("fuchs");
      const initialReads = reads;
      await page.keyboard.press("Escape");
      await choose(page, "settings");
      await page.getByRole("button", { name: "Name und Avatar", exact: true }).click();
      expect(await profile.getByLabel("Name", { exact: true }).inputValue()).toBe(
        "Ungespeicherter Profilname",
      );
      expect(await profile.getByLabel("Avatar", { exact: true }).inputValue()).toBe("fuchs");
      expect(reads).toBe(initialReads);
      expect(writes).toEqual([]);

      await profile.getByRole("button", { name: "Abbrechen", exact: true }).click();
      await page.getByRole("button", { name: "Name und Avatar", exact: true }).click();
      expect(await profile.getByLabel("Name", { exact: true }).inputValue()).toBe("Mira");
      expect(await profile.getByLabel("Avatar", { exact: true }).inputValue()).toBe("eule");
      expect(writes).toEqual([]);
      await profile.getByLabel("Name", { exact: true }).fill("Bewusst gespeicherter Name");
      await profile.getByLabel("Avatar", { exact: true }).selectOption("pinguin");
      await profile.getByRole("button", { name: "Profil speichern", exact: true }).click();
      await page.waitForFunction(
        "document.querySelector('.mini-name').textContent === 'Bewusst gespeicherter Name'",
      );
      expect(writes).toEqual([
        { fassung: 1, name: "Bewusst gespeicherter Name", avatar: "pinguin" },
      ]);
      await choose(page, "settings");
      await page.getByRole("button", { name: "Name und Avatar", exact: true }).click();
      await profile.getByLabel("Name", { exact: true }).fill("Privater Entwurf aus Konto A");
      stored = { name: "Profil von Konto B", avatar: "kompass", fassung: 7 };
      await page.route(`${origin}/api/auth/me`, (route) =>
        route.fulfill({ json: { id: "ui-min-b", name: "Konto B", role: "admin" } }),
      );
      await page.evaluate("checkSession()");
      await page.waitForFunction(
        "window.kwWordUi.account === 'ui-min-b' && document.querySelector('.mini-name').textContent === 'Profil von Konto B'",
      );
      await page.keyboard.press("Escape");
      await choose(page, "settings");
      await page.getByRole("button", { name: "Name und Avatar", exact: true }).click();
      expect(await profile.getByLabel("Name", { exact: true }).inputValue()).toBe(
        "Profil von Konto B",
      );
      expect(await profile.getByLabel("Avatar", { exact: true }).inputValue()).toBe("kompass");
      expect(writes).toHaveLength(1);
    } finally {
      await page.close();
    }
  });

  it("Ben-Folge: verspätete A-Erstellung überschreibt nach Kontowechsel kein B-Gespräch", async () => {
    conversation = null;
    const page = await open();
    let release: (() => void) | undefined;
    let arrive: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const arrived = new Promise<void>((resolve) => {
      arrive = resolve;
    });
    const consentWrites: string[] = [];
    const b = {
      id: "g-konto-b",
      objektbezug: {},
      einwilligungAm: null,
      nachrichten: [{ id: "m-b", von: "du", text: "Nur Konto B", quellenAngaben: [] }],
    };
    try {
      await page.route(`${origin}/api/me/klara/gespraeche`, async (route) => {
        expect(route.request().method()).toBe("POST");
        expect(route.request().postDataJSON().objektbezug.seitenName).toBe("Word");
        arrive?.();
        await held;
        await route.fulfill({
          status: 201,
          json: {
            gespraech: {
              id: "g-konto-a-spaet",
              objektbezug: {},
              einwilligungAm: "2026-10-29T10:00:00Z",
              nachrichten: [
                { id: "m-a", von: "du", text: "Privater Rücklauf aus Konto A", quellenAngaben: [] },
              ],
            },
          },
        });
      });
      await page.route(`${origin}/api/me/klara/gespraeche/*/einwilligung`, (route) => {
        consentWrites.push(new URL(route.request().url()).pathname);
        return route.fulfill({ json: { gespraech: b } });
      });
      await choose(page, "settings");
      const returned = page.waitForResponse(
        (response) => response.url() === `${origin}/api/me/klara/gespraeche`,
      );
      await page
        .getByRole("button", { name: "Gespräch auf diesem Konto speichern", exact: true })
        .click();
      await arrived;
      await page.route(`${origin}/api/auth/me`, (route) =>
        route.fulfill({ json: { id: "ui-min-b", name: "Konto B", role: "admin" } }),
      );
      await page.route(`${origin}/api/me/klara/gespraech`, (route) =>
        route.fulfill({ json: { gespraech: b } }),
      );
      await page.evaluate("checkSession()");
      await page.waitForFunction(
        "window.kwWordUi.account === 'ui-min-b' && window.kwWordUi.conversationId === 'g-konto-b'",
      );
      await page.keyboard.press("Escape");
      await choose(page, "history");
      const history = page.locator("#mini-page-history");
      await history.getByText("Nur Konto B", { exact: true }).waitFor();
      release?.();
      await (await returned).finished();
      await page.evaluate(
        "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
      );
      expect(await page.evaluate("window.kwWordUi.conversationId")).toBe("g-konto-b");
      expect(await page.evaluate("window.kwWordUi.account")).toBe("ui-min-b");
      expect(await history.getByText("Nur Konto B", { exact: true }).isVisible()).toBe(true);
      expect(await page.getByText("Privater Rücklauf aus Konto A", { exact: true }).count()).toBe(
        0,
      );
      expect(consentWrites).toEqual([]);
      await page.keyboard.press("Escape");
      await choose(page, "settings");
      expect(
        await page
          .getByRole("button", { name: "Gespräch auf diesem Konto speichern", exact: true })
          .isVisible(),
      ).toBe(true);
    } finally {
      release?.();
      await page.close();
    }
  });
});

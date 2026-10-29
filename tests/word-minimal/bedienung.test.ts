import { readFileSync, mkdirSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const folder = join(process.cwd(), "apps/web/public/word-addin");
const images = join(tmpdir(), "klarwerk-word-ui-min-" + process.pid);
const calls: { path: string; method: string; body: Record<string, unknown> }[] = [];
const messages: Record<string, unknown>[] = [];
let conversation: Record<string, unknown> | null = null;
let consent = false;
let account = "ui-min-alex";
let slowAnswer = false;
let server: Server;
let browser: Browser;
let origin = "";
let counter = 0;
const resolution = () => ({
  adminConfiguredMode: "deterministic", effectiveMode: "deterministic", provider: "Klarwerk",
  model: "deterministic", executionAllowed: true, deviation: false,
  externalConsentRequired: false, externalConsentGranted: false,
  blockedReason: null, payloadClasses: ["question", "candidate_texts"],
});
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
      res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value));
    };
    if (url.pathname.startsWith("/api/")) {
      calls.push({ path: url.pathname, method: req.method || "GET", body });
      if (url.pathname === "/api/auth/me") return json({ id: account, name: "Alex", role: "admin" });
      if (url.pathname === "/api/me/assistenz") return json({ profil: { name: "Mira", avatar: "eule", fassung: 1 }, einrichtungOffen: false });
      if (url.pathname === "/api/me/klara/gespraech") return json({ gespraech: conversation });
      if (url.pathname === "/api/me/klara/gespraeche") {
        conversation = { id: "g-" + ++counter, objektbezug: body.objektbezug, nachrichten: [],
          einwilligungAm: null, letzterSchritt: null };
        messages.length = 0; consent = false;
        return json({ gespraech: conversation }, 201);
      }
      if (url.pathname.endsWith("/einwilligung")) {
        consent = body.erteilt === true;
        if (conversation) conversation.einwilligungAm = consent ? new Date().toISOString() : null;
        return json({ gespraech: conversation });
      }
      if (url.pathname.endsWith("/nachrichten")) {
        const message = { ...body, id: "m-" + messages.length, angelegtAm: new Date().toISOString() };
        messages.push(message);
        if (conversation) conversation.nachrichten = [...messages];
        return json({ nachricht: message, gespraech: conversation }, 201);
      }
      if (url.pathname.endsWith("/schritt")) {
        if (conversation) conversation.letzterSchritt = body;
        return json({ gespraech: conversation });
      }
      if (url.pathname === "/api/klara/sessions") return json({
        sessionId: "session-ui", documentContextId: "doc-ui", actorId: account, resolution: resolution(),
        consentState: "not-required", expiresAt: new Date(Date.now() + 300_000).toISOString(),
      }, 201);
      if (url.pathname === "/api/klara/ai-status") return json(resolution());
      if (url.pathname.endsWith("/execute") || url.pathname === "/api/ask") {
        if (slowAnswer) { await new Promise<void>((resolve) => setTimeout(resolve, 800)); }
        return json({ answerId: "answer-ui", result: {
          answered: true, answer: "Wartung nur bei Stillstand.", sources: ["source-ui"],
          citedSources: ["source-ui"], trust: 99, evidence: { grade: "verified" },
        }, belastbarkeit: { lage: "belegt", konflikte: [] } });
      }
      if (url.pathname === "/api/kos/source-ui") return json({ id: "source-ui", title: "Wartungsquelle", version: 1,
        statement: "Wartung nur bei Stillstand.", status: "validiert", confidentiality: "intern", trust: 99, history: [] });
      if (url.pathname === "/api/me/klara/notizen") return json({ notizen: [{ id: "n-ui", titel: "Fiktive Notiz",
        inhalt: "Notiz aus demselben Konto", fassung: 3, art: "notiz", offeneFragen: [] }] });
      if (url.pathname === "/api/me/klara/aufgaben") return json({ aufgaben: [] });
      if (url.pathname === "/api/me/klara/erinnerungen") return json({ erinnerungen: [] });
      if (url.pathname.endsWith("/ki-faehigkeiten")) return json({ faehigkeiten: [], mcpText: "",
        lage: { keineKi: true, erlaubteAnbieter: [] } });
      if (url.pathname === "/api/categories") return json({ categories: [] });
      if (url.pathname.includes("reasoner/status")) return json({ active: false, mode: "deterministic", reachable: "reachable" });
      return json({ message: "Fiktive Schnittstelle nicht eingerichtet" }, 404);
    }
    if (url.pathname.startsWith("/word-addin/")) {
      try {
        const file = basename(url.pathname);
        const source = readFileSync(join(folder, file));
        const content = file.endsWith(".html") ? source.toString().replaceAll("__KW_FASSUNG__",
          file === "begleitung.html" ? "1.0.0.1" : "1.0.0.2") : source;
        res.writeHead(200, { "content-type": file.endsWith(".html") ? "text/html" :
          file.endsWith(".css") ? "text/css" : "text/javascript" });
        res.end(content); return;
      } catch { res.writeHead(404); res.end(); return; }
    }
    if (url.pathname.startsWith("/assistenz/") || url.pathname.startsWith("/klara/")) {
      try {
        const asset = readFileSync(join(process.cwd(), "apps/web/public", url.pathname.slice(1)));
        res.writeHead(200, { "content-type": "image/png" }); res.end(asset);
      } catch { res.writeHead(404); res.end(); }
      return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture-Adresse fehlt");
  origin = "http://127.0.0.1:" + address.port;
  browser = await chromium.launch({ headless: true });
  console.log("WORD_UI_IMAGES " + images);
});
afterAll(async () => {
  await browser?.close();
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
async function open(file = "taskpane.html", dark = false): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 320, height: 640 }, colorScheme: dark ? "dark" : "light" });
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith("https://appsforoffice.microsoft.com/")) return route.fulfill({ contentType: "text/javascript", body: office });
    return url.startsWith(origin) ? route.continue() : route.abort();
  });
  await page.goto(origin + "/word-addin/" + file);
  await page.locator(".mini-name").waitFor();
  await page.waitForFunction("document.querySelector('.mini-name').textContent === 'Mira'");
  return page;
}
async function choose(page: Page, name: string) {
  await page.locator(".mini-menu-button").click();
  await page.locator("#mini-menu-" + name).click();
}
describe("Word UI-MIN · kontrollierter Browser, fiktiver Office- und API-Rand", () => {
  it.each([false, true])("320px, dunkel=%s: vier Bereiche, Eingabe erreichbar, Werkzeuge und Entwurf bleiben", async (dark) => {
    const page = await open("taskpane.html", dark);
    try {
      await page.locator("#ask-input").fill("Ungesendeter Entwurf");
      expect(await page.evaluate("document.documentElement.scrollWidth <= 320")).toBe(true);
      const input = await page.locator("#ask-input").boundingBox();
      expect(input && input.y + input.height <= 640).toBe(true);
      expect(await page.locator("#wv-block").isVisible()).toBe(false);
      await page.screenshot({ path: join(images, dark ? "word-320-dunkel.png" : "word-320-hell.png") });
      await choose(page, "functions");
      for (const label of ["Wissen erfassen", "Dokument prüfen", "Begriffe", "Vorlagen und Bausteine", "Kalender",
        "Lernen und Vormachen", "Notizen", "Aufgaben", "Erinnerungen", "Arbeitsüberblick"]) {
        expect(await page.getByRole("button", { name: label, exact: true }).isVisible()).toBe(true);
      }
      await page.getByRole("button", { name: "Dokument prüfen", exact: true }).click();
      await page.locator("#wv-btn").waitFor({ state: "visible" });
      expect(await page.locator("#wv-btn").isEnabled()).toBe(true);
      await page.screenshot({ path: join(images, dark ? "word-pruefen-dunkel.png" : "word-pruefen-hell.png") });
      await page.keyboard.press("Escape");
      expect(await page.locator("#ask-input").inputValue()).toBe("Ungesendeter Entwurf");
      await choose(page, "settings");
      await page.getByRole("button", { name: "English", exact: true }).first().click();
      await page.keyboard.press("Escape");
      await choose(page, "help");
      await page.keyboard.press("Escape");
      expect(await page.locator("#ask-input").inputValue()).toBe("Ungesendeter Entwurf");
      expect(await page.evaluate("document.documentElement.scrollWidth <= 320")).toBe(true);
    } finally { await page.close(); }
  });
  it("persönlicher Verlauf benutzt den echten Drahtvertrag; neues Gespräch erhält den Entwurf", async () => {
    const page = await open();
    try {
      await choose(page, "settings");
      await page.getByRole("button", { name: "Gespräch auf diesem Konto speichern", exact: true }).click();
      await page.getByRole("button", { name: "Gesprächsspeicherung widerrufen", exact: true }).waitFor();
      expect(consent).toBe(true);
      await page.keyboard.press("Escape");
      await page.locator("#ask-input").fill("Was gilt bei Wartung?");
      await page.locator("#ask-btn").click();
      await page.waitForFunction("document.querySelector('#ask-btn').className.indexOf('laeuft') < 0 && !document.querySelector('#ask-input').disabled");
      expect(calls.some((call) => call.path.endsWith("/execute"))).toBe(true);
      await page.locator("#ask-input").fill("Nächste Frage als Entwurf");
      await choose(page, "history");
      await page.getByText("Was gilt bei Wartung?", { exact: true }).waitFor();
      await page.keyboard.press("Escape");
      await choose(page, "new");
      await page.getByRole("button", { name: "Beginnen", exact: true }).click();
      expect(await page.locator("#ask-input").inputValue()).toBe("Nächste Frage als Entwurf");
      expect(calls.some((call) => call.path.endsWith("/nachrichten") && call.body.modus === "frage")).toBe(true);
    } finally { await page.close(); }
  });
  it("aktiver Frageabbruch bleibt im Menü erreichbar und verwirft den verspäteten Rücklauf", async () => {
    const page = await open();
    try {
      slowAnswer = true;
      await page.locator("#ask-input").fill("Fiktive langsame Frage");
      await page.locator("#ask-btn").click();
      await page.locator("#mini-active").getByRole("button", { name: "Stopp", exact: true }).waitFor();
      await choose(page, "functions");
      await page.locator("#mini-active").getByRole("button", { name: "Stopp", exact: true }).click();
      await page.waitForTimeout(1000);
      await page.keyboard.press("Escape");
      expect(await page.locator("#ask-input").inputValue()).toBe("Fiktive langsame Frage");
      expect(await page.locator("#ask-answer-block").isVisible()).toBe(false);
    } finally { slowAnswer = false; await page.close(); }
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
    } finally { await page.close(); }
  });
});

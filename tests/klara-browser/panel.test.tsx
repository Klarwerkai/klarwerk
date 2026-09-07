import { createRequire } from "node:module";
import { setImmediate } from "node:timers";
import { afterEach, describe, expect, it } from "vitest";
import { pages } from "./fixtures";
import { harness, read } from "./harness";

const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (html: string, options: object) => { window: Window & typeof globalThis };
};
const windows: (Window & typeof globalThis)[] = [];
afterEach(() => {
  for (const window of windows.splice(0)) window.close();
});
async function mount() {
  let draft: Record<string, unknown> | null = null;
  const requests: string[] = [];
  const h = harness(async (url, options) => {
    requests.push(String(url));
    if (String(url).endsWith("/login"))
      return Response.json({
        token: "fixture-session-secret",
        user: { id: "person-a", email: "a@example.test" },
      });
    if (options?.method === "POST")
      draft = {
        id: "draft-test",
        originalAuthor: "person-a",
        payload: JSON.parse(String(options.body)),
      };
    return Response.json(draft, { status: options?.method === "POST" ? 201 : 200 });
  });
  await h.capture();
  const dom = new JSDOM(read("panel.html"), {
    url: "https://extension-view.invalid/panel.html",
    runScripts: "outside-only",
  });
  windows.push(dom.window);
  const win = dom.window;
  const pending: Promise<unknown>[] = [];
  const messages: unknown[] = [];
  Object.defineProperty(win, "chrome", {
    value: {
      runtime: {
        sendMessage: (message: unknown) => {
          messages.push(message);
          const job = h.sendRaw(message);
          pending.push(job);
          return job;
        },
      },
      storage: { onChanged: { addListener: () => {} } },
    },
  });
  win.eval(read("i18n.js"));
  win.eval(read("panel.js"));
  // A real response and its render microtask, never an arbitrary sleep.
  const settle = async () => {
    await new Promise<void>((done) => setImmediate(done));
    while (pending.length) {
      await Promise.all(pending.splice(0));
      await new Promise<void>((done) => setImmediate(done));
    }
  };
  await settle();
  const el = (id: string) => win.document.getElementById(id) as HTMLInputElement;
  const input = (id: string, value: string) => {
    el(id).value = value;
    el(id).dispatchEvent(new win.Event("input", { bubbles: true }));
  };
  const login = async () => {
    input("email", "a@example.test");
    input("password", "fixture-password");
    el("login-form").dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
    await settle();
  };
  return { ...h, win, el, input, settle, login, requests, messages };
}

describe("Klara · echte HTML- und Skript-Einstiege im DOM", () => {
  it("Inhaltsskript liest ausschließlich die echte Markierung mit Umlauten, Zeilenumbrüchen und fremdem HTML als Text", () => {
    const dom = new JSDOM(
      '<title>Quelle</title><p id="chosen"></p><p>NICHT GEWÄHLT</p><input value="VERBORGEN" type="password">',
      { url: "https://www.perplexity.ai/search/test", runScripts: "outside-only" },
    );
    windows.push(dom.window);
    const p = dom.window.document.getElementById("chosen");
    if (!p) throw new Error("Missing selected paragraph");
    const text = "  Grüße äöü\n<script>evil()</script>\nEnde  ";
    p.textContent = text;
    const range = dom.window.document.createRange();
    range.selectNodeContents(p);
    dom.window.getSelection()?.addRange(range);
    const result = dom.window.eval(read("selection.js"));
    expect(result).toEqual({ text, title: "Quelle", url: "https://www.perplexity.ai/search/test" });
    expect(dom.window.document.body.textContent).toContain("NICHT GEWÄHLT");
  });
  it.each(pages)("$name: echtes Inhaltsskript liest ausschließlich markierten DOM-Text", (page) => {
    const dom = new JSDOM(
      `<title></title>${page.markup}<aside>NICHT GEWÄHLT</aside><input type="password" value="VERBORGEN">`,
      { url: page.url, runScripts: "outside-only" },
    );
    windows.push(dom.window);
    dom.window.document.title = page.title;
    const chosen = dom.window.document.getElementById("chosen");
    if (!chosen) throw new Error("Auswahl fehlt");
    chosen.textContent = page.text;
    const range = dom.window.document.createRange();
    range.selectNodeContents(chosen);
    dom.window.getSelection()?.addRange(range);
    expect(dom.window.eval(read("selection.js"))).toEqual({
      text: page.text,
      title: page.title,
      url: page.url,
    });
  });
  it("DE/EN: volle Vorschau, Text statt HTML, bewusste Bestätigung und wirkender Entwurfslink", async () => {
    const h = await mount();
    expect(h.el("text").textContent).toBe(h.selected.text);
    expect(h.el("text").querySelector("script")).toBeNull();
    expect(h.el("confidentiality").value).toBe("");
    expect(h.el("save").disabled).toBe(true);
    for (const language of ["de", "en"]) {
      h.el("language").value = language;
      h.el("language").dispatchEvent(new h.win.Event("change"));
      expect(h.win.document.documentElement.lang).toBe(language);
      expect(h.el("save").textContent).toBe(
        language === "de" ? "Bewusst als Entwurf speichern" : "Confirm and save draft",
      );
      expect(h.el("text").textContent).toBe(h.selected.text);
      expect(h.win.document.body.textContent).not.toContain("Perplexity");
      expect(h.win.document.body.textContent).toContain(
        language === "de" ? "HTTP(S)-Webseite" : "HTTP(S) webpage",
      );
    }
    await h.login();
    expect(h.el("password").value).toBe("");
    expect(h.el("save").disabled).toBe(true);
    h.input("title", "Eigener Titel");
    h.input("context", "Notiz\nmit Umlaut ä");
    await h.settle();
    h.el("confirm").checked = true;
    h.el("confirm").dispatchEvent(new h.win.Event("change"));
    expect(h.el("save").disabled).toBe(false);
    h.el("save").click();
    h.el("save").click();
    await h.settle();
    expect(h.requests.filter((u) => u.endsWith("/api/drafts"))).toHaveLength(1);
    expect(h.el("status").textContent).toContain("Saved as an unreviewed draft");
    expect(h.el("open").getAttribute("href")).toBe(
      "https://app.klarwerk.ai/capture/frontdoor?draft=draft-test",
    );
    expect(h.win.document.documentElement.outerHTML).not.toContain("fixture-session-secret");
  });
  it("Enter in Vorschau sendet nichts; Eingabe entwertet Bestätigung; Abbrechen legt nichts an", async () => {
    const h = await mount();
    await h.login();
    h.el("confirm").checked = true;
    h.el("confirm").dispatchEvent(new h.win.Event("change"));
    h.input("context", "Geändert");
    await h.settle();
    expect(h.el("confirm").checked).toBe(false);
    h.el("context").dispatchEvent(
      new h.win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(h.el("context").closest("form")).toBeNull();
    h.el("cancel").click();
    await h.settle();
    expect(h.el("preview").hidden).toBe(true);
    expect(h.requests.filter((u) => u.endsWith("/api/drafts"))).toHaveLength(0);
  });
  it("beide Sprachen besitzen dieselben Zustände und jedes sichtbare Textelement hat eine Übersetzung", async () => {
    const h = await mount();
    const copy = h.win.eval("globalThis.KLARA_TEXT") as Record<"de" | "en", Record<string, string>>;
    expect(Object.keys(copy.de).sort()).toEqual(Object.keys(copy.en).sort());
    for (const node of h.win.document.querySelectorAll("[data-i18n]")) {
      const key = node.getAttribute("data-i18n") ?? "";
      expect(copy.de[key]).toBeTruthy();
      expect(copy.en[key]).toBeTruthy();
    }
  });
});

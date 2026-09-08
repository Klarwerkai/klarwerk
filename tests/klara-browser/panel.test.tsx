import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import { pages } from "./fixtures";
import { read } from "./harness";
// JOB 3278: der gemountete Prüfstand wohnt jetzt in `panel-dom.ts` und wird von dieser Datei UND
// von `seitenleiste.test.ts` benutzt — ein Aufbau, nicht zwei.
import { mount, schliesseFenster, windows } from "./panel-dom";

const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (html: string, options: object) => { window: Window & typeof globalThis };
};
afterEach(schliesseFenster);

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

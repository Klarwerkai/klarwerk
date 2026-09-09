import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import type { Variants } from "../../extensions/klara-browser/types";
import { pages } from "./fixtures";
import { read } from "./harness";
import { mount, windows as panelWindows } from "./panel-dom";

/** Was das echte Inhaltsskript zurückgibt — hier vollständig getippt, nicht als `unknown`. */
type CaptureResult = { text: string; title: string; url: string; variants: Variants };

const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (html: string, options: object) => { window: Window & typeof globalThis };
};
const windows: (Window & typeof globalThis)[] = [];
afterEach(() => {
  for (const window of windows.splice(0)) window.close();
  for (const window of panelWindows.splice(0)) window.close();
});
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
    const result = dom.window.eval(read("selection.js")) as CaptureResult;
    // JOB 3279: das Skript liefert jetzt zusätzlich die drei wählbaren Umfänge. Die Enge des
    // alten `toEqual` bleibt: der Schlüsselsatz ist gepinnt, und die MARKIERUNG trägt weiterhin
    // ausschließlich das Markierte — nicht die Nachbarschaft und nicht das Passwortfeld.
    expect(Object.keys(result).sort()).toEqual(["text", "title", "url", "variants"]);
    expect({ text: result.text, title: result.title, url: result.url }).toEqual({
      text,
      title: "Quelle",
      url: "https://www.perplexity.ai/search/test",
    });
    expect(result.variants.selection.text).toBe(text);
    expect(JSON.stringify(result.variants.selection)).not.toContain("NICHT GEWÄHLT");
    expect(JSON.stringify(result.variants)).not.toContain("VERBORGEN");
    // Die zugängliche Seite ist ein ANDERER Umfang und sieht den Nachbarabsatz — bewusst.
    expect(JSON.stringify(result.variants.page)).toContain("NICHT GEWÄHLT");
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
    const result = dom.window.eval(read("selection.js")) as CaptureResult;
    expect({ text: result.text, title: result.title, url: result.url }).toEqual({
      text: page.text,
      title: page.title,
      url: page.url,
    });
    expect(result.variants.selection.text).toBe(page.text);
    expect(JSON.stringify(result.variants.selection)).not.toContain("NICHT GEWÄHLT");
    expect(JSON.stringify(result.variants)).not.toContain("VERBORGEN");
  });
  it("DE/EN: volle Vorschau, Text statt HTML, bewusste Bestätigung und wirkender Entwurfslink", async () => {
    const h = await mount();
    expect(h.plain("content")).toContain(h.selected.text);
    expect(h.el("content").querySelector("script")).toBeNull();
    expect(h.el("confidentiality").value).toBe("");
    expect(h.el("save").disabled).toBe(true);
    for (const language of ["de", "en"]) {
      h.el("language").value = language;
      h.el("language").dispatchEvent(new h.win.Event("change"));
      expect(h.win.document.documentElement.lang).toBe(language);
      expect(h.el("save").textContent).toBe(
        language === "de" ? "Bewusst als Entwurf speichern" : "Confirm and save draft",
      );
      expect(h.plain("content")).toContain(h.selected.text);
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
    // JOB 3280 (Pedi 08.09. 14:22, Nachführung im Auftrag): der Link trägt die AKTUELLE Sprache
    // der Leiste mit — hier steht sie auf EN, weil die Schleife oben zuletzt auf EN gestellt hat.
    // Was die Vollapp heute daraus macht, steht im Kommentar bei `oeffnenLink` in panel.js.
    expect(h.el("open").getAttribute("href")).toBe(
      "https://app.klarwerk.ai/capture/frontdoor?draft=draft-test&lang=en",
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

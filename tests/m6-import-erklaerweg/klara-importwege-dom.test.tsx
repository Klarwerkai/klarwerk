// @vitest-environment jsdom
// Das vollständige ausgelieferte Dokument wird geparst; Layout/Tasten misst der Browser-Test.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ImportSourceGallery } from "../../apps/web/src/components/ImportSourceGallery";
import i18n from "../../apps/web/src/i18n";
import { registerSecurityHeaders } from "../../services/app/src/security-headers";
import { registerWebStatic } from "../../services/app/src/web-static";
import { registerGalleryFixture } from "./gallery-fixture";

// jsdom hat hier keine @types; die tatsächlich benutzte DOM-Schnittstelle bleibt strikt typisiert.
type DemoDom = { window: Window & typeof globalThis };
const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (
    html: string | Uint8Array,
    options: {
      url: string;
      runScripts?: "dangerously";
      contentType?: string;
      beforeParse?(window: Window & typeof globalThis): void;
    },
  ) => DemoDom;
};

const file = "apps/web/public/demonstration/importwege.html";
const steps = {
  de: [
    "Auswählen",
    "Ansehen",
    "Herkunft erhalten",
    "Vergleichen",
    "Fachlich prüfen",
    "Mit Klara nutzen",
  ],
  en: ["Select", "Preview", "Keep provenance", "Compare", "Review", "Use with Klara"],
};
const windows: DemoDom[] = [];
function load() {
  const dom = new JSDOM(readFileSync(file, "utf8"), {
    url: "https://klarwerk.test/demonstration/importwege.html",
    runScripts: "dangerously",
    beforeParse(window) {
      window.fetch = vi.fn();
      window.XMLHttpRequest.prototype.open = vi.fn();
      window.navigator.sendBeacon = vi.fn();
    },
  });
  windows.push(dom);
  return dom.window;
}
afterEach(() => {
  for (const dom of windows.splice(0)) dom.window.close();
});

describe("M6 · Erklärweg am vollständigen DOM", () => {
  it("kennzeichnet beide Sprachen ausdrücklich als fiktives Ablaufbeispiel ohne Live-Import", () => {
    const { document } = load();
    expect(document.querySelector("[data-example-notice] .de")?.textContent).toBe(
      "Ablaufbeispiel / kein Live-Import · Fiktive Demonstrationsdaten",
    );
    expect(document.querySelector("[data-example-notice] .en")?.textContent).toBe(
      "Process example / not a live import · Fictional demonstration data",
    );
  });

  it("EN ist vollständig: jeder Textträger hat eine Übersetzung, keine deutschen Resttexte", () => {
    const { document } = load();
    const de = [...document.querySelectorAll(".de")];
    const en = [...document.querySelectorAll(".en")];
    // Auch Text außerhalb der Sprachpaare zählt: sonst könnte ein deutscher Rest daneben
    // stehen bleiben, während alle vorhandenen EN-Felder weiterhin korrekt aussehen.
    const texts = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = texts.nextNode(); node; node = texts.nextNode()) {
      const text = node.textContent?.trim() ?? "";
      if (!text || node.parentElement?.closest(".de, .en")) continue;
      expect(text, "Text ohne Sprachpaar").toMatch(
        /^(DE|EN|Confluence|0[1-6]( \/ 06)?|https:\/\/example\.invalid\/\S+)$/,
      );
    }
    expect(en.length).toBeGreaterThan(40);
    expect(en).toHaveLength(de.length);
    for (const element of en) {
      expect(element.getAttribute("lang")).toBe("en");
      expect(element.previousElementSibling?.classList.contains("de")).toBe(true);
      expect(element.textContent?.trim()).not.toBe("");
      expect(element.textContent).not.toMatch(
        /\b(Auswählen|Ansehen|Herkunft|erhalten|Vergleichen|Fachlich|prüfen|nutzen|Vorgang|Lösung|Seite|Anhang|Zugriff|vertraulich|Freigabe|Doppelung|Widerspruch|Beispiel|kein|keine|und|mit|nicht|wird|bleibt|zur|zurück)\b/i,
      );
      expect(element.textContent).not.toBe(element.previousElementSibling?.textContent);
    }
    for (const lang of ["de", "en"] as const) {
      expect(
        [...document.querySelectorAll(`.step-panel h2 .${lang}`)].map((e) => e.textContent),
      ).toEqual(steps[lang]);
    }
    expect(en.map((e) => e.textContent).join(" ")).toContain(
      "A resolved issue is not automatically an approved knowledge statement.",
    );
  });

  it("sechs Schritte und beide Quellen sind wählbar; Rückweg ist die bestehende Galerie", () => {
    const { document } = load();
    for (let step = 1; step <= 6; step++) {
      const control = document.querySelector<HTMLInputElement>(`#step-${step}`);
      expect(control?.type).toBe("radio");
      control?.click();
      expect(control?.checked).toBe(true);
      expect(document.querySelector(`label[for="step-${step}"]`)).not.toBeNull();
      expect(document.querySelector(`#step-panel-${step}`)).not.toBeNull();
    }
    for (const source of ["jira", "confluence"]) {
      const control = document.querySelector<HTMLInputElement>(`#source-${source}`);
      control?.click();
      expect(control?.checked).toBe(true);
    }
    expect(document.querySelector("a[data-return]")?.getAttribute("href")).toBe(
      "/import#import-source-gallery",
    );
  });

  it("CSS-Kaskade zeigt für jede Sprach-, Quellen- und Schrittwahl genau den gewählten Inhalt", () => {
    // jsdom invalidiert seinen Stilcache bei nativen Radio-Umschaltungen nicht zuverlässig.
    // Je Zustand eine frische Instanz; fortlaufende Übergänge misst ausschließlich Chromium.
    for (const lang of ["en", "de"]) {
      for (const source of ["jira", "confluence"]) {
        for (let step = 1; step <= 6; step++) {
          const window = load();
          const { document } = window;
          const display = (selector: string) => {
            const element = document.querySelector(selector);
            expect(element, selector).not.toBeNull();
            return element ? window.getComputedStyle(element).display : null;
          };
          document.querySelector<HTMLInputElement>(`#language-${lang}`)?.click();
          document.querySelector<HTMLInputElement>(`#source-${source}`)?.click();
          document.querySelector<HTMLInputElement>(`#step-${step}`)?.click();
          expect(display(`h1 .${lang}`)).toBe("inline");
          expect(display(`h1 .${lang === "de" ? "en" : "de"}`)).toBe("none");
          expect(display(`#step-panel-3 .source-${source}`)).toBe("block");
          expect(
            display(`#step-panel-3 .source-${source === "jira" ? "confluence" : "jira"}`),
          ).toBe("none");
          expect(display(`#step-panel-${step}`)).toBe("block");
          expect(display(`#step-panel-${step === 1 ? 6 : step - 1}`)).toBe("none");
        }
      }
    }
  });

  it("echter Static-Auslieferungsweg liefert das vollständige Dokument unter produktiver CSP", async () => {
    const app = Fastify();
    try {
      await registerSecurityHeaders(app);
      await registerWebStatic(app, resolve("apps/web/public"));
      const response = await app.inject({ method: "GET", url: "/demonstration/importwege.html" });
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/html");
      expect(response.body).toBe(readFileSync(file, "utf8"));
      expect(response.headers["content-security-policy"]).toContain("script-src 'self'");
      expect(response.headers["content-security-policy"]).toContain(
        "style-src 'self' 'unsafe-inline'",
      );
    } finally {
      await app.close();
    }
  });

  it("Beispiele erklären Herkunft, Zugriff, Doppelung, Konflikt und Prüfung ohne Erfolg vorzutäuschen", () => {
    const { document } = load();
    const panel = (step: number) => document.querySelector(`#step-panel-${step}`)?.textContent;
    expect(panel(2)).toContain("DEMO-42");
    expect(panel(2)).toContain("Checklist.pdf");
    expect(panel(3)).toContain("https://example.invalid/jira/DEMO-42");
    expect(panel(3)).toContain("https://example.invalid/confluence/service");
    expect(panel(3)).toContain("Version");
    expect(panel(3)).toContain("Only the Service team");
    expect(panel(3)).toContain("Confidential");
    expect(panel(4)).toContain("Duplicate");
    expect(panel(4)).toContain("Conflict");
    expect(panel(4)).toContain("No automatic truth decision");
    expect(panel(5)).toContain("Candidate → draft → approval");
    expect(panel(6)).toContain("Nothing is saved");
  });

  it("jeder Auswahlklick bleibt lokal: Netz-Spion und keine externen Ressourcen oder Importaktionen", () => {
    const window = load();
    for (const input of window.document.querySelectorAll<HTMLInputElement>("input")) input.click();
    expect(window.fetch).not.toHaveBeenCalled();
    expect(window.XMLHttpRequest.prototype.open).not.toHaveBeenCalled();
    expect(window.navigator.sendBeacon).not.toHaveBeenCalled();
    expect(
      window.document.querySelectorAll("script, form, iframe, img, link, object"),
    ).toHaveLength(0);
    expect(
      [...window.document.querySelectorAll("[href]")].map((e) => e.getAttribute("href")),
    ).toEqual(["/import#import-source-gallery"]);
  });
});

describe("M6 · Galerie-Einstieg", () => {
  it("Browser-Fixture erhält den Linknamen beim Dekodieren der HTTP-Bytes", async () => {
    const app = Fastify();
    try {
      registerGalleryFixture(app);
      const response = await app.inject({ method: "GET", url: "/import" });
      expect(response.statusCode).toBe(200);
      // Aus Bytes parsen: response.body ist bereits UTF-8-dekodiert und würde eine
      // fehlende Zeichensatzangabe verdecken. Wie im Browser zählt Header/HTML-Metadatum.
      const dom = new JSDOM(response.rawPayload, {
        url: "https://klarwerk.test/import",
        contentType: String(response.headers["content-type"]),
      });
      windows.push(dom);
      expect(dom.window.document.querySelector("#import-source-gallery a")?.textContent).toBe(
        "Jira / Confluence →",
      );
    } finally {
      await app.close();
    }
  });

  it("verlinkt die Seite mit vorhandenen Systemnamen; aktive Import-Callbacks und Jira-Status bleiben", async () => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const activate = vi.fn();
    try {
      for (const lang of ["de", "en"]) {
        await act(async () => {
          await i18n.changeLanguage(lang);
          root.render(createElement(ImportSourceGallery, { onActivate: activate }));
        });
        const link = host.querySelector<HTMLAnchorElement>(
          'a[href="/demonstration/importwege.html"]',
        );
        expect(link?.textContent?.trim()).toBe("Jira / Confluence →");
        expect(link?.target).not.toBe("_blank");
        expect(host.querySelector("#import-source-gallery")).not.toBeNull();
        const click = new MouseEvent("click", { bubbles: true, cancelable: true });
        link?.addEventListener("click", (event) => event.preventDefault(), { once: true });
        act(() => link?.dispatchEvent(click));
        expect(activate).not.toHaveBeenCalled();
        const tile = (id: string) =>
          host.querySelector<HTMLButtonElement>(`button[data-id="${id}"]`);
        expect(tile("jira")?.dataset.state).toBe("soon");
        act(() => tile("jira")?.click());
        expect(activate).not.toHaveBeenCalled();
        for (const id of ["confluence", "json", "json-file"]) {
          expect(tile(id)?.dataset.state).toBe("active");
          act(() => tile(id)?.click());
          expect(activate).toHaveBeenLastCalledWith(id);
        }
        expect(activate).toHaveBeenCalledTimes(3);
        activate.mockClear();
      }
    } finally {
      act(() => root.unmount());
      host.remove();
      await i18n.changeLanguage("de");
    }
  });
});

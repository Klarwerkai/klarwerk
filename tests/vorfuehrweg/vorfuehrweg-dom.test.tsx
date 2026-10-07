// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · GESAMT-DEMO-ERKLAERMODUS — DER VORFÜHRWEG AM VOLLSTÄNDIGEN DOKUMENT.
// ================================================================================================
//
// Geparst wird die AUSGELIEFERTE Datei `apps/web/public/demonstration/vorfuehrweg.html`. Was dieser
// Test belegt, hängt jeweils an einer zweiten, unabhängigen Quelle statt an einer Abschrift:
//   · die Linkziele an der Routenquelle des Routers (`app/navigation.ts`) und der Adressfunktion
//     der Verwaltung (`lib/adminSections.ts`),
//   · die zitierten Beispiele am Demobestand, den „Demodaten laden“ wirklich anlegt
//     (`services/app/src/demo-content.ts`),
//   · die zitierten Knopfnamen und Rollen an den Texten der Oberfläche (i18n).
// Was jsdom nicht kann — echtes Öffnen im benannten Fenster, Landung auf der Seite, Bilder der
// gebauten Fassung — misst `tests-smoke/vorfuehrweg-browser.spec.ts`.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { GUARDED_ITEMS, type Role } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import {
  ADMIN_DETAILS,
  adminHref,
  adminSectionFuerDetail,
  isAdminSectionId,
} from "../../apps/web/src/lib/adminSections";
import { Help } from "../../apps/web/src/pages/Help";
import { DEMO_TEXTS } from "../../services/app/src/demo-content";
import { registerSecurityHeaders } from "../../services/app/src/security-headers";
import { registerWebStatic } from "../../services/app/src/web-static";

// jsdom hat hier keine @types; die tatsächlich benutzte DOM-Schnittstelle bleibt strikt typisiert.
type VorfuehrDom = { window: Window & typeof globalThis };
const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (
    html: string | Uint8Array,
    options: {
      url: string;
      runScripts?: "dangerously";
      beforeParse?(window: Window & typeof globalThis): void;
    },
  ) => VorfuehrDom;
};

const OEFFENTLICH = "apps/web/public";
const DATEI = join(OEFFENTLICH, "demonstration", "vorfuehrweg.html");
const BASIS = "https://klarwerk.test";
const FENSTER = "klarwerk-vorfuehrung";
const SPRACHEN = ["de", "en"] as const;
type Sprache = (typeof SPRACHEN)[number];
const FELDER = ["ziel", "handlung", "ergebnis"] as const;

/** Die Stationen in ihrer Reihenfolge, so wie `data-station` sie nennt. */
const STATIONEN = [
  "demodaten",
  "start",
  "bibliothek",
  "fragen",
  "erfassen",
  "validierung",
  "konflikte",
  "importwege",
] as const;

const offeneFenster: VorfuehrDom[] = [];

function laden(): Window & typeof globalThis {
  const dom = new JSDOM(readFileSync(DATEI, "utf8"), {
    url: `${BASIS}/demonstration/vorfuehrweg.html`,
    runScripts: "dangerously",
    beforeParse(window) {
      window.fetch = vi.fn();
      window.XMLHttpRequest.prototype.open = vi.fn();
      window.navigator.sendBeacon = vi.fn();
    },
  });
  offeneFenster.push(dom);
  return dom.window;
}

afterEach(() => {
  for (const dom of offeneFenster.splice(0)) dom.window.close();
});

function flach(roh: string | null | undefined): string {
  return (roh ?? "").replace(/\s+/g, " ").trim();
}

function station(document: Document, kennung: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`section.station[data-station="${kennung}"]`);
  expect(el, `Station ${kennung} fehlt`).not.toBeNull();
  return el as HTMLElement;
}

function feld(el: HTMLElement, name: string, sprache: Sprache): string {
  const dt = el.querySelector(`dt[data-feld="${name}"]`);
  return flach(dt?.nextElementSibling?.querySelector(`.${sprache}`)?.textContent);
}

function link(el: HTMLElement, sprache: Sprache): HTMLAnchorElement {
  const a = el.querySelector<HTMLAnchorElement>(`a.oeffnen.${sprache}`);
  expect(a, `${el.dataset.station}: kein Stationslink (${sprache})`).not.toBeNull();
  return a as HTMLAnchorElement;
}

function ziel(a: HTMLAnchorElement): URL {
  return new URL(a.getAttribute("href") ?? "", BASIS);
}

describe("Vorführweg · Stationen am vollständigen Dokument", () => {
  it("V1 · acht Stationen in fester Reihenfolge, je mit Ziel, Handlung und Ergebnis in DE und EN", () => {
    const { document } = laden();
    const sektionen = document.querySelectorAll<HTMLElement>("section.station");
    expect([...sektionen].map((s) => s.dataset.station)).toEqual([...STATIONEN]);
    for (const kennung of STATIONEN) {
      const el = station(document, kennung);
      for (const sprache of SPRACHEN) {
        for (const name of FELDER) {
          const text = feld(el, name, sprache);
          expect(text.length, `${kennung} · ${name} (${sprache}) ist leer`).toBeGreaterThan(20);
        }
        expect(flach(el.querySelector(`h2 .${sprache}`)?.textContent)).not.toBe("");
        expect(flach(el.querySelector(`.kicker .${sprache}`)?.textContent)).not.toBe("");
      }
      // Die beiden Sprachen sagen nicht denselben Satz zweimal.
      for (const name of FELDER) {
        expect(feld(el, name, "en")).not.toBe(feld(el, name, "de"));
      }
    }
    // Die Übersicht verweist auf jede Station, in derselben Reihenfolge.
    const uebersicht = document.querySelectorAll("nav.uebersicht a");
    const verweise = [...uebersicht].map((a) => a.getAttribute("href"));
    expect(verweise).toEqual(STATIONEN.map((_, i) => `#station-${i}`));
  });

  it("V2 · Schritt für Schritt: jede Station blättert zur vorigen und zur nächsten", () => {
    const { document } = laden();
    STATIONEN.forEach((kennung, i) => {
      const el = station(document, kennung);
      expect(el.id).toBe(`station-${i}`);
      const vorher = i === 0 ? "#uebersicht-titel" : `#station-${i - 1}`;
      const danach = i === STATIONEN.length - 1 ? "#uebersicht-titel" : `#station-${i + 1}`;
      const anker = el.querySelectorAll(".blaettern a");
      const blaettern = [...anker].map((a) => a.getAttribute("href"));
      expect(blaettern).toEqual([vorher, danach]);
      for (const verweis of blaettern) {
        const treffer = document.querySelector(verweis ?? "#fehlt");
        expect(treffer, `${kennung}: ${verweis} zeigt ins Leere`).not.toBeNull();
      }
    });
  });

  it("V3 · EN ist vollständig: jeder Textträger hat ein Gegenstück, keine deutschen Resttexte", () => {
    const { document } = laden();
    const texte = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let knoten = texte.nextNode(); knoten; knoten = texte.nextNode()) {
      const text = knoten.textContent?.trim() ?? "";
      if (!text || knoten.parentElement?.closest(".de, .en")) continue;
      expect(text, "Text ohne Sprachpaar").toMatch(/^(DE|EN)$/);
    }
    const de = [...document.querySelectorAll(".de")];
    const en = [...document.querySelectorAll(".en")];
    const deutsch = /\b(Ziel|Handlung|Ergebnis|öffnen|Sekunden|Rolle|und|mit|nicht)\b/;
    expect(en.length).toBeGreaterThan(80);
    expect(en).toHaveLength(de.length);
    for (const element of en) {
      expect(element.getAttribute("lang")).toBe("en");
      expect(element.previousElementSibling?.classList.contains("de")).toBe(true);
      expect(flach(element.textContent)).not.toBe("");
      expect(element.textContent).not.toMatch(deutsch);
    }
  });
});

describe("Vorführweg · jeder Link öffnet die richtige Stelle", () => {
  it("L1 · jeder Stationslink zielt auf das EINE Vorführfenster, keiner auf _blank", () => {
    const { document } = laden();
    const oeffnen = [...document.querySelectorAll("a.oeffnen")];
    expect(oeffnen).toHaveLength(STATIONEN.length * 2);
    for (const a of oeffnen) {
      expect(a.getAttribute("target")).toBe(FENSTER);
    }
    // Alle übrigen Links bleiben auf dieser Seite (Übersicht und Blättern).
    for (const a of document.querySelectorAll("a:not(.oeffnen)")) {
      expect(a.getAttribute("href")).toMatch(/^#/);
      expect(a.hasAttribute("target")).toBe(false);
    }
  });

  it("L2 · jedes App-Ziel ist eine Route des Routers; der Kopf nennt die Rolle, die er verlangt", () => {
    const { document } = laden();
    const alle = { de: "alle", en: "everyone" } as const;
    const wort = { de: "Rolle", en: "Role" } as const;
    for (const kennung of STATIONEN) {
      const el = station(document, kennung);
      for (const sprache of SPRACHEN) {
        const a = link(el, sprache);
        expect(a.dataset.ziel).toBe(kennung);
        const pfad = ziel(a).pathname;
        let verlangt: Role = "viewer";
        if (pfad.startsWith("/demonstration/")) {
          expect(existsSync(join(OEFFENTLICH, pfad)), pfad).toBe(true);
        } else {
          const route = GUARDED_ITEMS.find((item) => item.path === pfad);
          expect(route, `${kennung}: ${pfad} ist keine Route`).toBeDefined();
          verlangt = route?.minRole ?? "viewer";
        }
        const t = i18n.getFixedT(sprache);
        const rolle = verlangt === "viewer" ? alle[sprache] : t(`role.name.${verlangt}`);
        const kopf = flach(el.querySelector(`.kicker .${sprache}`)?.textContent);
        expect(kopf).toContain(`${wort[sprache]}: ${rolle}`);
      }
    }
  });

  it("L3 · die Vorbereitung öffnet genau die Karte „Demodaten“ unter „Vorführdaten“", () => {
    const { document } = laden();
    for (const sprache of SPRACHEN) {
      const a = link(station(document, "demodaten"), sprache);
      expect(a.getAttribute("href")).toBe(adminHref("vorfuehrdaten", "demo"));
      const bereich = ziel(a).searchParams.get("bereich") ?? "";
      const detail = ziel(a).searchParams.get("detail") ?? "";
      expect(isAdminSectionId(bereich)).toBe(true);
      expect(ADMIN_DETAILS.some((d) => d.id === detail)).toBe(true);
      expect(adminSectionFuerDetail(detail)).toBe(bereich);
    }
  });

  it("L4 · Bibliothek und Fragen öffnen mit dem Suchbegriff bzw. der Frage der Station", () => {
    const { document } = laden();
    const erwartet = {
      bibliothek: { de: "Lieferanten", en: "Suppliers" },
      fragen: {
        de: "Wie oft muss Filter F3 geprüft werden?",
        en: "How often does filter F3 have to be checked?",
      },
    } as const;
    for (const kennung of ["bibliothek", "fragen"] as const) {
      const el = station(document, kennung);
      for (const sprache of SPRACHEN) {
        const q = ziel(link(el, sprache)).searchParams.get("q");
        expect(q).toBe(erwartet[kennung][sprache]);
        // Die Handlung nennt genau diesen Begriff bzw. diese Frage.
        expect(feld(el, "handlung", sprache)).toContain(erwartet[kennung][sprache]);
      }
    }
  });

  it("L5 · Station 7 öffnet die ausgelieferte Jira/Confluence-Erklärseite und nennt ihren Titel", () => {
    const { document } = laden();
    const quelle = readFileSync(join(OEFFENTLICH, "demonstration", "importwege.html"), "utf8");
    const importseite = new JSDOM(quelle, { url: `${BASIS}/demonstration/importwege.html` });
    offeneFenster.push(importseite);
    const el = station(document, "importwege");
    for (const sprache of SPRACHEN) {
      const h1 = importseite.window.document.querySelector(`h1 .${sprache}`);
      const titel = flach(h1?.textContent);
      expect(titel).not.toBe("");
      expect(feld(el, "ergebnis", sprache)).toContain(titel);
    }
  });
});

describe("Vorführweg · die Beispiele passen zum ausgelieferten Demobestand (Fertigung)", () => {
  it("D1 · jedes zitierte Beispiel steht wörtlich im Demobestand derselben Sprache", () => {
    const { document } = laden();
    for (const sprache of SPRACHEN) {
      const t = DEMO_TEXTS[sprache];
      const suchwort = sprache === "de" ? "Lieferanten" : "Suppliers";
      const bibliothek = feld(station(document, "bibliothek"), "ergebnis", sprache);
      expect(bibliothek).toContain(t.koLieferantFrei.title);
      expect(bibliothek).toContain(t.koLieferantSchutz.title);
      expect(t.koLieferantFrei.title).toContain(suchwort);
      expect(t.koLieferantSchutz.title).toContain(suchwort);
      const fragen = feld(station(document, "fragen"), "ergebnis", sprache);
      const pruefen = feld(station(document, "validierung"), "handlung", sprache);
      expect(fragen).toContain(t.koFilter.title);
      expect(pruefen).toContain(t.koOpen.title);
      const konflikt = station(document, "konflikte");
      expect(feld(konflikt, "handlung", sprache)).toContain(t.warmConflict.streitpunkt);
      expect(feld(konflikt, "ergebnis", sprache)).toContain(t.warmConflict.quoteA);
      expect(feld(konflikt, "ergebnis", sprache)).toContain(t.warmConflict.quoteB);
    }
  });

  it("D2 · die zitierten Knopf- und Kartennamen sind die der Oberfläche", () => {
    const { document } = laden();
    for (const sprache of SPRACHEN) {
      const t = i18n.getFixedT(sprache);
      const text = (kennung: string): string => {
        const el = station(document, kennung);
        return `${feld(el, "handlung", sprache)} ${feld(el, "ergebnis", sprache)}`;
      };
      expect(text("demodaten")).toContain(t("adm.ziel.demo"));
      expect(text("demodaten")).toContain(t("adm.seedButton"));
      expect(text("demodaten")).toContain(t("demodaten.ladenAus"));
      expect(text("erfassen")).toContain(t("erfassen.entwurfSichern"));
      expect(text("fragen")).toContain(t("tutorial.knopf"));
    }
  });
});

describe("Vorführweg · Sprache, Rückfall und Auslieferung", () => {
  it("S1 · die CSS-Kaskade zeigt je Sprachwahl genau eine Sprache — auch an den Stationslinks", () => {
    // jsdom invalidiert seinen Stilcache bei Radio-Umschaltungen nicht zuverlässig (siehe
    // `klara-importwege-dom.test.tsx`): je Sprache eine frische Instanz.
    for (const sprache of SPRACHEN) {
      const window = laden();
      const { document } = window;
      const anzeige = (selector: string): string => {
        const el = document.querySelector(selector);
        expect(el, selector).not.toBeNull();
        return el ? window.getComputedStyle(el).display : "";
      };
      document.querySelector<HTMLInputElement>(`#language-${sprache}`)?.click();
      const andere = sprache === "de" ? "en" : "de";
      expect(anzeige(`h1 .${sprache}`)).toBe("inline");
      expect(anzeige(`h1 .${andere}`)).toBe("none");
      expect(anzeige(`#station-3 a.oeffnen.${sprache}`)).toBe("inline-block");
      expect(anzeige(`#station-3 a.oeffnen.${andere}`)).toBe("none");
      expect(anzeige("[data-fallback-notice]")).toBe("none");
    }
  });

  it("S2 · ohne :has() stehen beide Sprachen untereinander (Quelltext der Rückfallregel)", () => {
    // jsdom wertet `@supports not selector(…)` nicht aus; geprüft wird deshalb die Regel selbst.
    // Im echten Renderer misst den Rückfall `tests-smoke/vorfuehrweg-browser.spec.ts`.
    const quelle = readFileSync(DATEI, "utf8");
    const muster = /@supports not selector\(:has\(\*\)\) \{([\s\S]*?)\n {4}\}/;
    const block = muster.exec(quelle)?.[1] ?? "";
    expect(block).toContain(".de, .en { display: block; }");
    expect(block).toContain("a.oeffnen.de, a.oeffnen.en { display: inline-block;");
    expect(block).toContain(".fallback-notice { display: block; }");
  });

  it("S3 · kein Skript, kein Formular, kein Bild, keine fremde Ressource; Klicks bleiben lokal", () => {
    const window = laden();
    const { document } = window;
    for (const input of document.querySelectorAll<HTMLInputElement>("input")) input.click();
    expect(window.fetch).not.toHaveBeenCalled();
    expect(window.XMLHttpRequest.prototype.open).not.toHaveBeenCalled();
    expect(window.navigator.sendBeacon).not.toHaveBeenCalled();
    const fremd = document.querySelectorAll("script, form, iframe, img, link, object, video");
    expect(fremd).toHaveLength(0);
    for (const a of document.querySelectorAll("[href]")) {
      expect(a.getAttribute("href"), "kein Link verlässt die Installation").toMatch(/^[/#]/);
    }
  });

  it("S4 · der echte Static-Weg liefert das vollständige Dokument unter der produktiven CSP", async () => {
    const app = Fastify();
    try {
      await registerSecurityHeaders(app);
      await registerWebStatic(app, resolve(OEFFENTLICH));
      const antwort = await app.inject({ method: "GET", url: "/demonstration/vorfuehrweg.html" });
      expect(antwort.statusCode).toBe(200);
      expect(antwort.headers["content-type"]).toContain("text/html");
      expect(antwort.body).toBe(readFileSync(DATEI, "utf8"));
      const csp = String(antwort.headers["content-security-policy"]);
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    } finally {
      await app.close();
    }
  });
});

describe("Vorführweg · Einstieg aus der Hilfeseite", () => {
  it("H1 · die Karte „KLARWERK vorführen“ öffnet den Vorführweg in eigenem Fenster (DE/EN/NL)", async () => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    const vorherigerFetch = globalThis.fetch;
    // Die Supportkarte daneben fragt `/api/support`; hier ohne Server — sie zeigt dann ihren
    // Fehlersatz. Gemessen wird ausschliesslich die Vorführkarte.
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof globalThis.fetch;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const seite = createElement(MemoryRouter, { initialEntries: ["/hilfe"] }, createElement(Help));
    try {
      for (const sprache of ["de", "en", "nl"] as const) {
        await act(async () => {
          await i18n.changeLanguage(sprache);
          root.render(seite);
        });
        const karte = host.querySelector<HTMLElement>('[data-testid="hilfe-vorfuehrweg"]');
        expect(karte, `keine Vorführkarte (${sprache})`).not.toBeNull();
        const titel = flach(karte?.querySelector("h2")?.textContent);
        expect(titel).toBe(i18n.t("vorfuehrweg.hilfe.titel"));
        expect(flach(karte?.textContent)).toContain(i18n.t("vorfuehrweg.hilfe.text"));
        const links = [...(karte?.querySelectorAll("a") ?? [])];
        expect(links, "genau EIN Link in der Karte").toHaveLength(1);
        const a = links[0];
        expect(a?.getAttribute("href")).toBe("/demonstration/vorfuehrweg.html");
        expect(a?.getAttribute("target")).toBe("_blank");
        expect(a?.getAttribute("rel") ?? "").toContain("noopener");
        expect(flach(a?.textContent)).toContain(i18n.t("vorfuehrweg.hilfe.link"));
        expect(flach(a?.textContent)).toContain(i18n.t("help.support.newTab"));
      }
    } finally {
      act(() => root.unmount());
      host.remove();
      globalThis.fetch = vorherigerFetch;
      await i18n.changeLanguage("de");
    }
  });
});

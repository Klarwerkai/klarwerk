// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · GESAMT-NAVIGATION · R-1045 — DER HINWEIS „WEITERE EINTRÄGE UNTEN" (jsdom).
// ================================================================================================
//
// jsdom rechnet kein Layout. Diese Datei misst deshalb nur die REGEL und ihren Draht: die Scrollwerte
// des Containers werden gestellt, und gemessen wird, ob der Hinweis steht, verschwindet und
// wiederkommt. Ob er im echten Browser am unteren Rand sitzt und die Liste wirklich überläuft,
// misst `tablet-chromium.test.ts` daneben am gebauten Produkt.
//
//   H1 — die Regel: verdeckter Rest über der Schwelle → ja; am Ende / alles sichtbar → nein
//   H2 — gemountet: Überlauf → der Hinweis steht mit seinem Wort, aria-hidden, ohne Fokusstation
//   H3 — Scrollen bis ans Ende nimmt ihn weg, zurückscrollen bringt ihn wieder
//   H4 — passt alles, steht nichts da (Gegenprobe gegen einen Hinweis, der immer steht)
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import i18n from "../../apps/web/src/i18n";
import { WeiterUntenHinweis, weiterUnten } from "../../apps/web/src/shell/WeiterUnten";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
let scrollTop = 0;

/** Einen Container mit gestellten Massen anlegen — jsdom liefert sonst überall 0. */
function scrollbarerContainer(scrollHeight: number, clientHeight: number): HTMLDivElement {
  const el = document.createElement("div");
  Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => scrollHeight });
  Object.defineProperty(el, "clientHeight", { configurable: true, get: () => clientHeight });
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (v: number) => {
      scrollTop = v;
    },
  });
  document.body.appendChild(el);
  return el;
}

async function montiere(el: HTMLDivElement): Promise<void> {
  container = el;
  const neu = createRoot(el);
  root = neu;
  await act(async () => {
    neu.render(createElement(WeiterUntenHinweis, { testid: "sonde-weiter-unten" }));
  });
}

async function scrolle(nach: number): Promise<void> {
  await act(async () => {
    container.scrollTop = nach;
    container.dispatchEvent(new Event("scroll"));
  });
}

const hinweis = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="sonde-weiter-unten"]');

beforeEach(async () => {
  scrollTop = 0;
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
});

describe("R-1045 · die Navigationsliste verbirgt nicht, dass unten weitere Einträge stehen", () => {
  it("H1 · die Regel: verdeckter Rest über 4 px → ja, sonst nein", () => {
    expect(weiterUnten({ scrollHeight: 1400, scrollTop: 0, clientHeight: 1024 })).toBe(true);
    expect(weiterUnten({ scrollHeight: 1400, scrollTop: 376, clientHeight: 1024 })).toBe(false);
    expect(weiterUnten({ scrollHeight: 1400, scrollTop: 373, clientHeight: 1024 })).toBe(false);
    expect(weiterUnten({ scrollHeight: 1400, scrollTop: 370, clientHeight: 1024 })).toBe(true);
    expect(weiterUnten({ scrollHeight: 600, scrollTop: 0, clientHeight: 1024 })).toBe(false);
  });

  it("H2 · Überlauf: der Hinweis steht mit seinem Wort, aria-hidden und ohne Fokusstation", async () => {
    await montiere(scrollbarerContainer(1400, 1024));
    const h = hinweis();
    expect(h?.getAttribute("data-weiter-unten")).toBe("ja");
    expect(h?.getAttribute("aria-hidden")).toBe("true");
    expect(h?.textContent).toContain("Weitere Einträge unten");
    expect(h?.querySelectorAll("a, button, input, [tabindex]").length).toBe(0);
  });

  it("H3 · ans Ende gescrollt verschwindet er, zurückgescrollt kommt er wieder", async () => {
    await montiere(scrollbarerContainer(1400, 1024));
    await scrolle(376);
    expect(hinweis()?.getAttribute("data-weiter-unten")).toBe("nein");
    expect(hinweis()?.textContent).toBe("");
    await scrolle(100);
    expect(hinweis()?.getAttribute("data-weiter-unten")).toBe("ja");
  });

  it("H4 · Gegenprobe: passt alles ins Fenster, steht kein Hinweis da", async () => {
    await montiere(scrollbarerContainer(600, 1024));
    expect(hinweis()?.getAttribute("data-weiter-unten")).toBe("nein");
    expect(hinweis()?.textContent).toBe("");
  });

  it("H5 · der Hinweis spricht die eingestellte Sprache (EN/NL)", async () => {
    for (const [sprache, wort] of [
      ["en", "More entries below"],
      ["nl", "Meer items hieronder"],
    ] as const) {
      await i18n.changeLanguage(sprache);
      await montiere(scrollbarerContainer(1400, 1024));
      expect(hinweis()?.textContent, sprache).toContain(wort);
      act(() => root?.unmount());
      root = null;
      container.remove();
    }
  });
});

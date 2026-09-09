// JOB 3144 · UX-16/N-0033: echte gebaute Webhilfe, keine Geometrie aus CSS-Text errechnet.
// Ausgangsmessung: x: -40 / Breite 340 bei 320 px; x: 30 / Breite 340 bei 390 px.
// Quelle: ~/klarwerk_steuerung/gespraech/nutzerpruefung/belege/
// mobil-20260906-011638/19-klara-breiten.json (Chromium, /start).
// EINE Browserinstanz über h4-harness für DE/EN, Telefon und Desktop (Vorlage JOB 3121).
// Zustand: frisch geöffnet, keine KI-Anfrage; geprüft werden horizontale Bildschirmgrenzen.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type H4Stand, ORIGIN, type Seite, fn, h4Stand } from "../design/h4-harness";

interface SeiteMitTastatur extends Seite {
  keyboard: { press(taste: string): Promise<void> };
}
interface Rechteck {
  left: number;
  right: number;
  width: number;
}
interface Messung {
  fenster: number;
  sprache: string;
  panel: Rechteck;
  suche: Rechteck;
  schliessen: Rechteck;
  element: Rechteck;
  markierung: Rechteck;
  hilfe: Rechteck;
  ueberlauf: number;
}

let stand: H4Stand | undefined;
const messungen = new Map<string, Messung>();

async function messen(breite: number, sprache: "de" | "en"): Promise<Messung> {
  const key = `${breite}/${sprache}`;
  const vorhanden = messungen.get(key);
  if (vorhanden) return vorhanden;
  if (!stand) throw new Error("Chromium-Prüfstand fehlt");
  const { seite } = stand;
  await seite.setViewportSize({ width: breite, height: breite === 320 ? 640 : 900 });
  await seite.evaluate(fn('(sprache) => localStorage.setItem("kw.sprache", sprache)'), sprache);
  // Echter Reload liest die gewählte Produktsprache; keine ersetzte Übersetzungstabelle.
  await seite.goto(`${ORIGIN}/start`, { waitUntil: "load", timeout: 60_000 });
  await seite.waitForFunction(fn("() => !!document.querySelector('button[data-klara=\"1\"]')"));
  await seite.evaluate(fn("() => document.querySelector('button[data-klara=\"1\"]').click()"));
  await seite.waitForFunction(
    fn("() => !!document.querySelector('section[data-klara=\"1\"] input')"),
  );
  await seite.evaluate(
    fn(
      "() => document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))",
    ),
  );
  const m = await seite.evaluate<Messung>(
    fn(`(sprache) => {
    const panel = document.querySelector('section[data-klara="1"]');
    const rect = (el) => {
      if (!el) throw new Error('Pflichtelement fehlt');
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') {
        throw new Error('Pflichtelement unsichtbar');
      }
      return { left: r.left, right: r.right, width: r.width };
    };
    const button = (name) => [...panel.querySelectorAll('button')].find(el => el.textContent.trim() === name);
    return {
      fenster: innerWidth,
      sprache: document.documentElement.lang,
      panel: rect(panel),
      suche: rect(panel.querySelector('input')),
      schliessen: rect(panel.querySelector('button[aria-label]')),
      element: rect(button(sprache === 'de' ? 'Element erklären' : 'Explain element')),
      markierung: rect(button(sprache === 'de' ? 'Markierung erklären' : 'Explain selection')),
      hilfe: rect(panel.querySelector('a[href="/hilfe"]')),
      ueberlauf: document.documentElement.scrollWidth - innerWidth,
    };
  }`),
    sprache,
  );
  console.info(`JOB 3144 · ${key}: ${JSON.stringify(m)}`);
  expect(m.fenster).toBe(breite);
  expect(m.sprache).toBe(sprache);
  messungen.set(key, m);
  return m;
}

function imBild(rect: Rechteck, breite: number): void {
  expect.soft(rect.left).toBeGreaterThanOrEqual(0);
  expect.soft(rect.right).toBeLessThanOrEqual(breite);
}

// JOB 3269 · Die produktiven Einbindungen: StartPanel.tsx:108 → /start (Menü),
// Stufe2.tsx:531 → /import (direkt, Admin mit Stufe 2). capture hat keinen Produktaufrufer.
// Der Hilfe-Link steht AUSSERHALB des nativen details, wie im unveränderten T1.
type WordRoute = "/start" | "/import";
type Sprache = "de" | "en";
interface SeiteMitReload extends SeiteMitTastatur {
  reload(opts: { waitUntil: "load" }): Promise<unknown>;
}
interface WordRechteck extends Rechteck {
  top: number;
  bottom: number;
}
interface WordMessung {
  route: string;
  fenster: number;
  hoehe: number;
  sprache: string;
  hinweis: WordRechteck;
  summary: WordRechteck;
  hilfe: WordRechteck;
  ueberlauf: number;
  linktext: string;
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
}
const wordMessungen = new Map<string, WordMessung>();
const wordRouten = ["/start", "/import"] as const;
const wordSprachen = ["de", "en"] as const;
const hilfesaetze: Record<Sprache, string> = {
  de: "Klara hilft dir schon heute in der Web-App — hier geht es zur Hilfe.",
  en: "Klara already helps you in the web app — open the help page here.",
};

async function wordHinweisOeffnen(seite: Seite, route: WordRoute, sprache: Sprache): Promise<void> {
  if (route === "/start") {
    const label = sprache === "de" ? "Mehr zu dieser Seite" : "More about this page";
    await seite.waitForFunction(
      fn('(label) => !!document.querySelector(`button[aria-label="${label}"]`)'),
      label,
      { timeout: 10_000 },
    );
    await seite.evaluate(
      fn('(label) => document.querySelector(`button[aria-label="${label}"]`).click()'),
      label,
    );
    await seite.waitForFunction(
      fn(
        '() => [...document.querySelectorAll("button")].some(el => el.textContent.trim() === "Klara in Word")',
      ),
      undefined,
      { timeout: 10_000 },
    );
    await seite.evaluate(
      fn(
        '() => [...document.querySelectorAll("button")].find(el => el.textContent.trim() === "Klara in Word").click()',
      ),
    );
  }
  await seite.waitForFunction(
    fn(`() => {
      const hinweis = document.querySelector('aside[data-testid="klara-path-teaser"]');
      return !!hinweis?.querySelector('summary') && !!hinweis.querySelector('a[href="/hilfe"]');
    }`),
    undefined,
    { timeout: 10_000 },
  );
  await seite.evaluate(
    fn(
      "() => document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))",
    ),
  );
}

async function wordOeffnen(
  route: WordRoute,
  breite: number,
  sprache: Sprache,
): Promise<SeiteMitReload> {
  if (!stand) throw new Error("Chromium-Prüfstand fehlt");
  const seite = stand.seite as SeiteMitReload;
  await seite.setViewportSize({ width: breite, height: breite === 320 ? 640 : 900 });
  // Echte persistierte Produktschalter; /import verlangt Admin + Stufe 2 (navigation.ts:278–282).
  await seite.evaluate(
    fn(
      '(sprache) => { localStorage.setItem("kw.sprache", sprache); localStorage.setItem("kw.stufe2.v1", "1"); }',
    ),
    sprache,
  );
  await seite.goto(`${ORIGIN}${route}`, { waitUntil: "load", timeout: 60_000 });
  await wordHinweisOeffnen(seite, route, sprache);
  return seite;
}

async function wordAblesen(seite: Seite): Promise<WordMessung> {
  // EIN evaluate: Rechtecke, Elementüberlauf und vollständiger Text stammen vom selben Frame.
  const m = await seite.evaluate<WordMessung>(
    fn(`() => {
      const hinweise = document.querySelectorAll('aside[data-testid="klara-path-teaser"]');
      if (hinweise.length !== 1) throw new Error('Genau ein Word-Hinweis erforderlich');
      const hinweis = hinweise[0];
      const rect = (el) => {
        if (!el) throw new Error('Pflichtelement fehlt');
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden' ||
            getComputedStyle(el).opacity === '0' || el.closest('[hidden], [inert], [aria-hidden="true"]')) {
          throw new Error('Pflichtelement unsichtbar');
        }
        return { left: r.left, right: r.right, width: r.width, top: r.top, bottom: r.bottom };
      };
      const links = hinweis.querySelectorAll('a[href="/hilfe"]');
      if (links.length !== 1) throw new Error('Genau ein Hilfe-Link erforderlich');
      const link = links[0];
      return {
        route: location.pathname,
        fenster: innerWidth,
        hoehe: innerHeight,
        sprache: document.documentElement.lang,
        hinweis: rect(hinweis),
        summary: rect(hinweis.querySelector('summary')),
        hilfe: rect(link),
        ueberlauf: document.documentElement.scrollWidth - innerWidth,
        linktext: link.textContent,
        scrollWidth: link.scrollWidth, clientWidth: link.clientWidth,
        scrollHeight: link.scrollHeight, clientHeight: link.clientHeight,
      };
    }`),
  );
  console.info(`JOB 3269 · ${m.route}/${m.fenster}/${m.sprache}: ${JSON.stringify(m)}`);
  return m;
}

async function wordMessen(
  route: WordRoute,
  breite: number,
  sprache: Sprache,
): Promise<WordMessung> {
  const key = `${route}/${breite}/${sprache}`;
  const vorhanden = wordMessungen.get(key);
  if (vorhanden) return vorhanden;
  const m = await wordAblesen(await wordOeffnen(route, breite, sprache));
  expect(m.route).toBe(route);
  expect(m.fenster).toBe(breite);
  expect(m.sprache).toBe(sprache);
  wordMessungen.set(key, m);
  return m;
}

function wordImBild(rect: WordRechteck, m: WordMessung): void {
  imBild(rect, m.fenster);
  expect.soft(rect.top).toBeGreaterThanOrEqual(0);
  expect.soft(rect.bottom).toBeLessThanOrEqual(m.hoehe);
}

function wordLinkLesbar(m: WordMessung, sprache: Sprache): void {
  expect(m.linktext).toBe(hilfesaetze[sprache]);
  expect(m.scrollWidth, "Hilfe-Link: waagerechter Textüberlauf").toBeLessThanOrEqual(
    m.clientWidth + 1,
  );
  expect(m.scrollHeight, "Hilfe-Link: senkrechter Textüberlauf").toBeLessThanOrEqual(
    m.clientHeight + 1,
  );
  // Text-, Tastatur- und Reloadfälle prüfen alle Kanten HART, nur die Matrix sammelt Kantenfehler.
  expect(m.hilfe.left).toBeGreaterThanOrEqual(0);
  expect(m.hilfe.right).toBeLessThanOrEqual(m.fenster);
  expect(m.hilfe.top).toBeGreaterThanOrEqual(0);
  expect(m.hilfe.bottom).toBeLessThanOrEqual(m.hoehe);
}

async function wordTastatur(seite: SeiteMitTastatur, sprache: Sprache): Promise<void> {
  const fokus = () =>
    seite.evaluate<string>(
      fn(`() => {
    const aktiv = document.activeElement;
    if (aktiv?.matches('[data-testid="klara-path-teaser"] summary')) return 'summary';
    if (aktiv?.matches('[data-testid="klara-path-teaser"] a[href="/hilfe"]')) return 'hilfe';
    return aktiv?.outerHTML ?? 'kein Fokus';
  }`),
    );
  await seite.evaluate(
    fn(`() => document.querySelector('[data-testid="klara-path-teaser"] summary').focus()`),
  );
  expect(await fokus()).toBe("summary");
  await seite.keyboard.press("Tab");
  expect(await fokus()).toBe("hilfe");
  await seite.keyboard.press("Shift+Tab");
  expect(await fokus()).toBe("summary");
  await seite.keyboard.press("Tab");
  expect(await fokus()).toBe("hilfe");
  await seite.keyboard.press("Enter");
  await seite.waitForFunction(
    fn(`(sprache) => location.pathname === "/hilfe" &&
      [...document.querySelectorAll('main h1')].some(el => el.textContent.trim() === (sprache === 'de' ? 'Hilfe' : 'Help')) &&
      !!document.querySelector('main input[placeholder="' + (sprache === 'de' ? 'Hilfe durchsuchen …' : 'Search help …') + '"]')`),
    sprache,
    { timeout: 10_000 },
  );
  expect(await seite.evaluate(fn("() => document.documentElement.lang"))).toBe(sprache);
}

describe("JOB 3144 · Klara-Webhilfe in Chromium", () => {
  beforeAll(async () => {
    // Die gemeinsame Vorrichtung wartet auf Bibliotheksliste und Bericht, deshalb dort starten;
    // die Messung selbst navigiert anschließend zur echten Startseite.
    stand = await h4Stand("/wissen/:frei", "pedi@job3144.test");
  }, 180_000);
  afterAll(async () => {
    try {
      await stand?.browser.close();
    } finally {
      await stand?.app.close();
    }
  }, 60_000);

  it("F1 · 320 DE: linke Panelkante im Bild", async () => {
    expect((await messen(320, "de")).panel.left).toBeGreaterThanOrEqual(0);
  });
  it("F2 · 320 DE: rechte Panelkante im Bild (Paar mit F1)", async () => {
    expect((await messen(320, "de")).panel.right).toBeLessThanOrEqual(320);
  });
  it("F3 · 320 DE: Suchfeld vollständig im Bild", async () => {
    imBild((await messen(320, "de")).suche, 320);
  });
  it("F4 · 320 DE: kein waagerechter Seitenüberlauf", async () => {
    expect((await messen(320, "de")).ueberlauf).toBe(0);
  });
  it("F5 · 320 EN: Panel und Suchfeld vollständig im Bild", async () => {
    const m = await messen(320, "en");
    imBild(m.panel, 320);
    imBild(m.suche, 320);
  });
  it("F6 · 390 DE: unverändert x = 30 und Breite = 340", async () => {
    const m = await messen(390, "de");
    expect(m.panel.left).toBe(30);
    expect(m.panel.width).toBe(340);
  });
  it("F7 · 320 DE: Rückweg und Schließen vollständig im Bild", async () => {
    const m = await messen(320, "de");
    imBild(m.hilfe, 320);
    imBild(m.schliessen, 320);
  });
  it.each([
    [320, "de"],
    [320, "en"],
    [390, "de"],
    [390, "en"],
    [1280, "de"],
    [1280, "en"],
  ] as const)(
    "%i px / %s: alle fünf Bedienelemente und Panel im Bild, kein Überlauf",
    async (breite, sprache) => {
      const m = await messen(breite, sprache);
      for (const rect of [m.panel, m.suche, m.schliessen, m.element, m.markierung, m.hilfe]) {
        imBild(rect, breite);
      }
      expect(m.ueberlauf).toBe(0);
      if (breite >= 390) expect(m.panel.width).toBe(340);
    },
  );

  it("T1 · Word-Vorschau: echte Tab-Taste erreicht den Hilfe-Link, Enter öffnet /hilfe", async () => {
    if (!stand) throw new Error("Chromium-Prüfstand fehlt");
    const seite = stand.seite as SeiteMitTastatur;
    await seite.evaluate(fn('() => localStorage.setItem("kw.sprache", "de")'));
    await seite.goto(`${ORIGIN}/start`, { waitUntil: "load" });
    await seite.waitForFunction(
      fn("() => !!document.querySelector('button[aria-label=\"Mehr zu dieser Seite\"]')"),
    );
    await seite.evaluate(
      fn("() => document.querySelector('button[aria-label=\"Mehr zu dieser Seite\"]').click()"),
    );
    await seite.waitForFunction(
      fn(
        '() => [...document.querySelectorAll("button")].some(el => el.textContent.trim() === "Klara in Word")',
      ),
    );
    await seite.evaluate(
      fn(
        '() => [...document.querySelectorAll("button")].find(el => el.textContent.trim() === "Klara in Word").click()',
      ),
    );
    await seite.waitForFunction(
      fn("() => !!document.querySelector('[data-testid=\"klara-path-teaser\"] summary')"),
    );
    await seite.evaluate(
      fn("() => document.querySelector('[data-testid=\"klara-path-teaser\"] summary').focus()"),
    );
    await seite.keyboard.press("Tab");
    expect(
      await seite.evaluate(
        fn(
          '() => document.activeElement?.matches(\'[data-testid="klara-path-teaser"] a[href="/hilfe"]\')',
        ),
      ),
    ).toBe(true);
    await seite.keyboard.press("Enter");
    await seite.waitForFunction(
      fn(`() => location.pathname === "/hilfe" &&
        [...document.querySelectorAll('main h1')].some(el => el.textContent.trim() === 'Hilfe') &&
        !!document.querySelector('main input[placeholder="Hilfe durchsuchen …"]')`),
    );
    expect(stand.seitenfehler).toEqual([]);
  });

  it.each(
    wordRouten.flatMap((route) =>
      [320, 390, 1280].flatMap((breite) =>
        wordSprachen.map((sprache) => ({ route, breite, sprache })),
      ),
    ),
  )(
    "W1 · $route / $breite px / $sprache: Word-Hinweis, summary und Hilfe-Link vollständig im Bild",
    async ({ route, breite, sprache }) => {
      if (!stand) throw new Error("Chromium-Prüfstand fehlt");
      try {
        const m = await wordMessen(route, breite, sprache);
        for (const rect of [m.hinweis, m.summary, m.hilfe]) wordImBild(rect, m);
        expect(m.ueberlauf).toBe(0);
        expect(m.sprache).toBe(sprache);
      } finally {
        expect(stand.seitenfehler).toEqual([]);
      }
    },
  );

  it.each(
    wordRouten.flatMap((route) =>
      [320, 360, 390, 1280].flatMap((breite) =>
        wordSprachen.map((sprache) => ({ route, breite, sprache })),
      ),
    ),
  )(
    "W2 · $route / $breite px / $sprache: ganzer Hilfesatz ohne verdeckten Textüberlauf",
    async ({ route, breite, sprache }) => {
      if (!stand) throw new Error("Chromium-Prüfstand fehlt");
      try {
        wordLinkLesbar(await wordMessen(route, breite, sprache), sprache);
      } finally {
        expect(stand.seitenfehler).toEqual([]);
      }
    },
  );

  it.each(
    wordRouten.flatMap((route) =>
      [390, 1280].flatMap((breite) => wordSprachen.map((sprache) => ({ route, breite, sprache }))),
    ),
  )(
    "W3 · $route / $breite px / $sprache: Tab hin, Shift+Tab zurück, Enter öffnet echte Hilfe",
    async ({ route, breite, sprache }) => {
      if (!stand) throw new Error("Chromium-Prüfstand fehlt");
      try {
        // Interaktionen laden immer frisch; der Geometriecache kann keine Navigation ersetzen.
        const seite = await wordOeffnen(route, breite, sprache);
        const m = await wordAblesen(seite);
        expect(m.route).toBe(route);
        expect(m.fenster).toBe(breite);
        expect(m.sprache).toBe(sprache);
        wordLinkLesbar(m, sprache);
        await wordTastatur(seite, sprache);
      } finally {
        expect(stand.seitenfehler).toEqual([]);
      }
    },
  );

  it.each(wordRouten.flatMap((route) => wordSprachen.map((sprache) => ({ route, sprache }))))(
    "W4 · $route / 390 px / $sprache: Reload erhält Sprache und erreichbaren Hilfeweg mit Tab/Enter",
    async ({ route, sprache }) => {
      if (!stand) throw new Error("Chromium-Prüfstand fehlt");
      try {
        const seite = await wordOeffnen(route, 390, sprache);
        wordLinkLesbar(await wordAblesen(seite), sprache);
        await seite.reload({ waitUntil: "load" });
        // KEIN Setzen der Sprache, kein goto, kein Cache nach dem echten Reload.
        await wordHinweisOeffnen(seite, route, sprache);
        const m = await wordAblesen(seite);
        expect(m.route).toBe(route);
        expect(m.fenster).toBe(390);
        expect(m.sprache).toBe(sprache);
        expect(await seite.evaluate(fn('() => localStorage.getItem("kw.sprache")'))).toBe(sprache);
        wordLinkLesbar(m, sprache);
        await wordTastatur(seite, sprache);
      } finally {
        expect(stand.seitenfehler).toEqual([]);
      }
    },
  );
});

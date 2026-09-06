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
});

// P04: gebaute Produktseite, echte Tastatur, berechnetes Layout. Keine CSS-Kopie.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SPRACHE_STORAGE_KEY } from "../../apps/web/src/lib/sprachwahl";
import { type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";

let stand: H4Stand;
const LONG_NAME = `${"Wartungsunterlagen_".repeat(9)}Schluss_A`;
const OTHER_NAME = `${"Wartungsunterlagen_".repeat(9)}Schluss_B`;
async function enter(selector: string): Promise<void> {
  const page = stand.seite;
  expect(
    await page.evaluate<boolean>(
      fn(`(selector) => {
    const el = document.querySelector(selector);
    if (!el) return false;
    el.focus(); return document.activeElement === el;
  }`),
      selector,
    ),
  ).toBe(true);
  await page.keyboard.press("Enter");
}
async function summary(text: string): Promise<void> {
  expect(
    await stand.seite.evaluate<boolean>(
      fn(`(text) => {
    const el = [...document.querySelectorAll('summary')].find(el => el.textContent.trim().includes(text));
    if (!el) return false;
    el.focus(); return document.activeElement === el;
  }`),
      text,
    ),
  ).toBe(true);
  await stand.seite.keyboard.press("Enter");
}

describe("P04 · Name und Eingabe bei 360/1440 px (Chromium)", () => {
  beforeAll(async () => {
    stand = await h4Stand("/bibliothek", "pedi@job3137.test");
  }, 180_000);
  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it.each([360, 1440])(
    "%i px · langer Name ist vollständig lesbar, Tab/Enter speichern und rufen die Sicht auf",
    async (width) => {
      const page = stand.seite;
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${ORIGIN}/bibliothek?raum=meine&zustand=validiert`, { waitUntil: "load" });
      await page.waitForFunction(fn(`() => document.querySelector('[data-testid="bib-zeile"]')`));
      const before = await page.evaluate<string[]>(
        fn(
          `() => [...document.querySelectorAll('[data-testid="bib-zeile"]')].map(el => el.dataset.bibId).sort()`,
        ),
      );
      expect(before).toContain(stand.koId);
      for (const name of [LONG_NAME, OTHER_NAME]) {
        await enter('[data-testid="bib-liste-menue"]');
        await summary("Sicht speichern");
        await page.keyboard.press("Tab");
        expect(await page.evaluate<string>(fn("() => document.activeElement.id"))).toBe(
          "bib-sichtname",
        );
        await page.keyboard.type(name);
        const input = await page.evaluate<{
          width: number;
          left: number;
          right: number;
          value: string;
        }>(
          fn(`() => {
        const el = document.querySelector('#bib-sichtname'); const r = el.getBoundingClientRect();
        return { width: r.width, left: r.left, right: r.right, value: el.value };
      }`),
        );
        expect(input.width).toBeGreaterThan(180);
        expect(input.left).toBeGreaterThanOrEqual(0);
        expect(input.right).toBeLessThanOrEqual(width);
        expect(input.value).toBe(name);
        await page.keyboard.press("Tab");
        expect(await page.evaluate<string>(fn("() => document.activeElement.dataset.testid"))).toBe(
          "bib-sicht-speichern",
        );
        await page.keyboard.press("Enter");
        expect(await page.evaluate<string>(fn("() => document.activeElement.dataset.testid"))).toBe(
          "bib-liste-menue",
        );
      }
      await enter('[data-testid="bib-scope-alle"]');
      await enter('[data-testid="bib-segment-offen"]');
      await enter('[data-testid="bib-liste-menue"]');
      await summary("Sichten");
      const names = await page.evaluate<
        Array<{
          text: string;
          width: number;
          height: number;
          overflow: number;
          left: number;
          right: number;
          checked: string;
          clipped: boolean;
        }>
      >(
        fn(`(names) => {
      return [...document.querySelectorAll('[role="menuitemcheckbox"]')]
        .filter(el => names.some(name => el.textContent.includes(name)))
        .map(el => {
          const span = el.lastElementChild.firstElementChild;
          const r = span.getBoundingClientRect(); const style = getComputedStyle(span);
          return { text: span.textContent, width: r.width, height: r.height,
            overflow: span.scrollWidth - span.clientWidth, left: r.left, right: r.right,
            checked: el.getAttribute('aria-checked'),
            clipped: style.textOverflow === 'ellipsis' || style.overflow === 'hidden' };
        });
    }`),
        [LONG_NAME, OTHER_NAME],
      );
      expect(names.map((n) => n.text).sort()).toEqual([LONG_NAME, OTHER_NAME].sort());
      for (const name of names) {
        expect(name.width).toBeGreaterThan(180);
        expect(name.height).toBeGreaterThan(30);
        expect(name.overflow).toBeLessThanOrEqual(1);
        expect(name.clipped).toBe(false);
        expect(name.left).toBeGreaterThanOrEqual(0);
        expect(name.right).toBeLessThanOrEqual(width);
        expect(name.checked).toBe("false");
      }
      console.info(`P04 ${width}px: ${JSON.stringify(names)}`);
      // Tab von der aufgeklappten Zusammenfassung erreicht den ersten gespeicherten Namen.
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate<string>(fn("() => document.activeElement.textContent.trim()")),
      ).toBe(LONG_NAME);
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        fn(
          `() => document.querySelector('[data-testid="bib-segment-validiert"]').getAttribute('aria-pressed') === 'true'`,
        ),
      );
      expect(
        await page.evaluate<string[]>(
          fn(
            `() => [...document.querySelectorAll('[data-testid="bib-zeile"]')].map(el => el.dataset.bibId).sort()`,
          ),
        ),
      ).toEqual(before);
      expect(
        await page.evaluate<string>(
          fn(
            `() => document.querySelector('[data-testid="bib-scope-meine"]').getAttribute('aria-pressed')`,
          ),
        ),
      ).toBe("true");
      expect(stand.seitenfehler).toEqual([]);
    },
    60_000,
  );

  it("UX-29 C · Hinweis bei 320/390 px in DE/EN ohne Überlauf; Name und Speichern bleiben erreichbar", async () => {
    const page = stand.seite;
    for (const width of [320, 390]) {
      for (const language of ["de", "en"]) {
        await page.setViewportSize({ width, height: 740 });
        await page.evaluate<void>(
          fn(`({ key, language }) => {
          localStorage.setItem(key, language);
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith('klarwerk.library.views.')) localStorage.removeItem(key);
          }
        }`),
          { key: SPRACHE_STORAGE_KEY, language },
        );
        await page.goto(`${ORIGIN}/bibliothek?raum=meine`, { waitUntil: "load" });
        await page.waitForFunction(fn(`() => document.querySelector('[data-testid="bib-zeile"]')`));
        await enter('[data-testid="bib-liste-menue"]');
        await summary(language === "de" ? "Sicht speichern" : "Save view");
        await page.keyboard.press("Tab");
        await page.keyboard.type("UX-29 C");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Enter");
        await enter('[data-testid="bib-liste-menue"]');
        await summary(language === "de" ? "Sichten" : "Views");
        const hint = await page.evaluate<{
          text: string;
          lines: number;
          overflow: number;
          within: boolean;
          visible: boolean;
        }>(
          fn(`() => {
          const el = document.querySelector('[data-testid="bib-sichten-hinweis"]');
          if (!el) throw new Error('Speicherhinweis fehlt');
          const menu = el.closest('[role="menu"]');
          const m = menu.getBoundingClientRect();
          const r = el.getBoundingClientRect();
          const range = document.createRange(); range.selectNodeContents(el);
          const lines = [...range.getClientRects()];
          const style = getComputedStyle(el);
          return { text: el.textContent, lines: lines.length,
            overflow: el.scrollWidth - el.clientWidth,
            within: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight &&
              lines.every(l => l.left >= Math.max(r.left, m.left) && l.right <= Math.min(r.right, m.right) && l.top >= Math.max(r.top, m.top) && l.bottom <= Math.min(r.bottom, m.bottom)),
            visible: style.display !== 'none' && style.visibility !== 'hidden' &&
              el.closest('details').open && !el.closest('[hidden], [aria-hidden="true"]') };
        }`),
        );
        expect(hint.text).toContain(
          language === "de" ? "nur in diesem Browser" : "only in this browser",
        );
        expect(hint.text).toContain(
          language === "de" ? "Fenstergröße beginnt neu" : "window size starts over",
        );
        expect(hint.lines).toBeGreaterThan(1);
        expect(hint.overflow).toBeLessThanOrEqual(1);
        expect(hint.within).toBe(true);
        expect(hint.visible).toBe(true);
        // Mit offenem Hinweis wird die Liste per Tab erreicht, auch wenn das Menü rollen muss.
        await page.keyboard.press("Tab");
        expect(
          await page.evaluate<string>(
            fn("() => document.activeElement.lastElementChild.textContent.trim()"),
          ),
        ).toBe("UX-29 C");
        await summary(language === "de" ? "Sicht speichern" : "Save view");
        await page.keyboard.press("Tab");
        expect(await page.evaluate<string>(fn("() => document.activeElement.id"))).toBe(
          "bib-sichtname",
        );
        await page.keyboard.type("Weiter");
        await page.keyboard.press("Tab");
        const save = await page.evaluate<{ focused: string; reachable: boolean }>(
          fn(`() => {
          const el = document.activeElement; const r = el.getBoundingClientRect();
          const m = el.closest('[role="menu"]').getBoundingClientRect();
          return { focused: el.dataset.testid,
            reachable: !el.disabled && r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth &&
              r.top >= Math.max(0, m.top) && r.bottom <= Math.min(innerHeight, m.bottom) &&
              el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) };
        }`),
        );
        expect(save.focused).toBe("bib-sicht-speichern");
        expect(save.reachable).toBe(true);
        await page.keyboard.press("Enter");
        expect(await page.evaluate<string>(fn("() => document.activeElement.dataset.testid"))).toBe(
          "bib-liste-menue",
        );
        console.info(`UX-29 C ${width}px ${language}: ${JSON.stringify({ hint, save })}`);
      }
    }
    expect(stand.seitenfehler).toEqual([]);
  }, 60_000);
});

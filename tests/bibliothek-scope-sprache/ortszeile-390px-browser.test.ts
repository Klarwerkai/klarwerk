import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";

// Teildeckung: Beschriftungen der echten Bibliotheksfläche bei 390 px.
// styles/modern.css wird als Teil des gebauten Produkts geladen. Keine allgemeine
// Theme-, Kontrast- oder Designabnahme. Gemessen am gebauten Produkt samt echtem API-Bestand.
let stand: H4Stand;
describe("JOB 3489 · Ortszeile bei 390 px in Chromium", () => {
  beforeAll(async () => {
    stand = await h4Stand("/bibliothek", "scope@job3489.test");
  }, 180_000);
  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);
  it.each([
    ["de", "Geltungsbereich", "Meine Ablage", "Alle Inhalte"],
    ["en", "Scope", "My collection", "All content"],
    ["nl", "Bereik", "Mijn verzameling", "Alle inhoud"],
  ])("%s · beide Beschriftungen sichtbar und ungekürzt", async (sprache, gruppe, meine, alle) => {
    await stand.seite.setViewportSize({ width: 390, height: 844 });
    await stand.seite.evaluate(
      fn('(sprache) => localStorage.setItem("kw.sprache", sprache)'),
      sprache,
    );
    await stand.seite.goto(`${ORIGIN}/bibliothek`);
    await stand.seite.waitForFunction(
      fn('() => !!document.querySelector("[data-testid=library-scope-bar] fieldset")'),
    );
    const messung = await stand.seite.evaluate<{
      gruppe: string;
      buttons: {
        text: string;
        sichtbar: boolean;
        breite: number;
        scroll: number;
        links: number;
        rechts: number;
      }[];
    }>(
      fn(`() => {
      const bar = document.querySelector('[data-testid="library-scope-bar"]');
      return { gruppe: bar.querySelector('fieldset').getAttribute('aria-label'),
        buttons: [...bar.querySelectorAll('button')].map(b => {
          const r = b.getBoundingClientRect();
          return { text: b.innerText, sichtbar: b.checkVisibility({checkOpacity: true, checkVisibilityCSS: true}),
            breite: b.clientWidth, scroll: b.scrollWidth, links: r.left, rechts: r.right };
        }) };
    }`),
    );
    expect(messung.gruppe).toBe(gruppe);
    expect(messung.buttons.map((b) => b.text)).toEqual([meine, alle]);
    for (const b of messung.buttons) {
      expect(b.sichtbar, b.text).toBe(true);
      expect(b.breite, b.text).toBeGreaterThan(0);
      expect(b.scroll, `${b.text} wird abgeschnitten`).toBeLessThanOrEqual(b.breite);
      expect(b.links).toBeGreaterThanOrEqual(0);
      expect(b.rechts).toBeLessThanOrEqual(390);
    }
    expect(stand.seitenfehler).toEqual([]);
    console.info(`JOB 3489 · 390px ${sprache}: ${JSON.stringify(messung)}`);
  });
});

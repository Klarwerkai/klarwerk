// ================================================================================================
// K21 / R-1809 (mega10 B1, H4 §5.6 · NACHARBEIT 12) — SUCHE INNERHALB EINER ÜBERVOLLEN DIMENSION.
// ================================================================================================
// Gebaute Seite in Chromium, echte Fastify-Dienste, angemeldete H4-Prüfdaten (`h4Stand`). Der
// Bestand bekommt zehn Bereiche mit je zwei Einträgen und EINEN Zielbereich mit einem Eintrag.
// Die Werte sind nach Anzahl, dann Name geordnet und auf acht gedeckelt — der Zielbereich liegt
// also AUSSERHALB des Anzeige-Deckels (das wird zuerst gemessen, sonst bewiese der Fall nichts).
// Dann: im Menü „Bereich" über das Suchfeld der Dimension suchen, den Wert per Tastatur wählen,
// Treffer und Adresse prüfen, denselben Wert wieder abwählen und die Rücknahme prüfen.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SPRACHE_STORAGE_KEY } from "../../apps/web/src/lib/sprachwahl";
import { type H4Stand, type H4Vorbereitung, ORIGIN, fn, h4Stand } from "../design/h4-harness";

const ZIEL = "Zielbereich Ventile";
let stand: H4Stand;
let zielId = "";

/** Ein Element fokussieren (Selektor im Dokument) und Enter drücken — echte Tastatur. */
async function enter(selector: string): Promise<void> {
  expect(
    await stand.seite.evaluate<boolean>(
      fn(`(selector) => {
    const el = document.querySelector(selector);
    if (!el) return false;
    el.focus(); return document.activeElement === el;
  }`),
      selector,
    ),
  ).toBe(true);
  await stand.seite.keyboard.press("Enter");
}

/** Die Beschriftungen der Menüpunkte im offenen Menü „Bereich". */
async function bereichPunkte(): Promise<string[]> {
  return stand.seite.evaluate<string[]>(
    fn(`() => {
    const knopf = document.querySelector('[data-testid="bib-menue-bereich"]');
    const menue = knopf && knopf.parentElement.querySelector('[role="menu"]');
    if (!menue) return [];
    return [...menue.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]')]
      .map(el => el.textContent.replace(/[✓]/g, '').trim());
  }`),
  );
}

/** Wartet auf einen frischen Listenstand und liest die sortierten Trefferkennungen. */
async function treffer(): Promise<string[]> {
  await stand.seite.waitForFunction(
    fn(`() => {
    const fuss = document.querySelector('[data-testid="bib-fuss"]');
    return !!fuss && /\\d/.test(fuss.textContent);
  }`),
  );
  return stand.seite.evaluate<string[]>(
    fn(`() => [...document.querySelectorAll('[data-testid="bib-zeile"]')]
      .map(el => el.dataset.bibId).sort()`),
  );
}

/** Zehn Bereiche mit je zwei Einträgen, dazu der Zielbereich mit einem — über den echten Dienst. */
async function fuellen({ services, autorId }: H4Vorbereitung): Promise<void> {
  for (let b = 1; b <= 10; b++) {
    for (let n = 1; n <= 2; n++) {
      await services.ko.create({
        title: `K21 Bereich ${String(b).padStart(2, "0")} Eintrag ${n}`,
        statement: "Ein Eintrag, der die Bereichsdimension füllt.",
        type: "best_practice",
        category: `Bereich ${String(b).padStart(2, "0")}`,
        author: autorId,
      } as never);
    }
  }
  const ziel = (await services.ko.create({
    title: "K21 Eintrag im Zielbereich",
    statement: "Der einzige Eintrag im Zielbereich.",
    type: "best_practice",
    category: ZIEL,
    author: autorId,
  } as never)) as { id: string };
  zielId = ziel.id;
}

/** Den Menüpunkt des Zielbereichs markieren, damit `enter` ihn per Selektor fokussieren kann. */
async function zielMarkieren(): Promise<void> {
  await stand.seite.evaluate<void>(
    fn(`(ziel) => {
    const el = [...document.querySelectorAll('[role="menuitemcheckbox"]')]
      .find(e => e.textContent.includes(ziel));
    if (el) el.setAttribute('data-bib-ziel', '1');
  }`),
    ZIEL,
  );
}

describe("K21 · Dimensionssuche im Menü „Bereich“ (Chromium)", () => {
  beforeAll(async () => {
    stand = await h4Stand("/bibliothek", "pedi@k21-dimension.test", fuellen);
  }, 180_000);
  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("Wert außerhalb des Deckels suchen, wählen, Treffer prüfen, wieder abwählen", async () => {
    const page = stand.seite;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate<void>(fn(`(key) => localStorage.setItem(key, 'de')`), SPRACHE_STORAGE_KEY);
    await page.goto(`${ORIGIN}/bibliothek`, { waitUntil: "load" });
    const alle = await treffer();
    expect(alle).toContain(zielId);

    // 1 · Ohne Suche: der Zielbereich ist NICHT unter den angebotenen Werten, „Alle N" steht da.
    await enter('[data-testid="bib-menue-bereich"]');
    const vorher = await bereichPunkte();
    expect(
      vorher.some((p) => p.startsWith(ZIEL)),
      "Zielwert liegt im Deckel",
    ).toBe(false);
    expect(vorher.some((p) => p.startsWith("Alle "))).toBe(true);

    // 2 · Das beschriftete Suchfeld der Dimension — per Tastatur bedient.
    const feld = await page.evaluate<{ label: string; placeholder: string; fokus: boolean }>(
      fn(`() => {
      const el = document.querySelector('#bib-dimensionssuche-category');
      if (!el) return { label: '', placeholder: '', fokus: false };
      const label = document.querySelector('label[for="bib-dimensionssuche-category"]');
      el.focus();
      return { label: label ? label.textContent.trim() : '', placeholder: el.placeholder,
        fokus: document.activeElement === el };
    }`),
    );
    expect(feld.fokus).toBe(true);
    expect(feld.label.length).toBeGreaterThan(0);
    await page.keyboard.type("Zielber");
    await page.waitForFunction(
      fn(`(ziel) => {
      const knopf = document.querySelector('[data-testid="bib-menue-bereich"]');
      const menue = knopf && knopf.parentElement.querySelector('[role="menu"]');
      return !!menue && [...menue.querySelectorAll('[role="menuitemcheckbox"]')]
        .some(el => el.textContent.includes(ziel));
    }`),
      ZIEL,
    );
    const gesucht = await bereichPunkte();
    expect(
      gesucht.filter((p) => p.includes("Bereich 0")),
      "nur passende Werte",
    ).toEqual([]);
    expect(gesucht.find((p) => p.startsWith(ZIEL))).toBe(`${ZIEL} · 1`);

    // 3 · Wählen: genau der eine Eintrag, Adresse trägt die Auswahl, Menü zählt sie.
    const zielPunkt = `[role="menuitemcheckbox"][data-bib-ziel="1"]`;
    await zielMarkieren();
    await enter(zielPunkt);
    await page.waitForFunction(
      fn(`() => document.querySelectorAll('[data-testid="bib-zeile"]').length === 1`),
    );
    expect(await treffer()).toEqual([zielId]);
    const nachWahl = await page.evaluate<{ adresse: string; haken: string | null }>(
      fn(`() => ({ adresse: location.search,
        haken: document.querySelector('[data-bib-ziel="1"]')?.getAttribute('aria-checked') ?? null })`),
    );
    expect(new URLSearchParams(nachWahl.adresse).getAll("category")).toEqual([ZIEL]);
    expect(nachWahl.haken).toBe("true");

    // 4 · Rücknahme: derselbe Wert wird wieder abgewählt — alle Treffer kehren zurück.
    await zielMarkieren();
    await enter(zielPunkt);
    await page.waitForFunction(
      fn(`(n) => document.querySelectorAll('[data-testid="bib-zeile"]').length === n`),
      alle.length,
    );
    expect(await treffer()).toEqual(alle);
    const sucheNachher = await page.evaluate<string>(fn("() => location.search"));
    expect(new URLSearchParams(sucheNachher).has("category")).toBe(false);
    console.info(`K21 Dimensionssuche: ${JSON.stringify({ vorher, gesucht, n: alle.length })}`);
    expect(stand.seitenfehler).toEqual([]);
  }, 60_000);
});

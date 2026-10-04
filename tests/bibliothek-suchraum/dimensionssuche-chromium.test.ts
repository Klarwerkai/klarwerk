// ================================================================================================
// K21 / R-1809 (mega10 B1, H4 §5.6 · NACHARBEIT 12) — SUCHE INNERHALB EINER ÜBERVOLLEN DIMENSION.
// ================================================================================================
// Gebaute Seite in Chromium, echte Fastify-Dienste, angemeldete H4-Prüfdaten (`h4Stand`). Der
// Bestand bekommt zehn Bereiche mit je zwei Einträgen und EINEN Zielbereich mit einem Eintrag.
// Die Werte sind nach Anzahl, dann Name geordnet und auf acht gedeckelt — der Zielbereich liegt
// also AUSSERHALB des Anzeige-Deckels (das wird zuerst gemessen, sonst bewiese der Fall nichts).
// Dann: im Menü „Bereich" über das Suchfeld der Dimension suchen, den Wert per Tastatur wählen,
// Treffer und Adresse prüfen, denselben Wert wieder abwählen und die Rücknahme prüfen.
// NACHARBEIT 13 (F1): zusätzlich der Deckel in beide Richtungen — „Alle N zeigen" und der neue
// Gegenpunkt „Weniger zeigen" — im Menü „Bereich" und im übervollen Untermenü „Schlagwort".
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SPRACHE_STORAGE_KEY } from "../../apps/web/src/lib/sprachwahl";
import { type H4Stand, type H4Vorbereitung, ORIGIN, fn, h4Stand } from "../design/h4-harness";

const ZIEL = "Zielbereich Ventile";
const ZIEL_TAG = "k21-zielschlagwort";
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

/**
 * Zehn Bereiche mit je zwei Einträgen, dazu der Zielbereich mit einem — über den echten Dienst.
 * NACHARBEIT 13: jeder Bereich trägt zusätzlich ein eigenes Schlagwort (zehn Werte mit je zwei
 * Einträgen), der Zieleintrag ein eigenes — so ist auch das Untermenü „Schlagwort" übervoll und
 * dessen Zielwert liegt außerhalb des Deckels.
 */
async function fuellen({ services, autorId }: H4Vorbereitung): Promise<void> {
  for (let b = 1; b <= 10; b++) {
    for (let n = 1; n <= 2; n++) {
      await services.ko.create({
        title: `K21 Bereich ${String(b).padStart(2, "0")} Eintrag ${n}`,
        statement: "Ein Eintrag, der die Bereichsdimension füllt.",
        type: "best_practice",
        category: `Bereich ${String(b).padStart(2, "0")}`,
        tags: [`k21-tag-${String(b).padStart(2, "0")}`],
        author: autorId,
      } as never);
    }
  }
  const ziel = (await services.ko.create({
    title: "K21 Eintrag im Zielbereich",
    statement: "Der einzige Eintrag im Zielbereich.",
    type: "best_practice",
    category: ZIEL,
    tags: [ZIEL_TAG],
    author: autorId,
  } as never)) as { id: string };
  zielId = ziel.id;
}

// ---- NACHARBEIT 13 · F1: Deckel auf („Alle N zeigen") und wieder zu („Weniger zeigen") ----------

type Art = "category" | "tag";

/** Der Behälter einer Dimension: das offene Menü „Bereich" bzw. das Untermenü „Schlagwort". */
const BEHAELTER = `const behaelter = (art) => art === 'category'
    ? (document.querySelector('[data-testid="bib-menue-bereich"]')?.parentElement
        .querySelector('[role="menu"]') ?? null)
    : ([...document.querySelectorAll('[role="menu"] details')].find((d) =>
        d.querySelector('summary span.min-w-0')?.textContent.trim() === 'Schlagwort') ?? null);`;

interface DeckelStand {
  werte: { text: string; haken: string | null }[];
  alle: string | null;
  weniger: string | null;
}

/** Werte der Dimension samt Haken und die beiden Deckel-Punkte (Text oder null). */
async function deckelStand(art: Art): Promise<DeckelStand> {
  return stand.seite.evaluate<DeckelStand>(
    fn(`(art) => {
    ${BEHAELTER}
    const b = behaelter(art);
    if (!b) return { werte: [], alle: null, weniger: null };
    const text = (sel) => b.querySelector(sel)?.textContent.trim() ?? null;
    return {
      werte: [...b.querySelectorAll('[role="menuitemcheckbox"]')].map((el) => ({
        text: el.textContent.replace(/[✓]/g, '').trim(),
        haken: el.getAttribute('aria-checked'),
      })),
      alle: text('[data-testid="bib-deckel-alle-' + art + '"]'),
      weniger: text('[data-testid="bib-deckel-weniger-' + art + '"]'),
    };
  }`),
    art,
  );
}

/** Wartet, bis die Dimension genau `n` Werte zeigt. */
async function warteAufWerte(art: Art, n: number): Promise<void> {
  await stand.seite.waitForFunction(
    fn(`([art, n]) => {
    ${BEHAELTER}
    const b = behaelter(art);
    return !!b && b.querySelectorAll('[role="menuitemcheckbox"]').length === n;
  }`),
    [art, n],
  );
}

/** Den Wert-Menüpunkt mit `text` in der Dimension markieren (für `enter`). */
async function wertMarkieren(art: Art, text: string): Promise<void> {
  await stand.seite.evaluate<void>(
    fn(`([art, text]) => {
    ${BEHAELTER}
    for (const el of document.querySelectorAll('[data-bib-ziel]')) el.removeAttribute('data-bib-ziel');
    const el = [...(behaelter(art)?.querySelectorAll('[role="menuitemcheckbox"]') ?? [])]
      .find((e) => e.textContent.includes(text));
    if (el) el.setAttribute('data-bib-ziel', '1');
  }`),
    [art, text],
  );
}

/** Wartet auf genau diese (sortierten) Trefferkennungen. */
async function warteAufTreffer(ids: readonly string[]): Promise<void> {
  await stand.seite.waitForFunction(
    fn(`(soll) => JSON.stringify([...document.querySelectorAll('[data-testid="bib-zeile"]')]
      .map((el) => el.dataset.bibId).sort()) === soll`),
    JSON.stringify([...ids].sort()),
  );
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

  // NACHARBEIT 13 · F1 — „Alle N zeigen" öffnet den Deckel, „Weniger zeigen" schließt ihn wieder.
  // Dazwischen wird ein Wert gewählt, der NUR im aufgeklappten Zustand angeboten wird. Nach dem
  // Zuklappen muss er sichtbar, angehakt und abwählbar bleiben, Treffer und Adresse unverändert.
  // Zuerst im eigenen Menü „Bereich" (13 Werte), dann im übervollen Untermenü „Schlagwort".
  async function deckelAufUndZu(art: Art, zielText: string): Promise<void> {
    const page = stand.seite;
    const alle = await treffer();

    // 1 · Gedeckelt: acht Werte, Ziel nicht darunter, „Alle N zeigen" steht da, „Weniger" nicht.
    await warteAufWerte(art, 8);
    const zu = await deckelStand(art);
    expect(zu.werte.some((w) => w.text.startsWith(zielText))).toBe(false);
    expect(zu.alle).toMatch(/^Alle \d+ zeigen$/);
    expect(zu.weniger).toBeNull();
    const gesamt = Number(/\d+/.exec(zu.alle ?? "")?.[0]);
    expect(gesamt).toBeGreaterThan(8);

    // 2 · Aufklappen per Tastatur: alle N Werte, Ziel darunter, jetzt steht der Gegenpunkt da.
    await enter(`[data-testid="bib-deckel-alle-${art}"]`);
    await warteAufWerte(art, gesamt);
    const auf = await deckelStand(art);
    expect(auf.werte.some((w) => w.text.startsWith(zielText))).toBe(true);
    expect(auf.alle).toBeNull();
    expect(auf.weniger).toBe("Weniger zeigen");

    // 3 · Den nur aufgeklappt angebotenen Wert wählen.
    await wertMarkieren(art, zielText);
    await enter('[data-bib-ziel="1"]');
    await warteAufTreffer([zielId]);
    const adresseGewaehlt = await page.evaluate<string>(fn("() => location.search"));
    expect(new URLSearchParams(adresseGewaehlt).getAll(art)).toEqual([zielText]);

    // 4 · „Weniger zeigen": wieder gedeckelt — Auswahl, Treffer und Adresse bleiben unverändert,
    // der gewählte Wert steht weiter da und ist angehakt.
    await enter(`[data-testid="bib-deckel-weniger-${art}"]`);
    await warteAufWerte(art, 8);
    const wieder = await deckelStand(art);
    expect(wieder.weniger).toBeNull();
    expect(wieder.alle).toBe(zu.alle);
    expect(wieder.werte.find((w) => w.text.startsWith(zielText))?.haken).toBe("true");
    expect(await treffer()).toEqual([zielId]);
    expect(await page.evaluate<string>(fn("() => location.search"))).toBe(adresseGewaehlt);

    // 5 · Im zugeklappten Zustand abwählbar: alle Treffer kehren zurück, die Adresse ist frei.
    await wertMarkieren(art, zielText);
    await enter('[data-bib-ziel="1"]');
    await warteAufTreffer(alle);
    const frei = await page.evaluate<string>(fn("() => location.search"));
    expect(new URLSearchParams(frei).has(art)).toBe(false);
    console.info(`K21 Deckel ${art}: ${JSON.stringify({ zu, auf: auf.werte.length, wieder })}`);
  }

  it("Bereich: Alle N zeigen, wählen, Weniger zeigen — Wert bleibt", async () => {
    const page = stand.seite;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${ORIGIN}/bibliothek`, { waitUntil: "load" });
    await treffer();
    await enter('[data-testid="bib-menue-bereich"]');
    await deckelAufUndZu("category", ZIEL);
    expect(stand.seitenfehler).toEqual([]);
  }, 60_000);

  it("Schlagwort-Untermenü: Deckel zurück, Auswahl bleibt", async () => {
    const page = stand.seite;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${ORIGIN}/bibliothek`, { waitUntil: "load" });
    await treffer();
    await enter('[data-testid="bib-menue-filter"]');
    // Das Untermenü „Schlagwort" per Tastatur aufklappen (ein `<details>`).
    await page.evaluate<void>(
      fn(`() => {
      const s = [...document.querySelectorAll('[role="menu"] summary')]
        .find((el) => el.querySelector('span.min-w-0')?.textContent.trim() === 'Schlagwort');
      if (s) s.setAttribute('data-bib-summary', 'tag');
    }`),
    );
    await enter('[data-bib-summary="tag"]');
    expect(
      await page.evaluate<boolean>(
        fn(`() => !!document.querySelector('[data-bib-summary="tag"]')?.parentElement.open`),
      ),
    ).toBe(true);
    await deckelAufUndZu("tag", ZIEL_TAG);
    expect(stand.seitenfehler).toEqual([]);
  }, 60_000);
});

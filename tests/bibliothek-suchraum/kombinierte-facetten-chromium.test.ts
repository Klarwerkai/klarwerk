// ================================================================================================
// K21 / R-1809 (mega10 B1 · NACHARBEIT 13, F2) — KOMBINIERTE FACETTEN IN DER GEBAUTEN BIBLIOTHEK.
// ================================================================================================
// Gebaute Seite in Chromium, echte Fastify-Dienste, angemeldete H4-Prüfdaten (`h4Stand`). Vier
// eigene Einträge mit bekannten Bereichen, Schlagwörtern und Anlagezeitpunkten:
//
//   A1  K21 Werk Nord · k21k-ventil · 10.03.2026
//   A2  K21 Werk Nord · k21k-ventil · 20.08.2026
//   A3  K21 Werk Nord · k21k-pumpe  · 12.03.2026
//   B1  K21 Werk Süd  · k21k-ventil · 11.03.2026
//
// Der Anlagezeitpunkt kommt aus der Uhr, die der Wissensdienst selbst als Abhängigkeit führt
// (`now` in `KoService`): sie wird NUR während des Anlegens auf den Kalendertag gestellt und danach
// zurückgesetzt. Kein Datensatz wird nachträglich umgeschrieben; „Zuletzt geändert" liest wie in
// der Anwendung `koChangedMs` (Anlage + Verlauf).
//
// Ablauf: Bereich „Nord" + Schlagwort „ventil" + von/bis März wählen → genau A1. Geprüft werden
// Trefferkennungen, Kontextzähler in beiden Dimensionen, Menü-Zähler und Listenfuß. Danach die von
// der Anwendung geschriebene Adresse vollständig neu laden: Auswahl, Datumsgrenzen und Treffer
// müssen wiederkommen. Zuletzt bei 360 px: Menüs und Datumsfelder per Tab erreichen, die Auswahl per
// Tastatur ändern (Bereich „Süd" dazu → A1 + B1), Escape schließt und gibt den Fokus an den Knopf.
//
// GRENZE (ehrlich): Die Datumswerte werden über den nativen Wertsetzer plus `input`-Ereignis
// eingetragen — das Tippen in ein Chromium-Datumsfeld hängt an der Gebietsschema-Reihenfolge des
// Browsers. Die Tastatur-ERREICHBARKEIT der beiden Felder wird dagegen echt per Tab geprüft.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SPRACHE_STORAGE_KEY } from "../../apps/web/src/lib/sprachwahl";
import { type H4Stand, type H4Vorbereitung, ORIGIN, fn, h4Stand } from "../design/h4-harness";

const NORD = "K21 Werk Nord";
const SUED = "K21 Werk Süd";
const VENTIL = "k21k-ventil";
const PUMPE = "k21k-pumpe";
const VON = "2026-03-01";
const BIS = "2026-03-31";

let stand: H4Stand;
const id = { a1: "", a2: "", a3: "", b1: "" };

async function fuellen({ services, autorId }: H4Vorbereitung): Promise<void> {
  const uhr = services.ko as unknown as { now: () => number };
  const echt = uhr.now;
  const anlegen = async (
    titel: string,
    category: string,
    tag: string,
    zeitpunkt: string,
  ): Promise<string> => {
    uhr.now = () => Date.parse(zeitpunkt);
    const ko = (await services.ko.create({
      title: titel,
      statement: "Ein Eintrag für die kombinierte Facettenprobe.",
      type: "best_practice",
      category,
      tags: [tag],
      author: autorId,
    } as never)) as { id: string };
    return ko.id;
  };
  try {
    id.a1 = await anlegen("K21K Nord Ventil März", NORD, VENTIL, "2026-03-10T10:00:00.000Z");
    id.a2 = await anlegen("K21K Nord Ventil August", NORD, VENTIL, "2026-08-20T10:00:00.000Z");
    id.a3 = await anlegen("K21K Nord Pumpe März", NORD, PUMPE, "2026-03-12T10:00:00.000Z");
    id.b1 = await anlegen("K21K Süd Ventil März", SUED, VENTIL, "2026-03-11T10:00:00.000Z");
  } finally {
    uhr.now = echt;
  }
}

// ---- Hilfen ------------------------------------------------------------------------------------

type Art = "category" | "tag";

const BEHAELTER = `const behaelter = (art) => art === 'category'
    ? (document.querySelector('[data-testid="bib-menue-bereich"]')?.parentElement
        .querySelector('[role="menu"]') ?? null)
    : ([...document.querySelectorAll('[role="menu"] details')].find((d) =>
        d.querySelector('summary span.min-w-0')?.textContent.trim() === 'Schlagwort') ?? null);`;

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

/** Tab drücken, bis der Fokus auf `selector` steht. Liefert die Zahl der Schritte (oder wirft). */
async function tabBis(selector: string, hoechstens = 200): Promise<number> {
  for (let n = 1; n <= hoechstens; n++) {
    await stand.seite.keyboard.press("Tab");
    const da = await stand.seite.evaluate<boolean>(
      fn("(selector) => !!document.activeElement && document.activeElement.matches(selector)"),
      selector,
    );
    if (da) {
      return n;
    }
  }
  throw new Error(`per Tab nicht erreichbar: ${selector}`);
}

/** Wartet auf genau diese (sortierten) Trefferkennungen und einen gefüllten Listenfuß. */
async function warteAufTreffer(ids: readonly string[]): Promise<void> {
  await stand.seite.waitForFunction(
    fn(`(soll) => {
    const fuss = document.querySelector('[data-testid="bib-fuss"]');
    return !!fuss && /\\d/.test(fuss.textContent) &&
      JSON.stringify([...document.querySelectorAll('[data-testid="bib-zeile"]')]
        .map((el) => el.dataset.bibId).sort()) === soll;
  }`),
    JSON.stringify([...ids].sort()),
  );
}

/** Werte einer Dimension mit Kontextzähler-Text und Haken (nur bei offenem Menü/Untermenü). */
async function werte(art: Art): Promise<{ text: string; haken: string | null }[]> {
  return stand.seite.evaluate<{ text: string; haken: string | null }[]>(
    fn(`(art) => {
    ${BEHAELTER}
    const b = behaelter(art);
    return b ? [...b.querySelectorAll('[role="menuitemcheckbox"]')].map((el) => ({
      text: el.textContent.replace(/[✓]/g, '').trim(),
      haken: el.getAttribute('aria-checked'),
    })) : [];
  }`),
    art,
  );
}

/** Den Wert-Menüpunkt mit `text` markieren (für `enter`/`tabBis`). */
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

/** Ein Untermenü (`<summary>`) im offenen Menü über seine Beschriftung markieren. */
async function untermenueMarkieren(beschriftung: string): Promise<void> {
  await stand.seite.evaluate<void>(
    fn(`(beschriftung) => {
    for (const el of document.querySelectorAll('[data-bib-summary]')) el.removeAttribute('data-bib-summary');
    const s = [...document.querySelectorAll('[role="menu"] summary')]
      .find((el) => el.querySelector('span.min-w-0')?.textContent.trim() === beschriftung);
    if (s) s.setAttribute('data-bib-summary', '1');
  }`),
    beschriftung,
  );
}

/** Ein Datumsfeld so setzen, wie React es von einer Eingabe erwartet (s. GRENZE oben). */
async function datumSetzen(feld: string, wert: string): Promise<void> {
  await stand.seite.evaluate<void>(
    fn(`([feld, wert]) => {
    const el = document.querySelector(feld);
    const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setzer.call(el, wert);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }`),
    [feld, wert],
  );
}

interface Kopf {
  bereich: string;
  filter: string;
  fuss: string;
  menueOffen: boolean;
  fokus: string | null;
}

async function kopf(): Promise<Kopf> {
  return stand.seite.evaluate<Kopf>(
    fn(`() => {
    const text = (sel) => document.querySelector(sel)?.textContent.trim() ?? '';
    return {
      bereich: text('[data-testid="bib-menue-bereich"]'),
      filter: text('[data-testid="bib-menue-filter"]'),
      fuss: text('[data-testid="bib-fuss"]'),
      menueOffen: !!document.querySelector('[role="menu"]'),
      fokus: document.activeElement?.getAttribute('data-testid') ?? null,
    };
  }`),
  );
}

async function suche(): Promise<URLSearchParams> {
  return new URLSearchParams(await stand.seite.evaluate<string>(fn("() => location.search")));
}

/** Kontextzähler beider Dimensionen lesen (öffnet und schließt die Menüs per Tastatur). */
async function zaehlerLesen(): Promise<{
  bereich: { text: string; haken: string | null }[];
  schlagwort: { text: string; haken: string | null }[];
  von: string;
  bis: string;
}> {
  await enter('[data-testid="bib-menue-bereich"]');
  const bereich = (await werte("category")).filter((w) => w.text.startsWith("K21 Werk"));
  await stand.seite.keyboard.press("Escape");
  await enter('[data-testid="bib-menue-filter"]');
  await untermenueMarkieren("Schlagwort");
  await enter('[data-bib-summary="1"]');
  const schlagwort = await werte("tag");
  const grenzen = await stand.seite.evaluate<{ von: string; bis: string }>(
    fn(`() => ({
      von: document.querySelector('#bib-von')?.value ?? '',
      bis: document.querySelector('#bib-bis')?.value ?? '',
    })`),
  );
  await stand.seite.keyboard.press("Escape");
  return { bereich, schlagwort, ...grenzen };
}

const ERWARTETE_ZAEHLER = {
  // Bereich: gezählt unter Schlagwort „ventil" (die eigene Dimension ausgeklammert).
  bereich: [
    { text: `${NORD} · 2`, haken: "true" },
    { text: `${SUED} · 1`, haken: "false" },
  ],
  // Schlagwort: gezählt unter Bereich „Nord" (Kindwerte nur im Kontext der Elternwahl).
  schlagwort: [
    { text: `${VENTIL} · 2`, haken: "true" },
    { text: `${PUMPE} · 1`, haken: "false" },
  ],
  von: VON,
  bis: BIS,
};

describe("K21 · Bereich + Schlagwort + Zuletzt geändert kombiniert (Chromium)", () => {
  beforeAll(async () => {
    stand = await h4Stand("/bibliothek", "pedi@k21-kombination.test", fuellen);
  }, 180_000);
  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("kombinieren, Zähler prüfen, Adresse neu laden, 360 px per Tastatur", async () => {
    const page = stand.seite;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate<void>(fn(`(key) => localStorage.setItem(key, 'de')`), SPRACHE_STORAGE_KEY);
    await page.goto(`${ORIGIN}/bibliothek`, { waitUntil: "load" });
    await page.waitForFunction(
      fn(`(ids) => ids.every((i) => document.querySelector('[data-bib-id="' + i + '"]'))`),
      [id.a1, id.a2, id.a3, id.b1],
    );

    // 1 · Bereich „Nord" → A1, A2, A3. Escape schließt und gibt den Fokus an den Knopf zurück.
    await enter('[data-testid="bib-menue-bereich"]');
    await wertMarkieren("category", NORD);
    await enter('[data-bib-ziel="1"]');
    await warteAufTreffer([id.a1, id.a2, id.a3]);
    await page.keyboard.press("Escape");
    expect(await kopf()).toMatchObject({ menueOffen: false, fokus: "bib-menue-bereich" });

    // 2 · Schlagwort „ventil" (Untermenü im Filter-Menü) → A1, A2.
    await enter('[data-testid="bib-menue-filter"]');
    await untermenueMarkieren("Schlagwort");
    await enter('[data-bib-summary="1"]');
    await wertMarkieren("tag", VENTIL);
    await enter('[data-bib-ziel="1"]');
    await warteAufTreffer([id.a1, id.a2]);

    // 3 · Zuletzt geändert von/bis März → genau A1.
    await untermenueMarkieren("Zuletzt geändert");
    await enter('[data-bib-summary="1"]');
    await datumSetzen("#bib-von", VON);
    await datumSetzen("#bib-bis", BIS);
    await warteAufTreffer([id.a1]);
    await page.keyboard.press("Escape");
    expect(await kopf()).toMatchObject({ menueOffen: false, fokus: "bib-menue-filter" });

    // 4 · Kontextzähler, Menü-Zähler, Listenfuß und Adresse.
    expect(await zaehlerLesen()).toEqual(ERWARTETE_ZAEHLER);
    expect(await kopf()).toMatchObject({
      bereich: "Bereich · 1",
      filter: "Filter · 2",
      fuss: "1 Eintrag",
    });
    const adresse = await suche();
    expect(adresse.getAll("category")).toEqual([NORD]);
    expect(adresse.getAll("tag")).toEqual([VENTIL]);
    expect(adresse.get("von")).toBe(VON);
    expect(adresse.get("bis")).toBe(BIS);

    // 5 · Die von der Anwendung geschriebene Adresse VOLLSTÄNDIG neu laden.
    const href = await page.evaluate<string>(fn("() => location.href"));
    await page.goto(href, { waitUntil: "load" });
    await warteAufTreffer([id.a1]);
    expect(await zaehlerLesen()).toEqual(ERWARTETE_ZAEHLER);
    expect(await kopf()).toMatchObject({
      bereich: "Bereich · 1",
      filter: "Filter · 2",
      fuss: "1 Eintrag",
    });
    expect((await suche()).toString()).toBe(adresse.toString());

    // 6 · 360 px: dieselbe Adresse, Menüs und Felder per Tab erreichen, Auswahl per Tastatur ändern.
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(href, { waitUntil: "load" });
    await warteAufTreffer([id.a1]);
    await page.evaluate<void>(
      fn(`() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }`),
    );
    await tabBis('[data-testid="bib-menue-bereich"]');
    await page.keyboard.press("Enter");
    // Das Menü ist ein Aufklapper neben dem Knopf — keine Vollbildlage, nichts ragt aus 360 px.
    const lage = await page.evaluate<{
      position: string;
      links: number;
      rechts: number;
      breite: number;
      listeDa: boolean;
    }>(
      fn(`() => {
      const m = document.querySelector('[data-testid="bib-menue-bereich"]').parentElement
        .querySelector('[role="menu"]');
      const r = m.getBoundingClientRect();
      return { position: getComputedStyle(m).position, links: r.left, rechts: r.right,
        breite: r.width, listeDa: !!document.querySelector('[data-testid="bib-spur"]') };
    }`),
    );
    expect(lage.position).toBe("absolute");
    expect(lage.breite).toBeLessThan(360);
    expect(lage.links).toBeGreaterThanOrEqual(0);
    expect(lage.rechts).toBeLessThanOrEqual(360);
    expect(lage.listeDa).toBe(true);
    // Bereich „Süd" per Tab erreichen und per Enter dazunehmen (ODER innerhalb der Dimension).
    await wertMarkieren("category", SUED);
    await tabBis('[data-bib-ziel="1"]', 40);
    await page.keyboard.press("Enter");
    await warteAufTreffer([id.a1, id.b1]);
    await page.keyboard.press("Escape");
    expect(await kopf()).toMatchObject({
      menueOffen: false,
      fokus: "bib-menue-bereich",
      bereich: "Bereich · 2",
      fuss: "2 Einträge",
    });
    // Filter-Menü → „Zuletzt geändert" → beide Datumsfelder, alles per Tab; Escape zurück.
    await tabBis('[data-testid="bib-menue-filter"]', 40);
    await page.keyboard.press("Enter");
    await untermenueMarkieren("Zuletzt geändert");
    await tabBis('[data-bib-summary="1"]', 60);
    await page.keyboard.press("Enter");
    await tabBis("#bib-von", 10);
    await tabBis("#bib-bis", 10);
    await page.keyboard.press("Escape");
    expect(await kopf()).toMatchObject({ menueOffen: false, fokus: "bib-menue-filter" });
    const schmal = await suche();
    expect([...schmal.getAll("category")].sort()).toEqual([NORD, SUED].sort());
    expect(schmal.getAll("tag")).toEqual([VENTIL]);
    expect(schmal.get("von")).toBe(VON);
    expect(schmal.get("bis")).toBe(BIS);
    console.info(`K21 Kombination: ${JSON.stringify({ adresse: adresse.toString(), lage })}`);
    expect(stand.seitenfehler).toEqual([]);
  }, 120_000);
});

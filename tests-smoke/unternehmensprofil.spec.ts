import { type Page, expect, test } from "@playwright/test";

import { SMOKE_PASS, ensureLoggedIn } from "./support/auth";
import { SVG_MIT_SKRIPT, pngLogo } from "./support/logo-bild";

// ================================================================================================
// ADMIN-15 · UNTERNEHMENSPROFIL UND INTERNE RICHTLINIEN IN DER ECHTEN APP.
// ================================================================================================
//
// produkt:20261009:admin-unternehmensprofil. Geklickt wird im echten Browser gegen den echten
// Smoke-Server; die Bilder hängen am nativen Bericht. Fiktives Unternehmen „Nordtal" mit einem im
// Test erzeugten Logo; jedes Konto ist ein Testkonto dieses Laufs.
//
//   K1 · Vorschau VOR dem Speichern (breit und 390 px), Name und Logo lesbar, nach Neuladen erhalten,
//        auf `/richtlinien` in 1280 × 800 und 390 × 844 ohne Überbreite.
//   K2 · Akzentfarbe per Tastatur mit sichtbarem Fokus; Kontrast der Vorschau ≥ 7:1 gemessen;
//        SVG und ein zu kleines Bild erklärt abgewiesen.
//   K3 · Zwei Fassungen mit Datum, Verantwortlichkeit, Geltung; die Wirkung steht vor dem
//        Veröffentlichen da und nennt die ERNEUT verlangte Zustimmung.
//   K4 · Anzeigen erzeugt keinen Eintrag; Kenntnisnahme (Fassung 1) und Zustimmung (Fassung 2)
//        stehen der Person und Fassung zugeordnet im Protokoll.
//   K5 · Rechtsseiten bleiben eigene Seiten; kein Löschweg in der Oberfläche.
//   K6 · Ein Konto ohne Verwaltungsrecht sieht einen Hinweis und wird am Server abgewiesen.
//
// GETEILTER BESTAND: alle Engines laufen nacheinander gegen DENSELBEN Server. Das Profil ist eine
// Fassungskette dieser Instanz — jede Engine legt die nächste Fassung an und liest vorher den Stand.
// Zählungen betroffener Konten werden deshalb nicht als feste Zahl erwartet.

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 6; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

async function bild(page: Page, name: string): Promise<void> {
  await test.info().attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

async function ohneUeberbreite(page: Page, wo: string): Promise<void> {
  const ueberbreit = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(ueberbreit, `${wo} ist breiter als das Fenster`).toBe(false);
}

/** WCAG-Kontrast zweier `rgb(...)`-Werte. */
function kontrast(a: string, b: string): number {
  const kanaele = (s: string): number[] => (s.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
  const leucht = (s: string): number => {
    const [r = 0, g = 0, bl = 0] = kanaele(s).map((c) => {
      const x = c / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hell, dunkel] = [leucht(a), leucht(b)].sort((x, y) => y - x);
  return ((hell ?? 0) + 0.05) / ((dunkel ?? 0) + 0.05);
}

/** Ist der Name im Kopf vollständig sichtbar, das Logo gezeichnet und alles im Fenster? */
async function kopfLesbar(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((kopf, id) => {
    const name = kopf.querySelector<HTMLElement>(`[data-testid="${id}-name"]`);
    const logo = kopf.querySelector<HTMLImageElement>(`[data-testid="${id}-logo"]`);
    const r = kopf.getBoundingClientRect();
    const stil = getComputedStyle(kopf);
    return {
      breite: r.width,
      imFenster: r.left >= -1 && r.right <= window.innerWidth + 1,
      nameGanz: name !== null && name.scrollWidth <= name.clientWidth + 1,
      nameText: name?.textContent ?? "",
      logoGezeichnet: Boolean(logo?.complete && logo.naturalWidth > 0),
      flaeche: stil.backgroundColor,
      schrift: stil.color,
    };
  }, testId);
}

async function fokusLage(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) {
      return null;
    }
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      testId: el.getAttribute("data-testid") ?? "",
      sichtbar: el.matches(":focus-visible"),
      ring: s.outlineStyle !== "none" || s.boxShadow !== "none",
      imFenster: r.left >= -1 && r.right <= window.innerWidth + 1 && r.width > 0,
    };
  });
}

async function tabBis(page: Page, tab: string, ziel: (id: string) => boolean, max = 40) {
  for (let i = 0; i < max; i += 1) {
    const id = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? "");
    if (ziel(id)) {
      return;
    }
    await page.keyboard.press(tab);
  }
  throw new Error("Ziel ist per Tastatur nicht erreichbar");
}

test.describe("ADMIN-15 · Unternehmensprofil und interne Richtlinien", () => {
  test("K1/K2: Vorschau vor dem Speichern, erklärte Abweisung, Tastatur, Neuladen, Desktop und 390 px", async ({
    page,
    browserName,
  }) => {
    const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
    await page.setViewportSize({ width: 1280, height: 800 });
    await ensureLoggedIn(page);
    const name = `Nordtal Werkzeugbau ${marke()}`;

    // Der Einstieg ist der Verweis in der Verwaltung, nicht eine getippte Adresse.
    await page.goto("/admin?bereich=system");
    await page.getByTestId("zeile-unternehmen").click();
    await expect(page).toHaveURL(/\/unternehmen$/);
    await expect(page.getByTestId("profil-name")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("profil-name").fill(name);

    // K2 · Eine SVG-Datei wird schon beim Auswählen erklärt abgewiesen.
    await page.getByTestId("profil-logo").setInputFiles({
      name: "nordtal.svg",
      mimeType: "image/svg+xml",
      buffer: SVG_MIT_SKRIPT,
    });
    await expect(page.getByTestId("profil-logo-fehler")).toContainText("SVG");
    await bild(page, "1-svg-abgewiesen");

    // K2 · Ein zu kleines PNG kommt bis zum Server und wird dort mit Grund abgewiesen.
    await page.getByTestId("profil-logo").setInputFiles({
      name: "nordtal-winzig.png",
      mimeType: "image/png",
      buffer: pngLogo(20, 20),
    });
    await page.getByTestId("profil-speichern").click();
    await expect(page.getByTestId("profil-fehler")).toContainText("zwischen 32 und 4000 Pixel", {
      timeout: 15_000,
    });
    await bild(page, "2-zu-kleines-logo-abgewiesen");

    // Das echte (fiktive) Logo.
    await page.getByTestId("profil-logo").setInputFiles({
      name: "nordtal.png",
      mimeType: "image/png",
      buffer: pngLogo(180, 54),
    });

    // K2 · Die Akzentfarbe per Tastatur: Tab in die Gruppe, Pfeiltaste zur nächsten Farbe.
    await page.getByTestId("profil-name").focus();
    await tabBis(page, tab, (id) => id.startsWith("profil-akzent-"));
    await page.getByTestId("profil-akzent-neutral").focus();
    await page.keyboard.press("ArrowDown");
    const fokus = await fokusLage(page);
    expect(fokus?.testId).toBe("profil-akzent-nachtblau");
    expect(fokus?.sichtbar, "kein :focus-visible an der Farbwahl").toBe(true);
    expect(fokus?.ring, "kein sichtbarer Fokusring an der Farbwahl").toBe(true);
    await expect(page.getByTestId("profil-akzent-nachtblau")).toBeChecked();
    await bild(page, "3-fokus-akzentfarbe");

    // K1 · Die Vorschau steht VOR dem Speichern — breit und in 390 px, Name ganz, Logo gezeichnet.
    await expect(page.getByTestId("profil-vorschau")).toContainText("Noch nicht gespeichert");
    for (const id of ["vorschau-desktop", "vorschau-mobil"]) {
      await expect(page.getByTestId(`${id}-name`)).toHaveText(name);
      await expect
        .poll(async () => (await kopfLesbar(page, id)).logoGezeichnet, { timeout: 10_000 })
        .toBe(true);
      const lage = await kopfLesbar(page, id);
      expect(lage.nameGanz, `${id}: Name abgeschnitten`).toBe(true);
      expect(lage.imFenster, `${id}: ausserhalb des Fensters`).toBe(true);
      expect(kontrast(lage.flaeche, lage.schrift), `${id}: Kontrast`).toBeGreaterThanOrEqual(7);
    }
    expect((await kopfLesbar(page, "vorschau-mobil")).breite).toBeLessThanOrEqual(390);
    const vorSpeichern = (await (await page.request.get("/api/unternehmensprofil")).json()) as {
      profil: { name: string } | null;
    };
    expect(vorSpeichern.profil?.name, "die Vorschau hat schon gespeichert").not.toBe(name);
    await bild(page, "4-vorschau-vor-dem-speichern");

    await page.getByTestId("profil-speichern").click();
    await expect(page.getByTestId("profil-gespeichert")).toBeVisible({ timeout: 15_000 });

    // K1 · Neuladen: das Formular trägt den gespeicherten Stand, die Fassung steht im Verlauf.
    await page.reload();
    await expect(page.getByTestId("profil-name")).toHaveValue(name, { timeout: 15_000 });
    await expect(page.getByTestId("profil-akzent-nachtblau")).toBeChecked();
    await expect(page.getByTestId("profil-vorschau")).not.toContainText("Noch nicht gespeichert");

    // Die betroffene Oberfläche: der Kopf der Richtlinienseite, Desktop …
    await page.goto("/richtlinien");
    await expect(page.getByTestId("unternehmen-kopf-name")).toHaveText(name, { timeout: 15_000 });
    await expect
      .poll(async () => (await kopfLesbar(page, "unternehmen-kopf")).logoGezeichnet)
      .toBe(true);
    expect((await kopfLesbar(page, "unternehmen-kopf")).nameGanz).toBe(true);
    await ohneUeberbreite(page, "/richtlinien (1280)");
    await bild(page, "5-richtlinien-kopf-1280");

    // … und 390 × 844.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByTestId("unternehmen-kopf-name")).toHaveText(name, { timeout: 15_000 });
    await expect
      .poll(async () => (await kopfLesbar(page, "unternehmen-kopf")).logoGezeichnet)
      .toBe(true);
    const mobil = await kopfLesbar(page, "unternehmen-kopf");
    expect(mobil.nameGanz, "Name im 390-px-Kopf abgeschnitten").toBe(true);
    expect(mobil.imFenster).toBe(true);
    await ohneUeberbreite(page, "/richtlinien (390)");
    await bild(page, "6-richtlinien-kopf-390");

    // Rückweg aus der Verwaltungsfläche.
    await page.goto("/unternehmen");
    await page.getByTestId("unternehmen-zurueck").click();
    await expect(page).toHaveURL(/\/admin\?bereich=system$/);
  });

  test("K3–K6: zwei Fassungen, Kenntnisnahme und Zustimmung, Protokoll, unberechtigte Rolle", async ({
    page,
    browser,
    browserName,
  }) => {
    const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
    await page.setViewportSize({ width: 1280, height: 800 });
    await ensureLoggedIn(page);
    const m = marke();
    const titel = `Hausordnung Nordtal ${m}`;
    const erikaName = `Erika ${m}`;
    const erikaMail = `erika-${m}@nordtal.test`;
    const angelegt = await page.request.post("/api/users", {
      data: { name: erikaName, email: erikaMail, password: SMOKE_PASS, role: "experte" },
    });
    expect(angelegt.status(), await angelegt.text()).toBe(201);

    // K3 · Fassung 1: die Wirkung steht da, bevor veröffentlicht werden kann.
    await page.goto("/unternehmen");
    await page.getByTestId("richtlinie-neu").click();
    await page.getByTestId("richtlinie-titel").fill(titel);
    await page
      .getByTestId("richtlinie-text")
      .fill("Besucher melden sich am Empfang an.\nTüren zum Lager bleiben geschlossen.");
    await page.getByTestId("richtlinie-verantwortlich").fill("Personalabteilung Nordtal");
    await expect(page.getByTestId("richtlinie-veroeffentlichen")).toBeDisabled();
    await page.getByTestId("richtlinie-wirkung-pruefen").click();
    await expect(page.getByTestId("richtlinie-wirkung")).toContainText("zur Kenntnis nehmen");
    await bild(page, "1-wirkung-fassung-1");
    await page.getByTestId("richtlinie-veroeffentlichen").click();
    const eintrag = page.getByTestId("verwaltung-richtlinie").filter({ hasText: titel });
    await expect(eintrag.getByTestId("verwaltung-richtlinie-meta")).toContainText("Fassung 1", {
      timeout: 15_000,
    });
    await expect(eintrag.getByTestId("verwaltung-richtlinie-meta")).toContainText(
      "verantwortlich: Personalabteilung Nordtal",
    );
    const id = (await eintrag.getAttribute("data-richtlinie")) ?? "";
    expect(id).not.toBe("");

    // Erika in einem eigenen Browserkontext — ihre Sitzung, nicht die der Verwaltung.
    const ctx = await browser.newContext({
      baseURL: new URL(page.url()).origin,
      serviceWorkers: "block",
      viewport: { width: 1280, height: 800 },
    });
    try {
      const anmeldung = await ctx.request.post("/api/auth/login", {
        data: { email: erikaMail, password: SMOKE_PASS },
      });
      expect(anmeldung.status()).toBe(200);
      const ep = await ctx.newPage();
      await ep.goto("/start");
      // Der Weg für Beschäftigte: das Konto-Menü.
      await ep.getByTestId("kopfband-konto").click();
      await ep.getByTestId("konto-richtlinien").click();
      await expect(ep).toHaveURL(/\/richtlinien$/);
      const karte = ep.getByTestId("richtlinie").filter({ hasText: titel });
      await expect(karte.getByTestId("richtlinie-handeln")).toHaveText(
        "Fassung 1 zur Kenntnis nehmen",
        { timeout: 15_000 },
      );
      // K5 · Die Rechtsseiten sind nur verlinkt.
      await expect(ep.getByTestId("richtlinien-rechtliches").locator("a")).toHaveCount(2);
      // K4 · Angezeigt — und nichts protokolliert.
      const leer = await page.request.get(`/api/admin/richtlinien/${id}/protokoll`);
      expect(((await leer.json()) as { eintraege: unknown[] }).eintraege).toEqual([]);
      await bild(ep, "2-beschaeftigte-vor-kenntnisnahme");
      await karte.getByTestId("richtlinie-handeln").click();
      await expect(karte.getByTestId("richtlinie-status")).toContainText(
        "Fassung 1 zur Kenntnis genommen am",
      );

      // K3 · Fassung 2 verlangt Zustimmung — die Wirkung sagt vorab: ERNEUT.
      await page.reload();
      await eintrag.getByTestId("richtlinie-neue-fassung").click();
      await page
        .getByTestId("richtlinie-text")
        .fill(
          "Besucher melden sich am Empfang an.\nTüren zum Lager bleiben geschlossen.\nFotografieren in der Fertigung nur mit Freigabe.",
        );
      await page.getByTestId("richtlinie-anforderung-zustimmung").check();
      await page.getByTestId("richtlinie-grund").fill("Fotoregel ergänzt");
      await page.getByTestId("richtlinie-wirkung-pruefen").click();
      const wirkung = page.getByTestId("richtlinie-wirkung");
      await expect(wirkung).toContainText("Erneut verlangt");
      await expect(wirkung).toContainText("Fassung 2 zustimmen");
      await expect(wirkung).toContainText("1 Handlungen zu Fassung 1");
      await bild(page, "3-wirkung-fassung-2");
      await page.getByTestId("richtlinie-veroeffentlichen").click();
      await expect(eintrag.getByTestId("verwaltung-richtlinie-meta")).toContainText("Fassung 2", {
        timeout: 15_000,
      });

      // Erika auf 390 × 844: die alte Kenntnisnahme zählt nicht; Zustimmung per Tastatur.
      await ep.setViewportSize({ width: 390, height: 844 });
      await ep.reload();
      await expect(karte.getByTestId("richtlinie-handeln")).toHaveText("Fassung 2 zustimmen", {
        timeout: 15_000,
      });
      await ohneUeberbreite(ep, "/richtlinien (390, Beschäftigte)");
      await ep.locator("body").focus();
      await tabBis(ep, tab, (testId) => testId === "richtlinie-handeln", 80);
      const fokus = await fokusLage(ep);
      expect(fokus?.sichtbar, "kein :focus-visible am Zustimmungsknopf").toBe(true);
      expect(fokus?.ring, "kein sichtbarer Fokusring am Zustimmungsknopf").toBe(true);
      expect(fokus?.imFenster).toBe(true);
      await bild(ep, "4-zustimmung-390-fokus");
      await ep.keyboard.press("Enter");
      await expect(karte.getByTestId("richtlinie-status")).toContainText(
        "Fassung 2 zugestimmt am",
        { timeout: 15_000 },
      );

      // K4 · Das Protokoll ordnet beide Handlungen Erika und ihrer Fassung zu.
      await page.reload();
      await eintrag.getByTestId("richtlinie-protokoll-knopf").click();
      const zeilen = eintrag.getByTestId("protokoll-eintrag");
      await expect(zeilen).toHaveCount(2, { timeout: 15_000 });
      await expect(zeilen.nth(0)).toHaveAttribute("data-fassung", "1");
      await expect(zeilen.nth(0)).toHaveAttribute("data-handlung", "kenntnisnahme");
      await expect(zeilen.nth(1)).toHaveAttribute("data-fassung", "2");
      await expect(zeilen.nth(1)).toHaveAttribute("data-handlung", "zustimmung");
      await expect(zeilen.nth(0)).toContainText(erikaName);
      await expect(zeilen.nth(1)).toContainText(erikaName);
      // K5 · Kein Löschknopf in der Verwaltung der Richtlinie.
      await expect(eintrag.getByRole("button", { name: /lösch|entfern/i })).toHaveCount(0);
      await bild(page, "5-protokoll");

      // K6 · Erika hat kein Verwaltungsrecht: Hinweis in der Fläche, Abweisung am Server.
      await ep.setViewportSize({ width: 1280, height: 800 });
      await ep.goto("/unternehmen");
      await expect(ep.getByTestId("unternehmen-ohne-recht")).toBeVisible({ timeout: 15_000 });
      await expect(ep.getByTestId("unternehmen-profil")).toHaveCount(0);
      const verboten = await ctx.request.put("/api/admin/unternehmensprofil", {
        data: { version: 0, name: "Übernahme", logo: null, akzent: "neutral" },
      });
      expect(verboten.status()).toBe(403);
      expect(((await verboten.json()) as { error: string }).error).toBe("FORBIDDEN");
      const keinProtokoll = await ctx.request.get(`/api/admin/richtlinien/${id}/protokoll`);
      expect(keinProtokoll.status()).toBe(403);
      await bild(ep, "6-unberechtigte-rolle");
    } finally {
      await ctx.close();
    }
  });
});

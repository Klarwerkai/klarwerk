// ================================================================================================
// AUFNAHME 20260922 · GESAMT-DEMO-ERKLAERMODUS — DER VORFÜHRWEG IM ECHTEN BROWSER.
// ================================================================================================
//
// Was jsdom nicht kann (`tests/vorfuehrweg/vorfuehrweg-dom.test.tsx`), misst diese Sonde am
// laufenden Kandidaten, in allen drei Engines:
//   · Jeder Stationslink öffnet KLARWERK im benannten Vorführfenster — beim ersten Klick als neues
//     Fenster, danach in DASSELBE. Der Vorführweg selbst bleibt stehen und schickt keine Anfrage:
//     so ist er auf dem zweiten Bildschirm nutzbar.
//   · Jede Station landet an ihrer Stelle: Route und Seitenanker bzw. Karte, dazu das vorbefüllte
//     Such- oder Fragefeld.
//   · Der Einstieg aus der Hilfe öffnet den Vorführweg; die Sprachwahl zeigt dann nur Englisch, und
//     der englische Link trägt den englischen Suchbegriff. Bei 390 px und 1280 px kein Überlauf.
//
// Die angehängten Bilder (Chromium) zeigen jede Station so, wie die GEBAUTE Fassung sie rendert.
// Im hermetischen Tor sind keine Demodaten geladen: die Bilder belegen die Stellen, nicht die
// Beispielinhalte der Vorführung.
import { type Locator, type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const VORFUEHRWEG = "/demonstration/vorfuehrweg.html";
const FENSTER = "klarwerk-vorfuehrung";
const FEHLERKARTE = /konnte nicht geladen werden/i;

interface Station {
  kennung: string;
  pfad: string;
  landung: (fenster: Page) => Locator;
  /** Der Wert, den das Such- bzw. Fragefeld nach dem Öffnen trägt (deutscher Link). */
  wert?: string;
}

const STATIONEN: readonly Station[] = [
  {
    kennung: "demodaten",
    pfad: "/admin",
    landung: (f) => f.getByTestId("detail-demodaten"),
  },
  {
    kennung: "start",
    pfad: "/start",
    landung: (f) => f.getByTestId("page-start"),
  },
  {
    kennung: "bibliothek",
    pfad: "/bibliothek",
    landung: (f) => f.getByTestId("bib-suche"),
    wert: "Lieferanten",
  },
  {
    kennung: "fragen",
    pfad: "/fragen",
    landung: (f) =>
      f.getByTestId("page-fragen").locator('input[data-tutorial-ziel="fragen.fragefeld"]'),
    wert: "Wie oft muss Filter F3 geprüft werden?",
  },
  {
    kennung: "erfassen",
    pfad: "/erfassen",
    landung: (f) => f.getByTestId("blatt-titel"),
  },
  {
    kennung: "validierung",
    pfad: "/validierung",
    landung: (f) => f.getByTestId("page-validierung"),
  },
  {
    kennung: "konflikte",
    pfad: "/konflikte",
    landung: (f) => f.getByTestId("page-konflikte"),
  },
  {
    kennung: "importwege",
    pfad: "/demonstration/importwege.html",
    landung: (f) => f.locator("h1 .de"),
  },
];

test("Vorführweg · jede Station öffnet ihre Stelle", async ({ page, context, browserName }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await ensureLoggedIn(page);
  await page.goto(VORFUEHRWEG);
  await expect(page.locator("h1 .de")).toHaveText("KLARWERK in fünf Minuten vorführen");
  const adresse = page.url();
  // Gezählt wird, was „lädt, speichert und sendet nichts“ meint: jeder Abruf der Programmierschnitt-
  // stelle und jede verändernde Anfrage. Ein Symbolabruf des Browsers selbst ist keine Handlung.
  const anfragen: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET" || new URL(r.url()).pathname.startsWith("/api/")) {
      anfragen.push(`${r.method()} ${r.url()}`);
    }
  });

  let fenster: Page | null = null;
  for (const station of STATIONEN) {
    const link = page.locator(`section[data-station="${station.kennung}"] a.oeffnen.de`);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("target", FENSTER);
    if (fenster === null) {
      const neu = context.waitForEvent("page");
      await link.click();
      fenster = await neu;
    } else {
      await link.click();
    }
    const ziel = fenster;
    const meldung = `${station.kennung}: falsche Route`;
    await expect.poll(() => new URL(ziel.url()).pathname, { message: meldung }).toBe(station.pfad);
    const stelle = station.landung(ziel);
    await expect(stelle, `${station.kennung}: Stelle nicht erreicht`).toBeVisible({
      timeout: 15_000,
    });
    if (station.wert !== undefined) {
      await expect(stelle).toHaveValue(station.wert);
    }
    await expect(ziel.getByRole("heading", { name: FEHLERKARTE })).toHaveCount(0);
    // Zweiter Bildschirm: genau EIN Vorführfenster, und der Vorführweg steht unverändert da.
    expect(context.pages(), "jede Station gehört in DASSELBE Vorführfenster").toHaveLength(2);
    expect(page.url()).toBe(adresse);
    if (browserName === "chromium") {
      await test.info().attach(`Vorführweg ${station.kennung} — gebaute Fassung`, {
        body: await ziel.screenshot(),
        contentType: "image/png",
      });
    }
  }
  expect(anfragen, "der Vorführweg selbst lädt, speichert und sendet nichts").toEqual([]);
});

test("Vorführweg · Einstieg aus der Hilfe, Englisch und 390 px", async ({ page, context }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await ensureLoggedIn(page);
  await page.goto("/hilfe");
  const einstieg = page.getByTestId("hilfe-vorfuehrweg-link");
  await expect(einstieg).toBeVisible({ timeout: 15_000 });
  const neuerWeg = context.waitForEvent("page");
  await einstieg.click();
  const weg = await neuerWeg;
  await expect.poll(() => new URL(weg.url()).pathname).toBe(VORFUEHRWEG);
  await expect(weg.locator("h1 .de")).toBeVisible();

  // Englisch: nur Englisch sichtbar, und der englische Link trägt den englischen Suchbegriff.
  await weg.locator('label[for="language-en"]').click();
  await expect(weg.locator("h1 .en")).toHaveText("Present KLARWERK in five minutes");
  await expect(weg.locator("h1 .de")).toBeHidden();
  await expect(weg.locator('[data-station="bibliothek"] a.oeffnen.de')).toBeHidden();
  const link = weg.locator('[data-station="bibliothek"] a.oeffnen.en');
  await expect(link).toBeVisible();
  const neuesFenster = context.waitForEvent("page");
  await link.click();
  const fenster = await neuesFenster;
  await expect(fenster.getByTestId("bib-suche")).toHaveValue("Suppliers", { timeout: 15_000 });

  // Schmal (zweiter Bildschirm hochkant) und breit: die Seite läuft nicht waagerecht über.
  for (const breite of [390, 1280]) {
    await weg.setViewportSize({ width: breite, height: 844 });
    const mass = await weg.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      innen: window.innerWidth,
    }));
    expect(mass.scroll, `${breite} px: waagerechter Überlauf`).toBeLessThanOrEqual(mass.innen + 1);
  }
});

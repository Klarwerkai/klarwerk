import { resolve } from "node:path";
import { chromium } from "playwright";
import { expect, it } from "vitest";
import { registerWebStatic } from "../../services/app/src/web-static";
import { vortragsWelt } from "./pp08-welt";

// Nur durch tools/browserdeckel.sh, ein Browser, ein Worker. Tatsächliche gebaute App,
// echter Socket und normale fiktive Anmeldung. Keine PowerPoint-/Audio-Hostabnahme.
it("PP08 · Browser: Tastaturöffnung, Beleg, explizite Probe und gespeicherte persönliche Nachbereitung", async () => {
  const w = await vortragsWelt((app) => registerWebStatic(app, resolve("apps/web/dist")));
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    const basis = await w.app.listen({ host: "127.0.0.1", port: 0 });
    browser = await chromium.launch({ headless: true });
    process.stderr.write(
      `${JSON.stringify({
        event: "PP08_BROWSER_BEGIN",
        at: new Date().toISOString(),
        basis,
        browser: await browser.version(),
        serverListening: w.app.server.listening,
      })}\n`,
    );
    const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
    const vortragAnfragen: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/vortrag")) vortragAnfragen.push(r.method());
    });
    await page.goto(`${basis}/login`);
    await page.locator('input[type="email"]').fill("q@vortrag.test");
    await page.locator('input[type="password"]').fill("fiktiv-pp08-1");
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    await page.waitForURL((u) => u.pathname !== "/login");
    await page.goto(`${basis}/wissen/${w.koId}`);
    await page.getByRole("button", { name: "Im Artikel öffnen", exact: true }).click();
    const bereich = page.locator("[data-vortrag]");
    await bereich.locator("summary").first().focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => bereich.evaluate((e) => (e as HTMLDetailsElement).open)).toBe(true);
    expect(vortragAnfragen).toEqual([]);
    await bereich.getByLabel("Sprechernotiz", { exact: true }).fill("Die Entwicklung erläutern.");
    await bereich
      .getByLabel("Übergang zur nächsten Folie", { exact: true })
      .fill("Danach folgt der Ausblick.");
    await bereich.getByLabel("Geplante Dauer in Sekunden", { exact: true }).fill("60");
    await bereich.getByRole("checkbox", { name: "1.500 T€ · Fassung 1" }).check();
    await bereich.getByLabel("Rückfrage", { exact: true }).fill("Woher stammen 1.500?");
    await bereich.getByRole("button", { name: "Passenden Beleg suchen" }).click();
    await bereich.getByRole("button", { name: "Herkunft öffnen: 1.500 T€" }).click();
    await page.locator("[data-herkunft]").waitFor({ state: "visible" });
    const herkunft = page.locator("[data-herkunft]");
    expect(await herkunft.innerText()).toContain("Q4 2025");
    expect(await herkunft.innerText()).toContain("Tabelle Kennzahlen");
    await page.keyboard.press("Escape");
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.textContent))
      .toContain("Herkunft öffnen");
    await bereich
      .getByLabel("Probetext für die gewählte Folie", { exact: true })
      .fill("Wir erläutern 1.500 und die offene Frage 9999.");
    expect(vortragAnfragen).toHaveLength(1);
    await bereich.getByRole("button", { name: "Text-Probevortrag ausdrücklich starten" }).click();
    await bereich.getByText(/keine gemessene Redezeit/).waitFor();
    await bereich.getByText("Zahlenangabe belegen", { exact: true }).waitFor();
    await bereich.getByLabel("Aussage auswählen", { exact: true }).selectOption(w.dp.id);
    await bereich
      .getByLabel("Bereitgestellte Rückfrage oder Notiz", { exact: true })
      .fill("Bitte regionale Ursache ergänzen.");
    await bereich
      .getByLabel("Herkunft, etwa eigene Notiz mit Datum", { exact: true })
      .fill("Eigene Notiz 20.10.2026, Punkt 3");
    await bereich.getByLabel("Benötigte Arbeit", { exact: true }).selectOption("erklaerung");
    await bereich.getByRole("button", { name: "Notiz der Aussage zuordnen" }).click();
    await bereich
      .getByRole("button", { name: "Nachbereitung prüfen und Aufgaben vorschlagen" })
      .click();
    expect((await w.ruf("GET", "/api/me/klara/aufgaben")).body.aufgaben).toHaveLength(0);
    await bereich
      .getByRole("button", { name: "Als eigene Notiz und persönliche Aufgabe speichern" })
      .click();
    await bereich.getByRole("button", { name: "Persönliche Aufgabe gespeichert" }).waitFor();
    const gespeichert = (await w.ruf("GET", "/api/me/klara/aufgaben")).body.aufgaben;
    expect(gespeichert).toHaveLength(1);
    expect(gespeichert[0]).toMatchObject({ titel: "Erklärung ergänzen", bereich: "persoenlich" });
    expect(gespeichert[0].inhalt).toContain("Bitte regionale Ursache ergänzen.");
    expect(gespeichert[0].inhalt).toContain(`Aussage ${w.dp.id}, Fassung 1`);
    expect(gespeichert[0].inhalt).not.toContain("1.500 T€");
    await bereich.locator("summary").first().click();
    await bereich.locator("summary").first().click();
    expect(await bereich.getByLabel("Sprechernotiz", { exact: true }).inputValue()).toBe(
      "Die Entwicklung erläutern.",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    if (process.env.KLARWERK_PP08_BELEGE) {
      await page.screenshot({
        path: `${process.env.KLARWERK_PP08_BELEGE}/pp08-schmal.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 1280, height: 950 });
      await page.screenshot({
        path: `${process.env.KLARWERK_PP08_BELEGE}/pp08-breit.png`,
        fullPage: true,
      });
    }
    // Neuabruf im echten Browser belegt die vorhandene Speicherstrecke für die Aufgabe.
    await page.reload();
    expect(
      (await w.ruf("GET", `/api/me/klara/aufgaben/${gespeichert[0].id}`)).body.aufgabe.inhalt,
    ).toContain("Eigene Notiz 20.10.2026, Punkt 3");
  } finally {
    await browser?.close();
    await w.app.close();
    process.stderr.write(
      `${JSON.stringify({
        event: "PP08_BROWSER_END",
        at: new Date().toISOString(),
        browserDisconnected: !browser?.isConnected(),
        serverListening: w.app.server.listening,
      })}\n`,
    );
  }
}, 60000);

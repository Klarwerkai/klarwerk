// Genau ein neuer PP07-H04-Fall. Frische Ressourcenzuteilung und unveränderter Browserdeckel nötig.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect as pwExpect } from "@playwright/test";
import JSZip from "jszip";
import { type Browser, chromium } from "playwright";
import { expect, it } from "vitest";
import { leseFolienDaten } from "../../services/app/src/praesentation-daten";
import { registerWebStatic } from "../../services/app/src/web-static";
import { dateiwelt } from "./pp07-dateiwelt";

it("PP07 · H04 bewusst aktualisieren, Herkunft, zwei echte Dateien und Rücknahme; Tastatur,320/1440px", async () => {
  const out = process.env.PP07_BELEGE ?? join(process.cwd(), ".local/run/pp07-browser");
  await mkdir(out, { recursive: true });
  const begin = new Date().toISOString();
  const w = await dateiwelt(async (app) =>
    registerWebStatic(app, join(process.cwd(), "apps/web/dist")),
  );
  let browser: Browser | undefined;
  let origin = "";
  let fehler: unknown;
  let browserGestartet = false;
  let browserGeschlossen = false;
  let appGeschlossen = false;
  try {
    const vorher = await w.datei();
    origin = await w.app.listen({ host: "127.0.0.1", port: 0 });
    browser = await chromium.launch({ headless: true });
    browserGestartet = true;
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
      locale: "de-DE",
      reducedMotion: "reduce",
      acceptDownloads: true,
    });
    await context.addCookies([
      { name: "kw_session", value: w.admin.authorization.replace(/^Bearer /, ""), url: origin },
    ]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem("kw.lang", "de"));
    await page.goto(`${origin}/wissen/${w.ziel.id}`);
    await page.getByTestId("bib-titel").waitFor();
    const setup = page.getByRole("region", { name: "Wie soll deine Assistenz heißen?" });
    if (await setup.isVisible()) await setup.getByRole("button", { name: "Später" }).click();
    await page.getByTestId("bib-mehr").click();
    await page.locator('[data-bib-abschnitt="anhaenge"] > summary').click();
    await page.locator(`[data-office-oeffnen="${w.anhangId}"]`).click();
    const flaeche = page.locator(`[data-folien-daten="${w.anhangId}"]`);
    await flaeche.getByRole("button", { name: "Änderungen vorschauen", exact: true }).focus();
    await page.keyboard.press("Enter");
    const preview = flaeche.getByRole("region", { name: "Änderungen vorschauen", exact: true });
    await preview.getByLabel("Zahl oder Aussage", { exact: true }).selectOption(w.b.id);
    await preview.getByLabel("Vorgeschlagener Wert", { exact: true }).fill("700 T€");
    await preview
      .getByLabel("Grund der Änderung", { exact: true })
      .fill("Kontrollierte fiktive Änderung im echten PP07-Bedienweg.");
    await preview.getByRole("button", { name: "Wirkung ansehen", exact: true }).focus();
    await page.keyboard.press("Enter");
    await pwExpect(preview.locator("output").first()).toContainText("2 Datenfassungen betroffen");
    expect((await w.datei()).satz.fassung).toBe(vorher.satz.fassung);
    await preview.getByRole("button", { name: "Übernahme vorbereiten", exact: true }).focus();
    await page.keyboard.press("Enter");
    const dateiPreview = preview.getByRole("region", {
      name: "Datei und gebundene Daten aktualisieren",
      exact: true,
    });
    await pwExpect(dateiPreview).toContainText("Dateivorschau:");
    await dateiPreview.locator("summary").focus();
    await page.keyboard.press("Enter");
    await pwExpect(dateiPreview).toContainText("600 T€ → 700 T€");
    await page.screenshot({ path: join(out, "01-dateivorschau-breit.png") });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await pwExpect(dateiPreview).toBeVisible();
    await pwExpect(preview.getByLabel("Vorgeschlagener Wert", { exact: true })).toHaveValue(
      "700 T€",
    );
    await dateiPreview.scrollIntoViewIfNeeded();
    const b = await dateiPreview.boundingBox();
    expect(b).toBeTruthy();
    expect(b!.x).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width).toBeLessThanOrEqual(321);
    await page.screenshot({ path: join(out, "02-dateivorschau-schmal-dunkelpraeferenz.png") });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await dateiPreview
      .getByRole("button", { name: "Diese Vorschau übernehmen", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await pwExpect(flaeche.locator(":scope > output").first()).toContainText(
      "Datei und gebundene Daten als Fassung",
    );
    const zahl = flaeche.locator(`button[data-datenpunkt="${w.b.id}"]`).first();
    await pwExpect(zahl).toContainText("700 T€");
    await zahl.focus();
    await page.keyboard.press("Enter");
    await pwExpect(flaeche.locator("[data-herkunft]")).toContainText(
      "Kontrollierte fiktive Änderung im echten PP07-Bedienweg",
    );
    await flaeche.getByRole("button", { name: "Fassungen und Rücknahme", exact: true }).focus();
    await page.keyboard.press("Enter");
    const fassungen = flaeche.getByRole("region", { name: "Fassungen und Rücknahme", exact: true });
    await pwExpect(fassungen).toContainText("700 T€ → 600 T€");
    await fassungen
      .getByRole("button", { name: "Kurze und ausführliche Dateien speichern", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    const links = fassungen.locator("a[download]");
    await pwExpect(links).toHaveCount(2);
    const downloads: { name: string; basis: string; datenbasis: unknown; sichtbar: number }[] = [];
    for (let i = 0; i < 2; i++) {
      const download = page.waitForEvent("download");
      await links.nth(i).focus();
      await page.keyboard.press("Enter");
      const f = await download;
      const pfad = join(out, f.suggestedFilename());
      await f.saveAs(pfad);
      const bytes = await readFile(pfad);
      const zip = await JSZip.loadAsync(bytes);
      const m = JSON.parse(await zip.file("ppt/klara/pp07-variante.json")!.async("string"));
      downloads.push({
        name: f.suggestedFilename(),
        basis: m.basis,
        datenbasis: m.datenbasis,
        sichtbar: (await leseFolienDaten(bytes)).folien.filter((f) => !f.ausgeblendet).length,
      });
    }
    expect(downloads[0]!.basis).toBe(downloads[1]!.basis);
    expect(downloads[0]!.datenbasis).toEqual(downloads[1]!.datenbasis);
    expect(downloads[0]!.sichtbar).toBeLessThan(downloads[1]!.sichtbar);
    await page.screenshot({ path: join(out, "03-gespeichert-herkunft-dateien.png") });
    await fassungen
      .getByRole("button", { name: "Datei und gebundene Daten zurücknehmen", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await pwExpect(flaeche.locator(":scope > output").first()).toContainText(
      "Rücknahme als Fassung",
    );
    await pwExpect(flaeche.locator(`button[data-datenpunkt="${w.b.id}"]`).first()).toContainText(
      "600 T€",
    );
    expect((await w.datei()).ko.version).toBe(vorher.ko.version + 2);
    expect(errors).toEqual([]);
    await page.screenshot({ path: join(out, "04-ruecknahme.png") });
    await writeFile(
      join(out, "ERGEBNIS.json"),
      JSON.stringify(
        {
          fall: "PP07-H04",
          status: "bestanden",
          begin,
          origin,
          breiten: [320, 1440],
          downloads,
          pageerrors: errors,
          nativePowerPoint: false,
          powerPointWeb: false,
          screenreader: false,
        },
        null,
        2,
      ),
    );
  } catch (e) {
    fehler = e;
    throw e;
  } finally {
    try {
      await browser?.close();
      browserGeschlossen = !!browser;
    } finally {
      await w.app.close();
      appGeschlossen = true;
    }
    await writeFile(
      join(out, "RESSOURCEN-ENDE.json"),
      JSON.stringify(
        {
          begin,
          end: new Date().toISOString(),
          origin,
          browserGestartet,
          browserGeschlossen,
          appGeschlossen,
          fallBestanden: !fehler,
          fehler: fehler instanceof Error ? fehler.message : fehler ? String(fehler) : null,
          pg: false,
          native: false,
          office: false,
          modell: false,
        },
        null,
        2,
      ),
    );
  }
}, 60_000);

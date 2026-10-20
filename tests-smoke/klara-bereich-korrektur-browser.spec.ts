// OCR-E06 auf der gelieferten E02-Ablage: echte Erkennung, echter Speicher, Neuladen.
import { expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";
import { zeichneBild } from "./support/ocr-fundstellen-probe";

test("OCR-E06 · gespeicherte Berichtigung gilt nach Neuladen auch im ausgewählten Bereich", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await ensureLoggedIn(page);
  await page.goto("/erfassen?weg=datei");
  const bild = await zeichneBild(page, 1400, 800, [
    { text: "RECHNUNG 2026", x: 80, y: 160 },
    { text: "SUMME 1800", x: 80, y: 430 },
    { text: "LAGER 29", x: 80, y: 700 },
  ]);
  const datei = { name: "bereich-speicher-e06.png", mimeType: "image/png", buffer: bild.png };
  const wurzel = page.getByTestId("datei-bild-befunde");
  const importiere = async (neuOeffnen = false) => {
    if (neuOeffnen) {
      const profil = page.waitForResponse(
        (r) => new URL(r.url()).pathname === "/api/me/assistenz" && r.request().method() === "GET",
      );
      await page.goto("/erfassen?weg=datei");
      expect((await profil).ok()).toBe(true);
    }
    await expect(page.getByTestId("capture-file-pick")).toBeVisible();
    await page
      .locator('input[type="file"][accept*=".pptx"][accept*="image/*"]')
      .first()
      .setInputFiles(datei);
    await expect(wurzel.getByTestId("bild-befund").first()).toHaveAttribute(
      "data-status",
      "gelesen",
      { timeout: 120_000 },
    );
  };
  await importiere();
  // Ein abgebrochener Vorgängerlauf darf denselben fiktiven Datensatz hinterlassen haben.
  const ruecksetzen = wurzel.getByTestId("bild-berichtigung-zuruecksetzen").first();
  if (await ruecksetzen.isVisible()) {
    await ruecksetzen.click();
    await expect(wurzel.getByTestId("bild-berichtigung").first()).toHaveAttribute(
      "data-berichtigt",
      "false",
    );
  }
  const roh = (await wurzel.getByTestId("bild-befund-text").first().textContent()) ?? "";
  expect(roh.replace(/\[\?([^\]]+)\]/g, "$1")).toContain("SUMME 1800");
  await wurzel.getByTestId("bild-berichtigung-bearbeiten").first().click();
  const korrigiert = roh.replace("1800", "1500");
  await wurzel.getByTestId("bild-berichtigung-feld").first().fill(korrigiert);
  const gespeichert = page.waitForResponse(
    (r) => r.url().includes("/assistenz/bildkorrekturen") && r.request().method() === "PUT",
  );
  await wurzel.getByTestId("bild-berichtigung-speichern").first().click();
  expect((await gespeichert).ok()).toBe(true);
  await page.reload();
  await importiere(true);
  await expect(wurzel.getByTestId("bild-befund-text").first()).toContainText("1500");
  const panel = wurzel.getByTestId("klara-bereich");
  await panel.getByTestId("klara-bereich-bild").first().click();
  const vorschau = panel.getByTestId("klara-bereich-vorschau").locator("img");
  await expect
    .poll(() => vorschau.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBe(1400);
  const box = await vorschau.boundingBox();
  if (!box) throw new Error("Bildvorschau fehlt");
  await page.mouse.move(box.x + 2, box.y + box.height * 0.37);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height * 0.58, { steps: 5 });
  await page.mouse.up();
  await panel.getByTestId("klara-bereich-was-steht-hier").click();
  await expect(panel.getByTestId("klara-bereich-text")).toHaveText("SUMME 1500");
  await expect(panel.getByTestId("klara-bereich-herkunft")).toContainText("vorhandenen");
  await test.info().attach("e06-gespeicherter-bereich.png", {
    body: await panel.screenshot(),
    contentType: "image/png",
  });
  await wurzel.getByTestId("bild-berichtigung-zuruecksetzen").first().click();
  await expect(panel.getByTestId("klara-bereich-ergebnis")).toHaveCount(0);
  await panel.getByTestId("klara-bereich-was-steht-hier").click();
  await expect(panel.getByTestId("klara-bereich-text")).toHaveText("SUMME 1800");
  // Die Originalbytes werden weder durch die Erkennung noch durch die Berichtigung geschrieben.
  expect(await vorschau.getAttribute("src")).toContain(bild.png.toString("base64"));
});

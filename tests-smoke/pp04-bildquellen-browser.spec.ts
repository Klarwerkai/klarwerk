import { expect, test } from "@playwright/test";
import { PPTX, deck } from "../tests/klara-powerpoint/pp02-hostwelt";
import { ensureLoggedIn } from "./support/auth";

// Echter Web-Dateiweg, echte Browser-OCR, echter E02-/Datenpunkt-Speicher; keine ersetzte Route.
// Ein synthetisches Bild. Kein Modell-, nativer PowerPoint- oder PowerPoint-Web-Hostbeleg.
test("PP04 · automatischer Bildtext, Fundstelle, E02-Berichtigung und Datenpunkt bleiben verbunden", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await ensureLoggedIn(page);
  const png = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 1400;
      c.height = 260;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Kein Canvas");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "black";
      ctx.font = "bold 76px Arial";
      ctx.fillText("BELEGSCHAFT", 60, 110);
      ctx.fillText("MITARBEITENDE 85", 60, 220);
      return c.toDataURL("image/png").split(",")[1] ?? "";
    }),
    "base64",
  );
  const artikel = await page.request.post("/api/kos", {
    data: {
      title: `PP04 fiktiv ${Date.now()}`,
      statement: "Fiktiver Bildbeleg",
      type: "best_practice",
      category: "Testbestand",
      confidentiality: "intern",
    },
  });
  expect(artikel.ok()).toBe(true);
  const { id: koId } = await artikel.json();
  const name = "PP04-Fiktiv.pptx";
  const objekt = await page.request.post("/api/objects", {
    data: {
      name,
      mime: PPTX,
      data: `data:${PPTX};base64,${(await deck({}, png)).toString("base64")}`,
      purpose: "attachment",
    },
  });
  expect(objekt.ok()).toBe(true);
  const { id: objectId } = await objekt.json();
  const angehaengt = await page.request.put(`/api/kos/${koId}`, {
    data: { action: "attach", attachment: { name, mime: PPTX, objectId } },
  });
  expect(angehaengt.ok()).toBe(true);
  const anhangId = (await angehaengt.json()).attachments.at(-1).id;

  async function oeffnen() {
    await page.goto(`/wissen/${koId}`);
    await expect(page.getByTestId("bib-titel")).toBeVisible();
    const notice = page.getByTestId("notice-ack");
    if (await notice.isVisible()) await notice.click();
    const einrichtung = page.getByRole("region", { name: "Wie soll deine Assistenz heißen?" });
    if (await einrichtung.isVisible())
      await einrichtung.getByRole("button", { name: "Später" }).click();
    await page.getByTestId("bib-mehr").click();
    await page.locator('[data-bib-abschnitt="anhaenge"] > summary').click();
    await page.locator(`[data-office-oeffnen="${anhangId}"]`).click();
  }
  await oeffnen();
  const befund = page
    .locator(`[data-office-bild-befund="${anhangId}"] [data-testid="bild-befund"]`)
    .first();
  await expect(befund).toHaveAttribute("data-status", "gelesen", { timeout: 180_000 });
  await expect(befund).toContainText("85");
  // Originalfundstelle und bestehende E02-Bedienung, kein PP04-Korrektureditor.
  await befund.getByTestId("bild-berichtigung-bearbeiten").click();
  await befund.getByTestId("bild-berichtigung-feld").fill("BELEGSCHAFT\nMITARBEITENDE 86");
  await befund.getByTestId("bild-berichtigung-speichern").click();
  await expect(befund.getByTestId("bild-berichtigung")).toHaveAttribute("data-berichtigt", "true");

  const flaeche = page.locator(`[data-folien-daten="${anhangId}"]`);
  await flaeche.locator('[data-erfassen="256:8"]').click();
  const form = flaeche.locator('[data-erfassen-formular="256:8"]');
  await expect(form.locator("[data-ocr-text]")).toContainText("MITARBEITENDE 86");
  await expect(form.locator("[data-bildtext-lesen]")).toBeDisabled();
  await form.getByLabel("Wert (wie geschrieben)").fill("86");
  await form.getByLabel("Bezugszeitraum").fill("2025");
  await form.getByLabel("Bezugsgröße").fill("Mitarbeitende");
  await form.locator("[data-erfassen-speichern]").click();
  await expect(form).toHaveCount(0);
  const detail = flaeche.locator("[data-herkunft]");
  await expect(detail.locator("[data-bildtext-uebernahme]")).toContainText("85");
  await expect(detail.locator('[data-herkunft-fundstelle="bild"]')).toContainText(
    "MITARBEITENDE 86",
  );
  const dpId = await detail.getAttribute("data-herkunft");
  const antwort = await page.request.get(`/api/datenpunkte/${dpId}`);
  expect(antwort.ok()).toBe(true);
  const dp = await antwort.json();
  expect(dp.erfassung).toBe("ocr");
  expect(dp.wert).toBe("86");
  expect(dp.pruefstand.zustand).not.toBe("validiert");
  expect(dp.fundstelle).toMatchObject({
    art: "bild",
    sldId: "256",
    shapeId: "8",
    uebernahme: {
      korrektur: { quelle: `office:${anhangId}`, text: "BELEGSCHAFT\nMITARBEITENDE 86" },
    },
  });
  expect(dp.fundstelle.uebernahme.rohText).toContain("85");
  await test.info().attach("pp04-herkunft.json", {
    body: JSON.stringify(dp, null, 2),
    contentType: "application/json",
  });
  await test
    .info()
    .attach("pp04-herkunft.png", { body: await page.screenshot(), contentType: "image/png" });
  await oeffnen();
  const zahl = flaeche.locator(`[data-datenpunkt="${dpId}"]`).first();
  await zahl.click();
  await expect(flaeche.locator("[data-bildtext-uebernahme]")).toContainText("85");
  await expect(flaeche.locator('[data-herkunft-fundstelle="bild"]')).toContainText("86");
});

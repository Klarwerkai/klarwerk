import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";
import { zeichneBild } from "./support/ocr-fundstellen-probe";

test("OCR · bewusste Finder-Einzeldatei erreicht über bestätigte Herkunft denselben Dateiweg", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await ensureLoggedIn(page);
  const bild = await zeichneBild(page, 1200, 600, [{ text: "FINDER LAGER 29", x: 80, y: 300 }]);
  const sha = createHash("sha256").update(bild.png).digest("hex");
  const ziel = {
    programm: "finder",
    sitzung: "ocr-native-vertrag",
    hostKonto: "ocr-hostkonto",
    objekt: "ocr-einzeldatei",
    auswahl: "",
    fassung: sha,
  };
  const verbindung = await page.request.post("/api/klara/programme/verbinden", { data: { ziel } });
  expect(verbindung.ok(), await verbindung.text()).toBe(true);
  const { bindung } = (await verbindung.json()) as { bindung: string };
  const aufnahme = await page.request.post("/api/klara/programme/finder", {
    data: {
      bindung,
      aktuell: ziel,
      rechte: { bedienungshilfe: false, dateizugriff: true, bildschirmaufnahme: false },
      dateien: [
        {
          dateiId: ziel.objekt,
          name: "bewusste-finder-datei.png",
          mime: "image/png",
          groesse: bild.png.length,
          geaendertAm: "2026-10-20T07:00:00Z",
          inhalt: bild.png.toString("base64"),
        },
      ],
    },
  });
  expect(aufnahme.status(), await aufnahme.text()).toBe(201);
  const { objektId, ocrUrl } = (await aufnahme.json()) as { objektId: string; ocrUrl: string };
  expect(ocrUrl).toBe(`/erfassen?weg=datei&finder=${encodeURIComponent(objektId)}`);
  await page.goto(ocrUrl);
  const bereich = page.getByTestId("datei-bild-befunde");
  await expect(bereich.getByTestId("bild-befund").first()).toHaveAttribute(
    "data-status",
    "gelesen",
    { timeout: 120_000 },
  );
  await expect(bereich.getByTestId("bild-befund-text").first()).toContainText("LAGER 29");
  await bereich.getByTestId("klara-bereich-bild").first().click();
  await bereich.getByTestId("klara-bereich-was-steht-hier").click();
  await expect(bereich.getByTestId("klara-bereich-text")).toContainText("LAGER 29");
  await test.info().attach("finder-ocr-webanschluss.png", {
    body: await bereich.screenshot(),
    contentType: "image/png",
  });
  // Regulär abgelegtes Browserobjekt ohne Finder-Aufnahme ist keine native Auswahl.
  const anderes = await page.request.post("/api/objects", {
    data: {
      name: "keine-finder-aufnahme.png",
      mime: "image/png",
      purpose: "attachment",
      data: `data:image/png;base64,${bild.png.toString("base64")}`,
    },
  });
  expect(anderes.ok()).toBe(true);
  const id = ((await anderes.json()) as { id: string }).id;
  const abgewiesen = page.waitForResponse((r) =>
    r.url().includes(`/api/klara/programme/finder/${encodeURIComponent(id)}`),
  );
  await page.goto(`/erfassen?weg=datei&finder=${encodeURIComponent(id)}`);
  expect((await abgewiesen).status()).toBe(404);
  await expect(page.getByText("Keine Aufnahme gefunden.", { exact: true })).toBeVisible();
  await expect(page.getByTestId("datei-bild-befunde")).toHaveCount(0);
});

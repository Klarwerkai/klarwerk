import { type Locator, type Page, expect, test } from "@playwright/test";
import JSZip from "jszip";

import { ensureLoggedIn } from "./support/auth";

// ================================================================================================
// KLARA POWERPOINT · PP-02 — DER DATEIWEG IM ECHTEN BROWSER GEGEN DIE ECHTE ANWENDUNG
// (produkt:20261015:klara-powerpoint-datenherkunft, Nacharbeit 2, Bens Befund 3).
// ================================================================================================
//
// WAS HIER ECHT IST: die ausgelieferte Anwendung des Smoke-Servers, ihre Routen, ihre Ablage, ihr
// PPTX-Leser und die Texterkennung des Browsers (tesseract.js wie in `ocr-technische-probe`). Nichts
// ist per `page.route` ersetzt. Ein fiktives Deck mit Tabelle, Textfeldern und einem auf <canvas>
// gezeichneten Bild hängt als `.pptx` an einem internen Artikel. Ein Mensch würde genau so gehen:
// Artikel → „Mehr“ → „Anhänge“ → „Im Artikel öffnen“ → „Daten auf den Folien“.
//
//   B1  Nutzerweg: zwei direkt übernommene Tabellenzahlen, eine MANUELLE Zahl, eine OCR-Zahl aus dem
//       Folienbild (echte Erkennung), ein BERECHNETER Wert; Herkunft an der Zahl, Eingabe → Quelle
//       (Tabellenzelle), Korrektur, Neuladen und Wiederöffnen — der Stand ist gespeichert.  (K1, K2)
//   B2  Bedienung: Tastatur (Fokus, Enter öffnet, Escape schließt, Fokus im Detailbereich), Namen im
//       Barrierebaum (Schaltflächen und Detailbereich), schmales und breites Fenster ohne
//       abgeschnittene Fläche, Darstellung bei Dunkel-Präferenz.                          (K5)
//
// WAS NICHT BELEGT IST, ausdrücklich: ein echter Screenreader (VoiceOver/NVDA) — hier steht nur der
// Barrierebaum des Browsers; PowerPoint selbst (native App, Web) — das ist ein anderer Host (A01);
// eine Kundenabnahme der OCR — die Erkennung ist eine technische Probe mit fiktivem Bild.

const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const absatz = (t: string) => `<a:p><a:r><a:rPr lang="de-DE"/><a:t>${t}</a:t></a:r></a:p>`;
const form = (id: number, name: string, zeilen: string[], titel = false) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr>${titel ? '<p:ph type="title"/>' : ""}</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/>${zeilen.map(absatz).join("")}</p:txBody></p:sp>`;
const zelle = (t: string) => `<a:tc><a:txBody><a:bodyPr/>${absatz(t)}</a:txBody><a:tcPr/></a:tc>`;
const tabelle = (id: number, name: string, zeilen: string[][]) =>
  `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${name}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblGrid/>${zeilen.map((z) => `<a:tr h="370840">${z.map(zelle).join("")}</a:tr>`).join("")}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
const bild = (id: number, name: string, rId: string) =>
  `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${name}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rId}"/></p:blipFill><p:spPr/></p:pic>`;

/** Ein fiktives Bild mit klarer Schrift, im Browser auf <canvas> gezeichnet (PNG). */
async function fiktivesBild(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 260;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("kein Canvas");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 76px Arial, Helvetica, sans-serif";
    ctx.fillText("BELEGSCHAFT", 60, 110);
    ctx.fillText("MITARBEITENDE 85", 60, 220);
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  });
  return Buffer.from(b64, "base64");
}

/** Das fiktive Deck: Folie 256 mit Tabelle (4), Ergebnis (6), Marktanteil (7) und Bild (8). */
async function deck(png: Buffer): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="png" ContentType="image/png"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>',
  );
  zip.file(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8"?><p:presentation ${NS}><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>`,
  );
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="${REL}/slide" Target="slides/slide1.xml"/></Relationships>`,
  );
  zip.file(
    "ppt/slides/slide1.xml",
    `<?xml version="1.0" encoding="UTF-8"?><p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${[
      form(2, "Titel 1", ["Ergebnis Q4 2025"], true),
      tabelle(4, "Tabelle Kennzahlen", [
        ["Kennzahl", "Q3", "Q4"],
        ["Umsatz", "1.400 T€", "1.500 T€"],
        ["Kosten", "1.100 T€", "1.200 T€"],
      ]),
      form(6, "Ergebnis", ["Ergebnis Q4: 300 T€"]),
      form(7, "Marktanteil", ["Marktanteil: 12 %"]),
      bild(8, "Grafik Belegschaft", "rId5"),
    ].join("")}</p:spTree></p:cSld></p:sld>`,
  );
  zip.file(
    "ppt/slides/_rels/slide1.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId5" Type="${REL}/image" Target="../media/image1.png"/></Relationships>`,
  );
  zip.file("ppt/media/image1.png", png);
  return zip.generateAsync({ type: "nodebuffer" });
}

function marke(): string {
  return Math.random().toString(36).slice(2, 10);
}

async function beleg(page: Page, name: string): Promise<void> {
  await test.info().attach(name, { body: await page.screenshot(), contentType: "image/png" });
}

/** Ein interner Artikel mit dem Deck als Anhang — über die echten Routen. */
async function artikelMitDeck(page: Page, m: string): Promise<{ koId: string; anhangId: string }> {
  const request = page.request;
  const ko = await request.post("/api/kos", {
    data: {
      title: `Quartalsbericht Q4 2025 fiktiv ${m}`,
      statement: `Fiktiver Quartalsbericht mit Präsentation (${m}).`,
      type: "best_practice",
      category: "Testbestand",
      confidentiality: "intern",
    },
  });
  expect(ko.ok(), `Anlegen scheiterte: ${ko.status()}`).toBe(true);
  const { id: koId } = (await ko.json()) as { id: string };
  const name = `Quartal-${m}.pptx`;
  const daten = (await deck(await fiktivesBild(page))).toString("base64");
  const objekt = await request.post("/api/objects", {
    data: { name, mime: PPTX, data: `data:${PPTX};base64,${daten}`, purpose: "attachment" },
  });
  expect(objekt.ok(), `Hochladen scheiterte: ${objekt.status()}`).toBe(true);
  const { id: objectId } = (await objekt.json()) as { id: string };
  const angehaengt = await request.put(`/api/kos/${koId}`, {
    data: { action: "attach", attachment: { name, mime: PPTX, objectId } },
  });
  expect(angehaengt.ok(), `Anhängen scheiterte: ${angehaengt.status()}`).toBe(true);
  const stand = (await angehaengt.json()) as { attachments?: { id: string }[] };
  const anhangId = stand.attachments?.at(-1)?.id ?? "";
  expect(anhangId).not.toBe("");
  return { koId, anhangId };
}

async function nutzungshinweisQuittieren(page: Page): Promise<void> {
  const weiter = page.getByTestId("notice-ack");
  if (await weiter.isVisible()) {
    await weiter.click();
    await expect(page.getByTestId("notice-banner")).toHaveCount(0, { timeout: 15_000 });
  }
}

/** Artikel öffnen → „Mehr" → „Anhänge" → „Im Artikel öffnen" → die Datenfläche des Anhangs. */
async function oeffneDatenflaeche(page: Page, koId: string, anhangId: string): Promise<Locator> {
  await page.goto(`/wissen/${koId}`);
  await expect(page.getByTestId("bib-titel")).toBeVisible({ timeout: 15_000 });
  await nutzungshinweisQuittieren(page);
  // Das Einrichtungsband der Assistenz liegt im schmalen Fenster über dem Inhalt — wie ein Mensch
  // es mit „Später“ wegschiebt, ohne etwas einzurichten.
  const einrichtung = page.getByRole("region", { name: "Wie soll deine Assistenz heißen?" });
  if (await einrichtung.isVisible()) {
    await einrichtung.getByRole("button", { name: "Später" }).click();
    await expect(einrichtung).toBeHidden({ timeout: 15_000 });
  }
  await page.getByTestId("bib-mehr").click();
  await page.locator('[data-bib-abschnitt="anhaenge"] > summary').click();
  await page.locator(`[data-office-oeffnen="${anhangId}"]`).click();
  const flaeche = page.locator(`[data-folien-daten="${anhangId}"]`);
  await expect(flaeche).toBeVisible({ timeout: 15_000 });
  await expect(flaeche.locator('[data-folie="256"]')).toBeVisible({ timeout: 15_000 });
  return flaeche;
}

/** Am Element „erfassen“ öffnen und das Formular liefern. */
async function erfassenAm(flaeche: Locator, shapeId: string): Promise<Locator> {
  await flaeche.locator(`[data-erfassen="256:${shapeId}"]`).click();
  const formular = flaeche.locator(`[data-erfassen-formular="256:${shapeId}"]`);
  await expect(formular).toBeVisible();
  return formular;
}

/** Speichern und die Kennung des neuen Datenpunkts aus dem geöffneten Detailbereich lesen. */
async function speichern(flaeche: Locator, formular: Locator): Promise<string> {
  await formular.locator("[data-erfassen-speichern]").click();
  await expect(formular).toHaveCount(0, { timeout: 15_000 });
  const detail = flaeche.locator("[data-herkunft]");
  await expect(detail).toBeVisible();
  const id = (await detail.getAttribute("data-herkunft")) ?? "";
  expect(id).not.toBe("");
  return id;
}

test.describe("PP-02 · Datenherkunft am PowerPoint-Anhang", () => {
  test("B1 · manuelle Zahl, OCR-Zahl, berechneter Wert; Herkunft, Korrektur, Wiederöffnen", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await ensureLoggedIn(page);
    const { koId, anhangId } = await artikelMitDeck(page, marke());
    const flaeche = await oeffneDatenflaeche(page, koId, anhangId);
    await beleg(page, "b1-folien-geoeffnet");

    // Zwei direkt übernommene Tabellenzahlen (Zeile 2 und 3, Spalte Q4).
    const ids: Record<string, string> = {};
    for (const [name, zelleWert, wert] of [
      ["umsatz", "2:3", "1.500 T€"],
      ["kosten", "3:3", "1.200 T€"],
    ] as const) {
      const f = await erfassenAm(flaeche, "4");
      await f.getByLabel("Tabellenzelle").selectOption(zelleWert);
      await f.getByLabel("Wert (wie geschrieben)").fill(wert);
      await f.getByLabel("Einheit / Währung").fill("T€");
      await f.getByLabel("Bezugszeitraum").fill("Q4 2025");
      ids[name] = await speichern(flaeche, f);
    }

    // MANUELLE Zahl.
    const fm = await erfassenAm(flaeche, "7");
    await fm.getByLabel("Wie kam der Wert zustande?").selectOption("manuell");
    await fm.getByLabel("Wert (wie geschrieben)").fill("12 %");
    await fm.getByLabel("Bezugszeitraum").fill("2025");
    ids.manuell = await speichern(flaeche, fm);

    // BERECHNETER Wert: Differenz Umsatz − Kosten.
    const fb = await erfassenAm(flaeche, "6");
    await fb.getByLabel("Wie kam der Wert zustande?").selectOption("berechnet");
    await fb.getByLabel("Rechenart").selectOption("differenz");
    await fb.locator(`[data-eingabe-waehlen="${ids.umsatz}"]`).check();
    await fb.locator(`[data-eingabe-waehlen="${ids.kosten}"]`).check();
    await fb.getByLabel("Wert (wie geschrieben)").fill("300 T€");
    ids.berechnet = await speichern(flaeche, fb);

    // OCR-Zahl aus dem Folienbild — die echte Erkennung im Browser, ausdrücklich gestartet.
    const fo = await erfassenAm(flaeche, "8");
    await fo.locator("[data-bildtext-lesen]").click();
    const ocrText = fo.locator("[data-ocr-text]");
    const ocrFehler = fo.locator('[role="alert"]');
    await expect(ocrText.or(ocrFehler)).toBeVisible({ timeout: 180_000 });
    await test.info().attach("ocr-ausgang.json", {
      contentType: "application/json",
      body: JSON.stringify({
        art: "Technische OCR-Probe mit fiktivem Bild — keine Kundenabnahme",
        erkannt: (await ocrText.count()) ? await ocrText.textContent() : null,
        fehler: (await ocrFehler.count()) ? await ocrFehler.textContent() : null,
      }),
    });
    await expect(ocrText, "Die Texterkennung hat das Folienbild nicht gelesen").toContainText("85");
    await fo.getByLabel("Wert (wie geschrieben)").fill("85");
    ids.ocr = await speichern(flaeche, fo);
    await beleg(page, "b1-vier-arten-erfasst");

    // Unterscheidbar an der Zahl: Erfassungsart je Element.
    await expect(
      flaeche.locator(`[data-element="256:7"] [data-datenpunkt="${ids.manuell}"]`),
    ).toHaveAttribute("data-erfassung", "manuell");
    await expect(
      flaeche.locator(`[data-element="256:8"] [data-datenpunkt="${ids.ocr}"]`),
    ).toHaveAttribute("data-erfassung", "ocr");
    await expect(
      flaeche.locator(`[data-element="256:6"] [data-datenpunkt="${ids.berechnet}"]`),
    ).toHaveAttribute("data-erfassung", "berechnet");

    // Herkunft an der berechneten Zahl → Eingabe → deren Quelle (Tabellenzelle).
    await flaeche.locator(`[data-datenpunkt="${ids.berechnet}"]`).click();
    const detail = flaeche.locator("[data-herkunft]");
    await expect(detail.locator("[data-herkunft-rechenweg]")).toContainText("1.500 T€ − 1.200 T€");
    await detail.locator(`[data-eingabe="${ids.umsatz}"]`).click();
    await expect(detail).toHaveAttribute("data-herkunft", ids.umsatz ?? "");
    await expect(detail.locator('[data-herkunft-fundstelle="tabellenzelle"]')).toContainText(
      "Umsatz",
    );
    await expect(detail.locator("[data-herkunft-quelle]")).toHaveAttribute(
      "data-herkunft-quelle",
      koId,
    );
    await beleg(page, "b1-eingabe-bis-zur-quelle");
    await detail.locator("[data-herkunft-schliessen]").click();
    await expect(detail).toHaveCount(0);

    // OCR-Zahl: erkannter Text und „nicht bestätigt“ im Prüfstand.
    await flaeche.locator(`[data-datenpunkt="${ids.ocr}"]`).click();
    await expect(detail.locator('[data-herkunft-fundstelle="bild"]')).toContainText("85");
    await expect(detail.locator('[data-dimension="erkennung"]')).toHaveAttribute(
      "data-stand",
      "offen",
    );

    // Korrektur der manuellen Zahl.
    await flaeche.locator(`[data-datenpunkt="${ids.manuell}"]`).click();
    await detail.locator("[data-korrigieren-oeffnen]").click();
    const korrektur = detail.locator("[data-korrigieren]");
    await korrektur.getByLabel("Wert (wie geschrieben)").fill("13 %");
    await korrektur.getByLabel("Grund", { exact: true }).fill("Neue Auskunft (fiktiv)");
    await korrektur.getByRole("button", { name: "Korrektur speichern" }).click();
    await expect(detail.locator('[data-korrektur="2"]')).toBeVisible({ timeout: 15_000 });
    await expect(detail.locator('[data-bindung="abweichung"]')).toBeVisible();
    await beleg(page, "b1-korrigiert");

    // Neu laden und wieder öffnen: alles ist gespeichert, die Korrektur bleibt.
    await page.reload();
    const wieder = await oeffneDatenflaeche(page, koId, anhangId);
    for (const id of Object.values(ids)) {
      await expect(wieder.locator(`[data-datenpunkt="${id}"]`).first()).toBeVisible();
    }
    await expect(wieder.locator(`[data-datenpunkt="${ids.manuell}"]`)).toContainText("13 %");
    await wieder.locator(`[data-datenpunkt="${ids.manuell}"]`).click();
    await expect(wieder.locator('[data-herkunft] [data-korrektur="2"]')).toBeVisible();
    await beleg(page, "b1-wiedergeoeffnet");
  });

  test("B2 · Tastatur, Barrierebaum, Fensterbreiten, Dunkel-Präferenz", async ({ page }) => {
    test.setTimeout(120_000);
    await ensureLoggedIn(page);
    const { koId, anhangId } = await artikelMitDeck(page, marke());
    await page.setViewportSize({ width: 1440, height: 900 });
    const flaeche = await oeffneDatenflaeche(page, koId, anhangId);
    const f = await erfassenAm(flaeche, "7");
    await f.getByLabel("Wie kam der Wert zustande?").selectOption("manuell");
    await f.getByLabel("Wert (wie geschrieben)").fill("12 %");
    const id = await speichern(flaeche, f);
    await flaeche.locator("[data-herkunft-schliessen]").click();

    // Barrierebaum: die Zahl ist eine Schaltfläche mit Wert, Erfassungsart und Prüfstand im Namen.
    const zahl = page.getByRole("button", {
      name: /Herkunft von 12 % anzeigen \(Manuell eingegeben/,
    });
    await expect(zahl).toBeVisible();

    // Tastatur: fokussieren, Enter öffnet, der Fokus springt in den Detailbereich, Escape schließt.
    await zahl.focus();
    await expect(zahl).toBeFocused();
    await page.keyboard.press("Enter");
    const detail = page.getByRole("complementary", { name: "Herkunft" });
    await expect(detail).toBeVisible();
    await expect(detail.locator("h6")).toBeFocused();
    await expect(zahl).toHaveAttribute("aria-pressed", "true");
    // Mit Tab erreichbar: die Schaltflächen des Detailbereichs.
    await page.keyboard.press("Tab");
    const fokus = await page.evaluate(
      () => document.activeElement?.closest("[data-herkunft]") !== null,
    );
    expect(fokus, "Tab verlässt den Detailbereich statt seine Bedienelemente zu erreichen").toBe(
      true,
    );
    await page.keyboard.press("Escape");
    await expect(detail).toHaveCount(0);

    // Breites Fenster: Detailbereich NEBEN der Folie, nichts abgeschnitten.
    await zahl.click();
    const liste = flaeche.locator("[data-folien-liste]");
    const breitListe = await liste.boundingBox();
    const breitDetail = await flaeche.locator(`[data-herkunft="${id}"]`).boundingBox();
    expect(breitListe && breitDetail && breitDetail.x > breitListe.x + breitListe.width - 1).toBe(
      true,
    );
    const ueberlauf = (bereich: Locator) =>
      bereich.evaluate((el) => {
        const zuBreit = [el, ...Array.from(el.querySelectorAll<HTMLElement>("[data-herkunft], li"))]
          .filter((x) => x.scrollWidth > x.clientWidth + 1)
          .map((x) => x.getAttribute("data-herkunft") ?? x.tagName);
        return zuBreit;
      });
    expect(await ueberlauf(flaeche)).toEqual([]);
    await beleg(page, "b2-breit");

    // Schmales Fenster: Detailbereich UNTER der Folie, nichts abgeschnitten, Bedienung erreichbar.
    // Nacharbeit 3: der Wechsel über die Layoutgrenze baut die Artikelseite neu auf und klappt
    // „Mehr“ zu (vorhandenes Verhalten der Artikelseite, nicht dieser Fläche). Gemessen wird deshalb,
    // wie ein Mensch im schmalen Fenster arbeitet: dort öffnen, dort die Zahl wählen.
    await page.setViewportSize({ width: 390, height: 844 });
    const schmal = await oeffneDatenflaeche(page, koId, anhangId);
    await schmal.locator(`[data-datenpunkt="${id}"]`).click();
    await expect(schmal.locator(`[data-herkunft="${id}"]`)).toBeVisible();
    const schmalListe = await schmal.locator("[data-folien-liste]").boundingBox();
    const schmalDetail = await schmal.locator(`[data-herkunft="${id}"]`).boundingBox();
    expect(
      schmalListe && schmalDetail && schmalDetail.y >= schmalListe.y + schmalListe.height - 1,
    ).toBe(true);
    expect(await ueberlauf(schmal)).toEqual([]);
    await schmal.locator("[data-herkunft-schliessen]").scrollIntoViewIfNeeded();
    await expect(schmal.locator("[data-herkunft-schliessen]")).toBeVisible();
    await beleg(page, "b2-schmal");

    // Dunkel-Präferenz: die Fläche bleibt lesbar (Schrift- und Hintergrundfarbe verschieden). Ohne
    // erneuten Breitenwechsel — die Fläche des schmalen Fensters bleibt offen.
    for (const schema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: schema });
      const farben = await zahl.evaluate((el) => {
        let hinten: Element | null = el;
        let hintergrund = "rgba(0, 0, 0, 0)";
        while (hinten && /rgba\(0, 0, 0, 0\)|transparent/.test(hintergrund)) {
          hintergrund = getComputedStyle(hinten).backgroundColor;
          hinten = hinten.parentElement;
        }
        return { schrift: getComputedStyle(el).color, hintergrund };
      });
      await test.info().attach(`farben-${schema}.json`, {
        contentType: "application/json",
        body: JSON.stringify(farben),
      });
      expect(farben.schrift, schema).not.toBe(farben.hintergrund);
      await beleg(page, `b2-${schema}`);
    }
  });
});

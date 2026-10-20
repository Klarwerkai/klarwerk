// ================================================================================================
// OCR-E05 · MÖGLICHE ABWEICHUNG ZWISCHEN FOLIENTEXT UND BILDTEXT — im echten Browser gegen den
// Smoke-Server, mit der ECHTEN Texterkennung (W01, tesseract.js unter der eigenen CSP).
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-widersprueche, K1/K2/K4.
//
// Eine PowerPoint über den Dateiimport: Folie 1 sagt im Text „Die Gesamtsumme beträgt 1.500 €.“, ihr
// Bild zeigt „Gesamtsumme 1.800 €“; Folie 2 nennt im Text und im Bild dasselbe Lieferdatum. Gezeigt
// werden muss genau die Gesamtsumme — beide Angaben mit Fundstelle nebeneinander (K1); das gleiche
// Datum erzeugt keinen Hinweis (K2); der Hinweis sagt nicht, welcher Wert stimmt (K4).
//
// NICHT ZUSTANDSANLEGEND: gelesen wird nur, gespeichert wird nichts. Die Bilder sind fiktiv (im
// Browser gezeichnet). Das ist der Dateiweg im Browser, keine PowerPoint-Hostprobe.
import { type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const DECKNAME = "fiktive-abrechnung-e05.pptx";

const FOLIEN = [
  {
    titel: "Abrechnung Projekt Nord",
    text: "Die Gesamtsumme beträgt 1.500 €.",
    bild: "Gesamtsumme 1.800 €",
  },
  {
    titel: "Lieferung",
    text: "Lieferdatum ist der 12.10.2026.",
    bild: "Lieferdatum 12.10.2026",
  },
] as const;

async function fiktivesBild(page: Page, zeile: string): Promise<Buffer> {
  const b64 = await page.evaluate((z) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 230;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("kein Canvas");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 80px Arial, Helvetica, sans-serif";
    ctx.fillText(z, 60, 140);
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  }, zeile);
  return Buffer.from(b64, "base64");
}

// ------------------------------------------------------------------------------------------------
// Eine minimale PPTX (ZIP ohne Kompression) — dieselbe Bauweise wie die OCR-02/OCR-03-Probe.
// ------------------------------------------------------------------------------------------------

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) {
    c = (CRC[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function zipOhneKompression(eintraege: Record<string, Uint8Array>): Buffer {
  const lokal: Buffer[] = [];
  const zentral: Buffer[] = [];
  let versatz = 0;
  for (const [name, daten] of Object.entries(eintraege)) {
    const nameBytes = Buffer.from(name, "utf8");
    const crc = crc32(daten);
    const kopf = Buffer.alloc(30);
    kopf.writeUInt32LE(0x04034b50, 0);
    kopf.writeUInt16LE(20, 4);
    kopf.writeUInt16LE(0x0800, 6);
    kopf.writeUInt16LE(0, 8);
    kopf.writeUInt32LE(crc, 14);
    kopf.writeUInt32LE(daten.length, 18);
    kopf.writeUInt32LE(daten.length, 22);
    kopf.writeUInt16LE(nameBytes.length, 26);
    lokal.push(kopf, nameBytes, Buffer.from(daten));
    const z = Buffer.alloc(46);
    z.writeUInt32LE(0x02014b50, 0);
    z.writeUInt16LE(20, 4);
    z.writeUInt16LE(20, 6);
    z.writeUInt16LE(0x0800, 8);
    z.writeUInt16LE(0, 10);
    z.writeUInt32LE(crc, 16);
    z.writeUInt32LE(daten.length, 20);
    z.writeUInt32LE(daten.length, 24);
    z.writeUInt16LE(nameBytes.length, 28);
    z.writeUInt32LE(versatz, 42);
    zentral.push(z, nameBytes);
    versatz += kopf.length + nameBytes.length + daten.length;
  }
  const zentralBytes = Buffer.concat(zentral);
  const ende = Buffer.alloc(22);
  ende.writeUInt32LE(0x06054b50, 0);
  ende.writeUInt16LE(Object.keys(eintraege).length, 8);
  ende.writeUInt16LE(Object.keys(eintraege).length, 10);
  ende.writeUInt32LE(zentralBytes.length, 12);
  ende.writeUInt32LE(versatz, 16);
  return Buffer.concat([...lokal, zentralBytes, ende]);
}

const URI_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const URI_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const URI_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const URI_PKG_R = "http://schemas.openxmlformats.org/package/2006/relationships";
const KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const enc = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "utf8"));

function folie(titel: string, text: string): string {
  const sp = (ph: string, inhalt: string) =>
    `<p:sp><p:nvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${inhalt}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const bild = '<p:pic><p:blipFill><a:blip r:embed="rId9"/></p:blipFill></p:pic>';
  return `${KOPF}<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:cSld><p:spTree>${sp('<p:ph type="title"/>', titel)}${sp("", text)}${bild}</p:spTree></p:cSld></p:sld>`;
}

const bildRels = (datei: string): string =>
  `${KOPF}<Relationships xmlns="${URI_PKG_R}"><Relationship Id="rId9" Type="${URI_R}/image" Target="../media/${datei}"/></Relationships>`;

function deck(bilder: readonly Buffer[]): Buffer {
  return zipOhneKompression({
    "[Content_Types].xml": enc(
      `${KOPF}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/></Types>`,
    ),
    "_rels/.rels": enc(
      `${KOPF}<Relationships xmlns="${URI_PKG_R}"><Relationship Id="rId1" Type="${URI_R}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    ),
    "ppt/presentation.xml": enc(
      `${KOPF}<p:presentation xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`,
    ),
    "ppt/_rels/presentation.xml.rels": enc(
      `${KOPF}<Relationships xmlns="${URI_PKG_R}"><Relationship Id="rId1" Type="${URI_R}/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="${URI_R}/slide" Target="slides/slide2.xml"/></Relationships>`,
    ),
    "ppt/slides/slide1.xml": enc(folie(FOLIEN[0].titel, FOLIEN[0].text)),
    "ppt/slides/slide2.xml": enc(folie(FOLIEN[1].titel, FOLIEN[1].text)),
    "ppt/slides/_rels/slide1.xml.rels": enc(bildRels("bild1.png")),
    "ppt/slides/_rels/slide2.xml.rels": enc(bildRels("bild2.png")),
    "ppt/media/bild1.png": new Uint8Array(bilder[0] ?? Buffer.alloc(0)),
    "ppt/media/bild2.png": new Uint8Array(bilder[1] ?? Buffer.alloc(0)),
  });
}

// ------------------------------------------------------------------------------------------------
// Ablesen
// ------------------------------------------------------------------------------------------------

const DATEI = "[data-testid=datei-bild-befunde]";
const DATEI_BEFUND = `${DATEI} [data-testid=bild-befunde]`;

test("OCR-E05 · Abweichung zwischen Folientext und Bildtext mit beiden Fundstellen", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await ensureLoggedIn(page);
  await page.goto("/erfassen?weg=datei");
  const eingang = page.locator('input[type="file"][accept*=".pptx"][accept*="image/*"]').first();
  await expect(eingang, "Dateiimport des Erfassens ist nicht da").toBeAttached({ timeout: 20_000 });

  const bilder: Buffer[] = [];
  for (const f of FOLIEN) {
    bilder.push(await fiktivesBild(page, f.bild));
  }
  const protokoll: Record<string, unknown> = {
    art: "Technische Probe mit fiktiven Daten über den Dateiweg im Browser — keine Kundenabnahme, keine PowerPoint-Hostprobe",
    deck: { name: DECKNAME, folien: FOLIEN },
  };

  await eingang.setInputFiles({
    name: DECKNAME,
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: deck(bilder),
  });
  await expect
    .poll(
      async () =>
        (await page.evaluate(
          (auswahl) => document.querySelector(auswahl)?.getAttribute("data-status") ?? null,
          DATEI_BEFUND,
        )) ?? "wartet",
      { timeout: 240_000, intervals: [1_000] },
    )
    .not.toMatch(/^(wartet|laeuft)$/);
  const befunde = await page
    .locator(`${DATEI_BEFUND} [data-testid=bild-befund]`)
    .evaluateAll((els) =>
      els.map((el) => ({
        status: el.getAttribute("data-status"),
        folie: el.getAttribute("data-folie"),
        text: el.querySelector("[data-testid=bild-befund-text]")?.textContent ?? "",
      })),
    );
  protokoll.befunde = befunde;

  const panel = page.locator(`${DATEI} [data-testid=klara-bild-kontext]`);
  await expect(panel).toBeVisible();
  const liste = panel.getByTestId("bild-widersprueche");
  await expect(liste, "kein Hinweis auf die abweichende Gesamtsumme").toBeVisible({
    timeout: 30_000,
  });
  const hinweise = await liste.getByTestId("bild-widerspruch").evaluateAll((els) =>
    els.map((el) => ({
      art: el.getAttribute("data-art"),
      angabe: el.getAttribute("data-angabe"),
      beschreibung:
        el.querySelector("[data-testid=bild-widerspruch-beschreibung]")?.textContent ?? "",
      text: el.querySelector("[data-testid=bild-widerspruch-text-wert]")?.textContent ?? "",
      textOrt: el.querySelector("[data-testid=bild-widerspruch-text-ort]")?.textContent ?? "",
      bild: el.querySelector("[data-testid=bild-widerspruch-bild-wert]")?.textContent ?? "",
      bildOrt: el.querySelector("[data-testid=bild-widerspruch-bild-ort]")?.textContent ?? "",
    })),
  );
  protokoll.hinweise = hinweise;

  await test.info().attach("ocr-e05-widersprueche.json", {
    contentType: "application/json",
    body: JSON.stringify(protokoll, null, 2),
  });
  await test.info().attach("ocr-e05-widersprueche.png", {
    contentType: "image/png",
    body: await panel.screenshot(),
  });

  // Beide Bilder wurden echt gelesen; die Gesamtsumme im Bild ist 1.800.
  expect(befunde.filter((b) => b.status === "gelesen").length).toBeGreaterThanOrEqual(2);
  expect(befunde.find((b) => b.folie === "1")?.text ?? "").toMatch(/1[.,]?800/);

  // K1: die Gesamtsumme — Text 1.500 € gegenüber Bild 1.800 € auf Folie 1, Bild 1.
  const summe = hinweise.find(
    (h) => h.art === "moeglicher-widerspruch" && h.bildOrt.includes("Folie 1, Bild 1"),
  );
  expect(summe, JSON.stringify(hinweise)).toBeDefined();
  expect(summe?.angabe).toBe("betrag");
  expect(summe?.text).toBe("1.500 €");
  expect(summe?.textOrt).toMatch(/^Text, Absatz \d+, Satz \d+$/);
  expect(summe?.bild.replace(/\s+/g, "")).toMatch(/^1[.,]?800(,00)?€$/);
  expect(summe?.bildOrt).toContain(`${DECKNAME} · Folie 1, Bild 1, Zeile`);
  // K4: der Hinweis sagt nicht, welcher Wert stimmt.
  expect(summe?.beschreibung).toContain("welche stimmt, lässt sich daraus nicht sagen");
  // K2: das gleiche Lieferdatum erzeugt keinen Hinweis.
  expect(hinweise.some((h) => h.angabe === "datum")).toBe(false);
  expect(hinweise.some((h) => h.bildOrt.includes("Folie 2"))).toBe(false);
});

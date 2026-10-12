// ================================================================================================
// OCR-03 · KLARA NUTZT DEN AUTOMATISCH GELESENEN BILDTEXT — im echten Browser gegen den
// Smoke-Server, mit der ECHTEN Texterkennung (W01, tesseract.js unter der eigenen CSP).
// ================================================================================================
//
// Auftrag produkt:20261012:klara-bildanalyse-ocr-kontext-setup, K1/K2/K3.
//
// Eine PowerPoint mit zwei Folien, deren Bildtext NUR im Bild steht, wird über den Dateiimport
// bereitgestellt — ohne Klick gelesen (K3). Eine Frage zu einem Bildtext nennt als Fundstelle genau
// das Bild auf seiner Folie, mit dem ECHT erkannten Text (K1, deterministisch, unabhängig von einem
// Modell). „Zusammenfassen“ nennt die berücksichtigten Bilder (K2). Eine formulierte Modellantwort
// wird protokolliert, wenn der Server ein Modell hat — im Tor (ohne Modell) wird sie nicht
// vorausgesetzt, und das steht dann so da.
//
// NICHT ZUSTANDSANLEGEND: gelesen wird nur, gespeichert wird nichts. Die Bilder sind fiktiv (im
// Browser gezeichnet). Die Setup-Probe mit eigenem Konto steht in
// `klara-bildautomatik-setup-browser.spec.ts` (isolierter Kontext).
import { type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const DECKNAME = "fiktive-anlage-ocr03.pptx";

/** Je Bild: Folie und Zeile. Die Marken stehen NUR im Bild, nie im Folientext. */
const BILDER = [
  { folie: 1, zeile: "PRUEFKARTE 47" },
  { folie: 2, zeile: "LAGER 29" },
] as const;

async function fiktivesBild(page: Page, zeile: string): Promise<Buffer> {
  const b64 = await page.evaluate((z) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
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
// Eine minimale PPTX (ZIP ohne Kompression) — dieselbe Bauweise wie die OCR-02-Probe.
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

function folie(titel: string): string {
  const titelForm = `<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${titel}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const bild = '<p:pic><p:blipFill><a:blip r:embed="rId9"/></p:blipFill></p:pic>';
  return `${KOPF}<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:cSld><p:spTree>${titelForm}${bild}</p:spTree></p:cSld></p:sld>`;
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
    "ppt/slides/slide1.xml": enc(folie("Wartungsplan")),
    "ppt/slides/slide2.xml": enc(folie("Anlage")),
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

/** Wartet, bis der Befund eines NEUEN Eingangs (`data-lauf` > `nachLauf`) abgeschlossen ist. */
async function wartenBisFertig(
  page: Page,
  nachLauf: number,
): Promise<{ status: string; lauf: number }> {
  let stand = { status: "laeuft", lauf: nachLauf };
  await expect
    .poll(
      async () => {
        const gelesen = await page.evaluate((auswahl) => {
          const el = document.querySelector(auswahl);
          return el
            ? {
                status: el.getAttribute("data-status") ?? "fehlt",
                lauf: Number(el.getAttribute("data-lauf") ?? "0"),
              }
            : null;
        }, DATEI_BEFUND);
        if (!gelesen || gelesen.lauf <= nachLauf) {
          return "wartet";
        }
        stand = gelesen;
        return gelesen.status;
      },
      { timeout: 240_000, intervals: [1_000] },
    )
    .not.toMatch(/^(wartet|laeuft)$/);
  return stand;
}

test("OCR-03 · Klara nutzt den automatisch gelesenen Bildtext einer PowerPoint mit Fundstelle", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await ensureLoggedIn(page);
  await page.goto("/erfassen?weg=datei");
  const eingang = page.locator('input[type="file"][accept*=".pptx"][accept*="image/*"]').first();
  await expect(eingang, "Dateiimport des Erfassens ist nicht da").toBeAttached({ timeout: 20_000 });

  const bilder: Buffer[] = [];
  for (const b of BILDER) {
    bilder.push(await fiktivesBild(page, b.zeile));
  }
  const protokoll: Record<string, unknown> = {
    art: "Technische Probe mit fiktiven Daten — keine Kundenabnahme",
    deck: { name: DECKNAME, bilder: BILDER },
  };

  // Bereitstellen — KEIN Klick auf eine Erkennung (K3).
  await eingang.setInputFiles({
    name: DECKNAME,
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: deck(bilder),
  });
  const lauf = await wartenBisFertig(page, 0);
  const befunde = await page
    .locator(`${DATEI_BEFUND} [data-testid=bild-befund]`)
    .evaluateAll((els) =>
      els.map((el) => ({
        status: el.getAttribute("data-status"),
        zeile: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
        // Der erkannte Text aus seinem eigenen Element — im textContent der ganzen Zeile stossen
        // Status, Text und Bildinhalt ohne Leerzeichen aneinander („…LAGER 29BILDINHALT…“).
        text: el.querySelector("[data-testid=bild-befund-text]")?.textContent ?? "",
      })),
    );
  protokoll.befund = { ...lauf, befunde };

  const panel = page.locator(`${DATEI} [data-testid=klara-bild-kontext]`);
  await expect(panel).toBeVisible();
  // PowerPoint gilt nie als vollständig gelesen (L16) — das steht schon vor der Frage.
  await expect(panel).toHaveAttribute("data-vollstaendig", "false");

  // K1: Frage zu Text, der NUR im Bild auf Folie 2 steht.
  await panel.getByTestId("klara-bild-kontext-frage").fill("Welche Nummer hat das LAGER?");
  await panel.getByTestId("klara-bild-kontext-fragen").click();
  const antwort = panel.getByTestId("klara-bild-kontext-antwort");
  await expect(antwort).toHaveAttribute("data-auftrag", "frage", { timeout: 120_000 });
  const belege = await panel
    .getByTestId("klara-bild-kontext-beleg")
    .evaluateAll((els) =>
      els.map((el) => ({ art: el.getAttribute("data-art"), text: el.textContent ?? "" })),
    );
  const modellAntwort =
    (await panel.getByTestId("klara-bild-kontext-antworttext").count()) > 0
      ? await panel.getByTestId("klara-bild-kontext-antworttext").textContent()
      : null;
  protokoll.frage = { belege, modellAntwort };

  // K2: Zusammenfassung — die berücksichtigten Bilder sind benannt.
  await panel.getByTestId("klara-bild-kontext-zusammenfassen").click();
  await expect(antwort).toHaveAttribute("data-auftrag", "zusammenfassung", { timeout: 120_000 });
  const bilderZeile = (await panel.getByTestId("klara-bild-kontext-bilder").textContent()) ?? "";
  const modellZusammenfassung =
    (await panel.getByTestId("klara-bild-kontext-antworttext").count()) > 0
      ? await panel.getByTestId("klara-bild-kontext-antworttext").textContent()
      : null;
  const unvollstaendig = await panel.getByTestId("klara-bild-kontext-unvollstaendig").count();
  protokoll.zusammenfassung = { bilderZeile, modellZusammenfassung, unvollstaendig };

  await test.info().attach("ocr03-klara-bildkontext.json", {
    contentType: "application/json",
    body: JSON.stringify(protokoll, null, 2),
  });
  await test.info().attach("ocr03-klara-bildkontext.png", {
    contentType: "image/png",
    body: await panel.screenshot(),
  });

  expect(befunde.map((b) => b.status)).toEqual(["gelesen", "gelesen"]);
  expect(befunde[1]?.zeile).toContain("Folie 2, Bild 1");
  expect(befunde[1]?.text.toUpperCase()).toMatch(/\b29\b/);
  // Die Fundstelle ist das Bild auf Folie 2 — und sie trägt den echt erkannten Text.
  expect(belege[0]?.art).toBe("bild");
  expect(belege[0]?.text).toContain(`${DECKNAME} · Folie 2, Bild 1`);
  expect(belege[0]?.text.toUpperCase()).toMatch(/\b29\b/);
  expect(belege.some((b) => b.art === "dokument")).toBe(false);
  // Beide Bilder gingen in die Zusammenfassung ein.
  expect(bilderZeile).toContain(`${DECKNAME} · Folie 1, Bild 1`);
  expect(bilderZeile).toContain(`${DECKNAME} · Folie 2, Bild 1`);
  // Nicht vollständig gelesen → die Antwort sagt es.
  expect(unvollstaendig).toBe(1);
});

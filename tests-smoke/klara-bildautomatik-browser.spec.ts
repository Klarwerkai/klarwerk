// ================================================================================================
// OCR-02 · KLARA LIEST BEREITGESTELLTE BILDER AUTOMATISCH — ECHTE ERKENNUNG IM BROWSER
// ================================================================================================
//
// Auftrag produkt:20261012:klara-bildanalyse-ocr-automatik. Peter: „sofort automatisch mitlesen."
//
// WAS GEMESSEN WIRD, im echten Browser gegen den Smoke-Server, mit der ECHTEN Texterkennung
// (tesseract.js unter der eigenen CSP, W01) — kein Stellvertreter:
//   1. Eine PowerPoint-Datei mit drei eingebetteten Bildern auf zwei Folien wird über den
//      Dateiimport des Erfassens bereitgestellt. OHNE Klick auf eine Erkennung erscheint der
//      Befund: jedes Bild mit Folie und Position, und der Text in den Bildern ist erkannt — obwohl
//      er nicht als editierbarer Folientext vorliegt (K1, K2, K3).
//   2. Die PowerPoint-Quelle wird nie „vollständig gelesen" gemeldet: Layout, Master, Diagramme und
//      SmartArt erfasst der Leser nicht (L16), das steht als Hinweis da (K5).
//   3. Dieselbe Datei noch einmal: kein Bild wird erneut erkannt, jeder Befund ist als
//      „unverändert — vorhandenes Ergebnis" ausgewiesen (K4).
//   4. Ein neues Einzelbild wird ohne Klick gelesen; sein Text wird der Dateitext (K1).
//
// DIE BILDER SIND FIKTIV: im Browser auf ein `<canvas>` geschrieben, keine Personen- oder
// Kundendaten. Die PowerPoint-Datei wird hier aus diesen Bildern zusammengesetzt (ZIP ohne
// Kompression, OOXML-Bausteine wie `tests/pptx-importquittung/messung.ts`). Gespeichert wird nichts.
//
// DAS PROTOKOLL hängt als Anhang am Bericht, gleich wie es ausgeht: Befunde je Bild mit Status und
// erkanntem Text, Zeitpunkte, CSP-Meldungen.
import { type Locator, type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const DECKNAME = "fiktive-wartung-ocr02.pptx";
const BILDNAME = "fiktiver-aushang-ocr02.png";

/** Je Bild: Folie und Zeilen. Die Marken stehen NUR im Bild, nie im Folientext. */
const BILDER = [
  { folie: 1, zeilen: ["PRUEFKARTE 47"], marke: /\b47\b/, wort: /PRUEFKARTE/ },
  { folie: 2, zeilen: ["VENTIL 83"], marke: /\b83\b/, wort: /VENTIL/ },
  { folie: 2, zeilen: ["LAGER 29"], marke: /\b29\b/, wort: /LAGER/ },
] as const;
const EINZELBILD = { zeilen: ["AUSHANG 61"], marke: /\b61\b/, wort: /AUSHANG/ };

/** Ein fiktives Bild mit klarer Schrift, im Browser erzeugt (PNG-Bytes). */
async function fiktivesBild(page: Page, zeilen: readonly string[]): Promise<Buffer> {
  const b64 = await page.evaluate((z) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 120 + z.length * 110;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("kein Canvas");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 80px Arial, Helvetica, sans-serif";
    z.forEach((zeile, i) => {
      ctx.fillText(zeile, 60, 120 + i * 110);
    });
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  }, zeilen);
  return Buffer.from(b64, "base64");
}

// ------------------------------------------------------------------------------------------------
// Eine minimale PPTX: ZIP ohne Kompression (Methode 0), wie es jedes Entpackprogramm liest
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
    kopf.writeUInt16LE(0x0800, 6); // UTF-8-Namen
    kopf.writeUInt16LE(0, 8); // gespeichert
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

function folie(titel: string, rids: readonly string[]): string {
  const titelForm = `<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${titel}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const bilder = rids
    .map((rid) => `<p:pic><p:blipFill><a:blip r:embed="${rid}"/></p:blipFill></p:pic>`)
    .join("");
  return `${KOPF}<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:cSld><p:spTree>${titelForm}${bilder}</p:spTree></p:cSld></p:sld>`;
}

function rels(ziele: readonly { rid: string; datei: string }[]): string {
  const r = ziele
    .map((z) => `<Relationship Id="${z.rid}" Type="${URI_R}/image" Target="../media/${z.datei}"/>`)
    .join("");
  return `${KOPF}<Relationships xmlns="${URI_PKG_R}">${r}</Relationships>`;
}

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
    "ppt/slides/slide1.xml": enc(folie("Wartungsplan", ["rId9"])),
    "ppt/slides/slide2.xml": enc(folie("Anlage", ["rId9", "rId10"])),
    "ppt/slides/_rels/slide1.xml.rels": enc(rels([{ rid: "rId9", datei: "bild1.png" }])),
    "ppt/slides/_rels/slide2.xml.rels": enc(
      rels([
        { rid: "rId9", datei: "bild2.png" },
        { rid: "rId10", datei: "bild3.png" },
      ]),
    ),
    "ppt/media/bild1.png": new Uint8Array(bilder[0] ?? Buffer.alloc(0)),
    "ppt/media/bild2.png": new Uint8Array(bilder[1] ?? Buffer.alloc(0)),
    "ppt/media/bild3.png": new Uint8Array(bilder[2] ?? Buffer.alloc(0)),
  });
}

// ------------------------------------------------------------------------------------------------
// Ablesen
// ------------------------------------------------------------------------------------------------

interface Abgelesen {
  status: string | null;
  folie: string | null;
  text: string;
  zeile: string;
}

async function befundeAblesen(panel: Locator): Promise<Abgelesen[]> {
  return panel.locator("[data-testid=bild-befund]").evaluateAll((els) =>
    els.map((el) => ({
      status: el.getAttribute("data-status"),
      folie: el.getAttribute("data-folie"),
      text: el.querySelector("[data-testid=bild-befund-text]")?.textContent ?? "",
      zeile: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
    })),
  );
}

/**
 * Wartet, bis der Befund eines NEUEN Eingangs (`data-lauf` größer als `nachLauf`) fertig ist — so
 * wird nie der Befund des vorigen Eingangs derselben Datei abgelesen.
 */
async function wartenBisFertig(
  page: Page,
  nachLauf: number,
): Promise<{ status: string; lauf: number }> {
  let stand = { status: "laeuft", lauf: nachLauf };
  await expect
    .poll(
      async () => {
        const gelesen = await page.evaluate(() => {
          const el = document.querySelector("[data-testid=bild-befunde]");
          return el
            ? {
                status: el.getAttribute("data-status") ?? "fehlt",
                lauf: Number(el.getAttribute("data-lauf") ?? "0"),
              }
            : null;
        });
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

test("OCR-02 · PowerPoint und Bild werden beim Einlesen automatisch gelesen — Folie, Reihenfolge, Wiederverwendung", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await ensureLoggedIn(page);
  const cspMeldungen: string[] = [];
  page.on("console", (meldung) => {
    if (/Content Security Policy|Refused to/i.test(meldung.text())) {
      cspMeldungen.push(meldung.text());
    }
  });

  await page.goto("/erfassen?weg=datei");
  const eingang = page.locator('input[type="file"][accept*=".pptx"][accept*="image/*"]').first();
  await expect(eingang, "Dateiimport des Erfassens ist nicht da").toBeAttached({ timeout: 20_000 });

  const bilder = [];
  for (const b of BILDER) {
    bilder.push(await fiktivesBild(page, b.zeilen));
  }
  const pptx = deck(bilder);
  const protokoll: Record<string, unknown> = {
    art: "Technische OCR-Probe mit fiktiven Daten — keine Kundenabnahme",
    deck: { name: DECKNAME, bilder: BILDER.map((b) => ({ folie: b.folie, zeilen: b.zeilen })) },
  };

  // ── 1 · PowerPoint bereitstellen — KEIN Klick auf eine Erkennung ─────────────────────────────
  const beginn = Date.now();
  await eingang.setInputFiles({
    name: DECKNAME,
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: pptx,
  });
  const panel = page.getByTestId("bild-befunde").first();
  const lauf1 = await wartenBisFertig(page, 0);
  const status1 = lauf1.status;
  const befunde1 = await befundeAblesen(panel);
  const hinweise1 = await panel.getByTestId("bild-befund-hinweis").allTextContents();
  protokoll.ersterLauf = { ...lauf1, dauerMs: Date.now() - beginn, befunde: befunde1 };

  // ── 3 · dieselbe Datei noch einmal ────────────────────────────────────────────────────────────
  await eingang.setInputFiles({
    name: DECKNAME,
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: pptx,
  });
  const lauf2 = await wartenBisFertig(page, lauf1.lauf);
  const status2 = lauf2.status;
  const befunde2 = await befundeAblesen(panel);
  protokoll.zweiterLauf = { ...lauf2, befunde: befunde2 };

  // ── 4 · ein neues Einzelbild — ohne Klick ───────────────────────────────────────────────────
  await eingang.setInputFiles({
    name: BILDNAME,
    mimeType: "image/png",
    buffer: await fiktivesBild(page, EINZELBILD.zeilen),
  });
  const lauf3 = await wartenBisFertig(page, lauf2.lauf);
  const status3 = lauf3.status;
  const befunde3 = await befundeAblesen(panel);
  protokoll.einzelbild = { status: status3, befunde: befunde3 };
  protokoll.cspMeldungen = cspMeldungen;

  await test.info().attach("ocr02-bildautomatik.json", {
    contentType: "application/json",
    body: JSON.stringify(protokoll, null, 2),
  });

  expect(cspMeldungen, "CSP-Meldungen während der Erkennung").toEqual([]);

  // K3 · drei Befunde in Dokumentreihenfolge mit der richtigen Folie.
  expect(befunde1.map((b) => b.folie)).toEqual(["1", "2", "2"]);
  expect(befunde1.map((b) => b.status)).toEqual(["gelesen", "gelesen", "gelesen"]);
  expect(befunde1[0]?.zeile).toContain("Folie 1, Bild 1");
  expect(befunde1[1]?.zeile).toContain("Folie 2, Bild 1");
  expect(befunde1[2]?.zeile).toContain("Folie 2, Bild 2");
  // K2 · der Text steht NUR im Bild und ist erkannt — je Bild der eigene, nicht der eines anderen.
  BILDER.forEach((soll, i) => {
    const text = (befunde1[i]?.text ?? "").toUpperCase();
    expect(text, `Bild ${i + 1}`).toMatch(soll.wort);
    expect(text, `Bild ${i + 1}`).toMatch(soll.marke);
    for (const fremd of BILDER.filter((_, j) => j !== i)) {
      expect(text, `Bild ${i + 1} trägt fremden Text`).not.toMatch(fremd.marke);
    }
  });
  // K5 · eine PowerPoint-Quelle heißt nie „vollständig gelesen" (L16), und sie sagt warum.
  expect(status1).toBe("teilweise");
  expect(hinweise1.join(" ")).toContain("Folienlayout");

  // K4 · unverändert: dieselben Befunde, aber keine neue Erkennung.
  expect(befunde2.map((b) => b.text)).toEqual(befunde1.map((b) => b.text));
  for (const b of befunde2) {
    expect(b.zeile).toContain("unverändert — vorhandenes Ergebnis");
  }

  // K1 · das Einzelbild ist ohne Klick gelesen.
  expect(status3).toBe("vollstaendig");
  expect(befunde3).toHaveLength(1);
  expect(befunde3[0]?.status).toBe("gelesen");
  expect(befunde3[0]?.zeile).not.toContain("unverändert");
  const einzeltext = (befunde3[0]?.text ?? "").toUpperCase();
  expect(einzeltext).toMatch(EINZELBILD.wort);
  expect(einzeltext).toMatch(EINZELBILD.marke);
});

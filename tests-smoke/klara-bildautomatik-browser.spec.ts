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
  /** Zustand des Bildinhalts (W02): beschrieben, nicht-zulaessig, nicht-verfuegbar, … */
  inhalt: string | null;
  text: string;
  zeile: string;
  /** Erkannte Tabelle, Zeile für Zeile. */
  tabelle: string[][];
}

/** Der Befund des Dateiimports — andere Befundlisten der Seite (Editor, Anhänge) zählen nicht. */
const DATEI_BEFUND = "[data-testid=datei-bild-befunde] [data-testid=bild-befunde]";

async function befundeAblesen(panel: Locator): Promise<Abgelesen[]> {
  return panel.locator("[data-testid=bild-befund]").evaluateAll((els) =>
    els.map((el) => ({
      status: el.getAttribute("data-status"),
      folie: el.getAttribute("data-folie"),
      inhalt: el.getAttribute("data-bildinhalt"),
      text: el.querySelector("[data-testid=bild-befund-text]")?.textContent ?? "",
      zeile: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
      tabelle: [...el.querySelectorAll("[data-testid=bild-befund-tabelle] tr")].map((tr) =>
        [...tr.querySelectorAll("td")].map((td) => (td.textContent ?? "").trim()),
      ),
    })),
  );
}

/** Ohne beschriebenen Bildinhalt (W02) ist eine Quelle ehrlich „teilweise“ — sonst „vollständig“. */
function erwarteterEinzelstatus(befund: Abgelesen | undefined): string {
  return befund?.inhalt === "beschrieben" ? "vollstaendig" : "teilweise";
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
  const panel = page.locator(DATEI_BEFUND).first();
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

  // K4 · unverändert: dieselben Befunde, aber keine neue Erkennung — und derselbe ehrliche Status.
  expect(lauf2.status).toBe("teilweise");
  expect(befunde2.map((b) => b.text)).toEqual(befunde1.map((b) => b.text));
  for (const b of befunde2) {
    expect(b.zeile).toContain("unverändert — vorhandenes Ergebnis");
  }

  // K1 · das Einzelbild ist ohne Klick gelesen. „Vollständig“ nur mit beschriebenem Bildinhalt
  // (W02); fehlt er (kein Modell, Einstufung), steht der Grund am Bild und die Quelle ist „teilweise“.
  expect(befunde3).toHaveLength(1);
  expect(status3).toBe(erwarteterEinzelstatus(befunde3[0]));
  if (befunde3[0]?.inhalt !== "beschrieben") {
    expect(befunde3[0]?.zeile).toContain("Bildinhalt nicht analysiert");
  }
  expect(befunde3[0]?.status).toBe("gelesen");
  expect(befunde3[0]?.zeile).not.toContain("unverändert");
  const einzeltext = (befunde3[0]?.text ?? "").toUpperCase();
  expect(einzeltext).toMatch(EINZELBILD.wort);
  expect(einzeltext).toMatch(EINZELBILD.marke);
});

// ================================================================================================
// Nacharbeit 3 (Bens Befund 3) · LESBARE HANDSCHRIFT, UNLESERLICHE STELLE, BILDHAFTE TABELLE
// ================================================================================================
//
// KONTROLLIERTE VORLAGEN MIT BEKANNTEM INHALT, im Browser gezeichnet:
//   · Handschrift: Großbuchstaben und Ziffern als freihändige Striche (Tinte, Stiftbreite, leichte
//     Neigung, je Punkt ein fester, pseudozufälliger Versatz — also bei jedem Lauf dieselbe Vorlage).
//     Das ist eine nachgebildete Druckhandschrift, KEINE Schriftprobe eines Menschen; eine echte
//     Handschriftprobe liegt diesem Auftrag nicht vor und wird nicht behauptet.
//   · Unleserlich: nur Gekritzel. Erwartet: kein erfundener Text — entweder „kein Text“ oder jedes
//     Wort als unsicher/unleserlich gekennzeichnet.
//   · Tabelle: drei Spalten, drei Zeilen, ohne Linien. Erwartet: eine erkannte Tabelle 3 × 3.

/**
 * Striche je Zeichen im Kasten Breite 0,6 × Höhe 1 (y nach unten). Schreibweise: Punkte „x,y“ durch
 * Leerzeichen, Striche durch „|“ getrennt.
 */
const STRICHE: Record<string, string> = {
  T: "0,0 0.6,0|0.3,0 0.3,1",
  E: "0.55,0 0,0 0,1 0.55,1|0,0.5 0.45,0.5",
  I: "0.3,0 0.3,1",
  L: "0,0 0,1 0.55,1",
  H: "0,0 0,1|0.6,0 0.6,1|0,0.5 0.6,0.5",
  A: "0,1 0.3,0 0.6,1|0.12,0.62 0.48,0.62",
  "1": "0.15,0.2 0.35,0 0.35,1",
  "4": "0.45,1 0.45,0 0,0.65 0.6,0.65",
  "7": "0,0 0.6,0 0.2,1",
};

const HANDSCHRIFT = [
  { zeile: "TEIL 47", wort: /TEIL/, zahl: /\b47\b/ },
  { zeile: "HALT 71", wort: /HALT/, zahl: /\b71\b/ },
] as const;

const TABELLE = [
  ["TEIL", "MENGE", "PREIS"],
  ["VENTIL", "4", "12"],
  ["DICHTUNG", "10", "8"],
] as const;

/** Die Handschrift-Vorlage: freihändige Striche mit festem Versatz (immer dieselbe Vorlage). */
async function fiktiveHandschrift(page: Page, zeilen: readonly string[]): Promise<Buffer> {
  const b64 = await page.evaluate(
    ({ z, striche }) => {
      const hoehe = 90;
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 80 + z.length * 150;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("kein Canvas");
      }
      ctx.fillStyle = "#fbfaf4";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#1b2a6b";
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      let saat = 7;
      const versatz = (): number => {
        saat = (saat * 9301 + 49297) % 233280;
        return (saat / 233280 - 0.5) * 8;
      };
      z.forEach((zeile, n) => {
        let x = 60;
        const oben = 60 + n * 150;
        for (const zeichen of zeile) {
          const form = striche[zeichen];
          if (form) {
            for (const strich of form.split("|")) {
              ctx.beginPath();
              strich.split(" ").forEach((punkt, i) => {
                const [px = 0, py = 0] = punkt.split(",").map(Number);
                const gx = x + px * hoehe + (1 - py) * 10 + versatz();
                const gy = oben + py * hoehe + versatz();
                if (i === 0) {
                  ctx.moveTo(gx, gy);
                } else {
                  ctx.lineTo(gx, gy);
                }
              });
              ctx.stroke();
            }
          }
          x += zeichen === " " ? 0.7 * hoehe : 0.85 * hoehe;
        }
      });
      return canvas.toDataURL("image/png").split(",")[1] ?? "";
    },
    { z: zeilen, striche: STRICHE },
  );
  return Buffer.from(b64, "base64");
}

/** Nur Gekritzel — nichts darin ist lesbar. */
async function gekritzel(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 260;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("kein Canvas");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 3;
    let saat = 11;
    const zufall = (): number => {
      saat = (saat * 9301 + 49297) % 233280;
      return saat / 233280;
    };
    ctx.beginPath();
    ctx.moveTo(40, 130);
    for (let i = 0; i < 160; i += 1) {
      ctx.lineTo(40 + i * 5.6, 60 + zufall() * 140);
    }
    ctx.stroke();
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  });
  return Buffer.from(b64, "base64");
}

/** Eine bildhafte Tabelle ohne Linien: drei Spalten an festen Kanten. */
async function fiktiveTabelle(page: Page, zeilen: readonly (readonly string[])[]): Promise<Buffer> {
  const b64 = await page.evaluate((z) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1300;
    canvas.height = 80 + z.length * 120;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("kein Canvas");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 64px Arial, Helvetica, sans-serif";
    z.forEach((zeile, n) => {
      zeile.forEach((zelle, s) => {
        ctx.fillText(zelle, 60 + s * 450, 110 + n * 120);
      });
    });
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  }, zeilen);
  return Buffer.from(b64, "base64");
}

test("OCR-02 · Handschrift, unleserliche Stelle und bildhafte Tabelle werden automatisch gelesen und gekennzeichnet", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await ensureLoggedIn(page);
  await page.goto("/erfassen?weg=datei");
  const eingang = page.locator('input[type="file"][accept*=".pptx"][accept*="image/*"]').first();
  await expect(eingang, "Dateiimport des Erfassens ist nicht da").toBeAttached({ timeout: 20_000 });
  const panel = page.locator(DATEI_BEFUND).first();
  const protokoll: Record<string, unknown> = {
    art: "Technische OCR-Probe mit kontrollierten, fiktiven Vorlagen — keine Kundenabnahme",
    handschrift: HANDSCHRIFT.map((h) => h.zeile),
    tabelle: TABELLE,
  };

  // ── Handschrift ─────────────────────────────────────────────────────────────────────────────
  await eingang.setInputFiles({
    name: "fiktive-handschrift-ocr02.png",
    mimeType: "image/png",
    buffer: await fiktiveHandschrift(
      page,
      HANDSCHRIFT.map((h) => h.zeile),
    ),
  });
  const lauf1 = await wartenBisFertig(page, 0);
  const hand = await befundeAblesen(panel);
  protokoll.handschriftBefund = { ...lauf1, befunde: hand };

  // ── Gekritzel ───────────────────────────────────────────────────────────────────────────────
  await eingang.setInputFiles({
    name: "fiktives-gekritzel-ocr02.png",
    mimeType: "image/png",
    buffer: await gekritzel(page),
  });
  const lauf2 = await wartenBisFertig(page, lauf1.lauf);
  const kritzel = await befundeAblesen(panel);
  protokoll.gekritzelBefund = { ...lauf2, befunde: kritzel };

  // ── Tabelle ─────────────────────────────────────────────────────────────────────────────────
  await eingang.setInputFiles({
    name: "fiktive-tabelle-ocr02.png",
    mimeType: "image/png",
    buffer: await fiktiveTabelle(page, TABELLE),
  });
  const lauf3 = await wartenBisFertig(page, lauf2.lauf);
  const tabelle = await befundeAblesen(panel);
  protokoll.tabelleBefund = { ...lauf3, befunde: tabelle };

  await test.info().attach("ocr02-handschrift-tabelle.json", {
    contentType: "application/json",
    body: JSON.stringify(protokoll, null, 2),
  });

  // Handschrift: beide Zeilen mit Wort und Zahl erkannt — mit oder ohne Unsicherheitsmarke.
  expect(hand).toHaveLength(1);
  expect(hand[0]?.status).toBe("gelesen");
  const handtext = (hand[0]?.text ?? "").toUpperCase().replace(/\[\?([^\]]*)\]/g, "$1");
  for (const h of HANDSCHRIFT) {
    expect(handtext, `Handschrift „${h.zeile}“`).toMatch(h.wort);
    expect(handtext, `Handschrift „${h.zeile}“`).toMatch(h.zahl);
  }

  // Unleserlich: kein erfundener Text — nichts steht da, was nicht als unsicher markiert ist.
  expect(kritzel).toHaveLength(1);
  const ungekennzeichnet = (kritzel[0]?.text ?? "").replace(/\[[^\]]*\]/g, "").trim();
  expect(
    kritzel[0]?.status === "kein-text" || ungekennzeichnet === "",
    `Gekritzel ergab ungekennzeichneten Text: „${kritzel[0]?.text ?? ""}“`,
  ).toBe(true);

  // Tabelle: drei Zeilen, drei Spalten, an der richtigen Stelle.
  expect(tabelle).toHaveLength(1);
  const zellen = (tabelle[0]?.tabelle ?? []).map((zeile) => zeile.map((z) => z.toUpperCase()));
  expect(zellen).toHaveLength(TABELLE.length);
  TABELLE.forEach((soll, n) => {
    expect(zellen[n], `Tabellenzeile ${n + 1}`).toHaveLength(soll.length);
    soll.forEach((zelle, s) => {
      expect(zellen[n]?.[s], `Zelle ${n + 1}/${s + 1}`).toContain(zelle);
    });
  });
});

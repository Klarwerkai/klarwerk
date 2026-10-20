// ================================================================================================
// OCR-04 · ECHTE DOKUMENT-/BILDWEGE PRÜFEN — im echten Browser gegen den Smoke-Server, mit der
// ECHTEN Texterkennung (W01, tesseract.js unter der eigenen CSP).
// ================================================================================================
//
// Auftrag produkt:20261012:klara-bildanalyse-ocr-hostpruefung, K1–K4. Die Nachweise sind GETRENNT,
// damit ein Teil nie einen anderen mitbelegt (K2):
//
//   1. AUTOMATIK — Bild und PowerPoint werden über den Dateiimport bereitgestellt; ohne Klick
//      beginnt das Lesen („läuft“) und endet für jedes Bild. Der erkannte Text wird hier NICHT bewertet.
//   2. GENAUIGKEIT — kontrollierte Vorlagen mit bekanntem Text: Screenshot, reines Textbild (Umlaute,
//      ß, Zahlen), PowerPoint mit vier eingebetteten Bildern auf drei Folien (Umlaute, Zahlen, Folie
//      und Bild je Text). Schwierige Vorlagen (gedrehter Text, schwacher Kontrast): kein
//      ungekennzeichnet erfundener Text. Handschrift, unleserliche Stelle und bildhafte Tabelle misst
//      unverändert `klara-bildautomatik-browser.spec.ts` (OCR-02, zweiter Fall).
//   3. ÄNDERUNG UND QUELLWECHSEL — dieselbe PowerPoint mit einem ausgetauschten Bild: der neue Text
//      steht an seiner Fundstelle, der alte nirgends; unveränderte Bilder werden wiederverwendet.
//      Danach ein anderes Bild: Klaras Fundstellen und Zusammenfassung nennen nur noch dieses.
//   4./5. NUTZUNG DURCH KLARA MIT MODELL (@modell, nur im vollen Smoke) — ein DIREKTES Bild (im
//      Editor eines „intern“ eingestuften Entwurfs) und eine PowerPoint-DATEI mit eingebetteten
//      Bildern (als Anhang eines „intern“ eingestuften Artikels, Office im Artikel): Klara antwortet
//      mit dem Modell auf Text, der NUR im Bild steht. Fehlt ein nutzbares Modell, ist der Fall ROT.
//
// WARUM DER DATEIIMPORT NICHT DER MODELLWEG IST: eine Datei im Erfassen gehört noch zu keinem
// gespeicherten Entwurf; ohne Anker gilt sie serverseitig fail-safe als vertraulich und erreicht kein
// Cloud-Modell (`lib/reasonerProvenance.ts`, JOB 2692 D2). Das ist richtig so und wird hier nicht
// umgangen — der Modellweg läuft über die eingestuften Flächen Editor und Artikel.
//
// Prüfer der Befunde ist `tests/klara-bildanalyse-ocr/abnahme.ts` (Auslassung, falsche Fundstelle,
// fremder und veralteter Text); dass er diese Mängel erkennt, belegen seine Gegenproben in
// `tests/klara-bildanalyse-ocr/ocr04-abnahme.test.ts`.
//
// ALLE BILDER UND DATEIEN SIND FIKTIV: im Browser auf ein `<canvas>` gezeichnet. ZUSTANDSANLEGEND
// (Entwurf, Artikel, Objekt in den Modellfällen) — läuft deshalb ausschließlich im isolierten Kontext
// `chromium-zustand` (`ZUSTAND_SPEC` in `playwright.smoke.config.ts`). Protokolle und die Vorlagen
// hängen als Anhänge am Bericht, gleich wie der Fall ausgeht.
import { type Locator, type Page, expect, test } from "@playwright/test";
import {
  type IstBild,
  type SollBild,
  enthaeltBegriff,
  erfundeneWoerter,
  genauigkeit,
  pruefeBefunde,
} from "../tests/klara-bildanalyse-ocr/abnahme";
import { ensureLoggedIn } from "./support/auth";

// ------------------------------------------------------------------------------------------------
// Kontrollierte Vorlagen
// ------------------------------------------------------------------------------------------------

interface Zeile {
  text: string;
  x: number;
  y: number;
  schrift: string;
  farbe: string;
}

interface Vorlage {
  breite: number;
  hoehe: number;
  hintergrund: string;
  /** Flächen ohne Text — Fensterleiste, Seitenleiste, Knopf eines Screenshots. */
  flaechen?: { x: number; y: number; b: number; h: number; farbe: string }[];
  zeilen: Zeile[];
  /** Drehung des Textes in Grad um die Bildmitte. */
  drehung?: number;
}

interface Farben {
  hintergrund: string;
  schrift: string;
}

const FETT = "bold 80px Arial, Helvetica, sans-serif";
const NORMAL = "48px Arial, sans-serif";
const SCHWARZ_AUF_WEISS: Farben = { hintergrund: "#ffffff", schrift: "#000000" };
/** Hellgrau auf Grau — schwacher Kontrast. */
const GRAU_AUF_GRAU: Farben = { hintergrund: "#c4c4c4", schrift: "#a6a6a6" };

/** Zwei Textzeilen in fetter Schrift — Grundform von Textbild, gedrehtem Text und Kontrastbild. */
function zweiZeilen(oben: string, unten: string, farben = SCHWARZ_AUF_WEISS): Vorlage {
  return {
    breite: 1200,
    hoehe: 380,
    hintergrund: farben.hintergrund,
    zeilen: [
      { text: oben, x: 100, y: 150, schrift: FETT, farbe: farben.schrift },
      { text: unten, x: 100, y: 290, schrift: FETT, farbe: farben.schrift },
    ],
  };
}

const SCREENSHOT: Vorlage = {
  breite: 1280,
  hoehe: 720,
  hintergrund: "#eef1f5",
  flaechen: [
    { x: 0, y: 0, b: 1280, h: 64, farbe: "#2b3a55" },
    { x: 0, y: 64, b: 240, h: 656, farbe: "#d9dee7" },
    { x: 280, y: 110, b: 940, h: 540, farbe: "#ffffff" },
    { x: 320, y: 520, b: 280, h: 76, farbe: "#1f6feb" },
  ],
  zeilen: [
    { text: "Auftrag 4711", x: 330, y: 200, schrift: NORMAL, farbe: "#111111" },
    { text: "Fällig 15.11.2026", x: 330, y: 290, schrift: NORMAL, farbe: "#111111" },
    { text: "Prüfung offen", x: 330, y: 380, schrift: NORMAL, farbe: "#111111" },
    { text: "Speichern", x: 350, y: 570, schrift: "36px Arial, sans-serif", farbe: "#ffffff" },
  ],
};
const SCREENSHOT_BEGRIFFE = ["Auftrag", "4711", "Fällig", "15.11.2026", "Prüfung", "offen"];

const TEXTBILD = zweiZeilen("Schlüssel 58", "Füllstand 93");
const TEXTBILD_BEGRIFFE = ["Schlüssel", "58", "Füllstand", "93"];

const GEDREHT: Vorlage = { ...zweiZeilen("VENTIL 38", "DRUCK 72"), drehung: 6 };
const GEDREHT_VORLAGE = ["VENTIL 38", "DRUCK 72"];

const KONTRAST = zweiZeilen("LAGER 54", "PUMPE 16", GRAU_AUF_GRAU);
const KONTRAST_VORLAGE = ["LAGER 54", "PUMPE 16"];

/** Ein Bild mit einer Zeile — für die eingebetteten Bilder der PowerPoint. */
const einzeilig = (text: string): Vorlage => ({
  breite: 1200,
  hoehe: 230,
  hintergrund: "#ffffff",
  zeilen: [{ text, x: 60, y: 140, schrift: FETT, farbe: "#000000" }],
});

/** Zeichnet die Vorlage im Browser und gibt die PNG-Bytes zurück. */
async function zeichne(page: Page, v: Vorlage): Promise<Buffer> {
  const b64 = await page.evaluate((vorlage) => {
    const canvas = document.createElement("canvas");
    canvas.width = vorlage.breite;
    canvas.height = vorlage.hoehe;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("kein Canvas");
    }
    ctx.fillStyle = vorlage.hintergrund;
    ctx.fillRect(0, 0, vorlage.breite, vorlage.hoehe);
    for (const f of vorlage.flaechen ?? []) {
      ctx.fillStyle = f.farbe;
      ctx.fillRect(f.x, f.y, f.b, f.h);
    }
    if (vorlage.drehung) {
      ctx.translate(vorlage.breite / 2, vorlage.hoehe / 2);
      ctx.rotate((vorlage.drehung * Math.PI) / 180);
      ctx.translate(-vorlage.breite / 2, -vorlage.hoehe / 2);
    }
    for (const z of vorlage.zeilen) {
      ctx.font = z.schrift;
      ctx.fillStyle = z.farbe;
      ctx.fillText(z.text, z.x, z.y);
    }
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  }, v);
  return Buffer.from(b64, "base64");
}

// ------------------------------------------------------------------------------------------------
// Eine PowerPoint mit beliebig vielen Folien und Bildern (ZIP ohne Kompression, OOXML-Bausteine wie
// in `klara-bildautomatik-browser.spec.ts`)
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

interface Folie {
  /** Editierbarer Folientext — die Bildtexte stehen NIE darin. */
  titel: string;
  bilder: Buffer[];
}

function deck(folien: readonly Folie[]): Buffer {
  let ids = "";
  let ziele = "";
  for (let i = 0; i < folien.length; i += 1) {
    const ziel = `slides/slide${i + 1}.xml`;
    ids += `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`;
    ziele += `<Relationship Id="rId${i + 1}" Type="${URI_R}/slide" Target="${ziel}"/>`;
  }
  const eintraege: Record<string, Uint8Array> = {
    "[Content_Types].xml": enc(
      `${KOPF}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/></Types>`,
    ),
    "_rels/.rels": enc(
      `${KOPF}<Relationships xmlns="${URI_PKG_R}"><Relationship Id="rId1" Type="${URI_R}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    ),
    "ppt/presentation.xml": enc(
      `${KOPF}<p:presentation xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:sldIdLst>${ids}</p:sldIdLst></p:presentation>`,
    ),
    "ppt/_rels/presentation.xml.rels": enc(
      `${KOPF}<Relationships xmlns="${URI_PKG_R}">${ziele}</Relationships>`,
    ),
  };
  let medien = 0;
  folien.forEach((f, i) => {
    const titel = `<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${f.titel}</a:t></a:r></a:p></p:txBody></p:sp>`;
    const rels: string[] = [];
    const bilder: string[] = [];
    f.bilder.forEach((bytes, j) => {
      medien += 1;
      const rid = `rId${10 + j}`;
      const datei = `bild${medien}.png`;
      eintraege[`ppt/media/${datei}`] = new Uint8Array(bytes);
      rels.push(`<Relationship Id="${rid}" Type="${URI_R}/image" Target="../media/${datei}"/>`);
      bilder.push(`<p:pic><p:blipFill><a:blip r:embed="${rid}"/></p:blipFill></p:pic>`);
    });
    eintraege[`ppt/slides/slide${i + 1}.xml`] = enc(
      `${KOPF}<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:cSld><p:spTree>${titel}${bilder.join("")}</p:spTree></p:cSld></p:sld>`,
    );
    eintraege[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = enc(
      `${KOPF}<Relationships xmlns="${URI_PKG_R}">${rels.join("")}</Relationships>`,
    );
  });
  return zipOhneKompression(eintraege);
}

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const DECKNAME = "fiktive-wartung-ocr04.pptx";
const DECKNAME_GEAENDERT = "fiktive-wartung-ocr04-neu.pptx";
const TEXTBILDNAME = "fiktives-textbild-ocr04.png";

/** Die PowerPoint: je eingebettetem Bild Folie, Position, Text und bekannte Begriffe. */
const DECK_BILDER = [
  { folie: 1, bild: 1, text: "Prüfstand 47", begriffe: ["Prüfstand", "47"] },
  { folie: 2, bild: 1, text: "Ölwechsel 83", begriffe: ["Ölwechsel", "83"] },
  { folie: 2, bild: 2, text: "Größe 29", begriffe: ["Größe", "29"] },
  { folie: 3, bild: 1, text: "Übergabe 61", begriffe: ["Übergabe", "61"] },
] as const;
const FOLIENTITEL = ["Wartungsplan", "Anlage", "Abschluss"];
const SOLL_DECK: SollBild[] = DECK_BILDER.map((b) => ({
  ort: `Folie ${b.folie}, Bild ${b.bild}`,
  begriffe: [...b.begriffe],
}));

/** Dasselbe Deck nach dem Austausch des dritten Bildes (Folie 2, Bild 2). */
const GEAENDERT: Record<number, string> = { 2: "Größe 31" };
const SOLL_DECK_GEAENDERT: SollBild[] = SOLL_DECK.map((s) =>
  s.ort === "Folie 2, Bild 2" ? { ort: s.ort, begriffe: ["Größe", "31"], frueher: ["29"] } : s,
);

/** Baut die PowerPoint; `ersatz` tauscht den Text einzelner Bilder (Index in `DECK_BILDER`). */
async function baueDeck(page: Page, ersatz: Record<number, string> = {}): Promise<Buffer> {
  const folien: Folie[] = FOLIENTITEL.map((titel) => ({ titel, bilder: [] }));
  for (const [i, b] of DECK_BILDER.entries()) {
    const bytes = await zeichne(page, einzeilig(ersatz[i] ?? b.text));
    folien[b.folie - 1]?.bilder.push(bytes);
  }
  return deck(folien);
}

// ------------------------------------------------------------------------------------------------
// Ablesen
// ------------------------------------------------------------------------------------------------

const DATEI = "[data-testid=datei-bild-befunde]";
const DATEI_BEFUND = `${DATEI} [data-testid=bild-befunde]`;
const DATEI_KLARA = `${DATEI} [data-testid=klara-bild-kontext]`;
const RUMPF_BEFUND = "[data-testid=rumpf-bild-befunde] [data-testid=bild-befunde]";
const RUMPF_KLARA = "[data-testid=rumpf-bild-befunde] [data-testid=klara-bild-kontext]";
const OFFICE_BEFUND = "[data-testid=office-bild-befunde] [data-testid=bild-befunde]";
const OFFICE_KLARA = "[data-testid=office-bild-befunde] [data-testid=klara-bild-kontext]";

interface Abgelesen extends IstBild {
  status: string | null;
  zeile: string;
}

/** Je Befund: Fundstelle im Wortlaut, Status, angezeigter (gekennzeichneter) Text, ganze Zeile. */
async function befundeAblesen(panel: Locator): Promise<Abgelesen[]> {
  return panel.locator("[data-testid=bild-befund]").evaluateAll((els) =>
    els.map((el) => ({
      ort: (el.querySelector(":scope > span")?.textContent ?? "").trim(),
      status: el.getAttribute("data-status"),
      text: el.querySelector("[data-testid=bild-befund-text]")?.textContent ?? "",
      zeile: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
    })),
  );
}

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

/** Wartet, bis eine Befundliste (Editor, Artikel) erschienen ist und nicht mehr liest. */
async function wartenBisGelesen(page: Page, auswahl: string): Promise<string> {
  let status = "wartet";
  await expect
    .poll(
      async () => {
        const gelesen = await page.evaluate(
          (a) => document.querySelector(a)?.getAttribute("data-status") ?? null,
          auswahl,
        );
        status = gelesen ?? "wartet";
        return status;
      },
      { timeout: 240_000, intervals: [1_000] },
    )
    .not.toMatch(/^(wartet|laeuft)$/);
  return status;
}

async function dateiimportOeffnen(page: Page): Promise<Locator> {
  await ensureLoggedIn(page);
  await page.goto("/erfassen?weg=datei");
  const eingang = page.locator('input[type="file"][accept*=".pptx"][accept*="image/*"]').first();
  await expect(eingang, "Dateiimport des Erfassens ist nicht da").toBeAttached({ timeout: 20_000 });
  return eingang;
}

interface Beleg {
  art: string | null;
  text: string;
}

interface KlaraErgebnis {
  /** Die formulierte Antwort — leer ohne Modell. */
  antwort: string;
  ohneModell: number;
  belege: Beleg[];
}

/** Frage bzw. Zusammenfassung an Klara; liefert Antworttext und die Fundstellen der Antwort. */
async function klaraFragen(
  panel: Locator,
  auftrag: "frage" | "zusammenfassung",
  frage = "",
): Promise<KlaraErgebnis> {
  if (auftrag === "frage") {
    await panel.getByTestId("klara-bild-kontext-frage").fill(frage);
    await panel.getByTestId("klara-bild-kontext-fragen").click();
  } else {
    await panel.getByTestId("klara-bild-kontext-zusammenfassen").click();
  }
  await expect(panel.getByTestId("klara-bild-kontext-antwort")).toHaveAttribute(
    "data-auftrag",
    auftrag,
    { timeout: 180_000 },
  );
  const text = panel.getByTestId("klara-bild-kontext-antworttext");
  const belege = await panel
    .getByTestId("klara-bild-kontext-beleg")
    .evaluateAll((els) =>
      els.map((el) => ({ art: el.getAttribute("data-art"), text: el.textContent ?? "" })),
    );
  return {
    antwort: (await text.count()) > 0 ? ((await text.textContent()) ?? "") : "",
    ohneModell: await panel.getByTestId("klara-bild-kontext-ohne-modell").count(),
    belege,
  };
}

async function anhang(name: string, inhalt: unknown): Promise<void> {
  await test.info().attach(name, {
    contentType: "application/json",
    body: JSON.stringify(inhalt, null, 2),
  });
}

async function vorlageAnhaengen(name: string, bytes: Buffer): Promise<void> {
  await test.info().attach(name, { contentType: "image/png", body: bytes });
}

// ================================================================================================
// 1 · AUTOMATIK — Start und Ende ohne Klick; der Text wird hier nicht bewertet
// ================================================================================================

type MitStaenden = Window & { __ocr04Staende: string[] };

test("OCR-04 · Automatik: Bild und PowerPoint werden ohne Klick gelesen (Start und Ende, ohne Textbewertung)", async ({
  page,
}) => {
  test.setTimeout(600_000);
  const eingang = await dateiimportOeffnen(page);
  // Jeder sichtbare Stand des Befunds je Eingang (`data-lauf`), vom Einfügen an — ein Beobachter
  // im Dokument. Je Lauf getrennt, damit der Befund des vorigen Eingangs nie als Anfang zählt.
  await page.evaluate((auswahl) => {
    const w = window as unknown as MitStaenden;
    w.__ocr04Staende = [];
    new MutationObserver(() => {
      const el = document.querySelector(auswahl);
      const s = el?.getAttribute("data-status");
      const eintrag = `${el?.getAttribute("data-lauf") ?? ""}|${s ?? ""}`;
      const liste = w.__ocr04Staende;
      if (s && liste[liste.length - 1] !== eintrag) {
        liste.push(eintrag);
      }
    }).observe(document.body, { subtree: true, childList: true, attributes: true });
  }, DATEI_BEFUND);
  /** Die Stände genau eines Eingangs, in der Reihenfolge ihres Erscheinens. */
  const staende = async (lauf: number): Promise<string[]> => {
    const alle = await page.evaluate(() => (window as unknown as MitStaenden).__ocr04Staende);
    return alle.filter((e) => e.startsWith(`${lauf}|`)).map((e) => e.slice(e.indexOf("|") + 1));
  };
  const panel = page.locator(DATEI_BEFUND).first();
  const protokoll: Record<string, unknown> = {
    art: "Automatikprobe mit fiktiven Daten — bewertet Start und Ende, nicht den Text",
  };

  // PowerPoint — kein Klick, nur bereitstellen.
  await eingang.setInputFiles({
    name: DECKNAME,
    mimeType: PPTX_MIME,
    buffer: await baueDeck(page),
  });
  const lauf1 = await wartenBisFertig(page, 0);
  const deckBefunde = await befundeAblesen(panel);
  const deckStaende = await staende(lauf1.lauf);
  const deckBilder = deckBefunde.map((b) => b.status);
  protokoll.powerpoint = { ...lauf1, staende: deckStaende, bilder: deckBilder };

  // Ein Bild — kein Klick.
  await eingang.setInputFiles({
    name: TEXTBILDNAME,
    mimeType: "image/png",
    buffer: await zeichne(page, TEXTBILD),
  });
  const lauf2 = await wartenBisFertig(page, lauf1.lauf);
  const bildBefunde = await befundeAblesen(panel);
  const bildStaende = await staende(lauf2.lauf);
  protokoll.bild = { ...lauf2, staende: bildStaende, bilder: bildBefunde.map((b) => b.status) };
  await anhang("ocr04-automatik.json", protokoll);

  // Das Lesen begann von selbst („läuft“) und endete — für jedes der vier eingebetteten Bilder.
  expect(deckStaende[0], "der Befund erschien nicht als laufend").toBe("laeuft");
  expect(deckBefunde).toHaveLength(DECK_BILDER.length);
  for (const b of deckBefunde) {
    expect(["gelesen", "kein-text"], `${b.ort}: ${b.status}`).toContain(b.status);
  }
  // PowerPoint heißt nie „vollständig“ (L16) — abgeschlossen ist sie trotzdem.
  expect(lauf1.status).toBe("teilweise");
  expect(bildStaende[0], "der Befund des Bildes erschien nicht als laufend").toBe("laeuft");
  expect(bildBefunde).toHaveLength(1);
  expect(["gelesen", "kein-text"]).toContain(bildBefunde[0]?.status);
  expect(["teilweise", "vollstaendig"]).toContain(lauf2.status);
});

// ================================================================================================
// 2 · GENAUIGKEIT — kontrollierte Vorlagen mit bekanntem Text
// ================================================================================================

test("OCR-04 · Genauigkeit: Screenshot, Textbild und PowerPoint mit Umlauten und Zahlen; gedreht und schwacher Kontrast ohne erfundenen Text", async ({
  page,
}) => {
  test.setTimeout(900_000);
  const eingang = await dateiimportOeffnen(page);
  const panel = page.locator(DATEI_BEFUND).first();
  const protokoll: Record<string, unknown> = {
    art: "Genauigkeitsprobe mit kontrollierten, fiktiven Vorlagen — keine Kundenabnahme",
  };
  let lauf = 0;
  const lies = async (name: string, mimeType: string, buffer: Buffer): Promise<Abgelesen[]> => {
    await eingang.setInputFiles({ name, mimeType, buffer });
    const stand = await wartenBisFertig(page, lauf);
    lauf = stand.lauf;
    return befundeAblesen(panel);
  };

  const screenshot = await zeichne(page, SCREENSHOT);
  const textbild = await zeichne(page, TEXTBILD);
  const gedreht = await zeichne(page, GEDREHT);
  const kontrast = await zeichne(page, KONTRAST);
  await vorlageAnhaengen("ocr04-vorlage-screenshot.png", screenshot);
  await vorlageAnhaengen("ocr04-vorlage-textbild.png", textbild);
  await vorlageAnhaengen("ocr04-vorlage-gedreht.png", gedreht);
  await vorlageAnhaengen("ocr04-vorlage-kontrast.png", kontrast);

  const s = await lies("fiktiver-screenshot-ocr04.png", "image/png", screenshot);
  const tb = await lies(TEXTBILDNAME, "image/png", textbild);
  const g = await lies("fiktiv-gedreht-ocr04.png", "image/png", gedreht);
  const k = await lies("fiktiv-kontrast-ocr04.png", "image/png", kontrast);
  const d = await lies(DECKNAME, PPTX_MIME, await baueDeck(page));

  const schwierig = [
    { name: "gedreht", befund: g, vorlage: GEDREHT_VORLAGE },
    { name: "schwacher Kontrast", befund: k, vorlage: KONTRAST_VORLAGE },
  ];
  const maengelDeck = pruefeBefunde(SOLL_DECK, d);
  protokoll.screenshot = { befund: s, ...genauigkeit(SCREENSHOT_BEGRIFFE, s[0]?.text ?? "") };
  protokoll.textbild = { befund: tb, ...genauigkeit(TEXTBILD_BEGRIFFE, tb[0]?.text ?? "") };
  protokoll.schwierig = schwierig.map((x) => ({
    ...x,
    erfunden: erfundeneWoerter(x.befund[0]?.text ?? "", x.vorlage),
    ...genauigkeit(x.vorlage.join(" ").split(" "), x.befund[0]?.text ?? ""),
  }));
  protokoll.powerpoint = {
    befund: d,
    soll: SOLL_DECK,
    maengel: maengelDeck,
    folientext: FOLIENTITEL,
  };
  await anhang("ocr04-genauigkeit.json", protokoll);

  // Klar lesbar: jeder bekannte Begriff ist erkannt — Zahlen, Datum, Umlaute und ß wörtlich.
  expect(s).toHaveLength(1);
  expect(s[0]?.status).toBe("gelesen");
  expect(genauigkeit(SCREENSHOT_BEGRIFFE, s[0]?.text ?? "").fehlend, "Screenshot").toEqual([]);
  expect(tb).toHaveLength(1);
  expect(tb[0]?.status).toBe("gelesen");
  expect(genauigkeit(TEXTBILD_BEGRIFFE, tb[0]?.text ?? "").fehlend, "Textbild").toEqual([]);
  // PowerPoint: jedes der vier Bilder an seiner Folie mit SEINEM Text — keine Auslassung, keine
  // falsche Fundstelle, kein fremder Text. Der Bildtext steht nicht im Folientext.
  expect(maengelDeck, "PowerPoint").toEqual([]);
  for (const titel of FOLIENTITEL) {
    for (const b of DECK_BILDER) {
      expect(enthaeltBegriff(titel, b.begriffe[0])).toBe(false);
    }
  }
  // Schwierig: gelesen oder ehrlich „kein Text“ — aber nichts Falsches ohne Kennzeichnung.
  for (const { name, befund, vorlage } of schwierig) {
    expect(befund, name).toHaveLength(1);
    expect(["gelesen", "kein-text"], name).toContain(befund[0]?.status);
    const erfunden = erfundeneWoerter(befund[0]?.text ?? "", vorlage);
    expect(erfunden, `${name}: ungekennzeichnet falscher Text`).toEqual([]);
  }
});

// ================================================================================================
// 3 · ÄNDERUNG, WIEDERVERWENDUNG, QUELLWECHSEL — kein veralteter Befund, keine fremde Fundstelle
// ================================================================================================

test("OCR-04 · Änderung und Quellwechsel: neuer Text an seiner Fundstelle, kein veralteter Befund, Klara nennt nur die aktuelle Quelle", async ({
  page,
}) => {
  test.setTimeout(900_000);
  const eingang = await dateiimportOeffnen(page);
  const panel = page.locator(DATEI_BEFUND).first();
  const klara = page.locator(DATEI_KLARA).first();
  const protokoll: Record<string, unknown> = {
    art: "Änderungs- und Quellwechselprobe mit fiktiven Daten — keine Kundenabnahme",
  };

  await eingang.setInputFiles({
    name: DECKNAME,
    mimeType: PPTX_MIME,
    buffer: await baueDeck(page),
  });
  const lauf1 = await wartenBisFertig(page, 0);
  const vorher = await befundeAblesen(panel);

  // Dieselbe Präsentation, ein Bild ausgetauscht (Folie 2, Bild 2: „Größe 29“ → „Größe 31“).
  await eingang.setInputFiles({
    name: DECKNAME_GEAENDERT,
    mimeType: PPTX_MIME,
    buffer: await baueDeck(page, GEAENDERT),
  });
  const lauf2 = await wartenBisFertig(page, lauf1.lauf);
  const nachher = await befundeAblesen(panel);
  const maengel = pruefeBefunde(SOLL_DECK_GEAENDERT, nachher);
  // Klara zur geänderten Datei: die Fundstelle der Frage ist das neue Bild, mit dem neuen Text.
  const zumDeck = await klaraFragen(klara, "frage", "Welche Größe steht dort?");

  // Quellwechsel: ein anderes Bild. Klara kennt danach nur noch dieses.
  await eingang.setInputFiles({
    name: TEXTBILDNAME,
    mimeType: "image/png",
    buffer: await zeichne(page, TEXTBILD),
  });
  const lauf3 = await wartenBisFertig(page, lauf2.lauf);
  const bild = await befundeAblesen(panel);
  await expect(klara.getByTestId("klara-bild-kontext-antwort")).toHaveCount(0);
  const zumBild = await klaraFragen(klara, "frage", "Wie hoch ist der Füllstand?");
  await klaraFragen(klara, "zusammenfassung");
  const bilderZeile = (await klara.getByTestId("klara-bild-kontext-bilder").textContent()) ?? "";

  protokoll.vorher = { ...lauf1, befunde: vorher };
  protokoll.nachher = { ...lauf2, befunde: nachher, soll: SOLL_DECK_GEAENDERT, maengel };
  protokoll.klaraZumDeck = zumDeck;
  protokoll.quellwechsel = { ...lauf3, befunde: bild, klara: zumBild, bilderZeile };
  await anhang("ocr04-aenderung-quellwechsel.json", protokoll);

  // Änderung: der neue Text an seiner Fundstelle, der alte nirgends (kein veralteter Befund).
  expect(maengel).toEqual([]);
  expect(nachher.some((b) => enthaeltBegriff(b.text, "29"))).toBe(false);
  // Wiederverwendung: nur das geänderte Bild wurde neu gelesen.
  for (const b of nachher) {
    const unveraendert = b.zeile.includes("unverändert — vorhandenes Ergebnis");
    expect(unveraendert, b.ort).toBe(b.ort !== "Folie 2, Bild 2");
  }
  // Klara zur geänderten Datei: Folie 2, Bild 2 mit 31 — nie mit 29.
  expect(zumDeck.belege[0]?.art).toBe("bild");
  expect(zumDeck.belege[0]?.text).toContain(`${DECKNAME_GEAENDERT} · Folie 2, Bild 2`);
  expect(enthaeltBegriff(zumDeck.belege[0]?.text ?? "", "31")).toBe(true);
  expect(zumDeck.belege.some((b) => enthaeltBegriff(b.text, "29"))).toBe(false);
  // Quellwechsel: Fundstellen und Zusammenfassung nennen nur das neue Bild.
  expect(bild).toHaveLength(1);
  expect(zumBild.belege.length).toBeGreaterThan(0);
  for (const b of zumBild.belege) {
    expect(b.text).toContain(TEXTBILDNAME);
    expect(b.text).not.toContain(DECKNAME_GEAENDERT);
  }
  expect(enthaeltBegriff(zumBild.belege[0]?.text ?? "", "93")).toBe(true);
  expect(bilderZeile).toContain(TEXTBILDNAME);
  expect(bilderZeile).not.toContain(DECKNAME_GEAENDERT);
});

// ================================================================================================
// 4 · 5 · NUTZUNG DURCH KLARA MIT DEM MODELL (@modell)
// ================================================================================================
//
// Nur im VOLLEN Smoke (`npm run smoke:ui`, Zugang ausschließlich über die Betreiber-Einspeisung
// KLARWERK_SHIP_SMOKE_API_KEY). Kein Überspringen: fehlt ein nutzbares Modell für „assist“, ist der
// Fall ROT; eine fehlende oder leere Antwort lässt ihn nie bestehen. Die Grundfreigabe der Instanz
// wird wie in `klara-bild-kontext-browser.spec.ts` gesetzt und danach wiederhergestellt.

interface Zuordnung {
  global: string;
  perTask: Record<string, string>;
  kiFreigabe?: { oeffentlicheKi?: boolean; vertraulicheInhalte?: boolean };
}

interface ModellStatus {
  active?: boolean;
  reachable?: string;
  kiAbgeschaltet?: boolean;
  extern?: string;
  tasks?: { assist?: boolean };
}

async function zuordnungLesen(admin: Page): Promise<Zuordnung> {
  const antwort = await admin.request.get("/api/reasoner/config");
  expect(antwort.status(), await antwort.text()).toBe(200);
  return ((await antwort.json()) as { taskConfig: Zuordnung }).taskConfig;
}

async function freigabeSetzen(
  admin: Page,
  basis: Zuordnung,
  kiFreigabe: { oeffentlicheKi: boolean; vertraulicheInhalte: boolean },
): Promise<void> {
  const antwort = await admin.request.put("/api/reasoner/config", {
    data: { global: basis.global, perTask: basis.perTask, kiFreigabe },
  });
  expect(antwort.status(), await antwort.text()).toBe(200);
}

/** Setzt die Grundfreigabe, prüft das Modell für „assist“ und stellt die Freigabe danach zurück. */
async function mitModell(
  page: Page,
  protokoll: Record<string, unknown>,
  lauf: () => Promise<void>,
): Promise<void> {
  await ensureLoggedIn(page);
  const vorher = await zuordnungLesen(page);
  await freigabeSetzen(page, vorher, { oeffentlicheKi: true, vertraulicheInhalte: false });
  try {
    const status = (await (await page.request.get("/api/reasoner/status")).json()) as ModellStatus;
    protokoll.modellstatus = status;
    expect(status.extern, "die Grundfreigabe ist nicht wirksam").toBe("frei");
    expect(
      status.active === true &&
        status.tasks?.assist === true &&
        status.kiAbgeschaltet !== true &&
        status.reachable !== "unreachable",
      `Kein nutzbares Modell für „assist“ (Status ${JSON.stringify(status)}) — der volle Smoke braucht KLARWERK_SHIP_SMOKE_API_KEY.`,
    ).toBe(true);
    await lauf();
  } finally {
    await freigabeSetzen(page, vorher, {
      oeffentlicheKi: vorher.kiFreigabe?.oeffentlicheKi === true,
      vertraulicheInhalte: vorher.kiFreigabe?.vertraulicheInhalte === true,
    });
  }
}

test("OCR-04 · direktes Bild: Klara antwortet mit dem Modell auf den automatisch gelesenen Text @modell", async ({
  page,
}) => {
  test.setTimeout(600_000);
  const protokoll: Record<string, unknown> = {
    art: "Modelllauf mit einem fiktiven Screenshot — keine Kundenabnahme",
    begriffe: SCREENSHOT_BEGRIFFE,
  };
  const entwurf: { id: string | null } = { id: null };
  try {
    await mitModell(page, protokoll, async () => {
      await page.goto("/");
      const screenshot = await zeichne(page, SCREENSHOT);
      await vorlageAnhaengen("ocr04-modell-screenshot.png", screenshot);
      // Ein fiktiver, ausdrücklich „intern“ eingestufter Entwurf, der NUR das Bild enthält.
      const angelegt = await page.request.post("/api/drafts", {
        data: {
          title: "Fiktiver Screenshot OCR-04",
          statement: "Fiktiver Entwurf für die Klara-Bildprobe.",
          type: "best_practice",
          category: "Anlage 1",
          confidentiality: "intern",
          bodyHtml: `<figure><img src="data:image/png;base64,${screenshot.toString("base64")}"></figure>`,
        },
      });
      expect(angelegt.status(), await angelegt.text()).toBe(201);
      entwurf.id = ((await angelegt.json()) as { id: string }).id;

      // Öffnen genügt: das Bild im Editor wird ohne Klick gelesen.
      await page.goto(`/capture/frontdoor?draft=${entwurf.id}`);
      const status = await wartenBisGelesen(page, RUMPF_BEFUND);
      const befunde = await befundeAblesen(page.locator(RUMPF_BEFUND).first());
      protokoll.befund = { status, befunde };
      // Genauigkeit getrennt protokolliert — die Antwort unten ist ein eigener Nachweis.
      protokoll.genauigkeit = genauigkeit(SCREENSHOT_BEGRIFFE, befunde[0]?.text ?? "");

      const panel = page.locator(RUMPF_KLARA).first();
      await expect(panel).toBeVisible();
      const frage = await klaraFragen(panel, "frage", "Welcher Auftrag ist fällig, und bis wann?");
      protokoll.frage = frage;
      await anhang("ocr04-modell-direktes-bild.json", protokoll);
      await test.info().attach("ocr04-modell-direktes-bild.png", {
        contentType: "image/png",
        body: await panel.screenshot(),
      });

      expect(befunde).toHaveLength(1);
      expect(frage.ohneModell, "keine Modellantwort").toBe(0);
      expect(frage.antwort.trim().length, "leere Antwort").toBeGreaterThan(0);
      // Inhaltlich: Nummer und Datum stehen NUR im Bild.
      expect(frage.antwort).toMatch(/\b4711\b/);
      expect(frage.antwort).toMatch(/15\.\s?11\.\s?2026|15\.\s*November\s*2026/);
      expect(frage.belege[0]?.art).toBe("bild");
    });
  } finally {
    if (entwurf.id) {
      await page.request.delete(`/api/drafts/${entwurf.id}`).catch(() => undefined);
    }
  }
});

/** Wie in `office-artikel-browser.spec.ts`: der einmalige Nutzungshinweis wird quittiert. */
async function nutzungshinweisQuittieren(page: Page): Promise<void> {
  const weiter = page.getByTestId("notice-ack");
  if (await weiter.isVisible()) {
    await weiter.click();
    await expect(page.getByTestId("notice-banner")).toHaveCount(0, { timeout: 15_000 });
  }
}

test("OCR-04 · PowerPoint im Artikel: Klara antwortet mit dem Modell auf Text aus eingebetteten Bildern @modell", async ({
  page,
}) => {
  test.setTimeout(600_000);
  const protokoll: Record<string, unknown> = {
    art: "Modelllauf mit einer fiktiven PowerPoint als Artikelanhang — keine Kundenabnahme",
    soll: SOLL_DECK,
    folientext: FOLIENTITEL,
  };
  await mitModell(page, protokoll, async () => {
    await page.goto("/");
    const pptx = await baueDeck(page);
    // Ein fiktiver, „intern“ eingestufter Artikel mit der PowerPoint als Anhang — über die echten
    // Routen wie in `office-artikel-browser.spec.ts`.
    const ko = await page.request.post("/api/kos", {
      data: {
        title: `Fiktiver Wartungsplan OCR-04 ${Date.now().toString(36)}`,
        statement: "Fiktiver Artikel für die Klara-Bildprobe.",
        type: "best_practice",
        category: "Instandhaltung",
        confidentiality: "intern",
      },
    });
    expect(ko.status(), await ko.text()).toBe(201);
    const koId = ((await ko.json()) as { id: string }).id;
    const objekt = await page.request.post("/api/objects", {
      data: {
        name: DECKNAME,
        mime: PPTX_MIME,
        data: `data:${PPTX_MIME};base64,${pptx.toString("base64")}`,
        purpose: "attachment",
      },
    });
    expect(objekt.status(), await objekt.text()).toBe(201);
    const objectId = ((await objekt.json()) as { id: string }).id;
    const angehaengt = await page.request.put(`/api/kos/${koId}`, {
      data: { action: "attach", attachment: { name: DECKNAME, mime: PPTX_MIME, objectId } },
    });
    expect(angehaengt.status(), await angehaengt.text()).toBe(200);

    // Artikel öffnen → „Mehr“ → „Anhänge“: das Lesen beginnt ohne weiteren Klick.
    await page.goto(`/wissen/${koId}`);
    await expect(page.getByTestId("bib-titel")).toBeVisible({ timeout: 15_000 });
    await nutzungshinweisQuittieren(page);
    await page.getByTestId("bib-mehr").click();
    await page.locator('[data-bib-abschnitt="anhaenge"] > summary').click();
    const status = await wartenBisGelesen(page, OFFICE_BEFUND);
    const befunde = await befundeAblesen(page.locator(OFFICE_BEFUND).first());
    const maengel = pruefeBefunde(SOLL_DECK, befunde);
    protokoll.befund = { status, befunde, maengel };

    const panel = page.locator(OFFICE_KLARA).first();
    await expect(panel).toBeVisible();
    const frage = await klaraFragen(panel, "frage", "Welche Nummer hat der Ölwechsel?");
    const zusammenfassung = await klaraFragen(panel, "zusammenfassung");
    protokoll.frage = frage;
    protokoll.zusammenfassung = zusammenfassung;

    // Lesen verändert das Original nicht: der Anhang hat danach dieselben Bytes.
    const roh = await page.request.get(`/api/objects/${objectId}/raw`);
    expect(roh.status()).toBe(200);
    const unveraendert = Buffer.compare(Buffer.from(await roh.body()), pptx) === 0;
    protokoll.originalUnveraendert = unveraendert;
    await anhang("ocr04-modell-powerpoint-artikel.json", protokoll);
    await test.info().attach("ocr04-modell-powerpoint-artikel.png", {
      contentType: "image/png",
      body: await panel.screenshot(),
    });

    // Bekannter Inhalt, automatisch gelesen, an seiner Folie (PowerPoint nie „vollständig“, L16).
    expect(status).toBe("teilweise");
    expect(maengel).toEqual([]);
    // Die tatsächliche Antwort nutzt Text, der NUR im Bild auf Folie 2 steht.
    expect(frage.ohneModell, "keine Modellantwort").toBe(0);
    expect(frage.antwort.trim().length, "leere Antwort").toBeGreaterThan(0);
    expect(frage.antwort).toMatch(/\b83\b/);
    expect(frage.antwort).toMatch(/Folie\s*2/);
    expect(frage.belege[0]?.art).toBe("bild");
    expect(frage.belege[0]?.text).toContain(`${DECKNAME} · Folie 2, Bild 1`);
    // Die Zusammenfassung stützt sich auf Folientext UND Bildtext.
    expect(zusammenfassung.ohneModell, "keine Modellzusammenfassung").toBe(0);
    expect(zusammenfassung.antwort).toMatch(/Wartung|Anlage|Abschluss/i);
    expect(zusammenfassung.antwort).toMatch(/Prüfstand|Ölwechsel|Größe|Übergabe|\b(47|83|29|61)\b/);
    expect(unveraendert, "der Anhang wurde durch das Lesen verändert").toBe(true);
  });
});

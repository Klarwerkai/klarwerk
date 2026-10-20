// ================================================================================================
// OCR-E03 · Nacharbeit 6 — TABELLENÄNDERUNG ALS OCR-E02-BERICHTIGUNG, IM ECHTEN BROWSER
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-tabellen. Bens Befund: Tabellenänderungen lagen nur im lokalen
// Komponentenstatus. Gemessen gegen den Smoke-Server mit der ECHTEN Texterkennung (W01) und dem
// gelieferten Berichtigungsweg (`/api/me/assistenz/bildkorrekturen`, Quelle UND Bildfassung):
//   1. Eine kontrollierte Tabelle (Kopfzeile, Dezimalkomma, Einheit, eine leere Zelle) wird als Bild
//      über den Dateiimport bereitgestellt; die bearbeitbare Tabelle ist dauerhaft speicherbar.
//   2. Die leere Zelle wird gefüllt und „Als Berichtigung speichern“ gewählt: am Server steht EINE
//      Berichtigung dieser Datei und Bildfassung, die Tabelle als Block (Zellen per Tabulator).
//      Die Zelle ist als berichtigt gekennzeichnet; jede Zelle öffnet ihre Stelle im Original.
//   3. Neuladen und erneutes Einlesen derselben Datei: die Berichtigung ist in der Tabelle da, und
//      die Kopie (HTML und Text) trägt sie mit Struktur.
//   4. Quellwechsel: dieselben Bildbytes unter einem anderen Dateinamen — keine Übertragung.
//   5. „Zurücksetzen“ am Bildtext: die erkannte Tabelle ist zurück, am Server nichts mehr.
//
// ZUSTANDSANLEGEND (Berichtigung am Prüfkonto) — läuft deshalb ausschliesslich im isolierten Kontext
// `chromium-zustand` (`ZUSTAND_SPEC` in `playwright.smoke.config.ts`). Am Ende werden alle
// Berichtigungen des Prüfkontos zurückgesetzt. Die Vorlage ist fiktiv, im Browser gezeichnet. Kein
// Modell, kein Schlüssel. GRENZE: Datei-/Bildweg im Browser; Word-, PowerPoint- oder
// Collabora-Hosts sind hier NICHT geprüft.
import { type Locator, type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const BILDNAME = "fiktive-tabelle-berichtigung-ocr-e03.png";
const ANDERER_NAME = "fiktive-tabelle-kopie-ocr-e03.png";
const TABELLE = [
  ["POSTEN", "MENGE", "PREIS"],
  ["Ventil", "4 kg", "12,50 €"],
  ["Dichtung", "", "0,80 €"],
] as const;
const LEERE_ZELLE = { zeile: 2, spalte: 1 };
const NEUER_WERT = "6 kg";

const DATEI = "[data-testid=datei-bild-befunde]";
const DATEI_BEFUND = `${DATEI} [data-testid=bild-befunde]`;
const KORREKTUREN = "/api/me/assistenz/bildkorrekturen";

interface Korrekturen {
  darfBearbeiten: boolean;
  korrekturen: { quelle: string; inhaltskennung: string; text: string }[];
}

async function fiktiveTabelle(page: Page): Promise<Buffer> {
  const vorlage = TABELLE.map((z) => [...z]);
  const b64 = await page.evaluate((zeilen) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 100 + zeilen.length * 110;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("kein Canvas");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    zeilen.forEach((zeile, n) => {
      zeile.forEach((zelle, s) => {
        ctx.font = `${n === 0 ? "bold " : ""}52px Arial, Helvetica, sans-serif`;
        ctx.fillText(zelle, 60 + s * 380, 110 + n * 110);
      });
    });
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  }, vorlage);
  return Buffer.from(b64, "base64");
}

/** Eine Datei über den Dateiimport bereitstellen und warten, bis Befund UND Berichtigungen da sind. */
async function einlesen(page: Page, name: string, png: Buffer): Promise<void> {
  await page.goto("/erfassen?weg=datei");
  const eingang = page.locator('input[type="file"][accept*=".pptx"][accept*="image/*"]').first();
  await expect(eingang, "Dateiimport des Erfassens ist nicht da").toBeAttached({ timeout: 20_000 });
  await eingang.setInputFiles({ name, mimeType: "image/png", buffer: png });
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
  await expect(page.locator(`${DATEI} [data-testid=bild-berichtigung-stand]`)).toHaveCount(0, {
    timeout: 20_000,
  });
  await expect(teil(page, "bild-tabelle")).toBeVisible({ timeout: 10_000 });
}

/** Ein Element der Tabelle im Befund des Dateiimports, über seine Test-Kennung. */
function teil(page: Page, testid: string): Locator {
  return page.locator(`${DATEI_BEFUND} [data-testid=${testid}]`).first();
}

const tabelle = (page: Page): Locator => teil(page, "bild-tabelle");

function zelle(page: Page, z: { zeile: number; spalte: number }): Locator {
  const ort = `[data-zeile="${z.zeile}"][data-spalte="${z.spalte}"]`;
  return page.locator(`${DATEI_BEFUND} [data-testid=bild-tabelle-zelle]${ort}`);
}

/** Die Zwischenablage: Text und die Zellen der HTML-Tabelle. */
async function ablageLesen(page: Page): Promise<{ text: string; html: string[][] | null }> {
  return page.evaluate(async () => {
    const aus: Record<string, string> = {};
    for (const eintrag of await navigator.clipboard.read()) {
      for (const art of eintrag.types) {
        aus[art] = await (await eintrag.getType(art)).text();
      }
    }
    const t = new DOMParser()
      .parseFromString(aus["text/html"] ?? "", "text/html")
      .querySelector("table");
    const zellen = (r: HTMLTableRowElement): string[] =>
      [...r.cells].map((c) => (c.textContent ?? "").trim());
    return { text: aus["text/plain"] ?? "", html: t ? [...t.rows].map(zellen) : null };
  });
}

async function zellAnsicht(page: Page, z: { zeile: number; spalte: number }) {
  const el = zelle(page, z);
  return {
    wert: await el.locator("input").inputValue(),
    zustand: await el.getAttribute("data-zustand"),
    berichtigt: await el.getAttribute("data-berichtigt"),
  };
}

async function korrekturenAmServer(page: Page): Promise<Korrekturen> {
  const r = await page.request.get(KORREKTUREN);
  expect(r.status()).toBe(200);
  return (await r.json()) as Korrekturen;
}

/** Die Tabellenzeilen eines Berichtigungstexts: Zeilen mit Tabulator, je Zelle ein Wert. */
function tabellenBlock(text: string): string[][] {
  return text
    .split("\n")
    .filter((z) => z.includes("\t"))
    .map((z) => z.split("\t"));
}

test("OCR-E03 · Tabellenänderung als Bildberichtigung: speichern, Neuladen, Quellwechsel, Kopie, Rücksetzen", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(900_000);
  await ensureLoggedIn(page);
  const herkunft = new URL(baseURL ?? page.url()).origin;
  await page
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"], { origin: herkunft });
  await page.goto("/erfassen?weg=datei");
  const png = await fiktiveTabelle(page);
  const protokoll: Record<string, unknown> = {
    art: "Technische Probe mit kontrollierter, fiktiver Tabelle — keine Host- oder Kundenabnahme",
    vorlage: { tabelle: TABELLE, leereZelle: LEERE_ZELLE, neuerWert: NEUER_WERT },
  };

  try {
    // ── 1 · erkannt und dauerhaft speicherbar ───────────────────────────────────────────────────
    await einlesen(page, BILDNAME, png);
    const vorher = await zellAnsicht(page, LEERE_ZELLE);
    protokoll.erkannt = {
      form: {
        zeilen: await tabelle(page).getAttribute("data-zeilen"),
        spalten: await tabelle(page).getAttribute("data-spalten"),
        dauerhaft: await tabelle(page).getAttribute("data-dauerhaft"),
      },
      leereZelle: vorher,
    };
    await expect(tabelle(page)).toHaveAttribute("data-dauerhaft", "ja");
    expect(vorher).toMatchObject({ wert: "", zustand: "leer", berichtigt: "nein" });

    // ── 2 · ändern und als Berichtigung speichern ───────────────────────────────────────────────
    await zelle(page, LEERE_ZELLE).locator("input").fill(NEUER_WERT);
    await teil(page, "bild-tabelle-speichern").click();
    const meldung = teil(page, "bild-tabelle-gespeichert");
    await expect(meldung).toHaveAttribute("data-ergebnis", "gespeichert", { timeout: 20_000 });
    const amServer = await korrekturenAmServer(page);
    const gespeichert = await zellAnsicht(page, LEERE_ZELLE);
    protokoll.gespeichert = { amServer, zelle: gespeichert };
    expect(amServer.korrekturen).toHaveLength(1);
    expect(amServer.korrekturen[0]?.quelle).toMatch(/^datei:sha256:[0-9a-f]{64}\|/);
    expect(amServer.korrekturen[0]?.quelle).toContain(BILDNAME);
    expect(amServer.korrekturen[0]?.inhaltskennung).toMatch(/^sha256:[0-9a-f]{64}$/);
    const block = tabellenBlock(amServer.korrekturen[0]?.text ?? "");
    expect(block).toHaveLength(TABELLE.length);
    expect(block.every((z) => z.length === TABELLE[0].length)).toBe(true);
    expect(block[LEERE_ZELLE.zeile]?.[LEERE_ZELLE.spalte]).toBe(NEUER_WERT);
    expect(gespeichert).toMatchObject({ wert: NEUER_WERT, berichtigt: "ja" });
    await expect(tabelle(page)).toHaveAttribute("data-geaendert", "0");
    await expect(tabelle(page)).toHaveAttribute("data-berichtigt", "ja");

    // Die Stelle einer Zelle im Original (OCR-E01): das Bild dieser Datei, ein markierter Bereich.
    const preis = zelle(page, { zeile: 1, spalte: 2 });
    await preis.locator("[data-testid=bild-tabelle-zelle-fundstelle]").click();
    const ansicht = page.getByTestId("bild-fundstelle-ansicht");
    await expect(ansicht).toBeVisible();
    const src = (await page.getByTestId("bild-fundstelle-bild").getAttribute("src")) ?? "";
    const fundstelle = {
      art: await ansicht.getAttribute("data-art"),
      markierungen: await page.getByTestId("bild-fundstelle-markierung").count(),
      gleichesBild: src.split(",")[1] === png.toString("base64"),
    };
    protokoll.fundstelle = fundstelle;
    await test.info().attach("ocr-e03-tabelle-zelle-fundstelle.png", {
      contentType: "image/png",
      body: await ansicht.screenshot(),
    });
    await page.keyboard.press("Escape");
    await expect(ansicht).toHaveCount(0);
    expect(fundstelle).toMatchObject({ art: "bereich", gleichesBild: true });
    expect(fundstelle.markierungen).toBeGreaterThan(0);

    // ── 3 · Neuladen, erneut einlesen, kopieren ─────────────────────────────────────────────────
    await page.reload();
    await einlesen(page, BILDNAME, png);
    const nachNeuladen = await zellAnsicht(page, LEERE_ZELLE);
    await teil(page, "bild-tabelle-kopieren").click();
    const kopiert = teil(page, "bild-tabelle-kopiert");
    await expect(kopiert).toHaveAttribute("data-ergebnis", "tabelle", { timeout: 10_000 });
    const ablage = await ablageLesen(page);
    protokoll.nachNeuladen = { zelle: nachNeuladen, ablage };
    expect(nachNeuladen).toMatchObject({ wert: NEUER_WERT, berichtigt: "ja" });
    const tsv = ablage.text.split("\n").map((z) => z.split("\t"));
    expect(tsv).toHaveLength(TABELLE.length);
    expect(tsv[LEERE_ZELLE.zeile]?.[LEERE_ZELLE.spalte]).toBe(NEUER_WERT);
    expect(ablage.html?.[LEERE_ZELLE.zeile]?.[LEERE_ZELLE.spalte]).toBe(NEUER_WERT);
    expect(ablage.html?.map((z) => z.length)).toEqual(TABELLE.map((z) => z.length));

    // ── 4 · Quellwechsel: dieselben Bytes unter anderem Namen ───────────────────────────────────
    await einlesen(page, ANDERER_NAME, png);
    const andereQuelle = await zellAnsicht(page, LEERE_ZELLE);
    protokoll.andereQuelle = andereQuelle;
    expect(andereQuelle).toMatchObject({ wert: "", berichtigt: "nein" });
    await expect(tabelle(page)).toHaveAttribute("data-berichtigt", "nein");

    // ── 5 · zurücksetzen ────────────────────────────────────────────────────────────────────────
    await einlesen(page, BILDNAME, png);
    expect(await zellAnsicht(page, LEERE_ZELLE)).toMatchObject({ wert: NEUER_WERT });
    await teil(page, "bild-berichtigung-zuruecksetzen").click();
    await expect(zelle(page, LEERE_ZELLE).locator("input")).toHaveValue("", { timeout: 20_000 });
    const zurueck = await zellAnsicht(page, LEERE_ZELLE);
    const nachRuecksetzen = await korrekturenAmServer(page);
    protokoll.zurueck = { zelle: zurueck, amServer: nachRuecksetzen };
    expect(zurueck).toMatchObject({ wert: "", zustand: "leer", berichtigt: "nein" });
    expect(nachRuecksetzen.korrekturen).toEqual([]);
  } finally {
    await test.info().attach("ocr-e03-tabelle-berichtigung.json", {
      contentType: "application/json",
      body: JSON.stringify(protokoll, null, 2),
    });
    // Aufräumen: keine Berichtigung des Prüfkontos bleibt stehen.
    const rest = await korrekturenAmServer(page).catch(() => null);
    for (const k of rest?.korrekturen ?? []) {
      await page.request
        .put(KORREKTUREN, {
          data: { aktion: "zuruecksetzen", quelle: k.quelle, inhaltskennung: k.inhaltskennung },
        })
        .catch(() => undefined);
    }
  }
});

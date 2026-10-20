// ================================================================================================
// OCR-E04 · EINE GESCANNTE, MEHRSEITIGE PDF IM ECHTEN BROWSER — echte pdfjs-Engine, echte
// Texterkennung (W01, tesseract.js unter der eigenen CSP), echter Dateiimport des Erfassens.
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-mehrseitige-scans, Revision 1.
//
// Eine kontrollierte PDF mit drei Seiten und bekanntem Inhalt (`tests/klara-ocr-mehrseitig/
// scan-pdf.ts`), deren Bilder hier im Browser gezeichnet werden (JPEG, fiktive Inhalte):
//   Seite 1  gescannt (nur Bild):      „PRUEFKARTE 47“
//   Seite 2  nur Textebene:            „Wartung jede Woche …“
//   Seite 3  gemischt: Textebene „ABSCHLUSSBERICHT“ und ein Bild mit „ABSCHLUSSBERICHT“ / „LAGER 29“
//
// Gezeigt wird: ohne Klick werden die Bild- und die gemischte Seite gelesen (die Textseite nicht),
// der Status nennt jede Seite, die doppelte Überschrift von Seite 3 steht nur einmal, und Fragen zur
// ersten und letzten Seite nennen deterministisch die richtige Seite mit dem ECHT erkannten Text.
// Eine formulierte Modellantwort wird nicht vorausgesetzt (Tor ohne Modell) — sie wird nur
// protokolliert, wenn es eine gibt.
//
// NICHT ZUSTANDSANLEGEND: gelesen wird nur, gespeichert wird nichts.
import { type Page, expect, test } from "@playwright/test";
import { type ScanBild, scanPdf } from "../tests/klara-ocr-mehrseitig/scan-pdf";
import { ensureLoggedIn } from "./support/auth";

const DATEINAME = "fiktiver-scanbericht-ocr-e04.pdf";

async function gescanntesBild(page: Page, zeilen: readonly string[]): Promise<ScanBild> {
  const roh = await page.evaluate((z) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 140 + z.length * 130;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("kein Canvas");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 80px Arial, Helvetica, sans-serif";
    z.forEach((zeile, i) => ctx.fillText(zeile, 60, 140 + i * 130));
    return {
      breite: canvas.width,
      hoehe: canvas.height,
      b64: canvas.toDataURL("image/jpeg", 0.95).split(",")[1] ?? "",
    };
  }, zeilen);
  return {
    breite: roh.breite,
    hoehe: roh.hoehe,
    art: "jpeg",
    daten: new Uint8Array(Buffer.from(roh.b64, "base64")),
  };
}

const DATEI = "[data-testid=datei-bild-befunde]";
const SEITEN = `${DATEI} [data-testid=pdf-seiten]`;

async function wartenBisGelesen(page: Page): Promise<string> {
  let status = "laeuft";
  await expect
    .poll(
      async () => {
        status =
          (await page.evaluate(
            (auswahl) => document.querySelector(auswahl)?.getAttribute("data-status") ?? null,
            SEITEN,
          )) ?? "wartet";
        return status;
      },
      { timeout: 300_000, intervals: [1_000] },
    )
    .not.toMatch(/^(wartet|laeuft)$/);
  return status;
}

test("OCR-E04 · gescannte, gemischte PDF wird ohne Klick gelesen; Klara nennt die Seite", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await ensureLoggedIn(page);
  await page.goto("/erfassen?weg=datei");
  // Derselbe Eingang wie die OCR-03-Probe (`klara-bild-kontext-browser.spec.ts`).
  const eingang = page.locator('input[type="file"][accept*=".pptx"][accept*="image/*"]').first();
  await expect(eingang, "Dateiimport des Erfassens ist nicht da").toBeAttached({ timeout: 20_000 });

  const pdf = scanPdf([
    { bild: await gescanntesBild(page, ["SEITE EINS", "PRUEFKARTE 47"]) },
    { text: ["Wartung jede Woche durch den Betreiber.", "Protokoll liegt in der Halle aus."] },
    {
      text: ["ABSCHLUSSBERICHT"],
      bild: await gescanntesBild(page, ["ABSCHLUSSBERICHT", "LAGER 29"]),
    },
  ]);
  const protokoll: Record<string, unknown> = {
    art: "Technische Probe mit fiktiven Daten — keine Kundenabnahme",
    datei: DATEINAME,
    seiten: ["Scan: PRUEFKARTE 47", "Textebene: Wartung", "gemischt: ABSCHLUSSBERICHT / LAGER 29"],
  };

  // Bereitstellen — KEIN Klick auf eine Erkennung.
  await eingang.setInputFiles({ name: DATEINAME, mimeType: "application/pdf", buffer: pdf });
  const status = await wartenBisGelesen(page);
  const seiten = await page.locator(`${SEITEN} [data-testid=pdf-seite]`).evaluateAll((els) =>
    els.map((el) => ({
      seite: el.getAttribute("data-seite"),
      teil: el.getAttribute("data-seitenteil"),
      status: el.getAttribute("data-status"),
      text: el.querySelector("[data-testid=pdf-seite-text]")?.textContent ?? "",
      doppelt: el.querySelector("[data-testid=pdf-seite-doppelt]")?.textContent ?? "",
    })),
  );
  const statuszeile = (await page.locator(`${SEITEN} output`).textContent()) ?? "";
  protokoll.lesestand = { status, statuszeile, seiten };

  const panel = page.locator(`${DATEI} [data-testid=klara-bild-kontext]`);
  await expect(panel).toBeVisible();
  const vollstaendig = await panel.getAttribute("data-vollstaendig");

  const frage = async (text: string): Promise<{ art: string | null; text: string }[]> => {
    await panel.getByTestId("klara-bild-kontext-frage").fill(text);
    await panel.getByTestId("klara-bild-kontext-fragen").click();
    await expect(panel.getByTestId("klara-bild-kontext-antwort")).toHaveAttribute(
      "data-auftrag",
      "frage",
      { timeout: 120_000 },
    );
    return panel
      .getByTestId("klara-bild-kontext-beleg")
      .evaluateAll((els) =>
        els.map((el) => ({ art: el.getAttribute("data-art"), text: el.textContent ?? "" })),
      );
  };
  const erste = await frage("Welche Nummer hat die PRUEFKARTE?");
  const letzte = await frage("Welche Nummer hat das LAGER?");
  const modellAntwort =
    (await panel.getByTestId("klara-bild-kontext-antworttext").count()) > 0
      ? await panel.getByTestId("klara-bild-kontext-antworttext").textContent()
      : null;
  protokoll.klara = { vollstaendig, erste, letzte, modellAntwort };

  // Derselbe gerenderte Scan ist für E01/E03/E06 verfügbar, ohne ein zweites Lesen.
  const auswahl = page.locator(`${DATEI} [data-testid=klara-bereich]`);
  await auswahl.getByTestId("klara-bereich-bild").first().click();
  await auswahl.getByTestId("klara-bereich-was-steht-hier").click();
  await expect(auswahl.getByTestId("klara-bereich-text")).toContainText("PRUEFKARTE 47");
  await expect(auswahl.getByTestId("klara-bereich-auswahl")).toContainText("Seite 1");
  await expect(auswahl.getByTestId("klara-bereich-herkunft")).toContainText("vorhandenen");

  await test.info().attach("ocr-e04-mehrseitiger-scan.json", {
    contentType: "application/json",
    body: JSON.stringify(protokoll, null, 2),
  });
  await test.info().attach("ocr-e04-mehrseitiger-scan.png", {
    contentType: "image/png",
    body: await page.locator(DATEI).screenshot(),
  });

  // Jede Seite steht da, in Reihenfolge; die Textseite 2 wurde nicht erkannt, sondern gelesen.
  expect(seiten.map((s) => `${s.seite}:${s.teil}`)).toEqual([
    "1:bild",
    "2:textebene",
    "3:textebene",
    "3:bild",
  ]);
  expect(seiten.map((s) => s.status)).toEqual(["gelesen", "gelesen", "gelesen", "gelesen"]);
  expect(status).toBe("vollstaendig");
  expect(vollstaendig).toBe("true");
  // Echt erkannt: Seite 1 und der Bildteil von Seite 3.
  expect(seiten[0]?.text.toUpperCase()).toMatch(/\b47\b/);
  expect(seiten[3]?.text.toUpperCase()).toMatch(/\b29\b/);
  // Die Überschrift von Seite 3 steht in der Textebene — und nicht noch einmal im Erkannten.
  expect(seiten[2]?.text).toContain("ABSCHLUSSBERICHT");
  expect(seiten[3]?.text.toUpperCase()).not.toContain("ABSCHLUSSBERICHT");
  expect(seiten[3]?.doppelt.length).toBeGreaterThan(0);
  // Fragen zu erster und letzter Seite: die richtige Seite, mit dem erkannten Text.
  expect(erste[0]?.text).toContain(`${DATEINAME} · Seite 1, erkannt`);
  expect(erste[0]?.text.toUpperCase()).toMatch(/\b47\b/);
  expect(letzte[0]?.text).toContain(`${DATEINAME} · Seite 3, erkannt`);
  expect(letzte[0]?.text.toUpperCase()).toMatch(/\b29\b/);
});

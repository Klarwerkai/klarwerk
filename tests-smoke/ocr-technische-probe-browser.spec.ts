// ================================================================================================
// Aufnahme `gesamt-ocr` · R-0151 / FR-CAP-05 — TECHNISCHE OCR-PROBE MIT FIKTIVEN DATEN (BROWSER)
// ================================================================================================
//
// PETERS ENTSCHEIDUNG 25 (BD12, 12.10.2026): „Echte OCR-Kundenabnahme erfolgt später im Pilot.
// Technische OCR-Proben mit fiktiven Daten bleiben zulässig und erforderlich." Diese Sonde IST eine
// solche technische Probe — ausdrücklich KEINE Kundenabnahme, und sie wird auch nicht als solche
// berichtet.
//
// WAS SIE MISST, und warum im Browser: Alle bisherigen OCR-Tests ersetzen die Engine
// (`runImageOcr` gestellt). Ob die ECHTE Erkennung in der ausgelieferten Anwendung arbeitet — mit
// ihrem echten Bündel, ihrer echten Sicherheitsrichtlinie (CSP) und dem echten tesseract.js —, sagt
// keiner von ihnen. Hier läuft der Weg eines Menschen: Erfassen im Formular (`?weg=formular`),
// „Erweiterte Details", ein Bild anhängen, AUSDRÜCKLICH „OCR → Text" klicken, und der erkannte Text
// muss in der sichtbaren „Aussage" stehen (R-1688/R-1733).
//
// DAS BILD IST FIKTIV: Es wird im Browser auf ein `<canvas>` geschrieben („PRUEFKARTE 47 / VENTIL
// V3 SCHLIESSEN") — keine Datei von der Platte, keine Personen- oder Kundendaten.
//
// DAS PROTOKOLL wird als Anhang an den Bericht gehängt, gleich wie das Ergebnis ausfällt: der
// Ausgang (übernommen / nicht verfügbar / fehlgeschlagen / leer), der erkannte Text, jede
// Netzanfrage an eine FREMDE Herkunft während der Erkennung (tesseract.js lädt Arbeiter, Kern und
// Sprachdaten nach) und jede CSP-Meldung der Konsole. Damit ist ein Fehlschlag kein Rätsel, sondern
// ein benannter Befund — z. B. „Sprachdaten von fremder Herkunft durch CSP blockiert".
//
// DIE DATENLAGE BLEIBT UNBERÜHRT: es wird nichts gespeichert (kein Entwurf, kein Wissensobjekt).
//
// Aufruf: npm run smoke:ui:gate (Chromium) oder npm run smoke:ui (drei Engines).
import { type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const BILDNAME = "fiktive-pruefkarte.png";
const ZEILEN = ["PRUEFKARTE 47", "VENTIL V3 SCHLIESSEN"];

/** Ein fiktives Bild mit klarer Schrift, im Browser erzeugt (PNG als Base64). */
async function fiktivesBild(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate((zeilen) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 120 + zeilen.length * 110;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("kein Canvas");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 76px Arial, Helvetica, sans-serif";
    zeilen.forEach((zeile, i) => {
      ctx.fillText(zeile, 60, 120 + i * 110);
    });
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  }, ZEILEN);
  return Buffer.from(b64, "base64");
}

test("gesamt-ocr · technische OCR-Probe mit fiktivem Bild — Text in der Aussage", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await ensureLoggedIn(page);

  const herkunft = new URL(page.url()).origin;
  const fremdeAnfragen: { url: string; status: string }[] = [];
  const cspMeldungen: string[] = [];
  page.on("console", (meldung) => {
    const text = meldung.text();
    if (/Content Security Policy|Refused to/i.test(text)) {
      cspMeldungen.push(text);
    }
  });
  page.on("requestfinished", (anfrage) => {
    if (!anfrage.url().startsWith(herkunft) && !anfrage.url().startsWith("data:")) {
      fremdeAnfragen.push({ url: anfrage.url(), status: "beendet" });
    }
  });
  page.on("requestfailed", (anfrage) => {
    if (!anfrage.url().startsWith(herkunft) && !anfrage.url().startsWith("data:")) {
      fremdeAnfragen.push({ url: anfrage.url(), status: anfrage.failure()?.errorText ?? "fehler" });
    }
  });

  // Der Formularweg des Erfassens — derselbe, den das Menü „Datei ▾" öffnet.
  await page.goto("/erfassen?weg=formular");
  const aussage = page
    .locator("label", { has: page.locator("span", { hasText: /^Aussage$/ }) })
    .locator("textarea")
    .first();
  await expect(aussage, "Das Formularfeld „Aussage“ ist nicht da").toBeVisible({ timeout: 20_000 });

  const details = page.getByRole("button", { name: /Erweiterte Details/ }).first();
  if ((await details.getAttribute("aria-expanded")) !== "true") {
    await details.click();
  }
  await page.setInputFiles('input[type="file"][accept="image/*"]', {
    name: BILDNAME,
    mimeType: "image/png",
    buffer: await fiktivesBild(page),
  });

  // AUSDRÜCKLICHER Klick — die Erkennung startet nie von selbst (R-0151).
  const ocrKnopf = page.getByRole("button", { name: "OCR → Text" }).first();
  await expect(ocrKnopf).toBeAttached({ timeout: 15_000 });
  await ocrKnopf.click({ force: true });

  // Ausgang abwarten: übernommen, oder einer der ehrlichen Fehlersätze.
  const ausgaenge = {
    uebernommen: `OCR-Text aus ${BILDNAME} übernommen.`,
    nichtVerfuegbar: "OCR ist derzeit nicht verfügbar.",
    fehlgeschlagen: `OCR für ${BILDNAME} fehlgeschlagen.`,
    leer: `${BILDNAME}: OCR hat keinen Text erkannt.`,
  } as const;
  let ausgang = "zeitueberschreitung";
  await expect
    .poll(
      async () => {
        const text = (await page.locator("body").textContent()) ?? "";
        for (const [name, satz] of Object.entries(ausgaenge)) {
          if (text.includes(satz)) {
            ausgang = name;
            return name;
          }
        }
        return "laeuft";
      },
      { timeout: 150_000, intervals: [1_000] },
    )
    .not.toBe("laeuft");

  const erkannt = await aussage.inputValue();
  await test.info().attach("ocr-technische-probe.json", {
    contentType: "application/json",
    body: JSON.stringify(
      {
        art: "Technische OCR-Probe mit fiktiven Daten (Peters Entscheidung 25) — keine Kundenabnahme",
        bild: { name: BILDNAME, zeilen: ZEILEN, herkunft: "im Browser auf <canvas> erzeugt" },
        ausgang,
        aussage: erkannt,
        fremdeAnfragen,
        cspMeldungen,
      },
      null,
      2,
    ),
  });

  expect(ausgang, `Ausgang der Erkennung; CSP: ${cspMeldungen.join(" | ")}`).toBe("uebernommen");
  expect(erkannt).toContain(`[OCR: ${BILDNAME}]`);
  const normal = erkannt.toUpperCase();
  expect(normal).toContain("VENTIL");
  expect(normal).toMatch(/\b47\b/);
});

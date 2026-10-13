// ================================================================================================
// OCR-03 · K4 — SETUP › KLARA „BILDER AUTOMATISCH ANALYSIEREN UND TEXT ERKENNEN“ IM ECHTEN BROWSER,
// mit echter Texterkennung (W01) und echtem Server.
// ================================================================================================
//
// Auftrag produkt:20261012:klara-bildanalyse-ocr-kontext-setup.
//
// Ein eigens angelegtes FIKTIVES Konto (Rolle Experte): der Schalter ist voreingestellt an; aus →
// Neuladen → weiter aus, und ein neues Bild im Dateiimport wird NICHT gelesen; wieder an → Neuladen →
// weiter an, und ein neues Bild wird gelesen.
//
// ZUSTANDSANLEGEND (Konto, dessen Einstellung) — läuft deshalb ausschliesslich im isolierten Kontext
// `chromium-zustand` (`ZUSTAND_SPEC` in `playwright.smoke.config.ts`). Die Bilder sind fiktiv.
import { type Browser, type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const KENNWORT = "Bildautomatik-Kennwort-1";

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

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

async function fiktivesKonto(admin: Page): Promise<string> {
  await ensureLoggedIn(admin);
  const email = `bildautomatik-${marke()}@klarwerk.test`;
  const angelegt = await admin.request.post("/api/users", {
    data: { name: "Fiktiv Bildautomatik", email, password: KENNWORT, role: "experte" },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  return email;
}

async function anmelden(browser: Browser, email: string): Promise<Page> {
  const kontext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await kontext.newPage();
  await page.goto("/");
  const pw = page.locator('input[type="password"]');
  await expect(pw.first()).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="email"]').fill(email);
  await pw.first().fill(KENNWORT);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByTestId("kopfband")).toBeVisible({ timeout: 15_000 });
  const weiter = page.getByTestId("notice-ack");
  if (await weiter.isVisible().catch(() => false)) {
    await weiter.click();
  }
  // Ersteinrichtung der Assistenz über den vorhandenen Weg abschließen, damit kein Band stört.
  const einrichtung = await page.request.put("/api/me/assistenz", {
    data: { name: "Mia", avatar: "eule", einrichtungAbschliessen: true, fassung: 0 },
  });
  expect(einrichtung.status(), await einrichtung.text()).toBe(200);
  return page;
}

async function zumSchalter(page: Page) {
  await page.goto("/profil");
  await page.getByTestId("zeile-assistenz").click();
  const schalter = page.getByTestId("klara-bildautomatik-schalter");
  await expect(schalter).toBeVisible({ timeout: 15_000 });
  await expect(schalter).toBeEnabled({ timeout: 15_000 });
  return schalter;
}

async function amServer(page: Page): Promise<boolean | undefined> {
  const r = await page.request.get("/api/me/assistenz");
  expect(r.status()).toBe(200);
  return ((await r.json()) as { profil: { bildAutomatik?: boolean } | null }).profil?.bildAutomatik;
}

const DATEI_BEFUND = "[data-testid=datei-bild-befunde] [data-testid=bild-befunde]";

/** Ein Bild über den Dateiimport bereitstellen und warten, bis sein Befund abgeschlossen ist. */
async function bildBereitstellen(
  page: Page,
  name: string,
): Promise<{
  status: string;
  befunde: { status: string | null; zeile: string; text: string }[];
}> {
  await page.goto("/erfassen?weg=datei");
  const eingang = page.locator('input[type="file"][accept*=".pptx"][accept*="image/*"]').first();
  await expect(eingang).toBeAttached({ timeout: 20_000 });
  await eingang.setInputFiles({
    name,
    mimeType: "image/png",
    buffer: await fiktivesBild(page, "AUSHANG 61"),
  });
  let status = "wartet";
  await expect
    .poll(
      async () => {
        status =
          (await page.evaluate(
            (auswahl) => document.querySelector(auswahl)?.getAttribute("data-status") ?? null,
            DATEI_BEFUND,
          )) ?? "wartet";
        return status;
      },
      { timeout: 240_000, intervals: [1_000] },
    )
    .not.toMatch(/^(wartet|laeuft)$/);
  const befunde = await page
    .locator(`${DATEI_BEFUND} [data-testid=bild-befund]`)
    .evaluateAll((els) =>
      els.map((el) => ({
        status: el.getAttribute("data-status"),
        zeile: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
        // Der erkannte Text aus seinem eigenen Element — im textContent der ganzen Zeile stossen
        // Status, Text und Bildinhalt ohne Leerzeichen aneinander („…AUSHANG 61BILDINHALT…“).
        text: el.querySelector("[data-testid=bild-befund-text]")?.textContent ?? "",
      })),
    );
  return { status, befunde };
}

test("OCR-03 · Setup Klara: Bildautomatik voreingestellt an, aus und wieder an bleiben nach Neuladen und wirken", async ({
  page,
  browser,
}) => {
  test.setTimeout(600_000);
  const email = await fiktivesKonto(page);
  const p = await anmelden(browser, email);
  const protokoll: Record<string, unknown> = { art: "Fiktives Konto, fiktive Bilder" };

  // Voreinstellung: an, ohne gespeicherte Wahl.
  let schalter = await zumSchalter(p);
  await expect(schalter).toBeChecked();
  protokoll.vorher = (await amServer(p)) ?? "keine Wahl gespeichert";

  // Ausschalten → gespeichert.
  await schalter.click();
  await expect(p.getByTestId("klara-bildautomatik-meldung")).toHaveText(
    "Gespeichert: Bilder werden nicht mehr automatisch gelesen.",
  );
  await expect(schalter).not.toBeChecked();
  protokoll.nachAus = await amServer(p);

  // Neuladen → weiter aus.
  await p.reload();
  schalter = await zumSchalter(p);
  await expect(schalter).not.toBeChecked();

  // Wirkung: ein neues Bild wird NICHT gelesen.
  const aus = await bildBereitstellen(p, "fiktiver-aushang-aus.png");
  protokoll.wirkungAus = aus;

  // Wieder einschalten → gespeichert; Neuladen → weiter an.
  schalter = await zumSchalter(p);
  await schalter.click();
  await expect(p.getByTestId("klara-bildautomatik-meldung")).toHaveText(
    "Gespeichert: Bilder werden automatisch gelesen.",
  );
  await p.reload();
  schalter = await zumSchalter(p);
  await expect(schalter).toBeChecked();
  protokoll.nachAn = await amServer(p);

  // Wirkung: ein neues Bild wird gelesen.
  const an = await bildBereitstellen(p, "fiktiver-aushang-an.png");
  protokoll.wirkungAn = an;

  await test.info().attach("ocr03-setup-bildautomatik.json", {
    contentType: "application/json",
    body: JSON.stringify(protokoll, null, 2),
  });

  expect(protokoll.vorher).toBe("keine Wahl gespeichert");
  expect(protokoll.nachAus).toBe(false);
  expect(protokoll.nachAn).toBe(true);
  expect(aus.status).toBe("aus");
  expect(aus.befunde.map((b) => b.status)).toEqual(["nicht-analysiert"]);
  expect(aus.befunde[0]?.zeile).toContain("automatisches Lesen ist ausgeschaltet");
  expect(an.befunde.map((b) => b.status)).toEqual(["gelesen"]);
  expect(an.befunde[0]?.text.toUpperCase()).toMatch(/\b61\b/);
  await p.context().close();
});

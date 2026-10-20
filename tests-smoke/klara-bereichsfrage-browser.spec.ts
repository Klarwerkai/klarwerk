// ================================================================================================
// OCR-E06 · „KLARA, WAS STEHT HIER?“ — im echten Browser gegen den Smoke-Server, mit der ECHTEN
// Texterkennung (W01, tesseract.js unter der eigenen CSP) und echten Zeigerereignissen.
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-bereichsfrage, K1–K4 (Nutzerweg im Web-Host).
//
// Ein im Browser gezeichnetes Bild mit drei Textblöcken wird über den Dateiimport bereitgestellt
// und ohne Klick gelesen (K4). In der Bildvorschau wird mit der Maus ein Bereich um den mittleren
// Block aufgezogen: „Was steht hier?“ liefert NUR dessen Text, aus der vorhandenen Lesung (K2). Ein
// anderer Bereich wechselt den Kontext (K3); das ganze Bild liefert alle Blöcke (K1). Eine
// formulierte Erklärung braucht ein Modell — im Tor gibt es keins, und das steht dann so da. Der
// Modellfall unten trägt `@modell` und läuft nur im vollen Smoke.
//
// NICHT ZUSTANDSANLEGEND (erster Fall): gelesen wird nur, gespeichert wird nichts. Die Bilder sind
// fiktiv. Word, PowerPoint und andere Office-Hosts sind hier NICHT geprüft — dort ist keine Bild-
// oder Bereichsauswahl an Klara angebunden (Hostgrenze, s. docs/klara-bildanalyse-ocr/OCR-E06-…).
import { type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const BILDNAME = "fiktiver-beleg-ocr-e06.png";
const BREITE = 1200;
const HOEHE = 800;

/** Drei Blöcke an bekannten Stellen (Grundlinie y in Pixeln des Originals). */
const BLOECKE = [
  { zeile: "RECHNUNG 2026", y: 130 },
  { zeile: "SUMME 1800", y: 420 },
  { zeile: "LAGER 29", y: 700 },
] as const;

/** Bereiche in Pixeln des Originals — je einer um genau einen Block. */
const BEREICH_SUMME = { x0: 0, y0: 330, x1: BREITE, y1: 480 };
const BEREICH_LAGER = { x0: 0, y0: 610, x1: BREITE, y1: 760 };

async function fiktivesBild(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(
    ({ breite, hoehe, bloecke }) => {
      const canvas = document.createElement("canvas");
      canvas.width = breite;
      canvas.height = hoehe;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("kein Canvas");
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, breite, hoehe);
      ctx.fillStyle = "#000000";
      ctx.font = "bold 56px Arial, Helvetica, sans-serif";
      for (const b of bloecke) {
        ctx.fillText(b.zeile, 60, b.y);
      }
      return canvas.toDataURL("image/png").split(",")[1] ?? "";
    },
    { breite: BREITE, hoehe: HOEHE, bloecke: BLOECKE },
  );
  return Buffer.from(b64, "base64");
}

const DATEI = "[data-testid=datei-bild-befunde]";
const DATEI_BEFUND = `${DATEI} [data-testid=bild-befunde]`;

/** Wartet, bis der Befund eines NEUEN Eingangs abgeschlossen ist. */
async function wartenBisFertig(page: Page, auswahl: string): Promise<string> {
  let status = "laeuft";
  await expect
    .poll(
      async () => {
        status =
          (await page.evaluate(
            (a) => document.querySelector(a)?.getAttribute("data-status") ?? null,
            auswahl,
          )) ?? "wartet";
        return status;
      },
      { timeout: 240_000, intervals: [1_000] },
    )
    .not.toMatch(/^(wartet|laeuft)$/);
  return status;
}

/** Zieht in der Vorschau mit der Maus einen Bereich (Pixel im Original) auf. */
async function zieheBereich(
  page: Page,
  bereich: { x0: number; y0: number; x1: number; y1: number },
  wurzel: string,
): Promise<void> {
  const bild = page.locator(`${wurzel} [data-testid=klara-bereich-vorschau] img`);
  const geladen = (): Promise<number> =>
    bild.evaluate((el) => (el as HTMLImageElement).naturalWidth);
  await expect.poll(geladen, { timeout: 20_000 }).toBeGreaterThan(0);
  const box = await bild.boundingBox();
  if (!box) {
    throw new Error("Vorschau ohne Lage");
  }
  const sx = box.width / BREITE;
  const sy = box.height / HOEHE;
  // Knapp innerhalb der Bildkanten bleiben, damit der Zeiger über dem Bild beginnt und endet.
  const x0 = box.x + Math.max(1, bereich.x0 * sx);
  const x1 = box.x + Math.min(box.width - 1, bereich.x1 * sx);
  await page.mouse.move(x0, box.y + bereich.y0 * sy);
  await page.mouse.down();
  await page.mouse.move(x1, box.y + bereich.y1 * sy, { steps: 8 });
  await page.mouse.up();
}

test("OCR-E06 · Klara, was steht hier? — Bereich in einem Bild mit mehreren Blöcken", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await ensureLoggedIn(page);
  await page.goto("/erfassen?weg=datei");
  const eingang = page.locator('input[type="file"][accept*=".pptx"][accept*="image/*"]').first();
  await expect(eingang, "Dateiimport des Erfassens ist nicht da").toBeAttached({ timeout: 20_000 });

  const protokoll: Record<string, unknown> = {
    art: "Technische Probe mit fiktiven Daten — keine Kundenabnahme",
    host: "Web-App Klarwerk (Erfassen › Datei), Chromium",
    bild: { name: BILDNAME, breite: BREITE, hoehe: HOEHE, bloecke: BLOECKE },
  };

  // K4: bereitstellen — KEIN Klick auf eine Erkennung; die Automatik liest das ganze Bild.
  const buffer = await fiktivesBild(page);
  await eingang.setInputFiles({ name: BILDNAME, mimeType: "image/png", buffer });
  const status = await wartenBisFertig(page, DATEI_BEFUND);
  const befundText = page.locator(`${DATEI_BEFUND} [data-testid=bild-befund-text]`).first();
  const automatisch = (await befundText.textContent()) ?? "";
  protokoll.automatik = { status, text: automatisch };

  const panel = page.locator(`${DATEI} [data-testid=klara-bereich]`);
  await expect(panel).toBeVisible();
  const host = (await panel.getByTestId("klara-bereich-host").textContent()) ?? "";
  await panel.getByTestId("klara-bereich-bild").first().click();

  const lies = async (): Promise<Record<string, string | null>> => {
    await panel.getByTestId("klara-bereich-was-steht-hier").click();
    const ergebnis = panel.getByTestId("klara-bereich-ergebnis");
    await expect(ergebnis).toBeVisible({ timeout: 120_000 });
    await expect(panel.getByTestId("klara-bereich-eintrag").first()).toBeVisible({
      timeout: 120_000,
    });
    const text = panel.getByTestId("klara-bereich-text");
    return {
      auswahl: await panel.getByTestId("klara-bereich-auswahl").textContent(),
      status: await ergebnis.getAttribute("data-status"),
      text: (await text.count()) > 0 ? await text.textContent() : null,
      herkunft: await panel.getByTestId("klara-bereich-herkunft").textContent(),
      ohneModell: String(await panel.getByTestId("klara-bereich-ohne-modell").count()),
    };
  };

  // K2: Bereich um den mittleren Block.
  await zieheBereich(page, BEREICH_SUMME, DATEI);
  const summe = await lies();
  await test.info().attach("ocr-e06-bereich-summe.png", {
    contentType: "image/png",
    body: await panel.screenshot(),
  });
  // K3: anderer Bereich — neuer Kontext.
  await zieheBereich(page, BEREICH_LAGER, DATEI);
  await expect(panel.getByTestId("klara-bereich-ergebnis")).toHaveCount(0);
  const lager = await lies();
  // K1: das ganze Bild.
  await panel.getByTestId("klara-bereich-ganz").click();
  const ganz = await lies();
  protokoll.bereichsfragen = { host, summe, lager, ganz };

  // Dynamische Vergleiche prüfen ausschließlich Bereichstrennung und Wiederverwendung.
  // Die Originaltreue wird unabhängig gegen den festen Fixture-Text geprüft. Ein Fehler der
  // gemeinsamen OCR bleibt dabei rot, ohne damit eine E06-Regression zu behaupten.
  const roh = automatisch.split("\n").map((z) => z.trim());
  const zeilen = roh.filter((z) => z.length > 0);
  const zeileMit = (muster: RegExp): string => zeilen.find((z) => muster.test(z)) ?? "";
  const summenZeile = zeileMit(/SUMME/i);
  const lagerZeile = zeileMit(/LAGER/i);
  const originaltext = BLOECKE.map((block) => block.zeile).join("\n");
  protokoll.originaltreue = {
    soll: originaltext,
    ist: automatisch.trim(),
    bestanden: automatisch.trim() === originaltext,
    bereichSoll: BLOECKE[1].zeile,
    bereichIst: summe.text,
    bereichBestanden: summe.text === BLOECKE[1].zeile,
  };
  await test.step("Originaltreue · feste Fixture, getrennt von Bereichstrennung", async () => {
    expect.soft(automatisch.trim(), "OCR gegen Originaltext").toBe(originaltext);
    expect.soft(summe.text, "Bereich gegen Originaltext").toBe(BLOECKE[1].zeile);
    expect.soft(ganz.text, "Ganzes Bild gegen Originaltext").toBe(originaltext);
  });

  await test.info().attach("ocr-e06-bereichsfrage.json", {
    contentType: "application/json",
    body: JSON.stringify(protokoll, null, 2),
  });
  await test.info().attach("ocr-e06-bereich-ganz.png", {
    contentType: "image/png",
    body: await panel.screenshot(),
  });

  expect(status).toMatch(/^(vollstaendig|teilweise)$/);
  // Die automatische Lesung hat alle drei Blöcke als eigene Zeilen.
  expect(zeilen).toHaveLength(3);
  expect(summenZeile).toMatch(/^SUMME\s+\S+$/i);
  expect(lagerZeile).toMatch(/\b29\b/);
  // K2: nur der mittlere Block — genau seine Zeile aus der vorhandenen automatischen Lesung.
  expect(summe.status).toBe("gelesen");
  expect(summe.text).toBe(summenZeile);
  expect(summe.text ?? "").not.toMatch(/RECHNUNG|LAGER|2026|\b29\b/i);
  expect(summe.herkunft).toContain("vorhandenen Bildanalyse");
  // K3: der andere Bereich trägt nur seinen Block.
  expect(lager.status).toBe("gelesen");
  expect(lager.text).toBe(lagerZeile);
  expect(lager.text ?? "").not.toMatch(/RECHNUNG|SUMME/i);
  expect(lager.text ?? "").not.toContain(summenZeile);
  // K1: das ganze Bild trägt alle Blöcke — dieselbe Lesung wie die Automatik.
  expect(ganz.status).toBe("gelesen");
  expect(ganz.text).toBe(automatisch.trim());
  expect(ganz.text ?? "").toMatch(/RECHNUNG/i);
  expect(ganz.text ?? "").toContain(summenZeile);
  expect(ganz.text ?? "").toMatch(/\b29\b/);
});

// ================================================================================================
// DIE ERKLÄRUNG ÜBER DEN PRODUKTIVEN WEG — mit Modell (`@modell`, nur im vollen Smoke).
// ================================================================================================
//
// Wie der Modellfall in `klara-bild-kontext-browser.spec.ts`: ein fiktiver, ausdrücklich „intern“
// eingestufter Entwurf (eine nicht eingestufte Datei gilt fail-safe als vertraulich), geöffnet im
// Editor; gefragt wird über die Fläche, die jeder Editor trägt (`BildBefundeImRumpf` →
// `KlaraBereichsfrage` → assist-Weg mit der Provenienz des Entwurfs). Fehlt ein nutzbares Modell,
// ist der Fall ROT; eine fehlende oder leere Erklärung lässt ihn nie bestehen.

interface Zuordnung {
  global: string;
  perTask: Record<string, string>;
  kiFreigabe?: { oeffentlicheKi?: boolean; vertraulicheInhalte?: boolean };
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

const RUMPF = "[data-testid=rumpf-bild-befunde]";

test("OCR-E06 · Klara erklärt den ausgewählten Bereich mit dem Modell; Nachfrage bleibt dort @modell", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await ensureLoggedIn(page);
  const vorher = await zuordnungLesen(page);
  await freigabeSetzen(page, vorher, { oeffentlicheKi: true, vertraulicheInhalte: false });
  let entwurfId: string | null = null;
  const protokoll: Record<string, unknown> = {
    art: "Modelllauf mit fiktiven Daten — keine Kundenabnahme",
  };
  try {
    const statusAntwort = await page.request.get("/api/reasoner/status");
    const status = (await statusAntwort.json()) as {
      active?: boolean;
      reachable?: string;
      kiAbgeschaltet?: boolean;
      extern?: string;
      tasks?: { assist?: boolean };
    };
    protokoll.modellstatus = status;
    expect(status.extern, "die Grundfreigabe ist nicht wirksam").toBe("frei");
    expect(
      status.active === true &&
        status.tasks?.assist === true &&
        status.kiAbgeschaltet !== true &&
        status.reachable !== "unreachable",
      `Kein nutzbares Modell für „assist“ (Status ${JSON.stringify(status)}).`,
    ).toBe(true);

    await page.goto("/");
    const bild = (await fiktivesBild(page)).toString("base64");
    const bodyHtml = [
      "<h2>Fiktiver Beleg</h2>",
      "<p>Der Beleg liegt als Bild vor.</p>",
      `<figure><img src="data:image/png;base64,${bild}"></figure>`,
    ].join("");
    const angelegt = await page.request.post("/api/drafts", {
      data: {
        title: "Fiktiver Beleg OCR-E06",
        statement: "Fiktiver Entwurf für die Klara-Bereichsprobe.",
        type: "best_practice",
        category: "Anlage 1",
        confidentiality: "intern",
        bodyHtml,
      },
    });
    expect(angelegt.status(), await angelegt.text()).toBe(201);
    entwurfId = ((await angelegt.json()) as { id: string }).id;

    await page.goto(`/capture/frontdoor?draft=${entwurfId}`);
    await wartenBisFertig(page, `${RUMPF} [data-testid=bild-befunde]`);
    const panel = page.locator(`${RUMPF} [data-testid=klara-bereich]`).first();
    await expect(panel).toBeVisible();
    await panel.getByTestId("klara-bereich-bild").first().click();
    await zieheBereich(page, BEREICH_SUMME, RUMPF);

    await panel.getByTestId("klara-bereich-was-steht-hier").click();
    const erste = panel.getByTestId("klara-bereich-eintrag").first();
    await expect(erste).toBeVisible({ timeout: 180_000 });
    const text = (await panel.getByTestId("klara-bereich-text").textContent()) ?? "";
    const antwort1 = (await erste.getByTestId("klara-bereich-antwort").count())
      ? ((await erste.getByTestId("klara-bereich-antwort").textContent()) ?? "")
      : "";

    await panel.getByTestId("klara-bereich-nachfrage").fill("Welcher Betrag ist das genau?");
    await panel.getByTestId("klara-bereich-nachfragen").click();
    const zweite = panel.getByTestId("klara-bereich-eintrag").nth(1);
    await expect(zweite).toBeVisible({ timeout: 180_000 });
    const antwort2 = (await zweite.getByTestId("klara-bereich-antwort").count())
      ? ((await zweite.getByTestId("klara-bereich-antwort").textContent()) ?? "")
      : "";
    protokoll.bereich = { text, antwort1, antwort2 };

    await test.info().attach("ocr-e06-modellerklaerung.json", {
      contentType: "application/json",
      body: JSON.stringify(protokoll, null, 2),
    });
    await test.info().attach("ocr-e06-modellerklaerung.png", {
      contentType: "image/png",
      body: await panel.screenshot(),
    });

    // Originaltreue und Bezug zur erkannten Lesung sind voneinander unabhängige Prüfungen.
    await test.step("Originaltreue · Modellantworten gegen festen Fixture-Betrag", async () => {
      expect.soft(text, "Bereich gegen Originaltext").toBe(BLOECKE[1].zeile);
      expect.soft(antwort1, "Erklärung gegen Originalbetrag").toMatch(/\b(?:1800|1[. ]800)\b/);
      expect.soft(antwort2, "Nachfrage gegen Originalbetrag").toMatch(/\b(?:1800|1[. ]800)\b/);
    });
    // Zusätzlich bleibt die Treue zur tatsächlich erkannten Lesung sichtbar.
    expect(text).toMatch(/^SUMME\s+\d+$/i);
    const betrag = text.replace(/\D/g, "");
    const ohneTrenner = (s: string): string => s.replace(/(\d)[.\s](?=\d)/g, "$1");
    expect(antwort1.trim().length, "keine Erklärung zum Bereich").toBeGreaterThan(0);
    expect(ohneTrenner(antwort1)).toContain(betrag);
    // Die Erklärung bleibt beim Bereich: nichts aus den anderen Blöcken.
    expect(antwort1).not.toMatch(/RECHNUNG|LAGER|\b29\b/i);
    expect(antwort2.trim().length, "keine Antwort auf die Nachfrage").toBeGreaterThan(0);
    expect(ohneTrenner(antwort2)).toContain(betrag);
    expect(antwort2).not.toMatch(/LAGER|\b29\b/i);
  } finally {
    if (entwurfId) {
      await page.request.delete(`/api/drafts/${entwurfId}`).catch(() => undefined);
    }
    await freigabeSetzen(page, vorher, {
      oeffentlicheKi: vorher.kiFreigabe?.oeffentlicheKi === true,
      vertraulicheInhalte: vorher.kiFreigabe?.vertraulicheInhalte === true,
    });
  }
});

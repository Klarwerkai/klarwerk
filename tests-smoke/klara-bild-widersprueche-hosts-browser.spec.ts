// ================================================================================================
// OCR-E05 · MÖGLICHE ABWEICHUNG IN DEN VERFÜGBAREN HOSTWEGEN — H06 „Office im Artikel“ und der
// Klarwerk-Teil von H02 „Klara in Word“, mit der ECHTEN Texterkennung und dem dauerhaften
// Korrekturweg (OCR-E02, `/api/me/assistenz/bildkorrekturen`).
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-widersprueche, K1/K3/K4/K7 (Nacharbeit 7, Bens Befund
// „E05 nur im Dateiweg“). Dieselben Wege wie die E01/E02-Hostprobe
// (`klara-ocr-fundstelle-korrektur-browser.spec.ts`, H02/H06), hier mit dem E05-Nachweis:
//
//   · Der Dokumenttext sagt „Die Gesamtsumme beträgt 1.500 €.“, das eingebettete Bild zeigt
//     „Gesamtsumme 1.800 €“. Angezeigt wird genau diese mögliche Abweichung, mit Fundstelle im Text
//     (Absatz/Satz) und im Bild (Quelle · Folie/Bild · Zeile) (K1). Der Hinweis sagt nicht, welcher
//     Wert stimmt (K4).
//   · Der Bildtext wird über den vorhandenen Weg auf „Gesamtsumme 1.500 €“ berichtigt und am Konto
//     gespeichert: der Hinweis verschwindet; nach Neuladen bleibt er weg (K3).
//
// HOSTGRENZEN, konkret: H06 braucht keinen Office-Editor (im Prüfaufbau ist Collabora/WOPI nicht
// eingerichtet). Für H02 gibt es im Prüfaufbau KEIN Word mit eingespieltem Add-in; geprüft wird die
// Anfrage, die das Add-in für das ganze Dokument schickt (`POST /api/drafts/from-docx`), und der
// Deep-Link (`/capture/frontdoor?draft=<id>`). Die Bedienung IN Word, PowerPoint als Host (es gibt
// kein PowerPoint-Add-in, H03) und der Office-Editor bleiben offen.
//
// ZUSTANDSANLEGEND (Artikel, Anhang, Entwurf, Berichtigungen am Konto) — läuft deshalb nur im
// isolierten Kontext `chromium-zustand` (`ZUSTAND_SPEC`). Am Ende werden Berichtigungen und Entwurf
// entfernt.
import { type Locator, type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";
import { PPTX_TYP, deckMit, docxMit, zeichneBild } from "./support/ocr-fundstellen-probe";

const KORREKTUREN = "/api/me/assistenz/bildkorrekturen";
const RUMPF = "[data-testid=rumpf-bild-befunde]";
const TEXT = "Die Gesamtsumme beträgt 1.500 €.";
const IM_BILD = "Gesamtsumme 1.800 €";
const BERICHTIGT = "Gesamtsumme 1.500 €";

interface Korrekturen {
  korrekturen: { quelle: string; inhaltskennung: string; text: string }[];
}

interface Hinweis {
  art: string | null;
  angabe: string | null;
  beschreibung: string;
  text: string;
  textOrt: string;
  bild: string;
  bildOrt: string;
}

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function bildMitAbweichung(page: Page) {
  return zeichneBild(page, 1400, 230, [{ text: IM_BILD, x: 60, y: 140 }]);
}

async function korrekturenAmServer(page: Page): Promise<Korrekturen> {
  const r = await page.request.get(KORREKTUREN);
  expect(r.status()).toBe(200);
  return (await r.json()) as Korrekturen;
}

async function aufraeumen(page: Page): Promise<void> {
  const rest = await korrekturenAmServer(page).catch(() => null);
  for (const k of rest?.korrekturen ?? []) {
    await page.request
      .put(KORREKTUREN, {
        data: { aktion: "zuruecksetzen", quelle: k.quelle, inhaltskennung: k.inhaltskennung },
      })
      .catch(() => undefined);
  }
}

/** Wie in der E01/E02-Hostprobe: Befund abgeschlossen UND gespeicherte Berichtigungen geladen. */
async function befundFertig(page: Page, bereich: string): Promise<void> {
  await expect
    .poll(
      async () =>
        (await page.evaluate(
          (auswahl) => document.querySelector(auswahl)?.getAttribute("data-status") ?? null,
          `${bereich} [data-testid=bild-befunde]`,
        )) ?? "wartet",
      { timeout: 240_000, intervals: [1_000] },
    )
    .not.toMatch(/^(wartet|laeuft)$/);
  await expect(page.locator(`${bereich} [data-testid=bild-berichtigung-stand]`)).toHaveCount(0, {
    timeout: 20_000,
  });
}

async function hinweise(bereich: Locator): Promise<Hinweis[]> {
  const eintraege = bereich.locator("[data-testid=bild-widerspruch]");
  return eintraege.evaluateAll((els) =>
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
}

async function berichtigeIn(zeileL: Locator, text: string): Promise<void> {
  await zeileL.getByTestId("bild-berichtigung-bearbeiten").click();
  await zeileL.getByTestId("bild-berichtigung-feld").fill(text);
  await zeileL.getByTestId("bild-berichtigung-speichern").click();
  await expect(zeileL.getByTestId("bild-befund-text")).toHaveText(text);
}

/** Die Gesamtsumme als mögliche Abweichung mit beiden Fundstellen; `ort`: die Bildfundstelle. */
function pruefeAbweichung(alle: Hinweis[], ort: RegExp): void {
  const summe = alle.find((h) => h.art === "moeglicher-widerspruch" && ort.test(h.bildOrt));
  expect(summe, JSON.stringify(alle)).toBeDefined();
  expect(summe?.angabe).toBe("betrag");
  expect(summe?.text).toBe("1.500 €");
  expect(summe?.textOrt).toMatch(/^Text, Absatz \d+, Satz \d+$/);
  expect(summe?.bild.replace(/\s+/g, "")).toMatch(/^1[.,]?800(,00)?€$/);
  expect(summe?.beschreibung).toContain("welche stimmt, lässt sich daraus nicht sagen");
}

/** Wie `office-artikel-browser.spec.ts`: der einmalige Nutzungshinweis wird quittiert. */
async function nutzungshinweisQuittieren(page: Page): Promise<void> {
  const weiter = page.getByTestId("notice-ack");
  if (await weiter.isVisible().catch(() => false)) {
    await weiter.click();
  }
}

test("OCR-E05 · H02-Übernahmeweg (Word-Add-in-Route) · Abweichung, Fundstellen und Neubewertung nach gespeicherter Berichtigung", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await ensureLoggedIn(page);
  await page.goto("/");
  const bild = await bildMitAbweichung(page);
  let entwurfId: string | null = null;
  try {
    // Genau die Nutzlast, die das Add-in für „Ganzes Dokument“ schickt (taskpane.js, sendeDocxDatei).
    const angelegt = await page.request.post("/api/drafts/from-docx", {
      data: {
        name: `Abrechnung aus Word ${marke()}.docx`,
        data: docxMit(TEXT, bild.png).toString("base64"),
        confidentiality: "intern",
      },
    });
    expect(angelegt.ok(), await angelegt.text()).toBe(true);
    entwurfId = ((await angelegt.json()) as { id: string }).id;

    // Der Deep-Link des Add-ins.
    await page.goto(`/capture/frontdoor?draft=${entwurfId}`);
    await befundFertig(page, RUMPF);
    const bereich = page.locator(RUMPF).first();
    const vorher = await hinweise(bereich);
    const zeileL = bereich.getByTestId("bild-befund").first();
    const roh = (await zeileL.getByTestId("bild-befund-text").textContent()) ?? "";

    await berichtigeIn(zeileL, BERICHTIGT);
    const amServer = await korrekturenAmServer(page);
    await expect(bereich.locator("[data-testid=bild-widerspruch]")).toHaveCount(0);

    await page.reload();
    await befundFertig(page, RUMPF);
    const nachNeuladen = (await zeileL.getByTestId("bild-befund-text").textContent()) ?? "";
    const danach = await hinweise(bereich);
    await test.info().attach("ocr-e05-h02-word-route.json", {
      contentType: "application/json",
      body: JSON.stringify(
        { art: "Word-Add-in-Route ohne Word-Host", roh, vorher, amServer, nachNeuladen, danach },
        null,
        2,
      ),
    });

    pruefeAbweichung(vorher, /Bild 1, Zeile \d+$/);
    expect(amServer.korrekturen.map((k) => [k.quelle, k.text])).toEqual([
      [`entwurf:${entwurfId}`, BERICHTIGT],
    ]);
    expect(nachNeuladen).toBe(BERICHTIGT);
    expect(danach).toEqual([]);
  } finally {
    await aufraeumen(page);
    if (entwurfId) {
      await page.request.delete(`/api/drafts/${entwurfId}`).catch(() => undefined);
    }
  }
});

test("OCR-E05 · H06 Office im Artikel · Abweichung, Fundstellen und Neubewertung nach gespeicherter Berichtigung", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await ensureLoggedIn(page);
  await page.goto("/");
  const bild = await bildMitAbweichung(page);
  const name = `abrechnung-h06-${marke()}.pptx`;
  try {
    const ko = await page.request.post("/api/kos", {
      data: {
        title: `Fiktive Abrechnung H06 ${marke()}`,
        statement: "Fiktiver Artikel für die Abweichungsprobe eines Office-Anhangs.",
        type: "best_practice",
        category: "Abrechnung",
        confidentiality: "intern",
      },
    });
    expect(ko.ok(), await ko.text()).toBe(true);
    const { id: koId } = (await ko.json()) as { id: string };
    const deck = deckMit([{ titel: TEXT, png: bild.png }]);
    const objekt = await page.request.post("/api/objects", {
      data: {
        name,
        mime: PPTX_TYP,
        data: `data:${PPTX_TYP};base64,${deck.toString("base64")}`,
        purpose: "attachment",
      },
    });
    expect(objekt.ok(), await objekt.text()).toBe(true);
    const { id: objectId } = (await objekt.json()) as { id: string };
    const angehaengt = await page.request.put(`/api/kos/${koId}`, {
      data: { action: "attach", attachment: { name, mime: PPTX_TYP, objectId } },
    });
    expect(angehaengt.ok(), await angehaengt.text()).toBe(true);
    const stand = (await angehaengt.json()) as { attachments?: { id: string }[] };
    const anhangId = stand.attachments?.at(-1)?.id ?? "";
    expect(anhangId).not.toBe("");

    const auswahl = `[data-office-bild-befund="${anhangId}"]`;
    const oeffnen = async (): Promise<void> => {
      await page.goto(`/wissen/${koId}`);
      await expect(page.getByTestId("bib-titel")).toBeVisible({ timeout: 15_000 });
      await nutzungshinweisQuittieren(page);
      await page.getByTestId("bib-mehr").click();
      await page.locator('[data-bib-abschnitt="anhaenge"] > summary').click();
      await befundFertig(page, auswahl);
    };
    await oeffnen();
    const bereich = page.locator(auswahl);
    const vorher = await hinweise(bereich);
    const zeileL = bereich.getByTestId("bild-befund").first();
    const roh = (await zeileL.getByTestId("bild-befund-text").textContent()) ?? "";

    await berichtigeIn(zeileL, BERICHTIGT);
    const amServer = await korrekturenAmServer(page);
    await expect(bereich.locator("[data-testid=bild-widerspruch]")).toHaveCount(0);

    // Neuladen: der Artikel neu geöffnet, die Fassung erneut gelesen — die Berichtigung gilt weiter.
    await page.reload();
    await oeffnen();
    const nachNeuladen = (await zeileL.getByTestId("bild-befund-text").textContent()) ?? "";
    const danach = await hinweise(bereich);
    await test.info().attach("ocr-e05-h06-office-im-artikel.json", {
      contentType: "application/json",
      body: JSON.stringify(
        {
          art: "Fiktiver Artikel mit PowerPoint-Anhang; Office-Editor im Prüfaufbau nicht eingerichtet",
          roh,
          vorher,
          amServer,
          nachNeuladen,
          danach,
        },
        null,
        2,
      ),
    });
    await test.info().attach("ocr-e05-h06-office-im-artikel.png", {
      contentType: "image/png",
      body: await bereich.screenshot(),
    });

    const ortImBild = new RegExp(`${name.replace(/\./g, "\\.")} · Folie 1, Bild 1, Zeile`);
    pruefeAbweichung(vorher, ortImBild);
    expect(amServer.korrekturen.map((k) => [k.quelle, k.text])).toEqual([
      [`office:${anhangId}`, BERICHTIGT],
    ]);
    expect(nachNeuladen).toBe(BERICHTIGT);
    expect(danach).toEqual([]);
  } finally {
    await aufraeumen(page);
  }
});
